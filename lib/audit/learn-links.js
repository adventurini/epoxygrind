/**
 * Maps a scoring check's exact `label` (lib/audit/scoring-*.js) to its
 * /learn/{slug}/ article, so the audit dashboard can link a finding straight
 * to the explanation. Deliberately a manual map, not a slugify(label) guess
 * — labels change wording sometimes and a silent mismatch would link to a
 * 404 with no way to notice. Full coverage: one entry per check across all
 * 9 audit categories (42 checks — Design & UX is scored on dimensions, not
 * discrete checks, so it has no article).
 */
export const LEARN_LINKS = {
  'Before/after photo present': 'before-after-photo',
  'Broken links': 'broken-links',
  'Chat widget': 'chat-widget',
  'City/service landing pages': 'city-service-landing-pages',
  'Click-to-call link': 'click-to-call-link',
  'Click-to-call': 'click-to-call',
  'Console errors on load': 'console-errors-on-load',
  'Contact/CTA presence across pages': 'contact-cta-presence-across-pages',
  'CTA reachable while scrolling': 'cta-reachable-while-scrolling',
  'Custom domain (not a builder subdomain)': 'custom-domain',
  'Favicon present': 'favicon-present',
  'Google Business Profile photos': 'google-business-profile-photos',
  'Google rating': 'google-rating',
  'Image alt text coverage sitewide': 'image-alt-text-coverage-sitewide',
  'Image alt text coverage': 'image-alt-text-coverage',
  'Image technical quality (upscaling, format)': 'image-technical-quality',
  'Largest Contentful Paint': 'largest-contentful-paint',
  'Lead form': 'lead-form',
  'Lighthouse performance score': 'lighthouse-performance-score',
  'LocalBusiness schema': 'localbusiness-schema',
  'Meta description': 'meta-description',
  'NAP consistency (phone)': 'nap-consistency-phone',
  'No horizontal scroll': 'no-horizontal-scroll',
  'No mixed content': 'no-mixed-content',
  'Open Graph tags across pages': 'open-graph-tags-across-pages',
  'Phone number above the fold': 'phone-number-above-the-fold',
  'Phone number consistency across pages': 'phone-number-consistency-across-pages',
  'Primary CTA above the fold': 'primary-cta-above-the-fold',
  'Real project photos': 'real-project-photos',
  'Response-time expectation set': 'response-time-expectation-set',
  'Review count vs. local median': 'review-count-vs-local-median',
  'Reviews displayed on the site itself': 'reviews-displayed-on-site',
  'Single H1': 'single-h1',
  'sitemap.xml + robots.txt': 'sitemap-robots-txt',
  'Tap target size': 'tap-target-size',
  'Title tag': 'title-tag',
  'Total page weight': 'total-page-weight',
  'Trust signals near the CTA': 'trust-signals-near-the-cta',
  'Unique meta descriptions across pages': 'unique-meta-descriptions-across-pages',
  'Unique title tags across pages': 'unique-title-tags-across-pages',
  'Valid SSL (HTTPS)': 'valid-ssl-https',
  'Viewport meta tag': 'viewport-meta-tag',
};
