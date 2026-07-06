import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(ROOT, '..', 'content', 'data', 'shopping-list-images.json');

const MANIFEST = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};

/** Shopping lists aren't a single product, so there's no merchant photo to
 * fetch — always AI-generated (generated: true). @returns {{path:string, generated:boolean}|null} */
export function getShoppingListImage(slug) {
  return MANIFEST[slug] || null;
}
