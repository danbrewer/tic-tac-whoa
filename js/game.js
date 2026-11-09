'use strict';
// Game rules, flow, AI, persistence and HUD.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
// Names as the cells appear on screen in the isometric view (col i runs down-right, row j down-left).
const CELL_NAMES = STRINGS.general.cellNames;   // text lives in js/strings.js
// Player-facing name of a level: the smallest board's games are "Turf Battles".
const lvName = STRINGS.general.levelName;
const other = (p) => (p === 'X' ? 'O' : 'X');
const SAVE_KEY = 'infinite-ttt-save-v1';
const PREFS_KEY = 'infinite-ttt-prefs-v1';
const LOG_KEY = 'infinite-ttt-log-v1';   // Game review: snapshots of the whole game for Instant Replay
const LOG_CAP = 600;
const KEEP_MARKS = 3;   // Level 0: each player keeps only their 3 newest marks
const MOVE_CAP = 18;    // Level 0: no winner after this many marks counts as a draw
const DEAD = '#';       // neutral square that blocks both players
const WILD = 'W';       // Wild square rule: counts for both players
const SHIFT_EVERY = 3;  // Shifting Squares / Ring Spin / Crossfire: the board moves every 3 moves
const RING = [0, 1, 2, 5, 8, 7, 6, 3];   // outer squares in clockwise order on screen (top, upper-right, right, ...)
const CROSS = [[0, 8], [2, 6]];          // Crossfire: the corners at either end of each diagonal trade places
const MOVERS = STRINGS.pop.movers;  // rules whose board moves every SHIFT_EVERY moves, and the word that pops up

// Level 0 rule variants. Before each Level 0 game the last winner spins the wheel (or a RULE PICK prize chooses).
// Names and descriptions (name, wheel, short, help) come from STRINGS.rules in js/strings.js.
const RULES = {
  classic: { icon: '⭕', ...STRINGS.rules.classic },
  vanish:  { icon: '👻', ...STRINGS.rules.vanish },
  gravity: { icon: '⬇️', ...STRINGS.rules.gravity },
  shift:   { icon: '🔀', ...STRINGS.rules.shift },
  wild:    { icon: WILD_ICON, iconText: '✕◯', ...STRINGS.rules.wild },
  misere:  { icon: '🙃', ...STRINGS.rules.misere },
  fog:     { icon: FOG_ICON, iconText: '🌫️', ...STRINGS.rules.fog },
  ring:    { icon: '🔄', ...STRINGS.rules.ring },
  cross:   { icon: CROSS_ICON, iconText: '❌', ...STRINGS.rules.cross },
};
const RULE_KEYS = Object.keys(RULES);

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
    this.keep = level === 0 ? { X: 99, O: 99 } : { X: KEEP_MARKS, O: KEEP_MARKS };
    this.rule = 'classic';
    this.ruled = false;            // rule chosen by the wheel / RULE PICK yet?
    this.shift = null;             // Shifting board: the next slide { axis: 'row'|'col', idx, dir }
    this.fogAt = Array(9).fill(null);  // Fog of War: the move count when each mark was placed
  }
}

// Cells of a row (j fixed, runs down-right on screen) or column (i fixed, runs down-left), in order.
function lineCells(axis, idx) { return axis === 'row' ? [idx * 3, idx * 3 + 1, idx * 3 + 2] : [idx, idx + 3, idx + 6]; }
function randomShift() { return { axis: Math.random() < 0.5 ? 'row' : 'col', idx: (Math.random() * 3) | 0, dir: Math.random() < 0.5 ? 1 : -1 }; }
// Slide one line of owners one space (wrapping). Returns [{from, to}] for animation.
function applyShift(o, sh) {
  const cells = lineCells(sh.axis, sh.idx), vals = cells.map((k) => o[k]), moves = [];
  cells.forEach((k, n) => {
    const m = (n + sh.dir + 3) % 3;
    o[cells[m]] = vals[n];
    if (vals[n]) moves.push({ from: k, to: cells[m], wrap: Math.abs(m - n) === 2 });
  });
  return moves;
}
// Fog of War: is square k's mark hidden under fog right now? (it fogs once the next move has landed)
function fogged(b, k) {
  const c = b.cells[k], at = b.fogAt ? b.fogAt[k] : null;
  return b.rule === 'fog' && !b.winner && !b.fogLift && at != null && b.moves - at >= 1 && (c.owner === 'X' || c.owner === 'O');
}
// Ring Spin: every outer mark steps to the next outer square clockwise.
function applyRing(o) {
  const vals = RING.map((k) => o[k]), moves = [];
  RING.forEach((k, n) => {
    const to = RING[(n + 1) % 8];
    o[to] = vals[n];
    if (vals[n]) moves.push({ from: k, to });
  });
  return moves;
}
// Crossfire: the marks at the two ends of each diagonal slide through the center and trade places.
function applyCross(o) {
  const moves = [];
  for (const [a, b] of CROSS) {
    const va = o[a], vb = o[b];
    o[a] = vb; o[b] = va;
    if (va) moves.push({ from: a, to: b });
    if (vb) moves.push({ from: b, to: a });
  }
  return moves;
}
// Gravity: marks fall toward the front-left edge along their column (i fixed, j grows).
function landingCell(b, k) {
  if (k < 0 || !b || b.level !== 0) return k;
  if (b.rule !== 'gravity') return b.cells[k] && !b.cells[k].owner && !b.cells[k].child ? k : -1;
  const i = k % 3;
  for (let j = 2; j >= 0; j--) if (!b.cells[j * 3 + i].owner) return j * 3 + i;
  return -1;
}

// Gravity: drop every mark straight down its column until nothing hangs over an empty square
// (changes the owners array o in place and returns it; Game.settleGravity does the same on the board, animated)
function fallen(o) {
  for (let i = 0; i < 3; i++) {
    const col = [6 + i, 3 + i, i], marks = col.map((k) => o[k]).filter((v) => v);
    col.forEach((k, n) => { o[k] = marks[n] || null; });
  }
  return o;
}

