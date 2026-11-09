'use strict';
// Big "return to the board" explosion: a chain of fireballs with shockwaves, smoke, debris,
// a white flash, screen shake and deep sub-bass booms. Used when the Mystery Jackpot or the
// Wheel of Games closes.
const Boom = {
  run(rect) {
    const W = window.innerWidth, H = window.innerHeight;
    const r = rect && rect.width ? rect : { left: W * 0.2, top: H * 0.2, width: W * 0.6, height: H * 0.6 };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const cv = document.createElement('canvas');
    cv.className = 'boomfx';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the chain: the centre goes first and biggest, then blasts ripple out around the panel's edges
    const blasts = [{ x: cx, y: cy, t: 0, s: 1.25 }];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      blasts.push({ x: cx + Math.cos(a) * r.width * (0.3 + Math.random() * 0.2), y: cy + Math.sin(a) * r.height * (0.3 + Math.random() * 0.2), t: TIMING.boom.blastFirst + i * TIMING.boom.blastGap + Math.random() * 60, s: 0.55 + Math.random() * 0.35 });
    }
    const base = Math.min(W, H) * 0.28;
    const parts = [];
    const t0 = performance.now();
    blasts.forEach((b, i) => {
      b.done = false;
      setTimeout(() => {
        Sound.bigBoom && Sound.bigBoom(i === 0 ? 1 : b.s * 0.7, i);
        b.fired = performance.now();
        // debris sparks and smoke puffs
        for (let k = 0; k < 26 * b.s; k++) {
          const a = Math.random() * Math.PI * 2, v = (200 + Math.random() * 650) * b.s;
          parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 500 + Math.random() * 700, b: performance.now(), kind: 'spark', hue: 20 + Math.random() * 40 });
        }
        for (let k = 0; k < 9 * b.s; k++) {
          const a = Math.random() * Math.PI * 2, v = (40 + Math.random() * 120) * b.s;
          parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 1100 + Math.random() * 600, b: performance.now(), kind: 'smoke', r: base * b.s * (0.25 + Math.random() * 0.2) });
        }
      }, b.t);
    });
    // screen shake + flash
    const shake = [];
    for (let k = 0; k < 14; k++) { const m = 16 * (1 - k / 14); shake.push({ transform: `translate(${(Math.random() - 0.5) * 2 * m}px, ${(Math.random() - 0.5) * 2 * m}px)` }); }
    shake.push({ transform: 'translate(0,0)' });
    const app = document.querySelector('#app') || document.querySelector('main') || document.body;
    app.animate(shake, { duration: TIMING.boom.shake, easing: 'linear' });
    let last = t0;
    const tick = (now) => {
      const dt = Math.min(50, now - last) / 1000; last = now;
      const T = now - t0;
      ctx.clearRect(0, 0, W, H);
      // flash
      const fl = Math.max(0, 1 - T / 260);
      if (fl > 0) { ctx.fillStyle = `rgba(255, 245, 220, ${fl * 0.75})`; ctx.fillRect(0, 0, W, H); }
      ctx.globalCompositeOperation = 'source-over';
      // smoke first (under the fire)
      for (const p of parts) {
        if (p.kind !== 'smoke') continue;
        const k = Math.max(0, (now - p.b) / p.life); if (k >= 1) continue;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy = p.vy * 0.96 - 18 * dt;
        const rr = p.r * (0.6 + k * 1.2);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        g.addColorStop(0, `rgba(60, 40, 70, ${0.45 * (1 - k)})`); g.addColorStop(1, 'rgba(30,20,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      let alive = false;
      for (const b of blasts) {
        if (!b.fired) { alive = true; continue; }
        const k = Math.max(0, (now - b.fired) / 900); if (k >= 1) continue; alive = true;
        const R = base * b.s * (0.25 + Math.pow(k, 0.45) * 0.9);
        const a = 1 - k;
        // fireball
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R);
        g.addColorStop(0, `rgba(255, 255, 235, ${a})`); g.addColorStop(0.25, `rgba(255, 210, 90, ${a * 0.9})`);
        g.addColorStop(0.55, `rgba(255, 90, 40, ${a * 0.6})`); g.addColorStop(1, 'rgba(160, 20, 80, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 6.283); ctx.fill();
        // shockwave ring
        const sr = base * b.s * (0.3 + k * 2.4);
        ctx.strokeStyle = `rgba(255, 220, 180, ${0.6 * a * a})`; ctx.lineWidth = 3 + 10 * a;
        ctx.beginPath(); ctx.arc(b.x, b.y, sr, 0, 6.283); ctx.stroke();
      }
      for (const p of parts) {
        if (p.kind !== 'spark') continue;
        const k = Math.max(0, (now - p.b) / p.life); if (k >= 1) continue; alive = true;
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= 0.985;
        ctx.strokeStyle = `hsla(${p.hue}, 100%, ${60 + 30 * (1 - k)}%, ${1 - k})`; ctx.lineWidth = 2.5 * (1 - k) + 0.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      }
      if (parts.some((p) => p.kind === 'smoke' && now - p.b < p.life)) alive = true;
      ctx.globalCompositeOperation = 'source-over';
      if (alive || T < 400) requestAnimationFrame(tick); else cv.remove();
    };
    requestAnimationFrame(tick);
  },
};

