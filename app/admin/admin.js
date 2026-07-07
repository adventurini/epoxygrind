import { initDashboard } from '/app/shell.js';
import { authFetch, getAuthClient } from '/auth/client.js';

const deniedEl = document.getElementById('adminDenied');
const bodyEl = document.getElementById('adminBody');
const toastEl = document.getElementById('toast');

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function chip(text, variant) {
  return `<span class="admin-chip ${variant}">${escapeHtml(text)}</span>`;
}

async function loadUsers() {
  const loading = document.getElementById('usersLoading');
  const wrap = document.getElementById('usersTableWrap');
  const tbody = document.getElementById('usersTableBody');

  try {
    const res = await authFetch('/api/admin/users');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load users.');

    document.getElementById('statUsers').textContent = String(data.users.length);
    document.getElementById('statVerified').textContent = String(data.users.filter((u) => u.emailVerified).length);

    tbody.innerHTML = data.users.map((u) => `
      <tr>
        <td>${escapeHtml(u.email)}${u.isAdmin ? ' ' + chip('admin', 'info') : ''}</td>
        <td>${escapeHtml(u.name || '—')}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>${formatDate(u.lastSignInAt)}</td>
        <td>${u.emailVerified ? chip('verified', 'ok') : chip('unverified', 'warn')}</td>
        <td>${u.isInstantDemo ? chip('demo', 'warn') : '—'}</td>
        <td>${u.creditsRemaining ?? '—'}</td>
        <td>${u.estimateCount}</td>
      </tr>`).join('');

    loading.hidden = true;
    wrap.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load users.';
  }
}

async function loadEstimates() {
  const loading = document.getElementById('estimatesLoading');
  const wrap = document.getElementById('estimatesTableWrap');
  const tbody = document.getElementById('estimatesTableBody');

  try {
    const res = await authFetch('/api/admin/estimates');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load estimates.');

    document.getElementById('statEstimates').textContent = String(data.estimates.length);

    tbody.innerHTML = data.estimates.map((e) => `
      <tr>
        <td>${formatDate(e.createdAt)}</td>
        <td>${escapeHtml(e.customerName || '—')}</td>
        <td>${escapeHtml(e.email || '—')}</td>
        <td>${escapeHtml(e.location || '—')}</td>
        <td>${escapeHtml(e.finishLabel || '—')}</td>
        <td>${e.sqFt ? Math.round(e.sqFt) : '—'}</td>
        <td>${e.totalLow != null ? `${formatMoney(e.totalLow)}–${formatMoney(e.totalHigh)}` : '—'}</td>
        <td><a class="admin-link" href="/app/estimate/?id=${encodeURIComponent(e.id)}" target="_blank">View →</a></td>
      </tr>`).join('');

    loading.hidden = true;
    wrap.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load estimates.';
  }
}

async function loadContractorLeads() {
  const loading = document.getElementById('contractorLeadsLoading');
  const wrap = document.getElementById('contractorLeadsTableWrap');
  const tbody = document.getElementById('contractorLeadsTableBody');

  try {
    const res = await authFetch('/api/admin/contractor-leads');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load contractor leads.');

    document.getElementById('statContractorLeads').textContent = String(data.leads.length);

    tbody.innerHTML = data.leads.map((l) => `
      <tr>
        <td>${formatDate(l.createdAt)}</td>
        <td>${escapeHtml(l.contractorName || '—')}</td>
        <td><a class="admin-link" href="${escapeHtml(l.sourcePath)}" target="_blank">${escapeHtml(l.sourcePath)}</a></td>
        <td>${escapeHtml(l.name)}</td>
        <td><a class="admin-link" href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a></td>
        <td>${l.phone ? `<a class="admin-link" href="tel:${escapeHtml(l.phone)}">${escapeHtml(l.phone)}</a>` : '—'}</td>
        <td>${escapeHtml(l.message || '—')}</td>
      </tr>`).join('');

    loading.hidden = true;
    wrap.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load contractor leads.';
  }
}

