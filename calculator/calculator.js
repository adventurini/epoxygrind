import { BASE_COLORS, CONCRETE_COLORS, FLAKE_COLORS, COATING_TYPES, getPatternsForFinish } from './design-options.js';
import { initBeforeAfterSlider } from './before-after-slider.js';
import { savePendingEstimate } from './submit-estimate.js';
import { track } from './analytics.js';

const $ = (id) => document.getElementById(id);

const SQFT_PRESETS = {
  '1-car': 250,
  '2-car': 450,
  '3-car': 650,
  '4-car': 850,
  basement: 800,
  patio: 300,
  // Kitchens, hallways, bedrooms, whole-floor jobs — too wide a range for a
  // single default the way "2-car garage" reliably means ~450 sq ft.
  'living-space': null,
  commercial: null,
};

// Sizes with no sensible single default — exact square footage is required,
// same treatment as commercial (also too variable to guess at).
function requiresExactSqft(size) {
  return SQFT_PRESETS[size] === null;
}

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

let imageDataUrl = '';
let selectedSize = '2-car';

const TOTAL_STEPS = 4;
let currentStep = 1;

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

function zipValid(v) {
  return /^\d{5}$/.test(v.trim());
}

function resolveSqFt() {
  const exact = Number($('exactSqft').value);
  if (exact > 0) return exact;
  return SQFT_PRESETS[selectedSize] ?? null;
}

function payload() {
  return {
    finish: $('finish').value,
    coatingType: $('coatingType').value,
    baseColor: $('baseColorPicker').value,
    flakeColor: $('finish').value === 'flake' ? $('flakeColorPicker').value : '',
    pattern: $('pattern').value,
    customerName: $('customerName').value.trim(),
    email: $('customerEmail').value.trim(),
    location: $('projectLocation').value.trim(),
    sqFtOverride: resolveSqFt(),
    image: imageDataUrl,
  };
}

function canSubmit() {
  return Boolean(
    imageDataUrl &&
    resolveSqFt() &&
    $('customerName').value.trim() &&
    $('customerEmail').value.trim() &&
    zipValid($('projectLocation').value.trim()),
  );
}

function syncSubmitState() {
  $('runCalc').disabled = !canSubmit();
  updateSubmitHint();
}

function updateSubmitHint() {
  const hint = $('submitHint');
  if (!hint) return;
  if (currentStep !== TOTAL_STEPS || canSubmit()) {
    hint.hidden = true;
    return;
  }
  const missing = [];
  if (!imageDataUrl) missing.push('a photo');
  if (!resolveSqFt()) missing.push('space size');
  if (!$('customerName').value.trim()) missing.push('your name');
  if (!$('customerEmail').value.trim()) missing.push('your email');
  if (!zipValid($('projectLocation').value.trim())) missing.push('ZIP code');
  hint.hidden = missing.length === 0;
  hint.textContent = missing.length ? `Add ${missing.join(', ')} to continue` : '';
}

function syncPatterns() {
  const finish = $('finish').value;
  const patterns = getPatternsForFinish(finish);
  const current = $('pattern').value;
  $('pattern').innerHTML = patterns.map((p) =>
    `<option value="${p.id}"${p.id === current || (!current && p.id === patterns[0].id) ? ' selected' : ''}>${p.label}</option>`,
  ).join('');
  $('flakeWrap').hidden = finish !== 'flake';
  // Concrete doesn't have a coating chemistry choice (it's not epoxy or
  // polyaspartic at all — it's the refinished slab itself), and it uses its
  // own stain-color palette, not epoxy base coats.
  $('coatingTypeWrap').hidden = finish === 'concrete';
  const baseColors = finish === 'concrete' ? CONCRETE_COLORS : BASE_COLORS;
  const baseDefault = finish === 'concrete' ? 'natural-gray' : 'charcoal';
  const currentBase = $('baseColorPicker').value;
  const baseStillValid = baseColors.some((c) => c.id === currentBase);
  setColor($('baseColorPicker'), $('baseHex'), $('baseSwatch'), $('baseSwatches'), baseColors, baseStillValid ? currentBase : baseDefault);
}

