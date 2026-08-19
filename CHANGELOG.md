# Changelog

All notable changes to the ExecAI extension are listed here. Versions follow
[semver](https://semver.org/); the CLI it drives is versioned separately (`R<major>.<minor>`).

## 0.2.25 — 2026-08-19

### Fixed

- The Studio updater is started with its working directory outside the
  installation — a folder that is some process's current directory cannot be
  moved on Windows («занят другим приложением» at the install step).

## 0.2.24 — 2026-08-19

### Changed

- **The Studio updater is taken from the release being installed.** Before
  starting it, the extension fetches `updater.ps1`/`updater.sh` of the target
  release (GitHub at the tag, then the mirror) and runs that; the copy shipped
  with the current install is only the offline fallback. A fix to the updater
  now reaches every install, not only the ones built after it.

## 0.2.23 — 2026-08-18

### Changed

- **Studio updates run in their own window, outside the editor.** «Update and
  restart» closes the editor and starts the updater that ships with Studio
  (`resources/execai/updater.ps1` / `updater.sh`): it waits for the editor to
  close, downloads with a percentage (GitHub first, mirror second), verifies
  SHA-256, unpacks with a percentage, swaps the folders (retrying while
  Windows still holds files) and starts the new build; on failure it says why
  and puts the previous version back. The editor itself no longer downloads or
  unpacks anything — that is what kept failing on Windows, and a process
  started from the extension host died with it on quit.

## 0.2.22 — 2026-08-18

### Fixed

- **Windows: leftovers of an earlier update attempt no longer block the next
  one.** Removing a stale `.staging` folder that Windows still holds locked
  used to fail the whole update before anything was downloaded («EBUSY …
  node_modules.asar»); now a fresh staging folder is used and the installer
  sweeps the old ones when it can.

## 0.2.21 — 2026-08-18

### Fixed

- **Windows: the update no longer fails with «EBUSY … node_modules.asar».** The
  editor now only downloads and verifies the archive; unpacking, the folder
  swap and the start of the new build all happen in the visible installer
  window after the editor has quit — Defender and indexers grab freshly
  unpacked files, and any move from inside the editor hit EBUSY. The
  installer retries busy files for up to 90 s, shows a percentage while
  unpacking, and puts the previous version back on any failure. A staged
  update that was postponed with «Later» is offered again on the next start
  without downloading twice.

## 0.2.20 — 2026-08-18

### Changed

- **Studio update download shows a percentage** (status bar for background
  updates, notification for manual ones) instead of a bare «downloading».

## 0.2.19 — 2026-08-18

### Fixed

- **Windows: the update installer is visible and waits for the right process.**
  After «Restart now» a small console shows the four steps — waiting for the
  editor to close, moving the current version aside, putting the new one in
  place, starting it — instead of the editor vanishing for a few seconds. The
  helper now waits for every process of the old install to exit (it used to
  watch the extension host, which dies before the main window releases its
  files, so the swap could fail silently); on failure it says why and restores
  the previous version.

## 0.2.18 — 2026-08-18

### Changed

- **A new Studio version is downloaded first and only then asks — about the
  restart.** Nothing opens a browser and no archive lands in Downloads: the
  editor fetches, verifies and installs the update itself (progress in the
  status bar for a background check, in a notification for one you asked for),
  then offers «Restart now». `execai.studioAutoUpdate: false` restores the old
  «ask before downloading» behaviour.
- The core Help → «Check for Updates» → «Download» now lands in the same flow
  instead of opening a page: the update feed hands the editor our own URI.

## 0.2.17 — 2026-08-17

### Added

- **OS integration is checked on every Studio start**: «Open with ExecAI
  Studio» in the Explorer context menu (folders, folder background, files) on
  Windows, «Open With» for folders in Linux file managers, Launch Services on
  macOS, plus the `execai-studio://` scheme. Per-user, no admin rights; the
  install scripts set it up first, the editor keeps it correct after
  self-updates and moves. Outside Studio nothing happens.

## 0.2.16 — 2026-08-17

### Changed

- **Update channels: GitHub first, the Yandex mirror second** — for the version
  check, the archive and SHA256SUMS alike. Both places always carry the same
  release; the order only decides who answers first.

## 0.2.15 — 2026-08-17

### Changed

- **The Studio update offer is a modal dialog**, not a toast: a toast was lost
  among the start-up notifications and the offer went unseen.
- **«Check for Studio updates»** in the panel's `>_` menu and in the command
  palette (Studio only).
- The editor's own Help → «Download Update» now hands over to the extension via
  `execai-studio://execai.execai/update`, so that path installs in place too
  instead of opening a web page.

## 0.2.14 — 2026-08-17

### Fixed

- **Studio self-update: the swap is two renames, not a copy.** The archive is
  unpacked next to the installation (same filesystem) and renamed into place;
  the cross-filesystem copy of the first attempt could stop halfway with an
  «Invalid package … node_modules.asar».

## 0.2.13 — 2026-08-17

### Added

- **ExecAI Studio updates itself.** «Update now» downloads the archive for the
  current platform (mirror first, GitHub second), verifies SHA-256, unpacks it
  next to the installation, swaps the two and offers a restart. The previous
  install stays as `<install>.old` until the new one has started once. On
  Windows the swap runs after the window closes (a running exe cannot be
  replaced). Always with consent — nothing is replaced silently. Outside Studio
  nothing changes.

## 0.2.12 — 2026-08-17

### Changed

- **The empty panel now says how to attach files: drag with Shift held, Ctrl+V,
  or the + button.** VS Code disables pointer events on webviews during drags
  and only delivers the drop when Shift is pressed (vscode#209211) — without
  Shift the file lands in the editor as a tab instead. Core-patched editors
  like Cursor sidestep this; we document it instead.

## 0.2.11 — 2026-08-17

### Fixed

- **The auto-attached context is visible now.** Dropping a file onto the editor
  opens it as a tab, and the panel quietly attached that active file to the next
  message — the agent knew about a file the chat never showed. The sent message
  now carries a muted «📎 file (active file)» line, and «+ selection» when a
  selection went along. `execai.attachContext` still turns the attach off.

## 0.2.10 — 2026-08-16

### Added

- **The sign-in link can be taken by hand.** The browser still opens by itself,
  but the panel now shows the link in a copyable box with a «copy the link»
  button, and the notification gains a «Copy link» action — for SSH sessions,
  headless boxes and signing in from a browser on another machine.

### Fixed

- **The panel no longer claims «Opening the browser…» when nothing is happening.**
  With no project folder open the agent is not running, and every menu action used
  to disappear into the void behind an optimistic notice. A dead agent now answers
  honestly: open a folder, or wait — the agent is starting.

## 0.2.9 — 2026-08-16

### Changed

- The Studio update check now picks the download for the current platform when
  the channel offers per-platform links (Windows and macOS builds are joining
  Linux).

## 0.2.8 — 2026-08-16

### Added

- **ExecAI Studio checks for its own updates** — the Yandex mirror first, GitHub
  Releases second, on start and every six hours. A new version is an offer with a
  download link, never a silent replacement; «skip this version» is remembered.
  Outside Studio nothing happens.

## 0.2.7 — 2026-08-16

### Added

- **In ExecAI Studio the `execai` terminal command takes care of itself.** On start
  Studio installs its bundled agent into `~/.local/bin` when the system has none,
  refreshes it when the system copy is older, and leaves a newer one alone. No
  sudo, `/usr/local/bin` is never touched. Outside Studio nothing happens.

### Fixed

- **«Open in terminal» now launches the same binary the panel uses.** It used to
  call `execai` from PATH, which in Studio could mean "command not found" while
  the panel worked fine next to it.
- When the agent on PATH is newer than the one bundled with Studio, the panel now
  uses the newer one instead of insisting on its own copy.

## 0.2.6 — 2026-08-16

### Added

- **In ExecAI Studio the chat opens by itself on the very first start** — the way
  Cursor greets you. Only once: a panel the user closed stays closed. In stock
  VS Code and Cursor nothing changes.

### Changed

- The extension now activates on startup (`onStartupFinished`) instead of on the
  first opening of the panel. Activation is a handful of command registrations,
  so the cost is not noticeable.

## 0.2.5 — 2026-08-16

### Added

- **The agent bundled with ExecAI Studio is found automatically.** The extension now
  looks for the `execai` binary inside the editor's own resources before falling back
  to the managed copy and PATH. In stock VS Code nothing changes; in ExecAI Studio
  the agent works out of the box, with no download on first start.

## 0.2.4 — 2026-08-15

### Added

- **The last chat of the project is continued when the panel opens.** The panel used
  to start from a clean slate: the conversation was still there, but you had to dig it
  out of the history by hand. An editor is a place you come back to, so the chat now
  comes back with you. `execai.resumeLastChat` turns it off; «Continue the last chat»
  in the `>_` menu does it on demand.

### Changed

- **Requires CLI R6.58 or newer** — that release added the `resume_last` command.

## 0.2.3 — 2026-08-15

### Fixed

- **Answers are rendered as markdown.** Tables arrived as raw text full of pipe
  characters, and so did code blocks, lists and emphasis — the panel inserted the
  answer as plain text. Tables now scroll inside their own box, so a wide table no
  longer drags the surrounding text sideways.

Everything the model writes is escaped before any markup is produced, and links are
limited to `http`, `https` and `mailto`: an answer may repeat whatever it read on the
web, and none of it gets to run in the panel.

## 0.2.2 — 2026-08-15

### Added

- **Security level** in the `>_` menu: `light` / `deep` / `paranoid`. The level decides
  what the agent does silently — reads outside the project, secrets, network calls — and
  is shared with the terminal, so setting it here changes it everywhere.
- Sign in to ExecAI, connect and disconnect providers, reasoning level and iteration
  limit, all from the panel. The key for a provider is asked in an editor input and never
  leaves your machine.
- Stable `data-mi` anchors on menu entries so the automated run can find them regardless
  of the editor's display language.

### Changed

- **Requires CLI R6.56 or newer** (was R6.49). That release closed the permission bypasses
  and added the commands this panel now offers; pointing at an older binary would mean
  menu entries that silently do nothing.

### Fixed

- The stop button was visible and spinning at rest: a higher-specificity CSS rule beat
  its `display: none`. Its animations now run only while a turn is in flight.

## 0.2.1 — 2026-08-15

### Changed

- Marketplace keywords widened from 7 to 28: Cyrillic queries (ии, нейросеть, агент,
  ассистент, терминал), the tools people look for a replacement to (claude code,
  copilot, codex, cline), and the providers behind the sources (ollama, kimi, glm,
  deepseek, qwen, anthropic, openai). `displayName`, `description` and `keywords` are
  what the Marketplace text search indexes, and the card language stays English.

## 0.2.0 — 2026-08-15

First public release.

### Added

- **Multilingual UI.** English is now the base language and Russian ships alongside
  it; every other locale falls back to English. Manifest strings live in
  `package.nls*.json`, extension-host strings go through `vscode.l10n.t()` with
  `l10n/bundle.l10n.ru.json`, and the webview gets its table injected from
  `STRINGS` in `src/webviewHtml.ts`. The panel follows the editor's display language.
- Unit tests for the localization: every bundle is held in key parity with English,
  the language fallback is checked, and the English panel is asserted to contain no
  Cyrillic left over.
- `CHANGELOG.md`, and READMEs in five languages (EN/RU/ES/DE/ZH).

### Changed

- All code comments are English.
- The status bar keeps its base text in a field instead of stripping the "turn…"
  suffix with a regex — the suffix is translated now, and a regex would only ever
  match one language.
- `repository.url` points at this repository (it previously named a URL that did
  not exist).

## 0.1.5 — 2026-08-14

### Fixed

- The stop button hung around forever: `#bar button` (id + type) is more specific
  than `#stopBtn`, so `display: none` lost. The selectors now include `#bar`, and a
  test covers both states.

## 0.1.4 — 2026-08-14

### Added

- Menu: sign in to ExecAI, connect a source, reasoning effort and the iteration limit.
- Motion where it carries meaning: a live stop button, a spinner inside the running
  tool card, a turn timer. All of it respects `prefers-reduced-motion`.

## 0.1.3 — 2026-08-14

### Added

- The extension installs the agent itself: it downloads the CLI of the required
  version into its own storage, verifies the SHA256 checksum, and needs no sudo.

## 0.1.2 — 2026-08-14

### Fixed

- Drag&drop diagnostics from the field, plus `text/x-moz-url` support.

## 0.1.1 — 2026-08-11

### Added

- "+" opens the native file dialog; "Attach a file to the chat" appears in the
  explorer context menu and the command palette.

### Fixed

- Omnivorous drop: VS Code explorer formats and a capture-phase interception, so a
  drop into the textarea no longer pastes the path as plain text.

## 0.1.0 — 2026-08-09

### Added

- The sidebar chat on top of `execai ide` (protocol v1): streaming, a reasoning
  block, tool cards with live output, permission buttons.
- A composer in the style of the web chat: a round send/stop button, "+" for file
  chips, ">_" for commands.
- The command menu in the chat above the composer, the model·source status line,
  and the ⏱ history button with project chats, replay and continuation.
- Drag&drop, clipboard paste and attachment thumbnails.
