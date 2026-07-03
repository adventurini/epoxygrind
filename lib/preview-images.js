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
  return [
    'Edit this exact garage photo. Replace ONLY the concrete floor with a newly installed professional epoxy coating.',
    floorSpec,
    'The new floor must clearly show the selected finish, colors, and pattern with realistic high-gloss epoxy sheen.',
    'Keep the exact same camera angle, perspective, walls, ceiling, garage door, storage, tools, lighting, and all objects unchanged.',
    'Photorealistic, no text, no watermarks.',
  ].join(' ');
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
