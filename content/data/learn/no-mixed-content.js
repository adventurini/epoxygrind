export default {
  slug: 'no-mixed-content',
  category: 'security',
  checkLabel: 'No mixed content',
  title: 'Why "Mixed Content" Quietly Breaks Parts of Your Site',
  metaTitle: 'What Mixed Content Is and Why It Breaks Your Site | EpoxyGrind',
  metaDescription: 'When a secure (HTTPS) page tries to load something over plain HTTP, browsers silently block it — no popup, it just doesn\'t appear. Here\'s what that usually costs.',
  dek: 'This one doesn\'t show a warning — the broken piece just silently fails to load, which is worse, because you won\'t notice it unless you go looking.',
  introHtml: `<p>Your audit checks for "mixed content" — a secure (HTTPS) page that still tries to load an image, script, or embed over old, plain HTTP. Since 2019, Chrome and other browsers don't warn about this anymore; they just silently block the insecure piece. If that broken piece is your booking widget or a gallery image, it simply doesn't show up, and nothing tells you why.</p>`,
  stats: [
    { stat: 'Chrome 79+', context: 'automatically blocks "active" mixed content (scripts, iframes, stylesheets) with no prompt — it just fails silently in the background', source: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content' },
  ],
  sections: [
    {
      heading: 'A leftover from switching to HTTPS',
      bodyHtml: `<p>This almost always happens after a site moves from HTTP to HTTPS but a few old image tags, embeds, or script references still hardcode <code>http://</code> instead of <code>https://</code> — often left over from an old theme, a copy-pasted embed code (a review widget, a map, a booking tool), or an image uploaded years ago.</p>`,
    },
    {
      heading: 'The real cost is a silently broken page, not a scary warning',
      bodyHtml: `<p>Because modern browsers block this quietly rather than showing an alarming warning, mixed content is easy to miss during a normal site review — you'd have to actually open the browser's developer console to see the blocked-resource errors. Meanwhile a homeowner just sees a gap where a photo or a booking widget should be, with no explanation.</p>`,
    },
    {
      heading: 'The fix',
      bodyHtml: `<p>Find any hardcoded <code>http://</code> references in your images, embeds, and scripts and update them to <code>https://</code>. Most modern website builders and CMS platforms do this automatically; it's mainly older or custom-built sites where this lingers.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/valid-ssl-https/', title: 'Why "Not Secure" costs you calls', description: 'The related, more visible half of this same HTTPS story.' },
    { href: '/learn/console-errors-on-load/', title: 'Why console errors matter', description: 'Mixed content shows up here too — in the same place most owners never check.' },
  ],
};
