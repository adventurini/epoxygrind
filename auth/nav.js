import { getAuthClient, withAuthTimeout, signOut } from './client.js';

/**
 * Nav is variant-aware via <body data-nav-variant="...">, read at render
 * time — NOT one hardcoded link set for every page (that was the previous
 * design, and it's why hand-authored per-page nav markup kept getting
 * silently overwritten the moment this script ran). Unset/unrecognized
 * variant falls back to 'consumer' so every existing content page (DIY
 * guides, contractor directory, etc. — none of which set the attribute)
 * keeps behaving exactly as before.
 */
const TRACKING_PHONE = { href: 'tel:+19476004935', label: '(947) 600-4935', className: 'nav-phone' };

const NAV_VARIANTS = {
  consumer: {
    loggedOut: [
      { href: '/diy/', label: 'DIY guides' },
      { href: '/contractors/', label: 'Find a contractor' },
      { href: '/', label: 'For contractors' },
      { href: '/estimator/', label: 'Get an estimate →', className: 'btn btn-p btn-sm' },
      { href: '/login/', label: 'Log in' },
    ],
    loggedIn: [
      { href: '/diy/', label: 'DIY guides' },
      { href: '/contractors/', label: 'Find a contractor' },
      { href: '/', label: 'For contractors' },
      { href: '/app/', label: 'Dashboard' },
      { href: '/app/new/', label: 'Get an estimate →', className: 'btn btn-p btn-sm' },
      { action: 'logout', label: 'Log out' },
    ],
  },
  // Contractor-funnel pages (the homepage, pricing, audit) — no DIY/
  // directory links (off-pitch for a contractor buyer), click-to-call
  // front and center instead.
  services: {
    loggedOut: [
      TRACKING_PHONE,
      { href: '/estimator/', label: 'Estimator' },
      { href: '/login/', label: 'Log in' },
      { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
    ],
    loggedIn: [
      TRACKING_PHONE,
      { href: '/estimator/', label: 'Estimator' },
      { href: '/app/', label: 'Dashboard' },
      { action: 'logout', label: 'Log out' },
    ],
  },
};

function linkHtml(link) {
  const cls = link.className ? ` class="${link.className}"` : '';
  if (link.action === 'logout') {
    return `<button type="button" data-nav-logout${cls}>${link.label}</button>`;
  }
  return `<a href="${link.href}"${cls}>${link.label}</a>`;
}

function bindLogout(container) {
  container.querySelectorAll('[data-nav-logout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await signOut();
      } finally {
        window.location.href = '/';
      }
    });
  });
}

function renderNav(container, mobile, isLoggedIn, variant) {
  const links = isLoggedIn ? variant.loggedIn : variant.loggedOut;
  container.innerHTML = links.map(linkHtml).join('');
  bindLogout(container);
  if (mobile) {
    mobile.innerHTML = links.map(linkHtml).join('');
    bindLogout(mobile);
  }
}

async function checkAuthState() {
  try {
    const supabase = await getAuthClient();
    const { data: { user } } = await withAuthTimeout(supabase.auth.getUser(), 4000, 'getUser');
    return Boolean(user);
  } catch {
    return false;
  }
}

export async function initAuthNav() {
  const nav = document.querySelector('[data-auth-nav]');
  if (!nav) return;

  const mobile = document.querySelector('[data-auth-mobile]');
  const variant = NAV_VARIANTS[document.body.dataset.navVariant] || NAV_VARIANTS.consumer;

  // Render the logged-out nav immediately (no flash of empty nav / layout
  // shift), then upgrade to the logged-in state once the session check
  // resolves — bounded by withAuthTimeout so a hung getUser() call can't
  // leave the nav stuck showing "Log in" for an already-signed-in visitor.
  renderNav(nav, mobile, false, variant);

  const isLoggedIn = await checkAuthState();

  if (isLoggedIn) renderNav(nav, mobile, true, variant);
}

initAuthNav();
