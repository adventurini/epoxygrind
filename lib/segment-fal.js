/**
 * Floor segmentation. PRIMARY mechanism (this pass): recolor-then-threshold
 * via fal.ai's image-EDITING model (lib/fal.js's editImagesWithFal(),
 * `fal-ai/nano-banana/edit` — the same model that powers the gen-AI floor
 * preview feature). Direct photographic evidence this session confirmed the
 * previous mechanism (SAM 3 hosted segmentation, box_prompts over the lower
 * frame + a "floor" text prompt) systematically fails on large/deep rooms:
 * it confidently captures the near/foreground floor but fails to extend the
 * mask into the far portion of the SAME contiguous floor (different due to
 * distance/perspective/lighting) — leaving the back half of large rooms
 * uncoated in the composite, even though it's obviously one floor to a
 * human. A manual experiment proved a much more robust fix: ask the
 * image-EDIT model to recolor ONLY the floor to a distinct magenta/pink hue
 * — using its full learned scene understanding rather than a crude spatial
 * box — then threshold the result by HUE (not exact RGB, since real
 * lighting variation means the "magenta" floor isn't one flat color)
 * server-side into a binary mask.
 *
 * Verified this pass, against real photos (see maskFromRecolor() below for
 * the actual thresholding, and this repo's scripts/tmp-viz-qa/ for the raw
 * test harness used — not part of the shipped app):
 *   - On the actual photo that exposed the bug (a two-story-foyer/stairs/
 *     open-kitchen room), the new mask extends cleanly across the ENTIRE
 *     floor — past the stairs, to the far entry doors, into the kitchen —
 *     where the old SAM-3 box mechanism stopped roughly halfway. This is
 *     the core bug fix, confirmed visually (rendered mask overlay), not
 *     just by a maskAreaPct number going up.
 *   - Furniture bleed (recoloring a chair/table/rug, not just the floor) is
 *     real but photo-dependent: on a dark real dining-room photo (table +
 *     6 leather chairs + rug), the recolor prompt below correctly left all
 *     of them untouched and the resulting mask never included them.
 *   - The failure mode that replaces the old one: on a tall room with large
 *     expanses of neutral-colored wall/ceiling (a warehouse-style space
 *     with white walls + black steel), the model sometimes washes a faint
 *     magenta tint over WALLS AND CEILING too, not just the floor — enough
 *     to trip a naive low-saturation hue threshold and merge into one
 *     "clean-looking" but wrong mask covering most of the frame. Prompt
 *     iteration (explicit "zero tint elsewhere," naming every surface)
 *     measurably reduced but did NOT fully eliminate this on the one hard
 *     photo that showed it. MAX_MASK_AREA_PCT below exists specifically to
 *     catch this: a floor mask covering an implausibly large fraction of
 *     the frame is far more likely to be exactly this failure than a real
 *     floor, so it's routed to needsManualAssist rather than composited.
 *   - Saturation after recolor varies a LOT by photo (observed medians from
 *     ~0.14 on a evenly-lit polished-concrete great room to ~0.5+ on a
 *     garage slab) — there is no clean fixed threshold that separates
 *     "real, if muted, floor recolor" from "faint wall/ceiling bleed" in
 *     every photo (their ranges overlap). SAT_MIN below is deliberately
 *     permissive (tuned to the low end, ~0.08) so the muted-floor case
 *     still gets a real mask; MAX_MASK_AREA_PCT plus the existing
 *     DOMINANT_FRACTION_MIN fragmentation gate are the safety net for the
 *     bleed case instead of trying to find one saturation cutoff that does
 *     both jobs.
 *   - Latency is materially worse: an image-EDIT generation call, not a
 *     lightweight segmentation call. Measured this pass (13 real calls
 *     against fal-ai/nano-banana/edit): 7.7s–11.8s, ~9.1s typical. The old
 *     SAM-3 path measured 0.6–0.7s on the same photos — roughly a 13x
 *     latency increase. api/segment.js's maxDuration was bumped from 30s to
 *     45s accordingly (comfortable margin over the observed range; still
 *     well under fal.ai's own 120s client-side fetch timeout in lib/fal.js,
 *     which only matters if Vercel doesn't kill the function first).
 *
 * SAM 3 (below, `fal-ai/sam-3/image`) is kept, not deleted, for two narrower
 * roles where it still fits well: (a) manual mask-assist taps (spec 3.1) —
 * a user's tapped points map naturally onto box_prompts, and there's no
 * equivalent "point hint" for an image-edit recolor call; (b) a fallback if
 * the recolor call fails outright (network error, timeout, a content-policy
 * rejection — hit once during this pass with earlier prompt wording, which
 * is part of why the shipped prompt below is phrased as a literal
 * photo-editing instruction rather than anything that could read as
 * generating a stylized image). A recolor call that SUCCEEDS but produces a
 * bad mask (fragmented/too-small/too-large) does NOT fall back to SAM-3 —
 * that path has its own version of the exact bug this pass fixes, so
 * falling back to it on a quality rejection would silently reintroduce the
 * bug on the hardest photos. It only fires on a hard API failure.
 *
 * Everything below this point about SAM 3 (point_prompts being a silent
 * no-op, box_prompts being what actually works, one enclosing box per tap
 * rather than one box per point) is unchanged from the pass that built
 * manual mask-assist and is still accurate for the SAM-3 code paths that
 * remain:
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
import { editImagesWithFal } from './fal.js';

const FAL_RUN = 'https://fal.run';
const SEGMENT_MODEL = 'fal-ai/sam-3/image';

// Spec 3.1: "downscale longest edge to 1280px server-side." In practice the
// client already downscales to <=960px before upload (calculator/calculator.js
// setPhoto), so this mostly matters for images that arrive some other way
// (e.g. a future re-segment of a stored full-res original) — cheap safety
// net either way.
const MAX_EDGE = 1280;

// Spec 3.1: "If confidence low or mask < 15% of image area, return
// needsManualAssist: true." (MIN_CONFIDENCE only applies to the SAM-3 code
// paths below -- the recolor approach has no equivalent model confidence
// score, so its quality gates are purely mask-shape-based; see
// MAX_MASK_AREA_PCT and DOMINANT_FRACTION_MIN.)
const MIN_MASK_AREA_PCT = 0.15;
const MIN_CONFIDENCE = 0.5;

// A floor mask covering an implausibly large fraction of the frame is far
// more likely to be the recolor-bleed failure mode (see top-of-file
// comment: the model washing a faint tint over walls/ceiling too on some
// photos) than a real floor -- these estimator photos are shot with the
// floor filling roughly the lower half-to-two-thirds of frame, not nearly
// the whole image. Calibrated against this pass's real test photos: the
// best-case CLEAN results topped out at 77% (a very deep, wide-open great
// room); the one confirmed bleed failure hit 85-95% depending on prompt
// version. 0.85 sits with margin below the bad case while still clearing
// the widest clean room tested.
const MAX_MASK_AREA_PCT = 0.85;

// --- Recolor-then-floor-hue-threshold (primary segmentation mechanism) ----
//
// Explicit photo-editing framing (not "apply a filter" / "stylize") and
// naming every other surface by name is deliberate: an earlier, vaguer
// prompt (no explicit furniture/wall/ceiling exclusion) both bled onto
// non-floor surfaces more, on average, across this pass's test photos AND
// once tripped fal.ai's content-policy rejection outright (verified live).
// This wording was re-verified against every photo in this pass's test set
// with no rejections.
const RECOLOR_PROMPT = `This is a precise photo-editing task, not a stylistic filter. In this photo, identify the exact boundary where the floor meets the walls, baseboards, and any structural columns or furniture resting on it. Recolor ONLY the pixels of the bare floor material below that boundary to a vivid, saturated magenta/pink dye color, as if the floor itself were dyed that color. Preserve all existing shadow, highlight, and reflection detail on the floor exactly as bright or dark as it currently is.

Every pixel above or outside that floor boundary — walls, ceiling, structural beams and columns, stairs, railings, doors, windows, cabinets, countertops, and any furniture or rugs resting on the floor — must remain pixel-for-pixel identical to the original photo, with absolutely zero color shift, tint, or wash applied to them. Do not apply any global color grade, filter, or lighting change to the whole image. Only the floor material changes color; nothing else in the image changes at all.`;

const RECOLOR_TIMEOUT_MS = 60_000;

// Hue band the recolor model's magenta/pink output actually lands in
// (measured this pass across several real photos: floor hue consistently
// ~300-355°, regardless of how saturated/muted that particular photo's
// recolor came out). Saturation is the permissive one deliberately -- see
// top-of-file comment on why a single global cutoff can't cleanly separate
// "muted but real floor" from "faint bleed" in every photo, and why
// MAX_MASK_AREA_PCT + DOMINANT_FRACTION_MIN carry that weight instead.
const HUE_LO = 300;
const HUE_HI = 360;
const SAT_MIN = 0.08;
const LIGHTNESS_MIN = 0.15;
const LIGHTNESS_MAX = 0.95;

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return [h, s, l];
}

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

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

// --- Connected-component mask cleanup (fixes bad/fragmented masks on
// complex multi-room photos) --------------------------------------------
//
// Root-cause investigation (this pass): on a real two-story-foyer/stairs/
// open-kitchen photo, the v1 pipeline (single box_prompts over the lower
// frame, "floor" text prompt) came back with confidence 0.97+ but a mask
// that was two disconnected blobs — the main room's floor PLUS a separate
// patch of a different room's floor visible through a doorway/archway —
// each blob itself riddled with small holes from furniture/rugs. Verified
// this is NOT a box-choice problem: tried the same photo with box_prompts
// over the full frame, the lower third, and the lower ~55% (current
// default), plus prompt variants ("floor", "hardwood floor", "walkable
// floor area") and return_multiple_masks/max_masks=3 — EVERY variant found
// the same two disconnected floor regions in comparable proportions
// (dominant region only ~56-75% of all "floor" pixels the model found; see
// keepLargestFloorComponent's dominantFraction below). The full
// -frame box was measurably worse (more noise, only 56% dominant) so it's
// not used as the default. What actually varies the outcome is what we do
// with the mask AFTER it comes back — hence this post-process step,
// entirely server-side, no extra fal.ai calls.
//
// The fix: label the mask's connected components and keep ONLY the
// largest one. A convincing composite needs one contiguous floor region
// anyway (spec's whole homography/tiling pipeline assumes a single quad) —
// a second disconnected room glimpsed through a doorway was never
// something the compositor could paint sensibly regardless of mask
// quality. This also gives a real fragmentation signal (see
// DOMINANT_FRACTION_MIN below) instead of just confidence + raw coverage,
// which is what previously let a fragmented-but-large mask slip through.
//
// The one wrinkle: real single-room floors sometimes have a hairline
// feature (a control-joint crack, a grout line, a shadow seam) that SAM's
// mask renders as a 1-2px gap, splitting one physical floor into two
// mask blobs of comparable size — verified against the site's own
// "sample-residential-bare.jpg" QA photo (has a visible floor crack down
// the middle): its raw mask is 51.8%/48.0% split, which a naive "biggest
// blob only" rule would wrongly gut in half. Fixed by using a "closed"
// (blurred + re-thresholded) copy of the mask ONLY to decide which pixels
// are connected to which — a small Gaussian blur bridges a 1-2px crack
// gap but leaves a real inter-room gap (tens of px wide, a wall/doorway)
// unbridged. Verified empirically on both photos: sigma=8-24 fully merges
// the residential crack into one component (100% dominant) while the
// complex two-room photo stays split (72-75%) even at sigma=24 — wide
// margin either side of the sigma this file actually uses. The blur is
// NEVER applied to the mask pixels that get returned/used — it only
// decides grouping; the returned mask keeps the original crisp pixels of
// whichever pixels belong to the dominant group.
const CLOSE_SIGMA_FRACTION = 0.01; // ~1% of mask width
const CLOSE_SIGMA_MIN = 6;
const CLOSE_SIGMA_MAX = 20;
const CLOSE_THRESHOLD = 100; // blurred greyscale value counted as "still floor" post-blur

// Largest component must hold at least this fraction of ALL mask pixels
// the model found, or the scene is genuinely ambiguous/split (two
// comparably-sized floor regions) rather than one floor with some noise —
// verified: the 3 clean single-room QA photos (garage/commercial/
// industrial, one already has a crack-split mask) all close to ~100%
// dominant; the confirmed-bad complex multi-room photo tops out at 75.5%
// even under the widest closing tried. 0.85 sits with real margin on both
// sides of that gap.
const DOMINANT_FRACTION_MIN = 0.85;

/** Iterative (non-recursive — avoids stack-depth blowups on a ~1MP mask)
 * 4-connected flood-fill labeling. Returns {labels, sizes} where labels[i]
 * is the component id of lit pixel i (or -1 if not lit) and sizes[c] is
 * component c's pixel count. */
