const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u); fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); }).listen(8770);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.addInitScript(() => localStorage.setItem('silentshadows.storySeen.v1', '1'));
  await page.goto('http://localhost:8770/'); await page.waitForTimeout(3000);
  await page.click('#btn-play-game'); await page.waitForTimeout(800);
  await page.click('#story-skip');
  await page.waitForFunction(() => document.getElementById('radio').classList.contains('on'), null, { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + 'radio.png' });
  console.log(await page.evaluate(() => document.querySelector('#radio .who').textContent + ': ' + document.querySelector('#radio .txt').textContent));
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
