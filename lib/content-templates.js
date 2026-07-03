import { renderContentPage, breadcrumbsHtml, breadcrumbSchema, escapeHtml } from './content-shell.js';
import {
  comparisonTableHtml,
  verdictBoxHtml,
  prosConsHtml,
  stepListHtml,
  mistakesToAvoidHtml,
  faqBlock,
  proCtaHtml,
  shoppingListHtml,
  productCardHtml,
  productLinkHtml,
  videoEmbedHtml,
} from './content-components.js';
import { resolveProductLink } from './product-registry.js';
import { getGuideVideo } from './guide-videos.js';

const SITE_URL = 'https://epoxygrind.vercel.app';

function headHtml({ eyebrow, title, dek }) {
  return `<p class="content-eyebrow">${escapeHtml(eyebrow)}</p>
  <h1 class="content-h1">${escapeHtml(title)}</h1>
  ${dek ? `<p class="content-dek">${escapeHtml(dek)}</p>` : ''}`;
}

/**
 * Type 1 — Rankings `/best/{slug}` (spec_2 §4). 5-8 products, comparison
 * table, per-pick verdict + writeup, evaluation criteria, FAQ. ItemList schema.
 */
export function renderRankingPage(data) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Best', href: '/best/' },
    { label: data.title },
  ];

  const picksHtml = data.picks
    .map((pick) => {
      if (!resolveProductLink(pick.productId).ok) {
        console.error(`renderRankingPage(${data.slug}): ${pick.productId} unresolved`);
        return null;
      }
      return productCardHtml(pick.productId, {
        verdictLabel: pick.verdictLabel,
        verdictReason: pick.verdictReason,
        writeupHtml: pick.writeupHtml,
      });
    })
    .filter(Boolean)
    .join('');

  const tableRows = data.picks
    .map((pick) => ({ productId: pick.productId, cells: data.tableColumns.map((col) => pick.specs?.[col] || '—') }))
    .filter((row) => resolveProductLink(row.productId).ok);

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'Best picks', title: data.title, dek: data.dek })}
    <div class="content-meta"><span>Updated ${escapeHtml(data.updated)}</span></div>
    <div class="content-prose">${data.introHtml}</div>
    ${comparisonTableHtml({ label: data.title, columns: data.tableColumns, rows: tableRows })}
    ${picksHtml}
    <h2>How we evaluate</h2>
    <div class="content-prose">${data.evaluationCriteriaHtml}</div>
    ${proCtaHtml()}
    <h2>FAQ</h2>
    ${faqHtml}`;

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: data.picks
      .map((pick, i) => {
        const resolved = resolveProductLink(pick.productId);
        return resolved.ok
          ? { '@type': 'ListItem', position: i + 1, name: resolved.product.display_name, url: `${SITE_URL}/go/${pick.productId}` }
          : null;
      })
      .filter(Boolean),
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: `/best/${data.slug}/`,
    bodyHtml,
    schema: [itemListSchema, faqSchema, breadcrumbSchema(breadcrumbs, `/best/${data.slug}/`)],
    showDisclosure: true,
  });
}

/**
 * Type 2 — Reviews `/reviews/{slug}`. One product deep-dive. Product +
 * Review schema.
 */
export function renderReviewPage(data) {
  const resolved = resolveProductLink(data.productId);
  if (!resolved.ok) {
    throw new Error(`renderReviewPage(${data.slug}): ${data.productId} unresolved (${resolved.reason})`);
  }
  const product = resolved.product;

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Reviews', href: '/reviews/' },
    { label: product.display_name },
  ];

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);

  const alternativesHtml = (data.alternatives || [])
    .map((alt) => {
      const altResolved = resolveProductLink(alt.productId);
      if (!altResolved.ok) return null;
      return `<li><a class="product-link" href="/go/${encodeURIComponent(alt.productId)}" rel="${altResolved.rel}" target="_blank">${escapeHtml(altResolved.product.display_name)}</a> — ${escapeHtml(alt.note)}</li>`;
    })
    .filter(Boolean)
    .join('');

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'Review', title: data.title, dek: data.dek })}
    <div class="content-meta"><span>Updated ${escapeHtml(data.updated)}</span><span>Editorial rating: ${escapeHtml(String(data.rating))}/5</span></div>
    ${verdictBoxHtml({ label: data.verdict.label, reason: data.verdict.reason })}
    <h2>What's in the box</h2>
    <div class="content-prose">${data.whatsInTheBoxHtml}</div>
    <h2>Real coverage math</h2>
    <div class="content-prose">${data.coverageMathHtml}</div>
    <h2>Application walkthrough</h2>
    <div class="content-prose">${data.applicationWalkthroughHtml}</div>
    ${data.pros ? prosConsHtml({ pros: data.pros, cons: data.cons }) : ''}
    <p><a class="btn btn-p" href="/go/${encodeURIComponent(data.productId)}" rel="${resolved.rel}" target="_blank">Check price →</a></p>
    ${alternativesHtml ? `<h2>Alternatives</h2><ul>${alternativesHtml}</ul>` : ''}
    ${proCtaHtml()}
    <h2>FAQ</h2>
    ${faqHtml}`;

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.display_name,
    brand: { '@type': 'Brand', name: product.brand },
    review: {
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: data.rating, bestRating: 5 },
      author: { '@type': 'Organization', name: 'EpoxyGrind' },
      reviewBody: data.dek,
    },
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: `/reviews/${data.slug}/`,
    bodyHtml,
    schema: [productSchema, faqSchema, breadcrumbSchema(breadcrumbs, `/reviews/${data.slug}/`)],
    showDisclosure: true,
  });
}

