export default {
  slug: 'largest-contentful-paint',
  category: 'performance',
  checkLabel: 'Largest Contentful Paint',
  title: 'Largest Contentful Paint: The Clock Homeowners Are Actually Watching',
  metaTitle: 'What Largest Contentful Paint Is and Why It Matters | EpoxyGrind',
  metaDescription: 'LCP measures how long it takes your biggest, most important element — usually your hero image — to actually appear. Real Core Web Vitals data on why it matters.',
  dek: 'Your overall speed score is an average. LCP is the specific moment a visitor is staring at a blank screen wondering if anything is going to load at all.',
  introHtml: `<p>Your audit measures Largest Contentful Paint (LCP) — one of Google's three official Core Web Vitals, and the specific number of seconds it takes for the single biggest visible element on your page (almost always the hero image) to actually render. A high overall performance score can still hide a slow LCP if other parts of the page load fast while the one thing a visitor is looking at takes forever.</p>`,
  stats: [
    { stat: '2.5s', context: 'the threshold Google defines as "good" for LCP — anything slower starts counting against the page experience', source: 'web.dev (Google)', url: 'https://web.dev/articles/lcp' },
    { stat: '31.4%', context: 'of websites fail to meet the "good" LCP threshold, per the most recent Chrome User Experience Report — the single hardest Core Web Vital to pass', source: 'Core Web Vitals Benchmarks 2026, DigitalApplied', url: 'https://www.digitalapplied.com/blog/core-web-vitals-benchmarks-2026-pass-rate-reference' },
  ],
  video: { videoId: '480m72yjZv8', title: 'How to improve Largest Contentful Paint for a better page experience', channel: 'Google Search Central' },
  sections: [
    {
      heading: 'This is the moment a homeowner decides you\'re "loading" vs. "broken"',
      bodyHtml: `<p>Before LCP fires, a visitor is looking at a blank or half-rendered page with no way to know whether it's about to finish loading or has actually stalled out. That uncertainty is what drives people to hit back and try the next contractor in their search results — not patience running out on a page that's visibly working, but doubt about a page that looks like nothing is happening.</p>`,
    },
    {
      heading: 'Why your audit caps the whole performance category over this',
      bodyHtml: `<p>An LCP over 4 seconds caps your entire performance score at 60, regardless of how fast everything else on the page is — because a single very slow hero image genuinely is the visitor's whole experience of your site's speed. Nobody waits around to notice that your CSS was efficient.</p>`,
    },
    {
      heading: 'The fix is almost always the hero image',
      bodyHtml: `<p>For a local contractor site, LCP is nearly always driven by one oversized image — a phone photo dropped in at full resolution — competing with fonts, scripts, and other assets for bandwidth before it can render. Compressing that one image and loading it first (rather than after several scripts) typically fixes most of the gap on its own.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/lighthouse-performance-score/', title: 'Why your overall speed score matters', description: 'LCP is the single biggest driver of this broader score.' },
    { href: '/learn/total-page-weight/', title: 'Why total page weight matters', description: 'The same oversized-image problem, measured a different way.' },
  ],
  faq: [
    { q: 'What\'s the difference between LCP and my overall performance score?', a: 'Performance score is a blend of several timing measurements. LCP is one specific, heavily-weighted measurement inside it — the moment your biggest visible element actually appears.' },
    { q: 'What usually causes a slow LCP on a small business site?', a: 'An oversized, uncompressed hero image almost every time — often a phone photo used at full size instead of resized and compressed for the web.' },
  ],
};
