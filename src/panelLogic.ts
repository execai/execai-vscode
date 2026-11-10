// Pure pieces of the panel script that are worth testing on their own.
//
// Each function here is injected into the webview through toString(), the
// same way as renderMarkdown, so the panel and the tests run one and the same
// code. That puts two rules on everything in this file:
//   - a function must be self-contained: no imports, no module-level helpers
//     or constants (the release build is minified, and a reference to another
//     top-level name would point at a renamed identifier the panel lacks);
//   - it must not touch the DOM: it returns data, the panel draws it.

/** One row of the inbox section of the panel menu. */
export interface InboxMenuEntry {
  /** Stable test anchor (data-mi): the label is translated. */
  key: string;
  label: string;
  /** Small text on the right. */
  extra?: string;
  /** A status line rather than a command. */
  info?: boolean;
  /** What a click posts to the extension; absent — the row is not clickable. */
  msg?: { type: string; name?: string; text?: string };
}

/** The inbox as the extension forwards it to the panel (see parseInbox). */
export interface InboxView {
  state: string;
  owner_pid?: number;
  owner_cwd?: string;
  bound_workspace?: { id: string; name: string } | null;
}

/**
 * The inbox section of the panel menu: a status line for each of the six
 * states, plus what can be done about it — take the inbox over from
 * `execai serve`, sign in, pick a plan, bind or unbind the project.
 *
 * No inbox (an older agent never reports one) or an unknown state gives an
 * empty list: the section is not drawn at all.
 */
