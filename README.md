# NDTECH Huawei ONT Web UI Customizer

A safe, **internal** tool for customizing the **web-interface branding** of
firmware **you own** for spare/test **Huawei EchoLife HG8145V5 V2** ONT devices.

> **Scope: Level 2 branding only** — logo, favicon, CSS colors, login/footer
> text, and basic web-UI assets. This tool intentionally does **not** bypass
> signatures, unlock admin accounts, extract ISP credentials, crack passwords,
> or perform illegal firmware modification. Read **[docs/SAFETY.md](docs/SAFETY.md)**
> and **[docs/FLASHING-WARNING.md](docs/FLASHING-WARNING.md)** before use.

## Features

- **Firmware upload** with SHA-256 hashing and metadata tracking.
- **Read-only analysis** via `binwalk` (partition / filesystem detection).
- **Isolated extraction workspaces** with full command logging.
- **Asset scanner** for web-UI folders & files (HTML/CSS/JS/logo/favicon).
- **Branding profiles** (NDTECH default included) with logo/favicon upload.
- **Safe asset replacement** — visible labels, colors, images — always backed up.
- **Patch reports** (files changed, old/new text, image/CSS changes).
- **Before/after preview** of readable HTML pages.
- **Repack feasibility** analysis (never repacks blindly).
- **Export** branding JSON, modified assets, patch report, workspace ZIP.
- **CLI** (`ndtech-ont`) mirroring the web workflow.

## Tech stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | Next.js + TypeScript + Tailwind CSS          |
| API      | Node.js + TypeScript + Express               |
| CLI      | Node.js + TypeScript                         |
| Database | SQLite via Prisma                            |
| Firmware | `child_process` wrappers around Linux tools  |

### External tools (expected on Ubuntu 24.04)

`binwalk`, `unsquashfs` / `mksquashfs` (`squashfs-tools`), `file`, `strings`,
`hexdump` (`bsdmainutils`), `7z` (`p7zip-full`), `gzip`, `xz` (`xz-utils`).

> When these are missing (e.g. on Windows for UI testing) the tool runs in a
> clearly-labelled **mock mode** so the interface still works. **No proprietary
> Huawei firmware is bundled with this project.**

## Quick start

### 1. Install external tools (Ubuntu 24.04)

```bash
sudo apt update
sudo apt install -y binwalk squashfs-tools file binutils bsdmainutils \
                    p7zip-full gzip xz-utils
```

### 2. Install and set up the project

```bash
git clone <your-internal-repo-url> ndtech-ont-customizer
cd ndtech-ont-customizer
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run seed          # loads NDTECH profile + mock data
```

### 3. Run

```bash
npm run dev           # web UI at http://localhost:3000, API at http://localhost:4000
```

## How to use it safely

1. **Analyze:** Upload firmware you are authorized to modify. Review the binwalk
   results — *no modification happens here*.
2. **Extract:** Create a workspace (`binwalk -eM`). All commands are logged.
3. **Scan assets:** Locate web-UI folders and files.
4. **Apply branding:** Pick a profile (e.g. NDTECH). The engine edits **copies**,
   backs up originals, and records a patch report.
5. **Preview:** View before/after for readable HTML.
6. **Repack feasibility:** Read the report. Repacking is **suggested**, not forced.
7. **Export:** Bundle the modified assets / report. The original firmware is
   excluded unless you explicitly opt in.

## Firmware modification risks & recovery

Modified firmware **can brick your device**. Always:

- Keep the **original firmware** (export a copy, store offline).
- Use a **spare ONT** only.
- Prepare **UART** serial recovery.
- Prepare a **CH341A SPI** flash backup before any low-level work.

Full details: [docs/FLASHING-WARNING.md](docs/FLASHING-WARNING.md).

## Documentation

- [docs/SAFETY.md](docs/SAFETY.md) — what the tool will and won't do.
- [docs/HG8145V5-V2-NOTES.md](docs/HG8145V5-V2-NOTES.md) — device analysis notes.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — monorepo & dev workflow.
- [docs/FLASHING-WARNING.md](docs/FLASHING-WARNING.md) — brick risk & recovery.

## License

MIT (the tooling). This project bundles **no** Huawei firmware or proprietary
assets. You are responsible for complying with your device warranty, ISP
contract, and local law.
