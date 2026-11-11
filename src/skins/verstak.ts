// Skin 1 · «Верстак» (the workbench): dense and neutral, like an editor.
// Three columns — chats, the conversation, the inspector (subagents and
// changed files); tabs on top, a status line at the bottom; cobalt accent.
//
// Everything here hangs on .sk-verstak (the class on <html>). Structure common
// to all skins is in base.ts; change it there only when all three need it.

import { Palette, Skin } from './tokens';

/** token → [light, dark]. Text on its background keeps 4.5:1 or better (test/window.test.mjs). */
const palette: Palette = {
  'bg': ['#FFFFFF', '#15171C'], 'panel': ['#F4F5F7', '#1A1D23'], 'raised': ['#EBEDF1', '#22262E'],
  'hover': ['#E3E6EC', '#2A2F38'], 'line': ['#DCDFE5', '#2B3039'], 'line2': ['#C3C8D1', '#3D4350'],
  'fg': ['#1A1E26', '#E2E5EA'], 'dim': ['#4A5261', '#AEB5C1'], 'mute': ['#5C6575', '#929BAB'],
  'accent': ['#1D5BD0', '#82AAFF'], 'accent-bg': ['#1D5BD0', '#82AAFF'], 'accent-fg': ['#FFFFFF', '#0C1424'],
  'accent-soft': ['#E3EBFB', '#1E2A44'],
  'ok': ['#17794A', '#5FCB8E'], 'warn': ['#8A5700', '#E4B454'], 'err': ['#BF3328', '#FF8C7D'],
  'warn-soft': ['#FFF7E0', '#2A2313'], 'warn-line': ['#D6A535', '#7A6220'],
  'add-bg': ['#E2F4E8', '#1A2F22'], 'del-bg': ['#FBE7E4', '#3A2022'],
  'code-bg': ['#F6F7F9', '#111317'],
  'focus': ['#1D5BD0', '#82AAFF'], 'shadow': ['rgba(16,24,40,.10)', 'rgba(0,0,0,.45)'],
};

