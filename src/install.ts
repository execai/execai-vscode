// Installing and updating the execai binary.
//
// Why this lives in the extension. The extension is only a face; the agent loop,
// the tools and the permissions all live in the CLI. Demanding "install the
// binary by hand first" loses half the people on the very first screen, so the
// extension can fetch it itself.
//
// Where it goes: the extension's globalStorage. Not /usr/local/bin — installing
// must not ask for sudo and must not collide with a binary the user installed
// themselves. The managed binary is used only when there is none in PATH (or the
// one in PATH is older than the protocol needs).
//
// Where it comes from: the Yandex mirror first (our production bucket, fast in
// Russia), then GitHub Releases. That order on purpose: GitHub is often
// unreachable in Russia, while the mirror is always ours.

import * as vscode from 'vscode';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { versionAtLeast } from './version';

export { versionAtLeast };

/**
 * Oldest CLI version this extension works with.
 *
 * R6.49 introduced the IDE protocol; R6.56 added the security levels and the
 * account commands the panel now offers, and — more importantly — closed the
 * permission bypasses. Pointing at an older CLI would mean shipping a panel
 * whose menu entries silently do nothing, on top of a binary that asks fewer
 * questions than it should.
 */
export const MIN_CLI = 'R6.56';

const MIRROR = 'https://storage.yandexcloud.net/execai-agent-prod/execai/stable';
const GITHUB = 'https://github.com/execai/execai-agent/releases/latest/download';

/** Archive name for the current platform; null means the platform is unsupported. */
function assetName(): { file: string; bin: string } | null {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : null;
  if (!arch) return null;
  switch (process.platform) {
    case 'linux':
      return { file: `execai-linux-${arch}.tar.gz`, bin: `execai-linux-${arch}` };
    case 'darwin':
      return { file: `execai-darwin-${arch}.tar.gz`, bin: `execai-darwin-${arch}` };
    case 'win32':
      return { file: `execai-windows-${arch}.zip`, bin: `execai-windows-${arch}.exe` };
    default:
      return null;
  }
}

/** Path to the binary the extension manages (it may not exist yet). */
export function managedPath(ctx: vscode.ExtensionContext): string {
  const a = assetName();
  const exe = process.platform === 'win32' ? 'execai.exe' : 'execai';
  return path.join(ctx.globalStorageUri.fsPath, 'bin', a ? exe : exe);
}

/** Runs `<bin> version` and returns the version string, or null. */
export function probeVersion(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(bin, ['version'], { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve(null);
      const m = /R(\d+)\.(\d+)/.exec(String(stdout));
      resolve(m ? `R${m[1]}.${m[2]}` : String(stdout).trim() || null);
    });
  });
}

async function download(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Downloads a file, trying the mirror first and GitHub second. */
async function downloadAsset(file: string, progress?: (msg: string) => void): Promise<Uint8Array> {
  const errors: string[] = [];
  for (const base of [MIRROR, GITHUB]) {
    try {
      progress?.(vscode.l10n.t('downloading {0} — {1}', file, base.includes('yandex') ? 'mirror' : 'GitHub'));
      return await download(`${base}/${file}`);
    } catch (e) {
      errors.push(String(e));
    }
  }
  throw new Error(vscode.l10n.t('could not download {0}: {1}', file, errors.join(' · ')));
}

/** Verifies the checksum against the release's SHA256SUMS. */
async function verify(file: string, data: Uint8Array): Promise<void> {
  let sums = '';
  for (const base of [MIRROR, GITHUB]) {
    try {
      sums = new TextDecoder().decode(await download(`${base}/SHA256SUMS`));
      break;
    } catch {
      /* try the next source */
    }
  }
  if (!sums) throw new Error(vscode.l10n.t('could not fetch SHA256SUMS — installation cancelled'));
  const line = sums.split('\n').find((l) => l.trim().endsWith(file));
  if (!line) throw new Error(vscode.l10n.t('{0} is missing from SHA256SUMS', file));
  const want = line.trim().split(/\s+/)[0];
  const got = createHash('sha256').update(data).digest('hex');
  if (want !== got) {
    throw new Error(vscode.l10n.t('checksum mismatch — the file is corrupted or tampered with'));
  }
}

/** Unpacks an archive into a directory (tar exists on all three platforms). */
function extract(archive: string, dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // bsdtar on Windows 10+ reads zip too, so one command covers everything.
    execFile('tar', ['-xf', archive, '-C', dir], { timeout: 60000 }, (err) =>
      err ? reject(new Error(vscode.l10n.t('could not unpack: {0}', err.message))) : resolve(),
    );
  });
}

