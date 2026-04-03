/**
 * Generates the HTML for the browser-based audio capture page.
 * This page opens in the user's default browser and has full microphone access.
 */
export function getAudioPageHTML(
  port: number,
  engine: string,
  language: string,
  silenceTimeout: number
): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎤 Cursor Voice Assistant</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0f0f13;
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .container {
      max-width: 540px;
      width: 100%;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    }

    .header {
      text-align: center;
      margin-bottom: 24px;
    }

    .header h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
      background: linear-gradient(135deg, #818cf8, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .header p {
      font-size: 13px;
      color: #71717a;
    }

    /* Status Badge */
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 20px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #3f3f46;
      transition: background 0.3s;
    }

    .status-dot.recording {
      background: #ef4444;
      box-shadow: 0 0 12px rgba(239,68,68,0.5);
      animation: pulse 1.2s infinite;
    }

    .status-dot.connected {
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34,197,94,0.4);
    }

    .status-text {
      font-size: 13px;
      font-weight: 500;
      color: #a1a1aa;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }

    /* Audio Level */
    .audio-meter {
      width: 100%;
      height: 6px;
      background: #27272a;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .audio-meter-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #818cf8, #a78bfa, #c084fc);
      border-radius: 3px;
      transition: width 0.08s ease-out;
    }

    .audio-meter-fill.active {
      background: linear-gradient(90deg, #ef4444, #f97316, #eab308);
    }

    /* Preview Box */
    .preview {
      background: #0f0f13;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 16px;
      min-height: 120px;
      max-height: 250px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 20px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .preview .final { color: #e4e4e7; }
    .preview .interim { color: #71717a; font-style: italic; }
    .preview .placeholder {
      color: #3f3f46;
      font-style: italic;
      text-align: center;
      padding-top: 40px;
    }

    /* Buttons */
    .controls {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    .btn {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-record {
      background: linear-gradient(135deg, #818cf8, #6366f1);
      color: #fff;
    }
    .btn-record:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }

    .btn-stop {
      background: #ef4444;
      color: #fff;
    }
    .btn-stop:hover { background: #dc2626; }

    .btn-secondary {
      background: #27272a;
      color: #a1a1aa;
    }
    .btn-secondary:hover { background: #3f3f46; color: #e4e4e7; }

    .hidden { display: none !important; }

    /* Connection info */
    .connection-info {
      text-align: center;
      font-size: 11px;
      color: #3f3f46;
      margin-top: 16px;
    }

    .connection-info.connected { color: #22c55e; }
    .connection-info.disconnected { color: #ef4444; }

    /* Toast notification */
    .toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #22c55e;
      color: #fff;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s;
      z-index: 1000;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* Error banner */
    .error-banner {
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.3);
      color: #fca5a5;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      margin-bottom: 16px;
      text-align: center;
    }
    .error-banner.hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎤 Cursor Voice Assistant</h1>
      <p>Speak your prompts — transcription is sent to your IDE</p>
    </div>

    <div id="errorBanner" class="error-banner hidden"></div>

    <div class="status">
      <div id="statusDot" class="status-dot"></div>
      <span id="statusText" class="status-text">Connecting to IDE...</span>
    </div>

    <div class="audio-meter">
      <div id="audioMeter" class="audio-meter-fill"></div>
    </div>

    <div id="preview" class="preview">
      <span class="placeholder">Click "Start Recording" and speak — your words will appear here</span>
    </div>

    <div class="controls">
      <button id="btnRecord" class="btn btn-record" onclick="startRecording()">
        🎤 Start Recording
      </button>
      <button id="btnStop" class="btn btn-stop hidden" onclick="stopRecording()">
        ⏹ Stop
      </button>
    </div>

    <div id="connectionInfo" class="connection-info disconnected">
      Connecting to IDE on port ${port}...
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    // Config from extension
    const WS_PORT = ${port};
    let currentEngine = ${JSON.stringify(engine)};
    let currentLanguage = ${JSON.stringify(language)};
    let silenceTimeoutSec = ${JSON.stringify(silenceTimeout)};

    // State
    let ws = null;
    let mediaStream = null;
    let audioContext = null;
    let analyser = null;
    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let silenceTimer = null;
    let isRecording = false;
    let finalTranscript = '';
    let animFrameId = null;

    // DOM refs
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const audioMeter = document.getElementById('audioMeter');
    const preview = document.getElementById('preview');
    const btnRecord = document.getElementById('btnRecord');
    const btnStop = document.getElementById('btnStop');
    const connectionInfo = document.getElementById('connectionInfo');
    const errorBanner = document.getElementById('errorBanner');

    // ─── WebSocket Connection ───────────────────────────────────
    function connect() {
      ws = new WebSocket('ws://127.0.0.1:' + WS_PORT);

      ws.onopen = () => {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected to IDE — Ready';
        connectionInfo.textContent = 'Connected to IDE ✓';
        connectionInfo.className = 'connection-info connected';
        errorBanner.classList.add('hidden');
        ws.send(JSON.stringify({ type: 'ready' }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'startRecording':
            if (msg.engine) currentEngine = msg.engine;
            if (msg.language) currentLanguage = msg.language;
            if (msg.silenceTimeout) silenceTimeoutSec = msg.silenceTimeout;
            startRecording();
            break;
          case 'stopRecording':
            stopRecording();
            break;
          case 'updateConfig':
            if (msg.engine) currentEngine = msg.engine;
            if (msg.language) currentLanguage = msg.language;
            if (msg.silenceTimeout) silenceTimeoutSec = msg.silenceTimeout;
            break;
        }
      };

      ws.onclose = () => {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Disconnected from IDE';
        connectionInfo.textContent = 'Disconnected — Reconnecting...';
        connectionInfo.className = 'connection-info disconnected';
        // Reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        // Will trigger onclose
      };
    }

    function sendToIDE(message) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }

    // ─── Recording ──────────────────────────────────────────────
    async function startRecording() {
      if (isRecording) return;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });

        isRecording = true;
        finalTranscript = '';
        audioChunks = [];

        // UI
        statusDot.className = 'status-dot recording';
        statusText.textContent = 'Recording...';
        btnRecord.classList.add('hidden');
        btnStop.classList.remove('hidden');
        audioMeter.classList.add('active');
        preview.innerHTML = '<span class="interim">Listening...</span>';
        errorBanner.classList.add('hidden');

        // Audio analysis
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        monitorLevel();

        // MediaRecorder for Whisper API
        if (currentEngine === 'whisperAPI') {
          startMediaRecorder();
        }

        // Web Speech API
        startSpeechRecognition();

        sendToIDE({ type: 'info', message: 'Recording started (' + currentEngine + ')' });

      } catch (err) {
        sendToIDE({ type: 'error', message: 'Microphone error: ' + err.message });
        showError('❌ Microphone access denied. Please allow microphone access and refresh the page.');
        showToast('❌ Microphone access denied', '#ef4444');
        resetUI();
      }
    }

    function startSpeechRecognition() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        if (currentEngine === 'webSpeechAPI') {
          const msg = 'Web Speech API unavailable. Please use Google Chrome or Microsoft Edge.';
          sendToIDE({ type: 'error', message: msg });
          showError('⚠️ ' + msg);
        }
        return;
      }

      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLanguage;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t + ' ';
            // Don't send per-segment finals — accumulate and send complete transcript on stop
          } else {
            interim += t;
          }
        }

        preview.innerHTML =
          '<span class="final">' + esc(finalTranscript) + '</span>' +
          '<span class="interim">' + esc(interim) + '</span>';

        resetSilenceTimer();
      };

      recognition.onerror = (e) => {
        if (e.error === 'no-speech') return;
        if (e.error === 'network') {
          showError('⚠️ Speech recognition network error. Make sure you are using Chrome or Edge (not Cursor\\'s built-in browser).');
        }
        sendToIDE({ type: 'error', message: 'Speech error: ' + e.error });
      };

      recognition.onend = () => {
        if (isRecording) {
          try { recognition.start(); } catch(e) {}
        }
      };

      recognition.start();
    }

    function startMediaRecorder() {
      mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (audioChunks.length === 0) return;
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
        sendToIDE({ type: 'whisperAudioReady', audioData: b64 });
      };

      mediaRecorder.start(1000);
    }

    function stopRecording() {
      if (!isRecording) return;
      isRecording = false;

      if (recognition) { try { recognition.stop(); } catch(e) {} recognition = null; }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); mediaRecorder = null; }
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
      if (audioContext) { audioContext.close(); audioContext = null; }
      clearSilenceTimer();
      if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

      if (currentEngine === 'webSpeechAPI' && finalTranscript.trim()) {
        sendToIDE({
          type: 'transcriptionResult',
          text: finalTranscript.trim(),
          isFinal: true,
        });
      }

      sendToIDE({ type: 'recordingStopped' });
      resetUI();
      if (finalTranscript.trim()) {
        showToast('✅ Transcription sent to IDE!', '#22c55e');
      }
    }

    function resetUI() {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected — Ready';
      btnRecord.classList.remove('hidden');
      btnStop.classList.add('hidden');
      audioMeter.style.width = '0%';
      audioMeter.classList.remove('active');
    }

    // ─── Audio Level Monitoring ─────────────────────────────────
    function monitorLevel() {
      if (!analyser || !isRecording) return;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const level = Math.min(100, (avg / 128) * 100);
      audioMeter.style.width = level + '%';

      if (level < 2) { startSilenceTimer(); }
      else { resetSilenceTimer(); }

      animFrameId = requestAnimationFrame(monitorLevel);
    }

    function startSilenceTimer() {
      if (silenceTimer) return;
      silenceTimer = setTimeout(() => {
        if (isRecording) {
          sendToIDE({ type: 'silenceDetected' });
          stopRecording();
        }
      }, silenceTimeoutSec * 1000);
    }

    function resetSilenceTimer() {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
    }

    function clearSilenceTimer() { resetSilenceTimer(); }

    // ─── Helpers ────────────────────────────────────────────────
    function esc(t) {
      const d = document.createElement('div');
      d.textContent = t;
      return d.innerHTML;
    }

    function showToast(msg, color) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.style.background = color || '#22c55e';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function showError(msg) {
      errorBanner.textContent = msg;
      errorBanner.classList.remove('hidden');
    }

    // ─── Init ───────────────────────────────────────────────────
    connect();
  </script>
</body>
</html>`;
}
