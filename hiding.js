'use strict';
// ==========================================================================
// HIDING: spot builders, HideSpot, and the Hiding controller (enter / leave,
// slit view, breath hold, noise rules, ghost checks).
// ==========================================================================
function buildHide(world, room, def, fake) {
  const game = world.game, w = def.w, d = def.d, h = def.h;
  const g = new THREE.Group(); g.position.set(def.x, 0, def.z); g.rotation.y = def.ry; room.group.add(g);
  const wood = world.mat(def.type === 'coffin' ? 0x34383c : 0x23160d, 0.8, 0.05), dark = world.mat(0x0b0705, 1);
  const box = (mat, bw, bh, bd, x, y, z) => { const m = new THREE.Mesh(Cache.geo('box:' + bw + ',' + bh + ',' + bd, () => new THREE.BoxGeometry(bw, bh, bd)), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const c = Math.abs(Math.cos(def.ry)), s = Math.abs(Math.sin(def.ry));
  const parts = { meshes: [], apply: () => {}, slot: null, openFull: 1, crack: 0.35 };
  const fx = Math.sin(def.ry), fz = Math.cos(def.ry);             // world direction of local +Z
  const lw = (lx, lz) => [def.x + Math.cos(def.ry) * lx + fx * lz, def.z - Math.sin(def.ry) * lx + fz * lz];
  const yaw = yawFromDir(fx, fz);

  if (def.type === 'closet' || (def.type === 'under' && def.h < 1)) {
    const t = 0.05, low = def.type === 'under';
    box(wood, w, t, d, 0, t / 2, 0); box(wood, w, t, d, 0, h - t / 2, 0);
    box(dark, w, h, t, 0, h / 2, -d / 2 + t / 2);
    box(wood, t, h, d, -w / 2 + t / 2, h / 2, 0); box(wood, t, h, d, w / 2 - t / 2, h / 2, 0);
    if (def.clock) {
      const face = new THREE.Mesh(Cache.geo('clock.face', () => new THREE.CircleGeometry(0.22, 24)), new THREE.MeshBasicMaterial({ color: 0xcfc6a0 })); face.position.set(0, h - 0.4, d / 2 + 0.05); g.add(face);
      const hand = box(world.mat(0x111111), 0.02, 0.16, 0.01, 0, h - 0.34, d / 2 + 0.06); hand.rotation.z = 0.6; room.clockHand = hand;
    }
    const doors = [];
    if (low) {
      const p = new THREE.Group(); p.position.set(0, h - 0.04, d / 2); g.add(p);
      const m = new THREE.Mesh(Cache.geo('box:' + w * 0.96 + ',' + (h - 0.1) + ',0.04', () => new THREE.BoxGeometry(w * 0.96, h - 0.1, 0.04)), wood); m.position.y = -(h - 0.1) / 2; m.castShadow = true; p.add(m); doors.push({ p, m, sgn: 1, lift: true });
    } else {
      [-1, 1].forEach(sg => {
        const p = new THREE.Group(); p.position.set(sg * w / 2, 0, d / 2); g.add(p);
        const m = new THREE.Mesh(Cache.geo('box:' + (w / 2 - 0.01) + ',' + (h - 0.05) + ',0.04', () => new THREE.BoxGeometry(w / 2 - 0.01, h - 0.05, 0.04)), wood); m.position.set(-sg * w / 4, h / 2, 0); m.castShadow = true; p.add(m);
        const k = new THREE.Mesh(Cache.geo('door.knob', () => new THREE.SphereGeometry(0.045, 10, 8)), world.mat(0xb08a45, 0.3, 0.9)); k.position.set(-sg * 0.06, h * 0.5, 0.05); p.add(k);
        doors.push({ p, m, sgn: sg });
      });
    }
    parts.meshes = doors.map(x => x.m);
    parts.apply = v => doors.forEach(x => { if (x.lift) x.p.rotation.x = -v * 1.3; else x.p.rotation.y = x.sgn * -v * 1.6 * -1; });
    parts.slot = { pos: lw(0, 0), y: low ? 0.38 : Math.min(h * 0.62, 1.5) };
    parts.front = lw(0, d / 2 + 0.75);
    world.addCollider(room, def.x, def.z, c * w / 2 + s * d / 2, s * w / 2 + c * d / 2);
    const body = box(wood, 0.01, 0.01, 0.01, 0, 0, 0); body.visible = false;
  } else if (def.type === 'curtain') {
    const wall = Math.abs(def.ry) === Math.PI / 2;
    const win = new THREE.Mesh(Cache.geo('plane:' + w + 'x' + h * 0.7, () => new THREE.PlaneGeometry(w * 0.8, h * 0.6)), world.windowMat()); win.position.set(0, h * 0.55, -d / 2 + 0.02); g.add(win);
    const frame = world.mat(0x120d09, 0.6);
    box(frame, w * 0.85, 0.08, 0.1, 0, h * 0.85, -d / 2 + 0.04); box(frame, w * 0.85, 0.08, 0.1, 0, h * 0.25, -d / 2 + 0.04);
    box(frame, 0.08, h * 0.6, 0.1, -w * 0.4, h * 0.55, -d / 2 + 0.04); box(frame, 0.08, h * 0.6, 0.1, w * 0.4, h * 0.55, -d / 2 + 0.04); box(frame, 0.05, h * 0.6, 0.08, 0, h * 0.55, -d / 2 + 0.04);
    box(world.mat(0x1a1a1a, 0.4, 0.8), w + 0.2, 0.04, 0.04, 0, h - 0.1, 0.1);
    const cloth = new THREE.MeshStandardMaterial({ color: 0x5a1618, roughness: 1, side: THREE.DoubleSide });
    const panels = [];
    [-1, 1].forEach(sg => {
      const p = new THREE.Group(); p.position.set(sg * w / 2, 0, 0.12); g.add(p);
      const geo = Cache.geo('curtain.panel' + w + h, () => { const gg = new THREE.PlaneGeometry(w / 2, h - 0.2, 14, 2); const pa = gg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 22) * 0.04); gg.computeVertexNormals(); return gg; });
      const m = new THREE.Mesh(geo, cloth); m.position.set(-sg * w / 4, (h - 0.2) / 2, 0); m.castShadow = true; p.add(m); panels.push({ p, m, sg });
    });
    parts.meshes = panels.map(x => x.m);
    parts.apply = v => panels.forEach(x => { x.p.scale.x = 1 - v * 0.8; });
    parts.crack = 0.22;
    parts.slot = { pos: lw(0, -d / 2 + 0.28), y: 1.5 };
    parts.front = lw(0, 0.9);
  } else if (def.type === 'under') {
    // under the bed: cloth valance with a flap at the foot
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1a1d2a, roughness: 1, side: THREE.DoubleSide });
    const vh = 0.5;
    const side = (x, z, ry, len) => { const m = new THREE.Mesh(Cache.geo('plane:' + len + 'x' + vh, () => new THREE.PlaneGeometry(len, vh)), cloth); m.position.set(x, vh / 2 + 0.05, z); m.rotation.y = ry; g.add(m); return m; };
    side(-w / 2 + 0.02, 0, Math.PI / 2, d); side(w / 2 - 0.02, 0, Math.PI / 2, d); side(0, -d / 2 + 0.02, 0, w);
    const flaps = [-1, 1].map(sg => { const p = new THREE.Group(); p.position.set(sg * w / 2, vh + 0.05, d / 2 - 0.02); g.add(p); const m = new THREE.Mesh(Cache.geo('plane:' + (w / 2) + 'x' + vh, () => new THREE.PlaneGeometry(w / 2, vh)), cloth); m.position.set(-sg * w / 4, -vh / 2, 0); p.add(m); return { p, m, sg }; });
    parts.meshes = flaps.map(f => f.m);
    parts.apply = v => flaps.forEach(f => { f.p.rotation.x = -v * 1.2; });
    parts.crack = 0.3;
    parts.slot = { pos: lw(0, -d * 0.1), y: 0.32 };
    parts.front = lw(0, d / 2 + 0.8);
  } else {   // coffin
    const t = 0.1, st = world.mat(0x34383c, 0.95);
    box(st, w, t, d, 0, t / 2, 0); box(st, t, h, d, -w / 2 + t / 2, h / 2, 0); box(st, t, h, d, w / 2 - t / 2, h / 2, 0); box(st, w, h, t, 0, h / 2, -d / 2 + t / 2); box(st, w, h, t, 0, h / 2, d / 2 - t / 2);
    const lid = box(world.mat(0x3d4044, 0.9), w + 0.1, 0.16, d + 0.1, 0, h + 0.08, 0);
    parts.meshes = [lid];
    parts.apply = v => { lid.position.z = v * d * 0.45; };
    parts.crack = 0.14; parts.slot = { pos: lw(0, 0), y: 0.5 };
    parts.front = lw(0, d / 2 + 0.9);
    world.addCollider(room, def.x, def.z, c * w / 2 + s * d / 2, s * w / 2 + c * d / 2);
  }
  const hs = new HideSpot(game, room, def, fake, parts, yaw);
  world.hideSpots[def.id] = hs; room.hides.push(hs);
  return hs;
}

