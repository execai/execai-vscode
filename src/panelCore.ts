// The routing half of the chat panel, shared by the VS Code extension and the
// browser page of `execai ui`.
//
// The panel page (webviewHtml.ts) speaks a small message set of its own, the
// agent speaks the ide protocol. PanelCore sits between the two: it decides
// which chat is on screen, keeps the tab badges, turns the panel's messages
// into ide-protocol input, raises toasts for chats that are not on screen and
// runs the few dialogs (project binding, connecting a source, the iteration
// limit). Whatever differs between an editor and a browser — dialogs, toasts,
// the status line, files, storage — goes through PanelHost.
//
// The extension (chatView.ts) and the browser (browserHost.ts) both run this
// very class, so a routing fix lands in both at once.

import {
  AgentEvent, AgentPort, EditorCtx, InboxInfo, Workspace, PAYMENT_URL, PROTOCOL,
  displayUrl, parseInbox, parseWorkspaces, isWeb, firstWords,
} from './protocol';

export interface PickItem {
  label: string;
  description?: string;
  detail?: string;
}

export interface PickOptions {
  title?: string;
  placeHolder?: string;
  ignoreFocusOut?: boolean;
}

export interface InputOptions {
  title?: string;
  prompt?: string;
  placeHolder?: string;
  value?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  /** An error text for a bad value, or null/undefined when it is fine. */
  validateInput?: (value: string) => string | null | undefined;
}

/** Everything PanelCore needs from where it runs. */
export interface PanelHost {
  /** Translations, keyed by the English text (vscode.l10n in the editor). */
  l10n: { t(message: string, ...args: (string | number | boolean)[]): string };
  /** The running agent, or null. */
  agent(): AgentPort | null;
  /** (Re)start the agent; the browser has nothing to start. */
  startAgent(): void;
  /** A working directory is open (the agent needs one). */
  hasFolder(): boolean;
  /** An event for the panel page. */
  post(e: unknown): void;
  /** The panel page is listening: flush what was queued, start the stream. */
  uiReady(): void;
  /** The status line: the editor status bar, or the header of the page. */
  status(text: string, tooltip?: string): void;
  /** A toast; resolves with the action picked, or undefined. */
  info(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  warn(message: string): void;
  /** Bring the panel forward (a question is waiting). */
  reveal(): void;
  openExternal(url: string): void;
  copy(text: string): void;
  /** Per-project storage: workspaceState in the editor, localStorage in a browser. */
  memo: { get<T>(key: string, def: T): T; set(key: string, value: unknown): void };
  pick<T extends PickItem>(items: T[], opts: PickOptions): PromiseLike<T | undefined>;
  input(opts: InputOptions): PromiseLike<string | undefined>;
  resumeLastChat(): boolean;
  /** The active file and selection; undefined when there is none or it is off. */
  editorContext(): EditorCtx | undefined;
  pickFiles(): void;
  attachPaths(paths: string[]): void;
  pasteBlob(name: string, dataURL: string): void;
  openFile(path: string, line?: string): void;
  openTerminal(): void;
  checkUpdates(): void;
  /**
   * The browser gets `ready` again on every reconnect of its event stream:
   * there it must reopen the chat on screen, not jump to the last one.
   */
  keepChatOnReady?: boolean;
  /**
   * Several pages share one agent and see every event (browser tabs of
   * `execai ui`): a chat_loaded / chat_reset switches this page only when it
   * asked for it, or when it shows that chat already, or shows none yet.
   */
  sharedStream?: boolean;
}

/** A message from the panel page (see the postMessage calls in webviewHtml.ts). */
export interface PanelMessage {
  type: string;
  text?: string;
  id?: string;
  value?: string;
  path?: string;
  line?: string;
  files?: string[];
  name?: string;
  paths?: string[];
  dataURL?: string;
}

type Flags = { busy?: boolean; unseen?: boolean; asking?: boolean; wake?: string; web?: boolean };

export class PanelCore {
  // Which chat the panel shows. The agent runs several chats at once and tags
  // every event with its chat; only the active one is rendered, the rest only
  // move the tab badges (and raise a toast when they need the user).
  activeChat: string | null = null;
  /** The last state event — the dialogs read the current values from it. */
  lastState: AgentEvent | null = null;
  // Project-picker requests waiting for the agent's project list.
  wsWaiters: ((list: Workspace[]) => void)[] = [];

