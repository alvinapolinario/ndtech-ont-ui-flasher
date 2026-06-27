/**
 * Safe asset replacement engine.
 *
 * SAFETY GUARANTEES:
 *  - Before any file is modified, a `<file>.ndtech-backup` copy is created
 *    (only once; existing backups are never overwritten).
 *  - Only VISIBLE web-UI assets are touched: HTML/CSS/JS text, logo, favicon.
 *  - Images are replaced only when the source format matches the target format.
 *  - The function returns a structured patch list for the report; it never
 *    repacks or flashes anything.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  buildBrandReplacementMap,
  type BrandingProfile,
  type PatchKind,
} from '@ndtech/shared';
import { scanAssets, type DetectedAsset } from '@ndtech/firmware-tools';

export const BACKUP_SUFFIX = '.ndtech-backup';

export interface PatchRecord {
  assetRelativePath: string;
  kind: PatchKind;
  oldText: string | null;
  newText: string | null;
  backupPath: string;
  description: string;
}

export interface ApplyBrandingOptions {
  webRoot: string;
  profile: BrandingProfile;
  /** Optional override of the vendor-term -> replacement map. */
  replacementMap?: Record<string, string>;
  /** Source image to copy over an existing logo (must match target extension). */
  logoSourcePath?: string | null;
  /** Source icon to copy over an existing favicon. */
  faviconSourcePath?: string | null;
}

export interface ApplyBrandingResult {
  patches: PatchRecord[];
  filesChanged: number;
  warnings: string[];
}

