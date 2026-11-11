// The «Телетайп» skin (src/skins/teletype.ts): what was put right in it and
// can be held without a browser.
//   - colours are tokens: not one literal value in its rules;
//   - the table of subagents has no width counted in characters: its columns
//     are tracks of one shared grid, sized by their content, the name takes
//     the rest; columns go by the width of the table, not of the window;
//   - the status line gives way cell by cell instead of being cut by the edge;
//   - the keyboard focus has a colour of its own on yellow and on the inverse
//     status line, and stays inside rows that run edge to edge;
//   - the marker of a long message is limited; selection is not the marker's
//     colour; nothing fades text by opacity;
//   - what blinks stands still for those who asked for less motion;
//   - the pairs of colours the skin puts on top of each other keep 4.5:1 for
//     text and 3:1 for rings and frames, in both themes.
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

const PAGE = load('./.webviewHtml.cjs');
const SKIN = PAGE.SKINS.find((s) => s.id === 'teletype');
const CSS = SKIN.css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The rules of the skin, flat: { sel, body, at } — `at` is the chain of at-rules a rule sits in. */
function rules(css) {
  const out = [];
  const walk = (text, at) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const head = text.slice(i, open).trim();
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@')) walk(body, at.concat(head));
      else out.push({ sel: head.replace(/\s+/g, ' '), body: body.trim(), at });
      i = j;
    }
  };
  walk(css, []);
  return out;
}
const RULES = rules(CSS);
/** Rules one of whose selectors satisfies the test. */
const where = (fn) => RULES.filter((r) => r.sel.split(',').some((s) => fn(s.trim())));
/** The value of a declaration in a rule body ('' when it is not there). */
const decl = (body, prop) => {
  const m = new RegExp('(?:^|;)\\s*' + prop.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+)').exec(body);
  return m ? m[1].trim() : '';
};
/** Top-level tracks of a grid template: "max-content 14px minmax(0, 1fr)" → three. */
function tracks(template) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of template.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

test('teletype: the parser sees the skin', () => {
  assert.ok(SKIN && RULES.length > 250, 'the rules of the skin');
  for (const r of RULES) {
    for (const s of r.sel.split(',')) assert.ok(s.trim().startsWith('.sk-teletype'), `a rule outside the skin: ${s.trim()}`);
  }
});

test('teletype: colours are tokens — no literal colour in its rules', () => {
  assert.deepEqual(CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || [], [], 'no hex colour');
  assert.ok(!/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(CSS), 'no colour function');
  const named = /:\s*[^;{}]*\b(?:white|black|red|green|blue|yellow|orange|gray|grey|silver|gold|navy|teal|purple|pink|brown)\b/;
  for (const r of RULES) assert.ok(!named.test(';' + r.body.replace(/var\([^)]*\)/g, 'var()')), `a named colour in ${r.sel}`);
  // every variable used is a token, or one the skin (or the base) defines for layout
  const own = new Set(['font', 'mono', 'col', 'gut', 'ag-cols', 'side-shift']);
  for (const m of CSS.matchAll(/var\(--([\w-]+)/g)) {
    assert.ok(PAGE.TOKENS.includes(m[1]) || own.has(m[1]), `var(--${m[1]}) is neither a token nor a variable of the skin`);
  }
});

