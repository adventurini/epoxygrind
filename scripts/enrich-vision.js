#!/usr/bin/env node
/**
 * Retrofits Design & UX + Image Quality AI-vision scoring onto `audits` rows
 * that got a null designUx score during the batch — fal.ai's account ran
 * out of balance ~38 minutes into the run (2026-07-06 ~17:14 UTC), silently
 * degrading 1,626 of 2,085 audits (composite scores still valid — the
 * reweighting logic correctly excludes missing categories — but Design &
 * UX is entirely missing and Image Quality fell back to programmatic-only
 * for that group). Balance has been topped up; this fixes those rows
 * without re-running Lighthouse (still valid, doesn't touch fal.ai) or the
 * rest of the pipeline.
 *
 * Still needs a real Playwright visit (crawlSite + screenshot) since
 * screenshots/raw images aren't persisted in Postgres — only the scored
 * output is. Only designUx and imageQuality are touched in category_scores;
 * every other category's existing score is left untouched.
 *
 * Usage: node scripts/enrich-vision.js [--limit N] [--concurrency N]
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

const { crawlSite } = await import('../lib/audit/site-crawl.js');
const { captureDesktopScreenshot } = await import('../lib/audit/screenshots.js');
const { scoreDesignUX } = await import('../lib/audit/vision-design.js');
const { scoreImageQuality } = await import('../lib/audit/vision-images.js');
const { composeResult } = await import('../lib/audit/index.js');

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

async function main() {
  console.log('Fetching audit rows missing Design & UX...');
  let rows = [];
  let from = 0;
  while (true) {
    const batch = await sb(
      `audits?select=id,contractor_id,final_url,category_scores&has_website=eq.true&site_unreachable=eq.false&limit=1000&offset=${from}`,
    );
    if (!batch.length) break;
    rows.push(...batch);
    from += batch.length;
    if (batch.length < 1000) break;
  }
  rows = rows.filter((r) => r.category_scores?.designUx?.score == null);
  console.log(`Rows needing vision re-score: ${rows.length}`);
  if (LIMIT) rows = rows.slice(0, LIMIT);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function worker(queue) {
    while (queue.length) {
      const row = queue.shift();
      try {
        const [crawl, desktopScreenshot] = await Promise.race([
          Promise.all([
            crawlSite(row.final_url, {}),
            captureDesktopScreenshot(row.final_url),
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('vision re-crawl timed out after 90s')), 90_000)),
        ]);

        if (!crawl.ok) throw new Error(`crawl failed: ${crawl.error}`);

        const [designUx, imageQuality] = await Promise.all([
          scoreDesignUX(desktopScreenshot, crawl.mobileScreenshot),
          scoreImageQuality(crawl.images),
        ]);

        const categoryScores = { ...(row.category_scores || {}), designUx, imageQuality };
        const { compositeScore, grade, topFindings } = composeResult(categoryScores);

        await sb(`audits?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            category_scores: categoryScores,
            composite_score: compositeScore,
            grade: grade?.grade || null,
            grade_color: grade?.color || null,
            grade_header: grade?.header || null,
            top_findings: topFindings,
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
        console.log(`  [${done + failed}/${rows.length}] ok=${done} failed=${failed} — ~${etaMin}min remaining, est cost so far $${(done * 0.02).toFixed(2)}`);
      }
    }
  }

  const queue = [...rows];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\nDone. ${done} re-scored, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
