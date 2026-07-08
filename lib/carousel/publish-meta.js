/**
 * Meta Content Publishing API — Instagram carousel + Facebook Page post
 * (spec §9). Only `final_url` (flattened, caption-burned-in) images are
 * ever posted — never a raw generation. No TikTok (dropped from scope).
 *
 * Credentials live in carousel_config (key: 'metaCredentials'), not env
 * vars — the long-lived page token needs periodic rotation without a
 * redeploy (spec: "build proactive token refresh + an expiry warning").
 */
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 60; // ~5 min at 5s/poll

async function graphRequest(path, { method = 'GET', body } = {}) {
  const url = `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`Meta Graph API ${path} failed: ${data.error?.message || res.status}`);
  }
  return data;
}

function withToken(params, accessToken) {
  return new URLSearchParams({ ...params, access_token: accessToken }).toString();
}

async function pollContainerUntilFinished(containerId, accessToken) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const data = await graphRequest(`/${containerId}?${withToken({ fields: 'status_code' }, accessToken)}`);
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Container ${containerId} failed to process.`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Container ${containerId} did not finish processing within the timeout.`);
}

/**
 * Publishes a 6-image Instagram carousel.
 * @param {{ igUserId: string, accessToken: string, imageUrls: string[], caption: string }} opts
 * @returns {Promise<{ platformPostId: string }>}
 */
export async function publishInstagramCarousel({ igUserId, accessToken, imageUrls, caption }) {
  if (imageUrls.length !== 6) throw new Error(`Expected exactly 6 images, got ${imageUrls.length}`);

  const childIds = [];
  for (const imageUrl of imageUrls) {
    const data = await graphRequest(`/${igUserId}/media`, {
      method: 'POST',
      body: { image_url: imageUrl, is_carousel_item: true, access_token: accessToken },
    });
    childIds.push(data.id);
  }
  for (const id of childIds) {
    await pollContainerUntilFinished(id, accessToken);
  }

  const parent = await graphRequest(`/${igUserId}/media`, {
    method: 'POST',
    body: { media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: accessToken },
  });

  // Retry publish with the SAME parent container id on transient failure —
  // never rebuild the parent, or the post gets duplicated (spec §9).
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const published = await graphRequest(`/${igUserId}/media_publish`, {
        method: 'POST',
        body: { creation_id: parent.id, access_token: accessToken },
      });
      return { platformPostId: published.id };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Posts the same 6 images as a Facebook Page multi-photo post.
 * @param {{ pageId: string, accessToken: string, imageUrls: string[], caption: string }} opts
 * @returns {Promise<{ platformPostId: string }>}
 */
export async function publishFacebookPagePost({ pageId, accessToken, imageUrls, caption }) {
  const photoIds = [];
  for (const imageUrl of imageUrls) {
    const data = await graphRequest(`/${pageId}/photos`, {
      method: 'POST',
      body: { url: imageUrl, published: false, access_token: accessToken },
    });
    photoIds.push(data.id);
  }

  // attached_media as a real JSON array — the attached_media[0]=... bracket
  // notation is a form-urlencoded-only convention and does nothing when
  // the request body is actually JSON (which graphRequest always sends).
  const data = await graphRequest(`/${pageId}/feed`, {
    method: 'POST',
    body: {
      message: caption,
      attached_media: photoIds.map((id) => ({ media_fbid: id })),
      access_token: accessToken,
    },
  });
  return { platformPostId: data.id };
}
