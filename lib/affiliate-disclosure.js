import { hasAnyAffiliateLink } from './product-registry.js';

/**
 * Renders nothing while every registry entry's affiliate_url is null.
 * Once any product is promoted to a real affiliate link, this starts
 * rendering automatically on any page that calls it — FTC disclosure
 * becomes automatic instead of a retrofit (spec §2.6).
 */
export function affiliateDisclosureHtml() {
  if (!hasAnyAffiliateLink()) return '';
  return `<p class="affiliate-disclosure">We may earn a commission if you buy through links on this page — it never affects our picks or pricing.</p>`;
}
