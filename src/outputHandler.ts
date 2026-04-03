import * as vscode from 'vscode';

/**
 * Handles routing transcribed text to the appropriate output destination.
 */
export class OutputHandler {
  /**
   * Send transcribed text to the configured output destination.
   */
  async sendOutput(text: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const outputMode = config.get<string>('outputMode', 'clipboard');
    const autoOpenChat = config.get<boolean>('autoOpenChat', true);

    switch (outputMode) {
      case 'clipboard':
        await this.copyToClipboard(text);
        if (autoOpenChat) {
          await this.openCursorChat();
        }
        break;

      case 'editor':
        await this.insertIntoEditor(text);
        break;

      case 'both':
        await this.copyToClipboard(text);
        await this.insertIntoEditor(text);
        if (autoOpenChat) {
          await this.openCursorChat();
        }
        break;
    }
  }

  /**
   * Copy text to system clipboard and show a notification.
   */
  async copyToClipboard(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(
      `🎤 Voice transcription copied! Paste with Ctrl+V`,
      'Dismiss'
    );
  }

  /**
   * Try to open the Cursor AI chat panel.
   * Falls back to different commands since Cursor may use various command IDs.
   */
  async openCursorChat(): Promise<void> {
    const chatCommands = [
      'workbench.action.chat.open',
      'aichat.newchataction',
      'workbench.panel.chat.view.copilot.focus',
    ];

    for (const cmd of chatCommands) {
      try {
        await vscode.commands.executeCommand(cmd);
        return;
      } catch {
        // Command not available, try next
      }
    }

    // If none worked, just notify the user
    // The clipboard already has the text, so they can paste manually
  }

  /**
   * Insert text at the current cursor position in the active text editor.
   */
  async insertIntoEditor(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(
        'No active editor found. Text was copied to clipboard instead.'
      );
      await this.copyToClipboard(text);
      return;
    }

    await editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, text);
    });
  }
}
