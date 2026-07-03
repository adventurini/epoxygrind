import { BASE_COLORS, FLAKE_COLORS, COATING_TYPES, getPatternsForFinish } from './design-options.js';

const FINISH_OPTIONS = [
  { id: 'solid', label: 'Solid' },
  { id: 'flake', label: 'Flake' },
  { id: 'metallic', label: 'Metallic' },
];

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

/**
 * Compact finish/pattern/color editor used to regenerate an existing
 * estimate's preview image with new design choices. Deliberately separate
 * from calculator.js's homepage form — only the fields that affect the
 * generated image and pricing apply here (no photo/name/email/zip).
 * @param {HTMLElement} root
 * @param {{finish?:string, coatingType?:string, pattern?:string, baseColor?:string, flakeColor?:string}} current
 * @param {(fields: {finish:string, coatingType:string, pattern:string, baseColor:string, flakeColor:string}) => void} onRegenerate
 */
export function renderDesignEditor(root, current, onRegenerate) {
  const finish = ['solid', 'flake', 'metallic'].includes(current.finish) ? current.finish : 'flake';
  const coatingType = current.coatingType === 'polyaspartic' ? 'polyaspartic' : 'epoxy';
  const patterns = getPatternsForFinish(finish);
  const baseColor = BASE_COLORS.find((c) => c.id === current.baseColor) || BASE_COLORS.find((c) => c.id === 'charcoal');
  const flakeColor = FLAKE_COLORS.find((c) => c.id === current.flakeColor) || FLAKE_COLORS.find((c) => c.id === 'gravel');

  root.innerHTML = `
    <div class="design-editor">
      <div class="row-2">
        <label class="fld"><span>Finish</span><select data-field="finish">${optionsHtml(FINISH_OPTIONS, finish)}</select></label>
        <label class="fld"><span>Pattern</span><select data-field="pattern">${optionsHtml(patterns, current.pattern)}</select></label>
      </div>
      <label class="fld full"><span>Coating type</span><select data-field="coatingType">${optionsHtml(COATING_TYPES, coatingType)}</select></label>
      <div class="color-block">
        <div class="fld"><span>Base color</span>
          <div class="color-line">
            <div class="color-picker-wrap">
              <span class="color-picker-swatch" data-field="baseSwatch" style="background:${baseColor.hex}"></span>
              <input type="hidden" data-field="baseColorPicker" value="${baseColor.id}">
            </div>
            <code data-field="baseHex">${baseColor.label}</code>
            <div class="swatches" data-field="baseSwatches">${swatchesHtml(BASE_COLORS, baseColor.id)}</div>
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
      <button type="button" class="btn btn-p btn-sm" data-field="regenerateBtn" style="width:100%;justify-content:center;margin-top:4px">Generate another version →</button>
    </div>`;

  const q = (sel) => root.querySelector(sel);

  function syncPatternOptions() {
    const f = q('[data-field="finish"]').value;
    const opts = getPatternsForFinish(f);
    q('[data-field="pattern"]').innerHTML = optionsHtml(opts, opts[0].id);
    q('[data-field="flakeWrap"]').hidden = f !== 'flake';
  }

  function setBaseColor(id) {
    const c = BASE_COLORS.find((item) => item.id === id) || BASE_COLORS[0];
    q('[data-field="baseColorPicker"]').value = c.id;
    q('[data-field="baseHex"]').textContent = c.label;
    q('[data-field="baseSwatch"]').style.background = c.hex;
    const container = q('[data-field="baseSwatches"]');
    container.innerHTML = swatchesHtml(BASE_COLORS, c.id);
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

  q('[data-field="finish"]').addEventListener('change', syncPatternOptions);
  q('[data-field="baseSwatches"]').querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setBaseColor(btn.dataset.id)));
  q('[data-field="flakeSwatches"]').querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => setFlakeColor(btn.dataset.id)));

  q('[data-field="regenerateBtn"]').addEventListener('click', () => {
    const finishVal = q('[data-field="finish"]').value;
    onRegenerate({
      finish: finishVal,
      pattern: q('[data-field="pattern"]').value,
      coatingType: q('[data-field="coatingType"]').value,
      baseColor: q('[data-field="baseColorPicker"]').value,
      flakeColor: finishVal === 'flake' ? q('[data-field="flakeColorPicker"]').value : '',
    });
  });
}
