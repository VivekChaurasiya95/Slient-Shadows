// ==========================================================================
// SILENT SHADOWS: THE SAMHAIN EXTRACTION
// Immersive Photographic First-Person Horror Engine (Three.js WebGL + WebRTC + Web Audio)
// ==========================================================================

class HorrorGame {
  constructor() {
    this.container = document.getElementById('game-container');

    // Game States & Objectives
    this.isPlaying = false;
    this.isDead = false;
    this.hasWon = false;
    this.hasKey = false;
    this.hasRelic = false;
    this.cryptUnlocked = false;

    // Current Room: 'corridor', 'bedroom', 'parlor', 'crypt'
    this.currentRoom = 'corridor';

    // First-Person Camera & Controls
    this.camera = null;
    this.scene = null;
    this.renderer = null;
    this.flashlight = null;
    this.flashlightTarget = null;
    this.isFlashlightOn = true;
    this.isCrouching = false;
    this.isSprinting = false;

    this.playerHeight = 1.7;
    this.crouchHeight = 1.1;
    this.velocity = new THREE.Vector3();
    this.keys = {};
    this.headBobTimer = 0;
    this.camHeight = this.playerHeight;
    this.bobAmp = 0;
    this.flicker = [];
    this.activeRoom = null;
    this.currentInteractable = null;

    // Room Enclosure & Interactive Meshes
    this.roomSpheres = {};
    this.currentRoomMesh = null;
    this.roomTransitions = [];
    this.interactiveObjects = [];
    this.silverKeyMesh = null;
    this.relicMesh = null;
    this.relicLight = null;

    // Room-specific particle systems
    this.dustParticles = null;
    this.fireEmbers = null;
    this.greenSmoke = null;

    // Stalking Entity AI
    this.entity = null;
    this.entityState = 'PATROL'; // PATROL, INVESTIGATE, HUNT
    this.entityRoom = 'corridor';
    this.entityDistance = 18; // distance to player
    this.entitySpeed = 1.8;
    this.entityHuntSpeed = 4.8;
    this.entityGlow = null;
    this.entityEyeMat = null;
    this.entityStunTimer = 0;

    // Hardware Sensors
    this.micActive = false;
    this.camActive = false;
    this.audioCtx = null;
    this.analyser = null;
    this.micStream = null;
    this.micThreshold = 35;
    this.currentDecibels = 0;

    // Procedural Audio
    this.synthCtx = null;
    this.ambientDroneOsc = null;
    this.lastFootstepTime = 0;

    // Mouse Look (Euler Yaw / Pitch)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.minPolarAngle = -Math.PI / 2.3;
    this.maxPolarAngle = Math.PI / 2.3;
    this.isLocked = false;

    this.clock = new THREE.Clock();

    this.initHUD();
    this.initHardwareSetup();
    this.initThree();
    this.buildImmersiveRooms();
    this.initEntity();
    this.setupEvents();
    this.switchRoom('corridor', false);
    this.animate();
  }

