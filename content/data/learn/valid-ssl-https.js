export default {
  slug: 'valid-ssl-https',
  category: 'security',
  checkLabel: 'Valid SSL (HTTPS)',
  title: 'Why "Not Secure" in the Address Bar Is Costing You Calls',
  metaTitle: 'Why HTTPS Matters for Contractor Websites | EpoxyGrind',
  metaDescription: 'A site without SSL shows "Not secure" right in the browser bar — and Chrome is about to make that warning much harder to ignore. Real data on the impact.',
  dek: 'A homeowner deciding whether to trust you with a $5,000+ job sees this before they see your work — and browsers are getting louder about it, not quieter.',
  introHtml: `<p>Your audit checks whether your site loads over HTTPS (the padlock) or plain HTTP. This isn't a subtle technical distinction — Chrome and other browsers actively label an HTTP site "Not Secure" right in the address bar, before a visitor reads a single word of your homepage.</p>`,
  stats: [
    { stat: '46%', context: 'of people say they would not enter their name or contact info on a site marked "Not Secure" — and 64% of that group leave instantly', source: 'Search Engine Land', url: 'https://searchengineland.com/nearly-half-of-users-have-a-bad-reaction-to-not-secure-browser-warning-survey-finds-312930' },
    { stat: '2026', context: 'the year Chrome began rolling out "Always Use Secure Connections" by default, warning users before they can even open a plain HTTP site', source: 'Google Security Blog', url: 'https://security.googleblog.com/2025/10/https-by-default.html' },
  ],
  sections: [
    {
      heading: 'It\'s not a small warning icon anymore',
      bodyHtml: `<p>For years, an HTTP site just meant a small "i" or "Not secure" label next to the URL — easy to miss. That's changing: Chrome is rolling out a default setting that interrupts the visitor with an actual warning screen before letting them proceed to an HTTP site at all, starting with security-conscious users in 2026 and expanding to everyone after. A contractor still running plain HTTP is about to get a lot more visible, and not in a good way.</p>`,
    },
    {
      heading: 'Homeowners read it as "this business isn\'t legitimate"',
      bodyHtml: `<p>Most homeowners can't explain what SSL does technically, but they've learned what "Not Secure" means: don't trust this. For a business asking someone to submit their name, phone number, and address for a multi-thousand-dollar job, that label undercuts trust before your reviews or before/after photos get a chance to counter it.</p>`,
    },
    {
      heading: 'The fix is usually free and takes minutes',
      bodyHtml: `<p>Almost every host — Wix, Squarespace, GoDaddy, SiteGround, and most others — provisions a free SSL certificate (often via Let's Encrypt) with one click in the account settings. This is one of the rare audit findings with essentially no cost and no real reason to leave unresolved.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/custom-domain/', title: 'Why a real domain (not a free subdomain) matters', description: 'The other half of "does this look like a real business."' },
    { href: '/learn/lead-form/', title: 'Why a visible lead form matters', description: 'HTTPS builds the trust; the form is what turns it into a lead.' },
  ],
  faq: [
    { q: 'Does my website need an SSL certificate?', a: 'Yes — modern browsers actively flag HTTP-only sites as "Not Secure," and that\'s becoming a harder warning to miss, not a softer one.' },
    { q: 'Is an SSL certificate expensive?', a: 'No — nearly every host offers a free one (typically via Let\'s Encrypt) that can be turned on in a few clicks from your hosting dashboard.' },
  ],
};
