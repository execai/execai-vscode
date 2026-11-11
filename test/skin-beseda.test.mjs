// The «Беседа» skin of the `execai ui` window (src/skins/beseda.ts): what was
// put right in it and can be checked without a browser.
//   - colours: nothing literal, every variable known, the lines that carry
//     meaning keep 3:1 in both themes;
//   - the dark theme is told apart in one place, the same for a dark system
//     and for an explicit choice — islands by a rim and a lit edge, not by a
//     shadow nobody can see;
//   - service lines are quiet, "copy the answer" never lies on the text;
//   - the keyboard: no ring is taken away without another, rings inside
//     boxes that clip are drawn inside;
//   - a narrow and a middle window have their rules; nothing of the skin
//     switches motion back on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';

function load(file) {
  const req = createRequire(import.meta.url);
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (r, ...a) { return r === 'vscode' ? 'vscode' : orig.call(this, r, ...a); };
  req.cache['vscode'] = { exports: {} };
  const mod = req(file);
  Module._resolveFilename = orig;
  return mod;
}

const BOTH = load('./.webviewHtml.cjs');
const SKIN = BOTH.SKINS.find((s) => s.id === 'beseda');
const RAW = SKIN.css;
// Comments and inline images are not rules: an icon in a mask is black by nature.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("data:[^"]*"\)/g, 'url()');

/** The rules of a stylesheet: { at: the at-rules around it, sel, body }. One pass, braces counted. */
function rules(css) {
  const out = [];
  const walk = (text, at) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@')) walk(body, at.concat(head));
      else out.push({ at, sel: head.replace(/\s+/g, ' '), body: body.trim() });
      i = j;
    }
  };
  walk(css, []);
  return out;
}
const RULES = rules(CSS);
const decls = (body) => body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const k = d.indexOf(':');
  return [d.slice(0, k).trim(), d.slice(k + 1).trim()];
});
/** The declarations of every rule whose selector list has this selector, outside at-rules unless `at` is given. */
function find(sel, at = '') {
  const got = RULES.filter((r) => r.sel.split(',').map((s) => s.trim()).includes(sel) &&
    (at ? r.at.some((a) => a.startsWith(at)) : r.at.length === 0));
  return Object.fromEntries(got.flatMap((r) => decls(r.body)));
}
const inside = (at) => RULES.filter((r) => r.at.some((a) => a.replace(/\s+/g, ' ').startsWith(at)));

// ── colours ─────────────────────────────────────────────────────

test('beseda: no literal colour in the skin — tokens, its own variables, and nothing else', () => {
  assert.deepEqual(CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], 'a hex colour');
  assert.ok(!/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(CSS), 'a colour function with literal numbers');
  // colour words: only in values, so that white-space and the like do not count
  const words = /\b(?:black|white|red|green|blue|gr[ae]y|silver|purple|violet|indigo|orange|yellow|pink|navy|teal|aqua|cyan|magenta|lime|maroon|olive|fuchsia|brown|gold)\b/i;
  for (const r of RULES) {
    for (const [prop, value] of decls(r.body)) {
      assert.ok(!words.test(value), `a colour by name: ${r.sel} { ${prop}: ${value} }`);
    }
  }
  // what is mixed is mixed from tokens
  for (const m of CSS.matchAll(/color-mix\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const parts = m[1].split(',').slice(1).map((p) => p.trim().replace(/\s+[\d.]+%$/, ''));
    for (const part of parts) {
      assert.match(part, /^(?:var\(--[\w-]+\)|currentColor|transparent)$/, `color-mix of something that is not a token: ${m[0]}`);
    }
  }
});

