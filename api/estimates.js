import { getUserFromRequest } from '../lib/auth-request.js';
import { createInstantSession } from '../lib/instant-auth.js';
import { generateAllEstimatePreviews, generateEstimatePreview } from '../lib/generate-estimate-preview.js';
import { friendlyPreviewErrorMessage } from '../lib/preview-images.js';
import { previewsNeedGeneration } from '../lib/preview-status.js';
import {
  estimateSummary,
  hydrateEstimateImages,
  persistEstimateImages,
  signedUrl,
} from '../lib/estimate-storage.js';
import { estimateColumnsFromPayload } from '../lib/estimate-columns.js';
import { loadEstimatePreviewPaths, pickEstimateThumbnailPath, syncEstimatePreviews } from '../lib/estimate-previews.js';
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

function rowToClient(row, hydratedPayload) {
  return {
    id: row.id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    email: row.email || hydratedPayload.email || hydratedPayload.meta?.email || null,
    location: row.location || hydratedPayload.location || hydratedPayload.meta?.location || null,
    userId: row.user_id,
    ...hydratedPayload,
  };
}

const ESTIMATE_COLUMNS =
  'id, created_at, updated_at, customer_name, email, location, user_id, project_name, finish, finish_label, pattern, pattern_label, base_color, base_color_label, base_color_hex, flake_color, flake_color_label, flake_color_hex, color_label, sq_ft, total_low, total_high, space_type, original_image_path, payload';

async function loadEstimateById(supabase, id) {
  const { data, error } = await supabase
    .from('estimates')
    .select(ESTIMATE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on Vercel.',
    });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const id = req.query?.id;

    if (id && typeof id === 'string') {
      try {
        const row = await loadEstimateById(supabase, id);
        if (!row) return res.status(404).json({ error: 'Estimate not found.' });

        // Generate here (not just via the owner's authenticated PATCH) so a
        // shared link works for anyone viewing it — a spouse or contractor
        // opening the link has no session, and would otherwise be stuck on
        // a spinner that can never complete (the PATCH path 401s for them).
        let previewError = null;
        if (previewsNeedGeneration(row.payload)) {
          try {
            const generated = await generateAllEstimatePreviews(supabase, row.user_id, id, row);
            row.payload = { ...row.payload, previews: generated.previews, previewPaths: generated.previewPaths, previewError: null };
          } catch (previewErr) {
            console.error('On-demand preview generation failed:', previewErr.message);
            previewError = friendlyPreviewErrorMessage(previewErr.message);
          }
        }

        const previewPaths =
          row.payload?.previewPaths?.length > 0
            ? row.payload.previewPaths
            : await loadEstimatePreviewPaths(supabase, id);
        const hydrated = await hydrateEstimateImages(supabase, {
          ...row.payload,
          previewPaths,
        });
        if (previewError) hydrated.previewError = previewError;
        return res.status(200).json(rowToClient(row, hydrated));
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Failed to load estimate.' });
      }
    }

    const auth = await getUserFromRequest(req);
    if (!auth) return res.status(401).json({ error: 'Sign in required.' });

    try {
      const { data, error } = await supabase
        .from('estimates')
        .select(ESTIMATE_COLUMNS)
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const estimates = await Promise.all(
        (data || []).map(async (row) => {
          let thumbnail = null;
          const previewPaths =
            row.payload?.previewPaths?.length > 0
              ? row.payload.previewPaths
              : await loadEstimatePreviewPaths(supabase, row.id);
          const thumbPath = pickEstimateThumbnailPath(row, previewPaths);
          if (thumbPath) {
            try {
              thumbnail = await signedUrl(supabase, thumbPath, 60 * 60);
            } catch {
              /* optional thumbnail */
            }
          }
          return {
            id: row.id,
            createdAt: row.created_at,
            customerName: row.customer_name,
            email: row.email,
            location: row.location,
            thumbnail,
            previewCount: previewPaths.length,
            ...estimateSummary(row.payload, row),
          };
        }),
      );

      return res.status(200).json({ estimates });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to list estimates.' });
    }
  }

  if (req.method === 'POST') {
    let auth = await getUserFromRequest(req);
    let sessionTokens = null;

    const body = req.body || {};
    const demoEmail = String(body.email || body.demoSignIn?.email || '').trim().toLowerCase();
    const demoName = String(body.customerName || body.demoSignIn?.name || '').trim();

    if (!auth && demoEmail) {
      try {
        const session = await createInstantSession(supabase, demoEmail, demoName);
        auth = { user: session.user, token: session.access_token };
        sessionTokens = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        };
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Could not set up your account.' });
      }
    }

    if (!auth) return res.status(401).json({ error: 'Sign in required.' });

    try {
      const { payload, customerName, email, location } = body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Estimate payload is required.' });
      }

      const contactEmail = (email || payload.email || payload.meta?.email || auth.user.email || '')
        .trim()
        .toLowerCase();

      const estimate = await saveEstimateForUser(supabase, auth.user.id, {
        payload,
        customerName,
        email: contactEmail,
        location,
      });

      return res.status(201).json({
        id: estimate.id,
        createdAt: estimate.createdAt,
        estimate,
        ...(sessionTokens || {}),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to save estimate.' });
    }
  }

  if (req.method === 'PATCH') {
    const auth = await getUserFromRequest(req);
    if (!auth) return res.status(401).json({ error: 'Sign in required.' });

    const id = req.query?.id;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Estimate id is required.' });
    }

    try {
      const row = await loadEstimateById(supabase, id);
      if (!row) return res.status(404).json({ error: 'Estimate not found.' });
      if (row.user_id !== auth.user.id) {
        return res.status(403).json({ error: 'Not allowed to update this estimate.' });
      }

      const body = req.body || {};

      if (body.generatePreview) {
        const angleId = String(body.generatePreview);
        const generated = await generateEstimatePreview(
          supabase,
          auth.user.id,
          id,
          angleId,
          row,
        );
        return res.status(200).json({ preview: generated });
      }

      if (body.generateAllPreviews === true) {
        const generated = await generateAllEstimatePreviews(
          supabase,
          auth.user.id,
          id,
          row,
        );
        return res.status(200).json({ previews: generated.previews, previewPaths: generated.previewPaths });
      }

      const mergedPayload = {
        ...row.payload,
        ...(body.payload && typeof body.payload === 'object' ? body.payload : {}),
      };

      if (Array.isArray(body.previews)) {
        mergedPayload.previews = body.previews;
      }

      const storedPayload = await persistEstimateImages(
        supabase,
        auth.user.id,
        id,
        mergedPayload,
      );

      const { error } = await supabase
        .from('estimates')
        .update({
          payload: storedPayload,
          updated_at: new Date().toISOString(),
          ...estimateColumnsFromPayload(storedPayload),
        })
        .eq('id', id)
        .eq('user_id', auth.user.id);

      if (error) throw error;

      await syncEstimatePreviews(supabase, id, storedPayload.previewPaths || []);
      return res.status(200).json({ id, ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to update estimate.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
