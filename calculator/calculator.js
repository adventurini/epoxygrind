const ANGLES = ['door', 'corner', 'center', 'back'];

import {
  BASE_COLORS,
  FLAKE_COLORS,
  getPatternsForFinish,
} from '/lib/finish-design.js';

const $ = (id) => document.getElementById(id);

let imageDataUrl = '';
let currentEstimate = null;
let selectedPattern = 'full-broadcast';

let uploadZone, photoInput, runBtn, finishSelect, patternSelect, basePicker, flakePicker;

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

function syncPatternOptions() {
  const finish = finishSelect.value;
  const patterns = getPatternsForFinish(finish);
  if (!patterns.some((p) => p.id === selectedPattern)) {
    selectedPattern = patterns[0].id;
  }
  patternSelect.innerHTML = patterns.map((p) =>
    `<option value="${p.id}"${p.id === selectedPattern ? ' selected' : ''}>${p.label}</option>`,
  ).join('');
}

function renderPresetSwatches(container, colors, activeHex, onPick) {
  container.innerHTML = colors.map((c) =>
    `<button type="button" class="swatch${c.hex.toUpperCase() === activeHex.toUpperCase() ? ' active' : ''}" style="background:${c.hex}" title="${c.label}" data-hex="${c.hex}" aria-label="${c.label}"></button>`,
  ).join('');
  container.querySelectorAll('.swatch').forEach((btn) => {
    btn.addEventListener('click', () => onPick(btn.dataset.hex));
  });
}

function setBaseColor(hex) {
  basePicker.value = hex;
  $('baseHex').textContent = hex.toUpperCase();
  renderPresetSwatches($('baseSwatches'), BASE_COLORS, hex, setBaseColor);
}

function setFlakeColor(hex) {
  flakePicker.value = hex;
  $('flakeHex').textContent = hex.toUpperCase();
  renderPresetSwatches($('flakeSwatches'), FLAKE_COLORS, hex, setFlakeColor);
}

function syncFinishUI() {
  $('flakeColorWrap').hidden = finishSelect.value !== 'flake';
  syncPatternOptions();
}

function designChipsHtml(design) {
  if (!design) return '';
  const dots = design.flakeColorHex
    ? `<span class="dot" style="background:${design.baseColorHex}"></span><span class="dot" style="background:${design.flakeColorHex}"></span>`
    : `<span class="dot" style="background:${design.baseColorHex}"></span>`;
  return `
    <div class="design-chip">${dots}${escapeHtml(design.colorLabel)}</div>
    <div class="design-chip">${escapeHtml(design.patternLabel)}</div>`;
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

async function resizeImage(dataUrl, maxWidth = 1200) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function setPhoto(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload an image file.');
    return;
  }
  imageDataUrl = await resizeImage(await readFileAsDataUrl(file));
  $('previewImg').src = imageDataUrl;
  $('uploadEmpty').hidden = true;
  $('uploadPreview').hidden = false;
  runBtn.disabled = false;
}

function setStatus(msg, show = true) {
  const el = $('statusLine');
  el.hidden = !show || !msg;
  el.textContent = msg || '';
}

