'use strict';
// Always-visible stack of mini boards: the live boards (top level + the game deciding
// its square) and, below them, the finished boards from earlier levels.
const MiniMap = {
  init(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    const hit = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      return this.items.find((i) => x >= i.x && x <= i.x + i.size && y >= i.y - 14 && y <= i.y + i.size);
    };
    canvas.addEventListener('click', (e) => {
      const it = hit(e);
      if (!it) return;
      Sound.ensure();
      if (it.board === Game.current()) Game.backToLive(); else Game.goTo(it.board);
    });
    canvas.addEventListener('mousemove', (e) => { canvas.style.cursor = hit(e) ? 'zoom-in' : 'default'; });
  },

  boards() {
    const live = Game.chainOf(Game.current());
    const history = [];
    for (let b = Game.root; b.seeded && b.cells[4].record; ) { b = b.cells[4].record; history.push(b); }
    return { live, history };
  },

  draw(now) {
    if (!Game.root) return;
    const phone = window.innerWidth <= 520;
    const { live, history } = this.boards();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const items = [];
    if (phone) {
      let x = 4;
      for (const b of live) { items.push({ board: b, x, y: 4, size: 40, label: false }); x += 46; }
      this.layout(items, x, 48, dpr);
    } else {
      let y = 22;
      for (const b of live) { items.push({ board: b, x: 12, y, size: 78, label: true }); y += 78 + 26; }
      const shown = history.slice(0, 4);
      if (shown.length) { this.historyY = y - 2; y += 22; }
      for (const b of shown) { items.push({ board: b, x: 26, y, size: 50, label: true, past: true }); y += 50 + 22; }
      if (history.length > shown.length) y += 14;
      this.layout(items, 102, y, dpr);
      this.extra = history.length - shown.length;
    }
    this.items = items;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!phone && history.length) {
      ctx.fillStyle = 'rgba(244,240,255,0.5)';
      ctx.font = '600 9px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EARLIER LEVELS', 51, this.historyY);
    }
    for (const it of items) this.board(it, now);
    if (!phone && this.extra > 0) {
      ctx.fillStyle = 'rgba(244,240,255,0.6)';
      ctx.font = '600 11px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${this.extra} more`, 51, this.h - 8);
    }
  },

  layout(items, w, h, dpr) {
    if (this.w !== w || this.h !== h || this.dpr !== dpr) {
      this.w = w; this.h = h; this.dpr = dpr;
      this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
      this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
    }
  },

  board(it, now) {
    const ctx = this.ctx, b = it.board, S = it.size, x0 = it.x, y0 = it.y;
    const hue = levelHue(b.level);
    const focus = Game.focus() === b;
    const live = b === Game.current();
    ctx.save();
    ctx.globalAlpha = it.past ? 0.8 : 1;
    if (it.label) {
      ctx.fillStyle = `hsl(${hue},100%,80%)`;
      ctx.font = `600 ${it.past ? 10 : 12}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(`Level ${b.level}`, x0, y0 - 5);
      if (live) { ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(x0 + S - 4, y0 - 9, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // backing
    ctx.fillStyle = `hsla(${hue},60%,16%,0.92)`;
    ctx.strokeStyle = focus ? '#fff' : `hsla(${hue},100%,65%,0.8)`;
    ctx.lineWidth = focus ? 2.5 : 1.2;
    if (focus) { ctx.shadowColor = `hsl(${hue},100%,65%)`; ctx.shadowBlur = 12; }
    ctx.beginPath(); ctx.roundRect(x0, y0, S, S, 6); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    const pad = S * 0.07, cs = (S - pad * 2) / 3;
    const owners = b.cells.map((c) => c.owner);
    const threats = b.level >= 1 && !b.winner ? threatsOf(owners) : null;
    for (let k = 0; k < 9; k++) {
      const i = k % 3, j = (k / 3) | 0;
      const cx = x0 + pad + i * cs, cy = y0 + pad + j * cs;
      const c = b.cells[k];
      let fill = `hsla(${hue},55%,28%,0.9)`;
      if (threats && !c.owner) {
        const tx = threats.X.has(k), to = threats.O.has(k);
        if (tx || to) {
          const who = tx && to ? (Math.sin(now / 400) > 0 ? 'X' : 'O') : tx ? 'X' : 'O';
          fill = `hsla(${PIECE_COL[who].h},100%,${35 + 15 * (0.5 + 0.5 * Math.sin(now / 230 + k))}%,0.95)`;
        }
      }
      if (b.pending === k) {
        const pul = 0.5 + 0.5 * Math.sin(now / 180);
        fill = `rgba(255,255,255,${0.35 + 0.5 * pul})`;
      }
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.roundRect(cx + 1, cy + 1, cs - 2, cs - 2, 2); ctx.fill();
      if (c.owner) this.glyph(c.owner, cx + cs / 2, cy + cs / 2, cs * 0.3);
    }
    if (b.winLine) {
      const ctr = (k) => [x0 + pad + ((k % 3) + 0.5) * cs, y0 + pad + (((k / 3) | 0) + 0.5) * cs];
      const [a, z] = [ctr(b.winLine[0]), ctr(b.winLine[2])];
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.5, S * 0.035);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(z[0], z[1]); ctx.stroke();
    }
    ctx.restore();
  },

  glyph(p, x, y, r) {
    const ctx = this.ctx;
    if (p === 'W') {
      ctx.fillStyle = `hsl(${(performance.now() / 8) % 360},100%,62%)`;
      ctx.beginPath();
      for (let n = 0; n < 10; n++) { const rr = n % 2 ? r * 0.45 : r * 1.1, th = -Math.PI / 2 + (n / 10) * Math.PI * 2; n ? ctx.lineTo(x + rr * Math.cos(th), y + rr * Math.sin(th)) : ctx.moveTo(x + rr * Math.cos(th), y + rr * Math.sin(th)); }
      ctx.closePath(); ctx.fill();
      return;
    }
    if (p === '#') {
      ctx.fillStyle = 'hsl(255,12%,58%)';
      ctx.fillRect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.2);
      ctx.strokeStyle = 'rgba(30,20,50,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.4); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r, y - r * 0.2); ctx.stroke();
      return;
    }
    ctx.strokeStyle = `hsl(${PIECE_COL[p].h},100%,66%)`;
    ctx.lineWidth = Math.max(1.5, r * 0.45);
    ctx.lineCap = 'round';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    if (p === 'X') { ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); }
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};
