// Markup for the webview chat. CSS/JS are inlined with a nonce: the webview has
// a strict CSP, and pulling in a bundler for a single page is needless weight.
//
// Colours come only from VS Code variables (--vscode-*): the editor theme can be
// anything, and the chat has to look native in every one of them, Cursor included.
//
// Strings live in STRINGS below rather than in the markup: English is the base
// language, and a bundle per language is added next to it. The table is injected
// into the inline script as `T`, so runtime text is translated the same way as
// the static markup.

import * as vscode from 'vscode';
import { renderMarkdown } from './markdown';

export type ChatLang = 'en' | 'ru';

/** Exported for the unit test that keeps the bundles in key parity. */
export const STRINGS: Record<ChatLang, Record<string, string>> = {
  en: {
    empty: 'Describe a task — the agent works right inside your project folder.\nThe active file and selection are attached automatically (execai.attachContext setting).',
    statusTitle: 'Model and source — click to change',
    placeholder: 'What should be done in this project?',
    attachTitle: 'Attach files',
    cmdTitle: 'execai commands',
    histTitle: 'Chat history',
    hintEnter: 'Enter — send',
    sendTitle: 'Send',
    stopTitle: 'Stop the turn',
    secs: 's',
    notSignedIn: 'not signed in',
    mSecurity: 'Security level',
    mResume: 'Continue the last chat',
    mModel: 'Model',
    mSource: 'Source',
    mConnect: 'Connect a source',
    mEffort: 'Reasoning level',
    mMaxIter: 'Iteration limit',
    mLogout: 'Sign out of ExecAI',
    mLogin: 'Sign in to ExecAI',
    loginNone: 'not signed in',
    openingBrowser: 'Opening the browser to confirm the sign-in…',
    mNewChat: 'New chat',
    mRestart: 'Restart the agent',
    mTerminal: 'Open execai in a terminal',
    back: '← back',
    listEmpty: 'the list has not arrived yet — reopen the menu',
    histHead: 'History of this project',
    histEmpty: 'nothing yet — this is the first chat',
    askPerm: 'The agent asks for permission — ',
    askQuestion: 'The agent is asking',
    dragSeen: '⤵ drag detected, types: ',
    dragNone: 'none',
    dropUnknown: 'Drop not recognized. Types: ',
    agentReady: 'Agent ready: ',
    thinkingClosed: 'reasoning ▸',
    thinkingOpen: 'reasoning ▾',
    newChatNotice: 'New chat.',
    chatRestored: 'Chat restored — carry on.',
    loginConfirm: 'Confirm the sign-in in your browser: ',
    loginCode: '  ·  code ',
    signedIn: 'Signed in: ',
    agentExited: 'The agent exited.',
    restartBtn: 'Restart',
  },
  ru: {
    empty: 'Опиши задачу — агент работает прямо в папке проекта.\nАктивный файл и выделение прикладываются автоматически (настройка execai.attachContext).',
    statusTitle: 'Модель и источник — клик, чтобы сменить',
    placeholder: 'Что сделать в этом проекте?',
    attachTitle: 'Приложить файлы',
    cmdTitle: 'Команды execai',
    histTitle: 'История чатов',
    hintEnter: 'Enter — отправить',
    sendTitle: 'Отправить',
    stopTitle: 'Остановить ход',
    secs: 'с',
    notSignedIn: 'не вошёл',
    mSecurity: 'Уровень безопасности',
    mResume: 'Продолжить последний чат',
    mModel: 'Модель',
    mSource: 'Источник',
    mConnect: 'Подключить источник',
    mEffort: 'Уровень рассуждения',
    mMaxIter: 'Предел итераций',
    mLogout: 'Выйти из ExecAI',
    mLogin: 'Войти в ExecAI',
    loginNone: 'не выполнен',
    openingBrowser: 'Открываю браузер для подтверждения входа…',
    mNewChat: 'Новый чат',
    mRestart: 'Перезапустить агента',
    mTerminal: 'Открыть execai в терминале',
    back: '← назад',
    listEmpty: 'список ещё не приехал — открой меню заново',
    histHead: 'История этого проекта',
    histEmpty: 'пока пусто — это первый чат',
    askPerm: 'Агент просит разрешение — ',
    askQuestion: 'Агент спрашивает',
    dragSeen: '⤵ вижу перетаскивание, типы: ',
    dragNone: 'нет',
    dropUnknown: 'Дроп не распознан. Типы: ',
    agentReady: 'Агент готов: ',
    thinkingClosed: 'размышления ▸',
    thinkingOpen: 'размышления ▾',
    newChatNotice: 'Новый чат.',
    chatRestored: 'Чат восстановлен — можно продолжать.',
    loginConfirm: 'Подтверди вход в браузере: ',
    loginCode: '  ·  код ',
    signedIn: 'Вошли: ',
    agentExited: 'Агент завершился.',
    restartBtn: 'Перезапустить',
  },
};

