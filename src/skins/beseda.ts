// Skin 2 · «Беседа» (the conversation): soft and roomy, the chat in the
// middle. "Islands" on a tinted background, bubbles for your messages, large
// text, round buttons; violet accent. No tab strip and no status line: chats
// are switched in the sidebar, the state of the machine lives in its card.
//
// Everything here hangs on .sk-beseda (the class on <html>). Structure common
// to all skins is in base.ts; change it there only when all three need it.

import { Palette, Skin } from './tokens';

/** token → [light, dark]. Text on its background keeps 4.5:1 or better (test/window.test.mjs). */
const palette: Palette = {
  'bg': ['#F3F1F8', '#141219'], 'panel': ['#FFFFFF', '#1C1925'], 'raised': ['#EFECF6', '#262233'],
  'hover': ['#E7E2F2', '#2F2A40'], 'line': ['#E3DFEC', '#2E2A3E'], 'line2': ['#CBC5DA', '#453F5C'],
  'fg': ['#1D192B', '#ECE8F6'], 'dim': ['#4E4763', '#B9B2CC'], 'mute': ['#625B78', '#9A92B2'],
  'accent': ['#6A3BDB', '#B7A0FF'], 'accent-bg': ['#6A3BDB', '#B7A0FF'], 'accent-fg': ['#FFFFFF', '#1A1133'],
  'accent-soft': ['#EDE6FC', '#2C2350'],
  'ok': ['#17704B', '#63CF9B'], 'warn': ['#885605', '#E7B75A'], 'err': ['#BE2F3A', '#FF8E96'],
  'warn-soft': ['#FFF5DE', '#2C2415'], 'warn-line': ['#E2B552', '#7B6325'],
  'add-bg': ['#E1F4EA', '#183024'], 'del-bg': ['#FBE6E8', '#3B2028'],
  'code-bg': ['#F8F6FC', '#110F17'],
  'focus': ['#6A3BDB', '#B7A0FF'], 'shadow': ['rgba(58,40,120,.12)', 'rgba(0,0,0,.5)'],
};

