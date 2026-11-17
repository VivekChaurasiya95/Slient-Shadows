'use strict';
// ==========================================================================
// DIRECTOR: Fear/Sanity meter, tension stage effects, scare director, lightning,
// light flicker control, hallucinations, breath puffs, screen FX.
// ==========================================================================
class FearSystem {
  constructor(game) { this.game = game; this.v = 0; this.beat = 0; this.hallT = 14; }
  reset() { this.v = 0; this.hallT = 14; }
  add(x) { this.v = clamp(this.v + (x > 0 ? x * this.game.cfg.fearGain : x), 0, 100); }
  set(x) { this.v = clamp(x, 0, 100); }
  get level() { return this.v / 100; }
  update(dt) {
    const g = this.game, gh = g.ghost, room = g.room;
    if (g.isDead || !g.isPlaying) return;
    const p = gh.presence();
    let d = -1.0;
    d += p * 11 * g.cfg.fearGain;
    const lit = (g.flashlightOn && g.battery > 0) || (g.lighterOn);
    if (!lit && room.lightLevel < 0.3) d += 2.6;
    if (room.lightLevel > 0.6 || room.role === 'safe') d -= 4;
    if (gh.state === 'HUNT') d += 5 * g.cfg.fearGain;
    this.v = clamp(this.v + d * dt, 0, 100);
    // at high fear: hallucinations, harmless and clearly not the ghost
    if (this.v > CONFIG.fear.fakeSoundAt * 100 && !g.access.reduceScares) {
      this.hallT -= dt;
      if (this.hallT <= 0) { this.hallT = 14 + g.rand() * 18; g.director.hallucinate(); }
    }
  }
}

// --------------------------------------------------------------------------
// Screen effects (CSS classes / variables on the canvas and overlays)
// --------------------------------------------------------------------------
class ScreenFX {
  constructor(game) { this.game = game; this.el = document.getElementById('game-container'); this.glT = 0; this.chT = 0; }
  glitch(k) {
    if (this.game.access.reduceFlashing) { this.pulse(0.25); return; }
    this.el.classList.add('fx-glitch'); this.glT = 0.12 + k * 0.35;
    this.game.hud.pipGlitch(this.glT + 0.3);
  }
  pulse(k) { this.el.classList.add('fx-chroma'); this.chT = 0.2 + k * 0.4; }
  update(dt) {
    if (this.glT > 0 && (this.glT -= dt) <= 0) this.el.classList.remove('fx-glitch');
    if (this.chT > 0 && (this.chT -= dt) <= 0) this.el.classList.remove('fx-chroma');
    const g = this.game, f = g.fear.level;
    const root = document.documentElement.style;
    root.setProperty('--fear', f.toFixed(3));
    root.setProperty('--hidden', g.hiding.active ? '1' : '0');
    root.setProperty('--presence', g.ghost.presence().toFixed(2));
  }
}

// --------------------------------------------------------------------------
// Atmosphere: flicker, blackout, lightning, breath puffs, phantoms
// --------------------------------------------------------------------------
class Atmosphere {
  constructor(game) {
    this.game = game; this.flickerT = 0; this.outT = 0; this.lightningT = 30; this.time = 0;
    this.flash = new THREE.PointLight(0x9ab8ff, 0, 22, 2); this.flash.position.set(0, 2.4, 0); game.scene.add(this.flash);
    this.puffT = 2; this.puffs = [];
    this.winMat = null;
    this.phantom = null;
  }
  reset() { this.flickerT = 0; this.outT = 0; this.lightningT = 20 + this.game.rand() * 30; this.phantomClear(); }

  lightsOut(sec) { this.outT = Math.max(this.outT, sec); }
  flicker(sec) { this.flickerT = Math.max(this.flickerT, sec); }

