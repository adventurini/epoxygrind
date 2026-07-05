#!/usr/bin/env node
/**
 * One-time (approved) batch fetch of Google Places data — rating, review
 * count, reviews, and a hero photo — for every contractor that already
 * passes the phone+service-area quality bar (lib/contractors.js). Unlike
 * the live place-reviews Edge Function (which fetches lazily per profile
 * visit and only caches text), this:
 *   1. Writes the same normalized shape into Supabase places_cache, so a
 *      profile page's first real visit is already a cache hit.
 *   2. Downloads and self-hosts one photo per contractor under
 *      images/contractors/{state_slug}/{slug}/hero.jpg — NOT hotlinked,
 *      so displaying it costs nothing per page view (matches the city
 *      hero photo pattern in scripts/fetch-city-images.py).
 *   3. Merges google_rating/google_review_count back into enriched.json
 *      so build-time pages (listing cards, the "no reviews" filter) have
 *      the data without a live fetch.
 *
 * Real Google API cost — Enterprise+Atmosphere tier (rating+reviews+
 * photos together, ~$0.02-0.025/call as of this writing). Confirm actual
 * spend in Google Cloud Console; this script's own estimate is a ballpark.
 *
 * Usage: node scripts/batch-fetch-places.js [--limit N]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENRICHED_PATH = join(ROOT, 'content', 'data', 'enriched.json');
const IMAGES_DIR = join(ROOT, 'images', 'contractors');
const MANIFEST_PATH = join(ROOT, 'content', 'data', 'contractor-images.json');

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
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !GOOGLE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY / GOOGLE_MAPS_API_KEY not set (check .env.local)');
}

const FIELD_MASK = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews,photos';
const PLACES_API = 'https://places.googleapis.com/v1/places';
const EST_COST_PER_CALL = 0.023;

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

async function fetchWithRetry(url, headers, maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const backoff = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt + Math.random() * 250;
      if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    return res; // fail fast on other 4xx
  }
  return fetch(url, { headers });
}

function normalize(raw) {
  const reviews = (raw.reviews || []).map((r) => ({
    rating: r.rating ?? null,
    text: r.text?.text || '',
    relative_time: r.relativePublishTimeDescription || '',
    publish_time: r.publishTime || null,
    author_name: r.authorAttribution?.displayName || 'Google user',
    author_uri: r.authorAttribution?.uri || null,
    author_photo_uri: r.authorAttribution?.photoUri || null,
    google_maps_uri: raw.googleMapsUri || null,
  }));

  const photos = (raw.photos || []).slice(0, 8).map((p) => ({
    name: p.name,
    media_url: `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&key=${GOOGLE_KEY}`,
    width: p.widthPx || null,
    height: p.heightPx || null,
    attributions: (p.authorAttributions || []).map((a) => ({ display_name: a.displayName, uri: a.uri })),
  }));

  return {
    place_id: raw.id,
    display_name: raw.displayName?.text || '',
    rating: raw.rating ?? null,
    review_count: raw.userRatingCount ?? 0,
    google_maps_uri: raw.googleMapsUri || null,
    reviews,
    photos,
    fetched_at: new Date().toISOString(),
  };
}

async function upsertPlacesCache(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/places_cache?on_conflict=place_id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{
      place_id: data.place_id,
      data,
      status: 'ok',
      error: null,
      fetched_at: data.fetched_at,
      updated_at: new Date().toISOString(),
    }]),
  });
}

async function downloadHeroPhoto(contractor, photo) {
  if (!photo) return null;
  const stateSlug = STATE_ABBR_TO_SLUG[contractor.state] || contractor.state.toLowerCase();
  const slug = slugifyName(contractor.name);
  const dir = join(IMAGES_DIR, stateSlug, slug);
  mkdirSync(dir, { recursive: true });
  const destPath = join(dir, 'hero.jpg');
  const webPath = `/images/contractors/${stateSlug}/${slug}/hero.jpg`;

  const res = await fetch(photo.media_url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  return {
    path: webPath,
    width: photo.width,
    height: photo.height,
    attributions: photo.attributions,
  };
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;

  const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));
  let targets = enriched.filter((c) => c.phones?.length && c.service_areas?.length && c.place_id);
  if (limit) targets = targets.slice(0, limit);

  console.log(`Fetching Places data for ${targets.length} contractors...`);

  const imageManifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
  const byPlaceId = new Map(enriched.map((c) => [c.place_id, c]));
  let calls = 0;
  let zeroReviews = 0;
  let withPhoto = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    try {
      const res = await fetchWithRetry(`${PLACES_API}/${c.place_id}`, {
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      });
      calls++;
      if (!res.ok) {
        errors++;
        console.log(`  [${i + 1}/${targets.length}] ${c.name}: HTTP ${res.status}`);
        continue;
      }
      const raw = await res.json();
      const data = normalize(raw);
      await upsertPlacesCache(data);

      const target = byPlaceId.get(c.place_id);
      if (target) {
        target.google_rating = data.rating;
        target.google_review_count = data.review_count;
        target.has_google_reviews = (data.reviews?.length || 0) > 0;
      }
      if (!data.reviews?.length) zeroReviews++;

      const stateSlug = STATE_ABBR_TO_SLUG[c.state] || c.state.toLowerCase();
      const slug = slugifyName(c.name);
      const key = `${stateSlug}/${slug}`;
      if (data.photos?.[0]) {
        const photo = await downloadHeroPhoto(c, data.photos[0]);
        if (photo) {
          imageManifest[key] = photo;
          withPhoto++;
        }
      }

      console.log(`  [${i + 1}/${targets.length}] ${c.name}: rating=${data.rating ?? '—'} reviews=${data.review_count} photo=${imageManifest[key] ? 'yes' : 'no'}`);
    } catch (err) {
      errors++;
      console.log(`  [${i + 1}/${targets.length}] ${c.name}: ERROR ${err.message}`);
    }

    // Checkpoint every 100 so a crash mid-run doesn't lose everything.
    if (i % 100 === 0) {
      writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));
      writeFileSync(MANIFEST_PATH, JSON.stringify(imageManifest, null, 2));
    }
  }

  writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));
  writeFileSync(MANIFEST_PATH, JSON.stringify(imageManifest, null, 2));

  console.log(`\nDone. ${calls} API calls, ${errors} errors.`);
  console.log(`Estimated cost: ~$${(calls * EST_COST_PER_CALL).toFixed(2)} (ballpark — confirm actual spend in Google Cloud Console)`);
  console.log(`Zero-review contractors: ${zeroReviews}/${targets.length}`);
  console.log(`Photos downloaded: ${withPhoto}/${targets.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
