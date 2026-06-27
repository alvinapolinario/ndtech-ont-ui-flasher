# Enabling live firmware analysis on Windows (WSL bridge)

The firmware tools this app relies on — `binwalk`, `unsquashfs`/`mksquashfs`
(squashfs-tools), `file`, `strings`, `hexdump`, `7z`, `gzip`, `xz` — are Linux
tools. They are not available natively on Windows, so on a fresh Windows machine
the app runs in **mock mode** (clearly labelled in the UI).

You do **not** need Docker. This machine already has **WSL2** working — you just
need a Linux distro and the tools. The app then runs each tool *through WSL*
automatically (the "WSL bridge"), translating Windows paths like
`D:\...\firmware.bin` to `/mnt/d/.../firmware.bin` under the hood. Your data,
profiles, database, and the Windows-hosted servers all stay exactly as they are.

## 1. Install Ubuntu in WSL (one time)

Open **PowerShell** and run:

```powershell
wsl --install -d Ubuntu
```

- This may require a reboot.
- On first launch Ubuntu asks you to create a Linux username and password
  (this is separate from your Windows login — remember it; it's used for `sudo`).

Verify it's installed:

```powershell
wsl -l -v
```

## 2. Install the firmware tools inside Ubuntu (one time)

Open **Ubuntu** (Start menu) or run `wsl` from PowerShell, then:

```bash
sudo apt update
sudo apt install -y binwalk squashfs-tools file binutils bsdmainutils p7zip-full gzip xz-utils
```

Quick check that the key tool is found:

```bash
which binwalk unsquashfs file
```

## 3. Restart the app's API so it re-detects the tools

Tool availability is cached when the API starts. After installing the tools,
restart the API process (stop it and run `npm run dev` again, or restart just
the API workspace). No data is lost.

## 4. Confirm

Open **Settings** in the web UI. The tools should now show `✓` and the ones
running through WSL are tagged **WSL**. "Tool runtime" will read **WSL bridge**
and "Live analysis possible" will be **Yes**.

## Optional: target a specific distro

If you have more than one WSL distro, set `WSL_DISTRO` in your `.env` to pick
which one the bridge uses (e.g. `WSL_DISTRO=Ubuntu`). Leave it blank to use the
WSL default.

## Notes & safety

- The bridge only changes *where* tools run. All safety rules still apply:
  original firmware is never modified, every changed asset is backed up, repack
  is never automatic, and every command (including the `wsl.exe` invocation) is
  logged to the database.
- Extraction writes into the same Windows `storage/workspaces/...` folder (via
  `/mnt/...`), so the Windows app reads the extracted files normally.
- If WSL or the tools aren't present, the app silently falls back to mock mode —
  nothing breaks.
