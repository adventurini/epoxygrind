import { calculateEstimate } from '../lib/pricing.js';
import { resolveDesign, buildDesignPrompt } from '../lib/finish-design.js';
import { analyzeSpaceImage } from '../lib/openai.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      image,
      finish = 'flake',
      baseColor = 'charcoal',
      flakeColor = 'gray-black',
      baseColorHex = '',
      flakeColorHex = '',
      pattern = '',
      customColorNote = '',
      sqFtOverride = null,
      lengthFt = null,
      widthFt = null,
      customerName = '',
      projectName = '',
    } = req.body || {};

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Photo is required.' });
    }

    const finishKey = ['solid', 'flake', 'metallic'].includes(finish) ? finish : 'flake';
    const design = resolveDesign({
      finish: finishKey,
      baseColor,
      flakeColor,
      baseColorHex,
      flakeColorHex,
      pattern,
      customColorNote,
    });

    const analysis = await analyzeSpaceImage(image, {
      finish: finishKey,
      sqFtOverride: sqFtOverride ? Number(sqFtOverride) : null,
      lengthFt: lengthFt ? Number(lengthFt) : null,
      widthFt: widthFt ? Number(widthFt) : null,
      designSummary: design.summary,
    });

    const sqFt =
      sqFtOverride ||
      (lengthFt && widthFt ? Number(lengthFt) * Number(widthFt) : null) ||
      analysis.estimatedSqFt ||
      400;

    const pricing = calculateEstimate(sqFt, finishKey, { design });

    return res.status(200).json({
      analysis: {
        ...analysis,
        estimatedSqFt: sqFt,
      },
      pricing,
      design,
      meta: {
        customerName,
        projectName,
        finish: finishKey,
        generatedAt: new Date().toISOString(),
        demoMode: !process.env.OPENAI_API_KEY && !process.env.OPENART_API_KEY,
      },
      previewContext: {
        spaceDescription: `${analysis.spaceType || 'Garage'}. ${analysis.analysisSummary || ''}`.trim(),
        finishLabel: pricing.finishLabel,
        finish: finishKey,
        designPrompt: buildDesignPrompt(design),
        baseColorHex: design.baseColorHex,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
}
