import { renderContentPage, breadcrumbsHtml, breadcrumbSchema, escapeHtml } from './content-shell.js';
import { allStateSlugs, stateNameFromSlug, metrosByState } from './metros.js';
import { CONTRACTORS, contractorsByState, contractorsByMetro } from './contractors.js';

const SITE_URL = 'https://epoxygrind.vercel.app';

const SERVICE_LABELS = {
  epoxy_flake: 'Epoxy flake',
  epoxy_solid: '100% solids epoxy',
  metallic_epoxy: 'Metallic epoxy',
  polyaspartic: 'Polyaspartic',
  polyurea: 'Polyurea',
  concrete_polish: 'Concrete polishing',
  concrete_stain: 'Concrete staining',
  concrete_repair: 'Concrete repair',
  commercial: 'Commercial',
  residential: 'Residential',
  countertops: 'Countertops',
  pool_deck: 'Pool decks',
};

function estimatorCta(label = 'Get my instant estimate →') {
  return `<p><a class="btn btn-p" href="/">${escapeHtml(label)}</a></p>`;
}

// Same "generic/junk" path guard as scripts/enrich-contractors.py's
// is_real_social_link — a defensive re-check at render time so old scrape
// data (pre-fix) never publishes a bare platform homepage as if it were
// this contractor's actual profile. Real fix is a re-scrape (in progress);
// this is belt-and-suspenders for anything built before that lands.
const SOCIAL_JUNK_PATH_RE = /^\/?(login|sharer|share|dialog|intent|home\/?)?$/i;
function isRealSocialLink(href) {
  try {
    const path = new URL(href).pathname.replace(/\/+$/, '');
    return !SOCIAL_JUNK_PATH_RE.test(path || '/');
  } catch {
    return false;
  }
}

/** Monochrome brand-color icon glyphs (currentColor) — matches the site's
 * blue accent instead of each platform's own brand colors. */
