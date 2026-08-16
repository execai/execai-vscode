// Update checks for ExecAI Studio.
//
// Why this lives in the extension. Studio is a repack of a VSCodium release,
// and the built-in updater knows exactly one URL baked into product.json. We
// want two independent places — the Yandex mirror (our production bucket,
// always reachable in Russia) and GitHub (reachable everywhere else) — so the
// extension does the checking itself, the same way the agent installer already
// falls back between the two. Outside Studio there is no `studioVersion` in
// product.json and every call here is a no-op.
//
// A Linux tarball cannot replace itself anyway, so "update" means telling the
// user and opening the download — not silent self-surgery.

import * as vscode from 'vscode';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { dottedNewer } from './version';

const MIRROR = 'https://storage.yandexcloud.net/execai-agent-prod/execai-studio/stable/latest.json';
const GITHUB_API = 'https://api.github.com/repos/execai/execai-studio/releases/latest';
const GITHUB_PAGE = 'https://github.com/execai/execai-studio/releases/latest';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const DISMISSED_KEY = 'studioUpdateDismissed';

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

/** The newest published version, from the first channel that answers. */
async function fetchLatest(): Promise<{ version: string; url: string } | null> {
  try {
    const j = (await fetchJson(MIRROR)) as {
      version?: unknown;
      url?: unknown;
      urls?: Record<string, unknown>;
    };
    if (typeof j.version === 'string') {
      // Per-platform download when latest.json carries one; the flat `url`
      // is the pre-multiplatform fallback.
      const mine = j.urls?.[`${process.platform}-${process.arch}`];
      const url = typeof mine === 'string' ? mine : typeof j.url === 'string' ? j.url : GITHUB_PAGE;
      return { version: j.version, url };
    }
  } catch {
    /* mirror unreachable — try GitHub */
  }
  try {
    const j = (await fetchJson(GITHUB_API)) as { tag_name?: unknown; html_url?: unknown };
    if (typeof j.tag_name === 'string') {
      return {
        version: j.tag_name.replace(/^v/, ''),
        url: typeof j.html_url === 'string' ? j.html_url : GITHUB_PAGE,
      };
    }
  } catch {
    /* offline — stay quiet, we will ask again later */
  }
  return null;
}

async function checkOnce(ctx: vscode.ExtensionContext, current: string): Promise<void> {
  const latest = await fetchLatest();
  if (!latest || !dottedNewer(latest.version, current)) return;
  if (ctx.globalState.get<string>(DISMISSED_KEY) === latest.version) return;

  const download = vscode.l10n.t('Download');
  const skip = vscode.l10n.t('Skip this version');
  const pick = await vscode.window.showInformationMessage(
    vscode.l10n.t('ExecAI Studio {0} is out (you are on {1}).', latest.version, current),
    download,
    skip,
  );
  if (pick === download) void vscode.env.openExternal(vscode.Uri.parse(latest.url));
  else if (pick === skip) void ctx.globalState.update(DISMISSED_KEY, latest.version);
}

/** Starts periodic update checks; does nothing outside ExecAI Studio. */
export function watchStudioUpdates(ctx: vscode.ExtensionContext): void {
  const current = studioVersion();
  if (!current) return;
  void checkOnce(ctx, current);
  const timer = setInterval(() => void checkOnce(ctx, current), CHECK_EVERY_MS);
  ctx.subscriptions.push({ dispose: () => clearInterval(timer) });
}
