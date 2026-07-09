/**
 * Metallic epoxy — v1 per spec Part 5/"Non-goals": procedurally generated
 * swirl textures (NOT sampled from real photographed swatches, which would
 * need real licensed product photography — a scraping/licensing task, not a
 * code task). Each colorway is rendered ONCE per photo from a seeded
 * blotch/flow-field generator and then treated as a static texture from that
 * point on — controls never regenerate it (unlike the flake renderer, there
 * is no density/size knob for metallic in v1).
 *
 * No-tiling rewrite: this used to constrain every blob/streak to wrap
 * seamlessly at the canvas edges (paintWrappedBlob's 5-offset stamp,
 * drawFlowStreak's 5-offset stroke) because the texture was tiled via
 * gl.REPEAT across the floor. With tiling removed (see visualizer-gl.js's
 * header comment), that constraint is just dead weight — worse, it actively
 * fought the "one continuous flowing design" goal, since a streak built to
 * loop back and reappear on the opposite edge reads as two disconnected
 * fragments once you're only ever looking at ONE un-repeated copy. Removed
 * both wrap mechanisms; streaks/blobs are drawn once and naturally clipped
 * by the canvas edge, same as a real photo's framing.
 *
 * Replaces the independent-random-walk streak generator with a shared,
 * smoothly-varying flow field (see buildFlowField) that every streamline
 * samples from — nearby streaks now flow in coherent, related directions
 * instead of each wandering independently, which is what makes the result
 * read as ONE connected current/swirl rather than a handful of unrelated
 * squiggles. Verified visually against real metallic epoxy floor photos
 * (continuous, large-scale marbled "currents" with the color pooling into
 * a few dominant flow directions, not disconnected fragments).
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
 * Paints one soft radial-gradient blob. No-tiling rewrite: this used to
 * stamp the blob at 5 offset positions (the canvas plus its 4 cardinal
 * neighbors) so it would still tile seamlessly under gl.REPEAT — with
 * tiling removed there's nothing to seam-match, so a blob overlapping the
 * canvas edge is simply, naturally clipped by it (one draw instead of up to
 * 5).
 */
function paintBlob(ctx, cx, cy, r, rgb, alphaInner, alphaOuter = 0) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, rgbaStr(rgb, alphaInner));
  grad.addColorStop(1, rgbaStr(rgb, alphaOuter));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Builds a smoothly-varying pseudo-random 2D direction (angle) field over
 * [0,size]x[0,size], as a sum of a few octaves of sine waves at random
 * orientation/frequency/phase. This is what makes the "continuous swirl"
 * requirement real rather than cosmetic: every streamline drawn via
 * drawFlowStreak samples the SAME field, so streaks that pass near each
 * other bend in related directions (a shared "current") instead of each
 * wandering off on its own independent random walk — which is what a plain
 * per-streak random walk (an earlier version of this file) produces:
 * individually organic curves with no relationship to each other, reading
 * as scattered fragments rather than one connected flow once you can see
 * the whole un-tiled floor at once.
 *
 * First attempt at this used a coarse grid of random unit vectors,
 * bilinearly interpolated (a standard "flow field" construction) — verified
 * visually (scratch-flake-qa/metallic-baseline-silver.png) that this reads
 * as an unwanted "circuit board" pattern: bilinear-interpolated independent
 * random vectors create real critical points (places the field's magnitude
 * drops near zero, where two neighboring cells point close to opposite
 * ways) and a streamline that wanders near one spirals and gets trapped
 * circling it — visibly present as tight coiled loops in that render,
 * nothing like real metallic epoxy's long sweeping currents. A sum of sine
 * waves has no such critical points (it's a smooth periodic function, never
 * degenerate), so streamlines instead bend continuously and never lock into
 * a spiral — confirmed visually against
 * scratch-flake-qa/metallic-flowfield-v2-*.png.
 */
