export function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PREVIEW_PLACEHOLDER_HTML = `<div class="preview-card preview-loading"><div class="preview-spinner" aria-hidden="true"></div><div class="cap">Your garage (new floor)</div></div>`;

export function previewsNeedGeneration(data = {}) {
  if (data.previewPaths?.some((item) => item.id === 'original' && item.path)) return false;
  return !(data.previews || []).some((item) => item.id === 'original' && item.image);
}

export function estimatePayload(data) {
  return {
    analysis: data.analysis,
    pricing: data.pricing,
    design: data.design,
    meta: data.meta,
    previewContext: data.previewContext || null,
    previews: (data.previews || []).map(({ id, label, image }) => ({ id, label, image })),
    originalImage: data.originalImage,
    customerName: data.customerName || '',
    email: data.email || data.meta?.email || '',
    location: data.location || data.meta?.location || '',
  };
}

export function previewHtml(list = []) {
  return (list || [])
    .filter((item) => item?.image)
    .map((preview) => `<div class="preview-card"><img src="${preview.image}" alt="${escapeHtml(preview.label || '')}"><div class="cap">${escapeHtml(preview.label || '')}</div></div>`)
    .join('');
}

function resolveDesign(data, pricing) {
  const full = data.design || {};
  const slim = pricing?.design || {};
  return {
    ...slim,
    ...full,
    baseColorHex: full.baseColorHex || slim.baseColorHex,
    flakeColorHex: full.flakeColorHex || slim.flakeColorHex,
    baseColorLabel: full.baseColorLabel || slim.baseColorLabel,
    flakeColorLabel: full.flakeColorLabel || slim.flakeColorLabel,
    patternLabel: full.patternLabel || slim.patternLabel,
    patternDescription: full.patternDescription || slim.patternDescription,
    colorLabel: full.colorLabel || slim.colorLabel || slim.summary,
    finish: full.finish || slim.finish,
  };
}

function colorSwatchesHtml(d) {
  if (!d?.baseColorHex && !d?.flakeColorHex) {
    return `<span class="muted">${escapeHtml(d?.colorLabel || '—')}</span>`;
  }

  const chips = [];
  if (d.baseColorHex) {
    chips.push(`
      <span class="color-chip">
        <span class="swatch" style="background:${d.baseColorHex}" title="${escapeHtml(d.baseColorHex)}"></span>
        <span>${escapeHtml(d.baseColorLabel || 'Base')}</span>
      </span>`);
  }
  if (d.flakeColorHex) {
    chips.push(`
      <span class="color-chip">
        <span class="swatch" style="background:${d.flakeColorHex}" title="${escapeHtml(d.flakeColorHex)}"></span>
        <span>${escapeHtml(d.flakeColorLabel || 'Flake')}</span>
      </span>`);
  }

  return `<div class="color-chips">${chips.join('')}</div>`;
}

function selectionsBlock(d, pricing, finishKey, locationLabel) {
  const finish = pricing?.finishLabel || finishKey || '—';

  return `
    <section class="est-detail selections-block">
      <dl class="selection-grid">
        <div><dt>Finish</dt><dd>${escapeHtml(finish)}</dd></div>
        <div><dt>Colors</dt><dd class="selection-colors">${colorSwatchesHtml(d)}</dd></div>
        <div><dt>Pattern</dt><dd>${escapeHtml(d?.patternLabel || '—')}${d?.patternDescription ? `<span class="pattern-desc">${escapeHtml(d.patternDescription)}</span>` : ''}</dd></div>
        ${locationLabel ? `<div><dt>Location</dt><dd>${escapeHtml(locationLabel)}</dd></div>` : ''}
      </dl>
    </section>`;
}

function priceRange(pricing) {
  const exact = pricing.totalExact ?? roundMoney((pricing.totalLow + pricing.totalHigh) / 2);
  return { rangeLow: roundMoney(exact * 0.9), rangeHigh: roundMoney(exact * 1.1) };
}

function priceBlock(pricing) {
  const { rangeLow, rangeHigh } = priceRange(pricing);

  return `
    <div class="price-block">
      <p class="label">Estimated total</p>
      <div class="price-exact">${formatMoney(rangeLow)} – ${formatMoney(rangeHigh)}</div>
      <p class="price-note">${escapeHtml(pricing.finishLabel)} · ${Math.round(pricing.sqFt)} sq ft</p>
    </div>`;
}

function roundMoney(n) {
  return Math.round(n / 5) * 5;
}

function detailBlock(label, bodyHtml) {
  if (!bodyHtml) return '';
  return `<section class="est-detail"><p class="label">${escapeHtml(label)}</p>${bodyHtml}</section>`;
}

