/**
 * Instant WebGL2 floor compositor (epoxygrind-visualizer-build-spec.md
 * Part 3.4 + 3.5). Replaces the old gen-AI "paint a new floor onto the
 * photo" preview: segment once (network), then every blend/base
 * coat/density/size change is a texture swap + one draw call, zero
 * network calls.
 *
 * v1 simplifications this deliberately takes (spec Part 5):
 *  - no homography — a one-line linear vertical scale on the tile UVs
 *    stands in for full perspective (flakes read bigger near the camera).
 *  - luminance relight only, no gloss/satin specular split (ship one look).
 *  - mask edge softened with a flat 2px canvas blur, not a tuned kernel.
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
// camera) — spec 5's perspective stand-in makes tiles bigger there.
const FRAGMENT_SRC = `#version 300 es
precision mediump float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform sampler2D uShade;
uniform sampler2D uFloor;
uniform float uTileRepeat;
uniform float uWipePct;
uniform float uOpacity;

void main() {
  vec4 photoColor = texture(uPhoto, vUV);
  float m = texture(uMask, vUV).r;

  // Spec 5 perspective stand-in: flakes ~2.5x larger at mask bottom than top.
  float perspectiveScale = mix(1.0, 2.5, vUV.y);
  vec2 tiledUV = fract(vUV * (uTileRepeat / perspectiveScale));
  vec3 floorColor = texture(uFloor, tiledUV).rgb;

  // Spec 3.3: shading was normalized/packed into [0,1] client-side from the
  // clamped [0.25, 1.9] range — unpack it back out here.
  float shade = texture(uShade, vUV).r * 1.65 + 0.25;
  vec3 coated = floorColor * shade;

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

// Deliberately NOT using UNPACK_FLIP_Y_WEBGL here. The vertex quad below
// already assigns vUV.y=0 to the top of the screen and vUV.y=1 to the
// bottom (needed so the perspective mix(1.0, 2.5, vUV.y) enlarges flakes
// toward the bottom/near edge of the photo). Browser images upload with
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
};

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
    this.tileRepeat = 6;
    this.ready = false;

    this._regenTimer = null;
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
    // upload comment above) — see the perspective comment on the fragment shader.
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
      uTileRepeat: gl.getUniformLocation(this.program, 'uTileRepeat'),
      uWipePct: gl.getUniformLocation(this.program, 'uWipePct'),
      uOpacity: gl.getUniformLocation(this.program, 'uOpacity'),
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
    let data;
    const fromCache = Boolean(cachedSegmentation?.mask);
    if (fromCache) {
      data = cachedSegmentation;
    } else {
      const res = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoDataUrl }),
      });
      data = await res.json();
    }

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
      this._regenerateFloorTexture();
      this.render();
    }, REGEN_DEBOUNCE_MS);
  }

  _regenerateFloorTexture() {
    const gl = this.gl;
    const ctx = this._flakeCtx;

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

    gl.uniform1f(this.uniforms.uTileRepeat, this.tileRepeat);
    gl.uniform1f(this.uniforms.uWipePct, this.wipePct);
    gl.uniform1f(this.uniforms.uOpacity, 1);

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
