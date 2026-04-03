import * as http from 'http';
import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { getAudioPageHTML } from './audioPage';

/**
 * A local HTTP + WebSocket server for audio capture.
 *
 * Why: VS Code/Cursor WebViews don't grant microphone permissions,
 *      and System.Speech is not available on many Windows machines.
 * Solution: Serve an audio capture page on localhost and open it in the
 * user's default browser (Chrome/Edge), which has full microphone access
 * and Web Speech API support.
 *
 * Architecture:
 *   Extension ←→ WebSocket ←→ Browser page (localhost)
 *                                ├── getUserMedia (microphone)
 *                                ├── Web Speech API (transcription)
 *                                ├── MediaRecorder (for Whisper API)
 *                                └── AnalyserNode (silence detection)
 */
export class AudioServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private port = 0;

  private _onTranscriptionResult = new vscode.EventEmitter<{
    text: string;
    isFinal: boolean;
  }>();
  readonly onTranscriptionResult = this._onTranscriptionResult.event;

  private _onRecordingStopped = new vscode.EventEmitter<void>();
  readonly onRecordingStopped = this._onRecordingStopped.event;

  private _onError = new vscode.EventEmitter<string>();
  readonly onError = this._onError.event;

  private _onWhisperAudioReady = new vscode.EventEmitter<Buffer>();
  readonly onWhisperAudioReady = this._onWhisperAudioReady.event;

  private _onClientConnected = new vscode.EventEmitter<void>();
  readonly onClientConnected = this._onClientConnected.event;

  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Start the local server and return the URL.
   */
  async start(): Promise<string> {
    if (this.server) {
      return `http://127.0.0.1:${this.port}`;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Serve the audio capture page
        if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
          const config = vscode.workspace.getConfiguration('voiceAssistant');
          const engine = config.get<string>('transcriptionEngine', 'webSpeechAPI');
          const language = config.get<string>('language', 'en-US');
          const silenceTimeout = config.get<number>('silenceTimeout', 3);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getAudioPageHTML(this.port, engine, language, silenceTimeout));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      // WebSocket server for real-time communication
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws) => {
        this.outputChannel.appendLine('[Server] Browser connected via WebSocket');
        this.client = ws;
        this._onClientConnected.fire();

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (err) {
            this.outputChannel.appendLine(`[Server] Invalid message: ${data}`);
          }
        });

        ws.on('close', () => {
          this.outputChannel.appendLine('[Server] Browser disconnected');
          this.client = null;
        });
      });

      // Listen on a random available port
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr !== 'string') {
          this.port = addr.port;
          this.outputChannel.appendLine(
            `[Server] Running at http://127.0.0.1:${this.port}`
          );
          resolve(`http://127.0.0.1:${this.port}`);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get the server URL.
   */
  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Send a command to the browser via WebSocket.
   */
  sendCommand(command: string, data?: Record<string, any>): void {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify({ type: command, ...data }));
    } else {
      this.outputChannel.appendLine(
        '[Server] No browser connected. Open the audio page first.'
      );
    }
  }

  /**
   * Check if a browser client is connected.
   */
  isClientConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  /**
   * Handle messages from the browser.
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'transcriptionResult':
        this._onTranscriptionResult.fire({
          text: message.text,
          isFinal: message.isFinal,
        });
        if (message.isFinal) {
          this.outputChannel.appendLine(`[Transcript] ${message.text}`);
        }
        break;

      case 'recordingStopped':
        this._onRecordingStopped.fire();
        break;

      case 'whisperAudioReady':
        const audioBuffer = Buffer.from(message.audioData, 'base64');
        this._onWhisperAudioReady.fire(audioBuffer);
        break;

      case 'silenceDetected':
        this.outputChannel.appendLine('[Info] Silence detected, stopping...');
        this._onRecordingStopped.fire();
        break;

      case 'error':
        this._onError.fire(message.message);
        break;

      case 'info':
        this.outputChannel.appendLine(`[Info] ${message.message}`);
        break;

      case 'ready':
        this.outputChannel.appendLine('[Info] Browser audio page ready');
        break;
    }
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  dispose(): void {
    void this.stop(); // intentionally fire-and-forget; VS Code dispose must be synchronous
    this._onTranscriptionResult.dispose();
    this._onRecordingStopped.dispose();
    this._onError.dispose();
    this._onWhisperAudioReady.dispose();
    this._onClientConnected.dispose();
  }
}
