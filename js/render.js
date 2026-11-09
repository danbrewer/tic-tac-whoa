'use strict';
// Isometric canvas renderer, camera and tween system.

const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = 0.5;
// All sizes are fractions of a board's cell size, so a nested board is an exact
// scaled copy of its parent and zooming is a pure camera scale.
const GEO = { margin: 0.1, gap: 0.07, tileH: 0.2, baseH: 0.1, pad: 0.14, pieceH: 0.17 };
const PIECE_COL = { X: { h: 322, s: 100, l: 62 }, O: { h: 188, s: 100, l: 52 }, '#': { h: 255, s: 12, l: 58 }, W: { h: 48, s: 100, l: 60 } };
const LEVEL_HUES = [212, 268, 158, 28, 296, 48, 128, 345, 190];
const ORDER = [0, 1, 3, 2, 4, 6, 5, 7, 8]; // back-to-front painter order (by col+row)

// ---------- the Wild Square mark: an X whose four arms curl into the quarters of an O and back ----------
const WILD_CYCLE = 3600, WILD_SPIN = 1100;   // ms per X->O->X cycle; ms per radian of rotation
function wildMorph(now) {
  const ph = (now % WILD_CYCLE) / WILD_CYCLE;
  const tri = ph < 0.15 ? 0 : ph < 0.5 ? (ph - 0.15) / 0.35 : ph < 0.65 ? 1 : 1 - (ph - 0.65) / 0.35;
  return tri * tri * (3 - 2 * tri);
}
// flat 2D version for canvases (minimap, wheel): r is roughly the glyph's radius
function drawWildMark(ctx, x, y, r, now = performance.now()) {
  const m = wildMorph(now), rot = now / WILD_SPIN;
  ctx.save();
  ctx.strokeStyle = `hsl(${(322 - 134 * m + 360) % 360},100%,${64 - 8 * m}%)`;
  ctx.lineWidth = Math.max(1.5, r * (0.42 - 0.1 * m)); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const phi = rot + Math.PI / 4 + (k * Math.PI) / 2;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, xr = r * t, ps = phi + (t - 0.5) * (Math.PI / 2), ro = r * 0.72;
      const px = x + xr * Math.cos(phi) + (ro * Math.cos(ps) - xr * Math.cos(phi)) * m;
      const py = y + xr * Math.sin(phi) + (ro * Math.sin(ps) - xr * Math.sin(phi)) * m;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
  }
  ctx.stroke();
  ctx.restore();
}
// animated SVG version for HTML (rule cards, panels, slots): sized 1em so it follows font-size
const WILD_ICON = (() => {
  const f = (v) => v.toFixed(1), pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const L = 42, R = 30, K = 0.5523 * R;
  const paths = [];
  for (let k = 0; k < 4; k++) {
    const phi = Math.PI / 4 + (k * Math.PI) / 2;
    const [ex, ey] = pt(L, phi);
    const X = `M0 0C${f(ex / 3)} ${f(ey / 3)} ${f(ex * 2 / 3)} ${f(ey * 2 / 3)} ${f(ex)} ${f(ey)}`;
    const a0 = phi - Math.PI / 4, a1 = phi + Math.PI / 4, [ax, ay] = pt(R, a0), [bx, by] = pt(R, a1);
    const O = `M${f(ax)} ${f(ay)}C${f(ax - K * Math.sin(a0))} ${f(ay + K * Math.cos(a0))} ${f(bx + K * Math.sin(a1))} ${f(by - K * Math.cos(a1))} ${f(bx)} ${f(by)}`;
    paths.push(`<path d="${X}"><animate attributeName="d" dur="${WILD_CYCLE}ms" repeatCount="indefinite" keyTimes="0;0.15;0.5;0.65;1" calcMode="spline" keySplines="0 0 1 1;.45 0 .55 1;0 0 1 1;.45 0 .55 1" values="${X};${X};${O};${O};${X}"/></path>`);
  }
  const anim = (attr, a, b) => `<animate attributeName="${attr}" dur="${WILD_CYCLE}ms" repeatCount="indefinite" keyTimes="0;0.15;0.5;0.65;1" calcMode="spline" keySplines="0 0 1 1;.45 0 .55 1;0 0 1 1;.45 0 .55 1" values="${a};${a};${b};${b};${a}"/>`;
  return `<svg class="wild-svg" viewBox="-50 -50 100 100" width="1em" height="1em" aria-label="shape-shifting mark" role="img" style="vertical-align:-0.15em;overflow:visible">`
    + `<g fill="none" stroke="#ff3fb2" stroke-width="17" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(255,255,255,.35))">`
    + anim('stroke', '#ff3fb2', '#0ad4ff') + anim('stroke-width', 17, 13)
    + `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${Math.round(2 * Math.PI * WILD_SPIN)}ms" repeatCount="indefinite"/>`
    + paths.join('') + '</g></svg>';
})();

// ---------- the Crossfire icon: a red X on a white disc with a dark rim, so it reads on any background ----------
function drawCrossMark(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#fff8ec'; ctx.strokeStyle = '#2a0a3d'; ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e0102f'; ctx.lineWidth = r * 0.34; ctx.lineCap = 'round';
  const a = r * 0.46;
  ctx.beginPath(); ctx.moveTo(x - a, y - a); ctx.lineTo(x + a, y + a); ctx.moveTo(x + a, y - a); ctx.lineTo(x - a, y + a); ctx.stroke();
  ctx.restore();
}
const CROSS_ICON = '<svg class="cross-svg" viewBox="-50 -50 100 100" width="1em" height="1em" aria-label="crossfire" role="img" style="vertical-align:-0.15em;overflow:visible">'
  + '<circle r="44" fill="#fff8ec" stroke="#2a0a3d" stroke-width="7"/>'
  + '<path d="M-20 -20L20 20M20 -20L-20 20" stroke="#e0102f" stroke-width="15" stroke-linecap="round"/></svg>';