class HideSpot extends Interactable {
  constructor(game, room, def, fake, parts, yaw) {
    super(game, { id: 'hide:' + def.id, room, meshes: parts.meshes, reach: 2.8, prompt: () => this.promptText(), onInteract: () => game.hiding.toggle(this) });
    this.def = def; this.fake = fake; this.parts = parts; this.yaw = yaw;
    this.slot = { x: parts.slot.pos[0], y: parts.slot.y, z: parts.slot.pos[1] };
    this.front = { x: parts.front[0], z: parts.front[1] };
    this.x = def.x; this.z = def.z;
    this.open = 0;
    this.burnedUntil = 0; this.lastCheck = -999; this.compromised = false; this.occupied = false;
    this.ghostHere = false;
  }
  promptText() {
    if (this.game.hiding.active === this) return 'Leave ' + this.def.label.toLowerCase();
    if (this.burned) return 'Hide in the ' + this.def.label.toLowerCase();
    return 'Hide in the ' + this.def.label.toLowerCase();
  }
  get burned() { return this.game.clockT < this.burnedUntil; }
  setOpen(v) { this.open = v; this.parts.apply(v); }
  tweenOpen(to, dur, done, key) {
    const from = this.open;
    this.game.tweens.add({ key: 'hs:' + this.def.id + (key || ''), dur, from, to, ease: Ease.inOutCubic, update: v => this.setOpen(v), done });
  }
}

