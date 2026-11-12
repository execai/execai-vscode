#!/usr/bin/env python3
"""Screenshots of the `execai ui` window, drawn by the real page on scripted
protocol events — no agent, no model.

The page under test is dist/panel-browser.<lang>.html (build it first:
`npm run build:panel`). It is served to a headless Chromium from a made-up
origin with the same Content-Security-Policy `execai ui` sends, its event
stream (EventSource) is replaced by a fake one, and the script below plays
the agent: ready, state, chats, a turn with tools, a permission request, a
question, subagents, changed files, sync notices, an error, attachments, the
QR code for the phone, a lost connection, the keyboard focus, the sidebar put
away, more tabs than fit, a list longer than the window, the key hints turned
on (a skin decides whether to show them: the "hints" state shows what it would
get from base alone), the look panel under its button in the header, the
first run…

The matrix: 3 skins × 2 themes × the states below × 2 widths (1440 and 390),
plus English for two states. Every shot is checked on the way: no horizontal
scroll, nothing drawn past the window, what floats over it (a menu, a card, a
dialog, a toast) whole inside it, text contrast of 4.5:1 or better, no errors
in the console.

Usage (python with playwright; the browser is taken from --chrome, from
$PANEL_SHOTS_CHROME, or from playwright's own download):

    python scripts/panel-shots.py --out /tmp/shots
    python scripts/panel-shots.py --out /tmp/shots --only verstak-light-1440
    python scripts/panel-shots.py --out /tmp/shots --only work --widths 1440,1000
    python scripts/panel-shots.py --out /tmp/shots --only work --system-theme

By default a theme is the person's explicit choice and the system is set to
the opposite one — the shot proves the choice wins. --system-theme stores "as
the system" as the choice instead, and the system has the theme of the shot.

The "first-run" state is the case with nothing stored at all, under a light
system: the window has to come up in the default look and dark (that is
checked before anything else is done), with the three looks on the empty
screen. The other looks and the light theme of that state are reached by the
tiles of that block, so every shot of it also proves that a pick there works.

--only keeps the shots whose name contains every given word (comma separated).
Names: <skin>-<theme>-<width>-<state>[-en].png. The exit code is 1 when a
check failed; the findings are printed and saved to <out>/audit.json.
"""
import argparse
import json
import os
import pathlib
import sys
import time
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORIGIN = "http://execai.test"
NONCE = "shots"
CWD = "/home/dev/work/billing-service"
CSP = ("default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; "
       f"script-src 'nonce-{NONCE}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")

SKINS = ["verstak", "beseda", "teletype"]
THEMES = ["light", "dark"]
# state → the widths it is shot at (None — every width asked for)
STATES = {
    "first-run": None,
    "empty": None,
    "work": None,
    "work-top": None,
    "menu-model": None,
    "menu-source": None,
    "menu-commands": None,
    "menu-long": None,
    "history": None,
    "notices": None,
    "signed-out": None,
    "look": None,
    "look-acct": None,
    "dialog": None,
    "machine": None,
    "agent": None,
    "attach": None,
    "qr": None,
    "lost": None,
    "long": None,
    "side-off": [1440],
    "tabs-many": [1440],
    "hints": [1440],
    "keys": [1440],
    "side-open": [390],
}
EN_STATES = ["empty", "work"]

# Before any script of the page: a fake event stream and the stored look.
INIT = r"""
(() => {
  class FakeEventSource {
    constructor(url) { this.url = url; this.readyState = 1; window.__es = this; setTimeout(() => this.onopen && this.onopen(), 0); }
    emit(o) { if (this.onmessage) this.onmessage({ data: JSON.stringify(o) }); }
    close() { this.readyState = 2; }
  }
  window.EventSource = FakeEventSource;
  // A sign-in link opens a new window in the product; here it is only noted.
  window.__opened = [];
  window.open = (...a) => { window.__opened.push(a); return null; };
  const look = %s;
  try {
    for (const k of Object.keys(look)) localStorage.setItem(k, look[k]);
  } catch (e) {}
})();
"""

AUDIT = r"""
() => {
  const de = document.documentElement;
  const out = { overflowX: de.scrollWidth - de.clientWidth, outside: [], afloat: [], contrast: [] };
  const vw = de.clientWidth;
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const over = (top, bot) => { const a = top.a; return { r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 }; };
  const bgOf = (el) => {
    const stack = []; let e = el;
    while (e) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) return null;
      const c = rgba(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
      e = e.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };
  const clipped = (el) => {
    // inside something that scrolls or clips: not on screen, not a finding
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = p.getBoundingClientRect(), q = el.getBoundingClientRect();
        if (q.right > r.right + 1 || q.left < r.left - 1 || q.bottom > r.bottom + 1 || q.top < r.top - 1) return true;
      }
      p = p.parentElement;
    }
    return false;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const txt = n.nodeValue.trim(); if (!txt) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (!el.checkVisibility || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.bottom < 0 || r.top > innerHeight || clipped(el)) continue;
    const cs = getComputedStyle(el);
    const fg = rgba(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
    let op = 1; let e = el; while (e) { op *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; }
    if (op < 0.05) continue;
    const f = over({ r: fg.r, g: fg.g, b: fg.b, a: fg.a * op }, bg);
    const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (cr < 4.5) out.contrast.push([cr.toFixed(2), String(el.className || el.tagName), txt.slice(0, 32)]);
  }
  for (const el of document.querySelectorAll('.app *')) {
    if (!el.checkVisibility || !el.checkVisibility({ checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) {
      let p = el.parentElement, hidden = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { hidden = true; break; } p = p.parentElement; }
      if (!hidden) out.outside.push(String(el.className || el.tagName));
    }
  }
  // what floats over the window is whole inside it, or its end cannot be reached
  for (const el of document.querySelectorAll('#menu.open, .pop.open, .dlg-box, #sheet .info, .toast')) {
    if (!el.checkVisibility || !el.checkVisibility({ checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > innerHeight + 1)
      out.afloat.push((el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
  }
  return out;
}
"""


