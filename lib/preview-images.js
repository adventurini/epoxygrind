import { editImagesWithFal, isFalConfigured } from './fal.js';
import { generateWithOpenArt, isOpenArtConfigured } from './openart.js';
import { getApiKey } from './openai.js';

export const PREVIEW_ANGLES = [
  {
    id: 'original',
    label: 'Your garage (new floor)',
    mode: 'inplace',
  },
  {
    id: 'door',
    label: 'From garage door',
    mode: 'angle',
    camera:
      'Wide camera at the garage door threshold looking straight into the garage, showing the full floor depth.',
  },
  {
    id: 'left',
    label: 'Left corner',
    mode: 'angle',
    camera:
      'Camera in the left front corner at standing height, looking diagonally across the garage toward the right back.',
  },
  {
    id: 'right',
    label: 'Right corner',
    mode: 'angle',
    camera:
      'Camera in the right front corner at standing height, looking diagonally across the garage toward the left back.',
  },
];

function buildFloorSpec(ctx) {
  const design = ctx.design || {};
  const finish = ctx.finishLabel || ctx.finish || 'epoxy floor';
  const parts = [
    `Finish system: ${finish}.`,
    design.colorLabel ? `Colors: ${design.colorLabel}.` : '',
    design.baseColorHex || ctx.baseColorHex
      ? `Base epoxy color ${design.baseColorHex || ctx.baseColorHex}.`
      : '',
    design.flakeColorHex ? `Flake chip color ${design.flakeColorHex}.` : '',
    design.patternLabel ? `Pattern: ${design.patternLabel} (${design.patternDescription || ''}).` : '',
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

function buildAnglePrompt(ctx, angle) {
  const floorSpec = buildFloorSpec(ctx);
  return [
    'Generate a photorealistic photo of the SAME garage interior shown in the reference images.',
    floorSpec,
    'The epoxy floor must match the reference edited floor exactly — same finish, colors, flake, and pattern.',
    'Keep the same walls, garage door style, shelving, and overall layout as the references.',
    angle.camera,
    'No people, no text, no watermarks.',
  ].join(' ');
}

function demoPreview(angleId, baseColorHex) {
  const fallback = { original: '4A4F54', door: '1A5CD6', left: '0F2C5C', right: '42506B' };
  const color = (baseColorHex || `#${fallback[angleId] || '4A4F54'}`).replace('#', '');
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

  const heroImage = previewContext.heroImage || originalImage;

  if (angle.mode === 'inplace') {
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

  if (angle.mode === 'angle') {
    try {
      const image = await editImagesWithFal(
        [heroImage, originalImage],
        buildAnglePrompt(previewContext, angle),
        { returnUrl: true, timeoutMs: 110_000 },
      );
      return { id: angle.id, label: angle.label, image };
    } catch (err) {
      console.error(`Preview ${angle.id} failed:`, err.message);
      throw err;
    }
  }

  throw new Error(`Unsupported preview mode for ${angleId}.`);
}

/**
 * @param {object} previewContext
 */
export async function buildPreviewImages(previewContext) {
  const originalImage = previewContext.originalImage;
  if (!originalImage) {
    throw new Error('Original photo is required for previews.');
  }

  if (!isFalConfigured()) {
    if (!getApiKey() && !isOpenArtConfigured()) {
      return PREVIEW_ANGLES.map((angle) => ({
        id: angle.id,
        label: angle.label,
        image: demoPreview(angle.id, previewContext.baseColorHex),
      }));
    }
  }

  const results = [];

  const inplaceAngle = PREVIEW_ANGLES.find((a) => a.mode === 'inplace');
  let heroImage = originalImage;

  if (inplaceAngle) {
    try {
      heroImage = await editImagesWithFal([originalImage], buildInplacePrompt(previewContext), {
        returnUrl: true,
        timeoutMs: 110_000,
      });
      results.push({ id: inplaceAngle.id, label: inplaceAngle.label, image: heroImage });
    } catch (err) {
      console.error('In-place floor preview failed:', err.message);
      results.push({
        id: inplaceAngle.id,
        label: inplaceAngle.label,
        image: originalImage,
      });
      heroImage = originalImage;
    }
  }

  // Sequential, not Promise.all — running fal.ai calls in parallel is what
  // broke builds previously (rate limiting / concurrency errors).
  const angleViews = PREVIEW_ANGLES.filter((a) => a.mode === 'angle');
  for (const angle of angleViews) {
    try {
      const image = await editImagesWithFal(
        [heroImage, originalImage],
        buildAnglePrompt(previewContext, angle),
        { returnUrl: true, timeoutMs: 110_000 },
      );
      results.push({ id: angle.id, label: angle.label, image });
    } catch (err) {
      console.error(`Preview ${angle.id} failed:`, err.message);
    }
  }

  return results;
}
