// The machine card and the getting-started screen (E105): parsing of
// machine_state, the QR code of the phone link, when "Getting started" shows,
// closing it and bringing it back, the extension side (requests, the old
// agent, the stored choice) and the panel drawing it all on a fake DOM.
//
// The agent side is written against the same contract in parallel, so the
// parser takes every shape the contract allows and stays quiet on an old
// agent that never answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { runPanel, openMenu } from './fakedom.mjs';

function load(file, vscode = {}) {
  const req = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: vscode };
  const mod = req(file);
  Module._resolveFilename = orig;
  return mod;
}

const { LineParser, parseMachineState, isMachineStateRefusal, TUTORIAL_STEP_IDS } = load('./.protocol.cjs');
const { qrPicture, qrMatrix } = load('./.qr.cjs');
const { showStart, startSteps, machineRows } = load('./.panelLogic.cjs');
const { STRINGS } = load('./.webviewHtml.cjs');

const ev = (obj) => {
  const got = new LineParser().push(JSON.stringify(obj) + '\n');
  assert.equal(got.length, 1);
  return got[0];
};

const NOW = Date.parse('2026-11-10T09:00:00Z');

/** The contract payload, every field set. */
function full(over = {}) {
  return {
    type: 'machine_state',
    machine: {
      id: 'm-1', name: 'yz-laptop', os: 'linux', version: 'R7.9', logged_in: true,
      email_masked: 'a***@example.ru', plan: 'week_work',
      sources: [
        { id: 'execai', title: 'ExecAI', alive: true, checked_at: '2026-11-10T08:58:00Z' },
        { id: 'zai', title: 'Z.ai', alive: false, checked_at: '2026-11-10T08:30:00Z' },
      ],
      sync: { enabled: true, last_push_at: '2026-11-10T08:55:00Z', config: true,
        personal_memory_files: 3, projects: 2, mode: 'all' },
      presence: { listener_running: true, reachable_from_web: true },
    },
    tutorial: { steps: [
      { id: 'login', done: true }, { id: 'models', done: true }, { id: 'sync', done: false },
      { id: 'project', done: false }, { id: 'phone', done: false },
    ] },
    phone_url: 'https://chat.execai.ru/m/m-1',
    ...over,
  };
}

// ── protocol ────────────────────────────────────────────────────

test('machine_state: the contract payload is carried through', () => {
  const ms = parseMachineState(ev(full()));
  assert.deepEqual(ms.machine, {
    id: 'm-1', name: 'yz-laptop', os: 'linux', version: 'R7.9', logged_in: true,
    email_masked: 'a***@example.ru', plan: 'week_work',
    sources: [
      { id: 'execai', title: 'ExecAI', alive: true, checked_at: '2026-11-10T08:58:00Z' },
      { id: 'zai', title: 'Z.ai', alive: false, checked_at: '2026-11-10T08:30:00Z' },
    ],
    sync: { enabled: true, last_push_at: '2026-11-10T08:55:00Z', config: true,
      personal_memory_files: 3, projects: 2, mode: 'all' },
    presence: { listener_running: true, reachable_from_web: true },
  });
  assert.deepEqual(ms.tutorial, [
    { id: 'login', done: true }, { id: 'models', done: true }, { id: 'sync', done: false },
    { id: 'project', done: false }, { id: 'phone', done: false },
  ]);
  assert.equal(ms.phone_url, 'https://chat.execai.ru/m/m-1');
});

test('machine_state: missing and odd fields get safe defaults, not crashes', () => {
  const ms = parseMachineState(ev({ type: 'machine_state', machine: {
    name: 7, logged_in: 'yes', sources: [{ id: 'x' }, null, { title: 'no id' }, 'junk'],
    sync: { enabled: 1, personal_memory_files: '4', projects: -2, mode: 'teleport' },
    presence: null,
  } }));
  assert.equal(ms.machine.name, '7');
  assert.equal(ms.machine.logged_in, false, 'only a real true counts');
  assert.deepEqual(ms.machine.sources, [{ id: 'x', title: 'x', alive: false, checked_at: '' }],
    'a source without an id is dropped, a missing title shows the id');
  assert.deepEqual(ms.machine.sync, { enabled: false, last_push_at: '', config: false,
    personal_memory_files: 4, projects: 0, mode: '' });
  assert.deepEqual(ms.machine.presence, { listener_running: false, reachable_from_web: false });
  assert.deepEqual(ms.tutorial, [], 'no tutorial — no steps');
  assert.equal(ms.phone_url, '');
});

