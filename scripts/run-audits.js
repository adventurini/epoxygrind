#!/usr/bin/env node
/**
 * Batch-runs the Phase 2 audit engine against every quality-bar-passing
 * contractor that also has a real email on file (2,199 as of 2026-07-06 —
 * no email means no way to deliver the audit or claim-link them into the
 * funnel, so there's no point auditing them yet).
 *
 * Resume support: skips any contractor that already has a row in `audits`
 * — this session has repeatedly seen long-running batch jobs killed around
 * the ~1hr mark, so re-running this script after an interruption just
 * picks up where it left off instead of re-doing (and re-paying for) work.
 *
 * Usage: node scripts/run-audits.js [--limit N] [--concurrency N]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lighthouse has real internal bugs triggered by specific malformed pages
// (e.g. a bad webpack source map) that throw from an async tick outside any
// local try/catch and crash the whole process — observed against a real
// site in this exact batch. Each unit of work here is independent and safe
// to retry (resume-by-existing-row below), so log and keep going instead of
// losing the other 2000+ contractors to one bad site.
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (continuing):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION (continuing):', err?.message || err);
});

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');

const { CONTRACTORS } = await import('../lib/contractors.js');
const { runAudit } = await import('../lib/audit/index.js');

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;
const concurrencyArg = process.argv.indexOf('--concurrency');
const CONCURRENCY = concurrencyArg !== -1 ? Number(process.argv[concurrencyArg + 1]) : 5;

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function main() {
  let targets = CONTRACTORS.filter((c) => c.emails?.length && c.website);
  console.log(`Eligible contractors (quality bar + email + website): ${targets.length}`);
  if (LIMIT) targets = targets.slice(0, LIMIT);

  // The static CONTRACTORS array (enriched.json) has no numeric id — audits.
  // contractor_id is a real FK to the Supabase contractors table, matched
  // by place_id (unique, and every eligible contractor has one).
  console.log('Resolving contractor_id via place_id...');
  const placeIdToId = new Map();
  let pFrom = 0;
  while (true) {
    const rows = await sb(`contractors?select=id,place_id&place_id=not.is.null&limit=1000&offset=${pFrom}`);
    if (!rows.length) break;
    rows.forEach((r) => placeIdToId.set(r.place_id, r.id));
    pFrom += rows.length;
    if (rows.length < 1000) break;
  }
  targets = targets.map((c) => ({ ...c, id: placeIdToId.get(c.place_id) })).filter((c) => {
    if (!c.id) console.error(`  no contractors row for place_id ${c.place_id} (${c.name}) — skipping`);
    return Boolean(c.id);
  });

  // Local median review count per state — computed once from the full
  // eligible set, not per contractor (spec's "local median" comparison for
  // the Local Presence category).
  const byState = new Map();
  for (const c of CONTRACTORS.filter((x) => x.emails?.length && x.website)) {
    if (!byState.has(c.state)) byState.set(c.state, []);
    byState.get(c.state).push(c.google_review_count || 0);
  }
  const medianByState = new Map([...byState.entries()].map(([state, counts]) => [state, median(counts)]));

  console.log('Checking already-audited contractors (resume support)...');
  const existingIds = new Set();
  let from = 0;
  while (true) {
    const rows = await sb(`audits?select=contractor_id&limit=1000&offset=${from}`);
    if (!rows.length) break;
    rows.forEach((r) => existingIds.add(r.contractor_id));
    from += rows.length;
    if (rows.length < 1000) break;
  }
  console.log(`Already audited: ${existingIds.size}`);

  const remaining = targets.filter((c) => !existingIds.has(c.id));
  console.log(`Remaining to audit: ${remaining.length}`);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function worker(queue) {
    while (queue.length) {
      const contractor = queue.shift();
      try {
        const result = await Promise.race([
          runAudit(contractor, medianByState.get(contractor.state) || 0),
          new Promise((_, reject) => setTimeout(() => reject(new Error('audit timed out after 120s')), 120_000)),
        ]);
        await sb('audits', {
          method: 'POST',
          body: JSON.stringify({
            contractor_id: contractor.id,
            has_website: result.hasWebsite,
            site_unreachable: Boolean(result.siteUnreachable),
            final_url: result.finalUrl || null,
            composite_score: result.compositeScore,
            grade: result.grade?.grade || null,
            grade_color: result.grade?.color || null,
            grade_header: result.grade?.header || null,
            category_scores: result.categoryScores || null,
            top_findings: result.topFindings || null,
            site_structure: result.siteStructureData || null,
            screenshots: null, // data URLs are large; not persisted to Postgres — regenerate on demand for the reveal page later
            error: result.error || null,
          }),
        });
        done++;
      } catch (err) {
        failed++;
        console.error(`  FAILED ${contractor.name} (${contractor.website}): ${err.message}`);
      }
      if ((done + failed) % 20 === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = (done + failed) / elapsed;
        const etaMin = Math.round((remaining.length - done - failed) / rate / 60);
        console.log(`  [${done + failed}/${remaining.length}] ok=${done} failed=${failed} — ~${etaMin}min remaining, est cost so far $${(done * 0.02).toFixed(2)}`);
      }
    }
  }

  const queue = [...remaining];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\nDone. ${done} audited, ${failed} failed. Estimated AI cost: $${(done * 0.02).toFixed(2)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
