'use strict';
// ==========================================================================
// ITEMS: definitions, procedural meshes, canvas icons, Inventory, WorldItem
// ==========================================================================
const ITEM_DEFS = {
  key_silver: { name: 'Silver Key', kind: 'key', keyId: 'silver', color: 0xdfe6ee, desc: 'Cold to the touch. A wolf\'s head on the bow.' },
  key_rusty:  { name: 'Rusty Key',  kind: 'key', keyId: 'rusty',  color: 0x8a4a2a, desc: 'Flaking with rust. It smells of old iron.' },
  key_brass:  { name: 'Brass Key',  kind: 'key', keyId: 'brass',  color: 0xc9a24a, desc: 'Heavy and warm, as if recently held.' },
  key_bone:   { name: 'Bone Key',   kind: 'key', keyId: 'bone',   color: 0xe8e0c8, desc: 'Carved from something that was once alive.' },
  fake_key:   { name: 'Silver Key', kind: 'key', keyId: 'fake',   color: 0xdfe6ee, desc: 'Cold to the touch. A wolf\'s head on the bow.', mimic: 'key' },
  relic:      { name: 'Horned Skull', kind: 'relic', desc: 'The cursed relic. It hums against your palm.' },
  fake_relic: { name: 'Horned Skull', kind: 'relic', desc: 'The cursed relic. It hums against your palm.', mimic: 'relic', fake: true },
  battery:    { name: 'Battery', kind: 'battery', desc: 'Restores the flashlight. Press R to use.' },
  lighter:    { name: 'Lighter', kind: 'lighter', desc: 'A small flame for when the flashlight dies. R toggles it.' },
  crucifix:   { name: 'Iron Crucifix', kind: 'crucifix', charges: 2, desc: 'Hold it up and the apparition recoils. Two uses.' },
  musicbox:   { name: 'Music Box', kind: 'musicbox', desc: 'Wind it and set it down. Something will go to listen.' },
  mirror:     { name: 'Mirror Shard', kind: 'mirror', charges: 3, desc: 'Shows where it is, for a moment. Three uses.' },
  fuse:       { name: 'Fuse', kind: 'fuse', desc: 'Fits the fuse box in the cellar.' },
  locket:     { name: 'Silver Locket', kind: 'locket', desc: 'A child\'s portrait inside. It calms the dead, once.' },
  doll:       { name: 'Porcelain Doll', kind: 'junk', desc: 'Its eyes are painted shut. Throw it to make noise.' },
  coins:      { name: 'Old Coins', kind: 'junk', desc: 'A handful of tarnished coins. Throw them to make noise.' },
  note:       { name: 'Note', kind: 'note', desc: '' }
};

