export default {
  slug: 'click-to-call',
  category: 'funnel',
  checkLabel: 'Click-to-call',
  title: 'Why Phone Calls Convert So Much Better Than Forms for Your Trade',
  metaTitle: 'Why Click-to-Call Drives More Jobs Than Forms | EpoxyGrind',
  metaDescription: 'Home-services phone calls convert at roughly 46% versus 1.7% for the average web form. Real data on why calls close and forms mostly don\'t.',
  dek: 'A phone call and a form submission look like two versions of the same lead. The data says they are not close to the same thing.',
  introHtml: `<p>Your audit's funnel score weights click-to-call at 15 of its 100 points — a working <code>tel:</code> link on your phone number — because for a trade like epoxy flooring, a phone call converts at a fundamentally different rate than a form ever does. This check is about the business impact of that gap, distinct from the mobile-technical check on whether the link itself is implemented correctly.</p>`,
  stats: [
    { stat: '46%', context: 'lead-to-conversion rate for home-services phone calls', source: 'Invoca 2025 analysis of 60M+ phone calls, via Supply House Times', url: 'https://www.supplyht.com/articles/106612-home-services-call-performance-report-46-lead-conversion-rate-segment-benchmarks' },
    { stat: '1.7%', context: 'average web form conversion rate across industries, rarely exceeding 2.5% even for top performers', source: 'PCN Answers 2026 calls vs. forms study', url: 'https://pcnanswers.com/calls-vs-forms-leads-study/' },
    { stat: '25–55x', context: 'more likely a phone call converts vs. a web form submission, in home services specifically', source: 'PCN Answers 2026 calls vs. forms study', url: 'https://pcnanswers.com/calls-vs-forms-leads-study/' },
  ],
  sections: [
    {
      heading: 'The gap comes from where each type of lead starts the conversation',
      bodyHtml: `<p>A caller has usually already decided they want to talk to you and is often close to a decision stage; a form submitter is frequently still comparing options and evaluating. Neither is a bad lead, but they're at different points in the buying process, and one closes far more often — which is exactly why the audit weights working click-to-call so heavily.</p>`,
    },
    {
      heading: 'This is the business-impact half of a two-part check',
      bodyHtml: `<p>Your audit separately scores whether your phone number is a real, working <a href="/learn/click-to-call-link/">tel: link</a> on mobile — the technical implementation. This check is about why that implementation matters commercially: it's not a nice-to-have polish item, it's the difference between capturing your highest-converting lead type and losing it to a competitor whose number was one tap away.</p>`,
    },
    {
      heading: 'Forms still matter — just not as a replacement',
      bodyHtml: `<p>None of this means drop your <a href="/learn/lead-form/">lead form</a> — plenty of homeowners prefer texting a form outside business hours, or aren't ready to talk yet. The point is that click-to-call shouldn't be an afterthought next to the form; for this trade, it's usually the higher-converting path of the two.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/click-to-call-link/', title: 'Why your phone number needs to be a real tappable link', description: 'The technical implementation behind this business impact.' },
    { href: '/learn/lead-form/', title: 'Why a visible lead form still matters', description: 'The complementary lead-capture path for after-hours or comparison-stage visitors.' },
  ],
  faq: [
    { q: 'Why do calls convert so much better than forms for contractors?', a: 'Callers tend to be further along in deciding and want an immediate conversation; form submitters are more often still comparing options. Response speed also matters far more for forms than for calls.' },
    { q: 'Does this mean I don\'t need a lead form?', a: 'No — forms capture homeowners who aren\'t ready to talk yet or are browsing outside business hours. Calls and forms serve different moments in the same buying decision.' },
    { q: 'What\'s the single highest-leverage fix here?', a: 'Making sure your visible phone number is an actual tel: link, so a mobile visitor who wants to call can do it in one tap instead of manually dialing.' },
  ],
};
