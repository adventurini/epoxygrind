import { renderContentPage, breadcrumbsHtml, breadcrumbSchema, escapeHtml } from './content-shell.js';
import { faqBlock, videoEmbedHtml, proCtaHtml } from './content-components.js';
import { getGuideImages, PILLAR_SECOND_VIDEO, getGuideVideo } from './guide-videos.js';

const HIRE_HREF = '/';
const DIY_HREF = '/diy/how-to-epoxy-garage-floor/';

function headHtml({ eyebrow, title, dek }) {
  return `<p class="content-eyebrow">${escapeHtml(eyebrow)}</p>
  <h1 class="content-h1">${escapeHtml(title)}</h1>
  ${dek ? `<p class="content-dek">${dek}</p>` : ''}`;
}

/** The spec's "dual CTA rule" — every page serves both a lead (hire) and a
 * kit-buyer (DIY) exit. Built once here so it's not hand-repeated 10 times. */
function dualCtaHtml({ compact = false, weightHire = false } = {}) {
  if (compact) {
    return `<div class="dual-cta dual-cta-compact">
      <a class="btn btn-p" href="${HIRE_HREF}">Get a priced estimate →</a>
      <a class="btn btn-o" href="${DIY_HREF}">See the DIY how-to guide →</a>
    </div>`;
  }
  return `<div class="dual-cta">
    <div class="dual-cta-card${weightHire ? ' dual-cta-primary' : ''}">
      <h3>Ready to hire a pro?</h3>
      <p>Get a free instant photo estimate — no obligation, no phone call required.</p>
      <a class="btn btn-p" href="${HIRE_HREF}">Get my instant estimate →</a>
    </div>
    <div class="dual-cta-card">
      <h3>Doing it yourself?</h3>
      <p>Start with the complete how-to guide, sized to your space.</p>
      <a class="btn btn-o" href="${DIY_HREF}">Read the full how-to guide →</a>
    </div>
  </div>`;
}

function quickDecisionHtml({ diyIf = [], hireIf = [] }) {
  return `<div class="quick-decision">
    <div class="quick-decision-col quick-decision-diy"><h3>DIY if…</h3><ul>${diyIf.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>
    <div class="quick-decision-col quick-decision-hire"><h3>Hire a pro if…</h3><ul>${hireIf.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>
  </div>`;
}

