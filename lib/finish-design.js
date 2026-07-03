/** @typedef {'solid' | 'flake' | 'metallic'} FinishType */

/**
 * Standard professional epoxy base coat colors — the palette pro systems
 * actually ship in (no free hex/custom color: a homeowner-picked arbitrary
 * hex isn't a color any manufacturer can match, which makes the resulting
 * quote unquotable). Every color here is a real, orderable base coat shade.
 */
export const BASE_COLORS = [
  { id: 'light-gray', label: 'Light gray', hex: '#B8BEC6', prompt: 'light gray epoxy base coat' },
  { id: 'medium-gray', label: 'Medium gray', hex: '#8A8F98', prompt: 'medium gray epoxy base coat' },
  { id: 'charcoal', label: 'Charcoal gray', hex: '#4A4F54', prompt: 'charcoal gray epoxy base coat' },
  { id: 'black', label: 'Jet black', hex: '#1C1E22', prompt: 'jet black epoxy base coat' },
  { id: 'tan', label: 'Tan', hex: '#C4A882', prompt: 'warm tan epoxy base coat' },
  { id: 'off-white', label: 'Off white', hex: '#E8E6E1', prompt: 'off-white epoxy base coat' },
  { id: 'tile-red', label: 'Tile red', hex: '#8C3B32', prompt: 'brick/tile red epoxy base coat' },
  { id: 'dark-blue', label: 'Dark blue', hex: '#26385C', prompt: 'dark navy blue epoxy base coat' },
];

/**
 * Real, named Torginol vinyl flake blends (a widely-used flake manufacturer
 * many pro epoxy brands source from/rebrand — see BUILD-visualizer-build-spec
 * for the full catalog). Swatch hexes are representative averages of each
 * blend's published component colors, not exact photo samples.
 */
export const FLAKE_COLORS = [
  {
    id: 'domino',
    label: 'Domino',
    hex: '#8C8C8A',
    prompt: "Torginol 'Domino' vinyl flake blend — an even mix of black, granite gray, and white chips",
  },
  {
    id: 'gravel',
    label: 'Gravel',
    hex: '#A9A9A7',
    prompt: "Torginol 'Gravel' vinyl flake blend — light gray, graphite, and white chips",
  },
  {
    id: 'tidal-wave',
    label: 'Tidal Wave',
    hex: '#BEBEBC',
    prompt: "Torginol 'Tidal Wave' vinyl flake blend — white, cream, and slate blue chips",
  },
  {
    id: 'cabin-fever',
    label: 'Cabin Fever',
    hex: '#BAB6AA',
    prompt: "Torginol 'Cabin Fever' vinyl flake blend — warm tan, granite, white, and a touch of black chips",
  },
  {
    id: 'wombat',
    label: 'Wombat',
    hex: '#676765',
    prompt: "Torginol 'Wombat' vinyl flake blend — mostly dark charcoal with black, gray, and white accents",
  },
  {
    id: 'coyote',
    label: 'Coyote',
    hex: '#CFC8BB',
    prompt: "Torginol 'Coyote' vinyl flake blend — light tan and cream desert-tone chips",
  },
];

