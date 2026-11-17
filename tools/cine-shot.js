const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); }).listen(8771);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' | ' + (e.stack || '').split('\n')[1])); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await page.goto('http://localhost:8771/'); await page.waitForTimeout(2500);
  await page.evaluate(() => { __game.hud.hideModal(document.getElementById('start-menu')); __game.hud.showModal(document.getElementById('story-modal')); __game.intro.first = false; __game.intro.active = true; });
  await page.waitForTimeout(700);
  const shots = [['manor', [2, 8]], ['family', [3, 6.5, 10.5]], ['crypt', [2.5, 7.5, 10]], ['job', [4, 8]], ['radio', [3, 7]], ['final', [3, 10]]];
  for (const [id, times] of shots) for (const t of times) {
    await page.evaluate(([id, t]) => { const ci = __game.intro.cine; ci.stop(); ci.renderAt(id, t, { speakers: ['DACRE', 'ROWAN', 'DACRE'] }); }, [id, t]);
    const el = await page.$('.story-stage'); await el.screenshot({ path: OUT + 'cine_' + id + '_' + t + '.png' });
  }
  console.log('errors', JSON.stringify(errs)); await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
