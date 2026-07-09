/**
 * Pure, dependency-free helper — deliberately its own tiny module rather
 * than living in calculator/estimate-view.js. api/estimates.js (server,
 * Vercel serverless) needs this function, but calculator/estimate-view.js
 * transitively imports the browser-only WebGL visualizer module graph
 * (calculator/visualizer-gl.js -> /lib/flake-texture-renderer.js, an
 * absolute path that only resolves in a browser/bundler context). Importing
 * previewsNeedGeneration from estimate-view.js crashed every GET
 * /api/estimates request with `ERR_MODULE_NOT_FOUND: Cannot find module
 * '/lib/flake-texture-renderer.js'` the moment this function's return value
 * actually mattered again (i.e. the moment the visualizer was reverted and
 * previewsNeedGeneration started returning true for new estimates instead
 * of always false) — confirmed via live Vercel runtime logs, not just a
 * local-Node-resolution quirk. calculator/estimate-view.js re-exports this
 * for its own (client-side, browser-bundled, safe) callers.
 */
export function previewsNeedGeneration(data = {}) {
  if (data.meta?.previewMode === 'visualizer') return false;
  if (data.previewPaths?.some((item) => item.id === 'original' && item.path)) return false;
  return !(data.previews || []).some((item) => item.id === 'original' && item.image);
}
