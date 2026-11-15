'use strict';
// ==========================================================================
// ROOMS: furniture and structure for each room. (World.prototype mixin)
// Item spots and hiding places are added separately from the registry.
// ==========================================================================
Object.assign(World.prototype, {
  // shorthand: coloured box, optional collider
  bx(room, color, w, h, d, x, y, z, collide, o, rough, metal) {
    return this.addBox(room, this.mat(color, rough === undefined ? 0.75 : rough, metal || 0), w, h, d, x, y, z, collide, o);
  },

  build_corridor(room) {
    const wood = this.mat(0x1c120b, 0.8);
    const rug = this.lab.repeat(this.lab.rug('red', '#3a1212'), 'corridor.rug', 1, 8);
    this.addMesh(room, Cache.geo('plane:1.3x22', () => new THREE.PlaneGeometry(1.3, 22)), this.texMat(rug, 1), 0, 0.012, 0, { rx: -Math.PI / 2, cast: false });
    for (let z = -10; z <= 10; z += 4) this.addBox(room, wood, 4, 0.22, 0.28, 0, room.H - 0.1, z, false, { cast: false });
    // stone arch around the crypt gate
    this.bx(room, 0x23262a, 0.4, 2.9, 0.34, -1.0, 1.45, -11.82); this.bx(room, 0x23262a, 0.4, 2.9, 0.34, 1.0, 1.45, -11.82); this.bx(room, 0x23262a, 2.4, 0.5, 0.34, 0, 3.0, -11.82);
    this.addSconce(room, -1.95, 2.0, 8, 'W'); this.addSconce(room, 1.95, 2.0, 2, 'E'); this.addSconce(room, -1.95, 2.0, -6, 'W'); this.addSconce(room, 1.95, 2.0, -9.5, 'E');
    this.addPainting(room, -1.93, 1.9, 1, Math.PI / 2, 0.7, 0.9, 0); this.addPainting(room, 1.93, 1.9, -6, -Math.PI / 2, 0.7, 0.9, 1); this.addPainting(room, 1.93, 1.9, 9, -Math.PI / 2, 0.6, 0.8, 2);
    this.makePumpkin(room, 1.45, 9.4, -0.5, 0, true); this.makePumpkin(room, -1.4, 3.5, 0.4, 1, true);
    room.lightLevel = 0.3;
  },

  build_parlor(room) {
    const stone = this.mat(0x2b2623, 0.95), dark = this.mat(0x24160d, 0.6, 0.1), fabric = this.mat(0x4a1a1a, 0.95);
    // fireplace
    this.addBox(room, stone, 0.6, 2.4, 0.6, -1.4, 1.2, -5.7, true); this.addBox(room, stone, 0.6, 2.4, 0.6, 1.4, 1.2, -5.7, true);
    this.addBox(room, stone, 3.4, 0.5, 0.6, 0, 2.15, -5.7); this.addBox(room, dark, 3.8, 0.12, 0.8, 0, 2.45, -5.65);
    this.addMesh(room, Cache.geo('plane:2.2x1.9', () => new THREE.PlaneGeometry(2.2, 1.9)), new THREE.MeshBasicMaterial({ color: 0x050302 }), 0, 0.95, -5.93, { cast: false });
    const log = this.mat(0x1a0f08, 0.9, 0, { emissive: 0x551a00, emissiveIntensity: 0.6 });
    this.addMesh(room, Cache.geo('cyl.log', () => new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8)), log, 0, 0.12, -5.55, { rz: Math.PI / 2 });
    this.addMesh(room, Cache.geo('cyl.log2', () => new THREE.CylinderGeometry(0.09, 0.09, 1.0, 8)), log, 0, 0.3, -5.5, { rz: Math.PI / 2 + 0.3 });
    const flames = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(Cache.geo('flame' + i, () => new THREE.ConeGeometry(0.16 - i * 0.02, 0.7 + i * 0.1, 8)), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb347 : 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false }));
      f.position.set(-0.35 + i * 0.24, 0.5, -5.55); room.group.add(f); flames.push(f);
    }
    room.updaters.push((dt, t) => flames.forEach((f, i) => { f.scale.y = 0.85 + 0.3 * Math.sin(t * 9 + i * 2) + Math.random() * 0.1; f.scale.x = f.scale.z = 0.9 + 0.15 * Math.sin(t * 7 + i); }));
    this.addLight(room, 0xff6a1a, 3.0, 14, 0, 0.9, -4.9, { amp: 0.35, speed: 11 });
    room.lightLevel = 0.6;
    // rug and seating
    const rt = this.lab.repeat(this.lab.rug('parlor', '#4a1a1a'), 'parlor.rug', 1, 1);
    room.rugMesh = this.addMesh(room, Cache.geo('plane:4.4x3.2', () => new THREE.PlaneGeometry(4.4, 3.2)), this.texMat(rt, 1), 0, 0.012, -1.6, { rx: -Math.PI / 2, cast: false });
    this.addBox(room, fabric, 2.2, 0.45, 0.9, 0, 0.3, 0.3, true); this.addBox(room, fabric, 2.2, 0.75, 0.22, 0, 0.62, 0.82); this.addBox(room, fabric, 0.22, 0.6, 0.9, -1.1, 0.45, 0.3); this.addBox(room, fabric, 0.22, 0.6, 0.9, 1.1, 0.45, 0.3);
    this.addBox(room, dark, 1.1, 0.06, 0.6, 0, 0.45, -1.7, true); this.addBox(room, dark, 0.08, 0.42, 0.08, -0.5, 0.21, -1.5); this.addBox(room, dark, 0.08, 0.42, 0.08, 0.5, 0.21, -1.5);
    this.addBox(room, fabric, 0.9, 0.5, 0.9, -2.6, 0.28, -2.2, true, { ry: 0.5 }); this.addBox(room, fabric, 0.9, 0.5, 0.9, 2.6, 0.28, -2.2, true, { ry: -0.5 });
    // bookcase on the west wall
    this.addBox(room, dark, 0.5, 2.6, 3.2, -4.72, 1.3, -1.8, true);
    this.addBooks(room, -4.5, -3.3, -0.3, 0.35, 4);
    this.addPainting(room, 4.93, 1.9, -1, -Math.PI / 2, 0.9, 1.2, 1); this.addPainting(room, -2.8, 2.0, -5.94, 0, 0.6, 0.8, 2);
    this.addSconce(room, 4.9, 2.2, 0.5, 'E'); this.addSconce(room, -4.9, 2.2, 4.8, 'W');
    this.addSkeleton(room, 2.6, -2.2, 0.5);
  },

  build_bedroom(room) {
    const dark = this.mat(0x1e140d, 0.6, 0.1), linen = this.mat(0x8d8f98, 0.95);
    // bed with legs so you can hide beneath it
    [[-4.0, -5.0], [-2.4, -5.0], [-4.0, -3.0], [-2.4, -3.0]].forEach(p => this.addBox(room, dark, 0.1, 0.5, 0.1, p[0], 0.25, p[1]));
    this.addBox(room, dark, 1.8, 0.1, 2.3, -3.2, 0.52, -4.0, false); this.addBox(room, linen, 1.7, 0.16, 2.1, -3.2, 0.64, -3.95);
    room.mattressMesh = this.addBox(room, this.mat(0x2a2f40, 0.95), 1.72, 0.1, 1.3, -3.2, 0.77, -3.5, false);
    this.addBox(room, linen, 0.8, 0.14, 0.4, -3.2, 0.78, -4.8); this.addBox(room, dark, 1.9, 1.3, 0.12, -3.2, 0.85, -5.1);
    room.colliders.push([-4.15, -2.25, -5.15, -2.85]);
    // vanity with a cracked mirror
    this.addBox(room, dark, 0.8, 1.0, 1.6, 4.5, 0.5, -4.5, true);
    this.addMirror(room, 4.97, 1.8, -4.5, -Math.PI / 2, 0.9, 1.3);
    // window, moonlight, crows
    this.addWindow(room, 0, 1.9, -5.97, 0, 1.6, 1.8);
    const moon = new THREE.SpotLight(0x8ea8e8, 3.2, 16, 0.75, 0.8, 1.2); moon.position.set(0, 2.4, -6); moon.target.position.set(0.5, 0, -1.5);
    room.group.add(moon, moon.target); room.lights.push(moon);
    this.addCrows(room, 0.4, 1.0, -5.9);
    this.addCandleCluster(room, -1.5, 0.65, -5.6);
    this.bx(room, 0x1e140d, 0.55, 0.65, 0.5, -1.5, 0.325, -5.6, true);
    const rt = this.lab.repeat(this.lab.rug('bed', '#2a2f40'), 'bed.rug', 1, 1);
    this.addMesh(room, Cache.geo('plane:3.4x2.4', () => new THREE.PlaneGeometry(3.4, 2.4)), this.texMat(rt, 1), -0.6, 0.012, -1.0, { rx: -Math.PI / 2, cast: false });
    this.addPainting(room, -4.93, 1.9, -2.2, Math.PI / 2, 0.8, 1.0, 0);
    this.addHangingBats(room, 2.5, room.H - 0.1, 1.5);
    room.lightLevel = 0.25;
  },

  // rows of small books standing on shelves along a wall (x fixed, z range)
  addBooks(room, x, z0, z1, depth, rows) {
    const cols = [0x5a1a1a, 0x1d2f45, 0x2f4a2a, 0x4a3a1a, 0x2a1a3a, 0x3a1a1a];
    for (let r = 0; r < rows; r++) {
      let z = z0 + 0.05;
      while (z < z1 - 0.1) {
        const bw = 0.05 + Math.random() * 0.06, bh = 0.28 + Math.random() * 0.2;
        const m = this.addMesh(room, Cache.geo('book:' + bw.toFixed(2) + ':' + bh.toFixed(2), () => new THREE.BoxGeometry(depth, bh, bw)), this.mat(cols[Math.floor(Math.random() * cols.length)], 0.85), x, 0.4 + r * 0.6 + bh / 2, z + bw / 2, { cast: false });
        if (Math.random() < 0.05) m.rotation.z = 0.22;
        z += bw + 0.012;
      }
    }
  }
});

