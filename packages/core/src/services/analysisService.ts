/**
 * Firmware analysis service (read-only binwalk + file identification).
 *
 * SAFETY: Analysis never modifies the firmware. It only scans signatures and
 * records the output. No auto-extraction or modification happens here.
 */
import { analyzeBinwalk, identifyFile } from '@ndtech/firmware-tools';
import { prisma } from '../db.js';
import { NotFoundError } from '../errors.js';
import { toAnalysis } from '../mappers.js';
import { makeCommandLogger } from '../command-logger.js';
import { getFirmware } from './firmwareService.js';
import type { AnalysisResult } from '@ndtech/shared';

export async function runAnalysis(firmwareId: string): Promise<AnalysisResult> {
  const firmware = await getFirmware(firmwareId);
  const logger = makeCommandLogger({ firmwareId });

  // Create a pending record up front so the UI can show progress.
  const pending = await prisma.analysisResult.create({
    data: { firmwareId, status: 'running' },
  });

  try {
    const binwalk = await analyzeBinwalk(firmware.storagePath, { logger });
    const fileId = await identifyFile(firmware.storagePath, { logger });

    const updated = await prisma.analysisResult.update({
      where: { id: pending.id },
      data: {
        status: 'completed',
        binwalkOutput: binwalk.command.stdout,
        fileOutput: fileId.stdout,
        partitions: JSON.stringify(binwalk.partitions),
        isMock: binwalk.isMock,
        error: null,
      },
    });
    return toAnalysis(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await prisma.analysisResult.update({
      where: { id: pending.id },
      data: { status: 'failed', error: message },
    });
    return toAnalysis(failed);
  }
}

export async function getLatestAnalysis(firmwareId: string): Promise<AnalysisResult | null> {
  const row = await prisma.analysisResult.findFirst({
    where: { firmwareId },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toAnalysis(row) : null;
}

export async function listAnalyses(firmwareId: string): Promise<AnalysisResult[]> {
  const rows = await prisma.analysisResult.findMany({
    where: { firmwareId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toAnalysis);
}

export async function getAnalysis(id: string): Promise<AnalysisResult> {
  const row = await prisma.analysisResult.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('AnalysisResult', id);
  return toAnalysis(row);
}
