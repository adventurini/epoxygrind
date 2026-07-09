import { initBeforeAfterSlider } from './before-after-slider.js';
import { renderDesignEditor } from './design-editor.js';
import { FloorVisualizer } from './visualizer-gl.js';
import { renderVisualizerControls, findBaseCoat, BASE_COAT_PALETTE } from './visualizer-controls.js';
import { renderMaskAssist } from './visualizer-mask-assist.js';
import { track } from './analytics.js';
import { previewsNeedGeneration } from '/lib/preview-status.js';

// Re-exported (not defined here) so api/estimates.js — a server-side
// Vercel function — can import previewsNeedGeneration without pulling in
// this file's browser-only WebGL visualizer imports above. See
// lib/preview-status.js's doc comment for what broke when it lived here.
export { previewsNeedGeneration };

export function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The vision model occasionally returns spaceType as a raw enum-style
 * string (e.g. "commercial_or_industrial_space") instead of a natural
 * phrase. Only reformat strings that actually look like that — snake_case
 * or all-caps — so a well-formed phrase from the model passes through
 * untouched.
 */
export function humanizeLabel(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  const looksLikeEnum = /_/.test(str) || str === str.toUpperCase();
  if (!looksLikeEnum) return str;
  const spaced = str.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 28;

export function previewLoadingHtml(caption) {
  return `<div class="preview-card preview-loading">
    <div class="preview-progress-ring" data-preview-progress-ring>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="none" stroke-width="6" class="preview-progress-track"></circle>
        <circle cx="32" cy="32" r="28" fill="none" stroke-width="6" stroke-linecap="round"
          stroke-dasharray="${PROGRESS_RING_CIRCUMFERENCE}" stroke-dashoffset="${PROGRESS_RING_CIRCUMFERENCE}"
          transform="rotate(-90 32 32)" class="preview-progress-fill" data-preview-progress-fill></circle>
      </svg>
      <span class="preview-progress-pct" data-preview-progress-pct>0%</span>
    </div>
    <div class="cap">${escapeHtml(caption)}</div>
  </div>`;
}

export function estimatePayload(data) {
  return {
    analysis: data.analysis,
    pricing: data.pricing,
    design: data.design,
    meta: data.meta,
    previewContext: data.previewContext || null,
    previews: (data.previews || []).map(({ id, label, image }) => ({ id, label, image })),
    originalImage: data.originalImage,
    customerName: data.customerName || '',
    email: data.email || data.meta?.email || '',
    location: data.location || data.meta?.location || '',
    // Extra visualizer state (blend/base coat/density/size/metallic
    // colorway) that doesn't fit lib/finish-design.js's resolveDesign()
    // shape — kept as its own top-level field rather than overloading
    // `design` so pricing.js/finish-design.js stay untouched.
    floorSpec: data.floorSpec || null,
    // The rendered composite (canvas.toBlob -> data URL), persisted so a
    // contractor viewing a shared link sees exactly what the homeowner
    // configured (visualizer-build-spec Part 4), without re-running
    // segmentation on their end.
    visualizerResult: data.visualizerResult || null,
    // Cached /api/segment result (mask + confidence/maskAreaPct), keyed to
    // the photo it was computed from — see photoFingerprint() below. Lets a
    // repeat page load skip the fal.ai segmentation call entirely instead of
    // re-running it on every visit to the owner's estimate page.
    segmentation: data.segmentation || null,
  };
}

/**
 * Cheap same-photo fingerprint for the persisted segmentation-mask cache.
 * Once an estimate is saved its photo never changes in place (no
 * re-upload-into-existing-estimate flow exists today), so `originalImagePath`
 * — the stable Supabase Storage path — is the right cache key when present.
 * Falls back to a length+sample fingerprint of the inline data URL for
 * estimates that never got a storage path (demo/session-only mode), which
 * avoids hashing what can be a multi-megabyte string on every page load.
 */
export function photoFingerprint(data) {
  if (data.originalImagePath) return `path:${data.originalImagePath}`;
  const img = data.originalImage || '';
  if (img.length < 128) return `inline:${img}`;
  return `inline:${img.length}:${img.slice(32, 96)}:${img.slice(-64)}`;
}

/**
 * Class names here mirror the hero slider's markup (calculator/before-after-slider.js
 * + home.css): the unclipped base layer is always "ba-before" and the clipped
 * overlay revealed from the left is always "ba-after", regardless of which
 * photo is semantically before/after — swap the src, not the classes.
 */
export function beforeAfterHtml(beforeImage, afterImage, opts = {}) {
  const id = opts.id || 'estimateBaSlider';
  return `
    <div class="ba-slider est-ba-slider" id="${id}" role="slider" tabindex="0" aria-label="Drag to compare your photo and the new floor" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
      <div class="ba-slider-frame">
        <img class="ba-img ba-before" src="${afterImage}" alt="New floor preview" draggable="false">
        <div class="ba-after-wrap">
          <img class="ba-img ba-after" src="${beforeImage}" alt="Uploaded photo" draggable="false">
        </div>
        <span class="ba-chip ba-chip-before">Before</span>
        <span class="ba-chip ba-chip-after">After</span>
        <div class="ba-divider">
          <div class="ba-handle">
            <span class="ba-handle-visible">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
          </div>
        </div>
      </div>
    </div>`;
}

function designEditorControlsHtml(opts = {}) {
  if (!opts.allowEdit) return '';
  return `<div class="design-editor-toggle-row">
      <button type="button" class="btn btn-o btn-sm" data-role="toggle-design-editor">Change color, finish, or pattern</button>
    </div>
    <div data-role="design-editor-mount" hidden></div>`;
}

/** Thumbnail strip of past generated versions so a user who doesn't like
 * the current render can compare against earlier attempts instead of only
 * ever seeing the latest one. In-memory for the current viewing session. */
function historyThumbnailsHtml(opts = {}) {
  const history = opts.previewHistory || [];
  if (history.length < 2) return '';
  return `<div class="preview-history">
    <p class="label">Your generated versions — click to compare</p>
    <div class="preview-history-strip">
      ${history.map((item, i) => `<button type="button" class="preview-history-thumb${i === (opts.activeHistoryIndex ?? 0) ? ' on' : ''}" data-index="${i}" style="background-image:url('${item.image}')" title="Version ${history.length - i}" aria-label="Show version ${history.length - i}"></button>`).join('')}
    </div>
  </div>`;
}

function beforeAfterBlockHtml(originalImage, previewImage, opts = {}) {
  return `<p class="label">Before &amp; after — drag to compare</p>${beforeAfterHtml(originalImage, previewImage)}${historyThumbnailsHtml(opts)}${designEditorControlsHtml(opts)}`;
}

/** Wires clicks on the version-history thumbnail strip. */
function wireHistoryThumbnails(container, opts = {}) {
  if (!container || typeof opts.onSelectPreview !== 'function') return;
  container.querySelectorAll('.preview-history-thumb').forEach((btn) => {
    btn.addEventListener('click', () => opts.onSelectPreview(Number(btn.dataset.index)));
  });
}

/** Wires the "Change color, finish, or pattern" toggle inside a rendered before/after block. */
function wireDesignEditor(container, opts = {}) {
  if (!opts.allowEdit || !container) return;
  const toggleBtn = container.querySelector('[data-role="toggle-design-editor"]');
  const mount = container.querySelector('[data-role="design-editor-mount"]');
  if (!toggleBtn || !mount) return;

  let initialized = false;
  toggleBtn.addEventListener('click', () => {
    const willShow = mount.hidden;
    mount.hidden = !willShow;
    toggleBtn.textContent = willShow ? 'Hide design options' : 'Change color, finish, or pattern';
    if (willShow && !initialized) {
      initialized = true;
      renderDesignEditor(mount, opts.currentDesign || {}, opts.onRegenerateDesign || (() => {}));
    }
  });
}

/**
 * Default FloorSpec (visualizer-build-spec Part 1.1) for an estimate that
 * hasn't had the visualizer opened yet — seeded from the finish/color the
 * user picked in the pre-photo wizard so the first live render matches
 * what they already chose instead of resetting to Gravel/medium-gray.
 */
export function defaultFloorSpec(data) {
  // `sheen` (spec 3.4) is a v2 addition — a floorSpec persisted before this
  // shipped won't have it; default it to 'gloss' rather than leaving it
  // undefined (spread order lets an existing sheen value still win).
  if (data.floorSpec) return { sheen: 'gloss', ...data.floorSpec };
  const design = data.design || {};
  const finish = ['solid', 'flake', 'metallic'].includes(design.finish)
    ? design.finish
    : (data.meta?.finish || 'flake');
  return {
    finish,
    baseCoatId: BASE_COAT_PALETTE.some((c) => c.id === design.baseColor) ? design.baseColor : 'medium-gray',
    blendId: design.flakeColor || 'gravel',
    customComponents: null,
    density: 1,
    flakeSizeIn: 0.25,
    metallicId: 'silver-pearl',
    // Spec 3.4/1.1: gloss vs satin. Gloss is the default (matches epoxy's
    // actual look).
    sheen: 'gloss',
  };
}

function visualizerBlockHtml() {
  return `
    <div class="viz-wrap" data-role="vizWrap">
      <div class="viz-canvas-frame" data-role="vizFrame">
        <canvas class="viz-canvas" data-role="vizCanvas"></canvas>
        <div class="viz-skeleton" data-role="vizSkeleton"><span class="viz-spinner"></span><p>Finding your floor…</p></div>
        <div class="viz-error" data-role="vizError" hidden></div>
        <div class="viz-assist" data-role="vizAssist" hidden></div>
        <div class="viz-wipe-track" data-role="vizWipeTrack" role="slider" tabindex="0"
          aria-label="Drag to compare your photo and the new floor" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
          <div class="viz-wipe-handle" data-role="vizWipeHandle">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </div>
      <div data-role="vizControlsMount"></div>
      <div class="viz-actions">
        <button type="button" class="btn btn-o btn-sm" data-role="vizDownload">Share / download my floor</button>
      </div>
    </div>`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Mirrors before-after-slider.js's drag math on the visualizer's own
 * wipe track (kept separate from that module — it's wired to a WebGL
 * uniform here, not a clip-path — per the build task's "reuse the pattern,
 * don't touch the original" instruction). */
function wireWipeInteraction(track, handle, visualizer) {
  if (!track || !handle || !visualizer) return;
  let pct = 50;
  let dragging = false;
  let tracked = false;

  function setPct(next) {
    pct = Math.min(100, Math.max(0, next));
    handle.style.left = `${pct}%`;
    track.setAttribute('aria-valuenow', String(Math.round(pct)));
    visualizer.setWipePct(pct / 100);
    if (!tracked) {
      tracked = true;
      track_interacted();
    }
  }
  function track_interacted() {
    track.dispatchEvent(new CustomEvent('viz-wipe-interacted'));
  }
  function pctFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return pct;
    return ((clientX - rect.left) / rect.width) * 100;
  }
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    setPct(pctFromClientX(e.clientX));
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setPct(pctFromClientX(e.clientX));
  });
  track.addEventListener('pointerup', (e) => {
    dragging = false;
    try { track.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { setPct(pct - 5); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { setPct(pct + 5); e.preventDefault(); }
  });
  setPct(50);
}

/**
 * Mounts the live WebGL visualizer + control panel into a rendered
 * visualizerBlockHtml() container. This is the owner-only interactive
 * path (spec Part 3/4) — a non-owner shared-link viewer instead sees the
 * static persisted snapshot via beforeAfterBlockHtml, wired below.
 * @param {HTMLElement} container
 * @param {object} data - current estimate data
 * @param {object} opts
 * @param {(payload:{floorSpec:object, image:string})=>void} [opts.onVisualizerChange]
 * @param {(finish:string)=>void} [opts.onFinishChange]
 */
function wireVisualizer(container, data, opts = {}) {
  if (!container) return;
  const canvas = container.querySelector('[data-role="vizCanvas"]');
  const skeleton = container.querySelector('[data-role="vizSkeleton"]');
  const errorEl = container.querySelector('[data-role="vizError"]');
  const assistEl = container.querySelector('[data-role="vizAssist"]');
  const controlsMount = container.querySelector('[data-role="vizControlsMount"]');
  const wipeTrack = container.querySelector('[data-role="vizWipeTrack"]');
  const wipeHandle = container.querySelector('[data-role="vizWipeHandle"]');
  const downloadBtn = container.querySelector('[data-role="vizDownload"]');
  if (!canvas) return;

  let visualizer;
  try {
    visualizer = new FloorVisualizer(canvas);
  } catch {
    if (skeleton) skeleton.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = "Your browser doesn't support the interactive floor preview (WebGL2). Try a recent Chrome, Safari, or Edge.";
    }
    return;
  }

  // Bug fix: the floor texture used to tile at a flat repeat count
  // regardless of the room's actual size — a one-car garage and a sprawling
  // multi-room floor both got the same tile density, which reads as an
  // obviously coarse repeating lattice on a big floor. Scale it to this
  // estimate's real square footage (same field used for pricing).
  visualizer.setSqFt(data.analysis?.estimatedSqFt || data.pricing?.sqFt);

  const spec = defaultFloorSpec(data);
  let renderedOnce = false;
  let persistTimer = null;

  function modeFor(finish) {
    return finish === 'metallic' ? 'metallic' : finish === 'solid' ? 'solid' : 'flake';
  }

  function applySpec() {
    visualizer.setSpec({
      mode: modeFor(spec.finish),
      blendId: spec.blendId,
      customComponents: spec.customComponents,
      baseCoatHex: findBaseCoat(spec.baseCoatId).hex,
      density: spec.density,
      flakeSizeIn: spec.flakeSizeIn,
      metallicId: spec.metallicId,
      sheen: spec.sheen,
    });
  }

  function schedulePersist() {
    if (!renderedOnce) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      try {
        const blob = await visualizer.toBlob('image/jpeg', 0.82);
        const image = await blobToDataUrl(blob);
        opts.onVisualizerChange?.({ floorSpec: { ...spec }, image });
      } catch { /* best-effort persistence only */ }
    }, 600);
  }

  renderVisualizerControls(controlsMount, spec, {
    onSpecChange: (partial) => {
      Object.assign(spec, partial);
      applySpec();
      schedulePersist();
    },
    onFinishChange: (finish) => {
      spec.finish = finish;
      applySpec();
      schedulePersist();
      opts.onFinishChange?.(finish);
    },
  });

  wireWipeInteraction(wipeTrack, wipeHandle, visualizer);
  wipeTrack?.addEventListener('viz-wipe-interacted', () => track('slider_interacted', { pct: Number(wipeTrack.getAttribute('aria-valuenow')) }), { once: true });

  downloadBtn?.addEventListener('click', async () => {
    try {
      const blob = await visualizer.toBlob('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-epoxy-floor.jpg';
      a.click();
      track('visualizer_result_in_lead', { action: 'download' });
    } catch { /* ignore */ }
  });

  // Segmentation-mask cache (spec Part 5 build-order): reuse a mask
  // persisted from a prior page load of this same estimate/photo instead of
  // paying for another fal.ai call every time the owner reopens the page.
  const photoKey = photoFingerprint(data);
  const cachedSegmentation =
    data.segmentation?.mask && data.segmentation.photoKey === photoKey ? data.segmentation : null;

  /** Handles a successful segmentation/retry result shared by the initial
   * load and the manual-assist retry path below. */
  function onSegmented(result) {
    renderedOnce = true;
    track('visualizer_rendered', { finish: spec.finish });
    schedulePersist();
    // Only a cache miss / fresh network call returns a segmentation to
    // persist — a cache hit intentionally returns null here (see
    // FloorVisualizer._applySegmentedResult) so an unchanged mask isn't
    // rewritten on every load.
    if (result.segmentation) {
      opts.onSegmentationReady?.({ ...result.segmentation, photoKey });
    }
  }

  /** Mounts the manual mask-assist UI (spec 3.1's deferred-to-v2 fallback,
   * now built): user taps 2-3 points on their own floor; those points are
   * sent to /api/segment (via FloorVisualizer.retryWithPoints) instead of
   * the automatic box. Re-mounts itself (with an updated message) if a
   * retry still can't find the floor, so the user can keep adjusting taps
   * without reloading the page. */
  function mountAssist(message) {
    if (!assistEl) return;
    if (skeleton) skeleton.hidden = true;
    if (errorEl) errorEl.hidden = true;
    assistEl.hidden = false;
    renderMaskAssist(assistEl, data.originalImage, {
      message,
      onSubmit: async (points) => {
        try {
          const result = await visualizer.retryWithPoints(points);
          if (result.needsManualAssist) {
            mountAssist("Still couldn't find your floor there — try different spots, or upload another photo.");
            return;
          }
          assistEl.hidden = true;
          onSegmented(result);
        } catch {
          mountAssist('Something went wrong finding your floor — try again.');
        }
      },
    });
  }

  applySpec();
  visualizer
    .loadPhoto(data.originalImage, cachedSegmentation)
    .then((result) => {
      if (skeleton) skeleton.hidden = true;
      if (result.needsManualAssist) {
        mountAssist();
        return;
      }
      onSegmented(result);
    })
    .catch(() => {
      if (skeleton) skeleton.hidden = true;
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = 'Could not generate a live preview for this photo. Try another photo.';
      }
    });
}

