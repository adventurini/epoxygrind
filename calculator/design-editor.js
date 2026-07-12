import { BASE_COLORS, CONCRETE_COLORS, FLAKE_COLORS, COATING_TYPES, getPatternsForFinish } from './design-options.js';

const FINISH_OPTIONS = [
  { id: 'solid', label: 'Solid' },
  { id: 'flake', label: 'Flake' },
  { id: 'metallic', label: 'Metallic' },
  { id: 'concrete', label: 'Polished / Stained Concrete' },
];

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function optionsHtml(list, current) {
  return list.map((item) => `<option value="${item.id}"${item.id === current ? ' selected' : ''}>${item.label}</option>`).join('');
}

/** Swatch-only picker — no free hex, every option is a real, orderable
 * manufacturer color/blend (see calculator/design-options.js). */
function swatchesHtml(colors, currentId) {
  return colors.map((c) =>
    `<button type="button" class="swatch${currentId === c.id ? ' on' : ''}" style="background:${c.hex}" data-id="${c.id}" title="${c.label}"></button>`,
  ).join('');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compact finish/pattern/color/photo editor used to regenerate an existing
 * estimate's preview image with new design choices. Deliberately separate
 * from calculator.js's homepage form (no name/email/zip here) — but DOES
 * include a photo swap, since the whole point of reopening this editor is
 * changing what's already been generated, and a wrong/blurry photo is as
 * much a reason to redo a preview as a wrong color is.
 * @param {HTMLElement} root
 * @param {{finish?:string, coatingType?:string, pattern?:string, baseColor?:string, flakeColor?:string}} current
 * @param {(fields: {finish:string, coatingType:string, pattern:string, baseColor:string, flakeColor:string, photo?:string}) => void} onRegenerate
 */
export function renderDesignEditor(root, current, onRegenerate) {
  const finish = ['solid', 'flake', 'metallic', 'concrete'].includes(current.finish) ? current.finish : 'flake';
  const coatingType = current.coatingType === 'polyaspartic' ? 'polyaspartic' : 'epoxy';
  const patterns = getPatternsForFinish(finish);
  const basePalette = finish === 'concrete' ? CONCRETE_COLORS : BASE_COLORS;
  const baseDefaultId = finish === 'concrete' ? 'natural-gray' : 'charcoal';
  const baseColor = basePalette.find((c) => c.id === current.baseColor) || basePalette.find((c) => c.id === baseDefaultId) || basePalette[0];
  const flakeColor = FLAKE_COLORS.find((c) => c.id === current.flakeColor) || FLAKE_COLORS.find((c) => c.id === 'gravel');

  root.innerHTML = `
    <div class="design-editor">
      <div class="fld full">
        <span>Photo</span>
        <div class="photo-swap-row">
          <div class="photo-swap-thumb" data-field="photoThumb" style="display:none"><img alt=""></div>
          <input type="file" accept="image/*" data-field="photoInput" hidden>
          <button type="button" class="btn btn-o btn-sm" data-field="changePhotoBtn">Change photo…</button>
          <span class="photo-swap-hint" data-field="photoHint"></span>
        </div>
      </div>
      <div class="row-2">
        <label class="fld"><span>Finish</span><select data-field="finish">${optionsHtml(FINISH_OPTIONS, finish)}</select></label>
        <label class="fld"><span>Pattern</span><select data-field="pattern">${optionsHtml(patterns, current.pattern)}</select></label>
      </div>
      <label class="fld full" data-field="coatingTypeWrap"${finish === 'concrete' ? ' hidden' : ''}><span>Coating type</span><select data-field="coatingType">${optionsHtml(COATING_TYPES, coatingType)}</select></label>
      <div class="color-block">
        <div class="fld"><span>Base color</span>
          <div class="color-line">
            <div class="color-picker-wrap">
              <span class="color-picker-swatch" data-field="baseSwatch" style="background:${baseColor.hex}"></span>
              <input type="hidden" data-field="baseColorPicker" value="${baseColor.id}">
            </div>
            <code data-field="baseHex">${baseColor.label}</code>
            <div class="swatches" data-field="baseSwatches">${swatchesHtml(basePalette, baseColor.id)}</div>
          </div>
        </div>
        <div class="fld" data-field="flakeWrap"${finish !== 'flake' ? ' hidden' : ''}><span>Flake color</span>
          <div class="color-line">
            <div class="color-picker-wrap">
              <span class="color-picker-swatch" data-field="flakeSwatch" style="background:${flakeColor.hex}"></span>
              <input type="hidden" data-field="flakeColorPicker" value="${flakeColor.id}">
            </div>
            <code data-field="flakeHex">${flakeColor.label}</code>
            <div class="swatches" data-field="flakeSwatches">${swatchesHtml(FLAKE_COLORS, flakeColor.id)}</div>
          </div>
        </div>
      </div>
      <p class="design-editor-error" data-field="regenError" hidden></p>
      <button type="button" class="btn btn-p btn-sm" data-field="regenerateBtn" style="width:100%;justify-content:center;margin-top:4px">Generate another version →</button>
    </div>`;

  const q = (sel) => root.querySelector(sel);
  let currentBasePalette = basePalette;
  let pendingPhoto = null;

  function syncPatternOptions() {
    const f = q('[data-field="finish"]').value;
    const opts = getPatternsForFinish(f);
    q('[data-field="pattern"]').innerHTML = optionsHtml(opts, opts[0].id);
    q('[data-field="flakeWrap"]').hidden = f !== 'flake';
    q('[data-field="coatingTypeWrap"]').hidden = f === 'concrete';
    currentBasePalette = f === 'concrete' ? CONCRETE_COLORS : BASE_COLORS;
    const fallbackId = f === 'concrete' ? 'natural-gray' : 'charcoal';
    const stillValid = currentBasePalette.find((c) => c.id === q('[data-field="baseColorPicker"]').value);
    setBaseColor(stillValid ? stillValid.id : fallbackId);
  }

  function setBaseColor(id) {
    const c = currentBasePalette.find((item) => item.id === id) || currentBasePalette[0];
    q('[data-field="baseColorPicker"]').value = c.id;
    q('[data-field="baseHex"]').textContent = c.label;
    q('[data-field="baseSwatch"]').style.background = c.hex;
    const container = q('[data-field="baseSwatches"]');
    container.innerHTML = swatchesHtml(currentBasePalette, c.id);
    container.querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setBaseColor(btn.dataset.id)));
  }

  function setFlakeColor(id) {
    const c = FLAKE_COLORS.find((item) => item.id === id) || FLAKE_COLORS[0];
    q('[data-field="flakeColorPicker"]').value = c.id;
    q('[data-field="flakeHex"]').textContent = c.label;
    q('[data-field="flakeSwatch"]').style.background = c.hex;
    const container = q('[data-field="flakeSwatches"]');
    container.innerHTML = swatchesHtml(FLAKE_COLORS, c.id);
    container.querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setFlakeColor(btn.dataset.id)));
  }

  function setPhotoError(msg) {
    const hint = q('[data-field="photoHint"]');
    hint.textContent = msg;
    hint.classList.toggle('err', Boolean(msg));
  }

  q('[data-field="finish"]').addEventListener('change', syncPatternOptions);
  q('[data-field="baseSwatches"]').querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setBaseColor(btn.dataset.id)));
  q('[data-field="flakeSwatches"]').querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setFlakeColor(btn.dataset.id)));

  q('[data-field="changePhotoBtn"]').addEventListener('click', () => q('[data-field="photoInput"]').click());
  q('[data-field="photoInput"]').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Please choose an image file.'); return; }
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError('Photo is too large (max 15MB).'); return; }
    setPhotoError('');
    try {
      pendingPhoto = await fileToDataUrl(file);
      const thumb = q('[data-field="photoThumb"]');
      thumb.style.display = '';
      thumb.querySelector('img').src = pendingPhoto;
      q('[data-field="changePhotoBtn"]').textContent = 'Choose a different photo…';
      setPhotoError('New photo ready — click "Generate another version" to use it.');
    } catch {
      setPhotoError('Could not read that photo — please try another.');
    }
  });

  q('[data-field="regenerateBtn"]').addEventListener('click', () => {
    const errEl = q('[data-field="regenError"]');
    errEl.hidden = true;
    const finishVal = q('[data-field="finish"]').value;
    onRegenerate({
      finish: finishVal,
      pattern: q('[data-field="pattern"]').value,
      coatingType: q('[data-field="coatingType"]').value,
      baseColor: q('[data-field="baseColorPicker"]').value,
      flakeColor: finishVal === 'flake' ? q('[data-field="flakeColorPicker"]').value : '',
      photo: pendingPhoto || undefined,
    });
  });

  /** Called by the caller's catch handler so the failure reason shows next
   * to the controls that caused it, instead of only a toast that can be
   * missed — the editor is already open and focused, so this is the most
   * likely place the user is actually looking when it fails. */
  root.showRegenError = (message) => {
    const errEl = q('[data-field="regenError"]');
    errEl.textContent = message;
    errEl.hidden = false;
  };
}
