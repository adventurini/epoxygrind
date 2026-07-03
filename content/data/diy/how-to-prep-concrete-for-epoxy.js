export default {
  slug: 'how-to-prep-concrete-for-epoxy',
  title: 'How to Prep Concrete for Epoxy: Grind vs. Etch, Moisture, and Repairs',
  metaTitle: 'How to Prep Concrete for Epoxy (Grind vs Etch) | EpoxyGrind',
  metaDescription: 'The full concrete prep decision tree before epoxy: grinding vs acid etching, moisture testing, crack and spall repair, and how to know the surface is ready.',
  dek: 'More DIY epoxy jobs fail from bad prep than from a bad product — here is how to actually get the concrete ready.',
  timeEstimate: '4–8 hours for a 2-car garage, depending on condition',
  difficulty: 'Moderate — physical work, but each decision point is simple once you know the criteria',
  introHtml: `<p>"Prep" is really three separate decisions: how to profile the surface (grind or etch), whether the slab has a moisture problem you need to address first, and whether cracks or spalls need repair before you coat. Get all three right and a mid-tier epoxy kit will outperform a premium kit applied over bad prep — this is the step that determines whether your coating lasts five years or five months.</p>`,
  materials: [
    { productId: 'dewalt-dwe46153-grinder-shroud-kit', label: '5in angle grinder + dust shroud' },
    { productId: 'ediamondtools-7in-cup-wheel', label: '30/40-grit diamond cup wheel', note: 'general profile prep' },
    { productId: 'ediamondtools-7in-coating-removal-wheel', label: '18/20-grit aggressive wheel', note: 'only if removing old coating/paint first' },
    { productId: 'dewalt-dwv010-dust-extractor', label: 'HEPA dust extractor' },
    { productId: 'klein-et140-moisture-meter', label: 'Pinless moisture meter' },
    { productId: '3m-6502ql-respirator', label: 'Half-face respirator', note: 'cartridges sold separately' },
    { productId: '3m-60923-cartridges', label: 'P100/organic-vapor cartridges' },
  ],
  steps: [
    {
      title: 'Decide: grind or etch',
      bodyHtml: `<p>Grinding uses a diamond cup wheel to mechanically abrade the surface, creating a consistent concrete surface profile (CSP) — this is what most epoxy manufacturers recommend and what warrantied professional installs almost always use. Acid etching uses a diluted acid (often included in retail kits) to chemically open the surface pores instead. Etching is cheaper and requires no power tools, but the result is less consistent — it depends on slab composition, dilution, and how thoroughly you rinse and neutralize it, and a rushed or under-diluted etch can leave a slick film that actively works against adhesion. If your kit's default instructions call for etching, check whether it's included before buying a separate product either way — but if you have access to a grinder, grinding is the stronger bond for the same labor.</p>`,
    },
    {
      title: 'Test for moisture before you do anything else',
      bodyHtml: `<p>Do this before you grind, not after — if the slab fails a moisture test, that changes your product choice (you may need a moisture-mitigating primer) before you spend a day grinding. Full method: <a href="/diy/how-to-test-concrete-for-moisture/">how to test concrete for moisture</a>.</p>`,
    },
    {
      title: 'Repair cracks and spalls',
      bodyHtml: `<p>Rout out and fill any cracks, and patch spalled (flaking/pitted) areas, before you grind — grinding after filling lets you level the repair flush with the surrounding slab in the same pass. Full method: <a href="/diy/how-to-repair-concrete-cracks-before-coating/">repairing concrete cracks before coating</a>.</p>`,
    },
    {
      title: 'Degrease any oil or grease stains',
      bodyHtml: `<p>A grinder or etch solution doesn't remove petroleum contamination — it just spreads it around. Use a concrete degreaser on visible stains and let it fully dry before mechanical prep, or that contamination will show up later as a fisheye or an adhesion failure isolated to that exact spot.</p>`,
    },
    {
      title: 'Set up dust control (if grinding)',
      bodyHtml: `<p>Connect the grinder's shroud to a shop vac or HEPA extractor before you start. Dry grinding without dust collection puts respirable crystalline silica into the air of an enclosed garage — wear a respirator with P100/organic-vapor cartridges regardless; dust collection reduces exposure, it doesn't eliminate the need for a respirator.</p>`,
    },
    {
      title: 'Grind in overlapping passes with the right grit',
      bodyHtml: `<p>Clean, bare concrete: 30/40-grit medium-bond wheel. Removing old coating, paint, or mastic first: 18/20-grit aggressive wheel for that pass, then switch to 30/40 to finish the profile. Keep the grinder moving in overlapping passes — dwelling in one spot digs a low point that telegraphs through the coating later as a visible dip.</p>`,
    },
    {
      title: 'Check the profile',
      bodyHtml: `<p>A properly ground slab has a uniform, slightly rough texture — a fingernail should catch lightly on it, and water dropped on the surface should darken it evenly rather than beading up in spots (beading usually means residual contamination or an under-profiled patch). Go back over any inconsistent areas with the same grit.</p>`,
    },
    {
      title: 'Vacuum thoroughly, then wipe',
      bodyHtml: `<p>Vacuum the entire slab, then go over it again with a tack cloth or a barely-damp mop, letting it dry completely before you prime or coat. Leftover grinding dust — even a film you can't easily see — is one of the most common invisible causes of poor adhesion, and it's completely avoidable at this stage.</p>`,
    },
  ],
  mistakes: [
    'Etching when you have grinder access — it works, but it\'s the weaker bond, and it\'s the prep method most often behind "why did my epoxy peel after only a year" complaints.',
    'Skipping the moisture test because you\'re in a hurry to start grinding — a failed moisture test changes your entire product plan, and it\'s much cheaper to find that out before you\'ve applied anything.',
    'Filling cracks after grinding instead of before — you lose the ability to level the patch flush with the surrounding profile in the same pass.',
    'Trusting a visual "looks clean" check over the fingernail/water-bead test — dust and contamination that\'s invisible to the eye is still enough to cause adhesion failure.',
    'Using the wrong grit for the job — an aggressive coating-removal wheel over-cuts clean concrete, and a fine prep wheel just glazes over old coating without actually removing it.',
  ],
  faq: [
    { q: 'Can I skip grinding entirely if my kit includes an etch solution?', a: 'You can, and many successful DIY jobs do — but grinding gives a more consistent, stronger mechanical bond. If you have grinder access, it\'s worth the extra labor, especially on a garage floor that will see vehicle traffic.' },
    { q: 'How do I know if my concrete is "new" and needs to cure before coating?', a: 'New concrete pours need to cure for at least 28 days before any coating, and ideally longer in humid climates — coating too early traps moisture that hasn\'t fully escaped the slab yet, which shows up later as bubbling or delamination.' },
    { q: 'Do I need to grind the entire garage, including under where cabinets or shelving will go?', a: 'Grind wall-to-wall, corner-to-corner — cabinets and shelving are much easier to install over a properly coated floor than to work around during prep, and skipping a hidden section just moves the failure point there instead of eliminating it.' },
    { q: 'What if my slab already has an old, well-bonded coating I want to keep partially?', a: 'You generally can\'t coat over "partially" — scuff-sand or grind the entire existing coating for adhesion, or if it\'s failing anywhere, remove it entirely first. See our guide on removing old epoxy.' },
  ],
  proCtaMidPage: false,
};