/**
 * Reverted to the gen-AI preview pipeline (see lib/build-estimate.js's
 * meta comment) — the WebGL visualizer's visualizerBlockHtml()/wireVisualizer()
 * are unused dead code left in place for now (see visualizer-webgl-experiment
 * branch), not deleted, in case any part of it is revisited later.
 */
function photoBlockHtml(data, opts) {
  const { originalImage, previews = [] } = data;
  const previewImage = previews.find((p) => p.id === 'original' && p.image)?.image;

  if (previewImage) {
    return beforeAfterBlockHtml(originalImage, previewImage, opts);
  }

  return `<p class="label">Uploaded photo</p><img src="${originalImage}" alt="Uploaded space">`;
}

/** Swaps a photo block into the before/after slider once the preview image is ready. */
export function renderBeforeAfterPreview(container, beforeImage, afterImage, opts = {}) {
  if (!container) return;
  container.innerHTML = beforeAfterBlockHtml(beforeImage, afterImage, opts);
  initBeforeAfterSlider(container.querySelector('.ba-slider'));
  wireDesignEditor(container, opts);
  wireHistoryThumbnails(container, opts);
}

function resolveDesign(data, pricing) {
  const full = data.design || {};
  const slim = pricing?.design || {};
  return {
    ...slim,
    ...full,
    baseColorHex: full.baseColorHex || slim.baseColorHex,
    flakeColorHex: full.flakeColorHex || slim.flakeColorHex,
    baseColorLabel: full.baseColorLabel || slim.baseColorLabel,
    flakeColorLabel: full.flakeColorLabel || slim.flakeColorLabel,
    patternLabel: full.patternLabel || slim.patternLabel,
    patternDescription: full.patternDescription || slim.patternDescription,
    colorLabel: full.colorLabel || slim.colorLabel || slim.summary,
    finish: full.finish || slim.finish,
  };
}

