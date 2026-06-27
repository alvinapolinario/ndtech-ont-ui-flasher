/**
 * binwalk wrapper + output parser.
 *
 * SAFETY: This is a *read-only* signature scan. It never writes to the firmware
 * image. Detected partitions are best-effort hints — we never assume a fixed
 * layout for the HG8145V5.
 */
import type { DetectedPartition, PartitionKind } from '@ndtech/shared';
import {
  runTool,
  mockCommand,
  resolveToolRuntime,
  type CommandLogger,
  type CommandResult,
} from './exec.js';

export interface BinwalkAnalysis {
  command: CommandResult;
  partitions: DetectedPartition[];
  isMock: boolean;
}

/** Map a binwalk description line to a coarse partition kind. */
export function classifyDescription(description: string): PartitionKind {
  const d = description.toLowerCase();
  if (d.includes('squashfs')) return 'squashfs';
  if (d.includes('cramfs')) return 'cramfs';
  if (d.includes('jffs2')) return 'jffs2';
  if (d.includes('u-boot') || d.includes('uimage') || d.includes('boot')) return 'bootloader';
  if (d.includes('kernel') || d.includes('linux kernel') || d.includes('arm')) return 'kernel';
  if (d.includes('gzip')) return 'gzip';
  if (d.includes('xz compressed')) return 'xz';
  if (d.includes('lzma')) return 'lzma';
  if (d.includes('filesystem') || d.includes('rootfs')) return 'rootfs';
  return 'unknown';
}

/**
 * Parse the classic three-column binwalk signature table.
 * Columns: DECIMAL  HEXADECIMAL  DESCRIPTION
 */
export function parseBinwalkOutput(output: string): DetectedPartition[] {
  const partitions: DetectedPartition[] = [];
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    // A data row starts with a decimal offset, then hex, then description.
    const match = /^(\d+)\s+(0x[0-9A-Fa-f]+)\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const [, decimal, , description] = match;
    if (!decimal || !description) continue;

    partitions.push({
      kind: classifyDescription(description),
      description: description.trim(),
      offset: Number.parseInt(decimal, 10),
      size: null,
    });
  }

  // Best-effort size inference: distance to the next detected signature.
  for (let i = 0; i < partitions.length - 1; i++) {
    const cur = partitions[i];
    const next = partitions[i + 1];
    if (cur && next) cur.size = next.offset - cur.offset;
  }

  return partitions;
}

function mockBinwalkOutput(): string {
  return [
    'DECIMAL       HEXADECIMAL     DESCRIPTION',
    '--------------------------------------------------------------------------------',
    '0             0x0             uImage header, header size: 64 bytes, image size: 2097152',
    '64            0x40            LZMA compressed data, properties: 0x5D',
    '2097152       0x200000        Linux kernel ARM boot executable image',
    '4194304       0x400000        Squashfs filesystem, little endian, version 4.0, compression: xz, size: 12582912 bytes',
    '16777216      0x1000000       JFFS2 filesystem, little endian',
    '',
  ].join('\n');
}

/**
 * Run a read-only binwalk signature scan, or return labelled mock output when
 * binwalk is unavailable / mock mode is forced.
 */
export async function analyzeBinwalk(
  firmwarePath: string,
  options: { logger?: CommandLogger } = {},
): Promise<BinwalkAnalysis> {
  const runtime = await resolveToolRuntime('binwalk');

  if (runtime === 'none') {
    const output = mockBinwalkOutput();
    const command = await mockCommand('binwalk', [firmwarePath], output, {
      logger: options.logger,
    });
    return { command, partitions: parseBinwalkOutput(output), isMock: true };
  }

  const command = await runTool('binwalk', [firmwarePath], {
    runtime,
    logger: options.logger,
  });
  return {
    command,
    partitions: parseBinwalkOutput(command.stdout),
    isMock: false,
  };
}

/** Optional `file` identification of the firmware image (read-only). */
export async function identifyFile(
  firmwarePath: string,
  options: { logger?: CommandLogger } = {},
): Promise<CommandResult> {
  const runtime = await resolveToolRuntime('file');
  if (runtime === 'none') {
    return mockCommand('file', [firmwarePath], 'data (mock identification)', {
      logger: options.logger,
    });
  }
  return runTool('file', [firmwarePath], { runtime, logger: options.logger });
}
