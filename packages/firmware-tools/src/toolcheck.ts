/**
 * Detect which expected external tools are installed so the UI/CLI can warn the
 * user and decide whether to fall back to mock mode.
 */
import { REQUIRED_EXTERNAL_TOOLS, type ExternalTool } from '@ndtech/shared';
import { resolveToolRuntime, isMockModeForced, type ToolRuntime } from './exec.js';

export interface ToolStatus {
  tool: ExternalTool;
  available: boolean;
  /** How the tool will run: natively, via the WSL bridge, or not at all. */
  via: ToolRuntime;
}

export interface EnvironmentReport {
  mockModeForced: boolean;
  /** True if binwalk is available (native or via WSL) and mock mode isn't forced. */
  liveAnalysisPossible: boolean;
  /** True if any tool resolves through the WSL bridge. */
  usingWslBridge: boolean;
  tools: ToolStatus[];
  missing: ExternalTool[];
}

export async function checkExternalTools(): Promise<EnvironmentReport> {
  const tools: ToolStatus[] = await Promise.all(
    REQUIRED_EXTERNAL_TOOLS.map(async (tool) => {
      const via = await resolveToolRuntime(tool);
      return { tool, available: via !== 'none', via };
    }),
  );

  const missing = tools.filter((t) => !t.available).map((t) => t.tool);
  const binwalk = tools.find((t) => t.tool === 'binwalk');
  const mockModeForced = isMockModeForced();

  return {
    mockModeForced,
    liveAnalysisPossible: Boolean(binwalk?.available) && !mockModeForced,
    usingWslBridge: tools.some((t) => t.via === 'wsl'),
    tools,
    missing,
  };
}
