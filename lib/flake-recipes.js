/**
 * Real weighted flake-blend recipes, extending lib/finish-design.js's
 * FLAKE_COLORS (which only carries one averaged hex per blend — not enough
 * to procedurally render individual chips). Additive: does not change
 * finish-design.js's existing exports or resolveDesign()'s return shape.
 *
 * Percentages are published Torginol recipes. The first 13 blends (domino
 * through galaxy) are epoxygrind-visualizer-build-spec.md Part 1.2's own
 * seed data, copied verbatim. The next 7 (feather-gray through
 * weathered-gray) are Part 1.3's "complete the catalog" scrape task —
 * each verified live against a torginol.com product page's "Made Up Of"
 * percentage breakdown (quoted per-blend below); the other 16 blend names
 * the spec listed for 1.3 either had no published percentages or turned
 * out to be solid colors, not blends, and were left out rather than guessed.
 *
 * @typedef {{ code: string, name: string, hex: string, hexVerified: boolean }} FlakeSolidColor
 * @typedef {{ colorCode: string, pct: number }} FlakeComponent
 * @typedef {{ brand: string, alias: string }} FlakeBrandAlias
 * @typedef {{ id: string, code: string, name: string, series: string, components: FlakeComponent[], brandAliases?: FlakeBrandAlias[] }} FlakeBlendRecipe
 */

/** Torginol solid-color catalog. The original 37 (F1000-F9987) are the
 * spec's own seed data — hexes are estimates pending real swatch-photo
 * sampling (hexVerified: false). The 11 added after F9987 were needed as
 * component colors for the Part 1.3 scrape's new blends and weren't in
 * that seed list — these have real hexes sampled from each color's actual
 * torginol.com product photo (median pixel of the center region), so
 * hexVerified: true. Not all 50 back a blend recipe below; the extras
 * exist so the custom blend builder has a real, useful palette. */
export const FLAKE_SOLID_COLORS = [
  { code: 'F1000', name: 'Adobe Beige', hex: '#d6c3a5', hexVerified: false },
  { code: 'F1020', name: 'Amethyst', hex: '#6a4a8c', hexVerified: false },
  { code: 'F1040', name: 'Autumn Brown', hex: '#7a5230', hexVerified: false },
  { code: 'F1050', name: 'Black', hex: '#1a1a1a', hexVerified: false },
  { code: 'F1060', name: 'Brown', hex: '#6b4a2f', hexVerified: false },
  { code: 'F1090', name: 'Charcoal', hex: '#3c3c3a', hexVerified: false },
  { code: 'F1100', name: 'Cocoa Brown', hex: '#5d4632', hexVerified: false },
  { code: 'F1410', name: 'Granite', hex: '#9a9a96', hexVerified: false },
  { code: 'F1415', name: 'Graphite', hex: '#4f4f4d', hexVerified: false },
  { code: 'F1425', name: 'Ivory', hex: '#efe9d8', hexVerified: false },
  { code: 'F1480', name: 'Medium Gray', hex: '#8a8a88', hexVerified: false },
  { code: 'F1770', name: 'Salmon', hex: '#e08a5f', hexVerified: false },
  { code: 'F1780', name: 'Scone', hex: '#d8c9a8', hexVerified: false },
  { code: 'F1785', name: 'Tan', hex: '#cbb68e', hexVerified: false },
  { code: 'F1790', name: 'True Blue', hex: '#2b4d9e', hexVerified: false },
  { code: 'F1800', name: 'Whisper Gray', hex: '#c8c8c4', hexVerified: false },
  { code: 'F1820', name: 'White', hex: '#f2f2f0', hexVerified: false },
  { code: 'F2160', name: 'Orange', hex: '#e87722', hexVerified: false },
  { code: 'F2200', name: 'Primary Yellow', hex: '#f2c400', hexVerified: false },
  { code: 'F5052', name: 'Chocolate', hex: '#4e3524', hexVerified: false },
  { code: 'F5102', name: 'Lime Green', hex: '#8bc540', hexVerified: false },
  { code: 'F5115', name: 'Putty', hex: '#c4bba9', hexVerified: false },
  { code: 'F5116', name: 'Wigwam', hex: '#c2ad8f', hexVerified: false },
  { code: 'F5305', name: 'Tabu', hex: '#a89684', hexVerified: false },
  { code: 'F5306', name: 'Porpoise', hex: '#b9b9b5', hexVerified: false },
  { code: 'F5920', name: 'Cyberspace', hex: '#3a4148', hexVerified: false },
  { code: 'F6606', name: 'Neutral Gray', hex: '#8f8f8c', hexVerified: false },
  { code: 'F6621', name: 'Stormy Blue', hex: '#2e3f5c', hexVerified: false },
  { code: 'F9903', name: 'Online', hex: '#a7a7a3', hexVerified: false },
  { code: 'F9904', name: 'Dark Grey', hex: '#5a5a57', hexVerified: false },
  { code: 'F9920', name: 'Cherry Bomb', hex: '#b52025', hexVerified: false },
  { code: 'F9955', name: 'Battleship Gray', hex: '#a9a49c', hexVerified: false },
  { code: 'F9957', name: 'Light Tan', hex: '#d9cdb4', hexVerified: false },
  { code: 'F9958', name: 'Alpaca White', hex: '#e8e4da', hexVerified: false },
  { code: 'F9959', name: 'Antique White', hex: '#e6ddc9', hexVerified: false },
  { code: 'F9961', name: 'Functional Gray', hex: '#b0aca3', hexVerified: false },
  { code: 'F9972', name: 'Moody Blue', hex: '#6b7a8f', hexVerified: false },
  { code: 'F9982', name: 'Gravy', hex: '#ded3bd', hexVerified: false },
  { code: 'F9987', name: 'Stone', hex: '#b3ab9c', hexVerified: false },
  // Catalog-completion pass (spec Part 1.3): these 11 were needed as
  // component colors for newly-verified blends below (Blizzard, Water
  // Lily, Rapids, Rebel, Weathered Gray) that aren't in the spec's own
  // seed list. Real hexes this time, not estimates — downloaded each
  // color's actual torginol.com product swatch photo and took the median
  // pixel of the center 60% region (spec Part 1.3 method 3 / Part 1.2's
  // own hex-verification method), so hexVerified: true.
  { code: 'F1130', name: 'Dark Blue', hex: '#364467', hexVerified: true },
  { code: 'F1570', name: 'Mustard', hex: '#bb9b67', hexVerified: true },
  { code: 'F3080', name: 'Lanai Gray', hex: '#858080', hexVerified: true },
  { code: 'F3100', name: 'Maui Blue', hex: '#97acbf', hexVerified: true },
  { code: 'F6613', name: 'Sage', hex: '#859182', hexVerified: true },
  { code: 'F9307', name: 'Schist', hex: '#c5c2c7', hexVerified: true },
  { code: 'F9309', name: 'Basalt', hex: '#787883', hexVerified: true },
  { code: 'F9964', name: 'Sky Blue', hex: '#9fb0c0', hexVerified: true },
  { code: 'F9966', name: 'Morning Fog', hex: '#9aa1af', hexVerified: true },
  { code: 'F9969', name: 'Navy', hex: '#2d334a', hexVerified: true },
  { code: 'F9978', name: 'Tomato', hex: '#942c30', hexVerified: true },
];

