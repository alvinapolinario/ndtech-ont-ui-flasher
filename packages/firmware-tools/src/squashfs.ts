/**
 * SquashFS probing helpers (read-only).
 *
 * SAFETY: We only ever READ superblock metadata here (`unsquashfs -s`). Repacking
 * is handled separately and never runs automatically.
 */
import {
  runTool,
  mockCommand,
  resolveToolRuntime,
  type CommandLogger,
  type CommandResult,
} from './exec.js';

export interface SquashfsInfo {
  isSquashfs: boolean;
  version: string | null;
  compression: string | null;
  blockSizeBytes: number | null;
  raw: string;
  isMock: boolean;
}

export function parseUnsquashfsStat(output: string): Omit<SquashfsInfo, 'raw' | 'isMock'> {
  const isSquashfs = /valid\s+SQUASHFS/i.test(output) || /Compression\s+/i.test(output);
  const version = /SQUASHFS\s+([0-9]+:[0-9]+)/i.exec(output)?.[1] ?? null;
  const compression = /Compression\s+(\w+)/i.exec(output)?.[1] ?? null;
  const blockMatch = /Block size\s+(\d+)/i.exec(output)?.[1];
  const blockSizeBytes = blockMatch ? Number.parseInt(blockMatch, 10) : null;
  return { isSquashfs, version, compression, blockSizeBytes };
}

function mockStatOutput(): string {
  return [
    'Found a valid SQUASHFS 4:0 superblock on image.',
    'Creation or last append time Thu Jan  1 00:00:00 1970',
    'Filesystem size 12288.00 Kbytes (12.00 Mbytes)',
    'Compression xz',
    'Block size 131072',
    'Number of fragments 42',
    'Number of inodes 980',
    '',
  ].join('\n');
}

/** Probe a carved SquashFS image (or device) for its superblock metadata. */
export async function detectSquashfs(
  squashfsImagePath: string,
  options: { logger?: CommandLogger } = {},
): Promise<SquashfsInfo> {
  const runtime = await resolveToolRuntime('unsquashfs');

  let command: CommandResult;
  if (runtime === 'none') {
    command = await mockCommand('unsquashfs', ['-s', squashfsImagePath], mockStatOutput(), {
      logger: options.logger,
    });
  } else {
    command = await runTool('unsquashfs', ['-s', squashfsImagePath], {
      runtime,
      logger: options.logger,
    });
  }

  return {
    ...parseUnsquashfsStat(command.stdout),
    raw: command.stdout,
    isMock: command.isMock,
  };
}

/**
 * Build a SUGGESTED mksquashfs command (string form). This is intentionally a
 * suggestion only — the tool does not execute it unless explicitly allowed.
 */
export function buildMksquashfsSuggestion(
  sourceDir: string,
  outputImage: string,
  info: Pick<SquashfsInfo, 'compression' | 'blockSizeBytes'>,
): string {
  const comp = info.compression ? `-comp ${info.compression}` : '-comp xz';
  const block = info.blockSizeBytes ? `-b ${info.blockSizeBytes}` : '-b 131072';
  return `mksquashfs "${sourceDir}" "${outputImage}" ${comp} ${block} -noappend -no-xattrs`;
}
