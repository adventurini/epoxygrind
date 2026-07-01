const ANGLES = ['door', 'corner', 'center', 'back'];

import {
  BASE_COLORS,
  FLAKE_COLORS,
  getPatternsForFinish,
} from '/lib/finish-design.js';

const $ = (id) => document.getElementById(id);

let imageDataUrl = '';
let currentEstimate = null;
let selectedBaseColor = 'charcoal';
let selectedFlakeColor = 'gray-black';
let selectedPattern = 'full-broadcast';

const uploadZone = $('uploadZone');
const photoInput = $('photoInput');
const runBtn = $('runCalc');
const finishSelect = $('finish');

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

function renderSwatches(container, colors, selectedId, name) {
  container.innerHTML = colors.map((c) => `
    <div class="swatch-wrap">
      <button type="button" class="swatch" role="radio" aria-checked="${c.id === selectedId}" aria-label="${c.label}"
        data-id="${c.id}" data-group="${name}" style="background:${c.hex}" title="${c.label}"></button>
      <span class="swatch-label">${c.label}</span>
    </div>`).join('');

  container.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-checked', 'false'));
      btn.setAttribute('aria-checked', 'true');
      if (name === 'base') {
        selectedBaseColor = btn.dataset.id;
        $('customColorNote').hidden = selectedBaseColor !== 'custom';
      } else {
        selectedFlakeColor = btn.dataset.id;
      }
    });
  });
}

function defaultPatternForFinish(finish) {
  const patterns = getPatternsForFinish(finish);
  return patterns[0]?.id || 'full-broadcast';
}

function renderPatterns(finish) {
  const patterns = getPatternsForFinish(finish);
  if (!patterns.some((p) => p.id === selectedPattern)) {
    selectedPattern = patterns[0].id;
  }
  const grid = $('patternGrid');
  grid.innerHTML = patterns.map((p) => `
    <button type="button" class="pattern-opt" role="radio" aria-checked="${p.id === selectedPattern}"
      data-id="${p.id}">
      <strong>${p.label}</strong>
      <span>${p.description}</span>
    </button>`).join('');

  grid.querySelectorAll('.pattern-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.pattern-opt').forEach((b) => b.setAttribute('aria-checked', 'false'));
      btn.setAttribute('aria-checked', 'true');
      selectedPattern = btn.dataset.id;
    });
  });
}

function syncDesignUI() {
  const finish = finishSelect.value;
  $('flakeColorField').hidden = finish !== 'flake';
  renderSwatches($('baseColorSwatches'), BASE_COLORS, selectedBaseColor, 'base');
  renderSwatches($('flakeColorSwatches'), FLAKE_COLORS, selectedFlakeColor, 'flake');
  renderPatterns(finish);
  $('customColorNote').hidden = selectedBaseColor !== 'custom';
}

finishSelect.addEventListener('change', () => {
  selectedPattern = defaultPatternForFinish(finishSelect.value);
  syncDesignUI();
});

syncDesignUI();

function designChipsHtml(design) {
  if (!design) return '';
  const baseDot = `<span class="dot" style="background:${design.baseColorHex}"></span>`;
  const flakeDot = design.flakeColorHex
    ? `<span class="dots">${baseDot}<span class="dot" style="background:${design.flakeColorHex}"></span></span>`
    : baseDot;
  return `
    <div class="design-chip">${flakeDot}${design.colorLabel}</div>
    <div class="design-chip">${design.patternLabel}</div>`;
}

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(dataUrl, maxWidth = 1400) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.88);
}

async function setPhoto(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload an image file.');
    return;
  }
  const raw = await readFileAsDataUrl(file);
  imageDataUrl = await resizeImage(raw);
  $('previewImg').src = imageDataUrl;
  $('uploadEmpty').hidden = true;
  $('uploadPreview').hidden = false;
  runBtn.disabled = false;
}

uploadZone.addEventListener('click', () => photoInput.click());
$('changePhoto').addEventListener('click', (e) => { e.stopPropagation(); photoInput.click(); });
photoInput.addEventListener('change', (e) => setPhoto(e.target.files[0]));

uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag');
  setPhoto(e.dataTransfer.files[0]);
});

