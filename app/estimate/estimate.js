import {
  renderEstimate,
  loadEstimateSession,
  previewsNeedGeneration,
  renderBeforeAfterPreview,
  previewLoadingHtml,
  humanizeLabel,
  formatMoney,
  defaultFloorSpec,
} from '/calculator/estimate-view.js';
import {
  clearPendingEstimate,
  generateAndSaveEstimate,
  loadPendingEstimate,
} from '/calculator/submit-estimate.js';
import { createEstimateProgress } from '/calculator/estimate-progress.js';
import { createPreviewProgress } from '/calculator/preview-progress.js';
import { initDashboard, refreshDashboardProfile } from '/app/shell.js';
import { authFetch } from '/auth/client.js';
import { track } from '/calculator/analytics.js';
import { calculateEstimate } from '/lib/pricing.js';
import { resolveDesign } from '/lib/finish-design.js';
import { findSolidColor } from '/lib/flake-recipes.js';

const params = new URLSearchParams(location.search);
let estimateId = params.get('id');
const isPending = params.get('pending') === '1';
const loading = document.getElementById('loadingState');
const error = document.getElementById('errorState');
const result = document.getElementById('resultPanel');
const doc = document.getElementById('estimateDoc');
const toastEl = document.getElementById('toast');
const loadTitle = document.getElementById('loadTitle');
const loadMsg = document.getElementById('loadMsg');
const errorTitle = document.getElementById('errorTitle');
const errorMsg = document.getElementById('errorMsg');
const errorAction = document.getElementById('errorAction');

let currentEstimate = null;
let allowDesignEdit = false;
// In-memory only (not persisted): lets a user flip back to a version they
// generated earlier in this viewing session instead of only ever seeing
// the latest regenerate. Most recent first; capped so it can't grow unbounded.
const MAX_PREVIEW_HISTORY = 6;
let previewHistory = [];
let activeHistoryIndex = 0;

function pushPreviewHistory(entry) {
  previewHistory = [entry, ...previewHistory].slice(0, MAX_PREVIEW_HISTORY);
  activeHistoryIndex = 0;
}

function seedPreviewHistoryFromEstimate(data) {
  const image = (data.previews || []).find((item) => item.id === 'original' && item.image)?.image;
  previewHistory = image ? [{ image, design: data.design, pricing: data.pricing }] : [];
  activeHistoryIndex = 0;
}

