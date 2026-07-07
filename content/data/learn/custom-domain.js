export default {
  slug: 'custom-domain',
  category: 'security',
  checkLabel: 'Custom domain (not a builder subdomain)',
  title: 'Why "yourbusiness.wixsite.com" Reads as Unfinished',
  metaTitle: 'Why a Real Domain Beats a Free Builder Subdomain | EpoxyGrind',
  metaDescription: 'A site still running on a free builder subdomain reads to homeowners as a business that never finished setting up. Real cost of skipping a $12/year domain.',
  dek: 'A URL like yourcompany.wixsite.com/coatings tells a homeowner you\'re still in the setup phase — for the cost of a domain, that impression is avoidable entirely.',
  introHtml: `<p>Your audit checks whether your site runs on a domain you own (yourcompany.com) or a free subdomain of whatever builder you used (yourcompany.wixsite.com, yourcompany.weebly.com, and similar). It's a small technical detail with an outsized effect on how finished — and how trustworthy — your business looks.</p>`,
  stats: [
    { stat: '50%', context: 'lower conversion rate reported for businesses running on a free subdomain compared to an owned domain', source: 'Sugar Rae', url: 'https://sugarrae.com/online-marketing/seo/never-blog-on-a-free-subdomain/' },
  ],
  sections: [
    {
      heading: 'Homeowners read a builder subdomain as "still setting up"',
      bodyHtml: `<p>Most visitors don't know the technical difference between a domain and a subdomain, but they recognize the pattern — the same one they've seen on a friend's hobby site or an abandoned project. It reads as temporary, not as a business that's been doing this for years.</p>`,
    },
    {
      heading: 'It also puts your brand at the mercy of someone else\'s',
      bodyHtml: `<p>A subdomain is borrowed space on someone else's root domain. You don't control it the way you control an owned domain, and it ties your business's identity to whatever platform you happened to build the site on rather than to your own name.</p>`,
    },
    {
      heading: 'The fix costs less than a service call',
      bodyHtml: `<p>A domain typically runs $10-15/year, and every major website builder has a one-click "connect your own domain" flow. It's one of the cheapest, fastest fixes on the whole audit relative to the impression it changes.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/valid-ssl-https/', title: 'Why "Not Secure" costs you calls', description: 'The other technical signal homeowners read as "is this a real business."' },
    { href: '/learn/google-rating/', title: 'Why your Google rating affects calls', description: 'Once they trust the site is real, this is what closes the decision.' },
  ],
};