/**
 * Keyed by the SAME ids finish-design.js's FLAKE_COLORS already uses, so
 * both modules describe the same blends without a second ID scheme.
 *
 * domino through galaxy (13 entries) are the spec's own Part 1.2 seed data
 * (published Torginol recipes extracted from One Stop Epoxy). feather-gray
 * through weathered-gray (7 entries) are the spec's separate Part 1.3
 * "complete the catalog" scrape task — each verified live against a
 * torginol.com product page's exact "Made Up Of" percentage list (quoted
 * per-blend below). Of the 23 names spec Part 1.3 asked for, these 7 were
 * the ones with a published percentage breakdown; the rest were either
 * descriptive-copy-only (no percentages published) or turned out to be
 * solid colors, not blends (see the commit introducing this comment for
 * the full per-name research results) — left out per the instruction not
 * to fabricate a recipe when one isn't published.
 *
 * Part 1.4 brand aliasing: verified Floorguard Products (floorguardproducts.com)
 * literally titles its custom-flake product pages "... Ships From Torginol"
 * — direct drop-ship confirmed, not blend-specific. Xtreme Polishing
 * Systems sells an entire "Torginol Flakes Systems" collection under
 * Torginol's own name — a reseller, not a rebrand, so there's no alias to
 * map. Penntek's own color list (penntekcoatings.com/colors) includes
 * colors named exactly "Domino" and "Tidal Wave" — see those two entries'
 * brandAliases below (name-match only, medium confidence — Penntek's page
 * itself never mentions Torginol). Resinwerks' and Fortress Floors' own
 * sites showed no color names and no Torginol mention at all — no alias
 * claimed for either, per the instruction to leave it out rather than
 * infer sourcing the spec merely asserted.
 */
