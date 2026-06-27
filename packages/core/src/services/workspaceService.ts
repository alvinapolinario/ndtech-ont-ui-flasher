/**
 * Extraction workspace service.
 *
 * SAFETY: Extraction writes only into <storage>/workspaces/<firmwareId>/. The
 * original firmware is read but never altered. Every command is logged.
 */
import { extractFirmware, scanAssets, ensureDir } from '@ndtech/firmware-tools';
import { prisma } from '../db.js';
import { workspacePathFor } from '../config.js';
import { NotFoundError } from '../errors.js';
import { toWorkspace, toAsset } from '../mappers.js';
import { makeCommandLogger } from '../command-logger.js';
import { getFirmware } from './firmwareService.js';
import type { Workspace, Asset } from '@ndtech/shared';

/** Create (or reuse) a workspace and extract the firmware into it. */
export async function createWorkspace(firmwareId: string): Promise<Workspace> {
  const firmware = await getFirmware(firmwareId);
  const rootPath = workspacePathFor(firmwareId);
  await ensureDir(rootPath);

  const workspace = await prisma.workspace.create({
    data: { firmwareId, status: 'extracting', rootPath },
  });

  const logger = makeCommandLogger({ firmwareId, workspaceId: workspace.id });

  try {
    const extraction = await extractFirmware(firmware.storagePath, rootPath, { logger });

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        status: 'extracted',
        extractRoot: extraction.extractRoot,
        webRootCandidates: JSON.stringify(extraction.webRootCandidates),
        isMock: extraction.isMock,
        error: null,
      },
    });

    // Scan and persist assets immediately so the UI has data to show.
    await rescanWorkspaceAssets(updated.id, extraction.extractRoot);

    return toWorkspace(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { status: 'failed', error: message },
    });
    return toWorkspace(failed);
  }
}

/** (Re)scan the extracted tree and replace the workspace's asset rows. */
export async function rescanWorkspaceAssets(
  workspaceId: string,
  extractRoot?: string,
): Promise<Asset[]> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new NotFoundError('Workspace', workspaceId);

  const root = extractRoot ?? ws.extractRoot;
  if (!root) return [];

  const detected = await scanAssets(root);

  await prisma.asset.deleteMany({ where: { workspaceId } });
  if (detected.length > 0) {
    await prisma.asset.createMany({
      data: detected.map((a) => ({
        workspaceId,
        relativePath: a.relativePath,
        absolutePath: a.absolutePath,
        kind: a.kind,
        sizeBytes: a.sizeBytes,
        isWebRootCandidate: a.isWebRootCandidate,
        containsBrandText: a.containsBrandText,
      })),
    });
  }

  const rows = await prisma.asset.findMany({
    where: { workspaceId },
    orderBy: [{ isWebRootCandidate: 'desc' }, { relativePath: 'asc' }],
  });
  return rows.map(toAsset);
}

export async function getWorkspace(id: string): Promise<Workspace> {
  const row = await prisma.workspace.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Workspace', id);
  return toWorkspace(row);
}

export async function getLatestWorkspace(firmwareId: string): Promise<Workspace | null> {
  const row = await prisma.workspace.findFirst({
    where: { firmwareId },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toWorkspace(row) : null;
}

export async function listWorkspaces(firmwareId: string): Promise<Workspace[]> {
  const rows = await prisma.workspace.findMany({
    where: { firmwareId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toWorkspace);
}

/** Resolve the primary web root for a workspace (first candidate, or extractRoot). */
export async function resolveWebRoot(workspaceId: string): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new NotFoundError('Workspace', workspaceId);
  const candidates = JSON.parse(ws.webRootCandidates || '[]') as string[];
  return candidates[0] ?? ws.extractRoot ?? null;
}
