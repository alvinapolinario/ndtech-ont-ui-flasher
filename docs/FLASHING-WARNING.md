# ⚠️ FLASHING WARNING — Modified Firmware Can BRICK Your Device

> Flashing custom or modified firmware to an ONT is **inherently risky** and can
> render the device **permanently inoperable (bricked)**. Proceed only on a
> **spare / test** unit you can afford to lose.

## Before you even think about flashing

1. **Keep the original firmware.** This tool always preserves your upload; export
   a copy and store it offline. Without it, recovery may be impossible.
2. **Use a spare ONT only.** Never experiment on the device providing your live
   internet service.
3. **Understand the repack risk.** Re-creating a SquashFS/rootfs with the wrong
   block size, compression, or padding can produce an image the bootloader
   rejects — sometimes silently, sometimes by bricking.
4. **Signatures matter.** Many Huawei images are signed/verified at boot. This
   tool does **not** bypass signatures. A modified-but-unsigned image may simply
   refuse to boot. That is expected and intentional.

## Recommended recovery preparation

| Method | What it gives you | Notes |
| ------ | ----------------- | ----- |
| **Original firmware backup** | Re-flash to known-good state | Mandatory. Keep offline. |
| **UART / serial console** | Boot logs + U-Boot recovery prompt | Usually 3.3V TTL; identify TX/RX/GND. Do **not** apply 5V. |
| **CH341A + SOIC clip** | Raw SPI flash dump/restore | Read the chip BEFORE writing. Verify voltage (most ONT flash is 3.3V). |
| **TFTP recovery** | Bootloader-assisted re-flash | Availability depends on bootloader. |

## NDTECH does not accept liability

This is an internal/educational tool. You assume **all** risk. If you are not
comfortable performing UART or SPI recovery, **do not flash modified firmware**.
Branding the *extracted web assets* and reviewing the patch report is completely
safe — flashing is the only step that carries brick risk.
