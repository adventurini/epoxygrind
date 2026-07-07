export default {
  slug: 'sitemap-robots-txt',
  category: 'seo',
  checkLabel: 'sitemap.xml + robots.txt',
  title: 'Why Two Files You\'ll Never See Decide How Much of Your Site Google Actually Finds',
  metaTitle: 'Why Sitemap.xml and Robots.txt Matter for Contractors | EpoxyGrind',
  metaDescription: 'A missing sitemap or robots.txt makes Google guess which of your pages matter. What these two files do and why contractor sites often skip them.',
  dek: 'A sitemap is a direct list of every page you want Google to know about. Without one, Google is left to discover your pages the slow way — by stumbling onto links, if it finds them at all.',
  introHtml: `<p>Your audit checks for two small files: a sitemap.xml (a structured list of your site's real, indexable pages) and a robots.txt (a file that tells search engine crawlers what they're allowed to access, and typically points to the sitemap). Neither is visible to a homeowner browsing your site — both matter to how completely Google can find and index it.</p>`,
  stats: [
    { stat: '13%', context: 'of sites return an error instead of a valid robots.txt file, based on large-scale crawl analysis', source: 'Robots.txt crawl study, 2026', url: 'https://www.stanventures.com/news/google-studied-16-million-robots-txt-files-heres-what-they-found-7177/' },
    { stat: '23%', context: 'of sites have pages that don\'t link to their own XML sitemap from robots.txt, missing an easy signal boost', source: 'Robots.txt crawl study, 2026', url: 'https://www.stanventures.com/news/google-studied-16-million-robots-txt-files-heres-what-they-found-7177/' },
  ],
  video: { videoId: 'C5sVXUOy-Ns', title: 'A Beginners Guide To Sitemaps and Robots txt', channel: 'The Stuff You Need To Know About SEO' },
  sections: [
    {
      heading: 'What each file actually does',
      bodyHtml: `<p>A sitemap.xml lists every real page on your site you want indexed — your homepage, service pages, city pages, blog posts — so Google doesn't have to rely purely on finding internal links to each one. A robots.txt is mostly a set of crawl instructions ("don't bother crawling this folder"), and it usually also points directly to your sitemap's location, connecting the two.</p>`,
    },
    {
      heading: 'Small sites rarely have a "crawl budget" problem — the real risk is a discovery gap',
      bodyHtml: `<p>For a handful of pages, Google's crawl budget (how much of a site it bothers crawling) is almost never the limiting factor for a small contractor site. The real risk without a sitemap is a plain discovery gap: a new city page or service page you just added sits undiscovered longer than it needs to, simply because nothing told Google it existed yet.</p>`,
    },
    {
      heading: 'It\'s a five-minute technical fix, not a content project',
      bodyHtml: `<p>Unlike most SEO work, this isn't writing or design — it's a small, mostly-automated technical file most website platforms can generate on their own once configured. If it's missing, it usually means it was simply never set up, not that it's actively difficult to add.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/city-service-landing-pages/', title: 'Why dedicated city pages matter', description: 'These are exactly the pages a sitemap makes sure Google actually finds.' },
    { href: '/learn/localbusiness-schema/', title: 'Why structured data matters', description: 'Another invisible-but-important technical signal, in the same spirit.' },
  ],
  faq: [
    { q: 'Do I need a sitemap if my site only has a few pages?', a: 'It still helps — it\'s a direct, explicit list rather than relying on Google to find every page through links, and it costs nothing to maintain once set up.' },
    { q: 'What does robots.txt actually control?', a: 'Which parts of your site search engine crawlers are allowed to access, and (usually) where to find your sitemap. It doesn\'t control rankings directly.' },
    { q: 'Is this something I can set up myself?', a: 'On most modern website platforms, yes — many generate both files automatically once basic SEO settings are configured. If both are missing, it typically means that setup step was skipped.' },
  ],
};
