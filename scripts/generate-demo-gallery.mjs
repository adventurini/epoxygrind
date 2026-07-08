#!/usr/bin/env node
/**
 * Generates the /demo/ before/after gallery (epoxygrind-demo-site-instructions-v2.md
 * §7) via the same fal.ai pipeline as the real estimator/carousel —
 * generateImageWithFal() for bare-concrete "before" bases, editImagesWithFal()
 * for "after" finish variants applied to each base. Uploads to the existing
 * public `contractor-images` Supabase Storage bucket under a `demo-gallery/`
 * prefix (no new bucket needed) and writes demo/gallery.json (served as a
 * plain static file alongside the page), which demo/demo.js fetches to
 * render the slider heroes + filterable grid.
 *
 * Scope note: the source doc's full matrix (7 base spaces x up to 7 finish
 * variants each, 40-60 curated pairs) would mean 40+ edit calls at real
 * cost/time. This generates 6 base spaces x 4 finish variants = 24 pairs —
 * every finish type still shows multiple floors (the actual definition-of-
 * done requirement), just a smaller, defensible matrix than the doc's upper
 * bound.
 *
 * Usage: node scripts/generate-demo-gallery.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'demo', 'gallery.json');
const BUCKET = 'contractor-images';
const PREFIX = 'demo-gallery';

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const { generateImageWithFal, editImagesWithFal } = await import(join(ROOT, 'lib', 'fal.js'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set (check .env.local)');

const BASES = [
  {
    id: '1-car-garage',
    label: '1-Car Garage',
    prompt: 'Photo of a worn, bare one-car residential garage floor, plain gray concrete with visible hairline cracks and an old oil stain, garage door open to daylight, wide angle, realistic, no people, no text.',
  },
  {
    id: '2-car-garage',
    label: '2-Car Garage',
    prompt: 'Photo of a worn, bare two-car residential garage floor, plain gray concrete with a few small cracks and light staining, two-car garage door open to daylight, wide angle, realistic, no people, no text.',
  },
  {
    id: '3-car-garage',
    label: '3-Car Garage',
    prompt: 'Photo of a worn, bare three-car residential garage floor, plain gray concrete, wide angle showing full depth of a large garage, some surface pitting, natural light from open doors, realistic, no people, no text.',
  },
  {
    id: 'basement',
    label: 'Basement',
    prompt: 'Photo of a bare, unfinished residential basement concrete floor, plain gray concrete, foundation walls visible at the edges, single overhead bulb lighting, realistic, no people, no text.',
  },
  {
    id: 'commercial-bay',
    label: 'Commercial Bay',
    prompt: 'Photo of a bare concrete floor in a commercial warehouse bay, wide open industrial space, bare gray concrete with some staining, tall ceiling and roll-up doors visible, realistic, no people, no text.',
  },
  {
    id: 'covered-patio',
    label: 'Covered Patio',
    prompt: 'Photo of a bare, worn concrete patio slab under a covered outdoor porch roof, plain gray concrete with weathering, residential backyard visible at the edges, daylight, realistic, no people, no text.',
  },
];

const FINISHES = [
  {
    id: 'full-flake-charcoal',
    label: 'Full-Flake Epoxy (Charcoal Blend)',
    finishType: 'full-flake',
    prompt: 'Transform this bare concrete floor into a finished full-flake epoxy coating in a charcoal and gray multi-color flake blend, glossy sealed finish, photorealistic, same camera angle and room, no people, no text.',
  },
  {
    id: 'metallic-silver',
    label: 'Metallic Epoxy (Silver Swirl)',
    finishType: 'metallic',
    prompt: 'Transform this bare concrete floor into a finished metallic epoxy coating with a silver and pearl swirling marbled pattern, high-gloss 3D depth effect, photorealistic, same camera angle and room, no people, no text.',
  },
  {
    id: 'solid-slate-gray',
    label: 'Solid Epoxy (Slate Gray)',
    finishType: 'solid',
    prompt: 'Transform this bare concrete floor into a finished solid-color epoxy coating in a clean slate gray, satin sheen, photorealistic, same camera angle and room, no people, no text.',
  },
  {
    id: 'polyaspartic-flake',
    label: 'Polyaspartic Flake',
    finishType: 'polyaspartic',
    prompt: 'Transform this bare concrete floor into a finished polyaspartic flake coating in a light gray and white flake blend, satin low-sheen finish, photorealistic, same camera angle and room, no people, no text.',
  },
];

async function uploadDataUrl(path, dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const pairs = [];
  let calls = 0;

  for (const base of BASES) {
    console.log(`\n[${base.id}] generating before...`);
    let beforeUrl;
    try {
      const dataUrl = await generateImageWithFal(base.prompt);
      calls++;
      beforeUrl = await uploadDataUrl(`${PREFIX}/${base.id}-before.jpg`, dataUrl);
      console.log(`  OK: ${beforeUrl}`);
    } catch (err) {
      console.log(`  FAILED (before): ${err.message}`);
      continue;
    }

    for (const finish of FINISHES) {
      console.log(`  [${base.id} / ${finish.id}] generating after...`);
      try {
        const editedDataUrl = await editImagesWithFal([beforeUrl], finish.prompt, { image_size: { width: 1200, height: 750 } });
        calls++;
        const afterUrl = await uploadDataUrl(`${PREFIX}/${base.id}-${finish.id}-after.jpg`, editedDataUrl);
        pairs.push({
          space: base.id,
          spaceLabel: base.label,
          finish: finish.id,
          finishLabel: finish.label,
          finishType: finish.finishType,
          before: beforeUrl,
          after: afterUrl,
        });
        console.log(`    OK: ${afterUrl}`);
      } catch (err) {
        console.log(`    FAILED: ${err.message}`);
      }
    }

    // Checkpoint after every base in case of a mid-run crash.
    writeFileSync(MANIFEST_PATH, JSON.stringify({ pairs, generatedAt: new Date().toISOString() }, null, 2));
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify({ pairs, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`\nDone. ${pairs.length} pairs generated, ${calls} fal.ai calls total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
