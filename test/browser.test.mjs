// The browser page of `execai ui` (browserHtml + browserHost.ts), run on a
// fake DOM with fake fetch/EventSource: the transport shim, the translation
// of the panel's messages into the ide protocol, the HTML dialogs, uploads,
// the window around the chat — and that the VS Code page did not change
// (test/window.test.mjs keeps the look of the window and the editor page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBrowserPanel, runPanel, openMenu } from './fakedom.mjs';

function load(file) {
  const req = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: {} };
  const mod = req(file);
  Module._resolveFilename = orig;
  return mod;
}

const HOST = readFileSync(new URL('./.browserHost.js', import.meta.url), 'utf8');
const RU = JSON.parse(readFileSync(new URL('../l10n/bundle.l10n.ru.json', import.meta.url), 'utf8'));
const BUNDLES = ['./.webviewHtml.cjs', './.webviewHtml.min.cjs'];
const CWD = '/home/u/proj';

function html(bundle, lang = 'en') {
  return load(bundle).browserHtml(lang, HOST, lang === 'ru' ? RU : {});
}

/** A started page: ui_ready went out, the stream is open, the agent said ready. */
async function started(bundle, opts = {}) {
  const p = runBrowserPanel(html(bundle, opts.lang), opts);
  await p.flush();
  p.emit({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  await p.flush();
  return p;
}

/** Lets what the panel already posted go out, then starts a clean request log. */
async function settle(p) {
  await p.flush();
  p.requests.length = 0;
}

for (const bundle of BUNDLES) {
  const tag = bundle.includes('.min.') ? ' [minified]' : '';

  test('shim: the stream opens after ui_ready, its events reach the panel' + tag, async () => {
    const p = runBrowserPanel(html(bundle));
    assert.equal(p.sources.length, 0, 'not before the panel listens');
    await p.flush();
    assert.equal(p.sources.length, 1);
    assert.equal(p.sources[0].url, '/events');
    p.emit({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
    await p.flush();
    const notes = p.byId('log').querySelectorAll('.notice').map((n) => n.textContent);
    assert.ok(notes.some((t) => t.includes('glm · execai')), 'the panel drew ready');
    // The status bar of the editor: read out for a screen reader; the window
    // shows the model and the source under the input, the folder in the sidebar.
    assert.equal(p.byId('srStatus').textContent, 'ExecAI: glm · execai');
    assert.equal(p.byId('selModel').querySelector('.sel-v').textContent, 'glm');
    assert.equal(p.byId('selSource').querySelector('.sel-v').textContent, 'execai');
    assert.equal(p.byId('projPath').textContent, CWD);
    assert.equal(p.byId('projName').textContent, 'proj');
    assert.equal(p.document.title, 'proj — ExecAI');
    // POST /in: JSON, one message each, in order.
    const posts = p.requests.filter((r) => r.url === '/in');
    assert.ok(posts.every((r) => r.method === 'POST' && r.headers['Content-Type'] === 'application/json'));
    assert.deepEqual(p.ins(), [
      { type: 'command', name: 'state' },
      { type: 'command', name: 'resume_last' },
      { type: 'command', name: 'machine_state' },
      { type: 'command', name: 'list_chats' },
    ]);
  });

  test('the panel messages become ide-protocol input, like chatView does' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    await settle(p);

    p.byId('inp').value = 'hello';
    p.byId('sendBtn').onclick();
    p.byId('stopBtn').onclick();
    await p.flush();
    assert.deepEqual(p.ins(), [
      { type: 'user', text: 'hello', context: {}, chat: 'c1' },
      { type: 'stop', chat: 'c1' },
    ]);

    // agent_command → command; answer → answer; the + tab → new_chat.
    await settle(p);
    p.emit({ type: 'state', model: 'glm', source: 'execai', sources: [{ id: 'zai', label: 'Z.ai' }] });
    const menu = openMenu(p);
    menu.querySelector('[data-mi="sources"]').onclick();
    menu.querySelector('[data-mi="item:zai"]').onclick();
    p.emit({ type: 'ask', chat: 'c1', id: 'q1', tool: 'bash', options: [{ value: 'once', label: 'Once' }] });
    p.byId('log').querySelector('.ask').querySelector('button').onclick();
    p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'main', active: true }] });
    p.byId('newTab').onclick();
    await p.flush();
    assert.deepEqual(p.ins().filter((m) => m.name !== 'state' && m.name !== 'list_chats'), [
      { type: 'command', name: 'set_source', value: 'zai' },
      { type: 'answer', id: 'q1', value: 'once' },
      { type: 'new_chat' },
    ]);
  });

  test('tab order and folding live in localStorage, per project' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'chats', chats: [{ id: 'a', label: 'A', active: true }, { id: 'b', label: 'B' }] });
    p.byId('tabs').querySelector('[data-chat="b"]').querySelector('i').onclick({ stopPropagation() {} });
    await p.flush();
    const saved = JSON.parse(JSON.parse(p.storage.get(CWD.replace(/^/, 'execai:') + ':execai.tabs')));
    assert.deepEqual(saved.hidden, ['b']);
    assert.equal(p.ins().filter((m) => m.type === 'tabs_state').length, 0, 'tabs_state never goes to the agent');

    // A reload of the page gets it back.
    const q = runBrowserPanel(html(bundle), { storage: p.storage });
    await q.flush();
    q.emit({ type: 'chats', chats: [{ id: 'a', label: 'A', active: true }, { id: 'b', label: 'B' }] });
    assert.equal(q.byId('tabs').querySelector('[data-chat="b"]'), null);
  });

  test('a chat not on screen: no drawing, a toast with Open' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'main', active: true }, { id: 'c2', label: 'other' }] });
    const before = p.byId('log').children.length;
    p.emit({ type: 'text_delta', chat: 'c2', text: 'elsewhere' });
    p.emit({ type: 'done', chat: 'c2' });
    assert.equal(p.byId('log').children.length, before);
    const t = p.byId('toasts').querySelector('.toast');
    assert.ok(t.textContent.includes('Chat «other» finished its turn.'));
    await settle(p);
    t.querySelector('button').onclick();
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'load_chat', value: 'c2' }]);
    assert.equal(p.byId('toasts').children.length, 0, 'the toast is gone');
  });

  test('bind dialog: the project list as HTML, the pick goes out as bind' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'inbox', state: 'listening', bound_workspace: { id: 'b', name: 'Blog' } });
    p.byId('toasts').children.length = 0;
    const menu = openMenu(p);
    await settle(p);
    menu.querySelector('[data-mi="project"]').onclick();
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'list_workspaces' }]);
    p.emit({ type: 'workspaces', items: [{ id: 'a', name: 'Shop' }, { id: 'b', name: 'Blog' }] });
    await p.flush();
    const dlg = p.byId('dlg');
    assert.ok(dlg.classList.contains('open'));
    assert.equal(dlg.querySelector('.dlg-title').textContent, 'Bind this folder to a project');
    const items = dlg.querySelectorAll('.dlg-item');
    assert.deepEqual(items.map((b) => b.querySelector('b').textContent), ['Shop', '✓ Blog'],
      'the codicon becomes a check mark');
    await settle(p);
    items[0].onclick();
    await p.flush();
    assert.ok(!dlg.classList.contains('open'));
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'bind', value: 'a', workspace_id: 'a' }]);
  });

  test('connect and iteration-limit dialogs: input, validation, Esc' + tag, async () => {
    const p = await started(bundle, { lang: 'ru' });
    p.emit({ type: 'state', model: 'glm', source: 'execai', max_iter: 50,
      connectable: [{ id: 'zai', label: 'Z.ai' }] });
    const dlg = p.byId('dlg');

    // Connect: a password box, OK sends the key.
    let menu = openMenu(p);
    menu.querySelector('[data-mi="connect"]').onclick();
    menu.querySelector('[data-mi="item:zai"]').onclick();
    await p.flush();
    let inp = dlg.querySelector('input');
    assert.equal(inp.type, 'password');
    assert.equal(dlg.querySelector('.dlg-title').textContent, 'Ключ для zai');
    inp.value = 'sk-test';
    await settle(p);
    dlg.querySelector('.dlg-btns').querySelector('button.primary').onclick();
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'connect', value: 'zai', key: 'sk-test' }]);

    // Iteration limit: a bad value stays in the box with the reason.
    menu = openMenu(p);
    menu.querySelector('[data-mi="maxiter"]').onclick();
    await p.flush();
    inp = dlg.querySelector('input');
    assert.equal(inp.value, '50');
    inp.value = '0';
    await settle(p);
    inp.onkeydown({ key: 'Enter', preventDefault() {} });
    assert.equal(dlg.querySelector('.dlg-err').textContent, 'нужно положительное число');
    inp.value = '30';
    inp.onkeydown({ key: 'Enter', preventDefault() {} });
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'set_max_iterations', value: '30' }]);

    // Esc cancels: nothing is sent.
    menu = openMenu(p);
    menu.querySelector('[data-mi="maxiter"]').onclick();
    await settle(p);
    for (const f of p.docListeners.keydown) f({ key: 'Escape' });
    await p.flush();
    assert.ok(!dlg.classList.contains('open'));
    assert.deepEqual(p.ins(), []);
  });

  test('files: picked → POST /upload → chips with server paths → sent with the message' + tag, async () => {
    const p = await started(bundle, {
      respond: (r) => {
        if (r.url !== '/upload') return { status: 204 };
        const f = r.body.get('file');
        if (f.name === 'huge.bin') return { status: 413 };
        return { status: 200, json: { path: CWD + '/.execai/uploads/' + f.name, name: f.name } };
      },
    });
    p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    p.byId('filesBtn').onclick();
    await p.flush();
    const picker = p.body.querySelector('input');
    assert.equal(picker.type, 'file');
    assert.equal(picker.multiple, true);
    picker.files = [new File(['hello'], 'notes.txt', { type: 'text/plain' }), new File(['x'], 'huge.bin')];
    picker.onchange();
    for (let i = 0; i < 5; i++) await p.flush();
    const ups = p.requests.filter((r) => r.url === '/upload');
    assert.equal(ups.length, 2);
    assert.equal(ups[0].method, 'POST');
    assert.equal(ups[0].body.get('file').name, 'notes.txt');
    const chips = p.byId('chips').querySelectorAll('.chip');
    assert.equal(chips.length, 1);
    assert.ok(chips[0].textContent.includes('notes.txt'));
    assert.ok(p.byId('toasts').textContent.includes('huge.bin'), 'a refused upload is reported');

    await settle(p);
    p.byId('inp').value = 'read it';
    p.byId('sendBtn').onclick();
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'user', text: 'read it', context: { files: [CWD + '/.execai/uploads/notes.txt'] }, chat: 'c1' }]);
  });

  test('copy goes to the clipboard, links open in a new window, only http(s)' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'login_start', id: 'AB12', text: 'https://chat.execai.ru/device?c=AB12' });
    await p.flush();
    p.byId('log').querySelector('.login-copy').onclick();
    await p.flush();
    assert.deepEqual(p.copied, ['https://chat.execai.ru/device?c=AB12']);
    p.opened.length = 0;
    const log = p.byId('log');
    const click = (href) => {
      const a = { tagName: 'A', dataset: {}, getAttribute: () => href };
      for (const f of log.listeners.click) f({ composedPath: () => [a], preventDefault() {} });
    };
    click('https://execai.ru/docs');
    click('javascript:alert(1)');
    await p.flush();
    assert.deepEqual(p.opened, [['https://execai.ru/docs', '_blank', 'noopener,noreferrer']]);
  });

  test('what needs an editor is hidden' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'state', model: 'glm', source: 'execai', user: 'u@x' });
    const keys = openMenu(p).children.map((c) => c.getAttribute('data-mi')).filter(Boolean);
    for (const k of ['restart', 'terminal', 'updates']) assert.ok(!keys.includes(k), k);
    assert.ok(keys.includes('newchat'));
    // A file link in an answer posts nothing.
    await settle(p);
    const a = { tagName: 'A', dataset: { file: 'main.go', line: '3' }, getAttribute: () => '' };
    for (const f of p.byId('log').listeners.click) f({ composedPath: () => [a], preventDefault() {} });
    p.emit({ type: 'files_changed', chat: null, paths: ['main.go'] });
    await p.flush();
    assert.deepEqual(p.ins(), []);
    const row = p.byId('log').querySelector('.changed').querySelector('.frow');
    assert.equal(row.title, 'main.go');
    assert.equal(row.onclick, undefined, 'changed files are not links here');
  });

  test('only the host may talk to the panel' + tag, async () => {
    const p = await started(bundle);
    const before = p.byId('log').children.length;
    for (const f of p.winListeners.message) {
      f({ data: { type: 'notice', text: 'forged' }, origin: 'https://evil.example' });
    }
    assert.equal(p.byId('log').children.length, before);
  });

  test('a reconnect reopens the chat on screen, not the last one' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
    await settle(p);
    p.emit({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
    await p.flush();
    const cmds = p.ins().map((m) => m.name + (m.value ? ':' + m.value : ''));
    assert.ok(cmds.includes('load_chat:c1'), cmds.join(','));
    assert.ok(!cmds.includes('resume_last'));
  });

  test('every tab sees every event: a tab follows only its own chat switches' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'mine' }] });
    // Another browser tab opened c2: the agent now calls c2 active.
    p.emit({ type: 'chat_loaded', chat: 'c2', msgs: [{ role: 'user', text: 'theirs' }] });
    p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'one' }, { id: 'c2', label: 'two', active: true }] });
    assert.equal(p.byId('log').querySelector('.msg.user').textContent, 'mine');
    assert.ok(p.byId('tabs').querySelector('[data-chat="c1"]').classList.contains('active'),
      'this tab still marks the chat it shows');
    assert.ok(!p.byId('tabs').querySelector('[data-chat="c2"]').classList.contains('active'));
    // Its own switch goes through.
    p.byId('tabs').querySelector('[data-chat="c2"]').onclick();
    await p.flush();
    p.emit({ type: 'chat_loaded', chat: 'c2', msgs: [{ role: 'user', text: 'theirs' }] });
    assert.equal(p.byId('log').querySelector('.msg.user').textContent, 'theirs');
  });

  test('a second tab adopts the chat the agent has open' + tag, async () => {
    const p = await started(bundle);
    // resume_last had nothing to open (another tab holds the last chat).
    p.emit({ type: 'notice', text: 'nothing to continue' });
    await settle(p);
    p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'one', active: true }] });
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'load_chat', value: 'c1' }]);
  });

  test('subagents work the same in the browser' + tag, async () => {
    const p = await started(bundle);
    p.emit({ type: 'state', model: 'glm', source: 'execai', subagent_iter: 50 });
    p.emit({ type: 'agents', items: [{ id: 'a1', parent_chat: 'c1', title: 'Tests', state: 'running', iter: 1, max_iter: 15 }] });
    const row = p.byId('agents').querySelector('[data-agent="a1"]');
    assert.ok(row);
    await settle(p);
    row.querySelector('.ag-more').onclick({ stopPropagation() {} });
    row.querySelector('.ag-stop').onclick({ stopPropagation() {} });
    row.onclick();
    await p.flush();
    assert.deepEqual(p.ins(), [
      { type: 'command', name: 'extend_agent', value: 'a1' },
      { type: 'command', name: 'stop_agent', value: 'a1' },
      { type: 'command', name: 'open_agent', value: 'a1' },
    ]);
  });

  test('subagent steps dialog: 1 to 100, Esc sends nothing' + tag, async () => {
    const p = await started(bundle, { lang: 'ru' });
    p.emit({ type: 'state', model: 'glm', source: 'execai', max_iter: 50, subagent_iter: 50 });
    const dlg = p.byId('dlg');
    let menu = openMenu(p);
    menu.querySelector('[data-mi="subagentiter"]').onclick();
    await p.flush();
    assert.equal(dlg.querySelector('.dlg-title').textContent, 'Предел шагов нового субагента');
    const inp = dlg.querySelector('input');
    assert.equal(inp.value, '50');
    inp.value = '101';
    await settle(p);
    inp.onkeydown({ key: 'Enter', preventDefault() {} });
    assert.equal(dlg.querySelector('.dlg-err').textContent, 'нужно число от 1 до 100');
    inp.value = '80';
    inp.onkeydown({ key: 'Enter', preventDefault() {} });
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'command', name: 'set_subagent_iterations', value: '80' }]);

    menu = openMenu(p);
    menu.querySelector('[data-mi="subagentiter"]').onclick();
    await settle(p);
    for (const f of p.docListeners.keydown) f({ key: 'Escape' });
    await p.flush();
    assert.ok(!dlg.classList.contains('open'));
    assert.deepEqual(p.ins(), []);
  });
}