function showResults(on) {
  $('resultPlaceholder').hidden = on;
  $('resultPanel').hidden = !on;
  if (on) $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function fetchJson(url, body, timeoutMs = 90000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json();
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

function previewGridHtml(previews) {
  const byId = Object.fromEntries(previews.map((p) => [p.id, p]));
  return ANGLES.map((angleId) => {
    const p = byId[angleId];
    if (p) {
      return `
        <div class="preview-card">
          <img src="${p.image}" alt="${escapeHtml(p.label)}">
          <div class="cap">${escapeHtml(p.label)}</div>
        </div>`;
    }
    return `
      <div class="preview-card">
        <div class="preview-skeleton" aria-hidden="true"></div>
        <div class="cap">Rendering…</div>
      </div>`;
  }).join('');
}

async function runEstimate() {
  if (!imageDataUrl) return;

  runBtn.disabled = true;
  setStatus('Analyzing your photo…');

  const payload = {
    image: imageDataUrl,
    finish: finishSelect.value,
    baseColorHex: basePicker.value,
    flakeColorHex: finishSelect.value === 'flake' ? flakePicker.value : '',
    pattern: patternSelect.value,
    customerName: $('customerName').value.trim(),
    projectName: $('projectName').value.trim(),
    sqFtOverride: $('sqFtOverride').value ? Number($('sqFtOverride').value) : null,
    lengthFt: $('lengthFt').value ? Number($('lengthFt').value) : null,
    widthFt: $('widthFt').value ? Number($('widthFt').value) : null,
  };

  try {
    let analyzeRes;
    let analyzeData;
    try {
      ({ res: analyzeRes, data: analyzeData } = await fetchJson('/api/analyze', payload, 90000));
    } catch (err) {
      toast(err.name === 'AbortError' ? 'Analysis timed out — try a smaller photo.' : 'Network error — try again.');
      return;
    }

    if (!analyzeRes.ok) {
      toast(analyzeData.error || 'Analysis failed.');
      return;
    }

    $('apiNote').textContent = analyzeData.meta?.demoMode
      ? 'Demo mode — add OPENAI_API_KEY on Vercel for live AI analysis & previews.'
      : 'Live AI connected.';

    currentEstimate = {
      ...analyzeData,
      originalImage: imageDataUrl,
      previews: [],
      customerName: payload.customerName,
      projectName: payload.projectName,
    };

    renderEstimate(currentEstimate);
    $('estPreviews').innerHTML = previewGridHtml([]);
    saveEstimateToStorage(currentEstimate);
    showResults(true);
    setStatus('Pricing ready — generating 4 concept views…');

    const previews = [];
    for (let i = 0; i < ANGLES.length; i += 1) {
      const angleId = ANGLES[i];
      setStatus(`Generating preview ${i + 1} of 4…`);
      try {
        const { res, data } = await fetchJson('/api/generate-preview', {
          angleId,
          spaceDescription: analyzeData.previewContext.spaceDescription,
          finishLabel: analyzeData.previewContext.finishLabel,
          finish: analyzeData.previewContext.finish,
          designPrompt: analyzeData.previewContext.designPrompt,
          baseColorHex: analyzeData.previewContext.baseColorHex,
        }, 55000);
        if (res.ok) previews.push(data);
      } catch { /* continue */ }
      currentEstimate.previews = [...previews];
      $('estPreviews').innerHTML = previewGridHtml(previews);
    }

    currentEstimate.previews = previews.sort((a, b) => ANGLES.indexOf(a.id) - ANGLES.indexOf(b.id));
    renderEstimate(currentEstimate);
    $('estPreviews').innerHTML = previewGridHtml(currentEstimate.previews);
    saveEstimateToStorage(currentEstimate);
    setStatus(previews.length ? 'Estimate complete.' : 'Estimate ready — previews unavailable (add OPENAI_API_KEY).', true);
    setTimeout(() => setStatus(''), 4000);
  } finally {
    runBtn.disabled = !imageDataUrl;
  }
}

function renderEstimate(data) {
  const { analysis, pricing, design, meta, previews, originalImage, customerName, projectName } = data;
  $('estTitle').textContent = projectName || `${analysis.spaceType || 'Garage'} — ${design?.summary || pricing.finishLabel}`;
  $('estMeta').textContent = [
    customerName && `Prepared for ${customerName}`,
    meta.demoMode && 'Demo mode — connect OpenAI for live AI',
  ].filter(Boolean).join(' · ');
  $('estOriginal').src = originalImage;
  $('estPrice').textContent = `${formatMoney(pricing.totalLow)} – ${formatMoney(pricing.totalHigh)}`;
  $('estSqFt').textContent = `${Math.round(analysis.estimatedSqFt)} sq ft · ${pricing.finishLabel}${pricing.minJobApplied ? ' · min job applied' : ''}`;

  const designEl = $('estDesign');
  if (design || pricing.design) {
    designEl.hidden = false;
    designEl.innerHTML = designChipsHtml(design || pricing.design);
  } else designEl.hidden = true;

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

  $('estPreviews').innerHTML = previews.length
    ? previews.map((p) => `
      <div class="preview-card">
        <img src="${p.image}" alt="${escapeHtml(p.label)}">
        <div class="cap">${escapeHtml(p.label)}</div>
      </div>`).join('')
    : '<p class="muted">No previews generated — check OPENAI_API_KEY or OPENART_API_KEY on Vercel.</p>';
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
  try {
    sessionStorage.setItem(`epoxygrind-estimate-${id}`, JSON.stringify(estimatePayload(data)));
    currentEstimate._shareId = id;
  } catch { /* ok */ }
}

async function saveEstimateToSupabase(data) {
  const res = await fetch('/api/estimates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: estimatePayload(data),
      customerName: data.customerName,
      projectName: data.projectName,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Save failed');
  return json.id;
}

async function persistShareLink() {
  const id = await saveEstimateToSupabase(currentEstimate);
  currentEstimate._shareRemote = true;
  return `${location.origin}/estimate/?id=${encodeURIComponent(id)}`;
}

function downloadHtmlEstimate() {
  if (!currentEstimate) return;
  const doc = $('estimateDoc').cloneNode(true);
  doc.querySelectorAll('img').forEach((img) => img.setAttribute('src', img.src));
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Epoxy Estimate</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:32px auto;padding:0 16px;color:#11213B}img{max-width:100%;border-radius:8px}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}</style>
</head><body>${doc.outerHTML}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `epoxy-estimate-${Date.now()}.html`;
  a.click();
  toast('Estimate downloaded.');
}

function init() {
  uploadZone = $('uploadZone');
  photoInput = $('photoInput');
  runBtn = $('runCalc');
  finishSelect = $('finish');
  patternSelect = $('pattern');
  basePicker = $('baseColorPicker');
  flakePicker = $('flakeColorPicker');

  setBaseColor(basePicker.value);
  setFlakeColor(flakePicker.value);
  syncFinishUI();

  basePicker.addEventListener('input', () => setBaseColor(basePicker.value));
  flakePicker.addEventListener('input', () => setFlakeColor(flakePicker.value));

  finishSelect.addEventListener('change', () => {
    selectedPattern = getPatternsForFinish(finishSelect.value)[0].id;
    syncFinishUI();
  });
  patternSelect.addEventListener('change', () => { selectedPattern = patternSelect.value; });

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

  runBtn.addEventListener('click', runEstimate);
  $('newEstimate').addEventListener('click', () => {
    showResults(false);
    setStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('printEstimate').addEventListener('click', () => window.print());
  $('downloadEstimate').addEventListener('click', downloadHtmlEstimate);
  $('shareEstimate').addEventListener('click', async () => {
    if (!currentEstimate) return toast('Generate an estimate first.');
    try {
      const url = await persistShareLink();
      await navigator.clipboard.writeText(url);
      toast('Share link copied — works for anyone.');
    } catch {
      toast('Could not save — try Download HTML.');
    }
  });
}

init();