const css = String.raw`
/* ═══════════ 1 · VERSTAK (the workbench) — dense, neutral, three columns ═══════════ */
.sk-verstak {
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
  --col: 800px; --padx: max(28px, calc((100% - var(--col)) / 2 + 28px));
  /* The side columns give way to the feed in a window narrower than 1440:
     264 and 320 as drawn from there up, 232 and 272 at 1100. */
  --side-w: clamp(232px, 19vw, 264px); --rail-w: clamp(272px, 23vw, 320px);
  /* The edge of what is typed into or picked (the input, a radio mark): 3:1
     against the page in both themes, which --line2 is not. */
  --line3: var(--mute);
}
@supports (color: color-mix(in srgb, currentColor, transparent)) {
  .sk-verstak { --line3: color-mix(in srgb, var(--mute) 60%, var(--line2)); }
  /* Selected text has to be seen on white and on a panel alike. */
  .sk-verstak .app ::selection { background: color-mix(in srgb, var(--accent) 30%, var(--bg)); }
}
.sk-verstak .app {
  font-size: 13px;
  grid-template-columns: var(--side-w) minmax(0, 1fr) var(--rail-w);
  grid-template-rows: auto minmax(0, 1fr) auto auto auto;
  grid-template-areas: "side tabs tabs" "side feed rail" "side turn rail" "side comp rail" "stat stat stat";
}
.sk-verstak .app.no-rail { grid-template-columns: var(--side-w) minmax(0, 1fr); grid-template-areas: "side tabs" "side feed" "side turn" "side comp" "stat stat"; }
.sk-verstak .app.no-rail .rail { display: none; }
.sk-verstak .head { display: none; }

/* the sidebar — a tree */
.sk-verstak .side { background: var(--panel); border-right: 1px solid var(--line); }
.sk-verstak .s-brand { height: 38px; padding: 0 6px 0 14px; border-bottom: 1px solid var(--line); }
.sk-verstak .brand { font-size: 14px; letter-spacing: -.01em; }
.sk-verstak .s-ver { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 11px var(--mono); color: var(--mute); padding-top: 2px; }
.sk-verstak .newchat { margin: 10px 10px 4px; height: 30px; padding: 0 6px 0 9px; border: 1px solid var(--line2); border-radius: 6px; background: var(--bg); font-weight: 500; transition: border-color .12s, color .12s; }
.sk-verstak .newchat:hover { border-color: var(--accent); color: var(--accent); }
.sk-verstak .newchat .ic { color: var(--dim); }
.sk-verstak .newchat > .key { display: inline-block; font-size: 10.5px; font-weight: 400; color: var(--mute); border-color: var(--line2); }
.sk-verstak .s-collapse { width: 26px; height: 26px; }
.sk-verstak .s-scroll { padding: 2px 6px 10px; }
.sk-verstak .s-label { padding: 12px 8px 4px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); }
.sk-verstak .proj-h { height: 28px; padding: 0 8px 0 4px; border-radius: 5px; font-weight: 600; }
.sk-verstak .p-ic { color: var(--dim); width: 15px; height: 15px; margin-left: 4px; }
.sk-verstak .p-tag { font-size: 11px; font-weight: 500; color: var(--mute); border-radius: 4px; padding: 0 3px; }
.sk-verstak .p-tag.ok { color: var(--ok); }
.sk-verstak .p-tag:hover { background: var(--hover); color: var(--fg); }
.sk-verstak .p-path { font: 11px/1.4 var(--mono); color: var(--mute); padding: 0 8px 5px 31px; }
.sk-verstak .chat { height: 28px; padding: 0 6px 0 31px; border-radius: 5px; color: var(--dim); }
.sk-verstak .chat:hover { background: var(--hover); color: var(--fg); }
.sk-verstak .chat.active { background: var(--accent-soft); color: var(--fg); font-weight: 500; }
.sk-verstak .chat.active::before { content: ""; position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; border-radius: 1px; background: var(--accent); }
.sk-verstak .c-n { display: none; }
.sk-verstak .hist .chat { padding-left: 8px; }
.sk-verstak .s-empty { padding: 2px 8px 2px 31px; font-size: 12px; }
.sk-verstak .s-foot { border-top: 1px solid var(--line); padding: 6px; }
.sk-verstak .s-link { height: 28px; padding: 0 8px; border-radius: 5px; color: var(--dim); }
.sk-verstak .s-link:hover { background: var(--hover); color: var(--fg); }
.sk-verstak .sl-v { font-size: 11px; color: var(--mute); }
.sk-verstak .acct { margin-top: 6px; padding: 8px 0 2px 8px; border-top: 1px solid var(--line); }
.sk-verstak .ava { width: 24px; height: 24px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 12px; }
.sk-verstak .a-mail { font-size: 12px; font-weight: 500; }
.sk-verstak .a-plan { font-size: 11px; color: var(--mute); }
.sk-verstak .a-login { height: 24px; padding: 0 9px; border-radius: 5px; background: var(--accent-bg); color: var(--accent-fg); font-size: 12px; font-weight: 500; }
.sk-verstak .a-login:hover { filter: brightness(1.1); }

/* tabs — like an editor's */
.sk-verstak .tabs { height: 38px; background: var(--panel); border-bottom: 1px solid var(--line); padding-right: 6px; }
.sk-verstak .tab { padding: 0 6px 0 12px; border-right: 1px solid var(--line); color: var(--dim); font-size: 12.5px; }
.sk-verstak .tab:hover { background: var(--hover); color: var(--fg); }
.sk-verstak .tab.active { background: var(--bg); color: var(--fg); font-weight: 500; box-shadow: inset 0 2px 0 var(--accent); }
.sk-verstak .tab.agent .tab-t { font-style: italic; }
.sk-verstak .tab-x { width: 18px; height: 18px; border-radius: 4px; color: var(--mute); opacity: 0; }
.sk-verstak .tab:hover .tab-x, .sk-verstak .tab.active .tab-x, .sk-verstak .tab:focus-within .tab-x { opacity: 1; }
.sk-verstak .tab-x:hover { background: var(--hover); color: var(--fg); }
.sk-verstak .tabs .ib { align-self: center; width: 26px; height: 26px; }
/* More chats than room: the tabs give way down to a readable minimum, then
   the strip scrolls and fades towards what is out of sight; the plus, the
   history and the menu stand after the strip and never move. The chat on
   screen keeps its whole name, and is brought into view clear of the fade. */
.sk-verstak .tabstrip { scroll-padding-inline: 24px; overscroll-behavior-x: contain; }
.sk-verstak .tab { flex-shrink: 1; min-width: 124px; }
.sk-verstak .tab:has(.bdg.wake) { min-width: 172px; }
.sk-verstak .tab.active { flex-shrink: 0; }
/* In a tab wider than its words the name takes the spare room, so the cross
   stays at the right edge — not in the middle, where a click meant for the
   tab would close it. Until the cross is shown it does not take clicks. */
.sk-verstak .tab-t { flex: 1 1 auto; }
.sk-verstak .tab:not(:hover):not(.active):not(:focus-within) .tab-x { pointer-events: none; }
.sk-verstak .tabs > .newtab { margin: 0 4px; }
.sk-verstak .tabs > .side-show { margin: 0 2px 0 6px; }
.sk-verstak .app.side-off .tabstrip { border-left: 1px solid var(--line); }

/* the feed */
.sk-verstak .feed { background: var(--bg); padding: 22px var(--padx) 20px; gap: 12px; font-size: 13.5px; line-height: 1.6; }
.sk-verstak .msg.user:not(:first-child) { margin-top: 10px; }
.sk-verstak .msg.user .m-body { padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.sk-verstak .fchip { padding: 2px 8px; border: 1px solid var(--line2); border-radius: 5px; background: var(--bg); }
.sk-verstak .msg.thinking { padding: 0 2px; }
.sk-verstak .thinking-toggle { border-radius: 3px; }
.sk-verstak .thinking-toggle:hover { text-decoration: underline; text-underline-offset: 2px; }
.sk-verstak .tools { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.sk-verstak .tools .tool + .tool { border-top: 1px solid var(--line); }
.sk-verstak .tool > summary { min-height: 32px; padding: 0 10px 0 12px; font-size: 12.5px; }
.sk-verstak .tool:not(.flat) > summary:hover { background: var(--panel); }
.sk-verstak .t-name { min-width: 34px; }
.sk-verstak .t-out { padding: 8px 12px; border-top: 1px solid var(--line); }

.sk-verstak pre.code { border-radius: 8px; }
.sk-verstak pre.code > code { padding: 10px 14px 10px 0; font-size: 12.5px; counter-reset: ln; }
/* Line numbers: a gutter that stays in place while a long line scrolls under
   it. The number sits in the line's own padding (pulled there by its margin),
   so the text starts at the content edge and tabs keep their stops. Not part
   of the text: a selection or the copy button takes the code alone. */
.sk-verstak pre.code > code > .l { --gut: 44px; padding-left: var(--gut); counter-increment: ln; }
.sk-verstak pre.code > code > .l::before { content: counter(ln); position: sticky; left: 0; display: inline-block; width: var(--gut); margin-left: calc(-1 * var(--gut)); padding-right: 14px; text-align: right; color: var(--mute); background: var(--code-bg); user-select: none; -webkit-user-select: none; }
.sk-verstak pre.code > code:has(> .l:nth-child(1000)) > .l { --gut: 52px; }
.sk-verstak pre.code[data-lang]::before { height: 30px; line-height: 30px; padding: 0 12px; font: 500 11px/30px var(--mono); }
.sk-verstak .copy, .sk-verstak .copy-msg { height: 22px; padding: 0 7px; border-radius: 4px; font-size: 11.5px; background: var(--panel); border: 1px solid var(--line); }
.sk-verstak .codewrap .copy { top: 4px; right: 5px; }
.sk-verstak .copy:hover, .sk-verstak .copy-msg:hover { background: var(--hover); color: var(--fg); }

.sk-verstak .ask { padding: 10px 12px 12px; border: 1px solid var(--line2); border-radius: 8px; background: var(--bg); }
.sk-verstak .ask.perm { border-color: var(--warn-line); background: var(--warn-soft); }
.sk-verstak .ask.perm.answered { border-color: var(--line2); background: var(--bg); }
.sk-verstak .ask.perm .ask-ic { color: var(--warn); }
.sk-verstak .ask.q .ask-ic { color: var(--accent); }
.sk-verstak .ask-h { font-size: 13px; }
.sk-verstak .ask-from, .sk-verstak .ask-state { font-size: 12px; }
.sk-verstak .ask-from { border-radius: 4px; padding: 0 3px; }
.sk-verstak .ask-from:hover { color: var(--fg); background: var(--hover); }
.sk-verstak .ask-cmd { padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); font-size: 12.5px; }
.sk-verstak .ask.perm .opt { min-height: 30px; padding: 3px 11px; border: 1px solid var(--line2); border-radius: 6px; background: var(--bg); font-size: 12.5px; transition: border-color .12s, background-color .12s; }
.sk-verstak .ask.perm .opt b { font-weight: 500; }
/* The key that gives the answer, before its words (y, a, s, f, n). */
.sk-verstak .ask.perm .opt > .key { display: inline-block; order: -1; margin-left: -5px; min-width: 18px; text-align: center; font-size: 10.5px; color: var(--dim); border-color: var(--line2); }
.sk-verstak .ask.perm .opt.primary > .key { color: inherit; border-color: currentColor; }
.sk-verstak .ask-hint { display: block; font-size: 11.5px; line-height: 1.5; }
.sk-verstak .ask.perm .opt:hover { border-color: var(--accent); }
.sk-verstak .ask.perm .opt.primary { background: var(--accent-bg); border-color: var(--accent-bg); color: var(--accent-fg); }
.sk-verstak .ask.perm .opt.primary:hover { filter: brightness(1.08); }
.sk-verstak .ask.perm .opt.deny { margin-left: auto; color: var(--err); }
.sk-verstak .ask.perm .opt.deny:hover { border-color: var(--err); }
.sk-verstak .ask.perm.answered .opt.chosen { background: var(--bg); border-color: var(--line2); color: var(--fg); margin-left: 0; }
.sk-verstak .ask.q .opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.sk-verstak .ask.q .opt { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line2); border-radius: 6px; font-size: 12.5px; transition: border-color .12s; }
.sk-verstak .ask.q .opt:hover { border-color: var(--accent); }
.sk-verstak .ask.q .opt small { display: block; color: var(--mute); font-size: 12px; line-height: 1.4; }
.sk-verstak .o-mark { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--line3); }
.sk-verstak .ask.q .opt.chosen { border-color: var(--accent); background: var(--accent-soft); }
.sk-verstak .opt.chosen .o-mark { background: var(--accent-bg); border-color: var(--accent-bg); color: var(--accent-fg); }
/* The answers not given: stepped back, but still read at full contrast (not dimmed by opacity). */
.sk-verstak .ask.q.answered .opt:not(.chosen) { opacity: 1; border-color: var(--line); }
.sk-verstak .ask.q.answered .opt:not(.chosen) b { font-weight: 500; color: var(--mute); }
.sk-verstak .ask.q.answered .opt:not(.chosen) .o-mark { border-color: var(--line2); }

.sk-verstak .changed { display: none; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.sk-verstak .changed .ch-h { height: 32px; padding: 0 12px; background: var(--panel); border-bottom: 1px solid var(--line); font-size: 12.5px; }
.sk-verstak .ch-h > .ic { color: var(--dim); }
.sk-verstak .ch-n { font-size: 11px; color: var(--mute); padding: 0 6px; border-radius: 999px; background: var(--raised); }
.sk-verstak .frow { min-height: 28px; padding: 0 12px; font-size: 13px; }
.sk-verstak .frow:hover { background: var(--hover); }
/* The file name stays whole while the row has room for it: only the folder is cut. */
.sk-verstak .f-name { flex-shrink: 0; max-width: 100%; }
.sk-verstak .notice, .sk-verstak .error { padding: 0 2px; }
.sk-verstak .login-link { padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--code-bg); font-size: 12.5px; }
.sk-verstak .login-copy, .sk-verstak .wake button, .sk-verstak #ro button, .sk-verstak .qr-link button { height: 24px; padding: 0 9px; border: 1px solid var(--line2); border-radius: 5px; background: var(--bg); font-size: 12px; color: var(--dim); }
.sk-verstak .login-copy:hover, .sk-verstak .wake button:hover, .sk-verstak #ro button:hover, .sk-verstak .qr-link button:hover { border-color: var(--accent); color: var(--accent); }

/* the inspector on the right: subagents and files */
.sk-verstak .rail { display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow-y: auto; background: var(--panel); border-left: 1px solid var(--line); }
.sk-verstak .ag-h, .sk-verstak .files .ch-h, .sk-verstak .card-h { height: 36px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--line); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); }
.sk-verstak .ag-h > .ic, .sk-verstak .files .ch-h > .ic, .sk-verstak .card-h > .ic { width: 14px; height: 14px; }
.sk-verstak .ag-title, .sk-verstak .files .ch-t, .sk-verstak .card-h h3 { font-weight: 600; color: var(--dim); }
.sk-verstak .ag-counts { text-align: right; font-size: 11.5px; letter-spacing: 0; text-transform: none; }
.sk-verstak .ag-fold { width: 24px; height: 24px; }
/* Five tracks: the buttons of the first line span the last two, the time of
   the second sits in the last one alone — so a wide button ("Continue
   (+25)") does not take room from the steps under it. */
.sk-verstak .ag { display: grid; grid-template-columns: 16px auto minmax(0, 1fr) auto auto; column-gap: 8px; row-gap: 4px; align-items: center; padding: 10px 10px 11px 12px; border-bottom: 1px solid var(--line); }
.sk-verstak .ag:hover, .sk-verstak .ag.on { background: var(--raised); }
.sk-verstak .ag-ic { grid-area: 1 / 1; }
.sk-verstak .ag-name { grid-area: 1 / 2 / 2 / 4; font-size: 12.5px; }
.sk-verstak .ag-acts { grid-area: 1 / 4 / 2 / 6; justify-self: end; }
.sk-verstak .ag-state { grid-area: 2 / 2; font-size: 11.5px; }
.sk-verstak .ag-steps { grid-area: 2 / 3 / 3 / 5; font-size: 11.5px; }
.sk-verstak .ag-time { grid-area: 2 / 5; font-size: 11.5px; text-align: right; }
.sk-verstak .ag-bar { grid-area: 3 / 2 / 4 / 6; }
.sk-verstak .mini { height: 22px; padding: 0 7px; border: 1px solid var(--line2); border-radius: 5px; background: var(--bg); font-size: 11.5px; color: var(--dim); }
.sk-verstak .mini:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.sk-verstak .mini .ic { display: block; }
.sk-verstak .m-stop, .sk-verstak .m-open { width: 24px; padding: 0; }
.sk-verstak .m-stop span, .sk-verstak .m-open span { display: none; }
.sk-verstak .mini.hot { border-color: var(--warn-line); color: var(--warn); background: var(--warn-soft); }
/* Pressed and waiting for the agent: flat and grey, but still readable. */
.sk-verstak .mini:disabled { opacity: 1; border-color: var(--line); color: var(--mute); background: var(--panel); }
.sk-verstak .files.on { flex: 1 0 auto; }
.sk-verstak .files .ch-h { padding-right: 12px; }
.sk-verstak .files .ch-n { letter-spacing: 0; }
.sk-verstak .files .flist { padding: 4px 0; }

/* the turn, the input, the status line */
.sk-verstak .turn { height: 28px; padding: 0 var(--padx); font-size: 12px; color: var(--dim); background: var(--bg); }
.sk-verstak .turn-t { color: var(--fg); }
.sk-verstak .turn-time { font-family: var(--mono); font-size: 11.5px; }
.sk-verstak .turn-step::before, .sk-verstak .turn-wait::before { content: "·"; margin-right: 10px; color: var(--mute); }
.sk-verstak .turn-esc { display: inline; flex: none; font-size: 11.5px; }
.sk-verstak .composer { padding: 4px var(--padx) 12px; background: var(--bg); }
.sk-verstak .box { border: 1px solid var(--line3); border-radius: 8px; background: var(--bg); transition: border-color .12s, box-shadow .12s; }
.sk-verstak .box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.sk-verstak textarea { padding: 9px 12px 2px; font-size: 13.5px; line-height: 1.5; min-height: 52px; }
.sk-verstak textarea:focus-visible { outline: 0; }
.sk-verstak #chips { padding: 8px 10px 0; }
.sk-verstak .chip { padding: 2px 8px; border: 1px solid var(--line2); border-radius: 5px; background: var(--panel); }
.sk-verstak .bar { padding: 3px 6px 6px; }
.sk-verstak .bar .ib { width: 26px; height: 26px; }
.sk-verstak .sel { height: 26px; padding: 0 7px; border-radius: 5px; font-size: 12px; color: var(--dim); }
.sk-verstak .sel:hover { background: var(--hover); color: var(--fg); }
.sk-verstak .sel-v { font-weight: 500; color: var(--fg); }
/* Long names of a model and a source give way first; the reasoning level keeps its word. */
.sk-verstak .s-effort { flex-shrink: 0; }
.sk-verstak .timer { font: 500 11.5px var(--mono); margin-right: 6px; }
.sk-verstak .hint { margin-right: 6px; font-size: 11.5px; }
.sk-verstak .send, .sk-verstak .stop { width: 28px; height: 28px; border-radius: 6px; background: var(--accent-bg); color: var(--accent-fg); }
.sk-verstak .send:hover, .sk-verstak .stop:hover { filter: brightness(1.1); }
.sk-verstak #ro { padding: 8px 2px 4px; font-size: 12.5px; }
.sk-verstak .status { height: 24px; padding: 0 10px; border-top: 1px solid var(--line); background: var(--panel); font-size: 11.5px; color: var(--mute); }
.sk-verstak .st-turn { color: var(--dim); }
.sk-verstak .st-turn b { font-weight: 600; color: var(--fg); }
.sk-verstak button.st-item:hover { color: var(--fg); }

/* an empty chat */
.sk-verstak .app.is-empty .feed { --col: 756px; }
.sk-verstak .welcome { gap: 22px; padding: 8px 0; }
.sk-verstak .hero h1 { font-size: 22px; font-weight: 600; letter-spacing: -.02em; line-height: 1.25; }
.sk-verstak .hero p { margin-top: 8px; font-size: 13.5px; line-height: 1.6; color: var(--dim); max-width: 62ch; }
/* Two suggestions in a row while each has room for its words; one under another in a feed too narrow for that. */
.sk-verstak .sugg { grid-template-columns: repeat(auto-fit, minmax(min(100%, 248px), 1fr)); }
.sk-verstak .sugg-l { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); padding-bottom: 2px; }
.sk-verstak .sg { align-content: start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; transition: border-color .12s, background-color .12s; }
.sk-verstak .sg:hover { border-color: var(--accent); background: var(--accent-soft); }
.sk-verstak .sg-ic { width: 28px; height: 28px; border-radius: 6px; background: var(--raised); color: var(--dim); }
.sk-verstak .sg b { font-size: 13px; }
.sk-verstak .sg-d { font-size: 12.5px; line-height: 1.45; }
.sk-verstak .info { font-size: 12.5px; line-height: 1.5; }
.sk-verstak .card-h h3 { font-size: 11px; }
.sk-verstak .card-s { font-size: 11.5px; letter-spacing: 0; text-transform: none; }
.sk-verstak .card-h .ib { width: 24px; height: 24px; }
.sk-verstak .mc { padding: 4px 0; }
.sk-verstak .mc-row { padding: 5px 12px; font-size: 12.5px; line-height: 1.5; }
.sk-verstak .mc-row dd small { font-size: 11.5px; }
.sk-verstak .mc-note { padding: 10px 12px; }
.sk-verstak .card-f { padding: 4px 12px 14px; }
.sk-verstak .qr-wrap { padding: 0 12px 14px; }
.sk-verstak .step .qr-wrap { padding: 4px 0 0; }
.sk-verstak .btn2 { height: 28px; padding: 0 10px; border: 1px solid var(--line2); border-radius: 6px; background: var(--bg); font-size: 12.5px; font-weight: 500; }
.sk-verstak .btn2:hover { border-color: var(--accent); color: var(--accent); }
.sk-verstak .start.on { border-top: 1px solid var(--line); }
.sk-verstak .st-lead { padding: 10px 12px 8px; font-size: 12.5px; color: var(--dim); }
.sk-verstak .st-prog { padding: 0 12px 6px; }
.sk-verstak .steps { padding: 0 0 12px; }
.sk-verstak .step { padding: 6px 12px; font-size: 12.5px; align-items: flex-start; }
.sk-verstak .mark { width: 18px; height: 18px; margin-top: 1px; }
.sk-verstak .step.done .mark { background: var(--add-bg); }
.sk-verstak .step.done .st-b b { color: var(--dim); }
.sk-verstak .step.todo .mark { border: 1.5px solid var(--accent); color: var(--accent); }
.sk-verstak .step.todo .st-b { row-gap: 5px; }
.sk-verstak .st-why { line-height: 1.5; }
.sk-verstak .btn { height: 28px; padding: 0 11px; border-radius: 6px; background: var(--accent-bg); color: var(--accent-fg); font-size: 12.5px; font-weight: 500; }
.sk-verstak .btn:hover { filter: brightness(1.1); }
/* the cards inside the feed (a window narrower than 1100) and over the window */
.sk-verstak .feed > .info, .sk-verstak #sheet .info { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); overflow: hidden; }
.sk-verstak #sheet .info { overflow-y: auto; border-color: var(--line2); box-shadow: 0 18px 48px var(--shadow); }
.sk-verstak .feed > .info { margin-bottom: 4px; }

/* menus, the look panel, toasts, dialogs */
.sk-verstak #menu, .sk-verstak .pop { padding: 4px; background: var(--bg); border: 1px solid var(--line2); border-radius: 8px; box-shadow: 0 12px 32px var(--shadow), 0 1px 3px var(--shadow); font-size: 12.5px; }
.sk-verstak .mi { padding: 5px 9px; border-radius: 5px; }
.sk-verstak .mi:hover:not(.info), .sk-verstak .mi.act:hover, .sk-verstak .mi:focus-visible { background: var(--hover); }
.sk-verstak .mi small { font-size: 11.5px; }
.sk-verstak #menu .sep { margin: 4px 2px; background: var(--line); }
.sk-verstak #menu .head { padding: 4px 9px 6px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.sk-verstak #menu .head span:first-child:not(:last-child) { letter-spacing: 0; text-transform: none; font-weight: 500; color: var(--accent); }
.sk-verstak .pop { padding: 10px; }
.sk-verstak .pop-t { padding: 2px 2px 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); }
.sk-verstak .pop-t + * { margin-bottom: 10px; }
.sk-verstak .pk { padding: 7px 9px; border-radius: 6px; border: 1px solid transparent; }
.sk-verstak .pk:hover { background: var(--hover); }
.sk-verstak .pk[aria-checked="true"] { border-color: var(--accent); background: var(--accent-soft); }
.sk-verstak .pk small { font-size: 11.5px; line-height: 1.35; }
.sk-verstak .pk-sw { border-radius: 4px; }
.sk-verstak .seg { padding: 3px; gap: 2px; border: 1px solid var(--line); border-radius: 7px; }
.sk-verstak .seg button { height: 26px; padding: 0 6px; border-radius: 5px; color: var(--dim); font-size: 12px; }
.sk-verstak .seg button:hover { color: var(--fg); }
.sk-verstak .seg button[aria-checked="true"] { background: var(--accent-soft); color: var(--fg); font-weight: 500; box-shadow: inset 0 0 0 1px var(--accent); }
.sk-verstak .pop-row { padding: 2px; font-size: 12px; }
.sk-verstak .pop-row .btn2 { height: 24px; font-size: 12px; }
.sk-verstak .toast { padding: 9px 10px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line2); box-shadow: 0 10px 28px var(--shadow); font-size: 12.5px; }
.sk-verstak .toast.warn { border-color: var(--warn-line); background: var(--warn-soft); }
.sk-verstak .toast > button { height: 24px; padding: 0 10px; border-radius: 5px; background: var(--accent-bg); color: var(--accent-fg); font-size: 12px; font-weight: 500; }
/* The cross of a toast is a button of its own size, with a ring that stays inside the toast. */
.sk-verstak .toast > i { top: 5px; right: 5px; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border-radius: 4px; line-height: 1; transition: background-color .12s, color .12s; }
.sk-verstak .toast > i:hover { background: var(--hover); }
.sk-verstak .toast > i:focus-visible { outline-offset: 0; }
.sk-verstak #conn { padding: 4px 12px; border-radius: 6px; background: var(--warn-soft); color: var(--warn); border: 1px solid var(--warn-line); font-size: 12px; font-family: var(--font); }
.sk-verstak .dlg-box { padding: 14px; gap: 8px; border-radius: 10px; background: var(--bg); color: var(--fg); border: 1px solid var(--line2); box-shadow: 0 18px 48px var(--shadow); font: 13px/1.5 var(--font); }
.sk-verstak .dlg-prompt { font-size: 12.5px; }
.sk-verstak .dlg-input { padding: 7px 10px; border: 1px solid var(--line3); border-radius: 6px; }
.sk-verstak .dlg-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.sk-verstak .dlg-input:focus-visible { outline: 0; }
.sk-verstak .dlg-err { font-size: 12px; }
.sk-verstak .dlg-item { padding: 7px 10px; border-radius: 6px; background: transparent; border: 1px solid var(--line); }
.sk-verstak .dlg-item:hover, .sk-verstak .dlg-item:focus-visible { background: var(--hover); border-color: var(--line2); }
.sk-verstak .dlg-btns button { height: 28px; padding: 0 12px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12.5px; border: 1px solid var(--line2); background: var(--bg); color: var(--fg); }
.sk-verstak .dlg-btns button:hover { border-color: var(--accent); }
.sk-verstak .dlg-btns button.primary { background: var(--accent-bg); border-color: var(--accent-bg); color: var(--accent-fg); }

/* the keyboard: what sits flush against a box that clips or scrolls (the tab
   strip, the tool box, the inspector, a list in a dialog, the menu, the
   status line) draws its ring inside itself, where nothing cuts it */
.sk-verstak .tab:focus-visible, .sk-verstak .tool > summary:focus-visible,
.sk-verstak .ag:focus-visible, .sk-verstak .ag-h:focus-visible, .sk-verstak .mi:focus-visible,
.sk-verstak .dlg-item:focus-visible { outline-offset: -2px; }
.sk-verstak .tool > summary:focus-visible { border-radius: 7px; }
.sk-verstak .st-item:focus-visible { outline-offset: 1px; border-radius: 3px; }
/* Tab brings a button into view with room for its ring, not flush against the edge of what scrolls. */
.sk-verstak .feed { scroll-padding-block: 10px; }
.sk-verstak .rail, .sk-verstak .s-scroll, .sk-verstak #sheet .info { scroll-padding-block: 8px; }

/* pressed: a step further than hover, so a click is felt before the agent answers */
.sk-verstak .app .ib:active, .sk-verstak .sel:active, .sk-verstak .chat:active, .sk-verstak .s-link:active,
.sk-verstak .tab:active, .sk-verstak .tab-x:active, .sk-verstak .app .c-x:active, .sk-verstak .p-tag:active,
.sk-verstak .ask-from:active, .sk-verstak .copy:active, .sk-verstak .copy-msg:active, .sk-verstak .pk:active,
.sk-verstak .mi:active:not(.info), .sk-verstak .mi.act:active, .sk-verstak .dlg-item:active, .sk-verstak .toast > i:active { background: var(--hover); box-shadow: inset 0 0 0 1px var(--line2); }
.sk-verstak .tab.active:active { background: var(--bg); box-shadow: inset 0 2px 0 var(--accent); }
.sk-verstak .newchat:active, .sk-verstak .ask.perm .opt:active, .sk-verstak .ask.q .opt:active, .sk-verstak .mini:active:not(:disabled),
.sk-verstak .btn2:active, .sk-verstak .sg:active, .sk-verstak .login-copy:active, .sk-verstak .wake button:active,
.sk-verstak #ro button:active, .sk-verstak .qr-link button:active, .sk-verstak .dlg-btns button:active { border-color: var(--accent); background: var(--accent-soft); }
.sk-verstak .ask.perm .opt.deny:active { border-color: var(--err); background: var(--del-bg); }
.sk-verstak .send:active, .sk-verstak .stop:active, .sk-verstak .btn:active, .sk-verstak .a-login:active, .sk-verstak .toast > button:active,
.sk-verstak .ask.perm .opt.primary:active, .sk-verstak .dlg-btns button.primary:active { border-color: var(--accent-bg); background: var(--accent-bg); filter: brightness(.9); }

/* a medium window: the inspector goes under the feed */
@media (max-width: 1099px) {
  .sk-verstak .app { grid-template-columns: var(--side-w) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;
    grid-template-areas: "side tabs" "side feed" "side rail" "side turn" "side comp" "stat stat"; }
  .sk-verstak .app.no-rail { grid-template-columns: var(--side-w) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto; }
  .sk-verstak .rail { border-left: 0; border-top: 1px solid var(--line); max-height: 172px; }
  .sk-verstak .files.on { display: none; }
  .sk-verstak .changed { display: block; }
  .sk-verstak .ag { grid-template-columns: 16px minmax(0, 1.4fr) auto minmax(0, 1fr) auto auto; row-gap: 0; padding: 5px 10px 5px 12px; }
  .sk-verstak .ag-name { grid-area: 1 / 2; } .sk-verstak .ag-state { grid-area: 1 / 3; } .sk-verstak .ag-steps { grid-area: 1 / 4; }
  .sk-verstak .ag-time { grid-area: 1 / 5; } .sk-verstak .ag-acts { grid-area: 1 / 6; } .sk-verstak .ag-bar { display: none; }
}
/* One line per subagent reads as a table: with subgrid the columns line up
   down the list. 28px: the mark's 16 and the row's own 12 of padding, which a
   subgrid takes out of its first track. */
@supports (grid-template-columns: subgrid) {
@media (max-width: 1099px) and (min-width: 720px) {
  .sk-verstak .ag-list { display: grid; grid-template-columns: 28px minmax(0, 1.4fr) auto minmax(0, 1fr) auto auto; column-gap: 8px; }
  .sk-verstak .ag { grid-column: 1 / -1; grid-template-columns: subgrid; }
}
}
/* a narrow window: the sidebar hides, a strip with its button comes on top */
@media (max-width: 719px) {
  .sk-verstak .app, .sk-verstak .app.no-rail { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;
    grid-template-areas: "top" "feed" "rail" "turn" "comp" "stat"; }
  .sk-verstak .app { --padx: 12px; }
  .sk-verstak .top { height: 42px; padding: 0 6px; background: var(--panel); border-bottom: 1px solid var(--line); }
  .sk-verstak .top .brand, .sk-verstak .top .c-path, .sk-verstak .top .c-sep, .sk-verstak .top-meta { display: none; }
  .sk-verstak .c-chat { font-weight: 600; font-size: 13.5px; }
  .sk-verstak .tabs { display: none; }
  .sk-verstak .feed { padding: 14px 12px; }
  .sk-verstak .rail { max-height: 40vh; }
  .sk-verstak .ag { grid-template-columns: 16px minmax(0, 1fr) auto; row-gap: 2px; }
  .sk-verstak .ag-name { grid-area: 1 / 2; } .sk-verstak .ag-acts { grid-area: 1 / 3; }
  .sk-verstak .ag-state { grid-area: 2 / 2; } .sk-verstak .ag-steps { display: none; } .sk-verstak .ag-time { grid-area: 2 / 3; }
  .sk-verstak .agents.folded .ag-h { border-bottom: 0; }
  .sk-verstak .tool:not(.run) .t-time { display: none; }
  .sk-verstak .ask.q .opts { display: flex; flex-direction: column; flex-wrap: nowrap; }
  .sk-verstak .ask-from { margin-left: 0; flex-basis: 100%; }
  .sk-verstak .ah-2, .sk-verstak .ah-3 { display: none; }
  .sk-verstak .app .turn, .sk-verstak .app .timer, .sk-verstak .sel .sel-c { display: none; }
  .sk-verstak .composer { padding-top: 8px; }
  .sk-verstak .sel-v { max-width: 96px; }
  .sk-verstak .s-source .sel-v, .sk-verstak .s-effort .sel-v, .sk-verstak .bar-sep { display: none; }
  .sk-verstak .app .hint { display: none; }
  .sk-verstak .st-sec, .sk-verstak .st-inbox, .sk-verstak .st-host, .sk-verstak .st-sync { display: none; }
  .sk-verstak .welcome { margin-block: 0 auto; padding: 6px 2px; }
  .sk-verstak .sugg { grid-template-columns: minmax(0, 1fr); }
  .sk-verstak .hero h1 { font-size: 19px; }
}
`;

export const VERSTAK: Skin = { id: 'verstak', cls: 'sk-verstak', palette, css };