const SOCIAL_ICONS = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7c-.28-.04-1.25-.12-2.37-.12-2.35 0-3.96 1.43-3.96 4.06V10H7.6v3.1h2.77V21h3.13Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c2.67 0 2.99.01 4.04.06 1.05.05 1.77.22 2.4.46.65.25 1.2.6 1.75 1.14.5.5.87 1.08 1.13 1.75.24.63.41 1.35.46 2.4.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.05 1.05-.22 1.77-.46 2.4a4.7 4.7 0 0 1-1.13 1.75 4.7 4.7 0 0 1-1.75 1.13c-.63.24-1.35.41-2.4.46-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-1.05-.05-1.77-.22-2.4-.46a4.7 4.7 0 0 1-1.75-1.13 4.7 4.7 0 0 1-1.13-1.75c-.24-.63-.41-1.35-.46-2.4C3.21 15 3.2 14.67 3.2 12s.01-2.99.06-4.04c.05-1.05.22-1.77.46-2.4.25-.65.6-1.2 1.14-1.75A4.7 4.7 0 0 1 6.6 2.68c.63-.24 1.35-.41 2.4-.46C9.05 2.17 9.37 2.16 12 2.16Zm0 1.8c-2.63 0-2.92.01-3.96.06-.87.04-1.4.19-1.73.32-.43.17-.75.37-1.07.7-.32.32-.52.64-.7 1.07-.13.32-.28.85-.32 1.72-.05 1.04-.06 1.34-.06 3.96s.01 2.92.06 3.96c.04.87.19 1.4.32 1.73.17.43.37.75.7 1.07.32.32.64.52 1.07.7.32.13.85.28 1.72.32 1.04.05 1.34.06 3.97.06s2.93-.01 3.97-.06c.87-.04 1.4-.19 1.73-.32.43-.17.75-.37 1.07-.7.32-.32.52-.64.7-1.07.13-.32.28-.85.32-1.72.05-1.04.06-1.34.06-3.97s-.01-2.93-.06-3.97c-.04-.87-.19-1.4-.32-1.73a2.9 2.9 0 0 0-.7-1.07 2.9 2.9 0 0 0-1.07-.7c-.32-.13-.85-.28-1.72-.32-1.04-.05-1.34-.06-3.97-.06ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-2a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.66 10.4 20.6 2.5h-1.65l-6.03 6.86L8.1 2.5H2.9l7.28 10.4L2.9 21.5h1.65l6.36-7.24 5.08 7.24h5.2l-7.53-11.1Zm-2.25 2.56-.74-1.03-5.86-8.2h2.53l4.73 6.62.74 1.03 6.15 8.6h-2.53l-5.02-7.02Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 8.5H3.56V20.5H6.94V8.5ZM5.25 3.5a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92ZM20.5 20.5v-6.9c0-3.28-1.75-4.8-4.08-4.8-1.88 0-2.72 1.03-3.19 1.76V8.5H9.85c.05 1 0 12 0 12h3.38v-6.7c0-.36.03-.72.13-.98.29-.72.95-1.47 2.06-1.47 1.46 0 2.04 1.11 2.04 2.74V20.5h3.38Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2s-.21-1.5-.86-2.16c-.82-.87-1.74-.87-2.16-.92C15.6 4 12 4 12 4h-.01s-3.59 0-6.57.12c-.42.05-1.34.05-2.16.92C2.6 5.7 2.4 7.2 2.4 7.2S2.18 9 2.18 10.8v1.4c0 1.8.22 3.6.22 3.6s.2 1.5.85 2.16c.82.87 1.9.84 2.38.93 1.73.17 7.37.22 7.37.22s3.6-.01 6.58-.13c.42-.05 1.34-.05 2.16-.92.65-.66.86-2.16.86-2.16s.22-1.8.22-3.6v-1.4c0-1.8-.22-3.6-.22-3.6ZM9.98 14.6V8.6l5.7 3-5.7 3Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 2h-3.2v13.7c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 0 1-2.7-2.7 2.7 2.7 0 0 1 2.7-2.7c.28 0 .55.04.8.12v-3.3a6 6 0 0 0-.8-.06 6 6 0 0 0-6 6 6 6 0 0 0 6 6 6 6 0 0 0 6-6V8.4a7.7 7.7 0 0 0 4.3 1.3V6.5a4.4 4.4 0 0 1-4.4-4.4Z"/></svg>',
};

function serviceChips(services = []) {
  if (!services.length) return '';
  return `<div class="product-card-specs">${services.map((s) => `<span class="spec-chip">${escapeHtml(SERVICE_LABELS[s] || s)}</span>`).join('')}</div>`;
}

function contractorCardHtml(c) {
  return `<a class="category-card" href="/contractors/${c.state_slug}/${c.slug}/">
    <h3>${escapeHtml(c.name)}</h3>
    <p>${escapeHtml(c.city)}, ${escapeHtml(c.state)}${c.phones?.[0] ? ` · ${escapeHtml(c.phones[0])}` : ''}</p>
  </a>`;
}

