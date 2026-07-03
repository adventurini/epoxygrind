export default {
  slug: 'how-to-grind-concrete-floor',
  title: 'How to Grind a Concrete Floor Before Epoxy',
  metaTitle: 'How to Grind a Concrete Floor Before Epoxy Coating | EpoxyGrind',
  metaDescription: 'Step-by-step concrete grinding for epoxy prep — the right grit, dust control, and how to know when the profile is ready to coat.',
  dek: 'Grinding gives epoxy a mechanical surface profile that acid etching can\'t match — here\'s how to do it on a garage-sized slab.',
  timeEstimate: '3–6 hours for a 2-car garage',
  difficulty: 'Moderate — physical, but no specialized skill required',
  introHtml: `<p>Grinding is the prep method most epoxy manufacturers recommend over acid etching, because it creates a consistent mechanical concrete surface profile (CSP) instead of relying on a chemical reaction that varies with slab composition and can leave a slippery film if not fully rinsed. If your kit's instructions default to an acid etch step, you can substitute grinding — check your kit first, since etch is often included and you may not need to buy it separately either way. For the full prep decision tree including moisture testing and crack repair, see our <a href="/diy/how-to-prep-concrete-for-epoxy/">concrete prep guide</a>.</p>`,
  materials: [
    { productId: 'dewalt-dwe46153-grinder-shroud-kit', label: '5in angle grinder + dust shroud' },
    { productId: 'ediamondtools-7in-cup-wheel', label: '30/40-grit diamond cup wheel' },
    { productId: 'ediamondtools-7in-coating-removal-wheel', label: '18/20-grit aggressive wheel', note: 'only if removing old coating first' },
    { productId: 'dewalt-dwv010-dust-extractor', label: 'HEPA dust extractor' },
    { productId: '3m-6502ql-respirator', label: 'Half-face respirator', note: 'cartridges sold separately' },
    { productId: '3m-60923-cartridges', label: 'P100/organic-vapor cartridges' },
  ],
  steps: [
    {
      title: 'Clear and sweep the slab',
      bodyHtml: `<p>Remove everything from the floor, sweep loose debris, and check for existing oil or grease stains — those need degreasing before grinding, or the grinder will just smear the contamination around instead of removing it.</p>`,
    },
    {
      title: 'Test for moisture',
      bodyHtml: `<p>Moisture trapped under a coating is a leading cause of delamination. There's a free option and a paid one: tape a 2ft × 2ft sheet of plastic to the slab and check for condensation after 16–24 hours (ASTM D4263), or use a pinless moisture meter for a faster, repeatable reading. For borderline results, a calcium chloride test kit gives a quantitative number. Don't skip this — it's cheap insurance against redoing the whole job.</p>`,
    },
    {
      title: 'Set up dust control',
      bodyHtml: `<p>Connect your grinder's dust shroud to a shop vac or HEPA dust extractor before you start. Dry-grinding concrete without dust collection puts respirable crystalline silica into the air of an enclosed garage — wear a respirator with P100/OV cartridges regardless, dust collection reduces exposure but doesn't eliminate it.</p>`,
    },
    {
      title: 'Grind with the correct grit',
      bodyHtml: `<p>On bare or already-clean concrete, use a 30/40-grit medium-bond cup wheel. If there's old coating, paint, or mastic to remove first, use an 18/20-grit aggressive wheel for that pass, then switch to 30/40 grit to finish the profile. Work in overlapping passes, keeping the grinder moving — dwelling in one spot digs a low spot that shows through the coating later.</p>`,
    },
    {
      title: 'Check the profile and clean up',
      bodyHtml: `<p>A properly ground slab has a uniform, slightly rough texture — a fingernail should catch on it lightly, and water should darken the surface evenly rather than beading. Vacuum thoroughly, then wipe with a tack cloth or damp mop (fully dry before coating) to remove fine dust the vacuum missed — leftover dust is one of the most common causes of poor epoxy adhesion.</p>`,
    },
  ],
  mistakes: [
    'Grinding without dust collection or a respirator — silica dust exposure is a real long-term health risk, not just a cleanup annoyance.',
    'Using the wrong grit for the job — an aggressive coating-removal wheel over-cuts clean concrete, and a fine prep wheel just glazes over old coating without removing it.',
    'Skipping the moisture test because "the garage seems dry" — moisture problems are often invisible until the coating fails months later.',
    'Leaving fine dust on the slab after grinding — even a light film of dust weakens adhesion across the whole floor.',
  ],
  faq: [
    { q: 'Do I really need to grind, or can I just clean and coat?', a: 'Bare, unground concrete is usually too smooth (or has a weak cured surface layer called laitance) for epoxy to bond well. Grinding removes that layer and creates a texture the coating can mechanically key into.' },
    { q: 'How do I know if my moisture test failed?', a: 'For the plastic-sheet test, any visible condensation or darkening under the sheet after 16–24 hours indicates elevated moisture — consult a moisture-mitigating primer or have the slab professionally tested before coating.' },
    { q: 'Can I rent a grinder instead of buying one?', a: 'Yes, for a one-time job renting is reasonable. See our concrete grinder guide for the buy-vs-rent breakdown and specific picks if you decide to buy.' },
    { q: 'What if I hit a spot that\'s much rougher or smoother than the rest after grinding?', a: 'Go back over uneven spots with the same grit until the texture is consistent — an uneven profile leads to uneven coating absorption and visible patchiness once it cures.' },
  ],
  proCtaMidPage: false,
};
