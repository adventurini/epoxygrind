import { renderTeaser, renderEstimate } from './estimate-view.js';
import { generateAnonymousEstimate, claimEstimate } from './submit-estimate.js';
import { track } from './analytics.js';
import { authFetch } from '/auth/client.js';

const $ = (id) => document.getElementById(id);

const LOADING_MESSAGES = [
  'Analyzing your photo…',
  'Applying your flake blend…',
  'Pricing your project…',
];

const PANEL_TITLES = {
  step1: 'Project details',
  calcLoading: 'Building your estimate',
  step2: 'Your concept preview',
  step3: 'Your estimate',
};

let step1Form = null;
let generated = null;
let claimedEstimate = null;
let loadingTimer = null;

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

function emailValid(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function showStep(id) {
  ['step1', 'calcLoading', 'step2', 'step3'].forEach((sid) => {
    const el = $(sid);
    if (el) el.hidden = sid !== id;
  });
  const title = $('panelTitle');
  if (title) title.textContent = PANEL_TITLES[id] || PANEL_TITLES.step1;
}

function startLoadingCycle() {
  let i = 0;
  const textEl = $('calcLoadingText');
  if (textEl) textEl.textContent = LOADING_MESSAGES[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    if (textEl) textEl.textContent = LOADING_MESSAGES[i];
  }, 2000);
}

function stopLoadingCycle() {
  clearInterval(loadingTimer);
  loadingTimer = null;
}

/** Step 1 submit: generate anonymously, no account created yet. */
export async function runGenerate(form) {
  step1Form = form;
  showStep('calcLoading');
  startLoadingCycle();

  try {
    generated = await generateAnonymousEstimate(form);
    stopLoadingCycle();
    renderTeaser($('teaserPreview'), generated);
    showStep('step2');
    track('preview_generated');
  } catch (err) {
    stopLoadingCycle();
    showStep('step1');
    toast(err.message || 'Could not generate your estimate. Please try again.');
  }
}

async function handleUnlock() {
  const name = $('gateName').value.trim();
  const email = $('gateEmail').value.trim();
  const err = $('gateError');

  if (!name) {
    err.hidden = false;
    err.textContent = 'Enter your name';
    return;
  }
  if (!email || !emailValid(email)) {
    err.hidden = false;
    err.textContent = 'Enter a valid email address';
    return;
  }
  err.hidden = true;

  const btn = $('unlockBtn');
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Unlocking…';

  try {
    const { estimate } = await claimEstimate(step1Form, generated, { customerName: name, email });
    claimedEstimate = estimate;
    renderEstimate($('fullResult'), estimate);

    const link = estimate.id && !estimate.id.startsWith('local-')
      ? `${window.location.origin}/app/estimate/?id=${encodeURIComponent(estimate.id)}`
      : window.location.href;
    $('shareLink').value = link;

    showStep('step3');
    track('gate_unlocked', { email });
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message || 'Could not unlock your estimate. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

async function handleCopyShareLink() {
  try {
    await navigator.clipboard.writeText($('shareLink').value);
    toast('Share link copied.');
    track('share_link_copied');
  } catch {
    toast('Could not copy link.');
  }
}

async function handlePhoneSubmit() {
  const phone = $('phoneInput').value.trim();
  const err = $('phoneError');

  if (!phone) {
    err.hidden = false;
    err.textContent = 'Enter a phone number';
    return;
  }
  if (!claimedEstimate?.id || claimedEstimate.id.startsWith('local-')) {
    err.hidden = false;
    err.textContent = 'Could not save your phone number right now.';
    return;
  }
  err.hidden = true;

  const btn = $('phoneSubmit');
  btn.disabled = true;
  try {
    const res = await authFetch(`/api/estimates?id=${encodeURIComponent(claimedEstimate.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Merge phone into the existing meta client-side — the PATCH endpoint
      // replaces payload.meta wholesale rather than deep-merging it.
      body: JSON.stringify({ payload: { meta: { ...claimedEstimate.meta, phone } } }),
    });
    if (!res.ok) throw new Error('Could not save your phone number.');
    track('phone_captured');
    $('phoneCard').innerHTML = '<p class="phone-label">Thanks — an installer will call you within one business day.</p>';
  } catch (e) {
    err.hidden = false;
    err.textContent = e.message || 'Could not save your phone number.';
  } finally {
    btn.disabled = false;
  }
}

function clearGateError() {
  const err = $('gateError');
  if (err) err.hidden = true;
}

function bindGateBlurValidation() {
  $('gateName')?.addEventListener('input', clearGateError);
  $('gateEmail')?.addEventListener('input', clearGateError);
  $('gateEmail')?.addEventListener('blur', () => {
    const v = $('gateEmail').value.trim();
    const err = $('gateError');
    if (!v || emailValid(v)) return;
    err.hidden = false;
    err.textContent = 'Enter a valid email address';
  });
}

export function initFormFlow() {
  $('unlockBtn')?.addEventListener('click', handleUnlock);
  $('copyShareLink')?.addEventListener('click', handleCopyShareLink);
  $('phoneSubmit')?.addEventListener('click', handlePhoneSubmit);
  bindGateBlurValidation();
}
