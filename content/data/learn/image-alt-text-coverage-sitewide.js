export default {
  slug: 'image-alt-text-coverage-sitewide',
  category: 'siteStructure',
  checkLabel: 'Image alt text coverage sitewide',
  title: 'Why Missing Alt Text Sitewide Is an Easy, Overlooked Fix',
  metaTitle: 'Why Sitewide Image Alt Text Matters | EpoxyGrind Learning Center',
  metaDescription: 'Alt text on your homepage photos rarely covers the rest of the site. Real data on how common this gap is and why it affects both Google Images and accessibility.',
  dek: 'Alt text is one of the few SEO details with zero downside and a real (if quiet) upside — the gap is almost always neglect, not disagreement.',
  introHtml: `<p>Your audit checks alt text coverage across every page it crawls, not just the homepage — because that's exactly where the gap tends to open up. A homepage built with real care often has decent alt text; the service pages, galleries, and city pages added afterward frequently don't.</p>`,
  stats: [
    { stat: '16.2%', context: 'of images on the home pages of the top 1 million websites were missing alt text entirely in 2026 — and that\'s just the homepage, where sites typically try hardest', source: 'WebAIM Million, 2026', url: 'https://webaim.org/projects/million/' },
  ],
  sections: [
    {
      heading: 'What alt text actually does',
      bodyHtml: `<p>Alt text is a short written description attached to an image — read aloud by screen readers for visually impaired visitors, and used by Google Images to understand and index a photo it otherwise can\'t "see." For a contractor site, that mostly means: does Google Images know your before/after photo is a before/after epoxy garage floor photo, or is it just an anonymous file to a crawler?</p>`,
    },
    {
      heading: 'Why it drops off past the homepage specifically',
      bodyHtml: `<p>Homepage images are usually added deliberately, one at a time, by whoever built the site — alt text gets remembered. Gallery and service pages are often populated in bulk later (a batch upload of job photos, a plugin-generated grid) where alt text is the easiest field to skip under time pressure, and nobody circles back.</p>`,
    },
    {
      heading: 'The upside is small per image, but it\'s free',
      bodyHtml: `<p>Good alt text on a gallery of real before/after photos ("epoxy flake garage floor before and after, Fort Collins CO") gives Google Images a genuine chance to surface your work in image search results — a channel most competitors are neglecting for the exact same reason you might be. It costs nothing to add and never hurts anything to have.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/real-project-photos/', title: 'Why real job photos matter', description: 'The photos this alt text should actually be describing.' },
    { href: '/learn/image-alt-text-coverage/', title: 'The single-page version of this check', description: 'Same principle, scoped to just the homepage.' },
  ],
  faq: [
    { q: 'What should good alt text actually say?', a: 'A short, literal, specific description — the service, the material, and ideally the location. "Metallic epoxy garage floor, gray and blue swirl finish" beats "IMG_4821" or leaving it blank.' },
    { q: 'Does alt text directly boost my Google ranking?', a: 'Its direct effect is mainly on Google Images indexing and accessibility compliance — not a major direct ranking factor for regular search, but a real, free, zero-downside piece of the puzzle.' },
  ],
};
