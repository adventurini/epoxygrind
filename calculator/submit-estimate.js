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

async function storeSessionTokens(tokens) {
  if (!tokens?.access_token || !tokens?.refresh_token) return;
  try {
    const supabase = await getAuthClient();
    await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  } catch {
    /* optional — estimate is already saved */
  }
}

/** One server call: analyze, price, create account, save, generate previews. */
export async function generateAndSaveEstimate(form, progress = {}) {
  const { onPhaseStart = () => {}, onPhaseComplete = () => {} } = progress;

  onPhaseStart('build', 'Analyzing your photo & pricing…');
  const previewTimer = setTimeout(() => {
    onPhaseStart('previews', 'Generating floor previews (4 angles)…');
  }, 25_000);

  const result = await fetchJson('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { phase: 'build', ...form },
    timeoutMs: 290_000,
  });

  clearTimeout(previewTimer);
  onPhaseComplete('build');
  onPhaseStart('previews', 'Finishing floor previews…');
  onPhaseComplete('previews');
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
