// The panel script, run for real on a fake DOM: subagents (E101) — the Agents
// block over the composer, the read-only transcript tab, the "2▶" badge on the
// parent's tab, questions from a subagent.
//
// Every case runs on the plain and on the minified bundle: fleetView is
// injected through toString(), the class of code minification broke before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { runPanel } from './fakedom.mjs';

function load(file) {
  const req = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: {} };
  const mod = req(file);
  Module._resolveFilename = orig;
  return mod;
}

const BUNDLES = ['./.webviewHtml.cjs', './.webviewHtml.min.cjs'];

function panel(bundle, lang) {
  const { chatHtml, STRINGS } = load(bundle);
  const p = runPanel(chatHtml({}, {}, lang));
  p.T = STRINGS[lang === 'ru' ? 'ru' : 'en'];
  return p;
}

const ago = (s) => new Date(Date.now() - s * 1000).toISOString();
const AG = (o = {}) => ({
  id: 'a1', parent_chat: 'c1', parent_tool_call: 't1', title: 'Run the tests', state: 'running',
  mode: 'read', iter: 3, max_iter: 15, last_tool: 'bash', started_at: ago(65), updated_at: 'u1',
  preview: 'go test ./...', session: 's1', source: 'execai', model: 'glm-5.3', prompt_tokens: 12345,
  ...o,
});

const rows = (p) => p.byId('agents').querySelectorAll('.ag-row');
const row = (p, id) => p.byId('agents').querySelector(`[data-agent="${id}"]`);
const commands = (p, name) => p.sent.filter((m) => m.type === 'agent_command' && m.name === name);

