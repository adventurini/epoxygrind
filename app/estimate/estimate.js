import {
  renderEstimate,
  loadEstimateSession,
  previewsNeedGeneration,
  previewLoadingHtml,
  previewErrorHtml,
  wirePreviewError,
  humanizeLabel,
  formatMoney,
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
// Every generated version is persisted server-side (lib/estimate-storage.js's
// previewPaths — each generation gets its own never-overwritten storage
// path, keyed by a unique id, alongside the always-latest 'original' entry
// existing before/after-slider and previewsNeedGeneration() logic already
// depend on) so this gallery survives a page reload instead of only living
// in browser memory for the current tab. previewHistoryEntries()/
// selectPreviewFromHistory() below just read/write currentEstimate.previews
// directly — no separate array to keep in sync.
const MAX_PREVIEW_HISTORY = 6;
let activeHistoryId = null;

/** Every generated version except the always-latest 'original' pointer,
 * newest first. 'original' is a duplicate (same image) of whichever hist-*
 * entry was generated most recently, so showing both would just repeat the
 * newest thumbnail twice. */
function previewHistoryEntries(data) {
  return (data?.previews || [])
    .filter((p) => p.id !== 'original' && p.image)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, MAX_PREVIEW_HISTORY);
}

function selectPreviewFromHistory(index) {
  const entries = previewHistoryEntries(currentEstimate);
  const entry = entries[index];
  if (!entry || !currentEstimate) return;
  activeHistoryId = entry.id;
  currentEstimate = {
    ...currentEstimate,
    design: entry.design || currentEstimate.design,
    pricing: entry.pricing || currentEstimate.pricing,
    previews: [
      { id: 'original', label: 'Your garage (new floor)', image: entry.image },
      ...currentEstimate.previews.filter((p) => p.id !== 'original'),
    ],
  };
  showEstimate(currentEstimate);
}

/** Builds the previews array for a PATCH/build payload after a new preview
 * was generated: updates the 'original' pointer, adds the new version as
 * its own permanent history entry, and carries every prior history entry
 * forward via its already-known storagePath (never re-uploading — a stale/
 * expired fal.media URL on an old entry would otherwise break re-saving it
 * on every subsequent generation). */
