// The workbench skin (src/skins/verstak.ts): what its polish pass fixed and
// what can be checked without a browser.
//   - colours are tokens, and what the skin derives from them (the edge of an
//     input, the selection) keeps its contrast in both themes;
//   - more tabs than room: they give way, then the strip scrolls; nothing of
//     the skin takes the plus or the buttons after it off the strip;
//   - the keyboard focus is drawn inside whatever sits in a clipping box;
//   - every kind of control has a pressed state and a hover one;
//   - a subagent's row, the code gutter, the column widths.
// The page itself (markup, script, the other skins) is test/window.test.mjs.
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
const SKIN = BOTH.SKINS.find((s) => s.id === 'verstak');
const CSS = SKIN.css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The skin's rules, flat: { sel, decl, at } — at is the chain of at-rules around the rule. */
function rules(css) {
  const out = [];
  const walk = (text, at) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const head = text.slice(i, open).trim(), body = text.slice(open + 1, j - 1);
      if (head.startsWith('@')) walk(body, at.concat(head));
      else for (const sel of head.split(',')) out.push({ sel: sel.trim().replace(/\s+/g, ' '), decl: body.trim(), at });
      i = j;
    }
  };
  walk(css, []);
  return out;
}
const RULES = rules(CSS);
const S = '.sk-verstak ';
/** Declarations of every rule for the selector (as written after ".sk-verstak "), joined. */
const decl = (sel, at) => RULES
  .filter((r) => r.sel === S + sel && (at === undefined || r.at.join(' ').includes(at)))
  .map((r) => r.decl).join(' ');
const has = (sel, re, at) => re.test(decl(sel, at));

const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));
const lum = (rgb) => {
  const v = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, pa, b) => a.map((c, i) => c * pa + b[i] * (1 - pa));
const THEMES = [[0, 'light'], [1, 'dark']];
const tok = (name, i) => hex(SKIN.palette[name][i]);

// ── colours ─────────────────────────────────────────────────────

test('verstak: no literal colour in the stylesheet — tokens only', () => {
  assert.deepEqual(CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], 'a hex colour');
  assert.ok(!/\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab)\(/.test(CSS), 'a colour function');
  const named = /:\s*(?:[^;{}]*\s)?(white|black|red|green|blue|gray|grey|silver|orange|yellow|navy|teal|purple)\b/i;
  for (const r of RULES) assert.ok(!named.test(r.decl.replace(/[\w-]*(?:white-space|black)[\w-]*\s*:[^;]*/g, '')), `a named colour in ${r.sel}`);
  // color-mix is allowed only between tokens (or a token and transparent)
  for (const m of CSS.matchAll(/color-mix\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    for (const part of m[1].split(',').slice(1)) {
      assert.match(part.trim(), /^(var\(--[\w-]+\)|transparent|currentColor)(\s+\d+%)?$/, `color-mix of something that is not a token: ${m[0]}`);
    }
  }
});

