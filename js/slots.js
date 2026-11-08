'use strict';
// Mystery-jackpot slot machine: 5 reels x 3 rows, 9 paylines.
// Line up 3, 4 or 5 matching prize symbols from the leftmost reel along a payline to win that prize.

const SLOT_SYMS = {
  extra:   { e: '⚡', label: 'EXTRA TURN', prize: true },
  bomb:    { e: '💣', label: 'BOMB', prize: true },
  steal:   { e: '🎭', label: 'STEAL', prize: true },
  shield:  { e: '🛡️', label: '+1 MARK', prize: true },
  rule:    { e: '🎲', label: 'RULE PICK', prize: true },
  jackpot: { e: '🎆', label: 'INSTANT WIN', prize: true },
  xo:      { e: '<b class="gx">X</b>', label: '' },
  oo:      { e: '<b class="go">O</b>', label: '' },
  gem:     { e: '💎', label: '' },
};
const PRIZES = {
  extra:   { name: 'EXTRA TURN', desc: 'Go again right now!' },
  steal:   { name: 'STEAL', desc: "Flip one of your opponent's marks to yours." },
  bomb:    { name: 'BOMB', desc: 'Blow up one opponent mark (or a stone square).' },
  shield:  { name: '+1 MARK', desc: 'Keep 4 marks instead of 3 for the rest of this game.' },
  rule:    { name: 'RULE PICK', desc: 'Choose the rule for the next Level 0 game.' },
  jackpot: { name: 'INSTANT WIN!', desc: '' },
  bust:    { name: 'NO WIN', desc: 'No luck this time.' },
};
// Odds (percent) of each outcome. Tune here.
const SLOT_ODDS = {
  level0: { extra: 22, bomb: 15, steal: 10, shield: 12, rule: 16, jackpot: 5, bust: 20 },
  big:    { extra: 25, bomb: 17, steal: 12, rule: 18, jackpot: 5, bust: 23 },
};
// Rows: 0 = top, 1 = middle, 2 = bottom. One entry per reel.
const PAYLINES = [
  { name: 'Middle', rows: [1, 1, 1, 1, 1] },
  { name: 'Top', rows: [0, 0, 0, 0, 0] },
  { name: 'Bottom', rows: [2, 2, 2, 2, 2] },
  { name: 'V', rows: [0, 1, 2, 1, 0] },
  { name: 'Peak', rows: [2, 1, 0, 1, 2] },
  { name: 'Zig-zag', rows: [0, 1, 0, 1, 0] },
  { name: 'Zag-zig', rows: [2, 1, 2, 1, 2] },
  { name: 'Step down', rows: [0, 0, 1, 2, 2] },
  { name: 'Step up', rows: [2, 2, 1, 0, 0] },
];
const REELS = 5, ROWS = 3;

