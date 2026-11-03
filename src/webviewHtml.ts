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
//
// The same page also runs in a browser, served by `execai ui` (browserHtml):
// there it talks to window.execaiHost (browserHost.ts) instead of
// acquireVsCodeApi(), gets defaults for the --vscode-* variables, a header in
// place of the status bar, and hides what only an editor can do (open a file,
// a terminal, restart the agent).

import * as vscode from 'vscode';
import { renderMarkdown } from './markdown';
import { inboxMenuEntries, fleetView } from './panelLogic';
import { PAYMENT_URL } from './protocol';

export type ChatLang = 'en' | 'ru';

/** Exported for the unit test that keeps the bundles in key parity. */
export const STRINGS: Record<ChatLang, Record<string, string>> = {
  en: {
    empty: 'Describe a task — the agent works right inside your project folder.\nThe active file and selection are attached automatically (execai.attachContext setting).\nFiles: hold Shift to drag them here, paste with Ctrl+V, or use the + button.',
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
    mSubagentIter: 'Subagent steps',
    mLogout: 'Sign out of ExecAI',
    mLogin: 'Sign in to ExecAI',
    loginNone: 'not signed in',
    mNewChat: 'New chat',
    mRestart: 'Restart the agent',
    mTerminal: 'Open execai in a terminal',
    mCheckUpdates: 'Check for Studio updates',
    tabBusy: 'the agent is working here',
    tabUnseen: 'finished — not read yet',
    tabAsk: 'waiting for your answer',
    tabWake: 'will wake up at ',
    wakeNotice: 'will wake up at ',
    wakeNow: 'Now',
    wakeCancel: 'Cancel',
    wakeCancelled: 'Wake-up cancelled.',
    autoTurn: 'woke up: ',
    queued: 'Queued — other chats are still answering.',
    copy: 'copy',
    copied: 'copied ✓',
    copyMsg: 'copy the answer',
    newTabTitle: 'New chat',
    closeTab: 'Close the tab (the chat stays in history)',
    untitledChat: 'New chat',
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
    loginConfirm: 'Confirm the sign-in in a browser',
    loginCode: '  ·  code ',
    loginCopy: 'copy the link',
    loginCopied: 'copied ✓',
    signedIn: 'Signed in: ',
    agentExited: 'The agent exited.',
    restartBtn: 'Restart',
    inboxListening: 'Tasks from the web: accepted in this window',
    inboxOtherServe: 'Tasks from the web are accepted by the background execai serve',
    inboxTake: 'Accept here',
    inboxOtherIde: 'Tasks from the web are accepted by another window: ',
    inboxNoPlan: 'Running tasks from the web is available on the Work and Max plans',
    inboxPlans: 'Choose a plan',
    inboxDisabled: 'Accepting tasks from the web is turned off',
    inboxNotLoggedIn: 'Sign in to accept tasks from the web',
    mProject: 'Project',
    projectNone: 'not bound',
    mUnbind: 'Unbind the project',
    tabWeb: 'a task from the web',
    webTurn: 'From the web: ',
    askResolved: 'Answered on the web — the question is closed.',
    askCancelled: 'The question was withdrawn.',
    agentsHead: 'Agents',
    agentsRunning: '{n} running',
    agentsDone: '{n} done',
    agentsFailed: '{n} failed',
    agentsToggle: 'Subagents — click to fold or unfold',
    agentStop: 'Stop',
    agentStopTitle: 'Stop this subagent',
    agentMore: '+25',
    agentMoreTitle: 'Give this agent 25 more steps',
    agentContinue: 'Continue (+25)',
    agentContinueTitle: 'The agent hit its step limit — continue from where it stopped for 25 more steps',
    agentOpenTitle: 'Click to open what it has done (read-only)',
    agSteps: 'step {i}/{m} · {n} left',
    agExhausted: 'hit the step limit',
    agQueued: 'queued',
    agRunning: 'working',
    agWaiting: 'waiting for your answer',
    agDone: 'done',
    agFailed: 'failed',
    agCancelled: 'stopped',
    agTokens: 'tokens',
    tabAgents: 'subagents at work',
    agentTab: 'a subagent — read-only',
    agentReadOnly: 'Read-only: what the subagent has done so far.',
    agentBack: 'Back to the chat',
    askFromAgent: 'Subagent: ',
  },
  ru: {
    empty: 'Опиши задачу — агент работает прямо в папке проекта.\nАктивный файл и выделение прикладываются автоматически (настройка execai.attachContext).\nФайлы: перетаскивай сюда с зажатым Shift, вставляй Ctrl+V или кнопкой +.',
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
    mSubagentIter: 'Шагов субагенту',
    mLogout: 'Выйти из ExecAI',
    mLogin: 'Войти в ExecAI',
    loginNone: 'не выполнен',
    mNewChat: 'Новый чат',
    mRestart: 'Перезапустить агента',
    mTerminal: 'Открыть execai в терминале',
    mCheckUpdates: 'Проверить обновления Studio',
    tabBusy: 'агент работает здесь',
    tabUnseen: 'закончил — ещё не прочитано',
    tabAsk: 'ждёт твоего ответа',
    tabWake: 'проснётся в ',
    wakeNotice: 'проснётся в ',
    wakeNow: 'Сейчас',
    wakeCancel: 'Отменить',
    wakeCancelled: 'Пробуждение отменено.',
    autoTurn: 'проснулся: ',
    queued: 'В очереди — другие чаты ещё отвечают.',
    copy: 'копировать',
    copied: 'скопировано ✓',
    copyMsg: 'копировать ответ',
    newTabTitle: 'Новый чат',
    closeTab: 'Закрыть вкладку (чат останется в истории)',
    untitledChat: 'Новый чат',
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
    loginConfirm: 'Подтверди вход в браузере',
    loginCode: '  ·  код ',
    loginCopy: 'скопировать ссылку',
    loginCopied: 'скопировано ✓',
    signedIn: 'Вошли: ',
    agentExited: 'Агент завершился.',
    restartBtn: 'Перезапустить',
    inboxListening: 'Задачи с сайта: принимает это окно',
    inboxOtherServe: 'Задачи с сайта принимает фоновый процесс execai serve',
    inboxTake: 'Принимать здесь',
    inboxOtherIde: 'Задачи с сайта принимает другое окно: ',
    inboxNoPlan: 'Запуск задач с сайта доступен на тарифах «Работа» и «Макс»',
    inboxPlans: 'Выбрать тариф',
    inboxDisabled: 'Приём задач с сайта выключен',
    inboxNotLoggedIn: 'Войти, чтобы принимать задачи с сайта',
    mProject: 'Проект',
    projectNone: 'не привязан',
    mUnbind: 'Отвязать проект',
    tabWeb: 'задача с сайта',
    webTurn: 'С сайта: ',
    askResolved: 'Ответили на сайте — вопрос закрыт.',
    askCancelled: 'Вопрос снят.',
    agentsHead: 'Агенты',
    agentsRunning: 'работают: {n}',
    agentsDone: 'готово: {n}',
    agentsFailed: 'с ошибкой: {n}',
    agentsToggle: 'Субагенты — клик, чтобы свернуть или развернуть',
    agentStop: 'Остановить',
    agentStopTitle: 'Остановить этого субагента',
    agentMore: '+25',
    agentMoreTitle: 'Дать агенту ещё 25 шагов',
    agentContinue: 'Продолжить (+25)',
    agentContinueTitle: 'Агент упёрся в предел шагов — продолжить с того же места ещё на 25 шагов',
    agentOpenTitle: 'Клик — открыть наработанное (только чтение)',
    agSteps: 'шаг {i}/{m} · ещё {n}',
    agExhausted: 'упёрся в предел шагов',
    agQueued: 'в очереди',
    agRunning: 'работает',
    agWaiting: 'ждёт твоего ответа',
    agDone: 'готово',
    agFailed: 'ошибка',
    agCancelled: 'остановлен',
    agTokens: 'токенов',
    tabAgents: 'работают субагенты',
    agentTab: 'субагент — только чтение',
    agentReadOnly: 'Только чтение: что субагент успел сделать.',
    agentBack: 'Вернуться в чат',
    askFromAgent: 'Субагент: ',
  },
};