function labelComponents(litBuffer, width, height) {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  const sizes = [];
  let nextLabel = 0;
  for (let start = 0; start < total; start++) {
    if (!litBuffer[start] || labels[start] !== -1) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = nextLabel;
    let size = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      size++;
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > 0 && litBuffer[idx - 1] && labels[idx - 1] === -1) { labels[idx - 1] = nextLabel; stack[sp++] = idx - 1; }
      if (x < width - 1 && litBuffer[idx + 1] && labels[idx + 1] === -1) { labels[idx + 1] = nextLabel; stack[sp++] = idx + 1; }
      if (y > 0 && litBuffer[idx - width] && labels[idx - width] === -1) { labels[idx - width] = nextLabel; stack[sp++] = idx - width; }
      if (y < height - 1 && litBuffer[idx + width] && labels[idx + width] === -1) { labels[idx + width] = nextLabel; stack[sp++] = idx + width; }
    }
    sizes.push(size);
    nextLabel++;
  }
  return { labels, sizes };
}

/**
 * Cleans a raw SAM mask down to its single largest connected floor region
 * (see the block comment above for why and how this was verified). Never
 * throws — a malformed/undecodable mask just reports 0 area so the normal
 * tooSmall gate below catches it.
 * @param {Buffer} maskPngBuffer
 * @returns {Promise<{cleanedPngBuffer: Buffer, maskAreaPct: number, dominantFraction: number, componentCount: number}>}
 */
