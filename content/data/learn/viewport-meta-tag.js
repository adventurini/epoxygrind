export default {
  slug: 'viewport-meta-tag',
  category: 'mobile',
  checkLabel: 'Viewport meta tag',
  title: 'Why the Viewport Meta Tag Is the First Thing Your Audit Checks',
  metaTitle: 'Why the Viewport Meta Tag Matters for Mobile | EpoxyGrind',
  metaDescription: 'Without a viewport meta tag, phones render your site at desktop width and shrink it to fit — real data on what that does to mobile visitors.',
  dek: 'One missing line of HTML tells a phone to render your site like a shrunk-down desktop page instead of a real mobile page — and most of your traffic is a phone.',
  introHtml: `<p>Your audit checks for one specific line of code: <code>&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code>. Without it, a phone assumes your page was built for a ~980px desktop screen and renders the whole thing at that width, then shrinks it down to fit — text becomes unreadably small, buttons become nearly untappable, and every layout decision your site made stops working on the device most homeowners are actually using.</p>`,
  stats: [
    { stat: '63%', context: 'of all web traffic in 2026 comes from mobile devices', source: 'Scalify 2026 web traffic report', url: 'https://www.scalify.ai/blog/what-percentage-web-traffic-is-mobile-2026-statistics' },
    { stat: '11–18%', context: 'higher conversion rate for responsive sites vs. non-responsive equivalents', source: 'Celerart 2026 Responsive Web Design Statistics', url: 'https://celerart.com/blog/responsive-web-design-statistics' },
    { stat: '51.8% vs. 39.7%', context: 'mobile bounce rate vs. desktop bounce rate — a 12-point gap', source: 'DigitalApplied 2,000-page study, 2026', url: 'https://www.digitalapplied.com/blog/bounce-rate-benchmarks-2026-industry-channel-data' },
  ],
  video: { videoId: 'fgOO9YUFlGI', title: 'Responsive Design Tutorial - Tips for making web sites look great on any device', channel: 'LearnCode.academy' },
  sections: [
    {
      heading: 'A missing viewport tag breaks everything downstream of it',
      bodyHtml: `<p>Every other mobile check your audit runs — <a href="/learn/tap-target-size/">tap target size</a>, whether the page fits the screen width, whether a call-to-action stays reachable while scrolling — assumes the page is actually rendering at phone width in the first place. Without the viewport tag, none of those checks matter, because the phone never switched into mobile layout at all. It's the one line of code every other mobile fix depends on.</p>`,
    },
    {
      heading: 'This is a five-minute fix with an outsized effect',
      bodyHtml: `<p>Unlike a slow page or a weak trust signal, this isn't a design decision or a content problem — it's a single missing tag, usually because the site was hand-built or exported from an old template that predates mobile-first design. Adding it is close to a five-minute fix, and the layout the site was designed with (assuming it used relative units and media queries at all) will typically just start working correctly on phones immediately.</p>`,
    },
    {
      heading: 'Why this specific gap is rare but severe when it happens',
      bodyHtml: `<p>Most modern site builders (Squarespace, Wix, WordPress themes) include this tag by default, so it's uncommon in 2026 — which is exactly why it's worth checking rather than assuming. When it's missing, it's usually on an older, hand-coded, or heavily customized site, and it correlates with a business that hasn't touched their site's underlying code in years. If a homeowner opens that site on a phone — which, per the traffic numbers above, is most of them — they get a broken-looking business before they've read a word of your copy.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/tap-target-size/', title: 'Why tap target size matters', description: 'The next mobile check, once the page actually renders at phone width.' },
    { href: '/learn/lighthouse-performance-score/', title: 'Why site speed matters', description: 'The other half of the mobile experience.' },
  ],
  faq: [
    { q: 'What exactly does the viewport meta tag do?', a: 'It tells the browser to render the page at the device\'s actual screen width instead of assuming a ~980px desktop width and shrinking the result to fit.' },
    { q: 'Why would a modern website be missing it?', a: 'Almost every current site builder and theme includes it by default — it\'s usually missing on older, hand-coded sites or heavily customized templates that predate mobile-first design norms.' },
    { q: 'Is this hard to fix?', a: 'No — it\'s a single line of HTML in the page\'s <head>. The harder part is making sure the rest of the site\'s CSS actually uses relative units so the layout adapts once the tag is in place.' },
  ],
};
