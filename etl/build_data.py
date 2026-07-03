#!/usr/bin/env python3
"""Build the static data files the site serves.

Downloads BEA Regional Price Parities (metro, MARPP) and BLS OEWS
metro wage data, joins them on CBSA code, and writes:

    public/data/metros.json   — metro list + RPP indices (loaded eagerly)
    public/data/wages.json    — median wages by metro x major occupation group

Run:  etl/.venv/bin/python etl/build_data.py [--use-cache]

--use-cache reuses files already in etl/raw/ instead of re-downloading.

No API keys are needed for these pulls (public flat files). BEA_API_KEY /
BLS_API_KEY in .env are reserved for later phases / API-based refreshes.

The script fails loudly (non-zero exit) on any download error or
unexpected file shape. It never writes partial output: JSON files are
written only after all validation passes.
"""

import argparse
import io
import json
import sys
import time
import zipfile
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "etl" / "raw"
OUT = ROOT / "public" / "data"

# BLS asks that automated requests identify the requester in the
# User-Agent (https://www.bls.gov/bls/pss.htm); anonymous UAs get 403.
USER_AGENT = "Mozilla/5.0 (compatible; cost-of-living-tool; ethanmic6@gmail.com)"

BEA_URL = "https://apps.bea.gov/regional/zip/MARPP.zip"
BEA_CSV = "MARPP_MSA_2008_2024.csv"
RPP_YEAR = "2024"

OEWS_URL = "https://www.bls.gov/oes/special-requests/oesm25ma.zip"
OEWS_XLSX = "oesm25ma/MSA_M2025_dl.xlsx"
OEWS_VINTAGE = "May 2025"

# MARPP line codes. BEA splits services into housing (rents), utilities
# and other — there is no combined "services" index and no published
# weights to blend one honestly, so all components are kept separate.
LINE_CODES = {1: "all", 2: "goods", 3: "housing", 4: "utilities", 5: "other_services"}

MIN_METROS = 350          # BEA covers ~387 MSAs; fewer means a broken pull
EXPECTED_MAJOR_GROUPS = 22


def fail(msg: str):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def download(url: str, dest: Path, use_cache: bool):
    if use_cache and dest.exists():
        print(f"  using cached {dest.name}")
        return
    last_err = None
    for attempt in range(1, 4):
        try:
            print(f"  GET {url} (attempt {attempt})")
            r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
            r.raise_for_status()
            if not r.content[:2] == b"PK":
                raise ValueError("response is not a zip file")
            dest.write_bytes(r.content)
            return
        except Exception as e:  # noqa: BLE001 — retry any transient failure
            last_err = e
            if attempt < 3:
                time.sleep(5 * attempt)
    fail(f"download failed after 3 attempts: {url}\n{last_err}")


def extract(zip_path: Path, member: str) -> Path:
    dest = RAW / member
    with zipfile.ZipFile(zip_path) as z:
        if member not in z.namelist():
            fail(f"{zip_path.name} no longer contains {member} — "
                 f"contents: {z.namelist()[:10]}")
        z.extract(member, RAW)
    return dest


def load_rpp(csv_path: Path) -> dict:
    df = pd.read_csv(csv_path, dtype=str, engine="python", on_bad_lines="skip")
    expected = {"GeoFIPS", "GeoName", "LineCode", RPP_YEAR}
    if not expected.issubset(df.columns):
        fail(f"MARPP columns changed; missing {expected - set(df.columns)}")

    df["GeoFIPS"] = df["GeoFIPS"].str.strip().str.strip('"')
    # Footer note lines parse as rows with a non-FIPS first column; drop them.
    df = df[df["GeoFIPS"].str.fullmatch(r"\d{5}", na=False)]
    df["GeoName"] = df["GeoName"].str.strip()
    msa = df[df["GeoName"].str.contains("(Metropolitan Statistical Area)",
                                        regex=False, na=False)].copy()
    msa["LineCode"] = msa["LineCode"].astype(int)
    msa["value"] = pd.to_numeric(msa[RPP_YEAR], errors="coerce")

    metros = {}
    for fips, grp in msa.groupby("GeoFIPS"):
        codes = dict(zip(grp["LineCode"], grp["value"]))
        if set(codes) != set(LINE_CODES):
            fail(f"metro {fips}: expected line codes {sorted(LINE_CODES)}, "
                 f"got {sorted(codes)}")
        if any(pd.isna(v) for v in codes.values()):
            print(f"  skipping {fips}: suppressed RPP value(s)")
            continue
        name = grp["GeoName"].iloc[0].replace(
            " (Metropolitan Statistical Area)", "").strip(" *")
        metros[fips] = {
            "id": fips,
            "name": name,
            "rpp": {LINE_CODES[c]: round(v, 3) for c, v in codes.items()},
        }
    if len(metros) < MIN_METROS:
        fail(f"only {len(metros)} metros parsed from MARPP (expected ≥{MIN_METROS})")
    return metros


