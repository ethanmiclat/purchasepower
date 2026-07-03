#!/usr/bin/env python3
"""Build public/data/ces.json - the Phase 2 personalization dataset.

Sources (all public flat files, documented in data/README.md):

1. BLS CES time-series database (download.bls.gov/pub/time.series/cx/):
   mean annual expenditures by item for these published cuts:
   all consumer units, housing tenure (owner/renter), composition
   (couple / with children / single parent / single), region, and
   population size of area.
2. BLS CES metro tables (cu-msa-<region>-2-year-average-2023-2024.xlsx):
   transportation spending for ~20 large MSAs.
3. Census CBSA population estimates (cbsa-est2024-alldata.csv): to place
   every BEA metro in a CES population-size class.

Run:  etl/.venv/bin/python etl/build_ces.py [--use-cache]

Fails loudly on any missing series or shape change; never writes partial
output. Downloads land in etl/raw/ (gitignored).
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "etl" / "raw"
OUT = ROOT / "src" / "data"

USER_AGENT = "Mozilla/5.0 (compatible; cost-of-living-tool; ethanmic6@gmail.com)"

CX_BASE = "https://download.bls.gov/pub/time.series/cx/"
MSA_URL = (
    "https://www.bls.gov/cex/tables/geographic/mean/"
    "cu-msa-{region}-2-year-average-2023-2024.xlsx"
)
MSA_VINTAGE = "2023-2024 two-year average"
CENSUS_URL = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2020-2024/metro/totals/cbsa-est2024-alldata.csv"
)

# CES summary items -> our five spending buckets. RPP prices the first
# four; transportation has no RPP index (the reason this file exists).
# Coarse by design: e.g. entertainment contains some goods but sits in
# services. Cash contributions and insurance/pensions are excluded
# because they are not consumption.
BUCKET_ITEMS = {
    "housing": ["SHELTER"],
    "utilities": ["UTILS"],
    "food_home": ["FOODHOME"],
    "food_away": ["FOODAWAY"],
    "goods_other": ["ALCBEVG", "HHFURNSH", "HKPGSUPP", "APPAREL",
                    "READING", "TOBACCO"],
    "transport_private": ["VEHPURCH", "GASOIL", "VEHOTHXP"],
    "transport_public": ["PUBTRANS"],
    "services_other": ["HHOPER", "HEALTH", "ENTRTAIN", "PERSCARE",
                       "EDUCATN", "MISC"],
}
ALL_ITEMS = sorted({i for items in BUCKET_ITEMS.values() for i in items})

# (demographics_code, characteristics_code) -> profile key
CUTS = {
    ("LB17", "01"): "all",
    ("LB17", "02"): "owner",
    ("LB17", "05"): "renter",
    ("LB06", "03"): "couple",
    ("LB06", "04"): "couple_kids",
    ("LB06", "09"): "single_parent",
    ("LB06", "10"): "single_other",
    ("LB11", "02"): "region_northeast",
    ("LB11", "03"): "region_midwest",
    ("LB11", "04"): "region_south",
    ("LB11", "05"): "region_west",
    ("LB20", "02"): "size_rural",
    ("LB20", "04"): "size_lt100k",
    ("LB20", "05"): "size_100k",
    ("LB20", "06"): "size_250k",
    ("LB20", "07"): "size_1m",
    ("LB20", "08"): "size_2m5",
    ("LB20", "09"): "size_5m",
}

# CES MSA-table column headers -> CBSA codes (matched to BEA metro ids).
# Matched by longest prefix after whitespace normalization, so entries
# only need to be unambiguous prefixes of the printed column header.
MSA_CBSA = {
    "New York": "35620", "Philadelphia": "37980", "Boston": "14460",
    "Chicago": "16980", "Detroit": "19820", "Minneapolis": "33460",
    "St. Louis": "41180", "Atlanta": "12060", "Baltimore": "12580",
    "Dallas": "19100", "Houston": "26420", "Miami": "33100",
    "Tampa": "45300", "Washington": "47900", "Los Angeles": "31080",
    "San Francisco": "41860", "San Diego": "41740", "Seattle": "42660",
    "Phoenix": "38060", "Denver": "19740", "Honolulu": "46520",
    "Anchorage": "11260",
}

STATE_REGION = {
    "CT": "northeast", "ME": "northeast", "MA": "northeast",
    "NH": "northeast", "RI": "northeast", "VT": "northeast",
    "NJ": "northeast", "NY": "northeast", "PA": "northeast",
    "IL": "midwest", "IN": "midwest", "MI": "midwest", "OH": "midwest",
    "WI": "midwest", "IA": "midwest", "KS": "midwest", "MN": "midwest",
    "MO": "midwest", "NE": "midwest", "ND": "midwest", "SD": "midwest",
    "DE": "south", "FL": "south", "GA": "south", "MD": "south",
    "NC": "south", "SC": "south", "VA": "south", "DC": "south",
    "WV": "south", "AL": "south", "KY": "south", "MS": "south",
    "TN": "south", "AR": "south", "LA": "south", "OK": "south",
    "TX": "south",
    "AZ": "west", "CO": "west", "ID": "west", "MT": "west", "NV": "west",
    "NM": "west", "UT": "west", "WY": "west", "AK": "west", "CA": "west",
    "HI": "west", "OR": "west", "WA": "west",
}

SIZE_BUCKETS = [  # (min population, LB20 profile key)
    (5_000_000, "size_5m"), (2_500_000, "size_2m5"), (1_000_000, "size_1m"),
    (250_000, "size_250k"), (100_000, "size_100k"), (0, "size_lt100k"),
]


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def download(url, dest, use_cache, binary_check=None):
    if use_cache and dest.exists():
        print(f"  using cached {dest.name}")
        return
    last = None
    for attempt in range(1, 4):
        try:
            print(f"  GET {url} (attempt {attempt})")
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=300)
            r.raise_for_status()
            if binary_check and not r.content.startswith(binary_check):
                raise ValueError("unexpected file signature")
            dest.write_bytes(r.content)
            return
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < 3:
                time.sleep(5 * attempt)
    fail(f"download failed: {url}\n{last}")


def load_cuts(use_cache):
    """Mean annual expenditure per (profile cut, item) from the cx DB."""
    for name in ("cx.series", "cx.data.1.AllData"):
        download(CX_BASE + name, RAW / name, use_cache)

    series = pd.read_csv(RAW / "cx.series", sep="\t", dtype=str)
    series.columns = [c.strip() for c in series.columns]
    for c in ("series_id", "item_code", "demographics_code",
              "characteristics_code", "process_code"):
        series[c] = series[c].str.strip()

    wanted = series[
        series["item_code"].isin(ALL_ITEMS + ["TOTALEXP"])
        & series["process_code"].eq("M")
        & series.apply(
            lambda r: (r["demographics_code"], r["characteristics_code"]) in CUTS,
            axis=1,
        )
    ]
    sid_to_key = {
        r.series_id: (CUTS[(r.demographics_code, r.characteristics_code)], r.item_code)
        for r in wanted.itertuples()
    }
    expected = len(CUTS) * (len(ALL_ITEMS) + 1)
    if len(sid_to_key) != expected:
        fail(f"expected {expected} series, matched {len(sid_to_key)} - "
             "CES item/demographic codes changed?")

    values, year_seen = {}, set()
    sids = set(sid_to_key)
    with open(RAW / "cx.data.1.AllData") as f:
        reader = csv.reader(f, delimiter="\t")
        header = [c.strip() for c in next(reader)]
        idx = {c: header.index(c) for c in ("series_id", "year", "period", "value")}
        for row in reader:
            sid = row[idx["series_id"]].strip()
            if sid in sids and row[idx["period"]].strip() == "A01":
                key = sid_to_key[sid]
                year = int(row[idx["year"]])
                prev = values.get(key)
                if prev is None or year > prev[0]:
                    values[key] = (year, float(row[idx["value"]]))

    years = {y for y, _ in values.values()}
    year = max(years)
    stale = {k: y for k, (y, _) in values.items() if y < year - 1}
    if stale:
        fail(f"some CES series end before {year - 1}: {list(stale)[:5]}")
    if len(values) != expected:
        fail(f"missing CES data points: got {len(values)} of {expected}")

    cuts = {}
    for (profile, item), (_, v) in values.items():
        cuts.setdefault(profile, {})[item] = v
    return cuts, year


def bucket_shares(item_means):
    bucket_totals = {
        b: sum(item_means[i] for i in items) for b, items in BUCKET_ITEMS.items()
    }
    consumption = sum(bucket_totals.values())
    return {b: round(v / consumption, 5) for b, v in bucket_totals.items()}


def load_msa_transport(use_cache):
    """Per-MSA transport share of average annual expenditures, plus the
    region-weighted national vehicle count per consumer unit."""
    msa_share, cu_weighted = {}, []
    for region in ("northeast", "midwest", "south", "west"):
        dest = RAW / f"cu-msa-{region}.xlsx"
        download(MSA_URL.format(region=region), dest, use_cache, b"PK")
        df = pd.read_excel(dest, header=None)
        header_row = df[df[0].astype(str).str.strip().eq("Item")].index
        if len(header_row) != 1:
            fail(f"{dest.name}: cannot locate header row")
        heads = df.iloc[header_row[0]].tolist()

        def row(label, df=df, name=dest.name):
            m = df[df[0].astype(str).str.strip().str.lower()
                   .str.startswith(label.lower())]
            if m.empty:
                fail(f"{name}: no '{label}' row")
            return m.iloc[0]

        cu = row("Number of consumer units")
        veh = row("Vehicles")
        total = row("Average annual expenditures")
        trans = row("Transportation")
        cu_weighted.append((float(cu[1]), float(veh[1])))  # col 1 = all-region

        for col in range(2, len(heads)):
            head = " ".join(str(heads[col]).split())
            cbsa = next(
                (code for name, code in
                 sorted(MSA_CBSA.items(), key=lambda kv: -len(kv[0]))
                 if head.startswith(name)),
                None,
            )
            if cbsa is None:
                fail(f"{dest.name}: unmapped MSA column '{head}' - "
                     "add it to MSA_CBSA")
            msa_share[cbsa] = float(trans[col]) / float(total[col])

    total_cu = sum(c for c, _ in cu_weighted)
    vehicles = sum(c * v for c, v in cu_weighted) / total_cu
    return msa_share, round(vehicles, 2)


def load_metro_population(use_cache):
    dest = RAW / "cbsa-pop.csv"
    download(CENSUS_URL, dest, use_cache)
    pops = {}
    with open(dest, encoding="latin-1") as f:
        for r in csv.DictReader(f):
            if r["LSAD"] == "Metropolitan Statistical Area" and not r["MDIV"]:
                pops[r["CBSA"]] = int(r["POPESTIMATE2024"])
    if len(pops) < 300:
        fail(f"only {len(pops)} MSAs in census file - format changed?")
    return pops


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)

    metros_path = OUT / "metros.json"
    if not metros_path.exists():
        fail("src/data/metros.json missing - run build_data.py first")
    metros = json.loads(metros_path.read_text())["metros"]

    print("CES demographic cuts (cx time-series database)")
    cuts, year = load_cuts(args.use_cache)
    shares = {profile: bucket_shares(items) for profile, items in cuts.items()}
    print(f"  {len(shares)} cuts, year {year}; all-CU shares: {shares['all']}")

    print("CES MSA tables + census populations (transport geography)")
    msa_share, vehicles = load_msa_transport(args.use_cache)
    pops = load_metro_population(args.use_cache)
    print(f"  {len(msa_share)} MSAs with direct transport shares; "
          f"avg vehicles/CU {vehicles}")

    nat_share = (
        cuts["all"]["VEHPURCH"] + cuts["all"]["GASOIL"]
        + cuts["all"]["VEHOTHXP"] + cuts["all"]["PUBTRANS"]
    ) / cuts["all"]["TOTALEXP"]

    def rel(profile):
        c = cuts[profile]
        share = (c["VEHPURCH"] + c["GASOIL"] + c["VEHOTHXP"] + c["PUBTRANS"]) / c["TOTALEXP"]
        return share / nat_share

    # Transport cost-intensity index per metro (U.S. average = 100):
    # direct CES MSA share where published, else region x size-class
    # relatives multiplied (a disclosed approximation).
    transport_idx, direct = {}, 0
    missing_pop = []
    largest = {}  # primary state -> [population, metro id], for map clicks
    for m in metros:
        state = m["name"].rsplit(",", 1)[1].strip().split("-")[0]
        mpop = pops.get(m["id"], 0)
        if mpop > largest.get(state, [0])[0]:
            largest[state] = [mpop, m["id"]]
        region = STATE_REGION.get(state)
        if region is None:
            fail(f"no census region for state '{state}' ({m['name']})")
        if m["id"] in msa_share:
            transport_idx[m["id"]] = round(100 * msa_share[m["id"]] / nat_share, 1)
            direct += 1
            continue
        pop = pops.get(m["id"])
        if pop is None:
            missing_pop.append(m["name"])
            pop = 250_001  # mid class; flagged below
        size_key = next(k for floor, k in SIZE_BUCKETS if pop >= floor)
        transport_idx[m["id"]] = round(100 * rel(f"region_{region}") * rel(size_key), 1)
    if missing_pop:
        print(f"  WARNING: no census population for {len(missing_pop)} metros "
              f"(defaulted to 250k-1M class): {missing_pop[:5]}")
    if direct < 15:
        fail(f"only {direct} metros matched CES MSA tables - name map broken?")

    out = {
        "meta": {
            "cx_source": CX_BASE,
            "cx_year": year,
            "msa_source": MSA_URL.format(region="<region>"),
            "msa_vintage": MSA_VINTAGE,
            "census_source": CENSUS_URL,
            "pulled": time.strftime("%Y-%m-%d"),
            "vehicles_per_cu": vehicles,
            "msa_direct_count": direct,
        },
        "shares": {
            k: shares[k]
            for k in ("all", "owner", "renter", "couple", "couple_kids",
                      "single_parent", "single_other")
        },
        "transport_idx": transport_idx,
        "largest_metro": {st: mid for st, (_, mid) in sorted(largest.items())},
    }

    (OUT / "ces.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT / 'ces.json'} ({(OUT / 'ces.json').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
