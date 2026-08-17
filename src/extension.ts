// Extension entry point. Works in VS Code and in Cursor (Cursor is a fork with
// the same API; the only difference is the registry the .vsix comes from).

import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView';
import { ensureSystemAgent, resolveBinary } from './install';
import { checkStudioUpdatesNow, finishPendingUpdate, studioVersion, watchStudioUpdates } from './studioUpdate';
import { ensureShellIntegration } from './studioShell';

export function activate(ctx: vscode.ExtensionContext): void {
  const chat = new ChatViewProvider(ctx);

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewId, chat, {
      webviewOptions: { retainContextWhenHidden: true }, // collapsing the panel must not kill the chat
    }),
    vscode.commands.registerCommand('execai.newChat', () => chat.newChat()),
    vscode.commands.registerCommand('execai.stop', () => chat.stopTurn()),
    vscode.commands.registerCommand('execai.restart', () => chat.restart()),
    vscode.commands.registerCommand('execai.sendSelection', () => chat.sendSelection()),
    vscode.commands.registerCommand('execai.installAgent', () => chat.installAgent()),
    vscode.commands.registerCommand('execai.checkUpdates', () => checkStudioUpdatesNow(ctx)),
    // Inside Studio the native Help → «Download Update» opens product.json's
    // downloadUrl, which the build points at execai-studio://update — the
    // editor hands that URI back here, and the extension installs the update
    // itself instead of sending the user to a web page.
    vscode.window.registerUriHandler({
      handleUri: (uri) => {
        // eslint-disable-next-line no-console
        console.log('execai: uri', uri.toString());
        if (uri.path.replace(/^\/+/, '') === 'update' && studioVersion()) checkStudioUpdatesNow(ctx);
      },
    }),
    vscode.commands.registerCommand('execai.attachFile',
      (uri?: vscode.Uri, uris?: vscode.Uri[]) => chat.attachFromCommand(uri, uris)),
    vscode.commands.registerCommand('execai.openTerminal', async () => {
      // Escape hatch: the full TUI in a terminal, for people who outgrow the
      // panel. The binary is resolved the same way the panel resolves it —
      // in Studio that is the bundled agent, which is not on PATH.
      const term = vscode.window.createTerminal({ name: 'execai' });
      const bin = (await resolveBinary(ctx)) || 'execai';
      term.show();
      term.sendText(bin.includes(' ') ? `"${bin}"` : bin);
    }),
    { dispose: () => chat.dispose() },
  );

  // ExecAI Studio opens with the chat in view, the way Cursor does. Only on
  // the very first start: after that the layout belongs to the user, and a
  // panel they closed must stay closed. In stock VS Code and Cursor the app
  // name never matches and nothing happens.
  if (vscode.env.appName.includes('ExecAI Studio') && !ctx.globalState.get('studioChatRevealed')) {
    void ctx.globalState.update('studioChatRevealed', true);
    void vscode.commands.executeCommand('execai.chat.focus');
  }

  // Studio keeps the terminal `execai` in step with the bundled agent:
  // install it when the system has none, refresh it when the system one is
  // older, leave a newer one alone. No-op outside Studio.
  void ensureSystemAgent();

  // Studio updates itself through the extension: finish a swap left from the
  // previous run, then watch both release channels. No-op outside Studio.
  void finishPendingUpdate(ctx).then(() => watchStudioUpdates(ctx));

  // «Open with ExecAI Studio» in the file manager, menu entry, URL scheme —
  // re-checked on every start so a self-update never leaves them stale.
  void ensureShellIntegration();
}

export function deactivate(): void {
  // dispose does its job through subscriptions.
}
