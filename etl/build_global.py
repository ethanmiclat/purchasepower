#!/usr/bin/env python3
"""Build src/data/countries.json - country-level price levels for the
global comparison mode.

Source (public, no API key):

  World Bank API, two live World Development Indicators series:
    PA.NUS.PPP  - PPP conversion factor, GDP (local currency per intl $)
    PA.NUS.FCRF - Official exchange rate (local currency per US$, avg)

  Their ratio, PPP / exchange rate, is the price level index: how a
  country's overall price level compares to the U.S. dollar's. It is 1.0
  for the United States by construction (PPP factor and exchange rate are
  both 1), so re-basing to U.S. = 100 (x100) puts every country on the
  same scale BEA Regional Price Parities use for U.S. metros. A country
  record then plugs into the same equivalentSalary/priceDiff math as a
  U.S. metro, but carries only an all-items level: the World Bank does not
  publish the housing/goods/utilities/other-services split BEA does, so
  countries get no category breakdown, tax, or wage data.

  (This reproduces the World Bank's own now-archived "price level ratio"
  indicator PA.NUS.PPPC.RF from its two live component series.)

Run:  etl/.venv/bin/python etl/build_global.py [--use-cache]

--use-cache reuses the JSON already saved in etl/raw/ instead of
re-hitting the API. Fails loudly on any shape change; never writes
partial output.
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

PPP_INDICATOR = "PA.NUS.PPP"    # PPP conversion factor, GDP (LCU per intl $)
FX_INDICATOR = "PA.NUS.FCRF"    # Official exchange rate (LCU per US$, avg)
INDICATOR_NAME = "Price level ratio of PPP conversion factor to market exchange rate"
COUNTRY_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400"
# Recent window; per country we use the latest year both series report.
DATE_RANGE = "2015:2025"
VALUE_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/"
    "{indicator}?format=json&per_page=20000&date=" + DATE_RANGE
)

MIN_COUNTRIES = 100  # the series cover ~180 economies; fewer means broken

# A country's price level on the U.S. = 100 scale should fall in a sane
# band. Values outside it come from a distorted official exchange rate
# (a dollarized economy, or a pegged/multiple-rate regime like Iran's or
# Liberia's) rather than a real price level, and would drive nonsense
# comparisons, so they are dropped with a note rather than shown.
PLAUSIBLE_MIN = 5.0
PLAUSIBLE_MAX = 200.0


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
            # World Bank responses sometimes carry a UTF-8 BOM; strip it.
            data = json.loads(r.content.decode("utf-8-sig"))
            dest.write_text(json.dumps(data))
            return data
        except Exception as e:  # noqa: BLE001 - retry any transient failure
            last = e
            if attempt < 3:
                time.sleep(5 * attempt)
    fail(f"download failed after 3 attempts: {url}\n{last}")


def load_countries(use_cache):
    """iso3 -> {name, region}; real economies only (drops aggregates)."""
    data = get_json(COUNTRY_URL, RAW / "wb-countries.json", use_cache)
    if not isinstance(data, list) or len(data) != 2:
        fail("World Bank country list: unexpected envelope shape")
    out = {}
    for c in data[1]:
        region = (c.get("region") or {}).get("value", "").strip()
        # Aggregates (World, regions, income groups) carry region "Aggregates".
        if not region or region == "Aggregates":
            continue
        iso3 = (c.get("id") or "").strip()
        name = (c.get("name") or "").strip()
        if len(iso3) != 3 or not name:
            continue
        out[iso3] = {"name": name, "region": region}
    if len(out) < MIN_COUNTRIES:
        fail(f"only {len(out)} real countries in WB list - format changed?")
    return out


def load_series(indicator, cache_name, use_cache):
    """iso3 -> {year: value} across the date window for one indicator."""
    data = get_json(VALUE_URL.format(indicator=indicator),
                    RAW / cache_name, use_cache)
    if not isinstance(data, list) or len(data) != 2 or data[1] is None:
        fail(f"World Bank indicator {indicator}: unexpected envelope shape")
    out = {}
    for obs in data[1]:
        iso3 = (obs.get("countryiso3code") or "").strip()
        v = obs.get("value")
        if len(iso3) != 3 or v is None:
            continue
        out.setdefault(iso3, {})[int(obs["date"])] = float(v)
    return out


def latest_ratio(ppp, fx):
    """Price level = PPP / FX at the latest year both report (FX != 0)."""
    years = sorted(set(ppp) & set(fx), reverse=True)
    for y in years:
        if fx[y]:
            return ppp[y] / fx[y], y
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    print(f"World Bank price level = {PPP_INDICATOR} / {FX_INDICATOR}")
    meta_countries = load_countries(args.use_cache)
    ppp = load_series(PPP_INDICATOR, "wb-ppp.json", args.use_cache)
    fx = load_series(FX_INDICATOR, "wb-fcrf.json", args.use_cache)

    us_level, us_year = latest_ratio(ppp.get("USA", {}), fx.get("USA", {}))
    if us_level is None:
        fail("no United States price level - cannot re-base to U.S. = 100")
    print(f"  U.S. price level {round(us_level, 4)} ({us_year}); "
          f"{len(set(ppp) & set(fx))} economies with both series")

    countries = []
    years = set()
    dropped = []
    for iso3, meta in meta_countries.items():
        level, year = latest_ratio(ppp.get(iso3, {}), fx.get(iso3, {}))
        if level is None:
            continue  # no overlapping PPP + exchange-rate year for this country
        # Re-based so USA == 100, the same scale BEA RPP uses.
        rpp_all = round(100 * level / us_level, 3)
        if not (PLAUSIBLE_MIN <= rpp_all <= PLAUSIBLE_MAX):
            dropped.append(f"{meta['name']} ({rpp_all})")
            continue
        countries.append({
            "iso3": iso3,
            "name": meta["name"],
            "region": meta["region"],
            "rpp": {"all": rpp_all},
            "year": year,
        })
        years.add(year)
    countries.sort(key=lambda c: c["name"])
    if dropped:
        print(f"  dropped {len(dropped)} implausible price levels "
              f"(outside {PLAUSIBLE_MIN}-{PLAUSIBLE_MAX}): {dropped}")
    if len(countries) < MIN_COUNTRIES:
        fail(f"only {len(countries)} countries after join (expected >= {MIN_COUNTRIES})")

    out = {
        "meta": {
            "source": "https://api.worldbank.org/v2/",
            "indicators": [PPP_INDICATOR, FX_INDICATOR],
            "indicator_name": INDICATOR_NAME,
            "method": "price level = PPP conversion factor / official exchange rate",
            "rebased": "U.S. = 100 (divided by the USA price level, x100)",
            "plausible_band": [PLAUSIBLE_MIN, PLAUSIBLE_MAX],
            "value_years": f"{min(years)}-{max(years)}",
            "us_reference_year": us_year,
            "pulled": time.strftime("%Y-%m-%d"),
        },
        "countries": countries,
    }
    (OUT / "countries.json").write_text(json.dumps(out, separators=(",", ":")))
    path = OUT / "countries.json"
    print(f"wrote {path} ({path.stat().st_size // 1024} KB, {len(countries)} countries)")


if __name__ == "__main__":
    main()
