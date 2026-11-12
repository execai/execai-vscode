// The window of `execai ui` (src/window, src/skins) and the wall between it
// and the editor panel:
//   - the page of the editor panel is, byte for byte, what it was before the
//     window got its own look;
//   - a skin and a theme are chosen in the window, remembered, applied
//     before the first paint — and the page works without storage;
//   - every string of the window is translated; the page loads nothing from
//     outside; colours are tokens with enough contrast in both themes;
//   - the window draws what the agent reports: chats, tools, a permission
//     request, changed files, the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { runBrowserPanel } from './fakedom.mjs';

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
const BOTH = load('./.webviewHtml.cjs');
const BOTH_MIN = load('./.webviewHtml.min.cjs');
// Built from src/webviewHtml.ts alone — the module graph the extension has.
const EDITOR = load('./.editorPage.cjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');

function page(lang = 'en', bundle = BOTH) {
  return bundle.browserHtml(lang, HOST, lang === 'ru' ? RU : {});
}

/** chatHtml with the nonce pinned: the only part of the page that is random. */
function editorPage(bundle, lang) {
  const random = Math.random;
  Math.random = () => 0.123456789;
  try { return bundle.chatHtml({}, {}, lang); } finally { Math.random = random; }
}

// ── the editor panel did not change ─────────────────────────────

// The page of the panel inside the editor as of 0.2.40 (origin/e105-release),
// before the window of `execai ui` existed. The window must not leak into it:
// not a rule, not a line of script, not a string.
//
// If the editor panel is changed ON PURPOSE, these hashes change with it: run
// the test, read the new hash from the failure and put it here — in the same
// commit as the change, so the review sees both.
const EDITOR_PAGE = {
  // sha256 of the whole page, as the unminified build makes it
  full: {
    en: '8509c2e0310e93754bea0a4e133eabcfd42fb1cefdb54e19685c8e4bc4928e52',
    ru: '5baf44ef0ad60fc538471cfc971d83e2dea855c8f9329d64997232fca9bd53e3',
  },
  // the same with the six functions injected through toString() cut out:
  // a minifier renames their locals, everything around them is plain text
  cut: {
    en: '78e88b7bb3c1240a8a2d37831a5edfadd7bcbb259f85013a62f0cd8bdc9b6ab0',
    ru: '504e16dcb988c4d895841e65744b33827c70cd36c92e18297f46c71f0aad07af',
  },
};
const cutInjected = (html) => {
  const out = html.replace(/const renderMarkdown = [\s\S]*?\nconst PAYMENT_URL = /, '<FN>');
  assert.notEqual(out, html, 'the injected functions were not found in the page');
  return out;
};

test('the editor panel page is byte for byte what it was (unminified build)', () => {
  for (const lang of ['en', 'ru']) {
    const got = sha(editorPage(EDITOR, lang));
    assert.equal(got, EDITOR_PAGE.full[lang],
      `the page of the editor panel (${lang}) changed; if that was the point, the new hash is ${got}`);
  }
});

test('the editor panel page outside the injected functions is the same in every build', () => {
  for (const [name, bundle] of [['editor-only', EDITOR], ['with the window', BOTH], ['with the window, minified', BOTH_MIN]]) {
    for (const lang of ['en', 'ru']) {
      const got = sha(cutInjected(editorPage(bundle, lang)));
      assert.equal(got, EDITOR_PAGE.cut[lang],
        `the page of the editor panel (${lang}, ${name}) changed; if that was the point, the new hash is ${got}`);
    }
  }
});

test('nothing of the window is in the editor panel page', () => {
  const html = editorPage(EDITOR, 'ru');
  for (const mark of ['sk-verstak', 'sk-beseda', 'sk-teletype', 'execaiLook', 'winSync', 'execai:ui:', 'winSkin', 'id="app"']) {
    assert.ok(!html.includes(mark), `the editor page has "${mark}"`);
  }
  assert.ok(html.includes('const BROWSER = false;'));
  assert.ok(html.includes('var(--vscode-foreground)'), 'the editor theme still colours it');
});

// ── the look: three skins, two themes, remembered ───────────────

const SKIN_IDS = BOTH.SKINS.map((s) => s.id);

async function started(opts = {}) {
  const p = runBrowserPanel(page(opts.lang, opts.bundle), opts);
  await p.flush();
  p.emit({ type: 'ready', model: 'glm', source: 'execai', protocol: 1 });
  await p.flush();
  return p;
}
const look = (p) => ({ skin: p.documentElement.className, theme: p.documentElement.getAttribute('data-theme') });
const pick = (p, attr, value) => {
  if (!p.byId('pop').classList.contains('open')) p.byId('lookBtn').onclick();
  const b = p.byId('pop').querySelector(`[${attr}="${value}"]`);
  assert.ok(b, `no ${attr}=${value} in the look panel`);
  b.onclick();
};

test('three skins; the workbench and the dark theme by default', async () => {
  assert.deepEqual(SKIN_IDS, ['verstak', 'beseda', 'teletype']);
  assert.equal(BOTH.DEFAULT_SKIN, 'verstak');
  const p = await started();
  assert.deepEqual(look(p), { skin: 'sk-verstak', theme: 'dark' }, 'dark until the person picks a theme, whatever the system says');
  // The picker shows all three, the current one checked.
  p.byId('lookBtn').onclick();
  const pop = p.byId('pop');
  assert.ok(pop.classList.contains('open'));
  assert.deepEqual(pop.querySelectorAll('[data-skin]').map((b) => [b.getAttribute('data-skin'), b.getAttribute('aria-checked')]),
    [['verstak', 'true'], ['beseda', 'false'], ['teletype', 'false']]);
  assert.deepEqual(pop.querySelectorAll('[data-theme-set]').map((b) => [b.getAttribute('data-theme-set'), b.getAttribute('aria-checked')]),
    [['system', 'false'], ['light', 'false'], ['dark', 'true']]);
});

test('the choice is applied at once, stored, and comes back on a reload', async () => {
  const p = await started();
  pick(p, 'data-skin', 'beseda');
  assert.deepEqual(look(p), { skin: 'sk-beseda', theme: 'dark' });
  assert.equal(p.storage.get('execai:ui:skin'), 'beseda');
  assert.equal(p.storage.has('execai:ui:theme'), false, 'a look was picked, not a theme');
  assert.equal(p.byId('pop').querySelector('[data-skin="beseda"]').getAttribute('aria-checked'), 'true');
  // A reload with a look and no theme stored: still dark.
  assert.deepEqual(look(runBrowserPanel(page(), { storage: p.storage })), { skin: 'sk-beseda', theme: 'dark' });
  pick(p, 'data-theme-set', 'light');
  assert.deepEqual(look(p), { skin: 'sk-beseda', theme: 'light' });
  assert.equal(p.storage.get('execai:ui:theme'), 'light');

  // A reload: the stored look is on <html> before the page draws anything.
  const q = runBrowserPanel(page(), { storage: p.storage });
  assert.deepEqual(look(q), { skin: 'sk-beseda', theme: 'light' }, 'an explicit light theme, whatever the system says');
  await q.flush();
  pick(q, 'data-theme-set', 'dark');
  assert.equal(look(q).theme, 'dark');
  // "As the system" is a pick too: the attribute goes, the media query decides — and it is kept as that.
  pick(q, 'data-theme-set', 'system');
  assert.deepEqual(look(q), { skin: 'sk-beseda', theme: null });
  assert.equal(q.storage.get('execai:ui:theme'), 'system');
  const r = runBrowserPanel(page(), { storage: q.storage });
  assert.deepEqual(look(r), { skin: 'sk-beseda', theme: null }, 'who chose the system keeps it: no dark by default for them');
  pick(q, 'data-skin', 'teletype');
  assert.deepEqual(look(runBrowserPanel(page(), { storage: q.storage })), { skin: 'sk-teletype', theme: null });
});

test('the look is set in <head>, before the stylesheet and the body', () => {
  for (const lang of ['en', 'ru']) {
    const html = page(lang);
    const head = html.indexOf('window.execaiLook');
    assert.ok(head > 0 && head < html.indexOf('<style>') && head < html.indexOf('<body'),
      'the look script must run before anything is painted');
    assert.ok(html.indexOf('<script nonce="{{NONCE}}">') < head, 'under the nonce the CSP allows');
  }
});

test('a stored value the page does not know is ignored', async () => {
  const storage = new Map([['execai:ui:skin', 'nope'], ['execai:ui:theme', 'purple']]);
  const p = runBrowserPanel(page(), { storage });
  assert.deepEqual(look(p), { skin: 'sk-verstak', theme: 'dark' });
  assert.equal(p.run('LOOK.fresh'), true, 'nothing the page knows was picked');
});

test('without storage the page works: the default look, and a choice lasts until a reload', async () => {
  const broken = {
    getItem: () => { throw new Error('storage is disabled'); },
    setItem: () => { throw new Error('storage is disabled'); },
  };
  const p = await started({ localStorage: broken });
  assert.deepEqual(look(p), { skin: 'sk-verstak', theme: 'dark' });
  assert.ok(p.byId('log').querySelectorAll('.notice').some((n) => n.textContent.includes('glm')), 'the page drew ready');
  pick(p, 'data-skin', 'teletype');
  pick(p, 'data-theme-set', 'light');
  assert.deepEqual(look(p), { skin: 'sk-teletype', theme: 'light' });
  p.byId('introDone').onclick();
  assert.ok(p.byId('lookIntro').hidden, 'kept as it is, storage or not');
  // And the chat itself is alive.
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  p.byId('inp').value = 'hello';
  p.byId('sendBtn').onclick();
  await p.flush();
  assert.ok(p.ins().some((m) => m.type === 'user' && m.text === 'hello'));
});

// ── strings ─────────────────────────────────────────────────────

