[English](README.md) | [Русский](README.ru.md) | **Español** | [Deutsch](README.de.md) | [中文](README.zh.md)

🌐 **Sitio web:** [execai.ru](https://execai.ru) · 💬 Chat web: [chat.execai.ru](https://chat.execai.ru) · 🖥 CLI: [execai/execai-agent](https://github.com/execai/execai-agent)

---

# ExecAI para VS Code y Cursor

El agente [execai](https://github.com/execai/execai-agent) en la barra lateral de tu editor: chat con streaming, herramientas con confirmaciones, contexto del archivo activo. Todo el ciclo del agente se ejecuta en la CLI de tu propia máquina; la extensión solo lo dibuja.

## Qué hace

- **Chat en la barra lateral** — respuestas en streaming, bloque de razonamiento plegable, tarjetas de herramientas con salida en vivo (Bash emite líneas según aparecen)
- **Confirmaciones idénticas a las del TUI y el chat web** — cinco botones: «Una vez», «Esta herramienta durante la sesión», «Este comando durante la sesión», «PARA SIEMPRE» (se escribe en `permissions.json`), «Rechazar». El silencio nunca amplía permisos
- **Preguntas del agente** (AskUser) — cuando la decisión es tuya, las opciones llegan como botones
- **Contexto del editor** — el archivo activo y la selección se adjuntan al mensaje (`execai.attachContext`)
- **Archivos modificados** — fichas bajo el turno; al hacer clic se abre el archivo
- **Detener** corta el turno actual; **Nuevo chat** reinicia el historial y los permisos de sesión
- **Salida de emergencia al terminal** — el comando «ExecAI: Abrir en un terminal» te da el TUI completo

Las fuentes (ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…), los modelos, la memoria y los permisos se configuran en la propia CLI: la extensión usa tu configuración actual.

## Idiomas de la interfaz

El panel y los comandos siguen el idioma de la interfaz del editor: hoy se incluyen **inglés** y **ruso**, y el inglés es el respaldo para el resto de configuraciones regionales. Añadir un idioma son dos archivos y ni una línea de código: `package.nls.<lang>.json` para el manifiesto, `l10n/bundle.l10n.<lang>.json` para el runtime y un diccionario en `STRINGS` dentro de [src/webviewHtml.ts](src/webviewHtml.ts). Una prueba unitaria garantiza que todos los diccionarios tengan las mismas claves que el inglés.

## Instalación

1. Instala la extensión:
   - **VS Code** — Marketplace: `ExecAI`
   - **Cursor / VSCodium / Windsurf** — Open VSX: `ExecAI`
   - o a mano: descarga el `.vsix` desde [Releases](https://github.com/execai/execai-vscode/releases) → `Extensions: Install from VSIX…`
2. Abre una carpeta de proyecto: el icono de ExecAI aparecerá a la izquierda.
3. En el primer arranque la extensión te ofrecerá **descargar el agente** (~6 MB). Se guarda
   en el almacenamiento de la extensión, sin sudo. Si execai ya está en el PATH y es
   suficientemente reciente (R6.49+), se usa ese.

Después inicia sesión o conecta tu propia suscripción desde el chat: `>_` → «Abrir execai en un terminal».

Instalar el agente a mano es opcional, pero posible:

```bash
curl -fsSL https://raw.githubusercontent.com/execai/execai-agent/main/install.sh | bash
```

## Ajustes

| Ajuste | Por defecto | Qué hace |
| --- | --- | --- |
| `execai.binaryPath` | `execai` | Ruta al binario. Vacío o `execai`: se busca en el PATH o lo descarga la extensión. |
| `execai.maxIterations` | `0` | Límite de iteraciones de herramientas por turno (0: tomarlo de la configuración de execai). |
| `execai.attachContext` | `true` | Adjuntar el archivo activo y la selección al mensaje. |
| `execai.autoInstall` | `true` | Ofrecer la descarga del agente cuando falta o está desactualizado. |

## Cómo funciona

La extensión lanza `execai ide --cwd <carpeta del proyecto>` y habla con él mediante líneas JSON por stdin/stdout. El protocolo está versionado: si las versiones se desincronizan, la extensión te pide actualizar en lugar de fallar en silencio. Una pregunta sin responder (cerraste el editor) el agente la interpreta como rechazo, el mismo principio que en el modo en segundo plano de `execai serve`.

## Desarrollo

```bash
npm install
npm test          # pruebas unitarias: protocolo, comparación de versiones, marcado del webview, i18n
npm run build     # esbuild → dist/extension.js
npm run package   # .vsix mediante @vscode/vsce
```

## Licencia

Business Source License 1.1: libre para uso interno y en producción; el hosting comercial como servicio requiere una licencia aparte (it@velesbsd.com).

## Soporte

- Errores y sugerencias: [github.com/execai/execai-vscode/issues](https://github.com/execai/execai-vscode/issues)
- El agente en sí: [github.com/execai/execai-agent](https://github.com/execai/execai-agent)
