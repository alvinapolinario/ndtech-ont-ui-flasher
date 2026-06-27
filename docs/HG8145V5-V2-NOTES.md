# HG8145V5 V2 — Analysis Notes

> These notes are **general, non-proprietary** observations about the device
> family and how to approach analysis. They contain **no** credentials, keys,
> exploits, or signature-bypass information.

## Device overview

- **Model:** Huawei EchoLife HG8145V5 (the "V2" hardware revision).
- **Type:** GPON ONT / router with web management UI.
- **Typical SoC:** Huawei HiSilicon-based GPON gateway platform.
- **Flash:** SPI NOR + (often) NAND; rootfs commonly SquashFS.

> The exact layout varies by firmware version and carrier customization. **Never
> assume** a fixed partition map — always rely on `binwalk` analysis of *your*
> specific image.

## Typical firmware structure (varies!)

A Huawei ONT `.bin` may contain, in some order:

- Bootloader (U-Boot derivative)
- Kernel (often gzip/LZMA/XZ compressed)
- **rootfs** — frequently **SquashFS** (the part containing the web UI)
- Configuration / calibration partitions
- Vendor signature / header blocks

The web UI usually lives inside the rootfs under a path such as:

```
/www            /web            /html
/htdocs         /home/httpd     /var/www
/etc_ro/web
```

## Branding-relevant assets to look for

```
index.html   login.html   main.html
style.css    common.css    *.css
logo.png     *.gif         favicon.ico
*.js         lang/*.js     language*.xml   *.gch
```

> Some Huawei builds store UI text inside `.gch`/`.xml` "language" resources or
> JS string tables rather than directly in HTML. The asset scanner flags these
> as **candidates** for manual review; it does not guess at binary formats.

## Practical workflow

1. Upload the image, record its SHA-256.
2. Run `binwalk` analysis (read-only). Note detected filesystems & offsets.
3. Extract with `binwalk -eM` into the isolated workspace.
4. Locate the web-UI folder among the candidates above.
5. Apply branding to **extracted assets** (backups are automatic).
6. Review the patch report.
7. Run repack **feasibility** analysis — do not repack blindly.

## Things this tool deliberately ignores

- PLOAM / GPON serial provisioning data.
- TR-069 ACS URLs and credentials.
- Any partition that looks like a key store or signature block (flagged, never modified).
