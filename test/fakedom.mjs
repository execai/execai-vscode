// A minimal DOM, just enough to run the panel's inline script under node.
//
// No jsdom on purpose: the repo installs nothing beyond its lock file, and the
// panel uses a small, stable slice of the DOM. Selectors: a tag, .classes,
// [attr] / [attr="value"], optionally prefixed with ":scope >" — no
// descendant combinators. Anything else throws, so a test never silently
// matches nothing.
import vm from 'node:vm';

class ClassList {
  constructor(el) { this.el = el; }
  _all() { return this.el._class.split(/\s+/).filter(Boolean); }
  add(...cs) { const s = new Set(this._all()); for (const c of cs) s.add(c); this.el._class = [...s].join(' '); }
  remove(...cs) { this.el._class = this._all().filter(c => !cs.includes(c)).join(' '); }
  contains(c) { return this._all().includes(c); }
  toggle(c, force) {
    const on = force === undefined ? !this.contains(c) : !!force;
    if (on) this.add(c); else this.remove(c);
    return on;
  }
}

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function parseSelector(sel) {
  let s = sel.trim();
  let direct = false;
  if (s.startsWith(':scope >')) { direct = true; s = s.slice(8).trim(); }
  if (/[\s>+~,]/.test(s.replace(/"[^"]*"/g, '""'))) throw new Error('fakedom: unsupported selector ' + sel);
  const m = { direct, tag: null, classes: [], attrs: [] };
  const tag = s.match(/^[a-zA-Z][\w-]*/);
  if (tag) { m.tag = tag[0].toUpperCase(); s = s.slice(tag[0].length); }
  const re = /^(?:\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\])/;
  while (s.length) {
    const x = re.exec(s);
    if (!x) throw new Error('fakedom: unsupported selector ' + sel);
    if (x[1]) m.classes.push(x[1]);
    else m.attrs.push([x[2], x[3]]);
    s = s.slice(x[0].length);
  }
  return m;
}

export class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this._class = '';
    this._text = '';
    this._html = '';
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.classList = new ClassList(this);
    this.listeners = {};
    this.scrollTop = 0; this.scrollHeight = 0; this.scrollLeft = 0;
    this.scrollWidth = 0; this.clientWidth = 0;
  }
  get className() { return this._class; }
  set className(v) { this._class = String(v); }
  get id() { return this.attributes.id || ''; }
  set id(v) { this.attributes.id = String(v); }
  get firstChild() { return this.children[0] || null; }
  _detachAll() { for (const c of this.children) c.parentElement = null; this.children = []; }
  appendChild(c) {
    if (c.parentElement) c.remove();
    c.parentElement = this;
    this.children.push(c);
    return c;
  }
  insertBefore(c, ref) {
    if (c.parentElement) c.remove();
    c.parentElement = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  remove() {
    const p = this.parentElement;
    if (!p) return;
    p.children = p.children.filter(x => x !== this);
    this.parentElement = null;
  }
  get textContent() {
    return this._text + this._html.replace(/<[^>]*>/g, '') + this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this._detachAll(); this._html = ''; this._text = String(v); }
  get innerText() { return this.textContent; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._detachAll(); this._text = ''; this._html = String(v); }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k.startsWith('data-')) this.dataset[camel(k.slice(5))] = String(v);
  }
  getAttribute(k) {
    if (k in this.attributes) return this.attributes[k];
    if (k.startsWith('data-') && camel(k.slice(5)) in this.dataset) return this.dataset[camel(k.slice(5))];
    return null;
  }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  scrollIntoView() {}
  focus() {}
  _matches(m) {
    if (m.tag && this.tagName !== m.tag) return false;
    for (const c of m.classes) if (!this.classList.contains(c)) return false;
    for (const [k, v] of m.attrs) {
      const got = this.getAttribute(k);
      if (got === null || (v !== undefined && got !== v)) return false;
    }
    return true;
  }
  querySelectorAll(sel) {
    const m = parseSelector(sel);
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (c._matches(m)) out.push(c);
        if (!m.direct) walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

/**
 * Runs the panel script of chatHtml() and returns handles to drive it:
 * post() delivers a message from the extension, sent collects what the panel
 * posted back, byId() reaches the static elements.
 */
export function runPanel(html) {
  const m = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no inline script in the html');
  const ids = new Map();
  const byId = (id) => {
    if (!ids.has(id)) { const e = new El('div'); e.id = id; ids.set(id, e); }
    return ids.get(id);
  };
  const winListeners = {};
  const docListeners = {};
  const sent = [];
  const body = new El('body');
  const document = {
    body,
    createElement: (t) => new El(t),
    getElementById: byId,
    addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); },
  };
  const window = {
    addEventListener: (t, f) => { (winListeners[t] ||= []).push(f); },
  };
  const ctx = vm.createContext({
    window, document, console,
    // postMessage clones; a JSON round trip also brings the object into this
    // realm, so deepStrictEqual compares values, not prototypes.
    acquireVsCodeApi: () => ({ postMessage: (msg) => sent.push(JSON.parse(JSON.stringify(msg))) }),
    // The turn timer would keep node alive; the panel's timers are not under test.
    setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {},
    FileReader: class {},
  });
  vm.runInContext(m[1], ctx);
  const post = (data) => { for (const f of winListeners.message || []) f({ data }); };
  return { post, sent, byId, body };
}

