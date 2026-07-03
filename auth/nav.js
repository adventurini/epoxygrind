import { getAuthClient, withAuthTimeout, signOut } from './client.js';

/**
 * One consistent nav across every marketing/content page (previously
 * differed per page — home/services/content variants each had their own
 * link set and ordering, which read as inconsistent/messy across the
 * site). Every link renders the same plain style; "Get an estimate" is
 * the only visually distinct element (the one CTA), so the row reads as
 * one hierarchy instead of a row of competing badges/buttons.
 */
const LOGGED_OUT_LINKS = [
  { href: '/diy/', label: 'DIY guides' },
  { href: '/contractors/', label: 'Find a contractor' },
  { href: '/services/', label: 'Contractor services' },
  { href: '/login/', label: 'Log in' },
  { href: '/', label: 'Get an estimate →', className: 'btn btn-p btn-sm' },
];

const LOGGED_IN_LINKS = [
  { href: '/diy/', label: 'DIY guides' },
  { href: '/contractors/', label: 'Find a contractor' },
  { href: '/services/', label: 'Contractor services' },
  { action: 'logout', label: 'Log out' },
  { href: '/app/new/', label: 'Get an estimate →', className: 'btn btn-p btn-sm' },
];

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

function renderNav(container, mobile, isLoggedIn) {
  const links = isLoggedIn ? LOGGED_IN_LINKS : LOGGED_OUT_LINKS;
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

  // Render the logged-out nav immediately (no flash of empty nav / layout
  // shift), then upgrade to the logged-in state once the session check
  // resolves — bounded by withAuthTimeout so a hung getUser() call can't
  // leave the nav stuck showing "Log in" for an already-signed-in visitor.
  renderNav(nav, mobile, false);

  const isLoggedIn = await checkAuthState();
  if (isLoggedIn) renderNav(nav, mobile, true);
}

initAuthNav();