test('machine_state: tutorial steps in the fixed order, unknown ids ignored', () => {
  assert.deepEqual([...TUTORIAL_STEP_IDS], ['login', 'models', 'sync', 'project', 'phone']);
  const ms = parseMachineState(ev(full({ tutorial: { steps: [
    { id: 'phone', done: true }, { id: 'teleport', done: false }, { id: 'login', done: 1 },
    { id: 'login', done: true }, { id: 'sync' },
  ] } })));
  assert.deepEqual(ms.tutorial, [
    { id: 'login', done: false }, { id: 'sync', done: false }, { id: 'phone', done: true },
  ], 'the first entry of an id wins; done is a real true');
});

test('machine_state: the phone link must be a web link', () => {
  for (const bad of ['javascript:alert(1)', 'ftp://x/y', 'chat.execai.ru/m/1', 42, 'https://a b']) {
    assert.equal(parseMachineState(ev(full({ phone_url: bad }))).phone_url, '', String(bad));
  }
  assert.equal(parseMachineState(ev(full({ phone_url: 'http://172.16.0.3/m/x' }))).phone_url, 'http://172.16.0.3/m/x');
});

test('machine_state: other events and a payload without a machine say nothing', () => {
  assert.equal(parseMachineState(ev({ type: 'state', model: 'm' })), null);
  assert.equal(parseMachineState(ev({ type: 'machine_state' })), null);
  assert.equal(parseMachineState(ev({ type: 'machine_state', machine: 'x' })), null);
});

test('the old agent refusing machine_state is recognized, nothing else is', () => {
  assert.equal(isMachineStateRefusal(ev({ type: 'error', text: 'неизвестная команда: machine_state' })), true);
  assert.equal(isMachineStateRefusal(ev({ type: 'error', text: 'unknown command: machine_state' })), true);
  assert.equal(isMachineStateRefusal(ev({ type: 'error', chat: 'c', text: 'machine_state' })), false,
    'an error of a chat is about the chat');
  assert.equal(isMachineStateRefusal(ev({ type: 'error', text: 'неизвестная команда: bind' })), false);
  assert.equal(isMachineStateRefusal(ev({ type: 'notice', text: 'machine_state' })), false);
});

// ── the QR code ─────────────────────────────────────────────────

test('QR: a matrix with the three finder patterns, a quiet zone and a path', () => {
  const url = 'https://chat.execai.ru/m/0f3c1e2a-7b9d-4c1e-9a55-1c2d3e4f5a6b';
  const m = qrMatrix(url, 2);
  const n = m.length;
  assert.ok(n >= 25 + 4, 'a link this long needs version 2 or more, plus the border');
  assert.ok(m.every((row) => row.length === n), 'square');
  // The border is light all round.
  for (let i = 0; i < n; i++) {
    for (const [x, y] of [[i, 0], [i, 1], [0, i], [1, i], [i, n - 1], [n - 1, i]]) assert.equal(m[y][x], false);
  }
  // A finder pattern: a dark 7×7 ring, a light ring, a dark 3×3 core.
  const finder = (ox, oy) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const ring = x === 0 || y === 0 || x === 6 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      assert.equal(m[oy + y][ox + x], ring || core, `finder at ${ox},${oy}: ${x},${y}`);
    }
  };
  finder(2, 2); finder(n - 9, 2); finder(2, n - 9);

  // Without the border: the timing patterns and the format bits, which carry
  // their own BCH check — a shifted, flipped or mis-masked matrix fails here.
  const q = (x, y) => m[y + 2][x + 2];
  const size = n - 4;
  for (let i = 8; i < size - 8; i++) {
    assert.equal(q(i, 6), i % 2 === 0, `timing row at ${i}`);
    assert.equal(q(6, i), i % 2 === 0, `timing column at ${i}`);
  }
  let a = 0, b = 0;
  const bit = (v, i) => (v ? 1 << i : 0);
  for (let i = 0; i <= 5; i++) a |= bit(q(8, i), i);
  a |= bit(q(8, 7), 6) | bit(q(8, 8), 7) | bit(q(7, 8), 8);
  for (let i = 9; i < 15; i++) a |= bit(q(14 - i, 8), i);
  for (let i = 0; i < 8; i++) b |= bit(q(size - 1 - i, 8), i);
  for (let i = 8; i < 15; i++) b |= bit(q(8, size - 15 + i), i);
  assert.equal(a, b, 'both copies of the format bits agree');
  assert.equal(q(8, size - 8), true, 'the dark module');
  const fmt = a ^ 0x5412;
  const data = fmt >>> 10;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal(fmt & 0x3ff, rem & 0x3ff, 'the format bits pass their BCH check');
  assert.equal(data >>> 3, 0, 'error correction level M');

  const pic = qrPicture(url);
  assert.equal(pic.size, n);
  assert.match(pic.path, /^(M\d+ \d+h\d+v1h-\d+z)+$/, 'one path of dark runs');
  assert.deepEqual(qrPicture(url), pic, 'deterministic');
  assert.equal(qrPicture(''), null);
});

