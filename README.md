<div align="center">

<!-- Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=200&section=header&text=Cursor%20Voice%20Assistant&fontSize=42&fontColor=ffffff&fontAlignY=38&desc=Speak%20to%20your%20IDE.%20No%20browser.%20No%20hassle.&descSize=16&descAlignY=58&animation=fadeIn" width="100%" />

<br/>

<img src="media/icon.png" width="100" height="100" alt="Cursor Voice Assistant" />

<br/><br/>

[![Platform](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Misrilal-Sah/Cursor-Voice-Assistant)
[![License](https://img.shields.io/badge/MIT-22c55e?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code%201.85+-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)


<br/>

> **Speak prompts directly inside VS Code or Cursor — no browser tab, no mic permission pop-ups, no API key required for the default engine.**

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎙️ Native Recording
Uses **Windows Speech Recognition** via `System.Speech` — no Chrome, no browser tab, no firewall rules.

### ⚡ Whisper Mode
Record local WAV with **Windows MCI** → send to OpenAI Whisper for maximum accuracy.

### 🤖 AI Prompt Cleanup
Say “clean prompt” and let **Groq** (llama3-8b, ultra-fast, generous free tier) polish your transcription before it hits the clipboard.

</td>
<td width="50%">

### 📋 One-Key Workflow
Transcription lands on your clipboard automatically — `Ctrl+L` → `Ctrl+V` → Enter.

### 🔇 Silence Detection
Auto-stops after configurable silence (default 3 s). No manual stop needed.

### 📊 Live Preview Panel
Watch transcription update in real-time inside VS Code — no switching windows.

</td>
</tr>
</table>

| | Feature | Description |
|---|---|---|
| 🧹 | **Prompt Cleanup** | Remove filler words (um, uh, like) + normalise punctuation |
| 🗣️ | **Voice Commands** | "stop recording", "new line", "period", "clear all" |
| 🌍 | **Multi-Language** | EN · HI · ES · FR · DE · JA · KO · ZH · PT · RU · AR · IT |
| 📜 | **Voice History** | Browse & reuse previous 50 transcriptions |
| ✏️ | **Editor Insert** | Drop text at your cursor position instead of clipboard |

---


### Install from Marketplace

**Marketplace**

1. Open VS Code
2. Go to **Extensions** (`Ctrl+Shift+X`)
3. Search for **Cursor Voice Assistant**
4. Click **Install**


**Quick open:**

Press `Ctrl+P` and run:
```
ext install Misrilal-Sah.cursor-voice-assistant
```

**From the CLI:**

```bash
code --install-extension Misrilal-Sah.cursor-voice-assistant
```

## 🚀 Quick Start

```
1. Press  Ctrl+Shift+H     →  Recording starts (no browser opens)
2. Speak your prompt       →  Live preview in the Voice Assistant panel
3. Stop speaking           →  Silence auto-stops after 3 s
4. Hit  Ctrl+L  →  Ctrl+V →  Prompt is in Cursor AI chat. Press Enter.
```

## ⚙️ Configuration

> Open **Settings** (`Ctrl+,`) and search `Voice Assistant`.

### 🔑 Groq API Key *(optional — only needed for AI prompt cleanup)*

> **Where to add it:**  
> `Ctrl+,` → search **Voice Assistant** → **Groq API Key** → paste your key

| Setting | Description | Link |
|---|---|---|
| `voiceAssistant.groqApiKey` | Groq — AI cleanup (llama3-8b, fast, free) | [console.groq.com/keys](https://console.groq.com/keys) |
| `voiceAssistant.whisperApiKey` | OpenAI Whisper — high-accuracy STT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

### All Settings

| Setting | Default | Description |
|---|---|---|
| `transcriptionEngine` | `webSpeechAPI` | `webSpeechAPI` (Windows) or `whisperAPI` (OpenAI) |
| `groqApiKey` | *(empty)* | Groq key for AI cleanup — [get free key](https://console.groq.com/keys) |
| `whisperApiKey` | *(empty)* | OpenAI key for Whisper engine |
| `language` | `en-US` | Recognition language |
| `outputMode` | `clipboard` | `clipboard` · `editor` · `both` |
| `autoOpenChat` | `true` | Auto-open Cursor AI chat after transcription |
| `silenceTimeout` | `3` | Seconds of silence before auto-stop (1–30) |
| `enablePromptCleanup` | `true` | Remove filler words (basic, no key needed) |
| `enableVoiceCommands` | `true` | Inline voice commands |
| `showRealtimePreview` | `true` | Live preview in panel |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+H` / `Cmd+Shift+H` | Toggle recording on / off |

---

## 🗣️ Voice Commands

| Say | Result |
|---|---|
| `"stop recording"` | Stops the session |
| `"new line"` | Inserts `\n` |
| `"period"` | Inserts `.` |
| `"comma"` | Inserts `,` |
| `"question mark"` | Inserts `?` |
| `"exclamation mark"` | Inserts `!` |
| `"clear all"` | Clears the current transcription |

---

## 📁 Project Structure

```
src/
├── extension.ts               ← Activation, command wiring, webview
├── statusBar.ts               ← Status bar (idle / recording / processing)
├── outputHandler.ts           ← Clipboard, editor insert, chat open
├── voiceHistory.ts            ← globalState history with QuickPick
├── promptCleanup.ts           ← Filler-word removal (no API key needed)
├── voiceCommands.ts           ← Voice command detection & execution
├── audioPage.ts               ← HTML for optional browser audio page
├── audioServer.ts             ← localhost HTTP + WebSocket server
└── engines/
    ├── engineTypes.ts         ← Interfaces and enums
    ├── windowsSpeechEngine.ts ← Windows System.Speech via PowerShell
    ├── nativeAudioRecorder.ts ← Windows MCI recorder for Whisper mode
    ├── whisperEngine.ts       ← OpenAI Whisper API client
    └── aiPromptCleaner.ts     ← Groq AI cleanup (llama3-8b-8192)
media/
└── icon.png
```

---

## 🔒 Privacy

| Engine | Where data goes |
|---|---|
| `webSpeechAPI` | Processed locally by **Windows Speech Recognition** — stays on your machine |
| `whisperAPI` | Audio sent to **OpenAI API** — key stored in VS Code local settings only |
| Groq AI cleanup | Text sent to **Groq API** — key stored locally only |

**No audio or transcription data is ever stored or transmitted by this extension itself.**

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature
# make changes
npm run build
# F5 to test
git commit -m "feat: your feature"
git push origin feature/your-feature
# Open a Pull Request
```


---

## 📄 License

[MIT](LICENSE) © [Misrilal Sah](https://misril.dev/)

---

<div align="center">

Made with ❤️ by [Misrilal Sah](https://misril.dev/) &nbsp;·&nbsp; [Report a Bug](https://github.com/Misrilal-Sah/Cursor-Voice-Assistant/issues)

<!-- Footer wave -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,20,24&height=120&section=footer" width="100%" />


</div>