function colorSwatchesHtml(d) {
  if (!d?.baseColorHex && !d?.flakeColorHex) {
    return `<span class="muted">${escapeHtml(d?.colorLabel || '—')}</span>`;
  }

  const chips = [];
  if (d.baseColorHex) {
    chips.push(`
      <span class="color-chip">
        <span class="swatch" style="background:${d.baseColorHex}" title="${escapeHtml(d.baseColorHex)}"></span>
        <span>${escapeHtml(d.baseColorLabel || 'Base')}</span>
      </span>`);
  }
  if (d.flakeColorHex) {
    chips.push(`
      <span class="color-chip">
        <span class="swatch" style="background:${d.flakeColorHex}" title="${escapeHtml(d.flakeColorHex)}"></span>
        <span>${escapeHtml(d.flakeColorLabel || 'Flake')}</span>
      </span>`);
  }

  return `<div class="color-chips">${chips.join('')}</div>`;
}

function selectionsBlock(d, pricing, finishKey, locationLabel) {
  const finish = pricing?.finishLabel || finishKey || '—';

  return `
    <section class="est-detail selections-block">
      <dl class="selection-grid">
        <div><dt>Finish</dt><dd>${escapeHtml(finish)}</dd></div>
        <div><dt>Colors</dt><dd class="selection-colors">${colorSwatchesHtml(d)}</dd></div>
        <div><dt>Pattern</dt><dd>${escapeHtml(d?.patternLabel || '—')}${d?.patternDescription ? `<span class="pattern-desc">${escapeHtml(d.patternDescription)}</span>` : ''}</dd></div>
        ${locationLabel ? `<div><dt>Location</dt><dd>${escapeHtml(locationLabel)}</dd></div>` : ''}
      </dl>
    </section>`;
}

