import * as vscode from 'vscode';

export type RecordingState = 'idle' | 'recording' | 'processing';

/**
 * Manages the status bar item that shows recording state.
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private _state: RecordingState = 'idle';

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'voiceAssistant.toggleRecording';
    this.statusBarItem.tooltip = 'Click to toggle voice recording';
    this.updateDisplay();
    this.statusBarItem.show();
  }

  get state(): RecordingState {
    return this._state;
  }

  setState(state: RecordingState): void {
    this._state = state;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    switch (this._state) {
      case 'idle':
        this.statusBarItem.text = '$(mic) Voice Off';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = 'Click to start voice recording';
        break;
      case 'recording':
        this.statusBarItem.text = '$(mic-filled) Recording...';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
        this.statusBarItem.tooltip = 'Click to stop voice recording';
        break;
      case 'processing':
        this.statusBarItem.text = '$(loading~spin) Processing...';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        this.statusBarItem.tooltip = 'Transcribing speech...';
        break;
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
