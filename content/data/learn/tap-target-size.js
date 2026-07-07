export default {
  slug: 'tap-target-size',
  category: 'mobile',
  checkLabel: 'Tap target size',
  title: 'Why Small Buttons Are Quietly Losing You Mobile Leads',
  metaTitle: 'Why Tap Target Size Matters for Mobile Conversions | EpoxyGrind',
  metaDescription: 'Real research on how shrinking a button below the standard touch-target size doubles mis-tap rates — and what that costs on a phone screen.',
  dek: 'A button too small to comfortably tap doesn\'t just look dated — it measurably doubles how often a real thumb misses it.',
  introHtml: `<p>Your audit measures every clickable element on the page and flags any that fall under roughly 44x44 pixels — the minimum comfortable touch target, per Apple's and Google's own mobile design guidelines. If more than 20% of your tappable elements are undersized, this check fails. It sounds cosmetic. The research says otherwise.</p>`,
  stats: [
    { stat: '44×44px', context: 'Apple\'s Human Interface Guidelines minimum tap target size; Google\'s Material Design recommends 48×48dp', source: 'Smashing Magazine, accessible tap target research', url: 'https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/' },
    { stat: '2x', context: 'error rate when a button shrinks from 44px to 30px, with task completion slowing sharply', source: 'Smashing Magazine tap-target research', url: 'https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/' },
    { stat: '63%', context: 'of all web traffic is mobile — meaning tap accuracy problems affect the majority of visitors, not an edge case', source: 'Scalify 2026 web traffic report', url: 'https://www.scalify.ai/blog/what-percentage-web-traffic-is-mobile-2026-statistics' },
  ],
  sections: [
    {
      heading: 'A "rage tap" is a homeowner about to leave',
      bodyHtml: `<p>UX researchers measure mobile frustration with something called the rage-tap rate — two or more taps within 500 milliseconds in roughly the same spot, which is what a real thumb does when it keeps missing a button. A homeowner rage-tapping your phone number or quote button isn't a minor annoyance; it's the exact moment they give up and hit the back button to try a competitor instead.</p>`,
    },
    {
      heading: 'Small targets compound with everything nearby',
      bodyHtml: `<p>Target size isn't the only variable — spacing between tappable elements and where they sit relative to how someone naturally holds a phone both matter too. But size is the one your audit can measure directly and objectively, and it's usually the one most within a contractor's control to fix: padding on a nav link or a CTA button is a CSS change, not a redesign.</p>`,
    },
    {
      heading: 'Why this hits your click-to-call link and quote button hardest',
      bodyHtml: `<p>The two things you most need a homeowner to successfully tap on mobile — your <a href="/learn/click-to-call-link/">phone number</a> and your quote/CTA button — are exactly the elements this check flags when they're undersized. A beautifully designed site with a cramped, hard-to-hit phone number in the header is losing exactly the leads it was built to capture.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/click-to-call-link/', title: 'Why your click-to-call link needs to actually work', description: 'The most important tap target on the page.' },
    { href: '/learn/viewport-meta-tag/', title: 'Why the viewport tag matters', description: 'The prerequisite for tap targets to render at the right size at all.' },
  ],
  faq: [
    { q: 'What size should mobile buttons and links be?', a: 'At least 44x44 pixels per Apple\'s guidelines, or 48x48dp per Google\'s — anything smaller measurably increases mis-taps.' },
    { q: 'Is this just about buttons?', a: 'No — any tappable element counts, including nav links, phone number links, and icons, not just buttons styled to look like buttons.' },
    { q: 'How do I fix a small tap target without a redesign?', a: 'Usually just increasing padding around the existing element is enough — you don\'t need to change its visual size, just the tappable area around it.' },
  ],
};
