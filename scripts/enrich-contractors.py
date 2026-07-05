#!/usr/bin/env python3
"""
Contractor enrichment scraper (BUILD-contractor-scraper.md / BUILD-everything
step 2). Reads each contractor's OWN website only — no Google Maps, no Yelp,
no review platform (reviews/photos of the BUSINESS come from the paid Places
API cache, a separate system). Free: no API key, no cost. The one image this
DOES capture is logo_url — a link to the contractor's own logo, found on
their homepage (not downloaded here; a separate small script fetches and
self-hosts it, same pattern as the Places photo pipeline).

Input: a CSV with columns name,website,place_id,city,state (place_id/city/
state optional, passed through unchanged).
Output: enriched.json + enriched.csv.

Usage: python3 scripts/enrich-contractors.py --in content/data/contractors-seed.csv
"""
import argparse
import asyncio
import csv
import json
import re
import time
import urllib.robotparser
from collections import defaultdict
from urllib.parse import urljoin, urlparse

try:
    import httpx
    from bs4 import BeautifulSoup
except ImportError:
    raise SystemExit("Run: pip3 install httpx beautifulsoup4")

USER_AGENT = "EpoxyGrindBot/1.0 (+https://epoxygrind.com/bot)"
MAX_PAGES_PER_SITE = 6
PAGE_LINK_KEYWORDS = ('contact', 'about', 'service', 'area', 'gallery', 'quote', 'estimate')
REQUEST_TIMEOUT = 15

SERVICE_TAXONOMY = {
    'epoxy_flake': ['epoxy flake', 'flake epoxy', 'chip epoxy', 'flake floor'],
    'epoxy_solid': ['solid epoxy', 'solid color epoxy', '100% solids epoxy'],
    'metallic_epoxy': ['metallic epoxy', 'metallic floor'],
    'polyaspartic': ['polyaspartic'],
    'polyurea': ['polyurea'],
    'concrete_polish': ['polished concrete', 'concrete polishing'],
    'concrete_stain': ['concrete stain', 'stained concrete', 'acid stain'],
    'concrete_repair': ['concrete repair', 'crack repair', 'concrete crack'],
    'commercial': ['commercial flooring', 'commercial epoxy', 'industrial flooring'],
    'residential': ['residential flooring', 'residential epoxy', 'garage floor'],
    'countertops': ['epoxy countertop', 'countertops'],
    'pool_deck': ['pool deck', 'pool decking'],
}

SOCIAL_DOMAINS = {
    'facebook': 'facebook.com',
    'instagram': 'instagram.com',
    'youtube': 'youtube.com',
    'tiktok': 'tiktok.com',
    'linkedin': 'linkedin.com',
    'x': ('twitter.com', 'x.com'),
}

JUNK_EMAIL_PATTERNS = re.compile(
    r'(sentry|wixpress|noreply|no-reply|example\.com|\.(png|jpg|jpeg|gif|svg|webp)$)', re.I,
)
PHONE_RE = re.compile(r'(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b')
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
CITY_STATE_RE = re.compile(r'\b(?:Serving\s+|Greater\s+)?([A-Z][a-zA-Z. ]{1,30}),\s*([A-Z]{2})\b')
YEARS_RE = re.compile(r'(\d{1,2})\+?\s*years?\b', re.I)

TRUST_KEYWORDS = {
    'licensed': ['licensed'],
    'insured': ['insured'],
    'warranty': ['warranty', 'guarantee'],
    'family_owned': ['family owned', 'family-owned'],
    'free_estimates': ['free estimate', 'free quote'],
    'financing': ['financing available', 'financing options', '0% financing'],
}


def normalize_phone(match):
    return f"({match.group(1)}) {match.group(2)}-{match.group(3)}"


def extract_taxonomy(text_lower):
    return sorted({key for key, kws in SERVICE_TAXONOMY.items() if any(kw in text_lower for kw in kws)})


def extract_trust_signals(text_lower):
    signals = {key: any(kw in text_lower for kw in kws) for key, kws in TRUST_KEYWORDS.items()}
    years_match = YEARS_RE.search(text_lower)
    signals['years_in_business'] = int(years_match.group(1)) if years_match else None
    return signals


