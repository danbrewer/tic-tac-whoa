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
      const len = this.ctx.sampleRate * 4;
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
      if (m.mute) return;
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
  // INSTANT WIN streak grows: a rising stab chord + boom, bigger each reel
  lockIn(n) {
    const base = 523 * Math.pow(2, ((n - 2) * 3) / 12);
    [0, 4, 7, 12].forEach((st, i) => this.tone(base * Math.pow(2, st / 12), 0.28 + n * 0.04, { type: 'square', vol: 0.045 + n * 0.008, when: i * 0.035 }));
    this.tone(70, 0.5, { type: 'sine', vol: 0.3 + n * 0.05, slideTo: 32 });
    this.noise(0.35 + n * 0.08, { vol: 0.12 + n * 0.04, from: 9000, to: 1500, q: 0.6 });
    if (n >= 3) for (let k = 0; k < n * 3; k++) this.tone(1800 + Math.random() * 2400, 0.07, { type: 'sine', vol: 0.035, when: 0.08 + k * 0.045 });
  },
  streakBreak() {
    this.tone(330, 0.5, { type: 'triangle', vol: 0.09, slideTo: 140 });
  },
  musicMute(on) { if (this.music) this.music.mute = on; },
  // Snare roll that speeds up and swells, for the deciding reel.
  drumroll(dur) {
    if (!this.on || !this.ctx) return;
    let t = 0, k = 0;
    while (t < dur) {
      const q = t / dur;
      this.noise(0.07, { vol: 0.06 + 0.22 * q, from: 2200, to: 1400, q: 0.9, when: t });
      t += 0.11 - 0.075 * q; k++;
    }
    this.tone(55, dur, { type: 'sine', vol: 0.18, slideTo: 82 });
    this.tone(220, dur, { type: 'sawtooth', vol: 0.025, slideTo: 440 });
  },
  // Wheel of Games: a creaky pull-back, the launch whoosh, and a clack per peg that gets
  // louder and lower as the wheel slows (q = 0 fast .. 1 nearly stopped)
  wheelPull(dur) {
    this.tone(260, dur, { type: 'triangle', vol: 0.08, slideTo: 140 });
    this.noise(dur, { vol: 0.07, from: 600, to: 250, q: 3 });
  },
  wheelLaunch() {
    this.noise(0.45, { vol: 0.25, from: 300, to: 5000, q: 0.9 });
    this.tone(90, 0.35, { type: 'sine', vol: 0.3, slideTo: 220 });
  },
  wheelClack(q) {
    this.tone(2200 - q * 1100, 0.03 + q * 0.03, { type: 'square', vol: 0.025 + q * 0.05 });
    if (q > 0.5) this.tone(180 - q * 60, 0.06, { type: 'sine', vol: 0.12 * q });
  },
  // Deep, layered explosion: sub-bass drop, low rumble and a crack. i staggers the pitch lower each time.
  bigBoom(size = 1, i = 0) {
    if (!this.on || !this.ctx) return;
    const f = 62 - Math.min(i, 6) * 4;
    this.tone(f, 1.4 * size + 0.4, { type: 'sine', vol: 0.55 * Math.min(1, size + 0.2), slideTo: 18 });
    this.tone(f * 0.62, 1.8 * size + 0.4, { type: 'triangle', vol: 0.35 * size, slideTo: 14 });
    this.noise(1.6 * size + 0.4, { vol: 0.5 * size, from: 260, to: 28, q: 0.35 });
    this.noise(0.35, { vol: 0.28 * size, from: 3200, to: 300, q: 0.6 });
    if (i === 0) this.tone(34, 2.4, { type: 'sine', vol: 0.5, when: 0.05, slideTo: 16 });
  },
  // one "lub-dub" heartbeat; v is loudness 0..1, gap shortens as the heart races
  heartPulse(v = 0.5, gap = 0.16) {
    const vol = 0.25 + v * 0.4;
    this.tone(62, 0.16, { type: 'sine', vol, slideTo: 38 });
    this.tone(124, 0.06, { type: 'triangle', vol: vol * 0.25, slideTo: 60 });
    this.tone(52, 0.14, { type: 'sine', vol: vol * 0.75, when: gap, slideTo: 34 });
  },
  // filtered noise with an attack/hold/release envelope and a sweeping cutoff (for roars and rumbles)
  roar(dur, { type = 'lowpass', from = 200, to = 2000, vol = 0.5, attack = 0.2, release = 0.6, when = 0, q = 0.7 } = {}) {
    if (!this.on || !this.ctx) return;
    this.noise(0.001, { vol: 0.0002 }); // makes sure the shared noise buffer exists
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  },
  // deep "brown" noise (random walk) — the rumbling body of a rocket engine, with no pitch at all
  brownBuf() {
    if (this._brown) return this._brown;
    const len = this.ctx.sampleRate * 4, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    let y = 0;
    for (let i = 0; i < len; i++) { y = (y + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = y * 3.5; }
    return (this._brown = b);
  },
  // unpitched engine roar: brown noise -> lowpass -> soft saturation -> envelope
  engine(dur, { cut = 180, cutTo = cut, vol = 0.6, attack = 0.3, release = 1.5, when = 0, drive = 2 } = {}) {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(); src.buffer = this.brownBuf(); src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.5;
    f.frequency.setValueAtTime(cut, t0); f.frequency.exponentialRampToValueAtTime(cutTo, t0 + dur);
    const ws = this.ctx.createWaveShaper(), c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * drive); }
    ws.curve = c;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(ws).connect(g).connect(this.ctx.destination);
    src.start(t0, Math.random() * 2); src.stop(t0 + dur + 0.05);
  },
  // the sharp popping crackle of rocket exhaust
  crackle(dur, { rate = 60, vol = 0.12, when = 0 } = {}) {
    for (let t = 0; t < dur; t += (Math.random() * 2) / rate) {
      const k = 1 - t / dur;
      this.noise(0.012 + Math.random() * 0.02, { vol: vol * k * (0.4 + Math.random()), from: 900 + Math.random() * 2500, to: 600, q: 1.5, when: when + t });
    }
  },
  // the engines building while the wheel squirts flames before lift-off
  rocketRumble(dur) {
    this.engine(dur + 0.2, { cut: 90, cutTo: 260, vol: 0.55, attack: dur * 0.85, release: 0.15 });
    this.crackle(dur, { rate: 25, vol: 0.06 });
  },
  // LIFT-OFF, space-shuttle style: a huge unpitched roar — a deep sub rumble, a thick low-mid body,
  // a hissy top and crackle — swelling in, holding, then fading as the wheel climbs away
  liftoff() {
    if (!this.on || !this.ctx) return;
    this.roar(0.5, { type: 'lowpass', from: 300, to: 60, vol: 0.7, attack: 0.01, release: 0.45, q: 0.7 }); // ignition thump
    this.engine(4.2, { cut: 110, cutTo: 70, vol: 0.85, attack: 0.25, release: 2.4, drive: 2.5 });           // sub rumble
    this.engine(3.8, { cut: 420, cutTo: 200, vol: 0.4, attack: 0.15, release: 2.2, drive: 3 });             // low-mid body
    this.roar(3.2, { type: 'lowpass', from: 1400, to: 500, vol: 0.18, attack: 0.1, release: 2.0, q: 0.5 }); // roar air
    this.roar(2.4, { type: 'highpass', from: 3500, to: 2500, vol: 0.06, attack: 0.05, release: 1.6 });     // hiss
    this.crackle(2.8, { rate: 70, vol: 0.13, when: 0.1 });
  },
  rocket() { this.liftoff(); },
  whoosh() { this.noise(0.6, { vol: 0.25, from: 300, to: 3500, q: 0.7 }); },
  boomSmall() {
    this.tone(90, 0.35, { type: 'sine', vol: 0.3, slideTo: 35 });
    this.noise(0.3, { vol: 0.18, from: 2500, to: 200, q: 0.5 });
  },
  // Triumphant brass fanfare with drums for an INSTANT WIN.
  fanfare() {
    if (!this.on || !this.ctx) return;
    const brass = (f, when, dur, vol = 0.05) => {
      this.tone(f, dur, { type: 'sawtooth', vol, when });
      this.tone(f * 1.005, dur, { type: 'sawtooth', vol: vol * 0.8, when });
      this.tone(f / 2, dur, { type: 'square', vol: vol * 0.5, when });
    };
    const N = [[392, 0, 0.14], [392, 0.17, 0.14], [392, 0.34, 0.14], [523, 0.51, 0.45], [466, 1.0, 0.22], [523, 1.25, 0.16], [587, 1.43, 0.16], [659, 1.61, 0.2]];
    N.forEach(([f, w, d]) => brass(f, w + 0.3, d));
    [523, 659, 784, 1047].forEach((f) => brass(f, 2.15, 1.4, 0.035));
    [0.3, 0.81, 1.3, 1.91, 2.15].forEach((w) => this.tone(110, 0.25, { type: 'sine', vol: 0.45, when: w, slideTo: 40 }));
    [0.64, 1.47].forEach((w) => this.noise(0.15, { vol: 0.25, from: 1800, to: 1200, q: 0.8, when: w }));
    this.noise(1.8, { vol: 0.2, from: 9000, to: 4000, q: 0.4, when: 2.15 });
    for (let k = 0; k < 10; k++) this.tone(1500 + Math.random() * 2500, 0.1, { type: 'sine', vol: 0.03, when: 2.2 + k * 0.08 });
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