function markProgress(activeStep) {
  const order = ['analyze', 'price', 'previews'];
  document.querySelectorAll('#progressSteps li').forEach((li) => {
    const key = li.dataset.step;
    const idx = order.indexOf(key);
    const activeIdx = order.indexOf(activeStep);
    li.classList.remove('active', 'done');
    if (idx >= 0 && idx < activeIdx) li.classList.add('done');
    if (key === activeStep) li.classList.add('active');
  });
}

function showPanel(name) {
  $('inputPanel').hidden = name !== 'input';
  $('progressPanel').hidden = name !== 'progress';
  $('resultPanel').hidden = name !== 'result';
}

async function runEstimate() {
  if (!imageDataUrl) return;

  showPanel('progress');
  markProgress('analyze');
  $('previewProgress').hidden = true;
  $('previewBar').style.width = '0%';
  $('previewStatus').textContent = '0 of 4 complete';

  const payload = {
    image: imageDataUrl,
    finish: finishSelect.value,
    baseColor: selectedBaseColor,
    flakeColor: selectedFlakeColor,
    pattern: selectedPattern,
    customColorNote: $('customColorNote').value.trim(),
    customerName: $('customerName').value.trim(),
    projectName: $('projectName').value.trim(),
    sqFtOverride: $('sqFtOverride').value ? Number($('sqFtOverride').value) : null,
    lengthFt: $('lengthFt').value ? Number($('lengthFt').value) : null,
    widthFt: $('widthFt').value ? Number($('widthFt').value) : null,
  };

  let analyzeRes;
  try {
    analyzeRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    toast('Network error — try again.');
    showPanel('input');
    return;
  }

  const analyzeData = await analyzeRes.json();
  if (!analyzeRes.ok) {
    toast(analyzeData.error || 'Analysis failed.');
    showPanel('input');
    return;
  }

  markProgress('price');

  const previews = [];
  $('previewProgress').hidden = false;
  markProgress('previews');

  let completed = 0;
  await Promise.all(ANGLES.map(async (angleId) => {
    try {
      const res = await fetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angleId,
          spaceDescription: analyzeData.previewContext.spaceDescription,
          finishLabel: analyzeData.previewContext.finishLabel,
          finish: analyzeData.previewContext.finish,
          designPrompt: analyzeData.previewContext.designPrompt,
          baseColorHex: analyzeData.previewContext.baseColorHex,
        }),
      });
      const data = await res.json();
      if (res.ok) previews.push(data);
    } catch {
      /* skip failed angle */
    }
    completed += 1;
    $('previewBar').style.width = `${(completed / 4) * 100}%`;
    $('previewStatus').textContent = `${completed} of 4 complete`;
  }));

  currentEstimate = {
    ...analyzeData,
    originalImage: imageDataUrl,
    previews: previews.sort((a, b) => ANGLES.indexOf(a.id) - ANGLES.indexOf(b.id)),
    customerName: payload.customerName,
    projectName: payload.projectName,
  };

  renderEstimate(currentEstimate);
  saveEstimateToStorage(currentEstimate);
  showPanel('result');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function persistShareLink() {
  if (!currentEstimate) return null;
  try {
    const id = await saveEstimateToSupabase(currentEstimate);
    currentEstimate._shareId = id;
    currentEstimate._shareRemote = true;
    return buildShareUrl(id);
  } catch {
    if (currentEstimate._shareId) return buildShareUrl(currentEstimate._shareId);
    return null;
  }
}

