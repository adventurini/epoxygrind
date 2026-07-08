import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { METROS } from './metros.js';

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

/** True numbers only — catches scrape artifacts like "(818) 000-0000" or
 * "(094) 509-1520" (an invalid area code) that would otherwise render as a
 * dead click-to-call link. */
function isValidPhone(raw) {
  const parsed = parsePhoneNumberFromString(raw, 'US');
  return Boolean(parsed && parsed.isValid());
}

/**
 * Quality bar for the public directory: a listing with no phone number and
 * no service-area data isn't something a homeowner can actually act on —
 * these are almost always the `no_website`/`unreachable`/`blocked_by_robots`
 * rows where the scraper had nothing to work with. A contractor with no
 * verified Google rating is excluded too — this must be a STRICT check
 * (=== true), not just "not explicitly false": a contractor with no
 * place_id (e.g. the original 18 hand-seeded pilot contractors, predating
 * Google Places discovery) never ran through the batch fetch at all, so
 * has_google_reviews is undefined for them — undefined !== false is truthy
 * and would incorrectly let them through with no rating to show.
 */
function passesQualityBar(c) {
  return Boolean(c.phones?.length) && Boolean(c.service_areas?.length) && c.has_google_reviews === true;
}

/**
 * Category filter (directory-fix-instructions.md item 2a) — no `primaryType`
 * data was ever captured by the scrape, so this is name-only. Two tiers:
 *   - SUPPLIER_EXCLUDE: a "Supply/Supplies/Distributor" business is a
 *     product seller, not an installer, even if the product is epoxy —
 *     excluded unconditionally.
 *   - CATEGORY_EXCLUDE: off-category trades (wallpaper, tile, carpet,
 *     hardwood, ready-mix plants, paint stores, big-box chains) — excluded
 *     UNLESS the name also carries a real install/coatings signal, in which
 *     case it's a genuine multi-trade contractor and stays (e.g. "Quality
 *     Coatings & Tile" is plausibly a real epoxy installer that also does
 *     tile — don't guess it away).
 */
const SUPPLIER_EXCLUDE = [/\bsupply\b/i, /\bsupplies\b/i, /distribut/i];
const CATEGORY_EXCLUDE = [
  /wallpaper/i, /\btile\b/i, /\bcarpet\b/i, /hardwood/i, /\bwood floor/i,
  /ready.?mix/i, /\bpaint\b/i, /floor\s*&?\s*decor/i, /\bemser\b/i,
];
const INSTALL_SIGNAL = [
  /epoxy/i, /coating/i, /garage floor/i, /polyaspartic/i, /concrete polish/i,
  /resinous/i, /polyurea/i, /polyurethane/i, /concrete repair/i, /\bflake\b/i, /install/i,
];

function isOffCategory(c) {
  if (SUPPLIER_EXCLUDE.some((re) => re.test(c.name))) return true;
  const isExcludedTrade = CATEGORY_EXCLUDE.some((re) => re.test(c.name));
  const hasInstallSignal = INSTALL_SIGNAL.some((re) => re.test(c.name));
  return isExcludedTrade && !hasInstallSignal;
}

/** All enriched contractors, each tagged with state_slug + a URL slug unique within its state. */
export const CONTRACTORS = (() => {
  const raw = loadRaw()
    .map((c) => ({ ...c, phones: (c.phones || []).filter(isValidPhone) }))
    .filter(passesQualityBar)
    .filter((c) => !isOffCategory(c));
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

const EARTH_RADIUS_MI = 3958.8;

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.asin(Math.sqrt(a));
}

/** metro city was always the search seed for discovery, so every
 * contractor's own `city` field already matches a real metro's `city`
 * exactly (verified: 100% of distinct city/state pairs in CONTRACTORS
 * match a METROS entry) — free real coordinates, no geocoding needed. */
const METRO_BY_CITY_STATE = new Map(METROS.map((m) => [`${m.city.toLowerCase()}, ${m.state}`, m]));

function homeMetroOf(c) {
  if (!c.city || !c.state) return null;
  return METRO_BY_CITY_STATE.get(`${c.city.toLowerCase()}, ${c.state}`) || null;
}

// directory-fix-instructions.md item 2b: "define per-metro radii; LA !=
// Bakersfield" (101mi apart — comfortably excluded at any of these).
// Bigger tier-1 metros (NYC, LA, ...) genuinely sprawl further than a
// tier-3 small town, so the radius scales with tier rather than being flat.
const RADIUS_MI_BY_TIER = { 1: 40, 2: 30, 3: 20 };
const DEFAULT_RADIUS_MI = 20;

/**
 * Contractors serving a metro's real-world coverage area — computed from
 * actual distance between the contractor's home metro (their own `city`,
 * matched to a METROS entry) and the target metro, not text matching
 * against free-form service_areas strings (the previous approach, which
 * could pad a page with contractors from an unrelated, distant metro if
 * their scraped service-area text happened to share a word).
 * @param {{state_slug:string, city:string, lat:number, lon:number, tier?:number}} metro
 */
export function contractorsByMetro(metro) {
  const radius = RADIUS_MI_BY_TIER[metro.tier] ?? DEFAULT_RADIUS_MI;
  return CONTRACTORS.filter((c) => {
    if (c.state_slug !== metro.state_slug) return false;
    const home = homeMetroOf(c);
    // No home metro match (shouldn't happen — 100% coverage confirmed —
    // but defensive rather than silently dropping a real listing) falls
    // back to an exact city-name match against the metro itself.
    if (!home) return c.city && c.city.toLowerCase() === metro.city.toLowerCase();
    if (home.slug === metro.slug) return true;
    return haversineMiles(home.lat, home.lon, metro.lat, metro.lon) <= radius;
  });
}

export function getContractor(stateSlug, slug) {
  return CONTRACTORS.find((c) => c.state_slug === stateSlug && c.slug === slug) || null;
}

export function stateSlugsWithContractors() {
  return [...new Set(CONTRACTORS.map((c) => c.state_slug))].sort();
}