  private flags = new Map<string, Flags>();
  private chatLabels = new Map<string, string>();
  // Tasks from the site (E100.6). inbox stays null until the agent reports it:
  // an older agent never does, and then nothing about the inbox is shown.
  private inbox: InboxInfo | null = null;
  // Chats from the site whose task has not arrived yet / was already toasted.
  private webPending = new Set<string>();
  private webToasted = new Set<string>();
  // The agent has reported subagents at least once (E101): it knows
  // list_agents. An older agent answers an unknown command with an error, so
  // the command is never sent before this.
  private fleetSeen = false;
  // sharedStream: the switches this page asked for, still to arrive.
  private expectChats = new Set<string>();
  private expectNew = 0;
  private resumePending = false;
  private adopted = false;

  /** Status line without the inbox and "turn…" suffixes. Kept as a field, not
   *  scraped back out of the text: the suffixes are translated, and a regex
   *  over them would only match one language. */
  private statusMain = 'ExecAI';
  private statusTurn = false;

  constructor(private readonly h: PanelHost) {}

  /**
   * The agent, as every call here reaches it. On a shared stream it also
   * notes which chat switches this page asked for (see sharedStream).
   */
  private agent(): AgentPort | null {
    const a = this.h.agent();
    if (!a || !this.h.sharedStream) return a;
    return {
      get alive() { return a.alive; },
      sendUser: (text, context, chat) => a.sendUser(text, context, chat),
      sendAnswer: (id, value) => a.sendAnswer(id, value),
      stop: (chat) => a.stop(chat),
      newChat: () => { this.expectNew++; a.newChat(); },
      sendCommand: (name, value, extra, chat) => {
        if (name === 'load_chat' && value) this.expectChats.add(value);
        if (name === 'resume_last') this.resumePending = true;
        a.sendCommand(name, value, extra, chat);
      },
    };
  }

  /** Whether a chat_loaded / chat_reset switches this page (always, unless shared). */
  private takesSwitch(e: AgentEvent): boolean {
    if (!this.h.sharedStream) return true;
    const id = e.chat || '';
    if (e.type === 'chat_loaded') this.resumePending = false;
    if (e.type === 'chat_loaded' && this.expectChats.delete(id)) return true;
    if (e.type === 'chat_reset' && this.expectNew > 0) { this.expectNew--; return true; }
    return this.activeChat === null || id === this.activeChat;
  }

  // ── the status line ─────────────────────────────────────────────

  private paintStatus(): void {
    const inbox = this.inboxStatus();
    let text = this.statusMain;
    if (inbox) text += ' · ' + inbox.text;
    if (this.statusTurn) text += ' · ' + this.h.l10n.t('turn…');
    this.h.status(text, inbox?.tooltip);
  }

  /** The inbox part of the status line: a short label plus the full story in the tooltip. */
  private inboxStatus(): { text: string; tooltip: string } | null {
    const i = this.inbox;
    if (!i) return null;
    const l10n = this.h.l10n;
    let short: string;
    let long: string;
    switch (i.state) {
      case 'listening':
        short = l10n.t('web: on');
        long = l10n.t('Tasks from the web are accepted in this window.');
        break;
      case 'other_serve':
        short = l10n.t('web: serve');
        long = l10n.t('Tasks from the web are accepted by the background execai serve. To accept them here: the panel menu → Accept here.');
        break;
      case 'other_ide':
        short = l10n.t('web: other window');
        long = l10n.t('Tasks from the web are accepted by another window: {0}', i.owner_cwd || '?');
        break;
      case 'no_plan':
        short = l10n.t('web: plan needed');
        long = l10n.t('Running tasks from the web is available on the Work and Max plans: {0}', displayUrl(PAYMENT_URL));
        break;
      case 'disabled':
        short = l10n.t('web: off');
        long = l10n.t('Accepting tasks from the web is turned off.');
        break;
      case 'not_logged_in':
        short = l10n.t('web: sign in');
        long = l10n.t('Sign in to ExecAI to accept tasks from the web.');
        break;
    }
    if (i.bound_workspace) long += '\n' + l10n.t('Project: {0}', i.bound_workspace.name);
    return { text: '$(globe) ' + short, tooltip: long };
  }

  // ── tasks from the site: the inbox and the project binding ──────

