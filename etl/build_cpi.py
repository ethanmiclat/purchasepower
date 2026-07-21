#!/usr/bin/env python3
"""Build src/data/cpi.json - annual CPI-U index, the time axis for the
generational comparison.

Source (public flat file, no API key):

  BLS time-series database, series CUUR0000SA0 = Consumer Price Index for
  All Urban Consumers (CPI-U), U.S. city average, all items, not
  seasonally adjusted. We read the annual-average observations (period
  M13) from cu.data.1.AllItems, giving one index value per year back to
  1913 (1982-1984 = 100 base).

  A ratio of two years' index values converts dollars between them:
  cpi[to] / cpi[from]. This is the national inflation adjustment layered
  on top of the place-based BEA ratio in the comparison.

Run:  etl/.venv/bin/python etl/build_cpi.py [--use-cache]

Fails loudly on a missing series or shape change; never writes partial
output. The download lands in etl/raw/ (gitignored).
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "etl" / "raw"
OUT = ROOT / "src" / "data"

USER_AGENT = "Mozilla/5.0 (compatible; cost-of-living-tool; ethanmic6@gmail.com)"

CU_URL = "https://download.bls.gov/pub/time.series/cu/cu.data.1.AllItems"
SERIES_ID = "CUUR0000SA0"   # CPI-U, U.S. city average, all items, NSA
ANNUAL_PERIOD = "M13"        # annual average
BASE_PERIOD = "1982-1984 = 100"
MIN_YEARS = 100              # CPI-U starts 1913; anything short means broken


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def download(url, dest, use_cache):
    if use_cache and dest.exists():
        print(f"  using cached {dest.name}")
        return
    last = None
    for attempt in range(1, 4):
        try:
            print(f"  GET {url} (attempt {attempt})")
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=300)
            r.raise_for_status()
            dest.write_bytes(r.content)
            return
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < 3:
                time.sleep(5 * attempt)
    fail(f"download failed after 3 attempts: {url}\n{last}")


def load_annual(path):
    annual = {}
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = [c.strip() for c in next(reader)]
        idx = {c: header.index(c) for c in ("series_id", "year", "period", "value")}
        for row in reader:
            if not row:
                continue
            if row[idx["series_id"]].strip() != SERIES_ID:
                continue
            if row[idx["period"]].strip() != ANNUAL_PERIOD:
                continue
            year = int(row[idx["year"]])
            annual[year] = round(float(row[idx["value"]]), 3)
    if len(annual) < MIN_YEARS:
        fail(f"only {len(annual)} annual CPI points for {SERIES_ID} "
             f"(expected >= {MIN_YEARS}) - series or period code changed?")
    return annual


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"BLS CPI-U annual index ({SERIES_ID})")
    dest = RAW / "cu.data.1.AllItems"
    download(CU_URL, dest, args.use_cache)
    annual = load_annual(dest)
    first, last = min(annual), max(annual)
    print(f"  {len(annual)} years, {first}-{last}; "
          f"{first}={annual[first]}, {last}={annual[last]}")

    out = {
        "meta": {
            "source": CU_URL,
            "series": SERIES_ID,
            "series_name": "CPI-U, U.S. city average, all items, NSA",
            "base_period": BASE_PERIOD,
            "first_year": first,
            "last_year": last,
            "pulled": time.strftime("%Y-%m-%d"),
        },
        # year (string key) -> annual-average index
        "annual": {str(y): annual[y] for y in sorted(annual)},
    }
    path = OUT / "cpi.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
