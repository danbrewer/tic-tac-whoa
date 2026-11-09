'use strict';
// =====================================================================================================
//  STRINGS: every piece of text the player sees, in one place.
//
//  * Game names, rule descriptions, How to play, buttons, labels, messages ("toasts"), the big words
//    that pop up over the board, the Fortune Wheel, the slot machine, RULE PICK, Review, Instant Replay,
//    the volume mixer and the Developer Mode panel.
//  * RULE FOR FUTURE WORK: new games and new features put their player-facing text HERE, never as a
//    literal in another file. Add the string to the right group, then read it as STRINGS.group.name.
//  * strings-reference.md (in the project root) lists every entry and every place in the code that uses it.
//
//  HOW TO READ THIS FILE
//  * A plain string is used as is, for example STRINGS.page.newGame.
//  * A function fills in the parts that change, for example STRINGS.msg.goesAgain('X'). The arguments are
//    named in its comment. Edit the words between the backticks; keep the ${...} parts.
//  * Many strings contain a little HTML: <b>bold</b>, <br> line breaks, <i>italics</i>. mark(p) writes a
//    player's letter in their colour (<b class="X">X</b>).
//  * Strings marked [page] are shown in index.html. That page has an empty element with a data-str
//    attribute naming the string; applyPageStrings() at the bottom of this file fills them in on load.
//  * Some text repeats a number defined in game.js (3 marks kept, 18-move limit, moves every 3 turns).
//    Those strings say so in their comment. If you change the number there, change the text here too.
//  * This file loads right after timing.js (see index.html), so every other script can read STRINGS.
// =====================================================================================================
const STRINGS = (() => {
  const mark = (p) => `<b class="${p}">${p}</b>`;   // a player's letter in their colour
  const plural = (n, one, many) => (n === 1 ? one : many);

  return {
    mark,

    // ---------------------------------------------------------------------------------------------
    //  GENERAL: names used all over the game
    // ---------------------------------------------------------------------------------------------
    general: {
      // the nine spaces, in board order 0-8 (0 is drawn at the top of the diamond)
      cellNames: ['top', 'upper-right', 'right', 'upper-left', 'center', 'lower-right', 'left', 'lower-left', 'bottom'],
      // a board's name. level 0 is a Turf Battle; with the=true you get "the Turf Battle"
      levelName: (level, the = false) => (level === 0 ? `${the ? 'the ' : ''}Turf Battle` : `Level ${level}`),
      levelShort: (level) => (level === 0 ? 'Turf' : `L${level}`),   // zoom bar buttons
      you: 'You',
      computer: 'Computer',
    },

    // ---------------------------------------------------------------------------------------------
    //  GAME TYPES: one entry per Turf Battle rule. The keys must match RULES in game.js.
    //    name   the full name (title card, rule plate, RULE PICK cards, Review, How to play)
    //    wheel  the short name printed on the Fortune Wheel's spokes (keep it short: about 8 letters)
    //    short  the one-line description (title card, rule plate, RULE PICK cards, tooltip on the badge)
    //    help   the longer description in How to play
    // ---------------------------------------------------------------------------------------------
    rules: {
      classic: {
        name: 'Classic Tic-Tac-Toe', wheel: 'CLASSIC',
        short: 'Plain tic-tac-toe. A full board with no line is a stalemate.',
        help: 'plain rules.',
      },
      vanish: {   // "3" and "18" match KEEP_MARKS and MOVE_CAP in game.js
        name: 'Vanishing Marks', wheel: 'VANISH',
        short: 'Keep only your 3 newest marks. Your 4th makes your oldest vanish.',
        help: "you keep only your <b>3 newest marks</b>. Your 4th makes your oldest vanish (it flickers when it's next; the dots on the badge count your marks). No winner within 18 moves is a stalemate.",
      },
      gravity: {
        name: 'Gravity', wheel: 'GRAVITY',
        short: 'The board stands up: marks drop to the bottom of their column, like Connect Four.',
        help: 'the board stands up like Connect Four, and marks drop to the bottom of their column.',
      },
      shift: {    // "3" matches SHIFT_EVERY in game.js
        name: 'Shifting Squares', wheel: 'SHIFT',
        short: 'Every 3 moves a row or column slides one space and wraps around.',
        help: 'every 3 moves the row or column with the arrows slides one space, and marks pushed off the edge wrap around.',
      },
      wild: {
        name: 'Wild Square', wheel: 'WILD',
        short: 'The shape-shifting mark counts for both players and jumps to a new space after every turn.',
        help: 'the shape-shifting mark counts for both players and jumps to a new space after every turn.',
      },
      misere: {
        name: 'Misère', wheel: 'MISÈRE',
        short: 'Upside down: whoever makes three in a row LOSES.',
        help: 'whoever makes three in a row <b>loses</b>.',
      },
      fog: {
        name: 'Fog of War', wheel: 'FOG',
        short: 'Fog rolls over each mark after the next move. Fogged spaces are taken, so remember who is where!',
        help: "once the next move lands, fog rolls over each mark and hides whether it's an X or an O. Fogged spaces are still taken, so remember who is where. The fog lifts when the game ends.",
      },
      ring: {     // "3" matches SHIFT_EVERY in game.js
        name: 'Ring Spin', wheel: 'RING',
        short: 'Every 3 moves the 8 outer spaces turn one step clockwise around the center.',
        help: 'every 3 moves the 8 outer spaces turn one step clockwise around the center.',
      },
      cross: {    // "3" matches SHIFT_EVERY in game.js
        name: 'Crossfire', wheel: 'CROSS',
        short: 'Every 3 moves the marks on both diagonals slide along them, corner to corner. The center stays put.',
        help: 'every 3 moves the marks at the ends of each diagonal slide through the center and trade corners. The center and edge spaces stay put.',
      },
    },

    // ---------------------------------------------------------------------------------------------
    //  PAGE: fixed text on the page (all [page], filled in by applyPageStrings)
    // ---------------------------------------------------------------------------------------------
    page: {
      title: 'Infinite Tic-Tac-Toe',                         // the browser tab
      brand: 'Infinite<br>Tic-Tac-Toe',                      // top-left logo text
      sceneLabel: 'Isometric tic-tac-toe board',             // screen-reader label for the game board
      levelBoxTitle: 'The highest level reached in this game',
      topLevel: 'Top level',
      best: (n) => `Best: ${n}`,                             // under the top level number
      pathLabel: 'Where you are',                            // screen-reader label for the trail at the top
      minimapLabel: 'Mini-map of the live boards and earlier levels',
      // zoom bar
      zoomBarLabel: 'Level zoom',
      zoom: 'Zoom',
      zoomOutTitle: 'Zoom out a level (− key or scroll down)',
      zoomInTitle: 'Zoom in a level (+ key or scroll up)',
      zoomLiveTitle: 'Back to the live game (Esc)',
      zoomLive: 'Back to game',
      zoomTo: (name) => `Zoom to ${name}`,                   // tooltip on each zoom bar level button
      // buttons along the bottom
      newGame: 'New game',
      newGameConfirm: 'Click again to restart',             // after the first click on New game
      vsComputer: (on) => `vs Computer: ${on ? 'On' : 'Off'}`,
      sound: (on) => `Sound: ${on ? 'On' : 'Off'}`,
      mix: '🎚️ Mix',
      mixTitle: 'Volume mix',
      review: '🎬 Review',
      reviewTitle: 'Game review: replay earlier games',
      howToPlay: 'How to play',
      // volume mixer popover
      mixerTitle: 'Volume mix',
      mixerSfx: 'Sound effects',
      mixerVoices: 'Voices',
      mixerTest: '▶ Test voice',
      percent: (n) => `${n}%`,
    },

    // ---------------------------------------------------------------------------------------------
    //  HOW TO PLAY: the help window ([page] for title, hint and button; the steps are built by game.js)
    //  {rules} in a step is replaced with the list of game types, built from STRINGS.rules[...].help.
    // ---------------------------------------------------------------------------------------------
    help: {
      title: 'How to play',
      steps: [
        'Every game starts with a <b>Turf Battle</b>: a quick game of tic-tac-toe on the smallest board. <span class="x">X</span> goes first.',
        'Win the Turf Battle and your mark becomes the <b>center space of Level 1</b>, a brand-new, bigger board. The other player picks first there.',
        "On Level 1 and above you don't just place a mark. You <b>pick an empty space</b>, the camera zooms in, and a fresh <b>Turf Battle</b> decides who owns it. Whoever picked moves first in that game.",
        'Win three in a row on Level 1 and your mark becomes the center of Level 2, and so on, forever. Every space on every level is won with one Turf Battle.',
        '<b>Glowing spaces</b> on the bigger boards would complete a line for that color. The <b>stakes bar</b> at the top tells you what the current game means, and the <b>mini-map</b> on the left shows the live boards and earlier levels. Click a mini board to zoom to it.',
        '<b>Level zoom:</b> use the zoom bar, the trail at the top, your scroll wheel, or the <b>+</b> / <b>−</b> keys to move between levels. Click any claimed space to zoom into the finished game that won it. Press <b>Esc</b> or <b>Back to game</b> to return.',
        '<b>Wheel of games:</b> before every Turf Battle, the winner of the last Turf Battle spins the wheel to pick the game type (X spins first). A title card names the rule, and the badge above the turn bar keeps it on screen.{rules}Outside Vanishing Marks, a full board with no line is a stalemate. A 🎲 <b>rule pick</b> from the slot machine lets its winner choose the next game type instead of spinning.',
        '<b>🎬 Game review:</b> open Review to see every Level and Turf Battle so far, and start an <b>Instant Replay</b> from any of them. It plays forward until you press Stop (or Esc) or it reaches the live game. Space pauses it.',
        '<b>Mystery jackpot:</b> every new board hides a jackpot under one space (watch for a little extra sparkle). Land a mark on it to spin the slot machine: ⚡ extra move, 🎭 steal a mark, 💣 bomb a mark or stone, 🛡️ keep 4 marks (Vanishing Marks only), 🎲 <b>rule pick</b> (choose the next game type), 🎆 <b>INSTANT WIN</b> in a Turf Battle or a free space on big boards... or bust.',
        '<b>Stone spaces:</b> a stalemate turns the space it was deciding into stone, which blocks both players. If a whole big board fills with no line, the edges and stone spaces clear, corners and center stay as a head start, and the other player picks first.',
      ],
      rule: (icon, name, help) => `${icon} <b>${name}:</b> ${help}`,   // one line of the game-type list
      hint: 'Play hot-seat with a friend, or turn on <b>vs Computer</b> to play <span class="x">X</span> against a computer <span class="o">O</span>. Your game is saved in this browser automatically.',
      close: "Let's play",
    },

    // ---------------------------------------------------------------------------------------------
    //  HUD: the turn line, the rule badge, the rule plate and the stakes bar
    // ---------------------------------------------------------------------------------------------
    hud: {
      // the turn line above the buttons. who is '' or "(You) " / "(Computer) " in vs-computer games
      toMove: (p, who) => `${mark(p)} ${who ? `(${who}) ` : ''}to move`,
      picksSpace: (p, who) => `${mark(p)} ${who ? `(${who}) ` : ''}picks a space to fight for`,
      wins: (p) => `${mark(p)} wins!`,
      reviewTurf: (level, cell, parentLevel, winner) => `Replay: ${level === 0 ? 'the Turf Battle' : `the Level ${level} game`} for the ${cell} space of Level ${parentLevel}, won by ${mark(winner)}`,
      reviewLevel: (name, winner) => `Replay: ${name}, won by ${mark(winner)}`,
      viewing: (name, curLevel) => `Viewing ${name}. The live game is ${curLevel === 0 ? 'the Turf Battle' : `on Level ${curLevel}`}.`,
      // a slot prize is waiting for a target. verb is one of msg.pickClaim / pickSteal / pickBomb
      selecting: (verb, cpu) => `🎰 ${verb} <span class="hint-dim">(${cpu ? 'computer choosing' : 'click a glowing ring'})</span>`,
      // the rule badge above the turn line
      movesIn: { shift: 'shifts', ring: 'spins', cross: 'crosses' },   // verb for each moving game type
      moverSoon: (verb) => `${verb} after this move!`,
      moverIn: (verb, n) => `${verb} in ${n} moves`,
      fogBadge: 'fog covers each mark after the next move',
      // the rule plate pinned at the top during a Turf Battle
      pinNext: 'Next',
      pinNextTurf: 'Next Turf Battle',
      pickedBy: (p) => `picked by ${mark(p)}`,
      // the stakes bar at the top
      stakesFirst: (nextLevel) => `Stakes: the winner takes the center of Level ${nextLevel}`,
      stakes: 'Stakes: ',
      matchPoint: '🔥 MATCH POINT: ',
      stakesDefault: (cell, level) => `whoever wins takes the ${cell} space of Level ${level}`,
      stakesWins: (p, level) => `${mark(p)} wins Level ${level}`,
      stakesBlocks: (opp) => `blocks ${mark(opp)}`,
      stakesDouble: 'sets up a double threat',
      stakesThreat: (level) => `threatens Level ${level}`,
      stakesPlayer: (p, bits) => `${mark(p)} ${bits}`,               // bits are joined with " and "
      bigCanWin: (p, cells) => `${mark(p)} can win at ${cells}`,
      bigThreats: (bits) => `Glowing spaces win the level: ${bits}`,
      bigNoThreats: 'Pick a space. Glowing spaces mark winning spots.',
      jackpotHere: '<span class="jp">🎰 jackpot hidden here</span>',
      untilStalemate: (n) => `<span class="warn">${n} ${plural(n, 'move', 'moves')} until stalemate</span>`,
    },

    // ---------------------------------------------------------------------------------------------
    //  MESSAGES: the toast messages at the bottom of the screen
    // ---------------------------------------------------------------------------------------------
    msg: {
      welcomeBack: (name) => `Welcome back! Picking up at ${name}.`,
      newGame: 'New game! X spins the wheel to pick the first game type.',
      goesFor: (p, cell, childName) => `${mark(p)} goes for the ${cell} space. Win this ${childName} to claim it!`,
      childGame: (level) => (level === 0 ? 'Turf Battle' : `Level ${level} game`),
      jackpotUnderStone: 'The mystery jackpot was buried under stone!',
      goesAgain: (p) => `${mark(p)} goes again!`,
      wins: (p, name) => `${mark(p)} wins ${name}!`,
      claims: (p, cell, level) => `${mark(p)} claims the ${cell} space of Level ${level}.`,
      levelBegins: (level, holder, first) => `Level ${level} begins! ${mark(holder)} holds the center. ${mark(first)} picks first.`,
      // stalemates and draws. "18" is MOVE_CAP in game.js and is passed in as moves
      stalemate: (vanish, moves, cell, level) => `${vanish ? `No winner after ${moves} moves` : 'The board filled up with no winner'}. The ${cell} space of Level ${level} turns to stone.`,
      bigDraw: (name, first) => `${name} is a draw! Corners and center stay as a head start, edges and stone spaces clear. ${mark(first)} picks first.`,
      turfDraw: (name, first) => `Draw! Replaying ${name} with ${mark(first)} going first.`,
      // slot machine prizes
      bust: 'Bust! Better luck on the next board.',
      shield: (p) => `${mark(p)} can now keep 4 marks in this game.`,
      noTarget: 'Nothing to target, so it becomes an extra move!',
      pickClaim: 'Pick any empty space to claim',
      pickSteal: (opp) => `Pick an ${mark(opp)} mark to steal`,
      pickBomb: (opp, stone) => `Pick an ${mark(opp)} mark${stone ? ' or stone' : ''} to blow up`,
      pick: (verb) => `${verb}!`,
      // vs Computer button
      vsComputerOn: `You are ${mark('X')}, the computer plays ${mark('O')}.`,
      vsComputerOff: 'Hot-seat mode: two players, one screen.',
      // Instant Replay
      replayBusy: 'Wait for the current move to finish, then start the replay.',
      replayEmpty: 'Nothing to replay yet.',
      replayCaughtUp: 'Instant Replay caught up. Back to the live game!',
      replayStopped: 'Instant Replay stopped. Back to the live game.',
    },

    // ---------------------------------------------------------------------------------------------
    //  BIG WORDS: the words that float up over the board (Renderer.floatText). Keep them short.
    // ---------------------------------------------------------------------------------------------
    pop: {
      claimed: 'CLAIMED!',
      goAgain: 'GO AGAIN!',
      misereLoses: (p) => `${p} MADE THREE... AND LOSES!`,
      won: (level) => (level === 0 ? 'TURF WON!' : `LEVEL ${level} WON!`),
      levelBanner: (level) => `LEVEL ${level}`,                   // the big banner when a new level starts
      shift: 'SHIFT!',
      movers: { shift: 'SHIFT!', ring: 'RING SPIN!', cross: 'CROSSFIRE!' },   // when the board moves itself
      fogLifts: 'THE FOG LIFTS!',
      poof: 'POOF!',
      jackpot: 'JACKPOT!',
      stolen: 'STOLEN!',
      boom: 'BOOM!',
      stalemate: 'STALEMATE!',
      blocked: 'BLOCKED!',
      draw: 'DRAW!',
      matchPoint: 'MATCH POINT!',
      replayWins: (p) => `${p} WINS!`,
    },

    // ---------------------------------------------------------------------------------------------
    //  RULE TITLE CARD: the big card naming the game type
    // ---------------------------------------------------------------------------------------------
    ruleCard: {
      kicker: 'Turf Battle rule',
      kickerNext: 'Next Turf Battle',                // when a RULE PICK chose the next game
      spunBy: (p) => `Spun by ${mark(p)}`,
      pickedBy: (p) => `Picked by ${mark(p)}`,
      rulePick: 'Rule pick',
    },

    // ---------------------------------------------------------------------------------------------
    //  FORTUNE WHEEL (the title is [page]; spoke labels are STRINGS.rules[...].wheel)
    // ---------------------------------------------------------------------------------------------
    wheel: {
      titleLabel: 'Wheel of Games!',                // screen readers
      titleSmall: 'Wheel of',
      titleBig: 'GAMES!',                           // drawn one bouncing letter at a time (6 colours)
      canvasLabel: 'Wheel of game types',
      spin: 'SPIN!',
      spinning: '?',                                // on the hub while it spins
      who: (p, cpu, sub) => `${mark(p)} ${cpu ? '(computer) ' : ''}spins to pick the game type${sub ? ` ${sub}` : ''}`,
      forSpace: (cell, level) => `for the ${cell} space of Level ${level}`,   // the "sub" part above
      computerSpins: 'The computer spins...',
      result: (icon, name) => `${icon} ${name.toUpperCase()}!`,
    },

    // ---------------------------------------------------------------------------------------------
    //  SLOT MACHINE / MYSTERY JACKPOT (title, help pop-ups, tabs and SPIN button are [page])
    // ---------------------------------------------------------------------------------------------
    slots: {
      titleLabel: 'Mystery Jackpot!',
      titleSmall: 'Mystery',
      titleBig: 'JACKPOT!',                         // drawn one bouncing letter at a time
      howHead: '🎲 How it plays',
      howText: 'Line up <b>3, 4 or 5</b> of the same prize symbol on any payline, starting from the <b>leftmost reel</b>, to win that prize. X, O and 💎 are blanks.',
      linesHead: '〰️ 9 Paylines',
      linesText: 'A win counts on any of these lines, reading from the left.',
      close: 'Close',                               // screen-reader label on the pop-ups' × button
      symbolsTab: '🎲 Symbols',
      paylinesTab: '〰️ Paylines',
      spin: 'SPIN THE REELS!',
      who: (p) => `${mark(p)} found the mystery jackpot! Line up 3+ prize symbols from the left on any payline.`,
      computerSpins: 'The computer spins...',
      // the label under each prize symbol on the reels
      symbols: { extra: 'EXTRA TURN', bomb: 'BOMB', steal: 'STEAL', shield: '+1 MARK', rule: 'RULE PICK', jackpot: 'INSTANT WIN' },
      // the prize shown after the reels stop
      prizes: {
        extra: { name: 'EXTRA TURN', desc: 'Go again right now!' },
        steal: { name: 'STEAL', desc: "Flip one of your opponent's marks to yours." },
        bomb: { name: 'BOMB', desc: 'Blow up one opponent mark (or a stone space).' },
        shield: { name: '+1 MARK', desc: 'Keep 4 marks instead of 3 for the rest of this game.' },
        rule: { name: 'RULE PICK', desc: 'Choose the rule for the next Turf Battle.' },
        jackpot: { name: 'INSTANT WIN!', desc: '' },
        bust: { name: 'NO WIN', desc: 'No luck this time.' },
      },
      jackpotTurf: 'You win this game on the spot!',
      jackpotBig: 'Claim any empty space instantly!',
      // the paytable in the Symbols pop-up
      payJackpotTurf: 'Win this game',
      payJackpotBig: 'Claim any space',
      payRule: "Pick the next game's rule",
      // "THREE of a kind on the Middle line (+1 more line). Go again right now!"
      ofAKind: { 3: 'THREE', 4: 'FOUR', 5: 'FIVE' },
      winLine: (kind, line, more, desc) => `${kind} of a kind on the <b>${line}</b> line${more ? ` (+${more} more ${plural(more, 'line', 'lines')})` : ''}. ${desc}`,
      paylines: ['Middle', 'Top', 'Bottom', 'V', 'Peak', 'Zig-zag', 'Zag-zig', 'Step down', 'Step up'],   // same order as PAYLINES
      // INSTANT WIN drama
      teaseReel1: '<span class="tease-txt">🎆 INSTANT WIN on reel 1...</span>',
      oneMore: '<span class="tease-txt">🎆🎆 ONE MORE FOR AN INSTANT WIN...</span>',
      streak: (n) => `<span class="tease-txt">🎆 ${'🎆'.repeat(n - 1)} ${n} IN A ROW${n >= 3 ? '... INSTANT WIN!' : '...'}</span>`,
      streakPop: { 2: 'x2!', 3: 'INSTANT WIN!', 4: 'MEGA WIN!!', 5: 'ULTRA WIN!!!' },
      banner: 'INSTANT WIN!',                        // the huge title above the machine
    },

    // ---------------------------------------------------------------------------------------------
    //  RULE PICK (title is [page])
    // ---------------------------------------------------------------------------------------------
    rulePick: {
      title: '🎲 RULE PICK 🎲',
      who: (p, cpu) => `${mark(p)} ${cpu ? '(computer) ' : ''}chooses the rule for the next Turf Battle`,
      playingNow: 'playing now',                     // tag on the card of the game being played
      clickHint: 'Click a card to choose',
      cpuHint: 'The computer is choosing...',
      chosen: (icon, name) => `${icon} <b>${name}</b> it is!`,
    },

    // ---------------------------------------------------------------------------------------------
    //  GAME REVIEW and INSTANT REPLAY (static parts are [page])
    // ---------------------------------------------------------------------------------------------
    review: {
      title: '🎬 Game review',
      hint: 'Pick any earlier Level or Turf Battle. Instant Replay plays the game from that moment and keeps going until you stop it or it catches up with the live game.',
      close: 'Close',
      empty: 'No games yet. Play a Turf Battle first!',
      replayButton: '▶ Instant Replay',               // on each row of the list
      wonBy: (p) => `won by ${mark(p)}`,
      inProgress: '<i>in progress</i>',
      openingTurf: 'Opening Turf Battle',
      turfFor: (cell, level) => `Turf Battle for the ${cell} space of Level ${level}`,
      // the replay bar
      live: '● INSTANT REPLAY',
      pause: '⏸ Pause',
      play: '▶ Play',                                // replay bar, while paused
      speedTitle: 'Replay speed',
      speed: (n) => `${n}×`,
      stop: '⏹ Stop',
    },

    // ---------------------------------------------------------------------------------------------
    //  ICONS: screen-reader labels for the animated game-type icons (render.js)
    // ---------------------------------------------------------------------------------------------
    icons: {
      wild: 'shape-shifting mark',
      fog: 'fog',
      cross: 'crossfire',
    },

    // ---------------------------------------------------------------------------------------------
    //  MINI-MAP (drawn on its canvas)
    // ---------------------------------------------------------------------------------------------
    minimap: {
      earlier: 'EARLIER LEVELS',
      more: (n) => `+${n} more`,
    },

    // ---------------------------------------------------------------------------------------------
    //  DEVELOPER MODE (Shift+D). Testing tools; the panel's fixed text is [page]
    // ---------------------------------------------------------------------------------------------
    dev: {
      head: '🛠 Developer Mode',
      closeTitle: 'Turn off Developer Mode (Shift+D)',
      slotResult: 'Slot result',
      tease: 'Tease 🎆 on reel 1 (wind-up)',
      spinJackpot: '🎰 Spin the jackpot now',
      everywhere: 'Jackpot under every square',
      reveal: 'Show the jackpot square',
      wheelResult: 'Wheel result',
      spinWheel: '🎡 Spin the wheel now',
      hint: 'Shift+D or ?dev in the address turns it on. Tap the title to fold it.',
      forceOptions: [['', '🎲 Random (normal odds)'], ['extra', '⚡ Extra turn'], ['bomb', '💣 Bomb'], ['steal', '🎭 Steal'],
        ['shield', '🛡️ +1 mark'], ['rule', '🎲 Rule pick'], ['jackpot', '🎆 Instant win'], ['bust', '❌ No win']],
      wheelRandom: '🎡 Random',
      on: '🛠 Developer Mode on (Shift+D to hide)',
      off: 'Developer Mode off',
      wait: 'Wait for the current animation to finish, then spin.',
      noLiveGame: 'No live game to spin on right now.',
      previewSub: '(Developer Mode preview)',        // under the wheel's title when spun from the panel
      wheelPreview: (icon, name) => `🛠 The wheel landed on ${icon} <b>${name}</b> (preview only: no Turf Battle is running).`,
    },
  };
})();

