**English** | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [中文](README.zh.md)

🌐 **Website:** [execai.ru](https://execai.ru) · 💬 Web chat: [chat.execai.ru](https://chat.execai.ru) · 🖥 CLI: [execai/execai-agent](https://github.com/execai/execai-agent)

---

# ExecAI for VS Code and Cursor

The [execai](https://github.com/execai/execai-agent) agent in your editor sidebar: a streaming chat, tools with confirmations, the context of the active file. The whole agent loop runs in the CLI on your own machine — the extension only draws it.

## What it does

- **Chat in the sidebar** — streamed answers, a collapsible reasoning block, tool cards with live output (Bash streams lines as they appear)
- **Confirmations exactly like the TUI and the web chat** — five buttons: "Once", "This tool for the session", "This command for the session", "FOREVER" (written to `permissions.json`), "Reject". Silence never widens permissions
- **Agent questions** (AskUser) — when the call is yours, the options arrive as buttons
- **Editor context** — the active file and selection are attached to your message (`execai.attachContext`)
- **Changed files** — chips under the turn, click to open the file
- **Stop** ends the current turn; **New chat** resets the history and the session permissions
- **Terminal escape hatch** — the "ExecAI: Open in a terminal" command gives you the full TUI

Sources (ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…), models, memory and permissions are all configured in the CLI itself — the extension uses your current configuration.

## Interface languages

The panel and the commands follow the editor's display language: **English** and **Russian** ship today, English is the fallback for every other locale. Adding a language means two files and no code — `package.nls.<lang>.json` for the manifest, `l10n/bundle.l10n.<lang>.json` for the runtime, plus a bundle in `STRINGS` inside [src/webviewHtml.ts](src/webviewHtml.ts). A unit test keeps every bundle in key parity with English.

## Install

1. Install the extension:
   - **VS Code** — Marketplace: `ExecAI`
   - **Cursor / VSCodium / Windsurf** — Open VSX: `ExecAI`
   - or by hand: download the `.vsix` from [Releases](https://github.com/execai/execai-vscode/releases) → `Extensions: Install from VSIX…`
2. Open a project folder — the ExecAI icon appears on the left.
3. On first run the extension offers to **download the agent** (~6 MB). It lands in the
   extension's storage, no sudo involved. If execai is already in PATH and recent
   enough (R6.49+), that one is used instead.

Then sign in or connect your own subscription right in the chat: `>_` → "Open execai in a terminal".

Installing the agent by hand is optional but supported:

```bash
curl -fsSL https://raw.githubusercontent.com/execai/execai-agent/main/install.sh | bash
```

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `execai.binaryPath` | `execai` | Path to the binary. Empty or `execai` — found in PATH or fetched by the extension. |
| `execai.maxIterations` | `0` | Tool iteration limit per turn (0 — take it from the execai config). |
| `execai.attachContext` | `true` | Attach the active file and selection to the message. |
| `execai.autoInstall` | `true` | Offer to download the agent when it is missing or outdated. |

## How it works

The extension starts `execai ide --cwd <project folder>` and talks to it in JSON lines over stdin/stdout. The protocol is versioned: when the versions drift apart the extension asks you to update instead of breaking silently. A question left unanswered (you closed the editor) is treated by the agent as a refusal — the same principle as background mode in `execai serve`.

## Development

```bash
npm install
npm test          # unit tests: protocol, version comparison, webview markup, i18n
npm run build     # esbuild → dist/extension.js
npm run package   # .vsix via @vscode/vsce
```

## License

Business Source License 1.1 — free for internal and production use; commercial hosting as a service requires a separate license (it@velesbsd.com).

## Support

- Bugs and feature requests: [github.com/execai/execai-vscode/issues](https://github.com/execai/execai-vscode/issues)
- The agent itself: [github.com/execai/execai-agent](https://github.com/execai/execai-agent)