// ── when "Getting started" shows ─────────────────────────────────

test('showStart: empty chat, steps left, not closed', () => {
  const steps = [{ done: true }, { done: false }];
  assert.equal(showStart({ steps, dismissed: false, chatEmpty: true, forced: false }), true);
  assert.equal(showStart({ steps, dismissed: true, chatEmpty: true, forced: false }), false, 'closed by the user');
  assert.equal(showStart({ steps, dismissed: false, chatEmpty: false, forced: false }), false, 'a chat is going');
  assert.equal(showStart({ steps: [{ done: true }], dismissed: false, chatEmpty: true, forced: false }), false,
    'everything is done');
  assert.equal(showStart({ steps: [], dismissed: false, chatEmpty: true, forced: false }), false,
    'no machine_state (an old agent) — nothing to show');
});

test('showStart: asked for with the command — shown whatever the chat and the ticks', () => {
  assert.equal(showStart({ steps: [{ done: true }], dismissed: false, chatEmpty: false, forced: true }), true);
  assert.equal(showStart({ steps: [{ done: false }], dismissed: true, chatEmpty: false, forced: true }), true);
  assert.equal(showStart({ steps: [], dismissed: false, chatEmpty: true, forced: true }), false,
    'still nothing to draw without the steps');
});

// ── the steps and the card, as text ─────────────────────────────

const K = new Proxy({}, { get: (_, k) => String(k) });

test('startSteps: five steps with their ticks and the right actions', () => {
  const ms = parseMachineState(ev(full({ tutorial: { steps: [
    { id: 'login', done: false }, { id: 'models', done: false }, { id: 'sync', done: false },
    { id: 'project', done: false }, { id: 'phone', done: false },
  ] } })));
  const steps = startSteps(ms, null, K, NOW);
  assert.deepEqual(steps.map((s) => [s.id, s.done, s.action]), [
    ['login', false, 'login'], ['models', false, 'connect'], ['sync', false, 'sync_on'],
    ['project', false, 'bind'], ['phone', false, 'qr'],
  ]);
  for (const s of steps) {
    assert.ok(s.title && s.why && s.actionLabel, s.id + ': a title, why and a button');
  }
});

test('startSteps: a step done has no button, except the phone code', () => {
  const ms = parseMachineState(ev(full({ tutorial: { steps: TUTORIAL_STEP_IDS.map((id) => ({ id, done: true })) } })));
  const steps = startSteps(ms, { id: 'w', name: 'Shop' }, K, NOW);
  assert.deepEqual(steps.map((s) => s.action), ['', '', '', '', 'qr']);
  const proj = steps.find((s) => s.id === 'project');
  assert.ok(proj.lines.some((l) => l.includes('Shop')), 'the bound project is named');
});

test('startSteps: the models step says which source answered', () => {
  const ms = parseMachineState(ev(full()));
  const models = startSteps(ms, null, STRINGS.en, NOW).find((s) => s.id === 'models');
  assert.ok(models.lines.some((l) => l.startsWith('✓') && l.includes('ExecAI') && l.includes(STRINGS.en.srcAlive)));
  assert.ok(models.lines.some((l) => l.startsWith('✗') && l.includes('Z.ai') && l.includes(STRINGS.en.srcDead)));
  const none = parseMachineState(ev(full({ machine: { ...full().machine, sources: [] } })));
  assert.deepEqual(startSteps(none, null, STRINGS.en, NOW).find((s) => s.id === 'models').lines, [STRINGS.en.srcNone]);
});

