export default {
  slug: 'how-to-remove-old-epoxy',
  title: 'How to Remove Old Epoxy From a Garage Floor',
  metaTitle: 'How to Remove Old Epoxy From a Garage Floor | EpoxyGrind',
  metaDescription: 'How to fully strip an old or failing epoxy coating before recoating — grinding vs. chemical strippers, dust control, and how to know the floor is actually clean.',
  dek: 'You cannot coat over a failing epoxy floor and expect it to hold — here is how to actually get it off before you start over.',
  timeEstimate: '4–10 hours for a 2-car garage, depending on coating thickness and method',
  difficulty: 'Moderate to hard — physically demanding, especially with a thick or well-bonded old coating',
  introHtml: `<p>If your existing coating is peeling, bubbling, or failing in multiple spots, the fix isn't a fresh coat on top — it's a full strip back to bare concrete, then a normal prep-and-coat job from there. Coating over a failing layer just gives the new epoxy the same weak bond the old one had, usually with a faster failure the second time. Removal is more labor-intensive than a first-time coating job, but it's a standard, well-understood process.</p>`,
  materials: [
    { productId: 'dewalt-dwe46153-grinder-shroud-kit', label: '5in angle grinder + dust shroud' },
    { productId: 'ediamondtools-7in-coating-removal-wheel', label: '18/20-grit aggressive coating-removal wheel' },
    { productId: 'dewalt-dwv010-dust-extractor', label: 'HEPA dust extractor' },
    { productId: '3m-6502ql-respirator', label: 'Half-face respirator', note: 'cartridges sold separately' },
    { productId: '3m-60923-cartridges', label: 'P100/organic-vapor cartridges' },
  ],
  steps: [
    {
      title: 'Decide your removal method',
      bodyHtml: `<p>Grinding with an aggressive coating-removal wheel is the standard DIY approach — it removes the old coating and profiles the concrete underneath in the same pass, which is efficient since you need a fresh profile anyway. A floor scraper can knock loose or already-peeling sections off faster before you grind the rest, saving wear on your grinding wheel. Chemical strippers exist but are slower, messier, and often still require a mechanical pass afterward to get full removal and a proper profile — for a garage-sized job, most DIYers get better results from grinding alone.</p>`,
    },
    {
      title: 'Scrape loose sections first',
      bodyHtml: `<p>If any part of the old coating is already peeling or bubbled, a floor scraper (or a wide putty knife for small areas) will pop it loose quickly, cutting down on grinding time for that section. Well-bonded sections won't come up this way — that's expected, and it's what the grinder is for.</p>`,
    },
    {
      title: 'Set up dust control before grinding',
      bodyHtml: `<p>Connect the grinder shroud to a shop vac or HEPA extractor. Grinding through an old coating and into concrete produces both coating dust and silica dust — wear a respirator with P100/organic-vapor cartridges throughout, since you're dealing with both particulate and, depending on the old coating's chemistry, potential fumes.</p>`,
    },
    {
      title: 'Grind with an 18/20-grit aggressive wheel',
      bodyHtml: `<p>Work in overlapping passes across the entire floor, including areas that look intact — an old coating that's failing in visible spots is often thinner or more compromised elsewhere too, even where it hasn't started peeling yet. Removing all of it, not just the obviously bad parts, avoids leaving a patchwork of old and new material underneath your fresh coat.</p>`,
    },
    {
      title: 'Switch to 30/40-grit to finish the profile',
      bodyHtml: `<p>Once the old coating is fully removed, a second pass with a standard 30/40-grit wheel finishes the concrete surface profile the same way it would for a first-time coating job — see our <a href="/diy/how-to-prep-concrete-for-epoxy/">concrete prep guide</a> for the full profile-check process.</p>`,
    },
    {
      title: 'Vacuum, inspect for remaining old coating, and address any cracks or spalls',
      bodyHtml: `<p>Check corners and edges carefully — grinders can miss tight spots against walls, and any leftover old coating there will show through or bond poorly under the new one. Handle any cracks the removal process exposed per our <a href="/diy/how-to-repair-concrete-cracks-before-coating/">crack repair guide</a> before moving forward with a normal coating job.</p>`,
    },
  ],
  mistakes: [
    'Only grinding the visibly failing sections and leaving intact-looking old coating elsewhere — that section is often thinner or weaker than it looks, and it becomes the next failure point.',
    'Skipping dust control because "it\'s just old paint/coating" — you\'re still grinding into concrete underneath, which produces silica dust regardless of what\'s on top of it.',
    'Not finishing with a proper 30/40-grit profile pass after the coating is off — an 18/20-grit removal pass alone can leave too aggressive a profile for a clean, even new coat.',
    'Assuming a chemical stripper alone is enough — most garage-scale removals still need a mechanical pass to fully clear the coating and create a proper new profile.',
  ],
  faq: [
    { q: 'Can I use a chemical stripper instead of grinding?', a: 'You can attempt it, but for garage-scale jobs, grinding is usually faster and more complete — chemical strippers work well on some coating chemistries and poorly on others, and you often still need to grind afterward for the profile anyway.' },
    { q: 'How do I know when all the old coating is actually removed?', a: 'Bare, ground concrete has a consistent, matte gray, slightly rough texture with no shiny or slick patches. Any remaining glossy or smooth spots usually indicate leftover old coating that needs another pass.' },
    { q: 'Is it worth renting a walk-behind grinder for removal instead of a hand grinder?', a: 'For a garage-sized floor with thick, well-bonded old coating, a walk-behind can save significant time over a hand grinder — worth considering above roughly 500-800 sq ft, similar to the buy-vs-rent decision for fresh concrete prep.' },
    { q: 'Do I need to test for moisture again if I\'m just recoating, not doing a first-time install?', a: 'Yes — test again. If moisture caused or contributed to the original coating\'s failure, that condition hasn\'t changed just because you removed the old coating.' },
  ],
  proCtaMidPage: false,
};
