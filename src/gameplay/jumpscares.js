'use strict';
// ==========================================================================
// JUMPSCARES: scripted events that borrow the ghost model. Lethal scares are
// loud and harsh (shriek). Fake-outs use a dull, metallic sting so players can
// learn the difference. Each has its own camera behaviour, timing and sound.
// ==========================================================================
const DEATH_TEXT = {
  ghost: ['It found you in the dark', 'Something was watching, and you were noisy'],
  hiding: ['It knew where you were hiding', 'The door opened. Nothing could stop it'],
  trap: ['The hiding place was not empty'],
  ceiling: ['It was above you the whole time'],
  corridor: ['It was never far behind'],
  exit: ['So close to the door'],
  dawn: ['The sun rose. The house let you go. Nothing was settled']
};

class Jumpscares {
  constructor(game) { this.game = game; this.saved = null; this.busy = false; this.last = {}; }

  // ---- scripted ghost helpers ------------------------------------------------
  beginScript() {
    const g = this.game, gh = g.ghost;
    if (!this.saved) this.saved = { room: gh.roomId, x: gh.x, z: gh.z, state: gh.state, dormantT: gh.dormantT };
    gh.scripted = true; gh.hiddenByScript = false; gh.dissolve = 0; gh.roomId = g.currentRoom; gh.entering = 0;
    return gh;
  }
  endScript(relocate) {
    const g = this.game, gh = g.ghost;
    if (!this.saved) return;
    gh.scripted = false; gh.hiddenByScript = false; gh.setLayers(0); gh.group.rotation.z = 0; gh.groundY = 0; gh.dissolve = 0; gh.setPose({});
    const s = this.saved; this.saved = null;
    // never leave it standing where the player can see it pop out of a scare
    if (relocate !== false) {
      const far = ['parlor', 'kitchen', 'library', 'bedroom', 'corridor'].filter(r => r !== g.currentRoom && g.world.rooms[r].role !== 'safe');
      gh.spawnIn(far[Math.floor(g.rand() * far.length)] || s.room);
      gh.state = 'NONE'; gh.setState('PATROL');
      if (s.state === 'DORMANT') { gh.state = 'DORMANT'; gh.dormantT = s.dormantT; }
    } else { gh.roomId = s.room; gh.place(s.x, s.z, gh.yaw); }
    gh.goal = null; gh.path = []; gh.routeDoors = []; gh.dwellT = 1;
  }
  inFrontOfPlayer(dist) {
    const g = this.game, cam = g.camera, f = TMP.v1.set(0, 0, -1).applyQuaternion(cam.quaternion); f.y = 0; f.normalize();
    const room = g.room;
    for (let d = dist; d > 0.5; d -= 0.15) {
      const x = cam.position.x + f.x * d, z = cam.position.z + f.z * d;
      if (!room.blocked(x, z, 0.3)) return { x, z, d };
    }
    return { x: cam.position.x + f.x * 0.6, z: cam.position.z + f.z * 0.6, d: 0.6 };
  }
  headTarget(gh) { return new THREE.Vector3(gh.x, 2.0 + (gh.groundY || 0), gh.z); }

  // ---- 1. Death: snaps to face you, the camera is forced to look at it ----------
  death(type) {
    const g = this.game;
    if (g.isDead || g.hasWon || g.god) return;
    g.isDead = true; g.inputLocked = true; g.interact.cancelPending(); g.audio.setChase(false);
    if (g.hiding.active) { g.hud.setHidden(false); }
    const gh = this.beginScript();
    gh.formTarget = 2; gh.form = 2; gh.eyeColor.setHex(0xff2020); gh.setState('HUNT'); gh.setPose({ jaw: 0.2, arms: 0.8 });
    gh.groundY = type === 'trap' ? -0.2 : 0;
    const p = type === 'ceiling' ? { x: g.camera.position.x, z: g.camera.position.z + 0.01, d: 0 } : this.inFrontOfPlayer(1.15);
    const toCam = Math.atan2(g.camera.position.x - p.x, g.camera.position.z - p.z);
    gh.place(p.x, p.z, toCam, gh.groundY);
    gh.group.visible = true;
    g.forceLook(new THREE.Vector3(p.x, 2.05, p.z), 12);
    g.cameraShake(0.7); g.screenFX.glitch(1);
    g.tweens.after(0.12, () => { gh.setPose({ jaw: 1, arms: 1, scream: 1 }); g.audio.shriek(); g.fear.set(100); });
    g.tweens.add({ key: 'deathfov', dur: 1.2, ease: Ease.inQuad, update: v => { g.camera.fov = lerp(g.baseFov, 48, v); g.camera.updateProjectionMatrix(); } });
    g.tweens.after(1.35, () => g.hud.flash(0.35));
    g.tweens.after(1.7, () => { g.hud.blackout(true); });
    g.tweens.after(2.25, () => g.showDeath(type));
  }

