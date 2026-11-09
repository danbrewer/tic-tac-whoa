'use strict';
// Wheel of games: before each Level 0 game the last winner spins it to pick the game type.
// 27 spots: the nine game types repeated three times, so equal odds and no two neighbours alike.
const WHEEL_TYPES = [
  { k: 'classic', label: STRINGS.rules.classic.wheel, col: '#3a86ff', dark: '#1f5fd1' },
  { k: 'vanish', label: STRINGS.rules.vanish.wheel, col: '#8338ec', dark: '#5f1fc2' },
  { k: 'gravity', label: STRINGS.rules.gravity.wheel, col: '#0096c7', dark: '#006c94' },
  { k: 'shift', label: STRINGS.rules.shift.wheel, col: '#fb8500', dark: '#c95f00' },
  { k: 'wild', label: STRINGS.rules.wild.wheel, col: '#ff006e', dark: '#c4004f' },
  { k: 'misere', label: STRINGS.rules.misere.wheel, col: '#06a77d', dark: '#037a5a' },
  { k: 'fog', label: STRINGS.rules.fog.wheel, col: '#6d7fa8', dark: '#4b5b80' },
  { k: 'ring', label: STRINGS.rules.ring.wheel, col: '#ffb703', dark: '#c78a00' },
  { k: 'cross', label: STRINGS.rules.cross.wheel, col: '#d62828', dark: '#a01b1b' },
];
// a slice's icon: drawn marks for Wild Square, Fog of War and Crossfire, the emoji for the rest
function wheelIcon(ctx, k, x, y, sz) {
  if (k === 'wild') drawWildMark(ctx, x, y, sz * 0.45);
  else if (k === 'fog') drawFogMark(ctx, x, y, sz * 0.5);
  else if (k === 'cross') drawCrossMark(ctx, x, y, sz * 0.42);
  else ctx.fillText(RULES[k].icon, x, y);
}
const WHEEL_SEGS = [];
for (let r = 0; r < 3; r++) WHEEL_TYPES.forEach((t) => WHEEL_SEGS.push({ ...t, alt: r % 2 }));
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
  flap: null,     // the flapper's physics state (see flapperStep)

  // Sizes of the pegs and the flapper, in units of R (the wheel's radius). One peg stands on every spoke.
  // Changing these changes how far the flapper bends and where it lets go of a peg, so spin() works out
  // the landing spot from them (see releaseFrac) rather than from fixed numbers.
  PEG: { r: 0.8, size: 0.016, h: 0.042 },        // distance from the hub, radius, height
  FLAP: { pivot: 0.975, len: 0.215, width: 0.05, stop: 0.72, z: 0.006, thick: 0.026 },
  // ^ pivot distance from the hub, length, half-width at the pivot, furthest swing (radians), height of its
  //   underside above the wheel's face, thickness. Its top sits just under the pegs' tops, so the pegs
  //   really can catch it.
  NEAR_MISS: 0.12,  // share of spins that stop with the flapper still bent against a peg, a hair short of
                    // flipping over to the next wedge (the result stays on the wedge it hasn't left)

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
    wheelIcon(ctx, S.k, 0, -(rad - iconSz * 0.55), iconSz);
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

  // Glowing comets racing around the rim, seen through a translucent glassy ring.
  // mode 'face' = the ring on top of the wheel; 'side' = the band around the slab's front edge.
  rimLights(ctx, g, now, mode) {
    const { R, r, K, cx, cy, depth } = g;
    const Ro = R * 0.985, Ri = r, rm = (Ro + Ri) / 2, band = Ro - Ri;
    const landed = this.hit >= 0;
    const pulse = 0.5 + 0.5 * Math.sin(now / 320);
    const path = () => {
      ctx.beginPath();
      if (mode === 'face') {
        ctx.ellipse(cx, cy, Ro, Ro * K, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, cy, Ri, Ri * K, 0, 0, Math.PI * 2, true);
      } else {
        ctx.ellipse(cx, cy + depth, Ro, Ro * K, 0, 0, Math.PI);
        ctx.ellipse(cx, cy, Ro, Ro * K, 0, Math.PI, 0, true);
      }
    };
    ctx.save();
    path(); ctx.clip();
    // tinted glass body
    ctx.fillStyle = mode === 'face' ? `rgba(90, 10, 150, ${0.55 + 0.15 * pulse})` : 'rgba(60, 10, 90, 0.55)';
    path(); ctx.fill();
    // the racing lights
    ctx.globalCompositeOperation = 'lighter';
    const comets = 6, trail = 14, ph = this.rimPhase || 0;
    for (let c = 0; c < comets; c++) {
      const hue = this.sus > 0.3 && !landed ? 20 + c * 9 : (c * 72 + now / 18) % 360;
      for (let j = trail - 1; j >= 0; j--) {
        const ang = ph + (c / comets) * Math.PI * 2 - j * 0.045;
        const sn = Math.sin(ang), cs = Math.cos(ang);
        const fade = 1 - j / trail;
        let x, y, sx, sy;
        if (mode === 'face') { x = cx + cs * rm; y = cy + sn * rm * K; sx = band * (1.05 - j * 0.045); sy = sx * K; }
        else { if (sn < -0.05) continue; x = cx + cs * Ro; y = cy + depth * 0.5 + sn * Ro * K; sx = band * (0.7 - j * 0.03) * (0.4 + 0.6 * Math.abs(sn)); sy = depth * 0.8; }
        if (sx <= 0) continue;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, sx);
        gr.addColorStop(0, `hsla(${hue}, 100%, ${j === 0 ? 92 : 70}%, ${0.95 * fade})`);
        gr.addColorStop(0.4, `hsla(${hue}, 100%, 60%, ${0.5 * fade})`);
        gr.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
        ctx.fillStyle = gr;
        ctx.save(); ctx.translate(x, y); ctx.scale(1, sy / sx); ctx.translate(-x, -y);
        ctx.beginPath(); ctx.arc(x, y, sx, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // landing: the whole ring flashes gold
    if (landed) {
      ctx.fillStyle = `rgba(255, 210, 63, ${0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now / 55))})`;
      path(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // glassy surface: a soft sheen across the top and a pulsing frosted layer
    const sheen = ctx.createLinearGradient(cx - Ro, cy - Ro * K, cx + Ro * 0.4, cy + Ro * K);
    sheen.addColorStop(0, `rgba(255,255,255,${0.16 + 0.08 * pulse})`);
    sheen.addColorStop(0.45, `rgba(255,255,255,${0.02 + 0.03 * pulse})`);
    sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = sheen; path(); ctx.fill();
    ctx.restore();
    // crisp glass edges and a pulsing outer glow
    ctx.save();
    ctx.lineWidth = Math.max(1.5, R * 0.007);
    if (mode === 'face') {
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.85)';
      ctx.beginPath(); ctx.ellipse(cx, cy, Ri, Ri * K, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = landed ? '#ffd23f' : `hsl(${(now / 18) % 360}, 100%, 70%)`;
      ctx.shadowBlur = R * (0.04 + 0.05 * pulse);
      ctx.strokeStyle = `rgba(255, 250, 230, ${0.7 + 0.3 * pulse})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, Ro, Ro * K, 0, 0, Math.PI * 2); ctx.stroke();
      // specular highlight on the back-left of the ring
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = R * 0.01; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(cx, cy, rm + band * 0.25, (rm + band * 0.25) * K, 0, Math.PI * 1.08, Math.PI * 1.38); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.5)';
      ctx.beginPath(); ctx.ellipse(cx, cy + depth, Ro, Ro * K, 0, 0, Math.PI); ctx.stroke();
    }
    ctx.restore();
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
    // racing lights inside the translucent band around the slab's front edge
    const dt = Math.min(64, now - (this.lastNow || now)); this.lastNow = now;
    this.rimPhase = (this.rimPhase || 0) + dt * (0.0011 + this.speed * 0.014 + (this.hit >= 0 ? 0.005 : 0)) * (1 - this.sus * 0.55);
    this.rimLights(ctx, g, now, 'side');
    // the face, drawn in the plane and squashed into the iso view
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, K);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
    const rim = ctx.createRadialGradient(0, 0, r, 0, 0, R);
    rim.addColorStop(0, '#12002a'); rim.addColorStop(0.5, '#2a0a52'); rim.addColorStop(1, '#14002e');
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
      wheelIcon(ctx, WHEEL_SEGS[i].k, 0, -(rad - iconSz * 0.55), iconSz);
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
    // the outer ring: a pulsing translucent band with racing lights glowing under its surface
    this.rimLights(ctx, g, now, 'face');
    // hub cap under the SPIN button
    ctx.fillStyle = '#7a3d00';
    ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.03, R * 0.25, R * 0.25 * K, 0, 0, Math.PI * 2); ctx.fill();
    this.drawPegs(ctx, g);

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

    this.drawPointer(ctx, g, now);

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

  // The gold pegs, one on every spoke: little cylinders standing on the wheel's face, drawn back to front.
  // They are drawn before the flapper; drawPointer() then redraws the one or two pegs right beside the
  // flapper on top of it, so they stand next to it rather than vanishing under it.
  drawPegs(ctx, g) {
    const { R, K, cx, cy } = g, P = this.PEG, n = WHEEL_SEGS.length, seg = (Math.PI * 2) / n;
    const pr = P.size * R, ph = P.h * R, pts = [];
    for (let i = 0; i < n; i++) {
      const d = this.angle + i * seg, f = Math.PI / 2 + d;
      pts.push([cx + Math.cos(f) * P.r * R, cy + Math.sin(f) * P.r * R * K]);
    }
    pts.sort((p, q) => p[1] - q[1]);
    for (const [x, y] of pts) this.drawPeg(ctx, x, y, pr, ph, K);
  },
  // one peg standing on the face at screen point (x, y): shadow (optional), gold side, light top
  drawPeg(ctx, x, y, pr, ph, K, shadow = true) {
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(x + pr * 0.5, y + pr * 0.2, pr * 1.3, pr * 1.3 * K, 0, 0, Math.PI * 2); ctx.fill();
    }
    const gr = ctx.createLinearGradient(x - pr, 0, x + pr, 0);
    gr.addColorStop(0, '#8a5200'); gr.addColorStop(0.35, '#ffe680'); gr.addColorStop(1, '#a86400');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(x, y, pr, pr * K, 0, 0, Math.PI);
    ctx.lineTo(x - pr, y - ph);
    ctx.ellipse(x, y - ph, pr, pr * K, 0, Math.PI, 0, true);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath(); ctx.ellipse(x, y - ph, pr, pr * K, 0, 0, Math.PI * 2); ctx.fill();
  },

  // ---- the flapper's physics ----
  // The flapper is a springy paddle on a pivot at the front of the rim. Each peg that sweeps past bends it
  // aside until the peg slips off its tip; then it snaps back, overshoots and, when the next peg is close,
  // slaps into it. It is a damped spring (TIMING.wheel.flapperFreq, TIMING.wheel.flapperDamping) that cannot pass
  // through a peg: a peg it runs into stops it and bounces it back (TIMING.wheel.flapperBounce).
  // All lengths are in units of R. th is the flapper's angle (radians; positive swings the tip to the
  // right on screen), om its angular speed.

  // half the flapper's width at distance d from the pivot (it tapers to a point at the tip)
  flapHalfWidth(d) {
    const F = this.FLAP, L = F.len, w = F.width;
    if (d >= L) return 0;
    return d > 0.55 * L ? w * 0.55 * (L - d) / (0.45 * L) : w * (1 - 0.45 * d / (0.55 * L));
  },
  // where a peg d radians past the pointer stands, as seen from the pivot; null when it is out of the
  // flapper's reach. a = its direction from the pivot, pad = the extra angle its radius and the flapper's
  // width keep the two apart.
  pegContact(d) {
    const F = this.FLAP, P = this.PEG;
    const x = -P.r * Math.sin(d), hh = F.pivot - P.r * Math.cos(d), dist = Math.hypot(x, hh);
    if (hh <= 0 || dist > F.len + P.size * 0.6) return null;
    return { a: Math.atan2(x, hh), pad: (P.size + this.flapHalfWidth(dist)) / dist };
  },
  // how far past the pointer (as a fraction of one wedge) a peg lets go of the flapper's tip
  releaseFrac() {
    if (this._rel) return this._rel;
    const seg = (Math.PI * 2) / WHEEL_SEGS.length;
    let d = 0;
    while (d < seg && this.pegContact(d + seg * 0.005)) d += seg * 0.005;
    return (this._rel = d / seg);
  },
  // advance the flapper to time now, following the wheel from where it was last frame; returns th
  flapperStep(now) {
    const T = TIMING.wheel, n27 = WHEEL_SEGS.length, seg = (Math.PI * 2) / n27;
    let s = this.flap;
    if (!s) s = this.flap = { th: 0, om: 0, a: this.angle, t: now, time: 0, pegs: new Map(), clack: 0 };
    const dt = Math.min(0.05, Math.max(0, now - s.t) / 1000), dA = this.angle - s.a;
    s.t = now;
    if (!dt && !dA) return s.th;
    // small sub-steps, so no peg can jump past the flapper in one go even at full speed
    const n = Math.min(1000, Math.max(1, Math.ceil(dt / 0.002), Math.ceil(Math.abs(dA) / (seg * 0.04))));
    const h = Math.max(dt / n, 1e-5), w0 = 2 * Math.PI * T.flapperFreq, z = T.flapperDamping, e = T.flapperBounce;
    let struck = false;
    for (let k = 1; k <= n; k++) {
      const A = s.a + (dA * k) / n;
      s.time += h;
      s.om += (-w0 * w0 * s.th - 2 * z * w0 * s.om) * h;
      s.th += s.om * h;
      // the mounting block's stops: it can't swing further than this either way
      if (Math.abs(s.th) > this.FLAP.stop) { const sg = Math.sign(s.th); s.th = sg * this.FLAP.stop; if (s.om * sg > 0) s.om *= -e; }
      const i0 = Math.round(-A / seg);
      for (let j = i0 - 1; j <= i0 + 1; j++) {
        const id = ((j % n27) + n27) % n27, c = this.pegContact(A + j * seg);
        let p = s.pegs.get(id);
        if (!c) {
          if (p) s.pegs.delete(id);
          continue;
        }
        // a peg coming into reach: remember which side of it the flapper is on, it can't cross over
        if (!p) { p = { side: s.th >= c.a ? 1 : -1, a: c.a, touched: -1 }; s.pegs.set(id, p); }
        const lim = c.a + p.side * c.pad, bv = (c.a - p.a) / h;
        p.a = c.a;
        if (p.side * (s.th - lim) < 0) {
          if (p.touched < 0) struck = true;   // this peg's first strike on the flapper
          s.th = lim; p.touched = s.time;
          const rel = s.om - bv;
          if (p.side * rel < 0) s.om = bv - e * rel;
        }
      }
    }
    s.a = this.angle;
    // the clack: once per peg, the moment that peg first strikes the flapper (either the peg sweeping into
    // it, or the flapper snapping back into the next peg), so the sound lands on the slap you see
    if (struck && now - s.clack > 25) { s.clack = now; Sound.wheelClack(); }
    return s.th;
  },

  // The pointer: a red flapper on a gold mounting block at the front of the rim, lying in the wheel's
  // plane and drawn in the same squashed isometric projection, with real thickness. It swings on its
  // pivot as the pegs push it aside (see flapperStep).
  drawPointer(ctx, g, now) {
    const { R, K, cx, cy } = g;
    const P = (u, v, z) => [cx + u, cy + v * K - z];
    // extrude a footprint in the wheel's plane from z0 to z1: the walls facing the viewer, then the top
    const prism = (pts, z0, z1, top, side, edge) => {
      let area = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
      if (area < 0) pts = pts.slice().reverse();
      const walls = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const nx = b[1] - a[1], ny = -(b[0] - a[0]), l = Math.hypot(nx, ny) || 1;
        if (ny / l > 0.02) walls.push({ a, b, sh: nx / l, d: a[1] + b[1] });
      }
      walls.sort((p, q) => p.d - q.d);
      for (const w of walls) {
        ctx.beginPath();
        [P(w.a[0], w.a[1], z0), P(w.b[0], w.b[1], z0), P(w.b[0], w.b[1], z1), P(w.a[0], w.a[1], z1)].forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath(); ctx.fillStyle = side(w.sh); ctx.fill();
      }
      ctx.beginPath(); pts.forEach(([u, v], n) => { const [x, y] = P(u, v, z1); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fillStyle = top; ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1, R * 0.004); ctx.lineJoin = 'round'; ctx.stroke(); }
    };
    const pv = R * this.FLAP.pivot;                             // pivot, on the rim at the front
    const th = this.flapperStep(now);                           // the flapper's swing, from the peg physics
    ctx.save();
    // contact shadow under the block
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy + pv * K + R * 0.004, R * 0.075, R * 0.075 * K, 0, 0, Math.PI * 2); ctx.fill();
    // gold mounting block
    const bw = R * 0.055, bz = R * this.FLAP.z, ft = R * this.FLAP.thick;
    prism([[-bw, pv - bw], [bw, pv - bw], [bw, pv + bw], [-bw, pv + bw]], 0, bz,
      '#ffd23f', (sh) => (sh > 0.3 ? '#b86e00' : sh < -0.3 ? '#8a4f00' : '#d98a10'), 'rgba(255,246,200,0.8)');
    // red flipper, pointing in toward the hub, turned by th around the pivot
    const rot = ([u, v]) => { const du = u, dv = v - pv; return [du * Math.cos(th) - dv * Math.sin(th), pv + du * Math.sin(th) + dv * Math.cos(th)]; };
    const L = R * this.FLAP.len, hw = R * this.FLAP.width;
    const fl = [[0, pv - L], [hw * 0.55, pv - L * 0.45], [hw, pv + hw * 0.2], [hw * 0.6, pv + hw * 0.9], [-hw * 0.6, pv + hw * 0.9], [-hw, pv + hw * 0.2], [-hw * 0.55, pv - L * 0.45]].map(rot);
    ctx.shadowColor = 'rgba(255,80,100,0.8)'; ctx.shadowBlur = R * 0.04;
    const tg = ctx.createLinearGradient(cx, cy + (pv - L) * K, cx, cy + (pv + hw) * K);
    tg.addColorStop(0, '#ff5a6e'); tg.addColorStop(1, '#e0102f');
    prism(fl, bz, bz + ft, tg, (sh) => (sh > 0.3 ? '#a3001c' : sh < -0.3 ? '#6e0012' : '#8a0018'), 'rgba(255,220,225,0.85)');
    ctx.shadowBlur = 0;
    // The pegs beside the flapper: redraw them over it, except where the part of the flapper nearer the
    // viewer than the peg (footprint further forward than the peg's centre) should still hide them.
    {
      const PG = this.PEG, n = WHEEL_SEGS.length, seg = (Math.PI * 2) / n, pr = PG.size * R, ph = PG.h * R;
      // the flapper's footprint cut to the part with v >= vc (one clipping line)
      const cut = (poly, vc) => {
        const out = [];
        poly.forEach((a, i) => {
          const b = poly[(i + 1) % poly.length], ina = a[1] >= vc, inb = b[1] >= vc;
          if (ina) out.push(a);
          if (ina !== inb) { const t = (vc - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, vc]); }
        });
        return out;
      };
      // convex hull of screen points (monotone chain)
      const hull = (pts) => {
        pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], up = [];
        for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
        for (const p of pts.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
        return lo.slice(0, -1).concat(up.slice(0, -1));
      };
      for (let i = 0; i < n; i++) {
        const f = Math.PI / 2 + this.angle + i * seg, pu = Math.cos(f) * PG.r * R, pw = Math.sin(f) * PG.r * R;
        if (pw < 0 || Math.hypot(pu, pw - pv) > L + pr * 4) continue;
        const front = cut(fl, pw);
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (front.length >= 3) {
          const hs = hull(front.flatMap(([u, v]) => [P(u, v, bz), P(u, v, bz + ft)]));
          hs.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
        }
        ctx.clip('evenodd');
        this.drawPeg(ctx, cx + pu, cy + pw * K, pr, ph, K, false);
        ctx.restore();
      }
    }
    // brass pivot pin
    const [px, py] = P(0, pv, bz + ft);
    const pg = ctx.createRadialGradient(px - R * 0.006, py - R * 0.004, 0, px, py, R * 0.02);
    pg.addColorStop(0, '#fffbe0'); pg.addColorStop(1, '#c98a00');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(px, py, R * 0.018, R * 0.018 * K, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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

  // where the wheel's base meets the floor, in screen space
  footprint(stage) {
    const r = stage.getBoundingClientRect(), wh = r.width;
    const rx = wh * 0.47;
    return { x: r.left + wh / 2, y: r.top + wh * 0.6, w: wh * 0.94, cx: r.left + wh / 2, cy: r.top + wh * 0.35, rx, ry: rx * WHEEL_K };
  },
  // the wheel plummets from above the screen, slams onto the board with a BOOM and a cloud of dust
  dropIn(el) {
    const stage = el.querySelector('.wh-stage'), ui = el.querySelectorAll('.wh-title, .wh-who, .wh-result');
    const T = TIMING.wheel, FALL = T.dropFall;
    Sound.whoosh && Sound.whoosh();
    // fall, then (exactly when the fall animation ends) squash + BOOM + dust
    const fall = stage.animate([
      { transform: 'translateY(-115vh) rotate(-6deg) scale(0.9, 1.08)' },
      { transform: 'translateY(0) rotate(0) scale(0.92, 1.08)' },
    ], { duration: FALL, easing: 'cubic-bezier(.5,0,1,1)', fill: 'backwards' });
    ui.forEach((u, i) => u.animate([{ opacity: 0, transform: 'translateY(-30px) scale(0.8)' }, { opacity: 1, transform: 'none' }],
      { duration: T.dropTitleIn, delay: FALL + T.dropTitleGap + i * T.dropTitleStagger, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' }));
    fall.onfinish = () => {
      const f = this.footprint(stage);
      stage.animate([
        { transform: 'scale(1.12, 0.8)' }, { transform: 'translateY(-3%) scale(0.97, 1.04)', offset: 0.5 }, { transform: 'none' },
      ], { duration: T.dropSquash, easing: 'ease-out' });
      Sound.bigBoom(1, 0);
      Fx.dust(f);
      Renderer.flash && Renderer.flash(0.35, '255,240,220');
      const sh = []; for (let k = 0; k < 12; k++) { const m = 18 * (1 - k / 12); sh.push({ transform: `translate(${(Math.random() - 0.5) * m}px, ${(Math.random() - 0.3) * m * 1.6}px)` }); }
      sh.push({ transform: 'none' });
      document.body.animate(sh, { duration: T.dropShake });
    };
  },
  // when the game type is picked the wheel rumbles, ignites, and blasts off like a rocket
  blastOff(el, done) {
    const stage = el.querySelector('.wh-stage'), ui = el.querySelectorAll('.wh-title, .wh-who, .wh-result');
    ui.forEach((u) => u.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-20px)' }], { duration: TIMING.wheel.blastUiFade, fill: 'forwards' }));
    const RUMBLE = TIMING.wheel.blastRumble, FLY = TIMING.wheel.blastFly;
    Sound.rocketRumble && Sound.rocketRumble(RUMBLE / 1000);
    const sh = []; for (let k = 0; k < 10; k++) sh.push({ transform: `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 5}px)` });
    sh.push({ transform: 'none' });
    stage.animate(sh, { duration: RUMBLE });
    const t0 = performance.now(), f0 = this.footprint(stage);
    // exhaust: fire and smoke pour out of the base, following the wheel up
    Fx.emit((now) => {
      const t = now - t0, f = this.footprint(stage);
      // before lift-off: fire squirts out of every side of the base, building up
      if (t < RUMBLE + 120) Fx.flameRing(f, 4 + Math.round((t / RUMBLE) * 16), 0.6 + (t / RUMBLE) * 0.8);
      const n = t < RUMBLE ? 1 : 6;
      for (let i = 0; i < n; i++) {
        const x = f.x + (Math.random() - 0.5) * f.w * (t < RUMBLE ? 0.5 : 0.35);
        Fx.add({ x, y: f.y, vx: (Math.random() - 0.5) * 140, vy: 380 + Math.random() * 380, r0: f.w * 0.05, r1: f.w * 0.11, c: Math.random() < 0.5 ? '255,200,80' : '255,110,40', a: 0.9, life: 260 + Math.random() * 200, drag: 0.9, add: true });
        Fx.add({ x, y: f.y + 20, vx: (Math.random() - 0.5) * 220, vy: 120 + Math.random() * 200, r0: f.w * 0.06, r1: f.w * (0.16 + Math.random() * 0.1), c: '200,190,205', a: 0.45, life: 1400 + Math.random() * 800, drag: 0.95, g: -20 });
      }
    }, RUMBLE + FLY);
    setTimeout(() => {
      Sound.liftoff && Sound.liftoff();
      Fx.dust(f0, 0.8);
      Renderer.flash && Renderer.flash(0.3, '255,200,120');
      stage.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-4%) scale(0.95, 1.08)', offset: 0.12 },
        { transform: 'translateY(-140vh) scale(0.85, 1.18) rotate(3deg)' },
      ], { duration: FLY, easing: 'cubic-bezier(.6,0,.9,.6)', fill: 'forwards' });
    }, RUMBLE);
    setTimeout(() => {
      done();
      setTimeout(() => { stage.getAnimations().forEach((a) => a.cancel()); ui.forEach((u) => u.getAnimations().forEach((a) => a.cancel())); }, TIMING.wheel.blastCleanup);
    }, RUMBLE + FLY);
  },

  spin(player, auto, sub) {
    return new Promise((resolve) => {
      const el = document.getElementById('wheel');
      const btn = el.querySelector('.wh-spin');
      const res = el.querySelector('.wh-result');
      const pointer = el.querySelector('.wh-pointer');
      el.querySelector('.wh-who').innerHTML = STRINGS.wheel.who(player, auto, sub);
      res.className = 'wh-result';
      res.textContent = auto ? STRINGS.wheel.computerSpins : '';
      this.hit = -1; this.speed = 0; this.sus = 0; this.under = -1; this.sparks = []; this.lift = null;
      this.angle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (this.flap) this.flap.a = this.angle;   // same position, so the flapper must not see a jump
      el.classList.remove('landed', 'spinning', 'lifting');
      el.style.setProperty('--sus', 0); el.style.setProperty('--jit', 0);
      btn.textContent = STRINGS.wheel.spin;
      btn.disabled = auto;
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('show'));
      this.dropIn(el);
      this.loop();
      Sound.slotOpen();

      let spun = false;
      const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); } };
      const go = () => {
        if (spun) return;
        spun = true;
        window.removeEventListener('keydown', onKey);
        btn.disabled = true;
        btn.textContent = STRINGS.wheel.spinning;
        el.classList.add('spinning');
        res.textContent = '';
        const n = WHEEL_SEGS.length, seg = (Math.PI * 2) / n;
        // the wedge the flapper is in: it only counts as the next wedge once the peg has let go of the flapper
        // and it has flipped over, a little after the spoke passes the pivot (releaseFrac of a wedge)
        const rel = this.releaseFrac();
        const segAt = (ang) => (((Math.floor((-ang) / seg + rel)) % n) + n) % n;
        const matches = WHEEL_SEGS.map((x, i) => (Game.dev.on && x.k === Game.dev.wheel ? i : -1)).filter((i) => i >= 0);
        const forced = matches.length ? matches[(Math.random() * matches.length) | 0] : -1;
        const target = forced >= 0 ? forced : (Math.random() * n) | 0;
        // Where in the target wedge it stops (within = how far short of the target's leading spoke, so a
        // negative value means that spoke has already passed the pivot):
        //  - near miss (NEAR_MISS of spins): the next spoke's peg has the flapper bent over but stops just
        //    before it lets go, so the flapper never flips and the result stays on the target
        //  - creep (40%): only just past the point where the last peg let go of the flapper
        //  - otherwise anywhere after that, short of the next peg touching the resting flapper
        // (Developer Mode's "Near miss" box makes every spin a near miss)
        const r = Math.random(), nearOdds = Game.dev.on && Game.dev.nearMiss ? 1 : this.NEAR_MISS;
        const within = r < nearOdds ? -(rel - 0.03 - Math.random() * 0.09) * seg
          : (1 - (r < this.NEAR_MISS + 0.4 ? rel + 0.03 + Math.random() * 0.06 : rel + 0.09 + Math.random() * (0.85 - rel - 0.09))) * seg;
        const base = -(target * seg + within);
        // 1) wind-back: drag the wheel backwards a little before letting go
        const pullT = TIMING.wheel.windBack, pull = seg * 1.4, a0 = this.angle;
        Sound.wheelPull(pullT / 1000);
        let end = base;
        while (end < a0 - pull + Math.PI * 2 * 6) end += Math.PI * 2;
        const start = a0 - pull;
        // two-phase motion: (A) a long cubic slow-down from the launch, then (B) a constant-deceleration crawl
        // over the last ~4 spokes, so every final spoke is visibly slower than the one before, right up to the stop
        const TOT = end - start, dB = seg * 3.3 + within, TB = TIMING.wheel.spinCrawl, vB = (2 * dB) / TB;
        const TA = TIMING.wheel.spinFast + Math.random() * TIMING.wheel.spinFastRandom, DA = TOT - dB;
        const v0 = vB + ((DA - vB * TA) * 4) / TA, aB = (vB * vB) / (2 * dB), T = TA + TB;
        const posAt = (t) => {
          if (t <= TA) { const u = t / TA; return vB * t + ((v0 - vB) * TA / 4) * (1 - Math.pow(1 - u, 4)); }
          const s = Math.min(TB, t - TA); return DA + vB * s - (aB * s * s) / 2;
        };
        const velAt = (t) => (t <= TA ? vB + (v0 - vB) * Math.pow(1 - t / TA, 3) : Math.max(0, vB - aB * (t - TA)));
        const t0 = performance.now();
        let launched = 0, lastSeg = segAt(a0), rolled = false, nextBeat = 0, beatN = 0;
        const BEATS = TIMING.wheel.heartbeats;
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
          const tt = q * T;
          this.angle = q >= 1 ? end : start + posAt(tt);
          // angular speed relative to the launch speed (1 at release, 0 at rest)
          this.speed = velAt(tt) / v0;
          // suspense ramps up over the last ~40% of the spin
          this.sus = Math.max(0, Math.min(1, (q - 0.55) / 0.4));
          el.style.setProperty('--sus', this.sus.toFixed(3));
          el.style.setProperty('--hubrate', `${(0.5 - this.sus * 0.38).toFixed(2)}s`);
          if (this.sus > 0 && !rolled) { rolled = true; Sound.drumroll(((1 - q) * T) / 1000); }
          // heartbeat: a slow resting pulse while the wheel slows, racing hardest as the last few spokes pass the
          // pointer (the gaps are TIMING.wheel.heartbeats, then heartbeatFast); it stops the moment the wheel stops
          if (q < 1) {
            if (!nextBeat) nextBeat = launched;
            if (now >= nextBeat) {
              // stepped pairs (TIMING.wheel.heartbeats), then TIMING.wheel.heartbeatFast until the wheel stops
              const gap = BEATS[beatN] || TIMING.wheel.heartbeatFast; beatN++;
              nextBeat += gap;
              if (nextBeat > launched + T - TIMING.wheel.heartbeatStopGuard) nextBeat = Infinity; // no beat right on (or after) the stop
              // hk: 0 at the slowest gap in the list .. 1 at heartbeatFast; louder and a tighter lub-dub as it races
              const slow = Math.max(...BEATS), hk = Math.max(0, Math.min(1, (slow - gap) / Math.max(1, slow - TIMING.wheel.heartbeatFast)));
              const lubSlow = TIMING.wheel.heartbeatLubDubSlow, lubFast = TIMING.wheel.heartbeatLubDubFast;
              Sound.heartPulse(hk, (lubSlow + (lubFast - lubSlow) * hk) / 1000);
              const stage = el.querySelector('.wh-stage');
              if (stage) stage.animate([{ transform: 'scale(1)' }, { transform: `scale(${1 + 0.008 + hk * 0.016})`, offset: 0.25 }, { transform: 'scale(1)', offset: 0.5 }, { transform: `scale(${1 + 0.004 + hk * 0.009})`, offset: 0.7 }, { transform: 'scale(1)' }], { duration: TIMING.wheel.heartbeatPulse, easing: 'ease-out', composite: 'add' });
            }
          }
          const cur = segAt(this.angle);
          this.under = cur;
          if (cur !== lastSeg) {
            lastSeg = cur;
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
        btn.innerHTML = R.icon;
        this.spark(40, true);
        el.classList.add('landed');
        Sound.slotWin(false);
        Renderer.flash(0.3, '255,210,63');
        let done = false;
        const finish = () => {
          if (done) return; done = true;
          el.removeEventListener('click', finish);
          this.blastOff(el, () => {
            el.classList.remove('show');
            setTimeout(() => { el.hidden = true; this.lift = null; resolve(k); }, TIMING.wheel.hide);
          });
        };
        // the winning wedge pops out of the wheel, flips up to face the player and hovers, glowing
        setTimeout(() => {
          this.lift = { t0: performance.now(), dur: TIMING.wheel.wedgeLift };
          el.classList.add('lifting');
          Sound.wheelLaunch();
          this.spark(30, true, [this.geo(this.canvas().width).cx, this.geo(this.canvas().width).cy + this.geo(this.canvas().width).r * WHEEL_K * 0.5]);
        }, TIMING.wheel.wedgeLiftDelay);
        setTimeout(() => {
          const cv = this.canvas(), g = this.geo(cv.width);
          const px = g.cx, py = g.cy + g.R * 0.2 - g.r * 0.6;
          this.spark(70, true, [px, py]);
          Sound.fanfare ? Sound.fanfare() : Sound.slotWin(true);
          const rr = cv.getBoundingClientRect(), f = rr.width / cv.width;
          Renderer.burst(rr.left + px * f, rr.top + py * f, player, 90);
          Renderer.flash(0.35, '255,230,120');
          res.className = 'wh-result is-win';
          res.innerHTML = `<div class="prize-name">${STRINGS.wheel.result(R.icon, R.name)}</div>`;
          // rules with a voice-over (Gravity, Vanishing Marks) announce now; the wheel waits for it before blasting off
          const voiced = Sound.hasRuleVoice(k);
          if (voiced) Sound.ruleVoice(k, 0.15);
          setTimeout(() => el.addEventListener('click', finish), voiced ? TIMING.wheel.clickSkipVoiced : TIMING.wheel.clickSkip);
        }, TIMING.wheel.announceDelay);
        setTimeout(finish, Sound.hasRuleVoice(k) ? TIMING.wheel.autoFinishVoiced : TIMING.wheel.autoFinish);
      };
      btn.onclick = go;
      el.querySelector('.wh-stage').onclick = (e) => { if (!auto && e.target !== btn) go(); };
      if (auto) setTimeout(go, TIMING.wheel.autoSpinDelay);
      else window.addEventListener('keydown', onKey);
    });
  },
};
