'use strict';
// ==========================================================================
// GHOST AI: patrols the whole house, hears and sees the player, hunts, searches,
// checks hiding places, opens doors, can be stunned or repelled.
// States: DORMANT PATROL SUSPICIOUS HUNT SEARCH STUNNED REPELLED
// ==========================================================================
// Object.assign would call getters instead of copying them, so define these properly
Object.defineProperties(Ghost.prototype, {
  room: { get() { return this.game.world.rooms[this.roomId]; } },
  cfg: { get() { return this.game.cfg; } }
});

Object.assign(Ghost.prototype, {
  initAI() {
    this.roomId = 'parlor'; this.x = 0; this.z = 0; this.yaw = 0;
    this.state = 'DORMANT'; this.stateT = 0;
    this.path = []; this.routeDoors = []; this.doorStep = 0; this.goal = null;
    this.sees = false; this.noticeT = 0; this.lostT = 0; this.lastSeenT = -99;
    this.lastKnown = null;
    this.stunT = 0; this.stunCd = 0; this.repelT = 0;
    this.scripted = false; this.aiEnabled = true;
    this.dwellT = 0; this.burstT = 0; this.openT = 0; this.lookT = 0; this.repathT = 0;
    this.checking = null; this.checksLeft = 0; this.safeT = 0;
    this.entering = 0; this.dormantT = 0; this.sinceNear = 0; this.lastNoise = null;
    this.speedMul = 1; this.huntT = 0; this.resist = 0;
  },

  reset(roomId) {
    this.initAI();
    this.dissolve = 0; this.form = 0; this.formTarget = 0;
    this.setPose({});
    const cfg = this.game.cfg;
    this.dormantT = cfg.label === 'Easy' ? 40 : cfg.label === 'Nightmare' ? 14 : 24;
    const rooms = ['parlor', 'kitchen', 'library', 'bedroom'].filter(r => this.game.world.rooms[r].role !== 'safe');
    const r = roomId || rooms[Math.floor(this.game.rand() * rooms.length)] || 'parlor';
    this.spawnIn(r);
  },

  spawnIn(roomId) {
    const room = this.game.world.rooms[roomId], pts = room.waypoints, pl = this.game.camera.position;
    let best = pts[0] || { x: room.cx, z: room.cz };
    pts.forEach(p => { if (this.game.rand() < 0.35 || !best) best = p; });
    this.roomId = roomId; this.place(best.x, best.z, 0);
    this.path = []; this.routeDoors = [];
  },

  inPlayerRoom() { return this.roomId === this.game.currentRoom; },
  setState(s) {
    if (this.state === s) return;
    // leaving a hiding-place check: release the spot so it can be checked again later
    if (this.checking && s !== 'SEARCH') { this.checking.spot.ghostHere = false; this.checking = null; }
    this.state = s; this.stateT = 0; this.onState(s);
  },
  onState(s) {
    const g = this.game;
    if (s === 'HUNT') { this.huntT = 0; g.audio.setChase(true); this.formTarget = 2; this.eyeColor.setHex(0xff2a2a); this.P.arms = 0.7; }
    else {
      if (this.state !== 'STUNNED') g.audio.setChase(false);
      this.eyeColor.setHex(s === 'SUSPICIOUS' || s === 'SEARCH' ? 0xffb050 : 0xa8e8ff);
      if (s !== 'STUNNED') this.P.arms = 0;
      this.formTarget = (s === 'PATROL' || s === 'DORMANT') ? 0.55 : 1;
    }
  },

  // ---- player helpers -----------------------------------------------------
  px() { return this.game.camera.position.x; }, pz() { return this.game.camera.position.z; },
  distToPlayer() { return this.inPlayerRoom() ? dist2D(this.x, this.z, this.px(), this.pz()) : 999; },

  // Rough number of room hops to the player (for presence and noise)
  hopsToPlayer() {
    if (this.inPlayerRoom()) return 0;
    const p = WORLD_DATA.roomPath(this.roomId, this.game.currentRoom, this.game.unlocked);
    return p ? p.length : 9;
  },
  presence() {
    if (this.state === 'DORMANT') return 0;
    if (this.inPlayerRoom()) return clamp(1 - this.distToPlayer() / 13, 0, 1);
    return this.hopsToPlayer() === 1 ? 0.22 : 0;
  },

  // ---- sight ---------------------------------------------------------------
  updateSight(dt) {
    const g = this.game, hid = g.hiding.active;
    let see = false;
    if (this.inPlayerRoom() && !this.scripted && !(this.state === 'STUNNED')) {
      const d = this.distToPlayer();
      let range = this.cfg.sight * (g.flashlightOn ? 1.15 : 0.85) * (g.isCrouching ? 0.65 : 1);
      if (hid && !hid.compromised) range = 0;
      if (hid && hid.compromised) range = 99;
      if (d < range) {
        const toP = Math.atan2(this.px() - this.x, this.pz() - this.z), fov = this.state === 'HUNT' ? Math.PI : 1.4;
        if (Math.abs(angleDiff(this.yaw, toP)) < fov && this.room.lineClear(this.x, this.z, this.px(), this.pz(), 0.15)) see = true;
      }
    }
    this.sees = see;
    if (see) {
      this.lastSeenT = g.clockT; this.lostT = 0;
      this.lastKnown = { room: this.roomId, x: this.px(), z: this.pz(), t: g.clockT };
      this.noticeT += dt * (this.distToPlayer() < 4 ? 2.4 : 1);
      if (this.noticeT > 0.5 && (this.state === 'PATROL' || this.state === 'SUSPICIOUS' || this.state === 'SEARCH' || this.state === 'DORMANT')) this.startHunt();
    } else { this.noticeT = Math.max(0, this.noticeT - dt * 0.8); this.lostT += dt; }
  },

  startHunt() {
    if (this.state === 'HUNT' || this.state === 'STUNNED' || this.state === 'REPELLED') return;
    this.checking = null; this.setState('HUNT');
    this.game.audio.roar(); this.game.fear.add(18);
    this.game.hud.alert('It has seen you');
    this.game.story.onHunt();
    this.path = []; this.routeDoors = [];
  },

  // ---- hearing ---------------------------------------------------------------
  hear(n) {
    if (this.state === 'DORMANT' || this.state === 'STUNNED' || this.state === 'REPELLED' || this.scripted) return;
    // busy at a hiding place: what you hear from in there is judged by the hiding rules instead
    if (this.checking && this.state === 'SEARCH') return;
    const cfg = this.cfg, range = CONFIG.hearRange * n.loud * cfg.hearing * (this.safeT > 0 ? 0.5 : 1) * (1 + this.game.stage * 0.08) * (this.game.midnight ? CONFIG.midnight.hearing : 1);
    let eff = -1;
    if (n.room === this.roomId) eff = range - dist2D(n.x, n.z, this.x, this.z);
    else {
      const path = WORLD_DATA.roomPath(this.roomId, n.room, this.game.unlocked);
      if (path && path.length <= 3) {
        let r = range / (1 + path.length * 1.5);
        path.forEach(id => { const d = this.game.world.doors[id]; if (d && d.t < 0.3) r *= 0.55; });
        eff = r - 5;
      }
    }
    if (eff <= 0) return;
    this.lastNoise = { room: n.room, x: n.x, z: n.z, t: this.game.clockT, loud: n.loud, type: n.type };
    this.P.headTilt = 0.35 * (this.game.rand() < 0.5 ? -1 : 1);
    if (this.state === 'HUNT') { this.lastKnown = { room: n.room, x: n.x, z: n.z, t: this.game.clockT }; return; }
    if (n.loud >= 0.7 && eff > range * 0.25) { this.lastKnown = { room: n.room, x: n.x, z: n.z, t: this.game.clockT }; this.startHunt(); return; }
    this.lastKnown = { room: n.room, x: n.x, z: n.z, t: this.game.clockT };
    this.setState('SUSPICIOUS');
    this.goTo(n.room, n.x, n.z);
    if (this.inPlayerRoom()) { this.game.audio.growl({ x: this.x, y: 1.4, z: this.z }); }
  },

  // ---- movement ----------------------------------------------------------------
  goTo(roomId, x, z) {
    this.goal = { room: roomId, x, z };
    this.routeDoors = []; this.doorStep = 0;
    if (roomId !== this.roomId) {
      const r = WORLD_DATA.roomPath(this.roomId, roomId, this.game.unlocked);
      if (!r) { this.goal = null; return false; }
      this.routeDoors = r;
      const d = this.game.world.doors[r[0]], a = d.approach;
      this.path = this.room.nav.findPath(this.x, this.z, a[0], a[1]);
    } else this.path = this.room.nav.findPath(this.x, this.z, x, z);
    this.pathStage = 0;
    return true;
  },

  // Steps along the current path. Returns true when the path is empty.
  moveAlong(dt, speed) {
    if (!this.path.length) return true;
    const t = this.path[0], dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    this.yaw += angleDiff(this.yaw, want) * Math.min(1, dt * 6);
    // while it can see you it moves in jerky bursts (stop-motion)
    let mul = 1;
    if (this.state === 'HUNT' && this.sees) { this.burstT += dt; const ph = this.burstT % 0.4; mul = ph < 0.22 ? 1.7 : 0; }
    const step = speed * mul * dt;
    if (d <= step + 0.05) { this.x = t.x; this.z = t.z; this.path.shift(); }
    else { this.x += (dx / d) * step; this.z += (dz / d) * step; }
    return !this.path.length;
  },

  // Follows routeDoors across rooms, then the path to the goal. 'arrived' | 'moving' | 'failed'
  followRoute(dt, speed) {
    if (this.openT > 0) { this.openT -= dt; return 'moving'; }
    const w = this.game.world;
    if (this.routeDoors.length) {
      const door = w.doors[this.routeDoors[0]];
      if (!door) return 'failed';
      if (!this.moveAlong(dt, speed)) return 'moving';
      const a = door.approach;
      if (this.pathStage === 0) {
        if (dist2D(this.x, this.z, a[0], a[1]) > 1.2) { this.path = this.room.nav.findPath(this.x, this.z, a[0], a[1]); return 'moving'; }
        if (door.lock || door.jamT > 0) return 'failed';
        if (!door.isOpen) { door.open(false, true); this.openT = 0.95; this.yaw = yawFromDir(-door.n[0], -door.n[1]) + Math.PI; this.yaw = Math.atan2(-door.n[0], -door.n[1]); return 'moving'; }
        if (door.t < 0.7) { this.openT = 0.15; return 'moving'; }
        const dp = door.toWorld(0, 0.15); this.path = [{ x: dp[0], z: dp[1] }]; this.pathStage = 1; return 'moving';
      }
      this.passDoor(door);
      return 'moving';
    }
    if (this.moveAlong(dt, speed)) return 'arrived';
    return 'moving';
  },

  passDoor(door) {
    const g = this.game, pair = door.pair;
    if (!pair) { this.routeDoors = []; return; }
    const leaving = this.inPlayerRoom();
    this.roomId = pair.room.id;
    const a = pair.approach;
    this.place(a[0], a[1], Math.atan2(pair.n[0], pair.n[1]));
    this.routeDoors.shift(); this.pathStage = 0; this.path = [];
    const entering = this.inPlayerRoom();
    if (entering) {
      // the far door opens by itself before it steps out
      pair.snap(false); pair.open(false, true); this.entering = 1.0; this.group.visible = false;
      g.flickerLights(2.0); g.audio.whisper({ x: pair.bx, y: 1.5, z: pair.bz }, 0.4);
      g.fear.add(6);
    } else { pair.snap(true); }
    if (leaving && !entering) g.flickerLights(0.8);
    if (this.goal) {
      if (this.goal.room !== this.roomId) { const r = WORLD_DATA.roomPath(this.roomId, this.goal.room, g.unlocked); this.routeDoors = r || []; const d2 = r && r.length ? g.world.doors[r[0]] : null; if (d2) { const ap = d2.approach; this.path = this.room.nav.findPath(this.x, this.z, ap[0], ap[1]); } }
      else this.path = this.room.nav.findPath(this.x, this.z, this.goal.x, this.goal.z);
    }
  },

  // Called by the game when the player walks into another room
  onPlayerRoomChange(from, to) {
    if (this.state === 'HUNT' && this.roomId === from && (this.game.clockT - this.lastSeenT) < 3) {
      const door = Object.values(this.game.world.doors).find(d => d.room.id === from && d.pair && d.pair.room.id === to);
      this.lastKnown = { room: to, x: this.game.camera.position.x, z: this.game.camera.position.z, t: this.game.clockT };
      this.goTo(to, this.lastKnown.x, this.lastKnown.z);
      if (door) this.openT = 0.4;
    }
  }
});

