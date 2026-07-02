import { falTextCompletion, isFalConfigured, parseJsonOutput } from './fal.js';
import { FINISH_OPTIONS } from './pricing.js';

/**
 * @param {{ location: string, finish: string, sqFt: number, analysis?: object }} input
 */
export async function fetchRegionalMarketRates(input) {
  if (!isFalConfigured() || !input.location) return null;

  const finishCfg = FINISH_OPTIONS[input.finish] || FINISH_OPTIONS.flake;
  const analysis = input.analysis || {};

  const prompt = `Research typical installed epoxy garage/concrete floor coating contractor pricing for this job.

Location: ZIP ${input.location}
Finish system: ${finishCfg.label} (${finishCfg.description})
Estimated area: ${input.sqFt} sq ft
Space: ${analysis.spaceType || 'garage or concrete floor'}
Condition notes: ${analysis.conditionNotes || 'standard wear'}
Surface issues: ${(analysis.surfaceIssues || []).join('; ') || 'none noted'}
Prep level estimate: ${analysis.prepLevel || 'moderate'}

Use your knowledge of regional labor costs, cost of living, and typical epoxy contractor rates in this market (major metros cost more than rural areas). Return realistic per-square-foot INSTALLED rates for this finish in this location.

Return JSON only with keys:
marketLocation (string — city/region you priced for),
coatingRateLow (number — USD per sq ft installed for ${input.finish} system, low end),
coatingRateHigh (number — USD per sq ft installed, high end),
prepRateLow (number — USD per sq ft for grind/prep/repair, low end),
prepRateHigh (number — USD per sq ft for prep, high end),
minJob (number|null — typical minimum job charge in this market, or null),
recommendedTotal (number — single best installed price in USD for this exact job, whole dollars, based on ${input.sqFt} sq ft in ZIP ${input.location}),
marketSummary (string — 2 sentences on local pricing for this type of job),
pricingFactors (string[] — 3-5 bullets: local market drivers, e.g. labor, humidity, competition),
dataConfidence ("high"|"medium"|"low" — how confident you are in this market estimate)`;

  try {
    const data = await falTextCompletion({
      prompt,
      max_tokens: 900,
      system_prompt:
        'You are an epoxy flooring estimator with deep knowledge of US regional contractor pricing. Return JSON only, no markdown.',
    }, 20_000);

    if (!data?.output) return null;

    const parsed = parseJsonOutput(data.output);
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeMarketRates(parsed, input.location, finishCfg);
  } catch (err) {
    console.error('Regional market pricing failed:', err.message);
    return null;
  }
}

function normalizeMarketRates(raw, fallbackLocation, finishCfg) {
  const coatingRateLow = clampRate(raw.coatingRateLow, finishCfg.rateLow * 0.7, finishCfg.rateHigh * 1.8);
  const coatingRateHigh = clampRate(
    raw.coatingRateHigh,
    coatingRateLow,
    finishCfg.rateHigh * 2,
  );

  const prepRateLow = clampRate(raw.prepRateLow, 0.5, 3);
  const prepRateHigh = clampRate(raw.prepRateHigh, prepRateLow, 4);

  return {
    marketLocation: String(raw.marketLocation || fallbackLocation).trim(),
    coatingRateLow,
    coatingRateHigh: Math.max(coatingRateHigh, coatingRateLow + 0.5),
    prepRateLow,
    prepRateHigh: Math.max(prepRateHigh, prepRateLow + 0.25),
    minJob: raw.minJob ? Math.max(800, Number(raw.minJob) || 0) : null,
    recommendedTotal: raw.recommendedTotal ? Math.max(800, Number(raw.recommendedTotal) || 0) : null,
    marketSummary: String(raw.marketSummary || '').trim(),
    pricingFactors: Array.isArray(raw.pricingFactors)
      ? raw.pricingFactors.map(String).filter(Boolean).slice(0, 6)
      : [],
    dataConfidence: ['high', 'medium', 'low'].includes(raw.dataConfidence)
      ? raw.dataConfidence
      : 'medium',
  };
}

function clampRate(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
