# Portable container for the dashboard + search API.
# Works on Railway, Fly.io, Render (Docker), Cloud Run, etc.
FROM node:20-bookworm-slim

# curl is required to fetch NSW PSI files (the gov WAF blocks Node's HTTP client).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package*.json ./
RUN npm install

# Copy source and build.
COPY . .
RUN npm run build

# Generate the sold-data set at build time. Allowed to fail so the image still
# builds if the data source is unreachable; regenerate later with `npm run sold-data`.
RUN npm run sold-data || echo "sold-data generation failed; dashboard will be empty until regenerated"

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