// ---------------------------------------------------------------------------------------------
//  applyPageStrings(): fills in the page's fixed text from STRINGS. It runs once, right away.
//  In index.html:
//    data-str="group.name"          sets the element's content (HTML allowed)
//    data-str-title="group.name"    sets its tooltip (title attribute)
//    data-str-label="group.name"    sets its screen-reader label (aria-label attribute)
//    data-str-letters="group.name"  splits the text into one <i> per letter for the bouncing titles;
//                                   an optional data-colors="#f00,#0f0,..." gives each letter a colour
// ---------------------------------------------------------------------------------------------
function strAt(path) {
  const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), STRINGS);
  if (typeof v !== 'string') console.warn(`STRINGS: no text at "${path}"`);
  return typeof v === 'string' ? v : '';
}
function applyPageStrings(root = document) {
  document.title = STRINGS.page.title;
  root.querySelectorAll('[data-str]').forEach((el) => { el.innerHTML = strAt(el.dataset.str); });
  root.querySelectorAll('[data-str-title]').forEach((el) => { el.title = strAt(el.dataset.strTitle); });
  root.querySelectorAll('[data-str-label]').forEach((el) => { el.setAttribute('aria-label', strAt(el.dataset.strLabel)); });
  root.querySelectorAll('[data-str-letters]').forEach((el) => {
    const cols = (el.dataset.colors || '').split(',').filter(Boolean);
    el.innerHTML = [...strAt(el.dataset.strLetters)].map((ch, i) => `<i style="--i:${i}${cols.length ? `;--c:${cols[i % cols.length]}` : ''}">${ch}</i>`).join('');
  });
}
applyPageStrings();
