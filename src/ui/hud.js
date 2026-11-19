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
      battery: $('battery-fill'), fearbar: $('fear-fill'), seed: $('hud-seed') };
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
  say(lines) {
    this.radioQ = (this.radioQ || []).concat(lines.map(l => ({ who: l[0], text: l[1] })));
    if (!this.radioBusy) this.nextRadio();
  }
  nextRadio() {
    const r = document.getElementById('radio');
    const item = (this.radioQ || []).shift();
    if (!item) { this.radioBusy = false; r.classList.remove('on'); return; }
    this.radioBusy = true;
    r.classList.toggle('rowan', item.who === 'ROWAN');
    r.classList.toggle('narrator', item.who === 'NARRATOR');
    r.querySelector('.who').textContent = item.who === 'ROWAN' ? 'ROWAN' : item.who === 'NARRATOR' ? 'NARRATOR' : 'DACRE';
    r.querySelector('.txt').textContent = item.text;
    r.classList.add('on');
    // only the story narrator is spoken; radio and thought lines stay as text
    Narrator.enabled = !!this.game.access.narration;
    const spoken = item.who === 'NARRATOR';
    if (spoken) Narrator.speak(item.text, 'NARRATOR', true);
    const ms = Math.max(2600, item.text.length * 62, spoken ? Narrator.ms(item.text) : 0);
    clearTimeout(this.radioT);
    this.radioT = setTimeout(() => { r.classList.remove('on'); this.radioT = setTimeout(() => this.nextRadio(), 380); }, ms);
  }
  clearRadio() { Narrator.stop(); this.radioQ = []; this.radioBusy = false; clearTimeout(this.radioT); document.getElementById('radio').classList.remove('on'); }
  setClock(text) { const c = document.getElementById('hud-clock'); if (c.textContent !== text) c.textContent = text; }

  setPrompt(text, focused) {
    const e = this.el;
    if (text !== this.promptText) { this.promptText = text; if (text) e.ptext.textContent = text; }
    const on = !!text && !this.game.inputLocked;
    if (on !== this.promptOn) { this.promptOn = on; e.prompt.classList.toggle('on', on); }
    e.reticle.classList.toggle('highlight', !!focused);
  }
  setHold(p) { this.el.hold.style.setProperty('--p', (p * 360).toFixed(0) + 'deg'); this.el.hold.classList.toggle('on', p > 0); }
  toast(msg) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; this.el.toasts.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 400); }, 2600);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    if (this.game.audio.ready) this.game.audio.toast();
  }
  subtitle(text) {
    if (!this.game.access.subtitles) return;
    const s = this.el.subs; s.textContent = text; s.classList.add('on');
    clearTimeout(this.subT); this.subT = setTimeout(() => s.classList.remove('on'), 2200);
  }
  setObjective(text) {
    const o = this.el.obj; if (o.textContent === text) return;
    o.classList.add('swap'); setTimeout(() => { o.textContent = text; o.classList.remove('swap'); }, 220);
  }
  alert(text) {
    const a = this.el.alert; a.textContent = text; a.classList.add('on'); clearTimeout(this.alertT);
    this.alertT = setTimeout(() => a.classList.remove('on'), 2600);
  }
  setHidden(on) { document.body.classList.toggle('is-hidden', on); if (!on) this.el.cue.classList.remove('on'); }
  setHideCue(t) { const c = this.el.cue; if (c.textContent !== t) c.textContent = t; c.classList.add('on'); }
  setBreath(v, active, exhausted) { this.el.breath.classList.toggle('on', active); this.el.breathFill.style.transform = 'scaleX(' + v.toFixed(3) + ')'; this.el.breath.classList.toggle('low', exhausted || v < 0.25); }
  pipGlitch(sec) { this.el.pip.classList.add('glitch'); clearTimeout(this.pipT); this.pipT = setTimeout(() => this.el.pip.classList.remove('glitch'), sec * 1000); }
  flash(a) { const f = this.el.flash; f.style.opacity = a; setTimeout(() => { f.style.opacity = 0; }, 90); }
  blackout(on) { this.el.fade.classList.toggle('black', on); }
  fade(on, ms) { const f = this.el.fade; f.style.transitionDuration = (ms || 300) + 'ms'; f.classList.toggle('on', on); }
  setSprint(v, winded) { const f = document.getElementById('sprint-fill'); f.style.width = (clamp(v, 0, 1) * 100).toFixed(0) + '%'; f.classList.toggle('low', winded); }
  setBattery(p) { this.el.battery.style.width = clamp(p, 0, 100) + '%'; this.el.battery.classList.toggle('low', p < 20); }

  // ---- modals ------------------------------------------------------------------
  showModal(el) { el.style.display = 'flex'; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible'))); }
  hideModal(el) { el.classList.remove('visible'); setTimeout(() => { if (!el.classList.contains('visible')) el.style.display = 'none'; }, 520); }

  showNote(item) {
    this.el.noteText.textContent = item.text || '';
    this.noteOpen = true; this.showModal(this.el.note); this.game.audio.pageTurn();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  closeNote() { if (!this.noteOpen) return; this.noteOpen = false; this.hideModal(this.el.note); this.game.container.requestPointerLock && this.game.isPlaying && !this.game.isDead && this.game.container.requestPointerLock(); }

  // ---- inventory ---------------------------------------------------------------
  renderInventory() {
    const inv = this.game.inventory;
    this.slotEls.forEach((s, i) => {
      const it = inv.slots[i], img = s.querySelector('img');
      s.classList.toggle('filled', !!it); s.classList.toggle('sel', i === inv.selected);
      if (it) { const src = ItemFactory.icon(it.id); if (img.getAttribute('src') !== src) img.setAttribute('src', src); s.title = it.def.name; } else { img.removeAttribute('src'); s.title = ''; }
      s.querySelector('.cnt').textContent = it && it.def.charges ? it.charges : '';
    });
    if (this.invOpen) this.renderPanel();
  }
  renderPanel() {
    const inv = this.game.inventory, list = this.el.invList;
    list.innerHTML = '';
    inv.slots.forEach((it, i) => {
      const r = document.createElement('div'); r.className = 'row' + (i === inv.selected ? ' sel' : '');
      r.innerHTML = '<span class="k">' + (i + 1) + '</span><span class="n">' + (it ? it.def.name : 'Empty') + '</span>';
      r.onclick = () => inv.select(i); list.appendChild(r);
    });
    const cur = inv.current; this.el.invDesc.textContent = cur ? cur.def.desc : 'Nothing selected';
    const notes = this.el.invNotes; notes.innerHTML = '';
    if (!inv.notes.length) notes.textContent = 'No notes yet';
    inv.notes.forEach((n, i) => { const d = document.createElement('div'); d.className = 'note'; d.textContent = '\u201C' + n.text + '\u201D'; d.onclick = () => this.showNote(n); notes.appendChild(d); });
    this.drawMap();
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
      x.fillStyle = seen ? '#111' : 'rgba(200,190,170,0.4)'; x.fillText(seen ? r.def.name : '?', p[0] * W, p[1] * H + 3);
    });
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
