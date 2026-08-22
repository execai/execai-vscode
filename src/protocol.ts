// Client for the `execai ide` JSON protocol.
//
// The contract lives in agent-vbai/internal/ide (Protocol = 1): one JSON object
// per line, stdin goes to the agent, stdout comes back from it. Anything meant
// for humans the agent writes to stderr.
//
// This module must not depend on vscode: it is unit-tested on bare node, and the
// extension only wires up the callbacks.

import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

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
}

/** An event from the agent. Which fields are set depends on the event type — see internal/ide. */
export interface AgentEvent {
  type: string;
  /** The chat this event belongs to; absent on process-wide events (state, chats). */
  chat?: string;
  version?: string;
  protocol?: number;
  model?: string;
  source?: string;
  cwd?: string;
  text?: string;
  id?: string;
  tool?: string;
  summary?: string;
  chunk?: string;
  ok?: boolean;
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
  msgs?: { role: string; tool?: string; text: string }[];
  /** chat_loaded: a turn is still running in the loaded chat */
  busy?: boolean;
  /** wakeup / chat_loaded: when the chat wakes up (RFC 3339) */
  at?: string;
}

export interface EditorCtx {
  path?: string;
  selection?: string;
  language?: string;
  files?: string[];
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

export interface AgentClientOpts {
  binary: string;
  cwd: string;
  maxIterations?: number;
  onEvent: (e: AgentEvent) => void;
  /** The agent died or never started. */
  onExit: (code: number | null, stderrTail: string) => void;
}

/**
 * AgentClient owns the `execai ide` process and sends messages to it.
 *
 * The extension never answers on the user's behalf: it only forwards their
 * answers and renders events. A question left unanswered while the editor is
 * closed is treated as a refusal by the agent itself.
 */
export class AgentClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private parser = new LineParser();
  private stderrTail = '';

  constructor(private opts: AgentClientOpts) {}

  start(): void {
    const args = ['ide', '--cwd', this.opts.cwd];
    if (this.opts.maxIterations && this.opts.maxIterations > 0) {
      args.push('--max-iterations', String(this.opts.maxIterations));
    }
    const p = spawn(this.opts.binary, args, { cwd: this.opts.cwd });
    this.proc = p;

    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (chunk: string) => {
      for (const e of this.parser.push(chunk)) this.opts.onEvent(e);
    });
    p.stderr.setEncoding('utf8');
    p.stderr.on('data', (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-2000);
    });
    p.on('exit', (code) => {
      this.proc = null;
      this.opts.onExit(code, this.stderrTail);
    });
    p.on('error', () => {
      // spawn could not find the binary — no exit event will arrive, so report it here.
      this.proc = null;
      this.opts.onExit(null, this.stderrTail || 'execai binary not found (see the execai.binaryPath setting)');
    });
  }

  get alive(): boolean {
    return this.proc !== null;
  }

  private send(obj: unknown): void {
    if (!this.proc) return;
    this.proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  /** chat — which chat the message targets; the agent falls back to the active one. */
  sendUser(text: string, context?: EditorCtx, chat?: string): void {
    this.send({ type: 'user', text, context, chat });
  }
  sendAnswer(id: string, value: string): void {
    this.send({ type: 'answer', id, value });
  }
  stop(chat?: string): void {
    this.send({ type: 'stop', chat });
  }
  newChat(): void {
    this.send({ type: 'new_chat' });
  }
  sendCommand(name: string, value?: string, extra?: { key?: string; base_url?: string }, chat?: string): void {
    this.send({ type: 'command', name, value, ...extra, chat });
  }
  dispose(): void {
    if (this.proc) {
      this.proc.stdin.end();
      const p = this.proc;
      setTimeout(() => p.kill(), 1500);
      this.proc = null;
    }
  }
}
