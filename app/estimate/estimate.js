import {
  renderEstimate,
  loadEstimateSession,
  previewsNeedGeneration,
  updatePreviewsInDom,
} from '/calculator/estimate-view.js';
import {
  clearPendingEstimate,
  generateAndSaveEstimate,
  loadPendingEstimate,
} from '/calculator/submit-estimate.js?v=fix3';
import { createEstimateProgress } from '/calculator/estimate-progress.js?v=fix3';
import { initDashboard, refreshDashboardProfile } from '/app/shell.js';
import { authFetch, waitForAccessToken } from '/auth/client.js';

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

function showEstimate(data) {
  currentEstimate = data;
  renderEstimate(doc, data);
  loading.hidden = true;
  error.hidden = true;
  result.hidden = false;
  const title = data.analysis?.spaceType || 'Your estimate';
  document.title = `${title} | EpoxyGrind`;
  if (data.previewError) {
    toast(`Floor preview: ${data.previewError}`);
  }
}

const PREVIEW_LOADING_HTML = `
  <div class="preview-card preview-loading"><div class="preview-spinner" aria-hidden="true"></div><div class="cap">Generating your floor preview…</div></div>`;

/** Generates the single floor preview image after the estimate is already showing. Never blocks display. */
async function generatePreviewInBackground(data) {
  if (!data?.id || data.id.startsWith('local-')) return;
  if (!previewsNeedGeneration(data)) return;

  const grid = document.getElementById('estimatePreviews');
  if (grid) {
    grid.innerHTML = PREVIEW_LOADING_HTML;
  }

  await waitForAccessToken({ timeoutMs: 12_000 });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150_000);
  let res;
  try {
    res = await authFetch(`/api/estimates?id=${encodeURIComponent(data.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generateAllPreviews: true }),
      signal: ctrl.signal,
    });
  } catch (err) {
    toast(err.name === 'AbortError' ? 'Preview generation timed out. Refresh to check again.' : 'Could not generate floor preview.');
    return;
  } finally {
    clearTimeout(timer);
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(payload.error || 'Could not generate floor preview.');
    return;
  }

  currentEstimate = { ...currentEstimate, previews: payload.previews || [], previewPaths: payload.previewPaths || [] };
  updatePreviewsInDom(currentEstimate.previews);
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
  const res = await fetchWithTimeout(
    `/api/estimates?id=${encodeURIComponent(estimateId)}`,
    {},
    45_000,
  );
  if (!res.ok) return null;
  return res.json();
}

async function shareEstimate() {
  if (!currentEstimate || !estimateId) return;
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast('Share link copied.');
  } catch {
    toast('Could not copy link.');
  }
}

function downloadEstimate() {
  if (!doc) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Epoxy floor estimate</title><link rel="stylesheet" href="${location.origin}/calculator/calculator.css"></head><body><main class="calc-page"><div class="wrap"><article class="estimate-doc">${doc.innerHTML}</article></div></main></body></html>`;
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

    progress.finish();
    showEstimate(estimate);
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

async function loadEstimateById(id) {
  const apiData = await loadFromApi(id);
  if (apiData) {
    showEstimate(apiData);
    void generatePreviewInBackground(apiData);
    return true;
  }

  const sessionData = loadEstimateSession(id);
  if (sessionData) {
    showEstimate(sessionData);
    return true;
  }

  return false;
}

async function loadEstimate() {
  // Never send users to the login page from the estimate flow — demo sign-in runs in the background.
  await initDashboard({ activeNav: 'estimates', requireAuth: false });

  if (isPending) {
    await runPendingEstimate();
    return;
  }

  if (estimateId) {
    const loaded = await loadEstimateById(estimateId);
    if (loaded) return;
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
