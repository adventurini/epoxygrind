#!/usr/bin/env node
/**
 * Builds static HTML for every DIY/product content page from its data file
 * (spec_2 §11a/11c) — the plain-JS equivalent of the spec's MDX+component
 * build pipeline. A page whose data references an unresolved product
 * (unknown/todo/dead in the registry) is skipped with a logged error and
 * fails the build (nonzero exit) — the closest runtime equivalent of the
 * spec's "build fails on unknown/todo ProductLink" enforcement, since this
 * site has no bundler to enforce it at compile time.
 *
 * Run with `npm run build-content`. Re-run after editing any file under
 * content/data/ or content/data/diy-hub.js — output is plain .html files
 * checked into the repo, not generated on request.
 */
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  renderRankingPage,
  renderReviewPage,
  renderConceptComparePage,
  renderDiyGuidePage,
  renderShoppingListPage,
  renderDiyHubPage,
  renderCompareHubPage,
  renderCoverageCalculatorPage,
} from '../lib/content-templates.js';
import { renderGuidePage, renderGuidePillar } from '../lib/guide-templates.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'content', 'data');

let failures = 0;
let built = 0;

function writePage(outPath, html) {
  const dir = dirname(outPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, html);
  built += 1;
  console.log(`  wrote ${outPath.replace(ROOT + '/', '')}`);
}

async function buildSection(subdir, outPrefix, renderFn) {
  const dir = join(DATA_DIR, subdir);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  if (!files.length) return;

  console.log(`\n${subdir} (${files.length}):`);
  for (const file of files) {
    const mod = await import(`file://${join(dir, file)}?t=${Date.now()}`);
    const data = mod.default;
    try {
      const html = renderFn(data);
      writePage(join(ROOT, outPrefix, data.slug, 'index.html'), html);
    } catch (err) {
      failures += 1;
      console.error(`  FAILED ${file}: ${err.message}`);
    }
  }
}

async function buildDiyHub() {
  const hubPath = join(DATA_DIR, 'diy-hub.js');
  if (!existsSync(hubPath)) return;
  const mod = await import(`file://${hubPath}?t=${Date.now()}`);
  try {
    const html = renderDiyHubPage(mod.default);
    writePage(join(ROOT, 'diy', 'index.html'), html);
  } catch (err) {
    failures += 1;
    console.error(`  FAILED diy-hub.js: ${err.message}`);
  }
}

async function buildHub(dataFile, outPath, renderFn) {
  const hubPath = join(DATA_DIR, dataFile);
  if (!existsSync(hubPath)) return;
  const mod = await import(`file://${hubPath}?t=${Date.now()}`);
  try {
    const html = renderFn(mod.default);
    writePage(join(ROOT, ...outPath), html);
  } catch (err) {
    failures += 1;
    console.error(`  FAILED ${dataFile}: ${err.message}`);
  }
}

async function run() {
  await buildDiyHub();
  await buildHub('compare-hub.js', ['compare', 'index.html'], renderCompareHubPage);
  await buildHub('tools/epoxy-coverage-calculator.js', ['tools', 'epoxy-coverage-calculator', 'index.html'], renderCoverageCalculatorPage);
  await buildHub('diy-vs-pro-pillar.js', ['compare', 'diy-kit-vs-professional-epoxy', 'index.html'], renderGuidePillar);
  await buildSection('rankings', 'best', renderRankingPage);
  await buildSection('reviews', 'reviews', renderReviewPage);
  await buildSection('compare', 'compare', renderConceptComparePage);
  await buildSection('diy', 'diy', renderDiyGuidePage);
  await buildSection('shopping-lists', 'diy', renderShoppingListPage);
  await buildSection('guides', 'guides', renderGuidePage);

  console.log(`\nBuilt ${built} page(s), ${failures} failure(s).`);
  if (failures > 0) process.exitCode = 1;
}

run();
