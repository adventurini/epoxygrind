export default {
  slug: 'primary-cta-above-the-fold',
  category: 'funnel',
  checkLabel: 'Primary CTA above the fold',
  title: 'Why Your Call-to-Action Can\'t Wait Until After the Scroll',
  metaTitle: 'Why an Above-the-Fold CTA Matters | EpoxyGrind',
  metaDescription: 'Real conversion data on why a call-to-action visible in the first screen converts meaningfully better than one buried further down the page.',
  dek: 'A visitor decides whether your site is worth their time before they scroll — if there\'s nothing to act on yet, some of them never get the chance to.',
  introHtml: `<p>Your audit checks whether an obvious next action — an action-verb button like "Get a Free Quote," not just a phone number in small text — is visible on the very first screen, with no scrolling required. This is worth 20 of the 100 points in your funnel score, the single largest weight of any funnel check, because it's the first opportunity a visitor has to act on your site at all.</p>`,
  stats: [
    { stat: '73% vs. 44%', context: 'visibility rate for above-the-fold CTAs vs. below-the-fold equivalents', source: 'Amra & Elma 2026 CTA statistics', url: 'https://www.amraandelma.com/high-converting-cta-statistics/' },
    { stat: '17%', context: 'higher conversion rate for CTAs placed above the fold vs. below it', source: 'Amra & Elma 2026 CTA statistics', url: 'https://www.amraandelma.com/high-converting-cta-statistics/' },
    { stat: '89%', context: 'more clicks for above-the-fold CTAs compared to below-the-fold placement', source: 'WiserNotify 2026 CTA statistics', url: 'https://wisernotify.com/blog/call-to-action-stats/' },
  ],
  sections: [
    {
      heading: 'This isn\'t about whether people scroll — they do',
      bodyHtml: `<p>Modern research shows most visitors scroll well past the first screen regardless of design cues, so this check isn\'t about capturing people who refuse to scroll. It\'s about not making the ones who arrived ready to act — the homeowner who already decided to get a quote and just needs a button to click — hunt for it first.</p>`,
    },
    {
      heading: 'An action verb outperforms a vague link',
      bodyHtml: `<p>"Get a Free Quote" or "Call Now" tells a visitor exactly what happens next; a generic "Learn More" or a plain nav link to a Contact page doesn\'t. The check specifically looks for a clear, action-oriented CTA, not just any clickable element in the header.</p>`,
    },
    {
      heading: 'It\'s the first of two CTA checks, not the only one',
      bodyHtml: `<p>Above-the-fold visibility handles visitors ready to act immediately. Your audit also checks whether a <a href="/learn/cta-reachable-while-scrolling/">CTA stays reachable while scrolling</a> — that one covers everyone else, who reads your services and reviews before deciding. Both checks together cover the full visit, not just the first few seconds of it.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/cta-reachable-while-scrolling/', title: 'Why a persistent CTA matters', description: 'Covers the visitors who scroll before they act.' },
    { href: '/learn/phone-number-above-the-fold/', title: 'Why your phone number needs to be visible immediately', description: 'The other above-the-fold essential.' },
  ],
  faq: [
    { q: 'What counts as a CTA for this check?', a: 'A clear, action-oriented button or link — "Get a Free Quote," "Call Now" — not a generic nav link or a phone number in plain body text.' },
    { q: 'Does the whole homepage need to fit in one screen?', a: 'No — only the CTA needs to be visible without scrolling. The rest of the page (services, photos, reviews) is expected to continue below it.' },
    { q: 'Is one CTA enough for the whole page?', a: 'One above the fold covers immediate action; repeating it further down (see the sticky-CTA check) covers visitors who scroll first.' },
  ],
};