// --------------------------------------------------------------------------
// Hiding controller
// --------------------------------------------------------------------------
class Hiding {
  constructor(game) {
    this.game = game;
    this.reset();
  }
  reset() {
    this.active = null; this.busy = false;
    this.stamina = 1; this.holding = false; this.exhausted = false; this.gaspT = 0;
    this.peekActive = false; this.peekT = 0; this.peekSpot = null; this.peekGhost = null; this.peekLoose = 0;
    this.trapT = 0; this.baseYaw = 0; this.savedFlash = true;
    this.arc = { yaw: 0.65, pitch: 0.3 };
  }

  toggle(spot) {
    if (this.busy || this.game.isDead) return;
    if (this.active === spot) this.leave(); else if (!this.active) this.enter(spot);
  }

  // Player noise 0..1 as the ghost perceives it from the spot's doorstep
  noise() {
    const g = this.game, k = g.keys;
    let n = this.holding ? 0 : 0.1;
    if (g.micActive) n = Math.max(n, g.micLevel > CONFIG.micThresholdHidden ? 0.3 + g.micLevel / 200 : g.micLevel / 220);
    if (k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight) n = Math.max(n, 0.7);
    if (this.gaspT > 0) n = Math.max(n, 0.65);
    return n;
  }

  poseTween(g, from, to, dur, done, key) {
    g.tweens.add({ key, dur, ease: Ease.inOutCubic, update: (v) => { g.setCameraPose(lerp(from.x, to.x, v), lerp(from.y, to.y, v), lerp(from.z, to.z, v), from.yaw + angleDiff(from.yaw, to.yaw) * v, lerp(from.pitch, to.pitch, v)); }, done });
  }

