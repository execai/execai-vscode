// The panel script, run for real on a fake DOM: tasks from the site (E100.6).
//
// Every case runs twice — on the plain bundle and on a minified one. The
// release build is minified, and functions injected through toString() have
// already broken there once (renderMarkdown arrived renamed); the plain build
// cannot show that class of bug.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { runPanel, openMenu } from './fakedom.mjs';

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
const PAY = 'https://chat.execai.ru/settings/payment?utm_source=agent&utm_medium=vscode&utm_campaign=inbox';

function panel(bundle, lang) {
  const { chatHtml, STRINGS } = load(bundle);
  const p = runPanel(chatHtml({}, {}, lang));
  p.T = STRINGS[lang === 'ru' ? 'ru' : 'en'];
  return p;
}

const keyed = (menu, key) => menu.querySelector(`[data-mi="${key}"]`);
const keys = (menu) => menu.children.map(c => c.getAttribute('data-mi')).filter(Boolean);

for (const bundle of BUNDLES) {
  const tag = bundle.includes('.min.') ? ' [minified]' : '';

  test('old agent: no inbox event — no inbox section, no web marker' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'state', model: 'm', source: 's', user: 'u@x' });
    const menu = openMenu(p);
    assert.ok(keyed(menu, 'models'), 'the menu did render');
    for (const k of ['inbox', 'inbox_take', 'inbox_plans', 'project', 'unbind']) {
      assert.equal(keyed(menu, k), null, `"${k}" must not show without an inbox event`);
    }
    assert.equal(p.byId('status').querySelector('.inbox'), null);
  });

  for (const lang of ['en', 'ru']) {
    test(`six inbox states render with their actions (${lang})` + tag, () => {
      const p = panel(bundle, lang);
      const T = p.T;
      const show = (inbox) => {
        p.post({ type: 'inbox', ...inbox });
        p.sent.length = 0;
        return openMenu(p);
      };
      const click = (menu, key) => {
        const row = keyed(menu, key);
        assert.ok(row, `no "${key}" row`);
        p.sent.length = 0;
        row.onclick();
        return p.sent;
      };

      // listening, not bound: status line + "Project: not bound" → the picker.
      let m = show({ state: 'listening', bound_workspace: null });
      let row = keyed(m, 'inbox');
      assert.equal(row.getAttribute('data-inbox-state'), 'listening');
      assert.ok(row.textContent.includes(T.inboxListening));
      assert.equal(row.onclick, null, 'a plain status line is not clickable');
      assert.ok(keyed(m, 'project').textContent.includes(T.mProject + ': ' + T.projectNone));
      assert.equal(keyed(m, 'unbind'), null);
      assert.deepEqual(click(m, 'project'), [{ type: 'pick_workspace' }]);
      assert.ok(p.byId('status').querySelector('.inbox'), 'listening shows the marker by the model');

      // listening, bound: the project name and an unbind entry.
      m = show({ state: 'listening', bound_workspace: { id: 'w1', name: 'Shop' } });
      assert.ok(keyed(m, 'project').textContent.includes(T.mProject + ': Shop'));
      assert.deepEqual(click(m, 'unbind'), [{ type: 'agent_command', name: 'unbind' }]);

      // other_serve: the "Accept here" button takes the inbox over.
      m = show({ state: 'other_serve', owner_pid: 4242, bound_workspace: null });
      row = keyed(m, 'inbox');
      assert.equal(row.getAttribute('data-inbox-state'), 'other_serve');
      assert.ok(row.textContent.includes(T.inboxOtherServe));
      assert.ok(row.textContent.includes('4242'));
      assert.ok(keyed(m, 'inbox_take').textContent.includes(T.inboxTake));
      assert.deepEqual(click(m, 'inbox_take'), [{ type: 'agent_command', name: 'inbox_take' }]);
      assert.equal(p.byId('status').querySelector('.inbox'), null, 'the marker is for listening only');

      // other_ide: where it is accepted, no take-over button.
      m = show({ state: 'other_ide', owner_cwd: '/home/u/other', bound_workspace: null });
      row = keyed(m, 'inbox');
      assert.ok(row.textContent.includes(T.inboxOtherIde + '/home/u/other'));
      assert.equal(keyed(m, 'inbox_take'), null);
      assert.ok(keyed(m, 'project'));

      // no_plan: the plans text and the payment link; nothing to bind.
      m = show({ state: 'no_plan', bound_workspace: null });
      assert.ok(keyed(m, 'inbox').textContent.includes(T.inboxNoPlan));
      const plans = keyed(m, 'inbox_plans');
      assert.ok(plans.textContent.includes('chat.execai.ru/settings/payment'));
      assert.ok(!plans.textContent.includes('utm_'), 'the tracking query is not shown');
      assert.deepEqual(click(m, 'inbox_plans'), [{ type: 'open_external', text: PAY }], 'the click opens the full link');
      assert.equal(keyed(m, 'project'), null);

      // disabled: just the line (and the project, which still matters to serve).
      m = show({ state: 'disabled', bound_workspace: null });
      assert.ok(keyed(m, 'inbox').textContent.includes(T.inboxDisabled));
      assert.equal(keyed(m, 'inbox_take'), null);
      assert.equal(keyed(m, 'inbox_plans'), null);

      // not_logged_in: the line itself is the usual sign-in.
      m = show({ state: 'not_logged_in', bound_workspace: null });
      row = keyed(m, 'inbox');
      assert.ok(row.textContent.includes(T.inboxNotLoggedIn));
      assert.ok(row.classList.contains('act'));
      assert.deepEqual(click(m, 'inbox'), [{ type: 'agent_command', name: 'login' }]);
      assert.equal(keyed(m, 'project'), null);

      // The extension clears the inbox when the agent exits.
      m = show({ state: '' });
      assert.equal(keyed(m, 'inbox'), null);
      assert.equal(keyed(m, 'project'), null);
    });
  }

  test('the inbox section sits between sign-in and the chat commands' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'state', model: 'm', source: 's', user: 'u@x' });
    p.post({ type: 'inbox', state: 'listening', bound_workspace: null });
    const order = keys(openMenu(p));
    assert.ok(order.indexOf('logout') < order.indexOf('inbox'));
    assert.ok(order.indexOf('inbox') < order.indexOf('project'));
    assert.ok(order.indexOf('project') < order.indexOf('resume'));
  });

  test('an open menu redraws when the inbox changes' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'inbox', state: 'other_serve', bound_workspace: null });
    const menu = openMenu(p);
    assert.ok(keyed(menu, 'inbox_take'));
    p.post({ type: 'inbox', state: 'listening', bound_workspace: null });
    assert.equal(keyed(menu, 'inbox_take'), null);
    assert.equal(keyed(menu, 'inbox').getAttribute('data-inbox-state'), 'listening');
  });

  test('web badge on the tab of a chat from the site' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'chats', chats: [
      { id: 'a', label: 'from the site', origin: 'web' },
      { id: 'b', label: 'mine', active: true },
      { id: 'c', label: 'flagged later' },
    ] });
    const tabs = p.byId('tabs');
    const tab = (id) => tabs.querySelector(`[data-chat="${id}"]`);
    assert.ok(tab('a').querySelector('b.web'), 'origin=web in the list → 🌐');
    assert.equal(tab('a').querySelector('b.web').title, p.T.tabWeb);
    assert.equal(tab('b').querySelector('b.web'), null);
    assert.equal(tab('c').querySelector('b.web'), null);
    // The extension learns origin from turn_start and passes it as a flag.
    p.post({ type: 'chat_flags', flags: { c: { web: true, busy: true } } });
    assert.ok(tab('c').querySelector('b.web'));
    assert.ok(tab('c').querySelector('b.busy'), 'state badges stay next to the origin badge');
  });

  test('the task from the site opens its chat under "From the web", not the moon' + tag, () => {
    const p = panel(bundle);
    const T = p.T;
    const log = p.byId('log');

    p.post({ type: 'turn_start', chat: 'w', origin: 'web' });
    p.post({ type: 'auto_user', chat: 'w', origin: 'web', text: 'fix the build' });
    let msgs = log.querySelectorAll('.msg.user');
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].classList.contains('auto') && msgs[0].classList.contains('web'));
    assert.equal(msgs[0].textContent, '\u{1F310} ' + T.webTurn + 'fix the build');

    // A wake-up stays a wake-up.
    p.post({ type: 'auto_user', chat: 'w', text: 'check the deploy' });
    msgs = log.querySelectorAll('.msg.user');
    assert.equal(msgs[1].textContent, '\u{1F319} ' + T.autoTurn + 'check the deploy');
    assert.ok(!msgs[1].classList.contains('web'));
  });

  test('an untagged auto_user in a chat known to be from the site is the task' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'chat_flags', flags: { w: { web: true } } });
    p.post({ type: 'chat_reset', chat: 'w' });
    p.post({ type: 'auto_user', chat: 'w', text: 'deploy it' });
    const msg = p.byId('log').querySelector('.msg.user');
    assert.ok(msg.classList.contains('web'));
    assert.equal(msg.textContent, '\u{1F310} ' + p.T.webTurn + 'deploy it');
  });

  test('reopening a chat from the site labels its first message' + tag, () => {
    const p = panel(bundle);
    p.post({ type: 'chats', chats: [{ id: 'w', label: 't', origin: 'web' }] });
    p.post({ type: 'chat_loaded', chat: 'w', msgs: [
      { role: 'user', text: 'fix the build' },
      { role: 'assistant', text: 'done' },
      { role: 'user', text: 'thanks, now tests' },
    ] });
    const msgs = p.byId('log').querySelectorAll('.msg.user');
    assert.equal(msgs.length, 2);
    assert.ok(msgs[0].classList.contains('web'));
    assert.ok(msgs[0].textContent.endsWith('fix the build'));
    assert.ok(!msgs[1].classList.contains('web'), 'only the opening message is the task');

    // An ordinary chat is untouched.
    p.post({ type: 'chat_loaded', chat: 'x', msgs: [{ role: 'user', text: 'hi' }] });
    assert.ok(!p.byId('log').querySelector('.msg.user').classList.contains('web'));

    // chat_loaded {origin} alone is enough, without the chat list.
    p.post({ type: 'chat_loaded', chat: 'y', origin: 'web', msgs: [{ role: 'user', text: 'deploy' }] });
    const first = p.byId('log').querySelector('.msg.user');
    assert.ok(first.classList.contains('web'));
    assert.equal(first.textContent, '\u{1F310} ' + p.T.webTurn + 'deploy');
  });

  test('ask_resolved takes an open question back' + tag, () => {
    const p = panel(bundle);
    const log = p.byId('log');
    p.post({ type: 'turn_start', chat: 'c' });
    p.post({ type: 'ask', chat: 'c', id: 'q1', tool: 'bash', summary: 'rm -rf build',
      options: [{ value: 'once', label: 'Allow once' }, { value: 'deny', label: 'Deny' }] });
    assert.equal(log.querySelectorAll('.ask').length, 1);

    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q1', by: 'web' });
    assert.equal(log.querySelectorAll('.ask').length, 0, 'the question box is gone');
    const notes = log.querySelectorAll('.notice').map(n => n.textContent);
    assert.ok(notes.includes(p.T.askResolved), 'a line says where it was answered');

    // Nothing to send: the panel never answers on the user's behalf.
    assert.ok(!p.sent.some(m => m.type === 'answer'));

    // A repeat or an unknown id is harmless.
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q1', by: 'web' });
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'nope', by: 'web' });
    assert.equal(log.querySelectorAll('.notice').filter(n => n.textContent === p.T.askResolved).length, 1);
  });

  test('ask_resolved keeps a question the user already answered here' + tag, () => {
    const p = panel(bundle);
    const log = p.byId('log');
    p.post({ type: 'ask', chat: 'c', id: 'q2', tool: 'bash', summary: 'ls',
      options: [{ value: 'once', label: 'Allow once' }] });
    const box = log.querySelector('.ask');
    box.querySelector('button').onclick();
    assert.deepEqual(p.sent.at(-1), { type: 'answer', id: 'q2', value: 'once' });
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q2', by: 'panel' });
    assert.ok(log.querySelector('.ask.answered'), 'the trail of the local answer stays');
    assert.equal(log.querySelectorAll('.notice').length, 0, 'by=panel adds nothing');
  });

  test('ask_resolved by=cancel: the question is withdrawn, not "answered on the site"' + tag, () => {
    const p = panel(bundle, 'ru');
    const log = p.byId('log');
    p.post({ type: 'ask', chat: 'c', id: 'q5', tool: 'bash', summary: 'make',
      options: [{ value: 'once', label: 'Allow once' }] });
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q5', by: 'cancel' });
    assert.equal(log.querySelectorAll('.ask').length, 0);
    const notes = log.querySelectorAll('.notice').map(n => n.textContent);
    assert.deepEqual(notes, [p.T.askCancelled]);
    assert.equal(p.T.askCancelled, 'Вопрос снят.');

    // Without by (or with an unknown one) the neutral line is used too.
    p.post({ type: 'ask', chat: 'c', id: 'q6', options: [] });
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q6' });
    assert.deepEqual(log.querySelectorAll('.notice').map(n => n.textContent), [p.T.askCancelled, p.T.askCancelled]);
  });

  test('ask_resolved by=panel on a box not answered here just disables it' + tag, () => {
    const p = panel(bundle);
    const log = p.byId('log');
    p.post({ type: 'ask', chat: 'c', id: 'q7', options: [{ value: 'once', label: 'Allow once' }] });
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q7', by: 'panel' });
    assert.ok(log.querySelector('.ask.answered'));
    assert.equal(log.querySelectorAll('.notice').length, 0);
  });

  test('ask_resolved by id (fallback) and after a chat switch' + tag, () => {
    const p = panel(bundle);
    const log = p.byId('log');
    p.post({ type: 'ask_user', chat: 'c', id: 'q3', question: 'Which branch?',
      options: [{ value: 'main', label: 'main' }] });
    p.post({ type: 'ask_resolved', chat: 'c', id: 'q3', by: 'web' });
    assert.equal(log.querySelectorAll('.ask').length, 0);

    // A question from a chat we left is not in the log any more; the agent
    // replays it on return only if it is still open.
    p.post({ type: 'ask', chat: 'c', id: 'q4', options: [] });
    p.post({ type: 'chat_reset', chat: 'd' });
    p.post({ type: 'ask_resolved', chat: 'c', ask_id: 'q4', by: 'web' });
    assert.equal(log.querySelectorAll('.notice').filter(n => n.textContent === p.T.askResolved).length, 0,
      'nothing is written into the log of another chat');
  });
}

