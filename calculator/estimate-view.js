import { initBeforeAfterSlider } from './before-after-slider.js';

export function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * 28;

export function previewLoadingHtml(caption) {
  return `<div class="preview-card preview-loading">
    <div class="preview-progress-ring" data-preview-progress-ring>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="28" fill="none" stroke-width="6" class="preview-progress-track"></circle>
        <circle cx="32" cy="32" r="28" fill="none" stroke-width="6" stroke-linecap="round"
          stroke-dasharray="${PROGRESS_RING_CIRCUMFERENCE}" stroke-dashoffset="${PROGRESS_RING_CIRCUMFERENCE}"
          transform="rotate(-90 32 32)" class="preview-progress-fill" data-preview-progress-fill></circle>
      </svg>
      <span class="preview-progress-pct" data-preview-progress-pct>0%</span>
    </div>
    <div class="cap">${escapeHtml(caption)}</div>
  </div>`;
}

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

/**
 * Class names here mirror the hero slider's markup (calculator/before-after-slider.js
 * + home.css): the unclipped base layer is always "ba-before" and the clipped
 * overlay revealed from the left is always "ba-after", regardless of which
 * photo is semantically before/after — swap the src, not the classes.
 */
export function beforeAfterHtml(beforeImage, afterImage, opts = {}) {
  const id = opts.id || 'estimateBaSlider';
  return `
    <div class="ba-slider est-ba-slider" id="${id}" role="slider" tabindex="0" aria-label="Drag to compare your photo and the new floor" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
      <div class="ba-slider-frame">
        <img class="ba-img ba-before" src="${afterImage}" alt="New floor preview" draggable="false">
        <div class="ba-after-wrap">
          <img class="ba-img ba-after" src="${beforeImage}" alt="Uploaded photo" draggable="false">
        </div>
        <span class="ba-chip ba-chip-before">Before</span>
        <span class="ba-chip ba-chip-after">After</span>
        <div class="ba-divider">
          <div class="ba-handle">
            <span class="ba-handle-visible">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
          </div>
        </div>
      </div>
    </div>`;
}

function photoBlockHtml(data) {
  const { originalImage, previews = [] } = data;
  const previewImage = previews.find((item) => item.id === 'original' && item.image)?.image;

  if (previewImage) {
    return `<p class="label">Before &amp; after — drag to compare</p>${beforeAfterHtml(originalImage, previewImage)}`;
  }

  if (previewsNeedGeneration(data)) {
    return `<p class="label">Uploaded photo</p>
      <div class="est-photo-generating">
        <img src="${originalImage}" alt="Uploaded space">
        ${previewLoadingHtml('Generating your floor preview…')}
      </div>`;
  }

  return `<p class="label">Uploaded photo</p><img src="${originalImage}" alt="Uploaded space">`;
}

/** Swaps a photo block into the before/after slider once the preview image is ready. */
export function renderBeforeAfterPreview(container, beforeImage, afterImage) {
  if (!container) return;
  container.innerHTML = `<p class="label">Before &amp; after — drag to compare</p>${beforeAfterHtml(beforeImage, afterImage)}`;
  initBeforeAfterSlider(container.querySelector('.ba-slider'));
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

/**
 * Splits the displayed total range across line items in proportion to each
 * item's exact amount, so the rows always sum to exactly the Total shown
 * below them — the pricing engine's own row.low/row.high can't be used
 * directly here since regional AI-researched pricing can override
 * totalExact independently of the deterministic per-row rate math. The
 * last row absorbs any rounding remainder so the sums are always exact.
 */
function lineItemRanges(pricing) {
  const { rangeLow, rangeHigh } = priceRange(pricing);
  const items = pricing.lineItems || [];
  const sumExact = items.reduce((sum, row) => sum + (row.exact ?? 0), 0) || 1;

  let allocatedLow = 0;
  let allocatedHigh = 0;
  return items.map((row, i) => {
    const isLast = i === items.length - 1;
    const share = (row.exact ?? 0) / sumExact;
    const low = isLast ? rangeLow - allocatedLow : roundMoney(rangeLow * share);
    const high = isLast ? rangeHigh - allocatedHigh : roundMoney(rangeHigh * share);
    allocatedLow += low;
    allocatedHigh += high;
    return { low, high };
  });
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

  const lineRanges = lineItemRanges(pricing);
  const lineAmount = (i) => `${formatMoney(lineRanges[i].low)} – ${formatMoney(lineRanges[i].high)}`;

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
      <div class="est-photo" id="estimatePhotoBlock">${photoBlockHtml(data)}</div>
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
      ${pricing.lineItems.map((row, i) => `
        <div class="line-row">
          <div><div class="name">${escapeHtml(row.label)}</div><div class="note">${escapeHtml(row.note)}</div></div>
          <div class="amt">${lineAmount(i)}</div>
        </div>`).join('')}
      <div class="line-total"><span>Total</span><span>${formatMoney(priceRange(pricing).rangeLow)} – ${formatMoney(priceRange(pricing).rangeHigh)}</span></div>
      ${pricing.minJobApplied ? '<p class="muted tiny">Local minimum job charge applied.</p>' : ''}
    </div>
    <footer class="est-foot">
      <p><strong>Important:</strong> Preliminary estimate only — pricing uses photo analysis and regional market research, not a live contractor bid. Final price confirmed after on-site review.</p>
      <p class="muted">Generated ${new Date(meta.generatedAt).toLocaleString()}${meta.demoMode ? ' · Demo mode' : ''}</p>
    </footer>`;

  initBeforeAfterSlider(target.querySelector('.ba-slider'));
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