test('teletype: the table of subagents — tracks sized by content, no width in characters', () => {
  const templates = RULES.filter((r) => /--ag-cols\s*:/.test(r.body)).map((r) => ({ at: r.at.join(' '), cols: tracks(decl(r.body, '--ag-cols')) }));
  assert.ok(templates.length >= 4, 'the default template and the ones for narrower tables');
  for (const t of templates) {
    assert.ok(!/\d(?:ch|ex|em|rem|%|vw)\b/.test(t.cols.join(' ')), `a width in characters or of the window: ${t.cols.join(' ')}`);
    // exactly one flexible track — the name: it takes what the others leave and keeps a floor in px
    const flex = t.cols.filter((c) => /fr\)?$/.test(c));
    assert.ok(flex.length === 1 && /^minmax\((?:\d+px|0), 1fr\)$/.test(flex[0]), `the name takes the rest: ${t.cols.join(' ')}`);
    assert.equal(t.cols.indexOf(flex[0]), 2, 'number, mark, then the name');
    // what is text is as wide as its text; the only fixed tracks are the mark (14px) and the bar (98px)
    const fixed = t.cols.filter((c) => /^\d+px$/.test(c));
    assert.ok(fixed.every((c) => c === '14px' || c === '98px'), `a fixed width for text: ${t.cols.join(' ')}`);
    assert.equal(t.cols[0], 'max-content', 'the number is as wide as it is');
    assert.ok(t.cols.includes('max-content'), 'the buttons are never cut');
    for (const c of t.cols) {
      assert.ok(/^(?:max-content|14px|98px|minmax\((?:0|\d+px), (?:1fr|max-content)\))$/.test(c), `an unexpected track: ${c}`);
    }
  }
  // a narrower table has fewer tracks, and by its own width (a container query), not the window's
  const byWidth = templates.filter((t) => t.at.includes('@container agents'));
  assert.ok(byWidth.length >= 3 && templates.every((t) => !t.at.includes('@media')), 'columns go by the width of the table');
  // wider than the log above it, the table ends with the log's column instead of stretching
  const cap = RULES.find((r) => r.sel === '.sk-teletype .ag-list' && r.at.some((a) => /@container agents \(min-width: \d+px\)/.test(a)));
  assert.ok(cap && decl(cap.body, 'width') === 'fit-content' && /^\d+px$/.test(decl(cap.body, 'min-width')) && decl(cap.body, 'max-width') === '100%',
    'a very wide table is as wide as the log, or as its names need');
  assert.ok(where((s) => s === '.sk-teletype .agents').some((r) => /container\s*:\s*agents \/ inline-size/.test(r.body)), 'the table is the container');
  const base = templates.find((t) => !t.at);
  const narrow = templates.filter((t) => /max-width/.test(t.at)).sort((a, b) => a.cols.length - b.cols.length);
  assert.ok(narrow[0].cols.length < base.cols.length && narrow[0].cols.length === 4, 'the narrowest table: number, mark, name, buttons');
  // every row shares the tracks of the list
  const row = where((s) => s === '.sk-teletype .ag');
  assert.ok(row.some((r) => r.at.some((a) => a.startsWith('@supports')) && /grid-template-columns\s*:\s*subgrid/.test(r.body)), 'rows are subgrids of the list');
  assert.ok(row.some((r) => !r.at.length && /grid-template-columns\s*:\s*var\(--ag-cols\)/.test(r.body)), 'without subgrid a row lays the same tracks out');
  // no cell of the table has a width of its own in characters
  for (const r of where((s) => /\.ag(?:-[a-z]+)?\b/.test(s.replace('.sk-teletype', '')) || /\.mini\b/.test(s))) {
    assert.ok(!/(?:^|;)\s*(?:min-|max-)?width\s*:[^;]*\d(?:ch|ex|em)\b/.test(r.body), `a width in characters: ${r.sel}`);
  }
});

test('teletype: the status line gives way cell by cell, the turn and the version never', () => {
  const shrink = (cls) => {
    let v = '';
    for (const r of where((s) => s === '.sk-teletype ' + cls)) {
      const f = decl(r.body, 'flex');
      if (f) v = f.split(/\s+/)[1];
      const s = decl(r.body, 'flex-shrink');
      if (s) v = s;
    }
    return Number(v);
  };
  const all = shrink('.st-item');
  assert.equal(all, 1, 'every cell may give way');
  assert.equal(shrink('.st-turn'), 0);
  assert.equal(shrink('.st-ver'), 0);
  const order = [shrink('.st-inbox'), shrink('.st-host'), shrink('.st-sync'), all];
  for (let i = 0; i < order.length - 1; i++) {
    // orders apart: a cell whose turn has not come loses less than a layout unit, so its text is not cut
    assert.ok(order[i] >= order[i + 1] * 1e4, `the cells give way one at a time: ${order.join(' > ')}`);
  }
  assert.ok(where((s) => s === '.sk-teletype .status').some((r) => /container\s*:\s*status \/ inline-size/.test(r.body)));
  const dropped = RULES.filter((r) => r.at.some((a) => a.startsWith('@container status')) && /display\s*:\s*none/.test(r.body)).map((r) => r.sel);
  assert.ok(dropped.some((s) => s.includes('.st-inbox')) && dropped.some((s) => s.includes('.st-host')), 'whole cells go by the width of the line');
  for (const r of where((s) => /\.st(?:atus|-[a-z]+)\b/.test(s))) {
    assert.ok(!/(?:^|;)\s*(?:min-|max-)?width\s*:[^;]*\d(?:ch|ex|em)\b/.test(r.body), `a width in characters: ${r.sel}`);
  }
});

