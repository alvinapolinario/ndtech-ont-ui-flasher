# Deploying with Docker (Ubuntu server)

On a Linux host the firmware tools (`binwalk`, `squashfs-tools`, `file`, …) are
installed **inside the image**, so the app runs with **full live analysis** —
no mock mode and no WSL bridge. This is the recommended way to run the tool for
real firmware work.

The provided files:

| File | Purpose |
| --- | --- |
| `Dockerfile` | One image with Node + firmware tools; runs API or web |
| `docker-compose.yml` | Two services: `api` (:4000) and `web` (:3000) + a storage volume |
| `docker/entrypoint-api.sh` | Prepares storage, applies DB schema, seeds once, starts API |
| `.env.docker.example` | Compose config (the browser-facing API URL) |

## Prerequisites

- Ubuntu server with Docker Engine and the Compose plugin:

```bash
docker --version
docker compose version
```

If Compose isn't installed: `sudo apt-get update && sudo apt-get install -y docker-compose-plugin`.

## 1. Get the code onto the server

```bash
git clone <your-repo-url> ndtech-ont
cd ndtech-ont
```

(or copy the project directory to the server with `scp`/`rsync`).

## 2. Configure the public API URL

`NEXT_PUBLIC_API_URL` is compiled into the browser bundle, so it must be the
address **your browser** uses to reach the API — and it's set **before build**.

```bash
cp .env.docker.example .env
nano .env
```

Set `PUBLIC_API_URL`:

- Testing on the server itself: `http://localhost:4000`
- Accessing from other machines on the LAN: `http://<server-ip>:4000`
  (e.g. `http://192.168.1.50:4000`)

## 3. Build and start

```bash
docker compose build
docker compose up -d
```

First build takes a few minutes (installs the apt tools + npm deps + builds the
web app). On startup the API auto-creates the SQLite DB, applies the schema, and
seeds the default NDTECH profiles + a demo firmware (only once).

## 4. Open it

- Web UI:  `http://<server-ip>:3000`
- API health check:  `http://<server-ip>:4000/health`

Go to **Settings** — all tools should show `✓` (native) and "Live analysis
possible: Yes". Upload a real firmware and the Preview now shows its **actual**
web UI.

## Everyday commands

```bash
docker compose logs -f api        # follow API logs
docker compose logs -f web        # follow web logs
docker compose ps                 # service status
docker compose restart api        # restart a service
docker compose down               # stop (keeps the storage volume)
docker compose up -d --build      # rebuild + restart after code changes
```

Run the CLI inside the running API container:

```bash
docker compose exec api npm run cli -- --help
```

## Data persistence

All uploads, extraction workspaces, exports, profile assets, and the SQLite
database live in the named volume **`ndtech-storage`** (mounted at
`/app/storage`). It survives `docker compose down` and rebuilds.

```bash
docker volume ls                  # see ndtech-storage
# Back up the volume:
docker run --rm -v ndtech-ont_ndtech-storage:/data -v "$PWD":/backup \
  busybox tar czf /backup/ndtech-storage-backup.tar.gz -C /data .
```

To start completely fresh (⚠️ deletes all data): `docker compose down -v`.

## Updating after code changes

`PUBLIC_API_URL` is baked at build time, so a plain `up` won't pick up a changed
URL or new code in the web bundle. Rebuild:

```bash
git pull            # or copy new files
docker compose build
docker compose up -d
```

## Optional: one origin via a reverse proxy

Exposing two ports is fine for LAN/internal use. If you'd rather serve
everything from a single domain (and avoid setting a LAN IP in `PUBLIC_API_URL`),
put nginx/Caddy/Traefik in front: route `/` → `web:3000` and `/api` + `/health`
→ `api:4000`, then set `PUBLIC_API_URL=https://your-domain` and rebuild. (The API
already enables permissive CORS, so the split-port setup also works as-is.)

## Safety reminder

Running with real tools means extraction/branding operate on real firmware. The
safety guarantees still hold: originals are never modified, every changed asset
is backed up (`.ndtech-backup`), repack stays **suggestion-only** unless you set
`ALLOW_REPACK_EXECUTION=true`, and every command is logged. See `docs/SAFETY.md`
and `docs/FLASHING-WARNING.md`.
