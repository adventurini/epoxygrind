/**
 * Canonical contractor-services pricing ladder (epoxygrind-pricing-spec.md
 * §1). Single source of truth for /services/ and, later, the contractor
 * dashboard + demo reveal view — those should read from here (or the
 * mirrored `plans` Supabase table, seeded from this file by
 * scripts/seed-pricing-plans.js) rather than hardcoding numbers again.
 *
 * Structural rules from the spec, enforced wherever this data is used:
 * - Zip exclusivity is a Tier 3 modifier only; Tiers 1-2 cannot buy zips.
 * - Ad spend is never part of the tier price — always shown as separate.
 * - 6-month minimum commitment on Tier 3 / any exclusivity deal; Tiers 1-2
 *   are month-to-month (minCommitmentMonths: 1).
 */
export const PRICING_PLANS = [
  {
    id: 'launch',
    name: 'Launch',
    monthlyPriceCents: 99700,
    minCommitmentMonths: 1,
    positioning: 'Get found, get leads, get a site that closes.',
    cta: { label: 'Get Started', href: '#audit' },
    features: [
      'Custom website — the one already built during your free audit',
      'Hosting, maintenance, and SSL included',
      'Local SEO: metro + suburb pages, Google Business Profile optimization',
      'All leads from your EpoxyGrind directory listing routed to you',
      'Monthly performance report',
    ],
  },
  {
    id: 'dominate',
    name: 'Dominate',
    monthlyPriceCents: 199700,
    minCommitmentMonths: 1,
    positioning: 'Never miss a lead again — AI answers when you can’t.',
    inheritsFrom: 'launch',
    cta: { label: 'Get Started', href: '#audit' },
    features: [
      'AI chat widget on your website',
      'AI phone answering / missed-call response on your business line',
      'Instant SMS/email response to new leads',
      'Review generation prompts to past customers',
    ],
  },
  {
    id: 'own_your_market',
    name: 'Own Your Market',
    monthlyPriceCents: 299700,
    minCommitmentMonths: 6,
    positioning: 'Every EpoxyGrind lead in your zip goes to you. Nobody else.',
    inheritsFrom: 'dominate',
    cta: { label: 'Check Zip Availability', href: '#audit' },
    features: [
      'Google & Meta ads management (ad spend billed separately, $1k/mo minimum spend recommended)',
      'Review management — respond, dispute, showcase',
      'Home zip code exclusivity included',
    ],
    zipAddon: {
      priceCents: 100000,
      label: 'per additional exclusive zip',
      note: 'Sold as add-on inventory, Tier 3 only — one contractor per exclusive zip.',
    },
  },
];

export function getPlan(id) {
  return PRICING_PLANS.find((p) => p.id === id) || null;
}
