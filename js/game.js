'use strict';
// Game rules, flow, AI, persistence and HUD.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
// Names as the cells appear on screen in the isometric view (col i runs down-right, row j down-left).
const CELL_NAMES = ['top', 'upper-right', 'right', 'upper-left', 'center', 'lower-right', 'left', 'lower-left', 'bottom'];
const other = (p) => (p === 'X' ? 'O' : 'X');
const SAVE_KEY = 'infinite-ttt-save-v1';
const PREFS_KEY = 'infinite-ttt-prefs-v1';
const KEEP_MARKS = 3;   // Level 0: each player keeps only their 3 newest marks
const MOVE_CAP = 18;    // Level 0: no winner after this many marks counts as a draw
const DEAD = '#';       // neutral square that blocks both players

class Board {
  constructor(level, starter) {
    this.level = level;
    this.cells = Array.from({ length: 9 }, () => ({ owner: null, t: -1e9, child: null, record: null }));
    this.starter = starter;
    this.turn = starter;
    this.winner = null;
    this.winLine = null;
    this.winTime = 0;
    this.pending = null;   // cell index being fought over in a child game
    this.parent = null;
    this.parentIndex = -1;
    this.seeded = false;   // center pre-filled by the previous top level's winner
    this.alpha = 1;
    this.born = performance.now();
    this.geo = null;
    this.hist = { X: [], O: [] };  // Level 0 placement order, oldest first
    this.moves = 0;
    this.ghosts = [];              // vanishing marks still animating out
    this.jackpot = (Math.random() * 9) | 0;  // hidden mystery-jackpot square (-1 once found)
    this.keep = { X: KEEP_MARKS, O: KEEP_MARKS };
  }
}

function lineResult(owners) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (owners[a] && owners[a] !== DEAD && owners[a] === owners[b] && owners[a] === owners[c]) return { p: owners[a], line };
  }
  return owners.every((o) => o) ? 'draw' : null;
}

// ---------- computer player ----------
const AI = {
  negamax(o, p, depth) {
    const r = lineResult(o);
    if (r === 'draw') return 0;
    if (r) return r.p === p ? 10 - depth : depth - 10;
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (o[i]) continue;
      o[i] = p;
      best = Math.max(best, -this.negamax(o, other(p), depth + 1));
      o[i] = null;
    }
    return best;
  },
  // Level 0 with vanishing marks: depth-limited search (games can't fill up, so no full solve).
  vanishSearch(o, h, p, depth, ply) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (o[i]) continue;
      const o2 = o.slice(), h2 = { X: h.X.slice(), O: h.O.slice() };
      o2[i] = p; h2[p].push(i);
      if (h2[p].length > KEEP_MARKS) o2[h2[p].shift()] = null;
      const r = lineResult(o2);
      let v;
      if (r && r !== 'draw') v = 100 - ply;
      else if (depth <= 1) v = threatsOf(o2)[p].size * 3 - threatsOf(o2)[other(p)].size * 4;
      else v = -this.vanishSearch(o2, h2, other(p), depth - 1, ply + 1);
      if (v > best) best = v;
    }
    return best === -Infinity ? 0 : best;
  },
  chooseVanish(board, me) {
    const o = board.cells.map((c) => c.owner), h = board.hist;
    const free = o.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (Math.random() < 0.15) return free[(Math.random() * free.length) | 0];
    let best = -Infinity, picks = [];
    for (const i of free) {
      const o2 = o.slice(), h2 = { X: h.X.slice(), O: h.O.slice() };
      o2[i] = me; h2[me].push(i);
      if (h2[me].length > KEEP_MARKS) o2[h2[me].shift()] = null;
      const r = lineResult(o2);
      const v = r && r !== 'draw' ? 1000 : -this.vanishSearch(o2, h2, other(me), 4, 1);
      if (v > best) { best = v; picks = [i]; } else if (v === best) picks.push(i);
    }
    return picks[(Math.random() * picks.length) | 0];
  },
  // Best target for a slot prize: steal/bomb an opponent mark, or claim an empty square.
  pickTarget(b, me, cands, kind) {
    const o = b.cells.map((c) => c.owner);
    let best = -Infinity, pick = cands[0];
    for (const k of cands) {
      const o2 = o.slice();
      o2[k] = kind === 'bomb' ? null : me;
      const r = lineResult(o2);
      const t = threatsOf(o2);
      const v = (r && r !== 'draw' && r.p === me ? 1000 : 0) + t[me].size * 3 - t[other(me)].size * 4 + Math.random();
      if (v > best) { best = v; pick = k; }
    }
    return pick;
  },
  choose(owners, me) {
    const free = owners.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
    if (Math.random() < 0.18) return free[(Math.random() * free.length) | 0]; // a little human error
    if (free.length === 9) return [0, 2, 4, 6, 8][(Math.random() * 5) | 0];
    let best = -Infinity, picks = [];
    for (const i of free) {
      const o = owners.slice();
      o[i] = me;
      const v = -this.negamax(o, other(me), 1);
      if (v > best) { best = v; picks = [i]; } else if (v === best) picks.push(i);
    }
    return picks[(Math.random() * picks.length) | 0];
  },
};