  private setInbox(info: InboxInfo): void {
    this.inbox = info;
    this.paintStatus();
    // The panel gets one normalized shape, whatever the agent sent.
    this.h.post({ type: 'inbox', ...info });
    this.maybeBindHint(info);
  }

  clearInbox(): void {
    if (!this.inbox) return;
    this.inbox = null;
    this.h.post({ type: 'inbox', state: '' });
  }

  /** Once per project: accepting works, but no project is bound, so the site
   *  has nowhere to send tasks for this folder. */
  private maybeBindHint(info: InboxInfo): void {
    if (info.state !== 'listening' || info.bound_workspace) return;
    const key = 'execai.inboxBindHintShown';
    if (this.h.memo.get<boolean>(key, false)) return;
    this.h.memo.set(key, true);
    const bind = this.h.l10n.t('Bind a project…');
    void this.h.info(this.h.l10n.t('Bind a project to run tasks from the web.'), bind)
      .then((p) => { if (p === bind) void this.bindFlow(); });
  }

  gotWorkspaces(list: Workspace[]): void {
    const waiters = this.wsWaiters;
    this.wsWaiters = [];
    for (const w of waiters) w(list);
  }

  /** The next project list from the agent, or null if none comes in time. */
  private awaitWorkspaces(ms: number): Promise<Workspace[] | null> {
    return new Promise((resolve) => {
      const done = (list: Workspace[]) => { clearTimeout(timer); resolve(list); };
      const timer = setTimeout(() => {
        this.wsWaiters = this.wsWaiters.filter((w) => w !== done);
        resolve(null);
      }, ms);
      this.wsWaiters.push(done);
    });
  }

  /** "Project: …" in the panel menu: pick one of the account's projects for this folder. */
  async bindFlow(): Promise<void> {
    const l10n = this.h.l10n;
    const agent = this.agent();
    if (!agent?.alive) {
      this.h.startAgent();
      this.h.post({ type: 'notice', text: l10n.t('The agent is starting — repeat the action in a moment.') });
      return;
    }
    const wait = this.awaitWorkspaces(10000);
    agent.sendCommand('list_workspaces');
    const list = await wait;
    if (!list) {
      this.h.warn(l10n.t('The agent did not send the project list — try again in a moment.'));
      return;
    }
    if (!list.length) {
      const open = l10n.t('Open execai.ru');
      void this.h.info(
        l10n.t('Your ExecAI account has no projects yet — create one on the site, then bind it here.'), open,
      ).then((p) => { if (p === open) this.h.openExternal('https://execai.ru'); });
      return;
    }
    const cur = this.inbox?.bound_workspace?.id;
    const picked = await this.h.pick(
      list.map((w) => ({
        label: (w.id === cur ? '$(check) ' : '') + w.name,
        description: w.id === cur ? l10n.t('bound') : undefined,
        id: w.id,
      })),
      {
        title: l10n.t('Bind this folder to a project'),
        placeHolder: l10n.t('Tasks from the web for this project will run in this folder'),
        ignoreFocusOut: true,
      },
    );
    if (!picked || picked.id === cur) return;
    this.agent()?.sendCommand('bind', picked.id, { workspace_id: picked.id });
  }

  // ── agent → panel ───────────────────────────────────────────────

