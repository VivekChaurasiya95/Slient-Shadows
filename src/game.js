'use strict';
// ==========================================================================
// SILENT SHADOWS: THE SAMHAIN EXTRACTION
// HorrorGame: renderer, camera, input, main loop. Systems live in other files:
//   core / world-data / audio / items / interact / doors / world / spots / rooms /
//   decor / hiding / ghost / ghost-ai / jumpscares / director / hud / run / debug
// ==========================================================================
const ROOM_CUTSCENES = ['parlor', 'bedroom', 'kitchen', 'library', 'nursery', 'cellar', 'crypt'];

class HorrorGame {
  constructor() {
    this.container = document.getElementById('game-container');
    this.cfg = CONFIG.difficulties.normal;
    this.access = { reduceFlashing: false, reduceScares: false, subtitles: true, narration: true };
    this.keys = {}; this.isLocked = false;
    this.isPlaying = false; this.isDead = false; this.hasWon = false;
    this.transitioning = false; this.inputLocked = false; this.testMode = false; this.paused = false; this.midnight = false;
    this.clockT = 0; this.time = 0; this.stage = 0;
    // Two seeded streams. rng: gameplay decisions (ghost, scares). frng: per-frame chances.
    this.rng = new RNG('boot'); this.frng = new RNG('boot:frame');
    this.currentRoom = 'corridor'; this.room = null; this.currentRoomChanged = false;
    this.unlocked = new Set(); this.prevLayout = null; this.seed = '';
    this.flashlightOn = true; this.battery = 100; this.lighterOn = false; this.flashFlicker = 0;
    this.isCrouching = false; this.isSprinting = false; this.stamina = 1; this.winded = false; this.sprintHold = 0;
    this.micActive = false; this.camActive = false; this.micLevel = 0; this.analyser = null; this.audioCtx = null;
    this.redAlert = false; this.looseItems = []; this.shakeA = 0; this.look = null;
    this.camHeight = CONFIG.player.eye; this.bobAmp = 0; this.headBob = 0; this.lastStep = 0;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ'); this.baseFov = CONFIG.player.fov;
    this.lagDir = new THREE.Vector3(0, 0, -1);
    this.clock = new THREE.Clock();

    this.initThree();
    this.tweens = new Tweens();
    this.audio = new AudioEngine(this);
    this.inventory = new Inventory(this);
    this.hud = new HUD(this);
    this.world = new World(this);
    this.interact = new InteractionSystem(this);
    this.hiding = new Hiding(this);
    this.scares = new Jumpscares(this);
    this.fear = new FearSystem(this);
    this.screenFX = new ScreenFX(this);
    this.atmosphere = new Atmosphere(this);
    this.director = new ScareDirector(this);
    this.story = new StoryDirector(this);
    this.ghost = new Ghost(this);
    this.cinema = new Cinema(this);
    this.menu = new MenuScene(this);
    this.initHardware();
    this.initMenu();
    this.setupEvents();
    this.newRun(null);
    this.warmup();
    this.hud.setBattery(100);
    this.animate();
  }

  // ------------------------------------------------------------------------
  // Renderer, lights
  // ------------------------------------------------------------------------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010101);
    this.scene.fog = new THREE.FogExp2(0x030203, 0.1);
    this.camera = new THREE.PerspectiveCamera(CONFIG.player.fov, innerWidth / innerHeight, 0.05, 80);
    this.camera.position.set(0, CONFIG.player.eye, 9);
    this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // washed-out, dirty film look for the whole house
    this.renderer.domElement.style.filter = 'saturate(0.55) sepia(0.18) contrast(1.15) brightness(0.92)';
    this.container.appendChild(this.renderer.domElement);