/**
 * ensureBinary fetches the binary into globalStorage and returns its path.
 * Shows progress; throws with a human-readable message on failure.
 */
export async function ensureBinary(ctx: vscode.ExtensionContext): Promise<string> {
  const a = assetName();
  if (!a) throw new Error(vscode.l10n.t('unsupported platform: {0}', `${process.platform}/${process.arch}`));

  const binDir = path.join(ctx.globalStorageUri.fsPath, 'bin');
  const target = managedPath(ctx);

  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('ExecAI: installing the agent') },
    async (p) => {
      const data = await downloadAsset(a.file, (m) => p.report({ message: m }));
      p.report({ message: vscode.l10n.t('verifying checksum') });
      await verify(a.file, data);

      await vscode.workspace.fs.createDirectory(vscode.Uri.file(binDir));
      const archive = path.join(binDir, a.file);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(archive), data);

      p.report({ message: vscode.l10n.t('unpacking') });
      await extract(archive, binDir);
      await vscode.workspace.fs.delete(vscode.Uri.file(archive), { useTrash: false });

      // Inside the archive the binary carries a platform-specific name — normalize it to execai.
      const unpacked = path.join(binDir, a.bin);
      try {
        await vscode.workspace.fs.rename(vscode.Uri.file(unpacked), vscode.Uri.file(target),
          { overwrite: true });
      } catch {
        // already renamed (a repeat install) — harmless
      }
      if (process.platform !== 'win32') {
        await new Promise<void>((res) =>
          execFile('chmod', ['+x', target], () => res()),
        );
      }
      const v = await probeVersion(target);
      if (!v) throw new Error(vscode.l10n.t('the binary downloaded but will not run — please report this'));
      p.report({ message: vscode.l10n.t('done: {0}', v) });
      return target;
    },
  );
}

/**
 * resolveBinary picks what to run: the setting → the managed copy
 * (globalStorage) → PATH. It also checks age: an old CLI knows nothing about
 * `execai ide`, and instead of breaking silently the user is offered an update.
 */
export async function resolveBinary(ctx: vscode.ExtensionContext): Promise<string | null> {
  const cfg = vscode.workspace.getConfiguration('execai');
  const explicit = (cfg.get<string>('binaryPath') || '').trim();
  // An explicit setting is law: the user named a path themselves, never override it.
  if (explicit && explicit !== 'execai') return explicit;

  const managed = managedPath(ctx);
  const managedVer = await probeVersion(managed);
  if (versionAtLeast(managedVer, MIN_CLI)) return managed;

  const pathVer = await probeVersion('execai');
  if (versionAtLeast(pathVer, MIN_CLI)) return 'execai';

  // Something is installed but it is old — say plainly what was found.
  const found = pathVer || managedVer;
  const autoInstall = cfg.get<boolean>('autoInstall') !== false;
  if (!autoInstall) return pathVer ? 'execai' : null;

  const msg = found
    ? vscode.l10n.t('execai {0}+ is required (found {1}) — update it?', MIN_CLI, found)
    : vscode.l10n.t('The execai agent was not found. Download it?');
  const download = vscode.l10n.t('Download');
  const pick = await vscode.window.showInformationMessage(msg, download, vscode.l10n.t('Not now'));
  if (pick !== download) return pathVer ? 'execai' : null;
  try {
    return await ensureBinary(ctx);
  } catch (e) {
    void vscode.window.showErrorMessage('ExecAI: ' + String(e instanceof Error ? e.message : e));
    return pathVer ? 'execai' : null;
  }
}
