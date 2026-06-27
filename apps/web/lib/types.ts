/** Re-export shared DTOs plus a few web-local API response shapes. */
export type {
  Firmware,
  AnalysisResult,
  DetectedPartition,
  Workspace,
  Asset,
  Patch,
  BrandingProfile,
  BrandingProfileInput,
  ExportJob,
  ExportKind,
} from '@ndtech/shared';

export interface ToolStatus {
  tool: string;
  available: boolean;
  via: 'native' | 'wsl' | 'none';
}

export interface SystemStatus {
  mockModeForced: boolean;
  liveAnalysisPossible: boolean;
  usingWslBridge: boolean;
  tools: ToolStatus[];
  missing: string[];
  safetyNotice: string;
  allowRepackExecution: boolean;
  storageRoot: string;
}

export interface ApplyBrandingResult {
  patches: import('@ndtech/shared').Patch[];
  filesChanged: number;
  warnings: string[];
}

export interface RepackReport {
  rootfsType: string;
  compression: string | null;
  blockSizeBytes: number | null;
  feasible: boolean;
  suggestedCommand: string | null;
  risks: string[];
  notes: string[];
  executionAllowed: boolean;
  squashfsImagePath: string | null;
  modifiedRootfsDir: string | null;
  candidateOutputImage: string | null;
}

export interface AssetContent {
  asset: import('@ndtech/shared').Asset;
  text: string | null;
  isBinary: boolean;
  warning: string | null;
}
