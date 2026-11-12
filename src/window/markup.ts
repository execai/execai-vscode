// The static markup of the `execai ui` window: one for all three skins.
//
// A skin only restyles it (and hides what it does not use: the tab strip in
// «Беседа», the heading in «Верстак»…); what is on the page is the same.
// Ids the panel script and browserHost.ts rely on are kept as they are in
// the editor panel: tabs, log, agents, menu, status, chips, box, inp, bar,
// filesBtn, cmdBtn, histBtn, sendBtn, stopBtn, timer, ro, roBack, start,
// machine, toasts, dlg.
//
// What a skin may want but not every skin shows is in the markup and hidden
// by base.ts until a skin turns it on:
//   .key       a key drawn on a button: kbd.key inside .newchat ("Ctrl N");
//              the page script adds kbd.key to the answers of a permission
//              request (.opt > .key: y, a, s, f, n);
//   .key-line  a line of key hints: .turn-esc in the turn line ("Esc — stop"),
//              .ask-hint under the answers of a permission request (its
//              parts: Enter, then .ah-3 — Ctrl+Enter, then .ah-2 — Esc).
// The keys themselves work whether a skin shows the hints or not.
// A collapsed sidebar: .app.side-off; .side-show marks what appears only then
// (the button that brings the sidebar back, a new-chat button).

/** Line icons, 24×24, drawn with the current colour. */
const WINDOW_ICONS: Record<string, string> = {
  'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'x': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  'chev-d': '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
  'chev-r': '<path d="M9.5 6.5l5.5 5.5-5.5 5.5"/>',
  'folder': '<path d="M3.5 8a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  'agents': '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6 8.2V10a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.2M12 13v2.8"/>',
  'alarm': '<circle cx="12" cy="13" r="7"/><path d="M12 9.5V13l2.5 1.5M5.5 4.5l-2 2M18.5 4.5l2 2"/>',
  'globe': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',
  'monitor': '<rect x="3.5" y="5" width="17" height="11.5" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
  'flag': '<path d="M6 21V4.5M6 5h11l-2.2 3.5L17 12H6"/>',
  'sliders': '<path d="M4 7.5h8M16.5 7.5H20M4 16.5h3.5M12 16.5h8"/><circle cx="14.2" cy="7.5" r="2.2"/><circle cx="9.8" cy="16.5" r="2.2"/>',
  'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  'dots': '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  'file': '<path d="M7.5 3.5h6.5l4.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M14 3.5V8h4.5"/>',
  'image': '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.5-4 3.5 3 2.5-2 4.500 4"/>',
  'terminal': '<path d="M5 8l4.5 4L5 16M12.5 16.5H19"/>',
  'search': '<circle cx="11" cy="11" r="6.2"/><path d="M20 20l-4.4-4.4"/>',
  'question': '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3 1-1.3 2M12 16.4v.4"/>',
  'pencil': '<path d="M4.5 19.5l1.2-4.4L16.3 4.5l3.2 3.2L8.9 18.3zM14 6.8l3.2 3.2"/>',
  'sync': '<path d="M4.5 10a7.6 7.6 0 0 1 13.6-3M19.5 14a7.6 7.6 0 0 1-13.6 3"/><path d="M18.6 3.5V7h-3.5M5.4 20.5V17h3.5"/>',
  'shield': '<path d="M12 3.5l7 2.6v5.4c0 4.2-2.8 7.4-7 9-4.2-1.6-7-4.8-7-9V6.1z"/>',
  'refresh': '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5V8H16"/>',
  'qr': '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><path d="M13.5 13.5h3v3h-3zM19.5 13.5v1M19.5 17.5V20H17M13.5 20h1"/>',
  'clip': '<path d="M19 11.5l-7.2 7.2a4.2 4.2 0 0 1-6-6l7.7-7.7a2.9 2.9 0 0 1 4.1 4.1L10 16.7a1.5 1.5 0 0 1-2.2-2.2l6.4-6.4"/>',
  'cube': '<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7L12 12l7.5-4.3M12 12v8.5"/>',
  'plug': '<path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0zM12 16v4.5"/>',
  'gauge': '<path d="M4.6 16.5a8 8 0 1 1 14.8 0"/><path d="M12 13.5l3.6-4.3"/><circle cx="12" cy="13.8" r="1.3" fill="currentColor"/>',
  'send': '<path d="M12 19V5.5M5.8 11.5L12 5.3l6.2 6.2"/>',
  'sidebar': '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M9.5 5v14"/>',
  'ban': '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  'stop': '<rect x="7" y="7" width="10" height="10" rx="1.8" fill="currentColor" stroke="none"/>',
  'sun': '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.800 12H21M5.6 5.6l1.6 1.6M16.800 16.800l1.6 1.6M5.6 18.4l1.6-1.6M16.800 7.2l1.6-1.6"/>',
  'look': '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9.5 9.5v10"/>',
  'moon': '<path d="M19.5 14.3A8 8 0 0 1 9.7 4.5a8 8 0 1 0 9.8 9.800z"/>',
};