  fromAgent(e: AgentEvent): void {
    // The inbox state and the project list are taken here: the panel gets the
    // inbox in one normalized shape, the list goes to the project picker.
    const inbox = parseInbox(e);
    if (inbox) this.setInbox(inbox);
    const projects = parseWorkspaces(e);
    if (projects) this.gotWorkspaces(projects);
    if (e.type === 'inbox' || e.type === 'workspaces') return;

    // Subagents (E101) belong to the process, not to the chat on screen: the
    // list is drawn whatever chat is open, and a transcript is opened on
    // request. Neither may be filtered out as "another chat".
    if (e.type === 'agents' || e.type === 'agent_loaded') {
      if (e.type === 'agents') this.fleetSeen = true;
      this.h.post(e);
      return;
    }

    if (e.type === 'chats') {
      let web = false;
      for (const c of e.chats || []) {
        this.chatLabels.set(c.id, c.label || '');
        if (isWeb(c) && !this.flag(c.id).web) { this.flag(c.id).web = true; web = true; }
      }
      if (web) this.pushFlags();
      if (this.h.sharedStream) {
        // The agent's "active" is whichever page switched last; this page
        // marks the chat it shows itself.
        const chats = (e.chats || []).map((c) => ({ ...c, active: !!this.activeChat && c.id === this.activeChat }));
        // A page that came up while another one holds the last chat gets
        // nothing from resume_last: it opens the chat the agent has active.
        const cur = (e.chats || []).find((c) => c.active);
        if (this.activeChat === null && !this.resumePending && !this.adopted && cur) {
          this.adopted = true;
          this.agent()?.sendCommand('load_chat', cur.id);
        }
        this.h.post({ ...e, chats });
        return;
      }
    }
    // resume_last that had nothing to open answers with a plain notice.
    if (this.resumePending && !e.chat && (e.type === 'notice' || e.type === 'error')) this.resumePending = false;
    if (e.chat) {
      // chat_loaded / chat_reset say which chat the panel shows from now on.
      if ((e.type === 'chat_loaded' || e.type === 'chat_reset') && this.takesSwitch(e)) {
        this.activeChat = e.chat;
        const f = this.flag(e.chat);
        f.unseen = false; f.asking = false;
        this.pushFlags();
      }
      this.noteFlags(e);
      this.noteWebTask(e);
      if (e.chat !== this.activeChat) {
        this.backgroundEvent(e);
        return;
      }
    }
    const l10n = this.h.l10n;
    const agent = this.agent();
    switch (e.type) {
      case 'ready': {
        const keep = this.h.keepChatOnReady ? this.activeChat : null;
        this.activeChat = null;
        this.adopted = false;
        this.flags.clear();
        this.statusMain = `ExecAI: ${e.model ?? '?'} · ${e.source ?? ''}`;
        this.statusTurn = false;
        this.paintStatus();
        // Ask for state right away: the model/source pickers must not wait for a click.
        agent?.sendCommand('state');
        // The last chat of this project continues by itself: the editor is a
        // place people come back to. Turned off by a setting for those who
        // want a clean slate every time.
        if (keep) agent?.sendCommand('load_chat', keep);
        else if (this.h.resumeLastChat()) agent?.sendCommand('resume_last');
        // A restarted agent has a fleet of its own; ask for it once the agent
        // is known to speak the fleet protocol.
        if (this.fleetSeen) agent?.sendCommand('list_agents');
        if ((e.protocol ?? 0) > PROTOCOL) {
          this.h.post({
            type: 'notice',
            text: l10n.t('This execai is newer than the extension — update the extension, some events may not render.'),
          });
        }
        break;
      }
      case 'turn_start':
        this.statusTurn = true;
        this.paintStatus();
        break;
      case 'done':
        this.statusTurn = false;
        this.paintStatus();
        break;
      case 'ask':
      case 'ask_user':
        // The user may be in another editor tab — bring the panel forward.
        this.h.reveal();
        break;
      case 'login_start': {
        // The link opens by itself, but it must also be takeable by hand: over
        // SSH nothing opens, and the sign-in may happen in a browser on a
        // different machine. The panel shows the same link with a copy button.
        const uri = e.text || '';
        const copy = l10n.t('Copy link');
        void this.h.info(
          l10n.t('Confirm the sign-in: code {0}', e.id ?? ''),
          l10n.t('Open in browser'), copy,
        ).then((p) => {
          if (p === copy) this.h.copy(uri);
          else if (p && uri) this.h.openExternal(uri);
        });
        if (uri) this.h.openExternal(uri);
        break;
      }
      case 'login_done':
        void this.h.info(l10n.t('ExecAI: signed in as {0}', e.text || ''));
        break;
      case 'state':
        this.lastState = e;
        this.statusMain = `ExecAI: ${e.model ?? '?'} · ${e.source ?? ''}`;
        this.paintStatus();
        break;
    }
    this.h.post(e);
  }

  private flag(chat: string): Flags {
    let f = this.flags.get(chat);
    if (!f) { f = {}; this.flags.set(chat, f); }
    return f;
  }

  /** Tab badges for every chat — the panel draws them on the strip. */
  private pushFlags(): void {
    const flags: Record<string, unknown> = {};
    for (const [id, f] of this.flags) flags[id] = f;
    this.h.post({ type: 'chat_flags', flags });
  }