/** Maps a VS Code display language (`ru`, `ru-RU`) onto a bundle we ship. */
export function pickLang(code?: string): ChatLang {
  return (code || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** The chat page for the VS Code webview. */
export function chatHtml(_webview: vscode.Webview, _extensionUri: vscode.Uri, lang?: string): string {
  return panelPage(pickLang(lang), { nonce: String(Math.random()).slice(2) });
}

/** Placeholders `execai ui` fills in when it serves the browser page. */
export const NONCE_SLOT = '{{NONCE}}';
export const CONFIG_SLOT = '{{CONFIG}}';

/**
 * The same chat page for a browser, as `execai ui` serves it
 * (dist/panel-browser.<lang>.html, built by `npm run build:panel`).
 *
 * hostJs is the bundled browserHost.ts; l10n is the translation table of the
 * extension host strings (l10n/bundle.l10n.<lang>.json), which PanelCore
 * needs in the page. The server replaces every {{NONCE}} with a fresh nonce
 * and {{CONFIG}} — a JavaScript literal inside the host script — with JSON
 * {lang, cwd, version, upload} (<, >, & and ' escaped as \u…).
 */
export function browserHtml(lang: string | undefined, hostJs: string, l10n: Record<string, string> = {}): string {
  return panelPage(pickLang(lang), { nonce: NONCE_SLOT, browser: { hostJs, l10n } });
}

/** Text for an inline <script>: nothing in it may close the tag early. */
function inlineSafe(js: string): string {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

/**
 * Defaults for the editor theme variables in a browser, [light, dark] —
 * VS Code's Light Modern and Dark Modern. A webview gets these from the
 * editor; a plain browser tab has none, and every colour would fall through.
 */
const THEME_DEFAULTS: Record<string, [string, string]> = {
  'foreground': ['#3b3b3b', '#cccccc'],
  'descriptionForeground': ['#6f6f6f', '#9d9d9d'],
  'errorForeground': ['#c72e0f', '#f85149'],
  'sideBar-background': ['#f8f8f8', '#181818'],
  'editor-background': ['#ffffff', '#1f1f1f'],
  'panel-border': ['#e5e5e5', '#2b2b2b'],
  'focusBorder': ['#005fb8', '#0078d4'],
  'list-hoverBackground': ['#f0f0f0', '#2a2d2e'],
  'input-background': ['#ffffff', '#313131'],
  'input-border': ['#cecece', '#3c3c3c'],
  'input-foreground': ['#3b3b3b', '#cccccc'],
  'button-background': ['#005fb8', '#0078d4'],
  'button-foreground': ['#ffffff', '#ffffff'],
  'button-hoverBackground': ['#0258a8', '#026ec1'],
  'button-border': ['#0000001a', '#ffffff12'],
  'button-secondaryBackground': ['#e5e5e5', '#313131'],
  'button-secondaryForeground': ['#3b3b3b', '#cccccc'],
  'badge-background': ['#cccccc', '#616161'],
  'badge-foreground': ['#3b3b3b', '#f8f8f8'],
  'textLink-foreground': ['#005fb8', '#4daafc'],
  'textCodeBlock-background': ['#f2f2f2', '#2b2b2b'],
  'progressBar-background': ['#005fb8', '#0078d4'],
  'inputValidation-warningBorder': ['#b89500', '#b89500'],
  'editorWarning-foreground': ['#bf8803', '#cca700'],
  'toolbar-hoverBackground': ['#b8b8b850', '#5a5d5e50'],
  'scrollbarSlider-background': ['#64646466', '#79797966'],
  'scrollbarSlider-hoverBackground': ['#646464b3', '#646464b3'],
  'tab-activeBackground': ['#ffffff', '#1f1f1f'],
  'tab-activeForeground': ['#3b3b3b', '#ffffff'],
  'tab-inactiveBackground': ['#f8f8f8', '#181818'],
  'tab-inactiveForeground': ['#868686', '#9d9d9d'],
  'editorGroupHeader-tabsBackground': ['#f8f8f8', '#181818'],
  'menu-background': ['#ffffff', '#1f1f1f'],
  'menu-foreground': ['#3b3b3b', '#cccccc'],
  'menu-border': ['#cecece', '#454545'],
  'menu-selectionBackground': ['#005fb8', '#0078d4'],
  'menu-selectionForeground': ['#ffffff', '#ffffff'],
  'menu-separatorBackground': ['#d4d4d4', '#454545'],
  'charts-green': ['#388a34', '#89d185'],
};
const FONT_DEFAULTS: Record<string, string> = {
  'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif',
  'editor-font-family': 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
};

/** The browser-only stylesheet: theme defaults, the header, toasts, dialogs. */
function browserCss(): string {
  const vars = (i: 0 | 1) => Object.entries(THEME_DEFAULTS)
    .map(([k, v]) => `    --vscode-${k}: ${v[i]};`).join('\n');
  const fonts = Object.entries(FONT_DEFAULTS).map(([k, v]) => `    --vscode-${k}: ${v};`).join('\n');
  return `
  /* ── browser page (execai ui): the editor theme is not there, so its
     variables get defaults — light or dark after the system setting. */
  :root {
${fonts}
${vars(0)}
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
  :root {
${vars(1)}
  }
  }
  html { background: var(--vscode-sideBar-background); }
  body.browser { max-width: 920px; margin: 0 auto;
    border-left: 1px solid var(--vscode-panel-border); border-right: 1px solid var(--vscode-panel-border); }
  #hdr { display: flex; gap: 8px; align-items: center; padding: 6px 10px; font-size: 12px;
    color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); }
  #hdr .hdr-status { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--vscode-foreground); }
  #hdr .hdr-where { min-width: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #hdr .hdr-conn:empty { display: none; }
  #hdr .hdr-conn { color: var(--vscode-inputValidation-warningBorder); white-space: nowrap; }
  #hdr button { font: inherit; cursor: pointer; border: none; border-radius: 4px; padding: 1px 6px;
    background: transparent; color: inherit; }
  #hdr button:hover { background: var(--vscode-toolbar-hoverBackground); }
  #toasts { display: flex; flex-direction: column; gap: 4px; padding: 0 8px; }
  #toasts:empty { display: none; }
  .toast { display: flex; gap: 8px; align-items: center; margin-top: 6px; padding: 6px 9px;
    border-radius: 6px; font-size: 12px; animation: exIn 160ms ease-out;
    background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); }
  .toast.warn { border-color: var(--vscode-inputValidation-warningBorder); }
  .toast span { flex: 1; min-width: 0; word-break: break-word; }
  .toast button { font: inherit; font-size: 11.5px; cursor: pointer; padding: 2px 9px; border-radius: 4px;
    border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background);
    color: var(--vscode-button-foreground); }
  .toast i { font-style: normal; cursor: pointer; opacity: .6; padding: 0 3px; }
  .toast i:hover { opacity: 1; }
  #dlg { display: none; position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.35);
    align-items: flex-start; justify-content: center; padding: 12vh 16px 0; }
  #dlg.open { display: flex; }
  .dlg-box { width: 100%; max-width: 480px; padding: 12px; border-radius: 8px;
    background: var(--vscode-menu-background); color: var(--vscode-menu-foreground);
    border: 1px solid var(--vscode-menu-border); box-shadow: 0 8px 28px rgba(0,0,0,.35); }
  .dlg-title { font-weight: 600; margin-bottom: 6px; }
  .dlg-prompt { color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 8px; }
  .dlg-input { width: 100%; padding: 6px 8px; font: inherit; border-radius: 4px; outline: none;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border); }
  .dlg-input:focus { border-color: var(--vscode-focusBorder); }
  .dlg-err { color: var(--vscode-errorForeground); font-size: 11.5px; min-height: 16px; margin-top: 4px; }
  .dlg-list { display: flex; flex-direction: column; gap: 3px; max-height: 50vh; overflow-y: auto; }
  .dlg-item { text-align: left; padding: 6px 9px; border-radius: 5px; cursor: pointer; font: inherit;
    color: inherit; background: transparent; border: 1px solid var(--vscode-panel-border); }
  .dlg-item:hover, .dlg-item:focus { background: var(--vscode-list-hoverBackground); outline: none; }
  .dlg-item small { margin-left: 6px; color: var(--vscode-descriptionForeground); }
  .dlg-detail { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  .dlg-btns { display: flex; gap: 6px; justify-content: flex-end; margin-top: 10px; }
  .dlg-btns button { padding: 4px 12px; border-radius: 4px; cursor: pointer; font: inherit;
    border: 1px solid var(--vscode-button-border); background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground); }
  .dlg-btns button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  /* No editor to open a file in: paths in answers are plain text here. */
  body.browser .assistant a[data-file] { cursor: text; color: inherit; text-decoration: none; }
  body.browser .files span { cursor: default; }
`;
}

function panelPage(code: ChatLang, o: { nonce: string; browser?: { hostJs: string; l10n: Record<string, string> } }): string {
  const nonce = o.nonce;
  const browser = !!o.browser;
  // Исходник рендерера уезжает в панель как есть: так у панели и у тестов
  // одна и та же реализация, и разойтись они не могут.
  const mdSource = renderMarkdown.toString();
  const inboxSource = inboxMenuEntries.toString();
  const fleetSource = fleetView.toString();
  const T = STRINGS[code];
  const csp = browser
    ? `default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none';`
    : `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  return /* html */ `<!DOCTYPE html>
<html lang="${code}">
<head>
<meta charset="UTF-8">${browser ? '\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>ExecAI</title>' : ''}
<meta http-equiv="Content-Security-Policy"
      content="${csp}">
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
  .login-link {
    display: block; margin: 5px 0; padding: 5px 7px; border-radius: 4px;
    font-family: var(--vscode-editor-font-family); font-size: 12px;
    background: var(--vscode-editor-background);
    user-select: all; word-break: break-all;
  }
  .login-copy {
    padding: 3px 8px; border-radius: 5px; cursor: pointer;
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground);
    border: 1px solid var(--vscode-panel-border);
  }
  .login-copy:hover { background: var(--vscode-list-hoverBackground); }
  /* Chat tabs — the way an editor shows open documents: what exists, what is
     current, one click to switch. The panel is narrow, so they scroll. */
  #tabs {
    display: flex; align-items: stretch; gap: 2px;
    overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background));
  }
  #tabs:empty { display: none; }
  #tabs::-webkit-scrollbar { height: 3px; }
  #tabs::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); }
  #tabs::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
  #tabs .tab { flex: 0 0 auto; }
  #tabs .tab {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 8px; max-width: 160px; cursor: pointer;
    font-size: 11.5px; white-space: nowrap;
    color: var(--vscode-tab-inactiveForeground, var(--vscode-descriptionForeground));
    background: var(--vscode-tab-inactiveBackground, transparent);
    border-right: 1px solid var(--vscode-panel-border);
    border-top: 1px solid transparent;
  }
  #tabs .tab span { overflow: hidden; text-overflow: ellipsis; }
  #tabs .tab i {
    font-style: normal; opacity: 0; cursor: pointer; padding: 0 2px;
    border-radius: 3px; line-height: 1;
  }
  #tabs .tab:hover i, #tabs .tab.active i { opacity: .6; }
  /* Tab badges: what a chat you are not looking at is doing. */
  #tabs .tab b { font-weight: normal; font-size: 10px; line-height: 1; flex: 0 0 auto; }
  #tabs .tab b.busy { width: 7px; height: 7px; border-radius: 50%;
    background: var(--vscode-progressBar-background, #0078d4); animation: exPulse 1.2s ease-in-out infinite; }
  #tabs .tab b.unseen { width: 7px; height: 7px; border-radius: 50%; background: var(--vscode-charts-green, #3fb950); }
  /* b.ask also matches the question box rule .ask (border, padding): undo it. */
  #tabs .tab b.ask { color: var(--vscode-inputValidation-warningBorder, #b89500); font-weight: bold;
    border: none; border-radius: 0; padding: 0; margin: 0; animation: none; }
  #tabs .tab b.wake { opacity: .8; }
  /* Origin, not state: a chat started by a task from the site. */
  #tabs .tab b.web { opacity: .85; }
  @keyframes exPulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
  .wake { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .wake button { font: inherit; font-size: 11px; padding: 1px 8px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .msg.user.auto { opacity: .85; font-style: italic; }
  #tabs .tab i:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground)); }
  #tabs .tab.dragging { opacity: .5; }
  #tabs .tab.dropbefore { box-shadow: inset 2px 0 0 var(--vscode-focusBorder); }
  #tabs .tab:hover { background: var(--vscode-list-hoverBackground); }
  #tabs .tab.active {
    color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
    background: var(--vscode-tab-activeBackground, var(--vscode-editor-background));
    border-top-color: var(--vscode-focusBorder);
  }
  #tabs .newtab {
    padding: 4px 9px; cursor: pointer; border: none; background: none;
    color: var(--vscode-descriptionForeground); font-size: 13px; line-height: 1;
  }
  #tabs .newtab:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
  /* Copy buttons: on a code block and on the answer as a whole. Hidden until
     the pointer is on the block — the chat is for reading, not for buttons. */
  .codewrap { position: relative; }
  .codewrap .copy, .msg.assistant > .copy-msg {
    position: absolute; top: 4px; right: 4px; z-index: 1;
    padding: 2px 7px; border-radius: 4px; cursor: pointer;
    font-size: 10.5px; line-height: 1.5;
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground);
    border: 1px solid var(--vscode-panel-border);
    opacity: 0; transition: opacity 120ms ease;
  }
  .msg.assistant { position: relative; }
  .msg.assistant > .copy-msg { top: 0; right: 0; }
  .codewrap:hover .copy, .msg.assistant:hover > .copy-msg { opacity: .85; }
  .codewrap .copy:hover, .msg.assistant > .copy-msg:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .assistant a[data-file] { cursor: pointer; }
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
  .ctxline {
    margin-top: 5px; font-size: 11px;
    color: var(--vscode-descriptionForeground);
    word-break: break-all;
  }
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
  /* Inbox status line: text to read, clickable only when it is an action. */
  #menu .mi.info { cursor: default; white-space: normal; word-break: break-word;
                   color: var(--vscode-descriptionForeground); }
  #menu .mi.info:not(.act):hover { background: none; color: var(--vscode-descriptionForeground); }
  #menu .mi.info.act { cursor: pointer; color: inherit; }
  #menu .sep { height: 1px; margin: 4px 2px;
               background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border)); }
  #menu .head { display: flex; gap: 6px; align-items: center; padding: 4px 6px 6px;
                color: var(--vscode-descriptionForeground); font-size: 11px; }
  #menu .head span { cursor: pointer; }
  #menu .head span:hover { color: var(--vscode-foreground); }

  /* ── subagents (E101): who is doing what, right above the composer. ── */
  #agents { display: none; border-top: 1px solid var(--vscode-panel-border); font-size: 11.5px; }
  #agents.on { display: block; }
  #agents .ag-head { display: flex; gap: 5px; align-items: center; padding: 4px 9px;
    cursor: pointer; user-select: none; color: var(--vscode-descriptionForeground); }
  #agents .ag-head:hover { color: var(--vscode-foreground); }
  #agents .ag-caret { width: 10px; }
  #agents .ag-list { max-height: 140px; overflow-y: auto; padding: 0 4px 4px; }
  #agents .ag-row { display: flex; gap: 6px; align-items: center; padding: 3px 5px;
    border-radius: 5px; cursor: pointer; }
  #agents .ag-row:hover, #agents .ag-row.on { background: var(--vscode-list-hoverBackground); }
  #agents .ag-st { width: 14px; flex: 0 0 auto; text-align: center; }
  #agents .ag-row[data-state="running"] .ag-st { color: var(--vscode-progressBar-background, #0078d4);
    animation: exPulse 1.4s ease-in-out infinite; }
  #agents .ag-row[data-state="waiting"] .ag-st { color: var(--vscode-inputValidation-warningBorder, #b89500); font-weight: bold; }
  #agents .ag-row[data-state="done"] .ag-st { color: var(--vscode-charts-green, #3fb950); }
  #agents .ag-row[data-state="failed"] .ag-st { color: var(--vscode-errorForeground); }
  #agents .ag-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #agents .ag-meta { flex: 0 1 auto; min-width: 0; max-width: 55%; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; }
  /* Few steps left, or none: the agent may stop before it is done. */
  #agents .ag-meta.warn { color: var(--vscode-editorWarning-foreground, #b89500); }
  #agents .ag-stop, #agents .ag-more { flex: 0 0 auto; font: inherit; font-size: 10.5px; padding: 1px 7px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  #agents .ag-stop:disabled, #agents .ag-more:disabled { opacity: .5; cursor: default; }
  #tabs .tab b.agents { opacity: .85; font-variant-numeric: tabular-nums; }
  #tabs .tab.agent span { font-style: italic; }
  /* A subagent's transcript is read-only: no input, a way back instead. */
  #ro { display: none; gap: 8px; align-items: center; font-size: 11.5px; padding: 2px 2px 4px;
    color: var(--vscode-descriptionForeground); }
  #ro span { flex: 1; }
  #ro button { font: inherit; font-size: 11px; padding: 1px 9px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  body.agentview #ro { display: flex; }
  body.agentview #box, body.agentview #chips { display: none; }
  .ask-agent { font-size: 11px; margin-bottom: 4px; cursor: pointer; color: var(--vscode-descriptionForeground); }
  .ask-agent:hover { color: var(--vscode-foreground); }
  @media (prefers-reduced-motion: reduce) {
    #agents .ag-row[data-state="running"] .ag-st { animation: none; }
  }