/** Swatch-only color picker — no free hex, every option is a real,
 * orderable manufacturer color/blend (see calculator/design-options.js). */
function bindSwatches(container, colors, picker, labelEl, onPick) {
  container.innerHTML = colors.map((c) =>
    `<button type="button" class="swatch${picker.value === c.id ? ' on' : ''}" style="background:${c.hex}" data-id="${c.id}" title="${c.label}"></button>`,
  ).join('');
  container.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => onPick(btn.dataset.id));
  });
}

function setColor(picker, labelEl, swatchEl, container, colors, id) {
  const color = colors.find((c) => c.id === id) || colors[0];
  picker.value = color.id;
  labelEl.textContent = color.label;
  if (swatchEl) swatchEl.style.background = color.hex;
  bindSwatches(container, colors, picker, labelEl, (nextId) => setColor(picker, labelEl, swatchEl, container, colors, nextId));
}

function selectSize(size) {
  selectedSize = size;
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.size === size);
  });
  $('exactSqft').placeholder = requiresExactSqft(size) ? 'Required for this space' : 'e.g. 450 (optional)';
  $('sizeError').hidden = true;
  syncSubmitState();
}

function showStep(n) {
  currentStep = n;
  document.querySelectorAll('.wiz-step').forEach((el) => {
    el.hidden = Number(el.dataset.step) !== n;
  });
  $('wizStepLabel').textContent = `Step ${n} of ${TOTAL_STEPS}`;
  $('wizProgressFill').style.width = `${(n / TOTAL_STEPS) * 100}%`;
  $('wizBack').hidden = n === 1;
  $('wizNext').hidden = n === TOTAL_STEPS;
  $('runCalc').hidden = n !== TOTAL_STEPS;
  updateSubmitHint();
  track('estimator_step_view', { step: n });
}

/** Step 1 (photo + space size) is the only step with real validation — the
 * others (finish/coating/colors) always have a default selected, so there's
 * nothing to block on. */
function stepValid(n) {
  if (n !== 1) return true;
  if (!imageDataUrl) {
    toast('Add a photo to continue.');
    return false;
  }
  if (!resolveSqFt()) {
    $('sizeError').hidden = false;
    $('sizeError').textContent = requiresExactSqft(selectedSize)
      ? 'Enter exact square footage for this space'
      : 'Enter your space size';
    toast('Enter your space size.');
    return false;
  }
  return true;
}

function goNext() {
  if (!stepValid(currentStep)) return;
  if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
}

function goBack() {
  if (currentStep > 1) showStep(currentStep - 1);
}

function runEstimate() {
  if (!canSubmit()) {
    if (!imageDataUrl) return toast('Add a photo to continue.');
    if (!resolveSqFt()) {
      $('sizeError').hidden = false;
      $('sizeError').textContent = selectedSize === 'commercial'
        ? 'Enter exact square footage for commercial spaces'
        : 'Enter your space size';
      return toast('Enter your space size.');
    }
    if (!$('customerName').value.trim()) return toast('Enter your name.');
    if (!$('customerEmail').value.trim()) return toast('Enter your email.');
    if (!zipValid($('projectLocation').value.trim())) {
      $('projectLocation').classList.add('invalid');
      $('zipError').hidden = false;
      $('zipError').textContent = 'Enter a 5-digit ZIP code';
      return toast('Enter a valid ZIP code.');
    }
    return;
  }

  const form = payload();
  track('step1_submitted', { size: selectedSize, finish: form.finish, pattern: form.pattern, zip: form.location });
  savePendingEstimate(form);
  window.location.href = '/app/estimate/?pending=1';
}

