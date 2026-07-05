import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

function loadManifest(name) {
  const path = join(ROOT, '..', 'content', 'data', name);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

const HERO_MANIFEST = loadManifest('contractor-images.json');
const LOGO_MANIFEST = loadManifest('contractor-logos.json');

/** @returns {{path:string, attributions:Array<{display_name:string,uri:string}>}|null} */
export function getContractorHero(stateSlug, slug) {
  return HERO_MANIFEST[`${stateSlug}/${slug}`] || null;
}

/** @returns {{path:string, source:string}|null} */
export function getContractorLogo(stateSlug, slug) {
  return LOGO_MANIFEST[`${stateSlug}/${slug}`] || null;
}
