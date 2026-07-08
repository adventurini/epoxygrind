import { BASE_COLORS, FLAKE_COLORS } from '/calculator/design-options.js';
import { FLAKE_SOLID_COLORS, resolveRenderComponents } from '/lib/flake-recipes.js';
import { renderFlakeTexture, defaultSeedFor } from '/lib/flake-texture-renderer.js';

const canvas = document.getElementById('floorCanvas');
const ctx = canvas.getContext('2d');

const state = {
  baseColorId: 'charcoal',
  mode: 'stock',
  blendId: 'gravel',
  customComponents: [{ colorCode: 'F1050', pct: 50 }, { colorCode: 'F1820', pct: 50 }],
  density: 1,
  flakeSizeIn: 0.25,
};

function currentComponents() {
  return state.mode === 'custom'
    ? resolveRenderComponents({ customComponents: state.customComponents })
    : resolveRenderComponents({ blendId: state.blendId });
}

function draw() {
  const baseCoatHex = (BASE_COLORS.find((c) => c.id === state.baseColorId) || BASE_COLORS[0]).hex;
  const components = currentComponents();
  const seed = defaultSeedFor(state.density, state.flakeSizeIn);
  renderFlakeTexture({ size: canvas.width, baseCoatHex, components, density: state.density, flakeSizeIn: state.flakeSizeIn, seed }, ctx);

  document.getElementById('recipeOut').textContent = JSON.stringify(
    components.map((c) => ({ hex: c.hex, pct: Math.round(c.pct * 10) / 10 })),
    null, 2,
  );
}

// --- Base coat swatches ---
const baseSwatchesEl = document.getElementById('baseSwatches');
function renderBaseSwatches() {
  baseSwatchesEl.innerHTML = BASE_COLORS.map((c) =>
    `<button type="button" class="swatch${c.id === state.baseColorId ? ' on' : ''}" style="background:${c.hex}" data-id="${c.id}" title="${c.label}"></button>`,
  ).join('');
  baseSwatchesEl.querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => {
    state.baseColorId = btn.dataset.id;
    renderBaseSwatches();
    draw();
  }));
}

// --- Stock blend swatches ---
const blendSwatchesEl = document.getElementById('blendSwatches');
function renderBlendSwatches() {
  blendSwatchesEl.innerHTML = FLAKE_COLORS.map((c) =>
    `<button type="button" class="swatch${c.id === state.blendId ? ' on' : ''}" style="background:${c.hex}" data-id="${c.id}" title="${c.label}"></button>`,
  ).join('');
  blendSwatchesEl.querySelectorAll('.swatch').forEach((btn) => btn.addEventListener('click', () => {
    state.blendId = btn.dataset.id;
    renderBlendSwatches();
    draw();
  }));
}

// --- Mode tabs ---
document.querySelectorAll('.mode-tabs button').forEach((btn) => btn.addEventListener('click', () => {
  state.mode = btn.dataset.mode;
  document.querySelectorAll('.mode-tabs button').forEach((b) => b.classList.toggle('on', b === btn));
  document.getElementById('stockMode').classList.toggle('hidden', state.mode !== 'stock');
  document.getElementById('customMode').classList.toggle('hidden', state.mode !== 'custom');
  draw();
}));

// --- Custom component rows ---
const customRowsEl = document.getElementById('customRows');
function colorOptionsHtml(selectedCode) {
  return FLAKE_SOLID_COLORS.map((c) => `<option value="${c.code}"${c.code === selectedCode ? ' selected' : ''}>${c.name}</option>`).join('');
}
function renderCustomRows() {
  customRowsEl.innerHTML = state.customComponents.map((comp, i) => `
    <div class="custom-row" data-i="${i}">
      <select data-field="code">${colorOptionsHtml(comp.colorCode)}</select>
      <input type="number" data-field="pct" min="1" max="100" value="${comp.pct}">
      <button type="button" data-field="remove" title="Remove">×</button>
    </div>`).join('');

  customRowsEl.querySelectorAll('.custom-row').forEach((row) => {
    const i = Number(row.dataset.i);
    row.querySelector('[data-field="code"]').addEventListener('change', (e) => {
      state.customComponents[i].colorCode = e.target.value;
      draw();
    });
    row.querySelector('[data-field="pct"]').addEventListener('input', (e) => {
      state.customComponents[i].pct = Number(e.target.value) || 0;
      draw();
    });
    row.querySelector('[data-field="remove"]').addEventListener('click', () => {
      if (state.customComponents.length <= 1) return;
      state.customComponents.splice(i, 1);
      renderCustomRows();
      draw();
    });
  });
}
document.getElementById('addComponent').addEventListener('click', () => {
  const used = new Set(state.customComponents.map((c) => c.colorCode));
  const next = FLAKE_SOLID_COLORS.find((c) => !used.has(c.code)) || FLAKE_SOLID_COLORS[0];
  state.customComponents.push({ colorCode: next.code, pct: 10 });
  renderCustomRows();
  draw();
});

// --- Density slider ---
const densityEl = document.getElementById('density');
densityEl.addEventListener('input', () => {
  state.density = Number(densityEl.value);
  document.getElementById('densityValue').textContent = `${Math.round(state.density * 100)}%`;
  draw();
});

// --- Flake size segmented control ---
document.querySelectorAll('#flakeSizeSeg button').forEach((btn) => btn.addEventListener('click', () => {
  state.flakeSizeIn = Number(btn.dataset.size);
  document.querySelectorAll('#flakeSizeSeg button').forEach((b) => b.classList.toggle('on', b === btn));
  draw();
}));

renderBaseSwatches();
renderBlendSwatches();
renderCustomRows();
draw();
