'use strict';
// ==========================================================================
// POWER: the manor's wiring. Every room has a ceiling bulb on a cord and a wall
// switch by its door. Circuits:
//   old      bedroom, an old separate line. Works from the start.
//   main     corridor, parlor, library, cellar, crypt. Needs the cellar fuse.
//   kitchen  main + the damaged junction inside the kitchen maintenance locker.
//   nursery  main + the tripped nursery breaker reset at the fuse box.
// Lights are created once at build time and only ever change intensity (adding or
// toggling lights would recompile shaders mid-game). Horror effects are events:
// flicker when she enters, brownouts, a midnight failure, a bulb she switches off.
// ==========================================================================
const POWER_LAYOUT = {
  corridor: { circuit: 'main', bulbs: [[0, 4.0], [0, -4.0]], sw: { wall: 'E', u: 10.4 } },
  parlor:   { circuit: 'main', bulbs: [[0, -0.8]], sw: { wall: 'S', u: 1.35 } },
  bedroom:  { circuit: 'old', bulbs: [[0, -0.6]], sw: { wall: 'S', u: 1.35 } },
  kitchen:  { circuit: 'kitchen', bulbs: [[0.5, 1.8]], sw: { wall: 'S', u: 1.35 } },
  library:  { circuit: 'main', bulbs: [[0.8, 1.4]], sw: { wall: 'S', u: 1.35 }, loose: true },
  nursery:  { circuit: 'nursery', bulbs: [[0.6, -0.6]], sw: { wall: 'S', u: 1.35 } },
  cellar:   { circuit: 'main', bulbs: [[0, 0.8]], sw: { wall: 'S', u: 1.35 } },
  crypt:    { circuit: 'main', bulbs: [[0, 1.2]], sw: { wall: 'S', u: 1.65 }, caged: true }
};

class PowerGrid {
  constructor(game) { this.game = game; this.reset(); }
  reset() {
    this.mains = false; this.kitchenFixed = false; this.nurseryBreaker = false;
    this.rooms = {}; this.outT = 0; this.brownT = 0; this.brownCd = 0; this.everLit = false; this.noPowerSaid = false;
    this.glowTex = null; this.fuse = null;
  }

  // ---- build: called by World.build before decor and navigation ----------------------------
  build(world) {
    this.reset();
    const g = this.game;
    Object.keys(POWER_LAYOUT).forEach(id => {
      const room = world.rooms[id]; if (!room) return;
      const L = POWER_LAYOUT[id], e = { id, room, L, bulbs: [], on: false, k: 0, flickT: 0, warmT: 0, huntLitT: 0, lastTrip: -999, looseT: 20 + g.frand() * 20, nearCd: 0 };
      L.bulbs.forEach(b => e.bulbs.push(this.buildBulb(world, room, b[0], b[1], L)));
      e.sw = this.buildSwitch(world, room, L.sw);
      e.sw.ia = new Interactable(g, {
        id: 'switch:' + id, room, meshes: [e.sw.hit, e.sw.plate], reach: 2.6,
        prompt: () => (e.on ? 'Turn off light' : 'Turn on light'),
        onInteract: () => this.flip(id)
      });
      this.rooms[id] = e; room.power = e;
      room.powerAvailable = this.powered(id); room.lightOn = false;
    });
    this.buildFuseBox(world);
  }

