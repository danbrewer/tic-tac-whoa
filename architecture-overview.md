# Architecture overview

Infinite Tic-Tac-Toe is a browser game with an isometric 3D look. Each space on a board is won by winning a small game of tic-tac-toe, called a Turf Battle. Winning a whole board makes it the centre of a bigger board one level up, so the game can grow forever. Before each Turf Battle a Fortune Wheel picks a game type: Classic, Vanishing Marks, Gravity, Shifting Squares, Wild Square, Misère, Fog of War, Ring Spin or Crossfire. A hidden Mystery Jackpot space opens a slot machine with prizes.

This document is for a developer who is new to the codebase. It explains how the code is organised, how the pieces talk to each other, and where to look when you want to change something.

Related documents:

- [`transitions-technical-overview.md`](transitions-technical-overview.md): every timing of the automatic sequences, and where it is used.
- [`strings-reference.md`](strings-reference.md): every piece of player-facing text, and where it is used.
- [`app-analysis.md`](app-analysis.md): code health, risks, and suggested improvements.
- [`media/soundfx/README.md`](media/soundfx/README.md): the sound and voice files.

---

## Standing rules for new work

- **Player-facing text goes in [`js/strings.js`](js/strings.js).** This means every word the player sees: names, descriptions, buttons, messages, tooltips and screen-reader labels. Never type it into another script or into `index.html`. See [`strings-reference.md`](strings-reference.md).
- **Timings of automatic sequences go in [`js/timing.js`](js/timing.js).** See [`transitions-technical-overview.md`](transitions-technical-overview.md).
- When you add a string or a timing, add its row to the matching reference document.

## 1. Running the game

There is no build step, no package manager and no dependencies. The game is plain HTML, CSS and JavaScript.

- **Quickest:** open `index.html` in a browser. Everything works, except the recorded voice-overs are played as ready-made "hall" files without the live effects. Browsers don't let Web Audio process files opened from disk.
- **Full audio:** serve the folder over HTTP, for example `python3 -m http.server` in the project root, then open `http://localhost:8000`. The voice-overs then go through the live Web Audio reverb chain.

The only external resource is the fonts, loaded from Google Fonts in [`index.html`](index.html). Offline, the game falls back to system fonts.

## 2. Files at a glance

| File | Lines | What it is responsible for |
|---|---|---|
| [`index.html`](index.html) | ~170 | The page structure: the game canvas, the HUD, the overlays (wheel, slots, RULE PICK, rule card, help, review, mixer, developer panel) and the script tags. It holds no text: `data-str` attributes name the strings that fill it |
| [`style.css`](style.css) | ~1100 | All styling: HUD, overlays, the slot machine, cards, animations, phone layout |
| [`js/timing.js`](js/timing.js) | ~330 | `TIMING`: every duration and pause of the automatic sequences (see the transitions doc) |
| [`js/strings.js`](js/strings.js) | ~440 | `STRINGS`: every piece of player-facing text, plus `applyPageStrings()`, which fills the page's text on load (see the strings reference) |
| [`js/sound.js`](js/sound.js) | ~610 | `Sound`: synthesised sound effects, music, voice-over playback with reverb, the volume mixer |
| [`js/render.js`](js/render.js) | ~1430 | The isometric renderer (`Renderer`), animation helpers (`Ease`, `Tweens`, `wait`), board layout, the game-type icons |
| [`js/minimap.js`](js/minimap.js) | ~150 | `MiniMap`: the small overview of the live boards in the corner |
| [`js/crew.js`](js/crew.js) | ~230 | `Crew`: the animated SVG characters around the slot machine |
| [`js/boom.js`](js/boom.js) | ~235 | `Boom` (the big explosion when an overlay closes), `Fx` (a screen-space particle layer), `IconFly` (the icon that flies from a RULE PICK card to the title card) |
| [`js/slots.js`](js/slots.js) | ~625 | `Slots` (the Mystery Jackpot slot machine) and `RulePick` (choosing the next game type from cards) |
| [`js/wheel.js`](js/wheel.js) | ~640 | `Wheel`: the Fortune Wheel, drawn on its own canvas |
| [`js/game.js`](js/game.js) | ~1725 | The game itself: rules, the computer player (`AI`), saving and loading, the `Game` controller, the HUD, Instant Replay, the developer panel, input handling and the main loop |
| [`media/soundfx/`](media/soundfx/) | 55 files | Voice-overs (`*.mp3`) and their pre-mixed hall versions (`*-hall.mp3`) |

## 3. How the scripts fit together

### Load order and globals

There are no modules or imports. Each script is a classic `<script>` tag. Each one defines one or more global objects with `const`, such as `const Wheel = { ... }`. The order in [`index.html`](index.html) matters, because a script can only use things defined by scripts above it *at load time*:

