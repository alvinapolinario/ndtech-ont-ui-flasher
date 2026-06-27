/** Thin archiver wrapper for producing export ZIP bundles. */
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

export interface ExtraFile {
  absolutePath: string;
  /** Name (path) the file should have inside the archive. */
  archiveName: string;
}

/** Zip a directory (optionally with extra files) into outputZipPath. */
export async function zipDirectory(
  sourceDir: string,
  outputZipPath: string,
  options: { internalPrefix?: string; extraFiles?: ExtraFile[] } = {},
): Promise<{ outputZipPath: string; bytes: number }> {
  await fs.mkdir(path.dirname(outputZipPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve({ outputZipPath, bytes: archive.pointer() }));
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') reject(err);
    });
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, options.internalPrefix ?? false);
    for (const extra of options.extraFiles ?? []) {
      archive.file(extra.absolutePath, { name: extra.archiveName });
    }
    void archive.finalize();
  });
}
