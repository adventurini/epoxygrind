export default {
  slug: 'lead-form',
  category: 'funnel',
  checkLabel: 'Lead form',
  title: 'Why a Visible Lead Form Wins You More Jobs',
  metaTitle: 'Why a Lead Form on Your Homepage Wins More Jobs | EpoxyGrind',
  metaDescription: 'A homeowner who has to click to a separate contact page loses interest before they get there. Real conversion data on form placement and field count.',
  dek: 'Most visitors never scroll past what they see first, and every extra click between "interested" and "submitted" loses people who genuinely wanted to reach you.',
  introHtml: `<p>Your audit checks whether a lead form exists on your homepage, and how deep it's buried if it does. This isn't a style preference — it's the single most direct path between a homeowner deciding they want a quote and you actually getting their information.</p>`,
  stats: [
    { stat: '57–64%', context: 'of visitors never scroll past the first screen on desktop (57%) or mobile (64%)', source: 'DigitalApplied 2,000-page study, 2026', url: 'https://www.digitalapplied.com/blog/landing-page-conversion-study-2000-pages-tested-2026' },
    { stat: '10.1%', context: 'conversion rate for 3-field forms, vs. 3.6% for 9-field forms', source: 'Unbounce 2026 Conversion Benchmark Report', url: 'https://www.digitalapplied.com/blog/landing-page-statistics-2026-conversion-data-points' },
    { stat: '44%', context: 'of website visitors abandon a form before finishing it', source: 'CXL', url: 'https://www.youtube.com/watch?v=nfb9lzirZiw' },
  ],
  video: { videoId: 'nfb9lzirZiw', title: 'Fix Your Website Forms to Capture More Leads and Improve Conversion Rates', channel: 'CXL' },
  sections: [
    {
      heading: 'A form on a separate page is a form most visitors never reach',
      bodyHtml: `<p>Because most visitors never scroll below the first screen, a "Contact Us" link buried in the nav — one that requires a click to a whole separate page — quietly filters out anyone who wasn't already committed enough to go looking for it. A homeowner who's still comparing three contractors rarely is. The form needs to be somewhere in view before that decision gets made, not one click past it.</p>`,
    },
    {
      heading: 'Every extra field is a reason to close the tab',
      bodyHtml: `<p>Name, phone, and a one-line project description is enough to route a real lead — anything past that (address, preferred contact time, how did you hear about us, a dropdown for every possible service) adds friction with no upside, since you're calling them back anyway to get the details a longer form was trying to collect upfront.</p>`,
    },
    {
      heading: 'Why this matters more for local trades than most businesses',
      bodyHtml: `<p>A homeowner requesting an epoxy quote is usually comparing multiple contractors in the same sitting, not researching over days. Whoever they can reach fastest — a form filled out in ten seconds, versus a bounce because there wasn't one in sight — has a real structural head start on speed of response, before either contractor has said a single word.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/lighthouse-performance-score/', title: 'Why site speed matters', description: 'Gets them to the page in the first place.' },
    { href: '/learn/google-rating/', title: 'Why your Google rating affects calls', description: 'What makes them trust the form enough to fill it out.' },
  ],
  faq: [
    { q: 'Should the lead form be on the homepage or a separate contact page?', a: 'Homepage, or at minimum visible without scrolling — most visitors never click through to a separate page, so a form that requires that click effectively doesn\'t exist for most of your traffic.' },
    { q: 'How many fields should a contractor lead form have?', a: 'Three is close to ideal: name, phone, and a short project description. Every additional required field measurably lowers completion rates.' },
    { q: 'Is a phone number enough, or do I need a form too?', a: 'Both — some homeowners will call, but many prefer texting or filling out a quick form outside business hours. A form catches the leads a phone number alone would miss.' },
  ],
};
