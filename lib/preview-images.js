import { editImagesWithFal, isFalConfigured } from './fal.js';
import { isOpenArtConfigured } from './openart.js';
import { getApiKey } from './openai.js';

export const PREVIEW_ANGLES = [
  {
    id: 'original',
    label: 'Your garage (new floor)',
    mode: 'inplace',
  },
];

function buildFloorSpec(ctx) {
  const design = ctx.design || {};
  const finish = ctx.finishLabel || ctx.finish || 'epoxy floor';
  const parts = [
    `Finish system: ${finish}.`,
    design.colorLabel ? `Colors: ${design.colorLabel}.` : '',
    design.patternLabel ? `Pattern: ${design.patternLabel} (${design.patternDescription || ''}).` : '',
    // ctx.designPrompt (buildDesignPrompt) carries the rich, real
    // manufacturer color/blend description — a hex code means nothing to
    // an image model, so duplicating it here added noise, not signal.
    ctx.designPrompt || '',
  ].filter(Boolean);

  return parts.join(' ');
}

function buildInplacePrompt(ctx) {
  const floorSpec = buildFloorSpec(ctx);
  // Concrete (polished/stained/stamped) isn't a coating applied ON TOP of
  // the slab — it IS the slab, refinished — so "newly installed epoxy
  // coating"/"high-gloss epoxy sheen" is factually wrong framing for it and
  // was steering the image model toward painting on a glossy coating look
  // even when the selected finish was e.g. a matte acid-stain. Branch the
  // framing instead of forcing every finish through epoxy-specific language.
  const isConcrete = ctx.finish === 'concrete';
  // The estimator isn't garage-only (basements, kitchens, whole-house jobs
  // all go through this same flow) and plenty of uploaded photos show an
  // EXISTING floor covering — wood-look laminate, tile, carpet — over the
  // slab, not bare concrete. A prompt that flatly says "replace the
  // concrete floor" gives the model nothing to identify when no concrete
  // is visible at all, which is exactly what caused a real, reproduced
  // fal.ai `422 no_media_generated` failure on a kitchen/hallway photo
  // with wood-look flooring. Feeding it the real room/floor description
  // (already computed in lib/build-estimate.js, just never actually used
  // here before) and phrasing the edit as "whatever's on the floor now"
  // makes the instruction match what the model can actually see.
  const room = ctx.spaceDescription ? `Room shown: ${ctx.spaceDescription}` : '';
  return [
    room,
    isConcrete
      ? 'Edit this exact photo. Refinish ONLY the floor — mechanically polish, stain, or decoratively overlay the concrete slab as specified below. If an existing floor covering is visible, treat it as removed down to the slab first. This is NOT a coating applied on top of the existing floor covering.'
      : 'Edit this exact photo. Replace ONLY the floor with a newly installed professional epoxy coating over the concrete slab. If an existing floor covering is visible (tile, wood-look, carpet, etc.), treat it as removed down to the slab first.',
    floorSpec,
    isConcrete
      ? 'The refinished floor must clearly show the selected color and pattern, with a realistic sheen appropriate to that specific finish (satin for a plain polish, sealed satin for a stain, or the natural texture of a stamped/overlaid surface) — not a glossy epoxy coating look.'
      : 'The new floor must clearly show the selected finish, colors, and pattern with realistic high-gloss epoxy sheen.',
    'Keep the exact same camera angle, perspective, walls, ceiling, doors, storage, furniture, tools, lighting, and all objects unchanged.',
    'Photorealistic, no text, no watermarks.',
  ].filter(Boolean).join(' ');
}

/**
 * fal.ai's raw error text is a huge JSON blob (the full prompt, image URL,
 * signed storage token, etc.) — genuinely useful in server logs, actively
 * bad to show a user. Map the failure classes we've actually seen (and
 * reproduced) to something a homeowner/contractor can read and act on;
 * anything unrecognized falls back to one clear generic line rather than
 * leaking the raw response.
 */
export function friendlyPreviewErrorMessage(rawMessage) {
  const msg = String(rawMessage || '');
  if (/no_media_generated/.test(msg)) {
    return "Our image generator couldn't produce a preview for this photo and finish combination — try a different photo (a clearer, more direct shot of the floor usually helps) or a different color/pattern.";
  }
  if (/FAL_KEY is not configured/.test(msg)) {
    return 'Floor preview generation is not available right now.';
  }
  if (/timed out/.test(msg)) {
    return 'Generating your floor preview took too long — please try again.';
  }
  return "Something went wrong generating your floor preview. Please try again, or try a different photo.";
}

function demoPreview(angleId, baseColorHex) {
  const color = (baseColorHex || '#4A4F54').replace('#', '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
    <rect width="1024" height="768" fill="#11213B"/>
    <polygon points="0,420 1024,360 1024,768 0,768" fill="#${color}" opacity="0.92"/>
    <text x="512" y="360" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="24" font-weight="700">Preview unavailable — add FAL_KEY</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function buildSinglePreview(angleId, previewContext) {
  const originalImage = previewContext.originalImage;
  if (!originalImage) throw new Error('Original photo is required for previews.');

  const angle = PREVIEW_ANGLES.find((item) => item.id === angleId);
  if (!angle) throw new Error('Invalid preview angle.');

  if (!isFalConfigured()) {
    if (!getApiKey() && !isOpenArtConfigured()) {
      return { id: angle.id, label: angle.label, image: demoPreview(angle.id, previewContext.baseColorHex) };
    }
  }

  try {
    const image = await editImagesWithFal([originalImage], buildInplacePrompt(previewContext), {
      returnUrl: true,
      timeoutMs: 110_000,
    });
    return { id: angle.id, label: angle.label, image, heroImage: image };
  } catch (err) {
    console.error('In-place floor preview failed:', err.message);
    throw err;
  }
}

/**
 * @param {object} previewContext
 */
export async function buildPreviewImages(previewContext) {
  return [await buildSinglePreview('original', previewContext)];
}
