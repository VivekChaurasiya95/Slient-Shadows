'use strict';
// ==========================================================================
// DOORS: hinged slab on a pivot, eased swing with overshoot, creak by speed,
// locks (key / relic / barred), jam + rattle, live collider, doorway void.
// ==========================================================================
const SIDE_INFO = {
  // ry rotates the door group so local +Z points into the room
  W: { ry: Math.PI / 2,  n: [1, 0] },
  E: { ry: -Math.PI / 2, n: [-1, 0] },
  N: { ry: 0,            n: [0, 1] },
  S: { ry: Math.PI,      n: [0, -1] }
};

class Door extends Openable {
  constructor(game, room, def) {
    const info = SIDE_INFO[def.side];
    super(game, {
      id: def.id, room, reach: 3.3, slowOpen: true,
      prompt: () => this.promptText(),
      onInteract: i => this.interact(i),
      durOpen: 0.75, durClose: 0.55, easeOpen: Ease.outBack,
      apply: v => this.applyT(v),
      hooks: {
        opening: (slow, ghost) => this.onOpening(slow, ghost),
        closing: (slow, ghost) => this.onClosing(slow, ghost),
        closed: (slow, ghost) => this.onClosed(slow, ghost)
      }
    });
    this.def = def; this.roomObj = room;
    this.w = def.width || 1.0;
    this.H = def.kind === 'exit' ? 2.6 : def.kind === 'gate' ? 2.5 : 2.2;
    this.hinge = ((def.id.charCodeAt(0) + def.id.length) % 2) ? 1 : -1;
    this.ax = new THREE.Vector3(); this.nv = new THREE.Vector3();
    const b = room.bounds;
    const base = { N: [def.pos, b.minZ], S: [def.pos, b.maxZ], W: [b.minX, def.pos], E: [b.maxX, def.pos] }[def.side];
    this.bx = base[0]; this.bz = base[1];
    this.n = info.n;                                  // inward normal (x,z)
    this.ryaw = info.ry;
    this.lat = [Math.cos(info.ry), -Math.sin(info.ry)]; // local +X in world (x,z)
    this.rect = null;
    this.pair = null;
    this.openAngle = Math.PI * 0.5;
    this.autoCloseT = 0;
    this.lock = def.slot === 'exit' ? { type: 'relic' } : null;
    if (def.barred) this.lock = { type: 'barred' };
    this.build();
  }

  // Point in room coordinates from door-local coordinates
  toWorld(lx, lz) {
    return [this.bx + this.lat[0] * lx + this.n[0] * lz, this.bz + this.lat[1] * lx + this.n[1] * lz];
  }
  get approach() { return this.toWorld(0, 1.0); }      // where actors stand to use it
  get spawn() { return this.toWorld(0, 1.3); }

