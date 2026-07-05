/**
 * Client for the place-reviews Edge Function (BUILD-places-reviews.md
 * step 3). Drop into a contractor profile page: a container with
 * `data-place-id="..."` gets a "What customers are saying" section
 * rendered into it once data loads. Safe by default — on error or no
 * reviews, the section just stays hidden; it never breaks the page.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function starsHtml(rating) {
  const full = Math.round(rating || 0);
  return Array.from({ length: 5 }, (_, i) => (i < full ? '★' : '☆')).join('');
}

function reviewItemHtml(review) {
  const avatar = review.author_photo_uri
    ? `<img class="pr-review-avatar" src="${escapeHtml(review.author_photo_uri)}" alt="" loading="lazy">`
    : '<span class="pr-review-avatar pr-review-avatar-fallback"></span>';

  return `<div class="pr-review">
    ${avatar}
    <div class="pr-review-body">
      <p class="pr-review-head">
        <a href="${escapeHtml(review.author_uri || '#')}" target="_blank" rel="noopener">${escapeHtml(review.author_name)}</a>
        <span class="pr-review-stars">${starsHtml(review.rating)}</span>
        <span class="pr-review-time">${escapeHtml(review.relative_time)}</span>
      </p>
      <p class="pr-review-text">${escapeHtml(review.text)}</p>
    </div>
  </div>`;
}

function renderLoading(container) {
  container.innerHTML = `<h2>What customers are saying</h2><p class="pr-loading muted tiny">Loading Google reviews…</p>`;
  container.hidden = false;
}

function renderSection(container, data) {
  if (!data || !data.reviews?.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <h2>What customers are saying</h2>
    <p class="pr-summary">${starsHtml(data.rating)} <strong>${escapeHtml(data.rating ?? '—')}</strong> (${escapeHtml(data.review_count ?? 0)} Google reviews)</p>
    <div class="pr-review-list">${data.reviews.map(reviewItemHtml).join('')}</div>
    ${data.google_maps_uri ? `<p><a href="${escapeHtml(data.google_maps_uri)}" target="_blank" rel="noopener">See all reviews on Google →</a></p>` : ''}
    <p class="pr-attribution muted tiny">Reviews and ratings from Google.</p>`;
  container.hidden = false;
}

async function fetchPlaceReviews(placeId, { functionsUrl, anonKey }) {
  const res = await fetch(`${functionsUrl}/place-reviews?place_id=${encodeURIComponent(placeId)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) throw new Error(`place-reviews returned ${res.status}`);
  return res.json();
}

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 6; // ~9s total — the actual Places fetch+cache write usually lands in 2-4s

/**
 * @param {{ functionsUrl: string, anonKey: string }} config - e.g.
 *   functionsUrl: `${SUPABASE_URL}/functions/v1`, anonKey: the Supabase anon key.
 */
export async function initPlaceReviews(config) {
  const container = document.querySelector('[data-place-id]');
  if (!container) return;
  const placeId = container.dataset.placeId;
  if (!placeId) return;

  try {
    const result = await fetchPlaceReviews(placeId, config);
    if (result.status !== 'pending') {
      renderSection(container, result.data);
      return;
    }

    // First-ever view for this place — cache is filling in the background
    // (usually ready in 2-4s). Show a loading state instead of leaving the
    // section silently blank, and poll a few times faster than one fixed
    // wait so it appears as soon as it's actually ready.
    renderLoading(container);
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        const retry = await fetchPlaceReviews(placeId, config);
        if (retry.status !== 'pending') {
          renderSection(container, retry.data);
          return;
        }
      } catch {
        break;
      }
    }
    // Gave up waiting — never leave a stuck "Loading…" on the page.
    container.hidden = true;
    container.innerHTML = '';
  } catch {
    /* leave hidden — never break the page */
  }
}
