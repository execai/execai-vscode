// Update checks for ExecAI Studio.
//
// Why this lives in the extension. Studio is a repack of a VSCodium release,
// and the built-in updater knows exactly one URL baked into product.json. We
// want two independent places — GitHub first, the Yandex mirror (our
// production bucket, always reachable in Russia) as the fallback — so the
// extension does the checking itself, the same way the agent installer already
// falls back between the two. Outside Studio there is no `studioVersion` in
// product.json and every call here is a no-op.
//
// The editor's own updater cannot apply our archives (no Inno installer, no
// Squirrel, no signature), so the extension applies them: download → verify
// SHA-256 → unpack next to the install → swap → offer a restart. Always with
// consent, never silently: the user picks «Update now», and the old install
// is kept as <install>.old until the new one has started once.

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fsp, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dottedNewer } from './version';

const MIRROR = 'https://storage.yandexcloud.net/execai-agent-prod/execai-studio/stable/latest.json';
const GITHUB_API = 'https://api.github.com/repos/execai/execai-studio/releases/latest';
const GITHUB_PAGE = 'https://github.com/execai/execai-studio/releases/latest';

const MIRROR_BASE = 'https://storage.yandexcloud.net/execai-agent-prod/execai-studio/stable';
const GITHUB_DL = 'https://github.com/execai/execai-studio/releases/download';

/** Append-only trace of the updater: ~/.config/execai/studio-update.log.
 *  The extension host has no log file of its own in a portable install, and
 *  «the offer never came» is impossible to debug without one. */
function trace(msg: string): void {
  try {
    const dir = path.join(os.homedir(), '.config', 'execai');
    require('node:fs').mkdirSync(dir, { recursive: true });
    require('node:fs').appendFileSync(path.join(dir, 'studio-update.log'), `${new Date().toISOString()} ${msg}\n`);
  } catch { /* logging must never break the updater */ }
}

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const DISMISSED_KEY = 'studioUpdateDismissed';
const PENDING_KEY = 'studioUpdatePending';

/** Studio's own version from product.json; null in stock VS Code and Cursor. */
export function studioVersion(): string | null {
  try {
    const product = JSON.parse(
      readFileSync(path.join(vscode.env.appRoot, 'product.json'), 'utf8'),
    ) as { studioVersion?: unknown };
    return typeof product.studioVersion === 'string' ? product.studioVersion : null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.json();
}

/** The newest published version — GitHub first, the Yandex mirror second. */
async function fetchLatest(): Promise<{ version: string; url: string } | null> {
  try {
    const j = (await fetchJson(GITHUB_API)) as { tag_name?: unknown; html_url?: unknown };
    if (typeof j.tag_name === 'string') {
      return {
        version: j.tag_name.replace(/^v/, ''),
        url: typeof j.html_url === 'string' ? j.html_url : GITHUB_PAGE,
      };
    }
  } catch {
    /* GitHub unreachable (or rate-limited) — try the mirror */
  }
  try {
    const j = (await fetchJson(MIRROR)) as {
      version?: unknown;
      url?: unknown;
      urls?: Record<string, unknown>;
    };
    if (typeof j.version === 'string') {
      const mine = j.urls?.[`${process.platform}-${process.arch}`];
      const url = typeof mine === 'string' ? mine : typeof j.url === 'string' ? j.url : GITHUB_PAGE;
      return { version: j.version, url };
    }
  } catch {
    /* offline — stay quiet, we will ask again later */
  }
  return null;
}

async function checkOnce(ctx: vscode.ExtensionContext, current: string, manual = false): Promise<void> {
  trace(`check start current=${current} manual=${manual}`);
  const latest = await fetchLatest();
  trace(`check result latest=${latest ? latest.version : 'null'}`);
  if (!latest) {
    // Background checks stay quiet offline; a button press deserves an answer.
    if (manual) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t('Could not reach the update channels — try again later.'));
    }
    return;
  }
  if (!dottedNewer(latest.version, current)) {
    if (manual) {
      void vscode.window.showInformationMessage(
        vscode.l10n.t('ExecAI Studio {0} is the latest version.', current));
    }
    return;
  }
  // A pressed button also overrides «skip this version» — asking by hand means
  // the user wants the answer, not the memory of last week's refusal.
  if (!manual && ctx.globalState.get<string>(DISMISSED_KEY) === latest.version) return;

  const update = vscode.l10n.t('Update now');
  const later = vscode.l10n.t('Later');
  const skip = vscode.l10n.t('Skip this version');
  // Modal on purpose: a toast in the bell is lost among the start-up
  // notifications, and an update offer that nobody sees is no offer.
  const pick = await vscode.window.showInformationMessage(
    vscode.l10n.t('ExecAI Studio {0} is out (you are on {1}). Update and restart?', latest.version, current),
    { modal: true, detail: vscode.l10n.t('The new version is downloaded, verified and installed in place; the current one is kept until the new one has started.') },
    update, later, skip,
  );
  trace(`offer answered: ${pick ?? 'dismissed'}`);
  if (pick === update) await applyUpdate(ctx, latest.version);
  else if (pick === skip) void ctx.globalState.update(DISMISSED_KEY, latest.version);
}