// ---------- persistence ----------
function serialize(b) {
  return {
    l: b.level, s: b.starter, t: b.turn, p: b.pending, sd: b.seeded, w: b.winner, wl: b.winLine, h: b.hist, mv: b.moves, jp: b.jackpot, kp: b.keep,
    c: b.cells.map((c) => [c.owner, c.child ? serialize(c.child) : null, c.record ? serialize(c.record) : null]),
  };
}
function deserialize(d, parent = null, parentIndex = -1) {
  const b = new Board(d.l, d.s);
  b.turn = d.t; b.pending = d.p; b.seeded = !!d.sd;
  b.winner = d.w || null; b.winLine = d.wl || null; b.winTime = -1e9;
  b.moves = d.mv || 0;
  if (d.jp !== undefined) b.jackpot = d.jp;
  if (d.kp) b.keep = d.kp;
  b.parent = parent; b.parentIndex = parentIndex;
  b.born = -1e9;
  d.c.forEach(([owner, child, record], k) => {
    b.cells[k].owner = owner;
    if (child) b.cells[k].child = deserialize(child, b, k);
    if (record) { b.cells[k].record = deserialize(record, b, k); b.cells[k].record.alpha = 0; }
  });
  if (d.h) b.hist = d.h;
  else ['X', 'O'].forEach((p) => { b.hist[p] = b.cells.map((c, k) => (c.owner === p ? k : -1)).filter((k) => k >= 0); });
  return b;
}

// ---------- game ----------
const $ = (id) => document.getElementById(id);

