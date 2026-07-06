import { visionJsonCompletion } from '../fal.js';

const SYSTEM_PROMPT = `You review small local-service-business websites (epoxy/concrete flooring contractors) for a marketing audit. Judge against local-service-trade norms — a contractor's site competing with other local contractors — NOT against SaaS/tech-startup design standards. Return JSON only, no markdown, no commentary.`;

const DIMENSIONS = ['visualHierarchy', 'modernity', 'brandConsistency', 'readability', 'layoutIntegrity', 'professionalTrust'];

const PROMPT = `You're shown two screenshots of the same contractor website: a desktop view (1440px wide) and a mobile view (390px wide). Score each dimension 0-10 with a justification of 15 words or fewer.

1. visualHierarchy — Is there an obvious first read and an obvious next action (a clear CTA)? 0 = no clear focal point anywhere. 5 = a CTA exists but competes with other elements. 8 = one clear headline, one clear CTA, nothing competing.
2. modernity — Does this look built in the last ~4 years? 0 = dated: bevels/gradients, tiny centered text, autoplay carousels, clip-art. 5 = passable but generic template look. 8 = current design conventions, intentional layout.
3. brandConsistency — Do colors/type/imagery feel coherent, like one brand? 0 = patchwork of clashing fonts/colors. 5 = mostly consistent with a few mismatches. 8 = clearly one coherent brand system.
4. readability — Is text legible (size/contrast) on both viewports? 0 = hard to read, low contrast or too small. 5 = readable but cramped or inconsistent sizing. 8 = comfortable to read at a glance on both.
5. layoutIntegrity — Any visibly broken/overlapping/misaligned elements? 0 = obvious breakage. 5 = minor alignment issues. 8 = clean, nothing visibly broken.
6. professionalTrust — Would a homeowner trust this company with a $4,000 job on looks alone? 0 = looks like a scam or abandoned. 5 = looks like a real but unremarkable small business. 8 = looks established and trustworthy.

Return JSON: {"visualHierarchy": {"score": N, "justification": "..."}, "modernity": {...}, "brandConsistency": {...}, "readability": {...}, "layoutIntegrity": {...}, "professionalTrust": {...}}`;

/**
 * Category 4 — Design & UX, AI vision (15% weight). Category score = mean
 * of the 6 dimension scores x 10. Per-dimension scores + justifications are
 * stored raw (ai_design_review) since they double as audit-page copy.
 * @param {string} desktopScreenshot data URL, 1440px viewport
 * @param {string} mobileScreenshot data URL, 390px viewport
 */
export async function scoreDesignUX(desktopScreenshot, mobileScreenshot) {
  if (!desktopScreenshot || !mobileScreenshot) {
    return { score: null, dimensions: null, error: 'Missing screenshot(s)' };
  }

  try {
    const result = await visionJsonCompletion({
      imageUrls: [desktopScreenshot, mobileScreenshot],
      systemPrompt: SYSTEM_PROMPT,
      prompt: PROMPT,
    });

    const scores = DIMENSIONS.map((d) => Number(result[d]?.score) || 0);
    const mean = scores.reduce((a, b) => a + b, 0) / DIMENSIONS.length;

    return {
      score: Math.round(mean * 10),
      dimensions: DIMENSIONS.map((d) => ({
        label: d,
        score: result[d]?.score ?? null,
        justification: result[d]?.justification ?? '',
      })),
    };
  } catch (err) {
    return { score: null, dimensions: null, error: err.message };
  }
}