  // ---- 2a. Hiding spot: it pulls the door open and takes you --------------------------
  hidingKill(ghost, spot) {
    const g = this.game;
    if (g.isDead || g.god) return;
    const gh = this.beginScript();
    g.inputLocked = true;
    gh.formTarget = 2; gh.form = 2; gh.setPose({ arms: 1, jaw: 0.3 }); gh.eyeColor.setHex(0xff2020);
    gh.groundY = spot.slot.y < 0.6 ? 0 : -0.45;
    if (spot.slot.y < 0.6) gh.setPose({ crawl: 1, jaw: 0.4 });
    gh.place(spot.front.x, spot.front.z, Math.atan2(spot.x - spot.front.x, spot.z - spot.front.z), gh.groundY);
    gh.group.visible = true;
    spot.tweenOpen(1, 0.16, null, 'kill');
    g.audio.doorSlam({ x: spot.x, y: 1.2, z: spot.z });
    g.isDead = true;
    g.forceLook(new THREE.Vector3(gh.x, spot.slot.y < 0.6 ? 0.6 : 1.9, gh.z), 14);
    g.cameraShake(0.7); g.screenFX.glitch(1);
    g.tweens.after(0.2, () => { gh.setPose({ jaw: 1, arms: 1, scream: 1, crawl: spot.slot.y < 0.6 ? 1 : 0 }); g.audio.shriek(); });
    g.tweens.after(1.3, () => g.hud.flash(0.3));
    g.tweens.after(1.6, () => g.hud.blackout(true));
    g.tweens.after(2.2, () => g.showDeath('hiding'));
  }

  // ---- 2b. Hiding spot: it peers through the gap and may leave --------------------------
  peek(ghost, spot) {
    const g = this.game;
    this.beginScript(); const gh = ghost;
    gh.scripted = true; gh.formTarget = 2; gh.form = Math.max(gh.form, 1.5);
    gh.groundY = spot.slot.y < 0.6 ? 0 : -0.55;
    gh.setPose({ lean: 1, headTilt: 0.35, jaw: 0.15 });
    if (spot.slot.y < 0.6) gh.setPose({ crawl: 1, jaw: 0.15 });
    gh.place(spot.front.x, spot.front.z, Math.atan2(spot.x - spot.front.x, spot.z - spot.front.z), gh.groundY);
    g.cameraShake(0.08); g.audio.breathe(0.4, { x: spot.front.x, y: 1.5, z: spot.front.z });
    g.screenFX.pulse(0.4);
  }
  peekEnd() {
    const g = this.game, gh = g.ghost;
    if (this.saved && gh.scripted) { gh.groundY = 0; gh.setPose({}); gh.scripted = false; this.saved = null; gh.dwellT = 0; gh.goal = null; gh.path = []; gh.beginSearch(5); gh.checking = null; gh.checksLeft = 1; }
  }

  // ---- 2c. The fake hiding spot: something is already inside ---------------------------------
  trapFace(spot) {
    const g = this.game, gh = this.beginScript(), a = spot.yaw;
    const rx = Math.cos(a), rz = -Math.sin(a);                          // player's right in world
    gh.hiddenByScript = false; gh.formTarget = 2; gh.eyeColor.setHex(0xff3030); gh.groundY = spot.slot.y < 0.6 ? 0 : -0.2;
    gh.place(spot.slot.x + rx * 0.5 + Math.sin(a) * 0.15, spot.slot.z + rz * 0.5 + Math.cos(a) * 0.15, a + Math.PI * 0.85, gh.groundY);
    gh.form = 0; gh.setPose({ jaw: 0.5, headTilt: 0.5 });
    gh.group.visible = true; g.cameraShake(0.12); g.screenFX.pulse(0.6);
  }
  trapEscape() {
    const g = this.game, gh = g.ghost;
    g.audio.stun(); g.fear.add(25); g.hud.toast('You got out in time');
    g.tweens.add({ dur: 0.5, update: v => { gh.dissolve = v; }, done: () => { this.endScript(); } });
  }

