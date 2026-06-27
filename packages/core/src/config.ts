/** Central runtime configuration derived from environment variables. */
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Anchor relative STORAGE_ROOT to the monorepo root (this file lives at
// packages/core/src/config.ts) rather than process.cwd(). This keeps the API
// (cwd = apps/api), the CLI, and the seed script all pointing at the SAME
// storage tree regardless of how each process was launched.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function resolveStorageRoot(): string {
  const root = process.env.STORAGE_ROOT ?? './storage';
  return path.isAbsolute(root) ? root : path.resolve(repoRoot, root);
}

const storageRoot = resolveStorageRoot();

export const config = {
  storageRoot,
  uploadsDir: path.join(storageRoot, 'uploads'),
  workspacesDir: path.join(storageRoot, 'workspaces'),
  exportsDir: path.join(storageRoot, 'exports'),
  profilesDir: path.join(storageRoot, 'profiles'),
  maxUploadBytes: Number.parseInt(process.env.MAX_UPLOAD_BYTES ?? '268435456', 10),
  allowRepackExecution: process.env.ALLOW_REPACK_EXECUTION === 'true',
  apiPort: Number.parseInt(process.env.API_PORT ?? '4000', 10),
  apiHost: process.env.API_HOST ?? '127.0.0.1',
} as const;

export function workspacePathFor(firmwareId: string): string {
  return path.join(config.workspacesDir, firmwareId);
}

export function exportPathFor(firmwareId: string): string {
  return path.join(config.exportsDir, firmwareId);
}
