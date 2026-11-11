[English](README.md) | [Русский](README.ru.md) | **Español** | [Deutsch](README.de.md) | [中文](README.zh.md)

🌐 **Sitio web:** [execai.ru](https://execai.ru) · 💬 Chat web: [chat.execai.ru](https://chat.execai.ru) · 🖥 CLI: [execai/execai-agent](https://github.com/execai/execai-agent) · 🖥 Editor: [ExecAI Studio](https://github.com/execai/execai-studio)

---

# ExecAI para VS Code y Cursor

El agente [execai](https://github.com/execai/execai-agent) en la barra lateral de tu editor: chat con streaming, herramientas con confirmaciones, contexto del archivo activo. Todo el ciclo del agente se ejecuta en la CLI de tu propia máquina; la extensión solo lo dibuja.

## Qué hace

- **Chat en la barra lateral** — respuestas en streaming, bloque de razonamiento plegable, tarjetas de herramientas con salida en vivo (Bash emite líneas según aparecen)
- **Confirmaciones idénticas a las del TUI y el chat web** — cinco botones: «Una vez», «Esta herramienta durante la sesión», «Este comando durante la sesión», «PARA SIEMPRE» (se escribe en `permissions.json`), «Rechazar». El silencio nunca amplía permisos
- **Preguntas del agente** (AskUser) — cuando la decisión es tuya, las opciones llegan como botones
- **Contexto del editor** — el archivo activo y la selección se adjuntan al mensaje (`execai.attachContext`)
- **Archivos modificados** — fichas bajo el turno; al hacer clic se abre el archivo
- **Pestañas de chats** en la parte superior del panel, como las pestañas de archivos: todos los chats del proyecto, un clic para cambiar, «×» para cerrar (el chat sigue en el historial y un turno en curso continúa), arrastrar para reordenar
- **Los chats corren en paralelo** (agente R6.74+): cambia de pestaña mientras un chat responde — el turno sigue y se repite desde el principio al volver. Insignias en las pestañas: punto pulsante — trabajando, punto verde — terminado y sin leer, «?» — espera tu respuesta, ⏰ — despertar programado; un chat que termina o pregunta mientras estás en otro muestra un aviso con **Open**. Los despertares (`schedule_wakeup`) aparecen como una línea con **Now** / **Cancel** y sobreviven a un reinicio del editor
- **Enlaces clicables** — una URL se abre en el navegador; una ruta del proyecto (`internal/agent/memory.go:42`) abre el archivo en esa línea
- **Botones de copiar** — en cada bloque de código y en la respuesta completa (copia el markdown original)
- **Stop** corta el turno actual; **New chat** reinicia el historial y los permisos de sesión
- **Salida de emergencia al terminal** — el comando «ExecAI: Open in a terminal» te da el TUI completo
- **Getting started** (agente R7.10+) — un chat vacío se abre con cinco pasos y sus marcas: iniciar sesión, conectar modelos, activar la sincronización, vincular la carpeta a un proyecto, llamar al agente desde el teléfono. Cada paso tiene el botón que lo hace; cerrada una vez, la pantalla sigue cerrada en todos los proyectos, y el menú `>_` o el comando «ExecAI: Getting started» la recupera
- **My machine** — una tarjeta compacta desde la barra de título del panel, el menú `>_` o el comando «ExecAI: My machine»: la máquina y la versión del agente, la cuenta y su plan, qué fuentes de modelos respondieron y cuándo, qué lleva la sincronización, si el chat web y el teléfono pueden llegar a esta máquina
- **Código QR para el teléfono** — **Show the QR code** en el último paso y **QR for the phone** en la tarjeta: apunta la cámara del teléfono y el chat web se abre con esta máquina seleccionada. El código se dibuja en el propio panel, no se descarga nada
- **Subagentes** — cuando el agente reparte trabajo entre subagentes, un bloque **Agents** sobre la entrada los muestra: estado, título, «step 12/50 · 38 left» (en amarillo cuando quedan 5 o menos), la última herramienta y el tiempo en marcha, con **+25** y **Stop** en los que siguen trabajando; el que llega a «hit the step limit» recibe **Continue (+25)** y sigue donde se quedó. Un clic en una fila abre lo que ha hecho hasta ahora en una pestaña de solo lectura; **Subagent steps** en el menú `>_` fija el límite para los subagentes nuevos (1–100, 50 por defecto)
- **Tareas desde la web y el teléfono** — una tarea iniciada en el chat web o en el teléfono se abre aquí como un chat nuevo: su pestaña lleva 🌐, el primer mensaje dice «From the web: …», un aviso «A task came in from the web: …» trae **Open** y el turno se transmite en el panel; una pregunta de permiso se puede responder aquí o en el sitio, lo que ocurra antes. Hace falta iniciar sesión, un plan de ExecAI que incluya tareas desde la web (el panel lo indica y enlaza los planes) y la carpeta vinculada a un proyecto — **Project** en el menú `>_`. La barra de estado y el menú muestran quién acepta tareas en esta máquina, con **Accept here** cuando las tiene `execai serve` en segundo plano
- **El mismo panel en un navegador** — el comando del agente `execai ui` abre este panel en una pestaña del navegador en 127.0.0.1, sin editor; por SSH, redirige el puerto y abre en tu equipo el enlace impreso. Guía: [docs/en/ui.md](https://github.com/execai/execai-agent/blob/main/docs/en/ui.md)

Las fuentes (ExecAI / Z.ai / Kimi / Anthropic / OpenAI / Ollama…), los modelos, la memoria y los permisos se configuran en la propia CLI: la extensión usa tu configuración actual. Una fuente también puede ser **tu propio endpoint**: cualquier dirección compatible con OpenAI o Anthropic (LM Studio, vLLM, LiteLLM, una pasarela corporativa). **Connect a source → Custom provider** en el menú `>_` pide nombre, tipo de interfaz, dirección y clave. Las listas de modelos vienen de los propios proveedores.

## Idiomas de la interfaz

El panel y los comandos siguen el idioma de la interfaz del editor: hoy se incluyen **inglés** y **ruso**, y el inglés es el respaldo para el resto de configuraciones regionales. Añadir un idioma son dos archivos y ni una línea de código: `package.nls.<lang>.json` para el manifiesto, `l10n/bundle.l10n.<lang>.json` para el runtime y un diccionario en `STRINGS` dentro de [src/webviewHtml.ts](src/webviewHtml.ts). Una prueba unitaria garantiza que todos los diccionarios tengan las mismas claves que el inglés.

## Instalación

1. Instala la extensión:
   - **VS Code** — Marketplace: `ExecAI`
   - **Cursor / VSCodium / Windsurf** — Open VSX: `ExecAI`
   - o a mano: descarga el `.vsix` desde [Releases](https://github.com/execai/execai-vscode/releases) → `Extensions: Install from VSIX…`
2. Abre una carpeta de proyecto: el icono de ExecAI aparecerá a la izquierda.
3. En el primer arranque la extensión te ofrecerá **descargar el agente** (~7 MB). Se guarda
   en el almacenamiento de la extensión, sin sudo. Si execai ya está en el PATH y es
   suficientemente reciente (R7.10+), se usa ese.

Después inicia sesión y conecta modelos desde el propio panel: los pasos de **Getting started** tienen un botón para cada cosa, y el menú `>_` ofrece lo mismo («Sign in to ExecAI», «Connect a source»).

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
| `execai.resumeLastChat` | `true` | Continuar el último chat del proyecto al abrir el panel; desactivado: empezar desde cero cada vez. |

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
