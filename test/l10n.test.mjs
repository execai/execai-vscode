// Every string the extension host shows goes through vscode.l10n.t() with an
// English key; the Russian bundle must have each one. A key missing there
// shows up as English in a Russian editor — the "late hardcoded string" bug
// class the panel test guards against on the webview side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('..', import.meta.url);

test('every vscode.l10n.t() key has a Russian translation', () => {
  const ru = JSON.parse(readFileSync(new URL('l10n/bundle.l10n.ru.json', root), 'utf8'));
  const missing = [];
  for (const f of readdirSync(new URL('src', root))) {
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(new URL('src/' + f, root), 'utf8');
    const re = /l10n\.t\(\s*(["'])((?:\\.|(?!\1).)*)\1/gs;
    let m;
    while ((m = re.exec(src))) {
      const key = m[2].replace(/\\n/g, '\n').replace(/\\(["'\\])/g, '$1');
      if (!(key in ru)) missing.push(`${f}: ${key}`);
    }
  }
  assert.deepEqual(missing, [], 'keys without a Russian translation');
});
