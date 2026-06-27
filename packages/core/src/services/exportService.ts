/**
 * Export service.
 *
 * SAFETY: The full-workspace export EXCLUDES the original firmware image unless
 * the caller explicitly opts in. The original upload is never moved or deleted.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { saveProfileToFile } from '@ndtech/branding-engine';
import { prisma } from '../db.js';
import { exportPathFor } from '../config.js';
import { ValidationError } from '../errors.js';
import { toExportJob } from '../mappers.js';
import { zipDirectory } from '../zip.js';
import { getFirmware } from './firmwareService.js';
import { getLatestWorkspace, resolveWebRoot } from './workspaceService.js';
import { getDefaultProfile } from './brandingService.js';
import { generateReportHtml } from './patchService.js';
import { analyzeRepack } from './repackService.js';
import type { ExportJob, ExportKind } from '@ndtech/shared';
import { EXPORT_KINDS } from '@ndtech/shared';

export interface CreateExportOptions {
  includeOriginalFirmware?: boolean;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function createExport(
  firmwareId: string,
  kind: ExportKind,
  options: CreateExportOptions = {},
): Promise<ExportJob> {
  if (!EXPORT_KINDS.includes(kind)) {
    throw new ValidationError(`Unknown export kind "${kind}".`);
  }
  const firmware = await getFirmware(firmwareId);
  const includeOriginalFirmware = options.includeOriginalFirmware ?? false;

  const job = await prisma.exportJob.create({
    data: { firmwareId, kind, status: 'running', includeOriginalFirmware },
  });

  const exportDir = exportPathFor(firmwareId);
  await fs.mkdir(exportDir, { recursive: true });

  try {
    const outputPath = await runExport(firmwareId, kind, exportDir, includeOriginalFirmware);
    const updated = await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: 'completed', outputPath },
    });
    return toExportJob(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: message },
    });
    return toExportJob(failed);
  }
}

async function runExport(
  firmwareId: string,
  kind: ExportKind,
  exportDir: string,
  includeOriginalFirmware: boolean,
): Promise<string> {
  switch (kind) {
    case 'profile-json': {
      const profile = await getDefaultProfile();
      if (!profile) throw new ValidationError('No default branding profile to export.');
      const out = path.join(exportDir, `branding-${profile.name.replace(/\W+/g, '_')}.json`);
      await saveProfileToFile(profile, out);
      return out;
    }

    case 'patch-report': {
      const workspace = await getLatestWorkspace(firmwareId);
      if (!workspace) throw new ValidationError('No workspace found to report on.');
      const html = await generateReportHtml(workspace.id);
      const out = path.join(exportDir, `patch-report-${timestamp()}.html`);
      await fs.writeFile(out, html, 'utf8');
      return out;
    }

    case 'modified-assets': {
      const workspace = await getLatestWorkspace(firmwareId);
      if (!workspace) throw new ValidationError('No workspace found.');
      const webRoot = await resolveWebRoot(workspace.id);
      if (!webRoot) throw new ValidationError('No web root detected to export.');
      const out = path.join(exportDir, `modified-assets-${timestamp()}.zip`);
      await zipDirectory(webRoot, out, { internalPrefix: 'web' });
      return out;
    }

    case 'repacked-rootfs-candidate': {
      const workspace = await getLatestWorkspace(firmwareId);
      if (!workspace) throw new ValidationError('No workspace found.');
      const report = await analyzeRepack(workspace.id);
      if (!report.modifiedRootfsDir) {
        throw new ValidationError(
          'No SquashFS rootfs directory detected; a repack candidate cannot be produced.',
        );
      }
      // We bundle the modified rootfs tree + the suggested mksquashfs command.
      // We do NOT run mksquashfs — repacking remains a manual, explicit step.
      const out = path.join(exportDir, `repacked-rootfs-candidate-${timestamp()}.zip`);
      const instructions = [
        'NDTECH repacked-rootfs CANDIDATE (NOT a finished firmware image).',
        '',
        `Detected rootfs type : ${report.rootfsType}`,
        `Compression          : ${report.compression ?? 'unknown'}`,
        `Block size           : ${report.blockSizeBytes ?? 'unknown'}`,
        '',
        'Suggested (NOT executed) repack command:',
        report.suggestedCommand ?? '(none — repack not feasible)',
        '',
        'WARNING: Repacking and flashing can brick your device. See FLASHING-WARNING.md.',
      ].join('\n');
      const instrPath = path.join(exportDir, `REPACK-INSTRUCTIONS-${timestamp()}.txt`);
      await fs.writeFile(instrPath, instructions, 'utf8');
      await zipDirectory(report.modifiedRootfsDir, out, {
        internalPrefix: 'rootfs',
        extraFiles: [{ absolutePath: instrPath, archiveName: 'REPACK-INSTRUCTIONS.txt' }],
      });
      return out;
    }

    case 'full-workspace-zip': {
      const workspace = await getLatestWorkspace(firmwareId);
      if (!workspace) throw new ValidationError('No workspace found.');
      const out = path.join(exportDir, `workspace-${timestamp()}.zip`);
      const firmware = await getFirmware(firmwareId);
      // The original firmware lives in /uploads (outside the workspace), so it is
      // naturally excluded. Only include it if explicitly requested.
      const extraFiles = includeOriginalFirmware
        ? [{ absolutePath: firmware.storagePath, archiveName: `original/${firmware.originalName}` }]
        : [];
      await zipDirectory(workspace.rootPath, out, { internalPrefix: 'workspace', extraFiles });
      return out;
    }

    default:
      throw new ValidationError(`Unsupported export kind "${kind}".`);
  }
}

export async function listExports(firmwareId: string): Promise<ExportJob[]> {
  const rows = await prisma.exportJob.findMany({
    where: { firmwareId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toExportJob);
}