# Generic/junk social links: bare platform homepages (share buttons pointing
# at "facebook.com" with no page), login/share/intent endpoints a lazy footer
# icon links to when the owner never actually set up a business page. A real
# profile link always has a specific path after the domain.
SOCIAL_JUNK_PATH_RE = re.compile(
    r'^/?(login|sharer|share|dialog|intent|home\??|#.*)?$', re.I,
)


def is_real_social_link(href):
    parsed = urlparse(href)
    path = parsed.path.rstrip('/')
    if SOCIAL_JUNK_PATH_RE.match(path or '/'):
        return False
    return True


LOGO_HINT_RE = re.compile(r'logo|brand', re.I)
# Generic CMS/stock placeholder logos and tracking pixels — never a real
# business mark, and common enough in header markup to be worth excluding
# explicitly rather than trusting "logo" in the filename alone.
LOGO_JUNK_RE = re.compile(r'(placeholder|sprite|pixel|tracking|wixpress|gravatar)', re.I)


def extract_logo_url(soup, base_url):
    """Best-effort: the contractor's own logo image from their homepage
    header — never a stock photo, favicon-as-last-resort only. Returns an
    absolute URL or None; a separate script downloads and self-hosts it."""
    candidates = []
    header = soup.find('header') or soup

    for img in header.find_all('img'):
        # Lazy-loaded images keep a tiny inline placeholder in `src` (often
        # a data: URI) and the real image in data-src/data-lazy-src/srcset —
        # prefer those over a data: URI, which is never real logo content.
        src = ''
        for attr in ('data-src', 'data-lazy-src', 'src'):
            val = img.get(attr) or ''
            if val and not val.startswith('data:'):
                src = val
                break
        if not src or LOGO_JUNK_RE.search(src):
            continue
        haystack = ' '.join(filter(None, [src, img.get('alt', ''), ' '.join(img.get('class', []))]))
        if LOGO_HINT_RE.search(haystack):
            score = 2 if img.find_parent('header') else 1
            candidates.append((score, urljoin(base_url, src)))

    if candidates:
        candidates.sort(key=lambda c: -c[0])
        return candidates[0][1]

    # Fallback: apple-touch-icon is usually a square brand mark, a
    # reasonable stand-in when no header logo <img> exists.
    touch_icon = soup.find('link', rel=lambda r: r and 'apple-touch-icon' in r)
    if touch_icon and touch_icon.get('href'):
        return urljoin(base_url, touch_icon['href'])

    return None


def extract_socials(soup, base_url):
    found = {}
    for a in soup.find_all('a', href=True):
        href = urljoin(base_url, a['href'])
        host = urlparse(href).netloc.lower()
        for platform, domains in SOCIAL_DOMAINS.items():
            domains = (domains,) if isinstance(domains, str) else domains
            if platform not in found and any(d in host for d in domains) and is_real_social_link(href):
                found[platform] = href
    return found


def extract_service_areas(text):
    areas = set()
    for m in CITY_STATE_RE.finditer(text):
        city = m.group(1).strip()
        if len(city) < 2 or city.lower() in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'):
            continue
        areas.add(f"{city}, {m.group(2)}")
        if len(areas) >= 40:
            break
    return sorted(areas)


async def robots_allowed(client, client_cache, base_url, path):
    origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
    if origin not in client_cache:
        rp = urllib.robotparser.RobotFileParser()
        try:
            # Fetch through our own client so the site sees the same
            # identified User-Agent as every other request — RobotFileParser's
            # own .read() fetches with Python's generic default UA, which
            # several sites' bot-protection (Cloudflare etc.) 403s; Python
            # then misreads that 403 as "disallow everything" even though a
            # normal/identified request gets the real, permissive robots.txt.
            res = await client.get(urljoin(origin, '/robots.txt'), timeout=REQUEST_TIMEOUT)
            if res.status_code == 200:
                rp.parse(res.text.splitlines())
            elif res.status_code in (401, 403):
                rp = None  # genuinely denied even to an identified client — respect it
            else:
                rp = None  # no robots.txt (404 etc.) — treat as allowed
        except Exception:
            rp = None  # unreachable — treat as allowed rather than blocking a whole site on a network blip
        client_cache[origin] = rp
    rp = client_cache[origin]
    if rp is None:
        return True
    try:
        return rp.can_fetch(USER_AGENT, urljoin(base_url, path))
    except Exception:
        return True


