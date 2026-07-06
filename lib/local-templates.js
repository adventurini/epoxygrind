import { renderContentPage, breadcrumbsHtml, breadcrumbSchema, escapeHtml } from './content-shell.js';
import { faqBlock } from './content-components.js';
import { localPriceTable } from './local-pricing.js';
import { getClimateRegion } from './climate-regions.js';
import { nearestMetros, metrosByState, stateNameFromSlug } from './metros.js';
import { getCityImage } from './city-images.js';
import { contractorsByMetro, contractorsByState } from './contractors.js';

const SITE_URL = 'https://epoxygrind.vercel.app';

// Last-resort OG image fallback — same generic finished-floor shot used as
// the homepage hero, for the rare page with no real local/product photo.
const GENERIC_OG_IMAGE = '/images/hero-after.jpg';

function estimatorCta(zip, label = 'Get my instant estimate →') {
  const href = zip ? `/?zip=${encodeURIComponent(zip)}` : '/';
  return `<p><a class="btn btn-p" href="${href}">${escapeHtml(label)}</a></p>`;
}

/**
 * The real photo estimator, embedded directly at the bottom of the city
 * page instead of just linking out to it — condensed to the form panel
 * only (no hero copy/before-after slider column, no card chrome around it)
 * so it reads as a compact conversion module, not a second full hero.
 * Reuses calculator/calculator.js as-is (same element IDs it already
 * wires up) via opts.extraScripts/extraStyles on renderContentPage.
 */
function compactEstimatorHtml(metro) {
  return `<section class="calc-compact" id="calculator">
    <div class="calc-compact-head">
      <span class="eyebrow">Free instant estimate</span>
      <h2>See your price for this floor</h2>
      <p class="content-dek">Upload a photo — no obligation, no phone call required.</p>
    </div>
    <div class="calc-shell">
      <div class="calc-panel">
        <div class="upload" id="uploadZone">
          <input type="file" id="photoInput" accept="image/*" hidden>
          <div class="upload-empty" id="uploadEmpty">
            <span class="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path></svg>
            </span>
            <p class="upload-title">Drop a photo or tap to upload</p>
            <p class="upload-hint">JPG or PNG, up to 15MB</p>
          </div>
          <div class="upload-preview" id="uploadPreview" hidden>
            <div class="upload-preview-frame">
              <img id="previewImg" alt="Uploaded space">
              <button type="button" class="upload-replace-btn" id="changePhoto" aria-label="Replace photo" title="Replace photo">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><polyline points="21 3 21 9 15 9"></polyline></svg>
              </button>
            </div>
          </div>
        </div>
        <p class="fld-error" id="photoError" hidden></p>

        <div class="fld">
          <span>Space size</span>
          <div class="segmented" id="spaceSizeGroup" role="group" aria-label="Space size">
            <button type="button" class="seg-btn" data-size="1-car">1-car garage</button>
            <button type="button" class="seg-btn on" data-size="2-car">2-car garage</button>
            <button type="button" class="seg-btn" data-size="3-car">3-car garage</button>
            <button type="button" class="seg-btn" data-size="4-car">4-car garage</button>
            <button type="button" class="seg-btn" data-size="basement">Basement</button>
            <button type="button" class="seg-btn" data-size="patio">Patio</button>
            <button type="button" class="seg-btn" data-size="commercial">Commercial</button>
          </div>
          <p class="fld-error" id="sizeError" hidden></p>
        </div>

        <div class="row-2">
          <label class="fld"><span>Finish</span><select id="finish"><option value="solid">Solid</option><option value="flake" selected>Flake</option><option value="metallic">Metallic</option></select></label>
          <label class="fld"><span>Pattern</span><select id="pattern"></select></label>
        </div>

        <label class="fld full"><span>Coating type</span><select id="coatingType"></select></label>

        <div class="color-block">
          <div class="fld"><span>Base color</span>
            <div class="color-line">
              <div class="color-picker-wrap">
                <span class="color-picker-swatch" id="baseSwatch" style="background:#4A4F54"></span>
                <input type="hidden" id="baseColorPicker" value="charcoal">
              </div>
              <code id="baseHex">Charcoal gray</code>
              <div class="swatches" id="baseSwatches"></div>
            </div>
          </div>
          <div class="fld" id="flakeWrap"><span>Flake color</span>
            <div class="color-line">
              <div class="color-picker-wrap">
                <span class="color-picker-swatch" id="flakeSwatch" style="background:#A9A9A7"></span>
                <input type="hidden" id="flakeColorPicker" value="gravel">
              </div>
              <code id="flakeHex">Gravel</code>
              <div class="swatches" id="flakeSwatches"></div>
            </div>
          </div>
        </div>

        <label class="fld full"><span>Square footage</span><input id="exactSqft" type="number" inputmode="numeric" min="1" placeholder="e.g. 450 (optional)"></label>

        <div class="row-2">
          <label class="fld"><span>Name</span><input id="customerName" type="text" placeholder="Your name" autocomplete="name"></label>
          <label class="fld"><span>Email</span><input id="customerEmail" type="email" placeholder="you@email.com" autocomplete="email"></label>
        </div>

        <label class="fld full"><span>ZIP code</span><input id="projectLocation" type="text" inputmode="numeric" pattern="[0-9]{5}" placeholder="Enter ZIP" autocomplete="postal-code" maxlength="10" value="${escapeHtml(metro.primary_zip || '')}">
          <p class="fld-error" id="zipError" hidden></p>
        </label>

        <button class="btn btn-p btn-full" id="runCalc" disabled>Generate estimate →</button>
        <p class="submit-hint" id="submitHint" hidden></p>
      </div>
    </div>
  </section>
  <div class="toast" id="toast" hidden></div>`;
}

