#!/usr/bin/env node
/**
 * Downloads each contractor's real logo (logo_url, captured by
 * scripts/enrich-contractors.py's extract_logo_url from their own
 * homepage) and uploads it straight to the public Supabase Storage
 * bucket `contractor-images` — no image ever touches local disk or the
 * git repo. Free — these are the contractors' own public logo images,
 * no API involved.
 *
 * Usage: node scripts/download-contractor-logos.js [--limit N]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHED_PATH = join(ROOT, 'content', 'data', 'enriched.json');
const MANIFEST_PATH = join(ROOT, 'content', 'data', 'contractor-logos.json');
const IMAGES_BUCKET = 'contractor-images';
const LOGO_MAX_WIDTH = 400;

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');

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

function isSvg(url, contentType, buf) {
  if (contentType?.includes('svg')) return true;
  if (extname(new URL(url).pathname).toLowerCase() === '.svg') return true;
  return buf.slice(0, 200).toString('utf8').trim().startsWith('<');
}

async function uploadBuffer(path, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGES_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`;
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;

  const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));
  let targets = enriched.filter((c) => c.phones?.length && c.service_areas?.length && c.logo_url);
  if (limit) targets = targets.slice(0, limit);

  console.log(`Fetching + uploading logos for ${targets.length} contractors...`);

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
      const raw = Buffer.from(await res.arrayBuffer());
      if (raw.length < 200) throw new Error('suspiciously small response, likely not a real image');

      let finalBuf = raw;
      let ext = 'png';
      let contentType = 'image/png';
      if (isSvg(c.logo_url, res.headers.get('content-type'), raw)) {
        ext = 'svg';
        contentType = 'image/svg+xml';
      } else {
        finalBuf = await sharp(raw).resize({ width: LOGO_MAX_WIDTH, withoutEnlargement: true }).png().toBuffer();
      }

      const storagePath = `${key}/logo.${ext}`;
      const publicUrl = await uploadBuffer(storagePath, finalBuf, contentType);
      manifest[key] = { path: publicUrl, source: c.logo_url };
      ok++;
      if (i % 100 === 0) console.log(`  [${i + 1}/${targets.length}] ${c.name}: OK`);
    } catch (err) {
      failed++;
      console.log(`  [${i + 1}/${targets.length}] ${c.name}: FAILED ${err.message}`);
    }

    if (i % 200 === 0) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${ok} logos uploaded, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
