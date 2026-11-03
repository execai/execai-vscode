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
      const steps = T.agSteps.replace('{i}', '3').replace('{m}', '15').replace('{n}', '12');
      assert.match(r.querySelector('.ag-meta').textContent, new RegExp('^' + steps + ' · bash · 1:0[5-7]$'));
      assert.ok(!r.querySelector('.ag-meta').classList.contains('warn'), '12 left is no warning');
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

  for (const lang of ['en', 'ru']) {
    test(`steps: what is left, +25 on the go, a warning near the limit (${lang})` + tag, () => {
      const p = panel(bundle, lang);
      const T = p.T;
      p.post({ type: 'state', model: 'm', source: 's', subagent_iter: 50 });
      p.post({ type: 'agents', items: [
        AG({ iter: 12, max_iter: 50 }),
        AG({ id: 'a2', iter: 46, max_iter: 50, started_at: ago(30) }),
      ] });
      const meta = (id) => row(p, id).querySelector('.ag-meta');
      assert.ok(meta('a1').textContent.startsWith(
        T.agSteps.replace('{i}', '12').replace('{m}', '50').replace('{n}', '38') + ' · bash'));
      assert.ok(!meta('a1').classList.contains('warn'));
      // 4 left: drawn as a warning.
      assert.ok(meta('a2').textContent.startsWith(
        T.agSteps.replace('{i}', '46').replace('{m}', '50').replace('{n}', '4')));
      assert.ok(meta('a2').classList.contains('warn'));

      // +25 next to Stop; it posts extend_agent and does not open the transcript.
      const more = row(p, 'a1').querySelector('.ag-more');
      assert.equal(more.textContent, T.agentMore);
      assert.equal(more.title, T.agentMoreTitle);
      p.sent.length = 0;
      more.onclick({ stopPropagation() {} });
      assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'extend_agent', value: 'a1' }]);
      assert.equal(more.disabled, true, 'a double click does not give twice as much');
      // The limit grew: the snapshot redraws the row, the button is back.
      p.post({ type: 'agents', items: [AG({ iter: 13, max_iter: 75 })] });
      assert.ok(meta('a1').textContent.startsWith(
        T.agSteps.replace('{i}', '13').replace('{m}', '75').replace('{n}', '62')));
      assert.ok(!row(p, 'a1').querySelector('.ag-more').disabled);
      // A subagent being stopped gets no more steps.
      row(p, 'a1').querySelector('.ag-stop').onclick({ stopPropagation() {} });
      p.post({ type: 'agents', items: [AG({ iter: 13, max_iter: 75 })] });
      assert.equal(row(p, 'a1').querySelector('.ag-more').disabled, true);
    });

    test(`a subagent that hit its step limit can be continued (${lang})` + tag, () => {
      const p = panel(bundle, lang);
      const T = p.T;
      p.post({ type: 'state', model: 'm', source: 's', subagent_iter: 50 });
      p.post({ type: 'agents', items: [
        AG({ state: 'done', exhausted: true, iter: 50, max_iter: 50, started_at: ago(300), finished_at: ago(200) }),
        AG({ id: 'ok', state: 'done', iter: 7, max_iter: 50, started_at: ago(300), finished_at: ago(250) }),
      ] });
      const r = row(p, 'a1');
      assert.equal(r.getAttribute('data-state'), 'done');
      assert.equal(r.querySelector('.ag-meta').textContent, '50/50 · ' + T.agExhausted + ' · bash · 1:40');
      assert.ok(r.querySelector('.ag-meta').classList.contains('warn'));
      assert.ok(r.title.includes(T.agExhausted), 'the tooltip says why it stopped');
      assert.equal(r.querySelector('.ag-stop'), null);
      const cont = r.querySelector('.ag-more');
      assert.equal(cont.textContent, T.agentContinue);
      assert.equal(cont.title, T.agentContinueTitle);
      // A plain finish has neither the mark nor the button.
      assert.equal(row(p, 'ok').querySelector('.ag-meta').textContent, '7/50 · bash · 50' + T.secs);
      assert.equal(row(p, 'ok').querySelector('.ag-more'), null);

      p.sent.length = 0;
      cont.onclick({ stopPropagation() {} });
      assert.deepEqual(p.sent, [{ type: 'agent_command', name: 'extend_agent', value: 'a1' }]);
      // Continued: running again, with what is left and the usual buttons.
      p.post({ type: 'agents', items: [AG({ state: 'running', exhausted: false, iter: 50, max_iter: 75 })] });
      assert.ok(row(p, 'a1').querySelector('.ag-meta').textContent.startsWith(
        T.agSteps.replace('{i}', '50').replace('{m}', '75').replace('{n}', '25')));
      assert.equal(row(p, 'a1').querySelector('.ag-more').textContent, T.agentMore);
      assert.ok(row(p, 'a1').querySelector('.ag-stop'));
    });
  }

  test('an older agent (no subagent_iter): no +25 and no subagent steps in the menu' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'state', model: 'm', source: 's', max_iter: 50 });
    p.post({ type: 'agents', items: [AG()] });
    assert.equal(row(p, 'a1').querySelector('.ag-more'), null);
    assert.ok(row(p, 'a1').querySelector('.ag-stop'), 'Stop is still there');
    p.byId('status').onclick();
    assert.equal(p.byId('menu').querySelector('[data-mi="subagentiter"]'), null);
    // A newer agent comes up: the buttons show up without a new snapshot.
    p.post({ type: 'state', model: 'm', source: 's', max_iter: 50, subagent_iter: 40 });
    assert.ok(row(p, 'a1').querySelector('.ag-more'));
  });

  test('the menu has "Subagent steps" with the current value; a click asks for a number' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'state', model: 'm', source: 's', max_iter: 50, subagent_iter: 40 });
    p.byId('status').onclick();
    const item = p.byId('menu').querySelector('[data-mi="subagentiter"]');
    assert.ok(item);
    assert.ok(item.textContent.includes(p.T.mSubagentIter) && item.textContent.includes('40'));
    p.sent.length = 0;
    item.onclick();
    assert.deepEqual(p.sent.filter((m) => m.type === 'agent_command'),
      [{ type: 'agent_command', name: 'set_subagent_iterations' }]);
    assert.ok(!p.byId('menu').classList.contains('open'));
  });

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