// Lines of three (the wild square counts for either player). If several, the mover's line counts.
// Misère flips the result: the player who made the line loses.
function judge(owners, rule, mover) {
  const wins = [];
  for (const line of LINES) {
    let p = null, ok = true;
    for (const i of line) {
      const v = owners[i];
      if (!v || v === DEAD) { ok = false; break; }
      if (v === WILD) continue;
      if (p && v !== p) { ok = false; break; }
      p = v;
    }
    if (ok && p) wins.push({ p, line });
  }
  if (wins.length) {
    const w = wins.find((x) => x.p === mover) || wins[0];
    return rule === 'misere' ? { p: other(w.p), line: w.line, loser: w.p } : w;
  }
  return owners.every((o) => o) ? 'draw' : null;
}
function lineResult(owners) { return judge(owners, 'normal', null); }
// Squares that would complete a line for each player, counting the wild square.
function threatsW(o) {
  const t = { X: 0, O: 0 };
  for (const line of LINES) {
    const v = line.map((i) => o[i]);
    if (v.includes(DEAD) || v.filter((x) => !x).length !== 1) continue;
    const marks = v.filter((x) => x === 'X' || x === 'O');
    if (marks.length && marks.every((m) => m === marks[0])) t[marks[0]]++;
  }
  return t;
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
  // Level 0 under any rule except vanishing: alpha-beta over the rule's own moves.
  // Shifts beyond the next known one and wild-square moves are not predicted.
  ruleMoves(st) {
    if (st.rule === 'gravity') return [0, 1, 2].map((i) => { for (let j = 2; j >= 0; j--) if (!st.o[j * 3 + i]) return j * 3 + i; return -1; }).filter((k) => k >= 0);
    return st.o.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  },
  ruleApply(st, p, k) {
    const o = st.o.slice();
    o[k] = p;
    const moves = st.moves + 1;
    let shift = st.shift;
    if (st.rule === 'shift' && shift && moves % SHIFT_EVERY === 0) { applyShift(o, shift); shift = null; }
    if (st.rule === 'ring' && moves % SHIFT_EVERY === 0) applyRing(o);
    if (st.rule === 'cross' && moves % SHIFT_EVERY === 0) applyCross(o);
    return { o, rule: st.rule, moves, shift };
  },
  ruleSearch(st, p, depth, alpha, beta, ply) {
    const mv = this.ruleMoves(st);
    if (!mv.length) return 0;
    let best = -Infinity;
    for (const k of mv) {
      const s2 = this.ruleApply(st, p, k);
      const r = judge(s2.o, s2.rule, p);
      let v;
      if (r === 'draw') v = 0;
      else if (r) v = r.p === p ? 100 - ply : ply - 100;
      else if (depth <= 1) { const t = threatsW(s2.o); v = st.rule === 'misere' ? (t[other(p)] - t[p]) : (t[p] * 3 - t[other(p)] * 4); }
      else v = -this.ruleSearch(s2, other(p), depth - 1, -beta, -alpha, ply + 1);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  },
  chooseRuleMove(board, me) {
    // Fog of War: the computer only sees what a player sees. A fogged square is taken, but whose mark
    // is under it is forgotten, so it plans as if that square blocks both players.
    const seen = (c, k) => (board.rule === 'fog' && fogged(board, k) ? DEAD : c.owner);
    const st = { o: board.cells.map(seen), rule: board.rule, moves: board.moves, shift: board.shift };
    const mv = this.ruleMoves(st);
    if (Math.random() < 0.12) return mv[(Math.random() * mv.length) | 0];
    let best = -Infinity, picks = [];
    for (const k of mv) {
      const s2 = this.ruleApply(st, me, k);
      const r = judge(s2.o, s2.rule, me);
      const v = r === 'draw' ? 0 : r ? (r.p === me ? 1000 : -1000) : -this.ruleSearch(s2, other(me), 6, -Infinity, Infinity, 1);
      if (v > best) { best = v; picks = [k]; } else if (v === best) picks.push(k);
    }
    return picks[(Math.random() * picks.length) | 0];
  },
  chooseL0(board, me) { return board.rule === 'vanish' ? this.chooseVanish(board, me) : this.chooseRuleMove(board, me); },
  // RULE PICK: the computer favors lively rules, and avoids repeating the current one.
  chooseRule(cur) {
    const w = { gravity: 3, wild: 3, shift: 2.5, ring: 2.5, cross: 2.5, fog: 2.5, misere: 1.5, vanish: 1, classic: 0.5 };
    if (cur) w[cur] *= 0.3;
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k;
    return 'gravity';
  },

  // Best target for a slot prize: steal/bomb an opponent mark, or claim an empty square.
  pickTarget(b, me, cands, kind) {
    const o = b.cells.map((c) => c.owner);
    let best = -Infinity, pick = cands[0];
    for (const k of cands) {
      const o2 = o.slice();
      o2[k] = kind === 'bomb' ? null : me;
      if (b.level === 0 && b.rule === 'gravity') fallen(o2);   // marks above a gap drop into it
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
    l: b.level, s: b.starter, t: b.turn, p: b.pending, sd: b.seeded, w: b.winner, wl: b.winLine, h: b.hist, mv: b.moves, jp: b.jackpot, kp: b.keep, r: b.rule, sh: b.shift, ru: b.ruled, fg: b.rule === 'fog' ? b.fogAt : undefined,
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
  b.rule = d.r || 'vanish';
  if (d.sh) b.shift = d.sh;
  if (d.fg) b.fogAt = d.fg;
  b.ruled = d.ru !== undefined ? d.ru : true;
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
  nextRule: null,   // rule won with RULE PICK for the next Level 0 game
  nextRuleBy: null,
  lastWinner: null, // winner of the latest Level 0 game: spins the rule wheel
  dev: { on: false, force: '', tease: false, everywhere: false, reveal: false, wheel: '', nearMiss: false },  // Developer Mode
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
      if (raw) {
        const d = JSON.parse(raw);
        this.root = deserialize(d); restored = true;
        this.nextRule = d.nr || null; this.nextRuleBy = d.nb || null; this.lastWinner = d.lw || null;
      }
    } catch (e) { this.root = null; }
    if (!this.root) this.root = new Board(0, 'X');
    if (restored) this.loadLog();
    this.layoutAll();
    Renderer.setCam(viewOf(this.current()));
    this.updateHUD();
    if (!restored) { this.showHelp(true); this.ruleCardOnHelpClose = true; }
    else this.toast(STRINGS.msg.welcomeBack(lvName(this.current().level, true)));
    if (restored && !this.current().ruled) this.beginL0(this.current());
    this.scheduleCPU();
  },

  // Run the rule wheel for a Level 0 game outside of another sequence (new game, reload).
  async beginL0(b) {
    if (b.ruled || this.busy) return;
    const gen = this.gen;
    this.busy = true;
    try { await this.startRule(b); } catch (e) { if (gen === this.gen) console.error(e); } finally {
      if (gen === this.gen) { this.busy = false; this.settled(); }
    }
  },

  // Decide a Level 0 game's rule: a RULE PICK prize if one is waiting, otherwise the last winner spins the wheel.
  async startRule(b) {
    let rule, how;
    if (this.nextRule) {
      const by = this.nextRuleBy;
      rule = this.takeNextRule();
      how = by ? STRINGS.ruleCard.pickedBy(by) : STRINGS.ruleCard.rulePick;
    } else {
      const spinner = this.lastWinner || 'X';
      this.updateHUD();
      rule = await this.step(Wheel.spin(spinner, this.vsCPU && spinner === 'O', b.parent ? STRINGS.wheel.forSpace(CELL_NAMES[b.parentIndex], b.parent.level) : ''));
      how = STRINGS.ruleCard.spunBy(spinner);
    }
    this.initRule(b, rule);
    b.ruled = true;
    b.born = performance.now();
    this.updateHUD();
    this.showRuleCard(b, how);
    this.save();
    await this.step(wait(b.wildIntro ? Math.max(TIMING.ruleCard.afterCard, b.wildIntro.end - performance.now()) : TIMING.ruleCard.afterCard));
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
    if (this.replay) { clearTimeout(this.replay.timer); this.replay = null; document.body.classList.remove('instant-replay'); $('replaybar').hidden = true; }
    this.log = []; this.games = [];
    try { localStorage.removeItem(LOG_KEY); } catch (e) { /* ignore */ }
    this.root = new Board(0, 'X');
    this.nextRule = null; this.nextRuleBy = null; this.lastWinner = null;
    Sound.stopMusic();
    { const w = $('wheel'); w.hidden = true; w.classList.remove('show'); const r = $('rulepick'); r.hidden = true; r.classList.remove('show'); }
    this.layoutAll();
    Renderer.setCam(viewOf(this.root));
    Renderer.particles = [];
    this.save();
    this.updateHUD();
    this.toast(STRINGS.msg.newGame);
    if ($('help').hidden) this.beginL0(this.root); else this.ruleCardOnHelpClose = true;
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
        Renderer.floatText(x, y - 20, STRINGS.pop.claimed, p, 30 + b.level * 6);
        b.waveT = performance.now(); b.waveAmp = 0.12;
      }
    }, TIMING.board.markImpact);
  },

  async play(k, byCPU = false) {
    if (this.busy) return;
    const b = this.current();
    if (this.view) return;
    if (b.level === 0 && !b.ruled) return;
    if (b.level === 0 && !b.winner) { k = landingCell(b, k); if (k < 0) return; }
    const c = b.cells[k];
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
        child.rule = 'classic';
        child.parent = b; child.parentIndex = k; child.alpha = 0;
        child.born = performance.now() + 350;
        b.pending = k;
        c.child = child;
        this.layoutAll();
        Sound.zoomIn();
        Renderer.ripple(b, k, b.turn, 1.2);
        Renderer.kick(0.04);
        this.toast(STRINGS.msg.goesFor(b.turn, CELL_NAMES[k], STRINGS.msg.childGame(child.level)));
        Tweens.add(TIMING.camera.childFadeIn, (e) => { child.alpha = e; }, Ease.outCubic);
        await this.step(Renderer.flyTo(viewOf(child), TIMING.camera.zoomIntoChild));
        await this.startRule(child);
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

  judgeBoard(b) {
    const o = b.cells.map((c) => c.owner);
    return b.level === 0 ? judge(o, b.rule, b.turn) : lineResult(o);
  },

  async afterClaim(b, ck, dev = null) {
    let first = b.level === 0 && !dev;
    for (;;) {
      let res = this.judgeBoard(b);
      let extra = false, jpOwner = null;
      // Level 0 rule effects after each move (gravity settles, the board shifts, the wild square moves).
      // They run first so a move that ends up winning never opens the slot machine.
      const mover = b.turn;
      if (first && (!res || res === 'draw')) {
        await this.postMove(b);
        res = this.judgeBoard(b);
      }
      first = false;
      // Developer Mode: "jackpot under every square"
      if (this.dev.on && this.dev.everywhere && ck != null && b.cells[ck].owner && b.cells[ck].owner !== DEAD) b.jackpot = ck;
      const devNow = !!dev;
      if (dev) {
        // a spin triggered from the Developer Mode panel (not a move)
        if (dev.out.win) res = { p: dev.p, line: null };
        extra = !!dev.out.extra; jpOwner = dev.p;
        dev = null;
      } else if (ck != null && ck === b.jackpot) {
        // Mystery jackpot: landing a mark on the hidden square spins the slot machine,
        // but only when the move hasn't already won the game.
        const owner = b.level === 0 ? mover : b.cells[ck].owner;
        b.jackpot = -1;
        if (b.cells[ck].owner === DEAD) {
          this.toast(STRINGS.msg.jackpotUnderStone);
        } else if (owner && (!res || res === 'draw')) {
          const out = await this.jackpotSpin(b, ck, owner);
          res = out.win ? { p: owner, line: null } : this.judgeBoard(b);
          extra = !!out.extra; jpOwner = owner;
        }
      }
      if (!res && extra) {
        const owner = jpOwner;
        b.turn = owner;
        const [x, y] = Renderer.boardScreenCenter(b);
        Renderer.floatText(x, y - 40, STRINGS.pop.goAgain, owner, 48);
        this.toast(STRINGS.msg.goesAgain(owner));
        return;
      }
      if (devNow && !res) return;
      ck = null;
      const capped = res === null && b.level === 0 && b.moves >= MOVE_CAP;
      if (res !== null || capped) await this.liftFog(b);
      if (res === null && !capped) { b.turn = other(b.turn); return; }
      if (res === 'draw' || capped) {
        if (b.level === 0 && b.parent) { ck = b.parentIndex; b = await this.deadSquare(b); continue; }
        await this.replay(b);
        return;
      }

      b.winner = res.p; b.winLine = res.line; b.winTime = performance.now();
      if (b.level === 0) this.lastWinner = res.p;
      if (res.loser) {
        const [mx, my] = Renderer.boardScreenCenter(b);
        Renderer.floatText(mx, my - 90, STRINGS.pop.misereLoses(res.loser), res.loser, 34);
      }
      b.waveT = b.winTime + 150; b.waveAmp = 0.3;
      Sound.win();
      Sound.winVoice(res.p, b.level);   // "X takes the square!" / "X wins the round!"
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
      }, TIMING.camera.winLineFirst + i * TIMING.camera.winLineGap));
      Renderer.floatText(sx, sy - 40, STRINGS.pop.won(b.level), res.p, 46);
      this.toast(STRINGS.msg.wins(res.p, lvName(b.level, true)));
      this.updateHUD();
      await this.step(wait(TIMING.camera.winPause));

      if (!b.parent) { await this.ascend(b); return; }

      // Zoom back out and drop the winner's mark into the parent square.
      const P = b.parent, k = b.parentIndex;
      Sound.zoomOut();
      Tweens.add(TIMING.camera.wonFade, (e) => { b.alpha = 1 - e; }, Ease.inOutCubic, TIMING.camera.wonFadeDelay);
      await this.step(Renderer.flyTo(viewOf(P), TIMING.camera.zoomOutToParent));
      P.cells[k].child = null;
      P.cells[k].record = b;
      P.pending = null;
      this.claim(P, k, b.winner);
      this.toast(STRINGS.msg.claims(b.winner, CELL_NAMES[k], P.level));
      await this.step(wait(TIMING.camera.afterClaim));
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
    this.banner(STRINGS.pop.levelBanner(N.level));
    Sound.ascend();
    Renderer.flash(0.85);
    Renderer.shake(26);
    Renderer.fireworks(b.winner, 5);
    this.best = Math.max(this.best, N.level);
    this.savePrefs();
    const TC = TIMING.camera;
    Tweens.add(TC.ascendNewFadeIn, (e) => { N.alpha = e; }, Ease.outCubic, TC.ascendNewFadeDelay);
    Tweens.add(TC.ascendOldFade, (e) => { b.alpha = 1 - e; }, Ease.inOutCubic, TC.ascendOldFadeDelay);
    await this.step(Renderer.flyTo(viewOf(N), TC.ascendZoom));
    N.cells[4].child = null;
    N.cells[4].record = b;
    N.pending = null;
    this.claim(N, 4, b.winner);
    Renderer.kick(0.12);
    N.waveT = performance.now() + TC.ascendWaveDelay; N.waveAmp = 0.45;
    this.toast(STRINGS.msg.levelBegins(N.level, b.winner, N.turn));
    await this.step(wait(TC.ascendSettle));
  },

  // ---------- Level 0 rules ----------
  initRule(b, rule) {
    b.rule = RULES[rule] ? rule : 'vanish';
    const k = b.rule === 'vanish' ? KEEP_MARKS : 99;
    b.keep = { X: k, O: k };
    b.shift = b.rule === 'shift' ? randomShift() : null;
    b.shiftedAt = 0;
    b.fogAt = Array(9).fill(null); b.fogLift = 0;
    b.cells.forEach((c) => { if (c.owner === WILD) { c.owner = null; } });
    if (b.rule === 'wild') {
      const empt = b.cells.map((c, i) => (!c.owner && i !== b.jackpot ? i : -1)).filter((i) => i >= 0);
      const w = empt[(Math.random() * empt.length) | 0];
      b.cells[w].owner = WILD;
      b.wildIntro = this.wildRoulette(b, w);
      b.cells[w].t = b.wildIntro.drop;
    }
  },
  // Wild Square intro: the squares light up in a quick random run that slows down and ends on the
  // wild square, then the mark drops onto it (render.js puffs dust when it hits).
  wildRoulette(b, w) {
    const TB = TIMING.board, t0 = performance.now() + TB.wildIntroStart;   // starts once the rule card has flown up out of the way
    const seq = [];
    let prev = -1;
    const N = TB.wildIntroSteps;
    for (let n = 0; n < N; n++) {
      let k; do { k = (Math.random() * 9) | 0; } while (k === prev || (n === N - 1 && k === w) || k === w && n > N - 5);
      seq.push(k); prev = k;
    }
    seq.push(w);
    const steps = [];
    let t = t0;
    seq.forEach((k, n) => { steps.push({ k, t }); const q = n / (seq.length - 1); t += TB.wildStepMin + TB.wildStepGrow * q * q * q; });
    const last = steps[steps.length - 1].t;
    const gen = this.gen;
    steps.forEach(({ t: st }, n) => setTimeout(() => {
      if (gen !== this.gen) return;
      if (n === steps.length - 1) Sound.wild(); else Sound.reelTick();
    }, st - performance.now()));
    return { steps, drop: last + TB.wildDropDelay, end: last + TB.wildDropDelay + TB.markDrop };
  },
  takeNextRule() {
    const r = this.nextRule || 'vanish';
    this.nextRule = null; this.nextRuleBy = null;
    return r;
  },

  // Title card for a rule. With `next` it announces the rule picked for the NEXT Level 0 game.
  showRuleCard(b, how, next) {
    const rule = next || b.rule || 'vanish', R = RULES[rule];
    const el = $('rulecard'), pin = $('rulepin');
    const slot = next ? 'next' : 'main';
    clearTimeout(this.ruleCardTimer); clearTimeout(this.ruleFlyTimer);
    if (this.ruleFly) { this.ruleFly.cancel(); this.ruleFly = null; }
    el.className = 'rulecard';
    el.innerHTML = `<div class="rc-inner rule-${rule}">${how ? `<div class="rc-tag">${how}</div>` : ''}<div class="rc-icon">${R.icon}</div><div class="rc-kicker">${next ? STRINGS.ruleCard.kickerNext : STRINGS.ruleCard.kicker}</div><div class="rc-name">${R.name}</div><div class="rc-line">${R.short}</div></div>`;
    // the pinned plate at the top is filled in now but its slot stays hidden until the card lands on it
    this.pinState = { waiting: slot, arrive: null };
    this.updateRulePin(this.current ? this.current() : b);
    void el.offsetWidth;
    el.classList.add('play');
    IconFly.land(el.querySelector('.rc-icon'));
    Sound.ruleCard(rule !== 'vanish');
    Sound.ruleVoice(rule);   // booming hall announcement for rules that have one
    const settle = () => {
      this.ruleFly = null;
      el.classList.remove('play');
      this.pinState = { waiting: null, arrive: slot };
      $('rulepin').innerHTML = '';
      this.updateRulePin(this.current ? this.current() : b);
    };
    // after a moment the card shrinks and flies up into the plate at the top of the screen
    this.ruleFlyTimer = setTimeout(() => {
      const inner = el.querySelector('.rc-inner');
      const target = pin.querySelector(`[data-slot="${slot}"]`);
      if (!inner || !target || !inner.animate) { settle(); return; }
      const a = inner.getBoundingClientRect(), t = target.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (a.left + a.width / 2), dy = t.top + t.height / 2 - (a.top + a.height / 2);
      const sc = Math.min(t.width / a.width, t.height / a.height) * 1.1;
      inner.style.animation = 'none';
      Sound.cardFlip(0);
      this.ruleFly = inner.animate([
        { transform: 'none', opacity: 1, offset: 0 },
        { transform: 'translateY(16px) scale(1.04)', opacity: 1, offset: 0.18 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 0.85, offset: 1 },
      ], { duration: TIMING.ruleCard.fly, easing: 'cubic-bezier(.55,0,.6,1)', fill: 'forwards' });
      this.ruleFly.onfinish = () => { settle(); Sound.cardPick(); };
    }, TIMING.ruleCard.hold);
    // failsafe: never leave the card stuck on screen
    this.ruleCardTimer = setTimeout(() => { if (this.pinState && this.pinState.waiting) settle(); else el.classList.remove('play'); }, TIMING.ruleCard.failsafe);
  },

  // The rule plate pinned at the top of the screen for the whole Level 0 game,
  // plus a "next game" plate when a RULE PICK has chosen the next rule.
  updateRulePin(cur) {
    const pin = $('rulepin');
    const st = this.pinState || {};
    const cls = (slot) => (st.waiting === slot ? ' waiting' : '') + (st.arrive === slot ? ' arrive' : '');
    let h = '';
    const main = cur && cur.level === 0 && cur.ruled && !cur.winner;
    if (main) {
      const R = RULES[cur.rule] || RULES.vanish;
      h += `<div class="rpn rule-${cur.rule}${cls('main')}" data-slot="main"><span class="rpn-icon">${R.icon}</span><span class="rpn-text"><span class="rpn-name">${R.name}</span><span class="rpn-line">${R.short}</span></span></div>`;
    }
    if (this.nextRule) {
      const N = RULES[this.nextRule], by = this.nextRuleBy;
      h += main
        ? `<div class="rpn rpn-mini rule-${this.nextRule}${cls('next')}" data-slot="next" title="${N.short}"><span class="rpn-kick">${STRINGS.hud.pinNext}</span><span class="rpn-icon">${N.icon}</span><span class="rpn-name">${N.name}</span></div>`
        : `<div class="rpn rule-${this.nextRule}${cls('next')}" data-slot="next"><span class="rpn-icon">${N.icon}</span><span class="rpn-text"><span class="rpn-kick">${STRINGS.hud.pinNextTurf}${by ? ` · ${STRINGS.hud.pickedBy(by)}` : ''}</span><span class="rpn-name">${N.name}</span><span class="rpn-line">${N.short}</span></span></div>`;
    }
    if (pin.innerHTML !== h) pin.innerHTML = h;
    document.body.classList.toggle('pin-next', !!(main && this.nextRule));
  },

  async postMove(b) {
    const gen = this.gen, T = TIMING.board;
    if (b.rule === 'gravity' && this.settleGravity(b)) await this.step(wait(T.gravitySettle));
    if (b.rule === 'shift' && b.shift && b.moves > 0 && b.moves % SHIFT_EVERY === 0 && b.shiftedAt !== b.moves) {
      b.shiftedAt = b.moves;
      await this.step(wait(T.shiftBefore));
      this.doShift(b);
      await this.step(wait(T.shiftAfter));
    }
    if ((b.rule === 'ring' || b.rule === 'cross') && b.moves > 0 && b.moves % SHIFT_EVERY === 0 && b.shiftedAt !== b.moves) {
      b.shiftedAt = b.moves;
      await this.step(wait(T.turnBefore));
      this.doTurn(b);
      await this.step(wait(b.rule === 'cross' ? T.crossAfter : T.ringAfter));
    }
    if (b.rule === 'fog' && b.moves > 1) {
      // the previous mark disappears into the fog once this move lands
      const k = b.fogAt.findIndex((m) => m === b.moves - 1);
      if (k >= 0 && b.cells[k].owner) { Sound.fog(); await this.step(wait(T.fogPause)); }
    }
    if (b.rule === 'wild') {
      await this.step(wait(T.wildBefore));
      this.moveWild(b);
      await this.step(wait(T.wildAfter));
    }
    if (gen !== this.gen) throw new Error('cancelled');
  },

  slideCell(b, to, from, wrapDir) {
    const c = b.cells[to];
    const fi = from % 3, fj = (from / 3) | 0, ti = to % 3, tj = (to / 3) | 0;
    c.t = -1e9;
    c.slide = wrapDir ? { dx: -wrapDir[0], dy: -wrapDir[1], t: performance.now() } : { dx: fi - ti, dy: fj - tj, t: performance.now() };
  },

  doShift(b) {
    const sh = b.shift;
    const o = b.cells.map((c) => c.owner);
    const moves = applyShift(o, sh);
    const d = sh.axis === 'row' ? [sh.dir, 0] : [0, sh.dir];
    const now = performance.now();
    const before = b.cells.map((c) => c.owner);
    b.cells.forEach((c, k) => { c.owner = o[k]; });
    for (const m of moves) {
      this.slideCell(b, m.to, m.from, m.wrap ? d : null);
      if (m.wrap) b.ghosts.push({ k: m.from, owner: before[m.from], t: now, dx: d[0], dy: d[1] });
    }
    // keep the history in step with where the marks went
    for (const p of ['X', 'O']) b.hist[p] = b.hist[p].map((k) => { const m = moves.find((x) => x.from === k); return m ? m.to : k; });
    Sound.shift();
    Renderer.shake(9);
    Renderer.kick(0.03);
    lineCells(sh.axis, sh.idx).forEach((k) => Renderer.ripple(b, k, 'W', 0.9));
    const [x, y] = Renderer.boardScreenCenter(b);
    Renderer.floatText(x, y - 60, STRINGS.pop.shift, null, 50);
    b.shift = randomShift();
  },

  // Fog of War is over (a win or a stalemate): the fog evaporates so everyone can see the marks.
  async liftFog(b) {
    if (b.level !== 0 || b.rule !== 'fog' || b.fogLift) return;
    const cells = b.cells.map((c, k) => (fogged(b, k) ? k : -1)).filter((k) => k >= 0);
    if (!cells.length) return;
    b.fogLift = performance.now();
    Renderer.fogEvaporate(b, cells);
    Sound.fogLift();
    const [x, y] = Renderer.boardScreenCenter(b);
    Renderer.floatText(x, y - 70, STRINGS.pop.fogLifts, null, 40);
    await this.step(wait(TIMING.board.fogLiftPause));
  },

  // Ring Spin / Crossfire: move the marks and animate them sliding (Crossfire's corners hop over the center)
  doTurn(b) {
    const o = b.cells.map((c) => c.owner);
    const moves = b.rule === 'ring' ? applyRing(o) : applyCross(o);
    const fog = b.fogAt.slice();
    b.cells.forEach((c, k) => { c.owner = o[k]; });
    for (const m of moves) {
      this.slideCell(b, m.to, m.from);
      if (b.rule === 'cross') { b.cells[m.to].slide.hop = 1.3; b.cells[m.to].slide.dur = TIMING.board.crossHop; }
      b.fogAt[m.to] = fog[m.from];
    }
    for (const p of ['X', 'O']) b.hist[p] = b.hist[p].map((k) => { const m = moves.find((x) => x.from === k); return m ? m.to : k; });
    Sound.shift();
    Renderer.shake(b.rule === 'cross' ? 7 : 9);
    Renderer.kick(0.03);
    (b.rule === 'ring' ? RING : [0, 2, 6, 8]).forEach((k) => Renderer.ripple(b, k, 'W', 0.9));
    const [x, y] = Renderer.boardScreenCenter(b);
    Renderer.floatText(x, y - 60, MOVERS[b.rule], null, 50);
  },

  settleGravity(b) {
    let moved = false;
    for (let i = 0; i < 3; i++) {
      const col = [2, 1, 0].map((j) => j * 3 + i);
      const marks = col.filter((k) => b.cells[k].owner).map((k) => ({ k, o: b.cells[k].owner }));
      col.forEach((k) => { b.cells[k].owner = null; });
      marks.forEach((m, n) => {
        const to = col[n];
        b.cells[to].owner = m.o;
        if (to !== m.k) { moved = true; this.slideCell(b, to, m.k); for (const p of ['X', 'O']) b.hist[p] = b.hist[p].map((h) => (h === m.k ? to : h)); }
      });
    }
    if (moved) { Sound.poof(); Renderer.shake(4); }
    return moved;
  },

  moveWild(b) {
    const cur = b.cells.findIndex((c) => c.owner === WILD);
    const o = b.cells.map((c) => c.owner);
    if (cur >= 0) o[cur] = null;
    const safe = (k) => { const o2 = o.slice(); o2[k] = WILD; const r = judge(o2, 'normal', null); return !r || r === 'draw'; };
    let cands = o.map((v, k) => (!v && k !== cur && safe(k) ? k : -1)).filter((k) => k >= 0);
    if (cands.length > 1) cands = cands.filter((k) => k !== b.jackpot);
    if (!cands.length) return;
    const to = cands[(Math.random() * cands.length) | 0];
    if (cur >= 0) { b.cells[cur].owner = null; b.ghosts.push({ k: cur, owner: WILD, t: performance.now() }); }
    b.cells[to].owner = WILD; b.cells[to].t = performance.now();
    Sound.wild();
    const gen = this.gen;
    setTimeout(() => {
      if (gen !== this.gen || !b.geo) return;
      const [x, y] = Renderer.cellScreen(b, to);
      Renderer.sparks(x, y, WILD, 26, 6);
      Renderer.ripple(b, to, WILD, 1.1);
    }, TIMING.board.markImpact);
  },

  // ---------- Developer Mode ----------
  async devSpin() {
    const b = this.current();
    if (this.busy || this.view || this.selecting) { this.toast(STRINGS.dev.wait); return; }
    if (b.winner || (b.level === 0 && !b.ruled)) { this.toast(STRINGS.dev.noLiveGame); return; }
    const p = b.turn, gen = this.gen;
    const k = b.cells.findIndex((c) => !c.owner && !c.child);
    this.busy = true;
    try {
      const out = await this.jackpotSpin(b, k >= 0 ? k : 4, p);
      await this.afterClaim(b, null, { p, out });
    } catch (e) {
      if (gen === this.gen) console.error(e);
    } finally {
      if (gen === this.gen) { this.busy = false; this.settled(); }
    }
  },

  // Developer Mode: spin the Wheel of Games on demand. On a live Level 0 game it restarts that game
  // with whatever the wheel lands on (the "Wheel result" setting forces it); elsewhere it's a preview.
  async devWheel() {
    const b = this.current();
    if (this.busy || this.view || this.selecting) { this.toast(STRINGS.dev.wait); return; }
    const gen = this.gen;
    this.busy = true;
    try {
      if (b.level === 0 && !b.winner) {
        const stash = [this.nextRule, this.nextRuleBy];
        this.nextRule = null; this.nextRuleBy = null;
        b.cells.forEach((c) => { c.owner = null; c.t = -1e9; c.slide = null; });
        b.moves = 0; b.hist = { X: [], O: [] }; b.ghosts = []; b.ruled = false;
        this.lastWinner = b.turn;
        try { await this.startRule(b); } finally { if (gen === this.gen) [this.nextRule, this.nextRuleBy] = stash; }
        this.save();
      } else {
        const rule = await this.step(Wheel.spin(b.turn, false, STRINGS.dev.previewSub));
        this.toast(STRINGS.dev.wheelPreview(RULES[rule].icon, RULES[rule].name));
      }
    } catch (e) {
      if (gen === this.gen) console.error(e);
    } finally {
      if (gen === this.gen) { this.busy = false; this.settled(); this.updateHUD(); }
    }
  },

  setDev(on) {
    this.dev.on = on;
    this.savePrefs();
    this.syncDevPanel();
    this.toast(on ? STRINGS.dev.on : STRINGS.dev.off);
  },

  syncDevPanel() {
    const d = this.dev;
    $('devpanel').hidden = !d.on;
    $('dvForce').value = d.force; $('dvWheel').value = d.wheel;
    $('dvTease').checked = d.tease; $('dvEvery').checked = d.everywhere; $('dvReveal').checked = d.reveal;
    $('dvNearMiss').checked = !!d.nearMiss;
  },

  initDevPanel() {
    const opts = (items) => items.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    $('dvForce').innerHTML = opts(STRINGS.dev.forceOptions);
    $('dvWheel').innerHTML = opts([['', STRINGS.dev.wheelRandom], ...RULE_KEYS.map((k) => [k, `${RULES[k].iconText || RULES[k].icon} ${RULES[k].name}`])]);
    const bind = (id, key, prop = 'value') => $(id).addEventListener('change', (e) => { this.dev[key] = e.target[prop]; this.savePrefs(); });
    bind('dvForce', 'force'); bind('dvWheel', 'wheel');
    bind('dvTease', 'tease', 'checked'); bind('dvEvery', 'everywhere', 'checked'); bind('dvReveal', 'reveal', 'checked'); bind('dvNearMiss', 'nearMiss', 'checked');
    $('dvSpin').addEventListener('click', () => { Sound.ensure(); this.devSpin(); });
    $('dvWheelSpin').addEventListener('click', () => { Sound.ensure(); this.devWheel(); });
    $('dvClose').addEventListener('click', () => this.setDev(false));
    $('devpanel').querySelector('.dv-head span').addEventListener('click', () => $('devpanel').classList.toggle('collapsed'));
    if (window.innerWidth <= 640) $('devpanel').classList.add('collapsed');
    this.syncDevPanel();
  },

  // Level 0: keep only each player's newest marks; the oldest one vanishes.
  vanish(b, p, k) {
    b.moves++;
    b.hist[p].push(k);
    b.fogAt[k] = b.moves;
    this.dropOldest(b, p);
  },

  dropOldest(b, p) {
    const h = b.hist[p];
    if (h.length <= (b.keep ? b.keep[p] : KEEP_MARKS)) return;
    const old = h.shift();
    const c = b.cells[old];
    c.owner = null; c.t = -1e9;
    const t = performance.now() + TIMING.board.vanishPoof;
    b.ghosts.push({ k: old, owner: p, t });
    const gen = this.gen;
    setTimeout(() => {
      if (gen !== this.gen || !b.geo) return;
      const [x, y] = Renderer.cellScreen(b, old);
      Renderer.sparks(x, y - 10, p, 30, 5);
      Renderer.floatText(x, y - 30, STRINGS.pop.poof, p, 24);
      Sound.poof();
    }, TIMING.board.vanishPoof);
  },

  // ---------- mystery jackpot ----------
  async jackpotSpin(b, k, p) {
    const [x, y] = Renderer.cellScreen(b, k);
    await this.step(wait(TIMING.slots.jackpotFoundDelay));
    Sound.jackpotFound();
    Renderer.flash(0.45, '255,210,63');
    Renderer.shake(12);
    Renderer.kick(0.06);
    Renderer.coins(x, y, 70);
    Renderer.ripple(b, k, p, 1.6);
    Renderer.floatText(x, y - 30, STRINGS.pop.jackpot, null, 54);
    await this.step(wait(TIMING.slots.jackpotToMachine));
    const spin = Slots.spin(p, b.level, this.vsCPU && p === 'O', { shield: b.level === 0 && b.rule === 'vanish' });
    await this.step(spin);
    const prize = await spin;
    return this.applyPrize(b, p, prize);
  },

  async applyPrize(b, p, prize) {
    const opp = other(p);
    const cellsOf = (fn) => b.cells.map((c, i) => (fn(c) ? i : -1)).filter((i) => i >= 0);
    if (prize === 'bust') { this.toast(STRINGS.msg.bust); return {}; }
    if (prize === 'extra') return { extra: true };
    if (prize === 'shield') {
      b.keep[p] = KEEP_MARKS + 1;
      this.toast(STRINGS.msg.shield(p));
      return {};
    }
    if (prize === 'jackpot' && b.level === 0) return { win: true };
    if (prize === 'rule') {
      const rule = await this.step(RulePick.open(p, this.vsCPU && p === 'O', b.level === 0 ? b.rule : null, () => AI.chooseRule(b.level === 0 ? b.rule : null)));
      this.nextRule = rule; this.nextRuleBy = p;
      const R = RULES[rule];
      this.save();
      this.updateHUD();
      // the same title card as the wheel, then it flies up to sit beside the current rule as "next game"
      this.showRuleCard(b, STRINGS.ruleCard.pickedBy(p), rule);
      await this.step(wait(TIMING.slots.rulePickSettle));
      return {};
    }
    let cands, verb;
    if (prize === 'jackpot') { cands = cellsOf((c) => !c.owner && !c.child); verb = STRINGS.msg.pickClaim; }
    if (prize === 'steal') { cands = cellsOf((c) => c.owner === opp); verb = STRINGS.msg.pickSteal(opp); }
    if (prize === 'bomb') { cands = cellsOf((c) => c.owner === opp || (b.level > 0 && c.owner === DEAD)); verb = STRINGS.msg.pickBomb(opp, b.level > 0); }
    if (!cands.length) { this.toast(STRINGS.msg.noTarget); return { extra: true }; }
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
      Renderer.floatText(x, y - 30, STRINGS.pop.stolen, p, 40);
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
      Renderer.floatText(x, y - 30, STRINGS.pop.boom, null, 56);
    }
    // Gravity: a bombed mark leaves a gap, and a claimed square may be hanging in mid-air, so once the
    // blast has cleared every mark above an empty square falls down into it
    if (b.level === 0 && b.rule === 'gravity' && (prize === 'bomb' || prize === 'jackpot')) {
      await this.step(wait(TIMING.slots.gravityDropDelay));
      if (this.settleGravity(b)) await this.step(wait(TIMING.board.gravitySettle));
    }
    await this.step(wait(TIMING.slots.prizeSettle));
    return {};
  },

  chooseTarget(b, p, cands, kind, verb) {
    return new Promise((resolve) => {
      this.selecting = { b, p, cands: new Set(cands), kind, resolve, verb };
      Renderer.select = this.selecting;
      this.toast(STRINGS.msg.pick(verb));
      this.updateHUD();
      if (this.vsCPU && p === 'O') setTimeout(() => this.select(AI.pickTarget(b, p, cands, kind)), TIMING.slots.cpuTargetDelay);
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
    { const [x, y] = Renderer.boardScreenCenter(b); Renderer.floatText(x, y - 30, STRINGS.pop.stalemate, null, 46); }
    const P = b.parent, k = b.parentIndex;
    this.toast(STRINGS.msg.stalemate(b.rule === 'vanish', MOVE_CAP, CELL_NAMES[k], P.level));
    await this.step(wait(TIMING.camera.stalematePause));
    Sound.zoomOut();
    Tweens.add(TIMING.camera.wonFade, (e) => { b.alpha = 1 - e; }, Ease.inOutCubic, TIMING.camera.wonFadeDelay);
    await this.step(Renderer.flyTo(viewOf(P), TIMING.camera.zoomOutToParent));
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
      Renderer.floatText(x, y - 20, STRINGS.pop.blocked, null, 34);
    }, TIMING.board.markImpact);
    await this.step(wait(TIMING.camera.stalemateSettle));
    return P;
  },

  async replay(b) {
    Sound.draw();
    Renderer.shake(8);
    { const [x, y] = Renderer.boardScreenCenter(b); Renderer.floatText(x, y - 30, STRINGS.pop.draw, null, 50); }
    const big = b.level >= 1;
    this.toast(big ? STRINGS.msg.bigDraw(lvName(b.level), other(b.starter)) : STRINGS.msg.turfDraw(lvName(b.level, true), other(b.starter)));
    await this.step(wait(TIMING.camera.drawPause));
    const keep = (k, c) => big ? ([0, 2, 4, 6, 8].includes(k) && c.owner !== DEAD) : (b.seeded && k === 4);
    b.cells.forEach((c, k) => {
      if (keep(k, c)) return;
      c.owner = null; c.t = -1e9; c.child = null; c.record = null;
    });
    b.hist = { X: [], O: [] };
    b.moves = 0;
    b.ghosts = [];
    if (big) b.keep = { X: KEEP_MARKS, O: KEEP_MARKS };
    else { b.rule = 'classic'; b.keep = { X: 99, O: 99 }; b.shift = null; b.ruled = false; }
    const empties = b.cells.map((c, k) => (c.owner ? -1 : k)).filter((k) => k >= 0);
    b.jackpot = empties.length ? empties[(Math.random() * empties.length) | 0] : -1;
    b.starter = other(b.starter);
    b.turn = b.starter;
    b.born = performance.now();
    await this.step(wait(TIMING.camera.drawSettle));
    if (!big) await this.startRule(b);
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
      Tweens.add(TIMING.camera.browseFade, (e) => { r.alpha = e; }, Ease.outCubic);
    }
    for (const r of leaving) Tweens.add(TIMING.camera.browseFade, (e) => { r.alpha = 1 - e; }, Ease.inOutCubic, TIMING.camera.browseFadeDelay);
    const goingIn = target.level < from.level;
    this.view = target === this.current() ? null : target;
    this.layoutAll();
    this.busy = true;
    this.updateHUD();
    goingIn ? Sound.zoomIn() : Sound.zoomOut();
    try {
      await this.step(Renderer.flyTo(viewOf(target), TIMING.camera.browseZoom));
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
    if (this.replay) return;
    this.save();
    this.updateHUD();
    this.scheduleCPU();
  },

  scheduleCPU() {
    clearTimeout(this.cpuTimer);
    if (!this.vsCPU || this.busy || this.view) return;
    const b = this.current();
    if (b.turn !== 'O' || b.winner || (b.level === 0 && !b.ruled)) return;
    this.cpuTimer = setTimeout(() => {
      if (this.busy || this.view) return;
      const c = this.current();
      if (c !== b || c.turn !== 'O') return;
      this.play(c.level === 0 ? AI.chooseL0(c, 'O') : AI.choose(c.cells.map((x) => x.owner), 'O'), true);
    }, TIMING.board.cpuMoveDelay);
  },

  // ---------- storage ----------
  save() {
    if (this.replay) return;   // never save the replay's copy of the game
    try {
      const d = serialize(this.root);
      d.nr = this.nextRule; d.nb = this.nextRuleBy; d.lw = this.lastWinner;
      const json = JSON.stringify(d);
      localStorage.setItem(SAVE_KEY, json);
      this.snapshot(json);
    } catch (e) { /* storage unavailable */ }
  },

  // ---------- game review / instant replay ----------
  // Every saved state of the game is kept as a snapshot, so any earlier game can be played back.
  log: [],      // [{s: serialized root, p: path to the live board}]
  games: [],    // [{i: first snapshot, label, level, path, rule, winner}] in the order they started
  replay: null, // the running Instant Replay, if any
  pathOf(b) { const p = []; for (let x = b; x.parent; x = x.parent) p.unshift(x.parentIndex); return p; },
  boardAt(root, path) {
    let b = root;
    for (const k of path) { const c = b && b.cells[k]; b = c ? (c.child || c.record) : null; }
    return b;
  },
  gameLabel(b) {
    if (b.level === 0) return b.parent ? STRINGS.review.turfFor(CELL_NAMES[b.parentIndex], b.parent.level) : STRINGS.review.openingTurf;
    return lvName(b.level);
  },
  snapshot(json) {
    const last = this.log[this.log.length - 1];
    if (last && last.s === json) return;
    const cur = this.current(), p = this.pathOf(cur), key = `${p.join('.')}@${cur.level}`;
    const i = this.log.length;
    this.log.push({ s: json, p });
    const g = this.games[this.games.length - 1];
    // a new game: the live board moved somewhere else, or it was cleared for a rematch after a draw
    // a new big level begins when the top of the tower grows
    if (this.root.level > 0 && !this.games.some((x) => x.top && x.level === this.root.level)) this.games.push({ i, key: `top${this.root.level}`, label: lvName(this.root.level), level: this.root.level, path: [], top: true });
    // a new Turf Battle: the live board moved somewhere else, or it was cleared for a rematch after a draw
    const lastTurf = [...this.games].reverse().find((x) => !x.top);
    if (cur.level === 0 && (!lastTurf || lastTurf.key !== key || cur.moves < (lastTurf.moves || 0) || (cur.ruled === false && lastTurf.rule && lastTurf.done))) {
      this.games.push({ i, key, label: this.gameLabel(cur), level: 0, path: p, moves: cur.moves });
    }
    const gg = cur.level === 0 ? [...this.games].reverse().find((x) => !x.top) : null;
    if (gg) { gg.moves = cur.moves; if (cur.ruled) { gg.rule = cur.rule; gg.done = true; } }
    // who won each game, once it's over (an old top board now sits under the center of the one above it)
    const find = (x) => { let bb = this.boardAt(this.root, x.path); while (bb && bb.level > x.level) bb = bb.cells[4].record || null; return bb; };
    for (const x of this.games) if (!x.winner) { const bb = find(x); if (bb && bb.level === x.level && bb.winner && bb.winner !== DEAD) x.winner = bb.winner; }
    if (this.log.length > LOG_CAP) this.trimLog(this.log.length - LOG_CAP);
    this.saveLog();
  },
  trimLog(n) {
    this.log.splice(0, n);
    this.games = this.games.map((g) => ({ ...g, i: g.i - n })).filter((g) => g.i >= 0);
  },
  saveLog() {
    for (let tries = 0; tries < 4; tries++) {
      try { localStorage.setItem(LOG_KEY, JSON.stringify({ log: this.log, games: this.games })); return; } catch (e) {
        if (this.log.length < 10) return;
        this.trimLog(Math.ceil(this.log.length / 3));   // out of space: forget the oldest third
      }
    }
  },
  loadLog() {
    try { const d = JSON.parse(localStorage.getItem(LOG_KEY) || 'null'); if (d && Array.isArray(d.log)) { this.log = d.log; this.games = d.games || []; } } catch (e) { /* none */ }
  },

  startReplay(i) {
    if (this.replay) return;
    if (this.busy || this.selecting) { this.toast(STRINGS.msg.replayBusy); return; }
    if (!this.log.length) { this.toast(STRINGS.msg.replayEmpty); return; }
    this.showReview(false);
    clearTimeout(this.cpuTimer);
    this.busy = true;
    this.view = null; this.trail = [];
    this.replay = { i: Math.max(0, Math.min(i, this.log.length - 1)), live: this.root, speed: 1, paused: false, timer: 0, end: this.log.length - 1 };
    document.body.classList.add('instant-replay');
    $('replaybar').hidden = false;
    Sound.cardFlip(0);
    this.applySnap(this.replay.i, true);
    this.queueReplay(TIMING.replay.firstStep);
  },
  applySnap(i, first = false) {
    const R = this.replay, snap = this.log[i], prevRoot = this.root;
    const prevCur = first ? null : this.current();
    const prevPath = prevCur ? this.pathOf(prevCur).join('.') : null;
    this.root = deserialize(JSON.parse(snap.s));
    this.layoutAll();
    const cur = this.current(), now = performance.now();
    const moved = prevPath !== this.pathOf(cur).join('.');
    if (!first && !moved) {
      // same board as last step: drop in the new marks and fade out the ones that left
      const old = this.boardAt(prevRoot, this.pathOf(cur));
      if (old) cur.cells.forEach((c, k) => {
        const o = old.cells[k].owner;
        if (c.owner && c.owner !== o) { c.t = now; if (c.owner === 'X' || c.owner === 'O') { Sound.place(c.owner); setTimeout(() => Sound.land(cur.level), TIMING.board.markImpact); } }
        if (o && o !== c.owner && !c.owner) cur.ghosts.push({ k, owner: o, t: now });
      });
      if (old && !old.winner && cur.winner) { const [x, y] = Renderer.boardScreenCenter(cur); Renderer.floatText(x, y - 40, STRINGS.pop.replayWins(cur.winner), cur.winner, 44); Sound.win(); }
    }
    // keep the camera on the board being played
    if (first || moved) Renderer.flyTo(viewOf(cur), first ? TIMING.replay.cameraFirst : TIMING.replay.cameraMove);
    R.i = i;
    this.updateHUD();
    this.updateReplayBar();
    return moved;
  },
  queueReplay(ms) {
    const R = this.replay; if (!R) return;
    clearTimeout(R.timer);
    if (R.paused) return;
    R.timer = setTimeout(() => this.stepReplay(), ms / R.speed);
  },
  stepReplay() {
    const R = this.replay; if (!R) return;
    if (R.i >= this.log.length - 1) { this.stopReplay(true); return; }
    const moved = this.applySnap(R.i + 1);
    this.queueReplay(moved ? TIMING.replay.stepNewBoard : TIMING.replay.stepSameBoard);
  },
  stopReplay(caughtUp = false) {
    const R = this.replay; if (!R) return;
    clearTimeout(R.timer);
    this.replay = null;
    this.root = R.live;
    this.layoutAll();
    document.body.classList.remove('instant-replay');
    $('replaybar').hidden = true;
    this.busy = false;
    Renderer.flyTo(viewOf(this.current()), TIMING.replay.cameraBack);
    this.toast(caughtUp ? STRINGS.msg.replayCaughtUp : STRINGS.msg.replayStopped);
    this.settled();
  },
  toggleReplayPause() {
    const R = this.replay; if (!R) return;
    R.paused = !R.paused;
    if (!R.paused) this.queueReplay(TIMING.replay.resume);
    else clearTimeout(R.timer);
    this.updateReplayBar();
  },
  replaySpeed() {
    const R = this.replay; if (!R) return;
    R.speed = R.speed >= 4 ? 1 : R.speed * 2;
    this.updateReplayBar();
    if (!R.paused) this.queueReplay(600);
  },
  updateReplayBar() {
    const R = this.replay; if (!R) return;
    const g = [...this.games].reverse().find((x) => x.i <= R.i && !x.top) || null;
    const cur = this.current();
    const rule = cur.level === 0 && cur.ruled && RULES[cur.rule] ? ` · ${RULES[cur.rule].icon} ${RULES[cur.rule].name}` : '';
    $('rpTitle').innerHTML = `${g ? g.label : lvName(cur.level)}${rule}`;
    const n = this.log.length - 1, pct = n ? (R.i / n) * 100 : 100;
    $('rpFill').style.width = `${pct}%`;
    $('rpPause').textContent = R.paused ? STRINGS.review.play : STRINGS.review.pause;
    $('rpSpeed').textContent = STRINGS.review.speed(R.speed);
  },

  // The Game review panel: every Level and Turf Battle so far, each with an Instant Replay button.
  showReview(show) {
    const el = $('review');
    if (!show) { el.hidden = true; return; }
    if (this.replay) return;
    const rows = this.games.map((g, n) => ({ g, n })).reverse().map(({ g, n }) => {
      const icon = g.top ? '🏆' : g.rule && RULES[g.rule] ? RULES[g.rule].icon : '⚔️';
      const res = g.winner ? STRINGS.review.wonBy(g.winner) : (n === this.games.length - 1 || (g.top && g.level === this.root.level)) ? STRINGS.review.inProgress : '';
      const rule = g.rule && RULES[g.rule] ? `<span class="rv-rule">${RULES[g.rule].name}</span>` : '';
      return `<li class="rv-row${g.top ? ' top' : ''}"><span class="rv-icon">${icon}</span><span class="rv-text"><b class="rv-name">${g.label}</b>${rule}<span class="rv-res">${res}</span></span><button type="button" class="rv-play" data-i="${g.i}">${STRINGS.review.replayButton}</button></li>`;
    }).join('');
    $('rvList').innerHTML = rows || `<li class="rv-empty">${STRINGS.review.empty}</li>`;
    el.hidden = false;
  },
  // show the "tap to turn the sound on" chip while sound is on but the browser hasn't started it yet
  syncSoundLock() { $('soundLock').hidden = !Sound.locked(); },

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      this.vsCPU = !!p.vsCPU;
      Sound.on = p.sound !== false;
      Sound.setMix(p.sfxVol != null ? p.sfxVol : null, p.voiceVol != null ? p.voiceVol : null);
      this.best = p.best || 0;
      if (p.dev) Object.assign(this.dev, p.dev);
    } catch (e) { /* defaults */ }
    if (/[?&]dev\b/.test(location.search)) this.dev.on = true;
  },
  savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ vsCPU: this.vsCPU, sound: Sound.on, sfxVol: Sound.sfxVol, voiceVol: Sound.voiceVol, best: this.best, dev: this.dev })); } catch (e) { /* ignore */ }
  },

  // ---------- HUD ----------
  updateHUD() {
    const root = this.root, cur = this.current();
    this.best = Math.max(this.best, root.level);
    $('topLevel').textContent = root.level;
    $('bestLevel').textContent = STRINGS.page.best(this.best);
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
      return `<button type="button" class="${cls}" data-i="${i}" style="--h:${levelHue(b.level)}">${lvName(b.level)}${where}</button>`;
    });
    $('path').innerHTML = parts.join('<span class="sep">▸</span>');
    $('zLevels').innerHTML = chain.slice().map((b, i) => {
      const cls = ['zl', b === focus ? 'here' : '', this.isRecord(b) ? 'replay' : '', b === cur ? 'live' : ''].join(' ');
      return `<button type="button" class="${cls}" data-i="${i}" style="--h:${levelHue(b.level)}" title="${STRINGS.page.zoomTo(lvName(b.level, true))}">${STRINGS.general.levelShort(b.level)}</button>`;
    }).join('');
    $('zOut').disabled = !focus.parent;
    const t = this.trail[this.trail.length - 1];
    $('zIn').disabled = !((t && t.parent === focus) || (focus.pending != null && focus.cells[focus.pending].child));
    $('zoombar').classList.toggle('reviewing', !!this.view);
    document.body.classList.toggle('reviewing', !!this.view);

    const p = cur.turn;
    const who = this.vsCPU ? (p === 'O' ? STRINGS.general.computer : STRINGS.general.you) : '';
    let txt;
    if (this.view && this.isRecord(focus)) {
      const P = focus.parent;
      txt = STRINGS.hud.reviewTurf(focus.level, CELL_NAMES[focus.parentIndex], P.level, focus.winner);
    } else if (this.view && replaying) {
      txt = STRINGS.hud.reviewLevel(lvName(focus.level), focus.winner);
    } else if (this.view) {
      txt = STRINGS.hud.viewing(lvName(focus.level, true), cur.level);
    } else if (cur.winner) txt = STRINGS.hud.wins(cur.winner);
    else if (cur.level === 0) txt = STRINGS.hud.toMove(p, who);
    else txt = STRINGS.hud.picksSpace(p, who);
    this.updateStakes(cur);
    this.updateRuleBadge(cur);
    this.updateRulePin(cur);
    if (this.selecting) txt = STRINGS.hud.selecting(this.selecting.verb, this.vsCPU && this.selecting.p === 'O');
    const turnEl = $('turn');
    if (turnEl.innerHTML !== txt) {
      turnEl.innerHTML = txt;
      turnEl.classList.remove('pop');
      void turnEl.offsetWidth;
      turnEl.classList.add('pop');
    }
    $('btnCpu').textContent = STRINGS.page.vsComputer(this.vsCPU);
    $('btnCpu').classList.toggle('on', this.vsCPU);
    $('btnSound').textContent = STRINGS.page.sound(Sound.on);
  },

  updateRuleBadge(cur) {
    let h = '';
    if (!this.view && cur.level === 0 && !cur.winner && cur.ruled) {
      const R = RULES[cur.rule] || RULES.vanish;
      h = '';
      if (cur.rule === 'vanish') {
        h += ['X', 'O'].map((p) => {
          const keep = cur.keep[p], n = Math.min(cur.hist[p].length, keep);
          let dots = '';
          for (let i = 0; i < keep; i++) dots += `<i class="${i < n ? 'on' : ''}${i === 0 && n >= keep ? ' old' : ''}${i === 0 && n >= keep && cur.turn === p ? ' next' : ''}"></i>`;
          return `<span class="rb-dots ${p}"><b class="${p}">${p}</b>${dots}</span>`;
        }).join('');
      } else if (MOVERS[cur.rule]) {
        const left = SHIFT_EVERY - (cur.moves % SHIFT_EVERY);
        const verb = STRINGS.hud.movesIn[cur.rule];
        h += `<span class="rb-sub${left === 1 ? ' hot' : ''}">${left === 1 ? STRINGS.hud.moverSoon(verb) : STRINGS.hud.moverIn(verb, left)}</span>`;
      } else if (cur.rule === 'fog') {
        h += `<span class="rb-sub">${STRINGS.hud.fogBadge}</span>`;
      }
      if (h) h = `<span class="rb-icon">${R.icon}</span>` + h;
    }
    const el = $('rulebadge');
    if (el.innerHTML !== h) el.innerHTML = h;
    el.title = cur.level === 0 ? (RULES[cur.rule] || RULES.vanish).short : '';
  },

  // What the current game means for the boards above it.
  stakesFor(P, k) {
    const o = P.cells.map((c) => c.owner);
    const before = threatsOf(o);
    const out = { win: [], parts: [] };
    for (const p of ['X', 'O']) {
      const o2 = o.slice(); o2[k] = p;
      const r = lineResult(o2);
      if (r && r !== 'draw' && r.p === p) { out.win.push(p); out.parts.push(STRINGS.hud.stakesWins(p, P.level)); continue; }
      const bits = [];
      if (before[other(p)].has(k)) bits.push(STRINGS.hud.stakesBlocks(other(p)));
      const after = threatsOf(o2)[p];
      const newThreats = [...after].filter((i) => !before[p].has(i)).length;
      if (newThreats >= 2) bits.push(STRINGS.hud.stakesDouble);
      else if (newThreats === 1) bits.push(STRINGS.hud.stakesThreat(P.level));
      if (bits.length) out.parts.push(STRINGS.hud.stakesPlayer(p, bits.join(' and ')));
    }
    return out;
  },

  updateStakes(cur) {
    const el = $('stakes');
    let html = '', match = false;
    if (!this.view && !cur.winner) {
      if (cur.level === 0 && !cur.parent) {
        html = STRINGS.hud.stakesFirst(cur.level + 1);
      } else if (cur.level === 0) {
        const P = cur.parent, k = cur.parentIndex;
        const s = this.stakesFor(P, k);
        match = s.win.length > 0;
        html = (match ? STRINGS.hud.matchPoint : STRINGS.hud.stakes) +
          (s.parts.length ? s.parts.join(' · ') : STRINGS.hud.stakesDefault(CELL_NAMES[k], P.level));
      } else {
        const t = threatsOf(cur.cells.map((c) => c.owner));
        const desc = (p) => [...t[p]].map((i) => CELL_NAMES[i]).join(', ');
        const bits = ['X', 'O'].filter((p) => t[p].size).map((p) => STRINGS.hud.bigCanWin(p, desc(p)));
        html = bits.length ? STRINGS.hud.bigThreats(bits.join(' · ')) : STRINGS.hud.bigNoThreats;
      }
    }
    if (html && !this.view && cur.jackpot >= 0) html += ` · ${STRINGS.hud.jackpotHere}`;
    if (html && cur.level === 0 && !this.view && cur.rule === 'vanish') {
      const left = MOVE_CAP - cur.moves;
      if (left <= 6) html += ` · ${STRINGS.hud.untilStalemate(left)}`;
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
        Sound.matchPointVoice();
        Renderer.floatText(Renderer.W / 2, Renderer.centerY() - 60, STRINGS.pop.matchPoint, null, 52);
        Renderer.shake(8);
      }, 1100);
    }
  },

  toast(html) {
    const el = $('toast');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), TIMING.board.toast);
  },

  banner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('play');
    void el.offsetWidth; // restart animation
    el.classList.add('play');
  },

  showHelp(show) {
    $('help').hidden = !show;
    if (!show && this.ruleCardOnHelpClose) { this.ruleCardOnHelpClose = false; this.beginL0(this.current()); }
  },
};

