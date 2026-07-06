import { calculateEstimate } from './pricing.js';

export const SPACE_PRESETS = [
  { id: '1-car', label: '1-Car Garage', sqFt: 250 },
  { id: '2-car', label: '2-Car Garage', sqFt: 450 },
  { id: '3-car', label: '3-Car Garage', sqFt: 650 },
  { id: '4-car', label: '4-Car Garage', sqFt: 850 },
  { id: 'basement', label: 'Basement', sqFt: 800 },
];

export const LOCAL_SYSTEMS = [
  { id: 'flake-epoxy', label: 'Flake Epoxy', finish: 'flake', coatingType: 'epoxy' },
  { id: 'polyaspartic', label: 'Polyaspartic', finish: 'flake', coatingType: 'polyaspartic' },
  { id: 'metallic', label: 'Metallic Epoxy', finish: 'metallic', coatingType: 'epoxy' },
];

function roundMoney(n) {
  return Math.round(n / 5) * 5;
}

/**
 * Localized price table — national base rates (lib/pricing.js, the same
 * function the estimator itself calls) × the metro's cost_index. Numbers
 * can never disagree with the estimator because they come from the same
 * function, not a duplicated rate table (spec §5a).
 */
export function localPriceTable(costIndex) {
  return LOCAL_SYSTEMS.map((system) => ({
    system: system.label,
    rows: SPACE_PRESETS.map((preset) => {
      const pricing = calculateEstimate(preset.sqFt, system.finish, { coatingType: system.coatingType });
      return {
        space: preset.label,
        low: roundMoney(pricing.totalLow * costIndex),
        high: roundMoney(pricing.totalHigh * costIndex),
      };
    }),
  }));
}
