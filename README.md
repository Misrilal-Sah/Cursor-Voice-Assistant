<div align="center">

<img src="media/icon.png" width="120" height="120" alt="Cursor Voice Assistant Logo" />

# 🎤 Cursor Voice Assistant

**Speak to your IDE. No browser. No API key needed.**

Capture microphone input directly inside VS Code / Cursor using Windows built-in speech recognition — transcribed text lands on your clipboard, ready to paste into Cursor AI chat.

[![Version](https://img.shields.io/badge/version-0.1.0-818cf8?style=flat-square)](https://github.com/Misrilal-Sah/Cursor-Voice-Assistant/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-0ea5e9?style=flat-square)](https://github.com/Misrilal-Sah/Cursor-Voice-Assistant)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-a78bfa?style=flat-square)](https://code.visualstudio.com/)

</div>

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🎙️ | **No-browser recording** | Uses Windows Speech Recognition via `System.Speech` — no Chrome tab needed |
| ⚡ | **Whisper API mode** | Record WAV with Windows MCI → send to OpenAI for high-accuracy transcription |
| 📋 | **Clipboard output** | Transcription copied automatically — paste into any chat with `Ctrl+V` |
| 🤖 | **Auto-open Cursor chat** | Opens AI chat panel after transcription completes |
| ✏️ | **Editor insert mode** | Drop text directly at your cursor position |
| 🔇 | **Silence detection** | Auto-stops after configurable silence (default 3 s) |
| 🧹 | **Prompt cleanup** | Strips filler words (um, uh, like) and normalises punctuation |
| 🗣️ | **Voice commands** | "stop recording", "new line", "period", etc. |
| 🌍 | **Multi-language** | EN, HI, ES, FR, DE, JA, KO, ZH, PT, RU, AR, IT |
| 📜 | **Voice history** | Browse & reuse previous transcriptions |
| 📊 | **Live preview panel** | Watch transcription appear in real-time inside VS Code |

---

## 🚀 Getting Started

### Install from VSIX

```bash
code --install-extension cursor-voice-assistant-0.1.0.vsix
```

### Install from Marketplace

1. Open the Extensions view — `Ctrl+Shift+X`
2. Search **Cursor Voice Assistant**
3. Click **Install**

### Quick Start

```
1.  Press  Ctrl+Shift+H          →  Recording starts
2.  Speak your prompt             →  See it live in the panel
3.  Stop speaking (or say "stop recording")
4.  Transcription is on clipboard →  Ctrl+L → Ctrl+V → Enter
```

---

## ⚙️ Configuration

Open **Settings** → search `Voice Assistant`.

| Setting | Default | Description |
|---|---|---|
| `transcriptionEngine` | `webSpeechAPI` | `webSpeechAPI` (Windows Speech) or `whisperAPI` (OpenAI) |
| `whisperApiKey` | *(empty)* | OpenAI API key — only needed for Whisper mode |
| `language` | `en-US` | Recognition language |
| `outputMode` | `clipboard` | `clipboard` · `editor` · `both` |
| `autoOpenChat` | `true` | Auto-open Cursor AI chat after transcription |
| `silenceTimeout` | `3` | Seconds of silence before auto-stop (1–30) |
| `enablePromptCleanup` | `true` | Remove filler words |
| `enableVoiceCommands` | `true` | Enable inline voice commands |
| `showRealtimePreview` | `true` | Live transcription in the panel |

### Using Whisper API (Higher Accuracy)

```
Settings → Voice Assistant → Transcription Engine → whisperAPI
Settings → Voice Assistant → Whisper API Key → <your OpenAI key>
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+H` / `Cmd+Shift+H` | Toggle recording on / off |

---

## 🗣️ Voice Commands

| Say | Result |
|---|---|
| `"stop recording"` | Stops the current session |
| `"new line"` | Inserts a line break (`\n`) |
| `"period"` | Inserts `.` |
| `"comma"` | Inserts `,` |
| `"question mark"` | Inserts `?` |
| `"exclamation mark"` | Inserts `!` |
| `"clear all"` | Clears the current transcription |

---

## 🛠️ Development

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows** (native audio uses Windows MCI / System.Speech)
- VS Code or Cursor IDE

### Setup

```bash
git clone https://github.com/Misrilal-Sah/Cursor-Voice-Assistant.git
cd Cursor-Voice-Assistant
npm install
```

### Build & Watch

```bash
# One-time production build
npm run build

# Watch mode — auto-rebuilds on every save
npm run watch
```

### Run in Extension Development Host

1. Open the folder in VS Code
2. Press **`F5`** — a new VS Code window opens with the extension loaded
3. The **Output** panel → `Voice Assistant` channel shows live logs

---

## 🧪 Testing

### How to run tests

```bash
# Lint only (no test runner yet — see below)
npm run lint
```

> Unit tests are not scaffolded yet. The sections below describe **manual QA** that should pass before any release.

---

### What to test — Manual QA Checklist

#### 1. Basic recording — `webSpeechAPI` mode

| # | Step | Expected |
|---|---|---|
| 1 | Press `Ctrl+Shift+H` | • Status bar shows **🎤 Recording…** • Panel opens with "Listening for speech…" |
| 2 | Say "hello world" | • Live preview shows the text • Status badge pulsing red |
| 3 | Wait 3 s (silence) | • Recording stops automatically • Status bar → Processing → Idle |
| 4 | Check clipboard | • `hello world` (or cleaned version) in clipboard |
| 5 | Press `Ctrl+Shift+H` again while recording | • Recording stops immediately |

#### 2. Whisper API mode

| # | Step | Expected |
|---|---|---|
| 1 | Set engine to `whisperAPI`, add valid API key | — |
| 2 | Press `Ctrl+Shift+H`, speak 5 s, say "stop recording" | • Panel shows "Recording audio — click Stop when done…" |
| 3 | After stop | • Panel shows "Transcribing with Whisper API…" |
| 4 | Result | • High-accuracy transcription on clipboard |
| 5 | Invalid API key | • Error message shown — no crash |

#### 3. Prompt cleanup

| # | Step | Expected |
|---|---|---|
| 1 | Speak "um so basically like fix this bug" | Raw text preserved in review panel |
| 2 | Click **🧹 Clean Prompt** | Cleaned: "Fix this bug." |
| 3 | Click **✅ Use Cleaned** | Cleaned text sent to clipboard |

#### 4. Voice commands

| Command | Expected |
|---|---|
| "stop recording" | Recording stops |
| "new line" | Output contains `\n` |
| "period" | Output ends with `.` |
| "question mark" | Output ends with `?` |

#### 5. Output modes

| Mode | Expected |
|---|---|
| `clipboard` | Text in clipboard; notification shown |
| `editor` | Text inserted at cursor in active editor |
| `both` | Both of the above |

#### 6. Voice history

| Step | Expected |
|---|---|
| Run 3 transcriptions | — |
| Command palette → "Voice Assistant: Show Voice History" | QuickPick shows 3 entries, newest first |
| Select entry | Re-copied to clipboard; confirmation toast shown |

#### 7. Edge cases

| Scenario | Expected |
|---|---|
| No speech at all — silence only | "No speech detected" warning; no crash |
| `Ctrl+Shift+H` rapid double-press | Only one recording session starts |
| Whisper mode with no internet | Helpful error message — no crash |
| Panel closed mid-recording | Recording continues; output still works on completion |

---

## 📁 Project Structure

```
src/
├── extension.ts          # Activation, command registration, wiring
├── statusBar.ts          # Status bar item (idle / recording / processing)
├── outputHandler.ts      # Clipboard, editor insert, chat open
├── voiceHistory.ts       # globalState-backed history with QuickPick
├── promptCleanup.ts      # Filler-word removal, punctuation normalisation
├── voiceCommands.ts      # Voice command detection & execution
├── audioPage.ts          # HTML for the optional browser audio page
├── audioServer.ts        # localhost HTTP + WebSocket server (legacy browser path)
└── engines/
    ├── engineTypes.ts         # Interfaces and enums
    ├── windowsSpeechEngine.ts # Windows System.Speech via PowerShell
    ├── nativeAudioRecorder.ts # Windows MCI audio recorder for Whisper mode
    └── whisperEngine.ts       # OpenAI Whisper API client
media/
└── icon.png              # Extension icon
```

---

## 🔒 Privacy

| Engine | Where audio goes |
|---|---|
| `webSpeechAPI` | Processed locally by Windows Speech Recognition — stays on your machine |
| `whisperAPI` | Sent to OpenAI's API. Your key is stored in VS Code's local settings only |

No audio or transcription data is ever stored or transmitted by this extension itself.

---

## 🤝 Contributing

```bash
# Fork → clone → branch
git checkout -b feature/your-feature

# Make changes, then
npm run build
# Test with F5 in VS Code

git commit -m "feat: your feature"
git push origin feature/your-feature
# Open a Pull Request on GitHub
```

---

## 📄 License

[MIT](LICENSE) © [Misrilal Sah](https://misril.dev/)


