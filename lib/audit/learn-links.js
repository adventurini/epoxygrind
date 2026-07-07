/**
 * Maps a scoring check's exact `label` (lib/audit/scoring-*.js) to its
 * /learn/{slug}/ article, so the audit dashboard can link a finding straight
 * to the explanation. Deliberately a manual map, not a slugify(label) guess
 * — labels change wording sometimes and a silent mismatch would link to a
 * 404 with no way to notice. Only 3 entries so far (pilot); add one per
 * article as the learning center grows to the full ~42-check set.
 */
export const LEARN_LINKS = {
  'Lighthouse performance score': 'lighthouse-performance-score',
  'Lead form': 'lead-form',
  'Google rating': 'google-rating',
};
