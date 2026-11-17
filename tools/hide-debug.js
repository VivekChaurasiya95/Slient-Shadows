// Quiet-hiding debug. Run: node tools/hide-debug.js
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8769);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8769/'); await page.waitForTimeout(2500);
  await page.evaluate(() => { __game.testMode = true; });
  await page.click('#btn-play-game'); await page.waitForTimeout(500);
  const res = await page.evaluate(() => {
    const g = __game, gh = g.ghost, h = g.hiding, out = [];
    g.god = false; window.sim = (sec, dt) => { dt = dt || 0.05; for (let t = 0; t < sec; t += dt) g.step(dt); };
    for (const seed of ['Q1', 'Q2', 'Q3', 'Q4']) {
      g.newRun(seed); g.isPlaying = true; g.testMode = true; g.isDead = false;
      for (const id of g.layout.hides) {
        const spot = g.world.hideSpots[id], rid = spot.room.id;
        g.isDead = false; g.inputLocked = false; g.hiding.reset(); g.hud.blackout(false);
        g.debug.teleport(rid); gh.aiEnabled = false; gh.scripted = false; gh.state = 'NONE'; gh.setState('PATROL'); sim(0.3);
        g.camera.position.set(spot.front.x, 1.7, spot.front.z);
        h.enter(spot); sim(2.5);
        const entered = h.active === spot;
        gh.aiEnabled = true; gh.roomId = rid; gh.state = 'NONE'; gh.spawnIn(rid); gh.lastKnown = { room: rid, x: spot.x, z: spot.z, t: g.clockT };
        gh.beginSearch(40); gh.path = []; gh.goal = null; gh.searchT = 40; gh.checksLeft = 4; gh.path = []; gh.goal = null; gh.checking = null; room_burn(g, rid);
        let peeked = false, phases = new Set(), t = 0, dead = false;
        for (; t < 60; t += 0.05) { g.keys.Space = true; h.stamina = 1; g.step(0.05); if (gh.checking) phases.add(gh.checking.spot.def.id + ':' + gh.checking.phase); if (h.peekActive) { peeked = true; } if (g.isDead) { dead = true; break; } if (peeked && !h.peekActive) break; }
        g.keys.Space = false;
        out.push({ seed, spot: id, room: rid, entered, peeked, dead, t: +t.toFixed(1), phases: Array.from(phases).slice(0, 4), ghostRoom: gh.roomId, state: gh.state });
        if (h.active) { h.active = null; h.busy = false; }
      }
    }
    function room_burn(g, rid) { g.world.rooms[rid].hides.forEach(x => { x.burnedUntil = 0; x.ghostHere = false; x.compromised = false; }); }
    return out;
  });
  res.forEach(r => console.log(JSON.stringify(r)));
  console.log('errors', JSON.stringify(errs));
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