  update(dt) {
    const g = this.game, room = g.room; this.time += dt;
    if (!room) return;
    if (this.flickerT > 0) this.flickerT -= dt;
    if (this.outT > 0) this.outT -= dt;
    const fear = g.fear.level, soft = g.access.reduceFlashing;
    const hot = g.ghost.presence() > 0.35 ? 1 : 0;
    // every light in the visible room responds to the global state
    for (const f of room.flickers) {
      const n = 0.5 * Math.sin(this.time * f.speed + f.phase) + 0.3 * Math.sin(this.time * f.speed * 2.7 + f.phase * 1.3) + (soft ? 0 : (Math.random() - 0.5) * 0.3);
      let mul = 1 + f.amp * n * (1 + g.stage * 0.25);
      if (this.outT > 0) mul = 0.0;
      else if (this.flickerT > 0 || hot && Math.random() < 0.012 * (soft ? 0 : 1)) mul *= soft ? 0.5 : (Math.random() < 0.5 ? 0.05 : 1.2);
      if (room.dark && !g.access.reduceScares) mul *= 0.25;
      f.light.intensity = f.base * Math.max(0, mul) * (g.redAlert ? 1.15 : 1);
      if (g.redAlert && !f.red) { f.red = true; f.light.color.setHex(0xff1818); }
    }
    // flashlight flicker rises with fear and falling battery
    g.flashFlicker = (fear > 0.6 ? (fear - 0.6) * 2.5 : 0) + (g.battery < 15 ? (15 - g.battery) / 15 : 0);
    // lightning
    this.lightningT -= dt;
    if (this.lightningT <= 0) { this.lightningT = Math.max(14, (45 - g.stage * 8)) * (0.6 + g.rand() * 0.9); this.lightning(); }
    if (this.flash.intensity > 0) { this.flash.intensity = Math.max(0, this.flash.intensity - dt * 22); }
    // window view brightness
    const wm = g.world.windowMat(); wm.color.setScalar(clamp(wm.color.r + (1 - wm.color.r) * Math.min(1, dt * 7), 1, 6));
    // cold breath when it is near
    this.puffT -= dt;
    if (this.puffT <= 0 && g.ghost.presence() > 0.4 && !g.isDead) { this.puffT = 2.4 - g.ghost.presence(); this.puff(); }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]; p.t += dt;
      const k = p.t / 1.6; p.s.position.y += dt * 0.05; p.s.position.z -= dt * 0.1; p.s.scale.setScalar(0.12 + k * 0.5); p.s.material.opacity = 0.35 * (1 - k);
      if (k >= 1) { g.camera.remove(p.s); p.s.material.dispose(); this.puffs.splice(i, 1); }
    }
    this.tickPhantom(dt);
  }

  lightning() {
    const g = this.game, room = g.room, wm = g.world.windowMat(), soft = g.access.reduceFlashing;
    const strikes = soft ? 1 : 2;
    for (let s = 0; s < strikes; s++) g.tweens.after(s * 0.18, () => {
      wm.color.setScalar(soft ? 2 : 5);
      if (room.windows.length) { const w = room.windows[0]; this.flash.position.set(w.x, 2.4, w.z + (w.z < 0 ? 1 : w.z > 0 ? -1 : 0)); this.flash.intensity = soft ? 2.5 : 7; }
    });
    g.tweens.after(0.7 + g.rand() * 1.6, () => g.audio.thunder());
  }

  puff() {
    const g = this.game;
    const tex = Cache.tex('tex.puff', () => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(210,225,255,0.8)'); gr.addColorStop(1, 'rgba(210,225,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false, depthTest: false, fog: false }));
    s.position.set(0, -0.14, -0.55); s.renderOrder = 10; g.camera.add(s); this.puffs.push({ s, t: 0 });
  }

  // ---- hallucination figure: a flat black silhouette with no eyes, no sound ------------------------
  spawnPhantom() {
    const g = this.game, room = g.room;
    if (this.phantom) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false });
    const grp = new THREE.Group();
    const body = new THREE.Mesh(Cache.geo('ph.body', () => new THREE.CylinderGeometry(0.2, 0.34, 1.8, 10)), mat); body.position.y = 0.95;
    const head = new THREE.Mesh(Cache.geo('ph.head', () => new THREE.SphereGeometry(0.17, 10, 8)), mat); head.position.y = 2.05;
    grp.add(body, head);
    const p = g.camera.position; let x, z;
    if (g.currentRoom === 'corridor') { x = 0; z = p.z > 0 ? -10.2 : 10.2; }
    else { x = p.x > room.cx ? room.bounds.minX + 1 : room.bounds.maxX - 1; z = p.z > room.cz ? room.bounds.minZ + 1 : room.bounds.maxZ - 1; }
    grp.position.set(x, 0, z); g.scene.add(grp);
    this.phantom = { grp, mat, t: 0, seen: 0 };
  }
  tickPhantom(dt) {
    const ph = this.phantom, g = this.game;
    if (!ph) return;
    ph.t += dt; ph.mat.opacity = Math.min(0.75, ph.t * 0.8) * (ph.vanish ? Math.max(0, 1 - (ph.t - ph.vanish) * 4) : 1);
    const cam = g.camera, to = TMP.v1.set(ph.grp.position.x - cam.position.x, 0, ph.grp.position.z - cam.position.z), d = to.length(); to.normalize();
    const f = TMP.v2.set(0, 0, -1).applyQuaternion(cam.quaternion); f.y = 0; f.normalize();
    if (f.dot(to) > 0.93) ph.seen += dt; 
    if (!ph.vanish && (ph.seen > 0.7 || d < 5 || ph.t > 9 || g.currentRoomChanged)) { ph.vanish = ph.t; g.audio.whisper(null, 0.2); g.fear.add(6); }
    if (ph.vanish && ph.t - ph.vanish > 0.3) this.phantomClear();
  }
  phantomClear() { const ph = this.phantom; if (!ph) return; this.game.scene.remove(ph.grp); ph.mat.dispose(); this.phantom = null; }
}