test('browser page: CSP with connect-src, the server slots, valid scripts', () => {
  for (const bundle of BUNDLES) {
    for (const lang of ['en', 'ru']) {
      const page = html(bundle, lang);
      assert.ok(page.includes(`script-src 'nonce-{{NONCE}}'; connect-src 'self'`), 'CSP');
      assert.equal(page.split('{{NONCE}}').length - 1, 4, 'the CSP and three scripts: the look, the host, the panel');
      assert.equal(page.split('{{CONFIG}}').length - 1, 1);
      assert.ok(page.includes('window.execaiPage.config = {{CONFIG}};'));
      assert.ok(page.includes(`<html lang="${lang}">`));
      const filled = page.split('{{CONFIG}}').join('{"lang":"en","cwd":"/x","version":"R6","upload":"/upload"}');
      const dir = mkdtempSync(join(tmpdir(), 'wvb-'));
      for (const [i, m] of [...filled.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)].entries()) {
        const f = join(dir, `s${i}.js`);
        writeFileSync(f, m[1]);
        execFileSync(process.execPath, ['--check', f]);
      }
    }
  }
  assert.ok(!/[А-Яа-я]/.test(html(BUNDLES[0], 'en')), 'the English page has no Cyrillic');
});

test('the VS Code page still talks to acquireVsCodeApi and draws as before', () => {
  const { chatHtml } = load(BUNDLES[0]);
  const page = chatHtml({}, {});
  assert.ok(page.includes('const vscode = acquireVsCodeApi();'));
  assert.ok(!/const vscode = window\.execaiHost/.test(page));
  assert.ok(!page.includes('id="hdr"') && !page.includes('id="dlg"'));
  const p = runPanel(page);
  p.post({ type: 'state', model: 'm', source: 's', user: 'u@x' });
  const keys = openMenu(p).children.map((c) => c.getAttribute('data-mi')).filter(Boolean);
  assert.ok(keys.includes('restart') && keys.includes('terminal'));
});