const css = String.raw`
/* ═══════════ 2 · BESEDA (the conversation) — soft, roomy, islands on a tinted background ═══════════ */
/* House rules of this file, on top of those of base.ts:
   - every at-rule starts at the first column (test/window.test.mjs reads rules by their first character);
   - a theme is told apart only here, at the top: the rest of the file draws with tokens and with the
     skin's own variables (--isl, --ovl, --edge…), so the two themes cannot drift apart;
   - the fonts are the system's — softness is carried by shape, spacing and size. */
.sk-beseda {
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace;
  --col: 780px; --padx: max(24px, calc((100% - var(--col)) / 2 + 24px));
  /* the side columns give way to the chat before the chat gets narrow */
  --side: clamp(248px, 21vw, 280px); --rail: clamp(304px, 24vw, 336px);
  /* an island (--isl) and what floats over the window (--ovl): the shadow and the rim */
  --isl: 0 1px 2px var(--shadow), 0 14px 34px -18px var(--shadow);
  --ovl: 0 2px 4px var(--shadow), 0 20px 44px -12px var(--shadow);
  --isl-edge: var(--line); --ovl-edge: var(--line);
  /* a line that carries meaning (an empty radio mark, the border of a field, a scrollbar): 3:1 on a panel */
  --edge: var(--mute);
  /* the rim of an island in the dark theme: between the two line tokens */
  --rim: var(--line2);
  --i-copy: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='8.500' y='8.500' width='11' height='11' rx='2.500'/%3E%3Cpath d='M15.500 5.500V5A1.500 1.500 0 0 0 14 3.500H6A2.500 2.500 0 0 0 3.500 6v8A1.500 1.500 0 0 0 5 15.500h.500'/%3E%3C/svg%3E");
}
@supports (color: color-mix(in srgb, currentColor, transparent)) {
  .sk-beseda { --edge: color-mix(in srgb, var(--mute) 75%, var(--panel)); --rim: color-mix(in srgb, var(--line2) 50%, var(--line)); }
}
/* Dark: a shadow does not show on a dark background. An island is told by a lighter rim and a lit
   upper edge; what floats keeps a shadow too — it lies on content, not on the background. */
@media (prefers-color-scheme: dark) {
  .sk-beseda:not([data-theme="light"]) { --isl: inset 0 1px 0 var(--line2); --isl-edge: var(--rim); --ovl: inset 0 1px 0 var(--edge), 0 24px 56px -8px var(--shadow), 0 4px 12px var(--shadow); --ovl-edge: var(--line2); }
}
.sk-beseda[data-theme="dark"] { --isl: inset 0 1px 0 var(--line2); --isl-edge: var(--rim); --ovl: inset 0 1px 0 var(--edge), 0 24px 56px -8px var(--shadow), 0 4px 12px var(--shadow); --ovl-edge: var(--line2); }

.sk-beseda .app {
  font-size: 14px; line-height: 1.5; padding: 12px; column-gap: 12px;
  grid-template-columns: var(--side) minmax(0, 1fr) var(--rail);
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  grid-template-areas: "side head rail" "side feed rail" "side turn rail" "side comp rail";
}
.sk-beseda .app.no-rail { grid-template-columns: var(--side) minmax(0, 1fr); grid-template-areas: "side head" "side feed" "side turn" "side comp"; }
.sk-beseda .app.no-rail .rail { display: none; }
.sk-beseda .top, .sk-beseda .tabs, .sk-beseda .status { display: none; }
.sk-beseda .ib { width: 34px; height: 34px; border-radius: 50%; }
.sk-beseda .app * { scrollbar-color: var(--edge) transparent; }
/* Keys. On a button a key is a soft cap in the button's own colour (base.ts), its rim a part of
   that colour — the letter keeps the contrast of the label next to it. A window without a
   keyboard under it (the narrow one) shows none: see the end of the file. */
.sk-beseda .app kbd { padding: 0 6px; border-radius: 6px; }
.sk-beseda .key { display: inline-block; flex: none; min-width: 20px; padding: 0 5px; text-align: center; font-size: 11px; font-weight: 600; line-height: 16px; }
.sk-beseda .newchat > .key, .sk-beseda .opt > .key { border-color: color-mix(in srgb, currentColor 45%, transparent); }

/* the left island */
.sk-beseda .side { background: var(--panel); border: 1px solid var(--isl-edge); border-radius: 22px; box-shadow: var(--isl); padding: 14px 10px 10px; }
.sk-beseda .s-brand { padding: 0 2px 12px 10px; }
.sk-beseda .s-collapse { width: 30px; height: 30px; color: var(--mute); }
.sk-beseda .brand { font-size: 20px; font-weight: 700; letter-spacing: -.03em; display: inline-flex; align-items: baseline; gap: 3px; }
.sk-beseda .cur { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-bg); }
.sk-beseda .s-ver { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--mute); }
.sk-beseda .newchat { height: 42px; padding: 0 14px; border-radius: 14px; background: var(--accent-bg); color: var(--accent-fg); font-weight: 600; font-size: 14.5px; transition: filter .12s, transform .08s; }
.sk-beseda .newchat:hover { filter: brightness(1.08); }
.sk-beseda .newchat:active { transform: scale(.985); }
.sk-beseda .s-scroll { margin-top: 8px; padding: 0 0 8px; overscroll-behavior: contain; scroll-padding-block: 8px; }
.sk-beseda .s-label { padding: 14px 10px 6px; font-size: 12px; font-weight: 600; color: var(--mute); }
.sk-beseda .proj-h { height: 34px; padding: 0 8px 0 10px; border-radius: 12px; font-weight: 600; font-size: 14.5px; }
.sk-beseda .p-ic { color: var(--accent); }
.sk-beseda .p-tag { font-size: 11.5px; font-weight: 500; padding: 2px 8px; border-radius: 999px; background: var(--raised); color: var(--dim); }
.sk-beseda .p-tag.ok { background: var(--add-bg); color: var(--ok); }
.sk-beseda .p-tag:hover { filter: brightness(.96); }
.sk-beseda .p-path { display: none; }
.sk-beseda .proj .chats { margin: 2px 0 4px 17px; padding-left: 6px; border-left: 1.5px solid var(--line); gap: 1px; }
.sk-beseda .chat { height: 34px; padding: 0 7px 0 9px; border-radius: 12px; font-size: 13.5px; color: var(--dim); transition: background-color .12s; }
.sk-beseda .chat:hover { background: var(--raised); color: var(--fg); }
.sk-beseda .chat.active { background: var(--accent-soft); color: var(--fg); font-weight: 600; }
/* The list scrolls and clips at its edges: the ring of a row is drawn inside the row. */
.sk-beseda .chat:focus-visible { outline-offset: -2px; }
.sk-beseda .c-n { display: none; }
.sk-beseda .c-x { border-radius: 50%; }
.sk-beseda .bdg.q { width: 18px; height: 18px; border-radius: 50%; justify-content: center; background: var(--warn-soft); }
.sk-beseda .s-empty { padding: 4px 9px; font-size: 12.5px; }
.sk-beseda .s-foot { padding-top: 8px; border-top: 1px solid var(--line); }
.sk-beseda .s-link { min-height: 34px; padding: 2px 10px; border-radius: 12px; color: var(--dim); }
.sk-beseda .s-link:hover { background: var(--raised); color: var(--fg); }
/* The name of a link is a word that does not change and stays whole; what stands after it takes
   two lines when one is not enough ("this computer only" in a narrow sidebar) — nothing is cut.
   It is set as a line of text, the dot a part of it: wrapped, it stays flush right, dot and all. */
.sk-beseda .sl-t { flex: none; }
.sk-beseda .sl-v { display: block; flex: 1 1 0; min-width: 0; white-space: normal; overflow-wrap: anywhere; text-align: right; line-height: 1.2; font-size: 12px; color: var(--mute); }
.sk-beseda .sl-v > .dot, .sk-beseda .card-s > .dot { margin-right: 5px; vertical-align: middle; transform: translateY(-1px); }
.sk-beseda .acct { margin-top: 6px; padding: 8px 4px 8px 10px; border-radius: 14px; background: var(--raised); }
.sk-beseda .ava { width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 13px; }
.sk-beseda .a-mail { font-size: 13px; font-weight: 600; }
.sk-beseda .a-plan { font-size: 12px; color: var(--mute); }
/* not signed in: the words share the row with the button — they wrap rather than lose their end */
.sk-beseda .acct.anon .a-mail { white-space: normal; font-size: 12.5px; line-height: 1.25; }
.sk-beseda .a-login { height: 30px; padding: 0 13px; border-radius: 999px; background: var(--accent-bg); color: var(--accent-fg); font-size: 13px; font-weight: 600; }
.sk-beseda .a-login:hover { filter: brightness(1.08); }

/* the chat heading */
.sk-beseda .head { position: relative; z-index: 1; height: 52px; padding: 0 var(--padx) 4px; }
/* What scrolls under the heading fades into it instead of being cut by a line. */
.sk-beseda .head::after, .sk-beseda .top::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 12px; background: linear-gradient(var(--bg), transparent); pointer-events: none; }
.sk-beseda .h-title { font-size: 18px; font-weight: 650; letter-spacing: -.02em; line-height: 1.3; }
.sk-beseda .h-sub { font-size: 12.5px; color: var(--mute); }
.sk-beseda .h-sub .ic { width: 13px; height: 13px; }
.sk-beseda .h-path { font-family: var(--mono); font-size: 11.5px; }
.sk-beseda .h-path::before { content: "·"; margin-right: 6px; }
.sk-beseda .hbtn { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--isl-edge); background: var(--panel); font-size: 13px; font-weight: 500; color: var(--dim); transition: border-color .12s, color .12s; }
.sk-beseda .hbtn:hover { border-color: var(--edge); color: var(--fg); }

/* the feed — bubbles */
.sk-beseda .feed { padding: 14px var(--padx) 22px; gap: 16px; font-size: 15.5px; line-height: 1.65; scroll-padding-block: 16px; }
.sk-beseda .feed > .tools, .sk-beseda .feed > .ask, .sk-beseda .feed > .changed, .sk-beseda .feed > .notice, .sk-beseda .feed > .error, .sk-beseda .feed > .msg.thinking { margin-left: 44px; }
.sk-beseda .msg.user { align-self: flex-end; max-width: 84%; }
.sk-beseda .msg.user:not(:first-child) { margin-top: 10px; }
.sk-beseda .msg.user .m-body { padding: 11px 17px; border-radius: 22px 22px 6px 22px; background: var(--accent-soft); }
.sk-beseda .msg.user :not(pre) > code { background: var(--panel); }
.sk-beseda .gallery { gap: 6px; align-items: center; padding-top: 2px; }
.sk-beseda .gallery img { height: 72px; min-width: 48px; max-width: 168px; max-height: none; object-fit: cover; border-radius: 12px; border-color: var(--line2); }
.sk-beseda .fchip { padding: 4px 11px; border-radius: 999px; background: var(--panel); font-size: 13px; }
.sk-beseda .msg.assistant { padding: 3px 0 0 44px; min-height: 32px; row-gap: 12px; }
.sk-beseda .msg.assistant::before { content: "E"; position: absolute; left: 0; top: 0; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: var(--accent-bg); color: var(--accent-fg); font-weight: 700; font-size: 15px; line-height: 1; }
.sk-beseda :not(pre) > code { border-radius: 6px; padding: 2px 6px; }
.sk-beseda .msg.assistant ul, .sk-beseda .msg.assistant ol { gap: 5px; padding-left: 22px; }
.sk-beseda .msg.assistant li::marker { color: var(--accent); }
.sk-beseda .msg.thinking { font-size: 13.5px; align-items: center; }
.sk-beseda .msg.thinking:has(> .thinking.open) { align-items: flex-start; }
.sk-beseda .thinking-toggle { padding: 4px 11px; border-radius: 999px; background: var(--panel); border: 1px solid var(--isl-edge); font-weight: 500; transition: border-color .12s; }
.sk-beseda .thinking-toggle:hover { border-color: var(--accent); }

.sk-beseda .tools { border: 1px solid var(--isl-edge); border-radius: 18px; background: var(--panel); overflow: hidden; }
.sk-beseda .tools .tool + .tool { border-top: 1px solid var(--line); }
.sk-beseda .tool > summary { min-height: 44px; padding: 0 14px 0 9px; gap: 10px; font-size: 14px; }
/* The box clips at its round corners: the first and the last row take the same corners, and the
   ring of a row is drawn inside it — so the ring is whole. */
.sk-beseda .tools > .tool:first-child > summary { border-top-left-radius: 17px; border-top-right-radius: 17px; }
.sk-beseda .tools > .tool:last-child:not([open]) > summary { border-bottom-left-radius: 17px; border-bottom-right-radius: 17px; }
.sk-beseda .tool > summary:focus-visible, .sk-beseda .t-out:focus-visible { outline-offset: -3px; }
.sk-beseda .tools > .tool:last-child > .t-out { border-bottom-left-radius: 17px; border-bottom-right-radius: 17px; }
.sk-beseda .tool:not(.flat) > summary:hover { background: var(--raised); }
.sk-beseda .t-ic { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 9px; background: var(--raised); color: var(--dim); }
.sk-beseda .tool:not(.flat) > summary:hover .t-ic { background: var(--panel); }
.sk-beseda .t-sum { font-size: 13px; }
/* A call the person refused did not run: its command is struck out, in the quiet colour base.ts gives it. */
.sk-beseda .tool.denied .t-ic { color: var(--mute); }
.sk-beseda .tool.denied > summary .t-sum { text-decoration: line-through; text-decoration-color: var(--edge); }
.sk-beseda .t-time { font-size: 12.5px; }
.sk-beseda .t-out { padding: 10px 16px 12px 47px; border-top: 1px solid var(--line); font-size: 12.5px; overscroll-behavior: contain; }

.sk-beseda pre.code { border-radius: 16px; }
.sk-beseda pre.code > code { padding: 13px 18px 14px; font-size: 13.5px; line-height: 1.65; }
.sk-beseda pre.code[data-lang]::before { height: 40px; padding: 0 16px; font: 600 12px/40px var(--font); }
.sk-beseda .copy, .sk-beseda .copy-msg { height: 28px; padding: 0 11px; border-radius: 999px; background: var(--raised); font-size: 12.5px; font-weight: 500; transition: background-color .12s, color .12s; }
.sk-beseda .codewrap .copy { top: 6px; right: 8px; }
.sk-beseda .copy:hover, .sk-beseda .copy-msg:hover { background: var(--hover); color: var(--fg); }
/* "Copy the answer" has a line of its own under the answer, so it never lies on the text. Every
   finished answer of a turn has one: it shows under the mouse and for the keyboard, stays in sight
   under the last answer of the chat, and always where there is no mouse to hover with. */
.sk-beseda .msg.assistant > .copy-msg { position: static; justify-self: start; height: 24px; margin: -8px 0 -12px -9px; padding: 0 10px 0 9px; gap: 6px; background: transparent; color: var(--mute); }
.sk-beseda .feed > .msg.assistant:nth-last-child(1 of .msg.assistant) > .copy-msg { opacity: 1; }
.sk-beseda .msg.assistant > .copy-msg::before { content: ""; width: 14px; height: 14px; flex: none; background: currentColor; -webkit-mask: var(--i-copy) center / contain no-repeat; mask: var(--i-copy) center / contain no-repeat; }
.sk-beseda .msg.assistant > .copy-msg:hover { background: var(--hover); color: var(--fg); }
.sk-beseda .msg.assistant th { background: var(--raised); }

.sk-beseda .ask { container: ask / inline-size; padding: 14px 16px 16px; gap: 12px; border-radius: 20px; background: var(--panel); border: 1px solid var(--isl-edge); box-shadow: var(--isl); }
.sk-beseda .ask.perm { border: 1.5px solid var(--warn-line); }
.sk-beseda .ask.perm.answered { border: 1px solid var(--isl-edge); box-shadow: none; }
.sk-beseda .ask-ic { width: 30px; height: 30px; border-radius: 50%; align-items: center; justify-content: center; }
.sk-beseda .ask.perm .ask-ic { background: var(--warn-soft); color: var(--warn); }
.sk-beseda .ask.q .ask-ic { background: var(--accent-soft); color: var(--accent); }
.sk-beseda .ask-t { font-size: 15.5px; font-weight: 650; line-height: 1.35; }
.sk-beseda .ask-from, .sk-beseda .ask-state { font-size: 12.5px; }
.sk-beseda .ask-from { padding: 4px 10px; border-radius: 999px; background: var(--raised); transition: background-color .12s, color .12s; }
.sk-beseda .ask-from:hover { background: var(--hover); color: var(--fg); }
.sk-beseda .ask-q { font-size: 15.5px; }
.sk-beseda .ask-cmd { padding: 10px 14px; border-radius: 12px; background: var(--raised); font-size: 13.5px; }
/* The answers are laid out by order, not as the agent lists them ("deny" comes last there and
   stands second here): reading-flow makes Tab follow what the eye sees. */
.sk-beseda .ask.perm .opts { gap: 8px; align-items: center; reading-flow: flex-visual; }
/* Two answers first, then "do not ask again" as a line of its own over its three answers: with a
   key on every answer the label and the three never fit one line, and a label sharing a line with
   the first of them while the rest wrap under it reads as a mistake. */
.sk-beseda .ask.perm:not(.answered) .opts::after { content: attr(data-again); order: 3; flex-basis: 100%; margin: 2px 0 -2px; font-size: 13px; line-height: 1.4; color: var(--mute); }
/* 18px is a full pill for one line and still a calm shape when a long answer wraps to two */
.sk-beseda .ask.perm .opt { min-height: 36px; padding: 4px 14px; border-radius: 18px; border: 1.5px solid var(--edge); font-size: 13.5px; line-height: 1.3; transition: border-color .12s, background-color .12s; }
.sk-beseda .ask.perm .opt b { font-weight: 600; }
.sk-beseda .ask.perm .opt:hover { border-color: var(--accent); background: var(--accent-soft); }
.sk-beseda .ask.perm .opt:not(.primary):not(.deny) { order: 4; min-height: 32px; padding: 3px 13px; border-color: transparent; background: var(--raised); font-size: 13px; }
.sk-beseda .ask.perm .opt:not(.primary):not(.deny):hover { background: var(--accent-soft); border-color: var(--accent); }
.sk-beseda .ask.perm .opt.primary { order: 1; padding: 4px 24px; background: var(--accent-bg); border-color: var(--accent-bg); color: var(--accent-fg); }
.sk-beseda .ask.perm .opt.primary:hover { filter: brightness(1.08); }
.sk-beseda .ask.perm .opt:active, .sk-beseda .btn:active, .sk-beseda .a-login:active, .sk-beseda .toast > button:active, .sk-beseda .dlg-btns button:active { transform: scale(.98); }
.sk-beseda .ask.perm .opt.deny { order: 2; padding: 4px 18px; color: var(--err); }
.sk-beseda .ask.perm .opt.deny:hover { background: var(--del-bg); border-color: var(--err); }
.sk-beseda .ask.perm.answered .opt.chosen { background: var(--raised); border-color: transparent; color: var(--fg); padding: 4px 14px; }
.sk-beseda .ask.q .opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.sk-beseda .ask.q .opt { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 16px; border: 1.5px solid var(--line2); font-size: 14.5px; line-height: 1.35; transition: border-color .12s, background-color .12s; }
.sk-beseda .ask.q .opt:hover { border-color: var(--accent); }
.sk-beseda .ask.q .opt b { font-weight: 600; }
.sk-beseda .ask.q .opt small { display: block; margin-top: 2px; font-size: 12.5px; color: var(--mute); }
.sk-beseda .o-mark { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--edge); }
.sk-beseda .ask.q .opt.chosen { border-color: var(--accent); background: var(--accent-soft); }
.sk-beseda .opt.chosen .o-mark { background: var(--accent-bg); border-color: var(--accent-bg); color: var(--accent-fg); }
.sk-beseda .ask-hint { display: block; margin-top: -2px; font-size: 12.5px; line-height: 1.5; }
/* An answered question: what was not chosen steps back by colour (base.ts); its empty mark as well. */
.sk-beseda .ask.q.answered .opt:not(.chosen) .o-mark { border-color: var(--line2); }
/* A narrow card: the heading wraps inside its line and who asks goes under it — not the mark
   alone on a line with the heading under it. */
@container ask (max-width: 620px) {
  .sk-beseda .ask-t { flex: 1 1 calc(100% - 46px); }
  .sk-beseda .ask-from { margin-left: 0; }
}
/* the line of keys keeps to one line: the chord from the input is the part that can go */
@container ask (max-width: 540px) {
  .sk-beseda .ask-hint .ah-3 { display: none; }
}

.sk-beseda .changed { display: none; border: 1px solid var(--isl-edge); border-radius: 18px; background: var(--panel); padding: 6px; }
.sk-beseda .ch-h { padding: 8px 10px 6px 12px; font-size: 14.5px; }
.sk-beseda .ch-h > .ic { color: var(--accent); }
.sk-beseda .ch-t { font-weight: 650; }
.sk-beseda .ch-n { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; background: var(--raised); color: var(--dim); }
.sk-beseda .frow { min-height: 36px; padding: 0 10px 0 12px; border-radius: 12px; font-size: 14px; }
.sk-beseda .frow:hover { background: var(--raised); }
/* The name of a file is whole while its folder still has a letter to give: a name that shrinks
   by a part of a pixel loses its ending to an ellipsis. */
.sk-beseda .f-name { flex: none; max-width: 100%; }
.sk-beseda .flist { overscroll-behavior: contain; }
/* a long list in the feed scrolls inside itself, and is never taller than the feed can show whole */
.sk-beseda .changed .flist { max-height: min(264px, 24vh); overflow-y: auto; }

/* Service lines are a quiet line each, not a plaque: a run of them reads as a few lines of small
   print. An error keeps its block — it is the one that must be seen. */
.sk-beseda .notice, .sk-beseda .error { font-size: 13px; line-height: 1.5; }
.sk-beseda .notice { color: var(--mute); }
.sk-beseda .notice.agent-head { font-size: 14px; }
.sk-beseda .error { padding: 9px 14px; border-radius: 14px; background: var(--del-bg); }
.sk-beseda .feed > .notice + .notice { margin-top: -10px; }
.sk-beseda .feed > .error + .notice, .sk-beseda .feed > .notice + .error, .sk-beseda .feed > .error + .error { margin-top: -6px; }
.sk-beseda .app.is-empty .feed > .notice { align-self: center; margin-left: 0; }
/* after an answer comes its "copy" line, quiet as well: a service line keeps its distance from it */
.sk-beseda .feed > .msg.assistant + .notice { margin-top: 6px; }
.sk-beseda .notice :not(pre) > code { background: var(--panel); }
.sk-beseda .login-link { padding: 8px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--isl-edge); font-size: 13px; }
.sk-beseda .login-copy, .sk-beseda .wake button, .sk-beseda #ro button, .sk-beseda .qr-link button { height: 28px; padding: 0 12px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line2); font-size: 12.5px; font-weight: 600; color: var(--dim); transition: border-color .12s, color .12s; }
.sk-beseda .login-copy:hover, .sk-beseda .wake button:hover, .sk-beseda #ro button:hover, .sk-beseda .qr-link button:hover { color: var(--accent); border-color: var(--accent); }

/* the islands on the right: subagents and files */
.sk-beseda .rail { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; overflow-y: auto; margin: -12px -12px -12px 0; padding: 12px 12px 12px 0; scroll-padding-block: 16px; }
.sk-beseda .agents, .sk-beseda .files, .sk-beseda .card { background: var(--panel); border: 1px solid var(--isl-edge); border-radius: 22px; box-shadow: var(--isl); padding: 6px; }
.sk-beseda .agents { container: agents / inline-size; }
.sk-beseda .ag-h { padding: 9px 4px 5px 12px; border-radius: 16px; }
.sk-beseda .ag-h > .ic { color: var(--accent); }
.sk-beseda .ag-title { font-size: 15px; font-weight: 650; }
/* three counts do not fit one line beside the title: they wrap between counts, never inside one */
.sk-beseda .ag-counts { text-align: right; font-size: 12px; font-weight: 500; white-space: normal; line-height: 1.35; }
.sk-beseda .cnt { display: inline-block; white-space: nowrap; }
.sk-beseda .ag-fold { width: 28px; height: 28px; }
.sk-beseda .ag-list { overscroll-behavior: contain; scroll-padding-block: 4px; }
.sk-beseda .ag { display: grid; grid-template-columns: 38px auto minmax(0, 1fr) auto; column-gap: 10px; row-gap: 1px; align-items: center; padding: 9px 10px; border-radius: 16px; transition: background-color .12s; }
.sk-beseda .ag:hover, .sk-beseda .ag.on { background: var(--raised); }
.sk-beseda .ag:focus-visible { outline-offset: -2px; }
.sk-beseda .ring { display: block; width: 38px; height: 38px; grid-area: 1 / 1 / 3 / 2; align-self: start; }
.sk-beseda .ag-ic { grid-area: 1 / 1 / 3 / 2; align-self: start; width: 38px; height: 38px; font-size: 14px; }
.sk-beseda .ag[data-state="running"] .ag-ic { display: none; }
.sk-beseda .ag-name { grid-area: 1 / 2 / 2 / 5; font-size: 13.5px; font-weight: 600; }
.sk-beseda .ag-time { grid-area: 3 / 4; align-self: center; margin-top: 6px; font-size: 12px; text-align: right; }
.sk-beseda .ag-state { grid-area: 2 / 2; font-size: 12.5px; }
.sk-beseda .ag-steps { grid-area: 2 / 3 / 3 / 5; font-size: 12.5px; }
.sk-beseda .ag-steps:not(:empty)::before { content: "· "; }
.sk-beseda .ag-bar { display: none; }
.sk-beseda .ag-acts { grid-area: 3 / 2 / 4 / 4; margin-top: 6px; gap: 6px; flex-wrap: wrap; min-width: 0; }
.sk-beseda .ag-acts:empty, .sk-beseda .ag-acts:empty + .ag-time { margin-top: 0; }
.sk-beseda .mini { height: 28px; padding: 0 12px; border-radius: 999px; background: var(--raised); font-size: 12.5px; font-weight: 600; color: var(--dim); transition: background-color .12s, color .12s; }
.sk-beseda .ag:hover .mini:not(.hot), .sk-beseda .ag.on .mini:not(.hot) { background: var(--panel); }
.sk-beseda .mini:hover:not(:disabled) { color: var(--accent); }
.sk-beseda .mini.hot { background: var(--warn-soft); color: var(--warn); }
.sk-beseda .mini.hot:hover:not(:disabled) { color: var(--warn); filter: brightness(.96); }

/* the turn and the input */
.sk-beseda .turn { justify-self: center; height: 32px; margin: 2px 0 8px; padding: 0 14px 0 12px; border-radius: 999px; background: var(--panel); border: 1px solid var(--isl-edge); box-shadow: var(--isl); font-size: 13px; color: var(--dim); max-width: calc(100% - 24px); }
.sk-beseda .turn > * { flex: none; }
/* the step is the first to give way when the line does not fit */
.sk-beseda .turn > .turn-step { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sk-beseda .turn-t { color: var(--fg); font-weight: 600; }
.sk-beseda .turn-esc { display: inline; margin-left: 0; }
.sk-beseda .turn-step::before, .sk-beseda .turn-wait::before, .sk-beseda .turn-esc::before { content: "·"; margin-right: 10px; color: var(--mute); }
.sk-beseda .composer { padding: 0 var(--padx) 2px; }
.sk-beseda .box { padding: 6px; border-radius: 26px; background: var(--panel); border: 1px solid var(--isl-edge); box-shadow: var(--isl); transition: border-color .12s, box-shadow .12s; }
.sk-beseda .box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft), var(--isl); }
.sk-beseda textarea { padding: 11px 14px 4px; font-size: 15.5px; line-height: 1.5; min-height: 58px; }
.sk-beseda textarea:focus-visible { outline: 0; }
.sk-beseda #chips { padding: 8px 10px 0; }
.sk-beseda .chip { padding: 4px 8px 4px 11px; border-radius: 999px; background: var(--raised); font-size: 13px; }
.sk-beseda .chip:has(img) { padding: 4px 8px 4px 4px; border-radius: 14px; }
.sk-beseda .chip img { border-radius: 10px; }
.sk-beseda .chip i { width: 20px; height: 20px; align-items: center; justify-content: center; border-radius: 50%; }
.sk-beseda .chip i:hover { background: var(--hover); }
.sk-beseda .bar { gap: 6px; }
.sk-beseda .bar-sep { display: none; }
.sk-beseda .bar .ib { width: 36px; height: 36px; }
.sk-beseda .sel { height: 34px; padding: 0 12px 0 10px; border-radius: 999px; background: var(--raised); font-size: 13px; color: var(--dim); transition: background-color .12s, color .12s; }
.sk-beseda .sel:hover { background: var(--hover); color: var(--fg); }
.sk-beseda .sel-v { font-weight: 600; color: var(--fg); }
/* When the names are long, the source gives way twice as fast as the model; the level of
   reasoning is one short word and keeps it. */
.sk-beseda .s-model { flex-shrink: 1; }
.sk-beseda .s-source { flex-shrink: 2; }
.sk-beseda .s-effort { flex: none; }
.sk-beseda .timer { font-size: 13px; font-weight: 500; margin-right: 4px; }
.sk-beseda .hint { font-size: 12.5px; margin-right: 4px; }
.sk-beseda .hint-2 { display: none; }
.sk-beseda .send, .sk-beseda .stop { width: 40px; height: 40px; border-radius: 50%; background: var(--accent-bg); color: var(--accent-fg); transition: filter .12s, transform .08s; }
.sk-beseda .send .ic, .sk-beseda .stop .ic { width: 20px; height: 20px; }
.sk-beseda .send:hover, .sk-beseda .stop:hover { filter: brightness(1.08); }
.sk-beseda .send:active, .sk-beseda .stop:active { transform: scale(.94); }
.sk-beseda .stop::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--accent); animation: ex-spin .9s linear infinite; pointer-events: none; }
.sk-beseda #ro { padding: 10px 16px; border-radius: 22px; background: var(--panel); border: 1px solid var(--isl-edge); box-shadow: var(--isl); font-size: 13.5px; }
/* The bar under the input, by its own width: this skin's type and round buttons are wider than
   the base ones, so its points are further out. A value is taken away whole — never cut to "hi…". */
@container bar (max-width: 700px) {
  .sk-beseda .app .hint { display: none; }
}
@container bar (max-width: 560px) {
  .sk-beseda .s-source .sel-v, .sk-beseda .s-effort .sel-v, .sk-beseda .sel .sel-c { display: none; }
  .sk-beseda .s-source { flex: none; }
}
/* the clock of the turn is in the turn line as well: under a narrow input the room goes to the model's name */
@container bar (max-width: 480px) {
  .sk-beseda .app .timer { display: none; }
}
@container bar (max-width: 420px) {
  .sk-beseda .bar { gap: 4px; }
  .sk-beseda .sel { padding: 0 9px; }
  .sk-beseda .bar .ib { width: 32px; height: 32px; }
}
@container bar (max-width: 340px) {
  .sk-beseda .s-model > .ic:first-child { display: none; }
}

/* an empty chat */
.sk-beseda .app.is-empty .feed { --col: 728px; }
.sk-beseda .welcome { gap: 28px; padding: 16px 0; }
.sk-beseda .hero { text-align: center; display: flex; flex-direction: column; align-items: center; }
.sk-beseda .hero-mark { display: inline-flex; align-items: baseline; gap: 3px; padding: 5px 14px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 14px; letter-spacing: -.02em; }
.sk-beseda .hero-mark .cur { background: var(--accent); }
.sk-beseda .hero h1 { margin-top: 16px; font-size: 32px; font-weight: 700; letter-spacing: -.035em; line-height: 1.15; }
.sk-beseda .hero p { margin-top: 12px; font-size: 15.5px; line-height: 1.6; color: var(--dim); max-width: 54ch; }
.sk-beseda .sugg { gap: 10px; }
.sk-beseda .sugg-l { text-align: center; font-size: 12.5px; font-weight: 600; color: var(--mute); padding-bottom: 2px; }
.sk-beseda .sg { padding: 14px 16px; border-radius: 20px; background: var(--panel); border: 1px solid var(--isl-edge); column-gap: 12px; transition: border-color .12s, transform .12s, box-shadow .12s; }
.sk-beseda .sg:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: var(--isl); }
.sk-beseda .sg:active { transform: none; }
.sk-beseda .sg-ic { width: 38px; height: 38px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); }
.sk-beseda .sg b { font-size: 15px; font-weight: 650; }
.sk-beseda .sg-d { font-size: 13.5px; line-height: 1.45; }
.sk-beseda .info { gap: 12px; font-size: 13px; line-height: 1.45; }
.sk-beseda .card-h { padding: 9px 4px 5px 12px; }
.sk-beseda .card-h > .ic { color: var(--accent); }
/* the same in the heading of a card: the title is whole, its state takes two lines if it has to */
.sk-beseda .card-h h3 { flex: 1 0 auto; font-size: 15px; font-weight: 650; }
.sk-beseda .card-s { display: block; flex: 0 1 auto; min-width: 0; white-space: normal; text-align: right; line-height: 1.25; font-size: 12px; font-weight: 500; }
.sk-beseda .card-h .ib { width: 28px; height: 28px; }
.sk-beseda .mc { padding: 2px 0 4px; }
.sk-beseda .mc-row { padding: 5px 12px; font-size: 13px; line-height: 1.45; }
.sk-beseda .mc-row dd small { font-size: 12px; }
.sk-beseda .mc-note { padding: 8px 12px 12px; }
.sk-beseda .card-f { padding: 4px 12px 10px; }
.sk-beseda .qr-wrap { padding: 0 12px 12px; }
.sk-beseda .step .qr-wrap { padding: 4px 0 0; }
.sk-beseda .qr { border-radius: 12px; }
.sk-beseda .btn2 { height: 34px; padding: 0 14px; border-radius: 999px; background: var(--raised); font-size: 13px; font-weight: 600; transition: background-color .12s; }
.sk-beseda .btn2:hover { background: var(--hover); }
.sk-beseda .st-lead { padding: 2px 12px 10px; font-size: 13px; line-height: 1.5; color: var(--dim); }
.sk-beseda .st-prog { padding: 0 12px 8px; gap: 4px; }
.sk-beseda .st-prog i { height: 5px; border-radius: 3px; }
.sk-beseda .steps { padding: 0 0 4px; gap: 1px; }
.sk-beseda .step { padding: 5px 12px; font-size: 13.5px; align-items: flex-start; }
.sk-beseda .mark { width: 22px; height: 22px; }
.sk-beseda .step.done .mark { background: var(--add-bg); }
.sk-beseda .step.done .st-b b { color: var(--dim); }
/* A done step is one line: its name, and what it came to — the value gives way, the name does
   not (a name squeezed by a hair wraps in two). */
.sk-beseda .step.done .st-b { flex-wrap: nowrap; }
.sk-beseda .step.done .st-name { flex: none; max-width: 100%; }
.sk-beseda .step.done .st-v { flex: 0 1 auto; min-width: 0; }
.sk-beseda .step.done .st-act { flex: none; }
.sk-beseda .st-v { font-size: 12px; }
.sk-beseda .step.todo .mark { border: 1.5px solid var(--edge); color: var(--dim); }
.sk-beseda .step.next { margin-top: 4px; padding: 12px; border-radius: 16px; background: var(--raised); }
.sk-beseda .step.next .mark { border: 0; background: var(--accent-bg); color: var(--accent-fg); }
.sk-beseda .step.todo .st-b { row-gap: 6px; }
.sk-beseda .st-why { font-size: 13px; line-height: 1.5; }
.sk-beseda .btn { height: 34px; padding: 0 14px; border-radius: 999px; background: var(--accent-bg); color: var(--accent-fg); font-size: 13px; font-weight: 600; margin-top: 2px; transition: filter .12s; }
.sk-beseda .btn:hover { filter: brightness(1.08); }
.sk-beseda .feed > .info { margin-bottom: 4px; }
.sk-beseda #sheet .info { gap: 12px; }
.sk-beseda #sheet .card { border-color: var(--ovl-edge); box-shadow: var(--ovl); }
/* a card opened from the keyboard takes the focus: its ring is round like the card */
.sk-beseda #sheet .info:focus-visible { border-radius: 22px; }

/* menus, the look panel, toasts, dialogs */
/* The height of a menu is the page script's business (it gives a list the room on its side of
   the anchor and places it by what it really takes): the rows here are tall, so no cap of the skin. */
.sk-beseda #menu, .sk-beseda .pop { padding: 6px; background: var(--panel); border: 1px solid var(--ovl-edge); border-radius: 20px; box-shadow: var(--ovl); font-size: 13.5px; overscroll-behavior: contain; }
.sk-beseda .mi { min-height: 36px; padding: 5px 12px; border-radius: 12px; }
.sk-beseda .mi:hover:not(.info), .sk-beseda .mi.act:hover, .sk-beseda .mi:focus-visible { background: var(--raised); }
.sk-beseda .mi:focus-visible { outline-offset: -2px; }
.sk-beseda .mi small { font-size: 12.5px; }
.sk-beseda #menu .sep { margin: 5px 10px; background: var(--line); }
.sk-beseda #menu .head { position: static; height: auto; padding: 8px 12px 6px; font-size: 12.5px; font-weight: 600; }
.sk-beseda #menu .head::after { content: none; }
.sk-beseda #menu .head span:first-child:not(:last-child) { color: var(--accent); }
.sk-beseda .pop { padding: 12px; }
.sk-beseda .pop-t { padding: 2px 4px 8px; font-size: 12.5px; color: var(--mute); }
.sk-beseda .pop-t + * { margin-bottom: 12px; }
.sk-beseda .pop-skins { gap: 4px; }
.sk-beseda .pk { padding: 9px 12px; border-radius: 14px; border: 1.5px solid transparent; transition: background-color .12s, border-color .12s; }
.sk-beseda .pk:hover { background: var(--raised); }
.sk-beseda .pk[aria-checked="true"] { border-color: var(--accent); background: var(--accent-soft); }
.sk-beseda .pk small { font-size: 12.5px; line-height: 1.35; }
.sk-beseda .pk-sw { border-radius: 50%; }
.sk-beseda .seg { padding: 4px; gap: 2px; border-radius: 999px; background: var(--raised); }
.sk-beseda .seg button { height: 30px; padding: 0 8px; border-radius: 999px; color: var(--dim); font-size: 12.5px; font-weight: 500; }
.sk-beseda .seg button:hover { color: var(--fg); }
.sk-beseda .seg button:focus-visible { outline-offset: -2px; }
.sk-beseda .seg button[aria-checked="true"] { background: var(--panel); color: var(--fg); font-weight: 600; box-shadow: 0 1px 3px var(--shadow); }
.sk-beseda .pop-row { padding: 2px 4px; font-size: 13px; }
.sk-beseda .pop-row .btn2 { height: 30px; }
.sk-beseda .toast { padding: 12px 12px 12px 16px; border-radius: 18px; background: var(--panel); border: 1px solid var(--ovl-edge); box-shadow: var(--ovl); font-size: 13.5px; }
.sk-beseda .toast.warn { border: 1.5px solid var(--warn-line); }
.sk-beseda .toast > button { height: 30px; padding: 0 14px; border-radius: 999px; background: var(--accent-bg); color: var(--accent-fg); font-size: 13px; font-weight: 600; transition: filter .12s; }
.sk-beseda .toast > button:hover { filter: brightness(1.08); }
.sk-beseda .toast > i { top: 8px; right: 8px; width: 24px; height: 24px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; line-height: 1; }
.sk-beseda .toast > i:hover { background: var(--raised); }
.sk-beseda #conn { padding: 6px 16px; border-radius: 999px; background: var(--warn-soft); color: var(--warn); border: 1.5px solid var(--warn-line); box-shadow: var(--ovl); font-size: 13px; font-family: var(--font); }
.sk-beseda .dlg-box { padding: 20px; gap: 10px; border-radius: 24px; background: var(--panel); color: var(--fg); border: 1px solid var(--ovl-edge); box-shadow: var(--ovl); font: 14px/1.5 var(--font); }
.sk-beseda .dlg-title { font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
.sk-beseda .dlg-prompt { font-size: 13.5px; }
/* The field wears one ring: its own. Its border is a line with meaning — 3:1 on the panel. */
.sk-beseda .dlg-input { padding: 10px 14px; border: 1.5px solid var(--edge); border-radius: 14px; font-size: 15px; transition: border-color .12s, box-shadow .12s; }
.sk-beseda .dlg-input:focus, .sk-beseda .dlg-input:focus-visible { outline: 0; border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
.sk-beseda .dlg-err { font-size: 12.5px; }
.sk-beseda .dlg-list { margin: 0 -4px; padding: 4px; scroll-padding-block: 8px; overscroll-behavior: contain; }
.sk-beseda .dlg-item { padding: 10px 14px; border-radius: 14px; background: transparent; border: 1.5px solid var(--line2); transition: background-color .12s, border-color .12s; }
.sk-beseda .dlg-item:hover, .sk-beseda .dlg-item:focus-visible { background: var(--accent-soft); border-color: var(--accent); }
.sk-beseda .dlg-btns button { height: 36px; padding: 0 18px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 600; border: 1.5px solid var(--edge); background: transparent; color: var(--fg); transition: border-color .12s, background-color .12s, filter .12s; }
.sk-beseda .dlg-btns button:hover { border-color: var(--accent); background: var(--accent-soft); }
.sk-beseda .dlg-btns button.primary { background: var(--accent-bg); border-color: var(--accent-bg); color: var(--accent-fg); }
.sk-beseda .dlg-btns button.primary:hover { background: var(--accent-bg); filter: brightness(1.08); }

@media (hover: none) {
  .sk-beseda .msg.assistant > .copy-msg { opacity: 1; }
}
/* The turn line where the chat column is at its narrowest: while a question waits the step does
   not change — it leaves the line whole instead of being cut in the middle of "step 9 of…". */
@media (max-width: 839px), (min-width: 1100px) and (max-width: 1159px) {
  .sk-beseda .turn:has(.turn-wait.on) .turn-step { display: none; }
}

/* A wide window: the islands on the right share the height. Each scrolls inside itself, so twelve
   subagents do not push the files out of sight, and forty files do not push out the subagents. */
@media (min-width: 1100px) {
  .sk-beseda .app:not(.is-empty) .agents.on, .sk-beseda .app:not(.is-empty) .files.on { display: flex; flex-direction: column; min-height: 0; }
  .sk-beseda .app:not(.is-empty) .agents.on { flex: 0 1 auto; }
  .sk-beseda .app:not(.is-empty) .files.on { flex: none; max-height: 50%; }
  .sk-beseda .app:not(.is-empty) .agents:not(.on) + .files.on { max-height: 100%; }
  .sk-beseda .app:not(.is-empty) .agents.folded + .files.on { max-height: calc(100% - 64px); }
  .sk-beseda .ag-h, .sk-beseda .files .ch-h { flex: none; }
  .sk-beseda .ag-list, .sk-beseda .files .flist { min-height: 0; overflow-y: auto; }
  /* The column is narrow and a name is a few words: it takes two lines before it is cut. */
  .sk-beseda .ag-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; white-space: normal; overflow-wrap: anywhere; line-height: 1.35; }
  /* "Waits for your answer" and its steps do not fit one line here: two lines, both whole. */
  .sk-beseda .ag[data-state="waiting"] .ag-state { grid-area: 2 / 2 / 3 / 5; }
  .sk-beseda .ag[data-state="waiting"] .ag-steps { grid-area: 3 / 2 / 4 / 5; }
  .sk-beseda .ag[data-state="waiting"] .ag-steps::before { content: none; }
  .sk-beseda .ag[data-state="waiting"] .ag-acts { grid-area: 4 / 2 / 5 / 4; }
  .sk-beseda .ag[data-state="waiting"] .ag-time { grid-area: 4 / 4; }
}

/* A window of middle width: no column on the right. Subagents sit over the input as a list of
   two-line rows — the name and the state on the left, what can be done on the right, as round
   buttons; changed files stay in the feed. The island is a container of its own name here
   ("rows"), so what follows by its width does not reach the column of a wide window. */
@media (max-width: 1099px) {
  .sk-beseda .app { grid-template-columns: var(--side) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto;
    grid-template-areas: "side head" "side feed" "side rail" "side turn" "side comp"; }
  .sk-beseda .app.no-rail { grid-template-columns: var(--side) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto; }
  .sk-beseda .rail { margin: 0 0 8px; padding: 0 var(--padx); overflow: visible; }
  .sk-beseda .files.on { display: none; }
  .sk-beseda .changed { display: block; }
  .sk-beseda .app .turn-esc { display: none; }
  .sk-beseda .agents { border-radius: 20px; padding: 4px; container-name: agents rows; }
  .sk-beseda .ag-h { padding: 6px 4px 4px 12px; }
  .sk-beseda .ag-list { max-height: min(238px, 34vh); overflow-y: auto; }
  .sk-beseda .ag { grid-template-columns: 32px auto minmax(0, 1fr) auto auto; row-gap: 0; padding: 7px 8px 7px 10px; }
  .sk-beseda .ring, .sk-beseda .ag-ic { width: 32px; height: 32px; align-self: center; }
  .sk-beseda .ag-name { grid-area: 1 / 2 / 2 / 4; }
  .sk-beseda .ag-state { grid-area: 2 / 2; }
  .sk-beseda .ag-steps { grid-area: 2 / 3; }
  .sk-beseda .ag-acts { grid-area: 1 / 4 / 3 / 5; margin: 0; flex-wrap: nowrap; }
  .sk-beseda .ag-time { grid-area: 1 / 5 / 3 / 6; margin: 0; display: none; min-width: 7ch; }
  .sk-beseda .mini { height: 30px; }
  .sk-beseda .m-stop, .sk-beseda .m-open { width: 30px; padding: 0; }
  .sk-beseda .m-stop .ic, .sk-beseda .m-open .ic { display: block; width: 14px; height: 14px; }
  .sk-beseda .m-stop span, .sk-beseda .m-open span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
/* by the width of the island itself: the time when there is room for it; in a narrow island the
   line of state takes the whole width, under the name and the buttons, and is not cut */
@container rows (min-width: 520px) {
  .sk-beseda .ag-time { display: block; }
}
@container rows (max-width: 519px) {
  .sk-beseda .ag { padding-block: 5px; }
  .sk-beseda .ag-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; white-space: normal; overflow-wrap: anywhere; line-height: 1.35; }
  .sk-beseda .ag-acts { grid-area: 1 / 4 / 2 / 6; justify-self: end; }
  .sk-beseda .ag-steps { grid-area: 2 / 3 / 3 / 6; }
  .sk-beseda .mini { height: 28px; }
  .sk-beseda .m-stop, .sk-beseda .m-open { width: 28px; }
}
@media (max-width: 719px) {
  .sk-beseda .app { --padx: 10px; }
  .sk-beseda .app, .sk-beseda .app.no-rail { padding: 0; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto auto;
    grid-template-areas: "top" "feed" "rail" "turn" "comp"; }
  .sk-beseda .side { border-radius: 0 22px 22px 0; }
  .sk-beseda .app .key, .sk-beseda .app .key-line { display: none; }
  .sk-beseda .top { position: relative; z-index: 1; height: 52px; padding: 0 8px; }
  .sk-beseda .top .brand, .sk-beseda .top .c-path, .sk-beseda .top .c-sep, .sk-beseda .top-meta { display: none; }
  .sk-beseda .c-chat { font-size: 16px; font-weight: 650; letter-spacing: -.02em; text-align: center; }
  .sk-beseda .head { display: none; }
  .sk-beseda .feed { padding: 10px 14px 16px; gap: 14px; font-size: 15px; }
  .sk-beseda .feed > .tools, .sk-beseda .feed > .ask, .sk-beseda .feed > .changed, .sk-beseda .feed > .notice, .sk-beseda .feed > .error, .sk-beseda .feed > .msg.thinking { margin-left: 0; }
  .sk-beseda .msg.assistant { padding-left: 0; }
  .sk-beseda .msg.assistant::before { display: none; }
  .sk-beseda .msg.user { max-width: 92%; }
  .sk-beseda .tool:not(.run) .t-time { display: none; }
  .sk-beseda .t-out { padding-left: 14px; }
  .sk-beseda .ask { padding: 12px; }
  .sk-beseda .ask.q .opts { display: flex; flex-direction: column; flex-wrap: nowrap; }
  .sk-beseda .rail { margin: 0 0 6px; }
  .sk-beseda .agents { border-radius: 22px; padding: 0 4px; box-shadow: none; }
  .sk-beseda .agents:not(.folded) { padding-bottom: 4px; }
  .sk-beseda .ag-h { padding: 4px 2px 4px 12px; border-radius: 18px; }
  .sk-beseda .ag-title { font-size: 13.5px; }
  .sk-beseda .ag-list { max-height: 34vh; }
  .sk-beseda .app .turn, .sk-beseda .app .timer, .sk-beseda .app .hint { display: none; }
  .sk-beseda .composer { padding-bottom: 10px; }
  .sk-beseda .box { border-radius: 22px; }
  .sk-beseda textarea { min-height: 50px; }
  .sk-beseda .bar { gap: 4px; }
  .sk-beseda .sel { padding: 0 9px; }
  .sk-beseda .bar .ib { width: 32px; height: 32px; }
  .sk-beseda .s-source .sel-v, .sk-beseda .s-effort .sel-v, .sk-beseda .sel .sel-c { display: none; }
  .sk-beseda .welcome { margin-block: 0 auto; padding: 8px 0 0; gap: 18px; }
  .sk-beseda .hero h1 { font-size: 25px; }
  .sk-beseda .hero p { font-size: 14.5px; }
  .sk-beseda .sugg { grid-template-columns: minmax(0, 1fr); }
  .sk-beseda #sheet { padding: 8px; }
}
`;

export const BESEDA: Skin = { id: 'beseda', cls: 'sk-beseda', palette, css };
