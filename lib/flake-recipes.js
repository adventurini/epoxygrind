/**
 * Real weighted flake-blend recipes, extending lib/finish-design.js's
 * FLAKE_COLORS (which only carries one averaged hex per blend — not enough
 * to procedurally render individual chips). Additive: does not change
 * finish-design.js's existing exports or resolveDesign()'s return shape.
 *
 * Percentages are published Torginol recipes (see
 * epoxygrind-visualizer-build-spec.md Part 1.2) — the solid-color catalog
 * and all 6 blend component lists below are copied from that spec
 * verbatim, just reshaped from TypeScript/JSON into a plain JS module with
 * JSDoc typedefs to match this codebase's convention (see lib/pricing.js).
 *
 * @typedef {{ code: string, name: string, hex: string, hexVerified: boolean }} FlakeSolidColor
 * @typedef {{ colorCode: string, pct: number }} FlakeComponent
 * @typedef {{ id: string, code: string, name: string, components: FlakeComponent[] }} FlakeBlendRecipe
 */

/** Full published Torginol solid-color catalog — hexes are estimates
 * pending real swatch-photo sampling (hexVerified: false throughout, same
 * as the spec's own seed data). Only ~15 of these back the 6 recipes below
 * today; the rest are here so the custom blend builder has a real, useful
 * palette to build from rather than 6 colors. */
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
];

/** Keyed by the SAME ids finish-design.js's FLAKE_COLORS already uses, so
 * both modules describe the same 6 blends without a second ID scheme. */
export const FLAKE_BLEND_RECIPES = {
  domino: {
    id: 'domino', code: 'FB-411', name: 'Domino',
    components: [{ colorCode: 'F1050', pct: 33 }, { colorCode: 'F1410', pct: 33 }, { colorCode: 'F1820', pct: 34 }],
  },
  gravel: {
    id: 'gravel', code: 'FB-414', name: 'Gravel',
    components: [{ colorCode: 'F1410', pct: 25 }, { colorCode: 'F1415', pct: 25 }, { colorCode: 'F1800', pct: 25 }, { colorCode: 'F1820', pct: 25 }],
  },
  'tidal-wave': {
    id: 'tidal-wave', code: 'FB-807', name: 'Tidal Wave',
    components: [{ colorCode: 'F1820', pct: 20 }, { colorCode: 'F6621', pct: 10 }, { colorCode: 'F9903', pct: 20 }, { colorCode: 'F9958', pct: 20 }, { colorCode: 'F9959', pct: 20 }, { colorCode: 'F9972', pct: 10 }],
  },
  'cabin-fever': {
    id: 'cabin-fever', code: 'FB-127', name: 'Cabin Fever',
    components: [{ colorCode: 'F1410', pct: 30 }, { colorCode: 'F1780', pct: 30 }, { colorCode: 'F1820', pct: 30 }, { colorCode: 'F1050', pct: 10 }],
  },
  wombat: {
    id: 'wombat', code: 'FB-616', name: 'Wombat',
    components: [{ colorCode: 'F1090', pct: 55 }, { colorCode: 'F1050', pct: 15 }, { colorCode: 'F1800', pct: 15 }, { colorCode: 'F1820', pct: 15 }],
  },
  coyote: {
    id: 'coyote', code: 'FB-514', name: 'Coyote',
    components: [{ colorCode: 'F1050', pct: 5 }, { colorCode: 'F1820', pct: 20 }, { colorCode: 'F5052', pct: 5 }, { colorCode: 'F9957', pct: 20 }, { colorCode: 'F9958', pct: 20 }, { colorCode: 'F9959', pct: 20 }, { colorCode: 'F9961', pct: 10 }],
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