def iso(seconds_ago):
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


def texts(lang):
    """What the made-up agent says, in the page's language."""
    ru = lang == "ru"
    return {
        "chats": [
            {"id": "c1", "label": "Тест продления падает" if ru else "The renewal test fails", "active": True},
            {"id": "c2", "label": "Переезд на новый драйвер" if ru else "Moving to the new driver"},
            {"id": "c3", "label": "Ускорить сборку образа" if ru else "Speed up the image build"},
            {"id": "c4", "label": "Ночной разбор логов" if ru else "Nightly log review",
             "wake": (datetime.now().astimezone().replace(hour=14, minute=5, second=0, microsecond=0)).isoformat()},
            {"id": "c5", "label": "Место на диске dev01" if ru else "Disk space on dev01", "origin": "web"},
            {"id": "c6", "label": "Ревью лимитов запросов" if ru else "Rate limit review"},
            {"id": "c7", "label": "Обновить зависимости" if ru else "Update the dependencies"},
            {"id": "c8", "label": "README для новичков" if ru else "A README for newcomers"},
        ],
        "user1": ("Тест TestRenewGrace падает в CI примерно раз в десять прогонов, лог приложил. Найди причину и поправь."
                  if ru else "TestRenewGrace fails in CI about once in ten runs, the log is attached. Find the cause and fix it."),
        "think": ("Плавающий тест — скорее всего, зависимость от времени. Сначала воспроизведу серией прогонов, потом посмотрю, откуда берётся срок."
                  if ru else "A flaky test — most likely it depends on time. First I reproduce it with a series of runs, then look at where the deadline comes from."),
        "answer1": ("Нашёл. Льготный период в 48 часов отсчитывается от `CreatedAt`, а должен — от `ValidUntil`. У подписок, которые уже продлевались, окно закрывается раньше срока; тест ловит это, когда прогон попадает на границу суток.\n\nТот же расчёт есть ещё в одном месте — в напоминаниях."
                    if ru else "Found it. The 48-hour grace period is counted from `CreatedAt`, and it should be counted from `ValidUntil`. For subscriptions that were already renewed the window closes early; the test catches it when a run lands on the day boundary.\n\nThe same calculation lives in one more place — the reminders."),
        "q": ("В notify.go срок считается так же. Что с ним сделать?" if ru else "notify.go counts the deadline the same way. What should be done with it?"),
        "q_opts": [
            {"value": "fix", "label": "Исправить сразу" if ru else "Fix it now", "description": "в этом же изменении" if ru else "in this very change"},
            {"value": "note", "label": "Только отметить" if ru else "Only note it", "description": "оставить заметку, код не трогать" if ru else "leave a note, do not touch the code"},
            {"value": "skip", "label": "Не трогать" if ru else "Leave it", "description": "напоминания — отдельная задача" if ru else "the reminders are a task of their own"},
        ],
        "sync": ("Синк: память проекта обновлена с другого компьютера — .execai/EXECAI.md\nПрежняя версия хранится на этом компьютере 30 дней: ~/.config/execai/sync-history/billing-service/"
                 if ru else "Sync: the project memory was updated from another computer — .execai/EXECAI.md\nThe previous version is kept on this computer for 30 days: ~/.config/execai/sync-history/billing-service/"),
        "user2": ("Покажи, что именно поменял, и прогони весь набор с -race. Соседние пакеты тоже проверь."
                  if ru else "Show what exactly you changed and run the whole suite with -race. Check the neighbouring packages too."),
        "answer2": (("Расчёт срока вынесен в одну функцию — теперь её вызывают и продление, и напоминания:" if ru
                     else "The deadline is now computed in one function — both the renewal and the reminders call it:")
                    + "\n\n```go\nconst gracePeriod = 48 * time.Hour\n\n// graceDeadline — "
                    + ("момент, после которого подписка гаснет." if ru else "the moment after which the subscription lapses.")
                    + "\nfunc graceDeadline(sub *Subscription) time.Time {\n\tbase := sub.ValidUntil\n\tif base.IsZero() { // "
                    + ("ещё ни разу не продлевали" if ru else "never renewed yet")
                    + "\n\t\tbase = sub.CreatedAt\n\t}\n\treturn base.Add(gracePeriod)\n}\n```\n\n"
                    + ("- `renew.go` и `notify.go` берут срок из `graceDeadline`;\n- в `renew_test.go` добавлен случай «продление за секунду до полуночи»;\n- четыре субагента параллельно проверяют `payments`, `mailer`, `api` и описания."
                       if ru else "- `renew.go` and `notify.go` take the deadline from `graceDeadline`;\n- `renew_test.go` got the case \"a renewal one second before midnight\";\n- four subagents check `payments`, `mailer`, `api` and the docs in parallel.")),
        "task": "4 субагента: payments, mailer, api, docs" if ru else "4 subagents: payments, mailer, api, docs",
        "agents": [
            ("a1", "payments: тот же расчёт срока" if ru else "payments: the same deadline", "running", 31, 50, 72, "Grep"),
            ("a2", "mailer: напоминания о продлении" if ru else "mailer: renewal reminders", "waiting", 9, 50, 48, "Bash"),
            ("a3", "api: обработчики продления" if ru else "api: renewal handlers", "done", 18, 50, 54, "Read"),
            ("a4", "docs: срок в описаниях" if ru else "docs: the deadline in the docs", "running", 46, 50, 90, "Edit"),
        ],
        "perm_opts": [
            {"value": "once", "label": "Разово" if ru else "Once", "description": "разрешить только этот вызов" if ru else "allow this call only"},
            {"value": "session", "label": "Весь Bash в сессии" if ru else "All Bash this session", "description": "до конца этого чата" if ru else "until this chat ends"},
            {"value": "exact", "label": "Эту команду в сессии" if ru else "This command this session", "description": "точно такой вызов до конца чата" if ru else "exactly this call until the chat ends"},
            {"value": "always", "label": "Навсегда" if ru else "Forever", "description": "весь Bash без вопросов — запишется в permissions.json" if ru else "all Bash without asking — written to permissions.json"},
            {"value": "deny", "label": "Отклонить" if ru else "Deny", "description": "не выполнять; агент получит отказ" if ru else "do not run it; the agent gets a refusal"},
        ],
        "error": ("Источник не ответил: 502 Bad Gateway (попытка 3 из 3). Проверь подключение или смени источник."
                  if ru else "The source did not answer: 502 Bad Gateway (attempt 3 of 3). Check the connection or switch the source."),
        "compact": ("Контекст заполнен на 82 % — сжимаю историю…" if ru else "The context is 82% full — compacting the history…"),
        "queued_user": "И ещё проверь миграции." if ru else "And check the migrations too.",
        "long": ("Очень длинная строка без пробелов: /home/dev/work/billing-service/internal/billing/testdata/fixtures/renewals/2026-11-01T00:00:00Z-subscription-0000000000000000000000000000000001.json"),
    }


