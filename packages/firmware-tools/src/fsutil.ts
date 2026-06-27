/** Small filesystem helpers shared by the extractor and asset scanner. */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  sizeBytes: number;
}

/** Recursively walk a directory, returning files (not directories). */
export async function walkFiles(
  root: string,
  options: { maxFiles?: number } = {},
): Promise<WalkedFile[]> {
  const { maxFiles = 50_000 } = options;
  const out: WalkedFile[] = [];

  async function recurse(dir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir (permissions / broken symlink) — skip safely
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue; // do not follow symlinks out of the workspace
      if (entry.isDirectory()) {
        await recurse(abs);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(abs);
          out.push({
            absolutePath: abs,
            relativePath: path.relative(root, abs).split(path.sep).join('/'),
            sizeBytes: stat.size,
          });
        } catch {
          /* skip unreadable file */
        }
      }
    }
  }

  await recurse(root);
  return out;
}

/** Recursively list directories under root (relative, posix-style). */
export async function walkDirs(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const abs = path.join(dir, entry.name);
        out.push(path.relative(root, abs).split(path.sep).join('/'));
        await recurse(abs);
      }
    }
  }
  await recurse(root);
  return out;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
