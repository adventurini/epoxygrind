/**
 * Procedural vinyl-flake texture renderer (epoxygrind-visualizer-build-spec.md
 * Part 2). Isomorphic: takes a 2D rendering context, works identically with
 * a browser <canvas> and with @napi-rs/canvas's createCanvas() in Node (used
 * elsewhere in this repo for the carousel compositor) — one implementation,
 * so a blend chip thumbnail and the full floor texture are guaranteed to
 * look the same, per the spec's "never ship static swatch images" rule.
 *
 * Flakes are NOT swatch images — they're generated per-blend from a
 * weighted color-percentage recipe (lib/flake-recipes.js), which is what
 * makes density/size free to change and custom blends possible.
 *
 * @typedef {{ hex: string, pct: number }} RenderComponent
 */

/** mulberry32 — small, fast, seeded PRNG so re-renders are stable (the
 * floor must not visually "reshuffle" when only density or color changes;
 * see renderFlakeTexture's cache/reuse behavior below). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function shadeRgb({ r, g, b }, factor) {
  return `rgb(${Math.round(Math.min(255, r * factor))},${Math.round(Math.min(255, g * factor))},${Math.round(Math.min(255, b * factor))})`;
}

/** Weighted pick by cumulative pct — components' pcts already sum to
 * ~100 (resolveRenderComponents normalizes), so a flat random(0,100) walk
 * is correct. */
function pickWeighted(components, rand) {
  const roll = rand() * 100;
  let acc = 0;
  for (const c of components) {
    acc += c.pct;
    if (roll <= acc) return c;
  }
  return components[components.length - 1];
}

/** Real vinyl flakes are angular chips, not circles or clean polygons —
 * 5-8 vertices with per-vertex radius jitter reads as a chip, not a
 * sticker. */
function drawFlakePolygon(ctx, cx, cy, radius, rotation, rand) {
  const vertexCount = 5 + Math.floor(rand() * 4); // 5-8
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const r = radius * (0.65 + rand() * 0.7); // ±35% jitter
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.restore();
}

/** Log-normal-ish jitter around a nominal size — real broadcast has fines
 * mixed in with noticeably larger chips, not a uniform size everywhere.
 * Widened from the spec's starting sigma=0.25 during QA: at 0.25 the
 * render read as uniform aggregate/sandpaper texture rather than
 * distinguishable chips — real flake photos show much more dramatic size
 * variation between the small fines and the larger dominant chips. */
function jitteredRadius(nominalRadius, rand) {
  const gaussian = (rand() + rand() + rand() + rand() - 2) / 2; // cheap approx normal(0,~0.5)
  const sigma = 0.4;
  return nominalRadius * Math.exp(gaussian * sigma);
}

const TILE_INCHES = 24; // ~2ft x 2ft, per spec 2.1

/**
 * @param {object} spec
 * @param {number} spec.size - canvas size in px (spec default 1024)
 * @param {string} spec.baseCoatHex
 * @param {RenderComponent[]} spec.components - resolveRenderComponents() output
 * @param {number} spec.density - 0 (bare base coat) .. 1 (full broadcast)
 * @param {number} spec.flakeSizeIn - nominal flake size in inches (0.0625..1)
 * @param {number} spec.seed - stable seed; same seed + same density/size = same
 *   flake positions/rotations even when components (colors) change, so
 *   swapping blend never "reshuffles" the floor (spec 2.2 step 3).
 * @param {CanvasRenderingContext2D} ctx - a 2D context (browser canvas or
 *   @napi-rs/canvas), already sized to spec.size x spec.size
 */
export function renderFlakeTexture(spec, ctx) {
  const { size, baseCoatHex, components, density, flakeSizeIn, seed } = spec;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = baseCoatHex;
  ctx.fillRect(0, 0, size, size);

  if (density <= 0 || !components?.length) return;

  const pxPerInch = size / TILE_INCHES;
  const nominalRadiusPx = (flakeSizeIn * pxPerInch) / 2;

  // Coverage math: how many flakes at density=1 nearly hide the base coat.
  // Tuned against real Torginol swatch photos (see this module's QA
  // screenshots) rather than derived purely from spec's ballpark numbers —
  // an irregular jittered polygon covers roughly half its bounding circle,
  // and full "broadcast to rejection" installs show 2-3 overlapping chip
  // layers, so canvasArea * layers / avgFlakeArea gives a count that scales
  // correctly across all flake sizes (not just the 1/4" spec worked through).
  const avgFlakeArea = Math.PI * nominalRadiusPx * nominalRadiusPx * 0.55;
  const coverageLayers = 2.1; // lowered from 2.6 during QA — left a touch more
  // resin/base-coat breathing room between chips so individual flakes stay
  // readable at density=1 instead of visually fusing into a solid speckle.
  const maxCount = Math.round((size * size * coverageLayers) / avgFlakeArea);
  const count = Math.round(maxCount * Math.pow(Math.max(0, Math.min(1, density)), 1.4));

  // Seed is shared across a (density, flakeSizeIn) combo so position/
  // rotation are stable when only the blend/color changes — only the
  // per-flake color roll differs. Position/rotation PRNG and color PRNG
  // are deliberately separate streams so re-rolling color alone can't
  // perturb position draws downstream.
  const posRand = mulberry32(seed);
  const colorRand = mulberry32(seed ^ 0x9e3779b9);

  const margin = nominalRadiusPx * 2; // draw a little past the edge for tileable wrap

  for (let i = 0; i < count; i++) {
    const cx = posRand() * (size + margin * 2) - margin;
    const cy = posRand() * (size + margin * 2) - margin;
    const radius = jitteredRadius(nominalRadiusPx, posRand);
    const rotation = posRand() * Math.PI * 2;
    const component = pickWeighted(components, colorRand);
    const lightnessJitter = 0.92 + colorRand() * 0.24; // 0.92-1.16, spec's "0.92 + rand()*0.16" widened slightly during QA tuning for visible per-flake variation

    const rgb = hexToRgb(component.hex);
    ctx.fillStyle = shadeRgb(rgb, lightnessJitter);
    drawFlakePolygon(ctx, cx, cy, radius, rotation, posRand);
    ctx.fill();

    // Edge shading — flakes sit in resin, edges catch less light. Darker
    // and wider than the spec's starting ~8%/1px during QA: at that
    // strength adjacent same-tone chips visually fused into one blob;
    // stronger edges keep individual chips separable at full density.
    ctx.strokeStyle = shadeRgb(rgb, lightnessJitter * 0.4);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(0.8, radius * 0.1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Tileable edges: redraw flakes that overlap a border on the opposite
    // side too, so the texture repeats seamlessly.
    const wraps = [];
    if (cx < margin) wraps.push([cx + size, cy]);
    if (cx > size - margin) wraps.push([cx - size, cy]);
    if (cy < margin) wraps.push([cx, cy + size]);
    if (cy > size - margin) wraps.push([cx, cy - size]);
    for (const [wx, wy] of wraps) {
      drawFlakePolygon(ctx, wx, wy, radius, rotation, () => 0.5);
      ctx.fillStyle = shadeRgb(rgb, lightnessJitter);
      ctx.fill();
    }
  }
}

/**
 * Deterministic per-session seed helper — same (density, flakeSizeIn) pair
 * should reuse position/rotation draws across a color/blend swap. Callers
 * own the seed value in their FloorSpec-equivalent state; this just gives
 * a reasonable stable default so two different UI instances don't need to
 * coordinate on a magic number.
 */
export function defaultSeedFor(density, flakeSizeIn) {
  return Math.round(density * 1000) * 31 + Math.round(flakeSizeIn * 10000);
}