export const PATTERNS = {
  solid: [
    {
      id: 'smooth',
      label: 'Smooth gloss',
      description: 'Clean single-color high-gloss coat',
      addLow: 0,
      addHigh: 0,
      prompt: 'smooth high-gloss solid color epoxy floor',
    },
    {
      id: 'quartz',
      label: 'Quartz sand',
      description: 'Light quartz aggregate for slip resistance',
      addLow: 0.5,
      addHigh: 1.25,
      prompt: 'solid color epoxy with fine quartz sand texture for slip resistance',
    },
    {
      id: 'satin',
      label: 'Satin finish',
      description: 'Lower sheen, hides minor imperfections',
      addLow: 0,
      addHigh: 0.5,
      prompt: 'solid color epoxy with satin low-sheen finish',
    },
  ],
  flake: [
    {
      id: 'full-broadcast',
      label: 'Full broadcast',
      description: 'Dense flake coverage wall to wall',
      addLow: 0,
      addHigh: 0,
      prompt: 'full broadcast vinyl flake epoxy floor with dense flake coverage',
    },
    {
      id: 'partial',
      label: 'Partial broadcast',
      description: 'Lighter flake density, base color shows through',
      addLow: -0.5,
      addHigh: 0,
      prompt: 'partial broadcast flake epoxy with base color visible between chips',
    },
    {
      id: 'granite-look',
      label: 'Granite look',
      description: 'Multicolor stone appearance',
      addLow: 0.75,
      addHigh: 1.5,
      prompt: 'granite-look multicolor flake epoxy resembling natural stone',
    },
    {
      id: 'confetti',
      label: 'Confetti mix',
      description: 'Bold multicolor accent chips',
      addLow: 0.5,
      addHigh: 1,
      prompt: 'confetti-style multicolor vinyl flake epoxy floor',
    },
    {
      id: 'double-broadcast',
      label: 'Double broadcast',
      description: 'Premium double flake layer',
      addLow: 1.25,
      addHigh: 2,
      prompt: 'premium double-broadcast flake epoxy with extra depth and texture',
    },
  ],
  metallic: [
    {
      id: 'swirl',
      label: 'Classic swirl',
      description: 'Organic metallic movement',
      addLow: 0,
      addHigh: 0.5,
      prompt: 'metallic epoxy with classic organic swirl pattern',
    },
    {
      id: 'marble',
      label: 'Marble flow',
      description: 'Soft marble veining effect',
      addLow: 0.75,
      addHigh: 1.5,
      prompt: 'metallic epoxy with soft marble veining and flowing highlights',
    },
    {
      id: 'ripple',
      label: 'Ripple wave',
      description: 'Bold wave-like metallic bands',
      addLow: 0.5,
      addHigh: 1.25,
      prompt: 'metallic epoxy with ripple wave pattern and deep reflective bands',
    },
    {
      id: 'lava',
      label: 'Lava glow',
      description: 'High-contrast molten metallic look',
      addLow: 1,
      addHigh: 2,
      prompt: 'high-contrast lava-flow metallic epoxy with glowing highlights',
    },
  ],
};

/**
 * @param {FinishType} finish
 */
export function getPatternsForFinish(finish) {
  return PATTERNS[finish] || PATTERNS.flake;
}

/**
 * @param {string} id
 * @param {typeof BASE_COLORS} list
 */
export function findColor(id, list = BASE_COLORS) {
  return list.find((c) => c.id === id) || list[0];
}

/**
 * @param {object} input
 * @param {FinishType} input.finish
 * @param {string} [input.baseColor] - a BASE_COLORS id
 * @param {string} [input.flakeColor] - a FLAKE_COLORS id
 * @param {string} input.pattern
 *
 * Colors are resolved strictly by id from the fixed BASE_COLORS/FLAKE_COLORS
 * lists — never from a client-supplied hex. Every rendered floor must map
 * to a real, orderable manufacturer color, so a quote from this preview is
 * always something a contractor can actually match.
 */
export function resolveDesign(input) {
  const finish = ['solid', 'flake', 'metallic'].includes(input.finish) ? input.finish : 'flake';
  const base = findColor(input.baseColor || 'charcoal', BASE_COLORS);
  const patterns = getPatternsForFinish(finish);
  const pattern = patterns.find((p) => p.id === input.pattern) || patterns[0];
  const flake = finish === 'flake' ? findColor(input.flakeColor || 'gravel', FLAKE_COLORS) : null;

  const colorLabel = finish === 'flake' && flake ? `${base.label} base · ${flake.label} flake` : base.label;
  const promptColor = finish === 'flake' && flake ? `${base.prompt} with ${flake.prompt}` : base.prompt;

  return {
    finish,
    baseColor: base.id,
    baseColorLabel: base.label,
    baseColorHex: base.hex,
    flakeColor: flake?.id || null,
    flakeColorLabel: flake?.label || null,
    flakeColorHex: flake?.hex || null,
    pattern: pattern.id,
    patternLabel: pattern.label,
    patternDescription: pattern.description,
    patternAddLow: pattern.addLow,
    patternAddHigh: pattern.addHigh,
    colorLabel,
    summary: `${colorLabel} · ${pattern.label}`,
    promptColor,
    promptPattern: pattern.prompt,
  };
}

/**
 * @param {ReturnType<typeof resolveDesign>} design
 */
export function buildDesignPrompt(design) {
  return `${design.promptPattern}. Primary color: ${design.promptColor}.`;
}

/**
 * @param {number} sqFt
 * @param {FinishType} finish
 * @param {ReturnType<typeof resolveDesign>} design
 */
export function designPricingAdjustments(sqFt, finish, design) {
  const area = Math.max(0, Number(sqFt) || 0);
  const addLow = area * (design.patternAddLow || 0);
  const addHigh = area * (design.patternAddHigh || 0);
  return {
    addLow,
    addHigh,
    lineItem:
      design.patternAddLow !== 0 || design.patternAddHigh !== 0
        ? {
            label: `${design.patternLabel} pattern upgrade`,
            low: Math.max(0, addLow),
            high: Math.max(0, addHigh),
            note: design.patternDescription,
          }
        : null,
  };
}