def machine(lang, signed=True):
    return {
        "type": "machine_state",
        "machine": {
            "id": "a3f9c1", "name": "workstation", "os": "linux", "version": "R7.18",
            "logged_in": signed, "email_masked": "d**@example.com" if signed else "", "plan": "week_work" if signed else "",
            "sources": ([{"id": "execai", "title": "ExecAI", "alive": True, "checked_at": iso(20)},
                         {"id": "custom", "title": "LM Studio", "alive": True, "checked_at": iso(130)},
                         {"id": "ollama", "title": "Ollama", "alive": False, "checked_at": iso(400)}] if signed else []),
            "sync": {"enabled": signed, "last_push_at": iso(250) if signed else "", "config": signed,
                     "personal_memory_files": 12 if signed else 0, "projects": 2 if signed else 0, "mode": "all" if signed else ""},
            "presence": {"listener_running": signed, "reachable_from_web": signed},
        },
        "tutorial": {"steps": [{"id": "login", "done": signed}, {"id": "models", "done": signed}, {"id": "sync", "done": signed},
                               {"id": "project", "done": signed}, {"id": "phone", "done": False}]},
        "phone_url": "https://chat.execai.ru/m/a3f9c1" if signed else "",
    }


def state_event(signed=True):
    return {
        "type": "state", "model": "GLM 5.3 Flash", "source": "ExecAI", "user": "dev@example.com" if signed else "",
        "effort": "high", "max_iter": 50, "subagent_iter": 50, "security": "deep",
        "models": [{"id": "glm-5.3-flash", "label": "GLM 5.3 Flash", "active": True}, {"id": "glm-5.3", "label": "GLM 5.3"},
                   {"id": "kimi-k3", "label": "Kimi K3"}, {"id": "qwen3-coder", "label": "Qwen3 Coder"},
                   {"id": "deepseek-v4", "label": "DeepSeek V4"}],
        "sources": [{"id": "execai", "label": "ExecAI", "active": True}, {"id": "custom", "label": "LM Studio"},
                    {"id": "ollama", "label": "Ollama"}],
        "connectable": [{"id": "zai", "label": "Z.ai"}, {"id": "kimi", "label": "Kimi Code"}, {"id": "custom", "label": "Custom provider"}],
        "efforts": [{"id": "off", "label": "off (0)"}, {"id": "low", "label": "low (2048)"}, {"id": "medium", "label": "medium (8192)"},
                    {"id": "high", "label": "high (16384)", "active": True}, {"id": "max", "label": "max (32768)"}],
        "securities": [{"id": "light", "label": "light"}, {"id": "deep", "label": "deep", "active": True}, {"id": "paranoid", "label": "paranoid"}],
    }


