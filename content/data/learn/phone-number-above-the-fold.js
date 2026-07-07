export default {
  slug: 'phone-number-above-the-fold',
  category: 'funnel',
  checkLabel: 'Phone number above the fold',
  title: 'Why Your Phone Number Can\'t Be Buried in the Footer',
  metaTitle: 'Why an Above-the-Fold Phone Number Matters | EpoxyGrind',
  metaDescription: 'Real data on how many homeowners want to call a local contractor directly — and why your number needs to be visible the instant the page loads.',
  dek: 'For a job most homeowners want to talk through before booking, a phone number that requires hunting is a phone number that doesn\'t get called.',
  introHtml: `<p>Your audit checks specifically whether your phone number is visible in the first screen of your homepage — typically in the header — not just whether it exists somewhere on the site. A number buried in a footer, an About page, or a Contact form that requires several clicks to reach effectively doesn't exist for a visitor who wants to call right now.</p>`,
  stats: [
    { stat: '94%', context: 'of smartphone users have needed to call a business directly while searching for information', source: 'BizIQ 2026 local search statistics', url: 'https://biziq.com/blog/local-search-statistics/' },
    { stat: '60%', context: 'of mobile users contact a business directly from local search results — via call or directions', source: 'The Trust Agency mobile local search statistics', url: 'https://thetrustagency.net/statistic/mobile-local-search' },
    { stat: '46%', context: 'lead-to-conversion rate for home-services phone calls, vs. roughly 1.7% for the average web form', source: 'Invoca 2025 analysis of 60M+ phone calls, via Supply House Times', url: 'https://www.supplyht.com/articles/106612-home-services-call-performance-report-46-lead-conversion-rate-segment-benchmarks' },
  ],
  sections: [
    {
      heading: 'A homeowner comparing contractors is often calling several in one sitting',
      bodyHtml: `<p>Unlike an online purchase, hiring a contractor usually involves a real conversation before committing — questions about timeline, price range, and whether the crew is available. A homeowner in research mode wants to start those conversations quickly, often with two or three contractors back to back, and a number visible immediately is what lets your business be one of them.</p>`,
    },
    {
      heading: 'Header placement, not just "somewhere on the page"',
      bodyHtml: `<p>This check specifically looks at the header, because it's the one part of the page present on every screen a visitor might land on — not just the homepage. A number that's only in the homepage footer doesn't help a visitor who arrived on a services page from a Google search instead.</p>`,
    },
    {
      heading: 'Visibility and tappability are two different checks',
      bodyHtml: `<p>This check is about whether the number is visible at all; a separate check covers whether that visible number is a working <a href="/learn/click-to-call-link/">click-to-call link</a>. A number can be prominently displayed and still fail to convert on mobile if it isn't wrapped in a real tel: link — both matter, and they're graded separately for exactly that reason.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/click-to-call-link/', title: 'Why your phone number needs to be a real tappable link', description: 'Visibility gets them to see it; this gets them to act on it.' },
    { href: '/learn/primary-cta-above-the-fold/', title: 'Why your call-to-action needs to be immediately visible', description: 'The other above-the-fold essential.' },
  ],
  faq: [
    { q: 'Where exactly should the phone number go?', a: 'In the site header, visible without scrolling, present on every page — not just the homepage or a dedicated Contact page.' },
    { q: 'Do I need a form if I already have a visible phone number?', a: 'Yes — some homeowners prefer calling, others prefer a form, especially outside business hours. See the lead-form article for why both matter.' },
    { q: 'Is a visible number enough on its own?', a: 'Not quite — it also needs to be a working tel: link so mobile visitors can tap to call instead of manually dialing. See the click-to-call-link article.' },
  ],
};