for (const bundle of BUNDLES) {
  const tag = bundle.includes('.min.') ? ' [minified]' : '';

  test('old agent: no agents event — no block, no badges' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'ready', model: 'm', source: 's' });
    p.post({ type: 'chats', chats: [{ id: 'c1', label: 'main', active: true }] });
    const box = p.byId('agents');
    assert.ok(!box.classList.contains('on'), 'the block is hidden');
    assert.equal(box.children.length, 0);
    assert.equal(p.byId('tabs').querySelector('b.agents'), null);
    assert.equal(commands(p, 'list_agents').length, 0, 'an old agent is never asked for its fleet');
  });

  for (const lang of ['en', 'ru']) {
    test(`a snapshot draws one row per subagent (${lang})` + tag, () => {
      const p = panel(bundle, lang);
      const T = p.T;
      p.post({ type: 'agents', items: [
        AG({ id: 'old', title: 'Lint', state: 'done', started_at: ago(300), finished_at: ago(200), iter: 4 }),
        AG(),
        AG({ id: 'bad', title: 'Deploy', state: 'failed', error: 'no access', started_at: ago(100), finished_at: ago(90) }),
      ] });
      const box = p.byId('agents');
      assert.ok(box.classList.contains('on'));
      const head = box.querySelector('.ag-head').textContent;
      assert.ok(head.includes(T.agentsHead));
      assert.ok(head.includes(T.agentsRunning.replace('{n}', '1')));
      assert.ok(head.includes(T.agentsDone.replace('{n}', '1')));
      assert.ok(head.includes(T.agentsFailed.replace('{n}', '1')));

      // Still going first, then the finished ones, newest first.
      assert.deepEqual(rows(p).map((r) => r.getAttribute('data-agent')), ['a1', 'bad', 'old']);
      const r = row(p, 'a1');
      assert.equal(r.getAttribute('data-state'), 'running');
      assert.equal(r.querySelector('.ag-st').textContent, '▶');
      assert.equal(r.querySelector('.ag-title').textContent, 'Run the tests');
      assert.match(r.querySelector('.ag-meta').textContent, /^3\/15 · bash · 1:0[5-7]$/);
      assert.ok(r.title.includes('glm-5.3') && r.title.includes('12k') && r.title.includes('go test'));
      assert.ok(row(p, 'bad').title.includes('no access'), 'the error is in the tooltip');
      assert.equal(row(p, 'bad').querySelector('.ag-st').textContent, '✗');
      assert.equal(row(p, 'old').querySelector('.ag-meta').textContent, '4/15 · bash · 1:40');

      // Stop only on the one still going; it posts stop_agent and does not open.
      assert.equal(row(p, 'old').querySelector('.ag-stop'), null);
      const stop = r.querySelector('.ag-stop');
      assert.equal(stop.textContent, T.agentStop);
      p.sent.length = 0;
      stop.onclick({ stopPropagation() {} });
      assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'stop_agent', value: 'a1' }]);
      assert.equal(stop.disabled, true);
      // A snapshot that still says "running" keeps the button disabled.
      p.post({ type: 'agents', items: [AG()] });
      assert.equal(row(p, 'a1').querySelector('.ag-stop').disabled, true);
    });
  }

  test('the block folds and unfolds; the choice is saved with the tabs' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'agents', items: [AG()] });
    p.sent.length = 0;
    p.byId('agents').querySelector('.ag-head').onclick();
    assert.equal(p.byId('agents').querySelector('.ag-list'), null);
    const st = p.sent.find((m) => m.type === 'tabs_state');
    assert.equal(JSON.parse(st.text).agents_collapsed, true);
    p.byId('agents').querySelector('.ag-head').onclick();
    assert.ok(p.byId('agents').querySelector('.ag-list'));
    assert.equal(commands(p, 'list_agents').length, 1, 'unfolding asks for a fresh snapshot');
    // Restored from tabs_state on the next start.
    const q = panel(bundle);
    q.post({ type: 'tabs_state', text: JSON.stringify({ hidden: [], order: [], agents_collapsed: true }) });
    q.post({ type: 'agents', items: [AG()] });
    assert.equal(q.byId('agents').querySelector('.ag-list'), null);
  });

  test('a parent tab carries "N▶" while its subagents work' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'chats', chats: [{ id: 'c1', label: 'main', active: true }, { id: 'c2', label: 'other' }] });
    p.post({ type: 'agents', items: [
      AG(), AG({ id: 'a2', state: 'queued' }), AG({ id: 'a3', state: 'done' }),
      AG({ id: 'a4', parent_chat: 'c2', state: 'waiting' }),
    ] });
    const tab = (id) => p.byId('tabs').querySelector(`[data-chat="${id}"]`);
    assert.equal(tab('c1').querySelector('b.agents').textContent, '2▶');
    assert.equal(tab('c1').querySelector('b.agents').title, p.T.tabAgents);
    assert.equal(tab('c2').querySelector('b.agents').textContent, '1▶');
    p.post({ type: 'agents', items: [AG({ state: 'done' })] });
    assert.equal(tab('c1').querySelector('b.agents'), null, 'all done — no badge');
  });

  test('a click opens the transcript in a read-only tab with the robot' + tag, () => {
    const p = panel(bundle);
    const log = p.byId('log');
    p.post({ type: 'chats', chats: [{ id: 'c1', label: 'main', active: true }] });
    p.post({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'parent task' }] });
    p.post({ type: 'agents', items: [AG()] });
    p.sent.length = 0;
    row(p, 'a1').onclick();
    assert.deepEqual(p.sent.at(-1), { type: 'agent_command', name: 'open_agent', value: 'a1' });
    const atab = p.byId('tabs').querySelector('[data-agent="a1"]');
    assert.ok(atab, 'the tab shows up at once');
    assert.equal(atab.querySelector('b.bot').textContent, '\u{1F916}');

    p.post({ type: 'agent_loaded', id: 'a1', title: 'Run the tests', state: 'running', messages: [
      { role: 'user', text: 'run go test' },
      { role: 'tool', tool: 'bash', text: 'go test ./...' },
      { role: 'assistant', text: 'All **green**.' },
    ] });
    assert.ok(p.body.classList.contains('agentview'), 'read-only: the input is hidden by CSS');
    assert.ok(p.byId('tabs').querySelector('[data-agent="a1"]').classList.contains('active'));
    assert.ok(!p.byId('tabs').querySelector('[data-chat="c1"]').classList.contains('active'),
      'the parent tab is not the current one while the transcript is on screen');
    assert.ok(log.querySelector('.agent-head').textContent.includes('Run the tests'));
    assert.equal(log.querySelector('.msg.user').textContent, 'run go test');
    assert.equal(log.querySelector('.tool-name').textContent, 'bash');
    assert.ok(log.querySelector('.msg.assistant').innerHTML.includes('<strong>green</strong>'));
    assert.ok(row(p, 'a1').classList.contains('on'));

    // The parent keeps streaming: none of it lands in the transcript.
    const before = log.children.length;
    p.post({ type: 'text_delta', chat: 'c1', text: 'parent words' });
    p.post({ type: 'tool_call', chat: 'c1', id: 'x', tool: 'read' });
    assert.equal(log.children.length, before);

    // The subagent moved on: the transcript reloads, once per change.
    p.sent.length = 0;
    p.post({ type: 'agents', items: [AG({ updated_at: 'u2', iter: 4 })] });
    p.post({ type: 'agents', items: [AG({ updated_at: 'u3', iter: 5 })] });
    assert.deepEqual(commands(p, 'open_agent'), [{ type: 'agent_command', name: 'open_agent', value: 'a1' }]);
    // u3 came in while u2 was loading: one more reload, then quiet.
    p.post({ type: 'agent_loaded', id: 'a1', title: 'Run the tests', state: 'running', messages: [{ role: 'user', text: 'run go test' }] });
    p.post({ type: 'agents', items: [AG({ updated_at: 'u3', iter: 5 })] });
    assert.equal(commands(p, 'open_agent').length, 2);
    p.post({ type: 'agent_loaded', id: 'a1', title: 'Run the tests', state: 'running', messages: [{ role: 'user', text: 'run go test' }] });
    p.post({ type: 'agents', items: [AG({ updated_at: 'u3', iter: 5 })] });
    assert.equal(commands(p, 'open_agent').length, 2, 'u3 is on screen — nothing to reload');

    // Back: clicking the parent tab loads it even though the agent calls it active.
    p.sent.length = 0;
    p.byId('tabs').querySelector('[data-chat="c1"]').onclick();
    assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'load_chat', value: 'c1' }]);
    p.post({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'parent task' }] });
    assert.ok(!p.body.classList.contains('agentview'));
    assert.ok(p.byId('tabs').querySelector('[data-agent="a1"]'), 'the subagent tab stays until closed');
    assert.ok(!p.byId('tabs').querySelector('[data-agent="a1"]').classList.contains('active'));
  });

  test('the "back" button and closing the tab return to the chat' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    p.post({ type: 'agents', items: [AG()] });
    row(p, 'a1').onclick();
    p.post({ type: 'agent_loaded', id: 'a1', title: 'T', state: 'done', messages: [] });
    p.sent.length = 0;
    p.byId('roBack').onclick();
    assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'load_chat', value: 'c1' }]);
    p.sent.length = 0;
    p.byId('tabs').querySelector('[data-agent="a1"]').querySelector('i').onclick({ stopPropagation() {} });
    assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'load_chat', value: 'c1' }]);
    assert.equal(p.byId('tabs').querySelector('[data-agent="a1"]'), null);
  });

  test('agent_loaded nobody asked for changes nothing' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'mine' }] });
    p.post({ type: 'agent_loaded', id: 'zz', title: 'Other', messages: [{ role: 'user', text: 'theirs' }] });
    assert.ok(!p.body.classList.contains('agentview'));
    assert.equal(p.byId('log').querySelector('.msg.user').textContent, 'mine');
  });

  test('a question from a subagent is labelled with its name and stays answerable' + tag, () => {
    const p = panel(bundle);
    const log = p.byId('log');
    p.post({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    p.post({ type: 'ask', chat: 'c1', id: 'q1', tool: 'write', summary: 'main.go',
      agent: { id: 'a1', title: 'Fix the bug' },
      options: [{ value: 'once', label: 'Allow once' }] });
    const box = log.querySelector('.ask');
    const label = box.querySelector('.ask-agent');
    assert.equal(label.textContent, '\u{1F916} ' + p.T.askFromAgent + 'Fix the bug');

    // The name opens the subagent; its open question survives the switch.
    p.sent.length = 0;
    label.onclick();
    assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'open_agent', value: 'a1' }]);
    p.post({ type: 'agent_loaded', id: 'a1', title: 'Fix the bug', state: 'waiting', messages: [{ role: 'user', text: 'fix it' }] });
    assert.equal(log.querySelectorAll('.ask').length, 1);
    log.querySelector('.ask').querySelector('button').onclick();
    assert.deepEqual(p.sent.at(-1), { type: 'answer', id: 'q1', value: 'once' });

    // A plain question has no label.
    p.post({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    p.post({ type: 'ask', chat: 'c1', id: 'q2', tool: 'bash', options: [] });
    assert.equal(log.querySelector('.ask').querySelector('.ask-agent'), null);
  });

  test('a new agent process starts with no block until it reports' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'agents', items: [AG()] });
    p.post({ type: 'ready', model: 'm', source: 's' });
    assert.ok(!p.byId('agents').classList.contains('on'));
    p.post({ type: 'agents', items: [] });
    assert.ok(!p.byId('agents').classList.contains('on'), 'an empty fleet draws nothing');
  });
}

