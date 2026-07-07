#!/usr/bin/env node
/**
 * One-off: recomputes top_findings for every existing audits row using its
 * already-stored category_scores — no re-crawl needed. Run after any
 * change to composeResult()'s topFindings logic (e.g. the Click-to-call /
 * Click-to-call link dedup) so already-audited rows reflect the fix
 * retroactively instead of only new audits.
 */
import { readFileSync } from 'node:fs';

function loadEnv() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

const { composeResult } = await import('../lib/audit/index.js');

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
  const PAGE_SIZE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = await sb(`audits?select=id,category_scores,top_findings`, {
      headers: { Range: `${from}-${from + PAGE_SIZE - 1}` },
    });
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) break;
  }
  console.log(`Loaded ${all.length} audits.`);

  let changed = 0, unchanged = 0, skipped = 0;
  for (const row of all) {
    if (!row.category_scores) { skipped++; continue; }
    let recomputed;
    try {
      recomputed = composeResult(row.category_scores);
    } catch (err) {
      console.error(`  FAILED to recompute ${row.id}: ${err.message}`);
      skipped++;
      continue;
    }
    const oldLabels = (row.top_findings || []).map((f) => f.label).join(',');
    const newLabels = recomputed.topFindings.map((f) => f.label).join(',');
    if (oldLabels === newLabels) { unchanged++; continue; }

    await sb(`audits?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ top_findings: recomputed.topFindings }),
    });
    changed++;
  }
  console.log(`Done. ${changed} changed, ${unchanged} unchanged, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
