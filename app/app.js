import { authFetch } from '/auth/client.js';
import { initDashboard } from '/app/shell.js';

const loading = document.getElementById('appLoading');
const emptyEl = document.getElementById('appEmpty');
const listEl = document.getElementById('appList');
const statsEl = document.getElementById('dashStats');

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderList(estimates) {
  listEl.innerHTML = estimates.map((item) => {
    const range =
      item.totalLow != null && item.totalHigh != null
        ? `${formatMoney(item.totalLow)} – ${formatMoney(item.totalHigh)}`
        : 'View estimate';
    const meta = [item.location, item.spaceType, item.finishLabel].filter(Boolean).join(' · ');
    const thumb = item.thumbnail
      ? `<img class="estimate-card-thumb" src="${item.thumbnail}" alt="">`
      : '<div class="estimate-card-thumb-empty" aria-hidden="true"></div>';

    return `<a class="estimate-card" href="/app/estimate/?id=${encodeURIComponent(item.id)}">
      ${thumb}
      <div>
        <h3>${escapeHtml(item.customerName || item.spaceType || 'Floor estimate')}</h3>
        <p class="estimate-card-meta">${escapeHtml(meta || 'Epoxy floor estimate')}</p>
        <p class="estimate-card-date">${escapeHtml(formatDate(item.createdAt))}</p>
      </div>
      <div class="estimate-card-price">${escapeHtml(range)}</div>
    </a>`;
  }).join('');
}

async function loadEstimates() {
  const user = await initDashboard({ activeNav: 'overview' });
  if (!user) return;

  const res = await authFetch('/api/estimates');
  loading.hidden = true;

  if (!res.ok) {
    emptyEl.hidden = false;
    emptyEl.querySelector('p').textContent = 'Could not load estimates. Try refreshing.';
    return;
  }

  const data = await res.json();
  const estimates = data.estimates || [];

  statsEl.hidden = false;
  document.getElementById('statCount').textContent = String(estimates.length);
  document.getElementById('statRecent').textContent = estimates[0]
    ? formatDate(estimates[0].createdAt)
    : '—';

  if (!estimates.length) {
    emptyEl.hidden = false;
    return;
  }

  renderList(estimates);
  listEl.hidden = false;
}

loadEstimates();