export function renderEstimate(target, data) {
  const { analysis, pricing, meta, previews = [], originalImage, customerName, email, location } = data;
  const d = resolveDesign(data, pricing);
  const projectLocation = location || meta?.location || '';
  const market = pricing?.market;
  const locationLabel = market?.marketLocation || projectLocation;
  const firstName = (customerName || '').trim().split(/\s+/)[0];
  const title = firstName ? `${firstName}'s Epoxy Estimate` : 'Your Epoxy Estimate';

  const sqFtLine = analysis.estimatedSqFt
    ? `<p class="sqft-line"><strong>${Math.round(analysis.estimatedSqFt)} sq ft</strong>${analysis.confidence ? ` · ${escapeHtml(analysis.confidence)} confidence` : ''}${analysis.lengthFt && analysis.widthFt ? ` · ~${analysis.lengthFt}×${analysis.widthFt} ft` : ''}</p>`
    : '';

  const scopeHtml = [
    analysis.conditionNotes ? `<p>${escapeHtml(analysis.conditionNotes)}</p>` : '',
    analysis.prepDetails ? `<p><strong>Prep:</strong> ${escapeHtml(analysis.prepDetails)}</p>` : '',
    analysis.prepLevel ? `<p class="muted tiny">Prep level: ${escapeHtml(analysis.prepLevel)}</p>` : '',
    analysis.dimensionsNote ? `<p class="muted tiny">${escapeHtml(analysis.dimensionsNote)}</p>` : '',
  ].filter(Boolean).join('');

  const lineAmount = (row) => formatMoney(row.exact ?? roundMoney((row.low + row.high) / 2));
  const previewCards = previewHtml(previews);
  const previewBlock = previewCards || previewsNeedGeneration(data)
    ? `<div class="previews-block">
      <p class="label">Floor preview — your garage with selected coating</p>
      <div class="preview-grid" id="estimatePreviews">${previewCards || PREVIEW_PLACEHOLDER_HTML}</div>
    </div>`
    : '';

  target.innerHTML = `
    <header class="est-head">
      <div>
        <p class="eyebrow">${escapeHtml(analysis?.spaceType || 'Epoxy floor estimate')}</p>
        <h2>${escapeHtml(title)}</h2>
        ${email ? `<p class="est-contact">${escapeHtml(email)}</p>` : ''}
        ${locationLabel ? `<p class="location-pill">${escapeHtml(locationLabel)}</p>` : ''}
      </div>
    </header>
    ${selectionsBlock(d, pricing, meta?.finish, locationLabel)}
    <div class="est-grid">
      <div class="est-photo"><p class="label">Uploaded photo</p><img src="${originalImage}" alt="Uploaded space"></div>
      <div class="est-summary">
        ${priceBlock(pricing)}
        ${sqFtLine}
        <p class="analysis">${escapeHtml(analysis.analysisSummary || '')}</p>
        <ul class="issues">${(analysis.surfaceIssues || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>
    </div>
    ${detailBlock('Scope & floor condition', scopeHtml)}
    <div class="line-items">
      <p class="label">Line-item breakdown</p>
      ${pricing.lineItems.map((row) => `
        <div class="line-row">
          <div><div class="name">${escapeHtml(row.label)}</div><div class="note">${escapeHtml(row.note)}</div></div>
          <div class="amt">${lineAmount(row)}</div>
        </div>`).join('')}
      <div class="line-total"><span>Total</span><span>${formatMoney(priceRange(pricing).rangeLow)} – ${formatMoney(priceRange(pricing).rangeHigh)}</span></div>
      ${pricing.minJobApplied ? '<p class="muted tiny">Local minimum job charge applied.</p>' : ''}
    </div>
    ${previewBlock}
    <footer class="est-foot">
      <p><strong>Important:</strong> Preliminary estimate only — pricing uses photo analysis and regional market research, not a live contractor bid. Final price confirmed after on-site review.</p>
      <p class="muted">Generated ${new Date(meta.generatedAt).toLocaleString()}${meta.demoMode ? ' · Demo mode' : ''}</p>
    </footer>`;
}

export function storageKey(id) {
  return `epoxygrind-estimate-${id}`;
}

export function previewContextKey(id) {
  return `epoxygrind-preview-ctx-${id}`;
}

export function saveEstimateSession(id, payload, previewContext) {
  sessionStorage.setItem(storageKey(id), JSON.stringify(payload));
  if (previewContext) {
    sessionStorage.setItem(previewContextKey(id), JSON.stringify(previewContext));
  }
}

export function loadEstimateSession(id) {
  const raw = sessionStorage.getItem(storageKey(id));
  return raw ? JSON.parse(raw) : null;
}

export function loadPreviewContext(id) {
  const raw = sessionStorage.getItem(previewContextKey(id));
  return raw ? JSON.parse(raw) : null;
}

export function updatePreviewsInDom(previews) {
  const grid = document.getElementById('estimatePreviews');
  if (grid) grid.innerHTML = previewHtml(previews);
}
