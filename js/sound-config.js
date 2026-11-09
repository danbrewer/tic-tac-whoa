'use strict';
// =================================================================================================
//  SOUND SETTINGS: every volume in the game's sound, in one place.
// =================================================================================================
//
//  HOW TO READ THIS FILE
//    The game's sounds are synthesized in js/sound.js (Web Audio, no files), apart from the recorded
//    voice-overs in media/soundfx. This file holds the numbers you would want to tune by ear:
//
//      SOUND.mix       the starting levels of the two volume sliders in the menu
//      SOUND.voices    the loudness of the recorded announcer
//      SOUND.effects   one loudness multiplier for each sound effect
//      SOUND.wheelClack, SOUND.heartbeat   the two wheel sounds whose volume used to change during a spin
//
//    Volumes are plain numbers, not decibels. In SOUND.effects, 1 means "as designed", 0 mutes the
//    effect, 0.5 is about half as loud and 2 about twice as loud. Going much past 2 can clip (crackle).
//    A multiplier covers every layer of that effect, so the effect keeps its own balance.
//
//    Timings (when a sound plays, how fast the heartbeat races) are not here: they live in
//    js/timing.js, with the rest of the game's pacing. Player-facing text lives in js/strings.js.
//
//  RULE FOR NEW WORK
//    A new sound effect is a new method on Sound in js/sound.js; add a line for it to SOUND.effects
//    below so its volume can be tuned. Any other volume a new feature needs goes in this file too.
//
//  Read by: js/sound.js only. It wraps each method named in SOUND.effects so that everything the
//  method plays goes through a gain set to that number (read at the moment the sound plays, so you
//  can also change SOUND.effects.boom from the browser console and hear the difference).
// =================================================================================================

const SOUND = {
  // -- the two sliders in the menu (0..1). These are only the first-visit defaults: once a player moves
  //    a slider, their choice is saved in the browser and used instead.
  mix: {
    sfx: 1,          // sound effects
    voice: 0.5,      // recorded voice-overs (rule names, INSTANT WIN)
  },

  // -- the recorded announcer, on top of the voice slider
  voices: {
    rules: 1,        // the rule name read out when a Turf Battle rule is chosen (Sound.ruleVoice)
    instantWin: 1,   // "INSTANT WIN!" in the huge hall (Sound.instantWin)
    turfWin: 1,      // "X / O takes the square" when a Turf Battle is won (Sound.winVoice)
    roundWin: 1,     // "X / O wins the round" when a Round's board is won (Sound.winVoice)
    matchPoint: 1,   // "Match point" when the Turf Battle being played would win a Round for someone (Sound.matchPointVoice)
  },

  // -- the Fortune Wheel's flapper clack: one per peg, the moment the peg strikes the flapper, and the
  //    same loudness from the first peg of the spin to the last (Sound.wheelClack)
  wheelClack: {
    vol: 0.08,       // the sharp click
    pitch: 1700,     // Hz: pitch of the click
    length: 0.04,    // seconds: how long the click rings
    thumpVol: 0.1,   // a low wooden knock under the click, so it has body
    thumpPitch: 150, // Hz: pitch of the knock
  },

  // -- the heartbeat under the wheel's spin (Sound.heartPulse). It gets louder as it races: quiet at the
  //    slowest beat in TIMING.wheel.heartbeats, loud at the fastest. (How fast it races, and the gap
  //    between "lub" and "dub", are timings: see TIMING.wheel in js/timing.js.)
  heartbeat: {
    quiet: 0.37,     // loudness of the slowest beats
    loud: 0.65,      // loudness of the fastest beats
  },

  // -- one multiplier per sound effect (the method's name on Sound, and when you hear it)
  effects: {
    // marks and the board
    place: 1,        // a mark's falling whistle as it drops onto a square
    land: 1,         // the thump when a mark (or a won board) lands
    tick: 1,         // a tiny tick when the pointer moves onto a square you can play
    pop: 1,          // the pops along a winning line, and other small pops
    poof: 1,         // a vanishing mark disappearing; Gravity marks settling
    stone: 1,        // a stalemated board turning into a dead stone square
    win: 1,          // the short chime when a board is won
    draw: 1,         // the two-note "aww" of a drawn board
    zoomIn: 1,       // the camera diving into a smaller board
    zoomOut: 1,      // the camera pulling back out
    ascend: 1,       // a whole level won: the big rise to the next level
    heartbeat: 1,    // the double heartbeat on MATCH POINT
    // game types moving marks by themselves
    shift: 1,        // Shifting Squares / Ring Spin / Crossfire sliding the marks
    fog: 1,          // Fog of War rolling over a mark
    fogLift: 1,      // Fog of War burning off at the end
    wild: 1,         // the Wild Square jumping
    hydraulic: 1,    // the Gravity board's hydraulic ram lifting it upright
    clunk: 1,        // the Gravity board locking upright (includes a bigBoom)
    // the rule title card and RULE PICK cards
    ruleCard: 1,     // the title card naming the game type
    cardFlip: 1,     // a card flipping over
    cardPick: 1,     // a card being chosen
    // the Mystery Jackpot slot machine
    jackpotFound: 1, // the "JACKPOT!" sparkle when a hidden jackpot square is found
    slotOpen: 1,     // the machine (or the wheel) appearing
    lever: 1,        // the lever being pulled
    music: 1,        // the driving drum loop while the reels spin
    stopMusic: 1,    // the final hit when that loop stops
    reelTick: 1,     // the reels ticking past
    reelStop: 1,     // each reel thudding to a stop
    tension: 1,      // the rising whine before the last reel
    windup: 1,       // the INSTANT WIN tease wind-up on reel 1
    drumroll: 1,     // the snare roll for the deciding reel (also under the wheel's last spokes)
    lockIn: 1,       // an INSTANT WIN symbol locking in on a reel
    streakBreak: 1,  // the INSTANT WIN streak breaking
    slotWin: 1,      // a winning line
    slotBust: 1,     // no win
    steal: 1,        // the STEAL prize taking a mark
    boom: 1,         // the BOMB prize blowing up a mark
    boomSmall: 1,    // small explosions (the INSTANT WIN title blowing apart)
    fanfare: 1,      // the brass fanfare for INSTANT WIN
    fireworks: 1,    // the fireworks for INSTANT WIN
    whoosh: 1,       // a whoosh as the wheel or the slot machine flies away
    // the Fortune Wheel
    wheelPull: 1,    // the creaky wind-back before the spin
    wheelLaunch: 1,  // the launch whoosh
    wheelClack: 1,   // the flapper clack (its own settings are in SOUND.wheelClack above)
    heartPulse: 1,   // the racing heartbeat during the spin (see SOUND.heartbeat above)
    rocketRumble: 1, // the engines building before the wheel blasts off
    liftoff: 1,      // the lift-off roar
    bigBoom: 1,      // the deep layered explosion (the wheel landing, the slot machine leaving)
  },
};
