const ANGLES = ['door', 'corner', 'center', 'back'];

import { getPatternsForFinish } from '/lib/finish-design.js';

const $ = (id) => document.getElementById(id);

let imageDataUrl = '';
let currentEstimate = null;
let selectedPattern = 'full-broadcast';

const uploadZone = $('uploadZone');
const photoInput = $('photoInput');
const runBtn = $('runCalc');
const finishSelect = $('finish');
const patternSelect = $('pattern');
const basePicker = $('baseColorPicker');
const flakePicker = $('flakeColorPicker');

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

function syncFinishUI() {
  $('flakeColorField').hidden = finishSelect.value !== 'flake';
  syncPatternOptions();
}

function bindColorPickers() {
  const syncBase = () => { $('baseHex').textContent = basePicker.value.toUpperCase(); };
  const syncFlake = () => { $('flakeHex').textContent = flakePicker.value.toUpperCase(); };
  basePicker.addEventListener('input', syncBase);
  flakePicker.addEventListener('input', syncFlake);
  syncBase();
  syncFlake();
}

finishSelect.addEventListener('change', () => {
  selectedPattern = getPatternsForFinish(finishSelect.value)[0].id;
  syncFinishUI();
});
patternSelect.addEventListener('change', () => { selectedPattern = patternSelect.value; });

syncFinishUI();
bindColorPickers();

function designChipsHtml(design) {
  if (!design) return '';
  const flakeDot = design.flakeColorHex
    ? `<span class="dot" style="background:${design.baseColorHex}"></span><span class="dot" style="background:${design.flakeColorHex}"></span>`
    : `<span class="dot" style="background:${design.baseColorHex}"></span>`;
  return `
    <div class="design-chip">${flakeDot}${escapeHtml(design.colorLabel)}</div>
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
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function setPhoto(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please upload an image.');
    return;
  }
  imageDataUrl = await resizeImage(await readFileAsDataUrl(file));
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

function setLoading(on, status, pct) {
  $('progressPanel').hidden = !on;
  if (status) $('previewStatus').textContent = status;
  if (pct != null) $('previewBar').style.width = `${pct}%`;
}

function showResults(on) {
  $('resultPanel').hidden = !on;
  if (on) $('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function runEstimate() {
  if (!imageDataUrl) return;

  setLoading(true, 'Analyzing photo…', 8);
  showResults(false);

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

  let analyzeRes;
  try {
    analyzeRes = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    toast('Network error — try again.');
    setLoading(false);
    return;
  }

  const analyzeData = await analyzeRes.json();
  if (!analyzeRes.ok) {
    toast(analyzeData.error || 'Analysis failed.');
    setLoading(false);
    return;
  }

  setLoading(true, 'Generating previews…', 25);

  const previews = [];
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
    } catch { /* skip */ }
    completed += 1;
    setLoading(true, `${completed} of 4 previews`, 25 + (completed / 4) * 70);
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
  setLoading(false);
  showResults(true);
}

function renderEstimate(data) {
  const { analysis, pricing, design, meta, previews, originalImage, customerName, projectName } = data;
  $('estTitle').textContent = projectName || `${analysis.spaceType || 'Garage'} — ${design?.summary || pricing.finishLabel}`;
  $('estMeta').textContent = [customerName && `For ${customerName}`, meta.demoMode && 'Demo mode'].filter(Boolean).join(' · ');
  $('estOriginal').src = originalImage;
  $('estPrice').textContent = `${formatMoney(pricing.totalLow)} – ${formatMoney(pricing.totalHigh)}`;
  $('estSqFt').textContent = `${Math.round(analysis.estimatedSqFt)} sq ft · ${pricing.finishLabel}`;

  const designEl = $('estDesign');
  if (design || pricing.design) {
    designEl.hidden = false;
    designEl.innerHTML = designChipsHtml(design || pricing.design);
  } else designEl.hidden = true;

  $('estSummary').textContent = analysis.analysisSummary || '';
  $('estGenerated').textContent = `Generated ${new Date(meta.generatedAt).toLocaleString()} · Estimate only, not a contract.`;

  $('estLineItems').innerHTML = [
    ...pricing.lineItems.map((row) => `
      <div class="line-row">
        <div><div class="name">${escapeHtml(row.label)}</div><div class="note">${escapeHtml(row.note)}</div></div>
        <div class="amt">${formatMoney(row.low)} – ${formatMoney(row.high)}</div>
      </div>`),
    `<div class="line-total"><span>Total</span><span>${formatMoney(pricing.totalLow)} – ${formatMoney(pricing.totalHigh)}</span></div>`,
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

function buildShareUrl(id) {
  return `${location.origin}/estimate/?id=${encodeURIComponent(id)}`;
}

async function persistShareLink() {
  try {
    const id = await saveEstimateToSupabase(currentEstimate);
    currentEstimate._shareRemote = true;
    return buildShareUrl(id);
  } catch {
    if (currentEstimate?._shareId) return buildShareUrl(currentEstimate._shareId);
    throw new Error('No link');
  }
}

function downloadHtmlEstimate() {
  if (!currentEstimate) return;
  const doc = $('estimateDoc').cloneNode(true);
  doc.querySelectorAll('img').forEach((img) => img.setAttribute('src', img.src));
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Epoxy Estimate</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:32px auto;padding:0 16px;color:#11213B}img{max-width:100%;border-radius:8px}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}</style>
</head><body>${doc.outerHTML}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `epoxy-estimate-${Date.now()}.html`;
  a.click();
  toast('Downloaded.');
}

runBtn.addEventListener('click', runEstimate);
$('newEstimate').addEventListener('click', () => {
  showResults(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('printEstimate').addEventListener('click', () => window.print());
$('downloadEstimate').addEventListener('click', downloadHtmlEstimate);
$('shareEstimate').addEventListener('click', async () => {
  if (!currentEstimate) return toast('Generate an estimate first.');
  try {
    const url = await persistShareLink();
    await navigator.clipboard.writeText(url);
    toast(currentEstimate._shareRemote ? 'Share link copied.' : 'Link copied (same browser fallback).');
  } catch {
    toast('Could not save — try Download.');
  }
});
