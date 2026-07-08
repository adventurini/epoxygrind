import { affiliateDisclosureHtml } from './affiliate-disclosure.js';

const SITE_URL = 'https://www.epoxygrind.com';

// perf-fix Fix 4 — self-hosted, inlined (no separate stylesheet request, no
// Google Fonts CDN round trip). Archivo/Inter are variable fonts; Google's
// own CDN served one physical file per family across the whole weight range
// we use, so this is genuinely 3 files, not 7 — see fonts/fonts.css.
const FONT_FACE_CSS = `<style>
@font-face{font-family:'Archivo';font-style:normal;font-weight:600 900;font-display:swap;src:url('/fonts/archivo-var.woff2') format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:400 600;font-display:swap;src:url('/fonts/inter-var.woff2') format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/ibm-plex-mono-500.woff2') format('woff2')}
</style>
<link rel="preload" as="font" type="font/woff2" href="/fonts/archivo-var.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-var.woff2" crossorigin>`;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function headerHtml() {
  return `<header>
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/logo-64.webp" srcset="/logo-64.webp 1x, /logo-128.webp 2x" alt="EpoxyGrind" width="32" height="32" decoding="async"> EpoxyGrind</a>
    <div class="nav-auth" data-auth-nav></div>
    <button class="burger" id="burger" aria-label="Menu">☰</button>
  </div>
  <div class="mobile" id="mobile" data-auth-mobile></div>
</header>`;
}

function footerHtml() {
  return `<footer class="site-foot"><div class="wrap">© 2026 EpoxyGrind · <a href="/diy/">DIY guides</a> · <a href="/">For contractors</a></div></footer>`;
}

const BURGER_SCRIPT = `<script>
  var b=document.getElementById('burger'),m=document.getElementById('mobile');
  if(b&&m){b.addEventListener('click',function(){m.classList.toggle('open')});m.querySelectorAll('a,button').forEach(function(a){a.addEventListener('click',function(){m.classList.remove('open')})});}
</script>`;

/** GA4 (BUILD-analytics.md). Shared across every templated page via renderContentPage. */
/** Full favicon/app-icon set (scripts/generate-favicons.js) — favicon.ico
 * for legacy/crawler requests to the default URL, sized PNGs for browser
 * tabs, apple-touch-icon for iOS home screen, manifest for Android/PWA.
 * Google's favicon guidelines want a real (not just browser-scaled) square
 * icon reachable at a stable URL — this is that, shared across every page. */
const FAVICON_TAGS = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon-48x48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1A5CD6">`;

// perf-fix Fix 7 — gtag's own stub + dataLayer must stay synchronous (any
// track() call before the real script loads still queues correctly, gtag.js
// replays dataLayer on load), but the actual ~65 KiB library fetch is put
// off the critical path until after window load.
const GA_SCRIPT = `<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-M2Y4D751K8');
  function track(name, params) { try { if (window.gtag) gtag('event', name, params || {}); } catch(e){} }
  window.addEventListener('load', function () {
    setTimeout(function () {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-M2Y4D751K8';
      document.head.appendChild(s);
    }, 1500);
  });
</script>`;

/** Delegated click handler for outbound /go/{product_id} links (BUILD-analytics.md outbound_product_click). */
const OUTBOUND_CLICK_SCRIPT = `<script>
  document.addEventListener('click', function(e){
    var a = e.target.closest('a.product-link[href^="/go/"]');
    if(!a || typeof track !== 'function') return;
    var productId = decodeURIComponent(a.getAttribute('href').slice(4));
    track('outbound_product_click', { product_id: productId, merchant: a.dataset.merchant || '', page_template: (location.pathname.split('/').filter(Boolean)[0] || 'home') });
  });
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
 * @param {string[]} [opts.extraStyles] - additional stylesheet hrefs
 * @param {string} [opts.extraScripts] - additional raw <script> HTML, appended before </body>
 * @param {string} [opts.ogImage] - absolute or root-relative image URL for social share/OG previews
 */
export function renderContentPage(opts) {
  const canonical = `${SITE_URL}${opts.path}`;
  const schemaBlocks = (opts.schema || [])
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n');
  const extraStyleLinks = (opts.extraStyles || []).map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
  const ogImageUrl = opts.ogImage ? (opts.ogImage.startsWith('http') ? opts.ogImage : `${SITE_URL}${opts.ogImage}`) : null;
  const ogImageTags = ogImageUrl
    ? `<meta property="og:image" content="${escapeHtml(ogImageUrl)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
${GA_SCRIPT}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
${ogImageTags}
<link rel="canonical" href="${canonical}">
${FAVICON_TAGS}
${FONT_FACE_CSS}
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/auth/auth.css">
<link rel="stylesheet" href="/content/content.css">
${extraStyleLinks}
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
<script src="/js/nav.bundle.js" defer></script>
${BURGER_SCRIPT}
${VIDEO_EMBED_SCRIPT}
${OUTBOUND_CLICK_SCRIPT}
${opts.extraScripts || ''}
</body>
</html>`;
}

export { escapeHtml };
