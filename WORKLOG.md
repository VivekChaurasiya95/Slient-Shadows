# Worklog (delete before release)

## Expansion: Hinglish, electricity, weapons, missions (Nov 2026)

### M1 audit: what already exists
- Flow: `HorrorGame` constructor builds systems, `newRun(null)` generates the seeded layout, `warmup()` compiles every room's shader variant. Menu (`MenuScene` + `#start-menu`) -> `cinema.play('opening')` -> Begin -> `beginPlaying()` -> `story.start()`.
- Interaction: `InteractionSystem` raycasts from screen centre against `room.interactables` meshes. `Interactable` / `Openable` own prompt functions (called every frame) and `onInteract` / `onUse`.
- Rooms: `World.build(layout)` calls `build_<room>`, then doors, spots, hides, decor, nav. Only the current room's group is visible. Light counts differ per room, so lights must never be added or toggled at runtime; intensity only.
- Lighting: `World.addLight` (+ `room.flickers`, driven by `Atmosphere.update`: flicker / lightsOut / redAlert). Cellar fuse box + emergency lamp in `setupExtras`. A one-off bedroom switch from my earlier session.
- Items: `ITEM_DEFS`, `ItemFactory.create/icon`, `Inventory` (6 slots, notes separate), `WorldItem.pickUp`, `makeSpotItem`. Layout items come from `WORLD_DATA.generateLayout`, solvability from `validate`.
- Ghost: state machine in ghost-ai.js. `stun(sec)`, `repel(sec)`, `hear(noise)` via `game.makeNoise`. Flashlight stun with resistance (`CONFIG.beam`).
- Words: STORY.lines (32 ids) shown by `HUD.say` / `nextRadio`; only NARRATOR lines spoken (Web Speech, English voices only, no `u.lang`). Cutscene captions in `cine-scenes.js` (fixed time windows), shown by `Cinema.updateOverlay`. About 250 more strings in toasts, prompts, notes, HTML.
- Tests: layout-test 500/500, rules-test 15/15, systems all pass at `9821af7`. story-test / radio-shot / cine-shot reference the removed 2D intro (stale before this work).

### Decisions
- i18n is gettext-style: the English source string is the key (`T('Take {item}', {item})`). English needs no table and never breaks; `hi.js` maps English to Hinglish. HUD sinks (toast, alert, prompt, objective, subtitle, hide cue) translate at display time, so a language switch updates everything live without restarting.
- Spoken Hindi uses a Devanagari copy of each spoken line when a hi-IN voice exists (it sounds natural); otherwise the Roman Hinglish line is read by an en-IN / English voice. Subtitles always show Roman Hinglish.
- Notes store a template + params (`tpl`) so they can be re-rendered in either language. English output is byte-identical to before.
- Electricity: one PowerGrid. Every room gets a fixture (bulb, holder, cord, one PointLight created at build time, intensity-driven) and a wall switch. Circuits: bedroom on the old line (works from the start), main circuit needs the cellar fuse, kitchen has damaged wiring (repair at the junction inside the maintenance locker), nursery breaker is tripped (reset at the fuse box), library bulb has a loose filament.
- Weapons are inventory items (kind `weapon`). Viewmodel drawn in a second depth-cleared pass so it never clips into walls. Flare and muzzle flash lights are preallocated (no shader recompiles). No weapon can kill the ghost: stun, repel, or disorient only, with diminishing returns.
- Missions are derived from real game state each frame (fuse installed, locker open, clues found, safe open, gate unlocked, offerings placed, ritual done, survived, relic held). Chain: fuse -> power (library safe bolt is electric) ; crowbar -> locker (clue 3 + kitchen junction) ; 3 clues + power -> safe -> crypt key ; offerings + symbol order -> ritual -> survive -> skull -> escape.
- Layout: crypt is always the last lock; the crypt key lives in the library safe; the relic always rests in the crypt; fuse and cellar key are never in the crypt. validate() simulates the new gates.

### Milestones
- [x] M2 i18n core, en/hi tables, menu + options + pause language selectors, persistence, narration voices
- [x] M3 PowerGrid, fixtures and switches in all 8 rooms, fuse/breaker/junction, horror events, ghost light reactions
- [x] M4 weapons: defs, models, viewmodel, combat, ammo, difficulty tuning, ghost hit reactions
- [x] M5 missions, puzzles (safe dials, locker, altar offerings + symbol order), journal, objective HUD
- [x] M6 audio SFX, HUD polish, story lines for the new events
- [x] M7 tests: layout, rules, systems, smoke, new i18n-test + features-test; perf check

### Results (final run)
- layout-test 500/500 solvable, deterministic. i18n-test: 538 keys, 0 missing, 0 placeholder mismatches, 83 spoken lines all with Devanagari.
- rules-test 15/15 (run it alone: in parallel with systems.js the pause modal check can miss its frame).
- systems.js: every solve seed opens 3 locks and the exit, 39 spots. smoke, play, cine-test clean.
- features-test 31/31, no console errors. view-shot.js captures each weapon and a lit / unlit room.
- Still stale from before this work: story-test, radio-shot, cine-shot (they drive the removed #story-modal).

### Later
- Diegetic writing baked into textures (wall scrawls, the library page and nursery letter in cutscenes) stays English on purpose.
- Weapons have no hand/arm mesh; the viewmodel is the weapon alone.
- Headless Edge here only has en-IN voices, so the Devanagari speech path is unit-checked, not heard. On Windows, add "Hindi" in Settings > Time & language > Speech to get Microsoft Hemant / Kalpana / Swara.

## Voice acting system (natural female voice)
- Studio clips are generated offline by `tools/voice-gen.js` (ElevenLabs primary, Azure secondary). Keys live in `.env` (git-ignored) and are read only by that script. The game plays static files from `assets/voice/` (`manifest.json` + mp3s); the shipped manifest is empty.
- `src/audio/voice-script.js`: shared clip keys (`<lang>/<WHO>/<fnv(English source)>`), styles (narration, normal, whisper, fear, suspense, urgency, distress, warning) with per-style pauses and close-mic warmth, speaker fallbacks. Hindi clips are synthesized from the Devanagari copy; subtitles stay Roman Hinglish.
- `src/audio/voice.js` (`Voice`): one queue, no overlap, subtitles shown when the voice starts, game-time gaps (freeze on pause), interruption and restart safe, cutscene lines fitted (≤10% speed-up, stale lines dropped), room reverb send, distant voices panned and softened. No pitch effects.
- Audio buses: narration, characters, effects/ambience, each with its own Options slider (saved).
- Missing clip: browser voice or text only (Options). Always visible: console warning with the fix command, one-time toast, status line.
- New female lines: narrator A01–A03 (dangerous rooms, ghost near, first hunt), Elspeth E01–E04 (distant whispers, hiding).
- Debug panel: "Voice" group plays one line per style.
- Setup, tuning, licensing and the listening checklist: `voice/README.md`.
### Results
- voice-gen-test 24/24 (against a mock ElevenLabs/Azure server). voice-test 27/27 (in-game, fake tone pack built by the real generator). i18n 555 keys, 0 missing. layout, rules 15/15, systems, smoke (no errors), features 31/31.
- A8 note: Chromium only advances gain automation on a bus that is being rendered, so the volume test keeps a line playing while it measures.
### Not done (needs a key and ears)
- No real voice has been generated or heard. Voice ids in `voice/voice-config.json` are empty.
- Audio tags other than `[whispers]` / `[worried]` are unverified; the Azure path is untested against the live service.
