// Screenshots of each weapon viewmodel and a lit room, for visual checks.
// Run: node tools/view-shot.js   -> %TEMP%\pwtest\view_<weapon>.png, view_room.png
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8782);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8782/'); await page.waitForTimeout(3000);
  await page.evaluate(() => { __game.testMode = true; });
  await page.click('#btn-play-game'); await page.waitForTimeout(800);
  await page.evaluate(() => { const g = __game; g.god = true; g.ghost.aiEnabled = false; g.ghost.spawnIn('parlor'); g.hud.clearRadio(); g.story.started = false; document.getElementById('hud-layer').style.opacity = '0.25'; });
  for (const id of ['bat', 'crowbar', 'flaregun', 'pistol']) {
    await page.evaluate(id => { const g = __game; g.inventory.reset(); const it = g.inventory.makeItem(id); g.inventory.add(it); g.inventory.select(0); g.debug.teleport('corridor'); g.camera.position.set(0, 1.7, 6); g.euler.set(-0.05, 0, 0, 'YXZ'); g.power.mains = true; g.power.setOn('corridor', true); }, id);
    await page.waitForTimeout(700); await page.screenshot({ path: OUT + 'view_' + id + '.png' });
  }
  await page.evaluate(() => { const g = __game; g.inventory.reset(); g.debug.teleport('bedroom'); g.power.setOn('bedroom', true); g.camera.position.set(1.5, 1.6, 2.5); g.euler.set(-0.05, 0.4, 0, 'YXZ'); });
  await page.waitForTimeout(900); await page.screenshot({ path: OUT + 'view_room.png' });
  await page.evaluate(() => { const g = __game; g.power.setOn('bedroom', false); });
  await page.waitForTimeout(900); await page.screenshot({ path: OUT + 'view_room_off.png' });
  console.log('errors', JSON.stringify(errs));
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
