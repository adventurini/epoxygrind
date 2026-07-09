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
 * sticker.
 *
 * Perf fix (no-tiling rewrite — see this module's header): the whole floor
 * is now one non-repeating canvas instead of a small repeated tile, which
 * can mean hundreds of thousands of flakes drawn in one pass (see
 * renderFlakeTexture's maxFlakeCount doc). Timed empirically
 * (scratch-flake-qa/timing-current.mjs-style probes via @napi-rs/canvas,
 * 200k flakes): per-flake ctx.save()/translate()/rotate()/restore() cost
 * ~1.3s of a ~1.3s total (fill+stroke via save/restore/rotate) vs ~0.57s
 * doing the same fill+stroke with the rotation applied manually to each
 * vertex instead of pushing/popping the canvas transform stack — roughly a
 * 2.3x speedup, free (same visual output, verified pixel-identical rotation
 * math). At the flake counts this rewrite now runs, that difference is the
 * gap between a ~3.5s and a ~1.5s one-time generation. */
function drawFlakePolygon(ctx, cx, cy, radius, rotation, rand) {
  const vertexCount = 5 + Math.floor(rand() * 4); // 5-8
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  ctx.beginPath();
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const r = radius * (0.65 + rand() * 0.7); // ±35% jitter
    const lx = Math.cos(angle) * r;
    const ly = Math.sin(angle) * r;
    // Manual rotation + translate (equivalent to ctx.translate(cx,cy);
    // ctx.rotate(rotation) around a vertex at (lx,ly)) — see doc comment.
    const x = cx + lx * cosR - ly * sinR;
    const y = cy + lx * sinR + ly * cosR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
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

const TILE_INCHES = 24; // legacy default for spec.spanInches (see below)

/**
 * @param {object} spec
 * @param {number} spec.size - canvas size in px (spec default 1024)
 * @param {number} [spec.spanInches] - real-world width/height (inches) this
 *   canvas represents. Used ONLY to convert spec.flakeSizeIn into a pixel
 *   radius (pxPerInch = size/spanInches) — everything else (coverage
 *   fraction, count) is derived from that, so it's resolution-independent.
 *   No-tiling rewrite (see visualizer-gl.js's header comment on removing
 *   uTileRepeat): this used to be an implicit constant 24 (TILE_INCHES)
 *   because the canvas was always a small repeated tile representing a
 *   fixed ~2ft swatch. Now the canvas represents the WHOLE floor once, so
 *   the caller passes the room's actual estimated real-world span (see
 *   visualizer-gl.js's spanInches calc). Defaults to the old TILE_INCHES so
 *   any other caller (e.g. the blend-chip thumbnail renderer) that doesn't
 *   pass spanInches keeps its exact old behavior.
 * @param {string} spec.baseCoatHex
 * @param {RenderComponent[]} spec.components - resolveRenderComponents() output
 * @param {number} spec.density - 0 (bare base coat) .. 1 (full broadcast)
 * @param {number} spec.flakeSizeIn - nominal flake size in inches (0.0625..1)
 * @param {number} spec.seed - stable seed; same seed + same density/size = same
 *   flake positions/rotations even when components (colors) change, so
 *   swapping blend never "reshuffles" the floor (spec 2.2 step 3).
 * @param {number} [spec.maxFlakeCount] - hard cap on how many flakes get
 *   drawn, regardless of what the real-density formula below asks for. See
 *   doc comment above the count-capping block for why this exists and how
 *   the real-density calibration is preserved anyway when it kicks in.
 * @param {CanvasRenderingContext2D} ctx - a 2D context (browser canvas or
 *   @napi-rs/canvas), already sized to spec.size x spec.size
 */
export function renderFlakeTexture(spec, ctx) {
  const { size, spanInches = TILE_INCHES, baseCoatHex, components, density, flakeSizeIn, seed, maxFlakeCount = Infinity } = spec;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = baseCoatHex;
  ctx.fillRect(0, 0, size, size);

  if (density <= 0 || !components?.length) return;

  const pxPerInch = size / spanInches;
  let nominalRadiusPx = (flakeSizeIn * pxPerInch) / 2;

  // Coverage math: how many flakes at density=1 nearly hide the base coat.
  // Tuned against real Torginol swatch photos (see this module's QA
  // screenshots) rather than derived purely from spec's ballpark numbers —
  // an irregular jittered polygon covers roughly half its bounding circle,
  // and full "broadcast to rejection" installs show 2-3 overlapping chip
  // layers, so canvasArea * layers / avgFlakeArea gives a count that scales
  // correctly across all flake sizes (not just the 1/4" spec worked through).
  //
  // This whole ratio (count * avgFlakeArea / canvasArea) is deliberately
  // resolution-independent — it depends only on spanInches (real floor
  // size) and flakeSizeIn (real chip size), not on `size` (verified: size
  // cancels out of the algebra, and empirically via
  // scratch-flake-qa/timing-current.mjs, which found generation time flat
  // across size=1024..4096 at fixed spanInches/flakeSizeIn). That's what
  // makes the real-world calibration hold regardless of what generation
  // resolution we pick for perf/hardware reasons.
  const avgFlakeArea = Math.PI * nominalRadiusPx * nominalRadiusPx * 0.55;
  const coverageLayers = 2.1; // lowered from 2.6 during QA — left a touch more
  // resin/base-coat breathing room between chips so individual flakes stay
  // readable at density=1 instead of visually fusing into a solid speckle.
  const idealMaxCount = Math.round((size * size * coverageLayers) / avgFlakeArea);
  const idealCount = Math.round(idealMaxCount * Math.pow(Math.max(0, Math.min(1, density)), 1.4));

  // Perf cap for the no-tiling rewrite: covering a REAL room's whole span
  // with unique (non-repeating) flakes at the old tile's calibrated density
  // needs a LOT more flakes than the old fixed 1024x1024/24in tile ever
  // drew, because a bigger real floor genuinely needs proportionally more
  // real chips to fill it — this isn't a bug, it's the actual cost of
  // removing the repeat. Measured via @napi-rs/canvas (see
  // scratch-flake-qa/timing-current.mjs and the density-*.png crops
  // generated alongside it): idealCount for a baseline ~450sqft garage
  // (spanInches=144) at the default 1/4" flake is ~1.6M, which takes ~7.7s
  // to draw with this renderer — too slow to feel responsive as a one-time,
  // still-in-the-loading-flow generation. 300-350k flakes (~1.5-1.7s) was
  // the empirical knee: visibly denser than 150k (which read as a
  // noticeably sparse/gappy broadcast next to the ideal-density reference
  // render) and close to indistinguishable from the full 1.6M reference at
  // realistic viewing/display resolution.
  const count = Math.min(idealCount, maxFlakeCount);

  // When the cap engages, DON'T just draw fewer flakes at the ideal radius
  // (that reads as visibly sparse — confirmed via
  // scratch-flake-qa/crop-cov-350k-unscaled.png, which shows clear gaps of
  // bare base coat next to same-count-but-scaled-radius). Instead boost
  // each flake's radius by sqrt(idealCount/count) so total coverage area
  // (count * avgFlakeArea) stays equal to what the real-density formula
  // targeted — same "how full does this look" calibration, achieved with
  // fewer, proportionally larger chips instead of a gappier scatter of
  // correctly-sized ones. Verified visually
  // (scratch-flake-qa/crop-cov-350k-scaled.png reads as full/dense broadcast,
  // near-indistinguishable from the uncapped reference at this crop scale).
  // Real-world tradeoff: individual chips on a very large, heavily-capped
  // room will read as somewhat larger than their literal flakeSizeIn spec —
  // an accepted, documented compromise (see visualizer-gl.js's caller-side
  // comments for the room-size math this feeds into).
  if (count < idealCount) {
    nominalRadiusPx *= Math.sqrt(idealCount / count);
  }

  // Seed is shared across a (density, flakeSizeIn) combo so position/
  // rotation are stable when only the blend/color changes — only the
  // per-flake color roll differs. Position/rotation PRNG and color PRNG
  // are deliberately separate streams so re-rolling color alone can't
  // perturb position draws downstream.
  const posRand = mulberry32(seed);
  const colorRand = mulberry32(seed ^ 0x9e3779b9);

  for (let i = 0; i < count; i++) {
    // No-tiling rewrite: flakes are scattered across the whole canvas with
    // no wrap-at-the-edges margin/redraw (that machinery existed solely to
    // make the old small tile repeat seamlessly under gl.REPEAT — with
    // tiling removed there's nothing to seam-match, so a flake that happens
    // to land astride the canvas edge is simply, naturally cut off by it,
    // exactly like a real floor photo's framing crops the actual floor).
    const cx = posRand() * size;
    const cy = posRand() * size;
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
