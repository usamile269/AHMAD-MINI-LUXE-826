# Ahmad Mini — Ready-to-Run Deploy (Katabump + Railway)

Zero-config: every setting in `config.js` already has a working hardcoded
default (MongoDB URI, owner number, API keys, Telegram token). You don't
need to set a single environment variable on either platform to boot.

## Katabump

1. Create a new app → Docker-based deployment.
2. Upload/push this whole folder (it already has a `Dockerfile`).
3. Deploy. Katabump builds the image and starts it on `node index.js`.
4. Open the app URL → pair your number the same way as before (web or
   Telegram pairing flow, both already wired in).

No variables tab needed — skip it entirely.

## Railway

1. New Project → Deploy from this repo/folder (or drag the zip in).
2. Railway auto-detects `nixpacks.toml` (installs nodejs + python3 + ffmpeg)
   and `railway.json` (start command `node index.js`).
3. Deploy. Same pairing flow as above once it's live.

No variables tab needed here either.

## Notes

- Both platforms read the SAME codebase — no platform-specific code paths,
  the `Dockerfile` (Katabump) and `nixpacks.toml`/`railway.json` (Railway)
  are just two different ways of installing the same Node + ffmpeg +
  python3 stack.
- Local "DB" (`database/*.json` via `lib/jsondb.js`) starts empty on a
  fresh deploy — on Katabump/Railway free tiers the filesystem is wiped on
  every redeploy, so paired sessions/settings won't survive a redeploy
  unless the platform gives you a persistent volume. Same limitation as
  before, not something either config file can fix.
- `bin/yt-dlp_linux` is auto-downloaded on first `.play`/`.video` use — not
  shipped in the zip, so first download after a fresh deploy takes a few
  extra seconds one time only.