test('fleetView: counts, order, unknown states and missing times', () => {
  const { fleetView } = load('./.panelLogic.cjs');
  const T = { secs: 's', agRunning: 'working', agTokens: 'tokens' };
  const now = Date.parse('2026-11-01T12:00:00Z');
  const v = fleetView([
    { id: 'q', state: 'queued', parent_chat: 'c', started_at: '2026-11-01T11:59:50Z' },
    { id: 'r', state: 'running', parent_chat: 'c', started_at: '2026-11-01T11:00:00Z', iter: 2 },
    { id: 'x', state: 'paused' },
    { id: 'd', state: 'done', started_at: '2026-11-01T09:00:00Z', finished_at: '2026-11-01T10:30:05Z' },
    { title: 'no id' },
    null,
  ], now, T);
  // Going first, oldest start first; then finished, newest first; no time — last.
  assert.deepEqual(v.rows.map((r) => r.id), ['r', 'q', 'd', 'x']);
  assert.deepEqual([v.running, v.done, v.failed], [2, 1, 0]);
  assert.deepEqual(v.perChat, { c: 2 });
  assert.equal(v.rows[0].meta, '2 · 1:00:00');
  assert.equal(v.rows[1].meta, '10s');
  assert.equal(v.rows[3].icon, '•', 'an unknown state is drawn neutrally');
  assert.equal(v.rows[3].meta, '', 'no times — no duration');
  assert.equal(v.rows[2].meta, '1:30:05');
  assert.equal(v.rows[0].title, 'r', 'no title — the id');
  assert.deepEqual(fleetView(null, now, T).rows, []);
});

test('the fleet builder is bound to a name in the panel', () => {
  for (const bundle of BUNDLES) {
    const { chatHtml } = load(bundle);
    assert.ok(/const fleetView\s*=\s*function/.test(chatHtml({}, {})),
      `${bundle}: no "const fleetView = function…" binding — minification would lose the name`);
  }
});
