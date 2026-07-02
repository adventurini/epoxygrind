import { BASE_COLORS, FLAKE_COLORS, COATING_TYPES, getPatternsForFinish } from './design-options.js';

const FINISH_OPTIONS = [
  { id: 'solid', label: 'Solid' },
  { id: 'flake', label: 'Flake' },
  { id: 'metallic', label: 'Metallic' },
];

const PICKER_ICON = '<svg class="picker-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20l4-4"/><path d="M14.5 4.5l5 5L9 20H4v-5L14.5 4.5z"/></svg>';

function optionsHtml(list, current) {
  return list.map((item) => `<option value="${item.id}"${item.id === current ? ' selected' : ''}>${item.label}</option>`).join('');
}

function swatchesHtml(colors, currentHex) {
  const hex = (currentHex || '').toUpperCase();
  return colors.map((c) =>
    `<button type="button" class="swatch${hex === c.hex.toUpperCase() ? ' on' : ''}" style="background:${c.hex}" data-hex="${c.hex}" title="${c.label}"></button>`,
  ).join('');
}

/**
 * Compact finish/pattern/color editor used to regenerate an existing
 * estimate's preview image with new design choices. Deliberately separate
 * from calculator.js's homepage form — only the fields that affect the
 * generated image and pricing apply here (no photo/name/email/zip).
 * @param {HTMLElement} root
 * @param {{finish?:string, coatingType?:string, pattern?:string, baseColorHex?:string, flakeColorHex?:string}} current
 * @param {(fields: {finish:string, coatingType:string, pattern:string, baseColorHex:string, flakeColorHex:string}) => void} onRegenerate
 */
export function renderDesignEditor(root, current, onRegenerate) {
  const finish = ['solid', 'flake', 'metallic'].includes(current.finish) ? current.finish : 'flake';
  const coatingType = current.coatingType === 'polyaspartic' ? 'polyaspartic' : 'epoxy';
  const patterns = getPatternsForFinish(finish);
  const baseHex = current.baseColorHex || '#4A4F54';
  const flakeHex = current.flakeColorHex || '#6B7078';

  root.innerHTML = `
    <div class="design-editor">
      <div class="row-2">
        <label class="fld"><span>Finish</span><select data-field="finish">${optionsHtml(FINISH_OPTIONS, finish)}</select></label>
        <label class="fld"><span>Pattern</span><select data-field="pattern">${optionsHtml(patterns, current.pattern)}</select></label>
      </div>
      <label class="fld full"><span>Coating type</span><select data-field="coatingType">${optionsHtml(COATING_TYPES, coatingType)}</select></label>
      <div class="color-block">
        <label class="fld"><span>Base color</span>
          <div class="color-line">
            <div class="color-picker-wrap">
              <span class="color-picker-swatch" style="background:${baseHex}"></span>
              <input type="color" data-field="baseColorPicker" value="${baseHex}" aria-label="Pick base color">
              ${PICKER_ICON}
            </div>
            <code data-field="baseHex">${baseHex.toUpperCase()}</code>
            <div class="swatches" data-field="baseSwatches">${swatchesHtml(BASE_COLORS, baseHex)}</div>
          </div>
        </label>
        <label class="fld" data-field="flakeWrap"${finish !== 'flake' ? ' hidden' : ''}><span>Flake color</span>
          <div class="color-line">
            <div class="color-picker-wrap">
              <span class="color-picker-swatch" style="background:${flakeHex}"></span>
              <input type="color" data-field="flakeColorPicker" value="${flakeHex}" aria-label="Pick flake color">
              ${PICKER_ICON}
            </div>
            <code data-field="flakeHex">${flakeHex.toUpperCase()}</code>
            <div class="swatches" data-field="flakeSwatches">${swatchesHtml(FLAKE_COLORS, flakeHex)}</div>
          </div>
        </label>
      </div>
      <button type="button" class="btn btn-p btn-sm" data-field="regenerateBtn" style="width:100%;justify-content:center;margin-top:4px">Regenerate preview →</button>
    </div>`;

  const q = (sel) => root.querySelector(sel);

  function syncPatternOptions() {
    const f = q('[data-field="finish"]').value;
    const opts = getPatternsForFinish(f);
    q('[data-field="pattern"]').innerHTML = optionsHtml(opts, opts[0].id);
    q('[data-field="flakeWrap"]').hidden = f !== 'flake';
  }

  function setBaseColor(hex) {
    q('[data-field="baseColorPicker"]').value = hex;
    q('[data-field="baseHex"]').textContent = hex.toUpperCase();
    const swatch = q('[data-field="baseColorPicker"]').closest('.color-picker-wrap')?.querySelector('.color-picker-swatch');
    if (swatch) swatch.style.background = hex;
    const container = q('[data-field="baseSwatches"]');
    container.innerHTML = swatchesHtml(BASE_COLORS, hex);
    container.querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setBaseColor(btn.dataset.hex)));
  }

  function setFlakeColor(hex) {
    q('[data-field="flakeColorPicker"]').value = hex;
    q('[data-field="flakeHex"]').textContent = hex.toUpperCase();
    const swatch = q('[data-field="flakeColorPicker"]').closest('.color-picker-wrap')?.querySelector('.color-picker-swatch');
    if (swatch) swatch.style.background = hex;
    const container = q('[data-field="flakeSwatches"]');
    container.innerHTML = swatchesHtml(FLAKE_COLORS, hex);
    container.querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setFlakeColor(btn.dataset.hex)));
  }

  q('[data-field="finish"]').addEventListener('change', syncPatternOptions);
  q('[data-field="baseColorPicker"]').addEventListener('input', (e) => setBaseColor(e.target.value));
  q('[data-field="flakeColorPicker"]').addEventListener('input', (e) => setFlakeColor(e.target.value));
  q('[data-field="baseSwatches"]').querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setBaseColor(btn.dataset.hex)));
  q('[data-field="flakeSwatches"]').querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setFlakeColor(btn.dataset.hex)));

  q('[data-field="regenerateBtn"]').addEventListener('click', () => {
    const finishVal = q('[data-field="finish"]').value;
    onRegenerate({
      finish: finishVal,
      pattern: q('[data-field="pattern"]').value,
      coatingType: q('[data-field="coatingType"]').value,
      baseColorHex: q('[data-field="baseColorPicker"]').value,
      flakeColorHex: finishVal === 'flake' ? q('[data-field="flakeColorPicker"]').value : '',
    });
  });
}
