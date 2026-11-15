# ember-reef-game-v2

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Hamdansyahrin/ember-reef-game-v2/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Hamdansyahrin/ember-reef-game-v2/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Ember Reef — you are the Lantern Keeper of a bioluminescent reef: catch falling ember shards in your lantern, chain catches into a combo, bank it before a miss wipes it out, ride the tides from Calm to Surge to Flood, and light all 7 beacons to win.

## How to play

- Move the Keeper with ← → / A D or the mouse.
- Catch ember shards in the lantern. Consecutive catches grow the combo multiplier (up to x8); a miss resets it and breaks your beacon chain.
- **B** (or the BANK button) banks your combo: the multiplier turns into permanent light plus a score bonus, and the multiplier restarts at x1. Hold for a bigger payout, or bank before a fast shard ends the streak.
- **SPACE** / click fires a Flare for exactly 10 light: it pulls shards toward the lantern. Shards caught inside a flare feed score only, never light.
- Beacons light as your score passes 150, 350, 600, 900, 1250, 1650, 2100. Lighting beacons in a row without a miss builds the Beacon Chain bonus. Light all 7 to win.
- The tide cycles Calm → Surge → Flood: faster falls, more frequent spawns, richer shards — and a higher waterline.
- Your light drains slowly and each miss costs 4 light. If it reaches zero, the reef goes dark and the run ends.
- **P** pauses, **M** mutes, **ENTER** starts and restarts. Best score is saved locally.

## Run it

```sh
python3 -m http.server 8080 --directory game
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — every file the game loads lives under `game/`.

## Screenshots

The four screenshots under `screenshots/` are real renders of the game's own code, staged deterministically with `?shot=` (`start`, `play`, `action`, `end`) and a seeded RNG (`?seed=`).

## Layout

- `game/index.html` — the page and canvas shell
- `game/src/game.js` — world state, loop, rules, input, screenshot staging
- `game/src/render.js` — all canvas drawing: reef, keeper, shards, HUD, screens
- `game/src/tides.js` — Tide Phases (Calm / Surge / Flood)
- `game/src/beacons.js` — the 7 beacons and the Beacon Chain bonus
- `game/src/combo.js` — combo multiplier and Combo Banking
- `game/src/particles.js` — sparks, rings, bubbles, motes, floating text
- `game/src/audio.js` — WebAudio synth sounds (no audio files)
- `game/src/rng.js` — seeded RNG (mulberry32)
- `main.ts` — the entry program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=748tdgv2&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
