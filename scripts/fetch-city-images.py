#!/usr/bin/env python3
"""
One-time scrape of a representative photo per metro, from Wikipedia's
public REST API (no key, no cost) + Wikimedia Commons (freely licensed
images). Run manually with `python3 scripts/fetch-city-images.py` —
never called at request time, and safe to re-run (skips metros that
already have a downloaded image + manifest entry).

Output: images/cities/{state_slug}/{slug}.jpg (resized/recompressed,
self-hosted — never hotlinked) + content/data/city-images.json mapping
"{state_slug}/{slug}" -> { path, sourceTitle, sourcePageUrl } for on-page
attribution. Keyed by state+slug, not slug alone — 16 city names (Columbus,
Portland, Springfield, etc.) repeat across different states in this
dataset, so a bare-slug key silently overwrote entries for the wrong city.
"""
import json
import os
import re
import time
import urllib.request
import urllib.parse
from io import BytesIO

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow is required: pip3 install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METROS_PATH = os.path.join(ROOT, "content", "data", "metros.json")
MANIFEST_PATH = os.path.join(ROOT, "content", "data", "city-images.json")
IMAGES_DIR = os.path.join(ROOT, "images", "cities")

USER_AGENT = "EpoxyGrindBot/1.0 (one-time city-hero image fetch; contact: anthonydventurini@gmail.com)"
HERO_SIZE = (1600, 900)  # 16:9, matches the local-page hero design

STATE_NAME_OVERRIDES = {
    "district-of-columbia": "Washington, D.C.",
}


def state_full_name(state_slug):
    if state_slug in STATE_NAME_OVERRIDES:
        return STATE_NAME_OVERRIDES[state_slug]
    return " ".join(w.capitalize() for w in state_slug.split("-"))


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_summary(title):
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
    try:
        return fetch_json(url)
    except Exception:
        return None


def find_summary(metro):
    state_name = state_full_name(metro["state_slug"])
    candidates = [f"{metro['city']}, {state_name}", metro["city"]]
    for title in candidates:
        data = fetch_summary(title.replace(" ", "_"))
        if data and data.get("type") != "disambiguation" and data.get("originalimage"):
            return data
    return None


def download_and_process(image_url, out_path):
    req = urllib.request.Request(image_url, headers={"User-Agent": USER_AGENT})
    raw = None
    backoff = 5
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
            break
        except urllib.error.HTTPError as err:
            if err.code == 429 and attempt < 4:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise
    if raw is None:
        raise RuntimeError("exhausted retries")

    img = Image.open(BytesIO(raw)).convert("RGB")
    w, h = img.size
    target_ratio = HERO_SIZE[0] / HERO_SIZE[1]
    current_ratio = w / h
    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        x0 = (w - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, h))
    else:
        new_h = int(w / target_ratio)
        y0 = (h - new_h) // 2
        img = img.crop((0, y0, w, y0 + new_h))
    img = img.resize(HERO_SIZE, Image.LANCZOS)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "JPEG", quality=78, optimize=True)


def main():
    import sys
    limit = None
    if len(sys.argv) > 1 and sys.argv[1].startswith("--limit="):
        limit = int(sys.argv[1].split("=")[1])

    with open(METROS_PATH) as f:
        metros = json.load(f)["metros"]
    if limit:
        metros = metros[:limit]

    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH) as f:
            manifest = json.load(f)

    found = 0
    missing = 0
    skipped = 0

    for i, metro in enumerate(metros):
        slug = metro["slug"]
        state_slug = metro["state_slug"]
        key = f"{state_slug}/{slug}"
        out_path = os.path.join(IMAGES_DIR, state_slug, f"{slug}.jpg")
        rel_path = f"/images/cities/{state_slug}/{slug}.jpg"
        file_exists = os.path.exists(out_path)

        if key in manifest and file_exists:
            skipped += 1
            continue

        summary = find_summary(metro)
        if not summary:
            missing += 1
            print(f"[{i+1}/{len(metros)}] {metro['city']}, {metro['state']} — no image found")
            time.sleep(0.15)
            continue

        if not file_exists:
            try:
                download_and_process(summary["originalimage"]["source"], out_path)
            except Exception as err:
                missing += 1
                print(f"[{i+1}/{len(metros)}] {metro['city']}, {metro['state']} — download failed: {err}")
                time.sleep(0.15)
                continue

        manifest[key] = {
            "path": rel_path,
            "sourceTitle": summary.get("title"),
            "sourcePageUrl": summary.get("content_urls", {}).get("desktop", {}).get("page"),
        }
        found += 1
        reused = " (reused existing file)" if file_exists else ""
        print(f"[{i+1}/{len(metros)}] {metro['city']}, {metro['state']} — OK ({summary.get('title')}){reused}")

        # Save incrementally so a partial run isn't wasted.
        with open(MANIFEST_PATH, "w") as f:
            json.dump(manifest, f, indent=2)

        time.sleep(0.6 if not file_exists else 0.2)

    print(f"\nDone. {found} found, {missing} missing, {skipped} already had one. Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
