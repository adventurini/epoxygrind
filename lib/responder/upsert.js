/**
 * Shared contact/conversation/lead upsert logic — used by both the voice
 * and SMS webhooks so a caller who later texts (or vice versa) lands in
 * the same contact/conversation thread instead of forking into two.
 */

export async function findOrCreateContact({ supabase, accountId, phone, source }) {
  const { data: existing, error: findErr } = await supabase
    .from('responder_contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('phone', phone)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await supabase
    .from('responder_contacts')
    .insert({ account_id: accountId, phone, first_source: source })
    .select('*')
    .single();
  if (createErr) throw createErr;
  return created;
}

/**
 * Reuses an open/needs_attention conversation for this contact if one
 * exists, rather than forking a new thread every time they call or text
 * again (spec §2.1.1: "Repeat caller with open thread: skip the intro
 * text; ... bump it to needs_attention").
 */
export async function findOrCreateConversation({ supabase, accountId, contactId, channel }) {
  const { data: existing, error: findErr } = await supabase
    .from('responder_conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .in('status', ['open', 'needs_attention'])
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return { conversation: existing, isNew: false };

  const { data: created, error: createErr } = await supabase
    .from('responder_conversations')
    .insert({ account_id: accountId, contact_id: contactId, channel })
    .select('*')
    .single();
  if (createErr) throw createErr;
  return { conversation: created, isNew: true };
}

export async function createLead({ supabase, accountId, contactId, source }) {
  const { data: lead, error } = await supabase
    .from('responder_leads')
    .insert({ account_id: accountId, contact_id: contactId, source })
    .select('*')
    .single();
  if (error) throw error;
  await logLeadEvent({ supabase, leadId: lead.id, type: 'created', payload: { source } });
  return lead;
}

export async function logLeadEvent({ supabase, leadId, type, payload = {} }) {
  const { error } = await supabase.from('responder_lead_events').insert({ lead_id: leadId, type, payload });
  if (error) throw error;
}

export async function insertMessage({ supabase, conversationId, direction, senderType, body, twilioSid }) {
  const { data, error } = await supabase
    .from('responder_messages')
    .insert({ conversation_id: conversationId, direction, sender_type: senderType, body, twilio_sid: twilioSid || null })
    .select('*')
    .single();
  if (error) throw error;
  await supabase.from('responder_conversations').update({ last_message_at: data.created_at }).eq('id', conversationId);
  return data;
}
