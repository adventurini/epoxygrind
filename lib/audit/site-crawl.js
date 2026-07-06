import { chromium } from 'playwright';

const CHAT_WIDGET_SIGNATURES = [
  'intercom', 'drift.com', 'tawk.to', 'livechat', 'zendesk', 'crisp.chat',
  'messenger.com/plugins', 'tidio', 'olark', 'hubspot', 'chatra',
];
const BUILDER_SUBDOMAIN_HOSTS = [
  'wixsite.com', 'squarespace.com', 'weebly.com', 'godaddysites.com',
  'business.site', 'webs.com', 'blogspot.com', 'wordpress.com', 'jimdo.com',
  'strikingly.com', 'sites.google.com',
];
const RESPONSE_EXPECTATION_RE = /repl(y|ies)\s+within|respond\s+within|within\s+(one|1|24|an?)\s*(hour|hr|business day|day)|call\s*(you\s*)?back\s*(within|in)/i;
const TRUST_SIGNAL_RE = {
  license: /licen[sc]ed|license\s*#|lic\.?\s*#/i,
  insured: /insured|insurance/i,
  guarantee: /guarantee|warrant(y|ied)/i,
  reviews: /\b\d(\.\d)?\s*(star|★)|reviews?\b.*\d+|\d+\s*reviews?/i,
  beforeAfter: /before\s*(&|and)?\s*after|before\/after/i,
};

/**
 * One real browser visit does the work for four scoring categories (mobile,
 * funnel, SEO, security) instead of four separate page loads — matters at
 * a batch of thousands. Returns raw signals only; scoring-*.js modules turn
 * these into category scores so the I/O and the scoring logic stay separable
 * (and the scoring logic stays unit-testable without a real browser).
 */
function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '').replace(/^1/, '');
}

