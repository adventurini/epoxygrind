import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(ROOT, '..', 'content', 'data', 'enriched.json');

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
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadRaw() {
  if (!existsSync(DATA_PATH)) return [];
  return JSON.parse(readFileSync(DATA_PATH, 'utf8'));
}

/** All enriched contractors, each tagged with state_slug + a URL slug unique within its state. */
export const CONTRACTORS = (() => {
  const raw = loadRaw();
  const seenPerState = new Map();
  return raw.map((c) => {
    const state_slug = STATE_ABBR_TO_SLUG[c.state] || c.state.toLowerCase();
    let slug = slugifyName(c.name);
    const key = `${state_slug}/${slug}`;
    const seen = seenPerState.get(state_slug) || new Set();
    if (seen.has(slug)) slug = `${slug}-${slugifyName(c.city)}`;
    seen.add(slug);
    seenPerState.set(state_slug, seen);
    return { ...c, state_slug, slug };
  });
})();

export function contractorsByState(stateSlug) {
  return CONTRACTORS.filter((c) => c.state_slug === stateSlug);
}

export function contractorsByCity(stateSlug, cityName) {
  const city = cityName.toLowerCase();
  return CONTRACTORS.filter((c) => c.state_slug === stateSlug && c.city.toLowerCase() === city);
}

export function getContractor(stateSlug, slug) {
  return CONTRACTORS.find((c) => c.state_slug === stateSlug && c.slug === slug) || null;
}

export function stateSlugsWithContractors() {
  return [...new Set(CONTRACTORS.map((c) => c.state_slug))].sort();
}