function buildFlowField(size, rand, octaves = 3) {
  const baseAngle = rand() * Math.PI * 2;
  const terms = [];
  let ampSum = 0;
  for (let i = 0; i < octaves; i++) {
    const amp = 1 / (i + 1); // higher octaves bend less, add finer wobble
    terms.push({
      freq: (i + 1) * (0.5 + rand() * 0.6), // increasing but jittered per octave
      dirAngle: rand() * Math.PI * 2, // orientation this octave's wave varies along
      phase: rand() * Math.PI * 2,
      amp,
    });
    ampSum += amp;
  }
  return function angleAt(px, py) {
    const u = px / size;
    const v = py / size;
    let sum = 0;
    for (const t of terms) {
      const proj = u * Math.cos(t.dirAngle) + v * Math.sin(t.dirAngle);
      sum += t.amp * Math.sin(proj * Math.PI * 2 * t.freq + t.phase);
    }
    // Bounded smooth bend around baseAngle — never a full-circle wrap-around
    // per step, which is what keeps streamlines from curling into a tight
    // closed loop the way the old vector-field version's critical points did.
    return baseAngle + (sum / ampSum) * Math.PI * 0.9;
  };
}

/**
 * Draws one organic "flow line": a smoothed curve that follows a shared
 * flow field (see buildFlowField) rather than an independent random walk —
 * NOT a sine wave either (the original implementation swept a fixed-period
 * sine per streak, which read as a mechanically regular repeating
 * wave/lattice once tiled; a later pass replaced that with an independent
 * random walk per streak, which fixed the mechanical-repeat problem but,
 * once un-tiled, left streaks with no relationship to each other — see
 * this module's header). Sampling a shared field instead means nearby
 * streaks bend together, which is what reads as ONE continuous current
 * rather than several unrelated squiggles. `turn` is now just a small
 * per-step jitter added on top of the field direction (keeps streaks from
 * looking like perfectly noiseless field-line traces), not the dominant
 * direction driver.
 *
 * Points are joined with quadratic curves through each pair's midpoint (the
 * standard "smooth a polyline" trick — removes the sharp corners a plain
 * lineTo chain would have at every step, without needing a real spline
 * lib). Alpha fades in/out along the streak's length via a half-sine
 * envelope (a real specular glint blooms and fades — it doesn't start/stop
 * with a hard flat-capped edge like a ruled line). The tapered core is
 * stroked in a handful of multi-point runs rather than per-tiny-segment —
 * segment-by-segment stroking left visible banding where each round-capped
 * segment's end overlapped the next one's start (a beaded/dashed look
 * instead of a smooth glint). The wide soft glow underneath stays one
 * constant-alpha continuous stroke for the same reason, at an even coarser
 * granularity (its width makes seams more visible).
 *
 * No-tiling rewrite: this used to stroke the whole path 5 times (translated
 * by [0,0] and the 4 cardinal canvas-size offsets) to tile seamlessly under
 * gl.REPEAT. Now strokes once — a real ~5x speedup on top of removing the
 * need for it — and lets a streak run off the canvas edge naturally instead
 * of forcing it to loop back into view, which is a big part of why the
 * result now reads as continuous rather than tile-shaped.
 */
