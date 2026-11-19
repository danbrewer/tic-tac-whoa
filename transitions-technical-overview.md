# Transitions: technical overview

This document is for a developer who is new to the Infinite Tic-Tac-Toe codebase and needs to adjust the pacing of the game's automatic sequences. These are the parts that play out without the players doing anything: the Fortune Wheel dropping in, spinning, announcing the result and blasting off; the slot machine appearing, spinning its reels and revealing a prize; the RULE PICK cards; the rule title card; the camera zooming between levels; the board moving marks around by itself; and Instant Replay.

For how the code is organised overall, see [`architecture-overview.md`](architecture-overview.md). For a review of code health and risks, see [`app-analysis.md`](app-analysis.md).

## The short version

**Every one of these timings lives in one file: [`js/timing.js`](js/timing.js).** It defines a single object, `TIMING`, which is grouped by sequence:

| Group | Sequence |
|---|---|
| `TIMING.wheel` | The Fortune Wheel: drop-in, spin, landing and announcement, blast-off |
| `TIMING.slots` | The Mystery Jackpot slot machine: reels, reveal, closing, the INSTANT WIN! title, prize follow-ups |
| `TIMING.boom` | The explosion when the slot machine leaves |
| `TIMING.rulePick` | The RULE PICK prize (choosing the next game type from a hand of cards) |
| `TIMING.ruleCard` | The title card that names the game type, and the icon that flies onto it |
| `TIMING.camera` | Zooming in and out between boards, winning a board, starting a new level, stalemates, draws |
| `TIMING.board` | The board moving marks by itself (Shifting Squares, Ring Spin, Crossfire, Gravity, Fog of War, Wild Square), mark drops, the computer's thinking time |
| `TIMING.matchPoint` | The MATCH POINT moment: the riser, the title slamming down, the announcer, the glow on the deciding spaces |
| `TIMING.replay` | Instant Replay pacing and camera |
| `TIMING.lab` | The pauses around Developer Mode's transition tests (not part of the game) |
| `TIMING.css` | Values handed to the stylesheet as CSS custom properties |

The bigger groups (`wheel`, `slots`, `camera` and `board`) are split into smaller groups, one for each stage of the sequence. For example, everything that paces the slot machine's INSTANT WIN drama is in `TIMING.slots.instantWin`, and the wheel's heartbeat is in `TIMING.wheel.heartbeat`. The tables below show each setting's full path.

To change a timing:

1. Open `js/timing.js` and find the setting. Each one has a comment saying what it does.
2. Change the number. **All values are milliseconds** unless the comment says otherwise. A handful are counts or multipliers, and their comments say so.
3. Save and reload the page. No build step is needed.

You should not need to edit any other file to adjust pacing.

## Epochs: every time counts from one moment

Each group of settings that belong together counts from one shared moment, its **epoch**. For example, every reel stop counts from the lever pull, and the wedge lift, announcement and auto blast-off all count from the moment the wheel stops. A setting never counts from another setting. Moving one value moves only that event; nothing after it shifts along.

- A name ending in **`At`** is a start time: how long after the epoch the thing happens (`TIMING.wheel.landing.announceAt = 800` means 800 ms after the wheel stops).
- Any other name is a **duration** (how long an animation or sound lasts) or the **gap** of a repeating beat. Beat *n* happens at `first + n × gap` after the epoch.
- A new epoch starts only at a moment that is not fixed in advance: a player's click, the end of a spin whose length is random, the moment a slot prize shows (the reels run longer or shorter depending on what they land on), or a card being chosen. Each group in `timing.js` names its epoch on an `EPOCH:` line.
- Because nothing is chained, a few values have to be kept in order by hand, such as "play continues" coming after the zoom that it waits for. Their comments in `timing.js` start with **KEEP:**.

| Group | Epoch (time 0) |
|---|---|
| `wheel.drop` | the wheel appears |
| `wheel.spin` | SPIN is pressed (the wheel is let go at `windBack`) |
| `wheel.heartbeat` | the wheel is let go (launched) |
| `wheel.landing` | the wheel stops |
| `wheel.blastOff` | blast-off starts (a click, or `autoFinish(Voiced)At`) |
| `slots.opening` | the mark lands on the jackpot space (`autoPullAt`: the machine appears) |
| `slots.reels`, `slots.instantWin` stops and texts | the lever is pulled |
| `slots.instantWin.brokenStops` | the reel that breaks the INSTANT WIN streak stops |
| `slots.result`, `slots.instantWin` glow and title | the prize shows (`revealDelay` after the last reel stops) |
| letters, `slots.result.hide`, `boom` | the machine closes (a click, or `autoFinish…At`) |
| `slots.prizes` | the STEAL, BOMB or claimed square lands on the board |
| `rulePick` | the cards appear; from `swell` on, a card is chosen |
| `ruleCard`, `board.wildIntro` | the rule title card appears |
| `matchPoint` | the rule title card lands in its plate at the top |
| `camera.turf` | the winning move (each board up the chain starts again from its own win) |
| `camera.ascend` | the new level appears |
| `camera.stalemate`, `camera.draw` | the stalemate or drawing move |
| `board.shift`, `board.ringCross`, `board.wild`, `board.fog` | the move lands (`postMove()` starts) |
| `replay` | each step is its own epoch (the gaps are divided by the replay speed) |

In the code, two helpers in `js/render.js` do the counting: `waitUntil(t0, at)` pauses an async sequence until `at` ms after the epoch `t0`, and `atTime(t0, at, fn)` schedules `fn` the same way. Inside a single callback, plain `setTimeout(fn, at)` calls made at the epoch do the same job. The tables below list every place in the code that reads each setting. Use them when you want to understand exactly what a value does, or when you want to add a new one.

> **About the line numbers.** The `file:line` references were accurate when this document was written. They drift whenever code above them changes. If a line number looks wrong, search the file for the setting's name (for example `wedgeLiftAt`). The names are unique within their top-level group, so the search finds the right spot.

## How the code reads the settings

