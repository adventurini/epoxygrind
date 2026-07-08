/**
 * Metallic epoxy — v1 per spec Part 5/"Non-goals": static tileable swatch
 * textures (NOT the live procedural marbling renderer, which is v2), run
 * through the same mask/perspective/relight composite pipeline as flake and
 * solid finishes so it still looks placed in the room.
 *
 * No photographed metallic-epoxy swatch image assets exist in this repo
 * and none were sourced for this pass (would need real licensed product
 * photography — a scraping/licensing task, not a code task). Standing in
 * for that: each colorway is rendered ONCE into a small offscreen canvas
 * using a fixed-seed blotch/swirl generator and then treated as a static
 * texture from that point on — controls never regenerate it (unlike the
 * flake renderer, there is no density/size knob for metallic in v1), which
 * is the behavior the spec actually cares about here. Swap
 * renderMetallicSwatchTexture's body for real sampled swatch photos later
 * without touching any caller.
 *
 * Isomorphic like lib/flake-texture-renderer.js — same 2D context works in
 * a browser <canvas> or @napi-rs/canvas.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 9 popular colorways (spec asks for 8-10). Each is base + a mid vein tone
 * + a bright highlight tone — the three-tone recipe real metallic epoxy
 * marketing photos consistently show (dark pooling, mid-tone flow, bright
 * highlight where pigment and hardener interact). */
export const METALLIC_COLORWAYS = [
  { id: 'champagne-gold', label: 'Champagne Gold', baseHex: '#8a6a2f', veinHex: '#c9a355', highlightHex: '#f0dba3' },
  { id: 'silver-pearl', label: 'Silver Pearl', baseHex: '#8d9299', veinHex: '#c3c8cd', highlightHex: '#f2f4f6' },
  { id: 'charcoal-storm', label: 'Charcoal Storm', baseHex: '#2b2e33', veinHex: '#565c63', highlightHex: '#9aa1a8' },
  { id: 'ocean-blue', label: 'Ocean Blue', baseHex: '#12456b', veinHex: '#2f7fae', highlightHex: '#8fd4e8' },
  { id: 'emerald-forest', label: 'Emerald Forest', baseHex: '#0f4a3a', veinHex: '#2f8a63', highlightHex: '#8fd9ab' },
  { id: 'copper-rust', label: 'Copper Rust', baseHex: '#7a3520', veinHex: '#b8592f', highlightHex: '#e8a56b' },
  { id: 'sapphire-night', label: 'Sapphire Night', baseHex: '#161f52', veinHex: '#33409c', highlightHex: '#8c96e0' },
  { id: 'platinum-white', label: 'Platinum White', baseHex: '#c9c7c0', veinHex: '#e8e6df', highlightHex: '#ffffff' },
  { id: 'onyx-black', label: 'Onyx Black', baseHex: '#111214', veinHex: '#2e3136', highlightHex: '#6b7178' },
];

export function findMetallicColorway(id) {
  return METALLIC_COLORWAYS.find((c) => c.id === id) || METALLIC_COLORWAYS[0];
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbaStr({ r, g, b }, a) {
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * @param {object} spec
 * @param {number} spec.size - canvas size in px
 * @param {string} spec.colorwayId
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderMetallicSwatchTexture(spec, ctx) {
  const { size, colorwayId } = spec;
  const colorway = findMetallicColorway(colorwayId);
  const rand = mulberry32(
    colorway.id.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0,
  );

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = colorway.baseHex;
  ctx.fillRect(0, 0, size, size);

  const vein = hexToRgb(colorway.veinHex);
  const highlight = hexToRgb(colorway.highlightHex);

  // Soft organic vein blotches — large, low-opacity radial gradients
  // scattered and wrapped at the edges so the texture still tiles.
  const blobCount = 10;
  for (let i = 0; i < blobCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = size * (0.18 + rand() * 0.22);
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const gx = cx + dx;
      const gy = cy + dy;
      if (gx + r < 0 || gx - r > size || gy + r < 0 || gy - r > size) continue;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      grad.addColorStop(0, rgbaStr(vein, 0.5 + rand() * 0.2));
      grad.addColorStop(1, rgbaStr(vein, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Thin bright highlight streaks — the "flow line" look.
  const streakCount = 6;
  for (let i = 0; i < streakCount; i++) {
    const y = rand() * size;
    const amp = size * (0.03 + rand() * 0.05);
    const thickness = size * (0.01 + rand() * 0.015);
    ctx.strokeStyle = rgbaStr(highlight, 0.22 + rand() * 0.18);
    ctx.lineWidth = thickness;
    ctx.beginPath();
    for (let x = -size * 0.1; x <= size * 1.1; x += size * 0.05) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 + i) * amp;
      if (x === -size * 0.1) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}
