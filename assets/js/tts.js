/* 知忆 · 语音朗读（Web Speech） */
(function (Z) {
  let voices = [];
  let activeUtt = null;
  let state = { speaking: false, paused: false };
  const listeners = new Set();

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
    emit();
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function emit() { listeners.forEach((fn) => fn({ voices, state })); }

  function langCode(lang) {
    if (!lang) return 'en-US';
    lang = lang.toLowerCase();
    if (lang.startsWith('zh') || lang.startsWith('wenyan')) return 'zh-CN';
    if (lang.startsWith('ja')) return 'ja-JP';
    if (lang.startsWith('ko')) return 'ko-KR';
    if (lang.startsWith('en')) return 'en-US';
    return lang;
  }

  function pickVoice(lang) {
    const code = langCode(lang);
    const saved = Z.store.get('tts.voice.' + code.slice(0, 2), '');
    let v = voices.find((x) => x.voiceURI === saved);
    if (v) return v;
    const base = code.slice(0, 2);
    const candidates = voices.filter((x) => (x.lang || '').toLowerCase().startsWith(base));
    const preferred = candidates.find((x) => /natural|neural|online|google|microsoft/i.test(x.name)) || candidates[0];
    return preferred || voices.find((x) => x.default) || null;
  }

  function stop() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    activeUtt = null;
    state.speaking = false; state.paused = false;
    emit();
  }

  function speak(text, opts = {}) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        Z.toast('当前浏览器不支持语音朗读，建议使用 Edge 或 Chrome', 'error');
        resolve(false);
        return;
      }
      if (!text || !String(text).trim()) { resolve(false); return; }
      window.speechSynthesis.cancel();
      const lang = opts.lang || Z.langOf(text);
      const code = langCode(lang);
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = code;
      u.rate = opts.rate || Number(Z.store.get('tts.rate', 1)) || 1;
      u.pitch = opts.pitch || 1;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.onstart = () => { state.speaking = true; state.paused = false; activeUtt = u; emit(); if (opts.onstart) opts.onstart(); };
      u.onboundary = (e) => { if (opts.onboundary) opts.onboundary(e, u); };
      u.onend = () => { state.speaking = false; state.paused = false; activeUtt = null; emit(); if (opts.onend) opts.onend(); resolve(true); };
      u.onerror = (e) => {
        state.speaking = false; state.paused = false; activeUtt = null; emit();
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          Z.toast('语音播放失败：' + (e.error || '未知错误'), 'error');
        }
        if (opts.onend) opts.onend();
        resolve(false);
      };
      activeUtt = u;
      window.speechSynthesis.speak(u);
    });
  }

  function pause() {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      state.paused = true; emit();
    }
  }
  function resume() {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      state.paused = false; emit();
    }
  }
  function togglePause() { state.paused ? resume() : pause(); }

  function speakWord(word, lang) {
    const clean = String(word || '').replace(/^[^A-Za-z\u4e00-\u9fff]+|[^A-Za-z\u4e00-\u9fff]+$/g, '');
    if (!clean) return;
    speak(clean, { lang: lang || Z.langOf(clean), rate: 0.82 });
  }

  function speakSentences(sentences, opts = {}) {
    let i = 0;
    let cancelled = false;
    function next() {
      if (cancelled || i >= sentences.length) {
        if (opts.onDone) opts.onDone();
        return;
      }
      const idx = i++;
      if (opts.onSentence) opts.onSentence(idx);
      speak(sentences[idx], {
        lang: opts.lang,
        rate: opts.rate,
        onboundary: opts.onboundary ? (e) => opts.onboundary(e, idx) : null,
        onend: () => setTimeout(next, 120)
      });
    }
    next();
    return { cancel() { cancelled = true; stop(); } };
  }

  Z.TTS = {
    get voices() { return voices; },
    get state() { return state; },
    langCode, stop, speak, speakWord, speakSentences, pause, resume, togglePause,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setRate(r) { Z.store.set('tts.rate', r); },
    getRate() { return Number(Z.store.get('tts.rate', 1)) || 1; },
    setVoice(lang, uri) { Z.store.set('tts.voice.' + langCode(lang).slice(0, 2), uri); },
    available() { return 'speechSynthesis' in window; }
  };
})(window.ZY);
