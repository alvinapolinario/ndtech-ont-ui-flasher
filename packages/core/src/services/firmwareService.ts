/**
 * Firmware intake service.
 *
 * SAFETY: The uploaded image is treated as immutable. We hash it, record
 * metadata, and never modify or delete the original file during analysis or
 * branding. Deleting a Firmware record (admin action) leaves the file on disk.
 */
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { toFirmware } from '../mappers.js';
import type { Firmware } from '@ndtech/shared';

export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export interface RegisterFirmwareInput {
  /** Absolute path to the already-saved uploaded file. */
  storagePath: string;
  /** The original filename supplied by the user. */
  originalName: string;
  notes?: string | null;
  isMock?: boolean;
}

/** Register an uploaded firmware file: hash it and persist metadata. */
export async function registerFirmware(input: RegisterFirmwareInput): Promise<Firmware> {
  const stat = await fs.stat(input.storagePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new ValidationError(`Uploaded file not found at "${input.storagePath}".`);
  }
  if (stat.size > config.maxUploadBytes) {
    throw new ValidationError(
      `Firmware exceeds the maximum allowed size (${config.maxUploadBytes} bytes).`,
    );
  }

  const sha256 = await hashFile(input.storagePath);

  const row = await prisma.firmware.create({
    data: {
      filename: path.basename(input.storagePath),
      originalName: input.originalName,
      sizeBytes: stat.size,
      sha256,
      storagePath: input.storagePath,
      notes: input.notes ?? null,
      isMock: input.isMock ?? false,
    },
  });
  return toFirmware(row);
}

export async function listFirmware(): Promise<Firmware[]> {
  const rows = await prisma.firmware.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toFirmware);
}

export async function getFirmware(id: string): Promise<Firmware> {
  const row = await prisma.firmware.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Firmware', id);
  return toFirmware(row);
}

/** Remove the database record only. The original file on disk is preserved. */
export async function deleteFirmwareRecord(id: string): Promise<void> {
  const row = await prisma.firmware.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Firmware', id);
  await prisma.firmware.delete({ where: { id } });
}
