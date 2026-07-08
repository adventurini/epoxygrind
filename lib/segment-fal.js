/**
 * Floor segmentation via fal.ai's hosted SAM 3 image endpoint
 * (epoxygrind-visualizer-build-spec.md Part 3.1). Runs once per uploaded
 * photo, server-side, so the client visualizer never needs its own
 * segmentation model or a Replicate/Modal account — FAL_KEY is the only
 * credential this repo already has configured (checked .env.local: no
 * REPLICATE_API_TOKEN exists), and fal.ai's catalog turned out to host a
 * model that fits the spec's "prompt with a point ... plus a 'floor' text
 * prompt if using a text-promptable model like Grounded-SAM" ask exactly:
 * SAM 3 (`fal-ai/sam-3/image`) takes BOTH a text prompt and point prompts
 * in one call, unlike plain SAM2 (point/box only, no text) or EVF-SAM2
 * (text only). One request gets us the "floor" semantic prompt AND the
 * bottom-center point the spec asks for.
 *
 * v1 simplification per spec Part 5: single call, one bottom-center point,
 * no confidence-handling UI, no manual point-assist yet — `needsManualAssist`
 * is computed and returned so that UI can slot in later without a response
 * shape change.
 */
import sharp from 'sharp';

const FAL_RUN = 'https://fal.run';
const SEGMENT_MODEL = 'fal-ai/sam-3/image';

// Spec 3.1: "downscale longest edge to 1280px server-side." In practice the
// client already downscales to <=960px before upload (calculator/calculator.js
// setPhoto), so this mostly matters for images that arrive some other way
// (e.g. a future re-segment of a stored full-res original) — cheap safety
// net either way.
const MAX_EDGE = 1280;

// Spec 3.1: "If confidence low or mask < 15% of image area, return
// needsManualAssist: true."
const MIN_MASK_AREA_PCT = 0.15;
const MIN_CONFIDENCE = 0.5;

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function urlToDataUrl(url, timeoutMs = 30_000) {
  if (url.startsWith('data:')) return url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Failed to fetch mask image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } finally {
    clearTimeout(timer);
  }
}

/** Downscales (only if needed) and normalizes to a JPEG data URL so the
 * fal.ai request body stays small and predictable. */
async function prepPhoto(photoDataUrl) {
  const parsed = parseDataUrl(photoDataUrl);
  if (!parsed) throw new Error('Photo must be a data URL.');

  const img = sharp(parsed.buffer);
  const meta = await img.metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);

  const buffer =
    longest > MAX_EDGE
      ? await img
          .resize({
            width: (meta.width || 0) >= (meta.height || 0) ? MAX_EDGE : null,
            height: (meta.height || 0) > (meta.width || 0) ? MAX_EDGE : null,
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer()
      : await img.jpeg({ quality: 90 }).toBuffer();

  const outMeta = await sharp(buffer).metadata();
  return {
    dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    width: outMeta.width,
    height: outMeta.height,
  };
}

async function falSegment(imageDataUrl, box) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not configured.');

  const res = await fetch(`${FAL_RUN}/${SEGMENT_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageDataUrl,
      prompt: 'floor',
      // Verified directly against the live API: point_prompts consistently
      // returns empty masks/scores on this model regardless of coordinates
      // (confidence and no error — just silently nothing), while box_prompts
      // reliably returns a real mask (score ~0.97 across multiple test
      // photos). Approximate the spec's "bottom-center point" intent with a
      // box covering the lower portion of the frame instead.
      box_prompts: [{ x_min: box.xMin, y_min: box.yMin, x_max: box.xMax, y_max: box.yMax }],
      // We only want the raw mask, not a composited cutout preview of the
      // original photo (apply_mask's documented purpose) — the client does
      // its own compositing in the WebGL pipeline.
      apply_mask: false,
      sync_mode: true,
      output_format: 'png',
      include_scores: true,
      max_masks: 1,
      return_multiple_masks: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`fal.ai sam-3 segmentation failed: ${res.status} ${errText}`);
  }
  return res.json();
}

/** Fraction of pixels above a mid threshold — mask images from SAM are
 * near-binary (white=floor, black=not-floor), so a straight threshold count
 * is a fine proxy for "how much of the frame is floor" without needing any
 * ML on our side. */
async function maskCoveragePct(maskDataUrl) {
  const parsed = parseDataUrl(maskDataUrl);
  if (!parsed) return 0;
  const { data } = await sharp(parsed.buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (!data.length) return 0;
  let lit = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 128) lit++;
  }
  return lit / data.length;
}

/**
 * @param {string} photoDataUrl
 * @returns {Promise<{
 *   photo: string, mask: string|null, width: number, height: number,
 *   confidence: number|null, maskAreaPct: number, needsManualAssist: boolean,
 *   reason: string|null,
 * }>}
 */
export async function segmentFloor(photoDataUrl) {
  const photo = await prepPhoto(photoDataUrl);

  // Spec 3.1: "prompt with a point at bottom-center of the image (floors
  // are at the bottom)." point_prompts don't work against the real API (see
  // falSegment) — approximate with a full-width box over the lower ~55% of
  // the frame, which is where the floor plane sits in a typical straight-on
  // garage/room photo.
  const box = { xMin: 0, yMin: Math.round(photo.height * 0.45), xMax: photo.width, yMax: photo.height };

  let result;
  try {
    result = await falSegment(photo.dataUrl, box);
  } catch (err) {
    return {
      photo: photo.dataUrl,
      mask: null,
      width: photo.width,
      height: photo.height,
      confidence: null,
      maskAreaPct: 0,
      needsManualAssist: true,
      reason: err.message || 'segmentation-failed',
    };
  }

  const maskItem = result.masks?.[0];
  const score = typeof result.scores?.[0] === 'number' ? result.scores[0] : null;

  if (!maskItem?.url) {
    return {
      photo: photo.dataUrl,
      mask: null,
      width: photo.width,
      height: photo.height,
      confidence: score,
      maskAreaPct: 0,
      needsManualAssist: true,
      reason: 'no-mask-returned',
    };
  }

  const maskDataUrl = await urlToDataUrl(maskItem.url);
  const maskAreaPct = await maskCoveragePct(maskDataUrl);
  const lowConfidence = score != null && score < MIN_CONFIDENCE;
  const tooSmall = maskAreaPct < MIN_MASK_AREA_PCT;
  const needsManualAssist = lowConfidence || tooSmall;

  return {
    photo: photo.dataUrl,
    mask: maskDataUrl,
    width: photo.width,
    height: photo.height,
    confidence: score,
    maskAreaPct,
    needsManualAssist,
    reason: needsManualAssist ? (tooSmall ? 'mask-too-small' : 'low-confidence') : null,
  };
}
