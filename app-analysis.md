# App analysis

A review of the Infinite Tic-Tac-Toe codebase as of November 2026. It covers how healthy the code is, the risks I found, and improvements in priority order. Read [`architecture-overview.md`](architecture-overview.md) first if you are new to the code. The line numbers below were correct when this was written. If one has drifted, search for the name shown next to it.

## Summary

The game is in good shape for a project of its kind. The code is consistent, well commented and has no dependencies. Long, interruptible animated sequences are handled with a sound pattern (section 3). Nothing I found is broken today.

The main risks come from growth:

- `game.js` has become a 1,700-line file that does many jobs.
- The Instant Replay log will get slower and eventually hit the browser's storage limit as games reach higher levels.
- There are no automated tests, so every change has to be checked by hand.

The top recommendations are:

1. Make the replay log cheaper to save.
2. Add a small automated smoke test.
3. Split `game.js` into a few focused files.

| Area | Rating | Notes |
|---|---|---|
| Readability | Good | Clear names, plain-English comments, a consistent object-per-feature style |
| Structure | Fair | Sensible split for rendering, audio and overlays, but `game.js` carries too much |
| Correctness | Good | No bugs found in normal play. The cancellation pattern is applied carefully |
| Performance | Good now, at risk later | Smooth today. The replay log's save cost grows with game length (finding 1) |
| Testability | Weak | No automated tests, and everything is global, which makes unit tests harder |
| Maintainability | Fair | Timings are now centralised. Some rules and constants are duplicated across files |
| Accessibility | Weak | The board is canvas-only and can't be played with a keyboard or screen reader |
| Security | Good | No user-typed text reaches the page, and there is no server or network input |

---

## 1. Strengths