// ---------- the Fog of War icon: a soft cloud that billows and drifts ----------
const FOG_PUFFS = [[-24, 8, 17, 2900], [-6, -6, 22, 3400], [16, -1, 19, 3100], [30, 11, 13, 2600], [-10, 15, 16, 3700], [10, 16, 16, 3300], [-34, 15, 10, 2500]];
// flat 2D version for canvases (the wheel): r is roughly the cloud's half-width
function drawFogMark(ctx, x, y, r, now = performance.now()) {
  const k = r / 44, dx = Math.sin(now / 1300) * 5 * k;
  ctx.save();
  for (const [u, v, pr, per] of FOG_PUFFS) {
    const rr = pr * k * (1 + 0.12 * Math.sin((now / per) * Math.PI * 2 + u)), px = x + u * k + dx, py = y + v * k + Math.sin(now / per + v) * 1.5 * k;
    const gr = ctx.createRadialGradient(px - rr * 0.3, py - rr * 0.4, 0, px, py, rr);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#e2e6f4'); gr.addColorStop(1, 'rgba(176,186,214,0.9)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// animated SVG version for HTML (rule cards, badge, panels, slots): sized 1em so it follows font-size
const FOG_ICON = (() => {
  const puffs = FOG_PUFFS.map(([u, v, r, per], i) =>
    `<circle cx="${u}" cy="${v}" r="${r}"><animate attributeName="r" dur="${per}ms" repeatCount="indefinite" values="${r};${(r * 1.14).toFixed(1)};${r}" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" begin="-${(i * 430) % per}ms"/>`
    + `<animate attributeName="cy" dur="${per + 600}ms" repeatCount="indefinite" values="${v};${v - 2.5};${v}" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/></circle>`).join('');
  const wisp = (y, d, b) => `<ellipse cx="0" cy="${y}" rx="14" ry="3.2" fill="#e8ebf7" opacity="0"><animate attributeName="cx" dur="${d}ms" begin="${b}ms" repeatCount="indefinite" values="-30;40"/><animate attributeName="opacity" dur="${d}ms" begin="${b}ms" repeatCount="indefinite" values="0;.8;0"/></ellipse>`;
  return '<svg class="fog-svg" viewBox="-50 -50 100 100" width="1em" height="1em" aria-label="fog" role="img" style="vertical-align:-0.15em;overflow:visible">'
    + '<defs><radialGradient id="fogPuff" cx="40%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e2e6f4"/><stop offset="1" stop-color="#b3bcd8"/></radialGradient></defs>'
    + '<g fill="url(#fogPuff)" style="filter:drop-shadow(0 2px 3px rgba(40,30,90,.35))">'
    + '<animateTransform attributeName="transform" type="translate" dur="5200ms" repeatCount="indefinite" values="-4 0;4 -1;-4 0" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>'
    + puffs + '</g>' + wisp(30, 3200, 0) + wisp(-24, 4100, -1800) + '</svg>';
})();

const levelHue = (lvl) => LEVEL_HUES[lvl % LEVEL_HUES.length];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (v) => v - Math.floor(v);
const col = (c, dl = 0, a = 1) => `hsla(${c.h},${c.s}%,${Math.max(0, Math.min(100, c.l + dl))}%,${a})`;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

const Ease = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// ---------- tweens ----------
const Tweens = {
  list: [],
  add(dur, fn, ease = Ease.inOutCubic, delay = 0) {
    return new Promise((res) => this.list.push({ start: performance.now() + delay, dur, fn, ease, res }));
  },
  update(now) {
    this.list = this.list.filter((t) => {
      if (now < t.start) return true;
      const p = clamp01((now - t.start) / t.dur);
      t.fn(t.ease(p));
      if (p >= 1) { t.res(); return false; }
      return true;
    });
  },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const KEEP_MARKS_R = 3; // must match KEEP_MARKS in game.js
const hash01 = (n) => fract(Math.sin(n * 12.9898) * 43758.5453);
// Empty squares that would complete a line for each player.
const WIN_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function threatsOf(owners) {
  const t = { X: new Set(), O: new Set() };
  for (const line of WIN_LINES) {
    const vals = line.map((i) => owners[i]);
    for (const p of ['X', 'O']) {
      if (vals.filter((v) => v === p).length === 2 && vals.filter((v) => !v).length === 1) t[p].add(line[vals.indexOf(null)]);
    }
  }
  return t;
}

// Finished games kept for review; only the ones on the viewed chain are drawn.
const ReviewSet = new Set();
const shownChild = (c) => c.child || (c.record && ReviewSet.has(c.record) ? c.record : null);

// ---------- layout ----------
// Root board has cell size 1 at the origin; children sit on top of their parent's tile.
function layout(b, ox, oy, oz, s) {
  b.geo = { ox, oy, oz, s, top: oz + (GEO.baseH + GEO.tileH) * s };
  b.cells.forEach((c, k) => {
    const sub = shownChild(c);
    if (!sub) return;
    const i = k % 3, j = (k / 3) | 0;
    const cs = (s * (1 - 2 * GEO.margin)) / (3 + 2 * GEO.pad);
    layout(sub,
      ox + i * s + GEO.margin * s + GEO.pad * cs,
      oy + j * s + GEO.margin * s + GEO.pad * cs,
      b.geo.top, cs);
  });
}

// ---------- Gravity: the Level 0 board stands up like a Connect Four frame ----------
// A gravity game's board rotates about its front edge until it is vertical; row 0 ends up at the top.
// (it stays upright for a moment after a win so the winning line is seen in Connect Four position)
const wantsUpright = (b) => !!(b && b.level === 0 && b.rule === 'gravity' && (!b.winner || performance.now() - (b.winTime || 0) < 1300));
// world-space transform for a board tilted by t (0 flat .. 1 upright)
function tiltXf(b, t) {
  if (!b || !b.geo || !(t > 0.001)) return null;
  const g = b.geo, pad = GEO.pad * g.s, Y0 = g.oy + 3 * g.s + pad, Z0 = g.oz;
  const th = t * Math.PI / 2, c = Math.cos(th), sn = Math.sin(th);
  const f = (x, y, z) => { const dy = y - Y0, dz = z - Z0; return [x, Y0 + dy * c + dz * sn, Z0 - dy * sn + dz * c]; };
  f.c = c; f.s = sn;
  return f;
}

// Camera view that frames a board: focus point in projected iso space + log zoom.
function viewOf(b) {
  const g = b.geo, s = g.s;
  const E = s * (3 + 2 * GEO.pad);
  let cx = g.ox + 1.5 * s, cy = g.oy + 1.5 * s, cz = g.top;
  const xf = wantsUpright(b) ? tiltXf(b, 1) : null;
  if (xf) { [cx, cy, cz] = xf(cx, cy, cz); cz += 0.35 * s; } // leave room above for the disc waiting at the top
  return { px: (cx - cy) * ISO_X, py: (cx + cy) * ISO_Y - cz, L: -Math.log(E) - (xf ? 0.3 : 0) };
}

const Renderer = {
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { px: 0, py: 0, L: 0 };
    this.hover = -1;
    this.canHover = true;
    this.canInspect = true;
    this.hoverT = 0;
    this.now = 0;
    this.fx = { shake: 0, flash: 0, flashRgb: '255,255,255', kick: 0, ripples: [], texts: [], prevL: 0, warp: 0, warpDir: 1 };
    this.particles = [];
    this.stars = Array.from({ length: 240 }, () => ({
      a: Math.random() * Math.PI * 2,
      seed: Math.random(),
      b: 0.4 + Math.random() * 0.6,
      sz: 0.5 + Math.random(),
      hue: Math.random() < 0.5 ? 322 : 188,
    }));
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  },

  // Screen space left for the board once the HUD (and zoom bar) are placed.
  bottomReserve() { return this.W <= 520 ? 268 : 150; },
  fitK() {
    const w = this.W <= 520 ? this.W * 0.92 : this.W - 250;
    return Math.max(40, Math.min(w / (2 * ISO_X), (this.H - (this.W <= 520 ? 180 : 155) - this.bottomReserve()) / 1.2));
  },
  centerY() { return (this.W <= 520 ? 175 : 150) + (this.H - (this.W <= 520 ? 175 : 150) - this.bottomReserve()) / 2; },
  zoom() { return this.fitK() * Math.exp(this.cam.L); },

  setCam(v) { this.cam.px = v.px; this.cam.py = v.py; this.cam.L = v.L; },

  // Fly the camera so the zoom is about a fixed point (feels like a true zoom).
  flyTo(to, dur) {
    const from = { ...this.cam };
    const z0 = Math.exp(from.L), z1 = Math.exp(to.L);
    return Tweens.add(dur, (e) => {
      const L = lerp(from.L, to.L, e);
      let w = e;
      if (Math.abs(to.L - from.L) > 1e-6) {
        const z = Math.exp(L);
        w = (1 / z0 - 1 / z) / (1 / z0 - 1 / z1);
      }
      this.cam.L = L;
      this.cam.px = lerp(from.px, to.px, w);
      this.cam.py = lerp(from.py, to.py, w);
    });
  },

  project(x, y, z) {
    if (this.xf) [x, y, z] = this.xf(x, y, z);
    return [(x - y) * ISO_X * this.zm + this.offX, ((x + y) * ISO_Y - z) * this.zm + this.offY];
  },

  // Screen point -> cell index on board b (on the plane of its tile tops), or -1.
  pick(b, sx, sy) {
    if (!b || !b.geo) return -1;
    if (b.tilt > 0.5 && b.quads) {
      const inPoly = (q) => {
        let inside = false;
        for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
          const [xi, yi] = q[i], [xj, yj] = q[j];
          if ((yi > sy) !== (yj > sy) && sx < ((xj - xi) * (sy - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
      for (let k = 0; k < 9; k++) if (b.quads[k] && inPoly(b.quads[k])) return k;
      // the open space above each column also counts as that column (drop it in from the top)
      for (let i = 0; i < 3; i++) if (b.quadsAbove && b.quadsAbove[i] && inPoly(b.quadsAbove[i])) return i;
      return -1;
    }
    const zm = this.zoom();
    const px = (sx - this.W / 2) / zm + this.cam.px;
    const py = (sy - this.centerY()) / zm + this.cam.py;
    const g = b.geo;
    const A = px / ISO_X, B = (py + g.top) / ISO_Y;
    const x = (A + B) / 2, y = (B - A) / 2;
    const fi = (x - g.ox) / g.s, fj = (y - g.oy) / g.s;
    const i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || i > 2 || j < 0 || j > 2) return -1;
    return j * 3 + i;
  },

  boardScreenCenter(b) {
    const g = b.geo, prev = this.xf;
    this.xf = tiltXf(b, b.tilt);
    const r = this.project(g.ox + 1.5 * g.s, g.oy + 1.5 * g.s, g.top);
    this.xf = prev;
    return r;
  },

  // ---------- primitives ----------
  fillPoly(pts, fill, stroke, lw) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  },

  sideShade(c, nx, ny) {
    const t = (nx - ny) / (Math.abs(nx) + Math.abs(ny) || 1); // +1 faces right, -1 faces left
    return col(c, -21 - 8 * t);
  },

  // Extruded polygon (footprint in world x/y) from z0 to z1.
  prism(pts, z0, z1, c, opts = {}) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (area < 0) pts = pts.slice().reverse();
    const faces = [];
    const xf = this.xf, tc = xf ? xf.c : 1, ts = xf ? xf.s : 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const nx = b[1] - a[1], ny = -(b[0] - a[0]);
      // visible if the (tilted) face normal points toward the viewer (+1,+1,+1)
      if (nx + ny * (tc - ts) > 1e-15) faces.push({ a, b, d: a[0] + a[1] * (tc - ts) + b[0] + b[1] * (tc - ts), nx, ny });
    }
    faces.sort((f, g) => f.d - g.d);
    for (const f of faces) {
      const q = [this.project(f.a[0], f.a[1], z0), this.project(f.b[0], f.b[1], z0),
                 this.project(f.b[0], f.b[1], z1), this.project(f.a[0], f.a[1], z1)];
      const fill = this.sideShade(c, f.nx, f.ny);
      this.fillPoly(q, fill, fill, 0.6);
    }
    const ctx = this.ctx;
    if (opts.glow) { ctx.shadowColor = col(c, 5); ctx.shadowBlur = opts.glow; }
    const top = pts.map((p) => this.project(p[0], p[1], z1));
    this.fillPoly(top, opts.topFill || col(c, opts.topDl || 0));
    if (opts.glow) ctx.shadowBlur = 0;
    if (opts.stroke) this.fillPoly(top, null, opts.stroke, opts.lw || 1);
  },

  ring(cx, cy, R, r, z0, z1, c, opts = {}) {
    const N = 40, outer = [], inner = [];
    for (let n = 0; n <= N; n++) {
      const th = (n / N) * Math.PI * 2;
      outer.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]);
      inner.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    // inner far walls (seen through the hole)
    for (let n = 0; n < N; n++) {
      const th = ((n + 0.5) / N) * Math.PI * 2;
      const nx = -Math.cos(th), ny = -Math.sin(th);
      if (nx + ny * this.tk() <= 0) continue;
      const a = inner[n], b = inner[n + 1];
      const q = [this.project(a[0], a[1], z0), this.project(b[0], b[1], z0), this.project(b[0], b[1], z1), this.project(a[0], a[1], z1)];
      const fill = col(c, -30 - 6 * ((nx - ny) / (Math.abs(nx) + Math.abs(ny))));
      this.fillPoly(q, fill, fill, 0.6);
    }
    // outer front walls
    const faces = [];
    for (let n = 0; n < N; n++) {
      const th = ((n + 0.5) / N) * Math.PI * 2;
      const nx = Math.cos(th), ny = Math.sin(th);
      if (nx + ny * this.tk() <= 0) continue;
      faces.push({ a: outer[n], b: outer[n + 1], nx, ny, d: outer[n][0] + outer[n][1] * this.tk() });
    }
    faces.sort((f, g) => f.d - g.d);
    for (const f of faces) {
      const q = [this.project(f.a[0], f.a[1], z0), this.project(f.b[0], f.b[1], z0), this.project(f.b[0], f.b[1], z1), this.project(f.a[0], f.a[1], z1)];
      const fill = this.sideShade(c, f.nx, f.ny);
      this.fillPoly(q, fill, fill, 0.6);
    }
    // top
    const ctx = this.ctx;
    ctx.beginPath();
    outer.forEach((p, i) => { const s = this.project(p[0], p[1], z1); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); });
    ctx.closePath();
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = this.project(inner[i][0], inner[i][1], z1);
      i === inner.length - 1 ? ctx.moveTo(s[0], s[1]) : ctx.lineTo(s[0], s[1]);
    }
    ctx.closePath();
    if (opts.glow) { ctx.shadowColor = col(c, 5); ctx.shadowBlur = opts.glow; }
    ctx.fillStyle = col(c, opts.topDl || 0);
    ctx.fill('evenodd');
    ctx.shadowBlur = 0;
    if (opts.stroke) { ctx.strokeStyle = opts.stroke; ctx.lineWidth = opts.lw || 1; ctx.stroke(); }
  },

  // One massive telescopic hydraulic ram that lives in a mechanical pit under the Gravity board:
  // the board is the pit's hatch, and the ram pushes it up and holds it upright. Everything is
  // real 3D geometry run through the iso projection.
  hydraulics(b, a) {
    const g = b.geo, s = g.s, pad = GEO.pad * s, ctx = this.ctx;
    const Y0 = g.oy + 3 * s + pad, Z0 = g.oz, xf = tiltXf(b, b.tilt);
    const cx = g.ox + 1.5 * s, Ay = g.oy - pad + 0.82 * s,   // pivot assembly tucked against the back wall
      D = 0.9 * s, Zf = Z0 - D;   // pit only as deep as the pivot assembly
    const ap = a * Math.min(1, b.tilt * 5);                 // the pit fades in as the hatch opens
    // pit opening = the board's footprint (the flat board covers it like a hatch)
    const X0 = g.ox - pad + 0.04 * s, X1 = g.ox + 3 * s + pad - 0.04 * s, Yb = g.oy - pad + 0.04 * s, Yf = Y0 - 0.04 * s, rim = 0.55 * s;
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
    const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const norm = p => { const l = Math.hypot(...p) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
    const LGT = norm([-0.35, 0.45, 0.85]), HV = norm(add(LGT, norm([1, 1, 1])));
    // ---- tiny mesh kit: faces are collected per group, culled, depth sorted and shaded
    let faces = [], phase = -1;   // phase 0: only parts below the deck, 1: only parts above it
    const face = (pts, c, ctr, chrome, flat) => faces.push({ pts, c, ctr, chrome, flat });
    const m3 = p => p.reduce((acc, q) => acc + q[2], 0) / p.length;   // deeper in the pit = darker
    const flush = () => {
      const vis = [];
      for (const f of faces) {
        const p = f.pts, m = [0, 0, 0];
        for (const q of p) { m[0] += q[0] / p.length; m[1] += q[1] / p.length; m[2] += q[2] / p.length; }
        let n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
        if (dot(n, sub(m, f.ctr)) < 0) n = [-n[0], -n[1], -n[2]];
        if (n[0] + n[1] + n[2] <= 1e-6) continue;
        if (phase === 0 ? m[2] > Z0 + 1e-6 : phase === 1 ? m[2] <= Z0 + 1e-6 : false) continue;           // faces away from the (1,1,1) viewer
        vis.push({ f, n, d: m[0] + m[1] + m[2] });
      }
      vis.sort((p, q) => p.d - q.d);
      for (const { f, n } of vis) {
        const lam = Math.max(0, dot(n, LGT));
        let k = (0.42 + 0.68 * lam) * (f.flat ? 1 : 0.6 + 0.4 * Math.min(1, Math.max(0, (m3(f.pts) - Zf) / D))), spec = 0;
        if (f.chrome) spec = Math.pow(Math.max(0, dot(n, HV)), 14) * 0.9;
        const rgb = f.c.map(v => Math.min(255, Math.round(v * k + 255 * spec)));
        const fill = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        this.fillPoly(f.pts.map(q => this.project(q[0], q[1], q[2])), fill, fill, 0.7);
      }
      faces = [];
    };
    const box = (x0, x1, y0, y1, z0, z1, c, T = null) => {
      const P = (x, y, z) => T ? T(x, y, z) : [x, y, z];
      const v = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
      const ctr = P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      for (const ix of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) face(ix.map(i => v[i]), c, ctr);
    };
    const cyl = (P0, P1, r, n, c, chrome, caps = true, segs = 1) => {
      const d = norm(sub(P1, P0));
      let e1 = cross(d, [0, 0, 1]); if (Math.hypot(...e1) < 1e-3) e1 = cross(d, [1, 0, 0]);
      e1 = norm(e1); const e2 = cross(d, e1);
      const ring = P => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return add(add(P, e1, r * Math.cos(t)), e2, r * Math.sin(t)); });
      let prev = ring(P0);
      if (caps) face(prev, c.map(v => v * 0.85), add(P0, d, r), chrome);
      for (let k = 1; k <= segs; k++) {
        const Pk = add(P0, sub(P1, P0), k / segs), Pm = add(P0, sub(P1, P0), (k - 0.5) / segs), cur = ring(Pk);
        for (let i = 0; i < n; i++) face([prev[i], prev[(i + 1) % n], cur[(i + 1) % n], cur[i]], c, Pm, chrome);
        prev = cur;
        if (k === segs && caps) face(cur, c.map(v => v * 0.85), add(Pk, d, -r), chrome);
      }
    };
    const disc = (P, ax, r, n, c) => { // flat disc facing +axis (ax: 'x' | 'y' | 'z')
      const pts = Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2, u = r * Math.cos(t), v = r * Math.sin(t);
        return ax === 'x' ? [P[0], P[1] + u, P[2] + v] : ax === 'y' ? [P[0] + u, P[1], P[2] + v] : [P[0] + u, P[1] + v, P[2]]; });
      face(pts, c, ax === 'x' ? [P[0] - 1, P[1], P[2]] : ax === 'y' ? [P[0], P[1] - 1, P[2]] : [P[0], P[1], P[2] - 1]);
    };
    const STEEL = [58, 63, 92], DARK = [36, 39, 58], BOLT = [170, 178, 196], CHROME = [150, 160, 178],
      YEL = [255, 194, 26], PUMP = [214, 84, 34], HOSE = [26, 28, 40], RUB = [20, 20, 28], WALL = [46, 50, 76], DECK = [52, 57, 86];

    // geometry of the ram
    const slabT = 0.16 * s, Pz = Zf + slabT + 0.42 * s;
    const P = [cx, Ay, Pz];                                         // lower pivot (in the clevis)
    const B = xf(cx, Y0 - 2.2 * s, Z0 - 0.16 * s);                  // upper pivot (bracket under the board)
    const L = Math.hypot(...sub(B, P)), d = norm(sub(B, P));
    // telescopic: fixed barrel, a second-stage sleeve, then the chrome rod
    const barrel = Math.min(L, 1.15 * s), M = add(P, d, barrel);
    const sleeve = Math.max(0, Math.min(L - barrel, 1.15 * s)), M2 = add(M, d, sleeve);

    // ---- the pit: floor, far walls (inner faces) and their plumbing
    let beam = () => {};
    const pit = () => {
      ctx.globalAlpha = ap;
      face([[X0, Yb, Zf], [X1, Yb, Zf], [X1, Yf, Zf], [X0, Yf, Zf]], [34, 36, 54], [cx, Ay, Zf - 1], false, true); flush();
      for (let i = 1; i < 12; i++) { const x = X0 + (X1 - X0) * i / 12;      // floor grating
        face([[x - 0.012 * s, Yb, Zf + 0.002 * s], [x + 0.012 * s, Yb, Zf + 0.002 * s], [x + 0.012 * s, Yf, Zf + 0.002 * s], [x - 0.012 * s, Yf, Zf + 0.002 * s]], [22, 24, 36], [x, Ay, Zf - 1], false, true); }
      flush();
      face([[X0, Yb, Zf], [X0, Yf, Zf], [X0, Yf, Z0], [X0, Yb, Z0]], WALL, [X0 - 1, Ay, Zf]);       // left wall
      face([[X0, Yb, Zf], [X1, Yb, Zf], [X1, Yb, Z0], [X0, Yb, Z0]], WALL, [cx, Yb - 1, Zf]);       // back wall
      flush();
      for (let i = 1; i < 6; i++) { const y = Yb + (Yf - Yb) * i / 6;          // wall panel ribs
        box(X0, X0 + 0.05 * s, y - 0.03 * s, y + 0.03 * s, Zf, Z0 - 0.02 * s, [38, 41, 64]); flush(); }
      for (let i = 1; i < 6; i++) { const x = X0 + (X1 - X0) * i / 6;
        box(x - 0.03 * s, x + 0.03 * s, Yb, Yb + 0.05 * s, Zf, Z0 - 0.02 * s, [38, 41, 64]); flush(); }
      for (const [z, c] of [[Zf + 0.66 * s, [120, 60, 40]], [Zf + 0.44 * s, [60, 110, 150]]]) {   // pipes along the back wall
        cyl([X0 + 0.06 * s, Yb + 0.16 * s, z], [X1, Yb + 0.16 * s, z], 0.07 * s, 10, c, false, false); flush(); }
      cyl([X0 + 0.16 * s, Yb + 0.16 * s, Zf], [X0 + 0.16 * s, Yb + 0.16 * s, Z0 - 0.02 * s], 0.07 * s, 10, [120, 60, 40], false, false); flush();
      // work lamp on an arm off the back wall, its shade pointing straight down: a soft, dim
      // cone of light (true 3D cone run through the iso projection) and an iso pool on the floor
      const lx = X0 + (X1 - X0) * 0.84, ldir = [0, 0, -1], Lp = [lx, Yb + 0.34 * s, Z0 - 0.1 * s];
      const F = [Lp[0], Lp[1], Zf], R = 0.42 * s, rm = 0.12 * s, P1 = add(Lp, ldir, 0.05 * s);
      const circ = (C, r, n = 32) => Array.from({ length: n }, (_, i) => { const th = i / n * Math.PI * 2; return [C[0] + r * Math.cos(th), C[1] + r * Math.sin(th), C[2]]; });
      const hull2 = pts => {
        const ps = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
        const lo = [], up = [];
        for (const p of ps) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
        for (const p of ps.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
        return lo.slice(0, -1).concat(up.slice(0, -1)); };
      const path = pts => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); };
      const [fx, fy] = this.project(...F), [mx, my] = this.project(...P1), zm = this.zm;
      const beamFns = [];
      // soft pool: a radial gradient drawn in floor space, so it lands as a proper iso ellipse
      beamFns.push(() => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.transform(ISO_X * zm, ISO_Y * zm, -ISO_X * zm, ISO_Y * zm, fx, fy);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.15);
        gr.addColorStop(0, 'rgba(255,176,90,0.14)'); gr.addColorStop(0.5, 'rgba(255,160,70,0.06)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      // soft cone: a stack of horizontal discs from the shade's mouth to the floor, each a radial
      // gradient drawn in floor space (so every slice is a true iso ellipse) that fades to nothing
      // at its rim. Added together they read as a soft cone of light with no hard edges anywhere.
      beamFns.push(() => {
        const N = 26;
        for (let k = 0; k < N; k++) {
          const v = k / (N - 1), z = P1[2] + (Zf - P1[2]) * v, r = rm * 0.8 + (R - rm * 0.8) * v;
          const [qx, qy] = this.project(F[0], F[1], z);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.transform(ISO_X * zm, ISO_Y * zm, -ISO_X * zm, ISO_Y * zm, qx, qy);
          const al = 0.075 * (1 - 0.6 * v);
          const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g2.addColorStop(0, `rgba(255,190,110,${al})`); g2.addColorStop(0.45, `rgba(255,180,95,${al * 0.6})`); g2.addColorStop(1, 'rgba(255,170,80,0)');
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      });
      beam = () => { ctx.globalAlpha = ap; beamFns.forEach(f => f()); };
      // wall bracket and arm
      box(lx - 0.06 * s, lx + 0.06 * s, Yb, Yb + 0.05 * s, Lp[2] - 0.04 * s, Lp[2] + 0.12 * s, DARK); flush();
      box(lx - 0.02 * s, lx + 0.02 * s, Yb + 0.05 * s, Lp[1], Lp[2] + 0.06 * s, Lp[2] + 0.1 * s, [90, 96, 120]); flush();
      // conical shade (frustum) opening downward, its bulb hidden inside
      { const P0 = add(Lp, ldir, -0.1 * s), n = 16;
        const r0 = circ(P0, 0.04 * s, n), r1 = circ(P1, rm, n), mid = add(Lp, ldir, -0.02 * s);
        for (let i = 0; i < n; i++) face([r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]], [200, 140, 40], mid, false);
        face(r0, [150, 105, 30], add(P0, ldir, 1));
        flush();
      }
      ctx.globalAlpha = ap * 0.45; this.ellipse(cx, Ay, Zf + 0.003 * s, 1.0 * s, 'rgba(0,0,0,0.85)');
      ctx.globalAlpha = a;
    };
    // ---- the deck around the opening and the mechanical room's outer walls
    const deck = () => {
      ctx.globalAlpha = ap;
      const ox0 = X0 - rim, ox1 = X1 + rim, oy0 = Yb - rim, oy1 = Yf + rim, zb = Zf - 0.12 * s;
      face([[ox1, oy0, zb], [ox1, oy1, zb], [ox1, oy1, Z0], [ox1, oy0, Z0]], [40, 44, 68], [ox1 - 1, Ay, Z0]);   // right outer wall
      face([[ox0, oy1, zb], [ox1, oy1, zb], [ox1, oy1, Z0], [ox0, oy1, Z0]], [40, 44, 68], [cx, oy1 - 1, Z0]);   // front outer wall
      flush();
      for (const k of [0.25, 0.5, 0.75]) {                                   // structural ribs on the outer walls
        const y = oy0 + (oy1 - oy0) * k, x = ox0 + (ox1 - ox0) * k;
        box(ox1, ox1 + 0.06 * s, y - 0.06 * s, y + 0.06 * s, zb, Z0, [52, 57, 88]); flush();
        box(x - 0.06 * s, x + 0.06 * s, oy1, oy1 + 0.06 * s, zb, Z0, [52, 57, 88]); flush();
      }
      // deck top with the hatch opening cut out
      const outer = [[ox0, oy0], [ox1, oy0], [ox1, oy1], [ox0, oy1]].map(([x, y]) => this.project(x, y, Z0));
      const hole = [[X0, Yb], [X0, Yf], [X1, Yf], [X1, Yb]].map(([x, y]) => this.project(x, y, Z0));
      ctx.beginPath();
      for (const poly of [outer, hole]) { ctx.moveTo(poly[0][0], poly[0][1]); for (const q of poly.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); }
      ctx.fillStyle = 'rgb(58,63,96)'; ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(140,150,200,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      // hazard stripes around the rim of the opening
      const zt = Z0 + 0.002 * s, w = 0.13 * s, edges = [[[X0, Yb], [X1, Yb], [0, -1]], [[X1, Yb], [X1, Yf], [1, 0]], [[X1, Yf], [X0, Yf], [0, 1]], [[X0, Yf], [X0, Yb], [-1, 0]]];
      for (const [p0, p1, [nx, ny]] of edges) {
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.round(len / (0.2 * s)), ux = (p1[0] - p0[0]) / len, uy = (p1[1] - p0[1]) / len;
        for (let i = 0; i < n; i++) {
          const t0 = i * len / n, t1 = (i + 1) * len / n, sk = 0.08 * s;
          face([[p0[0] + ux * t0 + nx * w, p0[1] + uy * t0 + ny * w, zt], [p0[0] + ux * t1 + nx * w, p0[1] + uy * t1 + ny * w, zt],
                [p0[0] + ux * (t1 - sk), p0[1] + uy * (t1 - sk), zt], [p0[0] + ux * (t0 - sk), p0[1] + uy * (t0 - sk), zt]], i % 2 ? RUB : YEL, [p0[0], p0[1], zt - 1], false, true);
        }
      }
      flush();
      // deck bolts
      for (const [x, y] of [[ox0 + 0.2 * s, oy1 - 0.2 * s], [ox1 - 0.2 * s, oy1 - 0.2 * s], [ox1 - 0.2 * s, oy0 + 0.2 * s], [cx, oy1 - 0.2 * s], [ox1 - 0.2 * s, Ay]]) {
        cyl([x, y, Z0], [x, y, Z0 + 0.04 * s], 0.06 * s, 6, BOLT, false, true); flush(); }
      ctx.globalAlpha = a;
    };
    const mech = () => {

    // 1. foundation slab with hazard chevrons on its front strip
    box(cx - 0.85 * s, cx + 0.85 * s, Ay - 0.7 * s, Ay + 0.7 * s, Zf, Zf + slabT, STEEL); flush();
    for (let i = 0; i < 8; i++) {
      const x0 = cx - 0.85 * s + i * 0.2125 * s, zt = Zf + slabT + 0.002 * s, y0 = Ay + 0.52 * s, y1 = Ay + 0.68 * s;
      face([[x0, y1, zt], [x0 + 0.1 * s, y1, zt], [x0 + 0.16 * s, y0, zt], [x0 + 0.06 * s, y0, zt]], i % 2 ? RUB : YEL, [x0, y0, Zf]);
    }
    flush();
    // anchor bolts (hex heads + washers)
    const bolt = (x, y) => { disc([x, y, Zf + slabT + 0.002 * s], 'z', 0.1 * s, 12, DARK); cyl([x, y, Zf + slabT], [x, y, Zf + slabT + 0.07 * s], 0.065 * s, 6, BOLT, true); };
    for (const [x, y] of [[-0.68, -0.53], [0.68, -0.53]]) bolt(cx + x * s, Ay + y * s);
    flush();
    for (const [x, y] of [[-0.68, 0.36], [0.68, 0.36]]) bolt(cx + x * s, Ay + y * s);
    flush();
    // 2. hydraulic pump with a pressure gauge, on the far side of the slab
    const pz0 = Zf + slabT, pz1 = pz0 + 0.42 * s, px0 = cx - 0.8 * s, px1 = cx - 0.52 * s, py0 = Ay - 0.55 * s, py1 = Ay - 0.05 * s;
    box(px0, px1, py0, py1, pz0, pz1, PUMP); flush();
    box(px0 + 0.03 * s, px1 - 0.03 * s, py0 + 0.05 * s, py1 - 0.05 * s, pz1, pz1 + 0.05 * s, DARK); flush();
    disc([px1 - 0.14 * s, py1 + 0.004 * s, pz0 + 0.24 * s], 'y', 0.1 * s, 16, [235, 238, 245]);
    disc([px1 - 0.14 * s, py1 + 0.006 * s, pz0 + 0.24 * s], 'y', 0.02 * s, 8, [30, 30, 40]);
    flush();
    { const ang = -0.6 + 0.9 * b.tilt, gx = px1 - 0.14 * s, gz = pz0 + 0.24 * s, gy = py1 + 0.008 * s;   // needle climbs with the pressure
      face([[gx - 0.008 * s, gy, gz], [gx + 0.008 * s, gy, gz], [gx + Math.sin(ang) * 0.085 * s, gy, gz + Math.cos(ang) * 0.085 * s]], [230, 40, 60], [gx, gy - 1, gz]); flush(); }
    // 3. pressure hose from the pump up to the barrel's port (far side of the barrel)
    { const e1 = norm(cross(d, [0, 0, 1])), port = add(add(P, d, barrel * 0.62), e1, (d[1] >= 0 ? 0.3 : -0.3) * s);
      const H0 = [cx - 0.66 * s, Ay - 0.3 * s, pz1 + 0.05 * s], C1 = [H0[0], H0[1], H0[2] + 0.5 * s], C2 = add(port, [-0.35 * s, 0, 0]);
      const bez = t => { const u = 1 - t; return [0, 1, 2].map(i => u * u * u * H0[i] + 3 * u * u * t * C1[i] + 3 * u * t * t * C2[i] + t * t * t * port[i]); };
      let q0 = bez(0);
      for (let i = 1; i <= 10; i++) { const q1 = bez(i / 10); cyl(q0, q1, 0.05 * s, 8, HOSE, false, false); q0 = q1; }
      flush();
    }
    // 4. far clevis plate
    const clev = x0 => { box(x0, x0 + 0.1 * s, Ay - 0.34 * s, Ay + 0.34 * s, Zf + slabT, Pz + 0.3 * s, DARK);
      // triangular gussets
      const gx = x0 + 0.05 * s, zt = Zf + slabT;
      face([[gx - 0.03 * s, Ay - 0.34 * s, zt], [gx - 0.03 * s, Ay - 0.56 * s, zt], [gx - 0.03 * s, Ay - 0.34 * s, zt + 0.42 * s]], STEEL, [gx + 1, Ay, zt]);
      face([[gx + 0.03 * s, Ay - 0.34 * s, zt], [gx + 0.03 * s, Ay - 0.56 * s, zt], [gx + 0.03 * s, Ay - 0.34 * s, zt + 0.42 * s]], STEEL, [gx - 1, Ay, zt]); };
    clev(cx - 0.46 * s); flush();
    // 5. the ram itself: barrel, gland, hazard collar, chrome rod, upper bracket
    const T = (x, y, z) => xf(x, y, z);
    const by = Y0 - 2.2 * s;
    box(cx - 0.3 * s, cx - 0.2 * s, by - 0.26 * s, by + 0.26 * s, Z0 - 0.34 * s, Z0, DARK, T); flush();
    cyl(add(P, d, -0.12 * s), M, 0.3 * s, 18, [74, 80, 116], true, true, 4);
    if (sleeve > 0.01 * s) cyl(add(M, d, 0.04 * s), M2, 0.22 * s, 16, [96, 104, 132], true, true, Math.max(1, Math.ceil(sleeve / (0.3 * s))));
    cyl(add(P, d, 0.18 * s), add(P, d, 0.3 * s), 0.33 * s, 18, STEEL, false, true);           // base ring
    if (barrel > 0.5 * s) cyl(add(M, d, -0.28 * s), add(M, d, -0.04 * s), 0.34 * s, 18, YEL, false, true);  // hazard collar
    cyl(add(M, d, -0.04 * s), add(M, d, 0.06 * s), 0.24 * s, 18, STEEL, true, true);          // gland nut
    if (sleeve > 0.01 * s) cyl(add(M2, d, -0.04 * s), add(M2, d, 0.04 * s), 0.25 * s, 16, YEL, false, true);   // stage-2 collar
    if (L > barrel + sleeve + 0.01 * s) cyl(add(M2, d, 0.04 * s), B, 0.14 * s, 16, CHROME, true, false, Math.max(1, Math.ceil((L - barrel - sleeve) / (0.3 * s))));
    cyl(add(B, [-0.18 * s, 0, 0]), add(B, [0.18 * s, 0, 0]), 0.12 * s, 14, STEEL, false, true);   // rod-end eye
    flush();
    box(cx + 0.2 * s, cx + 0.3 * s, by - 0.26 * s, by + 0.26 * s, Z0 - 0.34 * s, Z0, DARK, T); flush();
    cyl([cx + 0.3 * s, B[1], B[2]], [cx + 0.36 * s, B[1], B[2]], 0.08 * s, 6, BOLT, false, true); flush();
    // 6. near clevis plate and the lower pivot pin's nut
    clev(cx + 0.36 * s); flush();
    cyl([cx + 0.46 * s, Ay, Pz], [cx + 0.52 * s, Ay, Pz], 0.15 * s, 6, BOLT, false, true);
    cyl([cx + 0.52 * s, Ay, Pz], [cx + 0.56 * s, Ay, Pz], 0.07 * s, 12, CHROME, true, true);
    flush();
    };
    ctx.globalAlpha = a;
    pit();
    ctx.globalAlpha = ap; phase = 0; mech(); beam();
    phase = -1; deck();
    ctx.globalAlpha = ap; phase = 1; mech();
    ctx.globalAlpha = 1;
  },

  // Fog of War: 0 = mark in plain sight .. 1 = hidden under fog. Fog rolls in once the next move has
  // landed and lifts when the game ends.
  fogLevel(b, k, c, now) {
    const at = b.fogAt ? b.fogAt[k] : null;
    const fogged = at != null && b.moves - at >= 1 && c.owner !== 'W' && c.owner !== '#';
    if (!fogged) { c.fogT = null; return 0; }
    if (c.fogT == null) c.fogT = now;
    const T = TIMING.board;
    const inK = Ease.inOutCubic(clamp01((now - c.fogT) / T.fogCover));
    if (b.fogLift) return inK * (1 - Ease.inOutCubic(clamp01((now - b.fogLift) / T.fogLift)));
    if (b.winner) return inK * clamp01(1 - (now - b.winTime) / T.fogWinFade);
    return inK;
  },
  // 0..1 progress of the fog evaporating at the end of a Fog of War game
  fogRise(b, now) { return b.fogLift ? clamp01((now - b.fogLift) / TIMING.board.fogLift) : 0; },

  // the end of a Fog of War game: wisps of fog curl up off every fogged square and thin away
  fogEvaporate(b, cells) {
    if (typeof Fx === 'undefined' || !b.geo) return;
    const px = b.geo.s * this.zm;
    for (const k of cells) {
      const [x, y] = this.cellScreen(b, k);
      for (let n = 0; n < 16; n++) {
        const d = n * 45 + Math.random() * 60;
        setTimeout(() => Fx.add({
          x: x + (Math.random() - 0.5) * px * 0.6, y: y - px * 0.15 + (Math.random() - 0.5) * px * 0.25,
          vx: (Math.random() - 0.5) * px * 0.5, vy: -px * (0.5 + Math.random() * 0.7),
          r0: px * 0.12, r1: px * (0.35 + Math.random() * 0.25), c: '226,230,246', a: 0.55,
          life: 1300 + Math.random() * 900, drag: 0.97, g: -px * 0.25,
        }), d);
      }
    }
  },

  // a soft rolling cloud sitting on a square
  fogCloud(cx, cy, z, s, alpha, seed, now) {
    const ctx = this.ctx, px = s * this.zm;
    ctx.save();
    for (let n = 0; n < 9; n++) {
      const th = (n / 9) * Math.PI * 2 + now / (2600 + seed * 90) * (n % 2 ? 1 : -1);
      const rr = (n === 8 ? 0 : 0.2) * s;
      const zz = z + (0.08 + 0.12 * ((n * 7 + seed) % 3) / 2) * s + Math.sin(now / 900 + n + seed) * 0.02 * s;
      const [x, y] = this.project(cx + rr * Math.cos(th), cy + rr * Math.sin(th), zz);
      const r = px * (n === 8 ? 0.34 : 0.24) * (1 + 0.08 * Math.sin(now / 700 + n * 2 + seed));
      const gr = ctx.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
      gr.addColorStop(0, `rgba(236,238,248,${0.85 * alpha})`);
      gr.addColorStop(0.55, `rgba(200,206,226,${0.6 * alpha})`);
      gr.addColorStop(1, 'rgba(180,186,210,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  // which way square k's mark moves at the next Shifting Squares / Ring Spin / Crossfire move (or null)
  moverDir(b, k) {
    if (b.rule === 'shift') {
      if (!b.shift || !lineCells(b.shift.axis, b.shift.idx).includes(k)) return null;
      return b.shift.axis === 'row' ? [b.shift.dir, 0] : [0, b.shift.dir];
    }
    if (b.rule === 'ring') {
      const n = RING.indexOf(k); if (n < 0) return null;
      const to = RING[(n + 1) % 8];
      return [(to % 3) - (k % 3), ((to / 3) | 0) - ((k / 3) | 0)];
    }
    if (b.rule === 'cross') {
      if (![0, 2, 6, 8].includes(k)) return null;
      const to = 8 - k, r = Math.SQRT1_2;
      return [Math.sign((to % 3) - (k % 3)) * r, Math.sign(((to / 3) | 0) - ((k / 3) | 0)) * r];
    }
    return null;
  },

  // how brightly square k is lit by the Wild Square roulette right now (0..1)
  wildLit(b, k, now) {
    const st = b.wildIntro.steps, n = st.length;
    if (now < st[0].t) return 0;
    let i = n - 1;
    while (i > 0 && st[i].t > now) i--;
    if (i === n - 1) {
      // the last square holds its light, pulsing, until the mark lands, then fades
      if (st[i].k !== k) return 0;
      const land = b.wildIntro.drop + TIMING.board.markImpact;
      return now < land ? 0.75 + 0.25 * Math.sin((now - st[i].t) / 60) : clamp01(1 - (now - land) / TIMING.board.wildLightFade);
    }
    // the current square is full on; the previous one leaves a short trail
    if (st[i].k === k) return 1;
    if (i > 0 && st[i - 1].k === k) return 0.45 * clamp01(1 - (now - st[i].t) / TIMING.board.wildStepTrail);
    return 0;
  },

  // the wild mark hitting its square: a ring of dust puffing out from under its edges
  wildImpact(cx, cy, z, s) {
    if (typeof Sound !== 'undefined') { Sound.land(0); Sound.poof(); }
    this.shake(5);
    if (typeof Fx === 'undefined') return;
    const px = s * this.zm, [ox, oy] = this.project(cx, cy, z);
    for (let n = 0; n < 48; n++) {
      const th = (n / 48) * Math.PI * 2 + Math.random() * 0.2, r = 0.38 * s;
      const [x, y] = this.project(cx + r * Math.cos(th), cy + r * Math.sin(th), z);
      let vx = x - ox, vy = y - oy; const d = Math.hypot(vx, vy) || 1; vx /= d; vy /= d;
      const sp = px * (0.7 + Math.random() * 1.0), sh = (175 + Math.random() * 45) | 0;
      Fx.add({ x, y, vx: vx * sp, vy: vy * sp - px * 0.25, r0: px * 0.06, r1: px * (0.2 + Math.random() * 0.14), c: `${sh + 30},${sh + 18},${sh}`, a: 0.8, life: 900 + Math.random() * 700, drag: 0.9, g: 12 });
    }
  },

  // dust puffing out around the edges of the board as it locks upright
  lockPuff(b) {
    if (typeof Fx === 'undefined') return;
    const g = b.geo, s = g.s, pad = GEO.pad * s, prev = this.xf;
    this.xf = tiltXf(b, 1);
    const zb = g.oz + GEO.baseH * s;
    const corners = rect(g.ox - pad, g.oy - pad, g.ox + 3 * s + pad, g.oy + 3 * s + pad).map(([x, y]) => this.project(x, y, zb));
    const [cx, cy] = this.project(g.ox + 1.5 * s, g.oy + 1.5 * s, zb);
    this.xf = prev;
    const px = s * this.zm;
    for (let e = 0; e < 4; e++) {
      const p0 = corners[e], p1 = corners[(e + 1) % 4];
      for (let n = 0; n < 9; n++) {
        const t = Math.random(), x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t;
        let vx = x - cx, vy = y - cy; const d = Math.hypot(vx, vy) || 1; vx /= d; vy /= d;
        const sp = px * (0.6 + Math.random() * 0.9);
        const sh = (160 + Math.random() * 50) | 0;
        Fx.add({ x, y, vx: vx * sp, vy: vy * sp - px * 0.2, r0: px * 0.08, r1: px * (0.25 + Math.random() * 0.2), c: `${sh + 30},${sh + 15},${sh}`, a: 0.6, life: 900 + Math.random() * 700, drag: 0.9, g: 20 });
      }
    }
  },

  // how much a footprint's y axis still points toward the viewer under the current tilt (1 flat .. -1 upright)
  tk() { return this.xf ? this.xf.c - this.xf.s : 1; },

  ellipse(cx, cy, z, r, fill) {
    const pts = [];
    for (let n = 0; n < 24; n++) {
      const th = (n / 24) * Math.PI * 2;
      pts.push(this.project(cx + r * Math.cos(th), cy + r * Math.sin(th), z));
    }
    this.fillPoly(pts, fill);
  },

  piece(owner, cx, cy, z, s, alpha, drop, pulse, wk = 1, hk = 1) {
    if (alpha <= 0.003) return;
    const ctx = this.ctx;
    const c = PIECE_COL[owner];
    const px = s * this.zm;
    const lift = drop / s;
    const shadowK = 1 / (1 + lift * 1.5);
    ctx.globalAlpha = alpha * 0.5 * shadowK;
    this.ellipse(cx, cy, z + 0.002 * s, 0.34 * s * (0.55 + 0.45 * shadowK), 'rgba(0,0,0,0.9)');
    ctx.globalAlpha = alpha;
    const zz = z + drop, h = GEO.pieceH * s * hk;
    const breathe = 0.04 * Math.sin(this.now / 650 + cx * 9 + cy * 5);
    const glow = Math.min(46, px * (0.12 + breathe + 0.18 * pulse));
    const opts = { glow, topDl: 6 + 14 * pulse, stroke: 'rgba(255,255,255,0.55)', lw: Math.max(0.6, px * 0.012) };
    if (owner === 'W') {
      // wild square: a spinning mark that morphs X -> O -> X
      this.wildMark(cx, cy, zz, zz + h * 0.9, s * wk, cx * 3 + cy * 7, { ...opts, glow: glow + 8, topDl: 16 });
    } else if (owner === '#') {
      // dead square: a cracked stone slab
      const w = 0.33 * s * wk;
      this.prism(rect(cx - w, cy - w, cx + w, cy + w), zz, zz + h * 1.25, c, { topDl: 0, stroke: 'rgba(255,255,255,0.35)', lw: Math.max(0.6, px * 0.012) });
      const zt = zz + h * 1.25;
      const crack = [[-0.8, -0.5], [-0.3, -0.1], [0.05, -0.35], [0.35, 0.15], [0.8, 0.4]].map(([u, v]) => this.project(cx + u * w, cy + v * w, zt));
      const ctx2 = this.ctx;
      ctx2.strokeStyle = 'rgba(30,20,50,0.85)';
      ctx2.lineWidth = Math.max(1, px * 0.025);
      ctx2.beginPath(); crack.forEach(([x, y], i) => (i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y))); ctx2.stroke();
    } else if (owner === 'X') {
      // Cross footprint rotated 45° so its arms run corner-to-corner across the tile (reads as an X).
      const a = 0.085 * s * wk, b = 0.42 * s * wk, r = Math.SQRT1_2;
      const pts = [[a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a], [-a, -b]]
        .map(([u, v]) => [cx + (u - v) * r, cy + (u + v) * r]);
      this.prism(pts, zz, zz + h, c, opts);
    } else {
      this.ring(cx, cy, 0.32 * s * wk, 0.185 * s * wk, zz, zz + h, c, opts);
    }
  },

  // Wild square mark: four strips that are the arms of an X and unroll into the quarter arcs of an O.
  wildMark(cx, cy, z0, z1, s, seed, opts) {
    const P = 3600, ph = ((this.now + seed * 500) % P) / P;            // hold X, morph, hold O, morph back
    const tri = ph < 0.15 ? 0 : ph < 0.5 ? (ph - 0.15) / 0.35 : ph < 0.65 ? 1 : 1 - (ph - 0.65) / 0.35;
    const m = tri * tri * (3 - 2 * tri);
    const rot = this.now / 1100 + seed;
    const ax = 0.085 * s, bx = 0.42 * s;                               // X arm half-width and length
    const rm = 0.2525 * s, ho = 0.0675 * s;                             // O mid radius and half-width
    const c = { h: (322 - 134 * m + 360) % 360, s: 100, l: 62 - 10 * m };
    const M = 14, strips = [];
    for (let k = 0; k < 4; k++) {
      const phi = rot + Math.PI / 4 + (k * Math.PI) / 2;
      const mid = [];
      for (let i = 0; i <= M; i++) {
        const t = i / M;
        const xr = bx * t, xx = xr * Math.cos(phi), xy = xr * Math.sin(phi);
        const ps = phi + (t - 0.5) * (Math.PI / 2), ox = rm * Math.cos(ps), oy = rm * Math.sin(ps);
        mid.push([xx + (ox - xx) * m, xy + (oy - xy) * m]);
      }
      const hw = ax + (ho - ax) * m, L = [], R = [];
      for (let i = 0; i <= M; i++) {
        const a = mid[Math.max(0, i - 1)], b = mid[Math.min(M, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        L.push([cx + mid[i][0] - ty * hw, cy + mid[i][1] + tx * hw]);
        R.push([cx + mid[i][0] + ty * hw, cy + mid[i][1] - tx * hw]);
      }
      let pts = L.concat(R.reverse());
      let area = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
      if (area < 0) pts = pts.reverse();
      strips.push(pts);
    }
    // caps: the X's inner ends meet in the middle and the O's ends butt together, so hide them there
    const capIn = m > 0.12 && m < 0.88, capOut = m < 0.88;
    const xf = this.xf, tk = xf ? xf.c - xf.s : 1, faces = [];
    for (const pts of strips) {
      const n = pts.length, half = n / 2;
      for (let i = 0; i < n; i++) {
        // edge half-1 -> half is one end cap, edge n-1 -> 0 the other
        if ((i === half - 1 || i === n - 1) && !(capIn && capOut)) {
          const a0 = pts[i], b0 = pts[(i + 1) % n];
          const r = Math.hypot((a0[0] + b0[0]) / 2 - cx, (a0[1] + b0[1]) / 2 - cy);
          const outer = r > 0.2 * s;
          if (outer ? !capOut : !capIn) continue;
        }
        const a = pts[i], b = pts[(i + 1) % n];
        const nx = b[1] - a[1], ny = -(b[0] - a[0]);
        if (nx + ny * tk > 1e-15) faces.push({ a, b, d: a[0] + a[1] * tk + b[0] + b[1] * tk, nx, ny });
      }
    }
    faces.sort((f, g) => f.d - g.d);
    for (const f of faces) {
      const q = [this.project(f.a[0], f.a[1], z0), this.project(f.b[0], f.b[1], z0),
                 this.project(f.b[0], f.b[1], z1), this.project(f.a[0], f.a[1], z1)];
      const fill = this.sideShade(c, f.nx, f.ny);
      this.fillPoly(q, fill, fill, 0.6);
    }
    const ctx = this.ctx, tops = strips.map((pts) => pts.map((p) => this.project(p[0], p[1], z1)));
    // outline first at double width, then the fills cover the inner half and the seams between strips
    if (opts.stroke) tops.forEach((t) => this.fillPoly(t, null, opts.stroke, (opts.lw || 1) * 2));
    if (opts.glow) { ctx.shadowColor = col(c, 5); ctx.shadowBlur = opts.glow; }
    tops.forEach((t) => this.fillPoly(t, col(c, opts.topDl || 0)));
    if (opts.glow) ctx.shadowBlur = 0;
  },

  // ---------- scene ----------
  drawBoard(b, now, cur) {
    const g = b.geo, s = g.s, px = s * this.zm;
    if (px < 0.5) return;
    const ctx = this.ctx;
    const hue = levelHue(b.level);
    const tileC = { h: hue, s: 62, l: 25 };
    const baseC = { h: hue, s: 55, l: 15 };
    const edge = col({ h: hue, s: 100, l: 70 }, 0, 0.85);
    const pendingChild = b.cells.map(shownChild).find(Boolean) || null;

    // Ancestors far bigger than the screen: their tile top fills everything.
    if (px > Math.max(this.W, this.H) * 25) {
      if (pendingChild) {
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = col({ h: hue, s: 70, l: 32 });
        ctx.fillRect(0, 0, this.W, this.H);
        ctx.globalAlpha = 1;
        this.drawBoard(pendingChild, now, cur);
      }
      return;
    }

    // Gravity: ease the board up to vertical (and back down once the game is over)
    if (b.level === 0) {
      const want = wantsUpright(b) ? 1 : 0;
      if (b.tilt === undefined) b.tilt = 0;
      const dtt = Math.min(100, now - (b.tiltLast || now)); b.tiltLast = now;
      const RAISE = TIMING.board.gravityRaise;
      if (want && !b.tiltStarted) {
        b.tiltStarted = true; b.tiltFrom = b.tilt; b.tiltT = now + TIMING.board.gravityRaiseDelay;
        if (b === cur) this.flyTo(viewOf(b), TIMING.camera.gravityTilt);
        if (typeof Sound !== 'undefined' && Sound.hydraulic && b.tilt < 0.9) setTimeout(() => Sound.hydraulic(RAISE / 1000), 300);
      }
      if (want && b.tiltStarted) {
        // hydraulic: a slow, smooth push that eases in and out, then the board locks into place
        const q = clamp01((now - b.tiltT) / RAISE);
        b.tilt = lerp(b.tiltFrom, 1, Ease.inOutCubic(q));
        if (q >= 1 && !b.tiltLanded) {
          b.tiltLanded = true;
          if (b === cur && b.tiltFrom < 0.9) { this.shake(7); this.lockPuff(b); if (typeof Sound !== 'undefined' && Sound.clunk) Sound.clunk(); }
        }
      } else if (!want) {
        b.tiltStarted = false; b.tiltLanded = false;
        b.tilt = Math.max(0, b.tilt - dtt / TIMING.board.gravityLower);
      }
    }
    const prevXf = this.xf;
    this.xf = tiltXf(b, b.tilt);
    const upright = b.tilt > 0.5;
    const late = [];
    if (upright) { b.quads = []; b.quadsAbove = []; } else { b.quads = null; }

    const a = b.alpha;
    const zb = g.oz + GEO.baseH * s, zt = g.top, pad = GEO.pad * s;
    if (b.level === 0 && b.tilt > 0.003 && a > 0.003) { this.xf = null; this.hydraulics(b, a); this.xf = tiltXf(b, b.tilt); }
    if (a > 0.003) {
      ctx.globalAlpha = a;
      const basePts = rect(g.ox - pad, g.oy - pad, g.ox + 3 * s + pad, g.oy + 3 * s + pad);
      this.prism(basePts, g.oz, zb, baseC, { stroke: col({ h: hue, s: 100, l: 60 }, 0, 0.6), lw: Math.max(1, px * 0.02) });
      if (b === cur && !b.winner) {
        const pc = PIECE_COL[b.turn];
        const pulse = 0.5 + 0.5 * Math.sin(now / 320);
        const top = basePts.map((p) => this.project(p[0], p[1], zb));
        ctx.shadowColor = col(pc);
        ctx.shadowBlur = 10 + 14 * pulse;
        this.fillPoly(top, null, col(pc, 10, 0.55 + 0.4 * pulse), Math.max(2, px * 0.03));
        ctx.shadowBlur = 0;
      }
    }

    const wins = b.winLine ? new Set(b.winLine) : null;
    if (b.ghosts && b.ghosts.length) b.ghosts = b.ghosts.filter((gh) => now - gh.t < 460);
    const threats = b.level >= 1 && !b.winner ? threatsOf(b.cells.map((c) => c.owner)) : null;
    const tkk = this.tk();
    const order = this.xf ? ORDER.slice().sort((p, q) => ((p % 3) + ((p / 3) | 0) * tkk) - ((q % 3) + ((q / 3) | 0) * tkk)) : ORDER;
    for (const k of order) {
      const c = b.cells[k];
      const i = k % 3, j = (k / 3) | 0;
      const p = clamp01((now - b.born - k * 45) / 450);
      let tz = (Ease.outBack(p) - 1) * 0.9 * s;
      if (b.waveT) {
        const wq = clamp01((now - b.waveT - (i + j) * 70) / 420);
        tz += Math.sin(wq * Math.PI) * (b.waveAmp || 0.25) * s;
      }
      const ta = a * clamp01(p * 2.5);
      const sub = shownChild(c);
      const hk = b === cur && b.level === 0 && b.rule === 'gravity' && this.hover >= 0 ? landingCell(b, this.hover) : this.hover;
      const hov = b === cur && k === hk && this.canHover && !c.owner && !c.child && !b.winner;
      const colHov = b === cur && b.rule === 'gravity' && this.canHover && hk >= 0 && !b.winner && i === hk % 3 && !hov;
      const inspect = b === cur && k === this.hover && this.canInspect && !sub && (c.record || c.child);
      const lift = hov ? 0.07 * s * (1 + 1.4 * Math.sin(clamp01((now - this.hoverT) / 260) * Math.PI) * (1 - clamp01((now - this.hoverT) / 260))) : 0;
      const gp = (GEO.gap * s) / 2;
      if (ta > 0.003) {
        ctx.globalAlpha = ta;
        let tc = tileC;
        if (sub) tc = { h: hue, s: 75, l: 34 };
        if (hov) tc = { h: PIECE_COL[b.turn].h, s: 75, l: 34 };
        if (colHov) tc = { h: PIECE_COL[b.turn].h, s: 45, l: 28 };
        if (inspect) tc = { h: hue, s: 80, l: 42 };
        // Wild Square intro: the roulette light running over the squares
        const wl = b.wildIntro ? this.wildLit(b, k, now) : 0;
        if (wl > 0) {
          tc = { h: (322 - 134 * (k % 2) + 360) % 360, s: 85, l: 30 + 34 * wl };
          ctx.shadowColor = `hsl(${tc.h},100%,70%)`; ctx.shadowBlur = 30 * wl;
        }
        // threat highlight: this square would complete a line
        let tEdge = null;
        if (threats && !c.owner) {
          const tx = threats.X.has(k), to = threats.O.has(k);
          if (tx || to) {
            const who = tx && to ? (Math.sin(now / 400) > 0 ? 'X' : 'O') : tx ? 'X' : 'O';
            const pc = PIECE_COL[who];
            const pul = 0.5 + 0.5 * Math.sin(now / 230 + k);
            if (!hov && !c.child) tc = { h: pc.h, s: 70, l: 22 + 10 * pul };
            tEdge = col(pc, 12, 0.6 + 0.4 * pul);
            ctx.shadowColor = col(pc);
            ctx.shadowBlur = 8 + 18 * pul;
          }
        }
        const pulseEdge = inspect ? `rgba(255,255,255,${0.7 + 0.3 * Math.sin(now / 150)})` : tEdge || edge;
        this.prism(rect(g.ox + i * s + gp, g.oy + j * s + gp, g.ox + (i + 1) * s - gp, g.oy + (j + 1) * s - gp),
          zb + tz, zt + tz + lift + (wl > 0 ? 0.05 * s * wl : 0), tc, { stroke: wl > 0 ? `rgba(255,255,255,${0.4 + 0.6 * wl})` : pulseEdge, lw: Math.max(1, px * (inspect || tEdge || wl > 0 ? 0.045 : 0.022)) });
        ctx.shadowBlur = 0;
      }
      if (upright) {
        b.quads[k] = rect(g.ox + i * s, g.oy + j * s, g.ox + (i + 1) * s, g.oy + (j + 1) * s).map(([x, y]) => this.project(x, y, zt));
        if (j === 0) b.quadsAbove[i] = rect(g.ox + i * s, g.oy - 1.6 * s, g.ox + (i + 1) * s, g.oy).map(([x, y]) => this.project(x, y, zt));
      }
      const cx = g.ox + (i + 0.5) * s, cy = g.oy + (j + 0.5) * s;
      const pz = zt + tz;
      // Shifting Squares / Ring Spin / Crossfire: chevrons on the squares that move next, stronger as it nears
      const mvDir = b.level === 0 && !b.winner && ta > 0.3 ? this.moverDir(b, k) : null;
      if (mvDir) {
        const left = SHIFT_EVERY - (b.moves % SHIFT_EVERY);
        const urg = left === 1 ? 1 : left === 2 ? 0.55 : 0.3;
        const pul = 0.5 + 0.5 * Math.sin(now / (left === 1 ? 110 : 260));
        const [dx, dy] = mvDir;
        // conveyor belt: the chevrons glide steadily along the direction of travel, fading in at the back
        // edge and out at the front, so the loop has no visible jump. The belt's position is kept per board
        // and advanced by elapsed time, so speeding up as the move nears never makes it skip.
        const BELT_N = 3, BELT_START = -0.42, BELT_SPAN = 0.7, gap = BELT_SPAN / BELT_N;
        if (b.beltLast !== now) {
          const per = left === 1 ? 260 : 600;     // ms for a chevron to move up one place
          b.beltPos = ((b.beltPos || 0) + Math.min(100, now - (b.beltLast || now)) / per) % 1;
          b.beltLast = now;
        }
        for (let i = 0; i < BELT_N; i++) {
          const u = BELT_START + (i + b.beltPos) * gap;
          const fade = Math.sin(Math.PI * (u - BELT_START) / BELT_SPAN);
          const tip = [cx + dx * (u + 0.14) * s, cy + dy * (u + 0.14) * s];
          const w1 = [cx + (dx * u - dy * 0.2) * s, cy + (dy * u + dx * 0.2) * s];
          const w2 = [cx + (dx * u + dy * 0.2) * s, cy + (dy * u - dx * 0.2) * s];
          const pts = [w1, tip, w2].map(([x, y]) => this.project(x, y, pz + 0.004 * s));
          ctx.globalAlpha = ta * (0.25 + 0.6 * urg) * (0.6 + 0.4 * pul) * fade;
          ctx.strokeStyle = left === 1 ? '#ffb347' : '#fff6c8';
          ctx.lineWidth = Math.max(1.5, px * 0.045);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); pts.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      const wildWait = c.owner === 'W' && b.wildIntro && now < c.t;
      if (c.owner === 'W' && b.wildIntro && !b.wildIntro.puffed && now >= c.t + TIMING.board.markImpact) {
        b.wildIntro.puffed = true;
        if (b === cur) this.wildImpact(cx, cy, pz, s);
      }
      if (b.wildIntro && now > b.wildIntro.end + 400) b.wildIntro = null;
      if (c.owner && !wildWait) {
        const dp = clamp01((now - c.t) / TIMING.board.markDrop);
        const drop = (1 - Ease.outBounce(dp)) * 1.8 * s;
        // squash & stretch: tall and thin while falling, squashed flat on impact, then wobble
        const HIT = 1 / 2.75;
        let sq = 0;
        if (dp < HIT) sq = -0.22 * (dp / HIT);
        else if (dp < 1) { const l = (dp - HIT) / (1 - HIT); sq = Math.cos(l * Math.PI * 3.2) * Math.exp(-l * 3.5) * 0.42; }
        const pulse = wins && wins.has(k) ? 0.5 + 0.5 * Math.sin((now - b.winTime) / 110) : 0;
        const hideK = sub && sub === c.record ? 1 - sub.alpha : 1; // cross-fade with the replayed game
        // Level 0: telegraph the mark that vanishes next (the mover's oldest flickers hard)
        let fade = 1;
        const hist = b.level === 0 && !b.winner && b.hist ? b.hist[c.owner] : null;
        if (hist && hist.length >= (b.keep ? b.keep[c.owner] : KEEP_MARKS_R) && hist[0] === k) {
          const strong = b.turn === c.owner;
          fade = strong ? 0.55 + 0.3 * Math.sin(now / 70) : 0.8 + 0.1 * Math.sin(now / 200);
          if (strong && b === cur) {
            const pts = [];
            const rr = 0.44 * s * (1 + 0.05 * Math.sin(now / 120));
            for (let n = 0; n < 28; n++) { const th = (n / 28) * Math.PI * 2 + now / 900; pts.push(this.project(cx + rr * Math.cos(th), cy + rr * Math.sin(th), pz + 0.01 * s)); }
            ctx.globalAlpha = a * 0.9;
            ctx.setLineDash([Math.max(2, px * 0.05), Math.max(2, px * 0.04)]);
            this.fillPoly(pts, null, 'rgba(255,255,255,0.85)', Math.max(1, px * 0.02));
            ctx.setLineDash([]);
          }
        }
        let pcx = cx, pcy = cy, hop = 0;
        if (c.slide) {
          const q = clamp01((now - c.slide.t) / (c.slide.dur || TIMING.board.slide));
          if (q >= 1) c.slide = null;
          else { const e = 1 - Ease.outCubic(q); pcx += c.slide.dx * e * s; pcy += c.slide.dy * e * s; hop = Math.sin(q * Math.PI) * 0.25 * (c.slide.hop || 1) * s; }
        }
        if (upright) {
          // Connect Four: the disc drops in from above the frame, down its column, and bounces to rest
          const fall = (1 - Ease.outBounce(dp)) * (j + 1.6) * s;
          const al = a * hideK * fade * clamp01(dp * 5) * clamp01(p * 2.5);
          late.push(() => this.piece(c.owner, pcx, pcy - fall, pz, s, al, hop, pulse, 1, 1));
        } else {
          const fg = b.rule === 'fog' ? this.fogLevel(b, k, c, now) : 0;
          this.piece(c.owner, pcx, pcy, pz, s, a * hideK * fade * clamp01(dp * 5) * clamp01(p * 2.5) * (1 - fg), drop + hop, pulse, 1 + sq * 0.55, 1 - sq);
          if (fg > 0.01) { const rise = this.fogRise(b, now); this.fogCloud(pcx, pcy, pz + hop + rise * rise * 0.9 * s, s * (1 + rise * 0.5), a * fg, k, now); }
        }
      } else if (hov && upright) {
        // hover: the disc waits above the slot at the top of the column
        const bob = (0.5 + 0.5 * Math.sin(now / 180)) * 0.12 * s;
        const hp = Ease.outBack(clamp01((now - this.hoverT) / 220));
        const ax = cx, ay = g.oy - 0.75 * s - bob;
        late.push(() => {
          // a faint guide down the column to where it will land
          const p0 = this.project(ax, ay + 0.35 * s, pz + 0.01 * s), p1 = this.project(cx, cy, pz + 0.01 * s);
          ctx.globalAlpha = a * 0.35; ctx.setLineDash([Math.max(3, px * 0.06), Math.max(3, px * 0.06)]);
          ctx.strokeStyle = col(PIECE_COL[b.turn], 15); ctx.lineWidth = Math.max(1.5, px * 0.03);
          ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.setLineDash([]);
          this.piece(b.turn, ax, ay, pz, s, 0.75 * a, 0, 0, 0.6 + 0.4 * hp, hp);
        });
      } else if (hov) {
        const bob = (0.5 + 0.5 * Math.sin(now / 180)) * 0.12 * s;
        const hp = Ease.outBack(clamp01((now - this.hoverT) / 220));
        this.piece(b.turn, cx, cy, pz + lift, s, 0.4 * a, bob, 0, 0.6 + 0.4 * hp, hp);
      }
      if (b.ghosts && b.ghosts.length) {
        for (const gh of b.ghosts) {
          if (gh.k !== k) continue;
          const q = clamp01((now - gh.t) / TIMING.board.ghostFade);
          const gx = cx + (gh.dx || 0) * Ease.outCubic(q) * s, gy = cy + (gh.dy || 0) * Ease.outCubic(q) * s;
          this.piece(gh.owner, gx, gy, pz, s, a * (1 - q) * (q === 0 ? 0.6 : 1), q * 0.9 * s, q, 1 + q * 0.5, 1 - q * 0.7);
        }
      }
      // prize target selection
      const sel = this.select;
      if (sel && sel.b === b && sel.cands.has(k)) {
        const pul = 0.5 + 0.5 * Math.sin(now / 110);
        const colr = sel.kind === 'bomb' ? '255,110,40' : '255,210,63';
        const rr = 0.46 * s * (1 + (k === this.hover ? 0.12 : 0.04) * pul);
        const pts = [];
        for (let n = 0; n < 32; n++) { const th = (n / 32) * Math.PI * 2 - now / 600; pts.push(this.project(cx + rr * Math.cos(th), cy + rr * Math.sin(th), pz + 0.02 * s)); }
        ctx.globalAlpha = a;
        ctx.shadowColor = `rgb(${colr})`; ctx.shadowBlur = 18;
        ctx.setLineDash([Math.max(3, px * 0.08), Math.max(2, px * 0.05)]);
        this.fillPoly(pts, `rgba(${colr},${0.12 + 0.18 * pul})`, `rgba(${colr},${0.7 + 0.3 * pul})`, Math.max(2, px * (k === this.hover ? 0.05 : 0.03)));
        ctx.setLineDash([]); ctx.shadowBlur = 0;
      }
      // mystery-jackpot shimmer: every empty square twinkles now and then; the jackpot square a bit more often
      if (!c.owner && !sub && !b.winner && b.jackpot !== undefined && b.jackpot >= 0 && a > 0.3) {
        const isJ = k === b.jackpot;
        const period = 3400;
        const local = now + hash01(k * 7.13 + b.level * 3.7) * period;
        const slot = Math.floor(local / period), ph = (local % period) / period;
        // the jackpot square only twinkles a little more often than the rest
        if (ph < 0.25 && hash01(slot * 31.7 + k) < (isJ ? 0.32 : 0.2)) {
          const sz = Math.sin((ph / 0.25) * Math.PI) * 0.06 * px;
          const [sx, sy] = this.project(cx + (hash01(slot * 17.3 + k) - 0.5) * 0.6 * s, cy + (hash01(slot * 23.9 + k) - 0.5) * 0.6 * s, pz + 0.03 * s);
          ctx.globalAlpha = a * 0.6;
          this.twinkle(sx, sy, sz);
        }
      }
      // Developer Mode: mark the hidden jackpot square
      if (typeof Game !== 'undefined' && Game.dev.on && Game.dev.reveal && k === b.jackpot && !c.owner && !sub && !b.winner && a > 0.3) {
        const pts = [];
        const rr = 0.4 * s;
        for (let n = 0; n < 4; n++) { const th = (n / 4) * Math.PI * 2 + now / 700; pts.push(this.project(cx + rr * Math.cos(th), cy + rr * Math.sin(th), pz + 0.02 * s)); }
        ctx.globalAlpha = a;
        ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 14;
        ctx.setLineDash([Math.max(3, px * 0.06), Math.max(2, px * 0.04)]);
        this.fillPoly(pts, 'rgba(255,210,63,0.18)', 'rgba(255,210,63,0.95)', Math.max(2, px * 0.03));
        ctx.setLineDash([]); ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      if (sub) this.drawBoard(sub, now, cur);
    }

    for (const f of late) f();
    ctx.globalAlpha = 1;
    if (b.winLine && a > 0.003) {
      const p = clamp01((now - b.winTime) / 450);
      const ci = (k) => [g.ox + ((k % 3) + 0.5) * s, g.oy + (((k / 3) | 0) + 0.5) * s];
      const A = ci(b.winLine[0]), B = ci(b.winLine[2]);
      const ext = 0.32;
      const S = [A[0] - (B[0] - A[0]) * ext / 2, A[1] - (B[1] - A[1]) * ext / 2];
      const T = [B[0] + (B[0] - A[0]) * ext / 2, B[1] + (B[1] - A[1]) * ext / 2];
      const z = zt + GEO.pieceH * s * 1.15;
      const s0 = this.project(S[0], S[1], z);
      const s1 = this.project(lerp(S[0], T[0], Ease.outCubic(p)), lerp(S[1], T[1], Ease.outCubic(p)), z);
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.shadowColor = col(PIECE_COL[b.winner], 10);
      ctx.shadowBlur = 30;
      ctx.strokeStyle = col(PIECE_COL[b.winner], 15);
      ctx.lineWidth = Math.max(4, px * 0.14);
      ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.5, px * 0.045);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.xf = prevXf;
  },

  drawBackground(now, level) {
    const ctx = this.ctx, W = this.W, H = this.H, cy = this.centerY();
    const hue = (255 + level * 37) % 360;
    const g = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, Math.max(W, H) * 0.8);
    g.addColorStop(0, `hsl(${hue},75%,22%)`);
    g.addColorStop(0.5, `hsl(${(hue + 25) % 360},80%,10%)`);
    g.addColorStop(1, `hsl(${(hue + 45) % 360},90%,4%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Warp-tunnel stars: they stream outward as the camera zooms in.
    const maxR = Math.hypot(W, H) * 0.62;
    for (const st of this.stars) {
      const ph = fract(st.seed + this.cam.L * 0.55 + now * 0.000015);
      const r = (maxR * Math.pow(2, ph * 6)) / 64;
      const x = W / 2 + Math.cos(st.a) * r, y = cy + Math.sin(st.a) * r;
      const al = Math.sin(ph * Math.PI) * st.b;
      const sz = (0.6 + ph * 2.4) * st.sz;
      const streak = Math.min(r * 0.9, this.fx.warp * r * 0.5);
      if (streak > 2) {
        ctx.strokeStyle = `hsla(${st.hue},100%,85%,${al})`;
        ctx.lineWidth = sz;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(st.a) * streak * Math.sign(this.fx.warpDir || 1), y - Math.sin(st.a) * streak * Math.sign(this.fx.warpDir || 1));
        ctx.stroke();
      } else {
        ctx.fillStyle = `hsla(${st.hue},100%,85%,${al})`;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
  },

  twinkle(x, y, s) {
    if (s < 0.5) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = s * 1.5;
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    const pts = [[0, -1], [0.22, -0.22], [1, 0], [0.22, 0.22], [0, 1], [-0.22, 0.22], [-1, 0], [-0.22, -0.22]];
    pts.forEach(([u, v], i) => (i ? ctx.lineTo(u * s, v * s) : ctx.moveTo(u * s, v * s)));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  coins(x, y, n = 60) {
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 6 + Math.random() * 11;
      this.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, decay: 0.006 + Math.random() * 0.006,
        size: 7 + Math.random() * 5, rot: Math.random() * 6, vr: 0.2 + Math.random() * 0.3, hue: 46, coin: true });
    }
  },

  // ---------- juice ----------
  shake(a) { this.fx.shake = Math.max(this.fx.shake, a); },
  flash(a, rgb = '255,255,255') { this.fx.flash = Math.max(this.fx.flash, a); this.fx.flashRgb = rgb; },
  kick(a) { this.fx.kick += a; },
  ripple(b, k, owner, big = 1) {
    const g = b.geo, s = g.s;
    this.fx.ripples.push({ b, x: g.ox + ((k % 3) + 0.5) * s, y: g.oy + (((k / 3) | 0) + 0.5) * s, z: g.top + 0.002 * s, s: s * big, t: performance.now(), h: PIECE_COL[owner].h });
  },
  cellScreen(b, k) {
    const g = b.geo, prev = this.xf;
    this.xf = tiltXf(b, b.tilt);
    const r = this.project(g.ox + ((k % 3) + 0.5) * g.s, g.oy + (((k / 3) | 0) + 0.5) * g.s, g.top + (b.tilt > 0.5 ? GEO.pieceH * g.s : 0));
    this.xf = prev;
    return r;
  },
  floatText(x, y, text, owner, size = 34) {
    this.fx.texts.push({ x, y, text, h: owner ? PIECE_COL[owner].h : 48, size, t: performance.now() });
  },
  sparks(x, y, owner, n = 22, speed = 7) {
    const base = PIECE_COL[owner].h;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random());
      this.particles.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6 - 2,
        life: 1, decay: 0.03 + Math.random() * 0.03, spark: true,
        size: 2 + Math.random() * 3, rot: 0, vr: 0, hue: Math.random() < 0.3 ? 48 : base,
      });
    }
  },
  fireworks(owner, count = 4) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const x = this.W * (0.2 + Math.random() * 0.6), y = this.H * (0.2 + Math.random() * 0.35);
        this.burst(x, y, i % 2 ? owner : (owner === 'X' ? 'O' : 'X'), 70);
        this.shake(6);
        if (typeof Sound !== 'undefined') Sound.pop();
      }, 250 + i * 260);
    }
  },

  drawFx(now, dt) {
    const ctx = this.ctx;
    // shockwave rings on tile tops
    this.fx.ripples = this.fx.ripples.filter((rp) => {
      const p = (now - rp.t) / 600;
      if (p >= 1) return false;
      for (const [delay, w] of [[0, 1], [0.18, 0.6]]) {
        const q = clamp01((p - delay) / (1 - delay));
        if (q <= 0) continue;
        const R = rp.s * (0.25 + 0.75 * Ease.outCubic(q));
        this.xf = rp.b ? tiltXf(rp.b, rp.b.tilt) : null;
        const pts = [];
        for (let n = 0; n < 32; n++) {
          const th = (n / 32) * Math.PI * 2;
          pts.push(this.project(rp.x + R * Math.cos(th), rp.y + R * Math.sin(th), rp.z));
        }
        ctx.globalAlpha = (1 - q) * w;
        ctx.shadowColor = `hsl(${rp.h},100%,60%)`;
        ctx.shadowBlur = 16;
        this.fillPoly(pts, null, `hsl(${rp.h},100%,75%)`, Math.max(1.5, rp.s * this.zm * 0.05 * (1 - q)));
        ctx.shadowBlur = 0;
        this.xf = null;
      }
      return true;
    });
    ctx.globalAlpha = 1;
    // floating text
    this.fx.texts = this.fx.texts.filter((t) => {
      const p = (now - t.t) / 1300;
      if (p >= 1) return false;
      const sc = Ease.outBack(clamp01(p * 4)) * (1 + 0.15 * p);
      ctx.save();
      ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.translate(t.x, t.y - 70 * Ease.outCubic(p));
      ctx.scale(sc, sc);
      ctx.font = `700 ${t.size}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(20,0,40,0.85)';
      ctx.strokeText(t.text, 0, 0);
      ctx.shadowColor = `hsl(${t.h},100%,60%)`;
      ctx.shadowBlur = 18;
      ctx.fillStyle = `hsl(${t.h},100%,72%)`;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
      return true;
    });
    // screen flash
    if (this.fx.flash > 0.004) {
      ctx.fillStyle = `rgba(${this.fx.flashRgb},${this.fx.flash})`;
      ctx.fillRect(0, 0, this.W, this.H);
      this.fx.flash *= Math.pow(0.88, dt / 16.67);
    }
  },

  burst(x, y, owner, n = 90) {
    const base = PIECE_COL[owner].h;
    const hues = [base, base, 48, 0, (base + 180) % 360];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 10;
      this.particles.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 5,
        life: 1, decay: 0.006 + Math.random() * 0.01,
        size: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        hue: hues[(Math.random() * hues.length) | 0],
      });
    }
  },

  drawParticles(dt) {
    const ctx = this.ctx, k = dt / 16.67;
    this.particles = this.particles.filter((p) => {
      p.vy += 0.28 * k; p.vx *= Math.pow(0.985, k);
      p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k; p.life -= p.decay * k;
      if (p.life <= 0 || p.y > this.H + 40) return false;
      if (p.spark) {
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.strokeStyle = `hsl(${p.hue},100%,70%)`;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      }
      if (p.coin) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.translate(p.x, p.y);
        ctx.scale(Math.abs(Math.cos(p.rot)) * 0.9 + 0.1, 1);
        ctx.fillStyle = '#ffcf33'; ctx.strokeStyle = '#b7791f'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        return true;
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = `hsl(${p.hue},100%,62%)`;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
      return true;
    });
  },

  frame(now, dt, root, cur) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.now = now;
    const fx = this.fx, k = dt / 16.67;
    // camera "punch" and shake
    this.zm = this.zoom() * Math.exp(fx.kick);
    fx.kick *= Math.pow(0.86, k);
    const sh = fx.shake;
    const shx = (Math.random() - 0.5) * 2 * sh, shy = (Math.random() - 0.5) * 2 * sh;
    fx.shake = sh < 0.2 ? 0 : sh * Math.pow(0.86, k);
    this.offX = this.W / 2 - this.cam.px * this.zm + shx;
    this.offY = this.centerY() - this.cam.py * this.zm + shy;
    // warp streak strength from how fast the camera zooms
    const dL = (this.cam.L - fx.prevL) / Math.max(1, k);
    fx.prevL = this.cam.L;
    fx.warp = lerp(fx.warp, Math.min(3, Math.abs(dL) * 90), 0.25);
    fx.warpDir = dL >= 0 ? 1 : -1;
    this.drawBackground(now, root.level);
    ctx.lineJoin = 'round';
    this.drawBoard(root, now, cur);
    this.drawFx(now, dt);
    this.drawParticles(dt);
  },
};