Object.assign(World.prototype, {
  build_kitchen(room) {
    const wood = this.mat(0x2a1c12, 0.7), steel = this.mat(0x30343a, 0.4, 0.7), white = this.mat(0x6a6a62, 0.6);
    this.addBox(room, wood, 3.2, 0.9, 0.8, -3.0, 0.45, -5.6, true); this.addBox(room, white, 3.3, 0.05, 0.9, -3.0, 0.92, -5.6);
    this.addBox(room, steel, 0.9, 0.12, 0.5, -3.0, 0.9, -5.6);
    this.addBox(room, steel, 1.2, 0.05, 0.9, 3.0, 0.95, -5.5);            // stove top (oven is a spot)
    this.addBox(room, steel, 0.3, 2.2, 0.3, 3.0, 2.1, -5.8);                // flue
    this.addBox(room, wood, 2.0, 0.8, 1.0, 0.5, 0.4, -1.0, true); this.addBox(room, this.mat(0x4a3220, 0.8), 2.2, 0.06, 1.2, 0.5, 0.8, -1.0);
    [[-0.9, -2.1], [1.9, -2.1], [-0.9, 0.1], [1.9, 0.1]].forEach(p => this.addBox(room, wood, 0.45, 0.5, 0.45, p[0], 0.25, p[1], false, { ry: Math.random() }));
    // hanging pots
    for (let i = 0; i < 4; i++) { const pot = this.addMesh(room, Cache.geo('pot', () => new THREE.CylinderGeometry(0.14, 0.1, 0.16, 10)), steel, -4.2 + i * 0.5, 2.3, -5.9); pot.rotation.x = 0.2; }
    this.addLight(room, 0xffb060, 1.6, 10, 0.5, 2.6, -1.0, { amp: 0.25, speed: 6 });
    this.addSconce(room, -4.9, 2.2, 0.5, 'W');
    // dripping tap
    const drip = new THREE.Mesh(Cache.geo('drip', () => new THREE.SphereGeometry(0.02, 6, 6)), new THREE.MeshBasicMaterial({ color: 0x8ab0d0 }));
    drip.position.set(4.55, 1.2, 1.8); room.group.add(drip);
    let dt0 = 0;
    room.updaters.push((dt) => { dt0 += dt; drip.position.y = 1.2 - (dt0 % 1.6) * (dt0 % 1.6) * 0.45; drip.visible = (dt0 % 1.6) < 1.2; if (dt0 > 1.6 && dt0 - dt < 1.6) {} });
    this.addPainting(room, -2.0, 2.0, -5.94, 0, 0.6, 0.45, 0);
    room.lightLevel = 0.35;
  },

  build_library(room) {
    const dark = this.mat(0x24160d, 0.6, 0.1);
    this.addBox(room, dark, 0.5, 3.2, 10.6, -4.75, 1.6, -0.3, true);
    this.addBooks(room, -4.5, -5.5, 4.6, 0.38, 5);
    this.addBox(room, dark, 0.04, 0.04, 0.04, -4.5, 3.2, 0, false);
    // desk lamp and chair
    this.addBox(room, dark, 0.5, 0.5, 0.5, -2.2, 0.25, -3.9, false, { ry: 0.3 });
    this.addLight(room, 0xffc070, 1.8, 9, -1.2, 1.3, -4.7, { amp: 0.2, speed: 5 });
    this.addMesh(room, Cache.geo('lamp', () => new THREE.CylinderGeometry(0.1, 0.16, 0.2, 10)), new THREE.MeshBasicMaterial({ color: 0xffd890 }), -1.0, 0.9, -5.2);
    // reading chair, globe
    this.addBox(room, this.mat(0x3a1a1a, 0.95), 0.9, 0.9, 0.9, -2.8, 0.45, 2.6, true, { ry: 0.6 });
    this.addMesh(room, Cache.geo('globe', () => new THREE.SphereGeometry(0.28, 14, 12)), this.mat(0x2a4a5a, 0.5), 1.6, 1.0, -5.0);
    this.addBox(room, dark, 0.1, 1.0, 0.1, 1.6, 0.5, -5.0, true);
    // ouija table with a planchette that drifts
    this.addBox(room, dark, 0.9, 0.7, 0.9, -1.2, 0.35, 1.2, true);
    const board = this.addMesh(room, Cache.geo('plane:.8x.8', () => new THREE.PlaneGeometry(0.8, 0.8)), this.texMat(this.lab.ouija(), 0.8), -1.2, 0.705, 1.2, { rx: -Math.PI / 2, cast: false });
    const plan = this.addMesh(room, Cache.geo('plan', () => new THREE.CylinderGeometry(0.06, 0.07, 0.015, 3)), this.mat(0x1a1008, 0.6), -1.2, 0.715, 1.25);
    room.updaters.push((dt, t) => { plan.position.x = -1.2 + Math.sin(t * 0.6) * 0.14; plan.position.z = 1.2 + Math.cos(t * 0.45) * 0.1; plan.rotation.y = t * 0.3; });
    this.addCandleCluster(room, -1.2, 0.71, 1.0);
    this.addPainting(room, 2.0, 2.2, -5.94, 0, 0.8, 1.0, 2); this.addPainting(room, 4.93, 2.2, 0.0, -Math.PI / 2, 0.7, 0.9, 1);
    this.addSkullShelf(room, -4.4, 2.4, 3.8);
    this.addHangingBats(room, 0, room.H - 0.1, -1.0);
    room.lightLevel = 0.3;
  },

  build_nursery(room) {
    const pale = this.mat(0x8a8090, 0.9), wood = this.mat(0x4a3a2a, 0.8);
    this.addBox(room, wood, 1.0, 0.04, 1.0, 0, 0.02, -3.0, false);
    const rt = this.lab.repeat(this.lab.rug('nursery', '#3a3048'), 'nursery.rug', 1, 1);
    this.addMesh(room, Cache.geo('plane:2.6x2.2', () => new THREE.PlaneGeometry(2.6, 2.2)), this.texMat(rt, 1), 0, 0.012, 0, { rx: -Math.PI / 2, cast: false });
    // rocking chair that rocks by itself and creaks
    const chair = new THREE.Group(); chair.position.set(1.6, 0, 0.4); room.group.add(chair);
    const cb = (w, h, d, x, y, z) => { const m = new THREE.Mesh(Cache.geo('box:' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), wood); m.position.set(x, y, z); m.castShadow = true; chair.add(m); };
    cb(0.5, 0.06, 0.5, 0, 0.42, 0); cb(0.5, 0.7, 0.05, 0, 0.8, -0.24); cb(0.05, 0.4, 0.05, -0.22, 0.2, 0.2); cb(0.05, 0.4, 0.05, 0.22, 0.2, 0.2);
    cb(0.05, 0.05, 0.7, -0.24, 0.04, 0); cb(0.05, 0.05, 0.7, 0.24, 0.04, 0);
    room.rocker = chair; room.rockT = 0;
    room.updaters.push((dt, t) => { chair.rotation.x = Math.sin(t * 1.6) * 0.1 * (0.6 + 0.4 * Math.sin(t * 0.2)); });
    room.colliders.push([1.2, 2.0, 0.0, 0.8]);
    // mobile over the crib
    const mob = new THREE.Group(); mob.position.set(-2.6, 2.3, -3.9); room.group.add(mob);
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(Cache.geo('mob', () => new THREE.SphereGeometry(0.06, 8, 6)), pale); s.position.set(Math.cos(i * 1.57) * 0.3, -0.25 - (i % 2) * 0.1, Math.sin(i * 1.57) * 0.3); mob.add(s); }
    room.updaters.push((dt) => { mob.rotation.y += dt * 0.5; });
    this.addLight(room, 0xb090ff, 1.3, 8, 0, 1.4, 3.5, { amp: 0.15, speed: 3 });
    this.addBox(room, wood, 0.5, 0.6, 0.5, 0.3, 0.3, 3.9, true);
    this.addMesh(room, Cache.geo('lampn', () => new THREE.SphereGeometry(0.12, 10, 8)), new THREE.MeshBasicMaterial({ color: 0xc0a0ff }), 0.3, 0.72, 3.9);
    this.addPainting(room, -3.93, 1.7, -3.2, Math.PI / 2, 0.6, 0.8, 1);
    this.addPaperGhosts(room);
    room.lightLevel = 0.35;
  },

  build_cellar(room) {
    const wood = this.mat(0x2a1c12, 0.8), iron = this.mat(0x1c1c20, 0.5, 0.8);
    // pipes along the ceiling, crates and barrels as dressing
    this.addMesh(room, Cache.geo('pipe', () => new THREE.CylinderGeometry(0.08, 0.08, 10, 8)), iron, 0, room.H - 0.3, -3.5, { rz: Math.PI / 2 });
    this.addMesh(room, Cache.geo('pipe', () => new THREE.CylinderGeometry(0.08, 0.08, 10, 8)), iron, 0, room.H - 0.3, 3.5, { rz: Math.PI / 2 });
    [[2.2, 3.8], [3.4, 4.0], [-1.0, 4.2]].forEach((p, i) => this.addBox(room, wood, 0.8, 0.7, 0.8, p[0], 0.35, p[1], true, { ry: i * 0.4 }));
    this.addBox(room, wood, 0.8, 1.4, 0.8, 2.8, 1.05, 3.8, false, { ry: 0.2 });
    // fuse box on the north wall
    const fb = this.addBox(room, this.mat(0x2a3028, 0.6, 0.6), 0.7, 0.9, 0.2, 0, 1.6, -4.88, false);
    const door = this.addBox(room, this.mat(0x3a4038, 0.6, 0.6), 0.6, 0.8, 0.04, 0, 1.6, -4.76, false);
    room.fuseBox = { mesh: door, powered: false, lamp: null };
    this.addLight(room, 0xfff0c0, 1.0, 9, 0, 2.5, 0, { amp: 0.6, speed: 17 });
    this.addPaperGhosts(room);
    room.lightLevel = 0.1;
  },

  build_crypt(room) {
    const st = this.mat(0x32363a, 0.95);
    // altar on a stepped base (the relic spot rests on top)
    this.addBox(room, st, 2.8, 0.2, 1.6, 0, 0.1, -5.6, true); this.addBox(room, st, 2.0, 0.8, 1.0, 0, 0.6, -5.6); this.addBox(room, this.mat(0x3d4044, 0.9), 2.2, 0.12, 1.2, 0, 1.06, -5.6);
    [[-3, -1], [3, -1], [-3, -4.5], [3, -4.5]].forEach(p => {
      this.addMesh(room, Cache.geo('pillar', () => new THREE.CylinderGeometry(0.34, 0.4, 3.8, 10)), st, p[0], 1.9, p[1]);
      this.addBox(room, st, 0.9, 0.2, 0.9, p[0], 0.1, p[1], true); this.addBox(room, st, 0.9, 0.2, 0.9, p[0], 3.7, p[1], false, { cast: false });
    });
    this.addLight(room, 0x2bff7a, 1.3, 9, 0, 0.5, -2, { amp: 0.2, speed: 3 });
    this.addSconce(room, -4.9, 2.2, -2.5, 'W'); this.addSconce(room, 4.9, 2.2, 0.5, 'E');
    const smokePos = new Float32Array(90 * 3);
    for (let i = 0; i < smokePos.length; i += 3) { smokePos[i] = (Math.random() - 0.5) * 8; smokePos[i + 1] = Math.random() * 1.6; smokePos[i + 2] = -2 + (Math.random() - 0.5) * 9; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smoke = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x5dff9a, size: 0.09, transparent: true, opacity: 0.35, depthWrite: false }));
    smoke.frustumCulled = false; room.group.add(smoke);
    room.updaters.push((dt) => { const p = geo.attributes.position.array; for (let i = 1; i < p.length; i += 3) { p[i] += dt * 0.18; if (p[i] > 1.6) p[i] = 0; } geo.attributes.position.needsUpdate = true; });
    this.addSkullShelf(room, 4.6, 2.3, -3.6);
    this.addCobwebCorners(room, 2);
    room.lightLevel = 0.1;
  }
});
