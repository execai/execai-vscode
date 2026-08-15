// The webview inline script must be valid JS: VS Code injects the html through
// document.write, and one broken line silently kills the WHOLE chat (caught via
// CDP: a literal newline inside '\n📎' in a template literal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import Module from 'node:module';

/** Loads the bundled module with a stubbed `vscode` (it is not importable here). */
function load() {
  const require2 = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (req, ...a) {
    if (req === 'vscode') return 'vscode';
    return orig.call(this, req, ...a);
  };
  require2.cache['vscode'] = { exports: {} };
  const mod = require2('./.webviewHtml.cjs');
  Module._resolveFilename = orig;
  return mod;
}

test('the chat inline script is valid JS (node --check)', () => {
  const { chatHtml } = load();

  // Both languages: a translation is injected into the script as JSON, and a
  // stray quote there would break the whole panel.
  for (const lang of [undefined, 'ru']) {
    const html = chatHtml({}, {}, lang);
    const m = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
    assert.ok(m, 'no inline script in the html');
    const f = join(mkdtempSync(join(tmpdir(), 'wv-')), 'inline.js');
    writeFileSync(f, m[1]);
    execFileSync(process.execPath, ['--check', f]); // throws on a syntax error
  }
});

// The stop button must be HIDDEN at rest and visible only during a turn.
// "#bar button" is more specific than "#stopBtn", so display:none lost there and
// stop spun forever (caught by the owner on 14.08). Check both states: a test
// that only asserted "visible during a turn" missed this bug.
test('stop is hidden at rest and shown during a turn (CSS specificity)', () => {
  const { chatHtml } = load();
  const css = chatHtml({}, {});

  // The display rules for stop/send must be NO LESS specific than "#bar button",
  // i.e. they have to include #bar.
  assert.ok(css.includes('#bar #stopBtn { display: none; }'),
    'no "#bar #stopBtn { display: none }" rule — stop would always be visible');
  assert.ok(css.includes('body.busy #bar #stopBtn { display: inline-flex; }'),
    'no rule showing stop during a turn');
  assert.ok(css.includes('body.busy #bar #sendBtn { display: none; }'),
    'no rule hiding send during a turn');
  // And no weaker duplicates that would lose again.
  assert.ok(!/\n\s*#stopBtn \{ display: none; \}/.test(css),
    'a weak #stopBtn{display:none} selector is back — it loses to #bar button');
});

// Localization. The bug class this guards against: a UI string added later in
// one language only. Same trap as in the TUI, where "late" hardcoded strings
// slipped past i18n.
test('every language bundle has the same keys as English', () => {
  const { STRINGS } = load();
  const en = Object.keys(STRINGS.en).sort();
  for (const [lang, table] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(table).sort(), en, `bundle "${lang}" drifted from en`);
  }
});

test('the language is picked from the editor, English is the default', () => {
  const { chatHtml, pickLang } = load();
  assert.equal(pickLang(undefined), 'en');
  assert.equal(pickLang('en-US'), 'en');
  assert.equal(pickLang('ru'), 'ru');
  assert.equal(pickLang('ru-RU'), 'ru');
  assert.equal(pickLang('de'), 'en'); // no bundle yet — fall back, do not crash

  assert.ok(chatHtml({}, {}).includes('<html lang="en">'));
  assert.ok(chatHtml({}, {}, 'ru-RU').includes('<html lang="ru">'));
  assert.ok(!/[А-Яа-я]/.test(chatHtml({}, {})), 'the English panel must have no Cyrillic left');
});


// Рендерер разметки обязан быть ПРИВЯЗАН К ИМЕНИ в панели.
//
// Он попадает туда через toString(), а релизная сборка минифицируется и
// переименовывает функцию: голое объявление оставляло панель с вызовом
// несуществующего renderMarkdown, и ответы приходили сырым текстом. Юниты
// гоняют неминифицированную сборку и этого не видят — поэтому проверяем
// форму вставки.
import { test as test3 } from 'node:test';
import assert3 from 'node:assert/strict';
import { createRequire as cr3 } from 'node:module';
import Module3 from 'node:module';

test3('рендерер разметки привязан к имени, а не объявлен', () => {
  const req = cr3(import.meta.url);
  const orig = Module3._resolveFilename;
  Module3._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: {} };
  const { chatHtml } = req('./.webviewHtml.cjs');
  Module3._resolveFilename = orig;
  const html = chatHtml({}, {});
  assert3.ok(/const renderMarkdown\s*=\s*function/.test(html),
    'нет привязки «const renderMarkdown = function…» — при минификации имя потеряется');
  assert3.ok(html.includes('a.innerHTML = renderMarkdown('),
    'поток ответа обязан проходить через рендерер');
});