  enter(spot) {
    const g = this.game, gh = g.ghost;
    this.busy = true; g.inputLocked = true; g.interact.cancelPending();
    // seen going in? then this spot cannot protect you
    spot.compromised = !!(gh.inPlayerRoom() && gh.state !== 'DORMANT' && (gh.sees || (gh.state === 'HUNT' && gh.distToPlayer() < 5)));
    const cam = g.camera.position, from = { x: cam.x, y: cam.y, z: cam.z, yaw: g.euler.y, pitch: g.euler.x };
    const mid = { x: spot.front.x, y: g.eyeHeight(), z: spot.front.z, yaw: spot.yaw + Math.PI, pitch: 0 };
    const to = { x: spot.slot.x, y: spot.slot.y, z: spot.slot.z, yaw: spot.yaw, pitch: 0 };
    this.baseYaw = spot.yaw;
    g.audio.lid({ x: spot.x, y: 1, z: spot.z });
    g.makeNoise(spot.x, spot.z, g.currentRoom, 0.15, 'hide');
    spot.tweenOpen(1, 0.5);
    this.poseTween(g, from, mid, 0.45, () => {
      this.poseTween(g, mid, to, 0.55, () => {
        spot.tweenOpen(spot.parts.crack, 0.55, () => {
          this.active = spot; this.busy = false; g.inputLocked = false; spot.occupied = true;
          this.stamina = Math.max(this.stamina, 0.4);
          g.euler.set(0, spot.yaw, 0, 'YXZ');
          this.savedFlash = g.flashlightOn; g.setFlashlight(false);
          g.hud.setHidden(true); g.audio.breathe(0.12);
          g.audio.say('[You hold still]');
          if (spot.fake) this.startTrap(spot);
        }, 'cl');
        g.audio.doorClose(0.5, { x: spot.x, y: 1, z: spot.z });
      }, 'hp2');
    }, 'hp1');
  }

  leave(force) {
    const g = this.game, spot = this.active;
    if (!spot || this.busy) return;
    this.busy = true; g.inputLocked = true;
    const nearGhost = g.ghost.inPlayerRoom() && g.ghost.state !== 'DORMANT' && g.ghost.distToPlayer() < 5 && (g.ghost.state === 'SEARCH' || g.ghost.state === 'SUSPICIOUS' || g.ghost.state === 'HUNT') && spot.ghostHere;
    const cam = g.camera.position, from = { x: cam.x, y: cam.y, z: cam.z, yaw: g.euler.y, pitch: g.euler.x };
    const out = { x: spot.front.x, y: g.eyeHeight(), z: spot.front.z, yaw: spot.yaw, pitch: 0 };
    g.audio.lid({ x: spot.x, y: 1, z: spot.z });
    g.makeNoise(spot.x, spot.z, g.currentRoom, nearGhost ? 0.9 : 0.25, 'hide');
    spot.tweenOpen(1, 0.4);
    this.poseTween(g, from, out, 0.6, () => {
      spot.tweenOpen(0, 0.45, null, 'cl');
      this.active = null; this.busy = false; g.inputLocked = false; spot.occupied = false; this.trapT = 0; this.holding = false;
      g.euler.set(0, spot.yaw, 0, 'YXZ'); g.setFlashlight(this.savedFlash);
      g.hud.setHidden(false);
      if (spot.fake) { spot.burnedUntil = g.clockT + 9999; g.ghost.hiddenByScript = false; g.scares.trapEscape(); }
    }, 'hp1');
  }