${browser ? browserCss() : ''}</style>
</head>
<body${browser ? ' class="browser"' : ''}>${browser ? `
  <div id="hdr"></div>
  <div id="toasts"></div>` : ''}
  <div id="tabs"></div>
  <div id="log">
    <div id="empty">${T.empty}</div>
  </div>
  <div id="agents"></div>
  <div id="composer">
    <div id="menu"></div>
    <div id="status" title="${T.statusTitle}">…</div>
    <div id="ro"><span>${T.agentReadOnly}</span><button id="roBack">${T.agentBack}</button></div>
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
${browser ? `  <div id="dlg"></div>
<script nonce="${nonce}">
window.execaiPage = ${inlineSafe(JSON.stringify({ T, l10n: o.browser!.l10n }))};
window.execaiPage.config = ${CONFIG_SLOT};
${inlineSafe(o.browser!.hostJs)}
</script>
` : ''}
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
// The inbox section of the menu (src/panelLogic.ts) — bound to a name for the
// same reason as renderMarkdown.
const inboxMenuEntries = ${inboxSource};
// The subagents block (src/panelLogic.ts), bound to a name the same way.
const fleetView = ${fleetSource};
const PAYMENT_URL = ${JSON.stringify(PAYMENT_URL)};
// In a browser (execai ui) the page talks to window.execaiHost, which plays
// the extension's part (browserHost.ts); what needs an editor is hidden.
const BROWSER = ${browser};
${browser ? 'const vscode = window.execaiHost;' : 'const vscode = acquireVsCodeApi();'}
const log = document.getElementById('log');
const inp = document.getElementById('inp');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const chipsBox = document.getElementById('chips');

