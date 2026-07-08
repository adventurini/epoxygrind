import { editImagesWithFal } from '../fal.js';
import { parseDataUrl } from '../estimate-storage.js';

const FLUX_EDIT_MODEL = 'fal-ai/flux-2/edit';
// Deliberately doesn't hardcode specific features like "glasses" — this
// prompt applies to BOTH reference masters (Grinder Dad wears glasses,
// the Pro does not), and a fixed literal trait not present in the
// reference photo actually in use gets grafted on anyway (confirmed real:
// the Pro came back wearing glasses because the old prompt hardcoded the
// word). Let the reference photo itself carry the specific details.
const CHARACTER_BLOCK = 'Same character, identical to the reference photo — same face, hair, and outfit exactly as shown there, nothing added or changed.';
// Slide 6 (both audiences) shows Grinder Dad and "the Pro" together —
// two distinct reference photos ride along on that call, so the prompt
// needs to describe two separate people instead of one.
const DUAL_CHARACTER_BLOCK = 'Two distinct characters together in the same scene — the first reference photo and the second reference photo, each kept identical to their own reference (own face, hair, and outfit exactly as shown), nothing added, changed, or merged between them.';
const STYLE_BLOCK = 'Illustrative flat-cartoon style, soft shading, clean simple background, consistent with the reference photo.';
// Anthony: "too big... about half the size, so we can put the caption
// above him" — the caption gets burned onto the top band of every slide
// (see compose-slide-image.js), so the character needs to physically fit
// in the lower portion of the frame, not the generation cropping it later.
const FRAMING_BLOCK = 'Full body shot, small within the frame — occupying roughly the bottom half of a tall vertical image, with the upper third to upper half left open/empty (plain background, no props) so text can go there.';

const BUCKET = 'content-images';

export function buildImagePrompt(scene, { dualCharacter = false } = {}) {
  const characterBlock = dualCharacter ? DUAL_CHARACTER_BLOCK : CHARACTER_BLOCK;
  return `${characterBlock} ${FRAMING_BLOCK} ${scene} ${STYLE_BLOCK} No text, no lettering.`;
}

/**
 * Generates one slide image via fal.ai's FLUX.2 edit endpoint, conditioned
 * on the single approved Grinder Dad reference image (spec §2.3 — no LoRA
 * training; the reference photo rides along on every call). Uploads the
 * result into the same content-images bucket already used for learn-
 * article hero images, under a carousel/ prefix.
 *
 * Takes an already-built `prompt` rather than a raw scene — regeneration
 * (spec §2.4) needs to reuse a PRIOR prompt plus a user delta rather than
 * re-deriving a fresh scene from scratch, so prompt construction lives
 * with each caller (buildImagePrompt() for fresh generations,
 * regenerate-slide-image.js appending a delta to a stored prompt).
 *
 * @param {{ masterUrls: string[], prompt: string, dayId: string, position: number, generationId: string }} opts
 * @returns {Promise<{ imageUrl: string }>}
 */
export async function generateSlideImage({ masterUrls, prompt, dayId, position, generationId }) {
  // sync_mode (always on inside editImagesWithFal) means fal returns the
  // image inline as a data: URI rather than a hosted URL — upload those
  // bytes ourselves rather than depending on fal's own hosting long-term.
  const result = await editImagesWithFal(masterUrls, prompt, {
    model: FLUX_EDIT_MODEL,
    image_size: { width: 1080, height: 1350 }, // spec §3 export canvas — flux-2/edit only honors this exact shape, not aspect_ratio
    returnUrl: true,
    timeoutMs: 120_000,
  });

  const parsed = parseDataUrl(result);
  if (!parsed) throw new Error('Expected an inline image from fal.ai but got something else.');

  const ext = parsed.contentType.includes('png') ? 'png' : 'jpg';
  const objectPath = `carousel/generations/${dayId}/${position}-${generationId}.${ext}`;

  const upRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type': parsed.contentType,
      'x-upsert': 'true',
    },
    body: parsed.buffer,
  });
  if (!upRes.ok) throw new Error(`Image upload failed: ${upRes.status} ${await upRes.text()}`);

  const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  return { imageUrl, prompt };
}
