export default {
  slug: 'open-graph-tags-across-pages',
  category: 'siteStructure',
  checkLabel: 'Open Graph tags across pages',
  title: 'Why a Blank Preview Card Kills a Shared Link Before It\'s Even Opened',
  metaTitle: 'Why Open Graph Tags Matter Sitewide | EpoxyGrind Learning Center',
  metaDescription: 'When someone texts your gallery page to a friend, a missing Open Graph tag is why it shows up as a bare gray box instead of your actual photo.',
  dek: 'A homeowner texting your page to their spouse — "look at this one" — is exactly the kind of free referral a blank preview card quietly kills.',
  introHtml: `<p>Your audit checks whether every crawled page — not just the homepage — has Open Graph tags (og:title, og:description, og:image). These are what Facebook, iMessage, LinkedIn, and most other apps read to build the preview card when someone shares your link. Miss them, and the share still goes out — it just looks broken when it lands.</p>`,
  stats: [
    { stat: '5.20% vs. 4.43%', context: 'median engagement rate for image-led posts vs. bare link posts on Facebook, across 52M+ posts analyzed', source: 'Buffer, State of Social Media Engagement 2026', url: 'https://buffer.com/resources/state-of-social-media-engagement-2026/' },
  ],
  sections: [
    {
      heading: 'What actually happens without these tags',
      bodyHtml: `<p>Without og:image and og:title set, a link shared to Facebook, LinkedIn, or a group text typically renders as plain blue text or a generic gray box — no photo, no headline, nothing to catch a scrolling thumb. The share still works technically; it just reads as untrustworthy or broken compared to every other link in the feed that renders a clean image and headline.</p>`,
    },
    {
      heading: 'Contractor sites lose this specifically on inner pages',
      bodyHtml: `<p>Homepages usually get this right, if only by accident, because whoever built the site set it up once. The gap shows up on service pages, gallery pages, and city pages built later — the exact pages most likely to get shared directly ("here's their basement gallery," "here's the garage floor page") since that's the specific thing someone wants to show a friend or spouse before booking.</p>`,
    },
    {
      heading: 'The fix is a template-level fix, not a page-by-page one',
      bodyHtml: `<p>Because this is a templating gap, not a content gap, it's usually fixed once at the page-template level — every page pulls its own title, a real description, and a real photo (ideally an actual job photo, not a logo) into its Open Graph tags automatically, rather than needing a person to set it manually on every page.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/real-project-photos/', title: 'Why real job photos matter', description: 'The photo that should be showing up in that preview card.' },
    { href: '/learn/unique-title-tags-across-pages/', title: 'Why every page needs its own title', description: 'The Open Graph title tag draws from the same source.' },
  ],
  faq: [
    { q: 'Do Open Graph tags affect Google ranking?', a: 'No — they\'re read by social platforms and messaging apps for link previews, not by Google\'s ranking algorithm. Their impact is entirely on how a shared link looks and performs once it\'s out in a feed or a text thread.' },
    { q: 'What\'s the minimum I need to set?', a: 'og:title, og:description, and og:image — with og:image being the one most often missing, and the one that has the biggest visible effect on whether a shared link gets a second look.' },
  ],
};