  /** Keeps per-chat state in step with the stream, active chat included. */
  private noteFlags(e: AgentEvent): void {
    if (!e.chat) return;
    const f = this.flag(e.chat);
    let changed = true;
    switch (e.type) {
      case 'turn_start': f.busy = true; f.asking = false; if (isWeb(e)) f.web = true; break;
      case 'done': f.busy = false; f.asking = false; if (e.chat !== this.activeChat) f.unseen = true; break;
      case 'ask': case 'ask_user': f.asking = true; break;
      // The question was answered on the site: nothing to wait for here.
      case 'ask_resolved': f.asking = false; break;
      case 'chat_meta': if (isWeb(e)) f.web = true; else changed = false; break;
      case 'wakeup': f.wake = e.at || ''; break;
      case 'wakeup_cancelled': f.wake = ''; break;
      case 'chat_loaded': f.busy = !!e.busy; f.wake = e.at || ''; if (isWeb(e)) f.web = true; break;
      default: changed = false;
    }
    if (changed) this.pushFlags();
  }

  private chatName(id: string): string {
    const name = (this.chatLabels.get(id) || '').trim() || this.h.l10n.t('untitled chat');
    return this.flags.get(id)?.web ? '\u{1F310} ' + name : name;
  }

  /**
   * A task from the site arrives as a new chat: turn_start tagged origin=web,
   * then its prompt as auto_user. The prompt raises a toast with "Open" —
   * once per chat, so a replay on switching to it stays quiet.
   */
  private noteWebTask(e: AgentEvent): void {
    const chat = e.chat;
    if (!chat || this.webToasted.has(chat)) return;
    if (e.type === 'turn_start' && isWeb(e)) {
      if (!this.webPending.has(chat)) {
        this.webPending.add(chat);
        // Nobody asked for this chat — fetch the list so its tab shows up now.
        this.agent()?.sendCommand('list_chats');
      }
    } else if (e.type === 'auto_user' && (isWeb(e) || this.webPending.has(chat))) {
      this.webPending.delete(chat);
      this.webToasted.add(chat);
      this.webTaskToast(chat, e.text || '');
    } else if (e.type === 'done') {
      this.webPending.delete(chat);
    }
  }

  private webTaskToast(chat: string, text: string): void {
    const l10n = this.h.l10n;
    const open = l10n.t('Open');
    void this.h.info(
      l10n.t('A task came in from the web: {0}', firstWords(text) || this.chatName(chat)), open,
    ).then((p) => {
      if (p !== open) return;
      this.h.reveal();
      if (chat !== this.activeChat) this.agent()?.sendCommand('load_chat', chat);
    });
  }

  /** An event from a chat that is not on screen: badges, plus a toast when it needs a human. */
  private backgroundEvent(e: AgentEvent): void {
    const l10n = this.h.l10n;
    const open = l10n.t('Open');
    const show = (msg: string) => {
      void this.h.info(msg, open).then((p) => {
        if (p !== open || !e.chat) return;
        this.h.reveal();
        this.agent()?.sendCommand('load_chat', e.chat);
      });
    };
    switch (e.type) {
      case 'done':
        if (e.text === 'stopped') break;
        show(l10n.t('Chat «{0}» finished its turn.', this.chatName(e.chat || '')));
        break;
      case 'ask':
      case 'ask_user':
        // A subagent asks through its parent's chat: name it, or the toast
        // points at a chat that never asked anything itself.
        if (e.agent && (e.agent.title || e.agent.id)) {
          show(l10n.t('Subagent «{0}» in chat «{1}» is waiting for your answer.',
            e.agent.title || e.agent.id, this.chatName(e.chat || '')));
        } else {
          show(l10n.t('Chat «{0}» is waiting for your answer.', this.chatName(e.chat || '')));
        }
        break;
      case 'error':
        show(l10n.t('Chat «{0}»: {1}', this.chatName(e.chat || ''), e.text || ''));
        break;
    }
  }

  // ── panel → agent ───────────────────────────────────────────────