/** Create a one-time backup of a file. Returns the backup path. */
async function backupOnce(absolutePath: string): Promise<string> {
  const backupPath = absolutePath + BACKUP_SUFFIX;
  try {
    await fs.access(backupPath);
    // Backup already exists — preserve the very first original.
  } catch {
    await fs.copyFile(absolutePath, backupPath);
  }
  return backupPath;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/** Replace CSS custom-property color values with the profile's colors. */
function applyCssColors(
  content: string,
  profile: BrandingProfile,
): { content: string; changed: boolean } {
  let changed = false;
  let next = content.replace(
    /(--primary-color\s*:\s*)([^;]+)(;)/gi,
    (_m, p1: string, _val: string, p3: string) => {
      changed = true;
      return `${p1}${profile.primaryColor}${p3}`;
    },
  );
  next = next.replace(
    /(--secondary-color\s*:\s*)([^;]+)(;)/gi,
    (_m, p1: string, _val: string, p3: string) => {
      changed = true;
      return `${p1}${profile.secondaryColor}${p3}`;
    },
  );
  return { content: next, changed };
}

/** Replace the inner text of <title> and <footer> with profile values. */
function applyHtmlLabels(
  content: string,
  fileName: string,
  profile: BrandingProfile,
): { content: string; patches: Omit<PatchRecord, 'backupPath' | 'assetRelativePath'>[] } {
  const patches: Omit<PatchRecord, 'backupPath' | 'assetRelativePath'>[] = [];
  let next = content;

  const isLogin = /login/i.test(fileName);
  const newTitle = isLogin ? profile.loginTitle : profile.dashboardTitle;

  next = next.replace(/<title>([\s\S]*?)<\/title>/i, (_m, inner: string) => {
    if (inner.trim() !== newTitle) {
      patches.push({
        kind: 'text',
        oldText: inner.trim(),
        newText: newTitle,
        description: `Set <title> to "${newTitle}"`,
      });
    }
    return `<title>${newTitle}</title>`;
  });

  next = next.replace(/<footer([^>]*)>([\s\S]*?)<\/footer>/i, (_m, attrs: string, inner: string) => {
    if (inner.trim() !== profile.footerText) {
      patches.push({
        kind: 'text',
        oldText: inner.trim(),
        newText: profile.footerText,
        description: 'Replaced footer text',
      });
    }
    return `<footer${attrs}>${profile.footerText}</footer>`;
  });

  return { content: next, patches };
}

/** Apply vendor-term -> NDTECH replacements to a text blob. */
function applyTermReplacements(
  content: string,
  map: Record<string, string>,
): { content: string; patches: Omit<PatchRecord, 'backupPath' | 'assetRelativePath'>[] } {
  const patches: Omit<PatchRecord, 'backupPath' | 'assetRelativePath'>[] = [];
  let next = content;
  for (const [term, replacement] of Object.entries(map)) {
    if (!term || term === replacement) continue;
    const count = countOccurrences(next, term);
    if (count === 0) continue;
    next = next.replace(new RegExp(escapeRegExp(term), 'g'), replacement);
    patches.push({
      kind: 'text',
      oldText: term,
      newText: replacement,
      description: `Replaced ${count} occurrence(s) of "${term}"`,
    });
  }
  return { content: next, patches };
}

async function replaceImage(
  asset: DetectedAsset,
  sourcePath: string,
  kind: PatchKind,
  warnings: string[],
): Promise<PatchRecord | null> {
  const targetExt = path.extname(asset.absolutePath).toLowerCase();
  const sourceExt = path.extname(sourcePath).toLowerCase();
  if (targetExt !== sourceExt) {
    warnings.push(
      `Skipped ${asset.relativePath}: source format "${sourceExt}" does not match target "${targetExt}". ` +
        'Format conversion is intentionally not performed.',
    );
    return null;
  }
  const backupPath = await backupOnce(asset.absolutePath);
  await fs.copyFile(sourcePath, asset.absolutePath);
  return {
    assetRelativePath: asset.relativePath,
    kind,
    oldText: null,
    newText: null,
    backupPath,
    description: `Replaced ${kind} "${asset.relativePath}" with ${path.basename(sourcePath)}`,
  };
}

/**
 * Apply a branding profile to the extracted web assets under `webRoot`.
 */
export async function applyBranding(options: ApplyBrandingOptions): Promise<ApplyBrandingResult> {
  const { webRoot, profile } = options;
  const replacementMap =
    options.replacementMap ?? buildBrandReplacementMap(profile);

  const assets = await scanAssets(webRoot);
  const patches: PatchRecord[] = [];
  const warnings: string[] = [];
  const changedFiles = new Set<string>();

  for (const asset of assets) {
    if (asset.kind === 'html' || asset.kind === 'css' || asset.kind === 'js' || asset.kind === 'language') {
      let content: string;
      try {
        content = await fs.readFile(asset.absolutePath, 'utf8');
      } catch {
        warnings.push(`Could not read text asset ${asset.relativePath}; skipped.`);
        continue;
      }

      const original = content;
      const filePatches: Omit<PatchRecord, 'backupPath' | 'assetRelativePath'>[] = [];

      const term = applyTermReplacements(content, replacementMap);
      content = term.content;
      filePatches.push(...term.patches);

      if (asset.kind === 'html') {
        const labels = applyHtmlLabels(content, asset.relativePath, profile);
        content = labels.content;
        filePatches.push(...labels.patches);
      }

      if (asset.kind === 'css') {
        const css = applyCssColors(content, profile);
        if (css.changed) {
          content = css.content;
          filePatches.push({
            kind: 'css',
            oldText: 'CSS color variables',
            newText: `${profile.primaryColor} / ${profile.secondaryColor}`,
            description: 'Updated --primary-color / --secondary-color',
          });
        }
      }

      if (content !== original) {
        const backupPath = await backupOnce(asset.absolutePath);
        await fs.writeFile(asset.absolutePath, content, 'utf8');
        changedFiles.add(asset.relativePath);
        for (const p of filePatches) {
          patches.push({ ...p, assetRelativePath: asset.relativePath, backupPath });
        }
      }
    }
  }

  // Logo replacement (only if a source is supplied and a logo target exists).
  if (options.logoSourcePath) {
    const logoAsset = assets.find(
      (a) => a.kind === 'image' && /logo/i.test(path.basename(a.relativePath)),
    );
    if (logoAsset) {
      const patch = await replaceImage(logoAsset, options.logoSourcePath, 'image', warnings);
      if (patch) {
        patches.push(patch);
        changedFiles.add(logoAsset.relativePath);
      }
    } else {
      warnings.push('No logo image found under the web root; logo not replaced.');
    }
  }

  // Favicon replacement.
  if (options.faviconSourcePath) {
    const faviconAsset = assets.find((a) => a.kind === 'favicon');
    if (faviconAsset) {
      const patch = await replaceImage(faviconAsset, options.faviconSourcePath, 'favicon', warnings);
      if (patch) {
        patches.push(patch);
        changedFiles.add(faviconAsset.relativePath);
      }
    } else {
      warnings.push('No favicon found under the web root; favicon not replaced.');
    }
  }

  return { patches, filesChanged: changedFiles.size, warnings };
}

/** Restore every file that has an `.ndtech-backup` sibling under `webRoot`. */
export async function restoreBackups(webRoot: string): Promise<string[]> {
  const assets = await scanAssets(webRoot);
  const restored: string[] = [];
  // scanAssets ignores backup files (unknown kind); walk the originals instead.
  for (const asset of assets) {
    const backupPath = asset.absolutePath + BACKUP_SUFFIX;
    try {
      await fs.access(backupPath);
      await fs.copyFile(backupPath, asset.absolutePath);
      restored.push(asset.relativePath);
    } catch {
      /* no backup for this file */
    }
  }
  return restored;
}
