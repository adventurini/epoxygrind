const NAV_LINKS = {
  home: [
    { href: '/services/', label: 'Contractor services', className: 'nav-svc' },
    { href: '/login/', label: 'Log in' },
    { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
  ],
  services: [
    { href: '/', label: 'Estimator', className: 'nav-svc' },
    { href: '/login/', label: 'Log in' },
    { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
  ],
  estimate: [
    { href: '/services/', label: 'Contractor services', className: 'nav-svc' },
    { href: '/login/', label: 'Log in' },
    { href: '/signup/', label: 'Sign up', className: 'btn btn-p btn-sm' },
  ],
};

function linkHtml(link) {
  const cls = link.className ? ` class="${link.className}"` : '';
  return `<a href="${link.href}"${cls}>${link.label}</a>`;
}

function renderNav(container, variant, mobile) {
  const links = NAV_LINKS[variant] || NAV_LINKS.home;
  container.innerHTML = links.map(linkHtml).join('');
  if (mobile) {
    mobile.innerHTML = links.map((link) => `<a href="${link.href}">${link.label}</a>`).join('');
  }
}

export function initAuthNav() {
  const nav = document.querySelector('[data-auth-nav]');
  if (!nav) return;

  const variant = document.body.dataset.navVariant || 'home';
  const mobile = document.querySelector('[data-auth-mobile]');

  // Marketing pages keep the original static nav — auth UI lives in /app/ only.
  renderNav(nav, variant, mobile);
}

initAuthNav();
