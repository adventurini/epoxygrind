export default {
  slug: 'phone-number-consistency-across-pages',
  category: 'siteStructure',
  checkLabel: 'Phone number consistency across pages',
  title: 'Why Two Different Phone Numbers on Your Site Cost You Calls',
  metaTitle: 'Why Phone Number Consistency Across Pages Matters | EpoxyGrind Learning Center',
  metaDescription: 'An old number left on one page after you switched to a new line confuses homeowners and Google both. Real research on what inconsistent contact info costs.',
  dek: 'A homeowner who sees two different numbers on your own site doesn\'t call either one to ask which is right — they just call someone else.',
  introHtml: `<p>Your audit crawls every page it can find and compares the phone number listed on each against your listing's number on file, flagging pages where an old number, a typo, or a leftover from a previous redesign slipped through. This is one of the most common (and most avoidable) sitewide inconsistencies on a contractor site that's been live for a few years.</p>`,
  stats: [
    { stat: '68%', context: 'of consumers say they would stop using a local business if they found incorrect contact details for it online', source: 'BrightLocal', url: 'https://www.brightlocal.com/learn/what-is-nap/' },
  ],
  sections: [
    {
      heading: 'How this happens without anyone noticing',
      bodyHtml: `<p>A number changes — a new business line, a switch from a personal cell to a tracked call line — and every prominent mention gets updated. What usually gets missed: an old service-area page, a footer on a page that predates the redesign, or a schema/structured-data field nobody thinks to check since it isn't visible on the page itself. Your audit exists specifically to catch what a quick manual look at the homepage wouldn't.</p>`,
    },
    {
      heading: 'The homeowner-facing cost',
      bodyHtml: `<p>A homeowner comparing your site to two competitors isn\'t going to call both listed numbers to figure out which one is current — an inconsistency like that reads as "this business isn\'t on top of its own website," which is exactly the wrong impression to make before they\'ve even called anyone.</p>`,
    },
    {
      heading: 'The Google-facing cost, running in parallel',
      bodyHtml: `<p>Google cross-references the phone number on your site against your Google Business Profile and other citations as part of how it verifies your business is real and trustworthy for local search — a mismatch, even an accidental one on a single old page, works against that verification rather than for it.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/nap-consistency-phone/', title: 'Why NAP consistency matters beyond your own site', description: 'The same check, extended to directories and citations outside your website.' },
    { href: '/learn/broken-links/', title: 'Why broken links cost you jobs', description: 'Another sitewide crawl-based check your audit runs.' },
  ],
  faq: [
    { q: 'How do I find an old number hiding on my own site?', a: 'A full-site crawl (which is exactly what this check does) is the reliable way — manually clicking through every page is how these get missed in the first place.' },
    { q: 'Does this include my Google Business Profile too?', a: 'This specific check compares pages on your own site against each other and your listing number. Consistency against outside directories and citations is covered separately.' },
  ],
};
