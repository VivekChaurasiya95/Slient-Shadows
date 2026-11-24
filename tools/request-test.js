// Regression test for: story shown once, skip goes straight back to the game (no pause menu),
// narration off by default (text only), one ghost that never appears out of nowhere, and the
// sharper renderer / quality setting.
// Run: node tools/request-test.js        (needs playwright in %TEMP%\pwtest)
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8784);

(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 620 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  let pass = 0, fail = 0;
  const T = async (name, fn, arg) => {
    try { const r = await page.evaluate(fn, arg); const ok = r && r.ok !== false; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(56), JSON.stringify(r).slice(0, 360)); ok ? pass++ : fail++; return r; }
    catch (e) { fail++; console.log('FAIL ' + name.padEnd(56), 'THREW', e.message.slice(0, 400)); }
  };
  const sim = 'window.sim = (sec, dt) => { dt = dt || 0.05; for (let t = 0; t < sec; t += dt) __game.step(dt); };';

  // a first-time player: nothing stored
  await page.goto('http://localhost:8784/'); await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(3500);
  await page.evaluate(sim);

  // ---------------- narration off ----------------
  await T('N1 spoken narration is off by default (text only)', () => {
    const g = __game, m = document.getElementById('menu-narr'), p = document.getElementById('pause-narr');
    return { ok: g.access.narration === false && !m.checked && !p.checked && Voice.enabled === false, access: g.access.narration, menu: m.checked, pause: p.checked, voice: Voice.enabled };
  });

  // ---------------- the opening, first time only ----------------
  await page.click('#btn-play-game'); await page.waitForTimeout(1500);
  await T('S1 first time: the opening story plays (not skippable)', () => ({ ok: __game.cinema.active && __game.cinema.opts.skippable === false, cine: __game.cinema.active }));
  await T('N2 the story captions are shown but never spoken', () => new Promise(res => {
    const before = { studio: Voice.stats.studio, browser: Voice.stats.browser };
    let spoke = 0; const orig = Narrator.speak; Narrator.speak = function () { spoke++; return orig.apply(Narrator, arguments); };
    setTimeout(() => { Narrator.speak = orig; const cap = document.querySelector('#cine-caption .txt').textContent;
      res({ ok: spoke === 0 && Voice.stats.studio === before.studio && Voice.stats.browser === before.browser && cap.length > 0, spoke, cap: cap.slice(0, 50) }); }, 6000);
  }));
  await page.evaluate(() => { __game.cinema.finish(true); });
  await page.waitForTimeout(600);
  await T('S2 finishing it marks the opening as seen', () => ({ ok: StoryFlag.seen() && __game.isPlaying, seen: StoryFlag.seen(), playing: __game.isPlaying }));

  // ---------------- a room story: once, and Esc-skip does not open the pause menu ----------------
  await page.evaluate(() => { const g = __game; g.god = true; g.ghost.aiEnabled = false; g.ghost.state = 'DORMANT'; g.ghost.dormantT = 999; g.hud.clearRadio(); g.tweens.cancelAll(); });
  await page.mouse.click(550, 310); await page.waitForTimeout(600);
  const locked = await page.evaluate(() => !!document.pointerLockElement);
  console.log('     pointer lock held before the story: ' + locked);
  await page.evaluate(() => { __game.debug.teleport('parlor'); });
  await page.waitForTimeout(1500);
  await T('S3 entering a room for the first time plays its story', () => ({ ok: __game.cinema.active && RoomStoryFlag.seen('parlor'), cine: __game.cinema.active, seen: RoomStoryFlag.seen('parlor') }));
  // Esc: the browser drops the mouse (headless does not do this by itself, so do it first), and the cutscene skips
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1400);
  await T('S4 skipping with Esc returns to the game, never the pause menu', () => {
    const g = __game, modal = document.getElementById('pause-modal'), hint = document.getElementById('click-resume');
    const modalUp = modal.classList.contains('visible') || modal.style.display === 'flex';
    return { ok: !g.cinema.active && !modalUp && (g.isLocked ? !g.paused : (g.clickHold && hint.classList.contains('on'))), cine: g.cinema.active, modalUp, paused: g.paused, hold: !!g.clickHold, locked: g.isLocked, hint: hint.textContent };
  });
  // the same, when the browser insists on a click before it gives the mouse back
  await page.evaluate(() => { const g = __game; window.__rpl = g.container.requestPointerLock; g.container.requestPointerLock = () => {}; g.debug.teleport('library'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1400);
  await T('S4b browser wants a click first: small hint, still no pause menu', () => {
    const g = __game, modal = document.getElementById('pause-modal'), hint = document.getElementById('click-resume');
    const modalUp = modal.classList.contains('visible') || modal.style.display === 'flex';
    return { ok: !g.cinema.active && !modalUp && g.clickHold && g.paused && hint.classList.contains('on') && hint.textContent === 'Click to continue', modalUp, paused: g.paused, hold: !!g.clickHold, hint: hint.textContent };
  });
  await T('S5 while waiting for the click, nothing moves', () => { const g = __game, c = g.clockT; sim(2); return { ok: g.clickHold && g.clockT === c, frozen: g.clockT === c, hold: !!g.clickHold }; });
  await page.evaluate(() => { __game.container.requestPointerLock = window.__rpl; });
  await page.mouse.click(550, 310); await page.waitForTimeout(700);
  await T('S6 one click and you are playing again', () => { const g = __game, hint = document.getElementById('click-resume'); return { ok: !g.paused && !g.clickHold && !hint.classList.contains('on') && !!document.pointerLockElement, paused: g.paused, locked: !!document.pointerLockElement }; });
  await T('S7 the same room on a new run: no story again', () => {
    const g = __game; g.testMode = true; g.restart(false); g.isPlaying = true; g.testCutscenes = true; g.debug.teleport('corridor'); g.debug.teleport('parlor');
    const pending = g.pendingCut; g.testCutscenes = false;
    return { ok: !pending && RoomStoryFlag.seen('parlor'), pending: pending && pending.id };
  });
  await T('S8 a room never seen still gets its story once', () => {
    const g = __game; g.testCutscenes = true; g.debug.teleport('corridor'); g.debug.teleport('kitchen'); const p = g.pendingCut; g.pendingCut = null; g.testCutscenes = false;
    return { ok: !!p && p.id === 'kitchen', pending: p && p.id };
  });
  await page.reload(); await page.waitForTimeout(3500); await page.evaluate(sim);
  await page.click('#btn-play-game'); await page.waitForTimeout(1200);
  await T('S9 after a reload, Play goes straight into the house (no story)', () => ({ ok: !__game.cinema.active && __game.isPlaying, cine: __game.cinema.active, playing: __game.isPlaying }));

  // ---------------- one ghost ----------------
  // the real-time loop keeps running between checks: keep the scare scheduler out of these ghost checks
  await page.evaluate(() => { const g = __game; g.testMode = true; g.god = true; g.ghost.aiEnabled = false; g.hud.clearRadio(); g.tweens.cancelAll(); g.story.started = false; g.director.update = () => {}; if (document.pointerLockElement) document.exitPointerLock(); });
  await T('G1 a far-away ghost is never used for a body scare', () => {
    const g = __game, gh = g.ghost; g.debug.teleport('bedroom');
    gh.state = 'NONE'; gh.roomId = 'crypt'; gh.spawnIn('crypt'); gh.setState('PATROL');
    const called = []; ['mirror', 'corridor', 'ceiling'].forEach(n => { const o = g.scares[n]; g.scares['_' + n] = o; g.scares[n] = function () { called.push(n); return false; }; });
    g.stage = 3; for (let i = 0; i < 300; i++) { g.director.lastBig = -999; g.director.fire(); g.director.real(); }
    ['mirror', 'corridor', 'ceiling'].forEach(n => { g.scares[n] = g.scares['_' + n]; delete g.scares['_' + n]; });
    return { ok: called.length === 0 && !g.atmosphere.phantom && gh.roomId === 'crypt', called: called.length, phantom: !!g.atmosphere.phantom, room: gh.roomId, near: g.scares.ghostNear() };
  });
  await T('G2 after a scare she is back exactly where she was', () => new Promise(res => {
    const g = __game, gh = g.ghost; g.tweens.cancelAll(); g.scares.busy = false; if (g.scares.saved) g.scares.endScript(false); g.debug.teleport('library');
    gh.state = 'NONE'; gh.roomId = 'library'; gh.spawnIn('library'); gh.setState('PATROL');
    const at = { room: gh.roomId, x: gh.x, z: gh.z };
    const started = g.scares.ceiling(false);
    const during = gh.roomId; sim(6);
    res({ tws: g.tweens.list.map(t => [+t.delay.toFixed(2), +t.t.toFixed(2), +t.dur.toFixed(2), !!t.done]), started: started, busy: g.scares.busy, saved: !!g.scares.saved, scripted: gh.scripted, ai: gh.aiEnabled, st: gh.state, ok: !g.scares.busy && gh.roomId === at.room && Math.abs(gh.x - at.x) < 1e-6 && Math.abs(gh.z - at.z) < 1e-6 && !gh.scripted, during, after: { room: gh.roomId, x: +gh.x.toFixed(2), z: +gh.z.toFixed(2) }, at: { room: at.room, x: +at.x.toFixed(2), z: +at.z.toFixed(2) } });
  }));
  await T('G3 she walks in through the door, starting on its threshold', () => {
    const g = __game, gh = g.ghost; g.debug.teleport('parlor');
    const W = g.world, door = Object.values(W.doors).find(d => d.room.id === 'corridor' && d.pair && d.pair.room.id === 'parlor');
    gh.state = 'NONE'; gh.roomId = 'corridor'; gh.place(door.approach[0], door.approach[1], 0); gh.setState('PATROL');
    gh.goal = { room: 'parlor', x: g.camera.position.x, z: g.camera.position.z }; gh.routeDoors = [door.id];
    gh.passDoor(door);
    const th = door.pair.toWorld(0, 0.1), onThreshold = Math.hypot(gh.x - th[0], gh.z - th[1]) < 0.05;
    const firstStep = gh.path[0], toApproach = firstStep && Math.hypot(firstStep.x - door.pair.approach[0], firstStep.z - door.pair.approach[1]) < 0.05;
    return { ok: gh.roomId === 'parlor' && onThreshold && toApproach && gh.entering <= 0.35 && door.pair.isOpen, onThreshold, toApproach, hidden: +gh.entering.toFixed(2), doorOpen: door.pair.isOpen };
  });
  await T('G4 the exit scare hunts from where she is (no teleport)', () => {
    const g = __game, gh = g.ghost; g.tweens.cancelAll(); g.scares.busy = false; if (g.scares.saved) g.scares.endScript(false); g.debug.teleport('corridor'); g.scares.exitDone = false;
    gh.state = 'NONE'; gh.roomId = 'kitchen'; gh.spawnIn('kitchen'); gh.setState('PATROL'); const x = gh.x, z = gh.z;
    g.scares.exitScare(); sim(0.7, 0.05);   // the hunt starts 0.6 s in; check right then, before she has walked anywhere
    const r = { ok: gh.state === 'HUNT' && gh.roomId === 'kitchen' && gh.lastKnown.room === 'corridor', state: gh.state, room: gh.roomId, moved: +Math.hypot(gh.x - x, gh.z - z).toFixed(2) };
    gh.state = 'NONE'; gh.setState('PATROL'); return r;
  });

  // ---------------- graphics ----------------
  await T('V1 high quality: full sharpness, max anisotropy, 2x textures', () => {
    const g = __game, r = g.renderer, dpr = window.devicePixelRatio || 1, wood = g.world.lab.wood();
    return { ok: g.quality === 'high' && r.getPixelRatio() === Math.min(dpr, 2) && wood.anisotropy === r.capabilities.getMaxAnisotropy() && wood.image.width === 1024 && g.flashlight.shadow.mapSize.x === 2048, quality: g.quality, ratio: r.getPixelRatio(), aniso: wood.anisotropy, tex: wood.image.width, shadow: g.flashlight.shadow.mapSize.x };
  });
  await T('V2 the quality setting applies at once and is remembered', () => {
    const g = __game, sel = document.getElementById('menu-gfx'); sel.value = 'performance'; sel.dispatchEvent(new Event('change'));
    const r1 = { ratio: g.renderer.getPixelRatio(), stored: localStorage.getItem('silentshadows.gfx.v1'), shadow: g.flashlight.shadow.mapSize.x };
    sel.value = 'high'; sel.dispatchEvent(new Event('change'));
    return { ok: Math.abs(r1.ratio - Math.min(window.devicePixelRatio || 1, 1) * 0.85) < 1e-6 && r1.stored === 'performance' && r1.shadow === 1024 && localStorage.getItem('silentshadows.gfx.v1') === 'high', r1 };
  });
  await T('V3 movement eases in and out (no instant start or stop)', () => {
    const g = __game; g.testMode = true; g.debug.teleport('corridor'); g.camera.position.set(0, 1.6, 6); g.euler.set(0, 0, 0, 'YXZ'); g.applyCamera(0.016);
    g.keys = { KeyW: true }; g.updateMovement(1 / 60); const v1 = g.vel.length();
    for (let i = 0; i < 30; i++) g.updateMovement(1 / 60); const v2 = g.vel.length();
    g.keys = {}; g.updateMovement(1 / 60); const v3 = g.vel.length();
    for (let i = 0; i < 40; i++) g.updateMovement(1 / 60); const v4 = g.vel.length();
    return { ok: v1 > 0 && v1 < v2 * 0.5 && Math.abs(v2 - CONFIG.player.walk) < 0.2 && v3 > 0 && v3 < v2 && v4 === 0, v1: +v1.toFixed(2), v2: +v2.toFixed(2), v3: +v3.toFixed(2), v4 };
  });

  console.log((errs.length ? 'FAIL ' : 'PASS ') + 'X1 no console errors', JSON.stringify(errs.slice(0, 5))); errs.length ? fail++ : pass++;
  console.log(pass + ' passed, ' + fail + ' failed');
  await browser.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
