// The sidebar chat: a webview plus the agent process.
//
// All conversation logic lives in the CLI (`execai ide`); the panel only
// translates: agent events → webview, human actions → agent. The translation
// itself is PanelCore (panelCore.ts), shared with the browser page of
// `execai ui`; this file owns the editor side — the agent process, QuickPicks,
// toasts, the status bar, files. The webview can reach nothing except
// postMessage back here, exactly as it should be.
//
// User-visible strings go through vscode.l10n.t(): English is the base and
// l10n/bundle.l10n.<lang>.json carries the translations.

import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentEvent, NamedItem, Workspace } from './protocol';
import { AgentClient } from './agentClient';
import { PanelCore, PanelHost, PanelMessage } from './panelCore';
import { resolveBinary, ensureBinary, MIN_CLI } from './install';
import { chatHtml } from './webviewHtml';
import { studioVersion } from './studioUpdate';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'execai.chat';

  private view: vscode.WebviewView | null = null;
  private client: AgentClient | null = null;
  private status: vscode.StatusBarItem;
  private pending: AgentEvent[] = []; // events queued before the webview opened
  private uiReady = false;
  // Routing, tab badges, toasts and dialogs: shared with the browser page of
  // `execai ui` (panelCore.ts). This class supplies the editor side of it.
  private readonly core: PanelCore;

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.status.text = vscode.l10n.t('ExecAI: starting…');
    this.status.command = 'execai.chat.focus';
    this.status.show();
    ctx.subscriptions.push(this.status);
    this.core = new PanelCore(this.editorHost());
  }

  /** The chat on screen (kept by the core). */
  get activeChat(): string | null { return this.core.activeChat; }
  set activeChat(v: string | null) { this.core.activeChat = v; }
  get wsWaiters(): ((list: Workspace[]) => void)[] { return this.core.wsWaiters; }
  private get lastState(): AgentEvent | null { return this.core.lastState; }

  /** What the shared panel logic gets from VS Code. */
  private editorHost(): PanelHost {
    return {
      l10n: vscode.l10n,
      agent: () => this.client,
      startAgent: () => this.startAgent(),
      hasFolder: () => !!vscode.workspace.workspaceFolders?.length,
      post: (e) => this.toWebview(e),
      uiReady: () => {
        this.uiReady = true;
        for (const e of this.pending) void this.view?.webview.postMessage(e);
        this.pending = [];
      },
      status: (text, tooltip) => {
        this.status.text = text;
        this.status.tooltip = tooltip;
      },
      info: (message, ...actions) => vscode.window.showInformationMessage(message, ...actions),
      warn: (message) => { void vscode.window.showWarningMessage(message); },
      reveal: () => this.reveal(),
      // Looking at the panel: it is visible and the editor window has focus.
      attentive: () => !!this.view && this.view.visible !== false && vscode.window.state?.focused !== false,
      notificationsOn: () => vscode.workspace.getConfiguration('execai').get<boolean>('notifications', true),
      // The window in the background and the agent on this machine (not over
      // SSH, WSL or in a container — there it would pop up elsewhere).
      systemNotify: () => !vscode.env.remoteName && vscode.window.state?.focused === false,
      openExternal: (url) => { void vscode.env.openExternal(vscode.Uri.parse(url)); },
      // The webview cannot rely on navigator.clipboard in every host — the
      // extension side always can.
      copy: (text) => { void vscode.env.clipboard.writeText(text); },
      memo: {
        get: <T>(key: string, def: T) => this.ctx.workspaceState.get<T>(key, def),
        set: (key, value) => { void this.ctx.workspaceState.update(key, value); },
      },
      // "Getting started" closed once is closed in every project.
      globalMemo: {
        get: <T>(key: string, def: T) => this.ctx.globalState.get<T>(key, def),
        set: (key, value) => { void this.ctx.globalState.update(key, value); },
      },
      pick: (items, opts) => vscode.window.showQuickPick(items, opts),
      input: (opts) => vscode.window.showInputBox(opts),
      resumeLastChat: () => vscode.workspace.getConfiguration('execai').get<boolean>('resumeLastChat', true),
      editorContext: () => this.editorContext(),
      pickFiles: () => { void this.pickFiles(); },
      attachPaths: (paths) => { void this.attachPaths(paths); },
      pasteBlob: (name, dataURL) => { void this.saveBlobAndAttach(name, dataURL); },
      openFile: (p, line) => { void this.openFile(p, line); },
      openTerminal: (args) => { void vscode.commands.executeCommand('execai.openTerminal', args ?? []); },
      checkUpdates: () => { void vscode.commands.executeCommand('execai.checkUpdates'); },
      updateAgent: () => { void vscode.commands.executeCommand('execai.installAgent'); },
    };
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
    this.clearInbox(); // a new process reports its own inbox, or none at all
    this.core.clearMachine(); // …and describes its machine anew
    this.client = new AgentClient({
      binary: bin,
      cwd: ws.uri.fsPath,
      maxIterations: cfg.get<number>('maxIterations') || 0,
      onEvent: (e) => this.fromAgent(e),
      onExit: (code, stderrTail) => {
        this.clearInbox(); // nobody listens for this window any more
        this.core.clearMachine();
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

  clearInbox(): void {
    this.core.clearInbox();
  }

  /** "Project: …" in the panel menu: pick one of the account's projects for this folder. */
  bindFlow(): Promise<void> {
    return this.core.bindFlow();
  }

  gotWorkspaces(list: Workspace[]): void {
    this.core.gotWorkspaces(list);
  }

  private fromAgent(e: AgentEvent): void {
    this.core.fromAgent(e);
  }

  private toWebview(e: unknown): void {
    if (this.view && this.uiReady) void this.view.webview.postMessage(e);
    else this.pending.push(e as AgentEvent);
  }

  // ── human actions ───────────────────────────────────────────────

  private fromWebview(m: PanelMessage): void {
    this.core.fromPanel(m);
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
    this.core.newChat();
  }
  /** "ExecAI: Getting started": the steps back on screen, whatever was closed. */
  showStart(): void {
    this.core.showStart();
    this.reveal();
  }
  /** "ExecAI: My machine": the machine card, opened or closed. */
  toggleMachine(): void {
    this.core.toggleMachine();
    this.reveal();
  }
  /** Brings the panel forward — opening it first when it has never been shown. */
  private reveal(): void {
    if (this.view) this.view.show?.(true);
    else void vscode.commands.executeCommand('execai.chat.focus');
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
