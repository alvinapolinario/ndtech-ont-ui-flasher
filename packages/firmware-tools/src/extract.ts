/**
 * Firmware extraction into an isolated, per-firmware workspace.
 *
 * SAFETY:
 *  - Extraction reads the firmware and writes ONLY into the workspace directory.
 *  - The original firmware file is never touched.
 *  - When binwalk is unavailable, a clearly-labelled mock rootfs is generated so
 *    the rest of the pipeline (asset scan, branding, preview) can be exercised.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { WEB_UI_FOLDER_CANDIDATES } from '@ndtech/shared';
import {
  runTool,
  mockCommand,
  resolveToolRuntime,
  type CommandLogger,
  type CommandResult,
} from './exec.js';
import { ensureDir, walkDirs, pathExists } from './fsutil.js';

export interface ExtractionResult {
  command: CommandResult;
  /** Absolute path of the directory binwalk extracted into. */
  extractRoot: string;
  /** Candidate web-UI directories (absolute paths). */
  webRootCandidates: string[];
  isMock: boolean;
}

/** Find directories whose path matches a known web-UI folder candidate. */
export async function findWebRootCandidates(extractRoot: string): Promise<string[]> {
  if (!(await pathExists(extractRoot))) return [];
  const dirs = await walkDirs(extractRoot);
  const matches: string[] = [];
  for (const rel of dirs) {
    const lower = rel.toLowerCase();
    for (const candidate of WEB_UI_FOLDER_CANDIDATES) {
      if (lower === candidate || lower.endsWith(`/${candidate}`)) {
        matches.push(path.join(extractRoot, rel));
        break;
      }
    }
  }
  return matches;
}