test('beseda: every variable it uses is a token, its own, or one base.ts gives', () => {
  const own = new Set([...CSS.matchAll(/(?:^|[\s;{])--([\w-]+)\s*:/g)].map((m) => m[1]));
  const fromBase = new Set(['side-shift', 'i-note', 'i-alert', 'i-alarm', 'i-agents']);
  for (const m of CSS.matchAll(/var\(--([\w-]+)/g)) {
    assert.ok(BOTH.TOKENS.includes(m[1]) || own.has(m[1]) || fromBase.has(m[1]), `var(--${m[1]}) is not defined anywhere`);
  }
  // the skin does not redefine a colour token on the quiet: the palette is the one place for colours
  for (const v of own) assert.ok(!BOTH.TOKENS.includes(v), `--${v} is a token: it is set in the palette, not in the rules`);
});

const lum = (c) => {
  const v = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, share) => a.map((v, i) => v * share + b[i] * (1 - share));

test('beseda: lines and marks that carry meaning keep 3:1 in both themes', () => {
  // --edge as the stylesheet mixes it: the rim of a field, an empty radio mark, a scrollbar
  const edge = find('.sk-beseda', '@supports')['--edge'];
  const m = /^color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, var\(--([\w-]+)\)\)$/.exec(edge || '');
  assert.ok(m, `--edge is not the mix the test knows: ${edge}`);
  assert.equal(find('.sk-beseda')['--edge'], 'var(--mute)', 'without color-mix the line falls back to a token that is darker still');
  const bad = [];
  for (const [i, theme] of [[0, 'light'], [1, 'dark']]) {
    const P = (k) => rgb(SKIN.palette[k][i]);
    const e = mix(P(m[1]), P(m[3]), Number(m[2]) / 100);
    const check = (name, fg, bgs) => {
      for (const bg of bgs) {
        const r = ratio(fg, P(bg));
        if (r < 3) bad.push(`${theme}: ${name} on ${bg} = ${r.toFixed(2)}`);
      }
    };
    check('--edge', e, ['panel', 'bg', 'raised']);
    // the focus ring and the ring of a selected answer, wherever they are drawn
    check('focus', P('focus'), ['bg', 'panel', 'raised', 'accent-soft', 'hover']);
    // progress rings and state marks of subagents, on an island and on a hovered row
    for (const k of ['accent', 'ok', 'warn', 'err']) check(k, P(k), ['panel', 'raised']);
    // selected text: the strong pair, readable on a bubble as well as on the background
    const sel = ratio(P('accent-fg'), P('accent-bg'));
    if (sel < 4.5) bad.push(`${theme}: selected text = ${sel.toFixed(2)}`);
    // a quiet service line on the background of the window
    const note = ratio(P('mute'), P('bg'));
    if (note < 4.5) bad.push(`${theme}: a service line = ${note.toFixed(2)}`);
  }
  assert.deepEqual(bad, []);
  // and they are used where the meaning is
  assert.match(find('.sk-beseda .o-mark').border, /var\(--edge\)/, 'an empty radio mark');
  assert.match(find('.sk-beseda .dlg-input').border, /var\(--edge\)/, 'the border of a field');
  assert.match(find('.sk-beseda .step.todo .mark').border, /var\(--edge\)/, 'a step not done yet');
  assert.match(find('.sk-beseda .app *')['scrollbar-color'], /var\(--edge\)/, 'scrollbars inside the islands');
  // selected text is base.ts's strong pair; the skin does not bring the soft violet of a bubble back
  assert.ok(!/::selection/.test(CSS));
});

// ── two themes ──────────────────────────────────────────────────

test('beseda: the dark theme is told apart once — the same for a dark system and for an explicit choice', () => {
  const bySystem = inside('@media (prefers-color-scheme: dark)');
  assert.equal(bySystem.length, 1, 'one rule under prefers-color-scheme');
  assert.equal(bySystem[0].sel, '.sk-beseda:not([data-theme="light"])', 'an explicit light theme wins over a dark system');
  const byChoice = RULES.filter((r) => r.sel === '.sk-beseda[data-theme="dark"]' && !r.at.length);
  assert.equal(byChoice.length, 1);
  assert.equal(byChoice[0].body, bySystem[0].body, 'both say the same');
  // nowhere else does a rule look at the theme: the rest draws with tokens and the variables set here
  const themed = RULES.filter((r) => /data-theme|prefers-color-scheme/.test(r.sel + r.at.join(' ')));
  assert.equal(themed.length, 2, 'theme conditions outside the two rules: ' + themed.map((r) => r.sel).join(' | '));
  const dark = Object.fromEntries(decls(byChoice[0].body));
  const light = find('.sk-beseda');
  // light: an island floats on a shadow; dark: a shadow is not seen — a lit edge and a lighter rim
  assert.ok(!/inset/.test(light['--isl']) && /var\(--shadow\)/.test(light['--isl']));
  assert.match(dark['--isl'], /^inset 0 1px 0 var\(--line2\)$/);
  assert.equal(light['--isl-edge'], 'var(--line)');
  assert.equal(dark['--isl-edge'], 'var(--rim)');
  assert.match(dark['--ovl'], /inset/);
  assert.equal(dark['--ovl-edge'], 'var(--line2)');
});

test('beseda: islands and what floats are drawn with those variables', () => {
  const islands = ['.sk-beseda .side', '.sk-beseda .agents', '.sk-beseda .files', '.sk-beseda .card', '.sk-beseda .box', '.sk-beseda .ask', '.sk-beseda .turn'];
  for (const sel of islands) {
    const d = find(sel);
    assert.match(d['box-shadow'] || '', /var\(--isl\)/, `${sel}: shadow`);
    assert.match(d.border || '', /var\(--isl-edge\)/, `${sel}: rim`);
  }
  for (const sel of ['.sk-beseda #menu', '.sk-beseda .pop', '.sk-beseda .toast', '.sk-beseda .dlg-box']) {
    const d = find(sel);
    assert.match(d['box-shadow'] || '', /var\(--ovl\)/, `${sel}: shadow`);
    assert.match(d.border || '', /var\(--ovl-edge\)/, `${sel}: rim`);
  }
  // no island is left with a shadow of its own that the dark theme would not know about
  for (const r of RULES) {
    for (const [prop, value] of decls(r.body)) {
      if (prop !== 'box-shadow' || value === 'none') continue;
      assert.ok(/var\(--(isl|ovl)\)/.test(value) || /^0 0 0 4px var\(--accent-soft\)$/.test(value) || /^0 1px 3px var\(--shadow\)$/.test(value),
        `${r.sel}: box-shadow outside the skin's variables: ${value}`);
    }
  }
});

// ── the feed ────────────────────────────────────────────────────

test('beseda: service lines are quiet lines, an error keeps its block', () => {
  const note = find('.sk-beseda .notice');
  for (const prop of ['background', 'padding', 'border', 'border-radius', 'box-shadow']) {
    assert.equal(note[prop], undefined, `a notice is not a plaque: ${prop}`);
  }
  assert.equal(note.color, 'var(--mute)');
  // a run of them: closer together than messages are
  assert.match(find('.sk-beseda .feed > .notice + .notice')['margin-top'], /^-\d+px$/);
  assert.equal(find('.sk-beseda .error').background, 'var(--del-bg)');
  // in an empty chat a line stands under the greeting, in the middle
  assert.equal(find('.sk-beseda .app.is-empty .feed > .notice')['align-self'], 'center');
});

test('beseda: "copy the answer" has a line of its own and is there without a mouse', () => {
  const b = find('.sk-beseda .msg.assistant > .copy-msg');
  assert.equal(b.position, 'static', 'in the flow, not over the text');
  assert.equal(b['justify-self'], 'start');
  // under the last answer of the chat it stays in sight; with no hover — under every answer
  assert.equal(find('.sk-beseda .feed > .msg.assistant:nth-last-child(1 of .msg.assistant) > .copy-msg').opacity, '1');
  assert.equal(find('.sk-beseda .msg.assistant > .copy-msg', '@media (hover: none)').opacity, '1');
});

test('beseda: a permission request — the label over its answers, a narrow card, an answered question', () => {
  const again = find('.sk-beseda .ask.perm:not(.answered) .opts::after');
  assert.equal(again.content, 'attr(data-again)');
  assert.equal(again['flex-basis'], '100%', '"do not ask again" is a line of its own');
  assert.equal(find('.sk-beseda .ask').container, 'ask / inline-size');
  const narrow = inside('@container ask (max-width:');
  assert.ok(narrow.some((r) => r.sel === '.sk-beseda .ask-t' && /flex:\s*1 1 calc\(100% - \d+px\)/.test(r.body)), 'the heading wraps inside its line');
  assert.ok(narrow.some((r) => r.sel === '.sk-beseda .ask-from' && /margin-left:\s*0/.test(r.body)));
  // what was not chosen steps back by colour (base.ts): nothing in the skin fades text — faded small
  // print is under 4.5:1
  for (const r of RULES) {
    const o = Object.fromEntries(decls(r.body)).opacity;
    assert.ok(o === undefined || o === '1', `${r.sel}: opacity ${o}`);
  }
  // Tab follows what the eye sees ("deny" is second on screen and last in the markup)
  assert.equal(find('.sk-beseda .ask.perm .opts')['reading-flow'], 'flex-visual');
  // a refused call is struck out, not painted as done or failed
  assert.equal(find('.sk-beseda .tool.denied > summary .t-sum')['text-decoration'], 'line-through');
  // keys on the answers and the line of hints under them are on; a narrow window has no keyboard
  assert.equal(find('.sk-beseda .key').display, 'inline-block');
  assert.equal(find('.sk-beseda .ask-hint').display, 'block');
  assert.equal(find('.sk-beseda .turn-esc').display, 'inline');
  assert.equal(find('.sk-beseda .app .key', '@media (max-width: 719px)').display, 'none');
  assert.equal(find('.sk-beseda .app .key-line', '@media (max-width: 719px)').display, 'none');
});

// ── the keyboard ────────────────────────────────────────────────

test('beseda: no focus ring is taken away without another one in its place', () => {
  // where the outline goes, something else shows the focus
  const instead = {
    '.sk-beseda textarea:focus-visible': () => /0 0 0 4px var\(--accent-soft\)/.test(find('.sk-beseda .box:focus-within')['box-shadow']) &&
      find('.sk-beseda .box:focus-within')['border-color'] === 'var(--accent)',
    '.sk-beseda .dlg-input:focus': (d) => d['border-color'] === 'var(--accent)' && /0 0 0 4px/.test(d['box-shadow']),
    '.sk-beseda .dlg-input:focus-visible': (d) => d['border-color'] === 'var(--accent)' && /0 0 0 4px/.test(d['box-shadow']),
  };
  for (const r of RULES) {
    const d = Object.fromEntries(decls(r.body));
    if (!('outline' in d) || !/^(0|none)\b/.test(d.outline)) continue;
    for (const sel of r.sel.split(',').map((s) => s.trim())) {
      assert.ok(instead[sel], `${sel} drops the outline`);
      assert.ok(instead[sel](d), `${sel} drops the outline and nothing shows the focus`);
    }
  }
  assert.ok(!/outline(?:-width|-style)?\s*:[^;]*!important/.test(CSS));
});

test('beseda: a ring inside a box that clips is drawn inside the row', () => {
  // rows of scrolling lists and of the tools box: the ring would be cut at the edge of the box
  for (const sel of ['.sk-beseda .chat:focus-visible', '.sk-beseda .ag:focus-visible', '.sk-beseda .mi:focus-visible',
    '.sk-beseda .tool > summary:focus-visible', '.sk-beseda .t-out:focus-visible', '.sk-beseda .seg button:focus-visible']) {
    assert.match(find(sel)['outline-offset'] || '', /^-[23]px$/, sel);
  }
  // the tools box has round corners: its first and last row take them, or the ring loses its corners
  assert.equal(find('.sk-beseda .tools > .tool:first-child > summary')['border-top-left-radius'], '17px');
  assert.equal(find('.sk-beseda .tools > .tool:last-child:not([open]) > summary')['border-bottom-right-radius'], '17px');
  // what scrolls leaves room for the ring of what it brings into view
  for (const sel of ['.sk-beseda .feed', '.sk-beseda .s-scroll', '.sk-beseda .rail']) {
    assert.match(find(sel)['scroll-padding-block'] || '', /^\d+px$/, sel);
  }
});

// ── widths ──────────────────────────────────────────────────────

test('beseda: a middle window — subagents as a list that fits and scrolls inside itself', () => {
  const mid = '@media (max-width: 1099px)';
  const list = find('.sk-beseda .ag-list', mid);
  assert.equal(list['overflow-y'], 'auto');
  assert.match(list['max-height'], /^min\(\d+px, \d+vh\)$/, 'never taller than a part of the window');
  // actions as round buttons beside the two lines of text; their words stay for a screen reader
  assert.equal(find('.sk-beseda .ag-acts', mid)['flex-wrap'], 'nowrap');
  assert.equal(find('.sk-beseda .m-stop .ic', mid).display, 'block');
  assert.match(find('.sk-beseda .m-stop span', mid)['clip-path'], /inset/);
  assert.notEqual(find('.sk-beseda .m-stop span', mid).display, 'none');
  // by the island's own width — under a name only the middle window has, so the column of a wide
  // one is not touched: the time when there is room; in a narrow island the state under the name
  assert.equal(find('.sk-beseda .agents').container, 'agents / inline-size');
  assert.equal(find('.sk-beseda .agents', mid)['container-name'], 'agents rows');
  assert.ok(inside('@container rows (min-width: 520px)').some((r) => r.sel === '.sk-beseda .ag-time' && /display:\s*block/.test(r.body)));
  const tight = inside('@container rows (max-width: 519px)');
  assert.ok(tight.some((r) => r.sel === '.sk-beseda .ag-steps' && /grid-area:\s*2 \/ 3 \/ 3 \/ 6/.test(r.body)), 'the line of state takes the whole width');
  assert.ok(tight.some((r) => r.sel === '.sk-beseda .ag-acts' && /grid-area:\s*1 \/ 4 \/ 2 \/ 6/.test(r.body)), 'the buttons stand beside the name only');
  assert.equal(RULES.filter((r) => r.at.some((q) => /@container (?:agents|rows) \(max-width: 519px\)/.test(q)) && r.at.length > 1).length, 0);
  // a long list of changed files scrolls inside its block in the feed
  assert.equal(find('.sk-beseda .changed .flist')['overflow-y'], 'auto');
  // a wide window: the islands on the right scroll inside themselves; a name takes two lines before
  // it is cut, and the one long state ("waits for your answer") has its steps on a line of their own
  const wide = '@media (min-width: 1100px)';
  assert.equal(find('.sk-beseda .ag-name', wide)['-webkit-line-clamp'], '2');
  assert.equal(find('.sk-beseda .ag[data-state="waiting"] .ag-steps', wide)['grid-area'], '3 / 2 / 4 / 5');
  assert.equal(find('.sk-beseda .ag[data-state="waiting"] .ag-acts', wide)['grid-area'], '4 / 2 / 5 / 4');
  assert.equal(find('.sk-beseda .ag-list', wide)['overflow-y'], 'auto');
  assert.equal(find('.sk-beseda .files .flist', wide)['overflow-y'], 'auto');
  assert.match(find('.sk-beseda .app:not(.is-empty) .files.on', wide)['max-height'], /%$/);
});

test('beseda: a narrow window and a narrow bar have their rules', () => {
  const narrow = '@media (max-width: 719px)';
  assert.equal(find('.sk-beseda .sugg', narrow)['grid-template-columns'], 'minmax(0, 1fr)');
  assert.equal(find('.sk-beseda .ask.q .opts', narrow)['flex-direction'], 'column');
  assert.equal(find('.sk-beseda .head', narrow).display, 'none');
  assert.equal(find('.sk-beseda .msg.assistant::before', narrow).display, 'none');
  // the bar under the input gives way by its own width, a value at a time — never cut to two letters
  const bar = RULES.filter((r) => r.at.some((a) => a.startsWith('@container bar')));
  assert.ok(bar.some((r) => /\.hint/.test(r.sel) && /display:\s*none/.test(r.body)));
  assert.ok(bar.some((r) => /\.s-source \.sel-v/.test(r.sel) && /\.s-effort \.sel-v/.test(r.sel) && /display:\s*none/.test(r.body)));
  assert.equal(find('.sk-beseda .s-effort').flex, 'none', 'the level of reasoning is never squeezed');
  // the turn line: its step is what shrinks
  assert.equal(find('.sk-beseda .turn > .turn-step')['text-overflow'], 'ellipsis');
  // the side columns give way to the chat
  assert.match(find('.sk-beseda')['--side'], /^clamp\(/);
  assert.match(find('.sk-beseda')['--rail'], /^clamp\(/);
  // the height of a menu is left to the page script, which places it by what it really takes
  assert.equal(find('.sk-beseda #menu')['max-height'], undefined);
  assert.ok(!/max-height[^;]*!important/.test(CSS));
});

// ── the form of the file ────────────────────────────────────────

test('beseda: every at-rule starts at the first column; motion is left to base.ts', () => {
  // test/window.test.mjs reads a skin rule by its first character: an indented at-rule would read as a selector
  for (const line of RAW.split('\n')) {
    if (/^\s+@/.test(line)) assert.fail(`an indented at-rule: ${line.trim()}`);
  }
  // prefers-reduced-motion is honoured in base.ts for everything inside .app — the skin does not fight it
  assert.ok(!/(?:animation|transition)[^;{}]*!important/.test(CSS));
  for (const r of RULES) {
    if (!/\banimation\s*:/.test(r.body)) continue;
    assert.ok(/^\.sk-beseda /.test(r.sel), `${r.sel}: an animation outside the window`);
  }
  // nothing moves by more than a hair on hover: a lift of a pixel, a press of a few per cent
  for (const m of CSS.matchAll(/transform:\s*([^;]+);/g)) {
    assert.match(m[1], /^(?:none|translateY\(-1px\)|scale\(\.9\d*\))$/, `transform: ${m[1]}`);
  }
});
