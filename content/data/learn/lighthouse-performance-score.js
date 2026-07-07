export default {
  slug: 'lighthouse-performance-score',
  category: 'performance',
  checkLabel: 'Lighthouse performance score',
  title: 'Why Your Website Speed Score Is Costing You Jobs',
  metaTitle: 'Why Website Speed Costs You Jobs | EpoxyGrind Learning Center',
  metaDescription: 'A slow-loading website loses homeowners before your offer, reviews, or phone number ever load. Real data on how page speed affects local service leads.',
  dek: 'Homeowners decide whether to keep waiting for your site before it even finishes loading. A low performance score isn\'t a technical detail — it\'s leads leaving before they see anything you built.',
  introHtml: `<p>Your audit scores your site's Lighthouse performance — a real, standardized measurement Google itself uses, not an opinion. A low score means real visitors are bouncing before your phone number, your reviews, or your before/after photos ever get a chance to load. Here's the actual data on why that happens and what it costs.</p>`,
  stats: [
    { stat: '53%', context: 'of mobile visitors abandon a site that takes over 3 seconds to load', source: 'Google / DigitalApplied', url: 'https://www.digitalapplied.com/blog/page-speed-statistics-2026-revenue-impact' },
    { stat: '20%', context: 'drop in conversions per extra second of mobile load time', source: 'DigitalApplied 2026', url: 'https://www.digitalapplied.com/blog/page-speed-statistics-2026-revenue-impact' },
    { stat: '8.6s', context: 'average real-world mobile load time — most local sites are far outside the 2-3s window homeowners expect', source: 'Hostinger 2026', url: 'https://www.hostinger.com/tutorials/website-load-time-statistics' },
  ],
  video: { videoId: 'u3ArwX_WZYo', title: 'Google PageSpeed Insights Tutorial – Fix Your Website Speed & Rank Higher', channel: 'ComputerSluggish' },
  sections: [
    {
      heading: 'What the score actually measures',
      bodyHtml: `<p>Lighthouse (Google's own auditing tool) times how long it takes your site to show something useful and become interactive on a real mid-range phone over a throttled connection — deliberately simulating a homeowner standing in their driveway on decent-but-not-great signal, not a fast office wifi connection. The two biggest drivers for most local contractor sites: an oversized, uncompressed hero image, and a page that's simply too heavy overall.</p>`,
    },
    {
      heading: 'Why this hits leads harder than it hits rankings',
      bodyHtml: `<p>Page speed is a minor Google ranking factor, but it's a major <em>conversion</em> factor — and for a homeowner who already clicked through from a Google Maps listing or a search result, ranking doesn't matter anymore; they're already on your site deciding whether to keep waiting. A homeowner comparing three contractors in one sitting will not wait out a slow load on yours when the other two loaded instantly. You don't lose the job on quality — you lose it on patience, before your work is even visible.</p>`,
    },
    {
      heading: 'The fix is almost always the same two things',
      bodyHtml: `<p>In practice, the fix for a local contractor site is rarely a rewrite — it's usually the hero image (a phone photo straight from the camera roll, often 3-5MB, displayed at a fraction of that size) and a handful of scripts loading before anything the visitor can see. Compressing and properly sizing images alone typically closes most of the gap.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/lead-form/', title: 'Why a visible lead form matters', description: 'Speed gets them to the page — this keeps them from leaving once they arrive.' },
    { href: '/learn/google-rating/', title: 'Why your Google rating affects calls', description: 'The other half of the "will they call" decision.' },
  ],
  faq: [
    { q: 'What is a good Lighthouse performance score?', a: 'Google and most conversion research treat 90+ as the target. Scores in the 50s-70s (typical for an un-optimized local contractor site) are associated with meaningfully higher bounce rates on mobile.' },
    { q: 'Does a slow website actually hurt Google rankings?', a: 'It\'s a real but minor ranking factor. The bigger, more direct cost is conversion — visitors who already found you leaving before they see your offer.' },
    { q: 'What usually causes a low score on a small business site?', a: 'Almost always a single oversized, uncompressed image (often a phone photo used as-is) plus scripts loading before the page is visible — rarely anything more complex than that.' },
  ],
};
