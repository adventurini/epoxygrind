/**
 * Instant WebGL2 floor compositor (epoxygrind-visualizer-build-spec.md
 * Part 3.4 + 3.5). Replaces the old gen-AI "paint a new floor onto the
 * photo" preview: segment once (network), then every blend/base
 * coat/density/size change is a texture swap + one draw call, zero
 * network calls.
 *
 * v2 additions (deferred in v1, now implemented — see spec's "Deferred to
 * v2" list):
 *  - real homography perspective (spec 3.2) replaces the old one-line
 *    linear vertical-scale stand-in. Computed once per photo, client-side,
 *    alongside the mask/luminance CPU pass in computeMaskAndShading —
 *    see computeHomographyInv() below.
 *  - gloss/satin finish toggle (spec 3.4's uFinish uniform) drives the
 *    specular highlight term; see the fragment shader's `spec` term.
 *  - manual mask-assist retry (spec 3.1) via retryWithPoints().
 *
 * Remaining v1 simplification still in place: mask edge softened with a
 * flat 2px canvas blur, not a tuned kernel.
 */
import { renderFlakeTexture, defaultSeedFor } from '/lib/flake-texture-renderer.js';
import { renderMetallicSwatchTexture } from '/lib/metallic-swatches.js';
import { resolveRenderComponents } from '/lib/flake-recipes.js';

// Spec 3.5: "cap flake texture at 1024^2" for mobile.
const FLAKE_TEXTURE_SIZE = 1024;
// Spec 2.1 / 5: "debounce slider at ~30ms."
const REGEN_DEBOUNCE_MS = 30;
// Working resolution for the one-time luminance/mask CPU pass — plenty for
// a relight signal, and capped so a big upload photo can't make this slow.
const LUMINANCE_WORK_SIZE = 720;

// Bug fix: tileRepeat used to be a flat constant (6) regardless of the
// actual floor's real-world size — a one-car-garage photo and a sprawling
// multi-room great-room photo both got exactly 6 tile repeats across the
// homography-mapped floor quad. Since each "tile" represents a fixed real
// -world footprint (the flake/metallic texture is generated to represent a
// roughly TILE_INCHES-wide swatch — see flake-texture-renderer.js), a floor
// spanning much more real square footage needs proportionally MORE repeats
// to keep the apparent flake/tile size visually consistent — otherwise a
// big floor reads as an obviously coarse, mechanically-repeating lattice
// (confirmed via screenshot on a multi-room house photo: a clear repeating
// diamond/quatrefoil artifact). BASE_TILE_REPEAT=6 is the value already
// tuned/tested against a ~2-car-garage-sized floor; scale by sqrt(sqFt)
// relative to that baseline (area scales with the square of linear size, so
// sqrt(area ratio) approximates the linear scale-up needed) and clamp to a
// sane range so a tiny or huge sqFt value can never make the tiling
// degenerate.
const BASE_TILE_REPEAT = 6;
const BASE_SQFT = 450; // ~2-car garage — matches BASE_TILE_REPEAT's existing tuning
const MIN_TILE_REPEAT = 4;
const MAX_TILE_REPEAT = 24; // headroom for large commercial spaces

const VERTEX_SRC = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// vUV.y runs 0 (top of photo) -> 1 (bottom of photo). Floors are photographed
// from above/across, so the bottom of the frame is the near edge (closer to
// camera) — the homography below maps a quad fit to the mask (narrower at
// the top/far edge, wider at the bottom/near edge) onto the flake texture's
// unit-square UV space, so tiles read larger near the camera.
const FRAGMENT_SRC = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform sampler2D uShade;
uniform sampler2D uFloor;
uniform mat3 uHomographyInv;
uniform float uTileRepeat;
uniform float uWipePct;
uniform float uOpacity;
uniform float uFinish; // 1.0 = gloss, 0.0 = satin (spec 3.4)

