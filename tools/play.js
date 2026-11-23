// Gameplay test. Run: node tools/play.js [seed]
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8766);
const seed = process.argv[2] || 'TESTA1';
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 500)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
  await page.goto('http://localhost:8766/');
  await page.waitForTimeout(3000);
  await page.click('.mbtn[data-panel=options]'); await page.waitForTimeout(500); await page.fill('#menu-seed', seed);
  await page.evaluate(() => { window.__game.testMode = true; });
  await page.click('#btn-play-game');
  await page.waitForTimeout(1500);
  const log = (...a) => console.log(...a);
  const shot = async n => page.screenshot({ path: OUT + n + '.png' });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  log('seed', await ev(() => __game.seed), 'playing', await ev(() => __game.isPlaying));
  await ev(() => { __game.ghost.aiEnabled = false; });
  await shot('p_start');

  // 1. look at a door and open it by raycast
  await ev(() => { const g = __game; g.camera.position.set(0.9, 1.7, -3); g.euler.set(0, 1.5708 * 1, 0, 'YXZ'); g.camera.quaternion.setFromEuler(g.euler); });
  await page.waitForTimeout(500);
  log('focus', await ev(() => __game.interact.focus && __game.interact.focus.id), 'prompt', await ev(() => __game.hud.promptText));
  await shot('p_door_closed');
  await ev(() => { __game.pressInteract(); setTimeout(() => __game.interact.release(), 80); });
  await page.waitForTimeout(500);
  await shot('p_door_opening');
  await page.waitForTimeout(900);
  log('door state', await ev(() => { const d = __game.world.doors.c_parlor; return d.st + ' t=' + d.t.toFixed(2) + ' rect=' + JSON.stringify(d.rect); }));
  await shot('p_door_open');
  // walk through
  await ev(() => { __game.keys.KeyW = true; });
  await page.waitForTimeout(1500);
  await ev(() => { __game.keys.KeyW = false; });
  await page.waitForTimeout(800);
  log('after walk: room', await ev(() => __game.currentRoom), 'transitioning', await ev(() => __game.transitioning));
  await shot('p_parlor_arrive');

  // 2. every room screenshot
  for (const id of ['corridor', 'parlor', 'bedroom', 'kitchen', 'library', 'nursery', 'cellar', 'crypt']) {
    await ev(id => { const d = window.__game.debug; d.teleport(id); }, id);
    await page.waitForTimeout(700);
    await shot('r_' + id);
    await ev(() => { const g = __game; g.euler.y += Math.PI; });
    await page.waitForTimeout(250);
    await shot('r_' + id + '_b');
  }
  log('errors', JSON.stringify(errs, null, 1));
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
