# Data sources & provenance

All live-site data is pre-processed static JSON in `public/data/`, generated
by `etl/build_data.py`. Nothing is fetched from BEA/BLS at runtime.

To regenerate from scratch (re-downloads source files):

```sh
python3 -m venv etl/.venv
etl/.venv/bin/pip install requests pandas openpyxl python-dotenv
etl/.venv/bin/python etl/build_data.py
```

## Datasets

### BEA Regional Price Parities, metro (MARPP)

- **Source URL**: https://apps.bea.gov/regional/zip/MARPP.zip
  (public flat file; same numbers as the BEA Regional API's MARPP dataset)
- **Vintage used**: 2024 RPPs (file covers 2008–2024; BEA release dated
  2026-02-19: "new statistics for 2024; revised statistics for 2008–2023")
- **Pulled**: 2026-07-02
- **Coverage**: 387 Metropolitan Statistical Areas; 386 kept (metros with
  any suppressed component are dropped rather than imputed)
- **Components kept** (all five BEA line codes): All items, Goods,
  Services: Housing, Services: Utilities, Services: Other

**Known limitation — no "transportation" or combined "services" index.**
BEA publishes services only as Housing / Utilities / Other, with no
expenditure weights in this file. The UI therefore shows those components
separately instead of a blended "services" bar, and the headline
equivalent-salary number uses BEA's own all-items composite (line code 1),
never a home-rolled combination. Relevant to the Phase 2 transport
decision: there is no transport sub-index here.

### BLS OEWS metro wages (May 2025)

- **Source URL**: https://www.bls.gov/oes/special-requests/oesm25ma.zip
  (file `oesm25ma/MSA_M2025_dl.xlsx`)
- **Pulled**: 2026-07-02
- **Coverage**: 393 MSAs; all 386 BEA metros matched on 5-digit CBSA code
- **Fields kept**: annual median wage (`A_MEDIAN`) for the all-occupations
  total (`00-0000`) and the 22 SOC major groups. Detailed (6-digit)
  occupations are excluded in v1 to keep the payload small (~144 KB vs
  multi-MB).
- **Special values**: `*` (suppressed) and `#` (top-coded, median ≥
  $239,200/yr) become `null`; the UI shows "not published" rather than a
  substituted number. 15 of 9,008 kept medians are null.

**Access note**: BLS returns HTTP 403 to anonymous user agents. Per BLS
policy (https://www.bls.gov/bls/pss.htm) the ETL identifies the requester
in the User-Agent string (see `USER_AGENT` in `etl/build_data.py`).

## Output files

- `public/data/metros.json` — `{ meta, metros: [{ id, name, rpp: { all,
  goods, housing, utilities, other_services } }] }` (~53 KB)
- `public/data/wages.json` — `{ meta, occupations: [{ code, title }],
  wages: { <metroId>: { <occCode>: medianAnnual | null } } }` (~144 KB)

`meta` in both files records source URLs, vintages, and pull date.

## API keys

Phase 1 needs no keys (public flat files). `.env` holds `BEA_API_KEY` /
`BLS_API_KEY` for later phases or API-based refreshes — see `.env.example`.

## Licensing

BEA and BLS data are U.S. government works (public domain). Sources are
cited in the site footer for credibility, not legal obligation.