export const FLAKE_BLEND_RECIPES = {
  domino: {
    id: 'domino', code: 'FB-411', name: 'Domino', series: 'varicolored',
    components: [{ colorCode: 'F1050', pct: 33 }, { colorCode: 'F1410', pct: 33 }, { colorCode: 'F1820', pct: 34 }],
    // Spec Part 1.4 brand-aliasing task: Penntek's own "Evolution" chip
    // color list (penntekcoatings.com/colors) includes a color named
    // exactly "Domino" — no explicit Torginol mention on Penntek's site,
    // so this is a name match, not confirmed sourcing; medium confidence
    // only (an identical, distinctive name for the same product category
    // is unlikely to be coincidental, but isn't proof).
    brandAliases: [{ brand: 'Penntek', alias: 'Domino' }],
  },
  gravel: {
    id: 'gravel', code: 'FB-414', name: 'Gravel', series: 'varicolored',
    components: [{ colorCode: 'F1410', pct: 25 }, { colorCode: 'F1415', pct: 25 }, { colorCode: 'F1800', pct: 25 }, { colorCode: 'F1820', pct: 25 }],
  },
  'tidal-wave': {
    id: 'tidal-wave', code: 'FB-807', name: 'Tidal Wave', series: 'varicolored',
    components: [{ colorCode: 'F1820', pct: 20 }, { colorCode: 'F6621', pct: 10 }, { colorCode: 'F9903', pct: 20 }, { colorCode: 'F9958', pct: 20 }, { colorCode: 'F9959', pct: 20 }, { colorCode: 'F9972', pct: 10 }],
    // Same name-match basis as domino's brandAliases above — Penntek's
    // color list also includes a "Tidal Wave".
    brandAliases: [{ brand: 'Penntek', alias: 'Tidal Wave' }],
  },
  'cabin-fever': {
    id: 'cabin-fever', code: 'FB-127', name: 'Cabin Fever', series: 'varicolored',
    components: [{ colorCode: 'F1410', pct: 30 }, { colorCode: 'F1780', pct: 30 }, { colorCode: 'F1820', pct: 30 }, { colorCode: 'F1050', pct: 10 }],
  },
  wombat: {
    id: 'wombat', code: 'FB-616', name: 'Wombat', series: 'varicolored',
    components: [{ colorCode: 'F1090', pct: 55 }, { colorCode: 'F1050', pct: 15 }, { colorCode: 'F1800', pct: 15 }, { colorCode: 'F1820', pct: 15 }],
  },
  coyote: {
    id: 'coyote', code: 'FB-514', name: 'Coyote', series: 'varicolored',
    components: [{ colorCode: 'F1050', pct: 5 }, { colorCode: 'F1820', pct: 20 }, { colorCode: 'F5052', pct: 5 }, { colorCode: 'F9957', pct: 20 }, { colorCode: 'F9958', pct: 20 }, { colorCode: 'F9959', pct: 20 }, { colorCode: 'F9961', pct: 10 }],
  },
  nightfall: {
    id: 'nightfall', code: 'FB-715', name: 'Nightfall', series: 'varicolored',
    components: [{ colorCode: 'F1090', pct: 40 }, { colorCode: 'F1050', pct: 10 }, { colorCode: 'F5920', pct: 10 }, { colorCode: 'F6606', pct: 10 }, { colorCode: 'F9904', pct: 10 }, { colorCode: 'F9955', pct: 10 }, { colorCode: 'F9961', pct: 10 }],
  },
  raven: {
    id: 'raven', code: 'FB-915', name: 'Raven', series: 'varicolored',
    components: [{ colorCode: 'F1050', pct: 80 }, { colorCode: 'F1800', pct: 5 }, { colorCode: 'F1820', pct: 5 }, { colorCode: 'F9903', pct: 5 }, { colorCode: 'F9958', pct: 5 }],
  },
  creekbed: {
    id: 'creekbed', code: 'FB-515', name: 'Creekbed', series: 'varicolored',
    components: [{ colorCode: 'F1000', pct: 3 }, { colorCode: 'F1100', pct: 3 }, { colorCode: 'F5115', pct: 3 }, { colorCode: 'F5116', pct: 25 }, { colorCode: 'F5306', pct: 3 }, { colorCode: 'F5305', pct: 10 }, { colorCode: 'F9959', pct: 25 }, { colorCode: 'F9982', pct: 3 }, { colorCode: 'F9987', pct: 25 }],
  },
  shoreline: {
    id: 'shoreline', code: 'FB-461', name: 'Shoreline', series: 'varicolored',
    components: [{ colorCode: 'F1780', pct: 50 }, { colorCode: 'F1425', pct: 33 }, { colorCode: 'F1040', pct: 11 }, { colorCode: 'F1050', pct: 6 }],
  },
  outback: {
    id: 'outback', code: 'FB-517', name: 'Outback', series: 'varicolored',
    components: [{ colorCode: 'F1785', pct: 35 }, { colorCode: 'F1040', pct: 20 }, { colorCode: 'F1770', pct: 15 }, { colorCode: 'F1050', pct: 10 }, { colorCode: 'F1060', pct: 10 }, { colorCode: 'F1820', pct: 10 }],
  },
  orbit: {
    id: 'orbit', code: 'FB-310', name: 'Orbit', series: 'varicolored',
    components: [{ colorCode: 'F1050', pct: 25 }, { colorCode: 'F1480', pct: 25 }, { colorCode: 'F1790', pct: 25 }, { colorCode: 'F1820', pct: 25 }],
  },
  galaxy: {
    id: 'galaxy', code: 'FB-907', name: 'Galaxy', series: 'varicolored',
    components: [{ colorCode: 'F9903', pct: 60 }, { colorCode: 'F1800', pct: 30 }, { colorCode: 'F5920', pct: 5 }, { colorCode: 'F9959', pct: 5 }],
  },
  // Catalog-completion pass (spec Part 1.3 scrape task, not the spec's own
  // seed data): each verified live against a torginol.com product page's
  // "Made Up Of" percentage breakdown (quoted in full in the commit this
  // introduces). Real published recipes, not estimates.
  'feather-gray': {
    id: 'feather-gray', code: 'FB-905', name: 'Feather Gray', series: 'varicolored',
    components: [{ colorCode: 'F1050', pct: 5 }, { colorCode: 'F1800', pct: 5 }, { colorCode: 'F1820', pct: 30 }, { colorCode: 'F9903', pct: 30 }, { colorCode: 'F9958', pct: 30 }],
  },
  hog: {
    id: 'hog', code: 'FB-606', name: 'Hog', series: 'varicolored',
    components: [{ colorCode: 'F1050', pct: 30 }, { colorCode: 'F1410', pct: 30 }, { colorCode: 'F1820', pct: 30 }, { colorCode: 'F2160', pct: 10 }],
  },
  blizzard: {
    id: 'blizzard', code: 'FB-6001', name: 'Blizzard', series: 'marble',
    components: [{ colorCode: 'F3100', pct: 10 }, { colorCode: 'F9307', pct: 18 }, { colorCode: 'F9309', pct: 72 }],
  },
  'water-lily': {
    id: 'water-lily', code: 'FB-921', name: 'Water Lily', series: 'varicolored',
    components: [{ colorCode: 'F9903', pct: 63 }, { colorCode: 'F1800', pct: 20 }, { colorCode: 'F5920', pct: 5 }, { colorCode: 'F6613', pct: 5 }, { colorCode: 'F9966', pct: 5 }, { colorCode: 'F1570', pct: 2 }],
  },
  rapids: {
    id: 'rapids', code: 'FB-506', name: 'Rapids', series: 'varicolored',
    components: [{ colorCode: 'F9957', pct: 20 }, { colorCode: 'F1820', pct: 20 }, { colorCode: 'F9958', pct: 20 }, { colorCode: 'F9964', pct: 10 }, { colorCode: 'F9966', pct: 20 }, { colorCode: 'F9969', pct: 10 }],
  },
  rebel: {
    id: 'rebel', code: 'FB-251', name: 'Rebel', series: 'varicolored',
    components: [{ colorCode: 'F1820', pct: 60 }, { colorCode: 'F9959', pct: 30 }, { colorCode: 'F9978', pct: 4 }, { colorCode: 'F9969', pct: 3 }, { colorCode: 'F1130', pct: 3 }],
  },
  'weathered-gray': {
    id: 'weathered-gray', code: 'FB-6003', name: 'Weathered Gray', series: 'marble',
    components: [{ colorCode: 'F3080', pct: 75 }, { colorCode: 'F9307', pct: 20 }, { colorCode: 'F9309', pct: 5 }],
  },
};

/** @param {string} code @returns {FlakeSolidColor} */
export function findSolidColor(code) {
  return FLAKE_SOLID_COLORS.find((c) => c.code === code) || FLAKE_SOLID_COLORS[0];
}

/** @param {string} blendId @returns {FlakeBlendRecipe|null} */
export function getBlendRecipe(blendId) {
  return FLAKE_BLEND_RECIPES[blendId] || null;
}

/**
 * Resolves either a stock blend id or a custom component list into the
 * `{ hex, pct }[]` shape the renderer consumes — hex resolution happens
 * once here, not per-flake in the hot render loop.
 * @param {{ blendId?: string, customComponents?: FlakeComponent[] }} input
 * @returns {Array<{ hex: string, pct: number }>}
 */
export function resolveRenderComponents(input) {
  const components = input.customComponents?.length
    ? input.customComponents
    : getBlendRecipe(input.blendId)?.components || FLAKE_BLEND_RECIPES.gravel.components;

  const total = components.reduce((sum, c) => sum + c.pct, 0) || 100;
  return components.map((c) => ({ hex: findSolidColor(c.colorCode).hex, pct: (c.pct / total) * 100 }));
}
