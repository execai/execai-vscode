// Notifications (E105): a chat that finished its turn or waits for an
// answer while the person is not looking — the panel is hidden or the
// editor window is in the background. On a stubbed `vscode` for the
// extension, on the fake DOM with a fake Notification for `execai ui`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { runBrowserPanel } from './fakedom.mjs';

const ui = { info: [], answers: [], commands: [] };
const settings = new Map();

const vscodeStub = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  l10n: { t: (s, ...a) => s.replace(/\{(\d+)\}/g, (_, i) => String(a[+i])) },
  window: {
    state: { focused: true },
    createStatusBarItem: () => ({ text: '', tooltip: undefined, command: '', show() {}, dispose() {} }),
    showInformationMessage: (msg, ...items) => {
      ui.info.push({ msg, items });
      return Promise.resolve(ui.answers.shift());
    },
    showWarningMessage: () => Promise.resolve(undefined),
    showQuickPick: async () => undefined,
  },
  commands: { executeCommand: (...a) => { ui.commands.push(a); return Promise.resolve(); } },
  workspace: {
    getConfiguration: () => ({ get: (k, d) => (settings.has(k) ? settings.get(k) : d) }),
    workspaceFolders: [{ uri: { fsPath: '/proj' } }],
  },
  env: { language: 'en', openExternal: () => {}, clipboard: { writeText() {} } },
  Uri: { parse: (s) => s, file: (s) => s },
};

function load(file, exportsOfVscode) {
  const req = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: exportsOfVscode };
  const mod = req(file);
  Module._resolveFilename = orig;
  return mod;
}
const { ChatViewProvider } = load('./.chatView.cjs', vscodeStub);

const flush = () => new Promise((r) => setImmediate(r));

/** A provider on chat c1, its panel visible and the window focused.
 *  features — what the agent's ready offers (["notify"] for a newer one). */
