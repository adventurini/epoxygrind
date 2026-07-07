export default {
  slug: 'no-horizontal-scroll',
  category: 'mobile',
  checkLabel: 'No horizontal scroll',
  title: 'Why a Page That Scrolls Sideways Is Costing You Trust, Not Just Looks',
  metaTitle: 'Why Horizontal Scroll on Mobile Hurts Credibility | EpoxyGrind',
  metaDescription: 'A page that overflows past the screen edge on mobile reads as broken. Real data on how fast visitors judge — and abandon — an unpolished site.',
  dek: 'A page that scrolls sideways on a phone doesn\'t read as a minor bug to a homeowner — it reads as "this business doesn\'t maintain its website."',
  introHtml: `<p>Your audit checks whether any element on the page — usually a fixed-width image, table, or embedded widget — pushes the page wider than the phone screen, forcing an unintended sideways scroll. Unlike a slow-loading page or a missing form, this is something a visitor notices within the first second of looking at the page, before they've engaged with any content at all.</p>`,
  stats: [
    { stat: '94%', context: 'of a visitor\'s first impression of a website is design-related, not content-related', source: 'Sweor first-impressions research', url: 'https://www.sweor.com/firstimpressions' },
    { stat: '0.05 seconds', context: 'how long it takes a visitor to form an opinion about a website', source: 'Sweor first-impressions research', url: 'https://www.sweor.com/firstimpressions' },
    { stat: '38%', context: 'of visitors will disengage from a site if the layout or content looks unattractive or broken', source: 'Sweor first-impressions research', url: 'https://www.sweor.com/firstimpressions' },
  ],
  sections: [
    {
      heading: 'It\'s usually one oversized element, not the whole layout',
      bodyHtml: `<p>Horizontal overflow is almost always caused by a single culprit — a fixed-width table, an embedded map or widget, or an image with a hardcoded pixel width that doesn\'t shrink on smaller screens. Finding and constraining that one element (usually a simple max-width: 100% fix) resolves the whole page, which is why this is typically a fast fix once identified.</p>`,
    },
    {
      heading: 'The cost is credibility, not just usability',
      bodyHtml: `<p>A visitor doesn\'t reason through "this business has a CSS bug." They register, in under a second, that the site feels unfinished or unmaintained — and per the research above, that snap judgment about design bleeds directly into how much they trust the business behind it. For a job that costs several thousand dollars, that first impression matters more than most contractors assume.</p>`,
    },
    {
      heading: 'It compounds with everything else your audit checks',
      bodyHtml: `<p>A visitor who forms a negative first impression from a broken layout is less likely to scroll further to find your <a href="/learn/lead-form/">lead form</a> or read your reviews at all — the bug doesn\'t just look bad, it actively reduces how much of the rest of your page actually gets seen.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/viewport-meta-tag/', title: 'Why the viewport meta tag matters', description: 'A missing viewport tag is a common root cause of layout overflow.' },
    { href: '/learn/lighthouse-performance-score/', title: 'Why site speed matters', description: 'Another first-impression factor working on the same timescale.' },
  ],
  faq: [
    { q: 'What usually causes horizontal scrolling on mobile?', a: 'A single element with a hardcoded pixel width wider than the screen — often a table, embedded widget, or an image without a max-width constraint.' },
    { q: 'Is this hard to fix?', a: 'Usually not — once the oversized element is identified, constraining it with max-width: 100% or a responsive container typically resolves the entire page.' },
    { q: 'Does this really affect whether someone hires me?', a: 'Indirectly, yes — research shows design quality strongly shapes perceived business credibility, and a visibly broken layout is one of the fastest ways to trigger that judgment.' },
  ],
};
