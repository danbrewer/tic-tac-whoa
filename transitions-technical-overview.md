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
| `TIMING.replay` | Instant Replay pacing and camera |
| `TIMING.css` | Values handed to the stylesheet as CSS custom properties |

To change a timing:

1. Open `js/timing.js` and find the setting. Each one has a comment saying what it does.
2. Change the number. **All values are milliseconds** unless the comment says otherwise. A handful are counts or multipliers, and their comments say so.
3. Save and reload the page. No build step is needed.

You should not need to edit any other file to adjust pacing. The tables below list every place in the code that reads each setting. Use them when you want to understand exactly what a value does, or when you want to add a new one.

> **About the line numbers.** The `file:line` references were accurate when this document was written. They drift whenever code above them changes. If a line number looks wrong, search the file for the setting's name (for example `wedgeLiftDelay`). The names are unique within their group, so the search finds the right spot.

## How the code reads the settings

`js/timing.js` is the first script loaded by [`index.html`](index.html#L157), so `TIMING` is available everywhere. Most code reads it directly, as in `TIMING.wheel.announceDelay`. A few functions that read the same group many times give it a short local name at the top of the function:

| Short name | Means | Where |
|---|---|---|
| `T` | `TIMING.wheel` | `dropIn()` in `js/wheel.js` |
| `TS` | `TIMING.slots` | `spin()` and `reveal()` in `js/slots.js` |
| `TP` | `TIMING.rulePick` | `RulePick.open()` in `js/slots.js` |
| `T` | `TIMING.board` | `postMove()` in `js/game.js`, `fogLevel()` in `js/render.js` |
| `TB` | `TIMING.board` | `wildRoulette()` in `js/game.js` |
| `TC` | `TIMING.camera` | `ascend()` in `js/game.js` |

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
| `TIMING.wheel.dropFall` | 620 | the fall itself; the BOOM, dust and squash happen when it ends | [`js/timing.js:41`](js/timing.js#L41) | [`js/wheel.js:421`](js/wheel.js#L421) |
| `TIMING.wheel.dropTitleGap` | 120 | after the slam, before the title text starts popping in | [`js/timing.js:42`](js/timing.js#L42) | [`js/wheel.js:429`](js/wheel.js#L429) |
| `TIMING.wheel.dropTitleIn` | 450 | each title line's pop-in animation | [`js/timing.js:43`](js/timing.js#L43) | [`js/wheel.js:429`](js/wheel.js#L429) |
| `TIMING.wheel.dropTitleStagger` | 90 | extra delay between one title line and the next | [`js/timing.js:44`](js/timing.js#L44) | [`js/wheel.js:429`](js/wheel.js#L429) |
| `TIMING.wheel.dropSquash` | 380 | the squash-and-stretch bounce on impact | [`js/timing.js:45`](js/timing.js#L45) | [`js/wheel.js:434`](js/wheel.js#L434) |
| `TIMING.wheel.dropShake` | 700 | the screen shake on impact | [`js/timing.js:46`](js/timing.js#L46) | [`js/wheel.js:440`](js/wheel.js#L440) |

### Spin

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.autoSpinDelay` | 900 | computer's turn: how long the wheel sits before the computer presses SPIN | [`js/timing.js:38`](js/timing.js#L38) | [`js/wheel.js:638`](js/wheel.js#L638) |
| `TIMING.wheel.windBack` | 520 | the wheel is dragged backwards before it is let go | [`js/timing.js:49`](js/timing.js#L49) | [`js/wheel.js:521`](js/wheel.js#L521) |
| `TIMING.wheel.spinFast` | 6800 | phase A: the long slow-down from full speed ... | [`js/timing.js:50`](js/timing.js#L50) | [`js/wheel.js:529`](js/wheel.js#L529) |
| `TIMING.wheel.spinFastRandom` | 400 | ... plus up to this much extra, so no two spins last exactly the same | [`js/timing.js:51`](js/timing.js#L51) | [`js/wheel.js:529`](js/wheel.js#L529) |
| `TIMING.wheel.spinCrawl` | 3400 | phase B: the final crawl over the last ~3 spokes to the stop | [`js/timing.js:52`](js/timing.js#L52) | [`js/wheel.js:528`](js/wheel.js#L528) |
| `TIMING.wheel.heartbeats` | [1200, 1200, 1000, 1000, 800, 800, 600, 600] | gap before each heartbeat during the spin | [`js/timing.js:53`](js/timing.js#L53) | [`js/wheel.js:538`](js/wheel.js#L538)<br>[`js/wheel.js:569`](js/wheel.js#L569) |
| `TIMING.wheel.heartbeatFast` | 400 | gap between heartbeats once the list above runs out | [`js/timing.js:54`](js/timing.js#L54) | [`js/wheel.js:569`](js/wheel.js#L569)<br>[`js/wheel.js:570`](js/wheel.js#L570) |
| `TIMING.wheel.heartbeatPulse` | 420 | how long each heartbeat's "throb" of the wheel lasts | [`js/timing.js:55`](js/timing.js#L55) | [`js/wheel.js:576`](js/wheel.js#L576) |
| `TIMING.wheel.heartbeatStopGuard` | 120 | no heartbeat starts this close to the moment the wheel stops | [`js/timing.js:56`](js/timing.js#L56) | [`js/wheel.js:573`](js/wheel.js#L573) |
| `TIMING.wheel.pointerFlick` | 140 | the pointer's flick each time a spoke passes it | [`js/timing.js:57`](js/timing.js#L57) | [`js/wheel.js:361`](js/wheel.js#L361) |

The full spin lasts `spinFast + spinCrawl` (about 10 to 10.6 seconds), after the `windBack`. The spin's *distance* is worked out from these durations, so the wheel always lands on the chosen segment whatever values you pick. The suspense effects (glow, drum roll, jitter) start at 55% of the spin. That percentage is a ratio in `go()`, not a timing.

### Landing and announcement

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.wedgeLiftDelay` | 450 | after the wheel stops, before the winning wedge pops out | [`js/timing.js:60`](js/timing.js#L60) | [`js/wheel.js:618`](js/wheel.js#L618) |
| `TIMING.wheel.wedgeLift` | 950 | the wedge rising up and flipping to face the player | [`js/timing.js:61`](js/timing.js#L61) | [`js/wheel.js:614`](js/wheel.js#L614) |
| `TIMING.wheel.announceDelay` | 1400 | after the wheel stops: big burst, the game's name, and its voice-over | [`js/timing.js:62`](js/timing.js#L62) | [`js/wheel.js:633`](js/wheel.js#L633) |
| `TIMING.wheel.clickSkipVoiced` | 2600 | after the announcement, how soon a click can skip ahead (game has a voice-over) | [`js/timing.js:63`](js/timing.js#L63) | [`js/wheel.js:632`](js/wheel.js#L632) |
| `TIMING.wheel.clickSkip` | 0 | the same, for a game without a voice-over | [`js/timing.js:64`](js/timing.js#L64) | [`js/wheel.js:632`](js/wheel.js#L632) |
| `TIMING.wheel.autoFinishVoiced` | 5000 | after the wheel stops, blast off on its own (game has a voice-over) | [`js/timing.js:65`](js/timing.js#L65) | [`js/wheel.js:634`](js/wheel.js#L634) |
| `TIMING.wheel.autoFinish` | 3300 | the same, for a game without a voice-over | [`js/timing.js:66`](js/timing.js#L66) | [`js/wheel.js:634`](js/wheel.js#L634) |

The "Voiced" values apply to game types that have a voice-over MP3 (see `RULE_VOICES` in `js/sound.js`). `autoFinishVoiced` must be longer than `announceDelay` plus the length of the longest voice-over, or the wheel will leave while the voice is still talking.

### Blast-off

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.wheel.blastUiFade` | 300 | the title and result text fade away | [`js/timing.js:69`](js/timing.js#L69) | [`js/wheel.js:446`](js/wheel.js#L446) |
| `TIMING.wheel.blastRumble` | 800 | rumbling and fire on the ground before lift-off | [`js/timing.js:70`](js/timing.js#L70) | [`js/wheel.js:447`](js/wheel.js#L447) |
| `TIMING.wheel.blastFly` | 1000 | the flight up and off the screen | [`js/timing.js:71`](js/timing.js#L71) | [`js/wheel.js:447`](js/wheel.js#L447) |
| `TIMING.wheel.blastCleanup` | 400 | after the flight, before leftover animations are cleared | [`js/timing.js:72`](js/timing.js#L72) | [`js/wheel.js:477`](js/wheel.js#L477) |
| `TIMING.wheel.hide` | 260 | the overlay's fade-out before the game continues (matches --t-overlay-fade) | [`js/timing.js:73`](js/timing.js#L73) | [`js/wheel.js:609`](js/wheel.js#L609) |

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

### Opening and the reels

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.jackpotFoundDelay` | 300 | game.js: after the mark lands on the jackpot space, before "JACKPOT!" | [`js/timing.js:92`](js/timing.js#L92) | [`js/game.js:979`](js/game.js#L979) |
| `TIMING.slots.jackpotToMachine` | 900 | game.js: after "JACKPOT!", before the slot machine appears | [`js/timing.js:93`](js/timing.js#L93) | [`js/game.js:987`](js/game.js#L987) |
| `TIMING.slots.autoPullDelay` | 900 | computer's turn: how long before the computer pulls the lever | [`js/timing.js:94`](js/timing.js#L94) | [`js/slots.js:252`](js/slots.js#L252) |
| `TIMING.slots.reelStops` | [1000, 1400, 1800, 2200, 2600] |  | [`js/timing.js:97`](js/timing.js#L97) | [`js/slots.js:190`](js/slots.js#L190) |
| `TIMING.slots.teaserExtra` | 450 | a likely win on reels 1+2: reels 3, 4, 5 stop 450, 900, 1350 later | [`js/timing.js:98`](js/timing.js#L98) | [`js/slots.js:190`](js/slots.js#L190) |
| `TIMING.slots.windupFirstStop` | 1000 | INSTANT WIN on reel 1: when reel 1 stops ... | [`js/timing.js:99`](js/timing.js#L99) | [`js/slots.js:192`](js/slots.js#L192) |
| `TIMING.slots.windupGap` | 1100 | ... and the gap before each later reel stops | [`js/timing.js:100`](js/timing.js#L100) | [`js/slots.js:194`](js/slots.js#L194) |
| `TIMING.slots.windupBrokenGap` | 380 | ... but only this gap once the INSTANT WIN streak is broken | [`js/timing.js:101`](js/timing.js#L101) | [`js/slots.js:195`](js/slots.js#L195) |
| `TIMING.slots.suspenseGap` | 3200 | two INSTANT WINs lined up: the gap before the deciding third reel stops | [`js/timing.js:102`](js/timing.js#L102) | [`js/slots.js:196`](js/slots.js#L196) |
| `TIMING.slots.windupTeaseDelay` | 30 | after reel 1 stops, before "INSTANT WIN on reel 1..." appears | [`js/timing.js:103`](js/timing.js#L103) | [`js/slots.js:212`](js/slots.js#L212) |
| `TIMING.slots.oneMoreTextDelay` | 650 | after reel 2 stops, before "ONE MORE FOR AN INSTANT WIN..." appears | [`js/timing.js:104`](js/timing.js#L104) | [`js/slots.js:238`](js/slots.js#L238) |
| `TIMING.slots.tickGapStart` | 50 | the reel ticking sound: gap between ticks at the start ... | [`js/timing.js:105`](js/timing.js#L105) | [`js/slots.js:247`](js/slots.js#L247) |
| `TIMING.slots.tickGapGrow` | 150 | ... growing by up to this much as the reels slow down | [`js/timing.js:106`](js/timing.js#L106) | [`js/slots.js:247`](js/slots.js#L247) |
| `TIMING.slots.tickStopGuard` | 120 | the ticking stops this long before the last reel stops | [`js/timing.js:107`](js/timing.js#L107) | [`js/slots.js:247`](js/slots.js#L247) |

How long each reel visibly spins follows from its stop time: the code adds about one symbol of strip per 75 ms of extra spin. You don't need to change that when you change the stop times.

### The result and closing

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.revealDelay` | 200 | after the last reel stops, before the prize is shown | [`js/timing.js:110`](js/timing.js#L110) | [`js/slots.js:249`](js/slots.js#L249) |
| `TIMING.slots.clickSkip` | 400 | after the reveal, how soon a click closes the machine | [`js/timing.js:111`](js/timing.js#L111) | [`js/slots.js:297`](js/slots.js#L297) |
| `TIMING.slots.autoFinishBust` | 2200 | after the reveal, the machine closes on its own: no prize | [`js/timing.js:112`](js/timing.js#L112) | [`js/slots.js:298`](js/slots.js#L298) |
| `TIMING.slots.autoFinishJackpot` | 5600 | ... INSTANT WIN | [`js/timing.js:113`](js/timing.js#L113) | [`js/slots.js:298`](js/slots.js#L298) |
| `TIMING.slots.autoFinishPrize` | 3600 | ... any other prize | [`js/timing.js:114`](js/timing.js#L114) | [`js/slots.js:298`](js/slots.js#L298) |
| `TIMING.slots.instantGlow` | 5200 | how long the machine glows after an INSTANT WIN | [`js/timing.js:115`](js/timing.js#L115) | [`js/slots.js:279`](js/slots.js#L279) |
| `TIMING.slots.hide` | 250 | the overlay's fade-out before the game continues (matches --t-overlay-fade) | [`js/timing.js:116`](js/timing.js#L116) | [`js/slots.js:294`](js/slots.js#L294) |

### The INSTANT WIN! title

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.bannerBoomFirst` | 150 | the first explosion around the title | [`js/timing.js:119`](js/timing.js#L119) | [`js/slots.js:377`](js/slots.js#L377) |
| `TIMING.slots.bannerBoomGap` | 260 | gap between those explosions (6 of them) | [`js/timing.js:120`](js/timing.js#L120) | [`js/slots.js:377`](js/slots.js#L377) |
| `TIMING.slots.bannerCellBurstGap` | 90 | gap between the bursts on each winning symbol | [`js/timing.js:121`](js/timing.js#L121) | [`js/slots.js:382`](js/slots.js#L382) |
| `TIMING.slots.bannerFailsafe` | 9000 | the title blows itself up after this long if the machine is still open | [`js/timing.js:122`](js/timing.js#L122) | [`js/slots.js:384`](js/slots.js#L384) |
| `TIMING.slots.lockFlash` | 600 | the white flash each time an INSTANT WIN locks into place on a reel | [`js/timing.js:123`](js/timing.js#L123) | [`js/slots.js:352`](js/slots.js#L352) |
| `TIMING.slots.letterGap` | 45 | the title blowing apart: delay between one letter and the next | [`js/timing.js:124`](js/timing.js#L124) | [`js/slots.js:398`](js/slots.js#L398)<br>[`js/slots.js:420`](js/slots.js#L420) |
| `TIMING.slots.letterFly` | 720 | each letter flying away | [`js/timing.js:125`](js/timing.js#L125) | [`js/slots.js:407`](js/slots.js#L407) |
| `TIMING.slots.letterBoom` | 130 | after a letter starts flying, its little explosion | [`js/timing.js:126`](js/timing.js#L126) | [`js/slots.js:417`](js/slots.js#L417) |
| `TIMING.slots.letterCleanup` | 1500 | after the last letter starts, before the leftovers are removed | [`js/timing.js:127`](js/timing.js#L127) | [`js/slots.js:420`](js/slots.js#L420) |

### What happens after the prize

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.slots.prizeSettle` | 700 | after a STEAL or a BOMB lands, before play continues | [`js/timing.js:130`](js/timing.js#L130) | [`js/game.js:1052`](js/game.js#L1052) |
| `TIMING.slots.cpuTargetDelay` | 1000 | computer's turn: how long before it picks which mark to steal or bomb | [`js/timing.js:131`](js/timing.js#L131) | [`js/game.js:1062`](js/game.js#L1062) |
| `TIMING.slots.rulePickSettle` | 3000 | after a RULE PICK, how long the "next game" card is on screen | [`js/timing.js:132`](js/timing.js#L132) | [`js/game.js:1013`](js/game.js#L1013) |

### The explosion when the machine leaves ([`js/boom.js`](js/boom.js))

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.boom.blastFirst` | 140 | the first ring blast after the centre one | [`js/timing.js:142`](js/timing.js#L142) | [`js/boom.js:22`](js/boom.js#L22) |
| `TIMING.boom.blastGap` | 95 | gap between the ring blasts (7 of them, plus up to 60 random) | [`js/timing.js:143`](js/timing.js#L143) | [`js/boom.js:22`](js/boom.js#L22) |
| `TIMING.boom.shake` | 900 | the screen shake | [`js/timing.js:144`](js/timing.js#L144) | [`js/boom.js:48`](js/boom.js#L48) |

---

## 3. RULE PICK ([`js/slots.js`](js/slots.js), `RulePick`)

RULE PICK is a slot machine prize. The player picks the game type for the next Turf Battle from a hand of cards. The chosen card shatters and the others are blown away. Then the title card shows the choice (section 4).

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.rulePick.cardFlipFirst` | 250 | the deal: the first card's flip sound ... | [`js/timing.js:155`](js/timing.js#L155) | [`js/slots.js:541`](js/slots.js#L541) |
| `TIMING.rulePick.cardFlipGap` | 110 | ... and the gap between cards | [`js/timing.js:156`](js/timing.js#L156) | [`js/slots.js:541`](js/slots.js#L541) |
| `TIMING.rulePick.swell` | 420 | the chosen card swells and trembles, then shatters | [`js/timing.js:157`](js/timing.js#L157) | [`js/slots.js:561`](js/slots.js#L561)<br>[`js/slots.js:591`](js/slots.js#L591) |
| `TIMING.rulePick.shake` | 420 | the panel shake when it shatters | [`js/timing.js:158`](js/timing.js#L158) | [`js/slots.js:575`](js/slots.js#L575) |
| `TIMING.rulePick.cardsFly` | 1000 | the other cards being blown off the screen (plus up to 250 random) | [`js/timing.js:159`](js/timing.js#L159) | [`js/slots.js:589`](js/slots.js#L589) |
| `TIMING.rulePick.exitDelay` | 2000 | after a card is chosen, before the overlay fades away | [`js/timing.js:160`](js/timing.js#L160) | [`js/slots.js:595`](js/slots.js#L595) |
| `TIMING.rulePick.hide` | 260 | the overlay's fade-out (matches --t-overlay-fade) | [`js/timing.js:161`](js/timing.js#L161) | [`js/slots.js:594`](js/slots.js#L594) |
| `TIMING.rulePick.cpuStart` | 1100 | computer's turn: before the highlight starts running over the cards | [`js/timing.js:162`](js/timing.js#L162) | [`js/slots.js:611`](js/slots.js#L611) |
| `TIMING.rulePick.cpuHopBase` | 70 | the highlight's first hop ... | [`js/timing.js:163`](js/timing.js#L163) | [`js/slots.js:609`](js/slots.js#L609) |
| `TIMING.rulePick.cpuHopGrow` | 1.6 | ... each hop n waits cpuHopBase + n * n * cpuHopGrow (NOT ms: a multiplier) | [`js/timing.js:164`](js/timing.js#L164) | [`js/slots.js:609`](js/slots.js#L609) |
| `TIMING.rulePick.cpuChoose` | 350 | after the highlight stops, before the card is chosen | [`js/timing.js:165`](js/timing.js#L165) | [`js/slots.js:607`](js/slots.js#L607) |

The computer's highlight takes `cpuStart`, then hop *n* waits `cpuHopBase + n × n × cpuHopGrow`, then `cpuChoose`. To make the computer decide faster, lower `cpuHopGrow` first.

---

## 4. Rule title card ([`js/game.js`](js/game.js) `showRuleCard()`, [`js/boom.js`](js/boom.js) `IconFly`)

The big card in the middle of the screen names the game type. After `hold` it shrinks and flies up into the plate at the top of the screen.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.ruleCard.hold` | 2200 | how long the card stays in the middle before flying up to the top plate | [`js/timing.js:178`](js/timing.js#L178) | [`js/game.js:721`](js/game.js#L721) |
| `TIMING.ruleCard.fly` | 720 | the flight up into the plate at the top of the screen | [`js/timing.js:179`](js/timing.js#L179) | [`js/game.js:719`](js/game.js#L719) |
| `TIMING.ruleCard.failsafe` | 4200 | the card is removed after this long no matter what | [`js/timing.js:180`](js/timing.js#L180) | [`js/game.js:723`](js/game.js#L723) |
| `TIMING.ruleCard.afterCard` | 900 | after the card appears, before the Turf Battle can be played | [`js/timing.js:181`](js/timing.js#L181) | [`js/game.js:403`](js/game.js#L403) |
| `TIMING.ruleCard.iconLift` | 900 | RULE PICK: the chosen card's icon leaping to centre stage | [`js/timing.js:182`](js/timing.js#L182) | [`js/boom.js:203`](js/boom.js#L203) |
| `TIMING.ruleCard.iconIdle` | 520 | ... then bobbing there (one swing) | [`js/timing.js:183`](js/timing.js#L183) | [`js/boom.js:208`](js/boom.js#L208) |
| `TIMING.ruleCard.iconLandDelay` | 470 | after the title card appears, before the icon flies onto it | [`js/timing.js:184`](js/timing.js#L184) | [`js/boom.js:212`](js/boom.js#L212) |
| `TIMING.ruleCard.iconLand` | 560 | the icon's flight onto the card | [`js/timing.js:185`](js/timing.js#L185) | [`js/boom.js:226`](js/boom.js#L226) |
| `TIMING.ruleCard.iconBounce` | 380 | the card's icon bouncing when the flying icon lands on it | [`js/timing.js:186`](js/timing.js#L186) | [`js/boom.js:228`](js/boom.js#L228) |

`afterCard` is how long `startRule()` waits after showing the card before the Turf Battle can be played. For Wild Square the wait is longer: it lasts until the wild mark has landed (see `wildIntroStart` in section 6).

---

## 5. Camera moves between boards ([`js/game.js`](js/game.js))

The camera itself is `Renderer.flyTo()` in [`js/render.js`](js/render.js). It zooms around a fixed point so the move feels like a real zoom. These settings choose how long each move takes and how long the game pauses around it.

### Into a Turf Battle, and back out after a win

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.zoomIntoChild` | 1200 | a player picks a space: zoom down into its new Turf Battle (or lower level) | [`js/timing.js:202`](js/timing.js#L202) | [`js/game.js:487`](js/game.js#L487) |
| `TIMING.camera.childFadeIn` | 700 | ... the new board fading in during that zoom | [`js/timing.js:203`](js/timing.js#L203) | [`js/game.js:486`](js/game.js#L486) |
| `TIMING.camera.winPause` | 1400 | a board is won: celebrate before zooming out | [`js/timing.js:204`](js/timing.js#L204) | [`js/game.js:580`](js/game.js#L580) |
| `TIMING.camera.zoomOutToParent` | 1200 | zoom out from the won board to the board above it | [`js/timing.js:205`](js/timing.js#L205) | [`js/game.js:588`](js/game.js#L588)<br>[`js/game.js:1085`](js/game.js#L1085) |
| `TIMING.camera.wonFade` | 800 | ... the won board fading away during that zoom ... | [`js/timing.js:206`](js/timing.js#L206) | [`js/game.js:587`](js/game.js#L587)<br>[`js/game.js:1084`](js/game.js#L1084) |
| `TIMING.camera.wonFadeDelay` | 250 | ... starting this long after the zoom starts | [`js/timing.js:207`](js/timing.js#L207) | [`js/game.js:587`](js/game.js#L587)<br>[`js/game.js:1084`](js/game.js#L1084) |
| `TIMING.camera.afterClaim` | 800 | after the winner's mark drops into the board above, before play continues | [`js/timing.js:208`](js/timing.js#L208) | [`js/game.js:594`](js/game.js#L594) |
| `TIMING.camera.winLineFirst` | 120 | the winning line's sparkles: the first space ... | [`js/timing.js:209`](js/timing.js#L209) | [`js/game.js:576`](js/game.js#L576) |
| `TIMING.camera.winLineGap` | 110 | ... and the gap between spaces | [`js/timing.js:210`](js/timing.js#L210) | [`js/game.js:576`](js/game.js#L576) |

### A whole level is won (moving up to a new level)

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.ascendZoom` | 1900 | the zoom out to the new level | [`js/timing.js:213`](js/timing.js#L213) | [`js/game.js:624`](js/game.js#L624) |
| `TIMING.camera.ascendNewFadeIn` | 1000 | the new board fading in ... | [`js/timing.js:214`](js/timing.js#L214) | [`js/game.js:622`](js/game.js#L622) |
| `TIMING.camera.ascendNewFadeDelay` | 200 | ... starting this long after the zoom starts | [`js/timing.js:215`](js/timing.js#L215) | [`js/game.js:622`](js/game.js#L622) |
| `TIMING.camera.ascendOldFade` | 900 | the old board fading out ... | [`js/timing.js:216`](js/timing.js#L216) | [`js/game.js:623`](js/game.js#L623) |
| `TIMING.camera.ascendOldFadeDelay` | 900 | ... starting this long after the zoom starts | [`js/timing.js:217`](js/timing.js#L217) | [`js/game.js:623`](js/game.js#L623) |
| `TIMING.camera.ascendWaveDelay` | 250 | after the zoom, before the ripple across the new board | [`js/timing.js:218`](js/timing.js#L218) | [`js/game.js:630`](js/game.js#L630) |
| `TIMING.camera.ascendSettle` | 700 | after the zoom, before play continues | [`js/timing.js:219`](js/timing.js#L219) | [`js/game.js:632`](js/game.js#L632) |

The "LEVEL N" banner that appears at the same time is timed in CSS (see "Timings that live in CSS" below).

### Stalemates and draws

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.stalematePause` | 1300 | "STALEMATE!" before zooming out | [`js/timing.js:222`](js/timing.js#L222) | [`js/game.js:1082`](js/game.js#L1082) |
| `TIMING.camera.stalemateSettle` | 900 | after the stone lands, before play continues | [`js/timing.js:223`](js/timing.js#L223) | [`js/game.js:1102`](js/game.js#L1102) |
| `TIMING.camera.drawPause` | 1500 | "DRAW!" before the board clears | [`js/timing.js:226`](js/timing.js#L226) | [`js/game.js:1112`](js/game.js#L1112) |
| `TIMING.camera.drawSettle` | 600 | after the board clears, before play (or the wheel) continues | [`js/timing.js:227`](js/timing.js#L227) | [`js/game.js:1128`](js/game.js#L1128) |

A stalemate's zoom out reuses `zoomOutToParent`, `wonFade` and `wonFadeDelay`.

### Browsing with the zoom buttons and minimap, and Gravity

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.camera.browseZoom` | 1000 | flying to the board you clicked | [`js/timing.js:230`](js/timing.js#L230) | [`js/game.js:1189`](js/game.js#L1189) |
| `TIMING.camera.browseFade` | 650 | finished boards fading in or out as you browse ... | [`js/timing.js:231`](js/timing.js#L231) | [`js/game.js:1179`](js/game.js#L1179)<br>[`js/game.js:1181`](js/game.js#L1181) |
| `TIMING.camera.browseFadeDelay` | 250 | ... fading out starts this long after the move starts | [`js/timing.js:232`](js/timing.js#L232) | [`js/game.js:1181`](js/game.js#L1181) |
| `TIMING.camera.gravityTilt` | 1300 | Gravity: the camera re-framing while the board tilts upright | [`js/timing.js:234`](js/timing.js#L234) | [`js/render.js:926`](js/render.js#L926) |

---

## 6. The board's own moves ([`js/game.js`](js/game.js), drawn in [`js/render.js`](js/render.js))

After each move, `postMove()` in `js/game.js` runs the active game type's automatic action. The `...Before` and `...After` pauses decide how long the game holds still around it, so players can see what happened.

### Every game

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.cpuMoveDelay` | 750 | computer's turn: "thinking" time before it plays | [`js/timing.js:255`](js/timing.js#L255) | [`js/game.js:1219`](js/game.js#L1219) |
| `TIMING.board.markDrop` | 750 | a mark falling onto a space and bouncing (the impact is markImpact) | [`js/timing.js:256`](js/timing.js#L256) | [`js/game.js:673`](js/game.js#L673)<br>[`js/render.js:1064`](js/render.js#L1064) |
| `TIMING.board.markImpact` | markDrop × 0.364 (= 273) | when a falling mark first hits (273 ms): sparks, ripple, sound | [`js/timing.js:257`](js/timing.js#L257) | [`js/game.js:451`](js/game.js#L451)<br>[`js/game.js:873`](js/game.js#L873)<br>[`js/game.js:1101`](js/game.js#L1101)<br>[`js/game.js:1316`](js/game.js#L1316)<br>[`js/minimap.js:120`](js/minimap.js#L120)<br>[`js/render.js:734`](js/render.js#L734)<br>[`js/render.js:1058`](js/render.js#L1058) |
| `TIMING.board.vanishPoof` | 240 | Vanishing Marks: the oldest mark's "POOF!" after a fourth mark is placed | [`js/timing.js:258`](js/timing.js#L258) | [`js/game.js:964`](js/game.js#L964)<br>[`js/game.js:973`](js/game.js#L973) |
| `TIMING.board.ghostFade` | 450 | a removed mark fading out | [`js/timing.js:259`](js/timing.js#L259) | [`js/render.js:1126`](js/render.js#L1126) |
| `TIMING.board.toast` | 3200 | how long a message at the bottom stays up | [`js/timing.js:260`](js/timing.js#L260) | [`js/game.js:1558`](js/game.js#L1558) |

`markImpact` is not a plain number. It is calculated from `markDrop`: it is the moment the bouncing mark first touches the board (36.4% of the way through the drop). Sparks, ripples and the landing sound happen then. Change `markDrop` and the impact effects stay in sync. Only edit the `0.364` if you change the bounce easing (`Ease.outBounce` in `js/render.js`).

### Per game type

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.gravitySettle` | 450 | Gravity: after the marks finish falling, before the next turn | [`js/timing.js:262`](js/timing.js#L262) | [`js/game.js:750`](js/game.js#L750) |
| `TIMING.board.gravityRaise` | 1700 | Gravity: the board tilting upright (hydraulic push) | [`js/timing.js:263`](js/timing.js#L263) | [`js/render.js:923`](js/render.js#L923) |
| `TIMING.board.gravityRaiseDelay` | 350 | ... starting this long after the Gravity game begins | [`js/timing.js:264`](js/timing.js#L264) | [`js/render.js:925`](js/render.js#L925) |
| `TIMING.board.gravityLower` | 700 | ... and tilting back down once the game is over | [`js/timing.js:265`](js/timing.js#L265) | [`js/render.js:939`](js/render.js#L939) |
| `TIMING.board.shiftBefore` | 420 | Shifting Squares: pause before a row or column shifts | [`js/timing.js:266`](js/timing.js#L266) | [`js/game.js:753`](js/game.js#L753) |
| `TIMING.board.shiftAfter` | 650 | ... and after it, before the next turn | [`js/timing.js:267`](js/timing.js#L267) | [`js/game.js:755`](js/game.js#L755) |
| `TIMING.board.slide` | 420 | a mark sliding to its new space (Shifting Squares, Ring Spin) | [`js/timing.js:268`](js/timing.js#L268) | [`js/render.js:1091`](js/render.js#L1091) |
| `TIMING.board.turnBefore` | 420 | Ring Spin / Crossfire: pause before the marks move | [`js/timing.js:269`](js/timing.js#L269) | [`js/game.js:759`](js/game.js#L759) |
| `TIMING.board.ringAfter` | 700 | Ring Spin: after the marks move, before the next turn | [`js/timing.js:270`](js/timing.js#L270) | [`js/game.js:761`](js/game.js#L761) |
| `TIMING.board.crossAfter` | 800 | Crossfire: after the corners swap, before the next turn | [`js/timing.js:271`](js/timing.js#L271) | [`js/game.js:761`](js/game.js#L761) |
| `TIMING.board.crossHop` | 700 | Crossfire: each corner mark's hop over the centre | [`js/timing.js:272`](js/timing.js#L272) | [`js/game.js:827`](js/game.js#L827) |
| `TIMING.board.fogCover` | 650 | Fog of War: a mark disappearing into the fog | [`js/timing.js:273`](js/timing.js#L273) | [`js/render.js:660`](js/render.js#L660) |
| `TIMING.board.fogPause` | 500 | ... the pause while it does | [`js/timing.js:274`](js/timing.js#L274) | [`js/game.js:766`](js/game.js#L766) |
| `TIMING.board.fogLiftPause` | 1500 | Fog of War is over: the fog evaporating before play continues | [`js/timing.js:275`](js/timing.js#L275) | [`js/game.js:816`](js/game.js#L816) |
| `TIMING.board.fogLift` | 1300 | ... how long the fog takes to thin away | [`js/timing.js:276`](js/timing.js#L276) | [`js/render.js:661`](js/render.js#L661)<br>[`js/render.js:666`](js/render.js#L666) |
| `TIMING.board.fogWinFade` | 900 | ... (the fog's fade if a win happens without the lift) | [`js/timing.js:277`](js/timing.js#L277) | [`js/render.js:662`](js/render.js#L662) |
| `TIMING.board.wildBefore` | 250 | Wild Square: pause before the wild mark jumps | [`js/timing.js:278`](js/timing.js#L278) | [`js/game.js:769`](js/game.js#L769) |
| `TIMING.board.wildAfter` | 450 | ... and after, before the next turn | [`js/timing.js:279`](js/timing.js#L279) | [`js/game.js:771`](js/game.js#L771) |

Keep the `...After` pauses at least as long as the animation they wait for. For example, `crossAfter` should be at least `crossHop`, and `shiftAfter` at least `slide`. Otherwise the next turn starts while marks are still moving.

### Wild Square intro

The spaces light up one after another, slowing down, until the light stops on the wild space and the wild mark drops onto it.

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.board.wildIntroStart` | 2950 | after the rule card appears, before the lights start (lets the card fly away) | [`js/timing.js:282`](js/timing.js#L282) | [`js/game.js:655`](js/game.js#L655) |
| `TIMING.board.wildIntroSteps` | 17 | how many random spaces light up before the final one (a count, not ms) | [`js/timing.js:283`](js/timing.js#L283) | [`js/game.js:658`](js/game.js#L658) |
| `TIMING.board.wildStepMin` | 55 | the gap between lights at the start ... | [`js/timing.js:284`](js/timing.js#L284) | [`js/game.js:666`](js/game.js#L666) |
| `TIMING.board.wildStepGrow` | 260 | ... growing by up to this much (on a curve) as the run slows down | [`js/timing.js:285`](js/timing.js#L285) | [`js/game.js:666`](js/game.js#L666) |
| `TIMING.board.wildStepTrail` | 120 | the dim trail left by the previous light | [`js/timing.js:286`](js/timing.js#L286) | [`js/render.js:739`](js/render.js#L739) |
| `TIMING.board.wildDropDelay` | 450 | after the last light, before the wild mark drops | [`js/timing.js:287`](js/timing.js#L287) | [`js/game.js:673`](js/game.js#L673) |
| `TIMING.board.wildLightFade` | 500 | after the mark lands, the light under it fading | [`js/timing.js:288`](js/timing.js#L288) | [`js/render.js:735`](js/render.js#L735) |

The gap after light *n* is `wildStepMin + wildStepGrow × q³`, where *q* goes from 0 to 1 over the run. The run therefore starts fast and slows sharply at the end. The whole intro ends at `wildIntroStart + (sum of the gaps) + wildDropDelay + markDrop`, and the game waits for it before play starts.

---

## 7. Instant Replay ([`js/game.js`](js/game.js))

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.replay.firstStep` | 1400 | after the replay starts, before the first move plays | [`js/timing.js:303`](js/timing.js#L303) | [`js/game.js:1301`](js/game.js#L1301) |
| `TIMING.replay.stepSameBoard` | 950 | gap between moves on the same board | [`js/timing.js:304`](js/timing.js#L304) | [`js/game.js:1338`](js/game.js#L1338) |
| `TIMING.replay.stepNewBoard` | 1500 | gap after the replay moves to a different board (longer for the camera) | [`js/timing.js:305`](js/timing.js#L305) | [`js/game.js:1338`](js/game.js#L1338) |
| `TIMING.replay.resume` | 400 | after un-pausing, before the next move | [`js/timing.js:306`](js/timing.js#L306) | [`js/game.js:1356`](js/game.js#L1356) |
| `TIMING.replay.cameraFirst` | 900 | the camera's move to the starting board | [`js/timing.js:307`](js/timing.js#L307) | [`js/game.js:1322`](js/game.js#L1322) |
| `TIMING.replay.cameraMove` | 800 | the camera following the replay to a different board | [`js/timing.js:308`](js/timing.js#L308) | [`js/game.js:1322`](js/game.js#L1322) |
| `TIMING.replay.cameraBack` | 900 | the camera's move back to the live game when the replay ends | [`js/timing.js:309`](js/timing.js#L309) | [`js/game.js:1349`](js/game.js#L1349) |

Replay speed (the 1×, 2×, 4× button) divides the step gaps. The camera durations are not divided.

---

## 8. Values shared with the stylesheet

| Setting | Default | What it controls | Defined at | Used at |
|---|---|---|---|---|
| `TIMING.css.overlayFade` | 250 | the fade-in / fade-out of the full-screen overlays | [`js/timing.js:319`](js/timing.js#L319) | [`style.css:333`](style.css#L333)<br>[`style.css:659`](style.css#L659)<br>[`style.css:717`](style.css#L717)<br>[`js/timing.js:328`](js/timing.js#L328) |

`js/timing.js` sets this value as the CSS custom property `--t-overlay-fade` when the page loads. `style.css` uses it for the fade of the wheel, slot machine and RULE PICK overlays, with `0.25s` as a fallback. The JavaScript `hide` settings in those groups wait for this fade before hiding the overlay. Keep them equal to it or slightly longer.

To add another CSS timing the same way:

1. Add the value to `TIMING.css`.
2. Add a `setProperty` line at the bottom of `js/timing.js`.
3. In `style.css`, write `var(--your-name, <fallback>)`.

---

## Timings that live in CSS

These animations are defined only in [`style.css`](style.css). Edit them there. The times are in seconds (`s`).

| What | Where | Current |
|---|---|---|
| "LEVEL N" banner when a new level starts | [`style.css:207`](style.css#L207) (`.banner.play`) | 2.2s |
| Rule title card fading in | [`style.css:610`](style.css#L610) (`.rulecard.play`) | 0.25s |
| Rule title card popping in | [`style.css:617`](style.css#L617) (`.rulecard.play .rc-inner`) | 0.45s |
| Slot machine panel scaling in | [`style.css:351`](style.css#L351) | 0.45s |
| Wheel panel scaling in | [`style.css:721`](style.css#L721) (`.wh-panel`) | 0.45s |
| Winning-wedge hub icon fading during the lift | [`style.css:748`](style.css#L748) (`#wheel.lifting .wh-spin`) | 0.3s |
| Message toast popping in | [`style.css:243`](style.css#L243) (`.toast.show`) | 0.35s |
| Replay progress bar | [`style.css:1093`](style.css#L1093) (`.rp-fill`) | 0.4s |

The rule card's `TIMING.ruleCard.hold` (2200) should stay longer than the CSS pop-in (0.45s), or the card will start flying before it has finished appearing.

## What is deliberately not in `TIMING`

Short visual flourishes that never hold up the game are left where they are, next to the drawing code. Examples are particle lifetimes (`life:` values in `js/boom.js`, `js/render.js` and the `Fx` helper in `js/wheel.js`), the speed of looping glows and pulses (`Math.sin(now / 320)` and similar), the Crossfire / Ring Spin / Shifting Squares arrow belt speed (in the renderer, where the chevrons are drawn), and the SVG icon animations (`WILD_CYCLE`, `FOG_ICON` in `js/render.js`). Changing them only changes how an effect looks, not the pacing. If one of them ever needs regular tuning, move it into `TIMING` using the pattern below.

## Adding a new timing

1. Add the value to the right group in `js/timing.js`, with a comment that says what it controls and its unit.
2. In the code, use `TIMING.<group>.<name>` in place of the number.
3. Add a row to the matching table in this document.

Please don't put new magic numbers for sequence pacing straight into the code. Keeping them all in `js/timing.js` is what makes the game's pacing tunable from one place.

## Testing a change quickly

- **Fortune Wheel with a chosen game type:** open the browser console and run `Game.dev.on = true; Game.dev.wheel = 'cross'`. The next spin lands on Crossfire. Any key from `RULES` in `js/game.js` works.
- **Trying values without reloading:** most settings are read when they are used, so you can change them live in the console, for example `TIMING.wheel.autoFinish = 1500`. The next time that sequence runs, it uses the new value. To keep the change, copy the number into `js/timing.js`.
- **Slow motion:** Chrome DevTools has an Animations panel (More tools → Animations) that can play DOM animations at 25% or 10% speed. This helps with the overlays. It does not slow down `setTimeout` or the canvas.
