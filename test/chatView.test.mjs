// The extension side of tasks from the site (E100.6), on a stubbed `vscode`:
// the status bar, the "task came in" toast, the one-time bind hint, the
// project picker and the flags the panel draws badges from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';

const ui = { info: [], warn: [], quick: [], answers: [], pick: null };

const vscodeStub = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  l10n: { t: (s, ...a) => s.replace(/\{(\d+)\}/g, (_, i) => String(a[+i])) },
  window: {
    createStatusBarItem: () => ({ text: '', tooltip: undefined, command: '', show() {}, dispose() {} }),
    showInformationMessage: (msg, ...items) => {
      ui.info.push({ msg, items });
      return Promise.resolve(ui.answers.shift());
    },
    showWarningMessage: (msg) => { ui.warn.push(msg); return Promise.resolve(undefined); },
    showQuickPick: async (items, opts) => {
      ui.quick.push({ items, opts });
      return ui.pick ? ui.pick(items) : undefined;
    },
  },
  workspace: {
    getConfiguration: () => ({ get: (_k, d) => d }),
    workspaceFolders: [{ uri: { fsPath: '/proj' } }],
  },
  env: { language: 'en', openExternal: () => {}, clipboard: { writeText() {} } },
  Uri: { parse: (s) => s, file: (s) => s },
};

function load() {
  const req = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: vscodeStub };
  const mod = req('./.chatView.cjs');
  Module._resolveFilename = orig;
  return mod;
}
const { ChatViewProvider } = load();

const flush = () => new Promise((r) => setImmediate(r));

