/**
 * js/ai-copilot.js — Toffee AI Copilot v7
 * Features: STT (Web Speech API), TTS with voice selector, auto-speak toggle,
 * audio level visualizer bars, multi-language support, robust error handling.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ── DOM ── */
  const launcher     = document.getElementById('aiFloatingLauncher');
  const speechBubble = document.getElementById('aiRobotSpeechBubble');
  const dismissBtn   = document.getElementById('aiBubbleDismiss');
  const popup        = document.getElementById('aiChatPopup');
  const backdrop     = document.getElementById('aiPopupBackdrop');
  const closeBtn     = document.getElementById('aiCloseBtn');
  const askBtn       = document.getElementById('aiAskBtn');
  const micBtn       = document.getElementById('aiMicBtn');
  const langSel      = document.getElementById('aiLanguage');
  const prompt       = document.getElementById('aiPrompt');
  const chat         = document.getElementById('aiResponse');

  if (!launcher || !popup) return;

  /* ── State ── */
  let hasGreeted   = false;
  let recognition  = null;
  let isListening  = false;
  let autoSpeak    = false;
  let selectedVoice = null;
  let audioContext  = null;
  let analyserNode  = null;
  let micStream     = null;
  let animFrameId   = null;

  /* ────────────────────────────────────────────
     Inject enhanced copilot header controls
  ──────────────────────────────────────────── */
  function injectCopilotControls() {
    const header = popup.querySelector('.ai-popup-header, .ai-header');
    if (!header || document.getElementById('aiVoiceSelector')) return;

    // Voice selector
    const voiceSel = document.createElement('select');
    voiceSel.id = 'aiVoiceSelector';
    voiceSel.title = 'Select TTS voice';
    voiceSel.style.cssText =
      'background:#0F172A;border:1px solid rgba(99,102,241,0.4);color:#CBD5E1;' +
      'padding:3px 8px;border-radius:6px;font-size:0.72rem;max-width:140px;cursor:pointer;';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '🔊 Auto Voice';
    voiceSel.appendChild(defaultOpt);
    voiceSel.addEventListener('change', () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      selectedVoice = voices.find(v => v.name === voiceSel.value) || null;
    });

    // Auto-speak toggle
    const autoBtn = document.createElement('button');
    autoBtn.id    = 'aiAutoSpeakBtn';
    autoBtn.title = 'Auto-speak: OFF — every AI reply will be read aloud when ON';
    autoBtn.style.cssText =
      'background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);' +
      'color:#64748B;padding:3px 10px;border-radius:6px;font-size:0.72rem;cursor:pointer;' +
      'white-space:nowrap;transition:all 0.2s;';
    autoBtn.textContent = '🔇 Auto-Speak: OFF';
    autoBtn.addEventListener('click', () => {
      autoSpeak = !autoSpeak;
      autoBtn.textContent = autoSpeak ? '🔊 Auto-Speak: ON' : '🔇 Auto-Speak: OFF';
      autoBtn.style.color  = autoSpeak ? '#818CF8' : '#64748B';
      autoBtn.style.borderColor = autoSpeak ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)';
      autoBtn.style.background  = autoSpeak ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)';
    });

    // Audio level visualizer (5 bars)
    const viz = document.createElement('div');
    viz.id = 'aiMicViz';
    viz.style.cssText =
      'display:none;align-items:flex-end;gap:2px;height:18px;margin-left:4px;';
    for (let i = 0; i < 5; i++) {
      const bar = document.createElement('span');
      bar.style.cssText =
        'display:inline-block;width:4px;height:6px;border-radius:2px;' +
        'background:#6366F1;transition:height 0.07s ease;';
      viz.appendChild(bar);
    }

    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;padding:6px 14px 2px;flex-wrap:wrap;';
    row.append(voiceSel, autoBtn, viz);
    header.after(row);
  }

  /* ────────────────────────────────────────────
     Populate TTS voice list
  ──────────────────────────────────────────── */
  function populateVoices() {
    const voiceSel = document.getElementById('aiVoiceSelector');
    if (!voiceSel || !window.speechSynthesis) return;

    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    // Keep default option, add the rest
    while (voiceSel.options.length > 1) voiceSel.remove(1);

    const PREFER = ['Google', 'Microsoft', 'Natural'];
    const sorted = [...voices].sort((a, b) => {
      const aScore = PREFER.some(p => a.name.includes(p)) ? 0 : 1;
      const bScore = PREFER.some(p => b.name.includes(p)) ? 0 : 1;
      return aScore - bScore;
    });

    sorted.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.lang} — ${v.name.slice(0, 30)}`;
      voiceSel.appendChild(opt);
    });
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
    populateVoices();
  }

  /* ────────────────────────────────────────────
     Speech Recognition (STT)
  ──────────────────────────────────────────── */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (prompt) {
        prompt.value = text;
        prompt.focus();
        // Auto-send if result came from mic
        if (isListening) sendMessage();
      }
    };

    recognition.onend = () => {
      isListening = false;
      stopMicVisualizer();
      if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '🎙️';
        micBtn.title = 'Click to speak your question';
      }
    };

    recognition.onerror = (e) => {
      isListening = false;
      stopMicVisualizer();
      if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '🎙️';
      }
      const msg = e.error === 'not-allowed'
        ? 'Mic permission denied. Please allow microphone access in browser settings.'
        : e.error === 'no-speech'
        ? 'No speech detected. Please try again.'
        : `Speech error: ${e.error}`;
      appendMsg('bot', `⚠️ ${msg}`, true);
    };
  }

  /* ────────────────────────────────────────────
     Mic Visualizer (Web Audio API)
  ──────────────────────────────────────────── */
  async function startMicVisualizer() {
    const viz = document.getElementById('aiMicViz');
    if (!viz || !navigator.mediaDevices) return;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 64;
      const source = audioContext.createMediaStreamSource(micStream);
      source.connect(analyserNode);

      viz.style.display = 'flex';
      const bars = viz.querySelectorAll('span');
      const buf  = new Uint8Array(analyserNode.frequencyBinCount);

      function draw() {
        animFrameId = requestAnimationFrame(draw);
        analyserNode.getByteFrequencyData(buf);
        bars.forEach((bar, i) => {
          const val = buf[i * 3] || 0;
          const h   = Math.max(4, Math.round((val / 255) * 18));
          bar.style.height = h + 'px';
          bar.style.background = h > 12 ? '#38BDF8' : '#6366F1';
        });
      }
      draw();
    } catch (err) {
      // Mic permission denied or not available — silent fail
    }
  }

  function stopMicVisualizer() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (micStream)   { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    const viz = document.getElementById('aiMicViz');
    if (viz) viz.style.display = 'none';
  }

  /* ────────────────────────────────────────────
     Open / Close
  ──────────────────────────────────────────── */
  function openPopup() {
    popup.style.display    = 'flex';
    backdrop.style.display = 'block';
    document.body.classList.add('ai-widget-open');
    if (speechBubble) speechBubble.classList.add('ai-bubble-hidden');

    requestAnimationFrame(() => {
      popup.classList.add('ai-popup-open');
      backdrop.classList.add('ai-popup-backdrop-open');
    });

    injectCopilotControls();
    populateVoices();

    setTimeout(() => {
      prompt && prompt.focus();
      if (!hasGreeted) {
        hasGreeted = true;
        const intro = "Welcome! I'm the Toffee AI Copilot. I can help you design high-availability cloud systems, optimize latency, simulate cluster failovers, and analyze your scanned documents with AI.\n\n💡 Click 🎙️ to speak your question, and use the 🔊 Auto-Speak toggle to hear every answer automatically!";
        appendMsg('bot', intro);
      }
    }, 260);
  }

  function closePopup() {
    popup.classList.remove('ai-popup-open');
    backdrop.classList.remove('ai-popup-backdrop-open');
    document.body.classList.remove('ai-widget-open');
    if (isListening) { recognition?.stop(); }
    stopMicVisualizer();

    setTimeout(() => {
      popup.style.display    = 'none';
      backdrop.style.display = 'none';
    }, 280);
  }

  launcher.addEventListener('click', openPopup);
  closeBtn  && closeBtn.addEventListener('click', closePopup);
  backdrop  && backdrop.addEventListener('click', closePopup);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup.classList.contains('ai-popup-open')) closePopup();
  });

  /* ── Speech bubble ── */
  if (speechBubble) {
    speechBubble.addEventListener('click', (e) => {
      if (e.target === dismissBtn || (dismissBtn && dismissBtn.contains(e.target))) return;
      openPopup();
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speechBubble.classList.add('ai-bubble-hidden');
    });
  }

  /* ────────────────────────────────────────────
     Mic Button
  ──────────────────────────────────────────── */
  if (micBtn) {
    micBtn.title = 'Click to speak your question';
    micBtn.addEventListener('click', () => {
      if (!recognition) {
        window.showToast?.('Speech recognition is not supported in this browser. Try Chrome or Edge.', 'error');
        return;
      }
      if (isListening) {
        recognition.stop();
        isListening = false;
        stopMicVisualizer();
        micBtn.classList.remove('recording');
        micBtn.innerHTML = '🎙️';
      } else {
        try {
          // Update lang from selector
          if (langSel) {
            const langMap = {
              en: 'en-US', ur: 'ur-PK', hi: 'hi-IN',
              es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR',
              ar: 'ar-SA', zh: 'zh-CN', ja: 'ja-JP'
            };
            recognition.lang = langMap[langSel.value] || 'en-US';
          }
          recognition.start();
          isListening = true;
          micBtn.classList.add('recording');
          micBtn.innerHTML = '⏹️';
          micBtn.title = 'Click to stop recording';
          startMicVisualizer();
          window.showToast?.('🎙️ Listening… speak your question now.', 'info');
        } catch (e) {
          window.showToast?.('Could not start microphone. Please check browser permissions.', 'error');
        }
      }
    });
  }

  /* ── Suggestion chips ── */
  document.querySelectorAll('.ai-suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (prompt) {
        prompt.value = btn.dataset.prompt || '';
        prompt.focus();
      }
    });
  });

  /* ────────────────────────────────────────────
     Send Message
  ──────────────────────────────────────────── */
  askBtn  && askBtn.addEventListener('click', sendMessage);
  prompt  && prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    if (!prompt || !chat) return;
    const text = prompt.value.trim();
    if (!text) {
      prompt.placeholder = 'Please write a question first…';
      prompt.focus();
      return;
    }

    askBtn.disabled = true;
    appendMsg('user', text);
    prompt.value = '';

    document.body.classList.add('ai-typing-active');
    const typing = appendTyping();
    chat.scrollTop = chat.scrollHeight;

    const docContext = window._activeDocumentContext || null;

    try {
      const res = await fetch('/api/ai', {
        method : 'POST',
        headers: {
          'Content-Type' : 'application/json',
          'Authorization': window.ToffeeAuth?.token ? `Bearer ${window.ToffeeAuth.token}` : ''
        },
        body: JSON.stringify({
          prompt  : text,
          language: langSel ? langSel.value : 'en',
          document_context: docContext
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      typing.remove();
      const msgEl = appendMsg('bot', data.answer);

      // Auto-speak if toggle is ON
      if (autoSpeak) {
        speakText(data.answer);
      }
    } catch (err) {
      typing.remove();
      appendMsg('bot', `⚠️ Could not reach the server: ${err.message}`, true);
    } finally {
      document.body.classList.remove('ai-typing-active');
      askBtn.disabled = false;
      chat.scrollTop  = chat.scrollHeight;
      prompt && prompt.focus();
    }
  }

  /* ────────────────────────────────────────────
     Text-to-Speech
  ──────────────────────────────────────────── */
  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/-\s/g, '')
      .trim();

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate  = 1.05;
    utter.pitch = 1.0;

    // Use selected voice or find a good English one
    if (selectedVoice) {
      utter.voice = selectedVoice;
    } else {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        v.name.includes('Google') || v.name.includes('Microsoft') || v.lang === 'en-US'
      );
      if (preferred) utter.voice = preferred;
    }

    window.speechSynthesis.speak(utter);
  }

  /* ────────────────────────────────────────────
     Message Rendering
  ──────────────────────────────────────────── */
  function appendMsg(sender, text, isError = false) {
    const wrap = document.createElement('div');
    wrap.className = `ai-message ai-message-${sender}${isError ? ' ai-message-error' : ''}`;

    const avatar  = sender === 'bot' ? '<div class="ai-mini-avatar" title="Toffee Bot">🤖</div>' : '';
    const label   = sender === 'bot' ? 'Toffee AI' : 'You';
    const body    = sender === 'bot' ? formatResponse(text) : `<p>${esc(text)}</p>`;

    const speakBtn = sender === 'bot' && !isError
      ? '<button class="ai-speak-btn" title="Read response aloud">🔊 Speak</button>' : '';
    const copyBtn  = sender === 'bot' && !isError
      ? '<button class="ai-copy-btn" title="Copy response">📋 Copy</button>' : '';

    wrap.innerHTML =
      `${avatar}<div class="ai-bubble">` +
      `<div style="position:absolute;top:6px;right:6px;display:flex;gap:4px;">${speakBtn}${copyBtn}</div>` +
      `<span class="ai-message-label">${label}</span>${body}</div>`;

    // Copy handler
    const cBtn = wrap.querySelector('.ai-copy-btn');
    cBtn && cBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        cBtn.textContent = '✓ Copied!';
        setTimeout(() => { cBtn.textContent = '📋 Copy'; }, 2000);
      });
    });

    // Speak handler (per-message button)
    const sBtn = wrap.querySelector('.ai-speak-btn');
    sBtn && sBtn.addEventListener('click', () => {
      speakText(text);
      sBtn.textContent = '🔊…';
      setTimeout(() => { sBtn.textContent = '🔊 Speak'; }, 2500);
    });

    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
    return wrap;
  }

  function appendTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'ai-message ai-message-bot ai-typing-message';
    wrap.innerHTML =
      '<div class="ai-mini-avatar">🤖</div>' +
      '<div class="ai-bubble"><span class="ai-message-label">Toffee AI</span>' +
      '<div class="ai-typing"><i></i><i></i><i></i><span>Thinking…</span></div></div>';
    chat.appendChild(wrap);
    return wrap;
  }

  function formatResponse(answer) {
    return answer
      .split('\n')
      .map((line) => {
        if (line.startsWith('## '))   return `<h4>${esc(line.slice(3))}</h4>`;
        if (line.startsWith('### '))  return `<h5 style="color:#38BDF8;font-size:0.8rem;margin:6px 0 2px 0;">${esc(line.slice(4))}</h5>`;
        if (line.startsWith('- '))    return `<li>${esc(line.slice(2))}</li>`;
        if (line.startsWith('**') && line.endsWith('**'))
          return `<p style="font-weight:700;color:#F8FAFC;">${esc(line.replace(/\*\*/g, ''))}</p>`;
        if (!line.trim()) return '';
        return `<p>${esc(line)}</p>`;
      })
      .join('')
      .replace(/(<li>.*?<\/li>)+/gs, (m) => `<ul>${m}</ul>`);
  }

  function esc(v) {
    return v.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }
});