function whatGoesWrongHtml(items) {
  if (!items?.length) return '';
  return `<div class="mistakes-box"><h3>What goes wrong</h3>
    <div class="comparison-table-wrap"><table class="comparison-table">
      <thead><tr><th>Issue</th><th>How often</th><th>Fix cost</th></tr></thead>
      <tbody>${items.map((i) => `<tr><td class="name-cell">${escapeHtml(i.issue)}</td><td>${escapeHtml(i.frequency)}</td><td>${escapeHtml(i.fixCost)}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

/** @param {{columns:string[], rows:Array<{label:string, cells:string[]}>}} data */
export function simpleComparisonTable({ columns, rows }) {
  return `<div class="comparison-table-wrap"><table class="comparison-table">
    <thead><tr><th></th>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="name-cell">${escapeHtml(r.label)}</td>${r.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function relatedLinksHtml(links) {
  if (!links?.length) return '';
  return `<h2>Related reading</h2><div class="category-grid">${links.map((l) => `<a class="category-card" href="${l.href}"><h3>${escapeHtml(l.title)}</h3><p>${escapeHtml(l.description)}</p></a>`).join('')}</div>`;
}

/**
 * DIY-vs-Pro cluster angle page `/guides/{slug}/` (BUILD-diy-vs-pro-cluster.md).
 * @param {object} data
 * @param {string} data.slug
 * @param {string} data.title
 * @param {string} data.metaTitle
 * @param {string} data.metaDescription
 * @param {string} data.dek
 * @param {string} data.introHtml - states the honest answer up front
 * @param {{diyIf:string[], hireIf:string[]}} data.quickDecision
 * @param {Array<{heading:string, bodyHtml:string}>} data.sections
 * @param {Array<{issue:string, frequency:string, fixCost:string}>} [data.whatGoesWrong]
 * @param {Array<{q:string,a:string}>} data.faq
 * @param {Array<{href:string,title:string,description:string}>} data.relatedLinks
 * @param {boolean} [data.weightHire] - weight the "hire" CTA harder (regret/problem pages)
 */
export function renderGuidePage(data) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Should you DIY?', href: '/compare/diy-kit-vs-professional-epoxy/' },
    { label: data.title },
  ];
  const path = `/guides/${data.slug}/`;

  const video = getGuideVideo(data.slug);
  const videoHtml = video ? videoEmbedHtml(video) : '';
  const images = getGuideImages(data.slug);
  const heroHtml = images
    ? `<figure class="guide-hero"><img src="${images.hero}" alt="${escapeHtml(data.title)}" loading="eager"><figcaption>Still from "${escapeHtml(images.title)}" — ${escapeHtml(images.channel)} on YouTube</figcaption></figure>`
    : '';

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'DIY vs. hiring a pro', title: data.title, dek: data.dek })}
    ${heroHtml}
    <div class="content-prose">${data.introHtml}</div>
    ${dualCtaHtml({ compact: true, weightHire: data.weightHire })}
    ${videoHtml}
    ${quickDecisionHtml(data.quickDecision)}
    ${data.sections.map((s) => `<h2>${escapeHtml(s.heading)}</h2><div class="content-prose">${s.bodyHtml}</div>`).join('')}
    ${whatGoesWrongHtml(data.whatGoesWrong)}
    ${dualCtaHtml({ weightHire: data.weightHire })}
    <h2>FAQ</h2>
    ${faqHtml}
    ${relatedLinksHtml(data.relatedLinks)}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.metaDescription,
    ...(images ? { image: images.hero } : {}),
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path,
    bodyHtml,
    schema: [articleSchema, faqSchema, breadcrumbSchema(breadcrumbs, path)],
    showDisclosure: true,
    ogImage: images?.thumb,
  });
}

/**
 * The cluster pillar `/compare/diy-kit-vs-professional-epoxy/` — the most
 * comprehensive page, links to every angle page. Distinct from (and much
 * richer than) the simple two-column renderConceptComparePage template.
 * @param {object} data - same shape as renderGuidePage's data, plus:
 * @param {Array<{system:string, diyCost:string, proCost:string}>} data.costTable
 * @param {Array<{href:string,title:string,description:string}>} data.angleLinks - all 9 angle pages
 */
export function renderGuidePillar(data) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Compare', href: '/compare/' },
    { label: data.title },
  ];
  const path = `/compare/${data.slug}/`;

  const primaryVideo = getGuideVideo(data.slug);
  const images = getGuideImages(data.slug);
  const heroHtml = images
    ? `<figure class="guide-hero"><img src="${images.hero}" alt="${escapeHtml(data.title)}" loading="eager"><figcaption>Still from "${escapeHtml(images.title)}" — ${escapeHtml(images.channel)} on YouTube</figcaption></figure>`
    : '';

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);

  const costTableHtml = data.costTable
    ? `<h2>Real cost comparison</h2>${simpleComparisonTable({
        columns: ['DIY kit + tools', 'Professional install'],
        rows: data.costTable.map((r) => ({ label: r.system, cells: [r.diyCost, r.proCost] })),
      })}<p class="muted tiny">Prices as of this writing — DIY kit prices from manufacturer listings, professional ranges from EpoxyGrind's own regional pricing model (the same figures the instant estimator uses).</p>`
    : '';

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'The complete decision guide', title: data.title, dek: data.dek })}
    ${heroHtml}
    <div class="content-prose">${data.introHtml}</div>
    ${dualCtaHtml({ compact: true, weightHire: false })}
    ${primaryVideo ? videoEmbedHtml(primaryVideo) : ''}
    ${quickDecisionHtml(data.quickDecision)}
    ${data.sections.map((s) => `<h2>${escapeHtml(s.heading)}</h2><div class="content-prose">${s.bodyHtml}</div>`).join('')}
    ${costTableHtml}
    ${whatGoesWrongHtml(data.whatGoesWrong)}
    <h2>See a real pro install, start to finish</h2>
    <div class="content-prose"><p>If you're weighing what a professional actually does differently, watch the prep and process below — it's the same grind-prime-coat-topcoat sequence our own <a href="/diy/how-to-epoxy-garage-floor/">DIY how-to guide</a> walks through, just executed at production speed with commercial equipment.</p></div>
    ${videoEmbedHtml(PILLAR_SECOND_VIDEO)}
    ${dualCtaHtml({ weightHire: false })}
    <h2>FAQ</h2>
    ${faqHtml}
    <h2>Explore every angle</h2>
    <div class="category-grid">${data.angleLinks.map((l) => `<a class="category-card" href="${l.href}"><h3>${escapeHtml(l.title)}</h3><p>${escapeHtml(l.description)}</p></a>`).join('')}</div>`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.metaDescription,
    ...(images ? { image: images.hero } : {}),
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path,
    bodyHtml,
    schema: [articleSchema, faqSchema, breadcrumbSchema(breadcrumbs, path)],
    showDisclosure: true,
    wide: true,
    ogImage: images?.thumb,
  });
}
