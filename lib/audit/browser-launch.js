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
 * Vercel reuses a warm container across many invocations. Every launch
 * gets its own random `/tmp/playwright_*profile-*` user-data-dir, which
 * Playwright normally deletes on browser.close() — but a hard kill (the
 * function hitting its own maxDuration, or the "browser has been closed"/
 * INSUFFICIENT_RESOURCES crashes this batch already hits under load) skips
 * that cleanup entirely, since the whole process is terminated before any
 * `finally` block runs. Confirmed real: after enough of those, one warm
 * container's /tmp filled completely (`FILE_ERROR_NO_SPACE`,
 * "Less than 64MB of free space"), and every subsequent request on that
 * container failed regardless of target site — a self-reinforcing leak
 * (crash -> leftover profile dir -> less free space -> more crashes).
 *
 * Exported so a caller (runAudit()) can sweep exactly once per invocation,
 * before any of that invocation's own browsers exist — sweeping from
 * inside launchChromium() itself would race the two concurrent same-wave
 * launches it's called with on Vercel and could delete a sibling's still-
 * active profile dir.
 */
export async function sweepStaleChromiumTempDirs() {
  const { readdir, rm } = await import('node:fs/promises');
  const os = await import('node:os');
  const { join } = await import('node:path');
  const tmpDir = os.tmpdir();
  let entries;
  try {
    entries = await readdir(tmpDir);
  } catch {
    return;
  }
  await Promise.all(
    entries
      .filter((name) => /^playwright_chromiumdev_profile-|^\.org\.chromium\.Chromium/.test(name))
      .map((name) => rm(join(tmpDir, name), { recursive: true, force: true }).catch(() => {})),
  );
}

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
