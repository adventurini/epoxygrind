import { renderContentPage, breadcrumbsHtml, breadcrumbSchema, escapeHtml } from './content-shell.js';
import { allStateSlugs, stateNameFromSlug, metrosByState } from './metros.js';
import { CONTRACTORS, contractorsByState, contractorsByMetro } from './contractors.js';
import { getContractorLogo } from './contractor-images.js';
import { localPriceTable } from './local-pricing.js';

// States with under THIN_STATE_THRESHOLD listings get an extra content
// block instead of being noindexed (fix-instructions.md item 6) — real
// climate/moisture context (general, well-established geography, not a
// specific unverifiable claim) plus real derived pricing from the same
// cost_index data the local pricing pages use, never invented numbers.
const THIN_STATE_THRESHOLD = 15;

const THIN_STATE_CLIMATE_NOTES = {
  delaware: "Delaware's humid, coastal climate means high ambient moisture year-round — a moisture test before coating (not just a visual check) matters more here than in a dry climate.",
  maine: "Maine's harsh winters bring repeated freeze-thaw cycling, which is the top cause of concrete cracking and spalling that needs repair before a coating goes down.",
  alaska: "Alaska's subarctic climate means a short installation season (epoxy needs adequate cure temperatures) and aggressive freeze-thaw cycling that makes slab moisture and crack prep especially important.",
  'new-hampshire': "New Hampshire's cold winters mean heavy road-salt exposure on garage floors from vehicles, plus freeze-thaw cracking — both are things prep and coating choice need to account for.",
  'west-virginia': "West Virginia's humid, mountainous terrain means basement and below-grade floors see more moisture intrusion than flat coastal states — a moisture test matters most for basement jobs here.",
};

const SITE_URL = 'https://www.epoxygrind.com';

// Every page needs an OG image; this generic finished-floor shot (already
// used as the homepage's own hero photo) is the last-resort fallback when
// no real contractor/city photo is available for a given page.
const GENERIC_OG_IMAGE = '/images/og-generic.jpg';

/** Bare hostname for a contractor's website — used to hint the expected
 * domain-matching email on the claim form (api/contractor/claim-request.js
 * does the same normalization server-side to verify it). */
function hostnameOf(url) {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** First real hero photo in a contractor list — used as a representative
 * OG image on hub/list pages that cover many contractors, not just one. */
function firstHeroImage(contractors) {
  const withPlace = contractors.find((c) => c.place_id);
  return withPlace ? `/api/places-photo?place_id=${encodeURIComponent(withPlace.place_id)}&index=0` : null;
}

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
  return `<p><a class="btn btn-p" href="/estimator/">${escapeHtml(label)}</a></p>`;
}

/**
 * Lead capture form — submits to /api/contractor-lead, which writes to
 * Supabase (contractor_leads table, visible on /app/admin/). The exact
 * contractor + page path are baked in as hidden fields at build time (not
 * read from window.location client-side) so the source is always correct
 * even if the page is embedded/proxied. company_website is a honeypot: a
 * field named to look legitimate to bot autofill, hidden off-screen via
 * CSS (not the `hidden` attribute, which some bots specifically skip) —
 * real visitors never see or fill it; api/contractor-lead.js silently
 * drops any submission where it's non-empty.
 */
