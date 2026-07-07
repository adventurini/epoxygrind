import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(ROOT, '..', 'content', 'data', 'learn-images.json');

const MANIFEST = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};

/** Contractor learning-center hero images — always AI-generated (abstract
 * concept illustrations, not real photos of anything). @returns {{path:string, generated:boolean}|null} */
export function getLearnImage(slug) {
  return MANIFEST[slug] || null;
}
