#!/bin/sh
set -eu

echo "[entrypoint] panels starting"

# Ensure data directories exist with correct ownership. On first boot
# with a fresh volume, these may be owned by root from Docker's
# initial creation; the container user needs write.
mkdir -p /data/db /data/cache /data/tmp

echo "[entrypoint] applying migrations"
npx prisma migrate deploy

# Seed admin if configured and DB is empty. The seed script itself is
# idempotent (Phase 1 Task 1.12), but we short-circuit the npx call
# when the env isn't set so there's one fewer line of noise in logs.
if [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] running seed"
  npx prisma db seed
fi

echo "[entrypoint] starting server"
exec node ./build/server/index.js
