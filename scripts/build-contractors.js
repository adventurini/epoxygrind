#!/usr/bin/env node
/**
 * Builds the contractor directory `/contractors/` — national hub, a page
 * per state (always, even with zero listings, so the nav link never 404s),
 * and a profile page per enriched contractor (content/data/enriched.json,
 * from scripts/enrich-contractors.py).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allStateSlugs } from '../lib/metros.js';
import { CONTRACTORS } from '../lib/contractors.js';
import { renderContractorsHub, renderContractorState, renderContractorProfile } from '../lib/contractor-templates.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let built = 0;
let failures = 0;

function writePage(outPath, html) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  built += 1;
  console.log(`  wrote ${outPath.replace(ROOT + '/', '')}`);
}

function run() {
  console.log('National hub:');
  writePage(join(ROOT, 'contractors', 'index.html'), renderContractorsHub());

  console.log(`\nState pages (${allStateSlugs().length}):`);
  for (const stateSlug of allStateSlugs()) {
    try {
      writePage(join(ROOT, 'contractors', stateSlug, 'index.html'), renderContractorState(stateSlug));
    } catch (err) {
      failures += 1;
      console.error(`  FAILED ${stateSlug}: ${err.message}`);
    }
  }

  console.log(`\nContractor profiles (${CONTRACTORS.length}):`);
  for (const c of CONTRACTORS) {
    try {
      writePage(join(ROOT, 'contractors', c.state_slug, c.slug, 'index.html'), renderContractorProfile(c));
    } catch (err) {
      failures += 1;
      console.error(`  FAILED ${c.slug}: ${err.message}`);
    }
  }

  console.log(`\nBuilt ${built} page(s), ${failures} failure(s).`);
  if (failures > 0) process.exitCode = 1;
}

run();