test('verstak: every variable it uses is a token or its own', () => {
  const own = new Set([...CSS.matchAll(/(?:^|[\s;{])--([\w-]+)\s*:/g)].map((m) => m[1]));
  const shared = new Set([...BOTH.TOKENS, 'side-shift']);
  for (const m of CSS.matchAll(/var\(--([\w-]+)/g)) {
    assert.ok(own.has(m[1]) || shared.has(m[1]), `var(--${m[1]}) is neither a token nor defined by the skin`);
  }
  // what the skin derives from tokens is defined with a fallback for a browser without color-mix
  assert.match(CSS, /\.sk-verstak \{[^}]*--line3: var\(--mute\);/, 'the plain fallback of --line3');
  assert.ok(RULES.some((r) => r.sel === '.sk-verstak' && r.at.some((a) => a.startsWith('@supports') && a.includes('color-mix')) && /--line3: color-mix\(in srgb, var\(--mute\) 60%, var\(--line2\)\)/.test(r.decl)));
});

test('verstak: what it derives from tokens keeps its contrast in both themes', () => {
  const bad = [];
  const need = (what, r, min, theme) => { if (r < min) bad.push(`${theme}: ${what} = ${r.toFixed(2)} < ${min}`); };
  for (const [i, theme] of THEMES) {
    // the edge of the input, of a dialog's field, of a radio mark: 3:1 against what it lies on
    const line3 = mix(tok('mute', i), 0.6, tok('line2', i));
    for (const bg of ['bg', 'panel']) need(`--line3 on ${bg}`, ratio(line3, tok(bg, i)), 3, theme);
    // selected text: the words on the selection, and the selection seen on the page
    const sel = mix(tok('accent', i), 0.3, tok('bg', i));
    need('text on the selection', ratio(tok('fg', i), sel), 4.5, theme);
    need('the selection against the page', ratio(sel, tok('bg', i)), 1.5, theme);
    // marks that carry meaning alone: focus ring, the bar of the chat on screen, a checked choice
    for (const bg of ['bg', 'panel', 'accent-soft', 'raised']) {
      need(`focus on ${bg}`, ratio(tok('focus', i), tok(bg, i)), 3, theme);
      need(`accent on ${bg}`, ratio(tok('accent', i), tok(bg, i)), 3, theme);
    }
    // a disabled small button stays readable; line numbers on the code background; hint lines on a request
    need('disabled .mini', ratio(tok('mute', i), tok('panel', i)), 4.5, theme);
    need('line numbers', ratio(tok('mute', i), tok('code-bg', i)), 4.5, theme);
    need('hint line on a permission request', ratio(tok('mute', i), tok('warn-soft', i)), 4.5, theme);
    need('a key on the primary answer', ratio(tok('accent-fg', i), tok('accent-bg', i)), 4.5, theme);
    need('a pressed refusal', ratio(tok('err', i), tok('del-bg', i)), 4.5, theme);
    // pressed primary: the fill darkened by a tenth still carries its label
    need('pressed primary', ratio(tok('accent-fg', i), tok('accent-bg', i).map((c) => c * 0.9)), 4.5, theme);
    need('hovered primary', ratio(tok('accent-fg', i), tok('accent-bg', i).map((c) => Math.min(255, c * 1.1))), 4.5, theme);
  }
  assert.deepEqual(bad, []);
  assert.ok(has('.box', /border: 1px solid var\(--line3\)/) && has('.dlg-input', /border: 1px solid var\(--line3\)/) && has('.o-mark', /solid var\(--line3\)/));
  assert.ok(has('.p-tag:hover', /color: var\(--fg\)/), 'the green tag on its hover background was 4.34:1');
  // the answers not given to a question step back without opacity: their words keep 4.5:1
  assert.ok(has('.ask.q.answered .opt:not(.chosen)', /opacity: 1/) && has('.ask.q.answered .opt:not(.chosen) b', /color: var\(--mute\)/));
  assert.ok(has('.mini:disabled', /opacity: 1/) && has('.mini:disabled', /color: var\(--mute\)/));
});

// ── the tab strip ───────────────────────────────────────────────

test('verstak: more tabs than room — they give way, then scroll; the plus and the buttons stay', () => {
  assert.ok(has('.tab', /flex-shrink: 1/) && has('.tab', /min-width: 124px/), 'tabs shrink down to a minimum');
  assert.ok(has('.tab.active', /flex-shrink: 0/), 'the chat on screen keeps its name');
  assert.ok(has('.tab:has(.bdg.wake)', /min-width: 172px/), 'a tab with a wake-up time keeps room for its title');
  assert.ok(has('.tabstrip', /scroll-padding-inline: 24px/), 'the active tab is brought into view clear of the fade');
  // a short name in a tab held at its minimum width: the cross stays at the edge, and a hidden cross takes no click
  assert.ok(has('.tab-t', /flex: 1 1 auto/), 'the name takes the spare room of a tab');
  assert.ok(has('.tab:not(:hover):not(.active):not(:focus-within) .tab-x', /pointer-events: none/));
  // nothing of the skin hides, pins or floats what stands after the strip
  for (const r of RULES) {
    if (!/\.newtab|\.js-hist|\.js-menu|\.tabs > \.ib|\.tabs \.ib/.test(r.sel)) continue;
    assert.ok(!/display:\s*none|position:\s*(absolute|fixed|sticky)|visibility:\s*hidden/.test(r.decl), `${r.sel} takes a button off the strip`);
  }
  assert.ok(!has('.tabstrip', /overflow/), 'the strip keeps the scrolling base.ts gives it');
  // a narrow window has no tab strip at all: the top strip takes over
  assert.ok(has('.tabs', /display: none/, '(max-width: 719px)'));
});

// ── the keyboard ────────────────────────────────────────────────

test('verstak: the focus ring is drawn inside what a clipping box would cut', () => {
  for (const sel of ['.tab:focus-visible', '.tool > summary:focus-visible', '.ag:focus-visible', '.ag-h:focus-visible', '.mi:focus-visible', '.dlg-item:focus-visible']) {
    assert.ok(has(sel, /outline-offset: -2px/), `${sel} needs an inset ring`);
  }
  assert.ok(has('.st-item:focus-visible', /outline-offset: 1px/), 'the status line is 24px high: a ring of 2+2 would not fit');
  // what the shared script made reachable from the keyboard has a shape for its ring: the cross of a toast, the reasoning line
  assert.ok(has('.toast > i', /width: 20px; height: 20px/) && has('.toast > i:focus-visible', /outline-offset: 0/) && has('.toast > i:hover', /background: var\(--hover\)/));
  assert.ok(has('.thinking-toggle', /border-radius: 3px/) && has('.thinking-toggle:hover', /text-decoration: underline/));
  assert.ok(has('.feed', /scroll-padding-block: 10px/), 'Tab brings a button into view with room for its ring');
  for (const sel of ['.rail', '.s-scroll', '#sheet .info']) assert.ok(has(sel, /scroll-padding-block: 8px/), `${sel} scrolls a focused button flush against its edge`);
  // the outline is taken away only from what is typed into: its box shows the focus instead
  const gone = RULES.filter((r) => /outline:\s*(0|none)\b/.test(r.decl)).map((r) => r.sel).sort();
  assert.deepEqual(gone, [S + '.dlg-input:focus-visible', S + 'textarea:focus-visible']);
  assert.ok(has('.box:focus-within', /border-color: var\(--accent\)/) && has('.box:focus-within', /box-shadow/));
  assert.ok(has('.dlg-input:focus', /border-color: var\(--accent\)/));
});

// ── states ──────────────────────────────────────────────────────

test('verstak: hover and pressed states for every kind of control', () => {
  const sels = RULES.map((r) => r.sel);
  const state = (base, pseudo) => sels.some((s) => s.startsWith(S) && s.includes(base) && s.includes(pseudo));
  const ghost = ['.ib', '.sel', '.chat', '.s-link', '.tab', '.tab-x', '.c-x', '.p-tag', '.ask-from', '.copy', '.pk', '.mi', '.dlg-item'];
  const bordered = ['.newchat', '.ask.perm .opt', '.ask.q .opt', '.mini', '.btn2', '.sg', '.login-copy', '.dlg-btns button'];
  const primary = ['.send', '.stop', '.btn', '.a-login', '.ask.perm .opt.primary', '.dlg-btns button.primary', '.toast > button'];
  for (const c of [...ghost, ...bordered, ...primary]) assert.ok(state(c, ':active'), `${c} has no pressed state`);
  for (const c of ['.newchat', '.chat', '.s-link', '.tab', '.tab-x', '.sel', '.mini', '.btn', '.btn2', '.sg', '.send', '.mi', '.pk', '.copy', '.dlg-item', '.a-login', '.frow', '.ag']) {
    assert.ok(state(c, ':hover'), `${c} has no hover state`);
  }
  // pressed: a ghost button gets a frame, a bordered one the accent, a primary one goes darker
  const pressed = (sel) => RULES.find((r) => r.sel === S + sel).decl;
  assert.match(pressed('.sel:active'), /background: var\(--hover\); box-shadow: inset 0 0 0 1px var\(--line2\)/);
  assert.match(pressed('.btn2:active'), /border-color: var\(--accent\); background: var\(--accent-soft\)/);
  assert.match(pressed('.send:active'), /filter: brightness\(\.9\)/);
  assert.match(pressed('.ask.perm .opt.deny:active'), /border-color: var\(--err\); background: var\(--del-bg\)/);
  // a pressed state never fires on what cannot be pressed
  assert.ok(sels.includes(S + '.mini:active:not(:disabled)') && !sels.includes(S + '.mini:active'));
  // what is chosen says so with more than a tint: the chat on screen, the theme, an answer
  assert.ok(has('.chat.active::before', /background: var\(--accent\)/));
  assert.ok(has('.seg button[aria-checked="true"]', /box-shadow: inset 0 0 0 1px var\(--accent\)/));
  assert.ok(has('.ask.q .opt.chosen', /border-color: var\(--accent\)/));
  assert.ok(has('.tab.active', /box-shadow: inset 0 2px 0 var\(--accent\)/));
});

test('verstak: motion is only transitions inside the window, which the shared rule stops on request', () => {
  assert.ok(!/@keyframes/.test(CSS) && !/\banimation(-name)?\s*:/.test(CSS), 'the skin brings no animation of its own');
  // no !important anywhere: nothing fights prefers-reduced-motion or the place the script gives a menu
  assert.deepEqual(RULES.filter((r) => /!important/.test(r.decl)).map((r) => r.sel), []);
  for (const r of RULES) if (/transition\s*:/.test(r.decl)) assert.ok(r.sel.startsWith(S), r.sel);
});

// ── layout ──────────────────────────────────────────────────────

test('verstak: the side columns give way to the feed; the breakpoints are the ones the script knows', () => {
  const root = RULES.find((r) => r.sel === '.sk-verstak' && !r.at.length).decl;
  assert.match(root, /--side-w: clamp\(232px, 19vw, 264px\)/);
  assert.match(root, /--rail-w: clamp\(272px, 23vw, 320px\)/);
  assert.ok(has('.app', /grid-template-columns: var\(--side-w\) minmax\(0, 1fr\) var\(--rail-w\)/));
  const media = new Set(RULES.flatMap((r) => r.at).filter((a) => a.startsWith('@media')).flatMap((a) => a.match(/\d+px/g)));
  assert.deepEqual([...media].sort(), ['1099px', '719px', '720px'], 'script.ts moves the cards at 1100 and folds the sidebar at 720');
  // every track that holds text may shrink: nothing widens the window
  for (const r of RULES) {
    const m = r.decl.match(/grid-template-columns:\s*([^;]+)/);
    if (m && !/subgrid/.test(m[1])) assert.ok(!/(^|\s)1fr(\s|$)/.test(m[1].replace(/minmax\([^)]*\)/g, 'M').replace(/repeat\([^)]*\)/g, 'M')), `${r.sel}: a bare 1fr does not shrink below its content`);
  }
  assert.ok(has('.sugg', /repeat\(auto-fit, minmax\(min\(100%, 248px\), 1fr\)\)/), 'suggestions fall into one column in a narrow feed');
});

