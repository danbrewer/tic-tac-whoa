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
  cherry:  { e: '🍒', label: '' },
  lemon:   { e: '🍋', label: '' },
  bell:    { e: '🔔', label: '' },
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
    return { grid: Array.from({ length: REELS }, (_, i) => ['cherry', 'lemon', 'bell'].map((k, j) => ['cherry', 'lemon', 'bell'][(i + j) % 3])), wins: [] };
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
      const prize = this.roll(level);
      const { grid, wins } = this.makeGrid(prize, level);
      const pool = this.pool(level);
      el.querySelector('.slot-who').innerHTML = `<b class="${player}">${player}</b> found the mystery jackpot! Line up 3+ prize symbols from the left on any payline.`;
      const res = el.querySelector('.slot-result');
      res.className = 'slot-result';
      res.innerHTML = auto ? 'The computer spins...' : 'Press SPIN!';
      const spinBtn = document.getElementById('slotSpin');
      spinBtn.disabled = auto;
      el.classList.remove('win', 'bust');
      el.querySelector('svg.winlines').innerHTML = '';
      const strips = [...el.querySelectorAll('.strip')];
      const rnd = () => pool[(Math.random() * pool.length) | 0];
      strips.forEach((s) => { s.style.transition = 'none'; s.style.transform = 'translateY(0)'; s.innerHTML = [rnd(), rnd(), rnd()].map((k) => this.cellHtml(k)).join(''); });
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('show'));
      Sound.slotOpen();

      let pulled = false;
      const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pull(); } };
      const pull = () => {
        if (pulled) return;
        pulled = true;
        window.removeEventListener('keydown', onKey);
        spinBtn.disabled = true;
        res.innerHTML = '';
        Sound.lever();
        Sound.startMusic();
        const cell = strips[0].parentElement.clientHeight / ROWS;
        // Big drama: an INSTANT WIN on the first reel winds up the rest, which spin much longer.
        const windup = grid[0].includes('jackpot');
        // Small drama: the first two reels already lead a line, so the later reels slow down a bit.
        const teaser = !windup && PAYLINES.some((pl) => grid[0][pl.rows[0]] === grid[1][pl.rows[1]] && SLOT_SYMS[grid[0][pl.rows[0]]].prize);
        const stops = windup ? [1000, 2100, 3100, 4100, 5100] : [1000, 1400, 1800, 2200, 2600].map((t, i) => t + (teaser && i >= 2 ? (i - 1) * 450 : 0));
        if (windup) {
          setTimeout(() => {
            const c0 = strips[0].querySelectorAll('.cell');
            [...c0].slice(-ROWS).forEach((c) => c.classList.contains('s-jackpot') && c.classList.add('tease'));
            strips.slice(1).forEach((s) => s.parentElement.classList.add('tension'));
            el.classList.add('windup');
            res.innerHTML = '<span class="tease-txt">🎆 INSTANT WIN on reel 1...</span>';
            Sound.windup((stops[REELS - 1] - stops[0]) / 1000);
            Sound.musicIntensity(1);
          }, stops[0] + 30);
        }
        strips.forEach((strip, i) => {
          const n = Math.round(18 + i * 6 + (teaser && i >= 2 ? i * 4 : 0) + (windup && i >= 1 ? i * 9 : 0));
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
            Renderer.shake(2);
            strip.parentElement.classList.remove('tension');
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
      Renderer.fireworks(player, 7);
      Sound.fireworks();
      el.classList.add('instant');
      setTimeout(() => el.classList.remove('instant'), 3600);
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
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; resolve(prize); }, 250);
    };
    setTimeout(() => el.addEventListener('click', finish), 400);
    setTimeout(finish, prize === 'bust' ? 2200 : 3600);
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
        cards.forEach((c) => { c.disabled = true; c.classList.toggle('chosen', c === card); c.classList.toggle('gone', c !== card); });
        el.classList.add('picked');
        Sound.cardPick();
        const r = card.getBoundingClientRect();
        Renderer.burst(r.left + r.width / 2, r.top + r.height / 2, player, 110);
        Renderer.flash(0.35, '255,210,63');
        el.querySelector('.rp-hint').innerHTML = `${RULES[k].icon} <b>${RULES[k].name}</b> it is!`;
        setTimeout(() => {
          el.classList.remove('show');
          setTimeout(() => { el.hidden = true; resolve(k); }, 260);
        }, 1700);
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
