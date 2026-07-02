import { BASE_COLORS, FLAKE_COLORS, getPatternsForFinish } from './design-options.js';
import { initBeforeAfterSlider } from './before-after-slider.js';
import { initFormFlow, runGenerate } from './form-flow.js';
import { track } from './analytics.js';

const $ = (id) => document.getElementById(id);

const SQFT_PRESETS = {
  '1-car': 250,
  '2-car': 450,
  '3-car': 650,
  basement: 800,
  patio: 300,
  commercial: null,
};

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

let imageDataUrl = '';
let selectedSize = '2-car';

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
  if ($('exactSqftToggle').checked || selectedSize === 'commercial') {
    const v = Number($('exactSqft').value);
    return v > 0 ? v : null;
  }
  return SQFT_PRESETS[selectedSize] ?? null;
}

function payload() {
  return {
    finish: $('finish').value,
    baseColorHex: $('baseColorPicker').value,
    flakeColorHex: $('finish').value === 'flake' ? $('flakeColorPicker').value : '',
    pattern: $('pattern').value,
    location: $('projectLocation').value.trim(),
    sqFtOverride: resolveSqFt(),
    image: imageDataUrl,
  };
}

function canSubmit() {
  return Boolean(imageDataUrl && resolveSqFt() && zipValid($('projectLocation').value.trim()));
}

function syncSubmitState() {
  $('runCalc').disabled = !canSubmit();
}

function syncPatterns() {
  const patterns = getPatternsForFinish($('finish').value);
  const current = $('pattern').value;
  $('pattern').innerHTML = patterns.map((p) =>
    `<option value="${p.id}"${p.id === current || (!current && p.id === patterns[0].id) ? ' selected' : ''}>${p.label}</option>`,
  ).join('');
  $('flakeWrap').hidden = $('finish').value !== 'flake';
}

function bindSwatches(container, colors, picker, hexEl, onPick) {
  container.innerHTML = colors.map((c) =>
    `<button type="button" class="swatch${picker.value.toUpperCase() === c.hex.toUpperCase() ? ' on' : ''}" style="background:${c.hex}" data-hex="${c.hex}" title="${c.label}"></button>`,
  ).join('');
  container.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => onPick(btn.dataset.hex));
  });
}

const PICKER_ICON = '<svg class="picker-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20l4-4"/><path d="M14.5 4.5l5 5L9 20H4v-5L14.5 4.5z"/></svg>';

function syncPickerWrap(picker) {
  const wrap = picker.closest('.color-picker-wrap');
  if (!wrap) return;
  const swatch = wrap.querySelector('.color-picker-swatch');
  if (swatch) swatch.style.background = picker.value;
}

function setColor(picker, hexEl, container, colors, hex) {
  picker.value = hex;
  hexEl.textContent = hex.toUpperCase();
  syncPickerWrap(picker);
  bindSwatches(container, colors, picker, hexEl, (h) => setColor(picker, hexEl, container, colors, h));
}

function syncExactSqftVisibility() {
  const show = $('exactSqftToggle').checked;
  $('exactSqft').hidden = !show;
}

function selectSize(size) {
  selectedSize = size;
  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('on', btn.dataset.size === size);
  });

  const forceExact = size === 'commercial';
  $('exactSqftToggle').disabled = forceExact;
  if (forceExact) $('exactSqftToggle').checked = true;

  syncExactSqftVisibility();
  $('sizeError').hidden = true;
  syncSubmitState();
}

function submitStep1() {
  if (!canSubmit()) {
    if (!imageDataUrl) return toast('Add a photo to continue.');
    if (!resolveSqFt()) {
      $('sizeError').hidden = false;
      $('sizeError').textContent = 'Enter your space size';
      return toast('Enter your space size.');
    }
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
  runGenerate(form);
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
  $('uploadFilename').textContent = file.name || '';
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

  syncPatterns();
  setColor($('baseColorPicker'), $('baseHex'), $('baseSwatches'), BASE_COLORS, '#4A4F54');
  setColor($('flakeColorPicker'), $('flakeHex'), $('flakeSwatches'), FLAKE_COLORS, '#6B7078');
  selectSize(selectedSize);
  syncSubmitState();

  $('finish').addEventListener('change', syncPatterns);
  $('baseColorPicker').addEventListener('input', (e) => setColor($('baseColorPicker'), $('baseHex'), $('baseSwatches'), BASE_COLORS, e.target.value));
  $('flakeColorPicker').addEventListener('input', (e) => setColor($('flakeColorPicker'), $('flakeHex'), $('flakeSwatches'), FLAKE_COLORS, e.target.value));

  document.querySelectorAll('.color-picker-wrap').forEach((wrap) => {
    if (!wrap.querySelector('.picker-glyph')) {
      wrap.insertAdjacentHTML('beforeend', PICKER_ICON);
    }
    const input = wrap.querySelector('input[type=color]');
    if (input) syncPickerWrap(input);
  });

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
  $('exactSqftToggle').addEventListener('change', () => {
    syncExactSqftVisibility();
    syncSubmitState();
  });
  $('exactSqft').addEventListener('input', syncSubmitState);

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

  $('runCalc').addEventListener('click', submitStep1);

  initBeforeAfterSlider($('baSlider'));
  initFormFlow();
  trackEstimatorView();
}

init();
