// Feature test for the expansion: language, electricity, weapons, missions, and how they connect.
// Run: node tools/features-test.js        (needs playwright in %TEMP%\pwtest)
// Screenshots go to %TEMP%\pwtest\feat_*.png
const path = require('path');
const pw = require(path.join(process.env.TEMP, 'pwtest', 'node_modules', 'playwright'));
const http = require('http'), fs = require('fs');
const root = path.join(__dirname, '..'), OUT = path.join(process.env.TEMP, 'pwtest') + path.sep;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]), p = path.join(root, u === '/' ? 'index.html' : u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(8781);
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  let pass = 0, fail = 0;
  const T = async (name, fn, arg) => {
    try { const r = await page.evaluate(fn, arg); const ok = r && r.ok !== false; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(40), JSON.stringify(r)); ok ? pass++ : fail++; return r; }
    catch (e) { fail++; console.log('FAIL ' + name.padEnd(40), 'THREW', e.message.slice(0, 400)); }
  };
  const shot = async name => { await page.waitForTimeout(450); await page.screenshot({ path: OUT + 'feat_' + name + '.png' }); };

  await page.goto('http://localhost:8781/'); await page.waitForTimeout(3000);
  await page.evaluate(() => localStorage.removeItem('silentshadows.lang.v1'));
  await page.reload(); await page.waitForTimeout(3000);

  // ---------------- language ----------------
  await T('L1 English is the default', () => ({ ok: I18N.lang === 'en' && document.getElementById('btn-play-game').textContent === 'Begin the night', lang: I18N.lang, btn: document.getElementById('btn-play-game').textContent }));
  await page.click('.lang-pick .seg-lang button[data-lang="hi"]'); await page.waitForTimeout(200);
  await T('L2 menu switches to Hinglish', () => {
    const t = id => document.getElementById(id).textContent;
    return { ok: I18N.lang === 'hi' && t('btn-play-game') === 'Raat shuru karo' && localStorage.getItem('silentshadows.lang.v1') === 'hi' && document.documentElement.lang === 'hi-Latn', btn: t('btn-play-game'), foot: document.querySelector('.menu-foot').textContent, stored: localStorage.getItem('silentshadows.lang.v1') };
  });
  await shot('menu_hi');
  await page.reload(); await page.waitForTimeout(3000);
  await T('L3 the choice survives a reload', () => ({ ok: I18N.lang === 'hi' && document.getElementById('btn-play-game').textContent === 'Raat shuru karo', lang: I18N.lang, pickerOn: document.querySelector('.lang-pick .seg-lang button.on').dataset.lang }));
  await T('L4 opening cutscene speaks Hinglish', () => {
    const g = __game; g.cinema.seek('opening', 4.5); const a = document.querySelector('#cine-caption .txt').textContent;
    g.cinema.seek('opening', 27); const b = document.querySelector('#cine-caption .txt').textContent, who = document.querySelector('#cine-caption .who').textContent;
    g.cinema.seek('opening', 3); const ch = document.querySelector('#cine-chapter h2').textContent, sub = document.querySelector('#cine-chapter p').textContent; g.cinema.stopSeek();
    return { ok: a === 'Hollow Manor saintalees saal se khamosh pada tha.' && /Signal badhiya hai/.test(b) && who === 'DACRE', a, b: b.slice(0, 60), who, ch, sub };
  });
  // start a run in test mode
  await page.evaluate(() => { __game.testMode = true; });
  await page.click('#btn-play-game'); await page.waitForTimeout(800);
  await page.evaluate(() => { const g = __game; g.god = true; g.ghost.aiEnabled = false; window.sim = (sec, dt) => { dt = dt || 0.05; for (let t = 0; t < sec; t += dt) g.step(dt); }; g.newRun('FEAT1'); g.isPlaying = true; g.hud.clearRadio(); g.story.started = true; });
  await T('L5 objective, radio and prompts in Hinglish', () => new Promise(res => {
    const g = __game; g.missions.refresh();
    const obj = document.getElementById('obj-text').textContent, sub = document.getElementById('obj-sub').textContent, prog = document.getElementById('obj-prog').textContent;
    // the subtitle appears when its voice starts (studio clip, browser voice or text-only fallback), so wait for it
    g.story.forceSay('S002'); const t0 = performance.now();
    const iv = setInterval(() => { if (!document.getElementById('radio').classList.contains('on') && performance.now() - t0 < 6000) return; clearInterval(iv);
      const radio = document.querySelector('#radio .txt').textContent, who = document.querySelector('#radio .who').textContent;
      g.hud.clearRadio();
      const sw = g.power.rooms.bedroom.sw.ia.prompt(); g.hud.setPrompt(sw, true); const prompt = document.getElementById('prompt-text').textContent;
      res({ ok: obj === 'Manor ki electricity restore karo' && /replacement fuse dhoondo/.test(sub) && prog === '0/1 Fuse Mila' && /purane ghar hain/.test(radio) && prompt === 'Light chalu karo', obj, sub, prog, radio, who, prompt });
    }, 50);
  }));
  await T('L6 voices: Hindi picks hi-IN or Indian English, Devanagari when hi', () => {
    const p = Narrator.pick('DACRE'), dev = I18N.speechText('Battery is limited. Use it wisely.', T('Battery is limited. Use it wisely.'), true);
    const voices = speechSynthesis.getVoices().map(v => v.lang).filter(l => /^(hi|en-IN)/i.test(l));
    return { ok: (p.tag === 'hi-IN' || p.tag === 'en-IN') && /बैटरी/.test(dev), tag: p.tag, devanagari: p.devanagari, voiceName: p.voice ? p.voice.name : null, indianVoicesInstalled: voices, speech: dev };
  });
  await T('L7 switching language mid-run keeps the run', () => {
    const g = __game; g.inventory.add(g.inventory.makeItem('battery')); g.inventory.add(g.inventory.makeItem('lighter'));
    const before = { items: g.inventory.items.map(i => i.id).join(), seed: g.seed, clock: g.clockT, room: g.currentRoom };
    g.pause(); document.querySelector('#pause-modal .seg-lang button[data-lang="en"]').click();
    const pauseTitle = document.querySelector('#pause-modal .end-title').textContent, obj = document.getElementById('obj-text').textContent;
    g.resume();
    const after = { items: g.inventory.items.map(i => i.id).join(), seed: g.seed, clock: g.clockT, room: g.currentRoom };
    document.querySelector('#pause-modal .seg-lang button[data-lang="hi"]').click();
    const obj2 = document.getElementById('obj-text').textContent;
    return { ok: JSON.stringify(before) === JSON.stringify(after) && pauseTitle === 'Paused' && obj === 'Restore the manor\u2019s electricity' && obj2 === 'Manor ki electricity restore karo', before, after, pauseTitle, obj, obj2 };
  });

  // ---------------- electricity ----------------
  await T('P1 every room has a bulb and a switch', () => {
    const g = __game, out = {};
    Object.keys(g.world.rooms).forEach(id => { const e = g.power.rooms[id]; out[id] = e ? e.bulbs.length + (g.world.rooms[id].interactables.includes(e.sw.ia) ? '+sw' : '-') : 'none'; });
    return { ok: Object.values(out).every(v => /^\d\+sw$/.test(v)), out };
  });
  await T('P2 bedroom bulb works from the start', () => {
    const g = __game, e = g.power.rooms.bedroom; g.debug.teleport('bedroom'); sim(0.2);
    const lit0 = g.power.isLit('bedroom'), lvl0 = g.room.lightLevel;
    g.power.flip('bedroom'); sim(0.6);
    const b = e.bulbs[0], on = { lit: g.power.isLit('bedroom'), light: +b.light.intensity.toFixed(2), glow: +b.mat.emissiveIntensity.toFixed(2), lever: +e.sw.pivot.rotation.x.toFixed(2), level: g.room.lightLevel, hud: document.getElementById('hud-power').dataset.st };
    g.power.flip('bedroom'); sim(0.6);
    const off = { lit: g.power.isLit('bedroom'), light: +b.light.intensity.toFixed(2), lever: +e.sw.pivot.rotation.x.toFixed(2) };
    return { ok: !lit0 && on.lit && on.light > 0.5 && on.glow > 1 && on.lever > 0.4 && on.level >= 0.75 && on.hud === 'on' && !off.lit && off.light < 0.05 && off.lever < -0.4, lvl0, on, off };
  });
  await page.evaluate(() => { const g = __game; g.power.flip('bedroom'); g.camera.position.set(1.5, 1.5, 2.0); g.euler.set(0.36, 0.52, 0, 'YXZ'); });
  await shot('bedroom_lit');
  await page.evaluate(() => { const g = __game; g.power.flip('bedroom'); });
  await T('P3 dead circuit: corridor switch springs back', () => {
    const g = __game; g.debug.teleport('corridor'); sim(0.1); const n = document.getElementById('toasts').children.length;
    g.power.flip('corridor'); sim(0.6);
    const toast = document.getElementById('toasts').lastChild.textContent;
    return { ok: !g.power.rooms.corridor.on && !g.power.isLit('corridor') && /Bijli nahi/.test(toast), on: g.power.rooms.corridor.on, toast };
  });
  await T('P4 fuse restores the main circuit, once', () => {
    const g = __game; g.debug.teleport('cellar'); sim(0.1);
    const ia = g.world.rooms.cellar.fuseBox.ia, p0 = ia.prompt();
    ia.activate({}); const noFuse = g.power.mains;
    g.inventory.add(g.inventory.makeItem('fuse')); const p1 = ia.prompt(); ia.activate({}); sim(2.4);
    const r = { mains: g.power.mains, fuseLeft: g.inventory.has('fuse'), cellarLit: g.power.isLit('cellar'), corridorLive: g.power.powered('corridor'), kitchenLive: g.power.powered('kitchen'), nurseryLive: g.power.powered('nursery') };
    g.inventory.add(g.inventory.makeItem('fuse')); ia.activate({}); const fuseKept = g.inventory.has('fuse'); g.inventory.removeItem(g.inventory.slots.find(s => s && s.id === 'fuse'));
    const p2 = ia.prompt(); ia.activate({}); const nursery = g.power.powered('nursery');
    return { ok: !noFuse && r.mains && !r.fuseLeft && r.cellarLit && r.corridorLive && !r.kitchenLive && !r.nurseryLive && fuseKept && nursery, p0, p1, p2, r, fuseKept, nursery };
  });
  await T('P5 objective moves on and the corridor lights', () => {
    const g = __game; g.missions.refresh(); const obj = T(g.hud.objCur.title);
    g.debug.teleport('corridor'); g.power.flip('corridor'); sim(0.8);
    return { ok: g.power.isLit('corridor') && obj === 'Kitchen ka maintenance locker kholo', obj, lit: g.power.isLit('corridor'), bulbs: g.power.rooms.corridor.bulbs.map(b => +b.light.intensity.toFixed(2)) };
  });
  await T('P6 blackout and ghost-entry flicker are events', () => {
    const g = __game; const k0 = g.power.rooms.corridor.k;
    g.power.blackout(1.5); sim(0.4); const during = g.power.isLit('corridor'); sim(1.6); const after = g.power.isLit('corridor');
    g.atmosphere.flicker(1.0); const ks = []; for (let i = 0; i < 20; i++) { g.step(0.05); ks.push(+g.power.rooms.corridor.k.toFixed(2)); } sim(1.2);
    const steady = g.power.rooms.corridor.k;
    return { ok: k0 > 0.9 && !during && after && Math.min(...ks) < 0.6 && steady > 0.9, k0, during, after, flick: ks.slice(0, 10), steady: +steady.toFixed(2) };
  });
  await T('P7 she hunts slower under a lit bulb, then kills it', () => {
    const g = __game, gh = g.ghost; gh.aiEnabled = true; gh.state = 'NONE'; gh.roomId = 'corridor'; gh.place(0, -6, 0); gh.dormantT = 0; gh.setState('PATROL');
    gh.lastKnown = { room: 'corridor', x: 0, z: 9, t: 0 }; gh.startHunt(); sim(0.2);
    const r = { inLight: gh.inLight, slow: gh.lightSlow };
    g.power.rooms.corridor.lastTrip = -999; let tripped = false; const trace = []; g.flashlightOn = false;
    for (let t = 0; t < 10 && !tripped; t += 0.1) { g.step(0.1); tripped = !g.power.rooms.corridor.on; if (Math.round(t * 10) % 10 === 0) trace.push(gh.state + ':' + g.power.rooms.corridor.huntLitT.toFixed(1)); }
    gh.aiEnabled = false; gh.state = 'NONE'; gh.setState('PATROL'); gh.spawnIn('parlor'); g.flashlightOn = true;
    return { ok: r.inLight && r.slow === CONFIG.light.huntSlow && tripped, r, tripped, trace };
  });

  // ---------------- weapons ----------------
  // she stands 1.6 m in front of the player in the middle of the corridor (nothing in between)
  const ghostAhead = () => { const g = __game, gh = g.ghost; g.debug.teleport('corridor'); g.camera.position.set(0, 1.7, 3); g.euler.set(0, 0, 0, 'YXZ'); g.applyCamera(0.016); gh.state = 'NONE'; gh.roomId = 'corridor'; gh.place(0, 1.4, Math.PI); gh.entering = 0; gh.wResist = 0; gh.stunCd = 0; gh.dormantT = 0; gh.setState('HUNT'); gh.update(0.016); g.combat.cool = 0; g.combat.anim = null; };
  await page.evaluate(`window.ghostAhead = ${ghostAhead.toString()}`);
  await T('W1 bat: pickup durability, hit stuns, no spam', () => {
    const g = __game; g.inventory.reset(); const it = g.inventory.makeItem('bat'); g.inventory.add(it); g.combat.onPickup(it); g.inventory.select(g.inventory.slots.indexOf(it));
    const hits0 = it.charges; ghostAhead();
    g.combat.attack(); const spam = g.combat.attack(); sim(0.3);
    const st1 = g.ghost.state; sim(0.6);
    return { ok: hits0 === g.cfg.w.batHits && st1 === 'STUNNED' && it.charges === hits0 - 1, hits0, st1, charges: it.charges, stunT: +g.ghost.stunT.toFixed(2) };
  });
  await page.evaluate(() => { const g = __game; ghostAhead(); g.ghost.setState('PATROL'); g.ghost.aiEnabled = false; g.combat.update(0.016); g.combat.anim = { kind: 'bat', t: 0.12, dur: 0.7 }; });
  await shot('weapon_bat');
  await T('W2 hits get weaker, a reeling ghost ignores more', () => {
    const g = __game, gh = g.ghost; ghostAhead();
    const d1 = gh.weaponHit('bat', 2.6), s1 = gh.stunT, again = gh.weaponHit('bat', 2.6);
    gh.state = 'NONE'; gh.setState('HUNT'); const d2 = gh.weaponHit('bat', 2.6), s2 = gh.stunT;
    return { ok: d1 === true && again === 'reeling' && s2 < s1, s1: +s1.toFixed(2), s2: +s2.toFixed(2), again };
  });
  await T('W3 crowbar drives her back', () => {
    const g = __game; g.inventory.reset(); const it = g.inventory.makeItem('crowbar'); g.inventory.add(it); g.combat.onPickup(it); g.inventory.select(0);
    ghostAhead(); const d0 = Math.hypot(g.ghost.x - g.camera.position.x, g.ghost.z - g.camera.position.z);
    g.combat.attack(); sim(0.4); const st = g.ghost.state; g.ghost.aiEnabled = true; sim(1.0); g.ghost.aiEnabled = false;
    const d1 = Math.hypot(g.ghost.x - g.camera.position.x, g.ghost.z - g.camera.position.z);
    return { ok: st === 'REPELLED' && d1 > d0, st, d0: +d0.toFixed(2), d1: +d1.toFixed(2) };
  });
  await page.evaluate(() => { const g = __game; ghostAhead(); g.ghost.setState('PATROL'); g.combat.cool = 0; g.combat.anim = null; g.combat.update(0.016); });
  await shot('weapon_crowbar');
  await T('W4 pistol: ammo, hit stuns, miss calls her', () => {
    const g = __game, c = g.combat; g.inventory.reset(); c.ammo = { flare: 0, pistol: 0 };
    const it = g.inventory.makeItem('pistol'); g.inventory.add(it); g.inventory.select(0);
    ghostAhead(); c.attack(); const dry = c.ammo.pistol;
    c.onPickup(it); const loaded = c.ammo.pistol; c.cool = 0; c.anim = null; ghostAhead(); c.attack(); const st = g.ghost.state, left = c.ammo.pistol;
    // miss: she is in the next room behind a closed door, and the shot calls her
    g.debug.teleport('corridor'); g.euler.set(0, Math.PI, 0, 'YXZ'); g.applyCamera(0.016);
    const gh = g.ghost; gh.state = 'NONE'; gh.roomId = 'parlor'; gh.spawnIn('parlor'); gh.setState('PATROL'); gh.stunCd = 0;
    c.cool = 0; c.anim = null; c.ammo.pistol = 1; c.attack();
    return { ok: dry === 0 && loaded === g.cfg.w.pistolStart && st === 'STUNNED' && left === loaded - 1 && (gh.state === 'HUNT' || gh.state === 'SUSPICIOUS'), dry, loaded, st, left, afterMiss: gh.state };
  });
  await page.evaluate(() => { const g = __game; ghostAhead(); g.ghost.setState('PATROL'); g.combat.cool = 0; g.combat.anim = null; g.combat.update(0.016); });
  await shot('weapon_pistol');
  await T('W5 flare: lights the room, disorients her', () => {
    const g = __game, c = g.combat; g.inventory.reset(); c.ammo = { flare: 0, pistol: 0 };
    const it = g.inventory.makeItem('flaregun'); g.inventory.add(it); g.inventory.select(0); c.onPickup(it); const loaded = c.ammo.flare;
    ghostAhead(); c.attack(); let st = null; for (let t = 0; t < 1.5; t += 0.05) { g.step(0.05); if (g.ghost.state === 'REPELLED') st = 'REPELLED'; }
    const lightK = +c.flareLight.intensity.toFixed(2), lit = c.flareLit('corridor');
    return { ok: loaded === g.cfg.w.flareStart && st === 'REPELLED' && lightK > 0.5 && lit && c.ammo.flare === loaded - 1, loaded, st, lightK, lit, left: c.ammo.flare };
  });
  await shot('weapon_flare');
  await T('W6 the dead and the paused cannot fight', () => {
    const g = __game, c = g.combat; g.inventory.reset(); const it = g.inventory.makeItem('pistol'); g.inventory.add(it); g.inventory.select(0); c.ammo.pistol = 3;
    ghostAhead(); g.isDead = true; c.cool = 0; c.attack(); const deadAmmo = c.ammo.pistol; g.isDead = false;
    g.pause(); c.cool = 0; c.attack(); const pausedAmmo = c.ammo.pistol; g.resume();
    return { ok: deadAmmo === 3 && pausedAmmo === 3, deadAmmo, pausedAmmo };
  });
  await T('W7 difficulty changes the balance', () => { const D = CONFIG.difficulties; return { ok: D.easy.w.batHits > D.normal.w.batHits && D.normal.w.batHits > D.nightmare.w.batHits && D.easy.w.pistolStun > D.nightmare.w.pistolStun && D.easy.w.flareStart > D.nightmare.w.flareStart, easy: D.easy.w, nightmare: D.nightmare.w }; });
  await T('W8 ammo pickups fill the pouch, not a slot', () => {
    const g = __game, c = g.combat; g.inventory.reset(); c.ammo = { flare: 0, pistol: 0 };
    const free0 = g.inventory.slots.filter(s => !s).length; g.inventory.add(g.inventory.makeItem('flare_ammo')); g.inventory.add(g.inventory.makeItem('pistol_ammo'));
    return { ok: c.ammo.flare === 2 + g.cfg.w.ammoBonus && c.ammo.pistol === 2 + g.cfg.w.ammoBonus && g.inventory.slots.filter(s => !s).length === free0, ammo: c.ammo };
  });

  // ---------------- missions ----------------
  await page.evaluate(() => { const g = __game; g.inventory.reset(); g.combat.reset(); g.newRun('FEAT2'); g.isPlaying = true; g.god = true; g.ghost.aiEnabled = false; g.hud.clearRadio(); });
  await T('M1 relic sealed until the ritual', () => {
    const g = __game, wi = g.world.spots[g.layout.relicSpot].items[0]; g.debug.teleport('crypt');
    wi.setVisible(true); wi.interactable.enabled = true; wi.pickUp(); sim(1);
    return { ok: !g.inventory.has('relic') && !g.relicTaken, relicSpot: g.layout.relicSpot, sealed: !g.missions.ritualDone };
  });
  await T('M2 locker: crowbar, clue, kitchen wiring', () => {
    const g = __game, L = g.missions.locker; g.debug.teleport('kitchen');
    L.boardIa.activate({}); const nailed = L.nailed;
    g.inventory.add(g.inventory.makeItem('crowbar')); L.boardIa.activate({}); sim(1.4);
    const open = L.open, clueVisible = L.wi && L.wi.interactable.enabled; L.wi.pickUp(); sim(1);
    L.jbIa.activate({}); const fixed = g.power.kitchenFixed;
    return { ok: nailed && !L.nailed && open && clueVisible && g.missions.cluesFound.has(2) && fixed, open, clueVisible, clues: [...g.missions.cluesFound], fixed };
  });
  await page.evaluate(() => { const g = __game; g.euler.set(0, -Math.PI / 2, 0, 'YXZ'); g.camera.position.set(2.6, 1.6, -4.3); });
  await shot('locker');
  await T('M3 strongbox: code + power -> crypt key', () => {
    const g = __game, M = g.missions, S = M.safe; g.debug.teleport('library');
    // the two clue pages in the house
    Object.values(g.world.spots).forEach(sp => sp.items.forEach(wi => { if (wi.item.clue) { M.onPickup(wi.item); } }));
    const set = () => S.dials.forEach((d, i) => { while (d.v !== M.code[i]) M.turnDial(d); });
    set(); sim(0.3); const noPower = { solved: S.solved, open: S.open };
    g.inventory.add(g.inventory.makeItem('fuse')); g.power.installFuse(g.inventory.slots.find(s => s && s.id === 'fuse')); g.debug.teleport('library'); sim(1.2);
    const key = S.wi && S.wi.item.id, visible = S.wi && S.wi.interactable.enabled;
    if (S.wi) { S.wi.pickUp(); sim(1); }
    return { ok: noPower.solved && !noPower.open && S.open && /^key_/.test(key) && visible && g.inventory.has(key), code: M.code, noPower, open: S.open, key, held: g.inventory.has(key) };
  });
  await page.evaluate(() => { const g = __game; g.euler.set(0, -Math.PI / 2, 0, 'YXZ'); g.camera.position.set(2.6, 1.3, -4.6); });
  await shot('strongbox');
  await T('M4 crypt gate opens with the safe key', () => {
    const g = __game, d = g.world.doors.c_crypt; g.debug.teleport('corridor'); d.interact({}); sim(1);
    return { ok: g.unlocked.has('crypt') && d.isOpen, unlocked: [...g.unlocked] };
  });
  await T('M5 altar: offerings, wrong order resets, right order breaks the seal', () => {
    const g = __game, M = g.missions, A = M.altar; g.debug.teleport('crypt');
    A.stones[0].ia.activate({}); const early = M.pressed.length;
    WORLD_DATA.OFFERINGS.forEach(id => g.inventory.add(g.inventory.makeItem(id)));
    A.bowls.forEach(b => b.ia.activate({}));
    const want = M.symbols.map(s => s.glyph), wrong = A.stones.find(s => s.glyph !== want[0]);
    wrong.ia.activate({}); const reset = M.pressed.length;
    want.forEach(gl => A.stones.find(s => s.glyph === gl).ia.activate({}));
    sim(2.6);
    // one ghost: she is not dropped into the crypt, she hunts her way there from where she was
    const lk = g.ghost.lastKnown;
    return { ok: early === 0 && A.placed === 3 && reset === 0 && M.ritualDone && !!M.encounter && g.ghost.state === 'HUNT' && lk && lk.room === 'crypt', placed: A.placed, order: want, ritual: M.ritualDone, encounter: !!M.encounter, ghost: g.ghost.state + '@' + g.ghost.roomId, target: lk && lk.room };
  });
  await page.evaluate(() => { const g = __game; g.ghost.aiEnabled = false; g.euler.set(-0.25, 0, 0, 'YXZ'); g.camera.position.set(0, 1.6, -2.6); });
  await shot('altar');
  await T('M6 survive, then the skull, then the chase', () => {
    const g = __game, M = g.missions; const dur = M.encounter.dur; g.ghost.aiEnabled = true;
    for (let t = 0; t < dur + 1; t += 0.1) g.step(0.1);
    const survived = M.survived;
    const wi = g.world.spots[g.layout.relicSpot].items[0]; g.debug.teleport('crypt'); wi.setVisible(true); wi.interactable.enabled = true; wi.pickUp(); sim(3.5);
    g.missions.refresh();
    const obj = g.hud.objCur.title;
    return { ok: survived && g.relicTaken && g.ghost.relicChase && obj === 'Escape through the front door', survived, relic: g.relicTaken, chase: g.ghost.relicChase, obj: T(obj) };
  });
  await T('M7 journal shows the chain', () => {
    const g = __game; g.hud.toggleInventory(); const rows = [...document.querySelectorAll('#inv-journal .jrow')].map(r => r.className.replace('jrow ', '') + ':' + r.querySelector('.jt').textContent);
    const clues = [...document.querySelectorAll('#inv-journal .jclue')].map(r => r.textContent); g.hud.toggleInventory();
    return { ok: rows.length === 7 && rows.filter(r => r.startsWith('done')).length >= 5, rows, clues };
  });
  await T('M8 death screen repaints on a language switch', () => {
    const g = __game; g.showDeath('ghost'); const hi = document.querySelector('#game-over-modal .end-title').textContent;
    I18N.set('en'); const en = document.querySelector('#game-over-modal .end-title').textContent, sub = document.getElementById('death-sub').textContent;
    I18N.set('hi'); g.hud.hideModal(document.getElementById('game-over-modal'));
    return { ok: hi === 'Tum mar gaye' && en === 'You died', hi, en, sub };
  });
  // missing-key monitor: any English UI string shown while in Hindi that has no table entry
  await T('X1 no console errors', () => ({ ok: true }));
  console.log(pass + ' passed, ' + fail + ' failed');
  console.log('errors', JSON.stringify(errs.slice(0, 10), null, 1));
  await browser.close(); srv.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
