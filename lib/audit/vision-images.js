import { visionJsonCompletion } from '../fal.js';

const SYSTEM_PROMPT = `You review photos on small local-service-business (epoxy/concrete flooring contractor) websites for a marketing audit. Return JSON only, no markdown, no commentary.`;

function buildPrompt(count) {
  return `You're shown ${count} images from a contractor's website, in order (image 1, image 2, ...). For EACH image, score 0-10 on:
- authenticity: a real job-site photo (10) vs. generic stock photography (4) vs. an obviously AI-generated image (0). A photo reused across many websites reads as stock.
- relevance: is this actually an epoxy/concrete floor or directly related (10)? Unrelated imagery like a generic handshake, office building, or skyline scores 0.
- quality: lighting and focus — a dark, blurry phone photo scores low; a well-lit, sharp photo scores high.
- isBeforeAfter: true if this specific image is a before/after comparison shot, else false.

Return JSON: {"images": [{"index": 1, "authenticity": N, "relevance": N, "quality": N, "isBeforeAfter": bool}, ...]}`;
}

/** Programmatic per-image signal (40% of the category): upscaling, format,
 * lazy-loading — no AI call needed for these. */
function programmaticImageScore(img) {
  let score = 100;
  const notes = [];
  const upscaled = img.renderedWidth > img.width * 1.15 || img.renderedHeight > img.height * 1.15;
  if (upscaled) {
    score -= 40;
    notes.push('displayed larger than its native resolution (blurry)');
  }
  const isModernFormat = /\.(webp|avif)(\?|$)/i.test(img.src);
  if (isModernFormat) score += 5;
  if (img.loading === 'lazy') score += 5;
  return { score: Math.max(0, Math.min(100, score)), upscaled, isModernFormat, notes };
}

/**
 * Category 5 — Image quality, AI vision + programmatic (10% weight). Score
 * = 60% AI (authenticity/relevance/quality/before-after) + 40%
 * programmatic (upscaling/format/lazy-loading). Fewer than 3 real project
 * photos caps the whole category at 50, per spec.
 * @param {Array<{src:string, width:number, height:number, renderedWidth:number, renderedHeight:number, loading:string}>} images up to 8, from site-crawl.js
 */
export async function scoreImageQuality(images) {
  const sample = (images || []).slice(0, 8);
  if (!sample.length) {
    return { score: 0, checks: [{ label: 'Real project photos', value: '0 found', verdict: 'No real content images found on the page.', fix: 'Add real job-site photos — this is the highest-converting image type in this trade.', severity: 5, passed: false }], perImage: [] };
  }

  const programmatic = sample.map(programmaticImageScore);

  let aiResults = [];
  let aiError = null;
  try {
    const result = await visionJsonCompletion({
      imageUrls: sample.map((i) => i.src),
      systemPrompt: SYSTEM_PROMPT,
      prompt: buildPrompt(sample.length),
    });
    aiResults = result.images || [];
  } catch (err) {
    aiError = err.message;
  }

  const perImage = sample.map((img, i) => {
    const ai = aiResults[i] || {};
    const aiAvg = aiError ? null : ((ai.authenticity ?? 5) + (ai.relevance ?? 5) + (ai.quality ?? 5)) / 3 * 10;
    const combined = aiError ? programmatic[i].score : Math.round(aiAvg * 0.6 + programmatic[i].score * 0.4);
    return {
      src: img.src,
      programmatic: programmatic[i],
      ai: aiError ? null : { authenticity: ai.authenticity, relevance: ai.relevance, quality: ai.quality, isBeforeAfter: Boolean(ai.isBeforeAfter) },
      combinedScore: combined,
    };
  });

  const realProjectPhotoCount = perImage.filter((p) => !aiError && (p.ai?.authenticity ?? 0) >= 6 && (p.ai?.relevance ?? 0) >= 6).length;
  const hasBeforeAfter = perImage.some((p) => p.ai?.isBeforeAfter);

  let score = Math.round(perImage.reduce((sum, p) => sum + p.combinedScore, 0) / perImage.length);
  const cappedForFewPhotos = !aiError && realProjectPhotoCount < 3;
  if (cappedForFewPhotos) score = Math.min(score, 50);

  const checks = [
    {
      label: 'Real project photos',
      value: aiError ? 'AI review unavailable' : `${realProjectPhotoCount}/${perImage.length}`,
      verdict: aiError
        ? `Vision review failed (${aiError}) — scored on programmatic checks only.`
        : cappedForFewPhotos
          ? 'Almost no real project photos — homeowners can\'t see your work.'
          : 'Good coverage of real project photos.',
      fix: cappedForFewPhotos ? 'Replace stock/irrelevant images with real photos of actual completed jobs.' : '',
      severity: cappedForFewPhotos ? 5 : 1,
      passed: !cappedForFewPhotos,
    },
    {
      label: 'Before/after photo present',
      value: hasBeforeAfter ? 'Yes' : 'No',
      verdict: hasBeforeAfter ? 'Has the highest-converting image type in this trade.' : 'No before/after shot found — the single highest-converting image type in this trade.',
      fix: hasBeforeAfter ? '' : 'Add at least one real before/after comparison photo.',
      severity: 3,
      passed: hasBeforeAfter,
    },
    {
      label: 'Image technical quality (upscaling, format)',
      value: `${Math.round(programmatic.reduce((s, p) => s + p.score, 0) / programmatic.length)}/100 avg`,
      verdict: programmatic.some((p) => p.upscaled) ? 'Some images are stretched beyond their native resolution — looks blurry.' : 'Images are technically sound.',
      fix: programmatic.some((p) => p.upscaled) ? 'Serve images at their real display size, not upscaled.' : '',
      severity: 2,
      passed: !programmatic.some((p) => p.upscaled),
    },
  ];

  return { score, checks, perImage };
}
