export default {
  slug: 'broken-links',
  category: 'siteStructure',
  checkLabel: 'Broken links',
  title: 'Why Broken Links Are Costing You Jobs You Never Hear About',
  metaTitle: 'Why Broken Links Cost Contractors Jobs | EpoxyGrind Learning Center',
  metaDescription: 'A broken link on your service-area or gallery page is a dead end most homeowners never mention — they just leave. Real data on the cost of link rot.',
  dek: 'A homeowner who hits a dead page rarely emails to tell you — they just leave, quietly, mid-decision, and you never find out it happened.',
  introHtml: `<p>Your audit crawls every page it can reach on your site — not just the homepage — and checks every internal link along the way. A broken link buried on a service-area page or an old gallery post doesn't just look sloppy; it's a dead end a homeowner can hit while actively trying to learn more about you, right when their interest was building.</p>`,
  stats: [
    { stat: '66.5%', context: 'of links pointing to a sample of over 2 million websites have "rotted" (gone dead) since 2013', source: 'Ahrefs link rot study', url: 'https://ahrefs.com/blog/link-rot-study/' },
    { stat: '23% / 21%', context: 'of news webpages and government webpages, respectively, contain at least one broken link — link rot is a normal, ongoing decay process on almost any site that isn\'t actively checked', source: 'Pew Research Center, 2024', url: 'https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/' },
  ],
  sections: [
    {
      heading: 'Why this check crawls your whole site, not just the homepage',
      bodyHtml: `<p>Most contractor sites get their homepage checked constantly (it's the page you look at) and their inner pages — service areas, individual service pages, an older gallery post — checked almost never. Links rot quietly over time: a page gets renamed, a gallery plugin gets swapped out, a service-area page gets restructured, and whatever used to point to it now leads nowhere. Your audit checks every reachable page specifically because that's where broken links actually accumulate.</p>`,
    },
    {
      heading: 'A dead end mid-decision is worse than it looks',
      bodyHtml: `<p>Think about when a homeowner clicks a link on your site: they're not idly browsing, they're actively trying to confirm you serve their area, or trying to see more of a specific job. A broken link at that exact moment reads as "this business doesn't maintain its own website" — a bad signal to send someone who's about to hand over a few thousand dollars for a floor coating job with no way to preview the result beforehand.</p>`,
    },
    {
      heading: 'It costs you with Google too, just less directly',
      bodyHtml: `<p>Every broken internal link is also a dead end for Google's crawler — a page it can't follow through to, and a small signal that the site isn't well maintained. It's a smaller effect than the homeowner-facing one, but it stacks with everything else your audit measures under Site structure.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/contact-cta-presence-across-pages/', title: 'Why every page needs a way to reach you', description: 'The other big risk of a multi-page site: dead ends with no way out.' },
    { href: '/learn/phone-number-consistency-across-pages/', title: 'Why your phone number needs to match everywhere', description: 'Another sitewide consistency check, same underlying risk.' },
  ],
  faq: [
    { q: 'How do broken links happen if I never touched that page?', a: 'Almost always indirectly — a plugin update, a gallery re-organization, a page rename elsewhere on the site, or a linked page that got deleted. Link rot accumulates passively even on a site nobody is actively breaking.' },
    { q: 'Does one broken link really matter?', a: 'One is a minor ding. The real risk is that broken links are rarely a single, isolated event — if your audit found one, it\'s worth checking whether older or less-visited pages have several.' },
  ],
};
