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
// Squirrel, no signature). Applying is done by the updater script shipped
// inside the installation (resources/execai/updater.*): the extension asks
// once — «Update and restart?» — starts that script in its own window and
// quits; the script waits for the editor to close, downloads with a
// percentage, verifies SHA-256, unpacks, swaps the folders and starts the new
// build. The old install stays as <install>.old until the new one has run.

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as os from 'node:os';
import { promises as fsp, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
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

  // One modal question — «Update and restart?» — then the updater window
  // takes over: closes the editor, downloads and installs with progress,
  // starts the new build. Modal on purpose: a toast in the bell is lost among
  // the start-up notifications, and an offer nobody sees is no offer.
  await applyUpdate(ctx, latest.version, { quiet: !manual });
}

// ── applying an update ─────────────────────────────────────────────
//
// The editor does not download or unpack anything itself any more. It starts
// the updater that ships inside the installation (resources/execai/updater.*)
// and quits; the updater — in its own console on Windows, a terminal window on
// Linux/macOS when one can be opened — waits for the editor to close, downloads
// with a percentage, verifies SHA-256, unpacks, swaps the folders and starts
// the new build. Two reasons: a running editor holds files Windows will not
// let go of (Defender grabs freshly unpacked trees → EBUSY), and a process
// spawned from the extension host dies with it on quit unless it is started
// through the shell as a new console.

/** Install dir, updater script and the platform kind. */
function layout(): { installDir: string; updater: string; kind: 'linux' | 'darwin' | 'win32' } | null {
  const appRoot = vscode.env.appRoot; // <install>/resources/app  |  <app>/Contents/Resources/app
  const res = path.resolve(appRoot, '..');
  switch (process.platform) {
    case 'linux':  return { kind: 'linux',  installDir: path.resolve(appRoot, '..', '..'),       updater: path.join(res, 'execai', 'updater.sh') };
    case 'win32':  return { kind: 'win32',  installDir: path.resolve(appRoot, '..', '..'),       updater: path.join(res, 'execai', 'updater.ps1') };
    case 'darwin': return { kind: 'darwin', installDir: path.resolve(appRoot, '..', '..', '..'), updater: path.join(res, 'execai', 'updater.sh') };
    default: return null;
  }
}

/**
 * Starts the updater for `version` and quits the editor. Everything visible
 * happens in the updater's own window from here on.
 */
async function applyUpdate(ctx: vscode.ExtensionContext, version: string, opts: { quiet?: boolean } = {}): Promise<void> {
  const L = layout();
  if (!L) {
    void vscode.window.showErrorMessage(vscode.l10n.t('unsupported platform: {0}', `${process.platform}/${process.arch}`));
    return;
  }
  const hasUpdater = await fsp.stat(L.updater).then(() => true, () => false);
  if (!hasUpdater) {
    // An installation from before the updater shipped: point at the page.
    trace(`no updater at ${L.updater}`);
    const open = vscode.l10n.t('Download');
    const pick = await vscode.window.showInformationMessage(
      vscode.l10n.t('ExecAI Studio {0} is out (you are on {1}).', version, studioVersion() ?? '?'), open);
    if (pick === open) void vscode.env.openExternal(vscode.Uri.parse(GITHUB_PAGE));
    return;
  }
  const restart = vscode.l10n.t('Update and restart');
  const later = vscode.l10n.t('Later');
  const skip = vscode.l10n.t('Skip this version');
  const pick = await vscode.window.showInformationMessage(
    vscode.l10n.t('ExecAI Studio {0} is out (you are on {1}). Update and restart?', version, studioVersion() ?? '?'),
    { modal: true, detail: vscode.l10n.t('The editor closes, a small window downloads and installs the update with progress, and the new version starts by itself. The previous version is kept until then.') },
    restart, later, skip);
  trace(`offer answered: ${pick ?? 'dismissed'}`);
  if (pick === skip) { void ctx.globalState.update(DISMISSED_KEY, version); return; }
  if (pick !== restart) return;
  void opts; // the offer is the same whether the check was manual or not

  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const { spawn } = await import('node:child_process');
  await ctx.globalState.update(PENDING_KEY, version);
  // Prefer the updater of the release being installed — fixes to the updater
  // itself then reach every older install, not only ones built after the fix.
  // The copy shipped with this install is the fallback when the network
  // cannot deliver a fresh one.
  const updater = await freshUpdater(L, version);
  trace(`starting updater ${updater} for ${version}`);
  if (L.kind === 'win32') {
    // `start` opens a NEW console owned by cmd, not by the extension host —
    // that is what keeps it alive when the editor quits and shows the window.
    const args = ['/c', 'start', '"ExecAI Studio update"', 'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-File', `"${updater}"`, '-Version', version, '-Install', `"${L.installDir}"`];
    if (folder) args.push('-Folder', `"${folder}"`);
    // cwd outside the install: a folder that is some process's working
    // directory cannot be moved, and cmd/powershell inherit ours otherwise.
    spawn('cmd.exe', args, { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true, cwd: os.tmpdir() }).unref();
  } else if (L.kind === 'darwin') {
    // Terminal.app shows the progress; a headless fallback runs it silently.
    const cmd = `bash ${sh(updater)} ${sh(version)} ${sh(L.installDir)} ${folder ? sh(folder) : ''}`;
    const osa = `tell application "Terminal" to do script ${JSON.stringify(cmd)}`;
    const t = spawn('osascript', ['-e', osa], { detached: true, stdio: 'ignore', cwd: os.tmpdir() });
    t.on('error', () => spawn('/bin/bash', [updater, version, L.installDir, ...(folder ? [folder] : [])], { detached: true, stdio: 'ignore', cwd: os.tmpdir() }).unref());
    t.unref();
  } else {
    // Linux: a terminal window if one exists, silent otherwise (the desktop
    // will simply see the editor come back a bit later).
    const term = await findTerminal();
    const argv = ['bash', updater, version, L.installDir, ...(folder ? [folder] : [])];
    if (term) spawn(term.bin, [...term.args, ...argv], { detached: true, stdio: 'ignore', cwd: os.tmpdir() }).unref();
    else spawn('/bin/bash', argv.slice(1), { detached: true, stdio: 'ignore', cwd: os.tmpdir() }).unref();
  }
  await vscode.commands.executeCommand('workbench.action.quit');
}

