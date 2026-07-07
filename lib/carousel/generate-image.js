import { editImagesWithFal } from '../fal.js';
import { parseDataUrl } from '../estimate-storage.js';

const FLUX_EDIT_MODEL = 'fal-ai/flux-2/edit';
const CHARACTER_BLOCK = 'Same character, identical face, hair, glasses, and outfit.';
const STYLE_BLOCK = 'Illustrative flat-cartoon style, soft shading, clean simple background, consistent with the reference photo.';

const BUCKET = 'content-images';

export function buildImagePrompt(scene) {
  return `${CHARACTER_BLOCK} ${scene} ${STYLE_BLOCK} No text, no lettering.`;
}

/**
 * Generates one slide image via fal.ai's FLUX.2 edit endpoint, conditioned
 * on the single approved Grinder Dad reference image (spec §2.3 — no LoRA
 * training; the reference photo rides along on every call). Uploads the
 * result into the same content-images bucket already used for learn-
 * article hero images, under a carousel/ prefix.
 *
 * @param {{ masterUrl: string, scene: string, dayId: string, position: number, generationId: string, supabase: import('@supabase/supabase-js').SupabaseClient }} opts
 * @returns {Promise<{ imageUrl: string, prompt: string }>}
 */
export async function generateSlideImage({ masterUrl, scene, dayId, position, generationId, supabase }) {
  const prompt = buildImagePrompt(scene);

  // sync_mode (always on inside editImagesWithFal) means fal returns the
  // image inline as a data: URI rather than a hosted URL — upload those
  // bytes ourselves rather than depending on fal's own hosting long-term.
  const result = await editImagesWithFal([masterUrl], prompt, {
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