test('startSteps: the sync step says what goes, what stays and that the password is not recoverable', () => {
  for (const lang of ['en', 'ru']) {
    const T = STRINGS[lang];
    const ms = parseMachineState(ev(full()));
    const sync = startSteps(ms, null, T, NOW).find((s) => s.id === 'sync');
    for (const k of ['syncGoes', 'syncStays', 'syncPassword']) assert.ok(sync.lines.includes(T[k]), `${lang}: ${k}`);
  }
  assert.ok(/не восстанав/.test(STRINGS.ru.syncPassword));
  assert.ok(/адрес сервера/.test(STRINGS.ru.syncStays));
});

test('machineRows: every field of machine_state in plain words', () => {
  const T = STRINGS.en;
  const rows = machineRows(parseMachineState(ev(full())), T, NOW);
  const row = (k) => rows.find((r) => r.key === k);
  assert.deepEqual(rows.map((r) => r.key), ['machine', 'agent', 'account', 'models', 'sync', 'reach']);
  assert.ok(row('machine').value.includes('yz-laptop') && row('machine').value.includes('linux'));
  assert.equal(row('agent').value, 'R7.9');
  assert.ok(row('account').value.includes('a***@example.ru'));
  assert.ok(row('account').value.includes(T.planWork), 'the plan in words, not week_work');
  assert.ok(!row('account').value.includes('week_work'));
  assert.equal(row('models').lines.length, 2);
  assert.ok(row('models').lines[0].startsWith('✓ ExecAI'));
  assert.ok(row('models').lines[0].includes('2 ' + T.agoMin), 'checked 2 minutes ago');
  assert.ok(row('models').lines[1].startsWith('✗ Z.ai'));
  assert.equal(row('models').tone, 'warn', 'a source that did not answer');
  assert.ok(row('sync').value.startsWith(T.syncOn));
  assert.ok(row('sync').value.includes('5 ' + T.agoMin));
  assert.ok(row('sync').lines.includes(T.syncHasConfig));
  assert.ok(row('sync').lines.some((l) => l.includes('3') && l.startsWith(T.syncMemory)));
  assert.ok(row('sync').lines.some((l) => l.includes('2') && l.startsWith(T.syncProjects)));
  assert.ok(row('sync').lines.includes(T.modeAll));
  assert.ok(row('reach').lines.includes(T.reachListening));
  assert.ok(row('reach').lines.includes(T.reachWeb));
  assert.equal(row('reach').tone, 'ok');
});

test('machineRows: signed out, sync off, nobody listening', () => {
  const T = STRINGS.ru;
  const base = full().machine;
  const ms = parseMachineState(ev(full({ machine: { ...base, logged_in: false, email_masked: '', plan: '',
    sources: [], sync: { enabled: false }, presence: { listener_running: false, reachable_from_web: false } } })));
  const rows = machineRows(ms, T, NOW);
  const row = (k) => rows.find((r) => r.key === k);
  assert.equal(row('account').value, T.accNone);
  assert.equal(row('account').tone, 'warn');
  assert.equal(row('models').value, T.srcNone);
  assert.equal(row('sync').value, T.syncOff);
  assert.deepEqual(row('sync').lines, []);
  assert.ok(row('reach').lines.includes(T.reachNoListener));
  assert.ok(row('reach').lines.includes(T.reachNoWeb));
  assert.equal(row('reach').tone, 'warn');
});

// ── the extension side ──────────────────────────────────────────

const ui = { info: [], warn: [], commands: [] };
const vscodeStub = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  l10n: { t: (s, ...a) => s.replace(/\{(\d+)\}/g, (_, i) => String(a[+i])) },
  window: {
    createStatusBarItem: () => ({ text: '', tooltip: undefined, command: '', show() {}, dispose() {} }),
    showInformationMessage: (msg, ...items) => { ui.info.push({ msg, items }); return Promise.resolve(undefined); },
    showWarningMessage: (msg) => { ui.warn.push(msg); return Promise.resolve(undefined); },
    showQuickPick: async () => undefined,
  },
  commands: { executeCommand: (...a) => { ui.commands.push(a); return Promise.resolve(); } },
  workspace: {
    getConfiguration: () => ({ get: (_k, d) => d }),
    workspaceFolders: [{ uri: { fsPath: '/proj' } }],
  },
  env: { language: 'en', openExternal: () => {}, clipboard: { writeText() {} } },
  Uri: { parse: (s) => s, file: (s) => s },
};
const { ChatViewProvider } = load('./.chatView.cjs', vscodeStub);