const Game = {
  root: null,
  busy: false,
  vsCPU: false,
  best: 0,
  cpuTimer: null,
  toastTimer: null,
  confirmTimer: null,
  gen: 0,
  view: null,   // board being reviewed (null = following the live game)
  trail: [],    // boards to return to when zooming back in

  focus() { return this.view || this.current(); },

  // Await something, then abort the sequence if a new game started meanwhile.
  async step(p) {
    const g = this.gen;
    const v = await p;
    if (g !== this.gen) throw new Error('cancelled');
    return v;
  },

  current() {
    let b = this.root;
    while (b.pending != null && b.cells[b.pending].child) b = b.cells[b.pending].child;
    return b;
  },

  layoutAll() { layout(this.root, 0, 0, 0, 1); },

  start() {
    this.loadPrefs();
    let restored = false;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { this.root = deserialize(JSON.parse(raw)); restored = true; }
    } catch (e) { this.root = null; }
    if (!this.root) this.root = new Board(0, 'X');
    this.layoutAll();
    Renderer.setCam(viewOf(this.current()));
    this.updateHUD();
    if (!restored) this.showHelp(true);
    else this.toast(`Welcome back! Picking up at Level ${this.current().level}.`);
    this.scheduleCPU();
  },

  newGame() {
    clearTimeout(this.cpuTimer);
    this.gen++;
    this.busy = false;
    this.view = null;
    this.trail = [];
    this.selecting = null;
    Renderer.select = null;
    { const s = document.getElementById('slots'); s.hidden = true; s.classList.remove('show'); }
    ReviewSet.clear();
    Tweens.list = [];
    this.root = new Board(0, 'X');
    this.layoutAll();
    Renderer.setCam(viewOf(this.root));
    Renderer.particles = [];
    this.save();
    this.updateHUD();
    this.toast('New game! Level 0: X goes first.');
    this.scheduleCPU();
  },

  claim(b, k, p) {
    b.cells[k].owner = p;
    b.cells[k].t = performance.now();
    Sound.place(p);
    const gen = this.gen;
    // impact moment: when the falling piece first hits the tile
    setTimeout(() => {
      if (gen !== this.gen || !b.geo) return;
      const [x, y] = Renderer.cellScreen(b, k);
      Renderer.ripple(b, k, p);
      Renderer.sparks(x, y, p, 16 + b.level * 10, 6 + b.level * 2);
      Renderer.shake(3 + b.level * 3);
      Renderer.kick(0.012 + b.level * 0.01);
      Sound.land(b.level);
      if (b.level > 0) {
        Renderer.floatText(x, y - 20, 'CLAIMED!', p, 30 + b.level * 6);
        b.waveT = performance.now(); b.waveAmp = 0.12;
      }
    }, 273);
  },

  async play(k, byCPU = false) {
    if (this.busy) return;
    const b = this.current();
    const c = b.cells[k];
    if (this.view) return;
    if (c && c.owner && c.record && !byCPU) { this.goTo(c.record); return; }
    if (!c || b.winner || c.owner || c.child) return;
    if (this.vsCPU && b.turn === 'O' && !byCPU) return;
    const gen = this.gen;
    this.busy = true;
    try {
      if (b.level === 0) {
        const p = b.turn;
        this.claim(b, k, p);
        this.vanish(b, p, k);
        await this.afterClaim(b, k);
      } else {
        // Pick a square: zoom into a fresh game one level down to decide it.
        // Depth cap: every square on every level is decided by a single Level 0 game.
        const child = new Board(0, b.turn);
        child.parent = b; child.parentIndex = k; child.alpha = 0;
        child.born = performance.now() + 350;
        b.pending = k;
        c.child = child;
        this.layoutAll();
        Sound.zoomIn();
        Renderer.ripple(b, k, b.turn, 1.2);
        Renderer.kick(0.04);
        this.toast(`<b class="${b.turn}">${b.turn}</b> goes for the ${CELL_NAMES[k]} square. Win this Level ${child.level} game to claim it!`);
        Tweens.add(700, (e) => { child.alpha = e; }, Ease.outCubic);
        await this.step(Renderer.flyTo(viewOf(child), 1200));
      }
    } catch (e) {
      if (gen === this.gen) console.error(e);
    } finally {
      if (gen === this.gen) {
        this.busy = false;
        this.settled();
      }
    }
  },

  async afterClaim(b, ck) {
    for (;;) {
      let res = lineResult(b.cells.map((c) => c.owner));
      // Mystery jackpot: landing a mark on the hidden square spins the slot machine.
      if (ck != null && ck === b.jackpot) {
        const owner = b.cells[ck].owner;
        b.jackpot = -1;
        if (owner === DEAD) {
          this.toast('The mystery jackpot was buried under stone!');
        } else if (owner && (!res || res === 'draw')) {
          const out = await this.jackpotSpin(b, ck, owner);
          res = out.win ? { p: owner, line: null } : lineResult(b.cells.map((c) => c.owner));
          if (!res && out.extra) {
            const [x, y] = Renderer.boardScreenCenter(b);
            Renderer.floatText(x, y - 40, 'GO AGAIN!', owner, 48);
            this.toast(`<b class="${owner}">${owner}</b> goes again!`);
            return;
          }
        }
      }
      ck = null;
      const capped = res === null && b.level === 0 && b.moves >= MOVE_CAP;
      if (res === null && !capped) { b.turn = other(b.turn); return; }
      if (res === 'draw' || capped) {
        if (b.level === 0 && b.parent) { ck = b.parentIndex; b = await this.deadSquare(b); continue; }
        await this.replay(b);
        return;
      }

      b.winner = res.p; b.winLine = res.line; b.winTime = performance.now();
      b.waveT = b.winTime + 150; b.waveAmp = 0.3;
      Sound.win();
      const [sx, sy] = Renderer.boardScreenCenter(b);
      Renderer.burst(sx, sy, res.p, 60 + b.level * 30);
      Renderer.flash(0.35, res.p === 'X' ? '255,60,200' : '0,230,255');
      Renderer.shake(12 + b.level * 4);
      Renderer.kick(0.08);
      (res.line || []).forEach((k, i) => setTimeout(() => {
        const [x, y] = Renderer.cellScreen(b, k);
        Renderer.sparks(x, y, res.p, 26, 9);
        Renderer.ripple(b, k, res.p, 1.3);
        Sound.pop(i);
      }, 120 + i * 110));
      Renderer.floatText(sx, sy - 40, `LEVEL ${b.level} WON!`, res.p, 46);
      this.toast(`<b class="${res.p}">${res.p}</b> wins Level ${b.level}!`);
      this.updateHUD();
      await this.step(wait(1400));

      if (!b.parent) { await this.ascend(b); return; }

      // Zoom back out and drop the winner's mark into the parent square.
      const P = b.parent, k = b.parentIndex;
      Sound.zoomOut();
      Tweens.add(800, (e) => { b.alpha = 1 - e; }, Ease.inOutCubic, 250);
      await this.step(Renderer.flyTo(viewOf(P), 1200));
      P.cells[k].child = null;
      P.cells[k].record = b;
      P.pending = null;
      this.claim(P, k, b.winner);
      this.toast(`<b class="${b.winner}">${b.winner}</b> claims the ${CELL_NAMES[k]} square of Level ${P.level}.`);
      await this.step(wait(800));
      ck = k;
      b = P;
    }
  },

  async ascend(b) {
    // The finished top board shrinks into the center of a brand-new, bigger board.
    const N = new Board(b.level + 1, other(b.winner));
    N.seeded = true;
    while (N.jackpot === 4) N.jackpot = (Math.random() * 9) | 0;
    N.alpha = 0;
    N.born = -1e9;
    N.pending = 4;
    N.cells[4].child = b;
    b.parent = N; b.parentIndex = 4;
    this.root = N;
    this.layoutAll();
    Renderer.setCam(viewOf(b));
    this.updateHUD();
    this.banner(`LEVEL ${N.level}`);
    Sound.ascend();
    Renderer.flash(0.85);
    Renderer.shake(26);
    Renderer.fireworks(b.winner, 5);
    this.best = Math.max(this.best, N.level);
    this.savePrefs();
    Tweens.add(1000, (e) => { N.alpha = e; }, Ease.outCubic, 200);
    Tweens.add(900, (e) => { b.alpha = 1 - e; }, Ease.inOutCubic, 900);
    await this.step(Renderer.flyTo(viewOf(N), 1900));
    N.cells[4].child = null;
    N.cells[4].record = b;
    N.pending = null;
    this.claim(N, 4, b.winner);
    Renderer.kick(0.12);
    N.waveT = performance.now() + 250; N.waveAmp = 0.45;
    this.toast(`Level ${N.level} begins! <b class="${b.winner}">${b.winner}</b> holds the center. <b class="${N.turn}">${N.turn}</b> picks first.`);
    await this.step(wait(700));
  },

  // Level 0: keep only each player's newest marks; the oldest one vanishes.
  vanish(b, p, k) {
    b.moves++;
    b.hist[p].push(k);
    this.dropOldest(b, p);
  },

  dropOldest(b, p) {
    const h = b.hist[p];
    if (h.length <= (b.keep ? b.keep[p] : KEEP_MARKS)) return;
    const old = h.shift();
    const c = b.cells[old];
    c.owner = null; c.t = -1e9;
    const t = performance.now() + 240;
    b.ghosts.push({ k: old, owner: p, t });
    const gen = this.gen;
    setTimeout(() => {
      if (gen !== this.gen || !b.geo) return;
      const [x, y] = Renderer.cellScreen(b, old);
      Renderer.sparks(x, y - 10, p, 30, 5);
      Renderer.floatText(x, y - 30, 'POOF!', p, 24);
      Sound.poof();
    }, 240);
  },

  // ---------- mystery jackpot ----------
  async jackpotSpin(b, k, p) {
    const [x, y] = Renderer.cellScreen(b, k);
    await this.step(wait(300));
    Sound.jackpotFound();
    Renderer.flash(0.45, '255,210,63');
    Renderer.shake(12);
    Renderer.kick(0.06);
    Renderer.coins(x, y, 70);
    Renderer.ripple(b, k, p, 1.6);
    Renderer.floatText(x, y - 30, 'JACKPOT!', null, 54);
    await this.step(wait(900));
    const spin = Slots.spin(p, b.level, this.vsCPU && p === 'O');
    await this.step(spin);
    const prize = await spin;
    return this.applyPrize(b, p, prize);
  },

  async applyPrize(b, p, prize) {
    const opp = other(p);
    const cellsOf = (fn) => b.cells.map((c, i) => (fn(c) ? i : -1)).filter((i) => i >= 0);
    if (prize === 'bust') { this.toast('Bust! Better luck on the next board.'); return {}; }
    if (prize === 'extra') return { extra: true };
    if (prize === 'shield') {
      b.keep[p] = KEEP_MARKS + 1;
      this.toast(`<b class="${p}">${p}</b> can now keep 4 marks in this game.`);
      return {};
    }
    if (prize === 'jackpot' && b.level === 0) return { win: true };
    let cands, verb;
    if (prize === 'jackpot') { cands = cellsOf((c) => !c.owner && !c.child); verb = 'Pick any empty square to claim'; }
    if (prize === 'steal') { cands = cellsOf((c) => c.owner === opp); verb = `Pick an <b class="${opp}">${opp}</b> mark to steal`; }
    if (prize === 'bomb') { cands = cellsOf((c) => c.owner === opp || (b.level > 0 && c.owner === DEAD)); verb = `Pick an <b class="${opp}">${opp}</b> mark${b.level > 0 ? ' or stone' : ''} to blow up`; }
    if (!cands.length) { this.toast('Nothing to target, so it becomes an extra move!'); return { extra: true }; }
    const t = await this.step(this.chooseTarget(b, p, cands, prize, verb));
    const c = b.cells[t];
    const [x, y] = Renderer.cellScreen(b, t);
    if (prize === 'jackpot') {
      this.claim(b, t, p);
    } else if (prize === 'steal') {
      c.owner = p; c.t = performance.now();
      if (b.level === 0) {
        b.hist[opp] = b.hist[opp].filter((i) => i !== t);
        b.hist[p].push(t);
        this.dropOldest(b, p);
      }
      Sound.steal();
      Renderer.sparks(x, y, p, 40, 9);
      Renderer.ripple(b, t, p, 1.4);
      Renderer.floatText(x, y - 30, 'STOLEN!', p, 40);
      Renderer.shake(8);
    } else {
      const was = c.owner;
      if (b.level === 0) {
        b.hist[opp] = b.hist[opp].filter((i) => i !== t);
        b.ghosts.push({ k: t, owner: was, t: performance.now() });
      }
      c.owner = null; c.t = -1e9; c.record = null;
      Sound.boom();
      Renderer.burst(x, y, was === DEAD ? DEAD : was, 70);
      Renderer.flash(0.4, '255,140,40');
      Renderer.shake(20);
      Renderer.kick(0.08);
      Renderer.floatText(x, y - 30, 'BOOM!', null, 56);
    }
    await this.step(wait(700));
    return {};
  },

  chooseTarget(b, p, cands, kind, verb) {
    return new Promise((resolve) => {
      this.selecting = { b, p, cands: new Set(cands), kind, resolve, verb };
      Renderer.select = this.selecting;
      this.toast(`${verb}!`);
      this.updateHUD();
      if (this.vsCPU && p === 'O') setTimeout(() => this.select(AI.pickTarget(b, p, cands, kind)), 1000);
    });
  },

  select(k) {
    const s = this.selecting;
    if (!s || !s.cands.has(k)) return;
    this.selecting = null;
    Renderer.select = null;
    s.resolve(k);
    this.updateHUD();
  },

  // A Level 0 game with no winner: its square on the board above becomes a dead square.
  async deadSquare(b) {
    Sound.draw();
    Renderer.shake(8);
    { const [x, y] = Renderer.boardScreenCenter(b); Renderer.floatText(x, y - 30, 'STALEMATE!', null, 46); }
    const P = b.parent, k = b.parentIndex;
    this.toast(`No winner after ${MOVE_CAP} moves. The ${CELL_NAMES[k]} square of Level ${P.level} turns to stone.`);
    await this.step(wait(1300));
    Sound.zoomOut();
    Tweens.add(800, (e) => { b.alpha = 1 - e; }, Ease.inOutCubic, 250);
    await this.step(Renderer.flyTo(viewOf(P), 1200));
    P.cells[k].child = null;
    P.cells[k].record = b;
    P.pending = null;
    P.cells[k].owner = DEAD;
    P.cells[k].t = performance.now();
    Sound.stone();
    const gen = this.gen;
    setTimeout(() => {
      if (gen !== this.gen || !P.geo) return;
      const [x, y] = Renderer.cellScreen(P, k);
      Renderer.ripple(P, k, DEAD, 1.4);
      Renderer.sparks(x, y, DEAD, 40, 8);
      Renderer.shake(14);
      Renderer.kick(0.05);
      Renderer.floatText(x, y - 20, 'BLOCKED!', null, 34);
    }, 273);
    await this.step(wait(900));
    return P;
  },

  async replay(b) {
    Sound.draw();
    Renderer.shake(8);
    { const [x, y] = Renderer.boardScreenCenter(b); Renderer.floatText(x, y - 30, 'DRAW!', null, 50); }
    const big = b.level >= 1;
    this.toast(big
      ? `Level ${b.level} is a draw! Corners and center stay as a head start, edges and stone squares clear. <b class="${other(b.starter)}">${other(b.starter)}</b> picks first.`
      : `Draw! Replaying Level ${b.level} with <b class="${other(b.starter)}">${other(b.starter)}</b> going first.`);
    await this.step(wait(1500));
    const keep = (k, c) => big ? ([0, 2, 4, 6, 8].includes(k) && c.owner !== DEAD) : (b.seeded && k === 4);
    b.cells.forEach((c, k) => {
      if (keep(k, c)) return;
      c.owner = null; c.t = -1e9; c.child = null; c.record = null;
    });
    b.hist = { X: [], O: [] };
    b.moves = 0;
    b.keep = { X: KEEP_MARKS, O: KEEP_MARKS };
    const empties = b.cells.map((c, k) => (c.owner ? -1 : k)).filter((k) => k >= 0);
    b.jackpot = empties.length ? empties[(Math.random() * empties.length) | 0] : -1;
    b.starter = other(b.starter);
    b.turn = b.starter;
    b.born = performance.now();
    await this.step(wait(600));
  },

  // ---------- level zoom / review ----------
  chainOf(b) { const a = []; for (let x = b; x; x = x.parent) a.unshift(x); return a; },
  isRecord(b) { return !!(b.parent && b.parent.cells[b.parentIndex].record === b); },

  goTo(target) {
    const from = this.focus();
    if (this.busy || !target || target === from) return;
    const chain = this.chainOf(from);
    const idx = chain.indexOf(target);
    if (idx >= 0) {
      // zooming out: remember the way back down
      this.trail = [...this.trail, ...chain.slice(idx + 1).reverse()];
    } else if (this.trail.length && this.trail[this.trail.length - 1] === target) {
      this.trail.pop();
    } else {
      this.trail = [];
    }
    this.fly(target);
  },

  zoomOut() { const f = this.focus(); if (f.parent) this.goTo(f.parent); },
  zoomIn() {
    const f = this.focus();
    const t = this.trail[this.trail.length - 1];
    if (t && t.parent === f) return this.goTo(t);
    if (f.pending != null && f.cells[f.pending].child) this.goTo(f.cells[f.pending].child);
  },
  backToLive() { this.trail = []; this.goTo(this.current()); },

  inspect(k) {
    const c = this.focus().cells[k];
    if (!c) return;
    if (c.child) this.goTo(c.child);
    else if (c.record) this.goTo(c.record);
  },

  async fly(target) {
    clearTimeout(this.cpuTimer);
    const gen = this.gen;
    const from = this.focus();
    const oldRecs = this.chainOf(from).filter((b) => this.isRecord(b));
    const newRecs = this.chainOf(target).filter((b) => this.isRecord(b));
    const leaving = oldRecs.filter((r) => !newRecs.includes(r));
    for (const r of newRecs) {
      if (ReviewSet.has(r)) continue;
      r.alpha = 0;
      ReviewSet.add(r);
      Tweens.add(650, (e) => { r.alpha = e; }, Ease.outCubic);
    }
    for (const r of leaving) Tweens.add(650, (e) => { r.alpha = 1 - e; }, Ease.inOutCubic, 250);
    const goingIn = target.level < from.level;
    this.view = target === this.current() ? null : target;
    this.layoutAll();
    this.busy = true;
    this.updateHUD();
    goingIn ? Sound.zoomIn() : Sound.zoomOut();
    try {
      await this.step(Renderer.flyTo(viewOf(target), 1000));
      leaving.forEach((r) => ReviewSet.delete(r));
    } catch (e) {
      if (gen === this.gen) console.error(e);
    } finally {
      if (gen === this.gen) {
        this.busy = false;
        this.updateHUD();
        this.scheduleCPU();
      }
    }
  },

  settled() {
    this.save();
    this.updateHUD();
    this.scheduleCPU();
  },

  scheduleCPU() {
    clearTimeout(this.cpuTimer);
    if (!this.vsCPU || this.busy || this.view) return;
    const b = this.current();
    if (b.turn !== 'O' || b.winner) return;
    this.cpuTimer = setTimeout(() => {
      if (this.busy || this.view) return;
      const c = this.current();
      if (c !== b || c.turn !== 'O') return;
      this.play(c.level === 0 ? AI.chooseVanish(c, 'O') : AI.choose(c.cells.map((x) => x.owner), 'O'), true);
    }, 750);
  },

  // ---------- storage ----------
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(this.root))); } catch (e) { /* storage unavailable */ }
  },
  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      this.vsCPU = !!p.vsCPU;
      Sound.on = p.sound !== false;
      this.best = p.best || 0;
    } catch (e) { /* defaults */ }
  },
  savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ vsCPU: this.vsCPU, sound: Sound.on, best: this.best })); } catch (e) { /* ignore */ }
  },

  // ---------- HUD ----------
  updateHUD() {
    const root = this.root, cur = this.current();
    this.best = Math.max(this.best, root.level);
    $('topLevel').textContent = root.level;
    $('bestLevel').textContent = `Best: ${this.best}`;
    const focus = this.focus();
    const chain = this.chainOf(focus);
    const replaying = chain.some((b) => this.isRecord(b));
    if (!replaying) {
      // looking at a live ancestor: also show the live path below it
      for (let b = focus; b.pending != null && b.cells[b.pending].child; ) { b = b.cells[b.pending].child; chain.push(b); }
    }
    this.navChain = chain;
    const parts = chain.map((b, i) => {
      const cls = ['crumb', b === focus ? 'here' : '', this.isRecord(b) ? 'replay' : '', b === cur && this.view ? 'live' : ''].join(' ');
      const next = chain[i + 1];
      const where = next ? ` · ${CELL_NAMES[next.parentIndex]}` : '';
      return `<button type="button" class="${cls}" data-i="${i}" style="--h:${levelHue(b.level)}">Level ${b.level}${where}</button>`;
    });
    $('path').innerHTML = parts.join('<span class="sep">▸</span>');
    $('zLevels').innerHTML = chain.slice().map((b, i) => {
      const cls = ['zl', b === focus ? 'here' : '', this.isRecord(b) ? 'replay' : '', b === cur ? 'live' : ''].join(' ');
      return `<button type="button" class="${cls}" data-i="${i}" style="--h:${levelHue(b.level)}" title="Zoom to Level ${b.level}">L${b.level}</button>`;
    }).join('');
    $('zOut').disabled = !focus.parent;
    const t = this.trail[this.trail.length - 1];
    $('zIn').disabled = !((t && t.parent === focus) || (focus.pending != null && focus.cells[focus.pending].child));
    $('zoombar').classList.toggle('reviewing', !!this.view);
    document.body.classList.toggle('reviewing', !!this.view);

    const p = cur.turn;
    const who = this.vsCPU ? (p === 'O' ? 'Computer' : 'You') : '';
    let txt;
    if (this.view && this.isRecord(focus)) {
      const P = focus.parent;
      txt = `Replay: Level ${focus.level} game for the ${CELL_NAMES[focus.parentIndex]} square of Level ${P.level}, won by <b class="${focus.winner}">${focus.winner}</b>`;
    } else if (this.view && replaying) {
      txt = `Replay: Level ${focus.level}, won by <b class="${focus.winner}">${focus.winner}</b>`;
    } else if (this.view) {
      txt = `Viewing Level ${focus.level}. The live game is on Level ${cur.level}.`;
    } else if (cur.winner) txt = `<b class="${cur.winner}">${cur.winner}</b> wins!`;
    else if (cur.level === 0) txt = `<b class="${p}">${p}</b> ${who ? `(${who}) ` : ''}to move`;
    else txt = `<b class="${p}">${p}</b> ${who ? `(${who}) ` : ''}picks a square to fight for`;
    this.updateStakes(cur);
    if (this.selecting) txt = `🎰 ${this.selecting.verb} <span class="hint-dim">(${this.vsCPU && this.selecting.p === 'O' ? 'computer choosing' : 'click a glowing ring'})</span>`;
    const turnEl = $('turn');
    if (turnEl.innerHTML !== txt) {
      turnEl.innerHTML = txt;
      turnEl.classList.remove('pop');
      void turnEl.offsetWidth;
      turnEl.classList.add('pop');
    }
    $('btnCpu').textContent = `vs Computer: ${this.vsCPU ? 'On' : 'Off'}`;
    $('btnCpu').classList.toggle('on', this.vsCPU);
    $('btnSound').textContent = `Sound: ${Sound.on ? 'On' : 'Off'}`;
  },

  // What the current game means for the boards above it.
  stakesFor(P, k) {
    const o = P.cells.map((c) => c.owner);
    const before = threatsOf(o);
    const out = { win: [], parts: [] };
    for (const p of ['X', 'O']) {
      const o2 = o.slice(); o2[k] = p;
      const r = lineResult(o2);
      if (r && r !== 'draw' && r.p === p) { out.win.push(p); out.parts.push(`<b class="${p}">${p}</b> wins Level ${P.level}`); continue; }
      const bits = [];
      if (before[other(p)].has(k)) bits.push(`blocks <b class="${other(p)}">${other(p)}</b>`);
      const after = threatsOf(o2)[p];
      const newThreats = [...after].filter((i) => !before[p].has(i)).length;
      if (newThreats >= 2) bits.push('sets up a double threat');
      else if (newThreats === 1) bits.push(`threatens Level ${P.level}`);
      if (bits.length) out.parts.push(`<b class="${p}">${p}</b> ${bits.join(' and ')}`);
    }
    return out;
  },

  updateStakes(cur) {
    const el = $('stakes');
    let html = '', match = false;
    if (!this.view && !cur.winner) {
      if (cur.level === 0 && !cur.parent) {
        html = `Stakes: the winner takes the center of Level ${cur.level + 1}`;
      } else if (cur.level === 0) {
        const P = cur.parent, k = cur.parentIndex;
        const s = this.stakesFor(P, k);
        match = s.win.length > 0;
        html = (match ? '🔥 MATCH POINT: ' : 'Stakes: ') +
          (s.parts.length ? s.parts.join(' · ') : `whoever wins takes the ${CELL_NAMES[k]} square of Level ${P.level}`);
      } else {
        const t = threatsOf(cur.cells.map((c) => c.owner));
        const desc = (p) => [...t[p]].map((i) => CELL_NAMES[i]).join(', ');
        const bits = ['X', 'O'].filter((p) => t[p].size).map((p) => `<b class="${p}">${p}</b> can win at ${desc(p)}`);
        html = bits.length ? `Glowing squares win the level: ${bits.join(' · ')}` : 'Pick a square. Glowing squares will mark winning spots.';
      }
    }
    if (html && !this.view && cur.jackpot >= 0) html += ' · <span class="jp">🎰 jackpot hidden here</span>';
    if (html && cur.level === 0 && !this.view) {
      const left = MOVE_CAP - cur.moves;
      if (left <= 6) html += ` · <span class="warn">${left} move${left === 1 ? '' : 's'} until stalemate</span>`;
    }
    if (el.innerHTML !== html) {
      el.innerHTML = html;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }
    document.body.classList.toggle('matchpoint', match);
    if (match && this.mpBoard !== cur) {
      this.mpBoard = cur;
      setTimeout(() => {
        if (this.current() !== cur || this.view) return;
        Sound.heartbeat();
        Renderer.floatText(Renderer.W / 2, Renderer.centerY() - 60, 'MATCH POINT!', null, 52);
        Renderer.shake(8);
      }, 1100);
    }
  },

  toast(html) {
    const el = $('toast');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  },

  banner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('play');
    void el.offsetWidth; // restart animation
    el.classList.add('play');
  },

  showHelp(show) { $('help').hidden = !show; },
};

