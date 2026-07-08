import {
  parseEstimateInput,
  buildPricingEstimate,
  buildPreviewImages,
  buildSinglePreview,
} from '../lib/build-estimate.js';
import { createInstantSession } from '../lib/instant-auth.js';
import { saveEstimateForUser } from '../lib/save-estimate.js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';
import { spendCredit } from '../lib/credits.js';
import { resolveDesign, buildDesignPrompt } from '../lib/finish-design.js';
import { calculateEstimate } from '../lib/pricing.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
  maxDuration: 120,
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
        : body.phase === 'generate'
          ? 'generate'
          : body.phase === 'previews'
            ? 'previews'
            : body.phase === 'preview'
              ? 'preview'
              : body.phase === 'redesign'
                ? 'redesign'
                : 'pricing';

    if (phase === 'redesign') {
      // Recompute pricing + regenerate the one preview image for an
      // *existing* estimate with new finish/pattern/color choices — reuses
      // the already-known photo, space description, and market rates
      // instead of re-running photo analysis or re-fetching regional
      // pricing (those don't depend on the design choice).
      if (!body.originalImage || typeof body.originalImage !== 'string') {
        return res.status(400).json({ error: 'Missing original photo.' });
      }
      const sqFt = Number(body.sqFt);
      if (!sqFt || sqFt <= 0) {
        return res.status(400).json({ error: 'Missing square footage.' });
      }

      const finishKey = ['solid', 'flake', 'metallic'].includes(body.finish) ? body.finish : 'flake';
      const coatingType = body.coatingType === 'polyaspartic' ? 'polyaspartic' : 'epoxy';
      const design = resolveDesign({
        finish: finishKey,
        baseColor: body.baseColor,
        flakeColor: body.flakeColor,
        pattern: body.pattern,
      });

      const pricing = calculateEstimate(sqFt, finishKey, {
        design,
        regionalRates: body.regionalRates && typeof body.regionalRates === 'object' ? body.regionalRates : null,
        coatingType,
      });

      const previewContext = {
        originalImage: body.originalImage,
        spaceDescription: String(body.spaceDescription || ''),
        finishLabel: pricing.finishLabel,
        finish: finishKey,
        design,
        designPrompt: buildDesignPrompt(design),
        baseColorHex: design.baseColorHex,
        flakeColorHex: design.flakeColorHex,
      };

      const preview = await buildSinglePreview('original', previewContext);

      return res.status(200).json({
        phase: 'redesign',
        pricing,
        design,
        preview,
        previewContext: slimPreviewContext(previewContext),
      });
    }

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

    if (phase === 'generate') {
      // Anonymous: photo analysis + pricing, no Supabase writes at all. The
      // client holds this until (if) the user unlocks the full result with
      // their email, at which point it's sent back as `precomputed` to
      // phase:'build' rather than recomputed.
      //
      // No gen-AI preview image here anymore — the results view composites
      // the floor live client-side (WebGL visualizer,
      // epoxygrind-visualizer-build-spec.md Part 3) once it mounts, instead
      // of this endpoint paying for a fal.ai edit call on every estimate.
      // buildSinglePreview/editImagesWithFal still exist and work fine —
      // they're just no longer called from the estimator's live path (kept
      // for marketing hero-shot generation and other callers per spec).
      const pricing = await buildPricingEstimate(input);

      return res.status(200).json({
        phase: 'generate',
        analysis: pricing.analysis,
        pricing: pricing.pricing,
        design: pricing.design,
        previewContext: slimPreviewContext(pricing.previewContext),
        meta: pricing.meta,
      });
    }

    if (phase === 'build') {
      if (!isSupabaseConfigured()) {
        return res.status(503).json({ error: 'Saving is not configured yet.' });
      }
      if (!input.email) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const supabase = getSupabase();
      const session = await createInstantSession(supabase, input.email, input.customerName);

      const spend = await spendCredit(supabase, session.user.id);
      if (!spend.ok) {
        return res.status(402).json({
          error: "You've used all your free estimates.",
          code: 'OUT_OF_CREDITS',
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }

      const precomputed = body.precomputed && typeof body.precomputed === 'object' ? body.precomputed : null;
      const pricing = precomputed || (await buildPricingEstimate(input));

      const savePayload = {
        analysis: pricing.analysis,
        pricing: pricing.pricing,
        design: pricing.design,
        meta: { ...pricing.meta, customerName: input.customerName, email: input.email, location: input.location },
        previewContext: slimPreviewContext(pricing.previewContext),
        previews: precomputed?.preview
          ? [{ id: precomputed.preview.id, label: precomputed.preview.label, image: precomputed.preview.image }]
          : [],
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

      // If `precomputed` wasn't supplied (e.g. a direct/legacy call), the
      // preview image hasn't been generated yet — the client kicks off a
      // PATCH to /api/estimates right after this returns to fill it in.

      return res.status(201).json({
        phase: 'build',
        estimate,
        creditsRemaining: spend.creditsRemaining,
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
