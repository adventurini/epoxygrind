import { launchChromium } from './browser-launch.js';

/**
 * Desktop 1440px screenshot for the Design & UX vision category — separate
 * page load from site-crawl.js's mobile pass since it needs its own
 * viewport. Downscaled to keep the vision-call payload small (spec:
 * "screenshots downscaled <=1568px longest edge before vision calls").
 */
export async function captureDesktopScreenshot(url, { timeoutMs = 30_000 } = {}) {
  let browser;
  try {
    browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() =>
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
    );
    const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
