# Getting a Live URL (Render — free, ~5 minutes)

Follow these steps to publish the dashboard online. GitHub stores the code but
does not run the server, so you need a Node host. Render's free tier is the
simplest.

## Steps

1. Sign up at <https://render.com> and connect your GitHub account.
2. Click **New → Blueprint**.
3. Select the `soulfernweh/PropertySearch` repository. Render automatically
   reads `render.yaml` from the repo.
4. When prompted for environment variables, leave the API keys blank — they are
   only needed for the property-search form at `/`, not the dashboard:
   - `DOMAIN_API_KEY` (optional)
   - `GOOGLE_MAPS_API_KEY` (optional)
5. Click **Apply**. The first build takes a few minutes because it downloads
   ~12 months of NSW PSI data during the build.
6. Once live, open:
   - Dashboard: `https://property-search-XXXX.onrender.com/dashboard.html`
   - Property search form: `https://property-search-XXXX.onrender.com/`

   (Render shows your exact URL on the service page.)

## Good to know

- **Cold starts:** the free plan sleeps after ~15 minutes idle and takes ~30s
  to wake on the next request.
- **Data is regenerated each deploy:** Render's filesystem is ephemeral, so the
  sold-data set is rebuilt on every deploy via `npm run sold-data`.
- **If the dashboard is empty:** the NSW government server may have blocked the
  host's cloud IP during the build (data generation is non-fatal so the deploy
  still succeeds). Fallbacks: redeploy, generate the data locally, or ask to
  wire up a committed-data / static-hosting approach.

## Challenges / limitations

- **I cannot complete this step for you** — it requires authorising Render
  against your GitHub account through their website.
- **Licensing:** the NSW PSI data is Creative Commons BY-NC-ND 4.0
  (non-commercial, no redistribution of derivatives). A publicly reachable
  dashboard serving this data is effectively redistribution. For a personal
  research tool, keep the URL unshared or use Render's access controls. Do not
  use commercially without a PSI licence.
- **API keys:** never commit real keys. Set them as environment variables in
  the Render dashboard if you enable the live property-search form.

## Alternative: Docker (Railway, Fly.io, Cloud Run, local)

See `DEPLOY.md` → "Option B — Docker" for a portable container setup.
