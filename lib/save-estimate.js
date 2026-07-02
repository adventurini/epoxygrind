import { estimateColumnsFromPayload } from './estimate-columns.js';
import { syncEstimatePreviews } from './estimate-previews.js';
import { hydrateEstimateImages, persistEstimateImages } from './estimate-storage.js';

async function insertEstimateRow(supabase, userId, { customerName, email, location }) {
  const { data, error } = await supabase
    .from('estimates')
    .insert({
      user_id: userId,
      customer_name: customerName,
      email: email || null,
      location: location || null,
      payload: {},
    })
    .select('id, created_at, customer_name, user_id, email, location')
    .single();

  if (error) throw error;
  return data;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ payload: object, customerName?: string, email?: string, location?: string }} input
 */
export async function saveEstimateForUser(supabase, userId, { payload, customerName, email, location }) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Estimate payload is required.');
  }

  const contactEmail = (email || payload.email || payload.meta?.email || '').trim().toLowerCase();
  const contactLocation = (location || payload.location || payload.meta?.location || '').trim();
  const contactName = customerName || payload.customerName || null;

  const payloadWithContact = {
    ...payload,
    ...(contactEmail ? { email: contactEmail } : {}),
    ...(contactLocation ? { location: contactLocation } : {}),
    meta: {
      ...(payload.meta || {}),
      userId,
      ...(contactEmail ? { email: contactEmail } : {}),
      ...(contactLocation ? { location: contactLocation } : {}),
    },
  };

  const created = await insertEstimateRow(supabase, userId, {
    customerName: contactName,
    email: contactEmail || null,
    location: contactLocation || null,
  });

  const ownerId = created.user_id;
  const storedPayload = await persistEstimateImages(supabase, ownerId, created.id, payloadWithContact);

  if (storedPayload.previewContext?.originalImage) {
    storedPayload.previewContext = {
      ...storedPayload.previewContext,
      originalImagePath: storedPayload.originalImagePath,
    };
    delete storedPayload.previewContext.originalImage;
  }

  const { error: updateError } = await supabase
    .from('estimates')
    .update({
      payload: storedPayload,
      updated_at: new Date().toISOString(),
      ...estimateColumnsFromPayload(storedPayload),
    })
    .eq('id', created.id);

  if (updateError) throw updateError;

  await syncEstimatePreviews(supabase, created.id, storedPayload.previewPaths || []);

  const hydrated = await hydrateEstimateImages(supabase, storedPayload);

  return {
    id: created.id,
    createdAt: created.created_at,
    customerName: created.customer_name || contactName,
    email: contactEmail || null,
    location: contactLocation || null,
    userId: ownerId,
    ...hydrated,
  };
}
