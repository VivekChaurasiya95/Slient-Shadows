'use strict';
// ==========================================================================
// MISSIONS: the connected task chain and its puzzles.
//   1 Restore the electricity  find the fuse, open the cellar, install it
//   2 Kitchen maintenance locker  nailed shut, crowbar; inside: the third clue + kitchen wiring
//   3 Into the crypt  three clues -> library strongbox dials (electric bolt) -> crypt key -> gate
//   4 Break the seal  three offerings on the altar, press the symbol stones in the marked order
//   5 Survive  she comes for you the moment the seal breaks
//   6 Take the Horned Skull, then escape (existing chase and exit)
// Every step is read from real game state, so objectives can never show something that is
// already done or that cannot be done yet. Puzzle fixtures are built with the world.
// ==========================================================================
const GLYPH_NAMES = { moon: 'Moon', eye: 'Eye', horn: 'Horn' };
const ROMAN = ['I', 'II', 'III'];

const MissionArt = {
  // chalk glyph on a dark stone face (altar buttons) or scratched into plaster (door marks)
  glyph(kind, mode) {
    return Cache.tex('tex.glyph:' + kind + ':' + mode, () => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      if (mode === 'stone') { g.fillStyle = '#2e3134'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.3 + ')'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } }
      g.strokeStyle = mode === 'stone' ? 'rgba(206,214,200,0.92)' : 'rgba(120,14,12,0.9)'; g.fillStyle = g.strokeStyle; g.lineWidth = 7; g.lineCap = 'round';
      const cy = mode === 'wall' ? 50 : 64;
      if (kind === 'moon') { g.beginPath(); g.arc(64, cy, 30, Math.PI * 0.35, Math.PI * 1.65); g.arc(78, cy, 24, Math.PI * 1.5, Math.PI * 0.5, true); g.closePath(); g.stroke(); }
      else if (kind === 'eye') { g.beginPath(); g.moveTo(22, cy); g.quadraticCurveTo(64, cy - 40, 106, cy); g.quadraticCurveTo(64, cy + 40, 22, cy); g.stroke(); g.beginPath(); g.arc(64, cy, 11, 0, 7); g.fill(); }
      else { g.beginPath(); g.moveTo(40, cy + 30); g.bezierCurveTo(36, cy - 6, 58, cy - 26, 92, cy - 34); g.bezierCurveTo(70, cy - 14, 62, cy + 6, 62, cy + 30); g.stroke(); }
      return new THREE.CanvasTexture(c);
    });
  },
  mark(kind, n) {
    return Cache.tex('tex.mark:' + kind + ':' + n, () => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.drawImage(this.glyph(kind, 'wall').image, 0, 0);
      g.fillStyle = 'rgba(120,14,12,0.9)'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText(ROMAN[n - 1], 64, 116);
      for (let i = 0; i < 5; i++) { g.fillRect(40 + Math.random() * 48, 70 + Math.random() * 10, 2, 8 + Math.random() * 18); }
      const t = new THREE.CanvasTexture(c); return t;
    });
  }
};

class MissionSystem {
  constructor(game) { this.game = game; this.reset(); }
  reset() {
    this.primed = false;
    this.safe = null; this.locker = null; this.altar = null; this.marks = [];
    this.code = [1, 1, 1]; this.symbols = [];
    this.marksSeen = new Set(); this.cluesFound = new Set(); this.fuseSeen = false;
    this.ritualDone = false; this.encounter = null; this.survived = false;
    this.done = {}; this.lastObj = null; this.pressed = [];
  }

  // ---- build: called by World.build, after spots ------------------------------------------------
  build(world, layout) {
    const keep = { safe: this.safe };
    this.reset(); this.safe = keep.safe;          // the strongbox is built by buildSpot just before this
    this.code = layout.code || [1, 1, 1]; this.symbols = layout.symbols || [];
    this.layout = layout;
    this.buildLocker(world, world.rooms.kitchen, layout.lockerNote);
    this.buildAltar(world, world.rooms.crypt);
    this.symbols.forEach(s => this.buildMark(world, world.rooms[s.room], s));
  }

