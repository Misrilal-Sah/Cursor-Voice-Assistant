import * as vscode from 'vscode';
import * as fs from 'fs';
import { StatusBarManager } from './statusBar';
import { WindowsSpeechEngine } from './engines/windowsSpeechEngine';
import { NativeAudioRecorder } from './engines/nativeAudioRecorder';
import { WhisperEngine } from './engines/whisperEngine';
import { OutputHandler } from './outputHandler';
import { VoiceHistory } from './voiceHistory';
import { cleanupPrompt } from './promptCleanup';
import { detectVoiceCommand, executeVoiceCommand } from './voiceCommands';

let statusBar: StatusBarManager;
let outputHandler: OutputHandler;
let voiceHistory: VoiceHistory;
let outputChannel: vscode.OutputChannel;

// Native recording engines — no browser required
let speechEngine: WindowsSpeechEngine;
let nativeRecorder: NativeAudioRecorder;
let whisperEngine: WhisperEngine;

let isRecording = false;
let currentEngineType = 'webSpeechAPI';
let webviewPanel: vscode.WebviewPanel | undefined;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Voice Assistant');

  // Initialize components
  statusBar = new StatusBarManager();
  outputHandler = new OutputHandler();
  voiceHistory = new VoiceHistory(context);
  whisperEngine = new WhisperEngine();
  speechEngine = new WindowsSpeechEngine(outputChannel);
  nativeRecorder = new NativeAudioRecorder(outputChannel);

  // ─── WindowsSpeechEngine events (webSpeechAPI mode) ──────────────────────
  speechEngine.onTranscriptionResult(async ({ text, isFinal }) => {
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'transcriptionUpdate', text, isFinal });
    }
    if (isFinal) {
      isRecording = false;
      statusBar.setState('processing');
      await handleFinalTranscription(text);
    }
  });

  speechEngine.onRecordingStopped(() => {
    if (isRecording) {
      isRecording = false;
      statusBar.setState('idle');
    }
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'recordingStopped' });
    }
  });

  speechEngine.onError((message) => {
    outputChannel.appendLine(`[Error] WindowsSpeech: ${message}`);
    vscode.window.showErrorMessage(`Voice Assistant: ${message}`);
    isRecording = false;
    statusBar.setState('idle');
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'error', message });
    }
  });

  speechEngine.onStatusUpdate((status) => {
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'statusUpdate', status });
    }
  });

  // ─── NativeAudioRecorder events (whisperAPI mode) ────────────────────────
  nativeRecorder.onRecordingStarted(() => {
    outputChannel.appendLine('[Info] Native recording started');
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'statusUpdate', status: 'Recording audio...' });
    }
  });

  nativeRecorder.onRecordingStopped(async (filePath) => {
    statusBar.setState('processing');
    if (webviewPanel) {
      webviewPanel.webview.postMessage({
        type: 'statusUpdate',
        status: 'Transcribing with Whisper API...',
      });
    }
    try {
      const audioBuffer = fs.readFileSync(filePath);
      const config = vscode.workspace.getConfiguration('voiceAssistant');
      const language = config.get<string>('language', 'en-US');
      const text = await whisperEngine.transcribe(audioBuffer, language);
      nativeRecorder.cleanup();
      if (text && text.trim()) {
        if (webviewPanel) {
          webviewPanel.webview.postMessage({ type: 'transcriptionUpdate', text, isFinal: true });
        }
        await handleFinalTranscription(text);
      } else {
        vscode.window.showWarningMessage('No speech detected in the recording.');
        isRecording = false;
        statusBar.setState('idle');
      }
    } catch (err: any) {
      nativeRecorder.cleanup();
      vscode.window.showErrorMessage(`Whisper API Error: ${err.message}`);
      outputChannel.appendLine(`[Error] Whisper: ${err.message}`);
      isRecording = false;
      statusBar.setState('idle');
    }
  });

  nativeRecorder.onError((message) => {
    outputChannel.appendLine(`[Error] NativeRecorder: ${message}`);
    vscode.window.showErrorMessage(`Voice Assistant: ${message}`);
    isRecording = false;
    statusBar.setState('idle');
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'error', message });
    }
  });

  nativeRecorder.onStatusUpdate((status) => {
    if (webviewPanel) {
      webviewPanel.webview.postMessage({ type: 'statusUpdate', status });
    }
  });

  // ─── Handle final transcription result ──────────────────────────
  async function handleFinalTranscription(text: string) {
    let processedText = text;

    const config = vscode.workspace.getConfiguration('voiceAssistant');

    // Voice commands
    if (config.get<boolean>('enableVoiceCommands', true)) {
      const commandMatch = detectVoiceCommand(processedText);
      if (commandMatch) {
        const result = await executeVoiceCommand(commandMatch);
        if (result === null) {
          statusBar.setState('idle');
          return;
        }
        processedText = result;
      }
    }

    if (!processedText || processedText.trim().length === 0) {
      statusBar.setState('idle');
      return;
    }

    // Show review prompt in webview with option for built-in cleanup
    if (webviewPanel) {
      webviewPanel.webview.postMessage({
        type: 'showReviewPrompt',
        rawText: processedText,
      });
      // Wait for user's choice (handled in webview message handler)
      return;
    }

    // If no webview, just send directly
    await sendFinalOutput(processedText);
  }

  /**
   * Send the final processed text to the output destination.
   */
  async function sendFinalOutput(text: string) {
    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const engine = config.get<string>('transcriptionEngine', 'webSpeechAPI');
    const language = config.get<string>('language', 'en-US');

    voiceHistory.addEntry(text, engine, language);
    await outputHandler.sendOutput(text);

    statusBar.setState('idle');
    outputChannel.appendLine(`[Output] ${text}`);
  }

  // ─── Show WebView panel (status display only) ──────────────────
  function showVoicePanel() {
    if (webviewPanel) {
      webviewPanel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }

    webviewPanel = vscode.window.createWebviewPanel(
      'voiceAssistant',
      '🎤 Voice Assistant',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    webviewPanel.webview.html = getWebviewHTML();

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'useRaw':
            // User chose to use raw transcription
            await sendFinalOutput(message.text);
            break;

          case 'cleanPrompt':
            // User wants built-in cleanup (filler removal, punctuation fix)
            const cleaned = cleanupPrompt(message.text);
            // Show the cleaned version for comparison
            webviewPanel?.webview.postMessage({
              type: 'showCleanedResult',
              rawText: message.text,
              cleanedText: cleaned,
            });
            break;

          case 'useCleaned':
            // User approved the cleaned version
            await sendFinalOutput(message.text);
            break;

          case 'stopRecording':
            stopRecordingFlow();
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    webviewPanel.onDidDispose(() => {
      webviewPanel = undefined;
    });
  }

  // ─── Recording flow ─────────────────────────────────────────────
  async function startRecordingFlow() {
    if (isRecording) {
      return;
    }

    // Always show the webview panel (status display)
    showVoicePanel();

    const config = vscode.workspace.getConfiguration('voiceAssistant');
    const engine = config.get<string>('transcriptionEngine', 'webSpeechAPI');
    const language = config.get<string>('language', 'en-US');

    currentEngineType = engine;
    isRecording = true;
    statusBar.setState('recording');

    // Notify webview — pass engine so UI text is correct
    webviewPanel?.webview.postMessage({ type: 'recordingStarted', engine });

    try {
      if (engine === 'whisperAPI') {
        outputChannel.appendLine('[Command] Starting native audio recording for Whisper...');
        nativeRecorder.start();
      } else {
        // webSpeechAPI → Windows Speech Recognition (no browser needed)
        outputChannel.appendLine('[Command] Starting Windows Speech Recognition...');
        speechEngine.start(language);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Voice Assistant: ${err.message}`);
      outputChannel.appendLine(`[Error] ${err.message}`);
      isRecording = false;
      statusBar.setState('idle');
    }
  }

  function stopRecordingFlow() {
    if (!isRecording) {
      return;
    }

    isRecording = false;
    statusBar.setState('processing');
    outputChannel.appendLine('[Command] Recording stopped');

    if (currentEngineType === 'whisperAPI') {
      nativeRecorder.stop();
    } else {
      speechEngine.stop();
    }
  }

  // ─── Register commands ──────────────────────────────────────────
  const toggleCmd = vscode.commands.registerCommand(
    'voiceAssistant.toggleRecording',
    () => {
      if (isRecording) {
        stopRecordingFlow();
      } else {
        startRecordingFlow();
      }
    }
  );

  const startCmd = vscode.commands.registerCommand(
    'voiceAssistant.startRecording',
    () => startRecordingFlow()
  );

  const stopCmd = vscode.commands.registerCommand(
    'voiceAssistant.stopRecording',
    () => stopRecordingFlow()
  );

  const historyCmd = vscode.commands.registerCommand(
    'voiceAssistant.showHistory',
    () => voiceHistory.showHistoryPicker()
  );

  context.subscriptions.push(
    toggleCmd,
    startCmd,
    stopCmd,
    historyCmd,
    statusBar,
    speechEngine,
    nativeRecorder,
    outputChannel
  );

  outputChannel.appendLine('Voice Assistant activated! (Browser-based audio capture)');
}

/**
 * Generate WebView HTML — pure status display with review UI.
 * NO microphone access needed. All audio handled by the browser page.
 */
function getWebviewHTML(): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', var(--vscode-font-family, 'Segoe UI', sans-serif);
      background: var(--vscode-editor-background, #0f0f13);
      color: var(--vscode-editor-foreground, #e4e4e7);
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-widget-border, #27272a);
    }

    .header h2 {
      font-size: 15px;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .status-idle {
      background: rgba(63,63,70,0.5);
      color: #a1a1aa;
    }

    .status-recording {
      background: rgba(239,68,68,0.2);
      color: #ef4444;
      border: 1px solid rgba(239,68,68,0.3);
      animation: pulse 1.5s infinite;
    }

    .status-processing {
      background: rgba(234,179,8,0.2);
      color: #eab308;
      border: 1px solid rgba(234,179,8,0.3);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .recording-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      animation: pulse 1s infinite;
    }

    .preview-box {
      flex: 1;
      background: var(--vscode-input-background, rgba(15,15,19,0.7));
      border: 1px solid var(--vscode-input-border, #27272a);
      border-radius: 10px;
      padding: 14px;
      font-size: 13px;
      line-height: 1.7;
      overflow-y: auto;
      min-height: 100px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .preview-box .interim {
      color: var(--vscode-descriptionForeground, #71717a);
      font-style: italic;
    }

    .preview-box .final {
      color: var(--vscode-editor-foreground, #e4e4e7);
    }

    .placeholder {
      color: #3f3f46;
      font-style: italic;
      text-align: center;
      padding-top: 30px;
      font-size: 12px;
    }

    .status-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #71717a);
      text-align: center;
    }

    .controls {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 8px 18px;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .btn-stop {
      background: #ef4444;
      color: #fff;
    }
    .btn-stop:hover { background: #dc2626; transform: translateY(-1px); }

    .btn-primary {
      background: linear-gradient(135deg, #818cf8, #6366f1);
      color: #fff;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }

    .btn-secondary {
      background: #27272a;
      color: #a1a1aa;
      border: 1px solid #3f3f46;
    }
    .btn-secondary:hover { background: #3f3f46; color: #e4e4e7; }

    .hidden { display: none !important; }

    .review-section {
      background: rgba(129,140,248,0.08);
      border: 1px solid rgba(129,140,248,0.2);
      border-radius: 10px;
      padding: 14px;
    }

    .review-section h4 {
      font-size: 12px;
      font-weight: 600;
      color: #818cf8;
      margin-bottom: 8px;
    }

    .review-section .label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #71717a;
      margin-bottom: 4px;
      margin-top: 10px;
    }

    .review-text {
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      padding: 10px;
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .comparison {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .comparison .raw {
      color: #71717a;
      text-decoration: line-through;
    }

    .comparison .cleaned {
      color: #22c55e;
    }

    .engine-info {
      font-size: 10px;
      color: #3f3f46;
      text-align: center;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>🎤 Voice Assistant</h2>
    <span id="statusBadge" class="status-badge status-idle">Ready</span>
  </div>

  <div id="statusText" class="status-text">Press Ctrl+Shift+H to start recording</div>

  <!-- Preview during recording -->
  <div id="previewBox" class="preview-box">
    <span class="placeholder">Your transcription will appear here...</span>
  </div>

  <!-- Review section after recording -->
  <div id="reviewSection" class="review-section hidden">
    <h4>📝 Review Transcription</h4>
    <div id="reviewContent"></div>
    <div id="reviewControls" class="controls" style="margin-top: 12px;"></div>
  </div>

  <!-- Recording controls -->
  <div id="recordingControls" class="controls hidden">
    <button class="btn btn-stop" onclick="stopRecording()">⏹ Stop Recording</button>
  </div>

  <div class="engine-info" id="engineInfo">
    Native Audio &bull; No browser required
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const previewBox = document.getElementById('previewBox');
    const reviewSection = document.getElementById('reviewSection');
    const reviewContent = document.getElementById('reviewContent');
    const reviewControls = document.getElementById('reviewControls');
    const recordingControls = document.getElementById('recordingControls');

    let currentRawText = '';

    window.addEventListener('message', (event) => {
      const msg = event.data;

      switch (msg.type) {
        case 'recordingStarted':
          statusBadge.className = 'status-badge status-recording';
          statusBadge.innerHTML = '<span class="recording-dot"></span> Recording';
          statusText.textContent = msg.engine === 'whisperAPI'
            ? 'Recording audio \u2014 click Stop when done...'
            : 'Listening for speech...';
          previewBox.innerHTML = '<span class="interim">Listening...</span>';
          previewBox.classList.remove('hidden');
          reviewSection.classList.add('hidden');
          recordingControls.classList.remove('hidden');
          break;

        case 'transcriptionUpdate':
          if (msg.isFinal) {
            previewBox.innerHTML = '<span class="final">' + escapeHtml(msg.text) + '</span>';
          } else {
            previewBox.innerHTML = '<span class="interim">' + escapeHtml(msg.text) + '</span>';
          }
          statusText.textContent = msg.isFinal ? 'Transcription complete' : 'Listening...';
          break;

        case 'recordingStopped':
          statusBadge.className = 'status-badge status-idle';
          statusBadge.textContent = 'Ready';
          statusText.textContent = 'Recording stopped';
          recordingControls.classList.add('hidden');
          break;

        case 'statusUpdate':
          statusText.textContent = msg.status;
          break;

        case 'showReviewPrompt':
          currentRawText = msg.rawText;
          statusBadge.className = 'status-badge status-processing';
          statusBadge.textContent = 'Review';
          statusText.textContent = 'Review your transcription';
          recordingControls.classList.add('hidden');
          previewBox.classList.add('hidden');
          reviewSection.classList.remove('hidden');

          let reviewHTML = '<div class="review-text">' + escapeHtml(msg.rawText) + '</div>';
          reviewContent.innerHTML = reviewHTML;

          let buttonsHTML = '<button class="btn btn-primary" onclick="useRaw()">✅ Use This</button>';
          buttonsHTML += '<button class="btn btn-secondary" onclick="cleanPrompt()">🧹 Clean Prompt</button>';
          reviewControls.innerHTML = buttonsHTML;
          break;

        case 'showCleanedResult':
          statusBadge.className = 'status-badge status-processing';
          statusBadge.textContent = 'Review';
          statusText.textContent = 'Compare raw vs cleaned prompt';

          reviewContent.innerHTML =
            '<div class="comparison">' +
              '<div class="label">Original</div>' +
              '<div class="review-text raw">' + escapeHtml(msg.rawText) + '</div>' +
              '<div class="label">✨ Cleaned</div>' +
              '<div class="review-text cleaned">' + escapeHtml(msg.cleanedText) + '</div>' +
            '</div>';

          currentRawText = msg.rawText;
          reviewControls.innerHTML =
            '<button class="btn btn-primary" onclick="useCleaned()">' +
              '✅ Use Cleaned</button>' +
            '<button class="btn btn-secondary" onclick="useRaw()">' +
              '📝 Use Original</button>';
          break;

        case 'error':
          statusBadge.className = 'status-badge status-idle';
          statusBadge.textContent = 'Error';
          statusText.textContent = msg.message;
          recordingControls.classList.add('hidden');
          break;
      }
    });

    function stopRecording() {
      vscode.postMessage({ type: 'stopRecording' });
    }

    function useRaw() {
      vscode.postMessage({ type: 'useRaw', text: currentRawText });
      resetUI();
    }

    function cleanPrompt() {
      vscode.postMessage({ type: 'cleanPrompt', text: currentRawText });
      statusText.textContent = 'Cleaning prompt...';
    }

    function useCleaned() {
      const cleanedEl = document.querySelector('.cleaned');
      const text = cleanedEl ? cleanedEl.textContent : currentRawText;
      vscode.postMessage({ type: 'useCleaned', text });
      resetUI();
    }

    function resetUI() {
      statusBadge.className = 'status-badge status-idle';
      statusBadge.textContent = 'Ready';
      statusText.textContent = 'Press Ctrl+Shift+H to start recording';
      previewBox.innerHTML = '<span class="placeholder">Your transcription will appear here...</span>';
      previewBox.classList.remove('hidden');
      reviewSection.classList.add('hidden');
      recordingControls.classList.add('hidden');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
}

export function deactivate() {
  // Cleanup is handled by disposables
}
