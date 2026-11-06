'use strict';
// The Mystery Jackpot "crew": shaded SVG prize characters that hang around the slot machine,
// each posed at its own angle, turning, bobbing, blinking and looking around so they feel alive.
const Crew = (() => {
  const eyes = (x1, y1, x2, y2, r, extra = '') => `
    <g class="eyes">
      <ellipse cx="${x1}" cy="${y1}" rx="${r * 0.82}" ry="${r}" fill="#fff" stroke="#1a0a24" stroke-width="1.6"/>
      <ellipse cx="${x2}" cy="${y2}" rx="${r * 0.82}" ry="${r}" fill="#fff" stroke="#1a0a24" stroke-width="1.6"/>
      <g class="pupils${extra}">
        <circle cx="${x1 + r * 0.15}" cy="${y1 + r * 0.15}" r="${r * 0.46}" fill="#14061c"/>
        <circle cx="${x2 + r * 0.15}" cy="${y2 + r * 0.15}" r="${r * 0.46}" fill="#14061c"/>
        <circle cx="${x1}" cy="${y1 - r * 0.05}" r="${r * 0.16}" fill="#fff"/>
        <circle cx="${x2}" cy="${y2 - r * 0.05}" r="${r * 0.16}" fill="#fff"/>
      </g>
    </g>`;
  const shadow = (cx = 60, cy = 114, rx = 32) => `<ellipse class="shade" cx="${cx}" cy="${cy}" rx="${rx}" ry="5" fill="rgba(0,0,0,0.35)"/>`;

  const CHARS = {
    bomb: (p) => `
      <defs><radialGradient id="${p}b" cx="0.36" cy="0.3" r="0.78"><stop offset="0" stop-color="#9a9aae"/><stop offset="0.35" stop-color="#3b3b4c"/><stop offset="1" stop-color="#08080f"/></radialGradient>
        <linearGradient id="${p}c" x1="0" x2="1"><stop offset="0" stop-color="#3a3a44"/><stop offset="0.5" stop-color="#9a9aa8"/><stop offset="1" stop-color="#2a2a33"/></linearGradient></defs>
      ${shadow(60, 113, 30)}
      <path d="M62 24 C60 12 72 6 80 4" stroke="#c8a165" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <g class="spark"><path d="M80 -6 L83 1 L91 0 L85 5 L89 12 L81 8 L75 13 L77 5 L70 1 L78 1 Z" fill="#ffd23f"/><circle cx="80" cy="4" r="3" fill="#fff"/></g>
      <circle cx="60" cy="68" r="40" fill="url(#${p}b)"/>
      <rect x="49" y="22" width="22" height="12" rx="3" fill="url(#${p}c)" stroke="#16161e" stroke-width="1.5"/>
      <ellipse cx="43" cy="47" rx="11" ry="6" fill="#fff" opacity="0.3" transform="rotate(-35 43 47)"/>
      ${eyes(46, 64, 72, 64, 9.5)}
      <path d="M37 50 L54 56 M83 50 L66 56" stroke="#14061c" stroke-width="4" stroke-linecap="round"/>
      <path d="M44 82 Q60 98 76 82 Z" fill="#fff" stroke="#14061c" stroke-width="2" stroke-linejoin="round"/>`,

    bolt: (p) => `
      <defs><linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbd0"/><stop offset="0.45" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff8a00"/></linearGradient></defs>
      ${shadow(62, 116, 26)}
      <polygon points="70,4 26,66 56,66 44,116 96,46 64,46 82,4" fill="#a34f00" transform="translate(6 5)" stroke="#5a2600" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="70,4 26,66 56,66 44,116 96,46 64,46 82,4" fill="url(#${p}g)" stroke="#7a3d00" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M72 10 L44 52" stroke="#fff" stroke-width="3" opacity="0.6" stroke-linecap="round"/>
      ${eyes(50, 40, 62, 38, 5.5)}
      <path d="M44 56 Q52 62 60 55" stroke="#5a2600" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <g class="zap"><path d="M100 20 L108 14 M104 30 L114 30 M14 80 L6 86 M18 92 L10 100" stroke="#fff6a0" stroke-width="3" stroke-linecap="round"/></g>`,

    shield: (p) => `
      <defs><linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe8ff"/><stop offset="0.45" stop-color="#3a8ff0"/><stop offset="1" stop-color="#0b3d7a"/></linearGradient></defs>
      ${shadow(60, 116, 30)}
      <path d="M60 8 L100 22 C100 62 86 92 60 112 C34 92 20 62 20 22 Z" fill="#082a55" transform="translate(6 4)"/>
      <path d="M60 8 L100 22 C100 62 86 92 60 112 C34 92 20 62 20 22 Z" fill="url(#${p}g)" stroke="#eef4fb" stroke-width="5" stroke-linejoin="round"/>
      <path d="M60 18 L90 29 C90 60 80 82 60 99" stroke="#fff" stroke-width="3" fill="none" opacity="0.4"/>
      ${eyes(47, 52, 73, 52, 8.5)}
      <path d="M48 72 Q60 82 72 72" stroke="#062044" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="40" cy="70" rx="5" ry="3" fill="#ff7ac6" opacity="0.6"/><ellipse cx="80" cy="70" rx="5" ry="3" fill="#ff7ac6" opacity="0.6"/>`,

    dice: () => `
      ${shadow(60, 112, 38)}
      <polygon points="60,14 100,36 60,58 20,36" fill="#ffffff" stroke="#4a3a6a" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="20,36 60,58 60,106 20,84" fill="#e8e1f4" stroke="#4a3a6a" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="60,58 100,36 100,84 60,106" fill="#bfb3d8" stroke="#4a3a6a" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="60" cy="36" rx="8" ry="4.6" fill="#e0102f"/>
      <ellipse cx="72" cy="62" rx="3.4" ry="4.6" fill="#2a1a40" transform="skewY(-28) translate(0 38)"/>
      <ellipse cx="88" cy="80" rx="3.4" ry="4.6" fill="#2a1a40" transform="skewY(-28) translate(0 46)"/>
      <g transform="translate(40 71) skewY(28) translate(-40 -71)">
        ${eyes(32, 64, 48, 64, 6)}
        <path d="M32 78 Q40 84 48 78" stroke="#2a1a40" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>`,

    rocket: (p) => `
      <defs><linearGradient id="${p}b" x1="0" x2="1"><stop offset="0" stop-color="#8a0018"/><stop offset="0.35" stop-color="#ff3d5e"/><stop offset="0.55" stop-color="#ffb3c2"/><stop offset="1" stop-color="#9a0020"/></linearGradient>
        <linearGradient id="${p}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a0"/><stop offset="0.5" stop-color="#ffb000"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></linearGradient></defs>
      <g class="flame"><path d="M47 88 Q60 128 73 88 Z" fill="url(#${p}f)"/></g>
      <path d="M43 66 L24 94 L44 88 Z" fill="#1f5fd1" stroke="#0b2f73" stroke-width="2" stroke-linejoin="round"/>
      <path d="M77 66 L96 94 L76 88 Z" fill="#3a86ff" stroke="#0b2f73" stroke-width="2" stroke-linejoin="round"/>
      <path d="M60 4 C79 20 83 50 78 88 L42 88 C37 50 41 20 60 4 Z" fill="url(#${p}b)" stroke="#5a0010" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M60 4 C68 11 73 20 75 28 L45 28 C47 20 52 11 60 4 Z" fill="#fff" opacity="0.9"/>
      <circle cx="60" cy="50" r="14" fill="#bde9ff" stroke="#f4f4ff" stroke-width="3.5"/>
      ${eyes(54, 50, 66, 50, 5)}
      <path d="M52 70 Q60 76 68 70" stroke="#5a0010" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <g class="twinkle"><path d="M104 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#ffd23f"/><path d="M12 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#7fe3ff"/><path d="M106 70 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#ff7ac6"/></g>`,

    thief: (p) => `
      <defs><radialGradient id="${p}g" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#e6ccff"/><stop offset="0.4" stop-color="#8a3df0"/><stop offset="1" stop-color="#2e0760"/></radialGradient></defs>
      ${shadow(60, 113, 30)}
      <circle cx="60" cy="68" r="40" fill="url(#${p}g)"/>
      <ellipse cx="44" cy="46" rx="10" ry="6" fill="#fff" opacity="0.35" transform="rotate(-35 44 46)"/>
      <path d="M96 54 L112 46 L108 60 Z M96 60 L114 64 L104 72 Z" fill="#14061c"/>
      <path d="M22 56 Q60 42 98 56 L96 72 Q60 62 24 72 Z" fill="#14061c"/>
      ${eyes(45, 61, 75, 61, 8, ' shifty')}
      <path d="M46 86 Q60 92 74 82" stroke="#1a0630" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M70 84 L74 82 L72 87" stroke="#1a0630" stroke-width="2" fill="none"/>`,

    x: (p) => `
      <defs><linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc2e6"/><stop offset="0.45" stop-color="#ff3da6"/><stop offset="1" stop-color="#b0005c"/></linearGradient></defs>
      ${shadow(60, 116, 30)}
      <g transform="translate(6 6)" fill="#6a0036"><rect x="47" y="6" width="26" height="108" rx="13" transform="rotate(45 60 60)"/><rect x="47" y="6" width="26" height="108" rx="13" transform="rotate(-45 60 60)"/></g>
      <g fill="url(#${p}g)" stroke="#5a002e" stroke-width="2"><rect x="47" y="6" width="26" height="108" rx="13" transform="rotate(45 60 60)"/><rect x="47" y="6" width="26" height="108" rx="13" transform="rotate(-45 60 60)"/></g>
      <path d="M28 26 L46 44" stroke="#fff" stroke-width="4" opacity="0.55" stroke-linecap="round"/>
      ${eyes(53, 57, 67, 57, 6)}
      <path d="M54 68 Q60 73 66 68" stroke="#5a002e" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,

    o: (p) => `
      <defs><linearGradient id="${p}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4fbff"/><stop offset="0.45" stop-color="#22d3ff"/><stop offset="1" stop-color="#006f99"/></linearGradient></defs>
      ${shadow(60, 116, 32)}
      <circle cx="65" cy="65" r="38" fill="none" stroke="#00445e" stroke-width="22"/>
      <circle cx="60" cy="60" r="38" fill="none" stroke="url(#${p}g)" stroke-width="22"/>
      <circle cx="60" cy="60" r="49" fill="none" stroke="#00445e" stroke-width="2"/><circle cx="60" cy="60" r="27" fill="none" stroke="#00445e" stroke-width="2"/>
      <path d="M26 44 A38 38 0 0 1 44 26" stroke="#fff" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>
      ${eyes(50, 22, 70, 22, 6.5)}
      <path d="M50 97 Q60 104 70 97" stroke="#00445e" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  };

  const ORDER = ['bomb', 'x', 'bolt', 'dice', 'rocket', 'o', 'shield', 'thief'];
  let built = false, raf = 0;
  return {
    build(host) {
      if (built) return;
      built = true;
      host.innerHTML = '<canvas class="slot-sky" aria-hidden="true"></canvas>' + ORDER.map((k, i) => `<div class="crew c-${k}" style="--dl:${0.15 + i * 0.07}s;--bl:${(i * 0.83) % 4}s;--dur:${(0.8 + (i % 3) * 0.12).toFixed(2)}s"><div class="cb"><div class="rk"><svg viewBox="0 0 120 120" aria-hidden="true">${CHARS[k](`cr${k}`)}</svg></div></div></div>`).join('');
    },

    // Parade: the crew walks a rounded loop around the reels (clockwise), inside the machine's glass
    // ring, bobbing as they go and looking the way they're heading, with the odd glance back.
    // ---- animated deep-space backdrop: parallax stars, drifting nebula, shooting stars ----
    sky(cv, w, h, now, dt, fast) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = `${h}px`;
      }
      const S = this._sky || (this._sky = {
        stars: Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), ph: Math.random() * 6.3, hue: [0, 0, 0, 300, 190, 45][Math.floor(Math.random() * 6)] })),
        blobs: [[320, 0.22, 0.25], [190, 0.78, 0.35], [275, 0.45, 0.8], [330, 0.85, 0.85], [210, 0.15, 0.75]].map(([hue, x, y], i) => ({ hue, x, y, ph: i * 1.7 })),
        shots: [], nextShot: now + 1500,
      });
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // base: deep violet space with a warm glow at the top
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a0838'); g.addColorStop(0.5, '#150626'); g.addColorStop(1, '#08051a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const t = now / 1000;
      // nebula clouds slowly drifting and breathing
      ctx.globalCompositeOperation = 'lighter';
      const m = Math.max(w, h);
      for (const b of S.blobs) {
        const x = (b.x + Math.sin(t * 0.05 + b.ph) * 0.08) * w, y = (b.y + Math.cos(t * 0.04 + b.ph) * 0.07) * h;
        const r = m * (0.38 + 0.06 * Math.sin(t * 0.3 + b.ph));
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.2 + 0.08 * Math.sin(t * 0.5 + b.ph);
        rg.addColorStop(0, `hsla(${b.hue}, 95%, 60%, ${a})`); rg.addColorStop(0.5, `hsla(${b.hue + 20}, 90%, 45%, ${a * 0.35})`); rg.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      }
      // stars: three depths drifting left at different speeds, twinkling
      const sp = (dt / 1000) * (fast ? 6 : 1);
      for (const s of S.stars) {
        s.x -= sp * (0.004 + s.z * 0.02); s.y += sp * (0.001 + s.z * 0.004);
        if (s.x < -0.02) { s.x = 1.02; s.y = Math.random(); } if (s.y > 1.02) s.y = -0.02;
        const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + s.z * 3) + s.ph);
        const r = 0.5 + s.z * 1.5, x = s.x * w, y = s.y * h;
        ctx.fillStyle = s.hue ? `hsla(${s.hue}, 100%, 80%, ${tw})` : `rgba(255,255,255,${tw})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
        if (s.z > 0.88) { // the brightest get a little cross-flare
          ctx.strokeStyle = `rgba(255,255,255,${tw * 0.5})`; ctx.lineWidth = 0.8;
          const L = r * 5 * tw; ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
        }
      }
      // shooting stars
      if (now > S.nextShot) {
        const a = 0.35 + Math.random() * 0.35;
        S.shots.push({ x: w * (0.3 + Math.random() * 0.8), y: h * Math.random() * 0.4, vx: -Math.cos(a), vy: Math.sin(a), t0: now, life: 700 + Math.random() * 500, len: 80 + Math.random() * 90 });
        S.nextShot = now + (fast ? 250 : 2200 + Math.random() * 4000);
      }
      S.shots = S.shots.filter((s) => now - s.t0 < s.life);
      for (const s of S.shots) {
        const k = (now - s.t0) / s.life, d = k * m * 0.7, x = s.x + s.vx * d, y = s.y + s.vy * d;
        const fade = Math.sin(k * Math.PI);
        const lg = ctx.createLinearGradient(x, y, x - s.vx * s.len, y - s.vy * s.len);
        lg.addColorStop(0, `rgba(255,255,255,${fade})`); lg.addColorStop(0.3, `rgba(255,150,240,${fade * 0.6})`); lg.addColorStop(1, 'rgba(255,100,220,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * s.len, y - s.vy * s.len); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    start(el) {
      cancelAnimationFrame(raf);
      const machine = el.querySelector('.slot-machine'), host = el.querySelector('.slot-crew'), reels = el.querySelector('.reels');
      const crew = [...host.querySelectorAll('.crew')]; const cv = host.querySelector('.slot-sky');
      const glance = crew.map(() => ({ until: 0, next: performance.now() + 1500 + Math.random() * 4000 }));
      let s0 = 0, last = performance.now();
      const tick = (now) => {
        if (el.hidden) return;
        const dt = Math.min(50, now - last); last = now;
        const mr = machine.getBoundingClientRect(), rr = reels.getBoundingClientRect();
        const sz = crew[0].offsetWidth || 60;
        host.style.height = `${machine.scrollHeight}px`;
        this.sky(cv, mr.width, machine.scrollHeight, now, dt, el.classList.contains('win'));
        // the track hugs the reels, but never crosses the glass ring
        const ring = 15, gut = parseFloat(getComputedStyle(machine).getPropertyValue('--gut')) || sz, gap = gut / 2;
        const L = Math.max(ring + sz * 0.22, rr.left - mr.left - gap), R = Math.min(mr.width - ring - sz * 0.22, rr.right - mr.left + gap);
        const T = Math.max(ring + sz * 0.22, rr.top - mr.top + machine.scrollTop - gap), B = Math.min(machine.scrollHeight - ring - sz * 0.22, rr.bottom - mr.top + machine.scrollTop + gap);
        const c = Math.min(sz * 0.8, (R - L) / 2, (B - T) / 2);
        const w = R - L - 2 * c, h = B - T - 2 * c, arc = (Math.PI / 2) * c;
        const P = 2 * w + 2 * h + 4 * arc;
        const fast = el.classList.contains('win') ? 3 : 1;
        s0 = (s0 + (dt / 1000) * Math.max(28, P / 48) * fast) % P;
        // point and direction at distance s along the loop (clockwise from the top-left corner's end)
        const at = (s) => {
          s = ((s % P) + P) % P;
          const segs = [
            [w, (u) => [L + c + u, T, 1, 0]],
            [arc, (u) => { const a = -Math.PI / 2 + (u / arc) * (Math.PI / 2); return [R - c + Math.cos(a) * c, T + c + Math.sin(a) * c, -Math.sin(a), Math.cos(a)]; }],
            [h, (u) => [R, T + c + u, 0, 1]],
            [arc, (u) => { const a = (u / arc) * (Math.PI / 2); return [R - c + Math.cos(a) * c, B - c + Math.sin(a) * c, -Math.sin(a), Math.cos(a)]; }],
            [w, (u) => [R - c - u, B, -1, 0]],
            [arc, (u) => { const a = Math.PI / 2 + (u / arc) * (Math.PI / 2); return [L + c + Math.cos(a) * c, B - c + Math.sin(a) * c, -Math.sin(a), Math.cos(a)]; }],
            [h, (u) => [L, B - c - u, 0, -1]],
            [arc, (u) => { const a = Math.PI + (u / arc) * (Math.PI / 2); return [L + c + Math.cos(a) * c, T + c + Math.sin(a) * c, -Math.sin(a), Math.cos(a)]; }],
          ];
          for (const [len, f] of segs) { if (s <= len) return f(s); s -= len; }
          return segs[0][1](0);
        };
        crew.forEach((ch, i) => {
          const [x, y, dx, dy] = at(s0 + (i / crew.length) * P);
          ch.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          const g = glance[i];
          if (now > g.next) { g.until = now + 500 + Math.random() * 500; g.next = now + 2500 + Math.random() * 4500; }
          const back = now < g.until ? -1 : 1;
          ch.style.setProperty('--lx', `${(dx * 3.2 * back).toFixed(2)}px`);
          ch.style.setProperty('--ly', `${(dy * 2.4 * back).toFixed(2)}px`);
          ch.style.setProperty('--face', `${(dx * 18).toFixed(1)}deg`);
          ch.style.setProperty('--lean', `${(dx * 6).toFixed(1)}deg`);
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
  };
})();
