import { resolveProductLink } from './product-registry.js';
import { escapeHtml } from './content-shell.js';

/**
 * Plain-JS equivalents of spec_2 §11b's component inventory. Each of
 * these enforces the same rules a real <ProductLink> build failure would
 * (§2's registry integrity rules) — the caller must handle a null/false
 * return rather than silently rendering a broken link.
 */

/** @returns {string|null} anchor HTML, or null if the product isn't linkable (unknown/todo/dead) */
export function productLinkHtml(productId, label) {
  const resolved = resolveProductLink(productId);
  if (!resolved.ok) {
    console.error(`productLinkHtml: ${productId} unresolved (${resolved.reason})`);
    return null;
  }
  const text = escapeHtml(label || resolved.product.display_name);
  return `<a class="product-link" href="/go/${encodeURIComponent(productId)}" rel="${resolved.rel}" target="_blank">${text}</a>`;
}

/**
 * @param {string} productId
 * @param {{verdictLabel?: string, verdictReason?: string, specs?: Record<string,string>, writeupHtml?: string}} opts
 *
 * Shows the product photo and price when the registry has them — both are
 * only ever populated from a live merchant-page fetch (see product-registry.js
 * header comment), never fabricated. Most amazon.com entries don't have
 * them yet (Amazon's product pages aren't fetchable by our tooling), so
 * the card falls back to a text-only layout for those rather than showing
 * a broken image or a guessed price.
 */
