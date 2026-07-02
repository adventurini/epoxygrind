#!/usr/bin/env node
/**
 * Weekly link checker (DIY & Product Content Spec §2.4). HTTP-checks every
 * "verified" registry URL; a 404 / redirect-to-search / unreachable result
 * gets logged so it can be marked "dead" and reviewed — third-party
 * merchant listings (Amazon especially) churn on their own schedule, so
 * this can't be a one-time check.
 *
 * Not yet wired to a schedule (no Vercel Cron entry exists for it) — run
 * manually with `node scripts/check-product-links.js`, or add a
 * `vercel.json` "crons" entry pointing at a thin API wrapper once this is
 * ready to run unattended.
 */
import { PRODUCTS } from '../lib/product-registry.js';

async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpoxyGrindLinkChecker/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, status: res.status, finalUrl: res.url };
  } catch (err) {
    return { ok: false, status: null, error: err.message };
  }
}

async function main() {
  const verified = PRODUCTS.filter((p) => p.status === 'verified' && p.url);
  console.log(`Checking ${verified.length} verified product links...\n`);

  const results = [];
  for (const product of verified) {
    const result = await checkUrl(product.url);
    results.push({ product, result });
    const label = result.ok ? 'OK' : 'FAIL';
    console.log(`[${label}] ${product.product_id} (${product.status}, ${result.status ?? 'error'})`);
    if (!result.ok) console.log(`  ${product.url}\n  ${result.error || `HTTP ${result.status}`}`);
  }

  const failures = results.filter((r) => !r.result.ok);
  console.log(`\n${failures.length} of ${verified.length} links failed.`);
  if (failures.length) {
    console.log('\nMark these "dead" in lib/product-registry.js and flag for review:');
    failures.forEach(({ product }) => console.log(`  - ${product.product_id}`));
    process.exitCode = 1;
  }
}

main();