class DomainPacer:
    """Max 1 request/sec per domain; unlimited concurrency across domains."""
    def __init__(self):
        self._last = defaultdict(float)
        self._locks = defaultdict(asyncio.Lock)

    async def wait(self, domain):
        async with self._locks[domain]:
            elapsed = time.monotonic() - self._last[domain]
            if elapsed < 1.0:
                await asyncio.sleep(1.0 - elapsed)
            self._last[domain] = time.monotonic()


async def fetch_page(client, pacer, robots_cache, url):
    domain = urlparse(url).netloc
    if not await robots_allowed(client, robots_cache, url, urlparse(url).path or '/'):
        return None, 'blocked_by_robots'
    await pacer.wait(domain)
    try:
        res = await client.get(url, timeout=REQUEST_TIMEOUT, follow_redirects=True)
        ctype = res.headers.get('content-type', '')
        if res.status_code != 200 or 'text/html' not in ctype:
            return None, None
        return res.text, None
    except Exception:
        return None, None


def find_more_links(soup, base_url, visited):
    links = []
    for a in soup.find_all('a', href=True):
        href = urljoin(base_url, a['href'])
        parsed = urlparse(href)
        if parsed.netloc != urlparse(base_url).netloc:
            continue
        if href in visited:
            continue
        path_lower = parsed.path.lower()
        if any(kw in path_lower for kw in PAGE_LINK_KEYWORDS):
            links.append(href.split('#')[0])
    return links


async def enrich_one(client, pacer, robots_cache, contractor):
    website = (contractor.get('website') or '').strip()
    result = {
        **contractor,
        'phones': [], 'emails': [], 'services': [], 'raw_services': [],
        'service_areas': [], 'trust_signals': {}, 'socials': {},
        'has_photo_gallery': False, 'has_contact_form': False,
        'title': '', 'meta_description': '', 'logo_url': None, 'status': 'no_website',
    }
    if not website:
        return result

    if not website.startswith('http'):
        website = f'https://{website}'

    visited = set()
    to_visit = [website]
    all_text = []
    all_html_blocks = []
    pages_fetched = 0
    blocked = False
    any_success = False

    while to_visit and pages_fetched < MAX_PAGES_PER_SITE:
        url = to_visit.pop(0)
        if url in visited:
            continue
        visited.add(url)

        html, err = await fetch_page(client, pacer, robots_cache, url)
        if err == 'blocked_by_robots' and pages_fetched == 0:
            blocked = True
            break
        if not html:
            continue

        pages_fetched += 1
        any_success = True
        soup = BeautifulSoup(html, 'html.parser')
        all_text.append(soup.get_text(' ', strip=True))
        all_html_blocks.append(html)

        if pages_fetched == 1:
            if soup.title:
                result['title'] = soup.title.get_text(strip=True)[:200]
            meta = soup.find('meta', attrs={'name': 'description'})
            if meta and meta.get('content'):
                result['meta_description'] = meta['content'].strip()[:300]
            result['logo_url'] = extract_logo_url(soup, url)

        for tel in soup.select('a[href^="tel:"]'):
            digits = re.sub(r'\D', '', tel['href'])
            if len(digits) >= 10:
                m = PHONE_RE.search(digits[-10:])
                if m:
                    result['phones'].insert(0, normalize_phone(m))
        for mailto in soup.select('a[href^="mailto:"]'):
            email = mailto['href'].replace('mailto:', '').split('?')[0].strip()
            if email and not JUNK_EMAIL_PATTERNS.search(email):
                result['emails'].insert(0, email)

        if not result['socials']:
            result['socials'] = extract_socials(soup, url)
        if soup.find('form'):
            result['has_contact_form'] = True
        text_lower = soup.get_text(' ', strip=True).lower()
        if 'gallery' in text_lower or 'portfolio' in text_lower:
            if len(soup.find_all('img')) > 8:
                result['has_photo_gallery'] = True

        raw_services = set()
        for tag in soup.select('nav a, h1, h2, h3, li'):
            txt = tag.get_text(strip=True)
            if 2 < len(txt) < 60 and re.search(r'epoxy|coating|concrete|floor|polyaspartic|polyurea', txt, re.I):
                raw_services.add(txt)
                if len(raw_services) >= 60:
                    break
        result['raw_services'] = sorted(raw_services)[:60]

        if pages_fetched < MAX_PAGES_PER_SITE:
            for link in find_more_links(soup, url, visited):
                if link not in to_visit and link not in visited:
                    to_visit.append(link)

    if blocked and not any_success:
        result['status'] = 'blocked_by_robots'
        return result
    if not any_success:
        result['status'] = 'unreachable'
        return result

    full_text = ' '.join(all_text)
    full_text_lower = full_text.lower()
    for m in PHONE_RE.finditer(full_text):
        result['phones'].append(normalize_phone(m))
    for m in EMAIL_RE.finditer(full_text):
        email = m.group(0)
        if not JUNK_EMAIL_PATTERNS.search(email):
            result['emails'].append(email)

    result['phones'] = list(dict.fromkeys(result['phones']))[:10]
    result['emails'] = list(dict.fromkeys(e.lower() for e in result['emails']))[:10]
    result['services'] = extract_taxonomy(full_text_lower)
    result['service_areas'] = extract_service_areas(full_text)
    result['trust_signals'] = extract_trust_signals(full_text_lower)
    result['status'] = 'ok'
    return result


