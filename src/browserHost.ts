/// <reference lib="dom" />
// The browser side of `execai ui`: the chat panel of the extension, served by
// the agent on 127.0.0.1 and opened in any browser.
//
// The page (webviewHtml.ts, browserHtml) is the very one VS Code shows. In VS
// Code it talks to the extension through acquireVsCodeApi(); here it talks to
// window.execaiHost, defined below, and this file plays the extension's part:
// PanelCore — the same class chatView.ts runs — routes the agent's events and
// turns the panel's messages into ide-protocol input, and the PanelHost made
// here swaps the editor's QuickPicks, toasts and status bar for HTML.
//
// Transport (the `execai ui` contract, E101):
//   POST /in       one ide-protocol In message as JSON → 204;
//   GET  /events   EventSource, every message is one ide-protocol Out line;
//                  on connect the server replays ready/state/inbox/chats/agents;
//   POST /upload   multipart, one file → {"path": "<abs>", "name": "<name>"};
//                  413 over 25 MiB.
// Every browser tab gets every event: PanelCore runs with sharedStream, so a
// tab follows only the chat switches it asked for.
// The page config ({{CONFIG}}, filled in by the server) arrives as
// window.execaiPage.config = {lang, cwd, version, upload}.

import { PanelCore, PanelHost, PickItem, PickOptions, InputOptions, PanelMessage } from './panelCore';
import { AgentEvent, portOver } from './protocol';

/** What `execai ui` puts into {{CONFIG}}. */
interface PageConfig {
  lang?: string;
  cwd?: string;
  version?: string;
  /** Where files go: the upload endpoint, "/upload" by default. */
  upload?: string;
}

/** Set by the page before this script: the panel strings, the l10n table, the config. */
interface PageData {
  T?: Record<string, string>;
  l10n?: Record<string, string>;
  config?: PageConfig;
}

/** The origin stamped on the events this host dispatches; the panel ignores any other. */
const HOST_ORIGIN = 'execai-host';
const IMAGE = /\.(png|jpe?g|gif|webp)$/i;
const THUMB_MAX = 3 * 1024 * 1024;
/** What `execai ui` takes in one upload. */
const UPLOAD_MAX = 25 * 1024 * 1024;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Codicons ($(check), $(globe)) are an editor font; a browser gets characters. */
function plain(label: string): string {
  return label
    .replace(/\$\(check\)\s*/g, '✓ ')
    .replace(/\$\(globe\)\s*/g, '\u{1F310} ')
    .replace(/\$\([\w-]+\)\s*/g, '');
}

function basename(p: string): string {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
}

