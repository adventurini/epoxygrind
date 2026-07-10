/** @typedef {'solid' | 'flake' | 'metallic' | 'concrete'} FinishType */

// All three finishes independently verified 2026-07-07 against real 2026
// contractor-pricing sources (ArmorGarage, Angi, HomeGuide, Homewyse,
// CustomCrete, D&G Flooring, TN Garage Floor Coatings) after a real user's
// 440 sq ft flake estimate ($5,545-$6,775) came in far above their own
// real-world quotes ($2,500-$3,200 for a straightforward 2-car garage).
// Flake was checked first ($5-9/sqft real range, $2,000-4,500 for a 2-car
// garage) and solid/metallic were initially just scaled down by the same
// ratio as a placeholder — checking them independently afterward found
// that guess had overcorrected: real solid pricing clusters $4-7/sqft and
// real metallic $8-15/sqft, both higher than the scaled placeholder.
export const FINISH_OPTIONS = {
  solid: {
    label: 'Solid color',
    description: 'Single-color epoxy with standard flake optional',
    rateLow: 4,
    rateHigh: 6,
  },
  flake: {
    label: 'Full flake / chip',
    description: 'Decorative vinyl flake broadcast system',
    rateLow: 5,
    rateHigh: 8,
  },
  metallic: {
    label: 'Metallic',
    description: 'Metallic epoxy with depth and movement',
    rateLow: 8,
    rateHigh: 13,
  },
  // Not an epoxy system — mechanically polished, stained, or decoratively
  // overlaid/stamped concrete on the existing slab. Real-world rate basis
  // (industry-standard ranges, not independently re-verified against live
  // quotes the way flake/solid/metallic were — see this file's header):
  // basic mechanical polish alone typically runs $3-8/sqft; this baseline
  // covers that, with stain/overlay/stamp patterns (see
  // lib/finish-design.js's PATTERNS.concrete) upcharging over it the same
  // way flake's patterns upcharge over its own baseline, rather than a
  // second pricing mechanism.
  concrete: {
    label: 'Polished / stained concrete',
    description: 'Mechanically polished, stained, or decoratively overlaid concrete — no epoxy coating',
    rateLow: 3,
    rateHigh: 6,
  },
};

export const PREP_RATES = { low: 0.75, high: 1.75 };
export const MIN_JOB = 1200;

/**
 * Coating chemistry — a layer on top of Finish (the look). Polyaspartic is a
 * topcoat system, not a pattern, so it applies to any finish/pattern combo.
 * @typedef {'epoxy' | 'polyaspartic'} CoatingType
 */
export const COATING_TYPES = {
  epoxy: {
    label: 'Epoxy',
    description: 'Standard 2-part epoxy coating system',
    rateAddLow: 0,
    rateAddHigh: 0,
  },
  polyaspartic: {
    label: 'Polyaspartic',
    description: 'Fast-cure, UV-stable topcoat — ready to use in as little as 24 hours, resists yellowing',
    rateAddLow: 1.25,
    rateAddHigh: 2,
  },
};

/**
 * @param {number} sqFt
 * @param {FinishType} finish
 * @param {{ includePrep?: boolean, design?: import('./finish-design.js').resolveDesign extends (...args: any[]) => infer R ? R : never, coatingType?: CoatingType }} [opts]
 */
