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
  ruleCard(fresh) {
    if (fresh) {
      [392, 523, 659, 880].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.05, when: i * 0.07 }));
      this.noise(0.6, { vol: 0.12, from: 500, to: 7000, q: 1.2 });
    } else {
      this.tone(523, 0.18, { type: 'triangle', vol: 0.08 });
      this.tone(784, 0.25, { type: 'triangle', vol: 0.08, when: 0.1 });
    }
  },
  shift() {
    this.noise(0.45, { vol: 0.22, from: 300, to: 3000, q: 1.4 });
    this.tone(220, 0.35, { type: 'sawtooth', vol: 0.05, slideTo: 440 });
    this.tone(90, 0.3, { type: 'sine', vol: 0.3, when: 0.25, slideTo: 50 });
  },
  wild() {
    [1319, 1568, 1976, 2637].forEach((f, i) => this.tone(f, 0.14, { type: 'sine', vol: 0.05, when: i * 0.05 }));
  },
  cardFlip(i = 0) {
    this.noise(0.08, { vol: 0.1, from: 2000 + i * 300, to: 5000, q: 1 });
    this.tone(600 + i * 90, 0.06, { type: 'triangle', vol: 0.05 });
  },
  cardPick() {
    this.tone(523, 0.12, { type: 'square', vol: 0.06 });
    this.tone(1047, 0.35, { type: 'square', vol: 0.06, when: 0.1 });
    this.noise(0.5, { vol: 0.12, from: 3000, to: 9000 });
  },
  // Driving percussive loop while the reels spin (synthesized: kick, clap, hats, bass, stabs).
  startMusic() {
    this.stopMusic();
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const m = { n: 0, next: ctx.currentTime + 0.05, intense: 0, timer: null };
    this.music = m;
    const BASS = [0, 0, 12, 0, 0, 10, 0, 7, 0, 0, 12, 0, 3, 0, 5, 7];   // semitones over A1
    const STAB = { 2: 12, 6: 15, 10: 12, 14: 19 };
    const sched = (n, t) => {
      const when = Math.max(0, t - ctx.currentTime);
      const s = n % 16, bar = Math.floor(n / 16);
      const hot = m.intense;
      // kick: four on the floor, doubled when the wind-up is on
      if (s % 4 === 0 || (hot && s % 2 === 0)) this.tone(120, 0.16, { type: 'sine', vol: 0.42, when, slideTo: 42 });
      // clap on 2 and 4
      if (s === 4 || s === 12) { this.noise(0.13, { vol: 0.22, from: 1700, to: 1100, q: 0.8, when }); this.noise(0.05, { vol: 0.12, from: 3000, to: 2500, when: when + 0.012 }); }
      // hats: 16ths, open on the offbeat
      this.noise(s % 4 === 2 ? 0.09 : 0.03, { vol: s % 4 === 2 ? 0.08 : 0.045, from: 7500, to: 9500, q: 1.6, when });
      // tom fill at the end of every second bar
      if (bar % 2 === 1 && s >= 13) this.tone(200 - (s - 13) * 35, 0.14, { type: 'sine', vol: 0.3, when, slideTo: 80 });
      // bass
      const f = 55 * Math.pow(2, (BASS[s] + (hot ? 5 : 0)) / 12);
      this.tone(f, 0.11, { type: 'sawtooth', vol: 0.07, when });
      this.tone(f, 0.11, { type: 'square', vol: 0.03, when });
      // bright stabs
      if (STAB[s] !== undefined) this.tone(440 * Math.pow(2, (STAB[s] + (hot ? 5 : 0)) / 12), 0.09, { type: 'square', vol: 0.035, when });
    };
    m.timer = setInterval(() => {
      if (this.music !== m) return;
      const step = 60 / (m.intense ? 168 : 148) / 4;
      while (m.next < ctx.currentTime + 0.15) { sched(m.n, m.next); m.next += step; m.n++; }
    }, 25);
  },
  musicIntensity(v) { if (this.music) this.music.intense = v; },
  stopMusic() {
    if (!this.music) return;
    clearInterval(this.music.timer);
    this.music = null;
    // final hit
    this.tone(110, 0.4, { type: 'sine', vol: 0.4, slideTo: 40 });
    this.noise(0.4, { vol: 0.15, from: 6000, to: 2000, q: 0.7 });
  },
  // Rising wind-up whine for an INSTANT WIN tease on the first reel.
  windup(dur) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(1400, t0 + dur);
    lfo.frequency.setValueAtTime(5, t0);
    lfo.frequency.linearRampToValueAtTime(22, t0 + dur);
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(gain.gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.06, t0 + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.15);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t0); lp.frequency.exponentialRampToValueAtTime(6000, t0 + dur);
    osc.connect(lp).connect(gain).connect(ctx.destination);
    osc.start(t0); lfo.start(t0); osc.stop(t0 + dur + 0.2); lfo.stop(t0 + dur + 0.2);
    this.noise(dur, { vol: 0.12, from: 300, to: 8000, q: 2 });
  },
  fireworks() {
    for (let i = 0; i < 7; i++) {
      const w = 0.15 + i * 0.32 + Math.random() * 0.1;
      this.tone(500 + Math.random() * 300, 0.3, { type: 'sine', vol: 0.05, when: w - 0.25, slideTo: 1800 });
      this.noise(0.5, { vol: 0.28, from: 3000, to: 300, q: 0.5, when: w });
      for (let k = 0; k < 5; k++) this.noise(0.04, { vol: 0.08, from: 6000, to: 8000, q: 2, when: w + 0.15 + k * 0.06 + Math.random() * 0.05 });
    }
  },
  draw() {
    this.tone(260, 0.25, { type: 'square', vol: 0.05 });
    this.tone(196, 0.4, { type: 'square', vol: 0.05, when: 0.18 });
  },
};