function renderEstimate(data) {
  const { analysis, pricing, design, meta, previews, originalImage, customerName, projectName } = data;
  const title = projectName || `${analysis.spaceType || 'Garage'} — ${design?.summary || pricing.finishLabel}`;
  $('estTitle').textContent = title;
  $('estMeta').textContent = [
    customerName && `Prepared for ${customerName}`,
    meta.demoMode && 'Demo mode',
  ].filter(Boolean).join(' · ');
  $('estOriginal').src = originalImage;
  $('estPrice').textContent = `${formatMoney(pricing.totalLow)} – ${formatMoney(pricing.totalHigh)}`;
  $('estSqFt').textContent = `${Math.round(analysis.estimatedSqFt)} sq ft · ${pricing.finishLabel}${pricing.minJobApplied ? ' · minimum job applied' : ''}`;
  const designEl = $('estDesign');
  if (design || pricing.design) {
    designEl.hidden = false;
    designEl.innerHTML = designChipsHtml(design || pricing.design);
  } else {
    designEl.hidden = true;
  }
  $('estSummary').textContent = analysis.analysisSummary || '';
  $('estIssues').innerHTML = (analysis.surfaceIssues || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  $('estGenerated').textContent = `Generated ${new Date(meta.generatedAt).toLocaleString()}`;

  $('estLineItems').innerHTML = [
    ...pricing.lineItems.map((row) => `
      <div class="line-row">
        <div><div class="name">${escapeHtml(row.label)}</div><div class="note">${escapeHtml(row.note)}</div></div>
        <div class="amt">${formatMoney(row.low)} – ${formatMoney(row.high)}</div>
      </div>`),
    `<div class="line-total"><span>Estimated total</span><span>${formatMoney(pricing.totalLow)} – ${formatMoney(pricing.totalHigh)}</span></div>`,
  ].join('');

  $('estPreviews').innerHTML = previews.map((p) => `
    <div class="preview-card">
      <img src="${p.image}" alt="${escapeHtml(p.label)}">
      <div class="cap">${escapeHtml(p.label)}</div>
    </div>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function estimatePayload(data) {
  return {
    analysis: data.analysis,
    pricing: data.pricing,
    design: data.design,
    meta: data.meta,
    previews: data.previews.map(({ id, label, image }) => ({ id, label, image })),
    originalImage: data.originalImage,
    customerName: data.customerName,
    projectName: data.projectName,
  };
}

function saveEstimateToStorage(data) {
  const id = crypto.randomUUID();
  const key = `epoxygrind-estimate-${id}`;
  const payload = estimatePayload(data);
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
    sessionStorage.setItem('epoxygrind-estimate-latest', id);
    currentEstimate._shareId = id;
    currentEstimate._sessionKey = key;
  } catch {
    toast('Estimate too large for browser storage — use Download HTML.');
  }
  return payload;
}

async function saveEstimateToSupabase(data) {
  const payload = estimatePayload(data);
  const res = await fetch('/api/estimates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload,
      customerName: data.customerName,
      projectName: data.projectName,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Save failed');
  return json.id;
}

function buildShareUrl(id) {
  return `${location.origin}/estimate/?id=${encodeURIComponent(id)}`;
}

function downloadHtmlEstimate() {
  if (!currentEstimate) return;
  const doc = $('estimateDoc').cloneNode(true);
  doc.querySelectorAll('img').forEach((img) => { img.setAttribute('src', img.src); });
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Epoxy Estimate</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>body{font-family:Inter,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#11213B}h2{font-family:Archivo,sans-serif}img{max-width:100%;border-radius:12px}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}</style>
</head><body>${doc.outerHTML}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `epoxy-estimate-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Estimate downloaded.');
}

runBtn.addEventListener('click', runEstimate);
$('newEstimate').addEventListener('click', () => showPanel('input'));
$('printEstimate').addEventListener('click', () => window.print());
$('downloadEstimate').addEventListener('click', downloadHtmlEstimate);
$('shareEstimate').addEventListener('click', async () => {
  if (!currentEstimate) {
    toast('Generate an estimate first.');
    return;
  }
  $('shareEstimate').disabled = true;
  try {
    const url = await persistShareLink();
    if (!url) throw new Error('Could not create link');
    await navigator.clipboard.writeText(url);
    toast(currentEstimate._shareRemote ? 'Share link copied — works for anyone.' : 'Link copied (browser session fallback).');
  } catch {
    toast('Could not save to cloud — use Download HTML instead.');
  } finally {
    $('shareEstimate').disabled = false;
  }
});

// Restore from share link if opened with stored session
const params = new URLSearchParams(location.search);
if (params.get('view') && sessionStorage.getItem(`epoxygrind-estimate-${params.get('view')}`)) {
  try {
    currentEstimate = JSON.parse(sessionStorage.getItem(`epoxygrind-estimate-${params.get('view')}`));
    currentEstimate._shareId = params.get('view');
    renderEstimate(currentEstimate);
    showPanel('result');
  } catch { /* ignore */ }
}
