#!/usr/bin/env node
/**
 * Trims every contractor's `website` down to just the top-level URL
 * (scheme + host, trailing slash) — no path, no query string. Scraped
 * websites were often a location-specific subpage with GMB/UTM tracking
 * params (e.g. ".../locations/dallas/?utm_source=google&utm_campaign=...")
 * baked in by the contractor's own ad campaigns; those aren't useful (or
 * clean-looking) as the one link shown on a contractor's profile page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHED_PATH = join(ROOT, 'content', 'data', 'enriched.json');

const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));

let changed = 0;
for (const c of enriched) {
  if (!c.website) continue;
  let url;
  try {
    url = new URL(c.website);
  } catch {
    continue;
  }
  const topLevel = `${url.protocol}//${url.host}/`;
  if (topLevel !== c.website) {
    c.website = topLevel;
    changed++;
  }
}

writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));
console.log(`Trimmed ${changed} contractor websites to their top-level domain.`);
