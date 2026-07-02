import { getAuthClient, requestEmailVerification, signOut, isEmailVerified } from '/auth/client.js';

const COG_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayName(user) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Account'
  );
}

function formatMemberSince(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function navLinksHtml(activeNav) {
  return `
    <a href="/app/" class="${activeNav === 'overview' ? 'active' : ''}">Overview</a>
    <a href="/app/#estimates" class="${activeNav === 'estimates' ? 'active' : ''}">My estimates</a>
    <a href="/">New estimate</a>
    <a href="/services/">Contractor services</a>`;
}

function profileHtml(user) {
  const verified = isEmailVerified(user);
  return `
    <p class="dashboard-profile-name">${escapeHtml(displayName(user))}</p>
    <p class="dashboard-profile-email">${escapeHtml(user.email || '')}</p>
    <p class="dashboard-profile-meta">Member since ${escapeHtml(formatMemberSince(user.created_at))}</p>
    <p class="dashboard-profile-credits muted tiny" id="dashCredits" hidden></p>
    <span class="verify-chip ${verified ? 'ok' : ''}">${verified ? 'Email verified' : 'Email not verified'}</span>
    <div class="dashboard-profile-actions">
      ${verified ? '' : '<button type="button" class="btn btn-p btn-sm" id="dashVerifyBtn">Verify email</button>'}
      <button type="button" class="btn btn-o btn-sm" id="dashLogoutBtn">Log out</button>
    </div>
    <p class="muted tiny" id="dashProfileMsg" hidden style="margin-top:10px"></p>`;
}

async function loadCredits(user) {
  const el = document.getElementById('dashCredits');
  if (!el || !user) return;
  try {
    const supabase = await getAuthClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('credits_remaining')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    const remaining = data?.credits_remaining ?? 5;
    el.textContent = `${remaining} free estimate${remaining === 1 ? '' : 's'} remaining`;
    el.hidden = false;
  } catch {
    /* optional — not worth surfacing a fetch error for this */
  }
}

function bindProfileActions() {
  document.getElementById('dashLogoutBtn')?.addEventListener('click', async () => {
    await signOut();
    window.location.href = '/';
  });

  document.getElementById('dashVerifyBtn')?.addEventListener('click', async () => {
    const msg = document.getElementById('dashProfileMsg');
    const btn = document.getElementById('dashVerifyBtn');
    btn.disabled = true;
    try {
      const result = await requestEmailVerification(window.location.pathname + window.location.search);
      if (msg) {
        msg.hidden = false;
        msg.textContent = result.alreadyVerified
          ? 'Your email is already verified.'
          : `Verification link sent to ${result.email}.`;
      }
    } catch (err) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = err.message || 'Could not send verification email.';
      }
    } finally {
      btn.disabled = false;
    }
  });
}

function closeDashboardOverlays() {
  document.getElementById('dashDrawer')?.classList.remove('open');
  document.getElementById('dashSettingsPanel')?.classList.remove('open');
  document.getElementById('dashBackdrop')?.classList.remove('open');
  document.getElementById('dashMenuBtn')?.setAttribute('aria-expanded', 'false');
  document.getElementById('dashSettingsBtn')?.setAttribute('aria-expanded', 'false');
}

function bindDashboardChrome() {
  const menuBtn = document.getElementById('dashMenuBtn');
  const settingsBtn = document.getElementById('dashSettingsBtn');
  const drawer = document.getElementById('dashDrawer');
  const settingsPanel = document.getElementById('dashSettingsPanel');
  const backdrop = document.getElementById('dashBackdrop');

  menuBtn?.addEventListener('click', () => {
    const open = drawer?.classList.toggle('open');
    settingsPanel?.classList.remove('open');
    backdrop?.classList.toggle('open', Boolean(open));
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    settingsBtn?.setAttribute('aria-expanded', 'false');
  });

  settingsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = settingsPanel?.classList.toggle('open');
    drawer?.classList.remove('open');
    backdrop?.classList.toggle('open', Boolean(open));
    settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn?.setAttribute('aria-expanded', 'false');
  });

  backdrop?.addEventListener('click', closeDashboardOverlays);

  drawer?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeDashboardOverlays);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDashboardOverlays();
  });

  document.addEventListener('click', (event) => {
    if (!settingsPanel?.classList.contains('open')) return;
    if (settingsPanel.contains(event.target) || settingsBtn?.contains(event.target)) return;
    settingsPanel.classList.remove('open');
    backdrop?.classList.remove('open');
    settingsBtn?.setAttribute('aria-expanded', 'false');
  });
}

