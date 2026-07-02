import { createEphemeralServiceClient } from './supabase.js';

/**
 * Create or reuse a demo user and return a fresh Supabase session (server-only).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} email
 * @param {string} [name]
 */
export async function createInstantSession(supabase, email, name = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Valid email is required.');
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
    user_metadata: {
      ...(name ? { full_name: name } : {}),
      instant_demo: true,
      email_verified: false,
    },
  });

  if (createError && !/already|registered|exists/i.test(createError.message)) {
    console.error('createUser:', createError.message);
    throw new Error('Could not create account.');
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: name ? { data: { full_name: name } } : undefined,
  });

  if (error) {
    console.error('generateLink:', error.message);
    throw new Error('Could not start session.');
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error('Could not start session.');
  }

  // A throwaway client for this call only — verifyOtp mutates client session
  // state, and we must not let that leak onto the shared service-role client.
  const authClient = createEphemeralServiceClient();
  const { data: sessionData, error: verifyError } = await authClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });

  if (verifyError || !sessionData?.session?.user) {
    console.error('verifyOtp:', verifyError?.message || 'No session returned');
    throw new Error('Could not start session.');
  }

  const uid = sessionData.user.id;
  const existingMeta = sessionData.user.user_metadata || {};

  // Supabase's own magiclink verifyOtp flow sets user_metadata.email_verified
  // to true as a side effect, every time — regardless of what we set at
  // createUser. Left uncorrected, every instant-demo account looks
  // "already verified" and the Verify Email button never appears. Always
  // force it back and await the correction so the client's next getUser()
  // (which hits the server, not a cached JWT) sees accurate metadata.
  let correctedUser = sessionData.user;
  if (existingMeta.email_verified === true || existingMeta.instant_demo !== true) {
    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(uid, {
      email_confirm: false,
      user_metadata: {
        ...existingMeta,
        ...(name ? { full_name: name } : {}),
        instant_demo: true,
        email_verified: false,
      },
    });
    if (updateError) {
      console.error('updateUserById:', updateError.message);
    } else if (updated?.user) {
      correctedUser = updated.user;
    }
  }

  return {
    email: normalizedEmail,
    user: correctedUser,
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  };
}
