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
| W A S D | Move. Shift sprints (loud). C crouches (silent) |
| E | Interact. Tap a door to open it fast and loud, hold it to open slowly and quietly. Hold E to search |
| 1 to 6 | Select an item. R uses it, Q drops it, Shift+Q throws it |
| Tab or I | Inventory, notes and map |
| F | Flashlight (battery drains faster when the ghost is near) |
| Space | Hold your breath while hidden (stamina limited) |
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
## Seeds

Every run builds from a seed (shown in the start menu and on the end screen). The same seed gives the same layout. Leave the field empty for a random seed. The seed decides which key opens which lock, where every item and note is, which hiding spots exist (and which one is a trap), each room's role (honest, decoy, trap, safe) and what the trap rooms do. **Play again** and **Retry** rebuild the world in place, never reload the page, and never put the skull in the same spot twice in a row. `node tools/layout-test.js` checks 500 seeds for solvability.

## Tuning difficulty

Edit `CONFIG.difficulties` at the top of `core.js` (ghost walk and hunt speed, hearing, sight range, aggression, fear gain, scare rate, stun time, peek lethality, battery drain). Stage timing is `CONFIG.stageSeconds`, noise loudness is `CONFIG.loudness`.

## Tests

With Playwright installed in `%TEMP%\pwtest`: `node tools/smoke.js`, `node tools/play.js`, `node tools/systems.js`, `node tools/story-test.js`, `node tools/hide-debug.js`.

## License

Apache License 2.0, see `LICENSE`. All art, music and text in the game are original.