let curAssistant = null;  // current answer block
let curThinking = null;   // current reasoning block
let tools = {};           // id → card elements
let asks = {};            // ask id → its box, so a question answered elsewhere can be taken back
let attached = [];        // [{path, label, thumb?}] — "+", drag&drop, paste
let isStudio = false;     // set by the extension inside ExecAI Studio
// Per-chat badges from the extension (busy / unseen / asking / wake / web).
let chatFlags = {};
// Who accepts tasks from the site. null — the agent never said (an older
// agent): then the menu has no inbox section and the panel looks as before.
let inboxData = null;
// Subagents (E101). The agent reports them as a full snapshot (agents). null —
// it never did (an older agent): no block, no badges, the panel as before.
let agentsData = null;
let agentsCollapsed = false;
let agentsTick = null;
let agentRowMeta = {};    // id → the meta span of its row, for the ticking duration
let agentsStopping = {};  // id → Stop pressed, the snapshot has not caught up yet
let viewAgent = null;     // the subagent whose transcript is on screen (read-only)
let viewAgentStamp = '';  // its updated_at as last loaded: a newer one reloads it
let agentReloading = false;
let pendingAgent = null;  // asked for with open_agent, not loaded yet
let agentTabs = [];       // [{id, title}] — subagent tabs on the strip
let shownChat = null;     // the chat the log shows, or showed before a subagent
// A chat started by a task from the site: the agent tags it in the chat list,
// the extension also learns it from turn_start and passes it on as a flag.
function isWebChat(id) {
  if (!id) return false;
  if (chatFlags[id] && chatFlags[id].web) return true;
  return chatsData.some(c => c.id === id && c.origin === 'web');
}
function clock(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
// A line under the log about a scheduled wake-up, with Now / Cancel.
function wakeLine(at, reason) {
  const w = el('div', 'notice wake');
  w.appendChild(el('span', '', '\u{1F319} ' + T.wakeNotice + clock(at) + (reason ? ' \u2014 ' + reason : '')));
  const now = el('button', '', T.wakeNow);
  now.onclick = () => vscode.postMessage({ type: 'agent_command', name: 'wake_now', value: '' });
  const cancel = el('button', '', T.wakeCancel);
  cancel.onclick = () => vscode.postMessage({ type: 'agent_command', name: 'cancel_wakeup', value: '' });
  w.appendChild(now); w.appendChild(cancel);
  return w;
}

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

const tabs = document.getElementById('tabs');

// Chat tabs. The list comes from the agent (one entry per chat of this
// project, with the current one flagged); the strip is redrawn whole because
// it is a handful of nodes and diffing them would cost more than it saves.
// Which chats sit on the strip, and in what order, belongs to the panel — not
// to the agent. Closing a tab is a view action: the chat stays in history, a
// turn in flight keeps running, and opening it from history brings it back.
let tabsHidden = [];
let tabsOrder = [];
function saveTabs() {
  const st = { hidden: tabsHidden, order: tabsOrder };
  if (agentsCollapsed) st.agents_collapsed = true;
  vscode.postMessage({ type: 'tabs_state', text: JSON.stringify(st) });
}
// The agent lists chats by last-modified, and switching chats saves the one
// you are leaving — so its list reshuffles on every click. Tabs must not: the
// strip keeps the order a chat first appeared in (or the one you dragged it
// to), exactly like editor tabs. New chats are appended at the end.
function rememberOrder() {
  let added = false;
  for (const c of chatsData) {
    if (tabsOrder.indexOf(c.id) < 0) { tabsOrder.push(c.id); added = true; }
  }
  // Forget ids that no longer exist, so the list cannot grow without bound.
  const alive = chatsData.map(c => c.id);
  const before = tabsOrder.length;
  tabsOrder = tabsOrder.filter(id => alive.indexOf(id) >= 0);
  if (added || tabsOrder.length !== before) saveTabs();
}
function visibleChats() {
  const pos = (id) => { const i = tabsOrder.indexOf(id); return i < 0 ? 1e6 : i; };
  return chatsData.filter(c => tabsHidden.indexOf(c.id) < 0).slice()
    .sort((a, b) => pos(a.id) - pos(b.id));
}
function renderTabs() {
  rememberOrder();
  tabs.innerHTML = '';
  const list = visibleChats();
  if (!list.length && !agentTabs.length) return; // nothing to switch between — no empty strip
  // Subagents still going, per parent chat: "2▶" on the parent's tab.
  const going = agentsData ? fleetView(agentsData, Date.now(), T).perChat : {};
  for (const c of list) {
    // While a subagent is on screen, no chat tab is the current one.
    const current = c.active && !viewAgent;
    const t = el('div', 'tab' + (current ? ' active' : ''));
    const label = (c.label || '').trim() || T.untitledChat;
    t.title = label;
    t.draggable = true;
    t.dataset.chat = c.id;
    const f = Object.assign({}, c.busy ? { busy: true } : {}, c.wake ? { wake: c.wake } : {}, chatFlags[c.id] || {});
    if (c.origin === 'web' || f.web) { const b = el('b', 'web', '\u{1F310}'); b.title = T.tabWeb; t.appendChild(b); }
    t.appendChild(el('span', '', label));
    if (going[c.id]) { const b = el('b', 'agents', going[c.id] + '\u25b6'); b.title = T.tabAgents; t.appendChild(b); }
    if (f.asking) { const b = el('b', 'ask', '?'); b.title = T.tabAsk; t.appendChild(b); }
    else if (f.busy) { const b = el('b', 'busy', ''); b.title = T.tabBusy; t.appendChild(b); }
    else if (f.unseen && !c.active) { const b = el('b', 'unseen', ''); b.title = T.tabUnseen; t.appendChild(b); }
    if (f.wake) { const b = el('b', 'wake', '\u23f0'); b.title = T.tabWake + clock(f.wake); t.appendChild(b); }
    const x = el('i', '', '\u00d7');
    x.title = T.closeTab;
    const close = (e) => {
      if (e) e.stopPropagation();
      if (tabsHidden.indexOf(c.id) < 0) tabsHidden.push(c.id);
      saveTabs();
      renderTabs();
    };
    x.onclick = close;
    t.appendChild(x);
    t.onclick = () => {
      if (current) return;
      vscode.postMessage({ type: 'agent_command', name: 'load_chat', value: c.id });
    };
    // Middle click closes, the way it does on editor tabs.
    t.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); close(e); } };
    t.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', c.id);
      t.classList.add('dragging');
    };
    t.ondragend = () => {
      t.classList.remove('dragging');
      for (const n of tabs.children) n.classList.remove('dropbefore');
    };
    t.ondragover = (e) => { e.preventDefault(); t.classList.add('dropbefore'); };
    t.ondragleave = () => t.classList.remove('dropbefore');
    t.ondrop = (e) => {
      e.preventDefault();
      t.classList.remove('dropbefore');
      const moved = e.dataTransfer.getData('text/plain');
      if (!moved || moved === c.id) return;
      const ids = visibleChats().map(v => v.id).filter(id => id !== moved);
      const at = ids.indexOf(c.id);
      ids.splice(at < 0 ? ids.length : at, 0, moved);
      tabsOrder = ids;
      saveTabs();
      renderTabs();
    };
    tabs.appendChild(t);
  }
  // Subagent tabs: a transcript to read, opened from the Agents block.
  for (const a of agentTabs) {
    const t = el('div', 'tab agent' + (a.id === viewAgent ? ' active' : ''));
    t.title = T.agentTab;
    t.dataset.agent = a.id;
    const bot = el('b', 'bot', '\u{1F916}');
    bot.title = T.agentTab;
    t.appendChild(bot);
    t.appendChild(el('span', '', a.title || a.id));
    const r = agentRecord(a.id);
    if (r && r.state === 'waiting') { const b = el('b', 'ask', '?'); b.title = T.agWaiting; t.appendChild(b); }
    else if (r && (r.state === 'running' || r.state === 'queued')) { const b = el('b', 'busy', ''); b.title = T.agRunning; t.appendChild(b); }
    const x = el('i', '', '\u00d7');
    x.title = T.closeTab;
    x.onclick = (e) => {
      if (e) e.stopPropagation();
      agentTabs = agentTabs.filter(v => v.id !== a.id);
      if (a.id === viewAgent || a.id === pendingAgent) { pendingAgent = null; backToChat(); }
      renderTabs();
    };
    t.appendChild(x);
    t.onclick = () => { if (a.id !== viewAgent) openAgent(a.id, a.title); };
    tabs.appendChild(t);
  }
  const plus = el('button', 'newtab', '+');
  plus.title = T.newTabTitle;
  plus.onclick = () => vscode.postMessage({ type: 'new_chat_ui' });
  tabs.appendChild(plus);
  // The strip is narrower than the tabs almost immediately — keep the current
  // chat visible instead of leaving the user to scroll for it.
  const act = tabs.querySelector('.tab.active');
  if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// A vertical wheel over a horizontal strip does nothing by default; here it is