function drawFlowStreak(ctx, size, rand, angleAt, { color, steps, stepLen, width, alpha, turn }) {
  const points = [[rand() * size, rand() * size]];
  let [x, y] = points[0];
  for (let i = 0; i < steps; i++) {
    const angle = angleAt(x, y) + (rand() - 0.5) * turn;
    x += Math.cos(angle) * stepLen;
    y += Math.sin(angle) * stepLen;
    points.push([x, y]);
  }

  const n = points.length;
  const bucketCount = Math.max(3, Math.round(n / 3));
  const buildPath = (start, end) => {
    ctx.beginPath();
    ctx.moveTo(points[start][0], points[start][1]);
    for (let i = start + 1; i <= end; i++) {
      const [cx, cy] = points[i - 1];
      const [nx, ny] = points[i];
      ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
    }
    ctx.lineTo(points[end][0], points[end][1]);
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Soft wide glow — single continuous stroke, flat alpha.
  buildPath(0, n - 1);
  ctx.strokeStyle = rgbaStr(color, alpha * 0.3);
  ctx.lineWidth = width * 3.2;
  ctx.stroke();

  // Crisp bright core — tapered in a handful of runs.
  for (let b = 0; b < bucketCount; b++) {
    // Runs share their boundary point with the next run so there's no
    // 1px gap between consecutive strokes.
    const start = Math.floor((b * (n - 1)) / bucketCount);
    const end = Math.floor(((b + 1) * (n - 1)) / bucketCount);
    const t = (start + end) / 2 / (n - 1);
    const envelope = Math.sin(Math.PI * t); // 0 at both ends, 1 mid-streak
    buildPath(start, end);
    ctx.strokeStyle = rgbaStr(color, alpha * envelope);
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// Baseline this design was tuned against (matches
// flake-texture-renderer.js's baseline, for the same "~450sqft/2-car-garage"
// reference room — see visualizer-gl.js's spanInches comment) — used only to
// scale blob/streak COUNT with the real floor area the caller says this
// texture covers, so a bigger room's swirl has proportionally more distinct
// features spread across it instead of the same handful stretched thin
// (which would look sparse) — see this file's renderMetallicSwatchTexture.
const BASE_SPAN_INCHES = 144;

/**
 * @param {object} spec
 * @param {number} spec.size - canvas size in px
 * @param {string} spec.colorwayId
 * @param {number} [spec.spanInches] - real-world width/height (inches) this
 *   canvas represents (see flake-texture-renderer.js's spec.spanInches doc
 *   for why this exists post-no-tiling). Defaults to BASE_SPAN_INCHES so a
 *   caller that doesn't pass it gets the original tuned feature density.
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderMetallicSwatchTexture(spec, ctx) {
  const { size, colorwayId, spanInches = BASE_SPAN_INCHES } = spec;
  const colorway = findMetallicColorway(colorwayId);
  const rand = mulberry32(
    colorway.id.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0,
  );

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = colorway.baseHex;
  ctx.fillRect(0, 0, size, size);

  const vein = hexToRgb(colorway.veinHex);
  const highlight = hexToRgb(colorway.highlightHex);

  // Real floor area scales with spanInches^2; blob/streak counts below
  // scale the same way so a bigger room gets proportionally more swirl
  // features across its proportionally bigger canvas instead of the same
  // fixed handful. Clamped to a sane range (0.6x-3x the tuned baseline
  // count) — metallic's features are large/low-frequency (unlike flake's
  // per-chip count, there's no hard perf wall here; measured well under
  // 200ms even at the upper end via @napi-rs/canvas), so this is a visual
  // clutter/consistency clamp, not a perf one.
  const areaScale = Math.min(3, Math.max(0.6, (spanInches / BASE_SPAN_INCHES) ** 2));

  // Soft organic vein blotches — large, low-opacity radial gradients.
  const blobCount = Math.round(10 * areaScale);
  for (let i = 0; i < blobCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = size * (0.18 + rand() * 0.22);
    paintBlob(ctx, cx, cy, r, vein, 0.5 + rand() * 0.2);
  }

  // Shared flow field every streak below samples from — see buildFlowField's
  // doc comment for why this is the key change that makes the result read
  // as one connected current instead of disconnected fragments. Built in
  // canvas-fraction (u,v) space, so it's resolution-independent.
  const flowField = buildFlowField(size, rand, 3);

  // A few broader mid-tone flow streaks — same shared-field mechanism as
  // the highlights below but wider, softer, and more loosely curved,
  // reading as slow-moving marbled current rather than a bright glint.
  const veinStreakCount = Math.round(4 * areaScale);
  for (let i = 0; i < veinStreakCount; i++) {
    drawFlowStreak(ctx, size, rand, flowField, {
      color: vein,
      steps: 14,
      stepLen: size * 0.08,
      width: size * 0.045,
      alpha: 0.22,
      turn: 0.5,
    });
  }

  // Bright highlight "flow line" glints — a tighter per-step jitter keeps
  // these more directional/streak-like than the vein streaks above, but
  // they still bend with the same shared field, so they read as glints
  // riding the same current rather than random glitter.
  const highlightStreakCount = Math.round(9 * areaScale);
  for (let i = 0; i < highlightStreakCount; i++) {
    drawFlowStreak(ctx, size, rand, flowField, {
      color: highlight,
      steps: 14 + Math.floor(rand() * 10), // 14-23 — vary length per streak
      stepLen: size * (0.035 + rand() * 0.02),
      width: size * 0.006,
      alpha: 0.4,
      turn: 0.35 + rand() * 0.35, // small jitter on top of the field direction
    });
  }
}