/**
 * Type 3 — Head-to-head `/compare/{a}-vs-{b}`. Article + FAQPage schema.
 */
export function renderComparePage(data) {
  const a = resolveProductLink(data.productIdA);
  const b = resolveProductLink(data.productIdB);
  if (!a.ok || !b.ok) {
    throw new Error(`renderComparePage(${data.slug}): unresolved product (${!a.ok ? data.productIdA : data.productIdB})`);
  }

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Compare', href: '/compare/' },
    { label: data.title },
  ];

  const tableRows = data.rows
    .map((row) => `<tr><td class="name-cell">${escapeHtml(row.label)}</td><td>${escapeHtml(row.a)}</td><td>${escapeHtml(row.b)}</td></tr>`)
    .join('');

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'Compare', title: data.title, dek: data.dek })}
    <div class="content-prose">${data.introHtml}</div>
    <div class="comparison-table-wrap"><table class="comparison-table">
      <thead><tr><th></th><th>${escapeHtml(a.product.display_name)}</th><th>${escapeHtml(b.product.display_name)}</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>
    <h2>Choose ${escapeHtml(a.product.brand)} if…</h2>
    <div class="content-prose">${data.verdictAHtml}</div>
    <h2>Choose ${escapeHtml(b.product.brand)} if…</h2>
    <div class="content-prose">${data.verdictBHtml}</div>
    <p><a class="btn btn-o btn-sm" href="/go/${encodeURIComponent(data.productIdA)}" rel="${a.rel}" target="_blank">${escapeHtml(a.product.brand)} price →</a> &nbsp; <a class="btn btn-o btn-sm" href="/go/${encodeURIComponent(data.productIdB)}" rel="${b.rel}" target="_blank">${escapeHtml(b.product.brand)} price →</a></p>
    ${proCtaHtml()}
    <h2>FAQ</h2>
    ${faqHtml}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.metaDescription,
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: `/compare/${data.slug}/`,
    bodyHtml,
    schema: [articleSchema, faqSchema, breadcrumbSchema(breadcrumbs, `/compare/${data.slug}/`)],
    showDisclosure: true,
  });
}

/**
 * Type 3b — Concept head-to-head `/compare/{a}-vs-{b}` (BUILD-diy-guides-
 * complete_1.md Wave 3). Unlike renderComparePage above (a specific product
 * vs. a specific product, CTAs to /go/ links), these compare a material,
 * method, or approach — "epoxy vs. polyaspartic," "DIY vs. professional" —
 * so there's no product to resolve. CTAs point at whichever guide/ranking/
 * estimator is the natural next step for each side instead.
 */
export function renderConceptComparePage(data) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Compare', href: '/compare/' },
    { label: data.title },
  ];

  const tableRows = data.rows
    .map((row) => `<tr><td class="name-cell">${escapeHtml(row.label)}</td><td>${escapeHtml(row.a)}</td><td>${escapeHtml(row.b)}</td></tr>`)
    .join('');

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);

  const ctaHtml = (cta) => (cta ? `<a class="btn btn-o btn-sm" href="${cta.href}">${escapeHtml(cta.label)}</a>` : '');

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'Compare', title: data.title, dek: data.dek })}
    <div class="content-prose">${data.introHtml}</div>
    <div class="comparison-table-wrap"><table class="comparison-table">
      <thead><tr><th></th><th>${escapeHtml(data.sideALabel)}</th><th>${escapeHtml(data.sideBLabel)}</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>
    <h2>Choose ${escapeHtml(data.sideALabel)} if…</h2>
    <div class="content-prose">${data.verdictAHtml}</div>
    <h2>Choose ${escapeHtml(data.sideBLabel)} if…</h2>
    <div class="content-prose">${data.verdictBHtml}</div>
    ${data.ctaA || data.ctaB ? `<p>${ctaHtml(data.ctaA)} &nbsp; ${ctaHtml(data.ctaB)}</p>` : ''}
    ${data.proCtaMidPage ? proCtaHtml() : ''}
    <h2>FAQ</h2>
    ${faqHtml}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.metaDescription,
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: `/compare/${data.slug}/`,
    bodyHtml,
    schema: [articleSchema, faqSchema, breadcrumbSchema(breadcrumbs, `/compare/${data.slug}/`)],
    showDisclosure: false,
  });
}