async function setPhoto(file) {
  if (!file?.type.startsWith('image/')) return toast('Upload an image file.');

  const errEl = $('photoError');
  errEl.hidden = true;

  if (file.size > MAX_PHOTO_BYTES) {
    errEl.hidden = false;
    errEl.textContent = 'That photo is too large — please use one under 15MB.';
    return;
  }

  const reader = new FileReader();
  const raw = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); });
  const img = new Image();
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = raw; });
  } catch {
    errEl.hidden = false;
    errEl.textContent = "This photo format isn't supported in this browser — try JPEG/PNG, or take a new photo.";
    return;
  }

  const scale = Math.min(1, 960 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  imageDataUrl = canvas.toDataURL('image/jpeg', 0.75);

  $('previewImg').src = imageDataUrl;
  $('uploadEmpty').hidden = true;
  $('uploadPreview').hidden = false;
  syncSubmitState();
  track('photo_uploaded', { sizeBytes: file.size });
}

function trackEstimatorView() {
  const hero = $('calculator');
  if (!hero) return;
  if (!('IntersectionObserver' in window)) {
    track('estimator_view');
    return;
  }
  let fired = false;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !fired) {
        fired = true;
        track('estimator_view');
        io.disconnect();
      }
    }
  }, { threshold: 0.3 });
  io.observe(hero);
}

function init() {
  if (!$('runCalc')) return;

  $('coatingType').innerHTML = COATING_TYPES.map((c) =>
    `<option value="${c.id}" title="${c.description}">${c.label}</option>`,
  ).join('');

  syncPatterns();
  setColor($('baseColorPicker'), $('baseHex'), $('baseSwatch'), $('baseSwatches'), BASE_COLORS, 'charcoal');
  setColor($('flakeColorPicker'), $('flakeHex'), $('flakeSwatch'), $('flakeSwatches'), FLAKE_COLORS, 'gravel');
  selectSize(selectedSize);
  syncSubmitState();

  $('finish').addEventListener('change', syncPatterns);

  // Bug fix: the browser's back/forward cache restores a <select>'s
  // selected value on navigating back to this page, but does NOT fire a
  // change event or re-run this init() — so the #pattern dropdown stayed
  // stuck with whatever options were rendered at the ORIGINAL page load
  // (e.g. Flake's patterns) even after #finish got restored to a different
  // value (e.g. Metallic), showing the wrong pattern list with no user
  // interaction able to trigger a resync except re-touching #finish itself.
  window.addEventListener('pageshow', (e) => { if (e.persisted) syncPatterns(); });

  const zone = $('uploadZone');
  zone.addEventListener('click', () => $('photoInput').click());
  $('changePhoto').addEventListener('click', (e) => { e.stopPropagation(); $('photoInput').click(); });
  $('photoInput').addEventListener('change', (e) => setPhoto(e.target.files[0]));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag'); setPhoto(e.dataTransfer.files[0]); });

  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectSize(btn.dataset.size));
  });
  $('exactSqft').addEventListener('input', () => {
    $('sizeError').hidden = true;
    syncSubmitState();
  });

  $('projectLocation').addEventListener('input', () => {
    $('projectLocation').classList.remove('invalid');
    $('zipError').hidden = true;
    syncSubmitState();
  });
  $('projectLocation').addEventListener('blur', () => {
    const v = $('projectLocation').value.trim();
    if (!v || zipValid(v)) return;
    $('projectLocation').classList.add('invalid');
    $('zipError').hidden = false;
    $('zipError').textContent = 'Enter a 5-digit ZIP code';
  });

  ['customerName', 'customerEmail'].forEach((id) => {
    $(id).addEventListener('input', syncSubmitState);
  });

  $('runCalc').addEventListener('click', runEstimate);
  $('wizNext').addEventListener('click', goNext);
  $('wizBack').addEventListener('click', goBack);
  showStep(1);

  initBeforeAfterSlider($('baSlider'));
  trackEstimatorView();
}

init();
