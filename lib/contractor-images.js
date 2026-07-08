import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

function loadManifest(name) {
  const path = join(ROOT, '..', 'content', 'data', name);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

// Hero/gallery photos are NOT stored — Google's Places API terms forbid
// caching Place content beyond place_id and lat/lng. Those are served live
// by api/places-photo.js instead. Logos are scraped from contractors' own
// websites (not Google), a separate provenance, so they're still fine to
// keep here.
const LOGO_MANIFEST = loadManifest('contractor-logos.json');

/** @returns {{path:string, source:string}|null} */
export function getContractorLogo(stateSlug, slug) {
  return LOGO_MANIFEST[`${stateSlug}/${slug}`] || null;
}
