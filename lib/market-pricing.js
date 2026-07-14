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

National baseline for this finish, verified against real 2026 contractor
pricing sources (Angi, HomeGuide, ArmorGarage, Homewyse, and others):
$${finishCfg.rateLow}-$${finishCfg.rateHigh}/sqft installed for a TYPICAL
residential job in an AVERAGE-cost market. Anchor your answer to this
baseline and only deviate meaningfully from it for a specific, real
reason — most US metro areas (including most state capitals, most
mid-size cities, and most suburbs of major metros) should land at or
very near this baseline, not at its high end by default. Only price
above it for a genuinely high-cost-of-living market (e.g. SF Bay Area,
NYC/Manhattan, LA, Seattle, Boston, DC/NoVA, or a named part of coastal
CA/South Florida) — and only price below it for a genuinely low-cost
rural or small-town market. "This is technically part of a metro area"
is not by itself a reason to price at the high end; most of any given
metro's suburbs are the AVERAGE case this baseline already represents.

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
    return normalizeMarketRates(parsed, input.location, finishCfg, input.sqFt);
  } catch (err) {
    console.error('Regional market pricing failed:', err.message);
    return null;
  }
}

/**
 * The AI is told to account for regional variation ("major metros cost more
 * than rural areas"), which is real, but a text-completion model has no
 * hard ceiling on what it returns — observed producing a combined
 * coating+prep rate of ~$12-15/sqft against a sane national $7.25-11.25/sqft
 * range for an unremarkable market (a real user's 440 sq ft flake estimate
 * came back $5,545-$6,775 against this site's own static-model baseline of
 * $3,190-$4,950 for the same job). A first pass at tightening these clamps
 * (up to 1.3x finishCfg.rateHigh) still reproduced numbers in the same
 * range on the same bad input — real regional premiums run more like
 * 10-15% above national high-end pricing for a typical metro, not 30%+, so
 * the ceilings are pinned tighter here. Still real headroom for genuinely
 * expensive markets; just not enough for one bad completion to nearly
 * double the number the way the original 2x ceiling allowed.
 *
 * Tightened again 2026-07-14 alongside FINISH_OPTIONS.flake itself (see
 * lib/pricing.js's header comment for the research) — the AI kept drifting
 * toward the top of its allowed range for ordinary jobs regardless of
 * actual locale, which is the opposite of what a locale-aware system
 * should do. Also dropped the prep ceiling's extra headroom above the
 * already-verified PREP_RATES.high (was letting prep alone drift 14%
 * above the real number for no established reason).
 */
function normalizeMarketRates(raw, fallbackLocation, finishCfg, sqFt) {
  const coatingRateLow = clampRate(raw.coatingRateLow, finishCfg.rateLow * 0.85, finishCfg.rateHigh * 1.1);
  const coatingRateHigh = clampRate(
    raw.coatingRateHigh,
    coatingRateLow,
    finishCfg.rateHigh * 1.15,
  );

  const prepRateLow = clampRate(raw.prepRateLow, 0.5, 1.75);
  const prepRateHigh = clampRate(raw.prepRateHigh, prepRateLow, 1.75);
  // The "ensure high is meaningfully above low" floors below (+0.5 / +0.25)
  // used to just Math.max their way past the ceilings just set above
  // whenever low landed near its own ceiling — e.g. prepRateLow clamped to
  // 1.75 forced prepRateHigh up to 2.0, silently blowing through the 1.75
  // ceiling that was the entire point of tightening this. Re-clamp the
  // floored value back down to the real ceiling instead of trusting the
  // floor alone.
  const finalCoatingRateHigh = Math.min(finishCfg.rateHigh * 1.15, Math.max(coatingRateHigh, coatingRateLow + 0.5));
  const finalPrepRateHigh = Math.min(1.75, Math.max(prepRateHigh, prepRateLow + 0.25));

  const area = Math.max(0, Number(sqFt) || 0);
  // Ceiling recommendedTotal against the already-clamped per-sqft rates
  // (with a little headroom for the AI's own minimum-job judgment on a
  // small area) rather than leaving it fully unbounded above a $800 floor.
  const recommendedCeiling = area > 0 ? area * (finalCoatingRateHigh + finalPrepRateHigh) * 1.1 : Infinity;

  return {
    marketLocation: String(raw.marketLocation || fallbackLocation).trim(),
    coatingRateLow,
    coatingRateHigh: finalCoatingRateHigh,
    prepRateLow,
    prepRateHigh: finalPrepRateHigh,
    minJob: raw.minJob ? Math.max(800, Number(raw.minJob) || 0) : null,
    recommendedTotal: raw.recommendedTotal
      ? Math.min(recommendedCeiling, Math.max(800, Number(raw.recommendedTotal) || 0))
      : null,
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
