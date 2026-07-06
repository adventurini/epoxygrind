#!/usr/bin/env node
/**
 * Retrofits the sitewide structure crawl (lib/audit/site-structure.js) onto
 * `audits` rows that were scored before it existed — without re-running
 * Lighthouse or the AI-vision calls, which already scored fine and cost
 * real money. Only adds the new siteStructure category, merges it into the
 * row's existing category_scores, and recomputes composite_score/grade/
 * top_findings from the full (old + new) category set.
 *
 * Resume support: skips any row that already has site_structure populated,
 * so re-running after an interruption just continues.
 *
 * Usage: node scripts/enrich-site-structure.js [--limit N] [--concurrency N]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const { crawlSiteStructure } = await import('../lib/audit/site-structure.js');
const { scoreStructure } = await import('../lib/audit/scoring-structure.js');
const { composeResult } = await import('../lib/audit/index.js');

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;
const concurrencyArg = process.argv.indexOf('--concurrency');
const CONCURRENCY = concurrencyArg !== -1 ? Number(process.argv[concurrencyArg + 1]) : 2;

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

async function main() {
  console.log('Fetching audit rows needing the structure enrichment pass...');
  let rows = [];
  let from = 0;
  while (true) {
    const batch = await sb(
      `audits?select=id,contractor_id,final_url,category_scores&has_website=eq.true&site_unreachable=eq.false&site_structure=is.null&final_url=not.is.null&limit=1000&offset=${from}`,
    );
    if (!batch.length) break;
    rows.push(...batch);
    from += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`Rows needing enrichment: ${rows.length}`);
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log('Fetching contractor phone numbers...');
  const phonesById = new Map();
  let pFrom = 0;
  while (true) {
    const batch = await sb(`contractors?select=id,phones&limit=1000&offset=${pFrom}`);
    if (!batch.length) break;
    batch.forEach((c) => phonesById.set(c.id, c.phones || []));
    pFrom += batch.length;
    if (batch.length < 1000) break;
  }

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function worker(queue) {
    while (queue.length) {
      const row = queue.shift();
      try {
        const structure = await Promise.race([
          crawlSiteStructure(row.final_url, { knownPhones: phonesById.get(row.contractor_id) || [] }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('structure crawl timed out after 90s')), 90_000)),
        ]);
        const siteStructureScore = scoreStructure(structure);
        const categoryScores = { ...(row.category_scores || {}), siteStructure: siteStructureScore };
        const { compositeScore, grade, topFindings } = composeResult(categoryScores);

        const siteStructureData = structure?.ok
          ? {
              pageCount: structure.pageCount,
              cappedAtMax: structure.cappedAtMax,
              urlList: structure.urlList,
              brokenLinks: structure.brokenLinks,
              pages: structure.pages.map((p) => ({
                url: p.url,
                statusCode: p.statusCode,
                title: p.title,
                metaDescription: p.metaDescription,
                og: p.og,
                wordCount: p.wordCount,
              })),
            }
          : { ok: false, error: structure?.error || 'unknown error' };

        await sb(`audits?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            category_scores: categoryScores,
            composite_score: compositeScore,
            grade: grade?.grade || null,
            grade_color: grade?.color || null,
            grade_header: grade?.header || null,
            top_findings: topFindings,
            site_structure: siteStructureData,
          }),
        });
        done++;
      } catch (err) {
        failed++;
        console.error(`  FAILED contractor_id=${row.contractor_id} (${row.final_url}): ${err.message}`);
      }
      if ((done + failed) % 20 === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = (done + failed) / elapsed;
        const etaMin = Math.round((rows.length - done - failed) / rate / 60);
        console.log(`  [${done + failed}/${rows.length}] ok=${done} failed=${failed} — ~${etaMin}min remaining`);
      }
    }
  }

  const queue = [...rows];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\nDone. ${done} enriched, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