function setup(opts = {}) {
  ui.info.length = 0; ui.warn.length = 0; ui.commands.length = 0;
  const wsState = new Map();
  const glState = opts.global || new Map();
  const mem = (m) => ({ get: (k, d) => (m.has(k) ? m.get(k) : d), update: async (k, v) => { m.set(k, v); } });
  const ctx = { subscriptions: [], extensionUri: {}, workspaceState: mem(wsState), globalState: mem(glState) };
  const p = new ChatViewProvider(ctx);
  const sent = [];
  const posted = [];
  p.client = {
    alive: true,
    sendCommand: (name, value, extra) => sent.push({ name, value, ...(extra || {}) }),
    sendUser() {}, sendAnswer() {}, stop() {}, newChat() {}, dispose() {},
  };
  p.view = { show() {}, webview: { postMessage: (m) => { posted.push(m); return Promise.resolve(true); } } };
  p.uiReady = true;
  const evx = (e) => p.fromAgent(e);
  return { p, sent, posted, ev: evx, wsState, glState };
}

test('ready asks the agent for machine_state', () => {
  const { sent, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  assert.ok(sent.some((c) => c.name === 'machine_state'));
});

test('machine_state reaches the panel normalized, with the QR of the phone link', () => {
  const { posted, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  posted.length = 0;
  evx(full());
  const got = posted.filter((m) => m.type === 'machine_state');
  assert.equal(got.length, 1);
  assert.equal(got[0].machine.name, 'yz-laptop');
  assert.equal(got[0].tutorial.length, 5);
  assert.equal(got[0].phone_url, 'https://chat.execai.ru/m/m-1');
  assert.ok(got[0].phone_qr && got[0].phone_qr.size > 20 && got[0].phone_qr.path.startsWith('M'));
  // No link — no code.
  posted.length = 0;
  evx(full({ phone_url: '' }));
  assert.equal(posted.at(-1).phone_qr, null);
});

test('an old agent refusing the command: no error in the chat, the card says to update', () => {
  const { posted, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  posted.length = 0;
  evx({ type: 'error', text: 'неизвестная команда: machine_state' });
  assert.ok(!posted.some((m) => m.type === 'error'), 'the refusal is swallowed');
  assert.deepEqual(posted.filter((m) => m.type === 'machine_state'), [{ type: 'machine_state', unsupported: true }]);
});

test('an old agent that stays silent: after the timeout the card says to update', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { posted, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  posted.length = 0;
  t.mock.timers.tick(14000);
  assert.equal(posted.filter((m) => m.type === 'machine_state').length, 0, 'not before the timeout');
  t.mock.timers.tick(2000);
  assert.deepEqual(posted.filter((m) => m.type === 'machine_state'), [{ type: 'machine_state', unsupported: true }]);
  // A late answer still wins.
  evx(full());
  assert.equal(posted.filter((m) => m.type === 'machine_state').at(-1).machine.name, 'yz-laptop');
});

test('an answer in time cancels the timeout', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { posted, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  evx(full());
  posted.length = 0;
  t.mock.timers.tick(60000);
  assert.ok(!posted.some((m) => m.type === 'machine_state' && m.unsupported));
});

test('other errors still reach the panel', () => {
  const { posted, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  evx({ type: 'error', text: 'неизвестная команда: bind' });
  assert.ok(posted.some((m) => m.type === 'error' && m.text.includes('bind')));
});

test('the card asks for a fresh machine_state; a refusing agent is not asked again', () => {
  const { p, sent, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  evx(full());
  sent.length = 0;
  p.fromWebview({ type: 'machine_refresh' });
  assert.deepEqual(sent.map((c) => c.name), ['machine_state']);

  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  evx({ type: 'error', text: 'unknown command: machine_state' });
  sent.length = 0;
  p.fromWebview({ type: 'machine_refresh' });
  assert.deepEqual(sent, [], 'it said it does not know the command');
});

test('"Getting started" closed: stored for every project, the panel told; the command brings it back', () => {
  const { p, posted, glState } = setup();
  p.fromWebview({ type: 'ui_ready' });
  assert.deepEqual(posted.filter((m) => m.type === 'start_prefs'), [{ type: 'start_prefs', dismissed: false }]);

  posted.length = 0;
  p.fromWebview({ type: 'start_dismiss' });
  assert.equal(glState.get('execai.startDismissed'), true, 'globalState, not the project state');
  assert.deepEqual(posted, [{ type: 'start_prefs', dismissed: true }]);

  // Another window, the same profile: closed there too.
  const other = setup({ global: glState });
  other.p.fromWebview({ type: 'ui_ready' });
  assert.deepEqual(other.posted.filter((m) => m.type === 'start_prefs'), [{ type: 'start_prefs', dismissed: true }]);

  posted.length = 0;
  p.showStart();
  assert.equal(glState.get('execai.startDismissed'), false);
  assert.deepEqual(posted.filter((m) => m.type === 'start_show'), [{ type: 'start_show' }]);

  // The panel menu item does the same.
  p.fromWebview({ type: 'start_dismiss' });
  posted.length = 0;
  p.fromWebview({ type: 'start_reopen' });
  assert.equal(glState.get('execai.startDismissed'), false);
  assert.deepEqual(posted.filter((m) => m.type === 'start_show'), [{ type: 'start_show' }]);
});

test('the machine card command toggles the card and asks for fresh data', () => {
  const { p, sent, posted, ev: evx } = setup();
  evx({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  sent.length = 0; posted.length = 0;
  p.toggleMachine();
  assert.deepEqual(posted, [{ type: 'machine_toggle' }]);
  assert.deepEqual(sent.map((c) => c.name), ['machine_state']);
});

test('the sync step opens a terminal with execai sync on; junk arguments are refused', () => {
  const { p } = setup();
  p.fromWebview({ type: 'open_terminal', text: 'sync on' });
  assert.deepEqual(ui.commands.at(-1), ['execai.openTerminal', ['sync', 'on']]);
  ui.commands.length = 0;
  p.fromWebview({ type: 'open_terminal', text: 'sync on; rm -rf ~' });
  assert.deepEqual(ui.commands, [['execai.openTerminal', []]], 'a plain terminal, no arguments');
});

test('the update button runs the install command', () => {
  const { p } = setup();
  p.fromWebview({ type: 'update_agent' });
  assert.deepEqual(ui.commands.at(-1), ['execai.installAgent']);
});

// ── the panel ───────────────────────────────────────────────────

const BUNDLES = ['./.webviewHtml.cjs', './.webviewHtml.min.cjs'];

function panel(bundle, lang = 'en') {
  const { chatHtml } = load(bundle);
  const p = runPanel(chatHtml({}, {}, lang));
  p.T = STRINGS[lang];
  return p;
}

/** machine_state as the extension forwards it. */
function forwarded(over = {}) {
  const ms = parseMachineState(ev(full(over)));
  return { type: 'machine_state', ...ms, phone_qr: qrPicture(ms.phone_url) };
}

const visible = (node) => node.classList.contains('on');

for (const bundle of BUNDLES) {
  const tag = bundle.includes('.min.') ? ' [minified]' : '';

  test('getting started: shown on an empty chat with steps left, five rows with ticks' + tag, () => {
    const p = panel(bundle);
    const start = p.byId('start');
    assert.equal(visible(start), false, 'nothing before machine_state');
    p.post({ type: 'start_prefs', dismissed: false });
    p.post({ type: 'ready', model: 'm', source: 's' });
    p.post(forwarded());
    assert.equal(visible(start), true);
    const rows = start.querySelectorAll('.st-step');
    assert.deepEqual(rows.map((r) => r.getAttribute('data-step')), ['login', 'models', 'sync', 'project', 'phone']);
    assert.deepEqual(rows.map((r) => r.classList.contains('done')), [true, true, false, false, false]);
    assert.ok(start.textContent.includes(p.T.startTitle));
  });

  test('getting started: hidden when closed, when all is done, when the chat has messages' + tag, () => {
    const p = panel(bundle);
    const start = p.byId('start');
    p.post({ type: 'start_prefs', dismissed: true });
    p.post(forwarded());
    assert.equal(visible(start), false, 'closed by the user');

    const q = panel(bundle);
    q.post({ type: 'start_prefs', dismissed: false });
    q.post(forwarded({ tutorial: { steps: TUTORIAL_STEP_IDS.map((id) => ({ id, done: true })) } }));
    assert.equal(visible(q.byId('start')), false, 'all done');

    const r = panel(bundle);
    r.post({ type: 'start_prefs', dismissed: false });
    r.post(forwarded());
    assert.equal(visible(r.byId('start')), true);
    r.post({ type: 'chat_loaded', chat: 'c', msgs: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }] });
    assert.equal(visible(r.byId('start')), false, 'a chat with messages');
    r.post({ type: 'chat_reset', chat: 'd' });
    assert.equal(visible(r.byId('start')), true, 'a new empty chat — back');
    r.byId('inp').value = 'do it';
    r.byId('sendBtn').onclick();
    assert.equal(visible(r.byId('start')), false, 'the first message hides it');
  });

  test('getting started: × closes it for good, the menu item brings it back' + tag, () => {
    const p = panel(bundle);
    const start = p.byId('start');
    p.post({ type: 'start_prefs', dismissed: false });
    p.post(forwarded());
    start.querySelector('.st-close').onclick();
    assert.deepEqual(p.sent.at(-1), { type: 'start_dismiss' });
    p.post({ type: 'start_prefs', dismissed: true });
    assert.equal(visible(start), false);

    const menu = openMenu(p);
    p.sent.length = 0;
    menu.querySelector('[data-mi="start"]').onclick();
    assert.deepEqual(p.sent, [{ type: 'start_reopen' }]);
    p.post({ type: 'start_show' });
    assert.equal(visible(start), true);

    // Asked for explicitly: shown even in a chat with messages and with everything done.
    p.post({ type: 'chat_loaded', chat: 'c', msgs: [{ role: 'user', text: 'hi' }] });
    p.post(forwarded({ tutorial: { steps: TUTORIAL_STEP_IDS.map((id) => ({ id, done: true })) } }));
    p.post({ type: 'start_show' });
    assert.equal(visible(start), true);
  });

  test('getting started: every button does its job with what the panel already has' + tag, () => {
    const p = panel(bundle);
    const start = p.byId('start');
    p.post({ type: 'start_prefs', dismissed: false });
    p.post({ type: 'state', model: 'm', source: 's', connectable: [{ id: 'zai', label: 'Z.ai' }] });
    p.post(forwarded({ tutorial: { steps: TUTORIAL_STEP_IDS.map((id) => ({ id, done: false })) } }));
    const btn = (id) => start.querySelector(`[data-step="${id}"]`).querySelector('.st-act');

    p.sent.length = 0;
    btn('login').onclick();
    assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'login' }]);

    p.sent.length = 0;
    btn('models').onclick();
    const menu = p.byId('menu');
    assert.ok(menu.classList.contains('open'), 'the connect list opens');
    assert.ok(menu.querySelector('[data-mi="item:zai"]'));

    p.sent.length = 0;
    btn('sync').onclick();
    assert.deepEqual(p.sent, [{ type: 'open_terminal', text: 'sync on' }]);

    p.sent.length = 0;
    btn('project').onclick();
    assert.deepEqual(p.sent, [{ type: 'pick_workspace' }]);

    p.sent.length = 0;
    btn('phone').onclick();
    const qr = start.querySelector('.qr');
    assert.ok(qr, 'the code is drawn');
    assert.ok(qr.innerHTML.startsWith('<svg') && qr.innerHTML.includes('<path d="M'), 'inline SVG, no request');
    assert.ok(start.textContent.includes('chat.execai.ru/m/m-1'));
    assert.deepEqual(p.sent, [], 'drawing the code sends nothing');
  });

  test('getting started: the sync step tells what goes and what stays (ru)' + tag, () => {
    const p = panel(bundle, 'ru');
    p.post({ type: 'start_prefs', dismissed: false });
    p.post(forwarded());
    const sync = p.byId('start').querySelector('[data-step="sync"]');
    for (const k of ['syncGoes', 'syncStays', 'syncPassword']) assert.ok(sync.textContent.includes(p.T[k]), k);
  });

  test('machine card: opens from the menu and the command, all fields, QR on request' + tag, () => {
    const p = panel(bundle);
    const card = p.byId('machine');
    assert.equal(visible(card), false);
    p.post({ type: 'machine_toggle' });
    assert.equal(visible(card), true);
    assert.ok(card.textContent.includes(p.T.machineLoading), 'waiting for the data');
    p.post(forwarded());
    const keys = card.querySelectorAll('.mc-row').map((r) => r.getAttribute('data-row'));
    assert.deepEqual(keys, ['machine', 'agent', 'account', 'models', 'sync', 'reach']);
    assert.ok(card.textContent.includes('yz-laptop'));
    assert.ok(card.textContent.includes('a***@example.ru'));
    assert.equal(card.querySelector('.qr'), null, 'the code is not drawn until asked');
    card.querySelector('.mc-qr').onclick();
    assert.ok(card.querySelector('.qr'));

    p.sent.length = 0;
    card.querySelector('.mc-refresh').onclick();
    assert.deepEqual(p.sent, [{ type: 'machine_refresh' }]);
    card.querySelector('.mc-close').onclick();
    assert.equal(visible(card), false);

    const menu = openMenu(p);
    p.sent.length = 0;
    menu.querySelector('[data-mi="machine"]').onclick();
    assert.equal(visible(card), true);
    assert.deepEqual(p.sent, [{ type: 'machine_refresh' }]);
  });

  test('one card at a time: the machine card hides getting started, and back' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'start_prefs', dismissed: false });
    p.post(forwarded());
    assert.equal(visible(p.byId('start')), true);
    p.post({ type: 'machine_toggle' });
    assert.equal(visible(p.byId('machine')), true);
    assert.equal(visible(p.byId('start')), false);
    p.byId('machine').querySelector('.mc-close').onclick();
    assert.equal(visible(p.byId('start')), true, 'closing the card brings the steps back');
    p.post({ type: 'machine_toggle' });
    p.post({ type: 'start_show' });
    assert.equal(visible(p.byId('machine')), false, 'asking for the steps closes the card');
    assert.equal(visible(p.byId('start')), true);
  });

  test('machine card: an old agent — a line to update it, nothing else' + tag, () => {
    const p = panel(bundle, 'ru');
    const card = p.byId('machine');
    p.post({ type: 'machine_toggle' });
    p.post({ type: 'machine_state', unsupported: true });
    assert.ok(card.textContent.includes(p.T.machineOld));
    assert.equal(card.querySelectorAll('.mc-row').length, 0);
    p.sent.length = 0;
    card.querySelector('.mc-update').onclick();
    assert.deepEqual(p.sent, [{ type: 'update_agent' }]);
    // And the getting-started screen stays away.
    p.post({ type: 'start_prefs', dismissed: false });
    assert.equal(visible(p.byId('start')), false);
  });

  test('machine card: an agent that exited clears it' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'start_prefs', dismissed: false });
    p.post(forwarded());
    assert.equal(visible(p.byId('start')), true);
    p.post({ type: 'machine_clear' });
    assert.equal(visible(p.byId('start')), false);
  });
}