// ---- shared particle layer for dust clouds and rocket exhaust ----
const Fx = {
  cv: null, ctx: null, parts: [], raf: 0, emitters: [],
  ensure() {
    if (this.cv) return;
    this.cv = document.createElement('canvas'); this.cv.className = 'boomfx';
    document.body.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.resize();
  },
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  add(p) { this.ensure(); p.b = performance.now(); this.parts.push(p); this.run(); },
  emit(fn, dur) { this.ensure(); this.emitters.push({ fn, end: performance.now() + dur }); this.run(); },
  run() {
    if (this.raf) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(50, now - last) / 1000; last = now;
      this.emitters = this.emitters.filter((e) => { if (now > e.end) return false; e.fn(now, dt); return true; });
      const ctx = this.ctx; ctx.clearRect(0, 0, this.W, this.H);
      this.parts = this.parts.filter((p) => now - p.b < p.life);
      for (const p of this.parts) {
        const k = Math.max(0, (now - p.b) / p.life);
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= p.drag || 0.92; p.vy = p.vy * (p.drag || 0.92) + (p.g || 0) * dt;
        const r = p.r0 + (p.r1 - p.r0) * Math.pow(k, 0.6);
        ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
        const a = p.a * (1 - k) * Math.min(1, k * 8 + 0.3);
        if (!Number.isFinite(p.x + p.y + r) || r <= 0) { p.life = 0; continue; }   // e.g. spawned from a hidden element
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(${p.c},${a})`); g.addColorStop(0.6, `rgba(${p.c},${a * 0.5})`); g.addColorStop(1, `rgba(${p.c},0)`);
        ctx.fillStyle = g;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, p.sy || 1); ctx.translate(-p.x, -p.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill(); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (this.parts.length || this.emitters.length) this.raf = requestAnimationFrame(tick);
      else { this.raf = 0; this.cv.remove(); this.cv = null; }
    };
    this.raf = requestAnimationFrame(tick);
  },
  // a squat cloud of dust billowing out on every side of a round base sitting on the isometric floor
  // f = { cx, cy, rx, ry } : the base's ellipse in screen space
  dust(f, power = 1) {
    const K = f.ry / f.rx;
    for (let i = 0; i < 70 * power; i++) {
      const a = Math.random() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const sp = f.rx * (0.9 + Math.random() * 1.3) * power;
      const shade = 150 + Math.random() * 60 | 0;
      this.add({ x: f.cx + c * f.rx * 0.95, y: f.cy + s * f.ry * 0.95, vx: c * sp, vy: s * sp * K - Math.random() * f.rx * 0.25,
        r0: f.rx * 0.08, r1: f.rx * (0.18 + Math.random() * 0.16), c: `${shade + 40},${shade + 20},${shade}`, a: s < 0 ? 0.4 : 0.6,
        life: 1100 + Math.random() * 1000, drag: 0.93, g: 25, sy: 0.65 });
    }
    // chunks of debris kicked up all round
    for (let i = 0; i < 26 * power; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ x: f.cx + Math.cos(a) * f.rx, y: f.cy + Math.sin(a) * f.ry, vx: Math.cos(a) * f.rx * 1.4, vy: Math.sin(a) * f.ry * 1.4 - f.rx * (1 + Math.random()),
        r0: 3, r1: 2, c: '120,90,70', a: 1, life: 750, drag: 0.985, g: 1900 });
    }
  },
  // jets of fire squirting out horizontally from every side of the base
  flameRing(f, n, power = 1) {
    const K = f.ry / f.rx;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const sp = f.rx * (1.6 + Math.random() * 1.6) * power;
      this.add({ x: f.cx + c * f.rx, y: f.cy + s * f.ry, vx: c * sp, vy: s * sp * K, r0: f.rx * 0.09, r1: f.rx * (0.2 + Math.random() * 0.1),
        c: Math.random() < 0.35 ? '255,240,170' : Math.random() < 0.6 ? '255,170,60' : '255,90,30', a: 0.95, life: 220 + Math.random() * 220, drag: 0.9, add: true, sy: 0.7 });
    }
    if (Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      this.add({ x: f.cx + Math.cos(a) * f.rx * 1.2, y: f.cy + Math.sin(a) * f.ry * 1.2, vx: Math.cos(a) * f.rx * 0.6, vy: Math.sin(a) * f.ry * 0.6 - 30,
        r0: f.rx * 0.1, r1: f.rx * 0.3, c: '190,180,195', a: 0.35, life: 1300, drag: 0.95, g: -15, sy: 0.7 });
    }
  },
};

// ---- the picked game's icon: lifted from the Rule Pick card to centre stage, then landed on the title card ----
const IconFly = {
  el: null, idle: null,
  lift(src) {
    this.drop();
    if (!src || !src.animate) return;
    const r = src.getBoundingClientRect(), fs = parseFloat(getComputedStyle(src).fontSize) || 54;
    const BASE = 120, el = document.createElement('div');
    el.className = 'iconfly'; el.innerHTML = src.innerHTML.trim();
    el.style.fontSize = `${BASE}px`;
    document.body.appendChild(el);
    const W = window.innerWidth, H = window.innerHeight;
    const big = Math.min(W, H) * 0.32 / BASE;
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    src.style.visibility = 'hidden';
    this.el = el; this.x = W / 2; this.y = H * 0.45; this.s = big;
    el.animate([
      { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(${fs / BASE})`, filter: 'brightness(1)' },
      { transform: `translate(${x0}px, ${y0 - 30}px) translate(-50%, -50%) scale(${(fs / BASE) * 1.4}) rotate(-10deg)`, filter: 'brightness(1.6)', offset: 0.3 },
      { transform: `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${big * 1.15}) rotate(8deg)`, filter: 'brightness(1.3)', offset: 0.8 },
      { transform: `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${big}) rotate(0)`, filter: 'brightness(1)' },
    ], { duration: TIMING.ruleCard.iconLift, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => {
      if (this.el !== el) return;
      this.idle = el.animate([
        { transform: `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${big}) rotate(-4deg)` },
        { transform: `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${big * 1.08}) rotate(4deg)` },
      ], { duration: TIMING.ruleCard.iconIdle, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    };
  },
  // fly the big icon onto the title card's icon once the card has popped in
  land(target, wait = TIMING.ruleCard.iconLandDelay) {
    const el = this.el; if (!el) return;
    if (target) target.style.visibility = 'hidden';
    setTimeout(() => {
      if (this.el !== el) return;
      if (!target || !target.isConnected) { this.drop(); return; }
      const t = target.getBoundingClientRect(), fs = parseFloat(getComputedStyle(target).fontSize) || 56;
      const tx = t.left + t.width / 2, ty = t.top + t.height / 2, ts = fs / 120;
      if (this.idle) this.idle.cancel();
      Sound.whoosh && Sound.whoosh();
      el.animate([
        { transform: `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${this.s})` },
        { transform: `translate(${(this.x + tx) / 2}px, ${Math.min(this.y, ty) - 60}px) translate(-50%, -50%) scale(${this.s * 0.7}) rotate(200deg)`, offset: 0.5 },
        { transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(${ts}) rotate(360deg)` },
      ], { duration: TIMING.ruleCard.iconLand, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).onfinish = () => {
        target.style.visibility = '';
        target.animate([{ transform: 'scale(1.6)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: TIMING.ruleCard.iconBounce, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        Sound.cardPick && Sound.cardPick();
        this.drop();
      };
    }, wait);
  },
  drop() { if (this.el) this.el.remove(); this.el = null; this.idle = null; },
};
