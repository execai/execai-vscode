// Skin 3 · «Телетайп» (the teletype): monospaced character, a yellow marker,
// strict lines. The conversation reads as a log with a margin on the left,
// subagents are a table under it, the status line is inverse.
//
// Everything here hangs on .sk-teletype (the class on <html>). Structure
// common to all skins is in base.ts; change it there only when all three
// need it.

import { Palette, Skin } from './tokens';

/** token → [light, dark]. Text on its background keeps 4.5:1 or better (test/window.test.mjs). */
const palette: Palette = {
  'bg': ['#F6F6F1', '#111110'], 'panel': ['#EDEDE6', '#181816'], 'raised': ['#E4E4DB', '#21211E'],
  'hover': ['#DADACF', '#2B2B27'], 'line': ['#C6C6BA', '#33332E'], 'line2': ['#16160F', '#6E6E62'],
  'fg': ['#16160F', '#EDEDE3'], 'dim': ['#45453B', '#BDBDB0'], 'mute': ['#5C5C50', '#A1A194'],
  'accent': ['#16160F', '#FFD21F'], 'accent-bg': ['#FFD21F', '#FFD21F'], 'accent-fg': ['#16160F', '#16160F'],
  'accent-soft': ['#FFF0A8', '#342E0D'],
  'ok': ['#186A3B', '#6FCF8E'], 'warn': ['#7D5100', '#F0B94F'], 'err': ['#B0271F', '#FF8F82'],
  'warn-soft': ['#FFF0A8', '#342E0D'], 'warn-line': ['#16160F', '#FFD21F'],
  'add-bg': ['#DDF0DF', '#172D1D'], 'del-bg': ['#F8DFDA', '#3A1F1C'],
  'code-bg': ['#EDEDE6', '#0B0B0A'],
  'focus': ['#1F45B5', '#FFD21F'], 'shadow': ['rgba(22,22,15,.14)', 'rgba(0,0,0,.5)'],
};

