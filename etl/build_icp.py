#!/usr/bin/env python3
"""Build src/data/icp.json - per-category price levels by country, for the
category breakdown on international comparisons.

Source (public, no API key):

  World Bank International Comparison Program (ICP) 2021 (API source 90),
  measure "Price level index (World = 100)" (Classification code PX.WL),
  for a curated set of COICOP expenditure categories (food, housing &
  utilities, clothing, health, transport, communication, recreation,
  education, restaurants & hotels). We take the 2021 benchmark values and
  re-base each category so the United States reads 100 - the same scale
  the headline country price level (build_global.py) and BEA metros use -
  so a country-vs-country comparison can show which categories are
  relatively pricier or cheaper.

  Limits (disclosed in the UI): ICP category detail exists only for
  benchmark years (2021 here), not annually and not historically, and the
  ICP categories are its own COICOP groupings, not BEA's. The breakdown is
  therefore shown only for country-vs-country comparisons at today's
  dollars.

Run:  etl/.venv/bin/python etl/build_icp.py [--use-cache]

Fails loudly on any shape change; never writes partial output.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "etl" / "raw"
OUT = ROOT / "src" / "data"

USER_AGENT = "Mozilla/5.0 (compatible; cost-of-living-tool; ethanmic6@gmail.com)"

SOURCE = 90              # ICP 2021
MEASURE = "PX.WL"        # Price level index (World = 100)
YEAR = "YR2021"          # benchmark year
BASE_URL = (
    "https://api.worldbank.org/v2/sources/{source}/country/all/series/"
    "{series}/classification/{measure}/time/all/data?format=json&per_page=20000"
)

# COICOP code -> (key, label). Curated to cover a household budget while
# staying digestible.
CATEGORIES = [
    ("1101000", "food", "Food & non-alcoholic drinks"),
    ("9060000", "housing", "Housing & utilities"),
    ("1103000", "clothing", "Clothing & footwear"),
    ("9080000", "health", "Health"),
    ("1107000", "transport", "Transport"),
    ("1108000", "communication", "Communication"),
    ("9110000", "recreation", "Recreation & culture"),
    ("9120000", "education", "Education"),
    ("1111000", "restaurants", "Restaurants & hotels"),
]

MIN_COUNTRIES = 100  # ICP 2021 covers ~170 economies; short means broken


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def get_json(url, dest, use_cache):
    if use_cache and dest.exists():
        print(f"  using cached {dest.name}")
        return json.loads(dest.read_text())
    last = None
    for attempt in range(1, 4):
        try:
            print(f"  GET {url} (attempt {attempt})")
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
            r.raise_for_status()
            data = json.loads(r.content.decode("utf-8-sig"))
            dest.write_text(json.dumps(data))
            return data
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < 3:
                time.sleep(5 * attempt)
    fail(f"download failed after 3 attempts: {url}\n{last}")


def load_category(coicop, use_cache):
    """iso3 -> 2021 price level (World=100) for one COICOP category."""
    url = BASE_URL.format(source=SOURCE, series=coicop, measure=MEASURE)
    data = get_json(url, RAW / f"icp-{coicop}.json", use_cache)
    if not isinstance(data, dict) or "source" not in data:
        fail(f"ICP {coicop}: unexpected envelope shape")
    out = {}
    for row in data["source"]["data"]:
        v = row.get("value")
        if v is None:
            continue
        cc = {x["concept"]: x["id"] for x in row["variable"]}
        if cc.get("Time") != YEAR:
            continue
        iso3 = cc.get("Country")
        if iso3 and len(iso3) == 3:
            out[iso3] = float(v)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"World Bank ICP {SOURCE} price level index ({MEASURE}, {YEAR})")
    raw = {}
    for coicop, key, label in CATEGORIES:
        vals = load_category(coicop, args.use_cache)
        if "USA" not in vals:
            fail(f"category {label}: no U.S. value - cannot re-base to U.S. = 100")
        raw[key] = vals
        print(f"  {key:14} {len(vals)} countries; U.S.={round(vals['USA'], 1)}")

    # Re-base each category to U.S. = 100 and assemble per-country records.
    countries = {}
    for _, key, _ in CATEGORIES:
        us = raw[key]["USA"]
        for iso3, v in raw[key].items():
            countries.setdefault(iso3, {})[key] = round(100 * v / us, 3)
    # Drop the U.S. self-entry only if a caller wants; keep it (== 100) for
    # symmetry so United-States-vs-country comparisons work.
    if len(countries) < MIN_COUNTRIES:
        fail(f"only {len(countries)} countries in ICP join (expected >= {MIN_COUNTRIES})")

    out = {
        "meta": {
            "source": "https://api.worldbank.org/v2/ (ICP 2021, source 90)",
            "measure": MEASURE,
            "measure_name": "Price level index, re-based U.S. = 100",
            "round": "ICP 2021 benchmark",
            "year": 2021,
            "pulled": time.strftime("%Y-%m-%d"),
        },
        "categories": [
            {"key": key, "label": label, "coicop": coicop}
            for coicop, key, label in CATEGORIES
        ],
        # iso3 -> { categoryKey: price level (U.S. = 100) }
        "countries": countries,
    }
    path = OUT / "icp.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path} ({path.stat().st_size // 1024} KB, {len(countries)} countries)")


if __name__ == "__main__":
    main()