export async function crawlSite(url, { timeoutMs = 30_000, knownPhones = [] } = {}) {
  let browser;
  const consoleErrors = [];
  const mixedContentRequests = [];

  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on('request', (req) => {
      if (url.startsWith('https://') && req.url().startsWith('http://')) mixedContentRequests.push(req.url());
    });

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() =>
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
    );

    const finalUrl = page.url();
    const isHttps = finalUrl.startsWith('https://');
    const host = new URL(finalUrl).hostname;
    const isBuilderSubdomain = BUILDER_SUBDOMAIN_HOSTS.some((b) => host.endsWith(b));

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const html = await page.content();

    const hasViewportMeta = await page.evaluate(() => Boolean(document.querySelector('meta[name="viewport"]')));
    const hasTelLink = await page.evaluate(() => Boolean(document.querySelector('a[href^="tel:"]')));
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    const hasFavicon = await page.evaluate(() =>
      Boolean(document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')),
    );

    // Lighthouse's own "tap-targets" audit was removed from recent versions,
    // so this measures the same thing directly: interactive elements should
    // be >=44x44 CSS px (Google's own mobile tap-target guidance).
    const tapTargets = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a, button, input, select')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!els.length) return { total: 0, tooSmall: 0 };
      const tooSmall = els.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      }).length;
      return { total: els.length, tooSmall };
    });

    // Primary CTA above the fold: an action-verb button/link visible without scrolling.
    const aboveFold = await page.evaluate(() => {
      const vh = window.innerHeight;
      const CTA_RE = /call|quote|estimate|book|schedule|contact|get started|free/i;
      const candidates = [...document.querySelectorAll('a, button')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < vh && r.top >= 0 && r.width > 0 && r.height > 0;
      });
      const ctaAboveFold = candidates.some((el) => CTA_RE.test(el.textContent || ''));
      const phoneAboveFold = candidates.some((el) => /tel:/.test(el.getAttribute('href') || '')) ||
        /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(
          [...document.querySelectorAll('body *')]
            .filter((el) => el.getBoundingClientRect().top < vh && el.children.length === 0)
            .map((el) => el.textContent).join(' '),
        );
      return { ctaAboveFold, phoneAboveFold };
    });

    // Sticky/reachable CTA: scroll down, check something CTA-like is still on screen.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
    await page.waitForTimeout(200);
    const reachableCtaAfterScroll = await page.evaluate(() => {
      const vh = window.innerHeight;
      const CTA_RE = /call|quote|estimate|book|schedule|contact|get started|free/i;
      return [...document.querySelectorAll('a, button')].some((el) => {
        const r = el.getBoundingClientRect();
        const visible = r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0;
        return visible && CTA_RE.test(el.textContent || '');
      });
    });

    // Lead form
    const formInfo = await page.evaluate(() => {
      const forms = [...document.querySelectorAll('form')];
      if (!forms.length) return { exists: false };
      const form = forms.reduce((a, b) => (b.querySelectorAll('input,select,textarea').length > a.querySelectorAll('input,select,textarea').length ? b : a));
      const fields = [...form.querySelectorAll('input,select,textarea')].filter(
        (f) => !['hidden', 'submit', 'button'].includes(f.type),
      );
      return { exists: true, fieldCount: fields.length };
    });

    // Images for alt-coverage + image-quality category input
    const images = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((img) => img.naturalWidth > 100 && img.naturalHeight > 100)
        .slice(0, 12)
        .map((img) => ({
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth,
          height: img.naturalHeight,
          renderedWidth: img.width,
          renderedHeight: img.height,
          loading: img.loading || 'eager',
        })),
    );
    const allImgAltStats = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')];
      return { total: imgs.length, withAlt: imgs.filter((i) => i.alt && i.alt.trim()).length };
    });

    // SEO basics
    const seoBasics = await page.evaluate(() => ({
      title: document.title || '',
      metaDescription: document.querySelector('meta[name="description"]')?.content || '',
      h1Count: document.querySelectorAll('h1').length,
      hasLocalBusinessSchema: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => {
        try {
          const parsed = JSON.parse(s.textContent);
          const types = JSON.stringify(parsed);
          return /LocalBusiness|HomeAndConstructionBusiness|GeneralContractor/i.test(types);
        } catch {
          return false;
        }
      }),
    }));

    const [sitemapRes, robotsRes] = await Promise.all([
      page.request.get(new URL('/sitemap.xml', finalUrl).toString()).catch(() => null),
      page.request.get(new URL('/robots.txt', finalUrl).toString()).catch(() => null),
    ]);

    // Nav crawl for city/service landing pages — count distinct internal links
    // whose text/href suggests a location or service page (lightweight, not a full crawl).
    const navLinks = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: a.textContent.trim() })));
    const sameHost = navLinks.filter((l) => { try { return new URL(l.href).hostname === location.hostname; } catch { return false; } });
    const cityServiceLinkCount = sameHost.filter((l) =>
      /\b(city|near-me|service|epoxy|garage|floor|location|area)\b/i.test(l.href) || /\b(in|near)\s+[A-Z][a-z]+/.test(l.text),
    ).length;

    const normalizedKnownPhones = knownPhones.map(normalizePhone).filter(Boolean);
    const napPhoneMatch = normalizedKnownPhones.length
      ? normalizedKnownPhones.some((p) => bodyText.replace(/\D/g, '').includes(p))
      : null;

    const chatWidgetPresent = CHAT_WIDGET_SIGNATURES.some((sig) => html.toLowerCase().includes(sig));
    const responseExpectationCopy = RESPONSE_EXPECTATION_RE.test(bodyText);
    const trustSignalHits = Object.entries(TRUST_SIGNAL_RE).filter(([, re]) => re.test(bodyText)).map(([k]) => k);
    const hasBeforeAfterGallery = trustSignalHits.includes('beforeAfter') || /gallery|portfolio|our work/i.test(bodyText);

    // Back to top (we scrolled for the reachable-CTA check) before the
    // mobile screenshot the Design & UX vision category uses.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const mobileScreenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null);
    const mobileScreenshot = mobileScreenshotBuffer ? `data:image/jpeg;base64,${mobileScreenshotBuffer.toString('base64')}` : null;

    return {
      ok: true,
      finalUrl,
      httpStatus: response?.status?.() ?? null,
      isHttps,
      isBuilderSubdomain,
      host,
      consoleErrorCount: consoleErrors.length,
      consoleErrors: consoleErrors.slice(0, 5),
      mixedContentCount: mixedContentRequests.length,
      hasFavicon,
      hasViewportMeta,
      hasTelLink,
      hasHorizontalScroll,
      tapTargets,
      ctaAboveFold: aboveFold.ctaAboveFold,
      phoneAboveFold: aboveFold.phoneAboveFold,
      reachableCtaAfterScroll,
      form: formInfo,
      images,
      imgAltCoveragePct: allImgAltStats.total ? Math.round((allImgAltStats.withAlt / allImgAltStats.total) * 100) : 100,
      seo: seoBasics,
      sitemapOk: Boolean(sitemapRes && sitemapRes.status() === 200),
      robotsOk: Boolean(robotsRes && robotsRes.status() === 200),
      cityServiceLinkCount,
      chatWidgetPresent,
      responseExpectationCopy,
      trustSignalHits,
      hasBeforeAfterGallery,
      napPhoneMatch,
      mobileScreenshot,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
