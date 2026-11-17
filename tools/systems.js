// Systems test. Run: node tools/systems.js
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8767);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 400)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
  await page.goto('http://localhost:8767/'); await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__marker = 'same-page'; window.__game.testMode = true; });
  await page.click('#btn-play-game'); await page.waitForTimeout(800);
  await page.evaluate(() => {
    const g = window.__game; window.sim = (sec, dt) => { dt = dt || 0.05; for (let t = 0; t < sec; t += dt) g.step(dt); };
    g.god = true;
  });
  const T = async (name, fn, arg) => { try { const r = await page.evaluate(fn, arg); console.log(name.padEnd(28), JSON.stringify(r)); return r; } catch (e) { console.log(name.padEnd(28), 'THREW', e.message.slice(0, 300)); } };

  await T('story opening radio', () => {
    const g = __game, seen = []; g.story.start();
    for (let t = 0; t < 14; t += 0.1) { g.step(0.1); const r = document.getElementById('radio'); if (r.classList.contains('on')) { const s = r.querySelector('.who').textContent + ': ' + r.querySelector('.txt').textContent; if (!seen.includes(s)) seen.push(s); } }
    return { lines: seen, clock: document.getElementById('hud-clock').textContent };
  });
  await page.evaluate(() => { __game.hud.clearRadio(); });
  await T('ghost roams 6 min', () => {
    const g = __game, gh = g.ghost; gh.aiEnabled = true; gh.dormantT = 0; g.debug.teleport('corridor'); gh.updateSight = function () { this.sees = false; }; gh.hear = function () {}; g.god = true; g.fear.update = function () {};
    const rooms = {}, states = {}; let maxStuck = 0, last = '', stuck = 0;
    for (let t = 0; t < 360; t += 0.1) {
      // keep the player in a safe spot so it only roams
      g.step(0.1); rooms[gh.roomId] = (rooms[gh.roomId] || 0) + 1; states[gh.state] = (states[gh.state] || 0) + 1;
      const k = gh.roomId + Math.round(gh.x * 4) + Math.round(gh.z * 4) + gh.state;
      stuck = k === last ? stuck + 0.1 : 0; last = k; maxStuck = Math.max(maxStuck, stuck);
    }
    delete gh.updateSight; delete gh.hear; return { rooms, states, maxStuckSec: +maxStuck.toFixed(1), dead: g.isDead };
  });

  await T('hunt crosses doors', () => {
    const g = __game, gh = g.ghost; g.god = true; g.debug.teleport('bedroom'); sim(0.5);
    gh.aiEnabled = true; gh.state = 'NONE'; gh.roomId = 'kitchen'; gh.spawnIn('kitchen'); gh.setState('HUNT');
    gh.lastKnown = { room: 'bedroom', x: g.camera.position.x, z: g.camera.position.z, t: g.clockT };
    const seen = new Set([gh.roomId]); let ok = false;
    for (let t = 0; t < 60; t += 0.1) { g.step(0.1); seen.add(gh.roomId); if (gh.roomId === 'bedroom') { ok = true; break; } }
    return { reachedBedroom: ok, path: Array.from(seen), state: gh.state, dist: +gh.distToPlayer().toFixed(1) };
  });

  await T('flashlight stun', () => {
    const g = __game, gh = g.ghost; g.debug.teleport('corridor'); sim(0.3);
    gh.state = 'NONE'; gh.roomId = 'corridor'; gh.place(0, g.camera.position.z - 6, 0); gh.setState('HUNT'); gh.stunCd = 0;
    g.euler.set(0, 0, 0, 'YXZ'); g.camera.quaternion.setFromEuler(g.euler); g.flashlightOn = true; g.battery = 100;
    g.camera.position.x = 0; let seen = []; for (let i = 0; i < 12; i++) { sim(0.1); seen.push(gh.state); } return { states: Array.from(new Set(seen)), visible: gh.group.visible, dist: gh.distToPlayer() };
  });

  // hiding
  for (const quiet of [true, false]) {
    await T('hide + ghost checks (' + (quiet ? 'quiet' : 'noisy') + ')', (quiet) => {
      const g = __game, gh = g.ghost, h = g.hiding; g.god = false; g.isDead = false; g.inputLocked = false;
      const spotId = g.layout.hides[0], spot = g.world.hideSpots[spotId], rid = spot.room.id;
      g.debug.teleport(rid); gh.state = 'NONE'; gh.roomId = 'corridor'; gh.setState('PATROL'); gh.aiEnabled = false; sim(0.5);
      const cam = g.camera.position; cam.set(spot.front.x, 1.7, spot.front.z);
      h.enter(spot); sim(2.5);
      const entered = h.active === spot;
      // the ghost arrives and checks every hiding place in the room
      gh.aiEnabled = true; gh.roomId = rid; gh.state = 'NONE'; gh.spawnIn(rid); gh.lastKnown = { room: rid, x: spot.x, z: spot.z, t: g.clockT };
      gh.setState('SEARCH'); gh.searchT = 30; gh.checksLeft = 4; gh.path = []; gh.goal = null; spot.burnedUntil = 0; spot.compromised = false;
      let peeked = false, found = false, t = 0;
      for (; t < 90; t += 0.05) {
        g.keys.Space = quiet; if (!quiet && t > 6) g.keys.KeyW = true;
        g.step(0.05);
        if (h.peekActive) peeked = true;
        if (g.isDead) { found = true; break; }
      }
      g.keys.KeyW = false; g.keys.Space = false;
      return { entered, peeked, killed: found, deathAt: +t.toFixed(1), stamina: +h.stamina.toFixed(2) };
    }, quiet);
    await page.evaluate(() => { const g = __game; g.restart(false); g.testMode = true; g.god = true; });
    await page.waitForTimeout(500);
  }

  await T('restart w/o reload', () => ({ marker: window.__marker, seed: __game.seed, playing: __game.isPlaying, dead: __game.isDead }));

  // scares
  for (const n of ['peek', 'mirror', 'corridor', 'corridor (lethal)', 'ceiling', 'ceiling (lethal)', 'fakeout: bat', 'fakeout: painting', 'fakeout: door', 'fakeout: chair', 'house awakens', 'hiding kill', 'death']) {
    await T('scare ' + n, (n) => {
      const g = __game; g.god = n.indexOf('lethal') >= 0 || n === 'death' || n === 'hiding kill' ? false : true; g.isDead = false; g.inputLocked = false; g.scares.busy = false; g.scares.saved = null;
      const room = n === 'mirror' ? 'bedroom' : n.indexOf('corridor') === 0 ? 'corridor' : 'parlor';
      g.debug.teleport(room);
      if (n === 'mirror') { const m = g.room.mirror.mesh; const p = TMP.v1.setFromMatrixPosition(m.matrixWorld); g.camera.position.set(p.x - 3, 1.7, p.z); g.euler.set(0, -Math.PI / 2, 0, 'YXZ'); g.camera.quaternion.setFromEuler(g.euler); }
      g.ghost.state = 'NONE'; g.ghost.setState('PATROL'); g.ghost.aiEnabled = true;
      g.scares.debugTrigger(n); sim(7);
      const res = { dead: g.isDead, busy: g.scares.busy, ghostScripted: g.ghost.scripted, modal: document.getElementById('game-over-modal').classList.contains('visible') };
      g.isDead = false; g.hud.blackout(false); g.hud.hideModal(document.getElementById('game-over-modal')); g.releaseLook(); g.scares.busy = false; if (g.scares.saved) g.scares.endScript(); g.camera.fov = g.baseFov; g.inputLocked = false; g.redAlert = false; g.audio.stopAmbience(0);
      return res;
    }, n);
  }

  // engine-level playthrough on 10 seeds: open every spot, collect keys, unlock, get relic, open the exit
  const seeds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];
  for (const s of seeds) {
    await T('solve ' + s, (seed) => {
      const g = __game; g.restart(false); g.newRun(seed); g.isPlaying = true; g.god = true; g.testMode = true; g.ghost.aiEnabled = false; g.isDead = false;
      let guard = 0, relicRoom = null;
      const roomsReach = () => WORLD_DATA.reachable(g.unlocked);
      while (guard++ < 12) {
        const rr = roomsReach();
        Object.values(g.world.spots).forEach(sp => {
          if (!rr.has(sp.room.id) || sp.done) return;
          sp.done = true;
          g.switchRoom(sp.room.id, null);
          if (sp.ia) { sp.ia.activate({}); sim(3); }
          sp.items.forEach(wi => { if (!wi.interactable.enabled) { return; } g.inventory.reset(); wi.pickUp(); sim(1.2); });
        });
        // unlock whatever the keys we hold allow
        WORLD_DATA.LOCK_SLOTS.forEach(slot => {
          if (g.unlocked.has(slot)) return;
          const keyId = g.layout.keyForSlot[slot];
          const have = g.inventory.slots.find(i => i && i.id === 'key_' + keyId) || (g.keysHeld && g.keysHeld.has(keyId));
          if (g.keysHeld && g.keysHeld.has(keyId)) {}
        });
        // simpler: track keys we collected by their spot rooms
        const collected = Object.entries(g.layout.keySpots).filter(([k, sid]) => g.world.spots[sid].done && rr.has(g.world.spots[sid].room.id));
        collected.forEach(([k]) => { const slot = WORLD_DATA.LOCK_SLOTS.find(sl => g.layout.keyForSlot[sl] === k); if (slot && !g.unlocked.has(slot)) { g.inventory.reset(); g.inventory.add(g.inventory.makeItem('key_' + k)); const d = Object.values(g.world.doors).find(x => x.def.slot === slot && x.room.id === 'corridor' || x.def.slot === slot && x.def.room === 'kitchen' || x.def.slot === slot && x.def.room === 'library'); g.switchRoom(d.room.id, null); d.interact({}); sim(2); } });
        if (WORLD_DATA.LOCK_SLOTS.every(sl => g.unlocked.has(sl))) { /* one more pass collects the rest */ if (Object.values(g.world.spots).every(sp => sp.done)) break; }
      }
      const relicSpot = g.world.spots[g.layout.relicSpot];
      const gotRelicSpot = relicSpot.done;
      g.inventory.reset(); g.inventory.add(g.inventory.makeItem('relic')); g.switchRoom('corridor', null);
      const ex = g.world.doors.c_exit; ex.interact({}); sim(2);
      return { unlocked: g.unlocked.size, relicSpotOpened: gotRelicSpot, exitOpen: ex.isOpen, allSpots: Object.values(g.world.spots).filter(x => x.done).length };
    }, s);
  }
  console.log('errors:', JSON.stringify(errs.slice(0, 8), null, 1), 'total', errs.length);
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
