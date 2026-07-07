export default {
  slug: 'cta-reachable-while-scrolling',
  category: 'mobile',
  checkLabel: 'CTA reachable while scrolling',
  title: 'Why Your Call-to-Action Needs to Follow the Visitor Down the Page',
  metaTitle: 'Why a Sticky CTA Matters on Mobile | EpoxyGrind',
  metaDescription: 'A call-to-action only visible on the first screen gets lost the moment a visitor scrolls. Real conversion data on sticky, persistent CTAs.',
  dek: 'A homeowner who scrolls to read your services or reviews and finds no way to act on what they just read has no reason to scroll back up.',
  introHtml: `<p>Your audit checks whether a call-to-action — a quote button, a phone number, a form link — stays reachable partway down the page, not just in the first screen. A page that puts its only CTA at the very top and nothing after loses everyone who scrolls to read more before they're ready to act, which for a $3,000+ decision is most homeowners.</p>`,
  stats: [
    { stat: '31%', context: 'more conversions from sticky bottom-bar CTAs vs. non-sticky equivalents, across 58M mobile sessions', source: 'Contentsquare 2026 mobile UX study', url: 'https://www.stickyctas.com/articles/sticky-ctas-data' },
    { stat: '25%', context: 'increase in sales from adding a sticky call-to-action, in a documented A/B test', source: 'Conversion Rate Experts win report', url: 'https://conversion-rate-experts.com/sticky-cta-win-report/' },
    { stat: '29% vs. 15%', context: 'winner rate for sticky-element tests on mobile vs. desktop — mobile benefits more', source: 'GrowthRock sticky button A/B test analysis', url: 'https://growthrock.co/sticky-add-to-cart-button-example/' },
  ],
  sections: [
    {
      heading: 'Reading and deciding don\'t happen on the same screen',
      bodyHtml: `<p>A homeowner comparing epoxy contractors typically scrolls through services, photos, and reviews before they're ready to act — that's the whole point of the content further down your page. If the only way to act on that decision is scrolling all the way back to the top, you've built a real, avoidable drop-off point right at the moment they were most convinced.</p>`,
    },
    {
      heading: 'A sticky bar is the simplest version of this fix',
      bodyHtml: `<p>The most common solution is a slim sticky header or footer bar with a phone number and a single button, present on every screen as the visitor scrolls. It doesn't need to be large or intrusive — the research above shows even a simple version measurably outperforms no persistent CTA at all, and the mobile-specific lift is larger than the desktop one.</p>`,
    },
    {
      heading: 'This pairs directly with your above-the-fold CTA',
      bodyHtml: `<p>Having a strong <a href="/learn/primary-cta-above-the-fold/">above-the-fold CTA</a> is necessary but not sufficient — it only serves the visitors who act immediately. A persistent CTA catches everyone else: the ones who scroll to check your photos and reviews first, which per the <a href="/learn/google-rating/">local presence</a> research is most of them.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/primary-cta-above-the-fold/', title: 'Why your first-screen CTA matters', description: 'The other half of covering the full scroll.' },
    { href: '/learn/no-horizontal-scroll/', title: 'Why a broken mobile layout costs trust', description: 'Another check on how the page behaves as visitors scroll and interact.' },
  ],
  faq: [
    { q: 'What\'s the simplest way to make a CTA reachable while scrolling?', a: 'A slim sticky header or footer bar with your phone number and a single quote-request button, present on every screen regardless of scroll position.' },
    { q: 'Does a persistent CTA hurt the page\'s design?', a: 'Not if kept simple — a thin bar with one clear action typically doesn\'t compete visually with the rest of the page, and the conversion data suggests the tradeoff is worth it.' },
    { q: 'Is this only relevant for very long pages?', a: 'It matters most on longer pages, but any page a visitor might scroll past the first screen on benefits from not losing the CTA entirely.' },
  ],
};
