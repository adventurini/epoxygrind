export default {
  slug: 'how-to-fix-peeling-epoxy',
  title: 'How to Fix a Peeling Epoxy Floor',
  metaTitle: 'How to Fix a Peeling Epoxy Floor (And When to Start Over) | EpoxyGrind',
  metaDescription: 'Why epoxy floors peel, how to tell if it is a localized fix or a full redo, and the actual repair steps for each — plus when calling a pro makes more sense.',
  dek: 'Peeling epoxy almost always comes back to adhesion — and the fix depends entirely on whether it\'s one spot or the whole floor.',
  timeEstimate: 'Spot repair: a few hours. Full redo: same as a fresh install, 1–2 days',
  difficulty: 'Spot repair: easy. Full redo: same difficulty as installing epoxy from scratch',
  introHtml: `<p>Peeling epoxy is almost never a product defect — it's an adhesion failure, and adhesion failures trace back to one of three causes: inadequate surface prep (grinding vs. etching, or contamination left on the slab), moisture coming up through the concrete, or coating over an old finish that wasn't fully bonded itself. Knowing which one caused your specific failure determines whether you're looking at a small patch job or a full strip-and-redo.</p>`,
  materials: [
    { productId: 'dewalt-dwe46153-grinder-shroud-kit', label: '5in angle grinder + dust shroud', note: 'for regrinding the repair area or the whole floor' },
    { productId: 'ediamondtools-7in-coating-removal-wheel', label: '18/20-grit aggressive wheel', note: 'for stripping the failed coating' },
    { productId: 'klein-et140-moisture-meter', label: 'Pinless moisture meter', note: 'to rule out a moisture cause before you redo anything' },
  ],
  steps: [
    {
      title: 'Diagnose before you touch anything',
      bodyHtml: `<p>Look at the pattern. One small, isolated spot — often near a garage door threshold or a spot that had an oil stain — usually points to localized contamination or a missed prep spot. Peeling spread across the whole floor, or in a honeycomb/bubble pattern, usually points to a systemic cause: inadequate profile across the board, or moisture. Peeling concentrated where a car regularly parks with hot tires is a different problem entirely — see our <a href="/diy/how-to-fix-hot-tire-pickup/">hot tire pickup guide</a> if that's your pattern.</p>`,
    },
    {
      title: 'Rule out moisture',
      bodyHtml: `<p>Run a moisture test on an unaffected area of the slab. If it fails, redoing the coating without addressing moisture (a mitigating primer, or in severe cases professional slab treatment) will just repeat the failure. Full method: <a href="/diy/how-to-test-concrete-for-moisture/">how to test concrete for moisture</a>.</p>`,
    },
    {
      title: 'For a localized spot: grind, clean, and recoat',
      bodyHtml: `<p>Grind back the failed area plus a few inches of surrounding sound coating (feather the edge rather than leaving a hard line), degrease if contamination was the cause, vacuum thoroughly, and apply fresh base coat and topcoat matched as closely as possible to your original product. A perfect color match on a repair patch is genuinely difficult — expect some visibility of the repair, especially on a flake or metallic floor.</p>`,
    },
    {
      title: 'For widespread peeling: strip the whole coating',
      bodyHtml: `<p>Coating over a floor that\'s peeling in multiple spots doesn\'t work — new epoxy bonds to what\'s under it, and if that layer is already failing to hold on, the new coat fails with it, usually faster than the original did. Strip the entire existing coating (see our <a href="/diy/how-to-remove-old-epoxy/">removing old epoxy guide</a>), then treat the project as a full fresh install from prep forward.</p>`,
    },
    {
      title: 'Fix the root cause this time',
      bodyHtml: `<p>Whichever repair path you took, don\'t skip the step that actually caused the failure. If it was inadequate prep, grind properly this time rather than etching. If it was moisture, use a moisture-mitigating primer or address the source. Recoating without changing what failed the first time is the single most common reason a "fixed" floor peels again within a year.</p>`,
    },
  ],
  mistakes: [
    'Coating directly over peeling epoxy anywhere on the floor — it doesn\'t matter how well you clean the surface, an already-failed bond doesn\'t hold a new coat any better.',
    'Skipping the moisture test on a repair — if moisture caused the original failure, a cosmetic fix without addressing it just delays the same failure.',
    'Feathering the repair edge too tightly — a hard line where old meets new coating is more visible than a slightly wider, gradually blended repair zone.',
    'Assuming a small isolated spot means you can skip diagnosing the cause — even a small failure is worth a quick moisture check before you patch it, so you\'re not patching the same spot again next year.',
  ],
  faq: [
    { q: 'Can I just paint or seal over peeling epoxy to make it look better temporarily?', a: 'You can, but it\'s genuinely temporary — anything applied over an already-failed bond will peel again, often faster since it\'s adhering to an unstable surface rather than to sound concrete.' },
    { q: 'How do I know if my peeling is bad enough to call a professional instead of DIY-ing the fix?', a: 'If the peeling covers more than roughly 20-30% of the floor, or you\'re unsure whether the underlying cause is moisture (which can require more involved mitigation), a professional assessment is worth the cost before you sink another weekend and a full kit into a repeat failure.' },
    { q: 'Will a repaired spot ever match the rest of the floor perfectly?', a: 'Rarely perfectly, especially on flake or metallic finishes where the pattern itself is somewhat random. A solid-color floor repairs more invisibly than a decorative one.' },
    { q: 'Is peeling covered under a manufacturer warranty?', a: 'Depends on the product and the cause — most manufacturer warranties require documented proper surface prep and don\'t cover failures traced to skipped steps like grinding or moisture testing, which is most DIY peeling. Check your specific kit\'s warranty terms.' },
  ],
  proCtaMidPage: true,
};