function priceRange(pricing) {
  const exact = pricing.totalExact ?? roundMoney((pricing.totalLow + pricing.totalHigh) / 2);
  return { rangeLow: roundMoney(exact * 0.9), rangeHigh: roundMoney(exact * 1.1) };
}

/**
 * Splits the displayed total range across line items in proportion to each
 * item's exact amount, so the rows always sum to exactly the Total shown
 * below them — the pricing engine's own row.low/row.high can't be used
 * directly here since regional AI-researched pricing can override
 * totalExact independently of the deterministic per-row rate math. The
 * last row absorbs any rounding remainder so the sums are always exact.
 */
function lineItemRanges(pricing) {
  const { rangeLow, rangeHigh } = priceRange(pricing);
  const items = pricing.lineItems || [];
  const sumExact = items.reduce((sum, row) => sum + (row.exact ?? 0), 0) || 1;

  let allocatedLow = 0;
  let allocatedHigh = 0;
  return items.map((row, i) => {
    const isLast = i === items.length - 1;
    const share = (row.exact ?? 0) / sumExact;
    const low = isLast ? rangeLow - allocatedLow : roundMoney(rangeLow * share);
    const high = isLast ? rangeHigh - allocatedHigh : roundMoney(rangeHigh * share);
    allocatedLow += low;
    allocatedHigh += high;
    return { low, high };
  });
}

