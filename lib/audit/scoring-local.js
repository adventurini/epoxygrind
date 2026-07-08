/**
 * Category 7 — Local presence & reputation (9% weight). Pure data — no
 * network calls of its own; photoCount and ratings are already fetched by
 * the caller (lib/audit/index.js, from places_cache).
 * Point allocation (sums to 100): GBP photos present 25, review count vs.
 * local median 30, rating itself 20, NAP phone match 15, reviews shown on
 * their own site 10.
 * @param {object} contractor enriched contractor record (google_rating, google_review_count, has_google_reviews)
 * @param {number} photoCount live count of Google Business Profile photos on file (places_cache, via /api/places-photo's data source)
 * @param {number} localMedianReviewCount median review count among this contractor's local peers
 * @param {object} crawl site-crawl.js's crawlSite() output (for NAP + on-site reviews)
 */
export function scoreLocalPresence(contractor, photoCount, localMedianReviewCount, crawl) {
  let score = 0;
  const checks = [];

  const hasPhotos = photoCount > 0;
  if (hasPhotos) score += 25;
  checks.push({
    label: 'Google Business Profile photos',
    value: hasPhotos ? `${photoCount} photo(s) on file` : 'None found',
    verdict: hasPhotos ? 'GBP has real photos — reads as an active, claimed listing.' : 'No photos on the Google listing — reads as unclaimed or neglected.',
    fix: hasPhotos ? '' : 'Claim the Google Business Profile and upload real job photos.',
    severity: 3,
    passed: hasPhotos,
  });

  const reviewCount = contractor.google_review_count ?? 0;
  const median = localMedianReviewCount ?? 0;
  const reviewsOk = median === 0 || reviewCount >= median;
  score += reviewsOk ? 30 : Math.round(30 * Math.min(1, reviewCount / Math.max(median, 1)));
  checks.push({
    label: 'Review count vs. local median',
    value: `${reviewCount} (local median: ${median})`,
    verdict: reviewsOk
      ? `${reviewCount} reviews holds up against the local median of ${median}.`
      : `Local contractors average ${median} reviews. This business has ${reviewCount}.`,
    fix: reviewsOk ? '' : 'Set up a review-request sequence after every completed job.',
    severity: reviewsOk ? 1 : 3,
    passed: reviewsOk,
  });

  const rating = contractor.google_rating ?? 0;
  const ratingOk = rating >= 4.5;
  score += ratingOk ? 20 : rating >= 4.0 ? 12 : rating > 0 ? 5 : 0;
  checks.push({
    label: 'Google rating',
    value: rating ? `${rating}★` : 'No rating',
    verdict: ratingOk ? 'Strong rating.' : rating >= 4.0 ? 'Decent, but below the 4.5+ bar homeowners filter on.' : 'Rating is low or missing.',
    fix: ratingOk ? '' : 'Address recent negative reviews and push for more 5-star reviews.',
    severity: rating > 0 && rating < 4 ? 4 : 2,
    passed: ratingOk,
  });

  const napOk = crawl?.napPhoneMatch !== false; // null (unknown/no site) doesn't penalize
  if (crawl?.napPhoneMatch === true) score += 15;
  else if (crawl?.napPhoneMatch === null) score += 15; // no site to check against — neutral, not a penalty
  checks.push({
    label: 'NAP consistency (phone)',
    value: crawl?.napPhoneMatch === null ? 'N/A (no website)' : crawl?.napPhoneMatch ? 'Matches' : 'Mismatch',
    verdict: crawl?.napPhoneMatch === false ? "Website phone number doesn't match the Google listing — confuses both Google and customers." : 'Consistent.',
    fix: crawl?.napPhoneMatch === false ? 'Make sure the same phone number is used on the website and the Google Business Profile.' : '',
    severity: 3,
    passed: napOk,
  });

  const reviewsOnSite = crawl?.trustSignalHits?.includes('reviews') ?? false;
  if (reviewsOnSite) score += 10;
  checks.push({
    label: 'Reviews displayed on the site itself',
    value: reviewsOnSite ? 'Yes' : 'No',
    verdict: reviewsOnSite ? 'Reviews are surfaced on the website, not just Google.' : 'Reviews only live on Google — not reinforcing trust on the site itself.',
    fix: reviewsOnSite ? '' : 'Embed a few real reviews near the CTA.',
    severity: 2,
    passed: reviewsOnSite,
  });

  return { score: Math.round(Math.min(100, score)), checks };
}