export function inboxMenuEntries(
  v: InboxView | null,
  T: Record<string, string>,
  paymentUrl: string,
): InboxMenuEntry[] {
  if (!v || !v.state) return [];
  const cmd = (name: string) => ({ type: 'agent_command', name });
  const out: InboxMenuEntry[] = [];
  switch (v.state) {
    case 'listening':
      out.push({ key: 'inbox', info: true, label: T.inboxListening });
      break;
    case 'other_serve':
      out.push({
        key: 'inbox', info: true,
        label: T.inboxOtherServe + (v.owner_pid ? ' (pid ' + v.owner_pid + ')' : ''),
      });
      out.push({ key: 'inbox_take', label: T.inboxTake, msg: cmd('inbox_take') });
      break;
    case 'other_ide':
      // Taking the inbox over from another window is not offered (yet): two
      // windows fighting over it would be worse than a clear pointer.
      out.push({ key: 'inbox', info: true, label: T.inboxOtherIde + (v.owner_cwd || '?') });
      break;
    case 'no_plan':
      out.push({ key: 'inbox', info: true, label: T.inboxNoPlan });
      out.push({
        key: 'inbox_plans', label: T.inboxPlans,
        // Shown without the scheme and the tracking query; the click opens the full link.
        extra: paymentUrl.replace(/^https?:\/\//, '').replace(/[?#].*$/, ''),
        msg: { type: 'open_external', text: paymentUrl },
      });
      break;
    case 'disabled':
      out.push({ key: 'inbox', info: true, label: T.inboxDisabled });
      break;
    case 'not_logged_in':
      // The status line is the action itself: the usual sign-in.
      out.push({ key: 'inbox', info: true, label: T.inboxNotLoggedIn, msg: cmd('login') });
      break;
    default:
      return [];
  }
  // Binding is an account call — pointless without a sign-in or a plan.
  if (v.state !== 'not_logged_in' && v.state !== 'no_plan') {
    const ws = v.bound_workspace;
    out.push({
      key: 'project',
      label: T.mProject + ': ' + (ws ? ws.name : T.projectNone),
      msg: { type: 'pick_workspace' },
    });
    if (ws) out.push({ key: 'unbind', label: T.mUnbind, msg: cmd('unbind') });
  }
  return out;
}

// ── subagents (E101) ────────────────────────────────────────────

/** One subagent as the agent reports it in the `agents` event (the fleet contract). */
export interface AgentRecord {
  id: string;
  parent_chat?: string;
  parent_tool_call?: string;
  title?: string;
  /** queued | running | waiting | done | failed | cancelled */
  state?: string;
  mode?: string;
  /** Steps made so far, a continuation included. */
  iter?: number;
  /** The step limit; grows when the subagent is given more steps. */
  max_iter?: number;
  /** Finished (state "done") because it ran out of steps: extend_agent continues it. */
  exhausted?: boolean;
  last_tool?: string;
  started_at?: string;
  updated_at?: string;
  finished_at?: string;
  preview?: string;
  session?: string;
  source?: string;
  model?: string;
  prompt_tokens?: number;
  error?: string;
}

/** A row of the "Agents" block, ready to draw. */
export interface FleetRow {
  id: string;
  title: string;
  state: string;
  /** Still going: queued, running or waiting for an answer. */
  active: boolean;
  icon: string;
  /** "step 3/50 · 47 left · bash · 1:05" while it goes, "3/50 · bash · 1:05"
   *  once finished — steps, last tool, how long it has run. */
  meta: string;
  /** Steps left while it goes; -1 when the limit is unknown or it has finished. */
  left: number;
  /** Going and 5 steps or fewer left: drawn as a warning. */
  low: boolean;
  /** Ran out of steps (see AgentRecord.exhausted): can be continued. */
  exhausted: boolean;
  /** The tooltip: state, model, tokens, the last words, the error. */
  tip: string;
  parent: string;
  updated: string;
}

export interface FleetView {
  rows: FleetRow[];
  running: number;
  done: number;
  failed: number;
  /** Subagents still going, per parent chat — the "2▶" badge on its tab. */
  perChat: Record<string, number>;
}

/**
 * The "Agents" block from an `agents` snapshot: rows in a stable order (the
 * ones still going first, in the order they started; then the finished ones,
 * newest first), counts for the header and per-chat badges.
 *
 * An unknown state (a newer agent may add one) is drawn neutrally and counted
 * nowhere; a missing time just leaves the duration out. A row still going
 * says how many steps it has left; one that ran out of steps says so.
 */
export function fleetView(
  items: AgentRecord[] | null | undefined,
  now: number,
  T: Record<string, string>,
): FleetView {
  const ICONS: Record<string, string> = {
    queued: '◷', running: '▶', waiting: '?',
    done: '✓', failed: '✗', cancelled: '■',
  };
  const LABELS: Record<string, string> = {
    queued: T.agQueued, running: T.agRunning, waiting: T.agWaiting,
    done: T.agDone, failed: T.agFailed, cancelled: T.agCancelled,
  };
  const ms = (iso?: string) => {
    const t = iso ? Date.parse(iso) : NaN;
    return isNaN(t) ? NaN : t;
  };
  const dur = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const two = (n: number) => (n < 10 ? '0' : '') + n;
    if (s < 60) return s + (T.secs || 's');
    if (s < 3600) return Math.floor(s / 60) + ':' + two(s % 60);
    return Math.floor(s / 3600) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60);
  };
  const tokens = (n: number) =>
    n < 1000 ? String(n) : n < 10000 ? (n / 1000).toFixed(1) + 'k' : n < 1e6 ? Math.round(n / 1000) + 'k' : (n / 1e6).toFixed(1) + 'M';

  const out: FleetView = { rows: [], running: 0, done: 0, failed: 0, perChat: {} };
  const list = (Array.isArray(items) ? items : []).filter((a) => a && a.id);
  const isActive = (s: string) => s === 'queued' || s === 'running' || s === 'waiting';
  const sorted = list.slice().sort((a, b) => {
    const aa = isActive(a.state || ''), ba = isActive(b.state || '');
    if (aa !== ba) return aa ? -1 : 1;
    if (aa) return (ms(a.started_at) || 0) - (ms(b.started_at) || 0);
    return (ms(b.finished_at || b.updated_at) || 0) - (ms(a.finished_at || a.updated_at) || 0);
  });
  for (const a of sorted) {
    const state = a.state || '';
    const active = isActive(state);
    if (active) {
      out.running++;
      if (a.parent_chat) out.perChat[a.parent_chat] = (out.perChat[a.parent_chat] || 0) + 1;
    } else if (state === 'done') out.done++;
    else if (state === 'failed') out.failed++;

    // A record that went back to work after a continuation is no longer exhausted.
    const exhausted = !active && !!a.exhausted;
    let left = -1;
    const meta: string[] = [];
    if (a.max_iter && active) {
      // The limit grows on the go, so what is left matters more than the step.
      left = Math.max(0, a.max_iter - (a.iter || 0));
      meta.push((T.agSteps || 'step {i}/{m} · {n} left')
        .replace('{i}', String(a.iter || 0)).replace('{m}', String(a.max_iter)).replace('{n}', String(left)));
    } else if (a.max_iter) meta.push((a.iter || 0) + '/' + a.max_iter);
    else if (a.iter) meta.push(String(a.iter));
    if (exhausted) meta.push(T.agExhausted || 'hit the step limit');
    if (a.last_tool) meta.push(a.last_tool);
    const start = ms(a.started_at);
    const end = active ? now : ms(a.finished_at || a.updated_at);
    if (!isNaN(start) && !isNaN(end)) meta.push(dur((end - start) / 1000));

    const tip: string[] = [LABELS[state] || state];
    if (exhausted) tip[0] += ' · ' + (T.agExhausted || 'hit the step limit');
    const who = [a.model, a.source].filter(Boolean).join(' · ');
    if (who) tip[0] += ' · ' + who;
    if (a.prompt_tokens) tip[0] += ' · ' + tokens(a.prompt_tokens) + ' ' + (T.agTokens || 'tokens');
    if (a.preview) tip.push(a.preview);
    if (a.error) tip.push(a.error);

    out.rows.push({
      id: a.id,
      title: (a.title || '').trim() || a.id,
      state,
      active,
      icon: ICONS[state] || '•',
      meta: meta.join(' · '),
      left,
      low: left >= 0 && left <= 5,
      exhausted,
      tip: tip.join('\n'),
      parent: a.parent_chat || '',
      updated: a.updated_at || '',
    });
  }
  return out;
}

