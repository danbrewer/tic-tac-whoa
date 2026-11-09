# Sound effects

Sample MP3s for Infinite Tic-Tac-Toe (44.1 kHz mono, 192 kbps, peak about -1 dBFS).
They are not wired into the game yet. The game still synthesizes its sounds live in `js/sound.js`.

## Voice
- `instant-win.mp3`: Dan's "INSTANT WIN!" voice-over. It plays on a slots INSTANT WIN, run live through a
  Web Audio concert-hall reverb (see `Sound.voice` in `js/sound.js`).
- `instant-win-hall.mp3`: the same voice with that hall reverb pre-mixed in. The game plays this one when it's
  opened straight from disk (file://), because browsers don't let Web Audio process local files.
- `voice_instant_win.mp3`: a booming "IN-stant... WIN!" announcer. Made with the open-source Flite
  speech synthesizer (rms voice), then pitched down, doubled an octave lower, compressed, given a
  hall echo, and topped with a sub-bass boom on "WIN!".
- `voice_instant_win_alt.mp3`: the same treatment with Flite's awb voice.

- `gravity.mp3`: Dan's "GRAVITY" voice-over. It plays when the Gravity rule card comes up, through the same
  concert-hall reverb as INSTANT WIN.
- `gravity-hall.mp3`: the same voice with that hall reverb pre-mixed in, used when the game is opened from disk.
- `vanishing-marks.mp3`: Dan's "VANISHING MARKS" voice-over, with the same hall treatment, announced like Gravity.
- `vanishing-marks-hall.mp3`: the pre-mixed hall version, used when the game is opened from disk.
- `misere.mp3`: Dan's "MISÈRE" voice-over, with the same hall treatment, announced like Gravity.
- `misere-hall.mp3`: the pre-mixed hall version, used when the game is opened from disk.
- `shifting-squares.mp3`, `wild-square.mp3`, `classic.mp3`: Dan's voice-overs for those modes, with the same hall treatment, announced like Gravity.
- `shifting-squares-hall.mp3`, `wild-square-hall.mp3`, `classic-hall.mp3`: their pre-mixed hall versions, used when the game is opened from disk.
- `ring-spin.mp3`, `crossfire.mp3`, `fog-of-war.mp3`: Dan's voice-overs for those modes, with the same hall treatment, announced like Gravity.
- `ring-spin-hall.mp3`, `crossfire-hall.mp3`, `fog-of-war-hall.mp3`: their pre-mixed hall versions, used when the game is opened from disk.
- The mode voices use a toned-down hall (a 2.8 s reverb, about half the wet level, lighter slap-back echoes). Only INSTANT WIN keeps the original huge 4.2 s hall.
- `gravity-pa.mp3`: an earlier stadium-PA take, no longer used and safe to delete.

## Effects
Each one is rendered offline from the game's own Web Audio code, so it matches what you hear in play.

| File | Where it's used |
|---|---|
| place_x, land | placing a mark and its landing thump |
| win, draw, fanfare | game outcomes |
| ascend, zoom_in, zoom_out | moving between levels |
| poof, stone, steal, shift, wild | rule effects |
| card_flip, card_pick | Rule Pick cards |
| jackpot_found, slot_lever, slot_reel_stop, slot_win_big, slot_bust | Mystery Jackpot slots |
| drumroll, wheel_clack, wheel_launch | Wheel of Games |
| heartbeat | one heartbeat from the wheel spin-down |
| big_boom | explosion boom |
| liftoff_rocket | the wheel's shuttle-style blast-off |
| hydraulic_lift, lock_clunk_boom | the Gravity board rising and locking upright |
| whoosh | transition whoosh |

Everything here was generated for this project, so it's free to use.