/** Build a small mock extracted rootfs containing a Huawei-style web UI. */
async function buildMockRootfs(extractRoot: string): Promise<void> {
  const webRoot = path.join(extractRoot, 'squashfs-root', 'etc_ro', 'web');
  await ensureDir(webRoot);

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Huawei EchoLife Home Gateway</title>
  <link rel="icon" href="favicon.ico" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="topbar">
    <img src="logo.png" alt="Huawei" class="logo" />
    <h1>Huawei Optical Network Terminal</h1>
  </header>
  <main>
    <div class="panel">
      <h2 class="panel-title">Welcome to the GPON Terminal management portal.</h2>
      <p class="panel-sub">Monitor your connection status and manage your Home Gateway.</p>
      <div class="status-grid">
        <div class="status-card"><span class="status-label">PON Status</span><span class="status-value ok">Online</span></div>
        <div class="status-card"><span class="status-label">Internet</span><span class="status-value ok">Connected</span></div>
        <div class="status-card"><span class="status-label">Wi-Fi</span><span class="status-value">Enabled</span></div>
        <div class="status-card"><span class="status-label">Uptime</span><span class="status-value">3d 04:21</span></div>
      </div>
    </div>
  </main>
  <footer class="footer">Copyright Huawei Technologies Co., Ltd.</footer>
</body>
</html>
`;

  const loginHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Huawei EchoLife Login</title>
  <link rel="icon" href="favicon.ico" />
  <link rel="stylesheet" href="style.css" />
</head>
<body class="login">
  <div class="login-card">
    <img class="login-logo" src="logo.png" alt="Huawei" />
    <div class="login-title">Home Gateway Login</div>
    <p class="login-subtitle">Sign in to manage your Optical Network Terminal</p>
    <form>
      <div class="field">
        <label for="acct">Account</label>
        <input id="acct" type="text" placeholder="Enter account" autocomplete="username" />
      </div>
      <div class="field">
        <label for="pwd">Password</label>
        <input id="pwd" type="password" placeholder="Enter password" autocomplete="current-password" />
      </div>
      <div class="login-options">
        <label class="remember"><input type="checkbox" /> Remember me</label>
        <a href="#">Forgot password?</a>
      </div>
      <button type="button" class="btn-login">Log In</button>
    </form>
  </div>
  <div class="login-foot">Huawei Technologies &middot; Optical Network Terminal</div>
</body>
</html>
`;

  const styleCss = `:root{
  --primary-color:#c7000b;
  --secondary-color:#333333;
  --bg:#eef2f7;
  --card:#ffffff;
  --text:#1f2733;
  --muted:#7a8694;
  --border:#dce2ea;
  --radius:14px;
}
*{box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;margin:0;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased;}

/* ---------- shared top bar / dashboard (index) ---------- */
.topbar{background:var(--primary-color);color:#fff;padding:14px 26px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 10px rgba(0,0,0,.18);}
.topbar .logo{height:38px;width:auto;}
.topbar h1{font-size:18px;font-weight:600;margin:0;letter-spacing:.01em;}
main{max-width:920px;margin:34px auto;padding:0 20px;}
.panel{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:26px 28px;box-shadow:0 8px 26px rgba(20,30,50,.07);}
.panel-title{margin:0 0 6px;font-size:20px;}
.panel-sub{margin:0 0 22px;color:var(--muted);}
.status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;}
.status-card{border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:6px;background:#fafbfd;}
.status-label{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.status-value{font-size:18px;font-weight:700;}
.status-value.ok{color:#1aa260;}
.footer{background:var(--secondary-color);color:#fff;padding:14px;text-align:center;font-size:13px;margin-top:40px;}

/* ---------- login page ---------- */
body.login{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  background:linear-gradient(135deg,var(--primary-color) 0%,var(--secondary-color) 100%);padding:24px;}
.login-card{width:100%;max-width:380px;background:var(--card);border-radius:18px;
  box-shadow:0 22px 60px rgba(0,0,0,.32);padding:36px 32px 30px;text-align:center;}
.login-logo{max-width:150px;max-height:90px;width:auto;height:auto;margin:0 auto 14px;display:block;}
.login-title{font-size:21px;font-weight:700;margin:0;color:var(--text);}
.login-subtitle{font-size:13px;color:var(--muted);margin:6px 0 24px;}
.field{text-align:left;margin-bottom:16px;}
.field label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;}
.field input{width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:10px;font-size:14px;color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s;}
.field input:focus{border-color:var(--primary-color);box-shadow:0 0 0 3px rgba(0,0,0,.06);}
.login-options{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:20px;}
.login-options .remember{display:flex;align-items:center;gap:6px;}
.login-options a{color:var(--primary-color);text-decoration:none;}
.btn-login{width:100%;padding:12px;border:0;border-radius:10px;background:var(--primary-color);color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:filter .15s,transform .05s;}
.btn-login:hover{filter:brightness(1.08);}
.btn-login:active{transform:translateY(1px);}
.login-foot{font-size:12px;color:rgba(255,255,255,.85);text-align:center;}
`;

  // A tiny valid 1x1 PNG and a placeholder favicon so replacement has a target.
  const onePxPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  await fs.writeFile(path.join(webRoot, 'index.html'), indexHtml, 'utf8');
  await fs.writeFile(path.join(webRoot, 'login.html'), loginHtml, 'utf8');
  await fs.writeFile(path.join(webRoot, 'style.css'), styleCss, 'utf8');
  await fs.writeFile(path.join(webRoot, 'common.css'), styleCss, 'utf8');
  await fs.writeFile(path.join(webRoot, 'logo.png'), onePxPng);
  await fs.writeFile(path.join(webRoot, 'favicon.ico'), onePxPng);
}

/**
 * Extract firmware with `binwalk -eM` into `<workspaceRoot>/extracted`.
 */
export async function extractFirmware(
  firmwarePath: string,
  workspaceRoot: string,
  options: { logger?: CommandLogger } = {},
): Promise<ExtractionResult> {
  const extractRoot = path.join(workspaceRoot, 'extracted');
  await ensureDir(extractRoot);

  const runtime = await resolveToolRuntime('binwalk');

  if (runtime === 'none') {
    await buildMockRootfs(extractRoot);
    const command = await mockCommand(
      'binwalk',
      ['-eM', '-C', extractRoot, firmwarePath],
      'Extracted mock rootfs with a Huawei-style web UI under squashfs-root/etc_ro/web',
      { cwd: workspaceRoot, logger: options.logger },
    );
    const webRootCandidates = await findWebRootCandidates(extractRoot);
    return { command, extractRoot, webRootCandidates, isMock: true };
  }

  // -e extract, -M recurse into extracted files (Matryoshka), -C output dir.
  // --run-as=root: binwalk refuses to extract as root unless explicitly allowed
  // (the WSL/container default user is often root). Paths are translated to WSL
  // form automatically when running via the bridge.
  const command = await runTool(
    'binwalk',
    ['-eM', '--run-as=root', '-C', extractRoot, firmwarePath],
    { runtime, cwd: workspaceRoot, logger: options.logger },
  );

  const webRootCandidates = await findWebRootCandidates(extractRoot);
  return { command, extractRoot, webRootCandidates, isMock: false };
}