test('fleetView: steps left, the warning at 5 or fewer, exhausted', () => {
  const { fleetView } = load('./.panelLogic.cjs');
  const T = { agSteps: 'step {i}/{m} · {n} left', agExhausted: 'hit the step limit', agDone: 'done' };
  const now = Date.parse('2026-11-01T12:00:00Z');
  const by = (v) => Object.fromEntries(v.rows.map((r) => [r.id, r]));
  const v = by(fleetView([
    { id: 'r12', state: 'running', iter: 12, max_iter: 50 },
    { id: 'r6', state: 'running', iter: 44, max_iter: 50 },
    { id: 'w5', state: 'waiting', iter: 45, max_iter: 50 },
    { id: 'q0', state: 'queued', iter: 0, max_iter: 50 },
    { id: 'over', state: 'running', iter: 52, max_iter: 50 },
    { id: 'nomax', state: 'running', iter: 3 },
    { id: 'ex', state: 'done', iter: 50, max_iter: 50, exhausted: true },
    { id: 'fin', state: 'done', iter: 7, max_iter: 50 },
    // A continued record that still carries the flag is going, not exhausted.
    { id: 'back', state: 'running', iter: 50, max_iter: 75, exhausted: true },
  ], now, T));
  assert.equal(v.r12.meta, 'step 12/50 · 38 left');
  assert.deepEqual([v.r12.left, v.r12.low], [38, false]);
  assert.deepEqual([v.r6.left, v.r6.low], [6, false], '6 left — not yet');
  assert.deepEqual([v.w5.left, v.w5.low], [5, true], '5 left — a warning');
  assert.equal(v.q0.meta, 'step 0/50 · 50 left');
  assert.deepEqual([v.over.left, v.over.low], [0, true], 'never below zero');
  assert.deepEqual([v.nomax.meta, v.nomax.left, v.nomax.low], ['3', -1, false], 'no limit — as before');
  assert.equal(v.ex.meta, '50/50 · hit the step limit');
  assert.deepEqual([v.ex.exhausted, v.ex.active, v.ex.low, v.ex.left], [true, false, false, -1]);
  assert.ok(v.ex.tip.startsWith('done · hit the step limit'));
  assert.equal(v.fin.meta, '7/50');
  assert.equal(v.fin.exhausted, false);
  assert.deepEqual([v.back.exhausted, v.back.meta], [false, 'step 50/75 · 25 left']);
  // Without the strings (an older bundle) the English defaults are used.
  const bare = fleetView([{ id: 'x', state: 'running', iter: 1, max_iter: 2 }], now, {});
  assert.equal(bare.rows[0].meta, 'step 1/2 · 1 left');
});

test('the fleet builder is bound to a name in the panel', () => {
  for (const bundle of BUNDLES) {
    const { chatHtml } = load(bundle);
    assert.ok(/const fleetView\s*=\s*function/.test(chatHtml({}, {})),
      `${bundle}: no "const fleetView = function…" binding — minification would lose the name`);
  }
});