  // ---- 3. Mirror: it stands behind you, only in the reflection ----------------------------------
  mirror() {
    const g = this.game, room = g.room, m = room.mirror;
    if (!m || this.busy || g.isDead) return false;
    const cam = g.camera, p = cam.position;
    const mp = TMP.v2.setFromMatrixPosition(m.mesh.matrixWorld);
    if (p.distanceTo(mp) > 6.5) return false;
    const f = TMP.v1.set(0, 0, -1).applyQuaternion(cam.quaternion); f.y = 0; f.normalize();
    const toM = TMP.v3.copy(mp).sub(p); toM.y = 0; toM.normalize();
    if (f.dot(toM) < 0.55) return false;
    this.busy = true;
    const gh = this.beginScript(), back = new THREE.Vector3(-f.x, 0, -f.z);
    let d = 2.4, x, z;
    for (; d > 0.9; d -= 0.2) { x = p.x + back.x * d; z = p.z + back.z * d; if (!room.blocked(x, z, 0.35)) break; }
    gh.setLayers(1); gh.formTarget = 2; gh.form = 0; gh.eyeColor.setHex(0xa8e8ff); gh.setPose({ arms: 0.1, headTilt: 0.25 });
    gh.place(x, z, Math.atan2(p.x - x, p.z - z), 0); gh.group.visible = true;
    g.audio.whisper({ x, y: 1.5, z }, 0.4); g.fear.add(14);
    g.tweens.add({ dur: 0.6, update: v => { gh.form = 2 * v; } });
    let t = 0, gone = false;
    const done = () => { if (gone) return; gone = true; this.busy = false; g.audio.stingSoft(); g.audio.whisper(null, 0.3); gh.setLayers(0); this.endScript(); };
    const watch = g.tweens.add({ dur: 4.5, update: () => {
      t += 0.016; const yawToGhost = Math.atan2(-(x - cam.position.x), -(z - cam.position.z));
      const look = Math.abs(angleDiff(g.euler.y, yawToGhost)) < 0.9;
      if (look && t > 0.5 && !gone) { gh.dissolve = 1; done(); watch.dead = true; }
    }, done });
    return true;
  }
}

