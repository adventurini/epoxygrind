/** Client-safe color/pattern options (mirrors lib/finish-design.js). */

export const BASE_COLORS = [
  { id: 'charcoal', label: 'Charcoal gray', hex: '#4A4F54' },
  { id: 'light-gray', label: 'Light gray', hex: '#B8BEC6' },
  { id: 'tan', label: 'Tan / beige', hex: '#C4A882' },
  { id: 'off-white', label: 'Off white', hex: '#E8E6E1' },
  { id: 'slate', label: 'Slate blue', hex: '#5C6B7A' },
  { id: 'terracotta', label: 'Terracotta', hex: '#A65D45' },
  { id: 'black', label: 'Jet black', hex: '#1C1E22' },
  { id: 'custom', label: 'Custom', hex: '#888888' },
];

export const FLAKE_COLORS = [
  { id: 'gray-black', label: 'Gray / black blend', hex: '#6B7078' },
  { id: 'tan-brown', label: 'Tan / brown', hex: '#9A7B5A' },
  { id: 'blue-white', label: 'Blue / white', hex: '#6E8FAF' },
  { id: 'red-black', label: 'Red / black', hex: '#8B3A3A' },
  { id: 'granite', label: 'Granite mix', hex: '#7A7570' },
  { id: 'custom-flake', label: 'Custom blend', hex: '#888888' },
];

const PATTERNS = {
  solid: [
    { id: 'smooth', label: 'Smooth gloss' },
    { id: 'quartz', label: 'Quartz sand' },
    { id: 'satin', label: 'Satin finish' },
  ],
  flake: [
    { id: 'full-broadcast', label: 'Full broadcast' },
    { id: 'partial', label: 'Partial broadcast' },
    { id: 'granite-look', label: 'Granite look' },
    { id: 'confetti', label: 'Confetti mix' },
    { id: 'double-broadcast', label: 'Double broadcast (premium)' },
  ],
  metallic: [
    { id: 'swirl', label: 'Classic swirl' },
    { id: 'marble', label: 'Marble flow' },
    { id: 'ripple', label: 'Ripple wave' },
    { id: 'lava', label: 'Lava glow' },
  ],
};

export function getPatternsForFinish(finish) {
  return PATTERNS[finish] || PATTERNS.flake;
}

/** Coating chemistry — a layer on top of Finish, applies to any finish/pattern. */
export const COATING_TYPES = [
  { id: 'epoxy', label: 'Standard epoxy', description: 'Classic 2-part epoxy coating' },
  { id: 'polyaspartic', label: 'Polyaspartic (fast-cure)', description: 'Ready in as little as 24 hours, resists UV yellowing' },
];
