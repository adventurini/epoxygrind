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
  await Promise.all([loadUsers(), loadEstimates(), loadContractorLeads(), loadProductClicks(), loadContactMessages()]);
}

boot().catch((err) => toast(err.message || 'Failed to load admin page.'));
