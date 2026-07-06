#!/usr/bin/env node
/**
 * Calibration script for the audit engine — run against a handful of real
 * contractor sites and eyeball whether the scores feel right, before
 * running the full batch. Usage: node scripts/test-audit.js [count]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const { CONTRACTORS } = await import('../lib/contractors.js');
const { runAudit } = await import('../lib/audit/index.js');

const count = Number(process.argv[2]) || 1;
const withEmailAndWebsite = CONTRACTORS.filter((c) => c.emails?.length && c.website);
const targets = withEmailAndWebsite.slice(0, count);

for (const contractor of targets) {
  console.log(`\n=== ${contractor.name} — ${contractor.website} ===`);
  const start = Date.now();
  try {
    const result = await runAudit(contractor, 15);
    const took = Math.round((Date.now() - start) / 1000);
    console.log(`(${took}s)`, JSON.stringify({
      compositeScore: result.compositeScore,
      grade: result.grade,
      categoryScores: Object.fromEntries(Object.entries(result.categoryScores || {}).map(([k, v]) => [k, v.score])),
      topFindings: result.topFindings?.map((f) => `${f.label} (${f.category}, sev ${f.severity})`),
      siteUnreachable: result.siteUnreachable,
      error: result.error,
    }, null, 2));
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}
