# Changelog

All notable changes to the ExecAI extension are listed here. Versions follow
[semver](https://semver.org/); the CLI it drives is versioned separately (`R<major>.<minor>`).

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
