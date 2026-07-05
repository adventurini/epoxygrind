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

/**
 * Quality bar for the public directory: a listing with no phone number and
 * no service-area data isn't something a homeowner can actually act on —
 * these are almost always the `no_website`/`unreachable`/`blocked_by_robots`
 * rows where the scraper had nothing to work with. A contractor with zero
 * Google reviews (has_google_reviews, from scripts/batch-fetch-places.js)
 * is excluded too. Filtered here (not deleted from enriched.json) so the
 * raw scrape/API data stays intact — only contractors that were actually
 * run through the Places batch have this field; one that hasn't been
 * batch-fetched yet is NOT excluded on this basis (undefined !== false).
 */
function passesQualityBar(c) {
  return Boolean(c.phones?.length) && Boolean(c.service_areas?.length) && c.has_google_reviews !== false;
}

/** All enriched contractors, each tagged with state_slug + a URL slug unique within its state. */
export const CONTRACTORS = (() => {
  const raw = loadRaw().filter(passesQualityBar);
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

/**
 * Contractors serving a metro's coverage area — its anchor city plus its
 * suburbs — not just an exact city-field match. A contractor's own city
 * (from the discovery search) counts, and so does a metro city/suburb name
 * appearing anywhere in that contractor's scraped service_areas list
 * (free-text "City, ST" strings, so this is a substring match, not exact).
 * @param {{state_slug:string, city:string, suburbs?:string[]}} metro
 */
export function contractorsByMetro(metro) {
  const areaNames = [metro.city, ...(metro.suburbs || [])].map((s) => s.toLowerCase());
  return CONTRACTORS.filter((c) => {
    if (c.state_slug !== metro.state_slug) return false;
    if (c.city && areaNames.includes(c.city.toLowerCase())) return true;
    return (c.service_areas || []).some((area) => {
      const areaLower = area.toLowerCase();
      return areaNames.some((name) => areaLower.includes(name));
    });
  });
}

export function getContractor(stateSlug, slug) {
  return CONTRACTORS.find((c) => c.state_slug === stateSlug && c.slug === slug) || null;
}

export function stateSlugsWithContractors() {
  return [...new Set(CONTRACTORS.map((c) => c.state_slug))].sort();
}
