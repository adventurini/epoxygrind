import { signInWithGoogle, signInWithMagicLink } from './client.js';

const mode = document.body.dataset.authMode || 'login';
const googleBtn = document.getElementById('googleBtn');
const oauthBlock = document.getElementById('oauthBlock');
const form = document.getElementById('magicForm');
const messageEl = document.getElementById('authMessage');

function showMessage(text, isError) {
  if (!messageEl) return;
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = isError ? 'auth-message auth-message--error' : 'auth-message auth-message--ok';
}

googleBtn?.addEventListener('click', async () => {
  googleBtn.disabled = true;
  try {
    await signInWithGoogle();
  } catch (err) {
    showMessage(err.message || 'Google sign-in failed.', true);
    googleBtn.disabled = false;
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = form.email.value.trim();
  if (!email) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const metadata = {};
    if (mode === 'signup' && form.name?.value.trim()) {
      metadata.full_name = form.name.value.trim();
    }
    await signInWithMagicLink(email, metadata);
    if (oauthBlock) oauthBlock.hidden = true;
    form.hidden = true;
    showMessage(`Check your email — we sent a sign-in link to ${email}.`, false);
  } catch (err) {
    showMessage(err.message || 'Could not send magic link.', true);
    submitBtn.disabled = false;
  }
});