function selectPreviewFromHistory(index) {
  const entry = previewHistory[index];
  if (!entry || !currentEstimate) return;
  activeHistoryIndex = index;
  currentEstimate = {
    ...currentEstimate,
    design: entry.design,
    pricing: entry.pricing,
    previews: [{ id: 'original', label: 'Your garage (new floor)', image: entry.image }],
  };
  showEstimate(currentEstimate);
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

function setLoadingStatus(title, message) {
  if (loadTitle && title) loadTitle.textContent = title;
  if (loadMsg && message) loadMsg.textContent = message;
}

function showError(title, message, actionHref = '/app/', actionLabel = 'Go to dashboard') {
  loading.hidden = true;
  result.hidden = true;
  error.hidden = false;
  if (errorTitle) errorTitle.textContent = title;
  if (errorMsg) errorMsg.textContent = message;
  if (errorAction) {
    errorAction.href = actionHref;
    errorAction.textContent = actionLabel;
  }
}

function designSnapshot(data) {
  return {
    finish: data.meta?.finish || data.design?.finish || 'flake',
    coatingType: data.meta?.coatingType || 'epoxy',
    pattern: data.design?.pattern,
    baseColor: data.design?.baseColor,
    flakeColor: data.design?.flakeColor,
  };
}

/**
 * Coverage/density has no direct pricing-engine concept — the visualizer's
 * density slider maps onto the SAME pattern ids lib/pricing.js already
 * knows about (partial-broadcast is priced lower) so this recomputes
 * pricing without adding a new pricing concept or touching lib/pricing.js.
 *
 * Fallback only: a real, explicit pattern selector now exists in
 * visualizer-controls.js (floorSpec.pattern), and recomputeFromFloorSpec
 * below always prefers it when present — this inference is only still used
 * for a floorSpec persisted before the pattern selector shipped (it's
 * flake-only, and only distinguishes 2 of flake's 5 patterns; solid and
 * metallic never had a mapping at all). Kept rather than removed so an old
 * saved estimate's price doesn't silently jump on next load purely because
 * its stored floorSpec predates `pattern`.
 */
function densityToPatternId(finish, density) {
  if (finish !== 'flake') return undefined;
  return density < 0.4 ? 'partial' : 'full-broadcast';
}

/**
 * Recomputes design + pricing client-side from a visualizer FloorSpec, with
 * optional sqFt/coatingType overrides (used by the results-view project-
 * fields editor) — the instant, network-free replacement for the old
 * phase:'redesign' server round trip (buildSinglePreview's gen-AI call is
 * gone from this path entirely; lib/pricing.js and lib/finish-design.js are
 * pure functions, safe to run in the browser exactly as-is).
 * @param {string} finish
 * @param {object} floorSpec
 * @param {{sqFt?:number, coatingType?:string}} [overrides]
 */
function recomputeFromFloorSpec(finish, floorSpec, overrides = {}) {
  const design = resolveDesign({
    finish,
    baseColor: floorSpec.baseCoatId,
    flakeColor: floorSpec.blendId !== 'CUSTOM' ? floorSpec.blendId : undefined,
    pattern: floorSpec.pattern || densityToPatternId(finish, floorSpec.density),
  });

  if (floorSpec.blendId === 'CUSTOM' && floorSpec.customComponents?.length) {
    design.flakeColorLabel = 'Custom blend';
    design.flakeColorHex = findSolidColor(floorSpec.customComponents[0].colorCode).hex;
    design.colorLabel = `${design.baseColorLabel} base · Custom blend`;
    design.summary = `${design.colorLabel} · ${design.patternLabel}`;
  }

  const sqFt = overrides.sqFt ?? (currentEstimate?.analysis?.estimatedSqFt || currentEstimate?.pricing?.sqFt || 0);
  const coatingType = overrides.coatingType ?? (currentEstimate?.meta?.coatingType || 'epoxy');
  const pricing = calculateEstimate(sqFt, finish, {
    design,
    regionalRates: currentEstimate?.pricing?.market || null,
    coatingType,
  });

  return { design, pricing };
}

/** Updates just the top-line price display in place — deliberately does
 * NOT call showEstimate()/renderEstimate() again, which would tear down
 * and remount the live WebGL canvas (re-running segmentation) on every
 * blend/density tweak. */
function updatePriceDom(pricing) {
  const exact = pricing.totalExact ?? Math.round(((pricing.totalLow + pricing.totalHigh) / 2) / 5) * 5;
  const rangeLow = Math.round((exact * 0.9) / 5) * 5;
  const rangeHigh = Math.round((exact * 1.1) / 5) * 5;
  const priceExact = doc.querySelector('.price-exact');
  const priceNote = doc.querySelector('.price-note');
  if (priceExact) priceExact.textContent = `${formatMoney(rangeLow)} – ${formatMoney(rangeHigh)}`;
  if (priceNote) priceNote.textContent = `${pricing.finishLabel} · ${Math.round(pricing.sqFt)} sq ft`;
}

/**
 * Wired to visualizer-controls' onSpecChange/onFinishChange via
 * calculator/estimate-view.js's wireVisualizer. Fires on every control
 * change (already debounced ~600ms upstream so this isn't hammered), so it
 * intentionally does the minimum: update in-memory state + the price
 * display, then best-effort persist for saved estimates.
 */
function onVisualizerChange({ floorSpec, image }) {
  if (!currentEstimate) return;
  const finish = floorSpec.finish;
  const { design, pricing } = recomputeFromFloorSpec(finish, floorSpec);

  currentEstimate = {
    ...currentEstimate,
    design,
    pricing,
    floorSpec,
    visualizerResult: { image },
    meta: { ...currentEstimate.meta, finish, previewMode: 'visualizer' },
  };
  updatePriceDom(pricing);

  if (estimateId) {
    authFetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          pricing: currentEstimate.pricing,
          design: currentEstimate.design,
          floorSpec: currentEstimate.floorSpec,
          visualizerResult: currentEstimate.visualizerResult,
          meta: currentEstimate.meta,
        },
      }),
    })
      .then(() => track('visualizer_result_in_lead', { finish }))
      .catch(() => {});
  }
}

