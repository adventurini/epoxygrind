#!/usr/bin/env node
/**
 * Builds the local SEO pages (Master SEO spec_4 §5) from
 * content/data/metros.json — the national hub, all state rollups, and a
 * city hub for every metro in the dataset. The spec's own launch sequence
 * gates Tier 2/3 behind a GSC indexing checkpoint on Tier 1 ("10 Tier 1
 * hubs → verify indexing → then expand") — generating all 331 up front is
 * an explicit owner decision to skip that phased gate, not an oversight.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { METROS, metroIsPublishable, allStateSlugs } from '../lib/metros.js';
import { renderCityHub, renderStateRollup, renderNationalHub } from '../lib/local-templates.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let built = 0;
let failures = 0;
let skipped = 0;

function writePage(outPath, html) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  built += 1;
  console.log(`  wrote ${outPath.replace(ROOT + '/', '')}`);
}

function run() {
  console.log('National hub:');
  writePage(join(ROOT, 'epoxy-flooring', 'index.html'), renderNationalHub(METROS));

  console.log(`\nState rollups (${allStateSlugs().length}):`);
  for (const stateSlug of allStateSlugs()) {
    try {
      const html = renderStateRollup(stateSlug);
      if (!html) { skipped += 1; continue; }
      writePage(join(ROOT, 'epoxy-flooring', stateSlug, 'index.html'), html);
    } catch (err) {
      failures += 1;
      console.error(`  FAILED ${stateSlug}: ${err.message}`);
    }
  }

  console.log(`\nCity hubs (${METROS.length}):`);
  for (const metro of METROS) {
    if (!metroIsPublishable(metro)) {
      skipped += 1;
      console.error(`  SKIPPED ${metro.slug}: missing cost_index/climate_region`);
      continue;
    }
    try {
      const html = renderCityHub(metro);
      writePage(join(ROOT, 'epoxy-flooring', metro.state_slug, metro.slug, 'index.html'), html);
    } catch (err) {
      failures += 1;
      console.error(`  FAILED ${metro.slug}: ${err.message}`);
    }
  }

  console.log(`\nBuilt ${built} page(s), ${skipped} skipped, ${failures} failure(s).`);
  if (failures > 0) process.exitCode = 1;
}

run();
