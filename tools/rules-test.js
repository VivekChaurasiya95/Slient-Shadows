// Rules test: pause, sprint stamina, chase ramp, beam cost, midnight/dawn, fear rules, seeded determinism.
// Run: node tools/rules-test.js
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8772);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
  await page.goto('http://localhost:8772/'); await page.waitForTimeout(3000);
  await page.evaluate(() => { __game.testMode = true; });
  await page.click('#btn-play-game'); await page.waitForTimeout(600);
  console.log('after click:', JSON.stringify(await page.evaluate(() => ({ playing: __game.isPlaying, cine: __game.cinema.active, test: __game.testMode, paused: __game.paused }))));
  await page.evaluate(() => {
    const g = __game; g.god = true; window.sim = (sec, dt) => { dt = dt || 0.05; for (let t = 0; t < sec; t += dt) g.step(dt); };
    g.ghost.aiEnabled = true; g.ghost.dormantT = 0;
  });
  let pass = 0, fail = 0;
  const T = async (name, fn, arg) => {
    try { await page.evaluate(() => { const g = __game; if (g.isDead && !g.restarting) { g.isDead = false; g.inputLocked = false; g.hud.blackout(false); } g.god = true; }); const r = await page.evaluate(fn, arg); const ok = r && r.ok !== false; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(34), JSON.stringify(r)); ok ? pass++ : fail++; return r; }
    catch (e) { fail++; console.log('FAIL ' + name.padEnd(34), 'THREW', e.message.slice(0, 300)); }
  };

  // 1. Pause freezes everything
  await T('pause freezes the simulation', () => {
    const g = __game, gh = g.ghost; g.debug.teleport('parlor'); gh.state = 'NONE'; gh.roomId = 'parlor'; gh.spawnIn('parlor'); gh.setState('HUNT'); gh.lastKnown = { room: 'parlor', x: 0, z: 0, t: 0 }; sim(0.5);
    const before = { x: gh.x, z: gh.z, clock: g.clockT, tw: g.tweens.list.length };
    g.tweens.add({ dur: 3, update: () => {} });
    g.pause(); const modalShown = document.getElementById('pause-modal').classList.contains('visible') || document.getElementById('pause-modal').style.display === 'flex';
    sim(10);
    const frozen = gh.x === before.x && gh.z === before.z && g.clockT === before.clock && !g.isDead;
    g.resume(); sim(2);
    const moved = gh.x !== before.x || gh.z !== before.z || g.clockT > before.clock;
    return { ok: frozen && moved && modalShown, frozen, moved, modalShown, paused: g.paused };
  });
  // Real pointer lock: leave it for real, then come back with a real click on Resume
  {
    await page.evaluate(() => { const g = __game; g.testMode = false; g.isDead = false; g.god = true; });
    await page.mouse.click(400, 225); await page.waitForTimeout(500);
    const had = await page.evaluate(() => !!document.pointerLockElement);
    await page.evaluate(() => document.exitPointerLock()); await page.waitForTimeout(500);
    const s1 = await page.evaluate(() => ({ paused: __game.paused, modal: document.getElementById('pause-modal').classList.contains('visible'), hold: !!__game.clickHold, cine: __game.cinema.active, room: __game.currentRoom }));
    const ok1 = s1.paused && s1.modal; console.log((ok1 ? 'PASS ' : 'FAIL ') + 'losing the mouse pauses'.padEnd(34), JSON.stringify({ lockWasHeld: had, ...s1 })); ok1 ? pass++ : fail++;
    const before = await page.evaluate(() => __game.clockT); await page.waitForTimeout(1200);
    const after = await page.evaluate(() => __game.clockT);
    const ok2 = after === before; console.log((ok2 ? 'PASS ' : 'FAIL ') + 'clock stays frozen while paused'.padEnd(34), JSON.stringify({ before, after })); ok2 ? pass++ : fail++;
    await page.click('#btn-resume'); await page.waitForTimeout(800);
    const s2 = await page.evaluate(() => ({ paused: __game.paused, locked: !!document.pointerLockElement }));
    const ok3 = !s2.paused; console.log((ok3 ? 'PASS ' : 'FAIL ') + 'Resume click returns to the game'.padEnd(34), JSON.stringify(s2)); ok3 ? pass++ : fail++;
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); }); await page.waitForTimeout(300);
    const ok4 = await page.evaluate(() => __game.paused); console.log((ok4 ? 'PASS ' : 'FAIL ') + 'alt-tab (blur) pauses'.padEnd(34), JSON.stringify({ paused: ok4 })); ok4 ? pass++ : fail++;
    await page.evaluate(() => { const g = __game; g.testMode = true; g.resume(); g.god = true; });
  }
  // 2. Sprint stamina
  await T('sprint drains and winds you', () => {
    const g = __game; g.debug.teleport('corridor'); g.camera.position.set(0, 1.7, 11); g.euler.set(0, 0, 0, 'YXZ'); g.ghost.aiEnabled = false; g.stamina = 1; g.winded = false; sim(0.1);
    g.keys.KeyW = true; g.keys.ShiftLeft = true;
    let t = 0, windedAt = null; const start = g.camera.position.z;
    for (; t < 12; t += 0.05) { g.step(0.05); if (g.winded && windedAt === null) windedAt = t; if (g.camera.position.z < -10.5) { g.camera.position.z = 11; } }
    const spd = (() => { const z0 = g.camera.position.z; g.step(0.5); return Math.abs(g.camera.position.z - z0) / 0.5; })();
    g.keys.KeyW = false; g.keys.ShiftLeft = false; sim(0.2);
    return { ok: windedAt > 3.5 && windedAt < 6.5 && spd < 4.2, windedAtSec: windedAt && +windedAt.toFixed(2), speedWhileWinded: +spd.toFixed(2), walkSpeed: CONFIG.player.walk };
  });
  await T('stamina refills after a rest', () => {
    const g = __game; g.keys = {}; sim(8);
    return { ok: g.stamina > 0.8 && !g.winded, stamina: +g.stamina.toFixed(2) };
  });

  // 3. The chase gets faster
  await T('hunt speed ramps up', () => {
    const g = __game, gh = g.ghost; g.debug.teleport('library'); gh.aiEnabled = true; gh.state = 'NONE'; gh.roomId = 'library'; gh.spawnIn('library'); gh.setState('HUNT');
    gh.lastKnown = { room: 'library', x: g.camera.position.x, z: g.camera.position.z, t: g.clockT };
    gh.lostT = 0; gh.huntT = 0; gh.tickHunt(0.05); const start = gh.huntSpeedNow;
    gh.huntT = 15; gh.tickHunt(0.05); const mid = gh.huntSpeedNow;
    gh.huntT = 60; gh.tickHunt(0.05); const late = gh.huntSpeedNow;
    gh.aiEnabled = false;
    const P = CONFIG.player;
    return { ok: late >= start * 1.45 && mid > start * 1.2 && late < start * 1.55, startMps: +start.toFixed(2), after15s: +mid.toFixed(2), after60s: +late.toFixed(2), playerWalk: P.walk, playerSprint: P.sprint, sprintSeconds: +(1 / P.sprintDrain).toFixed(1) };
  });
  // 4. The beam costs battery and the ghost resists
  await T('stun costs 12% and fades', () => {
    const g = __game, gh = g.ghost; g.battery = 100; gh.resist = 0; gh.stunCd = 0; gh.state = 'HUNT'; gh.roomId = g.currentRoom;
    const out = [];
    for (let i = 0; i < 4; i++) { gh.stunCd = 0; gh.state = 'HUNT'; const b0 = g.battery; gh.beamStun(); out.push({ battery: +(b0 - g.battery).toFixed(1), stun: +gh.stunT.toFixed(2), resist: +gh.resist.toFixed(2) }); }
    g.battery = 5; gh.stunCd = 0; gh.state = 'HUNT'; gh.group.visible = true; gh.checkFlashlight();
    const weak = gh.state !== 'STUNNED';
    return { ok: out[0].battery === 12 && out[3].stun < out[0].stun && out[3].stun >= CONFIG.beam.minStun && weak, stuns: out, weakBeamDoesNothing: weak };
  });

  // 5. Midnight and dawn
  await T('midnight changes the rules', () => {
    const g = __game; g.debug.teleport('parlor'); g.restart(false); g.testMode = true; g.isPlaying = true; sim(0.2);
    const startClock = document.getElementById('hud-clock').textContent;
    const safeBefore = Object.values(g.world.rooms).filter(r => r.role === 'safe').length;
    g.clockT = CONFIG.night.midnightAt + 0.1; sim(0.2);
    const clock = document.getElementById('hud-clock').textContent;
    const safeAfter = Object.values(g.world.rooms).filter(r => r.role === 'safe').length;
    return { ok: g.midnight && safeAfter === 0 && safeBefore > 0 && /12:0\d AM/.test(clock) && /11:1\d PM/.test(startClock), startClock, clock, safeBefore, safeAfter };
  });
  await T('dawn ends the night', () => {
    const g = __game; g.clockT = CONFIG.night.dawnAt - 0.2; sim(0.5); sim(2);
    const title = document.querySelector('#game-over-modal .end-title').textContent;
    return { ok: g.isDead && title === 'Dawn', title, sub: document.getElementById('death-sub').textContent, clock: document.getElementById('hud-clock').textContent };
  });

  // 6. Fear rules
  await T('fear shortens the breath hold', () => {
    const g = __game; g.restart(false); g.testMode = true; g.ghost.aiEnabled = false; sim(0.3);
    const spot = g.world.hideSpots[g.layout.hides[0]], h = g.hiding, run = (fear) => {
      g.debug.teleport(spot.room.id); g.hiding.reset(); g.fear.set(fear); g.camera.position.set(spot.front.x, 1.7, spot.front.z); h.enter(spot); sim(2.4);
      g.fear.update = () => {}; g.fear.set(fear); h.stamina = 1; h.exhausted = false; g.keys.Space = true; let t = 0; for (; t < 15; t += 0.05) { g.step(0.05); if (h.exhausted) break; } g.keys.Space = false; h.active && h.leave(); sim(2); delete g.fear.update; return t; };
    const calm = run(0), scared = run(95);
    return { ok: scared < calm * 0.65, calmSec: +calm.toFixed(1), scaredSec: +scared.toFixed(1) };
  });
  await T('noise meter lies at high fear', () => {
    const g = __game; g.restart(false); g.testMode = true; g.ghost.aiEnabled = false; g.hiding.reset(); g.fear.update = () => {}; sim(0.3);
    const count = (fear) => { g.fear.set(fear); g.lieT = 0; g.lie = null; let falseAlarms = 0, ticks = 0; for (let t = 0; t < 60; t += 0.1) { g.fear.set(fear); g.step(0.1); const v = parseInt(document.getElementById('db-display').textContent); ticks++; if (v >= CONFIG.micThreshold && g.micLevel === 0 && (g.noiseDisplay || 0) < 10) falseAlarms++; } return falseAlarms; };
    const calm = count(10), scared = count(90); delete g.fear.update;
    return { ok: calm === 0 && scared > 5, falseAlarmsCalm: calm, falseAlarmsScared: scared };
  });
  await T('fake door sound plays', () => {
    const g = __game; g.audio.ensure(); let ok = true; try { g.director.fakeDoor(); g.director.hallucinate(); } catch (e) { ok = false; }
    return { ok, doorsInRoom: g.room.doors.length };
  });

  // 7. Determinism
  await T('same seed = same night', () => {
    const g = __game, runNight = (seed) => {
      g.restart(false); g.newRun(seed); g.isPlaying = true; g.testMode = true; g.isDead = false; g.ghost.aiEnabled = true; g.ghost.dormantT = 3; g.god = true; g.fear.update = () => {};
      const trace = [g.ghost.roomId + '@' + g.ghost.x.toFixed(1) + ',' + g.ghost.z.toFixed(1)]; const rolls = [g.rand(), g.rand(), g.frand()];
      for (let t = 0; t < 150; t += 0.1) { g.step(0.1); if (Math.round(t * 10) % 300 === 0) trace.push(g.ghost.roomId + '@' + g.ghost.x.toFixed(1) + ',' + g.ghost.z.toFixed(1) + ':' + g.ghost.state); }
      trace.push(g.ghost.roomId + ':' + g.ghost.state + ':' + g.ghost.x.toFixed(2) + ',' + g.ghost.z.toFixed(2) + ' dir=' + g.director.cool.toFixed(2) + ' lt=' + g.atmosphere.lightningT.toFixed(2));
      delete g.fear.update; return { trace, rolls };
    };
    const a = runNight('DAILY1'), b = runNight('DAILY1'), c = runNight('DAILY2');
    const same = JSON.stringify(a) === JSON.stringify(b), differs = JSON.stringify(a) !== JSON.stringify(c);
    return { ok: same && differs, sameSeedMatches: same, otherSeedDiffers: differs, a: a.trace.slice(-1)[0], c: c.trace.slice(-1)[0] };
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  console.log('errors', JSON.stringify(errs.slice(0, 6)));
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
