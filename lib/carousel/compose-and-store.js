import { composeSlideImage } from './compose-slide-image.js';

const BUCKET = 'content-images';

/**
 * Fetches a raw generated slide image, burns the caption onto it, and
 * uploads the flattened result — the I/O wrapper around the pure
 * compose-slide-image.js compositor. Used both right after generation and
 * whenever a caption is edited afterward (see api/admin/carousel/slide.js).
 * @returns {Promise<string>} public URL of the composited final image
 */
export async function composeAndStoreFinal({ imageUrl, caption, dayId, position }) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Could not fetch base image: ${imgRes.status}`);
  const baseImageBuffer = Buffer.from(await imgRes.arrayBuffer());

  const composited = await composeSlideImage({ baseImageBuffer, caption });

  const objectPath = `carousel/finals/${dayId}/${position}.jpg`;
  const upRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: composited,
  });
  if (!upRes.ok) throw new Error(`Final image upload failed: ${upRes.status} ${await upRes.text()}`);

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}
