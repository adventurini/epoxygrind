export default {
  slug: 'console-errors-on-load',
  category: 'security',
  checkLabel: 'Console errors on load',
  title: 'Console Errors: The Invisible Sign of a Neglected Site',
  metaTitle: 'What Console Errors on Your Site Actually Mean | EpoxyGrind',
  metaDescription: 'JavaScript errors that fire the moment your page loads rarely change what a visitor sees directly — but they\'re a reliable sign something on the site is broken or outdated.',
  dek: 'Nobody sees these errors unless they go looking — which is exactly why they tend to pile up unnoticed for years.',
  introHtml: `<p>Your audit checks your site's browser console — a diagnostic log every browser keeps, invisible unless someone opens developer tools — for JavaScript errors that fire the moment the page loads. A clean console isn't something homeowners consciously notice, but it's a reliable signal of how well-maintained the site actually is underneath the surface.</p>`,
  sections: [
    {
      heading: 'What actually causes this',
      bodyHtml: `<p>The most common causes: a plugin or script that's out of date, a tracking snippet pointing at a service you no longer use, a theme update that broke something minor, or a broken reference left over from a past redesign. None of these are catastrophic on their own, but they accumulate on sites nobody's actively maintaining.</p>`,
    },
    {
      heading: 'Why it\'s worth fixing even though visitors can\'t see it directly',
      bodyHtml: `<p>A handful of console errors alone rarely breaks the visible page. The real value in checking is what it usually indicates: an unmaintained site is far more likely to also have the more visible problems on this audit — slow load times, broken links, an outdated design — because the same neglect that let errors pile up unnoticed tends to affect everything else too.</p>`,
    },
    {
      heading: 'The fix',
      bodyHtml: `<p>Open your browser's developer tools (right-click → Inspect → Console tab) on your own homepage and see what's actually there. Most errors point directly at the broken script or missing file in the message itself, making this one of the more straightforward fixes on the audit once someone looks.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/no-mixed-content/', title: 'Why mixed content matters', description: 'Shows up in the same console, for a related reason.' },
    { href: '/learn/broken-links/', title: 'Why broken links matter', description: 'The more visible symptom of the same underlying neglect.' },
  ],
};
