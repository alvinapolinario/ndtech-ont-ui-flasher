/**
 * Web-asset scanner.
 *
 * Walks an extracted rootfs (or a specific web-root candidate) and classifies
 * files that are relevant to Level-2 branding. Read-only: it never modifies the
 * files it inspects.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ASSET_EXTENSION_MAP,
  BRAND_SEARCH_TERMS,
  WEB_UI_FOLDER_CANDIDATES,
  type AssetKind,
} from '@ndtech/shared';
import { walkFiles } from './fsutil.js';

export interface DetectedAsset {
  relativePath: string;
  absolutePath: string;
  kind: AssetKind;
  sizeBytes: number;
  isWebRootCandidate: boolean;
  containsBrandText: boolean;
}

const TEXT_KINDS: AssetKind[] = ['html', 'css', 'js', 'language'];
const MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024; // don't read huge files into memory

export function classifyAssetKind(filePath: string): AssetKind {
  const ext = path.extname(filePath).toLowerCase();
  return ASSET_EXTENSION_MAP[ext] ?? 'other';
}

function isUnderWebRoot(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return WEB_UI_FOLDER_CANDIDATES.some(
    (c) => lower.includes(`/${c}/`) || lower.startsWith(`${c}/`),
  );
}

async function fileContainsBrandText(absolutePath: string, sizeBytes: number): Promise<boolean> {
  if (sizeBytes > MAX_TEXT_SCAN_BYTES) return false;
  try {
    const content = await fs.readFile(absolutePath, 'utf8');
    return BRAND_SEARCH_TERMS.some((term) => content.includes(term));
  } catch {
    return false;
  }
}

/**
 * Scan a directory tree for brandable assets. `root` is typically the extraction
 * root; pass a web-root candidate to scope the scan.
 */
export async function scanAssets(root: string): Promise<DetectedAsset[]> {
  const files = await walkFiles(root);
  const assets: DetectedAsset[] = [];

  for (const file of files) {
    const kind = classifyAssetKind(file.absolutePath);
    // Skip clearly irrelevant binaries to keep the asset list focused.
    if (kind === 'other' && !file.relativePath.toLowerCase().includes('logo')) {
      continue;
    }

    const isWebRootCandidate = isUnderWebRoot(file.relativePath);
    const containsBrandText = TEXT_KINDS.includes(kind)
      ? await fileContainsBrandText(file.absolutePath, file.sizeBytes)
      : false;

    assets.push({
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      kind,
      sizeBytes: file.sizeBytes,
      isWebRootCandidate,
      containsBrandText,
    });
  }

  return assets;
}
