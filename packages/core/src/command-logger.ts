/**
 * Bridges the firmware-tools `CommandLogger` callback to the CommandLog table.
 * Every external (or mock) command run through the engine is persisted here.
 */
import type { CommandLogger, CommandResult } from '@ndtech/firmware-tools';
import { prisma } from './db.js';

export function makeCommandLogger(scope: {
  firmwareId?: string | null;
  workspaceId?: string | null;
}): CommandLogger {
  return async (result: CommandResult) => {
    try {
      await prisma.commandLog.create({
        data: {
          firmwareId: scope.firmwareId ?? null,
          workspaceId: scope.workspaceId ?? null,
          command: result.command,
          args: JSON.stringify(result.args),
          cwd: result.cwd,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs,
          isMock: result.isMock,
        },
      });
    } catch {
      // Logging must never break the primary operation; swallow persistence errors.
    }
  };
}