def load_wages(xlsx_path: Path):
    df = pd.read_excel(
        xlsx_path,
        usecols=["AREA", "O_GROUP", "OCC_CODE", "OCC_TITLE", "A_MEDIAN"],
        dtype={"AREA": str},
    )
    df = df[df["O_GROUP"].isin(["total", "major"])]
    if df.empty:
        fail("OEWS file has no total/major rows — format changed?")

    occupations = (
        df[["OCC_CODE", "OCC_TITLE"]].drop_duplicates().sort_values("OCC_CODE")
    )
    n_major = (occupations["OCC_CODE"] != "00-0000").sum()
    if n_major != EXPECTED_MAJOR_GROUPS:
        fail(f"expected {EXPECTED_MAJOR_GROUPS} major occupation groups, got {n_major}")

    # A_MEDIAN special values: '*' = suppressed estimate, '#' = top-coded
    # (median at or above $239,200/yr). Both become null — the UI labels
    # them "not published" rather than inventing a number.
    df["median"] = pd.to_numeric(df["A_MEDIAN"], errors="coerce")
    n_special = df["median"].isna().sum()

    wages = {}
    for area, grp in df.groupby("AREA"):
        wages[area] = {
            row.OCC_CODE: (None if pd.isna(row.median) else int(row.median))
            for row in grp.itertuples()
        }
    occ_list = [
        {"code": r.OCC_CODE, "title": r.OCC_TITLE.removesuffix(" Occupations")}
        for r in occupations.itertuples()
    ]
    print(f"  {len(wages)} OEWS areas, {n_special} suppressed/top-coded medians -> null")
    return occ_list, wages


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--use-cache", action="store_true")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    print("BEA MARPP (Regional Price Parities, metro)")
    bea_zip = RAW / "MARPP.zip"
    download(BEA_URL, bea_zip, args.use_cache)
    metros = load_rpp(extract(bea_zip, BEA_CSV))
    print(f"  {len(metros)} metros with complete {RPP_YEAR} RPPs")

    print("BLS OEWS (metro wages)")
    oews_zip = RAW / "oesm25ma.zip"
    download(OEWS_URL, oews_zip, args.use_cache)
    occupations, all_wages = load_wages(extract(oews_zip, OEWS_XLSX))

    matched = {fips: w for fips, w in all_wages.items() if fips in metros}
    unmatched_bea = [m["name"] for f, m in metros.items() if f not in all_wages]
    print(f"  wage data joined for {len(matched)}/{len(metros)} BEA metros")
    if unmatched_bea:
        print(f"  BEA metros without OEWS wages ({len(unmatched_bea)}): "
              f"{unmatched_bea[:5]}{'...' if len(unmatched_bea) > 5 else ''}")
    if len(matched) < 0.9 * len(metros):
        fail("less than 90% of BEA metros matched OEWS areas — join key broken?")

    pulled = time.strftime("%Y-%m-%d")
    meta = {
        "rpp_source": BEA_URL,
        "rpp_year": int(RPP_YEAR),
        "oews_source": OEWS_URL,
        "oews_vintage": OEWS_VINTAGE,
        "pulled": pulled,
    }
    metros_json = {
        "meta": meta,
        "metros": sorted(metros.values(), key=lambda m: m["name"]),
    }
    wages_json = {"meta": meta, "occupations": occupations, "wages": matched}

    (OUT / "metros.json").write_text(json.dumps(metros_json, separators=(",", ":")))
    (OUT / "wages.json").write_text(json.dumps(wages_json, separators=(",", ":")))
    print(f"wrote {OUT / 'metros.json'} "
          f"({(OUT / 'metros.json').stat().st_size // 1024} KB)")
    print(f"wrote {OUT / 'wages.json'} "
          f"({(OUT / 'wages.json').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
