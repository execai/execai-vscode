// Extension entry point. Works in VS Code and in Cursor (Cursor is a fork with
// the same API; the only difference is the registry the .vsix comes from).

import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView';

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
    vscode.commands.registerCommand('execai.openTerminal', () => {
      // Escape hatch: the full TUI in a terminal, for people who outgrow the panel.
      const term = vscode.window.createTerminal({ name: 'execai' });
      const bin = vscode.workspace.getConfiguration('execai').get<string>('binaryPath') || 'execai';
      term.show();
      term.sendText(bin);
    }),
    { dispose: () => chat.dispose() },
  );
}

export function deactivate(): void {
  // dispose does its job through subscriptions.
}
