#!/usr/bin/env python3
"""
Contractor discovery scraper (BUILD-contractor-discovery.md / BUILD-everything.md
step 1). Searches Google Places API (New) Text Search across metros to find
epoxy/concrete-coating contractors. Output feeds scripts/enrich-contractors.py.

Cost note: this hits the Places API (New) Text Search endpoint with an
Essentials-tier field mask only (id/displayName/websiteUri/formattedAddress/
location — no reviews/photos/rating). Still real money per call; set a daily
quota cap + budget alert in Google Cloud Console before a full run.

Usage:
  python3 scripts/discover-contractors.py --tiers 1 --limit 3   # test batch
  python3 scripts/discover-contractors.py --tiers 1,2           # full run
"""
import argparse
import asyncio
import csv
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

ROOT = Path(__file__).resolve().parent.parent
METROS_PATH = ROOT / "content" / "data" / "metros.json"
SEED_CSV_PATH = ROOT / "content" / "data" / "contractors-seed.csv"
DISCOVERED_JSON_PATH = ROOT / "content" / "data" / "contractors-discovered.json"

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = "places.id,places.displayName,places.websiteUri,places.formattedAddress,places.location,nextPageToken"
QUERY_TEMPLATES = [
    "epoxy flooring {city} {state}",
    "garage floor coating {city} {state}",
    "concrete coating contractor {city} {state}",
]
PACE_SECONDS = 0.2
MAX_PAGES_PER_QUERY = 3  # ~20 results/page, cap ~60/query per the spec
PAGE_TOKEN_DELAY = 2.0  # Google: next_page_token isn't valid for a couple seconds
EST_COST_PER_CALL = 0.032  # Text Search Pro-tier ballpark; confirm actual in Cloud Console


def domain_of(url):
    if not url:
        return None
    try:
        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return None


def load_metros(tiers):
    raw = json.loads(METROS_PATH.read_text())
    return [m for m in raw["metros"] if m.get("tier") in tiers]


def load_existing_seed():
    if not SEED_CSV_PATH.exists():
        return []
    with SEED_CSV_PATH.open(newline="") as f:
        return list(csv.DictReader(f))


async def post_with_retry(client, body, headers, max_attempts=4):
    for attempt in range(max_attempts):
        resp = await client.post(PLACES_SEARCH_URL, json=body, headers=headers)
        if resp.status_code == 200:
            return resp
        if resp.status_code == 429 or resp.status_code >= 500:
            retry_after = resp.headers.get("Retry-After")
            backoff = float(retry_after) if retry_after else (0.5 * (2 ** attempt) + 0.25)
            if attempt < max_attempts - 1:
                await asyncio.sleep(backoff)
            continue
        print(f"    HTTP {resp.status_code}: {resp.text[:200]}")
        return None
    return None


async def search_query(client, headers, query, stats):
    results = []
    page_token = None
    for _ in range(MAX_PAGES_PER_QUERY):
        body = {"textQuery": query, "pageToken": page_token} if page_token else {"textQuery": query}
        resp = await post_with_retry(client, body, headers)
        stats["calls"] += 1
        if resp is None:
            break
        data = resp.json()
        results.extend(data.get("places", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
        await asyncio.sleep(PAGE_TOKEN_DELAY)
    return results


async def run(metros, api_key, existing_rows):
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
        "Content-Type": "application/json",
    }
    seen_place_ids = {r["place_id"] for r in existing_rows if r.get("place_id")}
    seen_domains = {domain_of(r["website"]) for r in existing_rows if r.get("website")}
    seen_domains.discard(None)

    merged_rows = list(existing_rows)
    discovered_full = []
    stats = {"calls": 0}

    async with httpx.AsyncClient(timeout=20) as client:
        for i, metro in enumerate(metros):
            city, state = metro["city"], metro["state"]
            new_this_metro = 0
            for template in QUERY_TEMPLATES:
                query = template.format(city=city, state=state)
                places = await search_query(client, headers, query, stats)
                for p in places:
                    pid = p.get("id")
                    website = p.get("websiteUri")
                    d = domain_of(website)
                    if pid and pid in seen_place_ids:
                        continue
                    if d and d in seen_domains:
                        continue
                    if pid:
                        seen_place_ids.add(pid)
                    if d:
                        seen_domains.add(d)
                    loc = p.get("location", {})
                    row = {
                        "name": p.get("displayName", {}).get("text", ""),
                        "website": website or "",
                        "place_id": pid or "",
                        "city": city,
                        "state": state,
                    }
                    merged_rows.append(row)
                    discovered_full.append({
                        **row,
                        "address": p.get("formattedAddress", ""),
                        "lat": loc.get("latitude"),
                        "lon": loc.get("longitude"),
                        "metro_slug": metro.get("slug"),
                    })
                    new_this_metro += 1
                await asyncio.sleep(PACE_SECONDS)
            print(f"  [{i + 1}/{len(metros)}] {city}, {state}: +{new_this_metro} new (running total {len(merged_rows)}, {stats['calls']} calls so far)")

    return merged_rows, discovered_full, stats


def write_outputs(merged_rows, discovered_full):
    with SEED_CSV_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "website", "place_id", "city", "state"])
        writer.writeheader()
        writer.writerows(merged_rows)

    with DISCOVERED_JSON_PATH.open("w") as f:
        json.dump(discovered_full, f, indent=2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tiers", default="1,2", help="comma-separated metro tiers, e.g. 1,2")
    parser.add_argument("--limit", type=int, default=None, help="only search the first N metros (testing)")
    args = parser.parse_args()

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise SystemExit("GOOGLE_MAPS_API_KEY not set in environment.")

    tiers = {int(t) for t in args.tiers.split(",")}
    metros = load_metros(tiers)
    if args.limit:
        metros = metros[: args.limit]

    existing_rows = load_existing_seed()
    print(f"Existing seed rows: {len(existing_rows)}")
    print(f"Metros to search (tiers {sorted(tiers)}): {len(metros)}")
    print(f"Queries per metro: {len(QUERY_TEMPLATES)} -> up to {len(metros) * len(QUERY_TEMPLATES)} initial calls (before pagination)\n")

    started = time.time()
    merged_rows, discovered_full, stats = asyncio.run(run(metros, api_key, existing_rows))
    elapsed = time.time() - started

    write_outputs(merged_rows, discovered_full)

    new_count = len(merged_rows) - len(existing_rows)
    print(f"\nDone in {elapsed:.1f}s.")
    print(f"Total Places API calls: {stats['calls']}")
    print(f"Estimated cost: ~${stats['calls'] * EST_COST_PER_CALL:.2f} (ballpark only — confirm actual spend in Google Cloud Console)")
    print(f"New contractors found: {new_count}")
    print(f"Total contractors in {SEED_CSV_PATH.name}: {len(merged_rows)}")
    with_website = sum(1 for r in merged_rows if r.get("website"))
    with_place_id = sum(1 for r in merged_rows if r.get("place_id"))
    print(f"  with website: {with_website}/{len(merged_rows)}")
    print(f"  with place_id: {with_place_id}/{len(merged_rows)}")


if __name__ == "__main__":
    main()
