'use strict';
// =====================================================================================================
//  TIMING: every pause, delay and duration of the sequences that play out on their own
//  (the Fortune Wheel, the slot machine, RULE PICK, the rule title card, the camera moves between
//  levels, the board's own moves, and Instant Replay).
//
//  * All values are in MILLISECONDS unless the comment says otherwise.
//  * Change a number here, reload the page, and the game uses it. Nothing else needs editing.
//  * transitions-technical-overview.md (in the project root) explains every entry, lists every place
//    in the code that reads it, and has a timeline of every group.
//  * This file loads first (see index.html), so every other script can read TIMING.
//
//  EPOCHS: HOW THE TIMES ARE COUNTED
//  * Every group of settings that belong together is counted from ONE moment, its EPOCH, named in the
//    group's "EPOCH:" line (for example "the lever is pulled" for the slot reels, or "the wheel stops"
//    for the wheel's landing). A setting never counts from another setting's moment.
//  * A setting whose name ends in "At" is a START TIME: how long after the epoch the thing happens.
//    For example TIMING.wheel.landing.announceAt = 800 means the announcement happens 800 ms after the
//    wheel stops, whatever the other settings say. Moving one "At" value moves only that event.
//  * Any other setting is a DURATION (how long an animation or sound lasts) or a GAP of a repeating
//    beat. A beat n happens at `first + n * gap` after the epoch, which is still counted from the epoch.
//  * A new epoch starts only at a moment that is not fixed in advance: a player's click, the end of a
//    spin whose length is random, or the moment a slot prize shows (the reels run longer or shorter
//    depending on what they land on). The comment on the epoch says what starts it.
//  * Because nothing is chained, some values must be kept in order by hand. Those are marked "KEEP:".
//
//  HOW TO READ THIS FILE
//  * TIMING is a plain object, not a class. Each group (wheel, slots, ...) is one sequence.
//  * Each group starts with a header that says what the sequence is, the order things happen in, and
//    "Read by": the functions that use the group's settings and what each function does.
//  * Big groups are split into smaller groups, one for each stage (and epoch) of the sequence.
//  * Each setting's comment says what you see on screen when it runs.
//  * Code reads a setting when it is about to use it, so you can also try a value live from the browser
//    console (for example `TIMING.wheel.landing.autoFinishAt = 1500`) and copy it here once you like it.
//  * board.marks.markImpact is a getter (a value calculated when read). It follows markDrop automatically.
// =====================================================================================================
const TIMING = {

  // ---------------------------------------------------------------------------------------------
  //  FORTUNE WHEEL (js/wheel.js): picks the game type for each new Turf Battle
  //  Order: drop in -> (wait for SPIN) -> wind back -> spin -> land -> wedge lifts -> announce -> blast off
  //  Epochs: the wheel appears (drop) / it is launched (spin, heartbeat) / it stops (landing) /
  //          blast-off starts (blastOff)
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
    // -- drop-in. EPOCH: the wheel appears (Wheel.spin() opens it) --
    drop: {
      dropFall: 620,             // the fall itself; the slam (BOOM, dust, squash, shake) happens when it ends, at 620
      titleAt: 740,              // the first title line starts popping in (the others follow, dropTitleStagger apart)
      dropTitleStagger: 90,      // extra delay between one title line and the next
      dropTitleIn: 450,          // each title line's pop-in animation
      dropSquash: 380,           // the squash-and-stretch bounce at the slam
      dropShake: 700,            // the screen shake at the slam
      autoSpinAt: 900,           // computer's turn: the computer presses SPIN
    },

    // -- the spin. EPOCH: SPIN is pressed --
    spin: {
      windBack: 520,             // the wheel is dragged backwards; it is let go (launched) when this ends
      spinFast: 6800,            // phase A, counted from the launch: the long slow-down from full speed ...
      spinFastRandom: 400,       // ... plus up to this much extra, so no two spins last exactly the same
      spinCrawl: 3400,           // phase B: the final crawl over the last ~3 spokes to the stop
    },

    // -- the heartbeat under the spin: it races as the wheel slows. EPOCH: the wheel is launched --
    heartbeat: {
      beatsAt: [0, 1200, 2400, 3400, 4400, 5200, 6000, 6600, 7200],  // when each heartbeat starts: the
                                 // shrinking gaps are the speed-up curve (loudness follows it, see SOUND.heartbeat)
      heartbeatFast: 400,        // after the last beat in the list, a beat every this often until the wheel stops
      heartbeatStopGuard: 120,   // no heartbeat starts this close to the moment the wheel stops
      heartbeatPulse: 420,       // how long each heartbeat's "throb" of the wheel lasts
      heartbeatLubDubSlow: 240,  // gap between the "lub" and the "dub" of the slowest heartbeat ...
      heartbeatLubDubFast: 110,  // ... and of the fastest (in between, it tightens as the heart races)
    },

    flapper: {
      // the flapper (the red pointer) is a little spring; these three are NOT milliseconds.
      // Its clack plays once per peg, the moment that peg strikes it (Wheel.flapperStep).
      flapperFreq: 9,            // Hz: how fast it springs back and forth (higher = stiffer, quicker slaps)
      flapperDamping: 0.1,       // 0..1: how quickly its wobble dies away (0 = forever, 1 = no overshoot at all)
      flapperBounce: 0.35,       // 0..1: how much of its speed it keeps when it slaps into a peg
    },

    // -- landing and the announcement. EPOCH: the wheel stops --
    landing: {
      wedgeLiftAt: 450,          // the winning wedge pops out ...
      wedgeLift: 800,            // ... rising up and flipping to face the player for this long
      announceAt: 800,           // big burst, the game's name, and its voice-over
      clickSkipVoicedAt: 2400,   // from here a click blasts off early (game has a voice-over): 1.6 s into the
                                 // announcement, once the game's name has been said (KEEP: before autoFinishVoicedAt)
      clickSkipAt: 800,          // the same, for a game without a voice-over (KEEP: not before announceAt)
      autoFinishVoicedAt: 3000,  // blast off on its own (game has a voice-over)
      autoFinishAt: 1300,        // the same, for a game without a voice-over
    },

    // -- blast-off: the wheel leaves like a rocket. EPOCH: blast-off starts (a click, or autoFinish*At) --
    blastOff: {
      blastUiFade: 300,          // the title and result text fade away (from the epoch)
      liftoffAt: 200,            // rumbling and fire on the ground until lift-off, here
      blastFly: 400,             // the flight up and off the screen, from lift-off
      fadeAt: 600,               // the overlay starts fading out (the flight is over at liftoffAt + blastFly)
      cleanupAt: 1000,           // leftover animations are cleared
      doneAt: 1600,              // the wheel is hidden and the game continues. The fade itself is --t-overlay-fade
                                 // (250), so the screen rests on the board for a moment before the title card
    },
  },

  // ---------------------------------------------------------------------------------------------
  //  SLOT MACHINE / MYSTERY JACKPOT (js/slots.js)
  //  Order: (jackpot found) -> machine appears -> pull -> reels stop one by one -> reveal -> leave
  //  Epochs: the mark lands on the jackpot (opening) / the machine appears (autoPullAt) /
  //          the lever is pulled (reels, instantWin stops) / an INSTANT WIN streak breaks (brokenStops) /
  //          the prize shows (result, instantWin glow and title) / the machine closes (letters, hide, boom) /
  //          the prize lands on the board (prizes)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.jackpotSpin()   (game.js) the "JACKPOT!" moment, then opens the machine with Slots.spin()
  //    Slots.spin()         shows the machine, waits for the lever (or pulls it for the computer), spins and
  //                         stops the reels, plays the tick sound, then calls reveal()
  //    Slots.reveal()       shows the prize, decides when a click may close the machine and when it closes itself
  //    Slots.streakStop()   the flash and "x2! ... INSTANT WIN!" pop when an INSTANT WIN locks in on a reel
  //    Slots.instantBanner() the big INSTANT WIN! title and its explosions
  //    Slots.explodeBanner() blows the title apart letter by letter when the machine closes
  //    Game.applyPrize()    (game.js) carries out the prize (in Gravity, lets the marks above a gap fall),
  //                         then pauses before play continues
  //    Game.chooseTarget()  (game.js) waits for a target to steal/bomb; the computer picks after a delay
  // ---------------------------------------------------------------------------------------------
  slots: {
    // -- the jackpot is found and the machine opens. EPOCH: the mark lands on the jackpot space --
    opening: {
      jackpotAt: 300,            // game.js: "JACKPOT!" (coins, flash, shake)
      machineAt: 1200,           // game.js: the slot machine appears
      autoPullAt: 900,           // computer's turn: counted from when the MACHINE APPEARS, the computer pulls the lever
    },

    // -- reels: how fast they spin, and when each one stops. EPOCH: the lever is pulled --
    reels: {
      reelStops: [1500, 1900, 2300, 2500, 2900],      // when each reel stops
      teaserStops: [1500, 1900, 2750, 3400, 4250],    // the same when reels 1+2 already lead a line (a likely win):
                                                      // the last three slow down for suspense
      spinSpeed: 35,             // how fast the reels spin, in SYMBOLS PER SECOND (higher = faster); every reel
                                 // spins this fast whatever its stop time, so longer spins just pass more symbols
      reelSlowdown: 1200,        // the last part of each reel's spin, where it visibly slows from spinSpeed to a stop
      tickGapStart: 50,          // the reel ticking sound, from the pull: gap between ticks at the start ...
      tickGapGrow: 150,          // ... growing by up to this much as the reels slow down
      tickStopGuard: 120,        // the ticking stops this long before the last reel stops
    },

    // -- INSTANT WIN: an INSTANT WIN on reel 1 winds up the other reels; five in a row wins --
    instantWin: {
      // EPOCH: the lever is pulled
      windupStops: [2000, 4100, 6200, 8300, 10400],   // INSTANT WIN on reel 1: when each reel stops
      suspenseStop: 11500,       // four INSTANT WINs lined up: when the deciding fifth reel stops instead
      suspenseSlowdown: 2800,    // ... and the last part of that reel's spin, where it slowly crawls to a stop (see reels.reelSlowdown)
      teaseTextAt: 2030,         // "INSTANT WIN on reel 1..." appears (KEEP: just after windupStops[0])
      oneMoreTextAt: 8950,       // four lined up: "ONE MORE FOR AN INSTANT WIN..." appears (KEEP: after windupStops[3])
      // EPOCH: the reel that breaks the INSTANT WIN streak stops
      brokenStops: [380, 760, 1140],  // the reels after it stop quickly, at these times (as many as are left)
      // EPOCH: that reel stops (one flash per reel)
      lockFlash: 600,            // the white flash each time an INSTANT WIN locks into place on a reel
      // EPOCH: the prize shows (Slots.reveal)
      autoFinishJackpotAt: 5600, // the machine closes on its own after an INSTANT WIN
      instantGlow: 5200,         // how long the machine glows after an INSTANT WIN
      bannerBoomFirst: 150,      // the first explosion around the title ...
      bannerBoomGap: 260,        // ... and the gap between those explosions (6 of them)
      bannerCellBurstGap: 90,    // gap between the bursts on each winning symbol (the first at the reveal)
      bannerFailsafeAt: 9000,    // the title blows itself up if the machine is still open
      // EPOCH: the machine closes (Slots.explodeBanner)
      letterGap: 45,             // the title blowing apart: letter n starts flying at n * letterGap ...
      letterFly: 720,            // ... each letter flying away for this long ...
      letterBoom: 130,           // ... and its little explosion at n * letterGap + letterBoom
      letterCleanup: 1500,       // the leftovers are removed at (number of letters) * letterGap + letterCleanup
    },

    // -- the result. EPOCH: the prize shows --
    result: {
      revealDelay: 200,          // the prize shows this long after the LAST reel stops: this moment is the epoch
                                 // for the settings below (the last stop depends on what the reels land on)
      clickSkipAt: 400,          // from here a click closes the machine
      autoFinishBustAt: 2200,    // the machine closes on its own: no prize
      autoFinishPrizeAt: 3600,   // ... any other prize (INSTANT WIN: instantWin.autoFinishJackpotAt)
      hide: 250,                 // EPOCH: the machine closes. The overlay's fade-out before the game continues
                                 // (matches --t-overlay-fade)
    },

    // -- prize follow-ups (game.js) --
    prizes: {
      // EPOCH: the STEAL, BOMB or claimed square lands on the board
      prizeSettleAt: 700,        // play continues
      gravityDropAt: 450,        // Gravity, after a BOMB or a claimed square: the marks above a gap fall in
      gravitySettleAt: 1600,     // ... and play continues (KEEP: after gravityDropAt + board.shift.slide)
      gravityNoFallAt: 1150,     // ... or here, if nothing had to fall
      // EPOCH: the player is asked to pick a target
      cpuTargetDelay: 1000,      // computer's turn: it picks which mark to steal or bomb
      // EPOCH: the "next game" title card appears after a RULE PICK
      rulePickSettle: 3000,      // play continues (the card is on screen until then)
    },
  },

  // ---------------------------------------------------------------------------------------------
  //  EXPLOSION when the slot machine leaves (js/boom.js, Boom.run)
  //  EPOCH: the machine closes (the centre blast goes off at once)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Boom.run()   the chain of fireballs, flash and screen shake drawn on a temporary canvas
  // ---------------------------------------------------------------------------------------------
  boom: {
    blastFirst: 140,           // the first ring blast after the centre one ...
    blastGap: 95,              // ... and the gap between the ring blasts (7 of them, plus up to 60 random each)
    shake: 900,                // the screen shake
  },

  // ---------------------------------------------------------------------------------------------
  //  RULE PICK (js/slots.js, RulePick): the prize that lets a player choose the next game type
  //  Epochs: the cards appear (deal, computer's highlight) / a card is chosen (swell, shatter, close)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    RulePick.open()  deals the cards, waits for a choice (or runs the computer's highlight), shatters
  //                     the chosen card, blows the rest away and closes. Called from Game.applyPrize().
  // ---------------------------------------------------------------------------------------------
  rulePick: {
    // EPOCH: the cards appear
    cardFlipFirst: 250,        // the deal: the first card's flip sound ...
    cardFlipGap: 110,          // ... and the gap between cards
    cpuStart: 1100,            // computer's turn: the highlight starts running over the cards
    cpuHopBase: 70,            // the highlight's first hop ...
    cpuHopGrow: 1.6,           // ... each hop n lasts cpuHopBase + n * n * cpuHopGrow (NOT ms: a multiplier)
    cpuChoose: 350,            // after the highlight stops, the card is chosen (the hop count depends on the pick)
    // EPOCH: a card is chosen
    swell: 420,                // the chosen card swells and trembles ...
    shatterAt: 420,            // ... and shatters here (KEEP: equal to swell, or the swell freezes before the blast)
    shake: 420,                // the panel shake at the shatter
    cardsFly: 1000,            // the other cards being blown off the screen (plus up to 250 random)
    fadeAt: 2000,              // the overlay starts fading away
    doneAt: 2260,              // the overlay is gone and the game continues (fadeAt + about --t-overlay-fade)
  },

  // ---------------------------------------------------------------------------------------------
  //  RULE TITLE CARD (js/game.js showRuleCard, js/boom.js IconFly): the card naming the game type
  //  EPOCH: the title card appears (except iconLift/iconIdle: a RULE PICK card is chosen)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.showRuleCard() shows the card, then flies it up into the plate at the top of the screen
  //    Game.startRule()    picks the rule (wheel or RULE PICK), shows the card, waits before play starts
  //    IconFly.lift()      (boom.js) lifts the chosen RULE PICK icon to centre stage and keeps it bobbing
  //    IconFly.land()      (boom.js) flies that icon onto the title card
  // ---------------------------------------------------------------------------------------------
  ruleCard: {
    flyAt: 2200,               // the card leaves the middle and flies up into the plate at the top of the screen ...
    fly: 720,                  // ... taking this long (it lands at flyAt + fly)
    failsafeAt: 4200,          // the card is removed no matter what
    playAt: 900,               // the Turf Battle can be played (later with a Wild Square intro: when it ends)
    iconLandAt: 470,           // RULE PICK: the chosen card's icon flies onto the title card ...
    iconLand: 560,             // ... taking this long
    iconBounce: 380,           // the card's icon bouncing when the flying icon lands on it
    iconLift: 900,             // EPOCH: a RULE PICK card is chosen. Its icon leaping to centre stage ...
    iconIdle: 520,             // ... then bobbing there (one swing) until iconLandAt
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
    turf: {
      // EPOCH: a player picks a space (both start at once)
      zoomIntoChild: 1200,       // zoom down into its new Turf Battle (or lower level)
      childFadeIn: 700,          // the new board fading in during that zoom
      // EPOCH: the winning move (each board up the chain that is won by it starts again from its own win)
      winLineFirst: 120,         // the winning line's sparkles: the first space ...
      winLineGap: 110,           // ... and the gap between spaces
      zoomOutAt: 1400,           // celebrate until here, then zoom out to the board above ...
      zoomOutToParent: 1200,     // ... taking this long; the winner's mark drops in when it ends (at 2600)
      wonFadeAt: 1650,           // the won board starts fading away ...
      wonFade: 800,              // ... over this long
      continueAt: 3400,          // play continues (KEEP: after zoomOutAt + zoomOutToParent)
    },

    // -- a whole level is won: the board shrinks into the centre of a new, bigger board --
    // EPOCH: the new level appears (after turf.zoomOutAt's celebration on the top board)
    ascend: {
      ascendZoom: 1900,          // the zoom out to the new level; the centre mark drops in when it ends
      ascendNewFadeAt: 200,      // the new board starts fading in ...
      ascendNewFadeIn: 1000,     // ... over this long
      ascendOldFadeAt: 900,      // the old board starts fading out ...
      ascendOldFade: 900,        // ... over this long
      ascendWaveAt: 2150,        // the ripple across the new board (KEEP: after ascendZoom)
      ascendContinueAt: 2600,    // play continues (KEEP: after ascendZoom)
    },

    // -- a Turf Battle ends in a stalemate: its space on the board above turns to stone --
    // EPOCH: the stalemate move (uses turf.zoomOutToParent and turf.wonFade for the zoom and fade)
    stalemate: {
      zoomOutAt: 1300,           // "STALEMATE!" until here, then zoom out; the stone lands when the zoom ends (2500)
      fadeAt: 1550,              // the board starts fading away
      continueAt: 3400,          // play continues (KEEP: after zoomOutAt + turf.zoomOutToParent)
    },

    // -- a draw that is replayed. EPOCH: the drawing move --
    draw: {
      clearAt: 1500,             // "DRAW!" until here, then the board clears
      continueAt: 2100,          // play (or the wheel) continues
    },

    // -- looking around with the zoom buttons / minimap. EPOCH: the click --
    browse: {
      browseZoom: 1000,          // flying to the board you clicked
      browseFade: 650,           // finished boards fading in or out as you browse ...
      browseFadeDelay: 250,      // ... fading out starts here
    },

    gravityTilt: 1300,         // Gravity: the camera re-framing while the board tilts upright
  },

  // ---------------------------------------------------------------------------------------------
  //  THE BOARD'S OWN MOVES (js/game.js postMove and friends; the drawing is in js/render.js)
  //  EPOCH unless a group says otherwise: the move has landed (Game.postMove starts)
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
    cpuMoveDelay: 750,         // EPOCH: the computer's turn starts. "Thinking" time before it plays
    toast: 3200,               // EPOCH: a message appears. How long it stays up

    // -- marks landing and leaving. EPOCH: the mark is placed (or removed) --
    marks: {
      markDrop: 750,             // a mark falling onto a space and bouncing (the impact is markImpact)
      get markImpact() { return Math.round(this.markDrop * 0.364); },  // when a falling mark first hits (273 ms): sparks, ripple, sound
      vanishPoof: 240,           // Vanishing Marks: the oldest mark's "POOF!" after a fourth mark is placed
      ghostFade: 450,            // a removed mark fading out
    },

    // -- Gravity --
    gravity: {
      gravitySettle: 450,        // Gravity: the marks fall at once; play continues here
      gravityRaise: 1700,        // EPOCH: the Gravity game begins. The board tilting upright (hydraulic push) ...
      gravityRaiseDelay: 350,    // ... starting here
      gravityLower: 700,         // ... and tilting back down once the game is over
    },

    // -- Shifting Squares (slide is also used by Ring Spin) --
    shift: {
      shiftAt: 420,              // Shifting Squares: a row or column shifts
      shiftContinueAt: 1070,     // ... and play continues
      slide: 420,                // a mark sliding to its new space (Shifting Squares, Ring Spin, Gravity)
    },

    // -- Ring Spin and Crossfire --
    ringCross: {
      turnAt: 420,               // Ring Spin / Crossfire: the marks move
      ringContinueAt: 1120,      // Ring Spin: play continues
      crossContinueAt: 1220,     // Crossfire: play continues
      crossHop: 700,             // Crossfire: each corner mark's hop over the centre
    },

    // -- Fog of War --
    fog: {
      fogCover: 650,             // Fog of War: a mark disappearing into the fog
      fogPause: 500,             // ... play continues here
      fogLiftPause: 1500,        // EPOCH: Fog of War is over. Play continues here ...
      fogLift: 1300,             // ... while the fog thins away over this long
      fogWinFade: 900,           // ... (the fog's fade if a win happens without the lift)
    },

    // -- Wild Square --
    wild: {
      wildJumpAt: 250,           // Wild Square: the wild mark jumps
      wildContinueAt: 700,       // ... and play continues
    },

    // -- Wild Square intro: the spaces light up one after another, then the wild mark drops --
    // EPOCH: the rule title card appears
    wildIntro: {
      wildIntroStart: 2950,      // the first light (KEEP: after the card has flown away, ruleCard.flyAt + fly)
      wildIntroSteps: 17,        // how many random spaces light up before the final one (a count, not ms)
      wildStepMin: 55,           // the gap between lights at the start ...
      wildStepGrow: 260,         // ... growing by up to this much (on a curve) as the run slows down
      wildStepTrail: 120,        // the dim trail left by the previous light
      wildDropAt: 5314,          // the wild mark drops (KEEP: after the last light, which comes at about 4864
                                 // with the values above; the console warns if it does not)
      wildLightFade: 500,        // after the mark lands, the light under it fading
    },
  },

  // ---------------------------------------------------------------------------------------------
  //  MATCH POINT (js/game.js): the big moment when the Turf Battle being played would win a Round
  //  Order: rule card lands in its plate -> riser -> title slams down (flash, shake,
  //  deciding spaces light up, voice) -> heartbeat -> title flies off; the deciding spaces keep
  //  glowing until the battle ends
  //  EPOCH: the rule title card lands in its plate at the top (or the board becomes Match Point, if later)
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.updateStakes()       spots Match Point once the board is playable
  //    Game.matchPointSoon()     waits for the rule title card to land, then plans the moment from there
  //    Game.matchPointMoment()   the riser, the slam, the voice and the heartbeat
  //    Game.matchPointBanner()   shows the big title for `banner` (style.css .mp-banner animation)
  //    Renderer.drawBoard()      (render.js) the burst of light on the deciding spaces (`lightUp`)
  //                              and their steady pulse (`glowPulse`) afterwards
  // ---------------------------------------------------------------------------------------------
  matchPoint: {
    riseAt: 300,               // the rising whoosh starts
    slamAt: 750,               // the title slams down: flash, shake, sparks
    voiceAt: 870,              // "Match point" is announced
    heartbeatAt: 1750,         // the double heartbeat
    sparkGap: 70,              // the deciding spaces erupt one after another from slamAt, this far apart
    banner: 2800,              // from slamAt, the title on screen: slam, hold, fly off (the letterbox bars too)
    lightUp: 1400,             // from slamAt, the burst of light on the deciding spaces fading to a steady glow
    glowPulse: 1100,           // one pulse of that steady glow (matches the red vignette's heartbeat)
  },

  // ---------------------------------------------------------------------------------------------
  //  INSTANT REPLAY (js/game.js)
  //  Each step is its own epoch: the gaps below count from the step before (the player can pause,
  //  and the step gaps are divided by the replay speed 1x, 2x, 4x; the camera times and the Gravity
  //  stand-up are not).
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.startReplay()    jumps to the chosen moment and schedules the first step
  //    Game.stepReplay()     shows the next saved moment, then schedules the one after
  //    Game.applySnap()      swaps in a saved moment and moves the camera if the board changed
  //    Game.toggleReplayPause() pauses or resumes; resuming waits `resume` before the next step
  //    Game.stopReplay()     returns to the live game and flies the camera back
  //    Game.replayTiltWait() holds the next step until a Gravity board has stood up (afterGravityRaise)
  // ---------------------------------------------------------------------------------------------
  replay: {
    firstStep: 1400,           // after the replay starts, before the first move plays
    stepSameBoard: 950,        // gap between moves on the same board
    stepNewBoard: 1500,        // gap after the replay moves to a different board (longer for the camera)
    resume: 400,               // after un-pausing, before the next move
    cameraFirst: 900,          // the camera's move to the starting board
    cameraMove: 800,           // the camera following the replay to a different board
    cameraBack: 900,           // the camera's move back to the live game when the replay ends
    afterGravityRaise: 300,    // Gravity: after the board locks upright, before the first replayed move drops
                               // (the stand-up itself is TIMING.board.gravity.gravityRaiseDelay + gravityRaise)
  },

  // ---------------------------------------------------------------------------------------------
  //  DEVELOPER MODE TRANSITIONS (js/game.js): the buttons that play one sequence on a throwaway board.
  //  These are only the lab's own pauses; the sequences themselves use the groups above.
  //
  //  Read by (the functions that use these settings, and what each one does):
  //    Game.labRun()     plays the chosen sequence, waits `after`, then puts the real game back (labEnd)
  //    Game.labScene()   builds the throwaway board, waits `before`, then starts the sequence;
  //                      the explosion and ROUND banner have no end of their own to wait for
  // ---------------------------------------------------------------------------------------------
  lab: {
    before: 500,               // the throwaway board on screen, before the sequence starts
    after: 1200,               // after the sequence ends, before the real game comes back
    boomWatch: 2200,           // the Explosion button: how long to watch it
    bannerWatch: 2400,         // the ROUND banner button: how long to watch it (its animation is 2.2s in style.css)
  },

  // ---------------------------------------------------------------------------------------------
  //  CSS: the fade of the Wheel, Slots and RULE PICK overlays (style.css reads this as
  //  var(--t-overlay-fade)). Keep slots.result.hide and rulePick.doneAt - fadeAt close to it.
  //  (wheel.blastOff waits longer on purpose: doneAt - fadeAt is 1000.)
  //  (TIMING.matchPoint.glowPulse and .banner are handed to style.css the same way, below.)
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
// Match Point: the heartbeat of the red vignette and the stakes bar, and the big title's animation
document.documentElement.style.setProperty('--t-mp-pulse', `${TIMING.matchPoint.glowPulse}ms`);
document.documentElement.style.setProperty('--t-mp-banner', `${TIMING.matchPoint.banner}ms`);
