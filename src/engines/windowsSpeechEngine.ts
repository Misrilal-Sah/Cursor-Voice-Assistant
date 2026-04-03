import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';

/**
 * Windows Speech Recognition Engine.
 * Uses PowerShell + .NET System.Speech.Recognition for free, built-in speech-to-text.
 * No external tools or API keys required — uses Windows' built-in speech engine.
 */
export class WindowsSpeechEngine {
  private process: ChildProcess | null = null;
  private isActive = false;

  private _onTranscriptionResult = new vscode.EventEmitter<{
    text: string;
    isFinal: boolean;
  }>();
  readonly onTranscriptionResult = this._onTranscriptionResult.event;

  private _onRecordingStopped = new vscode.EventEmitter<void>();
  readonly onRecordingStopped = this._onRecordingStopped.event;

  private _onError = new vscode.EventEmitter<string>();
  readonly onError = this._onError.event;

  private _onStatusUpdate = new vscode.EventEmitter<string>();
  readonly onStatusUpdate = this._onStatusUpdate.event;

  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Start speech recognition via PowerShell.
   * Streams recognized text back through events.
   */
  start(language: string): void {
    if (this.isActive) {
      return;
    }

    const psScript = this.buildPowerShellScript(language);

    this.outputChannel.appendLine('[WindowsSpeech] Starting recognition...');
    this._onStatusUpdate.fire('Initializing microphone...');

    // Use full path to avoid ENOENT in restricted Cursor/VS Code environments
    const psPath = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;

    this.process = spawn(psPath, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psScript,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });

    this.isActive = true;

    let accumulatedText = '';

    // Handle stdout — recognized text arrives here
    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString('utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('READY:')) {
          this._onStatusUpdate.fire('Listening...');
          this.outputChannel.appendLine('[WindowsSpeech] Ready, listening...');
        } else if (trimmed.startsWith('RECOGNIZED:')) {
          const text = trimmed.substring('RECOGNIZED:'.length).trim();
          if (text) {
            accumulatedText += (accumulatedText ? ' ' : '') + text;
            this._onTranscriptionResult.fire({ text: accumulatedText, isFinal: false });
            this.outputChannel.appendLine(`[WindowsSpeech] Recognized: ${text}`);
          }
        } else if (trimmed.startsWith('FINAL:')) {
          const text = trimmed.substring('FINAL:'.length).trim();
          if (text) {
            accumulatedText = text;
          }
          if (accumulatedText) {
            this._onTranscriptionResult.fire({ text: accumulatedText, isFinal: true });
          }
          this.outputChannel.appendLine(`[WindowsSpeech] Final: ${accumulatedText}`);
        } else if (trimmed.startsWith('ERROR:')) {
          const errorMsg = trimmed.substring('ERROR:'.length).trim();
          this._onError.fire(errorMsg);
          this.outputChannel.appendLine(`[WindowsSpeech] Error: ${errorMsg}`);
        } else if (trimmed.startsWith('SILENCE:')) {
          this.outputChannel.appendLine('[WindowsSpeech] Silence detected');
        }
      }
    });

    // Handle stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString('utf-8').trim();
      if (msg) {
        this.outputChannel.appendLine(`[WindowsSpeech] stderr: ${msg}`);
      }
    });

    // Handle process exit
    this.process.on('close', (code) => {
      this.outputChannel.appendLine(`[WindowsSpeech] Process exited with code ${code}`);
      this.isActive = false;

      // If there's accumulated text, fire it as final
      if (accumulatedText) {
        this._onTranscriptionResult.fire({ text: accumulatedText, isFinal: true });
      }

      this._onRecordingStopped.fire();
    });

    this.process.on('error', (err) => {
      this._onError.fire(`Failed to start speech recognition: ${err.message}`);
      this.isActive = false;
      this._onRecordingStopped.fire();
    });
  }

  /**
   * Stop the speech recognition process.
   */
  stop(): void {
    if (!this.process || !this.isActive) {
      return;
    }

    this.outputChannel.appendLine('[WindowsSpeech] Stopping recognition...');

    // Send STOP signal via stdin
    try {
      this.process.stdin?.write('STOP\n');
    } catch {
      // Ignore write errors
    }

    // Force kill after timeout — recognize loop can block up to 5 s per cycle,
    // so give it enough time to emit FINAL before killing.
    setTimeout(() => {
      if (this.process && this.isActive) {
        this.process.kill('SIGTERM');
        this.isActive = false;
      }
    }, 7000);
  }

  /**
   * Check if currently recording.
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Build the PowerShell script for speech recognition.
   * Uses .NET System.Speech.Recognition with DictationGrammar for free-form speech.
   */
  private buildPowerShellScript(language: string): string {
    // Map BCP-47 language codes to .NET CultureInfo codes
    const cultureMap: Record<string, string> = {
      'en-US': 'en-US',
      'en-GB': 'en-GB',
      'en-IN': 'en-IN',
      'hi-IN': 'hi-IN',
      'es-ES': 'es-ES',
      'fr-FR': 'fr-FR',
      'de-DE': 'de-DE',
      'ja-JP': 'ja-JP',
      'ko-KR': 'ko-KR',
      'zh-CN': 'zh-CN',
      'pt-BR': 'pt-BR',
      'ru-RU': 'ru-RU',
      'it-IT': 'it-IT',
    };

    const culture = cultureMap[language] || 'en-US';

    return `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech

try {
    $culture = New-Object System.Globalization.CultureInfo('${culture}')
    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
    $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $recognizer.SetInputToDefaultAudioDevice()
    $recognizer.InitialSilenceTimeout = [System.TimeSpan]::FromSeconds(30)
    $recognizer.BabbleTimeout = [System.TimeSpan]::FromSeconds(0)
    $recognizer.EndSilenceTimeout = [System.TimeSpan]::FromSeconds(1.5)
    $recognizer.EndSilenceTimeoutAmbiguous = [System.TimeSpan]::FromSeconds(2)

    Write-Output "READY:Listening"

    $allText = ""
    $running = $true
    $silenceCount = 0

    while ($running) {
        # Check for STOP signal on stdin
        if ([Console]::In.Peek() -ge 0) {
            $input = [Console]::In.ReadLine()
            if ($input -eq "STOP") {
                $running = $false
                break
            }
        }

        $result = $recognizer.Recognize([System.TimeSpan]::FromSeconds(5))

        if ($result -ne $null -and $result.Text -ne $null -and $result.Text.Trim() -ne "") {
            $silenceCount = 0
            if ($allText -ne "") {
                $allText = $allText + " " + $result.Text
            } else {
                $allText = $result.Text
            }
            Write-Output ("RECOGNIZED:" + $result.Text)
        } else {
            $silenceCount++
            Write-Output "SILENCE:$silenceCount"
        }
    }

    if ($allText -ne "") {
        Write-Output ("FINAL:" + $allText)
    }

    $recognizer.Dispose()
} catch {
    Write-Output ("ERROR:" + $_.Exception.Message)
}
`.trim();
  }

  dispose(): void {
    this.stop();
    this._onTranscriptionResult.dispose();
    this._onRecordingStopped.dispose();
    this._onError.dispose();
    this._onStatusUpdate.dispose();
  }
}
