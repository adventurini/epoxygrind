import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getSupabase } from './supabase.js';

const SESSION_COOKIE = 'eg_contractor_session';
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days, per spec
const PENDING_CLAIM_COOKIE = 'eg_pending_claim';
const PENDING_CLAIM_MAX_AGE_SEC = 15 * 60; // just long enough to fill out the interstitial

const TOKEN_TTL_MS = {
  claim: 30 * 24 * 60 * 60 * 1000, // 30 days — cold email opens late
  login: 24 * 60 * 60 * 1000, // 24h, single-use
  preview: 24 * 60 * 60 * 1000, // demo-reveal link (Phase 7); single-use for now
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** 32+ bytes of randomness per the spec, hex-encoded for a URL-safe token. */
function generateRawToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Issues a new auth token for a contractor and returns the RAW token —
 * only the hash is ever stored, so a DB read can't leak a usable link.
 * @param {number} contractorId
 * @param {'claim'|'login'|'preview'} purpose
 */
export async function createAuthToken(contractorId, purpose) {
  const supabase = getSupabase();
  const raw = generateRawToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]).toISOString();

  const { error } = await supabase.from('auth_tokens').insert({
    token_hash: sha256(raw),
    contractor_id: contractorId,
    purpose,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`createAuthToken: ${error.message}`);

  return raw;
}

/**
 * Validates a raw token from a /claim/{token} URL. Claim tokens stay valid
 * across multiple visits until the contractor actually completes the claim
 * interstitial (spec: "multi-use until claimed"); login/preview tokens are
 * single-use and get their used_at stamped immediately.
 * @returns {Promise<{ok: true, contractorId: number, purpose: string, alreadyUsed: boolean} | {ok: false, reason: string}>}
 */
export async function verifyAuthToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return { ok: false, reason: 'missing_token' };

  const supabase = getSupabase();
  const tokenHash = sha256(rawToken);

  const { data: token, error } = await supabase
    .from('auth_tokens')
    .select('id, contractor_id, purpose, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !token) return { ok: false, reason: 'not_found' };
  if (new Date(token.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (token.purpose !== 'claim' && token.used_at) return { ok: false, reason: 'already_used' };

  if (token.purpose !== 'claim') {
    await supabase.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('id', token.id);
  }

  return { ok: true, contractorId: token.contractor_id, purpose: token.purpose, alreadyUsed: Boolean(token.used_at) };
}

function sign(value) {
  const secret = process.env.CONTRACTOR_SESSION_SECRET;
  if (!secret) throw new Error('CONTRACTOR_SESSION_SECRET is not configured.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** Stateless signed session cookie — `{contractorId}.{expiresAtMs}.{hmac}` — no sessions table needed. */
export function createSessionCookieValue(contractorId) {
  const expiresAtMs = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const payload = `${contractorId}.${expiresAtMs}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionCookieValue(cookieValue) {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [contractorId, expiresAtMs, providedSig] = parts;
  const expectedSig = sign(`${contractorId}.${expiresAtMs}`);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiresAtMs) < Date.now()) return null;

  return { contractorId: Number(contractorId) };
}

export function sessionCookieHeader(contractorId) {
  const value = createSessionCookieValue(contractorId);
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Short-lived cookie bridging the /claim/{token} redirect to the static
 * interstitial page — carries just enough to render + complete the claim
 * form without a raw claim token sitting in a query string or referrer. */
export function pendingClaimCookieHeader(contractorId) {
  const expiresAtMs = Date.now() + PENDING_CLAIM_MAX_AGE_SEC * 1000;
  const payload = `${contractorId}.${expiresAtMs}`;
  const value = `${payload}.${sign(payload)}`;
  return `${PENDING_CLAIM_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PENDING_CLAIM_MAX_AGE_SEC}`;
}

export function verifyPendingClaimCookie(cookieValue) {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [contractorId, expiresAtMs, providedSig] = parts;
  const expectedSig = sign(`${contractorId}.${expiresAtMs}`);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiresAtMs) < Date.now()) return null;

  return { contractorId: Number(contractorId) };
}

export function clearPendingClaimCookieHeader() {
  return `${PENDING_CLAIM_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

/** @returns {Promise<object|null>} the full contractor row, or null if no valid session. */
export async function getContractorFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const session = verifySessionCookieValue(cookies[SESSION_COOKIE]);
  if (!session) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase.from('contractors').select('*').eq('id', session.contractorId).maybeSingle();
  if (error || !data) return null;
  return data;
}

export { SESSION_COOKIE, PENDING_CLAIM_COOKIE };