async def run(args):
    with open(args.infile, newline='') as f:
        contractors = list(csv.DictReader(f))
    if args.limit:
        contractors = contractors[:args.limit]

    robots_cache = {}
    pacer = DomainPacer()
    sem = asyncio.Semaphore(args.concurrency)
    results = [None] * len(contractors)

    async def worker(i, contractor):
        async with sem:
            try:
                results[i] = await enrich_one(client, pacer, robots_cache, contractor)
            except Exception as err:
                results[i] = {**contractor, 'status': 'error', 'error': str(err)}
            r = results[i]
            print(f"[{i+1}/{len(contractors)}] {contractor.get('name', '?')[:40]:40s} "
                  f"status={r['status']:16s} phones={len(r.get('phones', []))} "
                  f"emails={len(r.get('emails', []))} services={len(r.get('services', []))}")

    limits = httpx.Limits(max_connections=args.concurrency * 2)
    try:
        client_kwargs = {'headers': {'User-Agent': USER_AGENT}, 'limits': limits, 'http2': True}
        async with httpx.AsyncClient(**client_kwargs) as client:
            await asyncio.gather(*[worker(i, c) for i, c in enumerate(contractors)])
    except ImportError:
        # h2 package not installed — fall back to HTTP/1.1.
        async with httpx.AsyncClient(headers={'User-Agent': USER_AGENT}, limits=limits) as client:
            await asyncio.gather(*[worker(i, c) for i, c in enumerate(contractors)])

    with open(f'{args.out}.json', 'w') as f:
        json.dump(results, f, indent=2)

    fieldnames = ['name', 'website', 'place_id', 'city', 'state', 'status', 'phones', 'emails',
                  'services', 'raw_services', 'service_areas', 'trust_signals', 'socials',
                  'has_photo_gallery', 'has_contact_form', 'title', 'meta_description', 'logo_url']
    with open(f'{args.out}.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for r in results:
            row = dict(r)
            for key in ('phones', 'emails', 'services', 'raw_services', 'service_areas'):
                row[key] = '; '.join(row.get(key) or [])
            row['trust_signals'] = json.dumps(row.get('trust_signals') or {})
            row['socials'] = json.dumps(row.get('socials') or {})
            writer.writerow(row)

    statuses = defaultdict(int)
    for r in results:
        statuses[r['status']] += 1
    print(f"\nDone. {len(results)} contractors. Status breakdown: {dict(statuses)}")
    dead = [r['name'] for r in results if r['status'] in ('no_website', 'unreachable')]
    if dead:
        print(f"\nDead/missing-site leads (website-rebuild sales list, {len(dead)}):")
        for name in dead:
            print(f"  - {name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--in', dest='infile', default='content/data/contractors-seed.csv')
    parser.add_argument('--out', default='enriched')
    parser.add_argument('--concurrency', type=int, default=8)
    parser.add_argument('--limit', type=int, default=None)
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == '__main__':
    main()
