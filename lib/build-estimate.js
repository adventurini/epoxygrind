import { calculateEstimate } from './pricing.js';
import { resolveDesign, buildDesignPrompt } from './finish-design.js';
import { fetchRegionalMarketRates } from './market-pricing.js';
import { buildPreviewImages } from './preview-images.js';
import { analyzeSpaceImage, demoAnalysis, isDemoMode } from './openai.js';
import { withTimeout } from './http-timeout.js';

/**
 * @param {object} body
 */
export function parseEstimateInput(body = {}) {
  const finishKey = ['solid', 'flake', 'metallic', 'concrete'].includes(body.finish) ? body.finish : 'flake';
  const coatingType = body.coatingType === 'polyaspartic' ? 'polyaspartic' : 'epoxy';
  const design = resolveDesign({
    finish: finishKey,
    baseColor: body.baseColor,
    flakeColor: body.flakeColor,
    pattern: body.pattern,
  });

  return {
    image: body.image,
    finishKey,
    coatingType,
    design,
    sqFtOverride: body.sqFtOverride ? Number(body.sqFtOverride) : null,
    lengthFt: body.lengthFt ? Number(body.lengthFt) : null,
    widthFt: body.widthFt ? Number(body.widthFt) : null,
    customerName: body.customerName || '',
    email: (body.email || body.customerEmail || '').trim(),
    location: (body.location || body.projectLocation || '').trim(),
    // A caller's own real pricing (e.g. a client-site estimator embed —
    // see mirrorball-epoxy's js/site.js) takes priority over EpoxyGrind's
    // AI-driven regional market-rate lookup below, entirely per-request —
    // this never touches lib/pricing.js's own FINISH_OPTIONS defaults or
    // any other caller's estimate.
    regionalRatesOverride: body.regionalRates && typeof body.regionalRates === 'object' ? body.regionalRates : null,
  };
}

function ensureAnalysis(analysis, analysisInput) {
  if (analysis && typeof analysis === 'object') return analysis;
  return demoAnalysis(analysisInput);
}

/**
 * @param {ReturnType<typeof parseEstimateInput>} input
 */
export async function buildPricingEstimate(input) {
  if (!input.image || typeof input.image !== 'string') {
    throw new Error('Photo is required.');
  }
  if (!input.location) {
    throw new Error('ZIP code is required.');
  }

  const sqFtGuess =
    input.sqFtOverride ||
    (input.lengthFt && input.widthFt ? input.lengthFt * input.widthFt : null) ||
    400;

  const analysisInput = {
    finish: input.finishKey,
    location: input.location,
    sqFtOverride: input.sqFtOverride,
    lengthFt: input.lengthFt,
    widthFt: input.widthFt,
    designSummary: input.design.summary,
  };

  // Photo analysis first — do not run two fal.ai calls in parallel (that is what broke builds).
  let analysis = ensureAnalysis(
    await withTimeout(analyzeSpaceImage(input.image, analysisInput), 60_000, 'Photo analysis').catch((err) => {
      console.error(err.message);
      return null;
    }),
    analysisInput,
  );

  const sqFt =
    input.sqFtOverride ||
    (input.lengthFt && input.widthFt ? input.lengthFt * input.widthFt : null) ||
    analysis.estimatedSqFt ||
    sqFtGuess;

  // A caller-supplied pricing override skips the AI market-rate lookup
  // entirely (it's a real cost/latency call, no reason to pay for it when
  // the caller already told us the rates to use).
  const regionalRates = input.regionalRatesOverride || await withTimeout(
    fetchRegionalMarketRates({
      location: input.location,
      finish: input.finishKey,
      sqFt,
      analysis,
    }),
    25_000,
    'Market pricing',
  ).catch((err) => {
    console.error(err.message);
    return null;
  });

  const pricing = calculateEstimate(sqFt, input.finishKey, {
    design: input.design,
    regionalRates,
    coatingType: input.coatingType,
  });

  const previewContext = {
    originalImage: input.image,
    spaceDescription: `${analysis.spaceType || 'Garage'}. ${analysis.analysisSummary || ''}`.trim(),
    finishLabel: pricing.finishLabel,
    finish: input.finishKey,
    design: input.design,
    designPrompt: buildDesignPrompt(input.design),
    baseColorHex: input.design.baseColorHex,
    flakeColorHex: input.design.flakeColorHex,
  };

  return {
    analysis: { ...analysis, estimatedSqFt: sqFt },
    pricing,
    design: input.design,
    previewContext,
    meta: {
      customerName: input.customerName,
      email: input.email,
      location: input.location,
      finish: input.finishKey,
      coatingType: input.coatingType,
      generatedAt: new Date().toISOString(),
      demoMode: isDemoMode(),
      // Reverted back to the gen-AI preview pipeline (buildSinglePreview/
      // editImagesWithFal) after the WebGL visualizer replacement proved
      // unreliable in production (incomplete floor masks, tiling/moiré
      // artifacts, metallic finishes not rendering correctly) — see the
      // visualizer-webgl-experiment branch for that work, preserved but
      // not in production. Omitting previewMode here means
      // previewsNeedGeneration() (calculator/estimate-view.js) correctly
      // falls through to the old on-demand preview generation for every
      // new estimate again.
    },
  };
}

export { buildPreviewImages, buildSinglePreview } from './preview-images.js';
