export default {
  slug: 'meta-description',
  category: 'seo',
  checkLabel: 'Meta description',
  title: 'Why the Two Lines Under Your Title Tag Are Worth Fixing',
  metaTitle: 'Why Your Meta Description Matters for Contractor Leads | EpoxyGrind',
  metaDescription: 'A missing meta description means Google writes one for you — usually badly. Real data on how much a good one moves click-through rate.',
  dek: 'Homeowners read the snippet under your title before they read anything else about you. If you didn\'t write it, Google did, and it wasn\'t written to get you the call.',
  introHtml: `<p>Your audit checks whether your homepage has a meta description in the 50-160 character range that Google typically displays intact. This is the short paragraph under your blue link in search results — not a ranking factor by itself, but a direct lever on whether someone scanning results picks you.</p>`,
  stats: [
    { stat: '74%', context: 'of web users say they judge whether to click a search result based partly on the meta description', source: 'CXL / search behavior research', url: 'https://cxl.com/guides/click-through-rate/seo/' },
    { stat: '13.9%', context: 'CTR increase from meta descriptions written with emotional, benefit-driven language vs. flat description', source: 'Backlinko', url: 'https://www.digitalapplied.com/blog/meta-description' },
    { stat: '~6%', context: 'more clicks on pages with a unique, written meta description vs. pages with none', source: 'Industry CTR research summary', url: 'https://heydaymarketing.com/role-of-meta-descriptions-in-click-through-rates/' },
  ],
  video: { videoId: 'XgZRGQUYD9M', title: 'Meta Description Strategy for Websites (Full Tutorial)', channel: 'PromoAmbitions' },
  sections: [
    {
      heading: 'What a good one actually does',
      bodyHtml: `<p>A meta description isn't a summary — it's a pitch. "We install epoxy and polyaspartic garage floor coatings across [city] and the surrounding area. Free quotes, most jobs finished in 1-2 days." That tells a homeowner what you do, where, and removes a friction point (cost, timeline) before they've even clicked.</p>`,
    },
    {
      heading: 'What happens if you leave it blank',
      bodyHtml: `<p>Google doesn't leave the space empty — it auto-generates a snippet by pulling text from wherever on the page it thinks best matches the search query. That's often an awkward mid-sentence fragment, a cookie notice, or your footer text. It's rarely the pitch you'd have written for yourself, and it changes depending on what someone searched.</p>`,
    },
    {
      heading: 'It won\'t move your ranking, but it moves who clicks the link',
      bodyHtml: `<p>Google has said directly that meta descriptions aren't a ranking factor. That's true and also beside the point — two contractors can rank in the same two spots on the same search, and the one with a specific, benefit-forward description will out-click the one with none or a generic auto-generated one, every time a homeowner is scanning multiple options at once.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/title-tag/', title: 'Why your title tag matters', description: 'The line right above this one, doing a related but distinct job.' },
    { href: '/learn/lead-form/', title: 'Why a visible lead form matters', description: 'Gets the click here first — this is what happens once they land.' },
  ],
  faq: [
    { q: 'How long should a meta description be?', a: 'Roughly 50-160 characters. Shorter wastes the space; longer gets cut off with an ellipsis mid-sentence.' },
    { q: 'Does a meta description affect my Google ranking?', a: 'Not directly — Google has confirmed it\'s not a ranking factor. It affects click-through rate, which is a different (and for a small business, arguably more important) number.' },
    { q: 'What happens if I don\'t write one?', a: 'Google auto-generates a snippet from page text, which changes per search query and is rarely as clear or persuasive as one you\'d write yourself.' },
  ],
};
