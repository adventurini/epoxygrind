export default {
  slug: 'total-page-weight',
  category: 'performance',
  checkLabel: 'Total page weight',
  title: 'Total Page Weight: Why Your Site Feels Heavier Than It Looks',
  metaTitle: 'Why Total Page Weight Slows Down Your Website | EpoxyGrind',
  metaDescription: 'The total data your homepage has to download before it works — most of it images — directly determines how it feels on a homeowner\'s phone.',
  dek: 'A page can look simple and still be enormous behind the scenes — usually because of a handful of images nobody ever compressed.',
  introHtml: `<p>Your audit measures your page's total weight — the full amount of data (images, scripts, fonts, everything) a visitor's browser has to download before your site is usable. A page can look plain and text-light on screen while still being several megabytes behind the scenes, almost always because of unoptimized images.</p>`,
  stats: [
    { stat: '2.1MB', context: 'median mobile page weight across the web in 2026 — and images alone account for 50%+ of that total on a typical page', source: 'DigitalApplied Page Speed Statistics 2026', url: 'https://www.digitalapplied.com/blog/page-speed-statistics-2026-revenue-impact' },
  ],
  sections: [
    {
      heading: 'It\'s almost never the text or the layout',
      bodyHtml: `<p>Images routinely make up half or more of a page's total weight — and on a local contractor site, that's usually a handful of full-resolution project photos or a hero image straight from a phone camera roll, each several megabytes, displayed at a fraction of that size. The browser still has to download the whole file before shrinking it down to fit the layout.</p>`,
    },
    {
      heading: 'Why this hits mobile visitors hardest',
      bodyHtml: `<p>A homeowner comparing contractors from their phone, sometimes on a spotty connection standing in their driveway or garage, feels every extra megabyte directly as wait time. Desktop wifi can paper over a heavy page; mobile data rarely can.</p>`,
    },
    {
      heading: 'The fix',
      bodyHtml: `<p>Compress and resize images to the dimensions they're actually displayed at (a photo shown at 800px wide doesn't need to be a 4000px original), convert to a modern format like WebP where possible, and lazy-load images below the fold so they don't compete with what's visible first. This one change typically resolves most of a heavy page.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/largest-contentful-paint/', title: 'Why Largest Contentful Paint matters', description: 'The same oversized-image problem, felt as a specific delay rather than total weight.' },
    { href: '/learn/lighthouse-performance-score/', title: 'Why your overall speed score matters', description: 'Page weight is one of the biggest inputs into this broader score.' },
  ],
};