// the only way to reach tabs that do not fit.
tabs.addEventListener('wheel', (e) => {
  if (e.deltaY === 0 || tabs.scrollWidth <= tabs.clientWidth) return;
  tabs.scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });
function refreshTabs() { vscode.postMessage({ type: 'agent_command', name: 'list_chats' }); }

// ── subagents (E101) ──
// The Agents block over the composer: one row per subagent — state, title,
// iteration, last tool, how long it has run — and Stop while it goes. A click
// opens its transcript in a read-only tab; the agent pushes a fresh snapshot
// on every change, so the block is redrawn whole.
const agentsBox = document.getElementById('agents');
function agentRecord(id) {
  return (agentsData || []).find(a => a && a.id === id) || null;
}
function agentStateLabel(st) {
  const m = { queued: T.agQueued, running: T.agRunning, waiting: T.agWaiting,
              done: T.agDone, failed: T.agFailed, cancelled: T.agCancelled };
  return m[st] || st || '';
}
function renderAgents() {
  const v = fleetView(agentsData, Date.now(), T);
  agentsBox.innerHTML = '';
  agentRowMeta = {};
  if (!v.rows.length) {
    agentsBox.classList.remove('on');
    if (agentsTick) { clearInterval(agentsTick); agentsTick = null; }
    return;
  }
  agentsBox.classList.add('on');
  const head = el('div', 'ag-head');
  head.title = T.agentsToggle;
  head.appendChild(el('span', 'ag-caret', agentsCollapsed ? '\u25b8' : '\u25be'));
  let sum = T.agentsHead;
  if (v.running) sum += ' \u00b7 ' + T.agentsRunning.replace('{n}', v.running);
  if (v.done) sum += ' \u00b7 ' + T.agentsDone.replace('{n}', v.done);
  if (v.failed) sum += ' \u00b7 ' + T.agentsFailed.replace('{n}', v.failed);
  head.appendChild(el('span', 'ag-sum', sum));
  head.onclick = () => {
    agentsCollapsed = !agentsCollapsed;
    saveTabs();
    renderAgents();
    if (!agentsCollapsed) vscode.postMessage({ type: 'agent_command', name: 'list_agents' });
  };
  agentsBox.appendChild(head);
  if (!agentsCollapsed) {
    const list = el('div', 'ag-list');
    for (const r of v.rows) {
      const row = el('div', 'ag-row' + (r.id === viewAgent ? ' on' : ''));
      row.setAttribute('data-agent', r.id);
      row.setAttribute('data-state', r.state);
      row.title = r.tip + '\\n' + T.agentOpenTitle;
      row.appendChild(el('span', 'ag-st', r.icon));
      row.appendChild(el('span', 'ag-title', r.title));
      const meta = el('span', 'ag-meta' + (r.low || r.exhausted ? ' warn' : ''), r.meta);
      row.appendChild(meta);
      agentRowMeta[r.id] = meta;
      // +25 needs an agent that knows extend_agent: it is the one that reports
      // subagent_iter in its state. exhausted alone is proof enough.
      if (r.active && stateData.subagentIter) row.appendChild(agentMoreBtn(r.id, T.agentMore, T.agentMoreTitle));
      if (r.exhausted) row.appendChild(agentMoreBtn(r.id, T.agentContinue, T.agentContinueTitle));
      if (r.active) {
        const b = el('button', 'ag-stop', T.agentStop);
        b.title = T.agentStopTitle;
        if (agentsStopping[r.id]) b.disabled = true;
        b.onclick = (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          agentsStopping[r.id] = true;
          b.disabled = true;
          vscode.postMessage({ type: 'agent_command', name: 'stop_agent', value: r.id });
        };
        row.appendChild(b);
      }
      row.onclick = () => openAgent(r.id, r.title);
      list.appendChild(row);
    }
    agentsBox.appendChild(list);
  }
  // Durations tick while something runs. Only the text changes: rebuilding
  // the rows every second would swallow a click landing mid-rebuild.
  if (v.running && !agentsTick) agentsTick = setInterval(tickAgents, 1000);
  else if (!v.running && agentsTick) { clearInterval(agentsTick); agentsTick = null; }
}
// More steps for a subagent: +25 while it goes, or a continuation of one that
// hit its limit — both are extend_agent. The agent answers with a notice and a
// fresh snapshot; until then a second click would give twice as much.
function agentMoreBtn(id, label, title) {
  const b = el('button', 'ag-more', label);
  b.title = title;
  if (agentsStopping[id]) b.disabled = true;
  b.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    b.disabled = true;
    setTimeout(() => { b.disabled = !!agentsStopping[id]; }, 1500);
    vscode.postMessage({ type: 'agent_command', name: 'extend_agent', value: id });
  };
  return b;
}
function tickAgents() {
  for (const r of fleetView(agentsData, Date.now(), T).rows) {
    const m = agentRowMeta[r.id];
    if (m) m.textContent = r.meta;
  }
}
// Opens a subagent's transcript: a tab of its own, filled by agent_loaded.
function openAgent(id, title) {
  if (!id) return;
  closeMenu();
  const known = agentTabs.find(a => a.id === id);
  if (known) { if (title) known.title = title; }
  else agentTabs.push({ id, title: title || id });
  pendingAgent = id;
  vscode.postMessage({ type: 'agent_command', name: 'open_agent', value: id });
  renderTabs();
}
function leaveAgentView() {
  const was = viewAgent || pendingAgent;
  viewAgent = null; pendingAgent = null; viewAgentStamp = ''; agentReloading = false;
  document.body.classList.remove('agentview');
  // The chat tab is the current one again — at once, not when the list comes.
  if (was) { renderTabs(); renderAgents(); }
}
// From a transcript back to the chat that was on screen; the view switches
// when chat_loaded arrives.
function backToChat() {
  const cur = chatsData.find(c => c.active);
  const id = shownChat || (cur ? cur.id : '');
  if (id) vscode.postMessage({ type: 'agent_command', name: 'load_chat', value: id });
  else vscode.postMessage({ type: 'new_chat_ui' });
}
document.getElementById('roBack').onclick = backToChat;
// Chat events that only draw into the log. While a transcript is on screen
// they are skipped: going back reloads the chat, and the agent replays a turn
// still in flight. Questions are never skipped — they wait for an answer.
const LOG_ONLY = { reasoning_delta: 1, text_delta: 1, tool_call: 1, tool_chunk: 1, tool_result: 1,
  files_changed: 1, auto_user: 1, wakeup: 1, wakeup_cancelled: 1, queued: 1, context_attached: 1 };