/**
 * Persists a freshly-computed segmentation mask (cache miss in
 * FloorVisualizer.loadPhoto) so the next time this estimate's page loads,
 * wireVisualizer finds a matching `data.segmentation` and skips the
 * /api/segment network call entirely. Best-effort, like onVisualizerChange —
 * a failed save just means the next load re-segments once more, not a
 * broken page.
 */
function onSegmentationReady(segmentation) {
  if (!currentEstimate) return;
  currentEstimate = { ...currentEstimate, segmentation };
  if (estimateId) {
    authFetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { segmentation } }),
    }).catch(() => {});
  }
}

/**
 * Owner-only sqFt/coatingType edit from the results view (wired to
 * calculator/estimate-view.js's wireProjectFieldsEditor, gated by the same
 * allowEdit the visualizer/design-editor already use). Reuses
 * recomputeFromFloorSpec's pure design+pricing path — same as
 * onVisualizerChange — rather than a server round trip.
 *
 * Uses defaultFloorSpec(currentEstimate) as the design source when this
 * estimate's visualizer/pattern selector has never been touched: a freshly
 * built estimate's `design` is still lib/pricing.js's SLIM
 * {colorLabel, patternLabel, baseColorHex, flakeColorHex, summary} shape —
 * no pattern/baseColor/flakeColor ids, no patternAddLow/High — so
 * recomputing straight off currentEstimate.design would silently drop any
 * pattern price premium. defaultFloorSpec() already knows how to derive a
 * full FloorSpec from that slim shape (it's the same fallback the
 * visualizer itself uses on first mount), so reusing it here keeps this
 * edit correct regardless of whether the visualizer has recomputed pricing
 * before.
 */
function onProjectFieldsChange({ sqFt, coatingType } = {}) {
  if (!currentEstimate) return;
  const floorSpec = currentEstimate.floorSpec || defaultFloorSpec(currentEstimate);
  const finish = floorSpec.finish;
  const { design, pricing } = recomputeFromFloorSpec(finish, floorSpec, { sqFt, coatingType });

  currentEstimate = {
    ...currentEstimate,
    design,
    pricing,
    analysis: sqFt != null ? { ...currentEstimate.analysis, estimatedSqFt: sqFt } : currentEstimate.analysis,
    meta: { ...currentEstimate.meta, coatingType: pricing.coatingType },
  };
  updatePriceDom(pricing);
  const sqftStrong = doc.querySelector('.sqft-line strong');
  if (sqftStrong) sqftStrong.textContent = `${Math.round(pricing.sqFt)} sq ft`;

  if (estimateId) {
    authFetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          pricing: currentEstimate.pricing,
          design: currentEstimate.design,
          analysis: currentEstimate.analysis,
          meta: currentEstimate.meta,
        },
      }),
    })
      .then(() => track('project_fields_edited', { sqFt, coatingType }))
      .catch(() => {});
  }
}

function showEstimate(data) {
  currentEstimate = data;
  renderEstimate(doc, data, {
    allowEdit: allowDesignEdit,
    currentDesign: designSnapshot(data),
    onRegenerateDesign: regenerateDesign,
    previewHistory,
    activeHistoryIndex,
    onSelectPreview: selectPreviewFromHistory,
    onVisualizerChange,
    onSegmentationReady,
    onProjectFieldsChange,
  });
  loading.hidden = true;
  error.hidden = true;
  result.hidden = false;
  const title = humanizeLabel(data.analysis?.spaceType) || 'Your estimate';
  document.title = `${title} | EpoxyGrind`;
  if (data.previewError) {
    toast(`Floor preview: ${data.previewError}`);
  }
}

/**
 * Recomputes pricing and regenerates the single preview image for the
 * current estimate with new finish/pattern/color choices, then persists
 * it via PATCH if this is a saved estimate. The compute step doesn't
 * require auth (matches phase:'preview'/'generate'); the toggle that
 * exposes this is only rendered for the estimate's owner (see
 * allowDesignEdit in loadEstimate/loadEstimateById).
 */