// ── getting started and the machine card (E105) ─────────────────

/** machine_state as the extension forwards it to the panel (see parseMachineState). */
export interface MachineView {
  machine: {
    id: string;
    name: string;
    os: string;
    version: string;
    logged_in: boolean;
    email_masked: string;
    plan: string;
    sources: { id: string; title: string; alive: boolean; checked_at: string }[];
    sync: {
      enabled: boolean;
      last_push_at: string;
      config: boolean;
      personal_memory_files: number;
      projects: number;
      mode: string;
    };
    presence: { listener_running: boolean; reachable_from_web: boolean };
  };
  tutorial: { id: string; done: boolean }[];
  phone_url: string;
}

/**
 * Whether "Getting started" is on screen. By itself: the chat is empty, a
 * step is left and the user has not closed it. Asked for (the menu item, the
 * command): whatever the chat and the ticks. Never without steps — an older
 * agent sends none, and there is nothing to tick.
 */
export function showStart(o: {
  steps: { done: boolean }[];
  dismissed: boolean;
  chatEmpty: boolean;
  forced: boolean;
}): boolean {
  if (!o.steps || !o.steps.length) return false;
  if (o.forced) return true;
  if (o.dismissed || !o.chatEmpty) return false;
  return o.steps.some((s) => !s.done);
}

/** One step of "Getting started", ready to draw. */
export interface StartStep {
  id: string;
  done: boolean;
  title: string;
  /** One phrase: what the step is for. */
  why: string;
  lines: string[];
  /** What the button does — login | connect | sync_on | bind | qr; '' — no button. */
  action: string;
  actionLabel: string;
}

/**
 * The steps the agent reported, in words: the title, why, what is known
 * about it (the account, which source answered, what sync carries, the
 * project, the reach) and the one button that does it. A step done loses
 * its button — except the phone code, which is useful any time.
 */
export function startSteps(
  ms: MachineView | null,
  bound: { name: string } | null | undefined,
  T: Record<string, string>,
  now: number,
): StartStep[] {
  if (!ms) return [];
  const ago = (iso: string) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (isNaN(t)) return '';
    const s = Math.max(0, (now - t) / 1000);
    if (s < 60) return T.agoNow;
    if (s < 3600) return Math.floor(s / 60) + ' ' + T.agoMin;
    if (s < 86400) return Math.floor(s / 3600) + ' ' + T.agoHour;
    return Math.floor(s / 86400) + ' ' + T.agoDay;
  };
  const m = ms.machine;
  const out: StartStep[] = [];
  for (const st of ms.tutorial || []) {
    const s: StartStep = { id: st.id, done: !!st.done, title: '', why: '', lines: [], action: '', actionLabel: '' };
    const todo = (action: string, label: string) => {
      if (!s.done) { s.action = action; s.actionLabel = label; }
    };
    switch (st.id) {
      case 'login':
        s.title = T.stLogin; s.why = T.stLoginWhy;
        if (m.logged_in && m.email_masked) s.lines.push(m.email_masked);
        todo('login', T.stLoginBtn);
        break;
      case 'models':
        s.title = T.stModels; s.why = T.stModelsWhy;
        for (const src of m.sources || []) {
          const when = ago(src.checked_at);
          s.lines.push((src.alive ? '✓ ' : '✗ ') + src.title + ' — ' +
            (src.alive ? T.srcAlive : T.srcDead) + (when ? ', ' + when : ''));
        }
        if (!(m.sources || []).length) s.lines.push(T.srcNone);
        todo('connect', T.stModelsBtn);
        break;
      case 'sync': {
        s.title = T.stSync; s.why = T.stSyncWhy;
        if (m.sync.enabled) {
          const when = ago(m.sync.last_push_at);
          s.lines.push(T.rowSync + ': ' + T.syncOn + (when ? ' · ' + T.syncLast + ' ' + when : ''));
        }
        s.lines.push(T.syncGoes, T.syncStays, T.syncPassword);
        if (!s.done) s.lines.push(T.stSyncCmd + 'execai sync on');
        todo('sync_on', T.stSyncBtn);
        break;
      }
      case 'project':
        s.title = T.stProject; s.why = T.stProjectWhy;
        s.lines.push(bound && bound.name ? T.stProjectBound + bound.name : T.stProjectNone);
        todo('bind', T.stProjectBtn);
        break;
      case 'phone':
        s.title = T.stPhone; s.why = T.stPhoneWhy;
        // The card's lowercase phrases, as sentences here.
        for (const t of [
          m.presence.listener_running ? '' : T.reachNoListener,
          m.presence.reachable_from_web ? T.reachWeb : T.reachNoWeb,
        ]) if (t) s.lines.push(t.charAt(0).toUpperCase() + t.slice(1) + '.');
        if (ms.phone_url) { s.action = 'qr'; s.actionLabel = T.stPhoneBtn; }
        else s.lines.push(T.stPhoneNoLink);
        break;
      default:
        continue; // a step this panel cannot explain is not drawn
    }
    out.push(s);
  }
  return out;
}

