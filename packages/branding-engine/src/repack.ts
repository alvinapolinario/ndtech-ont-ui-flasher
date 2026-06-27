/**
 * Repack feasibility analyzer.
 *
 * SAFETY: This module ONLY produces a report and a *suggested* command. It never
 * runs mksquashfs. Repacking firmware can brick the device and may also fail
 * signature verification on boot — the user must make that decision explicitly.
 */
import type { DetectedPartition } from '@ndtech/shared';
import { buildMksquashfsSuggestion, type SquashfsInfo } from '@ndtech/firmware-tools';

export interface RepackFeasibilityReport {
  rootfsType: string;
  compression: string | null;
  blockSizeBytes: number | null;
  feasible: boolean;
  /** A *suggested* command — NOT executed automatically. */
  suggestedCommand: string | null;
  risks: string[];
  notes: string[];
}

const STANDARD_RISKS = [
  'Repacked firmware may fail vendor signature verification and refuse to boot.',
  'Incorrect block size, compression, or padding can brick the device.',
  'Always keep the original firmware and use a spare ONT only.',
  'Prepare UART serial and/or CH341A SPI recovery before flashing.',
];

export function analyzeRepackFeasibility(input: {
  partitions: DetectedPartition[];
  squashfsInfo?: SquashfsInfo | null;
  modifiedRootfsDir?: string | null;
  candidateOutputImage?: string | null;
}): RepackFeasibilityReport {
  const { partitions, squashfsInfo, modifiedRootfsDir, candidateOutputImage } = input;

  const squashPartition = partitions.find((p) => p.kind === 'squashfs');
  const detectedSquashfs = Boolean(squashPartition) || squashfsInfo?.isSquashfs === true;

  const notes: string[] = [];
  const risks = [...STANDARD_RISKS];

  let rootfsType = 'unknown';
  if (detectedSquashfs) rootfsType = 'squashfs';
  else if (partitions.some((p) => p.kind === 'jffs2')) rootfsType = 'jffs2';
  else if (partitions.some((p) => p.kind === 'cramfs')) rootfsType = 'cramfs';
  else if (partitions.some((p) => p.kind === 'rootfs')) rootfsType = 'rootfs (unidentified)';

  const compression = squashfsInfo?.compression ?? null;
  const blockSizeBytes = squashfsInfo?.blockSizeBytes ?? null;

  // We consider repack "feasible" (with caveats) only for SquashFS, since that's
  // the only filesystem this tool knows how to safely re-create with mksquashfs.
  const feasible = rootfsType === 'squashfs' && Boolean(modifiedRootfsDir);

  let suggestedCommand: string | null = null;
  if (rootfsType === 'squashfs' && modifiedRootfsDir && candidateOutputImage) {
    suggestedCommand = buildMksquashfsSuggestion(modifiedRootfsDir, candidateOutputImage, {
      compression,
      blockSizeBytes,
    });
    notes.push(
      'This command rebuilds ONLY the rootfs image. You must then reassemble it ' +
        'into the full firmware layout at the correct offset — this tool does not ' +
        'automate that step.',
    );
  }

  if (rootfsType !== 'squashfs') {
    notes.push(
      `Detected rootfs type "${rootfsType}" is not supported for assisted repack. ` +
        'Only branding of extracted assets and reporting are available.',
    );
  }
  if (!modifiedRootfsDir) {
    notes.push('No modified rootfs directory provided; nothing to repack yet.');
  }

  return {
    rootfsType,
    compression,
    blockSizeBytes,
    feasible,
    suggestedCommand,
    risks,
    notes,
  };
}