test('every string of the window is translated', () => {
  const { WINDOW_STRINGS, STRINGS, WINDOW_JS } = BOTH;
  const en = Object.keys(WINDOW_STRINGS.en).sort();
  assert.deepEqual(Object.keys(WINDOW_STRINGS.ru).sort(), en, 'the Russian bundle drifted from English');
  for (const k of en) {
    assert.ok(k.startsWith('win'), `${k}: window strings start with "win"`);
    assert.ok(!(k in STRINGS.en), `${k} is already a string of the panel`);
    assert.ok(WINDOW_STRINGS.en[k].trim() && WINDOW_STRINGS.ru[k].trim(), `${k} is empty`);
    assert.ok(!/[А-Яа-яЁё]/.test(WINDOW_STRINGS.en[k]), `${k}: Cyrillic in the English bundle`);
    assert.ok(/[А-Яа-яЁё]/.test(WINDOW_STRINGS.ru[k]), `${k}: no Russian text in the Russian bundle`);
  }
  // Everything the window script asks for exists — in the window's table or the panel's.
  const known = new Set([...en, ...Object.keys(STRINGS.en)]);
  const used = new Set([...WINDOW_JS.matchAll(/\bT\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
  assert.ok(used.size > 40, 'the script takes its text from T');
  for (const k of used) assert.ok(known.has(k), `the window script uses T.${k}, which no bundle has`);
  // Keys built at run time: the four suggestions.
  for (const n of [1, 2, 3, 4]) for (const k of ['winSg' + n, 'winSg' + n + 'D']) assert.ok(known.has(k), k);
  // No string of the window is dead weight.
  const html = page('en');
  for (const k of en) {
    assert.ok(used.has(k) || /^winSg\d/.test(k) || html.includes(WINDOW_STRINGS.en[k].replace(/&/g, '&amp;')),
      `${k} is used nowhere`);
  }
});

test('the window speaks the language of the page, with nothing left over from the other one', () => {
  const en = page('en'), ru = page('ru');
  assert.ok(!/[А-Яа-яЁё]/.test(en), 'the English page has no Cyrillic');
  for (const text of ['С чего начать', 'Изменённые файлы', 'Оформление', 'Как в системе', 'Можно начать с этого']) {
    assert.ok(ru.includes(text), `the Russian page lacks «${text}»`);
  }
  // Markup with a string missing would have thrown at build time; a visible
  // placeholder would be a string that was never filled in.
  for (const html of [en, ru]) assert.ok(!/undefined|\[object Object\]/.test(html.slice(html.indexOf('<body'), html.indexOf('<script', html.indexOf('<body')))));
});

// ── nothing from outside ────────────────────────────────────────

test('the page loads nothing from outside: no fonts, no scripts, no styles', () => {
  // Addresses the page may MENTION: the SVG namespace, links a click opens
  // (through the host, in a new window), examples in dialog prompts.
  const mentioned = new Set([
    'http://www.w3.org/2000/svg',
    'https://chat.execai.ru/settings/payment?utm_source=agent&utm_medium=vscode&utm_campaign=inbox',
    'https://execai.ru',
    'https://llm.corp.local', 'http://localhost:1234/v1', 'https://api.deepseek.com',
    'https://', 'http://',
  ]);
  for (const bundle of [BOTH, BOTH_MIN]) {
    for (const lang of ['en', 'ru']) {
      const html = page(lang, bundle);
      for (const m of html.matchAll(/https?:\/\/[^\s"'`<>()\\]*/g)) {
        assert.ok(mentioned.has(m[0].replace(/[.,;]+$/, '')), `an address in the page: ${m[0]}`);
      }
      assert.ok(!/<link\b/i.test(html), 'no <link>');
      assert.ok(!/<script[^>]+\bsrc\s*=/i.test(html), 'no script with a src');
      assert.ok(!/<(img|iframe|object|embed|video|audio|source)\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(html), 'no remote media');
      assert.ok(!/@import\b/.test(html), 'no @import');
      assert.ok(!/@font-face\b/.test(html), 'no web font: the page must look right offline');
      assert.ok(!/fonts\.(googleapis|gstatic)/.test(html));
      for (const m of html.matchAll(/url\(\s*["']?([^"')]{0,24})/g)) {
        assert.ok(m[1].startsWith('data:image/svg+xml,'), `url() must be an inline image: ${m[0]}`);
      }
      // The policy the page ships with allows none of it either.
      assert.ok(html.includes(`default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'nonce-{{NONCE}}'; connect-src 'self'`));
    }
  }
});

// ── colours: tokens only, enough contrast ───────────────────────

function css() {
  const html = page('en');
  return html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
}

test('every variable the stylesheet uses is defined; every skin defines every token', () => {
  const sheet = css();
  const defined = new Set([...sheet.matchAll(/(?:^|[\s;{])--([\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...sheet.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  for (const v of used) assert.ok(defined.has(v), `var(--${v}) is used but never defined`);
  for (const s of BOTH.SKINS) {
    assert.deepEqual(Object.keys(s.palette).sort(), [...BOTH.TOKENS].sort(), `${s.id}: its palette and the token list differ`);
    for (const [k, v] of Object.entries(s.palette)) {
      assert.equal(v.length, 2, `${s.id}: ${k} needs a light and a dark value`);
    }
    // light, dark by the system, dark by choice — and the explicit light theme wins over a dark system
    assert.ok(sheet.includes(`.${s.cls} { --bg: ${s.palette.bg[0]};`));
    assert.ok(sheet.includes(`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]).${s.cls} { --bg: ${s.palette.bg[1]};`));
    assert.ok(sheet.includes(`:root[data-theme="dark"].${s.cls} { --bg: ${s.palette.bg[1]};`));
  }
});

test('colours come from tokens: no literal colour in a skin', () => {
  // What may be literal: a QR code is black on white for the camera; scrims
  // and the drawer's shadow are black with an alpha; icons in masks are black.
  const sheet = css()
    .replace(/url\("data:[^"]*"\)/g, 'url()')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = sheet.slice(sheet.indexOf('*, *::before'));
  const hex = [...rules.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  assert.deepEqual(hex, ['#fff'], 'only the QR code background is a literal colour');
  for (const m of rules.matchAll(/rgba?\([^)]*\)/g)) {
    assert.match(m[0], /^rgba\(0, 0, 0, \.\d+\)$/, `a literal colour: ${m[0]}`);
  }
  assert.ok(!/\b(?:hsl|hwb|lab|lch|oklch|oklab)a?\(/.test(rules));
});

test('text keeps a contrast of 4.5:1 or better in both themes of every skin', () => {
  const lum = (hex) => {
    const v = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // [text, background] as the stylesheets put them on top of each other.
  const pairs = [];
  for (const bg of ['bg', 'panel', 'raised', 'hover', 'code-bg', 'accent-soft', 'warn-soft', 'add-bg', 'del-bg']) {
    for (const fg of ['fg', 'dim', 'mute']) pairs.push([fg, bg]);
  }
  for (const bg of ['bg', 'panel', 'raised', 'accent-soft']) {
    for (const fg of ['accent', 'ok', 'warn', 'err']) pairs.push([fg, bg]);
  }
  pairs.push(['warn', 'warn-soft'], ['ok', 'add-bg'], ['err', 'del-bg'], ['accent-fg', 'accent-bg']);
  // inverse blocks: the teletype's status line, its primary buttons, hover of small buttons
  pairs.push(['bg', 'fg'], ['bg', 'dim'], ['bg', 'err']);
  const bad = [];
  for (const s of BOTH.SKINS) {
    for (const [i, theme] of [[0, 'light'], [1, 'dark']]) {
      for (const [fg, bg] of pairs) {
        const r = ratio(s.palette[fg][i], s.palette[bg][i]);
        if (r < 4.5) bad.push(`${s.id}/${theme}: ${fg} ${s.palette[fg][i]} on ${bg} ${s.palette[bg][i]} = ${r.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('each skin keeps to its own class; motion stops for those who asked', () => {
  for (const s of BOTH.SKINS) {
    const own = s.css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of own.matchAll(/(^|[}\n])\s*([^{}@\n][^{}]*)\{/g)) {
      for (const sel of m[2].split(',')) {
        assert.ok(sel.trim().startsWith('.' + s.cls), `${s.id}: a rule outside its class: ${sel.trim()}`);
      }
    }
    for (const other of BOTH.SKINS) {
      if (other !== s) assert.ok(!own.includes(other.cls), `${s.id} touches ${other.id}`);
    }
  }
  const sheet = css();
  assert.match(sheet, /@media \(prefers-reduced-motion: reduce\) \{\s*\.app \*, \.app \*::before, \.app \*::after \{ animation: none !important; transition: none !important; \}/);
  assert.match(sheet, /\.app :focus-visible \{ outline: 2px solid var\(--focus\)/, 'the keyboard focus is visible');
});

// ── the window draws what the agent reports ─────────────────────

test('an empty chat greets; the first message turns the window to work', async () => {
  const p = await started();
  p.emit({ type: 'chat_reset', chat: 'c1' });
  const app = p.byId('app');
  assert.ok(app.classList.contains('is-empty') && !app.classList.contains('is-work'));
  assert.equal(p.byId('welcome').parentElement, p.byId('log'), 'the greeting is in the feed');
  p.byId('inp').value = 'fix the test';
  p.byId('sendBtn').onclick();
  assert.ok(app.classList.contains('is-work') && !app.classList.contains('is-empty'));
  assert.equal(p.byId('welcome').parentElement, null);
  const mine = p.byId('log').querySelector('.msg.user');
  assert.equal(mine.textContent, 'fix the test');
  assert.equal(mine.querySelector('.who').getAttribute('data-t'), 'You');
  // A new chat is empty again.
  p.byId('newTab').onclick();
  await p.flush();
  assert.ok(app.classList.contains('is-empty'));
  assert.equal(p.byId('welcome').parentElement, p.byId('log'));
});

test('tools: one box for a run of calls, the state of each, output on demand', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  p.emit({ type: 'turn_start', chat: 'c1' });
  p.emit({ type: 'tool_call', chat: 'c1', id: 't1', tool: 'Bash', summary: 'go test ./...' });
  const log = p.byId('log');
  let rows = log.querySelector('.tools').querySelectorAll('.tool');
  assert.equal(rows.length, 1);
  assert.ok(rows[0].classList.contains('run'));
  assert.equal(rows[0].querySelector('.t-name').textContent, 'Bash');
  assert.equal(rows[0].querySelector('.t-sum').textContent, 'go test ./...');
  p.emit({ type: 'tool_chunk', chat: 'c1', id: 't1', chunk: 'ok  pkg\n' });
  assert.equal(rows[0].open, true, 'output is shown while it runs');
  assert.equal(rows[0].querySelector('.t-out').textContent, 'ok  pkg\n');
  p.emit({ type: 'tool_result', chat: 'c1', id: 't1', tool: 'Bash', ok: true });
  assert.ok(!rows[0].classList.contains('run'));
  assert.ok(rows[0].querySelector('.t-st').classList.contains('ok'));
  assert.equal(rows[0].open, false, 'and folds back when the tool is done');
  p.emit({ type: 'tool_call', chat: 'c1', id: 't2', tool: 'Read', summary: 'main.go' });
  p.emit({ type: 'tool_result', chat: 'c1', id: 't2', tool: 'Read', ok: false, tail: 'no such file' });
  rows = log.querySelector('.tools').querySelectorAll('.tool');
  assert.equal(rows.length, 2, 'the next call joins the same box');
  assert.equal(log.querySelectorAll('.tools').length, 1);
  assert.ok(rows[1].querySelector('.t-st').classList.contains('fail'));
  assert.equal(rows[1].querySelector('.t-out').textContent, 'no such file');
  // An answer in between starts a new box.
  p.emit({ type: 'text_delta', chat: 'c1', text: 'Done.' });
  p.emit({ type: 'tool_call', chat: 'c1', id: 't3', tool: 'Grep', summary: 'TODO' });
  assert.equal(log.querySelectorAll('.tools').length, 2);
  p.emit({ type: 'done', chat: 'c1', text: 'ok' });
  assert.ok(!log.querySelectorAll('.tool').some((t) => t.classList.contains('run')), 'a finished turn leaves nothing running');
});

test('a permission request: the five answers of the agent, one click answers', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  await p.flush();
  p.requests.length = 0;
  const options = ['once', 'session', 'exact', 'always', 'deny'].map((v) => ({ value: v, label: v.toUpperCase(), description: 'about ' + v }));
  p.emit({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash', summary: 'rm -rf build', options, agent: { id: 'a1', title: 'cleaner' } });
  const box = p.byId('log').querySelector('.ask');
  assert.ok(box.classList.contains('perm'));
  assert.equal(box.getAttribute('data-tool'), 'bash');
  assert.equal(box.querySelector('.ask-cmd').textContent, 'rm -rf build');
  assert.ok(box.querySelector('.ask-from').textContent.includes('cleaner'), 'a subagent asking is named');
  const opts = box.querySelectorAll('.opt');
  assert.deepEqual(opts.map((b) => b.querySelector('b').textContent), ['ONCE', 'SESSION', 'EXACT', 'ALWAYS', 'DENY']);
  assert.ok(opts[0].classList.contains('primary') && opts[4].classList.contains('deny'));
  assert.equal(opts[3].title, 'about always', 'what an answer means is one hover away');
  assert.ok(p.byId('turnWait').classList.contains('on'), 'the turn line counts the question');
  opts[3].onclick();
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'answer', id: 'q1', value: 'always' }]);
  assert.ok(box.classList.contains('answered') && opts[3].classList.contains('chosen'));
  assert.ok(!p.byId('turnWait').classList.contains('on'));
  // A question of the agent is drawn the same way, without the permission colours.
  p.emit({ type: 'ask_user', chat: 'c1', id: 'q2', question: 'Which one?', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }] });
  const q = p.byId('log').querySelectorAll('.ask')[1];
  assert.ok(q.classList.contains('q') && !q.classList.contains('perm'));
  assert.equal(q.querySelector('.ask-q').textContent, 'Which one?');
});

test('changed files: a block in the feed and the list gathered beside it', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.emit({ type: 'files_changed', chat: 'c1', paths: ['internal/a.go', 'b.go'] });
  p.emit({ type: 'files_changed', chat: 'c1', paths: ['b.go', 'docs/c.md'] });
  const log = p.byId('log');
  assert.equal(log.querySelectorAll('.changed').length, 2, 'one block per turn');
  const first = log.querySelector('.changed');
  assert.equal(first.querySelector('.ch-n').textContent, '2');
  assert.equal(first.querySelector('.f-dir').textContent, 'internal/');
  assert.equal(first.querySelector('.f-name').textContent, 'a.go');
  const side = p.byId('files');
  assert.ok(side.classList.contains('on'));
  assert.deepEqual(side.querySelectorAll('.frow').map((r) => r.title), ['internal/a.go', 'b.go', 'docs/c.md'], 'each file once');
  assert.ok(!p.byId('app').classList.contains('no-rail'));
  // Another chat starts its own list.
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  assert.ok(!side.classList.contains('on'));
  assert.ok(p.byId('app').classList.contains('no-rail'), 'nothing beside the chat — no empty column');
});

test('the sidebar: chats of this project, closing one sends it to the history', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'a', msgs: [] });
  p.emit({ type: 'chats', chats: [{ id: 'a', label: 'Alpha', active: true }, { id: 'b', label: 'Beta', busy: true }, { id: 'c', label: '', origin: 'web' }] });
  const side = p.byId('sideChats');
  const rows = side.querySelectorAll('.chat');
  assert.deepEqual(rows.map((r) => r.querySelector('.c-t').textContent), ['Alpha', 'Beta', 'New chat']);
  assert.ok(rows[0].classList.contains('active'));
  assert.ok(rows[1].querySelector('.bdg.busy'), 'a chat at work says so');
  assert.ok(rows[2].querySelector('.bdg.web'), 'a task from the site says so');
  assert.equal(p.byId('headTitle').textContent, 'Alpha');
  assert.equal(p.byId('topChat').textContent, 'Alpha');
  await p.flush();
  p.requests.length = 0;
  rows[1].onclick();
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'command', name: 'load_chat', value: 'b' }]);
  // Closing: off the list and the strip, into the history; one click brings it back.
  rows[1].querySelector('.c-x').onclick({ stopPropagation() {} });
  assert.equal(side.querySelector('[data-chat="b"]'), null);
  assert.equal(p.byId('tabs').querySelector('[data-chat="b"]'), null);
  const hist = p.byId('sideHist');
  assert.equal(hist.querySelector('[data-chat="b"]').textContent, 'Beta');
  assert.equal(p.byId('sideHistLabel').hidden, false);
  p.requests.length = 0;
  hist.querySelector('[data-chat="b"]').onclick();
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'command', name: 'load_chat', value: 'b' }]);
  assert.ok(side.querySelector('[data-chat="b"]'), 'back on the list');
  assert.equal(p.byId('sideHistLabel').hidden, true);
});

test('model, source and reasoning are picked under the input; the status line shows the rest', async () => {
  const p = await started();
  p.emit({
    type: 'state', model: 'glm-5', source: 'execai', effort: 'high', security: 'deep', user: 'dev@example.com', max_iter: 50,
    models: [{ id: 'glm-5', label: 'GLM 5', active: true }, { id: 'kimi', label: 'Kimi' }],
    sources: [{ id: 'execai', label: 'ExecAI', active: true }, { id: 'zai', label: 'Z.ai' }],
    efforts: [{ id: 'off' }, { id: 'low' }, { id: 'medium' }, { id: 'high', active: true }, { id: 'max' }],
    securities: [{ id: 'light' }, { id: 'deep', active: true }],
  });
  p.emit({ type: 'inbox', state: 'listening', bound_workspace: { id: 'w', name: 'Shop' } });
  assert.equal(p.byId('selModel').querySelector('.sel-v').textContent, 'glm-5');
  assert.equal(p.byId('selEffort').querySelector('.sel-v').textContent, 'high');
  const bars = p.byId('selEffort').querySelector('.lvl').children;
  assert.deepEqual(bars.map((b) => b.className), ['on', 'on', 'on', ''], 'high is the third of four levels');
  assert.equal(p.byId('stSec').textContent, 'security: deep');
  assert.equal(p.byId('stInbox').textContent, 'Tasks from the web: accepted in this window');
  assert.equal(p.byId('acctMail').textContent, 'dev@example.com');
  assert.equal(p.byId('acctLogin').hidden, true);
  assert.equal(p.byId('projTag').textContent, 'bound');
  await p.flush();
  p.requests.length = 0;
  const menu = p.byId('menu');
  p.byId('selModel').onclick();
  assert.ok(menu.classList.contains('open'));
  menu.querySelector('[data-mi="item:kimi"]').onclick();
  assert.ok(!menu.classList.contains('open'));
  // A source picked from its own selector closes the list (from the root menu it stays open).
  p.byId('selSource').onclick();
  assert.ok(menu.querySelector('[data-mi="connect"]'), 'connecting a source is offered next to picking one');
  menu.querySelector('[data-mi="item:zai"]').onclick();
  assert.ok(!menu.classList.contains('open'));
  p.byId('selEffort').onclick();
  menu.querySelector('[data-mi="item:max"]').onclick();
  p.byId('stSec').onclick();
  menu.querySelector('[data-mi="item:light"]').onclick();
  await p.flush();
  assert.deepEqual(p.ins().filter((m) => m.name !== 'state'), [
    { type: 'command', name: 'set_model', value: 'kimi' },
    { type: 'command', name: 'set_source', value: 'zai' },
    { type: 'command', name: 'set_effort', value: 'max' },
    { type: 'command', name: 'set_security', value: 'light' },
  ]);
  // Signed out: the account says so and offers the sign-in.
  p.emit({ type: 'state', model: 'glm-5', source: 'execai' });
  assert.equal(p.byId('acctMail').textContent, 'not signed in');
  assert.equal(p.byId('acctLogin').hidden, false);
  p.requests.length = 0;
  p.byId('acctLogin').onclick();
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'command', name: 'login' }]);
});

const MACHINE = {
  type: 'machine_state',
  machine: {
    id: 'a3f9c1', name: 'workstation', os: 'linux', version: 'R7.18', logged_in: true, email_masked: 'd**@example.com', plan: 'week_work',
    sources: [{ id: 'execai', title: 'ExecAI', alive: true, checked_at: '' }, { id: 'ollama', title: 'Ollama', alive: false, checked_at: '' }],
    sync: { enabled: true, last_push_at: '', config: true, personal_memory_files: 3, projects: 1, mode: 'all' },
    presence: { listener_running: true, reachable_from_web: true },
  },
  tutorial: { steps: [{ id: 'login', done: true }, { id: 'models', done: true }, { id: 'sync', done: true }, { id: 'project', done: false }, { id: 'phone', done: false }] },
  phone_url: 'https://chat.execai.ru/m/a3f9c1',
};

test('the machine and getting started: beside an empty chat, over a working one on request', async () => {
  const p = await started();
  p.emit({ type: 'chat_reset', chat: 'c1' });
  p.emit(MACHINE);
  const machine = p.byId('machine'), start = p.byId('start'), sheet = p.byId('sheet'), app = p.byId('app');
  assert.ok(machine.classList.contains('on') && start.classList.contains('on'), 'both cards beside an empty chat');
  assert.equal(p.byId('info').parentElement, p.byId('rail'));
  assert.ok(!app.classList.contains('no-rail') && !sheet.classList.contains('open'));
  assert.deepEqual(machine.querySelectorAll('.mc-row').map((r) => r.getAttribute('data-row')),
    ['machine', 'agent', 'account', 'models', 'sync', 'reach']);
  assert.deepEqual(machine.querySelectorAll('.src').map((s) => s.className), ['src ok', 'src bad'], 'each source with its state');
  assert.equal(p.byId('sideStartV').textContent, '3 of 5');
  assert.equal(p.byId('stHost').textContent, 'workstation');
  const steps = start.querySelectorAll('.step');
  assert.deepEqual(steps.map((s) => s.className), ['step done', 'step done', 'step done', 'step todo next', 'step todo']);
  assert.ok(steps[3].querySelector('.st-act'), 'a step to do has its button');
  // The chat begins: the cards step aside.
  p.byId('inp').value = 'go';
  p.byId('sendBtn').onclick();
  assert.ok(!machine.classList.contains('on') && !start.classList.contains('on'));
  assert.ok(app.classList.contains('no-rail'), 'nothing to show beside the chat');
  // Asked for from the sidebar: over the window, and gone on close.
  p.byId('sideMachine').onclick();
  assert.ok(machine.classList.contains('on') && sheet.classList.contains('open'));
  assert.equal(p.byId('info').parentElement, sheet);
  machine.querySelector('.card-x').onclick();
  assert.ok(!machine.classList.contains('on') && !sheet.classList.contains('open'));
  await p.flush();
  p.requests.length = 0;
  p.byId('sideStart').onclick();
  await p.flush();
  assert.ok(start.classList.contains('on') && sheet.classList.contains('open'), 'getting started comes back on request');
  for (const f of p.docListeners.keydown) f({ key: 'Escape' });
  assert.ok(!sheet.classList.contains('open'), 'Esc closes it');
});

test('subagents: each with its state, steps and what can be done with it', async () => {
  const p = await started();
  p.emit({ type: 'state', model: 'glm', source: 'execai', subagent_iter: 50 });
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.emit({ type: 'agents', items: [
    { id: 'a1', parent_chat: 'c1', title: 'Tests', state: 'running', iter: 46, max_iter: 50 },
    { id: 'a2', parent_chat: 'c1', title: 'Docs', state: 'done', iter: 18, max_iter: 50 },
  ] });
  const box = p.byId('agents');
  assert.ok(box.classList.contains('on') && !p.byId('app').classList.contains('no-rail'));
  const rows = box.querySelectorAll('.ag');
  assert.deepEqual(rows.map((r) => [r.getAttribute('data-agent'), r.getAttribute('data-state')]), [['a1', 'running'], ['a2', 'done']]);
  assert.equal(rows[0].querySelector('.ag-steps').textContent, 'step 46/50 · 4 left');
  assert.ok(rows[0].querySelector('.ag-steps').classList.contains('warn'), 'few steps left is a warning');
  assert.equal(rows[0].querySelector('.ag-bar').querySelector('i').style.width, '92%');
  assert.ok(rows[0].querySelector('.ag-more') && rows[0].querySelector('.ag-stop'));
  assert.equal(rows[1].querySelector('.ag-steps').textContent, '18/50');
  assert.ok(rows[1].querySelector('.m-open') && !rows[1].querySelector('.ag-stop'), 'a finished one can only be opened');
  await p.flush();
  p.requests.length = 0;
  rows[1].querySelector('.m-open').onclick({ stopPropagation() {} });
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'command', name: 'open_agent', value: 'a2' }]);
  // Its transcript is read-only, with a tab of its own in the strip and the sidebar.
  p.emit({ type: 'agent_loaded', id: 'a2', title: 'Docs', state: 'done', messages: [{ role: 'assistant', text: 'All good.' }] });
  assert.ok(p.body.classList.contains('agentview'));
  assert.ok(p.byId('sideChats').querySelector('[data-agent="a2"]').classList.contains('active'));
  assert.equal(p.byId('headTitle').textContent, 'Docs');
  // The parent chat shows how many of its subagents are still going.
  p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'main' }] });
  assert.equal(p.byId('sideChats').querySelector('[data-chat="c1"]').querySelector('.bdg.sub').textContent, '1');
});

test('the turn: its step from the agent, the drawer of a narrow window', async () => {
  const p = await started({ narrow: true });
  p.emit({ type: 'state', model: 'glm', source: 'execai', max_iter: 50 });
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.emit({ type: 'turn_start', chat: 'c1' });
  assert.ok(p.body.classList.contains('busy'));
  assert.equal(p.byId('turnStep').textContent, '');
  p.emit({ type: 'iteration', chat: 'c1', n: 9 });
  assert.equal(p.byId('turnStep').textContent, 'step 9 of 50');
  assert.equal(p.byId('stStep').textContent, 'step 9/50');
  p.emit({ type: 'done', chat: 'c1', text: 'ok' });
  assert.ok(!p.body.classList.contains('busy'));
  assert.equal(p.byId('turnStep').textContent, '');
  const app = p.byId('app');
  p.byId('navBtn').onclick();
  assert.ok(app.classList.contains('side-open'));
  assert.equal(p.byId('navBtn').getAttribute('aria-expanded'), 'true');
  p.byId('scrim').onclick();
  assert.ok(!app.classList.contains('side-open'));
});

test('the first message of a project stays on screen when the agent opens a chat for it', async () => {
  const p = await started();
  // Nothing to resume: the page has no chat yet.
  p.emit({ type: 'notice', text: 'nothing to continue' });
  p.byId('inp').value = 'hello';
  p.byId('sendBtn').onclick();
  await p.flush();
  assert.deepEqual(p.ins().filter((m) => m.type === 'user'), [{ type: 'user', text: 'hello', context: {} }]);
  // The agent makes a chat for the message and announces it with a reset.
  p.emit({ type: 'chat_reset', chat: 'c1' });
  p.emit({ type: 'turn_start', chat: 'c1' });
  p.emit({ type: 'text_delta', chat: 'c1', text: 'Hi.' });
  const log = p.byId('log');
  assert.deepEqual(log.querySelectorAll('.msg').map((m) => m.textContent), ['hello', 'Hi.'], 'the question is above its answer');
  assert.ok(p.byId('app').classList.contains('is-work'));
  // A new chat asked for in the window is clean, whatever was sent before.
  p.emit({ type: 'done', chat: 'c1', text: 'ok' });
  p.byId('inp').value = 'again';
  p.byId('sendBtn').onclick();
  p.byId('newTab').onclick();
  await p.flush();
  p.emit({ type: 'chat_reset', chat: 'c2' });
  assert.equal(log.querySelectorAll('.msg').length, 0);
});

test('a tool summary does not repeat the tool name', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }, { role: 'tool', tool: 'Read', text: 'Read: main.go' }] });
  p.emit({ type: 'tool_call', chat: 'c1', id: 't1', tool: 'Bash', summary: 'Bash: ls -la — list' });
  p.emit({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash', summary: 'Bash: ls -la — list', options: [{ value: 'once', label: 'Once' }] });
  const log = p.byId('log');
  assert.deepEqual(log.querySelectorAll('.t-sum').map((n) => n.textContent), ['main.go', 'ls -la — list']);
  assert.equal(log.querySelector('.ask-cmd').textContent, 'ls -la — list');
});

// ── keys ────────────────────────────────────────────────────────

const PERM = ['once', 'session', 'exact', 'always', 'deny'].map((v) => ({ value: v, label: v.toUpperCase(), description: 'about ' + v }));

/** A chat with a permission request open, the request log cleared. */
async function asking(opts = {}) {
  const p = await started(opts);
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.emit({ type: 'turn_start', chat: 'c1' });
  p.emit({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash', summary: 'rm -rf build', options: PERM });
  const box = p.byId('log').querySelector('.ask');
  box._at = 0; // the request has been on screen for a while
  await p.flush();
  p.requests.length = 0;
  return { p, box };
}
const answers = (p) => p.ins().filter((m) => m.type === 'answer');

test('keys: the five answers of a permission request by their letters, in any layout', async () => {
  for (const [code, value] of [['KeyY', 'once'], ['KeyA', 'session'], ['KeyS', 'exact'], ['KeyF', 'always'], ['KeyN', 'deny']]) {
    const { p, box } = await asking();
    // A Russian layout: the key in Y's place types «н» — the place is what counts.
    const e = p.key({ code, key: 'н' });
    await p.flush();
    assert.deepEqual(answers(p), [{ type: 'answer', id: 'q1', value }], code);
    assert.ok(box.classList.contains('answered') && e.defaultPrevented);
  }
  // The hints are in the markup for a skin to show: a key on each answer, a line under them.
  const { box } = await asking();
  assert.deepEqual(box.querySelectorAll('.opt').map((b) => b.querySelector('.key').textContent), ['y', 'a', 's', 'f', 'n']);
  assert.equal(box.querySelector('.ask-hint').textContent, 'Enter — ONCE · Ctrl Enter — the same from an empty input · Esc — DENY');
  assert.equal(box.querySelector('.ask-hint').querySelector('.ah-3').querySelector('kbd').textContent, 'Ctrl Enter');
  assert.ok(box.querySelector('.ask-hint').classList.contains('key-line'));
});

test('keys: Enter allows once, Esc refuses', async () => {
  let { p } = await asking();
  p.key({ key: 'Enter', code: 'Enter' });
  await p.flush();
  assert.deepEqual(answers(p), [{ type: 'answer', id: 'q1', value: 'once' }]);
  ({ p } = await asking());
  p.key({ key: 'Escape', code: 'Escape' });
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'answer', id: 'q1', value: 'deny' }], 'refused — the turn is not stopped');
  // Esc from the input too; a letter or Enter typed there is typing.
  ({ p } = await asking());
  const inp = Object.assign(p.byId('inp'), { tagName: 'TEXTAREA' });
  for (const k of [{ code: 'KeyY', key: 'y' }, { code: 'KeyF', key: 'f' }, { code: 'KeyN', key: 'n' }, { code: 'Enter', key: 'Enter' }]) {
    const e = p.key({ ...k, target: inp });
    assert.ok(!e.defaultPrevented);
  }
  await p.flush();
  assert.deepEqual(p.ins(), [], 'nothing is answered from the input');
  p.key({ key: 'Escape', code: 'Escape', target: inp });
  await p.flush();
  assert.deepEqual(answers(p), [{ type: 'answer', id: 'q1', value: 'deny' }]);
});

test('keys: what must not answer', async () => {
  // A chord is not a letter; Shift+Enter is not Enter; Enter on a button is that button's.
  let { p, box } = await asking();
  p.key({ code: 'KeyA', key: 'a', ctrlKey: true });
  p.key({ code: 'KeyF', key: 'f', altKey: true });
  p.key({ code: 'KeyS', key: 'S', shiftKey: true });
  p.key({ code: 'Enter', key: 'Enter', shiftKey: true });
  p.key({ code: 'Enter', key: 'Enter', target: Object.assign(p.byId('filesBtn'), { tagName: 'BUTTON' }) });
  p.key({ code: 'KeyQ', key: 'q' });
  await p.flush();
  assert.deepEqual(p.ins(), []);
  // A key pressed as the request appears is not an answer to it.
  box._at = Date.now();
  p.key({ code: 'KeyF', key: 'f' });
  p.key({ code: 'Enter', key: 'Enter' });
  await p.flush();
  assert.deepEqual(p.ins(), []);
  // An open menu takes Esc for itself: it closes, the request stays.
  ({ p, box } = await asking());
  p.byId('cmdBtn').onclick();
  await p.flush();
  p.requests.length = 0;
  assert.ok(p.byId('menu').classList.contains('open'));
  p.key({ code: 'KeyY', key: 'y' });
  p.key({ key: 'Escape', code: 'Escape' });
  await p.flush();
  assert.ok(!p.byId('menu').classList.contains('open'));
  assert.deepEqual(answers(p), [], 'the first Esc only closed the menu');
  assert.ok(!box.classList.contains('answered'));
  // A request scrolled out of sight is shown, not refused blind.
  ({ p, box } = await asking());
  let shown = 0;
  Object.assign(p.byId('log'), { getBoundingClientRect: () => ({ top: 0, bottom: 600, height: 600 }) });
  Object.assign(box, { getBoundingClientRect: () => ({ top: -900, bottom: -700, height: 200 }), scrollIntoView: () => { shown++; } });
  p.key({ code: 'KeyY', key: 'y' });
  p.key({ key: 'Escape', code: 'Escape' });
  await p.flush();
  assert.deepEqual(p.ins(), []);
  assert.equal(shown, 1, 'Esc brought it into view');
  // A request of another chat is not on this page at all.
  ({ p } = await asking());
  p.key({ code: 'KeyN', key: 'n' });
  await p.flush();
  p.requests.length = 0;
  p.emit({ type: 'ask', chat: 'c2', id: 'q9', tool: 'Bash', summary: 'x', options: PERM });
  p.byId('toasts').children.length = 0;
  p.key({ code: 'KeyY', key: 'y' });
  await p.flush();
  assert.deepEqual(answers(p), []);
  // A question of the agent has no keys: it is not a yes or a no.
  const q = await started();
  q.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  q.emit({ type: 'ask_user', chat: 'c1', id: 'q2', question: 'Which?', options: [{ value: 'A', label: 'A' }] });
  q.byId('log').querySelector('.ask')._at = 0;
  await q.flush();
  q.requests.length = 0;
  q.key({ code: 'KeyY', key: 'y' });
  q.key({ code: 'Enter', key: 'Enter' });
  await q.flush();
  assert.deepEqual(q.ins(), []);
  assert.equal(q.byId('log').querySelector('.ask').querySelector('.key'), null);
});

test('keys: Esc stops the turn when no request is open; Ctrl+N and Cmd+N open a new chat', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  await p.flush();
  p.requests.length = 0;
  p.key({ key: 'Escape', code: 'Escape' });
  await p.flush();
  assert.deepEqual(p.ins(), [], 'nothing to stop');
  p.emit({ type: 'turn_start', chat: 'c1' });
  assert.equal(p.byId('turnEsc').hidden, false, 'the turn line may say so');
  // From the input as well; a dialog on top keeps Esc to itself.
  p.key({ key: 'Escape', code: 'Escape', target: Object.assign(p.byId('inp'), { tagName: 'TEXTAREA' }) });
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'stop', chat: 'c1' }]);
  p.requests.length = 0;
  p.byId('dlg').classList.add('open');
  p.key({ key: 'Escape', code: 'Escape' });
  p.key({ key: 'n', code: 'KeyN', ctrlKey: true });
  await p.flush();
  assert.deepEqual(p.ins(), []);
  p.byId('dlg').classList.remove('open');
  // With a request open Esc is its refusal, and the turn line stops offering the stop.
  p.emit({ type: 'ask', chat: 'c1', id: 'q1', tool: 'Bash', summary: 'x', options: PERM });
  assert.equal(p.byId('turnEsc').hidden, true);
  p.byId('log').querySelector('.ask')._at = 0;
  await p.flush();
  p.requests.length = 0;
  p.key({ key: 'Escape', code: 'Escape' });
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'answer', id: 'q1', value: 'deny' }]);
  // A new chat: from anywhere, the input included.
  for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
    p.requests.length = 0;
    const e = p.key({ key: 'n', code: 'KeyN', ...mod, target: Object.assign(p.byId('inp'), { tagName: 'TEXTAREA' }) });
    await p.flush();
    assert.ok(e.defaultPrevented, 'the browser must not open its own window');
    assert.deepEqual(p.ins().filter((m) => m.type === 'new_chat'), [{ type: 'new_chat' }]);
  }
  p.requests.length = 0;
  p.key({ key: 'N', code: 'KeyN', ctrlKey: true, shiftKey: true });
  await p.flush();
  assert.deepEqual(p.ins(), [], 'Ctrl+Shift+N is the browser\'s');
});

// ── the sidebar put away; the tab strip; code by lines ──────────

test('the sidebar is collapsed with a button, remembered, and a narrow window keeps its drawer', async () => {
  const p = await started();
  const app = p.byId('app');
  assert.ok(!app.classList.contains('side-off'));
  p.byId('navBtn').onclick();
  assert.ok(app.classList.contains('side-off') && !app.classList.contains('side-open'), 'a wide window: put away, not a drawer');
  assert.equal(p.storage.get('execai:ui:side'), 'off');
  assert.equal(p.byId('navBtn').getAttribute('aria-expanded'), 'false');
  // A reload keeps it; the same button brings the sidebar back.
  const q = await started({ storage: p.storage });
  assert.ok(q.byId('app').classList.contains('side-off'));
  q.byId('navBtn').onclick();
  assert.ok(!q.byId('app').classList.contains('side-off'));
  assert.equal(q.storage.get('execai:ui:side'), 'on');
  // Collapsed, a new chat is still one click away.
  q.byId('navBtn').onclick();
  await q.flush();
  q.requests.length = 0;
  q.byId('newTab').onclick();
  await q.flush();
  assert.deepEqual(q.ins().filter((m) => m.type === 'new_chat'), [{ type: 'new_chat' }]);
  // A narrow window: the stored choice does not apply, the button opens the drawer.
  const n = await started({ storage: p.storage, narrow: true });
  assert.ok(!n.byId('app').classList.contains('side-off'));
  n.byId('navBtn').onclick();
  assert.ok(n.byId('app').classList.contains('side-open') && !n.byId('app').classList.contains('side-off'));
  assert.equal(n.storage.get('execai:ui:side'), 'off', 'and is not changed by it');
  // The markup has what a collapsed window needs, hidden until then.
  const html = page('en');
  assert.match(html, /<button type="button" class="ib s-collapse js-side"/);
  assert.equal(html.split('side-show js-side').length - 1, 2, 'a way back in the tab strip and in the heading');
  assert.match(html, /\.side-show \{ display: none; \}/);
  assert.match(html, /\.app\.side-off \.side-show \{ display: inline-flex; \}/);
});

test('the tab strip scrolls under a fixed "+", and says on which side tabs are out of sight', async () => {
  const html = page('en');
  const nav = html.slice(html.indexOf('<nav class="tabs"'), html.indexOf('</nav>'));
  assert.ok(nav.indexOf('id="tabs"') < nav.indexOf('id="newTab"') && nav.indexOf('id="newTab"') < nav.indexOf('js-hist'),
    'the strip, then "+", then the rest');
  const p = await started();
  const strip = p.byId('tabs');
  const frame = { classList: p.byId('app').classList.constructor ? new (p.byId('app').classList.constructor)({ _class: '' }) : null };
  frame.classList.el = frame;
  frame._class = '';
  strip.parentElement = frame;
  p.emit({ type: 'chats', chats: [{ id: 'a', label: 'A', active: true }, { id: 'b', label: 'B' }] });
  assert.equal(strip.querySelector('.newtab'), null, '"+" is not inside what scrolls');
  assert.equal(frame._class, '', 'everything fits');
  Object.assign(strip, { scrollWidth: 900, clientWidth: 300, scrollLeft: 0 });
  for (const f of strip.listeners.scroll) f();
  assert.equal(frame._class, 'more-r');
  strip.scrollLeft = 200;
  for (const f of strip.listeners.scroll) f();
  assert.deepEqual(frame._class.split(' ').sort(), ['more-l', 'more-r']);
  strip.scrollLeft = 600;
  for (const f of strip.listeners.scroll) f();
  assert.equal(frame._class, 'more-l');
});

test('code is wrapped line by line, its text unchanged', async () => {
  const p = await started();
  const lines = (s) => p.run(`winLinesHtml(${JSON.stringify(s)})`);
  assert.equal(lines('a'), '<span class="l">a</span>');
  assert.equal(lines('a\n\n  b &lt;c&gt;'),
    '<span class="l">a\n</span><span class="l">\n</span><span class="l">  b &lt;c&gt;</span>');
  // Taking the tags away gives the block back as it was: copying is not affected.
  for (const s of ['', 'x', 'a\nb\n', '\n\n', 'func f() {\n\treturn 1\n}']) {
    assert.equal(lines(s).replace(/<[^>]+>/g, ''), s);
    assert.equal(lines(s).split('<span class="l">').length - 1, s.split('\n').length);
  }
  assert.match(page('en'), /pre\.code > code > \.l \{ display: block; \}/);
});

test('keys: Ctrl+Enter allows once from an empty input — and only then', async () => {
  const input = (p, value = '') => Object.assign(p.byId('inp'), { tagName: 'TEXTAREA', value });
  // From the empty input: once. Cmd+Enter is the same key on a Mac.
  for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
    const { p, box } = await asking();
    const e = p.key({ key: 'Enter', code: 'Enter', ...mod, target: input(p) });
    await p.flush();
    assert.deepEqual(p.ins(), [{ type: 'answer', id: 'q1', value: 'once' }]);
    assert.ok(e.defaultPrevented && box.classList.contains('answered'));
    assert.ok(box.querySelector('.opt.chosen').classList.contains('primary'), 'never more than "once" from the input');
  }
  // A message in the input: the chord is the message's, the request is not touched.
  let { p, box } = await asking();
  let e = p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(p, 'and also check the docs') });
  await p.flush();
  assert.deepEqual(answers(p), []);
  assert.ok(!e.defaultPrevented && !box.classList.contains('answered'));
  // Blank space is not a message.
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(p, '  \n') });
  await p.flush();
  assert.deepEqual(answers(p), [{ type: 'answer', id: 'q1', value: 'once' }]);
  // Files waiting to be sent keep the chord as well.
  ({ p, box } = await asking());
  p.emit({ type: 'files_attached', items: [{ path: '/x/a.txt', label: 'a.txt' }] });
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(p) });
  await p.flush();
  assert.deepEqual(answers(p), []);
  // Not in the first moment after the request appears.
  ({ p, box } = await asking());
  box._at = Date.now();
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(p) });
  await p.flush();
  assert.deepEqual(p.ins(), []);
  // Not while a menu is open: the key is the menu's.
  ({ p, box } = await asking());
  p.byId('cmdBtn').onclick();
  await p.flush();
  p.requests.length = 0;
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(p) });
  await p.flush();
  assert.deepEqual(answers(p), []);
  assert.ok(!box.classList.contains('answered'));
  // Not for a request out of sight; not with Shift or Alt; not on another button.
  ({ p, box } = await asking());
  Object.assign(p.byId('log'), { getBoundingClientRect: () => ({ top: 0, bottom: 600, height: 600 }) });
  Object.assign(box, { getBoundingClientRect: () => ({ top: -900, bottom: -700, height: 200 }) });
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(p) });
  Object.assign(box, { getBoundingClientRect: () => ({ top: 100, bottom: 300, height: 200 }) });
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, shiftKey: true, target: input(p) });
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, altKey: true, target: input(p) });
  p.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: Object.assign(p.byId('filesBtn'), { tagName: 'BUTTON' }) });
  await p.flush();
  assert.deepEqual(p.ins(), []);
  // With no request open the chord answers nothing.
  const q = await started();
  q.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  await q.flush();
  q.requests.length = 0;
  e = q.key({ key: 'Enter', code: 'Enter', ctrlKey: true, target: input(q) });
  await q.flush();
  assert.deepEqual(q.ins(), []);
  assert.ok(!e.defaultPrevented);
});

test('a call the person refused is neither done nor failed', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.emit({ type: 'tool_call', chat: 'c1', id: 't1', tool: 'Bash', summary: 'rm -rf build' });
  p.emit({ type: 'tool_result', chat: 'c1', id: 't1', tool: 'Bash', ok: true, denied: true, tail: 'The user declined to run this tool.' });
  p.emit({ type: 'tool_call', chat: 'c1', id: 't2', tool: 'Bash', summary: 'ls' });
  p.emit({ type: 'tool_result', chat: 'c1', id: 't2', tool: 'Bash', ok: true, tail: 'a.txt' });
  const rows = p.byId('log').querySelectorAll('.tool');
  assert.ok(rows[0].classList.contains('denied') && !rows[0].classList.contains('run'));
  const mark = rows[0].querySelector('.t-st');
  assert.equal(mark.className, 't-st denied', 'not the mark of a call that ran, nor of one that failed');
  assert.equal(mark.title, 'refused');
  assert.equal(rows[0].querySelector('.t-time').textContent, '', 'it did not run: no running time');
  assert.equal(rows[0].querySelector('.t-out').textContent, 'The user declined to run this tool.');
  assert.ok(!rows[1].classList.contains('denied'));
  assert.equal(rows[1].querySelector('.t-st').className, 't-st ok');
  assert.match(page('en'), /\.t-st\.denied \{ color: var\(--mute\); \}/);
});

// ── what those who draw the skins asked of the shared files ─────

test('a floating list is placed by the height it really takes, and stays inside the window', async () => {
  const p = await started();
  Object.assign(p.window, { innerWidth: 1440, innerHeight: 900 });
  const winPlace = p.run('winPlace');
  // A list of the given length: as tall as its max-height lets it be (440 is the stylesheet's own cap).
  const place = (natural, at, held) => {
    const style = {};
    const box = { style, getBoundingClientRect: () => ({ width: 300, height: Math.min(natural, held || parseFloat(style.maxHeight) || 440) }) };
    winPlace(box, { getBoundingClientRect: () => ({ left: 500, top: at, bottom: at + 30, width: 120, height: 30 }) });
    const top = parseFloat(style.top), height = box.getBoundingClientRect().height;
    return { top, height, bottom: top + height };
  };
  // Sixty models opened upwards from the bar under the input: the list ends above its button.
  let r = place(1900, 850);
  assert.deepEqual(r, { top: 8, height: 836, bottom: 844 }, 'a long list takes the room there is and scrolls inside');
  // A list a little over the old cap (the bug: placed as 440 tall, then let grow down).
  r = place(816, 850);
  assert.ok(r.top >= 8 && r.bottom <= 850, JSON.stringify(r));
  // The command menu is shown whole.
  r = place(489, 850);
  assert.equal(r.height, 489);
  assert.ok(r.bottom <= 850);
  // Less room above than the list would take: as much as there is, from the top edge.
  r = place(1900, 500);
  assert.deepEqual(r, { top: 8, height: 486, bottom: 494 });
  // Room below: under the button.
  r = place(200, 100);
  assert.deepEqual(r, { top: 136, height: 200, bottom: 336 });
  // A skin that holds the height itself still gets a list inside the window.
  p.window.innerHeight = 700;
  r = place(1900, 300, 560);
  assert.ok(r.top >= 8 && r.bottom <= 700 - 8, JSON.stringify(r));
  r = place(1900, 650, 560);
  assert.deepEqual(r, { top: 84, height: 560, bottom: 644 }, 'upwards: it ends at its button');
  // A window lower than any list.
  p.window.innerHeight = 200;
  r = place(500, 150);
  assert.ok(r.top >= 8 && r.bottom <= 150, JSON.stringify(r));
});

test('an answered request is not answered twice, and its buttons leave the Tab order', async () => {
  const { p, box } = await asking();
  const opts = box.querySelectorAll('.opt');
  assert.ok(opts.every((b) => b.tabIndex !== -1));
  opts[0].onclick();
  opts[4].onclick(); // Enter on a button the focus was left on
  await p.flush();
  assert.deepEqual(p.ins(), [{ type: 'answer', id: 'q1', value: 'once' }]);
  assert.deepEqual(opts.map((b) => b.classList.contains('chosen')), [true, false, false, false, false]);
  assert.ok(opts.every((b) => b.tabIndex === -1 && b.getAttribute('aria-disabled') === 'true'));
  // A question of the agent: the same.
  p.requests.length = 0;
  p.emit({ type: 'ask_user', chat: 'c1', id: 'q2', question: 'Which one?', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }] });
  const q = p.byId('log').querySelectorAll('.ask')[1];
  const [a, b] = q.querySelectorAll('.opt');
  b.onclick();
  a.onclick();
  await p.flush();
  assert.deepEqual(answers(p), [{ type: 'answer', id: 'q2', value: 'B' }]);
  assert.ok(b.classList.contains('chosen') && !a.classList.contains('chosen'));
  assert.ok(a.tabIndex === -1 && b.tabIndex === -1);
});

test('the focus brings a tab half out of sight into view', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'a', msgs: [] });
  p.emit({ type: 'chats', chats: [{ id: 'a', label: 'A', active: true }, { id: 'b', label: 'B' }] });
  p.emit({ type: 'agents', items: [{ id: 'a1', parent_chat: 'a', title: 'helper', state: 'running', iter: 1, max_iter: 50 }] });
  const tabs = p.byId('tabs').querySelectorAll('.tab');
  assert.ok(tabs.length >= 2);
  for (const t of tabs) {
    let how = null;
    t.scrollIntoView = (o) => { how = o; };
    t.onfocus();
    assert.equal(JSON.stringify(how), '{"block":"nearest","inline":"nearest"}', t.className);
  }
});

test('the history calls an untitled chat what its tab calls it', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c2', msgs: [] });
  p.emit({ type: 'chats', chats: [{ id: 'c9', label: '' }, { id: 'c2', label: 'Fix the test', active: true }, { id: 'c7' }] });
  p.byId('histBtn').onclick();
  await p.flush();
  const rows = p.byId('menu').querySelectorAll('.mi');
  assert.deepEqual(rows.map((r) => r.querySelector('.grow').textContent), ['New chat', 'Fix the test', 'New chat']);
  p.requests.length = 0;
  rows[2].onclick();
  await p.flush();
  assert.deepEqual(p.ins().filter((m) => m.name === 'load_chat'), [{ type: 'command', name: 'load_chat', value: 'c7' }]);
  // In Russian too; and an empty history says so, as it did.
  const q = await started({ lang: 'ru' });
  q.emit({ type: 'chats', chats: [{ id: 'c9' }] });
  q.byId('histBtn').onclick();
  assert.deepEqual(q.byId('menu').querySelectorAll('.mi').map((r) => r.textContent), ['Новый чат']);
  const z = await started();
  z.emit({ type: 'chats', chats: [] });
  z.byId('histBtn').onclick();
  assert.equal(z.byId('menu').querySelectorAll('.mi').length, 1);
  assert.ok(!z.byId('menu').querySelector('.mi').onclick, 'the line about an empty history is not a chat');
});

test('the reasoning line opens from the keyboard', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.emit({ type: 'turn_start', chat: 'c1' });
  p.emit({ type: 'reasoning_delta', chat: 'c1', text: 'first ' });
  p.emit({ type: 'reasoning_delta', chat: 'c1', text: 'then' });
  const t = p.byId('log').querySelector('.thinking-toggle');
  const body = p.byId('log').querySelector('.msg.thinking').children[1];
  assert.equal(body.textContent, 'first then');
  assert.equal(t.tabIndex, 0);
  assert.equal(t.getAttribute('role'), 'button');
  assert.equal(t.getAttribute('aria-expanded'), 'false');
  const press = (key) => { const e = { key, preventDefault() { e.defaultPrevented = true; }, stopPropagation() {} }; t.onkeydown(e); return e; };
  assert.ok(press('Enter').defaultPrevented);
  assert.ok(body.classList.contains('open'));
  assert.equal(t.getAttribute('aria-expanded'), 'true');
  press(' ');
  assert.ok(!body.classList.contains('open'), 'one press, one turn: the line is not wired twice');
  assert.equal(t.getAttribute('aria-expanded'), 'false');
  assert.ok(!press('a').defaultPrevented);
  t.onclick();
  assert.ok(body.classList.contains('open') && t.getAttribute('aria-expanded') === 'true', 'a click says the same');
});

test('a toast is closed from the keyboard', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [] });
  p.emit({ type: 'chats', chats: [{ id: 'c1', label: 'main', active: true }, { id: 'c2', label: 'other' }] });
  p.emit({ type: 'text_delta', chat: 'c2', text: 'elsewhere' });
  p.emit({ type: 'done', chat: 'c2' });
  await p.flush();
  const x = p.byId('toasts').querySelector('.toast').querySelector('i');
  assert.equal(x.tabIndex, 0);
  assert.equal(x.getAttribute('role'), 'button');
  assert.equal(x.getAttribute('aria-label'), 'Close');
  let stopped = false;
  const e = { key: 'Enter', preventDefault() { e.defaultPrevented = true; }, stopPropagation() { stopped = true; } };
  x.onkeydown({ key: 'Tab', preventDefault() { throw new Error('Tab is not ours'); }, stopPropagation() {} });
  assert.equal(p.byId('toasts').children.length, 1);
  x.onkeydown(e);
  await p.flush();
  assert.equal(p.byId('toasts').children.length, 0, 'the toast is gone');
  assert.ok(e.defaultPrevented && stopped, 'the key is not also an answer to a request');
});

test('attachments in a row keep their own height', () => {
  const html = page('en');
  assert.match(html, /\.gallery \{[^}]*align-items: center;/);
  assert.match(html, /#chips \{[^}]*align-items: center;/);
});

test('what lies under a dialog, a card or the drawer is out of reach while it is open', async () => {
  // The test page has its elements by id, not as a tree: the children of the window are named here.
  const PARTS = ['top', 'side', 'scrim', 'tabsNav', 'log', 'rail', 'turn', 'box', 'statusbar', 'menu', 'pop', 'sheet', 'toasts', 'conn', 'dlg', 'srStatus', 'welcome'];
  const tree = (p) => { p.byId('app').children = PARTS.map((id) => p.byId(id)); return p; };
  const inert = (p) => PARTS.filter((id) => p.byId(id).inert);
  const reach = (p) => PARTS.filter((id) => !p.byId(id).inert).sort();
  // The drawer of a narrow window: the sidebar, the shade that closes it, and what is drawn over everything.
  let p = tree(await started({ narrow: true }));
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  assert.deepEqual(inert(p), []);
  p.byId('navBtn').onclick();
  assert.ok(p.byId('app').classList.contains('side-open'));
  assert.deepEqual(reach(p), ['conn', 'dlg', 'menu', 'pop', 'scrim', 'side', 'srStatus', 'toasts']);
  assert.ok(p.byId('log').inert && p.byId('statusbar').inert, 'the feed and the status line are under the shade');
  p.byId('scrim').onclick();
  assert.deepEqual(inert(p), [], 'closed: everything is back in reach');
  // In a wide window the sidebar is no drawer.
  p = tree(await started());
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  p.run("appEl.classList.add('side-open'); winTopSync()");
  assert.deepEqual(inert(p), []);
  // A card over a working chat.
  p.emit(MACHINE);
  p.byId('sideMachine').onclick();
  await p.flush();
  assert.ok(p.byId('sheet').classList.contains('open'));
  assert.deepEqual(reach(p), ['conn', 'dlg', 'menu', 'pop', 'sheet', 'srStatus', 'toasts']);
  // A dialog over the card: the card goes under it too.
  p.byId('dlg').classList.add('open');
  p.run('winTopSync()');
  assert.deepEqual(reach(p), ['conn', 'dlg', 'menu', 'pop', 'srStatus', 'toasts']);
  p.byId('dlg').classList.remove('open');
  p.run('winTopSync()');
  assert.ok(!p.byId('sheet').inert && p.byId('log').inert, 'the dialog is gone, the card is on top again');
  p.key({ key: 'Escape' });
  await p.flush();
  assert.ok(!p.byId('sheet').classList.contains('open'));
  assert.deepEqual(inert(p), []);
});

test('the feed has a name of its own; muted text is muted by colour', () => {
  for (const [lang, name] of [['en', 'Conversation'], ['ru', 'Переписка']]) {
    const html = page(lang);
    assert.ok(html.includes(`<main class="feed" id="log" tabindex="0" aria-label="${name}">`), lang);
  }
  const html = page('en');
  // Opacity over small muted text went under 4.5:1; a token keeps the contrast the palette test proves.
  // (A skin may say "opacity: 1" to be sure; what must not come back is an opacity below 1.)
  assert.ok(!/\.ask\.q\.answered \.opt:not\(\.chosen\)[^{]*\{[^}]*opacity:\s*(?!\s|1\s*[;}])/.test(html));
  assert.match(html, /\.ask\.q\.answered \.opt:not\(\.chosen\) :where\(b, small\) \{ color: var\(--mute\); \}/);
  // Selected text: a pair with proven contrast, visible on accent-soft surfaces as well.
  assert.match(html, /\.app ::selection \{ background: var\(--accent-bg\); color: var\(--accent-fg\); \}/);
  // The short reasoning level is not squeezed by a long model name; the source gives way first.
  assert.match(html, /\.sel\.s-source \{ flex-shrink: 4; \}\s*\.sel\.s-effort \{ flex-shrink: 0; \}/);
  // The title of a tab takes the room, so the cross of a tab wider than its title stays at its end.
  assert.match(html, /\.tab-t \{ flex: 1 1 auto;/);
});

test('the keyboard enters a list at what is chosen now', async () => {
  const p = await started();
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [{ role: 'user', text: 'go' }] });
  const models = Array.from({ length: 30 }, (_, n) => ({ id: 'm' + n, label: 'Model ' + n, active: n === 17 }));
  p.emit({ type: 'state', model: 'Model 17', source: 'execai', models, sources: [{ id: 'execai', label: 'ExecAI', active: true }], efforts: [], securities: [] });
  const entry = () => p.byId('menu').querySelectorAll('.mi').filter((d) => d.tabIndex === 0).map((d) => d.querySelector('.grow').textContent);
  p.byId('selModel').onclick();
  assert.deepEqual(entry(), ['Model 17'], 'one way in, and it is the model in use');
  p.run('closeMenu()');
  // The command menu is not a list of one choice: from its first line.
  p.byId('cmdBtn').onclick();
  const first = p.byId('menu').querySelectorAll('.mi').filter((d) => d.onclick)[0];
  assert.equal(first.tabIndex, 0);
  assert.equal(p.byId('menu').querySelectorAll('.mi').filter((d) => d.tabIndex === 0).length, 1);
  // The history: at the chat on screen.
  p.run('closeMenu()');
  p.emit({ type: 'chats', chats: [{ id: 'a', label: 'A' }, { id: 'c1', label: 'Here', active: true }, { id: 'b', label: 'B' }] });
  p.byId('histBtn').onclick();
  assert.deepEqual(entry(), ['Here']);
});

test('a message sent with files comes back from the history as it was sent', async () => {
  const p = await started({ lang: 'ru' });
  const raw = 'посмотри лог\n\n[контекст редактора]\nПриложенные изображения:  \nПриложенные файлы (прочитай нужные инструментом Read): /home/u/p/.execai/uploads/1762900000-notes.txt, /home/u/p/docs/план 2026.md [image]  [image] ';
  p.emit({ type: 'chat_loaded', chat: 'c1', msgs: [
    // The agent says what was typed and what was attached; text is still the whole prompt.
    { role: 'user', text: raw, said: 'посмотри лог', files: ['/home/u/p/.execai/uploads/1762900000-notes.txt', '/home/u/p/docs/план 2026.md'], images: 2 },
    { role: 'assistant', text: 'ok' },
    // Nothing typed, one picture.
    { role: 'user', text: '[контекст редактора]\nПриложенные изображения:  [image] ', said: '', images: 1 },
    // An agent that does not say it (or a message without files): as before.
    { role: 'user', text: 'просто вопрос' },
    { role: 'user', text: raw },
  ] });
  const users = p.byId('log').querySelectorAll('.msg.user');
  const text = (m) => m.querySelector('.m-text').textContent;
  const chips = (m) => m.querySelectorAll('.fchip').map((c) => c.textContent);
  assert.equal(text(users[0]), 'посмотри лог');
  assert.deepEqual(chips(users[0]), ['notes.txt', 'план 2026.md', 'изображение', 'изображение'], 'the name it came with, not the path');
  assert.equal(users[0].querySelectorAll('.fchip')[0].title, 'notes.txt');
  assert.ok(!users[0].textContent.includes('контекст редактора') && !users[0].textContent.includes('/home/u'));
  assert.equal(text(users[1]), '');
  assert.deepEqual(chips(users[1]), ['изображение']);
  assert.equal(text(users[2]), 'просто вопрос');
  assert.equal(users[2].querySelector('.gallery'), null);
  assert.equal(text(users[3]), raw, 'without the new fields nothing is guessed');
  // The first message of a task from the site keeps its mark.
  const q = await started();
  q.emit({ type: 'chat_loaded', chat: 'c1', origin: 'web', msgs: [{ role: 'user', text: raw, said: 'from the site', files: ['C:\\work\\a.txt'] }, { role: 'user', text: 'next' }] });
  const [first, second] = q.byId('log').querySelectorAll('.msg.user');
  assert.ok(first.classList.contains('web') && !second.classList.contains('web'));
  assert.equal(first.querySelector('.m-text').textContent, 'from the site');
  assert.deepEqual(first.querySelectorAll('.fchip').map((c) => c.textContent), ['a.txt']);
});

test('the cross of a tab takes a click only where it can be seen', () => {
  const html = page('en');
  // A tab wider than its title keeps the cross at its end (the title takes the room)…
  assert.match(html, /\.tab-t \{ flex: 1 1 auto;/);
  // …and the cross of a tab that is not under the pointer, not on screen and not focused lets the click through to the tab.
  assert.match(html, /\.tab:not\(:hover\):not\(\.active\):not\(:focus-within\) \.tab-x \{ pointer-events: none; \}/);
  // Once, in what every skin shares: no skin has to repeat it.
  const rule = html.indexOf('.tab-x { pointer-events: none; }');
  for (const id of SKIN_IDS) {
    const own = html.indexOf(`.sk-${id} .`);
    assert.ok(rule > 0 && own > rule, `in the shared rules, before the rules of ${id}`);
  }
});

// ── the look is in plain sight ──────────────────────────────────

test('the header of every skin names the look and switches the theme', async () => {
  const html = page('en');
  // One control per header a skin may have; each a labelled button and a two-position switch.
  for (const [at, open, close] of [['top', '<header class="top">', '</header>'], ['tabs', '<nav class="tabs"', '</nav>'], ['head', '<div class="h-acts">', '</div>\n  </div>']]) {
    const part = html.slice(html.indexOf(open), html.indexOf(close, html.indexOf(open)));
    assert.ok(part.includes(`id="look-${at}"`) && part.includes(`id="thL-${at}"`) && part.includes(`id="thD-${at}"`), `no look control in ${at}`);
    assert.match(part, new RegExp(`id="look-${at}"[^>]*aria-haspopup="dialog"[^>]*>.*<span class="lb-k">Look</span><b class="lb-v" id="lookName-${at}">`), 'an icon and words, not an icon alone');
  }
  const p = await started();
  for (const at of ['top', 'tabs', 'head']) {
    assert.equal(p.byId('lookName-' + at).textContent, 'Workbench');
    assert.deepEqual([p.byId('thL-' + at).getAttribute('aria-checked'), p.byId('thD-' + at).getAttribute('aria-checked')], ['false', 'true']);
  }
  // The switch: one click, applied and stored.
  p.byId('thL-tabs').onclick();
  assert.deepEqual(look(p), { skin: 'sk-verstak', theme: 'light' });
  assert.equal(p.storage.get('execai:ui:theme'), 'light');
  for (const at of ['top', 'tabs', 'head']) assert.equal(p.byId('thL-' + at).getAttribute('aria-checked'), 'true', at);
  p.byId('thD-head').onclick();
  assert.equal(look(p).theme, 'dark');
  // The button opens the panel; the name on every button follows the pick.
  const pop = p.byId('pop');
  p.byId('look-tabs').onclick();
  assert.ok(pop.classList.contains('open'));
  assert.equal(p.byId('look-tabs').getAttribute('aria-expanded'), 'true');
  assert.equal(p.byId('look-head').getAttribute('aria-expanded'), 'false');
  pop.querySelector('[data-skin="teletype"]').onclick();
  assert.deepEqual(look(p), { skin: 'sk-teletype', theme: 'dark' });
  for (const at of ['top', 'tabs', 'head']) assert.equal(p.byId('lookName-' + at).textContent, 'Teletype');
  assert.ok(pop.classList.contains('open'), 'the panel stays: another look is one more click');
  assert.equal(pop.querySelector('[data-skin="teletype"]').getAttribute('aria-checked'), 'true');
  // "As the system" in the panel: the switch shows the theme on screen (the test system is light).
  pop.querySelector('[data-theme-set="system"]').onclick();
  assert.equal(look(p).theme, null);
  assert.deepEqual([p.byId('thL-top').getAttribute('aria-checked'), p.byId('thD-top').getAttribute('aria-checked')], ['true', 'false']);
  // The same button closes it.
  p.byId('look-tabs').onclick();
  assert.ok(!pop.classList.contains('open'));
  assert.equal(p.byId('look-tabs').getAttribute('aria-expanded'), 'false');
});

test('the look panel: tiles with a picture of each look, one panel for every way in, Esc gives the focus back', async () => {
  const p = await started();
  p.emit({ type: 'state', model: 'glm', source: 'execai', user: 'dev@example.com', models: [], sources: [], efforts: [], securities: [] });
  const pop = p.byId('pop');
  const tiles = () => pop.querySelectorAll('.pk').map((b) => ({
    skin: b.getAttribute('data-skin'), role: b.getAttribute('role'), name: b.querySelector('b').textContent,
    about: b.querySelector('small').textContent, picture: b.querySelector('.pk-pv').className, on: b.getAttribute('aria-checked'),
  }));
  let focused = '';
  for (const id of ['look-head', 'lookBtn']) p.byId(id).focus = () => { focused = id; };
  p.byId('look-head').onclick();
  const fromHeader = tiles();
  assert.deepEqual(fromHeader, [
    { skin: 'verstak', role: 'radio', name: 'Workbench', about: 'Dense and calm, like an editor', picture: 'pk-pv sk-verstak', on: 'true' },
    { skin: 'beseda', role: 'radio', name: 'Conversation', about: 'Soft and roomy, the chat in the middle', picture: 'pk-pv sk-beseda', on: 'false' },
    { skin: 'teletype', role: 'radio', name: 'Teletype', about: 'Monospaced, with a yellow marker', picture: 'pk-pv sk-teletype', on: 'false' },
  ]);
  assert.equal(pop.querySelectorAll('.pk-pv')[0].getAttribute('aria-hidden'), 'true', 'the picture is decoration: the name says it');
  assert.equal(pop.querySelectorAll('[data-theme-set]').length, 3);
  // Esc: closed, and the focus is back on the button that opened it.
  p.key({ key: 'Escape' });
  assert.ok(!pop.classList.contains('open'));
  assert.equal(focused, 'look-head');
  // The small button beside the account opens the very same panel.
  p.byId('lookBtn').onclick();
  assert.ok(pop.classList.contains('open'));
  assert.deepEqual(tiles(), fromHeader);
  assert.ok(pop.querySelectorAll('.pop-row').some((r) => r.textContent.includes('dev@example.com')), 'with the account in it, as before');
  assert.equal(p.byId('lookBtn').getAttribute('aria-expanded'), 'true');
  // Another way in while it is open: it moves to that button instead of closing.
  p.byId('look-head').onclick();
  assert.ok(pop.classList.contains('open'));
  assert.deepEqual([p.byId('lookBtn').getAttribute('aria-expanded'), p.byId('look-head').getAttribute('aria-expanded')], ['false', 'true']);
  p.key({ key: 'Escape' });
  assert.equal(focused, 'look-head');
});

test('the first run: dark, and the three looks on the empty screen until one is picked or kept', async () => {
  const p = await started();
  p.emit({ type: 'chat_reset', chat: 'c1' });
  const intro = p.byId('lookIntro'), box = p.byId('introLook');
  assert.equal(p.run('LOOK.fresh'), true);
  assert.equal(intro.hidden, false, 'nothing picked yet: the looks are shown');
  assert.deepEqual(box.querySelectorAll('[data-skin]').map((b) => [b.getAttribute('data-skin'), b.getAttribute('aria-checked')]),
    [['verstak', 'true'], ['beseda', 'false'], ['teletype', 'false']]);
  assert.deepEqual(box.querySelectorAll('[data-theme-set]').map((b) => [b.getAttribute('data-theme-set'), b.getAttribute('aria-checked')]),
    [['system', 'false'], ['light', 'false'], ['dark', 'true']]);
  // A pick there is a pick: applied, stored, marked in every picker — and the block stays for the next try.
  box.querySelector('[data-skin="beseda"]').onclick();
  assert.deepEqual(look(p), { skin: 'sk-beseda', theme: 'dark' });
  assert.equal(p.storage.get('execai:ui:skin'), 'beseda');
  assert.equal(intro.hidden, false);
  assert.equal(box.querySelector('[data-skin="beseda"]').getAttribute('aria-checked'), 'true');
  assert.equal(p.byId('sideLook').querySelector('[data-skin="beseda"]').getAttribute('aria-checked'), 'true');
  assert.equal(p.byId('lookName-head').textContent, 'Conversation');
  box.querySelector('[data-theme-set="light"]').onclick();
  assert.deepEqual(look(p), { skin: 'sk-beseda', theme: 'light' });
  assert.equal(intro.hidden, false, 'still there: the third look is one more click away');
  // The chat is left with a pick made: the block has done its part, also for the next empty chat of this load.
  p.byId('inp').value = 'hello';
  p.byId('sendBtn').onclick();
  await p.flush();
  assert.equal(intro.hidden, true);
  p.byId('newTab').onclick();
  await p.flush();
  assert.equal(intro.hidden, true);
  // Without a pick the block waits: a message alone is not a choice of a look.
  const w = await started();
  w.emit({ type: 'chat_reset', chat: 'c1' });
  w.byId('inp').value = 'hello';
  w.byId('sendBtn').onclick();
  await w.flush();
  assert.equal(w.byId('lookIntro').hidden, false);
  // The next load: a choice is stored, the block is not there.
  const q = await started({ storage: p.storage });
  q.emit({ type: 'chat_reset', chat: 'c1' });
  assert.equal(q.run('LOOK.fresh'), false);
  assert.equal(q.byId('lookIntro').hidden, true);
  assert.deepEqual(look(q), { skin: 'sk-beseda', theme: 'light' });

  // "Keep this one" without touching anything: the defaults become the choice.
  const k = await started();
  k.byId('introDone').onclick();
  assert.equal(k.byId('lookIntro').hidden, true);
  assert.deepEqual([k.storage.get('execai:ui:skin'), k.storage.get('execai:ui:theme')], ['verstak', 'dark']);
  assert.equal((await started({ storage: k.storage })).byId('lookIntro').hidden, true);
  // A theme picked with the switch in the header counts as well.
  const h = await started();
  h.byId('thL-top').onclick();
  assert.equal((await started({ storage: h.storage })).byId('lookIntro').hidden, true);
  // Who had picked "as the system" before this build keeps it, and is not asked again.
  const old = await started({ storage: new Map([['execai:ui:theme', 'system']]) });
  assert.deepEqual(look(old), { skin: 'sk-verstak', theme: null });
  assert.equal(old.byId('lookIntro').hidden, true);
  // The block is part of the greeting; both languages have its words.
  for (const [lang, word] of [['en', 'Keep this one'], ['ru', 'Оставить так']]) {
    const html = page(lang);
    const greet = html.slice(html.indexOf('id="welcome"'));
    assert.ok(greet.includes('id="lookIntro" hidden') && greet.includes('id="introLook"') && greet.includes(word), lang);
  }
});

test('a narrow window: one button in the header, the whole choice at the top of the drawer', async () => {
  const p = await started({ narrow: true });
  const side = p.byId('sideLook');
  assert.equal(side.querySelectorAll('[data-skin]').length, 3);
  assert.equal(side.querySelectorAll('[data-theme-set]').length, 3);
  p.byId('look-top').onclick();
  assert.ok(p.byId('app').classList.contains('side-open'), 'the button opens the drawer');
  assert.ok(!p.byId('pop').classList.contains('open'), 'not a second panel over it');
  side.querySelector('[data-skin="teletype"]').onclick();
  side.querySelector('[data-theme-set="light"]').onclick();
  assert.deepEqual(look(p), { skin: 'sk-teletype', theme: 'light' });
  assert.equal(side.querySelector('[data-skin="teletype"]').getAttribute('aria-checked'), 'true');
  const html = page('en');
  // In the markup the choice is the first thing of the drawer after "New chat"; the stylesheet shows it only when narrow.
  const aside = html.slice(html.indexOf('<aside class="side"'), html.indexOf('</aside>'));
  assert.ok(aside.indexOf('id="sideLook"') > 0 && aside.indexOf('id="sideLook"') < aside.indexOf('id="sideChats"'));
  assert.match(html, /\.side-look \{ display: none;/);
  const narrow = html.slice(html.lastIndexOf('@media (max-width: 719px)'));
  assert.match(narrow, /\.app \.side-look \{ display: block; \}/);
  assert.match(narrow, /\.app \.top \.thseg, \.app \.top \.lookbtn > \.lb-v, \.app \.top \.lookbtn > \.lb-c \{ display: none; \}/);
});

test('a picture of a look wears that look in the theme on screen', () => {
  const sheet = css();
  for (const s of BOTH.SKINS) {
    // Light by the look's own rule; dark by choice and by the system — also inside a window that wears another look.
    assert.ok(sheet.includes(`:root[data-theme="dark"] .pk-pv.${s.cls} { --bg: ${s.palette.bg[1]};`), s.id);
    assert.ok(sheet.includes(`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pk-pv.${s.cls} { --bg: ${s.palette.bg[1]};`), s.id);
    assert.match(sheet, new RegExp(`\\.pk-pv(\\.${s.cls})? > \\.pv-btn \\{[^}]*`));
  }
  // The picture is drawn with tokens only (the literal-colour test covers base.ts as well).
  assert.match(sheet, /\.pk-pv \{[^}]*background: var\(--bg\);/);
  assert.match(sheet, /\.pk-pv > \.pv-btn \{[^}]*background: var\(--accent-bg\);/);
  // A header shows as much of the control as it has room for.
  assert.match(sheet, /\.app > \.top, \.app > \.tabs, \.app > \.head \{ container: hdr \/ inline-size; \}/);
  assert.match(sheet, /@container hdr \(max-width: \d+px\) \{ \.tabs \.thseg button > span \{ display: none; \} \}/);
});

test('every skin dresses the look button and the theme switch its own way, and its previews stay out of its rules', () => {
  for (const s of BOTH.SKINS) {
    const own = s.css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(own, new RegExp(`\\.${s.cls} \\.lookbtn \\{[^}]*height: \\d+px;`), `${s.id}: the button has its height`);
    assert.match(own, new RegExp(`\\.${s.cls} \\.thseg button \\{[^}]*min-width: \\d+px;`), `${s.id}: a position of the switch is wide enough to hit`);
    // A picture of a look is drawn by base.ts alone: a skin has no rule that could reach inside one.
    assert.ok(!/\.pk-pv|\.pv-/.test(own), `${s.id} styles the pictures of looks`);
    assert.ok(!/\.pk-sw/.test(own), `${s.id} still styles the swatch that is gone`);
  }
});