function boot(): void {
  const page: PageData = (window as unknown as { execaiPage?: PageData }).execaiPage || {};
  const table = page.l10n || {};
  const cfg: PageConfig = page.config && typeof page.config === 'object' ? page.config : {};
  const l10n = {
    t: (message: string, ...args: (string | number | boolean)[]) =>
      (table[message] ?? message).replace(/\{(\d+)\}/g, (m, i) => (+i < args.length ? String(args[+i]) : m)),
  };

  // ── the page furniture: header, toasts, dialog ──
  const hdr = document.getElementById('hdr') as HTMLElement;
  const toasts = document.getElementById('toasts') as HTMLElement;
  const dlg = document.getElementById('dlg') as HTMLElement;
  hdr.innerHTML = '';
  const statusEl = el('span', 'hdr-status', 'ExecAI');
  const connEl = el('span', 'hdr-conn', '');
  const whereEl = el('span', 'hdr-where', [cfg.cwd, cfg.version ? 'execai ' + cfg.version : ''].filter(Boolean).join(' · '));
  whereEl.title = cfg.cwd || '';
  hdr.appendChild(statusEl);
  hdr.appendChild(connEl);
  hdr.appendChild(whereEl);
  // The machine card, as the editor opens it from the panel title bar.
  const machineBtn = el('button', 'hdr-machine', '\u{1F5A5}');
  machineBtn.title = l10n.t('My machine');
  machineBtn.onclick = () => core.toggleMachine();
  hdr.appendChild(machineBtn);
  document.title = cfg.cwd ? basename(cfg.cwd) + ' — ExecAI' : 'ExecAI';

  const canNotify = () => typeof Notification !== 'undefined';
  // Desktop notifications only by permission, asked for with a click.
  if (canNotify() && Notification.permission === 'default') {
    const bell = el('button', 'hdr-bell', '\u{1F514}');
    bell.title = l10n.t('Notify me when a chat finishes or asks while this tab is in the background');
    bell.onclick = () => {
      try {
        void Promise.resolve(Notification.requestPermission()).then(() => bell.remove(), () => bell.remove());
      } catch {
        bell.remove();
      }
    };
    hdr.appendChild(bell);
  }
  /** A desktop notification — only when the tab is hidden and it is allowed. */
  const notify = (text: string, onClick?: () => void) => {
    try {
      if (!canNotify() || Notification.permission !== 'granted' || !document.hidden) return;
      const n = new Notification('ExecAI', { body: text, tag: 'execai' });
      n.onclick = () => {
        try { window.focus(); } catch { /* not ours to focus */ }
        n.close();
        onClick?.();
      };
    } catch {
      // Some browsers (Android Chrome) forbid the constructor.
    }
  };

  /** A toast in the notification strip; resolves with the action clicked, or undefined. */
  const toast = (message: string, actions: string[], warn: boolean): Promise<string | undefined> =>
    new Promise((resolve) => {
      const n = el('div', 'toast' + (warn ? ' warn' : ''));
      n.appendChild(el('span', '', message));
      let done = false;
      const finish = (v?: string) => {
        if (done) return;
        done = true;
        n.remove();
        resolve(v);
      };
      (n as unknown as { _finish: typeof finish })._finish = finish;
      for (const a of actions) {
        const b = el('button', '', a);
        b.onclick = () => finish(a);
        n.appendChild(b);
      }
      const x = el('i', '', '×');
      x.title = l10n.t('Close');
      x.onclick = () => finish(undefined);
      n.appendChild(x);
      toasts.appendChild(n);
      // Three at most: the oldest goes first.
      while (toasts.children.length > 3) {
        (toasts.children[0] as unknown as { _finish?: (v?: string) => void })._finish?.(undefined);
      }
      setTimeout(() => finish(undefined), actions.length ? 60000 : 12000);
      notify(message, actions.length ? () => finish(actions[0]) : undefined);
    });

  // One dialog at a time; a new one cancels the open one.
  let closeDialog: (() => void) | null = null;
  const dialog = <T>(title: string | undefined, fill: (box: HTMLElement, finish: (v: T | undefined) => void) => void) => {
    closeDialog?.();
    return new Promise<T | undefined>((resolve) => {
      dlg.innerHTML = '';
      const box = el('div', 'dlg-box');
      box.setAttribute('role', 'dialog');
      if (title) box.appendChild(el('div', 'dlg-title', title));
      let done = false;
      const finish = (v: T | undefined) => {
        if (done) return;
        done = true;
        closeDialog = null;
        dlg.classList.remove('open');
        dlg.innerHTML = '';
        resolve(v);
      };
      closeDialog = () => finish(undefined);
      dlg.onclick = (e) => { if (e.target === dlg) finish(undefined); };
      fill(box, finish);
      dlg.appendChild(box);
      dlg.classList.add('open');
    });
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closeDialog) closeDialog();
  });
  const buttons = (list: [string, () => void, boolean?][]) => {
    const row = el('div', 'dlg-btns');
    for (const [label, onclick, primary] of list) {
      const b = el('button', primary ? 'primary' : '', label);
      b.onclick = onclick;
      row.appendChild(b);
    }
    return row;
  };

  const pick = <T extends PickItem>(items: T[], opts: PickOptions) =>
    dialog<T>(opts.title, (box, finish) => {
      if (opts.placeHolder) box.appendChild(el('div', 'dlg-prompt', opts.placeHolder));
      const list = el('div', 'dlg-list');
      items.forEach((it, i) => {
        const b = el('button', 'dlg-item');
        b.setAttribute('data-i', String(i));
        b.appendChild(el('b', '', plain(it.label)));
        if (it.description) b.appendChild(el('small', '', it.description));
        if (it.detail) b.appendChild(el('div', 'dlg-detail', it.detail));
        b.onclick = () => finish(it);
        list.appendChild(b);
      });
      box.appendChild(list);
      box.appendChild(buttons([[l10n.t('Cancel'), () => finish(undefined)]]));
    });

  const input = (opts: InputOptions) =>
    dialog<string>(opts.title, (box, finish) => {
      if (opts.prompt) box.appendChild(el('div', 'dlg-prompt', opts.prompt));
      const inp = el('input', 'dlg-input');
      inp.type = opts.password ? 'password' : 'text';
      inp.value = opts.value || '';
      inp.placeholder = opts.placeHolder || '';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      const err = el('div', 'dlg-err');
      const ok = () => {
        const v = inp.value;
        const bad = opts.validateInput?.(v);
        if (bad) { err.textContent = bad; return; }
        finish(v);
      };
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } };
      inp.oninput = () => { err.textContent = ''; };
      box.appendChild(inp);
      box.appendChild(err);
      box.appendChild(buttons([[l10n.t('OK'), ok, true], [l10n.t('Cancel'), () => finish(undefined)]]));
      setTimeout(() => inp.focus(), 0);
    });

  // ── transport ──
  // POSTs go one after another: a command and the message after it must
  // reach the agent in the order they were made.
  let chain: Promise<unknown> = Promise.resolve();
  const failed = (status: number) => {
    core.fromAgent({
      type: 'error',
      text: status === 401 || status === 403
        ? l10n.t('This page is no longer signed in to execai ui — open the link it printed in the terminal again.')
        : l10n.t('execai ui did not take the message ({0}) — is it still running?', status || l10n.t('no connection')),
    });
  };
  const send = (m: object) => {
    const body = JSON.stringify(m);
    chain = chain
      .then(() => fetch('/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body,
      }))
      .then((r) => { if (!r.ok) failed(r.status); }, () => failed(0));
  };
  const port = portOver(send);

  let es: EventSource | null = null;
  const setConn = (text: string) => { connEl.textContent = text; };
  const connect = () => {
    if (es) return;
    es = new EventSource('/events');
    es.onopen = () => setConn('');
    es.onmessage = (ev: MessageEvent) => {
      let e: AgentEvent;
      try { e = JSON.parse(ev.data); } catch { return; }
      if (e && typeof e.type === 'string') core.fromAgent(e);
    };
    // EventSource reconnects by itself; CLOSED means it gave up (the server
    // is gone or the sign-in cookie is no longer valid).
    es.onerror = () => {
      setConn(es && es.readyState === 2
        ? l10n.t('disconnected — run execai ui again')
        : l10n.t('reconnecting…'));
    };
  };

  // ── files: everything goes through /upload, the agent gets server paths ──
  const thumbs = new Map<string, string>();
  const labels = new Map<string, string>();
  const warn = (message: string) => { void toast(message, [], true); };
  const tooBig = (name: string) => warn(l10n.t('{0} is larger than 25 MB — not attached.', name));
  const upload = async (blob: Blob, name: string): Promise<string | null> => {
    if (blob.size > UPLOAD_MAX) { tooBig(name); return null; }
    try {
      const fd = new FormData();
      fd.append('file', blob, name);
      const r = await fetch(cfg.upload || '/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
      if (r.status === 413) { tooBig(name); return null; }
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (j && typeof j.path === 'string' && j.path) {
        labels.set(j.path, typeof j.name === 'string' && j.name ? j.name : name);
        return j.path;
      }
      throw new Error('no path');
    } catch {
      warn(l10n.t('Could not upload {0}.', name));
      return null;
    }
  };
  const dataURL = (f: Blob) => new Promise<string | null>((res) => {
    try {
      const r = new FileReader();
      r.onload = () => res(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => res(null);
      r.readAsDataURL(f);
    } catch {
      res(null);
    }
  });
  const uploadAll = async (files: File[]) => {
    const paths: string[] = [];
    for (const f of files) {
      const p = await upload(f, f.name);
      if (!p) continue;
      if (IMAGE.test(f.name) && f.size <= THUMB_MAX) {
        const u = await dataURL(f);
        if (u) thumbs.set(p, u);
      }
      paths.push(p);
    }
    if (paths.length) core.fromPanel({ type: 'attach_paths', paths });
  };
  let picker: HTMLInputElement | null = null;

  const memoKey = (k: string) => 'execai:' + (cfg.cwd || '') + ':' + k;

  const host: PanelHost = {
    l10n,
    agent: () => port,
    // execai ui owns the agent process; the page has nothing to start.
    startAgent: () => {},
    hasFolder: () => true,
    post: (e) => {
      window.dispatchEvent(new MessageEvent('message', { data: e, origin: HOST_ORIGIN }));
    },
    uiReady: connect,
    status: (text, tooltip) => {
      statusEl.textContent = plain(text);
      statusEl.title = tooltip || '';
    },
    info: (message, ...actions) => toast(message, actions, false),
    warn,
    reveal: () => {
      try { window.focus(); } catch { /* not ours to focus */ }
      notify(l10n.t('The agent is waiting for your answer.'));
    },
    openExternal: (url) => { window.open(url, '_blank', 'noopener,noreferrer'); },
    copy: (text) => {
      const fail = () => warn(l10n.t('Could not copy to the clipboard.'));
      try {
        void navigator.clipboard.writeText(text).then(undefined, fail);
      } catch {
        fail();
      }
    },
    memo: {
      get: <T>(key: string, def: T): T => {
        try {
          const v = localStorage.getItem(memoKey(key));
          return v === null ? def : JSON.parse(v);
        } catch {
          return def;
        }
      },
      set: (key, value) => {
        try { localStorage.setItem(memoKey(key), JSON.stringify(value)); } catch { /* private mode */ }
      },
    },
    // For every project served from this browser: "Getting started" closed once.
    globalMemo: {
      get: <T>(key: string, def: T): T => {
        try {
          const v = localStorage.getItem('execai:global:' + key);
          return v === null ? def : JSON.parse(v);
        } catch {
          return def;
        }
      },
      set: (key, value) => {
        try { localStorage.setItem('execai:global:' + key, JSON.stringify(value)); } catch { /* private mode */ }
      },
    },
    pick,
    input,
    resumeLastChat: () => true,
    editorContext: () => undefined,
    pickFiles: () => {
      if (!picker) {
        picker = el('input');
        picker.type = 'file';
        picker.multiple = true;
        picker.style.display = 'none';
        picker.onchange = () => {
          const files = Array.from(picker?.files || []);
          if (picker) picker.value = '';
          void uploadAll(files);
        };
        document.body.appendChild(picker);
      }
      picker.click?.();
    },
    attachPaths: (paths) => {
      const items = paths.map((p) => ({
        path: p,
        label: labels.get(p) || basename(p),
        thumb: thumbs.get(p),
      }));
      if (items.length) host.post({ type: 'files_attached', items });
    },
    // A paste or a drop without a path: upload it like a picked file.
    pasteBlob: (name, url) => {
      const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
      if (!m) return;
      let blob: Blob;
      try {
        const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: m[1] || 'application/octet-stream' });
      } catch {
        return;
      }
      void upload(blob, name).then((p) => {
        if (!p) return;
        if (IMAGE.test(name)) thumbs.set(p, url);
        host.attachPaths([p]);
      });
    },
    // Hidden in the page; nothing to do should one arrive anyway.
    openFile: () => {},
    openTerminal: () => {},
    checkUpdates: () => {},
    keepChatOnReady: true,
    sharedStream: true,
  };
  const core = new PanelCore(host);

  // The panel posts here as it would to VS Code. Asynchronously, like a
  // webview: the panel announces ui_ready before it attaches its listener.
  (window as unknown as { execaiHost: { postMessage(m: PanelMessage): void } }).execaiHost = {
    postMessage: (m) => { void Promise.resolve().then(() => core.fromPanel(m)); },
  };
}

boot();
