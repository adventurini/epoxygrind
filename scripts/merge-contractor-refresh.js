#!/usr/bin/env node
/**
 * Merges scripts/enrich-contractors.py's refresh output (content/data/
 * enriched-refresh.json — the corrected-socials + new-logo_url re-scrape,
 * run against only the ~3664 currently-qualifying contractors) back into
 * the full content/data/enriched.json (6919 contractors). Only updates
 * `socials` and `logo_url` on matching contractors (by place_id) — leaves
 * every other field and every non-refreshed contractor untouched, so this
 * can't regress data outside what this specific re-scrape was for.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULL_PATH = join(ROOT, 'content', 'data', 'enriched.json');
const REFRESH_PATH = join(ROOT, 'content', 'data', 'enriched-refresh.json');

const full = JSON.parse(readFileSync(FULL_PATH, 'utf8'));
const refresh = JSON.parse(readFileSync(REFRESH_PATH, 'utf8'));

const byPlaceId = new Map(refresh.filter((c) => c.place_id).map((c) => [c.place_id, c]));

let updated = 0;
let logosFound = 0;
for (const c of full) {
  const match = c.place_id && byPlaceId.get(c.place_id);
  if (!match) continue;
  c.socials = match.socials || {};
  c.logo_url = match.logo_url || null;
  if (c.logo_url) logosFound++;
  updated++;
}

writeFileSync(FULL_PATH, JSON.stringify(full, null, 2));
console.log(`Merged refresh into enriched.json: ${updated} contractors updated, ${logosFound} with a logo_url found.`);