test('verstak: a subagent row — wide buttons do not squeeze the steps; one line per row is a table', () => {
  assert.ok(has('.ag', /grid-template-columns: 16px auto minmax\(0, 1fr\) auto auto/));
  assert.ok(has('.ag-acts', /grid-area: 1 \/ 4 \/ 2 \/ 6/) && has('.ag-steps', /grid-area: 2 \/ 3 \/ 3 \/ 5/) && has('.ag-time', /grid-area: 2 \/ 5/));
  const sub = RULES.filter((r) => r.at.some((a) => a.startsWith('@supports') && a.includes('subgrid')));
  assert.deepEqual(sub.map((r) => r.sel).sort(), [S + '.ag', S + '.ag-list']);
  assert.ok(sub.every((r) => r.at.some((a) => a.includes('max-width: 1099px') && a.includes('min-width: 720px'))), 'only where a row is one line');
  assert.match(sub.find((r) => r.sel === S + '.ag').decl, /grid-template-columns: subgrid/);
  assert.ok(has('.f-name', /flex-shrink: 0/) && has('.f-name', /max-width: 100%/), 'a file name is cut after its folder, not with it');
});

test('verstak: code is numbered by lines without touching its text or its tabs', () => {
  assert.ok(has('pre.code > code', /counter-reset: ln/));
  const line = decl('pre.code > code > .l'), num = decl('pre.code > code > .l::before');
  assert.match(line, /padding-left: var\(--gut\)/);
  assert.match(line, /counter-increment: ln/);
  assert.match(num, /content: counter\(ln\)/);
  // the number sits in the line's padding: the text starts at the content edge, a tab stops where it did
  assert.match(num, /width: var\(--gut\); margin-left: calc\(-1 \* var\(--gut\)\)/);
  assert.match(num, /position: sticky; left: 0/);
  assert.match(num, /background: var\(--code-bg\)/);
  assert.match(num, /user-select: none/);
  assert.ok(has('pre.code > code:has(> .l:nth-child(1000)) > .l', /--gut: 52px/), 'four digits get their room');
});

test('verstak: key hints are on; what the shared files do is left to them', () => {
  assert.ok(has('.ask.perm .opt > .key', /display: inline-block/) && has('.ask.perm .opt > .key', /order: -1/));
  assert.ok(has('.newchat > .key', /display: inline-block/));
  assert.ok(has('.ask-hint', /display: block/) && has('.turn-esc', /display: inline/));
  assert.ok(has('.ah-2', /display: none/, '(max-width: 719px)') && has('.ah-3', /display: none/, '(max-width: 719px)'), 'a narrow window keeps the first part of the hint');
  // the height and the place of a menu are the script's (winPlace); attachments in a row are base.ts's
  assert.ok(!/max-height/.test(decl('#menu') + decl('.pop')), 'the skin does not cap a menu the script has placed');
  assert.ok(!/align-items/.test(decl('.gallery') + decl('#chips')), 'the skin does not repeat what base.ts says about a row of attachments');
});
