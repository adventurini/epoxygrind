import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(ROOT, '..', 'content', 'data', 'city-images.json');

const MANIFEST = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};

/** @returns {{path:string, sourceTitle:string, sourcePageUrl:string}|null} */
export function getCityImage(stateSlug, slug) {
  return MANIFEST[`${stateSlug}/${slug}`] || null;
}
