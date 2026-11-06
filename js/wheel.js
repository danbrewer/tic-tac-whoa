'use strict';
// Wheel of games: before each Level 0 game the last winner spins it to pick the game type.
// 24 spots: the six game types repeated four times, so equal odds and no two neighbours alike.
const WHEEL_TYPES = [
  { k: 'classic', label: 'CLASSIC', col: '#3a86ff', dark: '#1f5fd1' },
  { k: 'vanish', label: 'VANISH', col: '#8338ec', dark: '#5f1fc2' },
  { k: 'gravity', label: 'GRAVITY', col: '#0096c7', dark: '#006c94' },
  { k: 'shift', label: 'SHIFT', col: '#fb8500', dark: '#c95f00' },
  { k: 'wild', label: 'WILD', col: '#ff006e', dark: '#c4004f' },
  { k: 'misere', label: 'MISÈRE', col: '#06a77d', dark: '#037a5a' },
];
const WHEEL_SEGS = [];
for (let r = 0; r < 4; r++) WHEEL_TYPES.forEach((t) => WHEEL_SEGS.push({ ...t, alt: r % 2 }));
const WHEEL_K = ISO_Y / ISO_X;   // same squash as the isometric board
const LETTER_COLS = ['#ffe14d', '#ff7ac6', '#7fe3ff', '#9dff8a', '#ffb347', '#ffffff'];

