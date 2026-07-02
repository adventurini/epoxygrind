export const ESTIMATE_IMAGES_BUCKET = 'estimate-images';

export function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

export async function uploadDataUrl(supabase, path, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error('Invalid image data.');

  const { error } = await supabase.storage.from(ESTIMATE_IMAGES_BUCKET).upload(path, parsed.buffer, {
    contentType: parsed.contentType,
    upsert: true,
  });

  if (error) throw error;
  return path;
}

export async function uploadFromUrl(supabase, path, imageUrl, timeoutMs = 45_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(imageUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());

    const { error } = await supabase.storage.from(ESTIMATE_IMAGES_BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) throw error;
    return path;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Image upload timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function signedUrl(supabase, path, expiresIn = 60 * 60 * 24) {
  const { data, error } = await supabase.storage
    .from(ESTIMATE_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

function stripInlineImages(payload) {
  const next = { ...payload };
  delete next.originalImage;
  delete next.previews;
  return next;
}

export async function persistEstimateImages(supabase, userId, estimateId, payload) {
  const stored = stripInlineImages(payload);

  if (payload.originalImage?.startsWith('data:')) {
    stored.originalImagePath = await uploadDataUrl(
      supabase,
      `${userId}/${estimateId}/original.jpg`,
      payload.originalImage,
    );
  } else if (payload.originalImagePath) {
    stored.originalImagePath = payload.originalImagePath;
  }

  if (Array.isArray(payload.previews) && payload.previews.length) {
    stored.previewPaths = [...(payload.previewPaths || [])];

    for (const preview of payload.previews) {
      if (!preview?.id) continue;

      if (preview.storagePath) {
        upsertPreviewPath(stored, {
          id: preview.id,
          label: preview.label,
          path: preview.storagePath,
        });
        continue;
      }

      if (preview.image?.startsWith('http')) {
        const path = await uploadFromUrl(
          supabase,
          `${userId}/${estimateId}/previews/${preview.id}.jpg`,
          preview.image,
        );
        upsertPreviewPath(stored, { id: preview.id, label: preview.label, path });
        continue;
      }

      if (!preview.image?.startsWith('data:')) continue;

      const path = await uploadDataUrl(
        supabase,
        `${userId}/${estimateId}/previews/${preview.id}.jpg`,
        preview.image,
      );
      upsertPreviewPath(stored, { id: preview.id, label: preview.label, path });
    }
  } else if (payload.previewPaths?.length) {
    stored.previewPaths = payload.previewPaths;
  }

  return stored;
}

function upsertPreviewPath(stored, entry) {
  if (!stored.previewPaths) stored.previewPaths = [];
  const idx = stored.previewPaths.findIndex((item) => item.id === entry.id);
  if (idx >= 0) stored.previewPaths[idx] = entry;
  else stored.previewPaths.push(entry);
}

export async function hydrateEstimateImages(supabase, payload) {
  const out = { ...payload };

  if (payload.originalImagePath) {
    out.originalImage = await signedUrl(supabase, payload.originalImagePath);
  }

  if (payload.previewPaths?.length) {
    out.previews = await Promise.all(
      payload.previewPaths.map(async (preview) => ({
        id: preview.id,
        label: preview.label,
        image: await signedUrl(supabase, preview.path),
      })),
    );
  }

  return out;
}

export function estimateSummary(payload = {}, row = {}) {
  const pricing = payload.pricing || {};
  const analysis = payload.analysis || {};
  const design = payload.design || {};
  return {
    totalLow: row.total_low ?? pricing.totalLow ?? null,
    totalHigh: row.total_high ?? pricing.totalHigh ?? null,
    finishLabel: row.finish_label ?? pricing.finishLabel ?? null,
    finish: row.finish ?? pricing.finish ?? null,
    patternLabel: row.pattern_label ?? design.patternLabel ?? null,
    baseColorHex: row.base_color_hex ?? design.baseColorHex ?? null,
    flakeColorHex: row.flake_color_hex ?? design.flakeColorHex ?? null,
    colorLabel: row.color_label ?? design.colorLabel ?? null,
    sqFt: row.sq_ft ?? pricing.sqFt ?? analysis.estimatedSqFt ?? null,
    spaceType: row.space_type ?? analysis.spaceType ?? null,
  };
}
