/** @typedef {'solid' | 'flake' | 'metallic'} FinishType */

export const FINISH_OPTIONS = {
  solid: {
    label: 'Solid color',
    description: 'Single-color epoxy with standard flake optional',
    rateLow: 4.25,
    rateHigh: 6.5,
  },
  flake: {
    label: 'Full flake / chip',
    description: 'Decorative vinyl flake broadcast system',
    rateLow: 6.5,
    rateHigh: 9.5,
  },
  metallic: {
    label: 'Metallic',
    description: 'Metallic epoxy with depth and movement',
    rateLow: 8.5,
    rateHigh: 12.5,
  },
};

export const PREP_RATES = { low: 0.75, high: 1.75 };
export const MIN_JOB = 1200;

/**
 * @param {number} sqFt
 * @param {FinishType} finish
 * @param {{ includePrep?: boolean, design?: import('./finish-design.js').resolveDesign extends (...args: any[]) => infer R ? R : never }} [opts]
 */
export function calculateEstimate(sqFt, finish, opts = {}) {
  const finishCfg = FINISH_OPTIONS[finish] || FINISH_OPTIONS.flake;
  const includePrep = opts.includePrep !== false;
  const area = Math.max(0, Number(sqFt) || 0);
  const design = opts.design;
  const regional = opts.regionalRates || null;

  const coatingRateLow = regional?.coatingRateLow ?? finishCfg.rateLow;
  const coatingRateHigh = regional?.coatingRateHigh ?? finishCfg.rateHigh;
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
    totalExact = roundMoney(Number(regional.recommendedTotal));
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
      label: `${finishCfg.label} epoxy system`,
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
