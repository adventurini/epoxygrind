import { PREVIEW_ANGLES, buildSinglePreview } from './preview-images.js';
import { estimateColumnsFromPayload } from './estimate-columns.js';
import { syncEstimatePreviews } from './estimate-previews.js';
import { hydrateEstimateImages, persistEstimateImages, signedUrl } from './estimate-storage.js';
import { withTimeout } from './http-timeout.js';

function previewContextFromRow(hydrated, row) {
  const stored = hydrated.previewContext || row.payload?.previewContext || {};
  return {
    ...stored,
    originalImage: hydrated.originalImage,
    design: hydrated.design || hydrated.pricing?.design,
    finishLabel: hydrated.pricing?.finishLabel || stored.finishLabel,
    finish: hydrated.meta?.finish || stored.finish,
    baseColorHex: hydrated.design?.baseColorHex || stored.baseColorHex,
    flakeColorHex: hydrated.design?.flakeColorHex || stored.flakeColorHex,
    designPrompt: stored.designPrompt,
    spaceDescription: stored.spaceDescription,
  };
}

async function heroPathFromPayload(supabase, payload) {
  const original = payload.previewPaths?.find((item) => item.id === 'original');
  if (!original?.path) return null;
  return { path: original.path, url: await signedUrl(supabase, original.path) };
}

export async function generateEstimatePreview(supabase, userId, estimateId, angleId, row) {
  const angle = PREVIEW_ANGLES.find((item) => item.id === angleId);
  if (!angle) throw new Error('Invalid preview angle.');

  const hydrated = await hydrateEstimateImages(supabase, row.payload);
  if (!hydrated.originalImage) {
    throw new Error('Estimate has no photo.');
  }

  const hero = await heroPathFromPayload(supabase, row.payload);
  const ctx = previewContextFromRow(hydrated, row);
  ctx.heroImage = hero?.url || hydrated.originalImage;

  const generated = await withTimeout(
    buildSinglePreview(angleId, ctx),
    115_000,
    'Preview generation',
  );

  if (generated.heroImage && angleId === 'original') {
    ctx.heroImage = generated.heroImage;
  }

  const storedPayload = await persistEstimateImages(supabase, userId, estimateId, {
    ...row.payload,
    previews: [{ id: generated.id, label: generated.label, image: generated.image }],
  });

  const { error } = await supabase
    .from('estimates')
    .update({
      payload: storedPayload,
      updated_at: new Date().toISOString(),
      ...estimateColumnsFromPayload(storedPayload),
    })
    .eq('id', estimateId)
    .eq('user_id', userId);

  if (error) throw error;

  await syncEstimatePreviews(supabase, estimateId, storedPayload.previewPaths || []);

  const saved = storedPayload.previewPaths?.find((item) => item.id === angleId);
  const image = saved ? await signedUrl(supabase, saved.path) : generated.image;

  return { id: generated.id, label: generated.label, image };
}

/**
 * Generate the single floor preview image server-side and persist to storage.
 */
export async function generateAllEstimatePreviews(supabase, userId, estimateId, row) {
  const hydrated = await hydrateEstimateImages(supabase, row.payload);
  if (!hydrated.originalImage) {
    throw new Error('Estimate has no photo.');
  }

  const ctx = previewContextFromRow(hydrated, row);

  const original = await withTimeout(
    buildSinglePreview('original', ctx),
    115_000,
    'Preview original',
  );
  const previews = [{ id: original.id, label: original.label, image: original.image }];

  const storedPayload = await persistEstimateImages(supabase, userId, estimateId, {
    ...row.payload,
    previews,
  });

  const { error } = await supabase
    .from('estimates')
    .update({
      payload: storedPayload,
      updated_at: new Date().toISOString(),
      ...estimateColumnsFromPayload(storedPayload),
    })
    .eq('id', estimateId)
    .eq('user_id', userId);

  if (error) throw error;

  await syncEstimatePreviews(supabase, estimateId, storedPayload.previewPaths || []);

  const finalHydrated = await hydrateEstimateImages(supabase, storedPayload);
  return {
    previews: finalHydrated.previews || [],
    previewPaths: storedPayload.previewPaths || [],
  };
}
