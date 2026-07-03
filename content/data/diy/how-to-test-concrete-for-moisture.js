export default {
  slug: 'how-to-test-concrete-for-moisture',
  title: 'How to Test Concrete for Moisture Before Epoxy',
  metaTitle: 'How to Test Concrete for Moisture Before Epoxy Coating | EpoxyGrind',
  metaDescription: 'The free plastic-sheet moisture test (ASTM D4263) and the pinless meter method, side by side — how to run each one and what a failed result means.',
  dek: 'Moisture trapped under a coating is the top cause of total-system failure — and testing for it costs nothing but a trash bag and 24 hours.',
  timeEstimate: 'Plastic-sheet test: 16–24 hours (mostly waiting). Meter test: a few minutes',
  difficulty: 'Easy — no special skill for either method',
  introHtml: `<p>Concrete slabs, especially slabs in contact with soil (like most garage and basement floors), can wick moisture vapor upward from underneath. If you coat over a slab that's actively pushing moisture through it, that vapor has nowhere to go once it's sealed under an epoxy film — it builds up and eventually causes bubbling, blistering, or full delamination, sometimes months after the coating looked perfect. There's a free way to check for this and a paid, faster way. Doing one of them, every time, is cheap insurance against redoing the entire job.</p>`,
  materials: [{ productId: 'klein-et140-moisture-meter', label: 'Pinless moisture meter', note: 'faster, repeatable, no waiting period — the paid option below' }],
  steps: [
    {
      title: 'Free option: the plastic-sheet test (ASTM D4263)',
      bodyHtml: `<p>Tape a clear plastic sheet, roughly 2ft × 2ft, tightly to the slab on all four sides so no air can get underneath — a taped trash bag works fine. Do this on bare, clean concrete, away from direct sun if possible, and leave it for 16–24 hours.</p>`,
    },
    {
      title: 'Read the plastic-sheet test',
      bodyHtml: `<p>Peel back the sheet and look at both the underside of the plastic and the concrete beneath it. Any visible condensation on the plastic, or a darkened/damp patch on the concrete, is a fail — that slab is releasing enough moisture vapor to be a real risk under a coating. A dry sheet and unchanged concrete color is a pass.</p>`,
    },
    {
      title: 'Paid option: a pinless moisture meter',
      bodyHtml: `<p>A pinless meter reads moisture using an electromagnetic sensor pressed against the surface — no waiting, no plastic, and you can test multiple spots across the slab in a few minutes instead of running one test at a time. It's the faster, more thorough option if you're testing a large floor or want readings at several points rather than just one average result.</p>`,
    },
    {
      title: 'Test multiple spots, not just one',
      bodyHtml: `<p>Moisture is often uneven across a slab — a spot near an exterior wall, a floor drain, or a low point in the grade outside can read very differently from the center of the garage. Test at least 3–4 locations, including any spot you have reason to suspect (near a wall, a known drainage issue, or a low corner).</p>`,
    },
    {
      title: 'For a borderline or failed result, consider a calcium chloride test',
      bodyHtml: `<p>If your plastic-sheet or meter results are ambiguous, a calcium chloride test kit gives an actual quantitative moisture vapor emission rate (measured in lbs/1000 sq ft/24hrs) rather than a pass/fail — useful when you're deciding between "coat as normal" and "use a moisture-mitigating primer" and want more data than a simple test gives you.</p>`,
    },
    {
      title: 'Act on a failed result — don\'t coat over it as-is',
      bodyHtml: `<p>A failed moisture test doesn't necessarily mean you can't coat the floor — it means you need a moisture-mitigating primer rated for vapor emission, or in more severe cases, professional slab treatment before a standard coating will hold. Coating over a known moisture problem without addressing it is one of the most predictable ways to redo an entire job within a year.</p>`,
    },
  ],
  mistakes: [
    'Skipping the test because the garage "feels dry" — vapor emission from below the slab is invisible to a visual or touch check; it only shows up in an actual test.',
    'Testing only one spot on a large floor — moisture is often uneven, and a single passing test doesn\'t clear the whole slab.',
    'Running the plastic-sheet test with gaps in the tape seal — any airflow under the sheet skews the result toward a false pass.',
    'Coating over a failed test anyway, assuming a thicker coat will solve it — thickness doesn\'t stop vapor pressure; it just delays how long it takes to build up enough to fail the coating.',
  ],
  faq: [
    { q: 'Which test is more accurate, the plastic sheet or the meter?', a: 'A pinless meter gives a faster, repeatable reading and lets you test more spots; the plastic-sheet test is simpler and free but slower and more binary (pass/fail rather than a graded reading). For a definitive number, a calcium chloride test is the most quantitative of the three.' },
    { q: 'Do I need to test a brand-new concrete pour the same way?', a: 'Yes, and new pours are more likely to fail — concrete continues releasing moisture as it cures, which typically takes at least 28 days and can take considerably longer depending on slab thickness and climate. Test before coating regardless of how long it\'s been since the pour.' },
    { q: 'My slab is on the second floor, not on grade — do I still need to test?', a: 'Elevated slabs are lower-risk since they\'re not in direct contact with soil, but they can still have moisture issues from below (a room underneath, plumbing, or the pour itself if relatively new). Testing is quick enough that skipping it rarely saves meaningful time.' },
    { q: 'What primer do I need if my slab fails the moisture test?', a: 'Look for a primer specifically rated as a "moisture mitigating" or "vapor barrier" primer — the packaging or spec sheet will state a maximum vapor emission rate it\'s rated to handle. Match that rating against your calcium chloride test result if you ran one.' },
  ],
  proCtaMidPage: false,
};
