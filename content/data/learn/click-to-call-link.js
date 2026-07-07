export default {
  slug: 'click-to-call-link',
  category: 'mobile',
  checkLabel: 'Click-to-call link',
  title: 'Why Your Phone Number Needs to Be a Real Tappable Link',
  metaTitle: 'Why Click-to-Call Links Matter on Mobile | EpoxyGrind',
  metaDescription: 'A phone number that isn\'t wrapped in a tel: link forces mobile visitors to copy and manually dial it. Real data on what that friction costs.',
  dek: 'If your phone number is plain text instead of a tel: link, a mobile visitor has to manually copy it, switch apps, and dial — and most won\'t.',
  introHtml: `<p>Your audit checks specifically for a <code>tel:</code> link — <code>&lt;a href="tel:+15551234567"&gt;</code> — wrapping your phone number, not just whether a phone number is visible somewhere on the page. Plain text that looks like a phone number but isn't wrapped in a real link forces a mobile visitor to select the text, copy it, open their phone app, and paste it — several steps that a single tap should have replaced.</p>`,
  stats: [
    { stat: '70%', context: 'of calls to local businesses now originate from click-to-call on mobile search, maps, or a business website', source: 'Numa 2026 business phone statistics', url: 'https://www.numa.com/blog/22-business-phone-statistics' },
    { stat: '94%', context: 'of smartphone users have needed to call a business directly while searching for information', source: 'BizIQ 2026 local search statistics', url: 'https://biziq.com/blog/local-search-statistics/' },
    { stat: '46%', context: 'lead-to-conversion rate for home-services phone calls, vs. roughly 1.7% for the average web form', source: 'Invoca 2025 analysis of 60M+ phone calls, via Supply House Times', url: 'https://www.supplyht.com/articles/106612-home-services-call-performance-report-46-lead-conversion-rate-segment-benchmarks' },
  ],
  sections: [
    {
      heading: 'This is the highest-converting action on a contractor site — if it works',
      bodyHtml: `<p>For a trade like epoxy flooring, where the decision is often made in a single sitting while comparing a few contractors, a phone call converts far better than a form (see the numbers above). But that only holds if the number is actually one tap away. A homeowner who has to manually dial is a homeowner who is now one extra, avoidable step from just calling the next name on the list instead.</p>`,
    },
    {
      heading: 'It\'s a two-line fix, not a redesign',
      bodyHtml: `<p>Turning a plain-text phone number into a working click-to-call link is one HTML attribute — no design change, no new content, nothing for a homeowner to notice except that it now works. This is one of the highest-leverage, lowest-effort fixes on the entire audit.</p>`,
    },
    {
      heading: 'Distinct from having a phone number at all',
      bodyHtml: `<p>This check isn't asking whether your number is visible — see <a href="/learn/phone-number-above-the-fold/">phone number above the fold</a> for that — it's asking whether the number that IS visible actually works as a one-tap action on the device most of your visitors are using. A site can pass one of these checks and fail the other, and both are worth fixing.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/phone-number-above-the-fold/', title: 'Why your phone number needs to be visible immediately', description: 'Visibility and tappability are two separate checks.' },
    { href: '/learn/tap-target-size/', title: 'Why tap target size matters', description: 'A tel: link still needs to be big enough to hit.' },
  ],
  faq: [
    { q: 'What is a click-to-call link, technically?', a: 'An <a href="tel:..."> HTML link wrapping your phone number, which opens the phone app pre-dialed when tapped on a mobile device.' },
    { q: 'Does this matter on desktop too?', a: 'Less so — desktop browsers don\'t always have a way to place calls — but it costs nothing to add and does no harm there, while being essential on mobile.' },
    { q: 'My number is already visible — isn\'t that enough?', a: 'No — visible plain text still requires a mobile visitor to manually copy and dial it. The tel: link removes that friction entirely.' },
  ],
};
