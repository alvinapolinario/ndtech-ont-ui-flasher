/**
 * @ndtech/shared
 *
 * Shared TypeScript types and constants used across the API, CLI, frontend, and
 * the firmware/branding engine packages.
 *
 * SAFETY NOTE: The constants here describe *where to look* for branding assets
 * and *which visible labels* to consider replacing. They deliberately contain
 * no credentials, keys, signature offsets, or exploit data.
 */

// ---------------------------------------------------------------------------
// Enumerations (kept as string unions so they serialize cleanly to SQLite/JSON)
// ---------------------------------------------------------------------------

export const ANALYSIS_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const WORKSPACE_STATUSES = [
  'created',
  'extracting',
  'extracted',
  'failed',
] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export const EXPORT_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

export const EXPORT_KINDS = [
  'profile-json',
  'modified-assets',
  'patch-report',
  'repacked-rootfs-candidate',
  'full-workspace-zip',
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const ASSET_KINDS = [
  'html',
  'css',
  'js',
  'image',
  'favicon',
  'language',
  'other',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const PARTITION_KINDS = [
  'bootloader',
  'kernel',
  'rootfs',
  'squashfs',
  'cramfs',
  'jffs2',
  'gzip',
  'xz',
  'lzma',
  'unknown',
] as const;
export type PartitionKind = (typeof PARTITION_KINDS)[number];

export const PATCH_KINDS = ['text', 'css', 'image', 'favicon'] as const;
export type PatchKind = (typeof PATCH_KINDS)[number];

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Prisma models; dates serialized as ISO strings)
// ---------------------------------------------------------------------------

export interface Firmware {
  id: string;
  filename: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  notes: string | null;
  isMock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedPartition {
  kind: PartitionKind;
  description: string;
  offset: number;
  size: number | null;
}

export interface AnalysisResult {
  id: string;
  firmwareId: string;
  status: AnalysisStatus;
  binwalkOutput: string;
  fileOutput: string | null;
  partitions: DetectedPartition[];
  error: string | null;
  isMock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  firmwareId: string;
  status: WorkspaceStatus;
  rootPath: string;
  extractRoot: string | null;
  webRootCandidates: string[];
  error: string | null;
  isMock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  workspaceId: string;
  relativePath: string;
  absolutePath: string;
  kind: AssetKind;
  sizeBytes: number;
  isWebRootCandidate: boolean;
  containsBrandText: boolean;
  createdAt: string;
}

export interface Patch {
  id: string;
  workspaceId: string;
  brandingProfileId: string | null;
  assetRelativePath: string;
  kind: PatchKind;
  oldText: string | null;
  newText: string | null;
  backupPath: string;
  description: string;
  createdAt: string;
}

export interface CommandLog {
  id: string;
  firmwareId: string | null;
  workspaceId: string | null;
  command: string;
  args: string[];
  cwd: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  isMock: boolean;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  firmwareId: string;
  kind: ExportKind;
  status: ExportStatus;
  outputPath: string | null;
  includeOriginalFirmware: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Branding profile
// ---------------------------------------------------------------------------

export interface BrandingProfile {
  id: string;
  name: string;
  companyName: string;
  productName: string;
  supportText: string;
  website: string;
  footerText: string;
  primaryColor: string;
  secondaryColor: string;
  loginTitle: string;
  dashboardTitle: string;
  logoPath: string | null;
  faviconPath: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The subset of a branding profile that is user-editable on create/update. */
export type BrandingProfileInput = Omit<
  BrandingProfile,
  'id' | 'isDefault' | 'createdAt' | 'updatedAt'
> & {
  isDefault?: boolean;
};

/** Default NDTECH branding profile values. */
export const DEFAULT_NDTECH_PROFILE: BrandingProfileInput = {
  name: 'NDTECH Default',
  companyName: 'NDTECH I.T. Services',
  productName: 'NDTECH Fiber Gateway',
  supportText: 'For support, contact NDTECH technical support.',
  website: 'https://ndtech.com.ph',
  footerText: 'Powered by NDTECH I.T. Services',
  primaryColor: '#1e66f5',
  secondaryColor: '#16a34a',
  loginTitle: 'NDTECH Fiber Gateway',
  dashboardTitle: 'NDTECH Fiber Gateway',
  logoPath: null,
  faviconPath: null,
  isDefault: true,
};

// ---------------------------------------------------------------------------
// Firmware-analysis constants
// ---------------------------------------------------------------------------

/** External Linux tools the firmware engine knows how to use. */
export const REQUIRED_EXTERNAL_TOOLS = [
  'binwalk',
  'unsquashfs',
  'mksquashfs',
  'file',
  'strings',
  'hexdump',
  '7z',
  'gzip',
  'xz',
] as const;
export type ExternalTool = (typeof REQUIRED_EXTERNAL_TOOLS)[number];

/** Candidate directories (relative to an extracted rootfs) that hold the web UI. */
export const WEB_UI_FOLDER_CANDIDATES = [
  'www',
  'web',
  'html',
  'htdocs',
  'home/httpd',
  'var/www',
  'etc_ro/web',
] as const;

/** Filenames/patterns that indicate brandable web assets. */
export const WEB_ASSET_PATTERNS = [
  'index.html',
  'login.html',
  'main.html',
  'style.css',
  'common.css',
  'logo.png',
  'favicon.ico',
] as const;

/** Glob-ish extensions grouped by asset kind, used by the asset scanner. */
export const ASSET_EXTENSION_MAP: Record<string, AssetKind> = {
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.js': 'js',
  '.png': 'image',
  '.gif': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.svg': 'image',
  '.ico': 'favicon',
  '.xml': 'language',
  '.gch': 'language',
};

/**
 * Vendor / generic labels we consider replacing with NDTECH branding.
 *
 * SAFETY: these are *visible UI strings* only. We never touch identifiers,
 * driver names, or anything that could alter device behaviour.
 */
export const BRAND_SEARCH_TERMS = [
  'Huawei',
  'HUAWEI',
  'EchoLife',
  'GPON Terminal',
  'Home Gateway',
  'FiberHome Gateway',
  'Optical Network Terminal',
  'ONT',
] as const;

/** Default mapping from vendor term -> NDTECH replacement (used as a starting point). */
export function buildBrandReplacementMap(
  profile: Pick<BrandingProfile, 'companyName' | 'productName'>,
): Record<string, string> {
  return {
    Huawei: profile.companyName,
    HUAWEI: profile.companyName.toUpperCase(),
    EchoLife: profile.productName,
    'GPON Terminal': profile.productName,
    'Home Gateway': profile.productName,
    'FiberHome Gateway': profile.productName,
    'Optical Network Terminal': profile.productName,
  };
}

// ---------------------------------------------------------------------------
// API envelope helpers
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiResult<T> = { data: T } | ApiError;

export const SAFETY_NOTICE =
  'Analysis & asset-customization only. This tool never bypasses signatures, ' +
  'unlocks accounts, or extracts credentials. Modified firmware may brick your ' +
  'device — use a spare ONT and keep the original firmware.';
