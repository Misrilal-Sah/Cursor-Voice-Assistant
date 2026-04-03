import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

/**
 * AI-powered prompt cleaner.
 * Supports two providers — whichever the user has configured:
 *   • Groq   — llama3-8b-8192, very fast, generous free tier
 *              Get key: https://console.groq.com/keys
 *   • Gemini — gemini-2.0-flash, 250 req/day free tier
 *              Get key: https://aistudio.google.com/apikey
 */
export class AIPromptCleaner {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Returns true if at least one AI provider key is configured.
   */
  isAvailable(): boolean {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const groqKey = config.get<string>('groqApiKey', '');
    const geminiKey = config.get<string>('geminiApiKey', '');
    return groqKey.length > 0 || geminiKey.length > 0;
  }

  /**
   * Clean up a transcribed prompt using the configured AI provider.
   */
  async cleanPrompt(rawText: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const provider = config.get<string>('aiCleanupProvider', 'groq');

    if (provider === 'groq') {
      const apiKey = config.get<string>('groqApiKey', '');
      if (!apiKey) {
        throw new Error(
          'Groq API key is not configured. Get a free key at https://console.groq.com/keys ' +
          'and set it in Settings → Voice Assistant → Groq API Key.'
        );
      }
      this.outputChannel.appendLine(`[AICleanup] Using Groq — "${rawText}"`);
      const result = await this.callGroqAPI(rawText, apiKey);
      this.outputChannel.appendLine(`[AICleanup] Groq result — "${result}"`);
      return result;
    }

    // Gemini fallback
    const apiKey = config.get<string>('geminiApiKey', '');
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Get a free key at https://aistudio.google.com/apikey ' +
        'and set it in Settings → Voice Assistant → Gemini API Key.'
      );
    }
    this.outputChannel.appendLine(`[AICleanup] Using Gemini — "${rawText}"`);
    const result = await this.callGeminiAPI(rawText, apiKey);
    this.outputChannel.appendLine(`[AICleanup] Gemini result — "${result}"`);
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

  // ─── Gemini API ────────────────────────────────────────────────────────────
  private callGeminiAPI(text: string, apiKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const systemPrompt =
        'You are a prompt cleanup assistant. Take raw speech-to-text transcription and clean it ' +
        'into a well-formed prompt.\n' +
        'Rules:\n' +
        '1. Remove filler words (um, uh, like, you know, basically, actually, etc.)\n' +
        '2. Fix grammar and punctuation\n' +
        '3. Keep the original intent — do NOT add or change meaning\n' +
        '4. Output ONLY the cleaned text — no explanations, no quotes, no prefix';

      const body = JSON.stringify({
        contents: [{ parts: [{ text: `Clean up this speech transcription:\n\n"${text}"` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      });

      const options: https.RequestOptions = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
              reject(new Error(`Gemini API error (${res.statusCode}): ${data.error?.message || raw}`));
              return;
            }
            const content: string = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
            resolve(this.stripQuotes(content));
          } catch {
            reject(new Error(`Failed to parse Gemini response: ${raw}`));
          }
        });
      });
      req.on('error', (err: Error) => reject(new Error(`Gemini request failed: ${err.message}`)));
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
