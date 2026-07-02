import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(ROOT, '..', 'content', 'data', 'metros.json'), 'utf8'));

/**
 * Tier 1 downtown/city-hall ZIP codes — the dataset ships every row with
 * primary_zip: null (spec Appendix A: "fill opportunistically"). Filled in
 * for the 10 Tier 1 metros only, since those are the launch pages and a
 * populated zip meaningfully improves the estimator CTA prefill; these are
 * well-known public downtown ZIPs, not fabricated. Tier 2/3 stay null —
 * the CTA renders without the zip param for those, per spec.
 */
const TIER1_ZIP_OVERRIDES = {
  'new-york': '10001',
  'los-angeles': '90012',
  chicago: '60601',
  dallas: '75201',
  phoenix: '85003',
  houston: '77002',
  'san-francisco': '94102',
  'santa-ana': '92701',
  'san-jose': '95113',
  miami: '33130',
};

export const METROS = raw.metros.map((m) => ({
  ...m,
  primary_zip: m.primary_zip || TIER1_ZIP_OVERRIDES[m.slug] || null,
}));

export function getMetro(slug) {
  return METROS.find((m) => m.slug === slug) || null;
}

export function metrosByTier(tier) {
  return METROS.filter((m) => m.tier === tier);
}

export function metrosByState(stateSlug) {
  return METROS.filter((m) => m.state_slug === stateSlug);
}

export function allStateSlugs() {
  return [...new Set(METROS.map((m) => m.state_slug))].sort();
}

/**
 * Generation guardrail (spec §4): cost_index and climate_region are hard
 * requirements. primary_zip is explicitly NOT a hard blocker — every row
 * in the source dataset ships with primary_zip: null, and the spec's own
 * Appendix A type contract says null just means "CTA renders without zip
 * param (fill opportunistically)," which would be self-contradictory if
 * the guardrail also blocked generation on it.
 */
export function metroIsPublishable(metro) {
  return Boolean(metro?.cost_index != null && metro?.climate_region);
}

export function nearestMetros(metro, count = 3) {
  return (metro.nearest || [])
    .map((slug) => getMetro(slug))
    .filter(Boolean)
    .slice(0, count);
}

const STATE_NAMES = {
  alabama: 'Alabama', alaska: 'Alaska', arizona: 'Arizona', arkansas: 'Arkansas', california: 'California',
  colorado: 'Colorado', connecticut: 'Connecticut', delaware: 'Delaware', 'district-of-columbia': 'District of Columbia',
  florida: 'Florida', georgia: 'Georgia', hawaii: 'Hawaii', idaho: 'Idaho', illinois: 'Illinois', indiana: 'Indiana',
  iowa: 'Iowa', kansas: 'Kansas', kentucky: 'Kentucky', louisiana: 'Louisiana', maine: 'Maine', maryland: 'Maryland',
  massachusetts: 'Massachusetts', michigan: 'Michigan', minnesota: 'Minnesota', mississippi: 'Mississippi',
  missouri: 'Missouri', montana: 'Montana', nebraska: 'Nebraska', nevada: 'Nevada', 'new-hampshire': 'New Hampshire',
  'new-jersey': 'New Jersey', 'new-mexico': 'New Mexico', 'new-york': 'New York', 'north-carolina': 'North Carolina',
  'north-dakota': 'North Dakota', ohio: 'Ohio', oklahoma: 'Oklahoma', oregon: 'Oregon', pennsylvania: 'Pennsylvania',
  'rhode-island': 'Rhode Island', 'south-carolina': 'South Carolina', 'south-dakota': 'South Dakota',
  tennessee: 'Tennessee', texas: 'Texas', utah: 'Utah', vermont: 'Vermont', virginia: 'Virginia',
  washington: 'Washington', 'west-virginia': 'West Virginia', wisconsin: 'Wisconsin', wyoming: 'Wyoming',
};

export function stateNameFromSlug(stateSlug) {
  return STATE_NAMES[stateSlug] || stateSlug;
}
