#!/usr/bin/env node
/**
 * Builds a photo gallery (up to 6 photos) + picks a better hero photo for
 * every qualifying contractor, from data ALREADY cached in Supabase
 * places_cache (no new Google Places Details calls — that data was fetched
 * once by scripts/batch-fetch-places.js and includes up to 8 photos per
 * contractor with live media_urls; only photo[0] was ever uploaded before).
 *
 * Hero selection heuristic (no vision model, free): Google's own photo
 * order is arbitrary and sometimes picks a logo/headshot/document scan as
 * photo[0]. Score each candidate on aspect ratio (prefer roughly 1.2-2.2,
 * penalize near-square logos/avatars and extreme panoramas) and resolution
 * (penalize tiny images), pick the highest scorer as hero; the rest (in
 * Google's original order) become the gallery.
 *
 * Usage: node scripts/build-contractor-gallery.js [--limit N]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHED_PATH = join(ROOT, 'content', 'data', 'enriched.json');
const MANIFEST_PATH = join(ROOT, 'content', 'data', 'contractor-images.json');
const IMAGES_BUCKET = 'contractor-images';
const MAX_GALLERY = 6;
const HERO_MAX_WIDTH = 900;
const GALLERY_MAX_WIDTH = 700;
const JPEG_QUALITY = 72;

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

function heroScore(photo) {
  const w = photo.width || 0;
  const h = photo.height || 0;
  if (!w || !h) return -Infinity;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const ratio = long / short;
  const landscape = w >= h;
  let score = 0;
  score += landscape ? 2 : 0;
  score -= Math.abs(ratio - 1.5); // reward near 3:2/16:9-ish, penalize near-square or extreme panorama
  score += Math.min(short, 2000) / 1000; // mild resolution bonus, capped
  if (short < 400) score -= 3; // likely an icon/logo/avatar crop
  return score;
}

function pickHeroAndGallery(photos) {
  if (!photos?.length) return { hero: null, gallery: [] };
  const ranked = [...photos].sort((a, b) => heroScore(b) - heroScore(a));
  const hero = ranked[0];
  const gallery = photos.filter((p) => p !== hero).slice(0, MAX_GALLERY - 1);
  return { hero, gallery };
}

async function fetchCachedPhotos(placeId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/places_cache?place_id=eq.${placeId}&select=data`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.data?.photos || null;
}

async function uploadPhoto(url, storagePath, maxWidth) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const compressed = await sharp(raw)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${IMAGES_BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: compressed,
  });
  if (!uploadRes.ok) throw new Error(`upload failed ${uploadRes.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGES_BUCKET}/${storagePath}`;
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;

  const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));
  let targets = enriched.filter((c) => c.phones?.length && c.service_areas?.length && c.has_google_reviews && c.place_id);
  if (limit) targets = targets.slice(0, limit);

  console.log(`Building galleries for ${targets.length} contractors...`);
  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
  let ok = 0;
  let failed = 0;
  let heroChanged = 0;

  let skipped = 0;
  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const stateSlug = STATE_ABBR_TO_SLUG[c.state] || c.state.toLowerCase();
    const slug = slugifyName(c.name);
    const key = `${stateSlug}/${slug}`;

    // Resume support: skip anyone already processed by this script (has a
    // `gallery` field) so re-running after a crash/interruption doesn't
    // redo already-uploaded work.
    if (manifest[key]?.gallery) {
      skipped++;
      continue;
    }

    try {
      const photos = await fetchCachedPhotos(c.place_id);
      if (!photos?.length) {
        failed++;
        continue;
      }
      const { hero, gallery } = pickHeroAndGallery(photos);
      const wasFirstPhoto = photos[0] === hero;
      if (!wasFirstPhoto) heroChanged++;

      const heroUrl = await uploadPhoto(hero.media_url, `${key}/hero.jpg`, HERO_MAX_WIDTH);
      const galleryUrls = [];
      for (let g = 0; g < gallery.length; g++) {
        try {
          const url = await uploadPhoto(gallery[g].media_url, `${key}/gallery-${g}.jpg`, GALLERY_MAX_WIDTH);
          galleryUrls.push({ path: url, attributions: gallery[g].attributions });
        } catch {
          /* skip a single failed gallery photo, don't fail the whole contractor */
        }
      }

      manifest[key] = {
        path: heroUrl,
        attributions: hero.attributions,
        gallery: galleryUrls,
      };
      ok++;
      if (i % 100 === 0) console.log(`  [${i + 1}/${targets.length}] ${c.name}: OK (${galleryUrls.length} gallery photos, hero ${wasFirstPhoto ? 'kept' : 'reselected'})`);
    } catch (err) {
      failed++;
      console.log(`  [${i + 1}/${targets.length}] ${c.name}: FAILED ${err.message}`);
    }

    if (i % 200 === 0) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${ok} ok, ${failed} failed, ${skipped} skipped (already done), ${heroChanged} heroes reselected away from Google's photo[0].`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