// --------------------------------------------------------------------------
// Scare director: random, weighted, rate-limited, escalating with the stage.
// --------------------------------------------------------------------------
class ScareDirector {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.quiet = 0; this.cool = 30; this.lastBig = -999; this.pendingReal = 0; }
  interval() {
    const g = this.game, base = lerp(42, 15, g.stage / 3) / g.cfg.scareRate;
    return base * (g.access.reduceScares ? 2.2 : 1);
  }
  update(dt) {
    const g = this.game;
    if (!g.isPlaying || g.isDead || g.hasWon || g.transitioning) return;
    this.quiet += dt; this.cool -= dt;
    if (this.pendingReal > 0) { this.pendingReal -= dt; if (this.pendingReal <= 0) this.real(); }
    if (g.hiding.active || g.ghost.state === 'HUNT' || g.scares.busy || g.inputLocked) return;
    if (this.cool > 0 || this.quiet < this.interval() * (0.7 + g.rand() * 0.6)) return;
    this.fire();
  }
  fire() {
    const g = this.game, st = g.stage, ev = [];
    const add = (name, w, f) => ev.push({ name, w, f });
    add('flicker', 3, () => g.flickerLights(1.6 + g.rand() * 1.5));
    add('blackout', 1.6 + st, () => g.lightsOut(3 + g.rand() * 3));
    add('slam', 2, () => this.distantSlam());
    add('musicbox', 1.5, () => g.audio.musicBox(g.audio.randPos(7), 0.3, false));
    add('footsteps', 2, () => this.overhead());
    add('whisper', 2, () => g.audio.whisper(this.behind(), 0.5));
    add('chair', 1, () => g.scares.fakeout('chair'));
    add('painting', 1.2, () => g.scares.fakeout('painting'));
    add('bats', g.currentRoom === 'corridor' ? 1.6 : 0, () => g.scares.fakeout('bat'));
    add('pumpkin', 1, () => this.redPumpkins());
    add('thunder', 1.5, () => g.atmosphere.lightning());
    add('shadow', st >= 1 ? 1.5 : 0, () => g.atmosphere.spawnPhantom());
    if (!g.access.reduceScares && g.time - this.lastBig > (g.access.reduceScares ? 90 : 35)) {
      add('mirror', g.room.mirror && st >= 1 ? 3 : 0, () => g.scares.mirror());
      add('corridor', g.currentRoom === 'corridor' && st >= 2 ? 3 : 0, () => g.scares.corridor(false));
      add('ceiling', st >= 2 && g.currentRoom !== 'corridor' ? 2.5 : 0, () => g.scares.ceiling(false));
    }
    const pick = g.rng.weighted(ev, e => e.w);
    if (!pick || pick.w <= 0) return;
    const big = ['mirror', 'corridor', 'ceiling'].includes(pick.name);
    pick.f();
    if (big) this.lastBig = g.time;
    this.quiet = 0; this.cool = big ? 18 : 8;
    // lower the guard with a fake-out, then something real a few seconds later
    if (['chair', 'painting', 'bats'].includes(pick.name) && st >= 1 && !g.access.reduceScares && g.rand() < 0.5) this.pendingReal = 4 + g.rand() * 5;
  }
  real() {
    const g = this.game;
    if (g.scares.busy || g.hiding.active || g.isDead) return;
    if (g.currentRoom === 'corridor') g.scares.corridor(false);
    else if (g.room.mirror) g.scares.mirror() || g.scares.ceiling(false);
    else g.scares.ceiling(false);
    this.lastBig = g.time;
  }
  behind() { const g = this.game, f = TMP.v1.set(0, 0, 1).applyQuaternion(g.camera.quaternion); return { x: g.camera.position.x + f.x * 1.2, y: 1.5, z: g.camera.position.z + f.z * 1.2 }; }
  distantSlam() {
    const g = this.game, others = Object.values(g.world.rooms).filter(r => r.id !== g.currentRoom);
    const r = others[Math.floor(g.rand() * others.length)];
    const d = r.doors[0];
    g.audio.doorSlam(d ? { x: d.bx, y: 1.2, z: d.bz } : null);
    g.fear.add(6);
  }
  overhead() { const g = this.game; for (let i = 0; i < 5; i++) g.tweens.after(i * 0.5, () => g.audio.tone({ type: 'triangle', f0: 70, f1: 40, dur: 0.12, gain: 0.18, pos: { x: g.camera.position.x + (i - 2) * 0.8, y: 4, z: g.camera.position.z } })); g.audio.say('[Footsteps overhead]'); g.fear.add(4); }
  redPumpkins() {
    const g = this.game, room = g.room, list = room.pumpkins || [];
    if (!list.length) { g.audio.musicBox(g.audio.randPos(6), 0.3, false); return; }
    list.forEach(p => { p.light.color.setHex(0xff1010); p.faceMat.color.setHex(0xff3030); g.tweens.after(6, () => { p.light.color.setHex(0xff7a18); p.faceMat.color.setHex(0xffffff); }); });
    g.audio.whisper(null, 0.4); g.fear.add(6);
  }
  hallucinate() {
    const g = this.game, k = Math.floor(g.rand() * 4);
    if (k === 0) g.atmosphere.spawnPhantom();
    else if (k === 1) { g.audio.doorSlam({ x: g.camera.position.x + 6, y: 1, z: g.camera.position.z - 6 }); g.audio.say('[A door slams somewhere]'); }
    else if (k === 2) g.audio.whisper(this.behind(), 0.6);
    else this.fakeDoor();
  }
  // A door creaks open that nobody opened. Nothing is there. It only makes you want to hide.
  fakeDoor() {
    const g = this.game, doors = g.room.doors.filter(d => d.def.kind !== 'fake' && !d.isOpen);
    if (!doors.length) { g.audio.whisper(this.behind(), 0.5); return; }
    const d = doors[Math.floor(g.rand() * doors.length)], pos = { x: d.bx, y: 1.2, z: d.bz };
    g.audio.doorOpen(0.35, pos); g.audio.footstep(g.room.def.floor, 0.8, pos);
    g.tweens.after(0.9, () => g.audio.footstep(g.room.def.floor, 0.8, pos)); g.tweens.after(1.7, () => g.audio.footstep(g.room.def.floor, 0.8, pos));
    g.fear.add(5);
  }
}
