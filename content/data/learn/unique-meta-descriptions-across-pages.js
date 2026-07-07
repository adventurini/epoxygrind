export default {
  slug: 'unique-meta-descriptions-across-pages',
  category: 'siteStructure',
  checkLabel: 'Unique meta descriptions across pages',
  title: 'Why a Missing Meta Description Costs You Clicks on Every Page',
  metaTitle: 'Why Unique Meta Descriptions Matter Sitewide | EpoxyGrind Learning Center',
  metaDescription: 'A missing meta description means Google writes its own — usually a random sentence lifted from the page. Real data on what a real one is worth in clicks.',
  dek: 'A meta description doesn\'t change your ranking position — it changes whether the person who already sees your listing decides you\'re the answer worth clicking.',
  introHtml: `<p>Your audit checks whether every page it crawls has its own meta description, or whether several pages share one (or have none at all). Meta descriptions don't move rankings directly, but they're the sales pitch shown directly under your listing in Google — and on a multi-page contractor site, this gap tends to show up past the homepage first.</p>`,
  stats: [
    { stat: '~6%', context: 'more clicks for search results with a meta description present, compared to listings missing one', source: 'Backlinko', url: 'https://backlinko.com/what-is-ctr' },
  ],
  sections: [
    {
      heading: 'What happens when you leave it blank',
      bodyHtml: `<p>When a page has no meta description, Google doesn't leave the search result blank — it auto-generates one, usually by grabbing a sentence from somewhere on the page that may not even mention what the searcher was looking for. On a service-area or gallery page, that's often a fragment of navigation text or a stray sentence, not a pitch for why to click you over the next contractor in the results.</p>`,
    },
    {
      heading: 'Why this matters more once you have several pages',
      bodyHtml: `<p>A single homepage with a strong description is easy to get right once. The gap shows up on the pages built later — a new service-area page, an added service page — that quietly inherit a duplicate or blank description from the template. Since meta descriptions have no ranking effect on their own, it's easy to assume they don't matter; the actual effect shows up entirely in whether someone clicks your already-ranked result or the next one down.</p>`,
    },
    {
      heading: 'What a good one actually does',
      bodyHtml: `<p>A meta description that names the specific service and area, and gives someone a reason to click (a guarantee, a fast quote, "same-day estimates") is doing real, measurable work in the moment a homeowner is scanning five nearly-identical local results and deciding which one sounds like the right call.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/unique-title-tags-across-pages/', title: 'Why every page needs its own title too', description: 'The companion check that runs alongside this one.' },
    { href: '/learn/lead-form/', title: 'Why a visible lead form matters', description: 'What happens once the click actually lands on your site.' },
  ],
  faq: [
    { q: 'Do meta descriptions affect my Google ranking?', a: 'Not directly — Google has said as much. Their real effect is on click-through rate: whether someone picks your already-ranked result over a competitor\'s in the same list.' },
    { q: 'What if I leave it blank — does Google really write a bad one?', a: 'Usually, yes. Google auto-generates a snippet from page content when no meta description exists, and it\'s frequently an unhelpful, out-of-context sentence rather than anything resembling a pitch.' },
  ],
};
