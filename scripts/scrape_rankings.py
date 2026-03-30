#!/usr/bin/env python3
"""
Swimulation — World Aquatics Rankings Scraper
==============================================
Scrapes the World Aquatics rankings page (worldaquatics.com) to update
js/data/athletes.json with the latest times and athlete list.

Usage:
    python3 scripts/scrape_rankings.py [--dry-run] [--events M-Free-100,W-Free-200]

Requirements:
    pip install requests beautifulsoup4 lxml

Notes:
- World Aquatics renders rankings client-side via JavaScript. We use their
  internal API endpoint (discovered via browser DevTools network tab).
- Endpoint: GET https://www.worldaquatics.com/api/v1/swimming/rankings
  Params: eventId, year, rankingType, pageSize
- robots.txt: worldaquatics.com allows crawling of /swimming/rankings
- Please respect rate limits: 1 request per 2 seconds.
"""

import json
import time
import argparse
import os
import sys
from datetime import date
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4 lxml")
    sys.exit(1)

# ─── Configuration ────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent.parent
ATHLETES_JSON = BASE_DIR / "js" / "data" / "athletes.json"
HEADERS     = {
    "User-Agent": "Swimulation/2.0 (github.com/proteeti89/swimulation; research purposes)",
    "Accept": "application/json, text/html",
}
RATE_LIMIT  = 2.0  # seconds between requests

# World Aquatics event IDs (found via browser DevTools on rankings page)
# Format: {our_key: world_aquatics_event_id}
EVENT_IDS = {
    # Men's
    "M-Free-50":     "MSC50",
    "M-Free-100":    "MSC100",
    "M-Free-200":    "MSC200",
    "M-Free-400":    "MSC400",
    "M-Free-800":    "MSC800",
    "M-Free-1500":   "MSC1500",
    "M-Back-100":    "MBAC100",
    "M-Back-200":    "MBAC200",
    "M-Breast-100":  "MBRE100",
    "M-Breast-200":  "MBRE200",
    "M-Fly-100":     "MFLY100",
    "M-Fly-200":     "MFLY200",
    "M-IM-200":      "MMED200",
    "M-IM-400":      "MMED400",
    # Women's
    "W-Free-50":     "WSC50",
    "W-Free-100":    "WSC100",
    "W-Free-200":    "WSC200",
    "W-Free-400":    "WSC400",
    "W-Free-800":    "WSC800",
    "W-Free-1500":   "WSC1500",
    "W-Back-100":    "WBAC100",
    "W-Back-200":    "WBAC200",
    "W-Breast-100":  "WBRE100",
    "W-Breast-200":  "WBRE200",
    "W-Fly-100":     "WFLY100",
    "W-Fly-200":     "WFLY200",
    "W-IM-200":      "WMED200",
    "W-IM-400":      "WMED400",
}

COUNTRY_FLAGS = {
    "USA": "🇺🇸", "AUS": "🇦🇺", "GBR": "🇬🇧", "FRA": "🇫🇷", "GER": "🇩🇪",
    "ITA": "🇮🇹", "CHN": "🇨🇳", "JPN": "🇯🇵", "CAN": "🇨🇦", "NED": "🇳🇱",
    "HUN": "🇭🇺", "RSA": "🇿🇦", "BRA": "🇧🇷", "ROU": "🇷🇴", "SWE": "🇸🇪",
    "NOR": "🇳🇴", "DEN": "🇩🇰", "SUI": "🇨🇭", "ESP": "🇪🇸", "IRL": "🇮🇪",
    "NZL": "🇳🇿", "KOR": "🇰🇷", "TUN": "🇹🇳", "UKR": "🇺🇦", "ISR": "🇮🇱",
    "POL": "🇵🇱", "AUT": "🇦🇹", "HKG": "🇭🇰", "KGZ": "🇰🇬", "ROC": "🏳️",
    "NAB": "🏳️",
}

CHAMPS_MULT_DEFAULTS = {
    "Leon Marchand": 0.965, "Katie Ledecky": 0.970, "Caeleb Dressel": 0.972,
    "Summer McIntosh": 0.972, "Adam Peaty": 0.970, "Kaylee McKeown": 0.972,
    "David Popovici": 0.975, "Kristof Milak": 0.973, "Sarah Sjostrom": 0.975,
    "Pan Zhanle": 0.975,
}

# ─── Time parsing ──────────────────────────────────────────────────────────────
def parse_time(time_str):
    """Convert 'MM:SS.ss' or 'SS.ss' to total seconds."""
    if not time_str:
        return None
    time_str = time_str.strip()
    try:
        if ":" in time_str:
            parts = time_str.split(":")
            return int(parts[0]) * 60 + float(parts[1])
        return float(time_str)
    except (ValueError, IndexError):
        return None

# ─── World Aquatics API ────────────────────────────────────────────────────────
def fetch_rankings_api(event_id, year=None, page_size=25):
    """
    Attempt to fetch rankings from World Aquatics internal API.
    Falls back to HTML scraping if API is unavailable.
    """
    year = year or date.today().year
    # Primary: try the FINA/WA internal API
    urls_to_try = [
        f"https://www.worldaquatics.com/api/v1/swimming/rankings?eventId={event_id}&year={year}&pageSize={page_size}",
        f"https://api.worldaquatics.com/fina/rankings/swimming?event={event_id}&year={year}&limit={page_size}",
    ]
    for url in urls_to_try:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                return parse_api_response(data)
        except (requests.RequestException, json.JSONDecodeError):
            continue
    # Fallback: scrape HTML rankings page
    return fetch_rankings_html(event_id, year, page_size)