  build() {
    const g = this.group = new THREE.Group();
    g.position.set(this.bx, 0, this.bz);
    g.rotation.y = this.ryaw;
    const lab = this.game.world.lab, w = this.w, H = this.H, h = this.hinge, def = this.def;
    const frameMat = Cache.mat('door.frame', () => new THREE.MeshStandardMaterial({ color: 0x1a110b, roughness: 0.7 }));
    const post = Cache.geo('door.post' + H, () => new THREE.BoxGeometry(0.14, H + 0.2, 0.22));
    [-1, 1].forEach(s => { const m = new THREE.Mesh(post, frameMat); m.position.set(s * (w / 2 + 0.07), (H + 0.2) / 2, 0.1); m.castShadow = true; g.add(m); });
    const lint = new THREE.Mesh(Cache.geo('door.lintel' + w, () => new THREE.BoxGeometry(w + 0.28, 0.16, 0.22)), frameMat);
    lint.position.set(0, H + 0.08, 0.1); g.add(lint);

    // Doorway void: what you see when the door is open
    const voidMat = def.kind === 'fake'
      ? new THREE.MeshStandardMaterial({ map: lab.brick(), roughness: 1 })
      : Cache.mat('door.void', () => new THREE.MeshBasicMaterial({ color: 0x020202 }));
    const vm = new THREE.Mesh(Cache.geo('door.void' + w + H, () => new THREE.PlaneGeometry(w, H)), voidMat);
    vm.position.set(0, H / 2, 0.012); vm.userData.occ = true; g.add(vm);
    this.voidMesh = vm;
    if (def.kind !== 'fake') this.room.occluders.push(vm);

    // Pivot + slab
    this.pivot = new THREE.Group();
    this.pivot.position.set(h * w / 2, 0, 0.06);
    g.add(this.pivot);
    const slabGeo = Cache.geo('door.slab' + w + H, () => new THREE.BoxGeometry(w - 0.02, H, 0.08));
    if (def.kind === 'gate') {
      const bar = Cache.mat('door.bar', () => new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.45, metalness: 0.85 }));
      const sg = new THREE.Group(); sg.position.set(-h * w / 2, H / 2, 0);
      const slab = new THREE.Mesh(slabGeo, bar.clone()); slab.material.visible = false; sg.add(slab); this.slab = slab;
      const cg = Cache.geo('door.bargeo' + H, () => new THREE.CylinderGeometry(0.022, 0.022, H, 6));
      for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(cg, bar); c.position.x = -w / 2 + 0.1 + i * ((w - 0.2) / 8); c.castShadow = true; sg.add(c); }
      const rg = Cache.geo('door.rail' + w, () => new THREE.BoxGeometry(w - 0.02, 0.06, 0.05));
      [0.12, H / 2, H - 0.12].forEach(y => { const r = new THREE.Mesh(rg, bar); r.position.y = y - H / 2; sg.add(r); });
      this.pivot.add(sg);
    } else {
      const mat = new THREE.MeshStandardMaterial({ map: lab.door(), roughness: 0.75, color: def.kind === 'exit' ? 0x8a7a6a : 0xffffff });
      const slab = new THREE.Mesh(slabGeo, mat);
      slab.position.set(-h * w / 2, H / 2, 0); slab.castShadow = slab.receiveShadow = true;
      this.pivot.add(slab); this.slab = slab;
      const kg = Cache.geo('door.knob', () => new THREE.SphereGeometry(0.045, 10, 8)), km = Cache.mat('door.brass', () => new THREE.MeshStandardMaterial({ color: 0xb08a45, roughness: 0.3, metalness: 0.9 }));
      [-1, 1].forEach(s => { const k = new THREE.Mesh(kg, km); k.position.set(-h * (w - 0.14), 1.05, s * 0.07); k.position.x = -h * w / 2 - h * (w / 2 - 0.12); this.pivot.add(k); });
    }
    this.pivot.userData.slab = this.slab;
    this.addMesh(this.slab);
    this.slab.userData.ia = this;

    // Lock visuals
    this.lockGroup = new THREE.Group(); this.lockGroup.position.set(-h * w / 2 - h * (w / 2 - 0.1), 1.05, 0.09);
    this.pivot.add(this.lockGroup);
    this.buildLockVisual();
    this.room.group.add(g);
    this.room.doors.push(this);
  }

  buildLockVisual() {
    while (this.lockGroup.children.length) this.lockGroup.remove(this.lockGroup.children[0]);
    const iron = Cache.mat('door.iron', () => new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.9 }));
    const L = this.lock, def = this.def, add = m => { m.castShadow = true; this.lockGroup.add(m); return m; };
    if (!L) return;
    if (L.type === 'key') {
      add(new THREE.Mesh(Cache.geo('lock.body', () => new THREE.BoxGeometry(0.1, 0.12, 0.04)), iron));
      const sh = add(new THREE.Mesh(Cache.geo('lock.shackle', () => new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI)), iron)); sh.position.y = 0.07;
    } else if (L.type === 'relic') {
      const gg = Cache.geo('lock.link', () => new THREE.TorusGeometry(0.05, 0.014, 6, 10));
      // three sagging chains across the slab, centred on it
      this.lockGroup.position.set(-this.hinge * this.w / 2, 1.3, 0.08);
      const n = Math.round(this.w / 0.115);
      for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) {
        const l = new THREE.Mesh(gg, iron);
        l.position.set((i - (n - 1) / 2) * 0.115, (k - 1) * 0.6 - Math.sin((i / (n - 1)) * Math.PI) * 0.08, 0);
        l.rotation.y = i % 2 ? Math.PI / 2 : 0; l.castShadow = true; this.lockGroup.add(l);
      }
      add(new THREE.Mesh(Cache.geo('lock.body', () => new THREE.BoxGeometry(0.14, 0.16, 0.05)), iron)).position.set(0, 0, 0.02);
    } else if (L.type === 'barred') {
      const bm = add(new THREE.Mesh(Cache.geo('lock.beam', () => new THREE.BoxGeometry(this.w * 1.15, 0.12, 0.06)), Cache.mat('lock.beamm', () => new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.9 }))));
      bm.position.set(this.hinge * (this.w / 2 - 0.1), 0.05, 0.03);
    }
  }

  applyT(t) {
    this.pivot.rotation.y = this.hinge * t * this.openAngle;
    // live collider from the swung slab
    if (t < 0.04) { this.rect = null; return; }
    const th = t * this.openAngle, w = this.w;
    const a = this.toWorld(this.hinge * w / 2, 0.06);
    const b = this.toWorld(this.hinge * w / 2 - this.hinge * w * Math.cos(th), 0.06 + w * Math.sin(th));
    this.rect = [Math.min(a[0], b[0]) - 0.06, Math.max(a[0], b[0]) + 0.06, Math.min(a[1], b[1]) - 0.06, Math.max(a[1], b[1]) + 0.06];
  }

  // ---- text ---------------------------------------------------------------
  promptText() {
    const sel = this.game.inventory.current, st = this.state;
    if (this.def.kind === 'fake') return this.isOpen ? 'Close door' : 'Open door';
    if (this.lock && this.st === 'closed') {
      if (this.lock.type === 'barred') return 'Barred from the other side';
      if (this.lock.type === 'relic') return 'Sealed, needs the skull';
      if (sel && sel.def.kind === 'key') return T('Unlock with {item}', { item: T(sel.def.name) });
      return 'Locked, needs a key';
    }
    if (st === 'jammed') return 'It will not budge';
    return this.isOpen ? 'Close door' : 'Open door';
  }

  interact(info) {
    const g = this.game, pos = { x: this.bx, y: 1.2, z: this.bz };
    if (this.def.kind === 'fake' || !this.lock) {
      if (this.jamT > 0 && !this.isOpen) { g.audio.rattle(pos); g.hud.toast('The door will not budge'); g.fear.add(2); return; }
      this.toggle(info.slow);
      return;
    }
    if (this.st !== 'closed') { this.toggle(info.slow); return; }
    const L = this.lock;
    if (L.type === 'barred') { g.audio.rattle(pos); g.hud.toast('Barred from the other side'); g.makeNoise(this.bx, this.bz, this.room.id, 0.35, 'rattle'); return; }
    if (L.type === 'relic') {
      if (g.hasRelic) { this.unlock(); this.open(false); g.onExitOpened(this); }
      else { g.audio.rattle(pos); g.hud.toast('The chains will not give. Something is missing'); }
      return;
    }
    // key lock: the selected key, else any key that fits
    const keys = g.inventory.keys();
    if (this.def.id === 'c_crypt') g.story.onGateLocked();
    if (!keys.length) { g.audio.rattle(pos); g.hud.toast('Locked. You need a key'); g.makeNoise(this.bx, this.bz, this.room.id, 0.3, 'rattle'); return; }
    const sel = g.inventory.current;
    let key = sel && sel.def.kind === 'key' ? sel : null;
    if (key && key.def.keyId !== L.keyId) { g.audio.rattle(pos); g.hud.toast(T('The {item} doesn\'t fit', { item: lc(T(key.def.name)) })); return; }
    if (!key) key = keys.find(k => k.def.keyId === L.keyId);
    if (!key) { g.audio.rattle(pos); g.hud.toast('None of your keys fit'); return; }
    this.unlock(); g.audio.unlock(pos);
    g.hud.toast('Unlocked');
    g.onDoorUnlocked(this, key);
    this.open(false);
  }

  unlock() {
    this.lock = null; this.buildLockVisual();
    if (this.pair) { this.pair.lock = null; this.pair.buildLockVisual(); }
  }

  // ---- sound hooks --------------------------------------------------------
  onOpening(slow, ghost) {
    const g = this.game, speed = slow ? 0.05 : 0.9, pos = { x: this.bx, y: 1.2, z: this.bz };
    g.audio.doorOpen(ghost ? 0.5 : speed, pos);
    const loud = ghost ? 0.2 : (slow ? CONFIG.loudness.doorSlow : CONFIG.loudness.doorFast);
    g.makeNoise(this.bx, this.bz, this.room.id, loud, 'door', ghost);
  }
  onClosing(slow, ghost) {}
  onClosed(slow, ghost) {
    const g = this.game, quiet = slow ? 0.25 : 1;
    if (this.room.visible) g.audio.doorClose(quiet, { x: this.bx, y: 1.2, z: this.bz });
    if (!slow) g.makeNoise(this.bx, this.bz, this.room.id, 0.3, 'door', ghost);
  }
  slam(power) {
    this.snapQuick(false);
    this.game.audio.doorSlam({ x: this.bx, y: 1.2, z: this.bz });
    this.game.makeNoise(this.bx, this.bz, this.room.id, 0.2, 'door', true);
  }
  snapQuick(open) {
    this.st = open ? 'open' : 'closed';
    this.game.tweens.cancel('op:' + this.id);
    this.game.tweens.add({ key: 'op:' + this.id, dur: 0.14, from: this.t, to: open ? 1 : 0, ease: Ease.inQuad, update: v => this.setT(v) });
  }

  // ---- per frame ----------------------------------------------------------
  update(dt) {
    this.tick(dt);
    const g = this.game;
    if (!this.room.visible) return;
    const p = g.camera.position;
    const dx = p.x - this.bx, dz = p.z - this.bz;
    const lat = dx * this.lat[0] + dz * this.lat[1], depth = dx * this.n[0] + dz * this.n[1];
    // walk through an open doorway
    if (this.st === 'open' && this.t > 0.55 && this.def.to && this.def.kind !== 'fake' && !g.transitioning && !g.hiding.active) {
      if (Math.abs(lat) < this.w / 2 + 0.05 && depth < 0.8) { g.useDoor(this); return; }
    }
    // doors you came through close softly behind you
    if (this.autoClose && this.st === 'open') {
      if (depth > 2.3 || Math.abs(lat) > 2.0) { this.autoClose = false; this.close(true); }
    }
  }
}
