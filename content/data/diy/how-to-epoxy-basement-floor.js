export default {
  slug: 'how-to-epoxy-basement-floor',
  title: 'How to Epoxy a Basement Floor',
  metaTitle: 'How to Epoxy a Basement Floor (DIY Guide) | EpoxyGrind',
  metaDescription: 'Epoxy coating a basement floor follows the same core process as a garage, with one critical difference: moisture. Here is what changes and why.',
  dek: 'A basement epoxy job is the same process as a garage floor with one much higher-stakes step: moisture testing, because basement slabs fail it more often.',
  timeEstimate: '2 days for an average basement, same as a garage-sized job, plus extra time if moisture mitigation is needed',
  difficulty: 'Moderate — same core skills as garage epoxy, but moisture-related complications are more common',
  introHtml: `<p>Coating a basement floor uses the same core process as a <a href="/diy/how-to-epoxy-garage-floor/">garage floor epoxy job</a> — prep, prime, base coat, optional flake, topcoat, cure. The difference isn't technique, it's risk profile: basement slabs sit below grade, in direct and often sustained contact with surrounding soil, and many basements have a history of some dampness even if it's not obviously visible day to day. That makes moisture the single factor most likely to determine whether a basement epoxy job succeeds or fails, more so than in a typical garage.</p>`,
  materials: [
    { productId: 'klein-et140-moisture-meter', label: 'Pinless moisture meter', note: 'test more thoroughly than you would for a garage' },
    { productId: 'dewalt-dwe46153-grinder-shroud-kit', label: '5in angle grinder + dust shroud' },
    { productId: 'ediamondtools-7in-cup-wheel', label: '30/40-grit diamond cup wheel' },
    { productId: 'dewalt-dwv010-dust-extractor', label: 'HEPA dust extractor' },
  ],
  steps: [
    {
      title: 'Test for moisture more thoroughly than you would in a garage',
      bodyHtml: `<p>Run the <a href="/diy/how-to-test-concrete-for-moisture/">plastic-sheet or meter test</a> at several points across the basement, including near exterior walls and any spot that's ever felt damp or shown efflorescence (the white, chalky mineral deposits that indicate moisture has moved through the concrete before). If your basement has any history of water intrusion — even minor, even long resolved — treat that history seriously here rather than assuming a fixed leak means the moisture risk is gone.</p>`,
    },
    {
      title: 'Address any active water issues before you coat anything',
      bodyHtml: `<p>Epoxy is a coating, not a waterproofing system — it doesn't stop bulk water intrusion (an active leak, standing water after rain) and coating over an unresolved water problem traps it, often making the eventual damage worse. If you have any ongoing moisture or water issue, resolve that first — gutters, grading, a sump pump, or professional waterproofing as needed — before this becomes an epoxy project at all.</p>`,
    },
    {
      title: 'Choose a moisture-mitigating primer if your test is borderline or fails',
      bodyHtml: `<p>Given how much more common elevated readings are in basements, budget for the possibility that you'll need a primer specifically rated for vapor emission rather than a standard primer, even if you don't have any visible signs of dampness.</p>`,
    },
    {
      title: 'Prep the same as a garage floor',
      bodyHtml: `<p>Grind for a proper mechanical profile, repair any cracks, and clean thoroughly. See the full method in our <a href="/diy/how-to-prep-concrete-for-epoxy/">concrete prep guide</a> — nothing about this step changes for a basement versus a garage.</p>`,
    },
    {
      title: 'Watch ventilation and temperature more closely',
      bodyHtml: `<p>Basements often have less airflow and more stable (sometimes cooler) temperatures than a garage, which can slow cure times and concentrate fumes during application. Run fans for ventilation, prop open any exterior basement doors or windows, and check that your basement's ambient temperature falls within your product's coating range — basements can run cooler than the "room temperature" a kit's instructions assume.</p>`,
    },
    {
      title: 'Coat, broadcast flake if using it, and topcoat',
      bodyHtml: `<p>Same process as a garage: base coat, flake broadcast while wet if you're using it (see our <a href="/diy/how-to-apply-flake-broadcast/">flake broadcast guide</a>), then a clear topcoat once the base has cured.</p>`,
    },
  ],
  mistakes: [
    'Skipping or under-testing for moisture because "the basement looks dry" — basements fail moisture tests more often than garages precisely because visible dampness and vapor emission aren\'t the same thing.',
    'Coating over an active or recent water intrusion issue instead of fixing the underlying cause first — epoxy doesn\'t waterproof, it just traps the problem underneath.',
    'Ignoring efflorescence (white mineral deposits) as just cosmetic — it\'s a sign moisture has moved through that concrete before, which matters directly for your moisture test result and primer choice.',
    'Assuming basement temperature matches garage temperature for cure purposes — basements often run cooler, which can extend working and cure times beyond what the kit\'s standard instructions assume.',
  ],
  faq: [
    { q: 'Is epoxy a waterproofing solution for a damp basement?', a: 'No — epoxy is a coating that sits on top of the slab; it doesn\'t stop bulk water intrusion or resolve a foundation moisture problem. If you have an active water issue, that needs its own fix (grading, gutters, a sump pump, or waterproofing) before or instead of an epoxy coating.' },
    { q: 'Can I epoxy a basement floor that\'s never been finished before?', a: 'Yes, as long as it passes a moisture test and the slab is sound (no active cracking or settling issues) — a never-finished basement floor is otherwise a normal epoxy prep-and-coat candidate.' },
    { q: 'Do basement floors need a different topcoat than a garage?', a: 'Not necessarily — the same considerations apply (durability, UV exposure is usually a non-issue in a basement, hot tire pickup is rarely relevant since cars don\'t park there). The bigger basement-specific decision is the primer, driven by your moisture test result.' },
    { q: 'How long should I wait after fixing a water issue before testing and coating?', a: 'Give the slab time to dry out and stabilize after any repair — several weeks at minimum, longer for more significant intrusion — then run a full moisture test before committing to coating. Testing too soon after a fix can still show elevated readings from residual dampness in the slab itself.' },
  ],
  proCtaMidPage: false,
};
