import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

/**
 * Records microphone audio to a WAV file using PowerShell + .NET APIs.
 * No external tools required — uses Windows built-in multimedia APIs.
 * Used when Whisper API engine is selected (records audio → sends to Whisper).
 */
export class NativeAudioRecorder {
  private process: ChildProcess | null = null;
  private isActive = false;
  private tempFilePath: string = '';

  private _onRecordingStarted = new vscode.EventEmitter<void>();
  readonly onRecordingStarted = this._onRecordingStarted.event;

  private _onRecordingStopped = new vscode.EventEmitter<string>();
  readonly onRecordingStopped = this._onRecordingStopped.event;

  private _onError = new vscode.EventEmitter<string>();
  readonly onError = this._onError.event;

  private _onStatusUpdate = new vscode.EventEmitter<string>();
  readonly onStatusUpdate = this._onStatusUpdate.event;

  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Start recording audio to a temp WAV file.
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    // Create a temp file for the recording
    this.tempFilePath = path.join(os.tmpdir(), `voice_assistant_${Date.now()}.wav`);

    const psScript = this.buildRecordingScript(this.tempFilePath);

    this.outputChannel.appendLine(`[AudioRecorder] Starting recording to ${this.tempFilePath}`);
    this._onStatusUpdate.fire('Recording...');

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

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString('utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('RECORDING:')) {
          this._onRecordingStarted.fire();
          this._onStatusUpdate.fire('Recording... Speak now');
          this.outputChannel.appendLine('[AudioRecorder] Recording started');
        } else if (trimmed.startsWith('SAVED:')) {
          this.outputChannel.appendLine(`[AudioRecorder] Audio saved to ${this.tempFilePath}`);
        } else if (trimmed.startsWith('ERROR:')) {
          const errorMsg = trimmed.substring('ERROR:'.length).trim();
          this._onError.fire(errorMsg);
          this.outputChannel.appendLine(`[AudioRecorder] Error: ${errorMsg}`);
        }
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString('utf-8').trim();
      if (msg) {
        this.outputChannel.appendLine(`[AudioRecorder] stderr: ${msg}`);
      }
    });

    this.process.on('close', () => {
      this.isActive = false;
      // Check if the file was created and has data
      if (fs.existsSync(this.tempFilePath)) {
        const stats = fs.statSync(this.tempFilePath);
        if (stats.size > 44) { // WAV header is 44 bytes
          this._onRecordingStopped.fire(this.tempFilePath);
        } else {
          this._onError.fire('No audio was captured');
        }
      } else {
        this._onError.fire('Recording file was not created');
      }
    });

    this.process.on('error', (err) => {
      this._onError.fire(`Failed to start recording: ${err.message}`);
      this.isActive = false;
    });
  }

  /**
   * Stop recording and return the path to the WAV file.
   */
  stop(): void {
    if (!this.process || !this.isActive) {
      return;
    }

    this.outputChannel.appendLine('[AudioRecorder] Stopping recording...');
    this._onStatusUpdate.fire('Processing audio...');

    // Send STOP signal
    try {
      this.process.stdin?.write('STOP\n');
    } catch {
      // Ignore
    }

    // Force kill after timeout
    setTimeout(() => {
      if (this.process && this.isActive) {
        this.process.kill('SIGTERM');
        this.isActive = false;
      }
    }, 3000);
  }

  /**
   * Read the recorded audio file as a Buffer.
   */
  getAudioBuffer(): Buffer | null {
    if (this.tempFilePath && fs.existsSync(this.tempFilePath)) {
      return fs.readFileSync(this.tempFilePath);
    }
    return null;
  }

  /**
   * Clean up the temp file.
   */
  cleanup(): void {
    if (this.tempFilePath && fs.existsSync(this.tempFilePath)) {
      try {
        fs.unlinkSync(this.tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Build a PowerShell script to record audio using Windows MCI API.
   * Uses winmm.dll's mciSendString for zero-dependency audio recording.
   */
  private buildRecordingScript(outputPath: string): string {
    const escapedPath = outputPath.replace(/\\/g, '\\\\');

    return `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$code = @"
using System;
using System.Runtime.InteropServices;

public class AudioCapture {
    [DllImport("winmm.dll", CharSet = CharSet.Auto)]
    public static extern int mciSendString(string command, System.Text.StringBuilder returnString, int returnSize, IntPtr hwndCallback);

    public static bool StartRecording() {
        var ret = new System.Text.StringBuilder(256);
        int err;
        err = mciSendString("open new type waveaudio alias VoiceRec", ret, 256, IntPtr.Zero);
        if (err != 0) return false;
        err = mciSendString("set VoiceRec channels 1 samplespersec 16000 bitspersample 16", ret, 256, IntPtr.Zero);
        err = mciSendString("record VoiceRec", ret, 256, IntPtr.Zero);
        return err == 0;
    }

    public static bool StopAndSave(string filePath) {
        var ret = new System.Text.StringBuilder(256);
        mciSendString("stop VoiceRec", ret, 256, IntPtr.Zero);
        int err = mciSendString("save VoiceRec " + filePath, ret, 256, IntPtr.Zero);
        mciSendString("close VoiceRec", ret, 256, IntPtr.Zero);
        return err == 0;
    }
}
"@

Add-Type $code

try {
    $started = [AudioCapture]::StartRecording()
    if (-not $started) {
        Write-Output "ERROR:Failed to open microphone"
        exit 1
    }

    Write-Output "RECORDING:Started"

    # Wait for STOP signal on stdin
    while ($true) {
        if ([Console]::In.Peek() -ge 0) {
            $input = [Console]::In.ReadLine()
            if ($input -eq "STOP") {
                break
            }
        }
        Start-Sleep -Milliseconds 100
    }

    $saved = [AudioCapture]::StopAndSave("${escapedPath}")
    if ($saved) {
        Write-Output "SAVED:${escapedPath}"
    } else {
        Write-Output "ERROR:Failed to save recording"
    }
} catch {
    Write-Output ("ERROR:" + $_.Exception.Message)
}
`.trim();
  }

  dispose(): void {
    this.stop();
    this.cleanup();
    this._onRecordingStarted.dispose();
    this._onRecordingStopped.dispose();
    this._onError.dispose();
    this._onStatusUpdate.dispose();
  }
}