class Stand:
    """One page of the window with a fake agent behind it."""

    def __init__(self, browser, html, lang, skin, theme, width, height, by_system=False, fresh=False):
        self.lang = lang
        self.skin, self.theme = skin, theme
        self.t = texts(lang)
        self.errors = []
        self.posts = []
        # The system theme is the opposite one: the shot proves the explicit choice
        # wins. by_system: "as the system" is the choice stored, the system decides.
        # fresh: nothing about the look is stored and the system is light — the
        # window must come up dark all the same.
        system = "light" if fresh else theme if by_system else ("dark" if theme == "light" else "light")
        self.ctx = browser.new_context(viewport={"width": width, "height": height}, color_scheme=system,
                                       device_scale_factor=1, reduced_motion="reduce", locale="ru-RU" if lang == "ru" else "en-US")
        # three chats are closed: the history has something in it
        look = {f"execai:{CWD}:execai.tabs": json.dumps(json.dumps({"hidden": ["c6", "c7", "c8"], "order": []}))}
        if not fresh:
            look["execai:ui:skin"] = skin
            look["execai:ui:theme"] = "system" if by_system else theme
        self.ctx.add_init_script(INIT % json.dumps(look))
        self.page = self.ctx.new_page()
        self.page.on("console", lambda m: self.errors.append(m.text) if m.type == "error" else None)
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))

        def serve(route):
            url = route.request.url
            if url.rstrip("/") == ORIGIN:
                route.fulfill(status=200, headers={"Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": CSP}, body=html)
            elif url.endswith("/in"):
                self.posts.append(json.loads(route.request.post_data or "{}"))
                route.fulfill(status=204, body="")
            elif url.endswith("/upload"):
                route.fulfill(status=200, headers={"Content-Type": "application/json"},
                              body=json.dumps({"path": CWD + "/.execai/uploads/ci-run-4812.log", "name": "ci-run-4812.log"}))
            else:
                # anything else would be the page reaching outside — a finding
                self.errors.append("request outside the contract: " + url)
                route.abort()

        self.ctx.route("**/*", serve)
        self.page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        self.page.wait_for_function("() => !!window.__es")

    def emit(self, *events):
        for e in events:
            self.page.evaluate("e => window.__es.emit(e)", e)

    def close(self):
        self.ctx.close()

    # ── the agent's part ──
    def boot(self, signed=True):
        t = self.t
        self.emit({"type": "ready", "model": "GLM 5.3 Flash", "source": "ExecAI", "protocol": 1, "version": "R7.18",
                   "cwd": CWD, "features": ["notify"]},
                  state_event(signed), machine(self.lang, signed))
        if signed:
            self.emit({"type": "inbox", "state": "listening", "bound_workspace": {"id": "w1", "name": "billing-service"}})
        else:
            self.emit({"type": "inbox", "state": "not_logged_in"})

    def new_chat(self):
        ru = self.lang == "ru"
        self.emit({"type": "chat_reset", "chat": "c0"},
                  {"type": "chats", "chats": [{"id": "c0", "label": "", "active": True}] + [dict(c, active=False) for c in self.t["chats"]]})

    def say(self, text):
        self.page.fill("#inp", text)
        self.page.press("#inp", "Enter")

    def work(self):
        """A chat in the middle of its second turn, as the mock-up shows it."""
        t = self.t
        self.emit({"type": "chat_loaded", "chat": "c1", "msgs": []},
                  {"type": "chats", "chats": t["chats"]})
        # the badges of the other chats: one finished unread, one is asking
        self.emit({"type": "done", "chat": "c2", "text": "ok"},
                  {"type": "ask_user", "chat": "c3", "id": "q-other", "question": "?", "options": [{"value": "y", "label": "y"}]})
        self.page.evaluate("() => { for (const x of document.querySelectorAll('#toasts .toast > i')) x.click(); }")
        self.emit({"type": "files_attached", "items": [{"path": CWD + "/ci-run-4812.log", "label": "ci-run-4812.log"}]})
        self.say(t["user1"])
        self.emit({"type": "turn_start", "chat": "c1"},
                  {"type": "reasoning_delta", "chat": "c1", "text": t["think"]},
                  {"type": "tool_call", "chat": "c1", "id": "t1", "tool": "Bash", "summary": "go test ./internal/billing -count=30"},
                  {"type": "tool_chunk", "chat": "c1", "id": "t1", "chunk": "--- FAIL: TestRenewGrace (0.00s)\n    renew_test.go:87: grace = 02.03 23:59:58, now = 03.03 00:00:01\nFAIL  billing/internal/billing  2.412s\n"},
                  {"type": "tool_result", "chat": "c1", "id": "t1", "tool": "Bash", "ok": False},
                  {"type": "tool_call", "chat": "c1", "id": "t2", "tool": "Read", "summary": "internal/billing/renew.go"},
                  {"type": "tool_result", "chat": "c1", "id": "t2", "tool": "Read", "ok": True, "tail": "func (s *Service) Renew(ctx context.Context, sub *Subscription) error {\n\tnow := s.clock.Now()\n\tgrace := sub.CreatedAt.Add(gracePeriod)"},
                  {"type": "tool_call", "chat": "c1", "id": "t3", "tool": "Grep", "summary": "CreatedAt.Add(gracePeriod)"},
                  {"type": "tool_result", "chat": "c1", "id": "t3", "tool": "Grep", "ok": True, "tail": "internal/billing/renew.go:113\ninternal/billing/notify.go:58"},
                  {"type": "text_delta", "chat": "c1", "text": t["answer1"]},
                  {"type": "ask_user", "chat": "c1", "id": "q1", "question": t["q"], "options": t["q_opts"]})
        self.page.click(".ask.q .opt >> nth=0")
        self.emit({"type": "ask_resolved", "chat": "c1", "ask_id": "q1", "by": "panel"},
                  {"type": "tool_call", "chat": "c1", "id": "t4", "tool": "Edit", "summary": "internal/billing/renew.go"},
                  {"type": "tool_result", "chat": "c1", "id": "t4", "tool": "Edit", "ok": True, "tail": "-\tgrace := sub.CreatedAt.Add(gracePeriod)\n+\tdeadline := graceDeadline(sub)"},
                  {"type": "files_changed", "chat": "c1", "paths": ["internal/billing/grace.go", "internal/billing/renew.go",
                                                                     "internal/billing/notify.go", "internal/billing/renew_test.go"]},
                  {"type": "done", "chat": "c1", "text": "ok", "elapsed": 41.2},
                  {"type": "notice", "text": t["sync"]})
        self.say(t["user2"])
        self.emit({"type": "turn_start", "chat": "c1"},
                  {"type": "iteration", "chat": "c1", "n": 9},
                  {"type": "text_delta", "chat": "c1", "text": t["answer2"]},
                  {"type": "tool_call", "chat": "c1", "id": "t5", "tool": "Task", "summary": t["task"]},
                  {"type": "tool_result", "chat": "c1", "id": "t5", "tool": "Task", "ok": True, "tail": "payments · mailer · api · docs"},
                  {"type": "tool_call", "chat": "c1", "id": "t6", "tool": "Bash", "summary": "go test ./... -race"},
                  {"type": "tool_chunk", "chat": "c1", "id": "t6", "chunk": "ok   billing/internal/api       1.204s\nok   billing/internal/billing   3.871s\n"})
        self.agents()
        self.emit({"type": "ask", "chat": "c1", "id": "p1", "tool": "Bash", "summary": "gofmt -w internal/mailer/reminder.go",
                   "options": t["perm_opts"], "agent": {"id": "a2", "title": t["agents"][1][1]}})

    def agents(self):
        items = []
        for aid, title, st, it, mx, ago, tool in self.t["agents"]:
            rec = {"id": aid, "parent_chat": "c1", "title": title, "state": st, "iter": it, "max_iter": mx,
                   "last_tool": tool, "started_at": iso(ago), "updated_at": iso(1), "model": "GLM 5.3 Flash", "source": "ExecAI"}
            if st == "done":
                rec["finished_at"] = iso(1)
            items.append(rec)
        self.emit({"type": "agents", "items": items})

    def notices(self):
        """Everything that is not a message: an error, notices, a wake-up, a sign-in link, toasts."""
        t = self.t
        self.emit({"type": "chat_loaded", "chat": "c1", "msgs": [
            {"role": "user", "text": t["user1"]},
            {"role": "tool", "tool": "Bash", "text": "go test ./internal/billing -count=30"},
            {"role": "tool", "tool": "Read", "text": "internal/billing/renew.go"},
            {"role": "assistant", "text": t["answer1"]},
        ]}, {"type": "chats", "chats": t["chats"]})
        self.emit({"type": "notice", "text": t["compact"]},
                  {"type": "notice", "text": t["sync"]},
                  {"type": "error", "chat": "c1", "text": t["error"]},
                  {"type": "notice", "text": t["long"]},
                  {"type": "wakeup", "chat": "c1", "at": self.t["chats"][3]["wake"], "text": "проверить CI" if self.lang == "ru" else "check the CI"},
                  {"type": "login_start", "id": "AB12-CD34", "text": "https://chat.execai.ru/device?code=AB12-CD34"})
        # a call the person refused: neither done nor failed
        self.emit({"type": "tool_call", "chat": "c1", "id": "t9", "tool": "Bash", "summary": "rm -rf build"},
                  {"type": "tool_result", "chat": "c1", "id": "t9", "tool": "Bash", "ok": True, "denied": True,
                   "tail": "Пользователь отклонил выполнение этого инструмента." if self.lang == "ru" else "The user declined to run this tool."})
        self.emit({"type": "auto_user", "chat": "c1", "text": "проверить CI" if self.lang == "ru" else "check the CI"},
                  {"type": "auto_user", "chat": "c1", "origin": "web", "text": t["user2"]})
        self.say(t["queued_user"])
        self.emit({"type": "queued", "chat": "c1"},
                  {"type": "done", "chat": "c2", "text": "ok"},
                  {"type": "ask", "chat": "c3", "id": "p-other", "tool": "Bash", "summary": "rm -rf build", "options": t["perm_opts"]})


