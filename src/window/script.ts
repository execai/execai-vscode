// The window of `execai ui`: what the page script does on top of the editor
// panel's script when it runs in a browser.
//
// This text is appended to the panel script (webviewHtml.ts) in the browser
// build only, in the same <script>, so it sees the panel's state — chatsData,
// stateData, agentsData, machineData, tools, asks… — and its helpers (el,
// vscode, fleetView, machineRows, startSteps). It replaces the panel's draw
// functions with ones that fill the window's markup (window/markup.ts): the
// sidebar, the tab strip, the inspector, the turn line, the status line. The
// logic — which chat is on screen, what a click sends to the agent — stays
// the panel's; nothing here talks to the agent in a way the panel does not.
//
// Only what the agent really reports is drawn: no times on messages, no
// per-file line counts, no other projects — the protocol has none of them.
//
// String.raw: the text is JavaScript as it reaches the page — write \n and
// regular expressions as usual, but no backticks and no dollar-brace.

export const WINDOW_JS = String.raw`
// ══════════ the window of execai ui ══════════
const CFG = (window.execaiPage && window.execaiPage.config) || {};
const LOOK = window.execaiLook || { skin: 'verstak', theme: 'system', skins: ['verstak'] };
const LANG = (document.documentElement && document.documentElement.lang) || 'en';
const $id = (id) => document.getElementById(id);
const appEl = $id('app'), railEl = $id('rail'), infoEl = $id('info'), sheetEl = $id('sheet');
const filesBox = $id('files'), welcomeEl = $id('welcome'), popEl = $id('pop');
const sideChats = $id('sideChats'), sideHist = $id('sideHist');
const winAll = (sel) => (document.querySelectorAll ? Array.from(document.querySelectorAll(sel)) : []);

let winEmpty = null;      // the chat on screen is empty (null — not known yet)
let winPinned = true;     // the feed follows its end until the person scrolls up
let winStuckAt = 0;       // where the feed was last put at its end
let winIter = 0;          // the step of the turn on screen (the agent's iteration event)
let winFiles = [];        // files changed in this chat since it was opened
let winSent = null;       // the message just sent, until its turn starts
let winAgentsOpen = false; // a narrow window: the list of subagents is unfolded (it starts folded)
let winMenuAnchor = null; // what the open menu hangs on
let winMenuFresh = false; // the menu was just opened by hand: focus goes into it

const WIN_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
// The answers of a permission request (the agent's vocabulary) and their keys.
const WIN_KEY_OF = { once: 'y', session: 'a', exact: 's', always: 'f', deny: 'n' };
const SVGNS = 'http://www.w3.org/2000/svg';
function ic(name, cls) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVGNS, 'use');
  u.setAttribute('href', '#i-' + name);
  s.appendChild(u);
  return s;
}
// A row that is not a <button> (it holds one) still answers to Enter and Space.
function winKey(n, fn) {
  n.tabIndex = 0;
  n.onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    fn(e);
  };
}
function winIconBtn(icon, title, fn) {
  const b = el('button', 'ib');
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', title);
  b.appendChild(ic(icon));
  b.onclick = fn;
  return b;
}
function winCross(cls, title, fn) {
  const x = el('i', cls);
  x.title = title;
  x.setAttribute('role', 'button');
  x.setAttribute('aria-label', title);
  x.appendChild(ic('x'));
  x.onclick = fn;
  winKey(x, fn);
  return x;
}
function winBase(p) {
  const s = String(p || '').replace(/[\\/]+$/, '');
  return s.split(/[\\/]/).pop() || s;
}
function winAgo(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  if (isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return T.agoNow;
  if (s < 3600) return Math.floor(s / 60) + ' ' + T.agoMin;
  if (s < 86400) return Math.floor(s / 3600) + ' ' + T.agoHour;
  return Math.floor(s / 86400) + ' ' + T.agoDay;
}
function winClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const two = (n) => (n < 10 ? '0' : '') + n;
  if (s < 3600) return Math.floor(s / 60) + ':' + two(s % 60);
  return Math.floor(s / 3600) + ':' + two(Math.floor(s / 60) % 60) + ':' + two(s % 60);
}
function winSecs(sec) {
  if (sec >= 60) return winClock(sec);
  const n = sec < 10 ? Math.round(sec * 10) / 10 : Math.round(sec);
  let shown = String(n);
  try { shown = n.toLocaleString(LANG); } catch (e) { /* an unknown locale: the plain number */ }
  return shown + ' ' + T.secs;
}
function winPlan(p) {
  const k = String(p || '').toLowerCase().replace(/^(day|week|month|year)_/, '');
  return k === 'start' ? T.planStart : k === 'work' ? T.planWork : k === 'max' ? T.planMax : p;
}
function winReach(m) {
  return !!(m && m.presence && m.presence.listener_running && m.presence.reachable_from_web);
}
function winWide() {
  return window.matchMedia ? window.matchMedia('(min-width: 1100px)').matches : true;
}
function winNarrow() {
  return window.matchMedia ? window.matchMedia('(max-width: 719px)').matches : false;
}
function winIsEmpty() {
  return !viewAgent && !document.body.classList.contains('busy') && chatIsEmpty();
}

// ── the look: a skin and a theme, remembered in this browser ──
const winLook = { skin: LOOK.skin, theme: LOOK.theme };
function winStore(k, v) {
  try { localStorage.setItem('execai:ui:' + k, v); } catch (e) { /* no storage: the choice lasts until a reload */ }
}
function winApplyLook() {
  const d = document.documentElement;
  if (!d) return;
  d.className = 'sk-' + winLook.skin;
  if (winLook.theme === 'system') d.removeAttribute('data-theme');
  else d.setAttribute('data-theme', winLook.theme);
}
function winSetSkin(s) {
  if (LOOK.skins.indexOf(s) < 0) return;
  winLook.skin = s;
  winApplyLook();
  winStore('skin', s);
  winRenderPop();
  winRelayout();
}
function winSetTheme(t) {
  if (t !== 'system' && t !== 'light' && t !== 'dark') return;
  winLook.theme = t;
  winApplyLook();
  winStore('theme', t);
  winRenderPop();
}
// A skin moves everything: what floats is put back in place, the feed keeps its end.
function winRelayout() {
  closeMenu();
  winSideApply();
  winSync();
  winTabsMore();
  if (popEl.classList.contains('open')) winPlace(popEl, $id('lookBtn'));
  if (winPinned && !winEmpty) winStick();
}
function winNotifyState() {
  if (typeof Notification === 'undefined') return '';
  return Notification.permission || 'default';
}
function winRenderPop() {
  popEl.innerHTML = '';
  const radio = (b, on) => { b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', on ? 'true' : 'false'); };
  popEl.appendChild(el('div', 'pop-t', T.winSkin));
  const names = {
    verstak: [T.winSkinVerstak, T.winSkinVerstakD],
    beseda: [T.winSkinBeseda, T.winSkinBesedaD],
    teletype: [T.winSkinTeletype, T.winSkinTeletypeD],
  };
  const skins = el('div', 'pop-skins');
  skins.setAttribute('role', 'radiogroup');
  skins.setAttribute('aria-label', T.winSkin);
  for (const s of LOOK.skins) {
    const b = el('button', 'pk');
    radio(b, s === winLook.skin);
    b.setAttribute('data-skin', s);
    // The swatch wears the skin's own class: its colour is that skin's token.
    b.appendChild(el('span', 'pk-sw sk-' + s));
    b.appendChild(el('b', '', (names[s] || [s])[0]));
    b.appendChild(ic('check'));
    b.appendChild(el('small', '', (names[s] || ['', ''])[1]));
    b.onclick = () => winSetSkin(s);
    skins.appendChild(b);
  }
  popEl.appendChild(skins);
  popEl.appendChild(el('div', 'pop-t', T.winTheme));
  const seg = el('div', 'seg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', T.winTheme);
  for (const p of [['system', 'monitor', T.winThemeSystem], ['light', 'sun', T.winThemeLight], ['dark', 'moon', T.winThemeDark]]) {
    const b = el('button', '');
    radio(b, p[0] === winLook.theme);
    b.setAttribute('data-theme-set', p[0]);
    b.title = p[2];
    b.appendChild(ic(p[1]));
    b.appendChild(el('span', '', p[2]));
    b.onclick = () => winSetTheme(p[0]);
    seg.appendChild(b);
  }
  popEl.appendChild(seg);
  const np = winNotifyState();
  if (np) {
    popEl.appendChild(el('div', 'pop-t', T.winNotify));
    const row = el('div', 'pop-row');
    row.appendChild(el('span', '', np === 'granted' ? T.winNotifyOn : np === 'denied' ? T.winNotifyDenied : T.winNotifyOff));
    if (np === 'default') {
      const b = el('button', 'btn2', T.winNotifyAsk);
      b.type = 'button';
      b.onclick = () => {
        try { Promise.resolve(Notification.requestPermission()).then(winRenderPop, winRenderPop); }
        catch (e) { winRenderPop(); }
      };
      row.appendChild(b);
    }
    popEl.appendChild(row);
  }
  if (stateData.user) {
    popEl.appendChild(el('div', 'pop-t', T.rowAccount));
    const row = el('div', 'pop-row');
    row.appendChild(el('span', '', stateData.user));
    const b = el('button', 'btn2', T.winSignOut);
    b.type = 'button';
    b.title = T.mLogout;
    b.onclick = () => { winPopClose(); vscode.postMessage({ type: 'agent_command', name: 'logout' }); };
    row.appendChild(b);
    popEl.appendChild(row);
  }
}
function winPopClose() {
  if (!popEl.classList.contains('open')) return;
  popEl.classList.remove('open');
  $id('lookBtn').setAttribute('aria-expanded', 'false');
}
$id('lookBtn').onclick = () => {
  if (popEl.classList.contains('open')) { winPopClose(); return; }
  closeMenu();
  winRenderPop();
  popEl.classList.add('open');
  $id('lookBtn').setAttribute('aria-expanded', 'true');
  winPlace(popEl, $id('lookBtn'));
  const first = popEl.querySelector('[aria-checked="true"]');
  if (first && first.focus) first.focus();
};

// Puts a floating box next to what opened it, inside the window.
// A list as tall as it is, up to the room on its side of the anchor; a longer
// one scrolls inside. A skin that wants it lower caps max-height itself (with
// !important, over the one set here): the place is counted from what the box
// really takes.
function winPlace(box, anchor) {
  if (!box.getBoundingClientRect || !anchor || !anchor.getBoundingClientRect) return;
  let a = anchor.getBoundingClientRect();
  // The anchor may be hidden in this skin (no tab strip in the beseda skin): then the input.
  if (!a.width && !a.height) a = $id('cmdBtn').getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight, gap = 6, edge = 8;
  const room = (space) => Math.max(120, Math.min(space, vh - 2 * edge)) + 'px';
  box.style.maxHeight = room(vh);
  box.style.left = '0px';
  box.style.top = '0px';
  const b = box.getBoundingClientRect();
  const left = Math.max(edge, Math.min(a.left, vw - b.width - edge));
  const below = vh - a.bottom - gap - edge, above = a.top - gap - edge;
  const down = b.height <= below || below >= above;
  // The height first, the place after it, counted from what the box really
  // takes: a long list opened upwards would otherwise grow past the bottom
  // of the window, over the input.
  box.style.maxHeight = room(down ? below : above);
  const h = box.getBoundingClientRect().height;
  const top = Math.max(edge, Math.min(down ? a.bottom + gap : a.top - gap - h, vh - edge - h));
  box.style.left = left + 'px';
  box.style.top = top + 'px';
}

// ── the feed ──
// The feed follows its end until the person scrolls up to read, and again
// once they are back at the end. Only a move UP by hand lets go: the feed
// growing, or getting shorter because a panel appeared under it, does not.
function winStick() {
  log.scrollTop = log.scrollHeight;
  winStuckAt = log.scrollTop;
}
log.addEventListener('scroll', () => {
  if (log.scrollHeight - log.scrollTop - log.clientHeight < 80) {
    winPinned = true;
    winStuckAt = log.scrollTop;
  } else if (log.scrollTop < winStuckAt - 4) {
    winPinned = false;
  }
});
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => { if (winPinned && !winEmpty) winStick(); }).observe(log);
}
// An empty chat keeps its greeting in view and only brings a new line into it.
scroll = function () {
  if (winEmpty) {
    const kids = log.children;
    let last = kids[kids.length - 1];
    if (last === infoEl) last = kids[kids.length - 2];
    if (last && last !== welcomeEl && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (winPinned) winStick();
};

// A message of the person: what they typed and what they attached. kind:
// '' — typed here, 'auto' — the agent woke itself up, 'web' — a task from the site.
function winUserBubble(text, items, kind) {
  const m = el('div', 'msg user' + (kind ? ' auto' : '') + (kind === 'web' ? ' web' : ''));
  const meta = el('div', 'm-meta');
  const who = el('span', 'who');
  who.setAttribute('data-t', T.winYou);
  meta.appendChild(who);
  m.appendChild(meta);
  const body = el('div', 'm-body');
  if (kind) {
    const from = el('span', 'm-from');
    from.appendChild(ic(kind === 'web' ? 'globe' : 'alarm'));
    from.appendChild(el('span', '', (kind === 'web' ? T.webTurn : T.autoTurn).replace(/[:\s]+$/, '')));
    body.appendChild(from);
  }
  body.appendChild(el('span', 'm-text', text || ''));
  if (items && items.length) {
    const g = el('div', 'gallery');
    for (const a of items) {
      if (a.thumb) {
        const img = document.createElement('img');
        img.src = a.thumb; img.title = a.label; img.alt = a.label;
        g.appendChild(img);
      } else {
        const c = el('span', 'fchip');
        c.appendChild(ic(a.image || isImg(a.path) ? 'image' : 'file'));
        c.appendChild(el('span', '', a.label));
        c.title = a.label;
        g.appendChild(c);
      }
    }
    body.appendChild(g);
  }
  m.appendChild(body);
  return m;
}

renderChips = function () {
  chipsBox.innerHTML = '';
  for (const a of attached) {
    const c = el('span', 'chip');
    c.title = a.label;
    if (a.thumb) {
      const img = document.createElement('img');
      img.src = a.thumb; img.title = a.label; img.alt = a.label;
      c.appendChild(img);
    } else {
      c.appendChild(ic(isImg(a.path) ? 'image' : 'file'));
      c.appendChild(el('span', '', a.label));
    }
    c.appendChild(winCross('', T.winRemove, () => { attached = attached.filter(v => v.path !== a.path); renderChips(); }));
    chipsBox.appendChild(c);
  }
};

function winGrow() {
  if (!inp.style) return;
  inp.style.height = 'auto';
  if (inp.scrollHeight) inp.style.height = inp.scrollHeight + 'px';
}
inp.addEventListener('input', winGrow);

send = function () {
  const text = inp.value.trim();
  if (!text && !attached.length) return;
  clearEmpty();
  winSent = winUserBubble(text, attached, '');
  log.appendChild(winSent);
  inp.value = '';
  winGrow();
  curAssistant = null; curThinking = null;
  vscode.postMessage({ type: 'send', text, files: attached.map(a => a.path) });
  attached = []; renderChips();
  // The chat has begun: "Getting started" steps aside, even when asked for.
  startForced = false;
  renderStart();
  winPinned = true;
  winSync();
  scroll();
};
sendBtn.onclick = send;

// Tool calls. Consecutive ones share a box; a row opens to show the output.
function winToolsBox() {
  const last = log.children[log.children.length - 1];
  if (last && last.classList && last.classList.contains('tools')) return last;
  const g = el('div', 'tools');
  log.appendChild(g);
  return g;
}
function winToolIcon(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'bash') return 'terminal';
  if (n === 'read') return 'file';
  if (n === 'edit' || n === 'write') return 'pencil';
  if (n === 'grep' || n === 'glob' || n === 'websearch') return 'search';
  if (n === 'ls' || n === 'tree') return 'folder';
  if (n === 'webfetch') return 'globe';
  if (n.indexOf('task') === 0) return 'agents';
  if (n === 'todowrite') return 'check';
  if (n === 'askuser') return 'question';
  if (n === 'wait' || n === 'schedule_wakeup') return 'alarm';
  return 'cube';
}
// The agent starts a summary with the tool's name ("Bash: ls"); next to the
// name itself that is said twice.
function winSummary(name, summary) {
  const s = String(summary || ''), n = String(name || '');
  return n && s.toLowerCase().indexOf(n.toLowerCase() + ': ') === 0 ? s.slice(n.length + 2) : s;
}
function winToolRow(name, summary) {
  summary = winSummary(name, summary);
  const box = el('details', 'tool');
  const head = el('summary', '');
  const ti = el('span', 't-ic');
  ti.appendChild(ic(winToolIcon(name)));
  head.appendChild(ti);
  head.appendChild(el('span', 't-name', name || ''));
  const sum = el('span', 't-sum', summary || '');
  sum.title = summary || '';
  head.appendChild(sum);
  const time = el('span', 't-time', '');
  time.title = T.winToolTime;
  head.appendChild(time);
  const state = el('span', 't-st');
  head.appendChild(state);
  head.appendChild(ic('chev-r', 't-chev'));
  box.appendChild(head);
  const out = el('pre', 't-out', '');
  box.appendChild(out);
  const t = { box, out, state, time, t0: 0, touched: false, auto: false };
  // Nothing to show yet — nothing to open.
  head.onclick = (e) => {
    t.touched = true;
    if (!out.textContent && e && e.preventDefault) e.preventDefault();
  };
  return t;
}
function winToolCall(e) {
  // The text before a tool call is complete: it gets its copy buttons now,
  // not never (the panel gives them only to the last text of a turn).
  if (curAssistant) decorate(curAssistant);
  curAssistant = null; curThinking = null;
  const t = winToolRow(e.tool, e.summary);
  t.box.classList.add('run');
  t.state.className = 't-st run';
  t.state.title = T.agRunning;
  t.state.appendChild(el('i', 'spin'));
  t.t0 = Date.now();
  winToolsBox().appendChild(t.box);
  tools[e.id] = t;
  scroll();
}
function winToolResult(e) {
  const t = tools[e.id];
  if (!t) return;
  t.box.classList.remove('run');
  // A call the person refused is neither done nor failed: the agent says so
  // (denied) next to ok, which stays true for panels that do not know the field.
  const denied = !!e.denied;
  t.box.classList.toggle('denied', denied);
  t.state.innerHTML = '';
  t.state.className = 't-st ' + (denied ? 'denied' : e.ok ? 'ok' : 'fail');
  t.state.title = denied ? T.winDenied : e.ok ? T.agDone : T.agFailed;
  t.state.appendChild(ic(denied ? 'ban' : e.ok ? 'check' : 'x'));
  if (!t.out.textContent) t.out.textContent = e.tail || '';
  if (!t.out.textContent) t.box.classList.add('flat');
  // A call that came back at once has no time worth showing; a refused one
  // did not run at all — the time it waited for the answer is not its own.
  const took = t.t0 && !denied ? (Date.now() - t.t0) / 1000 : 0;
  if (took >= 0.1) t.time.textContent = winSecs(took);
  // Opened by itself to show the output running — folds back by itself.
  if (t.auto && !t.touched) t.box.open = false;
}

// Code blocks line by line: the renderer gives escaped text with no tags of
// its own, so a line is what stands between line feeds. Each becomes a
// span.l that ends with its line feed — the text of the block stays what it
// was (copying takes it as is), and a skin can number the lines.
function winLinesHtml(html) {
  const lines = String(html).split('\n');
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    out += '<span class="l">' + lines[i] + (i < lines.length - 1 ? '\n' : '') + '</span>';
  }
  return out;
}
function winCodeLines(root) {
  if (!root || !root.querySelectorAll) return;
  for (const pre of root.querySelectorAll('pre.code')) {
    const code = pre.querySelector('code');
    if (!code || code.querySelector('.l')) continue;
    code.innerHTML = winLinesHtml(code.innerHTML);
  }
}
// A saved conversation into the feed: chat_loaded and agent_loaded.
// A message of the person from a saved chat. The agent keeps the prompt whole,
// with the files that went along written into it; when it can tell the two
// apart it says what the person typed (said) and what was attached (files,
// and how many images) — then the message looks the way it did when sent.
function winReplayUser(m, kind) {
  const items = [];
  // A file sent from this window lies in the project under a name with the
  // moment of its upload in front; the chip shows the name it came with.
  for (const p of m.files || []) {
    const up = /[\\/]\.execai[\\/]uploads[\\/][^\\/]+$/.test(String(p));
    items.push({ path: p, label: up ? winBase(p).replace(/^\d{9,}-/, '') : winBase(p) });
  }
  for (let n = 0; n < (m.images || 0); n++) items.push({ path: '', label: T.winImage, image: true });
  return winUserBubble(typeof m.said === 'string' ? m.said : (m.text || ''), items, kind);
}
renderHistory = function (msgs, webFirst) {
  winPinned = true;
  for (const m of msgs || []) {
    const asWeb = webFirst && m.role === 'user';
    webFirst = false;
    if (m.role === 'user') log.appendChild(winReplayUser(m, asWeb ? 'web' : ''));
    else if (m.role === 'assistant') {
      const a = el('div', 'msg assistant');
      a._md = m.text || '';
      a.innerHTML = renderMarkdown(a._md);
      winCodeLines(a);
      log.appendChild(a);
    } else if (m.role === 'tool') {
      const t = winToolRow(m.tool, m.text);
      t.box.classList.add('flat');
      winToolsBox().appendChild(t.box);
    }
  }
};

// A line about a scheduled wake-up, with Now / Cancel.
wakeLine = function (at, reason) {
  const w = el('div', 'notice wake');
  w.appendChild(el('span', '', T.wakeNotice + clock(at) + (reason ? ' — ' + reason : '')));
  const now = el('button', '', T.wakeNow);
  now.type = 'button';
  now.onclick = () => vscode.postMessage({ type: 'agent_command', name: 'wake_now', value: '' });
  const cancel = el('button', '', T.wakeCancel);
  cancel.type = 'button';
  cancel.onclick = () => vscode.postMessage({ type: 'agent_command', name: 'cancel_wakeup', value: '' });
  w.appendChild(now); w.appendChild(cancel);
  return w;
};

// A permission request (five answers, as the agent sends them) or a question.
addAsk = function (e, isPermission) {
  const box = el('section', 'ask ' + (isPermission ? 'perm' : 'q'));
  if (isPermission && e.tool) box.setAttribute('data-tool', String(e.tool).toLowerCase());
  box._opts = {};          // answer value → its button, for the keys
  box._at = Date.now();    // a key pressed as the request appears is not an answer to it
  box.tabIndex = -1;       // takes the focus on a click anywhere in it
  const head = el('div', 'ask-h');
  const mark = el('span', 'ask-ic');
  mark.appendChild(ic(isPermission ? 'shield' : 'question'));
  head.appendChild(mark);
  const title = el('span', 'ask-t', isPermission ? T.askPerm : T.askQuestion);
  if (isPermission) title.appendChild(el('b', '', e.tool || ''));
  head.appendChild(title);
  const state = el('span', 'ask-state');
  state.appendChild(ic('check'));
  state.appendChild(el('span', '', T.winAnswered));
  box.appendChild(head);
  box.appendChild(el(isPermission ? 'pre' : 'p', isPermission ? 'ask-cmd' : 'ask-q',
    (isPermission ? winSummary(e.tool, e.summary) : e.question) || ''));
  const opts = el('div', 'opts');
  opts.setAttribute('data-again', T.winAskAgain);
  (e.options || []).forEach((o, n) => {
    const b = el('button', 'opt');
    b.type = 'button';
    if (isPermission) {
      if (o.value === 'deny') b.classList.add('deny');
      else if (n === 0) b.classList.add('primary');
    }
    // The key that gives this answer (see the keys below); a skin shows it or not.
    if (isPermission && WIN_KEY_OF[o.value]) {
      b.appendChild(el('kbd', 'key', WIN_KEY_OF[o.value]));
      box._opts[o.value] = b;
    }
    const om = el('span', 'o-mark');
    om.appendChild(ic('check'));
    b.appendChild(om);
    const words = el('span', 'o-txt');
    words.appendChild(el('b', '', o.label));
    if (o.description) {
      words.appendChild(el('small', '', o.description));
      if (isPermission) b.title = o.description;
    }
    b.appendChild(words);
    b.onclick = () => {
      // Answered once: the buttons stay as a record, not as a way to answer again.
      if (box.classList.contains('answered')) return;
      vscode.postMessage({ type: 'answer', id: e.id, value: o.value });
      box.classList.add('answered');
      b.classList.add('chosen');
      for (const x of opts.children) { x.tabIndex = -1; x.setAttribute('aria-disabled', 'true'); }
      winSync();
    };
    opts.appendChild(b);
  });
  box.appendChild(opts);
  if (box._opts.once && box._opts.deny) {
    const label = (v) => box._opts[v].querySelector('b').textContent;
    const hint = el('p', 'ask-hint key-line');
    hint.appendChild(el('kbd', '', 'Enter'));
    hint.appendChild(el('span', '', ' — ' + label('once')));
    const chord = el('span', 'ah-3');
    chord.appendChild(el('span', '', ' · '));
    chord.appendChild(el('kbd', '', WIN_MAC ? '⌘ Enter' : 'Ctrl Enter'));
    chord.appendChild(el('span', '', ' — ' + T.winKeySame));
    hint.appendChild(chord);
    const esc = el('span', 'ah-2');
    esc.appendChild(el('span', '', ' · '));
    esc.appendChild(el('kbd', '', 'Esc'));
    esc.appendChild(el('span', '', ' — ' + label('deny')));
    hint.appendChild(esc);
    box.appendChild(hint);
  }
  // A subagent asks through its parent's chat: say which one, and let the
  // name open what it has done so far.
  const ag = e.agent;
  if (ag && (ag.title || ag.id)) {
    const tag = el('button', 'ask-from');
    tag.type = 'button';
    tag.appendChild(ic('agents'));
    tag.appendChild(el('span', '', T.askFromAgent + (ag.title || ag.id)));
    if (ag.id) tag.onclick = () => openAgent(ag.id, ag.title);
    head.appendChild(tag);
  }
  head.appendChild(state);
  if (e.id) asks[e.id] = box;
  log.appendChild(box);
  scroll();
  // The request takes the focus — the keys go to it — unless the person is
  // in the middle of typing: nothing is taken away from a text field.
  if (isPermission && !winTextTarget(document.activeElement) && box.focus) box.focus({ preventScroll: true });
};

// Files a turn changed: a block in the feed, and the gathered list beside it.
function winFileRow(p) {
  const li = el('li', '');
  const row = el('div', 'frow');
  row.title = p;
  const path = el('span', 'f-path');
  const cut = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (cut >= 0) path.appendChild(el('span', 'f-dir', p.slice(0, cut + 1)));
  path.appendChild(el('span', 'f-name', p.slice(cut + 1)));
  row.appendChild(path);
  li.appendChild(row);
  return li;
}
function winFilesInto(box, paths) {
  box.innerHTML = '';
  const h = el('div', 'ch-h');
  h.appendChild(ic('pencil'));
  h.appendChild(el('span', 'ch-t', T.winFiles));
  h.appendChild(el('span', 'ch-n', String(paths.length)));
  box.appendChild(h);
  const list = el('ul', 'flist');
  for (const p of paths) list.appendChild(winFileRow(String(p)));
  box.appendChild(list);
}
function winRenderFiles() {
  filesBox.classList.toggle('on', winFiles.length > 0);
  if (winFiles.length) winFilesInto(filesBox, winFiles);
  else filesBox.innerHTML = '';
}
function winFilesChanged(e) {
  const paths = (e.paths || []).filter(Boolean);
  if (!paths.length) return;
  const box = el('section', 'changed');
  box.setAttribute('aria-label', T.winFiles);
  winFilesInto(box, paths);
  log.appendChild(box);
  for (const p of paths) if (winFiles.indexOf(p) < 0) winFiles.push(p);
  winRenderFiles();
  scroll();
}

// ── chats: the tab strip, the sidebar, the history ──
function winChatLabel(c) { return (c.label || '').trim() || T.untitledChat; }
// A tab half behind the edge of the strip comes into view with the focus:
// the browser itself scrolls only to what is hidden whole.
function winTabSeen() { if (this.scrollIntoView) this.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
function winBadge(cls, title, icon, text) {
  const b = el('b', 'bdg ' + cls);
  b.title = title;
  if (icon) b.appendChild(ic(icon));
  if (text) b.appendChild(el('span', '', text));
  return b;
}
function winStateBadge(f, active) {
  if (f.asking) return winBadge('q', T.tabAsk, '', '?');
  if (f.busy) return winBadge('busy', T.tabBusy, '', '');
  if (f.unseen && !active) return winBadge('unseen', T.tabUnseen, '', '');
  return null;
}
function winSideOpen(on) {
  appEl.classList.toggle('side-open', !!on);
  if (winNarrow()) $id('navBtn').setAttribute('aria-expanded', on ? 'true' : 'false');
  winTopSync();
}
// In a wide window the sidebar can be put away (remembered in this browser,
// like the look). The window is then moved left by the sidebar's width —
// measured here, whatever columns the skin has — see .app.side-off in base.ts.
let winSideOff = false;
try { winSideOff = localStorage.getItem('execai:ui:side') === 'off'; } catch (e) { /* no storage: the sidebar is shown */ }
function winSideApply() {
  const off = winSideOff && !winNarrow();
  const side = $id('side');
  if (off && side.offsetWidth && appEl.style.setProperty) {
    let gap = 0;
    try { gap = parseFloat(getComputedStyle(appEl).columnGap) || 0; } catch (e) { /* no gap known */ }
    appEl.style.setProperty('--side-shift', (side.offsetWidth + gap) + 'px');
  }
  appEl.classList.toggle('side-off', off);
  if (!winNarrow()) {
    for (const b of winAll('.js-side')) b.setAttribute('aria-expanded', off ? 'false' : 'true');
    $id('navBtn').setAttribute('aria-expanded', off ? 'false' : 'true');
  }
}
function winSideToggle() {
  if (winNarrow()) { winSideOpen(!appEl.classList.contains('side-open')); return; }
  winSideOff = !winSideOff;
  winStore('side', winSideOff ? 'off' : 'on');
  winSideApply();
  closeMenu();
  winPopClose();
  // The button that was pressed may be gone with the sidebar: the focus
  // goes to the one that undoes what it did.
  const next = winAll(winSideOff ? '.side-show.js-side, #navBtn' : '.s-collapse, #navBtn')
    .find(b => b.offsetParent !== null);
  if (next && next.focus) next.focus();
  if (winPinned && !winEmpty) winStick();
}
function winNewChat() {
  winSideOpen(false);
  vscode.postMessage({ type: 'new_chat_ui' });
}
renderTabs = function () {
  rememberOrder();
  tabs.innerHTML = '';
  sideChats.innerHTML = '';
  sideHist.innerHTML = '';
  const list = visibleChats();
  // Subagents still going, per parent chat.
  const going = agentsData ? fleetView(agentsData, Date.now(), T).perChat : {};
  let n = 0;
  for (const c of list) {
    // While a subagent is on screen, no chat is the current one.
    const current = !!c.active && !viewAgent;
    const label = winChatLabel(c);
    const f = Object.assign({}, c.busy ? { busy: true } : {}, c.wake ? { wake: c.wake } : {}, chatFlags[c.id] || {});
    const web = c.origin === 'web' || f.web;
    const close = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      if (tabsHidden.indexOf(c.id) < 0) tabsHidden.push(c.id);
      saveTabs();
      renderTabs();
    };
    const open = () => {
      winSideOpen(false);
      if (current) return;
      vscode.postMessage({ type: 'agent_command', name: 'load_chat', value: c.id });
    };
    const fill = (host, strip) => {
      const st = winStateBadge(f, c.active);
      if (strip && st) host.appendChild(st);
      host.appendChild(el('span', strip ? 'tab-t' : 'c-t', label));
      if (going[c.id]) host.appendChild(winBadge('sub', T.tabAgents, 'agents', String(going[c.id])));
      if (!strip && st) host.appendChild(st);
      if (f.wake) host.appendChild(winBadge('wake', T.tabWake + clock(f.wake), 'alarm', clock(f.wake)));
      if (web) host.appendChild(winBadge('web', T.tabWeb, 'globe', ''));
    };

    const t = el('div', 'tab' + (current ? ' active' : ''));
    t.title = label;
    t.draggable = true;
    t.dataset.chat = c.id;
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', current ? 'true' : 'false');
    fill(t, true);
    t.appendChild(winCross('tab-x', T.closeTab, close));
    t.onclick = open;
    winKey(t, open);
    t.onfocus = winTabSeen;
    // Middle click closes, the way it does on editor tabs.
    t.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); close(e); } };
    t.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', c.id);
      t.classList.add('dragging');
    };
    t.ondragend = () => {
      t.classList.remove('dragging');
      for (const k of tabs.children) k.classList.remove('dropbefore');
    };
    t.ondragover = (e) => { e.preventDefault(); t.classList.add('dropbefore'); };
    t.ondragleave = () => t.classList.remove('dropbefore');
    t.ondrop = (e) => {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
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

    const r = el('div', 'chat' + (current ? ' active' : ''));
    r.title = label;
    r.dataset.chat = c.id;
    r.setAttribute('role', 'button');
    if (current) r.setAttribute('aria-current', 'true');
    r.appendChild(el('span', 'c-n', String(++n)));
    fill(r, false);
    r.appendChild(winCross('c-x', T.winCloseChat, close));
    r.onclick = open;
    winKey(r, open);
    sideChats.appendChild(r);
  }
  // Subagent transcripts: opened from the Agents block, read-only.
  for (const a of agentTabs) {
    const on = a.id === viewAgent;
    const rec = agentRecord(a.id);
    const close = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      agentTabs = agentTabs.filter(v => v.id !== a.id);
      if (a.id === viewAgent || a.id === pendingAgent) { pendingAgent = null; backToChat(); }
      renderTabs();
    };
    const open = () => { winSideOpen(false); if (a.id !== viewAgent) openAgent(a.id, a.title); };
    const fill = (host, strip) => {
      host.appendChild(winBadge('bot', T.agentTab, 'agents', ''));
      host.appendChild(el('span', strip ? 'tab-t' : 'c-t', a.title || a.id));
      if (rec && rec.state === 'waiting') host.appendChild(winBadge('q', T.agWaiting, '', '?'));
      else if (rec && (rec.state === 'running' || rec.state === 'queued')) host.appendChild(winBadge('busy', T.agRunning, '', ''));
    };
    const t = el('div', 'tab agent' + (on ? ' active' : ''));
    t.title = T.agentTab;
    t.dataset.agent = a.id;
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    fill(t, true);
    t.appendChild(winCross('tab-x', T.closeTab, close));
    t.onclick = open;
    winKey(t, open);
    t.onfocus = winTabSeen;
    tabs.appendChild(t);
    const r = el('div', 'chat agent' + (on ? ' active' : ''));
    r.title = T.agentTab;
    r.dataset.agent = a.id;
    r.setAttribute('role', 'button');
    fill(r, false);
    r.appendChild(winCross('c-x', T.closeTab, close));
    r.onclick = open;
    winKey(r, open);
    sideChats.appendChild(r);
  }
  if (!list.length && !agentTabs.length) sideChats.appendChild(el('div', 's-empty', T.histEmpty));
  // Chats taken off the list: one click brings a chat back.
  const closed = chatsData.filter(c => tabsHidden.indexOf(c.id) >= 0);
  for (const c of closed) {
    const r = el('div', 'chat');
    r.title = winChatLabel(c);
    r.dataset.chat = c.id;
    r.setAttribute('role', 'button');
    r.appendChild(el('span', 'c-t', winChatLabel(c)));
    if (c.origin === 'web') r.appendChild(winBadge('web', T.tabWeb, 'globe', ''));
    const open = () => {
      winSideOpen(false);
      tabsHidden = tabsHidden.filter(id => id !== c.id);
      saveTabs();
      renderTabs();
      vscode.postMessage({ type: 'agent_command', name: 'load_chat', value: c.id });
    };
    r.onclick = open;
    winKey(r, open);
    sideHist.appendChild(r);
  }
  $id('sideHistLabel').hidden = !closed.length;
  winTitles();
  // Keep the current chat in view on a strip narrower than its tabs.
  const act = tabs.querySelector('.tab.active');
  if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  winTabsMore();
};
// Tabs out of sight on a side: the strip's frame says so (.more-l, .more-r).
function winTabsMore() {
  const nav = tabs.parentElement;
  if (!nav || !nav.classList) return;
  const hidden = (tabs.scrollWidth || 0) - (tabs.clientWidth || 0);
  nav.classList.toggle('more-l', tabs.scrollLeft > 1);
  nav.classList.toggle('more-r', hidden - tabs.scrollLeft > 1);
}
tabs.addEventListener('scroll', winTabsMore);
function winTitles() {
  let title = T.untitledChat;
  if (viewAgent) {
    const a = agentTabs.find(v => v.id === viewAgent);
    title = (a && a.title) || viewAgent;
  } else {
    const cur = chatsData.find(c => c.active);
    if (cur) title = winChatLabel(cur);
  }
  $id('headTitle').textContent = title;
  $id('headTitle').title = title;
  $id('topChat').textContent = title;
}

// ── subagents ──
function winRing(pct) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', 'ring');
  s.setAttribute('viewBox', '0 0 36 36');
  s.setAttribute('aria-hidden', 'true');
  for (const part of [['r-bg', ''], ['r-fg', pct + ' 100']]) {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('class', part[0]);
    c.setAttribute('cx', '18'); c.setAttribute('cy', '18'); c.setAttribute('r', '15');
    if (part[1]) { c.setAttribute('pathLength', '100'); c.setAttribute('stroke-dasharray', part[1]); }
    s.appendChild(c);
  }
  return s;
}
function winAgentTime(rec, active) {
  const start = rec.started_at ? Date.parse(rec.started_at) : NaN;
  const end = active ? Date.now() : Date.parse(rec.finished_at || rec.updated_at || '');
  return isNaN(start) || isNaN(end) ? '' : winSecs((end - start) / 1000);
}
renderAgents = function () {
  const v = fleetView(agentsData, Date.now(), T);
  agentsBox.innerHTML = '';
  agentRowMeta = {};
  agentsBox.classList.toggle('on', v.rows.length > 0);
  if (!v.rows.length) {
    if (agentsTick) { clearInterval(agentsTick); agentsTick = null; }
    winRail();
    return;
  }
  // A narrow window has no room to spare: there the list starts folded,
  // whatever was chosen for a wide one, and unfolds for this visit only.
  const folded = winNarrow() ? !winAgentsOpen : agentsCollapsed;
  agentsBox.classList.toggle('folded', folded);
  const head = el('div', 'ag-h');
  head.title = T.agentsToggle;
  head.setAttribute('role', 'button');
  head.setAttribute('aria-expanded', folded ? 'false' : 'true');
  head.appendChild(ic('agents'));
  head.appendChild(el('span', 'ag-title', T.agentsHead));
  const counts = el('span', 'ag-counts');
  if (v.running) counts.appendChild(el('span', 'cnt run', T.agentsRunning.replace('{n}', v.running)));
  if (v.done) counts.appendChild(el('span', 'cnt done', T.agentsDone.replace('{n}', v.done)));
  if (v.failed) counts.appendChild(el('span', 'cnt fail', T.agentsFailed.replace('{n}', v.failed)));
  head.appendChild(counts);
  const fold = el('span', 'ib ag-fold');
  fold.appendChild(ic('chev-d'));
  head.appendChild(fold);
  const toggle = () => {
    if (winNarrow()) winAgentsOpen = !winAgentsOpen;
    else { agentsCollapsed = !agentsCollapsed; saveTabs(); }
    renderAgents();
    if (!agentsBox.classList.contains('folded')) vscode.postMessage({ type: 'agent_command', name: 'list_agents' });
  };
  head.onclick = toggle;
  winKey(head, toggle);
  agentsBox.appendChild(head);
  const list = el('div', 'ag-list');
  let n = 0;
  for (const r of v.rows) {
    const rec = agentRecord(r.id) || {};
    const row = el('div', 'ag' + (r.id === viewAgent ? ' on' : ''));
    row.setAttribute('data-agent', r.id);
    row.setAttribute('data-state', r.state);
    if (r.low || r.exhausted) row.setAttribute('data-warn', '1');
    row.title = r.tip + (r.active && rec.last_tool ? '\n' + rec.last_tool : '') + '\n' + T.agentOpenTitle;
    row.appendChild(el('span', 'ag-n', String(++n)));
    const mark = el('span', 'ag-ic');
    if (r.state === 'running') mark.appendChild(el('i', 'spin'));
    else if (r.state === 'waiting') mark.textContent = '?';
    else mark.appendChild(ic(r.state === 'done' ? 'check' : r.state === 'failed' ? 'x' : r.state === 'queued' ? 'clock' : 'stop'));
    row.appendChild(mark);
    const max = rec.max_iter || 0, it = rec.iter || 0;
    const pct = r.state === 'done' ? 100 : max ? Math.max(0, Math.min(100, Math.round(it * 100 / max))) : 0;
    row.appendChild(winRing(pct));
    row.appendChild(el('span', 'ag-name', r.title));
    row.appendChild(el('span', 'ag-state', agentStateLabel(r.state)));
    const bar = el('span', 'ag-bar');
    const fillBar = el('i', '');
    fillBar.style.width = pct + '%';
    bar.appendChild(fillBar);
    row.appendChild(bar);
    let steps = '';
    if (r.exhausted) steps = T.agExhausted;
    else if (r.active && max) steps = T.agSteps.replace('{i}', it).replace('{m}', max).replace('{n}', Math.max(0, max - it));
    else if (max) steps = it + '/' + max;
    else if (it) steps = String(it);
    row.appendChild(el('span', 'ag-steps' + (r.low || r.exhausted ? ' warn' : ''), steps));
    const time = el('span', 'ag-time', winAgentTime(rec, r.active));
    row.appendChild(time);
    if (r.active) agentRowMeta[r.id] = time;
    const acts = el('span', 'ag-acts');
    // +25 needs an agent that knows extend_agent: it is the one that reports
    // subagent_iter in its state. exhausted alone is proof enough.
    if (r.active && stateData.subagentIter) acts.appendChild(winMoreBtn(r.id, T.agentMore, T.agentMoreTitle, r.low));
    if (r.exhausted) acts.appendChild(winMoreBtn(r.id, T.agentContinue, T.agentContinueTitle, true));
    if (r.active) {
      const b = el('button', 'mini m-stop ag-stop');
      b.type = 'button';
      b.title = T.agentStopTitle;
      b.appendChild(ic('stop'));
      b.appendChild(el('span', '', T.agentStop));
      if (agentsStopping[r.id]) b.disabled = true;
      b.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        agentsStopping[r.id] = true;
        b.disabled = true;
        vscode.postMessage({ type: 'agent_command', name: 'stop_agent', value: r.id });
      };
      acts.appendChild(b);
    }
    const open = () => openAgent(r.id, r.title);
    // The whole row opens the transcript; a finished one says so with a button.
    if (!r.active) {
      const b = el('button', 'mini m-open');
      b.type = 'button';
      b.title = T.agentOpenTitle;
      b.appendChild(ic('chev-r'));
      b.appendChild(el('span', '', T.winOpen));
      b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); open(); };
      acts.appendChild(b);
    }
    row.appendChild(acts);
    row.onclick = open;
    winKey(row, open);
    list.appendChild(row);
  }
  agentsBox.appendChild(list);
  // Durations tick while something runs. Only the text changes: rebuilding
  // the rows every second would swallow a click landing mid-rebuild.
  if (v.running && !agentsTick) agentsTick = setInterval(tickAgents, 1000);
  else if (!v.running && agentsTick) { clearInterval(agentsTick); agentsTick = null; }
  winRail();
};
function winMoreBtn(id, label, title, hot) {
  const b = el('button', 'mini m-more ag-more' + (hot ? ' hot' : ''), label);
  b.type = 'button';
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
tickAgents = function () {
  for (const id of Object.keys(agentRowMeta)) {
    const rec = agentRecord(id);
    if (rec) agentRowMeta[id].textContent = winAgentTime(rec, true);
  }
};

// ── the machine and getting started ──
function winCloseCards() {
  machineOpen = false; machineQr = false;
  startForced = false; startQr = false;
  renderMachine();
  renderStart();
  winSync();
}
renderMachine = function () {
  const on = machineOpen || (winIsEmpty() && !!machineData);
  machineBox.innerHTML = '';
  machineBox.classList.toggle('on', on);
  if (!on) return;
  const m = machineData && machineData.machine;
  const head = el('div', 'card-h');
  head.appendChild(ic('monitor'));
  head.appendChild(el('h3', '', T.machineTitle));
  if (m) {
    const s = el('span', 'card-s');
    s.appendChild(el('span', 'dot ' + (winReach(m) ? 'ok' : 'warn')));
    s.appendChild(el('span', '', winReach(m) ? T.winOnline : T.winLocal));
    s.title = winReach(m) ? T.reachWeb : T.reachNoWeb;
    head.appendChild(s);
  }
  const r = winIconBtn('refresh', T.machineRefresh, () => vscode.postMessage({ type: 'machine_refresh' }));
  r.classList.add('mc-refresh');
  head.appendChild(r);
  const x = winIconBtn('x', T.machineClose, winCloseCards);
  x.classList.add('card-x');
  x.classList.add('mc-close');
  head.appendChild(x);
  machineBox.appendChild(head);
  if (!m) {
    machineBox.appendChild(el('div', 'mc-note', machineOld ? T.machineOld : T.machineLoading));
    return;
  }
  const dl = el('dl', 'mc');
  for (const row of machineRows(machineData, T, Date.now())) {
    const d = el('div', 'mc-row' + (row.tone ? ' ' + row.tone : ''));
    d.setAttribute('data-row', row.key);
    d.appendChild(el('dt', '', row.label));
    const v = el('dd', '');
    if (row.key === 'models' && (m.sources || []).length) {
      for (const s of m.sources) {
        const line = el('span', 'src ' + (s.alive ? 'ok' : 'bad'));
        line.appendChild(el('span', 'dot ' + (s.alive ? 'ok' : 'warn')));
        line.appendChild(el('span', '', s.title));
        line.appendChild(el('small', '', s.alive ? (winAgo(s.checked_at) || T.srcAlive) : T.srcDead));
        v.appendChild(line);
      }
    } else {
      if (row.value) v.appendChild(el('span', '', row.value));
      for (const line of row.lines) v.appendChild(el('small', '', line));
    }
    d.appendChild(v);
    dl.appendChild(d);
  }
  machineBox.appendChild(dl);
  const foot = el('div', 'card-f');
  if (machineData.phone_url) {
    const q = el('button', 'btn2 mc-qr');
    q.type = 'button';
    q.appendChild(ic('qr'));
    q.appendChild(el('span', '', machineQr ? T.stPhoneHide : T.machineQr));
    q.onclick = () => { machineQr = !machineQr; renderMachine(); };
    foot.appendChild(q);
  }
  machineBox.appendChild(foot);
  if (machineQr) machineBox.appendChild(qrBlock());
};
function winStepValue(id, bound) {
  const m = machineData && machineData.machine;
  if (!m) return '';
  if (id === 'login') return m.email_masked || stateData.user || '';
  if (id === 'models') return T.winSources.replace('{n}', (m.sources || []).filter(s => s.alive).length);
  if (id === 'sync') return m.sync && m.sync.enabled ? T.syncOn : '';
  if (id === 'project') return bound && bound.name ? bound.name : '';
  return '';
}
renderStart = function () {
  const bound = inboxData && inboxData.bound_workspace;
  const steps = machineData ? startSteps(machineData, bound, T, Date.now()) : [];
  const done = steps.filter(s => s.done).length;
  // "Empty" as the window means it: no message and no turn in flight.
  const on = !viewAgent &&
    showStart({ steps, dismissed: startDismissed, chatEmpty: winIsEmpty(), forced: startForced });
  // The sidebar shows the count whether the card is on screen or not.
  $id('sideStart').hidden = !steps.length;
  $id('sideStartV').textContent = steps.length ? T.winStepsOf.replace('{d}', done).replace('{n}', steps.length) : '';
  startBox.innerHTML = '';
  startBox.classList.toggle('on', on);
  if (!on) return;
  const head = el('div', 'card-h');
  head.appendChild(ic('flag'));
  head.appendChild(el('h3', '', T.winStart));
  head.appendChild(el('span', 'card-s st-count', T.winStepsOf.replace('{d}', done).replace('{n}', steps.length)));
  const x = winIconBtn('x', T.startClose, () => {
    startForced = false;
    startDismissed = true;
    startQr = false;
    vscode.postMessage({ type: 'start_dismiss' });
    renderStart();
    winSync();
  });
  x.classList.add('st-close');
  head.appendChild(x);
  startBox.appendChild(head);
  startBox.appendChild(el('p', 'st-lead', T.startLead));
  const prog = el('div', 'st-prog');
  prog.setAttribute('aria-hidden', 'true');
  for (const s of steps) prog.appendChild(el('i', s.done ? '' : 'todo'));
  startBox.appendChild(prog);
  const list = el('ol', 'steps');
  let n = 0, first = true;
  for (const s of steps) {
    n++;
    const row = el('li', 'step ' + (s.done ? 'done' : 'todo'));
    row.setAttribute('data-step', s.id);
    if (!s.done && first) { row.classList.add('next'); first = false; }
    const mark = el('span', 'mark');
    mark.title = s.done ? T.stDone : T.stTodo;
    if (s.done) mark.appendChild(ic('check')); else mark.textContent = String(n);
    row.appendChild(mark);
    const body = el('div', 'st-b');
    body.appendChild(el('b', 'st-name', s.title));
    if (s.done) {
      const v = winStepValue(s.id, bound);
      if (v) { const sv = el('span', 'st-v', v); sv.title = v; body.appendChild(sv); }
      row.title = [s.why].concat(s.lines).join('\n');
    } else {
      body.appendChild(el('span', 'st-why', s.why));
      for (const line of s.lines) body.appendChild(el('span', 'st-line', line));
    }
    if (s.action) {
      let label = s.actionLabel;
      if (s.action === 'qr' && startQr) label = T.stPhoneHide;
      if (s.action === 'sync_on') label = T.stSyncBtnCopy;
      const b = el('button', (s.done ? 'btn2' : 'btn') + ' st-act' + (s.action === 'connect' ? ' keep-menu' : ''));
      b.type = 'button';
      if (s.action === 'qr') b.appendChild(ic('qr'));
      const lab = el('span', '', label);
      b.appendChild(lab);
      // startAction writes "copied" into what it is given: the label, not the icon.
      b.onclick = () => startAction(s.action, lab);
      body.appendChild(b);
    }
    if (s.id === 'phone' && startQr) body.appendChild(qrBlock());
    row.appendChild(body);
    list.appendChild(row);
  }
  startBox.appendChild(list);
};
// Opened by hand (the sidebar, the menu): over a working chat the card comes
// up at once, not when the agent answers. An empty chat already shows it:
// there it is only refreshed and brought into view.
const winOpenMachineCard = openMachine;
openMachine = function () {
  if (winIsEmpty() && machineData) {
    vscode.postMessage({ type: 'machine_refresh' });
    if (machineBox.scrollIntoView) machineBox.scrollIntoView({ block: 'nearest' });
    return;
  }
  winOpenMachineCard();
  winSync();
};
function winOpenMachine() {
  winSideOpen(false);
  openMachine();
}
$id('sideMachine').onclick = winOpenMachine;
$id('stSync').onclick = winOpenMachine;
$id('sideStart').onclick = () => { winSideOpen(false); vscode.postMessage({ type: 'start_reopen' }); };
sheetEl.onclick = (e) => { if (e && e.target === sheetEl) winCloseCards(); };

// ── what frames the chat: selectors, the status line, the account ──
function winSel(id, icon, key, value, bars) {
  const b = $id(id);
  b.innerHTML = '';
  b.appendChild(ic(icon));
  b.appendChild(el('span', 'sel-k', key));
  b.appendChild(el('span', 'sel-v', value || '…'));
  if (bars) {
    const lvl = el('span', 'lvl');
    lvl.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < bars[1]; i++) lvl.appendChild(el('i', i < bars[0] ? 'on' : ''));
    b.appendChild(lvl);
  }
  b.appendChild(ic('chev-d', 'sel-c'));
}
function winStat(id, icon, text, title) {
  const n = $id(id);
  n.innerHTML = '';
  n.classList.toggle('on', !!text);
  if (!text) return;
  if (icon) n.appendChild(ic(icon));
  n.appendChild(el('span', '', text));
  if (title !== undefined) n.title = title;
}
function winChrome() {
  statusEl.innerHTML = '';
  winSel('selModel', 'cube', T.winModel, stateData.model);
  winSel('selSource', 'plug', T.winSource, stateData.source);
  // Reasoning: the level by name and as bars — how far up the agent's list it is.
  const levels = (stateData.efforts || []).filter(x => x.id !== 'off');
  const at = levels.findIndex(x => x.id === stateData.effort);
  winSel('selEffort', 'gauge', T.winEffort, stateData.effort, levels.length ? [at + 1, levels.length] : null);
  $id('selModel').title = T.mModel + (stateData.model ? ': ' + stateData.model : '') + T.winClickChange;
  $id('selSource').title = T.mSource + (stateData.source ? ': ' + stateData.source : '') + T.winClickChange;
  $id('selEffort').title = T.mEffort + (stateData.effort ? ': ' + stateData.effort : '') + T.winClickChange;

  const m = machineData && machineData.machine;
  winStat('stSec', 'shield', stateData.security ? T.winSecurity + stateData.security : '');
  const sy = m && m.sync;
  winStat('stSync', 'sync', sy ? T.winSync + (sy.enabled ? (winAgo(sy.last_push_at) || T.syncOn) : T.syncOff) : '');
  // Tasks from the site: the same line the menu shows.
  const inbox = inboxMenuEntries(inboxData, T, PAYMENT_URL)[0];
  winStat('stInbox', 'globe', inbox ? inbox.label : '', inbox ? inbox.label : '');
  winStat('stHost', '', m && m.name ? m.name : '');
  const ver = (m && m.version) || CFG.version || '';
  winStat('stVer', '', ver ? 'execai ' + ver : '');
  $id('topMeta').classList.toggle('on', !!(m && m.name));
  $id('topDot').className = 'dot ' + (winReach(m) ? 'ok' : 'warn');
  $id('topHost').textContent = m && m.name ? m.name : '';
  $id('topVer').textContent = ver ? 'execai ' + ver : '';
  $id('sideVer').textContent = ver;

  const mv = $id('sideMachineV');
  mv.innerHTML = '';
  if (m) {
    mv.appendChild(el('span', 'dot ' + (winReach(m) ? 'ok' : 'warn')));
    mv.appendChild(el('span', '', winReach(m) ? T.winOnline : T.winLocal));
  }
  const user = stateData.user || (m && m.logged_in ? m.email_masked : '');
  $id('acctMail').textContent = user || T.accNone;
  $id('acctMail').title = user || '';
  $id('acctAva').textContent = user ? user.charAt(0) : '?';
  $id('acctPlan').textContent = m && m.logged_in ? (m.plan ? T.planLabel + winPlan(m.plan) : T.planNone) : '';
  $id('acctLogin').hidden = !!user;
  $id('acct').classList.toggle('anon', !user);

  // The project of this folder, when the agent knows the account.
  const known = !!(inboxData && inboxData.state && inboxData.state !== 'not_logged_in' && inboxData.state !== 'no_plan');
  const ws = known ? inboxData.bound_workspace : null;
  const tag = $id('projTag');
  tag.textContent = known ? (ws ? T.winBound : T.projectNone) : '';
  tag.classList.toggle('ok', !!ws);
  tag.title = ws ? T.winBoundTo + ws.name + '\n' + T.winBindHint : T.winBindHint;
}
renderStatus = winChrome;
// The parts of the page that never change: the folder this window serves.
function winStatic() {
  const cwd = CFG.cwd || '';
  const name = winBase(cwd);
  $id('projName').textContent = name;
  $id('projName').title = cwd;
  $id('projPath').textContent = cwd;
  $id('projPath').title = cwd;
  $id('headProj').textContent = name;
  $id('headPath').textContent = cwd;
  $id('headPath').title = cwd;
  $id('topPath').textContent = cwd;
  $id('topPath').title = cwd;
}
$id('projTag').onclick = () => vscode.postMessage({ type: 'pick_workspace' });
$id('acctLogin').onclick = () => vscode.postMessage({ type: 'agent_command', name: 'login' });
$id('navBtn').onclick = winSideToggle;
$id('scrim').onclick = () => winSideOpen(false);
for (const b of winAll('.js-side')) b.onclick = winSideToggle;
// "+" after the tab strip is always on the page; the other new-chat buttons are found by class.
$id('newTab').onclick = winNewChat;
for (const b of winAll('.js-new')) b.onclick = winNewChat;
for (const b of winAll('.sg')) {
  b.onclick = () => {
    inp.value = T['winSg' + b.getAttribute('data-sg') + 'D'] || '';
    winGrow();
    inp.focus();
  };
}

// The turn: its clock in three places, the step, questions left unanswered.
function winTick() {
  const t = winClock((Date.now() - timerT0) / 1000);
  for (const id of ['timer', 'turnTime', 'stTime']) $id(id).textContent = t;
}
startTimer = function () {
  timerT0 = Date.now();
  winIter = 0;
  winTick();
  clearInterval(timerId);
  timerId = setInterval(winTick, 500);
};
function winTurn() {
  const max = stateData.maxIter || 0;
  const put = (tpl) => tpl.replace('{i}', winIter).replace('{m}', max);
  $id('turnStep').textContent = winIter ? put(max ? T.winStep : T.winStepN) : '';
  $id('stStep').textContent = winIter ? put(max ? T.winStepShort : T.winStepN) : '';
  let waiting = 0;
  for (const id of Object.keys(asks)) {
    const b = asks[id];
    if (b && b.parentElement && !b.classList.contains('answered')) waiting++;
  }
  // Esc stops the turn — while a permission request is open it refuses that instead.
  $id('turnEsc').hidden = winPermAsks().length > 0 || !!viewAgent;
  const w = $id('turnWait');
  w.innerHTML = '';
  w.classList.toggle('on', waiting > 0);
  if (waiting) {
    w.appendChild(ic('question'));
    w.appendChild(el('span', '', T.winWaits.replace('{n}', waiting)));
  }
}

// ── menus ──
// The panel's menu, as it is, hung on whatever opened it; its rows take the
// keyboard: arrows, Enter, Esc.
function winMenuItems() { return menu.querySelectorAll('[role="menuitem"]'); }
function winMenuPolish() {
  for (const d of menu.querySelectorAll('.mi')) {
    const c = d.firstChild;
    if (c && c.classList && c.classList.contains('check') && !c.children.length) {
      const mark = c.textContent;
      if (mark === '✓') { c.textContent = ''; c.appendChild(ic('check')); d._on = true; }
      else if (mark) { c.textContent = ''; c.appendChild(ic('globe')); }
    }
    // The card is called "Getting started" here; so is the way to it.
    if (d.getAttribute('data-mi') === 'start' && d.children[1]) d.children[1].textContent = T.winStart;
    if (!d.onclick) continue;
    d.setAttribute('role', 'menuitem');
    d.tabIndex = -1;
  }
  const items = winMenuItems();
  if (items.length) items[winMenuStart(items)].tabIndex = 0;
}
// Where the keyboard enters a list: at what is chosen now (a long list is
// scrolled to it by the focus), at the first line of anything else.
function winMenuStart(items) {
  if (menuView === 'root') return 0;
  return Math.max(0, Array.prototype.findIndex.call(items, (n) => !!n._on));
}
function winMenuPlace() {
  if (!menu.classList.contains('open')) return;
  winPlace(menu, winMenuAnchor || $id('cmdBtn'));
}
function winMenuWrap(draw) {
  return function () {
    const active = document.activeElement;
    let at = -1;
    if (active && menu.contains && menu.contains(active)) at = Array.prototype.indexOf.call(winMenuItems(), active);
    const view = menuView;
    draw.apply(null, arguments);
    winMenuPolish();
    winMenuPlace();
    // Some callers put the menu on screen only after drawing it.
    setTimeout(winMenuPlace, 0);
    const items = winMenuItems();
    // Opened by hand, or another list in place of the one the focus was in:
    // from its start. Drawn anew with the same list: the focus stays where it was.
    const to = winMenuFresh || (at >= 0 && menuView !== view) ? winMenuStart(items) : at;
    winMenuFresh = false;
    if (to >= 0 && items.length) {
      const n = items[Math.min(to, items.length - 1)];
      setTimeout(() => { if (menu.classList.contains('open') && n.focus) n.focus(); }, 0);
    }
  };
}
const winMenuChatsDraw = menuChats;
menuChats = winMenuWrap(function () {
  winMenuChatsDraw();
  // A chat without a title is "New chat" on its tab; so it is in the history.
  let n = 0;
  for (const d of menu.querySelectorAll('.mi')) {
    if (!d.onclick) continue;
    const c = chatsData[n++];
    if (c && !(c.label || '').trim() && d.children[1]) d.children[1].textContent = T.untitledChat;
  }
});
let winListDirect = '';   // the list on screen was opened by its own selector, not from the root menu
const winMenuRootDraw = menuRoot;
menuRoot = winMenuWrap(function () { winListDirect = ''; winMenuRootDraw(); });
const winMenuListDraw = menuList;
menuList = winMenuWrap(function (kind) {
  winMenuListDraw(kind);
  // Opened by its own selector, a list has no menu to go back to.
  if (winListDirect === kind) {
    const head = menu.querySelector('.head');
    if (head && head.children.length > 1) head.children[0].remove();
  }
  if (kind !== 'sources') return;
  // Picked in the root menu, a source leaves that menu open (the panel's way);
  // picked from the selector under the input, it closes the list.
  if (winListDirect === 'sources') {
    for (const d of menu.querySelectorAll('.mi')) {
      const pick = d.onclick;
      if (pick) d.onclick = () => { pick(); closeMenu(); };
    }
  }
  // Connecting a new source is one step away from picking one.
  menu.appendChild(el('div', 'sep'));
  menu.appendChild(mi(T.mConnect, '', () => { winListDirect = ''; menuList('connectable'); }, false, 'connect'));
});
const winMenuClose = closeMenu;
closeMenu = function () {
  const active = document.activeElement;
  const inside = menu.classList.contains('open') && active && menu.contains && menu.contains(active);
  winMenuClose();
  if (inside && winMenuAnchor && winMenuAnchor.focus) winMenuAnchor.focus();
};
menu.onkeydown = (e) => {
  const items = Array.prototype.slice.call(winMenuItems());
  if (!items.length) return;
  const at = items.indexOf(document.activeElement);
  let to = -1;
  if (e.key === 'ArrowDown') to = (at + 1) % items.length;
  else if (e.key === 'ArrowUp') to = (at - 1 + items.length) % items.length;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = items.length - 1;
  else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) { e.preventDefault(); items[at].onclick(); return; }
  if (to < 0) return;
  e.preventDefault();
  items[to].focus();
};
// Whatever opens the menu becomes its anchor (capture: before the click itself).
document.addEventListener('click', (e) => {
  const path = e.composedPath ? e.composedPath() : [];
  for (const n of path) {
    if (n && n.classList && n.classList.contains && (n.classList.contains('keep-menu') || n.id === 'cmdBtn')) {
      winMenuAnchor = n;
      winMenuFresh = true;
      break;
    }
  }
  if (popEl.classList.contains('open') && !path.includes(popEl) && !path.includes($id('lookBtn'))) winPopClose();
}, true);
function winOpenList(kind) {
  if (menuView === kind) { closeMenu(); return; }
  winPopClose();
  vscode.postMessage({ type: 'agent_command', name: 'state' }); // fresh lists
  winListDirect = kind;
  menuList(kind);
  menu.classList.add('open');
  winMenuPlace();
}
$id('selModel').onclick = () => winOpenList('models');
$id('selSource').onclick = () => winOpenList('sources');
$id('selEffort').onclick = () => winOpenList('efforts');
$id('stSec').onclick = () => winOpenList('securities');
$id('stInbox').onclick = () => $id('cmdBtn').onclick();
for (const b of winAll('.js-menu')) b.onclick = () => $id('cmdBtn').onclick();
for (const b of winAll('.js-hist')) b.onclick = () => $id('histBtn').onclick();
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  winPopClose();
  winSideOpen(false);
  if (sheetEl.classList.contains('open')) winCloseCards();
  winTopSync();
});
window.addEventListener('resize', () => { closeMenu(); winPopClose(); winSideApply(); winTabsMore(); winTopSync(); });

// ── what is on top keeps the keyboard ──
// A dialog, a card over the window, the drawer of a narrow window: what lies
// under it is out of reach (inert) while it is open, and the focus comes back
// to what opened it. Menus, the look panel and toasts are drawn over all of
// it and stay in reach. The state is read from the page every time, never
// kept: nothing can stay out of reach after its cover is gone.
let winTopNow = null, winTopFrom = null;
function winTopOf() {
  const d = $id('dlg');
  if (d.classList.contains('open')) return d;
  if (sheetEl.classList.contains('open')) return sheetEl;
  if (appEl.classList.contains('side-open') && winNarrow()) return $id('side');
  return null;
}
function winSeen(n) { return !!n && n.isConnected !== false && (!n.getClientRects || n.getClientRects().length > 0); }
function winTopSync() {
  const top = winTopOf();
  if (top === winTopNow) return;
  const was = winTopNow, active = document.activeElement || null;
  winTopNow = top;
  const keep = [top, menu, popEl, $id('dlg'), $id('toasts'), $id('conn'), $id('srStatus')];
  if (top === $id('side')) keep.push($id('scrim'));
  for (const n of appEl.children) n.inert = !!top && keep.indexOf(n) < 0;
  if (top) {
    if (!was) winTopFrom = active && active !== document.body ? active : null;
    // After the one who opened it has put its own focus (a dialog does).
    setTimeout(() => {
      if (winTopNow !== top) return;
      const a = document.activeElement;
      if (a && a !== document.body && top.contains(a)) return;
      // A card is drawn anew when its data comes: the focus goes to what stays, the card itself.
      if (top === sheetEl) { infoEl.tabIndex = -1; infoEl.focus(); return; }
      for (const n of top.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')) {
        if (winSeen(n) && !n.disabled) { n.focus(); return; }
      }
    }, 0);
    return;
  }
  const back = winTopFrom;
  winTopFrom = null;
  // The focus was in what has closed, or nowhere: back to what opened it —
  // or, when that is gone with its menu, to the button of the menu.
  if (active && active !== document.body && !(was.contains && was.contains(active)) && winSeen(active)) return;
  const to = winSeen(back) ? back : $id('cmdBtn');
  if (to && to.focus) to.focus();
}
if (typeof MutationObserver === 'function') {
  const seen = new MutationObserver(winTopSync);
  for (const n of [appEl, sheetEl, $id('dlg')]) seen.observe(n, { attributes: true, attributeFilter: ['class'] });
}

// ── keys ──
// A permission request: y, a, s, f, n — its five answers; Enter — once;
// Esc — refuse. Esc with no request open stops the turn. Ctrl+N (Cmd+N on a
// Mac) — a new chat, where the browser hands the key to the page.
// Ctrl+Enter (Cmd+Enter) — once, from the input too, while the input is
// empty; with a message in it the chord sends the message, as it always did.
//
// What keeps them safe:
//   - a letter or Enter never acts while the cursor is in a text field —
//     there it is typing; Esc and Ctrl+N act from anywhere;
//   - from the input only "once" can be given — never "for the session" or
//     "forever" — and only when nothing is being written there;
//   - Enter on a button, a tab or a link does what that element does;
//   - only a request on screen is answered: one scrolled out of sight is
//     brought into view by Esc instead of being refused blind;
//   - a menu, the look panel, a card over the window, a dialog or the drawer
//     take Esc for themselves (it closes them) and nothing else happens;
//   - a key pressed in the first moment after a request appears is not taken
//     for an answer to it.
// The letters go by the key's place on the keyboard (event.code), so they
// work in any layout — Russian included.
const WIN_CODE_ANSWER = { KeyY: 'once', KeyA: 'session', KeyS: 'exact', KeyF: 'always', KeyN: 'deny' };
const WIN_CHAR_ANSWER = { y: 'once', a: 'session', s: 'exact', f: 'always', n: 'deny' };
let winOverlay = false;  // something that takes Esc for itself was open when the key went down
let winDraft = false;    // the input held a message (or files) when the key went down
function winOverlayOpen() {
  return menu.classList.contains('open') || popEl.classList.contains('open') || sheetEl.classList.contains('open') ||
    $id('dlg').classList.contains('open') || appEl.classList.contains('side-open');
}
function winTextTarget(t) {
  return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || !!t.isContentEditable);
}
// Enter belongs to the element under it when that element does something on Enter.
function winOwnsEnter(t) {
  for (let n = t; n && n !== document.body; n = n.parentElement) {
    if (/^(BUTTON|A|SUMMARY|INPUT|TEXTAREA|SELECT)$/.test(n.tagName || '')) return true;
    const role = n.getAttribute ? n.getAttribute('role') : '';
    if (role === 'button' || role === 'tab' || role === 'menuitem' || role === 'radio') return true;
  }
  return false;
}
// The reasoning line opens and closes from the keyboard as well as by a click.
function winThinkKey() {
  const node = curThinking, t = node && node.firstChild;
  if (!t || t._key || !t.onclick) return;
  t._key = true;
  const flip = t.onclick;
  const say = () => t.setAttribute('aria-expanded', node._body && node._body.classList.contains('open') ? 'true' : 'false');
  t.onclick = () => { flip(); say(); };
  t.setAttribute('role', 'button');
  say();
  winKey(t, () => t.onclick());
}
// Permission requests of the chat on screen still waiting for an answer, oldest first.
function winPermAsks() {
  const out = [];
  for (const id of Object.keys(asks)) {
    const b = asks[id];
    if (b && b.parentElement && b._opts && b._opts.deny && !b.classList.contains('answered')) out.push(b);
  }
  return out;
}
function winEat(e) { if (e.preventDefault) e.preventDefault(); }
function winOnScreen(box) {
  if (!box.getBoundingClientRect || !log.getBoundingClientRect) return true;
  const r = box.getBoundingClientRect(), f = log.getBoundingClientRect();
  return r.height > 0 && r.bottom > f.top + 12 && r.top < f.bottom - 12;
}
// Capture: before any other handler has closed what was open — or sent what
// was in the input (the input's own handler sends on Enter and empties it).
document.addEventListener('keydown', () => {
  winOverlay = winOverlayOpen();
  winDraft = !!(inp.value && inp.value.trim()) || attached.length > 0;
}, true);
document.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && !e.shiftKey && (e.code === 'KeyN' || (!e.code && String(e.key).toLowerCase() === 'n'))) {
    if ($id('dlg').classList.contains('open')) return;
    winEat(e);
    winNewChat();
    return;
  }
  // Ctrl+Enter is taken apart from the other chords: it is the one answer the input can give.
  const chord = mod && !e.altKey && !e.shiftKey && e.key === 'Enter';
  if ((mod && !chord) || e.altKey || winOverlay) return;
  const pending = winPermAsks();
  const seen = pending.filter(winOnScreen);
  // The request the focus is in, or the newest one on screen.
  const active = document.activeElement;
  const box = seen.find(b => active && b.contains && b.contains(active)) || seen[seen.length - 1];
  if (chord) {
    // A message being written (or files waiting to go) keeps the chord: it sends them.
    if (winDraft) return;
    // On a button other than the input the chord is that button's Enter.
    if (e.target !== inp && winOwnsEnter(e.target)) return;
    if (!box || !box._opts.once || Date.now() - box._at < 350) return;
    winEat(e);
    box._opts.once.onclick();
    return;
  }
  if (e.key === 'Escape') {
    if (box) {
      winEat(e);
      box._opts.deny.onclick();
    } else if (pending.length) {
      const last = pending[pending.length - 1];
      if (last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
    } else if (document.body.classList.contains('busy') && !viewAgent) {
      winEat(e);
      vscode.postMessage({ type: 'stop' });
    }
    return;
  }
  if (!box || e.shiftKey || winTextTarget(e.target) || Date.now() - box._at < 350) return;
  let answer = '';
  if (e.key === 'Enter') answer = winOwnsEnter(e.target) ? '' : 'once';
  else answer = WIN_CODE_ANSWER[e.code] || (e.code ? '' : WIN_CHAR_ANSWER[String(e.key).toLowerCase()]) || '';
  if (!answer || !box._opts[answer]) return;
  winEat(e);
  box._opts[answer].onclick();
});

// ── the state of the window: an empty chat or a working one ──
function winRail() {
  const cards = machineBox.classList.contains('on') || startBox.classList.contains('on');
  const rail = winEmpty
    ? winWide() && cards
    : agentsBox.classList.contains('on') || filesBox.classList.contains('on');
  appEl.classList.toggle('no-rail', !rail);
  infoEl.hidden = !cards;
}
function winSync() {
  const empty = winIsEmpty();
  if (empty !== winEmpty) {
    // Leaving an empty chat: a card opened in it stays behind.
    if (winEmpty && !empty) { machineOpen = false; machineQr = false; startForced = false; }
    winEmpty = empty;
    appEl.classList.toggle('is-empty', empty);
    appEl.classList.toggle('is-work', !empty);
    renderMachine();
    renderStart();
  }
  // The greeting lives in the feed while the chat is empty.
  if (empty) {
    welcomeEl.hidden = false;
    if (welcomeEl.parentElement !== log) log.insertBefore(welcomeEl, log.firstChild);
  } else if (welcomeEl.parentElement === log) {
    welcomeEl.remove();
  }
  // The cards: beside an empty chat (inside the feed in a narrower window),
  // over the window when opened by hand in a working one.
  const cards = machineBox.classList.contains('on') || startBox.classList.contains('on');
  const pop = !empty && cards;
  const where = empty ? (winWide() ? railEl : log) : (pop ? sheetEl : railEl);
  if (infoEl.parentElement !== where) where.appendChild(infoEl);
  else if (where === log && log.children[log.children.length - 1] !== infoEl) log.appendChild(infoEl);
  sheetEl.classList.toggle('open', pop);
  winTopSync();
  winRail();
  winTurn();
  winTitles();
}
if (window.matchMedia) {
  for (const p of [['(min-width: 1100px)', winSync], ['(max-width: 719px)', () => { winSideOpen(false); winSideApply(); renderAgents(); }]]) {
    const mq = window.matchMedia(p[0]);
    if (mq.addEventListener) mq.addEventListener('change', p[1]);
    else if (mq.addListener) mq.addListener(p[1]);
  }
}

// After the panel's own handler: what an event means for the window around the feed.
window.addEventListener('message', (ev) => {
  if (ev.origin !== 'execai-host') return;
  const e = ev.data;
  if (!e || typeof e.type !== 'string') return;
  switch (e.type) {
    case 'text_delta':
      // The answer was drawn anew from its markdown: its code gets its lines back.
      winCodeLines(curAssistant);
      // fall through
    case 'reasoning_delta':
      if (e.type === 'reasoning_delta') winThinkKey();
      // A stream of these: nothing around the feed changes, unless it was empty.
      if (!winEmpty) return;
      break;
    case 'tool_chunk': {
      // Output is running: show it while it runs.
      const t = tools[e.id];
      if (t && t.box.classList.contains('run')) {
        if (!t.touched && !t.box.open) { t.box.open = true; t.auto = true; }
        t.out.scrollTop = t.out.scrollHeight;
        scroll();
      }
      return;
    }
    case 'iteration':
      winIter = e.n || 0;
      break;
    case 'turn_start':
      winSent = null;
      break;
    case 'done':
    case 'agent_exit':
      winIter = 0;
      // Every finished answer can be copied, not only the last one of the turn.
      for (const a of log.querySelectorAll('.msg.assistant')) decorate(a);
      break;
    case 'chat_reset':
      // A first message makes the agent open a chat for it, and the reset
      // that announces the chat has just cleared the feed — the message
      // with it. It is the beginning of that chat: put it back.
      if (e.chat && winSent && !winSent.parentElement) log.appendChild(winSent);
      // A new chat asked for here starts clean: nothing sent before belongs to it.
      if (!e.chat) winSent = null;
      // fall through
    case 'chat_loaded':
    case 'agent_loaded':
      if (e.type !== 'chat_reset') winSent = null;
      winIter = 0;
      winFiles = [];
      winRenderFiles();
      winPinned = true;
      break;
    case 'state':
      if (popEl.classList.contains('open')) winRenderPop();
      break;
    case 'machine_state':
    case 'machine_clear':
      winChrome();
      break;
  }
  winSync();
  // Asked for from the sidebar or the menu: the card comes into view.
  if (e.type === 'start_show' && startBox.scrollIntoView) startBox.scrollIntoView({ block: 'nearest' });
});

winApplyLook();
winStatic();
winChrome();
renderChips();
renderTabs();
winRenderFiles();
winSync();
// The keys as this keyboard has them.
if (WIN_MAC) {
  for (const k of winAll('.hero kbd')) k.textContent = '⌘ V';
  $id('newKey').textContent = '⌘ N';
}
winSideApply();
winTabsMore();
// A window for typing: the input has the focus from the start (not where a
// keyboard would cover half of a small screen).
if (!winNarrow() && inp.focus) inp.focus();
`;
