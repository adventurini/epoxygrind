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

    tbody.innerHTML = data.products.map((p) => `
      <tr>
        <td>${escapeHtml(p.displayName)}</td>
        <td>${escapeHtml(p.merchant || '—')} ${p.isAmazon ? chip('Amazon', 'info') : ''}</td>
        <td>${p.monetized ? chip('Yes', 'ok') : chip('Not yet', 'warn')}</td>
        <td>${p.last7dClicks}</td>
        <td>${p.totalClicks}</td>
        <td>${formatDate(p.lastClickAt)}</td>
      </tr>`).join('');

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

/** Bare origin (protocol + host, no path/query/hash) — several scraped
 * website URLs carry a captcha-challenge or ad-tracking path instead of
 * the homepage (e.g. /.well-known/sgcaptcha/..., ?clickcease=block),
 * which both looks wrong here and (worse) may mean the audit crawled the
 * wrong page. Shown trimmed; the full stored value is still the href. */
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
  const search = document.getElementById('auditSearch').value.trim().toLowerCase();

  let rows = allAudits;
  if (state) rows = rows.filter((a) => a.state === state);
  if (search) rows = rows.filter((a) => (a.name || '').toLowerCase().includes(search) || (a.city || '').toLowerCase().includes(search));

  return [...rows].sort((a, b) => {
    if (sort === 'recent') return new Date(b.auditedAt || 0) - new Date(a.auditedAt || 0);
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
    const site = a.finalUrl || a.website;
    const siteCell = !a.hasWebsite
      ? chip('No website', 'bad')
      : a.siteUnreachable
        ? chip('Unreachable', 'warn')
        : site
          ? `<a class="admin-link" href="${escapeHtml(site)}" target="_blank" rel="noopener" title="${escapeHtml(site)}">${escapeHtml(siteOrigin(site))}</a>`
          : '—';
    const auditHref = a.publicToken ? `/audit-report/${slugify(a.name)}/${encodeURIComponent(a.publicToken)}` : '';
    return `
      <tr data-audit-href="${escapeHtml(auditHref)}" title="${auditHref ? 'Open this audit — same page the contractor sees on their own dashboard' : 'No audit link available'}">
        <td data-label="Business"><span class="score-badge ${scoreChipVariant(a.compositeScore)}">${a.compositeScore ?? '—'}</span> ${escapeHtml(a.name)}${a.isSelfServe ? ' ' + chip('self-serve', 'info') : ''}</td>
        <td data-label="Location">${escapeHtml(a.city || '')}${a.city && a.state ? ', ' : ''}${escapeHtml(a.state || '')}</td>
        <td data-label="Website">${siteCell}</td>
        <td data-label="Grade">${a.grade ? chip(a.grade, gradeChipVariant(a.gradeColor)) : '—'}</td>
        <td data-label="Claimed">${a.claimedAt ? chip('Claimed', 'ok') : '—'}</td>
        <td data-label="Audited">${formatDate(a.auditedAt)}</td>
      </tr>`;
  }).join('');

  document.getElementById('auditsShownCount').textContent = `Showing ${start + 1}–${Math.min(start + rows.length, filtered.length)} of ${filtered.length} (${allAudits.length} loaded).`;
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
document.getElementById('auditSearch').addEventListener('input', resetAuditsPageAndRender);
document.getElementById('auditsPrevBtn').addEventListener('click', () => { auditsPage -= 1; renderAuditsTable(); });
document.getElementById('auditsNextBtn').addEventListener('click', () => { auditsPage += 1; renderAuditsTable(); });

// Whole row opens the audit page — the same /audit-report/{token} view
// both the contractor and we see — except a click on the site's own
// outbound link, which should go to their actual website instead.
document.getElementById('auditsTableBody').addEventListener('click', (ev) => {
  if (ev.target.closest('a')) return;
  const row = ev.target.closest('tr[data-audit-href]');
  const href = row?.dataset.auditHref;
  if (href) window.open(href, '_blank', 'noopener');
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
