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
- **Chat-Tabs** oben im Panel, wie Datei-Tabs im Editor: alle Chats des Projekts, ein Klick zum Wechseln, «×» zum Schließen (der Chat bleibt in der Historie, ein laufender Turn läuft weiter), Ziehen zum Umsortieren
- **Chats laufen parallel** (Agent R6.74+): Tabs wechseln, während ein Chat antwortet — der Zug läuft weiter und wird beim Zurückkommen von Anfang an abgespielt. Badges auf den Tabs: pulsierender Punkt — arbeitet, grüner Punkt — fertig und noch nicht gelesen, «?» — wartet auf deine Antwort, ⏰ — Aufwachen geplant; ein Chat, der fertig wird oder fragt, während du woanders bist, zeigt einen Toast mit **Open**. Aufwachen (`schedule_wakeup`) erscheint als Zeile mit **Now** / **Cancel** und überlebt einen Editor-Neustart
- **Klickbare Links** — eine URL öffnet im Browser, ein Projektpfad (`internal/agent/memory.go:42`) öffnet die Datei an dieser Zeile
- **Kopier-Buttons** — an jedem Codeblock und an der ganzen Antwort (kopiert das ursprüngliche Markdown)
- **Stop** bricht den laufenden Zug ab; **New chat** setzt Verlauf und Sitzungsrechte zurück
- **Notausgang Terminal** — der Befehl „ExecAI: Open in a terminal“ liefert das vollständige TUI
- **Getting started** (Agent R7.10+) — ein leerer Chat beginnt mit fünf Schritten und ihren Häkchen: anmelden, Modelle verbinden, Sync einschalten, den Ordner an ein Projekt binden, den Agenten vom Handy aus rufen. Jeder Schritt hat die Schaltfläche, die ihn erledigt; einmal geschlossen, bleibt der Bildschirm in allen Projekten zu, und das `>_`-Menü oder der Befehl „ExecAI: Getting started“ holt ihn zurück
- **My machine** — eine kompakte Karte aus der Titelleiste des Panels, dem `>_`-Menü oder dem Befehl „ExecAI: My machine“: Rechner und Agent-Version, Konto und Tarif, welche Modellquellen geantwortet haben und wann, was der Sync überträgt, ob Web-Chat und Handy diesen Rechner erreichen
- **QR-Code fürs Handy** — **Show the QR code** im letzten Schritt und **QR for the phone** auf der Karte: die Handykamera darauf richten, und der Web-Chat öffnet sich mit diesem Rechner ausgewählt. Der Code wird direkt im Panel gezeichnet, nichts wird geladen
- **Subagenten** — verteilt der Agent Arbeit an Subagenten, listet ein Block **Agents** über der Eingabe sie auf: Zustand, Titel, „step 12/50 · 38 left“ (gelb ab 5 verbleibenden Schritten), das letzte Werkzeug und die Laufzeit, dazu **+25** und **Stop** bei denen, die noch laufen; einer mit „hit the step limit“ bekommt **Continue (+25)** und macht dort weiter, wo er stehen blieb. Ein Klick auf eine Zeile öffnet seine bisherige Arbeit in einem schreibgeschützten Tab; **Subagent steps** im `>_`-Menü legt die Grenze für neue Subagenten fest (1–100, Standard 50)
- **Aufgaben aus dem Web und vom Handy** — eine im Web-Chat oder auf dem Handy gestartete Aufgabe öffnet sich hier als neuer Chat: der Tab trägt 🌐, die erste Nachricht lautet „From the web: …“, ein Toast „A task came in from the web: …“ hat **Open**, und der Zug läuft im Panel; eine Berechtigungsfrage lässt sich hier oder auf der Website beantworten, je nachdem, was zuerst kommt. Nötig sind die Anmeldung, ein ExecAI-Tarif mit Aufgaben aus dem Web (das Panel nennt ihn und verlinkt die Tarife) und ein an ein Projekt gebundener Ordner — **Project** im `>_`-Menü. Statusleiste und Menü zeigen, wer auf diesem Rechner Aufgaben annimmt, mit **Accept here**, wenn das im Hintergrund laufende `execai serve` sie hält
- **Derselbe Chat in einem eigenen Fenster** — der Agent-Befehl `execai ui` öffnet den Chat ganz ohne Editor: ein Fenster ohne Tabs und Adressleiste (oder ein Browser-Tab, wenn kein passender Browser vorhanden ist), drei Designs jeweils hell und dunkel; über SSH den Port weiterleiten und den ausgegebenen Link bei dir öffnen. Anleitung: [docs/en/ui.md](https://github.com/execai/execai-agent/blob/main/docs/en/ui.md)
- **Benachrichtigungen** — beendet der Chat auf dem Bildschirm seinen Zug oder wartet er auf deine Antwort, während das Panel verborgen oder das Editorfenster im Hintergrund ist, meldet eine Benachrichtigung das, und ihre Schaltfläche **Open** holt das Panel mit diesem Chat nach vorn; einen Zug, den du selbst gestoppt hast, meldet sie nicht. Ist das Editorfenster im Hintergrund, zeigt mit einem aktualisierten Agenten der Agent selbst stattdessen eine Desktop-Benachrichtigung (auf deinem eigenen Rechner; in einer Remote-Sitzung bleibt die im Editor). In `execai ui` schaltet die Schaltfläche 🔔 im Seitenkopf Browser-Benachrichtigungen ein. Im Editor schaltet die Einstellung `execai.notifications` sie ab
- **Sync-Meldungen** — was der Sync des Agenten meldet (eine neben einer Datei aufbewahrte Kopie, eine ausgelassene Datei, eine vom Server übernommene Version), erscheint im Chat als Dienstzeile, mit ihren Zeilenumbrüchen; Sync-Befehle gibst du im Terminal ein: `execai sync`. Anleitung: [docs/en/sync.md](https://github.com/execai/execai-agent/blob/main/docs/en/sync.md)

Quellen (ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…), Modelle, Gedächtnis und Rechte werden in der CLI selbst konfiguriert — die Erweiterung nutzt deine aktuelle Konfiguration. Eine Quelle kann auch **dein eigener Endpoint** sein — jede OpenAI- oder Anthropic-kompatible Adresse (LM Studio, vLLM, LiteLLM, ein Firmen-Gateway): **Connect a source → Custom provider** im `>_`-Menü fragt nach Name, Schnittstellentyp, Adresse und Key. Die Modelllisten kommen von den Anbietern selbst.

## Oberflächensprachen

Panel und Befehle folgen der Anzeigesprache des Editors: **Englisch** und **Russisch** sind heute enthalten, Englisch ist der Rückfall für alle anderen Sprachen. Eine Sprache hinzuzufügen bedeutet zwei Dateien und keine Codezeile: `package.nls.<lang>.json` für das Manifest, `l10n/bundle.l10n.<lang>.json` für die Laufzeit und ein Wörterbuch in `STRINGS` in [src/webviewHtml.ts](src/webviewHtml.ts). Ein Unit-Test hält alle Wörterbücher schlüsselgleich mit dem englischen.

## Installation

1. Erweiterung installieren:
   - **VS Code** — Marketplace: `ExecAI`
   - **Cursor / VSCodium / Windsurf** — Open VSX: `ExecAI`
   - oder von Hand: `.vsix` aus den [Releases](https://github.com/execai/execai-vscode/releases) laden → `Extensions: Install from VSIX…`
2. Öffne einen Projektordner — links erscheint das ExecAI-Symbol.
3. Beim ersten Start bietet die Erweiterung an, **den Agenten herunterzuladen** (~7 MB). Er landet
   im Speicher der Erweiterung, ohne sudo. Liegt execai bereits im PATH und ist
   aktuell genug (R7.21+), wird dieser verwendet.

Melde dich danach an und verbinde Modelle direkt im Panel: die Schritte von **Getting started** haben dafür je eine Schaltfläche, das `>_`-Menü hat dasselbe („Sign in to ExecAI“, „Connect a source“).

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
| `execai.resumeLastChat` | `true` | Beim Öffnen des Panels den letzten Chat des Projekts fortsetzen; aus — jedes Mal bei null anfangen. |
| `execai.notifications` | `true` | Melden, wenn ein Chat seinen Zug beendet oder auf deine Antwort wartet, während das Panel verborgen oder das Editorfenster im Hintergrund ist: im Editor (die Schaltfläche öffnet diesen Chat) oder per Desktop-Benachrichtigung, solange das Fenster im Hintergrund ist. |

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