function updateSettingsPanel(user) {
  const panel = document.getElementById('dashSettingsBody');
  const btn = document.getElementById('dashSettingsBtn');
  if (!panel || !btn) return;

  if (!user) {
    panel.innerHTML = '<p class="muted">Sign in to manage your account.</p>';
    btn.hidden = true;
    return;
  }

  btn.hidden = false;
  panel.innerHTML = profileHtml(user);
  bindProfileActions();
  void loadCredits(user);
}

/**
 * Called right after an instant sign-in completes, when the session may
 * still be a beat behind on the shared auth client. A single failed/empty
 * check used to leave the settings panel stuck on "Sign in to manage your
 * account" — hiding the verify-email button — forever, since nothing ever
 * re-checked it. Retries briefly instead of giving up on the first try.
 */
export async function refreshDashboardProfile() {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const supabase = await getAuthClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      console.debug('[refreshDashboardProfile] attempt', attempt, 'user:', user?.email, 'error:', error?.message);
      if (user) {
        updateSettingsPanel(user);
        return user;
      }
    } catch (err) {
      console.debug('[refreshDashboardProfile] attempt', attempt, 'threw:', err.message);
      /* retry below */
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return null;
}

export async function initDashboard(options = {}) {
  const activeNav = options.activeNav || 'overview';
  const requireAuth = options.requireAuth !== false;
  const root = document.getElementById('dashboardRoot');
  if (!root) return null;

  let user = null;
  try {
    const supabase = await getAuthClient();
    const { data: { user: current } } = await supabase.auth.getUser();
    user = current;
    if (!user && requireAuth) {
      window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return null;
    }
  } catch {
    if (requireAuth) {
      window.location.href = '/login/';
      return null;
    }
  }

  root.innerHTML = `
    <div class="dashboard-shell">
      <header class="dashboard-header no-print">
        <button type="button" class="dash-icon-btn" id="dashMenuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="dashDrawer">☰</button>
        <a class="dashboard-brand" href="/app/"><img src="/logo.png" alt=""> EpoxyGrind</a>
        <div class="dashboard-header-spacer"></div>
        <button type="button" class="dash-icon-btn dash-settings-btn" id="dashSettingsBtn" aria-label="Account settings" aria-expanded="false" aria-controls="dashSettingsPanel" ${user ? '' : 'hidden'}>${COG_ICON}</button>
      </header>
      <div class="dashboard-backdrop" id="dashBackdrop" aria-hidden="true"></div>
      <nav class="dashboard-drawer" id="dashDrawer" aria-label="Dashboard navigation">
        <div class="dashboard-drawer-head">Menu</div>
        ${navLinksHtml(activeNav)}
      </nav>
      <div class="dashboard-settings-panel" id="dashSettingsPanel" role="dialog" aria-label="Account settings">
        <div class="dashboard-settings-head">Account</div>
        <div class="dashboard-settings-body" id="dashSettingsBody"></div>
      </div>
      <div class="dashboard-main" id="dashboardMain"></div>
    </div>`;

  const main = document.getElementById('dashboardMain');
  const mount = document.getElementById('dashboardContent');
  if (mount && main) {
    main.appendChild(mount);
    mount.hidden = false;
  }

  updateSettingsPanel(user);
  bindDashboardChrome();
  return user;
}