  buildBulb(world, room, x, z, L) {
    const y = room.H - 0.68, grp = new THREE.Group(); grp.position.set(x, 0, z); room.group.add(grp);
    const brass = world.mat(0x6a5532, 0.5, 0.8), cordM = world.mat(0x0c0c0c, 0.7);
    const cord = new THREE.Mesh(Cache.geo('pw.cord', () => new THREE.CylinderGeometry(0.006, 0.006, 1, 5)), cordM);
    cord.scale.y = room.H - y - 0.06; cord.position.y = (room.H + y + 0.06) / 2; grp.add(cord);
    const rose = new THREE.Mesh(Cache.geo('pw.rose', () => new THREE.CylinderGeometry(0.06, 0.07, 0.03, 12)), brass); rose.position.y = room.H - 0.015; grp.add(rose);
    const holder = new THREE.Mesh(Cache.geo('pw.holder', () => new THREE.CylinderGeometry(0.024, 0.03, 0.07, 10)), brass); holder.position.y = y + 0.07; grp.add(holder);
    // each room owns its bulb material: on, the glass glows and the filament burns orange
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3428, roughness: 0.15, metalness: 0.1, emissive: 0xffc070, emissiveIntensity: 0, transparent: true, opacity: 0.92 });
    const bulb = new THREE.Mesh(Cache.geo('pw.bulb', () => { const gg = new THREE.SphereGeometry(0.06, 16, 12); gg.scale(1, 1.25, 1); return gg; }), mat); bulb.position.y = y; grp.add(bulb);
    const fil = new THREE.Mesh(Cache.geo('pw.fil', () => new THREE.TorusGeometry(0.014, 0.0025, 4, 10, Math.PI)), new THREE.MeshBasicMaterial({ color: 0x2a1a08 })); fil.position.y = y + 0.005; grp.add(fil);
    if (L.caged) {
      const wire = world.mat(0x2a2a2a, 0.5, 0.8), wg = Cache.geo('pw.cage', () => new THREE.BoxGeometry(0.006, 0.16, 0.006));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, w = new THREE.Mesh(wg, wire); w.position.set(Math.cos(a) * 0.075, y, Math.sin(a) * 0.075); grp.add(w); }
      const ring = new THREE.Mesh(Cache.geo('pw.ring', () => new THREE.TorusGeometry(0.075, 0.004, 4, 16)), wire); ring.rotation.x = Math.PI / 2; ring.position.y = y - 0.08; grp.add(ring);
    }
    // a soft halo sprite so the bulb reads as lit from across the room
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow(), color: 0xffd090, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.set(0.8, 0.8, 1); glow.position.y = y; grp.add(glow);
    // bright enough to light the whole room: a bare 60 W bulb, not a candle
    const light = world.addLight(room, 0xffd6a0, L.bulbs.length > 1 ? 4.2 : 5.2, 15, x, y - 0.1, z, null);
    const base = light.intensity; light.intensity = 0;
    return { grp, bulb, mat, fil, glow, light, base };
  }

  glow() {
    return this.glowTex || (this.glowTex = Cache.tex('tex.bulbglow', () => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.25, 'rgba(255,200,120,0.45)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    }));
  }

  // wall plate with a lever: down is on, up is off
  buildSwitch(world, room, s) {
    const b = room.bounds, y = 1.25, grp = new THREE.Group();
    if (s.wall === 'S') { grp.position.set(s.u, y, b.maxZ - 0.012); grp.rotation.y = Math.PI; }
    else if (s.wall === 'N') { grp.position.set(s.u, y, b.minZ + 0.012); }
    else if (s.wall === 'E') { grp.position.set(b.maxX - 0.012, y, s.u); grp.rotation.y = -Math.PI / 2; }
    else { grp.position.set(b.minX + 0.012, y, s.u); grp.rotation.y = Math.PI / 2; }
    room.group.add(grp);
    const plate = new THREE.Mesh(Cache.geo('pw.plate', () => new THREE.BoxGeometry(0.09, 0.14, 0.018)), world.mat(0x5a4a36, 0.45, 0.1)); plate.position.z = 0.009; grp.add(plate);
    const screwG = Cache.geo('pw.screw', () => new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8)), screwM = world.mat(0x8a7a5a, 0.4, 0.9);
    [-0.05, 0.05].forEach(sy => { const sc = new THREE.Mesh(screwG, screwM); sc.rotation.x = Math.PI / 2; sc.position.set(0, sy, 0.019); grp.add(sc); });
    const pivot = new THREE.Group(); pivot.position.z = 0.02; grp.add(pivot);
    const lever = new THREE.Mesh(Cache.geo('pw.lever', () => { const gg = new THREE.BoxGeometry(0.016, 0.045, 0.014); gg.translate(0, 0.02, 0.006); return gg; }), world.mat(0x1a140e, 0.4, 0.2));
    pivot.add(lever); pivot.rotation.x = -0.55;           // up = off
    // little lamp in the plate: amber when the circuit is live, dark when it is dead
    const pilotM = new THREE.MeshBasicMaterial({ color: 0x201812 });
    const pilot = new THREE.Mesh(Cache.geo('pw.pilot', () => new THREE.SphereGeometry(0.006, 6, 6)), pilotM); pilot.position.set(0, -0.052, 0.02); grp.add(pilot);
    // a generous invisible target so the small plate is easy to aim at
    const hit = new THREE.Mesh(Cache.geo('pw.hit', () => new THREE.BoxGeometry(0.26, 0.3, 0.12)), Cache.mat('hit.mat', () => new THREE.MeshBasicMaterial({ visible: false }))); hit.position.z = 0.05; grp.add(hit);
    return { grp, plate, pivot, lever, pilotM, hit, pos: grp.position.clone() };
  }

  // The fuse box on the cellar's north wall: install the fuse, then reset the nursery breaker
  buildFuseBox(world) {
    const cellar = world.rooms.cellar, fb = cellar && cellar.fuseBox; if (!fb) return;
    const g = this.game, door = fb.mesh;
    // breaker row and a status lamp on the door
    const breakers = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(Cache.geo('pw.brk', () => new THREE.BoxGeometry(0.06, 0.1, 0.03)), world.mat(0x161616, 0.5, 0.3)); m.position.set(-0.18 + i * 0.12, 1.78, -4.73); cellar.group.add(m); breakers.push(m); }
    breakers[3].rotation.x = 0.6;                           // the nursery breaker hangs tripped
    const lampM = new THREE.MeshBasicMaterial({ color: 0x8a1a10 });
    const lamp = new THREE.Mesh(Cache.geo('pw.fblamp', () => new THREE.SphereGeometry(0.018, 8, 8)), lampM); lamp.position.set(0.24, 1.3, -4.73); cellar.group.add(lamp);
    // the fuse, shown in its holder once installed
    const fuse = ItemFactory.create('fuse'); fuse.position.set(-0.12, 1.42, -4.72); fuse.rotation.z = Math.PI / 2; fuse.visible = false; cellar.group.add(fuse);
    this.fuse = { breakers, lampM, fuse };
    fb.ia = new Interactable(g, {
      id: 'fusebox', room: cellar, meshes: [door].concat(breakers), reach: 2.8,
      prompt: () => {
        if (!this.mains) return g.inventory.has('fuse') ? 'Install the fuse' : 'Fuse box. The main fuse is missing';
        if (!this.nurseryBreaker) return 'Reset the tripped breaker';
        return 'The fuse box hums';
      },
      onInteract: () => {
        if (!this.mains) { const f = g.inventory.slots.find(s => s && s.id === 'fuse'); if (f) this.installFuse(f); else { g.audio.rattle({ x: 0, y: 1.6, z: -4.7 }); g.hud.toast('The main fuse is missing. Find a replacement'); } return; }
        if (!this.nurseryBreaker) this.resetBreaker();
      },
      onUse: it => { if (it && it.id === 'fuse' && !this.mains) { this.installFuse(it); return true; } return false; }
    });
  }

  // ---- state ------------------------------------------------------------------------------------
  powered(id) {
    const e = this.rooms[id]; if (!e) return false;
    const c = e.L.circuit;
    if (c === 'old') return true;
    if (!this.mains) return false;
    if (c === 'kitchen') return this.kitchenFixed;
    if (c === 'nursery') return this.nurseryBreaker;
    return true;
  }
  // is this room lit right now (bulb on, power live, not blacked out)
  isLit(id) { const e = this.rooms[id]; return !!(e && e.on && this.powered(id) && e.k > 0.5); }
  noPowerReason(id) {
    const c = this.rooms[id].L.circuit;
    if (!this.mains) return 'No power. The fuse box is in the cellar';
    if (c === 'kitchen') return 'No power here. The wiring is damaged somewhere in this room';
    if (c === 'nursery') return 'No power. A breaker must have tripped at the fuse box';
    return 'No power';
  }

  // the player flips a switch: lever moves, click, and the bulb follows if the circuit is live
  flip(id) {
    const g = this.game, e = this.rooms[id]; if (!e) return;
    const pos = { x: e.sw.pos.x, y: 1.25, z: e.sw.pos.z };
    g.audio.switchClick(pos); g.makeNoise(e.sw.pos.x, e.sw.pos.z, id, 0.08, 'switch');
    if (!this.powered(id)) {
      // dead circuit: the lever drops and springs back
      e.sw.pivot.rotation.x = 0.55; g.tweens.add({ key: 'swspring' + id, delay: 0.25, dur: 0.18, from: 0.55, to: -0.55, update: v => { e.sw.pivot.rotation.x = v; } });
      g.hud.toast(this.noPowerReason(id));
      if (!this.noPowerSaid) { this.noPowerSaid = true; g.story.onSwitchNoPower(); }
      return;
    }
    this.setOn(id, !e.on);
    if (e.on) {
      e.warmT = 0.35; g.audio.bulbOn({ x: e.bulbs[0].grp.position.x, y: e.room.H - 0.7, z: e.bulbs[0].grp.position.z });
      if (!this.everLit) { this.everLit = true; g.story.onPower(); }
    }
    if (g.missions) g.missions.onLight(id, e.on);
  }
  setOn(id, on) {
    const e = this.rooms[id]; if (!e) return;
    e.on = on;
    this.game.tweens.add({ key: 'swlev' + id, dur: 0.12, from: e.sw.pivot.rotation.x, to: on ? 0.55 : -0.55, update: v => { e.sw.pivot.rotation.x = v; } });
  }

  installFuse(item) {
    const g = this.game; if (this.mains) return;
    this.mains = true; g.inventory.removeItem(item);
    const p = { x: 0, y: 1.6, z: -4.7 };
    g.audio.fuseInstall(p); g.tweens.after(0.5, () => g.audio.powerUp());
    this.fuse.fuse.visible = true; this.fuse.lampM.color.setHex(0x30ff60);
    this.fuse.breakers.slice(0, 3).forEach((b, i) => g.tweens.after(0.25 + i * 0.15, () => { b.rotation.x = -0.25; g.audio.click(); }));
    // the cellar is where you stand: its light comes on with the mains, and it steadies the room
    const cellar = g.world.rooms.cellar;
    g.tweens.after(0.9, () => { this.setOn('cellar', true); this.rooms.cellar.warmT = 0.6; g.audio.bulbOn(null); });
    cellar.flickers = cellar.flickers.filter(f => f.light.color.getHex() !== 0xfff0c0);
    cellar.role = g.midnight ? 'hostile' : 'safe';
    g.makeNoise(0, -4.7, 'cellar', 0.45, 'power');
    g.hud.toast('Power restored. The main circuit is live'); g.fear.add(-20);
    if (!this.everLit) { this.everLit = true; g.tweens.after(1.4, () => g.story.onPower()); }
    if (g.missions) g.missions.onPower();
  }
  resetBreaker() {
    const g = this.game; if (this.nurseryBreaker || !this.mains) return;
    this.nurseryBreaker = true; this.fuse.breakers[3].rotation.x = -0.25;
    g.audio.fuseInstall({ x: 0.18, y: 1.78, z: -4.7 }); g.makeNoise(0, -4.7, 'cellar', 0.25, 'power');
    g.hud.toast('Breaker reset. The nursery has power');
  }
  repairKitchen() {
    const g = this.game; if (this.kitchenFixed) return false;
    this.kitchenFixed = true; g.audio.fuseInstall(null);
    g.hud.toast(this.mains ? 'Wiring repaired. The kitchen light will work' : 'Wiring repaired. Now the house needs its main fuse');
    return true;
  }

  // ---- events -------------------------------------------------------------------------------------
  blackout(sec) { this.outT = Math.max(this.outT, sec); }
  flicker(id, sec) { const e = this.rooms[id]; if (e) e.flickT = Math.max(e.flickT, sec); }
  // the ghost kills a light: switch thrown off, a buzz and a spark
  trip(id) {
    const g = this.game, e = this.rooms[id]; if (!e || !e.on) return;
    e.lastTrip = g.clockT; e.flickT = 0.6;
    g.tweens.after(0.6, () => { this.setOn(id, false); g.audio.spark({ x: e.sw.pos.x, y: 1.25, z: e.sw.pos.z }); });
    g.audio.buzz(null, 0.8);
    g.hud.toast('The light dies. Something switched it off'); g.story.onLightKilled();
  }

  // ---- per frame ------------------------------------------------------------------------------------
  update(dt) {
    const g = this.game, atmo = g.atmosphere, gh = g.ghost, t = g.time;
    if (this.outT > 0) this.outT -= dt;
    // power interruptions once the mains are live: a short brownout every few minutes
    if (this.mains && g.isPlaying && !g.isDead) {
      this.brownCd -= dt;
      if (this.brownCd <= 0) { this.brownCd = 150 + g.frand() * 120; if (g.clockT > 120) { this.brownT = 2.6; if (this.isLit(g.currentRoom)) g.audio.buzz(null, 1.6); } }
    }
    if (this.brownT > 0) this.brownT -= dt;
    Object.values(this.rooms).forEach(e => {
      const id = e.id, here = id === g.currentRoom, live = this.powered(id);
      e.room.powerAvailable = live;
      if (e.flickT > 0) e.flickT -= dt; if (e.warmT > 0) e.warmT -= dt; if (e.nearCd > 0) e.nearCd -= dt;
      let k = e.on && live ? 1 : 0;
      if (k && (this.outT > 0 || (here && atmo.outT > 0))) k = 0;
      // flicker windows: her arrival (atmosphere flicker), a brownout, a loose filament, a warming bulb
      const flick = e.flickT > 0 || (here && atmo.flickerT > 0) || this.brownT > 0 || e.warmT > 0;
      if (k && flick && !g.access.reduceFlashing) { const n = Math.sin(t * 37 + e.bulbs.length) + Math.sin(t * 23.3) * 0.8 + Math.sin(t * 61.7) * 0.4; k = n > 0.35 ? 1 : n > -0.4 ? 0.35 : 0.05; }
      else if (k && flick) k = 0.6;
      if (k && this.brownT > 0) k *= 0.45;
      if (k && here && e.room.dark && !g.access.reduceScares) k *= 0.3;
      e.k = damp(e.k, k, k > e.k ? 40 : 28, dt);
      e.room.lightOn = e.on && live;
      // pilot lamp on the switch plate: amber with power
      e.sw.pilotM.color.setHex(live ? 0xc88a30 : 0x201812);
      if (!here) return;
      // the visible room: drive the bulb, halo and light, and the room's brightness for the fear system
      const red = g.redAlert;
      e.bulbs.forEach(b => {
        b.light.intensity = b.base * e.k; b.mat.emissiveIntensity = 2.6 * e.k; b.glow.material.opacity = 0.7 * e.k;
        b.mat.color.setHex(e.k > 0.05 ? 0xfff2d8 : 0x3a3428); b.fil.material.color.setHex(e.k > 0.05 ? 0xffa040 : 0x2a1a08);
        if (red) { b.light.color.setHex(0xff3a24); b.mat.emissive.setHex(0xff3020); b.glow.material.color.setHex(0xff5a40); }
        else { b.light.color.setHex(0xffd6a0); b.mat.emissive.setHex(0xffc070); b.glow.material.color.setHex(0xffd090); }
      });
      if (e.room.baseLight === undefined) e.room.baseLight = e.room.lightLevel;
      e.room.lightLevel = e.k > 0.5 ? Math.max(e.room.baseLight, 0.75) : e.room.baseLight;
      g.hud.setPower(e.L.caged && !live ? 'dead' : !live ? 'dead' : e.on ? 'on' : 'off');
      // the library bulb has a loose filament
      if (e.L.loose && e.on && live) { e.looseT -= dt; if (e.looseT <= 0) { e.looseT = 18 + g.frand() * 22; e.flickT = 1.3; g.audio.buzz({ x: e.bulbs[0].grp.position.x, y: e.room.H - 0.7, z: e.bulbs[0].grp.position.z }, 1.0); } }
      // she is close and the light is on: the bulb stutters, and if she hunts you under it long enough she kills it
      // (switch state, not brightness: her own flicker must not reset the count)
      if (e.on && live && gh.inPlayerRoom() && gh.state !== 'DORMANT' && !gh.scripted) {
        const pres = gh.presence();
        if (pres > 0.55 && e.nearCd <= 0) { e.nearCd = 7 + g.frand() * 5; e.flickT = 0.8; g.audio.buzz(null, 0.7); }
        e.huntLitT = gh.state === 'HUNT' ? e.huntLitT + dt : Math.max(0, e.huntLitT - dt);
        if (e.huntLitT > 4 && g.clockT - e.lastTrip > 45) { e.huntLitT = 0; this.trip(id); }
      } else e.huntLitT = 0;
    });
  }

  // after midnight safe rooms darken: keep the bulbs' idea of the room's own brightness in step
  rebase() { Object.values(this.rooms).forEach(e => { e.room.baseLight = e.room.lightLevel; }); }
}