// A saved conversation into the log: chat_loaded and agent_loaded.
function renderHistory(msgs, webFirst) {
  for (const m of msgs || []) {
    const asWeb = webFirst && m.role === 'user';
    webFirst = false;
    if (asWeb) log.appendChild(el('div', 'msg user auto web', '\u{1F310} ' + T.webTurn + (m.text || '')));
    else if (m.role === 'user') log.appendChild(el('div', 'msg user', m.text));
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
}

// Copy buttons. The answer is re-rendered from markdown on every token, so the
// buttons cannot live in the markup — they are attached after a render, and
// only for blocks that do not have one yet.
function decorate(root) {
  const pres = root.querySelectorAll('pre.code');
  for (const pre of pres) {
    if (pre.parentElement && pre.parentElement.classList.contains('codewrap')) continue;
    const wrap = el('div', 'codewrap');
    pre.parentElement.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const b = el('button', 'copy', T.copy);
    b.dataset.copyCode = '1';
    wrap.appendChild(b);
  }
  if (root.classList && root.classList.contains('assistant') && !root.querySelector(':scope > .copy-msg')) {
    const b = el('button', 'copy-msg', T.copyMsg);
    b.dataset.copyMsg = '1';
    root.appendChild(b);
  }
}

// One delegated handler for the whole log: links and copy buttons. Delegation
// is not a style choice here — innerHTML of an answer is replaced on every
// token, so anything bound to a node inside it would be gone a moment later.
log.addEventListener('click', (e) => {
  const path = e.composedPath();
  for (const node of path) {
    if (!node || !node.dataset) continue;
    if (node.dataset.copyCode) {
      const wrap = node.parentElement;
      const code = wrap && wrap.querySelector('pre.code');
      if (code) vscode.postMessage({ type: 'copy_text', text: code.textContent || '' });
      node.textContent = T.copied;
      setTimeout(() => { node.textContent = T.copy; }, 1500);
      e.preventDefault();
      return;
    }
    if (node.dataset.copyMsg) {
      const msg = node.parentElement;
      // The raw markdown, not the rendered text: what the model actually wrote.
      const text = (msg && msg._md) || (msg ? msg.innerText : '');
      vscode.postMessage({ type: 'copy_text', text });
      node.textContent = T.copied;
      setTimeout(() => { node.textContent = T.copyMsg; }, 1500);
      e.preventDefault();
      return;
    }
    if (node.tagName === 'A') {
      const file = node.dataset.file;
      if (file) {
        if (!BROWSER) vscode.postMessage({ type: 'open_file', path: file, line: node.dataset.line || '' });
        e.preventDefault();
        return;
      }
      const href = node.getAttribute('href') || '';
      if (/^(https?:|mailto:)/i.test(href)) {
        // Open through the extension: the webview host would also handle this,
        // but then the panel has no say in what counts as a safe link.
        vscode.postMessage({ type: 'open_external', text: href });
        e.preventDefault();
      }
      return;
    }
  }
});

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
                   user: '', effort: '', maxIter: 0, subagentIter: 0 };
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
  if (inboxData && inboxData.state === 'listening') {
    const g = el('span', 'inbox', '\u{1F310}');
    g.title = T.inboxListening;
    statusEl.appendChild(g);
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
  // An older agent does not report it and would not take the command.
  if (stateData.subagentIter) {
    menu.appendChild(mi(T.mSubagentIter, String(stateData.subagentIter), () => {
      closeMenu();
      vscode.postMessage({ type: 'agent_command', name: 'set_subagent_iterations' });
    }, false, 'subagentiter'));
  }
  menu.appendChild(el('div', 'sep'));
  if (stateData.user) {
    menu.appendChild(mi(T.mLogout, stateData.user, () => {
      closeMenu();
      vscode.postMessage({ type: 'agent_command', name: 'logout' });
    }, false, 'logout'));
  } else {
    menu.appendChild(mi(T.mLogin, T.loginNone, () => {
      closeMenu();
      // No optimistic notice here: login_start from the agent draws the real
      // link, and a dead agent gets a real error from the extension side.
      vscode.postMessage({ type: 'agent_command', name: 'login' });
    }, false, 'login'));
  }
  menuInbox();
  menu.appendChild(el('div', 'sep'));
  menu.appendChild(mi(T.mResume, '', () => {
    closeMenu();
    vscode.postMessage({ type: 'agent_command', name: 'resume_last' });
  }, false, 'resume'));
  menu.appendChild(mi(T.mNewChat, '', () => { closeMenu(); vscode.postMessage({ type: 'new_chat_ui' }); }, false, 'newchat'));
  // A browser has no agent process of its own to restart and no terminal.
  if (!BROWSER) {
    menu.appendChild(mi(T.mRestart, '', () => { closeMenu(); vscode.postMessage({ type: 'restart' }); }, false, 'restart'));
    menu.appendChild(mi(T.mTerminal, '', () => { closeMenu(); vscode.postMessage({ type: 'open_terminal' }); }, false, 'terminal'));
  }
  if (isStudio) {
    menu.appendChild(el('div', 'sep'));
    menu.appendChild(mi(T.mCheckUpdates, '', () => { closeMenu(); vscode.postMessage({ type: 'check_updates' }); }, false, 'updates'));
  }
  menu.classList.add('open');
}
// Tasks from the site: who accepts them, and what can be done about it.
function menuInbox() {
  const entries = inboxMenuEntries(inboxData, T, PAYMENT_URL);
  if (!entries.length) return;
  menu.appendChild(el('div', 'sep'));
  for (const it of entries) {
    const msg = it.msg;
    const d = mi(it.label, it.extra || '', msg ? () => { closeMenu(); vscode.postMessage(msg); } : null, false, it.key);
    if (it.info) {
      d.classList.add('info');
      if (msg) d.classList.add('act');
      d.firstChild.textContent = '\u{1F310}';
      d.setAttribute('data-inbox-state', inboxData.state);
    }
    menu.appendChild(d);
  }
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
      // Reopening from history brings the tab back: hidden means "not on my
      // strip right now", not "gone".
      tabsHidden = tabsHidden.filter(id => id !== c.id);
      saveTabs();
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
  // A subagent asks through its parent's chat: say which one, and let the
  // name open what it has done so far.
  const ag = e.agent;
  if (ag && (ag.title || ag.id)) {
    const tag = el('div', 'ask-agent', '\u{1F916} ' + T.askFromAgent + (ag.title || ag.id));
    if (ag.id) tag.onclick = () => openAgent(ag.id, ag.title);
    box.appendChild(tag);
  }
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
  if (e.id) asks[e.id] = box;
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
  // In a browser only the host's own events count: anything another window
  // posts here is not from the agent.
  if (BROWSER && ev.origin !== 'execai-host') return;
  const e = ev.data;
  if (!e || typeof e.type !== 'string') return;
  if (viewAgent && LOG_ONLY[e.type]) return;
  switch (e.type) {
    case 'ready': {
      // A new agent process has a fleet of its own; it reports it when asked.
      agentsData = null;
      renderAgents();
      refreshTabs();
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
    case 'ask_resolved': {
      // The question is closed and its buttons here would answer nothing.
      // by=panel: it was answered here — nothing to add, just disable it.
      // by=web: answered on the site first; anything else: withdrawn (the
      // turn stopped or timed out) — the box goes and a line says which.
      const id = e.ask_id || e.id || '';
      const box = asks[id];
      delete asks[id];
      if (!box || box.classList.contains('answered') || !box.parentElement) break;
      if (e.by === 'panel') { box.classList.add('answered'); break; }
      box.parentElement.insertBefore(el('div', 'notice', e.by === 'web' ? T.askResolved : T.askCancelled), box);
      box.remove();
      scroll();
      break;
    }
    case 'inbox':
      inboxData = e.state ? e : null;
      renderStatus();
      if (menuView === 'root') menuRoot();
      break;
    case 'files_changed': {
      const wrap = el('div', 'files');
      wrap.appendChild(el('span', '', '📝'));
      for (const p of e.paths || []) {
        const chip = el('span', '', p);
        if (!BROWSER) chip.onclick = () => vscode.postMessage({ type: 'open_file', path: p });
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
      // Copy buttons go on once the answer is complete: during streaming the
      // markdown is half-parsed and the block boundaries still move.
      if (curAssistant) decorate(curAssistant);
      curAssistant = null; curThinking = null;
      // A chat gets its title from the first exchange, and there is no event
      // for that — ask for the list again when a turn ends.
      refreshTabs();
      break;
    case 'studio':
      isStudio = true;
      break;
    case 'files_attached':
      addAttachments(e.items || (e.paths || []).map(p => ({ path: p, label: p })));
      break;
    case 'context_attached': {
      // A muted line under the message that just went out: what the extension
      // quietly added from the editor, so the chat never knows more than the eye.
      const bubbles = log.querySelectorAll('.msg.user');
      const last = bubbles[bubbles.length - 1];
      if (last) last.appendChild(el('div', 'ctxline', '\u{1F4CE} ' + (e.text || '')));
      scroll();
      break;
    }
    case 'chat_flags':
      chatFlags = e.flags || {};
      renderTabs();
      break;
    case 'auto_user': {
      clearEmpty();
      // A task from the site opens its chat the way a wake-up does, but under
      // its own caption. The agent tags it with origin; without the tag, the
      // first turn of a chat known to be from the site is that task.
      const web = e.origin === 'web' ||
        (!e.origin && isWebChat(e.chat) && !log.querySelector('.msg.user'));
      log.appendChild(el('div', 'msg user auto' + (web ? ' web' : ''),
        (web ? '\u{1F310} ' + T.webTurn : '\u{1F319} ' + T.autoTurn) + (e.text || '')));
      scroll();
      break;
    }
    case 'wakeup':
      log.appendChild(wakeLine(e.at || '', e.text || ''));
      scroll();
      break;
    case 'wakeup_cancelled':
      for (const w of log.querySelectorAll('.wake')) w.remove();
      log.appendChild(el('div', 'notice', T.wakeCancelled));
      scroll();
      break;
    case 'queued':
      log.appendChild(el('div', 'notice', T.queued));
      scroll();
      break;
    case 'chat_reset':
      leaveAgentView();
      shownChat = e.chat || null;
      // Switching chats: the busy state belongs to the chat we are leaving.
      clearBusy();
      log.innerHTML = '';
      tools = {}; asks = {}; curAssistant = null; curThinking = null;
      log.appendChild(el('div', 'notice', T.newChatNotice));
      refreshTabs();
      break;
    case 'tabs_state': {
      try {
        const st = JSON.parse(e.text || '{}');
        tabsHidden = Array.isArray(st.hidden) ? st.hidden : [];
        tabsOrder = Array.isArray(st.order) ? st.order : [];
        agentsCollapsed = !!st.agents_collapsed;
      } catch (err) { /* first run — defaults are fine */ }
      renderTabs();
      renderAgents();
      break;
    }
    case 'agents': {
      agentsData = Array.isArray(e.items) ? e.items.filter(a => a && a.id) : [];
      for (const id of Object.keys(agentsStopping)) {
        const r = agentRecord(id);
        if (!r || !(r.state === 'queued' || r.state === 'running' || r.state === 'waiting')) delete agentsStopping[id];
      }
      for (const t of agentTabs) {
        const r = agentRecord(t.id);
        if (r && r.title) t.title = r.title;
      }
      // The transcript on screen follows its subagent while it works.
      if (viewAgent && !pendingAgent && !agentReloading) {
        const r = agentRecord(viewAgent);
        if (r && r.updated_at && r.updated_at !== viewAgentStamp) {
          viewAgentStamp = r.updated_at;
          agentReloading = true;
          vscode.postMessage({ type: 'agent_command', name: 'open_agent', value: viewAgent });
        }
      }
      renderAgents();
      renderTabs();
      break;
    }
    case 'agent_loaded': {
      // Only what this panel asked for: in a browser every tab gets every
      // event, and another tab's transcript must not take this one over.
      const want = pendingAgent ? e.id === pendingAgent : e.id === viewAgent;
      if (!e.id || !want) break;
      const fresh = e.id !== viewAgent;
      const atEnd = fresh || log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
      // Open questions stay answerable across the redraw.
      const keep = Object.keys(asks).map(id => [id, asks[id]])
        .filter(p => p[1] && !p[1].classList.contains('answered'));
      pendingAgent = null;
      agentReloading = false;
      viewAgent = e.id;
      if (fresh) { const r = agentRecord(e.id); viewAgentStamp = r && r.updated_at ? r.updated_at : ''; }
      const tab = agentTabs.find(a => a.id === e.id);
      if (!tab) agentTabs.push({ id: e.id, title: e.title || e.id });
      else if (e.title) tab.title = e.title;
      document.body.classList.add('agentview');
      log.innerHTML = '';
      tools = {}; asks = {}; curAssistant = null; curThinking = null;
      log.appendChild(el('div', 'notice agent-head', '\u{1F916} ' + (e.title || e.id) +
        (e.state ? ' \u00b7 ' + agentStateLabel(e.state) : '')));
      renderHistory(e.messages, false);
      if (e.error) log.appendChild(el('div', 'error', e.error));
      for (const p of keep) { log.appendChild(p[1]); asks[p[0]] = p[1]; }
      for (const a of log.querySelectorAll('.msg.assistant')) decorate(a);
      if (atEnd) scroll();
      renderTabs();
      renderAgents();
      break;
    }
    case 'chats':
      chatsData = e.chats || [];
      if (menuView === 'chats') menuChats();
      renderTabs();
      break;
    case 'chat_loaded': {
      leaveAgentView();
      if (e.chat) shownChat = e.chat;
      // The chat we are leaving may still be busy — that is its state, not ours.
      // If the loaded chat is busy, the agent replays its turn right after this.
      clearBusy();
      log.innerHTML = '';
      tools = {}; asks = {}; curAssistant = null; curThinking = null;
      // The opening message of a chat from the site is the task itself.
      renderHistory(e.msgs, e.origin === 'web' || isWebChat(e.chat));
      log.appendChild(el('div', 'notice', T.chatRestored));
      if (e.at) log.appendChild(wakeLine(e.at, e.text || ''));
      scroll();
      for (const a of log.querySelectorAll('.msg.assistant')) decorate(a);
      refreshTabs();
      break;
    }
    case 'state': {
      const hadSub = !!stateData.subagentIter;
      stateData = { model: e.model || '', source: e.source || '',
                    models: e.models || [], sources: e.sources || [],
                    efforts: e.efforts || [], connectable: e.connectable || [],
                    securities: e.securities || [], security: e.security || '',
                    user: e.user || '', effort: e.effort || '', maxIter: e.max_iter || 0,
                    subagentIter: e.subagent_iter || 0 };
      renderStatus();
      // The +25 buttons come and go with subagent_iter.
      if (agentsData && hadSub !== !!stateData.subagentIter) renderAgents();
      // redraw whichever menu view is open with the hot data
      if (menuView === 'root') menuRoot();
      else if (menuView) menuList(menuView);
      break;
    }
    case 'login_start': {
      // The browser opens by itself, but the link must survive on its own:
      // over SSH or on a headless box nothing opens, and the sign-in may
      // happen in a browser on another machine entirely.
      const n = el('div', 'notice');
      n.appendChild(el('div', undefined, T.loginConfirm + (e.id ? T.loginCode + e.id : '')));
      n.appendChild(el('code', 'login-link', e.text || ''));
      const copy = el('button', 'login-copy', T.loginCopy);
      copy.onclick = () => {
        vscode.postMessage({ type: 'copy_text', text: e.text || '' });
        copy.textContent = T.loginCopied;
        setTimeout(() => { copy.textContent = T.loginCopy; }, 1500);
      };
      n.appendChild(copy);
      log.appendChild(n);
      scroll();
      break;
    }
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
      if (!BROWSER) {
        const b = document.createElement('button');
        b.textContent = T.restartBtn;
        b.style.marginTop = '4px';
        b.onclick = () => { vscode.postMessage({ type: 'restart' }); box.remove(); };
        box.appendChild(document.createElement('br'));
        box.appendChild(b);
      }
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