/**
 * The updater script of the target release, fetched into the user's temp dir
 * (GitHub at the release tag first, the mirror second); the shipped copy when
 * neither answers. A sanity check on size keeps a 404 page out of PowerShell.
 */
async function freshUpdater(L: NonNullable<ReturnType<typeof layout>>, version: string): Promise<string> {
  const name = L.kind === 'win32' ? 'updater.ps1' : 'updater.sh';
  const dest = path.join(os.tmpdir(), `execai-studio-updater-${version}-${name}`);
  const urls = [
    `https://raw.githubusercontent.com/execai/execai-studio/v${version}/updater/${name}`,
    `${MIRROR_BASE}/${name}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.length < 1000 || !/ExecAI Studio updater/.test(text)) continue;
      await fsp.writeFile(dest, text, 'utf8');
      if (L.kind !== 'win32') await fsp.chmod(dest, 0o755);
      trace(`fresh updater from ${url}`);
      return dest;
    } catch (e) {
      trace(`fresh updater ${url} failed: ${String(e)}`);
    }
  }
  return L.updater;
}

function sh(v: string): string { return `'${v.replace(/'/g, `'\\''`)}'`; }

/** A terminal emulator that can run a command in a new window, if any. */
async function findTerminal(): Promise<{ bin: string; args: string[] } | null> {
  const cands: Array<[string, string[]]> = [
    ['x-terminal-emulator', ['-e']], ['gnome-terminal', ['--']], ['konsole', ['-e']],
    ['xfce4-terminal', ['-x']], ['kitty', []], ['alacritty', ['-e']], ['xterm', ['-e']],
  ];
  for (const [bin, args] of cands) {
    const found = await new Promise<boolean>((res) => execFile('sh', ['-c', `command -v ${bin}`], (e) => res(!e)));
    if (found) return { bin, args };
  }
  return null;
}

/** After a swap, remove the previous install once the new one has started. */
export async function finishPendingUpdate(ctx: vscode.ExtensionContext): Promise<void> {
  const pending = ctx.globalState.get<string>(PENDING_KEY);
  if (!pending) return;
  const L = layout();
  const current = studioVersion();
  await ctx.globalState.update(PENDING_KEY, undefined);
  if (!L || current !== pending) return; // the updater did not run through — the regular check offers again
  await fsp.rm(L.installDir + '.old', { recursive: true, force: true }).catch(() => undefined);
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