test('inboxMenuEntries: unknown state and no inbox give an empty section', () => {
  const { inboxMenuEntries } = load('./.panelLogic.cjs');
  const T = new Proxy({}, { get: (_, k) => String(k) });
  assert.deepEqual(inboxMenuEntries(null, T, PAY), []);
  assert.deepEqual(inboxMenuEntries({ state: '' }, T, PAY), []);
  assert.deepEqual(inboxMenuEntries({ state: 'teleporting' }, T, PAY), []);
  const keysOf = (state, extra) => inboxMenuEntries({ state, ...extra }, T, PAY).map(e => e.key);
  assert.deepEqual(keysOf('listening'), ['inbox', 'project']);
  assert.deepEqual(keysOf('listening', { bound_workspace: { id: 'w', name: 'W' } }), ['inbox', 'project', 'unbind']);
  assert.deepEqual(keysOf('other_serve'), ['inbox', 'inbox_take', 'project']);
  assert.deepEqual(keysOf('other_ide'), ['inbox', 'project']);
  assert.deepEqual(keysOf('no_plan'), ['inbox', 'inbox_plans']);
  assert.deepEqual(keysOf('disabled'), ['inbox', 'project']);
  assert.deepEqual(keysOf('not_logged_in'), ['inbox']);
});

test('the inbox menu builder is bound to a name in the panel', () => {
  for (const bundle of BUNDLES) {
    const { chatHtml } = load(bundle);
    const html = chatHtml({}, {});
    assert.ok(/const inboxMenuEntries\s*=\s*function/.test(html),
      `${bundle}: no "const inboxMenuEntries = function…" binding — minification would lose the name`);
  }
});