`js/timing.js` is the first script loaded by [`index.html`](index.html#L177), so `TIMING` is available everywhere. Most code reads it directly, as in `TIMING.wheel.drop.autoSpinAt`. A few functions that read the same group many times give it a short local name at the top of the function:

| Short name | Means | Where |
|---|---|---|
| `T` | `TIMING.wheel` | `dropIn()` in `js/wheel.js` |
| `TB` | `TIMING.wheel.blastOff` | `blastOff()` in `js/wheel.js` |
| `HB` | `TIMING.wheel.heartbeat` | `spin()` in `js/wheel.js` |
| `TL` | `TIMING.wheel.landing` | `land()` inside `spin()` in `js/wheel.js` |
| `TS` | `TIMING.slots` | `spin()` and `reveal()` in `js/slots.js` |
| `TP` | `TIMING.rulePick` | `RulePick.open()` in `js/slots.js` |
| `TO` | `TIMING.slots.opening` | `jackpotSpin()` in `js/game.js` |
| `TP` | `TIMING.slots.prizes` | `applyPrize()` in `js/game.js` |
| `T` | `TIMING.board` | `postMove()` in `js/game.js`, `fogLevel()` in `js/render.js` |
| `TB` | `TIMING.board` | `wildRoulette()` in `js/game.js` |
| `TT` | `TIMING.camera.turf` | `afterClaim()` in `js/game.js` |
| `TA` | `TIMING.camera.ascend` | `ascend()` in `js/game.js` |
| `TS` | `TIMING.camera.stalemate` | `deadSquare()` in `js/game.js` |
| `TD` | `TIMING.camera.draw` | `replay()` (a draw) in `js/game.js` |
| `MPT` | `TIMING.matchPoint` | `matchPointMoment()` in `js/game.js` |
| `MP` | `TIMING.matchPoint` | the Match Point glow in `drawBoard()` in `js/render.js` |

The timings reach the code in four ways. It helps to know which one you are looking at:

- **`setTimeout(fn, ms)`** runs something once after a delay. Most "wait, then do the next thing" steps use it.
- **`await this.step(wait(ms))`** in `js/game.js` pauses an `async` game sequence. The game is "busy" during the pause, so players cannot click. `wait` is defined in `js/render.js`.
- **`Renderer.flyTo(view, ms)`** and **`Tweens.add(ms, fn, ease, delay)`** animate the camera or a value (such as a board's fade) over `ms`. Both are in `js/render.js`.
- **`element.animate(keyframes, { duration, delay })`** is the browser's Web Animations API. The DOM overlays (the wheel, the slot machine, the cards) use it.
- Some values are read **every frame** by the canvas renderer, as `(now - startTime) / duration`. Examples are the mark drop, a mark sliding, the fog fading and Gravity's board tilt. Changing them changes the animation speed directly.

Sound effects that last as long as an animation are given the animation's length, for example `Sound.wheelPull(pullT / 1000)` and `Sound.drumroll(...)`. They stay in sync when you change the timing.

---

## 1. Fortune Wheel ([`js/wheel.js`](js/wheel.js))

The wheel runs whenever a new Turf Battle needs a game type. The flow starts in `startRule()` ([`js/game.js`](js/game.js)), which calls `Wheel.spin()`.

**Timeline:**

```
EPOCH: the wheel appears (Wheel.spin() → dropIn())
     0  falls for dropFall
   620  slam (= dropFall): BOOM + dust + squash (dropSquash) + screen shake (dropShake)
   740  titleAt: title lines pop in, dropTitleStagger apart
   900  autoSpinAt: the computer presses SPIN (a player presses it whenever they like)

EPOCH: SPIN is pressed (go())
     0  wind back for windBack
   520  launch (= windBack): fast phase (spinFast + up to spinFastRandom), then the crawl (spinCrawl)

EPOCH: the wheel is launched
     0, 1200, 2400, 3400, 4400, 5200, 6000, 6600, 7200   beatsAt: heartbeats
  then every heartbeatFast, none within heartbeatStopGuard of the stop

EPOCH: the wheel stops (land())
   450  wedgeLiftAt: the winning wedge pops out, rising for wedgeLift
   800  announceAt: burst, the game's name, voice-over
   800  clickSkipAt: a click blasts off early     (voiced games: clickSkipVoicedAt, 2400)
  1300  autoFinishAt: blastOff() starts by itself (voiced games: autoFinishVoicedAt, 3000)

EPOCH: blast-off starts (blastOff())
     0  text fades (blastUiFade), rumble and fire on the ground
   200  liftoffAt: lift-off, flying for blastFly
   600  fadeAt: the overlay fades out
  1000  cleanupAt: leftover animations cleared
  1600  doneAt: the wheel is hidden, the game continues
```

### Drop-in

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.drop.dropFall` | 620 | the fall itself; the slam (BOOM, dust, squash, shake) happens when it ends, at 620 | [`js/timing.js:57`](js/timing.js#L57) | [`js/wheel.js:578`](js/wheel.js#L578) |
| `TIMING.wheel.drop.titleAt` | 740 | the first title line starts popping in (the others follow, dropTitleStagger apart) | [`js/timing.js:58`](js/timing.js#L58) | [`js/wheel.js:586`](js/wheel.js#L586) |
| `TIMING.wheel.drop.dropTitleStagger` | 90 | extra delay between one title line and the next | [`js/timing.js:59`](js/timing.js#L59) | [`js/wheel.js:586`](js/wheel.js#L586) |
| `TIMING.wheel.drop.dropTitleIn` | 450 | each title line's pop-in animation | [`js/timing.js:60`](js/timing.js#L60) | [`js/wheel.js:586`](js/wheel.js#L586) |
| `TIMING.wheel.drop.dropSquash` | 380 | the squash-and-stretch bounce at the slam | [`js/timing.js:61`](js/timing.js#L61) | [`js/wheel.js:591`](js/wheel.js#L591) |
| `TIMING.wheel.drop.dropShake` | 700 | the screen shake at the slam | [`js/timing.js:62`](js/timing.js#L62) | [`js/wheel.js:597`](js/wheel.js#L597) |
| `TIMING.wheel.drop.autoSpinAt` | 900 | computer's turn: the computer presses SPIN | [`js/timing.js:63`](js/timing.js#L63) | [`js/wheel.js:808`](js/wheel.js#L808) |

### Spin

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.spin.windBack` | 520 | the wheel is dragged backwards; it is let go (launched) when this ends | [`js/timing.js:68`](js/timing.js#L68) | [`js/wheel.js:691`](js/wheel.js#L691) |
| `TIMING.wheel.spin.spinFast` | 6800 | phase A, counted from the launch: the long slow-down from full speed ... | [`js/timing.js:69`](js/timing.js#L69) | [`js/wheel.js:699`](js/wheel.js#L699) |
| `TIMING.wheel.spin.spinFastRandom` | 400 | ... plus up to this much extra, so no two spins last exactly the same | [`js/timing.js:70`](js/timing.js#L70) | [`js/wheel.js:699`](js/wheel.js#L699) |
| `TIMING.wheel.spin.spinCrawl` | 3400 | phase B: the final crawl over the last ~3 spokes to the stop | [`js/timing.js:71`](js/timing.js#L71) | [`js/wheel.js:698`](js/wheel.js#L698) |
| `TIMING.wheel.heartbeat.beatsAt` | [0, 1200, 2400, 3400, 4400, 5200, 6000, 6600, 7200] | when each heartbeat starts: the | [`js/timing.js:76`](js/timing.js#L76) | [`js/sound-config.js:59`](js/sound-config.js#L59)<br>[`js/wheel.js:709`](js/wheel.js#L709)<br>[`js/wheel.js:738`](js/wheel.js#L738) |
| `TIMING.wheel.heartbeat.heartbeatFast` | 400 | after the last beat in the list, a beat every this often until the wheel stops | [`js/timing.js:78`](js/timing.js#L78) | [`js/wheel.js:710`](js/wheel.js#L710)<br>[`js/wheel.js:745`](js/wheel.js#L745)<br>[`js/wheel.js:746`](js/wheel.js#L746) |
| `TIMING.wheel.heartbeat.heartbeatStopGuard` | 120 | no heartbeat starts this close to the moment the wheel stops | [`js/timing.js:79`](js/timing.js#L79) | [`js/wheel.js:740`](js/wheel.js#L740) |
| `TIMING.wheel.heartbeat.heartbeatPulse` | 420 | how long each heartbeat's "throb" of the wheel lasts | [`js/timing.js:80`](js/timing.js#L80) | [`js/wheel.js:750`](js/wheel.js#L750) |
| `TIMING.wheel.heartbeat.heartbeatLubDubSlow` | 240 | gap between the "lub" and the "dub" of the slowest heartbeat ... | [`js/timing.js:81`](js/timing.js#L81) | [`js/wheel.js:747`](js/wheel.js#L747) |
| `TIMING.wheel.heartbeat.heartbeatLubDubFast` | 110 | ... and of the fastest (in between, it tightens as the heart races) | [`js/timing.js:82`](js/timing.js#L82) | [`js/wheel.js:747`](js/wheel.js#L747) |

The full spin lasts `spinFast + spinCrawl` (about 10 to 10.6 seconds), after the `windBack`. The spin's *distance* is worked out from these durations, so the wheel always lands on the chosen segment whatever values you pick. The suspense effects (glow, drum roll, jitter) start at 55% of the spin. That percentage is a ratio in `go()`, not a timing.

The heartbeat's speed-up curve is the `beatsAt` list: each number is when a beat starts, counted from the launch, so the shrinking gaps between them are the curve. After the last one, a beat comes every `heartbeatFast`. Its loudness follows the same curve: quietest at the slowest gap in the list, loudest at `heartbeatFast`. The two loudness levels are `SOUND.heartbeat` in [`js/sound-config.js`](js/sound-config.js), which holds every sound volume (see [`architecture-overview.md`](architecture-overview.md)).

### The flapper

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.flapper.flapperFreq` | 9 | Hz: how fast it springs back and forth (higher = stiffer, quicker slaps) | [`js/timing.js:88`](js/timing.js#L88) | [`js/wheel.js:379`](js/wheel.js#L379)<br>[`js/wheel.js:417`](js/wheel.js#L417) |
| `TIMING.wheel.flapper.flapperDamping` | 0.1 | 0..1: how quickly its wobble dies away (0 = forever, 1 = no overshoot at all) | [`js/timing.js:89`](js/timing.js#L89) | [`js/wheel.js:379`](js/wheel.js#L379)<br>[`js/wheel.js:417`](js/wheel.js#L417) |
| `TIMING.wheel.flapper.flapperBounce` | 0.35 | 0..1: how much of its speed it keeps when it slaps into a peg | [`js/timing.js:90`](js/timing.js#L90) | [`js/wheel.js:380`](js/wheel.js#L380)<br>[`js/wheel.js:417`](js/wheel.js#L417) |

**These three are not milliseconds.** The red flapper is a small physics simulation in `Wheel.flapperStep()`, not a timed animation. It is a damped spring that the gold pegs (one on every spoke) push aside; when a peg slips off its tip it snaps back, overshoots, and often slaps the next peg. Because the pegs drive it, its motion follows the wheel's speed automatically: quick flicks while the wheel is fast, bigger slower slaps as it crawls. The clack sound plays once per peg, at the moment that peg first strikes the flapper, so the sound always lands on the slap you see. Every clack is at the same full volume, from the first peg to the last; its loudness and pitch are `SOUND.wheelClack` in [`js/sound-config.js`](js/sound-config.js).

- `flapperFreq` (Hz) is the spring's stiffness. Higher makes it snap back faster.
- `flapperDamping` (0 to 1) is how quickly its wobble dies away. Lower wobbles longer.
- `flapperBounce` (0 to 1) is how much speed it keeps when it hits a peg.

The sizes of the pegs and flapper are in `Wheel.PEG` and `Wheel.FLAP` in [`js/wheel.js`](js/wheel.js). `spin()` works out where a peg lets go of the flapper from those sizes (`Wheel.releaseFrac()`). The wedge under the pointer only changes once the flapper has flipped over, at that point, not when the spoke passes the pivot. Most spins stop after that point, so the flapper comes to rest standing free. A share of spins (`Wheel.NEAR_MISS`, 12%) is a near miss: the wheel stops just before the next peg lets go, so the flapper is left bent against it and the result stays on the wedge it never left.

### Landing and announcement

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.landing.wedgeLiftAt` | 450 | the winning wedge pops out ... | [`js/timing.js:95`](js/timing.js#L95) | [`js/wheel.js:789`](js/wheel.js#L789) |
| `TIMING.wheel.landing.wedgeLift` | 800 | ... rising up and flipping to face the player for this long | [`js/timing.js:96`](js/timing.js#L96) | [`js/wheel.js:785`](js/wheel.js#L785) |
| `TIMING.wheel.landing.announceAt` | 800 | big burst, the game's name, and its voice-over | [`js/timing.js:97`](js/timing.js#L97) | [`js/wheel.js:802`](js/wheel.js#L802) |
| `TIMING.wheel.landing.clickSkipVoicedAt` | 2400 | from here a click blasts off early (game has a voice-over): 1.6 s into the | [`js/timing.js:98`](js/timing.js#L98) | [`js/wheel.js:803`](js/wheel.js#L803) |
| `TIMING.wheel.landing.clickSkipAt` | 800 | the same, for a game without a voice-over (KEEP: not before announceAt) | [`js/timing.js:100`](js/timing.js#L100) | [`js/wheel.js:803`](js/wheel.js#L803) |
| `TIMING.wheel.landing.autoFinishVoicedAt` | 3000 | blast off on its own (game has a voice-over) | [`js/timing.js:101`](js/timing.js#L101) | [`js/wheel.js:804`](js/wheel.js#L804) |
| `TIMING.wheel.landing.autoFinishAt` | 1300 | the same, for a game without a voice-over | [`js/timing.js:102`](js/timing.js#L102) | [`js/wheel.js:804`](js/wheel.js#L804) |

The "Voiced" values apply to game types that have a voice-over MP3 (see `RULE_VOICES` in `js/sound.js`). Keep `clickSkipVoicedAt` before `autoFinishVoicedAt`, or the click never gets a chance. (Until November 2026 the click was counted from the announcement, which put it at 3400, after the 3000 auto blast-off; it is now 2400.) The voice-overs are 3 to 5 seconds long and start at `announceAt`, so they carry on over the blast-off and the rule title card.

### Blast-off

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.blastOff.blastUiFade` | 300 | the title and result text fade away (from the epoch) | [`js/timing.js:107`](js/timing.js#L107) | [`js/wheel.js:605`](js/wheel.js#L605) |
| `TIMING.wheel.blastOff.liftoffAt` | 200 | rumbling and fire on the ground until lift-off, here | [`js/timing.js:108`](js/timing.js#L108) | [`js/wheel.js:606`](js/wheel.js#L606)<br>[`js/wheel.js:633`](js/wheel.js#L633) |
| `TIMING.wheel.blastOff.blastFly` | 400 | the flight up and off the screen, from lift-off | [`js/timing.js:109`](js/timing.js#L109) | [`js/wheel.js:606`](js/wheel.js#L606) |
| `TIMING.wheel.blastOff.fadeAt` | 600 | the overlay starts fading out (the flight is over at liftoffAt + blastFly) | [`js/timing.js:110`](js/timing.js#L110) | [`js/wheel.js:623`](js/wheel.js#L623)<br>[`js/wheel.js:634`](js/wheel.js#L634) |
| `TIMING.wheel.blastOff.cleanupAt` | 1000 | leftover animations are cleared | [`js/timing.js:111`](js/timing.js#L111) | [`js/wheel.js:635`](js/wheel.js#L635) |
| `TIMING.wheel.blastOff.doneAt` | 1600 | the wheel is hidden and the game continues. The fade itself is --t-overlay-fade | [`js/timing.js:112`](js/timing.js#L112) | [`js/wheel.js:636`](js/wheel.js#L636) |

The rule title card appears at `doneAt`. The overlay's own fade is `--t-overlay-fade` (250 ms), so the board shows on its own for a moment before the card: `doneAt` is deliberately later than `fadeAt` + 250.

---

## 2. Slot machine / Mystery Jackpot ([`js/slots.js`](js/slots.js))

The machine opens when a mark lands on the hidden jackpot space. `jackpotSpin()` in `js/game.js` starts it.

**Timeline:**

```
EPOCH: the mark lands on the jackpot (jackpotSpin() in game.js)
   300  jackpotAt: "JACKPOT!" + coins
  1200  machineAt: Slots.spin(), the machine fades in
        (the computer pulls the lever autoPullAt = 900 after the machine appears)

EPOCH: the lever is pulled
        reels stop at reelStops      1500, 1900, 2300, 2500, 2900
        likely win: teaserStops      1500, 1900, 2750, 3400, 4250
        INSTANT WIN on reel 1: windupStops 2000, 4100, 6200, 8300, 10400 (see below)
        the prize shows revealDelay (200) after the last reel stops

EPOCH: the prize shows (reveal())
     0  prize text, win lines, INSTANT WIN! title if any
   400  clickSkipAt: a click closes the machine
  2200  autoFinishBustAt / 3600 autoFinishPrizeAt / 5600 instantWin.autoFinishJackpotAt: closes by itself

EPOCH: the machine closes (a click or autoFinish…At)
     0  Boom.run() explosion, the INSTANT WIN! letters blow apart, the overlay fades
   250  hide: the machine is hidden and the prize is applied (applyPrize in game.js)
```

A prize needs the same prize symbol on **all 5 reels** along one payline. Before this, 3 or 4 in a row from the left also paid, but then the last reels meant nothing; now the suspense lasts until the final reel stops. The outcome is still decided before the reels spin (`SLOT_ODDS` in `js/slots.js`), and `Slots.makeGrid()` then builds a grid that shows it, so requiring 5 did not change how often each prize comes up. When there is no prize, the grid often shows a near miss: 2 to 4 matching prize symbols lead a line and the next one lands one row off.

The slot machine's settings are split into stages: `TIMING.slots.opening`, `.reels`, `.instantWin`, `.result` and `.prizes`.

### Opening (`TIMING.slots.opening`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.opening.jackpotAt` | 300 | game.js: "JACKPOT!" (coins, flash, shake) | [`js/timing.js:140`](js/timing.js#L140) | [`js/game.js:1472`](js/game.js#L1472) |
| `TIMING.slots.opening.machineAt` | 1200 | game.js: the slot machine appears | [`js/timing.js:141`](js/timing.js#L141) | [`js/game.js:1480`](js/game.js#L1480) |
| `TIMING.slots.opening.autoPullAt` | 900 | computer's turn: counted from when the MACHINE APPEARS, the computer pulls the lever | [`js/timing.js:142`](js/timing.js#L142) | [`js/slots.js:265`](js/slots.js#L265) |

### The reels (`TIMING.slots.reels`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.reels.reelStops` | [1500, 1900, 2300, 2500, 2900] | when each reel stops | [`js/timing.js:147`](js/timing.js#L147) | [`js/slots.js:194`](js/slots.js#L194) |
| `TIMING.slots.reels.teaserStops` | [1500, 1900, 2750, 3400, 4250] | the same when reels 1+2 already lead a line (a likely win): | [`js/timing.js:148`](js/timing.js#L148) | [`js/slots.js:194`](js/slots.js#L194) |
| `TIMING.slots.reels.spinSpeed` | 35 | how fast the reels spin, in SYMBOLS PER SECOND (higher = faster); every reel | [`js/timing.js:150`](js/timing.js#L150) | [`js/slots.js:223`](js/slots.js#L223) |
| `TIMING.slots.reels.reelSlowdown` | 1200 | the last part of each reel's spin, where it visibly slows from spinSpeed to a stop | [`js/timing.js:152`](js/timing.js#L152) | [`js/slots.js:222`](js/slots.js#L222) |
| `TIMING.slots.reels.tickGapStart` | 50 | the reel ticking sound, from the pull: gap between ticks at the start ... | [`js/timing.js:153`](js/timing.js#L153) | [`js/slots.js:260`](js/slots.js#L260) |
| `TIMING.slots.reels.tickGapGrow` | 150 | ... growing by up to this much as the reels slow down | [`js/timing.js:154`](js/timing.js#L154) | [`js/slots.js:260`](js/slots.js#L260) |
| `TIMING.slots.reels.tickStopGuard` | 120 | the ticking stops this long before the last reel stops | [`js/timing.js:155`](js/timing.js#L155) | [`js/slots.js:260`](js/slots.js#L260) |

**Reel speed.** `spinSpeed` is how fast the reels spin, in symbols per second. Every reel spins at that speed until the last `reelSlowdown` ms of its spin, then visibly slows down and crawls to a stop (with a tiny bounce). When four INSTANT WINs are lined up, the deciding last reel uses the longer `TIMING.slots.instantWin.suspenseSlowdown` instead. Each stop plays a door-closing sound (`Sound.reelStop()`); the last reel of a real INSTANT WIN plays a heavy, echoing door slam instead (`Sound.reelStopBig()`). `Slots.spin()` makes each reel's strip exactly long enough for its stop time, so a reel that stops later passes more symbols instead of spinning more slowly. You can change `spinSpeed` and the stop times independently. The slowdown curve is `STOP_EASE` at the top of `js/slots.js`; if you change it, change `STOP_EASE_SLOPE` with it, so the slowdown starts at exactly the spinning speed.

### INSTANT WIN (`TIMING.slots.instantWin`)

An INSTANT WIN symbol on reel 1 winds up the other reels: they stop at `windupStops`, and every reel that continues the run locks in with a flash (`lockFlash`) and a pop label (x2!, x3!!, x4!!!, INSTANT WIN!). Once the run is broken, the reel that broke it starts a new epoch: the remaining reels stop at `brokenStops` after it. If reels 1 to 4 all line up, the music drops out, a drum roll builds, "ONE MORE FOR AN INSTANT WIN..." appears at `oneMoreTextAt`, and reel 5 keeps spinning until `suspenseStop` before it decides the win, slowing down over the last `suspenseSlowdown` of it. The rest of the group is the INSTANT WIN! title over the machine and its explosions.

```
EPOCH: the lever is pulled
   2000  reel 1 stops (windupStops[0])
   2030  teaseTextAt: "INSTANT WIN on reel 1..."
   4100, 6200, 8300   reels 2, 3, 4 (windupStops)
   8950  oneMoreTextAt: 4 in a row: music drops out, drum roll, "ONE MORE..."
  10400  reel 5 (windupStops[4]), or 11500 (suspenseStop) when 4 are lined up

EPOCH: the reel that breaks the run stops
    380, 760, 1140   brokenStops: the reels after it

EPOCH: the prize shows
     0  INSTANT WIN: glow until instantGlow, title + explosions
  5600  autoFinishJackpotAt: closes by itself
```

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.instantWin.windupStops` | [2000, 4100, 6200, 8300, 10400] | INSTANT WIN on reel 1: when each reel stops | [`js/timing.js:161`](js/timing.js#L161) | [`js/slots.js:196`](js/slots.js#L196) |
| `TIMING.slots.instantWin.suspenseStop` | 11500 | four INSTANT WINs lined up: when the deciding fifth reel stops instead | [`js/timing.js:162`](js/timing.js#L162) | [`js/slots.js:197`](js/slots.js#L197) |
| `TIMING.slots.instantWin.suspenseSlowdown` | 2800 | ... and the last part of that reel's spin, where it slowly crawls to a stop (see reels.reelSlowdown) | [`js/timing.js:163`](js/timing.js#L163) | [`js/slots.js:222`](js/slots.js#L222) |
| `TIMING.slots.instantWin.teaseTextAt` | 2030 | "INSTANT WIN on reel 1..." appears (KEEP: just after windupStops[0]) | [`js/timing.js:164`](js/timing.js#L164) | [`js/slots.js:215`](js/slots.js#L215) |
| `TIMING.slots.instantWin.oneMoreTextAt` | 8950 | four lined up: "ONE MORE FOR AN INSTANT WIN..." appears (KEEP: after windupStops[3]) | [`js/timing.js:165`](js/timing.js#L165) | [`js/slots.js:257`](js/slots.js#L257) |
| `TIMING.slots.instantWin.brokenStops` | [380, 760, 1140] | the reels after it stop quickly, at these times (as many as are left) | [`js/timing.js:167`](js/timing.js#L167) | [`js/slots.js:201`](js/slots.js#L201) |
| `TIMING.slots.instantWin.lockFlash` | 600 | the white flash each time an INSTANT WIN locks into place on a reel | [`js/timing.js:169`](js/timing.js#L169) | [`js/slots.js:366`](js/slots.js#L366) |
| `TIMING.slots.instantWin.autoFinishJackpotAt` | 5600 | the machine closes on its own after an INSTANT WIN | [`js/timing.js:171`](js/timing.js#L171) | [`js/slots.js:312`](js/slots.js#L312) |
| `TIMING.slots.instantWin.instantGlow` | 5200 | how long the machine glows after an INSTANT WIN | [`js/timing.js:172`](js/timing.js#L172) | [`js/slots.js:292`](js/slots.js#L292) |
| `TIMING.slots.instantWin.bannerBoomFirst` | 150 | the first explosion around the title ... | [`js/timing.js:173`](js/timing.js#L173) | [`js/slots.js:391`](js/slots.js#L391) |
| `TIMING.slots.instantWin.bannerBoomGap` | 260 | ... and the gap between those explosions (6 of them) | [`js/timing.js:174`](js/timing.js#L174) | [`js/slots.js:391`](js/slots.js#L391) |
| `TIMING.slots.instantWin.bannerCellBurstGap` | 90 | gap between the bursts on each winning symbol (the first at the reveal) | [`js/timing.js:175`](js/timing.js#L175) | [`js/slots.js:396`](js/slots.js#L396) |
| `TIMING.slots.instantWin.bannerFailsafeAt` | 9000 | the title blows itself up if the machine is still open | [`js/timing.js:176`](js/timing.js#L176) | [`js/slots.js:398`](js/slots.js#L398) |
| `TIMING.slots.instantWin.letterGap` | 45 | the title blowing apart: letter n starts flying at n * letterGap ... | [`js/timing.js:178`](js/timing.js#L178) | [`js/slots.js:412`](js/slots.js#L412)<br>[`js/slots.js:434`](js/slots.js#L434) |
| `TIMING.slots.instantWin.letterFly` | 720 | ... each letter flying away for this long ... | [`js/timing.js:179`](js/timing.js#L179) | [`js/slots.js:421`](js/slots.js#L421) |
| `TIMING.slots.instantWin.letterBoom` | 130 | ... and its little explosion at n * letterGap + letterBoom | [`js/timing.js:180`](js/timing.js#L180) | [`js/slots.js:431`](js/slots.js#L431) |
| `TIMING.slots.instantWin.letterCleanup` | 1500 | the leftovers are removed at (number of letters) * letterGap + letterCleanup | [`js/timing.js:181`](js/timing.js#L181) | [`js/slots.js:434`](js/slots.js#L434) |

### The result and closing (`TIMING.slots.result`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.result.revealDelay` | 200 | the prize shows this long after the LAST reel stops: this moment is the epoch | [`js/timing.js:186`](js/timing.js#L186) | [`js/slots.js:262`](js/slots.js#L262) |
| `TIMING.slots.result.clickSkipAt` | 400 | from here a click closes the machine | [`js/timing.js:188`](js/timing.js#L188) | [`js/slots.js:311`](js/slots.js#L311) |
| `TIMING.slots.result.autoFinishBustAt` | 2200 | the machine closes on its own: no prize | [`js/timing.js:189`](js/timing.js#L189) | [`js/slots.js:312`](js/slots.js#L312) |
| `TIMING.slots.result.autoFinishPrizeAt` | 3600 | ... any other prize (INSTANT WIN: instantWin.autoFinishJackpotAt) | [`js/timing.js:190`](js/timing.js#L190) | [`js/slots.js:312`](js/slots.js#L312) |
| `TIMING.slots.result.hide` | 250 | EPOCH: the machine closes. The overlay's fade-out before the game continues | [`js/timing.js:191`](js/timing.js#L191) | [`js/slots.js:307`](js/slots.js#L307) |

### What happens after the prize (`TIMING.slots.prizes`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.prizes.prizeSettleAt` | 700 | play continues | [`js/timing.js:198`](js/timing.js#L198) | [`js/game.js:1553`](js/game.js#L1553) |
| `TIMING.slots.prizes.gravityDropAt` | 450 | Gravity, after a BOMB or a claimed square: the marks above a gap fall in | [`js/timing.js:199`](js/timing.js#L199) | [`js/game.js:1550`](js/game.js#L1550) |
| `TIMING.slots.prizes.gravitySettleAt` | 1600 | ... and play continues (KEEP: after gravityDropAt + board.shift.slide) | [`js/timing.js:200`](js/timing.js#L200) | [`js/game.js:1551`](js/game.js#L1551) |
| `TIMING.slots.prizes.gravityNoFallAt` | 1150 | ... or here, if nothing had to fall | [`js/timing.js:201`](js/timing.js#L201) | [`js/game.js:1551`](js/game.js#L1551) |
| `TIMING.slots.prizes.cpuTargetDelay` | 1000 | computer's turn: it picks which mark to steal or bomb | [`js/timing.js:203`](js/timing.js#L203) | [`js/game.js:1564`](js/game.js#L1564) |
| `TIMING.slots.prizes.rulePickSettle` | 3000 | play continues (the card is on screen until then) | [`js/timing.js:205`](js/timing.js#L205) | [`js/game.js:1506`](js/game.js#L1506) |

Counted from the prize landing on the board, play continues at `prizeSettleAt`. In a Gravity game, a BOMB leaves a gap, and a claimed square can be left hanging in mid-air. At `gravityDropAt`, `Game.applyPrize()` calls `Game.settleGravity()`, which slides every mark above a gap down into it, and play continues at `gravitySettleAt` (or `gravityNoFallAt` if nothing had to fall).

### The explosion when the machine leaves ([`js/boom.js`](js/boom.js))

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.boom.blastFirst` | 140 | the first ring blast after the centre one ... | [`js/timing.js:217`](js/timing.js#L217) | [`js/boom.js:22`](js/boom.js#L22) |
| `TIMING.boom.blastGap` | 95 | ... and the gap between the ring blasts (7 of them, plus up to 60 random each) | [`js/timing.js:218`](js/timing.js#L218) | [`js/boom.js:22`](js/boom.js#L22) |
| `TIMING.boom.shake` | 900 | the screen shake | [`js/timing.js:219`](js/timing.js#L219) | [`js/boom.js:48`](js/boom.js#L48) |

---

## 3. RULE PICK ([`js/slots.js`](js/slots.js), `RulePick`)

RULE PICK is a slot machine prize. The player picks the game type for the next Turf Battle from a hand of cards. The chosen card shatters and the others are blown away. Then the title card shows the choice (section 4).

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.rulePick.cardFlipFirst` | 250 | the deal: the first card's flip sound ... | [`js/timing.js:232`](js/timing.js#L232) | [`js/slots.js:555`](js/slots.js#L555) |
| `TIMING.rulePick.cardFlipGap` | 110 | ... and the gap between cards | [`js/timing.js:233`](js/timing.js#L233) | [`js/slots.js:555`](js/slots.js#L555) |
| `TIMING.rulePick.cpuStart` | 1100 | computer's turn: the highlight starts running over the cards | [`js/timing.js:234`](js/timing.js#L234) | [`js/slots.js:618`](js/slots.js#L618) |
| `TIMING.rulePick.cpuHopBase` | 70 | the highlight's first hop ... | [`js/timing.js:235`](js/timing.js#L235) | [`js/slots.js:624`](js/slots.js#L624) |
| `TIMING.rulePick.cpuHopGrow` | 1.6 | ... each hop n lasts cpuHopBase + n * n * cpuHopGrow (NOT ms: a multiplier) | [`js/timing.js:236`](js/timing.js#L236) | [`js/slots.js:624`](js/slots.js#L624) |
| `TIMING.rulePick.cpuChoose` | 350 | after the highlight stops, the card is chosen (the hop count depends on the pick) | [`js/timing.js:237`](js/timing.js#L237) | [`js/slots.js:622`](js/slots.js#L622) |
| `TIMING.rulePick.swell` | 420 | the chosen card swells and trembles ... | [`js/timing.js:239`](js/timing.js#L239) | [`js/slots.js:575`](js/slots.js#L575) |
| `TIMING.rulePick.shatterAt` | 420 | ... and shatters here (KEEP: equal to swell, or the swell freezes before the blast) | [`js/timing.js:240`](js/timing.js#L240) | [`js/slots.js:606`](js/slots.js#L606) |
| `TIMING.rulePick.shake` | 420 | the panel shake at the shatter | [`js/timing.js:241`](js/timing.js#L241) | [`js/slots.js:590`](js/slots.js#L590) |
| `TIMING.rulePick.cardsFly` | 1000 | the other cards being blown off the screen (plus up to 250 random) | [`js/timing.js:242`](js/timing.js#L242) | [`js/slots.js:604`](js/slots.js#L604) |
| `TIMING.rulePick.fadeAt` | 2000 | the overlay starts fading away | [`js/timing.js:243`](js/timing.js#L243) | [`js/slots.js:607`](js/slots.js#L607) |
| `TIMING.rulePick.doneAt` | 2260 | the overlay is gone and the game continues (fadeAt + about --t-overlay-fade) | [`js/timing.js:244`](js/timing.js#L244) | [`js/slots.js:608`](js/slots.js#L608) |

Counted from the deal, the computer's highlight starts at `cpuStart`, and hop *n* lasts `cpuHopBase + n × n × cpuHopGrow`; each hop is scheduled from the deal, so the hops cannot drift. The card is chosen `cpuChoose` after the last hop. The number of hops depends on which card the computer picks, so the choice starts a new epoch: the card swells for `swell`, shatters at `shatterAt`, the overlay fades at `fadeAt` and is gone at `doneAt`. To make the computer decide faster, lower `cpuHopGrow` first.

---

## 4. Rule title card ([`js/game.js`](js/game.js) `showRuleCard()`, [`js/boom.js`](js/boom.js) `IconFly`)

The big card in the middle of the screen names the game type. Everything here counts from the card appearing: at `flyAt` it shrinks and flies up into the plate at the top of the screen, landing at `flyAt + fly` (2920).

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.ruleCard.flyAt` | 2200 | the card leaves the middle and flies up into the plate at the top of the screen ... | [`js/timing.js:258`](js/timing.js#L258) | [`js/game.js:693`](js/game.js#L693)<br>[`js/game.js:744`](js/game.js#L744)<br>[`js/game.js:1116`](js/game.js#L1116)<br>[`js/game.js:1173`](js/game.js#L1173) |
| `TIMING.ruleCard.fly` | 720 | ... taking this long (it lands at flyAt + fly) | [`js/timing.js:259`](js/timing.js#L259) | [`js/game.js:693`](js/game.js#L693)<br>[`js/game.js:742`](js/game.js#L742)<br>[`js/game.js:1116`](js/game.js#L1116)<br>[`js/game.js:1121`](js/game.js#L1121)<br>[`js/game.js:1173`](js/game.js#L1173)<br>[`js/game.js:1655`](js/game.js#L1655) |
| `TIMING.ruleCard.failsafeAt` | 4200 | the card is removed no matter what | [`js/timing.js:260`](js/timing.js#L260) | [`js/game.js:746`](js/game.js#L746) |
| `TIMING.ruleCard.playAt` | 900 | the Turf Battle can be played (later with a Wild Square intro: when it ends) | [`js/timing.js:261`](js/timing.js#L261) | [`js/game.js:417`](js/game.js#L417)<br>[`js/game.js:1173`](js/game.js#L1173) |
| `TIMING.ruleCard.iconLandAt` | 470 | RULE PICK: the chosen card's icon flies onto the title card ... | [`js/timing.js:262`](js/timing.js#L262) | [`js/boom.js:212`](js/boom.js#L212) |
| `TIMING.ruleCard.iconLand` | 560 | ... taking this long | [`js/timing.js:263`](js/timing.js#L263) | [`js/boom.js:226`](js/boom.js#L226) |
| `TIMING.ruleCard.iconBounce` | 380 | the card's icon bouncing when the flying icon lands on it | [`js/timing.js:264`](js/timing.js#L264) | [`js/boom.js:228`](js/boom.js#L228) |
| `TIMING.ruleCard.iconLift` | 900 | EPOCH: a RULE PICK card is chosen. Its icon leaping to centre stage ... | [`js/timing.js:265`](js/timing.js#L265) | [`js/boom.js:203`](js/boom.js#L203) |
| `TIMING.ruleCard.iconIdle` | 520 | ... then bobbing there (one swing) until iconLandAt | [`js/timing.js:266`](js/timing.js#L266) | [`js/boom.js:208`](js/boom.js#L208) |

`playAt` is when `startRule()` lets the Turf Battle be played. For Wild Square the wait is longer: it lasts until the wild mark has landed (see `wildIntroStart` in section 6).

---

## 5. Camera moves between boards ([`js/game.js`](js/game.js))

The camera itself is `Renderer.flyTo()` in [`js/render.js`](js/render.js). It zooms around a fixed point so the move feels like a real zoom. These settings choose how long each move takes and how long the game pauses around it.

### Into a Turf Battle, and back out after a win

```
EPOCH: the winning move
   120 + n × 110   the winning line's sparkles
  1400  zoomOutAt: zoom out to the board above, for zoomOutToParent
  1650  wonFadeAt: the won board fades, for wonFade
  2600  the zoom ends: the winner's mark drops into the board above
  3400  continueAt: play continues (or the next board up, if this win won it, starts its own epoch)
```

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.turf.zoomIntoChild` | 1200 | zoom down into its new Turf Battle (or lower level) | [`js/timing.js:284`](js/timing.js#L284) | [`js/game.js:502`](js/game.js#L502) |
| `TIMING.camera.turf.childFadeIn` | 700 | the new board fading in during that zoom | [`js/timing.js:285`](js/timing.js#L285) | [`js/game.js:501`](js/game.js#L501) |
| `TIMING.camera.turf.winLineFirst` | 120 | the winning line's sparkles: the first space ... | [`js/timing.js:287`](js/timing.js#L287) | [`js/game.js:594`](js/game.js#L594) |
| `TIMING.camera.turf.winLineGap` | 110 | ... and the gap between spaces | [`js/timing.js:288`](js/timing.js#L288) | [`js/game.js:594`](js/game.js#L594) |
| `TIMING.camera.turf.zoomOutAt` | 1400 | celebrate until here, then zoom out to the board above ... | [`js/timing.js:289`](js/timing.js#L289) | [`js/game.js:598`](js/game.js#L598) |
| `TIMING.camera.turf.zoomOutToParent` | 1200 | ... taking this long; the winner's mark drops in when it ends (at 2600) | [`js/timing.js:290`](js/timing.js#L290) | [`js/game.js:606`](js/game.js#L606)<br>[`js/game.js:1589`](js/game.js#L1589) |
| `TIMING.camera.turf.wonFadeAt` | 1650 | the won board starts fading away ... | [`js/timing.js:291`](js/timing.js#L291) | [`js/game.js:605`](js/game.js#L605) |
| `TIMING.camera.turf.wonFade` | 800 | ... over this long | [`js/timing.js:292`](js/timing.js#L292) | [`js/game.js:605`](js/game.js#L605)<br>[`js/game.js:1588`](js/game.js#L1588) |
| `TIMING.camera.turf.continueAt` | 3400 | play continues (KEEP: after zoomOutAt + zoomOutToParent) | [`js/timing.js:293`](js/timing.js#L293) | [`js/game.js:612`](js/game.js#L612) |

### A whole level is won (moving up to a new level)

Counted from the new level appearing: the new board fades in from `ascendNewFadeAt`, the old one fades out from `ascendOldFadeAt`, the centre mark drops in when `ascendZoom` ends (1900), the ripple runs at `ascendWaveAt` and play continues at `ascendContinueAt`.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.ascend.ascendZoom` | 1900 | the zoom out to the new level; the centre mark drops in when it ends | [`js/timing.js:299`](js/timing.js#L299) | [`js/game.js:643`](js/game.js#L643) |
| `TIMING.camera.ascend.ascendNewFadeAt` | 200 | the new board starts fading in ... | [`js/timing.js:300`](js/timing.js#L300) | [`js/game.js:641`](js/game.js#L641) |
| `TIMING.camera.ascend.ascendNewFadeIn` | 1000 | ... over this long | [`js/timing.js:301`](js/timing.js#L301) | [`js/game.js:641`](js/game.js#L641) |
| `TIMING.camera.ascend.ascendOldFadeAt` | 900 | the old board starts fading out ... | [`js/timing.js:302`](js/timing.js#L302) | [`js/game.js:642`](js/game.js#L642) |
| `TIMING.camera.ascend.ascendOldFade` | 900 | ... over this long | [`js/timing.js:303`](js/timing.js#L303) | [`js/game.js:642`](js/game.js#L642) |
| `TIMING.camera.ascend.ascendWaveAt` | 2150 | the ripple across the new board (KEEP: after ascendZoom) | [`js/timing.js:304`](js/timing.js#L304) | [`js/game.js:649`](js/game.js#L649) |
| `TIMING.camera.ascend.ascendContinueAt` | 2600 | play continues (KEEP: after ascendZoom) | [`js/timing.js:305`](js/timing.js#L305) | [`js/game.js:651`](js/game.js#L651) |

The "ROUND N" banner that appears at the same time is timed in CSS (see "Timings that live in CSS" below).

### Stalemates and draws

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.stalemate.zoomOutAt` | 1300 | "STALEMATE!" until here, then zoom out; the stone lands when the zoom ends (2500) | [`js/timing.js:311`](js/timing.js#L311) | [`js/game.js:1586`](js/game.js#L1586) |
| `TIMING.camera.stalemate.fadeAt` | 1550 | the board starts fading away | [`js/timing.js:312`](js/timing.js#L312) | [`js/game.js:1588`](js/game.js#L1588) |
| `TIMING.camera.stalemate.continueAt` | 3400 | play continues (KEEP: after zoomOutAt + turf.zoomOutToParent) | [`js/timing.js:313`](js/timing.js#L313) | [`js/game.js:1606`](js/game.js#L1606) |
| `TIMING.camera.draw.clearAt` | 1500 | "DRAW!" until here, then the board clears | [`js/timing.js:318`](js/timing.js#L318) | [`js/game.js:1618`](js/game.js#L1618) |
| `TIMING.camera.draw.continueAt` | 2100 | play (or the wheel) continues | [`js/timing.js:319`](js/timing.js#L319) | [`js/game.js:1634`](js/game.js#L1634) |

Counted from the stalemate move: the zoom out starts at `stalemate.zoomOutAt` and lasts `turf.zoomOutToParent`, the board fades from `stalemate.fadeAt` for `turf.wonFade`, the stone lands when the zoom ends (2500), and play continues at `stalemate.continueAt`. A draw clears the board at `draw.clearAt` and play continues at `draw.continueAt`.

### Browsing with the zoom buttons and minimap, and Gravity

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.browse.browseZoom` | 1000 | flying to the board you clicked | [`js/timing.js:324`](js/timing.js#L324) | [`js/game.js:1695`](js/game.js#L1695) |
| `TIMING.camera.browse.browseFade` | 650 | finished boards fading in or out as you browse ... | [`js/timing.js:325`](js/timing.js#L325) | [`js/game.js:1685`](js/game.js#L1685)<br>[`js/game.js:1687`](js/game.js#L1687) |
| `TIMING.camera.browse.browseFadeDelay` | 250 | ... fading out starts here | [`js/timing.js:326`](js/timing.js#L326) | [`js/game.js:1687`](js/game.js#L1687) |
| `TIMING.camera.gravityTilt` | 1300 | Gravity: the camera re-framing while the board tilts upright | [`js/timing.js:329`](js/timing.js#L329) | [`js/render.js:933`](js/render.js#L933) |

---

## 6. The board's own moves ([`js/game.js`](js/game.js), drawn in [`js/render.js`](js/render.js))

After each move, `postMove()` in `js/game.js` runs the active game type's automatic action. Counted from the move landing, the `...At` values say when the action happens and when play continues, so players can see what happened.

### Every game

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.cpuMoveDelay` | 750 | EPOCH: the computer's turn starts. "Thinking" time before it plays | [`js/timing.js:351`](js/timing.js#L351) | [`js/game.js:1725`](js/game.js#L1725) |
| `TIMING.board.toast` | 3200 | EPOCH: a message appears. How long it stays up | [`js/timing.js:352`](js/timing.js#L352) | [`js/game.js:383`](js/game.js#L383)<br>[`js/game.js:444`](js/game.js#L444)<br>[`js/game.js:500`](js/game.js#L500)<br>[`js/game.js:547`](js/game.js#L547)<br>[`js/game.js:559`](js/game.js#L559)<br>[`js/game.js:596`](js/game.js#L596)<br>[`js/game.js:611`](js/game.js#L611)<br>[`js/game.js:650`](js/game.js#L650)<br>[`js/game.js:905`](js/game.js#L905)<br>[`js/game.js:906`](js/game.js#L906)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:938`](js/game.js#L938)<br>[`js/game.js:951`](js/game.js#L951)<br>[`js/game.js:1018`](js/game.js#L1018)<br>[`js/game.js:1034`](js/game.js#L1034)<br>[`js/game.js:1071`](js/game.js#L1071)<br>[`js/game.js:1109`](js/game.js#L1109)<br>[`js/game.js:1264`](js/game.js#L1264)<br>[`js/game.js:1267`](js/game.js#L1267)<br>[`js/game.js:1344`](js/game.js#L1344)<br>[`js/game.js:1424`](js/game.js#L1424)<br>[`js/game.js:1432`](js/game.js#L1432)<br>[`js/game.js:1490`](js/game.js#L1490)<br>[`js/game.js:1494`](js/game.js#L1494)<br>[`js/game.js:1513`](js/game.js#L1513)<br>[`js/game.js:1562`](js/game.js#L1562)<br>[`js/game.js:1585`](js/game.js#L1585)<br>[`js/game.js:1617`](js/game.js#L1617)<br>[`js/game.js:1796`](js/game.js#L1796)<br>[`js/game.js:1797`](js/game.js#L1797)<br>[`js/game.js:1873`](js/game.js#L1873)<br>[`js/game.js:2143`](js/game.js#L2143)<br>[`js/game.js:2216`](js/game.js#L2216) |
| `TIMING.board.marks.markDrop` | 750 | a mark falling onto a space and bouncing (the impact is markImpact) | [`js/timing.js:356`](js/timing.js#L356) | [`js/game.js:696`](js/game.js#L696)<br>[`js/render.js:1074`](js/render.js#L1074) |
| `TIMING.board.marks.markImpact` | (calculated) | when a falling mark first hits (273 ms): sparks, ripple, sound | [`js/timing.js:357`](js/timing.js#L357) | [`js/game.js:466`](js/game.js#L466)<br>[`js/game.js:899`](js/game.js#L899)<br>[`js/game.js:1605`](js/game.js#L1605)<br>[`js/game.js:1825`](js/game.js#L1825)<br>[`js/minimap.js:120`](js/minimap.js#L120)<br>[`js/render.js:741`](js/render.js#L741)<br>[`js/render.js:1068`](js/render.js#L1068) |
| `TIMING.board.marks.vanishPoof` | 240 | Vanishing Marks: the oldest mark's "POOF!" after a fourth mark is placed | [`js/timing.js:358`](js/timing.js#L358) | [`js/game.js:1455`](js/game.js#L1455)<br>[`js/game.js:1464`](js/game.js#L1464) |
| `TIMING.board.marks.ghostFade` | 450 | a removed mark fading out | [`js/timing.js:359`](js/timing.js#L359) | [`js/render.js:1136`](js/render.js#L1136) |

`markImpact` is not a plain number. It is calculated from `markDrop`: it is the moment the bouncing mark first touches the board (36.4% of the way through the drop). Sparks, ripples and the landing sound happen then. Change `markDrop` and the impact effects stay in sync. Only edit the `0.364` if you change the bounce easing (`Ease.outBounce` in `js/render.js`).

### Per game type

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.gravity.gravitySettle` | 450 | Gravity: the marks fall at once; play continues here | [`js/timing.js:364`](js/timing.js#L364) | [`js/game.js:773`](js/game.js#L773)<br>[`js/game.js:1231`](js/game.js#L1231) |
| `TIMING.board.gravity.gravityRaise` | 1700 | EPOCH: the Gravity game begins. The board tilting upright (hydraulic push) ... | [`js/timing.js:365`](js/timing.js#L365) | [`js/game.js:1231`](js/game.js#L1231)<br>[`js/game.js:1843`](js/game.js#L1843)<br>[`js/render.js:930`](js/render.js#L930) |
| `TIMING.board.gravity.gravityRaiseDelay` | 350 | ... starting here | [`js/timing.js:366`](js/timing.js#L366) | [`js/game.js:1231`](js/game.js#L1231)<br>[`js/game.js:1843`](js/game.js#L1843)<br>[`js/render.js:932`](js/render.js#L932) |
| `TIMING.board.gravity.gravityLower` | 700 | ... and tilting back down once the game is over | [`js/timing.js:367`](js/timing.js#L367) | [`js/render.js:946`](js/render.js#L946) |
| `TIMING.board.shift.shiftAt` | 420 | Shifting Squares: a row or column shifts | [`js/timing.js:372`](js/timing.js#L372) | [`js/game.js:777`](js/game.js#L777) |
| `TIMING.board.shift.shiftContinueAt` | 1070 | ... and play continues | [`js/timing.js:373`](js/timing.js#L373) | [`js/game.js:779`](js/game.js#L779) |
| `TIMING.board.shift.slide` | 420 | a mark sliding to its new space (Shifting Squares, Ring Spin, Gravity) | [`js/timing.js:374`](js/timing.js#L374) | [`js/game.js:806`](js/game.js#L806)<br>[`js/game.js:853`](js/game.js#L853)<br>[`js/game.js:931`](js/game.js#L931)<br>[`js/render.js:1100`](js/render.js#L1100)<br>[`js/render.js:1101`](js/render.js#L1101)<br>[`js/render.js:1102`](js/render.js#L1102)<br>[`js/render.js:1103`](js/render.js#L1103) |
| `TIMING.board.ringCross.turnAt` | 420 | Ring Spin / Crossfire: the marks move | [`js/timing.js:379`](js/timing.js#L379) | [`js/game.js:784`](js/game.js#L784) |
| `TIMING.board.ringCross.ringContinueAt` | 1120 | Ring Spin: play continues | [`js/timing.js:380`](js/timing.js#L380) | [`js/game.js:786`](js/game.js#L786) |
| `TIMING.board.ringCross.crossContinueAt` | 1220 | Crossfire: play continues | [`js/timing.js:381`](js/timing.js#L381) | [`js/game.js:786`](js/game.js#L786) |
| `TIMING.board.ringCross.crossHop` | 700 | Crossfire: each corner mark's hop over the centre | [`js/timing.js:382`](js/timing.js#L382) | [`js/game.js:853`](js/game.js#L853) |
| `TIMING.board.fog.fogCover` | 650 | Fog of War: a mark disappearing into the fog | [`js/timing.js:387`](js/timing.js#L387) | [`js/game.js:1204`](js/game.js#L1204)<br>[`js/game.js:1210`](js/game.js#L1210)<br>[`js/render.js:667`](js/render.js#L667) |
| `TIMING.board.fog.fogPause` | 500 | ... play continues here | [`js/timing.js:388`](js/timing.js#L388) | [`js/game.js:791`](js/game.js#L791) |
| `TIMING.board.fog.fogLiftPause` | 1500 | EPOCH: Fog of War is over. Play continues here ... | [`js/timing.js:389`](js/timing.js#L389) | [`js/game.js:842`](js/game.js#L842) |
| `TIMING.board.fog.fogLift` | 1300 | ... while the fog thins away over this long | [`js/timing.js:390`](js/timing.js#L390) | [`js/game.js:83`](js/game.js#L83)<br>[`js/game.js:661`](js/game.js#L661)<br>[`js/game.js:834`](js/game.js#L834)<br>[`js/game.js:837`](js/game.js#L837)<br>[`js/game.js:839`](js/game.js#L839)<br>[`js/game.js:1212`](js/game.js#L1212)<br>[`js/game.js:1340`](js/game.js#L1340)<br>[`js/render.js:668`](js/render.js#L668)<br>[`js/render.js:673`](js/render.js#L673) |
| `TIMING.board.fog.fogWinFade` | 900 | ... (the fog's fade if a win happens without the lift) | [`js/timing.js:391`](js/timing.js#L391) | [`js/render.js:669`](js/render.js#L669) |
| `TIMING.board.wild.wildJumpAt` | 250 | Wild Square: the wild mark jumps | [`js/timing.js:396`](js/timing.js#L396) | [`js/game.js:795`](js/game.js#L795) |
| `TIMING.board.wild.wildContinueAt` | 700 | ... and play continues | [`js/timing.js:397`](js/timing.js#L397) | [`js/game.js:797`](js/game.js#L797) |

Keep each "continue" time at least the action's time plus the animation it waits for. For example, `crossContinueAt` should be at least `turnAt + crossHop`, and `shiftContinueAt` at least `shiftAt + slide`. Otherwise the next turn starts while marks are still moving.

### Wild Square intro

The spaces light up one after another, slowing down, until the light stops on the wild space and the wild mark drops onto it.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.wildIntro.wildIntroStart` | 2950 | the first light (KEEP: after the card has flown away, ruleCard.flyAt + fly) | [`js/timing.js:403`](js/timing.js#L403) | [`js/game.js:675`](js/game.js#L675)<br>[`js/game.js:693`](js/game.js#L693) |
| `TIMING.board.wildIntro.wildIntroSteps` | 17 | how many random spaces light up before the final one (a count, not ms) | [`js/timing.js:404`](js/timing.js#L404) | [`js/game.js:678`](js/game.js#L678) |
| `TIMING.board.wildIntro.wildStepMin` | 55 | the gap between lights at the start ... | [`js/timing.js:405`](js/timing.js#L405) | [`js/game.js:686`](js/game.js#L686) |
| `TIMING.board.wildIntro.wildStepGrow` | 260 | ... growing by up to this much (on a curve) as the run slows down | [`js/timing.js:406`](js/timing.js#L406) | [`js/game.js:686`](js/game.js#L686) |
| `TIMING.board.wildIntro.wildStepTrail` | 120 | the dim trail left by the previous light | [`js/timing.js:407`](js/timing.js#L407) | [`js/render.js:746`](js/render.js#L746) |
| `TIMING.board.wildIntro.wildDropAt` | 5314 | the wild mark drops (KEEP: after the last light, which comes at about 4864 | [`js/timing.js:408`](js/timing.js#L408) | [`js/game.js:694`](js/game.js#L694)<br>[`js/game.js:695`](js/game.js#L695) |
| `TIMING.board.wildIntro.wildLightFade` | 500 | after the mark lands, the light under it fading | [`js/timing.js:410`](js/timing.js#L410) | [`js/game.js:1219`](js/game.js#L1219)<br>[`js/render.js:742`](js/render.js#L742) |

The gap after light *n* is `wildStepMin + wildStepGrow × q³`, where *q* goes from 0 to 1 over the run. The run therefore starts fast and slows sharply at the end. With the default values the last light comes at about 4864 ms after the card appears. The wild mark drops at `wildDropAt` (5314), counted from the card too, so `wildDropAt` must stay after the last light; the console warns if it does not, and also if `wildIntroStart` comes before the card has flown away. The intro ends at `wildDropAt + markDrop`, and the game waits for it before play starts.

---

## 7. Match Point ([`js/game.js`](js/game.js), drawn in [`js/render.js`](js/render.js))

Match Point is the Turf Battle being played deciding a space that would win a Round for someone. `updateStakes()` spots it as soon as the board is playable. `matchPointSoon()` then waits for the rule title card to land in its plate at the top of the screen (so the two never overlap). That moment is the epoch, and `matchPointMoment()` plans everything from it:

1. The riser (`Sound.matchPointRise`) starts at `riseAt` and builds until the slam.
2. The slam, at `slamAt`: the big MATCH POINT! title and the line under it (`matchPointBanner()`, the `#mpBanner` element), cinematic letterbox bars, a red flash, a hard screen shake, sparks from both sides of the title, and `Sound.matchPointSlam`. Each deciding space (an empty space that would win this Turf Battle right now for a player on match point) erupts with a ripple and sparks, `sparkGap` apart, and flares with a pillar of light.
3. The announcer says "Match point" at `voiceAt`, and the double heartbeat comes at `heartbeatAt`.
4. The deciding spaces fade from the flare to a steady glow over `lightUp`, then throb with a lub-dub every `glowPulse` until the Turf Battle ends. The red vignette and the stakes bar beat at the same rate. In Fog of War the deciding spaces are not lit, as that would give away the hidden marks.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.matchPoint.riseAt` | 300 | the rising whoosh starts | [`js/timing.js:430`](js/timing.js#L430) | [`js/game.js:1146`](js/game.js#L1146)<br>[`js/game.js:1147`](js/game.js#L1147)<br>[`js/game.js:2101`](js/game.js#L2101) |
| `TIMING.matchPoint.slamAt` | 750 | the title slams down: flash, shake, sparks | [`js/timing.js:431`](js/timing.js#L431) | [`js/game.js:1147`](js/game.js#L1147)<br>[`js/game.js:2101`](js/game.js#L2101)<br>[`js/game.js:2103`](js/game.js#L2103)<br>[`js/game.js:2108`](js/game.js#L2108) |
| `TIMING.matchPoint.voiceAt` | 870 | "Match point" is announced | [`js/timing.js:432`](js/timing.js#L432) | [`js/game.js:2108`](js/game.js#L2108) |
| `TIMING.matchPoint.heartbeatAt` | 1750 | the double heartbeat | [`js/timing.js:433`](js/timing.js#L433) | [`js/game.js:2102`](js/game.js#L2102) |
| `TIMING.matchPoint.sparkGap` | 70 | the deciding spaces erupt one after another from slamAt, this far apart | [`js/timing.js:434`](js/timing.js#L434) | [`js/game.js:2125`](js/game.js#L2125) |
| `TIMING.matchPoint.banner` | 2800 | from slamAt, the title on screen: slam, hold, fly off (the letterbox bars too) | [`js/timing.js:435`](js/timing.js#L435) | [`js/game.js:632`](js/game.js#L632)<br>[`js/game.js:1147`](js/game.js#L1147)<br>[`js/game.js:1177`](js/game.js#L1177)<br>[`js/slots.js:380`](js/slots.js#L380) |
| `TIMING.matchPoint.lightUp` | 1400 | from slamAt, the burst of light on the deciding spaces fading to a steady glow | [`js/timing.js:436`](js/timing.js#L436) | [`js/render.js:1159`](js/render.js#L1159) |
| `TIMING.matchPoint.glowPulse` | 1100 | one pulse of that steady glow (matches the red vignette's heartbeat) | [`js/timing.js:437`](js/timing.js#L437) | [`js/game.js:1147`](js/game.js#L1147)<br>[`js/render.js:1160`](js/render.js#L1160) |

`banner` and `glowPulse` are handed to `style.css` as `--t-mp-banner` and `--t-mp-pulse` by the `setProperty` lines at the bottom of `js/timing.js`. The keyframes of the title (`mpslam`, `mpsub`, `mpburst`, `mpbartop`, `mpbarbot` in `style.css`) are percentages of `banner`, so changing it stretches the whole title evenly. The volumes of the riser and the slam are `SOUND.effects.matchPointRise` and `.matchPointSlam` in `js/sound-config.js`.

---

## 8. Instant Replay ([`js/game.js`](js/game.js))

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.replay.firstStep` | 1400 | after the replay starts, before the first move plays | [`js/timing.js:455`](js/timing.js#L455) | [`js/game.js:1807`](js/game.js#L1807) |
| `TIMING.replay.stepSameBoard` | 950 | gap between moves on the same board | [`js/timing.js:456`](js/timing.js#L456) | [`js/game.js:1861`](js/game.js#L1861) |
| `TIMING.replay.stepNewBoard` | 1500 | gap after the replay moves to a different board (longer for the camera) | [`js/timing.js:457`](js/timing.js#L457) | [`js/game.js:1861`](js/game.js#L1861) |
| `TIMING.replay.resume` | 400 | after un-pausing, before the next move | [`js/timing.js:458`](js/timing.js#L458) | [`js/game.js:1879`](js/game.js#L1879)<br>[`js/sound.js:51`](js/sound.js#L51)<br>[`js/sound.js:717`](js/sound.js#L717) |
| `TIMING.replay.cameraFirst` | 900 | the camera's move to the starting board | [`js/timing.js:459`](js/timing.js#L459) | [`js/game.js:1831`](js/game.js#L1831) |
| `TIMING.replay.cameraMove` | 800 | the camera following the replay to a different board | [`js/timing.js:460`](js/timing.js#L460) | [`js/game.js:1831`](js/game.js#L1831) |
| `TIMING.replay.cameraBack` | 900 | the camera's move back to the live game when the replay ends | [`js/timing.js:461`](js/timing.js#L461) | [`js/game.js:1872`](js/game.js#L1872) |
| `TIMING.replay.afterGravityRaise` | 300 | Gravity: after the board locks upright, before the first replayed move drops | [`js/timing.js:462`](js/timing.js#L462) | [`js/game.js:1843`](js/game.js#L1843) |

Replay speed (the 1×, 2×, 4× button) divides the step gaps. The camera durations are not divided.

When the replay reaches a Gravity Turf Battle, the board stands up exactly as it does in a live game (`TIMING.board.gravity.gravityRaiseDelay` + `gravityRaise`, at normal speed whatever the replay speed). `Game.replayTiltWait()` holds the first replayed move until it has locked upright, plus `afterGravityRaise`. Each saved moment is a fresh copy of the board, so `applySnap()` carries the tilt over from one moment to the next; otherwise the board would start standing up again from flat on every move.

---

## 9. Values shared with the stylesheet

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.css.overlayFade` | 250 | the fade-in / fade-out of the full-screen overlays | [`js/timing.js:491`](js/timing.js#L491) | [`js/timing.js:500`](js/timing.js#L500) |

`js/timing.js` sets this value as the CSS custom property `--t-overlay-fade` when the page loads. (`TIMING.matchPoint.banner` and `.glowPulse` are handed over the same way; see section 7.) `style.css` uses it for the fade of the wheel, slot machine and RULE PICK overlays, with `0.25s` as a fallback. The JavaScript settings that hide those overlays (`slots.result.hide`, `rulePick.doneAt - fadeAt`, `wheel.blastOff.doneAt - fadeAt`) wait for this fade. Keep them equal to it or longer; the wheel's is deliberately longer.

To add another CSS timing the same way:

1. Add the value to `TIMING.css`.
2. Add a `setProperty` line at the bottom of `js/timing.js`.
3. In `style.css`, write `var(--your-name, <fallback>)`.

---

## Timings that live in CSS

These animations are defined only in [`style.css`](style.css). Edit them there. The times are in seconds (`s`).

| What | Where | Current |
|---|---|---|
| "ROUND N" banner when a new level starts | [`style.css:240`](style.css#L240) (`.banner.play`) | 2.2s |
| Rule title card fading in | [`style.css:745`](style.css#L745) (`.rulecard.play`) | 0.25s |
| Rule title card popping in | [`style.css:752`](style.css#L752) (`.rulecard.play .rc-inner`) | 0.45s |
| Slot machine panel scaling in | [`style.css:476`](style.css#L476) (`.slot-machine`) | 0.45s |
| Wheel panel scaling in | [`style.css:856`](style.css#L856) (`.wh-panel`) | 0.45s |
| Winning-wedge hub icon fading during the lift | [`style.css:883`](style.css#L883) (`#wheel.lifting .wh-spin`) | 0.3s |
| Message toast popping in | [`style.css:368`](style.css#L368) (`.toast.show`) | 0.35s |
| MATCH POINT title, letterbox bars, burst of light | `.mp-banner` keyframes in `style.css` | `TIMING.matchPoint.banner` (section 7) |
| Replay progress bar | [`style.css:1229`](style.css#L1229) (`.rp-fill`) | 0.4s |

The rule card's `TIMING.ruleCard.flyAt` (2200) should stay longer than the CSS pop-in (0.45s), or the card will start flying before it has finished appearing.

## What is deliberately not in `TIMING`

Short visual flourishes that never hold up the game are left where they are, next to the drawing code. Examples are particle lifetimes (`life:` values in `js/boom.js`, `js/render.js` and the `Fx` helper in `js/wheel.js`), the speed of looping glows and pulses (`Math.sin(now / 320)` and similar), the Crossfire / Ring Spin / Shifting Squares arrow belt speed (in the renderer, where the chevrons are drawn), and the SVG icon animations (`WILD_CYCLE`, `FOG_ICON` in `js/render.js`). Changing them only changes how an effect looks, not the pacing. If one of them ever needs regular tuning, move it into `TIMING` using the pattern below.

## Adding a new timing

1. Add the value to the right group in `js/timing.js`, with a comment that says what it controls and its unit. If it is a start time, count it from the group's epoch and end its name in `At`; never count it from another setting's moment. If it needs a new epoch, say so on an `EPOCH:` line.
2. In the code, use `TIMING.<group>.<name>` (or `TIMING.<group>.<stage>.<name>` in a group that is split into stages, such as `TIMING.slots.instantWin.suspenseStop`) in place of the number. Schedule it from the epoch (`waitUntil(t0, at)` / `atTime(t0, at, fn)`), not from the end of the step before.
3. Add a row to the matching table in this document.

Please don't put new magic numbers for sequence pacing straight into the code. Keeping them all in `js/timing.js` is what makes the game's pacing tunable from one place.

## Testing a change quickly

### Developer Mode: Transitions

Press **Shift+D** (or add `?dev` to the address) and open **🎬 Transitions** in the Developer Mode panel. Each button plays one sequence on its own, on a throwaway board built for it, and then puts your real game back exactly as it was. Nothing is saved while it runs, and the computer makes every choice the sequence needs (pressing SPIN, pulling the lever, picking a card or a target). The "Wheel result" and "Slot result" settings above it still apply, so you can pick what the wheel lands on or which prize the slot machine gives.

| Group | Buttons |
|---|---|
| Wheel and cards | Fortune Wheel (full spin, from drop-in to blast-off), rule title card, RULE PICK cards |
| Slot machine | jackpot found + slot machine, INSTANT WIN, the explosion |
| Winning and camera | MATCH POINT, Turf Battle won (zoom out), Round won (the new Round), stalemate (dead square), zooming into a Turf Battle, the ROUND banner |
| Game types | Vanishing mark POOF, Shifting Squares, Ring Spin, Crossfire, fog rolling over a mark, fog lifting, the Wild Square roulette, the Wild Square jumping, the Gravity board standing up, a bombed Gravity mark with the marks above falling |

**🔄 Reload timing.js + sound-config.js** reads both files again and copies the new values into `TIMING` and `SOUND`, so you can edit a number, save, reload the settings and press a transition button again without losing your game. It needs the game to be served over http (for example `python3 -m http.server`); opened straight from a file, the browser blocks it.

The code is the "Developer Mode: Transitions" section of `js/game.js`: `labRun()` stores the real game, `labScene()` builds each throwaway board and starts its sequence, `labEnd()` restores the game, and `labReload()` reloads the settings. The lab's own pauses are `TIMING.lab`:

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.lab.before` | 500 | the throwaway board on screen, before the sequence starts | [`js/timing.js:476`](js/timing.js#L476) | [`js/game.js:1104`](js/game.js#L1104) |
| `TIMING.lab.after` | 1200 | after the sequence ends, before the real game comes back | [`js/timing.js:477`](js/timing.js#L477) | [`js/game.js:1037`](js/game.js#L1037)<br>[`js/game.js:2032`](js/game.js#L2032) |
| `TIMING.lab.boomWatch` | 2200 | the Explosion button: how long to watch it | [`js/timing.js:478`](js/timing.js#L478) | [`js/game.js:1136`](js/game.js#L1136) |
| `TIMING.lab.bannerWatch` | 2400 | the ROUND banner button: how long to watch it (its animation is 2.2s in style.css) | [`js/timing.js:479`](js/timing.js#L479) | [`js/game.js:1178`](js/game.js#L1178) |

To add a button: add a `[key, group]` line to `Game.LAB_LIST`, a label to `STRINGS.dev.lab.items`, and a scene with the same key in `labScene()`.

### Other shortcuts

- **Fortune Wheel with a chosen game type:** open the browser console and run `Game.dev.on = true; Game.dev.wheel = 'cross'`. The next spin lands on Crossfire. Any key from `RULES` in `js/game.js` works.
- **Trying values without reloading:** most settings are read when they are used, so you can change them live in the console, for example `TIMING.wheel.landing.autoFinishAt = 1500`. The next time that sequence runs, it uses the new value. To keep the change, copy the number into `js/timing.js`.
- **Slow motion:** Chrome DevTools has an Animations panel (More tools → Animations) that can play DOM animations at 25% or 10% speed. This helps with the overlays. It does not slow down `setTimeout` or the canvas.