function sprite(): string {
  const symbols = Object.entries(WINDOW_ICONS)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${symbols}</svg>`;
}

/** The names the page script may pass to its ic() helper. */
export const ICON_NAMES = Object.keys(WINDOW_ICONS);

function escMarkup(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Runs in <head>, before anything is painted: the look the person chose
 * (localStorage) goes onto <html> — the skin as a class, an explicit theme
 * as data-theme. Without storage, or with nothing stored, the page keeps
 * the default skin and follows the system theme. `skins` and `fallback` are
 * skin ids (see skins/index.ts).
 */
export function headScript(skins: string[], fallback: string): string {
  // The theme is dark until the person picks one — whatever the system is
  // set to. "As the system" is a pick like the other two and is kept as one.
  // fresh: nothing has been picked yet (the window then shows the looks).
  return `(function () {
  var d = document.documentElement, skins = ${JSON.stringify(skins)}, s = ${JSON.stringify(fallback)}, t = 'dark', own = false;
  try {
    var a = localStorage.getItem('execai:ui:skin');
    if (skins.indexOf(a) >= 0) { s = a; own = true; }
    var b = localStorage.getItem('execai:ui:theme');
    if (b === 'light' || b === 'dark' || b === 'system') { t = b; own = true; }
  } catch (e) { /* no storage: the defaults */ }
  d.className = 'sk-' + s;
  if (t === 'system') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', t);
  window.execaiLook = { skin: s, theme: t, skins: skins, fresh: !own };
})();`;
}

/** Everything inside <body> of the window, before the scripts. */
export function windowMarkup(T: Record<string, string>): string {
  const t = (k: string) => {
    if (!(k in T)) throw new Error('window markup: no string ' + k);
    return escMarkup(T[k]);
  };
  const i = (name: string, cls = '') => {
    if (!(name in WINDOW_ICONS)) throw new Error('window markup: no icon ' + name);
    return `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  };
  // The look, in the header of a skin: what is on now, by name, and the theme
  // beside it. One per header — a skin shows the header it has.
  const lookCtl = (at: string) => `<div class="lookctl">
      <button type="button" class="lookbtn" id="look-${at}" title="${t('winLook')}" aria-haspopup="dialog" aria-expanded="false">${i('look')}<span class="lb-k">${t('winSkin')}</span><b class="lb-v" id="lookName-${at}"></b>${i('chev-d', 'lb-c')}</button>
      <div class="seg thseg" role="radiogroup" aria-label="${t('winTheme')}">
        <button type="button" role="radio" aria-checked="false" id="thL-${at}" title="${t('winThemeLight')}">${i('sun')}<span>${t('winThemeLight')}</span></button>
        <button type="button" role="radio" aria-checked="false" id="thD-${at}" title="${t('winThemeDark')}">${i('moon')}<span>${t('winThemeDark')}</span></button>
      </div>
    </div>`;
  const sg = (n: number, icon: string) =>
    `<button type="button" class="sg" data-sg="${n}"><span class="sg-ic">${i(icon)}</span><b>${t('winSg' + n)}</b><span class="sg-d">${t('winSg' + n + 'D')}</span></button>`;
  return `
${sprite()}
<div class="app is-empty no-rail" id="app">
  <header class="top">
    <button type="button" class="ib navbtn" id="navBtn" title="${t('winNav')}" aria-label="${t('winNav')}" aria-expanded="false">${i('menu')}</button>
    <span class="brand">ExecAI<i class="cur" aria-hidden="true"></i></span>
    <span class="crumb"><span class="c-path" id="topPath"></span><span class="c-sep" aria-hidden="true">/</span><span class="c-chat" id="topChat"></span></span>
    ${lookCtl('top')}
    <span class="top-meta" id="topMeta"><span class="dot" id="topDot"></span><span id="topHost"></span><span class="tm-ver" id="topVer"></span></span>
    <button type="button" class="ib top-new js-new" title="${t('mNewChat')}" aria-label="${t('mNewChat')}">${i('plus')}</button>
  </header>

  <aside class="side" id="side" aria-label="${t('winChats')}">
    <div class="s-brand"><span class="brand">ExecAI<i class="cur" aria-hidden="true"></i></span><span class="s-ver" id="sideVer"></span><button type="button" class="ib s-collapse js-side" title="${t('winSideHide')}" aria-label="${t('winSideHide')}">${i('sidebar')}</button></div>
    <button type="button" class="newchat js-new">${i('plus')}<span>${t('mNewChat')}</span><kbd class="key" id="newKey">Ctrl N</kbd></button>
    <section class="side-look" aria-label="${t('winLook')}"><div class="s-label"><span>${t('winSkin')}</span></div><div class="lookbox in-side" id="sideLook"></div></section>
    <div class="s-scroll">
      <div class="s-label"><span>${t('mProject')}</span></div>
      <div class="proj">
        <div class="proj-h">${i('folder', 'p-ic')}<span class="p-name" id="projName"></span><button type="button" class="p-tag" id="projTag"></button></div>
        <div class="p-path" id="projPath"></div>
        <div class="chats" id="sideChats"></div>
      </div>
      <div class="s-label" id="sideHistLabel" hidden><span>${t('histHead')}</span></div>
      <div class="chats hist" id="sideHist"></div>
    </div>
    <div class="s-foot">
      <button type="button" class="s-link" id="sideMachine">${i('monitor')}<span class="sl-t">${t('mMachine')}</span><span class="sl-v" id="sideMachineV"></span></button>
      <button type="button" class="s-link" id="sideStart">${i('flag')}<span class="sl-t">${t('winStart')}</span><span class="sl-v" id="sideStartV"></span></button>
      <div class="acct" id="acct">
        <span class="ava" id="acctAva" aria-hidden="true"></span>
        <span class="a-main"><span class="a-mail" id="acctMail"></span><span class="a-plan" id="acctPlan"></span></span>
        <button type="button" class="a-login" id="acctLogin" hidden>${t('stLoginBtn')}</button>
        <button type="button" class="ib" id="lookBtn" title="${t('winLook')}" aria-label="${t('winLook')}" aria-haspopup="dialog" aria-expanded="false">${i('sliders')}</button>
      </div>
    </div>
  </aside>
  <div class="scrim" id="scrim"></div>

  <nav class="tabs" aria-label="${t('winChats')}">
    <button type="button" class="ib side-show js-side" title="${t('winSideShow')}" aria-label="${t('winSideShow')}">${i('sidebar')}</button>
    <div class="tabstrip" id="tabs" role="tablist"></div>
    <button type="button" class="ib newtab js-new" id="newTab" title="${t('newTabTitle')}" aria-label="${t('newTabTitle')}">${i('plus')}</button>
    <span class="tabs-sp"></span>
    ${lookCtl('tabs')}
    <button type="button" class="ib js-hist keep-menu" title="${t('histTitle')}" aria-label="${t('histTitle')}">${i('clock')}</button>
    <button type="button" class="ib js-menu keep-menu" title="${t('cmdTitle')}" aria-label="${t('cmdTitle')}">${i('dots')}</button>
  </nav>

  <div class="head">
    <button type="button" class="ib side-show js-side" title="${t('winSideShow')}" aria-label="${t('winSideShow')}">${i('sidebar')}</button>
    <div class="h-main">
      <h2 class="h-title" id="headTitle"></h2>
      <div class="h-sub">${i('folder')}<span id="headProj"></span><span class="h-path" id="headPath"></span></div>
    </div>
    <div class="h-acts">
      <button type="button" class="ib side-show js-new" title="${t('mNewChat')}" aria-label="${t('mNewChat')}">${i('plus')}</button>
      ${lookCtl('head')}
      <button type="button" class="hbtn js-hist keep-menu" title="${t('histTitle')}">${i('clock')}<span>${t('winHistory')}</span></button>
      <button type="button" class="ib js-menu keep-menu" title="${t('cmdTitle')}" aria-label="${t('cmdTitle')}">${i('dots')}</button>
    </div>
  </div>

  <main class="feed" id="log" tabindex="0" aria-label="${t('winFeed')}"></main>

  <div class="rail" id="rail">
    <section class="agents" id="agents" aria-label="${t('agentsHead')}"></section>
    <section class="files" id="files" aria-label="${t('winFiles')}"></section>
    <div class="info" id="info">
      <section class="machine card" id="machine" aria-label="${t('machineTitle')}"></section>
      <section class="start card" id="start" aria-label="${t('winStart')}"></section>
    </div>
  </div>

  <div class="turn" id="turn" role="status">
    <span class="pulse" aria-hidden="true"></span>
    <span class="turn-t">${t('winTurn')}</span>
    <span class="turn-time" id="turnTime" title="${t('winTurnTime')}">0:00</span>
    <span class="turn-step" id="turnStep"></span>
    <span class="turn-wait" id="turnWait">${i('question')}<span></span></span>
    <span class="turn-esc key-line" id="turnEsc"><kbd>Esc</kbd> — ${t('winEscStop')}</span>
  </div>

  <footer class="composer" id="composer">
    <div id="ro"><span>${t('agentReadOnly')}</span><button type="button" id="roBack">${t('agentBack')}</button></div>
    <div class="box" id="box">
      <div id="chips"></div>
      <span class="prompt" aria-hidden="true">›</span>
      <label class="sr" for="inp">${t('winMessage')}</label>
      <textarea id="inp" rows="2" placeholder="${t('placeholder')}"></textarea>
      <div class="bar" id="bar">
        <button type="button" class="ib" id="filesBtn" title="${t('attachTitle')}" aria-label="${t('attachTitle')}">${i('clip')}</button>
        <button type="button" class="ib" id="cmdBtn" title="${t('cmdTitle')}" aria-label="${t('cmdTitle')}">${i('terminal')}</button>
        <span class="bar-sep" aria-hidden="true"></span>
        <button type="button" class="sel s-model keep-menu" id="selModel" title="${t('mModel')}${t('winClickChange')}">${i('cube')}<span class="sel-k">${t('winModel')}</span><span class="sel-v">…</span>${i('chev-d', 'sel-c')}</button>
        <button type="button" class="sel s-source keep-menu" id="selSource" title="${t('mSource')}${t('winClickChange')}">${i('plug')}<span class="sel-k">${t('winSource')}</span><span class="sel-v">…</span>${i('chev-d', 'sel-c')}</button>
        <button type="button" class="sel s-effort keep-menu" id="selEffort" title="${t('mEffort')}${t('winClickChange')}">${i('gauge')}<span class="sel-k">${t('winEffort')}</span><span class="sel-v">…</span><span class="lvl" aria-hidden="true"></span>${i('chev-d', 'sel-c')}</button>
        <span class="bar-sp"></span>
        <span class="hint" id="hint"><kbd>Enter</kbd> — ${t('winHintSend')}<span class="hint-2"> · <kbd>Shift Enter</kbd> — ${t('winHintNewline')}</span></span>
        <span class="timer" id="timer" title="${t('winTurnTime')}">0:00</span>
        <button type="button" class="send" id="sendBtn" title="${t('sendTitle')}" aria-label="${t('sendTitle')}">${i('send')}<span class="btn-t">${t('sendTitle')}</span></button>
        <button type="button" class="stop" id="stopBtn" title="${t('stopTitle')}" aria-label="${t('stopTitle')}">${i('stop')}<span class="btn-t">${t('winStop')}</span></button>
      </div>
    </div>
  </footer>

  <div class="status" id="statusbar">
    <span class="st-item st-turn on" id="stTurn"><span class="st-idle"><span class="dot ok"></span><b>${t('winIdle')}</b></span><span class="st-run"><i class="spin"></i><b>${t('winTurnRunning')}</b><span id="stTime">0:00</span><span class="st-step" id="stStep"></span></span></span>
    <button type="button" class="st-item st-sec keep-menu" id="stSec" title="${t('mSecurity')}${t('winClickChange')}">${i('shield')}<span></span></button>
    <button type="button" class="st-item st-sync" id="stSync" title="${t('mMachine')}">${i('sync')}<span></span></button>
    <button type="button" class="st-item st-inbox keep-menu" id="stInbox">${i('globe')}<span></span></button>
    <span class="st-sp"></span>
    <span class="st-item st-host" id="stHost"></span>
    <span class="st-item st-ver" id="stVer"></span>
  </div>

  <div id="menu" role="menu"></div>
  <div class="pop" id="pop" role="dialog" aria-label="${t('winLook')}"></div>
  <div id="sheet"></div>
  <div id="toasts" role="status" aria-live="polite"></div>
  <div id="conn" role="status" aria-live="polite"></div>
  <div id="dlg"></div>
  <div class="sr" id="srStatus" role="status" aria-live="polite"></div>
  <div hidden><div id="status"></div><button type="button" id="histBtn" tabindex="-1"></button></div>
  <div class="welcome" id="welcome" hidden>
    <div class="hero">
      <div class="hero-mark" aria-hidden="true">ExecAI<i class="cur"></i></div>
      <h1>${t('placeholder')}</h1>
      <p>${t('winHeroA')}<kbd>Ctrl V</kbd>${t('winHeroB')}</p>
    </div>
    <div class="sugg">
      <div class="sugg-l"><span>${t('winSuggLabel')}</span></div>
      ${sg(1, 'search')}
      ${sg(2, 'terminal')}
      ${sg(3, 'pencil')}
      ${sg(4, 'agents')}
    </div>
    <section class="lookintro" id="lookIntro" hidden aria-label="${t('winSkin')}">
      <div class="sugg-l"><span>${t('winSkin')}</span></div>
      <p class="li-d">${t('winIntroD')}</p>
      <div class="lookbox in-feed" id="introLook"></div>
      <button type="button" class="btn2 li-done" id="introDone">${t('winIntroDone')}</button>
    </section>
  </div>
</div>`;
}
