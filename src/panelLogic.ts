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
  iter?: number;
  max_iter?: number;
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
  /** "3/15 · bash · 1:05" — iteration, last tool, how long it has run. */
  meta: string;
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
 * nowhere; a missing time just leaves the duration out.
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

    const meta: string[] = [];
    if (a.max_iter) meta.push((a.iter || 0) + '/' + a.max_iter);
    else if (a.iter) meta.push(String(a.iter));
    if (a.last_tool) meta.push(a.last_tool);
    const start = ms(a.started_at);
    const end = active ? now : ms(a.finished_at || a.updated_at);
    if (!isNaN(start) && !isNaN(end)) meta.push(dur((end - start) / 1000));

    const tip: string[] = [LABELS[state] || state];
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
      tip: tip.join('\n'),
      parent: a.parent_chat || '',
      updated: a.updated_at || '',
    });
  }
  return out;
}