async function keepLargestFloorComponent(maskPngBuffer) {
  const { data: rawData, info } = await sharp(maskPngBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;

  const origLit = new Uint8Array(total);
  let totalLit = 0;
  for (let i = 0; i < total; i++) {
    if (rawData[i] > 128) {
      origLit[i] = 1;
      totalLit++;
    }
  }
  if (totalLit === 0) {
    return { cleanedPngBuffer: maskPngBuffer, maskAreaPct: 0, dominantFraction: 0, componentCount: 0 };
  }

  const sigma = Math.min(CLOSE_SIGMA_MAX, Math.max(CLOSE_SIGMA_MIN, width * CLOSE_SIGMA_FRACTION));
  const { data: closedData } = await sharp(maskPngBuffer).greyscale().blur(sigma).raw().toBuffer({ resolveWithObject: true });
  const closedLit = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (closedData[i] > CLOSE_THRESHOLD) closedLit[i] = 1;
  }

  const { labels, sizes } = labelComponents(closedLit, width, height);
  if (sizes.length === 0) {
    return { cleanedPngBuffer: maskPngBuffer, maskAreaPct: 0, dominantFraction: 0, componentCount: 0 };
  }

  let dominantLabel = 0;
  let dominantSize = -1;
  for (let l = 0; l < sizes.length; l++) {
    if (sizes[l] > dominantSize) {
      dominantSize = sizes[l];
      dominantLabel = l;
    }
  }

  // Build the cleaned mask from the ORIGINAL (unblurred) lit pixels that
  // fall inside the dominant closed-component — the closing only decided
  // grouping, the output mask keeps real edges.
  const cleaned = Buffer.alloc(total);
  let dominantOrigCount = 0;
  for (let i = 0; i < total; i++) {
    if (origLit[i] && labels[i] === dominantLabel) {
      cleaned[i] = 255;
      dominantOrigCount++;
    }
  }

  const cleanedPngBuffer = await sharp(cleaned, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return {
    cleanedPngBuffer,
    maskAreaPct: dominantOrigCount / total,
    dominantFraction: dominantOrigCount / totalLit,
    componentCount: sizes.length,
  };
}

/**
 * Recolors ONLY the floor to magenta/pink via fal.ai's image-edit model,
 * then thresholds the result by HSL hue into a binary mask. This is the
 * primary segmentation mechanism (see top-of-file comment for why it
 * replaced SAM-3's box_prompts as the default).
 *
 * Reuses labelComponents() and the CLOSE_SIGMA / CLOSE_THRESHOLD constants from
 * keepLargestFloorComponent() above (same hairline-crack-vs-real-gap
 * closing logic, verified separately this pass to also correctly leave a
 * real furniture footprint as an unfilled hole rather than painting over
 * it — see top-of-file comment).
 *
 * Deliberately different from keepLargestFloorComponent() in one respect:
 * the OUTPUT mask is the CLOSED dominant-component shape itself, not a
 * crisp intersection with the raw hue-matched pixels. SAM's native masks
 * are already clean, so keepLargestFloorComponent() rightly preserves their
 * crisp edges and only uses closing to decide grouping. The hue-threshold
 * mask is different: verified visually this pass that the crisp
 * intersection left real floors speckled with small unpainted holes from
 * marginal-saturation spots (reflections, slightly-under-recolored
 * patches) that the closing pass was already correctly bridging for
 * grouping purposes anyway — using that closed shape as the actual output
 * removes the speckling with no observed downside (a real furniture-sized
 * hole is far larger than the closing radius and stays a hole either way).
 * @param {string} recoloredDataUrl
 * @returns {Promise<{cleanedPngBuffer: Buffer|null, maskAreaPct: number, dominantFraction: number, componentCount: number}>}
 */
async function maskFromRecolor(recoloredDataUrl) {
  const parsed = parseDataUrl(recoloredDataUrl);
  if (!parsed) {
    return { cleanedPngBuffer: null, maskAreaPct: 0, dominantFraction: 0, componentCount: 0 };
  }

  const { data, info } = await sharp(parsed.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const total = width * height;

  const lit = new Uint8Array(total);
  let litCount = 0;
  for (let i = 0; i < total; i++) {
    const o = i * channels;
    const [h, s, l] = rgbToHsl(data[o], data[o + 1], data[o + 2]);
    if (h >= HUE_LO && h <= HUE_HI && s >= SAT_MIN && l >= LIGHTNESS_MIN && l <= LIGHTNESS_MAX) {
      lit[i] = 1;
      litCount++;
    }
  }
  if (litCount === 0) {
    return { cleanedPngBuffer: null, maskAreaPct: 0, dominantFraction: 0, componentCount: 0 };
  }

  const litPng = await sharp(Buffer.from(lit.map((v) => v * 255)), { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  const sigma = Math.min(CLOSE_SIGMA_MAX, Math.max(CLOSE_SIGMA_MIN, width * CLOSE_SIGMA_FRACTION));
  const { data: closedData } = await sharp(litPng).greyscale().blur(sigma).raw().toBuffer({ resolveWithObject: true });
  const closedLit = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (closedData[i] > CLOSE_THRESHOLD) closedLit[i] = 1;
  }

  const { labels, sizes } = labelComponents(closedLit, width, height);
  if (sizes.length === 0) {
    return { cleanedPngBuffer: null, maskAreaPct: 0, dominantFraction: 0, componentCount: 0 };
  }

  let dominantLabel = 0;
  let dominantSize = -1;
  for (let l = 0; l < sizes.length; l++) {
    if (sizes[l] > dominantSize) {
      dominantSize = sizes[l];
      dominantLabel = l;
    }
  }

  const cleaned = Buffer.alloc(total);
  let dominantCount = 0;
  let dominantRawLitCount = 0;
  for (let i = 0; i < total; i++) {
    if (closedLit[i] && labels[i] === dominantLabel) {
      cleaned[i] = 255;
      dominantCount++;
      if (lit[i]) dominantRawLitCount++;
    }
  }

  const cleanedPngBuffer = await sharp(cleaned, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return {
    cleanedPngBuffer,
    maskAreaPct: dominantCount / total,
    dominantFraction: dominantRawLitCount / litCount,
    componentCount: sizes.length,
  };
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

  // Manual mask-assist (spec 3.1): the user's tapped points map naturally
  // onto SAM-3's box_prompts (see top-of-file comment on why that path is
  // kept for this one role) and don't have an equivalent in the recolor
  // approach, so this case is unchanged from before this pass.
  if (Array.isArray(points) && points.length >= 2) {
    return segmentFloorWithSam3(photo, pointsToBox(points, photo.width, photo.height));
  }

  // Primary path (this pass): recolor-then-hue-threshold. See top-of-file
  // comment for why this replaced SAM-3's box_prompts as the default, and
  // what was verified/measured about it.
  let recoloredDataUrl;
  try {
    recoloredDataUrl = await editImagesWithFal([photo.dataUrl], RECOLOR_PROMPT, { timeoutMs: RECOLOR_TIMEOUT_MS });
  } catch (err) {
    // Hard API failure (network error, timeout, a content-policy rejection
    // — hit once during this pass with earlier prompt wording). Fall back
    // to the old SAM-3 box-prompt path rather than an unhandled crash or an
    // immediate needsManualAssist: that path's failure mode is silently
    // WRONG on complex photos (the bug this pass fixes), not an outright
    // error, so it's still a reasonable single-fallback attempt when the
    // primary mechanism can't run at all.
    console.error('Recolor segmentation failed, falling back to SAM-3 box-prompt path:', err.message);
    return segmentFloorWithSam3(photo, {
      xMin: 0,
      yMin: Math.round(photo.height * 0.45),
      xMax: photo.width,
      yMax: photo.height,
    });
  }

  const { cleanedPngBuffer, maskAreaPct, dominantFraction } = await maskFromRecolor(recoloredDataUrl);
  const maskDataUrl = cleanedPngBuffer ? `data:image/png;base64,${cleanedPngBuffer.toString('base64')}` : null;

  const tooSmall = maskAreaPct < MIN_MASK_AREA_PCT;
  const tooLarge = maskAreaPct > MAX_MASK_AREA_PCT;
  // Fragmented: see keepLargestFloorComponent's comment above for how
  // DOMINANT_FRACTION_MIN was calibrated (a real bad multi-room SAM-3
  // result vs. clean single-room photos). Same signal, same threshold,
  // now computed from the hue-threshold mask's components instead.
  const fragmented = !tooSmall && !tooLarge && dominantFraction < DOMINANT_FRACTION_MIN;
  const needsManualAssist = !maskDataUrl || tooSmall || tooLarge || fragmented;

  return {
    photo: photo.dataUrl,
    mask: maskDataUrl,
    width: photo.width,
    height: photo.height,
    // The recolor approach has no equivalent to SAM-3's per-mask confidence
    // score — quality gating here is purely mask-shape-based (above).
    confidence: null,
    maskAreaPct,
    needsManualAssist,
    reason: needsManualAssist
      ? !maskDataUrl
        ? 'no-floor-detected'
        : tooSmall
          ? 'mask-too-small'
          : tooLarge
            ? 'mask-too-large'
            : 'fragmented-mask'
      : null,
  };
}

/**
 * SAM-3 box-prompt segmentation (the previous default, kept for manual
 * mask-assist taps and as a fallback on a hard recolor-API failure — see
 * top-of-file comment and segmentFloor() above).
 * @param {{dataUrl: string, width: number, height: number}} photo - already
 *   prepped (prepPhoto()) photo.
 * @param {{xMin:number, yMin:number, xMax:number, yMax:number}} box
 * @returns {Promise<{
 *   photo: string, mask: string|null, width: number, height: number,
 *   confidence: number|null, maskAreaPct: number, needsManualAssist: boolean,
 *   reason: string|null,
 * }>}
 */
async function segmentFloorWithSam3(photo, box) {
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

  const rawMaskDataUrl = await urlToDataUrl(maskItem.url);
  const rawMaskParsed = parseDataUrl(rawMaskDataUrl);
  const { cleanedPngBuffer, maskAreaPct, dominantFraction } = rawMaskParsed
    ? await keepLargestFloorComponent(rawMaskParsed.buffer)
    : { cleanedPngBuffer: null, maskAreaPct: 0, dominantFraction: 0 };
  const maskDataUrl = cleanedPngBuffer
    ? `data:image/png;base64,${cleanedPngBuffer.toString('base64')}`
    : rawMaskDataUrl;

  const lowConfidence = score != null && score < MIN_CONFIDENCE;
  const tooSmall = maskAreaPct < MIN_MASK_AREA_PCT;
  // Fragmented: the model found "floor" pixels scattered across more than
  // one substantial region (e.g. two rooms visible in one frame) rather
  // than one dominant floor — see this file's keepLargestFloorComponent
  // comment for how DOMINANT_FRACTION_MIN was calibrated against a real
  // bad multi-room photo vs. the 3 clean single-room QA photos. A
  // high-confidence, plenty-of-area mask that's actually two disconnected
  // floors is not usable for a convincing single-quad composite, so this
  // catches what confidence + raw area alone let through before.
  const fragmented = !tooSmall && dominantFraction < DOMINANT_FRACTION_MIN;
  const needsManualAssist = lowConfidence || tooSmall || fragmented;

  return {
    photo: photo.dataUrl,
    mask: maskDataUrl,
    width: photo.width,
    height: photo.height,
    confidence: score,
    maskAreaPct,
    needsManualAssist,
    reason: needsManualAssist ? (tooSmall ? 'mask-too-small' : lowConfidence ? 'low-confidence' : 'fragmented-mask') : null,
  };
}
