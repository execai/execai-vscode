// OS integration for ExecAI Studio: «Open with ExecAI Studio» in the file
// manager, a menu entry, the execai-studio:// scheme.
//
// The install scripts set this up once; the editor re-checks it on every start
// so a self-update, a moved folder or a wiped registry never leaves the entry
// pointing at a path that no longer exists. Everything is per-user (HKCU,
// ~/.local/share) — no admin rights, no clash with a machine-wide install.
// Idempotent and cheap: a handful of registry/file reads when nothing changed.
// No-op outside Studio.

import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fsp } from 'node:fs';
import { execFile } from 'node:child_process';
import { studioVersion } from './studioUpdate';

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 15000, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve(String(stdout))));
}

/** <install> dir and the launcher for this platform. */
function where(): { install: string; exe: string; kind: 'linux' | 'win32' | 'darwin' } | null {
  const appRoot = vscode.env.appRoot;
  switch (process.platform) {
    case 'win32': {
      const install = path.resolve(appRoot, '..', '..');
      return { kind: 'win32', install, exe: path.join(install, 'ExecAI Studio.exe') };
    }
    case 'linux': {
      const install = path.resolve(appRoot, '..', '..');
      return { kind: 'linux', install, exe: path.join(install, 'bin', 'execai-studio') };
    }
    case 'darwin': {
      const install = path.resolve(appRoot, '..', '..', '..');
      return { kind: 'darwin', install, exe: install };
    }
    default:
      return null;
  }
}

async function ensureWindows(exe: string, install: string): Promise<boolean> {
  // reg.exe is on every Windows; PowerShell would be slower to spawn.
  const menu = 'Open with ExecAI Studio';
  const keys: Array<[string, string]> = [
    ['HKCU\\Software\\Classes\\Directory\\shell\\ExecAIStudio', '"%1"'],
    ['HKCU\\Software\\Classes\\Directory\\Background\\shell\\ExecAIStudio', '"%V"'],
    ['HKCU\\Software\\Classes\\*\\shell\\ExecAIStudio', '"%1"'],
  ];
  let changed = false;
  for (const [key, arg] of keys) {
    const want = `"${exe}" ${arg}`;
    let have = '';
    try {
      const out = await run('reg', ['query', `${key}\\command`, '/ve']);
      have = (out.match(/REG_SZ\s+(.*)$/m)?.[1] ?? '').trim();
    } catch { /* missing — will be created */ }
    if (have === want) continue;
    await run('reg', ['add', key, '/ve', '/d', menu, '/f']);
    await run('reg', ['add', key, '/v', 'Icon', '/d', `"${exe}"`, '/f']);
    await run('reg', ['add', `${key}\\command`, '/ve', '/d', want, '/f']);
    changed = true;
  }
  const appPaths = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\execai-studio.exe';
  await run('reg', ['add', appPaths, '/ve', '/d', exe, '/f']).catch(() => undefined);
  await run('reg', ['add', appPaths, '/v', 'Path', '/d', install, '/f']).catch(() => undefined);
  return changed;
}

async function ensureLinux(exe: string, install: string): Promise<boolean> {
  const dir = path.join(os.homedir(), '.local', 'share', 'applications');
  const file = path.join(dir, 'execai-studio.desktop');
  const want = [
    '[Desktop Entry]',
    'Name=ExecAI Studio',
    'Comment=Code editor with the ExecAI agent built in',
    `Exec=${exe} %F`,
    `Icon=${path.join(install, 'resources', 'app', 'resources', 'linux', 'code.png')}`,
    'Type=Application',
    'Categories=Development;IDE;',
    'StartupWMClass=execai-studio',
    'MimeType=x-scheme-handler/execai-studio;inode/directory;text/plain;',
    '',
  ].join('\n');
  let have = '';
  try { have = await fsp.readFile(file, 'utf8'); } catch { /* absent */ }
  if (have === want) return false;
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(file, want);
  await run('update-desktop-database', [dir]).catch(() => undefined);
  await run('xdg-mime', ['default', 'execai-studio.desktop', 'x-scheme-handler/execai-studio']).catch(() => undefined);
  return true;
}

async function ensureDarwin(app: string): Promise<boolean> {
  // Launch Services learns about the bundle when it is registered; that is
  // what puts it into Finder's «Open With» and binds execai-studio://.
  const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
  await run(lsregister, ['-f', app]).catch(() => undefined);
  return false;
}

/** Re-checks the OS integration; call on every Studio start. */
export async function ensureShellIntegration(): Promise<void> {
  if (!studioVersion()) return;
  // Test runs and probes start Studio from a scratch directory; without this
  // switch every such start would re-point the user's real «Open with ExecAI
  // Studio» entry at the scratch copy (it happened).
  if (process.env.EXECAI_STUDIO_NO_SHELL_INTEGRATION === '1') return;
  const w = where();
  if (!w) return;
  try {
    let changed = false;
    if (w.kind === 'win32') changed = await ensureWindows(w.exe, w.install);
    else if (w.kind === 'linux') changed = await ensureLinux(w.exe, w.install);
    else changed = await ensureDarwin(w.exe);
    if (changed) console.log('execai: OS integration refreshed for', w.install);
  } catch (e) {
    // Integration is a convenience; a failure here must never disturb the editor.
    console.warn('execai: OS integration check failed:', e);
  }
}
