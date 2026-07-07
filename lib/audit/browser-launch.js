/**
 * Shared Chromium launcher for the audit engine — used by site-crawl.js,
 * screenshots.js, lighthouse-runner.js, and site-structure.js instead of
 * each importing `playwright` directly.
 *
 * Two very different environments need to work here:
 *  - Local/CI (scripts/run-audits.js, this repo's own dev machine): full
 *    desktop Chromium via the plain `playwright` package, same as always.
 *  - Vercel serverless functions (api/audit/request.js): full Playwright's
 *    downloaded Chromium binary (~280MB) doesn't fit in Vercel's 250MB
 *    uncompressed function-bundle limit. `playwright-core` (no bundled
 *    browser, ~5MB) + `@sparticuz/chromium` (a serverless-optimized Linux
 *    build, ~40MB) is the standard fix — but that Linux binary can't run
 *    on a local Mac/dev machine at all, so it must ONLY be used when
 *    actually running on Vercel (`process.env.VERCEL` is set there).
 *
 * @sparticuz/chromium is version-pinned to playwright-core: this repo uses
 * playwright-core 1.61.1 (bundles Chromium 149.0.7827.55), paired with
 * @sparticuz/chromium@149.0.0 — @sparticuz names releases after the
 * Chromium version they bundle specifically to make this pairing obvious.
 * If either version bumps, re-check that pairing before assuming it's fine.
 */

let cachedExecutablePath = null;

/**
 * @param {import('playwright-core').LaunchOptions} [opts]
 * @returns {Promise<import('playwright-core').Browser>}
 */
export async function launchChromium(opts = {}) {
  if (process.env.VERCEL) {
    const [{ chromium }, chromiumPkgMod] = await Promise.all([
      import('playwright-core'),
      import('@sparticuz/chromium'),
    ]);
    const chromiumPkg = chromiumPkgMod.default;
    if (!cachedExecutablePath) cachedExecutablePath = await chromiumPkg.executablePath();

    return chromium.launch({
      ...opts,
      args: [...chromiumPkg.args, ...(opts.args || [])],
      executablePath: cachedExecutablePath,
      headless: true,
    });
  }

  const { chromium } = await import('playwright');
  return chromium.launch(opts);
}
