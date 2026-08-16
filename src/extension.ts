// Extension entry point. Works in VS Code and in Cursor (Cursor is a fork with
// the same API; the only difference is the registry the .vsix comes from).

import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView';
import { ensureSystemAgent, resolveBinary } from './install';
import { watchStudioUpdates } from './studioUpdate';

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

  // Studio has no built-in updater (its updateUrl is stripped at build time),
  // so the extension watches both release channels instead. No-op outside Studio.
  watchStudioUpdates(ctx);
}

export function deactivate(): void {
  // dispose does its job through subscriptions.
}