async function loadProductClicks() {
  const loading = document.getElementById('productClicksLoading');
  const wrap = document.getElementById('productClicksTableWrap');
  const tbody = document.getElementById('productClicksTableBody');

  try {
    const res = await authFetch('/api/admin/product-clicks');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load product clicks.');

    document.getElementById('statProductClicks').textContent = String(data.totalClicks);

    tbody.innerHTML = data.products.map((p) => {
      const pagesCell = p.pages?.length
        ? p.pages.map((page) => `<a class="admin-link" href="${escapeHtml(page)}" target="_blank" rel="noopener" style="display:block">${escapeHtml(page.replace(/^https?:\/\/[^/]+/, '') || '/')}</a>`).join('') + (p.pageCount > p.pages.length ? `<span class="tiny muted">+${p.pageCount - p.pages.length} more</span>` : '')
        : '—';
      const destCell = p.destinationUrl
        ? `<a class="admin-link" href="${escapeHtml(p.destinationUrl)}" target="_blank" rel="noopener">${escapeHtml(p.destinationUrl.replace(/^https?:\/\//, '').slice(0, 40))}${p.destinationUrl.length > 40 ? '…' : ''}</a>`
        : chip('No URL on file', 'bad');
      return `
      <tr>
        <td>${escapeHtml(p.displayName)}</td>
        <td>${escapeHtml(p.merchant || '—')} ${p.isAmazon ? chip('Amazon', 'info') : ''}</td>
        <td>${p.monetized ? chip('Yes', 'ok') : chip('Not yet', 'warn')}</td>
        <td>${pagesCell}</td>
        <td>${destCell}</td>
        <td>${p.last7dClicks}</td>
        <td>${p.totalClicks}</td>
        <td>${formatDate(p.lastClickAt)}</td>
      </tr>`;
    }).join('');

    loading.hidden = true;
    wrap.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load product clicks.';
  }
}

async function loadContactMessages() {
  const loading = document.getElementById('contactMessagesLoading');
  const wrap = document.getElementById('contactMessagesTableWrap');
  const tbody = document.getElementById('contactMessagesTableBody');

  try {
    const res = await authFetch('/api/admin/contact-messages');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load contact messages.');

    document.getElementById('statContactMessages').textContent = String(data.messages.length);

    tbody.innerHTML = data.messages.map((m) => `
      <tr>
        <td>${formatDate(m.createdAt)}</td>
        <td>${escapeHtml(m.name)}</td>
        <td><a class="admin-link" href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></td>
        <td>${escapeHtml(m.message)}</td>
        <td>${m.sourcePath ? `<a class="admin-link" href="${escapeHtml(m.sourcePath)}" target="_blank">${escapeHtml(m.sourcePath)}</a>` : '—'}</td>
      </tr>`).join('');

    loading.hidden = true;
    wrap.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load contact messages.';
  }
}

let allAudits = [];

function gradeChipVariant(color) {
  if (color === 'green' || color === 'lime') return 'ok';
  if (color === 'yellow' || color === 'orange') return 'warn';
  if (color === 'red') return 'bad';
  return 'info';
}

const AUDITS_PAGE_SIZE = 50;
let auditsPage = 1;

const PIPELINE_STAGE_META = {
  not_contacted: { label: 'Not contacted', bg: '#F0F2F6', fg: '#647189' },
  called: { label: 'Called', bg: '#E9F0FE', fg: '#1A5CD6' },
  audit_texted: { label: 'Audit texted', bg: '#E9F0FE', fg: '#1A5CD6' },
  responded: { label: 'Responded', bg: '#E8F5EE', fg: '#1B6B3A' },
  no_response: { label: 'No response', bg: '#FEF3E2', fg: '#9A6700' },
  rebuilt: { label: 'Website rebuilt', bg: '#E8F5EE', fg: '#1B6B3A' },
  lost: { label: 'Lost', bg: '#FCECEC', fg: '#B3261E' },
};

const CONTACT_METHOD_LABELS = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  in_person: 'In person',
  other: 'Other',
};

/**
 * "Odds of closing" out of 100 — NOT the same thing as compositeScore. A
 * site that's already great has nothing to sell; a site that's completely
 * broken/unreachable is a bad pitch experience and often not a real,
 * workable business. The best outreach target does some things okay but
 * has real, visible, fixable gaps — a bell curve peaking in the
 * "middling — clearly room to improve" band, not a straight worst-first
 * sort. Piecewise-linear over a few hand-picked control points rather than
 * a formula, so the shape stays easy to reason about and retune.
 */
