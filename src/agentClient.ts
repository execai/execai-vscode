// The `execai ide` process: spawns it, feeds it JSON lines on stdin and parses
// its stdout. The messages themselves are built in protocol.ts, which the
// browser page of `execai ui` shares; only the process is VS Code's own.

import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AgentEvent, AgentPort, ConnectExtra, EditorCtx, LineParser, toAgent } from './protocol';

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
export class AgentClient implements AgentPort {
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
    this.send(toAgent.user(text, context, chat));
  }
  sendAnswer(id: string, value: string): void {
    this.send(toAgent.answer(id, value));
  }
  stop(chat?: string): void {
    this.send(toAgent.stop(chat));
  }
  newChat(): void {
    this.send(toAgent.newChat());
  }
  sendCommand(name: string, value?: string, extra?: ConnectExtra, chat?: string): void {
    this.send(toAgent.command(name, value, extra, chat));
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
