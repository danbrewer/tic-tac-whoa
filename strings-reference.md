# Strings reference

This document is for a developer working on Infinite Tic-Tac-Toe who needs to change, add or find any text the player sees.

## The rule

**All player-facing text lives in one file: [`js/strings.js`](js/strings.js).** That covers:

- game names and rule descriptions;
- How to play;
- buttons, labels and tooltips;
- toast messages;
- the big words that pop up over the board;
- the Fortune Wheel, the slot machine, RULE PICK, Review and Instant Replay;
- the mini-map and the Developer Mode panel.

**Future games and enhancements must put their text in `js/strings.js` too.** Never type player-facing text straight into another JavaScript file or into `index.html`. Add the string to the right group in `STRINGS`, then read it as `STRINGS.group.name`.

Related documents: [`architecture-overview.md`](architecture-overview.md) (how the code fits together) and [`transitions-technical-overview.md`](transitions-technical-overview.md) (timings).

## How the file works

`js/strings.js` defines one object, `STRINGS`, grouped by where the text appears:

| Group | Where the text appears |
|---|---|
| `STRINGS.general` | Names used everywhere: the nine space names, "Turf Battle" / "Round N", You / Computer |
| `STRINGS.rules` | The nine game types: `name`, `wheel` (spoke label), `short` (one-liner), `help` (How to play) |
| `STRINGS.page` | Fixed text on the page: logo, buttons along the bottom, zoom bar, mixer |
| `STRINGS.help` | The How to play window |
| `STRINGS.hud` | The turn line, the rule badge, the rule plate at the top, the stakes bar |
| `STRINGS.msg` | Toast messages at the bottom of the screen |
| `STRINGS.pop` | Big words that float up over the board ("TURF WON!", "BOOM!") and the new-Round banner |
| `STRINGS.ruleCard` | The rule title card |
| `STRINGS.wheel` | The Fortune Wheel |
| `STRINGS.slots` | The slot machine: title, help pop-ups, symbol labels, prizes, paylines, INSTANT WIN drama |
| `STRINGS.rulePick` | RULE PICK |
| `STRINGS.review` | The Review window and the Instant Replay bar |
| `STRINGS.icons` | Screen-reader labels of the animated game-type icons |
| `STRINGS.minimap` | Text drawn on the mini-map |
| `STRINGS.dev` | The Developer Mode panel and its messages |

There are two kinds of entry:

- **Plain strings** are used as they are, for example `STRINGS.page.newGame` is "New game".
- **Functions** fill in the parts that change, for example `STRINGS.msg.goesAgain('X')` gives "**X** goes again!". You can reword the text between the backticks freely. Keep the `${...}` parts, because that is where the player, space, level and so on are filled in. (Players see levels as **Rounds**: level 1 is "Round 1". The code and the argument names still say `level`.) The arguments are named in the function, such as `(p, cell, level)`.

Many strings contain a little HTML: `<b>` for bold, `<br>` for a line break, `<i>` for italics. `mark(p)` writes a player's letter in their colour, as `<b class="X">X</b>`.

### Text on the page (`index.html`)

`index.html` contains no text of its own. Elements that show fixed text carry an attribute naming the string:

| Attribute | What it fills |
|---|---|
| `data-str="group.name"` | The element's content (HTML allowed) |
| `data-str-title="group.name"` | Its tooltip (`title`) |
| `data-str-label="group.name"` | Its screen-reader label (`aria-label`) |
| `data-str-letters="group.name"` | One `<i>` per letter, for the bouncing titles "GAMES!" and "JACKPOT!". An optional `data-colors` gives each letter a colour |

`applyPageStrings()` at the bottom of `js/strings.js` fills them in when the page loads. If an attribute names a string that doesn't exist, the browser console shows a warning: `STRINGS: no text at "..."`.

The How to play steps are built by `buildHelp()` at the bottom of `js/game.js`. One step contains the marker `{rules}`, which is replaced by the list of game types. That list is built from `RULES`, so a new game type appears in How to play automatically.

### How other files read the strings

Most code reads `STRINGS.group.name` directly. A few older names were kept as short aliases, so you will also see them in the code:

| Alias | Is | Defined in |
|---|---|---|
| `CELL_NAMES[k]` | `STRINGS.general.cellNames[k]` | `js/game.js` |
| `lvName(level, the)` | `STRINGS.general.levelName` | `js/game.js` |
| `RULES[key].name` / `.short` / `.help` / `.wheel` | `STRINGS.rules[key]`, merged with the icon | `js/game.js` |
| `MOVERS[rule]` | `STRINGS.pop.movers` | `js/game.js` |
| `PRIZES[prize].name` / `.desc` | `STRINGS.slots.prizes` | `js/slots.js` |
| `SLOT_SYMS[k].label` | `STRINGS.slots.symbols[k]` | `js/slots.js` |
| `PAYLINES[i].name` | `STRINGS.slots.paylines[i]` | `js/slots.js` |
| `WHEEL_TYPES[i].label` | `STRINGS.rules[key].wheel` | `js/wheel.js` |

## Common tasks

**Change some wording.** Find the text in `js/strings.js` (search for a few of its words), edit it, and reload. The tables below show every place each string appears, so you can check the new wording fits.

**Add text for a new feature:**

1. Pick the group where the text appears, or add a new group with a header comment like the others.
2. Add the entry: a string, or a function if parts of it change.
3. In the code, use `STRINGS.group.name`. For fixed text on the page, put an empty element in `index.html` with `data-str="group.name"`.
4. Add a row to the matching table in this document.

**Add a new game type:**