    // Flashlight lives in the scene (not on the camera) so the beam can lag behind the view
    this.flashBase = 2.8;
    this.flashlight = new THREE.SpotLight(0xfff1dc, this.flashBase, 24, Math.PI / 6, 0.55, 1.3);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024); this.flashlight.shadow.camera.near = 0.1; this.flashlight.shadow.camera.far = 24; this.flashlight.shadow.bias = -0.0004;
    this.flashTarget = new THREE.Object3D();
    this.scene.add(this.flashlight, this.flashTarget); this.flashlight.target = this.flashTarget;
    // faint glow around the player so nearby floor is never fully black
    this.fillOn = 0.2; this.fillOff = 0.03;
    this.fillLight = new THREE.PointLight(0xffe2c0, this.fillOn, 7, 2); this.camera.add(this.fillLight);
    // lighter flame (intensity only, never toggled, to keep shaders stable)
    this.lighterLight = new THREE.PointLight(0xff9a40, 0, 6, 2); this.camera.add(this.lighterLight); this.lighterLight.position.set(0.25, -0.2, -0.4);
    this.ambient = new THREE.AmbientLight(0x404660, 0.12); this.scene.add(this.ambient);
    this.lightningLight = null;
    // dust motes that follow the player
    const n = 420, pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i += 3) { pos[i] = (Math.random() - 0.5) * 8; pos[i + 1] = Math.random() * 3; pos[i + 2] = (Math.random() - 0.5) * 8; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xb8b0a0, size: 0.02, transparent: true, opacity: 0.45, depthWrite: false }));
    this.dust.frustumCulled = false; this.scene.add(this.dust);
  }

  // Compile every room's shader variant once, behind the menu, so room changes never hitch
  warmup() {
    const rooms = Object.values(this.world.rooms), keep = this.room;
    rooms.forEach(r => { rooms.forEach(o => { o.group.visible = o === r; }); this.renderer.compile(this.scene, this.camera); this.renderer.render(this.scene, this.camera); });
    rooms.forEach(o => { o.group.visible = o === keep; });
    // the opening cutscene is built and compiled now, so pressing Begin the night never stalls
    try { this.cinema.prepare('opening'); } catch (e) { console.warn('opening prepare failed', e); }
  }

  rand() { return this.rng.next(); }
  frand() { return this.frng.next(); }

  get hasRelic() { return this.inventory.has('relic'); }
  get hasKey() { return this.inventory.keys().some(k => k.def.keyId !== 'fake'); }
  eyeHeight() { return this.isCrouching ? CONFIG.player.crouchEye : CONFIG.player.eye; }
  canAct() { return this.isPlaying && !this.isDead && !this.hasWon && !this.transitioning && !this.inputLocked && !this.hud.noteOpen && (this.isLocked || this.testMode); }
  spotPos(def) { return { x: def.x, y: 1.0, z: def.z }; }

  // ------------------------------------------------------------------------
  // Camera control: pose override, forced look, shake
  // ------------------------------------------------------------------------
  setCameraPose(x, y, z, yaw, pitch) { this.camera.position.set(x, y, z); this.euler.set(pitch || 0, yaw, 0, 'YXZ'); }
  forceLook(target, rate) { this.look = { target, rate: rate || 8 }; }
  releaseLook() { this.look = null; }
  cameraShake(a) { this.shakeA = Math.max(this.shakeA, a); }

  applyCamera(dt) {
    const cam = this.camera, t = this.time;
    if (this.look) {
      const d = TMP.v1.copy(this.look.target).sub(cam.position);
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      this.euler.y += angleDiff(this.euler.y, yaw) * Math.min(1, dt * this.look.rate);
      this.euler.x += (pitch - this.euler.x) * Math.min(1, dt * this.look.rate);
    }
    const f = this.fear.level, sway = f * f;
    this.shakeA = Math.max(0, this.shakeA - dt * 1.6);
    const s = this.shakeA;
    TMP.e1.set(this.euler.x + (Math.random() - 0.5) * s * 0.06 + Math.sin(t * 0.7) * sway * 0.01, this.euler.y + (Math.random() - 0.5) * s * 0.06, (Math.sin(t * 0.9) * sway * 0.02) + (Math.random() - 0.5) * s * 0.05, 'YXZ');
    cam.quaternion.setFromEuler(TMP.e1);
    const fov = this.baseFov + (this.isSprinting ? CONFIG.player.sprintFov - CONFIG.player.fov : 0) * 1 + (this.hiding.active ? -8 : 0);
    if (!this.tweens.list.some(tw => tw.key === 'deathfov')) {
      cam.fov = damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix();
    }
  }

  // Flashlight: beam trails the view a little, flickers with fear and low battery
  updateFlashlight(dt) {
    const cam = this.camera, fwd = TMP.v1.set(0, 0, -1).applyQuaternion(cam.quaternion);
    this.lagDir.lerp(fwd, Math.min(1, dt * 9)).normalize();
    const right = TMP.v2.set(1, 0, 0).applyQuaternion(cam.quaternion);
    this.flashlight.position.copy(cam.position).addScaledVector(right, 0.18).addScaledVector(TMP.v3.set(0, -1, 0), 0.16);
    this.flashTarget.position.copy(cam.position).addScaledVector(this.lagDir, 8);
    let on = this.flashlightOn && this.battery > 0 && !(this.hiding.active);
    let k = on ? 1 : 0;
    if (on && this.flashFlicker > 0.05 && Math.random() < this.flashFlicker * 0.12) k = this.access.reduceFlashing ? 0.6 : (Math.random() < 0.5 ? 0.1 : 0.5);
    this.flashlight.intensity = damp(this.flashlight.intensity, this.flashBase * k, k < 0.3 ? 40 : 14, dt);
    this.fillLight.intensity = this.flashlightOn && this.battery > 0 ? this.fillOn : this.fillOff;
    this.lighterLight.intensity = this.lighterOn ? 1.1 + Math.sin(this.time * 12) * 0.2 : 0;
    if (this.flashlightOn && this.isPlaying && !this.isDead) {
      this.battery = Math.max(0, this.battery - dt * 0.33 * this.cfg.drain * (this.midnight ? CONFIG.midnight.battery : 1) * (1 + this.ghost.presence() * 1.8));
      if (Math.floor(this.battery) !== this.lastBatInt) { this.lastBatInt = Math.floor(this.battery); this.hud.setBattery(this.battery); if (this.battery === 0) this.hud.toast('The flashlight dies'); }
    }
  }
  setFlashlight(on) { this.flashlightOn = on; }

  // ------------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------------
  setupEvents() {
    this.container.addEventListener('click', () => {
      if (!this.isLocked && this.isPlaying && !this.isDead && !this.hasWon && !this.hud.noteOpen && !this.paused) this.container.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.container;
      // losing the mouse (Esc, alt-tab) freezes the whole simulation. Getting it back resumes.
      if (!this.isLocked) { if (this.shouldPauseOnUnlock()) this.pause(); }
      else if (this.paused) this.resume();
    });
    document.addEventListener('pointerlockerror', () => { if (this.paused) document.getElementById('pause-sub').textContent = 'The browser needs a moment. Click Resume again'; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !this.testMode) this.pause(true); });
    document.addEventListener('mousemove', e => {
      if (!(this.isLocked || this.testMode) || this.look || this.inputLocked) return;
      this.euler.y -= (e.movementX || 0) * 0.0024;
      this.euler.x = clamp(this.euler.x - (e.movementY || 0) * 0.0024, -1.35, 1.35);
      const h = this.hiding;
      if (h.active) {
        this.euler.y = h.baseYaw + clamp(angleDiff(h.baseYaw, this.euler.y), -h.arc.yaw, h.arc.yaw);
        this.euler.x = clamp(this.euler.x, -h.arc.pitch, h.arc.pitch);
      }
    });
    window.addEventListener('keydown', e => {
      if (e.code === 'Backquote') { this.debug && this.debug.toggle(); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat && this.isPlaying) this.hud.toggleInventory(); return; }
      this.keys[e.code] = true;
      if (e.repeat) return;
      if (this.hud.noteOpen && (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space')) { this.hud.closeNote(); return; }
      if (!this.isPlaying || this.isDead || this.hasWon) return;
      if (e.code === 'KeyI') this.hud.toggleInventory();
      if (e.code === 'KeyE') this.pressInteract();
      if (e.code === 'KeyR') this.useSelected();
      if (e.code === 'KeyQ') this.dropSelected(e.shiftKey);
      if (/^Digit[1-6]$/.test(e.code)) this.inventory.select(Number(e.code.slice(5)) - 1);
      if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !this.hiding.active && !this.inputLocked) {
        this.isCrouching = !this.isCrouching; document.getElementById('stance-indicator').textContent = this.isCrouching ? 'Crouching' : 'Standing';
      }
      if (e.code === 'KeyF' && !this.hiding.active) {
        this.flashlightOn = !this.flashlightOn; this.audio.click();
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'KeyE') this.interact.release();
    });
    window.addEventListener('mousedown', e => {
      if (!this.isLocked) return;
      if (e.button === 0) this.pressInteract(); else if (e.button === 2) this.useSelected();
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.interact.release(); });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); });
    window.addEventListener('blur', () => { this.keys = {}; if (!this.testMode) this.pause(true); });
  }

  // ------------------------------------------------------------------------
  // Pause: nothing simulates (ghost, clock, tweens, audio) until the mouse is back
  // ------------------------------------------------------------------------
  shouldPauseOnUnlock() {
    return this.isPlaying && !this.isDead && !this.hasWon && !this.testMode && !this.hud.noteOpen && !this.cinema.active && !(this.debug && this.debug.open);
  }
  pause(releaseLock) {
    if (this.paused || !this.isPlaying || this.isDead || this.hasWon || this.cinema.active) return;
    this.paused = true; this.keys = {}; this.interact.cancelPending();
    if (this.audio.ctx) this.audio.ctx.suspend();
    document.getElementById('pause-sub').textContent = 'Nothing moves while you are away';
    document.getElementById('pause-stats').textContent = 'Time  ' + document.getElementById('hud-clock').textContent + '\nSeed  ' + this.seed;
    this.hud.showModal(document.getElementById('pause-modal'));
    if (releaseLock && document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    if (!this.paused) return;
    this.paused = false; this.hud.hideModal(document.getElementById('pause-modal'));
    if (this.audio.ctx) this.audio.ctx.resume();
    this.clock.getDelta();
  }
  resumeClicked() {
    if (this.testMode || document.pointerLockElement === this.container) { this.resume(); return; }
    this.container.requestPointerLock();
  }

  pressInteract() {
    if (this.hiding.active) { if (!this.interact.focus) this.hiding.leave(); else this.interact.press(); return; }
    this.interact.press();
  }

  // ------------------------------------------------------------------------
  // Movement (sliding collision against furniture, walls and open doors)
  // ------------------------------------------------------------------------
  canStandAt(x, z) { return !this.room.blocked(x, z, CONFIG.player.radius); }

  // Sprinting burns stamina. Empty means winded: you walk, gasp (a noise), and wait for it to refill.
  updateStamina(dt, sprinting) {
    const P = CONFIG.player;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * P.sprintDrain); this.sprintHold = P.sprintDelay;
      if (this.stamina <= 0 && !this.winded) { this.winded = true; this.audio.gasp(); this.makeNoise(this.camera.position.x, this.camera.position.z, this.currentRoom, 0.45, 'gasp'); this.hud.toast('You are winded'); }
    } else {
      this.sprintHold -= dt;
      if (this.sprintHold <= 0) this.stamina = Math.min(1, this.stamina + dt * P.sprintRegen * (this.isCrouching ? 1.4 : 1));
    }
    if (this.winded && this.stamina >= P.sprintMin) this.winded = false;
    this.hud.setSprint(this.stamina, this.winded);
  }

  updateMovement(dt) {
    if (!this.canAct() || this.hiding.active) { this.isSprinting = false; this.updateStamina(dt, false); return; }
    const k = this.keys, P = CONFIG.player;
    const wantsMove = !!(k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight);
    this.isSprinting = !!(k.ShiftLeft || k.ShiftRight) && !this.isCrouching && !this.winded && this.stamina > 0 && wantsMove;
    this.updateStamina(dt, this.isSprinting);
    const speed = this.isCrouching ? P.crouch : this.isSprinting ? P.sprint : P.walk;
    const mz = Number(!!(k.KeyW || k.ArrowUp)) - Number(!!(k.KeyS || k.ArrowDown)), mx = Number(!!(k.KeyD || k.ArrowRight)) - Number(!!(k.KeyA || k.ArrowLeft));
    const target = this.isCrouching ? P.crouchEye : P.eye;
    this.camHeight = damp(this.camHeight, target, 10, dt);
    const fwd = TMP.v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion); fwd.y = 0; fwd.normalize();
    const right = TMP.v2.set(1, 0, 0).applyQuaternion(this.camera.quaternion); right.y = 0; right.normalize();
    const mv = TMP.v3.set(0, 0, 0); if (mz) mv.addScaledVector(fwd, mz); if (mx) mv.addScaledVector(right, mx);
    let moving = false;
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(speed * dt);
      const p = this.camera.position, nx = p.x + mv.x, nz = p.z + mv.z;
      if (this.canStandAt(nx, p.z)) p.x = nx;
      if (this.canStandAt(p.x, nz)) p.z = nz;
      moving = true;
      this.headBob += dt * (this.isSprinting ? 12 : this.isCrouching ? 6 : 8);
      const now = performance.now(), interval = this.isSprinting ? 320 : this.isCrouching ? 700 : 480;
      if (now - this.lastStep > interval) {
        this.lastStep = now;
        const loud = this.isCrouching ? 0 : (this.isSprinting ? CONFIG.loudness.sprint : CONFIG.loudness.walk);
        this.audio.footstep(this.room.def.floor, this.isCrouching ? 0.35 : 1);
        if (loud > 0) this.makeNoise(p.x, p.z, this.currentRoom, loud, 'step');
      }
    }
    const bobT = moving ? (this.isSprinting ? 0.06 : this.isCrouching ? 0.012 : 0.03) : 0;
    this.bobAmp = damp(this.bobAmp, bobT, 8, dt);
    this.camera.position.y = this.camHeight + Math.sin(this.headBob) * this.bobAmp;
  }

  // Everything that makes sound feeds the ghost's hearing model
  makeNoise(x, z, roomId, loud, type, byGhost) {
    if (byGhost || !this.ghost) return;
    if (type === 'step' || type === 'door' || type === 'thrown' || type === 'gasp') this.noiseDisplay = Math.max(this.noiseDisplay || 0, loud * 55);
    this.ghost.hear({ x, z, room: roomId, loud, type });
  }

  // ------------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------------
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    // a cutscene or the menu backdrop takes over the renderer: same context, different scene and camera
    if (this.cinema && this.cinema.active) { this.cinema.update(dt); if (this.cinema.ctx) this.renderer.render(this.cinema.ctx.scene, this.cinema.ctx.camera); return; }
    if (this.menu && this.menu.active && this.menu.built) { this.menu.update(dt); this.renderer.render(this.menu.scene, this.menu.camera); return; }
    this.step(dt);
    if (this.room && this.room.mirror) renderMirror(this, this.room.mirror);
    this.renderer.render(this.scene, this.camera);
  }

  step(dt) {
    if (this.paused || (this.cinema && this.cinema.active)) return;
    this.time += dt;
    const playing = this.isPlaying && !this.isDead && !this.hasWon;
    if (playing) { this.clockT += dt; }
    this.tweens.update(dt);
    if (!this.room) return;
    if (playing) {
      this.updateMovement(dt);
      this.updateStage();
      this.story.update(dt); this.updateClock(); this.updateNight(); this.updateRoomCutscene();
      this.interact.update(dt);
      this.hiding.update(dt);
      this.updateLooseItems(dt);
      this.updateMicrophone(dt);
      this.checkExitApproach();
      this.director.update(dt);
      this.fear.update(dt);
    }
    this.ghost.update(dt);
    Object.values(this.world.doors).forEach(d => d.update(dt));
    this.room.updaters.forEach(fn => fn(dt, this.time));
    this.atmosphere.update(dt);
    this.updateFlashlight(dt);
    this.applyCamera(dt);
    this.updateDust(dt);
    this.screenFX.update(dt);
    this.hud.updateGrain(dt);
    this.updateAudioState(dt);
    this.currentRoomChanged = false;
  }

  updateDust(dt) {
    const p = this.dust.geometry.attributes.position.array, c = this.camera.position;
    this.dust.position.set(c.x, 0, c.z);
    for (let i = 0; i < p.length; i += 3) { p[i + 1] += dt * 0.03; p[i] += Math.sin(this.time * 0.3 + i) * dt * 0.02; if (p[i + 1] > 3) p[i + 1] = 0; }
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  updateAudioState(dt) {
    const gh = this.ghost, pres = gh.presence();
    let pan = 0;
    if (gh.inPlayerRoom()) { const r = TMP.v1.set(1, 0, 0).applyQuaternion(this.camera.quaternion); pan = (gh.x - this.camera.position.x) * r.x + (gh.z - this.camera.position.z) * r.z; pan = clamp(pan / 6, -1, 1); }
    this.audio.setState(this.fear.v, this.stage / 3, pres, pan);
    this.audio.update(dt, this.camera);
    this.bpmT = (this.bpmT || 0) - dt;
    if (this.bpmT <= 0) { this.bpmT = 1.1; document.getElementById('hud-bpm').textContent = Math.round(66 + this.fear.v * 0.95 + Math.random() * 4) + ' bpm'; }
    document.getElementById('fear-fill').style.width = this.fear.v.toFixed(0) + '%';
  }

  // Called from the Begin / Skip click, so pointer lock is allowed here
  beginPlaying() {
    if (this.menu) this.menu.dispose();
    this.isPlaying = true; this.clockT = 0; this.clock.getDelta();
    this.audio.startAmbience(); this.container.requestPointerLock();
    document.getElementById('hud-layer').classList.add('live');
    this.story.start();
  }

  // In-game clock. Minutes since 11:00 PM. 11:14 PM at the start, midnight (60) at night.midnightAt
  // seconds of play, 6:00 AM (420) at night.dawnAt. Dawn is the deadline.
  gameMinutes() {
    const N = CONFIG.night, t = this.clockT;
    return t < N.midnightAt ? 14 + (t / N.midnightAt) * 46 : 60 + ((t - N.midnightAt) / (N.dawnAt - N.midnightAt)) * 360;
  }

  // Midnight changes the rules. Dawn ends the night.
  updateNight() {
    const N = CONFIG.night, m = this.gameMinutes();
    if (!this.midnight && this.clockT >= N.midnightAt) this.startMidnight();
    if (this.midnight && !this.warned4 && m >= 300) { this.warned4 = true; this.hud.toast('Two hours until dawn'); }
    if (this.midnight && !this.warned5 && m >= 360) { this.warned5 = true; this.hud.toast('One hour until dawn'); this.fear.add(8); }
    if (this.midnight && !this.warned6 && m >= 405) { this.warned6 = true; this.hud.toast('The sky is greying'); this.hud.alert('Dawn is close'); }
    if (this.clockT >= N.dawnAt) this.triggerDawn();
  }
  startMidnight() {
    this.midnight = true; this.warned4 = this.warned5 = this.warned6 = false;
    this.story.midnightToll();
    // the quiet rooms are not quiet any more, and the cellar lamp dies
    Object.values(this.world.rooms).forEach(r => { if (r.role === 'safe') { r.role = 'hostile'; r.lightLevel = Math.min(r.lightLevel, 0.25); } });
    const fb = this.world.rooms.cellar.fuseBox; if (fb && fb.lamp) { fb.lamp.intensity = 0; fb.powered = false; }
    this.ghost.dormantT = 0; this.ghost.senseT = 20;
    this.tweens.after(2.5, () => { this.hud.toast('The quiet rooms are not quiet any more'); this.hud.alert('The house is awake'); });
    this.tweens.after(6.5, () => this.hud.toast('She can feel where you are'));
    this.fear.add(12); this.updateObjective();
  }
  triggerDawn() {
    if (this.isDead || this.hasWon) return;
    this.isDead = true; this.inputLocked = true; this.audio.setChase(false); this.hud.clearRadio();
    this.hud.fade(true, 1400);
    this.tweens.after(1.5, () => this.showDeath('dawn'));
  }
  updateClock() {
    const m = Math.floor(this.gameMinutes()), total = 23 * 60 + m, day = total >= 1440, mm = total % 1440, h24 = Math.floor(mm / 60), min = mm % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    this.hud.setClock((day ? 'Nov 1 1998 ' : 'Oct 31 1998 ') + h12 + ':' + String(min).padStart(2, '0') + (h24 >= 12 ? ' PM' : ' AM'));
  }

  // ------------------------------------------------------------------------
  // A run: seed -> layout -> world. Restart rebuilds everything (no page reload).
  // ------------------------------------------------------------------------
  newRun(seedText, keepSeed) {
    const seed = (seedText && String(seedText).trim().toUpperCase()) || RNG.randomSeed();
    let layout = null, tries = 0;
    do { layout = WORLD_DATA.generateLayout(new RNG(seed + (tries ? '#' + tries : '')), this.prevLayout); tries++; } while (!WORLD_DATA.validate(layout).ok && tries < 8);
    layout.seed = seed; this.seed = seed; this.layout = layout;
    this.rng = new RNG(seed + ':events'); this.frng = new RNG(seed + ':frame');
    this.prevLayout = { relicSpot: layout.relicSpot, keySpots: layout.keySpots };
    this.tweens.cancelAll(); this.atmosphere.phantomClear();
    this.world.build(layout);
    this.setupExtras();
    this.inventory.reset(); this.hiding.reset(); this.director.reset(); this.atmosphere.reset(); this.fear.reset();
    this.scares.saved = null; this.scares.busy = false; this.scares.exitDone = false;
    this.unlocked = new Set(); this.looseItems = []; this.seenCuts = new Set(); this.pendingCut = null;
    this.isDead = false; this.hasWon = false; this.inputLocked = false; this.transitioning = false; this.redAlert = false; this.look = null;
    this.lie = null; this.lieT = 8; this.lieWarned = false;
    this.midnight = false; this.paused = false; this.stamina = 1; this.winded = false; this.sprintHold = 0;
    this.battery = 100; this.lighterOn = false; this.flashlightOn = true; this.isCrouching = false; this.clockT = 0; this.stage = 0; this.relicTaken = false;
    this.camHeight = CONFIG.player.eye;
    this.hud.setBattery(100); this.hud.setHidden(false); this.hud.blackout(false);
    this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
    this.ghost.reset();
    Object.values(this.world.rooms).forEach(r => { r.visited = false; });
    this.switchRoom('corridor', null);
    this.camera.position.set(0, CONFIG.player.eye, 9); this.euler.set(0, 0, 0, 'YXZ');
    this.updateObjective();
    const s = document.getElementById('menu-seed'); if (s) s.placeholder = seed;
    document.getElementById('hud-seed').textContent = 'Seed ' + seed;
    console.log('[run] seed', seed, 'relic', layout.relicSpot, 'keys', JSON.stringify(layout.keySpots), 'locks', JSON.stringify(layout.keyForSlot));
  }

  switchRoom(roomId, arrivalDoor) {
    const room = this.world.rooms[roomId], prev = this.room;
    Object.values(this.world.rooms).forEach(r => { r.group.visible = r === room; });
    this.room = room; this.currentRoom = roomId; this.currentRoomChanged = true; room.visited = true;
    this.scene.fog.color.setHex(room.def.fog[0]); this.scene.fog.density = room.def.fog[1] * 1.6;
    this.ambient.color.setHex(room.def.ambient[0]); this.ambient.intensity = room.def.ambient[1] * 0.3;
    this.audio.setRoom(room);
    this.interact.clearFocus(); this.interact.cancelPending();
    if (arrivalDoor) {
      const s = arrivalDoor.spawn;
      this.camera.position.set(s[0], this.eyeHeight(), s[1]);
      this.euler.set(0, yawFromDir(arrivalDoor.n[0], arrivalDoor.n[1]), 0, 'YXZ');
      arrivalDoor.snap(true); arrivalDoor.autoClose = true;
    }
    if (prev && prev !== room) this.ghost.onPlayerRoomChange(prev.id, roomId);
    if (this.isPlaying && prev !== room) this.story.onRoom(roomId);
    // first visit to a room: its flashback plays once nothing dangerous is happening
    if (this.isPlaying && prev !== room) this.pendingCut = (ROOM_CUTSCENES.includes(roomId) && !this.seenCuts.has(roomId) && !this.relicTaken) ? { id: roomId, door: arrivalDoor } : null;
    this.updateObjective();
    if (room.trap && !room.trapDone && arrivalDoor && this.isPlaying) {
      if (this.pendingCut && this.pendingCut.id === roomId) room.trapAfterCut = arrivalDoor;   // the flashback goes first, then the trap
      else this.fireTrap(room, arrivalDoor);
    }
    this.hud.renderInventory();
  }

  // ------------------------------------------------------------------------
  // Room flashbacks. They tell the Hollow story piece by piece, once per room per run.
  // They wait while the ghost is hunting or you are hiding, and never play after the skull is taken.
  // ------------------------------------------------------------------------
  canPlayCutscene() {
    if (this.testMode && !this.testCutscenes) return false;
    if (this.cinema.active || this.transitioning || this.isDead || this.hasWon || this.inputLocked || this.paused || this.hud.noteOpen) return false;
    if (this.hiding.active || this.hiding.busy || this.scares.busy) return false;
    const gh = this.ghost;
    if (gh.state === 'HUNT' || gh.state === 'STUNNED' || gh.scripted) return false;
    if (gh.inPlayerRoom() && gh.state !== 'DORMANT' && gh.state !== 'PATROL' && gh.distToPlayer() < 7) return false;
    return true;
  }
  updateRoomCutscene() {
    const pc = this.pendingCut; if (!pc || this.cinema.active) return;
    if (this.relicTaken || this.hasRelic || this.currentRoom !== pc.id) { this.pendingCut = null; return; }   // leaving the room defers it to the next first entry
    if (this.canPlayCutscene()) this.playRoomCutscene(pc);
  }
  playRoomCutscene(pc) {
    this.pendingCut = null; this.seenCuts.add(pc.id);
    this.inputLocked = true; this.keys = {}; this.interact.cancelPending(); this.interact.clearFocus(); this.hud.setPrompt(null, false); this.hud.clearRadio();
    this.cinema.play(pc.id, { skippable: true, fadeOut: 0.6, onDone: () => this.endRoomCutscene(pc) });
  }
  endRoomCutscene(pc) {
    this.inputLocked = false; this.clock.getDelta(); this.keys = {};
    const room = this.world.rooms[pc.id];
    // Esc leaves pointer lock: show the pause menu now that the scene is over
    if (!this.isLocked && !this.testMode && !this.isDead) this.pause(false);
    if (room && room.trapAfterCut) { const d = room.trapAfterCut; room.trapAfterCut = null; this.fireTrap(room, d); }
  }

  // Walk through an open doorway: ease to black, swap rooms, ease back in
  useDoor(door) {
    if (this.transitioning || !door.pair) return;
    this.transitioning = true; this.interact.cancelPending(); this.keys = Object.assign({}, this.keys);
    this.hud.fade(true, 260);
    this.tweens.after(0.3, () => {
      const dest = door.pair.room.id;
      door.snap(false); door.autoClose = false;
      this.switchRoom(dest, door.pair);
      this.hud.fade(false, 420);
      this.tweens.after(0.2, () => { this.transitioning = false; });
    });
  }

  // Trap rooms: non-lethal, telegraphed, and never block the way out for long
  fireTrap(room, door) {
    room.trapDone = true;
    const kind = room.trap;
    if (kind === 'slam') {
      this.tweens.after(1.4, () => { door.slam(1); door.jam(11); this.lightsOut(6); this.audio.whisper(null, 0.6); this.cameraShake(0.3); this.fear.add(20); this.hud.toast('The door will not open'); this.audio.say('[The door slams shut]'); });
    } else if (kind === 'dark') {
      room.dark = true; this.hud.toast('The air is wrong in here');
      this.tweens.after(14, () => { room.dark = false; });
      for (let i = 0; i < 4; i++) this.tweens.after(1 + i * 2.2, () => this.audio.whisper(this.director.behind(), 0.5));
    } else if (kind === 'ghostwait') {
      const gh = this.ghost; this.scares.beginScript();
      const far = room.waypoints.slice().sort((a, b) => dist2D(b.x, b.z, this.camera.position.x, this.camera.position.z) - dist2D(a.x, a.z, this.camera.position.x, this.camera.position.z))[0];
      gh.formTarget = 1; gh.form = 0.9; gh.setPose({ headTilt: 0.2 });
      gh.place(far.x, far.z, Math.atan2(this.camera.position.x - far.x, this.camera.position.z - far.z), 0); gh.group.visible = true;
      this.fear.add(15); this.audio.growl({ x: far.x, y: 1.4, z: far.z });
      this.tweens.after(3.2, () => { this.scares.endScript(); });
    }
  }

  flickerLights(sec) { this.atmosphere.flicker(this.access.reduceFlashing ? sec * 0.5 : sec); }
  lightsOut(sec, red) { this.atmosphere.lightsOut(sec); if (red) this.redAlert = true; }

  // ------------------------------------------------------------------------
  // Progress: stage (calm, uneasy, dread, panic), objective text
  // ------------------------------------------------------------------------
  updateStage() {
    const t = this.clockT, S = CONFIG.stageSeconds;
    const ts = t > S[2] ? 3 : t > S[1] ? 2 : t > S[0] ? 1 : 0;
    const ps = this.hasRelic ? (this.ghost.relicChase && this.ghost.relicT > CONFIG.relicChase.grace + 25 ? 3 : 2) : this.unlocked.size >= 2 ? 2 : (this.unlocked.size >= 1 || this.hasKey) ? 1 : 0;
    const st = Math.max(ts, ps);
    if (st !== this.stage) { this.stage = st; this.hud.toast(['', 'The house stirs', 'Something is hunting for you', 'It is awake'][st] || ''); this.scene.fog.density = this.room.def.fog[1] * 1.6 * (1 + st * 0.12); }
  }

  updateObjective() {
    let t;
    if (this.hasRelic) t = 'Run to the front door';
    else if (this.unlocked.size >= 3) t = 'Find the horned skull';
    else if (this.hasKey) t = 'You hold a key. Something here is locked';
    else t = 'Search the house for keys, and a way into the crypt';
    this.hud.setObjective(t);
  }

  // ------------------------------------------------------------------------
  // Events from the interaction layer
  // ------------------------------------------------------------------------
  onDoorUnlocked(door, key) {
    if (door.def.slot === 'crypt') this.story.onGateUnlocked();
    this.unlocked.add(door.def.slot); this.inventory.removeItem(key);
    this.makeNoise(door.bx, door.bz, door.room.id, 0.3, 'unlock'); this.updateObjective();
  }
  onExitOpened(door) {
    this.scares.exitScare();
    if (door.chains) door.chains.forEach(c => { c.visible = false; });
    this.hud.toast('The chains fall away');
  }
  checkExitApproach() {
    const g = this.world.doors.c_exit;
    if (this.hasRelic && this.currentRoom === 'corridor' && this.camera.position.z > 9.2 && !this.scares.exitDone && this.ghost.state !== 'HUNT') this.scares.exitScare();
    if (g && g.st === 'open' && g.t > 0.6 && this.currentRoom === 'corridor' && this.camera.position.z > 11.2 && !this.hasWon) this.triggerVictory();
  }
  onItemPickedUp(wi) {
    const it = wi.item, g = this;
    this.story.onPickup(it);
    this.looseItems = this.looseItems.filter(x => x !== wi);
    this.updateObjective();
    if (it.def.mimic === 'key') {
      this.tweens.after(0.4, () => { this.scares.fakeout('painting'); this.makeNoise(g.camera.position.x, g.camera.position.z, g.currentRoom, 0.8, 'crash'); this.hud.toast('It was a trap'); this.fear.add(16); });
    } else if (it.def.mimic === 'relic') {
      this.tweens.after(0.3, () => { this.audio.growl(null); this.makeNoise(g.camera.position.x, g.camera.position.z, g.currentRoom, 0.95, 'curse'); this.hud.toast('A false relic. It heard that'); this.fear.add(20); });
    } else if (it.id === 'relic' && !this.relicTaken) {
      this.relicTaken = true;
      const p = wi.mesh.position;
      this.scares.relic({ x: p.x, y: p.y, z: p.z });
    }
  }
  triggerVictory() {
    if (this.hasWon) return;
    this.hasWon = true; this.story.onEscaped(); this.audio.setChase(false); this.audio.stopAmbience(3); document.exitPointerLock();
    this.hud.fade(true, 900);
    this.tweens.after(1.0, () => {
      document.getElementById('win-stats').textContent = 'Escape time  ' + this.formatElapsed() + '\nSeed  ' + this.seed;
      this.hud.showModal(document.getElementById('victory-modal')); this.hud.fade(false, 100);
    });
  }
  showDeath(type) {
    this.story.onDeath();
    this.audio.setChase(false); this.audio.stopAmbience(1.5); document.exitPointerLock();
    const lines = DEATH_TEXT[type] || DEATH_TEXT.ghost;
    document.querySelector('#game-over-modal .end-title').textContent = type === 'dawn' ? 'Dawn' : 'You died';
    document.getElementById('btn-retry').textContent = 'New house';
    document.getElementById('death-sub').textContent = lines[Math.floor(Math.random() * lines.length)];
    document.getElementById('death-stats').textContent = (type === 'dawn' ? 'Night survived  ' : 'Time survived  ') + this.formatElapsed() + '\nSeed  ' + this.seed;
    this.hud.showModal(document.getElementById('game-over-modal'));
  }
  formatElapsed() { const s = Math.round(this.clockT); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; }

  // Retry without reloading: tear down and rebuild with a new (or the same) seed
  restart(sameSeed) {
    ['game-over-modal', 'victory-modal'].forEach(id => this.hud.hideModal(document.getElementById(id)));
    const seed = sameSeed ? this.seed : null;
    this.prevLayout = sameSeed ? null : this.prevLayout;
    this.newRun(seed);
    this.isPlaying = true; this.hud.blackout(false); this.hud.fade(false, 100);
    this.audio.startAmbience(); this.container.requestPointerLock(); this.hud.clearRadio(); this.story.start();
    this.tweens.after(0.1, () => { this.clock.getDelta(); });
  }

  // ------------------------------------------------------------------------
  // Items: use, drop, throw
  // ------------------------------------------------------------------------
  useSelected() {
    const inv = this.inventory, it = inv.current;
    if (!it || this.hiding.busy) return;
    if (this.interact.use()) return;
    const gh = this.ghost, k = it.def.kind, hud = this.hud, p = this.camera.position;
    const near = gh.inPlayerRoom() && gh.state !== 'DORMANT' && gh.distToPlayer();
    if (k === 'battery') {
      if (this.battery > 92) { hud.toast('The flashlight is nearly full'); return; }
      this.battery = Math.min(100, this.battery + 60); inv.removeItem(it); this.audio.battery(); hud.setBattery(this.battery); hud.toast('Battery replaced');
    } else if (k === 'lighter') { this.lighterOn = !this.lighterOn; this.audio.click(); hud.toast(this.lighterOn ? 'Lighter lit' : 'Lighter out'); }
    else if (k === 'crucifix') {
      if (near && near < 8) { gh.repel(7); it.charges--; hud.toast('It recoils from the cross'); if (it.charges <= 0) { inv.removeItem(it); hud.toast('The crucifix cracks'); } inv.emit('change'); }
      else hud.toast('Nothing here to drive back');
    } else if (k === 'locket') {
      if (near && near < 10) { gh.stun(4); inv.removeItem(it); hud.toast('The locket crumbles to dust'); } else hud.toast('The locket stays cold');
    } else if (k === 'mirror') {
      if (it.charges <= 0) return;
      it.charges--; inv.emit('change');
      let msg = 'Nothing in the glass';
      if (gh.state !== 'DORMANT') {
        if (gh.inPlayerRoom()) { const dx = gh.x - p.x, dz = gh.z - p.z, f = TMP.v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion), r = TMP.v2.set(1, 0, 0).applyQuaternion(this.camera.quaternion); const fa = dx * f.x + dz * f.z, ra = dx * r.x + dz * r.z; msg = 'In the glass: ' + (Math.abs(fa) > Math.abs(ra) ? (fa > 0 ? 'ahead of you' : 'behind you') : (ra > 0 ? 'to your right' : 'to your left')) + ', ' + Math.round(Math.hypot(dx, dz)) + ' m away'; }
        else msg = 'In the glass: it is in the ' + gh.room.def.name.toLowerCase(); }
      hud.toast(msg); this.audio.click(); if (it.charges <= 0) { inv.removeItem(it); hud.toast('The shard slips and shatters'); this.audio.glass(null); }
    } else if (k === 'musicbox') {
      inv.removeItem(it); const wi = this.spawnLoose(it, p.x + 0, 0.06, p.z, null, true);
      this.audio.musicBox({ x: wi.mesh.position.x, y: 0.3, z: wi.mesh.position.z }, 0.35, true); wi.active = 9;
      this.makeNoise(p.x, p.z, this.currentRoom, 0.8, 'music'); hud.toast('You wind the music box and set it down');
    } else if (k === 'fuse') hud.toast('It fits the fuse box in the cellar');
    else if (k === 'junk') this.dropSelected(true);
    else if (k === 'key') hud.toast('Use it on a lock');
  }

  dropSelected(throwIt) {
    const inv = this.inventory, it = inv.current, p = this.camera.position;
    if (!it || this.hiding.active) return;
    inv.remove(inv.selected);
    const f = TMP.v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const vel = throwIt ? new THREE.Vector3(f.x * 7.5, f.y * 7.5 + 2.2, f.z * 7.5) : new THREE.Vector3(f.x * 0.8, 0.5, f.z * 0.8);
    const wi = this.spawnLoose(it, p.x + f.x * 0.5, p.y - 0.25, p.z + f.z * 0.5, vel);
    wi.throwLoud = throwIt ? CONFIG.loudness.thrown : CONFIG.loudness.drop * 0.5;
    this.hud.toast((throwIt ? 'Threw ' : 'Dropped ') + it.def.name.toLowerCase());
  }

  spawnLoose(item, x, y, z, vel, still) {
    const wi = new WorldItem(this, item);
    wi.attach(this.room.group, x, y, z); wi.room = this.room; wi.vel = vel || null; wi.spin = Math.random() * 6; wi.throwLoud = 0.4;
    const hit = new THREE.Mesh(Cache.geo('hit.sph', () => new THREE.SphereGeometry(0.22, 8, 6)), Cache.mat('hit.mat', () => new THREE.MeshBasicMaterial({ visible: false }))); hit.position.y = 0.08; wi.mesh.add(hit);
    const meshes = []; wi.mesh.traverse(o => { if (o.isMesh) meshes.push(o); });
    wi.interactable = new Interactable(this, { id: 'loose' + item.uid, room: this.room, meshes, reach: 2.8, prompt: () => (item.def.kind === 'note' ? 'Read note' : 'Take ' + item.def.name.toLowerCase()), onInteract: () => wi.pickUp() });
    wi.interactable.enabled = !vel;
    this.looseItems.push(wi);
    return wi;
  }

  updateLooseItems(dt) {
    for (const wi of this.looseItems) {
      if (wi.picking) continue;
      if (wi.active > 0) {
        wi.active -= dt; wi.noiseT = (wi.noiseT || 0) - dt;
        if (wi.noiseT <= 0) { wi.noiseT = 1.4; this.makeNoise(wi.mesh.position.x, wi.mesh.position.z, this.currentRoom, 0.55, 'music'); }
      }
      if (!wi.vel) continue;
      const m = wi.mesh, v = wi.vel;
      v.y -= 9.8 * dt;
      const nx = m.position.x + v.x * dt, nz = m.position.z + v.z * dt;
      if (wi.room.blocked(nx, nz, 0.06)) { v.x *= -0.3; v.z *= -0.3; } else { m.position.x = nx; m.position.z = nz; }
      m.position.y += v.y * dt; m.rotation.y += dt * 8; m.rotation.x += dt * 3;
      if (m.position.y <= 0.06) {
        m.position.y = 0.06;
        const impact = Math.abs(v.y);
        if (impact > 1.4) { v.y = impact * 0.35; v.x *= 0.6; v.z *= 0.6; this.audio.land(clamp(impact / 7, 0.2, 1), { x: m.position.x, y: 0.2, z: m.position.z }); this.makeNoise(m.position.x, m.position.z, wi.room.id, wi.throwLoud * clamp(impact / 6, 0.4, 1), 'thrown'); }
        else { wi.vel = null; m.rotation.x = 0; wi.interactable.enabled = true; }
      }
    }
  }

  // The cellar fuse box accepts the fuse and powers an emergency lamp
  setupExtras() {
    const game = this;
    // cellar fuse box (existing)
    const cellar = this.world.rooms.cellar, fb = cellar && cellar.fuseBox;
    if (fb) {
      fb.ia = new Interactable(this, { id: 'fusebox', room: cellar, meshes: [fb.mesh], reach: 2.8,
        prompt: () => (fb.powered ? 'The fuse box hums' : 'A fuse is missing'),
        onInteract: () => { if (fb.powered) return; const f = game.inventory.slots.find(s => s && s.id === 'fuse'); if (!f) game.hud.toast('A fuse is missing'); else game.fuseBoxUse(f); },
        onUse: it => { if (it && it.id === 'fuse' && !fb.powered) { game.fuseBoxUse(it); return true; } return false; } });
    }
    // bedroom light switch: flip it to turn the ceiling bulb on or off
    const bed = this.world.rooms.bedroom, sw = bed && bed.lampSwitch;
    if (sw) {
      sw.baseLight = bed.lightLevel;   // natural lit-ness without the bulb (builder + decor set this)
      sw.ia = new Interactable(this, { id: 'lampswitch', room: bed, meshes: [sw.plate], reach: 2.6,
        prompt: () => (sw.on ? 'Turn off the light' : 'Turn on the light'),
        onInteract: () => {
          sw.on = !sw.on;
          sw.light.intensity = sw.on ? sw.base : 0;
          sw.bulb.material.color.setHex(sw.on ? 0xffe9c2 : 0x2a2620);
          sw.toggle.rotation.z = sw.on ? 0.28 : -0.28;
          bed.lightLevel = sw.on ? Math.max(sw.baseLight, 0.7) : sw.baseLight;
          game.audio.click();
          game.hud.toast(sw.on ? 'The bulb hums to life' : 'The light goes out');
        } });
    }
  }
  fuseBoxUse(fuse) {
    const room = this.world.rooms.cellar, fb = room.fuseBox;
    fb.powered = true; this.inventory.removeItem(fuse); this.audio.unlock(null); this.audio.battery();
    const lamp = this.world.addLight(room, 0xfff4d8, 2.4, 14, 0, 2.4, 0, null); fb.lamp = lamp; room.lightLevel = 0.9; room.role = this.midnight ? 'hostile' : 'safe';
    room.flickers = room.flickers.filter(f => f.light.color.getHex() !== 0xfff0c0);
    this.hud.toast('The cellar lights steady. It cannot follow where the lamp burns'); this.fear.add(-25);
  }

  // ------------------------------------------------------------------------
  // Microphone and bodycam (both optional; the game runs without them)
  // ------------------------------------------------------------------------
  initHardware() {
    const btnMic = document.getElementById('btn-toggle-mic'), btnCam = document.getElementById('btn-toggle-cam');
    btnMic.addEventListener('click', async () => {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const src = this.audioCtx.createMediaStreamSource(this.micStream); this.analyser = this.audioCtx.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = 0.25; src.connect(this.analyser);
        this.micActive = true; btnMic.classList.add('active'); document.getElementById('mic-status-label').textContent = 'Connected, live level';
      } catch (err) { console.warn('Microphone unavailable:', err); document.getElementById('mic-status-label').textContent = 'Unavailable. Keyboard noise only'; }
    });
    btnCam.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 360 } } });
        const v = document.getElementById('webcam-stream'); v.srcObject = stream; v.style.display = 'block'; document.getElementById('cam-fallback').style.display = 'none';
        this.camActive = true; btnCam.classList.add('active'); document.getElementById('cam-status-label').textContent = 'Connected, night vision on';
      } catch (err) { console.warn('Camera unavailable:', err); document.getElementById('cam-status-label').textContent = 'Unavailable. Bodycam stays offline'; }
    });
  }

  updateMicrophone(dt) {
    let dec = 0;
    if (this.micActive && this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount); this.analyser.getByteFrequencyData(data);
      let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      dec = Math.min(100, Math.round(Math.sqrt(sum / data.length) / 128 * 100));
    }
    this.micLevel = dec;
    this.noiseDisplay = Math.max(dec, (this.noiseDisplay || 0) - dt * 60);
    const shown = Math.round(this.noiseDisplay), thr = this.hiding.active ? CONFIG.micThresholdHidden : CONFIG.micThreshold;
    // High fear: the meter lies. Sometimes it screams danger over silence, sometimes it hides
    // real noise. Only the display lies. The ghost still hears the true level.
    this.lieT = (this.lieT === undefined ? 8 : this.lieT) - dt;
    if (this.lieT <= 0) {
      const can = this.fear.level > CONFIG.fear.lieAt && !this.access.reduceScares;
      this.lieT = can ? 6 + this.rand() * 8 : 2;
      if (can) {
        this.lie = { until: this.time + 1.8, kind: this.rand() < 0.65 ? 'false' : 'hide' };
        if (!this.lieWarned) { this.lieWarned = true; this.hud.toast('Your nerves are failing. Do not trust the meter'); }
      }
    }
    let disp = shown;
    if (this.lie && this.time < this.lie.until) disp = this.lie.kind === 'false' ? Math.max(shown, thr + 6 + Math.round(Math.sin(this.time * 13) * 4)) : Math.round(shown * 0.15);
    const fill = document.getElementById('audio-fill'), mf = document.getElementById('menu-mic-fill'), st = document.getElementById('audio-status');
    fill.style.width = Math.max(4, disp) + '%'; document.getElementById('db-display').textContent = disp + ' dB'; if (mf) mf.style.width = dec + '%';
    const lvl = disp >= thr ? 'danger' : disp > thr * 0.5 ? 'caution' : 'safe';
    if (st.dataset.level !== lvl) { st.dataset.level = lvl; st.textContent = lvl === 'danger' ? 'Too loud' : lvl === 'caution' ? 'Breathing audible' : 'Quiet'; }
    this.micT = (this.micT || 0) - dt;
    if (dec >= thr && this.micT <= 0) { this.micT = 0.5; this.makeNoise(this.camera.position.x, this.camera.position.z, this.currentRoom, clamp(dec / 55, 0.45, 1.1), 'mic'); this.fear.add(2); }
  }

  // ------------------------------------------------------------------------
  // Start menu
  // ------------------------------------------------------------------------
  initMenu() {
    const $ = id => document.getElementById(id);
    $('btn-play-game').addEventListener('click', () => {
      this.audio.ensure();
      this.cfg = CONFIG.difficulties[$('menu-diff').value] || CONFIG.difficulties.normal;
      this.access = { reduceFlashing: $('menu-flash').checked, reduceScares: $('menu-scares').checked, subtitles: $('menu-subs').checked, narration: $('menu-narr').checked };
      const typed = $('menu-seed').value.trim().toUpperCase();
      if (typed && typed !== this.seed) this.newRun(typed); else this.ghost.reset();
      this.hud.hideModal($('start-menu')); this.menu.stop();
      if (this.testMode) { this.menu.dispose(); this.beginPlaying(); return; }
      // Menu -> opening cutscene -> a Begin button (it supplies the click that pointer lock needs) -> the night.
      // The first time the opening cannot be skipped. After that Skip, Space or Esc work.
      this.cinema.play('opening', {
        skippable: StoryFlag.seen(), endButton: true, endLabel: 'Begin',
        onStart: () => this.audio.startAmbience(),
        onDone: completed => { if (completed || StoryFlag.seen()) StoryFlag.markSeen(); this.beginPlaying(); }
      });
    });
    $('menu-daily').addEventListener('click', e => { e.preventDefault(); const d = new Date(); $('menu-seed').value = 'D' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); });
    $('btn-resume').addEventListener('click', () => this.resumeClicked());
    $('btn-pause-restart').addEventListener('click', () => { this.resume(); this.restart(false); });
    $('btn-retry').addEventListener('click', () => this.restart(false));
    $('btn-retry-same').addEventListener('click', () => this.restart(true));
    $('btn-play-again').addEventListener('click', () => this.restart(false));
    $('note-modal').addEventListener('click', () => this.hud.closeNote());
  }
}

window.addEventListener('load', () => {
  try {
    window.__game = new HorrorGame();
    window.__game.debug = new DebugPanel(window.__game);
  } catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="position:fixed;inset:0;z-index:999;background:#000;color:#e88;padding:24px;overflow:auto">Could not start: ' + String(e && e.stack || e) + '</pre>'); }
});
