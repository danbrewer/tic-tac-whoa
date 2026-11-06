'use strict';
// Wheel of games: before each Level 0 game the last winner spins it to pick the game type.
const WHEEL_SEGS = [
  { k: 'classic', label: 'Classic', col: '#3a86ff' },
  { k: 'vanish', label: 'Vanishing', col: '#8338ec' },
  { k: 'gravity', label: 'Gravity', col: '#0096c7' },
  { k: 'shift', label: 'Shifting', col: '#fb8500' },
  { k: 'wild', label: 'Wild Square', col: '#ff006e' },
  { k: 'misere', label: 'Misère', col: '#06a77d' },
];

const Wheel = {
  angle: 0,       // current rotation (radians); segment 0 starts at the pointer when angle = 0
  hit: -1,        // winning segment index once landed
  raf: 0,

  canvas() { return document.querySelector('#wheel .wh-canvas'); },

  draw(now = performance.now()) {
    const cv = this.canvas();
    const css = cv.clientWidth;
    if (!css) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(css * dpr)) { cv.width = cv.height = Math.round(css * dpr); }
    const ctx = cv.getContext('2d');
    const W = cv.width, R = W / 2, r = R * 0.9, n = WHEEL_SEGS.length, seg = (Math.PI * 2) / n;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.translate(R, R);
    // outer rim
    ctx.beginPath(); ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
    const rim = ctx.createLinearGradient(-R, -R, R, R);
    rim.addColorStop(0, '#ffe66b'); rim.addColorStop(0.5, '#ff9f1c'); rim.addColorStop(1, '#ffd23f');
    ctx.fillStyle = rim; ctx.fill();
    // segments (pointer is at the top: -90°)
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + this.angle + i * seg, a1 = a0 + seg;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, WHEEL_SEGS[i].col); g.addColorStop(1, WHEEL_SEGS[i].col);
      ctx.fillStyle = g; ctx.fill();
      if (this.hit === i) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(now / 90)})`; ctx.fillRect(-R, -R, W, W);
        ctx.restore();
      } else if (this.hit >= 0) {
        ctx.fillStyle = 'rgba(10,0,30,0.45)'; ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, R * 0.012); ctx.stroke();
      // label: icon near the rim, name under it, reading outward
      const mid = a0 + seg / 2;
      ctx.save();
      ctx.rotate(mid + Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(R * 0.15)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(RULES[WHEEL_SEGS[i].k].icon, 0, -r * 0.76);
      ctx.font = `700 ${Math.round(R * 0.085)}px Fredoka, system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = R * 0.02; ctx.shadowOffsetY = R * 0.008;
      ctx.fillText(WHEEL_SEGS[i].label.toUpperCase(), 0, -r * 0.5);
      ctx.restore();
    }
    // chasing rim bulbs
    const bulbs = 24;
    for (let i = 0; i < bulbs; i++) {
      const a = (i / bulbs) * Math.PI * 2;
      const on = (Math.floor(now / 140) + i) % 2 === 0 || this.hit >= 0 && Math.floor(now / 70) % 2 === 0;
      ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.945, Math.sin(a) * R * 0.945, R * 0.022, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#fffbe0' : '#b36b00';
      ctx.shadowColor = '#fff6c8'; ctx.shadowBlur = on ? R * 0.05 : 0;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
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
      this.hit = -1;
      this.angle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      el.classList.remove('landed');
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
        res.textContent = '';
        Sound.lever();
        const n = WHEEL_SEGS.length, seg = (Math.PI * 2) / n;
        const forced = Game.dev.on && Game.dev.wheel ? WHEEL_SEGS.findIndex((x) => x.k === Game.dev.wheel) : -1;
        const target = forced >= 0 ? forced : (Math.random() * n) | 0;
        // land with the pointer somewhere inside the target segment (not on a line)
        const within = (0.15 + Math.random() * 0.7) * seg;
        const base = -(target * seg + within);
        let end = base;
        while (end < this.angle + Math.PI * 2 * 5) end += Math.PI * 2;
        const start = this.angle, T = 4200 + Math.random() * 800;
        const t0 = performance.now();
        let lastSeg = Math.floor((-start) / seg);
        const step = (now) => {
          const q = Math.min(1, (now - t0) / T);
          const e = 1 - Math.pow(1 - q, 4);
          this.angle = start + (end - start) * e;
          const cur = Math.floor((-this.angle) / seg);
          if (cur !== lastSeg) {
            lastSeg = cur;
            Sound.reelTick();
            pointer.classList.remove('flap'); void pointer.offsetWidth; pointer.classList.add('flap');
          }
          if (q < 1) requestAnimationFrame(step);
          else land(target);
        };
        requestAnimationFrame(step);
      };
      const land = (i) => {
        const k = WHEEL_SEGS[i].k, R = RULES[k];
        this.hit = i;
        el.classList.add('landed');
        res.className = 'wh-result is-win';
        res.innerHTML = `<div class="prize-name">${R.icon} ${R.name.toUpperCase()}!</div>`;
        Sound.slotWin(false);
        const r = this.canvas().getBoundingClientRect();
        Renderer.burst(r.left + r.width / 2, r.top + r.height * 0.2, player, 90);
        Renderer.flash(0.3, '255,210,63');
        let done = false;
        const finish = () => {
          if (done) return; done = true;
          el.removeEventListener('click', finish);
          el.classList.remove('show');
          setTimeout(() => { el.hidden = true; resolve(k); }, 260);
        };
        setTimeout(() => el.addEventListener('click', finish), 400);
        setTimeout(finish, 1900);
      };
      btn.onclick = go;
      el.querySelector('.wh-canvas').onclick = () => { if (!auto) go(); };
      if (auto) setTimeout(go, 900);
      else window.addEventListener('keydown', onKey);
    });
  },
};
