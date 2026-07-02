import { initDashboard } from '/app/shell.js';

function fillAndSync(id, value) {
  const el = document.getElementById(id);
  if (!el || !value || el.value) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function boot() {
  const user = await initDashboard({ activeNav: 'new' });
  if (!user) return;

  fillAndSync('customerEmail', user.email || '');
  fillAndSync('customerName', user.user_metadata?.full_name || user.user_metadata?.name || '');
}

boot();
