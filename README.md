# NSW Sold Property Dashboard

An interactive analytics dashboard for property sales in Western & South-Western Sydney growth corridors, built for first-home-buyer research.

**Live dashboard:** [https://soulfernweh.github.io/PropertySearch/](https://soulfernweh.github.io/PropertySearch/)

## What it does

Pulls the last 12 months of official NSW property sale records (from the NSW Valuer General's bulk PSI data), categorises and filters them, and presents them in an interactive dashboard with charts, KPIs, and a searchable sales table.

### Target areas

46 suburbs across five regions: North West Growth Area (Schofields, Marsden Park, Box Hill, etc.), Greater Western Sydney (Parramatta, Blacktown, Seven Hills, etc.), Western Sydney (Penrith, St Marys, Jordan Springs, etc.), South Western Sydney (Liverpool, Camden, Oran Park, etc.), and Hawkesbury (Pitt Town). Plus ~140 neighbouring suburbs that share those postcodes.

### Dashboard features

- **Filters:** category (House / Vacant Land / Acreage / Unit), region, suburb, zoning, land size, price and date sliders, "include neighbours" toggle
- **KPIs:** sale count, median price, median $/sqm, median land size
- **Charts:**
  - Median price trend by month (split by category)
  - Median $/sqm trend by month
  - Sales volume by month (clickable cross-filter)
  - Top streets by sales (with median price and $/sqm in tooltip, clickable)
  - Top streets $/sqm trend over time
  - Median $/sqm by suburb (clickable)
  - Median price by suburb (clickable)
  - **Scatter: Land size vs Price** — every sale plotted, colored by category
  - **Scatter: $/sqm vs Land size** — spot mispriced or undervalued blocks
- **Cross-filtering:** click any suburb, month, or street bar to filter the whole dashboard; active filters show as removable chips
- **Table:** sortable by date, price, $/sqm, or land size; searchable by address
- **Zoning FAQ:** collapsible reference explaining NSW zone codes (R1–R5, RU, E, B, MU, etc.)

### Property categories

- **House** — standalone Torrens-title residence (no strata/unit number)
- **Vacant Land** — new blocks in growth areas (most useful for budget analysis)
- **Acreage** — house or land parcels ≥ 4,000 sqm (separated because they skew $/sqm)
- **Unit** — apartments/townhouses/villas (has strata lot or unit number)

## Using the live dashboard

Open [https://soulfernweh.github.io/PropertySearch/](https://soulfernweh.github.io/PropertySearch/) — the page loads data directly from the repository (no server needed). Initial load downloads ~4.5 MB of data (gzipped to ~1 MB by GitHub's CDN).

**Tips for effective use:**

1. Start by selecting a **category** — "Houses + Vacant Land" (default) excludes units and acreage for cleaner analysis.
2. Use the **price slider** to focus on your budget range.
3. Click a **suburb bar** in any chart to drill into that suburb — all other charts and the table update.
4. In the **scatter plots**, look for dots below the cluster at their land size — these are potentially undervalued.
5. Use **"Vacant Land only"** to see where new blocks are selling and at what $/sqm.
6. Check the **Zoning FAQ** at the bottom if you see an unfamiliar zone code.

## Running locally

If you want to run the full-featured version (with the Node server and update capabilities):

```bash
git clone https://github.com/soulfernweh/PropertySearch.git
cd PropertySearch
npm install
npm run build
npm run sold-data    # downloads + generates the dataset (~2 min)
npm run dev          # starts server at http://localhost:3000/dashboard.html
```

### Useful commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Build + start the local server |
| `npm run sold-data` | Re-download and regenerate the full dataset |
| `npm run check-data` | Check if newer weekly PSI files are available |
| `npm test` | Run the test suite (129 tests) |

### Updating the data

The NSW Valuer General publishes new weekly files every Monday:

```bash
npm run check-data   # shows if new data is available
npm run sold-data    # pulls new files and regenerates
```

After regenerating, update the static GitHub Pages version:

```bash
node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('data/sold/nsw-sold-last-12-months.json','utf8')); const slim=d.map(r=>({cd:r.contractDate,p:r.purchasePrice,a:r.areaSqm,sub:r.suburb,st:r.streetName,addr:r.address,pc:r.postcode,reg:r.region,cat:r.propertyCategory,z:r.zoning,tgt:r.inTargetList})); fs.writeFileSync('docs/data.json',JSON.stringify(slim));"
git add docs/data.json && git commit -m "Update data" && git push
```

## Project structure

```
docs/               ← GitHub Pages (static dashboard)
  index.html        ← dashboard page
  dashboard.css     ← styles
  dashboard.js      ← client-side analytics (loads data.json)
  data.json         ← slimmed sold-data for static serving

public/             ← full dashboard (served by Express locally)
src/
  sold-data/        ← PSI downloader, parser, category logic
  pipeline/         ← property search orchestrator (requires API keys)
  services/         ← geocoder, commute calculator
  filters/          ← budget, spec, price parsing
  server.ts         ← Express server
```

## Data source & licensing

Property sales data is sourced from the **NSW Valuer General's bulk Property Sales Information (PSI)** service. Licensed under [Creative Commons BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) — for non-commercial personal use only.

The raw `data/` directory (full JSON + source zips) is git-ignored. Only a slimmed subset is committed to `docs/data.json` for the static dashboard.