# A 2×2 picture for an attached image: no file is read from disk.
PIXEL = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAnrGW2wAAAAASUVORK5CYII=")


def play(stand, state, width):
    """Brings the page into the named state. Returns False when the state does not apply."""
    p = stand.page
    if state == "signed-out":
        stand.boot(signed=False)
        stand.new_chat()
        return True
    stand.boot()
    if state == "first-run":
        # nothing has been picked: the window is dark and in the default look,
        # and the empty chat shows the three looks. The other looks and the
        # light theme are reached the way a person would — by the tiles of
        # that block (it stays while they are tried).
        stand.new_chat()
        first = p.evaluate("() => [document.documentElement.className, document.documentElement.getAttribute('data-theme'), getComputedStyle(document.documentElement).colorScheme, !document.getElementById('lookIntro').hidden]")
        if first != ["sk-verstak", "dark", "dark", True]:
            raise RuntimeError(f"the first run is {first}, expected the workbench, dark, with the looks shown")
        if stand.skin != "verstak":
            p.click(f'#introLook [data-skin="{stand.skin}"]')
        if stand.theme != "dark":
            p.click(f'#introLook [data-theme-set="{stand.theme}"]')
    elif state == "empty":
        stand.new_chat()
    elif state == "qr":
        # the phone step of "Getting started" with its code, and the machine card's own
        stand.new_chat()
        p.click('#start [data-step="phone"] .st-act')
        if width >= 1100:
            p.click("#machine .mc-qr")
    elif state == "attach":
        # files on their way: sent with a message, and waiting in the input; a drag over the window
        t = stand.t
        stand.emit({"type": "chat_loaded", "chat": "c1", "msgs": []}, {"type": "chats", "chats": t["chats"]})
        items = [{"path": CWD + "/.execai/uploads/screen.png", "label": "screen.png", "thumb": PIXEL},
                 {"path": CWD + "/.execai/uploads/ci-run-4812.log", "label": "ci-run-4812.log"},
                 {"path": CWD + "/.execai/uploads/a-very-long-file-name-that-does-not-fit-anywhere-2026-11-01T00-00-00Z.json",
                  "label": "a-very-long-file-name-that-does-not-fit-anywhere-2026-11-01T00-00-00Z.json"}]
        stand.emit({"type": "files_attached", "items": items})
        stand.say(t["user1"])
        stand.emit({"type": "turn_start", "chat": "c1"}, {"type": "text_delta", "chat": "c1", "text": t["answer1"]},
                   {"type": "done", "chat": "c1", "text": "ok"})
        stand.emit({"type": "files_attached", "items": items})
        p.evaluate("() => document.body.classList.add('dragover')")
    elif state == "long":
        # nothing may widen the window: long names, paths, lines of code, words without spaces
        t = stand.t
        w = "длинноесловобезпробелов" * 12
        path = "internal/" + "very-long-directory-name-without-any-spaces/" * 4 + "a-very-long-file-name-that-does-not-fit-anywhere-2026-11-01T00-00-00Z.go"
        chats = [dict(c) for c in t["chats"]]
        chats[0]["label"] = "Очень длинное название чата, которое не помещается ни во вкладку, ни в боковую панель, ни в заголовок окна"
        chats[1]["label"] = w
        stand.emit({"type": "state", **{k: v for k, v in state_event().items() if k != "type"},
                    "model": "a-provider/a-very-long-model-name-with-a-date-2026-11-01-preview-thinking-128k",
                    "source": "A custom provider with a long name"})
        stand.emit({"type": "chat_loaded", "chat": "c1", "msgs": []}, {"type": "chats", "chats": chats})
        stand.say(w + " " + path)
        stand.emit({"type": "turn_start", "chat": "c1"},
                   {"type": "reasoning_delta", "chat": "c1", "text": w},
                   {"type": "tool_call", "chat": "c1", "id": "t1", "tool": "schedule_wakeup", "summary": "cat " + path + " | grep " + w},
                   {"type": "tool_chunk", "chat": "c1", "id": "t1", "chunk": w + "\n" + path + "\n"},
                   {"type": "text_delta", "chat": "c1", "text": w + "\n\n`" + path + "`\n\n```go\n// " + w + " " + path + "\nfunc " + "VeryLongFunctionName" * 8 + "() {}\n```\n\n| " + w[:60] + " | b |\n|---|---|\n| " + path + " | 2 |\n\n- " + w + "\n\nhttps://example.com/" + "a" * 200},
                   {"type": "files_changed", "chat": "c1", "paths": [path, "a/" + "b" * 180 + ".go", "short.go"]},
                   {"type": "notice", "text": w + "\n" + path},
                   {"type": "error", "chat": "c1", "text": path + " " + w})
        stand.emit({"type": "agents", "items": [
            {"id": "a1", "parent_chat": "c1", "title": w, "state": "running", "iter": 49, "max_iter": 50, "last_tool": "schedule_wakeup", "started_at": iso(4000)},
            {"id": "a2", "parent_chat": "c1", "title": path, "state": "done", "iter": 50, "max_iter": 50, "exhausted": True, "started_at": iso(900), "finished_at": iso(1)},
            {"id": "a3", "parent_chat": "c1", "title": "failed one", "state": "failed", "iter": 3, "max_iter": 50, "error": w, "started_at": iso(90), "finished_at": iso(1)},
            {"id": "a4", "parent_chat": "c1", "title": "queued one", "state": "queued"},
            {"id": "a5", "parent_chat": "c1", "title": "stopped one", "state": "cancelled", "iter": 7, "max_iter": 50, "started_at": iso(90), "finished_at": iso(30)},
        ]})
        stand.emit({"type": "ask", "chat": "c1", "id": "p1", "tool": "Bash", "summary": "rm -rf " + path + " && echo " + w,
                    "options": [dict(o, label=o["label"] + " — " + o["description"]) for o in t["perm_opts"]]},
                   {"type": "ask_user", "chat": "c1", "id": "q1", "question": w + "?",
                    "options": [{"value": str(i), "label": ("вариант " + str(i) + " ") * (i + 2), "description": w[:70]} for i in range(5)]})
    elif state == "side-off":
        # the sidebar put away with its button: the rest takes the room, a way back stays
        stand.work()
        for sel in (".s-collapse", "#navBtn"):
            if p.locator(sel).is_visible():
                p.click(sel)
                break
    elif state == "tabs-many":
        # more chats than the strip holds: it scrolls, "+" stays where it is
        t = stand.t
        chats = [dict(c) for c in t["chats"]] + [{"id": f"x{i}", "label": f"{t['chats'][i % 5]['label']} {i + 2}"} for i in range(14)]
        stand.emit({"type": "chat_loaded", "chat": "c1", "msgs": [{"role": "user", "text": t["user1"]}, {"role": "assistant", "text": t["answer2"]}]},
                   {"type": "chats", "chats": chats})
        stand.page.evaluate("() => localStorage.removeItem('execai:%s:execai.tabs')" % CWD)
        stand.emit({"type": "chats", "chats": chats})
        p.evaluate("() => { const s = document.getElementById('tabs'); s.scrollLeft = 260; }")
    elif state == "hints":
        # the key hints every skin has in its markup, turned on (a skin decides whether to show them)
        stand.work()
        p.add_style_tag(content=".key { display: inline-block } .key-line { display: block } .turn-esc.key-line { display: inline }")
    elif state == "lost":
        # the event stream is gone: execai ui was stopped
        stand.work()
        p.evaluate("() => { const es = window.__es; es.readyState = 2; es.onerror && es.onerror(); }")
    elif state == "keys":
        # the keyboard: Tab moves a visible focus through the window
        stand.work()
        p.focus("#inp")
        for _ in range(4):
            p.keyboard.press("Tab")
        p.keyboard.press("Enter")       # the model list, opened from the keyboard
        p.keyboard.press("ArrowDown")
    elif state == "notices":
        stand.notices()
    elif state == "agent":
        stand.work()
        t = stand.t
        if width < 720:
            p.click("#agents .ag-h")  # a narrow window keeps the list folded
        p.click('.ag[data-agent="a3"] .ag-name')
        stand.emit({"type": "agent_loaded", "id": "a3", "title": t["agents"][2][1], "state": "done", "messages": [
            {"role": "user", "text": t["agents"][2][1]},
            {"role": "tool", "tool": "Grep", "text": "graceDeadline"},
            {"role": "tool", "tool": "Read", "text": "internal/api/renew_handler.go"},
            {"role": "assistant", "text": t["answer1"]},
        ]})
    else:
        stand.work()
        if state == "work-top":
            # the same chat read from its start: what the end of the feed keeps out of the frame
            # (the reasoning line, the first tools, the answered question) is checked as well
            p.evaluate("() => { document.getElementById('log').scrollTop = 0; }")
        elif state == "menu-model":
            p.click("#selModel")
        elif state == "menu-long":
            # a list longer than the window: it scrolls inside and stays within the window
            models = [{"id": f"provider/model-{n}", "label": f"Provider: Model {n} Preview"} for n in range(60)]
            models[41]["active"] = True
            stand.emit({**state_event(), "models": models, "model": models[41]["label"]})
            p.click("#selModel")
        elif state == "menu-source":
            p.click("#selSource")
        elif state == "menu-commands":
            p.click("#cmdBtn")
        elif state == "history":
            # the button is where the skin has it; the sidebar always lists the history
            for sel in (".tabs .js-hist", ".head .js-hist"):
                if p.locator(sel).is_visible():
                    p.click(sel)
                    break
            else:
                # a skin without that button keeps the history in its sidebar; the list itself
                # is still the page's, and is drawn here the way any skin would get it
                p.evaluate("() => document.getElementById('histBtn').click()")
        elif state == "look":
            # the button in the header of the skin on screen; in a narrow window it
            # opens the drawer, where the whole choice is
            for at in ("tabs", "head", "top"):
                if p.locator(f"#look-{at}").is_visible():
                    p.click(f"#look-{at}")
                    break
            else:
                raise RuntimeError("no look button in the header")
        elif state == "look-acct":
            # the second way in, beside the account: the same panel
            if width < 720:
                p.click("#navBtn")
            p.click("#lookBtn")
        elif state == "dialog":
            p.click("#cmdBtn")
            p.click('#menu [data-mi="connect"]')
            p.click('#menu [data-mi="item:zai"]')
        elif state == "machine":
            if width < 720:
                p.click("#navBtn")
            p.click("#sideMachine")
            stand.emit(machine(stand.lang))
        elif state == "side-open":
            p.click("#navBtn")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="where the png files and audit.json go")
    ap.add_argument("--dist", default=str(ROOT / "dist"), help="where panel-browser.<lang>.html are (default: dist)")
    ap.add_argument("--chrome", default=os.environ.get("PANEL_SHOTS_CHROME", ""), help="a Chromium binary (default: playwright's own)")
    ap.add_argument("--only", default="", help="keep the shots whose name contains every word (comma separated)")
    ap.add_argument("--widths", default="1440,390", help="window widths (default: 1440,390)")
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--system-theme", action="store_true", help='store "as the system" as the theme and give the system the theme of the shot')
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    pages = {}
    for lang in ("ru", "en"):
        f = pathlib.Path(args.dist) / f"panel-browser.{lang}.html"
        if not f.exists():
            sys.exit(f"missing: {f} — run `npm run build:panel` first")
        html = f.read_text(encoding="utf-8")
        cfg = json.dumps({"lang": lang, "cwd": CWD, "version": "R7.18", "upload": "/upload"})
        pages[lang] = html.replace("{{NONCE}}", NONCE).replace("{{CONFIG}}", cfg)
    only = [w for w in args.only.split(",") if w]
    widths = [int(w) for w in args.widths.split(",") if w]

    report, failed, shot = {}, 0, 0
    started = time.time()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**({"executable_path": args.chrome} if args.chrome else {}), args=["--no-sandbox"])
        for skin in SKINS:
            for theme in THEMES:
                for width in widths:
                    for state, at in STATES.items():
                        if at and width not in at:
                            continue
                        for lang in ("ru", "en"):
                            if lang == "en" and state not in EN_STATES:
                                continue
                            name = f"{skin}-{theme}-{width}-{state}" + ("-en" if lang == "en" else "")
                            if any(w not in name for w in only):
                                continue
                            height = 844 if width < 720 else args.height
                            stand = Stand(browser, pages[lang], lang, skin, theme, width, height, args.system_theme, fresh=state == "first-run")
                            try:
                                play(stand, state, width)
                                stand.page.wait_for_timeout(120)
                                stand.page.screenshot(path=str(out / (name + ".png")))
                                audit = stand.page.evaluate(AUDIT)
                                # the look on <html> is the one asked for, and it is the one painted
                                got = stand.page.evaluate("() => [document.documentElement.className, document.documentElement.getAttribute('data-theme'), getComputedStyle(document.documentElement).colorScheme]")
                                want = ["sk-" + skin, None if args.system_theme and state != "first-run" else theme, theme]
                                if got != want:
                                    audit["crash"] = f"the look is {got}, expected {want}"
                            except Exception as e:  # a state that could not be reached is a finding too
                                audit = {"overflowX": 0, "outside": [], "afloat": [], "contrast": [], "crash": str(e).splitlines()[0]}
                            audit["errors"] = stand.errors
                            stand.close()
                            shot += 1
                            flags = []
                            if audit.get("crash"): flags.append("НЕ ДОШЛО ДО СОСТОЯНИЯ: " + audit["crash"])
                            if audit["overflowX"] > 0: flags.append(f"горизонтальная прокрутка {audit['overflowX']}px")
                            if audit["outside"]: flags.append("за краем окна: " + ", ".join(sorted(set(audit["outside"]))[:6]))
                            if audit["afloat"]: flags.append("плавающее не целиком в окне: " + "; ".join(audit["afloat"][:4]))
                            if audit["contrast"]: flags.append("контраст < 4.5: " + "; ".join(f"{c[0]} .{c[1]} «{c[2]}»" for c in audit["contrast"][:6]))
                            if audit["errors"]: flags.append("ошибки консоли: " + " | ".join(audit["errors"][:3]))
                            if flags:
                                failed += 1
                                report[name] = audit
                            print(name, "—", "; ".join(flags) if flags else "ok", flush=True)
        browser.close()
    (out / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{shot} снимков за {time.time() - started:.0f} с, с замечаниями: {failed}; каталог: {out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
