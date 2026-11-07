/* ============================================================================
   TEXAS HOLD'EM — sound: card deals and flips, chips, check knock, fold
   flick, all-in sting, win chime, turn alert, timer ticks and the dealer's
   generated voice lines. Built on the shared synthesizer (ZEUS.AudioEngine).
   ========================================================================== */
(function (root) {
  'use strict';
  const PK = root.PK, ZEUS = root.ZEUS;
  const A = PK.audio = new ZEUS.AudioEngine();
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  A.clipsRaw = {}; A.clips = {};
  A.preloadClip = function (name, url) { if (!root.fetch) return; fetch(url).then(r => (r.ok ? r.arrayBuffer() : null)).then(buf => { if (buf) this.clipsRaw[name] = buf; }).catch(() => {}); };
  A.say = function (name, gain) {
    if (!this.ready || this.muted) return false; const raw = this.clipsRaw[name]; if (!raw && !this.clips[name]) return false;
    const play = ab => { const src = this.ctx.createBufferSource(); src.buffer = ab; const g = this._g(gain || 0.8, this.sfx, 0.2); src.connect(g); src.start(); };
    if (this.clips[name]) play(this.clips[name]); else this.ctx.decodeAudioData(raw.slice(0)).then(ab => { this.clips[name] = ab; play(ab); }).catch(() => {});
    return true;
  };
  A.dealCard = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 1800 + Math.random() * 800, Q: 1.2, gain: 0.22, a: 0.004, d: 0.05, s: 0.2, r: 0.04, dur: 0.05 }); };
  A.shuffle = function () { if (!this.ready) return; const t = this.now(); for (let k = 0; k < 14; k++) this.noise({ t: t + k * 0.035, type: 'bandpass', freq: 1500 + Math.random() * 1500, Q: 1.5, gain: 0.12, a: 0.002, d: 0.02, s: 0.1, r: 0.02, dur: 0.02 }); };
  A.flipCard = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'highpass', freq: 2500, gain: 0.18, a: 0.002, d: 0.03, s: 0.1, r: 0.03, dur: 0.03 }); this.tone({ t: t + 0.02, freq: 900, freqEnd: 500, sweep: 0.05, gain: 0.05, a: 0.002, d: 0.05, s: 0.05, r: 0.03, dur: 0.05 }); };
  A.chips = function (n) { if (!this.ready) return; const t = this.now(), m = Math.max(1, Math.min(8, n || 2)); for (let k = 0; k < m; k++) { const tt = t + k * 0.055 + Math.random() * 0.01, f = 2100 + Math.random() * 600; this.tone({ t: tt, freq: f, gain: 0.08, a: 0.001, d: 0.05, s: 0.02, r: 0.03, dur: 0.05 }); this.noise({ t: tt, type: 'bandpass', freq: 4200, Q: 3, gain: 0.1, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); } };
  A.chipSlide = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 1100, freqEnd: 500, sweep: 0.4, Q: 0.8, gain: 0.14, a: 0.03, d: 0.3, s: 0.3, r: 0.15, dur: 0.4 }); for (let k = 0; k < 5; k++) this.noise({ t: t + 0.05 + Math.random() * 0.35, type: 'bandpass', freq: 3000 + Math.random() * 1500, Q: 3, gain: 0.07, dur: 0.01, d: 0.015, s: 0.1, r: 0.02 }); };
  A.check = function () { if (!this.ready) return; const t = this.now(); [0, 0.13].forEach(d => { this.thump(t + d, { freq: 160, gain: 0.3, dur: 0.05 }); this.noise({ t: t + d, type: 'lowpass', freq: 900, gain: 0.3, dur: 0.015, d: 0.02, s: 0.1, r: 0.02 }); }); };
  A.fold = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 1400, freqEnd: 600, sweep: 0.12, Q: 1, gain: 0.14, a: 0.004, d: 0.1, s: 0.1, r: 0.05, dur: 0.12 }); };
  A.allIn = function () { if (!this.ready) return; const t = this.now(); this.thump(t, { freq: 70, gain: 0.5, dur: 0.2 }); [[57, 61, 64], [59, 63, 66]].forEach((ch, k) => ch.forEach(n => this.brass(midi(n), t + 0.05 + k * 0.28, k ? 0.9 : 0.25, 0.1))); this.noise({ t: t, type: 'highpass', freq: 4000, gain: 0.12, a: 0.005, d: 0.8, s: 0.001, r: 0.2, dur: 0.8 }); };
  A.win = function (big) { if (!this.ready) return; const t = this.now(); [76, 80, 83, 88].forEach((n, i) => this.bell(midi(n), t + i * 0.08, { gain: 0.1, dur: 1.2 })); if (big) [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, k) => ch.forEach(n => this.brass(midi(n), t + 0.4 + k * 0.36, k === 3 ? 1.4 : 0.3, 0.08))); };
  A.yourTurn = function () { if (!this.ready) return; const t = this.now(); this.bell(midi(88), t, { gain: 0.08, dur: 0.6 }); this.bell(midi(92), t + 0.1, { gain: 0.06, dur: 0.6 }); };
  A.tick = function () { if (!this.ready) return; this.tone({ t: this.now(), freq: 1800, gain: 0.05, a: 0.001, d: 0.03, s: 0.1, r: 0.02, dur: 0.03 }); };
  A.buttonMove = function () { if (!this.ready) return; const t = this.now(); this.noise({ t: t, type: 'bandpass', freq: 2600, Q: 2, gain: 0.12, dur: 0.02, d: 0.03, s: 0.1, r: 0.03 }); };
  A.deny = function () { if (!this.ready) return; this.tone({ t: this.now(), type: 'square', freq: 170, gain: 0.06, a: 0.005, d: 0.12, s: 0.5, r: 0.05, dur: 0.14, filter: { type: 'lowpass', freq: 900 } }); };
  A.startAmbience = function () {
    if (!this.ready || this._amb) return; const ctx = this.ctx, t = this.now();
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.music); src.start(t); g.gain.setTargetAtTime(0.03, t, 2);
    this._amb = { src: src, g: g, timer: setInterval(() => { if (this.ready && Math.random() < 0.6) this.noise({ t: this.now() + Math.random() * 0.5, type: 'bandpass', freq: 300 + Math.random() * 400, Q: 3, gain: 0.025, a: 0.05, d: 0.15, s: 0.4, r: 0.2, dur: 0.15 + Math.random() * 0.2, dest: this.music }); }, 900) };
  };
})(window);