// --------------------------------------------------------------------------
// Meshes. Geometries and materials are cached and shared.
// --------------------------------------------------------------------------
const ItemFactory = {
  std(key, color, rough, metal, extra) {
    return Cache.mat('item:' + key, () => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {})));
  },
  create(id) {
    const def = ITEM_DEFS[id], g = new THREE.Group(), S = this;
    const M = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; g.add(m); return m; };
    if (def.kind === 'key') {
      const mat = S.std('key' + id, def.color, 0.3, 0.9, { emissive: def.color, emissiveIntensity: 0.12 });
      M(Cache.geo('torus.key', () => new THREE.TorusGeometry(0.06, 0.017, 8, 16)), mat, 0, 0.09, 0);
      M(Cache.geo('cyl.key', () => new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8)), mat, 0, -0.05, 0);
      M(Cache.geo('box.keytooth', () => new THREE.BoxGeometry(0.05, 0.022, 0.018)), mat, 0.03, -0.12, 0);
      M(Cache.geo('box.keytooth', () => new THREE.BoxGeometry(0.05, 0.022, 0.018)), mat, 0.025, -0.08, 0);
      g.userData.glow = 0x9cc8ff;
    } else if (def.kind === 'relic') {
      const bone = S.std('bone', 0xd8d4b0, 0.55, 0, { emissive: 0x1a6a2a, emissiveIntensity: 0.5 });
      const horn = S.std('horn', 0x15110b, 0.6, 0, { emissive: 0x0b2a12 });
      const eye = Cache.mat('item:eyeg', () => new THREE.MeshBasicMaterial({ color: 0x39ff7a }));
      const sk = M(Cache.geo('sph.skull', () => new THREE.SphereGeometry(0.16, 16, 12)), bone, 0, 0, 0); sk.scale.set(1, 1.05, 1.1);
      M(Cache.geo('box.jaw', () => new THREE.BoxGeometry(0.14, 0.07, 0.14)), bone, 0, -0.15, 0.02);
      const hg = Cache.geo('cone.horn', () => new THREE.ConeGeometry(0.04, 0.26, 8));
      M(hg, horn, -0.14, 0.15, 0, 0, 0, 0.7); M(hg, horn, 0.14, 0.15, 0, 0, 0, -0.7);
      const eg = Cache.geo('sph.eye', () => new THREE.SphereGeometry(0.03, 8, 8));
      M(eg, eye, -0.055, 0.01, 0.14); M(eg, eye, 0.055, 0.01, 0.14);
      g.userData.glow = 0x39ff7a;
    } else if (def.kind === 'battery') {
      M(Cache.geo('cyl.bat', () => new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12)), S.std('bat', 0x2a6a2a, 0.5, 0.4), 0, 0.06, 0);
      M(Cache.geo('cyl.batcap', () => new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8)), S.std('batcap', 0xc0c0c0, 0.3, 0.9), 0, 0.13, 0);
    } else if (def.kind === 'lighter') {
      M(Cache.geo('box.lighter', () => new THREE.BoxGeometry(0.04, 0.07, 0.015)), S.std('lighter', 0x9a8a60, 0.3, 0.9), 0, 0.035, 0);
    } else if (def.kind === 'crucifix') {
      const mat = S.std('cross', 0x2a2a30, 0.4, 0.85);
      M(Cache.geo('box.cross1', () => new THREE.BoxGeometry(0.03, 0.18, 0.02)), mat, 0, 0.09, 0);
      M(Cache.geo('box.cross2', () => new THREE.BoxGeometry(0.11, 0.03, 0.02)), mat, 0, 0.13, 0);
    } else if (def.kind === 'musicbox') {
      M(Cache.geo('box.mbox', () => new THREE.BoxGeometry(0.18, 0.09, 0.12)), S.std('mbox', 0x4a2a14, 0.5, 0.1), 0, 0.045, 0);
      M(Cache.geo('box.mlid', () => new THREE.BoxGeometry(0.18, 0.015, 0.12)), S.std('mlid', 0x6a3a1c, 0.5, 0.1), 0, 0.1, 0, -0.5, 0, 0);
    } else if (def.kind === 'mirror') {
      const sh = M(Cache.geo('cone.shard', () => new THREE.ConeGeometry(0.07, 0.2, 3)), S.std('shard', 0xb8c8d8, 0.05, 1, { emissive: 0x334455, emissiveIntensity: 0.4 }), 0, 0.1, 0);
      sh.scale.z = 0.25;
    } else if (def.kind === 'fuse') {
      M(Cache.geo('cyl.fuse', () => new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10)), S.std('fuse', 0xd8d0a0, 0.2, 0.1, { transparent: true, opacity: 0.8 }), 0, 0.05, 0);
      const cap = S.std('fcap', 0xb0a080, 0.3, 0.9), cg = Cache.geo('cyl.fcap', () => new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10));
      M(cg, cap, 0, 0.002, 0); M(cg, cap, 0, 0.1, 0);
    } else if (def.kind === 'locket') {
      M(Cache.geo('cyl.locket', () => new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16)), S.std('locket', 0xc8c8d0, 0.2, 0.95), 0, 0.01, 0, Math.PI / 2, 0, 0);
      M(Cache.geo('tor.chain', () => new THREE.TorusGeometry(0.06, 0.004, 4, 16)), S.std('chain', 0xc8c8d0, 0.2, 0.95), 0, 0.01, -0.07, Math.PI / 2, 0, 0);
    } else if (id === 'doll') {
      const porc = S.std('porc', 0xe8e0d4, 0.4, 0);
      M(Cache.geo('sph.doll', () => new THREE.SphereGeometry(0.05, 12, 10)), porc, 0, 0.17, 0);
      M(Cache.geo('cone.doll', () => new THREE.ConeGeometry(0.07, 0.16, 10)), S.std('dress', 0x5a2a3a, 0.9, 0), 0, 0.08, 0);
    } else if (id === 'coins') {
      const mat = S.std('coin', 0xa08a40, 0.3, 0.9), cg = Cache.geo('cyl.coin', () => new THREE.CylinderGeometry(0.025, 0.025, 0.006, 12));
      M(cg, mat, 0, 0.003, 0); M(cg, mat, 0.04, 0.003, 0.02, 0, 0.5, 0); M(cg, mat, -0.01, 0.009, 0.03);
    } else if (def.kind === 'note') {
      M(Cache.geo('box.note', () => new THREE.BoxGeometry(0.16, 0.004, 0.2)), S.std('paper', 0xcfc29a, 0.95, 0), 0, 0.002, 0, 0, 0.3, 0);
    }
    g.userData.itemId = id;
    return g;
  },

  // 64x64 canvas icon as data URL (cached per id)
  icon(id) {
    return Cache.tex('icon:' + id, () => {
      const def = ITEM_DEFS[id], c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.lineWidth = 3; x.lineCap = 'round'; x.lineJoin = 'round';
      const hex = '#' + ('000000' + (def.color || 0xcfc6b0).toString(16)).slice(-6);
      x.strokeStyle = hex; x.fillStyle = hex;
      if (def.kind === 'key') {
        x.beginPath(); x.arc(32, 16, 9, 0, 7); x.stroke(); x.beginPath(); x.moveTo(32, 25); x.lineTo(32, 56); x.moveTo(32, 44); x.lineTo(42, 44); x.moveTo(32, 52); x.lineTo(40, 52); x.stroke();
      } else if (def.kind === 'relic') {
        x.strokeStyle = '#d8d4b0'; x.beginPath(); x.arc(32, 34, 14, 0, 7); x.stroke(); x.beginPath(); x.moveTo(24, 22); x.lineTo(14, 8); x.moveTo(40, 22); x.lineTo(50, 8); x.stroke();
        x.fillStyle = '#39ff7a'; x.fillRect(24, 31, 5, 5); x.fillRect(35, 31, 5, 5); x.strokeStyle = '#d8d4b0'; x.strokeRect(26, 46, 12, 8);
      } else if (def.kind === 'battery') { x.strokeStyle = '#7ad07a'; x.strokeRect(22, 14, 20, 40); x.fillStyle = '#7ad07a'; x.fillRect(28, 8, 8, 6); x.fillRect(26, 34, 12, 16); }
      else if (def.kind === 'lighter') { x.strokeStyle = '#c8b070'; x.strokeRect(24, 28, 16, 28); x.fillStyle = '#ffae40'; x.beginPath(); x.ellipse(32, 18, 5, 9, 0, 0, 7); x.fill(); }
      else if (def.kind === 'crucifix') { x.strokeStyle = '#b0b0c0'; x.beginPath(); x.moveTo(32, 8); x.lineTo(32, 56); x.moveTo(18, 22); x.lineTo(46, 22); x.stroke(); }
      else if (def.kind === 'musicbox') { x.strokeStyle = '#a06a3a'; x.strokeRect(12, 28, 40, 24); x.beginPath(); x.moveTo(12, 28); x.lineTo(18, 14); x.lineTo(58, 14); x.lineTo(52, 28); x.stroke(); }
      else if (def.kind === 'mirror') { x.strokeStyle = '#b8c8d8'; x.beginPath(); x.moveTo(32, 6); x.lineTo(50, 52); x.lineTo(16, 44); x.closePath(); x.stroke(); }
      else if (def.kind === 'fuse') { x.strokeStyle = '#d8d0a0'; x.strokeRect(26, 14, 12, 36); x.fillStyle = '#b0a080'; x.fillRect(24, 10, 16, 6); x.fillRect(24, 48, 16, 6); }
      else if (def.kind === 'locket') { x.strokeStyle = '#c8c8d0'; x.beginPath(); x.arc(32, 38, 12, 0, 7); x.stroke(); x.beginPath(); x.arc(32, 22, 18, 3.6, 5.8); x.stroke(); }
      else if (id === 'doll') { x.strokeStyle = '#e8e0d4'; x.beginPath(); x.arc(32, 16, 8, 0, 7); x.stroke(); x.beginPath(); x.moveTo(32, 24); x.lineTo(20, 54); x.lineTo(44, 54); x.closePath(); x.stroke(); }
      else if (id === 'coins') { x.strokeStyle = '#a08a40'; [[24, 36], [40, 32], [32, 22]].forEach(p => { x.beginPath(); x.arc(p[0], p[1], 10, 0, 7); x.stroke(); }); }
      return c.toDataURL();
    });
  }
};

