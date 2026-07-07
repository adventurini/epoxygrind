export default {
  slug: 'contact-cta-presence-across-pages',
  category: 'siteStructure',
  checkLabel: 'Contact/CTA presence across pages',
  title: 'Why Every Page Needs a Way to Reach You, Not Just the Homepage',
  metaTitle: 'Why Contact Info on Every Page Matters | EpoxyGrind Learning Center',
  metaDescription: 'A homeowner who lands on a gallery or service page without a phone number or form has to hunt for a way to reach you — most won\'t bother.',
  dek: 'Google, a text link, or a bookmark can land someone on any page of your site — if that page is a dead end with no way to reach you, it doesn\'t matter how good your homepage is.',
  introHtml: `<p>Your audit crawls every page it finds and checks whether each one gives a visitor a real way to contact you — a phone number, a lead form, or a clear CTA — not just whether the homepage does. Most contractor sites nail this on the homepage and then quietly drop it on service pages, city pages, and galleries.</p>`,
  stats: [
    { stat: '44%', context: 'of visitors will leave a company\'s website if it has no visible contact information or phone number', source: 'Inc.', url: 'https://www.inc.com/magazine/201711/sheila-marikar/website-design-marketing.html' },
  ],
  sections: [
    {
      heading: 'Homeowners don\'t always arrive through your homepage',
      bodyHtml: `<p>A Google search for "epoxy garage floor [city]" often lands directly on a service-area page, not your homepage — meaning that page's design and layout, not your homepage's, is what a huge share of your traffic actually sees first. If the phone number and form live only on the homepage template, a large slice of visitors never see them at all.</p>`,
    },
    {
      heading: 'A gallery page is the worst place to lose this',
      bodyHtml: `<p>Gallery and before/after pages are frequently the most persuasive page on the whole site — it\'s where someone decides "I want my floor to look like that." Landing them there with no way to act on that decision, no phone number or form in sight, wastes exactly the moment the rest of your site was built to create.</p>`,
    },
    {
      heading: 'The fix belongs in the page template, not each page individually',
      bodyHtml: `<p>Like the Open Graph tag gap, this is best fixed once at the template level — a sticky phone number, a persistent "Get a quote" button, or a lead form baked into every page layout — rather than remembered manually each time a new page gets built.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/lead-form/', title: 'Why a visible lead form matters', description: 'The homepage version of this same principle.' },
    { href: '/learn/broken-links/', title: 'Why broken links cost you jobs', description: 'Another way a visitor can get stuck with no way forward.' },
  ],
  faq: [
    { q: 'Do I need a full lead form on every page, or is a phone number enough?', a: 'Either works — the bar is that a visitor on ANY page has some way to reach you without hunting for it. A persistent phone number or CTA button is often simpler to implement sitewide than a form on every page.' },
    { q: 'Which pages get missed most often?', a: 'Gallery pages, individual service pages, and service-area pages built after the initial site launch — these tend to get less design attention than the homepage and more easily drop the contact elements.' },
  ],
};
