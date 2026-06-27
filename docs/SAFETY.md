# SAFETY — Read This First

The **NDTECH Huawei ONT Web UI Customizer** is an **analysis and asset-customization
tool only**. It exists to help you re-brand the *visible web interface* (logo,
favicon, colors, labels, footer) of firmware **you own and are legally allowed to
modify**, on **spare / test** Huawei EchoLife HG8145V5 V2 ONT devices.

## What this tool DOES

- Calculates and records a SHA-256 hash of every uploaded firmware image.
- Runs read-only analysis (`binwalk`, `file`, `strings`, `hexdump`).
- Extracts firmware into an isolated per-firmware workspace for inspection.
- Detects candidate web-UI folders and assets.
- Applies **Level 2 branding** changes (logo, favicon, CSS colors, visible text)
  to *extracted web assets* — always keeping a backup of every modified file.
- Generates patch reports and a repack **feasibility** analysis.

## What this tool DOES NOT DO (by design)

This tool **will not**, and must never be extended to:

- Bypass, remove, or forge firmware **signatures**, encryption, or license checks.
- Unlock, create, or expose **admin / superuser accounts**.
- Extract, store, or display **ISP credentials**, TR-069 ACS secrets, or PLOAM keys.
- Perform **password cracking** or brute force.
- Install backdoors, hidden accounts, or persistence mechanisms.
- Automatically flash firmware to a device.

If a requested feature requires any of the above, the answer is **no**.

## Hard rules enforced in code

1. **The original firmware file is never deleted or modified in place.**
2. **Every modified web asset gets a `.ndtech-backup` copy first.**
3. **Every external command execution is logged** (command, args, exit code, output).
4. **Repacking never runs automatically.** `mksquashfs` commands are *suggested*,
   not executed, unless you explicitly opt in via `ALLOW_REPACK_EXECUTION=true`
   AND the firmware structure is confirmed modifiable.

## Legal & ethical use

- Only use on devices you **own** or have **written authorization** to modify.
- Modifying ISP-provided equipment may violate your service contract and local law.
- Do **not** redistribute proprietary Huawei firmware. This repo bundles **none**.

See also: [FLASHING-WARNING.md](./FLASHING-WARNING.md).
