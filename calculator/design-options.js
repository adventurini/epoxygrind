/**
 * Client-safe color/pattern options (mirrors lib/finish-design.js).
 * Every color is a real, orderable manufacturer color/blend — no free hex,
 * so every rendered floor maps to something a contractor can actually quote.
 */

export const BASE_COLORS = [
  { id: 'light-gray', label: 'Light gray', hex: '#B8BEC6' },
  { id: 'medium-gray', label: 'Medium gray', hex: '#8A8F98' },
  { id: 'charcoal', label: 'Charcoal gray', hex: '#4A4F54' },
  { id: 'black', label: 'Jet black', hex: '#1C1E22' },
  { id: 'tan', label: 'Tan', hex: '#C4A882' },
  { id: 'off-white', label: 'Off white', hex: '#E8E6E1' },
  { id: 'tile-red', label: 'Tile red', hex: '#8C3B32' },
  { id: 'dark-blue', label: 'Dark blue', hex: '#26385C' },
  // Additive — see lib/finish-design.js for why these three were added.
  { id: 'dark-gray', label: 'Dark gray', hex: '#6B7078' },
  { id: 'beige', label: 'Beige', hex: '#D9CBAE' },
  { id: 'white', label: 'White', hex: '#F4F3EF' },
];

/** Real acid-stain/water-based-stain color names — see lib/finish-design.js. */
export const CONCRETE_COLORS = [
  { id: 'natural-gray', label: 'Natural gray', hex: '#9C9890' },
  { id: 'charcoal-stain', label: 'Charcoal', hex: '#3C3C3C' },
  { id: 'coffee-brown', label: 'Coffee brown', hex: '#4A3728' },
  { id: 'walnut', label: 'Walnut', hex: '#5C4033' },
  { id: 'sahara-tan', label: 'Sahara tan', hex: '#C2A878' },
  { id: 'terra-cotta', label: 'Terra cotta', hex: '#B5651D' },
  { id: 'english-red', label: 'English red', hex: '#8B3A2E' },
  { id: 'slate-gray', label: 'Slate gray', hex: '#6E7B7F' },
];

/** Real, named Torginol vinyl flake blends — see lib/finish-design.js. */
export const FLAKE_COLORS = [
  { id: 'domino', label: 'Domino', hex: '#8C8C8A' },
  { id: 'gravel', label: 'Gravel', hex: '#A9A9A7' },
  { id: 'tidal-wave', label: 'Tidal Wave', hex: '#BEBEBC' },
  { id: 'cabin-fever', label: 'Cabin Fever', hex: '#BAB6AA' },
  { id: 'wombat', label: 'Wombat', hex: '#676765' },
  { id: 'coyote', label: 'Coyote', hex: '#CFC8BB' },
  // Kept in sync with lib/finish-design.js's catalog-completion addition.
  { id: 'nightfall', label: 'Nightfall', hex: '#5A5A58' },
  { id: 'raven', label: 'Raven', hex: '#3F3F3E' },
  { id: 'creekbed', label: 'Creekbed', hex: '#C3B6A1' },
  { id: 'shoreline', label: 'Shoreline', hex: '#CABCA2' },
  { id: 'outback', label: 'Outback', hex: '#A78769' },
  { id: 'orbit', label: 'Orbit', hex: '#70798C' },
  { id: 'galaxy', label: 'Galaxy', hex: '#AFAFAA' },
  // Kept in sync with lib/finish-design.js's Part 1.3 scrape-task addition.
  { id: 'feather-gray', label: 'Feather Gray', hex: '#CCCAC5' },
  { id: 'hog', label: 'Hog', hex: '#968B80' },
  { id: 'blizzard', label: 'Blizzard', hex: '#898B95' },
  { id: 'water-lily', label: 'Water Lily', hex: '#A6A7A3' },
  { id: 'rapids', label: 'Rapids', hex: '#BDBEBD' },
  { id: 'rebel', label: 'Rebel', hex: '#DFD9D4' },
  { id: 'weathered-gray', label: 'Weathered Gray', hex: '#918D8E' },
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
  concrete: [
    { id: 'polished', label: 'Polished (no stain)' },
    { id: 'stained', label: 'Stained & sealed' },
    { id: 'overlay-smooth', label: 'Smooth overlay' },
    { id: 'stamped', label: 'Stamped overlay' },
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