function materialsListHtml(materials) {
  if (!materials?.length) return '';
  const items = materials
    .map((m) => {
      const link = productLinkHtml(m.productId, m.label);
      if (!link) return null;
      return `<li>${link}${m.note ? ` — ${escapeHtml(m.note)}` : ''}</li>`;
    })
    .filter(Boolean)
    .join('');
  return items ? `<h2>What you'll need</h2><ul class="materials-list">${items}</ul>` : '';
}

/**
 * Type 4 — DIY guides `/diy/{slug}`. Article + FAQPage schema (no HowTo —
 * Google dropped the rich result per spec §7). ProCTA placement is
 * mid-page (after the step list) when data.proCtaMidPage is set, per §8's
 * rule for failed-DIY-reader pages. Video (lib/guide-videos.js, keyed by
 * slug) renders after the intro + materials list, before the steps, per
 * BUILD-diy-guides-complete_1.md's placement rule.
 */
export function renderDiyGuidePage(data) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'DIY guides', href: '/diy/' },
    { label: data.title },
  ];

  const { html: faqHtml, schema: faqSchema } = faqBlock(data.faq);
  const stepsHtml = stepListHtml(data.steps, { time: data.timeEstimate, difficulty: data.difficulty });
  const mistakesHtml = data.mistakes ? mistakesToAvoidHtml(data.mistakes) : '';
  const materialsHtml = materialsListHtml(data.materials);
  const video = getGuideVideo(data.slug);
  const videoHtml = video ? videoEmbedHtml(video) : '';

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'DIY guide', title: data.title, dek: data.dek })}
    <div class="content-prose">${data.introHtml}</div>
    ${materialsHtml}
    ${videoHtml}
    ${stepsHtml}
    ${data.proCtaMidPage ? proCtaHtml() : ''}
    ${mistakesHtml}
    ${!data.proCtaMidPage ? proCtaHtml() : ''}
    <h2>FAQ</h2>
    ${faqHtml}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.metaDescription,
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: `/diy/${data.slug}/`,
    bodyHtml,
    schema: [articleSchema, faqSchema, breadcrumbSchema(breadcrumbs, `/diy/${data.slug}/`)],
    showDisclosure: true,
  });
}

/**
 * Type 5a — Shopping lists `/diy/shopping-list-{size}`. Complete linked
 * list with quantities and a budget total, sized to the space.
 */
export function renderShoppingListPage(data) {
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'DIY guides', href: '/diy/' },
    { label: data.title },
  ];

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'Shopping list', title: data.title, dek: data.dek })}
    ${shoppingListHtml({ sqft: data.sqft, items: data.items, budgetRange: data.budgetRange })}
    ${proCtaHtml()}`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.metaDescription,
  };

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: `/diy/${data.slug}/`,
    bodyHtml,
    schema: [articleSchema, breadcrumbSchema(breadcrumbs, `/diy/${data.slug}/`)],
    showDisclosure: true,
  });
}

/** The /compare/ hub — links every head-to-head comparison page. */
export function renderCompareHubPage(data) {
  const breadcrumbs = [{ label: 'Home', href: '/' }, { label: 'Compare' }];

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'Compare', title: data.title, dek: data.dek })}
    <div class="category-grid">
      ${data.items.map((item) => `<a class="category-card" href="${item.href}"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></a>`).join('')}
    </div>
    ${proCtaHtml()}`;

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: '/compare/',
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, '/compare/')],
    wide: true,
  });
}

/** The /diy/ hub — links every page in the section, grouped by type (spec_2 §8). */
export function renderDiyHubPage(data) {
  const breadcrumbs = [{ label: 'Home', href: '/' }, { label: 'DIY guides' }];

  const groupHtml = (group) => `<h2>${escapeHtml(group.title)}</h2>
    <div class="category-grid">
      ${group.items.map((item) => `<a class="category-card" href="${item.href}"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></a>`).join('')}
    </div>`;

  const bodyHtml = `${breadcrumbsHtml(breadcrumbs)}
    ${headHtml({ eyebrow: 'DIY & product guides', title: data.title, dek: data.dek })}
    ${data.groups.map(groupHtml).join('')}
    ${proCtaHtml()}`;

  return renderContentPage({
    title: data.metaTitle || data.title,
    description: data.metaDescription,
    path: '/diy/',
    bodyHtml,
    schema: [breadcrumbSchema(breadcrumbs, '/diy/')],
    wide: true,
  });
}
