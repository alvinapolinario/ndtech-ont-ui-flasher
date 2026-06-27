/** Convert Prisma rows (Date objects, JSON-string columns) into shared DTOs. */
import type {
  Firmware as PrismaFirmware,
  AnalysisResult as PrismaAnalysis,
  Workspace as PrismaWorkspace,
  Asset as PrismaAsset,
  BrandingProfile as PrismaProfile,
  Patch as PrismaPatch,
  CommandLog as PrismaCommandLog,
  ExportJob as PrismaExportJob,
} from '@prisma/client';
import type {
  Firmware,
  AnalysisResult,
  Workspace,
  Asset,
  BrandingProfile,
  Patch,
  CommandLog,
  ExportJob,
  DetectedPartition,
  AnalysisStatus,
  WorkspaceStatus,
  AssetKind,
  PatchKind,
  ExportKind,
  ExportStatus,
} from '@ndtech/shared';

const iso = (d: Date): string => d.toISOString();

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function toFirmware(row: PrismaFirmware): Firmware {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.originalName,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    storagePath: row.storagePath,
    notes: row.notes,
    isMock: row.isMock,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toAnalysis(row: PrismaAnalysis): AnalysisResult {
  return {
    id: row.id,
    firmwareId: row.firmwareId,
    status: row.status as AnalysisStatus,
    binwalkOutput: row.binwalkOutput,
    fileOutput: row.fileOutput,
    partitions: safeParse<DetectedPartition[]>(row.partitions, []),
    error: row.error,
    isMock: row.isMock,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toWorkspace(row: PrismaWorkspace): Workspace {
  return {
    id: row.id,
    firmwareId: row.firmwareId,
    status: row.status as WorkspaceStatus,
    rootPath: row.rootPath,
    extractRoot: row.extractRoot,
    webRootCandidates: safeParse<string[]>(row.webRootCandidates, []),
    error: row.error,
    isMock: row.isMock,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toAsset(row: PrismaAsset): Asset {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    relativePath: row.relativePath,
    absolutePath: row.absolutePath,
    kind: row.kind as AssetKind,
    sizeBytes: row.sizeBytes,
    isWebRootCandidate: row.isWebRootCandidate,
    containsBrandText: row.containsBrandText,
    createdAt: iso(row.createdAt),
  };
}

export function toProfile(row: PrismaProfile): BrandingProfile {
  return {
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    productName: row.productName,
    supportText: row.supportText,
    website: row.website,
    footerText: row.footerText,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    loginTitle: row.loginTitle,
    dashboardTitle: row.dashboardTitle,
    logoPath: row.logoPath,
    faviconPath: row.faviconPath,
    isDefault: row.isDefault,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toPatch(row: PrismaPatch): Patch {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    brandingProfileId: row.brandingProfileId,
    assetRelativePath: row.assetRelativePath,
    kind: row.kind as PatchKind,
    oldText: row.oldText,
    newText: row.newText,
    backupPath: row.backupPath,
    description: row.description,
    createdAt: iso(row.createdAt),
  };
}

export function toCommandLog(row: PrismaCommandLog): CommandLog {
  return {
    id: row.id,
    firmwareId: row.firmwareId,
    workspaceId: row.workspaceId,
    command: row.command,
    args: safeParse<string[]>(row.args, []),
    cwd: row.cwd,
    exitCode: row.exitCode,
    stdout: row.stdout,
    stderr: row.stderr,
    durationMs: row.durationMs,
    isMock: row.isMock,
    createdAt: iso(row.createdAt),
  };
}

export function toExportJob(row: PrismaExportJob): ExportJob {
  return {
    id: row.id,
    firmwareId: row.firmwareId,
    kind: row.kind as ExportKind,
    status: row.status as ExportStatus,
    outputPath: row.outputPath,
    includeOriginalFirmware: row.includeOriginalFirmware,
    error: row.error,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
