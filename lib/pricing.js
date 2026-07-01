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

  const coatingLow = area * finishCfg.rateLow;
  const coatingHigh = area * finishCfg.rateHigh;
  const prepLow = includePrep ? area * PREP_RATES.low : 0;
  const prepHigh = includePrep ? area * PREP_RATES.high : 0;

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
        note: design.patternDescription,
      };
    }
  }

  let totalLow = coatingLow + prepLow + Math.max(0, patternLow);
  let totalHigh = coatingHigh + prepHigh + Math.max(0, patternHigh);

  if (totalLow < MIN_JOB) totalLow = MIN_JOB;
  if (totalHigh < MIN_JOB) totalHigh = Math.max(MIN_JOB, totalHigh);

  const lineItems = [
    {
      label: 'Surface prep & grinding',
      low: prepLow,
      high: prepHigh,
      note: includePrep ? 'Diamond grind, crack repair, oil mitigation as needed' : 'Excluded',
    },
    {
      label: `${finishCfg.label} epoxy system`,
      low: coatingLow,
      high: coatingHigh,
      note: design
        ? `${design.colorLabel} · $${finishCfg.rateLow.toFixed(2)}–$${finishCfg.rateHigh.toFixed(2)} per sq ft`
        : `$${finishCfg.rateLow.toFixed(2)}–$${finishCfg.rateHigh.toFixed(2)} per sq ft`,
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
    minJobApplied: coatingLow + prepLow + patternLow < MIN_JOB || coatingHigh + prepHigh + patternHigh < MIN_JOB,
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
