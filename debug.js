'use strict';
// ==========================================================================
// DEBUG PANEL: toggled with the backtick key. Hidden by default.
// Shows seed / room / ghost state / fear, teleports, spawns items, toggles
// ghost AI, triggers every scare, reveals item layout, runs a solvability test.
// ==========================================================================
class DebugPanel {
  constructor(game) {
    this.game = game; this.open = false;
    const el = this.el = document.createElement('div'); el.id = 'debug'; el.style.display = 'none';
    document.body.appendChild(el);
    el.innerHTML = '<div class="dbg-head"><b>Debug</b><span id="dbg-info"></span></div><div class="dbg-body" id="dbg-body"></div>';
    this.body = el.querySelector('#dbg-body'); this.info = el.querySelector('#dbg-info');
    this.build();
    setInterval(() => this.refresh(), 250);
  }
  btn(label, fn) { const b = document.createElement('button'); b.textContent = label; b.onclick = e => { e.stopPropagation(); fn(); this.game.audio.ensure(); }; return b; }
  group(title, items) {
    const d = document.createElement('div'); d.className = 'dbg-group'; const h = document.createElement('div'); h.className = 'dbg-title'; h.textContent = title; d.appendChild(h);
    items.forEach(i => d.appendChild(i)); this.body.appendChild(d);
  }
  build() {
    const g = this.game;
    this.group('Teleport', WORLD_DATA.ROOM_IDS.map(id => this.btn(id, () => this.teleport(id))));
    this.group('Scares', g.scares.names.map(n => this.btn(n, () => g.scares.debugTrigger(n))));
    this.group('Ghost', [
      this.btn('toggle AI', () => { g.ghost.aiEnabled = !g.ghost.aiEnabled; }),
      this.btn('wake now', () => { g.ghost.dormantT = 0; }),
      this.btn('hunt me', () => { g.ghost.startHunt(); }),
      this.btn('bring to my room', () => { g.ghost.roomId = g.currentRoom; g.ghost.spawnIn(g.currentRoom); }),
      this.btn('fear +30', () => g.fear.add(30)),
      this.btn('god mode', () => { g.god = !g.god; g.hud.toast('God mode ' + (g.god ? 'on' : 'off')); })
    ]);
    const sel = document.createElement('select'); Object.keys(ITEM_DEFS).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); });
    this.group('Items', [sel, this.btn('give', () => { const it = g.inventory.makeItem(sel.value, sel.value === 'note' ? { text: 'A test note.' } : {}); g.inventory.add(it); }),
      this.btn('all keys', () => ['silver', 'rusty', 'brass', 'bone'].forEach(k => g.inventory.add(g.inventory.makeItem('key_' + k)))),
      this.btn('relic', () => g.inventory.add(g.inventory.makeItem('relic'))),
      this.btn('unlock all', () => { WORLD_DATA.LOCK_SLOTS.forEach(s => { g.unlocked.add(s); Object.values(g.world.doors).filter(d => d.def.slot === s).forEach(d => { d.lock = null; d.buildLockVisual(); }); }); }),
      this.btn('print layout', () => { console.table(Object.entries(g.layout.items).map(([s, i]) => ({ spot: s, item: i.id, truthful: i.truthful, text: i.text || '' }))); console.log('hides', g.layout.hides, 'fake', g.layout.fakeHide, 'roles', g.layout.roles, 'traps', g.layout.traps); })]);
    this.group('Run', [
      this.btn('new seed', () => g.restart(false)), this.btn('same seed', () => g.restart(true)),
      this.btn('solvability x10', () => this.solve()), this.btn('test mode (no pointer lock)', () => { g.testMode = !g.testMode; })
    ]);
    this.out = document.createElement('div'); this.out.className = 'dbg-out'; this.body.appendChild(this.out);
  }
  teleport(id) {
    const g = this.game, r = g.world.rooms[id];
    g.switchRoom(id, null);
    const d = r.doors.find(x => x.def.side === 'S') || r.doors[0];
    const s = d ? d.spawn : [r.cx, r.cz];
    g.camera.position.set(s[0], CONFIG.player.eye, s[1]); g.euler.set(0, d ? yawFromDir(d.n[0], d.n[1]) : 0, 0, 'YXZ');
  }
  solve() {
    let ok = 0, prev = null; const seeds = [];
    for (let i = 0; i < 10; i++) { const s = RNG.randomSeed(); seeds.push(s); const l = WORLD_DATA.generateLayout(new RNG(s), prev); if (WORLD_DATA.validate(l).ok) ok++; prev = { relicSpot: l.relicSpot, keySpots: l.keySpots }; }
    this.out.textContent = 'Solvable: ' + ok + '/10 (' + seeds.join(', ') + ')';
  }
  toggle() { this.open = !this.open; this.el.style.display = this.open ? 'block' : 'none'; if (this.open) document.exitPointerLock(); }
  refresh() {
    if (!this.open) return;
    const g = this.game, gh = g.ghost;
    this.info.textContent = ' seed ' + g.seed + ' | room ' + g.currentRoom + ' | ghost ' + gh.state + '@' + gh.roomId + ' | fear ' + Math.round(g.fear.v) + ' | stage ' + g.stage + ' | hidden ' + (g.hiding.active ? g.hiding.active.def.id : '-');
  }
}
