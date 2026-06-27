/**
 * @ndtech/core
 *
 * Domain layer: Prisma client, configuration, typed errors, and the services
 * that orchestrate firmware analysis, extraction, branding, and export.
 */
export { prisma } from './db.js';
export { config, workspacePathFor, exportPathFor } from './config.js';
export * from './errors.js';
export { makeCommandLogger } from './command-logger.js';
export { zipDirectory } from './zip.js';

export * as firmwareService from './services/firmwareService.js';
export * as analysisService from './services/analysisService.js';
export * as workspaceService from './services/workspaceService.js';
export * as assetService from './services/assetService.js';
export * as brandingService from './services/brandingService.js';
export * as patchService from './services/patchService.js';
export * as repackService from './services/repackService.js';
export * as exportService from './services/exportService.js';
export * as environmentService from './services/environmentService.js';

export type { SystemStatus } from './services/environmentService.js';
export type { ApplyBrandingToWorkspaceResult } from './services/patchService.js';
export type { RepackServiceReport } from './services/repackService.js';
