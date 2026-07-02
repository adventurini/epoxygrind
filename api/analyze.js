import { parseEstimateInput, buildPricingEstimate } from '../lib/build-estimate.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

/** @deprecated Use POST /api/estimate — kept for compatibility */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const input = parseEstimateInput(req.body || {});
    const estimate = await buildPricingEstimate(input);
    return res.status(200).json({
      ...estimate,
      previewContext: estimate.previewContext,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
}
