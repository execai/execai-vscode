**English** | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [中文](README.zh.md)

🌐 **Website:** [execai.ru](https://execai.ru) · 💬 Web chat: [chat.execai.ru](https://chat.execai.ru) · 🖥 CLI: [execai/execai-agent](https://github.com/execai/execai-agent) · 🖥 Editor: [ExecAI Studio](https://github.com/execai/execai-studio)

---

# ExecAI for VS Code and Cursor

The [execai](https://github.com/execai/execai-agent) agent in your editor sidebar: a streaming chat, tools with confirmations, the context of the active file. The whole agent loop runs in the CLI on your own machine — the extension only draws it.

## What it does

- **Chat in the sidebar** — streamed answers, a collapsible reasoning block, tool cards with live output (Bash streams lines as they appear)
- **Confirmations exactly like the TUI and the web chat** — five buttons: "Once", "This tool for the session", "This command for the session", "FOREVER" (written to `permissions.json`), "Reject". Silence never widens permissions
- **Agent questions** (AskUser) — when the call is yours, the options arrive as buttons
- **Editor context** — the active file and selection are attached to your message (`execai.attachContext`)
- **Changed files** — chips under the turn, click to open the file
- **Chat tabs** at the top of the panel, the way an editor shows open files: every chat of this project, one click to switch, «×» to close (the chat stays in history and a running turn keeps going), drag to reorder
- **Chats run in parallel** (agent R6.74+): switch tabs while a chat is answering — the turn keeps running and is replayed from the start when you come back. Badges on tabs: a pulsing dot — working, a green dot — finished and not read yet, «?» — waiting for your answer, ⏰ — a wake-up is scheduled; a chat that finishes or asks while you are elsewhere raises a toast with **Open**. Wake-ups (`schedule_wakeup`) show a line with **Now** / **Cancel** and survive an editor restart
- **Clickable links** — a URL opens in the browser, a project path (`internal/agent/memory.go:42`) opens the file at that line
- **Copy buttons** — one on every code block, one on the answer as a whole (it copies the original markdown)
- **Stop** ends the current turn; **New chat** resets the history and the session permissions
- **Terminal escape hatch** — the "ExecAI: Open in a terminal" command gives you the full TUI
- **Getting started** (agent R7.10+) — an empty chat opens with five steps and their ticks: sign in, connect models, turn on sync, bind the folder to a project, call the agent from your phone. Each step has the button that does it; closed once, the screen stays closed in every project, and the `>_` menu or the "ExecAI: Getting started" command brings it back
- **My machine** — a compact card from the panel title bar, the `>_` menu or the "ExecAI: My machine" command: the machine and the agent version, the account and its plan, which model sources answered and when, what sync carries, whether the web chat and the phone can reach this machine
- **QR code for the phone** — **Show the QR code** in the last step and **QR for the phone** on the card: point the phone camera at it and the web chat opens with this machine selected. The code is drawn right in the panel, nothing is fetched
- **Subagents** — when the agent hands work to subagents, an **Agents** block above the input lists them: state, title, "step 12/50 · 38 left" (yellow with 5 or fewer left), the last tool and the time running, with **+25** and **Stop** on the ones still going; one that "hit the step limit" gets **Continue (+25)** and picks up where it stopped. A click on a row opens its work so far in a read-only tab; **Subagent steps** in the `>_` menu sets the limit for new subagents (1–100, 50 by default)
- **Tasks from the web and the phone** — a task started in the web chat or on the phone opens here as a new chat: its tab carries 🌐, the first message reads "From the web: …", a toast "A task came in from the web: …" has **Open**, and the turn streams in the panel; a permission question can be answered here or on the site, whichever comes first. It takes signing in, an ExecAI plan that includes tasks from the web (the panel names it and links to the plans) and the folder bound to a project — **Project** in the `>_` menu. The status bar and the menu show who accepts tasks on this machine, with **Accept here** when the background `execai serve` holds them
- **The same chat in a window of its own** — the agent's `execai ui` command opens the chat without an editor: a window with no tabs and no address bar (or a browser tab when there is no suitable browser), with three looks in light and dark themes; over SSH, forward the port and open the printed link on your side. Guide: [docs/en/ui.md](https://github.com/execai/execai-agent/blob/main/docs/en/ui.md)
- **Notifications** — when the chat on screen finishes its turn or waits for your answer while the panel is hidden or the editor window is in the background, a notification says so, and its **Open** button brings the panel forward on that chat; a turn you stopped yourself is not announced. With the editor window in the background and an updated agent, the agent itself shows a desktop notification instead (on your own computer; in a remote session the in-editor one stays). In `execai ui` the 🔔 button in the page header turns on browser notifications. In the editor the `execai.notifications` setting turns them off
- **Sync messages** — what the agent's sync says (a copy kept next to a file, a file left out, a version taken from the server) shows in the chat as a service line, with its line breaks; sync commands are typed in a terminal: `execai sync`. Guide: [docs/en/sync.md](https://github.com/execai/execai-agent/blob/main/docs/en/sync.md)

Sources (ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…), models, memory and permissions are all configured in the CLI itself — the extension uses your current configuration. A source can also be **your own endpoint** — any OpenAI- or Anthropic-compatible address (LM Studio, vLLM, LiteLLM, a corporate gateway): **Connect a source → Custom provider** in the `>_` menu asks for its name, interface type, address and key. Model lists come from the providers themselves.

## Interface languages

The panel and the commands follow the editor's display language: **English** and **Russian** ship today, English is the fallback for every other locale. Adding a language means two files and no code — `package.nls.<lang>.json` for the manifest, `l10n/bundle.l10n.<lang>.json` for the runtime, plus a bundle in `STRINGS` inside [src/webviewHtml.ts](src/webviewHtml.ts). A unit test keeps every bundle in key parity with English.

## Install

1. Install the extension:
   - **VS Code** — Marketplace: `ExecAI`
   - **Cursor / VSCodium / Windsurf** — Open VSX: `ExecAI`
   - or by hand: download the `.vsix` from [Releases](https://github.com/execai/execai-vscode/releases) → `Extensions: Install from VSIX…`
2. Open a project folder — the ExecAI icon appears on the left.
3. On first run the extension offers to **download the agent** (~7 MB). It lands in the
   extension's storage, no sudo involved. If execai is already in PATH and recent
   enough (R7.21+), that one is used instead.

Then sign in and connect models right in the panel: the **Getting started** steps have a button for each, and the `>_` menu has the same ("Sign in to ExecAI", "Connect a source").

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
| `execai.resumeLastChat` | `true` | Continue the last chat of this project when the panel opens; off — start from a clean slate every time. |
| `execai.notifications` | `true` | Notify when a chat finishes its turn or waits for your answer while the panel is hidden or the editor window is in the background: inside the editor (its button opens that chat), or with a desktop notification while the window is in the background. |

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
