import * as vscode from 'vscode';
import * as https from 'https';

/**
 * AI-powered prompt cleaner using Google Gemini API (free tier).
 * Free tier: 250 requests/day, no billing needed.
 * Get a free API key at https://aistudio.google.com/apikey
 */
export class AIPromptCleaner {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Check if AI cleanup is available (API key is configured).
   */
  isAvailable(): boolean {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const apiKey = config.get<string>('geminiApiKey', '');
    return apiKey.length > 0;
  }

  /**
   * Clean up a transcribed prompt using Gemini AI.
   * Improves grammar, removes filler words, and formats as a proper prompt.
   */
  async cleanPrompt(rawText: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const apiKey = config.get<string>('geminiApiKey', '');

    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Get a free key at https://aistudio.google.com/apikey and set it in Settings → Voice Assistant → Gemini API Key.'
      );
    }

    this.outputChannel.appendLine(`[AICleanup] Cleaning prompt: "${rawText}"`);

    const cleanedText = await this.callGeminiAPI(rawText, apiKey);

    this.outputChannel.appendLine(`[AICleanup] Cleaned result: "${cleanedText}"`);

    return cleanedText;
  }

  /**
   * Call Google Gemini API to clean/improve the transcribed text.
   */
  private callGeminiAPI(text: string, apiKey: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const systemPrompt = `You are a prompt cleanup assistant. Your job is to take raw speech-to-text transcription and clean it up into a well-formed prompt.

Rules:
1. Remove filler words (um, uh, like, you know, basically, actually, etc.)
2. Fix grammar and punctuation
3. Maintain the original intent and meaning — do NOT add or change the meaning
4. Keep it concise and clear
5. If it's a coding instruction/prompt, format it as a clear developer request
6. Output ONLY the cleaned text — no explanations, no quotes, no prefix
7. If the text is already clean, return it as-is`;

      const requestBody = JSON.stringify({
        contents: [{
          parts: [{
            text: `Clean up this speech transcription into a proper prompt:\n\n"${text}"`,
          }],
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      });

      const options: https.RequestOptions = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          try {
            const data = JSON.parse(responseBody);

            if (res.statusCode !== 200) {
              const errorMsg = data.error?.message || `HTTP ${res.statusCode}`;
              reject(new Error(`Gemini API error: ${errorMsg}`));
              return;
            }

            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              // Strip any surrounding quotes the model might add
              let cleaned = content.trim();
              if (
                (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
                (cleaned.startsWith("'") && cleaned.endsWith("'"))
              ) {
                cleaned = cleaned.slice(1, -1);
              }
              resolve(cleaned);
            } else {
              reject(new Error('No content in Gemini response'));
            }
          } catch {
            reject(new Error(`Failed to parse Gemini response: ${responseBody}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Gemini API request failed: ${err.message}`));
      });

      req.write(requestBody);
      req.end();
    });
  }
}