async function regenerateDesign(fields) {
  if (!currentEstimate) return;

  const photoBlock = document.getElementById('estimatePhotoBlock');
  if (photoBlock) photoBlock.innerHTML = previewLoadingHtml('Regenerating your floor preview…');
  const progress = photoBlock ? createPreviewProgress(photoBlock) : { finish() {}, destroy() {} };

  try {
    const res = await fetchWithTimeout('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'redesign',
        finish: fields.finish,
        coatingType: fields.coatingType,
        pattern: fields.pattern,
        baseColor: fields.baseColor,
        flakeColor: fields.flakeColor,
        sqFt: currentEstimate.analysis?.estimatedSqFt || currentEstimate.pricing?.sqFt,
        originalImage: currentEstimate.originalImage,
        spaceDescription: currentEstimate.previewContext?.spaceDescription || '',
        regionalRates: currentEstimate.pricing?.market || null,
      }),
    }, 130_000);

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Could not regenerate preview.');

    currentEstimate = {
      ...currentEstimate,
      pricing: resData.pricing,
      design: resData.design,
      previewContext: resData.previewContext,
      previews: [{ id: resData.preview.id, label: resData.preview.label, image: resData.preview.image }],
      meta: { ...currentEstimate.meta, finish: fields.finish, coatingType: fields.coatingType },
    };
    pushPreviewHistory({ image: resData.preview.image, design: resData.design, pricing: resData.pricing });

    if (estimateId) {
      // Best-effort persistence — the view above already reflects the
      // change either way, so a failed/slow save shouldn't block the UI.
      authFetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            pricing: currentEstimate.pricing,
            design: currentEstimate.design,
            previewContext: currentEstimate.previewContext,
            meta: currentEstimate.meta,
          },
          previews: currentEstimate.previews,
        }),
      }).catch(() => {});
    }

    showEstimate(currentEstimate);
    toast('Preview updated.');
  } catch (err) {
    showEstimate(currentEstimate);
    toast(err.message || 'Could not regenerate preview.');
  } finally {
    progress.destroy();
  }
}

/**
 * Generates the single floor preview image after the estimate is already
 * showing, then swaps the uploaded-photo card into a before/after slider.
 * Never blocks display. Uses the same public GET endpoint the shared-link
 * view uses (it generates server-side if missing) rather than an
 * authenticated PATCH — that path depended on the browser's auth client
 * being ready, and any failure there (e.g. a slow/failed session setup)
 * left this stuck forever with no network activity and no visible error,
 * since it was fired with `void` and nothing ever caught the rejection.
 */