/**
 * Photo hero for a city hub — uses the one-time-scraped Wikipedia/Wikimedia
 * image when available (scripts/fetch-city-images.py), falls back to the
 * brand gradient when a metro has no usable photo (1 of 331 as of the last
 * run) so every page still gets a designed hero either way.
 */
function cityHeroHtml(metro) {
  const image = getCityImage(metro.state_slug, metro.slug);
  const bgStyle = image ? ` style="background-image:linear-gradient(180deg,rgba(10,22,48,0) 0%,rgba(10,22,48,.2) 100%),url('${image.path}')"` : '';
  const credit = image
    ? `<p class="local-hero-credit">Photo: <a href="${escapeHtml(image.sourcePageUrl)}" target="_blank" rel="noopener">${escapeHtml(image.sourceTitle)}</a> via Wikipedia</p>`
    : '';

  return `<div class="local-hero"${bgStyle}>
    <div class="local-hero-inner">
      <p class="content-eyebrow">Epoxy flooring cost</p>
      <h1 class="content-h1">Epoxy Flooring in ${escapeHtml(metro.city)}, ${escapeHtml(metro.state)}: 2026 Cost &amp; Instant Estimate</h1>
      <p class="content-dek">See localized pricing by system and space size, then get an exact number for your space in seconds.</p>
      ${estimatorCta(metro.primary_zip)}
    </div>
    ${credit}
  </div>`;
}

