import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { TranscriptionEngine, TranscriptionEngineType } from './engineTypes';

/**
 * OpenAI Whisper API transcription engine.
 * Sends recorded audio to the Whisper API and returns transcribed text.
 */
export class WhisperEngine implements TranscriptionEngine {
  readonly type = TranscriptionEngineType.WhisperAPI;

  async transcribe(audioData: Buffer, language: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const apiKey = config.get<string>('whisperApiKey', '');

    if (!apiKey) {
      throw new Error(
        'OpenAI API key is not configured. Set it in Settings → Voice Assistant → Whisper API Key.'
      );
    }

    // Map BCP-47 language code to ISO-639-1 for Whisper API
    const langCode = language.split('-')[0]; // "en-US" → "en"

    return this.callWhisperAPI(audioData, apiKey, langCode);
  }

  private callWhisperAPI(
    audioData: Buffer,
    apiKey: string,
    language: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

      // Build multipart form data
      const formParts: Buffer[] = [];

      // File field
      formParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`
        )
      );
      formParts.push(audioData);
      formParts.push(Buffer.from('\r\n'));

      // Model field
      formParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
        )
      );

      // Language field
      formParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`
        )
      );

      // Response format
      formParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`
        )
      );

      // End boundary
      formParts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(formParts);

      const options: https.RequestOptions = {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      };

      const req = https.request(options, (res: http.IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          try {
            const data = JSON.parse(responseBody);
            if (res.statusCode !== 200) {
              reject(
                new Error(
                  `Whisper API error (${res.statusCode}): ${data.error?.message || responseBody}`
                )
              );
              return;
            }
            resolve(data.text || '');
          } catch {
            reject(new Error(`Failed to parse Whisper API response: ${responseBody}`));
          }
        });
      });

      req.on('error', (err: Error) => {
        reject(new Error(`Whisper API request failed: ${err.message}`));
      });

      req.write(body);
      req.end();
    });
  }
}