  update(dt) {
    const g = this.game;
    this.gaspT -= dt;
    const want = !!(this.active && !this.busy && g.keys.Space);
    if (this.exhausted && this.stamina > 0.3) this.exhausted = false;
    this.holding = want && !this.exhausted && this.stamina > 0;
    if (this.holding) { this.stamina -= dt * 0.22; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.holding = false; this.gaspT = 0.7; g.audio.gasp(); g.makeNoise(this.active.x, this.active.z, g.currentRoom, 0.35, 'gasp'); } }
    else this.stamina = Math.min(1, this.stamina + dt * (this.exhausted ? 0.1 : 0.16));
    g.hud.setBreath(this.stamina, !!this.active, this.exhausted);
    if (!this.active) { this.peekLoose = 0; return; }
    // the cue so players know the rules
    const gh = g.ghost, near = gh.inPlayerRoom() && gh.state !== 'DORMANT' && gh.distToPlayer() < 12;
    g.hud.setHideCue(near ? (gh.checking || gh.distToPlayer() < 4 ? 'Quiet. It is close.' : 'Quiet. It is near.') : 'Safe for now. Press E to leave');
    g.fear.add(near ? 4 * dt : -3 * dt);
    // peek in progress
    if (this.peekActive && this.peekSpot === this.active) {
      this.peekT += dt;
      const n = this.noise();
      if (n > 0.18 || (!this.holding && Math.random() < dt * g.cfg.peekKill * 0.45)) { this.foundBy(this.peekGhost, this.peekSpot); return; }
    }
    // fake spot: the thing already inside with you
    if (this.trapT > 0) {
      this.trapT -= dt;
      if (this.trapT < 1.9 && !this.trapWarned) { this.trapWarned = true; g.hud.toast('Something is breathing next to you. Get out'); g.audio.breathe(0.35); g.audio.whisper({ x: this.active.slot.x, y: 1.4, z: this.active.slot.z }, 0.45); g.scares.trapFace(this.active); }
      if (this.trapT <= 0) { this.trapT = 0; g.scares.death('trap'); }
    }
  }

  startTrap(spot) { this.trapT = 2.8; this.trapWarned = false; spot.tweenOpen(0.5, 0.6); }

  // ---- ghost checks the spot --------------------------------------------------
  pickSpotToCheck(ghost) {
    const room = ghost.room, lk = ghost.lastKnown || { x: ghost.x, z: ghost.z };
    const cands = room.hides.filter(h => !h.burned && !h.ghostHere);
    if (!cands.length) return null;
    return RNGPick(cands, h => {
      let w = 2.2 / (1 + dist2D(h.x, h.z, lk.x, lk.z) / 2.5);
      if (this.active === h) w += 1.1 * (ghost.lastNoise && ghost.game.clockT - ghost.lastNoise.t < 15 ? 2 : 1);
      if (h.fake) w *= 0.6;
      return w;
    });
  }

  startPeek(ghost, spot) {
    const g = this.game;
    this.peekActive = true; this.peekT = 0; this.peekSpot = spot; this.peekGhost = ghost;
    ghost.formTarget = 2; ghost.P.headTilt = 0.35; ghost.P.jaw = 0.2;
    g.audio.creak({ x: spot.x, y: 1.4, z: spot.z }, 0.5, 0.15);
    spot.tweenOpen(this.active === spot ? spot.parts.crack + 0.28 : 0.9, 1.6, null, 'pk');
    if (this.active === spot) { g.scares.peek(ghost, spot); g.fear.add(25); g.hud.setHideCue('Do not move. Hold your breath.'); }
    const dur = this.active === spot ? 3.4 : 1.8;
    g.tweens.after(dur, () => this.endPeek(ghost, spot), 'peekend');
  }

  endPeek(ghost, spot) {
    const g = this.game;
    if (!this.peekActive) return;
    this.peekActive = false; ghost.P.jaw = 0; ghost.P.headTilt = 0;
    if (this.active === spot) { spot.tweenOpen(spot.parts.crack, 0.8, null, 'pk'); g.hud.toast('It lingers, then moves on'); g.audio.say('[It leaves]'); g.fear.add(-10); }
    else spot.tweenOpen(0, 0.8, null, 'pk');
    g.scares.peekEnd();
  }

  foundBy(ghost, spot) {
    const g = this.game;
    if (this.peekActive) { this.peekActive = false; g.tweens.cancel('peekend'); }
    g.scares.hidingKill(ghost, spot);
  }
}

// weighted pick helper
function RNGPick(list, wfn) {
  let total = 0; const w = list.map(x => { const v = Math.max(0.01, wfn(x)); total += v; return v; });
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
