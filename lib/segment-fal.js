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
 *
 * v2 (spec 3.1's deferred manual mask-assist, now built): segmentFloor()
 * takes an optional `points` array — normalized [0,1] taps the user placed
 * on their own floor in api/segment.js's manual-assist UI. Re-verified
 * live against the fal.ai API before building this (per this task's
 * explicit instruction to re-check, since an earlier pass had found
 * point_prompts broken): point_prompts are NOT merely broken, they are
 * silently a no-op — a request with a point at the bottom-center of the
 * floor and a request with the "same" point moved onto a wall/ceiling
 * returned byte-identical masks and identical confidence scores, and even
 * omitting point_prompts entirely (text-only "floor" prompt) reproduced the
 * exact same result. The hosted model is doing pure text-grounded
 * segmentation and ignoring point_prompts outright. box_prompts, by
 * contrast, measurably change the output (verified: a box over the lower
 * frame vs. a box over the upper frame return different masks/scores), so
 * taps still need to become a box. A first attempt at "one small ~15% box
 * per tap, in one call" (this task's suggested fallback) was ALSO verified
 * unreliable: with 2 boxes + return_multiple_masks, one box's mask ballooned
 * to ~59% coverage essentially ignoring its own box while the other
 * collapsed to <2% coverage — not a usable per-tap result. What verified
 * reliably (scores ~0.88-0.99, sane 40-60% coverage, consistent across
 * several tries) is a SINGLE box that encloses all the tapped points plus a
 * fixed padding margin — see pointsToBox() below.
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
      // box_prompts is the one spatial-prompt mechanism verified to actually
      // influence this model's output (see this file's top-of-file comment
      // for the live re-verification) — used both for the automatic
      // lower-frame box and the manual-assist tap-derived box.
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

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

// Padding around the taps' enclosing box, as a fraction of the frame's
// width/height. Verified live (see top-of-file comment): a single box
// enclosing 2-3 taps plus this padding segments reliably (scores ~0.88-0.99,
// sane coverage) — small per-tap boxes did not.
const TAP_BOX_PADDING = 0.06;

/** Builds a single box (pixel coords) enclosing all of the user's tapped
 * points, expanded by TAP_BOX_PADDING. Manual mask-assist's point -> box
 * translation — see this file's top comment for why one enclosing box
 * rather than one small box per point. */
function pointsToBox(points, width, height) {
  const xs = points.map((p) => clamp01(Number(p.x)));
  const ys = points.map((p) => clamp01(Number(p.y)));
  const minX = clamp01(Math.min(...xs) - TAP_BOX_PADDING);
  const maxX = clamp01(Math.max(...xs) + TAP_BOX_PADDING);
  const minY = clamp01(Math.min(...ys) - TAP_BOX_PADDING);
  const maxY = clamp01(Math.max(...ys) + TAP_BOX_PADDING);
  return {
    xMin: Math.round(minX * width),
    yMin: Math.round(minY * height),
    xMax: Math.round(maxX * width),
    yMax: Math.round(maxY * height),
  };
}

/**
 * @param {string} photoDataUrl
 * @param {Array<{x:number,y:number}>|null} [points] - manual mask-assist
 *   taps (spec 3.1), normalized [0,1] coordinates relative to the photo as
 *   displayed to the user. When present (>=2 points), these replace the
 *   automatic lower-frame box with a box enclosing the taps instead.
 * @returns {Promise<{
 *   photo: string, mask: string|null, width: number, height: number,
 *   confidence: number|null, maskAreaPct: number, needsManualAssist: boolean,
 *   reason: string|null,
 * }>}
 */
export async function segmentFloor(photoDataUrl, points = null) {
  // The client always calls this with `data.originalImage` (calculator/
  // visualizer-gl.js's loadPhoto) — for a brand-new, not-yet-persisted
  // photo that's an inline data: URL, but for ANY estimate that's already
  // been saved, lib/estimate-storage.js's hydrateEstimateImages() replaces
  // originalImage with a signed Supabase Storage HTTPS URL before the
  // client ever sees it. prepPhoto() (below) only accepts data: URLs and
  // throws otherwise — verified live: posting a real signed storage URL to
  // this endpoint returned needsManualAssist with reason "Photo must be a
  // data URL," i.e. segmentation silently never worked for a single saved
  // estimate. urlToDataUrl already does exactly the fetch-and-convert this
  // needs (it was written for the fal.ai *output* mask URL) — reuse it here
  // for the *input* photo too so both shapes work.
  const photo = await prepPhoto(await urlToDataUrl(photoDataUrl));

  // Manual mask-assist (spec 3.1): if the user tapped points on their own
  // floor, build one enclosing box from them instead of guessing. Otherwise
  // fall back to the v1 default — point_prompts don't work against the real
  // API (see this file's top comment) — approximate "floor is at the
  // bottom" with a full-width box over the lower ~55% of the frame, which is
  // where the floor plane sits in a typical straight-on garage/room photo.
  const box =
    Array.isArray(points) && points.length >= 2
      ? pointsToBox(points, photo.width, photo.height)
      : { xMin: 0, yMin: Math.round(photo.height * 0.45), xMax: photo.width, yMax: photo.height };

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
