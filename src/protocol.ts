// Client for the `execai ide` JSON protocol.
//
// The contract lives in agent-vbai/internal/ide (Protocol = 1): one JSON object
// per line, stdin goes to the agent, stdout comes back from it. Anything meant
// for humans the agent writes to stderr.
//
// This module must not depend on vscode or on node: it is unit-tested on bare
// node, and it also goes into the browser page of `execai ui`. The process
// side (spawning `execai ide`) lives in agentClient.ts.

/** Protocol version this extension speaks. */
export const PROTOCOL = 1;

export interface AskOption {
  value: string;
  label: string;
  description?: string;
}

export interface NamedItem {
  id: string;
  label?: string;
  active?: boolean;
  /** chats: a turn is running in this chat */
  busy?: boolean;
  /** chats: a wake-up is scheduled (RFC 3339) */
  wake?: string;
  /** chats: "web" — the chat was started by a task from the site */
  origin?: string;
}

/** An event from the agent. Which fields are set depends on the event type — see internal/ide. */
export interface AgentEvent {
  type: string;
  /** The chat this event belongs to; absent on process-wide events (state, chats). */
  chat?: string;
  version?: string;
  protocol?: number;
  /** ready: what the agent offers beyond the protocol — "notify": desktop
   *  notifications on request (absent on an older agent) */
  features?: string[];
  model?: string;
  source?: string;
  cwd?: string;
  text?: string;
  id?: string;
  tool?: string;
  summary?: string;
  chunk?: string;
  ok?: boolean;
  /** tool_result: the person refused the call; ok stays true (an older panel shows it as before) */
  denied?: boolean;
  tail?: string;
  question?: string;
  options?: AskOption[];
  paths?: string[];
  elapsed?: number;
  n?: number;
  models?: NamedItem[];
  sources?: NamedItem[];
  efforts?: NamedItem[];
  connectable?: NamedItem[];
  chats?: NamedItem[];
  securities?: NamedItem[];
  security?: string;
  user?: string;
  effort?: string;
  max_iter?: number;
  /** state: the step limit a new subagent gets; absent on an older agent,
   *  which also knows neither extend_agent nor set_subagent_iterations. */
  subagent_iter?: number;
  /** chat_loaded: the saved chat. A message of the person sent with files keeps the whole
   *  prompt in text; a newer agent also says what was typed (said), which files went
   *  with it (files, full paths) and how many pictures the model was given (images). */
  msgs?: { role: string; tool?: string; text: string; said?: string; files?: string[]; images?: number }[];
  /** chat_loaded: a turn is still running in the loaded chat */
  busy?: boolean;
  /** wakeup / chat_loaded: when the chat wakes up (RFC 3339) */
  at?: string;
  /** turn_start / auto_user / chat_meta / chat_loaded: "web" for a task from the site */
  origin?: string;
  /** inbox: the inbox state; state: the same, as a string or an object (see parseInbox) */
  state?: string;
  inbox?: string | Record<string, unknown>;
  owner_pid?: number;
  owner_cwd?: string;
  bound_workspace?: { id?: string; name?: string } | null;
  /** ask_resolved: the question that is closed, and who closed it */
  ask_id?: string;
  by?: string;
  /** workspaces: the account's projects; state may carry them as `workspaces` */
  items?: unknown[];
  workspaces?: unknown[];
  /** ask / ask_user: set when a subagent asks, not the chat's own agent (E101) */
  agent?: { id: string; title?: string };
  /** agent_loaded: the subagent's transcript, its title and state (E101) */
  messages?: { role: string; tool?: string; text: string }[];
  title?: string;
  error?: string;
  /** machine_state: this machine, the getting-started steps, the phone link (E105) — see parseMachineState */
  machine?: unknown;
  tutorial?: unknown;
  phone_url?: unknown;
}

export interface EditorCtx {
  path?: string;
  selection?: string;
  language?: string;
  files?: string[];
}

/** Extra fields of the connect command. A custom provider carries its
 * protocol, name, optional model IDs and extra headers; built-in providers
 * only a key and, rarely, their own base URL. */
export interface ConnectExtra {
  key?: string;
  /** bind: the project to bind this folder to (also sent as value) */
  workspace_id?: string;
  base_url?: string;
  api?: 'openai' | 'anthropic';
  label?: string;
  models?: string[];
  headers?: Record<string, string>;
  /** notify approval: the tool asking (a plain name; the agent drops anything else) */
  tool?: string;
}