void main() {
  vec4 photoColor = texture(uPhoto, vUV);
  float m = texture(uMask, vUV).r;

  // Spec 3.2: homography-correct tile lookup, replacing the old one-line
  // linear vertical-scale stand-in. uHomographyInv maps this photo-space UV
  // back into the flake texture's unit-square UV space through the quad
  // fit to the mask's top/bottom extremes (computed once per photo,
  // client-side — see computeHomographyInv in this file).
  vec3 hUV = uHomographyInv * vec3(vUV, 1.0);
  // Guard the perspective divide — hUV.z can get close to 0 for UVs well
  // outside the fitted quad (e.g. photo corners the floor mask excludes
  // anyway); clamp its magnitude so fract() below always sees a finite value.
  float wComp = hUV.z >= 0.0 ? max(hUV.z, 1e-4) : min(hUV.z, -1e-4);
  vec2 floorUV = hUV.xy / wComp;
  vec2 tiledUV = fract(floorUV * uTileRepeat);
  vec3 floorColor = texture(uFloor, tiledUV).rgb;

  // Spec 3.3: shading was normalized/packed into [0,1] client-side from the
  // clamped [0.25, 1.9] range — unpack it back out here.
  float shade = texture(uShade, vUV).r * 1.65 + 0.25;
  vec3 coated = floorColor * shade;

  // Spec 3.4: gloss/satin specular highlight — brighter, tighter highlight
  // for gloss (epoxy's actual look, default), softer for satin.
  float spec = smoothstep(1.25, 1.75, shade) * mix(0.12, 0.35, uFinish);
  coated = coated + vec3(spec);

  vec3 composited = mix(photoColor.rgb, coated, m * uOpacity);

  // Before/after wipe (reuses the existing before/after slider's pct
  // semantics: left of the handle shows the original "before" photo).
  float showBefore = step(vUV.x, uWipePct);
  vec3 finalColor = mix(composited, photoColor.rgb, showBefore);

  outColor = vec4(finalColor, 1.0);
}`;

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // A saved estimate's originalImage is a cross-origin Supabase Storage
    // signed URL (lib/estimate-storage.js's hydrateEstimateImages), not the
    // inline data: URL a brand-new upload is. Without crossOrigin set, an
    // image loaded from that URL taints this canvas — computeMaskAndShading's
    // getImageData() (and the WebGL texture upload below) then throws
    // SecurityError, silently breaking the entire visualizer for every
    // estimate that's ever been reloaded from storage. Harmless to set for
    // the mask image too (always a data: URL) — browsers ignore crossOrigin
    // on non-network sources.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = src;
  });
}

/**
 * One-time (per photo) CPU pass: builds a blurred single-channel mask
 * buffer and a normalized luminance-relight buffer over the masked region.
 * Spec 3.3 + 3.4's "feather the mask edge 2-3px" and luminance extraction.
 */
function computeMaskAndShading(photoImg, maskImg) {
  const aspect = photoImg.naturalHeight / photoImg.naturalWidth;
  const w = Math.min(LUMINANCE_WORK_SIZE, photoImg.naturalWidth);
  const h = Math.round(w * aspect);

  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = w;
  photoCanvas.height = h;
  const photoCtx = photoCanvas.getContext('2d');
  photoCtx.drawImage(photoImg, 0, 0, w, h);
  const photoData = photoCtx.getImageData(0, 0, w, h).data;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  // Spec: "simple 2px blur, no tuning" on the mask edge.
  if ('filter' in maskCtx) maskCtx.filter = 'blur(2px)';
  maskCtx.drawImage(maskImg, 0, 0, w, h);
  const maskData = maskCtx.getImageData(0, 0, w, h).data;

  const pixelCount = w * h;
  const maskBuffer = new Uint8Array(pixelCount);
  const lumBuffer = new Float32Array(pixelCount);

  let weightedLumSum = 0;
  let weightSum = 0;
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    const maskVal = maskData[p]; // grayscale mask: R=G=B
    maskBuffer[i] = maskVal;
    const lum = 0.299 * photoData[p] + 0.587 * photoData[p + 1] + 0.114 * photoData[p + 2];
    lumBuffer[i] = lum;
    const weight = maskVal / 255;
    weightedLumSum += lum * weight;
    weightSum += weight;
  }

  const mu = weightSum > 0 ? weightedLumSum / weightSum : 128;
  const shadeBuffer = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const shading = Math.min(1.9, Math.max(0.25, lumBuffer[i] / mu));
    shadeBuffer[i] = Math.round(((shading - 0.25) / 1.65) * 255);
  }

  return { width: w, height: h, maskBuffer, shadeBuffer };
}

// --- Spec 3.2: homography perspective (v2) ---------------------------------
// "Fit a quad to the mask's convex hull extremes (leftmost/rightmost points
// at mask top edge and bottom edge). Derive a homography mapping the flake
// texture's UV space onto that quad... Clamp the foreshortening ratio to
// [1.5, 4] to avoid degenerate quads." Runs once per photo, alongside the
// computeMaskAndShading CPU pass above — NOT per frame.

const MASK_HULL_THRESHOLD = 40; // maskBuffer value (0-255) counted as "floor"
const MASK_HULL_MIN_ROW_HITS = 3; // ignore rows that are just blur/noise flecks
const MASK_HULL_BAND_FRAC = 0.05; // average extent over this fraction of mask height, for stability against single-row noise
const FORESHORTEN_MIN = 1.5;
const FORESHORTEN_MAX = 4;
const IDENTITY_MAT3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Leftmost/rightmost mask-pixel x for one row, or null if the row has
 * fewer than MASK_HULL_MIN_ROW_HITS floor pixels (noise, not a real edge). */
function maskRowExtent(maskBuffer, w, y) {
  const rowStart = y * w;
  let minX = -1;
  let maxX = -1;
  for (let x = 0; x < w; x++) {
    if (maskBuffer[rowStart + x] > MASK_HULL_THRESHOLD) {
      if (minX === -1) minX = x;
      maxX = x;
    }
  }
  return minX !== -1 && maxX - minX + 1 >= MASK_HULL_MIN_ROW_HITS ? { minX, maxX } : null;
}

/** First and last mask rows (top-of-frame to bottom-of-frame) that contain
 * a real floor extent. */
function findMaskVerticalBounds(maskBuffer, w, h) {
  let topY = -1;
  let bottomY = -1;
  for (let y = 0; y < h; y++) {
    if (maskRowExtent(maskBuffer, w, y)) { topY = y; break; }
  }
  for (let y = h - 1; y >= 0; y--) {
    if (maskRowExtent(maskBuffer, w, y)) { bottomY = y; break; }
  }
  return { topY, bottomY };
}

/** Averages the mask's left/right extent over a small band of rows starting
 * at `edgeY` and moving toward `towardY`, so the quad's corners aren't
 * decided by a single noisy row at the very top/bottom of the mask. */
function averageEdgeExtent(maskBuffer, w, h, edgeY, towardY) {
  const bandRows = Math.max(1, Math.round(h * MASK_HULL_BAND_FRAC));
  const dir = towardY >= edgeY ? 1 : -1;
  let sumMin = 0;
  let sumMax = 0;
  let n = 0;
  for (let i = 0; i < bandRows; i++) {
    const y = edgeY + i * dir;
    if (y < 0 || y >= h) break;
    const ext = maskRowExtent(maskBuffer, w, y);
    if (ext) {
      sumMin += ext.minX;
      sumMax += ext.maxX;
      n++;
    }
  }
  return n === 0 ? null : { minX: sumMin / n, maxX: sumMax / n };
}

/**
 * Classic "square-to-quad" projective mapping (Heckbert, "Fundamentals of
 * Texture Mapping and Image Warping", 1989): the forward homography H
 * mapping the unit square (0,0)->(1,0)->(1,1)->(0,1) onto quad corners
 * p0->p1->p2->p3 given in that same traversal order. Returned as a
 * row-major 9-array [a,b,c, d,e,f, g,h,1] such that, for homogeneous
 * [x,y,w] = H * [u,v,1]: x = x/w, y = y/w gives the mapped point.
 */
function squareToQuadMatrix(p0, p1, p2, p3) {
  const dx1 = p1.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dx2 = p3.x - p2.x;
  const dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  const denom = dx1 * dy2 - dx2 * dy1;

  let g = 0;
  let h = 0;
  if (Math.abs(denom) > 1e-9) {
    g = (sx * dy2 - dx2 * sy) / denom;
    h = (dx1 * sy - sx * dy1) / denom;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;
  return [a, b, c, d, e, f, g, h, 1];
}

/** General 3x3 matrix inverse via the cofactor/adjugate method (row-major
 * in, row-major out). Falls back to identity if numerically singular —
 * this only happens for a degenerate quad the FORESHORTEN clamp couldn't
 * fully prevent (e.g. near-zero mask height). */
function invertMat3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const invDet = 1 / det;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  return [A * invDet, D * invDet, G * invDet, B * invDet, E * invDet, H * invDet, C * invDet, F * invDet, I * invDet];
}

/** Row-major math matrix -> WebGL's column-major mat3 uniform layout
 * (gl.uniformMatrix3fv requires transpose=false, i.e. pre-transposed data). */
function toColumnMajorFloat32(rowMajor) {
  const [a, b, c, d, e, f, g, h, i] = rowMajor;
  return new Float32Array([a, d, g, b, e, h, c, f, i]);
}

/**
 * Computes the inverse homography (photo UV -> flake-texture UV) the
 * fragment shader uses to sample the floor texture with perspective
 * foreshortening. Identity (no correction) is returned for masks too small
 * or malformed to fit a sane quad to — safe fallback, never throws.
 * @param {Uint8Array} maskBuffer
 * @param {number} w
 * @param {number} h
 * @returns {Float32Array} column-major 3x3 matrix for gl.uniformMatrix3fv
 */
function computeHomographyInv(maskBuffer, w, h) {
  const { topY, bottomY } = findMaskVerticalBounds(maskBuffer, w, h);
  if (topY < 0 || bottomY < 0 || bottomY - topY < 4) return IDENTITY_MAT3;

  const topExt = averageEdgeExtent(maskBuffer, w, h, topY, bottomY);
  const botExt = averageEdgeExtent(maskBuffer, w, h, bottomY, topY);
  if (!topExt || !botExt) return IDENTITY_MAT3;

  let topLeftX = topExt.minX / w;
  let topRightX = topExt.maxX / w;
  const botLeftX = botExt.minX / w;
  const botRightX = botExt.maxX / w;
  const topYNorm = topY / h;
  const botYNorm = bottomY / h;

  const topWidth = Math.max(1e-4, topRightX - topLeftX);
  const botWidth = Math.max(1e-4, botRightX - botLeftX);
  // Clamp how much narrower the far edge can be than the near edge — this
  // is what keeps a degenerate quad (near-zero top width from mask noise,
  // or an oddly-shaped mask) from producing wild texture magnification,
  // regardless of what the raw mask geometry happens to measure.
  const ratio = Math.min(FORESHORTEN_MAX, Math.max(FORESHORTEN_MIN, botWidth / topWidth));
  const topCenter = (topLeftX + topRightX) / 2;
  const clampedTopWidth = botWidth / ratio;
  topLeftX = topCenter - clampedTopWidth / 2;
  topRightX = topCenter + clampedTopWidth / 2;

  // Unit-square corners (0,0)/(1,0)/(1,1)/(0,1) -> quad corners in the same
  // traversal order: top-left, top-right, bottom-right, bottom-left.
  const p0 = { x: topLeftX, y: topYNorm };
  const p1 = { x: topRightX, y: topYNorm };
  const p2 = { x: botRightX, y: botYNorm };
  const p3 = { x: botLeftX, y: botYNorm };

  const forward = squareToQuadMatrix(p0, p1, p2, p3);
  const inverse = invertMat3(forward);
  return toColumnMajorFloat32(inverse);
}

// Deliberately NOT using UNPACK_FLIP_Y_WEBGL here. The vertex quad below
// already assigns vUV.y=0 to the top of the screen and vUV.y=1 to the
// bottom (needed so the mask's top/bottom edges — and therefore the
// homography quad fit to them — line up correctly). Browser images upload with
// row 0 = the image's visual top row by default, which already lines up
// with that mapping — flipping would sample the image upside down against
// this particular quad (confirmed visually: with flip on, the garage
// door/wall rendered at the bottom of the canvas and the floor at the top).
function createR8Texture(gl, width, height, data) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createImageTexture(gl, image, { repeat = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  if (repeat) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  return tex;
}

const DEFAULT_SPEC = {
  mode: 'flake', // 'flake' | 'solid' | 'metallic'
  blendId: 'gravel',
  customComponents: null,
  baseCoatHex: '#8A8F98',
  density: 1,
  flakeSizeIn: 0.25,
  metallicId: 'silver-pearl',
  // Spec 3.4/1.1: gloss vs satin finish. Gloss is the default — it matches
  // epoxy's actual look. Purely a shader uniform; never touches the flake
  // texture, so changing it doesn't need a texture regeneration.
  sheen: 'gloss', // 'gloss' | 'satin'
};

/** Subset of `spec` that actually changes the generated flake-texture
 * canvas — used to skip regenerating it when only `sheen` (or some other
 * shader-only field) changed. */
function textureKeyFor(spec) {
  return JSON.stringify([
    spec.mode, spec.blendId, spec.customComponents, spec.baseCoatHex,
    spec.density, spec.flakeSizeIn, spec.metallicId,
  ]);
}

export class FloorVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      powerPreference: 'low-power',
      antialias: false,
      alpha: false,
      // toBlob()/toDataURL() need the drawing buffer to still be there
      // whenever we call them — we render on demand, not every frame, so
      // there's no meaningful perf cost to keeping it.
      preserveDrawingBuffer: true,
    });
    if (!this.gl) throw new Error('WebGL2 is not supported in this browser.');

    this.spec = { ...DEFAULT_SPEC };
    this.seed = defaultSeedFor(this.spec.density, this.spec.flakeSizeIn);
    this.wipePct = 0.5;
    // Default matches BASE_TILE_REPEAT/BASE_SQFT until a real sqFt is known
    // (see setSqFt) — same value this constant always held before the fix,
    // so a caller that never calls setSqFt gets the old, already-tuned
    // behavior.
    this.tileRepeat = BASE_TILE_REPEAT;
    this.ready = false;
    // Spec 3.2: identity (no correction) until a photo's mask produces a
    // real quad fit — see computeHomographyInv, wired in _applySegmentedResult.
    this.homographyInv = IDENTITY_MAT3;

    this._regenTimer = null;
    this._lastTextureKey = null;
    this._photoDataUrl = null;
    this._flakeCanvas = document.createElement('canvas');
    this._flakeCanvas.width = FLAKE_TEXTURE_SIZE;
    this._flakeCanvas.height = FLAKE_TEXTURE_SIZE;
    this._flakeCtx = this._flakeCanvas.getContext('2d');

    this._initGl();
  }

  _initGl() {
    const gl = this.gl;
    this.program = linkProgram(gl, VERTEX_SRC, FRAGMENT_SRC);

    // Full-screen quad. UVs chosen so vUV.y=0 is the TOP of the source
    // image and 1 is the bottom (no UNPACK_FLIP_Y_WEBGL — see the texture
    // upload comment above) — matches the homography's mask-top/mask-bottom
    // quad fit (see computeHomographyInv above the texture helpers).
    const quad = new Float32Array([
      // x,    y,    u, v
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      1, 1, 1, 0,
    ]);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, 'aPosition');
    const uvLoc = gl.getAttribLocation(this.program, 'aUV');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    this.uniforms = {
      uPhoto: gl.getUniformLocation(this.program, 'uPhoto'),
      uMask: gl.getUniformLocation(this.program, 'uMask'),
      uShade: gl.getUniformLocation(this.program, 'uShade'),
      uFloor: gl.getUniformLocation(this.program, 'uFloor'),
      uHomographyInv: gl.getUniformLocation(this.program, 'uHomographyInv'),
      uTileRepeat: gl.getUniformLocation(this.program, 'uTileRepeat'),
      uWipePct: gl.getUniformLocation(this.program, 'uWipePct'),
      uOpacity: gl.getUniformLocation(this.program, 'uOpacity'),
      uFinish: gl.getUniformLocation(this.program, 'uFinish'),
    };
  }

  _resizeCanvasToDisplaySize() {
    const gl = this.gl;
    // Mobile perf cap (spec 3.5): never render at more than ~1000px wide
    // regardless of devicePixelRatio — this is a photo composite, not a
    // typography surface, extra pixels here are wasted fill-rate on phones.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const displayWidth = Math.round(this.canvas.clientWidth * dpr);
    const displayHeight = Math.round(this.canvas.clientHeight * dpr);
    const cappedWidth = Math.min(displayWidth, 1000);
    const cappedHeight = Math.round(cappedWidth * (displayHeight / displayWidth || 1));
    if (this.canvas.width !== cappedWidth || this.canvas.height !== cappedHeight) {
      this.canvas.width = cappedWidth || 1;
      this.canvas.height = cappedHeight || 1;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Runs the full pipeline for a new photo: segmentation (network, ~2-3s),
   * then the one-time luminance/mask CPU pass. Everything after this is
   * network-free per spec 3.5.
   *
   * Caching (spec Part 5 build-order item — persist the mask per estimate):
   * an owner reopening the same estimate's page shouldn't pay for a fresh
   * fal.ai segmentation call every time. Pass a previously-persisted
   * segmentation result as `cachedSegmentation` (shape matches /api/segment's
   * response: `{mask, confidence, maskAreaPct, needsManualAssist, reason}`)
   * and this skips the network call entirely, reusing the stored mask. The
   * caller (calculator/estimate-view.js's wireVisualizer) is responsible for
   * only supplying a cached result when it still matches the current photo.
   * @param {string} photoDataUrl
   * @param {{mask:string, confidence:number|null, maskAreaPct:number|null}|null} [cachedSegmentation]
   * @returns {Promise<{needsManualAssist: boolean, reason: string|null, confidence: number|null, segmentation: object|null}>}
   */
  async loadPhoto(photoDataUrl, cachedSegmentation = null) {
    this.ready = false;
    this._photoDataUrl = photoDataUrl;
    const fromCache = Boolean(cachedSegmentation?.mask);
    const data = fromCache ? cachedSegmentation : await this._requestSegmentation(photoDataUrl);
    return this._applySegmentedResult(photoDataUrl, data, fromCache);
  }

  /**
   * Manual mask-assist retry (spec 3.1's deferred fallback, now built): the
   * user tapped 2-3 points on their own floor in the uploaded photo; this
   * re-prompts segmentation with those points instead of the automatic box.
   * See api/segment.js's optional `points` body field and
   * lib/segment-fal.js's pointsToBox — verified live against fal.ai that its
   * hosted SAM 3 model silently ignores point_prompts entirely (identical
   * mask returned regardless of point location, even a point on a wall), so
   * taps still resolve server-side to a single enclosing box_prompts call.
   * @param {Array<{x:number, y:number}>} points - normalized [0,1] image coords
   * @returns {Promise<{needsManualAssist: boolean, reason: string|null, confidence: number|null, segmentation: object|null}>}
   */
  async retryWithPoints(points) {
    if (!this._photoDataUrl) throw new Error('No photo loaded yet.');
    const data = await this._requestSegmentation(this._photoDataUrl, points);
    return this._applySegmentedResult(this._photoDataUrl, data, false);
  }

  async _requestSegmentation(photoDataUrl, points = null) {
    const res = await fetch('/api/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(points && points.length ? { image: photoDataUrl, points } : { image: photoDataUrl }),
    });
    return res.json();
  }

  /** Shared finishing steps for both a fresh/cached segmentation
   * (loadPhoto) and a manual-assist retry (retryWithPoints): validate the
   * response, run the one-time mask/luminance/homography CPU pass, upload
   * textures, and render. */
  async _applySegmentedResult(photoDataUrl, data, fromCache) {
    if (!data.mask || data.needsManualAssist) {
      return {
        needsManualAssist: true,
        reason: data.reason || null,
        confidence: data.confidence ?? null,
        segmentation: null,
      };
    }

    const [photoImg, maskImg] = await Promise.all([loadImage(photoDataUrl), loadImage(data.mask)]);
    const { width, height, maskBuffer, shadeBuffer } = computeMaskAndShading(photoImg, maskImg);
    // Spec 3.2: computed once per photo, alongside the mask/luminance pass
    // above — not per frame.
    this.homographyInv = computeHomographyInv(maskBuffer, width, height);

    const gl = this.gl;
    this._disposeTexture(this.photoTex);
    this._disposeTexture(this.maskTex);
    this._disposeTexture(this.shadeTex);
    this.photoTex = createImageTexture(gl, photoImg, { repeat: false });
    this.maskTex = createR8Texture(gl, width, height, maskBuffer);
    this.shadeTex = createR8Texture(gl, width, height, shadeBuffer);

    this.canvas.style.aspectRatio = `${photoImg.naturalWidth} / ${photoImg.naturalHeight}`;
    this._resizeCanvasToDisplaySize();
    this._regenerateFloorTexture();
    this.ready = true;
    this.render();

    return {
      needsManualAssist: false,
      reason: null,
      confidence: data.confidence ?? null,
      // Only hand back a fresh cache entry when this call actually hit the
      // network — re-persisting an unchanged cached result would just
      // rewrite the same data on every page load.
      segmentation: fromCache
        ? null
        : {
            mask: data.mask,
            confidence: data.confidence ?? null,
            maskAreaPct: data.maskAreaPct ?? null,
            needsManualAssist: false,
            reason: null,
          },
    };
  }

  _disposeTexture(tex) {
    if (tex) this.gl.deleteTexture(tex);
  }

  /** Merge partial FloorSpec fields, regenerate the floor texture
   * (debounced per spec 2.1/5), and re-render. Never touches the network. */
  setSpec(partial) {
    const prevKey = `${this.spec.density}:${this.spec.flakeSizeIn}`;
    this.spec = { ...this.spec, ...partial };
    const nextKey = `${this.spec.density}:${this.spec.flakeSizeIn}`;
    // Stable seed across a (density, flakeSize) pair so re-rolling only
    // color never reshuffles flake positions (spec 2.2/5's "must not
    // reshuffle" requirement).
    if (prevKey !== nextKey) this.seed = defaultSeedFor(this.spec.density, this.spec.flakeSizeIn);

    if (this._regenTimer) clearTimeout(this._regenTimer);
    this._regenTimer = setTimeout(() => {
      // `sheen` (gloss/satin, spec 3.4) is a shader uniform only — it never
      // touches the generated flake-texture canvas, so skip the ~20-50ms
      // regen when nothing texture-affecting actually changed (e.g. the
      // finish toggle was the only thing flipped).
      if (textureKeyFor(this.spec) !== this._lastTextureKey) this._regenerateFloorTexture();
      this.render();
    }, REGEN_DEBOUNCE_MS);
  }

  _regenerateFloorTexture() {
    const gl = this.gl;
    const ctx = this._flakeCtx;
    this._lastTextureKey = textureKeyFor(this.spec);

    if (this.spec.mode === 'metallic') {
      renderMetallicSwatchTexture({ size: FLAKE_TEXTURE_SIZE, colorwayId: this.spec.metallicId }, ctx);
    } else {
      const components =
        this.spec.mode === 'solid'
          ? []
          : resolveRenderComponents({
              blendId: this.spec.blendId,
              customComponents: this.spec.customComponents,
            });
      renderFlakeTexture(
        {
          size: FLAKE_TEXTURE_SIZE,
          baseCoatHex: this.spec.baseCoatHex,
          components,
          // Spec mapping table: solid color epoxy = base coat only, density 0.
          density: this.spec.mode === 'solid' ? 0 : this.spec.density,
          flakeSizeIn: this.spec.flakeSizeIn,
          seed: this.seed,
        },
        ctx,
      );
    }

    this._disposeTexture(this.floorTex);
    this.floorTex = createImageTexture(gl, this._flakeCanvas, { repeat: true });
  }

  setWipePct(pct) {
    this.wipePct = Math.min(1, Math.max(0, pct));
    this.render();
  }

  /**
   * Scales tileRepeat to the room's actual estimated square footage, so the
   * apparent flake/tile size in the photo stays visually consistent whether
   * the floor is a one-car garage or a sprawling multi-room great room (see
   * this file's BASE_TILE_REPEAT/BASE_SQFT comment). Area scales with the
   * square of linear size, so sqrt(sqFt/BASE_SQFT) approximates how much
   * bigger the room is *linearly* relative to the already-tuned baseline —
   * that's the factor tileRepeat should scale by. Safe to call before a
   * photo is loaded (just updates the value used on the next render) and
   * with any junk input (falls back to the baseline).
   * @param {number} sqFt
   */
  setSqFt(sqFt) {
    const area = Number(sqFt) > 0 ? Number(sqFt) : BASE_SQFT;
    const scaled = BASE_TILE_REPEAT * Math.sqrt(area / BASE_SQFT);
    this.tileRepeat = Math.min(MAX_TILE_REPEAT, Math.max(MIN_TILE_REPEAT, scaled));
    if (this.ready) this.render();
  }

  /** Render-on-demand (spec 3.5) — called only when a control, photo, or
   * wipe position actually changes, never on an RAF loop. */
  render() {
    if (!this.ready) return;
    const gl = this.gl;
    this._resizeCanvasToDisplaySize();

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.uniform1i(this.uniforms.uPhoto, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.uniform1i(this.uniforms.uMask, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.shadeTex);
    gl.uniform1i(this.uniforms.uShade, 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.floorTex);
    gl.uniform1i(this.uniforms.uFloor, 3);

    gl.uniformMatrix3fv(this.uniforms.uHomographyInv, false, this.homographyInv);
    gl.uniform1f(this.uniforms.uTileRepeat, this.tileRepeat);
    gl.uniform1f(this.uniforms.uWipePct, this.wipePct);
    gl.uniform1f(this.uniforms.uOpacity, 1);
    gl.uniform1f(this.uniforms.uFinish, this.spec.sheen === 'satin' ? 0 : 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /** @returns {Promise<Blob>} */
  toBlob(type = 'image/jpeg', quality = 0.85) {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), type, quality);
    });
  }

  dispose() {
    if (this._regenTimer) clearTimeout(this._regenTimer);
    const gl = this.gl;
    [this.photoTex, this.maskTex, this.shadeTex, this.floorTex].forEach((t) => this._disposeTexture(t));
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
  }
}
