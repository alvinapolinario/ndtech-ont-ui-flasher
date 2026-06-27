# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# NDTECH Huawei ONT Web UI Customizer
#
# A single image that can run BOTH the API and the web app (compose picks the
# command per service). Debian-based so the real firmware analysis tools
# (binwalk, squashfs-tools, ...) are available natively — no mock mode, no WSL.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim

# --- Firmware analysis toolchain (used by the API for live extraction) -------
# binwalk         : firmware scanning / extraction
# squashfs-tools  : unsquashfs / mksquashfs
# file            : file(1) identification
# binutils        : strings
# bsdmainutils    : hexdump
# p7zip-full      : 7z
# gzip / xz-utils : gzip / xz
RUN apt-get update && apt-get install -y --no-install-recommends \
      binwalk \
      squashfs-tools \
      file \
      binutils \
      bsdmainutils \
      p7zip-full \
      gzip \
      xz-utils \
      ca-certificates \
      openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Install dependencies (cached unless a manifest or the lockfile changes) -
COPY package.json package-lock.json ./
COPY packages/shared/package.json        packages/shared/package.json
COPY packages/firmware-tools/package.json packages/firmware-tools/package.json
COPY packages/branding-engine/package.json packages/branding-engine/package.json
COPY packages/core/package.json          packages/core/package.json
COPY apps/api/package.json               apps/api/package.json
COPY apps/web/package.json               apps/web/package.json
COPY apps/cli/package.json               apps/cli/package.json
RUN npm ci

# --- App source --------------------------------------------------------------
COPY . .

# --- Generate Prisma client + build the Next.js web app ----------------------
# NEXT_PUBLIC_API_URL is baked into the browser bundle at build time, so it must
# be the URL the *browser* uses to reach the API (your server's address:4000).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run prisma:generate \
 && npm run build --workspace @ndtech/web

ENV NODE_ENV=production
EXPOSE 4000 3000

# Default command runs the API; the web service overrides this in compose.
CMD ["sh", "docker/entrypoint-api.sh"]
