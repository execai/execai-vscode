// The `execai ui` window: structure shared by every skin.
//
// What is here has no character of its own — boxes, flex and grid, overflow,
// states, the reset. Colours, radii, type and the layout of the window (which
// column holds what) belong to the skins: verstak.ts, beseda.ts, teletype.ts.
// A rule goes here only when all three skins need it the same way; a skin
// overrides it under its own class on <html> (.skin-…).
//
// Rules of the house:
//   - colours only as tokens (tokens.ts) — never a literal value, so both
//     themes of every skin stay in step;
//   - nothing may widen the window: every flex or grid child that holds text
//     has min-width: 0, long paths and code wrap or scroll inside their box;
//   - motion carries meaning (a turn is running) and stops under
//     prefers-reduced-motion.

export const BASE_CSS = String.raw`
/* ── page ── */
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: var(--bg); color: var(--fg); font-family: var(--font); -webkit-font-smoothing: antialiased; }
[hidden] { display: none !important; }
.ic { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.app {
  position: relative; height: 100vh; height: 100dvh; min-height: 0; display: grid; overflow: hidden;
  background: var(--bg); color: var(--fg); font-family: var(--font); font-size: 13px; line-height: 1.5;
  font-variant-numeric: tabular-nums; text-align: left;
  --side-shift: 0px; /* the width a collapsed sidebar frees; the page script measures it */
}
/* A reset of zero specificity (:where), so any class below wins over it. */
.app :where(button) { font: inherit; color: inherit; background: none; border: 0; margin: 0; padding: 0; cursor: pointer; text-align: left; }
.app :where(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, dd, dt, pre, blockquote) { margin: 0; padding: 0; font-size: inherit; font-weight: inherit; }
.app :where(ul, ol) { list-style: none; }
.app code, .app pre, .app kbd { font-family: var(--mono); }
.app :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.app ::selection { background: var(--accent-bg); color: var(--accent-fg); }
.app * { scrollbar-width: thin; scrollbar-color: var(--line2) transparent; }
.app :where(button):disabled { opacity: .5; cursor: default; }

.top { grid-area: top; } .side { grid-area: side; } .tabs { grid-area: tabs; } .head { grid-area: head; }
.feed { grid-area: feed; } .rail { grid-area: rail; } .turn { grid-area: turn; } .composer { grid-area: comp; } .status { grid-area: stat; }

.ib { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: none; border-radius: 6px; color: var(--dim); transition: background-color .12s, color .12s; }
.app .ib:hover { background: var(--hover); color: var(--fg); }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--mute); }
.dot.ok { background: var(--ok); } .dot.warn { background: var(--warn); }
.app kbd { font-size: .84em; line-height: 1.5; padding: 0 5px; border-radius: 4px; border: 1px solid var(--line2); color: var(--dim); white-space: nowrap; }
.spin { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--line2); border-top-color: var(--accent); animation: ex-spin .8s linear infinite; flex: none; }
.pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; animation: ex-pulse 1.4s ease-in-out infinite; }
.cur { display: none; }
/* Key hints are in the markup for every skin and hidden here: a skin that
   wants them turns them on (.sk-… .key { display: inline-block } for a key on
   a button, .sk-… .key-line { display: … } for a line of hints). The keys work
   either way. An answered request has no keys left, whatever the skin says. */
.key, .key-line { display: none; }
/* On a button a key takes the button's own colour: readable on any fill. */
.newchat > .key, .opt > .key { color: inherit; border-color: currentColor; }
.ask.answered .key, .ask.answered .key-line { display: none !important; }
@keyframes ex-spin { to { transform: rotate(360deg); } }
@keyframes ex-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes ex-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
@keyframes ex-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .app *, .app *::before, .app *::after { animation: none !important; transition: none !important; }
}

/* ── the top strip (a narrow window; the teletype skin always) ── */
.top { display: none; align-items: center; gap: 8px; min-width: 0; }
.brand { font-weight: 700; white-space: nowrap; }
.crumb { flex: 1; min-width: 0; display: flex; gap: 6px; white-space: nowrap; overflow: hidden; }
.c-path { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.c-chat { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.top-meta { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; flex: none; }
.top-meta:not(.on) { display: none; }

/* ── the sidebar ── */
.side { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.scrim { display: none; position: absolute; inset: 0; z-index: 5; background: rgba(0, 0, 0, .42); }
.s-brand { display: flex; align-items: center; gap: 8px; }
.newchat { display: flex; align-items: center; gap: 8px; }
.newchat span { flex: 1; }
.s-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.proj-h { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; }
.p-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-tag { flex: none; white-space: nowrap; }
.p-tag:empty { display: none; }
.p-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chats { display: flex; flex-direction: column; }
.chat { position: relative; display: flex; align-items: center; gap: 7px; width: 100%; min-width: 0; cursor: pointer; user-select: none; }
.c-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-n { flex: none; white-space: nowrap; }
/* Closing a chat takes it off the list into the history; the cross shows on
   hover and for the keyboard. */
.c-x, .tab-x { display: inline-flex; align-items: center; justify-content: center; flex: none; font-style: normal; cursor: pointer; }
.c-x { width: 18px; height: 18px; border-radius: 4px; color: var(--mute); }
.c-x .ic, .tab-x .ic { width: 12px; height: 12px; }
.chat:not(:hover):not(:focus-within) .c-x { position: absolute; opacity: 0; pointer-events: none; }
/* A click on a tab opens its chat. Its cross closes only on a tab that is under
   the pointer, on screen or focused — where a skin shows the cross; a cross a
   skin keeps hidden until then must not take the click meant for the tab. */
.tab:not(:hover):not(.active):not(:focus-within) .tab-x { pointer-events: none; }
.app .c-x:hover { background: var(--hover); color: var(--fg); }
.s-empty { color: var(--mute); }
.bdg { flex: none; display: inline-flex; align-items: center; gap: 3px; font-size: 11px; line-height: 1; white-space: nowrap; font-style: normal; font-weight: 400; }
.bdg .ic { width: 12px; height: 12px; }
.bdg.busy { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: ex-pulse 1.4s ease-in-out infinite; }
.bdg.unseen { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }
.bdg.q { color: var(--warn); font-weight: 700; font-size: 12px; }
.bdg.sub { color: var(--accent); font-weight: 600; }
.bdg.wake, .bdg.web, .bdg.bot { color: var(--mute); }
.s-link { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.sl-t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sl-v { display: inline-flex; align-items: center; gap: 5px; flex: none; white-space: nowrap; }
.acct { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ava { display: inline-flex; align-items: center; justify-content: center; flex: none; text-transform: uppercase; }
.a-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
.a-mail, .a-plan { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.a-plan:empty { display: none; }
.a-login { flex: none; white-space: nowrap; }
/* Not signed in: no letter to show, the room goes to the words. */
.acct.anon .ava { display: none; }

/* ── tabs and the chat heading ── */
.tabs { display: flex; align-items: stretch; min-width: 0; overflow: hidden; }
.tabstrip { display: flex; align-items: stretch; min-width: 0; flex: 0 1 auto; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.tabstrip::-webkit-scrollbar { display: none; }
.tab { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 0 0 auto; max-width: 250px; cursor: pointer; user-select: none; white-space: nowrap; }
.tab-t { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab.dragging { opacity: .5; }
.tab.dropbefore { box-shadow: inset 2px 0 0 var(--focus); }
.tabs-sp { flex: 1; min-width: 4px; }
/* The strip scrolls when the tabs do not fit; "+" and what follows it stay in
   place. .tabs.more-l / .more-r: there are tabs out of sight on that side —
   by default the strip fades towards them. */
.tabs > .ib, .tabs > .newtab { flex: none; }
.tabs.more-l .tabstrip { -webkit-mask-image: linear-gradient(to right, transparent, black 24px); mask-image: linear-gradient(to right, transparent, black 24px); }
.tabs.more-r .tabstrip { -webkit-mask-image: linear-gradient(to left, transparent, black 24px); mask-image: linear-gradient(to left, transparent, black 24px); }
.tabs.more-l.more-r .tabstrip { -webkit-mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent); mask-image: linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent); }
/* Shown only while the sidebar is collapsed: the way back to it, a new chat. */
.side-show { display: none; }
.head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.h-main { flex: 1; min-width: 0; }
.h-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.h-sub { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; overflow: hidden; }
.h-sub > span { flex: none; }
.h-sub > .h-path { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.h-acts { display: flex; align-items: center; gap: 6px; flex: none; }

/* ── the look, where it is seen: in the header of every skin, a button that
   names the look on screen and, beside it, the switch of the theme. A header
   shows as much of the two as it has room for: both captions of the switch,
   then the caption of the theme that is on, then the icons alone; last of
   all the name on the button goes. ── */
.app > .top, .app > .tabs, .app > .head { container: hdr / inline-size; }
.lookctl { display: inline-flex; align-items: center; gap: 6px; flex: none; min-width: 0; }
.lookbtn { display: inline-flex; align-items: center; gap: 6px; flex: none; min-width: 0; height: 28px; padding: 0 9px; white-space: nowrap; border: 1px solid var(--line2); border-radius: 6px; color: var(--dim); }
.app .lookbtn:hover, .app .lookbtn[aria-expanded="true"] { background: var(--hover); color: var(--fg); }
.lookbtn > .ic { width: 15px; height: 15px; flex: none; }
.lookbtn > .lb-k::after { content: ":"; }
.lookbtn > .lb-v { font-weight: 600; color: var(--fg); }
.lookbtn > .lb-c { width: 11px; height: 11px; color: var(--mute); }
.thseg { flex: none; }
.thseg button { flex: none; }
@container hdr (max-width: 1399px) { .tabs .thseg button[aria-checked="false"] > span { display: none; } }
@container hdr (max-width: 979px) { .tabs .thseg button > span { display: none; } }
@container hdr (max-width: 759px) { .tabs .lookbtn > .lb-v { display: none; } .tabs .lookbtn > .lb-k::after { content: none; } }
@container hdr (max-width: 899px) { .head .thseg button[aria-checked="false"] > span { display: none; } }
@container hdr (max-width: 679px) { .head .thseg button > span, .head .js-hist > span { display: none; } }
@container hdr (max-width: 559px) { .head .lookbtn > .lb-v { display: none; } .head .lookbtn > .lb-k::after { content: none; } }
@container hdr (max-width: 1199px) { .top .thseg button[aria-checked="false"] > span { display: none; } }
@container hdr (max-width: 1039px) { .top .thseg button > span { display: none; } }
@container hdr (max-width: 999px) { .top .lookbtn > .lb-v { display: none; } .top .lookbtn > .lb-k::after { content: none; } }
.hbtn { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }

/* ── the feed ── */
.feed { overflow-x: hidden; overflow-y: auto; min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 12px;
  padding: 20px max(20px, calc((100% - var(--col, 760px)) / 2)); }
.feed > * { flex: none; min-width: 0; max-width: 100%; }
.feed:focus-visible { outline-offset: -2px; }
.msg { min-width: 0; overflow-wrap: anywhere; }
.msg, .tools, .feed > .tool, .ask, .changed, .notice, .error { animation: ex-in 160ms ease-out; }
.m-meta { display: none; }
.who::before { content: attr(data-t); }
.m-body { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.m-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.m-text:empty { display: none; }
.msg.user.auto .m-text { font-style: italic; }
.m-from { display: inline-flex; align-items: center; gap: 5px; font-size: .88em; color: var(--mute); }
.m-from .ic { width: 13px; height: 13px; }
.ctxline { font-size: .86em; color: var(--mute); overflow-wrap: anywhere; }
.gallery { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.gallery img { max-height: 120px; max-width: 100%; border-radius: 6px; border: 1px solid var(--line); }
.fchip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; font-size: .88em; overflow: hidden; }
.fchip span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fchip .ic { width: 14px; height: 14px; color: var(--dim); }

/* An answer: the renderer's own blocks (markdown.ts), spaced by the grid. */
.msg.assistant { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 9px; }
.msg.assistant > * { min-width: 0; }
.app :not(pre) > code { font-size: .9em; padding: 1px 5px; border-radius: 4px; background: var(--raised); overflow-wrap: anywhere; }
.msg.assistant ul, .msg.assistant ol { display: flex; flex-direction: column; gap: 3px; padding-left: 22px; }
.msg.assistant ul { list-style: disc; } .msg.assistant ol { list-style: decimal; }
.msg.assistant li > ul, .msg.assistant li > ol { margin-top: 3px; }
.msg.assistant li::marker { color: var(--mute); }
.msg.assistant h3, .msg.assistant h4, .msg.assistant h5, .msg.assistant h6 { font-weight: 600; margin-top: 4px; }
.msg.assistant h3 { font-size: 1.15em; } .msg.assistant h4 { font-size: 1.06em; }
.msg.assistant blockquote { padding: 2px 0 2px 12px; border-left: 2px solid var(--line2); color: var(--dim); }
.msg.assistant hr { border: 0; border-top: 1px solid var(--line); margin: 4px 0; }
.msg.assistant a { color: var(--accent); text-underline-offset: 2px; }
/* No editor to open a file in: a path in an answer is plain text here. */
.msg.assistant a[data-file] { color: inherit; text-decoration: none; cursor: text; }
.msg.assistant strong { font-weight: 600; }
.tablewrap { overflow-x: auto; }
.msg.assistant table { border-collapse: collapse; font-size: .94em; }
.msg.assistant th, .msg.assistant td { border: 1px solid var(--line); padding: 4px 9px; vertical-align: top; }
.msg.assistant th { background: var(--panel); font-weight: 600; }
/* Code: the block scrolls inside itself; its language sits in a strip above. */
.codewrap { position: relative; min-width: 0; }
pre.code { position: relative; min-width: 0; overflow-x: auto; border: 1px solid var(--line); background: var(--code-bg); font-size: .92em; line-height: 1.6; tab-size: 4; }
pre.code > code { display: block; width: max-content; min-width: 100%; white-space: pre; }
/* Every line of a code block is a span.l (it ends with its own line feed):
   enough for a skin to number the lines with a counter. */
pre.code > code > .l { display: block; }
pre.code[data-lang]::before { content: attr(data-lang); display: block; position: sticky; left: 0; color: var(--mute); background: var(--panel); border-bottom: 1px solid var(--line); }
.copy, .copy-msg { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; position: absolute; z-index: 1; color: var(--dim); }
.codewrap .copy { top: 5px; right: 6px; }
.msg.assistant > .copy-msg { top: -6px; right: 0; opacity: 0; transition: opacity .12s; }
.msg.assistant:hover > .copy-msg, .msg.assistant > .copy-msg:focus-visible { opacity: 1; }
.codewrap > pre.code:not([data-lang]) + .copy { opacity: 0; transition: opacity .12s; }
.codewrap:hover > .copy, .codewrap > .copy:focus-visible { opacity: 1 !important; }

/* Reasoning: one muted line under its toggle; opened, the whole text. */
.msg.thinking { display: flex; align-items: baseline; gap: 8px; min-width: 0; color: var(--mute); font-size: .92em; }
.thinking-toggle { flex: none; color: var(--accent); cursor: pointer; user-select: none; white-space: nowrap; }
.msg.thinking > .thinking { flex: 1; min-width: 0; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg.thinking > .thinking.open { white-space: pre-wrap; overflow-wrap: anywhere; overflow: visible; }
.msg.thinking.live > .thinking-toggle { animation: ex-pulse 1.8s ease-in-out infinite; }

/* Tool calls: a row each; consecutive ones share a box. */
.tools { display: flex; flex-direction: column; min-width: 0; }
.tool { min-width: 0; }
.tool > summary { display: flex; align-items: center; gap: 8px; min-width: 0; cursor: pointer; list-style: none; }
.tool > summary::-webkit-details-marker { display: none; }
.tool.flat > summary { cursor: default; }
.tool.flat .t-chev { visibility: hidden; }
.t-ic { display: none; flex: none; }
.t-name { font-weight: 600; flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-sum { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); font-size: .92em; color: var(--dim); }
.t-time { flex: none; white-space: nowrap; color: var(--mute); font-size: .88em; }
.t-time:empty { display: none; }
.t-st { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 16px; }
.t-st.ok { color: var(--ok); } .t-st.fail { color: var(--err); }
/* A call the person refused (.tool.denied): it did not run — neither the
   green of done nor the red of failed; quiet until a skin gives it a look. */
.t-st.denied { color: var(--mute); }
.tool.denied > summary .t-name, .tool.denied > summary .t-sum { color: var(--mute); }
.t-st .ic { width: 14px; height: 14px; }
.t-chev { width: 13px; height: 13px; color: var(--mute); transition: transform .12s; }
.tool[open] > summary .t-chev { transform: rotate(90deg); }
.t-out { margin: 0; font-family: var(--mono); font-size: .88em; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; color: var(--dim); background: var(--code-bg); max-height: 220px; overflow: auto; }
.t-out:empty { display: none; }

/* A permission request and a question of the agent. */
.ask { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.ask-h { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.ask-ic { display: inline-flex; flex: none; }
.ask-t { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.ask-from, .ask-state { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: .9em; color: var(--dim); min-width: 0; max-width: 100%; }
.ask-from span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ask-state { color: var(--ok); display: none; }
.ask.answered .ask-state { display: inline-flex; }
.ask.answered .ask-from { margin-left: 0; }
.ask-from .ic, .ask-state .ic { width: 13px; height: 13px; flex: none; }
.ask-cmd { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow-y: auto; }
.ask-q { white-space: pre-wrap; overflow-wrap: anywhere; }
.ask-cmd:empty, .ask-q:empty { display: none; }
.opts { display: flex; flex-wrap: wrap; gap: 6px; }
.ask-hint { color: var(--mute); font-size: .86em; }
.ask:focus-visible { outline-offset: 3px; }
.opt { display: inline-flex; align-items: center; gap: 7px; min-width: 0; max-width: 100%; }
.o-txt { display: flex; flex-direction: column; min-width: 0; }
.opt b, .opt small { min-width: 0; overflow-wrap: anywhere; }
.opt small { display: none; color: var(--dim); }
.o-mark { display: inline-flex; align-items: center; justify-content: center; flex: none; }
.o-mark .ic { width: 11px; height: 11px; stroke-width: 2.6; }
.opt:not(.chosen) .o-mark .ic { visibility: hidden; }
.ask.perm .o-mark { display: none; }
.ask.answered .opt { pointer-events: none; }
.ask.perm.answered .opt:not(.chosen) { display: none; }
.ask.perm.answered .opt.chosen .o-mark { display: inline-flex; }
.ask.q.answered .opt:not(.chosen) { background: transparent; border-color: var(--line); box-shadow: none; }
.ask.q.answered .opt:not(.chosen), .ask.q.answered .opt:not(.chosen) :where(b, small) { color: var(--mute); }

/* Changed files: in the feed after a turn, and gathered in the side panel. */
.ch-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ch-t { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-n { flex: none; }
.flist { display: flex; flex-direction: column; }
.frow { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; overflow: hidden; }
/* A long path gives way before the file name does. */
.f-path { flex: 1; min-width: 0; display: flex; white-space: nowrap; overflow: hidden; font-family: var(--mono); font-size: .9em; }
.f-dir { flex: 0 100 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--mute); }
.f-name { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* Notices and errors keep the agent's line breaks (a sync notice names a
   file on one line and where its copy is on the next); a long path with no
   space in it still wraps instead of widening the feed. */
  .notice { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 8px; row-gap: 6px; align-items: start; min-width: 0; color: var(--dim); font-size: .92em; white-space: pre-wrap; overflow-wrap: anywhere; }
  .error { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 8px; row-gap: 6px; align-items: start; min-width: 0; color: var(--err); font-size: .92em; white-space: pre-wrap; overflow-wrap: anywhere; }
.notice::before, .error::before { content: ""; width: 14px; height: 14px; margin-top: .22em; background: currentColor;
  -webkit-mask: var(--i-note) center / contain no-repeat; mask: var(--i-note) center / contain no-repeat; }
.notice::before { color: var(--mute); }
.error::before { -webkit-mask-image: var(--i-alert); mask-image: var(--i-alert); }
.notice.wake::before { -webkit-mask-image: var(--i-alarm); mask-image: var(--i-alarm); }
.notice.agent-head { color: var(--fg); font-weight: 600; }
.notice.agent-head::before { -webkit-mask-image: var(--i-agents); mask-image: var(--i-agents); }
.notice.wake { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.notice.wake::before { flex: none; margin-top: 0; }
.notice.wake > span { flex: 1 1 200px; min-width: 0; }
/* The sign-in line: the words, the link under them, the button under the link. */
.notice > div, .login-link, .login-copy { grid-column: 2; min-width: 0; }
.login-link { display: block; max-width: 100%; user-select: all; word-break: break-all; }
.login-copy { justify-self: start; }
.login-copy, .wake button { flex: none; white-space: nowrap; }
:root {
  --i-note: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='8.5'/%3E%3Cpath d='M12 11v5.2M12 7.6v.3'/%3E%3C/svg%3E");
  --i-alert: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 4.2 3.6 19h16.8z'/%3E%3Cpath d='M12 10v4.2M12 16.6v.3'/%3E%3C/svg%3E");
  --i-alarm: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='13' r='7'/%3E%3Cpath d='M12 9.500V13l2.500 1.500M5.500 4.500l-2 2M18.500 4.500l2 2'/%3E%3C/svg%3E");
  --i-agents: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='2.200'/%3E%3Ccircle cx='18' cy='6' r='2.200'/%3E%3Ccircle cx='12' cy='18' r='2.200'/%3E%3Cpath d='M6 8.200V10a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.200M12 13v2.800'/%3E%3C/svg%3E");
}

/* ── subagents ── */
.agents { min-width: 0; display: none; }
.agents.on { display: block; }
.ag-h { display: flex; align-items: center; gap: 8px; min-width: 0; cursor: pointer; user-select: none; }
.ag-title { font-weight: 600; }
.ag-counts { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cnt + .cnt { margin-left: 10px; }
.cnt.run { color: var(--accent); } .cnt.done { color: var(--ok); } .cnt.fail { color: var(--err); }
.ag-fold .ic { transition: transform .12s; }
.agents.folded .ag-fold .ic { transform: rotate(-90deg); }
.agents.folded .ag-list { display: none; }
.ag { min-width: 0; cursor: pointer; }
.ag-n, .ring { display: none; }
.ag-ic { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 16px; height: 16px; font-weight: 700; }
.ag-ic .ic { width: 14px; height: 14px; }
.ag[data-state="waiting"] .ag-ic { color: var(--warn); }
.ag[data-state="done"] .ag-ic { color: var(--ok); }
.ag[data-state="failed"] .ag-ic { color: var(--err); }
.ag[data-state="cancelled"] .ag-ic, .ag[data-state="queued"] .ag-ic { color: var(--mute); }
.ag-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.ag-state, .ag-steps, .ag-time { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mute); }
.ag[data-state="waiting"] .ag-state { color: var(--warn); }
.ag[data-state="done"] .ag-state { color: var(--ok); }
.ag[data-state="failed"] .ag-state { color: var(--err); }
.ag-steps.warn { color: var(--warn); }
.ag-bar { display: block; height: 3px; border-radius: 2px; overflow: hidden; background: var(--line); }
.ag-bar i { display: block; height: 100%; background: var(--accent); }
.ag[data-state="waiting"] .ag-bar i, .ag[data-warn] .ag-bar i { background: var(--warn); }
.ag[data-state="done"] .ag-bar i { background: var(--ok); }
.ag[data-state="failed"] .ag-bar i { background: var(--err); }
.ag-acts { display: inline-flex; gap: 4px; flex: none; }
.mini { display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
.mini .ic { display: none; width: 12px; height: 12px; }
.ring { transform: rotate(-90deg); fill: none; stroke-width: 3.5; stroke-linecap: round; }
.ring .r-bg { stroke: var(--line); } .ring .r-fg { stroke: var(--accent); }
.ag[data-state="waiting"] .r-fg, .ag[data-warn] .r-fg { stroke: var(--warn); }
.ag[data-state="done"] .r-fg { stroke: var(--ok); }
.ag[data-state="failed"] .r-fg { stroke: var(--err); }
/* The side panel scrolls as a whole: what is in it keeps its own height. */
.rail > *, .info > * { flex: none; }
.files { min-width: 0; display: none; }
.files.on { display: block; }
/* An empty chat has nothing running in it: the side panel shows the machine. */
.app.is-empty .agents.on, .app.is-empty .files.on { display: none; }

/* ── the turn, the input, the status line ── */
.turn { display: none; align-items: center; gap: 10px; min-width: 0; white-space: nowrap; overflow: hidden; }
body.busy .turn { display: flex; }
.turn-t { font-weight: 500; }
.turn-step:empty, .turn-wait:not(.on) { display: none; }
.turn-wait { display: inline-flex; align-items: center; gap: 4px; color: var(--warn); }
.turn-wait .ic { width: 13px; height: 13px; }
.turn-esc { margin-left: auto; color: var(--mute); }
.composer { position: relative; min-width: 0; }
.box { position: relative; display: flex; flex-direction: column; min-width: 0; container: bar / inline-size; }
/* The bar under the input gives way to its own width, not the window's (a
   side panel may take a third of it): first the second hint, then the hint,
   then the captions, then what source and reasoning are set to — the model
   keeps its name the longest. A skin with wider type moves these points. */
@container bar (max-width: 720px) { .hint-2 { display: none; } }
@container bar (max-width: 620px) { .app .hint { display: none; } .app .box .sel-k { display: none; } }
@container bar (max-width: 500px) {
  .s-source .sel-v, .s-effort .sel-v, .sel .sel-c, .bar-sep { display: none; }
  .sel-v { max-width: 110px; }
}
body.dragover .box { outline: 2px dashed var(--focus); outline-offset: 2px; }
.prompt { display: none; }
.app textarea { display: block; width: 100%; resize: none; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; max-height: 40vh; }
.app textarea::placeholder { color: var(--mute); opacity: 1; }
#chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
#chips:empty { display: none; }
.chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-width: 0; font-size: .88em; }
.chip > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip img { height: 40px; max-width: 90px; object-fit: cover; border-radius: 4px; display: block; }
.chip i { font-style: normal; cursor: pointer; color: var(--mute); display: inline-flex; }
.chip i:hover { color: var(--fg); }
.chip .ic { width: 13px; height: 13px; }
.bar { display: flex; align-items: center; gap: 4px; min-width: 0; }
.bar-sep { width: 1px; height: 16px; background: var(--line); margin: 0 4px; flex: none; }
.bar-sp { flex: 1; min-width: 4px; }
.sel { display: inline-flex; align-items: center; gap: 5px; min-width: 0; white-space: nowrap; flex: 0 1 auto; }
.sel.s-source { flex-shrink: 4; }
.sel.s-effort { flex-shrink: 0; }
.sel .ic { width: 14px; height: 14px; }
.sel-k { display: none; }
.sel-v { min-width: 0; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.sel .sel-c { width: 11px; height: 11px; color: var(--mute); }
.lvl { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; flex: none; }
.lvl:empty { display: none; }
.lvl i { width: 3px; border-radius: 1px; background: var(--line2); height: 4px; }
.lvl i:nth-child(2) { height: 6px; } .lvl i:nth-child(3) { height: 8px; } .lvl i:nth-child(4) { height: 10px; } .lvl i:nth-child(n+5) { height: 12px; }
.lvl i.on { background: var(--accent); }
.hint, .timer { flex: none; white-space: nowrap; color: var(--mute); font-size: .88em; }
.hint { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.timer { display: none; }
body.busy .timer { display: inline; }
body.busy .hint { display: none; }
.send, .stop { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: none; position: relative; }
/* Specificity on purpose: a skin sets display on .send / .stop, and the one
   that is not on duty has to stay hidden whatever the skin says. */
.app .bar .stop { display: none; }
body.busy .app .bar .stop { display: inline-flex; }
body.busy .app .bar .send { display: none; }
.btn-t { display: none; }
/* A subagent's transcript is read-only: no input, a way back instead. */
#ro { display: none; align-items: center; gap: 10px; min-width: 0; color: var(--dim); }
#ro span { flex: 1; min-width: 0; }
body.agentview #ro { display: flex; }
body.agentview .box { display: none; }
.status { display: flex; align-items: center; gap: 14px; min-width: 0; white-space: nowrap; overflow: hidden; }
.st-item { display: inline-flex; align-items: center; gap: 5px; flex: none; min-width: 0; overflow: hidden; }
/* The longest one gives way first. */
.st-inbox { flex: 0 1 auto; }
.st-item > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.st-item:not(.on) { display: none; }
.st-item .ic { width: 13px; height: 13px; }
.st-item .spin { width: 10px; height: 10px; }
.st-turn .st-idle { display: inline-flex; align-items: center; gap: 5px; }
.st-turn .st-run { display: none; align-items: center; gap: 5px; }
body.busy .st-turn .st-idle { display: none; }
body.busy .st-turn .st-run { display: inline-flex; }
.st-step:empty { display: none; }
.st-sp { flex: 1; }

/* ── an empty chat ── */
.welcome { min-width: 0; margin-block: auto; display: flex; flex-direction: column; }
.hero h1 { text-wrap: balance; }
.hero-mark { display: none; }
.sugg { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.sugg-l { grid-column: 1 / -1; }
.sg { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 10px; row-gap: 1px; align-items: start; min-width: 0; }
.sg-ic { grid-row: 1 / 3; display: inline-flex; align-items: center; justify-content: center; }
.sg b { font-weight: 600; }
.sg-d { color: var(--dim); }

/* ── the machine and getting started ── */
.info { min-width: 0; display: none; }
.app.is-empty .info, #sheet .info { display: flex; flex-direction: column; }
.card { min-width: 0; display: none; }
.card.on { display: block; }
.card-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.card-h h3 { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-s { display: inline-flex; align-items: center; gap: 5px; flex: none; color: var(--mute); white-space: nowrap; }
.card-x { display: none; }
#sheet .card-x { display: inline-flex; }
.mc { display: flex; flex-direction: column; }
.mc-row { display: grid; grid-template-columns: 70px minmax(0, 1fr); column-gap: 10px; }
.mc-row dt { color: var(--mute); min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.mc-row.warn dt { color: var(--warn); }
.mc-row dd { min-width: 0; overflow-wrap: anywhere; }
.mc-row dd small { display: block; color: var(--mute); font-size: .92em; }
.mc-note { color: var(--dim); }
.src { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.src > span:not(.dot) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.src .dot { transform: translateY(-1px); }
.app .mc-row .src small { display: inline; margin-left: auto; flex: none; white-space: nowrap; }
.src.bad small { color: var(--warn); }
.card-f { display: flex; gap: 8px; flex-wrap: wrap; }
.card-f:empty { display: none; }
.btn, .btn2 { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.st-prog { display: flex; gap: 3px; }
.st-prog i { flex: 1; height: 3px; border-radius: 2px; background: var(--ok); }
.st-prog i.todo { background: var(--line2); }
.steps { display: flex; flex-direction: column; }
.step { display: flex; gap: 10px; min-width: 0; }
.mark { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 600; }
.mark .ic { width: 12px; height: 12px; stroke-width: 2.4; }
.step.done .mark { color: var(--ok); }
.st-b { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 10px; }
.st-b b { font-weight: 500; min-width: 0; }
.step.todo .st-b b { font-weight: 600; }
.st-v { margin-left: auto; color: var(--mute); font-size: .92em; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-why { flex-basis: 100%; color: var(--dim); }
.st-line { flex-basis: 100%; color: var(--mute); font-size: .92em; overflow-wrap: anywhere; }
.qr-wrap { flex-basis: 100%; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
/* A QR code is dark on light whatever the theme: phone cameras expect it. */
.qr { width: 172px; max-width: 100%; padding: 6px; border-radius: 6px; background: #fff; }
.qr svg { display: block; width: 100%; height: auto; }
.qr-link { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: .88em; color: var(--mute); word-break: break-all; }

/* ── what floats over the window: menu, settings, a card, toasts, a dialog ── */
#menu, .pop { display: none; position: fixed; z-index: 40; overflow-y: auto; min-width: 232px; max-width: min(400px, calc(100vw - 16px)); max-height: min(440px, calc(100vh - 16px)); }
#menu.open, .pop.open { display: block; }
.mi { display: flex; gap: 8px; align-items: center; min-width: 0; cursor: pointer; }
.mi .grow { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.mi small { flex: 0 1 auto; min-width: 0; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mute); }
.mi .check { width: 14px; flex: none; text-align: center; color: var(--accent); }
.mi.info { cursor: default; white-space: normal; color: var(--dim); }
.mi.info.act { cursor: pointer; color: inherit; }
#menu .sep { height: 1px; }
#menu .head { display: flex; gap: 8px; align-items: center; min-width: 0; color: var(--mute); }
#menu .head span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#menu .head span:first-child:not(:last-child) { cursor: pointer; flex: none; }
.pop { width: min(360px, calc(100vw - 16px)); }
.pop-t { font-weight: 600; }
.pop-skins { display: flex; flex-direction: column; }
.pk { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 10px; align-items: center; width: 100%; min-width: 0; text-align: left; }
/* A look in small: a window drawn with that look's own colours (the element
   wears the look's class, see PREVIEW in tokens.ts) — its sidebar, its top
   strip, two lines of text, its button. */
.pk-pv { grid-row: 1 / 3; position: relative; display: block; flex: none; width: 76px; height: 50px; overflow: hidden; border: 1px solid var(--line2); border-radius: 5px; background: var(--bg); }
.pk-pv > i { position: absolute; display: block; }
.pk-pv > .pv-side { inset: 0 auto 0 0; width: 27%; background: var(--panel); border-right: 1px solid var(--line); }
.pk-pv > .pv-top { left: 27%; right: 0; top: 0; height: 20%; background: var(--panel); border-bottom: 1px solid var(--line); }
.pk-pv > .pv-l1 { left: 36%; top: 38%; width: 46%; height: 8%; border-radius: 2px; background: var(--fg); }
.pk-pv > .pv-l2 { left: 36%; top: 56%; width: 30%; height: 8%; border-radius: 2px; background: var(--mute); }
.pk-pv > .pv-btn { right: 8%; bottom: 10%; width: 20%; height: 16%; border-radius: 3px; background: var(--accent-bg); }
.pk-pv.sk-beseda { border-radius: 9px; }
.pk-pv.sk-beseda > .pv-side { inset: 10% auto 10% 5%; width: 24%; border: 0; border-radius: 5px; }
.pk-pv.sk-beseda > .pv-top { display: none; }
.pk-pv.sk-beseda > .pv-l1 { left: 54%; top: 16%; width: 38%; height: 20%; border-radius: 6px; background: var(--accent-soft); }
.pk-pv.sk-beseda > .pv-l2 { left: 36%; top: 50%; width: 42%; background: var(--dim); }
.pk-pv.sk-beseda > .pv-btn { width: 13%; height: 20%; border-radius: 999px; }
.pk-pv.sk-teletype { border-radius: 0; }
.pk-pv.sk-teletype::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 12%; background: var(--fg); }
.pk-pv.sk-teletype > .pv-top { left: 0; height: 18%; background: var(--bg); border-bottom: 2px solid var(--line2); }
.pk-pv.sk-teletype > .pv-side { top: 18%; bottom: 12%; }
.pk-pv.sk-teletype > .pv-l1 { top: 30%; width: 34%; height: 13%; border-radius: 0; background: var(--accent-bg); }
.pk-pv.sk-teletype > .pv-l2 { top: 51%; width: 46%; height: 6%; border-radius: 0; background: var(--fg); }
.pk-pv.sk-teletype > .pv-btn { bottom: 20%; border-radius: 0; }
.pk b { font-weight: 600; }
.pk small { grid-column: 2; color: var(--mute); }
.pk .ic { grid-column: 3; grid-row: 1 / 3; width: 14px; height: 14px; color: var(--accent); visibility: hidden; }
.pk[aria-checked="true"] .ic { visibility: visible; }
.seg { display: flex; min-width: 0; }
.seg button { flex: 1 1 auto; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; overflow: hidden; }
.seg .ic { width: 14px; height: 14px; }
.pop-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pop-row > span { flex: 1; min-width: 0; color: var(--dim); }
/* The same picker outside the panel. On the first empty screen (.in-feed) the
   three tiles stand in a row, the theme and "keep this one" under them. At
   the top of the drawer of a narrow window (.in-side) the tiles are small: the
   picture and the name. */
.lookbox { min-width: 0; }
.lookbox .seg { margin-top: 8px; }
.lookbox.in-feed .pop-skins, .lookbox.in-side .pop-skins { flex-direction: row; gap: 8px; }
.lookbox.in-feed .pk, .lookbox.in-side .pk { flex: 1 1 0; align-content: start; }
.lookbox.in-feed .pk-pv { grid-row: 1; width: 64px; height: 44px; }
.lookbox.in-feed .pk .ic { grid-row: 1; }
.lookbox.in-feed .pk small { grid-column: 1 / -1; margin-top: 6px; }
.lookbox.in-feed .seg { max-width: 400px; }
.lookbox.in-side .pk { position: relative; grid-template-columns: minmax(0, 1fr); padding: 6px; }
.lookbox.in-side .pk-pv { grid-row: 1; width: 100%; height: auto; aspect-ratio: 3 / 2; margin-bottom: 6px; }
.lookbox.in-side .pk b { grid-column: 1; grid-row: 2; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: .94em; }
.lookbox.in-side .pk .ic { position: absolute; top: 3px; right: 3px; padding: 2px; border-radius: 50%; background: var(--accent-bg); color: var(--accent-fg); }
.lookbox.in-side .pk small { display: none; }
.lookbox.in-side .seg .ic { display: none; }
.side-look { display: none; min-width: 0; }
.side-look > .lookbox { padding: 0 10px 8px; }
.lookintro { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; min-width: 0; }
.lookintro[hidden] { display: none; }
.lookintro > * { grid-column: 1 / -1; min-width: 0; }
.lookintro > .lookbox { grid-row: 3; }
.lookintro > .li-done { grid-row: 3; grid-column: 2; align-self: end; justify-self: end; }
.li-d { color: var(--dim); }
#sheet { display: none; position: fixed; inset: 0; z-index: 35; padding: 12px; justify-content: flex-end; align-items: flex-start; background: rgba(0, 0, 0, .42); }
#sheet.open { display: flex; }
#sheet .info { width: min(420px, 100%); max-height: 100%; overflow-y: auto; }
#toasts { position: fixed; top: 12px; right: 12px; z-index: 60; display: flex; flex-direction: column; gap: 8px; width: min(380px, calc(100vw - 24px)); pointer-events: none; }
#toasts:empty { display: none; }
.toast { pointer-events: auto; position: relative; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-width: 0; animation: ex-in 160ms ease-out; }
.toast > span { flex: 1 1 100%; min-width: 0; padding-right: 22px; overflow-wrap: anywhere; }
.toast > button { flex: none; white-space: nowrap; }
.toast > i { position: absolute; top: 6px; right: 8px; font-style: normal; cursor: pointer; color: var(--mute); line-height: 1.3; padding: 0 3px; }
.toast > i:hover { color: var(--fg); }
#conn { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); z-index: 55; max-width: calc(100vw - 24px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#conn:empty { display: none; }
#dlg { display: none; position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, .42); align-items: flex-start; justify-content: center; padding: 12vh 16px 0; }
#dlg.open { display: flex; }
.dlg-box { width: 100%; max-width: 480px; max-height: 76vh; display: flex; flex-direction: column; min-width: 0; }
.dlg-title { font-weight: 600; overflow-wrap: anywhere; }
.dlg-prompt { color: var(--dim); overflow-wrap: anywhere; }
.dlg-input { width: 100%; font: inherit; outline: none; color: var(--fg); background: var(--bg); }
.dlg-err { color: var(--err); min-height: 1.4em; }
.dlg-list { display: flex; flex-direction: column; gap: 4px; min-height: 0; overflow-y: auto; }
.dlg-item { text-align: left; cursor: pointer; font: inherit; color: inherit; min-width: 0; overflow-wrap: anywhere; }
.dlg-item small { margin-left: 6px; color: var(--mute); }
.dlg-detail { color: var(--mute); font-size: .9em; }
.dlg-btns { display: flex; gap: 8px; justify-content: flex-end; flex: none; }
`;

