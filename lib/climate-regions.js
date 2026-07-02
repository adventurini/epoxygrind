/**
 * Climate region content modules (spec §6c) — the main uniqueness lever on
 * city hubs. Genuinely different advice per region, not city-name
 * find-and-replace. Metro → region assignment lives in the metros dataset.
 */
export const CLIMATE_REGIONS = {
  'freeze-thaw': {
    label: 'Freeze-thaw climate',
    bodyHtml: `<p>Winters here put a garage or basement floor through repeated freeze-thaw cycles, and that's where two problems show up that milder climates rarely see. First, moisture: snowmelt tracked in on tires and boots sits on the slab, and if there's any vapor drive coming up from below, that moisture gets trapped under a coating that wasn't prepped for it — the leading cause of delamination in this region. A proper moisture test before coating isn't optional here the way it might be elsewhere.</p>
      <p>Second, road salt. Calcium and magnesium chloride deicers are aggressive on standard coatings over a full winter of exposure, which is part of why 100% solids epoxy systems are the standard recommendation in freeze-thaw climates — they hold up to the thermal cycling between a heated garage interior and sub-freezing exterior slab edges better than thinner water-based systems, and they resist the chemical attack from deicing salt better too.</p>
      <p>Installation timing matters more here than in warmer climates. Most epoxy and polyaspartic systems need the slab and ambient air above a minimum cure temperature — that generally rules out unheated garages in the coldest months unless you're running temporary heat during application and cure. Late spring through early fall is the reliable install window for an unheated space; a heated garage opens up more of the year.</p>`,
    seasonalNote: 'Plan an unheated-garage install for late spring through early fall — most systems need the slab and air above a minimum cure temperature that a cold winter garage won\'t hold without supplemental heat.',
    faq: {
      q: 'Can I epoxy my garage floor in the winter?',
      a: 'Only if you can keep the slab and air above the coating\'s minimum cure temperature throughout application and cure — that usually means temporary heat in an unheated garage. Late spring through early fall is the more reliable window without it.',
    },
  },
  sunbelt: {
    label: 'Sunbelt climate',
    bodyHtml: `<p>The number one epoxy floor failure in hot, dry climates is hot-tire pickup — a car parked on a fresh coating on a hot day, then driven away while the tires are still warm, can pull the coating right up off the slab in strips under the tire contact patches. It's a real risk for the first several weeks after coating, and it's specific to standard epoxy in high-heat regions; polyaspartic topcoats cure harder and faster and hold up to hot-tire stress meaningfully better, which is why they're the common upsell recommendation here rather than in milder climates.</p>
      <p>UV exposure is the other regional factor. Standard epoxy ambers and yellows under sustained direct sun — a real concern for patios, sun-exposed garage entries, and anywhere the coating sees UV for years rather than months. A polyaspartic or UV-stable topcoat over the epoxy base resists that yellowing; without it, expect visible color drift within a couple of years in full sun.</p>
      <p>Slab surface temperature during installation is worth planning around too — direct summer sun can push a concrete slab well above ambient air temperature, which shortens working time and can affect cure. Early morning application, before the slab heats up, is standard practice for a summer install in this region.</p>`,
    seasonalNote: 'Schedule application for early morning in the warmer months — direct sun can push slab surface temperature well above ambient air temperature and shorten your working time.',
    faq: {
      q: 'Why does my epoxy floor keep getting damaged where I park?',
      a: 'That\'s hot-tire pickup — warm tires pulling at a coating that hasn\'t fully cross-linked yet, common in hot climates during the first few weeks after coating. A polyaspartic topcoat holds up to it meaningfully better than standard epoxy alone.',
    },
  },
  'humid-south': {
    label: 'Humid-south climate',
    bodyHtml: `<p>Slab moisture is the gating issue for epoxy coatings in the humid Southeast and Gulf region, more than anywhere else in the country. High ambient humidity combined with slabs that are frequently on-grade (in direct contact with soil moisture) means moisture vapor transmission through the concrete is a routine concern rather than an edge case — a moisture test before coating is close to mandatory here, and a moisture-mitigating primer is a common line item on quotes in this region specifically because vapor drive is so common.</p>
      <p>Humidity also affects the coating itself during application. Most epoxy and polyaspartic systems have a working humidity range, and very high ambient humidity can affect cure time and, in some water-based systems, cause a hazy or blushed finish. Installers in this region typically plan around dehumidified conditions or pick systems formulated to tolerate higher humidity during cure.</p>
      <p>Between the moisture load and the climate, mildew resistance is worth asking about specifically — a basement or garage floor in a consistently humid environment benefits from a topcoat formulated to resist mildew growth at the coating surface, not just a standard clear coat.</p>`,
    seasonalNote: 'Humidity affects cure more than temperature does here — ask your installer how they are managing ambient humidity during application, not just the forecast temperature.',
    faq: {
      q: 'Do I need a moisture test before epoxy in a humid climate?',
      a: 'Yes — slab moisture vapor is the most common cause of coating failure in humid Southeast and Gulf climates. A plastic-sheet test or a moisture meter reading before coating is standard practice here, not an optional upsell.',
    },
  },
  coastal: {
    label: 'Coastal climate',
    bodyHtml: `<p>Salt air and salt spray are the defining factor for coastal properties, especially anything within a few blocks of the water or exposed to onshore wind. Airborne salt settles on exposed concrete continuously, and on an uncoated or poorly coated patio or garage floor near the coast, that salt exposure accelerates surface wear and can contribute to moisture problems at the slab. A coating rated for the exposure — not just a generic interior product — matters more here than it does further inland.</p>
      <p>Moisture is a related but separate issue: coastal humidity plus salt air both push toward the same failure mode as the humid-south region — vapor trapped under a coating that wasn't tested and prepped for it. If the space is a garage that occasionally floods or sees storm surge exposure, that's worth discussing with an installer directly, since it changes the prep and system recommendation.</p>
      <p>For exposed patios and outdoor-adjacent spaces, UV exposure compounds the salt-air problem — sustained direct sun plus salt spray is a harder environment than either factor alone. A UV-stable topcoat (polyaspartic or polyurethane) over the base coat is the standard recommendation for any coastal patio or exterior-adjacent slab, not just an upsell.</p>`,
    seasonalNote: 'For exterior-adjacent slabs, plan the topcoat choice around UV and salt exposure together — the two-factor combination is harder on a coating than either one alone.',
    faq: {
      q: 'Does salt air affect an epoxy garage floor near the coast?',
      a: 'Yes, especially for exposed entries and patios — airborne salt accelerates wear on coatings not rated for the exposure, and it compounds with humidity to increase moisture risk. Ask specifically whether your quoted system is rated for coastal exposure.',
    },
  },
};

export function getClimateRegion(id) {
  return CLIMATE_REGIONS[id] || null;
}