const CLOSEABILITY_CURVE = [
  [0, 2], [20, 15], [35, 45], [50, 85], [62, 100], [72, 95], [82, 60], [90, 25], [100, 5],
];

function closeabilityFromScore(score) {
  const pts = CLOSEABILITY_CURVE;
  if (score <= pts[0][0]) return pts[0][1];
  if (score >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (score >= x0 && score <= x1) {
      const t = (score - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 0;
}

/** @returns {number|null} null means "not applicable to this ranking" (no website — a different pitch entirely) */
function closeScoreFor(a) {
  if (!a.hasWebsite) return null;
  if (a.outreachExcludedReason || a.siteUnreachable) return 0;
  if (a.compositeScore == null) return null;
  let score = closeabilityFromScore(a.compositeScore);
  // Already claimed their listing == already know about us and engaged on
  // their own terms — not a cold-outreach target anymore, so it shouldn't
  // dominate the default "who do we call next" view.
  if (a.claimedAt) score = Math.round(score * 0.15);
  return score;
}

/** Cosmetic-only name slug for the audit share URL — never used to look up
 * the audit (the token still does that), just makes the link readable. */
function slugify(name) {
  return String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'listing';
}

function scoreChipVariant(score) {
  if (score == null) return 'info';
  if (score >= 80) return 'ok';
  if (score >= 55) return 'warn';
  return 'bad';
}

/** Bare homepage URL (protocol + host + "/", no path/query/hash) — some
 * stored website values carry a path/tracking param (a captcha-challenge
 * redirect the crawler hit, an ad-tracking query string, etc.), which both
 * looks wrong here and can send a click somewhere other than the homepage.
 * Used for BOTH the displayed text and the actual href now — normalize
 * once, use everywhere, rather than only cleaning up what's shown. */
function siteHomepage(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return url;
  }
}

function siteOrigin(url) {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

function getFilteredSortedAudits() {
  const sort = document.getElementById('auditSort').value;
  const state = document.getElementById('auditState').value;
  const pipelineStage = document.getElementById('auditPipelineStage').value;
  const contactMethod = document.getElementById('auditContactMethod').value;
  const search = document.getElementById('auditSearch').value.trim().toLowerCase();
  const showBroken = document.getElementById('auditShowBroken').checked;

  let rows = allAudits;
  if (!showBroken) rows = rows.filter((a) => !a.crawlLooksBlocked && !a.siteUnreachable);
  if (state) rows = rows.filter((a) => a.state === state);
  if (pipelineStage) rows = rows.filter((a) => (a.pipelineStage || 'not_contacted') === pipelineStage);
  if (contactMethod === 'never') rows = rows.filter((a) => !a.lastContactMethod);
  else if (contactMethod) rows = rows.filter((a) => a.lastContactMethod === contactMethod);
  if (search) rows = rows.filter((a) => (a.name || '').toLowerCase().includes(search) || (a.city || '').toLowerCase().includes(search));

  return [...rows].sort((a, b) => {
    if (sort === 'recent') return new Date(b.auditedAt || 0) - new Date(a.auditedAt || 0);
    if (sort === 'closeability') {
      const ac = closeScoreFor(a);
      const bc = closeScoreFor(b);
      if (ac == null && bc == null) return 0;
      if (ac == null) return 1; // not-applicable rows always sink to the bottom
      if (bc == null) return -1;
      return bc - ac;
    }
    const as = a.compositeScore ?? 999;
    const bs = b.compositeScore ?? 999;
    return as - bs;
  });
}

function renderAuditsTable() {
  const tbody = document.getElementById('auditsTableBody');
  const filtered = getFilteredSortedAudits();

  const pageCount = Math.max(1, Math.ceil(filtered.length / AUDITS_PAGE_SIZE));
  auditsPage = Math.min(Math.max(1, auditsPage), pageCount);
  const start = (auditsPage - 1) * AUDITS_PAGE_SIZE;
  const rows = filtered.slice(start, start + AUDITS_PAGE_SIZE);

  tbody.innerHTML = rows.map((a) => {
    // Link to the source-of-truth website (contractors.website — always a
    // clean homepage URL), never audits.final_url: for ~4.5% of audits the
    // crawl landed on a bot-block/captcha interstitial instead of the real
    // site, and final_url reflects wherever it actually landed.
    const site = a.website;
    const siteCell = !a.hasWebsite
      ? chip('No website', 'bad')
      : a.siteUnreachable
        ? chip('Unreachable', 'warn')
        : site
          ? `<a class="admin-link" href="${escapeHtml(siteHomepage(site))}" target="_blank" rel="noopener" title="${escapeHtml(siteHomepage(site))}">${escapeHtml(siteOrigin(site))}</a>`
          : '—';
    const auditHref = a.publicToken ? `/audit-report/${slugify(a.name)}/${encodeURIComponent(a.publicToken)}` : '';
    const outreachCell = a.outreachExcludedReason === 'crawl_blocked'
      ? chip('No outreach — crawl blocked', 'bad')
      : a.outreachExcludedReason === 'unreachable'
        ? chip('No outreach — unreachable', 'bad')
        : chip('Eligible', 'ok');
    const phoneCell = a.phone
      ? `<a class="admin-link" href="tel:${escapeHtml(a.phone.replace(/[^\d+]/g, ''))}">${escapeHtml(a.phone)}</a>`
      : '—';
    const auditCell = auditHref
      ? `<a class="btn btn-o btn-sm" href="${escapeHtml(auditHref)}" target="_blank" rel="noopener">View audit →</a>`
      : '—';
    const listingCell = a.listingUrl
      ? `<a class="btn btn-o btn-sm" href="${escapeHtml(a.listingUrl)}" target="_blank" rel="noopener">View listing →</a>`
      : chip('Not in directory', 'warn');
    const stageMeta = PIPELINE_STAGE_META[a.pipelineStage] || PIPELINE_STAGE_META.not_contacted;
    const closeScore = closeScoreFor(a);
    const oddsCell = closeScore == null ? '—' : `<span class="score-badge ${scoreChipVariant(closeScore)}">${closeScore}</span>`;
    const lastContactCell = a.lastContactMethod
      ? `${CONTACT_METHOD_LABELS[a.lastContactMethod] || a.lastContactMethod} · ${formatDate(a.lastContactedAt)}`
      : '—';
    return `
      <tr data-contractor-id="${a.contractorId}" data-contractor-name="${escapeHtml(a.name)}" data-contractor-location="${escapeHtml(a.city || '')}${a.city && a.state ? ', ' : ''}${escapeHtml(a.state || '')}">
        <td data-label="Business"><span class="score-badge ${scoreChipVariant(a.compositeScore)}">${a.compositeScore ?? '—'}</span> ${escapeHtml(a.name)}${a.isSelfServe ? ' ' + chip('self-serve', 'info') : ''}</td>
        <td data-label="Location">${escapeHtml(a.city || '')}${a.city && a.state ? ', ' : ''}${escapeHtml(a.state || '')}</td>
        <td data-label="Phone">${phoneCell}</td>
        <td data-label="Website">${siteCell}</td>
        <td data-label="Grade">${a.grade ? chip(a.grade, gradeChipVariant(a.gradeColor)) : '—'}</td>
        <td data-label="Odds">${oddsCell}</td>
        <td data-label="Outreach">${outreachCell}</td>
        <td data-label="Pipeline"><span class="pipeline-stage-chip" style="background:${stageMeta.bg};color:${stageMeta.fg}">${stageMeta.label}</span></td>
        <td data-label="Last contact">${lastContactCell}</td>
        <td data-label="Claimed">${a.claimedAt ? chip('Claimed', 'ok') : '—'}</td>
        <td data-label="Audited">${formatDate(a.auditedAt)}</td>
        <td data-label="Audit">${auditCell}</td>
        <td data-label="Directory">${listingCell}</td>
        <td data-label="">${a.outreachExcludedReason ? `<button type="button" class="btn btn-o btn-sm recrawl-btn" data-contractor-id="${a.contractorId}">Recrawl</button>` : ''}</td>
      </tr>`;
  }).join('');

  const isFiltered = filtered.length !== allAudits.length;
  const rangeText = `Showing ${start + 1}–${Math.min(start + rows.length, filtered.length)} of ${filtered.length}${isFiltered ? ' matching audits' : ' audits'}`;
  document.getElementById('auditsShownCount').textContent = isFiltered ? `${rangeText} (${allAudits.length} total).` : `${rangeText}.`;
  document.getElementById('auditsPageIndicator').textContent = `Page ${auditsPage} of ${pageCount}`;
  document.getElementById('auditsPrevBtn').disabled = auditsPage <= 1;
  document.getElementById('auditsNextBtn').disabled = auditsPage >= pageCount;
}

async function loadAudits() {
  const loading = document.getElementById('auditsLoading');
  const wrap = document.getElementById('auditsTableWrap');

  try {
    const res = await authFetch('/api/admin/audits');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load audits.');

    allAudits = data.audits;

    document.getElementById('statAuditsTotal').textContent = String(data.stats.total);
    document.getElementById('statAuditsAvg').textContent = data.stats.avgScore ?? '—';
    document.getElementById('statAuditsNoSite').textContent = String(data.stats.noWebsite);
    document.getElementById('statAuditsClaimed').textContent = String(data.stats.claimed);

    const states = [...new Set(allAudits.map((a) => a.state).filter(Boolean))].sort();
    const stateSelect = document.getElementById('auditState');
    stateSelect.innerHTML = '<option value="">All states</option>' + states.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

    const brokenCount = allAudits.filter((a) => a.crawlLooksBlocked || a.siteUnreachable).length;
    document.getElementById('auditBrokenCount').textContent = brokenCount ? `(${brokenCount})` : '';

    renderAuditsTable();

    loading.hidden = true;
    wrap.hidden = false;
  } catch (err) {
    loading.textContent = err.message || 'Could not load audits.';
  }
}

function resetAuditsPageAndRender() { auditsPage = 1; renderAuditsTable(); }
document.getElementById('auditSort').addEventListener('change', resetAuditsPageAndRender);
document.getElementById('auditState').addEventListener('change', resetAuditsPageAndRender);
document.getElementById('auditPipelineStage').addEventListener('change', resetAuditsPageAndRender);
document.getElementById('auditContactMethod').addEventListener('change', resetAuditsPageAndRender);
document.getElementById('auditSearch').addEventListener('input', resetAuditsPageAndRender);
document.getElementById('auditShowBroken').addEventListener('change', resetAuditsPageAndRender);
document.getElementById('auditsPrevBtn').addEventListener('click', () => { auditsPage -= 1; renderAuditsTable(); });
document.getElementById('auditsNextBtn').addEventListener('click', () => { auditsPage += 1; renderAuditsTable(); });

document.getElementById('auditsTableBody').addEventListener('click', async (ev) => {
  const recrawlBtn = ev.target.closest('.recrawl-btn');
  if (!recrawlBtn) return;

  const contractorId = Number(recrawlBtn.dataset.contractorId);
  recrawlBtn.disabled = true;
  const originalLabel = recrawlBtn.textContent;
  recrawlBtn.textContent = 'Recrawling…';
  try {
    const res = await authFetch('/api/admin/recrawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractorId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recrawl failed.');
    await loadAudits();
  } catch (err) {
    recrawlBtn.disabled = false;
    recrawlBtn.textContent = originalLabel;
    toast(err.message || 'Recrawl failed.');
  }
});

document.getElementById('auditsTableBody').addEventListener('click', (ev) => {
  if (ev.target.closest('a, button')) return;
  const row = ev.target.closest('tr[data-contractor-id]');
  if (row) openPipelinePanel(Number(row.dataset.contractorId), row.dataset.contractorName, row.dataset.contractorLocation);
});

let currentPipelineContractorId = null;

function renderPipelineNotes(notes) {
  const el = document.getElementById('pipelineNotes');
  if (!notes.length) { el.innerHTML = '<p class="tiny muted">No notes yet.</p>'; return; }
  el.innerHTML = notes.map((n) => `
    <div class="pipeline-note">
      ${n.method ? chip(CONTACT_METHOD_LABELS[n.method] || n.method, 'info') : ''}
      <p class="pipeline-note-text">${escapeHtml(n.note)}</p>
      <p class="pipeline-note-time">${new Date(n.createdAt).toLocaleString()}</p>
    </div>`).join('');
}

async function openPipelinePanel(contractorId, name, location) {
  currentPipelineContractorId = contractorId;
  document.getElementById('pipelineName').textContent = name;
  document.getElementById('pipelineLocation').textContent = location;
  document.getElementById('pipelineNewNote').value = '';
  document.getElementById('pipelineContactMethod').value = '';
  document.getElementById('pipelineLastContact').textContent = '';
  document.getElementById('pipelineBackdrop').hidden = false;
  document.getElementById('pipelinePanel').hidden = false;

  try {
    const res = await authFetch(`/api/admin/pipeline?contractorId=${contractorId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load pipeline data.');
    document.getElementById('pipelineStage').value = data.stage;
    document.getElementById('pipelineAnswered').value = data.answered === null ? '' : String(data.answered);
    document.getElementById('pipelineLastContact').textContent = data.lastContact
      ? `Last contact: ${CONTACT_METHOD_LABELS[data.lastContact.method] || data.lastContact.method} — ${new Date(data.lastContact.at).toLocaleString()}`
      : 'No contact logged yet.';
    renderPipelineNotes(data.notes);
  } catch (err) {
    toast(err.message || 'Could not load pipeline data.');
  }
}

function closePipelinePanel() {
  document.getElementById('pipelineBackdrop').hidden = true;
  document.getElementById('pipelinePanel').hidden = true;
  currentPipelineContractorId = null;
}

document.getElementById('pipelineCloseBtn').addEventListener('click', closePipelinePanel);
document.getElementById('pipelineBackdrop').addEventListener('click', closePipelinePanel);

async function savePipelineField(field, value) {
  if (!currentPipelineContractorId) return;
  try {
    const res = await authFetch('/api/admin/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractorId: currentPipelineContractorId, [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save.');
    await loadAudits();
  } catch (err) {
    toast(err.message || 'Could not save.');
  }
}

document.getElementById('pipelineStage').addEventListener('change', (ev) => savePipelineField('stage', ev.target.value));
document.getElementById('pipelineAnswered').addEventListener('change', (ev) => savePipelineField('answered', ev.target.value === '' ? null : ev.target.value === 'true'));

document.getElementById('pipelineAddNoteBtn').addEventListener('click', async () => {
  const textarea = document.getElementById('pipelineNewNote');
  const methodSelect = document.getElementById('pipelineContactMethod');
  const note = textarea.value.trim();
  const method = methodSelect.value || undefined;
  if (!note || !currentPipelineContractorId) return;
  const btn = document.getElementById('pipelineAddNoteBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/api/admin/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractorId: currentPipelineContractorId, note, method }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save note.');
    textarea.value = '';
    methodSelect.value = '';
    const notesRes = await authFetch(`/api/admin/pipeline?contractorId=${currentPipelineContractorId}`);
    const notesData = await notesRes.json();
    renderPipelineNotes(notesData.notes || []);
    document.getElementById('pipelineLastContact').textContent = notesData.lastContact
      ? `Last contact: ${CONTACT_METHOD_LABELS[notesData.lastContact.method] || notesData.lastContact.method} — ${new Date(notesData.lastContact.at).toLocaleString()}`
      : 'No contact logged yet.';
    if (method) await loadAudits(); // a new logged contact changes the table's "Last contact" column/filter results
  } catch (err) {
    toast(err.message || 'Could not save note.');
  } finally {
    btn.disabled = false;
  }
});

async function boot() {
  const user = await initDashboard({ activeNav: 'admin' });
  if (!user) return;

  let isAdmin = false;
  try {
    const supabase = await getAuthClient();
    const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
    isAdmin = data?.is_admin === true;
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) {
    deniedEl.hidden = false;
    return;
  }

  bodyEl.hidden = false;
  await Promise.all([loadUsers(), loadEstimates(), loadContractorLeads(), loadProductClicks(), loadContactMessages(), loadAudits()]);
}

boot().catch((err) => toast(err.message || 'Failed to load admin page.'));
