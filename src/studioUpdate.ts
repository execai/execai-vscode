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

  // Fetch first, ask later. The download is the slow part and asking about it
  // buys nothing: the editor keeps working while it runs, and the only choice
  // that matters — when to restart — is asked once everything is in place.
  // Turn `execai.studioAutoUpdate` off to be asked before anything is fetched.
  if (vscode.workspace.getConfiguration('execai').get<boolean>('studioAutoUpdate', true)) {
    await applyUpdate(ctx, latest.version, { quiet: !manual });
    return;
  }

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

/** Streams a download; reports 0–100 when the server says how big it is. */
async function download(url: string, onPercent?: (p: number) => void): Promise<Uint8Array> {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  const total = Number(r.headers.get('content-length') || 0);
  if (!r.body || !total || !onPercent) return new Uint8Array(await r.arrayBuffer());
  const out = new Uint8Array(total);
  const reader = r.body.getReader();
  let got = 0, last = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) throw new Error('response longer than content-length');
    out.set(value, got);
    got += value.length;
    const pct = Math.floor((got * 100) / total);
    if (pct !== last) { onPercent(pct); last = pct; }
  }
  return got === total ? out : out.slice(0, got);
}

/** Fetches the archive, GitHub first, mirror second; verifies SHA-256 against SHA256SUMS. */
async function fetchArchive(file: string, version: string, progress: (m: string) => void): Promise<Uint8Array> {
  const errors: string[] = [];
  let data: Uint8Array | null = null;
  for (const url of [`${GITHUB_DL}/v${version}/${file}`, `${MIRROR_BASE}/${file}`]) {
    try {
      progress(vscode.l10n.t('downloading {0}', file));
      data = await download(url, (p) => progress(vscode.l10n.t('downloading {0} — {1}%', file, String(p))));
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
async function applyUpdate(ctx: vscode.ExtensionContext, version: string,
                           opts: { quiet?: boolean } = {}): Promise<void> {
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
      {
        // An update nobody asked for downloads in the status bar; one the user
        // asked for reports in a notification.
        location: opts.quiet ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification,
        title: vscode.l10n.t('ExecAI Studio: updating to {0}', version),
        cancellable: false,
      },
      async (p) => {
        const data = await fetchArchive(file, version, (m) => p.report({ message: m }));
        await fsp.rm(staging, { recursive: true, force: true });
        await fsp.mkdir(staging, { recursive: true });
        const archive = path.join(staging, file);
        await fsp.writeFile(archive, data);
        if (L.kind === 'win32') {
          // Windows: nothing more happens inside the editor. Unpacking here
          // makes Defender/indexers grab the fresh files, and every later
          // move/rmdir hits EBUSY. The visible installer does unpack + swap
          // once the editor is gone.
          await writeWindowsInstaller(staging, archive, L.installDir, version);
          await ctx.globalState.update(PENDING_KEY, version);
          return;
        }
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
    // Best-effort cleanup; its own failure must not mask the real error.
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    void vscode.window.showErrorMessage(vscode.l10n.t('ExecAI Studio update failed: {0}', String(e instanceof Error ? e.message : e)));
    return;
  }
  if (L.kind === 'win32') {
    const restart = vscode.l10n.t('Restart now');
    const later = vscode.l10n.t('Later');
    const pick = await vscode.window.showInformationMessage(
      vscode.l10n.t('ExecAI Studio {0} is downloaded. Restart to install it?', version),
      { modal: true, detail: vscode.l10n.t('The editor closes, a small window shows the installation progress, and the new version starts by itself. The previous version is kept until then.') },
      restart, later);
    trace(`win32 restart offer answered: ${pick ?? 'dismissed'}`);
    if (pick !== restart) return; // the archive stays staged; the next start offers again
    const { spawn } = await import('node:child_process');
    // Visible console: the user must see the installation while the editor
    // window is gone. Started right before quitting so it does not sit there
    // while «Later» is chosen.
    spawn('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(staging, 'install.ps1')],
      { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    await vscode.commands.executeCommand('workbench.action.quit');
    return;
  }
  const restart = vscode.l10n.t('Restart now');
  const later = vscode.l10n.t('Later');
  // The only question worth asking: the bits are already on disk, and a
  // running editor cannot swap itself out from under an open file.
  const pick = await vscode.window.showInformationMessage(
    vscode.l10n.t('ExecAI Studio {0} is installed. Restart to use it.', version),
    { modal: true, detail: vscode.l10n.t('The previous version is kept until the new one has started, so nothing is lost.') },
    restart, later);
  trace(`restart offer answered: ${pick ?? 'dismissed'}`);
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

/**
 * Writes the Windows installer next to the downloaded archive. It runs in its
 * own visible console after the editor has quit: waits for every process from
 * the old install to exit, unpacks the zip with a percentage, swaps the folders
 * (with retries — Defender holds fresh files for a few seconds), starts the new
 * build, and on any failure explains why and puts the previous version back.
 */
async function writeWindowsInstaller(staging: string, archive: string, install: string, version: string): Promise<void> {
  const ps = (v: string) => v.replace(/'/g, "''");
  const exe = path.join(install, 'ExecAI Studio.exe');
  const script = `
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'ExecAI Studio - installing update ${version}'
$staging = '${ps(staging)}'; $archive = '${ps(archive)}'; $install = '${ps(install)}'; $exe = '${ps(exe)}'
$old = "$install.old"; $unpack = Join-Path $staging 'unpacked'
function Step($n, $t) { Write-Host ("  [{0}/5] {1}" -f $n, $t) -NoNewline }
function Done { Write-Host ' done' -ForegroundColor Green }
function Retry($what, $act) {
  # Defender / indexers hold freshly written files for a moment: try for a while.
  $deadline = (Get-Date).AddSeconds(90); $n = 0
  while ($true) {
    try { & $act; return } catch {
      $n++
      if ((Get-Date) -gt $deadline) { throw "$what : $($_.Exception.Message)" }
      if ($n -eq 1) { Write-Host '' ; Write-Host "        (files still in use, retrying...)" -ForegroundColor DarkGray }
      Start-Sleep -Seconds 2
    }
  }
}
Write-Host ''
Write-Host "  ExecAI Studio update ${version}" -ForegroundColor Cyan
Write-Host '  ------------------------------'
try {
  Step 1 'waiting for ExecAI Studio to close...'
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    $running = Get-Process | Where-Object { try { $_.Path -and $_.Path.StartsWith($install, [StringComparison]::OrdinalIgnoreCase) } catch { $false } }
    if (-not $running) { break }
    Start-Sleep -Milliseconds 500
  }
  Done

  Step 2 'unpacking...'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $unpack | Out-Null
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
  try {
    $entries = $zip.Entries; $total = $entries.Count; $i = 0; $last = -1
    foreach ($e in $entries) {
      $target = Join-Path $unpack $e.FullName
      if ($e.FullName.EndsWith('/')) { New-Item -ItemType Directory -Force -Path $target | Out-Null }
      else {
        $dir = Split-Path $target
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)
      }
      $i++; $pct = [int](100 * $i / $total)
      if ($pct -ne $last) { Write-Host ("\`r  [2/5] unpacking... {0,3}%" -f $pct) -NoNewline; $last = $pct }
    }
  } finally { $zip.Dispose() }
  Done
  $fresh = (Get-ChildItem $unpack -Directory | Select-Object -First 1).FullName
  if (-not $fresh) { throw 'the archive is empty' }

  Step 3 'moving the current version aside...'
  Retry 'could not move the current version aside' { if (Test-Path $old) { Remove-Item $old -Recurse -Force }; Move-Item $install $old }
  Done

  Step 4 'putting the new version in place...'
  Retry 'could not put the new version in place' { Move-Item $fresh $install }
  Done

  Step 5 "starting ExecAI Studio ${version}..."
  Start-Process -FilePath $exe -WorkingDirectory $install
  Done
  Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} catch {
  Write-Host ''
  Write-Host "  update failed: $($_.Exception.Message)" -ForegroundColor Red
  if (-not (Test-Path $install) -and (Test-Path $old)) {
    Move-Item $old $install
    Write-Host '  the previous version was restored.' -ForegroundColor Yellow
  }
  Write-Host ''
  Write-Host '  press Enter to close'
  [void](Read-Host)
}
`;
  await fsp.writeFile(path.join(staging, 'install.ps1'), script, 'utf8');
}

/** After a swap, remove the previous install once the new one has started. */
export async function finishPendingUpdate(ctx: vscode.ExtensionContext): Promise<void> {
  const pending = ctx.globalState.get<string>(PENDING_KEY);
  if (!pending) return;
  const L = layout();
  const current = studioVersion();
  if (!L) return;
  if (current !== pending) {
    // Still on the old version: the swap did not happen («Later», or the
    // installer failed). Windows keeps the downloaded archive staged — offer
    // the restart again instead of downloading it a second time; elsewhere
    // the staged tree is gone with the failed run, so just forget and let the
    // regular check offer the update afresh.
    if (L.kind === 'win32') {
      const staging = L.installDir + '.staging';
      const ok = await fsp.stat(path.join(staging, 'install.ps1')).then(() => true, () => false);
      if (ok) {
        trace(`pending ${pending} still staged — offering restart again`);
        const restart = vscode.l10n.t('Restart now');
        const pick = await vscode.window.showInformationMessage(
          vscode.l10n.t('ExecAI Studio {0} is downloaded. Restart to install it?', pending),
          { modal: true, detail: vscode.l10n.t('The editor closes, a small window shows the installation progress, and the new version starts by itself. The previous version is kept until then.') },
          restart, vscode.l10n.t('Later'));
        if (pick === restart) {
          const { spawn } = await import('node:child_process');
          spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(staging, 'install.ps1')],
            { detached: true, stdio: 'ignore', windowsHide: false }).unref();
          await vscode.commands.executeCommand('workbench.action.quit');
        }
        return;
      }
    }
    await ctx.globalState.update(PENDING_KEY, undefined);
    return;
  }
  await fsp.rm(L.installDir + '.old', { recursive: true, force: true }).catch(() => undefined);
  await fsp.rm(L.installDir + '.staging', { recursive: true, force: true }).catch(() => undefined);
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