const Slots = {
  roll(level) {
    if (Game.dev.on && Game.dev.force) return Game.dev.force;   // Developer Mode
    const odds = { ...(level === 0 ? SLOT_ODDS.level0 : SLOT_ODDS.big) };
    if (!this.shieldOK) delete odds.shield;
    const total = Object.values(odds).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, w] of Object.entries(odds)) { if ((r -= w) < 0) return k; }
    return 'bust';
  },

  pool(level) {
    return Object.keys(SLOT_SYMS).filter((k) => k !== 'shield' || this.shieldOK);
  },

  cellHtml(key) {
    const s = SLOT_SYMS[key];
    const icon = s.e;
    return `<div class="cell s-${key}"><div class="icon">${icon}</div>${s.label ? `<div class="lbl">${s.label}</div>` : ''}</div>`;
  },

  lineWins(grid) {
    const wins = [];
    PAYLINES.forEach((pl, li) => {
      const first = grid[0][pl.rows[0]];
      let n = 1;
      while (n < REELS && grid[n][pl.rows[n]] === first) n++;
      if (n >= 3) wins.push({ li, sym: first, n });
    });
    return wins;
  },

  // Build a 5x3 grid that shows exactly the decided outcome.
  makeGrid(prize, level) {
    const pool = this.pool(level);
    const prizeSyms = pool.filter((k) => SLOT_SYMS[k].prize);
    const rnd = (a) => a[(Math.random() * a.length) | 0];
    for (let attempt = 0; attempt < 2000; attempt++) {
      const grid = Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => rnd(pool)));
      // keep the INSTANT WIN tease on reel 1 special: it only shows up there now and then
      const tease = Game.dev.on && Game.dev.tease;
      if (tease) grid[0][(Math.random() * ROWS) | 0] = 'jackpot';
      else if (prize !== 'jackpot') grid[0] = grid[0].map((k) => (k === 'jackpot' && Math.random() < 0.6 ? rnd(pool.filter((x) => x !== 'jackpot')) : k));
      let win = null;
      if (prize !== 'bust') {
        const li = (Math.random() * PAYLINES.length) | 0;
        const r = Math.random();
        const n = r < 0.62 ? 3 : r < 0.9 ? 4 : 5;
        const rows = PAYLINES[li].rows;
        for (let i = 0; i < n; i++) grid[i][rows[i]] = prize;
        win = { li, n };
      } else if (Math.random() < 0.6) {
        // near miss: two prize symbols lead a line, the third lands one row off
        const pl = PAYLINES[(Math.random() * PAYLINES.length) | 0].rows;
        const s = rnd(prizeSyms);
        grid[0][pl[0]] = s; grid[1][pl[1]] = s;
        grid[2][pl[2] === 1 ? 0 : 1] = s;
      }
      const wins = this.lineWins(grid);
      if (prize === 'bust' ? wins.length === 0 : wins.length >= 1 && wins.every((w) => w.sym === prize)) return { grid, wins };
    }
    // fallback (practically unreachable)
    return { grid: Array.from({ length: REELS }, (_, i) => ['xo', 'oo', 'gem'].map((k, j) => ['xo', 'oo', 'gem'][(i + j) % 3])), wins: [] };
  },

  // the Symbols / Paylines buttons open info panels over the reels
  initPops(el) {
    const pops = [...el.querySelectorAll('.slot-pop')];
    const close = () => { pops.forEach((p) => { p.hidden = true; }); el.querySelectorAll('.slot-tab').forEach((t) => t.classList.remove('on')); };
    close();
    if (el.dataset.popsBound) return;
    el.dataset.popsBound = '1';
    el.querySelectorAll('.slot-tab').forEach((t) => t.addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = el.querySelector(`.slot-pop[data-pop="${t.dataset.open}"]`);
      const opening = pop.hidden;
      close();
      if (opening) { pop.hidden = false; t.classList.add('on'); Sound.cardFlip(0); }
    }));
    el.querySelectorAll('.pop-x').forEach((x) => x.addEventListener('click', (e) => { e.stopPropagation(); close(); }));
    el.querySelectorAll('.slot-pop').forEach((p) => p.addEventListener('click', (e) => { if (e.target === p) close(); }));
    this.closePops = close;
  },

  buildChrome(level) {
    const el = document.getElementById('slots');
    // reels
    const reels = el.querySelector('.reels');
    reels.querySelectorAll('.reel').forEach((r) => r.remove());
    for (let i = 0; i < REELS; i++) {
      const r = document.createElement('div');
      r.className = 'reel';
      r.innerHTML = '<div class="strip"></div>';
      reels.insertBefore(r, reels.querySelector('svg'));
    }
    // paytable
    const pool = this.pool(level).filter((k) => SLOT_SYMS[k].prize);
    el.querySelector('.paytable').innerHTML = pool.map((k) => `<div class="pay" data-k="${k}">${this.cellHtml(k)}<div class="pay-txt">${k === 'jackpot' ? (level === 0 ? 'Win this game' : 'Claim any square') : k === 'rule' ? "Pick the next game's rule" : PRIZES[k].desc.replace(/\s*\(.*\)/, '')}</div></div>`).join('');
    // payline legend
    el.querySelector('.lines').innerHTML = PAYLINES.map((pl, li) => {
      let dots = '';
      for (let row = 0; row < ROWS; row++) for (let i = 0; i < REELS; i++) dots += `<i class="${pl.rows[i] === row ? 'on' : ''}"></i>`;
      return `<div class="pl" data-li="${li}" title="${pl.name}"><div class="pl-grid">${dots}</div><span>${pl.name}</span></div>`;
    }).join('');
  },

  spin(player, level, auto, opts = {}) {
    this.shieldOK = opts.shield !== undefined ? !!opts.shield : level === 0;
    return new Promise((resolve) => {
      const el = document.getElementById('slots');
      this.buildChrome(level);
      Crew.build(el.querySelector('.slot-crew'));
      const prize = this.roll(level);
      const { grid, wins } = this.makeGrid(prize, level);
      const pool = this.pool(level);
      el.querySelector('.slot-who').innerHTML = `<b class="${player}">${player}</b> found the mystery jackpot! Line up 3+ prize symbols from the left on any payline.`;
      const res = el.querySelector('.slot-result');
      res.className = 'slot-result';
      res.innerHTML = auto ? 'The computer spins...' : '';
      this.initPops(el);
      const spinBtn = document.getElementById('slotSpin');
      spinBtn.disabled = auto;
      el.classList.remove('win', 'bust', 'streak');
      this.streakBroken = false;
      el.querySelector('svg.winlines').innerHTML = '';
      const strips = [...el.querySelectorAll('.strip')];
      const rnd = () => pool[(Math.random() * pool.length) | 0];
      strips.forEach((s) => { s.style.transition = 'none'; s.style.transform = 'translateY(0)'; s.innerHTML = [rnd(), rnd(), rnd()].map((k) => this.cellHtml(k)).join(''); });
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('show'));
      Crew.start(el);
      Sound.slotOpen();

      let pulled = false;
      const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pull(); } };
      const pull = () => {
        if (pulled) return;
        pulled = true;
        window.removeEventListener('keydown', onKey);
        spinBtn.disabled = true;
        res.innerHTML = '';
        if (this.closePops) this.closePops();
        Sound.lever();
        Sound.startMusic();
        const cell = strips[0].parentElement.clientHeight / ROWS;
        // Big drama: an INSTANT WIN on the first reel winds up the rest, which spin much longer.
        const windup = grid[0].includes('jackpot');
        // Small drama: the first two reels already lead a line, so the later reels slow down a bit.
        const teaser = !windup && PAYLINES.some((pl) => grid[0][pl.rows[0]] === grid[1][pl.rows[1]] && SLOT_SYMS[grid[0][pl.rows[0]]].prize);
        const isIW = prize === 'jackpot';          // shaking is reserved for a real INSTANT WIN
        // Two INSTANT WINs already on a payline: the deciding third reel spins much longer.
        const twoUp = windup && this.streakRows(grid, 1).size > 0;
        let stops = [1000, 1400, 1800, 2200, 2600].map((t, i) => t + (teaser && i >= 2 ? (i - 1) * 450 : 0));
        if (windup) {
          stops = [1000];
          for (let i = 1; i < REELS; i++) {
            let gap = 1100;
            if (i >= 2 && this.streakRows(grid, i - 1).size === 0) gap = 380;   // streak already broken: wrap up quickly
            if (i === 2 && twoUp) gap = 3200;                                    // the suspense reel
            stops.push(stops[i - 1] + gap);
          }
        }
        this.suspense = twoUp ? { reel: 2, dur: stops[2] - stops[1] } : null;
        el.classList.toggle('calm', windup && !isIW);
        if (windup) {
          setTimeout(() => {
            const c0 = strips[0].querySelectorAll('.cell');
            [...c0].slice(-ROWS).forEach((c) => c.classList.contains('s-jackpot') && c.classList.add('tease'));
            if (isIW) strips.slice(1).forEach((s) => s.parentElement.classList.add('tension'));
            el.classList.add('windup');
            el.classList.toggle('shaky', isIW);
            res.innerHTML = '<span class="tease-txt">🎆 INSTANT WIN on reel 1...</span>';
            Sound.windup((stops[twoUp ? 2 : REELS - 1] - stops[0]) / 1000);
            Sound.musicIntensity(1);
          }, stops[0] + 30);
        }
        strips.forEach((strip, i) => {
          const n = Math.round(18 + i * 6 + (teaser && i >= 2 ? i * 4 : 0) + (windup && i >= 1 ? (stops[i] - 1000) / 75 : 0));
          let html = '';
          for (let j = 0; j < n; j++) html += this.cellHtml(rnd());
          html += grid[i].map((k) => this.cellHtml(k)).join('');
          strip.innerHTML = html;
          strip.style.transition = 'none';
          strip.style.transform = 'translateY(0)';
          void strip.offsetHeight;
          strip.style.transition = `transform ${stops[i]}ms cubic-bezier(.12,.8,.25,1.04)`;
          strip.style.transform = `translateY(${-n * cell}px)`;
          strip.parentElement.classList.remove('tension');
          setTimeout(() => {
            Sound.reelStop(i);
            if (!windup || isIW) Renderer.shake(2);
            strip.parentElement.classList.remove('tension', 'suspense');
            if (i >= 1 && windup) this.streakStop(el, strips, grid, i, isIW);
            if (i === 1 && twoUp) {
              // one more INSTANT WIN wins it: the music drops out, a drum roll builds, reel 3 keeps spinning
              const r3 = strips[2].parentElement;
              r3.classList.add('suspense');
              if (isIW) r3.classList.add('tension');
              Sound.musicMute(true);
              Sound.drumroll((stops[2] - stops[1]) / 1000);
              setTimeout(() => { res.innerHTML = '<span class="tease-txt">🎆🎆 ONE MORE FOR AN INSTANT WIN...</span>'; }, 650);
            }
            if (i === 2 && twoUp) Sound.musicMute(false);
            if (i === REELS - 1) { Sound.stopMusic(); el.classList.remove('windup'); }
            if (i === 1 && teaser) { strips.slice(2).forEach((s) => s.parentElement.classList.add('tension')); Sound.tension(); }
          }, stops[i]);
        });
        let t = 0;
        const last = stops[REELS - 1];
        const tick = () => { if (t > last - 120) return; Sound.reelTick(); const gap = 50 + (t / last) * 150; t += gap; setTimeout(tick, gap); };
        tick();
        setTimeout(() => this.reveal(el, res, player, level, prize, grid, wins, resolve), last + 200);
      };
      spinBtn.onclick = pull;
      if (auto) setTimeout(pull, 900);
      else window.addEventListener('keydown', onKey);
    });
  },

  reveal(el, res, player, level, prize, grid, wins, resolve) {
    const p = PRIZES[prize];
    const desc = prize === 'jackpot' ? (level === 0 ? 'You win this game on the spot!' : 'Claim any empty square instantly!') : p.desc;
    if (prize !== 'bust') {
      const w = wins[0];
      const kind = w.n === 5 ? 'FIVE' : w.n === 4 ? 'FOUR' : 'THREE';
      res.innerHTML = `<div class="prize-name">${p.name}</div><div class="prize-desc">${kind} of a kind on the <b>${PAYLINES[w.li].name}</b> line${wins.length > 1 ? ` (+${wins.length - 1} more line${wins.length > 2 ? 's' : ''})` : ''}. ${desc}</div>`;
      this.drawWinLines(el, wins);
      el.querySelector(`.pay[data-k="${prize}"]`)?.classList.add('hit');
      wins.forEach((x) => el.querySelector(`.pl[data-li="${x.li}"]`)?.classList.add('hit'));
    } else {
      res.innerHTML = `<div class="prize-name">${p.name}</div><div class="prize-desc">${desc}</div>`;
    }
    res.classList.add(prize === 'bust' ? 'is-bust' : 'is-win');
    el.classList.add(prize === 'bust' ? 'bust' : 'win');
    if (prize === 'bust') Sound.slotBust(); else Sound.slotWin(prize === 'jackpot' || wins[0].n === 5);
    if (prize === 'jackpot') {
      Renderer.fireworks(player, 9);
      Sound.fireworks();
      Sound.fanfare();
      Sound.instantWin();                       // booming "INSTANT WIN!" voice-over in a big hall
      el.classList.add('instant');
      setTimeout(() => el.classList.remove('instant'), 5200);
      this.instantBanner(el, wins);
    }
    if (prize !== 'bust') {
      const r = el.querySelector('.reels').getBoundingClientRect();
      Renderer.burst(r.left + r.width / 2, r.top + r.height / 2, player, prize === 'jackpot' ? 160 : 60 + wins[0].n * 20);
      Renderer.flash(prize === 'jackpot' ? 0.7 : 0.3, '255,210,63');
    }
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      el.removeEventListener('click', finish);
      this.explodeBanner();
      Boom.run(el.querySelector('.slot-machine').getBoundingClientRect());
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; resolve(prize); }, 250);
    };
    setTimeout(() => el.addEventListener('click', finish), 400);
    setTimeout(finish, prize === 'bust' ? 2200 : prize === 'jackpot' ? 5600 : 3600);
  },

  // Rows of reel i that continue an unbroken INSTANT WIN run from reel 1 along some payline.
  streakRows(grid, i) {
    const rows = new Set();
    PAYLINES.forEach((pl) => {
      for (let r = 0; r <= i; r++) if (grid[r][pl.rows[r]] !== 'jackpot') return;
      rows.add(pl.rows[i]);
    });
    return rows;
  },

  // A reel just stopped during an INSTANT WIN wind-up: lock in the streak with escalating juice.
  streakStop(el, strips, grid, i, isIW) {
    const rows = this.streakRows(grid, i);
    if (!rows.size) {
      if (!this.streakBroken) { this.streakBroken = true; Sound.streakBreak(); el.classList.remove('windup'); strips.slice(i + 1).forEach((s) => s.parentElement.classList.remove('tension')); }
      return;
    }
    const s = i + 1;   // streak length: 2..5
    const machine = el.querySelector('.slot-machine');
    // light every cell on a payline that is still all INSTANT WIN through this reel
    const alive = PAYLINES.filter((pl) => { for (let r = 0; r <= i; r++) if (grid[r][pl.rows[r]] !== 'jackpot') return false; return true; });
    for (let r = 0; r <= i; r++) {
      const cells = [...strips[r].querySelectorAll('.cell')].slice(-ROWS);
      cells.forEach((c, row) => {
        if (!alive.some((pl) => pl.rows[r] === row)) return;
        c.classList.remove('tease');
        c.classList.add('lock');
        c.style.setProperty('--s', s);
      });
      strips[r].parentElement.classList.add('lit');
      strips[r].parentElement.style.setProperty('--s', s);
    }
    // fresh cells on this reel get the big pop
    const cells = [...strips[i].querySelectorAll('.cell')].slice(-ROWS);
    const labels = { 2: 'x2!', 3: 'INSTANT WIN!', 4: 'MEGA WIN!!', 5: 'ULTRA WIN!!!' };
    const mr = machine.getBoundingClientRect();
    rows.forEach((row) => {
      const c = cells[row];
      c.classList.remove('lockpop'); void c.offsetWidth; c.classList.add('lockpop');
      const r = c.getBoundingClientRect();
      const x = r.left - mr.left + r.width / 2 + machine.scrollLeft, y = r.top - mr.top + r.height / 2 + machine.scrollTop;
      this.domBurst(machine, x, y, 10 + s * 9, 60 + s * 30);
      this.popText(machine, x, y - r.height * 0.45, labels[s], s);
    });
    el.classList.add('streak');
    el.style.setProperty('--s', s);
    if (isIW) { machine.classList.remove('jolt'); void machine.offsetWidth; machine.classList.add('jolt'); }
    const fl = document.createElement('div');
    fl.className = 'jflash';
    fl.style.opacity = 0.15 + s * 0.12;
    machine.appendChild(fl);
    setTimeout(() => fl.remove(), 600);
    if (isIW) Renderer.shake(3 + s * 3);
    Sound.lockIn(s);
    const res = el.querySelector('.slot-result');
    res.innerHTML = `<span class="tease-txt">🎆 ${'🎆'.repeat(s - 1)} ${s} IN A ROW${s >= 3 ? '... INSTANT WIN!' : '...'}</span>`;
    Sound.musicIntensity(1);
  },

  // Huge bubbly INSTANT WIN title above the machine, with explosions around it and on the winning symbols.
  instantBanner(el, wins) {
    const machine = el.querySelector('.slot-machine');
    const mr = machine.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'iwb';
    const word = 'INSTANT WIN!';
    b.innerHTML = [...word].map((ch, i) => ch === ' ' ? '<span class="sp"> </span>' : `<span style="--i:${i}">${ch}</span>`).join('');
    document.body.appendChild(b);
    const h = b.getBoundingClientRect().height;
    b.style.top = `${Math.max(4, mr.top - h * 0.55)}px`;
    // explosions: around the title, then on each winning symbol
    const host = document.body;
    const br = b.getBoundingClientRect();
    for (let k = 0; k < 6; k++) setTimeout(() => {
      const x = br.left + Math.random() * br.width, y = br.top + Math.random() * br.height;
      this.boom(host, x, y, 34, 170);
    }, 150 + k * 260);
    const mr2 = machine.getBoundingClientRect();
    machine.querySelectorAll('.cell.hit, .cell.lock').forEach((c, k) => setTimeout(() => {
      const r = c.getBoundingClientRect();
      this.domBurst(machine, r.left - mr2.left + r.width / 2 + machine.scrollLeft, r.top - mr2.top + r.height / 2 + machine.scrollTop, 26, 140);
    }, k * 90));
    this.iwBanner = b;
    setTimeout(() => { if (this.iwBanner === b) this.explodeBanner(); }, 9000);   // failsafe
  },

  // The machine is leaving: blow the INSTANT WIN! letters apart, one after another.
  explodeBanner() {
    const b = this.iwBanner;
    if (!b) return;
    this.iwBanner = null;
    const wrap = document.createElement('div');
    wrap.className = 'jfixed';
    document.body.appendChild(wrap);
    const letters = [...b.querySelectorAll('span:not(.sp)')];
    const cx = window.innerWidth / 2;
    letters.forEach((sp, i) => {
      const delay = i * 45;
      const r = sp.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const away = (x - cx) / (window.innerWidth / 2);
      const dx = away * 260 + (Math.random() - 0.5) * 260, dy = -120 - Math.random() * 240;
      sp.animate([
        { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1, filter: 'brightness(1)' },
        { transform: 'translate(0,0) scale(1.45) rotate(0)', opacity: 1, filter: 'brightness(2.2)', offset: 0.18 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.15) rotate(${(Math.random() - 0.5) * 900}deg)`, opacity: 0, filter: 'brightness(1)' },
      ], { duration: 720, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      setTimeout(() => {
        const col = getComputedStyle(sp).color;
        const ring = document.createElement('div');
        ring.className = 'jboom';
        ring.style.cssText = `left:${x}px;top:${y}px;width:${r.height * 1.6}px;height:${r.height * 1.6}px;`;
        document.body.appendChild(ring);
        ring.animate([{ transform: 'translate(-50%,-50%) scale(0.1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => ring.remove();
        this.domBurst(wrap, x, y, 16, 120 + r.height, col);
        if (i % 2 === 0) Sound.boomSmall();
      }, delay + 130);
    });
    Sound.pop(3);
    setTimeout(() => { b.remove(); wrap.remove(); }, letters.length * 45 + 1500);
  },

  // A screen-space explosion: a flash ring plus sparks (fixed position on the page).
  boom(host, x, y, n, dist) {
    const ring = document.createElement('div');
    ring.className = 'jboom';
    ring.style.cssText = `left:${x}px;top:${y}px;`;
    host.appendChild(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(0.1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => ring.remove();
    const wrap = document.createElement('div');
    wrap.className = 'jfixed';
    host.appendChild(wrap);
    this.domBurst(wrap, x, y, n, dist);
    setTimeout(() => wrap.remove(), 1400);
    Sound.boomSmall();
  },

  domBurst(host, x, y, n, dist, tint) {
    const cols = tint ? [tint, tint, '#fff6c8', '#ffd23f'] : ['#ffd23f', '#ff006e', '#3a86ff', '#06d6a0', '#fff6c8', '#ff9f1c'];
    for (let k = 0; k < n; k++) {
      const p = document.createElement('i');
      p.className = 'jspark';
      const sz = 4 + Math.random() * 7;
      p.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${cols[k % cols.length]};`;
      if (k % 5 === 0) { p.textContent = '✦'; p.style.background = 'none'; p.style.color = cols[k % cols.length]; p.style.fontSize = `${sz * 2.2}px`; }
      host.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = dist * (0.4 + Math.random() * 0.8);
      const anim = p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) scale(0.2) rotate(${Math.random() * 540}deg)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 500, easing: 'cubic-bezier(.15,.8,.3,1)' });
      anim.onfinish = () => p.remove();
    }
  },

  popText(host, x, y, text, s) {
    const t = document.createElement('div');
    t.className = 'jpop';
    t.textContent = text;
    t.style.cssText = `left:${x}px;top:${y}px;font-size:${14 + s * 6}px;`;
    host.appendChild(t);
    const anim = t.animate([
      { transform: 'translate(-50%,-50%) scale(0.2) rotate(-12deg)', opacity: 0 },
      { transform: 'translate(-50%,-80%) scale(1.25) rotate(4deg)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-120%) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%,-170%) scale(0.9)', opacity: 0 },
    ], { duration: 1300, easing: 'ease-out' });
    anim.onfinish = () => t.remove();
  },

  drawWinLines(el, wins) {
    const reels = el.querySelector('.reels');
    const svg = el.querySelector('svg.winlines');
    const rr = reels.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${rr.width} ${rr.height}`);
    const reelEls = [...reels.querySelectorAll('.reel')];
    let html = '';
    wins.forEach((w, wi) => {
      const pts = [];
      reelEls.forEach((re, i) => {
        const b = re.getBoundingClientRect();
        const ch = b.height / ROWS;
        const row = PAYLINES[w.li].rows[i];
        pts.push([b.left - rr.left + b.width / 2, b.top - rr.top + ch * (row + 0.5)]);
        if (i < w.n) {
          const strip = re.querySelector('.strip');
          const cells = strip.querySelectorAll('.cell');
          cells[cells.length - ROWS + row]?.classList.add('hit');
        }
      });
      const d = pts.map((p) => p.join(',')).join(' ');
      html += `<polyline class="wl glow" points="${d}" style="animation-delay:${wi * 0.25}s"/><polyline class="wl" points="${d}" style="animation-delay:${wi * 0.25}s"/>`;
    });
    svg.innerHTML = html;
  },
};

// RULE PICK prize: the winner chooses the rule for the next Level 0 game from a hand of cards.
const RulePick = {
  // Break a card into a grid of shards (clipped copies of itself) that fly out from the centre.
  shatter(host, card, r) {
    const cols = 3, rows = 4, cx = r.width / 2, cy = r.height / 2;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const sh = card.cloneNode(true);
        sh.className = `${[...card.classList].filter((c) => c.startsWith('rule-')).join(' ')} rp-card rp-shard`;
        const x0 = (gx / cols) * 100, x1 = ((gx + 1) / cols) * 100, y0 = (gy / rows) * 100, y1 = ((gy + 1) / rows) * 100;
        const j = () => (Math.random() - 0.5) * 8;
        sh.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;min-height:0;max-width:none;margin:0;`
          + `animation:none;opacity:1;transform:none;visibility:visible;z-index:4;pointer-events:none;`
          + `clip-path:polygon(${x0 + j()}% ${y0 + j()}%, ${x1 + j()}% ${y0 + j()}%, ${x1 + j()}% ${y1 + j()}%, ${x0 + j()}% ${y1 + j()}%);`;
        host.appendChild(sh);
        const px = ((gx + 0.5) / cols) * r.width - cx, py = ((gy + 0.5) / rows) * r.height - cy;
        const d = Math.hypot(px, py) || 1, pow = 260 + Math.random() * 320;
        const tx = (px / d) * pow + (Math.random() - 0.5) * 120, ty = (py / d) * pow - 120 + Math.random() * 60;
        const rot = (Math.random() - 0.5) * 900;
        sh.animate([
          { transform: 'translate(0,0) rotate(0) scale(1.34)', opacity: 1, filter: 'brightness(2.4)' },
          { transform: `translate(${tx * 0.6}px, ${ty * 0.6}px) rotate(${rot * 0.5}deg) scale(1)`, opacity: 1, filter: 'brightness(1.2)', offset: 0.35 },
          { transform: `translate(${tx}px, ${ty + window.innerHeight * 0.7}px) rotate(${rot}deg) scale(0.7)`, opacity: 0, filter: 'brightness(1)' },
        ], { duration: 1300 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.6,1)', fill: 'forwards' }).onfinish = () => sh.remove();
      }
    }
  },

  open(player, auto, current, cpuPick) {
    return new Promise((resolve) => {
      const el = document.getElementById('rulepick');
      el.querySelector('.rp-who').innerHTML = `<b class="${player}">${player}</b> ${auto ? '(computer) ' : ''}chooses the rule for the next Level 0 game`;
      const hand = el.querySelector('.rp-cards');
      hand.innerHTML = RULE_KEYS.map((k, i) => {
        const R = RULES[k];
        return `<button type="button" class="rp-card rule-${k}${k === current ? ' current' : ''}" data-k="${k}" style="--i:${i}" ${auto ? 'disabled' : ''}>
          <span class="rp-icon">${R.icon}</span><span class="rp-name">${R.name}</span><span class="rp-line">${R.short}</span>${k === current ? '<span class="rp-now">playing now</span>' : ''}</button>`;
      }).join('');
      el.classList.remove('picked');
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('show'));
      Sound.slotOpen();
      RULE_KEYS.forEach((_, i) => setTimeout(() => Sound.cardFlip(i), 250 + i * 110));
      const cards = [...hand.querySelectorAll('.rp-card')];
      let done = false;
      const choose = (k) => {
        if (done) return; done = true;
        const card = cards.find((c) => c.dataset.k === k);
        cards.forEach((c) => { c.disabled = true; c.classList.remove('lit'); });
        el.classList.add('picked');
        el.querySelector('.rp-hint').innerHTML = `${RULES[k].icon} <b>${RULES[k].name}</b> it is!`;
        // 1) the chosen card swells and trembles like it's about to blow
        Sound.windup(0.4);
        card.style.zIndex = 3;
        // the game's icon leaps out of the card to centre stage, and later lands on the title card
        IconFly.lift(card.querySelector('.rp-icon'));
        card.animate([
          { transform: 'scale(1) rotate(0)', filter: 'brightness(1)', opacity: 1 },
          { transform: 'scale(1.12) rotate(-5deg)', filter: 'brightness(1.2)', opacity: 1, offset: 0.25 },
          { transform: 'scale(1.18) rotate(5deg)', filter: 'brightness(1.4)', opacity: 1, offset: 0.5 },
          { transform: 'scale(1.26) rotate(-6deg)', filter: 'brightness(1.7)', opacity: 1, offset: 0.75 },
          { transform: 'scale(1.34) rotate(0)', filter: 'brightness(2.4)', opacity: 1 },
        ], { duration: 420, easing: 'ease-in', fill: 'forwards' });
        // 2) BOOM: it shatters, and the blast knocks the rest of the hand off the screen
        setTimeout(() => {
          const r = card.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          this.shatter(el, card, r);
          card.style.visibility = 'hidden';
          Slots.boom(el, cx, cy, 54, Math.max(260, r.width * 1.8));
          Sound.boom(); Sound.cardPick();
          Renderer.burst(cx, cy, player, 110);
          Renderer.flash(0.5, '255,210,63');
          el.querySelector('.rp-panel').animate([
            { transform: 'translate(0,0)' }, { transform: 'translate(-12px,6px)' }, { transform: 'translate(10px,-8px)' },
            { transform: 'translate(-7px,-4px)' }, { transform: 'translate(5px,5px)' }, { transform: 'translate(0,0)' },
          ], { duration: 420, easing: 'ease-out' });
          cards.forEach((c, i) => {
            if (c === card) return;
            const q = c.getBoundingClientRect();
            let ux = q.left + q.width / 2 - cx, uy = q.top + q.height / 2 - cy;
            const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
            const side = Math.sign(ux) || (Math.random() < 0.5 ? -1 : 1);
            const far = Math.max(window.innerWidth, window.innerHeight) * 1.1;
            const spin = side * (300 + Math.random() * 360);
            setTimeout(() => Sound.cardFlip(i), d * 0.35);
            c.animate([
              { transform: 'translate(0,0) rotate(0)', opacity: 1 },
              { transform: `translate(${ux * 90}px, ${uy * 60 - 70}px) rotate(${spin * 0.12}deg) scale(1.05)`, opacity: 1, offset: 0.2 },
              { transform: `translate(${ux * far}px, ${uy * far * 0.5 + window.innerHeight * 0.55}px) rotate(${spin}deg) scale(0.8)`, opacity: 1 },
            ], { duration: 1000 + Math.random() * 250, delay: d * 0.35, easing: 'cubic-bezier(.25,.6,.55,1)', fill: 'forwards' });
          });
        }, 420);
        setTimeout(() => {
          el.classList.remove('show');
          setTimeout(() => { el.hidden = true; el.querySelectorAll('.rp-shard').forEach((n) => n.remove()); resolve(k); }, 260);
        }, 2000);
      };
      if (auto) {
        // the computer "thinks": a highlight runs across the hand and slows down onto its pick
        const pick = cpuPick();
        el.querySelector('.rp-hint').textContent = 'The computer is choosing...';
        const target = RULE_KEYS.indexOf(pick);
        const steps = 2 * RULE_KEYS.length + target;
        let n = 0;
        const hop = () => {
          cards.forEach((c, i) => c.classList.toggle('lit', i === n % cards.length));
          Sound.reelTick();
          if (n >= steps) { setTimeout(() => choose(pick), 350); return; }
          n++;
          setTimeout(hop, 70 + n * n * 1.6);
        };
        setTimeout(hop, 1100);
      } else {
        el.querySelector('.rp-hint').textContent = 'Click a card to choose';
        cards.forEach((c) => c.addEventListener('click', () => choose(c.dataset.k)));
      }
    });
  },
};