export function productCardHtml(productId, opts = {}) {
  const resolved = resolveProductLink(productId);
  if (!resolved.ok) {
    console.error(`productCardHtml: ${productId} unresolved (${resolved.reason})`);
    return '';
  }
  const p = resolved.product;
  const specs = Object.entries(opts.specs || {})
    .map(([k, v]) => `<span class="spec-chip">${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
    .join('');

  const body = `<div class="product-card-head">
      <div>
        <p class="product-card-name">${escapeHtml(p.display_name)}</p>
        <p class="product-card-brand">${escapeHtml(p.brand)}</p>
      </div>
      ${opts.verdictLabel ? `<span class="spec-chip">${escapeHtml(opts.verdictLabel)}</span>` : ''}
    </div>
    ${p.price_text ? `<p class="product-card-price">${escapeHtml(p.price_text)}<span class="product-card-price-date">as of ${escapeHtml(p.price_observed_date || p.verified_date)}</span></p>` : ''}
    ${specs ? `<div class="product-card-specs">${specs}</div>` : ''}
    ${opts.verdictReason ? `<p class="verdict-reason">${escapeHtml(opts.verdictReason)}</p>` : ''}
    ${opts.writeupHtml || ''}
    <div class="product-card-cta"><a class="btn btn-p btn-sm" href="/go/${encodeURIComponent(productId)}" rel="${resolved.rel}" target="_blank">Check price →</a></div>`;

  if (p.image_url) {
    return `<div class="product-card product-card-with-media">
      <div class="product-card-media"><img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.display_name)}" loading="lazy"></div>
      <div class="product-card-content">${body}</div>
    </div>`;
  }

  return `<div class="product-card">${body}</div>`;
}

/**
 * Rankings comparison table. @param {{label:string, columns: string[], rows: Array<{productId:string, cells:string[]}>}} data
 */
export function comparisonTableHtml(data) {
  const rows = data.rows
    .map((row) => {
      const resolved = resolveProductLink(row.productId);
      if (!resolved.ok) {
        console.error(`comparisonTableHtml: ${row.productId} unresolved (${resolved.reason})`);
        return '';
      }
      const cells = row.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('');
      return `<tr><td class="name-cell"><a class="product-link" href="/go/${encodeURIComponent(row.productId)}" rel="${resolved.rel}" target="_blank">${escapeHtml(resolved.product.display_name)}</a></td>${cells}</tr>`;
    })
    .join('');

  return `<div class="comparison-table-wrap"><table class="comparison-table">
    <thead><tr><th>Product</th>${data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

export function verdictBoxHtml({ label, reason }) {
  return `<div class="verdict-box">
    <p class="verdict-label">${escapeHtml(label)}</p>
    <p class="verdict-reason">${escapeHtml(reason)}</p>
  </div>`;
}

export function prosConsHtml({ pros = [], cons = [] }) {
  return `<div class="pros-cons">
    <div class="pros"><h4>Pros</h4><ul>${pros.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>
    <div class="cons"><h4>Cons</h4><ul>${cons.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>
  </div>`;
}

/** @param {Array<{title:string, bodyHtml:string}>} steps */
export function stepListHtml(steps, { time, difficulty } = {}) {
  const meta = [time ? `Time: ${time}` : '', difficulty ? `Difficulty: ${difficulty}` : ''].filter(Boolean);
  return `${meta.length ? `<p class="step-meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</p>` : ''}
  <ol class="step-list">
    ${steps.map((s) => `<li><p class="step-title">${escapeHtml(s.title)}</p>${s.bodyHtml}</li>`).join('')}
  </ol>`;
}

/**
 * Lazy-loaded YouTube embed (privacy-friendly youtube-nocookie.com host).
 * Renders a click-to-load facade (thumbnail + play button) instead of an
 * iframe up front so the guide text stays the page weight — the iframe is
 * only created on click, via the delegated script in content-shell.js.
 * @param {{videoId:string, title:string, channel:string}} video
 */
export function videoEmbedHtml(video) {
  if (!video?.videoId) return '';
  const thumb = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  return `<div class="video-embed">
    <div class="video-embed-frame">
      <button type="button" class="video-embed-facade" data-video-id="${escapeHtml(video.videoId)}" data-video-title="${escapeHtml(video.title)}" aria-label="Play video: ${escapeHtml(video.title)}" style="background-image:url('${thumb}')">
        <span class="video-embed-play" aria-hidden="true">&#9658;</span>
      </button>
    </div>
    <p class="video-embed-caption">"${escapeHtml(video.title)}" — ${escapeHtml(video.channel)} on YouTube (third-party video)</p>
  </div>`;
}

export function mistakesToAvoidHtml(items) {
  return `<div class="mistakes-box">
    <h3>Mistakes to avoid</h3>
    <ul>${items.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
  </div>`;
}

/** @param {Array<{q:string,a:string}>} items @returns {{html:string, schema:object}} */
export function faqBlock(items) {
  const html = `<div class="faq-list">
    ${items.map((item) => `<div class="faq-item"><p class="faq-q">${escapeHtml(item.q)}</p><p class="faq-a">${escapeHtml(item.a)}</p></div>`).join('')}
  </div>`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  return { html, schema };
}

export function proCtaHtml() {
  return `<div class="pro-cta">
    <div class="pro-cta-text">
      <h3>Rather have a pro do it?</h3>
      <p>Upload a photo and get a priced estimate in seconds — no obligation.</p>
    </div>
    <a class="btn btn-p" href="/">Get my instant estimate →</a>
  </div>`;
}

/** @param {{sqft:number, items: Array<{productId:string, qty:string, qtyNote?:string, phase:'prep'|'apply'|'ppe'}>, budgetRange:string}} data */
export function shoppingListHtml(data) {
  const phases = [
    { id: 'prep', label: 'Prep' },
    { id: 'apply', label: 'Apply' },
    { id: 'ppe', label: 'PPE' },
  ];
  const sections = phases
    .map((phase) => {
      const rows = data.items
        .filter((item) => item.phase === phase.id)
        .map((item) => {
          const resolved = resolveProductLink(item.productId);
          if (!resolved.ok) {
            console.error(`shoppingListHtml: ${item.productId} unresolved (${resolved.reason})`);
            return '';
          }
          return `<div class="shopping-list-row">
            <a class="product-link" href="/go/${encodeURIComponent(item.productId)}" rel="${resolved.rel}" target="_blank">${escapeHtml(resolved.product.display_name)}</a>
            <span class="qty">${escapeHtml(item.qty)}${item.qtyNote ? ` · ${escapeHtml(item.qtyNote)}` : ''}</span>
          </div>`;
        })
        .join('');
      return rows ? `<p class="shopping-list-phase">${phase.label}</p>${rows}` : '';
    })
    .join('');

  return `<div class="shopping-list">
    ${sections}
    <div class="shopping-list-total"><span>Estimated total</span><span>${escapeHtml(data.budgetRange)}</span></div>
  </div>`;
}
