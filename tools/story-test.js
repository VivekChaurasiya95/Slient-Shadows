// Story flow test. Run: node tools/story-test.js
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8768);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });   // fresh storage = first time player
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 400)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  const state = () => page.evaluate(() => ({ idx: __game.intro.idx, active: __game.intro.active, canNext: __game.intro.canNext, first: __game.intro.first, skipShown: getComputedStyle(document.getElementById('story-skip')).display, nextDisabled: document.getElementById('story-next').disabled, playing: __game.isPlaying, seen: localStorage.getItem('silentshadows.storySeen.v1') }));

  console.log('--- FIRST PLAY ---');
  await page.goto('http://localhost:8768/'); await page.waitForTimeout(3000);
  await page.click('#btn-play-game'); await page.waitForTimeout(1200);
  console.log('card 0', JSON.stringify(await state()));
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  console.log('Space too early:', JSON.stringify((await state()).idx), '(must still be 0)');
  await page.screenshot({ path: OUT + 's_first_0.png' });
  for (let i = 0; i < 6; i++) {
    await page.waitForFunction(() => __game.intro.canNext, null, { timeout: 30000 });
    if (i === 1 || i === 4) await page.screenshot({ path: OUT + 's_first_' + i + '.png' });
    const s = await state();
    console.log('card', s.idx, 'ready; skip display:', s.skipShown, 'seen flag:', s.seen);
    await page.click('#story-next'); await page.waitForTimeout(700);
  }
  const after = await state();
  console.log('after story', JSON.stringify(after));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: OUT + 's_ingame.png' });
  console.log('radio:', await page.evaluate(() => document.querySelector('#radio .who').textContent + ': ' + document.querySelector('#radio .txt').textContent), '| clock:', await page.evaluate(() => document.getElementById('hud-clock').textContent));

  console.log('--- SECOND PLAY (reload, same storage) ---');
  await page.reload(); await page.waitForTimeout(3000);
  await page.click('#btn-play-game'); await page.waitForTimeout(1200);
  const s2 = await state();
  console.log('story active', s2.active, 'first', s2.first, 'skip display', s2.skipShown);
  await page.screenshot({ path: OUT + 's_second_0.png' });
  await page.click('#story-skip'); await page.waitForTimeout(1500);
  console.log('after skip', JSON.stringify(await state()));
  console.log('errors', JSON.stringify(errs, null, 1));
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
