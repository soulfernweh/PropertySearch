# Deployment Guide

This app is an Express server, so it needs a host that runs Node (GitHub alone
won't serve it live). Two ready-to-use options are included.

## Option A — Render Blueprint (easiest, free tier)

1. Create a free account at <https://render.com> and connect your GitHub.
2. Click **New → Blueprint**.
3. Select the `soulfernweh/PropertySearch` repo. Render reads `render.yaml`.
4. When prompted for environment variables:
   - `DOMAIN_API_KEY` / `GOOGLE_MAPS_API_KEY` — optional. Only needed for the
     live property-search form at `/`. Leave blank to use just the dashboard.
5. Click **Apply**. First deploy takes a few minutes (it downloads ~12 months
   of PSI data during the build).
6. Your dashboard will be live at `https://property-search-XXXX.onrender.com/dashboard.html`.

Notes:
- The free plan sleeps after ~15 min idle and cold-starts on the next request.
- Render's filesystem is ephemeral; the dataset is regenerated on each deploy.

## Option B — Docker (Railway, Fly.io, Cloud Run, or local)

A `Dockerfile` is included.

```bash
docker build -t property-search .
docker run -p 3000:3000 property-search
# open http://localhost:3000/dashboard.html
```

On Railway: New Project → Deploy from GitHub repo → it auto-detects the Dockerfile.

## Important caveats

- **Data source reachability.** The build runs `npm run sold-data`, which uses
  `curl` to fetch NSW PSI files. If the government server blocks the host's IP,
  data generation fails (the deploy still succeeds, but the dashboard is empty).
  You can re-run generation from the host shell, or generate locally and serve
  the JSON another way.
- **Licensing.** The NSW PSI data is CC BY-NC-ND 4.0 (non-commercial, no
  redistribution of derivatives). A publicly accessible dashboard serving this
  data is effectively redistribution. For a private research tool, restrict
  access (e.g. Render's access controls, or keep the URL unshared). Do not use
  commercially without a PSI licence.
- **API keys.** Never commit real keys. Set them as host environment variables.