const Wheel = {
  angle: 0,       // current rotation (radians); segment 0 starts at the pointer when angle = 0
  hit: -1,        // winning segment index once landed
  raf: 0,
  speed: 0,       // 0..1 how fast it's turning right now (drives streaks and bulbs)
  sus: 0,         // 0..1 suspense as it slows down
  under: -1,      // segment under the pointer while spinning
  sparks: [],     // little sparks thrown off the pointer, in wheel pixels
  lift: null,     // {t0, dur} while the winning wedge lifts out of the wheel

  canvas() { return document.querySelector('#wheel .wh-canvas'); },

  // Geometry of the isometric wheel inside its square canvas (W px): the disc lies flat like the
  // board, squashed by the board's iso ratio, with a gold slab underneath for thickness.
  geo(W) {
    const R = W * 0.47;
    return { W, R, r: R * 0.9, K: WHEEL_K, cx: W / 2, cy: W * 0.58, depth: W * 0.05, n: WHEEL_SEGS.length, seg: (Math.PI * 2) / WHEEL_SEGS.length };
  },

  // the wedge outline, label and icon drawn "flat" (pointing up from the origin): used for the lifted prize
  drawFlatWedge(ctx, i, g, glow, seg = g.seg) {
    const { r } = g, S = WHEEL_SEGS[i];
    const a0 = -Math.PI / 2 - seg / 2, a1 = a0 + seg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath();
    const gr = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.28, S.col); gr.addColorStop(1, S.col);
    ctx.save();
    ctx.shadowColor = '#ffe66b'; ctx.shadowBlur = glow;
    ctx.fillStyle = gr; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = Math.max(2, r * 0.015); ctx.lineJoin = 'round'; ctx.stroke();
    const half = Math.sin(seg / 2), fit = (rad) => 2 * rad * half * 0.72;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let rad = r * 0.9;
    const iconSz = Math.min(r * 0.16, fit(rad));
    ctx.font = `${Math.round(iconSz)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(RULES[S.k].icon, 0, -(rad - iconSz * 0.55));
    rad -= iconSz * 1.15;
    const letters = [...S.label], inner = r * 0.2;
    let k = 1;
    for (let t = 0; t < 12; t++) {
      let rr = rad;
      for (let q = 0; q < letters.length; q++) rr -= Math.min(r * 0.155, fit(rr)) * k * 0.95;
      if (rr >= inner) break;
      k *= 0.92;
    }
    letters.forEach((ch, q) => {
      const sz = Math.min(r * 0.155, fit(rad)) * k, y = -(rad - sz * 0.5);
      ctx.font = `700 ${Math.round(sz)}px Fredoka, ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, sz * 0.2); ctx.strokeStyle = 'rgba(30, 0, 50, 0.85)';
      ctx.strokeText(ch, 0, y);
      ctx.fillStyle = LETTER_COLS[(q + i) % LETTER_COLS.length];
      ctx.fillText(ch, 0, y);
      rad -= sz * 0.95;
    });
  },

  draw(now = performance.now()) {
    const cv = this.canvas();
    const css = cv.clientWidth;
    if (!css) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(css * dpr)) { cv.width = cv.height = Math.round(css * dpr); }
    const ctx = cv.getContext('2d');
    const g = this.geo(cv.width), { W, R, r, K, cx, cy, depth, n, seg } = g;
    const lifted = this.lift ? this.hit : -1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    // ground shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.filter = `blur(${Math.round(W * 0.02)}px)`;
    ctx.beginPath(); ctx.ellipse(cx, cy + depth + W * 0.02, R * 1.04, R * K * 1.04, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // slab side (thickness): a band from the face down to the base
    const side = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
    side.addColorStop(0, '#7a3d00'); side.addColorStop(0.35, '#d98a10'); side.addColorStop(0.55, '#ffd23f'); side.addColorStop(1, '#6b3300');
    ctx.fillStyle = side;
    ctx.beginPath(); ctx.ellipse(cx, cy + depth, R * 0.985, R * 0.985 * K, 0, 0, Math.PI); ctx.lineTo(cx - R * 0.985, cy); ctx.lineTo(cx + R * 0.985, cy); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - R * 0.985, cy, R * 1.97, depth);
    // bulbs along the front of the slab
    const rate = 140 - this.speed * 100;
    const blink = this.hit >= 0 ? Math.floor(now / 70) % 2 === 0 : this.sus > 0.55 ? Math.floor(now / (220 - this.sus * 120)) % 2 === 0 : null;
    for (let b = 0; b < 22; b++) {
      const a = Math.PI * (0.04 + (b / 21) * 0.92);
      const on = blink !== null ? blink : (Math.floor(now / rate) + b) % 2 === 0;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.985, cy + depth * 0.5 + Math.sin(a) * R * 0.985 * K, R * 0.014, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#fffbe0' : '#8a4a00';
      ctx.shadowColor = '#fff6c8'; ctx.shadowBlur = on ? R * 0.04 : 0;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // the face, drawn in the plane and squashed into the iso view
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, K);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
    const rim = ctx.createLinearGradient(-R, -R, R, R);
    rim.addColorStop(0, '#ffe66b'); rim.addColorStop(0.5, '#ff9f1c'); rim.addColorStop(1, '#ffd23f');
    ctx.fillStyle = rim; ctx.fill();
    for (let i = 0; i < n; i++) {
      // segment 0 starts at the pointer, which sits at the FRONT of the wheel (+90°)
      const a0 = Math.PI / 2 + this.angle + i * seg, a1 = a0 + seg;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath();
      if (i === lifted) {
        // the slot left behind by the lifted wedge
        ctx.fillStyle = '#1a0630'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = R * 0.01; ctx.stroke();
        continue;
      }
      const gr = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
      const sc = WHEEL_SEGS[i].alt ? WHEEL_SEGS[i].dark : WHEEL_SEGS[i].col;
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.28, sc); gr.addColorStop(1, sc);
      ctx.fillStyle = gr; ctx.fill();
      if (this.hit < 0 && this.under === i && this.sus > 0) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.3 * this.sus})`; ctx.fillRect(-R, -R, W, W);
        ctx.restore();
      } else if (this.hit < 0 && this.sus > 0.3) {
        ctx.fillStyle = `rgba(10,0,30,${(this.sus - 0.3) * 0.35})`; ctx.fill();
      }
      if (this.hit === i) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(now / 90)})`; ctx.fillRect(-R, -R, W, W);
        ctx.restore();
      } else if (this.hit >= 0) {
        ctx.fillStyle = 'rgba(10,0,30,0.45)'; ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.5, R * 0.008); ctx.stroke();
    }
    // speed streaks
    if (this.speed > 0.08) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const rr = r * (0.35 + k * 0.1), a = this.angle * (1 + k * 0.02) + k * 1.7, len = 0.5 + this.speed * 1.4;
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * this.speed})`; ctx.lineWidth = R * 0.014;
        ctx.beginPath(); ctx.arc(0, 0, rr, a, a + len); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, rr, a + Math.PI, a + Math.PI + len); ctx.stroke();
      }
    }
    ctx.restore();

    // labels: printed flat on each spoke, in the wheel's plane, so they tilt and turn with it.
    // Icon at the rim, then the name as stacked letters running down the spoke toward the hub,
    // each letter sized to the wedge's width at that radius (so they taper toward the hub).
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, K);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const half = Math.sin(seg / 2), fit = (rad) => 2 * rad * half * 0.72, inner = R * 0.27;
    for (let i = 0; i < n; i++) {
      if (i === lifted) continue;
      const mid = Math.PI / 2 + this.angle + (i + 0.5) * seg;
      ctx.save();
      ctx.rotate(mid + Math.PI / 2);
      ctx.globalAlpha = this.hit >= 0 && this.hit !== i ? 0.55 : 1;
      let rad = r * 0.9;
      const iconSz = Math.min(R * 0.11, fit(rad));
      ctx.font = `${Math.round(iconSz)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(RULES[WHEEL_SEGS[i].k].icon, 0, -(rad - iconSz * 0.55));
      rad -= iconSz * 1.15;
      const letters = [...WHEEL_SEGS[i].label];
      let k = 1;
      for (let t = 0; t < 12; t++) {
        let rr = rad;
        for (let q = 0; q < letters.length; q++) rr -= Math.min(R * 0.1, fit(rr)) * k * 0.95;
        if (rr >= inner) break;
        k *= 0.92;
      }
      letters.forEach((ch, q) => {
        const sz = Math.min(R * 0.1, fit(rad)) * k, y = -(rad - sz * 0.5);
        ctx.font = `700 ${Math.round(sz)}px Fredoka, ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
        ctx.lineWidth = Math.max(2, sz * 0.2); ctx.strokeStyle = 'rgba(30, 0, 50, 0.85)';
        ctx.strokeText(ch, 0, y);
        ctx.fillStyle = LETTER_COLS[(q + i) % LETTER_COLS.length];
        ctx.fillText(ch, 0, y);
        rad -= sz * 0.95;
      });
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // rim bulbs on the face
    const bulbs = 48;
    for (let b = 0; b < bulbs; b++) {
      const a = (b / bulbs) * Math.PI * 2;
      const on = blink !== null ? blink : (Math.floor(now / rate) + b) % 2 === 0;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * R * 0.945, cy + Math.sin(a) * R * 0.945 * K, R * 0.016, R * 0.016 * K, 0, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#fffbe0' : '#b36b00';
      ctx.shadowColor = '#fff6c8'; ctx.shadowBlur = on ? R * 0.05 : 0;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // hub cap under the SPIN button
    ctx.fillStyle = '#7a3d00';
    ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.03, R * 0.25, R * 0.25 * K, 0, 0, Math.PI * 2); ctx.fill();

    // the winning wedge lifts out of the wheel, flips up to face the player and hovers above it
    if (lifted >= 0) {
      const L = this.lift, t = Math.min(1, (now - L.t0) / L.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const m = Math.PI / 2 + this.angle + (lifted + 0.5) * seg;
      const S = 1.05, fx = cx, fy = cy + R * 0.2;
      const bob = t >= 1 ? Math.sin((now - L.t0 - L.dur) / 260) * R * 0.02 : 0;
      const hop = Math.sin(Math.min(1, t * 1.4) * Math.PI) * R * 0.18;   // little jump up as it pops out
      // dim the wheel so the prize stands out
      ctx.fillStyle = `rgba(10,0,30,${0.45 * e})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * K, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - R, cy, R * 2, depth);
      ctx.beginPath(); ctx.ellipse(cx, cy + depth, R, R * K, 0, 0, Math.PI); ctx.fill();
      // light rays behind it once it's up
      if (t > 0.6) {
        const ra = Math.min(1, (t - 0.6) / 0.4);
        ctx.save();
        ctx.translate(fx, fy - r * S * 0.6 + bob);
        ctx.rotate(now / 1400);
        for (let q = 0; q < 14; q++) {
          ctx.rotate((Math.PI * 2) / 14);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-R * 0.06, -R * 0.75); ctx.lineTo(R * 0.06, -R * 0.75); ctx.closePath();
          ctx.fillStyle = `rgba(255, 230, 120, ${0.16 * ra})`; ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(cx + (fx - cx) * e, cy + (fy - cy) * e - hop + bob);
      const sy = K + (1 - K) * e, sc = 1 + (S - 1) * e;
      ctx.scale(sc, sc * sy);
      ctx.rotate((m + Math.PI / 2) * (1 - e) + (Math.PI * 2) * e);   // flips over as it rises
      this.drawFlatWedge(ctx, lifted, g, R * (0.05 + 0.1 * e) * (1 + 0.3 * Math.sin(now / 120)), seg * (1 + 2 * e));
      ctx.restore();
    }

    // sparks (in canvas pixels)
    this.sparks = this.sparks.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += R * 0.0012; p.life -= 0.03;
      if (p.life <= 0) return false;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s * p.life, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;
  },

  // sparks thrown from the pointer at the front of the wheel (or from a given canvas point)
  spark(n, big, at) {
    const cv = this.canvas(), g = this.geo(cv.width), R = g.R;
    const [x0, y0] = at || [g.cx, g.cy + g.r * g.K];
    const cols = ['#fffbe0', '#ffd23f', '#ff9f1c', WHEEL_SEGS[Math.max(0, this.hit >= 0 ? this.hit : this.under)].col];
    for (let i = 0; i < n; i++) {
      const a = at ? Math.random() * Math.PI * 2 : Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = R * (0.008 + Math.random() * (big ? 0.03 : 0.018));
      this.sparks.push({ x: x0, y: y0, vx: Math.cos(a) * sp, vy: (at ? Math.sin(a) : -Math.abs(Math.sin(a))) * sp, life: 1,
        s: R * (0.008 + Math.random() * 0.012), c: cols[(Math.random() * cols.length) | 0] });
    }
  },

  loop() {
    cancelAnimationFrame(this.raf);
    const tick = (now) => {
      if (document.getElementById('wheel').hidden) return;
      this.draw(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },

  spin(player, auto, sub) {
    return new Promise((resolve) => {
      const el = document.getElementById('wheel');
      const btn = el.querySelector('.wh-spin');
      const res = el.querySelector('.wh-result');
      const pointer = el.querySelector('.wh-pointer');
      el.querySelector('.wh-who').innerHTML = `<b class="${player}">${player}</b> ${auto ? '(computer) ' : ''}spins to pick the game type${sub ? ` ${sub}` : ''}`;
      res.className = 'wh-result';
      res.textContent = auto ? 'The computer spins...' : 'Press SPIN!';
      this.hit = -1; this.speed = 0; this.sus = 0; this.under = -1; this.sparks = []; this.lift = null;
      this.angle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      el.classList.remove('landed', 'spinning', 'lifting');
      el.style.setProperty('--sus', 0); el.style.setProperty('--jit', 0);
      btn.textContent = 'SPIN';
      btn.disabled = auto;
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('show'));
      this.loop();
      Sound.slotOpen();

      let spun = false;
      const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); } };
      const go = () => {
        if (spun) return;
        spun = true;
        window.removeEventListener('keydown', onKey);
        btn.disabled = true;
        btn.textContent = '?';
        el.classList.add('spinning');
        res.textContent = '';
        const n = WHEEL_SEGS.length, seg = (Math.PI * 2) / n;
        const segAt = (ang) => (((Math.floor((-ang) / seg)) % n) + n) % n;
        const matches = WHEEL_SEGS.map((x, i) => (Game.dev.on && x.k === Game.dev.wheel ? i : -1)).filter((i) => i >= 0);
        const forced = matches.length ? matches[(Math.random() * matches.length) | 0] : -1;
        const target = forced >= 0 ? forced : (Math.random() * n) | 0;
        // land inside the target segment; half the time it only just creeps over the line
        const within = (Math.random() < 0.5 ? 0.08 + Math.random() * 0.12 : 0.2 + Math.random() * 0.65) * seg;
        const base = -(target * seg + within);
        // 1) wind-back: drag the wheel backwards a little before letting go
        const pullT = 520, pull = seg * 1.4, a0 = this.angle;
        Sound.wheelPull(pullT / 1000);
        let end = base;
        while (end < a0 - pull + Math.PI * 2 * 6) end += Math.PI * 2;
        const start = a0 - pull, T = 5600 + Math.random() * 900;
        const t0 = performance.now();
        let launched = 0, lastSeg = segAt(a0), rolled = false;
        const live = (i) => {
          const sg = WHEEL_SEGS[i];
          res.innerHTML = `<span class="wh-live" style="color:${sg.col};font-size:${Math.round(18 + this.sus * 22)}px">${RULES[sg.k].icon} ${sg.label}</span>`;
          const sp = res.firstChild; sp.classList.add('tickpop');
        };
        const step = (now) => {
          const dt = now - t0;
          if (dt < pullT) {
            const q = dt / pullT, e = q * q * (3 - 2 * q);
            this.angle = a0 - pull * e;
            el.style.setProperty('--jit', ((Math.random() - 0.5) * 1.2 * q).toFixed(2));
            requestAnimationFrame(step);
            return;
          }
          if (!launched) { launched = now; Sound.lever(); Sound.wheelLaunch(); el.style.setProperty('--jit', 0); }
          const q = Math.min(1, (now - launched) / T);
          const e = 1 - Math.pow(1 - q, 4);
          this.angle = start + (end - start) * e;
          // angular speed relative to the launch speed (1 at release, 0 at rest)
          this.speed = Math.pow(1 - q, 3);
          // suspense ramps up over the last ~40% of the spin
          this.sus = Math.max(0, Math.min(1, (q - 0.55) / 0.4));
          el.style.setProperty('--sus', this.sus.toFixed(3));
          el.style.setProperty('--hubrate', `${(0.5 - this.sus * 0.38).toFixed(2)}s`);
          if (this.sus > 0 && !rolled) { rolled = true; Sound.drumroll(((1 - q) * T) / 1000); }
          const cur = segAt(this.angle);
          this.under = cur;
          if (cur !== lastSeg) {
            lastSeg = cur;
            Sound.wheelClack(this.sus);
            pointer.classList.remove('flap'); void pointer.offsetWidth; pointer.classList.add('flap');
            if (this.speed < 0.35) { this.spark(this.sus > 0.5 ? 10 : 4, this.sus > 0.5); live(cur); }
            if (this.sus > 0.7) el.style.setProperty('--jit', ((Math.random() - 0.5) * 0.8).toFixed(2));
          }
          if (q < 1) requestAnimationFrame(step);
          else land(target);
        };
        requestAnimationFrame(step);
      };
      const land = (i) => {
        const k = WHEEL_SEGS[i].k, R = RULES[k];
        this.hit = i; this.speed = 0; this.sus = 0;
        el.classList.remove('spinning');
        el.style.setProperty('--sus', 0); el.style.setProperty('--jit', 0);
        btn.textContent = R.icon;
        this.spark(40, true);
        el.classList.add('landed');
        Sound.slotWin(false);
        Renderer.flash(0.3, '255,210,63');
        let done = false;
        const finish = () => {
          if (done) return; done = true;
          el.removeEventListener('click', finish);
          el.classList.remove('show');
          setTimeout(() => { el.hidden = true; this.lift = null; resolve(k); }, 260);
        };
        // the winning wedge pops out of the wheel, flips up to face the player and hovers, glowing
        setTimeout(() => {
          this.lift = { t0: performance.now(), dur: 950 };
          el.classList.add('lifting');
          Sound.wheelLaunch();
          this.spark(30, true, [this.geo(this.canvas().width).cx, this.geo(this.canvas().width).cy + this.geo(this.canvas().width).r * WHEEL_K * 0.5]);
        }, 450);
        setTimeout(() => {
          const cv = this.canvas(), g = this.geo(cv.width);
          const px = g.cx, py = g.cy + g.R * 0.2 - g.r * 0.6;
          this.spark(70, true, [px, py]);
          Sound.fanfare ? Sound.fanfare() : Sound.slotWin(true);
          const rr = cv.getBoundingClientRect(), f = rr.width / cv.width;
          Renderer.burst(rr.left + px * f, rr.top + py * f, player, 90);
          Renderer.flash(0.35, '255,230,120');
          res.className = 'wh-result is-win';
          res.innerHTML = `<div class="prize-name">${R.icon} ${R.name.toUpperCase()}!</div>`;
          el.addEventListener('click', finish);
        }, 1400);
        setTimeout(finish, 3300);
      };
      btn.onclick = go;
      el.querySelector('.wh-stage').onclick = (e) => { if (!auto && e.target !== btn) go(); };
      if (auto) setTimeout(go, 900);
      else window.addEventListener('keydown', onKey);
    });
  },
};
