import { affiliateDisclosureHtml } from './affiliate-disclosure.js';

const SITE_URL = 'https://epoxygrind.vercel.app';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function headerHtml() {
  return `<header>
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/logo.png" alt="EpoxyGrind" width="32" height="32"> EpoxyGrind</a>
    <div class="nav-auth" data-auth-nav></div>
    <button class="burger" id="burger" aria-label="Menu">☰</button>
  </div>
  <div class="mobile" id="mobile" data-auth-mobile></div>
</header>`;
}

function footerHtml() {
  return `<footer class="site-foot"><div class="wrap">© 2026 EpoxyGrind · <a href="/diy/">DIY guides</a> · <a href="/services/">Contractor services</a></div></footer>`;
}

const BURGER_SCRIPT = `<script>
  var b=document.getElementById('burger'),m=document.getElementById('mobile');
  if(b&&m){b.addEventListener('click',function(){m.classList.toggle('open')});m.querySelectorAll('a,button').forEach(function(a){a.addEventListener('click',function(){m.classList.remove('open')})});}
</script>`;

/** Delegated click-to-load handler for .video-embed-facade (content-components.js videoEmbedHtml) — shared once per page instead of per-embed inline JS. */
const VIDEO_EMBED_SCRIPT = `<script>
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.video-embed-facade');
    if(!btn) return;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + btn.dataset.videoId + '?autoplay=1';
    iframe.title = btn.dataset.videoTitle || 'YouTube video';
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    btn.replaceWith(iframe);
  });
</script>`;

export function breadcrumbsHtml(items) {
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    const label = escapeHtml(item.label);
    return isLast
      ? `<span aria-current="page">${label}</span>`
      : `<a href="${item.href}">${label}</a><span class="sep">/</span>`;
  });
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${parts.join('')}</nav>`;
}

export function breadcrumbSchema(items, currentPath) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => {
      const href = item.href || currentPath || '';
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: item.label,
        item: href.startsWith('http') ? href : `${SITE_URL}${href}`,
      };
    }),
  };
}

/**
 * Shared wrapper for every DIY/product content page (spec_2 §4 "shared
 * guide template"). Plain-JS equivalent of the spec's component-based
 * layout system — one function every page-type template calls.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.path - e.g. "/best/garage-floor-epoxy-kits/"
 * @param {string} opts.bodyHtml
 * @param {object[]} [opts.schema] - array of JSON-LD objects
 * @param {boolean} [opts.showDisclosure]
 */
export function renderContentPage(opts) {
  const canonical = `${SITE_URL}${opts.path}`;
  const schemaBlocks = (opts.schema || [])
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/logo.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/auth/auth.css">
<link rel="stylesheet" href="/content/content.css">
${schemaBlocks}
</head>
<body class="home-page content-page" data-nav-variant="content">
${headerHtml()}
<main>
  <div class="content-main">
    <div class="content-wrap${opts.wide ? '-wide' : ''}">
      ${opts.bodyHtml}
      ${opts.showDisclosure ? affiliateDisclosureHtml() : ''}
    </div>
  </div>
</main>
${footerHtml()}
<script src="/auth/nav.js" type="module"></script>
${BURGER_SCRIPT}
${VIDEO_EMBED_SCRIPT}
</body>
</html>`;
}

export { escapeHtml };
