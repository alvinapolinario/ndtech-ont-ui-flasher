# Development Guide

## Monorepo layout

```
/apps
  /web      Next.js + TypeScript + Tailwind frontend
  /api      Express + TypeScript REST API
  /cli      ndtech-ont command line tool
/packages
  /shared           Shared TypeScript types & constants
  /firmware-tools   child_process wrappers (binwalk, unsquashfs, file, ...)
  /branding-engine  Asset replacement, patching, repack feasibility
  /core             Prisma client + domain services + seed/mock data
/storage
  /uploads      Uploaded firmware images (+ SHA-256)
  /workspaces   Per-firmware extraction workspaces
  /exports      Generated export bundles
  /profiles     Saved branding profile JSON files
/docs           Safety + device notes
```

The repo uses **npm workspaces**. Cross-package imports use the aliases
`@ndtech/shared`, `@ndtech/firmware-tools`, `@ndtech/branding-engine`, and
`@ndtech/core` (see `tsconfig.base.json`). The API and CLI run via `tsx`, so no
pre-build step is needed in development.

## First-time setup

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push     # creates the SQLite database
npm run seed            # loads NDTECH profile + mock firmware so the UI works
```

## Running

```bash
npm run dev             # API (:4000) + web (:3000) together
# or individually:
npm run dev:api
npm run dev:web
```

## CLI

```bash
npm run cli -- analyze ./path/to/firmware.bin
npm run cli -- extract <firmware-id>
npm run cli -- scan-assets <firmware-id>
npm run cli -- apply-branding <firmware-id> --profile storage/profiles/ndtech.json
npm run cli -- report <firmware-id>
npm run cli -- export <firmware-id>
```

## Mock / demo mode

On Windows/macOS (or anywhere the Linux tools are missing) the firmware-tools
package detects unavailable binaries and returns **clearly-labelled mock output**
so the UI and data flow can be exercised without real firmware. Set
`FORCE_MOCK_MODE=true` to force it even on Ubuntu.

## Design conventions

- **Strong error handling:** services throw typed errors; routes map them to HTTP.
- **Everything is logged:** external commands go through `runCommand()` which
  records a `CommandLog` row.
- **Never destructive:** uploads are immutable; modified assets are backed up.
- Keep comments focused on *firmware-safety intent*, not narration.
