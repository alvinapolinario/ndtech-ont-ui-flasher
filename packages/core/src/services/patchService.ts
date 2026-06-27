/**
 * Patch service: apply a branding profile to a workspace's extracted web assets
 * and record every change. Backups are created by the branding engine.
 */
import { applyBranding, restoreBackups, generatePatchReportHtml } from '@ndtech/branding-engine';
import { prisma } from '../db.js';
import { ValidationError } from '../errors.js';
import { toPatch } from '../mappers.js';
import { getWorkspace, resolveWebRoot, rescanWorkspaceAssets } from './workspaceService.js';
import { getProfile } from './brandingService.js';
import { getFirmware } from './firmwareService.js';
import type { Patch } from '@ndtech/shared';

export interface ApplyBrandingToWorkspaceResult {
  patches: Patch[];
  filesChanged: number;
  warnings: string[];
}

export async function applyBrandingToWorkspace(
  workspaceId: string,
  profileId: string,
  options: { logoSourcePath?: string | null; faviconSourcePath?: string | null } = {},
): Promise<ApplyBrandingToWorkspaceResult> {
  const workspace = await getWorkspace(workspaceId);
  if (workspace.status !== 'extracted') {
    throw new ValidationError('Workspace is not extracted yet; cannot apply branding.');
  }
  const profile = await getProfile(profileId);
  const webRoot = await resolveWebRoot(workspaceId);
  if (!webRoot) {
    throw new ValidationError('No web root detected for this workspace.');
  }

  const result = await applyBranding({
    webRoot,
    profile,
    logoSourcePath: options.logoSourcePath ?? profile.logoPath,
    faviconSourcePath: options.faviconSourcePath ?? profile.faviconPath,
  });

  // Replace prior patch records for this workspace to reflect the latest run.
  await prisma.patch.deleteMany({ where: { workspaceId } });
  if (result.patches.length > 0) {
    await prisma.patch.createMany({
      data: result.patches.map((p) => ({
        workspaceId,
        brandingProfileId: profileId,
        assetRelativePath: p.assetRelativePath,
        kind: p.kind,
        oldText: p.oldText,
        newText: p.newText,
        backupPath: p.backupPath,
        description: p.description,
      })),
    });
  }

  // Refresh asset flags (containsBrandText may now be false after replacement).
  await rescanWorkspaceAssets(workspaceId);

  const rows = await prisma.patch.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  return {
    patches: rows.map(toPatch),
    filesChanged: result.filesChanged,
    warnings: result.warnings,
  };
}

export async function listPatches(workspaceId: string): Promise<Patch[]> {
  await getWorkspace(workspaceId);
  const rows = await prisma.patch.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toPatch);
}

/** Restore every modified file in the workspace from its backup copy. */
export async function revertWorkspace(workspaceId: string): Promise<string[]> {
  const webRoot = await resolveWebRoot(workspaceId);
  if (!webRoot) throw new ValidationError('No web root detected for this workspace.');
  const restored = await restoreBackups(webRoot);
  await prisma.patch.deleteMany({ where: { workspaceId } });
  await rescanWorkspaceAssets(workspaceId);
  return restored;
}

/** Build the self-contained HTML patch report for a workspace. */
export async function generateReportHtml(workspaceId: string): Promise<string> {
  const workspace = await getWorkspace(workspaceId);
  const firmware = await getFirmware(workspace.firmwareId);
  const patchRows = await prisma.patch.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });

  let profile = null;
  const firstWithProfile = patchRows.find((p) => p.brandingProfileId);
  if (firstWithProfile?.brandingProfileId) {
    profile = await getProfile(firstWithProfile.brandingProfileId).catch(() => null);
  }

  return generatePatchReportHtml({
    firmware: {
      originalName: firmware.originalName,
      sha256: firmware.sha256,
      sizeBytes: firmware.sizeBytes,
    },
    profile: profile
      ? { name: profile.name, companyName: profile.companyName, productName: profile.productName }
      : null,
    patches: patchRows.map((p) => ({
      assetRelativePath: p.assetRelativePath,
      kind: p.kind as Patch['kind'],
      oldText: p.oldText,
      newText: p.newText,
      description: p.description,
    })),
  });
}