export function calculateEstimate(sqFt, finish, opts = {}) {
  const finishCfg = FINISH_OPTIONS[finish] || FINISH_OPTIONS.flake;
  const coatingTypeCfg = COATING_TYPES[opts.coatingType] || COATING_TYPES.epoxy;
  const includePrep = opts.includePrep !== false;
  const area = Math.max(0, Number(sqFt) || 0);
  const design = opts.design;
  const regional = opts.regionalRates || null;

  const coatingRateLow = (regional?.coatingRateLow ?? finishCfg.rateLow) + coatingTypeCfg.rateAddLow;
  const coatingRateHigh = (regional?.coatingRateHigh ?? finishCfg.rateHigh) + coatingTypeCfg.rateAddHigh;
  const prepRateLow = regional?.prepRateLow ?? PREP_RATES.low;
  const prepRateHigh = regional?.prepRateHigh ?? PREP_RATES.high;
  const minJob = regional?.minJob ?? MIN_JOB;

  const coatingLow = area * coatingRateLow;
  const coatingHigh = area * coatingRateHigh;
  const prepLow = includePrep ? area * prepRateLow : 0;
  const prepHigh = includePrep ? area * prepRateHigh : 0;
  const coatingMid = area * ((coatingRateLow + coatingRateHigh) / 2);
  const prepMid = includePrep ? area * ((prepRateLow + prepRateHigh) / 2) : 0;

  let patternLow = 0;
  let patternHigh = 0;
  let patternLine = null;

  if (design) {
    patternLow = area * (design.patternAddLow || 0);
    patternHigh = area * (design.patternAddHigh || 0);
    if (patternLow !== 0 || patternHigh !== 0) {
      patternLine = {
        label: `${design.patternLabel} pattern`,
        low: Math.max(0, patternLow),
        high: Math.max(0, patternHigh),
        exact: roundMoney(Math.max(0, area * ((design.patternAddLow || 0) + (design.patternAddHigh || 0)) / 2)),
        note: design.patternDescription,
      };
    }
  }

  let totalLow = coatingLow + prepLow + Math.max(0, patternLow);
  let totalHigh = coatingHigh + prepHigh + Math.max(0, patternHigh);
  let totalExact = coatingMid + prepMid + (patternLine?.exact || 0);

  if (regional?.recommendedTotal) {
    // Regional AI pricing doesn't know about the coating-type upcharge —
    // the market-research prompt only describes the finish, not the topcoat
    // chemistry — so add it on top rather than letting it get silently
    // overridden by the recommended total.
    const coatingTypeMid = area * ((coatingTypeCfg.rateAddLow + coatingTypeCfg.rateAddHigh) / 2);
    totalExact = roundMoney(Number(regional.recommendedTotal) + coatingTypeMid);
  }

  if (totalLow < minJob) totalLow = minJob;
  if (totalHigh < minJob) totalHigh = Math.max(minJob, totalHigh);
  if (totalExact < minJob) totalExact = minJob;
  if (totalExact > totalHigh) totalExact = roundMoney((totalLow + totalHigh) / 2);
  if (totalExact < totalLow) totalExact = roundMoney((totalLow + totalHigh) / 2);

  const perSqFtNote = (low, high) => `$${low.toFixed(2)}–$${high.toFixed(2)}/sq ft`;

  const lineItems = [
    {
      label: 'Surface prep & grinding',
      low: prepLow,
      high: prepHigh,
      exact: roundMoney(prepMid),
      note: includePrep
        ? `Diamond grind, crack repair, oil mitigation as needed · ${perSqFtNote(prepRateLow, prepRateHigh)}`
        : 'Excluded',
    },
    {
      label: finish === 'concrete'
        ? finishCfg.label
        : coatingTypeCfg === COATING_TYPES.polyaspartic
          ? `${finishCfg.label} + polyaspartic topcoat`
          : `${finishCfg.label} epoxy system`,
      low: coatingLow,
      high: coatingHigh,
      exact: roundMoney(coatingMid),
      note: design
        ? `${design.colorLabel} · ${finishCfg.description} · ${perSqFtNote(coatingRateLow, coatingRateHigh)}`
        : `${finishCfg.description} · ${perSqFtNote(coatingRateLow, coatingRateHigh)}`,
    },
  ];

  if (patternLine) lineItems.push(patternLine);

  return {
    sqFt: area,
    finish,
    finishLabel: finishCfg.label,
    finishDescription: finishCfg.description,
    coatingType: opts.coatingType === 'polyaspartic' ? 'polyaspartic' : 'epoxy',
    coatingTypeLabel: coatingTypeCfg.label,
    design: design
      ? {
          colorLabel: design.colorLabel,
          patternLabel: design.patternLabel,
          baseColorHex: design.baseColorHex,
          flakeColorHex: design.flakeColorHex,
          summary: design.summary,
        }
      : null,
    lineItems,
    totalLow: roundMoney(totalLow),
    totalHigh: roundMoney(totalHigh),
    totalExact: roundMoney(totalExact),
    pricingMode: regional ? 'ai-market' : 'standard',
    minJobApplied: coatingLow + prepLow + patternLow < minJob || coatingHigh + prepHigh + patternHigh < minJob,
    market: regional
      ? {
          location: regional.marketLocation,
          summary: regional.marketSummary,
          factors: regional.pricingFactors,
          confidence: regional.dataConfidence,
          ratesSource: 'ai-market',
          recommendedTotal: regional.recommendedTotal,
          coatingPerSqFt: { low: coatingRateLow, high: coatingRateHigh },
          prepPerSqFt: { low: prepRateLow, high: prepRateHigh },
          minJob: regional.minJob,
        }
      : null,
  };
}

export function roundMoney(n) {
  return Math.round(n / 5) * 5;
}

export function formatMoney(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatRange(low, high) {
  return `${formatMoney(low)} – ${formatMoney(high)}`;
}