function priceTableHtml(costIndex) {
  const tables = localPriceTable(costIndex);
  return `<div class="comparison-table-wrap"><table class="comparison-table">
    <thead><tr><th>System</th>${tables[0].rows.map((r) => `<th>${escapeHtml(r.space)}</th>`).join('')}</tr></thead>
    <tbody>
      ${tables.map((t) => `<tr><td class="name-cell">${escapeHtml(t.system)}</td>${t.rows.map((r) => `<td>${escapeHtml('$' + r.low.toLocaleString())}–${escapeHtml('$' + r.high.toLocaleString())}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table></div>
  <p class="muted tiny">Ranges shown for {city} — final quote confirmed by your installer.</p>`;
}

/** Shared across every city hub — the specific-quote-vetting content that absorbs
 * hire-ready/transactional intent while directory pages are deferred (spec §5a.5). */
function hiringGuideHtml(metro) {
  const region = getClimateRegion(metro.climate_region);
  const regionNote = region
    ? `<p>In ${escapeHtml(metro.city)}'s ${region.label.toLowerCase()}, pay particular attention to how the installer answers the moisture-testing question below — it's the detail regional conditions affect most.</p>`
    : '';

  return `<h2>Hiring a pro in ${escapeHtml(metro.city)}</h2>
    <div class="content-prose">
      <p>A legitimate epoxy floor quote in ${escapeHtml(metro.city)} should walk through prep method, system choice, and a written warranty before you sign anything — not just a per-square-foot number. Here's what to ask before you commit:</p>
      <ol>
        <li><strong>Grind or etch?</strong> Mechanical grinding gives a better surface profile than acid etching for most slabs — an installer who defaults straight to etch without discussing your specific slab is worth a follow-up question.</li>
        <li><strong>What solids percentage?</strong> 100% solids epoxy is thicker and more durable than water-based systems in the 40-50% solids range. Ask directly — "epoxy" alone doesn't tell you which.</li>
        <li><strong>Is a moisture test included?</strong> Trapped slab moisture is a leading cause of coating failure. A quote that skips this step on an on-grade slab is a red flag.</li>
        <li><strong>What's the warranty, in writing?</strong> Verbal warranties aren't worth much — get the terms and duration in the written quote.</li>
        <li><strong>Are they insured?</strong> Ask for proof of liability insurance before work starts, not after something goes wrong.</li>
      </ol>
      <p><strong>Typical timeline:</strong> most residential garage jobs run 2-4 days from prep through final cure, though full cure-to-vehicle-weight can take longer depending on the system.</p>
      ${regionNote}
    </div>
    ${estimatorCta(metro.primary_zip, 'Get a baseline price before you take quotes →')}`;
}

/**
 * Appendix A: "extended_towns... Tier 1 pages render these in a collapsed
 * 'All areas served' list for deep near-me matching; Tier 2 uses suburbs
 * only." Suburbs render as prose for every metro; the deeper collapsed
 * list is Tier 1 only.
 */
function areasServedHtml(metro) {
  const suburbs = metro.suburbs || [];
  if (!suburbs.length) return '';
  const list = suburbs.slice(0, 24).join(', ');
  const extended = metro.tier === 1 ? (metro.extended_towns || []) : [];

  const extendedHtml = extended.length
    ? `<details class="areas-served-more">
        <summary>All areas served (${extended.length + suburbs.length})</summary>
        <p>${escapeHtml([...suburbs, ...extended].join(', '))}</p>
      </details>`
    : '';

  return `<h2>Areas served</h2>
    <div class="content-prose"><p>Serving the ${escapeHtml(metro.city)} metro, including ${escapeHtml(list)}${suburbs.length > 24 ? ', and surrounding areas' : ''}.</p>
    ${extendedHtml}</div>`;
}

/** Cross-links the geographic content into the real contractor directory —
 * named local pros where we have them (contractorsByCity), always with a
 * link to the full state directory so the city page never dead-ends. */
function localContractorsHtml(metro) {
  const local = contractorsByMetro(metro);
  const metroHref = `/contractors/${metro.state_slug}/${metro.slug}/`;
  const stateHref = `/contractors/${metro.state_slug}/`;
  const stateCount = contractorsByState(metro.state_slug).length;

  if (!local.length) {
    return stateCount
      ? `<h2>Find a contractor in ${escapeHtml(metro.city)}</h2>
        <div class="content-prose"><p>We don't have a vetted contractor listed in ${escapeHtml(metro.city)}'s coverage area yet — <a href="${stateHref}">browse ${escapeHtml(stateCount)} contractor${stateCount === 1 ? '' : 's'} in ${escapeHtml(metro.state)}</a>, or get an instant estimate first so you know what a fair quote looks like.</p></div>`
      : '';
  }

  const cards = local.slice(0, 6).map((c) =>
    `<a class="category-card" href="/contractors/${c.state_slug}/${c.slug}/"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.city)}, ${escapeHtml(c.state)}${c.phones?.[0] ? ` · ${escapeHtml(c.phones[0])}` : ''}</p></a>`,
  ).join('');

  return `<h2>Contractors serving ${escapeHtml(metro.city)}</h2>
    <div class="category-grid">${cards}</div>
    <p><a href="${metroHref}">See all ${escapeHtml(local.length)} contractor${local.length === 1 ? '' : 's'} covering ${escapeHtml(metro.city)} and nearby suburbs →</a></p>`;
}

function localFaqItems(metro) {
  const region = getClimateRegion(metro.climate_region);
  const items = [
    { q: `How much does epoxy flooring cost in ${metro.city}, ${metro.state}?`, a: `Costs in ${metro.city} vary by system and space size — see the price table above for current ranges by system and garage/basement size. Get an exact number for your space with a free instant photo estimate.` },
  ];
  if (region) items.push(region.faq);
  items.push(
    { q: `How do I know if a quote is fair in ${metro.city}?`, a: 'Compare against the price ranges above for your system and space size, and make sure the quote itemizes prep method, system, and warranty — not just a flat total. See our hiring guide above for the specific questions to ask.' },
    { q: `Is epoxy flooring worth it in ${metro.city}?`, a: 'For most garages and basements, yes — a properly installed epoxy or polyaspartic system holds up for years and meaningfully outperforms bare or painted concrete on durability and ease of cleaning.' },
  );
  return items;
}

/** City hub `/epoxy-flooring/{state}/{city}/` (spec §5a). */
export function renderCityHub(metro) {
  const region = getClimateRegion(metro.climate_region);
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Epoxy Flooring', href: '/epoxy-flooring/' },
    { label: metro.state, href: `/epoxy-flooring/${metro.state_slug}/` },
    { label: metro.city },
  ];
  const path = `/epoxy-flooring/${metro.state_slug}/${metro.slug}/`;

  const nearby = nearestMetros(metro, 3);
  const nearbyHtml = nearby.length
    ? `<h2>Nearby metros</h2><div class="category-grid">${nearby.map((n) =>
        `<a class="category-card" href="/epoxy-flooring/${n.state_slug}/${n.slug}/"><h3>${escapeHtml(n.city)}, ${escapeHtml(n.state)}</h3><p>Epoxy flooring cost & instant estimate</p></a>`,
      ).join('')}</div>`
    : '';

  const { html: faqHtml, schema: faqSchema } = faqBlock(localFaqItems(metro));
  const heroHtml = cityHeroHtml(metro);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${heroHtml}
    ${priceTableHtml(metro.cost_index).replace('{city}', escapeHtml(metro.city))}
    ${region ? `<h2>${escapeHtml(region.label)} considerations</h2><div class="content-prose">${region.bodyHtml}</div>` : ''}
    ${hiringGuideHtml(metro)}
    ${localContractorsHtml(metro)}
    ${areasServedHtml(metro)}
    <h2>FAQ</h2>
    ${faqHtml}
    <h2>More resources</h2>
    <div class="content-prose"><p><a href="/epoxy-flooring-cost">Read the full epoxy flooring cost guide</a> for a national breakdown of what drives price, or browse our <a href="/diy/">DIY guides</a> if you're considering doing it yourself.</p></div>
    ${nearbyHtml}
    ${compactEstimatorHtml(metro)}`;

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Epoxy Flooring in ${metro.city}, ${metro.state}`,
    areaServed: [metro.city, ...(metro.suburbs || []).slice(0, 24)].map((name) => ({ '@type': 'City', name })),
  };

  return renderContentPage({
    title: `Epoxy Flooring Cost in ${metro.city}, ${metro.state} (2026) — Instant Photo Estimate`,
    description: `See 2026 epoxy flooring costs in ${metro.city}, ${metro.state} by system and space size, plus what to ask before hiring an installer. Get an instant photo estimate — free, no obligation.`,
    path,
    bodyHtml,
    schema: [serviceSchema, faqSchema, breadcrumbSchema(breadcrumbs, path)],
    wide: true,
    extraStyles: ['/calculator/calculator.css'],
    extraScripts: '<script src="/calculator/calculator.js" type="module"></script>',
    // Every page needs an OG image; the rare city with no scraped photo of
    // its own falls back to the nearest metro's real photo instead.
    ogImage: getCityImage(metro.state_slug, metro.slug)?.path
      || nearby.map((n) => getCityImage(n.state_slug, n.slug)?.path).find(Boolean)
      || GENERIC_OG_IMAGE,
  });
}