1. Add its entry to `STRINGS.rules` with `name`, `wheel`, `short` and `help`.
2. Follow the rest of the checklist in [`architecture-overview.md`](architecture-overview.md#adding-a-new-game-type-checklist).
3. If the board moves by itself every few turns, also add its verb to `STRINGS.hud.movesIn` and its pop-up word to `STRINGS.pop.movers`.

**Numbers that appear in text.** A few strings repeat a number that is set in `js/game.js`:

- 3 marks kept in Vanishing Marks (`KEEP_MARKS`);
- the 18-move limit (`MOVE_CAP`);
- boards that move every 3 turns (`SHIFT_EVERY`);
- 4 marks with the shield prize.

Their comments in `js/strings.js` say so. If you change one of those numbers, update the text too.

**What is not in `strings.js`.** Emoji and icons that are pictures rather than words, such as the game-type icons in `RULES` and the slot symbols in `SLOT_SYMS`, stay next to the code that draws them. So do text-free symbols such as `−`, `+`, `×` and `✦`. Messages written only to the developer console are not player-facing, so they stay in place too.

## Every string and where it is used

The line numbers were correct when this was written. They drift as code changes. If one is off, search the file for the string's name (for example `goesAgain`). Function entries show their template; `${...}` marks the parts that are filled in.

### 1. General names (`STRINGS.general`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `general.cellNames` | *list*: `` ["top","upper-right","right","upper-left","center","lower-right","left","lower-l `` | [`js/strings.js:36`](js/strings.js#L36) | [`js/game.js:6`](js/game.js#L6)<br>[`js/game.js:405`](js/game.js#L405)<br>[`js/game.js:496`](js/game.js#L496)<br>[`js/game.js:605`](js/game.js#L605)<br>[`js/game.js:1100`](js/game.js#L1100)<br>[`js/game.js:1265`](js/game.js#L1265)<br>…and 4 more (search the name)<br>*also read everywhere as `CELL_NAMES[k]`* |
| `general.levelName` | *function (level, the = false)*: `` (level === 0 ? `${the ? 'the ' : ''}Turf Battle` : `Round ${level}`) `` | [`js/strings.js:38`](js/strings.js#L38) | [`js/game.js:8`](js/game.js#L8)<br>[`js/game.js:380`](js/game.js#L380)<br>[`js/game.js:590`](js/game.js#L590)<br>[`js/game.js:1130`](js/game.js#L1130)<br>[`js/game.js:1266`](js/game.js#L1266)<br>[`js/game.js:1277`](js/game.js#L1277)<br>…and 6 more (search the name)<br>*also read everywhere as `lvName(level)`* |
| `general.levelShort` | *function (level)*: `` (level === 0 ? 'Turf' : `R${level}`) `` | [`js/strings.js:39`](js/strings.js#L39) | [`js/game.js:1452`](js/game.js#L1452) |
| `general.you` | "You" | [`js/strings.js:40`](js/strings.js#L40) | [`js/game.js:1461`](js/game.js#L1461) |
| `general.computer` | "Computer" | [`js/strings.js:41`](js/strings.js#L41) | [`js/game.js:1461`](js/game.js#L1461) |

### 2. Game types (`STRINGS.rules`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `rules.classic.name` | "Classic Tic-Tac-Toe" | [`js/strings.js:53`](js/strings.js#L53) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.classic.wheel` | "CLASSIC" | [`js/strings.js:53`](js/strings.js#L53) | [`js/wheel.js:5`](js/wheel.js#L5) |
| `rules.classic.short` | "Plain tic-tac-toe. A full board with no line is a stalemate." | [`js/strings.js:54`](js/strings.js#L54) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.classic.help` | "plain rules." | [`js/strings.js:55`](js/strings.js#L55) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.vanish.name` | "Vanishing Marks" | [`js/strings.js:58`](js/strings.js#L58) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.vanish.wheel` | "VANISH" | [`js/strings.js:58`](js/strings.js#L58) | [`js/wheel.js:6`](js/wheel.js#L6) |
| `rules.vanish.short` | "Keep only your 3 newest marks. Your 4th makes your oldest vanish." | [`js/strings.js:59`](js/strings.js#L59) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.vanish.help` | "you keep only your <b>3 newest marks</b>. Your 4th makes your oldest vanish (it flickers when it's next; th…" | [`js/strings.js:60`](js/strings.js#L60) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.gravity.name` | "Gravity" | [`js/strings.js:63`](js/strings.js#L63) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.gravity.wheel` | "GRAVITY" | [`js/strings.js:63`](js/strings.js#L63) | [`js/wheel.js:7`](js/wheel.js#L7) |
| `rules.gravity.short` | "The board stands up: marks drop to the bottom of their column, like Connect Four." | [`js/strings.js:64`](js/strings.js#L64) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.gravity.help` | "the board stands up like Connect Four, and marks drop to the bottom of their column." | [`js/strings.js:65`](js/strings.js#L65) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.shift.name` | "Shifting Squares" | [`js/strings.js:68`](js/strings.js#L68) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.shift.wheel` | "SHIFT" | [`js/strings.js:68`](js/strings.js#L68) | [`js/wheel.js:8`](js/wheel.js#L8) |
| `rules.shift.short` | "Every 3 moves a row or column slides one space and wraps around." | [`js/strings.js:69`](js/strings.js#L69) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.shift.help` | "every 3 moves the row or column with the arrows slides one space, and marks pushed off the edge wrap around." | [`js/strings.js:70`](js/strings.js#L70) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.wild.name` | "Wild Square" | [`js/strings.js:73`](js/strings.js#L73) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.wild.wheel` | "WILD" | [`js/strings.js:73`](js/strings.js#L73) | [`js/wheel.js:9`](js/wheel.js#L9) |
| `rules.wild.short` | "The shape-shifting mark counts for both players and jumps to a new space after every turn." | [`js/strings.js:74`](js/strings.js#L74) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.wild.help` | "the shape-shifting mark counts for both players and jumps to a new space after every turn." | [`js/strings.js:75`](js/strings.js#L75) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.misere.name` | "Misère" | [`js/strings.js:78`](js/strings.js#L78) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.misere.wheel` | "MISÈRE" | [`js/strings.js:78`](js/strings.js#L78) | [`js/wheel.js:10`](js/wheel.js#L10) |
| `rules.misere.short` | "Upside down: whoever makes three in a row LOSES." | [`js/strings.js:79`](js/strings.js#L79) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.misere.help` | "whoever makes three in a row <b>loses</b>." | [`js/strings.js:80`](js/strings.js#L80) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.fog.name` | "Fog of War" | [`js/strings.js:83`](js/strings.js#L83) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.fog.wheel` | "FOG" | [`js/strings.js:83`](js/strings.js#L83) | [`js/wheel.js:11`](js/wheel.js#L11) |
| `rules.fog.short` | "Fog rolls over each mark after the next move. Fogged spaces are taken, so remember who is where!" | [`js/strings.js:84`](js/strings.js#L84) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.fog.help` | "once the next move lands, fog rolls over each mark and hides whether it's an X or an O. Fogged spaces are s…" | [`js/strings.js:85`](js/strings.js#L85) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.ring.name` | "Ring Spin" | [`js/strings.js:88`](js/strings.js#L88) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.ring.wheel` | "RING" | [`js/strings.js:88`](js/strings.js#L88) | [`js/wheel.js:12`](js/wheel.js#L12) |
| `rules.ring.short` | "Every 3 moves the 8 outer spaces turn one step clockwise around the center." | [`js/strings.js:89`](js/strings.js#L89) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.ring.help` | "every 3 moves the 8 outer spaces turn one step clockwise around the center." | [`js/strings.js:90`](js/strings.js#L90) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |
| `rules.cross.name` | "Crossfire" | [`js/strings.js:93`](js/strings.js#L93) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:924`](js/game.js#L924)<br>[`js/game.js:951`](js/game.js#L951)<br>…and 6 more (search the name)<br>*read as `RULES[key].name`* |
| `rules.cross.wheel` | "CROSS" | [`js/strings.js:93`](js/strings.js#L93) | [`js/wheel.js:13`](js/wheel.js#L13) |
| `rules.cross.short` | "Every 3 moves the marks on both diagonals slide along them, corner to corner. The center stays put." | [`js/strings.js:94`](js/strings.js#L94) | [`js/game.js:701`](js/game.js#L701)<br>[`js/game.js:748`](js/game.js#L748)<br>[`js/game.js:753`](js/game.js#L753)<br>[`js/game.js:754`](js/game.js#L754)<br>[`js/game.js:1512`](js/game.js#L1512)<br>[`js/slots.js:534`](js/slots.js#L534)<br>*read as `RULES[key].short`* |
| `rules.cross.help` | "every 3 moves the marks at the ends of each diagonal slide through the center and trade corners. The center…" | [`js/strings.js:95`](js/strings.js#L95) | [`js/game.js:1752`](js/game.js#L1752)<br>*read as `RULES[key].help`* |

### 3. Page text (`STRINGS.page`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `page.title` | "Infinite Tic-Tac-Toe" | [`js/strings.js:103`](js/strings.js#L103) | [`js/strings.js:426`](js/strings.js#L426) |
| `page.brand` | "Infinite<br>Tic-Tac-Toe" | [`js/strings.js:104`](js/strings.js#L104) | [`index.html:20`](index.html#L20) |
| `page.sceneLabel` | "Isometric tic-tac-toe board" | [`js/strings.js:105`](js/strings.js#L105) | [`index.html:15`](index.html#L15) |
| `page.levelBoxTitle` | "The highest round reached in this game" | [`js/strings.js:106`](js/strings.js#L106) | [`index.html:22`](index.html#L22) |
| `page.topLevel` | "Top round" | [`js/strings.js:107`](js/strings.js#L107) | [`index.html:23`](index.html#L23) |
| `page.best` | *function (n)*: `` `Best: ${n}` `` | [`js/strings.js:108`](js/strings.js#L108) | [`js/game.js:1434`](js/game.js#L1434) |
| `page.pathLabel` | "Where you are" | [`js/strings.js:109`](js/strings.js#L109) | [`index.html:30`](index.html#L30) |
| `page.minimapLabel` | "Mini-map of the live boards and earlier rounds" | [`js/strings.js:110`](js/strings.js#L110) | [`index.html:32`](index.html#L32) |
| `page.zoomBarLabel` | "Round zoom" | [`js/strings.js:112`](js/strings.js#L112) | [`index.html:37`](index.html#L37) |
| `page.zoom` | "Zoom" | [`js/strings.js:113`](js/strings.js#L113) | [`index.html:38`](index.html#L38) |
| `page.zoomOutTitle` | "Zoom out a round (− key or scroll down)" | [`js/strings.js:114`](js/strings.js#L114) | [`index.html:39`](index.html#L39) |
| `page.zoomInTitle` | "Zoom in a round (+ key or scroll up)" | [`js/strings.js:115`](js/strings.js#L115) | [`index.html:41`](index.html#L41) |
| `page.zoomLiveTitle` | "Back to the live game (Esc)" | [`js/strings.js:116`](js/strings.js#L116) | [`index.html:42`](index.html#L42) |
| `page.zoomLive` | "Back to game" | [`js/strings.js:117`](js/strings.js#L117) | [`index.html:42`](index.html#L42) |
| `page.zoomTo` | *function (name)*: `` `Zoom to ${name}` `` | [`js/strings.js:118`](js/strings.js#L118) | [`js/game.js:1452`](js/game.js#L1452) |
| `page.newGame` | "New game" | [`js/strings.js:120`](js/strings.js#L120) | [`js/game.js:1642`](js/game.js#L1642)<br>[`js/game.js:1647`](js/game.js#L1647)<br>[`index.html:49`](index.html#L49) |
| `page.newGameConfirm` | "Click again to restart" | [`js/strings.js:121`](js/strings.js#L121) | [`js/game.js:1640`](js/game.js#L1640) |
| `page.vsComputer` | *function (on)*: `` `vs Computer: ${on ? 'On' : 'Off'}` `` | [`js/strings.js:122`](js/strings.js#L122) | [`js/game.js:1484`](js/game.js#L1484) |
| `page.sound` | *function (on)*: `` `Sound: ${on ? 'On' : 'Off'}` `` | [`js/strings.js:123`](js/strings.js#L123) | [`js/game.js:1486`](js/game.js#L1486) |
| `page.soundLocked` | "🔇 Tap anywhere to turn the sound on" | [`js/strings.js:124`](js/strings.js#L124) | [`index.html:34`](index.html#L34) |
| `page.mix` | "🎚️ Mix" | [`js/strings.js:125`](js/strings.js#L125) | [`index.html:52`](index.html#L52) |
| `page.mixTitle` | "Volume mix" | [`js/strings.js:126`](js/strings.js#L126) | [`index.html:52`](index.html#L52) |
| `page.review` | "🎬 Review" | [`js/strings.js:127`](js/strings.js#L127) | [`index.html:53`](index.html#L53) |
| `page.reviewTitle` | "Game review: replay earlier games" | [`js/strings.js:128`](js/strings.js#L128) | [`index.html:53`](index.html#L53) |
| `page.howToPlay` | "How to play" | [`js/strings.js:129`](js/strings.js#L129) | [`index.html:54`](index.html#L54) |
| `page.mixerTitle` | "Volume mix" | [`js/strings.js:131`](js/strings.js#L131) | [`index.html:78`](index.html#L78) |
| `page.mixerSfx` | "Sound effects" | [`js/strings.js:132`](js/strings.js#L132) | [`index.html:79`](index.html#L79) |
| `page.mixerVoices` | "Voices" | [`js/strings.js:133`](js/strings.js#L133) | [`index.html:80`](index.html#L80) |
| `page.mixerTest` | "▶ Test voice" | [`js/strings.js:134`](js/strings.js#L134) | [`index.html:81`](index.html#L81) |
| `page.percent` | *function (n)*: `` `${n}%` `` | [`js/strings.js:135`](js/strings.js#L135) | [`js/game.js:1661`](js/game.js#L1661) |

### 4. How to play (`STRINGS.help`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `help.title` | "How to play" | [`js/strings.js:103`](js/strings.js#L103) | [`index.html:152`](index.html#L152) |
| `help.steps` | *list*: `` ["Every game starts with a <b>Turf Battle</b>: a quick game of tic-tac-toe on th `` | [`js/strings.js:144`](js/strings.js#L144) | [`js/game.js:1749`](js/game.js#L1749)<br>[`js/game.js:1753`](js/game.js#L1753) |
| `help.rule` | *function (icon, name, help)*: `` `${icon} <b>${name}:</b> ${help}` `` | [`js/strings.js:156`](js/strings.js#L156) | [`js/game.js:1752`](js/game.js#L1752) |
| `help.hint` | "Play hot-seat with a friend, or turn on <b>vs Computer</b> to play <span class="x">X</span> against a compu…" | [`js/strings.js:157`](js/strings.js#L157) | [`index.html:154`](index.html#L154) |
| `help.close` | "Let's play" | [`js/strings.js:158`](js/strings.js#L158) | [`index.html:155`](index.html#L155) |

### 5. HUD: turn line, rule badge, rule plate, stakes bar (`STRINGS.hud`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `hud.toMove` | *function (p, who)*: `` `${mark(p)} ${who ? `(${who}) ` : ''}to move` `` | [`js/strings.js:166`](js/strings.js#L166) | [`js/game.js:1471`](js/game.js#L1471) |
| `hud.picksSpace` | *function (p, who)*: `` `${mark(p)} ${who ? `(${who}) ` : ''}picks a space to fight for` `` | [`js/strings.js:167`](js/strings.js#L167) | [`js/game.js:1472`](js/game.js#L1472) |
| `hud.wins` | *function (p)*: `` `${mark(p)} wins!` `` | [`js/strings.js:168`](js/strings.js#L168) | [`js/game.js:1470`](js/game.js#L1470) |
| `hud.reviewTurf` | *function (level, cell, parentLevel, winner)*: `` `Replay: ${level === 0 ? 'the Turf Battle' : `the Round ${level} game`} for the ${cell} space of Round ${pa… `` | [`js/strings.js:169`](js/strings.js#L169) | [`js/game.js:1465`](js/game.js#L1465) |
| `hud.reviewLevel` | *function (name, winner)*: `` `Replay: ${name}, won by ${mark(winner)}` `` | [`js/strings.js:170`](js/strings.js#L170) | [`js/game.js:1467`](js/game.js#L1467) |
| `hud.viewing` | *function (name, curLevel)*: `` `Viewing ${name}. The live game is ${curLevel === 0 ? 'the Turf Battle' : `in Round ${curLevel}`}.` `` | [`js/strings.js:171`](js/strings.js#L171) | [`js/game.js:1469`](js/game.js#L1469) |
| `hud.selecting` | *function (verb, cpu)*: `` `🎰 ${verb} <span class="hint-dim">(${cpu ? 'computer choosing' : 'click a glowing ring'})</span>` `` | [`js/strings.js:173`](js/strings.js#L173) | [`js/game.js:1476`](js/game.js#L1476) |
| `hud.movesIn.shift` | "shifts" | [`js/strings.js:175`](js/strings.js#L175) | [`js/game.js:1503`](js/game.js#L1503)<br>*looked up by game type* |
| `hud.movesIn.ring` | "spins" | [`js/strings.js:175`](js/strings.js#L175) | [`js/game.js:1503`](js/game.js#L1503)<br>*looked up by game type* |
| `hud.movesIn.cross` | "crosses" | [`js/strings.js:175`](js/strings.js#L175) | [`js/game.js:1503`](js/game.js#L1503)<br>*looked up by game type* |
| `hud.moverSoon` | *function (verb)*: `` `${verb} after this move!` `` | [`js/strings.js:176`](js/strings.js#L176) | [`js/game.js:1504`](js/game.js#L1504) |
| `hud.moverIn` | *function (verb, n)*: `` `${verb} in ${n} moves` `` | [`js/strings.js:177`](js/strings.js#L177) | [`js/game.js:1504`](js/game.js#L1504) |
| `hud.fogBadge` | "fog covers each mark after the next move" | [`js/strings.js:178`](js/strings.js#L178) | [`js/game.js:1506`](js/game.js#L1506) |
| `hud.pinNext` | "Next" | [`js/strings.js:180`](js/strings.js#L180) | [`js/game.js:753`](js/game.js#L753) |
| `hud.pinNextTurf` | "Next Turf Battle" | [`js/strings.js:181`](js/strings.js#L181) | [`js/game.js:754`](js/game.js#L754) |
| `hud.pickedBy` | *function (p)*: `` `picked by ${mark(p)}` `` | [`js/strings.js:182`](js/strings.js#L182) | [`js/game.js:754`](js/game.js#L754) |
| `hud.stakesFirst` | *function (nextLevel)*: `` `Stakes: the winner takes the center of Round ${nextLevel}` `` | [`js/strings.js:184`](js/strings.js#L184) | [`js/game.js:1540`](js/game.js#L1540) |
| `hud.stakes` | "Stakes: " | [`js/strings.js:185`](js/strings.js#L185) | [`js/game.js:1545`](js/game.js#L1545) |
| `hud.matchPoint` | "🔥 MATCH POINT: " | [`js/strings.js:186`](js/strings.js#L186) | [`js/game.js:1545`](js/game.js#L1545) |
| `hud.stakesDefault` | *function (cell, level)*: `` `whoever wins takes the ${cell} space of Round ${level}` `` | [`js/strings.js:187`](js/strings.js#L187) | [`js/game.js:1546`](js/game.js#L1546) |
| `hud.stakesWins` | *function (p, level)*: `` `${mark(p)} wins Round ${level}` `` | [`js/strings.js:188`](js/strings.js#L188) | [`js/game.js:1523`](js/game.js#L1523) |
| `hud.stakesBlocks` | *function (opp)*: `` `blocks ${mark(opp)}` `` | [`js/strings.js:189`](js/strings.js#L189) | [`js/game.js:1525`](js/game.js#L1525) |
| `hud.stakesDouble` | "sets up a double threat" | [`js/strings.js:190`](js/strings.js#L190) | [`js/game.js:1528`](js/game.js#L1528) |
| `hud.stakesThreat` | *function (level)*: `` `threatens Round ${level}` `` | [`js/strings.js:191`](js/strings.js#L191) | [`js/game.js:1529`](js/game.js#L1529) |
| `hud.stakesPlayer` | *function (p, bits)*: `` `${mark(p)} ${bits}` `` | [`js/strings.js:192`](js/strings.js#L192) | [`js/game.js:1530`](js/game.js#L1530) |
| `hud.bigCanWin` | *function (p, cells)*: `` `${mark(p)} can win at ${cells}` `` | [`js/strings.js:193`](js/strings.js#L193) | [`js/game.js:1550`](js/game.js#L1550) |
| `hud.bigThreats` | *function (bits)*: `` `Glowing spaces win the round: ${bits}` `` | [`js/strings.js:194`](js/strings.js#L194) | [`js/game.js:1551`](js/game.js#L1551) |
| `hud.bigNoThreats` | "Pick a space. Glowing spaces mark winning spots." | [`js/strings.js:195`](js/strings.js#L195) | [`js/game.js:1551`](js/game.js#L1551) |
| `hud.jackpotHere` | "<span class="jp">🎰 jackpot hidden here</span>" | [`js/strings.js:196`](js/strings.js#L196) | [`js/game.js:1554`](js/game.js#L1554) |
| `hud.untilStalemate` | *function (n)*: `` `<span class="warn">${n} ${plural(n, 'move', 'moves')} until stalemate</span>` `` | [`js/strings.js:197`](js/strings.js#L197) | [`js/game.js:1557`](js/game.js#L1557) |

### 6. Messages (toasts) (`STRINGS.msg`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `msg.welcomeBack` | *function (name)*: `` `Welcome back! Picking up at ${name}.` `` | [`js/strings.js:204`](js/strings.js#L204) | [`js/game.js:380`](js/game.js#L380) |
| `msg.newGame` | "New game! X spins the wheel to pick the first game type." | [`js/strings.js:205`](js/strings.js#L205) | [`js/game.js:440`](js/game.js#L440) |
| `msg.goesFor` | *function (p, cell, childName)*: `` `${mark(p)} goes for the ${cell} space. Win this ${childName} to claim it!` `` | [`js/strings.js:206`](js/strings.js#L206) | [`js/game.js:496`](js/game.js#L496) |
| `msg.childGame` | *function (level)*: `` (level === 0 ? 'Turf Battle' : `Round ${level} game`) `` | [`js/strings.js:207`](js/strings.js#L207) | [`js/game.js:496`](js/game.js#L496) |
| `msg.jackpotUnderStone` | "The mystery jackpot was buried under stone!" | [`js/strings.js:208`](js/strings.js#L208) | [`js/game.js:543`](js/game.js#L543) |
| `msg.goesAgain` | *function (p)*: `` `${mark(p)} goes again!` `` | [`js/strings.js:209`](js/strings.js#L209) | [`js/game.js:555`](js/game.js#L555) |
| `msg.wins` | *function (p, name)*: `` `${mark(p)} wins ${name}!` `` | [`js/strings.js:210`](js/strings.js#L210) | [`js/game.js:590`](js/game.js#L590) |
| `msg.claims` | *function (p, cell, level)*: `` `${mark(p)} claims the ${cell} space of Round ${level}.` `` | [`js/strings.js:211`](js/strings.js#L211) | [`js/game.js:605`](js/game.js#L605) |
| `msg.levelBegins` | *function (level, holder, first)*: `` `Round ${level} begins! ${mark(holder)} holds the center. ${mark(first)} picks first.` `` | [`js/strings.js:212`](js/strings.js#L212) | [`js/game.js:643`](js/game.js#L643) |
| `msg.stalemate` | *function (vanish, moves, cell, level)*: `` `${vanish ? `No winner after ${moves} moves` : 'The board filled up with no winner'}. The ${cell} space of … `` | [`js/strings.js:214`](js/strings.js#L214) | [`js/game.js:1100`](js/game.js#L1100) |
| `msg.bigDraw` | *function (name, first)*: `` `${name} is a draw! Corners and center stay as a head start, edges and stone spaces clear. ${mark(first)} p… `` | [`js/strings.js:215`](js/strings.js#L215) | [`js/game.js:1130`](js/game.js#L1130) |
| `msg.turfDraw` | *function (name, first)*: `` `Draw! Replaying ${name} with ${mark(first)} going first.` `` | [`js/strings.js:216`](js/strings.js#L216) | [`js/game.js:1130`](js/game.js#L1130) |
| `msg.bust` | "Bust! Better luck on the next board." | [`js/strings.js:218`](js/strings.js#L218) | [`js/game.js:1010`](js/game.js#L1010) |
| `msg.shield` | *function (p)*: `` `${mark(p)} can now keep 4 marks in this game.` `` | [`js/strings.js:219`](js/strings.js#L219) | [`js/game.js:1014`](js/game.js#L1014) |
| `msg.noTarget` | "Nothing to target, so it becomes an extra move!" | [`js/strings.js:220`](js/strings.js#L220) | [`js/game.js:1033`](js/game.js#L1033) |
| `msg.pickClaim` | "Pick any empty space to claim" | [`js/strings.js:221`](js/strings.js#L221) | [`js/game.js:1030`](js/game.js#L1030) |
| `msg.pickSteal` | *function (opp)*: `` `Pick an ${mark(opp)} mark to steal` `` | [`js/strings.js:222`](js/strings.js#L222) | [`js/game.js:1031`](js/game.js#L1031) |
| `msg.pickBomb` | *function (opp, stone)*: `` `Pick an ${mark(opp)} mark${stone ? ' or stone' : ''} to blow up` `` | [`js/strings.js:223`](js/strings.js#L223) | [`js/game.js:1032`](js/game.js#L1032) |
| `msg.pick` | *function (verb)*: `` `${verb}!` `` | [`js/strings.js:224`](js/strings.js#L224) | [`js/game.js:1079`](js/game.js#L1079) |
| `msg.vsComputerOn` | "You are <b class="X">X</b>, the computer plays <b class="O">O</b>." | [`js/strings.js:226`](js/strings.js#L226) | [`js/game.js:1654`](js/game.js#L1654) |
| `msg.vsComputerOff` | "Hot-seat mode: two players, one screen." | [`js/strings.js:227`](js/strings.js#L227) | [`js/game.js:1654`](js/game.js#L1654) |
| `msg.replayBusy` | "Wait for the current move to finish, then start the replay." | [`js/strings.js:229`](js/strings.js#L229) | [`js/game.js:1309`](js/game.js#L1309) |
| `msg.replayEmpty` | "Nothing to replay yet." | [`js/strings.js:230`](js/strings.js#L230) | [`js/game.js:1310`](js/game.js#L1310) |
| `msg.replayCaughtUp` | "Instant Replay caught up. Back to the live game!" | [`js/strings.js:231`](js/strings.js#L231) | [`js/game.js:1369`](js/game.js#L1369) |
| `msg.replayStopped` | "Instant Replay stopped. Back to the live game." | [`js/strings.js:232`](js/strings.js#L232) | [`js/game.js:1369`](js/game.js#L1369) |

### 7. Big words over the board (`STRINGS.pop`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `pop.claimed` | "CLAIMED!" | [`js/strings.js:239`](js/strings.js#L239) | [`js/game.js:459`](js/game.js#L459) |
| `pop.goAgain` | "GO AGAIN!" | [`js/strings.js:240`](js/strings.js#L240) | [`js/game.js:554`](js/game.js#L554) |
| `pop.misereLoses` | *function (p)*: `` `${p} MADE THREE... AND LOSES!` `` | [`js/strings.js:241`](js/strings.js#L241) | [`js/game.js:573`](js/game.js#L573) |
| `pop.won` | *function (level)*: `` (level === 0 ? 'TURF WON!' : `ROUND ${level} WON!`) `` | [`js/strings.js:242`](js/strings.js#L242) | [`js/game.js:589`](js/game.js#L589) |
| `pop.levelBanner` | *function (level)*: `` `ROUND ${level}` `` | [`js/strings.js:243`](js/strings.js#L243) | [`js/game.js:626`](js/game.js#L626) |
| `pop.shift` | "SHIFT!" | [`js/strings.js:244`](js/strings.js#L244) | [`js/game.js:814`](js/game.js#L814) |
| `pop.movers.shift` | "SHIFT!" | [`js/strings.js:245`](js/strings.js#L245) | [`js/game.js:21`](js/game.js#L21)<br>[`js/game.js:848`](js/game.js#L848)<br>[`js/game.js:1501`](js/game.js#L1501)<br>*read through `MOVERS` in game.js* |
| `pop.movers.ring` | "RING SPIN!" | [`js/strings.js:245`](js/strings.js#L245) | [`js/game.js:21`](js/game.js#L21)<br>[`js/game.js:848`](js/game.js#L848)<br>[`js/game.js:1501`](js/game.js#L1501)<br>*read through `MOVERS` in game.js* |
| `pop.movers.cross` | "CROSSFIRE!" | [`js/strings.js:245`](js/strings.js#L245) | [`js/game.js:21`](js/game.js#L21)<br>[`js/game.js:848`](js/game.js#L848)<br>[`js/game.js:1501`](js/game.js#L1501)<br>*read through `MOVERS` in game.js* |
| `pop.fogLifts` | "THE FOG LIFTS!" | [`js/strings.js:246`](js/strings.js#L246) | [`js/game.js:827`](js/game.js#L827) |
| `pop.poof` | "POOF!" | [`js/strings.js:247`](js/strings.js#L247) | [`js/game.js:984`](js/game.js#L984) |
| `pop.jackpot` | "JACKPOT!" | [`js/strings.js:248`](js/strings.js#L248) | [`js/game.js:999`](js/game.js#L999) |
| `pop.stolen` | "STOLEN!" | [`js/strings.js:249`](js/strings.js#L249) | [`js/game.js:1049`](js/game.js#L1049) |
| `pop.boom` | "BOOM!" | [`js/strings.js:250`](js/strings.js#L250) | [`js/game.js:1063`](js/game.js#L1063) |
| `pop.stalemate` | "STALEMATE!" | [`js/strings.js:251`](js/strings.js#L251) | [`js/game.js:1098`](js/game.js#L1098) |
| `pop.blocked` | "BLOCKED!" | [`js/strings.js:252`](js/strings.js#L252) | [`js/game.js:1119`](js/game.js#L1119) |
| `pop.draw` | "DRAW!" | [`js/strings.js:253`](js/strings.js#L253) | [`js/game.js:1128`](js/game.js#L1128) |
| `pop.matchPoint` | "MATCH POINT!" | [`js/strings.js:254`](js/strings.js#L254) | [`js/game.js:1570`](js/game.js#L1570) |
| `pop.replayWins` | *function (p)*: `` `${p} WINS!` `` | [`js/strings.js:255`](js/strings.js#L255) | [`js/game.js:1338`](js/game.js#L1338) |

### 8. Rule title card (`STRINGS.ruleCard`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `ruleCard.kicker` | "Turf Battle rule" | [`js/strings.js:262`](js/strings.js#L262) | [`js/game.js:701`](js/game.js#L701) |
| `ruleCard.kickerNext` | "Next Turf Battle" | [`js/strings.js:263`](js/strings.js#L263) | [`js/game.js:701`](js/game.js#L701) |
| `ruleCard.spunBy` | *function (p)*: `` `Spun by ${mark(p)}` `` | [`js/strings.js:264`](js/strings.js#L264) | [`js/game.js:406`](js/game.js#L406) |
| `ruleCard.pickedBy` | *function (p)*: `` `Picked by ${mark(p)}` `` | [`js/strings.js:265`](js/strings.js#L265) | [`js/game.js:401`](js/game.js#L401)<br>[`js/game.js:1025`](js/game.js#L1025) |
| `ruleCard.rulePick` | "Rule pick" | [`js/strings.js:266`](js/strings.js#L266) | [`js/game.js:401`](js/game.js#L401) |

### 9. Fortune Wheel (`STRINGS.wheel`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `wheel.titleLabel` | "Wheel of Games!" | [`js/strings.js:273`](js/strings.js#L273) | [`index.html:130`](index.html#L130) |
| `wheel.titleSmall` | "Wheel of" | [`js/strings.js:274`](js/strings.js#L274) | [`index.html:130`](index.html#L130) |
| `wheel.titleBig` | "GAMES!" | [`js/strings.js:275`](js/strings.js#L275) | [`index.html:130`](index.html#L130) |
| `wheel.canvasLabel` | "Wheel of game types" | [`js/strings.js:276`](js/strings.js#L276) | [`index.html:133`](index.html#L133) |
| `wheel.spin` | "SPIN!" | [`js/strings.js:277`](js/strings.js#L277) | [`js/wheel.js:652`](js/wheel.js#L652)<br>[`index.html:135`](index.html#L135) |
| `wheel.spinning` | "?" | [`js/strings.js:278`](js/strings.js#L278) | [`js/wheel.js:667`](js/wheel.js#L667) |
| `wheel.who` | *function (p, cpu, sub)*: `` `${mark(p)} ${cpu ? '(computer) ' : ''}spins to pick the game type${sub ? ` ${sub}` : ''}` `` | [`js/strings.js:279`](js/strings.js#L279) | [`js/wheel.js:644`](js/wheel.js#L644) |
| `wheel.forSpace` | *function (cell, level)*: `` `for the ${cell} space of Round ${level}` `` | [`js/strings.js:280`](js/strings.js#L280) | [`js/game.js:405`](js/game.js#L405) |
| `wheel.computerSpins` | "The computer spins..." | [`js/strings.js:281`](js/strings.js#L281) | [`js/wheel.js:646`](js/wheel.js#L646) |
| `wheel.result` | *function (icon, name)*: `` `${icon} ${name.toUpperCase()}!` `` | [`js/strings.js:282`](js/strings.js#L282) | [`js/wheel.js:797`](js/wheel.js#L797) |

### 10. Slot machine / Mystery Jackpot (`STRINGS.slots`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `slots.titleLabel` | "Mystery Jackpot!" | [`js/strings.js:289`](js/strings.js#L289) | [`index.html:89`](index.html#L89) |
| `slots.titleSmall` | "Mystery" | [`js/strings.js:290`](js/strings.js#L290) | [`index.html:89`](index.html#L89) |
| `slots.titleBig` | "JACKPOT!" | [`js/strings.js:291`](js/strings.js#L291) | [`index.html:89`](index.html#L89) |
| `slots.howHead` | "🎲 How it plays" | [`js/strings.js:292`](js/strings.js#L292) | [`index.html:94`](index.html#L94) |
| `slots.howText` | "Line up <b>3, 4 or 5</b> of the same prize symbol on any payline, starting from the <b>leftmost reel</b>, t…" | [`js/strings.js:293`](js/strings.js#L293) | [`index.html:95`](index.html#L95) |
| `slots.linesHead` | "〰️ 9 Paylines" | [`js/strings.js:294`](js/strings.js#L294) | [`index.html:99`](index.html#L99) |
| `slots.linesText` | "A win counts on any of these lines, reading from the left." | [`js/strings.js:295`](js/strings.js#L295) | [`index.html:100`](index.html#L100) |
| `slots.close` | "Close" | [`js/strings.js:296`](js/strings.js#L296) | [`index.html:94`](index.html#L94)<br>[`index.html:99`](index.html#L99) |
| `slots.symbolsTab` | "🎲 Symbols" | [`js/strings.js:297`](js/strings.js#L297) | [`index.html:105`](index.html#L105) |
| `slots.paylinesTab` | "〰️ Paylines" | [`js/strings.js:298`](js/strings.js#L298) | [`index.html:107`](index.html#L107) |
| `slots.spin` | "SPIN THE REELS!" | [`js/strings.js:299`](js/strings.js#L299) | [`index.html:106`](index.html#L106) |
| `slots.who` | *function (p)*: `` `${mark(p)} found the mystery jackpot! Line up 3+ prize symbols from the left on any payline.` `` | [`js/strings.js:300`](js/strings.js#L300) | [`js/slots.js:152`](js/slots.js#L152) |
| `slots.computerSpins` | "The computer spins..." | [`js/strings.js:301`](js/strings.js#L301) | [`js/slots.js:155`](js/slots.js#L155) |
| `slots.symbols.extra` | "EXTRA TURN" | [`js/strings.js:303`](js/strings.js#L303) | [`js/slots.js:7`](js/slots.js#L7) |
| `slots.symbols.bomb` | "BOMB" | [`js/strings.js:303`](js/strings.js#L303) | [`js/slots.js:8`](js/slots.js#L8) |
| `slots.symbols.steal` | "STEAL" | [`js/strings.js:303`](js/strings.js#L303) | [`js/slots.js:9`](js/slots.js#L9) |
| `slots.symbols.shield` | "+1 MARK" | [`js/strings.js:303`](js/strings.js#L303) | [`js/slots.js:10`](js/slots.js#L10) |
| `slots.symbols.rule` | "RULE PICK" | [`js/strings.js:303`](js/strings.js#L303) | [`js/slots.js:11`](js/slots.js#L11) |
| `slots.symbols.jackpot` | "INSTANT WIN" | [`js/strings.js:303`](js/strings.js#L303) | [`js/slots.js:12`](js/slots.js#L12) |
| `slots.prizes.extra.name` | "EXTRA TURN" | [`js/strings.js:306`](js/strings.js#L306) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.extra.desc` | "Go again right now!" | [`js/strings.js:306`](js/strings.js#L306) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.steal.name` | "STEAL" | [`js/strings.js:307`](js/strings.js#L307) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.steal.desc` | "Flip one of your opponent's marks to yours." | [`js/strings.js:307`](js/strings.js#L307) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.bomb.name` | "BOMB" | [`js/strings.js:308`](js/strings.js#L308) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.bomb.desc` | "Blow up one opponent mark (or a stone space)." | [`js/strings.js:308`](js/strings.js#L308) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.shield.name` | "+1 MARK" | [`js/strings.js:309`](js/strings.js#L309) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.shield.desc` | "Keep 4 marks instead of 3 for the rest of this game." | [`js/strings.js:309`](js/strings.js#L309) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.rule.name` | "RULE PICK" | [`js/strings.js:310`](js/strings.js#L310) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.rule.desc` | "Choose the rule for the next Turf Battle." | [`js/strings.js:310`](js/strings.js#L310) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.jackpot.name` | "INSTANT WIN!" | [`js/strings.js:311`](js/strings.js#L311) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.jackpot.desc` | "" | [`js/strings.js:311`](js/strings.js#L311) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.bust.name` | "NO WIN" | [`js/strings.js:312`](js/strings.js#L312) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.prizes.bust.desc` | "No luck this time." | [`js/strings.js:312`](js/strings.js#L312) | [`js/slots.js:17`](js/slots.js#L17)<br>[`js/slots.js:134`](js/slots.js#L134)<br>[`js/slots.js:259`](js/slots.js#L259)<br>[`js/slots.js:263`](js/slots.js#L263)<br>[`js/slots.js:268`](js/slots.js#L268)<br>*read through `PRIZES` in slots.js* |
| `slots.jackpotTurf` | "You win this game on the spot!" | [`js/strings.js:314`](js/strings.js#L314) | [`js/slots.js:259`](js/slots.js#L259) |
| `slots.jackpotBig` | "Claim any empty space instantly!" | [`js/strings.js:315`](js/strings.js#L315) | [`js/slots.js:259`](js/slots.js#L259) |
| `slots.payJackpotTurf` | "Win this game" | [`js/strings.js:317`](js/strings.js#L317) | [`js/slots.js:134`](js/slots.js#L134) |
| `slots.payJackpotBig` | "Claim any space" | [`js/strings.js:318`](js/strings.js#L318) | [`js/slots.js:134`](js/slots.js#L134) |
| `slots.payRule` | "Pick the next game's rule" | [`js/strings.js:319`](js/strings.js#L319) | [`js/slots.js:134`](js/slots.js#L134) |
| `slots.ofAKind.3` | "THREE" | [`js/strings.js:321`](js/strings.js#L321) | [`js/slots.js:262`](js/slots.js#L262)<br>*looked up from `STRINGS.slots.ofAKind`* |
| `slots.ofAKind.4` | "FOUR" | [`js/strings.js:321`](js/strings.js#L321) | [`js/slots.js:262`](js/slots.js#L262)<br>*looked up from `STRINGS.slots.ofAKind`* |
| `slots.ofAKind.5` | "FIVE" | [`js/strings.js:321`](js/strings.js#L321) | [`js/slots.js:262`](js/slots.js#L262)<br>*looked up from `STRINGS.slots.ofAKind`* |
| `slots.winLine` | *function (kind, line, more, desc)*: `` `${kind} of a kind on the <b>${line}</b> line${more ? ` (+${more} more ${plural(more, 'line', 'lines')})` :… `` | [`js/strings.js:322`](js/strings.js#L322) | [`js/slots.js:263`](js/slots.js#L263) |
| `slots.paylines` | *list*: `` ["Middle","Top","Bottom","V","Peak","Zig-zag","Zag-zig","Step down","Step up"] `` | [`js/strings.js:323`](js/strings.js#L323) | [`js/slots.js:25`](js/slots.js#L25)<br>[`js/slots.js:26`](js/slots.js#L26)<br>[`js/slots.js:27`](js/slots.js#L27)<br>[`js/slots.js:28`](js/slots.js#L28)<br>[`js/slots.js:29`](js/slots.js#L29)<br>[`js/slots.js:30`](js/slots.js#L30)<br>…and 3 more (search the name) |
| `slots.teaseReel1` | "<span class="tease-txt">🎆 INSTANT WIN on reel 1...</span>" | [`js/strings.js:325`](js/strings.js#L325) | [`js/slots.js:209`](js/slots.js#L209) |
| `slots.oneMore` | "<span class="tease-txt">🎆🎆 ONE MORE FOR AN INSTANT WIN...</span>" | [`js/strings.js:326`](js/strings.js#L326) | [`js/slots.js:238`](js/slots.js#L238) |
| `slots.streak` | *function (n)*: `` `<span class="tease-txt">🎆 ${'🎆'.repeat(n - 1)} ${n} IN A ROW${n >= 3 ? '... INSTANT WIN!' : '...'}</span>` `` | [`js/strings.js:327`](js/strings.js#L327) | [`js/slots.js:356`](js/slots.js#L356) |
| `slots.streakPop.2` | "x2!" | [`js/strings.js:328`](js/strings.js#L328) | [`js/slots.js:335`](js/slots.js#L335)<br>[`js/slots.js:343`](js/slots.js#L343) |
| `slots.streakPop.3` | "INSTANT WIN!" | [`js/strings.js:328`](js/strings.js#L328) | [`js/slots.js:335`](js/slots.js#L335)<br>[`js/slots.js:343`](js/slots.js#L343) |
| `slots.streakPop.4` | "MEGA WIN!!" | [`js/strings.js:328`](js/strings.js#L328) | [`js/slots.js:335`](js/slots.js#L335)<br>[`js/slots.js:343`](js/slots.js#L343) |
| `slots.streakPop.5` | "ULTRA WIN!!!" | [`js/strings.js:328`](js/strings.js#L328) | [`js/slots.js:335`](js/slots.js#L335)<br>[`js/slots.js:343`](js/slots.js#L343) |
| `slots.banner` | "INSTANT WIN!" | [`js/strings.js:329`](js/strings.js#L329) | [`js/slots.js:366`](js/slots.js#L366) |

### 11. RULE PICK (`STRINGS.rulePick`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `rulePick.title` | "🎲 RULE PICK 🎲" | [`js/strings.js:336`](js/strings.js#L336) | [`index.html:143`](index.html#L143) |
| `rulePick.who` | *function (p, cpu)*: `` `${mark(p)} ${cpu ? '(computer) ' : ''}chooses the rule for the next Turf Battle` `` | [`js/strings.js:279`](js/strings.js#L279) | [`js/slots.js:529`](js/slots.js#L529) |
| `rulePick.playingNow` | "playing now" | [`js/strings.js:338`](js/strings.js#L338) | [`js/slots.js:534`](js/slots.js#L534) |
| `rulePick.clickHint` | "Click a card to choose" | [`js/strings.js:339`](js/strings.js#L339) | [`js/slots.js:613`](js/slots.js#L613) |
| `rulePick.cpuHint` | "The computer is choosing..." | [`js/strings.js:340`](js/strings.js#L340) | [`js/slots.js:600`](js/slots.js#L600) |
| `rulePick.chosen` | *function (icon, name)*: `` `${icon} <b>${name}</b> it is!` `` | [`js/strings.js:341`](js/strings.js#L341) | [`js/slots.js:549`](js/slots.js#L549) |

### 12. Game review and Instant Replay (`STRINGS.review`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `review.title` | "🎬 Game review" | [`js/strings.js:143`](js/strings.js#L143) | [`index.html:70`](index.html#L70) |
| `review.hint` | "Pick any earlier Round or Turf Battle. Instant Replay plays the game from that moment and keeps going until…" | [`js/strings.js:157`](js/strings.js#L157) | [`index.html:71`](index.html#L71) |
| `review.close` | "Close" | [`js/strings.js:158`](js/strings.js#L158) | [`index.html:73`](index.html#L73) |
| `review.empty` | "No games yet. Play a Turf Battle first!" | [`js/strings.js:351`](js/strings.js#L351) | [`js/game.js:1408`](js/game.js#L1408) |
| `review.replayButton` | "▶ Instant Replay" | [`js/strings.js:352`](js/strings.js#L352) | [`js/game.js:1406`](js/game.js#L1406) |
| `review.wonBy` | *function (p)*: `` `won by ${mark(p)}` `` | [`js/strings.js:353`](js/strings.js#L353) | [`js/game.js:1404`](js/game.js#L1404) |
| `review.inProgress` | "<i>in progress</i>" | [`js/strings.js:354`](js/strings.js#L354) | [`js/game.js:1404`](js/game.js#L1404) |
| `review.openingTurf` | "Opening Turf Battle" | [`js/strings.js:355`](js/strings.js#L355) | [`js/game.js:1265`](js/game.js#L1265) |
| `review.turfFor` | *function (cell, level)*: `` `Turf Battle for the ${cell} space of Round ${level}` `` | [`js/strings.js:356`](js/strings.js#L356) | [`js/game.js:1265`](js/game.js#L1265) |
| `review.live` | "● INSTANT REPLAY" | [`js/strings.js:358`](js/strings.js#L358) | [`index.html:59`](index.html#L59) |
| `review.pause` | "⏸ Pause" | [`js/strings.js:359`](js/strings.js#L359) | [`js/game.js:1393`](js/game.js#L1393)<br>[`index.html:62`](index.html#L62) |
| `review.play` | "▶ Play" | [`js/strings.js:360`](js/strings.js#L360) | [`js/game.js:1393`](js/game.js#L1393) |
| `review.speedTitle` | "Replay speed" | [`js/strings.js:361`](js/strings.js#L361) | [`index.html:63`](index.html#L63) |
| `review.speed` | *function (n)*: `` `${n}×` `` | [`js/strings.js:362`](js/strings.js#L362) | [`js/game.js:1394`](js/game.js#L1394) |
| `review.stop` | "⏹ Stop" | [`js/strings.js:363`](js/strings.js#L363) | [`index.html:64`](index.html#L64) |

### 13. Icon labels (`STRINGS.icons`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `icons.wild` | "shape-shifting mark" | [`js/strings.js:370`](js/strings.js#L370) | [`js/render.js:53`](js/render.js#L53) |
| `icons.fog` | "fog" | [`js/strings.js:371`](js/strings.js#L371) | [`js/render.js:94`](js/render.js#L94) |
| `icons.cross` | "crossfire" | [`js/strings.js:372`](js/strings.js#L372) | [`js/render.js:70`](js/render.js#L70) |

### 14. Mini-map (`STRINGS.minimap`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `minimap.earlier` | "EARLIER ROUNDS" | [`js/strings.js:379`](js/strings.js#L379) | [`js/minimap.js:58`](js/minimap.js#L58) |
| `minimap.more` | *function (n)*: `` `+${n} more` `` | [`js/strings.js:380`](js/strings.js#L380) | [`js/minimap.js:65`](js/minimap.js#L65) |

### 15. Developer Mode (`STRINGS.dev`)

| String | Text | Defined at | Used at |
|---|---|---|---|
| `dev.head` | "🛠 Developer Mode" | [`js/strings.js:387`](js/strings.js#L387) | [`index.html:114`](index.html#L114) |
| `dev.closeTitle` | "Turn off Developer Mode (Shift+D)" | [`js/strings.js:388`](js/strings.js#L388) | [`index.html:114`](index.html#L114) |
| `dev.slotResult` | "Slot result" | [`js/strings.js:389`](js/strings.js#L389) | [`index.html:115`](index.html#L115) |
| `dev.tease` | "Tease 🎆 on reel 1 (wind-up)" | [`js/strings.js:390`](js/strings.js#L390) | [`index.html:116`](index.html#L116) |
| `dev.spinJackpot` | "🎰 Spin the jackpot now" | [`js/strings.js:391`](js/strings.js#L391) | [`index.html:117`](index.html#L117) |
| `dev.everywhere` | "Jackpot under every square" | [`js/strings.js:392`](js/strings.js#L392) | [`index.html:118`](index.html#L118) |
| `dev.reveal` | "Show the jackpot square" | [`js/strings.js:393`](js/strings.js#L393) | [`index.html:119`](index.html#L119) |
| `dev.wheelResult` | "Wheel result" | [`js/strings.js:394`](js/strings.js#L394) | [`index.html:120`](index.html#L120) |
| `dev.spinWheel` | "🎡 Spin the wheel now" | [`js/strings.js:395`](js/strings.js#L395) | [`index.html:122`](index.html#L122) |
| `dev.nearMiss` | "Near miss: the flapper stops bent on a peg" | [`js/strings.js:396`](js/strings.js#L396) | [`index.html:121`](index.html#L121) |
| `dev.hint` | "Shift+D or ?dev in the address turns it on. Tap the title to fold it." | [`js/strings.js:397`](js/strings.js#L397) | [`index.html:123`](index.html#L123) |
| `dev.forceOptions` | *list*: `` [["","🎲 Random (normal odds)"],["extra","⚡ Extra turn"],["bomb","💣 Bomb"],["st `` | [`js/strings.js:398`](js/strings.js#L398) | [`js/game.js:950`](js/game.js#L950) |
| `dev.wheelRandom` | "🎡 Random" | [`js/strings.js:400`](js/strings.js#L400) | [`js/game.js:951`](js/game.js#L951) |
| `dev.on` | "🛠 Developer Mode on (Shift+D to hide)" | [`js/strings.js:401`](js/strings.js#L401) | [`js/game.js:937`](js/game.js#L937) |
| `dev.off` | "Developer Mode off" | [`js/strings.js:402`](js/strings.js#L402) | [`js/game.js:937`](js/game.js#L937) |
| `dev.wait` | "Wait for the current animation to finish, then spin." | [`js/strings.js:403`](js/strings.js#L403) | [`js/game.js:891`](js/game.js#L891)<br>[`js/game.js:910`](js/game.js#L910) |
| `dev.noLiveGame` | "No live game to spin on right now." | [`js/strings.js:404`](js/strings.js#L404) | [`js/game.js:892`](js/game.js#L892) |
| `dev.previewSub` | "(Developer Mode preview)" | [`js/strings.js:405`](js/strings.js#L405) | [`js/game.js:923`](js/game.js#L923) |
| `dev.wheelPreview` | *function (icon, name)*: `` `🛠 The wheel landed on ${icon} <b>${name}</b> (preview only: no Turf Battle is running).` `` | [`js/strings.js:406`](js/strings.js#L406) | [`js/game.js:924`](js/game.js#L924) |
