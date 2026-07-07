import { getAuthClient, markEmailVerifiedFromCallback, withAuthTimeout } from './client.js';

const params = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const next = params.get('next') || '/app/';
const errorDesc = params.get('error_description') || hashParams.get('error_description');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');

function showError(message) {
  if (statusEl) statusEl.hidden = true;
  if (errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }
}

if (errorDesc) {
  showError(errorDesc);
} else {
  // Wrapped in an async IIFE (rather than top-level await) so this file can
  // be bundled as an IIFE alongside every other entry (perf-fix Fix 3) —
  // top-level await isn't supported in that output format.
  (async () => {
    try {
      const supabase = await getAuthClient();
      const finish = async () => {
        await markEmailVerifiedFromCallback();
        window.location.replace(next);
      };

      let session = null;
      try {
        ({ data: { session } } = await withAuthTimeout(supabase.auth.getSession(), 6000, 'getSession'));
      } catch {
        /* fall through to the auth-state-change listener + hard timeout below */
      }

      if (session) {
        await finish();
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (nextSession) {
            subscription.unsubscribe();
            finish();
          }
        });
        window.setTimeout(async () => {
          if (!window.location.pathname.includes('/auth/callback')) return;
          // Confirmed real case: the OAuth exchange had actually succeeded
          // server-side (a real session existed) by the time this fired,
          // but onAuthStateChange never emitted client-side — a genuine
          // race, not a real failure. One more direct getSession() check
          // before declaring a timeout catches exactly that case instead
          // of showing a scary error for a sign-in that already worked.
          try {
            const { data: { session: lateSession } } = await withAuthTimeout(supabase.auth.getSession(), 5000, 'getSession-retry');
            if (lateSession) {
              subscription.unsubscribe();
              await finish();
              return;
            }
          } catch {
            /* fall through to the error below */
          }
          showError('Sign-in timed out. Please try again from the login page.');
        }, 15000);
      }
    } catch (err) {
      showError(err.message || 'Could not complete sign-in.');
    }
  })();
}