Object.assign(Ghost.prototype, {
  update(dt) {
    const g = this.game;
    // visibility: only drawn in the room the player is in, after it has stepped out of the door
    if (this.entering > 0) this.entering -= dt;
    const shown = this.inPlayerRoom() && this.entering <= 0 && (this.state !== 'DORMANT' || this.scripted) && !this.hiddenByScript;
    this.group.visible = shown;
    this.group.position.set(this.x, this.groundY || 0, this.z);
    this.group.rotation.y = this.yaw;
    this.animate(dt);
    if (!this.aiEnabled || this.scripted || g.isDead || g.hasWon) return;
    this.stateT += dt; this.stunCd -= dt; this.safeT -= dt;
    this.resist = Math.max(0, this.resist - dt * CONFIG.beam.resistDecay);
    this.sinceNear = this.distToPlayer() < 9 ? 0 : this.sinceNear + dt;
    const stage = g.stage, speedMul = (1 + stage * 0.07) * (g.midnight ? CONFIG.midnight.speed : 1);
    // after midnight the house tells her roughly where you are, every minute or so
    if (g.midnight) this.senseHouse(dt);

    if (this.state === 'DORMANT') { this.dormantT -= dt; if (this.dormantT <= 0 && g.isPlaying) { this.setState('PATROL'); this.dwellT = 0; } return; }
    this.updateSight(dt);
    this.checkFlashlight();

    switch (this.state) {
      case 'PATROL': this.tickPatrol(dt, this.cfg.walk * speedMul); break;
      case 'SUSPICIOUS': this.tickSuspicious(dt, this.cfg.walk * 1.25 * speedMul); break;
      case 'HUNT': this.tickHunt(dt); break;
      case 'SEARCH': this.tickSearch(dt, this.cfg.walk * 1.2 * speedMul); break;
      case 'STUNNED': this.tickStunned(dt); break;
      case 'REPELLED': this.tickRepelled(dt); break;
    }
    // reading the player's head: look toward noise, otherwise ahead
    this.P.headTilt = damp(this.P.headTilt, 0, 0.8, dt);
    // death by contact
    if (this.inPlayerRoom() && !g.hiding.active && this.state === 'HUNT' && this.distToPlayer() < 1.15 && this.room.lineClear(this.x, this.z, this.px(), this.pz(), 0.1)) g.scares.death('ghost');
  },

  // Midnight rule: she feels you. Not an instant hunt, but she comes to where you were.
  // Hiding unseen still protects you.
  senseHouse(dt) {
    const g = this.game;
    this.senseT = (this.senseT === undefined ? 20 : this.senseT) - dt;
    if (this.senseT > 0) return;
    this.senseT = 65 + g.rand() * 30;
    if (g.hiding.active || this.scripted || (this.state !== 'PATROL' && this.state !== 'SEARCH' && this.state !== 'SUSPICIOUS')) return;
    this.lastKnown = { room: g.currentRoom, x: this.px(), z: this.pz(), t: g.clockT };
    this.setState('SUSPICIOUS'); this.dwellT = 0; this.goTo(g.currentRoom, this.px(), this.pz());
    g.hud.toast('Something turns toward you'); g.fear.add(6);
  },

  // Flashlight stun: aim the beam at it within 9m, with line of sight
  checkFlashlight() {
    const g = this.game;
    // the beam only has the strength to stun while the battery can pay for it
    if (!g.flashlightOn || g.battery < CONFIG.beam.cost || !this.group.visible || this.stunCd > 0 || this.state === 'STUNNED' || this.state === 'DORMANT') return;
    if (this.distToPlayer() > 9) return;
    const d = TMP.v1.set(this.x - g.camera.position.x, 1.5 - g.camera.position.y, this.z - g.camera.position.z).normalize();
    const f = TMP.v2.set(0, 0, -1).applyQuaternion(g.camera.quaternion);
    if (f.dot(d) > 0.94 && this.room.lineClear(this.x, this.z, this.px(), this.pz(), 0.1)) this.beamStun();
  },

  // A stun from the flashlight burns battery, and each one makes the next weaker
  beamStun() {
    const g = this.game, B = CONFIG.beam;
    g.battery = Math.max(0, g.battery - B.cost); g.hud.setBattery(g.battery);
    const dur = Math.max(B.minStun, this.cfg.stun * (1 - this.resist));
    this.resist = Math.min(B.resistMax, this.resist + B.resistGain);
    g.hud.toast(g.battery < B.cost ? 'The beam is nearly spent' : 'The beam burns through the battery');
    this.stun(dur);
  },

  stun(sec) {
    const g = this.game;
    this.prevState = this.state === 'STUNNED' ? this.prevState : this.state;
    this.setState('STUNNED'); this.stunT = sec; this.stunCd = sec + 6;
    this.P.scream = 1; this.P.jaw = 0.8; this.P.arms = 0.4;
    g.audio.stun(); g.cameraShake(0.25); g.screenFX.glitch(0.35);
    // shoved back a couple of metres
    const dx = this.x - this.px(), dz = this.z - this.pz(), d = Math.hypot(dx, dz) || 1;
    for (let s = 2.4; s > 0; s -= 0.4) { const nx = this.x + dx / d * s, nz = this.z + dz / d * s; if (!this.room.blocked(nx, nz, 0.4)) { this.x = nx; this.z = nz; break; } }
  },
  tickStunned(dt) {
    this.stunT -= dt;
    this.dissolve = clamp(0.35 * Math.sin(this.time * 40) * 0.5 + 0.2, 0, 0.5);
    if (this.stunT <= 0) {
      this.dissolve = 0; this.P.scream = 0; this.P.jaw = 0;
      this.lastKnown = { room: this.roomId, x: this.px(), z: this.pz(), t: this.game.clockT };
      this.beginSearch(10);
    }
  },
  // Crucifix / locket: it recoils and flees
  repel(sec) {
    this.setState('REPELLED'); this.repelT = sec; this.stunCd = sec + 4;
    this.game.audio.stun(); this.P.scream = 0.7; this.P.arms = 0.2;
    const pts = this.room.waypoints; let best = pts[0], bd = -1;
    pts.forEach(p => { const d = dist2D(p.x, p.z, this.px(), this.pz()); if (d > bd) { bd = d; best = p; } });
    if (best) this.goTo(this.roomId, best.x, best.z);
  },
  tickRepelled(dt) {
    this.repelT -= dt; this.followRoute(dt, this.cfg.hunt * 0.9);
    if (this.repelT <= 0) { this.P.scream = 0; this.beginSearch(8); }
  },

  // ---- PATROL: roams the whole house ----------------------------------------
  choosePatrolGoal() {
    const g = this.game, rooms = Object.values(g.world.rooms).filter(r => r.role !== 'safe' && r.id !== this.roomId);
    const reach = rooms.filter(r => WORLD_DATA.roomPath(this.roomId, r.id, g.unlocked));
    if (!reach.length) return null;
    // the longer it has been since it was near you, the more it drifts toward your room
    const bias = clamp(this.sinceNear / 45, 0, 1) * 0.65 * this.cfg.aggression;
    const target = this.game.rand() < bias ? (reach.find(r => r.id === g.currentRoom) || reach[0]) : reach[Math.floor(this.game.rand() * reach.length)];
    const pts = target.waypoints, p = pts[Math.floor(this.game.rand() * pts.length)] || { x: target.cx, z: target.cz };
    return { room: target.id, x: p.x, z: p.z };
  },
  tickPatrol(dt, speed) {
    this.formTarget = this.distToPlayer() < 7 ? 1 : 0.5;
    if (this.dwellT > 0) {
      this.dwellT -= dt; this.P.headYaw = Math.sin(this.time * 0.7) * 0.5; this.P.headTilt = Math.sin(this.time * 0.4) * 0.3;
      if (this.dwellT <= 0) this.P.headYaw = 0;
      return;
    }
    if (!this.goal || !this.path.length && !this.routeDoors.length) {
      const goal = this.choosePatrolGoal();
      if (goal) this.goTo(goal.room, goal.x, goal.z); else this.dwellT = 3;
      if (this.goal && this.goal.room === this.roomId && !this.path.length) this.dwellT = 2;
      return;
    }
    const r = this.followRoute(dt, speed);
    if (r === 'arrived' || r === 'failed') {
      this.goal = null; this.dwellT = 2 + this.game.rand() * 3.5;
      // now and then it rummages through a drawer, which you can hear from the next room
      if (this.inPlayerRoom() && this.game.rand() < 0.45) {
        const near = this.room.spots.filter(s => s.ia && s.ia.setT && !s.ia.isOpen && dist2D(s.def.x, s.def.z, this.x, this.z) < 4)[0];
        if (near) { near.ia.open(false, true); }
      }
    }
  },

  // ---- SUSPICIOUS: goes to the sound ---------------------------------------
  tickSuspicious(dt, speed) {
    this.formTarget = 1;
    if (this.dwellT > 0) {
      this.dwellT -= dt; this.P.headYaw = Math.sin(this.time * 1.4) * 0.8;
      if (this.dwellT <= 0) { this.P.headYaw = 0; this.beginSearch(7); }
      return;
    }
    const r = this.followRoute(dt, speed);
    if (r === 'arrived') this.dwellT = 3 + this.game.rand() * 2;
    else if (r === 'failed') this.beginSearch(5);
    if (this.stateT > 30) this.setState('PATROL');
  },

  // ---- HUNT -------------------------------------------------------------------
  tickHunt(dt) {
    const g = this.game;
    this.formTarget = 2; this.P.arms = this.sees ? 0.9 : 0.5;
    this.repathT -= dt;
    this.huntT += dt;
    const ramp = 1 + clamp(this.huntT / CONFIG.chase.huntRamp, 0, 1) * CONFIG.chase.maxBoost;
    const speed = this.cfg.hunt * (1 + g.stage * 0.05) * ramp * (g.midnight ? CONFIG.midnight.speed : 1);
    this.huntSpeedNow = speed;
    const lk = this.lastKnown;
    if (!lk) { this.beginSearch(8); return; }
    if (this.inPlayerRoom() && this.sees) {
      if (this.repathT <= 0) { this.path = this.room.nav.findPath(this.x, this.z, this.px(), this.pz()); this.routeDoors = []; this.goal = { room: this.roomId, x: this.px(), z: this.pz() }; this.repathT = 0.3; }
      this.moveAlong(dt, speed);
    } else {
      if (!this.goal || this.repathT <= 0) { this.goTo(lk.room, lk.x, lk.z); this.repathT = 0.8; }
      const r = this.followRoute(dt, speed);
      if (r === 'arrived' || r === 'failed') this.beginSearch(12);
    }
    if (this.lostT > 7) this.beginSearch(12);
  },

  // ---- SEARCH: looks around, then checks hiding places -----------------------------
  beginSearch(sec) {
    this.setState('SEARCH'); this.searchT = sec; this.checking = null; this.checksLeft = 2 + Math.floor(this.game.rand() * 2);
    this.dwellT = 0;   // a stale patrol pause must not stop it checking hiding places
    if (this.lastKnown) this.goTo(this.lastKnown.room, this.lastKnown.x, this.lastKnown.z);
    this.game.audio.setChase(false);
  },
  tickSearch(dt, speed) {
    this.formTarget = 1;
    if (this.checking) { this.tickCheck(dt, speed); return; }
    if (this.path.length || this.routeDoors.length) { this.followRoute(dt, speed); return; }
    this.searchT -= dt; this.P.headYaw = Math.sin(this.time * 1.8) * 0.9;
    if (this.searchT > 0 && this.dwellT <= 0 && this.checksLeft > 0 && this.inPlayerRoom()) {
      const spot = this.game.hiding.pickSpotToCheck(this);
      if (spot) { this.checking = { spot, phase: 'walk', t: 0 }; this.checksLeft--; this.goTo(this.roomId, spot.front.x, spot.front.z); return; }
      this.checksLeft = 0;
    }
    if (this.searchT <= 0) { this.P.headYaw = 0; this.safeT = 12; this.setState('PATROL'); this.goal = null; this.dwellT = 1; }
  },
  tickCheck(dt, speed) {
    const c = this.checking, spot = c.spot, h = this.game.hiding;
    c.t += dt;
    if (c.phase === 'walk') {
      if (this.moveAlong(dt, speed) || dist2D(this.x, this.z, spot.front.x, spot.front.z) < 0.5) { c.phase = 'sniff'; c.t = 0; c.dur = 2.4 + this.game.rand() * 1.8; this.yaw = Math.atan2(spot.x - this.x, spot.z - this.z); spot.ghostHere = true; }
      return;
    }
    if (c.phase === 'sniff') {
      this.P.headTilt = 0.4; this.P.headYaw = Math.sin(this.time * 2) * 0.3;
      if (h.active === spot && (h.noise() > 0.28 || spot.compromised)) { h.foundBy(this, spot); this.checking = null; return; }
      if (c.t > c.dur) { c.phase = 'peek'; c.t = 0; h.startPeek(this, spot); }
      return;
    }
    if (c.phase === 'peek') { if (!h.peekActive) { spot.ghostHere = false; this.checking = null; spot.burnedUntil = this.game.clockT + 60; this.dwellT = 0; } }
  }
});
