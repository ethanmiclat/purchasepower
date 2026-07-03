#!/usr/bin/env python3
"""Compile src/lib/taxdata.json - the Phase 3 static tax table.

Sources (exact citations also in data/README.md):
- State income tax: Tax Foundation, "2026 State Income Tax Rates and
  Brackets" (Feb 2026), official data download
  2026-State-Individual-Income-Tax-Rates-Brackets.xlsx, "2026" sheet.
- Sales tax: Tax Foundation, "State and Local Sales Tax Rates, 2026"
  (Jan 2026), 2026-Sales-Tax-Data.xlsx.
- Federal: IRS Rev. Proc. 2025-32 (2026 brackets and standard deduction).
- FICA 2026: SSA wage base $184,500; IRS Topic 751 rates.
- NYC resident income tax: fixed statutory brackets (unindexed).

Expects the two Tax Foundation xlsx files in etl/raw/ (see data/README.md
for URLs). Hand-coded overrides are documented inline.
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "etl" / "raw"
OUT = ROOT / "src" / "lib" / "taxdata.json"

ABBR = {"Ala.": "AL", "Alaska": "AK", "Ariz.": "AZ", "Ark.": "AR",
        "Calif.": "CA", "Colo.": "CO", "Conn.": "CT", "Del.": "DE",
        "Fla.": "FL", "Ga.": "GA", "Hawaii": "HI", "Idaho": "ID",
        "Ill.": "IL", "Ind.": "IN", "Iowa": "IA", "Kans.": "KS",
        "Ky.": "KY", "La.": "LA", "Maine": "ME", "Md.": "MD",
        "Mass.": "MA", "Mich.": "MI", "Minn.": "MN", "Miss.": "MS",
        "Mo.": "MO", "Mont.": "MT", "Nebr.": "NE", "Nev.": "NV",
        "N.H.": "NH", "N.J.": "NJ", "N.M.": "NM", "N.Y.": "NY",
        "N.C.": "NC", "N.D.": "ND", "Ohio": "OH", "Okla.": "OK",
        "Ore.": "OR", "Pa.": "PA", "R.I.": "RI", "S.C.": "SC",
        "S.D.": "SD", "Tenn.": "TN", "Tex.": "TX", "Utah": "UT",
        "Vt.": "VT", "Va.": "VA", "Wash.": "WA", "W.Va.": "WV",
        "Wis.": "WI", "Wyo.": "WY", "D.C.": "DC"}

FULLNAME = {"Alabama": "AL", "Alaska": "AK", "Arizona": "AZ",
            "Arkansas": "AR", "California": "CA", "Colorado": "CO",
            "Connecticut": "CT", "Delaware": "DE", "Florida": "FL",
            "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
            "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
            "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
            "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA",
            "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
            "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
            "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
            "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
            "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
            "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
            "South Carolina": "SC", "South Dakota": "SD",
            "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
            "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
            "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
            "District of Columbia": "DC", "D.C.": "DC"}


def num(x):
    if pd.isna(x):
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def parse_income_tax():
    df = pd.ExcelFile(RAW / "tf-state-2026.xlsx").parse("2026", header=None)
    states, cur = {}, None
    for _, row in df.iterrows():
        name = "" if pd.isna(row[0]) else str(row[0]).strip()
        key = name.split(" (")[0].strip()
        if key in ABBR:
            cur = ABBR[key]
            states[cur] = {
                "brackets": {"single": [], "married": []},
                "deduction": {"single": num(row[7]) or 0,
                              "married": num(row[8]) or 0},
                "none": False,
            }
        if cur is None or name == "State":
            continue
        if str(row[1]).strip().lower() == "none":
            states[cur]["none"] = True
        rs, bs, rm, bm = num(row[1]), num(row[3]), num(row[4]), num(row[6])
        if rs is not None and bs is not None:
            states[cur]["brackets"]["single"].append([bs, rs])
        if rm is not None and bm is not None:
            states[cur]["brackets"]["married"].append([bm, rm])

    if len(states) != 51:
        sys.exit(f"ERROR: parsed {len(states)} states, expected 51")

    # Washington's table rows are its capital-gains excise tax (7% and
    # 9%), which does not apply to wages. This tool models salary
    # income only, so WA counts as a no-income-tax state.
    states["WA"] = {"brackets": {"single": [], "married": []},
                    "deduction": {"single": 0, "married": 0}, "none": True}

    for code, s in states.items():
        for f in ("single", "married"):
            s["brackets"][f].sort(key=lambda b: b[0])
        if not s["none"] and not s["brackets"]["single"]:
            sys.exit(f"ERROR: {code} has no brackets and is not 'none'")
    return states


def parse_sales_tax():
    df = pd.ExcelFile(RAW / "tf-sales-2026.xlsx").parse("Table", header=None)
    out = {}
    for _, row in df.iterrows():
        name = "" if pd.isna(row[0]) else str(row[0]).strip()
        key = name.split(" (")[0].strip()
        if key in FULLNAME:
            out[FULLNAME[key]] = {
                "state": round(num(row[1]) or 0, 5),
                "combined_avg": round(num(row[5]) or 0, 5),
            }
    if len(out) != 51:
        sys.exit(f"ERROR: sales tax rows parsed: {len(out)}, expected 51")
    return out


def main():
    data = {
        "meta": {
            "year": 2026,
            "state_source": "Tax Foundation, 2026 State Income Tax Rates and Brackets (Feb 2026)",
            "sales_source": "Tax Foundation, State and Local Sales Tax Rates 2026 (Jan 2026)",
            "federal_source": "IRS Rev. Proc. 2025-32",
            "fica_source": "SSA 2026 wage base; IRS Topic 751",
            "compiled": "2026-07-02",
        },
        "federal": {
            "deduction": {"single": 16100, "married": 32200},
            "brackets": {
                "single": [[0, 0.10], [12400, 0.12], [50400, 0.22],
                           [105700, 0.24], [201775, 0.32], [256225, 0.35],
                           [640600, 0.37]],
                "married": [[0, 0.10], [24800, 0.12], [100800, 0.22],
                            [211400, 0.24], [403550, 0.32], [512450, 0.35],
                            [768700, 0.37]],
            },
        },
        "fica": {
            "ss_rate": 0.062,
            "ss_wage_base": 184500,
            "medicare_rate": 0.0145,
            "medicare_addl_rate": 0.009,
            "medicare_addl_threshold": {"single": 200000, "married": 250000},
        },
        # NYC resident income tax: statutory brackets, not indexed.
        "nyc": {
            "brackets": {
                "single": [[0, 0.03078], [12000, 0.03762], [25000, 0.03819],
                           [50000, 0.03876]],
                "married": [[0, 0.03078], [21600, 0.03762], [45000, 0.03819],
                            [90000, 0.03876]],
            },
        },
        "states": parse_income_tax(),
        "sales": parse_sales_tax(),
    }
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    n_none = sum(1 for s in data["states"].values() if s["none"])
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB); "
          f"{n_none} no-income-tax states")


if __name__ == "__main__":
    main()