  // ------------------------------------------------------------------------
  // 1. Three.js Engine Setup
  // ------------------------------------------------------------------------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030203);
    this.scene.fog = new THREE.FogExp2(0x060508, 0.07);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 80);
    this.camera.position.set(0, this.playerHeight, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Flashlight: a narrow, shadow casting cone that sways slightly with the head
    this.flashlightBase = 2.8;
    this.flashlight = new THREE.SpotLight(0xfff1dc, this.flashlightBase, 24, Math.PI / 6, 0.55, 1.3);
    this.flashlight.position.set(0.18, -0.16, 0);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 24;
    this.flashlight.shadow.bias = -0.0004;
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -8);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    // Faint glow around the player so nearby floor never goes fully black
    this.fillOn = 0.5;
    this.fillOff = 0.12;
    this.playerFillLight = new THREE.PointLight(0xffe2c0, this.fillOn, 7, 2);
    this.camera.add(this.playerFillLight);

    this.ambientLight = new THREE.AmbientLight(0x505870, 0.4);
    this.scene.add(this.ambientLight);

    this.initParticleSystems();
  }

  initParticleSystems() {
    // Dust drifts in a box that follows the player, so every room feels like it has air in it
    const dustCount = 160;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPos[i] = (Math.random() - 0.5) * 8;
      dustPos[i + 1] = Math.random() * 3;
      dustPos[i + 2] = (Math.random() - 0.5) * 8;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dustParticles = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xd9d2c4, size: 0.025, transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.dustParticles.frustumCulled = false;
    this.scene.add(this.dustParticles);
  }

  // ------------------------------------------------------------------------
  // 2. Procedural Textures
  // ------------------------------------------------------------------------
  makeTexture(size, draw, repX = 1, repY = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  speckle(g, s, count, alpha, light = false) {
    for (let i = 0; i < count; i++) {
      const v = light ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
      const r = Math.random() * 2 + 0.5;
      g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
  }

  stains(g, s, count, strength) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 30 + Math.random() * 90;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  texWood(hue = 26) {
    return this.makeTexture(512, (g, s) => {
      const n = 8, w = s / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = `hsl(${hue + Math.random() * 6},${30 + Math.random() * 10}%,${11 + Math.random() * 7}%)`;
        g.fillRect(i * w, 0, w, s);
        for (let k = 0; k < 26; k++) {
          g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
          g.lineWidth = Math.random() * 1.6 + 0.4;
          const x = i * w + Math.random() * w;
          g.beginPath();
          g.moveTo(x, 0);
          g.bezierCurveTo(x + 4, s * 0.3, x - 4, s * 0.7, x + 2, s);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.65)';
        g.fillRect(i * w, 0, 2, s);
        const cut = Math.random() * s;
        g.fillRect(i * w, cut, w, 2);
      }
      this.stains(g, s, 8, 0.28);
      this.speckle(g, s, 1400, 0.25);
    });
  }

  texWall(o) {
    const [h, sat, l] = o.base;
    return this.makeTexture(512, (g, s) => {
      const panelH = Math.round(s * 0.32);
      const top = s - panelH;
      g.fillStyle = `hsl(${h},${sat}%,${l}%)`;
      g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = `hsla(${h},${sat}%,${l + 5}%,0.55)`;
        g.fillRect(x, 0, 14, top);
      }
      g.fillStyle = `hsla(${h},${sat}%,${l + 9}%,0.22)`;
      for (let y = 24; y < top; y += 48) {
        for (let x = 16; x < s; x += 32) {
          g.beginPath();
          g.moveTo(x, y - 8); g.lineTo(x + 6, y); g.lineTo(x, y + 8); g.lineTo(x - 6, y);
          g.fill();
        }
      }
      if (o.peel) {
        for (let i = 0; i < 9; i++) {
          const x = Math.random() * s, y = Math.random() * top, r = 24 + Math.random() * 60;
          g.fillStyle = `hsla(${h + 10},12%,${l + 14}%,0.55)`;
          g.beginPath();
          for (let a = 0; a < 7; a++) {
            const ang = (a / 7) * Math.PI * 2, rr = r * (0.55 + Math.random() * 0.6);
            g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.7);
          }
          g.fill();
        }
      }
      const gt = g.createLinearGradient(0, 0, 0, top);
      gt.addColorStop(0, 'rgba(0,0,0,0.55)');
      gt.addColorStop(0.25, 'rgba(0,0,0,0)');
      g.fillStyle = gt;
      g.fillRect(0, 0, s, top);
      this.stains(g, s, 12, 0.3);

      // Wood wainscot
      const [ph, ps, pl] = o.panel;
      g.fillStyle = `hsl(${ph},${ps}%,${pl}%)`;
      g.fillRect(0, top, s, panelH);
      for (let i = 0; i < 2; i++) {
        const px = i * 256 + 28, py = top + 26, pw = 200, phh = panelH - 46;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(px, py, pw, phh);
        g.strokeStyle = 'rgba(255,255,255,0.1)';
        g.lineWidth = 2;
        g.strokeRect(px + 1, py + 1, pw - 2, phh - 2);
      }
      g.fillStyle = `hsl(${ph},${ps}%,${pl + 5}%)`;
      g.fillRect(0, top - 4, s, 8);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, top + 4, s, 3);
      const gb = g.createLinearGradient(0, s - 70, 0, s);
      gb.addColorStop(0, 'rgba(0,0,0,0)');
      gb.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = gb;
      g.fillRect(0, s - 70, s, 70);
      this.speckle(g, s, 2200, 0.22);
    });
  }

  texStone() {
    return this.makeTexture(512, (g, s) => {
      g.fillStyle = '#15171a';
      g.fillRect(0, 0, s, s);
      const rows = 8, bh = s / rows;
      for (let r = 0; r < rows; r++) {
        const cols = 3, bw = s / cols, off = (r % 2) * (bw / 2);
        for (let c = -1; c <= cols; c++) {
          const x = c * bw + off, v = 20 + Math.random() * 14;
          g.fillStyle = `hsl(${150 + Math.random() * 30},${6 + Math.random() * 6}%,${v}%)`;
          g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
          for (let k = 0; k < 4; k++) {
            g.strokeStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
            g.beginPath();
            g.moveTo(x + Math.random() * bw, r * bh + 3);
            g.lineTo(x + Math.random() * bw, r * bh + bh - 3);
            g.stroke();
          }
        }
      }
      const gm = g.createLinearGradient(0, s * 0.6, 0, s);
      gm.addColorStop(0, 'rgba(40,90,50,0)');
      gm.addColorStop(1, 'rgba(40,90,50,0.35)');
      g.fillStyle = gm;
      g.fillRect(0, s * 0.6, s, s * 0.4);
      this.stains(g, s, 10, 0.3);
      this.speckle(g, s, 2600, 0.3);
    });
  }

  texPlaster() {
    return this.makeTexture(256, (g, s) => {
      g.fillStyle = '#17140f';
      g.fillRect(0, 0, s, s);
      this.stains(g, s, 10, 0.4);
      this.speckle(g, s, 1500, 0.25, true);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        let x = Math.random() * s, y = Math.random() * s;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30; g.lineTo(x, y); }
        g.stroke();
      }
    });
  }

  texDoor() {
    return this.makeTexture(256, (g, s) => {
      g.fillStyle = '#22150d';
      g.fillRect(0, 0, s, s);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
        const x = Math.random() * s;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, s); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 3;
      g.strokeRect(36, 28, s - 72, s * 0.38);
      g.strokeRect(36, s * 0.5, s - 72, s * 0.42);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.strokeRect(40, 32, s - 80, s * 0.38 - 8);
      g.strokeRect(40, s * 0.5 + 4, s - 80, s * 0.42 - 8);
      this.speckle(g, s, 700, 0.3);
    });
  }

  texRug(base) {
    return this.makeTexture(256, (g, s) => {
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(200,170,110,0.45)';
      g.lineWidth = 6;
      g.strokeRect(14, 14, s - 28, s - 28);
      g.lineWidth = 2;
      g.strokeRect(30, 30, s - 60, s - 60);
      g.fillStyle = 'rgba(200,170,110,0.28)';
      for (let y = 56; y < s - 40; y += 36) {
        g.beginPath();
        g.moveTo(s / 2, y - 12); g.lineTo(s / 2 + 12, y); g.lineTo(s / 2, y + 12); g.lineTo(s / 2 - 12, y);
        g.fill();
      }
      this.stains(g, s, 6, 0.3);
      this.speckle(g, s, 2400, 0.3);
    });
  }

  // ------------------------------------------------------------------------
  // 3. Room Construction
  // ------------------------------------------------------------------------
  mat(color, rough = 0.8, metal = 0, extra = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
  }

  addMesh(group, geo, material, x, y, z, opts = {}) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rx) m.rotation.x = opts.rx;
    if (opts.rz) m.rotation.z = opts.rz;
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  addBox(room, material, w, h, d, x, y, z, collide = false, opts = {}) {
    const m = this.addMesh(room.group, new THREE.BoxGeometry(w, h, d), material, x, y, z, opts);
    if (collide) room.colliders.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
    return m;
  }

  addFlicker(room, light, amp, speed) {
    this.flicker.push({ room: room.id, light, base: light.intensity, amp, speed, phase: Math.random() * 10 });
  }

  createRoom(id, b, wallTex, floorTex, ceilTex, H = 3.4) {
    const room = { id, group: new THREE.Group(), bounds: b, colliders: [], H };
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;

    const fT = floorTex.clone(); fT.needsUpdate = true; fT.repeat.set(w / 3, d / 3);
    const floor = this.addMesh(room.group, new THREE.PlaneGeometry(w, d), this.mat(0xffffff, 0.75, 0, { map: fT }), cx, 0, cz, { rx: -Math.PI / 2, cast: false });
    floor.name = 'floor';
    const cT = ceilTex.clone(); cT.needsUpdate = true; cT.repeat.set(w / 3, d / 3);
    this.addMesh(room.group, new THREE.PlaneGeometry(w, d), this.mat(0xffffff, 1, 0, { map: cT }), cx, H, cz, { rx: Math.PI / 2, cast: false });

    const wall = (len, x, z, ry) => {
      const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(len / 3, H / 3.4);
      this.addMesh(room.group, new THREE.PlaneGeometry(len, H), this.mat(0xffffff, 0.95, 0, { map: t }), x, H / 2, z, { ry, cast: false });
    };
    wall(w, cx, b.minZ, 0);
    wall(w, cx, b.maxZ, Math.PI);
    wall(d, b.minX, cz, Math.PI / 2);
    wall(d, b.maxX, cz, -Math.PI / 2);

    room.group.visible = false;
    this.scene.add(room.group);
    this.rooms[id] = room;
    return room;
  }

  // Door set into a wall. side is the wall the door sits on: 'N' z=min, 'S' z=max, 'W' x=min, 'E' x=max
  addDoor(room, side, pos, locked = false) {
    const b = room.bounds;
    const rot = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[side];
    const base = {
      N: [pos, b.minZ], S: [pos, b.maxZ], W: [b.minX, pos], E: [b.maxX, pos]
    }[side];
    const g = new THREE.Group();
    g.position.set(base[0], 0, base[1]);
    g.rotation.y = rot;
    const frameMat = this.mat(0x1a110b, 0.7);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 0.1), this.mat(0xffffff, 0.75, 0, { map: this.texDoor() }));
    slab.position.set(0, 1.1, 0.05);
    slab.castShadow = slab.receiveShadow = true;
    g.add(slab);
    const post = (x) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.2), frameMat);
      m.position.set(x, 1.2, 0.1); m.castShadow = true; g.add(m);
    };
    post(-0.57); post(0.57);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.16, 0.2), frameMat);
    lintel.position.set(0, 2.32, 0.1); g.add(lintel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this.mat(0xb08a45, 0.3, 0.9));
    knob.position.set(0.36, 1.05, 0.13); g.add(knob);
    if (locked) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.04), this.mat(0x222222, 0.4, 0.8));
      plate.position.set(0.36, 1.05 + 0.0, 0.12);
    }
    room.group.add(g);
  }

  addSconce(room, x, y, z, side) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const dir = side === 'W' ? 1 : -1;
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.1), this.mat(0x111111, 0.4, 0.8));
    bracket.position.x = -dir * 0.05;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0xffb060 }));
    flame.position.set(dir * 0.1, 0.18, 0);
    g.add(bracket, flame);
    room.group.add(g);
    const light = new THREE.PointLight(0xff9040, 1.15, 8, 2);
    light.position.set(x + dir * 0.35, y + 0.2, z);
    room.group.add(light);
    this.addFlicker(room, light, 0.35, 7);
  }

  addPainting(room, x, y, z, ry, w = 0.7, h = 0.9) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.06), this.mat(0x2a1c10, 0.5, 0.4));
    const t = this.makeTexture(128, (c, s) => {
      const gr = c.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, '#1e1a14'); gr.addColorStop(1, '#07060a');
      c.fillStyle = gr; c.fillRect(0, 0, s, s);
      c.fillStyle = 'rgba(190,175,150,0.55)';
      c.beginPath(); c.ellipse(s / 2, s * 0.38, s * 0.14, s * 0.18, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(10,8,8,0.9)';
      c.fillRect(s * 0.4, s * 0.34, s * 0.07, s * 0.05); c.fillRect(s * 0.54, s * 0.34, s * 0.07, s * 0.05);
      c.fillStyle = 'rgba(60,45,35,0.9)';
      c.fillRect(s * 0.28, s * 0.58, s * 0.44, s * 0.42);
      this.speckle(c, s, 300, 0.4);
    });
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat(0xffffff, 0.8, 0, { map: t }));
    canvas.position.z = 0.04;
    g.add(frame, canvas);
    room.group.add(g);
  }

  addPumpkin(room, x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0.32, z);
    g.rotation.y = ry;
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 14),
      this.mat(0xc9490a, 0.55, 0, { emissive: 0x4a1a00, emissiveIntensity: 0.9 })
    );
    body.scale.set(1.1, 0.88, 1.1);
    body.castShadow = true;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 6), this.mat(0x2c3a14, 0.9));
    stem.position.y = 0.3;
    const faceTex = this.makeTexture(128, (c, s) => {
      c.clearRect(0, 0, s, s);
      c.fillStyle = '#ffc24a';
      c.beginPath(); c.moveTo(s * 0.2, s * 0.42); c.lineTo(s * 0.42, s * 0.42); c.lineTo(s * 0.31, s * 0.25); c.fill();
      c.beginPath(); c.moveTo(s * 0.58, s * 0.42); c.lineTo(s * 0.8, s * 0.42); c.lineTo(s * 0.69, s * 0.25); c.fill();
      c.beginPath(); c.moveTo(s * 0.2, s * 0.6);
      c.quadraticCurveTo(s * 0.5, s * 0.92, s * 0.8, s * 0.6);
      c.lineTo(s * 0.7, s * 0.58); c.quadraticCurveTo(s * 0.5, s * 0.78, s * 0.3, s * 0.58); c.fill();
    });
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
    );
    face.position.z = 0.365;
    g.add(body, stem, face);
    room.group.add(g);
    const light = new THREE.PointLight(0xff7a18, 1.6, 7, 2);
    light.position.set(x, 0.5, z);
    room.group.add(light);
    this.addFlicker(room, light, 0.3, 9);
    room.colliders.push([x - 0.35, x + 0.35, z - 0.35, z + 0.35]);
  }

  buildImmersiveRooms() {
    this.rooms = {};
    this.flicker = [];
    this.pumpkins = [];

    const wood = this.texWood();
    const plaster = this.texPlaster();
    const stone = this.texStone();

    this.buildCorridor(wood, plaster);
    this.buildParlor(wood, plaster);
    this.buildBedroom(wood, plaster);
    this.buildCrypt(stone);
    this.buildProps();
  }

  buildCorridor(wood, plaster) {
    const wall = this.texWall({ base: [95, 10, 17], panel: [24, 30, 11], peel: true });
    const r = this.createRoom('corridor', { minX: -2, maxX: 2, minZ: -12, maxZ: 12 }, wall, wood, plaster, 3.4);
    r.fog = [0x070608, 0.06];
    r.ambient = [0x545a70, 0.42];

    this.addDoor(r, 'W', -3);
    this.addDoor(r, 'E', -3);
    this.addDoor(r, 'W', 5);
    this.addDoor(r, 'E', 6.5);

    // Runner rug
    const rugTex = this.texRug('#3a1212');
    rugTex.repeat.set(1, 8);
    this.addMesh(r.group, new THREE.PlaneGeometry(1.3, 22), this.mat(0xffffff, 1, 0, { map: rugTex }), 0, 0.012, 0, { rx: -Math.PI / 2, cast: false });

    // Ceiling beams
    const beam = this.mat(0x1c120b, 0.8);
    for (let z = -10; z <= 10; z += 4) this.addBox(r, beam, 4, 0.22, 0.28, 0, 3.29, z, false, { cast: false });

    // Crypt gate at the north end
    const stoneMat = this.mat(0x23262a, 0.95);
    this.addBox(r, stoneMat, 0.35, 2.7, 0.3, -1.0, 1.35, -11.8);
    this.addBox(r, stoneMat, 0.35, 2.7, 0.3, 1.0, 1.35, -11.8);
    this.addBox(r, stoneMat, 2.35, 0.4, 0.3, 0, 2.7, -11.8);
    this.addMesh(r.group, new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshBasicMaterial({ color: 0x03100a }), 0, 1.3, -11.93, { cast: false });
    const iron = this.mat(0x15151a, 0.45, 0.85);
    for (let i = 0; i < 11; i++) {
      this.addMesh(r.group, new THREE.CylinderGeometry(0.022, 0.022, 2.6, 6), iron, -0.8 + i * 0.16, 1.3, -11.75);
    }
    [0.4, 1.3, 2.2].forEach(y => this.addBox(r, iron, 1.75, 0.05, 0.05, 0, y, -11.72));

    // Sealed exit at the south end: heavy double door wrapped in chains
    this.addDoor(r, 'S', -0.5);
    this.addDoor(r, 'S', 0.55);
    const chain = this.mat(0x2a2a2e, 0.4, 0.9);
    for (let i = 0; i < 16; i++) {
      const link = this.addMesh(r.group, new THREE.TorusGeometry(0.05, 0.014, 6, 10), chain, -0.9 + i * 0.12, 0.9 + Math.sin(i * 0.8) * 0.06 + i * 0.05, 11.78, { ry: i % 2 ? Math.PI / 2 : 0 });
      link.castShadow = false;
    }
    for (let i = 0; i < 16; i++) {
      this.addMesh(r.group, new THREE.TorusGeometry(0.05, 0.014, 6, 10), chain, 0.9 - i * 0.12, 0.8 + i * 0.06, 11.76, { ry: i % 2 ? Math.PI / 2 : 0, cast: false });
    }

    this.addSconce(r, -1.95, 2.0, 8, 'W');
    this.addSconce(r, 1.95, 2.0, 2, 'E');
    this.addSconce(r, -1.95, 2.0, -6, 'W');
    this.addSconce(r, 1.95, 2.0, -9, 'E');

    this.addPainting(r, -1.93, 1.9, 1, Math.PI / 2);
    this.addPainting(r, 1.93, 1.9, -6, -Math.PI / 2);
    this.addPainting(r, 1.93, 1.9, 9, -Math.PI / 2, 0.6, 0.8);

    this.addPumpkin(r, 1.45, 9.2, -0.5);
    this.addPumpkin(r, -1.45, -8.6, 0.4);
  }

  buildParlor(wood, plaster) {
    const wall = this.texWall({ base: [350, 38, 15], panel: [22, 35, 10] });
    const r = this.createRoom('parlor', { minX: -5, maxX: 5, minZ: -6, maxZ: 6 }, wall, wood, plaster, 3.4);
    r.fog = [0x0a0505, 0.055];
    r.ambient = [0x7a4a30, 0.5];

    this.addDoor(r, 'S', 0);

    const stoneMat = this.mat(0x2b2623, 0.95);
    const darkWood = this.mat(0x24160d, 0.6, 0.1);
    const fabric = this.mat(0x4a1a1a, 0.95);

    // Fireplace
    this.addBox(r, stoneMat, 0.6, 2.4, 0.6, -1.4, 1.2, -5.7);
    this.addBox(r, stoneMat, 0.6, 2.4, 0.6, 1.4, 1.2, -5.7);
    this.addBox(r, stoneMat, 3.4, 0.5, 0.6, 0, 2.15, -5.7);
    this.addBox(r, darkWood, 3.8, 0.12, 0.8, 0, 2.45, -5.65);
    this.addMesh(r.group, new THREE.PlaneGeometry(2.2, 1.9), new THREE.MeshBasicMaterial({ color: 0x050302 }), 0, 0.95, -5.93, { cast: false });
    const logMat = this.mat(0x1a0f08, 0.9, 0, { emissive: 0x551a00, emissiveIntensity: 0.6 });
    this.addMesh(r.group, new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), logMat, 0, 0.12, -5.55, { rz: Math.PI / 2 });
    this.addMesh(r.group, new THREE.CylinderGeometry(0.09, 0.09, 1.0, 8), logMat, 0, 0.3, -5.5, { rz: Math.PI / 2 + 0.3 });
    this.fireFlames = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.16 - i * 0.02, 0.7 + i * 0.1, 8),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb347 : 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false })
      );
      f.position.set(-0.35 + i * 0.24, 0.5, -5.55);
      r.group.add(f);
      this.fireFlames.push(f);
    }
    const fire = new THREE.PointLight(0xff6a1a, 3.2, 14, 2);
    fire.position.set(0, 0.9, -4.9);
    fire.castShadow = false;
    r.group.add(fire);
    this.addFlicker(r, fire, 0.35, 11);

    const emberPos = new Float32Array(60 * 3);
    for (let i = 0; i < emberPos.length; i += 3) {
      emberPos[i] = (Math.random() - 0.5) * 1.2;
      emberPos[i + 1] = Math.random() * 1.6;
      emberPos[i + 2] = -5.5 + (Math.random() - 0.5) * 0.3;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    this.fireEmbers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.04, transparent: true, opacity: 0.9, depthWrite: false }));
    this.fireEmbers.frustumCulled = false;
    r.group.add(this.fireEmbers);

    // Rug and seating
    const rug = this.texRug('#4a1a1a');
    this.addMesh(r.group, new THREE.PlaneGeometry(4.4, 3.2), this.mat(0xffffff, 1, 0, { map: rug }), 0, 0.012, -1.6, { rx: -Math.PI / 2, cast: false });
    this.addBox(r, fabric, 2.2, 0.45, 0.9, 0, 0.3, 0.3, true);
    this.addBox(r, fabric, 2.2, 0.75, 0.22, 0, 0.62, 0.82);
    this.addBox(r, fabric, 0.22, 0.6, 0.9, -1.1, 0.45, 0.3);
    this.addBox(r, fabric, 0.22, 0.6, 0.9, 1.1, 0.45, 0.3);
    this.addBox(r, darkWood, 1.1, 0.06, 0.6, 0, 0.45, -1.7, true);
    this.addBox(r, darkWood, 0.08, 0.42, 0.08, -0.5, 0.21, -1.5);
    this.addBox(r, darkWood, 0.08, 0.42, 0.08, 0.5, 0.21, -1.5);
    this.addBox(r, fabric, 0.9, 0.5, 0.9, -2.6, 0.28, -2.2, true, { ry: 0.5 });
    this.addBox(r, fabric, 0.9, 0.5, 0.9, 2.6, 0.28, -2.2, true, { ry: -0.5 });

    // Bookcase along the west wall
    this.addBox(r, darkWood, 0.5, 2.6, 3.2, -4.72, 1.3, -1.8, true);
    const bookColors = [0x5a1a1a, 0x1d2f45, 0x2f4a2a, 0x4a3a1a, 0x2a1a3a, 0x3a1a1a];
    for (let shelf = 0; shelf < 4; shelf++) {
      let z = -3.25;
      while (z < -0.4) {
        const bw = 0.06 + Math.random() * 0.06, bh = 0.3 + Math.random() * 0.22;
        const book = this.mat(bookColors[Math.floor(Math.random() * bookColors.length)], 0.85);
        const m = this.addMesh(r.group, new THREE.BoxGeometry(0.28, bh, bw), book, -4.55, 0.35 + shelf * 0.62 + bh / 2, z + bw / 2, { cast: false });
        m.rotation.z = Math.random() < 0.06 ? 0.25 : 0;
        z += bw + 0.012;
      }
    }

    // Grandfather clock
    this.addBox(r, darkWood, 0.6, 2.3, 0.45, -4.5, 1.15, 3.6, true);
    this.addMesh(r.group, new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: 0xcfc6a0 }), -4.5 + 0.26, 1.9, 3.6, { ry: Math.PI / 2, cast: false });

    this.addPainting(r, 4.93, 1.9, -1, -Math.PI / 2, 0.9, 1.2);
    this.addPainting(r, -2.8, 2.0, -5.94, 0, 0.6, 0.8);
    this.addPumpkin(r, 3.9, -4.8, -0.4);
  }

  buildBedroom(wood, plaster) {
    const wall = this.texWall({ base: [212, 16, 18], panel: [26, 22, 12], peel: true });
    const r = this.createRoom('bedroom', { minX: -5, maxX: 5, minZ: -6, maxZ: 6 }, wall, wood, plaster, 3.4);
    r.fog = [0x05070b, 0.06];
    r.ambient = [0x4a5f88, 0.55];

    this.addDoor(r, 'S', 0);

    const darkWood = this.mat(0x1e140d, 0.6, 0.1);
    const linen = this.mat(0x8d8f98, 0.95);

    // Moonlit window
    const frameMat = this.mat(0x120d09, 0.6);
    this.addBox(r, frameMat, 1.7, 0.1, 0.12, 0, 2.8, -5.92, false, { cast: false });
    this.addBox(r, frameMat, 1.7, 0.1, 0.12, 0, 1.0, -5.92, false, { cast: false });
    this.addBox(r, frameMat, 0.1, 1.9, 0.12, -0.8, 1.9, -5.92, false, { cast: false });
    this.addBox(r, frameMat, 0.1, 1.9, 0.12, 0.8, 1.9, -5.92, false, { cast: false });
    this.addBox(r, frameMat, 0.06, 1.8, 0.1, 0, 1.9, -5.92, false, { cast: false });
    this.addBox(r, frameMat, 1.6, 0.06, 0.1, 0, 1.9, -5.92, false, { cast: false });
    this.addMesh(r.group, new THREE.PlaneGeometry(1.6, 1.8), new THREE.MeshBasicMaterial({ color: 0x5c7cb8 }), 0, 1.9, -5.97, { cast: false });
    const moon = new THREE.SpotLight(0x8ea8e8, 3.4, 16, 0.75, 0.8, 1.2);
    moon.position.set(0, 2.4, -6);
    moon.target.position.set(0.5, 0, -1.5);
    r.group.add(moon, moon.target);

    // Bed
    this.addBox(r, darkWood, 1.8, 0.35, 2.3, -3.2, 0.3, -4.0, true);
    this.addBox(r, linen, 1.7, 0.22, 2.1, -3.2, 0.58, -3.95);
    this.addBox(r, this.mat(0x2a2f40, 0.95), 1.72, 0.1, 1.3, -3.2, 0.72, -3.55);
    this.addBox(r, linen, 0.8, 0.14, 0.4, -3.2, 0.74, -4.8);
    this.addBox(r, darkWood, 1.9, 1.3, 0.12, -3.2, 0.85, -5.1);

    // Vanity with the key on top
    this.addBox(r, darkWood, 0.8, 1.0, 1.6, 4.1, 0.5, -4.5, true);
    this.addBox(r, this.mat(0x0c0c10, 0.12, 1), 0.04, 1.0, 0.8, 4.97, 1.75, -4.5, false, { cast: false });
    this.addBox(r, darkWood, 0.4, 0.42, 0.4, 3.0, 0.21, -4.3, true);

    // Wardrobe
    this.addBox(r, darkWood, 0.8, 2.5, 1.7, 4.55, 1.25, 1.4, true);
    this.addBox(r, this.mat(0xb08a45, 0.3, 0.9), 0.04, 0.2, 0.04, 4.12, 1.1, 1.1);
    this.addBox(r, this.mat(0xb08a45, 0.3, 0.9), 0.04, 0.2, 0.04, 4.12, 1.1, 1.7);

    // Nightstand with a candle
    this.addBox(r, darkWood, 0.55, 0.6, 0.55, -1.5, 0.3, -5.6, true);
    this.addMesh(r.group, new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8), this.mat(0xe8dfc8, 0.7), -1.5, 0.69, -5.6);
    this.addMesh(r.group, new THREE.ConeGeometry(0.02, 0.07, 6), new THREE.MeshBasicMaterial({ color: 0xffd080 }), -1.5, 0.82, -5.6, { cast: false });
    const candle = new THREE.PointLight(0xffa850, 1.2, 7, 2);
    candle.position.set(-1.5, 0.95, -5.4);
    r.group.add(candle);
    this.addFlicker(r, candle, 0.4, 8);

    const rug = this.texRug('#2a2f40');
    this.addMesh(r.group, new THREE.PlaneGeometry(3.4, 2.4), this.mat(0xffffff, 1, 0, { map: rug }), -0.6, 0.012, -1.0, { rx: -Math.PI / 2, cast: false });
    this.addPainting(r, -4.93, 1.9, 0.5, Math.PI / 2, 0.8, 1.0);
  }

  buildCrypt(stone) {
    const r = this.createRoom('crypt', { minX: -5, maxX: 5, minZ: -8, maxZ: 6 }, stone, stone, stone, 3.8);
    r.fog = [0x040c07, 0.085];
    r.ambient = [0x2c5a40, 0.5];

    this.addDoor(r, 'S', 0);

    const stoneMat = this.mat(0x32363a, 0.95);

    // Altar on a stepped base
    this.addBox(r, stoneMat, 2.8, 0.2, 1.6, 0, 0.1, -5.6, true);
    this.addBox(r, stoneMat, 2.0, 0.8, 1.0, 0, 0.6, -5.6);
    this.addBox(r, this.mat(0x3d4044, 0.9), 2.2, 0.12, 1.2, 0, 1.06, -5.6);

    // Pillars
    [[-3, -1], [3, -1], [-3, -4.5], [3, -4.5]].forEach(([x, z]) => {
      this.addMesh(r.group, new THREE.CylinderGeometry(0.34, 0.4, 3.8, 10), stoneMat, x, 1.9, z);
      this.addBox(r, stoneMat, 0.9, 0.2, 0.9, x, 0.1, z, true);
      this.addBox(r, stoneMat, 0.9, 0.2, 0.9, x, 3.7, z, false, { cast: false });
    });

    // Sarcophagi
    this.addBox(r, stoneMat, 1.1, 0.7, 2.4, -3.7, 0.35, 2.6, true);
    this.addBox(r, this.mat(0x3a3e42, 0.9), 1.2, 0.16, 2.5, -3.7, 0.78, 2.6, false, { ry: 0.04 });
    this.addBox(r, stoneMat, 1.1, 0.7, 2.4, 3.7, 0.35, 2.4, true);
    this.addBox(r, this.mat(0x3a3e42, 0.9), 1.2, 0.18, 2.5, 3.7, 0.79, 2.4, false, { ry: -0.12 });

    // Ground light and torches
    const green = new THREE.PointLight(0x2bff7a, 1.3, 9, 2);
    green.position.set(0, 0.5, -2);
    r.group.add(green);
    this.addFlicker(r, green, 0.2, 3);
    this.addSconce(r, -4.9, 2.2, -2.5, 'W');
    this.addSconce(r, 4.9, 2.2, 0.5, 'E');

    const smokePos = new Float32Array(90 * 3);
    for (let i = 0; i < smokePos.length; i += 3) {
      smokePos[i] = (Math.random() - 0.5) * 8;
      smokePos[i + 1] = Math.random() * 1.6;
      smokePos[i + 2] = -2 + (Math.random() - 0.5) * 9;
    }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    this.greenSmoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ color: 0x5dff9a, size: 0.09, transparent: true, opacity: 0.35, depthWrite: false }));
    this.greenSmoke.frustumCulled = false;
    r.group.add(this.greenSmoke);
  }

  buildProps() {
    // Silver key, resting on the bedroom vanity
    const keyGroup = new THREE.Group();
    const silver = this.mat(0xdfe6ee, 0.25, 0.95, { emissive: 0x6fa6d8, emissiveIntensity: 0.55 });
    const keyHead = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 8, 18), silver);
    keyHead.position.y = 0.12;
    const keyStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), silver);
    keyStem.position.y = -0.1;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.03), silver); t1.position.set(0.05, -0.2, 0);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.03), silver); t2.position.set(0.04, -0.12, 0);
    keyGroup.add(keyHead, keyStem, t1, t2);
    keyGroup.position.set(4.1, 1.32, -4.5);
    this.silverKeyMesh = keyGroup;
    this.silverKeyMesh.visible = false;
    this.rooms.bedroom.group.add(this.silverKeyMesh);

    this.keyLight = new THREE.PointLight(0x8ec8ff, 1.4, 4, 2);
    this.keyLight.position.set(4.0, 1.5, -4.5);
    this.keyLight.visible = false;
    this.rooms.bedroom.group.add(this.keyLight);

    // Horned skull relic on the crypt altar
    const skullGroup = new THREE.Group();
    const bone = this.mat(0xd8d4b0, 0.55, 0, { emissive: 0x1a6a2a, emissiveIntensity: 0.55 });
    const skullHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), bone);
    skullHead.scale.set(1, 1.05, 1.1);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), bone);
    jaw.position.set(0, -0.22, 0.03);
    const hornMat = this.mat(0x15110b, 0.6, 0, { emissive: 0x0b2a12 });
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 8), hornMat);
    hornL.position.set(-0.2, 0.22, 0); hornL.rotation.z = 0.7;
    const hornR = hornL.clone();
    hornR.position.set(0.2, 0.22, 0); hornR.rotation.z = -0.7;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x39ff7a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eyeL.position.set(-0.08, 0.02, 0.2);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08;
    skullGroup.add(skullHead, jaw, hornL, hornR, eyeL, eyeR);
    skullGroup.position.set(0, 1.4, -5.6);
    this.relicMesh = skullGroup;
    this.relicMesh.visible = false;
    this.rooms.crypt.group.add(this.relicMesh);

    this.relicLight = new THREE.PointLight(0x39ff7a, 3.0, 9, 2);
    this.relicLight.position.set(0, 1.9, -5.0);
    this.relicLight.visible = false;
    this.rooms.crypt.group.add(this.relicLight);
  }

  // ------------------------------------------------------------------------
  // 3b. Room Switching & Doorway Management
  // ------------------------------------------------------------------------
  switchRoom(roomId, playSound = true) {
    if (playSound) this.playProceduralSound('door');

    const from = this.currentRoom;
    this.currentRoom = roomId;
    const room = this.rooms[roomId];
    this.activeRoom = room;

    Object.keys(this.rooms).forEach(id => { this.rooms[id].group.visible = (id === roomId); });

    // Place the player at the matching doorway and face into the room
    let spawn = { x: 0, z: 4.3, yaw: 0 };
    if (roomId === 'corridor') {
      if (from === 'parlor') spawn = { x: -0.9, z: -3, yaw: -Math.PI / 2 };
      else if (from === 'bedroom') spawn = { x: 0.9, z: -3, yaw: Math.PI / 2 };
      else if (from === 'crypt') spawn = { x: 0, z: -9.4, yaw: Math.PI };
      else spawn = { x: 0, z: 9, yaw: 0 };
    }
    this.camera.position.set(spawn.x, this.camHeight || this.playerHeight, spawn.z);
    this.euler.set(0, spawn.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);

    // Atmosphere
    this.scene.fog.color.setHex(room.fog[0]);
    this.scene.fog.density = room.fog[1];
    this.ambientLight.color.setHex(room.ambient[0]);
    this.ambientLight.intensity = room.ambient[1];

    const hasKey = this.hasKey, hasRelic = this.hasRelic;
    const isBedroom = roomId === 'bedroom', isCrypt = roomId === 'crypt';
    this.silverKeyMesh.visible = isBedroom && !hasKey;
    this.keyLight.visible = isBedroom && !hasKey;
    this.relicMesh.visible = isCrypt && !hasRelic;
    this.relicLight.visible = isCrypt && !hasRelic;

    const obj = document.getElementById('obj-text');
    if (isBedroom) {
      obj.textContent = hasKey ? 'Return to the corridor and unlock the crypt' : 'Find the silver key on the vanity';
    } else if (roomId === 'parlor') {
      obj.textContent = 'Parlor. The fire is warm, keep listening';
    } else if (isCrypt) {
      obj.textContent = hasRelic ? 'Alarm raised. Get back to the front gate' : 'Take the horned skull from the altar';
    } else {
      obj.textContent = hasRelic ? 'Run to the front gate' : (hasKey ? 'Unlock the crypt gate at the end of the hall' : 'Find the silver key. Parlor on the left, bedroom on the right');
    }

    // A hunting entity follows you through the door
    if (this.entity && this.entityState === 'HUNT') {
      this.entityRoom = roomId;
      this.placeEntityAway();
    } else if (this.entity) {
      this.entity.visible = false;
    }

    this.setupRoomDoorways(roomId);
  }

  setupRoomDoorways(roomId) {
    this.interactiveObjects = [];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    if (roomId === 'corridor') {
      this.interactiveObjects.push({
        name: 'door_parlor', pos: V(-2, 1.2, -3), prompt: 'Enter parlor',
        action: () => this.switchRoom('parlor')
      });
      this.interactiveObjects.push({
        name: 'door_bedroom', pos: V(2, 1.2, -3), prompt: 'Enter bedroom',
        action: () => this.switchRoom('bedroom')
      });
      this.interactiveObjects.push({
        name: 'door_crypt', pos: V(0, 1.2, -11.8),
        prompt: this.cryptUnlocked ? 'Enter crypt' : 'Unlock crypt gate (needs silver key)',
        action: () => {
          if (this.cryptUnlocked) {
            this.switchRoom('crypt');
          } else if (this.hasKey) {
            this.cryptUnlocked = true;
            this.playProceduralSound('door');
            this.switchRoom('crypt');
          } else {
            document.getElementById('obj-text').textContent = 'Gate locked. The silver key is in the bedroom';
          }
        }
      });
      this.interactiveObjects.push({
        name: 'exit_gate', pos: V(0, 1.2, 11.8),
        prompt: this.hasRelic ? 'Escape the manor' : 'Sealed (needs the skull)',
        action: () => {
          if (this.hasRelic) {
            this.triggerVictory();
          } else {
            document.getElementById('obj-text').textContent = 'The exit is sealed. Bring the skull from the crypt first';
          }
        }
      });
    } else {
      this.interactiveObjects.push({
        name: 'door_corridor', pos: V(0, 1.2, 5.9), prompt: 'Back to corridor',
        action: () => this.switchRoom('corridor')
      });

      if (roomId === 'bedroom' && !this.hasKey) {
        this.interactiveObjects.push({
          name: 'silver_key', pos: V(4.1, 1.3, -4.5), prompt: 'Take silver key',
          action: () => {
            this.hasKey = true;
            this.silverKeyMesh.visible = false;
            this.keyLight.visible = false;
            this.playProceduralSound('pickup');
            document.getElementById('obj-text').textContent = 'Silver key taken. Return to the corridor to unlock the crypt';
          }
        });
      }

      if (roomId === 'crypt' && !this.hasRelic) {
        this.interactiveObjects.push({
          name: 'cursed_relic', pos: V(0, 1.4, -5.6), prompt: 'Take horned skull (starts the alarm)',
          action: () => {
            this.hasRelic = true;
            this.relicMesh.visible = false;
            this.relicLight.visible = false;
            this.playProceduralSound('relic');
            document.getElementById('obj-text').textContent = 'Alarm raised. Run to the front door';
            this.alertEntity(this.camera.position, 'hunt');
          }
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  // 4. Stalking Entity AI
  // ------------------------------------------------------------------------
  initEntity() {
    this.entity = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: 0x050405, roughness: 1, metalness: 0 });

    // Tall, thin, too-long limbs
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.5, 8), black);
    torso.position.y = 1.35;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.9, 6), black);
    legs.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), black);
    head.scale.set(0.85, 1.25, 0.9);
    head.position.y = 2.28;
    const armGeo = new THREE.CylinderGeometry(0.035, 0.025, 1.6, 6);
    const armL = new THREE.Mesh(armGeo, black);
    armL.position.set(-0.3, 1.25, 0.05);
    armL.rotation.z = 0.12;
    const armR = armL.clone();
    armR.position.x = 0.3;
    armR.rotation.z = -0.12;

    this.entityEyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, this.entityEyeMat);
    eyeL.position.set(-0.07, 2.3, 0.14);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;

    this.entityGlow = new THREE.PointLight(0xff5500, 0.8, 4, 2);
    this.entityGlow.position.set(0, 2.2, 0.4);

    [torso, legs, head, armL, armR].forEach(m => { m.castShadow = true; });
    this.entity.add(torso, legs, head, armL, armR, eyeL, eyeR, this.entityGlow);
    this.entity.visible = false;
    this.scene.add(this.entity);

    this.investigateTimer = 0;
    this.entityStunCooldown = 0;
  }

  // Put the entity at the spot in the current room that is farthest from the player
  placeEntityAway() {
    const room = this.rooms[this.currentRoom];
    const b = room.bounds, m = 0.9;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const spots = [
      [b.minX + m, b.minZ + m], [b.maxX - m, b.minZ + m],
      [b.minX + m, b.maxZ - m], [b.maxX - m, b.maxZ - m],
      [cx, b.minZ + m], [cx, b.maxZ - m]
    ];
    const p = this.camera.position;
    let best = spots[0], bestD = -1;
    spots.forEach(s => {
      const d = Math.hypot(s[0] - p.x, s[1] - p.z);
      if (d > bestD) { bestD = d; best = s; }
    });
    this.entity.position.set(best[0], 0, best[1]);
    this.entity.visible = true;
  }

  moveEntityToward(speed, delta) {
    const p = this.camera.position, e = this.entity.position;
    const dx = p.x - e.x, dz = p.z - e.z;
    const len = Math.hypot(dx, dz) || 1;
    const b = this.rooms[this.currentRoom].bounds;
    e.x = Math.max(b.minX + 0.4, Math.min(b.maxX - 0.4, e.x + (dx / len) * speed * 1));
    e.z = Math.max(b.minZ + 0.4, Math.min(b.maxZ - 0.4, e.z + (dz / len) * speed * 1));
    this.entity.rotation.y = Math.atan2(dx, dz);
    this.entityDistance = Math.hypot(p.x - e.x, p.z - e.z);
  }

  updateEntity(delta) {
    if (!this.entity || this.isDead || this.hasWon) return;

    if (this.entityStunCooldown > 0) this.entityStunCooldown -= delta;

    const active = this.entityState === 'HUNT' || this.entityState === 'INVESTIGATE';
    if (!active) {
      this.entity.visible = false;
      return;
    }

    this.entity.visible = (this.entityRoom === this.currentRoom);

    // Investigation fades out if you stay quiet
    if (this.entityState === 'INVESTIGATE') {
      this.investigateTimer -= delta;
      if (this.investigateTimer <= 0) {
        this.entityState = 'PATROL';
        this.entity.visible = false;
        document.getElementById('threat-alert').style.display = 'none';
        return;
      }
    }

    const hunting = this.entityState === 'HUNT';
    this.entityEyeMat.color.setHex(hunting ? 0xff1a1a : 0xff8a00);
    this.entityGlow.color.setHex(hunting ? 0xff1a1a : 0xff7700);

    // Flashlight stun: a short stagger and a shove back, then it needs time to recover
    if (this.isFlashlightOn && this.entity.visible && this.entityStunTimer <= 0 && this.entityStunCooldown <= 0) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const toEntity = this.entity.position.clone().add(new THREE.Vector3(0, 1.4, 0)).sub(this.camera.position).normalize();
      if (camDir.dot(toEntity) > 0.93 && this.entityDistance < 9) {
        this.entityStunTimer = 1.6;
        this.entityStunCooldown = 6;
        const away = this.entity.position.clone().sub(this.camera.position).setY(0).normalize().multiplyScalar(2.5);
        const b = this.rooms[this.currentRoom].bounds;
        this.entity.position.x = Math.max(b.minX + 0.4, Math.min(b.maxX - 0.4, this.entity.position.x + away.x));
        this.entity.position.z = Math.max(b.minZ + 0.4, Math.min(b.maxZ - 0.4, this.entity.position.z + away.z));
        this.playProceduralSound('stun');
      }
    }

    if (this.entityStunTimer > 0) {
      this.entityStunTimer -= delta;
      this.entity.position.y = 0;
      this.entity.rotation.z = Math.sin(performance.now() * 0.06) * 0.08;
      return;
    }
    this.entity.rotation.z = Math.sin(performance.now() * 0.004) * 0.03;

    if (!this.entity.visible) return;
    this.moveEntityToward((hunting ? this.entityHuntSpeed : this.entitySpeed) * delta, delta);

    if (this.entityDistance < 1.0) {
      this.triggerDeath();
    }
  }

  alertEntity(soundOrigin, severity = 'investigate') {
    if (this.isDead || this.hasWon) return;

    const alertBanner = document.getElementById('threat-alert');

    if (severity === 'hunt' || this.hasRelic) {
      if (this.entityState === 'HUNT') return;
      this.entityState = 'HUNT';
      this.entityRoom = this.currentRoom;
      this.placeEntityAway();
      alertBanner.textContent = 'It heard you and is coming';
      alertBanner.style.display = 'block';
      this.playProceduralSound('roar');
    } else if (this.entityState === 'PATROL') {
      this.entityState = 'INVESTIGATE';
      this.entityRoom = this.currentRoom;
      this.investigateTimer = 8;
      this.placeEntityAway();
      alertBanner.textContent = 'It heard something and is investigating';
      alertBanner.style.display = 'block';
      this.playProceduralSound('growl');
    } else if (this.entityState === 'INVESTIGATE') {
      this.investigateTimer = Math.max(this.investigateTimer, 4);
    }
  }

  // ------------------------------------------------------------------------
  // 5. Player Controls, Walking & Interaction
  // ------------------------------------------------------------------------
  setupEvents() {
    this.container.addEventListener('click', () => {
      if (!this.isLocked && this.isPlaying && !this.isDead && !this.hasWon) {
        this.container.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (document.pointerLockElement === this.container);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      this.euler.y -= movementX * 0.0024;
      this.euler.x -= movementY * 0.0024;
      this.euler.x = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
    });

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Toggle Crouch (C or Control)
      if ((e.code === 'KeyC' || e.code === 'ControlLeft') && !e.repeat) {
        this.isCrouching = !this.isCrouching;
        document.getElementById('stance-indicator').textContent = this.isCrouching ? 'Crouching' : 'Standing';
      }

      // Toggle Flashlight (F)
      if (e.code === 'KeyF') {
        this.isFlashlightOn = !this.isFlashlightOn;
        this.flashlight.intensity = this.isFlashlightOn ? this.flashlightBase : 0;
        if (this.playerFillLight) this.playerFillLight.intensity = this.isFlashlightOn ? this.fillOn : this.fillOff;
        this.playProceduralSound('click');
      }

      // Interact (E)
      if (e.code === 'KeyE' && !e.repeat) {
        this.triggerCurrentInteraction();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isLocked && e.button === 0) {
        this.triggerCurrentInteraction();
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateMovement(delta) {
    if (!this.isLocked || this.isDead || this.hasWon) return;

    this.isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isCrouching;

    let targetSpeed = 3.6;
    if (this.isCrouching) targetSpeed = 1.8;
    else if (this.isSprinting) targetSpeed = 6.2;

    const moveZ = Number(!!this.keys['KeyW'] || !!this.keys['ArrowUp']) - Number(!!this.keys['KeyS'] || !!this.keys['ArrowDown']);
    const moveX = Number(!!this.keys['KeyD'] || !!this.keys['ArrowRight']) - Number(!!this.keys['KeyA'] || !!this.keys['ArrowLeft']);

    // Camera height adjustment for crouching
    const targetHeight = this.isCrouching ? this.crouchHeight : this.playerHeight;
    this.camHeight += (targetHeight - this.camHeight) * Math.min(1, 10 * delta);
    let moving = false;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const moveVector = new THREE.Vector3();
    if (moveZ !== 0) moveVector.addScaledVector(forward, moveZ);
    if (moveX !== 0) moveVector.addScaledVector(right, moveX);

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(targetSpeed * delta);
      
      // Slide along walls and furniture by testing each axis on its own
      const nx = this.camera.position.x + moveVector.x;
      const nz = this.camera.position.z + moveVector.z;
      if (this.canStandAt(nx, this.camera.position.z)) this.camera.position.x = nx;
      if (this.canStandAt(this.camera.position.x, nz)) this.camera.position.z = nz;
      moving = true;

      this.headBobTimer += delta * (this.isSprinting ? 12 : (this.isCrouching ? 6 : 8));

      // Footstep Sounds
      const interval = this.isSprinting ? 320 : (this.isCrouching ? 680 : 480);
      const now = performance.now();
      if (now - this.lastFootstepTime > interval) {
        this.lastFootstepTime = now;
        if (!this.isCrouching) {
          this.playProceduralSound('footstep');
          if (this.isSprinting) {
            this.alertEntity(this.camera.position, 'investigate');
          }
        }
      }
    }

    // Head bob eases in and out instead of snapping
    const bobTarget = moving ? (this.isSprinting ? 0.06 : (this.isCrouching ? 0.012 : 0.03)) : 0;
    this.bobAmp += (bobTarget - this.bobAmp) * Math.min(1, 8 * delta);
    this.camera.position.y = this.camHeight + Math.sin(this.headBobTimer) * this.bobAmp;
  }

  canStandAt(x, z) {
    const room = this.activeRoom;
    if (!room) return true;
    const b = room.bounds, r = 0.35;
    if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return false;
    for (const c of room.colliders) {
      if (x > c[0] - r && x < c[1] + r && z > c[2] - r && z < c[3] + r) return false;
    }
    return true;
  }

  checkRaycastInteractions() {
    if (!this.isLocked || this.isDead || this.hasWon) return;

    // Raycast from camera center
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const promptEl = document.getElementById('interact-prompt');
    const promptText = document.getElementById('prompt-text');
    const reticle = document.getElementById('reticle');

    let closest = null;
    let minAngle = 0.5; // cone angle in radians

    for (let item of this.interactiveObjects) {
      const toItem = item.pos.clone().sub(this.camera.position);
      const dist = toItem.length();
      if (dist < 3.6) {
        toItem.normalize();
        const angle = camDir.angleTo(toItem);
        if (angle < minAngle) {
          minAngle = angle;
          closest = item;
        }
      }
    }

    if (closest) {
      this.currentInteractable = closest;
      promptText.textContent = closest.prompt;
      promptEl.style.display = 'block';
      reticle.classList.add('highlight');
    } else {
      this.currentInteractable = null;
      promptEl.style.display = 'none';
      reticle.classList.remove('highlight');
    }
  }

  triggerCurrentInteraction() {
    if (this.currentInteractable && this.currentInteractable.action) {
      this.currentInteractable.action();
    }
  }

  // ------------------------------------------------------------------------
  // 6. Microphone & Bodycam Hardware Integration
  // ------------------------------------------------------------------------
  initHardwareSetup() {
    const btnMic = document.getElementById('btn-toggle-mic');
    const btnCam = document.getElementById('btn-toggle-cam');
    const micLabel = document.getElementById('mic-status-label');
    const camLabel = document.getElementById('cam-status-label');

    btnMic.addEventListener('click', async () => {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.setupAudioAnalyser(this.micStream);
        this.micActive = true;
        btnMic.classList.add('active');
        micLabel.textContent = 'Connected, live level';
      } catch (err) {
        console.warn('Microphone error:', err);
        alert('Could not access the microphone. The game will still pick up in-game movement noise.');
      }
    });

    btnCam.addEventListener('click', async () => {
      const videoEl = document.getElementById('webcam-stream');
      const fallback = document.getElementById('cam-fallback');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 480 }, height: { ideal: 360 } }
        });
        videoEl.srcObject = stream;
        videoEl.style.display = 'block';
        fallback.style.display = 'none';
        this.camActive = true;
        btnCam.classList.add('active');
        camLabel.textContent = 'Connected, night vision on';
      } catch (err) {
        console.warn('Camera error:', err);
        alert('Could not access the camera. The bodycam will stay offline.');
      }
    });
  }

  setupAudioAnalyser(stream) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.25;
    source.connect(this.analyser);
  }

  updateMicrophoneTracking() {
    let decibels = 0;

    if (this.micActive && this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      decibels = Math.min(100, Math.round((rms / 128) * 100));
    }

    this.currentDecibels = decibels;

    // HUD Update
    const fill = document.getElementById('audio-fill');
    const dbNum = document.getElementById('db-display');
    const status = document.getElementById('audio-status');
    const menuFill = document.getElementById('menu-mic-fill');

    if (fill) fill.style.width = `${Math.max(4, decibels)}%`;
    if (dbNum) dbNum.textContent = `${decibels} dB`;
    if (menuFill) menuFill.style.width = `${decibels}%`;

    // Alert thresholds
    if (decibels >= this.micThreshold) {
      if (status) {
        status.textContent = 'Too loud';
        status.dataset.level = 'danger';
      }
      this.alertEntity(this.camera.position, decibels > 55 ? 'hunt' : 'investigate');
    } else if (decibels > this.micThreshold * 0.5) {
      if (status) {
        status.textContent = 'Breathing audible';
        status.dataset.level = 'caution';
      }
    } else {
      if (status) {
        status.textContent = 'Quiet';
        status.dataset.level = 'safe';
      }
    }
  }

  // ------------------------------------------------------------------------
  // 7. Procedural Web Audio Engine
  // ------------------------------------------------------------------------
  playProceduralSound(type) {
    if (!this.synthCtx) {
      this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.synthCtx.state === 'suspended') this.synthCtx.resume();

    const t = this.synthCtx.currentTime;

    if (type === 'footstep') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'door') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.linearRampToValueAtTime(110, t + 0.35);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (type === 'click') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } else if (type === 'pickup' || type === 'relic') {
      const osc = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(type === 'relic' ? 680 : 550, t + 0.6);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    } else if (type === 'growl' || type === 'roar' || type === 'jumpscare') {
      const osc1 = this.synthCtx.createOscillator();
      const osc2 = this.synthCtx.createOscillator();
      const gain = this.synthCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      const startFreq = (type === 'jumpscare') ? 950 : 220;
      const endFreq = (type === 'jumpscare') ? 140 : 65;

      osc1.frequency.setValueAtTime(startFreq, t);
      osc1.frequency.exponentialRampToValueAtTime(endFreq, t + 0.9);
      osc2.frequency.setValueAtTime(startFreq + 40, t);
      osc2.frequency.exponentialRampToValueAtTime(endFreq - 20, t + 0.9);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.synthCtx.destination);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 1.0);
      osc2.stop(t + 1.0);
    }
  }

  startAmbientDrone() {
    if (!this.synthCtx) {
      this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.synthCtx.state === 'suspended') this.synthCtx.resume();

    const osc = this.synthCtx.createOscillator();
    const filter = this.synthCtx.createBiquadFilter();
    const gain = this.synthCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, this.synthCtx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, this.synthCtx.currentTime);
    gain.gain.setValueAtTime(0.12, this.synthCtx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthCtx.destination);
    osc.start();
  }

  // ------------------------------------------------------------------------
  // 8. Game Loop & States
  // ------------------------------------------------------------------------
  initHUD() {
    const btnPlay = document.getElementById('btn-play-game');
    const startModal = document.getElementById('start-menu');
    const btnRetry = document.getElementById('btn-retry');
    const btnPlayAgain = document.getElementById('btn-play-again');

    btnPlay.addEventListener('click', () => {
      startModal.style.display = 'none';
      this.isPlaying = true;
      this.startTime = performance.now();
      this.startAmbientDrone();
      this.container.requestPointerLock();
    });

    btnRetry.addEventListener('click', () => {
      location.reload();
    });

    btnPlayAgain.addEventListener('click', () => {
      location.reload();
    });

    setInterval(() => {
      const bpmEl = document.getElementById('hud-bpm');
      if (bpmEl) {
        const isHunting = (this.entityState === 'HUNT');
        const base = isHunting ? 152 : 94;
        const jitter = Math.floor(Math.random() * 8) - 4;
        bpmEl.textContent = `${base + jitter} bpm`;
      }
    }, 1100);
  }

  formatElapsed() {
    const s = Math.round((performance.now() - (this.startTime || performance.now())) / 1000);
    return `m ${String(s % 60).padStart(2, '0')}s`;
  }

  triggerDeath() {
    this.isDead = true;
    document.getElementById('death-stats').textContent = `Time survived  ${this.formatElapsed()}`;
    this.playProceduralSound('jumpscare');

    const scareOverlay = document.getElementById('jumpscare-overlay');
    scareOverlay.style.display = 'block';

    setTimeout(() => {
      scareOverlay.style.display = 'none';
      document.exitPointerLock();
      document.getElementById('game-over-modal').style.display = 'flex';
    }, 1200);
  }

  triggerVictory() {
    this.hasWon = true;
    document.getElementById('win-stats').textContent = `Escape time  ${this.formatElapsed()}`;
    document.exitPointerLock();
    document.getElementById('victory-modal').style.display = 'flex';
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;

    if (this.isPlaying && !this.isDead && !this.hasWon) {
      this.updateMovement(delta);
      this.checkRaycastInteractions();
      this.updateEntity(delta);
      this.updateMicrophoneTracking();
    }

    this.updateAtmosphere(delta, time);
    this.renderer.render(this.scene, this.camera);
  }

  // Candle flicker, drifting particles and small prop animation
  updateAtmosphere(delta, time) {
    for (const f of this.flicker) {
      if (f.room !== this.currentRoom) continue;
      const n = 0.5 * Math.sin(time * f.speed + f.phase) + 0.3 * Math.sin(time * f.speed * 2.7 + f.phase * 1.3) + (Math.random() - 0.5) * 0.3;
      f.light.intensity = f.base * (1 + f.amp * n);
    }

    // The flashlight stutters while something is hunting you
    if (this.isFlashlightOn && this.flashlight) {
      const hunted = this.entityState === 'HUNT' && Math.random() < 0.04;
      this.flashlight.intensity = hunted ? this.flashlightBase * 0.25 : this.flashlightBase;
    }

    // Dust follows the player
    if (this.dustParticles) {
      this.dustParticles.position.set(this.camera.position.x, 0, this.camera.position.z);
      const pos = this.dustParticles.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] += delta * 0.03;
        pos[i] += Math.sin(time * 0.3 + i) * delta * 0.02;
        if (pos[i + 1] > 3) pos[i + 1] = 0;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (this.currentRoom === 'parlor' && this.fireEmbers) {
      const pos = this.fireEmbers.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += delta * (0.5 + (i % 5) * 0.12);
        if (pos[i] > 1.8) pos[i] = 0.1;
      }
      this.fireEmbers.geometry.attributes.position.needsUpdate = true;
      (this.fireFlames || []).forEach((f, i) => {
        f.scale.y = 0.85 + 0.3 * Math.sin(time * 9 + i * 2) + Math.random() * 0.1;
        f.scale.x = f.scale.z = 0.9 + 0.15 * Math.sin(time * 7 + i);
      });
    }

    if (this.currentRoom === 'crypt' && this.greenSmoke) {
      const pos = this.greenSmoke.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += delta * 0.18;
        if (pos[i] > 1.6) pos[i] = 0;
      }
      this.greenSmoke.geometry.attributes.position.needsUpdate = true;
    }

    if (this.silverKeyMesh && this.silverKeyMesh.visible) {
      this.silverKeyMesh.rotation.y += delta * 1.4;
      this.silverKeyMesh.position.y = 1.32 + Math.sin(time * 2) * 0.03;
    }
    if (this.relicMesh && this.relicMesh.visible) {
      this.relicMesh.rotation.y += delta * 0.8;
      this.relicMesh.position.y = 1.4 + Math.sin(time * 1.6) * 0.04;
    }
  }
}

// Start Game on load
window.addEventListener('load', () => {
  window.__game = new HorrorGame();
});