// ── applying an update ─────────────────────────────────────────────

/** Archive name and install layout for this platform. */
function layout(): { file: (v: string) => string; installDir: string; kind: 'linux' | 'darwin' | 'win32' } | null {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : null;
  if (!arch) return null;
  // appRoot = <install>/resources/app (linux, win32) or
  //           <install>/ExecAI Studio.app/Contents/Resources/app (darwin)
  const appRoot = vscode.env.appRoot;
  switch (process.platform) {
    case 'linux':
      return { kind: 'linux', installDir: path.resolve(appRoot, '..', '..'),
        file: (v) => `ExecAI-Studio-linux-${arch}-${v}.tar.gz` };
    case 'darwin':
      return { kind: 'darwin', installDir: path.resolve(appRoot, '..', '..', '..'),
        file: (v) => `ExecAI-Studio-darwin-${arch}-${v}.tar.gz` };
    case 'win32':
      return { kind: 'win32', installDir: path.resolve(appRoot, '..', '..'),
        file: (v) => `ExecAI-Studio-win32-${arch}-${v}.zip` };
    default:
      return null;
  }
}

async function download(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Fetches the archive, GitHub first, mirror second; verifies SHA-256 against SHA256SUMS. */
async function fetchArchive(file: string, version: string, progress: (m: string) => void): Promise<Uint8Array> {
  const errors: string[] = [];
  let data: Uint8Array | null = null;
  for (const url of [`${GITHUB_DL}/v${version}/${file}`, `${MIRROR_BASE}/${file}`]) {
    try {
      progress(vscode.l10n.t('downloading {0}', file));
      data = await download(url);
      break;
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (!data) throw new Error(errors.join(' · '));
  progress(vscode.l10n.t('verifying checksum'));
  let sums = '';
  for (const url of [`${GITHUB_DL}/v${version}/SHA256SUMS`, `${MIRROR_BASE}/SHA256SUMS`]) {
    try { sums = new TextDecoder().decode(await download(url)); break; } catch { /* next */ }
  }
  if (!sums) throw new Error(vscode.l10n.t('could not fetch SHA256SUMS — update cancelled'));
  const line = sums.split('\n').find((l) => l.trim().endsWith(file));
  if (!line) throw new Error(vscode.l10n.t('{0} is missing from SHA256SUMS', file));
  const want = line.trim().split(/\s+/)[0];
  const got = createHash('sha256').update(data).digest('hex');
  if (want !== got) throw new Error(vscode.l10n.t('checksum mismatch — the file is corrupted or tampered with'));
  return data;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 120000 }, (err, _o, stderr) =>
      err ? reject(new Error(`${cmd} ${args.join(' ')}: ${stderr || err.message}`)) : resolve()));
}

/**
 * Downloads, verifies, unpacks and swaps the installation. The old install
 * stays as <install>.old for one start; nothing is deleted before the new
 * tree is fully in place. Windows cannot replace a running exe, so there the
 * swap happens via a helper script that waits for this process to exit.
 */
