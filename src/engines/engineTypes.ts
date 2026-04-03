/**
 * Transcription engine types and interfaces.
 */

export enum TranscriptionEngineType {
  WebSpeechAPI = 'webSpeechAPI',
  WhisperAPI = 'whisperAPI',
  WindowsSpeech = 'windowsSpeech',
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface TranscriptionEngine {
  readonly type: TranscriptionEngineType;
  transcribe(audioData: Buffer, language: string): Promise<string>;
}
