#!/usr/bin/env node
/**
 * Adds real gallery representation for the 4 finish types described in the
 * "Every system, explained" section that had no matching gallery filter
 * (Overlays & Micro-Cement, Stains & Dyes, Quartz Broadcast, Custom Colors &
 * Logo Inlays) — confirmed via user feedback that routing them to a generic
 * "See the full gallery" link wasn't good enough when the copy claims to
 * explain each one specifically. Also regenerates the "Decorative Concrete"
 * service-card image via editImagesWithFal against a REAL bare-concrete
 * photo instead of pure text-to-image (which produced unrealistic/warped
 * results 3 times in a row — the same edit-based approach that already
 * works well for the main gallery).
 *
 * Usage: node scripts/add-demo-finish-types.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GALLERY_PATH = join(ROOT, 'demo', 'gallery.json');
const BUCKET = 'contractor-images';
const GALLERY_PREFIX = 'demo-gallery';
const SERVICES_PREFIX = 'demo-services';

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const { editImagesWithFal } = await import(join(ROOT, 'lib', 'fal.js'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');

async function uploadDataUrl(prefix, path, dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${prefix}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload failed for ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${prefix}/${path}`;
}

const BASE = {
  coveredPatio: 'https://aiaaevgrewudgcazphpy.supabase.co/storage/v1/object/public/contractor-images/demo-gallery/covered-patio-before.jpg',
  commercialBay: 'https://aiaaevgrewudgcazphpy.supabase.co/storage/v1/object/public/contractor-images/demo-gallery/commercial-bay-before.jpg',
  threeCarGarage: 'https://aiaaevgrewudgcazphpy.supabase.co/storage/v1/object/public/contractor-images/demo-gallery/3-car-garage-before.jpg',
  oneCarGarage: 'https://aiaaevgrewudgcazphpy.supabase.co/storage/v1/object/public/contractor-images/demo-gallery/1-car-garage-before.jpg',
};

const GALLERY_TARGETS = [
  {
    space: 'covered-patio', spaceLabel: 'Covered Patio',
    finish: 'overlay-micro-cement', finishLabel: 'Overlay / Micro-Cement', finishType: 'overlay',
    before: BASE.coveredPatio,
    prompt: 'Transform this bare concrete patio slab into a finished thin micro-cement overlay in a smooth warm gray, matte trowel-finished texture with subtle hand-applied variation, photorealistic, same camera angle and room, no people, no text.',
  },
  {
    space: 'commercial-bay', spaceLabel: 'Commercial Bay',
    finish: 'stains-earthtone', finishLabel: 'Acid Stain (Earth Tone)', finishType: 'stains',
    before: BASE.commercialBay,
    prompt: 'Transform this bare concrete floor into a finished acid-stained concrete floor in mottled warm amber and brown variegated tones that look like natural stone veining, translucent stain penetrating the slab (not a solid opaque coating), satin sealer sheen, photorealistic, same camera angle and room, no people, no text.',
  },
  {
    space: '3-car-garage', spaceLabel: '3-Car Garage',
    finish: 'quartz-broadcast', finishLabel: 'Quartz Broadcast', finishType: 'quartz',
    before: BASE.threeCarGarage,
    prompt: 'Transform this bare concrete floor into a finished quartz-broadcast epoxy floor, colored quartz sand fully broadcast into the base coat in a tan and gray blend, slightly textured slip-resistant surface, satin sheen, photorealistic, same camera angle and room, no people, no text.',
  },
  {
    space: '1-car-garage', spaceLabel: '1-Car Garage',
    finish: 'custom-colors-blue', finishLabel: 'Custom Colors (Team Blue)', finishType: 'custom',
    before: BASE.oneCarGarage,
    prompt: 'Transform this bare concrete floor into a finished solid-color epoxy floor in a bold custom royal blue with a single crisp white accent stripe along one edge, glossy finish, photorealistic, same camera angle and room, no people, no text.',
  },
];

const SERVICE_CARD_TARGET = {
  id: 'decorative-concrete',
  before: BASE.coveredPatio,
  prompt: 'Transform this bare concrete patio slab into a finished decorative stamped concrete floor with a clearly visible ashlar-slate stamped pattern, warm brown/tan color with a subtle darker accent stain worked into the tooled pattern lines, single continuous poured concrete slab (not individual stone pavers), photorealistic, same camera angle and room, no people, no text.',
};

async function main() {
  const gallery = JSON.parse(readFileSync(GALLERY_PATH, 'utf8'));

  console.log('Regenerating decorative-concrete service card via edit...');
  const serviceDataUrl = await editImagesWithFal([SERVICE_CARD_TARGET.before], SERVICE_CARD_TARGET.prompt, { image_size: { width: 1280, height: 800 } });
  const serviceUrl = await uploadDataUrl(SERVICES_PREFIX, `${SERVICE_CARD_TARGET.id}.jpg`, serviceDataUrl);
  console.log('  OK:', serviceUrl);

  const servicesManifestPath = join(ROOT, 'demo', 'services-images.json');
  const servicesManifest = JSON.parse(readFileSync(servicesManifestPath, 'utf8'));
  servicesManifest[SERVICE_CARD_TARGET.id] = serviceUrl;
  writeFileSync(servicesManifestPath, JSON.stringify(servicesManifest, null, 2));

  for (const t of GALLERY_TARGETS) {
    console.log(`[${t.finish}] generating...`);
    const dataUrl = await editImagesWithFal([t.before], t.prompt, { image_size: { width: 1280, height: 800 } });
    const path = `${t.space}-${t.finish}-after.jpg`;
    const url = await uploadDataUrl(GALLERY_PREFIX, path, dataUrl);
    gallery.pairs.push({
      space: t.space,
      spaceLabel: t.spaceLabel,
      finish: t.finish,
      finishLabel: t.finishLabel,
      finishType: t.finishType,
      before: t.before,
      after: url,
    });
    console.log('  OK:', url);
  }

  writeFileSync(GALLERY_PATH, JSON.stringify(gallery, null, 2));
  console.log('\nDone. Updated demo/gallery.json and demo/services-images.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