  fromPanel(m: PanelMessage): void {
    const l10n = this.h.l10n;
    switch (m.type) {
      case 'ui_ready': {
        this.h.uiReady();
        const tabs = this.h.memo.get<string>('execai.tabs', '');
        if (tabs) this.h.post({ type: 'tabs_state', text: tabs });
        break;
      }
      case 'send': {
        if (!this.agent()?.alive) this.h.startAgent();
        const ctx = this.h.editorContext() ?? {};
        if (m.files?.length) ctx.files = m.files;
        this.agent()?.sendUser(m.text || '', ctx, this.activeChat ?? undefined);
        // The auto-attached context must be visible: the agent knowing about a
        // file the chat never showed reads as spooky action at a distance —
        // "the AI sees my file but the panel shows nothing".
        if (ctx.path) {
          this.h.post({
            type: 'context_attached',
            text: ctx.selection
              ? l10n.t('{0} + selection (active file)', ctx.path)
              : l10n.t('{0} (active file)', ctx.path),
          });
        }
        break;
      }
      case 'pick_files':
        this.h.pickFiles();
        break;
      case 'pick_workspace':
        void this.bindFlow();
        break;
      case 'tabs_state':
        // Which chat tabs are on the strip and in what order is a property of
        // this project, not of the agent: it survives a reload here.
        this.h.memo.set('execai.tabs', m.text || '');
        break;
      case 'copy_text':
        this.h.copy(m.text || '');
        break;
      case 'attach_paths':
        this.h.attachPaths(m.paths || []);
        break;
      case 'paste_blob':
        this.h.pasteBlob(m.name || 'clipboard.bin', m.dataURL || '');
        break;
      case 'agent_command': {
        const agent = this.agent();
        if (!agent?.alive) {
          // A dead agent used to swallow commands in silence while the panel
          // kept its optimism. Say what is actually wrong instead.
          if (!this.h.hasFolder()) {
            this.h.post({ type: 'error', text: l10n.t('Open a project folder — the agent needs a working directory.') });
          } else {
            this.h.startAgent();
            this.h.post({ type: 'notice', text: l10n.t('The agent is starting — repeat the action in a moment.') });
          }
          break;
        }
        if (m.name === 'connect') { void this.connectFlow(m.value || ''); break; }
        if (m.name === 'set_max_iterations' && !m.value) { void this.maxIterFlow(); break; }
        if (m.name === 'set_subagent_iterations' && !m.value) { void this.subagentIterFlow(); break; }
        if (m.name === 'cancel_wakeup' || m.name === 'wake_now') {
          agent.sendCommand(m.name, m.value || this.activeChat || '');
          break;
        }
        agent.sendCommand(m.name || '', m.value);
        break;
      }
      case 'new_chat_ui':
        this.newChat();
        break;
      case 'open_terminal':
        this.h.openTerminal();
        break;
      case 'check_updates':
        this.h.checkUpdates();
        break;
      case 'answer':
        this.agent()?.sendAnswer(m.id || '', m.value || '');
        break;
      case 'stop':
        this.agent()?.stop(this.activeChat ?? undefined);
        break;
      case 'new_chat':
        this.agent()?.newChat();
        break;
      case 'open_file':
        if (m.path) this.h.openFile(m.path, m.line);
        break;
      case 'open_external': {
        // Links in an answer are text the model produced — only the schemes a
        // chat has any business opening are followed.
        const url = m.text || '';
        if (/^(https?:|mailto:)/i.test(url)) this.h.openExternal(url);
        break;
      }
      case 'restart':
        this.h.startAgent();
        break;
    }
  }

  newChat(): void {
    this.agent()?.newChat();
    this.h.post({ type: 'chat_reset' });
  }

  // ── dialogs ─────────────────────────────────────────────────────

  /** Connecting a source: the key is asked for in an input box. */
  async connectFlow(provider: string): Promise<void> {
    if (provider === 'custom') { await this.customProviderFlow(); return; }
    const l10n = this.h.l10n;
    const noKey = provider === 'claude-cli' || provider === 'codex-cli';
    let key: string | undefined;
    if (!noKey) {
      key = await this.h.input({
        title: l10n.t('Key for {0}', provider),
        prompt: provider === 'ollama'
          ? l10n.t('An ollama.com key for the cloud; leave empty for a local Ollama')
          : l10n.t('Provider key — stored on this machine only'),
        password: true,
        ignoreFocusOut: true,
      });
      // Cancelling the box (Esc) is a refusal to connect, not an empty key.
      if (key === undefined && provider !== 'ollama') return;
    }
    this.agent()?.sendCommand('connect', provider, { key: key || '' });
  }