const css = String.raw`
/* ═══════════ 3 · TELETYPE — monospaced character, a yellow marker, strict lines ═══════════ */
.sk-teletype {
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
  --col: 920px; --gut: 62px;
}
.sk-teletype .app {
  font-size: 13px;
  grid-template-columns: 276px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto auto auto;
  grid-template-areas: "top top" "side feed" "side rail" "side comp" "stat stat";
}
.sk-teletype .app.no-rail .rail { display: none; }
.sk-teletype .tabs, .sk-teletype .head, .sk-teletype .app .turn, .sk-teletype .s-brand { display: none; }
.sk-teletype .ib { border-radius: 0; }
.sk-teletype .app kbd { border-radius: 0; border-color: var(--line2); font-size: .82em; }
.sk-teletype .dot { border-radius: 0; }
/* Selection is inverse video, as in a terminal: it shows on paper, on the
   marker and on yellow alike. Where the block is already inverse or yellow it
   turns the other way. */
.sk-teletype .app ::selection { background: var(--fg); color: var(--bg); }
.sk-teletype .status ::selection, .sk-teletype .msg.user .who::selection, .sk-teletype .ask.perm .opt.primary ::selection, .sk-teletype .stop ::selection { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .status .st-turn ::selection, .sk-teletype .ask.perm:not(.answered) .ask-h ::selection, .sk-teletype .dlg-title::selection, .sk-teletype #conn::selection, .sk-teletype .chat.active ::selection, .sk-teletype .newchat ::selection, .sk-teletype .send ::selection { background: var(--accent-fg); color: var(--accent-bg); }

/* The keyboard focus. A ring outside the control by default; inside it for
   rows that run edge to edge (a ring outside would be cut by the list they
   scroll in); the ink colour on yellow (the focus colour of the dark theme is
   that same yellow); the paper colour on the inverse status line. */
.sk-teletype .app :focus-visible { outline-offset: 1px; }
.sk-teletype .app .chat:focus-visible, .sk-teletype .app .s-link:focus-visible, .sk-teletype .app .ag:focus-visible, .sk-teletype .app .ag-h:focus-visible,
.sk-teletype .app .tool > summary:focus-visible, .sk-teletype .app .mi:focus-visible, .sk-teletype .app .pk:focus-visible, .sk-teletype .app .dlg-item:focus-visible,
.sk-teletype .app .sg:focus-visible, .sk-teletype .app .seg button:focus-visible, .sk-teletype .app .feed:focus-visible { outline-offset: -2px; }
.sk-teletype .app .newchat:focus-visible, .sk-teletype .app .send:focus-visible, .sk-teletype .app .btn:focus-visible, .sk-teletype .app .a-login:focus-visible,
.sk-teletype .app .mini.hot:focus-visible, .sk-teletype .app .toast > button:focus-visible, .sk-teletype .app .dlg-btns button.primary:focus-visible,
.sk-teletype .app .chat.active:focus-visible { outline-color: var(--accent-fg); outline-offset: -4px; }
.sk-teletype .app .chat.active .c-x:focus-visible, .sk-teletype .app .ask.perm:not(.answered) .ask-from:focus-visible { outline-color: var(--accent-fg); }
.sk-teletype .app .st-item:focus-visible { outline-color: var(--bg); outline-offset: -4px; }
.sk-teletype .app .seg button[aria-checked="true"]:focus-visible { outline-color: var(--bg); outline-offset: -4px; }
/* A request that holds the focus (its keys are live): a second frame in ink, clear of its yellow shadow. */
.sk-teletype .app .ask:focus-visible { outline-color: var(--fg); outline-offset: 3px; }

/* the top strip — it starts with the button that folds the sidebar away
   (base turns it on); the icon stands on the sidebar's own left edge */
.sk-teletype .top { display: flex; height: 42px; padding: 0 8px 0 6px; gap: 10px; border-bottom: 2px solid var(--line2); font-family: var(--mono); font-size: 12.5px; }
.sk-teletype .top .crumb { margin-left: 4px; }
.sk-teletype .brand { display: inline-flex; align-items: center; font-family: var(--mono); font-size: 16px; font-weight: 700; letter-spacing: .01em; }
.sk-teletype .cur { display: inline-block; width: 9px; height: 18px; margin-left: 4px; background: var(--accent-bg); animation: ex-blink 1.15s steps(1) infinite; }
.sk-teletype .crumb { color: var(--mute); }
/* The folder never takes more than half of the line from the chat's name. */
.sk-teletype .c-path { max-width: 50%; }
.sk-teletype .c-chat { color: var(--fg); font-weight: 600; }
.sk-teletype .top-meta { color: var(--dim); }
/* the look: a framed word in the strip, turned inside out under the pointer like the other buttons */
.sk-teletype .lookbtn { height: 26px; padding: 0 8px; border-radius: 0; font: 500 12px var(--mono); }
.sk-teletype .lookbtn:hover, .sk-teletype .lookbtn[aria-expanded="true"] { background: var(--fg); color: var(--bg); }
.sk-teletype .lookbtn:hover > *, .sk-teletype .lookbtn[aria-expanded="true"] > * { color: inherit; }
.sk-teletype .thseg { margin: 0; }
.sk-teletype .thseg button { min-width: 28px; }
.sk-teletype .lookbox .pop-skins, .sk-teletype .lookbox .seg { margin: 0; }
.sk-teletype .lookbox .seg { margin-top: 8px; }
.sk-teletype .lookbox .pk { margin-bottom: 0; }
.sk-teletype .lookintro { grid-column: 1 / -1; padding: 0 28px 20px; border-top: 1px solid var(--line2); }
.sk-teletype .li-d { font-size: 13px; }
.sk-teletype .tm-ver:not(:empty)::before { content: "│"; margin-right: 8px; color: var(--mute); }

/* the sidebar — an index */
.sk-teletype .side { background: var(--panel); border-right: 1px solid var(--line2); }
.sk-teletype .newchat { margin: 12px 12px 4px; height: 32px; padding: 0 8px 0 10px; border: 1px solid var(--line2); background: var(--accent-bg); color: var(--accent-fg); font: 600 12px var(--mono); letter-spacing: .05em; text-transform: uppercase; }
.sk-teletype .newchat:hover { box-shadow: 3px 3px 0 var(--line2); transform: translate(-1px, -1px); }
/* The key that does the same: as it is typed, not in capitals. */
.sk-teletype .newchat > .key { display: inline-block; font-weight: 500; letter-spacing: 0; text-transform: none; }
.sk-teletype .newchat:active, .sk-teletype .a-login:active, .sk-teletype .send:active, .sk-teletype .stop:active, .sk-teletype .btn:active { box-shadow: none; transform: translate(1px, 1px); }
.sk-teletype .s-scroll { padding: 0 0 10px; }
.sk-teletype .s-label { display: flex; align-items: center; gap: 8px; padding: 14px 12px 6px; font: 500 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); white-space: nowrap; }
.sk-teletype .s-label::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.sk-teletype .proj-h { height: 28px; padding: 0 12px; font: 600 12.5px var(--mono); }
.sk-teletype .p-ic { display: none; }
.sk-teletype .p-tag { font: 400 11px var(--mono); color: var(--mute); }
.sk-teletype .p-tag::before { content: "["; } .sk-teletype .p-tag::after { content: "]"; }
.sk-teletype .p-tag.ok { color: var(--ok); }
.sk-teletype .p-tag:hover { background: var(--hover); }
.sk-teletype .p-path { font: 11px/1.4 var(--mono); color: var(--mute); padding: 0 12px 5px 12px; }
.sk-teletype .chat { height: 28px; padding: 0 8px 0 10px; gap: 8px; color: var(--dim); }
.sk-teletype .chat:hover { background: var(--hover); color: var(--fg); }
.sk-teletype .c-n { min-width: 14px; text-align: right; font: 500 11px var(--mono); color: var(--mute); }
.sk-teletype .chat.active { background: var(--accent-bg); color: var(--accent-fg); font-weight: 600; }
.sk-teletype .chat.active .c-n, .sk-teletype .chat.active .bdg, .sk-teletype .chat.active .c-x { color: var(--accent-fg); }
.sk-teletype .c-x { border-radius: 0; }
.sk-teletype .bdg { font-family: var(--mono); }
.sk-teletype .bdg.busy { width: 7px; height: 13px; border-radius: 0; background: var(--accent); animation: ex-blink 1.15s steps(1) infinite; }
.sk-teletype .chat.active .bdg.busy { background: var(--accent-fg); }
.sk-teletype .chat.active .bdg.unseen { background: var(--accent-fg); }
.sk-teletype .bdg.unseen { border-radius: 0; }
.sk-teletype .hist .chat { padding-left: 12px; }
.sk-teletype .s-empty { padding: 2px 12px; font: 11.5px var(--mono); }
.sk-teletype .s-foot { border-top: 1px solid var(--line2); padding: 6px 0 8px; }
.sk-teletype .s-link { height: 28px; padding: 0 12px; font: 500 12px var(--mono); color: var(--dim); }
.sk-teletype .s-link:hover { background: var(--hover); color: var(--fg); }
.sk-teletype .sl-v { font-size: 11px; color: var(--mute); }
.sk-teletype .acct { margin-top: 4px; padding: 8px 4px 0 12px; border-top: 1px solid var(--line); font-family: var(--mono); }
.sk-teletype .ava { display: none; }
.sk-teletype .a-mail { font-size: 12px; font-weight: 500; }
.sk-teletype .a-plan { font-size: 11px; color: var(--mute); }
.sk-teletype .a-login { height: 24px; padding: 0 9px; border: 1px solid var(--line2); background: var(--accent-bg); color: var(--accent-fg); font: 600 11.5px var(--mono); }
.sk-teletype .a-login:hover { box-shadow: 2px 2px 0 var(--line2); transform: translate(-1px, -1px); }

/* the feed — a log with a margin on the left */
.sk-teletype .feed { padding: 18px max(28px, calc(100% - 1032px)) 18px 16px; gap: 10px; font-size: 14px; line-height: 1.6; }
.sk-teletype .feed > .tools, .sk-teletype .feed > .ask, .sk-teletype .feed > .changed, .sk-teletype .feed > .notice, .sk-teletype .feed > .error, .sk-teletype .feed > .msg.thinking { margin-left: calc(var(--gut) + 12px); }
.sk-teletype .msg.user, .sk-teletype .msg.assistant { position: relative; padding-left: calc(var(--gut) + 12px); }
.sk-teletype .msg.user:not(:first-child) { margin-top: 12px; padding-top: 14px; border-top: 1px solid var(--line); }
.sk-teletype .msg.user .m-meta { display: flex; position: absolute; left: 0; top: 3px; font-family: var(--mono); line-height: 1.2; }
.sk-teletype .msg.user:not(:first-child) .m-meta { top: 17px; }
.sk-teletype .who, .sk-teletype .msg.assistant::before { font: 600 10.5px/1.2 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--mute); }
.sk-teletype .msg.user .who { padding: 1px 5px; background: var(--fg); color: var(--bg); }
.sk-teletype .msg.assistant::before { content: "ExecAI"; position: absolute; left: 0; top: 5px; }
.sk-teletype .msg.user .m-body { display: block; font-family: var(--mono); font-size: 13.5px; font-weight: 500; }
/* The marker runs over what the person typed the way a pen would: over the
   first four lines' worth of text, then it thins out and stops — a message of
   three screens is not a yellow field. The box is not cloned per line, so the
   one background is laid along the whole run of text and its length can be
   measured in widths of the column (cqi). Without container units the marker
   simply covers the whole message. */
.sk-teletype .msg.user { container: usermsg / inline-size; }
.sk-teletype .msg.user .m-text { padding: 2px 0; background: linear-gradient(var(--accent-soft), var(--accent-soft)) no-repeat, linear-gradient(90deg, var(--accent-soft), transparent) no-repeat; background-size: min(100%, 400cqi) 100%, 60cqi 100%; background-position: 0 0, 400cqi 0; }
.sk-teletype .msg.user .m-from { display: flex; margin-bottom: 4px; font-weight: 400; }
.sk-teletype .msg.user .gallery { margin-top: 8px; }
.sk-teletype :not(pre) > code { border-radius: 0; border: 1px solid var(--line); background: var(--panel); padding: 0 4px; }
.sk-teletype .fchip { padding: 1px 8px; border: 1px solid var(--line2); font-family: var(--mono); font-size: 12px; font-weight: 400; }
.sk-teletype .gallery img { border-radius: 0; border-color: var(--line2); }
.sk-teletype .msg.assistant ul > li::marker { content: "— "; color: var(--mute); }
.sk-teletype .msg.assistant ul, .sk-teletype .msg.assistant ol { padding-left: 24px; }
.sk-teletype .msg.assistant th { font: 600 11.5px var(--mono); letter-spacing: .04em; text-transform: uppercase; }
.sk-teletype .msg.assistant th, .sk-teletype .msg.assistant td { border-color: var(--line2); }
.sk-teletype .msg.thinking { font-family: var(--mono); font-size: 12px; }
.sk-teletype .thinking-toggle { color: var(--dim); }
.sk-teletype .thinking-toggle::before { content: "//"; margin-right: 6px; color: var(--mute); }
.sk-teletype .thinking-toggle:hover { color: var(--fg); }
.sk-teletype .msg.thinking > .thinking { font-style: normal; }

.sk-teletype .tools { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.sk-teletype .tools .tool + .tool { border-top: 1px solid var(--line); }
.sk-teletype .tool > summary { min-height: 30px; padding: 0 2px; gap: 10px; font-family: var(--mono); font-size: 12.5px; }
.sk-teletype .tool:not(.flat) > summary:hover { background: var(--hover); }
.sk-teletype .t-name { min-width: 46px; padding: 0 4px; text-align: center; font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; line-height: 17px; border: 1px solid var(--line2); }
.sk-teletype .tool.run .t-name { background: var(--accent-bg); color: var(--accent-fg); border-color: var(--accent-bg); }
/* A call the person refused did not run: the name in a dashed frame, the
   command struck out — muted (base), neither done nor failed. */
.sk-teletype .tool.denied > summary .t-name { border-style: dashed; border-color: var(--mute); }
.sk-teletype .tool.denied > summary .t-sum { text-decoration: line-through; }
.sk-teletype .t-sum { font-size: 12.5px; color: var(--fg); }
.sk-teletype .t-time { font-size: 11.5px; }
.sk-teletype .t-out { padding: 8px 12px 9px 58px; border-top: 1px dashed var(--line); font-size: 12px; }
.sk-teletype .tool .spin { border-radius: 0; width: 9px; height: 9px; border: 0; background: var(--accent); animation: ex-blink 1.15s steps(1) infinite; }

.sk-teletype pre.code { border-color: var(--line2); }
.sk-teletype pre.code > code { padding: 9px 12px; font-size: 12.5px; counter-reset: ln; }
/* Lines are numbered in a margin that stays put when a long line is scrolled
   sideways; the numbers are not text (not selected, not copied). A block of
   one line — a command, most often — has nothing to count. */
.sk-teletype pre.code > code > .l { counter-increment: ln; }
.sk-teletype pre.code > code > .l::before { content: counter(ln); display: inline-block; position: sticky; left: 0; min-width: 36px; margin: 0 12px 0 -12px; padding-right: 8px; border-right: 1px solid var(--line); background: var(--code-bg); color: var(--mute); text-align: right; -webkit-user-select: none; user-select: none; }
.sk-teletype pre.code > code > .l:only-child::before { content: none; }
.sk-teletype pre.code[data-lang]::before { height: 28px; padding: 0 10px; border-bottom: 1px solid var(--line2); font: 600 10.5px/28px var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.sk-teletype .copy, .sk-teletype .copy-msg { height: 20px; padding: 0 6px; font: 500 11px var(--mono); background: var(--bg); border: 1px solid var(--line2); }
.sk-teletype .codewrap .copy { top: 4px; right: 4px; }
.sk-teletype .copy:hover, .sk-teletype .copy-msg:hover { background: var(--accent-bg); color: var(--accent-fg); }
/* "Copy the answer" is a note in the margin under the name: where the base
   has it (the top right corner) it lies over the end of the first line. */
.sk-teletype .msg.assistant > .copy-msg { top: 23px; left: 0; right: auto; width: var(--gut); height: auto; padding: 0; border: 0; background: none; font: 500 10px/1.3 var(--mono); color: var(--mute); white-space: normal; text-align: left; text-decoration: underline; text-underline-offset: 2px; }
.sk-teletype .msg.assistant > .copy-msg:hover { background: none; color: var(--fg); }

.sk-teletype .ask { gap: 0; border: 1px solid var(--line2); background: var(--bg); }
.sk-teletype .ask-h { padding: 6px 12px; border-bottom: 1px solid var(--line2); font: 600 11.5px var(--mono); letter-spacing: .05em; text-transform: uppercase; }
.sk-teletype .ask-t { font-weight: 600; }
.sk-teletype .ask.perm { border-width: 2px; box-shadow: 4px 4px 0 var(--accent-bg); margin-right: 4px; }
.sk-teletype .ask.perm .ask-h { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .ask.perm .ask-from { color: var(--accent-fg); font-weight: 500; letter-spacing: 0; text-transform: none; }
.sk-teletype .ask.perm.answered { border-width: 1px; box-shadow: none; }
.sk-teletype .ask.perm.answered .ask-h { background: var(--panel); color: var(--fg); }
.sk-teletype .ask.perm.answered .ask-from { color: var(--dim); }
.sk-teletype .ask-from { letter-spacing: 0; text-transform: none; font-weight: 500; }
.sk-teletype .ask-from:hover { text-decoration: underline; }
.sk-teletype .ask-state { letter-spacing: 0; text-transform: none; font-weight: 500; }
.sk-teletype .ask-cmd { padding: 10px 12px; font-size: 13px; font-weight: 500; border-bottom: 1px solid var(--line); }
.sk-teletype .ask[data-tool="bash"] .ask-cmd::before { content: "$ "; color: var(--mute); }
.sk-teletype .ask-q { padding: 10px 12px 0; }
.sk-teletype .opts { padding: 10px 12px 12px; }
.sk-teletype .ask.perm .opt { min-height: 28px; padding: 2px 10px; border: 1px solid var(--line2); font: 500 12px var(--mono); transition: background-color .1s; }
.sk-teletype .ask.perm .opt b { font-weight: 500; }
.sk-teletype .ask.perm .opt:hover { background: var(--accent-soft); }
.sk-teletype .ask.perm .opt.primary { background: var(--fg); color: var(--bg); }
.sk-teletype .ask.perm .opt.primary:hover { background: var(--dim); }
.sk-teletype .ask.perm .opt.deny { margin-left: auto; color: var(--err); border-color: var(--err); }
.sk-teletype .ask.perm.answered .opt.chosen { background: var(--bg); color: var(--fg); border-color: var(--line2); margin-left: 0; }
/* The key of an answer: a filled square at the head of its button — inverse
   on a plain button, yellow on the first one, red on the refusal. Under the
   answers, what Enter and Esc do. */
.sk-teletype .ask.perm .opt > .key { display: inline-block; order: -1; margin-left: -6px; padding: 0 5px; border: 0; background: var(--fg); color: var(--bg); font-size: 11px; font-weight: 600; line-height: 18px; }
.sk-teletype .ask.perm .opt.primary > .key { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .ask.perm .opt.deny > .key { background: var(--err); color: var(--bg); }
.sk-teletype .ask-hint { display: block; margin-top: -4px; padding: 0 12px 10px; font: 11.5px/1.6 var(--mono); }
/* A hint goes to the next line whole: a key is not parted from what it does. */
.sk-teletype .ask-hint .ah-2, .sk-teletype .ask-hint .ah-3 { display: inline-block; max-width: 100%; white-space: pre-wrap; }
.sk-teletype .ask.q .opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0; padding-right: 13px; padding-bottom: 13px; }
.sk-teletype .ask.q .opt { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 1px solid var(--line2); margin: 0 -1px -1px 0; font-size: 13px; line-height: 1.4; }
.sk-teletype .ask.q .opt:hover { background: var(--panel); }
.sk-teletype .ask.q .opt b { font-weight: 600; }
.sk-teletype .ask.q .opt small { display: block; font-size: 12px; color: var(--mute); }
.sk-teletype .o-mark { width: 15px; height: 15px; border: 1.5px solid var(--line2); }
.sk-teletype .ask.q .opt.chosen, .sk-teletype .ask.q .opt.chosen:hover { background: var(--accent-soft); }
/* Not taken: muted by colour — opacity would take the small print below 4.5:1. */
.sk-teletype .ask.q.answered .opt:not(.chosen) { opacity: 1; color: var(--mute); }
.sk-teletype .ask.q.answered .opt:not(.chosen) .o-mark { border-color: var(--mute); }
.sk-teletype .opt.chosen .o-mark { background: var(--accent-bg); color: var(--accent-fg); }

.sk-teletype .changed { border: 1px solid var(--line2); }
.sk-teletype .ch-h { height: 28px; padding: 0 12px 0 10px; border-bottom: 1px solid var(--line2); background: var(--panel); font: 600 11.5px var(--mono); letter-spacing: .05em; text-transform: uppercase; }
.sk-teletype .ch-h > .ic { width: 13px; height: 13px; }
.sk-teletype .ch-n { font-weight: 500; color: var(--mute); }
.sk-teletype .ch-n::before { content: "("; } .sk-teletype .ch-n::after { content: ")"; }
.sk-teletype .frow { min-height: 26px; padding: 0 12px 0 10px; font-size: 13.5px; }
.sk-teletype .flist li + li { border-top: 1px solid var(--line); }
.sk-teletype .notice, .sk-teletype .error { padding: 7px 0; border-block: 1px dashed var(--line2); font-family: var(--mono); font-size: 12px; line-height: 1.5; }
.sk-teletype .feed > .notice + .notice, .sk-teletype .feed > .error + .notice, .sk-teletype .feed > .notice + .error { border-top: 0; margin-top: -10px; }
.sk-teletype .notice :not(pre) > code { border: 0; background: transparent; padding: 0; font-weight: 600; color: var(--fg); }
.sk-teletype .login-link { padding: 6px 8px; border: 1px solid var(--line2); background: var(--panel); font-size: 12px; color: var(--fg); }
.sk-teletype .login-copy, .sk-teletype .wake button, .sk-teletype #ro button, .sk-teletype .qr-link button { height: 22px; padding: 0 8px; border: 1px solid var(--line2); background: var(--bg); font: 500 11px var(--mono); color: var(--fg); }
.sk-teletype .login-copy:hover, .sk-teletype .wake button:hover, .sk-teletype #ro button:hover, .sk-teletype .qr-link button:hover { background: var(--fg); color: var(--bg); }

/* the bottom panel — a table of subagents */
.sk-teletype .rail { display: block; min-width: 0; border-top: 2px solid var(--line2); background: var(--panel); }
.sk-teletype .files.on { display: none; }
.sk-teletype .ag-h { height: 28px; padding: 0 4px 0 12px; font: 600 11.5px var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.sk-teletype .ag-h > .ic { width: 13px; height: 13px; }
.sk-teletype .ag-counts { font-weight: 500; letter-spacing: 0; text-transform: none; padding-left: 6px; }
.sk-teletype .cnt + .cnt { margin-left: 14px; }
.sk-teletype .ag-h:hover { background: var(--hover); }
.sk-teletype .ag-fold { width: 24px; height: 24px; }
/* The table. Its columns are the tracks of one grid that every row shares
   (subgrid), and each is as wide as what stands in it: the number, the
   state, the step counter, the time and the buttons take what their text
   needs in whatever monospaced font the system has, and the name takes all
   the rest. No width here is counted in characters. A column that does not
   fit is dropped whole (below), by the width of the table, not of the
   window; state and steps may still give way with an ellipsis, the name
   keeps its minimum. Five and a half rows show before the list scrolls: the
   half row says there is more. Where subgrid is not known every row lays the
   same tracks out by itself. */
.sk-teletype .agents { container: agents / inline-size; }
.sk-teletype .ag-list { --ag-cols: max-content 14px minmax(180px, 1fr) minmax(0, max-content) 98px minmax(0, max-content) max-content max-content; max-height: 154px; overflow-y: auto; }
.sk-teletype .ag { display: grid; grid-template-columns: var(--ag-cols); column-gap: 12px; align-items: center; min-height: 27px; padding: 0 8px 0 12px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 12px; }
@supports (grid-template-columns: subgrid) {
  .sk-teletype .ag-list { display: grid; grid-template-columns: var(--ag-cols); column-gap: 12px; align-content: start; }
  .sk-teletype .ag { grid-column: 1 / -1; grid-template-columns: subgrid; }
}
.sk-teletype .ag:hover, .sk-teletype .ag.on { background: var(--hover); }
.sk-teletype .ag-n { display: block; text-align: right; color: var(--mute); font-size: 11px; }
.sk-teletype .ag-ic { width: 14px; }
.sk-teletype .ag .spin { border-radius: 0; width: 7px; height: 12px; border: 0; background: var(--accent); animation: ex-blink 1.15s steps(1) infinite; }
.sk-teletype .ag-name { font-family: var(--font); font-size: 13px; }
.sk-teletype .ag-bar { height: 10px; border-radius: 0; background: repeating-linear-gradient(90deg, var(--line) 0 6px, transparent 6px 8px); }
.sk-teletype .ag-bar i { background: repeating-linear-gradient(90deg, var(--fg) 0 6px, transparent 6px 8px); }
.sk-teletype .ag[data-state="waiting"] .ag-bar i, .sk-teletype .ag[data-warn] .ag-bar i { background: repeating-linear-gradient(90deg, var(--warn) 0 6px, transparent 6px 8px); }
.sk-teletype .ag[data-state="done"] .ag-bar i { background: repeating-linear-gradient(90deg, var(--ok) 0 6px, transparent 6px 8px); }
.sk-teletype .ag[data-state="failed"] .ag-bar i { background: repeating-linear-gradient(90deg, var(--err) 0 6px, transparent 6px 8px); }
.sk-teletype .ag-time { text-align: right; }
.sk-teletype .ag-acts { justify-content: flex-end; }
.sk-teletype .mini { height: 20px; padding: 0 7px; border: 1px solid var(--line2); background: var(--bg); font: 500 11px var(--mono); }
.sk-teletype .mini.hot { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .mini:hover:not(:disabled) { background: var(--fg); color: var(--bg); }
.sk-teletype .mini:active:not(:disabled) { background: var(--accent-bg); color: var(--accent-fg); }
/* Asked already (stopping, +25 sent): a dashed outline, readable still. */
.sk-teletype .mini:disabled { opacity: 1; border-style: dashed; border-color: var(--mute); background: transparent; color: var(--mute); }

/* the input — a prompt line */
.sk-teletype .composer { padding: 10px 14px 8px; border-top: 2px solid var(--line2); background: var(--bg); }
.sk-teletype .box { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 10px; row-gap: 4px; }
.sk-teletype .prompt { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-top: 1px; background: var(--accent-bg); color: var(--accent-fg); font: 700 17px/1 var(--mono); }
.sk-teletype .box:focus-within .prompt { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--focus); }
.sk-teletype textarea { font-family: var(--mono); font-size: 13.5px; line-height: 1.6; min-height: 44px; padding: 0; }
.sk-teletype textarea:focus-visible { outline: 0; }
.sk-teletype #chips { grid-column: 1 / -1; padding-bottom: 4px; }
.sk-teletype .chip { padding: 1px 6px 1px 8px; border: 1px solid var(--line2); font: 12px var(--mono); }
.sk-teletype .chip img { border-radius: 0; }
.sk-teletype .bar { grid-column: 1 / -1; gap: 2px; font-family: var(--mono); }
.sk-teletype .bar .ib { width: 26px; height: 26px; }
.sk-teletype .bar-sep { margin: 0 6px; background: var(--line2); }
.sk-teletype .sel { height: 26px; padding: 0 8px; font-size: 12px; color: var(--mute); }
.sk-teletype .sel > .ic:first-child { display: none; }
.sk-teletype .sel-k { display: inline; }
.sk-teletype .sel-k::after { content: ":"; }
.sk-teletype .sel-v { color: var(--fg); font-weight: 600; }
.sk-teletype .sel:hover { background: var(--accent-soft); color: var(--fg); }
/* Short of room, the source gives way first, then the model; the level of
   reasoning is one short word and keeps it. */
.sk-teletype .s-source { flex-shrink: 4; }
.sk-teletype .s-effort { flex-shrink: 0; }
/* A bar that is off is pale: in the light theme the accent is ink, the
   same as the base's colour for an empty bar, and the level could not be read. */
.sk-teletype .lvl i { border-radius: 0; background: var(--line); }
.sk-teletype .lvl i.on { background: var(--accent); }
.sk-teletype .timer, .sk-teletype .hint { font-size: 11.5px; margin-right: 8px; }
.sk-teletype .timer { font-weight: 600; color: var(--fg); }
.sk-teletype .send, .sk-teletype .stop { height: 28px; padding: 0 12px 0 8px; border: 1px solid var(--line2); font: 700 11.5px var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.sk-teletype .btn-t { display: inline; }
.sk-teletype .send { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .stop { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.sk-teletype .send:hover, .sk-teletype .stop:hover { box-shadow: 3px 3px 0 var(--line2); transform: translate(-1px, -1px); }
.sk-teletype #ro { padding: 2px 0; font: 12px var(--mono); }

/* the status line — inverse */
.sk-teletype .status { container: status / inline-size; height: 26px; gap: 0; padding: 0; background: var(--fg); color: var(--bg); font: 500 11.5px var(--mono); }
/* Every cell may give way with an ellipsis instead of being cut by the edge
   of the window, whatever the font — one at a time: first the tasks from the
   site (the longest), then the host, the sync, the security level. The
   factors are orders apart on purpose: a cell whose turn has not come loses
   less than a layout unit, so its text is not cut. The turn and the version
   keep their width. A cell with an icon never gets narrower than it. */
.sk-teletype .st-item { height: 100%; padding: 0 12px; border-right: 1px solid var(--mute); flex: 0 1 auto; }
.sk-teletype .st-turn, .sk-teletype .st-ver { flex-shrink: 0; }
.sk-teletype .st-sync { flex-shrink: 100000; }
.sk-teletype .st-host { flex-shrink: 10000000000; }
.sk-teletype .st-inbox { flex-shrink: 1000000000000000; }
.sk-teletype button.st-item { min-width: 38px; }
/* On the inverse line a pointer shows as a lighter cell underlined with the
   paper colour, a press turns the cell back to paper, the keyboard focus is
   a ring of the paper colour inside the cell (above, with the focus rules). */
.sk-teletype button.st-item:hover { background: var(--dim); box-shadow: inset 0 -2px 0 var(--bg); }
.sk-teletype button.st-item:active { background: var(--bg); color: var(--fg); box-shadow: none; }
.sk-teletype .st-turn { background: var(--accent-bg); color: var(--accent-fg); border-right: 0; }
.sk-teletype .st-turn .st-idle, .sk-teletype .st-turn .st-run { gap: 8px; }
.sk-teletype .st-turn b { font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.sk-teletype .st-turn .spin { border-radius: 0; width: 7px; height: 12px; border: 0; background: var(--accent-fg); animation: ex-blink 1.15s steps(1) infinite; }
.sk-teletype .st-turn .dot { border-radius: 0; background: var(--accent-fg); }
.sk-teletype .st-host { border-left: 1px solid var(--mute); }
.sk-teletype .st-ver { border-right: 0; }

/* an empty chat: the mark and the machine side by side, like a system report */
.sk-teletype .app.is-empty { grid-template-columns: 276px minmax(0, 1fr) auto; grid-template-areas: "top top top" "side feed rail" "side comp comp" "stat stat stat"; }
.sk-teletype .app.is-empty .feed { padding: 0 0 14px; gap: 8px; }
.sk-teletype .app.is-empty .feed > .notice, .sk-teletype .app.is-empty .feed > .error { margin: 0 28px; }
.sk-teletype .app.is-empty .feed > .notice + .notice, .sk-teletype .app.is-empty .feed > .error + .notice, .sk-teletype .app.is-empty .feed > .notice + .error { margin-top: -8px; }
/* A wide feed with nothing in it (no cards beside it, or a very wide window)
   would leave everything to the right of the greeting dead: there the
   suggestions stand next to the mark instead of under it. Two columns as
   soon as each gets 440px; the lines between them follow the same width. */
.sk-teletype .welcome { container: welcome / inline-size; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); margin-block: 0 auto; }
.sk-teletype .hero { padding: 30px 28px 24px; border-bottom: 1px solid var(--line2); }
.sk-teletype .hero-mark { display: flex; align-items: center; font: 700 46px/1 var(--mono); letter-spacing: -.02em; }
.sk-teletype .hero-mark .cur { width: 24px; height: 46px; margin-left: 8px; }
.sk-teletype .hero h1 { margin-top: 22px; font-size: 20px; font-weight: 600; letter-spacing: -.01em; }
.sk-teletype .hero p { margin-top: 6px; font-size: 14px; line-height: 1.6; color: var(--dim); max-width: 60ch; }
.sk-teletype .sugg { grid-template-columns: minmax(0, 1fr); align-content: start; gap: 0; padding: 4px 28px 14px; }
.sk-teletype .sugg-l { display: flex; align-items: center; gap: 8px; padding: 14px 0 8px; font: 500 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); white-space: nowrap; }
.sk-teletype .sugg-l::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.sk-teletype .sg { grid-template-columns: 26px minmax(0, 1fr); column-gap: 12px; align-items: center; padding: 9px 8px; border-bottom: 1px solid var(--line); }
.sk-teletype .sg:hover { background: var(--accent-soft); }
.sk-teletype .sg-ic { width: 26px; height: 26px; border: 1px solid var(--line2); }
.sk-teletype .sg:hover .sg-ic { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .sg b { font: 600 12.5px var(--mono); }
.sk-teletype .sg-d { font-size: 13px; }
.sk-teletype .app.is-empty .rail { display: flex; min-height: 0; overflow-y: auto; border-top: 0; }
.sk-teletype .rail > .info { flex-direction: row; align-items: stretch; }
.sk-teletype .rail > .info > .card { width: 344px; border-left: 1px solid var(--line2); }
.sk-teletype .info { font-size: 13px; line-height: 1.5; }
.sk-teletype .card-h { height: 30px; padding: 0 4px 0 12px; border-bottom: 1px solid var(--line2); font: 600 11.5px var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.sk-teletype .card-h > .ic { width: 13px; height: 13px; }
.sk-teletype .card-s { font-weight: 500; letter-spacing: 0; text-transform: none; }
.sk-teletype .card-h .ib { width: 24px; height: 24px; }
.sk-teletype .mc { padding: 6px 0; }
.sk-teletype .mc-row { grid-template-columns: 76px minmax(0, 1fr); padding: 3px 12px; font-size: 13px; line-height: 1.5; }
.sk-teletype .mc-row dt { font: 500 11px/1.8 var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.sk-teletype .mc-row dd small { font-size: 12px; }
.sk-teletype .mc-note { padding: 10px 12px; }
.sk-teletype .card-f { padding: 2px 12px 12px; }
.sk-teletype .qr-wrap { padding: 0 12px 12px; }
.sk-teletype .step .qr-wrap { padding: 4px 0 0; }
.sk-teletype .qr { border-radius: 0; border: 1px solid var(--line2); }
.sk-teletype .btn, .sk-teletype .btn2 { height: 26px; padding: 0 10px 0 8px; border: 1px solid var(--line2); font: 600 11.5px var(--mono); }
.sk-teletype .btn2 { background: var(--bg); }
.sk-teletype .btn2:hover { background: var(--fg); color: var(--bg); }
.sk-teletype .btn { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .btn:hover { box-shadow: 3px 3px 0 var(--line2); transform: translate(-1px, -1px); }
.sk-teletype .st-lead { padding: 10px 12px 8px; font-size: 13px; color: var(--dim); }
.sk-teletype .st-prog { padding: 0 12px 8px; gap: 2px; }
.sk-teletype .st-prog i { height: 6px; border-radius: 0; background: var(--fg); }
.sk-teletype .st-prog i.todo { background: var(--line); }
.sk-teletype .steps { padding: 0 0 12px; }
.sk-teletype .step { padding: 5px 12px; font-size: 13px; align-items: flex-start; }
.sk-teletype .mark { width: 16px; height: 16px; margin-top: 2px; border-radius: 0; border: 1.5px solid var(--line2); font: 600 10.5px var(--mono); }
.sk-teletype .step.done .mark { background: var(--fg); border-color: var(--fg); color: var(--bg); }
.sk-teletype .step.done .st-b b { color: var(--dim); }
.sk-teletype .st-v { font: 11.5px var(--mono); }
.sk-teletype .step.next { margin-top: 4px; padding-block: 10px; background: var(--accent-soft); border-block: 1px solid var(--line2); }
.sk-teletype .step.next .mark { background: var(--accent-bg); color: var(--accent-fg); }
.sk-teletype .step.todo .st-b { row-gap: 6px; }
.sk-teletype .feed > .info { margin: 6px 28px 4px; border: 1px solid var(--line2); background: var(--panel); }
.sk-teletype .feed > .info > .card + .card.on { border-top: 1px solid var(--line2); }
.sk-teletype #sheet .info { border: 2px solid var(--line2); background: var(--panel); box-shadow: 6px 6px 0 var(--accent-bg); margin: 0 6px 6px 0; }
.sk-teletype #sheet .info > .card + .card.on { border-top: 1px solid var(--line2); }

/* menus, the look panel, toasts, dialogs */
.sk-teletype #menu, .sk-teletype .pop { padding: 0; background: var(--bg); border: 1px solid var(--line2); box-shadow: 4px 4px 0 var(--line2); font: 12.5px var(--mono); }
.sk-teletype .mi { min-height: 28px; padding: 3px 10px; }
.sk-teletype .mi + .mi { border-top: 1px solid var(--line); }
.sk-teletype .mi:hover:not(.info), .sk-teletype .mi.act:hover, .sk-teletype .mi:focus-visible { background: var(--accent-soft); }
.sk-teletype .mi small { font-size: 11.5px; }
.sk-teletype #menu .sep { background: var(--line2); }
.sk-teletype #menu .head { padding: 5px 10px; border-bottom: 1px solid var(--line2); background: var(--panel); font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--fg); }
.sk-teletype #menu .head span:first-child:not(:last-child) { letter-spacing: 0; text-transform: none; font-weight: 500; }
.sk-teletype .pop { padding: 0 0 10px; }
.sk-teletype .pop-t { padding: 5px 10px; margin-bottom: 8px; border-bottom: 1px solid var(--line2); background: var(--panel); font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.sk-teletype .pop-t:not(:first-child) { border-top: 1px solid var(--line2); margin-top: 10px; }
.sk-teletype .pop-skins, .sk-teletype .seg, .sk-teletype .pop-row { margin: 0 10px; }
.sk-teletype .pk { padding: 6px 8px; border: 1px solid var(--line2); margin-bottom: -1px; }
.sk-teletype .pk:hover { background: var(--panel); }
.sk-teletype .pk[aria-checked="true"] { background: var(--accent-soft); }
.sk-teletype .pk b { font: 600 12.5px var(--mono); }
.sk-teletype .pk small { font: 12px/1.35 var(--font); }
.sk-teletype .seg button { height: 26px; padding: 0 6px; border: 1px solid var(--line2); margin-right: -1px; font: 500 11.5px var(--mono); color: var(--dim); }
.sk-teletype .seg button:hover { background: var(--panel); color: var(--fg); }
.sk-teletype .seg button[aria-checked="true"] { background: var(--fg); color: var(--bg); }
.sk-teletype .pop-row { font: 12px var(--font); }
.sk-teletype .pop-row .btn2 { height: 24px; }
/* Under the top strip: over it they would cover the "+" and the machine. */
.sk-teletype #toasts { top: 52px; }
.sk-teletype .toast { padding: 8px 10px; background: var(--bg); border: 1px solid var(--line2); box-shadow: 4px 4px 0 var(--line2); font-size: 12.5px; }
.sk-teletype .toast.warn { box-shadow: 4px 4px 0 var(--accent-bg); border-width: 2px; }
.sk-teletype .toast > button { height: 22px; padding: 0 9px; border: 1px solid var(--line2); background: var(--accent-bg); color: var(--accent-fg); font: 600 11px var(--mono); }
/* "Connection lost" hangs under the top strip: on it, it covered the chat's name. */
.sk-teletype #conn { top: 50px; padding: 4px 12px; background: var(--accent-bg); color: var(--accent-fg); border: 1px solid var(--line2); font: 600 11.5px var(--mono); }
.sk-teletype .dlg-box { padding: 0 0 12px; gap: 10px; background: var(--bg); color: var(--fg); border: 2px solid var(--line2); box-shadow: 6px 6px 0 var(--accent-bg); font: 13px/1.5 var(--font); }
.sk-teletype .dlg-title { padding: 6px 12px; border-bottom: 1px solid var(--line2); background: var(--accent-bg); color: var(--accent-fg); font: 600 11.5px var(--mono); letter-spacing: .05em; text-transform: uppercase; }
.sk-teletype .dlg-box > :not(.dlg-title) { margin-inline: 12px; }
.sk-teletype .dlg-box > .dlg-input { width: calc(100% - 24px); }
.sk-teletype .dlg-prompt { font-size: 13px; }
.sk-teletype .dlg-input { padding: 6px 8px; border: 1px solid var(--line2); border-radius: 0; font-family: var(--mono); }
.sk-teletype .dlg-input:focus { outline: 2px solid var(--focus); outline-offset: 1px; }
.sk-teletype .dlg-err { font: 12px var(--mono); }
.sk-teletype .dlg-list { gap: 0; }
.sk-teletype .dlg-item { padding: 6px 10px; background: transparent; border: 1px solid var(--line2); border-radius: 0; margin-bottom: -1px; }
.sk-teletype .dlg-item:hover, .sk-teletype .dlg-item:focus-visible { background: var(--accent-soft); }
.sk-teletype .dlg-btns button { height: 26px; padding: 0 12px; cursor: pointer; font: 600 11.5px var(--mono); border: 1px solid var(--line2); border-radius: 0; background: var(--bg); color: var(--fg); }
.sk-teletype .dlg-btns button:hover { background: var(--fg); color: var(--bg); }
.sk-teletype .dlg-btns button.primary { background: var(--accent-bg); color: var(--accent-fg); }

/* monospaced captions are wide: the bar gives way earlier than the base says */
@container bar (max-width: 1010px) { .sk-teletype .hint-2 { display: none; } }
@container bar (max-width: 830px) { .sk-teletype .app .hint { display: none; } }
/* without its caption a selector is known by its icon again */
@container bar (max-width: 680px) { .sk-teletype .app .box .sel-k { display: none; } .sk-teletype .sel > .ic:first-child { display: block; } }

/* the greeting in two columns */
@container welcome (min-width: 880px) {
  .sk-teletype .sugg { padding-top: 12px; border-left: 1px solid var(--line2); border-bottom: 1px solid var(--line2); }
}

/* The table of subagents gives columns up by its own width. With more room
   than the log above it uses, it ends where the log's column ends (1032px
   and the row's own 8px) instead of pulling the name and the buttons apart
   — and grows past that only when a name needs it; then the bar goes (the
   step counter says the same); then the time and the state in words (its
   mark stays), so that the name is read whole; then the steps; the
   narrowest keeps the name and the buttons, as icons. */
@container agents (min-width: 1200px) {
  .sk-teletype .ag-list { width: fit-content; min-width: 1040px; max-width: 100%; }
}
@container agents (max-width: 999px) {
  .sk-teletype .ag-list { --ag-cols: max-content 14px minmax(160px, 1fr) minmax(0, max-content) minmax(0, max-content) max-content max-content; }
  .sk-teletype .ag-bar { display: none; }
}
@container agents (max-width: 759px) {
  .sk-teletype .ag-list { --ag-cols: max-content 14px minmax(120px, 1fr) minmax(0, max-content) max-content; }
  .sk-teletype .ag-time, .sk-teletype .ag-state { display: none; }
}
@container agents (max-width: 559px) {
  .sk-teletype .ag-list { --ag-cols: max-content 14px minmax(0, 1fr) max-content; }
  .sk-teletype .ag-steps { display: none; }
}
@container agents (max-width: 439px) {
  .sk-teletype .mini.m-stop, .sk-teletype .mini.m-open { padding: 0 3px; }
  .sk-teletype .mini.m-stop span, .sk-teletype .mini.m-open span { display: none; }
  .sk-teletype .mini.m-stop .ic, .sk-teletype .mini.m-open .ic { display: block; }
}

/* The status line drops whole cells by its own width, the longest first;
   between these points the cells give way with an ellipsis (above). */
@container status (max-width: 919px) { .sk-teletype .st-inbox { display: none; } }
@container status (max-width: 779px) { .sk-teletype .st-host { display: none; } }

@media (max-width: 1339px) {
  .sk-teletype .rail > .info { flex-direction: column; width: 360px; border-left: 1px solid var(--line2); }
  .sk-teletype .rail > .info > .card { width: auto; border-left: 0; }
  .sk-teletype .rail > .info > .card + .card.on { border-top: 1px solid var(--line2); }
}
@media (max-width: 1099px) {
  .sk-teletype .app, .sk-teletype .app.is-empty { grid-template-columns: 240px minmax(0, 1fr); grid-template-areas: "top top" "side feed" "side rail" "side comp" "stat stat"; }
  .sk-teletype .app.is-empty .rail { display: none; }
}
/* The version is on the status line too: here it gives its room to the chat's name. */
@media (max-width: 899px) {
  .sk-teletype .tm-ver { display: none; }
}
@media (max-width: 719px) {
  .sk-teletype .app { --gut: 0px; }
  .sk-teletype .app, .sk-teletype .app.is-empty { grid-template-columns: minmax(0, 1fr); grid-template-areas: "top" "feed" "rail" "comp" "stat"; }
  .sk-teletype .top { padding: 0 4px 0 4px; gap: 8px; }
  .sk-teletype .top .crumb { margin-left: 0; }
  .sk-teletype .top .brand { font-size: 14px; }
  .sk-teletype .top .cur { height: 15px; width: 7px; }
  .sk-teletype .c-path, .sk-teletype .c-sep, .sk-teletype .top-meta { display: none; }
  .sk-teletype .feed { padding: 12px 12px 14px; }
  .sk-teletype .feed > .tools, .sk-teletype .feed > .ask, .sk-teletype .feed > .changed, .sk-teletype .feed > .notice, .sk-teletype .feed > .error, .sk-teletype .feed > .msg.thinking { margin-left: 0; }
  .sk-teletype .msg.user, .sk-teletype .msg.assistant { padding-left: 0; }
  .sk-teletype .msg.user .m-meta { position: static; margin-bottom: 5px; }
  .sk-teletype .msg.assistant::before { position: static; display: block; margin-bottom: -4px; }
  .sk-teletype .msg.assistant > .copy-msg { top: -1px; left: auto; right: 0; width: auto; white-space: nowrap; }
  .sk-teletype .tool:not(.run) .t-time { display: none; }
  .sk-teletype .t-out { padding-left: 10px; }
  .sk-teletype .ask.perm { box-shadow: 3px 3px 0 var(--accent-bg); margin-right: 3px; }
  .sk-teletype .ask-from { margin-left: 0; }
  .sk-teletype .ask-hint .ah-2, .sk-teletype .ask-hint .ah-3 { display: none; }
  .sk-teletype .ask.q .opts { display: flex; flex-direction: column; flex-wrap: nowrap; gap: 0; }
  .sk-teletype .ag-list { max-height: 34vh; }
  .sk-teletype .composer { padding: 8px 10px 6px; }
  .sk-teletype .sel { padding: 0 5px; }
  .sk-teletype .sel-k, .sk-teletype .bar-sep, .sk-teletype .app .hint, .sk-teletype .btn-t, .sk-teletype .sel .sel-c { display: none; }
  .sk-teletype .send, .sk-teletype .stop { padding: 0 6px; }
  .sk-teletype .sel-v { max-width: 82px; }
  .sk-teletype .st-sec, .sk-teletype .st-inbox, .sk-teletype .st-host, .sk-teletype .st-sync { display: none; }
  .sk-teletype .app.is-empty .feed { padding: 0 0 12px; }
  .sk-teletype .app.is-empty .feed > .notice, .sk-teletype .app.is-empty .feed > .error { margin-inline: 14px; }
  .sk-teletype .feed > .info { margin-inline: 14px; }
  .sk-teletype .hero { padding: 20px 14px 16px; }
  .sk-teletype .hero-mark { font-size: 34px; }
  .sk-teletype .hero-mark .cur { width: 18px; height: 34px; }
  .sk-teletype .sugg { padding: 0 14px 12px; }
  .sk-teletype #sheet { padding: 8px; }
  .sk-teletype #conn { top: 8px; }
}

/* No keyboard, no keys to hint at. */
@media (hover: none) and (pointer: coarse) {
  .sk-teletype .newchat > .key, .sk-teletype .ask.perm .opt > .key, .sk-teletype .ask-hint { display: none; }
}

/* The cursor and the busy marks blink; for those who asked for less motion
   they stand still and stay visible. (The base stops every animation too;
   this is the skin's own word on its own marks.) */
@media (prefers-reduced-motion: reduce) {
  .sk-teletype .cur, .sk-teletype .spin, .sk-teletype .bdg.busy { animation: none; opacity: 1; }
}
`;

export const TELETYPE: Skin = { id: 'teletype', cls: 'sk-teletype', palette, css };