```
timing.js → strings.js → sound.js → render.js → minimap.js → crew.js → boom.js → slots.js → wheel.js → game.js
```

`timing.js` and `strings.js` load first because they only define data, and everything else reads them. Most cross-references happen later, when functions run, so by then every global exists. For example, `Wheel.spin()` reads `RULES` (defined in `game.js`) while the game is running. The exceptions are values computed at load time. For example, `RULES` in `game.js` uses `WILD_ICON` from `render.js`, so `render.js` must load first.

`game.js` loads last. At the bottom it runs `main()`, which wires up all input and starts the main loop (section 6).

### Who calls whom

```
                     ┌──────────────┐
   input events ───► │  Game        │ ◄── the controller: owns the game state and runs every sequence
                     │  (game.js)   │
                     └──┬───┬───┬───┘
       ┌────────────────┘   │   └───────────────────────┐
       ▼                    ▼                           ▼
  Wheel.spin()        Slots.spin()               Renderer / MiniMap
  (wheel.js)          RulePick.open()            (render.js, minimap.js)
       │              (slots.js)                  draw Game.root every frame
       │                    │
       └──────┬─────────────┘
              ▼
   Sound, Fx, Boom, IconFly, Crew  ◄── effects, called by everything
   TIMING, STRINGS                 ◄── read by everything
```

- **`Game` drives everything.** The overlays (`Wheel`, `Slots`, `RulePick`) are opened by `Game` and return a `Promise` that resolves with the result, such as the chosen game type or the prize. `Game` `await`s them.
- **The renderer only reads.** `Renderer` and `MiniMap` draw `Game.root` each frame. They never change the game rules, but they do keep some animation state on the boards (fog thickness, tilt, conveyor-belt position).
- **The overlays read a little of `Game`.** They read `Game.dev` (Developer Mode settings) and `RULES`.

## 4. The data model

### Boards

Everything is built from one class, `Board` ([`js/game.js`](js/game.js), search for `class Board`). A board is a 3×3 grid plus some state:

| Field | Meaning |
|---|---|
| `level` | 0 for a Turf Battle, 1 and up for the big boards |
| `cells[9]` | The nine spaces, numbered 0–8 (see below) |
| `turn`, `starter` | Whose turn it is, and who started |
| `winner`, `winLine`, `winTime` | Set when the board is won (`'#'` means stalemate) |
| `parent`, `parentIndex` | The board above and which of its spaces this board decides |
| `pending` | On a big board: the space currently being fought over in a Turf Battle |
| `rule`, `ruled` | The Turf Battle's game type, and whether the wheel has picked it yet |
| `hist`, `moves`, `keep` | Turf Battle bookkeeping: placement order per player, move count, how many marks each player may keep |
| `jackpot` | The hidden Mystery Jackpot space (`-1` once found) |
| `shift`, `fogAt` | Game-type state: the next Shifting Squares slide, and when each Fog of War mark was placed |
| `alpha`, `born`, `geo`, `ghosts` | Drawing state: fade, when the board appeared, its layout, marks still fading out |

Each **cell** is `{ owner, t, child, record }`:

- `owner`: `'X'`, `'O'`, `'#'` (a stone space that blocks both players), `'W'` (the Wild Square mark) or `null`.
- `t`: when the mark was placed. The renderer uses it to animate the drop.
- `child`: the Turf Battle currently being played for this space.
- `record`: the finished Turf Battle that decided this space. It is kept so players can zoom in and review it.

Cells are numbered row by row, `0 1 2 / 3 4 5 / 6 7 8`. Because of the isometric view, 0 is drawn at the top of the diamond and 8 at the bottom. `CELL_NAMES` gives the on-screen names (`top`, `upper-right`, ...).

### The tree

The whole game is one tree of boards, with `Game.root` at the top:

```
Game.root  (Level 2)
 ├─ cell 4.record = the old Level 1 board (it became the centre when Level 1 was won)
 │     └─ each cell.record = the Turf Battle that decided that space
 ├─ cell 0.record = a finished Turf Battle
 ├─ cell 3.child  = the Turf Battle being played right now   ← Game.current()
 └─ ...
```

- Every space on every big board is decided by **one Turf Battle**, whatever the level.
- When the top board is won, `Game.ascend()` creates a new, bigger board and puts the old one under its centre. The tree grows at the top.
- `Game.current()` follows `pending` → `child` down from the root and returns the board being played now.
- `Game.view` is the board the player is browsing with the zoom buttons. `Game.focus()` returns the browsed board if there is one, otherwise the live one.

### Game types