  // ---- the library strongbox: three dials, an electric bolt, the crypt key inside -----------------
  buildSafe(world, room, spot, def, desc, grp) {
    const g = this.game, w = def.w, h = def.h, d = def.d;
    const iron = world.mat(0x2c3a30, 0.55, 0.7), dark = world.mat(0x141614, 0.5, 0.6), brass = world.mat(0x9a7a3a, 0.35, 0.9);
    // hollow iron box (back, sides, top, floor) so the key is visible inside when the door swings
    const t = 0.05, P = (gw, gh, gd, x, y, z) => { const m = new THREE.Mesh(Cache.geo('box:' + gw + ',' + gh + ',' + gd, () => new THREE.BoxGeometry(gw, gh, gd)), iron); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
    const body = P(w, h, t, 0, h / 2, -d / 2 + t / 2); body.userData.occ = true; room.occluders.push(body);
    P(t, h, d, -w / 2 + t / 2, h / 2, 0); P(t, h, d, w / 2 - t / 2, h / 2, 0); P(w, t, d, 0, h - t / 2, 0); P(w, t, d, 0, 0.08 + t / 2, 0);
    const shelfIn = new THREE.Mesh(Cache.geo('box:safe.in', () => new THREE.BoxGeometry(w - 0.1, 0.02, d - 0.1)), world.mat(0x3a2a1a, 0.9)); shelfIn.position.set(0, 0.4, 0); grp.add(shelfIn);
    const plinth = new THREE.Mesh(Cache.geo('box:safe.plinth', () => new THREE.BoxGeometry(w + 0.06, 0.06, d + 0.06)), dark); plinth.position.y = 0.03; grp.add(plinth);
    world.addCollider(room, def.x, def.z, Math.abs(Math.cos(def.ry)) * w / 2 + Math.abs(Math.sin(def.ry)) * d / 2 + 0.02, Math.abs(Math.sin(def.ry)) * w / 2 + Math.abs(Math.cos(def.ry)) * d / 2 + 0.02);
    // door on the front, hinged on the left
    const hinge = new THREE.Group(); hinge.position.set(-w / 2 + 0.04, 0, d / 2 + 0.005); grp.add(hinge);
    const door = new THREE.Mesh(Cache.geo('box:safe.door', () => new THREE.BoxGeometry(w - 0.1, h - 0.12, 0.05)), world.mat(0x34473a, 0.5, 0.75)); door.position.set((w - 0.1) / 2 + 0.01, h / 2, 0.025); hinge.add(door);
    const handle = new THREE.Mesh(Cache.geo('safe.handle', () => new THREE.TorusGeometry(0.05, 0.008, 6, 14)), brass); handle.position.set(w - 0.22, h * 0.42, 0.06); hinge.add(handle);
    // painted name plate, the bolt lamp (red: no power, amber: power, green: open)
    const plate = new THREE.Mesh(Cache.geo('box:safe.plate', () => new THREE.BoxGeometry(0.3, 0.06, 0.01)), brass); plate.position.set((w - 0.1) / 2, h * 0.84, 0.055); hinge.add(plate);
    const lampM = new THREE.MeshBasicMaterial({ color: 0x6a1410 });
    const lamp = new THREE.Mesh(Cache.geo('safe.lamp', () => new THREE.SphereGeometry(0.016, 8, 8)), lampM); lamp.position.set(w - 0.2, h * 0.84, 0.06); hinge.add(lamp);
    const dials = [];
    for (let i = 0; i < 3; i++) {
      const dg = new THREE.Group(); dg.position.set(0.14 + i * 0.16, h * 0.64, 0.06); hinge.add(dg);
      const knob = new THREE.Mesh(Cache.geo('safe.dial', () => new THREE.CylinderGeometry(0.05, 0.055, 0.03, 18)), world.mat(0x1c1c1c, 0.4, 0.8)); knob.rotation.x = Math.PI / 2; dg.add(knob);
      const tick = new THREE.Mesh(Cache.geo('safe.tick', () => new THREE.BoxGeometry(0.008, 0.03, 0.01)), brass); tick.position.set(0, 0.03, 0.018); dg.add(tick);
      const ring = new THREE.Mesh(Cache.geo('safe.ring', () => new THREE.TorusGeometry(0.062, 0.004, 4, 20)), brass); ring.position.z = 0.012; dg.add(ring);
      const hit = new THREE.Mesh(Cache.geo('safe.hit', () => new THREE.BoxGeometry(0.15, 0.15, 0.08)), Cache.mat('hit.mat', () => new THREE.MeshBasicMaterial({ visible: false }))); hit.position.z = 0.02; dg.add(hit);
      const state = { i, v: 1, group: dg };
      state.ia = new Interactable(g, {
        id: 'safe:dial' + i, room, meshes: [hit, knob], reach: 2.4,
        prompt: () => (this.safe.open ? 'The strongbox is open' : T('Dial {n} shows {d}. Turn it', { n: i + 1, d: state.v })),
        onInteract: () => this.turnDial(state)
      });
      dials.push(state);
    }
    const wi = makeSpotItem(world, room, spot, desc, grp, 0, 0.43, 0.05);
    if (wi) setItemHidden(wi, true);
    this.safe = { spot, hinge, lampM, dials, wi, open: false, solved: false, room };
    spot.ia = new Interactable(g, {
      id: 'spot:' + def.id, room, meshes: [door, plate], reach: 2.6,
      prompt: () => (this.safe.open ? 'The strongbox is open' : this.safe.solved ? 'The bolt is waiting for power' : 'Hollow strongbox. Three dials and an electric bolt'),
      onInteract: () => { if (!this.safe.open) { g.audio.rattle(this.safePos()); g.hud.toast(this.safe.solved ? 'The bolt has no power. Restore the electricity' : 'Locked. Three dials, numbers one to nine'); } }
    });
    return spot;
  }
  safePos() { const d = this.safe.spot.def; return { x: d.x, y: 0.7, z: d.z }; }
  turnDial(st) {
    const g = this.game, s = this.safe; if (s.open) return;
    st.v = st.v % 9 + 1;
    g.tweens.add({ key: 'dial' + st.i, dur: 0.18, from: st.group.rotation.z, to: -(st.v - 1) / 9 * Math.PI * 2, update: v => { st.group.rotation.z = v; } });
    g.audio.dialClick(this.safePos()); g.makeNoise(s.spot.def.x, s.spot.def.z, s.room.id, 0.03, 'dial');
    const ok = s.dials.every((d, i) => d.v === this.code[i]);
    if (ok && !s.solved) {
      s.solved = true;
      if (g.power.powered('library')) this.openSafe();
      else { g.audio.buzz(this.safePos(), 0.5); g.hud.toast('The dials click home, but the bolt has no power'); g.story.onSafeNoPower(); }
    } else if (!ok) s.solved = false;
  }
  openSafe() {
    const g = this.game, s = this.safe; if (s.open) return;
    s.open = true; s.lampM.color.setHex(0x30ff60);
    g.audio.boltOpen(this.safePos()); g.tweens.after(0.35, () => g.audio.lid(this.safePos()));
    g.tweens.add({ dur: 1.1, delay: 0.3, ease: Ease.outCubic, update: v => { s.hinge.rotation.y = -v * 1.7; } });
    if (s.wi) g.tweens.after(0.6, () => revealItem(g.world, s.wi));
    s.spot.opened = true;
    g.hud.toast('The bolt slams back. The strongbox swings open');
    g.story.onSafeOpen();
  }

  // ---- kitchen maintenance locker: boarded shut, crowbar ------------------------------------------
  buildLocker(world, room, note) {
    if (!room) return;
    const g = this.game, x = 4.72, z = -4.3, w = 0.9, h = 1.9, d = 0.46;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = -Math.PI / 2; room.group.add(grp);
    const sheet = world.mat(0x4a5048, 0.55, 0.6), dark = world.mat(0x121412, 0.6, 0.4), wood = world.mat(0x4a3420, 0.9);
    const back = new THREE.Mesh(Cache.geo('box:lk.back', () => new THREE.BoxGeometry(w, h, 0.03)), sheet); back.position.set(0, h / 2, -d / 2); grp.add(back);
    [-1, 1].forEach(s => { const m = new THREE.Mesh(Cache.geo('box:lk.side', () => new THREE.BoxGeometry(0.03, h, d)), sheet); m.position.set(s * (w / 2 - 0.015), h / 2, 0); m.castShadow = true; grp.add(m); });
    [0.015, h - 0.015].forEach(y => { const m = new THREE.Mesh(Cache.geo('box:lk.cap', () => new THREE.BoxGeometry(w, 0.03, d)), sheet); m.position.set(0, y, 0); grp.add(m); });
    const shelf = new THREE.Mesh(Cache.geo('box:lk.shelf', () => new THREE.BoxGeometry(w - 0.06, 0.02, d - 0.04)), sheet); shelf.position.set(0, 1.05, 0); grp.add(shelf);
    world.addCollider(room, x, z, d / 2 + 0.02, w / 2 + 0.02);
    // the junction box with its burnt wiring, mounted on the back wall
    const jb = new THREE.Mesh(Cache.geo('box:lk.jb', () => new THREE.BoxGeometry(0.34, 0.3, 0.1)), world.mat(0x6a6a5a, 0.5, 0.5)); jb.position.set(0, 1.45, -d / 2 + 0.07); grp.add(jb);
    const wires = [];
    [[-0.09, 0xa02a1a], [0, 0x1a1a1a], [0.09, 0x2a6a3a]].forEach(p => { const wm = new THREE.Mesh(Cache.geo('lk.wire', () => new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5)), new THREE.MeshStandardMaterial({ color: p[1], roughness: 0.6 })); wm.position.set(p[0], 1.18, -d / 2 + 0.08); wm.rotation.z = (Math.random() - 0.5) * 0.9; grp.add(wm); wires.push(wm); });
    const sparkM = new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 });
    const spark = new THREE.Mesh(Cache.geo('lk.spark', () => new THREE.SphereGeometry(0.02, 6, 6)), sparkM); spark.position.set(0.05, 1.32, -d / 2 + 0.12); grp.add(spark);
    // the door, and the boards nailed across it
    const hinge = new THREE.Group(); hinge.position.set(-w / 2, 0, d / 2); grp.add(hinge);
    const door = new THREE.Mesh(Cache.geo('box:lk.door', () => new THREE.BoxGeometry(w, h - 0.02, 0.025)), world.mat(0x565c52, 0.5, 0.6)); door.position.set(w / 2, h / 2, 0.012); door.castShadow = true; hinge.add(door);
    const vents = new THREE.Mesh(Cache.geo('box:lk.vent', () => new THREE.BoxGeometry(0.4, 0.12, 0.005)), dark); vents.position.set(w / 2, h * 0.82, 0.027); hinge.add(vents);
    const lbl = new THREE.Mesh(Cache.geo('box:lk.lbl', () => new THREE.BoxGeometry(0.22, 0.08, 0.004)), world.mat(0xb8a868, 0.8)); lbl.position.set(w / 2, h * 0.66, 0.027); hinge.add(lbl);
    const boards = [];
    [[1.35, 0.25], [0.95, -0.2], [0.55, 0.15]].forEach((b, i) => {
      const m = new THREE.Mesh(Cache.geo('box:lk.board', () => new THREE.BoxGeometry(w + 0.24, 0.12, 0.035)), wood); m.position.set(0, b[0], d / 2 + 0.045); m.rotation.z = b[1]; m.castShadow = true; grp.add(m); boards.push(m);
    });
    const L = this.locker = { grp, hinge, door, boards, wires, sparkM, room, nailed: true, open: false, fixed: false, x, z, sparkT: 2 };
    // clue on the shelf
    const pseudo = { def: { id: 'kitchen_locker', x, z }, room, items: [], opened: false };
    L.wi = note ? makeSpotItem(world, room, pseudo, note, grp, 0.1, 1.07, 0.02) : null;
    if (L.wi) setItemHidden(L.wi, true);
    L.boardIa = new Interactable(g, {
      id: 'locker:boards', room, meshes: boards.concat([door]), reach: 2.6, holdTime: 1.1,
      prompt: () => (L.nailed ? (g.inventory.has('crowbar') ? 'Pry the boards off (hold)' : 'Maintenance locker. Nailed shut') : L.open ? 'Close the locker' : 'Open the maintenance locker'),
      onInteract: () => {
        if (L.nailed) { if (g.inventory.has('crowbar')) this.pryLocker(); else { g.audio.rattle({ x, y: 1.2, z }); g.hud.toast('The boards are nailed tight. You need a crowbar'); } return; }
        this.toggleLocker();
      }
    });
    L.jbIa = new Interactable(g, {
      id: 'locker:junction', room, meshes: [jb].concat(wires), reach: 2.4,
      prompt: () => (L.fixed ? 'The wiring is repaired' : 'Repair the burnt wiring'),
      onInteract: () => { if (!L.fixed) { L.fixed = true; g.power.repairKitchen(); wires.forEach(wm => { wm.rotation.z = 0; }); sparkM.opacity = 0; } }
    });
    L.jbIa.enabled = false;
    room.updaters.push(dt => {
      // a dying spark behind the boards tells you the wiring is in there
      if (L.fixed) return; L.sparkT -= dt;
      if (L.sparkT <= 0) { L.sparkT = 3 + Math.random() * 5; sparkM.opacity = 1; if (g.currentRoom === 'kitchen' && dist2D(g.camera.position.x, g.camera.position.z, x, z) < 7) g.audio.spark({ x, y: 1.3, z }); }
      sparkM.opacity = Math.max(0, sparkM.opacity - dt * 6);
    });
  }
  pryLocker() {
    const g = this.game, L = this.locker; if (!L.nailed) return;
    L.nailed = false;
    g.audio.crowbarPry({ x: L.x, y: 1.2, z: L.z }); g.makeNoise(L.x, L.z, 'kitchen', 0.5, 'pry'); g.cameraShake(0.15);
    L.boards.forEach((b, i) => {
      const y0 = b.position.y, r0 = b.rotation.z, dir = i % 2 ? -1 : 1;
      g.tweens.add({ delay: i * 0.18, dur: 0.6, ease: Ease.inQuad, update: v => { b.position.y = y0 - v * (y0 - 0.03); b.position.z += 0.004; b.rotation.z = r0 + dir * v * 1.2; }, done: () => { g.audio.land(0.5, { x: L.x, y: 0.1, z: L.z }); } });
    });
    g.tweens.after(0.9, () => { L.boards.forEach(b => { b.visible = false; }); this.toggleLocker(); g.story.onLocker(); });
    g.hud.toast('The boards come away with a shriek of nails');
  }
  toggleLocker() {
    const g = this.game, L = this.locker; L.open = !L.open;
    g.audio.lid({ x: L.x, y: 1.0, z: L.z });
    const from = L.hinge.rotation.y, to = L.open ? -1.75 : 0;
    g.tweens.add({ key: 'lockerdoor', dur: 0.6, ease: Ease.outCubic, from, to, update: v => { L.hinge.rotation.y = v; } });
    if (L.open) { if (L.wi && !L.wi.picking) setItemHidden(L.wi, false); L.jbIa.enabled = true; }
    else { if (L.wi && L.wi.mesh.parent === L.grp) setItemHidden(L.wi, true); L.jbIa.enabled = false; }
  }

  // ---- the crypt altar: three offering bowls and three symbol stones ------------------------------
  buildAltar(world, room) {
    if (!room) return;
    const g = this.game, st = world.mat(0x2c3034, 0.95), A = this.altar = { room, bowls: [], stones: [], placed: 0, sealM: null };
    [[-0.8, -5.3], [0.8, -5.3], [0, -5.98]].forEach((p, i) => {
      const bowl = new THREE.Mesh(Cache.geo('alt.bowl', () => new THREE.CylinderGeometry(0.11, 0.075, 0.06, 14)), st); bowl.position.set(p[0], 1.15, p[1]); room.group.add(bowl);
      const holder = new THREE.Group(); holder.position.set(p[0], 1.18, p[1]); room.group.add(holder);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.game.power.glow(), color: 0xa070ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.set(0.5, 0.5, 1); glow.position.set(p[0], 1.28, p[1]); room.group.add(glow);
      const hit = new THREE.Mesh(Cache.geo('alt.hit', () => new THREE.CylinderGeometry(0.16, 0.16, 0.25, 8)), Cache.mat('hit.mat', () => new THREE.MeshBasicMaterial({ visible: false }))); hit.position.set(p[0], 1.22, p[1]); room.group.add(hit);
      const b = { i, bowl, holder, glow, item: null };
      b.ia = new Interactable(g, {
        id: 'altar:bowl' + i, room, meshes: [hit, bowl], reach: 2.4,
        prompt: () => { if (b.item) return T('The {item} rests here', { item: lc(T(b.item.def.name)) }); const it = this.offeringInHand(); return it ? T('Place the {item}', { item: lc(T(it.def.name)) }) : 'An empty stone bowl'; },
        onInteract: () => this.placeOffering(b)
      });
      A.bowls.push(b);
    });
    // the stones on the altar's face: always Moon, Eye, Horn from left to right
    ['moon', 'eye', 'horn'].forEach((glyph, i) => {
      const m = new THREE.Mesh(Cache.geo('box:alt.stone', () => new THREE.BoxGeometry(0.3, 0.3, 0.05)), new THREE.MeshStandardMaterial({ map: MissionArt.glyph(glyph, 'stone'), roughness: 0.9, emissive: 0x6a40c0, emissiveIntensity: 0 }));
      m.position.set(-0.56 + i * 0.56, 0.68, -5.08); room.group.add(m);
      const s = { glyph, mesh: m, z0: m.position.z };
      s.ia = new Interactable(g, {
        id: 'altar:stone' + glyph, room, meshes: [m], reach: 2.4,
        prompt: () => (this.ritualDone ? 'The stone is cold' : T('Press the {glyph} stone', { glyph: lc(T(GLYPH_NAMES[glyph])) })),
        onInteract: () => this.pressStone(s)
      });
      A.stones.push(s);
    });
    // the seal: a faint ring of light on the altar top that dies when it is broken
    A.sealM = new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(Cache.geo('alt.seal', () => new THREE.RingGeometry(0.42, 0.5, 40)), A.sealM); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 1.125, -5.6); room.group.add(ring);
    room.updaters.push((dt, t) => { if (!this.ritualDone) A.sealM.opacity = 0.22 + Math.sin(t * 2.2) * 0.1; });
  }
  offeringInHand() { const inv = this.game.inventory, cur = inv.current; return cur && cur.def.kind === 'ritual' ? cur : inv.slots.find(s => s && s.def.kind === 'ritual'); }
  placeOffering(b) {
    const g = this.game; if (b.item) return;
    const it = this.offeringInHand();
    if (!it) { g.hud.toast('It wants an offering. Black wax, grave salt, something of hers'); return; }
    g.inventory.removeItem(it); b.item = it;
    const m = ItemFactory.create(it.id); m.scale.setScalar(0.9); b.holder.add(m);
    g.audio.ritualPlace({ x: b.bowl.position.x, y: 1.2, z: b.bowl.position.z }); b.glow.material.opacity = 0.6;
    this.altar.placed++;
    g.hud.toast(T('Offering placed ({n} of 3)', { n: this.altar.placed }));
    if (this.altar.placed === 3) { g.flickerLights(1.0); g.audio.whisper(null, 0.5); g.hud.toast('The stones on the altar wake. Press them in the right order'); this.altar.stones.forEach(s => { s.mesh.material.emissiveIntensity = 0.35; }); }
  }
  pressStone(s) {
    const g = this.game, A = this.altar; if (this.ritualDone) return;
    g.tweens.add({ dur: 0.25, update: v => { s.mesh.position.z = s.z0 - Math.sin(v * Math.PI) * 0.03; } });
    g.audio.stoneClick({ x: s.mesh.position.x, y: 0.7, z: -5.1 });
    if (A.placed < 3) { g.hud.toast('The stone will not move. The altar wants its offerings first'); return; }
    if (this.pressed.includes(s.glyph)) return;
    this.pressed.push(s.glyph); s.mesh.material.emissiveIntensity = 1.2;
    const want = this.symbols.map(x => x.glyph);
    if (want[this.pressed.length - 1] !== s.glyph) {
      // wrong: the stones go dark and something heard it
      this.pressed = [];
      g.tweens.after(0.3, () => { A.stones.forEach(x => { x.mesh.material.emissiveIntensity = 0.35; }); });
      g.audio.ritualFail(); g.audio.whisper(null, 0.7); g.fear.add(10); g.cameraShake(0.2);
      g.makeNoise(0, -5.1, 'crypt', 0.75, 'ritual');
      g.hud.toast('Wrong order. The stones go dark'); g.story.onRitualFail();
      return;
    }
    if (this.pressed.length === 3) this.completeRitual();
  }
  completeRitual() {
    const g = this.game, A = this.altar;
    this.ritualDone = true; A.sealM.opacity = 0;
    g.audio.ritualDone(); g.cameraShake(0.45); g.screenFX.glitch(0.6); g.flickerLights(2.2);
    A.bowls.forEach(b => { g.tweens.add({ dur: 1.2, update: v => { b.glow.material.opacity = 0.6 + v * 0.4; }, done: () => { b.glow.material.opacity = 0; } }); });
    g.hud.alert('The seal is broken'); g.story.onRitual();
    // she comes the moment the seal breaks
    g.tweens.after(2.2, () => this.startEncounter());
  }
  startEncounter() {
    const g = this.game, gh = g.ghost; if (this.encounter || this.survived || g.isDead) return;
    const dur = g.cfg.label === 'Easy' ? 20 : g.cfg.label === 'Nightmare' ? 34 : 26;
    this.encounter = { t: 0, dur };
    const p = g.camera.position;
    if (g.scares.saved) g.scares.endScript(false);
    // the seal calls her: she comes to you from wherever she is in the house, through the doors
    gh.scripted = false; gh.state = 'NONE'; gh.dormantT = 0; gh.setState('PATROL');
    gh.lastKnown = { room: g.currentRoom, x: p.x, z: p.z, t: g.clockT };
    g.audio.roar(); g.hud.alert('Survive');
    gh.startHunt();
  }

  // ---- symbols above doorways ---------------------------------------------------------------------
  buildMark(world, room, sym) {
    if (!room) return;
    const g = this.game, b = room.bounds, y = Math.min(room.H - 0.3, 2.72), sz = 0.4;
    const mat = new THREE.MeshBasicMaterial({ map: MissionArt.mark(sym.glyph, sym.n), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
    const m = new THREE.Mesh(Cache.geo('plane:mark', () => new THREE.PlaneGeometry(sz, sz)), mat);
    m.position.set(0, y, b.maxZ - 0.02); m.rotation.y = Math.PI; m.renderOrder = 2; room.group.add(m);
    const mark = { sym, mesh: m };
    mark.ia = new Interactable(g, {
      id: 'mark:' + sym.glyph, room, meshes: [m], reach: 4.0,
      prompt: () => 'Examine the mark above the door',
      onInteract: () => this.seeMark(mark)
    });
    this.marks.push(mark);
  }
  seeMark(mark) {
    const g = this.game, s = mark.sym, first = !this.marksSeen.has(s.glyph);
    this.marksSeen.add(s.glyph);
    g.hud.toast(T('A mark scratched above the door: the {glyph}, and the numeral {num}', { glyph: lc(T(GLYPH_NAMES[s.glyph])), num: ROMAN[s.n - 1] }));
    if (first) { g.audio.pageTurn(); g.story.onSymbol(this.marksSeen.size); if (this.marksSeen.size === 3) g.tweens.after(1.5, () => g.hud.toast('Three marks, three numerals. An order')); }
  }

  // ---- game hooks ---------------------------------------------------------------------------------
  // the skull will not leave the altar while the seal holds, or while she is still on you
  canTake(item) {
    const g = this.game;
    if (item.id !== 'relic') return true;
    if (!this.ritualDone) { g.audio.rattle(null); g.hud.toast('The skull will not move. Something holds it to the stone'); g.story.onSealRefuse(); return false; }
    if (!this.survived) { g.hud.toast('Not yet. She is still here'); return false; }
    return true;
  }
  onPickup(it) {
    if (it.def.kind === 'note' && it.clue) this.cluesFound.add(it.clue.n);
    if (it.id === 'fuse') this.fuseSeen = true;
  }
  onPower() { this.refresh(); }
  onLight() { }
  // a weapon drove her off during the encounter: that counts as surviving it
  onGhostHit() { if (this.encounter && !this.survived) this.encounter.t = Math.max(this.encounter.t, this.encounter.dur - 4); }

  update(dt) {
    const g = this.game;
    if (g.inventory.has('fuse')) this.fuseSeen = true;
    // strongbox solved earlier without power: the bolt releases as soon as the mains are live
    if (this.safe && this.safe.solved && !this.safe.open && g.power.powered('library') && g.currentRoom === 'library') this.openSafe();
    if (this.safe && !this.safe.open) this.safe.lampM.color.setHex(g.power.powered('library') ? 0xc88a30 : 0x6a1410);
    if (this.encounter && !this.survived && !g.isDead) {
      this.encounter.t += dt;
      if (this.encounter.t >= this.encounter.dur) {
        this.survived = true; this.encounter = null;
        const gh = g.ghost; if (gh.state === 'HUNT') gh.beginSearch(6);
        g.story.onSurvived();
      }
    }
    this.refresh();
  }

  // ---- objectives -----------------------------------------------------------------------------------
  state() {
    const g = this.game, inv = g.inventory;
    return {
      power: g.power.mains, fuse: this.fuseSeen || g.power.mains, cellar: g.unlocked.has('cellar'),
      crowbar: inv.has('crowbar'), locker: !!(this.locker && !this.locker.nailed),
      clues: this.cluesFound.size, safe: !!(this.safe && this.safe.open), crypt: g.unlocked.has('crypt'),
      placed: this.altar ? this.altar.placed : 0, marks: this.marksSeen.size, ritual: this.ritualDone,
      survived: this.survived, encounter: this.encounter, relic: g.relicTaken || g.hasRelic
    };
  }
  missions() {
    const s = this.state(), M = [];
    M.push({ id: 'power', title: 'Restore the manor\u2019s electricity', done: s.power,
      detail: !s.fuse ? 'Find a replacement fuse. The fuse box is in the cellar' : !s.cellar ? 'You have the fuse. The cellar is locked: find its key' : 'Install the fuse in the cellar fuse box',
      progress: [{ label: '{n}/{of} fuse found', n: s.fuse ? 1 : 0, of: 1 }] });
    M.push({ id: 'locker', title: 'Open the kitchen maintenance locker', done: s.locker,
      detail: !s.crowbar ? 'It is nailed shut. Find a crowbar' : 'Pry the boards off with the crowbar',
      progress: [{ label: '{n}/{of} crowbar', n: s.crowbar || s.locker ? 1 : 0, of: 1 }] });
    M.push({ id: 'crypt', title: 'Find a way into the crypt', done: s.crypt,
      detail: s.safe ? 'Take the crypt key and unlock the stone gate at the north end of the hall'
        : s.clues < 3 ? 'The crypt key is locked in the Hollow strongbox in the library. Find the three numbers of its code'
          : !s.power ? 'You have the code, but the strongbox bolt needs electricity' : 'Set the strongbox dials to the code',
      progress: [{ label: '{n}/{of} clues found', n: s.clues, of: 3 }] });
    M.push({ id: 'seal', title: 'Break the cursed seal', done: s.ritual,
      detail: s.placed < 3 ? 'Bring three offerings to the crypt altar: black wax, grave salt, something of hers' : 'Press the altar stones in the order marked above the doors of the house',
      progress: [{ label: '{n}/{of} offerings placed', n: s.placed, of: 3 }, { label: '{n}/{of} marks found', n: s.marks, of: 3 }] });
    M.push({ id: 'survive', title: 'Survive her', done: s.survived,
      detail: 'Hide, run, or drive her back. A wound music box will draw her away',
      progress: s.encounter ? [{ label: '{n}s left', n: Math.max(0, Math.ceil(s.encounter.dur - s.encounter.t)), of: 0 }] : null });
    M.push({ id: 'relic', title: 'Take the Horned Skull', done: s.relic, detail: 'The seal is broken. Take the skull from the crypt' });
    M.push({ id: 'escape', title: 'Escape through the front door', done: this.game.hasWon, detail: 'Run. Do not stop. The chains will fall for the skull' });
    return M;
  }
  current() { return this.missions().find(m => !m.done) || null; }
  refresh() {
    const g = this.game, list = this.missions();
    // completion banners, once per mission
    list.forEach(m => { if (m.done && !this.done[m.id]) { this.done[m.id] = true; if (g.isPlaying && this.primed) this.celebrate(m.id); } });
    this.primed = true;
    const cur = list.find(m => !m.done);
    if (!cur) return;
    g.hud.setObjective({ title: cur.title, detail: cur.detail, progress: cur.progress });
  }
  celebrate(id) {
    const msg = { power: 'Electricity restored. New objective unlocked', locker: 'Locker open. New objective unlocked', crypt: 'The crypt is open. New objective unlocked', seal: 'The seal is broken. Survive!', survive: 'You survived. Take the skull', relic: 'Now run' }[id];
    if (msg) this.game.hud.objectiveDone(msg);
    if (this.game.hud.invOpen) this.game.hud.renderPanel();
  }
  // for the journal: state per mission (done / active / waiting)
  journal() {
    const list = this.missions(); let active = false;
    return list.map(m => { let state = m.done ? 'done' : 'todo'; if (!m.done && !active) { active = true; state = 'active'; } return { title: m.title, detail: m.detail, state }; });
  }
  // what you have found, never the assembled answer
  clueLines() {
    const out = [], pos = ['Strongbox code, first number: {d}', 'Strongbox code, second number: {d}', 'Strongbox code, third number: {d}'];
    [0, 1, 2].forEach(n => { if (this.cluesFound.has(n)) out.push({ s: pos[n], p: { d: this.code[n] } }); });
    this.symbols.forEach(s => { if (this.marksSeen.has(s.glyph)) out.push({ s: 'Mark of the {glyph}, numeral {num}', p: { glyph: lc(T(GLYPH_NAMES[s.glyph])), num: ROMAN[s.n - 1] } }); });
    if (this.altar && this.altar.placed) out.push({ s: '{n} of 3 offerings on the altar', p: { n: this.altar.placed } });
    return out;
  }
}
