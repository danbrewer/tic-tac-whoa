'use strict';
// Tiny synthesized sound effects (Web Audio, no files needed).
// Every volume worth tuning is in js/sound-config.js (SOUND); this file is how the sounds are made.
const Sound = {
  ctx: null,
  on: true,
  // mix levels (0..1): sound effects and recorded voice-overs each get their own bus
  sfxVol: SOUND.mix.sfx,
  voiceVol: SOUND.mix.voice,
  // where an effect's layers connect: the effect's own gain while one is playing (see withGain), else the bus
  sfx() { return this._fxNode || this.bus('_sfxBus', this.sfxVol); },
  // run fn with everything it plays turned up or down by g (SOUND.effects); nested effects multiply
  withGain(g, fn) {
    if (!this.ctx || !this.on || g === 1) return fn();
    const prev = this._fxNode, node = this.ctx.createGain();
    node.gain.value = Math.max(0, g); node.connect(this.sfx());
    this._fxNode = node;
    try { return fn(); } finally { this._fxNode = prev; }
  },
  vox() { return this.bus('_voxBus', this.voiceVol); },
  bus(key, v) {
    const b = this[key];
    if (b && b.context === this.ctx) return b;
    const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.ctx.destination);
    return (this[key] = g);
  },
  setMix(sfx, voice) {
    if (sfx != null) this.sfxVol = Math.max(0, Math.min(1, sfx));
    if (voice != null) this.voiceVol = Math.max(0, Math.min(1, voice));
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (this._sfxBus && this._sfxBus.context === this.ctx) this._sfxBus.gain.setTargetAtTime(this.sfxVol, now, 0.03);
    if (this._voxBus && this._voxBus.context === this.ctx) this._voxBus.gain.setTargetAtTime(this.voiceVol, now, 0.03);
  },

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    // resume from any non-running state ('suspended', or Safari's 'interrupted')
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {});
    }
    // Safari only truly unlocks audio once a sound starts inside a user gesture: play one silent sample
    if (this.ctx) { this.loadVoice('instant-win'); Object.values(this.RULE_VOICES).forEach(n => this.loadVoice(n)); }
    if (this.ctx && !this._unlocked) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.ctx.createBuffer(1, 1, 22050);
        src.connect(this.ctx.destination); src.start(0);
        this._unlocked = true;
      } catch (e) { /* ignore */ }
    }
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
    osc.connect(gain).connect(this.sfx());
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
    src.connect(bp).connect(gain).connect(this.sfx());
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
  fog() {
    // a soft rush of air as the fog rolls over a mark
    this.noise(0.9, { vol: 0.09, from: 300, to: 1600, q: 0.5 });
    this.noise(0.7, { vol: 0.05, from: 2400, to: 900, q: 0.6, when: 0.15 });
  },
  fogLift() {
    // a long airy exhale rising in pitch as the fog burns off, with a soft shimmer
    this.noise(1.6, { vol: 0.12, from: 500, to: 5000, q: 0.5 });
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, { type: 'sine', vol: 0.035, when: 0.35 + i * 0.12 }));
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
      while (m.next < ctx.currentTime + 0.15) { this.withGain(SOUND.effects.music, () => sched(m.n, m.next)); m.next += step; m.n++; }
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
    osc.connect(lp).connect(gain).connect(this.sfx());
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
  // Wheel of Games: a creaky pull-back, the launch whoosh, and a clack per peg (all at the same
  // loudness, set in SOUND.wheelClack)
  wheelPull(dur) {
    this.tone(260, dur, { type: 'triangle', vol: 0.08, slideTo: 140 });
    this.noise(dur, { vol: 0.07, from: 600, to: 250, q: 3 });
  },
  wheelLaunch() {
    this.noise(0.45, { vol: 0.25, from: 300, to: 5000, q: 0.9 });
    this.tone(90, 0.35, { type: 'sine', vol: 0.3, slideTo: 220 });
  },
  wheelClack() {
    const c = SOUND.wheelClack;
    this.tone(c.pitch, c.length, { type: 'square', vol: c.vol });
    this.tone(c.thumpPitch, c.length * 1.5, { type: 'sine', vol: c.thumpVol });
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
  // one "lub-dub" heartbeat; v = 0 (slowest, SOUND.heartbeat.quiet) .. 1 (fastest, .loud);
  // gap = seconds between "lub" and "dub" (from TIMING.wheel, it shortens as the heart races)
  heartPulse(v = 0.5, gap = 0.16) {
    const H = SOUND.heartbeat, vol = H.quiet + (H.loud - H.quiet) * Math.max(0, Math.min(1, v));
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
    src.connect(f).connect(g).connect(this.sfx());
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
    src.connect(f).connect(ws).connect(g).connect(this.sfx());
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
  // a send to a shared echo (feedback delay) for big, cavernous hits
  echoBus() {
    if (this._echo) return this._echo;
    const ctx = this.ctx, inp = ctx.createGain(), d = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    d.delayTime.value = 0.23; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 2200;
    inp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.bus('_sfxBus', this.sfxVol));
    return (this._echo = inp);
  },
  // hydraulic ram: motor whine climbing in pitch, hissing fluid, and a pump thudding away
  // hydraulic lift: the electric pump motor spins up, holds a high strained whine (rising a little
  // as the load comes on) over a mains-motor buzz and fluid hiss, then spins down as it cuts out
  hydraulic(dur) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t0 = c.currentTime, up = 0.35, down = 0.4, end = t0 + dur;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(1, t0 + 0.08);
    out.gain.setValueAtTime(1, end); out.gain.exponentialRampToValueAtTime(0.0001, end + down);
    out.connect(this.sfx());
    const motor = (o, k) => {                         // spin-up, load, spin-down
      o.frequency.setValueAtTime(180 * k, t0);
      o.frequency.exponentialRampToValueAtTime(1350 * k, t0 + up);
      o.frequency.linearRampToValueAtTime(1600 * k, end - 0.05);
      o.frequency.exponentialRampToValueAtTime(260 * k, end + down);
    };
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 28; lg.gain.value = 12;
    lfo.connect(lg); lfo.start(t0); lfo.stop(end + down + 0.1);
    for (const [type, k, vol] of [['triangle', 1, 0.075], ['sawtooth', 1.003, 0.02], ['sine', 2.002, 0.022], ['sine', 0.5, 0.03]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; motor(o, k); lg.connect(o.frequency);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.value = 1500 * k;
      g.gain.value = vol; o.connect(bp).connect(g).connect(out); o.start(t0); o.stop(end + down + 0.1);
    }
    // mains-motor buzz underneath, following the spin-up and spin-down
    const bz = c.createOscillator(), bf = c.createBiquadFilter(), bg = c.createGain();
    bz.type = 'sawtooth'; bz.frequency.setValueAtTime(40, t0); bz.frequency.exponentialRampToValueAtTime(120, t0 + up);
    bz.frequency.setValueAtTime(120, end); bz.frequency.exponentialRampToValueAtTime(35, end + down);
    bf.type = 'lowpass'; bf.frequency.value = 900; bf.Q.value = 1.5; bg.gain.value = 0.07;
    bz.connect(bf).connect(bg).connect(out); bz.start(t0); bz.stop(end + down + 0.1);
    this.roar(dur, { type: 'bandpass', from: 2600, to: 3600, vol: 0.045, attack: 0.25, release: 0.3, q: 1.5 }); // fluid hiss
    this.noise(0.25, { vol: 0.1, from: 4000, to: 1500, q: 1, when: 0 });                                   // valve opening
  },
  // ---- recorded voice-overs, played through a big concert-hall reverb so they BOOM
  voices: {},
  hallIR(big = false) {
    const key = big ? '_hallBig' : '_hall';
    if (this[key] && this[key].ctx === this.ctx) return this[key].buf;
    // synthetic impulse response: stereo noise with an exponential decay, darker as it fades
    // (2.8 s for the mode voices, the original 4.2 s for the big Instant Win hall)
    const sr = this.ctx.sampleRate, len = Math.floor(sr * (big ? 4.2 : 2.8)), buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr, k = Math.min(0.92, 0.25 + t * 0.2);   // low-pass gets heavier over time
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = lp * Math.pow(1 - i / len, big ? 2.2 : 2.8) * (t < 0.03 ? t / 0.03 : 1) * 2.2;
      }
    }
    this[key] = { ctx: this.ctx, buf };
    return buf;
  },
  // fetch + decode a voice file once (needs the game served over http; file:// falls back below)
  loadVoice(name) {
    if (this.voices[name] !== undefined || !this.ctx || location.protocol === 'file:') return;
    this.voices[name] = null;
    fetch(`media/soundfx/${name}.mp3`).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
      .then(buf => {
        // level-match every voice-over: scale each recording to the same loudness (RMS over its
        // voiced parts), so one announcer is never noticeably louder than another
        let sum = 0, n = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < d.length; i += 4) { const v = d[i]; if (Math.abs(v) > 0.02) { sum += v * v; n++; } }
        }
        const rms = n ? Math.sqrt(sum / n) : 0;
        this.voiceNorm = this.voiceNorm || {};
        this.voiceNorm[name] = rms > 0.005 ? Math.max(0.25, Math.min(3, 0.12 / rms)) : 1;
        this.voices[name] = buf;
      })
      .catch(() => { this.voices[name] = false; });
  },
  voice(name, { when = 0, style = 'hall' } = {}) {
    if (!this.on) return;
    this.ensure();
    const buf = this.ctx && this.voices[name];
    if (buf && style === 'pa') { this.paVoice(buf, when); return; }
    if (buf) {
      const c = this.ctx, t0 = c.currentTime + when, src = c.createBufferSource(); src.buffer = buf;
      // deepen and fatten the voice, then send it into the hall
      const low = c.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 160; low.gain.value = 7;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.2;
      const big = style === 'big';   // Instant Win only: the original huge hall
      const dry = c.createGain(); dry.gain.value = big ? 0.95 : 1;
      const pre = c.createDelay(0.2); pre.delayTime.value = 0.045;
      const conv = c.createConvolver(); conv.buffer = this.hallIR(big);
      const wet = c.createGain(); wet.gain.value = big ? 0.85 : 0.45;
      // slap-back echoes off the far walls of the hall
      const slap = c.createDelay(1); slap.delayTime.value = big ? 0.32 : 0.28; const sg = c.createGain(); sg.gain.value = big ? 0.32 : 0.16;
      const slp = c.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 1800;
      const norm = c.createGain(); norm.gain.value = ((this.voiceNorm && this.voiceNorm[name]) || 1) * this.voiceGain(name);
      src.connect(norm).connect(low).connect(comp);
      comp.connect(dry).connect(this.vox());
      comp.connect(pre).connect(conv).connect(wet).connect(this.vox());
      comp.connect(slap); slap.connect(slp).connect(sg); sg.connect(slap); sg.connect(conv); sg.connect(this.vox());
      src.start(t0);
      return;
    }
    // no Web Audio copy (e.g. opened straight from disk): play the file as-is, preferring a pre-made hall version
    const play = (files) => {
      if (!files.length) return;
      const a = new Audio(`media/soundfx/${files[0]}.mp3`); a.volume = Math.min(1, this.voiceVol * this.voiceGain(name));
      a.onerror = () => play(files.slice(1));
      setTimeout(() => { const p = a.play(); if (p && p.catch) p.catch(() => {}); }, when * 1000);
    };
    play([`${name}-${style === 'big' ? 'hall' : style}`, name]);
  },
  // SOUND.voices: how loud this recording plays, on top of the voice slider
  voiceGain(name) { return name === 'instant-win' ? SOUND.voices.instantWin : SOUND.voices.rules; },
  // a booming announcer over a stadium PA: horn-speaker band-limiting, a little amp grit, and
  // discrete echoes bouncing back off the far stands, all feeding a big hall
  paVoice(buf, when = 0) {
    const c = this.ctx, t0 = c.currentTime + when, src = c.createBufferSource(); src.buffer = buf;
    const out = c.createGain(); out.gain.value = 0.5 * SOUND.voices.rules; out.connect(this.vox());   // headroom: echoes stack up
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180; hp.Q.value = 0.8;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.9;
    const horn = c.createBiquadFilter(); horn.type = 'peaking'; horn.frequency.value = 1700; horn.Q.value = 1.2; horn.gain.value = 6;
    const body = c.createBiquadFilter(); body.type = 'lowshelf'; body.frequency.value = 260; body.gain.value = 5;
    const drive = c.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    drive.curve = curve; drive.oversample = '2x';
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    src.connect(hp).connect(body).connect(horn).connect(drive).connect(lp).connect(comp);
    const dry = c.createGain(); dry.gain.value = 0.9; comp.connect(dry).connect(out);
    // stadium echoes: each bounce later, quieter and duller, alternating left and right
    const conv = c.createConvolver(); conv.buffer = this.hallIR();
    const wet = c.createGain(); wet.gain.value = 0.55; conv.connect(wet).connect(out);
    comp.connect(conv);
    [[0.21, 0.5, -0.6, 2600], [0.43, 0.36, 0.6, 2000], [0.66, 0.25, -0.4, 1500], [0.9, 0.16, 0.4, 1100], [1.15, 0.1, 0, 900]].forEach(([d, g, pan, f]) => {
      const dl = c.createDelay(2); dl.delayTime.value = d;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f;
      const gg = c.createGain(); gg.gain.value = g;
      const pn = c.createStereoPanner ? c.createStereoPanner() : null;
      comp.connect(dl); dl.connect(fl).connect(gg);
      if (pn) { pn.pan.value = pan; gg.connect(pn).connect(out); } else gg.connect(out);
      gg.connect(conv);
    });
    src.start(t0);
  },
  // rule announcements (voice-overs in media/soundfx), all through the same big hall as INSTANT WIN
  RULE_VOICES: { gravity: 'gravity', vanish: 'vanishing-marks', misere: 'misere', shift: 'shifting-squares', wild: 'wild-square', classic: 'classic', fog: 'fog-of-war', ring: 'ring-spin', cross: 'crossfire' },
  hasRuleVoice(rule) { return !!this.RULE_VOICES[rule]; },
  ruleVoice(rule, when = 0.35) {
    const name = this.RULE_VOICES[rule];
    if (!name) return;
    // announced once per game: the wheel calls this before lift-off, so the rule card that follows stays quiet
    const now = performance.now(), at = (this._ruleVoiceAt || (this._ruleVoiceAt = {}));
    if (at[rule] && now - at[rule] < 9000) return;
    at[rule] = now;
    this.voice(name, { when });
  },
  gravityVoice(when) { this.ruleVoice('gravity', when); },   // same big-hall treatment as INSTANT WIN
  instantWin() { this.voice('instant-win', { when: 0.15, style: 'big' }); },

  // the board locking upright: a heavy metal CLUNK, a latch click and a ringing echo
  clunk() {
    if (!this.on || !this.ctx) return;
    const echo = this.echoBus(), t0 = this.ctx.currentTime;
    const hit = (freq, dur, vol, type = 'square') => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.sfx()); g.connect(echo);
      o.start(t0); o.stop(t0 + dur + 0.05);
    };
    hit(70, 0.35, 0.35, 'sine'); hit(140, 0.12, 0.12);                           // body of the clunk
    [523, 787, 1240, 1810].forEach((f, i) => hit(f, 0.6 - i * 0.1, 0.05, 'triangle')); // metal ring
    this.noise(0.12, { vol: 0.35, from: 1800, to: 400, q: 0.8 });
    this.noise(0.04, { vol: 0.25, from: 5000, to: 3000, q: 2, when: 0.09 }); // latch
    this.tone(1900, 0.05, { type: 'square', vol: 0.05, when: 0.09 });
    // the low-frequency BOOM of the lock seating home, with a sub drop that echoes away
    this.bigBoom(0.6, 0);
    const sub = this.ctx.createOscillator(), sg = this.ctx.createGain();
    sub.type = 'sine'; sub.frequency.setValueAtTime(48, t0); sub.frequency.exponentialRampToValueAtTime(24, t0 + 1.4);
    sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    sub.connect(sg); sg.connect(this.sfx()); sg.connect(echo); sub.start(t0); sub.stop(t0 + 1.7);
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

