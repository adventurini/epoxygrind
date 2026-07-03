import { getAuthClient, withAuthTimeout, signOut } from './client.js';

const NAV_LINKS = {
  home: {
    loggedOut: [
      { href: '/services/', label: 'Contractor services', className: 'nav-svc' },
      { href: '/login/', label: 'Log in' },
      { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
    ],
    loggedIn: [
      { href: '/services/', label: 'Contractor services', className: 'nav-svc' },
      { action: 'logout', label: 'Log out' },
      { href: '/app/', label: 'Dashboard', className: 'btn btn-p btn-sm' },
    ],
  },
  services: {
    loggedOut: [
      { href: '/', label: 'Estimator', className: 'nav-svc' },
      { href: '/login/', label: 'Log in' },
      { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
    ],
    loggedIn: [
      { href: '/', label: 'Estimator', className: 'nav-svc' },
      { action: 'logout', label: 'Log out' },
      { href: '/app/', label: 'Dashboard', className: 'btn btn-p btn-sm' },
    ],
  },
  content: {
    loggedOut: [
      { href: '/', label: 'Estimator', className: 'nav-svc' },
      { href: '/diy/', label: 'DIY guides' },
      { href: '/login/', label: 'Log in' },
      { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
    ],
    loggedIn: [
      { href: '/', label: 'Estimator', className: 'nav-svc' },
      { href: '/diy/', label: 'DIY guides' },
      { action: 'logout', label: 'Log out' },
      { href: '/app/', label: 'Dashboard', className: 'btn btn-p btn-sm' },
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

function renderNav(container, variant, mobile, isLoggedIn) {
  const set = NAV_LINKS[variant] || NAV_LINKS.home;
  const links = isLoggedIn ? set.loggedIn : set.loggedOut;
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

  const variant = document.body.dataset.navVariant || 'home';
  const mobile = document.querySelector('[data-auth-mobile]');

  // Render the logged-out nav immediately (no flash of empty nav / layout
  // shift), then upgrade to the logged-in state once the session check
  // resolves — bounded by withAuthTimeout so a hung getUser() call can't
  // leave the nav stuck showing "Log in" for an already-signed-in visitor.
  renderNav(nav, variant, mobile, false);

  const isLoggedIn = await checkAuthState();
  if (isLoggedIn) renderNav(nav, variant, mobile, true);
}

initAuthNav();