/**
 * LineParser accumulates stdout chunks and yields whole JSON lines.
 *
 * It is a separate class because this is the one place where the protocol can
 * break silently: chunks arrive split at arbitrary offsets, and "almost JSON"
 * must wait for its tail instead of blowing up.
 */
export class LineParser {
  private buf = '';

  push(chunk: string): AgentEvent[] {
    this.buf += chunk;
    const out: AgentEvent[] = [];
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // Non-JSON on the protocol channel is an agent bug; surface the line as
        // an error, but keep the parser alive.
        out.push({ type: 'error', text: 'non-JSON on protocol channel: ' + line.slice(0, 200) });
      }
    }
    return out;
  }
}

// ── inbox: tasks from the site (E100.6) ─────────────────────────
//
// Agents that accept tasks from the site report who owns the inbox of this
// machine. Every field is optional on the wire, and an older agent sends none
// of it — the parsers below return null for "nothing to show", so the panel
// keeps its old look against an old agent.

/** Who accepts tasks from the site, as seen by this window's agent. */
export type InboxState =
  | 'listening'      // this window accepts them
  | 'other_serve'    // the background `execai serve` does
  | 'other_ide'      // another editor window does
  | 'no_plan'        // the plan does not include running tasks from the site
  | 'disabled'       // accepting is turned off
  | 'not_logged_in'; // not signed in to ExecAI

export const INBOX_STATES: readonly InboxState[] = [
  'listening', 'other_serve', 'other_ide', 'no_plan', 'disabled', 'not_logged_in',
];

/** A project (workspace) of the ExecAI account. */
export interface Workspace {
  id: string;
  name: string;
}

export interface InboxInfo {
  state: InboxState;
  owner_pid?: number;
  owner_cwd?: string;
  /** The project this folder is bound to; null — not bound. */
  bound_workspace: Workspace | null;
}

/** Where tasks from the site get paid: the plans that include them. Same
 *  page as the agent's plan gate, tagged so the visit is traceable to here. */
export const PAYMENT_URL =
  'https://chat.execai.ru/settings/payment?utm_source=agent&utm_medium=vscode&utm_campaign=inbox';

/** A link as people read it: no scheme, no tracking query. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** One project from the wire: {id, name}, tolerating label/title and workspace_id. */
export function toWorkspace(v: unknown): Workspace | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id) || str(o.workspace_id);
  if (!id) return null;
  return { id, name: str(o.name) || str(o.label) || str(o.title) || id };
}

/**
 * The inbox state carried by an event, or null when the event says nothing
 * about it. Two shapes are accepted: the `inbox` event itself
 * ({state, owner_pid?, owner_cwd?, bound_workspace?}) and a `state` event with
 * an `inbox` field — either the same object or a bare state string, with the
 * rest of the fields next to it. An unknown state is ignored rather than
 * guessed at: a newer agent may add one, and a wrong label is worse than none.
 */
export function parseInbox(e: AgentEvent): InboxInfo | null {
  let src: Record<string, unknown> | null = null;
  if (e.type === 'inbox') {
    src = e as unknown as Record<string, unknown>;
  } else if (e.type === 'state' && e.inbox != null) {
    src = typeof e.inbox === 'string'
      ? { ...(e as unknown as Record<string, unknown>), state: e.inbox }
      : { ...(e as unknown as Record<string, unknown>), ...e.inbox };
  }
  if (!src) return null;
  const state = str(src.state) as InboxState;
  if (!INBOX_STATES.includes(state)) return null;
  const info: InboxInfo = {
    state,
    bound_workspace: toWorkspace(src.bound_workspace),
  };
  const pid = Number(src.owner_pid);
  if (Number.isFinite(pid) && pid > 0) info.owner_pid = pid;
  const cwd = str(src.owner_cwd);
  if (cwd) info.owner_cwd = cwd;
  return info;
}

/**
 * The project list carried by an event, or null when it carries none: the
 * `workspaces` event ({items: [...]}, or {workspaces: [...]}) or a `state`
 * event with a `workspaces` field. An empty array is a real answer — the
 * account has no projects yet.
 */
