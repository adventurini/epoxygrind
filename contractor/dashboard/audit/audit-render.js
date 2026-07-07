import { LEARN_LINKS } from '/lib/audit/learn-links.js';

export const CATEGORY_META = {
  performance: { label: 'Performance', icon: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z' },
  mobile: { label: 'Mobile experience', icon: 'M12 18h.01M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z' },
  funnel: { label: 'Lead funnel & conversion', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  designUx: { label: 'Design & UX', icon: 'M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586 M11 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0' },
  imageQuality: { label: 'Image quality', icon: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14M4 6h16v12H4V6z' },
  seo: { label: 'SEO', icon: 'M21 21l-4.35-4.35 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' },
  localPresence: { label: 'Local presence & reputation', icon: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z' },
  security: { label: 'Security & technical', icon: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z' },
  siteStructure: { label: 'Site structure', icon: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z' },
};

export const GRADE_COLOR_VARS = { green: '#1E8E5A', lime: '#7CB342', yellow: '#C9A227', orange: '#D97706', red: '#C0392B', gray: '#8695B3' };

const CIRCUMFERENCE = 2 * Math.PI * 52;

function icon(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

export function animateMeter($, score, colorKey) {
  const fillEl = $('meterFill');
  const color = GRADE_COLOR_VARS[colorKey] || GRADE_COLOR_VARS.gray;
  fillEl.style.stroke = color;
  fillEl.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  const targetOffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score ?? 0)) / 100);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || score == null) {
    fillEl.setAttribute('stroke-dashoffset', String(score == null ? CIRCUMFERENCE : targetOffset));
    $('scoreNum').textContent = score == null ? '–' : score;
    return;
  }

  fillEl.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
  fillEl.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.16,.8,.3,1)';
  requestAnimationFrame(() => { fillEl.setAttribute('stroke-dashoffset', String(targetOffset)); });

  const start = performance.now();
  const dur = 1100;
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    $('scoreNum').textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function learnLinkHtml(label) {
  const slug = LEARN_LINKS[label];
  return slug ? `<a class="learn-link" href="/learn/${slug}/">Why this matters →</a>` : '';
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function tierLabel(tier) {
  if (tier === 'dominate') return 'Dominate';
  if (tier === 'own_your_market') return 'Own Your Market';
  return 'Launch';
}

export function renderFindings($, topFindings) {
  const list = $('findingsList');
  if (!topFindings?.length) {
    $('findingsPanel').hidden = true;
    return;
  }
  list.innerHTML = topFindings.map((f, i) => `
    <div class="finding-card">
      <div class="finding-rank">${i + 1}</div>
      <div class="finding-body">
        <p class="finding-label">${escapeHtml(f.label)}</p>
        <p class="finding-verdict">${escapeHtml(f.verdict || '')}</p>
        ${f.fix ? `<p class="finding-fix">Fix: ${escapeHtml(f.fix)}</p>` : ''}
        ${learnLinkHtml(f.label)}
      </div>
      <span class="finding-tier">${escapeHtml(tierLabel(f.tier))}</span>
    </div>
  `).join('');
}

const DIMENSION_LABELS = {
  visualHierarchy: 'Visual hierarchy',
  modernity: 'Modernity',
  brandConsistency: 'Brand consistency',
  readability: 'Readability',
  layoutIntegrity: 'Layout integrity',
  professionalTrust: 'Professional trust',
};

function renderCatDetail(cat) {
  if (cat.checks?.length) {
    return cat.checks.map((c) => `
      <div class="check-row ${c.passed ? 'pass' : 'fail'}">
        <span class="check-mark">${c.passed ? '✓' : '✗'}</span>
        <div class="check-body">
          <p class="check-label">${escapeHtml(c.label)} <span class="check-value">${escapeHtml(String(c.value ?? ''))}</span></p>
          <p class="check-verdict">${escapeHtml(c.verdict || '')}</p>
          ${!c.passed && c.fix ? `<p class="check-fix">Fix: ${escapeHtml(c.fix)}</p>` : ''}
          ${learnLinkHtml(c.label)}
        </div>
      </div>
    `).join('');
  }
  // designUx has no pass/fail checks — 6 AI-scored dimensions with a
  // justification each, on a 0-10 scale rather than 0-100.
  if (cat.dimensions?.length) {
    return cat.dimensions.map((d) => `
      <div class="check-row ${d.score >= 7 ? 'pass' : 'fail'}">
        <span class="check-mark">${d.score}/10</span>
        <div class="check-body">
          <p class="check-label">${escapeHtml(DIMENSION_LABELS[d.label] || d.label)}</p>
          <p class="check-verdict">${escapeHtml(d.justification || '')}</p>
        </div>
      </div>
    `).join('');
  }
  if (cat.error) {
    return `<p class="muted tiny">Couldn't be scored this time (${escapeHtml(cat.error)}) — didn't count against the composite score.</p>`;
  }
  return '<p class="muted tiny">No detail available for this category.</p>';
}

export function scoreColor(score) {
  if (score == null) return '#8695B3';
  if (score >= 90) return '#1E8E5A';
  if (score >= 80) return '#7CB342';
  if (score >= 70) return '#C9A227';
  if (score >= 55) return '#D97706';
  return '#C0392B';
}

export function renderCategories($, categoryScores) {
  const order = ['performance', 'mobile', 'funnel', 'designUx', 'imageQuality', 'seo', 'localPresence', 'security', 'siteStructure'];
  const list = $('catList');
  list.innerHTML = order.filter((id) => categoryScores[id]).map((id) => {
    const cat = categoryScores[id];
    const meta = CATEGORY_META[id];
    const score = cat.score;
    const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
    return `
    <details class="cat-item">
      <summary class="cat-summary">
        <span class="cat-icon">${icon(meta.icon)}</span>
        <span class="cat-name">${escapeHtml(meta.label)}</span>
        <span class="cat-mini-track"><span class="cat-mini-fill" style="width:${pct}%;background:${scoreColor(score)}"></span></span>
        <span class="cat-score">${score == null ? 'N/A' : score}</span>
        <svg class="cat-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </summary>
      <div class="cat-checks">
        ${renderCatDetail(cat)}
      </div>
    </details>`;
  }).join('');
}

export function renderImages($, categoryScores) {
  const perImage = categoryScores?.imageQuality?.perImage;
  if (!perImage?.length) return;
  $('imagesPanel').hidden = false;
  // Worst photo first — same "lead with the biggest problem" logic as
  // the top findings above, not whatever order the crawler happened to
  // find them in.
  const ranked = [...perImage].sort((a, b) => (a.combinedScore ?? 0) - (b.combinedScore ?? 0));
  $('imageStrip').innerHTML = ranked.map((img, i) => {
    const s = img.combinedScore ?? 0;
    return `
    <div class="image-card">
      <div class="image-card-thumb" style="background-image:url('${escapeAttr(img.src)}')"></div>
      <span class="image-card-rank">${i + 1}/${ranked.length}</span>
      <div class="image-card-score" style="color:${scoreColor(s)}">${s}/100</div>
      ${img.ai?.isBeforeAfter ? '<span class="image-card-tag">Before/after</span>' : ''}
    </div>`;
  }).join('');
}