/** National hub `/contractors/` — every state, contractor counts where we have them. */
export function renderContractorsHub() {
  const breadcrumbs = [{ label: 'Home', href: '/' }, { label: 'Find a contractor' }];
  const path = '/contractors/';

  const counts = new Map();
  for (const c of CONTRACTORS) counts.set(c.state_slug, (counts.get(c.state_slug) || 0) + 1);

  const states = allStateSlugs()
    .map((slug) => ({ slug, name: stateNameFromSlug(slug), count: counts.get(slug) || 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const zipSearchHtml = `<div class="zip-search">
    <label class="fld" for="contractorZip"><span>Search by ZIP code</span>
      <div class="zip-search-row">
        <input id="contractorZip" type="text" inputmode="numeric" pattern="[0-9]{5}" placeholder="Enter your ZIP" maxlength="5">
        <button type="button" class="btn btn-p" id="contractorZipGo">Find contractors →</button>
      </div>
      <p class="fld-error" id="contractorZipError" hidden></p>
    </label>
  </div>
  <script>
    (function(){
      var input = document.getElementById('contractorZip');
      var btn = document.getElementById('contractorZipGo');
      var err = document.getElementById('contractorZipError');
      function go(){
        var zip = (input.value || '').trim();
        err.hidden = true;
        if (!/^\\d{5}$/.test(zip)) { err.hidden = false; err.textContent = 'Enter a 5-digit ZIP code'; return; }
        btn.disabled = true; btn.textContent = 'Searching…';
        fetch('/api/nearest-metro?zip=' + encodeURIComponent(zip)).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, d:d}; }); }).then(function(res){
          if (!res.ok) { err.hidden = false; err.textContent = res.d.error || 'Could not find a nearby coverage area.'; btn.disabled=false; btn.textContent='Find contractors →'; return; }
          window.location.href = '/contractors/' + res.d.state_slug + '/' + res.d.slug + '/';
        }).catch(function(){ err.hidden = false; err.textContent = 'Something went wrong — try browsing by state below.'; btn.disabled=false; btn.textContent='Find contractors →'; });
      }
      btn.addEventListener('click', go);
      input.addEventListener('keydown', function(e){ if (e.key === 'Enter') go(); });
    })();
  </script>`;

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Contractor directory</p>
    <h1 class="content-h1">Find an Epoxy Flooring Contractor</h1>
    <p class="content-dek">Local epoxy and concrete coating contractors by state — real phone numbers, real services, no lead-buying middleman. Search your ZIP or pick your state to browse, or get an instant priced estimate first so you know what to expect from a quote.</p>
    ${zipSearchHtml}
    ${estimatorCta()}
    <h2>Browse by state</h2>
    <div class="category-grid">
      ${states.map((s) => `<a class="category-card" href="/contractors/${s.slug}/"><h3>${escapeHtml(s.name)}</h3><p>${s.count ? `${s.count} contractor${s.count === 1 ? '' : 's'} listed` : 'No listings yet'}</p></a>`).join('')}
    </div>`;

  return renderContentPage({
    title: 'Find an Epoxy Flooring Contractor Near You | EpoxyGrind',
    description: 'Browse local epoxy flooring and concrete coating contractors by state — real contact info, services, and service areas.',
    path,
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, path)],
    wide: true,
  });
}

/** State list `/contractors/{state}/` — always renders, even with zero contractors yet. */
export function renderContractorState(stateSlug) {
  const stateName = stateNameFromSlug(stateSlug);
  const contractors = contractorsByState(stateSlug);
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Find a contractor', href: '/contractors/' },
    { label: stateName },
  ];
  const path = `/contractors/${stateSlug}/`;

  // Metro regions first — clicking into a state should break down by
  // coverage area before a flat list of every contractor in the state.
  const metros = metrosByState(stateSlug)
    .map((m) => ({ metro: m, count: contractorsByMetro(m).length }))
    .sort((a, b) => b.count - a.count || a.metro.city.localeCompare(b.metro.city));

  const metroCardsHtml = metros.length
    ? `<h2>Browse by metro area</h2>
      <div class="category-grid">${metros.map(({ metro, count }) =>
        `<a class="category-card" href="/contractors/${stateSlug}/${metro.slug}/"><h3>${escapeHtml(metro.city)}</h3><p>${count ? `${count} contractor${count === 1 ? '' : 's'}` : 'Coverage area page'}</p></a>`,
      ).join('')}</div>`
    : '';

  const listHtml = contractors.length
    ? `<h2>All contractors in ${escapeHtml(stateName)}</h2><div class="category-grid">${contractors.map(contractorCardHtml).join('')}</div>`
    : `<div class="content-prose"><p>We don't have any contractors listed in ${escapeHtml(stateName)} yet. In the meantime, get a priced estimate for your project and we'll help you find a local pro.</p></div>`;

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Contractor directory</p>
    <h1 class="content-h1">Epoxy Flooring Contractors in ${escapeHtml(stateName)}</h1>
    <p class="content-dek">${contractors.length ? `${contractors.length} local epoxy and concrete coating contractor${contractors.length === 1 ? '' : 's'} serving ${escapeHtml(stateName)}.` : `Local contractor listings for ${escapeHtml(stateName)} are coming soon.`} See <a href="/epoxy-flooring/${stateSlug}/">${escapeHtml(stateName)} pricing by city</a> for typical cost ranges before you take quotes.</p>
    ${estimatorCta()}
    ${metroCardsHtml}
    ${listHtml}`;

  return renderContentPage({
    title: `Epoxy Flooring Contractors in ${stateName} | EpoxyGrind`,
    description: `Local epoxy flooring and concrete coating contractors in ${stateName} — phone numbers, services, and service areas.`,
    path,
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, path)],
    wide: true,
  });
}

/**
 * Metro-scoped contractor directory `/contractors/{state}/{metro-slug}/` —
 * the coverage-area page a city/state page's "Find a contractor" link
 * points to, instead of the full flat state list. Always renders (even
 * with zero local matches) so a link into it never 404s.
 */
export function renderContractorMetro(metro) {
  const stateName = stateNameFromSlug(metro.state_slug);
  const contractors = contractorsByMetro(metro);
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Find a contractor', href: '/contractors/' },
    { label: stateName, href: `/contractors/${metro.state_slug}/` },
    { label: metro.city },
  ];
  const path = `/contractors/${metro.state_slug}/${metro.slug}/`;

  const listHtml = contractors.length
    ? `<div class="category-grid">${contractors.map(contractorCardHtml).join('')}</div>`
    : `<div class="content-prose"><p>We don't have a vetted contractor listed in ${escapeHtml(metro.city)} yet — <a href="/contractors/${metro.state_slug}/">browse the full ${escapeHtml(stateName)} directory</a>, or get an instant estimate first so you know what a fair quote looks like.</p></div>`;

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Contractor directory</p>
    <h1 class="content-h1">Epoxy Flooring Contractors in ${escapeHtml(metro.city)}, ${escapeHtml(metro.state)}</h1>
    <p class="content-dek">${contractors.length ? `${contractors.length} local epoxy and concrete coating contractor${contractors.length === 1 ? '' : 's'} serving ${escapeHtml(metro.city)} and the surrounding area.` : `Local contractor listings for ${escapeHtml(metro.city)} are coming soon.`} See <a href="/epoxy-flooring/${metro.state_slug}/${metro.slug}/">${escapeHtml(metro.city)} pricing</a> for typical cost ranges before you take quotes.</p>
    ${estimatorCta()}
    ${listHtml}
    ${contractors.length ? `<p><a href="/contractors/${metro.state_slug}/">See the full ${escapeHtml(stateName)} directory →</a></p>` : ''}`;

  return renderContentPage({
    title: `Epoxy Flooring Contractors in ${metro.city}, ${metro.state} | EpoxyGrind`,
    description: `Local epoxy flooring and concrete coating contractors serving ${metro.city}, ${metro.state} and nearby suburbs — phone numbers, services, and service areas.`,
    path,
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, path)],
    wide: true,
  });
}

/** Contractor profile `/contractors/{state}/{slug}/`. */
export function renderContractorProfile(c) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Find a contractor', href: '/contractors/' },
    { label: c.state, href: `/contractors/${c.state_slug}/` },
    { label: c.name },
  ];
  const path = `/contractors/${c.state_slug}/${c.slug}/`;

  const trust = c.trust_signals || {};
  const trustChips = [
    trust.licensed && 'Licensed',
    trust.insured && 'Insured',
    trust.warranty && 'Warranty offered',
    trust.free_estimates && 'Free estimates',
    trust.financing && 'Financing available',
    trust.family_owned && 'Family owned',
    // Scraper regex sometimes false-positives on an unrelated number on the
    // page (phone digits, an address) — only publish a plausible claim.
    trust.years_in_business > 0 && trust.years_in_business <= 50 && `${trust.years_in_business}+ years in business`,
  ].filter(Boolean);

  const areas = (c.service_areas || []).slice(0, 20);

  const socialLinks = Object.entries(c.socials || {})
    .filter(([, url]) => isRealSocialLink(url))
    .map(([platform, url]) => {
      const icon = SOCIAL_ICONS[platform];
      if (!icon) return '';
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener nofollow" aria-label="${escapeHtml(platform)}" title="${escapeHtml(platform)}">${icon}</a>`;
    })
    .filter(Boolean)
    .join('');

  const contactRows = [
    c.phones?.[0] ? `<div class="shopping-list-row"><span>Phone</span><a class="product-link" href="tel:${escapeHtml(c.phones[0].replace(/[^\d+]/g, ''))}">${escapeHtml(c.phones[0])}</a></div>` : '',
    c.emails?.[0] ? `<div class="shopping-list-row"><span>Email</span><a class="product-link" href="mailto:${escapeHtml(c.emails[0])}">${escapeHtml(c.emails[0])}</a></div>` : '',
    c.website ? `<div class="shopping-list-row"><span>Website</span><a class="product-link" href="${escapeHtml(c.website)}" target="_blank" rel="noopener">${escapeHtml(c.website.replace(/^https?:\/\//, ''))}</a></div>` : '',
  ]
    .filter(Boolean)
    .join('');

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">${escapeHtml(c.city)}, ${escapeHtml(c.state)}</p>
    <h1 class="content-h1">${escapeHtml(c.name)}</h1>
    ${trustChips.length ? `<div class="product-card-specs" style="margin-top:14px">${trustChips.map((t) => `<span class="spec-chip">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    ${serviceChips(c.services)}

    <h2>Contact</h2>
    <div class="shopping-list">${contactRows || '<p class="content-prose">No verified contact info on file yet.</p>'}</div>
    ${socialLinks ? `<div class="social-icons">${socialLinks}</div>` : ''}

    ${areas.length ? `<h2>Service areas</h2><div class="content-prose"><p>${areas.map(escapeHtml).join(', ')}</p></div>` : ''}

    ${c.place_id ? `<section class="pr-reviews" data-place-id="${escapeHtml(c.place_id)}" hidden></section>
    <script type="module">
      import { initPlaceReviews } from '/lib/place-reviews-client.js';
      fetch('/api/config').then((r) => (r.ok ? r.json() : null)).then((cfg) => {
        if (!cfg) return;
        initPlaceReviews({ functionsUrl: cfg.supabaseUrl + '/functions/v1', anonKey: cfg.supabaseAnonKey });
      }).catch(() => {});
    </script>` : ''}

    <div class="pro-cta">
      <div class="pro-cta-text">
        <h3>Own this business?</h3>
        <p>This listing was built from public info on your website. Claim it to update your details, add photos, and respond to leads directly.</p>
      </div>
      <a class="btn btn-o" href="mailto:claims@epoxygrind.com?subject=${encodeURIComponent(`Claim listing: ${c.name}`)}">Claim this page →</a>
    </div>

    <h2>Compare a DIY price first</h2>
    <div class="content-prose"><p>Not sure what a fair quote looks like? Get a free instant estimate for your space before you talk to a contractor.</p></div>
    ${estimatorCta()}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: c.name,
    telephone: c.phones?.[0] || undefined,
    email: c.emails?.[0] || undefined,
    url: c.website || undefined,
    address: { '@type': 'PostalAddress', addressLocality: c.city, addressRegion: c.state },
  };

  return renderContentPage({
    title: `${c.name} — ${c.city}, ${c.state} Epoxy Flooring Contractor | EpoxyGrind`,
    description: `${c.name} serves ${c.city}, ${c.state}. Contact info, services, and service areas for this local epoxy and concrete coating contractor.`,
    path,
    bodyHtml,
    schema: [schema, breadcrumbSchema(breadcrumbs, path)],
    wide: true,
  });
}

export { SITE_URL };