test('teletype: the keyboard focus is seen on yellow, on the inverse line and in rows', () => {
  const focus = (needle) => where((s) => s.includes(needle) && s.includes(':focus-visible'));
  const has = (needle, prop, value) => focus(needle).some((r) => decl(r.body, prop) === value);
  // on yellow the ring is the ink colour: the focus colour of the dark theme is that same yellow
  assert.equal(SKIN.palette['focus'][1], SKIN.palette['accent-bg'][1], 'the premise: dark focus is the accent');
  for (const el of ['.newchat', '.send', '.btn', '.a-login', '.mini.hot', '.toast > button', '.dlg-btns button.primary', '.chat.active:', '.chat.active .c-x', '.ask-from']) {
    assert.ok(has(el, 'outline-color', 'var(--accent-fg)'), `${el}: the ring on yellow is the ink colour`);
  }
  // on the inverse status line (and the chosen theme button) it is the paper colour, inside the cell
  assert.ok(has('.st-item', 'outline-color', 'var(--bg)') && has('.st-item', 'outline-offset', '-4px'));
  assert.ok(has('.seg button[aria-checked="true"]', 'outline-color', 'var(--bg)'));
  // rows that run edge to edge keep the ring inside: outside it would be cut by the list
  for (const el of ['.chat:', '.s-link', '.ag:', '.ag-h', '.tool > summary', '.mi:', '.feed']) {
    assert.ok(focus(el).some((r) => /^-\d+px$/.test(decl(r.body, 'outline-offset'))), `${el}: the ring is inside the row`);
  }
  // the skin never takes the ring away without a replacement
  for (const r of where((s) => s.includes(':focus'))) {
    if (/outline\s*:\s*(?:0|none)/.test(r.body)) {
      assert.equal(r.sel, '.sk-teletype textarea:focus-visible', `the ring is removed: ${r.sel}`);
    }
  }
  assert.ok(where((s) => s === '.sk-teletype .box:focus-within .prompt').some((r) => /var\(--focus\)/.test(r.body)), 'the input shows its focus on the prompt mark');
  // the pointer and the press on the inverse line differ from rest and from each other
  const st = (state) => where((s) => s === '.sk-teletype button.st-item' + state)[0];
  assert.ok(st(':hover') && st(':active') && decl(st(':hover').body, 'background') !== decl(st(':active').body, 'background'));
});

test('teletype: a long message is not a yellow field; selection is not the marker; nothing is faded', () => {
  const marker = where((s) => s === '.sk-teletype .msg.user .m-text')[0];
  assert.ok(marker, 'the marker rule');
  assert.ok(!/box-decoration-break\s*:\s*clone/.test(marker.body), 'one background along the whole run of text, not one per line');
  assert.match(decl(marker.body, 'background-size'), /^min\(100%, \d+cqi\) 100%/, 'the marker stops after a few lines');
  assert.ok(where((s) => s === '.sk-teletype .msg.user').some((r) => /container\s*:\s*\w+ \/ inline-size/.test(r.body)), 'the column is what the marker is measured in');
  const sel = where((s) => s === '.sk-teletype .app ::selection')[0];
  assert.ok(sel && decl(sel.body, 'background') === 'var(--fg)' && decl(sel.body, 'color') === 'var(--bg)', 'selection is inverse video');
  assert.notEqual(decl(sel.body, 'background'), 'var(--accent-soft)', 'selected text on the marker stays visible');
  // text is muted by colour: an opacity below 1 would take it under 4.5:1
  for (const r of RULES) {
    const o = decl(r.body, 'opacity');
    assert.ok(!o || Number(o) === 1, `opacity ${o} in ${r.sel}`);
  }
  assert.ok(where((s) => s === '.sk-teletype .ask.q.answered .opt:not(.chosen)').some((r) => decl(r.body, 'opacity') === '1'));
  assert.ok(where((s) => s === '.sk-teletype .mini:disabled').some((r) => decl(r.body, 'opacity') === '1' && decl(r.body, 'color') === 'var(--mute)'));
});

test('teletype: what blinks stands still under prefers-reduced-motion', () => {
  const classesOf = (sel) => (sel.trim().split(/\s+/).pop().match(/\.[\w-]+/g) || []);
  const animated = RULES.filter((r) => !r.at.some((a) => a.includes('prefers-reduced-motion')) && /(?:^|;)\s*animation\s*:/.test(r.body));
  assert.ok(animated.length >= 4, 'the cursor, the busy mark, the running marks');
  const still = RULES.filter((r) => r.at.some((a) => /prefers-reduced-motion:\s*reduce/.test(a)) && decl(r.body, 'animation') === 'none');
  assert.ok(still.length, 'the skin has its own rule for reduced motion');
  const stopped = still.flatMap((r) => r.sel.split(',').map(classesOf));
  for (const r of animated) {
    for (const s of r.sel.split(',')) {
      const cls = classesOf(s);
      assert.ok(stopped.some((st) => st.every((c) => cls.includes(c))), `${s.trim()} keeps blinking under reduced motion`);
    }
  }
  // standing still, the mark stays visible (the blink ends on opacity 0)
  assert.ok(still.every((r) => decl(r.body, 'opacity') === '1'));
  // only the blink of the cursor and of the busy marks: nothing else moves by itself
  for (const r of animated) assert.match(decl(r.body, 'animation'), /^ex-blink /, r.sel);
});