function leadFormHtml(c, path) {
  return `<h2>Request a quote from ${escapeHtml(c.name)}</h2>
    <p class="lead-form-diy-nudge">Not sure what's fair first? <a href="/">Get a free instant DIY estimate →</a></p>
    <div class="lead-form-wrap">
      <form id="contractorLeadForm" novalidate>
        <input type="hidden" name="contractorStateSlug" value="${escapeHtml(c.state_slug)}">
        <input type="hidden" name="contractorSlug" value="${escapeHtml(c.slug)}">
        <input type="hidden" name="contractorName" value="${escapeHtml(c.name)}">
        <input type="hidden" name="sourcePath" value="${escapeHtml(path)}">
        <div class="lead-form-honeypot" aria-hidden="true">
          <label>Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label>
        </div>
        <div class="row-2">
          <label class="fld"><span>Name</span><input type="text" name="name" required autocomplete="name"></label>
          <label class="fld"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
        </div>
        <label class="fld full"><span>Phone <em>(optional)</em></span><input type="tel" name="phone" autocomplete="tel"></label>
        <label class="fld full"><span>Project details <em>(optional)</em></span><textarea name="message" rows="3"></textarea></label>
        <button type="submit" class="btn btn-p" id="contractorLeadSubmit">Send request →</button>
        <p class="fld-error" id="contractorLeadError" hidden></p>
      </form>
      <p class="tiny muted" id="contractorLeadSuccess" hidden>Thanks — your request has been sent.</p>
    </div>
    <script>
      (function(){
        var form = document.getElementById('contractorLeadForm');
        var btn = document.getElementById('contractorLeadSubmit');
        var err = document.getElementById('contractorLeadError');
        var ok = document.getElementById('contractorLeadSuccess');
        form.addEventListener('submit', function(e){
          e.preventDefault();
          err.hidden = true;
          var data = Object.fromEntries(new FormData(form).entries());
          if (!data.name || !data.email) { err.hidden = false; err.textContent = 'Name and email are required.'; return; }
          btn.disabled = true; btn.textContent = 'Sending…';
          fetch('/api/contractor-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, d:d}; }); }).then(function(res){
            if (!res.ok) { err.hidden = false; err.textContent = res.d.error || 'Could not send — try again.'; btn.disabled = false; btn.textContent = 'Send request →'; return; }
            form.hidden = true;
            ok.hidden = false;
          }).catch(function(){
            err.hidden = false; err.textContent = 'Could not send — try again.'; btn.disabled = false; btn.textContent = 'Send request →';
          });
        });
      })();
    </script>`;
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

/** "a, b, and c" / "a and b" / "a" — natural-language join, Oxford comma. */
function joinNaturally(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Templated write-up — every sentence is assembled from real scraped fields
 * (trust_signals, services, service_areas, google_rating), never freeform
 * AI copy, so nothing here can be a fabricated claim about a specific
 * business. Skips any sentence whose backing field is missing rather than
 * guessing or padding with filler.
 */
function contractorWriteupHtml(c) {
  const trust = c.trust_signals || {};
  const services = (c.services || [])
    .filter((s) => s !== 'residential' && s !== 'commercial')
    .map((s) => SERVICE_LABELS[s])
    .filter(Boolean);
  const hasResidential = c.services?.includes('residential');
  const hasCommercial = c.services?.includes('commercial');

  const sentences = [];

  let intro = `${escapeHtml(c.name)} is ${trust.family_owned ? 'a family-owned ' : 'an '}epoxy and concrete coating contractor serving ${escapeHtml(c.city)}, ${escapeHtml(c.state)}`;
  intro += c.service_areas?.length > 1 ? ' and the surrounding area.' : '.';
  if (trust.years_in_business > 0 && trust.years_in_business <= 50) {
    intro += ` They've been in business for ${escapeHtml(trust.years_in_business)}+ years.`;
  }
  sentences.push(intro);

  if (services.length) {
    const custType = hasResidential && hasCommercial
      ? ' for residential and commercial customers'
      : hasCommercial ? ' for commercial clients' : hasResidential ? ' for homeowners' : '';
    sentences.push(`Services include ${joinNaturally(services.map(escapeHtml))}${custType}.`);
  }

  const credBits = [];
  if (trust.licensed && trust.insured) credBits.push('licensed and insured');
  else if (trust.licensed) credBits.push('licensed');
  else if (trust.insured) credBits.push('insured');
  if (trust.free_estimates) credBits.push('offers free estimates');
  if (trust.financing) credBits.push('financing is available');
  if (trust.warranty) credBits.push('work is backed by a warranty');
  if (credBits.length) sentences.push(`${escapeHtml(c.name)} is ${joinNaturally(credBits)}.`);

  // Every contractor shown on the site already passed a has_google_reviews
  // quality bar, so this is always real data, not a maybe — the actual
  // review text (customer notes) renders live just below via place-reviews-client.js.
  if (c.has_google_reviews && c.google_rating) {
    const count = c.google_review_count;
    sentences.push(`Rated ${escapeHtml(c.google_rating)} stars on Google from ${escapeHtml(count)} customer review${count === 1 ? '' : 's'} — see recent reviews below.`);
  }

  return sentences.length ? `<h2>About ${escapeHtml(c.name)}</h2><div class="content-prose"><p>${sentences.join(' ')}</p></div>` : '';
}

const GOOGLE_G_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" class="rating-google-g"><path d="M22.5 12.25c0-.76-.07-1.5-.2-2.2H12v4.16h5.9a5.05 5.05 0 0 1-2.19 3.32v2.7h3.53c2.07-1.9 3.26-4.7 3.26-7.98Z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.53-2.7c-.98.66-2.24 1.04-3.75 1.04-2.88 0-5.32-1.94-6.19-4.56H2.17v2.79A11 11 0 0 0 12 23Z" fill="#34A853"/><path d="M5.81 14.12a6.6 6.6 0 0 1 0-4.24V7.09H2.17a11 11 0 0 0 0 9.82l3.64-2.79Z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.96 1 12 1A11 11 0 0 0 2.17 7.09l3.64 2.79C6.68 7.26 9.12 5.38 12 5.38Z" fill="#EA4335"/></svg>';
const STAR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" class="rating-star"><path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7-5.4-4.7 7.1-.6L12 2.5Z" fill="#F5B400"/></svg>';

function ratingBadgeHtml(c) {
  if (!c.has_google_reviews || !c.google_rating) return '';
  return `<span class="rating-badge">${GOOGLE_G_ICON}${STAR_ICON}${escapeHtml(c.google_rating)} <span class="rating-count">(${escapeHtml(c.google_review_count)} reviews)</span></span>`;
}

function contractorCardHtml(c) {
  const logo = getContractorLogo(c.state_slug, c.slug);
  const hasPhoto = Boolean(c.place_id);
  const classes = ['category-card', hasPhoto && 'has-thumb', !hasPhoto && logo && 'has-logo'].filter(Boolean).join(' ');
  const thumbHtml = hasPhoto
    ? `<div class="category-card-thumb-wrap"><img class="category-card-thumb" src="/api/places-photo?place_id=${encodeURIComponent(c.place_id)}&index=0" alt="" loading="lazy">${logo ? `<img class="category-card-logo-badge" src="${escapeHtml(logo.path)}" alt="" loading="lazy">` : ''}</div>`
    : logo
      ? `<img class="category-card-logo" src="${escapeHtml(logo.path)}" alt="" loading="lazy">`
      : '';
  return `<a class="${classes}" href="/contractors/${c.state_slug}/${c.slug}/">
    ${thumbHtml}
    <h3>${escapeHtml(c.name)}</h3>
    <p>${escapeHtml(c.city)}, ${escapeHtml(c.state)}${c.phones?.[0] ? ` · ${escapeHtml(c.phones[0])}` : ''}</p>
    ${ratingBadgeHtml(c)}
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
    <p class="lead-form-diy-nudge">Not sure what's fair first? <a href="/">Get a free instant DIY estimate →</a></p>
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
    ogImage: firstHeroImage(CONTRACTORS) || GENERIC_OG_IMAGE,
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

  const climateNote = THIN_STATE_CLIMATE_NOTES[stateSlug];
  const thinStateEnrichmentHtml = contractors.length < THIN_STATE_THRESHOLD && climateNote
    ? (() => {
        const costIndexes = metrosByState(stateSlug).map((m) => m.cost_index).filter(Boolean);
        const avgCostIndex = costIndexes.length
          ? costIndexes.reduce((a, b) => a + b, 0) / costIndexes.length
          : 1;
        const row = localPriceTable(avgCostIndex)[0].rows[1];
        return `<div class="content-prose">
          <p>${climateNote} See <a href="/diy/how-to-test-concrete-for-moisture/">how to test concrete for moisture</a> before choosing a coating system.</p>
          <p>A typical 2-car garage (flake epoxy) in ${escapeHtml(stateName)} runs about $${row.low.toLocaleString()}–$${row.high.toLocaleString()} — see <a href="/epoxy-flooring/${stateSlug}/">${escapeHtml(stateName)} pricing by city</a> for a full breakdown by system and space size.</p>
        </div>`;
      })()
    : '';

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Contractor directory</p>
    <h1 class="content-h1">Epoxy Flooring Contractors in ${escapeHtml(stateName)}</h1>
    <p class="content-dek">${contractors.length ? `${contractors.length} local epoxy and concrete coating contractor${contractors.length === 1 ? '' : 's'} serving ${escapeHtml(stateName)}.` : `Local contractor listings for ${escapeHtml(stateName)} are coming soon.`} See <a href="/epoxy-flooring/${stateSlug}/">${escapeHtml(stateName)} pricing by city</a> for typical cost ranges before you take quotes.</p>
    ${estimatorCta()}${thinStateEnrichmentHtml}
    ${metroCardsHtml}
    ${listHtml}`;

  const topMetros = metros.slice(0, 3).map(({ metro }) => metro.city);
  const metroPhrase = topMetros.length
    ? `, covering ${topMetros.join(', ')}${topMetros.length > 1 ? ',' : ''} and more`
    : '';

  return renderContentPage({
    title: `Epoxy Flooring Contractors in ${stateName} (${contractors.length} Listed) | EpoxyGrind`,
    description: `${contractors.length} epoxy flooring contractors in ${stateName}${metroPhrase}. Get your own free instant estimate first.`,
    path,
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, path)],
    wide: true,
    ogImage: firstHeroImage(contractors) || GENERIC_OG_IMAGE,
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
    : `<div class="content-prose"><p>We don't have a contractor listed in ${escapeHtml(metro.city)} yet — <a href="/contractors/${metro.state_slug}/">browse the full ${escapeHtml(stateName)} directory</a>, or get an instant estimate first so you know what a fair quote looks like.</p></div>`;

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
    ogImage: firstHeroImage(contractors) || GENERIC_OG_IMAGE,
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
    c.website ? `<div class="shopping-list-row"><span>Website</span><a class="product-link" href="${escapeHtml(c.website)}" target="_blank" rel="noopener">${escapeHtml(c.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></div>` : '',
  ]
    .filter(Boolean)
    .join('');

  const logo = getContractorLogo(c.state_slug, c.slug);
  // Photo bytes come from /api/places-photo (server-side proxy — the
  // browser never sees a Google URL or API key). The figcaption/gallery
  // start empty and fill in once lib/place-reviews-client.js's poll loop
  // learns which indexes actually have a real photo (data.photo_attributions),
  // so a listing with zero real photos never shows a gallery of repeated
  // placeholders.
  const heroHtml = c.place_id
    ? `<figure class="contractor-hero"><img src="/api/places-photo?place_id=${encodeURIComponent(c.place_id)}&index=0" alt="${escapeHtml(c.name)}" loading="eager"><figcaption data-photo-caption hidden></figcaption></figure>`
    : '';

  const galleryHtml = c.place_id
    ? `<div class="contractor-gallery" data-photo-gallery data-contractor-name="${escapeHtml(c.name)}" hidden></div>`
    : '';

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${heroHtml}
    <p class="content-eyebrow">${escapeHtml(c.city)}, ${escapeHtml(c.state)}</p>
    <div class="contractor-name-row">
      ${logo ? `<img class="contractor-logo" src="${escapeHtml(logo.path)}" alt="${escapeHtml(c.name)} logo">` : ''}
      <h1 class="content-h1">${escapeHtml(c.name)}</h1>
    </div>
    ${ratingBadgeHtml(c)}
    ${trustChips.length ? `<div class="product-card-specs" style="margin-top:14px">${trustChips.map((t) => `<span class="spec-chip">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    ${serviceChips(c.services)}
    ${contractorWriteupHtml(c)}
    ${galleryHtml}

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

    ${leadFormHtml(c, path)}

    <div class="claim-banner">
      <div class="claim-banner-text">
        <strong>Own this business?</strong>
        <span>This listing was built from public info on your website — claim it to edit anything here and see your website audit.</span>
      </div>
      <form id="claimForm" class="claim-form" novalidate>
        <input type="hidden" name="placeId" value="${escapeHtml(c.place_id || '')}">
        <input type="email" name="email" placeholder="you@${escapeHtml(hostnameOf(c.website) || 'yourbusiness.com')}" autocomplete="email" required>
        <button type="submit" class="btn btn-p btn-sm" id="claimSubmit">Claim this page →</button>
      </form>
      <p class="claim-msg" id="claimMsg" hidden></p>
    </div>
    <script>
      (function(){
        var form = document.getElementById('claimForm');
        if (!form) return;
        var btn = document.getElementById('claimSubmit');
        var msg = document.getElementById('claimMsg');
        form.addEventListener('submit', function(e){
          e.preventDefault();
          var data = Object.fromEntries(new FormData(form).entries());
          if (!data.placeId) { msg.hidden = false; msg.textContent = "This listing can't be claimed online yet — email claims@epoxygrind.com."; return; }
          btn.disabled = true; btn.textContent = 'Sending…';
          fetch('/api/contractor/claim-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, d:d}; }); }).then(function(res){
            btn.disabled = false;
            msg.hidden = false;
            if (!res.ok) { msg.textContent = res.d.error || 'Something went wrong — please try again.'; btn.textContent = 'Claim this page →'; return; }
            msg.textContent = res.d.message;
            form.hidden = true;
          }).catch(function(){
            btn.disabled = false; btn.textContent = 'Claim this page →';
            msg.hidden = false; msg.textContent = 'Something went wrong — please try again.';
          });
        });
      })();
    </script>`;

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
    // Reuses calculator.css's .fld/.row-2/.btn form-field styles for the
    // lead form below — same pattern as the compact estimator embed.
    extraStyles: ['/calculator/calculator.css'],
    // A contractor without a place_id has no photo source at all — fall
    // back to their scraped logo, then the generic shot.
    ogImage: c.place_id ? `/api/places-photo?place_id=${encodeURIComponent(c.place_id)}&index=0` : (logo?.path || GENERIC_OG_IMAGE),
  });
}

export { SITE_URL };
