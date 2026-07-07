export default {
  slug: 'localbusiness-schema',
  category: 'seo',
  checkLabel: 'LocalBusiness schema',
  title: 'Why a Block of Invisible Code Can Change Whether You Show Up as a Rich Result',
  metaTitle: 'Why LocalBusiness Schema Matters for Contractors | EpoxyGrind',
  metaDescription: 'LocalBusiness structured data is invisible on the page but tells Google exactly what you do, where, and your hours and phone — real data on the CTR difference.',
  dek: 'Schema markup doesn\'t change how your page looks to a visitor — it changes how clearly Google understands it, which shows up as richer, more clickable search results.',
  introHtml: `<p>Your audit checks whether your site has LocalBusiness structured data (also called schema or JSON-LD) — a block of code, invisible to visitors, that explicitly tells Google your business name, address, phone number, service area, and category, instead of making Google guess from your page text.</p>`,
  stats: [
    { stat: '72.6%', context: 'of first-page Google results use schema markup of some kind', source: 'Backlinko', url: 'https://webselect.agency/schema-markup-s-effect-on-click-through-rate/' },
    { stat: '58% vs. 41%', context: 'share of clicks going to rich results (schema-enhanced) vs. standard results in the same search', source: 'Rich results CTR research', url: 'https://webselect.agency/schema-markup-s-effect-on-click-through-rate/' },
    { stat: '40%', context: 'CTR boost reported by sites after adding schema markup', source: 'BlueTone Media', url: 'https://webselect.agency/schema-markup-s-effect-on-click-through-rate/' },
  ],
  video: { videoId: 'HLMjOSOkPVA', title: 'How To Create a Local Business Schema Markup Easily (Validate and Preview Google Results)', channel: 'garnatti one' },
  sections: [
    {
      heading: 'What it actually tells Google',
      bodyHtml: `<p>LocalBusiness schema spells out, in a structured format Google is built to parse directly: your exact business name, phone number, address or service area, hours, and category ("epoxy flooring contractor"). Without it, Google has to infer all of this from your page's visible text and formatting — and inference is where mistakes and missed opportunities happen.</p>`,
    },
    {
      heading: 'Why this matters more for local trades than most site types',
      bodyHtml: `<p>Local service searches are exactly the category Google has built the richest structured-data features around — star ratings, hours, "open now" badges, click-to-call. A LocalBusiness schema block is often the difference between a plain blue link and a listing with visible trust signals attached, sitting right next to a competitor's plain link on the same results page.</p>`,
    },
    {
      heading: 'It\'s a one-time setup, not ongoing work',
      bodyHtml: `<p>Unlike content or backlinks, schema is a block of code added once and left alone (updated only if your hours, address, or phone change). It's one of the few purely technical, set-and-forget wins available to a small business site — most of the effort is simply making sure it gets added and stays accurate.</p>`,
    },
  ],
  relatedLinks: [
    { href: '/learn/google-rating/', title: 'Why your Google rating affects calls', description: 'Schema is part of how that rating gets surfaced richly in search.' },
    { href: '/learn/nap-consistency-phone/', title: 'Why consistent contact info matters', description: 'Schema only helps if the info inside it is accurate and consistent everywhere else too.' },
  ],
  faq: [
    { q: 'Does LocalBusiness schema directly improve Google rankings?', a: 'Not as a direct ranking factor, but it enables richer search result features (ratings, hours, click-to-call) that measurably improve click-through rate — which functions like a ranking improvement in practice.' },
    { q: 'Is schema markup hard to add?', a: 'It\'s a one-time technical task — a block of JSON-LD code added to the page. It doesn\'t require ongoing maintenance beyond updating it if core business details change.' },
    { q: 'What information should be in it?', a: 'At minimum: business name, phone, address or service area, hours, and business category. More complete data generally means richer search result features.' },
  ],
};
