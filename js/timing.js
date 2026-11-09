'use strict';
// =====================================================================================================
//  TIMING: every pause, delay and duration of the sequences that play out on their own
//  (the Fortune Wheel, the slot machine, RULE PICK, the rule title card, the camera moves between
//  levels, the board's own moves, and Instant Replay).
//
//  * All values are in MILLISECONDS unless the comment says otherwise.
//  * Change a number here, reload the page, and the game uses it. Nothing else needs editing.
//  * transitions-technical-overview.md (in the project root) explains every entry, lists every place
//    in the code that reads it, and says which values depend on each other.
//  * This file loads first (see index.html), so every other script can read TIMING.
//
//  HOW TO READ THIS FILE
//  * TIMING is a plain object, not a class. Each group (wheel, slots, ...) is one sequence.
//  * Each group starts with a header that says what the sequence is, the order things happen in, and
//    "Read by": the functions that use the group's settings and what each function does.
//  * Each setting's comment says what you see on screen when it runs. "after X, before Y" means the
//    setting is a pause that starts when X happens.
//  * Code reads a setting when it is about to use it, so you can also try a value live from the browser
//    console (for example `TIMING.wheel.autoFinish = 1500`) and copy it here once you like it.
//  * board.markImpact is a getter (a value calculated when read). It follows markDrop automatically.
// =====================================================================================================
const TIMING = {

  // ---------------------------------------------------------------------------------------------
  //  FORTUNE WHEEL (js/wheel.js): picks the game type for each new Turf Battle
  //  Order: drop in -> (wait for SPIN) -> wind back -> spin -> land -> wedge lifts -> announce -> blast off
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Wheel.spin()       opens the wheel, waits for SPIN (or presses it for the computer), runs the spin,
  //                       then land(): lifts the winning wedge, announces it and calls blastOff()
  //    Wheel.dropIn()     the wheel falling onto the screen, the slam, dust, and the title popping in
  //    Wheel.drawPointer() draws the 3D pointer every frame
  //    Wheel.flapperStep() moves the springy flapper as the pegs push it aside and let it go (flapper*)
  //    Wheel.blastOff()   the rumble, fire and rocket flight that closes the wheel
  //    Called from Game.startRule() in js/game.js, which then shows the rule title card.
  // ---------------------------------------------------------------------------------------------
  wheel: {
    autoSpinDelay: 900,        // computer's turn: how long the wheel sits before the computer presses SPIN

    // -- drop-in: the wheel falls from above the screen and slams down --
    dropFall: 620,             // the fall itself; the BOOM, dust and squash happen when it ends
    dropTitleGap: 120,         // after the slam, before the title text starts popping in
    dropTitleIn: 450,          // each title line's pop-in animation
    dropTitleStagger: 90,      // extra delay between one title line and the next
    dropSquash: 380,           // the squash-and-stretch bounce on impact
    dropShake: 700,            // the screen shake on impact

    // -- the spin --
    windBack: 520,             // the wheel is dragged backwards before it is let go
    spinFast: 6800,            // phase A: the long slow-down from full speed ...
    spinFastRandom: 400,       // ... plus up to this much extra, so no two spins last exactly the same
    spinCrawl: 3400,           // phase B: the final crawl over the last ~3 spokes to the stop
    heartbeats: [1200, 1200, 1000, 1000, 800, 800, 600, 600],  // gap before each heartbeat during the spin:
                               // this list is the speed-up curve (loudness follows it, see SOUND.heartbeat)
    heartbeatFast: 400,        // gap between heartbeats once the list above runs out
    heartbeatPulse: 420,       // how long each heartbeat's "throb" of the wheel lasts
    heartbeatStopGuard: 120,   // no heartbeat starts this close to the moment the wheel stops
    heartbeatLubDubSlow: 240,  // gap between the "lub" and the "dub" of the slowest heartbeat ...
    heartbeatLubDubFast: 110,  // ... and of the fastest (in between, it tightens as the heart races)
    // the flapper (the red pointer) is a little spring; these three are NOT milliseconds.
    // Its clack plays once per peg, the moment that peg strikes it (Wheel.flapperStep).
    flapperFreq: 9,            // Hz: how fast it springs back and forth (higher = stiffer, quicker slaps)
    flapperDamping: 0.1,       // 0..1: how quickly its wobble dies away (0 = forever, 1 = no overshoot at all)
    flapperBounce: 0.35,       // 0..1: how much of its speed it keeps when it slaps into a peg

    // -- landing and the announcement --
    wedgeLiftDelay: 450,       // after the wheel stops, before the winning wedge pops out
    wedgeLift: 950,            // the wedge rising up and flipping to face the player
    announceDelay: 1400,       // after the wheel stops: big burst, the game's name, and its voice-over
    clickSkipVoiced: 2600,     // after the announcement, how soon a click can skip ahead (game has a voice-over)
    clickSkip: 0,              // the same, for a game without a voice-over
    autoFinishVoiced: 5000,    // after the wheel stops, blast off on its own (game has a voice-over)
    autoFinish: 3300,          // the same, for a game without a voice-over

    // -- blast-off: the wheel leaves like a rocket --
    blastUiFade: 300,          // the title and result text fade away
    blastRumble: 800,          // rumbling and fire on the ground before lift-off
    blastFly: 1000,            // the flight up and off the screen
    blastCleanup: 400,         // after the flight, before leftover animations are cleared
    hide: 260,                 // the overlay's fade-out before the game continues (matches --t-overlay-fade)
  },

  // ---------------------------------------------------------------------------------------------
  //  SLOT MACHINE / MYSTERY JACKPOT (js/slots.js)
  //  Order: (jackpot found) -> machine appears -> pull -> reels stop one by one -> reveal -> leave
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.jackpotSpin()   (game.js) the "JACKPOT!" moment, then opens the machine with Slots.spin()
  //    Slots.spin()         shows the machine, waits for the lever (or pulls it for the computer), spins and
  //                         stops the reels, plays the tick sound, then calls reveal()
  //    Slots.reveal()       shows the prize, decides when a click may close the machine and when it closes itself
  //    Slots.streakStop()   the flash and "x2! / INSTANT WIN!" pop when an INSTANT WIN locks in on a reel
  //    Slots.instantBanner() the big INSTANT WIN! title and its explosions
  //    Slots.explodeBanner() blows the title apart letter by letter when the machine closes
  //    Game.applyPrize()    (game.js) carries out the prize (in Gravity, lets the marks above a gap fall),
  //                         then pauses before play continues
  //    Game.chooseTarget()  (game.js) waits for a target to steal/bomb; the computer picks after a delay
  // ---------------------------------------------------------------------------------------------
  slots: {
    jackpotFoundDelay: 300,    // game.js: after the mark lands on the jackpot space, before "JACKPOT!"
    jackpotToMachine: 900,     // game.js: after "JACKPOT!", before the slot machine appears
    autoPullDelay: 900,        // computer's turn: how long before the computer pulls the lever

    // -- reels: each number is when that reel stops, counted from the pull --
    reelStops: [1000, 1400, 1800, 2200, 2600],
    teaserExtra: 450,          // a likely win on reels 1+2: reels 3, 4, 5 stop 450, 900, 1350 later
    windupFirstStop: 1000,     // INSTANT WIN on reel 1: when reel 1 stops ...
    windupGap: 1100,           // ... and the gap before each later reel stops
    windupBrokenGap: 380,      // ... but only this gap once the INSTANT WIN streak is broken
    suspenseGap: 3200,         // two INSTANT WINs lined up: the gap before the deciding third reel stops
    windupTeaseDelay: 30,      // after reel 1 stops, before "INSTANT WIN on reel 1..." appears
    oneMoreTextDelay: 650,     // after reel 2 stops, before "ONE MORE FOR AN INSTANT WIN..." appears
    tickGapStart: 50,          // the reel ticking sound: gap between ticks at the start ...
    tickGapGrow: 150,          // ... growing by up to this much as the reels slow down
    tickStopGuard: 120,        // the ticking stops this long before the last reel stops

    // -- the result --
    revealDelay: 200,          // after the last reel stops, before the prize is shown
    clickSkip: 400,            // after the reveal, how soon a click closes the machine
    autoFinishBust: 2200,      // after the reveal, the machine closes on its own: no prize
    autoFinishJackpot: 5600,   // ... INSTANT WIN
    autoFinishPrize: 3600,     // ... any other prize
    instantGlow: 5200,         // how long the machine glows after an INSTANT WIN
    hide: 250,                 // the overlay's fade-out before the game continues (matches --t-overlay-fade)

    // -- the big INSTANT WIN! title above the machine --
    bannerBoomFirst: 150,      // the first explosion around the title
    bannerBoomGap: 260,        // gap between those explosions (6 of them)
    bannerCellBurstGap: 90,    // gap between the bursts on each winning symbol
    bannerFailsafe: 9000,      // the title blows itself up after this long if the machine is still open
    lockFlash: 600,            // the white flash each time an INSTANT WIN locks into place on a reel
    letterGap: 45,             // the title blowing apart: delay between one letter and the next
    letterFly: 720,            // each letter flying away
    letterBoom: 130,           // after a letter starts flying, its little explosion
    letterCleanup: 1500,       // after the last letter starts, before the leftovers are removed

    // -- prize follow-ups (game.js) --
    prizeSettle: 700,          // after a STEAL or a BOMB lands, before play continues
    gravityDropDelay: 450,     // Gravity: after a BOMB or a claimed square, before the marks above a gap fall in
    cpuTargetDelay: 1000,      // computer's turn: how long before it picks which mark to steal or bomb
    rulePickSettle: 3000,      // after a RULE PICK, how long the "next game" card is on screen
  },

  // ---------------------------------------------------------------------------------------------
  //  EXPLOSION when the slot machine leaves (js/boom.js, Boom.run)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Boom.run()   the chain of fireballs, flash and screen shake drawn on a temporary canvas
  // ---------------------------------------------------------------------------------------------
  boom: {
    blastFirst: 140,           // the first ring blast after the centre one
    blastGap: 95,              // gap between the ring blasts (7 of them, plus up to 60 random)
    shake: 900,                // the screen shake
  },

  // ---------------------------------------------------------------------------------------------
  //  RULE PICK (js/slots.js, RulePick): the prize that lets a player choose the next game type
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    RulePick.open()  deals the cards, waits for a choice (or runs the computer's highlight), shatters
  //                     the chosen card, blows the rest away and closes. Called from Game.applyPrize().
  // ---------------------------------------------------------------------------------------------
  rulePick: {
    cardFlipFirst: 250,        // the deal: the first card's flip sound ...
    cardFlipGap: 110,          // ... and the gap between cards
    swell: 420,                // the chosen card swells and trembles, then shatters
    shake: 420,                // the panel shake when it shatters
    cardsFly: 1000,            // the other cards being blown off the screen (plus up to 250 random)
    exitDelay: 2000,           // after a card is chosen, before the overlay fades away
    hide: 260,                 // the overlay's fade-out (matches --t-overlay-fade)
    cpuStart: 1100,            // computer's turn: before the highlight starts running over the cards
    cpuHopBase: 70,            // the highlight's first hop ...
    cpuHopGrow: 1.6,           // ... each hop n waits cpuHopBase + n * n * cpuHopGrow (NOT ms: a multiplier)
    cpuChoose: 350,            // after the highlight stops, before the card is chosen
  },

  // ---------------------------------------------------------------------------------------------
  //  RULE TITLE CARD (js/game.js showRuleCard, js/boom.js IconFly): the card naming the game type
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.showRuleCard() shows the card, then flies it up into the plate at the top of the screen
  //    Game.startRule()    picks the rule (wheel or RULE PICK), shows the card, waits before play starts
  //    IconFly.lift()      (boom.js) lifts the chosen RULE PICK icon to centre stage and keeps it bobbing
  //    IconFly.land()      (boom.js) flies that icon onto the title card
  // ---------------------------------------------------------------------------------------------
  ruleCard: {
    hold: 2200,                // how long the card stays in the middle before flying up to the top plate
    fly: 720,                  // the flight up into the plate at the top of the screen
    failsafe: 4200,            // the card is removed after this long no matter what
    afterCard: 900,            // after the card appears, before the Turf Battle can be played
    iconLift: 900,             // RULE PICK: the chosen card's icon leaping to centre stage
    iconIdle: 520,             // ... then bobbing there (one swing)
    iconLandDelay: 470,        // after the title card appears, before the icon flies onto it
    iconLand: 560,             // the icon's flight onto the card
    iconBounce: 380,           // the card's icon bouncing when the flying icon lands on it
  },

  // ---------------------------------------------------------------------------------------------
  //  CAMERA MOVES BETWEEN BOARDS (js/game.js; the camera itself is Renderer.flyTo in js/render.js)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.play()         a player picks a space on Level 1+: zooms into the new game for that space
  //    Game.afterClaim()   a board is won: celebrates, zooms out, drops the winner's mark into the board above
  //    Game.ascend()       the top board is won: builds a bigger board around it and zooms out to it
  //    Game.deadSquare()   a Turf Battle stalemate: zooms out and turns its space to stone
  //    Game.replay()       a draw: clears the board for a replay (not Instant Replay)
  //    Game.fly()          browsing with the zoom buttons, minimap or path: flies to the chosen board
  //    Renderer.drawBoard() (render.js) re-frames the camera when a Gravity board tilts upright
  // ---------------------------------------------------------------------------------------------
  camera: {
    zoomIntoChild: 1200,       // a player picks a space: zoom down into its new Turf Battle (or lower level)
    childFadeIn: 700,          // ... the new board fading in during that zoom
    winPause: 1400,            // a board is won: celebrate before zooming out
    zoomOutToParent: 1200,     // zoom out from the won board to the board above it
    wonFade: 800,              // ... the won board fading away during that zoom ...
    wonFadeDelay: 250,         // ... starting this long after the zoom starts
    afterClaim: 800,           // after the winner's mark drops into the board above, before play continues
    winLineFirst: 120,         // the winning line's sparkles: the first space ...
    winLineGap: 110,           // ... and the gap between spaces

    // -- a whole level is won: the board shrinks into the centre of a new, bigger board --
    ascendZoom: 1900,          // the zoom out to the new level
    ascendNewFadeIn: 1000,     // the new board fading in ...
    ascendNewFadeDelay: 200,   // ... starting this long after the zoom starts
    ascendOldFade: 900,        // the old board fading out ...
    ascendOldFadeDelay: 900,   // ... starting this long after the zoom starts
    ascendWaveDelay: 250,      // after the zoom, before the ripple across the new board
    ascendSettle: 700,         // after the zoom, before play continues

    // -- a Turf Battle ends in a stalemate: its space on the board above turns to stone --
    stalematePause: 1300,      // "STALEMATE!" before zooming out
    stalemateSettle: 900,      // after the stone lands, before play continues

    // -- a draw that is replayed --
    drawPause: 1500,           // "DRAW!" before the board clears
    drawSettle: 600,           // after the board clears, before play (or the wheel) continues

    // -- looking around with the zoom buttons / minimap --
    browseZoom: 1000,          // flying to the board you clicked
    browseFade: 650,           // finished boards fading in or out as you browse ...
    browseFadeDelay: 250,      // ... fading out starts this long after the move starts

    gravityTilt: 1300,         // Gravity: the camera re-framing while the board tilts upright
  },

  // ---------------------------------------------------------------------------------------------
  //  THE BOARD'S OWN MOVES (js/game.js postMove and friends; the drawing is in js/render.js)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.postMove()       after each Turf Battle move: runs the game type's automatic action with pauses
  //    Game.doTurn()         Ring Spin / Crossfire: moves the marks and starts their slide animation
  //    Game.liftFog()        Fog of War is over: evaporates the fog and pauses
  //    Game.wildRoulette()   plans the Wild Square intro: when each space lights up and when the mark drops
  //    Game.claim(), moveWild(), deadSquare(), applySnap()  fire sparks/ripples/sounds at markImpact
  //    Game.dropOldest()     Vanishing Marks: the "POOF!" of the oldest mark
  //    Game.scheduleCPU()    starts the computer's move after its thinking time
  //    Game.toast()          shows a message at the bottom and hides it later
  //    Renderer.drawBoard()  (render.js, every frame) mark drops, slides, ghost fades, the Gravity tilt
  //    Renderer.fogLevel(), fogRise()  (render.js) how thick the fog is on a space at this moment
  //    Renderer.wildLit()    (render.js) how brightly a space is lit during the Wild Square intro
  //    MiniMap.board()       (minimap.js) hides the wild mark on the minimap until it lands
  // ---------------------------------------------------------------------------------------------
  board: {
    cpuMoveDelay: 750,         // computer's turn: "thinking" time before it plays
    markDrop: 750,             // a mark falling onto a space and bouncing (the impact is markImpact)
    get markImpact() { return Math.round(this.markDrop * 0.364); },  // when a falling mark first hits (273 ms): sparks, ripple, sound
    vanishPoof: 240,           // Vanishing Marks: the oldest mark's "POOF!" after a fourth mark is placed
    ghostFade: 450,            // a removed mark fading out
    toast: 3200,               // how long a message at the bottom stays up

    gravitySettle: 450,        // Gravity: after the marks finish falling, before the next turn
    gravityRaise: 1700,        // Gravity: the board tilting upright (hydraulic push)
    gravityRaiseDelay: 350,    // ... starting this long after the Gravity game begins
    gravityLower: 700,         // ... and tilting back down once the game is over
    shiftBefore: 420,          // Shifting Squares: pause before a row or column shifts
    shiftAfter: 650,           // ... and after it, before the next turn
    slide: 420,                // a mark sliding to its new space (Shifting Squares, Ring Spin)
    turnBefore: 420,           // Ring Spin / Crossfire: pause before the marks move
    ringAfter: 700,            // Ring Spin: after the marks move, before the next turn
    crossAfter: 800,           // Crossfire: after the corners swap, before the next turn
    crossHop: 700,             // Crossfire: each corner mark's hop over the centre
    fogCover: 650,             // Fog of War: a mark disappearing into the fog
    fogPause: 500,             // ... the pause while it does
    fogLiftPause: 1500,        // Fog of War is over: the fog evaporating before play continues
    fogLift: 1300,             // ... how long the fog takes to thin away
    fogWinFade: 900,           // ... (the fog's fade if a win happens without the lift)
    wildBefore: 250,           // Wild Square: pause before the wild mark jumps
    wildAfter: 450,            // ... and after, before the next turn

    // -- Wild Square intro: the spaces light up one after another, then the wild mark drops --
    wildIntroStart: 2950,      // after the rule card appears, before the lights start (lets the card fly away)
    wildIntroSteps: 17,        // how many random spaces light up before the final one (a count, not ms)
    wildStepMin: 55,           // the gap between lights at the start ...
    wildStepGrow: 260,         // ... growing by up to this much (on a curve) as the run slows down
    wildStepTrail: 120,        // the dim trail left by the previous light
    wildDropDelay: 450,        // after the last light, before the wild mark drops
    wildLightFade: 500,        // after the mark lands, the light under it fading
  },

  // ---------------------------------------------------------------------------------------------
  //  INSTANT REPLAY (js/game.js)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.startReplay()    jumps to the chosen moment and schedules the first step
  //    Game.stepReplay()     shows the next saved moment, then schedules the one after
  //    Game.applySnap()      swaps in a saved moment and moves the camera if the board changed
  //    Game.toggleReplayPause() pauses or resumes; resuming waits `resume` before the next step
  //    Game.stopReplay()     returns to the live game and flies the camera back
  //    The step gaps are divided by the replay speed (1x, 2x, 4x); the camera times are not.
  // ---------------------------------------------------------------------------------------------
  replay: {
    firstStep: 1400,           // after the replay starts, before the first move plays
    stepSameBoard: 950,        // gap between moves on the same board
    stepNewBoard: 1500,        // gap after the replay moves to a different board (longer for the camera)
    resume: 400,               // after un-pausing, before the next move
    cameraFirst: 900,          // the camera's move to the starting board
    cameraMove: 800,           // the camera following the replay to a different board
    cameraBack: 900,           // the camera's move back to the live game when the replay ends
  },

  // ---------------------------------------------------------------------------------------------
  //  CSS: the fade of the Wheel, Slots and RULE PICK overlays (style.css reads this as
  //  var(--t-overlay-fade)). Keep wheel.hide, slots.hide and rulePick.hide close to it.
  //
  //  Read by: the setProperty() call at the bottom of this file, which hands it to style.css.
  // ---------------------------------------------------------------------------------------------
  css: {
    overlayFade: 250,          // the fade-in / fade-out of the full-screen overlays
  },
};

// Hand the CSS values to style.css as custom properties.
// setProperty() writes a CSS variable on the <html> element, so any rule in style.css can use it,
// for example `transition: opacity var(--t-overlay-fade, 0.25s)` (0.25s is the fallback if this
// line has not run). To add one: put the value in TIMING.css, add a line like this one, and use
// var(--your-name, fallback) in style.css.
document.documentElement.style.setProperty('--t-overlay-fade', `${TIMING.css.overlayFade}ms`);
