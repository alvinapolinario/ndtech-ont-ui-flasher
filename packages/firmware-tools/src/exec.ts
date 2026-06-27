/**
 * Logged command executor.
 *
 * SAFETY: Every external process this tool runs goes through `runCommand`, which
 * (a) uses `spawn` with an argument array and `shell: false` to avoid shell
 * injection, and (b) hands a structured record to an optional logger so the
 * caller can persist a `CommandLog` row. Nothing executes silently.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';
import type { ExternalTool } from '@ndtech/shared';

export interface CommandResult {
  command: string;
  args: string[];
  cwd: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** True when the result was produced by mock mode rather than a real process. */
  isMock: boolean;
  /** Convenience flag: exitCode === 0. */
  ok: boolean;
}

export type CommandLogger = (record: CommandResult) => void | Promise<void>;

export interface RunCommandOptions {
  cwd?: string;
  /** Hard timeout in milliseconds (default 10 minutes). */
  timeoutMs?: number;
  /** Persist the structured result somewhere (e.g. the CommandLog table). */
  logger?: CommandLogger;
  /** Max bytes of stdout/stderr to retain (avoids OOM on huge tool output). */
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_OUTPUT = 5 * 1024 * 1024; // 5 MiB

function truncate(buf: string, max: number): string {
  if (buf.length <= max) return buf;
  return buf.slice(0, max) + `\n... [truncated ${buf.length - max} bytes]`;
}

/**
 * Spawn an external command, capturing stdout/stderr and timing, then forward
 * the structured result to the optional logger.
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const {
    cwd,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logger,
    maxOutputBytes = DEFAULT_MAX_OUTPUT,
    env,
  } = options;

  const start = Date.now();

  const result = await new Promise<CommandResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: env ? { ...process.env, ...env } : process.env,
    });

    const timer = setTimeout(() => {
      if (!settled) {
        stderr += `\n[ndtech] command timed out after ${timeoutMs}ms; killing.\n`;
        child.kill('SIGKILL');
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < maxOutputBytes) stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < maxOutputBytes) stderr += chunk.toString('utf8');
    });

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        args,
        cwd: cwd ?? null,
        exitCode,
        stdout: truncate(stdout, maxOutputBytes),
        stderr: truncate(stderr, maxOutputBytes),
        durationMs: Date.now() - start,
        isMock: false,
        ok: exitCode === 0,
      });
    };

    child.on('error', (err) => {
      stderr += `\n[ndtech] failed to spawn "${command}": ${err.message}\n`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });

  if (logger) await logger(result);
  return result;
}

/**
 * Build a synthetic, clearly-labelled mock result (used when a tool is missing
 * or FORCE_MOCK_MODE is enabled). Still routed through the logger.
 */
export async function mockCommand(
  command: string,
  args: string[],
  stdout: string,
  options: Pick<RunCommandOptions, 'cwd' | 'logger'> = {},
): Promise<CommandResult> {
  const result: CommandResult = {
    command,
    args,
    cwd: options.cwd ?? null,
    exitCode: 0,
    stdout: `[MOCK OUTPUT — external tool not executed]\n${stdout}`,
    stderr: '',
    durationMs: 0,
    isMock: true,
    ok: true,
  };
  if (options.logger) await options.logger(result);
  return result;
}

/** Whether the engine should operate in mock mode (no real tools / forced). */
export function isMockModeForced(): boolean {
  return process.env.FORCE_MOCK_MODE === 'true';
}

// ---------------------------------------------------------------------------
// Tool runtime resolution (native vs WSL bridge vs none)
//
// On Windows the firmware tools (binwalk, squashfs-tools, ...) are typically not
// available natively. If WSL is installed with a distro that has them, we run
// the tools THROUGH WSL and translate Windows paths to /mnt/<drive>/... so the
// Windows-hosted app can still perform live analysis without being rewritten to
// run inside Linux.
// ---------------------------------------------------------------------------

export type ToolRuntime = 'native' | 'wsl' | 'none';

function isWindows(): boolean {
  return process.platform === 'win32';
}

/** Optional explicit distro (WSL_DISTRO env); otherwise WSL's default is used. */
export function getWslDistro(): string | undefined {
  const d = process.env.WSL_DISTRO;
  return d && d.trim().length > 0 ? d.trim() : undefined;
}

/** Convert a Windows absolute path (D:\a\b) to a WSL path (/mnt/d/a/b). */
export function toWslPath(p: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (m) return `/mnt/${m[1]!.toLowerCase()}/${m[2]!.replace(/\\/g, '/')}`;
  return p.replace(/\\/g, '/');
}

function looksLikeWindowsPath(s: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(s);
}

async function nativeAvailable(tool: string): Promise<boolean> {
  const probe = isWindows() ? 'where' : 'which';
  const res = await runCommand(probe, [tool], { timeoutMs: 5000 });
  return res.ok && res.stdout.trim().length > 0;
}

async function wslAvailable(tool: string): Promise<boolean> {
  if (!isWindows()) return false;
  const distro = getWslDistro();
  const args = [...(distro ? ['-d', distro] : []), '-e', 'which', tool];
  const res = await runCommand('wsl.exe', args, { timeoutMs: 8000 });
  return res.ok && res.stdout.trim().length > 0;
}

const runtimeCache = new Map<string, ToolRuntime>();

/** Resolve how a given tool should be executed (cached for the process). */
export async function resolveToolRuntime(tool: ExternalTool | string): Promise<ToolRuntime> {
  if (isMockModeForced()) return 'none';
  const cached = runtimeCache.get(tool);
  if (cached) return cached;

  let runtime: ToolRuntime = 'none';
  if (await nativeAvailable(tool)) runtime = 'native';
  else if (await wslAvailable(tool)) runtime = 'wsl';

  runtimeCache.set(tool, runtime);
  return runtime;
}

/** True if the tool can run either natively or via the WSL bridge. */
export async function isToolAvailable(tool: ExternalTool | string): Promise<boolean> {
  return (await resolveToolRuntime(tool)) !== 'none';
}

/**
 * Run an external tool, transparently using the WSL bridge on Windows when the
 * tool is only available there. Windows path arguments are translated to WSL
 * paths. The CommandLog records the actual invocation (including `wsl.exe`).
 */
export async function runTool(
  tool: string,
  args: string[] = [],
  options: RunCommandOptions & { runtime?: ToolRuntime } = {},
): Promise<CommandResult> {
  const runtime = options.runtime ?? (await resolveToolRuntime(tool));

  if (runtime === 'wsl') {
    const distro = getWslDistro();
    const mappedArgs = args.map((a) => (looksLikeWindowsPath(a) ? toWslPath(a) : a));
    const wslArgs = [...(distro ? ['-d', distro] : []), '-e', tool, ...mappedArgs];
    return runCommand('wsl.exe', wslArgs, options);
  }

  // native (or caller forced) — run directly.
  return runCommand(tool, args, options);
}