function priceBlock(pricing) {
  const { rangeLow, rangeHigh } = priceRange(pricing);

  return `
    <div class="price-block">
      <p class="label">Estimated total</p>
      <div class="price-exact">${formatMoney(rangeLow)} – ${formatMoney(rangeHigh)}</div>
      <p class="price-note">${escapeHtml(pricing.finishLabel)} · ${Math.round(pricing.sqFt)} sq ft</p>
    </div>`;
}

function roundMoney(n) {
  return Math.round(n / 5) * 5;
}

function detailBlock(label, bodyHtml) {
  if (!bodyHtml) return '';
  return `<section class="est-detail"><p class="label">${escapeHtml(label)}</p>${bodyHtml}</section>`;
}

export function renderEstimate(target, data, opts = {}) {
  const { analysis, pricing, meta, previews = [], originalImage, customerName, email, location } = data;
  const d = resolveDesign(data, pricing);
  const projectLocation = location || meta?.location || '';
  const market = pricing?.market;
  const locationLabel = market?.marketLocation || projectLocation;
  const firstName = (customerName || '').trim().split(/\s+/)[0];
  const title = firstName ? `${firstName}'s Epoxy Estimate` : 'Your Epoxy Estimate';

  const sqFtLine = analysis.estimatedSqFt
    ? `<p class="sqft-line"><strong>${Math.round(analysis.estimatedSqFt)} sq ft</strong>${analysis.confidence ? ` · ${escapeHtml(analysis.confidence)} confidence` : ''}${analysis.lengthFt && analysis.widthFt ? ` · ~${analysis.lengthFt}×${analysis.widthFt} ft` : ''}</p>`
    : '';

  const scopeHtml = [
    analysis.conditionNotes ? `<p>${escapeHtml(analysis.conditionNotes)}</p>` : '',
    analysis.prepDetails ? `<p><strong>Prep:</strong> ${escapeHtml(analysis.prepDetails)}</p>` : '',
    analysis.prepLevel ? `<p class="muted tiny">Prep level: ${escapeHtml(analysis.prepLevel)}</p>` : '',
    analysis.dimensionsNote ? `<p class="muted tiny">${escapeHtml(analysis.dimensionsNote)}</p>` : '',
  ].filter(Boolean).join('');

  const lineRanges = lineItemRanges(pricing);
  const lineAmount = (i) => `${formatMoney(lineRanges[i].low)} – ${formatMoney(lineRanges[i].high)}`;

  target.innerHTML = `
    <header class="est-head">
      <div>
        <p class="eyebrow">${escapeHtml(humanizeLabel(analysis?.spaceType) || 'Epoxy floor estimate')}</p>
        <h2>${escapeHtml(title)}</h2>
        ${email ? `<p class="est-contact">${escapeHtml(email)}</p>` : ''}
        ${locationLabel ? `<p class="location-pill">${escapeHtml(locationLabel)}</p>` : ''}
      </div>
    </header>
    ${selectionsBlock(d, pricing, meta?.finish, locationLabel)}
    <div class="est-grid">
      <div class="est-photo" id="estimatePhotoBlock">${photoBlockHtml(data, opts)}</div>
      <div class="est-summary">
        ${priceBlock(pricing)}
        ${sqFtLine}
        <p class="analysis">${escapeHtml(analysis.analysisSummary || '')}</p>
        <ul class="issues">${(analysis.surfaceIssues || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>
    </div>
    ${detailBlock('Scope & floor condition', scopeHtml)}
    <div class="line-items">
      <p class="label">Line-item breakdown</p>
      ${pricing.lineItems.map((row, i) => `
        <div class="line-row">
          <div><div class="name">${escapeHtml(row.label)}</div><div class="note">${escapeHtml(row.note)}</div></div>
          <div class="amt">${lineAmount(i)}</div>
        </div>`).join('')}
      <div class="line-total"><span>Total</span><span>${formatMoney(priceRange(pricing).rangeLow)} – ${formatMoney(priceRange(pricing).rangeHigh)}</span></div>
      ${pricing.minJobApplied ? '<p class="muted tiny">Local minimum job charge applied.</p>' : ''}
    </div>
    <footer class="est-foot">
      <p><strong>Important:</strong> Preliminary estimate only — pricing uses photo analysis and regional market research, not a live contractor bid. Final price confirmed after on-site review.</p>
      <p class="muted">Generated ${new Date(meta.generatedAt).toLocaleString()}${meta.demoMode ? ' · Demo mode' : ''}</p>
    </footer>`;

  const photoBlock = target.querySelector('#estimatePhotoBlock');
  initBeforeAfterSlider(photoBlock.querySelector('.ba-slider'));
  wireDesignEditor(photoBlock, opts);
  wireHistoryThumbnails(photoBlock, opts);
}

export function storageKey(id) {
  return `epoxygrind-estimate-${id}`;
}

export function previewContextKey(id) {
  return `epoxygrind-preview-ctx-${id}`;
}

export function saveEstimateSession(id, payload, previewContext) {
  sessionStorage.setItem(storageKey(id), JSON.stringify(payload));
  if (previewContext) {
    sessionStorage.setItem(previewContextKey(id), JSON.stringify(previewContext));
  }
}

export function loadEstimateSession(id) {
  const raw = sessionStorage.getItem(storageKey(id));
  return raw ? JSON.parse(raw) : null;
}

export function loadPreviewContext(id) {
  const raw = sessionStorage.getItem(previewContextKey(id));
  return raw ? JSON.parse(raw) : null;
}

