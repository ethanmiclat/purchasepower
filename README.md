# Purchasing Power

A cost-of-living comparison tool: enter a salary and two U.S. metro areas,
see the equivalent salary in the destination and *why* the numbers differ
(housing, goods, utilities, other services), plus what the local job market
actually pays for your occupation.

Data is official and pre-processed: BEA Regional Price Parities (2024) and
BLS OEWS median wages (May 2025), baked into static JSON at build time.
No backend, no runtime API calls. See `data/README.md` for exact sources,
pull dates, and known data limitations.

## Run locally

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Regenerate the data

```sh
python3 -m venv etl/.venv
etl/.venv/bin/pip install requests pandas openpyxl python-dotenv
etl/.venv/bin/python etl/build_data.py
```

Re-downloads the BEA/BLS flat files and rewrites `public/data/*.json`.
The script fails loudly on download errors or format changes and never
writes partial output. `--use-cache` reuses files already in `etl/raw/`.

## Environment variables

Copy `.env.example` to `.env`. Phase 1 needs no keys (public flat files);
`BEA_API_KEY` and `BLS_API_KEY` are reserved for later phases and
API-based refreshes. Registration links are in `.env.example`. `.env` is
gitignored; never commit real key values.

## Project layout

- `src/` - React app (Vite + Tailwind)
- `src/lib/compare.js` - all comparison math (pure functions)
- `etl/build_data.py` - one-shot ETL producing `public/data/*.json`
- `data/README.md` - dataset provenance and limitations
- `design-reference/` - approved visual mockups the UI is built against

## Roadmap

- **v1 (this)**: baseline comparison across 386 BEA metros
- **v2**: personalized weighting via a short questionnaire
- **v3**: tax-adjusted take-home comparison (federal + state)
