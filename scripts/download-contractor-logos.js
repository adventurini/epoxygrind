#!/usr/bin/env node
/**
 * Downloads and self-hosts each contractor's real logo (logo_url, captured
 * by scripts/enrich-contractors.py's extract_logo_url from their own
 * homepage) under images/contractors/{state_slug}/{slug}/logo.{ext} —
 * same self-hosting pattern as the Places hero photo, so displaying it
 * costs nothing per page view and never breaks if their site changes.
 * Free — these are the contractors' own public logo images, no API involved.
 *
 * Usage: node scripts/download-contractor-logos.js [--limit N]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHED_PATH = join(ROOT, 'content', 'data', 'enriched.json');
const IMAGES_DIR = join(ROOT, 'images', 'contractors');
const MANIFEST_PATH = join(ROOT, 'content', 'data', 'contractor-logos.json');

const STATE_ABBR_TO_SLUG = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado',
  CT: 'connecticut', DE: 'delaware', DC: 'district-of-columbia', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas', KY: 'kentucky',
  LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan', MN: 'minnesota',
  MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new-hampshire',
  NJ: 'new-jersey', NM: 'new-mexico', NY: 'new-york', NC: 'north-carolina', ND: 'north-dakota',
  OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode-island',
  SC: 'south-carolina', SD: 'south-dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west-virginia', WI: 'wisconsin', WY: 'wyoming',
};

function slugifyName(name) {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function extFromUrlOrType(url, contentType) {
  const urlExt = extname(new URL(url).pathname).toLowerCase().replace('.', '');
  if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(urlExt)) return urlExt === 'jpeg' ? 'jpg' : urlExt;
  if (contentType?.includes('svg')) return 'svg';
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  return 'jpg';
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;

  const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));
  let targets = enriched.filter((c) => c.phones?.length && c.service_areas?.length && c.logo_url);
  if (limit) targets = targets.slice(0, limit);

  console.log(`Downloading logos for ${targets.length} contractors...`);

  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const stateSlug = STATE_ABBR_TO_SLUG[c.state] || c.state.toLowerCase();
    const slug = slugifyName(c.name);
    const key = `${stateSlug}/${slug}`;

    try {
      const res = await fetch(c.logo_url, { headers: { 'User-Agent': 'EpoxyGrindBot/1.0 (+https://epoxygrind.com/bot)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error('suspiciously small response, likely not a real image');

      const ext = extFromUrlOrType(c.logo_url, res.headers.get('content-type'));
      const dir = join(IMAGES_DIR, stateSlug, slug);
      mkdirSync(dir, { recursive: true });
      const destPath = join(dir, `logo.${ext}`);
      writeFileSync(destPath, buf);

      manifest[key] = { path: `/images/contractors/${stateSlug}/${slug}/logo.${ext}`, source: c.logo_url };
      ok++;
      console.log(`  [${i + 1}/${targets.length}] ${c.name}: OK (${ext}, ${buf.length}b)`);
    } catch (err) {
      failed++;
      console.log(`  [${i + 1}/${targets.length}] ${c.name}: FAILED ${err.message}`);
    }

    if (i % 200 === 0) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${ok} logos downloaded, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
