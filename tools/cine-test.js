// Cutscene test. Run: node tools/cine-test.js [scene ...]
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); }).listen(8780);
const PLAN = { opening: [3, 8, 14, 20, 29, 38, 44, 52, 56, 61], parlor: [3, 10, 16, 22], bedroom: [3, 8, 14, 20], kitchen: [3, 9, 15, 20], library: [3, 9, 15, 21], nursery: [3, 8, 14, 19], cellar: [3, 9, 15, 20], crypt: [3, 10, 17, 24, 28] };
(async () => {
  const want = process.argv.slice(2), ids = want.length ? want : Object.keys(PLAN);
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await page.goto('http://localhost:8780/'); await page.waitForTimeout(3500);
  await page.evaluate(() => { __game.testMode = true; __game.hud.hideModal(document.getElementById('start-menu')); __game.menu.stop(); });
  for (const id of ids) for (const t of PLAN[id] || [5]) {
    const info = await page.evaluate(([id, t]) => { try { return __game.cinema.seek(id, t); } catch (e) { return { error: e.message + ' ' + (e.stack || '').split('\n')[1] }; } }, [id, t]);
    if (info && info.error) { console.log(id, t, 'ERROR', info.error); errs.push(id + '@' + t + ' ' + info.error); continue; }
    await page.waitForTimeout(350);
    await page.screenshot({ path: OUT + 'c_' + id + '_' + t + '.png' });
    const fps = await page.evaluate(() => { const r = __game.renderer.info.render; return r.calls + ' calls, ' + r.triangles + ' tris'; });
    console.log(id.padEnd(8), String(t).padStart(2) + 's', 'dur', info.duration, fps);
  }
  await page.evaluate(() => __game.cinema.stopSeek());
  console.log('errors', JSON.stringify(errs.slice(0, 6))); await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
