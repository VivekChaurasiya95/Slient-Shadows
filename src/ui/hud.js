'use strict';
// ==========================================================================
// HUD: prompt, hold ring, toasts, subtitles, hotbar, inventory + journal + map,
// note modal, hide overlay, breath bar, fades, grain. Everything eases (CSS
// transitions) instead of toggling display.
// ==========================================================================
class HUD {
  constructor(game) {
    this.game = game;
    const $ = id => document.getElementById(id);
    this.el = { prompt: $('interact-prompt'), ptext: $('prompt-text'), reticle: $('reticle'), hold: $('hold-ring'), toasts: $('toasts'), subs: $('subtitles'),
      hotbar: $('hotbar'), inv: $('inv-panel'), invList: $('inv-list'), invNotes: $('inv-notes'), invDesc: $('inv-desc'), map: $('inv-map'),
      note: $('note-modal'), noteText: $('note-text'), obj: $('obj-text'), alert: $('threat-alert'), hide: $('hide-overlay'), cue: $('hide-cue'),
      breath: $('breath'), breathFill: $('breath-fill'), flash: $('flash'), fade: $('fade'), grain: $('fx-grain'), pip: $('bodycam-pip'),
      battery: $('battery-fill'), fearbar: $('fear-fill'), seed: $('hud-seed'),
      objSub: $('obj-sub'), objProg: $('obj-prog'), objBanner: $('obj-banner'), journal: $('inv-journal'), power: $('hud-power'), weapon: $('hud-weapon') };
    this.slotEls = [];
    for (let i = 0; i < CONFIG.inventorySlots; i++) {
      const s = document.createElement('div'); s.className = 'slot'; s.innerHTML = '<span class="num">' + (i + 1) + '</span><img alt=""><span class="cnt"></span>';
      this.el.hotbar.appendChild(s); this.slotEls.push(s);
    }
    this.toastT = 0; this.subT = 0; this.alertT = 0; this.pipT = 0; this.invOpen = false; this.noteOpen = false; this.promptOn = false;
    this.grainCtx = this.el.grain.getContext('2d'); this.grainT = 0;
    game.inventory.on('change', () => this.renderInventory());
    game.inventory.on('add', (it, i) => { const s = this.slotEls[i]; s.classList.add('pop'); setTimeout(() => s.classList.remove('pop'), 500); });
    this.renderInventory();
  }

  // ---- radio (Dacre) and thought (Rowan) lines, queued so they never overlap ------
  // A line is [who, text] or [who, text, { style, pos }]. pos: 'rand' puts the voice somewhere out in the house.
  say(lines) {
    this.radioQ = (this.radioQ || []).concat(lines.map(l => Object.assign({ who: l[0], text: l[1] }, l[2] || {})));
    if (!this.radioBusy) this.nextRadio();
  }
  // The voice director speaks each line (narrator, Dacre on the radio, Rowan's thoughts, Elspeth).
  // The subtitle appears the moment the voice starts, not before, and the next line only begins
  // after this one has finished and the style's pause has passed. Voice off: it reads for a natural time.
  nextRadio() {
    const r = document.getElementById('radio');
    const item = (this.radioQ || []).shift();
    clearTimeout(this.radioT);
    if (!item) { this.radioBusy = false; r.classList.remove('on'); return; }
    this.radioBusy = true;
    const token = this.radioToken = (this.radioToken || 0) + 1;
    let hidden = false;
    const hide = () => { if (hidden || token !== this.radioToken) return; hidden = true; r.classList.remove('on'); this.radioT = setTimeout(() => { if (token === this.radioToken) this.nextRadio(); }, 300); };
    const show = () => {
      if (token !== this.radioToken) return;
      r.classList.toggle('rowan', item.who === 'ROWAN'); r.classList.toggle('narrator', item.who === 'NARRATOR'); r.classList.toggle('elspeth', item.who === 'ELSPETH');
      r.querySelector('.who').textContent = speakerLabel(item.who);
      r.querySelector('.txt').textContent = T(item.text); r.dataset.src = item.text; r.classList.add('on');
    };
    Voice.enabled = !!this.game.access.narration;
    Voice.speak({ src: item.text, text: T(item.text), who: item.who, style: item.style, pos: item.pos, onstart: show, onend: hide });
    // a line that never starts or ends must not freeze the radio
    this.radioSafe = clearTimeout(this.radioSafe) || setTimeout(() => { if (token === this.radioToken && !hidden) { show(); hide(); } }, 30000);
  }
  // a language switch re-renders the line that is up right now
  refreshRadio() { const r = document.getElementById('radio'); if (r.dataset.src && r.classList.contains('on')) r.querySelector('.txt').textContent = T(r.dataset.src); }
  clearRadio() { Voice.stop(); this.radioQ = []; this.radioBusy = false; this.radioToken = (this.radioToken || 0) + 1; clearTimeout(this.radioT); clearTimeout(this.radioSafe); document.getElementById('radio').classList.remove('on'); }
  setClock(text) { const c = document.getElementById('hud-clock'); if (c.textContent !== text) c.textContent = text; }

