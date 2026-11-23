# Worklog: 3D cutscenes, menu, scarier ghost, asset pipeline (delete before release)

State found: project already has Narrator (speech), menu-narr, favicon, relicChase, lamp switch, richer ghost (neck, wisps, tear texture).
Old 2D story = StoryIntro in src/story/story.js + cinematic.js + cinematic-scenes.js + #story-modal.

Order
1. [ ] Menu: markup, css, MenuScene 3D backdrop (src/ui/menu.js)
2. [ ] puppets.js, cinema.js (kit, ctx, player), cine-scenes.js
3. [ ] Game flow: menu -> opening -> Begin -> play. Room flashbacks (first entry, deferred rules, trap after)
4. [ ] Remove old story (StoryIntro, cinematic*.js, #story-modal css). Remove duplicate narrator room lines
5. [ ] Ghost: neck, arms, fingers, tatters, red rim, halos, tears, flashlight presence, 3.5 m lunge death
6. [ ] lib/GLTFLoader.js, src/world/assets.js, tools/build-asset-manifest.js, dressing w/ flood fill, assets/models/README.md
7. [ ] Tests (Cinema.seek), README, perf check, layout-test

Decisions
- Cutscenes and menu render through the main renderer: animate() swaps scene+camera. No second WebGL context.
- Cinema has its own DOM layer (#cine-layer): letterbox, captions, chapter card, skip, Begin.
- Tests that touch __game.intro must be updated (story-test.js, rules-test.js log line, cine-shot.js).