// SOUND.effects: wrap each named effect so everything it plays goes through a gain set to its number
// (looked up each time it plays). The music loop is scheduled on a timer, so startMusic applies
// SOUND.effects.music itself.
for (const name of Object.keys(SOUND.effects)) {
  if (name === 'music') continue;
  const fn = Sound[name];
  if (typeof fn !== 'function') { console.warn(`SOUND.effects.${name}: Sound has no such effect`); continue; }
  Sound[name] = function (...args) { return Sound.withGain(SOUND.effects[name], () => fn.apply(Sound, args)); };
}

// After a refresh the browser starts audio suspended until the player interacts with the page.
// Unlock (or re-wake) the audio context on every kind of gesture anywhere on the page, not just the
// board, and again whenever the page comes back into view, so sound that is toggled on stays on.
(() => {
  const wake = () => { if (Sound.on) Sound.ensure(); };
  for (const ev of ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click']) window.addEventListener(ev, wake, { capture: true, passive: true });
  const rewake = () => { if (Sound.ctx && Sound.ctx.state !== 'running' && Sound.ctx.state !== 'closed') { const p = Sound.ctx.resume(); if (p && p.catch) p.catch(() => {}); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rewake(); });
  window.addEventListener('pageshow', rewake);
  window.addEventListener('focus', rewake);
})();