  setPrompt(text, focused) {
    const e = this.el;
    text = text ? T(text) : text;
    if (text !== this.promptText) { this.promptText = text; if (text) e.ptext.textContent = text; }
    const on = !!text && !this.game.inputLocked;
    if (on !== this.promptOn) { this.promptOn = on; e.prompt.classList.toggle('on', on); }
    e.reticle.classList.toggle('highlight', !!focused);
  }
  setHold(p) { this.el.hold.style.setProperty('--p', (p * 360).toFixed(0) + 'deg'); this.el.hold.classList.toggle('on', p > 0); }
  toast(msg, kind) {
    if (!msg) return;
    const d = document.createElement('div'); d.className = 'toast' + (kind ? ' ' + kind : ''); d.textContent = T(msg); this.el.toasts.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 400); }, 2600);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    if (this.game.audio.ready) this.game.audio.toast();
  }
  subtitle(text) {
    if (!this.game.access.subtitles) return;
    const s = this.el.subs; s.textContent = T(text); s.classList.add('on');
    clearTimeout(this.subT); this.subT = setTimeout(() => s.classList.remove('on'), 2200);
  }
  // obj: a string, or { title, detail, progress, done } from the mission system. Stored in English
  // and translated on display, so a language switch re-renders it.
  setObjective(obj) {
    if (typeof obj === 'string') obj = { title: obj };
    const key = JSON.stringify(obj) + '|' + I18N.lang;
    if (key === this.objKey) return;
    const first = !this.objKey; this.objKey = key; this.objCur = obj;
    const o = this.el.obj, sub = this.el.objSub, prog = this.el.objProg;
    const paint = () => {
      o.textContent = T(obj.title, obj.p);
      if (sub) { sub.textContent = obj.detail ? T(obj.detail, obj.p) : ''; sub.style.display = obj.detail ? '' : 'none'; }
      if (prog) { prog.textContent = obj.progress ? obj.progress.map(x => T(x.label, { n: x.n, of: x.of })).join('  \u00b7  ') : ''; prog.style.display = obj.progress ? '' : 'none'; }
      o.classList.remove('swap');
    };
    if (first) { paint(); return; }
    o.classList.add('swap'); clearTimeout(this.objT); this.objT = setTimeout(paint, 220);
  }
  // a short banner when a mission step completes ("Electricity restored. New objective")
  objectiveDone(text) {
    const b = this.el.objBanner; if (!b) return;
    b.textContent = T(text); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(this.objBT); this.objBT = setTimeout(() => b.classList.remove('on'), 3200);
    if (this.game.audio.ready) this.game.audio.puzzle();
  }
  alert(text) {
    const a = this.el.alert; a.textContent = T(text); a.classList.add('on'); clearTimeout(this.alertT);
    this.alertT = setTimeout(() => a.classList.remove('on'), 2600);
  }
  setHidden(on) { document.body.classList.toggle('is-hidden', on); if (!on) this.el.cue.classList.remove('on'); }
  setHideCue(t) { const c = this.el.cue; t = T(t); if (c.textContent !== t) c.textContent = t; c.classList.add('on'); }
  setBreath(v, active, exhausted) { this.el.breath.classList.toggle('on', active); this.el.breathFill.style.transform = 'scaleX(' + v.toFixed(3) + ')'; this.el.breath.classList.toggle('low', exhausted || v < 0.25); }
  pipGlitch(sec) { this.el.pip.classList.add('glitch'); clearTimeout(this.pipT); this.pipT = setTimeout(() => this.el.pip.classList.remove('glitch'), sec * 1000); }
  flash(a) { const f = this.el.flash; f.style.opacity = a; setTimeout(() => { f.style.opacity = 0; }, 90); }
  blackout(on) { this.el.fade.classList.toggle('black', on); }
  fade(on, ms) { const f = this.el.fade; f.style.transitionDuration = (ms || 300) + 'ms'; f.classList.toggle('on', on); }
  setSprint(v, winded) { const f = document.getElementById('sprint-fill'); f.style.width = (clamp(v, 0, 1) * 100).toFixed(0) + '%'; f.classList.toggle('low', winded); }
  setBattery(p) { this.el.battery.style.width = clamp(p, 0, 100) + '%'; this.el.battery.classList.toggle('low', p < 20); }

  // ---- modals ------------------------------------------------------------------
  // el._want guards the two-frame fade-in: a hide that arrives before it must win
  showModal(el) { el._want = true; el.style.display = 'flex'; requestAnimationFrame(() => requestAnimationFrame(() => { if (el._want) el.classList.add('visible'); })); }
  hideModal(el) { el._want = false; el.classList.remove('visible'); setTimeout(() => { if (!el._want) el.style.display = 'none'; }, 520); }

  showNote(item) {
    this.noteItem = item;
    this.el.noteText.textContent = noteText(item);
    this.noteOpen = true; this.showModal(this.el.note); this.game.audio.pageTurn();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  closeNote() { if (!this.noteOpen) return; this.noteOpen = false; this.hideModal(this.el.note); this.game.container.requestPointerLock && this.game.isPlaying && !this.game.isDead && this.game.container.requestPointerLock(); }

  // ---- inventory ---------------------------------------------------------------
  // slot counter: bat durability, gun ammunition, crucifix / mirror charges
  slotCount(it) {
    if (!it) return '';
    if (it.def.ammo && this.game.combat) return String(this.game.combat.ammo[it.def.ammo] || 0);
    return it.def.charges ? String(it.charges) : '';
  }
  renderInventory() {
    const inv = this.game.inventory;
    this.slotEls.forEach((s, i) => {
      const it = inv.slots[i], img = s.querySelector('img');
      s.classList.toggle('filled', !!it); s.classList.toggle('sel', i === inv.selected);
      s.classList.toggle('weapon', !!(it && it.def.kind === 'weapon'));
      if (it) { const src = ItemFactory.icon(it.id); if (img.getAttribute('src') !== src) img.setAttribute('src', src); s.title = T(it.def.name); } else { img.removeAttribute('src'); s.title = ''; }
      const c = this.slotCount(it), ce = s.querySelector('.cnt'); ce.textContent = c; ce.classList.toggle('empty', c === '0');
    });
    this.renderWeapon();
    if (this.invOpen) this.renderPanel();
  }
  // Weapon readout above the hotbar: name, ammo or durability, how to use it
  renderWeapon() {
    const el = this.el.weapon; if (!el) return;
    const it = this.game.inventory.current;
    if (!it || it.def.kind !== 'weapon') { el.classList.remove('on'); return; }
    const c = this.game.combat, w = it.def.weapon;
    let stat;
    if (it.def.ammo) stat = T(w === 'flaregun' ? '{n} flares' : '{n} rounds', { n: c ? c.ammo[it.def.ammo] : 0 });
    else if (w === 'bat') stat = T('{n} hits left', { n: it.charges });
    else stat = T('Pries panels and boards');
    el.querySelector('.wn').textContent = T(it.def.name);
    el.querySelector('.ws').textContent = stat;
    el.querySelector('.wh').innerHTML = T(it.def.ammo ? '<kbd>LMB</kbd> / <kbd>R</kbd> fire' : '<kbd>LMB</kbd> / <kbd>R</kbd> swing');
    el.classList.toggle('dry', !!(it.def.ammo && c && !c.ammo[it.def.ammo]));
    el.classList.add('on');
  }
  renderPanel() {
    const inv = this.game.inventory, list = this.el.invList;
    list.innerHTML = '';
    inv.slots.forEach((it, i) => {
      const r = document.createElement('div'); r.className = 'row' + (i === inv.selected ? ' sel' : '');
      const k = document.createElement('span'); k.className = 'k'; k.textContent = i + 1;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = it ? T(it.def.name) + (this.slotCount(it) ? '  \u00b7 ' + this.slotCount(it) : '') : T('Empty');
      r.append(k, n); r.onclick = () => inv.select(i); list.appendChild(r);
    });
    const c = this.game.combat;
    if (c && (c.ammo.flare || c.ammo.pistol)) { const a = document.createElement('div'); a.className = 'ammo-line'; a.textContent = T('Pouch: {f} flares, {p} rounds', { f: c.ammo.flare, p: c.ammo.pistol }); list.appendChild(a); }
    const cur = inv.current; this.el.invDesc.textContent = cur ? T(cur.def.desc) : T('Nothing selected');
    const notes = this.el.invNotes; notes.innerHTML = '';
    if (!inv.notes.length) notes.textContent = T('No notes yet');
    inv.notes.forEach(n => { const d = document.createElement('div'); d.className = 'note' + (n.clue ? ' clue' : ''); d.textContent = '\u201C' + noteText(n) + '\u201D'; d.onclick = () => this.showNote(n); notes.appendChild(d); });
    this.renderJournal();
    this.drawMap();
  }
  // Journal: every mission with its state, then the clues found so far. Solutions are never filled in.
  renderJournal() {
    const j = this.el.journal, m = this.game.missions; if (!j || !m) return;
    j.innerHTML = '';
    m.journal().forEach(e => {
      const d = document.createElement('div'); d.className = 'jrow ' + e.state;
      const mark = document.createElement('span'); mark.className = 'jm'; mark.textContent = e.state === 'done' ? '\u2713' : e.state === 'active' ? '\u25B8' : '\u00b7';
      const t = document.createElement('span'); t.className = 'jt'; t.textContent = T(e.title);
      d.append(mark, t);
      if (e.detail && e.state !== 'done') { const s = document.createElement('small'); s.textContent = T(e.detail, e.p); d.appendChild(s); }
      j.appendChild(d);
    });
    const clues = m.clueLines();
    if (clues.length) {
      const h = document.createElement('h4'); h.textContent = T('Clues'); j.appendChild(h);
      clues.forEach(c => { const d = document.createElement('div'); d.className = 'jclue'; d.textContent = T(c.s, c.p); j.appendChild(d); });
    }
  }
  toggleInventory() {
    this.invOpen = !this.invOpen; this.el.inv.classList.toggle('on', this.invOpen);
    if (this.invOpen) this.renderPanel();
  }
  // Map memory: rooms the player has been in or opened
  drawMap() {
    const c = this.el.map, x = c.getContext('2d'), w = this.game.world, W = c.width, H = c.height;
    x.clearRect(0, 0, W, H); x.font = '10px monospace'; x.textAlign = 'center';
    const pos = { corridor: [0.5, 0.5], parlor: [0.17, 0.35], bedroom: [0.83, 0.35], kitchen: [0.17, 0.72], library: [0.83, 0.72], crypt: [0.5, 0.1], cellar: [0.17, 0.92], nursery: [0.83, 0.95] };
    const link = [['corridor', 'parlor'], ['corridor', 'bedroom'], ['corridor', 'kitchen'], ['corridor', 'library'], ['corridor', 'crypt'], ['kitchen', 'cellar'], ['library', 'nursery']];
    x.strokeStyle = 'rgba(200,190,170,0.25)';
    link.forEach(l => { const a = pos[l[0]], b = pos[l[1]]; x.beginPath(); x.moveTo(a[0] * W, a[1] * H); x.lineTo(b[0] * W, b[1] * H); x.stroke(); });
    Object.keys(pos).forEach(id => {
      const r = w.rooms[id]; if (!r) return;
      const seen = r.visited, here = id === this.game.currentRoom, p = pos[id];
      x.fillStyle = here ? 'rgba(232,146,58,0.9)' : seen ? 'rgba(200,190,170,0.5)' : 'rgba(200,190,170,0.1)';
      x.fillRect(p[0] * W - 24, p[1] * H - 9, 48, 18);
      x.fillStyle = seen ? '#111' : 'rgba(200,190,170,0.4)'; x.fillText(seen ? T(r.def.name) : '?', p[0] * W, p[1] * H + 3);
      // a small bulb mark on rooms whose light is on
      if (seen && this.game.power && this.game.power.isLit(id)) { x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(p[0] * W + 21, p[1] * H - 6, 3, 0, 7); x.fill(); }
    });
  }

  // Power readout in the corner: whether this room has electricity and whether its light is on
  setPower(state) {
    const el = this.el.power; if (!el || el.dataset.st === state) return;
    el.dataset.st = state;
    el.querySelector('span').textContent = T({ on: 'Light on', off: 'Light off', dead: 'No power', ritual: 'No wiring' }[state] || 'No power');
  }
  // a language switch repaints everything that was drawn from English source text
  relabel() {
    this.objKey = null; if (this.objCur) this.setObjective(this.objCur);
    this.refreshRadio(); this.renderInventory();
    const p = this.el.power; if (p && p.dataset.st) { const st = p.dataset.st; p.dataset.st = ''; this.setPower(st); }
    if (this.noteOpen && this.noteItem) this.el.noteText.textContent = noteText(this.noteItem);
  }

  // ---- film grain overlay ----------------------------------------------------------
  updateGrain(dt) {
    this.grainT -= dt; if (this.grainT > 0) return; this.grainT = 0.08;
    const c = this.el.grain, g = this.grainCtx, img = this.grainImg || (this.grainImg = g.createImageData(c.width, c.height)), d = img.data;
    const k = 14 + this.game.fear.level * 26;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = k; }
    g.putImageData(img, 0, 0);
  }
}

// Speaker names on the radio and in captions. Proper names stay, roles are translated.
function speakerLabel(who) { return who === 'NARRATOR' ? T('NARRATOR') : who; }

// Notes are stored as a template + parameters (see world-data.js), so they read correctly
// in either language. Old-style notes (plain text) fall back to their text.
function noteText(n) {
  if (!n) return '';
  const tp = n.tpl;
  if (!tp || I18N.lang === 'en') return n.text || '';
  const spot = tp.spot ? WORLD_DATA.SPOTS.find(s => s.id === tp.spot) : null;
  return T(tp.s, { key: tp.key ? lc(T(WORLD_DATA.KEY_NAMES[tp.key])) : undefined, hint: spot ? T(spot.hint) : undefined, d: tp.d });
}
