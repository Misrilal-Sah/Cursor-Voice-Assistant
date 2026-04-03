import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

/**
 * AI-powered prompt cleaner using Groq (llama3-8b-8192).
 * Free tier with generous limits — get a key at https://console.groq.com/keys
 * Set it in: Settings → Voice Assistant → Groq API Key
 */
export class AIPromptCleaner {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Returns true if a Groq API key is configured.
   */
  isAvailable(): boolean {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    return config.get<string>('groqApiKey', '').length > 0;
  }

  /**
   * Clean up a transcribed prompt using Groq.
   */
  async cleanPrompt(rawText: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const apiKey = config.get<string>('groqApiKey', '');
    if (!apiKey) {
      throw new Error(
        'Groq API key is not configured. Get a free key at https://console.groq.com/keys ' +
        'and set it in Settings \u2192 Voice Assistant \u2192 Groq API Key.'
      );
    }
    this.outputChannel.appendLine(`[AICleanup] Calling Groq — "${rawText}"`);
    const result = await this.callGroqAPI(rawText, apiKey);
    this.outputChannel.appendLine(`[AICleanup] Groq result — "${result}"`);
    return result;
  }

  // ─── Groq API ──────────────────────────────────────────────────────────────
  private callGroqAPI(text: string, apiKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content:
              'You are a prompt cleanup assistant. Take raw speech-to-text and convert it into a ' +
              'clean, well-formed developer prompt. Remove filler words (um, uh, like, you know, ' +
              'basically), fix grammar and punctuation, keep the original intent, and output ONLY ' +
              'the cleaned text — no explanations.',
          },
          {
            role: 'user',
            content: `Clean up this speech transcription:\n\n"${text}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const options: https.RequestOptions = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res: http.IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          try {
            const data = JSON.parse(raw);
            if (res.statusCode !== 200) {
              reject(new Error(`Groq API error (${res.statusCode}): ${data.error?.message || raw}`));
              return;
            }
            const content: string = (data.choices?.[0]?.message?.content ?? '').trim();
            resolve(this.stripQuotes(content));
          } catch {
            reject(new Error(`Failed to parse Groq response: ${raw}`));
          }
        });
      });
      req.on('error', (err: Error) => reject(new Error(`Groq request failed: ${err.message}`)));
      req.write(body);
      req.end();
    });
  }

  private stripQuotes(s: string): string {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }
}