// ---------- wiring ----------
(function main() {
  const canvas = $('scene');
  Renderer.init(canvas);
  MiniMap.init($('minimap'));
  Game.start();

  const pos = (e) => [e.clientX, e.clientY];
  let downCell = -1;
  canvas.addEventListener('pointermove', (e) => {
    const f = Game.focus();
    const k = Renderer.pick(f, ...pos(e));
    const cell = k >= 0 ? f.cells[k] : null;
    const playable = cell && !cell.owner && !cell.child && Renderer.canHover;
    if (k !== Renderer.hover) {
      Renderer.hoverT = performance.now();
      if (playable) Sound.tick(k);
    }
    Renderer.hover = k;
    const inspectable = cell && Renderer.canInspect && (cell.record || (Game.view && cell.child));
    canvas.style.cursor = playable || inspectable ? (inspectable ? 'zoom-in' : 'pointer') : 'default';
    if (Game.selecting && Game.selecting.cands.has(k)) canvas.style.cursor = 'crosshair';
  });
  canvas.addEventListener('pointerleave', () => { Renderer.hover = -1; });
  canvas.addEventListener('pointerdown', (e) => {
    Sound.ensure();
    downCell = Renderer.pick(Game.focus(), ...pos(e));
    Renderer.hover = downCell;
  });
  canvas.addEventListener('pointerup', (e) => {
    const k = Renderer.pick(Game.focus(), ...pos(e));
    if (Game.selecting) { if (k >= 0) Game.select(k); downCell = -1; return; }
    if (k >= 0 && k === downCell) (Game.view ? Game.inspect(k) : Game.play(k));
    downCell = -1;
    if (e.pointerType !== 'mouse') Renderer.hover = -1;
  });

  $('btnNew').addEventListener('click', () => {
    const btn = $('btnNew');
    if (!btn.classList.contains('warn')) {
      btn.classList.add('warn');
      btn.textContent = 'Click again to restart';
      clearTimeout(Game.confirmTimer);
      Game.confirmTimer = setTimeout(() => { btn.classList.remove('warn'); btn.textContent = 'New game'; }, 2500);
      return;
    }
    clearTimeout(Game.confirmTimer);
    btn.classList.remove('warn');
    btn.textContent = 'New game';
    Game.newGame();
  });
  $('btnCpu').addEventListener('click', () => {
    Game.vsCPU = !Game.vsCPU;
    Game.savePrefs();
    Game.updateHUD();
    Game.toast(Game.vsCPU ? 'You are <b class="X">X</b>, the computer plays <b class="O">O</b>.' : 'Hot-seat mode: two players, one screen.');
    Game.scheduleCPU();
  });
  $('btnSound').addEventListener('click', () => {
    Sound.on = !Sound.on;
    Sound.ensure();
    Game.savePrefs();
    Game.updateHUD();
  });
  // level zoom controls
  const jump = (e) => {
    const el = e.target.closest('[data-i]');
    if (!el || !Game.navChain) return;
    Sound.ensure();
    const b = Game.navChain[+el.dataset.i];
    if (b === Game.current()) Game.backToLive(); else Game.goTo(b);
  };
  $('path').addEventListener('click', jump);
  $('zLevels').addEventListener('click', jump);
  $('zOut').addEventListener('click', () => { Sound.ensure(); Game.zoomOut(); });
  $('zIn').addEventListener('click', () => { Sound.ensure(); Game.zoomIn(); });
  $('zLive').addEventListener('click', () => { Sound.ensure(); Game.backToLive(); });
  let wheelLock = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (Game.busy || now < wheelLock || Math.abs(e.deltaY) < 4) return;
    wheelLock = now + 450;
    e.deltaY > 0 ? Game.zoomOut() : Game.zoomIn();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'Escape') { if (!$('help').hidden) Game.showHelp(false); else Game.backToLive(); }
    else if (e.key === '-' || e.key === '_' || e.key === 'PageUp') Game.zoomOut();
    else if (e.key === '+' || e.key === '=' || e.key === 'PageDown') Game.zoomIn();
  });

  $('btnHelp').addEventListener('click', () => Game.showHelp(true));
  $('btnCloseHelp').addEventListener('click', () => { Sound.ensure(); Game.showHelp(false); });
  $('help').addEventListener('click', (e) => { if (e.target.id === 'help') Game.showHelp(false); });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(50, now - last);
    last = now;
    Tweens.update(now);
    Game.layoutAll();
    const cur = Game.current();
    Renderer.canHover = !Game.busy && !Game.view && !(Game.vsCPU && cur.turn === 'O');
    Renderer.canInspect = !Game.busy;
    Renderer.frame(now, dt, Game.root, Game.focus());
    MiniMap.draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