async function generatePreviewInBackground(data) {
  if (!data?.id || data.id.startsWith('local-')) return;
  if (!previewsNeedGeneration(data)) return;

  const photoBlock = document.getElementById('estimatePhotoBlock');
  const progress = photoBlock ? createPreviewProgress(photoBlock) : { finish() {}, destroy() {} };

  try {
    const apiData = await loadFromApi(data.id);
    const previewImage = apiData?.previews?.find((item) => item.id === 'original' && item.image)?.image;
    if (!previewImage) {
      toast('Could not generate floor preview.');
      return;
    }
    progress.finish();
    currentEstimate = { ...currentEstimate, previews: apiData.previews, previewPaths: apiData.previewPaths || [] };
    pushPreviewHistory({ image: previewImage, design: currentEstimate.design, pricing: currentEstimate.pricing });
    renderBeforeAfterPreview(photoBlock, currentEstimate.originalImage, previewImage, {
      allowEdit: allowDesignEdit,
      currentDesign: designSnapshot(currentEstimate),
      onRegenerateDesign: regenerateDesign,
      previewHistory,
      activeHistoryIndex,
      onSelectPreview: selectPreviewFromHistory,
    });
  } catch (err) {
    toast(err.message || 'Could not generate floor preview.');
  } finally {
    progress.destroy();
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function loadFromApi(estimateId) {
  // Long timeout: this GET generates the preview inline server-side when
  // it's missing (up to ~115s worst case), not just fetches a saved row.
  const res = await fetchWithTimeout(
    `/api/estimates?id=${encodeURIComponent(estimateId)}`,
    {},
    130_000,
  );
  if (!res.ok) return null;
  return res.json();
}

async function shareEstimate() {
  if (!currentEstimate || !estimateId) return;
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast('Share link copied.');
    track('share_link_copied');
  } catch {
    toast('Could not copy link.');
  }
}

function downloadEstimate() {
  if (!doc) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Epoxy floor estimate</title><link rel="stylesheet" href="${location.origin}/home.css"><link rel="stylesheet" href="${location.origin}/calculator/calculator.css"></head><body><main class="calc-page"><div class="wrap"><article class="estimate-doc">${doc.innerHTML}</article></div></main></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `estimate-${Date.now()}.html`;
  a.click();
}

async function runPendingEstimate() {
  const form = loadPendingEstimate();
  if (!form?.image) {
    showError(
      'Nothing to generate',
      'Start from the homepage calculator and try again.',
      '/',
      'Back to calculator',
    );
    return;
  }

  if (loadTitle) loadTitle.textContent = 'Building your estimate…';
  document.title = 'Building estimate… | EpoxyGrind';

  const progress = createEstimateProgress(document.getElementById('estimateProgress'));

  let buildTimedOut = false;
  const buildDeadline = setTimeout(() => {
    buildTimedOut = true;
    progress.destroy();
    clearPendingEstimate();
    showError(
      'This took too long',
      'Please try again. A smaller photo can help.',
      '/',
      'Try again',
    );
  }, 150_000);

  try {
    const { estimate } = await generateAndSaveEstimate(form, {
      onPhaseStart: (id, label) => progress.setPhase(id, label),
    });
    if (buildTimedOut || !estimate?.id) return;
    clearTimeout(buildDeadline);

    history.replaceState(null, '', estimate.id.startsWith('local-')
      ? `/app/estimate/?pending=0`
      : `/app/estimate/?id=${encodeURIComponent(estimate.id)}`);
    estimateId = estimate.id.startsWith('local-') ? null : estimate.id;

    // Whoever just built this estimate owns it — no ambiguity here, unlike
    // loading an existing one where the viewer might be a shared-link guest.
    allowDesignEdit = true;

    progress.finish();
    showEstimate(estimate);
    track('estimate_generated');
    void refreshDashboardProfile();
    void generatePreviewInBackground(estimate);
  } catch (err) {
    clearTimeout(buildDeadline);
    progress.destroy();
    clearPendingEstimate();
    if (err.code === 'OUT_OF_CREDITS') {
      showError(
        "You're out of free estimates",
        "You've used all your free estimate credits. Reach out if you'd like more.",
        '/app/',
        'Go to dashboard',
      );
      return;
    }
    showError(
      'Could not build your estimate',
      err.message || 'Please try again.',
      '/',
      'Try again',
    );
  }
}

async function loadEstimateById(id, user) {
  // The GET already generates the preview server-side if it's missing (see
  // api/estimates.js) so this works for anyone with the link, not just an
  // authenticated owner — no separate client-triggered generation needed.
  // Editing the design is only offered to the actual owner, though — a
  // shared-link viewer shouldn't see (or be able to trigger) regeneration
  // controls on someone else's estimate.
  const apiData = await loadFromApi(id);
  if (apiData) {
    allowDesignEdit = Boolean(user && apiData.userId && user.id === apiData.userId);
    seedPreviewHistoryFromEstimate(apiData);
    showEstimate(apiData);
    return true;
  }

  const sessionData = loadEstimateSession(id);
  if (sessionData) {
    // Cached client-side from this same browser session — always the owner.
    allowDesignEdit = true;
    seedPreviewHistoryFromEstimate(sessionData);
    showEstimate(sessionData);
    return true;
  }

  return false;
}

async function loadEstimate() {
  // Never send users to the login page from the estimate flow — demo sign-in runs in the background.
  const user = await initDashboard({ activeNav: 'estimates', requireAuth: false });

  if (isPending) {
    await runPendingEstimate();
    return;
  }

  if (estimateId) {
    try {
      const loaded = await loadEstimateById(estimateId, user);
      if (loaded) return;
    } catch (err) {
      showError(
        'Could not load this estimate',
        err.message || 'Please try again.',
      );
      return;
    }
  }

  showError(
    'Estimate not found',
    'This estimate may have been deleted or you may not have access.',
  );
}

document.getElementById('printEstimate')?.addEventListener('click', () => window.print());
document.getElementById('downloadEstimate')?.addEventListener('click', downloadEstimate);
document.getElementById('shareEstimate')?.addEventListener('click', shareEstimate);

loadEstimate();
