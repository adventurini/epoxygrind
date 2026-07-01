/** @typedef {'solid' | 'flake' | 'metallic'} FinishType */

export const BASE_COLORS = [
  { id: 'charcoal', label: 'Charcoal gray', hex: '#4A4F54', prompt: 'charcoal gray' },
  { id: 'light-gray', label: 'Light gray', hex: '#B8BEC6', prompt: 'light gray' },
  { id: 'tan', label: 'Tan / beige', hex: '#C4A882', prompt: 'warm tan beige' },
  { id: 'off-white', label: 'Off white', hex: '#E8E6E1', prompt: 'soft off-white cream' },
  { id: 'slate', label: 'Slate blue', hex: '#5C6B7A', prompt: 'slate blue-gray' },
  { id: 'terracotta', label: 'Terracotta', hex: '#A65D45', prompt: 'terracotta brown' },
  { id: 'black', label: 'Jet black', hex: '#1C1E22', prompt: 'jet black' },
  { id: 'custom', label: 'Custom', hex: '#888888', prompt: 'custom color' },
];

export const FLAKE_COLORS = [
  { id: 'gray-black', label: 'Gray / black blend', hex: '#6B7078', prompt: 'gray and black vinyl flake blend' },
  { id: 'tan-brown', label: 'Tan / brown', hex: '#9A7B5A', prompt: 'tan and brown flake blend' },
  { id: 'blue-white', label: 'Blue / white', hex: '#6E8FAF', prompt: 'blue and white flake blend' },
  { id: 'red-black', label: 'Red / black', hex: '#8B3A3A', prompt: 'red and black flake blend' },
  { id: 'granite', label: 'Granite mix', hex: '#7A7570', prompt: 'multicolor granite flake mix' },
  { id: 'custom-flake', label: 'Custom blend', hex: '#888888', prompt: 'custom multicolor flake blend' },
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

export function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(h)) return `#${h.toUpperCase()}`;
  return null;
}

/**
 * @param {object} input
 * @param {FinishType} input.finish
 * @param {string} [input.baseColor]
 * @param {string} [input.baseColorHex]
 * @param {string} [input.flakeColor]
 * @param {string} [input.flakeColorHex]
 * @param {string} input.pattern
 * @param {string} [input.customColorNote]
 */
export function resolveDesign(input) {
  const finish = ['solid', 'flake', 'metallic'].includes(input.finish) ? input.finish : 'flake';
  const base = findColor(input.baseColor || 'charcoal', BASE_COLORS);
  const patterns = getPatternsForFinish(finish);
  const pattern = patterns.find((p) => p.id === input.pattern) || patterns[0];
  const flake = finish === 'flake' ? findColor(input.flakeColor || 'gray-black', FLAKE_COLORS) : null;
  const customNote = (input.customColorNote || '').trim();

  const baseHex = normalizeHex(input.baseColorHex) || base.hex;
  const flakeHex = finish === 'flake' ? normalizeHex(input.flakeColorHex) || flake?.hex : null;

  const colorLabel =
    finish === 'flake' && flakeHex
      ? `${baseHex} base · ${flakeHex} flake`
      : baseHex;

  const promptColor =
    finish === 'flake' && flakeHex
      ? `epoxy base coat color ${baseHex} with vinyl flake chips ${flakeHex}`
      : `epoxy floor color ${baseHex}`;

  return {
    finish,
    baseColor: base.id,
    baseColorLabel: base.label,
    baseColorHex: baseHex,
    flakeColor: flake?.id || null,
    flakeColorLabel: flake?.label || null,
    flakeColorHex: flakeHex,
    pattern: pattern.id,
    patternLabel: pattern.label,
    patternDescription: pattern.description,
    patternAddLow: pattern.addLow,
    patternAddHigh: pattern.addHigh,
    customColorNote: customNote || null,
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