- **No build, no dependencies.** You can open the game straight from disk, it will keep working for years, and there is nothing to update.
- **One clear controller.** `Game` owns the state and runs every sequence. The renderer and minimap only draw. The overlays return Promises that `Game` awaits. This makes the flow of a move easy to follow (architecture overview, section 5).
- **Safe interruption.** The `busy` flag, the `gen` counter and `step()` make it safe to start a new game halfway through a long animated sequence ([`js/game.js:336`](js/game.js#L336)).
- **The rendering is mostly stateless.** Animations are calculated from timestamps inside the draw call, so there are few animation objects to create, track or clean up.
- **Centralised timing.** All sequence timings are in [`js/timing.js`](js/timing.js) and documented.
- **Careful audio.** It unlocks audio on Safari, level-matches the voice recordings, and falls back to pre-rendered files when opened from disk.
- **Thoughtful details.** The computer "forgets" fogged marks, it makes occasional deliberate mistakes so it feels human, and a corrupted save falls back to a new game instead of crashing.

## 2. Findings

Ranked from most to least important. Severity reflects the impact on players or on future development.

### Finding 1. The replay log is rewritten in full on every move (medium)

**Where:** `snapshot()` and `saveLog()`, [`js/game.js:1251`](js/game.js#L1251) and [`js/game.js:1278`](js/game.js#L1278). The cap `LOG_CAP = 600` is at [`js/game.js:13`](js/game.js#L13).

Every settled move adds a snapshot of the *entire* board tree to `Game.log`. Then the whole log, up to 600 snapshots, is turned into one JSON string and written to `localStorage`. Each snapshot is already a JSON string, so it is escaped a second time inside the log.

**Measured:** early in Level 1, a snapshot is about 0.7–0.9 KB and saving a 12-entry log takes well under a millisecond.

**Projected:** a snapshot grows by roughly 0.4 KB for each finished Turf Battle kept in the tree, because every finished game is stored as a record. By Level 2–3 a snapshot is around 10 KB, so a full 600-entry log is around 6 MB. That is more than the typical 5 MB `localStorage` limit. Once the log is near the limit, each move triggers one or more failed write attempts, then trims a third of the log (`trimLog`). Each attempt re-encodes megabytes of text on the main thread. Expect visible stutter after moves in long games, and a review history that keeps losing its oldest games.

**Recommendation, in increasing effort:**

1. Save the log less often, for example every few moves or when the page is hidden (`visibilitychange`), and keep it in memory between saves.
2. Store only what changed: the path of the board that changed and its new contents, or simply the move that was made. Rebuild snapshots when a replay starts.
3. Move the log to IndexedDB, which has far more space and doesn't block the main thread.

### Finding 2. No automated tests (medium)

There is no test suite in the repository. Changes are checked by playing the game. The game has a lot of sequence logic where a timing or ordering change can break something far away: wheel → rule card → Wild Square intro → first move, or slots → RULE PICK → title card.

**Recommendation:** add a small Playwright smoke test (a `tests/` folder and a `package.json` with one dev dependency). It should cover:

- start a new game, spin the wheel and play to a Turf Battle win;
- each game type, using Developer Mode to force the wheel;
- a forced jackpot prize;
- Instant Replay start and stop;
- no errors in the console during any of these.

Run it before committing. Tests of this shape were run by hand during development, so the approach is proven. The pure rule functions (`judge`, `landingCell`, `applyShift`, `applyRing`, `applyCross`, `fogged`) could also get fast unit tests if they were exported (see finding 3).

### Finding 3. `game.js` has too many jobs (medium)

**Where:** [`js/game.js`](js/game.js), 1,725 lines. It contains:

- the rules (`judge`, `apply*`, `landingCell`);
- the computer player (`AI`);
- saving and loading;
- the `Game` controller, including every sequence;
- the HUD (`updateHUD` and helpers);
- Instant Replay and Review;
- the developer panel;
- all input wiring and the main loop.

This makes the file hard to navigate and makes changes riskier. It also means the rules can't be tested without a browser page.

**Recommendation:** split along the lines that already exist, without changing behaviour:

| New file | Contents |
|---|---|
| `js/rules.js` | `LINES`, `RULES`, `judge`, `landingCell`, `applyShift/Ring/Cross`, `fogged`, `threatsW` |
| `js/ai.js` | `AI` |
| `js/storage.js` | `serialize`, `deserialize`, save, prefs, the log |
| `js/replay.js` | Review and Instant Replay |
| `js/hud.js` | `updateHUD`, rule badge, stakes, toast, banner, help |
| `js/main.js` | Input wiring and the main loop |

Keep the global-object style for now, so this is a move-only refactor. Moving to ES modules can come later.

### Finding 4. Constants and rules are duplicated across files (low)

| Duplicate | Original | Copy |
|---|---|---|
| The eight winning lines | `LINES`, [`js/game.js:4`](js/game.js#L4) | `WIN_LINES`, [`js/render.js:143`](js/render.js#L143) |
| Marks kept in Vanishing Marks | `KEEP_MARKS`, [`js/game.js:14`](js/game.js#L14) | `KEEP_MARKS_R`, [`js/render.js:140`](js/render.js#L140) ("must match") |
| Threat counting | `threatsW()`, [`js/game.js:136`](js/game.js#L136) | `threatsOf()`, [`js/render.js:144`](js/render.js#L144) |
| Gravity's landing space | `landingCell()` | `AI.ruleMoves()` repeats the column scan |
| The game-type list | `RULES` | `WHEEL_TYPES` (wheel.js), `RULE_VOICES` (sound.js), `rule-*` styles, help text |

If one copy changes and the other doesn't, the game disagrees with itself. For example, the renderer could highlight a "threat" the rules don't recognise.

**Recommendation:** keep one copy of each in the proposed `rules.js` (finding 3), which loads before `render.js`. For game types, add a startup check that warns in the console if `WHEEL_TYPES` or `RULE_VOICES` is missing a key from `RULES`.

### Finding 5. Overlay timers can't be cancelled (low, latent)

**Where:** `Wheel.spin()` ([`js/wheel.js:481`](js/wheel.js#L481)), `Slots.spin()` and `reveal()`, and `RulePick.open()` schedule their steps with plain `setTimeout` and never check `Game.gen`.

This is safe today only because the overlays cover the whole screen, so the New Game button can't be clicked while they are open. If that ever changes, a new game started mid-sequence would leave old timers running. For example, the previous wheel's "blast off" timer could close the next wheel early. One way it could change is a keyboard shortcut for New Game. Another is moving the HUD or the developer panel above the overlays.

**Recommendation:** give each overlay a `cancel()` method that clears its timers, and call it from `Game.newGame()`. Alternatively, have each timer check a token captured when the overlay opened.

### Finding 6. The board can't be played with a keyboard or a screen reader (low to medium, depending on audience)

The board is drawn on a `<canvas>` with only an `aria-label` ([`index.html`](index.html)). The keyboard can spin the wheel, pull the lever, zoom and control a replay, but it can't place a mark. Screen readers get toasts through `aria-live` regions but can't tell which spaces hold what.

**Recommendation:**

- Allow keys 1–9, or the arrow keys plus Enter, to select a space.
- Keep a visually hidden 3×3 grid of buttons in sync with the live board, so assistive technology can read and play it.
- Respect `prefers-reduced-motion` by shortening the big sequences and the screen shake. With `TIMING` this is now a small change: scale the values when the media query matches.

### Finding 7. Work done every frame that could be done once (low)

`Game.layoutAll()` re-lays-out the whole board tree every frame ([`js/game.js:1711`](js/game.js#L1711)), although layout only changes when the tree changes. `drawBoard()` also creates many gradients per frame. Neither is a problem on current hardware at current game sizes, but both grow with the size of the tree.

**Recommendation:** only call `layoutAll()` when a board is added, removed or zoomed (the code already calls it at those moments), and cache gradients that don't depend on time.

### Finding 8. Developer Mode is open to players and its settings persist (low)

Shift+D opens the developer panel for anyone ([`js/game.js:1684`](js/game.js#L1684)). Its settings are saved with the preferences (`savePrefs`, [`js/game.js:1405`](js/game.js#L1405)). A player who discovers it can force jackpots. If "jackpot everywhere" or "force prize" is left on, it carries over into later sessions.

**Recommendation:** if that is intended, show a small "DEV" badge in the HUD whenever Developer Mode is on, so nobody is surprised. Otherwise, only enable it with a URL flag such as `?dev`.

### Finding 9. Save format has no migration path (low)

The saves use `-v1` keys. `deserialize()` fills gaps with defaults. For example, a missing rule becomes `'vanish'` ([`js/game.js:298`](js/game.js#L298)). This works for adding fields. It won't cope with a field changing meaning, and a save that fails to load is silently replaced by a new game.

**Recommendation:** store a format version number inside the save, and write a small `migrate(data)` step when the format next changes. Before replacing a save that failed to load, copy it to a `...-broken` key, so it can be recovered.

### Finding 10. Documentation gaps (low)

- The root [`README.md`](README.md) is a single line. It should say what the game is, how to run it (including serving over HTTP for full audio), and link to the three technical documents.
- [`media/soundfx/README.md`](media/soundfx/README.md) still says the MP3s "are not wired into the game yet". That is no longer true.
- `innerHTML` is used in about 40 places to build HTML from internal strings. That is safe today because no text typed by a player is ever inserted. If player names or chat are ever added, those values must be escaped, or set with `textContent`.

## 3. The sequencing pattern

This is worth calling out because it is the heart of the code. Every multi-second sequence is an `async` function on `Game` that awaits pauses, camera moves and overlays through `step()`. A new game increments `gen`, and the next `step()` in any old sequence throws and unwinds it.

The pattern is simple and has held up well through many features. Two habits keep it working:

- In `game.js`, always pause with `await this.step(wait(ms))`, never a bare `setTimeout`.
- Any delayed visual effect should check `gen` before running.

The one gap is that the overlay modules don't take part in it (finding 5).

## 4. Suggested order of work

| # | Change | Effort | Why now |
|---|---|---|---|
| 1 | Save the replay log less often, or store changes only (finding 1) | Small to medium | Prevents stutter and lost history in long games |
| 2 | Playwright smoke test (finding 2) | Small | Makes every later change safer, including the refactor |
| 3 | Split `game.js`, with one copy of the shared rules (findings 3 and 4) | Medium | Easier navigation and unit-testable rules |
| 4 | Overlay `cancel()` methods (finding 5) | Small | Closes a latent bug before a UI change exposes it |
| 5 | README updates and a DEV badge (findings 8 and 10) | Small | Quick wins |
| 6 | Keyboard play and reduced motion (finding 6) | Medium | Opens the game to more players |
| 7 | Save versioning, per-frame layout (findings 7 and 9) | Small | Housekeeping |