`RULES` in [`js/game.js`](js/game.js) lists the nine game types. Each entry is its icon plus its text from `STRINGS.rules` (name, wheel label, one-line description, How to play text). The rules themselves live in several places, and section 9 has the checklist. In short:

- `judge()` decides wins. The Wild mark counts for both players, and Misère flips the result.
- `landingCell()` handles Gravity: a mark drops to the lowest free space in its column.
- `applyShift()`, `applyRing()` and `applyCross()` work out where marks move.
- `fogged()` says whether a space is hidden by fog.
- `Game.initRule()` sets a board up for its game type, and `Game.postMove()` runs the automatic action after each move.

## 5. The flow of a move

All game logic runs through `async` functions on `Game`. Here is what happens when a player clicks a space:

```
pointerup (main) → Game.play(k)
   ├─ Turf Battle: claim() places the mark → vanish() (Vanishing Marks) → afterClaim()
   │     afterClaim() loops up the tree:
   │       postMove()        the game type's automatic action (shift, ring, fog, wild, gravity)
   │       judgeBoard()      won? drawn?
   │       jackpot?          jackpotSpin() → Slots.spin() → applyPrize()
   │       won               celebrate → liftFog() → zoom out → claim the space on the board above → repeat one level up
   │       top board won     ascend()
   │       stalemate/draw    deadSquare() or replay()
   └─ Big board: create a new Turf Battle for the space, zoom into it, startRule()
          startRule() → Wheel.spin() (or the RULE PICK choice) → initRule() → showRuleCard()
→ finally: settled() saves the game, updates the HUD, and starts the computer's turn if needed
```

### Keeping sequences safe: `busy`, `gen` and `step()`

Sequences take seconds, and the player can start a new game in the middle of one. Three things keep that safe:

- **`Game.busy`** is `true` while a sequence runs. `play()` and the zoom controls ignore clicks while it is set.
- **`Game.gen`** is a counter that `newGame()` increases. A sequence remembers `gen` when it starts.
- **`await this.step(promise)`** waits for something (a pause, a camera move, the wheel). Then it checks `gen`. If a new game has started meanwhile, it throws `'cancelled'`, which stops the old sequence. The `catch` blocks ignore that error when `gen` has changed.

Timer callbacks that fire later (sparks at the moment of impact, for example) check `gen !== this.gen` themselves before doing anything.

When you write a new sequence step in `game.js`, use `await this.step(wait(ms))`, not a bare `setTimeout`. That way a new game cancels it.

## 6. Drawing

### The main loop

`main()` at the bottom of [`js/game.js`](js/game.js) runs `loop()` with `requestAnimationFrame`. Each frame it:

1. advances all tweens (`Tweens.update`),
2. lays out the board tree (`Game.layoutAll()` → `layout()` in `render.js`),
3. draws the frame (`Renderer.frame(now, dt, Game.root, Game.focus())`),
4. draws the minimap (`MiniMap.draw`).

### The renderer ([`js/render.js`](js/render.js))

- **Projection.** The world uses board units, with `x` and `y` across the board and `z` up. `Renderer.project(x, y, z)` turns that into screen pixels with a 2:1 isometric projection (`ISO_X`, `ISO_Y`).
- **Layout.** `layout()` gives every visible board a position and size (`b.geo`). A child board is drawn shrunk inside its parent's space, so zooming in is a camera move into that space.
- **Camera.** `Renderer.cam` holds the camera position and zoom (`L` is the log of the zoom). `viewOf(board)` gives the camera position that frames a board, and `Renderer.flyTo(view, ms)` animates the camera there.
- **Painting.** `drawBoard()` draws back to front (`ORDER`) so nearer tiles cover farther ones. It uses helpers for solid shapes: `prism()` for boxes, `ring()` for the O, `piece()` for marks. Most animation is worked out from time inside the draw call, as `(now - startTime) / duration`, so there is little animation state to manage.
- **Effects.** `Renderer.sparks/burst/ripple/floatText/fireworks/shake/kick/flash` add particles and camera effects, all drawn by the same canvas.
- **Helpers.** `Ease` holds easing curves. `Tweens.add(ms, fn, ease, delay)` animates a value and returns a Promise. `wait(ms)` is a Promise-based pause.

### Overlays

The wheel, the slot machine, RULE PICK, the rule title card, help and review are **HTML elements** in `index.html` that are shown and hidden, not drawn on the main canvas. They animate with CSS and the Web Animations API (`element.animate`). The wheel draws itself on its own `<canvas>` inside its overlay. `Fx` in `boom.js` is a separate full-screen canvas for dust, fire and smoke that must sit above the overlays.

## 7. Sound ([`js/sound.js`](js/sound.js))

