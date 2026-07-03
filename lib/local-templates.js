import { renderContentPage, breadcrumbsHtml, breadcrumbSchema, escapeHtml } from './content-shell.js';
import { faqBlock } from './content-components.js';
import { localPriceTable } from './local-pricing.js';
import { getClimateRegion } from './climate-regions.js';
import { nearestMetros, metrosByState, stateNameFromSlug } from './metros.js';

const SITE_URL = 'https://epoxygrind.vercel.app';

function estimatorCta(zip, label = 'Get my instant estimate →') {
  const href = zip ? `/?zip=${encodeURIComponent(zip)}` : '/';
  return `<p><a class="btn btn-p" href="${href}">${escapeHtml(label)}</a></p>`;
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

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Epoxy flooring cost</p>
    <h1 class="content-h1">Epoxy Flooring in ${escapeHtml(metro.city)}, ${escapeHtml(metro.state)}: 2026 Cost &amp; Instant Estimate</h1>
    ${estimatorCta(metro.primary_zip)}
    ${priceTableHtml(metro.cost_index).replace('{city}', escapeHtml(metro.city))}
    ${region ? `<h2>${escapeHtml(region.label)} considerations</h2><div class="content-prose">${region.bodyHtml}</div>` : ''}
    ${hiringGuideHtml(metro)}
    ${areasServedHtml(metro)}
    <h2>FAQ</h2>
    ${faqHtml}
    <h2>More resources</h2>
    <div class="content-prose"><p><a href="/epoxy-flooring-cost">Read the full epoxy flooring cost guide</a> for a national breakdown of what drives price, or browse our <a href="/diy/">DIY guides</a> if you're considering doing it yourself.</p></div>
    ${nearbyHtml}`;

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

  const { html: faqHtml, schema: faqSchema } = faqBlock([
    { q: `How much does epoxy flooring cost in ${stateName}?`, a: `Costs vary by city and system — see the table above for city-level ranges, or get an exact instant estimate for your specific address.` },
    { q: `Does epoxy flooring hold up to ${stateName} weather?`, a: `Yes, with the right system for local conditions — see any city page above for climate-specific guidance, or start an instant estimate to get matched to the right system for your space.` },
  ]);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    <p class="content-eyebrow">Epoxy flooring cost</p>
    <h1 class="content-h1">Epoxy Flooring in ${escapeHtml(stateName)}: 2026 Costs by City</h1>
    ${estimatorCta(null)}
    ${tableHtml}
    <h2>FAQ</h2>
    ${faqHtml}`;

  return renderContentPage({
    title: `Epoxy Flooring in ${stateName}: 2026 Costs by City | EpoxyGrind`,
    description: `Epoxy flooring costs across ${stateName} by city — compare local price ranges and get an instant photo estimate for your space.`,
    path,
    bodyHtml,
    schema: [faqSchema, breadcrumbSchema(breadcrumbs, path)],
    wide: true,
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

  return renderContentPage({
    title: 'Epoxy Flooring Costs Near You — 2026 Local Pricing | EpoxyGrind',
    description: 'Local epoxy flooring pricing and guidance by state and city, plus a free instant photo estimate for your exact space.',
    path,
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, path)],
    wide: true,
  });
}

export { SITE_URL };
