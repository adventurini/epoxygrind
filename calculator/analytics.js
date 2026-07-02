/**
 * No analytics SDK is installed yet. This stub keeps every call site ready
 * to swap in a real provider (gtag/plausible/posthog/etc.) later without
 * touching the call sites themselves.
 */
export function track(event, props = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, props);
    return;
  }
  console.debug('[track]', event, props);
}