- **Effects are synthesised live** with Web Audio (`tone()`, `noise()`, `roar()`, `engine()` and others), so there are no effect files to load.
- **Voice-overs** are MP3s in `media/soundfx/`. `RULE_VOICES` maps each game type to its file. `Sound.voice()` plays a voice through a "concert hall" chain: compressor, convolution reverb (`hallIR()`) and slap-back echo. Instant Win uses a bigger hall (`style: 'big'`). Each recording is level-matched by loudness when it loads.
- **Opened from disk (file://)**, Web Audio can't decode the files. `voice()` then plays the ready-made `NAME-hall.mp3` with a plain `Audio` element.
- **Two volume buses**, sound effects and voice, are set from the mixer (`Sound.setMix`).
- **Browsers block audio until the player interacts.** `Sound.ensure()` creates or resumes the audio context on the first click. On Safari it also plays a silent sample to unlock audio.

## 8. Saving, review and replay

| localStorage key | Contents |
|---|---|
| `infinite-ttt-save-v1` (`SAVE_KEY`) | The current game: `serialize(Game.root)` plus the next rule and the last winner |
| `infinite-ttt-prefs-v1` (`PREFS_KEY`) | Preferences: sound on/off, mix levels, vs-computer, best level, Developer Mode settings |
| `infinite-ttt-log-v1` (`LOG_KEY`) | Game review: up to `LOG_CAP` (600) snapshots of the whole game |

- `serialize()` and `deserialize()` turn the board tree into compact JSON and back. Field names are shortened, for example `l` for level and `c` for cells.
- `Game.save()` runs after every settled move. It also pushes a snapshot onto `Game.log` (`snapshot()`) and records where each game started in `Game.games`. The **Review** window lists those games.
- **Instant Replay** (`startReplay()`) keeps the live tree aside and swaps snapshots into `Game.root` one at a time. The renderer always draws `Game.root`, so nothing else needs to know a replay is running. Saving is switched off during a replay. `stopReplay()` puts the live tree back.

## 9. Where to change things

| I want to… | Look at |
|---|---|
| Retime an automatic sequence | [`js/timing.js`](js/timing.js) and the transitions doc |
| Change a game type's rules | `judge()`, `landingCell()`, `apply*()`, `initRule()` and `postMove()` in `game.js`; its drawing in `drawBoard()` in `render.js` |
| Change the computer's play | `AI` in `game.js`: `chooseL0` (Turf Battles), `choose` (big boards), `chooseRule` (RULE PICK), `pickTarget` (steal/bomb) |
| Change slot prizes or odds | `SLOT_SYMS`, `PRIZES`, `SLOT_ODDS`, `PAYLINES` at the top of `slots.js`; prize effects in `Game.applyPrize()` |
| Change colours of X, O, stone, wild | `PIECE_COL` and `LEVEL_HUES` at the top of `render.js` |
| Change a sound | The matching method on `Sound` (for example `Sound.place`) in `sound.js` |
| Change any text the player sees | `js/strings.js` (see the strings reference) |
| Change how the HUD is laid out | `index.html`, `style.css`, and `Game.updateHUD()` and its helpers in `game.js` |
| Test a specific game type or prize | Developer Mode: press **Shift+D**. It can force the wheel's result, force a slot prize, put a jackpot under every space, or reveal the jackpot |

### Adding a new game type: checklist

1. The text, in `STRINGS.rules` in `strings.js`: `name`, `wheel` (spoke label), `short` (one-liner) and `help` (How to play). If the board moves by itself, also add `STRINGS.hud.movesIn` and `STRINGS.pop.movers` entries. Then add the icon in `RULES` in `game.js` with `...STRINGS.rules.NAME` (use `iconText` too if the icon is SVG).
2. The rule logic: `initRule()`, `postMove()`, and `judge()` / `landingCell()` if it changes wins or placement.
3. The computer: make sure `AI.chooseRuleMove` handles it, and add a weight in `AI.chooseRule`.
4. The wheel: add an entry to `WHEEL_TYPES` in `wheel.js`, with its label taken from `STRINGS.rules.NAME.wheel`. Each type appears three times on the wheel.
5. The drawing: anything special in `drawBoard()` (`render.js`), and in `MiniMap.board()` if it hides or moves marks.
6. The voice-over (optional): add it to `RULE_VOICES` in `sound.js`, and put `NAME.mp3` and `NAME-hall.mp3` in `media/soundfx/`.
7. Styling: the `rule-NAME` colours for the RULE PICK card and the rule plate in `style.css`.
8. How to play lists the new type automatically, using `STRINGS.rules.NAME.help`. Check that any other help step that mentions game types still reads correctly (`STRINGS.help.steps`).
9. Save compatibility: if the type needs new board state, add it to `serialize()` and `deserialize()`.
