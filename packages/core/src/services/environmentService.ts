/** Exposes external-tool availability + safety configuration to the UI/CLI. */
import { checkExternalTools, type EnvironmentReport } from '@ndtech/firmware-tools';
import { SAFETY_NOTICE } from '@ndtech/shared';
import { config } from '../config.js';

export interface SystemStatus extends EnvironmentReport {
  safetyNotice: string;
  allowRepackExecution: boolean;
  storageRoot: string;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const env = await checkExternalTools();
  return {
    ...env,
    safetyNotice: SAFETY_NOTICE,
    allowRepackExecution: config.allowRepackExecution,
    storageRoot: config.storageRoot,
  };
}
