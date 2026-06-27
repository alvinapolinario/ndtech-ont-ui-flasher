# Troubleshooting: "can't extract / Asset Browser is empty"

When you upload a **real** firmware and extraction yields no assets, the cause is
almost always one of these:

1. **binwalk can't unpack the filesystem** because the extractor for that format
   isn't installed. Huawei/Realtek ONT images frequently use a **non-standard
   (LZMA) SquashFS** that needs **`sasquatch`** (plain `unsquashfs` won't open it),
   or **JFFS2** (needs `jefferson`) / **UBIFS** (needs `ubi_reader`).
2. The image is **encrypted or signed** (some ISP firmware is). There is nothing
   to extract — by design this tool does not break encryption.
3. The web UI lives in a partition that binwalk didn't recurse into.

Since the fix added error reporting, a failed extraction now shows the reason on
the **Details** and **Asset Browser** tabs instead of an empty list.

## Diagnose inside the running container

```bash
# 1. What did the API say when it extracted?
docker compose logs --tail=80 api

# 2. Which extractors are present?
docker compose exec api sh -lc 'binwalk --help >/dev/null 2>&1 && echo binwalk OK; \
  for t in unsquashfs sasquatch jefferson ubi_reader; do \
    command -v $t >/dev/null 2>&1 && echo "$t: $(command -v $t)" || echo "$t: MISSING"; done'

# 3. Inspect the firmware signatures directly (no extraction):
#    find the stored upload first:
docker compose exec api sh -lc 'ls -la storage/uploads'
docker compose exec api sh -lc 'binwalk storage/uploads/<your-file>.bin | head -40'

# 4. Try a manual extraction to see the real error:
docker compose exec api sh -lc 'cd /tmp && binwalk -eM --run-as=root storage/uploads/<your-file>.bin; \
  echo "exit=$?"; find /tmp -maxdepth 3 -type d -iname "*web*" -o -iname "*html*" 2>/dev/null'
```

Read the `binwalk` output from step 3:

- You see **`Squashfs filesystem`** but extraction produced nothing → you need
  **`sasquatch`**.
- You see **`JFFS2`** → install **`jefferson`**. **`UBI`/`UBIFS`** → **`ubi_reader`**.
- You see **`LZMA`/`gzip`** chunks only, no filesystem, or **high-entropy /
  encrypted** data → the image is likely encrypted; extraction isn't possible.

## Installing the extractors

The provided `Dockerfile` already tries to install `sasquatch`, `jefferson`, and
`ubi_reader` (best-effort). If your build predates that or the best-effort step
was skipped, either **rebuild** (`docker compose build --no-cache && docker compose up -d`)
or install into the running container to test quickly:

```bash
# sasquatch (the usual Huawei fix)
docker compose exec api sh -lc 'apt-get update && \
  apt-get install -y --no-install-recommends build-essential git liblzo2-dev zlib1g-dev liblzma-dev wget && \
  cd /tmp && git clone --depth 1 https://github.com/devttys0/sasquatch && \
  cd sasquatch && ./build.sh && cp -n sasquatch /usr/local/bin/'

# jefferson (JFFS2) + ubi_reader (UBIFS)
docker compose exec api sh -lc 'pip3 install --break-system-packages jefferson ubi_reader'
```

(Installing into a running container is temporary — it's lost on
`docker compose down`/rebuild. Make it permanent via the Dockerfile.)

## Re-run extraction

After installing the missing extractor, re-extract from the UI: open the
firmware → **Extract & Preview UI** (or **Re-extract** on Details). The Asset
Browser and Preview will populate once the filesystem unpacks.

## Still empty but extraction "succeeded"

If binwalk unpacked files but the Asset Browser is empty, the web UI may be in a
nested image. Check what came out:

```bash
docker compose exec api sh -lc 'find storage/workspaces -type f \
  \( -iname "*.html" -o -iname "*.css" -o -iname "*.js" -o -iname "*.gif" -o -iname "*.png" \) | head'
```

If you find a web folder there whose name isn't auto-detected as a web root, it
still appears in the Asset Browser (the scanner walks the whole extraction tree),
just without the "web root ✓" flag — branding still works on those files.