function setup(features) {
  ui.info.length = 0; ui.answers.length = 0; ui.commands.length = 0;
  settings.clear();
  vscodeStub.window.state = { focused: true };
  delete vscodeStub.env.remoteName;
  const ctx = {
    subscriptions: [], extensionUri: {},
    workspaceState: { get: (_k, d) => d, update: async () => {} },
  };
  const p = new ChatViewProvider(ctx);
  const sent = [];
  const shown = [];
  p.client = {
    alive: true,
    sendCommand: (name, value, extra) => sent.push({ name, value, ...(extra || {}) }),
    sendUser() {}, sendAnswer() {}, stop() {}, newChat() {}, dispose() {},
  };
  p.view = { visible: true, show: (keep) => shown.push(keep), webview: { postMessage: () => Promise.resolve(true) } };
  p.uiReady = true;
  const ev = (e) => p.fromAgent(e);
  const posted = [];
  p.view.webview.postMessage = (m) => { posted.push(m); return Promise.resolve(true); };
  ev({ type: 'ready', model: 'glm', source: 'execai', protocol: 1, ...(features ? { features } : {}) });
  ev({ type: 'chats', chats: [{ id: 'c1', label: 'fix the build', active: true }, { id: 'c2', label: 'docs' }] });
  ev({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  sent.length = 0;
  posted.length = 0;
  return { p, ev, sent, shown, posted };
}

test('a turn of the chat on screen, the window in the background: a toast that opens the panel', async () => {
  const { ev, shown, sent } = setup();
  vscodeStub.window.state.focused = false;
  ui.answers.push('Open');
  ev({ type: 'turn_start', chat: 'c1' });
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.deepEqual(ui.info.map((i) => i.msg), ['Chat «fix the build» finished its turn.']);
  assert.deepEqual(ui.info[0].items, ['Open']);
  await flush();
  assert.ok(shown.length > 0, 'Open brings the panel forward');
  assert.ok(!sent.some((s) => s.name === 'load_chat'), 'the chat is on screen already');
});

test('the panel hidden behind another view: the same toast', () => {
  const { p, ev } = setup();
  p.view.visible = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.equal(ui.info.length, 1);
});

test('the person is looking, or stopped the turn: no toast', () => {
  const { ev } = setup();
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  vscodeStub.window.state.focused = false;
  ev({ type: 'done', chat: 'c1', text: 'stopped' });
  assert.equal(ui.info.length, 0);
});

test('a question in the chat on screen while away: one toast, a replay adds none', () => {
  const { p, ev, shown } = setup();
  vscodeStub.window.state.focused = false;
  ev({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash', summary: 'rm -rf /srv/SECRET' });
  assert.deepEqual(ui.info.map((i) => i.msg), ['Chat «fix the build» is waiting for your answer.']);
  assert.ok(!ui.info[0].msg.includes('SECRET'));
  assert.ok(shown.length > 0, 'the panel is still brought forward');
  // Coming back to the chat replays the open question.
  ev({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  ev({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash' });
  assert.equal(ui.info.length, 1);
  // In focus with the panel visible: the panel itself is enough.
  vscodeStub.window.state.focused = true;
  ev({ type: 'ask_user', chat: 'c1', id: 'q2', question: 'which one?' });
  assert.equal(ui.info.length, 1);
  // A subagent asking while away is named.
  vscodeStub.window.state.focused = false;
  ev({ type: 'ask', chat: 'c1', id: 'q3', tool: 'Write', agent: { id: 'a1', title: 'tests' } });
  assert.equal(ui.info.at(-1).msg, 'Subagent «tests» in chat «fix the build» is waiting for your answer.');
  void p;
});

test('a question toasted for a background chat is not toasted again when that chat opens', async () => {
  const { ev, sent } = setup();
  vscodeStub.window.state.focused = false;
  ui.answers.push('Open');
  ev({ type: 'ask', chat: 'c2', id: 'q9', tool: 'Bash' });
  assert.equal(ui.info.length, 1);
  await flush();
  assert.deepEqual(sent.at(-1), { name: 'load_chat', value: 'c2' });
  ev({ type: 'chat_loaded', chat: 'c2', msgs: [] });
  ev({ type: 'ask', chat: 'c2', id: 'q9', tool: 'Bash' });
  assert.equal(ui.info.length, 1);
});

test('execai.notifications off: no done/ask toasts anywhere, errors still shown', () => {
  const { ev } = setup();
  settings.set('notifications', false);
  vscodeStub.window.state.focused = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  ev({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash' });
  ev({ type: 'done', chat: 'c2', text: 'ok' });
  ev({ type: 'ask', chat: 'c2', id: 'q2', tool: 'Bash' });
  assert.equal(ui.info.length, 0);
  ev({ type: 'error', chat: 'c2', text: 'boom' });
  assert.equal(ui.info.length, 1);
});

test('package.json: the setting, on by default, described in both languages', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const s = pkg.contributes.configuration.properties['execai.notifications'];
  assert.equal(s.type, 'boolean');
  assert.equal(s.default, true);
  assert.equal(s.description, '%cfg.notifications%');
  for (const f of ['../package.nls.json', '../package.nls.ru.json']) {
    const nls = JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
    assert.ok((nls['cfg.notifications'] || '').length > 20, f);
  }
});

// ── the editor window in the background: a desktop notification by the agent ──

const notifies = (sent) => sent.filter((c) => c.name === 'notify');

test('window in the background, a newer agent: the agent shows a desktop notification, no toast', () => {
  const { ev, sent } = setup(['notify']);
  vscodeStub.window.state.focused = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  ev({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash', summary: 'rm -rf /srv/SECRET' });
  ev({ type: 'ask_user', chat: 'c2', id: 'q2', question: 'which SECRET table?' });
  ev({ type: 'done', chat: 'c2', text: 'ok' });
  assert.deepEqual(notifies(sent), [
    { name: 'notify', value: 'turn_done' },
    { name: 'notify', value: 'approval', tool: 'Bash' },
    { name: 'notify', value: 'ask' },
    { name: 'notify', value: 'turn_done' },
  ]);
  assert.ok(!JSON.stringify(sent).includes('SECRET'), 'no request text goes to the agent');
  assert.equal(ui.info.length, 0, 'no toast on top of it');
  // The same question replayed: nothing again.
  ev({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  ev({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash' });
  assert.equal(notifies(sent).length, 4);
});

test('window in front, panel hidden: the toast, not the agent', () => {
  const { p, ev, sent } = setup(['notify']);
  p.view.visible = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.equal(ui.info.length, 1);
  assert.equal(notifies(sent).length, 0);
});

test('a remote session (SSH, WSL, container): the agent is elsewhere — the toast stays', () => {
  const { ev, sent } = setup(['notify']);
  vscodeStub.env.remoteName = 'ssh-remote';
  vscodeStub.window.state.focused = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.equal(notifies(sent).length, 0);
  assert.equal(ui.info.length, 1);
});

test('an agent that does not offer it: the toast stays; execai.notifications off: nothing', () => {
  const { ev, sent } = setup();
  vscodeStub.window.state.focused = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.equal(notifies(sent).length, 0);
  assert.equal(ui.info.length, 1);

  const b = setup(['notify']);
  settings.set('notifications', false);
  vscodeStub.window.state.focused = false;
  b.ev({ type: 'done', chat: 'c1', text: 'ok' });
  b.ev({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash' });
  assert.equal(notifies(b.sent).length, 0);
  assert.equal(ui.info.length, 0);
});

test('an agent refusing the command: swallowed, and the toast comes back', () => {
  const { ev, sent, posted } = setup(['notify']);
  vscodeStub.window.state.focused = false;
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.equal(notifies(sent).length, 1);
  ev({ type: 'error', text: 'неизвестная команда: notify' });
  assert.ok(!posted.some((m) => m.type === 'error'), 'the refusal is not shown');
  ev({ type: 'done', chat: 'c1', text: 'ok' });
  assert.equal(notifies(sent).length, 1);
  assert.equal(ui.info.length, 1);
});

// ── execai ui in a browser ──

const HOST = readFileSync(new URL('./.browserHost.js', import.meta.url), 'utf8');

/** A fake Notification: what was shown, and the permission to answer with. */
function fakeNotification(permission) {
  const shown = [];
  class N {
    constructor(title, opts) { this.title = title; this.body = opts?.body; shown.push(this); }
    close() {}
  }
  N.permission = permission;
  N.requestPermission = () => { N.permission = 'granted'; return Promise.resolve('granted'); };
  return { N, shown };
}

async function browser(permission) {
  const html = load('./.webviewHtml.cjs', {}).browserHtml('en', HOST, {});
  const { N, shown } = fakeNotification(permission);
  const p = runBrowserPanel(html, { globals: { Notification: N } });
  await p.flush();
  p.emit({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'fix the build', active: true }] });
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  await p.flush();
  return { p, N, shown };
}

test('browser: notifications are turned on with a click, in the look panel', async () => {
  const { p, N } = await browser('default');
  p.byId('lookBtn').onclick();
  const ask = p.byId('pop').querySelector('.pop-row').querySelector('button');
  assert.ok(ask, 'the button is offered while permission is not decided');
  assert.equal(ask.textContent, 'Turn on');
  ask.onclick();
  await p.flush();
  assert.equal(N.permission, 'granted');
  // Decided: the panel says so and offers nothing to click.
  assert.equal(p.byId('pop').querySelector('.pop-row').querySelector('button'), null);
});

test('browser: the chat on screen finished while the tab is hidden — a desktop notification', async () => {
  const { p, shown } = await browser('granted');
  p.document.hidden = true;
  p.emit({ type: 'done', chat: 'c1', text: 'ok' });
  await p.flush();
  assert.deepEqual(shown.map((n) => n.body), ['Chat «fix the build» finished its turn.']);
  // A question while hidden: one notification, not one from the toast and
  // another from bringing the page forward.
  p.emit({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash' });
  await p.flush();
  assert.deepEqual(shown.map((n) => n.body).slice(1), ['Chat «fix the build» is waiting for your answer.']);
});

test('browser: the window lost focus with the tab visible — notified too; looking — nothing', async () => {
  const { p, shown } = await browser('granted');
  p.document.hasFocus = () => false;
  p.emit({ type: 'done', chat: 'c1', text: 'ok' });
  await p.flush();
  assert.equal(shown.length, 1);
  p.document.hasFocus = () => true;
  p.emit({ type: 'done', chat: 'c1', text: 'ok' });
  p.emit({ type: 'ask', chat: 'c1', id: 'q2', tool: 'Bash' });
  await p.flush();
  assert.equal(shown.length, 1);
});
