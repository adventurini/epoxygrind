export default {
  slug: 'epoxy-coverage-calculator',
  title: 'Epoxy Coverage Calculator: How Much Epoxy Do You Need?',
  metaTitle: 'Epoxy Coverage Calculator — Gallons & Kits Needed | EpoxyGrind',
  metaDescription: 'Calculate how many gallons of epoxy, polyaspartic, or metallic epoxy you need for your garage floor, based on square footage, coats, and solids content.',
  dek: 'Enter your floor size and coating system below to estimate gallons needed, then jump straight to kits sized for that coverage.',
  introHtml: `<p>Every epoxy, polyaspartic, and metallic system spreads differently depending on its <strong>volume solids</strong> (how much of the wet material stays behind as cured film) and how thick you apply it (<strong>target mil thickness</strong>, or DFT — dry film thickness). This calculator uses the standard coatings-industry spreading-rate constant to turn those two numbers, plus your square footage and coat count, into a gallons estimate.</p>
  <p>The defaults below are typical figures for each system — not a spec for any specific product. Always check the technical data sheet (TDS) on the actual kit you're buying and adjust the solids % and mil thickness fields to match; coverage claims vary by brand, and the manufacturer's number for their own product is always the more accurate one.</p>`,
  systems: [
    {
      id: 'epoxy',
      label: '100% Solids Epoxy',
      solidsPct: 100,
      mils: 8,
      rankingHref: '/best/best-garage-floor-epoxy-kits/',
      rankingLabel: 'garage floor epoxy kits',
    },
    {
      id: 'polyaspartic',
      label: 'Polyaspartic',
      solidsPct: 85,
      mils: 6,
      rankingHref: '/best/best-polyaspartic-kits/',
      rankingLabel: 'polyaspartic kits',
    },
    {
      id: 'metallic',
      label: 'Metallic Epoxy',
      solidsPct: 100,
      mils: 10,
      rankingHref: '/best/best-metallic-epoxy-kits/',
      rankingLabel: 'metallic epoxy kits',
    },
  ],
  lossFactorPct: 10,
  methodologyHtml: `<p>The formula: <strong>coverage (sq ft per gallon) = 1604 &times; volume solids &divide; target mils</strong>. The constant 1604 comes from the physical relationship between a gallon's volume and a 1-mil-thick film — spread one gallon of a 100%-solids material at exactly 1 mil thick and it covers 1,604 sq ft. Lower the solids content or raise the target thickness and that number drops.</p>
  <p>From there: gallons per coat = floor area &divide; coverage-per-gallon, then multiplied by a 10% loss factor to account for what stays in the roller nap, the mixing bucket, and porous concrete that drinks more than a smooth sealed floor. Multiply by your number of coats for the total.</p>
  <p>This is a planning estimate for buying the right amount of material, not a substitute for the coverage rate printed on your actual kit — see our <a href="/diy/how-to-epoxy-garage-floor/">complete garage floor epoxy guide</a> for how coats fit into the full job.</p>`,
  faq: [
    {
      q: 'Why does the calculator ask for volume solids instead of just letting me pick a product?',
      a: 'Volume solids and recommended mil thickness are specific to each manufacturer\'s formulation. Using system-level defaults gets you in the right ballpark for planning, but the number on your actual kit\'s technical data sheet will always be more accurate than a general industry figure.',
    },
    {
      q: 'What is DFT and why does it matter more than how much I roll on?',
      a: 'DFT (dry film thickness) is how thick the cured coating ends up, in mils — not how much wet material you spread. A thin film wears through fast regardless of how carefully you rolled it on; hitting the target DFT is what actually determines durability.',
    },
    {
      q: 'Why is the default solids % lower for polyaspartic than epoxy?',
      a: 'Many polyaspartic formulations run slightly below 100% volume solids, commonly in the 80-95% range depending on the product, versus most garage-grade epoxy kits which are formulated at or near 100% solids. Check your specific product\'s TDS — some polyaspartic systems are also sold at 100% solids.',
    },
    {
      q: 'Should I buy exactly what the calculator says?',
      a: 'No — round up to the next full unit the kit is sold in, and buy a little extra rather than stretching a kit thin. Running short mid-coat on a two-part product you\'ve already mixed is a much bigger problem than having a partial container left over.',
    },
    {
      q: 'Does this calculator account for flake broadcast or a clear topcoat separately?',
      a: 'No — run the calculator once per coat type (e.g., once for your pigmented base coat, once for a clear topcoat) since they often have different target mil thicknesses, and add the results together for your total shopping list.',
    },
  ],
};
