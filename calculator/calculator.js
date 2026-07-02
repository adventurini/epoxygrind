import { BASE_COLORS, FLAKE_COLORS, getPatternsForFinish } from './design-options.js';
import { savePendingEstimate } from './submit-estimate.js';

const $ = (id) => document.getElementById(id);

let imageDataUrl = '';

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

function setStatus(msg) {
  const el = $('statusLine');
  if (el) el.textContent = msg || '';
}

function payload() {
  return {
    finish: $('finish').value,
    baseColorHex: $('baseColorPicker').value,
    flakeColorHex: $('finish').value === 'flake' ? $('flakeColorPicker').value : '',
    pattern: $('pattern').value,
    customerName: $('customerName').value.trim(),
    email: $('customerEmail').value.trim(),
    location: $('projectLocation').value.trim(),
    image: imageDataUrl,
  };
}

function canSubmit() {
  return Boolean(
    imageDataUrl &&
    $('customerName').value.trim() &&
    $('customerEmail').value.trim() &&
    $('projectLocation').value.trim(),
  );
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

function runEstimate() {
  if (!canSubmit()) {
    if (!imageDataUrl) return toast('Add a photo to continue.');
    if (!$('customerName').value.trim()) return toast('Enter your name.');
    if (!$('customerEmail').value.trim()) return toast('Enter your email.');
    if (!$('projectLocation').value.trim()) return toast('Enter your ZIP code.');
    return;
  }

  savePendingEstimate(payload());
  window.location.href = '/app/estimate/?pending=1';
}

async function setPhoto(file) {
  if (!file?.type.startsWith('image/')) return toast('Upload an image file.');
  const reader = new FileReader();
  const raw = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = raw; });
  const scale = Math.min(1, 960 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  imageDataUrl = canvas.toDataURL('image/jpeg', 0.75);
  $('previewImg').src = imageDataUrl;
  $('uploadEmpty').hidden = true;
  $('uploadPreview').hidden = false;
  $('runCalc').disabled = false;
  syncSubmitState();
}

function init() {
  if (!$('runCalc')) return;

  syncPatterns();
  setColor($('baseColorPicker'), $('baseHex'), $('baseSwatches'), BASE_COLORS, '#4A4F54');
  setColor($('flakeColorPicker'), $('flakeHex'), $('flakeSwatches'), FLAKE_COLORS, '#6B7078');
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

  $('runCalc').addEventListener('click', runEstimate);
  ['customerName', 'customerEmail', 'projectLocation'].forEach((id) => {
    $(id).addEventListener('input', syncSubmitState);
  });
}

init();
