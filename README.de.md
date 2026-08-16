[English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | **Deutsch** | [中文](README.zh.md)

🌐 **Website:** [execai.ru](https://execai.ru) · 💬 Web-Chat: [chat.execai.ru](https://chat.execai.ru) · 🖥 CLI: [execai/execai-agent](https://github.com/execai/execai-agent) · 🖥 Editor: [ExecAI Studio](https://github.com/execai/execai-studio)

---

# ExecAI für VS Code und Cursor

Der Agent [execai](https://github.com/execai/execai-agent) in der Seitenleiste deines Editors: Chat mit Streaming, Werkzeuge mit Bestätigungen, Kontext der aktiven Datei. Die gesamte Agentenschleife läuft in der CLI auf deinem eigenen Rechner — die Erweiterung zeichnet sie nur.

## Was sie kann

- **Chat in der Seitenleiste** — gestreamte Antworten, ein einklappbarer Denkblock, Werkzeugkarten mit Live-Ausgabe (Bash streamt Zeilen, sobald sie entstehen)
- **Bestätigungen genau wie im TUI und im Web-Chat** — fünf Schaltflächen: „Einmalig“, „Dieses Werkzeug für die Sitzung“, „Diesen Befehl für die Sitzung“, „FÜR IMMER“ (wird in `permissions.json` geschrieben), „Ablehnen“. Schweigen erweitert niemals Rechte
- **Rückfragen des Agenten** (AskUser) — wenn die Entscheidung bei dir liegt, kommen die Optionen als Schaltflächen
- **Editor-Kontext** — die aktive Datei und die Auswahl werden an die Nachricht angehängt (`execai.attachContext`)
- **Geänderte Dateien** — Chips unter dem Zug, ein Klick öffnet die Datei
- **Stopp** bricht den laufenden Zug ab; **Neuer Chat** setzt Verlauf und Sitzungsrechte zurück
- **Notausgang Terminal** — der Befehl „ExecAI: Im Terminal öffnen“ liefert das vollständige TUI

Quellen (ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…), Modelle, Gedächtnis und Rechte werden in der CLI selbst konfiguriert — die Erweiterung nutzt deine aktuelle Konfiguration.

## Oberflächensprachen

Panel und Befehle folgen der Anzeigesprache des Editors: **Englisch** und **Russisch** sind heute enthalten, Englisch ist der Rückfall für alle anderen Sprachen. Eine Sprache hinzuzufügen bedeutet zwei Dateien und keine Codezeile: `package.nls.<lang>.json` für das Manifest, `l10n/bundle.l10n.<lang>.json` für die Laufzeit und ein Wörterbuch in `STRINGS` in [src/webviewHtml.ts](src/webviewHtml.ts). Ein Unit-Test hält alle Wörterbücher schlüsselgleich mit dem englischen.

## Installation

1. Erweiterung installieren:
   - **VS Code** — Marketplace: `ExecAI`
   - **Cursor / VSCodium / Windsurf** — Open VSX: `ExecAI`
   - oder von Hand: `.vsix` aus den [Releases](https://github.com/execai/execai-vscode/releases) laden → `Extensions: Install from VSIX…`
2. Öffne einen Projektordner — links erscheint das ExecAI-Symbol.
3. Beim ersten Start bietet die Erweiterung an, **den Agenten herunterzuladen** (~6 MB). Er landet
   im Speicher der Erweiterung, ohne sudo. Liegt execai bereits im PATH und ist
   aktuell genug (R6.49+), wird dieser verwendet.

Melde dich danach an oder verbinde dein eigenes Abo direkt im Chat: `>_` → „execai im Terminal öffnen“.

Den Agenten von Hand zu installieren ist optional, aber möglich:

```bash
curl -fsSL https://raw.githubusercontent.com/execai/execai-agent/main/install.sh | bash
```

## Einstellungen

| Einstellung | Standard | Wirkung |
| --- | --- | --- |
| `execai.binaryPath` | `execai` | Pfad zur Binärdatei. Leer oder `execai` — im PATH gesucht oder von der Erweiterung geholt. |
| `execai.maxIterations` | `0` | Grenze der Werkzeug-Iterationen pro Zug (0 — aus der execai-Konfiguration). |
| `execai.attachContext` | `true` | Aktive Datei und Auswahl an die Nachricht anhängen. |
| `execai.autoInstall` | `true` | Den Download des Agenten anbieten, wenn er fehlt oder veraltet ist. |

## Wie es funktioniert

Die Erweiterung startet `execai ide --cwd <Projektordner>` und spricht über JSON-Zeilen auf stdin/stdout mit ihm. Das Protokoll ist versioniert: driften die Versionen auseinander, bittet die Erweiterung um ein Update, statt still zu zerbrechen. Eine unbeantwortete Frage (du hast den Editor geschlossen) wertet der Agent als Ablehnung — dasselbe Prinzip wie im Hintergrundmodus von `execai serve`.

## Entwicklung

```bash
npm install
npm test          # Unit-Tests: Protokoll, Versionsvergleich, Webview-Markup, i18n
npm run build     # esbuild → dist/extension.js
npm run package   # .vsix über @vscode/vsce
```

## Lizenz

Business Source License 1.1 — frei für internen und produktiven Einsatz; kommerzielles Hosting als Dienst erfordert eine gesonderte Lizenz (it@velesbsd.com).

## Support

- Fehler und Wünsche: [github.com/execai/execai-vscode/issues](https://github.com/execai/execai-vscode/issues)
- Der Agent selbst: [github.com/execai/execai-agent](https://github.com/execai/execai-agent)
