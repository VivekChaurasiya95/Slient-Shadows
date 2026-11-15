# Upgrade plan (work in progress)

Load order: core, world-data, audio, items, interact, textures, world, doors, spots, hiding, rooms, decor, ghost, jumpscares, director, hud, game

Done and syntax checked: core.js, world-data.js (500 seeds solvable, tools/layout-test.js), audio.js, items.js, interact.js,
doors.js, textures.js, world.js, spots.js, hiding.js (builders + HideSpot), rooms.js, decor.js

TODO
- hiding.js part 2: Hiding controller (enter/leave, slit view, breath, noise, ghost checks)
- ghost.js: model, AI (patrol/suspicious/hunt/search/stunned/repelled), nav, hearing, LOS
- jumpscares.js: death, peek, mirror, corridor, ceiling, fake-out, relic cinematic, exit scare, house-awakens
- director.js: fear, tension stages, scare director, lightning, bat swarm, effects
- hud.js, game.js, index.html, style.css
- debug panel, README, changelog, Playwright smoke tests
