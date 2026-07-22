#!/usr/bin/env python3
"""Build src/data/cpi.json - annual CPI-U index (all items) plus the major
spending categories, the time axis for the generational comparison.

Source (public flat file, no API key):

  BLS time-series database, file cu.data.2.Summaries, CPI-U (series
  prefix CUUR0000), U.S. city average, not seasonally adjusted. We read
  the annual-average observations (period M13):

    - All items (SA0), 1913-latest, 1982-1984 = 100 base -> the headline
      inflation ratio cpi[to] / cpi[from].
    - The major expenditure groups (food, housing, apparel, transport,
      medical care, recreation, education & communication, other) ->
      a category breakdown of *national* inflation between two years.
      These are national, not metro-specific (BEA regional parities only
      exist from ~2008, so historical price levels by city do not exist).

  Category coverage varies by series (apparel to 1913, medical/transport
  to 1935, food/housing/other to 1967, recreation/education to 1993), so
  each is stored with whatever years it has and the UI shows only the
  categories present for both selected years.

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

CU_URL = "https://download.bls.gov/pub/time.series/cu/cu.data.2.Summaries"
ALL_ITEMS = "CUUR0000SA0"    # CPI-U, U.S. city average, all items, NSA
ANNUAL_PERIOD = "M13"        # annual average
BASE_PERIOD = "1982-1984 = 100"
MIN_YEARS = 100              # all-items starts 1913; short means broken

# CPI-U major expenditure groups (series id -> display label). These are
# the BLS groupings, which do not map one-to-one onto BEA's metro
# categories, so they are shown under their own names.
COMPONENTS = [
    ("food", "CUUR0000SAF", "Food & beverages"),
    ("housing", "CUUR0000SAH", "Housing"),
    ("apparel", "CUUR0000SAA", "Apparel"),
    ("transport", "CUUR0000SAT", "Transportation"),
    ("medical", "CUUR0000SAM", "Medical care"),
    ("recreation", "CUUR0000SAR", "Recreation"),
    ("education", "CUUR0000SAE", "Education & communication"),
    ("other", "CUUR0000SAG", "Other goods & services"),
]
MIN_COMPONENT_YEARS = 30  # newest group (recreation/education) is ~1993+


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


def load_annual(path, series_ids):
    """series_id -> {year: index} for the annual (M13) observations."""
    out = {sid: {} for sid in series_ids}
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        header = [c.strip() for c in next(reader)]
        idx = {c: header.index(c) for c in ("series_id", "year", "period", "value")}
        for row in reader:
            if not row:
                continue
            sid = row[idx["series_id"]].strip()
            if sid in out and row[idx["period"]].strip() == ANNUAL_PERIOD:
                out[sid][int(row[idx["year"]])] = round(float(row[idx["value"]]), 3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    print("BLS CPI-U annual index + major groups (cu.data.2.Summaries)")
    dest = RAW / "cu.data.2.Summaries"
    download(CU_URL, dest, args.use_cache)

    series_ids = [ALL_ITEMS] + [sid for _, sid, _ in COMPONENTS]
    series = load_annual(dest, series_ids)

    annual = series[ALL_ITEMS]
    if len(annual) < MIN_YEARS:
        fail(f"only {len(annual)} annual points for {ALL_ITEMS} "
             f"(expected >= {MIN_YEARS}) - series/period code changed?")
    first, last = min(annual), max(annual)
    print(f"  all items: {len(annual)} years, {first}-{last}; "
          f"{first}={annual[first]}, {last}={annual[last]}")

    components = []
    for key, sid, label in COMPONENTS:
        data = series[sid]
        if len(data) < MIN_COMPONENT_YEARS:
            fail(f"component {sid} ({label}): only {len(data)} years "
                 f"(expected >= {MIN_COMPONENT_YEARS}) - series id changed?")
        if data.get(last) is None:
            fail(f"component {sid} ({label}) is missing the latest year {last}")
        components.append({
            "key": key,
            "label": label,
            "series": sid,
            "first_year": min(data),
            "annual": {str(y): data[y] for y in sorted(data)},
        })
        print(f"  {key:11} {min(data)}-{max(data)} ({len(data)} yrs)")

    out = {
        "meta": {
            "source": CU_URL,
            "series": ALL_ITEMS,
            "series_name": "CPI-U, U.S. city average, all items, NSA",
            "base_period": BASE_PERIOD,
            "first_year": first,
            "last_year": last,
            "categories_note": "BLS major expenditure groups; national, not "
                               "metro-specific",
            "pulled": time.strftime("%Y-%m-%d"),
        },
        # year (string key) -> annual-average all-items index
        "annual": {str(y): annual[y] for y in sorted(annual)},
        "components": components,
    }
    path = OUT / "cpi.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
