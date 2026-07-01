import { ANGLE_VIEWS, generateAnglePreview } from '../lib/openai.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { angleId, spaceDescription, finishLabel, finish, designPrompt, baseColorHex } = req.body || {};
    const angle = ANGLE_VIEWS.find((a) => a.id === angleId);

    if (!angle) {
      return res.status(400).json({ error: 'Invalid angle id.' });
    }

    const image = await generateAnglePreview({
      angle,
      spaceDescription: spaceDescription || 'Residential garage with concrete floor',
      finishLabel: finishLabel || 'Epoxy flake floor coating',
      finish: finish || 'flake',
      designPrompt: designPrompt || '',
      baseColorHex: baseColorHex || '',
    });

    return res.status(200).json({
      id: angle.id,
      label: angle.label,
      image,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Preview generation failed.' });
  }
}
