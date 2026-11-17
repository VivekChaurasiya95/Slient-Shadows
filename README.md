# Silent Shadows: The Samhain Extraction

A first-person stealth horror game that runs in the browser with no build step. Plain HTML, CSS and JavaScript plus the bundled `lib/three.min.js` (three.js r128). Every texture, model and sound is generated in code.

## Run it

Serve the folder with any static server and open `index.html`:

```
npx http-server -p 8080
```

The microphone and bodycam are optional. The game runs without either permission. Click the page to capture the mouse.

## Story

Every play starts with the story sequence (the Hollow family, the 1898 ritual, the job, and Dacre's opening radio call). The **first time** it plays it cannot be skipped. Once you have watched it to the end it is remembered in `localStorage` (key `silentshadows.storySeen.v1`) and later plays show a **Skip story** button (Escape also skips). Clear that key to see the unskippable version again.

In game, Dacre (radio) and Rowan (thought lines) comment on events. The in-game clock starts at 11:14 PM and runs two game minutes per real minute. A bell tolls at midnight.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move. Shift sprints (loud, about 5 seconds of stamina). C crouches (silent) |
| E | Interact. Tap a door to open it fast and loud, hold it to open slowly and quietly. Hold E to search |
| 1 to 6 | Select an item. R uses it, Q drops it, Shift+Q throws it |
| Tab or I | Inventory, notes and map |
| F | Flashlight (battery drains faster when the ghost is near) |
| Space | Hold your breath while hidden (limited, and shorter the more afraid you are) |
| Esc or alt-tab | Pause. Nothing simulates until the mouse is back |
| Backtick | Debug panel |

## Project layout

```
index.html            page markup and script load order
css/style.css         all styling
lib/three.min.js      three.js r128 (bundled)
assets/images/        image files (only room_corridor.jpg is used, for the menu and story)
src/
  game.js             HorrorGame: renderer, camera, input, main loop, run lifecycle
  core/core.js        config and difficulty, seeded RNG, easing and tweens, helpers
  data/world-data.js  room, door, spot and hiding registries, seeded layout generator
  audio/audio.js      procedural audio engine (ambience, spatial sfx, reverb)
  world/              world.js (rooms, nav grid), rooms.js, decor.js, textures.js, doors.js, spots.js
  gameplay/           interact.js, items.js, hiding.js, ghost.js, ghost-ai.js, jumpscares.js, director.js
  story/              story.js (intro and radio lines), cinematic.js, cinematic-scenes.js
  ui/                 hud.js, debug.js
tools/                layout test and Playwright test scripts
```

Scripts are plain `<script>` tags, so the order in `index.html` matters: core, data, audio, gameplay (interact, items), world (textures, world, doors, spots), hiding, rooms, decor, ghost, jumpscares, director, story, ui, then `game.js` last.
## The rules of the night

- **Deadline.** The clock runs from 11:14 PM. Midnight comes after 15 minutes of play and dawn (6:00 AM) after 40. If you are still inside at dawn, the night ends ("Nothing was settled"). Both times live in `CONFIG.night`.
- **Midnight changes the rules.** Safe rooms stop being safe, the cellar lamp dies, the ghost moves faster and hears further, the battery drains 40% faster, and about once a minute she turns toward wherever you are (hiding unseen still protects you).
- **Sprinting costs stamina.** About 5 seconds, then you are winded: you walk, you gasp (a noise), and you wait for it to refill.
- **Chases get faster.** After 30 seconds of hunting the ghost is 50% faster. Sprinting buys distance, not escape.
- **The flashlight is not free.** Each stun burns 12% battery, the ghost builds resistance (shorter stuns, down to half a second), and below 12% the beam cannot stun at all. Resistance fades slowly.
- **Fear bends the rules.** Past 55% fear your breath hold drains up to 2.3 times faster, the noise meter starts lying (false alarms, and hiding real noise; the ghost still hears the truth), and doors creak open with nobody there.
- **Pause.** Esc, alt-tab or switching tabs freezes the ghost, the clock, tweens and audio.

All of these numbers are in `CONFIG` at the top of `src/core/core.js`.
## Seeds

Every run builds from a seed (shown in the start menu and on the end screen). The same seed gives the same layout. Leave the field empty for a random seed. Ghost spawn, patrol choices, scare timing and hiding checks are seeded too (event decisions and per-frame chances use two separate streams), so the same seed gives the same night for the same inputs. Exact timing still depends on what you do and your frame rate, and purely visual flicker is not seeded. The seed decides which key opens which lock, where every item and note is, which hiding spots exist (and which one is a trap), each room's role (honest, decoy, trap, safe) and what the trap rooms do. **Play again** and **Retry** rebuild the world in place, never reload the page, and never put the skull in the same spot twice in a row. `node tools/layout-test.js` checks 500 seeds for solvability.

## Tuning difficulty

Edit `CONFIG.difficulties` at the top of `core.js` (ghost walk and hunt speed, hearing, sight range, aggression, fear gain, scare rate, stun time, peek lethality, battery drain). Stage timing is `CONFIG.stageSeconds`, noise loudness is `CONFIG.loudness`.

## Tests

With Playwright installed in `%TEMP%\pwtest`: `node tools/smoke.js`, `node tools/play.js`, `node tools/systems.js`, `node tools/story-test.js`, `node tools/hide-debug.js`, `node tools/rules-test.js`.

## License

Apache License 2.0, see `LICENSE`. All art, music and text in the game are original.
