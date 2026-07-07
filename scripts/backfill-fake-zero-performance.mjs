#!/usr/bin/env node
/**
 * One-off: fixes audits where scoring-performance.js's old `?? 0` fallback
 * silently turned a failed Lighthouse navigation into a fake 0/100 score
 * (real bug — confirmed one real site returned an actual HTTP 500 to
 * Lighthouse's own request). Patches performance to the honest
 * {score:null, error:...} shape and recomputes composite score/grade/
 * topFindings from the already-stored category_scores — no re-crawl
 * needed, since we're correctly excluding a signal we now know was never
 * real, not fabricating new data.
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
const { gradeForScore } = await import('../lib/audit/grades.js');

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
    const rows = await sb(`audits?select=id,category_scores,composite_score,grade`, {
      headers: { Range: `${from}-${from + PAGE_SIZE - 1}` },
    });
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) break;
  }
  console.log(`Loaded ${all.length} audits.`);

  const affected = all.filter((r) => {
    const perf = r.category_scores?.performance;
    return perf && perf.score === 0 && perf.raw?.perfScore === 0 && perf.raw?.lcpSeconds === 0 && perf.raw?.pageWeightKb === 0;
  });
  console.log(`Found ${affected.length} affected by the fake-zero performance bug.`);

  for (const row of affected) {
    const patchedCategoryScores = {
      ...row.category_scores,
      performance: {
        score: null,
        checks: [],
        error: 'Lighthouse could not load the page (the site may be blocking automated requests or returned an error).',
      },
    };
    const { compositeScore, topFindings } = composeResult(patchedCategoryScores);
    const grade = gradeForScore(compositeScore);

    await sb(`audits?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        category_scores: patchedCategoryScores,
        composite_score: compositeScore,
        grade: grade.grade,
        grade_color: grade.color,
        grade_header: grade.header,
        top_findings: topFindings,
      }),
    });
    console.log(`  ${row.id}: composite ${row.composite_score} (${row.grade}) -> ${compositeScore} (${grade.grade})`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
