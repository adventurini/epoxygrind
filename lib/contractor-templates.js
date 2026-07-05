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

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Contractor directory</p>
    <h1 class="content-h1">Find an Epoxy Flooring Contractor</h1>
    <p class="content-dek">Local epoxy and concrete coating contractors by state — real phone numbers, real services, no lead-buying middleman. Pick your state to browse, or get an instant priced estimate first so you know what to expect from a quote.</p>
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
    .map(([platform, url]) => `<a class="product-link" href="${escapeHtml(url)}" target="_blank" rel="noopener nofollow">${escapeHtml(platform)}</a>`)
    .join(' · ');

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
    ${socialLinks ? `<p class="content-prose">${socialLinks}</p>` : ''}

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
