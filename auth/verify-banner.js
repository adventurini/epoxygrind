import { getAuthClient, requestEmailVerification, isEmailVerified, withAuthTimeout } from './client.js';

async function mountVerifyBanner() {
  const banner = document.getElementById('verifyBanner');
  const btn = document.getElementById('verifyEmailBtn');
  const msg = document.getElementById('verifyEmailMsg');
  if (!banner || !btn) return;

  let supabase;
  try {
    supabase = await getAuthClient();
  } catch {
    banner.hidden = true;
    return;
  }

  async function refresh() {
    let user = null;
    try {
      ({ data: { user } } = await withAuthTimeout(supabase.auth.getUser(), 5000, 'getUser'));
    } catch {
      /* leave banner hidden if we can't confirm the user in time */
    }
    banner.hidden = !user || isEmailVerified(user);
    if (msg && banner.hidden) {
      msg.hidden = true;
      msg.textContent = '';
    }
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const result = await requestEmailVerification(
        `${window.location.pathname}${window.location.search}`,
      );
      if (msg) {
        msg.hidden = false;
        msg.className = 'verify-banner-msg verify-banner-msg--ok';
        msg.textContent = result.alreadyVerified
          ? 'Your email is already verified.'
          : `Verification link sent to ${result.email}. Check your inbox.`;
      }
      if (result.alreadyVerified) banner.hidden = true;
    } catch (err) {
      if (msg) {
        msg.hidden = false;
        msg.className = 'verify-banner-msg verify-banner-msg--error';
        msg.textContent = err.message || 'Could not send verification email.';
      }
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
  supabase.auth.onAuthStateChange(() => refresh());
}

mountVerifyBanner();
