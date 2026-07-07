import { launchChromium } from './browser-launch.js';
import lighthouse from 'lighthouse';

/**
 * Runs a real Lighthouse audit against a URL via a Playwright-launched
 * Chromium (CDP port), rather than Google's hosted PageSpeed Insights API —
 * the API key available to this project doesn't have PSI enabled, and
 * running Lighthouse directly avoids that entirely plus PSI's ~1-2/sec rate
 * limit, which matters for a batch of thousands.
 * @returns {Promise<{ok: true, lhr: object} | {ok: false, error: string}>}
 */
export async function runLighthouse(url, { timeoutMs = 45_000 } = {}) {
  const port = 9200 + Math.floor(Math.random() * 300); // spread across concurrent workers
  let browser;
  try {
    browser = await launchChromium({ args: [`--remote-debugging-port=${port}`], timeout: timeoutMs });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    const result = await lighthouse(url, {
      port,
      output: 'json',
      // Explicit, not just the default — on Vercel, Lighthouse's own
      // locale auto-detection (from the container's Accept-Language/OS
      // locale) reached for a non-English locale.json file that Vercel's
      // file tracer hadn't included in the deployment bundle (ENOENT on
      // node_modules/lighthouse/shared/localization/locales/ar.json),
      // failing the whole audit. Pinning locale avoids that lookup happening.
      locale: 'en-US',
      onlyCategories: ['performance', 'seo', 'best-practices'],
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2 },
      throttlingMethod: 'simulate',
    });

    if (!result?.lhr) throw new Error('Lighthouse returned no result');
    return { ok: true, lhr: result.lhr };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
