import {
  parseEstimateInput,
  buildPricingEstimate,
  buildPreviewImages,
  buildSinglePreview,
} from '../lib/build-estimate.js';
import { generateAllEstimatePreviews } from '../lib/generate-estimate-preview.js';
import { createInstantSession } from '../lib/instant-auth.js';
import { saveEstimateForUser } from '../lib/save-estimate.js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
  maxDuration: 300,
};

function slimPreviewContext(previewContext) {
  if (!previewContext) return null;
  const next = { ...previewContext };
  delete next.originalImage;
  delete next.heroImage;
  return next;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const phase =
      body.phase === 'build'
        ? 'build'
        : body.phase === 'previews'
          ? 'previews'
          : body.phase === 'preview'
            ? 'preview'
            : 'pricing';

    if (phase === 'preview') {
      const angleId = body.angleId;
      if (!angleId || !body.previewContext || typeof body.previewContext !== 'object') {
        return res.status(400).json({ error: 'angleId and previewContext are required.' });
      }
      const preview = await buildSinglePreview(angleId, body.previewContext);
      return res.status(200).json({ phase: 'preview', preview });
    }

    if (phase === 'previews') {
      if (!body.previewContext || typeof body.previewContext !== 'object') {
        return res.status(400).json({ error: 'previewContext is required for preview phase.' });
      }
      const previews = await buildPreviewImages(body.previewContext);
      return res.status(200).json({ phase: 'previews', previews });
    }

    const input = parseEstimateInput(body);

    if (phase === 'build') {
      if (!isSupabaseConfigured()) {
        return res.status(503).json({ error: 'Saving is not configured yet.' });
      }
      if (!input.email) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const supabase = getSupabase();
      const pricing = await buildPricingEstimate(input);
      const session = await createInstantSession(supabase, input.email, input.customerName);

      const savePayload = {
        analysis: pricing.analysis,
        pricing: pricing.pricing,
        design: pricing.design,
        meta: pricing.meta,
        previewContext: slimPreviewContext(pricing.previewContext),
        previews: [],
        originalImage: input.image,
        customerName: input.customerName,
        email: input.email,
        location: input.location,
      };

      let estimate;
      let saved = true;
      try {
        estimate = await saveEstimateForUser(supabase, session.user.id, {
          customerName: input.customerName,
          email: input.email,
          location: input.location,
          payload: savePayload,
        });
      } catch (saveErr) {
        console.error('Save failed, returning inline estimate:', saveErr.message);
        saved = false;
        estimate = {
          id: `local-${Date.now()}`,
          createdAt: new Date().toISOString(),
          customerName: input.customerName,
          email: input.email,
          location: input.location,
          userId: session.user.id,
          ...savePayload,
          saved: false,
        };
      }

      if (saved && estimate?.id) {
        try {
          const { data: row, error: rowError } = await supabase
            .from('estimates')
            .select('payload')
            .eq('id', estimate.id)
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (rowError) throw rowError;
          if (row?.payload) {
            const generated = await generateAllEstimatePreviews(
              supabase,
              session.user.id,
              estimate.id,
              row,
            );
            estimate.previews = generated.previews;
            estimate.previewPaths = generated.previewPaths;
          }
        } catch (previewErr) {
          console.error('Server preview generation failed:', previewErr.message);
          estimate.previewError = previewErr.message || 'Preview generation failed.';
        }
      }

      return res.status(201).json({
        phase: 'build',
        estimate,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    const estimate = await buildPricingEstimate(input);
    return res.status(200).json({ phase: 'pricing', ...estimate });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Estimate failed.' });
  }
}