function accumulatePreviews(prevPreviews, { image, label, design, pricing }) {
  const historyId = `hist-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const carryForward = (prevPreviews || [])
    .filter((p) => p.id !== 'original')
    .map((p) => (p.storagePath
      ? { id: p.id, label: p.label, storagePath: p.storagePath, createdAt: p.createdAt }
      : { id: p.id, label: p.label, image: p.image, createdAt: p.createdAt }));
  return [
    { id: 'original', label, image },
    { id: historyId, label, image, design, pricing, createdAt },
    ...carryForward,
  ];
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
 */
function densityToPatternId(finish, density) {
  if (finish !== 'flake') return undefined;
  return density < 0.4 ? 'partial' : 'full-broadcast';
}

/**
 * Recomputes design + pricing client-side from a visualizer FloorSpec —
 * this is the instant, network-free replacement for the old phase:'redesign'
 * server round trip (buildSinglePreview's gen-AI call is gone from this
 * path entirely; lib/pricing.js and lib/finish-design.js are pure
 * functions, safe to run in the browser exactly as-is).
 */
function recomputeFromFloorSpec(finish, floorSpec) {
  const design = resolveDesign({
    finish,
    baseColor: floorSpec.baseCoatId,
    flakeColor: floorSpec.blendId !== 'CUSTOM' ? floorSpec.blendId : undefined,
    pattern: densityToPatternId(finish, floorSpec.density),
  });

  if (floorSpec.blendId === 'CUSTOM' && floorSpec.customComponents?.length) {
    design.flakeColorLabel = 'Custom blend';
    design.flakeColorHex = findSolidColor(floorSpec.customComponents[0].colorCode).hex;
    design.colorLabel = `${design.baseColorLabel} base · Custom blend`;
    design.summary = `${design.colorLabel} · ${design.patternLabel}`;
  }

  const sqFt = currentEstimate?.analysis?.estimatedSqFt || currentEstimate?.pricing?.sqFt || 0;
  const pricing = calculateEstimate(sqFt, finish, {
    design,
    regionalRates: currentEstimate?.pricing?.market || null,
    coatingType: currentEstimate?.meta?.coatingType || 'epoxy',
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

function showEstimate(data) {
  currentEstimate = data;
  const historyEntries = previewHistoryEntries(data);
  const activeHistoryIndex = Math.max(0, historyEntries.findIndex((e) => e.id === activeHistoryId));
  renderEstimate(doc, data, {
    allowEdit: allowDesignEdit,
    currentDesign: designSnapshot(data),
    onRegenerateDesign: regenerateDesign,
    previewHistory: historyEntries,
    activeHistoryIndex,
    onSelectPreview: selectPreviewFromHistory,
    onVisualizerChange,
    onSegmentationReady,
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

  const swappedPhoto = fields.photo || null;
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
        originalImage: swappedPhoto || currentEstimate.originalImage,
        spaceDescription: currentEstimate.previewContext?.spaceDescription || '',
        regionalRates: currentEstimate.pricing?.market || null,
      }),
    }, 130_000);

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Could not regenerate preview.');

    const newPreviews = accumulatePreviews(currentEstimate.previews, {
      image: resData.preview.image,
      label: resData.preview.label,
      design: resData.design,
      pricing: resData.pricing,
    });
    activeHistoryId = newPreviews[1].id;

    currentEstimate = {
      ...currentEstimate,
      pricing: resData.pricing,
      design: resData.design,
      previewContext: resData.previewContext,
      previews: newPreviews,
      meta: { ...currentEstimate.meta, finish: fields.finish, coatingType: fields.coatingType },
      // A swapped photo becomes the new "before" side of every future
      // before/after comparison and regeneration, not just this one image —
      // otherwise the before/after slider would show the OLD photo next to
      // a floor generated from a DIFFERENT, NEW photo.
      ...(swappedPhoto ? { originalImage: swappedPhoto } : null),
    };

    if (estimateId) {
      // Best-effort persistence — the view above already reflects the
      // change either way, so a failed/slow save shouldn't block the UI.
      // persistEstimateImages (lib/estimate-storage.js) already uploads a
      // data: URL passed as originalImage and swaps in the storage path —
      // no separate upload step needed here for a swapped photo.
      authFetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            pricing: currentEstimate.pricing,
            design: currentEstimate.design,
            previewContext: currentEstimate.previewContext,
            meta: currentEstimate.meta,
            ...(swappedPhoto ? { originalImage: swappedPhoto } : null),
          },
          previews: currentEstimate.previews,
        }),
      }).catch(() => {});
    }

    showEstimate(currentEstimate);
    toast('Preview updated.');
  } catch (err) {
    showEstimate(currentEstimate);
    // The design editor is exactly where the user is looking when this
    // fails (they just clicked "Generate another version" inside it) — a
    // toast can go unnoticed, so reopen the editor and show the real
    // reason right next to the controls that caused it. Field selections
    // don't carry over across the re-render (showEstimate rebuilds from
    // currentEstimate, which wasn't mutated on failure) — an accepted
    // trade-off for a real, verifiable error message over a toast.
    const refreshedBlock = document.getElementById('estimatePhotoBlock');
    const toggleBtn = refreshedBlock?.querySelector('[data-role="toggle-design-editor"]');
    const mount = refreshedBlock?.querySelector('[data-role="design-editor-mount"]');
    const message = err.message || 'Could not regenerate preview.';
    if (toggleBtn && mount) {
      if (mount.hidden) toggleBtn.click();
      if (mount.showRegenError) mount.showRegenError(message);
      else toast(message);
    } else {
      toast(message);
    }
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
function showPreviewError(message) {
  const photoBlock = document.getElementById('estimatePhotoBlock');
  if (!photoBlock) { toast(message); return; }
  photoBlock.innerHTML = previewErrorHtml(message);
  wirePreviewError(photoBlock, () => generatePreviewInBackground(currentEstimate));
}

async function generatePreviewInBackground(data) {
  if (!data?.id || data.id.startsWith('local-')) return;
  if (!previewsNeedGeneration(data)) return;

  const photoBlock = document.getElementById('estimatePhotoBlock');
  const progress = photoBlock ? createPreviewProgress(photoBlock) : { finish() {}, destroy() {} };

  try {
    const apiData = await loadFromApi(data.id);
    const previewImage = apiData?.previews?.find((item) => item.id === 'original' && item.image)?.image;
    if (!previewImage) {
      // The server actually attempted generation and failed (fal.ai
      // rejected the photo/finish combo, timed out, etc.) — apiData.previewError
      // carries the real, already-user-safe reason (see
      // lib/preview-images.js's friendlyPreviewErrorMessage) rather than a
      // generic toast the user might not even see, since this whole call
      // runs unprompted in the background right after the estimate loads.
      showPreviewError(apiData?.previewError || 'Could not generate floor preview.');
      return;
    }
    progress.finish();
    // The server (generateAllEstimatePreviews, lib/generate-estimate-preview.js)
    // already saved this generation as a permanent history entry alongside
    // the 'original' pointer — apiData.previews already reflects that, no
    // client-side accumulation needed for this (first-generation) path.
    currentEstimate = { ...currentEstimate, previews: apiData.previews, previewPaths: apiData.previewPaths || [] };
    activeHistoryId = previewHistoryEntries(currentEstimate)[0]?.id ?? null;
    showEstimate(currentEstimate);
  } catch (err) {
    showPreviewError(err.message || 'Could not generate floor preview.');
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
    activeHistoryId = previewHistoryEntries(apiData)[0]?.id ?? null;
    showEstimate(apiData);
    return true;
  }

  const sessionData = loadEstimateSession(id);
  if (sessionData) {
    // Cached client-side from this same browser session — always the owner.
    allowDesignEdit = true;
    activeHistoryId = previewHistoryEntries(sessionData)[0]?.id ?? null;
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
