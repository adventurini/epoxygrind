#!/usr/bin/env node
/**
 * Regenerates just the 3-car-garage and basement base images (+ their 4
 * finish variants each) for /demo/'s gallery — the originals didn't read
 * as their labeled space at all (3-car showed no garage door whatsoever;
 * basement had no below-grade cues, just a dim generic room). Confirmed
 * via direct visual inspection before regenerating. Prompts here are
 * explicit about the exact visual cues that were missing.
 *
 * Usage: node scripts/regenerate-demo-gallery-spaces.mjs
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
    id: '3-car-garage',
    label: '3-Car Garage',
    prompt: 'Photo taken from inside a very wide three-car residential garage, showing THREE separate garage door bays clearly visible side by side across the full width of the frame (or one continuous triple-wide garage door with three distinct panel sections), bare worn gray concrete floor with a few small cracks, garage doors open to daylight, ultra-wide angle to convey the large width of the space, realistic, no people, no text.',
  },
  {
    id: 'basement',
    label: 'Basement',
    prompt: 'Photo of an unfinished residential basement, below-grade specific cues clearly visible: gray poured-concrete foundation walls (unpainted, visible form-tie marks), exposed ceiling floor joists and ductwork overhead, one visible support column/lally column in the middle distance, a small high egress window near the ceiling letting in a little daylight, a partial view of basement stairs with a handrail in the background, bare concrete floor, single hanging bulb light, realistic, no people, no text.',
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
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err) {
      if (i === attempts - 1) throw err;
      console.log(`    retrying after error: ${err.message}`);
    }
  }
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  // Drop old entries for the two spaces being regenerated.
  manifest.pairs = manifest.pairs.filter((p) => p.space !== '3-car-garage' && p.space !== 'basement');

  for (const base of BASES) {
    console.log(`\n[${base.id}] generating before...`);
    const dataUrl = await withRetry(() => generateImageWithFal(base.prompt));
    const beforeUrl = await uploadDataUrl(`${PREFIX}/${base.id}-before.jpg`, dataUrl);
    console.log(`  OK: ${beforeUrl}`);

    for (const finish of FINISHES) {
      console.log(`  [${base.id} / ${finish.id}] generating after...`);
      const editedDataUrl = await withRetry(() => editImagesWithFal([beforeUrl], finish.prompt, { image_size: { width: 1200, height: 750 } }));
      const afterUrl = await uploadDataUrl(`${PREFIX}/${base.id}-${finish.id}-after.jpg`, editedDataUrl);
      manifest.pairs.push({
        space: base.id,
        spaceLabel: base.label,
        finish: finish.id,
        finishLabel: finish.label,
        finishType: finish.finishType,
        before: beforeUrl,
        after: afterUrl,
      });
      console.log(`    OK: ${afterUrl}`);
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.pairs.length} total pairs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
