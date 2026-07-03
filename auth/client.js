import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

let client;
let initPromise;

/**
 * supabase-js auth calls (getUser() especially) can occasionally hang on
 * their underlying network round-trip with no way to escape — bound any of
 * them with this rather than awaiting directly.
 */
export function withAuthTimeout(promise, timeoutMs = 6000, label = 'Auth request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)),
  ]);
}

export async function getAuthClient() {
  if (client) return client;
  if (!initPromise) {
    initPromise = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      let res;
      try {
        res = await fetch('/api/config', { signal: ctrl.signal });
      } catch (err) {
        initPromise = null;
        if (err.name === 'AbortError') throw new Error('Auth setup timed out.');
        throw err;
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        initPromise = null;
        throw new Error('Auth is not configured yet.');
      }
      const { supabaseUrl, supabaseAnonKey } = await res.json();
      client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return client;
    })();
  }
  return initPromise;
}

export function getAuthRedirectUrl(nextPath) {
  // Falls back to the dashboard when nothing more specific is given (e.g.
  // clicking "Log in" straight from the marketing nav, with no ?next= and
  // no gated page to return to) — without this, sign-in landed back on the
  // homepage with no visible sign that it worked.
  const next =
    nextPath ||
    new URLSearchParams(window.location.search).get('next') ||
    '/app/';
  const url = new URL('/auth/callback/', window.location.origin);
  if (next.startsWith('/')) url.searchParams.set('next', next);
  return url.toString();
}

export async function signInWithGoogle(nextPath) {
  const supabase = await getAuthClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getAuthRedirectUrl(nextPath) },
  });
  if (error) throw error;
}

export async function signInInstantly(email, name = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);

  let res;
  try {
    res = await fetch('/api/auth/instant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, name }),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Sign-in timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign-in failed');

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
}

export function isEmailVerified(user) {
  if (!user) return false;
  if (user.user_metadata?.email_verified === true) return true;
  if (user.user_metadata?.instant_demo === true) return false;
  return Boolean(user.email_confirmed_at);
}

export async function signInWithMagicLink(email, metadata = {}, nextPath) {
  const supabase = await getAuthClient();
  const options = { emailRedirectTo: getAuthRedirectUrl(nextPath) };
  if (Object.keys(metadata).length) options.data = metadata;
  const { error } = await supabase.auth.signInWithOtp({ email, options });
  if (error) throw error;
}

export async function getAccessToken() {
  const supabase = await getAuthClient();
  try {
    const { data: { session } } = await withAuthTimeout(supabase.auth.getSession(), 5000, 'getSession');
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/** Wait until Supabase session is ready (e.g. after instant sign-in from build). */
export async function waitForAccessToken({ timeoutMs = 12_000, tokens } = {}) {
  const deadline = Date.now() + timeoutMs;

  if (tokens?.access_token && tokens?.refresh_token) {
    try {
      const remaining = Math.max(0, deadline - Date.now());
      await Promise.race([
        (async () => {
          const supabase = await getAuthClient();
          await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          });
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('setSession timed out')), remaining)),
      ]);
    } catch {
      /* fall through to polling — still bounded by the same deadline below */
    }
  }

  while (Date.now() < deadline) {
    const token = await getAccessToken();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

export async function authFetch(url, options = {}) {
  const token = await getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

export async function signOut() {
  const supabase = await getAuthClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestEmailVerification(nextPath) {
  const supabase = await getAuthClient();
  const { data: { user } } = await withAuthTimeout(supabase.auth.getUser(), 6000, 'getUser');
  if (!user?.email) throw new Error('Sign in to verify your email.');
  if (isEmailVerified(user)) return { alreadyVerified: true, email: user.email };

  const redirectTo = getAuthRedirectUrl(
    nextPath || `${window.location.pathname}${window.location.search}`,
  );

  const { error: resendError } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: { emailRedirectTo: redirectTo },
  });

  if (!resendError) {
    return { sent: true, email: user.email };
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

  if (otpError) throw otpError;
  return { sent: true, email: user.email };
}

export async function markEmailVerifiedFromCallback() {
  const token = await getAccessToken();
  if (!token) return;

  const supabase = await getAuthClient();
  const { data: { user } } = await withAuthTimeout(supabase.auth.getUser(), 6000, 'getUser');
  if (!user?.email_confirmed_at || isEmailVerified(user)) return;

  await fetch('/api/auth/mark-email-verified', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  await supabase.auth.refreshSession();
}