test('browser page (execai ui): no terminal there — the sync step copies the command', async () => {
  const { readFileSync } = await import('node:fs');
  const { runBrowserPanel } = await import('./fakedom.mjs');
  const HOST = readFileSync(new URL('./.browserHost.js', import.meta.url), 'utf8');
  for (const bundle of BUNDLES) {
    const p = runBrowserPanel(load(bundle).browserHtml('en', HOST, {}));
    await p.flush();
    p.emit({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
    await p.flush();
    assert.ok(p.ins().some((m) => m.type === 'command' && m.name === 'machine_state'), 'asked on ready');
    p.emit(full());
    await p.flush();
    const start = p.byId('start');
    assert.ok(start.classList.contains('on'), bundle + ': shown in the browser too');
    const sync = start.querySelector('[data-step="sync"]');
    assert.ok(sync.textContent.includes('execai sync on'), 'the command is spelled out');
    sync.querySelector('.st-act').onclick();
    await p.flush();
    assert.deepEqual(p.copied, ['execai sync on']);
    // The stored choice lives in localStorage, for every project.
    start.querySelector('.st-close').onclick();
    await p.flush();
    assert.ok([...p.storage.keys()].includes('execai:global:execai.startDismissed'));
    assert.equal(start.classList.contains('on'), false);
  }
});

test('the new panel builders are bound to names in the page', () => {
  for (const bundle of BUNDLES) {
    const { chatHtml } = load(bundle);
    const html = chatHtml({}, {});
    for (const name of ['showStart', 'startSteps', 'machineRows']) {
      assert.ok(new RegExp('const ' + name + '\\s*=\\s*function').test(html), `${bundle}: ${name}`);
    }
  }
});

test('public texts: no prices, no "free", no third-party brands in the new strings', () => {
  const keys = ['startTitle', 'startLead', 'stLogin', 'stLoginWhy', 'stModels', 'stModelsWhy', 'stSync', 'stSyncWhy',
    'stProject', 'stProjectWhy', 'stPhone', 'stPhoneWhy', 'syncGoes', 'syncStays', 'syncPassword'];
  for (const lang of ['en', 'ru']) {
    for (const k of keys) {
      const s = STRINGS[lang][k];
      assert.ok(s, `${lang}.${k} exists`);
      assert.ok(!/бесплатн|free|vpn|₽|\$\d|руб|claude|cursor|openai|codex/i.test(s), `${lang}.${k}: ${s}`);
    }
  }
});
