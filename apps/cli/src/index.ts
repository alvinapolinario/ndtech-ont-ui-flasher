#!/usr/bin/env -S npx tsx
import 'dotenv/config';
import path from 'node:path';
import {
  firmwareService,
  analysisService,
  workspaceService,
  assetService,
  patchService,
  brandingService,
  exportService,
  prisma,
} from '@ndtech/core';
import { loadProfileFromFile } from '@ndtech/branding-engine';
import { SAFETY_NOTICE, type ExportKind } from '@ndtech/shared';
import { parseArgs } from './args.js';

const USAGE = `
NDTECH Huawei ONT Web UI Customizer — CLI (ndtech-ont)

Usage:
  ndtech-ont analyze <firmware.bin>                      Register + binwalk analysis
  ndtech-ont extract <firmware-id>                       Create workspace + extract
  ndtech-ont scan-assets <firmware-id>                   List detected web assets
  ndtech-ont apply-branding <firmware-id> --profile f    Apply branding profile JSON
  ndtech-ont report <firmware-id>                        Generate HTML patch report
  ndtech-ont export <firmware-id> [--kind <kind>]        Export bundle (default: full-workspace-zip)
                                  [--include-original]   Include original firmware in workspace ZIP

Safety: ${SAFETY_NOTICE}
`;

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function latestWorkspaceOrFail(firmwareId: string) {
  const ws = await workspaceService.getLatestWorkspace(firmwareId);
  if (!ws) fail('No workspace found. Run `extract <firmware-id>` first.');
  return ws;
}

async function cmdAnalyze(file?: string): Promise<void> {
  if (!file) fail('Provide a firmware file path: analyze <firmware.bin>');
  const storagePath = path.resolve(file);
  console.log(`Registering ${storagePath} …`);
  const firmware = await firmwareService.registerFirmware({
    storagePath,
    originalName: path.basename(storagePath),
  });
  console.log(`  id:     ${firmware.id}`);
  console.log(`  sha256: ${firmware.sha256}`);
  console.log(`  size:   ${firmware.sizeBytes} bytes`);

  console.log('Running binwalk analysis …');
  const analysis = await analysisService.runAnalysis(firmware.id);
  console.log(`  status: ${analysis.status}${analysis.isMock ? ' (mock)' : ''}`);
  console.log(`  partitions:`);
  for (const p of analysis.partitions) {
    console.log(`    0x${p.offset.toString(16).padStart(8, '0')}  ${p.kind.padEnd(11)} ${p.description}`);
  }
}

async function cmdExtract(firmwareId?: string): Promise<void> {
  if (!firmwareId) fail('Provide a firmware id: extract <firmware-id>');
  console.log(`Extracting firmware ${firmwareId} …`);
  const ws = await workspaceService.createWorkspace(firmwareId);
  console.log(`  workspace: ${ws.id} (${ws.status}${ws.isMock ? ', mock' : ''})`);
  console.log(`  extractRoot: ${ws.extractRoot}`);
  console.log(`  web-root candidates:`);
  ws.webRootCandidates.forEach((c) => console.log(`    ${c}`));
  if (ws.error) console.log(`  error: ${ws.error}`);
}

async function cmdScanAssets(firmwareId?: string): Promise<void> {
  if (!firmwareId) fail('Provide a firmware id: scan-assets <firmware-id>');
  const ws = await latestWorkspaceOrFail(firmwareId);
  const assets = await assetService.listAssets(ws.id);
  console.log(`Detected ${assets.length} assets in workspace ${ws.id}:`);
  for (const a of assets) {
    const flags = [a.isWebRootCandidate ? 'web' : '', a.containsBrandText ? 'brand' : '']
      .filter(Boolean)
      .join(',');
    console.log(`  [${a.kind.padEnd(8)}] ${a.relativePath}${flags ? `  (${flags})` : ''}`);
  }
}

async function cmdApplyBranding(firmwareId?: string, profilePath?: string): Promise<void> {
  if (!firmwareId) fail('Provide a firmware id: apply-branding <firmware-id> --profile <file>');
  const ws = await latestWorkspaceOrFail(firmwareId);

  let profileId: string;
  if (profilePath) {
    const input = await loadProfileFromFile(path.resolve(profilePath));
    const existing = (await brandingService.listProfiles()).find((p) => p.name === input.name);
    const profile = existing ?? (await brandingService.createProfile(input));
    profileId = profile.id;
    console.log(`Using profile "${profile.name}" (${profileId}).`);
  } else {
    const def = await brandingService.getDefaultProfile();
    if (!def) fail('No --profile given and no default profile exists. Seed the DB or pass --profile.');
    profileId = def.id;
    console.log(`Using default profile "${def.name}" (${profileId}).`);
  }

  const result = await patchService.applyBrandingToWorkspace(ws.id, profileId);
  console.log(`Applied branding: ${result.filesChanged} file(s) changed, ${result.patches.length} patch record(s).`);
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  for (const p of result.patches) {
    console.log(`  [${p.kind}] ${p.assetRelativePath} — ${p.description}`);
  }
}

async function cmdReport(firmwareId?: string): Promise<void> {
  if (!firmwareId) fail('Provide a firmware id: report <firmware-id>');
  const job = await exportService.createExport(firmwareId, 'patch-report');
  if (job.status === 'failed') fail(job.error ?? 'Report generation failed.');
  console.log(`Patch report written to: ${job.outputPath}`);
}

async function cmdExport(firmwareId: string | undefined, kind: ExportKind, includeOriginal: boolean): Promise<void> {
  if (!firmwareId) fail('Provide a firmware id: export <firmware-id> [--kind <kind>]');
  console.log(`Exporting "${kind}" for firmware ${firmwareId} …`);
  const job = await exportService.createExport(firmwareId, kind, {
    includeOriginalFirmware: includeOriginal,
  });
  if (job.status === 'failed') fail(job.error ?? 'Export failed.');
  console.log(`  status: ${job.status}`);
  console.log(`  output: ${job.outputPath}`);
}

async function main(): Promise<void> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'analyze':
      await cmdAnalyze(positionals[0]);
      break;
    case 'extract':
      await cmdExtract(positionals[0]);
      break;
    case 'scan-assets':
      await cmdScanAssets(positionals[0]);
      break;
    case 'apply-branding':
      await cmdApplyBranding(positionals[0], typeof flags.profile === 'string' ? flags.profile : undefined);
      break;
    case 'report':
      await cmdReport(positionals[0]);
      break;
    case 'export': {
      const kind = (typeof flags.kind === 'string' ? flags.kind : 'full-workspace-zip') as ExportKind;
      await cmdExport(positionals[0], kind, flags['include-original'] === true);
      break;
    }
    case 'help':
    case undefined:
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown command "${command}".`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