/**
 * Goes after the skins: in a narrow window the sidebar is a drawer and the top
 * strip is on, whatever a skin says about them for a wide one.
 */
export const BASE_LAST_CSS = String.raw`
/* ── the sidebar collapsed (.app.side-off) ──
   Whatever columns a skin lays the window out in, the sidebar is its first
   one: the window is moved left by the sidebar's width (measured by the page
   script, --side-shift) and widened by as much, so the rest takes the room.
   What spans the full width starts where the window does. A skin that wants
   its own collapsed layout overrides these under .sk-… .app.side-off. */
@media (min-width: 720px) {
  .app.side-off { margin-left: calc(-1 * var(--side-shift, 0px)); width: calc(100% + var(--side-shift, 0px)); }
  .app.side-off > .side { visibility: hidden; }
  .app.side-off > .top, .app.side-off > .status { margin-left: var(--side-shift, 0px); }
  .app.side-off .side-show { display: inline-flex; }
  /* the strip on top (a skin that has it in a wide window): its button folds and unfolds the sidebar */
  .app .top .navbtn { display: inline-flex; }
}
/* ── a narrow window: the sidebar comes out on the button ── */
@media (max-width: 719px) {
  .app .side { display: none; }
  .app .top { display: flex; }
  .app .navbtn { display: inline-flex; }
  .app.side-open .side { display: flex; position: absolute; z-index: 6; inset: 0 auto 0 0; width: min(304px, 86%); box-shadow: 0 0 44px rgba(0, 0, 0, .38); }
  .app.side-open .scrim { display: block; }
  #sheet { padding: 0; }
  #sheet .info { width: 100%; }
  #toasts { top: 8px; right: 8px; width: calc(100vw - 16px); }
  .notice.wake > span { flex-basis: 100%; }
  /* the look: one button in the header; the whole choice at the top of the drawer */
  .app .top .thseg, .app .top .lookbtn > .lb-v, .app .top .lookbtn > .lb-c { display: none; }
  .app .top .lookbtn > .lb-k::after { content: none; }
  .app .side-look { display: block; }
  .lookbox.in-feed .pop-skins { flex-direction: column; }
  .lookintro > .li-done { grid-row: 4; grid-column: 1 / -1; justify-self: start; }
}
`;