// --------------------------------------------------------------------------
// Corridor sprint, ceiling crawl, fake-outs, cinematics
// --------------------------------------------------------------------------
Object.assign(Jumpscares.prototype, {
  // ---- 4. Corridor: it appears at the far end and sprints at you in a burst -----------------
  corridor(lethal) {
    const g = this.game;
    if (g.currentRoom !== 'corridor' || this.busy || g.isDead) return false;
    this.busy = true;
    const p = g.camera.position, endZ = p.z > 0 ? -10.8 : 10.8, gh = this.beginScript();
    gh.formTarget = 2; gh.form = 1.2; gh.eyeColor.setHex(0xffe080); gh.setPose({ arms: 1, jaw: 0.5 });
    gh.place(0, endZ, Math.atan2(0, -endZ), 0); gh.group.visible = true; g.flickerLights(1.2);
    g.audio.growl({ x: 0, y: 1.4, z: endZ }); g.screenFX.pulse(0.5); g.fear.add(12);
    const startZ = endZ, tz = p.z + (endZ < p.z ? -3.2 : 3.2);
    g.tweens.add({ delay: 0.9, dur: 1.15, ease: Ease.inQuad,
      update: v => { gh.z = lerp(startZ, tz, v); gh.x = (Math.floor(v * 14) % 2 ? 0.05 : -0.05); gh.yaw = Math.atan2(p.x - gh.x, p.z - gh.z); gh.P.scream = v; gh.P.jaw = v; },
      done: () => {
        if (lethal) { this.busy = false; this.endScript(false); g.ghost.lastKnown = { room: 'corridor', x: p.x, z: p.z, t: g.clockT }; this.death('corridor'); return; }
        g.audio.stingSoft(); g.screenFX.glitch(0.6); g.cameraShake(0.3);
        g.tweens.add({ dur: 0.35, update: v => { gh.dissolve = v; }, done: () => { this.busy = false; this.endScript(); } });
      } });
    return true;
  },

  // ---- 5. Ceiling: crawls overhead, stops above you, then slinks away (or drops) ------------------
  ceiling(lethal) {
    const g = this.game, room = g.room;
    if (this.busy || g.isDead || g.hiding.active) return false;
    this.busy = true;
    const gh = this.beginScript(), p = g.camera.position, b = room.bounds;
    gh.formTarget = 2; gh.form = 1.4; gh.eyeColor.setHex(0xffb040); gh.setPose({ jaw: 0.3, arms: 0.9 });
    gh.group.rotation.z = Math.PI; gh.groundY = room.H + 0.05;
    const sx = p.x > room.cx ? b.minX + 0.8 : b.maxX - 0.8, sz = p.z > room.cz ? b.minZ + 0.8 : b.maxZ - 0.8;
    gh.place(sx, sz, 0, gh.groundY); gh.group.visible = true;
    g.audio.creak({ x: sx, y: room.H, z: sz }, 0.5, 0.2); g.fear.add(10);
    const scratch = () => g.audio.noise({ filter: 'bandpass', f0: 1500, q: 2, dur: 0.09, gain: 0.12, pos: { x: gh.x, y: room.H, z: gh.z } });
    let n = 0;
    g.tweens.add({ dur: 2.4, ease: Ease.inOutQuad,
      update: v => { const stp = Math.floor(v * 16); if (stp !== n) { n = stp; scratch(); } gh.x = lerp(sx, p.x, v); gh.z = lerp(sz, p.z, v); gh.yaw = Math.atan2(p.x - gh.x, p.z - gh.z) + (stp % 2 ? 0.05 : 0); },
      done: () => {
        gh.setPose({ headTilt: 0.5, jaw: 0.6, arms: 1 }); gh.yaw = Math.atan2(p.x - gh.x, p.z - gh.z);
        g.audio.breathe(0.4, { x: gh.x, y: room.H, z: gh.z }); g.screenFX.pulse(0.7);
        g.tweens.after(1.3, () => {
          if (lethal) {
            gh.setPose({ jaw: 1, scream: 1 }); g.audio.shriek();
            g.tweens.add({ dur: 0.22, ease: Ease.inQuad, update: v => { gh.groundY = lerp(room.H + 0.05, 0.1, v); gh.group.rotation.z = Math.PI * (1 - v); }, done: () => { this.busy = false; this.endScript(false); this.death('ceiling'); } });
          } else {
            g.audio.stingSoft();
            g.tweens.add({ dur: 1.0, ease: Ease.inQuad, update: v => { gh.x = lerp(p.x, sx, v); gh.z = lerp(p.z, sz, v); gh.dissolve = v * v; }, done: () => { this.busy = false; this.endScript(); } });
          }
        });
      } });
    return true;
  },

  // ---- 6. Fake-outs: harmless events with a soft, metallic sting -----------------------------------
  fakeout(kind) {
    const g = this.game, room = g.room, p = g.camera.position;
    kind = kind || ['bat', 'painting', 'door', 'chair'][Math.floor(g.rand() * 4)];
    const f = TMP.v1.set(0, 0, -1).applyQuaternion(g.camera.quaternion); f.y = 0; f.normalize();
    if (kind === 'bat') this.batSwarm(room, p.x - f.x * 3, p.z - f.z * 3, f.x, f.z, 14);
    else if (kind === 'painting') {
      const x = clamp(p.x + f.x * 2.5, room.bounds.minX + 0.5, room.bounds.maxX - 0.5), z = clamp(p.z + f.z * 2.5, room.bounds.minZ + 0.5, room.bounds.maxZ - 0.5);
      const m = new THREE.Mesh(Cache.geo('fall.p', () => new THREE.BoxGeometry(0.7, 0.9, 0.06)), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.6 }));
      m.position.set(x, 2.0, z); room.group.add(m); const v = { y: 0 };
      g.tweens.add({ dur: 0.45, ease: Ease.inQuad, update: k => { m.position.y = lerp(2.0, 0.05, k); m.rotation.z = k * 0.4; }, done: () => { g.audio.paintingFall({ x, y: 0.2, z }); g.makeNoise(x, z, room.id, 0.6, 'crash', true); g.tweens.after(4, () => { room.group.remove(m); m.material.dispose(); }); } });
    } else if (kind === 'door') {
      const open = room.doors.filter(d => d.isOpen && d.def.kind !== 'fake')[0] || room.doors.filter(d => !d.lock && d.def.kind === 'door')[0];
      if (open) { open.slam(1); g.cameraShake(0.2); } else g.audio.thud(null, 1);
    } else { g.audio.chairSlide({ x: p.x - f.x * 3, y: 0.4, z: p.z - f.z * 3 }); if (room.rocker) room.rocker.userData.fast = 3; }
    g.audio.stingSoft(); g.fear.add(8); g.screenFX.pulse(0.3);
    return true;
  },

  batSwarm(room, x, z, dx, dz, n) {
    const g = this.game, mat = new THREE.MeshBasicMaterial({ color: 0x050407, side: THREE.DoubleSide });
    const geo = Cache.geo('batfly', () => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.2, 0, -0.06, 0.08, 0, 0.12, 0, 0, 0, -0.2, 0, -0.06, -0.08, 0, 0.12]), 3)); gg.computeVertexNormals(); return gg; });
    const bats = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); m.position.set(x + (Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 1.2, z + (Math.random() - 0.5) * 1.2); room.group.add(m); bats.push({ m, ph: Math.random() * 6, vy: (Math.random() - 0.2) * 0.8, s: 5 + Math.random() * 4 }); }
    g.audio.bats({ x, y: 1.5, z });
    let t = 0;
    g.tweens.add({ dur: 2.6, update: (v, k) => { t += 0.016; bats.forEach(b => { b.m.position.x += dx * b.s * 0.016 + Math.sin(t * 6 + b.ph) * 0.02; b.m.position.z += dz * b.s * 0.016 + Math.cos(t * 5 + b.ph) * 0.02; b.m.position.y += b.vy * 0.016; b.m.rotation.y = Math.atan2(dx, dz); b.m.scale.y = Math.sin(t * 30 + b.ph) > 0 ? 1 : 0.4; }); }, done: () => bats.forEach(b => { room.group.remove(b.m); }) });
  },

  // ---- relic cinematic, final door, house awakens --------------------------------------------
  relic(pos) {
    const g = this.game;
    g.inputLocked = true; g.audio.roar(); g.cameraShake(0.5);
    g.forceLook(new THREE.Vector3(pos.x, pos.y, pos.z), 6);
    g.flickerLights(2.5); g.screenFX.glitch(0.8); g.hud.alert('The house wakes');
    g.tweens.after(1.6, () => { g.releaseLook(); g.inputLocked = false; this.houseAwakens(); });
  },

  houseAwakens() {
    const g = this.game;
    g.redAlert = true; g.lightsOut(2.4, true);
    Object.values(g.world.doors).forEach(d => { if (d.def.kind === 'fake' || d.def.kind === 'exit') return; if (d.isOpen) { d.snapQuick(false); } });
    g.tweens.after(0.4, () => { g.audio.doorSlam(null); g.audio.thud(null, 1); });
    g.tweens.after(1.1, () => g.audio.roar());
    g.audio.whisper(null, 0.6);
    const gh = g.ghost; gh.lastKnown = { room: g.currentRoom, x: g.camera.position.x, z: g.camera.position.z, t: g.clockT };
    gh.state = 'NONE'; gh.dormantT = 0; gh.spawnIn(g.currentRoom === 'corridor' ? 'parlor' : 'corridor'); gh.setState('HUNT'); gh.goTo(g.currentRoom, gh.lastKnown.x, gh.lastKnown.z);
    g.hud.setObjective('Run to the front door');
  },

  // Standing at the sealed exit with the relic: the last thing in the house reacts
  exitScare() {
    const g = this.game;
    if (this.exitDone) return; this.exitDone = true;
    g.audio.rattle({ x: 0, y: 1.3, z: 12 }); g.audio.thud(null, 1); g.cameraShake(0.35); g.flickerLights(1.4);
    g.tweens.after(0.6, () => {
      const gh = g.ghost; gh.state = 'NONE'; gh.dormantT = 0; gh.roomId = 'corridor'; gh.place(0, -2, 0); gh.setState('PATROL');
      gh.lastKnown = { room: 'corridor', x: g.camera.position.x, z: g.camera.position.z, t: g.clockT }; gh.startHunt();
      g.screenFX.glitch(0.7);
    });
  },

  names: ['death', 'hiding kill', 'peek', 'mirror', 'corridor', 'corridor (lethal)', 'ceiling', 'ceiling (lethal)', 'fakeout: bat', 'fakeout: painting', 'fakeout: door', 'fakeout: chair', 'house awakens'],
  debugTrigger(name) {
    const g = this.game;
    if (name === 'death') this.death('ghost');
    else if (name === 'hiding kill') { const s = Object.values(g.world.hideSpots).find(h => h.room.id === g.currentRoom) || Object.values(g.world.hideSpots)[0]; this.hidingKill(g.ghost, s); }
    else if (name === 'peek') { const s = g.room.hides[0]; if (s) { g.ghost.roomId = g.currentRoom; g.ghost.scripted = false; g.ghost.checking = { spot: s, phase: 'peek', t: 0 }; g.hiding.startPeek(g.ghost, s); } }
    else if (name === 'mirror') { if (!this.mirror()) g.hud.toast('Face the mirror in the bedroom first'); }
    else if (name === 'corridor') this.corridor(false); else if (name === 'corridor (lethal)') this.corridor(true);
    else if (name === 'ceiling') this.ceiling(false); else if (name === 'ceiling (lethal)') this.ceiling(true);
    else if (name.indexOf('fakeout') === 0) this.fakeout(name.split(': ')[1]);
    else if (name === 'house awakens') this.houseAwakens();
  }
});
