/** Asset listing + safe content reading for the preview feature. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../db.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { toAsset } from '../mappers.js';
import { getWorkspace } from './workspaceService.js';
import type { Asset } from '@ndtech/shared';

const PREVIEWABLE_TEXT = new Set(['html', 'css', 'js', 'language']);
const MAX_PREVIEW_BYTES = 1024 * 1024;

export async function listAssets(workspaceId: string): Promise<Asset[]> {
  await getWorkspace(workspaceId); // ensures existence / throws NotFound
  const rows = await prisma.asset.findMany({
    where: { workspaceId },
    orderBy: [{ isWebRootCandidate: 'desc' }, { relativePath: 'asc' }],
  });
  return rows.map(toAsset);
}

export async function getAsset(id: string): Promise<Asset> {
  const row = await prisma.asset.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Asset', id);
  return toAsset(row);
}

export interface AssetContent {
  asset: Asset;
  /** Text content if previewable; null for binary assets. */
  text: string | null;
  /** True when the asset is binary (image/favicon/etc.) and not returned as text. */
  isBinary: boolean;
  /** Reason a preview is unavailable, if any. */
  warning: string | null;
}

/**
 * Read an asset's content for preview. Confines reads to the workspace tree as a
 * defence-in-depth measure against path traversal.
 */
export async function readAssetContent(id: string): Promise<AssetContent> {
  const asset = await getAsset(id);
  const workspace = await getWorkspace(asset.workspaceId);

  const resolved = path.resolve(asset.absolutePath);
  const wsRoot = path.resolve(workspace.rootPath);
  if (!resolved.startsWith(wsRoot)) {
    throw new ValidationError('Asset path escapes its workspace; refusing to read.');
  }

  if (!PREVIEWABLE_TEXT.has(asset.kind)) {
    return { asset, text: null, isBinary: true, warning: 'Binary asset — preview not rendered as text.' };
  }

  try {
    const stat = await fs.stat(resolved);
    if (stat.size > MAX_PREVIEW_BYTES) {
      return { asset, text: null, isBinary: false, warning: 'Asset too large to preview.' };
    }
    const text = await fs.readFile(resolved, 'utf8');
    return { asset, text, isBinary: false, warning: null };
  } catch {
    return { asset, text: null, isBinary: false, warning: 'Asset could not be read from disk.' };
  }
}

/** Read raw bytes of an asset (used to serve images in the preview). */
export async function readAssetBytes(id: string): Promise<{ asset: Asset; bytes: Buffer }> {
  const asset = await getAsset(id);
  const workspace = await getWorkspace(asset.workspaceId);
  const resolved = path.resolve(asset.absolutePath);
  const wsRoot = path.resolve(workspace.rootPath);
  if (!resolved.startsWith(wsRoot)) {
    throw new ValidationError('Asset path escapes its workspace; refusing to read.');
  }
  const bytes = await fs.readFile(resolved);
  return { asset, bytes };
}
