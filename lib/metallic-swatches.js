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
 * Paints one soft radial-gradient blob, wrapped at up to 5 offset positions
 * ([0,0] plus the 4 cardinal neighbors) so a blob that overlaps a canvas
 * edge still tiles seamlessly once the texture is sampled with gl.REPEAT —
 * the same trick the original blob layer used, pulled out so the flow
 * streaks below can reuse it.
 */
function paintWrappedBlob(ctx, size, cx, cy, r, rgb, alphaInner, alphaOuter = 0) {
  for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
    const gx = cx + dx;
    const gy = cy + dy;
    if (gx + r < 0 || gx - r > size || gy + r < 0 || gy - r > size) continue;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    grad.addColorStop(0, rgbaStr(rgb, alphaInner));
    grad.addColorStop(1, rgbaStr(rgb, alphaOuter));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws one organic "flow line" as a smoothed random-walk curve — NOT a
 * sine wave. The original implementation swept `y + sin((x/size)*2π + i)*amp`
 * for every streak: exactly one full sine period across the tile width,
 * varying only by a phase shift between streaks. That's mechanically
 * regular and reads as an obvious repeating wave/lattice the instant the
 * texture tiles via gl.REPEAT — confirmed visually, and true for every
 * colorway since they all use the same generator. A random walk has no
 * period at all, so no two streaks (and no two colorways) ever line up into
 * a lattice. `turn` controls how tightly it meanders (small = long flowing
 * streak, large = tight curl).
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
 * Tiling: the whole path is stroked 5 times, translated by [0,0] and the 4
 * cardinal canvas-size offsets. Any translated copy that lands outside the
 * canvas is simply clipped by it — same effect as the per-blob wrap used
 * elsewhere, applied to a whole path instead of a single point.
 */
function drawFlowStreak(ctx, size, rand, { color, steps, stepLen, width, alpha, turn }) {
  const points = [[rand() * size, rand() * size]];
  let angle = rand() * Math.PI * 2;
  let [x, y] = points[0];
  for (let i = 0; i < steps; i++) {
    angle += (rand() - 0.5) * turn;
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

  for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
    ctx.save();
    ctx.translate(dx, dy);
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
    ctx.restore();
  }
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
    paintWrappedBlob(ctx, size, cx, cy, r, vein, 0.5 + rand() * 0.2);
  }

  // A few broader mid-tone flow streaks — same random-walk mechanism as the
  // highlights below but wider, softer, and more loosely curved, reading as
  // slow-moving marbled current rather than a bright glint.
  const veinStreakCount = 4;
  for (let i = 0; i < veinStreakCount; i++) {
    drawFlowStreak(ctx, size, rand, {
      color: vein,
      steps: 10,
      stepLen: size * 0.08,
      width: size * 0.045,
      alpha: 0.22,
      turn: 1.5,
    });
  }

  // Bright highlight "flow line" glints — replaces the old fixed-frequency
  // sine streaks. A tighter turn angle keeps these more directional/streak
  // -like than the vein streaks above, but the path itself is a random walk
  // with no period, so nothing repeats.
  const highlightStreakCount = 9;
  for (let i = 0; i < highlightStreakCount; i++) {
    drawFlowStreak(ctx, size, rand, {
      color: highlight,
      steps: 10 + Math.floor(rand() * 8), // 10-17 — vary length per streak
      stepLen: size * (0.035 + rand() * 0.02),
      width: size * 0.006,
      alpha: 0.4,
      turn: 0.85 + rand() * 0.6, // 0.85-1.45 — noticeably curled, no long straight diagonals
    });
  }
}
