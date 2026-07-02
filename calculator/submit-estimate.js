import { getAuthClient, waitForAccessToken } from '/auth/client.js';

export const PENDING_ESTIMATE_KEY = 'epoxygrind-pending-estimate';

export function savePendingEstimate(form) {
  sessionStorage.setItem(PENDING_ESTIMATE_KEY, JSON.stringify(form));
}

export function loadPendingEstimate() {
  try {
    const raw = sessionStorage.getItem(PENDING_ESTIMATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingEstimate() {
  sessionStorage.removeItem(PENDING_ESTIMATE_KEY);
}

async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 120000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('This took too long. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function storeSessionTokens(tokens, timeoutMs = 10_000) {
  if (!tokens?.access_token || !tokens?.refresh_token) return;
  try {
    await Promise.race([
      (async () => {
        const supabase = await getAuthClient();
        await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('setSession timed out')), timeoutMs)),
    ]);
  } catch {
    /* optional — estimate is already saved */
  }
}

/** One server call: analyze, price, create account, save. Preview image generation happens after, separately. */
export async function generateAndSaveEstimate(form, progress = {}) {
  const { onPhaseStart = () => {} } = progress;

  onPhaseStart('build', 'Analyzing your photo & pricing…');

  const result = await fetchJson('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { phase: 'build', ...form },
    timeoutMs: 110_000,
  });

  await storeSessionTokens(result);
  await waitForAccessToken({
    timeoutMs: 15_000,
    tokens: {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    },
  });

  clearPendingEstimate();
  return {
    estimate: result.estimate,
    sessionTokens: {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    },
  };
}

/** Anonymous: photo analysis + pricing + the one preview image. No account, no save. */
export async function generateAnonymousEstimate(form) {
  return fetchJson('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { phase: 'generate', ...form },
    timeoutMs: 110_000,
  });
}

/**
 * Turns an anonymously-generated estimate into a saved one once the user
 * provides their name/email. Sends the already-computed bundle back as
 * `precomputed` so the server doesn't redo analysis/pricing/image generation.
 */
export async function claimEstimate(step1Form, generated, { customerName, email }) {
  const result = await fetchJson('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      phase: 'build',
      ...step1Form,
      customerName,
      email,
      precomputed: {
        analysis: generated.analysis,
        pricing: generated.pricing,
        design: generated.design,
        previewContext: generated.previewContext,
        meta: generated.meta,
        preview: generated.preview,
      },
    },
    timeoutMs: 60_000,
  });

  await storeSessionTokens(result);
  await waitForAccessToken({
    timeoutMs: 15_000,
    tokens: {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    },
  });

  return {
    estimate: result.estimate,
    sessionTokens: {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    },
  };
}
