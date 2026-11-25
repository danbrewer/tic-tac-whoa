# Infinite Tic-Tac-Toe

**One board is never enough.** Win a tiny tic-tac-toe game to claim a square on a
larger board; win that board and it becomes the centre of an even larger one.
Keep climbing for as long as you can. The boards stack up like a tower in
Mordor, except the fate of the realm is decided by Xs and Os.

This repository contains the complete game: a self-contained, client-side
browser app with an isometric canvas renderer, nine game variants, a Fortune
Wheel, a Mystery Jackpot, animated transitions, synthesized sound effects, and
an optional computer opponent. There is no server-side game logic, build step,
package manager, or runtime dependency.

## Run it

Open `index.html` directly in a modern browser, or serve the project directory:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Serving over HTTP enables the live Web Audio
processing for recorded voice-overs. When opened as a `file://` URL, browsers
restrict processing local audio files, so the game uses pre-rendered
`*-hall.mp3` versions instead. Audio in either case may need a click or tap to
unlock, as required by browsers.

The only external resource is the font stylesheet from Google Fonts in
`index.html`; system-font fallbacks are used when it is unavailable.

## How the game works

Each small 3×3 board is a **Turf Battle**. Its winner claims the matching space
on the board above. Winning a full board completes a **Round**: that board is
preserved beneath the centre space of a new board, and play continues there.
The tree of boards can grow without a fixed limit.

Before each Turf Battle, the Fortune Wheel chooses one of nine rules:

- **Classic** — standard tic-tac-toe.
- **Vanishing Marks** — each player keeps only their newest three marks.
- **Gravity** — marks fall to the bottom of their column.
- **Shifting Squares** — rows or columns slide as the battle progresses.
- **Wild Square** — a shared mark can complete a line for either player.
- **Misère** — making a line loses.
- **Fog of War** — older marks disappear beneath fog.
- **Ring Spin** — the outer squares rotate.
- **Crossfire** — opposite corners trade places.

A hidden Jackpot square can trigger the slot-machine overlay and award a board
space, steal, bomb, or other prize. Some prizes alter the next rule selection.

## The code at a glance

The app uses classic browser scripts rather than modules. Script order in
`index.html` is significant: the data/configuration scripts load first,
followed by effects and overlays, with `game.js` last.

| File | Responsibility |
| --- | --- |
| `index.html` | DOM structure for the board, HUD, dialogs, overlays, and script loading |
| `style.css` | Layout, visual theme, responsive styles, and CSS animations |
| `js/timing.js` | Durations and start offsets for automatic sequences |
| `js/strings.js` | All player-facing copy and page-string initialization |
| `js/sound-config.js` | Starting mix, voice levels, and per-effect volume multipliers |
| `js/sound.js` | Web Audio synthesis, music, voice playback, and mixer |
| `js/render.js` | Isometric canvas renderer, board layout, camera, easing, and tweens |
| `js/minimap.js` | Overview of the live and completed boards |
| `js/crew.js` | Animated characters around the slot machine |
| `js/boom.js` | Full-screen particle effects and the Rule Pick icon flight |
| `js/slots.js` | Mystery Jackpot slots and Rule Pick cards |
| `js/wheel.js` | Fortune Wheel rendering and rule selection |
| `js/game.js` | Board model, rules, AI, game controller, persistence, HUD, replay, and input |
| `media/soundfx/` | Recorded announcer voices and reference sound-effect renders |

`Game` owns the board tree and game flow. The renderer and minimap draw that
state; the wheel and slot overlays resolve with a player's result, which `Game`
then applies. A typical move follows this path:

```text
input → Game.play()
      → place a mark in the current Turf Battle
      → apply that rule's automatic action
      → judge the battle and resolve any jackpot
      → claim the matching parent-board space
      → repeat upward if a board was won; create a new Round if the root was won
      → save state and update the HUD
```

The board model is a tree: each large-board cell can point to an active child
battle or keep a completed battle record. This is what lets the game zoom
between a live battle and earlier parts of the growing match, while Review and
Instant Replay can revisit saved snapshots.

## Working on the game

Keep related data in its designated home:

- **Text:** add player-visible strings to `STRINGS` in `js/strings.js`, not as
  literals in HTML or other scripts. See [`strings-reference.md`](strings-reference.md).
- **Pacing:** tune automatic sequence timings in `js/timing.js`. Sequence
  groups share timing epochs; see
  [`transitions-technical-overview.md`](transitions-technical-overview.md).
- **Sound:** add sound-effect volume settings to `SOUND.effects` in
  `js/sound-config.js`; implement synthesized effects in `js/sound.js`.
- **Game rules and flow:** start in `js/game.js`; rule-specific board drawing
  belongs in `js/render.js`, and minimap-specific behavior in `js/minimap.js`.
- **Overlay presentation:** markup is in `index.html`, styling in `style.css`,
  and interaction logic in `js/slots.js` or `js/wheel.js`.

Game sequences can take several seconds and must stop cleanly when a new game
starts. In `game.js`, use `await this.step(wait(ms))` for pauses rather than a
bare timeout; the generation check cancels stale sequences. Delayed callbacks
that outlive the current call should also check the game generation.

There is currently no automated test suite or build command. Use the built-in
Developer Mode (**Shift+D**) to force wheel and slot results, load sample games,
or run isolated transition demos. For a new game type, also check the AI,
wheel, renderer, minimap, voice mapping, styles, help text, and save/load format.
The architecture guide has a detailed integration checklist.

## Further reading

- [`architecture-overview.md`](architecture-overview.md) — data model, move
  lifecycle, rendering, audio, persistence, and feature integration checklist.
- [`transitions-technical-overview.md`](transitions-technical-overview.md) —
  timing groups, epochs, and where each transition is used.
- [`strings-reference.md`](strings-reference.md) — player-facing strings and
  where they appear.
- [`app-analysis.md`](app-analysis.md) — current strengths, risks, and
  improvement ideas.
- [`media/soundfx/README.md`](media/soundfx/README.md) — voice and sound assets.
