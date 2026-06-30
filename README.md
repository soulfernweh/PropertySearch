# Property Search & NSW Sold-Data Dashboard

A TypeScript/Node.js toolkit for first-home-buyer research in Western & South-Western Sydney:

1. **Property search shortlist** — a pipeline that geocodes a work address, fetches listings, and filters by budget, commute time, and property specs.
2. **NSW sold-data dashboard** — downloads the NSW Valuer General's bulk Property Sales Information (PSI), categorises sales (House / Unit / Vacant Land / Acreage), and serves an interactive analytics dashboard.

## Prerequisites

- Node.js 18+ (uses native `fetch`)
- Windows `curl.exe` (bundled with Windows 10+) — used to fetch PSI files, which sit behind a WAF that blocks Node's HTTP client.

## Setup

```bash
npm install
cp .env.example .env   # then fill in API keys (optional, only for the live property search)
npm run build
```

## Generating the sold-property dataset

The data is **not** committed to this repo (see Licensing below). Generate it locally:

```bash
npm run sold-data
```

This downloads ~12 months of weekly PSI files plus the prior annual archive, filters to the target postcodes, tags each sale with a category, and writes:

- `data/sold/nsw-sold-last-12-months.csv`
- `data/sold/nsw-sold-last-12-months.json`

Target suburbs/postcodes live in `src/sold-data/target-areas.ts`.

## Running the dashboard

```bash
npm run dev
```

Then open <http://localhost:3000/dashboard.html>.

Features: dual-range price/date sliders, cross-filtering (click any suburb/month/street bar), median price and $/sqm trends, top-streets-by-sales, a sortable sales table, and a zoning FAQ.

The property search form is at <http://localhost:3000/> (requires `DOMAIN_API_KEY` and `GOOGLE_MAPS_API_KEY`).

## Project structure

```
src/
  sold-data/      # PSI downloader, parser, category logic, runner
  pipeline/       # property search orchestrator + shortlist assembler
  services/       # geocoder, listing fetcher, commute calculator
  filters/        # budget, spec, price parsing
  validators/     # input validation
  server.ts       # Express server (dashboard + search API)
public/           # dashboard + search UI (static)
```

## Licensing of the data

The NSW property sales data is sourced from the NSW Valuer General's bulk PSI service and is licensed under
[Creative Commons BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). It is for **non-commercial** use, and redistribution of derived datasets is restricted — which is why the `data/` directory is git-ignored. Regenerate it locally rather than redistributing it.
