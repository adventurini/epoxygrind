export default {
  slug: 'image-technical-quality',
  category: 'imageQuality',
  checkLabel: 'Image technical quality (upscaling, format)',
  title: 'Why a Blurry Photo Undoes Good Work Before Anyone Reads a Word',
  metaTitle: 'Why Blurry, Upscaled Images Hurt Trust | EpoxyGrind',
  metaDescription: 'A great before/after photo stretched past its real resolution reads as blurry and unprofessional. What actually causes it, and the simple technical fix.',
  dek: 'This isn\'t about the photo itself — it\'s about a small file forced to display bigger than it actually is, which is what makes it look blurry.',
  introHtml: `<p>Your audit checks the technical quality of your site's images — specifically whether they're being displayed larger than their real resolution (upscaled, which reads as blurry) and whether they're served in a modern, efficient format. This is a separate, more mechanical check from whether the photo itself is real or relevant — you can have a genuinely great before/after shot that still looks bad purely because of how it's being displayed.</p>`,
  stats: [
    { stat: '75%', context: 'of users judge a business\'s credibility based on its website design, including image quality', source: 'Website credibility research', url: 'https://proxyle.com/blog/the-impact-of-low-quality-imagery-on-brand-perception/' },
  ],
  sections: [
    {
      heading: 'Why a real photo can still look blurry',
      bodyHtml: `<p>If a photo is uploaded at a small size (say, 400 pixels wide) but the website tries to display it at 1200 pixels wide, the browser stretches it — and stretching is what causes the soft, blurry look, not the photo itself. This usually happens when a photo taken on an older phone, or one downloaded from a text message or social media, gets reused directly on the site.</p>`,
    },
    {
      heading: 'It quietly undermines everything else on the page',
      bodyHtml: `<p>Even a genuinely great <a href="/learn/before-after-photo/">before/after shot</a> or <a href="/learn/real-project-photos/">real project photo</a> loses most of its persuasive power if it looks technically amateurish — homeowners register "blurry" before they register "impressive transformation." Poor image quality reads as an unfinished or neglected site even when the underlying work is excellent.</p>`,
    },
    {
      heading: 'The fix is almost entirely upload hygiene',
      bodyHtml: `<p>Upload the original, full-resolution photo straight from your phone rather than a screenshot or a copy pulled from a text thread (both compress and shrink the image first). Modern formats like WebP also load faster without a visible quality loss — most website builders and platforms handle this conversion automatically if the original upload was high-resolution to begin with.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/real-project-photos/', title: 'Why real project photos matter', description: 'The content this check protects the presentation of.' },
    { href: '/learn/lighthouse-performance-score/', title: 'Why your site speed score matters', description: 'Oversized images are also a common cause of a slow site.' },
  ],
  faq: [
    { q: 'How do I know if my images are being upscaled?', a: 'If a photo looks noticeably softer or blurrier on your website than it does in your phone\'s own photo gallery, it\'s very likely being displayed larger than its native resolution.' },
    { q: 'Do I need special software to fix this?', a: 'Usually not — the fix is simply uploading the original, full-size photo file rather than a compressed copy (like one saved from a text message or social media post).' },
    { q: 'Does image format really make a difference?', a: 'Yes, modern formats like WebP or AVIF load faster at the same visual quality than older JPEG/PNG files, which also helps your site speed score.' },
  ],
};