// --------------------------------------------------------------------------
// Inventory: add / remove / has / use / select with events.
// Notes go to the journal and do not take a slot.
// --------------------------------------------------------------------------
class Inventory extends Emitter {
  constructor(game) {
    super();
    this.game = game;
    this.size = CONFIG.inventorySlots;
    this.reset();
  }
  reset() {
    this.slots = new Array(this.size).fill(null);
    this.selected = 0;
    this.notes = [];
    this.uid = 1;
    this.emit('change');
  }
  get items() { return this.slots.filter(Boolean); }
  makeItem(id, extra) { return Object.assign({ id, def: ITEM_DEFS[id], uid: this.uid++, charges: ITEM_DEFS[id].charges || 0 }, extra || {}); }
  // Returns slot index, or -1 when full
  add(item) {
    if (item.def.kind === 'note') {
      this.notes.push(item); this.emit('note', item); this.emit('change'); return 0;
    }
    const i = this.slots.indexOf(null);
    if (i < 0) return -1;
    this.slots[i] = item;
    if (item.def.kind === 'key' || this.slots[this.selected] === null) this.selected = i;
    this.emit('add', item, i); this.emit('change');
    return i;
  }
  remove(i) {
    const it = this.slots[i];
    if (!it) return null;
    this.slots[i] = null;
    this.emit('remove', it, i); this.emit('change');
    return it;
  }
  removeItem(item) { return this.remove(this.slots.indexOf(item)); }
  has(id) { return this.slots.some(s => s && s.id === id); }
  hasKind(kind) { return this.slots.some(s => s && s.def.kind === kind); }
  get current() { return this.slots[this.selected]; }
  select(i) { if (i >= 0 && i < this.size) { this.selected = i; this.emit('select', i); this.emit('change'); } }
  keys() { return this.slots.filter(s => s && s.def.kind === 'key'); }
}

