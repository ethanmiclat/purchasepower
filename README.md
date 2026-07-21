# Purchasing Power

A cost-of-living comparison site: enter a salary and two U.S. metro
areas, see the equivalent salary in the destination, *why* the numbers
differ, what the local job market pays, and what taxes do to it.

Pages: **Home** (landing + mini map), **Compare** (guided flow: inputs,
optional personalization questionnaire, results with the tax-adjusted
view), **Explore** (state-level choropleth; click through to a
comparison), **Methodology** (sources, formulas, assumptions,
disclaimers).

Data is official and pre-processed: BEA Regional Price Parities (metro +
state, 2024), BLS OEWS median wages (May 2025), BLS Consumer Expenditure
Survey (2024), and 2026 tax tables. Everything is baked into the bundle
at build time; the live site makes no API calls. See `data/README.md`
for exact sources, pull dates, and known limitations.

## Run locally

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # unit tests (personalization math)
```

## Regenerate the data

```sh
python3 -m venv etl/.venv
etl/.venv/bin/pip install requests pandas openpyxl python-dotenv
etl/.venv/bin/python etl/build_data.py
etl/.venv/bin/python etl/build_ces.py
etl/.venv/bin/python etl/build_global.py
etl/.venv/bin/python etl/build_cpi.py
etl/.venv/bin/python etl/build_generations.py
```

Data refresh is ceremonial, not live: the scripts re-download the
official flat files and rewrite `src/data/*.json` (and
`src/lib/taxdata.json` via `etl/build_taxes.py`), which get committed
and bundled at build time. All scripts fail loudly on download errors or
format changes and never write partial output. `--use-cache` reuses
files already in `etl/raw/`.

Run order and outputs:

- `build_data.py` → `metros.json`, `wages.json`, `states.json` (BEA RPP,
  BLS OEWS). Run first — `build_ces.py` depends on `metros.json`.
- `build_ces.py` → `ces.json` (BLS Consumer Expenditure Survey).
- `build_global.py` → `countries.json` (World Bank price levels, for the
  global comparison mode). Independent; no key.
- `build_cpi.py` → `cpi.json` (BLS CPI-U annual index, the inflation /
  time axis). Independent; no key.
- `build_generations.py` → `generations.json` (Pew cohort definitions +
  Census/FRED median household income, context only). Independent; no key.
- `build_taxes.py` → `src/lib/taxdata.json`, run separately (reads
  manually-placed Tax Foundation xlsx files from `etl/raw/`).

## Environment variables

Copy `.env.example` to `.env`. Phase 1 needs no keys (public flat files);
`BEA_API_KEY` and `BLS_API_KEY` are reserved for later phases and
API-based refreshes. Registration links are in `.env.example`. `.env` is
gitignored; never commit real key values.

## Project layout

- `src/pages/` - Home, Compare, Explore, Methodology (react-router)
- `src/lib/` - comparison, personalization, and tax math (pure,
  unit-tested) plus shared design tokens in `src/index.css`
- `src/data/` - committed ETL outputs, bundled at build time
- `etl/` - periodic data-refresh scripts (see above)
- `data/README.md` - dataset provenance and limitations
- `design-reference/` - original mockups (adapted into the shared
  palette, not pasted verbatim)

## Roadmap

- **v1**: baseline comparison across 386 BEA metros
- **v2**: personalized weighting via a five-question profile
- **v3 (this)**: tax-adjusted take-home comparison (2026 federal +
  state + NYC, with unit-tested tax math)