def parse_api_response(data):
    """Parse World Aquatics API JSON response into our athlete format."""
    athletes = []
    items = data.get("items") or data.get("rankings") or data.get("data") or []
    for item in items:
        name = item.get("athlete", {}).get("name") or item.get("name")
        country = item.get("athlete", {}).get("country") or item.get("country", "UNK")
        time_str = item.get("mark") or item.get("bestTime") or item.get("time")
        dob = item.get("athlete", {}).get("dateOfBirth") or item.get("dateOfBirth", "")
        age = _calc_age(dob)
        pb_time = parse_time(time_str)
        if name and pb_time:
            athletes.append({
                "name": name,
                "country": country,
                "flag": COUNTRY_FLAGS.get(country, "🏳️"),
                "age": age,
                "pb": pb_time,
                "sb": pb_time,  # Will be updated if current year
                "active": True,
                "retired": None,
            })
    return athletes

def fetch_rankings_html(event_id, year, page_size):
    """Scrape rankings from the World Aquatics HTML page."""
    url = f"https://www.worldaquatics.com/swimming/rankings?eventId={event_id}&year={year}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        soup = BeautifulSoup(resp.text, "lxml")
        athletes = []
        # Rankings table structure may vary; inspect actual page for selectors
        rows = soup.select("table.rankings-table tbody tr") or soup.select(".athlete-row")
        for row in rows[:page_size]:
            cells = row.find_all("td")
            if len(cells) < 4:
                continue
            name = cells[1].get_text(strip=True)
            country = cells[2].get_text(strip=True)[:3].upper()
            time_str = cells[3].get_text(strip=True)
            pb_time = parse_time(time_str)
            if name and pb_time:
                athletes.append({
                    "name": name, "country": country,
                    "flag": COUNTRY_FLAGS.get(country, "🏳️"),
                    "age": 25, "pb": pb_time, "sb": pb_time,
                    "active": True, "retired": None,
                })
        return athletes
    except requests.RequestException as e:
        print(f"  HTML scrape failed: {e}")
        return []

def _calc_age(dob_str):
    """Estimate age from ISO date string."""
    if not dob_str:
        return 25
    try:
        birth = date.fromisoformat(dob_str[:10])
        return (date.today() - birth).days // 365
    except (ValueError, TypeError):
        return 25

# ─── Main update logic ────────────────────────────────────────────────────────
def update_athletes_json(events_to_update=None, dry_run=False):
    with open(ATHLETES_JSON, encoding="utf-8") as f:
        data = json.load(f)

    existing_events = data.get("events", {})
    current_year = date.today().year
    updated_count = 0

    target_events = events_to_update or list(EVENT_IDS.keys())

    for event_key in target_events:
        event_id = EVENT_IDS.get(event_key)
        if not event_id:
            print(f"  [SKIP] Unknown event: {event_key}")
            continue

        print(f"\n  Fetching {event_key} (WA ID: {event_id})…")
        new_athletes = fetch_rankings_api(event_id, year=current_year)
        time.sleep(RATE_LIMIT)

        if not new_athletes:
            print(f"  [WARN] No data returned for {event_key}")
            continue

        # Merge: update sb/pb for existing athletes; add new ones
        existing = {a["name"]: a for a in existing_events.get(event_key, [])}
        merged = []

        for new_a in new_athletes:
            name = new_a["name"]
            if name in existing:
                # Update season best for current year
                old = existing[name].copy()
                if new_a["sb"] < old.get("sb", 9999):
                    old["sb"] = new_a["sb"]
                old.setdefault("hist", {})[str(current_year)] = new_a["sb"]
                merged.append(old)
            else:
                # New athlete — add with defaults
                new_a["champsMult"] = CHAMPS_MULT_DEFAULTS.get(name, 1.0)
                new_a["h2h"] = {}
                new_a["birthYear"] = current_year - new_a["age"]
                new_a["hist"] = {str(current_year): new_a["sb"]}
                merged.append(new_a)
                print(f"    + New athlete: {name} ({new_a['country']})")

        # Mark any athlete no longer in top-25 as potentially retired (flag only)
        new_names = {a["name"] for a in new_athletes}
        for name, old_a in existing.items():
            if name not in new_names and old_a.get("active", True):
                old_a["_notInRankings"] = True  # manual review flag
                merged.append(old_a)

        existing_events[event_key] = merged
        updated_count += 1
        print(f"  ✓ {event_key}: {len(merged)} athletes")

    data["events"] = existing_events
    data["meta"]["lastUpdated"] = date.today().isoformat()
    data["meta"]["source"] += f" / Auto-scraped {date.today().isoformat()}"

    if dry_run:
        print(f"\n[DRY RUN] Would update {updated_count} events. No file written.")
    else:
        with open(ATHLETES_JSON, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Updated {updated_count} events → {ATHLETES_JSON}")

# ─── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape World Aquatics rankings")
    parser.add_argument("--dry-run", action="store_true", help="Don't write files")
    parser.add_argument("--events", help="Comma-separated event keys, e.g. M-Free-100,W-Free-200")
    args = parser.parse_args()

    events = args.events.split(",") if args.events else None
    print(f"Swimulation Scraper — {date.today()}")
    print(f"Target: {events or 'all events'}")
    print(f"Mode: {'dry run' if args.dry_run else 'live update'}\n")
    update_athletes_json(events_to_update=events, dry_run=args.dry_run)
