import * as vscode from 'vscode';

/**
 * Voice command definitions.
 * Maps spoken phrases to actions.
 */
interface VoiceCommandMatch {
  command: string;
  remainingText: string;
}

const VOICE_COMMANDS: { phrase: string; command: string }[] = [
  { phrase: 'stop recording', command: 'voiceAssistant.stopRecording' },
  { phrase: 'new line', command: '__newline__' },
  { phrase: 'period', command: '__period__' },
  { phrase: 'comma', command: '__comma__' },
  { phrase: 'question mark', command: '__questionmark__' },
  { phrase: 'exclamation mark', command: '__exclamationmark__' },
  { phrase: 'clear all', command: '__clear__' },
];

/**
 * Check if the transcribed text starts with or contains a voice command.
 * Returns the command to execute and any remaining text.
 */
export function detectVoiceCommand(text: string): VoiceCommandMatch | null {
  const lowerText = text.toLowerCase().trim();

  for (const vc of VOICE_COMMANDS) {
    if (lowerText === vc.phrase || lowerText.startsWith(vc.phrase + ' ')) {
      const remaining = text.slice(vc.phrase.length).trim();
      return { command: vc.command, remainingText: remaining };
    }

    // Also check if it ends with the command
    if (lowerText.endsWith(vc.phrase)) {
      const remaining = text.slice(0, text.length - vc.phrase.length).trim();
      return { command: vc.command, remainingText: remaining };
    }
  }

  return null;
}

/**
 * Execute a voice command.
 * Returns processed text after applying text-based commands, or null if it was an action command.
 */
export async function executeVoiceCommand(
  match: VoiceCommandMatch
): Promise<string | null> {
  switch (match.command) {
    case '__newline__':
      return match.remainingText + '\n';
    case '__period__':
      return match.remainingText + '.';
    case '__comma__':
      return match.remainingText + ',';
    case '__questionmark__':
      return match.remainingText + '?';
    case '__exclamationmark__':
      return match.remainingText + '!';
    case '__clear__':
      return '';
    default:
      // It's a VS Code command
      await vscode.commands.executeCommand(match.command);
      return null;
  }
}
