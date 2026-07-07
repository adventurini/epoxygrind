export default {
  slug: 'unique-title-tags-across-pages',
  category: 'siteStructure',
  checkLabel: 'Unique title tags across pages',
  title: 'Why Every Page on Your Site Needs Its Own Title Tag',
  metaTitle: 'Why Unique Title Tags Across Pages Matter | EpoxyGrind Learning Center',
  metaDescription: 'If your service-area pages all share one title, Google can\'t tell them apart — and picks one to show, or rewrites it for you. Real research on what happens next.',
  dek: 'When two of your pages share a title, Google isn\'t looking at two ways to find you — it\'s looking at one page it can\'t decide between, and it doesn\'t wait for you to fix it.',
  introHtml: `<p>Your audit crawls beyond the homepage and checks whether each page it finds — service-area pages, individual service pages, your gallery — has its own distinct title tag, or whether several are duplicated (or simply missing). This is one of the most common technical gaps on multi-page contractor sites built from a single template.</p>`,
  stats: [
    { stat: '76%', context: 'of title tags Google displayed in search results in Q1 2025 were rewritten by Google itself rather than shown as written — up from 61% just two years earlier', source: 'Search Engine Land, analysis of John McAlpin\'s Q1 2025 study', url: 'https://searchengineland.com/google-changed-76-of-title-tags-in-q1-2025-heres-what-that-means-454847' },
  ],
  sections: [
    {
      heading: 'Why templated multi-page sites get this wrong by default',
      bodyHtml: `<p>Most contractor sites are built from one template duplicated across service areas — "Epoxy Flooring in [City]" pages, individual service pages, and so on. Without deliberate attention, the template keeps the same title tag (or a boilerplate one) on every copy. Google sees several pages all titled essentially the same thing and has to guess which one actually answers a given search — it doesn't get points for effort on your behalf.</p>`,
    },
    {
      heading: 'What Google does when it can\'t tell your pages apart',
      bodyHtml: `<p>Google increasingly rewrites title tags it doesn't trust, replacing them with text pulled from the page itself or nearby headings — and it does this more often now than two years ago. A generic or duplicated title tag makes that outcome more likely, meaning you lose control over exactly the sentence that convinces someone to click your result instead of a competitor's in a crowded local search.</p>`,
    },
    {
      heading: 'The fix is specific, not clever',
      bodyHtml: `<p>Every page needs a title that's actually true only of that page: the specific service, the specific city or area, and your business name — not a template copy-pasted with one word swapped. "Garage Floor Epoxy Coating in Fort Collins, CO | [Business Name]" beats "Epoxy Services | [Business Name]" repeated across ten city pages.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/unique-meta-descriptions-across-pages/', title: 'Why every page needs its own description too', description: 'The companion check — same root problem, same fix pattern.' },
    { href: '/learn/broken-links/', title: 'Why broken links cost you jobs', description: 'Another sitewide structure check your audit runs.' },
  ],
  faq: [
    { q: 'Is a duplicate title tag actually a penalty?', a: 'Not a penalty exactly — but Google can\'t rank two identically-titled pages independently for different searches, so you lose the benefit of having built multiple pages in the first place.' },
    { q: 'What should a service-area page title actually say?', a: 'The specific service, the specific city, and your business name — in that order works well for local search. Avoid reusing the exact same template phrase word-for-word across every city page.' },
  ],
};
