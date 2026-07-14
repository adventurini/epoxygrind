import { launchChromium } from './browser-launch.js';

const CHAT_WIDGET_SIGNATURES = [
  'intercom', 'drift.com', 'tawk.to', 'livechat', 'zendesk', 'crisp.chat',
  'messenger.com/plugins', 'tidio', 'olark', 'hubspot', 'chatra',
  // Home-grown widgets (ours included — chat-widget.bundle.js has none of
  // the third-party names above and would otherwise fail its own check)
  // use this naming convention; catches any contractor site running a
  // custom-built chat bubble instead of a named SaaS vendor.
  'chat-widget', 'chatwidget', 'chat-bubble',
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
    browser = await launchChromium();
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

    // Images for alt-coverage + image-quality category input. Bug fix: this
    // used to just take the first 12 large <img> tags in DOM order with no
    // filtering — since a logo sits in the header (first in DOM order on
    // every page) and contractor sites often also run a row of "as seen
    // in"/certification/partner/client badge logos near the top, the
    // image-quality audit was frequently scoring a page's worth of logos and
    // calling it "photos," never reaching the actual job-site photography
    // (confirmed via a real audit report showing 6/6, then a follow-up 8/8,
    // sampled images as different company wordmark logos from a "clients"
    // carousel, all scored ~40/100). Filter for likely logos/badges/icons and
    // prefer real project photos; keep at most one logo for context if photos
    // are scarce, matching a human reviewer's judgment call rather than a
    // hard exclusion.
    async function collectPhotoCandidates() {
      return page.evaluate(() => {
        function looksLikeLogoOrBadge(img) {
          const haystack = `${img.src} ${img.alt} ${img.className}`.toLowerCase();
          if (/\blogo\b|\bbadge\b|\bicon\b|\bavatar\b|\bsprite\b|\bfavicon\b|\bwordmark\b|\bclients?\b|certified|accredited|\baward\b|\bbbb\b|angie|houzz|trustpilot|google-partner|yelp/i.test(haystack)) {
            return true;
          }
          if (img.closest('header, nav, footer, [class*="badge" i], [class*="certif" i], [class*="partner" i], [class*="trust" i], [class*="client" i]')) {
            return true;
          }
          // Logos/badges/icons are almost always small in BOTH dimensions
          // (a common WordPress "client logo" carousel tile is ~170x120,
          // which reads as landscape, not square — an aspect-ratio-based
          // check missed it). Real job-site photography is normally much
          // larger on both axes regardless of orientation.
          if (img.naturalWidth < 250 && img.naturalHeight < 250) return true;
          return false;
        }

        const all = [...document.querySelectorAll('img')].filter(
          (img) => img.naturalWidth > 100 && img.naturalHeight > 100,
        );
        const likelyPhotos = all.filter((img) => !looksLikeLogoOrBadge(img));
        const likelyLogos = all.filter(looksLikeLogoOrBadge);

        return { likelyPhotos: likelyPhotos.map(serialize), likelyLogos: likelyLogos.map(serialize) };

        function serialize(img) {
          return {
            src: img.src,
            alt: img.alt || '',
            width: img.naturalWidth,
            height: img.naturalHeight,
            renderedWidth: img.width,
            renderedHeight: img.height,
            loading: img.loading || 'eager',
          };
        }
      });
    }

    let { likelyPhotos, likelyLogos } = await collectPhotoCandidates();

    // Some contractor sites (this one included) keep zero real project
    // photos on the homepage — the only large <img> tags there are the site
    // logo and a "clients we work with" carousel — and put the actual job
    // photography on a separate gallery/portfolio page instead. If the
    // homepage came up short, follow a same-host link that reads like a
    // gallery page and pull photo candidates from there too, rather than
    // falling back to logos just because the homepage happened not to have photos.
    if (likelyPhotos.length < 4) {
      const galleryHref = await page.evaluate(() => {
        const RE = /gallery|portfolio|our[\s-]?work|projects/i;
        const links = [...document.querySelectorAll('a[href]')];
        const match = links.find((a) => RE.test(a.textContent) || RE.test(a.href));
        return match ? match.href : null;
      });
      if (galleryHref) {
        try {
          const galleryUrl = new URL(galleryHref, finalUrl);
          if (galleryUrl.hostname === host) {
            // networkidle (not just domcontentloaded) matters here: the
            // photo filter reads img.naturalWidth/Height, which is still 0
            // until the image resource has actually finished loading.
            await page.goto(galleryUrl.toString(), { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() =>
              page.goto(galleryUrl.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
            );
            const galleryCandidates = await collectPhotoCandidates();
            likelyPhotos = [...likelyPhotos, ...galleryCandidates.likelyPhotos];
            likelyLogos = [...likelyLogos, ...galleryCandidates.likelyLogos];
          }
        } catch {
          // Gallery page failed to load/evaluate — fall through with whatever the homepage had.
        } finally {
          // Every remaining check in this function assumes it's reading the
          // homepage DOM, so getting back here is not optional cleanup — a
          // failed/incomplete return navigation leaves Playwright's execution
          // context torn down mid-flight and the very next page.evaluate()
          // throws "Execution context was destroyed" for the rest of the
          // crawl (confirmed live: this exact detour once regressed the
          // whole audit to "unreachable" because the single-attempt,
          // silently-caught return nav here didn't actually complete).
          // Retry with the same networkidle -> domcontentloaded fallback
          // used for the initial page load, and only give up after both fail.
          if (page.url() !== finalUrl) {
            await page.goto(finalUrl, { waitUntil: 'networkidle', timeout: timeoutMs }).catch(() =>
              page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
            ).catch(() => {});
          }
        }
      }
    }

    const images = likelyPhotos.length >= 6
      ? likelyPhotos.slice(0, 8)
      : [...likelyPhotos, ...likelyLogos.slice(0, 1)].slice(0, 8);
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
    // Bug fix: this used to test `location.hostname` inside a plain Array.filter
    // callback running in NODE, not inside page.evaluate() — Node has no global
    // `location`, so the reference threw on every single link, the try/catch
    // silently swallowed it, and sameHost (and therefore cityServiceLinkCount)
    // was unconditionally empty. Confirmed via 20/20 real historical audits all
    // showing "0 found in nav" regardless of actual page content — this had been
    // silently docking every audited contractor's SEO score, not just this site.
    const navLinks = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, text: a.textContent.trim() })));
    const currentHostname = await page.evaluate(() => location.hostname);
    const sameHost = navLinks.filter((l) => { try { return new URL(l.href).hostname === currentHostname; } catch { return false; } });
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