// --------------------------------------------------------------------------
// WorldItem: an item lying in the world (placed, dropped, thrown or hidden).
// The Interactable is attached by the World. Pickup plays lift, spin, shrink
// toward the camera, then the item lands in the inventory.
// --------------------------------------------------------------------------
class WorldItem {
  constructor(game, item, parent) {
    this.game = game; this.item = item;
    this.mesh = item.def.kind === 'note' || item.id === 'note' ? ItemFactory.create('note') : ItemFactory.create(item.id);
    this.parent = parent || null;
    this.light = null;
    this.picking = false;
    this.active = false;     // e.g. a wound music box
    this.vel = null;         // when thrown
    this.room = null;
    this.interactable = null;
    this.baseY = 0;
    this.bob = 0;
  }
  attach(parent, x, y, z) {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.parent = parent;
    parent.add(this.mesh);
    this.mesh.position.set(x, y, z);
    this.baseY = y;
    // Glow is a sprite, not a light: toggling lights would recompile shaders mid-game
    const g = this.mesh.userData.glow;
    if (g && !this.light) {
      const tex = Cache.tex('tex.glow', () => {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
        const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
      });
      this.light = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: g, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.light.scale.set(0.5, 0.5, 1); this.light.position.set(0, 0.1, 0);
      this.mesh.add(this.light);
    }
  }
  setVisible(v) { this.mesh.visible = v; }
  dispose() { if (this.mesh.parent) this.mesh.parent.remove(this.mesh); }

  pickUp() {
    const game = this.game;
    if (this.picking) return;
    const inv = game.inventory;
    if (this.item.def.kind !== 'note' && !inv.slots.includes(null)) { game.hud.toast('Your hands are full'); return; }
    this.picking = true;
    if (this.interactable) this.interactable.enabled = false;
    game.scene.attach(this.mesh);
    if (this.light) this.light.visible = false;
    const m = this.mesh, p0 = m.position.clone(), s0 = m.scale.x;
    const cam = game.camera;
    game.audio.pickup();
    game.makeNoise(cam.position.x, cam.position.z, game.currentRoom, CONFIG.loudness.pickup, 'pickup');
    game.tweens.add({ key: 'pick' + this.item.uid, dur: 0.22, ease: Ease.outCubic, update: v => { m.position.y = p0.y + 0.28 * v; m.rotation.y += 0.25; } });
    game.tweens.add({
      key: 'pickb' + this.item.uid, delay: 0.2, dur: 0.38, ease: Ease.inCubic,
      update: (v) => {
        const t = TMP.v1.set(0.18, -0.22, -0.55).applyQuaternion(cam.quaternion).add(cam.position);
        m.position.set(lerp(p0.x, t.x, v), lerp(p0.y + 0.28, t.y, v), lerp(p0.z, t.z, v));
        m.scale.setScalar(lerp(s0, 0.12, v)); m.rotation.y += 0.4;
      },
      done: () => {
        m.visible = false;
        if (m.parent) m.parent.remove(m);
        const it = this.item;
        const idx = inv.add(it);
        if (it.def.kind === 'note') game.hud.toast('Found a note'), game.hud.showNote(it);
        else if (idx >= 0) game.hud.toast('Picked up: ' + it.def.name);
        game.onItemPickedUp(this);
      }
    });
  }
}
