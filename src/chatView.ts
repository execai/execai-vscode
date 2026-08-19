// The sidebar chat: a webview plus the agent process.
//
// All conversation logic lives in the CLI (`execai ide`); this file only
// translates: agent events → webview, human actions → agent. The webview can
// reach nothing except postMessage back here, exactly as it should be.
//
// User-visible strings go through vscode.l10n.t(): English is the base and
// l10n/bundle.l10n.<lang>.json carries the translations.

import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentClient, AgentEvent, NamedItem, PROTOCOL } from './protocol';
import { resolveBinary, ensureBinary, MIN_CLI } from './install';
import { chatHtml } from './webviewHtml';
import { studioVersion } from './studioUpdate';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'execai.chat';

  private view: vscode.WebviewView | null = null;
  private client: AgentClient | null = null;
  private status: vscode.StatusBarItem;
  private pending: AgentEvent[] = []; // events queued before the webview opened
  private lastState: AgentEvent | null = null; // state for the pickers

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.status.text = vscode.l10n.t('ExecAI: starting…');
    this.status.command = 'execai.chat.focus';
    this.status.show();
    ctx.subscriptions.push(this.status);
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [this.ctx.extensionUri] };
    view.webview.html = chatHtml(view.webview, this.ctx.extensionUri, vscode.env.language);

    view.webview.onDidReceiveMessage((m) => this.fromWebview(m));
    // Inside ExecAI Studio the panel menu gains «Check for Studio updates».
    if (studioVersion()) this.toWebview({ type: 'studio' });
    // Queued events are replayed on the ui_ready signal: the webview script may
    // not be listening yet, and early events (ready, notice) would be lost.
    if (!this.client) this.startAgent();
  }

  // ── the agent process ───────────────────────────────────────────

  startAgent(): void {
    void this.startAgentAsync();
  }

  private async startAgentAsync(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('execai');
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      this.toWebview({
        type: 'error',
        text: vscode.l10n.t('Open a project folder — the agent needs a working directory.'),
      });
      return;
    }
    // Find or fetch the binary ourselves: an extension without an agent is an empty panel.
    const bin = await resolveBinary(this.ctx);
    if (!bin) {
      this.toWebview({
        type: 'agent_exit',
        text: vscode.l10n.t(
          'The execai agent is not installed ({0}+ required).\nThe "ExecAI: Install/update the agent" command will download it, or set the path in execai.binaryPath.',
          MIN_CLI,
        ),
      });
      return;
    }
    this.client?.dispose();
    this.client = new AgentClient({
      binary: bin,
      cwd: ws.uri.fsPath,
      maxIterations: cfg.get<number>('maxIterations') || 0,
      onEvent: (e) => this.fromAgent(e),
      onExit: (code, stderrTail) => {
        this.status.text = vscode.l10n.t('ExecAI: agent stopped');
        this.toWebview({
          type: 'agent_exit',
          text: vscode.l10n.t('The agent exited (code {0}).', String(code ?? '—')) +
            (stderrTail ? '\n' + stderrTail : ''),
        });
      },
    });
    this.client.start();
    this.status.text = vscode.l10n.t('ExecAI: starting…');
  }

  /** Status bar without the "turn…" suffix. Kept as a field, not scraped back
   *  out of the text: the suffix is translated, and a regex over it would only
   *  match one language. */
  private statusMain = 'ExecAI';
  private statusBase(): string {
    return this.statusMain;
  }

  private fromAgent(e: AgentEvent): void {
    switch (e.type) {
      case 'ready':
        this.status.text = this.statusMain = `ExecAI: ${e.model ?? '?'} · ${e.source ?? ''}`;
        // Ask for state right away: the model/source pickers must not wait for a click.
        this.client?.sendCommand('state');
        // Продолжаем последний чат этого проекта.
        //
        // Панель открывалась с чистого листа, и разговор приходилось искать
        // в истории вручную — в терминале для этого есть /resume, а здесь не
        // было ничего. Редактор — место, куда возвращаются: чат обязан
        // продолжаться сам. Отключается настройкой, если кому-то нужен
        // каждый раз чистый лист.
        if (vscode.workspace.getConfiguration('execai').get<boolean>('resumeLastChat', true)) {
          this.client?.sendCommand('resume_last');
        }
        if ((e.protocol ?? 0) > PROTOCOL) {
          this.toWebview({
            type: 'notice',
            text: vscode.l10n.t(
              'This execai is newer than the extension — update the extension, some events may not render.',
            ),
          });
        }
        break;
      case 'turn_start':
        this.status.text = this.statusBase() + ' · ' + vscode.l10n.t('turn…');
        break;
      case 'done':
        this.status.text = this.statusBase();
        break;
      case 'ask':
      case 'ask_user':
        // The user may be in another editor tab — bring the panel forward.
        this.view?.show?.(true);
        break;
      case 'login_start': {
        // The link opens by itself, but it must also be takeable by hand: over
        // SSH nothing opens, and the sign-in may happen in a browser on a
        // different machine. The panel shows the same link with a copy button.
        const uri = e.text || '';
        const copy = vscode.l10n.t('Copy link');
        void vscode.window.showInformationMessage(
          vscode.l10n.t('Confirm the sign-in: code {0}', e.id ?? ''),
          vscode.l10n.t('Open in browser'), copy,
        ).then((p) => {
          if (p === copy) void vscode.env.clipboard.writeText(uri);
          else if (p && uri) void vscode.env.openExternal(vscode.Uri.parse(uri));
        });
        if (uri) void vscode.env.openExternal(vscode.Uri.parse(uri));
        break;
      }
      case 'login_done':
        void vscode.window.showInformationMessage(
          vscode.l10n.t('ExecAI: signed in as {0}', e.text || ''));
        break;
      case 'state':
        this.lastState = e;
        this.status.text = this.statusMain = `ExecAI: ${e.model ?? '?'} · ${e.source ?? ''}`;
        break;
    }
    this.toWebview(e);
  }

  private uiReady = false;

  private toWebview(e: unknown): void {
    if (this.view && this.uiReady) void this.view.webview.postMessage(e);
    else this.pending.push(e as AgentEvent);
  }

  // ── human actions ───────────────────────────────────────────────

  private fromWebview(m: { type: string; text?: string; id?: string; value?: string; path?: string; line?: string; files?: string[] }): void {
    switch (m.type) {
      case 'ui_ready': {
        this.uiReady = true;
        for (const e of this.pending) void this.view?.webview.postMessage(e);
        this.pending = [];
        const tabs = this.ctx.workspaceState.get<string>('execai.tabs', '');
        if (tabs) this.toWebview({ type: 'tabs_state', text: tabs });
        break;
      }
      case 'send': {
        if (!this.client?.alive) this.startAgent();
        const ctx = this.editorContext() ?? {};
        if (m.files?.length) ctx.files = m.files;
        this.client?.sendUser(m.text || '', ctx);
        // The auto-attached context must be visible: the agent knowing about a
        // file the chat never showed reads as spooky action at a distance —
        // "the AI sees my file but the panel shows nothing".
        if (ctx.path) {
          this.toWebview({
            type: 'context_attached',
            text: ctx.selection
              ? vscode.l10n.t('{0} + selection (active file)', ctx.path)
              : vscode.l10n.t('{0} (active file)', ctx.path),
          });
        }
        break;
      }
      case 'pick_files':
        void this.pickFiles();
        break;
      case 'tabs_state':
        // Which chat tabs are on the strip and in what order is a property of
        // this workspace, not of the agent: it survives a reload here.
        void this.ctx.workspaceState.update('execai.tabs', m.text || '');
        break;
      case 'copy_text':
        // The webview cannot rely on navigator.clipboard in every host — the
        // extension side always can.
        void vscode.env.clipboard.writeText(m.text || '');
        break;
      case 'attach_paths':
        void this.attachPaths((m as { paths?: string[] }).paths || []);
        break;
      case 'paste_blob':
        void this.saveBlobAndAttach(
          (m as { name?: string }).name || 'clipboard.bin',
          (m as { dataURL?: string }).dataURL || '');
        break;
      case 'agent_command': {
        const c = m as unknown as { name?: string; value?: string };
        if (!this.client?.alive) {
          // A dead agent used to swallow commands in silence while the panel
          // kept its optimism. Say what is actually wrong instead.
          if (!vscode.workspace.workspaceFolders?.length) {
            this.toWebview({
              type: 'error',
              text: vscode.l10n.t('Open a project folder — the agent needs a working directory.'),
            });
          } else {
            this.startAgent();
            this.toWebview({
              type: 'notice',
              text: vscode.l10n.t('The agent is starting — repeat the action in a moment.'),
            });
          }
          break;
        }
        if (c.name === 'connect') { void this.connectFlow(c.value || ''); break; }
        if (c.name === 'set_max_iterations' && !c.value) { void this.maxIterFlow(); break; }
        this.client?.sendCommand(c.name || '', c.value);
        break;
      }
      case 'new_chat_ui':
        this.newChat();
        break;
      case 'open_terminal':
        void vscode.commands.executeCommand('execai.openTerminal');
        break;
      case 'check_updates':
        void vscode.commands.executeCommand('execai.checkUpdates');
        break;
      case 'answer':
        this.client?.sendAnswer(m.id || '', m.value || '');
        break;
      case 'stop':
        this.client?.stop();
        break;
      case 'new_chat':
        this.client?.newChat();
        break;
      case 'open_file': {
        if (!m.path) break;
        void this.openFile(m.path, m.line);
        break;
      }
      case 'open_external': {
        // Links in an answer are text the model produced — only the schemes a
        // chat has any business opening are followed.
        const url = m.text || '';
        if (!/^(https?:|mailto:)/i.test(url)) break;
        void vscode.env.openExternal(vscode.Uri.parse(url));
        break;
      }
      case 'restart':
        this.startAgent();
        break;
    }
  }

  /** Editor context — only when the setting allows it. */
  private editorContext(): { path?: string; selection?: string; language?: string; files?: string[] } | undefined {
    const cfg = vscode.workspace.getConfiguration('execai');
    if (!cfg.get<boolean>('attachContext')) return undefined;
    const ed = vscode.window.activeTextEditor;
    if (!ed || ed.document.uri.scheme !== 'file') return undefined;
    const ws = vscode.workspace.workspaceFolders?.[0];
    let path = ed.document.uri.fsPath;
    if (ws && path.startsWith(ws.uri.fsPath)) path = path.slice(ws.uri.fsPath.length + 1);
    const selection = ed.selection.isEmpty ? undefined : ed.document.getText(ed.selection);
    // A wall of selected text bloats the prompt — cut it with an honest marker.
    const cut = selection && selection.length > 20000
      ? selection.slice(0, 20000) + '\n…(truncated)'
      : selection;
    return { path, selection: cut, language: ed.document.languageId };
  }

  /**
   * Opens a file mentioned in the chat, optionally at a line. Paths in an
   * answer are guesses — the model writes what it believes exists — so a miss
   * is reported as a notice instead of an unhandled rejection.
   */
  private async openFile(path: string, line?: string): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    const uri = path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)
      ? vscode.Uri.file(path)
      : ws
        ? vscode.Uri.joinPath(ws.uri, path)
        : null;
    if (!uri) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t('Open a project folder to follow links to its files.'));
      return;
    }
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      void vscode.window.showWarningMessage(vscode.l10n.t('No such file: {0}', path));
      return;
    }
    const n = Math.max(0, (parseInt(line || '0', 10) || 1) - 1);
    const at = new vscode.Range(n, 0, n, 0);
    await vscode.window.showTextDocument(uri, { preview: true, selection: at });
  }

  /** Connecting a source: the key is asked for with an editor input box. */
  private async connectFlow(provider: string): Promise<void> {
    const noKey = provider === 'claude-cli' || provider === 'codex-cli';
    let key: string | undefined;
    if (!noKey) {
      key = await vscode.window.showInputBox({
        title: vscode.l10n.t('Key for {0}', provider),
        prompt: provider === 'ollama'
          ? vscode.l10n.t('An ollama.com key for the cloud; leave empty for a local Ollama')
          : vscode.l10n.t('Provider key — stored on this machine only'),
        password: true,
        ignoreFocusOut: true,
      });
      // Cancelling the box (Esc) is a refusal to connect, not an empty key.
      if (key === undefined && provider !== 'ollama') return;
    }
    this.client?.sendCommand('connect', provider, { key: key || '' });
  }

  /** Iteration limit — a plain number. */
  private async maxIterFlow(): Promise<void> {
    const cur = this.lastState?.max_iter ?? 50;
    const v = await vscode.window.showInputBox({
      title: vscode.l10n.t('Tool iteration limit per turn'),
      value: String(cur),
      ignoreFocusOut: true,
      validateInput: (t) =>
        /^[1-9]\d*$/.test(t.trim()) ? null : vscode.l10n.t('a positive number is required'),
    });
    if (v) this.client?.sendCommand('set_max_iterations', v.trim());
  }

  /** The explicit "Install/update the agent" command from the palette. */
  async installAgent(): Promise<void> {
    try {
      await ensureBinary(this.ctx);
      void vscode.window.showInformationMessage(
        vscode.l10n.t('ExecAI: agent installed — restarting.'));
      this.startAgent();
    } catch (e) {
      void vscode.window.showErrorMessage('ExecAI: ' + String(e instanceof Error ? e.message : e));
    }
  }

  /** The "+" button: the NATIVE file dialog — any path, multi-select. The owner
   *  rejected a QuickPick on top ("not a file manager"), and it could only see
   *  files inside the workspace anyway. */
  private async pickFiles(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: vscode.l10n.t('Attach'),
      defaultUri: ws?.uri,
      title: vscode.l10n.t('Files for the agent — paths only; it reads the contents itself'),
    });
    if (picked?.length) void this.attachPaths(picked.map((u) => u.fsPath));
  }

  /** The "attach file" command from the explorer or palette (right-click a file). */
  async attachFromCommand(uri?: vscode.Uri, uris?: vscode.Uri[]): Promise<void> {
    const list = (uris?.length ? uris : uri ? [uri] : [])
      .filter((u) => u.scheme === 'file')
      .map((u) => u.fsPath);
    if (!list.length) {
      // The active TAB, not activeTextEditor: images and custom editors have no
      // text editor behind them, and the palette used to "attach nothing".
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      const input = tab?.input as { uri?: vscode.Uri } | undefined;
      if (input?.uri?.scheme === 'file') list.push(input.uri.fsPath);
      else {
        const ed = vscode.window.activeTextEditor;
        if (ed?.document.uri.scheme === 'file') list.push(ed.document.uri.fsPath);
      }
    }
    if (!list.length) return;
    this.view?.show?.(true);
    await this.attachPaths(list);
  }

  private static readonly imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
  private static readonly mimeByExt: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
  };

  /**
   * The common entry point for every attachment (picker, drag&drop, paste):
   * absolute paths plus thumbnails for images. Image paths MUST be absolute —
   * otherwise the CLI's vision pickup will not recognize them (its regex
   * requires a leading / or ~).
   */
  private async attachPaths(absPaths: string[]): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    const items: { path: string; label: string; thumb?: string }[] = [];
    for (const p of absPaths) {
      const ext = path.extname(p).toLowerCase();
      const label = ws && p.startsWith(ws.uri.fsPath) ? p.slice(ws.uri.fsPath.length + 1) : path.basename(p);
      const item: { path: string; label: string; thumb?: string } = { path: p, label };
      if (ChatViewProvider.imageExts.has(ext)) {
        try {
          const data = await vscode.workspace.fs.readFile(vscode.Uri.file(p));
          // Only reasonable thumbnails go over: the chat is no place for 20MB of base64.
          if (data.byteLength <= 3 * 1024 * 1024) {
            item.thumb = 'data:' + ChatViewProvider.mimeByExt[ext] + ';base64,' +
              Buffer.from(data).toString('base64');
          }
        } catch {
          // unreadable — the chip just goes without a thumbnail
        }
      }
      items.push(item);
    }
    if (items.length) this.toWebview({ type: 'files_attached', items });
  }

  /** A paste or drop with no path (a screenshot from the clipboard): save it, then attach. */
  private async saveBlobAndAttach(name: string, dataURL: string): Promise<void> {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataURL);
    if (!m) return;
    const dir = path.join(os.tmpdir(), 'execai-attach');
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    const safe = name.replace(/[^\w.\-]+/g, '_');
    const p = path.join(dir, Date.now() + '-' + safe);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(p), Buffer.from(m[2], 'base64'));
    const ext = path.extname(p).toLowerCase();
    this.toWebview({
      type: 'files_attached',
      items: [{
        path: p, label: name,
        thumb: ChatViewProvider.imageExts.has(ext) ? dataURL : undefined,
      }],
    });
  }

  /** (unused — the menu moved into the chat; kept for the command palette) */
  private async commandsMenu(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
      [
        { label: '$(chip) ' + vscode.l10n.t('Change model'), id: 'model', description: this.lastState?.model },
        { label: '$(plug) ' + vscode.l10n.t('Change source'), id: 'source', description: this.lastState?.source },
        { label: '$(add) ' + vscode.l10n.t('New chat'), id: 'new_chat' },
        { label: '$(debug-restart) ' + vscode.l10n.t('Restart the agent'), id: 'restart' },
        { label: '$(terminal) ' + vscode.l10n.t('Open execai in a terminal'), id: 'terminal' },
      ] as (vscode.QuickPickItem & { id: string })[],
      { placeHolder: vscode.l10n.t('execai commands'), ignoreFocusOut: true },
    );
    if (!pick) return;
    switch (pick.id) {
      case 'new_chat': this.newChat(); break;
      case 'restart': this.restart(); break;
      case 'terminal': void vscode.commands.executeCommand('execai.openTerminal'); break;
      case 'model': await this.pickFromState('models', 'set_model', vscode.l10n.t('Model')); break;
      case 'source': await this.pickFromState('sources', 'set_source', vscode.l10n.t('Source')); break;
    }
  }

  private async pickFromState(kind: 'models' | 'sources', cmd: string, title: string): Promise<void> {
    // Ask for a fresh state and wait a moment: the list may be stale.
    this.client?.sendCommand('state');
    await new Promise((r) => setTimeout(r, 300));
    const items: NamedItem[] = (this.lastState?.[kind] as NamedItem[] | undefined) ?? [];
    if (!items.length) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t('The list is empty — the agent is not ready yet.'));
      return;
    }
    const picked = await vscode.window.showQuickPick(
      items.map((m) => ({ label: (m.active ? '$(check) ' : '') + m.id, description: m.label, id: m.id })),
      { placeHolder: title, ignoreFocusOut: true },
    );
    if (picked) this.client?.sendCommand(cmd, (picked as { id: string }).id);
  }

  // ── commands ────────────────────────────────────────────────────

  newChat(): void {
    this.client?.newChat();
    this.toWebview({ type: 'chat_reset' });
  }
  stopTurn(): void {
    this.client?.stop();
  }
  restart(): void {
    this.startAgent();
  }
  sendSelection(): void {
    const ed = vscode.window.activeTextEditor;
    if (!ed || ed.selection.isEmpty) return;
    this.view?.show?.(true);
    this.toWebview({ type: 'prefill', text: vscode.l10n.t('About the selected fragment: ') });
  }
  dispose(): void {
    this.client?.dispose();
  }
}
