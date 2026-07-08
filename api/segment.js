import { segmentFloor } from '../lib/segment-fal.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
  maxDuration: 30,
};

/**
 * POST /api/segment — runs once per uploaded photo (visualizer-build-spec
 * Part 3.1). Everything downstream of this (blend/base coat/density/size
 * changes) is client-only from here on — this is the one network call in
 * the whole visualizer flow.
 *
 * Optional `points` body field (spec 3.1's manual mask-assist, now built):
 * an array of 2-3 `{x, y}` taps (normalized [0,1], relative to the photo as
 * shown to the user) the user placed on their own floor after the automatic
 * segmentation came back with `needsManualAssist: true`. See
 * lib/segment-fal.js's segmentFloor()/pointsToBox() for how these become a
 * box_prompts call.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  if (!body.image || typeof body.image !== 'string') {
    return res.status(400).json({ error: 'A photo is required.' });
  }

  let points = null;
  if (body.points !== undefined) {
    if (
      !Array.isArray(body.points) ||
      body.points.length < 2 ||
      body.points.length > 3 ||
      !body.points.every((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
    ) {
      return res.status(400).json({ error: 'points must be an array of 2-3 {x, y} taps.' });
    }
    points = body.points;
  }

  try {
    const result = await segmentFloor(body.image, points);
    // Always 200, even when needsManualAssist is true — a bad/low-confidence
    // mask isn't a server error, it's an expected outcome the client shows
    // a "try another photo" message for (spec Part 5 v1 simplification).
    return res.status(200).json(result);
  } catch (err) {
    console.error('Segmentation failed:', err);
    return res.status(200).json({
      photo: body.image,
      mask: null,
      width: null,
      height: null,
      confidence: null,
      maskAreaPct: 0,
      needsManualAssist: true,
      reason: err.message || 'segmentation-failed',
    });
  }
}
