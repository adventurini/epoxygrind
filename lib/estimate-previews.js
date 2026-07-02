/**
 * @typedef {{ id: string, label?: string, path: string }} PreviewPath
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} estimateId
 * @param {PreviewPath[]} previewPaths
 */
export async function syncEstimatePreviews(supabase, estimateId, previewPaths = []) {
  if (!estimateId || !previewPaths.length) return;

  const rows = previewPaths
    .filter((preview) => preview?.id && preview?.path)
    .map((preview) => ({
      estimate_id: estimateId,
      angle_id: preview.id,
      label: preview.label || null,
      storage_path: preview.path,
    }));

  if (!rows.length) return;

  const { error } = await supabase
    .from('estimate_previews')
    .upsert(rows, { onConflict: 'estimate_id,angle_id' });

  if (error) throw error;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} estimateId
 * @returns {Promise<PreviewPath[]>}
 */
export async function loadEstimatePreviewPaths(supabase, estimateId) {
  const { data, error } = await supabase
    .from('estimate_previews')
    .select('angle_id, label, storage_path')
    .eq('estimate_id', estimateId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.angle_id,
    label: row.label || undefined,
    path: row.storage_path,
  }));
}

/**
 * Pick the best thumbnail path: edited original preview, else uploaded photo.
 * @param {{ original_image_path?: string | null, payload?: object }} row
 * @param {PreviewPath[]} [previewPaths]
 */
export function pickEstimateThumbnailPath(row = {}, previewPaths = []) {
  const editedOriginal = previewPaths.find((item) => item.id === 'original')?.path;
  return (
    editedOriginal ||
    row.original_image_path ||
    row.payload?.originalImagePath ||
    previewPaths[0]?.path ||
    null
  );
}