/** A row of the machine card. */
export interface MachineRow {
  /** Stable test anchor: the label is translated. */
  key: string;
  label: string;
  value: string;
  lines: string[];
  /** ok — all good; warn — something wants attention; '' — neutral. */
  tone: string;
}

/**
 * The machine card in words: the machine, the agent version, the account
 * and its plan, which model sources answered and when, what sync carries,
 * and whether the web chat and the phone can reach this machine.
 */
export function machineRows(ms: MachineView, T: Record<string, string>, now: number): MachineRow[] {
  const ago = (iso: string) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (isNaN(t)) return '';
    const s = Math.max(0, (now - t) / 1000);
    if (s < 60) return T.agoNow;
    if (s < 3600) return Math.floor(s / 60) + ' ' + T.agoMin;
    if (s < 86400) return Math.floor(s / 3600) + ' ' + T.agoHour;
    return Math.floor(s / 86400) + ' ' + T.agoDay;
  };
  // week_work → «Work»; an unknown plan is shown as the agent named it.
  const planName = (p: string) => {
    const k = String(p || '').toLowerCase().replace(/^(day|week|month|year)_/, '');
    return k === 'start' ? T.planStart : k === 'work' ? T.planWork : k === 'max' ? T.planMax : p;
  };
  const m = ms.machine;
  const rows: MachineRow[] = [];

  rows.push({
    key: 'machine', label: T.rowMachine,
    value: [m.name, m.os].filter(Boolean).join(' · ') || '?',
    lines: m.id ? ['id ' + m.id] : [], tone: '',
  });
  rows.push({ key: 'agent', label: T.rowAgent, value: m.version || '?', lines: [], tone: '' });
  rows.push(m.logged_in
    ? {
      key: 'account', label: T.rowAccount,
      value: [m.email_masked || '?', m.plan ? T.planLabel + planName(m.plan) : T.planNone].join(' · '),
      lines: [], tone: 'ok',
    }
    : { key: 'account', label: T.rowAccount, value: T.accNone, lines: [], tone: 'warn' });

  const sources = m.sources || [];
  rows.push({
    key: 'models', label: T.rowModels,
    value: sources.length ? '' : T.srcNone,
    lines: sources.map((src) => {
      const when = ago(src.checked_at);
      return (src.alive ? '✓ ' : '✗ ') + src.title + ' — ' +
        (src.alive ? T.srcAlive : T.srcDead) + (when ? ', ' + when : '');
    }),
    tone: sources.length && sources.every((s) => s.alive) ? 'ok' : 'warn',
  });

  const sy = m.sync;
  if (sy.enabled) {
    const when = ago(sy.last_push_at);
    const lines: string[] = [];
    if (sy.config) lines.push(T.syncHasConfig);
    lines.push(T.syncMemory + ': ' + (sy.personal_memory_files || 0));
    lines.push(T.syncProjects + ': ' + (sy.projects || 0));
    const mode = sy.mode === 'all' ? T.modeAll : sy.mode === 'selected' ? T.modeSelected : sy.mode === 'none' ? T.modeNone : '';
    if (mode) lines.push(mode);
    rows.push({
      key: 'sync', label: T.rowSync,
      value: T.syncOn + (when ? ' · ' + T.syncLast + ' ' + when : ''),
      lines, tone: 'ok',
    });
  } else {
    rows.push({ key: 'sync', label: T.rowSync, value: T.syncOff, lines: [], tone: '' });
  }

  const pr = m.presence;
  rows.push({
    key: 'reach', label: T.rowReach, value: '',
    lines: [
      pr.listener_running ? T.reachListening : T.reachNoListener,
      pr.reachable_from_web ? T.reachWeb : T.reachNoWeb,
    ],
    tone: pr.listener_running && pr.reachable_from_web ? 'ok' : 'warn',
  });
  return rows;
}
