export default {
  slug: 'single-h1',
  category: 'seo',
  checkLabel: 'Single H1',
  title: 'Why Your Page Should Have Exactly One Main Heading',
  metaTitle: 'Why a Single H1 Heading Matters for SEO | EpoxyGrind',
  metaDescription: 'Multiple H1s (or none at all) confuse both Google and screen readers about what your page is actually about. What the check catches and why it matters.',
  dek: 'The H1 is the one heading that\'s supposed to tell anyone — human or search engine — what a page is about in a single glance. A page with zero or five of them isn\'t telling that story clearly.',
  introHtml: `<p>Your audit checks whether your homepage has exactly one H1 tag — the largest, most prominent heading on the page, distinct from your page title (which lives in the browser tab and search results) and from subheadings (H2, H3, etc.) further down. This is a small technical detail with an outsized effect on how clearly a page communicates its topic.</p>`,
  stats: [
    { stat: '1', context: 'the number of H1s Google itself recommends per page for a clear, unambiguous topic signal', source: 'Google Search Central guidance, cited via industry SEO guides', url: 'https://ahrefs.com/blog/h1-tag/' },
    { stat: '50-60 chars', context: 'the recommended H1 length — the same range as a title tag, for the same readability reasons', source: 'Ahrefs H1 tag guide', url: 'https://ahrefs.com/blog/h1-tag/' },
  ],
  sections: [
    {
      heading: 'Why one H1 (not zero, not five)',
      bodyHtml: `<p>Google's own John Mueller has said multiple H1s won't get a page penalized — search engines can usually still figure out the topic. But "won't get penalized" isn't the bar for a small local business site competing on clarity. One clean H1 gives both Google and a first-time visitor an instant, unambiguous answer to "what is this page about," which is exactly what a homeowner skimming a search result — or your homepage after clicking through — needs in the first second.</p>`,
    },
    {
      heading: 'The most common way contractor sites break this',
      bodyHtml: `<p>Page builders and templates are the usual culprit: a hero banner component that auto-generates its own H1 ("Welcome"), stacked on top of a second H1 further down the page for the actual headline ("Epoxy Garage Floor Coatings"). Neither the builder nor the person who dragged the block in usually notices — it renders fine visually, it just confuses the underlying structure.</p>`,
    },
    {
      heading: 'What a screen reader user experiences with this broken',
      bodyHtml: `<p>Heading structure isn't just an SEO signal — it's how screen reader users navigate a page, jumping heading-to-heading to get an outline before deciding where to read in detail. Zero H1s or several competing ones makes that navigation genuinely confusing, not just technically imperfect.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/title-tag/', title: 'Why your title tag matters', description: 'A related but separate heading — this one lives in the search snippet, not the page.' },
    { href: '/learn/image-alt-text-coverage/', title: 'Why alt text matters sitewide', description: 'Another structural signal that matters for both SEO and accessibility.' },
  ],
  faq: [
    { q: 'Will multiple H1s get my site penalized by Google?', a: 'No direct penalty — Google has said it can still parse a page\'s topic with multiple H1s. But a single, clear H1 is still best practice for both SEO clarity and accessibility.' },
    { q: 'What\'s the difference between an H1 and a title tag?', a: 'The title tag is what shows in the browser tab and the search result\'s blue link. The H1 is the main visible heading on the page itself. They should usually say similar things, but they\'re different elements.' },
    { q: 'What commonly causes duplicate H1s on a contractor site?', a: 'Page builder templates, most often — a hero section component that auto-inserts its own H1 on top of the page\'s actual intended headline.' },
  ],
};
