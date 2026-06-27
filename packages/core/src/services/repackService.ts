/**
 * Repack feasibility service.
 *
 * SAFETY: This never runs mksquashfs. It inspects the extracted tree, reports
 * feasibility, and produces a SUGGESTED command. Execution is gated behind
 * ALLOW_REPACK_EXECUTION and is intentionally left unimplemented for safety.
 */
import path from 'node:path';
import {
  detectSquashfs,
  walkFiles,
  walkDirs,
  type SquashfsInfo,
} from '@ndtech/firmware-tools';
import { analyzeRepackFeasibility, type RepackFeasibilityReport } from '@ndtech/branding-engine';
import { config } from '../config.js';
import { makeCommandLogger } from '../command-logger.js';
import { getWorkspace } from './workspaceService.js';
import { getLatestAnalysis } from './analysisService.js';
import type { DetectedPartition } from '@ndtech/shared';

export interface RepackServiceReport extends RepackFeasibilityReport {
  /** True only if the operator explicitly enabled repack execution. */
  executionAllowed: boolean;
  squashfsImagePath: string | null;
  modifiedRootfsDir: string | null;
  candidateOutputImage: string | null;
}

async function findSquashfsImage(extractRoot: string): Promise<string | null> {
  const files = await walkFiles(extractRoot, { maxFiles: 20000 });
  const match = files.find(
    (f) => /\.squashfs$/i.test(f.relativePath) || /squashfs/i.test(path.basename(f.relativePath)),
  );
  return match?.absolutePath ?? null;
}

async function findRootfsDir(extractRoot: string): Promise<string | null> {
  const dirs = await walkDirs(extractRoot);
  const match = dirs.find((d) => /squashfs-root$/i.test(d) || /(^|\/)rootfs$/i.test(d));
  return match ? path.join(extractRoot, match) : null;
}

export async function analyzeRepack(workspaceId: string): Promise<RepackServiceReport> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace.extractRoot) {
    return {
      rootfsType: 'unknown',
      compression: null,
      blockSizeBytes: null,
      feasible: false,
      suggestedCommand: null,
      risks: ['Workspace has not been extracted yet.'],
      notes: ['Run extraction first.'],
      executionAllowed: config.allowRepackExecution,
      squashfsImagePath: null,
      modifiedRootfsDir: null,
      candidateOutputImage: null,
    };
  }

  const analysis = await getLatestAnalysis(workspace.firmwareId);
  const partitions: DetectedPartition[] = analysis?.partitions ?? [];

  const squashfsImagePath = await findSquashfsImage(workspace.extractRoot);
  const modifiedRootfsDir = await findRootfsDir(workspace.extractRoot);
  const candidateOutputImage = path.join(workspace.rootPath, 'repacked-rootfs-candidate.squashfs');

  let squashfsInfo: SquashfsInfo | null = null;
  if (squashfsImagePath) {
    const logger = makeCommandLogger({ firmwareId: workspace.firmwareId, workspaceId });
    squashfsInfo = await detectSquashfs(squashfsImagePath, { logger });
  }

  const report = analyzeRepackFeasibility({
    partitions,
    squashfsInfo,
    modifiedRootfsDir,
    candidateOutputImage,
  });

  return {
    ...report,
    executionAllowed: config.allowRepackExecution,
    squashfsImagePath,
    modifiedRootfsDir,
    candidateOutputImage,
  };
}
