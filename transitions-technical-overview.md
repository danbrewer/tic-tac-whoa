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

You should not need to edit any other file to adjust pacing. The tables below list every place in the code that reads each setting. Use them when you want to understand exactly what a value does, or when you want to add a new one.

> **About the line numbers.** The `file:line` references were accurate when this document was written. They drift whenever code above them changes. If a line number looks wrong, search the file for the setting's name (for example `wedgeLiftDelay`). The names are unique within their top-level group, so the search finds the right spot.

## How the code reads the settings

`js/timing.js` is the first script loaded by [`index.html`](index.html#L177), so `TIMING` is available everywhere. Most code reads it directly, as in `TIMING.wheel.landing.announceDelay`. A few functions that read the same group many times give it a short local name at the top of the function:

| Short name | Means | Where |
|---|---|---|
| `T` | `TIMING.wheel` | `dropIn()` in `js/wheel.js` |
| `TS` | `TIMING.slots` | `spin()` and `reveal()` in `js/slots.js` |
| `TP` | `TIMING.rulePick` | `RulePick.open()` in `js/slots.js` |
| `T` | `TIMING.board` | `postMove()` in `js/game.js`, `fogLevel()` in `js/render.js` |
| `TB` | `TIMING.board` | `wildRoulette()` in `js/game.js` |
| `TC` | `TIMING.camera` | `ascend()` in `js/game.js` |
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
Wheel.spin()
 ├─ dropIn(): falls for dropFall → BOOM + dust + squash (dropSquash) + screen shake (dropShake)
 │            title lines pop in after dropFall + dropTitleGap, each dropTitleStagger apart
 ├─ waits for the player to press SPIN (or autoSpinDelay for the computer)
 ├─ go(): wind back (windBack) → spin: fast phase (spinFast + random spinFastRandom) then crawl (spinCrawl)
 │        heartbeats every heartbeats[n] ms, then heartbeatFast; each throb lasts heartbeatPulse
 ├─ land(): wheel stops (time 0 below)
 │    +wedgeLiftDelay  winning wedge pops out, rising for wedgeLift
 │    +announceDelay   burst, the game's name, voice-over; clicks allowed after clickSkip(Voiced)
 │    +autoFinish(Voiced)  blastOff() starts by itself
 └─ blastOff(): text fades (blastUiFade) → rumble (blastRumble) → fly away (blastFly)
                → overlay fades (hide) → the game continues
```

### Drop-in

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.drop.dropFall` | 620 | the fall itself; the BOOM, dust and squash happen when it ends | [`js/timing.js:47`](js/timing.js#L47) | [`js/wheel.js:578`](js/wheel.js#L578) |
| `TIMING.wheel.drop.dropTitleGap` | 120 | after the slam, before the title text starts popping in | [`js/timing.js:48`](js/timing.js#L48) | [`js/wheel.js:586`](js/wheel.js#L586) |
| `TIMING.wheel.drop.dropTitleIn` | 450 | each title line's pop-in animation | [`js/timing.js:49`](js/timing.js#L49) | [`js/wheel.js:586`](js/wheel.js#L586) |
| `TIMING.wheel.drop.dropTitleStagger` | 90 | extra delay between one title line and the next | [`js/timing.js:50`](js/timing.js#L50) | [`js/wheel.js:586`](js/wheel.js#L586) |
| `TIMING.wheel.drop.dropSquash` | 380 | the squash-and-stretch bounce on impact | [`js/timing.js:51`](js/timing.js#L51) | [`js/wheel.js:591`](js/wheel.js#L591) |
| `TIMING.wheel.drop.dropShake` | 700 | the screen shake on impact | [`js/timing.js:52`](js/timing.js#L52) | [`js/wheel.js:597`](js/wheel.js#L597) |

### Spin

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.autoSpinDelay` | 900 | computer's turn: how long the wheel sits before the computer presses SPIN | [`js/timing.js:43`](js/timing.js#L43) | [`js/wheel.js:807`](js/wheel.js#L807) |
| `TIMING.wheel.spin.windBack` | 520 | the wheel is dragged backwards before it is let go | [`js/timing.js:57`](js/timing.js#L57) | [`js/wheel.js:690`](js/wheel.js#L690) |
| `TIMING.wheel.spin.spinFast` | 6800 | phase A: the long slow-down from full speed ... | [`js/timing.js:58`](js/timing.js#L58) | [`js/wheel.js:698`](js/wheel.js#L698) |
| `TIMING.wheel.spin.spinFastRandom` | 400 | ... plus up to this much extra, so no two spins last exactly the same | [`js/timing.js:59`](js/timing.js#L59) | [`js/wheel.js:698`](js/wheel.js#L698) |
| `TIMING.wheel.spin.spinCrawl` | 3400 | phase B: the final crawl over the last ~3 spokes to the stop | [`js/timing.js:60`](js/timing.js#L60) | [`js/wheel.js:697`](js/wheel.js#L697) |
| `TIMING.wheel.heartbeat.heartbeats` | [1200, 1200, 1000, 1000, 800, 800, 600, 600] | gap before each heartbeat during the spin: | [`js/timing.js:65`](js/timing.js#L65) | [`js/sound-config.js:59`](js/sound-config.js#L59)<br>[`js/wheel.js:707`](js/wheel.js#L707)<br>[`js/wheel.js:734`](js/wheel.js#L734)<br>[`js/wheel.js:738`](js/wheel.js#L738) |
| `TIMING.wheel.heartbeat.heartbeatFast` | 400 | gap between heartbeats once the list above runs out | [`js/timing.js:67`](js/timing.js#L67) | [`js/wheel.js:738`](js/wheel.js#L738)<br>[`js/wheel.js:739`](js/wheel.js#L739)<br>[`js/wheel.js:743`](js/wheel.js#L743) |
| `TIMING.wheel.heartbeat.heartbeatPulse` | 420 | how long each heartbeat's "throb" of the wheel lasts | [`js/timing.js:68`](js/timing.js#L68) | [`js/wheel.js:747`](js/wheel.js#L747) |
| `TIMING.wheel.heartbeat.heartbeatStopGuard` | 120 | no heartbeat starts this close to the moment the wheel stops | [`js/timing.js:69`](js/timing.js#L69) | [`js/wheel.js:741`](js/wheel.js#L741) |
| `TIMING.wheel.heartbeat.heartbeatLubDubSlow` | 240 | gap between the "lub" and the "dub" of the slowest heartbeat ... | [`js/timing.js:70`](js/timing.js#L70) | [`js/wheel.js:744`](js/wheel.js#L744) |
| `TIMING.wheel.heartbeat.heartbeatLubDubFast` | 110 | ... and of the fastest (in between, it tightens as the heart races) | [`js/timing.js:71`](js/timing.js#L71) | [`js/wheel.js:744`](js/wheel.js#L744) |

The full spin lasts `spinFast + spinCrawl` (about 10 to 10.6 seconds), after the `windBack`. The spin's *distance* is worked out from these durations, so the wheel always lands on the chosen segment whatever values you pick. The suspense effects (glow, drum roll, jitter) start at 55% of the spin. That percentage is a ratio in `go()`, not a timing.

The heartbeat's speed-up curve is the `heartbeats` list: each number is the gap before the next beat, and once the list runs out every gap is `heartbeatFast`. Its loudness follows the same curve: quietest at the slowest gap in the list, loudest at `heartbeatFast`. The two loudness levels are `SOUND.heartbeat` in [`js/sound-config.js`](js/sound-config.js), which holds every sound volume (see [`architecture-overview.md`](architecture-overview.md)).

### The flapper

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.flapper.flapperFreq` | 9 | Hz: how fast it springs back and forth (higher = stiffer, quicker slaps) | [`js/timing.js:77`](js/timing.js#L77) | [`js/wheel.js:379`](js/wheel.js#L379)<br>[`js/wheel.js:417`](js/wheel.js#L417) |
| `TIMING.wheel.flapper.flapperDamping` | 0.1 | 0..1: how quickly its wobble dies away (0 = forever, 1 = no overshoot at all) | [`js/timing.js:78`](js/timing.js#L78) | [`js/wheel.js:379`](js/wheel.js#L379)<br>[`js/wheel.js:417`](js/wheel.js#L417) |
| `TIMING.wheel.flapper.flapperBounce` | 0.35 | 0..1: how much of its speed it keeps when it slaps into a peg | [`js/timing.js:79`](js/timing.js#L79) | [`js/wheel.js:380`](js/wheel.js#L380)<br>[`js/wheel.js:417`](js/wheel.js#L417) |

**These three are not milliseconds.** The red flapper is a small physics simulation in `Wheel.flapperStep()`, not a timed animation. It is a damped spring that the gold pegs (one on every spoke) push aside; when a peg slips off its tip it snaps back, overshoots, and often slaps the next peg. Because the pegs drive it, its motion follows the wheel's speed automatically: quick flicks while the wheel is fast, bigger slower slaps as it crawls. The clack sound plays once per peg, at the moment that peg first strikes the flapper, so the sound always lands on the slap you see. Every clack is at the same full volume, from the first peg to the last; its loudness and pitch are `SOUND.wheelClack` in [`js/sound-config.js`](js/sound-config.js).

- `flapperFreq` (Hz) is the spring's stiffness. Higher makes it snap back faster.
- `flapperDamping` (0 to 1) is how quickly its wobble dies away. Lower wobbles longer.
- `flapperBounce` (0 to 1) is how much speed it keeps when it hits a peg.

The sizes of the pegs and flapper are in `Wheel.PEG` and `Wheel.FLAP` in [`js/wheel.js`](js/wheel.js). `spin()` works out where a peg lets go of the flapper from those sizes (`Wheel.releaseFrac()`). The wedge under the pointer only changes once the flapper has flipped over, at that point, not when the spoke passes the pivot. Most spins stop after that point, so the flapper comes to rest standing free. A share of spins (`Wheel.NEAR_MISS`, 12%) is a near miss: the wheel stops just before the next peg lets go, so the flapper is left bent against it and the result stays on the wedge it never left.

### Landing and announcement

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.landing.wedgeLiftDelay` | 450 | after the wheel stops, before the winning wedge pops out | [`js/timing.js:84`](js/timing.js#L84) | [`js/wheel.js:787`](js/wheel.js#L787) |
| `TIMING.wheel.landing.wedgeLift` | 800 | the wedge rising up and flipping to face the player | [`js/timing.js:85`](js/timing.js#L85) | [`js/wheel.js:783`](js/wheel.js#L783) |
| `TIMING.wheel.landing.announceDelay` | 800 | after the wheel stops: big burst, the game's name, and its voice-over | [`js/timing.js:86`](js/timing.js#L86) | [`js/wheel.js:802`](js/wheel.js#L802) |
| `TIMING.wheel.landing.clickSkipVoiced` | 2600 | after the announcement, how soon a click can skip ahead (game has a voice-over) | [`js/timing.js:87`](js/timing.js#L87) | [`js/wheel.js:801`](js/wheel.js#L801) |
| `TIMING.wheel.landing.clickSkip` | 0 | the same, for a game without a voice-over | [`js/timing.js:88`](js/timing.js#L88) | [`js/wheel.js:801`](js/wheel.js#L801) |
| `TIMING.wheel.landing.autoFinishVoiced` | 3000 | after the wheel stops, blast off on its own (game has a voice-over) | [`js/timing.js:89`](js/timing.js#L89) | [`js/wheel.js:803`](js/wheel.js#L803) |
| `TIMING.wheel.landing.autoFinish` | 1300 | the same, for a game without a voice-over | [`js/timing.js:90`](js/timing.js#L90) | [`js/wheel.js:803`](js/wheel.js#L803) |

The "Voiced" values apply to game types that have a voice-over MP3 (see `RULE_VOICES` in `js/sound.js`). `autoFinishVoiced` must be longer than `announceDelay` plus the length of the longest voice-over, or the wheel will leave while the voice is still talking.

### Blast-off

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.blastOff.blastUiFade` | 300 | the title and result text fade away | [`js/timing.js:95`](js/timing.js#L95) | [`js/wheel.js:603`](js/wheel.js#L603) |
| `TIMING.wheel.blastOff.blastRumble` | 200 | rumbling and fire on the ground before lift-off | [`js/timing.js:96`](js/timing.js#L96) | [`js/wheel.js:604`](js/wheel.js#L604) |
| `TIMING.wheel.blastOff.blastFly` | 400 | the flight up and off the screen | [`js/timing.js:97`](js/timing.js#L97) | [`js/wheel.js:604`](js/wheel.js#L604) |
| `TIMING.wheel.blastOff.blastCleanup` | 400 | after the flight, before leftover animations are cleared | [`js/timing.js:98`](js/timing.js#L98) | [`js/wheel.js:634`](js/wheel.js#L634) |
| `TIMING.wheel.blastOff.hide` | 1000 | the overlay's fade-out before the game continues (matches --t-overlay-fade) | [`js/timing.js:99`](js/timing.js#L99) | [`js/wheel.js:778`](js/wheel.js#L778) |

The rule title card appears when `blastRumble + blastFly + hide` have passed.

---

## 2. Slot machine / Mystery Jackpot ([`js/slots.js`](js/slots.js))

The machine opens when a mark lands on the hidden jackpot space. `jackpotSpin()` in `js/game.js` starts it.

**Timeline:**

```
jackpotSpin() (game.js)
 ├─ +jackpotFoundDelay  "JACKPOT!" + coins
 ├─ +jackpotToMachine   Slots.spin(): the machine fades in
 ├─ waits for the lever (or autoPullDelay for the computer)
 ├─ pull: reels stop at reelStops[i] after the pull
 │        (likely win: later reels get teaserExtra more each;
 │         INSTANT WIN on reel 1: windupFirstStop, then windupGap / windupBrokenGap / suspenseGap)
 ├─ last reel + revealDelay   reveal(): prize text, win lines, INSTANT WIN! banner if any
 │    clicks allowed after clickSkip; closes by itself after autoFinishBust / autoFinishPrize / autoFinishJackpot
 └─ close: Boom.run() explosion, overlay fades (hide), the prize is applied (applyPrize in game.js)
```

A prize needs the same prize symbol on **all 5 reels** along one payline. Before this, 3 or 4 in a row from the left also paid, but then the last reels meant nothing; now the suspense lasts until the final reel stops. The outcome is still decided before the reels spin (`SLOT_ODDS` in `js/slots.js`), and `Slots.makeGrid()` then builds a grid that shows it, so requiring 5 did not change how often each prize comes up. When there is no prize, the grid often shows a near miss: 2 to 4 matching prize symbols lead a line and the next one lands one row off.

The slot machine's settings are split into stages: `TIMING.slots.opening`, `.reels`, `.instantWin`, `.result` and `.prizes`.

### Opening (`TIMING.slots.opening`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.opening.jackpotFoundDelay` | 300 | game.js: after the mark lands on the jackpot space, before "JACKPOT!" | [`js/timing.js:122`](js/timing.js#L122) | [`js/game.js:1459`](js/game.js#L1459) |
| `TIMING.slots.opening.jackpotToMachine` | 900 | game.js: after "JACKPOT!", before the slot machine appears | [`js/timing.js:123`](js/timing.js#L123) | [`js/game.js:1467`](js/game.js#L1467) |
| `TIMING.slots.opening.autoPullDelay` | 900 | computer's turn: how long before the computer pulls the lever | [`js/timing.js:124`](js/timing.js#L124) | [`js/slots.js:265`](js/slots.js#L265) |

### The reels (`TIMING.slots.reels`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.reels.reelStops` | [1500, 1900, 2300, 2500, 2900] |  | [`js/timing.js:129`](js/timing.js#L129) | [`js/slots.js:193`](js/slots.js#L193) |
| `TIMING.slots.reels.spinSpeed` | 35 | how fast the reels spin, in SYMBOLS PER SECOND (higher = faster); every reel | [`js/timing.js:130`](js/timing.js#L130) | [`js/slots.js:223`](js/slots.js#L223) |
| `TIMING.slots.reels.reelSlowdown` | 1200 | the last part of each reel's spin, where it visibly slows from spinSpeed to a stop | [`js/timing.js:132`](js/timing.js#L132) | [`js/slots.js:222`](js/slots.js#L222) |
| `TIMING.slots.reels.teaserExtra` | 450 | a likely win on reels 1+2: reels 3, 4, 5 stop 450, 900, 1350 later | [`js/timing.js:133`](js/timing.js#L133) | [`js/slots.js:193`](js/slots.js#L193) |
| `TIMING.slots.reels.tickGapStart` | 50 | the reel ticking sound: gap between ticks at the start ... | [`js/timing.js:134`](js/timing.js#L134) | [`js/slots.js:260`](js/slots.js#L260) |
| `TIMING.slots.reels.tickGapGrow` | 150 | ... growing by up to this much as the reels slow down | [`js/timing.js:135`](js/timing.js#L135) | [`js/slots.js:260`](js/slots.js#L260) |
| `TIMING.slots.reels.tickStopGuard` | 120 | the ticking stops this long before the last reel stops | [`js/timing.js:136`](js/timing.js#L136) | [`js/slots.js:260`](js/slots.js#L260) |

**Reel speed.** `spinSpeed` is how fast the reels spin, in symbols per second. Every reel spins at that speed until the last `reelSlowdown` ms of its spin, then visibly slows down and crawls to a stop (with a tiny bounce). When four INSTANT WINs are lined up, the deciding last reel uses the longer `TIMING.slots.instantWin.suspenseSlowdown` instead. Each stop plays a door-closing sound (`Sound.reelStop()`); the last reel of a real INSTANT WIN plays a heavy, echoing door slam instead (`Sound.reelStopBig()`). `Slots.spin()` makes each reel's strip exactly long enough for its stop time, so a reel that stops later passes more symbols instead of spinning more slowly. You can change `spinSpeed` and the stop times independently. The slowdown curve is `STOP_EASE` at the top of `js/slots.js`; if you change it, change `STOP_EASE_SLOPE` with it, so the slowdown starts at exactly the spinning speed.

### INSTANT WIN (`TIMING.slots.instantWin`)

An INSTANT WIN symbol on reel 1 winds up the other reels: they stop `windupGap` apart, and every reel that continues the run locks in with a flash (`lockFlash`) and a pop label (x2!, x3!!, x4!!!, INSTANT WIN!). Once the run is broken, the remaining reels stop `windupBrokenGap` apart. If reels 1 to 4 all line up, the music drops out, a drum roll builds, "ONE MORE FOR AN INSTANT WIN..." appears after `oneMoreTextDelay`, and reel 5 keeps spinning for `suspenseGap` before it decides the win, slowing down over the last `suspenseSlowdown` of it. The rest of the group is the INSTANT WIN! title over the machine and its explosions.

```
reel 1 stops at windupFirstStop  ("INSTANT WIN on reel 1..." after windupTeaseDelay)
 ├─ reels 2, 3, 4: +windupGap each   (+windupBrokenGap once the run is broken)
 ├─ 4 in a row: music drops out, drum roll, "ONE MORE..." after oneMoreTextDelay
 ├─ reel 5: +suspenseGap             the deciding reel
 └─ INSTANT WIN: glow (instantGlow), title + explosions, closes after autoFinishJackpot
```

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.instantWin.windupFirstStop` | 2000 | INSTANT WIN on reel 1: when reel 1 stops ... | [`js/timing.js:141`](js/timing.js#L141) | [`js/slots.js:195`](js/slots.js#L195) |
| `TIMING.slots.instantWin.windupGap` | 2100 | ... and the gap before each later reel stops | [`js/timing.js:142`](js/timing.js#L142) | [`js/slots.js:197`](js/slots.js#L197) |
| `TIMING.slots.instantWin.windupBrokenGap` | 380 | ... but only this gap once the INSTANT WIN streak is broken | [`js/timing.js:143`](js/timing.js#L143) | [`js/slots.js:198`](js/slots.js#L198) |
| `TIMING.slots.instantWin.suspenseGap` | 3200 | four INSTANT WINs lined up: the gap before the deciding fifth reel stops | [`js/timing.js:144`](js/timing.js#L144) | [`js/slots.js:199`](js/slots.js#L199) |
| `TIMING.slots.instantWin.suspenseSlowdown` | 2800 | ... and the last part of that reel's spin, where it slowly crawls to a stop (see reels.reelSlowdown) | [`js/timing.js:145`](js/timing.js#L145) | [`js/slots.js:222`](js/slots.js#L222) |
| `TIMING.slots.instantWin.windupTeaseDelay` | 30 | after reel 1 stops, before "INSTANT WIN on reel 1..." appears | [`js/timing.js:146`](js/timing.js#L146) | [`js/slots.js:215`](js/slots.js#L215) |
| `TIMING.slots.instantWin.oneMoreTextDelay` | 650 | after reel 4 stops, before "ONE MORE FOR AN INSTANT WIN..." appears | [`js/timing.js:147`](js/timing.js#L147) | [`js/slots.js:251`](js/slots.js#L251) |
| `TIMING.slots.instantWin.lockFlash` | 600 | the white flash each time an INSTANT WIN locks into place on a reel | [`js/timing.js:148`](js/timing.js#L148) | [`js/slots.js:365`](js/slots.js#L365) |
| `TIMING.slots.instantWin.autoFinishJackpot` | 5600 | after an INSTANT WIN is revealed, the machine closes on its own | [`js/timing.js:149`](js/timing.js#L149) | [`js/slots.js:311`](js/slots.js#L311) |
| `TIMING.slots.instantWin.instantGlow` | 5200 | how long the machine glows after an INSTANT WIN | [`js/timing.js:150`](js/timing.js#L150) | [`js/slots.js:292`](js/slots.js#L292) |
| `TIMING.slots.instantWin.bannerBoomFirst` | 150 | the first explosion around the title | [`js/timing.js:151`](js/timing.js#L151) | [`js/slots.js:390`](js/slots.js#L390) |
| `TIMING.slots.instantWin.bannerBoomGap` | 260 | gap between those explosions (6 of them) | [`js/timing.js:152`](js/timing.js#L152) | [`js/slots.js:390`](js/slots.js#L390) |
| `TIMING.slots.instantWin.bannerCellBurstGap` | 90 | gap between the bursts on each winning symbol | [`js/timing.js:153`](js/timing.js#L153) | [`js/slots.js:395`](js/slots.js#L395) |
| `TIMING.slots.instantWin.bannerFailsafe` | 9000 | the title blows itself up after this long if the machine is still open | [`js/timing.js:154`](js/timing.js#L154) | [`js/slots.js:397`](js/slots.js#L397) |
| `TIMING.slots.instantWin.letterGap` | 45 | the title blowing apart: delay between one letter and the next | [`js/timing.js:155`](js/timing.js#L155) | [`js/slots.js:411`](js/slots.js#L411)<br>[`js/slots.js:433`](js/slots.js#L433) |
| `TIMING.slots.instantWin.letterFly` | 720 | each letter flying away | [`js/timing.js:156`](js/timing.js#L156) | [`js/slots.js:420`](js/slots.js#L420) |
| `TIMING.slots.instantWin.letterBoom` | 130 | after a letter starts flying, its little explosion | [`js/timing.js:157`](js/timing.js#L157) | [`js/slots.js:430`](js/slots.js#L430) |
| `TIMING.slots.instantWin.letterCleanup` | 1500 | after the last letter starts, before the leftovers are removed | [`js/timing.js:158`](js/timing.js#L158) | [`js/slots.js:433`](js/slots.js#L433) |

### The result and closing (`TIMING.slots.result`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.result.revealDelay` | 200 | after the last reel stops, before the prize is shown | [`js/timing.js:163`](js/timing.js#L163) | [`js/slots.js:262`](js/slots.js#L262) |
| `TIMING.slots.result.clickSkip` | 400 | after the reveal, how soon a click closes the machine | [`js/timing.js:164`](js/timing.js#L164) | [`js/slots.js:310`](js/slots.js#L310) |
| `TIMING.slots.result.autoFinishBust` | 2200 | after the reveal, the machine closes on its own: no prize | [`js/timing.js:165`](js/timing.js#L165) | [`js/slots.js:311`](js/slots.js#L311) |
| `TIMING.slots.result.autoFinishPrize` | 3600 | ... any other prize | [`js/timing.js:166`](js/timing.js#L166) | [`js/slots.js:311`](js/slots.js#L311) |
| `TIMING.slots.result.hide` | 250 | the overlay's fade-out before the game continues (matches --t-overlay-fade) | [`js/timing.js:167`](js/timing.js#L167) | [`js/slots.js:307`](js/slots.js#L307) |

### What happens after the prize (`TIMING.slots.prizes`)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.prizes.prizeSettle` | 700 | after a STEAL or a BOMB lands, before play continues | [`js/timing.js:172`](js/timing.js#L172) | [`js/game.js:1538`](js/game.js#L1538) |
| `TIMING.slots.prizes.gravityDropDelay` | 450 | Gravity: after a BOMB or a claimed square, before the marks above a gap fall in | [`js/timing.js:173`](js/timing.js#L173) | [`js/game.js:1535`](js/game.js#L1535) |
| `TIMING.slots.prizes.cpuTargetDelay` | 1000 | computer's turn: how long before it picks which mark to steal or bomb | [`js/timing.js:174`](js/timing.js#L174) | [`js/game.js:1548`](js/game.js#L1548) |
| `TIMING.slots.prizes.rulePickSettle` | 3000 | after a RULE PICK, how long the "next game" card is on screen | [`js/timing.js:175`](js/timing.js#L175) | [`js/game.js:1493`](js/game.js#L1493) |

In a Gravity game, a BOMB leaves a gap, and a claimed square can be left hanging in mid-air. After `gravityDropDelay`, `Game.applyPrize()` calls `Game.settleGravity()`, which slides every mark above a gap down into it. It then waits `TIMING.board.gravity.gravitySettle` before the usual `prizeSettle`.

### The explosion when the machine leaves ([`js/boom.js`](js/boom.js))

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.boom.blastFirst` | 140 | the first ring blast after the centre one | [`js/timing.js:186`](js/timing.js#L186) | [`js/boom.js:22`](js/boom.js#L22) |
| `TIMING.boom.blastGap` | 95 | gap between the ring blasts (7 of them, plus up to 60 random) | [`js/timing.js:187`](js/timing.js#L187) | [`js/boom.js:22`](js/boom.js#L22) |
| `TIMING.boom.shake` | 900 | the screen shake | [`js/timing.js:188`](js/timing.js#L188) | [`js/boom.js:48`](js/boom.js#L48) |

---

## 3. RULE PICK ([`js/slots.js`](js/slots.js), `RulePick`)

RULE PICK is a slot machine prize. The player picks the game type for the next Turf Battle from a hand of cards. The chosen card shatters and the others are blown away. Then the title card shows the choice (section 4).

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.rulePick.cardFlipFirst` | 250 | the deal: the first card's flip sound ... | [`js/timing.js:199`](js/timing.js#L199) | [`js/slots.js:554`](js/slots.js#L554) |
| `TIMING.rulePick.cardFlipGap` | 110 | ... and the gap between cards | [`js/timing.js:200`](js/timing.js#L200) | [`js/slots.js:554`](js/slots.js#L554) |
| `TIMING.rulePick.swell` | 420 | the chosen card swells and trembles, then shatters | [`js/timing.js:201`](js/timing.js#L201) | [`js/slots.js:574`](js/slots.js#L574)<br>[`js/slots.js:604`](js/slots.js#L604) |
| `TIMING.rulePick.shake` | 420 | the panel shake when it shatters | [`js/timing.js:202`](js/timing.js#L202) | [`js/slots.js:588`](js/slots.js#L588) |
| `TIMING.rulePick.cardsFly` | 1000 | the other cards being blown off the screen (plus up to 250 random) | [`js/timing.js:203`](js/timing.js#L203) | [`js/slots.js:602`](js/slots.js#L602) |
| `TIMING.rulePick.exitDelay` | 2000 | after a card is chosen, before the overlay fades away | [`js/timing.js:204`](js/timing.js#L204) | [`js/slots.js:608`](js/slots.js#L608) |
| `TIMING.rulePick.hide` | 260 | the overlay's fade-out (matches --t-overlay-fade) | [`js/timing.js:205`](js/timing.js#L205) | [`js/slots.js:607`](js/slots.js#L607) |
| `TIMING.rulePick.cpuStart` | 1100 | computer's turn: before the highlight starts running over the cards | [`js/timing.js:206`](js/timing.js#L206) | [`js/slots.js:624`](js/slots.js#L624) |
| `TIMING.rulePick.cpuHopBase` | 70 | the highlight's first hop ... | [`js/timing.js:207`](js/timing.js#L207) | [`js/slots.js:622`](js/slots.js#L622) |
| `TIMING.rulePick.cpuHopGrow` | 1.6 | ... each hop n waits cpuHopBase + n * n * cpuHopGrow (NOT ms: a multiplier) | [`js/timing.js:208`](js/timing.js#L208) | [`js/slots.js:622`](js/slots.js#L622) |
| `TIMING.rulePick.cpuChoose` | 350 | after the highlight stops, before the card is chosen | [`js/timing.js:209`](js/timing.js#L209) | [`js/slots.js:620`](js/slots.js#L620) |

The computer's highlight takes `cpuStart`, then hop *n* waits `cpuHopBase + n × n × cpuHopGrow`, then `cpuChoose`. To make the computer decide faster, lower `cpuHopGrow` first.

---

## 4. Rule title card ([`js/game.js`](js/game.js) `showRuleCard()`, [`js/boom.js`](js/boom.js) `IconFly`)

The big card in the middle of the screen names the game type. After `hold` it shrinks and flies up into the plate at the top of the screen.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.ruleCard.hold` | 2200 | how long the card stays in the middle before flying up to the top plate | [`js/timing.js:222`](js/timing.js#L222) | [`js/game.js:737`](js/game.js#L737)<br>[`js/game.js:1106`](js/game.js#L1106)<br>[`js/game.js:1162`](js/game.js#L1162) |
| `TIMING.ruleCard.fly` | 720 | the flight up into the plate at the top of the screen | [`js/timing.js:223`](js/timing.js#L223) | [`js/game.js:735`](js/game.js#L735)<br>[`js/game.js:1106`](js/game.js#L1106)<br>[`js/game.js:1111`](js/game.js#L1111)<br>[`js/game.js:1162`](js/game.js#L1162) |
| `TIMING.ruleCard.failsafe` | 4200 | the card is removed after this long no matter what | [`js/timing.js:224`](js/timing.js#L224) | [`js/game.js:739`](js/game.js#L739) |
| `TIMING.ruleCard.afterCard` | 900 | after the card appears, before the Turf Battle can be played | [`js/timing.js:225`](js/timing.js#L225) | [`js/game.js:417`](js/game.js#L417)<br>[`js/game.js:1162`](js/game.js#L1162) |
| `TIMING.ruleCard.iconLift` | 900 | RULE PICK: the chosen card's icon leaping to centre stage | [`js/timing.js:226`](js/timing.js#L226) | [`js/boom.js:203`](js/boom.js#L203) |
| `TIMING.ruleCard.iconIdle` | 520 | ... then bobbing there (one swing) | [`js/timing.js:227`](js/timing.js#L227) | [`js/boom.js:208`](js/boom.js#L208) |
| `TIMING.ruleCard.iconLandDelay` | 470 | after the title card appears, before the icon flies onto it | [`js/timing.js:228`](js/timing.js#L228) | [`js/boom.js:212`](js/boom.js#L212) |
| `TIMING.ruleCard.iconLand` | 560 | the icon's flight onto the card | [`js/timing.js:229`](js/timing.js#L229) | [`js/boom.js:226`](js/boom.js#L226) |
| `TIMING.ruleCard.iconBounce` | 380 | the card's icon bouncing when the flying icon lands on it | [`js/timing.js:230`](js/timing.js#L230) | [`js/boom.js:228`](js/boom.js#L228) |

`afterCard` is how long `startRule()` waits after showing the card before the Turf Battle can be played. For Wild Square the wait is longer: it lasts until the wild mark has landed (see `wildIntroStart` in section 6).

---

## 5. Camera moves between boards ([`js/game.js`](js/game.js))

The camera itself is `Renderer.flyTo()` in [`js/render.js`](js/render.js). It zooms around a fixed point so the move feels like a real zoom. These settings choose how long each move takes and how long the game pauses around it.

### Into a Turf Battle, and back out after a win

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.turf.zoomIntoChild` | 1200 | a player picks a space: zoom down into its new Turf Battle (or lower level) | [`js/timing.js:248`](js/timing.js#L248) | [`js/game.js:502`](js/game.js#L502) |
| `TIMING.camera.turf.childFadeIn` | 700 | ... the new board fading in during that zoom | [`js/timing.js:249`](js/timing.js#L249) | [`js/game.js:501`](js/game.js#L501) |
| `TIMING.camera.turf.winPause` | 1400 | a board is won: celebrate before zooming out | [`js/timing.js:250`](js/timing.js#L250) | [`js/game.js:596`](js/game.js#L596) |
| `TIMING.camera.turf.zoomOutToParent` | 1200 | zoom out from the won board to the board above it | [`js/timing.js:251`](js/timing.js#L251) | [`js/game.js:604`](js/game.js#L604)<br>[`js/game.js:1571`](js/game.js#L1571) |
| `TIMING.camera.turf.wonFade` | 800 | ... the won board fading away during that zoom ... | [`js/timing.js:252`](js/timing.js#L252) | [`js/game.js:603`](js/game.js#L603)<br>[`js/game.js:1570`](js/game.js#L1570) |
| `TIMING.camera.turf.wonFadeDelay` | 250 | ... starting this long after the zoom starts | [`js/timing.js:253`](js/timing.js#L253) | [`js/game.js:603`](js/game.js#L603)<br>[`js/game.js:1570`](js/game.js#L1570) |
| `TIMING.camera.turf.afterClaim` | 800 | after the winner's mark drops into the board above, before play continues | [`js/timing.js:254`](js/timing.js#L254) | [`js/game.js:610`](js/game.js#L610) |
| `TIMING.camera.turf.winLineFirst` | 120 | the winning line's sparkles: the first space ... | [`js/timing.js:255`](js/timing.js#L255) | [`js/game.js:592`](js/game.js#L592) |
| `TIMING.camera.turf.winLineGap` | 110 | ... and the gap between spaces | [`js/timing.js:256`](js/timing.js#L256) | [`js/game.js:592`](js/game.js#L592) |

### A whole level is won (moving up to a new level)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.ascend.ascendZoom` | 1900 | the zoom out to the new level | [`js/timing.js:261`](js/timing.js#L261) | [`js/game.js:640`](js/game.js#L640) |
| `TIMING.camera.ascend.ascendNewFadeIn` | 1000 | the new board fading in ... | [`js/timing.js:262`](js/timing.js#L262) | [`js/game.js:638`](js/game.js#L638) |
| `TIMING.camera.ascend.ascendNewFadeDelay` | 200 | ... starting this long after the zoom starts | [`js/timing.js:263`](js/timing.js#L263) | [`js/game.js:638`](js/game.js#L638) |
| `TIMING.camera.ascend.ascendOldFade` | 900 | the old board fading out ... | [`js/timing.js:264`](js/timing.js#L264) | [`js/game.js:639`](js/game.js#L639) |
| `TIMING.camera.ascend.ascendOldFadeDelay` | 900 | ... starting this long after the zoom starts | [`js/timing.js:265`](js/timing.js#L265) | [`js/game.js:639`](js/game.js#L639) |
| `TIMING.camera.ascend.ascendWaveDelay` | 250 | after the zoom, before the ripple across the new board | [`js/timing.js:266`](js/timing.js#L266) | [`js/game.js:646`](js/game.js#L646) |
| `TIMING.camera.ascend.ascendSettle` | 700 | after the zoom, before play continues | [`js/timing.js:267`](js/timing.js#L267) | [`js/game.js:648`](js/game.js#L648) |

The "ROUND N" banner that appears at the same time is timed in CSS (see "Timings that live in CSS" below).

### Stalemates and draws

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.stalemate.stalematePause` | 1300 | "STALEMATE!" before zooming out | [`js/timing.js:272`](js/timing.js#L272) | [`js/game.js:1568`](js/game.js#L1568) |
| `TIMING.camera.stalemate.stalemateSettle` | 900 | after the stone lands, before play continues | [`js/timing.js:273`](js/timing.js#L273) | [`js/game.js:1588`](js/game.js#L1588) |
| `TIMING.camera.draw.drawPause` | 1500 | "DRAW!" before the board clears | [`js/timing.js:278`](js/timing.js#L278) | [`js/game.js:1598`](js/game.js#L1598) |
| `TIMING.camera.draw.drawSettle` | 600 | after the board clears, before play (or the wheel) continues | [`js/timing.js:279`](js/timing.js#L279) | [`js/game.js:1614`](js/game.js#L1614) |

A stalemate's zoom out reuses `zoomOutToParent`, `wonFade` and `wonFadeDelay`.

### Browsing with the zoom buttons and minimap, and Gravity

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.browse.browseZoom` | 1000 | flying to the board you clicked | [`js/timing.js:284`](js/timing.js#L284) | [`js/game.js:1675`](js/game.js#L1675) |
| `TIMING.camera.browse.browseFade` | 650 | finished boards fading in or out as you browse ... | [`js/timing.js:285`](js/timing.js#L285) | [`js/game.js:1665`](js/game.js#L1665)<br>[`js/game.js:1667`](js/game.js#L1667) |
| `TIMING.camera.browse.browseFadeDelay` | 250 | ... fading out starts this long after the move starts | [`js/timing.js:286`](js/timing.js#L286) | [`js/game.js:1667`](js/game.js#L1667) |
| `TIMING.camera.gravityTilt` | 1300 | Gravity: the camera re-framing while the board tilts upright | [`js/timing.js:289`](js/timing.js#L289) | [`js/render.js:929`](js/render.js#L929) |

---

## 6. The board's own moves ([`js/game.js`](js/game.js), drawn in [`js/render.js`](js/render.js))

After each move, `postMove()` in `js/game.js` runs the active game type's automatic action. The `...Before` and `...After` pauses decide how long the game holds still around it, so players can see what happened.

### Every game

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.cpuMoveDelay` | 750 | computer's turn: "thinking" time before it plays | [`js/timing.js:310`](js/timing.js#L310) | [`js/game.js:1705`](js/game.js#L1705) |
| `TIMING.board.toast` | 3200 | how long a message at the bottom stays up | [`js/timing.js:311`](js/timing.js#L311) | [`js/game.js:2123`](js/game.js#L2123) |
| `TIMING.board.marks.markDrop` | 750 | a mark falling onto a space and bouncing (the impact is markImpact) | [`js/timing.js:315`](js/timing.js#L315) | [`js/game.js:689`](js/game.js#L689)<br>[`js/render.js:1070`](js/render.js#L1070) |
| `TIMING.board.marks.markImpact` | markDrop × 0.364 (= 273) | when a falling mark first hits (273 ms): sparks, ripple, sound | [`js/timing.js:316`](js/timing.js#L316) | [`js/game.js:466`](js/game.js#L466)<br>[`js/game.js:889`](js/game.js#L889)<br>[`js/game.js:1587`](js/game.js#L1587)<br>[`js/game.js:1805`](js/game.js#L1805)<br>[`js/minimap.js:120`](js/minimap.js#L120)<br>[`js/render.js:737`](js/render.js#L737)<br>[`js/render.js:1064`](js/render.js#L1064) |
| `TIMING.board.marks.vanishPoof` | 240 | Vanishing Marks: the oldest mark's "POOF!" after a fourth mark is placed | [`js/timing.js:317`](js/timing.js#L317) | [`js/game.js:1444`](js/game.js#L1444)<br>[`js/game.js:1453`](js/game.js#L1453) |
| `TIMING.board.marks.ghostFade` | 450 | a removed mark fading out | [`js/timing.js:318`](js/timing.js#L318) | [`js/render.js:1132`](js/render.js#L1132) |

`markImpact` is not a plain number. It is calculated from `markDrop`: it is the moment the bouncing mark first touches the board (36.4% of the way through the drop). Sparks, ripples and the landing sound happen then. Change `markDrop` and the impact effects stay in sync. Only edit the `0.364` if you change the bounce easing (`Ease.outBounce` in `js/render.js`).

### Per game type

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.gravity.gravitySettle` | 450 | Gravity: after the marks finish falling, before the next turn | [`js/timing.js:323`](js/timing.js#L323) | [`js/game.js:766`](js/game.js#L766)<br>[`js/game.js:1220`](js/game.js#L1220)<br>[`js/game.js:1536`](js/game.js#L1536) |
| `TIMING.board.gravity.gravityRaise` | 1700 | Gravity: the board tilting upright (hydraulic push) | [`js/timing.js:324`](js/timing.js#L324) | [`js/game.js:1220`](js/game.js#L1220)<br>[`js/game.js:1823`](js/game.js#L1823)<br>[`js/render.js:926`](js/render.js#L926) |
| `TIMING.board.gravity.gravityRaiseDelay` | 350 | ... starting this long after the Gravity game begins | [`js/timing.js:325`](js/timing.js#L325) | [`js/game.js:1220`](js/game.js#L1220)<br>[`js/game.js:1823`](js/game.js#L1823)<br>[`js/render.js:928`](js/render.js#L928) |
| `TIMING.board.gravity.gravityLower` | 700 | ... and tilting back down once the game is over | [`js/timing.js:326`](js/timing.js#L326) | [`js/render.js:942`](js/render.js#L942) |
| `TIMING.board.shift.shiftBefore` | 420 | Shifting Squares: pause before a row or column shifts | [`js/timing.js:331`](js/timing.js#L331) | [`js/game.js:769`](js/game.js#L769) |
| `TIMING.board.shift.shiftAfter` | 650 | ... and after it, before the next turn | [`js/timing.js:332`](js/timing.js#L332) | [`js/game.js:771`](js/game.js#L771) |
| `TIMING.board.shift.slide` | 420 | a mark sliding to its new space (Shifting Squares, Ring Spin) | [`js/timing.js:333`](js/timing.js#L333) | [`js/render.js:1097`](js/render.js#L1097) |
| `TIMING.board.ringCross.turnBefore` | 420 | Ring Spin / Crossfire: pause before the marks move | [`js/timing.js:338`](js/timing.js#L338) | [`js/game.js:775`](js/game.js#L775) |
| `TIMING.board.ringCross.ringAfter` | 700 | Ring Spin: after the marks move, before the next turn | [`js/timing.js:339`](js/timing.js#L339) | [`js/game.js:777`](js/game.js#L777) |
| `TIMING.board.ringCross.crossAfter` | 800 | Crossfire: after the corners swap, before the next turn | [`js/timing.js:340`](js/timing.js#L340) | [`js/game.js:777`](js/game.js#L777) |
| `TIMING.board.ringCross.crossHop` | 700 | Crossfire: each corner mark's hop over the centre | [`js/timing.js:341`](js/timing.js#L341) | [`js/game.js:843`](js/game.js#L843) |
| `TIMING.board.fog.fogCover` | 650 | Fog of War: a mark disappearing into the fog | [`js/timing.js:346`](js/timing.js#L346) | [`js/game.js:1193`](js/game.js#L1193)<br>[`js/game.js:1199`](js/game.js#L1199)<br>[`js/render.js:663`](js/render.js#L663) |
| `TIMING.board.fog.fogPause` | 500 | ... the pause while it does | [`js/timing.js:347`](js/timing.js#L347) | [`js/game.js:782`](js/game.js#L782) |
| `TIMING.board.fog.fogLiftPause` | 1500 | Fog of War is over: the fog evaporating before play continues | [`js/timing.js:348`](js/timing.js#L348) | [`js/game.js:832`](js/game.js#L832) |
| `TIMING.board.fog.fogLift` | 1300 | ... how long the fog takes to thin away | [`js/timing.js:349`](js/timing.js#L349) | [`js/game.js:1201`](js/game.js#L1201)<br>[`js/render.js:664`](js/render.js#L664)<br>[`js/render.js:669`](js/render.js#L669) |
| `TIMING.board.fog.fogWinFade` | 900 | ... (the fog's fade if a win happens without the lift) | [`js/timing.js:350`](js/timing.js#L350) | [`js/render.js:665`](js/render.js#L665) |
| `TIMING.board.wild.wildBefore` | 250 | Wild Square: pause before the wild mark jumps | [`js/timing.js:355`](js/timing.js#L355) | [`js/game.js:785`](js/game.js#L785) |
| `TIMING.board.wild.wildAfter` | 450 | ... and after, before the next turn | [`js/timing.js:356`](js/timing.js#L356) | [`js/game.js:787`](js/game.js#L787) |

Keep the `...After` pauses at least as long as the animation they wait for. For example, `crossAfter` should be at least `crossHop`, and `shiftAfter` at least `slide`. Otherwise the next turn starts while marks are still moving.

### Wild Square intro

The spaces light up one after another, slowing down, until the light stops on the wild space and the wild mark drops onto it.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.wildIntro.wildIntroStart` | 2950 | after the rule card appears, before the lights start (lets the card fly away) | [`js/timing.js:361`](js/timing.js#L361) | [`js/game.js:671`](js/game.js#L671) |
| `TIMING.board.wildIntro.wildIntroSteps` | 17 | how many random spaces light up before the final one (a count, not ms) | [`js/timing.js:362`](js/timing.js#L362) | [`js/game.js:674`](js/game.js#L674) |
| `TIMING.board.wildIntro.wildStepMin` | 55 | the gap between lights at the start ... | [`js/timing.js:363`](js/timing.js#L363) | [`js/game.js:682`](js/game.js#L682) |
| `TIMING.board.wildIntro.wildStepGrow` | 260 | ... growing by up to this much (on a curve) as the run slows down | [`js/timing.js:364`](js/timing.js#L364) | [`js/game.js:682`](js/game.js#L682) |
| `TIMING.board.wildIntro.wildStepTrail` | 120 | the dim trail left by the previous light | [`js/timing.js:365`](js/timing.js#L365) | [`js/render.js:742`](js/render.js#L742) |
| `TIMING.board.wildIntro.wildDropDelay` | 450 | after the last light, before the wild mark drops | [`js/timing.js:366`](js/timing.js#L366) | [`js/game.js:689`](js/game.js#L689) |
| `TIMING.board.wildIntro.wildLightFade` | 500 | after the mark lands, the light under it fading | [`js/timing.js:367`](js/timing.js#L367) | [`js/game.js:1208`](js/game.js#L1208)<br>[`js/render.js:738`](js/render.js#L738) |

The gap after light *n* is `wildStepMin + wildStepGrow × q³`, where *q* goes from 0 to 1 over the run. The run therefore starts fast and slows sharply at the end. The whole intro ends at `wildIntroStart + (sum of the gaps) + wildDropDelay + markDrop`, and the game waits for it before play starts.

---

## 7. Match Point ([`js/game.js`](js/game.js), drawn in [`js/render.js`](js/render.js))

Match Point is the Turf Battle being played deciding a space that would win a Round for someone. `updateStakes()` spots it as soon as the board is playable. `matchPointSoon()` then waits for the rule title card to land in its plate at the top of the screen (so the two never overlap), waits `delay`, and calls `matchPointMoment()`:

1. The riser (`Sound.matchPointRise`) starts, `riseLead` before the slam.
2. The slam: the big MATCH POINT! title and the line under it (`matchPointBanner()`, the `#mpBanner` element), cinematic letterbox bars, a red flash, a hard screen shake, sparks from both sides of the title, and `Sound.matchPointSlam`. Each deciding space (an empty space that would win this Turf Battle right now for a player on match point) erupts with a ripple and sparks, `sparkGap` apart, and flares with a pillar of light.
3. The announcer says "Match point" `voiceAfter` the slam, and the double heartbeat follows `heartbeatAfter` the slam.
4. The deciding spaces fade from the flare to a steady glow over `lightUp`, then throb with a lub-dub every `glowPulse` until the Turf Battle ends. The red vignette and the stakes bar beat at the same rate. In Fog of War the deciding spaces are not lit, as that would give away the hidden marks.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.matchPoint.delay` | 300 | after the rule title card lands in its plate at the top, before the moment starts | [`js/timing.js:386`](js/timing.js#L386) | [`js/game.js:2064`](js/game.js#L2064) |
| `TIMING.matchPoint.riseLead` | 450 | the rising whoosh starts this long before the title slams down | [`js/timing.js:387`](js/timing.js#L387) | [`js/game.js:1136`](js/game.js#L1136)<br>[`js/game.js:2081`](js/game.js#L2081)<br>[`js/game.js:2106`](js/game.js#L2106) |
| `TIMING.matchPoint.banner` | 2800 | the title on screen: slam, hold, fly off (the letterbox bars too) | [`js/timing.js:388`](js/timing.js#L388) | [`style.css:263`](style.css#L263)<br>[`style.css:276`](style.css#L276)<br>[`style.css:277`](style.css#L277)<br>[`style.css:289`](style.css#L289)<br>[`style.css:310`](style.css#L310)<br>[`style.css:338`](style.css#L338)<br>[`js/timing.js:457`](js/timing.js#L457) |
| `TIMING.matchPoint.voiceAfter` | 120 | after the slam, before "Match point" is announced | [`js/timing.js:389`](js/timing.js#L389) | [`js/game.js:2087`](js/game.js#L2087) |
| `TIMING.matchPoint.heartbeatAfter` | 1000 | after the slam, before the double heartbeat | [`js/timing.js:390`](js/timing.js#L390) | [`js/game.js:2088`](js/game.js#L2088) |
| `TIMING.matchPoint.sparkGap` | 70 | gap between the spark bursts from each deciding space at the slam | [`js/timing.js:391`](js/timing.js#L391) | [`js/game.js:2105`](js/game.js#L2105) |
| `TIMING.matchPoint.lightUp` | 1400 | the burst of light on the deciding spaces fading to a steady glow | [`js/timing.js:392`](js/timing.js#L392) | [`js/render.js:1155`](js/render.js#L1155) |
| `TIMING.matchPoint.glowPulse` | 1100 | one pulse of that steady glow (matches the red vignette's heartbeat) | [`js/timing.js:393`](js/timing.js#L393) | [`js/game.js:1136`](js/game.js#L1136)<br>[`js/render.js:1156`](js/render.js#L1156)<br>[`style.css:148`](style.css#L148)<br>[`style.css:165`](style.css#L165)<br>[`js/timing.js:456`](js/timing.js#L456) |

`banner` and `glowPulse` are handed to `style.css` as `--t-mp-banner` and `--t-mp-pulse` by the `setProperty` lines at the bottom of `js/timing.js`. The keyframes of the title (`mpslam`, `mpsub`, `mpburst`, `mpbartop`, `mpbarbot` in `style.css`) are percentages of `banner`, so changing it stretches the whole title evenly. The volumes of the riser and the slam are `SOUND.effects.matchPointRise` and `.matchPointSlam` in `js/sound-config.js`.

---

## 8. Instant Replay ([`js/game.js`](js/game.js))

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.replay.firstStep` | 1400 | after the replay starts, before the first move plays | [`js/timing.js:410`](js/timing.js#L410) | [`js/game.js:1787`](js/game.js#L1787) |
| `TIMING.replay.stepSameBoard` | 950 | gap between moves on the same board | [`js/timing.js:411`](js/timing.js#L411) | [`js/game.js:1841`](js/game.js#L1841) |
| `TIMING.replay.stepNewBoard` | 1500 | gap after the replay moves to a different board (longer for the camera) | [`js/timing.js:412`](js/timing.js#L412) | [`js/game.js:1841`](js/game.js#L1841) |
| `TIMING.replay.resume` | 400 | after un-pausing, before the next move | [`js/timing.js:413`](js/timing.js#L413) | [`js/game.js:1859`](js/game.js#L1859) |
| `TIMING.replay.cameraFirst` | 900 | the camera's move to the starting board | [`js/timing.js:414`](js/timing.js#L414) | [`js/game.js:1811`](js/game.js#L1811) |
| `TIMING.replay.cameraMove` | 800 | the camera following the replay to a different board | [`js/timing.js:415`](js/timing.js#L415) | [`js/game.js:1811`](js/game.js#L1811) |
| `TIMING.replay.cameraBack` | 900 | the camera's move back to the live game when the replay ends | [`js/timing.js:416`](js/timing.js#L416) | [`js/game.js:1852`](js/game.js#L1852) |
| `TIMING.replay.afterGravityRaise` | 300 | Gravity: after the board locks upright, before the first replayed move drops | [`js/timing.js:417`](js/timing.js#L417) | [`js/game.js:1823`](js/game.js#L1823) |

Replay speed (the 1×, 2×, 4× button) divides the step gaps. The camera durations are not divided.

When the replay reaches a Gravity Turf Battle, the board stands up exactly as it does in a live game (`TIMING.board.gravity.gravityRaiseDelay` + `gravityRaise`, at normal speed whatever the replay speed). `Game.replayTiltWait()` holds the first replayed move until it has locked upright, plus `afterGravityRaise`. Each saved moment is a fresh copy of the board, so `applySnap()` carries the tilt over from one moment to the next; otherwise the board would start standing up again from flat on every move.

---

## 9. Values shared with the stylesheet

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.css.overlayFade` | 250 | the fade-in / fade-out of the full-screen overlays | [`js/timing.js:445`](js/timing.js#L445) | [`style.css:458`](style.css#L458)<br>[`style.css:794`](style.css#L794)<br>[`style.css:852`](style.css#L852)<br>[`js/timing.js:454`](js/timing.js#L454) |

`js/timing.js` sets this value as the CSS custom property `--t-overlay-fade` when the page loads. (`TIMING.matchPoint.banner` and `.glowPulse` are handed over the same way; see section 7.) `style.css` uses it for the fade of the wheel, slot machine and RULE PICK overlays, with `0.25s` as a fallback. The JavaScript `hide` settings in those groups wait for this fade before hiding the overlay. Keep them equal to it or slightly longer.

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

The rule card's `TIMING.ruleCard.hold` (2200) should stay longer than the CSS pop-in (0.45s), or the card will start flying before it has finished appearing.

## What is deliberately not in `TIMING`

Short visual flourishes that never hold up the game are left where they are, next to the drawing code. Examples are particle lifetimes (`life:` values in `js/boom.js`, `js/render.js` and the `Fx` helper in `js/wheel.js`), the speed of looping glows and pulses (`Math.sin(now / 320)` and similar), the Crossfire / Ring Spin / Shifting Squares arrow belt speed (in the renderer, where the chevrons are drawn), and the SVG icon animations (`WILD_CYCLE`, `FOG_ICON` in `js/render.js`). Changing them only changes how an effect looks, not the pacing. If one of them ever needs regular tuning, move it into `TIMING` using the pattern below.

## Adding a new timing

1. Add the value to the right group in `js/timing.js`, with a comment that says what it controls and its unit.
2. In the code, use `TIMING.<group>.<name>` (or `TIMING.<group>.<stage>.<name>` in a group that is split into stages, such as `TIMING.slots.instantWin.suspenseGap`) in place of the number.
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
| `TIMING.lab.before` | 500 | the throwaway board on screen, before the sequence starts | [`js/timing.js:431`](js/timing.js#L431) | [`js/game.js:1094`](js/game.js#L1094) |
| `TIMING.lab.after` | 1200 | after the sequence ends, before the real game comes back | [`js/timing.js:432`](js/timing.js#L432) | [`js/game.js:1027`](js/game.js#L1027) |
| `TIMING.lab.boomWatch` | 2200 | the Explosion button: how long to watch it | [`js/timing.js:433`](js/timing.js#L433) | [`js/game.js:1126`](js/game.js#L1126) |
| `TIMING.lab.bannerWatch` | 2400 | the ROUND banner button: how long to watch it (its animation is 2.2s in style.css) | [`js/timing.js:434`](js/timing.js#L434) | [`js/game.js:1167`](js/game.js#L1167) |

To add a button: add a `[key, group]` line to `Game.LAB_LIST`, a label to `STRINGS.dev.lab.items`, and a scene with the same key in `labScene()`.

### Other shortcuts

- **Fortune Wheel with a chosen game type:** open the browser console and run `Game.dev.on = true; Game.dev.wheel = 'cross'`. The next spin lands on Crossfire. Any key from `RULES` in `js/game.js` works.
- **Trying values without reloading:** most settings are read when they are used, so you can change them live in the console, for example `TIMING.wheel.landing.autoFinish = 1500`. The next time that sequence runs, it uses the new value. To keep the change, copy the number into `js/timing.js`.
- **Slow motion:** Chrome DevTools has an Animations panel (More tools → Animations) that can play DOM animations at 25% or 10% speed. This helps with the overlays. It does not slow down `setTimeout` or the canvas.
