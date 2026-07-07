export default {
  slug: 'image-alt-text-coverage',
  category: 'seo',
  checkLabel: 'Image alt text coverage',
  title: 'Why Missing Alt Text Quietly Costs You Both Search Traffic and Real Customers',
  metaTitle: 'Why Image Alt Text Matters for Contractor Websites | EpoxyGrind',
  metaDescription: 'Most small business sites are missing alt text on over half their images — invisible to Google Images, and to anyone using a screen reader. What it costs.',
  dek: 'Alt text does two jobs at once: it tells Google what a photo shows, and it tells a screen reader user the same thing. Miss it, and you\'ve made your before/after photos invisible to both.',
  introHtml: `<p>Your audit measures what percentage of the images on your site have real, descriptive alt text — the short written description attached to an image in the page's code, never visible unless an image fails to load or a screen reader reads it aloud. It's an easy thing to skip, and most local business sites do.</p>`,
  stats: [
    { stat: '53.1%', context: 'of all websites have at least one image missing alt text entirely', source: 'WebAIM Million 2026 accessibility report', url: 'https://www.accessibilitychecker.org/guides/alt-text/' },
    { stat: '16.2%', context: 'of images on an average homepage are missing alt text — out of an average 66.6 images per homepage', source: 'WebAIM Million 2026', url: 'https://www.accessibilitychecker.org/guides/alt-text/' },
    { stat: 'up to 15%', context: 'gain in image-search traffic reported after fixing missing/poor alt text in case studies', source: 'AltText.ai', url: 'https://alttext.ai/blog/image-alt-text-seo-best-practices' },
  ],
  video: { videoId: '-jn9aaNn8_I', title: 'How To Write Great Image Alt Text And Get More SEO Traffic', channel: 'HubSpot Marketing' },
  sections: [
    {
      heading: 'What good alt text looks like for a contractor site',
      bodyHtml: `<p>Not "image1.jpg" or blank, and not keyword-stuffed either ("epoxy garage floor coating contractor near me epoxy floors"). Just an accurate, specific description: "Metallic gray epoxy garage floor coating, before and after, Fort Collins CO." That single line does real work for both a screen reader user and Google Images.</p>`,
    },
    {
      heading: 'It\'s an accessibility requirement, not just an SEO nicety',
      bodyHtml: `<p>Alt text is a real legal accessibility requirement under the ADA and Section 508 in the U.S., and similar standards elsewhere — not just a ranking tactic. A visually impaired homeowner using a screen reader to browse contractor sites hears "image" or nothing at all where your before/after photos should be, on a page whose entire job is showing off the quality of your work.</p>`,
    },
    {
      heading: 'Decorative images don\'t need it — your project photos absolutely do',
      bodyHtml: `<p>Not every image needs a full description — a purely decorative background pattern or icon can have empty alt text on purpose. But real content images, especially before/after project photos (the highest-converting image type for this trade), are exactly the images most likely to get skipped, which is the opposite of where the priority should be.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/single-h1/', title: 'Why a single H1 matters', description: 'Another structural signal that serves both SEO and accessibility at once.' },
    { href: '/learn/lighthouse-performance-score/', title: 'Why site speed matters', description: 'The other big technical lever most contractor sites are missing.' },
  ],
  faq: [
    { q: 'Do all images need alt text?', a: 'Real content images — project photos, before/afters, team photos — yes. Purely decorative images (background patterns, dividers) can have empty alt text on purpose.' },
    { q: 'Does alt text actually help SEO?', a: 'It helps Google Images understand and rank your photos, and it\'s one of many small on-page signals. Its bigger, more direct effect is accessibility.' },
    { q: 'Is missing alt text a legal issue?', a: 'It can be — alt text is a documented requirement under accessibility standards like the ADA and Section 508 in the U.S. and the European Accessibility Act elsewhere.' },
  ],
};