export function parseWorkspaces(e: AgentEvent): Workspace[] | null {
  let raw: unknown;
  if (e.type === 'workspaces') raw = e.items ?? e.workspaces;
  else if (e.type === 'state') raw = e.workspaces;
  if (!Array.isArray(raw)) return null;
  const out: Workspace[] = [];
  for (const v of raw) {
    const w = toWorkspace(v);
    if (w) out.push(w);
  }
  return out;
}

/** ask_resolved: which question is closed (ask_id, or id as a fallback). */
export function askResolvedId(e: AgentEvent): string {
  return e.ask_id || e.id || '';
}

/**
 * ask_resolved: who closed the question — "web" (answered on the site),
 * "panel" (answered here) or "cancel" (withdrawn: the turn stopped, timed
 * out). Anything else counts as "cancel": a neutral "withdrawn" is true in
 * every case, "answered on the site" would not be.
 */
export function askResolvedBy(e: AgentEvent): 'web' | 'panel' | 'cancel' {
  return e.by === 'web' || e.by === 'panel' ? e.by : 'cancel';
}

/** A chat or an event that belongs to a task from the site. */
export function isWeb(x: { origin?: string } | null | undefined): boolean {
  return !!x && x.origin === 'web';
}

/** The first words of a task for a one-line toast: whole words, an ellipsis when cut. */
export function firstWords(text: string, maxWords = 8, maxChars = 60): string {
  const words = (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  let out = '';
  let n = 0;
  for (const w of words) {
    const next = out ? out + ' ' + w : w;
    if (n >= maxWords || next.length > maxChars) {
      // A single giant "word" (a URL, a path) still shows its beginning.
      return (out || w.slice(0, maxChars)) + '…';
    }
    out = next;
    n++;
  }
  return out;
}

// ── the machine card and the getting-started steps (E105) ───────
//
// On the machine_state command, and by itself after a sign-in, a sign-out,
// a connect, a disconnect or a change of sync, the agent describes this
// machine: what it is, who is signed in, which model sources answered, what
// sync carries, whether the web and the phone can reach it — plus the
// getting-started steps with their ticks and the phone link.
//
// An older agent knows no such command: it answers with an error (or not at
// all), and the panel then shows nothing of it. Every field is optional on
// the wire; parseMachineState fills in safe defaults instead of guessing.

/** The getting-started steps, in the order they are shown. */
export const TUTORIAL_STEP_IDS = ['login', 'models', 'sync', 'project', 'phone'] as const;

export interface MachineSource {
  id: string;
  title: string;
  /** The source answered its last check. */
  alive: boolean;
  /** When it was checked (RFC 3339), '' — unknown. */
  checked_at: string;
}

export interface MachineSync {
  enabled: boolean;
  last_push_at: string;
  /** The config with the provider keys travels (encrypted with the sync password). */
  config: boolean;
  personal_memory_files: number;
  projects: number;
  /** Which projects this machine syncs: all | selected | none; '' — not said. */
  mode: string;
}

export interface MachineInfo {
  id: string;
  name: string;
  os: string;
  version: string;
  logged_in: boolean;
  email_masked: string;
  plan: string;
  sources: MachineSource[];
  sync: MachineSync;
  presence: { listener_running: boolean; reachable_from_web: boolean };
}

export interface TutorialStep {
  id: string;
  done: boolean;
}

export interface MachineState {
  machine: MachineInfo;
  /** Known steps only, in TUTORIAL_STEP_IDS order; [] — the agent sent none. */
  tutorial: TutorialStep[];
  /** The web chat with this machine selected; '' — none, or not a web link. */
  phone_url: string;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

/** A count from the wire: a non-negative integer, 0 for anything else. */
function count(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * The machine_state event, normalized; null for any other event or one
 * without a machine. Flags count only when they are a real true: a wrong
 * tick (or "you are signed in") is worse than a missing one.
 */
export function parseMachineState(e: AgentEvent): MachineState | null {
  if (e.type !== 'machine_state') return null;
  const raw = e.machine;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const sources: MachineSource[] = [];
  for (const v of Array.isArray(m.sources) ? m.sources : []) {
    const o = obj(v);
    const id = str(o.id);
    if (!id) continue;
    sources.push({ id, title: str(o.title) || str(o.label) || id, alive: o.alive === true, checked_at: str(o.checked_at) });
  }
  const sy = obj(m.sync);
  const mode = str(sy.mode);
  const pr = obj(m.presence);
  const machine: MachineInfo = {
    id: str(m.id),
    name: str(m.name),
    os: str(m.os),
    version: str(m.version),
    logged_in: m.logged_in === true,
    email_masked: str(m.email_masked),
    plan: str(m.plan),
    sources,
    sync: {
      enabled: sy.enabled === true,
      last_push_at: str(sy.last_push_at),
      config: sy.config === true,
      personal_memory_files: count(sy.personal_memory_files),
      projects: count(sy.projects),
      mode: mode === 'all' || mode === 'selected' || mode === 'none' ? mode : '',
    },
    presence: { listener_running: pr.listener_running === true, reachable_from_web: pr.reachable_from_web === true },
  };
  // The steps come as {steps: [...]}; a bare list is taken too.
  const t = e.tutorial;
  const list = Array.isArray(t) ? t : Array.isArray(obj(t).steps) ? obj(t).steps as unknown[] : [];
  const seen = new Map<string, boolean>();
  for (const v of list) {
    const o = obj(v);
    const id = str(o.id);
    if ((TUTORIAL_STEP_IDS as readonly string[]).includes(id) && !seen.has(id)) seen.set(id, o.done === true);
  }
  const tutorial = TUTORIAL_STEP_IDS.filter((id) => seen.has(id)).map((id) => ({ id, done: !!seen.get(id) }));
  // The link becomes a QR code and an "open" button: a web link or nothing.
  const url = typeof e.phone_url === 'string' ? e.phone_url.trim() : '';
  const phone_url = /^https?:\/\/[^\s/]+(\/\S*)?$/i.test(url) ? url : '';
  return { machine, tutorial, phone_url };
}

/**
 * An older agent answers an unknown command with a process-wide error that
 * names it ("неизвестная команда: machine_state"). That error is about the
 * panel asking, not about anything the user did, so it is not shown.
 */
export function isMachineStateRefusal(e: AgentEvent): boolean {
  return e.type === 'error' && !e.chat && /\bmachine_state\b/.test(e.text || '');
}

/** An agent answering the notify command with "unknown command: notify". */
export function isNotifyRefusal(e: AgentEvent): boolean {
  return e.type === 'error' && !e.chat && /:\s*notify\s*$/.test(e.text || '');
}

/** The kinds of the notify command; the agent builds the text itself. */
export type NotifyKind = 'turn_done' | 'approval' | 'ask';

/**
 * Messages to the agent — the In side of the ide protocol — as plain objects.
 * The extension writes them to the stdin of `execai ide`, the browser page of
 * `execai ui` posts them to /in: both build them here, so the two cannot
 * drift. Fields left undefined vanish in JSON.stringify.
 */
export const toAgent = {
  /** chat — which chat the message targets; the agent falls back to the active one. */
  user: (text: string, context?: EditorCtx, chat?: string) => ({ type: 'user', text, context, chat }),
  answer: (id: string, value: string) => ({ type: 'answer', id, value }),
  stop: (chat?: string) => ({ type: 'stop', chat }),
  newChat: () => ({ type: 'new_chat' }),
  command: (name: string, value?: string, extra?: ConnectExtra, chat?: string) =>
    ({ type: 'command', name, value, ...extra, chat }),
};

/** What the panel logic needs from a running agent, whatever carries the bytes. */
export interface AgentPort {
  readonly alive: boolean;
  sendUser(text: string, context?: EditorCtx, chat?: string): void;
  sendAnswer(id: string, value: string): void;
  stop(chat?: string): void;
  newChat(): void;
  sendCommand(name: string, value?: string, extra?: ConnectExtra, chat?: string): void;
}

/** An AgentPort over any sender of In messages (the browser posts them over HTTP). */
export function portOver(send: (m: object) => void, alive: () => boolean = () => true): AgentPort {
  return {
    get alive() { return alive(); },
    sendUser: (text, context, chat) => send(toAgent.user(text, context, chat)),
    sendAnswer: (id, value) => send(toAgent.answer(id, value)),
    stop: (chat) => send(toAgent.stop(chat)),
    newChat: () => send(toAgent.newChat()),
    sendCommand: (name, value, extra, chat) => send(toAgent.command(name, value, extra, chat)),
  };
}