/** Maps a VS Code display language (`ru`, `ru-RU`) onto a bundle we ship. */
export function pickLang(code?: string): ChatLang {
  return (code || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function chatHtml(webview: vscode.Webview, _extensionUri: vscode.Uri, lang?: string): string {
  const nonce = String(Math.random()).slice(2);
  // Исходник рендерера уезжает в панель как есть: так у панели и у тестов
  // одна и та же реализация, и разойтись они не могут.
  const mdSource = renderMarkdown.toString();
  const code = pickLang(lang);
  const T = STRINGS[code];
  return /* html */ `<!DOCTYPE html>
<html lang="${code}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; padding: 0;
    font: 13px var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    display: flex; flex-direction: column;
  }
  #log { flex: 1; overflow-y: auto; padding: 8px; }
  .msg { margin: 0 0 10px; white-space: pre-wrap; word-break: break-word; }
  /* An answer brings its own block spacing; pre-wrap would add the blank
     lines of the original markdown on top of it. */
  .msg.assistant { white-space: normal; }
  .user {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 8px; padding: 6px 9px;
  }
  .assistant { padding: 0 2px; }
  /* Markdown in answers. Models reply with tables, code and lists; without
     this the message arrived as raw text full of pipe characters. */
  .assistant p { margin: 0 0 8px; }
  .assistant p:last-child { margin-bottom: 0; }
  .assistant h3, .assistant h4, .assistant h5, .assistant h6 {
    margin: 10px 0 6px; font-size: 13px; font-weight: 600;
  }
  .assistant ul, .assistant ol { margin: 4px 0 8px; padding-left: 20px; }
  .assistant li { margin: 2px 0; }
  .assistant blockquote {
    margin: 6px 0; padding: 2px 0 2px 9px;
    border-left: 2px solid var(--vscode-panel-border);
    color: var(--vscode-descriptionForeground);
  }
  .assistant hr { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 10px 0; }
  .assistant code {
    font-family: var(--vscode-editor-font-family); font-size: 11.5px;
    background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
    border-radius: 3px; padding: 1px 4px;
  }
  .assistant pre.code {
    margin: 6px 0; padding: 7px 9px; overflow-x: auto;
    background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-panel-border); border-radius: 5px;
  }
  .assistant pre.code code { background: none; padding: 0; font-size: 11.5px; }
  /* The panel is narrow and tables are wide: scroll the TABLE, not the whole
     panel, or the surrounding text drifts with it. */
  .assistant .tablewrap { overflow-x: auto; margin: 6px 0; }
  .assistant table { border-collapse: collapse; font-size: 12px; }
  .assistant th, .assistant td {
    border: 1px solid var(--vscode-panel-border); padding: 3px 7px; vertical-align: top;
  }
  .assistant th { background: var(--vscode-editor-background); font-weight: 600; }
  .assistant a { color: var(--vscode-textLink-foreground); }
  .thinking {
    color: var(--vscode-descriptionForeground);
    font-style: italic; font-size: 12px;
    max-height: 48px; overflow: hidden; opacity: .85;
  }
  .thinking.open { max-height: none; }
  .thinking-toggle {
    cursor: pointer; color: var(--vscode-textLink-foreground);
    font-size: 11px; user-select: none;
  }
  .tool {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px; margin: 6px 0; font-size: 12px;
  }
  .tool-head { display: flex; gap: 6px; align-items: center; padding: 4px 8px; cursor: pointer; }
  .tool-name { font-weight: 600; }
  .tool-sum { color: var(--vscode-descriptionForeground); overflow: hidden;
              text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .tool-state { font-size: 11px; }
  .tool-out {
    display: none; border-top: 1px solid var(--vscode-panel-border);
    padding: 6px 8px; max-height: 220px; overflow-y: auto;
    font-family: var(--vscode-editor-font-family); font-size: 11px;
    white-space: pre-wrap; word-break: break-all;
    background: var(--vscode-editor-background);
  }
  .tool.open .tool-out { display: block; }
  .ask {
    border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
    border-radius: 8px; padding: 8px; margin: 8px 0;
  }
  .ask-title { font-weight: 600; margin-bottom: 4px; }
  .ask-sum {
    font-family: var(--vscode-editor-font-family); font-size: 12px;
    background: var(--vscode-editor-background); border-radius: 4px;
    padding: 5px 7px; margin-bottom: 7px; white-space: pre-wrap; word-break: break-all;
  }
  .ask button {
    display: block; width: 100%; text-align: left; margin: 3px 0;
    padding: 5px 8px; border-radius: 5px; cursor: pointer;
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground);
    border: 1px solid var(--vscode-panel-border);
  }
  .ask button:hover { background: var(--vscode-list-hoverBackground); }
  .ask button b { display: block; }
  .ask button small { color: var(--vscode-descriptionForeground); }
  .ask.answered { opacity: .55; }
  .ask.answered button { pointer-events: none; }
  .files { margin: 6px 0; display: flex; flex-wrap: wrap; gap: 4px; }
  .files span {
    cursor: pointer; font-size: 11px; border-radius: 4px; padding: 2px 7px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
  }
  .notice { color: var(--vscode-descriptionForeground); font-size: 12px; margin: 6px 0; }
  .error { color: var(--vscode-errorForeground); font-size: 12px; margin: 6px 0; white-space: pre-wrap; }
  #composer { border-top: 1px solid var(--vscode-panel-border); padding: 7px; }
  #chips { display: flex; flex-wrap: wrap; gap: 4px; }
  #chips:empty { display: none; }
  #chips .chip {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; border-radius: 4px; padding: 2px 7px; margin-bottom: 4px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
  }
  #chips .chip i { cursor: pointer; font-style: normal; opacity: .7; }
  #chips .chip i:hover { opacity: 1; }
  #chips .chip img { height: 44px; max-width: 90px; object-fit: cover;
                     border-radius: 4px; display: block; }
  .gallery { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
  .gallery img { max-height: 120px; max-width: 100%; border-radius: 6px;
                 border: 1px solid var(--vscode-panel-border); }
  .gallery .fchip {
    font-size: 11px; border-radius: 4px; padding: 3px 8px; align-self: center;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
  }
  body.dragover #box { outline: 2px dashed var(--vscode-focusBorder); outline-offset: -2px; }
  #box {
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 8px; background: var(--vscode-input-background);
  }
  #box:focus-within { outline: 1px solid var(--vscode-focusBorder); }
  #inp {
    width: 100%; resize: none; min-height: 48px; max-height: 180px;
    color: var(--vscode-input-foreground);
    background: transparent; border: none; outline: none;
    padding: 7px 9px 2px;
    font: 13px var(--vscode-font-family);
  }
  #bar { display: flex; gap: 4px; align-items: center; padding: 3px 5px 5px; }
  #bar button {
    border: none; cursor: pointer; border-radius: 6px;
    background: transparent; color: var(--vscode-descriptionForeground);
    width: 26px; height: 26px; font-size: 14px; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
  }
  #bar button:hover { background: var(--vscode-toolbar-hoverBackground);
                      color: var(--vscode-foreground); }
  #cmdBtn { font-size: 11px; font-family: var(--vscode-editor-font-family); }
  /* send/stop — a round accent button on the right, like in the web chat */
  #sendBtn, #stopBtn {
    margin-left: 0; border-radius: 50%;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  #sendBtn:hover, #stopBtn:hover { background: var(--vscode-button-hoverBackground);
                                   color: var(--vscode-button-foreground); }
  /* Specificity: "#bar button" (id + type) beats plain "#stopBtn" (id only), so
     display:none lost there and stop hung around forever. The selectors below
     deliberately include #bar. */
  #bar #stopBtn { display: none; }
  body.busy #bar #stopBtn { display: inline-flex; }
  body.busy #bar #sendBtn { display: none; }
  #hint { color: var(--vscode-descriptionForeground); font-size: 11px; flex: 1; text-align: right; }
  #empty { color: var(--vscode-descriptionForeground); padding: 16px 10px; font-size: 12px; }

  /* ── motion ──
     Animation only where it carries meaning: a turn is running, a tool is
     working, something new arrived. No decoration for its own sake: this panel
     lives right next to the code. */
  @keyframes exSpin { to { transform: rotate(360deg); } }
  @keyframes exPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes exIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes exGlow {
    0%, 100% { box-shadow: 0 0 0 0 var(--vscode-progressBar-background); }
    50%      { box-shadow: 0 0 0 4px transparent; }
  }

  .msg, .tool, .ask, .files, .notice { animation: exIn 160ms ease-out; }
  #chips .chip { animation: exIn 140ms ease-out; }

  /* The stop button: a spinning ring plus a soft pulse — proof the turn is alive. */
  #stopBtn { position: relative; }
  body.busy #stopBtn { animation: exGlow 1.6s ease-in-out infinite; }
  body.busy #stopBtn::after {
    content: ''; position: absolute; inset: -3px; border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: var(--vscode-progressBar-background, var(--vscode-focusBorder));
    animation: exSpin 900ms linear infinite;
    pointer-events: none;
  }
  #bar button { transition: background-color 120ms ease, color 120ms ease, transform 80ms ease; }
  #bar button:active { transform: scale(.92); }

  /* A spinner inside the tool card while the tool is running. */
  .spin {
    display: inline-block; width: 10px; height: 10px; border-radius: 50%;
    border: 1.5px solid var(--vscode-panel-border);
    border-top-color: var(--vscode-progressBar-background, var(--vscode-focusBorder));
    animation: exSpin 800ms linear infinite;
  }
  .tool.run .tool-name { animation: exPulse 1.4s ease-in-out infinite; }
  .thinking.live { animation: exPulse 1.8s ease-in-out infinite; }

  /* Turn timer — next to the hint, replacing it while the agent works. */
  #timer { display: none; color: var(--vscode-descriptionForeground); font-size: 11px;
           flex: 1; text-align: right; font-variant-numeric: tabular-nums; }
  body.busy #timer { display: inline; }
  body.busy #hint { display: none; }

  /* Respect the system setting: no motion for those who asked for none. */
  @media (prefers-reduced-motion: reduce) {
    .msg, .tool, .ask, .files, .notice, #chips .chip { animation: none; }
    body.busy #stopBtn, body.busy #stopBtn::after,
    .spin, .tool.run .tool-name, .thinking.live { animation: none; }
    body.busy #stopBtn::after { border-top-color: transparent; }
  }
  #status {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; color: var(--vscode-descriptionForeground);
    padding: 0 2px 5px; cursor: pointer; user-select: none;
  }
  #status:hover { color: var(--vscode-foreground); }
  #status b { font-weight: 600; }
  /* command popup — flies out above the composer, like in Claude Code */
  #composer { position: relative; }
  #menu {
    display: none; position: absolute; left: 7px; right: 7px; bottom: calc(100% + 4px);
    max-height: 300px; overflow-y: auto; z-index: 10;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    color: var(--vscode-menu-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.35); padding: 4px;
  }
  #menu.open { display: block; }
  #menu .mi {
    display: flex; gap: 8px; align-items: center;
    padding: 6px 9px; border-radius: 5px; cursor: pointer; font-size: 12.5px;
  }
  #menu .mi:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
                    color: var(--vscode-menu-selectionForeground, inherit); }
  #menu .mi .grow { flex: 1; }
  #menu .mi small { color: var(--vscode-descriptionForeground); }
  #menu .mi:hover small { color: inherit; opacity: .8; }
  #menu .mi .check { width: 14px; text-align: center; }
  #menu .sep { height: 1px; margin: 4px 2px;
               background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border)); }
  #menu .head { display: flex; gap: 6px; align-items: center; padding: 4px 6px 6px;
                color: var(--vscode-descriptionForeground); font-size: 11px; }
  #menu .head span { cursor: pointer; }
  #menu .head span:hover { color: var(--vscode-foreground); }
</style>
</head>
<body>
  <div id="log">
    <div id="empty">${T.empty}</div>
  </div>
  <div id="composer">
    <div id="menu"></div>
    <div id="status" title="${T.statusTitle}">…</div>
    <div id="chips"></div>
    <div id="box">
      <textarea id="inp" placeholder="${T.placeholder}"></textarea>
      <div id="bar">
        <button id="filesBtn" title="${T.attachTitle}">+</button>
        <button id="cmdBtn" title="${T.cmdTitle}">&gt;_</button>
        <button id="histBtn" title="${T.histTitle}">⏱</button>
        <span id="hint">${T.hintEnter}</span>
        <span id="timer">0.0${T.secs}</span>
        <button id="sendBtn" title="${T.sendTitle}">➤</button>
        <button id="stopBtn" title="${T.stopTitle}">■</button>
      </div>
    </div>
  </div>

<script nonce="${nonce}">
const T = ${JSON.stringify(T)};
// The markdown renderer: the very source the tests cover (src/markdown.ts).
//
// Bound to a name explicitly. The release build is minified, so the function
// arrives here renamed to a single letter — a bare declaration left the panel
// calling a renderMarkdown() that did not exist, and answers fell back to raw
// text. Unit tests run an unminified bundle and could not see it; the live
// editor run did.
const renderMarkdown = ${mdSource};
const vscode = acquireVsCodeApi();
const log = document.getElementById('log');
const inp = document.getElementById('inp');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const chipsBox = document.getElementById('chips');

let curAssistant = null;  // current answer block
let curThinking = null;   // current reasoning block
let tools = {};           // id → card elements
let attached = [];        // [{path, label, thumb?}] — "+", drag&drop, paste

function renderChips() {
  chipsBox.innerHTML = '';
  for (const a of attached) {
    const c = el('span', 'chip');
    if (a.thumb) {
      const img = document.createElement('img');
      img.src = a.thumb; img.title = a.label;
      c.appendChild(img);
    } else {
      c.appendChild(el('span', '', (isImg(a.path) ? '🖼 ' : '📄 ') + a.label));
    }
    const x = el('i', '', '✕');
    x.onclick = () => { attached = attached.filter(v => v.path !== a.path); renderChips(); };
    c.appendChild(x);
    chipsBox.appendChild(c);
  }
}
function isImg(p) { return /\\.(png|jpe?g|gif|webp)$/i.test(p || ''); }
function addAttachments(items) {
  for (const it of items || []) {
    if (!attached.some(a => a.path === it.path)) attached.push(it);
  }
  renderChips();
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function scroll() { log.scrollTop = log.scrollHeight; }

// Turn timer: how long the agent has been working. Seconds beat a spinner —
// they show whether it is thinking or hung.
const timerEl = document.getElementById('timer');
let timerId = null, timerT0 = 0;
function startTimer() {
  timerT0 = Date.now();
  timerEl.textContent = '0.0' + T.secs;
  clearInterval(timerId);
  timerId = setInterval(() => {
    timerEl.textContent = ((Date.now() - timerT0) / 1000).toFixed(1) + T.secs;
  }, 100);
}
function stopTimer() { clearInterval(timerId); timerId = null; }

// Safety net: the done event may never arrive (agent crashed, protocol drifted).
// A stop button that hangs forever lies about the state — reset it on ready/state.
function clearBusy() {
  document.body.classList.remove('busy');
  stopTimer();
  for (const t of Object.values(tools)) t.box.classList.remove('run');
}
function clearEmpty() { document.getElementById('empty')?.remove(); }

function send() {
  const text = inp.value.trim();
  if (!text && !attached.length) return;
  clearEmpty();
  const bubble = el('div', 'msg user', text);
  if (attached.length) {
    const g = el('div', 'gallery');
    for (const a of attached) {
      if (a.thumb) {
        const img = document.createElement('img');
        img.src = a.thumb; img.title = a.label;
        g.appendChild(img);
      } else {
        g.appendChild(el('span', 'fchip', (isImg(a.path) ? '🖼 ' : '📄 ') + a.label));
      }
    }
    bubble.appendChild(g);
  }
  log.appendChild(bubble);
  inp.value = '';
  curAssistant = null; curThinking = null;
  vscode.postMessage({ type: 'send', text, files: attached.map(a => a.path) });
  attached = []; renderChips();
  scroll();
}
sendBtn.onclick = send;
document.getElementById('filesBtn').onclick = () => vscode.postMessage({ type: 'pick_files' });

// ── command popup (like Claude Code: right in the chat, above the input) ──
const menu = document.getElementById('menu');
const statusEl = document.getElementById('status');
let stateData = { model: '', source: '', models: [], sources: [],
                   efforts: [], connectable: [], securities: [], security: '',
                   user: '', effort: '', maxIter: 0 };
let chatsData = [];
let menuView = null; // null | 'root' | 'models' | 'sources' | 'chats'

function renderStatus() {
  statusEl.innerHTML = '';
  const b = el('b', '', stateData.model || '…');
  statusEl.appendChild(b);
  statusEl.appendChild(el('span', '', '·'));
  statusEl.appendChild(el('span', '', stateData.source || '…'));
  if (stateData.effort && stateData.effort !== 'off') {
    statusEl.appendChild(el('span', '', '·'));
    statusEl.appendChild(el('span', '', 'effort ' + stateData.effort));
  }
  if (!stateData.user) {
    statusEl.appendChild(el('span', '', '·'));
    const w = el('span', '', T.notSignedIn);
    w.style.color = 'var(--vscode-inputValidation-warningBorder, #b89500)';
    statusEl.appendChild(w);
  }
}
statusEl.onclick = () => {
  if (menu.classList.contains('open')) closeMenu();
  else { vscode.postMessage({ type: 'agent_command', name: 'state' }); menuRoot(); }
};

// key is a stable test anchor. Labels are translated, so a test that finds a
// menu entry by its text breaks when the editor language changes (caught by
// the self-test run: the profile was English, assertions looked for Russian).
function mi(label, extra, onclick, checked, key) {
  const d = el('div', 'mi');
  if (key) d.setAttribute('data-mi', key);
  d.appendChild(el('span', 'check', checked ? '✓' : ''));
  const g = el('span', 'grow', label);
  d.appendChild(g);
  if (extra) d.appendChild(Object.assign(el('small', '', extra), {}));
  d.onclick = onclick;
  return d;
}
function closeMenu() { menu.classList.remove('open'); menuView = null; }
function menuRoot() {
  menuView = 'root';
  menu.innerHTML = '';
  menu.appendChild(mi(T.mModel, stateData.model || '…', () => menuList('models'), false, 'models'));
  menu.appendChild(mi(T.mSource, stateData.source || '…', () => menuList('sources'), false, 'sources'));
  menu.appendChild(mi(T.mConnect, '', () => menuList('connectable'), false, 'connect'));
  menu.appendChild(el('div', 'sep'));
  menu.appendChild(mi(T.mEffort, stateData.effort || '…', () => menuList('efforts'), false, 'efforts'));
  menu.appendChild(mi(T.mSecurity, stateData.security || '…', () => menuList('securities'), false, 'securities'));
  menu.appendChild(mi(T.mMaxIter, String(stateData.maxIter || ''), () => {
    closeMenu();
    vscode.postMessage({ type: 'agent_command', name: 'set_max_iterations' });
  }, false, 'maxiter'));
  menu.appendChild(el('div', 'sep'));
  if (stateData.user) {
    menu.appendChild(mi(T.mLogout, stateData.user, () => {
      closeMenu();
      vscode.postMessage({ type: 'agent_command', name: 'logout' });
    }, false, 'logout'));
  } else {
    menu.appendChild(mi(T.mLogin, T.loginNone, () => {
      closeMenu();
      log.appendChild(el('div', 'notice', T.openingBrowser));
      scroll();
      vscode.postMessage({ type: 'agent_command', name: 'login' });
    }, false, 'login'));
  }
  menu.appendChild(el('div', 'sep'));
  menu.appendChild(mi(T.mResume, '', () => {
    closeMenu();
    vscode.postMessage({ type: 'agent_command', name: 'resume_last' });
  }, false, 'resume'));
  menu.appendChild(mi(T.mNewChat, '', () => { closeMenu(); vscode.postMessage({ type: 'new_chat_ui' }); }, false, 'newchat'));
  menu.appendChild(mi(T.mRestart, '', () => { closeMenu(); vscode.postMessage({ type: 'restart' }); }, false, 'restart'));
  menu.appendChild(mi(T.mTerminal, '', () => { closeMenu(); vscode.postMessage({ type: 'open_terminal' }); }, false, 'terminal'));
  menu.classList.add('open');
}
function menuList(kind) {
  menuView = kind;
  menu.innerHTML = '';
  const head = el('div', 'head');
  const back = el('span', '', T.back);
  back.onclick = menuRoot;
  head.appendChild(back);
  const titles = { models: T.mModel, sources: T.mSource,
                   efforts: T.mEffort, connectable: T.mConnect, securities: T.mSecurity };
  head.appendChild(el('span', '', titles[kind] || kind));
  menu.appendChild(head);
  const cmdFor = { models: 'set_model', sources: 'set_source',
                   efforts: 'set_effort', connectable: 'connect', securities: 'set_security' };
  const items = stateData[kind] || [];
  if (!items.length) menu.appendChild(el('div', 'mi', T.listEmpty));
  for (const it of items) {
    menu.appendChild(mi(it.label || it.id, '', () => {
      vscode.postMessage({ type: 'agent_command', name: cmdFor[kind], value: it.id });
      // Source and effort apply instantly — stay in the menu, a fresh state will
      // redraw the root. Model and connect close it: the latter continues with a
      // key prompt in the editor.
      if (kind === 'sources') menuRoot();
      else closeMenu();
    }, !!it.active, 'item:' + it.id));
  }
}
function menuChats() {
  menuView = 'chats';
  menu.innerHTML = '';
  const head = el('div', 'head');
  head.appendChild(el('span', '', T.histHead));
  menu.appendChild(head);
  if (!chatsData.length) menu.appendChild(el('div', 'mi', T.histEmpty));
  for (const c of chatsData) {
    menu.appendChild(mi(c.label || c.id, '', () => {
      closeMenu();
      vscode.postMessage({ type: 'agent_command', name: 'load_chat', value: c.id });
    }, !!c.active));
  }
  menu.classList.add('open');
}
document.getElementById('histBtn').onclick = () => {
  if (menuView === 'chats') { closeMenu(); return; }
  vscode.postMessage({ type: 'agent_command', name: 'list_chats' });
  menuChats(); // cache first, the chats event redraws
};

document.getElementById('cmdBtn').onclick = () => {
  if (menu.classList.contains('open')) { closeMenu(); return; }
  vscode.postMessage({ type: 'agent_command', name: 'state' }); // refresh the lists
  menuRoot();
};
document.addEventListener('click', (e) => {
  // Via composedPath, not contains: clicking a menu item redraws the menu
  // synchronously, the target detaches from the DOM, and contains() lied
  // "the click was outside" — the menu closed on ANY click inside a submenu.
  const path = e.composedPath();
  if (path.includes(menu) || path.includes(statusEl)) return;
  if (path.some((n) => n && (n.id === 'cmdBtn' || n.id === 'histBtn'))) return;
  closeMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
inp.onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
};
stopBtn.onclick = () => vscode.postMessage({ type: 'stop' });

function assistant() {
  if (!curAssistant) {
    curAssistant = el('div', 'msg assistant');
    log.appendChild(curAssistant);
  }
  return curAssistant;
}

function addAsk(e, isPermission) {
  const box = el('div', 'ask');
  box.appendChild(el('div', 'ask-title',
    isPermission ? T.askPerm + (e.tool || '') : T.askQuestion));
  if (isPermission) box.appendChild(el('div', 'ask-sum', e.summary || ''));
  else box.appendChild(el('div', 'ask-sum', e.question || ''));
  for (const o of e.options || []) {
    const b = document.createElement('button');
    const bb = el('b', '', o.label);
    b.appendChild(bb);
    if (o.description) b.appendChild(el('small', '', o.description));
    b.onclick = () => {
      vscode.postMessage({ type: 'answer', id: e.id, value: o.value });
      box.classList.add('answered');
      bb.textContent = '✓ ' + o.label;
    };
    box.appendChild(b);
  }
  log.appendChild(box);
  scroll();
}

// ── file drag&drop: the VS Code explorer, the OS, a browser ──
// Capture phase on window: otherwise a drop into the textarea pastes the path as
// TEXT, and the user gets "the AI sees the file but there is no chip".
function pathsFromDataTransfer(dt) {
  const out = [];
  const push = (u) => {
    u = (u || '').trim();
    if (!u) return;
    if (u.startsWith('file://')) out.push(decodeURIComponent(u.slice(7)));
    else if (u.startsWith('/')) out.push(u);
  };
  // The VS Code explorer puts its own types on the transfer, the OS uses
  // text/uri-list, Mozilla-compatible managers use text/x-moz-url, and
  // text/plain is often there too.
  for (const t of ['text/uri-list', 'application/vnd.code.uri-list', 'resourceurls', 'text/x-moz-url', 'text/plain']) {
    const v = dt.getData(t);
    if (!v) continue;
    if (t === 'resourceurls') {
      try { for (const u of JSON.parse(v)) push(u); } catch {}
    } else {
      for (const line of v.split(String.fromCharCode(10))) push(line);
    }
    if (out.length) break;
  }
  return [...new Set(out)];
}
let dragDiagShown = false;
window.addEventListener('dragenter', (e) => {
  // Field diagnostics: show what we see, once per drag.
  if (dragDiagShown) return;
  dragDiagShown = true;
  const types = Array.from((e.dataTransfer && e.dataTransfer.types) || []);
  log.appendChild(el('div', 'notice', T.dragSeen + (types.join(', ') || T.dragNone)));
  scroll();
}, true);
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragover');
}, true);
window.addEventListener('dragleave', () => document.body.classList.remove('dragover'), true);
window.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dragDiagShown = false;
  document.body.classList.remove('dragover');
  const dt = e.dataTransfer;
  if (!dt) return;
  const paths = pathsFromDataTransfer(dt);
  if (paths.length) {
    vscode.postMessage({ type: 'attach_paths', paths });
    return;
  }
  let blobs = 0;
  for (const f of dt.files || []) {
    if (f.size > 8 * 1024 * 1024) continue;
    blobs++;
    const r = new FileReader();
    r.onload = () => vscode.postMessage({ type: 'paste_blob', name: f.name, dataURL: r.result });
    r.readAsDataURL(f);
  }
  if (!blobs) {
    // Do not stay silent: visible diagnostics beat "the drop went nowhere".
    log.appendChild(el('div', 'notice',
      T.dropUnknown + Array.from(dt.types || []).join(', ')));
    scroll();
  }
}, true);

// ── Ctrl+V paste: screenshots and files from the clipboard ──
document.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const it of items) {
    if (it.kind !== 'file') continue;
    const f = it.getAsFile();
    if (!f || f.size > 8 * 1024 * 1024) continue;
    e.preventDefault();
    const name = f.name && f.name !== 'image.png' ? f.name : 'clipboard-' + Date.now() + '.png';
    const r = new FileReader();
    r.onload = () => vscode.postMessage({ type: 'paste_blob', name, dataURL: r.result });
    r.readAsDataURL(f);
  }
});

// the listener is attached — the buffered events can be replayed now
vscode.postMessage({ type: 'ui_ready' });

window.addEventListener('message', (ev) => {
  const e = ev.data;
  switch (e.type) {
    case 'ready': {
      clearBusy();
      clearEmpty();
      stateData.model = e.model || ''; stateData.source = e.source || '';
      renderStatus();
      log.appendChild(el('div', 'notice', T.agentReady + (e.model || '') + ' · ' + (e.source || '')));
      break;
    }
    case 'turn_start':
      document.body.classList.add('busy');
      startTimer();
      break;
    case 'reasoning_delta': {
      if (!curThinking) {
        curThinking = el('div', 'msg thinking');
        const t = el('div', 'thinking-toggle', T.thinkingClosed);
        t.onclick = () => {
          curThinkingBody.classList.toggle('open');
          t.textContent = curThinkingBody.classList.contains('open') ? T.thinkingOpen : T.thinkingClosed;
        };
        var curThinkingBody = el('div', 'thinking');
        curThinking.appendChild(t);
        curThinking.appendChild(curThinkingBody);
        curThinking._body = curThinkingBody;
        curThinking.classList.add('live');
        log.appendChild(curThinking);
      }
      curThinking._body.textContent += e.text || '';
      scroll();
      break;
    }
    case 'text_delta': {
      if (curThinking) curThinking.classList.remove('live');
      // MiniMax-class models send a trailing "</think>" as the first line — hide it.
      let t = e.text || '';
      const a = assistant();
      // Keep the raw text aside and re-render the whole block: markdown cannot
      // be appended piecewise — a table only becomes a table together with its
      // divider row, and that arrives in a later token.
      a._md = (a._md || '') + t;
      a._md = a._md.replace(/^\\s*<\\/think>\\s*/, '');
      a.innerHTML = renderMarkdown(a._md);
      scroll();
      break;
    }
    case 'tool_call': {
      curAssistant = null; curThinking = null;
      const box = el('div', 'tool');
      const head = el('div', 'tool-head');
      head.appendChild(el('span', 'tool-name', e.tool || ''));
      head.appendChild(el('span', 'tool-sum', e.summary || ''));
      const state = el('span', 'tool-state');
      state.appendChild(el('span', 'spin'));
      head.appendChild(state);
      box.classList.add('run');
      const out = el('div', 'tool-out', '');
      head.onclick = () => box.classList.toggle('open');
      box.appendChild(head); box.appendChild(out);
      log.appendChild(box);
      tools[e.id] = { box, out, state };
      scroll();
      break;
    }
    case 'tool_chunk': {
      const t = tools[e.id]; if (!t) break;
      t.out.textContent += e.chunk || '';
      break;
    }
    case 'tool_result': {
      const t = tools[e.id]; if (!t) break;
      t.box.classList.remove('run');
      t.state.textContent = e.ok ? '✓' : '✗';
      if (!t.out.textContent) t.out.textContent = e.tail || '';
      break;
    }
    case 'ask': addAsk(e, true); break;
    case 'ask_user': addAsk(e, false); break;
    case 'files_changed': {
      const wrap = el('div', 'files');
      wrap.appendChild(el('span', '', '📝'));
      for (const p of e.paths || []) {
        const chip = el('span', '', p);
        chip.onclick = () => vscode.postMessage({ type: 'open_file', path: p });
        wrap.appendChild(chip);
      }
      log.appendChild(wrap);
      scroll();
      break;
    }
    case 'done':
      document.body.classList.remove('busy');
      stopTimer();
      for (const t of Object.values(tools)) t.box.classList.remove('run');
      if (curThinking) curThinking.classList.remove('live');
      curAssistant = null; curThinking = null;
      break;
    case 'files_attached':
      addAttachments(e.items || (e.paths || []).map(p => ({ path: p, label: p })));
      break;
    case 'chat_reset':
      log.innerHTML = '';
      tools = {}; curAssistant = null; curThinking = null;
      log.appendChild(el('div', 'notice', T.newChatNotice));
      break;
    case 'chats':
      chatsData = e.chats || [];
      if (menuView === 'chats') menuChats();
      break;
    case 'chat_loaded': {
      log.innerHTML = '';
      tools = {}; curAssistant = null; curThinking = null;
      for (const m of e.msgs || []) {
        if (m.role === 'user') log.appendChild(el('div', 'msg user', m.text));
        else if (m.role === 'assistant') {
          const a = el('div', 'msg assistant');
          a._md = m.text || '';
          a.innerHTML = renderMarkdown(a._md);
          log.appendChild(a);
        }
        else if (m.role === 'tool') {
          const box = el('div', 'tool');
          const head = el('div', 'tool-head');
          head.appendChild(el('span', 'tool-name', m.tool || ''));
          head.appendChild(el('span', 'tool-sum', m.text || ''));
          box.appendChild(head);
          log.appendChild(box);
        }
      }
      log.appendChild(el('div', 'notice', T.chatRestored));
      scroll();
      break;
    }
    case 'state':
      stateData = { model: e.model || '', source: e.source || '',
                    models: e.models || [], sources: e.sources || [],
                    efforts: e.efforts || [], connectable: e.connectable || [],
                    securities: e.securities || [], security: e.security || '',
                    user: e.user || '', effort: e.effort || '', maxIter: e.max_iter || 0 };
      renderStatus();
      // redraw whichever menu view is open with the hot data
      if (menuView === 'root') menuRoot();
      else if (menuView) menuList(menuView);
      break;
    case 'login_start':
      log.appendChild(el('div', 'notice',
        T.loginConfirm + (e.text || '') + T.loginCode + (e.id || '')));
      scroll();
      break;
    case 'login_done':
      log.appendChild(el('div', 'notice', T.signedIn + (e.text || '')));
      scroll();
      break;
    case 'notice': log.appendChild(el('div', 'notice', e.text || '')); scroll(); break;
    case 'error': log.appendChild(el('div', 'error', e.text || '')); scroll(); break;
    case 'agent_exit': {
      document.body.classList.remove('busy');
      stopTimer();
      const box = el('div', 'error', e.text || T.agentExited);
      const b = document.createElement('button');
      b.textContent = T.restartBtn;
      b.style.marginTop = '4px';
      b.onclick = () => { vscode.postMessage({ type: 'restart' }); box.remove(); };
      box.appendChild(document.createElement('br'));
      box.appendChild(b);
      log.appendChild(box);
      scroll();
      break;
    }
    case 'prefill':
      inp.value = (e.text || '') + inp.value;
      inp.focus();
      break;
  }
});
</script>
</body>
</html>`;
}
