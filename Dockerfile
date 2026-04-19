# syntax=docker/dockerfile:1.9

# ──────────── deps ────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Build-time deps for native modules (better-sqlite3, sharp).
RUN apk add --no-cache python3 make g++ libc6-compat vips-dev

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# ──────────── build ────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat vips-dev

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client generation must happen with the real schema.
RUN npx prisma generate

# React Router build — emits build/server + build/client.
RUN npm run build

# Strip devDependencies after build. This keeps `prisma` (runtime),
# `tsx` (for seed), but drops TS / Vite / eslint / prettier etc.
RUN npm prune --omit=dev

# ──────────── runtime ────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# vips is needed at runtime for sharp. libc6-compat for better-sqlite3.
RUN apk add --no-cache libc6-compat vips curl tini

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_URL=file:/data/db/panels.db \
    LIBRARY_PATH=/data/library \
    CACHE_PATH=/data/cache \
    UPLOAD_TEMP_PATH=/data/tmp

# Non-root user, matching the uid convention most homelabs use.
RUN addgroup -g 1000 app && adduser -D -u 1000 -G app app \
    && mkdir -p /data/db /data/library /data/cache /data/tmp \
    && chown -R app:app /data /app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/build ./build
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/app/generated ./app/generated
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --chown=app:app --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/resources/healthz || exit 1

# tini is PID 1 and reaps zombies. Our entrypoint `exec`s node, so
# Node ends up as the signal target; tini exists because the default
# Node image recommendation is to have a proper init.
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