/** A provider wired to a fake agent and a fake webview. */
function setup() {
  ui.info.length = 0; ui.warn.length = 0; ui.quick.length = 0; ui.answers.length = 0; ui.pick = null;
  const state = new Map();
  const ctx = {
    subscriptions: [],
    extensionUri: {},
    workspaceState: { get: (k, d) => (state.has(k) ? state.get(k) : d), update: async (k, v) => { state.set(k, v); } },
  };
  const p = new ChatViewProvider(ctx);
  const sent = [];
  const posted = [];
  p.client = {
    alive: true,
    sendCommand: (name, value, extra, chat) => sent.push({ name, value, ...(extra || {}), ...(chat ? { chat } : {}) }),
    sendUser() {}, sendAnswer() {}, stop() {}, newChat() {}, dispose() {},
  };
  p.view = { show() {}, webview: { postMessage: (m) => { posted.push(m); return Promise.resolve(true); } } };
  p.uiReady = true;
  const ev = (e) => p.fromAgent(e);
  ev({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  sent.length = 0; posted.length = 0;
  return { p, sent, posted, ev, state };
}

test('old agent: the status bar and the panel show nothing about the inbox', () => {
  const { p, posted, ev } = setup();
  ev({ type: 'state', model: 'glm', source: 'execai' });
  assert.equal(p.status.text, 'ExecAI: glm · execai');
  assert.equal(p.status.tooltip, undefined);
  assert.ok(!posted.some((m) => m.type === 'inbox'));
});

test('status bar: a short label per inbox state, the story in the tooltip', () => {
  const want = {
    listening: ['web: on', 'accepted in this window'],
    other_serve: ['web: serve', 'background execai serve'],
    other_ide: ['web: other window', '/home/u/other'],
    no_plan: ['web: plan needed', 'chat.execai.ru/settings/payment'],
    disabled: ['web: off', 'turned off'],
    not_logged_in: ['web: sign in', 'Sign in'],
  };
  const { p, ev } = setup();
  for (const [state, [label, tip]] of Object.entries(want)) {
    ev({ type: 'inbox', state, owner_cwd: '/home/u/other', bound_workspace: { id: 'w', name: 'Shop' } });
    assert.equal(p.status.text, 'ExecAI: glm · execai · $(globe) ' + label, state);
    assert.ok(p.status.tooltip.includes(tip), `${state}: tooltip "${p.status.tooltip}"`);
    assert.ok(p.status.tooltip.includes('Project: Shop'));
    assert.ok(!p.status.tooltip.includes('utm_'), 'no tracking query in the tooltip');
  }
});

test('the inbox suffix survives a turn, and the turn suffix survives an inbox update', () => {
  const { p, ev } = setup();
  ev({ type: 'inbox', state: 'listening', bound_workspace: { id: 'w', name: 'W' } });
  ev({ type: 'turn_start' });
  assert.equal(p.status.text, 'ExecAI: glm · execai · $(globe) web: on · turn…');
  ev({ type: 'inbox', state: 'other_serve', bound_workspace: null });
  assert.equal(p.status.text, 'ExecAI: glm · execai · $(globe) web: serve · turn…');
  ev({ type: 'done' });
  assert.equal(p.status.text, 'ExecAI: glm · execai · $(globe) web: serve');
});

test('inbox inside state is picked up too, and forwarded normalized', () => {
  const { posted, ev } = setup();
  ev({ type: 'state', model: 'glm', source: 'execai', inbox: 'other_ide', owner_cwd: '/x' });
  const inbox = posted.filter((m) => m.type === 'inbox');
  assert.deepEqual(inbox, [{ type: 'inbox', state: 'other_ide', owner_cwd: '/x', bound_workspace: null }]);
  assert.ok(posted.some((m) => m.type === 'state'), 'state itself still reaches the panel');
});

test('the raw inbox and workspaces events are not passed to the panel as is', () => {
  const { posted, ev } = setup();
  ev({ type: 'workspaces', items: [{ id: 'a', name: 'A' }] });
  ev({ type: 'inbox', state: 'listening', owner_pid: 5, bound_workspace: { id: 'a', name: 'A' } });
  assert.deepEqual(posted, [{ type: 'inbox', state: 'listening', owner_pid: 5, bound_workspace: { id: 'a', name: 'A' } }]);
});

test('agent exit clears the inbox everywhere', () => {
  const { p, posted, ev } = setup();
  ev({ type: 'inbox', state: 'listening', bound_workspace: null });
  posted.length = 0;
  p.clearInbox();
  assert.deepEqual(posted, [{ type: 'inbox', state: '' }]);
  ev({ type: 'state', model: 'glm', source: 'execai' });
  assert.equal(p.status.text, 'ExecAI: glm · execai');
});

test('bind hint: once per project, only when listening without a project', async () => {
  const { ev, state } = setup();
  ev({ type: 'inbox', state: 'other_serve', bound_workspace: null });
  ev({ type: 'inbox', state: 'listening', bound_workspace: { id: 'w', name: 'W' } });
  assert.equal(ui.info.length, 0, 'no hint while bound or not listening');

  ev({ type: 'inbox', state: 'listening', bound_workspace: null });
  assert.equal(ui.info.length, 1);
  assert.equal(ui.info[0].msg, 'Bind a project to run tasks from the web.');
  assert.deepEqual(ui.info[0].items, ['Bind a project…']);
  assert.equal(state.get('execai.inboxBindHintShown'), true);

  ev({ type: 'inbox', state: 'listening', bound_workspace: null });
  assert.equal(ui.info.length, 1, 'shown once');
});

test('a task from the site: toast with its first words, Open loads the chat', async () => {
  const { p, sent, posted, ev } = setup();
  p.activeChat = 'mine';
  ui.answers.push('Open');
  ev({ type: 'turn_start', chat: 'w1', origin: 'web' });
  assert.deepEqual(sent, [{ name: 'list_chats', value: undefined }], 'the new tab is fetched at once');
  const flags = posted.filter((m) => m.type === 'chat_flags').at(-1);
  assert.equal(flags.flags.w1.web, true);
  assert.equal(flags.flags.w1.busy, true);

  ev({ type: 'auto_user', chat: 'w1', text: 'почини сборку и прогони все тесты в пакете billing' });
  assert.equal(ui.info.length, 1);
  assert.equal(ui.info[0].msg, 'A task came in from the web: почини сборку и прогони все тесты в пакете…');
  assert.deepEqual(ui.info[0].items, ['Open']);
  await flush();
  assert.deepEqual(sent.at(-1), { name: 'load_chat', value: 'w1' });

  // Switching to it replays the turn: no second toast.
  ev({ type: 'chat_loaded', chat: 'w1', busy: true, msgs: [] });
  ev({ type: 'turn_start', chat: 'w1', origin: 'web' });
  ev({ type: 'auto_user', chat: 'w1', text: 'почини сборку' });
  assert.equal(ui.info.length, 1);
});

test('auto_user tagged origin=web is enough; a plain wake-up raises no web toast', () => {
  const { p, ev } = setup();
  p.activeChat = 'mine';
  ev({ type: 'turn_start', chat: 'w2' });
  ev({ type: 'auto_user', chat: 'w2', origin: 'web', text: 'deploy' });
  assert.equal(ui.info.at(-1).msg, 'A task came in from the web: deploy');

  const before = ui.info.length;
  ev({ type: 'turn_start', chat: 'z' });
  ev({ type: 'auto_user', chat: 'z', text: 'wake up and check CI' });
  assert.equal(ui.info.length, before);
});

test('done/ask toasts of a chat from the site carry the globe', () => {
  const { p, ev } = setup();
  p.activeChat = 'mine';
  ev({ type: 'chats', chats: [{ id: 'w3', label: 'fix build', origin: 'web' }, { id: 'mine', label: 'm', active: true }] });
  ev({ type: 'done', chat: 'w3' });
  assert.equal(ui.info.at(-1).msg, 'Chat «\u{1F310} fix build» finished its turn.');
  ev({ type: 'ask', chat: 'w3', id: 'q', tool: 'bash' });
  assert.equal(ui.info.at(-1).msg, 'Chat «\u{1F310} fix build» is waiting for your answer.');
});

test('ask_resolved clears the "waiting for you" badge of its chat', () => {
  const { p, posted, ev } = setup();
  p.activeChat = 'mine';
  ev({ type: 'ask', chat: 'c', id: 'q1', tool: 'bash' });
  assert.equal(posted.filter((m) => m.type === 'chat_flags').at(-1).flags.c.asking, true);
  ev({ type: 'ask_resolved', chat: 'c', ask_id: 'q1', by: 'cancel' });
  assert.equal(posted.filter((m) => m.type === 'chat_flags').at(-1).flags.c.asking, false);

  // In the chat on screen it reaches the panel as is, by included.
  ev({ type: 'ask_resolved', chat: 'mine', ask_id: 'q2', by: 'web' });
  assert.deepEqual(posted.at(-1), { type: 'ask_resolved', chat: 'mine', ask_id: 'q2', by: 'web' });
});

test('project picker: list_workspaces → quick pick → bind {workspace_id}', async () => {
  const { p, sent, ev } = setup();
  ev({ type: 'inbox', state: 'listening', bound_workspace: { id: 'b', name: 'Blog' } });
  ui.info.length = 0;
  ui.pick = (items) => items.find((i) => i.id === 'a');
  const flow = p.bindFlow();
  assert.deepEqual(sent.at(-1), { name: 'list_workspaces', value: undefined });
  ev({ type: 'workspaces', items: [{ id: 'a', name: 'Shop' }, { id: 'b', name: 'Blog' }] });
  await flow;
  const items = ui.quick[0].items;
  assert.deepEqual(items.map((i) => i.label), ['Shop', '$(check) Blog'], 'the bound project is marked');
  assert.deepEqual(sent.at(-1), { name: 'bind', value: 'a', workspace_id: 'a' });
});

test('project picker: the list may come inside state; re-picking the bound one sends nothing', async () => {
  const { p, sent, ev } = setup();
  ev({ type: 'inbox', state: 'listening', bound_workspace: { id: 'b', name: 'Blog' } });
  ui.pick = (items) => items.find((i) => i.id === 'b');
  const flow = p.bindFlow();
  ev({ type: 'state', model: 'glm', source: 'execai', workspaces: [{ id: 'b', name: 'Blog' }] });
  await flow;
  assert.equal(ui.quick.length, 1);
  assert.equal(sent.at(-1).name, 'list_workspaces');
});

test('project picker: no projects → a pointer to the site, no picker', async () => {
  const { p, ev } = setup();
  const flow = p.bindFlow();
  ev({ type: 'workspaces', items: [] });
  await flow;
  assert.equal(ui.quick.length, 0);
  assert.ok(ui.info.at(-1).msg.startsWith('Your ExecAI account has no projects yet'));
});

test('project picker: no answer from the agent → a warning, not a hang', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { p } = setup();
  const flow = p.bindFlow();
  t.mock.timers.tick(10001);
  await flow;
  assert.equal(ui.quick.length, 0);
  assert.equal(ui.warn.at(-1), 'The agent did not send the project list — try again in a moment.');
  assert.equal(p.wsWaiters.length, 0, 'the waiter is dropped');
});

test('the panel asks for the picker with pick_workspace', async () => {
  const { p, sent } = setup();
  p.fromWebview({ type: 'pick_workspace' });
  assert.deepEqual(sent.at(-1), { name: 'list_workspaces', value: undefined });
  p.gotWorkspaces([]); // let the flow finish
  await flush();
});

// ── subagents (E101) ──

test('agents and agent_loaded reach the panel whatever chat is on screen', () => {
  const { p, posted, ev } = setup();
  p.activeChat = 'mine';
  ev({ type: 'agents', items: [{ id: 'a1', parent_chat: 'other', state: 'running' }] });
  ev({ type: 'agent_loaded', chat: 'other', id: 'a1', title: 'T', messages: [] });
  assert.deepEqual(posted.map((m) => m.type), ['agents', 'agent_loaded']);
  assert.equal(ui.info.length, 0, 'no toast for the fleet');
});

test('a subagent asking in a background chat is named in the toast', async () => {
  const { p, sent, ev } = setup();
  p.activeChat = 'mine';
  ev({ type: 'chats', chats: [{ id: 'c1', label: 'main' }, { id: 'mine', label: 'm', active: true }] });
  ui.answers.push('Open');
  ev({ type: 'ask', chat: 'c1', id: 'q', tool: 'write', agent: { id: 'a1', title: 'Fix the bug' } });
  assert.equal(ui.info.at(-1).msg, 'Subagent «Fix the bug» in chat «main» is waiting for your answer.');
  await flush();
  assert.deepEqual(sent.at(-1), { name: 'load_chat', value: 'c1' }, 'Open goes to the parent chat');
});

test('list_agents only to an agent that reported a fleet', () => {
  const { sent, ev } = setup();
  ev({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  assert.ok(!sent.some((c) => c.name === 'list_agents'), 'an older agent would answer with an error');
  ev({ type: 'agents', items: [] });
  sent.length = 0;
  ev({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  assert.deepEqual(sent.map((c) => c.name), ['state', 'resume_last', 'list_agents']);
});

test('the panel commands for subagents go to the agent as they are', () => {
  const { p, sent } = setup();
  p.fromWebview({ type: 'agent_command', name: 'open_agent', value: 'a1' });
  p.fromWebview({ type: 'agent_command', name: 'stop_agent', value: 'a1' });
  p.fromWebview({ type: 'agent_command', name: 'list_agents' });
  assert.deepEqual(sent, [
    { name: 'open_agent', value: 'a1' },
    { name: 'stop_agent', value: 'a1' },
    { name: 'list_agents', value: undefined },
  ]);
});
