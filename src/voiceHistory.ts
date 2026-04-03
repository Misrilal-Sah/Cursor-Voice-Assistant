import * as vscode from 'vscode';

interface HistoryEntry {
  text: string;
  timestamp: number;
  engine: string;
  language: string;
}

const HISTORY_KEY = 'voiceAssistant.history';
const MAX_HISTORY = 50;

/**
 * Manages voice transcription history using VS Code global state.
 */
export class VoiceHistory {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Add a transcription to history.
   */
  addEntry(text: string, engine: string, language: string): void {
    if (!text || text.trim().length === 0) {
      return;
    }

    const history = this.getHistory();
    history.unshift({
      text: text.trim(),
      timestamp: Date.now(),
      engine,
      language,
    });

    // Keep only the most recent entries
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }

    this.context.globalState.update(HISTORY_KEY, history);
  }

  /**
   * Get all history entries.
   */
  getHistory(): HistoryEntry[] {
    return this.context.globalState.get<HistoryEntry[]>(HISTORY_KEY, []);
  }

  /**
   * Clear all history.
   */
  clearHistory(): void {
    this.context.globalState.update(HISTORY_KEY, []);
  }

  /**
   * Show history in a Quick Pick list.
   * User can select an entry to copy it to clipboard.
   */
  async showHistoryPicker(): Promise<void> {
    const history = this.getHistory();

    if (history.length === 0) {
      vscode.window.showInformationMessage('No voice history yet.');
      return;
    }

    const items: vscode.QuickPickItem[] = history.map((entry, index) => {
      const date = new Date(entry.timestamp);
      const timeStr = date.toLocaleString();
      const preview =
        entry.text.length > 80 ? entry.text.slice(0, 80) + '...' : entry.text;

      return {
        label: `$(comment) ${preview}`,
        description: `${entry.engine}`,
        detail: `${timeStr}`,
        picked: index === 0,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a transcription to copy to clipboard',
      title: 'Voice History',
    });

    if (selected) {
      const index = items.indexOf(selected);
      const entry = history[index];
      await vscode.env.clipboard.writeText(entry.text);
      vscode.window.showInformationMessage('Transcription copied to clipboard!');
    }
  }
}