test('teletype: the pairs the skin puts on top of each other keep their contrast in both themes', () => {
  const lum = (hex) => {
    const v = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // text on its background: 4.5:1
  const text = [
    ['accent-fg', 'accent-bg'],   // black on yellow: the new chat, the active chat, a request's heading, the turn
    ['accent-bg', 'accent-fg'],   // selection inside yellow
    ['accent-bg', 'bg'],          // yellow on the dark page (dark theme only, see below)
    ['bg', 'fg'], ['fg', 'bg'],   // the inverse status line; a pressed cell of it; selection
    ['bg', 'dim'],                // a status cell under the pointer; the first answer under the pointer
    ['bg', 'err'],                // the key of the refusal
    ['err', 'bg'],                // the refusal itself
    ['mute', 'bg'], ['mute', 'panel'], ['mute', 'code-bg'],  // muted answers, disabled buttons, line numbers
    ['fg', 'hover'], ['dim', 'hover'], ['mute', 'hover'],    // rows under the pointer
    ['fg', 'accent-soft'], ['mute', 'accent-soft'],          // the marker; the next step
    ['ok', 'panel'], ['warn', 'panel'], ['err', 'panel'],    // states in the table
  ];
  // rings, frames and marks against what they stand on: 3:1
  const lines = [
    ['focus', 'bg'], ['focus', 'panel'], ['focus', 'accent-soft'],  // the ring outside a control
    ['accent-fg', 'accent-bg'],                                    // the ring on yellow
    ['bg', 'fg'],                                                  // the ring on the inverse line
    ['fg', 'bg'],                                                  // the frame of a request holding the focus
    ['line2', 'bg'], ['line2', 'panel'],                           // frames of buttons, the strict lines
    ['mute', 'bg'], ['mute', 'panel'],                             // the dashed frame of a disabled button
  ];
  const bad = [];
  for (const [i, theme] of [[0, 'light'], [1, 'dark']]) {
    const p = (k) => SKIN.palette[k][i];
    for (const [fg, bg] of text) {
      if (fg === 'accent-bg' && bg === 'bg' && i === 0) continue; // yellow is never text on the light page: there the accent is ink
      const r = ratio(p(fg), p(bg));
      if (r < 4.5) bad.push(`${theme}: text ${fg} on ${bg} = ${r.toFixed(2)}`);
    }
    for (const [fg, bg] of lines) {
      const r = ratio(p(fg), p(bg));
      if (r < 3) bad.push(`${theme}: line ${fg} on ${bg} = ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, []);
  // in the light theme the accent used for text and marks is ink, not yellow
  assert.equal(SKIN.palette['accent'][0], SKIN.palette['fg'][0]);
});

test('teletype: the keys, the numbered code, a refused call and the folded sidebar are styled', () => {
  const shows = (sel) => where((s) => s === sel).some((r) => /^(?:inline-block|block)$/.test(decl(r.body, 'display')));
  assert.ok(shows('.sk-teletype .newchat > .key'), 'the key on the new chat button');
  assert.ok(shows('.sk-teletype .ask.perm .opt > .key'), 'the keys on the answers');
  assert.ok(shows('.sk-teletype .ask-hint'), 'the line of hints under the answers');
  const hint = where((s) => s === '.sk-teletype .ask-hint')[0];
  assert.ok(/padding\s*:/.test(hint.body), 'the hint has its own padding');
  const num = where((s) => s === '.sk-teletype pre.code > code > .l::before')[0];
  assert.ok(num && /counter\(ln\)/.test(num.body) && /user-select\s*:\s*none/.test(num.body), 'lines are numbered, the numbers are not text');
  assert.ok(where((s) => s === '.sk-teletype pre.code > code > .l:only-child::before').length, 'a block of one line is not numbered');
  // every hint of the line wraps whole; a refused call looks refused
  assert.ok(where((s) => s === '.sk-teletype .ask-hint .ah-2').some((r) => decl(r.body, 'display') === 'inline-block'));
  assert.ok(where((s) => s === '.sk-teletype .tool.denied > summary .t-sum').some((r) => /line-through/.test(r.body)), 'a refused call is struck out');
  // the button that folds the sidebar is the base's: the skin does not hide it any more
  assert.ok(!RULES.some((r) => /\.navbtn\b/.test(r.sel) && /display\s*:\s*none/.test(r.body)));
});