/** State rollup `/epoxy-flooring/{state}/` (spec §5c). */
export function renderStateRollup(stateSlug) {
  const metros = metrosByState(stateSlug).sort((a, b) => b.tier === a.tier ? a.city.localeCompare(b.city) : a.tier - b.tier);
  if (!metros.length) return null;
  const stateName = stateNameFromSlug(stateSlug);

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Epoxy Flooring', href: '/epoxy-flooring/' },
    { label: stateName },
  ];
  const path = `/epoxy-flooring/${stateSlug}/`;

  const tableHtml = metros.length
    ? `<div class="comparison-table-wrap"><table class="comparison-table">
        <thead><tr><th>City</th><th>2-Car Garage (Flake Epoxy)</th></tr></thead>
        <tbody>${metros.map((m) => {
          const t = localPriceTable(m.cost_index)[0].rows[1];
          return `<tr><td class="name-cell"><a class="product-link" href="/epoxy-flooring/${stateSlug}/${m.slug}/">${escapeHtml(m.city)}</a></td><td>$${t.low.toLocaleString()}–$${t.high.toLocaleString()}</td></tr>`;
        }).join('')}</tbody>
      </table></div>`
    : `<p class="content-prose">No city pages are live in ${escapeHtml(stateName)} yet — check back as we expand coverage.</p>`;

  const contractorCount = contractorsByState(stateSlug).length;
  const contractorCalloutHtml = `<h2>Find a contractor in ${escapeHtml(stateName)}</h2>
    <div class="content-prose"><p>${contractorCount
      ? `Browse <a href="/contractors/${stateSlug}/">${escapeHtml(contractorCount)} vetted epoxy and concrete coating contractor${contractorCount === 1 ? '' : 's'} in ${escapeHtml(stateName)}</a> — real phone numbers and service areas, no lead-buying middleman.`
      : `<a href="/contractors/${stateSlug}/">Browse epoxy and concrete coating contractors in ${escapeHtml(stateName)}</a>, or get an instant estimate first so you know what a fair quote looks like.`
    }</p></div>`;

  const { html: faqHtml, schema: faqSchema } = faqBlock([
    { q: `How much does epoxy flooring cost in ${stateName}?`, a: `Costs vary by city and system — see the table above for city-level ranges, or get an exact instant estimate for your specific address.` },
    { q: `Does epoxy flooring hold up to ${stateName} weather?`, a: `Yes, with the right system for local conditions — see any city page above for climate-specific guidance, or start an instant estimate to get matched to the right system for your space.` },
  ]);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Epoxy flooring cost</p>
    <h1 class="content-h1">Epoxy Flooring in ${escapeHtml(stateName)}: 2026 Costs by City</h1>
    ${estimatorCta(null)}
    ${tableHtml}
    ${contractorCalloutHtml}
    <h2>FAQ</h2>
    ${faqHtml}`;

  // No single hero for a whole state — lead with its highest-tier city's
  // real photo (falls through metros in tier order, then each metro's own
  // nearest-neighbor list for the rare state where every in-state metro
  // lacks a photo, e.g. DC has only one metro).
  const stateOgImage = metros.map((m) => getCityImage(m.state_slug, m.slug)?.path).find(Boolean)
    || metros.flatMap((m) => nearestMetros(m, 5)).map((m) => getCityImage(m.state_slug, m.slug)?.path).find(Boolean)
    || GENERIC_OG_IMAGE;

  return renderContentPage({
    title: `Epoxy Flooring in ${stateName}: 2026 Costs by City | EpoxyGrind`,
    description: `Epoxy flooring costs across ${stateName} by city — compare local price ranges and get an instant photo estimate for your space.`,
    path,
    bodyHtml,
    schema: [faqSchema, breadcrumbSchema(breadcrumbs, path)],
    wide: true,
    ogImage: stateOgImage,
  });
}

/** National local hub `/epoxy-flooring/` (spec §5d). */
export function renderNationalHub(allMetros) {
  const breadcrumbs = [{ label: 'Home', href: '/' }, { label: 'Epoxy Flooring' }];
  const path = '/epoxy-flooring/';
  const states = [...new Set(allMetros.map((m) => m.state_slug))]
    .map((slug) => allMetros.find((m) => m.state_slug === slug))
    .sort((a, b) => a.state.localeCompare(b.state));
  const tier1 = allMetros.filter((m) => m.tier === 1);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Epoxy flooring cost</p>
    <h1 class="content-h1">Epoxy Flooring Costs Near You</h1>
    <p class="content-dek">Local pricing and guidance for epoxy garage, basement, and patio flooring across the U.S. — or skip straight to an instant photo estimate for your exact space.</p>
    ${estimatorCta(null)}
    <h2>Top metros</h2>
    <div class="category-grid">
      ${tier1.map((m) => `<a class="category-card" href="/epoxy-flooring/${m.state_slug}/${m.slug}/"><h3>${escapeHtml(m.city)}, ${escapeHtml(m.state)}</h3><p>Epoxy flooring cost & instant estimate</p></a>`).join('')}
    </div>
    <h2>All states</h2>
    <div class="category-grid">
      ${states.map((s) => `<a class="category-card" href="/epoxy-flooring/${s.state_slug}/"><h3>${escapeHtml(stateNameFromSlug(s.state_slug))}</h3><p>Costs by city</p></a>`).join('')}
    </div>`;

  // National hub: lead with a top-tier metro's real photo as the
  // representative shot for the whole section.
  const nationalOgImage = tier1.map((m) => getCityImage(m.state_slug, m.slug)?.path).find(Boolean) || GENERIC_OG_IMAGE;

  return renderContentPage({
    title: 'Epoxy Flooring Costs Near You — 2026 Local Pricing | EpoxyGrind',
    description: 'Local epoxy flooring pricing and guidance by state and city, plus a free instant photo estimate for your exact space.',
    path,
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, path)],
    wide: true,
    ogImage: nationalOgImage,
  });
}

export { SITE_URL };
