#!/usr/bin/env node
/**
 * One-off: force-recrawls every contractor whose LATEST audit is currently
 * outreach_excluded (crawl_blocked or unreachable) via the admin recrawl
 * endpoint running on Vercel — a different outbound IP than this sandbox,
 * which was confirmed (2026-07-07) to clear the SGCaptcha block that
 * caused most of these. Re-mints the admin session token periodically
 * since a single JWT may not outlive a long batch.
 */
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';

function loadEnv() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'anthonydventurini@gmail.com';
const LOG_PATH = 'scripts/recrawl-progress.log';
// First run at 1.5s pacing hammered the same warm Vercel container back to
// back and progressively exhausted it — timed out, then
// net::ERR_INSUFFICIENT_RESOURCES, then every request failing with
// "browser has been closed". Spaced-out manual tests (naturally 1-5min
// apart) all succeeded, so 25s between requests is a large, evidence-based
// safety margin, not a guess.
const DELAY_MS = 25_000;
const TOKEN_REFRESH_EVERY = 12; // re-mint well before a ~60min JWT could expire
const RESOURCE_EXHAUSTION_RE = /browser has been closed|INSUFFICIENT_RESOURCES|Audit timed out/i;
const MAX_CONSECUTIVE_RESOURCE_FAILURES = 5;

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  appendFileSync(LOG_PATH, stamped + '\n');
}

async function mintAdminToken() {
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: ADMIN_EMAIL }),
  });
  const linkData = await linkRes.json();
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: linkData.hashed_token }),
  });
  const session = await verifyRes.json();
  if (!session.access_token) throw new Error('Could not mint admin token: ' + JSON.stringify(session));
  return session.access_token;
}

async function sb(path, from, to) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Range: `${from}-${to}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function getCurrentlyExcluded() {
  const PAGE_SIZE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = await sb(
      `audits?select=contractor_id,audited_at,outreach_excluded_reason,contractors(name,website)&order=contractor_id.asc,audited_at.desc`,
      from,
      from + PAGE_SIZE - 1,
    );
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) break;
  }
  const latestByContractor = new Map();
  for (const row of all) {
    if (!latestByContractor.has(row.contractor_id)) latestByContractor.set(row.contractor_id, row);
  }
  return [...latestByContractor.values()].filter((r) => r.outreach_excluded_reason && r.contractors?.website);
}

const RESUME = process.argv.includes('--resume');

async function main() {
  if (!RESUME) writeFileSync(LOG_PATH, '');
  const targets = await getCurrentlyExcluded();
  log(`Found ${targets.length} currently outreach-excluded contractors to recrawl.`);

  if (targets.length === 0) {
    log('Nothing left to recrawl — fully done.');
    return true;
  }

  let token = await mintAdminToken();
  let done = 0, cleared = 0, stillExcluded = 0, failed = 0;
  let consecutiveResourceFailures = 0;
  let aborted = false;

  for (let i = 0; i < targets.length; i++) {
    if (i > 0 && i % TOKEN_REFRESH_EVERY === 0) {
      token = await mintAdminToken();
      log('  (refreshed admin token)');
    }

    const t = targets[i];
    let isResourceFailure = false;
    try {
      const res = await fetch('https://www.epoxygrind.com/api/admin/recrawl', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId: t.contractor_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        failed++;
        log(`[${i + 1}/${targets.length}] FAILED ${t.contractors.name}: ${data.error || res.status}`);
      } else if (data.outreachExcludedReason) {
        stillExcluded++;
        isResourceFailure = RESOURCE_EXHAUSTION_RE.test(data.error || '');
        log(`[${i + 1}/${targets.length}] STILL EXCLUDED (${data.outreachExcludedReason}) ${t.contractors.name} — was ${t.outreach_excluded_reason}${isResourceFailure ? ' [resource exhaustion]' : ''}`);
      } else {
        cleared++;
        log(`[${i + 1}/${targets.length}] CLEARED ${t.contractors.name} — score ${data.compositeScore} (was ${t.outreach_excluded_reason})`);
      }
    } catch (err) {
      failed++;
      log(`[${i + 1}/${targets.length}] ERROR ${t.contractors.name}: ${err.message}`);
    }

    consecutiveResourceFailures = isResourceFailure ? consecutiveResourceFailures + 1 : 0;
    if (consecutiveResourceFailures >= MAX_CONSECUTIVE_RESOURCE_FAILURES) {
      log(`\nABORTING this pass: ${consecutiveResourceFailures} consecutive resource-exhaustion failures — Vercel container likely degraded. Cooling down before resuming.`);
      aborted = true;
      break;
    }
    done++;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  log(`\nPass done. ${done} processed — ${cleared} cleared, ${stillExcluded} still excluded, ${failed} failed.`);
  return !aborted;
}

main()
  .then((fullyDone) => process.exit(fullyDone ? 0 : 2))
  .catch((err) => {
    log('FATAL: ' + err.message);
    process.exit(1);
  });