/** Opens the panel menu the way a click on the status line does. */
export function openMenu(p) {
  p.byId('status').onclick();
  return p.byId('menu');
}

/**
 * Runs the browser page of `execai ui` (browserHtml) the way a browser would:
 * every inline script in order — the host first, then the panel — in one
 * realm, with fakes for what the host uses: fetch, EventSource, localStorage,
 * the clipboard, window.open, FileReader.
 *
 * Returned handles: emit() delivers one SSE event from the agent, ins() lists
 * the ide-protocol messages POSTed to /in, flush() lets queued promises run,
 * requests holds every fetch, opened every window.open.
 */
export function runBrowserPanel(html, opts = {}) {
  const config = opts.config || { lang: 'en', cwd: '/home/u/proj', version: 'R6.92', upload: '/upload' };
  const page = html.split('{{CONFIG}}').join(JSON.stringify(config));
  const scripts = [...page.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (scripts.length < 2) throw new Error('expected the host and the panel scripts');
  const ids = new Map();
  const byId = (id) => {
    if (!ids.has(id)) { const e = new El('div'); e.id = id; ids.set(id, e); }
    return ids.get(id);
  };
  const winListeners = {};
  const docListeners = {};
  const body = new El('body');
  const requests = [];
  const opened = [];
  const copied = [];
  const sources = [];
  const storage = opts.storage || new Map();
  const respond = opts.respond || (() => ({ status: 204 }));
  const document = {
    body,
    title: '',
    hidden: false,
    createElement: (t) => new El(t),
    getElementById: byId,
    addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); },
  };
  const window = {
    addEventListener: (t, f) => { (winListeners[t] ||= []).push(f); },
    dispatchEvent: (ev) => { for (const f of winListeners[ev.type] || []) f(ev); return true; },
    open: (...a) => { opened.push(a); return null; },
    focus: () => {},
  };
  class MessageEvent {
    constructor(type, init = {}) { this.type = type; this.data = init.data; this.origin = init.origin || ''; }
  }
  class EventSource {
    constructor(url) { this.url = url; this.readyState = 0; sources.push(this); }
    emit(obj) { this.onmessage && this.onmessage({ data: JSON.stringify(obj) }); }
    close() { this.readyState = 2; }
  }
  class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(buf).toString('base64');
        this.onload && this.onload();
      });
    }
  }
  const fetch = async (url, init = {}) => {
    const req = { url, method: init.method || 'GET', headers: init.headers || {}, body: init.body };
    requests.push(req);
    const r = respond(req) || { status: 204 };
    const status = r.status || 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.json };
  };
  const ctx = vm.createContext({
    window, document, console, fetch, EventSource, MessageEvent, FileReader,
    FormData, Blob, atob, Buffer,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
    },
    navigator: { clipboard: { writeText: async (t) => { copied.push(t); } } },
    setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {},
  });
  for (const s of scripts) vm.runInContext(s, ctx);
  const flush = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));
  const es = () => sources[sources.length - 1];
  const emit = (obj) => es().emit(obj);
  const ins = () => requests.filter((r) => r.url === '/in').map((r) => JSON.parse(r.body));
  return { byId, body, window, document, requests, opened, copied, sources, storage, emit, ins, flush, docListeners, winListeners };
}