async function applyUpdate(ctx: vscode.ExtensionContext, version: string): Promise<void> {
  const L = layout();
  if (!L) {
    void vscode.window.showErrorMessage(vscode.l10n.t('unsupported platform: {0}', `${process.platform}/${process.arch}`));
    return;
  }
  const file = L.file(version);
  // Stage NEXT TO the installation, not in /tmp: the swap must be a rename on
  // the same filesystem (atomic, instant, no 30k-file copy that can fail
  // halfway — a cross-fs copy did exactly that on the first try).
  const staging = L.installDir + '.staging';
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('ExecAI Studio: updating to {0}', version), cancellable: false },
      async (p) => {
        const data = await fetchArchive(file, version, (m) => p.report({ message: m }));
        await fsp.rm(staging, { recursive: true, force: true });
        await fsp.mkdir(staging, { recursive: true });
        const archive = path.join(staging, file);
        await fsp.writeFile(archive, data);
        p.report({ message: vscode.l10n.t('unpacking') });
        await run('tar', ['-xf', archive, '-C', staging]);
        await fsp.rm(archive, { force: true });
        // The archive holds a single top-level dir (ExecAI-Studio-<platform>);
        // on darwin the .app is one level below it.
        const [top] = await fsp.readdir(staging);
        let fresh = path.join(staging, top);
        if (L.kind === 'darwin') {
          const app = (await fsp.readdir(fresh)).find((n) => n.endsWith('.app'));
          if (!app) throw new Error('no .app in the archive');
          fresh = path.join(fresh, app);
          // The bundle was re-packed after signing; sign ad hoc, like install.sh.
          await run('codesign', ['--force', '--deep', '-s', '-', fresh]).catch(() => undefined);
        }
        p.report({ message: vscode.l10n.t('installing') });
        const install = L.installDir;
        const old = install + '.old';
        if (L.kind === 'win32') {
          // Swap after exit: a running exe cannot be replaced. The helper is
          // started detached and waits for this PID to go away.
          const helper = path.join(staging, 'swap.cmd');
          const script = [
            '@echo off',
            `:wait`,
            `tasklist /FI "PID eq ${process.pid}" 2>NUL | find "${process.pid}" >NUL && (timeout /t 1 /nobreak >NUL & goto wait)`,
            `rmdir /s /q "${old}" 2>NUL`,
            `move "${install}" "${old}"`,
            `move "${fresh}" "${install}"`,
            `start "" "${path.join(install, 'ExecAI Studio.exe')}"`,
          ].join('\r\n');
          await fsp.writeFile(helper, script);
          await ctx.globalState.update(PENDING_KEY, version);
          const { spawn } = await import('node:child_process');
          spawn('cmd.exe', ['/c', helper], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
          return;
        }
        // linux / darwin: two renames on one filesystem — atomic, and the old
        // tree is never gone before the new one is in place.
        await fsp.rm(old, { recursive: true, force: true });
        await fsp.rename(install, old);
        await fsp.rename(fresh, install);
        await fsp.rm(staging, { recursive: true, force: true });
        await ctx.globalState.update(PENDING_KEY, version);
      });
  } catch (e) {
    trace(`apply failed: ${String(e instanceof Error ? e.stack || e.message : e)}`);
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    void vscode.window.showErrorMessage(vscode.l10n.t('ExecAI Studio update failed: {0}', String(e instanceof Error ? e.message : e)));
    return;
  }
  if (L.kind === 'win32') {
    void vscode.window.showInformationMessage(
      vscode.l10n.t('ExecAI Studio {0} is ready — it will be installed and started when you close this window.', version));
    return;
  }
  const restart = vscode.l10n.t('Restart now');
  const pick = await vscode.window.showInformationMessage(
    vscode.l10n.t('ExecAI Studio {0} is installed. Restart to use it.', version), restart);
  if (pick === restart) {
    // The launcher path is the same after the swap; a fresh process comes up
    // from the new tree while this one quits.
    const launcher = L.kind === 'darwin'
      ? path.join(L.installDir, 'Contents', 'MacOS', 'Electron')
      : path.join(L.installDir, 'execai-studio');
    const { spawn } = await import('node:child_process');
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    spawn(launcher, folder ? [folder] : [], { detached: true, stdio: 'ignore' }).unref();
    await vscode.commands.executeCommand('workbench.action.quit');
  }
}

/** After a swap, remove the previous install once the new one has started. */
export async function finishPendingUpdate(ctx: vscode.ExtensionContext): Promise<void> {
  const pending = ctx.globalState.get<string>(PENDING_KEY);
  if (!pending) return;
  const L = layout();
  const current = studioVersion();
  if (!L || current !== pending) return; // not yet running the new one
  await fsp.rm(L.installDir + '.old', { recursive: true, force: true }).catch(() => undefined);
  await ctx.globalState.update(PENDING_KEY, undefined);
  void vscode.window.showInformationMessage(vscode.l10n.t('ExecAI Studio updated to {0}.', current));
}

/** The «check for updates» button/command; answers even when nothing is new. */
export function checkStudioUpdatesNow(ctx: vscode.ExtensionContext): void {
  const current = studioVersion();
  trace(`manual check requested, studioVersion=${current}`);
  if (!current) {
    void vscode.window.showInformationMessage(
      vscode.l10n.t('Update checks work in ExecAI Studio only.'));
    return;
  }
  void checkOnce(ctx, current, true);
}

/** Starts periodic update checks; does nothing outside ExecAI Studio. */
export function watchStudioUpdates(ctx: vscode.ExtensionContext): void {
  const current = studioVersion();
  trace(`watch start studioVersion=${current}`);
  if (!current) return;
  void checkOnce(ctx, current);
  const timer = setInterval(() => void checkOnce(ctx, current), CHECK_EVERY_MS);
  ctx.subscriptions.push({ dispose: () => clearInterval(timer) });
}
