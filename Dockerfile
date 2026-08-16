# Ahmad Mini — Katabump Dockerfile
# Zero-config: every setting already has a working default in config.js,
# nothing needs to be set as an environment variable to boot.

FROM node:20-slim

# ffmpeg: needed by fluent-ffmpeg (opus voice-note conversion) as a system
#         fallback and by yt-dlp's own internal -x audio extraction step.
# python3: some yt-dlp code paths still expect it on PATH even though the
#          standalone yt-dlp_linux binary bundles its own runtime.
# ca-certificates: needed for HTTPS calls (Mongo, download APIs, yt-dlp
#          binary fetch) to work correctly on a minimal slim image.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg python3 ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching on rebuilds)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Now copy the rest of the bot
COPY . .

# /app/database holds the local JSON "DB" (see lib/jsondb.js) and
# /app/bin holds the auto-downloaded yt-dlp binary — make sure both exist
# so the very first boot doesn't trip over a missing directory.
RUN mkdir -p /app/database /app/bin

ENV PORT=8000
EXPOSE 8000

CMD ["node", "index.js"]