// ---------- wiring ----------
(function main() {
  const canvas = $('scene');
  Renderer.init(canvas);
  MiniMap.init($('minimap'));
  Game.start();
  Game.initDevPanel();

  const pos = (e) => [e.clientX, e.clientY];
  let downCell = -1;
  canvas.addEventListener('pointermove', (e) => {
    const f = Game.focus();
    const k = Renderer.pick(f, ...pos(e));
    const cell = k >= 0 ? f.cells[k] : null;
    const playable = cell && Renderer.canHover && (f.level === 0 ? landingCell(f, k) >= 0 : !cell.owner && !cell.child);
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
      btn.textContent = STRINGS.page.newGameConfirm;
      clearTimeout(Game.confirmTimer);
      Game.confirmTimer = setTimeout(() => { btn.classList.remove('warn'); btn.textContent = STRINGS.page.newGame; }, 2500);
      return;
    }
    clearTimeout(Game.confirmTimer);
    btn.classList.remove('warn');
    btn.textContent = STRINGS.page.newGame;
    Game.newGame();
  });
  $('btnCpu').addEventListener('click', () => {
    Game.vsCPU = !Game.vsCPU;
    Game.savePrefs();
    Game.updateHUD();
    Game.toast(Game.vsCPU ? STRINGS.msg.vsComputerOn : STRINGS.msg.vsComputerOff);
    Game.scheduleCPU();
  });
  // volume mix popover: separate levels for sound effects and voice-overs
  const mixer = $('mixer'), mxSfx = $('mxSfx'), mxVox = $('mxVox');
  const showMix = () => {
    mxSfx.value = Math.round(Sound.sfxVol * 100); mxVox.value = Math.round(Sound.voiceVol * 100);
    $('mxSfxV').textContent = STRINGS.page.percent(mxSfx.value); $('mxVoxV').textContent = STRINGS.page.percent(mxVox.value);
  };
  $('btnMix').addEventListener('click', (e) => {
    e.stopPropagation();
    mixer.hidden = !mixer.hidden; $('btnMix').setAttribute('aria-expanded', String(!mixer.hidden));
    $('btnMix').classList.toggle('on', !mixer.hidden);
    showMix();
  });
  const onMix = () => { Sound.setMix(mxSfx.value / 100, mxVox.value / 100); showMix(); Game.savePrefs(); };
  mxSfx.addEventListener('input', onMix); mxVox.addEventListener('input', onMix);
  mxSfx.addEventListener('change', () => { Sound.ensure(); Sound.slotWin(false); });
  $('mxTest').addEventListener('click', () => { Sound.ensure(); Sound.voice('instant-win'); });
  document.addEventListener('pointerdown', (e) => {
    if (!mixer.hidden && !mixer.contains(e.target) && e.target !== $('btnMix')) { mixer.hidden = true; $('btnMix').classList.remove('on'); $('btnMix').setAttribute('aria-expanded', 'false'); }
  });
  $('btnSound').addEventListener('click', () => {
    Sound.on = !Sound.on;
    Sound.ensure();
    Game.savePrefs();
    Game.updateHUD();
    Game.syncSoundLock();
  });
  // after a page load the browser keeps audio locked until the first click, tap or key press; the chip
  // says so, and any gesture (the chip included) unlocks it
  $('soundLock').addEventListener('click', () => Sound.ensure());
  window.addEventListener('soundstate', () => Game.syncSoundLock());
  Game.syncSoundLock();
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
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'D' && e.shiftKey) { Game.setDev(!Game.dev.on); return; }
    if (e.key === 'Escape') { if (Game.replay) Game.stopReplay(); else if (!$('review').hidden) Game.showReview(false); else if (!$('help').hidden) Game.showHelp(false); else Game.backToLive(); }
    else if (e.key === ' ' && Game.replay) { e.preventDefault(); Game.toggleReplayPause(); }
    else if (e.key === '-' || e.key === '_' || e.key === 'PageUp') Game.zoomOut();
    else if (e.key === '+' || e.key === '=' || e.key === 'PageDown') Game.zoomIn();
  });

  $('btnHelp').addEventListener('click', () => Game.showHelp(true));
  $('btnReview').addEventListener('click', () => { Sound.ensure(); Game.showReview(true); });
  $('rvClose').addEventListener('click', () => Game.showReview(false));
  $('review').addEventListener('click', (e) => {
    if (e.target.id === 'review') { Game.showReview(false); return; }
    const b = e.target.closest('.rv-play'); if (b) Game.startReplay(+b.dataset.i);
  });
  $('rpPause').addEventListener('click', () => Game.toggleReplayPause());
  $('rpSpeed').addEventListener('click', () => Game.replaySpeed());
  $('rpStop').addEventListener('click', () => Game.stopReplay());
  $('btnCloseHelp').addEventListener('click', () => {
    Sound.ensure(); Game.showHelp(false);
  });
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

// How to play: the numbered steps from STRINGS.help.steps, with the list of game types (built from
// RULES, so a new game type appears here automatically) where a step says {rules}.
(function buildHelp() {
  const rules = `<ul class="rules">${RULE_KEYS.map((k) => `<li>${STRINGS.help.rule(RULES[k].icon, RULES[k].name, RULES[k].help)}</li>`).join('')}</ul>`;
  $('helpSteps').innerHTML = STRINGS.help.steps.map((s) => `<li>${s.replace('{rules}', rules)}</li>`).join('');
})();