  /**
   * A custom provider: any endpoint that speaks the OpenAI or the Anthropic
   * protocol. Asked in the same order as `/connect custom` in the terminal —
   * name, protocol, address, key — plus the model IDs for an endpoint that
   * has no /models route. Esc at any step cancels; nothing is sent.
   */
  async customProviderFlow(): Promise<void> {
    const l10n = this.h.l10n;
    const title = (step: number) => l10n.t('Custom provider ({0}/5)', step);
    const name = await this.h.input({
      title: title(1),
      prompt: l10n.t('Name — it becomes the source id, e.g. LM Studio, vLLM, deepseek'),
      placeHolder: 'LM Studio',
      ignoreFocusOut: true,
      validateInput: (t) =>
        /[a-z0-9]/i.test(t) ? null : l10n.t('use latin letters or digits'),
    });
    if (name === undefined) return;

    const api = await this.h.pick(
      [
        {
          label: l10n.t('OpenAI-compatible'),
          description: '…/chat/completions',
          detail: 'LM Studio, vLLM, llama.cpp, LiteLLM, DeepSeek, Groq, Together, Mistral…',
          value: 'openai' as const,
        },
        {
          label: l10n.t('Anthropic-compatible'),
          description: '…/v1/messages',
          detail: l10n.t('LiteLLM, Claude gateways, MiniMax, DeepSeek…'),
          value: 'anthropic' as const,
        },
      ],
      { title: title(2), placeHolder: l10n.t('Interface type'), ignoreFocusOut: true },
    );
    if (!api) return;

    const baseUrl = await this.h.input({
      title: title(3),
      prompt: api.value === 'anthropic'
        ? l10n.t('Server address without /v1/messages, e.g. https://llm.corp.local')
        : l10n.t('Server address, e.g. http://localhost:1234/v1 or https://api.deepseek.com'),
      placeHolder: api.value === 'anthropic' ? 'https://llm.corp.local' : 'http://localhost:1234/v1',
      ignoreFocusOut: true,
      validateInput: (t) => {
        const v = t.trim();
        if (!v) return l10n.t('an address is required');
        return /^(https?:\/\/)?[^\s/]+(\/\S*)?$/i.test(v) ? null : l10n.t('not an http(s) address');
      },
    });
    if (baseUrl === undefined) return;

    const key = await this.h.input({
      title: title(4),
      prompt: l10n.t('API key — leave empty if the server needs none. Stored on this machine only'),
      password: true,
      ignoreFocusOut: true,
    });
    if (key === undefined) return;

    const models = await this.h.input({
      title: title(5),
      prompt: l10n.t("Model IDs separated by commas — leave empty to take the server's own list"),
      placeHolder: 'qwen3-coder, llama-4',
      ignoreFocusOut: true,
    });
    if (models === undefined) return;

    this.agent()?.sendCommand('connect', 'custom', {
      label: name.trim(),
      api: api.value,
      base_url: baseUrl.trim(),
      key: key.trim(),
      models: models.split(',').map((m) => m.trim()).filter(Boolean),
    });
  }

  /** Iteration limit — a plain number. */
  async maxIterFlow(): Promise<void> {
    const l10n = this.h.l10n;
    const cur = this.lastState?.max_iter ?? 50;
    const v = await this.h.input({
      title: l10n.t('Tool iteration limit per turn'),
      value: String(cur),
      ignoreFocusOut: true,
      validateInput: (t) =>
        /^[1-9]\d*$/.test(t.trim()) ? null : l10n.t('a positive number is required'),
    });
    if (v) this.agent()?.sendCommand('set_max_iterations', v.trim());
  }

  /** Step limit of a new subagent — 1..100; the agent keeps it in its config. */
  async subagentIterFlow(): Promise<void> {
    const l10n = this.h.l10n;
    const cur = this.lastState?.subagent_iter ?? 50;
    const v = await this.h.input({
      title: l10n.t('Step limit of a new subagent'),
      prompt: l10n.t('From 1 to 100. A running subagent can be given more steps in the Agents block.'),
      value: String(cur),
      ignoreFocusOut: true,
      validateInput: (t) => {
        const n = /^\d+$/.test(t.trim()) ? Number(t.trim()) : 0;
        return n >= 1 && n <= 100 ? null : l10n.t('a number from 1 to 100 is required');
      },
    });
    if (v) this.agent()?.sendCommand('set_subagent_iterations', String(Number(v.trim())));
  }
}
