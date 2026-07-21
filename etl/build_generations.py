#!/usr/bin/env python3
"""Build src/data/generations.json - generational cohort definitions plus
nominal median household income by year (context only).

Two parts:

1. Cohort definitions (Pew Research Center birth-year boundaries). Each
   cohort is a labeled shortcut into the year picker on the compare page:
   selecting "Millennials" seeds a representative calendar year (roughly
   when that cohort was coming of age, ~age 25). The generation is only a
   convenience filter over a plain year - we do NOT model a cohort at a
   fixed age; the user is always picking an actual calendar year that the
   CPI series (build_cpi.py) then adjusts between.

2. Median household income by year, from FRED series MEHOINUSA646N (a
   public keyless CSV export of the Census Bureau's nominal median
   household income, all races). This is shown alongside a historical
   result as context - "a typical household earned about this that year" -
   and is NEVER part of the equivalence math (that is CPI + BEA only). It
   is nominal (not inflation-adjusted) and unadjusted for household size,
   and only exists from 1984 on; both caveats are disclosed in the UI.

Run:  etl/.venv/bin/python etl/build_generations.py [--use-cache]

Fails loudly on a shape change; never writes partial output.
"""

import argparse
import csv
import io
import sys
import time
import json
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "etl" / "raw"
OUT = ROOT / "src" / "data"

USER_AGENT = "Mozilla/5.0 (compatible; cost-of-living-tool; ethanmic6@gmail.com)"

# FRED CSV export (no API key). MEHOINUSA646N = Median Household Income in
# the United States, Current Dollars, Annual (Census/CPS), 1984-present.
INCOME_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MEHOINUSA646N"
INCOME_SERIES = "MEHOINUSA646N"
INCOME_SOURCE_NAME = (
    "Median Household Income in the United States (nominal), U.S. Census "
    "Bureau via FRED"
)

# Pew Research Center generation boundaries (birth years). ref_year is a
# representative calendar year (~age 25, the coming-of-age era) used to
# seed the year picker; it is a labeling choice, disclosed in methodology.
COHORTS = [
    {"key": "silent", "label": "Silent Generation",
     "birth_start": 1928, "birth_end": 1945, "ref_year": 1958},
    {"key": "boomer", "label": "Baby Boomers",
     "birth_start": 1946, "birth_end": 1964, "ref_year": 1975},
    {"key": "genx", "label": "Generation X",
     "birth_start": 1965, "birth_end": 1980, "ref_year": 1995},
    {"key": "millennial", "label": "Millennials",
     "birth_start": 1981, "birth_end": 1996, "ref_year": 2011},
    {"key": "genz", "label": "Generation Z",
     "birth_start": 1997, "birth_end": 2012, "ref_year": 2022},
]

MIN_INCOME_YEARS = 30  # 1984-present is ~40 points; short means broken


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def download_text(url, dest, use_cache):
    if use_cache and dest.exists():
        print(f"  using cached {dest.name}")
        return dest.read_text()
    last = None
    for attempt in range(1, 4):
        try:
            print(f"  GET {url} (attempt {attempt})")
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
            r.raise_for_status()
            dest.write_text(r.text)
            return r.text
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < 3:
                time.sleep(5 * attempt)
    fail(f"download failed after 3 attempts: {url}\n{last}")


def load_income(use_cache):
    text = download_text(INCOME_URL, RAW / "fred-median-income.csv", use_cache)
    reader = csv.reader(io.StringIO(text))
    header = [c.strip() for c in next(reader)]
    # FRED CSVs use either "DATE" or "observation_date" for the date column;
    # the value column is the series id.
    date_col = next((i for i, c in enumerate(header)
                     if c.lower() in ("date", "observation_date")), None)
    val_col = next((i for i, c in enumerate(header) if c == INCOME_SERIES), None)
    if date_col is None or val_col is None:
        fail(f"FRED CSV header changed: {header}")
    income = {}
    for row in reader:
        if not row or len(row) <= max(date_col, val_col):
            continue
        raw = row[val_col].strip()
        if raw in ("", "."):  # FRED marks missing observations with "."
            continue
        year = int(row[date_col][:4])
        income[year] = int(round(float(raw)))
    if len(income) < MIN_INCOME_YEARS:
        fail(f"only {len(income)} median-income years (expected >= "
             f"{MIN_INCOME_YEARS}) - FRED series changed?")
    return income


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"FRED median household income ({INCOME_SERIES})")
    income = load_income(args.use_cache)
    first, last = min(income), max(income)
    print(f"  {len(income)} years, {first}-{last}; {last}=${income[last]:,}")

    out = {
        "meta": {
            "cohort_source": "Pew Research Center generation definitions",
            "income_source": INCOME_URL,
            "income_series": INCOME_SERIES,
            "income_source_name": INCOME_SOURCE_NAME,
            "income_years": f"{first}-{last}",
            "pulled": time.strftime("%Y-%m-%d"),
        },
        "cohorts": COHORTS,
        # year (string key) -> nominal median household income (USD)
        "median_income": {str(y): income[y] for y in sorted(income)},
    }
    path = OUT / "generations.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
