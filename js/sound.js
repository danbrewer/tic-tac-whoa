'use strict';
// Tiny synthesized sound effects (Web Audio, no files needed).
const Sound = {
  ctx: null,
  on: true,

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, { type = 'sine', vol = 0.12, when = 0, slideTo = null } = {}) {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  noise(dur, { vol = 0.2, when = 0, from = 400, to = 4000, q = 1.2 } = {}) {
    if (!this.on || !this.ctx) return;
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(gain).connect(this.ctx.destination);
    src.start(t0, Math.random() * 0.15);
    src.stop(t0 + dur + 0.05);
  },

  place(p) {
    // falling whistle; the thump comes on impact (land)
    const f = p === 'X' ? 1320 : 990;
    this.tone(f, 0.26, { type: 'sine', vol: 0.06, slideTo: f / 2.2 });
  },
  land(level = 0) {
    const f = 150 / (1 + level * 0.35);
    this.tone(f, 0.22 + level * 0.08, { type: 'sine', vol: 0.32, slideTo: f * 0.45 });
    this.noise(0.08, { vol: 0.12, from: 2500, to: 800, q: 0.8 });
    this.tone(880 + level * 220, 0.12, { type: 'triangle', vol: 0.07, when: 0.02 });
  },
  tick(k = 0) { this.tone(1500 + k * 60, 0.04, { type: 'sine', vol: 0.035 }); },
  pop(i = 0) {
    this.tone(700 + i * 260, 0.12, { type: 'triangle', vol: 0.1, slideTo: 1400 + i * 300 });
    this.noise(0.12, { vol: 0.08, from: 3000, to: 6000 });
  },
  zoomIn() {
    this.tone(180, 0.9, { type: 'triangle', vol: 0.07, slideTo: 1200 });
    this.noise(0.9, { vol: 0.12, from: 300, to: 5000, q: 2 });
  },
  zoomOut() {
    this.tone(1200, 0.9, { type: 'triangle', vol: 0.07, slideTo: 160 });
    this.noise(0.9, { vol: 0.12, from: 5000, to: 300, q: 2 });
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, when: i * 0.09 }));
  },
  ascend() {
    this.noise(1.8, { vol: 0.25, from: 200, to: 8000, q: 1.5 });
    this.tone(55, 1.2, { type: 'sine', vol: 0.4, slideTo: 30 });
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.45, { type: 'sawtooth', vol: 0.05, when: i * 0.1 }));
    this.tone(98, 1.6, { type: 'sine', vol: 0.18 });
  },
  poof() {
    this.noise(0.35, { vol: 0.18, from: 6000, to: 500, q: 0.7 });
    this.tone(900, 0.3, { type: 'sine', vol: 0.06, slideTo: 2400 });
  },
  stone() {
    this.tone(60, 0.5, { type: 'sine', vol: 0.45, slideTo: 30 });
    this.noise(0.4, { vol: 0.3, from: 900, to: 120, q: 0.6 });
  },
  jackpotFound() {
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.05, when: i * 0.06 }));
    this.noise(0.5, { vol: 0.1, from: 4000, to: 9000 });
  },
  slotOpen() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.15, { type: 'square', vol: 0.05, when: i * 0.07 })); },
  lever() {
    this.noise(0.25, { vol: 0.2, from: 400, to: 1800, q: 1 });
    this.tone(200, 0.2, { type: 'triangle', vol: 0.12, slideTo: 90 });
  },
  reelTick() { this.tone(1800 + Math.random() * 400, 0.025, { type: 'square', vol: 0.025 }); },
  reelStop(i) {
    this.tone(120 - i * 15, 0.15, { type: 'sine', vol: 0.35, slideTo: 60 });
    this.noise(0.06, { vol: 0.15, from: 2000, to: 600, q: 0.8 });
  },
  tension() { this.tone(300, 1.6, { type: 'sawtooth', vol: 0.04, slideTo: 900 }); },
  slotWin(big) {
    const notes = big ? [523, 659, 784, 1047, 784, 1047, 1319, 1568] : [659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.06, when: i * 0.085 }));
    for (let i = 0; i < (big ? 14 : 6); i++) this.tone(2000 + Math.random() * 2000, 0.08, { type: 'sine', vol: 0.04, when: 0.1 + i * 0.07 });
  },
  slotBust() {
    [392, 370, 349, 294].forEach((f, i) => this.tone(f, i === 3 ? 0.7 : 0.28, { type: 'triangle', vol: 0.1, when: i * 0.28, slideTo: i === 3 ? 260 : null }));
  },
  steal() {
    this.noise(0.4, { vol: 0.2, from: 6000, to: 800, q: 1.5 });
    this.tone(400, 0.35, { type: 'triangle', vol: 0.1, slideTo: 1600 });
  },
  boom() {
    this.tone(80, 0.8, { type: 'sine', vol: 0.5, slideTo: 25 });
    this.noise(0.9, { vol: 0.4, from: 1200, to: 80, q: 0.5 });
  },
  heartbeat() {
    for (const t of [0, 0.22, 0.9, 1.12]) this.tone(70, 0.18, { type: 'sine', vol: 0.4, when: t, slideTo: 45 });
    this.tone(880, 0.5, { type: 'triangle', vol: 0.06, when: 0.05, slideTo: 1760 });
  },
  draw() {
    this.tone(260, 0.25, { type: 'square', vol: 0.05 });
    this.tone(196, 0.4, { type: 'square', vol: 0.05, when: 0.18 });
  },
};
