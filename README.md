# panels

A self-hosted comic book reader. Single Docker container, single SQLite
file, Culvert-powered random-access CBZ streaming.

## Features

- Email + password auth with invite-gated registration (Better Auth).
- CBZ upload and directory scan. Metadata from ComicInfo.xml, ComicVine
  (optional), or filename parsing.
- Reader with windowed page prefetch, thumbnail strip, keyboard
  shortcuts, fit modes, RTL/manga mode, double-page spreads with
  auto-solo for wide pages, background color selector, help dialog.
- Sharp-generated thumbnails cached to disk.
- Everything runs in one container on a homelab.

## Stack

React Router v7 (framework mode) · Prisma + SQLite
(`@prisma/adapter-better-sqlite3`) · Better Auth · Conform + Zod v4 ·
Tailwind v4 + shadcn/ui primitives · Sharp · `@culvert/zip` +
`@culvert/stream` · `@mjackson/form-data-parser`.

## Quick start (local dev)

```sh
npm install
cp .env.example .env
# edit .env — set BETTER_AUTH_SECRET at minimum
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open http://localhost:5173, sign in as the seed admin, generate an
invite, create regular users, upload comics.

## Deploying to a homelab

### Prereqs

- Docker + docker compose
- A host directory containing your CBZs (e.g. `/srv/comics`)
- A DNS name pointed at the host (or a Tailscale machine name)
- An SMTP-less setup is fine — we don't send email

### Steps

1. Clone the repo onto the host.
2. Copy and fill in production env:
   ```sh
   cp .env.production.example .env.production
   ```
   Set `BETTER_AUTH_SECRET` (32+ random bytes), `BETTER_AUTH_URL`
   (the public HTTPS URL), `PANELS_LIBRARY_PATH` (host path to your
   comics), and optionally `COMICVINE_API_KEY` + `SEED_ADMIN_*`.
3. Edit `Caddyfile` to replace `comics.example.com` with your domain,
   or switch to the LAN variant with `tls internal`.
4. Start it:
   ```sh
   docker compose --env-file .env.production up -d
   ```
5. Watch the first-boot logs:
   ```sh
   docker compose logs -f panels
   ```
   Expect: "applying migrations" → "running seed" (if configured) →
   "starting server".
6. Open the public URL. Sign in as the seed admin. Generate an invite
   for each other user. Remove `SEED_ADMIN_*` from env after initial
   setup so stale credentials can't be used again (the seed itself
   is idempotent and won't recreate users, but pruning the env keeps
   secrets out of `docker inspect`).

### Adding comics

Two paths:

- **Scan.** Copy `.cbz` files to the host's library directory
  (`PANELS_LIBRARY_PATH` on the host, mounted at `/data/library` in
  the container). In panels, go to Library → Scan. The app walks the
  directory, hashes each file, dedups against the DB, and ingests
  new ones.
- **Upload.** In panels, go to Library → Upload. Stream a CBZ through
  the browser; panels moves it into the library as `{fileHash}.cbz`.

### Updating

```sh
git pull
docker compose --env-file .env.production build panels
docker compose --env-file .env.production up -d panels
```

Migrations run automatically on container start via the entrypoint.

### Backups

**The only thing you need to back up is `/var/lib/docker/volumes/panels_db-data`.**
A nightly `sqlite3 panels.db ".backup /path/to/backups/panels-$(date +%F).db"`
against the live file is safe (SQLite handles the snapshot). Keep 7
days of rotations.

Optional: back up the library directory too, but that's your comics —
you presumably have them elsewhere.

You can delete the cache volume any time. Thumbnails regenerate on
next access.

## Troubleshooting

- **"BETTER_AUTH_SECRET is required"** — compose demands it. Set in
  `.env.production`, pass via `--env-file`.
- **502 for a minute after deploy** — Caddy waits for panels' health
  check. Give it `start_period` (60 s). If it stays bad, check
  `docker compose logs panels`.
- **"database is locked"** — a second Prisma process hit the same
  file. Don't run `prisma studio` against the production DB. If you
  need to inspect, copy the DB file out first.
- **Sharp ENOENT** — rebuild with `--no-cache`. Alpine native modules
  rarely need this but occasionally do after a Node minor bump.
- **Can't upload big comics** — confirm Caddy's `request_body
  max_size` matches the largest CBZ you have. Default in this
  Caddyfile is 2 GB.

## License

MIT.
