#!/usr/bin/env sh
# API container entrypoint: prepare storage + database, seed once, then start.
set -e

STORAGE_ROOT="${STORAGE_ROOT:-/app/storage}"

echo "[entrypoint] Ensuring storage directories under ${STORAGE_ROOT} ..."
mkdir -p \
  "${STORAGE_ROOT}/uploads" \
  "${STORAGE_ROOT}/workspaces" \
  "${STORAGE_ROOT}/exports" \
  "${STORAGE_ROOT}/profiles"

echo "[entrypoint] Applying database schema (prisma db push) ..."
npx prisma db push --schema packages/core/prisma/schema.prisma --skip-generate

# Seed only once so restarts don't duplicate the default profiles / mock data.
if [ ! -f "${STORAGE_ROOT}/.seeded" ]; then
  echo "[entrypoint] Seeding initial data ..."
  npm run seed
  touch "${STORAGE_ROOT}/.seeded"
else
  echo "[entrypoint] Seed marker found — skipping seed."
fi

echo "[entrypoint] Starting API on ${API_HOST:-0.0.0.0}:${API_PORT:-4000} ..."
exec npm run start --workspace @ndtech/api
