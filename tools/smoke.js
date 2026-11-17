// Headless smoke test. Run: node tools/smoke.js   (needs playwright in %TEMP%\pwtest)
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8765);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('response', r => { if (r.status() === 404) console.log('404:', r.url()); });
  await page.goto('http://localhost:8765/');
  await page.waitForTimeout(4000);
  const out = path.join(process.env.TEMP, 'pwtest') + path.sep;
  await page.screenshot({ path: out + 'm_menu.png' });
  const info = await page.evaluate(() => { const g = window.__game; return g ? { seed: g.seed, rooms: Object.keys(g.world.rooms).length, doors: Object.keys(g.world.doors).length, spots: Object.keys(g.world.spots).length, hides: Object.keys(g.world.hideSpots).length } : null; });
  console.log('boot', JSON.stringify(info));
  console.log('errors:', JSON.stringify(errs, null, 1));
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
