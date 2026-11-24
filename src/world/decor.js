'use strict';
// ==========================================================================
// DECOR: Halloween set dressing built from primitives and canvas textures.
// Most pieces animate through room.updaters (only run for the visible room).
// ==========================================================================
Object.assign(World.prototype, {
  addSconce(room, x, y, z, side) {
    const dir = side === 'W' ? 1 : -1, g = new THREE.Group(); g.position.set(x, y, z); room.group.add(g);
    const br = new THREE.Mesh(Cache.geo('box:.16,.22,.1', () => new THREE.BoxGeometry(0.16, 0.22, 0.1)), this.mat(0x111111, 0.4, 0.8)); br.position.x = -dir * 0.05; g.add(br);
    const fl = new THREE.Mesh(Cache.geo('flame.s', () => new THREE.ConeGeometry(0.05, 0.16, 8)), new THREE.MeshBasicMaterial({ color: 0xffb060 })); fl.position.set(dir * 0.1, 0.18, 0); g.add(fl);
    this.addLight(room, 0xff9040, 1.1, 8, x + dir * 0.35, y + 0.2, z, { amp: 0.35, speed: 7 });
  },

  addPainting(room, x, y, z, ry, w, h, variant) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; room.group.add(g);
    const tilt = (Math.random() - 0.5) * 0.12; g.rotation.z = tilt;
    const frame = new THREE.Mesh(Cache.geo('box:' + (w + 0.1) + ',' + (h + 0.1) + ',.06', () => new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.06)), this.mat(0x2a1c10, 0.5, 0.4)); frame.castShadow = true; g.add(frame);
    const art = new THREE.Mesh(Cache.geo('plane.art' + w + h, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshStandardMaterial({ map: this.lab.portrait(variant % 3), roughness: 0.8 })); art.position.z = 0.035; g.add(art);
    // eyes that follow the player
    const eyeMat = Cache.mat('eye.w', () => new THREE.MeshBasicMaterial({ color: 0xe8e4d0 })), pupMat = Cache.mat('eye.p', () => new THREE.MeshBasicMaterial({ color: 0x050303 }));
    const eg = Cache.geo('eye.g', () => new THREE.CircleGeometry(0.03, 10)), pg = Cache.geo('pup.g', () => new THREE.CircleGeometry(0.015, 8));
    const pupils = [];
    [-0.055, 0.055].forEach(dx => {
      const e = new THREE.Mesh(eg, eyeMat); e.position.set(dx * w / 0.7, h * 0.12, 0.045); e.scale.setScalar(w / 0.7); g.add(e);
      const p = new THREE.Mesh(pg, pupMat); p.position.set(0, 0, 0.002); e.add(p); pupils.push(p);
    });
    const cam = this.game.camera, ph = Math.random() * 6;
    room.updaters.push((dt, t) => {
      g.rotation.z = tilt + Math.sin(t * 0.25 + ph) * 0.012;
      g.worldToLocal(TMP.v4.copy(cam.position));
      const k = clamp(TMP.v4.length(), 0.5, 6), ox = clamp(TMP.v4.x / k, -1, 1) * 0.014, oy = clamp((TMP.v4.y - h * 0.12) / k, -1, 1) * 0.012;
      pupils.forEach(p => p.position.set(ox, oy, 0.002));
    });
    return g;
  },

  // Jack-o'-lantern. variant picks one of four carved faces.
  makePumpkin(room, x, z, ry, variant, withLight) {
    const g = new THREE.Group(); g.position.set(x, 0.3, z); g.rotation.y = ry; room.group.add(g);
    const body = new THREE.Mesh(Cache.geo('pumpkin', () => new THREE.SphereGeometry(0.34, 18, 14)), this.mat(0x5c3410, 0.85, 0, { emissive: 0x2a0c00, emissiveIntensity: 0.6 }));
    body.scale.set(1.15, 0.7, 1.1); body.rotation.z = 0.15; body.castShadow = true; g.add(body);
    const stem = new THREE.Mesh(Cache.geo('pstem', () => new THREE.CylinderGeometry(0.035, 0.05, 0.14, 6)), this.mat(0x2c3a14, 0.9)); stem.position.y = 0.28; g.add(stem);
    const faceMat = new THREE.MeshBasicMaterial({ map: this.lab.faces(variant % 4), transparent: true, depthWrite: false, color: 0x8a5020 });
    const face = new THREE.Mesh(Cache.geo('pface', () => new THREE.PlaneGeometry(0.52, 0.52)), faceMat); face.position.z = 0.365; g.add(face);
    const p = { group: g, body, faceMat, light: null };
    if (withLight) {
      p.light = this.addLight(room, 0xff6a10, 0.7, 5, x, 0.55, z, { amp: 0.5, speed: 9 });
      p.baseColor = 0xff7a18; (room.pumpkins = room.pumpkins || []).push(p);
      room.colliders.push([x - 0.35, x + 0.35, z - 0.35, z + 0.35]);
    }
    return p;
  },

  addCandleCluster(room, x, y, z) {
    const wax = this.mat(0xe8dfc8, 0.7), flameGeo = Cache.geo('cflame', () => new THREE.ConeGeometry(0.018, 0.06, 6)), fm = new THREE.MeshBasicMaterial({ color: 0xffd080 });
    [[0, 0, 0.18], [0.1, 0.05, 0.12], [-0.08, 0.07, 0.22]].forEach(c => {
      const h = c[2], cd = new THREE.Mesh(Cache.geo('candle' + h, () => new THREE.CylinderGeometry(0.03, 0.035, h, 8)), wax); cd.position.set(x + c[0], y + h / 2, z + c[1]); room.group.add(cd);
      const f = new THREE.Mesh(flameGeo, fm); f.position.set(x + c[0], y + h + 0.04, z + c[1]); room.group.add(f);
      const drip = new THREE.Mesh(Cache.geo('drip.w', () => new THREE.ConeGeometry(0.008, 0.07, 5)), wax); drip.position.set(x + c[0] + 0.03, y + h - 0.04, z + c[1]); drip.rotation.x = Math.PI; room.group.add(drip);
    });
    this.addLight(room, 0xffa850, 1.0, 6, x, y + 0.4, z, { amp: 0.4, speed: 8 });
  },

  addSkeleton(room, x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0.5, z); g.rotation.y = ry; room.group.add(g);
    g.rotation.z = 0.22; g.rotation.x = -0.12;
    const bone = this.mat(0x8c8470, 0.85), M = (geo, px, py, pz, rx, rz) => { const m = new THREE.Mesh(geo, bone); m.position.set(px, py, pz); m.rotation.set(rx || 0, 0, rz || 0); m.castShadow = true; g.add(m); return m; };
    const cg = Cache.geo('bone.c', () => new THREE.CylinderGeometry(0.025, 0.02, 0.4, 6));
    M(Cache.geo('skull.d', () => new THREE.SphereGeometry(0.11, 12, 10)), 0, 0.88, 0);
    M(Cache.geo('bone.sp', () => new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6)), 0, 0.55, 0);
    for (let i = 0; i < 4; i++) M(Cache.geo('bone.rib', () => new THREE.TorusGeometry(0.12 - i * 0.012, 0.01, 4, 10)), 0, 0.72 - i * 0.07, 0.02, Math.PI / 2);
    M(cg, -0.25, 0.7, 0.05, 0, 0.5); M(cg, 0.25, 0.7, 0.05, 0, -0.5); M(cg, -0.12, 0.2, 0.25, Math.PI / 2 - 0.2); M(cg, 0.12, 0.2, 0.25, Math.PI / 2 - 0.2);
    const eye = new THREE.MeshBasicMaterial({ color: 0x000000 });
    [-0.04, 0.04].forEach(dx => { const e = new THREE.Mesh(Cache.geo('seye', () => new THREE.SphereGeometry(0.025, 6, 6)), eye); e.position.set(dx, 0.9, 0.09); g.add(e); });
    room.updaters.push((dt, t) => { g.children[0].rotation.y = Math.sin(t * 0.3) * 0.25; });
  },

  addSkullShelf(room, x, y, z) {
    const wall = Math.abs(x) > 3.5 ? (x < 0 ? 'W' : 'E') : 'N', g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = wall === 'W' ? Math.PI / 2 : wall === 'E' ? -Math.PI / 2 : 0; room.group.add(g);
    const sh = new THREE.Mesh(Cache.geo('box:1.4,.05,.3', () => new THREE.BoxGeometry(1.4, 0.05, 0.3)), this.mat(0x1c120b, 0.8)); g.add(sh);
    const bone = this.mat(0xd0c8aa, 0.7);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(Cache.geo('sksm', () => new THREE.SphereGeometry(0.07, 10, 8)), bone); s.position.set(-0.55 + i * 0.27, 0.09, 0); s.scale.set(1, 1.1, 1.1); s.castShadow = true; g.add(s);
      const j = new THREE.Mesh(Cache.geo('jawsm', () => new THREE.BoxGeometry(0.07, 0.03, 0.07)), bone); j.position.set(-0.55 + i * 0.27, 0.02, 0.02); g.add(j);
    }
  },

  addPaperGhosts(room) {
    const b = room.bounds, tex = Cache.tex('tex.pghost', () => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
      // a burlap doll hanging from a rope, button eyes, stitched mouth
      g.strokeStyle = '#2a2016'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 18); g.stroke();
      g.fillStyle = '#5a4a34'; g.beginPath(); g.arc(32, 28, 11, 0, 7); g.fill();
      g.beginPath(); g.moveTo(22, 38); g.lineTo(42, 38); g.lineTo(46, 76); g.lineTo(18, 76); g.fill();
      g.fillRect(12, 40, 8, 26); g.fillRect(44, 40, 8, 26); g.fillRect(22, 76, 7, 18); g.fillRect(35, 76, 7, 16);
      g.fillStyle = '#000'; g.beginPath(); g.arc(28, 26, 2.6, 0, 7); g.arc(36, 26, 2.6, 0, 7); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.moveTo(26, 33); g.lineTo(38, 33); for (let x = 27; x < 38; x += 3) { g.moveTo(x, 31); g.lineTo(x, 35); } g.stroke();
      g.fillStyle = 'rgba(90,8,8,0.8)'; g.fillRect(24, 50, 16, 6);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(Cache.geo('pghost', () => new THREE.PlaneGeometry(0.42, 0.62)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.1, color: 0xaaaaaa }));
      const x = b.minX + 1 + (i + 0.5) * (b.maxX - b.minX - 2) / 3, z = b.minZ + 1.5 + ((i * 2.3) % 1) * (b.maxZ - b.minZ - 3), y = room.H - 0.6;
      m.position.set(x, y, z); room.group.add(m);
      const ph = Math.random() * 6;
      room.updaters.push((dt, t) => { m.rotation.y = Math.sin(t * 0.7 + ph) * 0.8; m.rotation.z = Math.sin(t * 0.9 + ph) * 0.1; });
    }
  },

  addHangingBats(room, x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x08060a, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.position.set(x + i * 0.35, y, z + (i % 2) * 0.2); room.group.add(g);
      const body = new THREE.Mesh(Cache.geo('batbody', () => new THREE.ConeGeometry(0.05, 0.16, 6)), mat); body.rotation.x = Math.PI; body.position.y = -0.1; g.add(body);
      const wing = Cache.geo('batwing', () => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.22, -0.02, 0.06, 0.1, -0.16, 0]), 3)); gg.computeVertexNormals(); return gg; });
      const wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat); wr.scale.x = -1; wl.position.y = wr.position.y = -0.08; g.add(wl, wr);
      const ph = Math.random() * 6;
      room.updaters.push((dt, t) => { const f = Math.sin(t * 0.6 + ph) > 0.97 ? Math.sin(t * 40) * 0.5 : 0; wl.rotation.z = -0.4 + f; wr.rotation.z = 0.4 - f; g.rotation.z = Math.sin(t * 0.4 + ph) * 0.05; });
    }
  },

  addCrows(room, x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x030304 });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(); g.position.set(x + i * 0.45, y, z); g.scale.setScalar(0.8 + i * 0.2); room.group.add(g);
      const body = new THREE.Mesh(Cache.geo('crowb', () => new THREE.SphereGeometry(0.09, 8, 6)), mat); body.scale.set(1.5, 1, 0.8); g.add(body);
      const head = new THREE.Mesh(Cache.geo('crowh', () => new THREE.SphereGeometry(0.05, 8, 6)), mat); head.position.set(0.12, 0.08, 0); g.add(head);
      const beak = new THREE.Mesh(Cache.geo('crowk', () => new THREE.ConeGeometry(0.02, 0.07, 5)), mat); beak.rotation.z = -Math.PI / 2; beak.position.set(0.2, 0.08, 0); g.add(beak);
      const ph = i * 2;
      room.updaters.push((dt, t) => { head.rotation.z = Math.sin(t * 0.8 + ph) * 0.3; head.position.y = 0.08 + Math.max(0, Math.sin(t * 3 + ph * 2)) * 0.015; });
    }
  },

  addCobwebCorners(room, n) {
    const b = room.bounds, H = room.H, tex = this.lab.cobweb();
    const corners = [[b.minX, b.minZ, Math.PI / 2, 0, 1], [b.maxX, b.minZ, 0, -1, 0], [b.maxX, b.maxZ, -Math.PI / 2, 0, -1], [b.minX, b.maxZ, Math.PI, 1, 0]];
    for (let i = 0; i < n; i++) {
      const c = corners[(i * 2 + (room.id.length % 2)) % 4], size = 0.9 + Math.random() * 0.5;
      const m = new THREE.Mesh(Cache.geo('web' + size.toFixed(2), () => new THREE.PlaneGeometry(size, size)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 }));
      // lay the web against the north/south wall at this corner
      const onNS = i % 2 === 0, sx = c[0] === b.minX ? 1 : -1;
      if (onNS) { m.position.set(c[0] + sx * size / 2, H - size / 2, c[1] === b.minZ ? c[1] + 0.02 : c[1] - 0.02); m.scale.x = sx > 0 ? 1 : -1; }
      else { m.position.set(c[0] === b.minX ? c[0] + 0.02 : c[0] - 0.02, H - size / 2, c[1] + (c[1] === b.minZ ? 1 : -1) * size / 2); m.rotation.y = Math.PI / 2; m.scale.x = c[1] === b.minZ ? -1 : 1; }
      room.group.add(m);
    }
  },

  addDecal(room, kind, x, y, z, ry, size) {
    const m = new THREE.Mesh(Cache.geo('decal' + size, () => new THREE.PlaneGeometry(size, size)), new THREE.MeshBasicMaterial({ map: this.lab.blood(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.9, color: 0x884444 }));
    m.position.set(x, y, z); m.rotation.y = ry; room.group.add(m); return m;
  },

  // Abandoned for 47 years: dirt and debris on the floor, damp and torn paper on the walls,
  // boarded windows, writing on the walls, cobwebs hanging from the ceiling. Nothing here collides.
  addAbandonment(room) {
    const b = room.bounds, H = room.H, L = this.lab, rnd = (a, c) => a + Math.random() * (c - a);
    const nearDoor = (x, z, r) => room.doors.some(d => Math.hypot(d.bx - x, d.bz - z) < r);
    const flat = (tex, size, x, y, z, rx, ry, op, color) => {
      const m = new THREE.Mesh(Cache.geo('plane:' + size, () => new THREE.PlaneGeometry(size, size)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, opacity: op, color: color || 0xffffff }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); m.renderOrder = 1; room.group.add(m); return m;
    };
    // 1. dirt and damp patches on the floor
    for (let i = 0; i < 9; i++) { const m = flat(L.blot(), rnd(1.2, 2.6), rnd(b.minX + 0.6, b.maxX - 0.6), 0.012 + i * 0.001, rnd(b.minZ + 0.6, b.maxZ - 0.6), -Math.PI / 2, 0, 0.9); m.rotation.z = rnd(0, 6); }
    // 2. old letters, broken glass and splintered planks
    const scrapTex = L.scrap(), glass = new THREE.MeshBasicMaterial({ color: 0x9aa4a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) { const m = flat(scrapTex, 0.22, rnd(b.minX + 0.4, b.maxX - 0.4), 0.025 + i * 0.0005, rnd(b.minZ + 0.4, b.maxZ - 0.4), -Math.PI / 2, 0, 0.85); m.rotation.z = rnd(0, 6); }
    const plank = this.mat(0x2a2016, 0.95);
    for (let i = 0; i < 5; i++) {
      const x = rnd(b.minX + 0.5, b.maxX - 0.5), z = rnd(b.minZ + 0.5, b.maxZ - 0.5), l = rnd(0.5, 1.2);
      this.addMesh(room, Cache.geo('box:plank' + l.toFixed(1), () => new THREE.BoxGeometry(0.12, 0.025, +l.toFixed(1))), plank, x, 0.015, z, { ry: rnd(0, 3), rz: rnd(-0.08, 0.08) });
    }
    for (let i = 0; i < 8; i++) {
      const sh = this.addMesh(room, Cache.geo('shard', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.09, 0, 0.02, 0.03, 0, 0.11]), 3)); g.computeVertexNormals(); return g; }), glass, rnd(b.minX + 0.5, b.maxX - 0.5), 0.02, rnd(b.minZ + 0.5, b.maxZ - 0.5), { ry: rnd(0, 6), cast: false });
      sh.scale.setScalar(rnd(0.7, 1.6));
    }
    // 3. walls: damp blooms, hanging strips of wallpaper, writing
    const walls = [
      { ry: Math.PI / 2, at: (u, y) => [b.minX + 0.02, y, u], span: [b.minZ, b.maxZ] },
      { ry: -Math.PI / 2, at: (u, y) => [b.maxX - 0.02, y, u], span: [b.minZ, b.maxZ] },
      { ry: 0, at: (u, y) => [u, y, b.minZ + 0.02], span: [b.minX, b.maxX] },
      { ry: Math.PI, at: (u, y) => [u, y, b.maxZ - 0.02], span: [b.minX, b.maxX] }
    ];
    const stone = room.def.floor === 'stone';
    walls.forEach((w, wi) => {
      for (let i = 0; i < 2; i++) { const p = w.at(rnd(w.span[0] + 1, w.span[1] - 1), rnd(H * 0.55, H - 0.6)); flat(L.blot(), rnd(1.4, 2.4), p[0], p[1], p[2], 0, w.ry, 0.8, 0x6a6a50); }
      if (!stone) for (let i = 0; i < 2; i++) {
        const u = rnd(w.span[0] + 0.8, w.span[1] - 0.8), p = w.at(u, H - 0.05); if (nearDoor(p[0], p[2], 1.4)) continue;
        const len = rnd(0.5, 1.3), strip = new THREE.Mesh(Cache.geo('strip' + len.toFixed(1), () => { const g = new THREE.PlaneGeometry(0.4, +len.toFixed(1)); g.translate(0, -len.toFixed(1) / 2, 0); return g; }), this.mat(0x3a3428, 0.95, 0, { side: THREE.DoubleSide }));
        strip.position.set(p[0], p[1], p[2]); strip.rotation.set(0, w.ry, 0, 'YXZ'); room.group.add(strip);
        const ph = Math.random() * 6; room.updaters.push((dt, t) => { strip.rotation.x = 0.25 + Math.sin(t * 0.5 + ph) * 0.04; });
      }
    });
    const scrawls = { corridor: 'LET ME OUT', parlor: 'SHE HEARS|YOU', bedroom: 'MOTHER?', kitchen: 'DONT|BREATHE', library: 'THE DOOR|IS THIN', nursery: 'SHE IS|UNDER', cellar: 'HELP US', crypt: '1898' };
    if (scrawls[room.id]) {
      for (let tries = 0; tries < 12; tries++) {
        const w = walls[Math.floor(Math.random() * 4)], p = w.at(rnd(w.span[0] + 1.2, w.span[1] - 1.2), rnd(1.4, 2.1));
        if (nearDoor(p[0], p[2], 1.6)) continue;
        flat(L.scrawl(scrawls[room.id]), 1.3, p[0], p[1], p[2], 0, w.ry, 0.9); break;
      }
    }
    // 4. windows boarded over, light gets through the gaps
    const board = this.mat(0x241a10, 0.95);
    room.windows.forEach(win => {
      const g = new THREE.Group(); g.position.set(win.x, win.y, win.z); g.rotation.y = win.ry; room.group.add(g);
      [[0.5, 0.12], [0.05, -0.08], [-0.45, 0.18]].forEach(([y, rz]) => { const m = new THREE.Mesh(Cache.geo('box:board', () => new THREE.BoxGeometry(2.0, 0.2, 0.04)), board); m.position.set(0, y, 0.16); m.rotation.z = rz; m.castShadow = true; g.add(m); });
    });
    // 5. cobweb strands hanging from the ceiling
    const webMat = new THREE.MeshBasicMaterial({ map: L.cobweb(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.45 });
    for (let i = 0; i < 7; i++) {
      const x = rnd(b.minX + 0.5, b.maxX - 0.5), z = rnd(b.minZ + 0.5, b.maxZ - 0.5), s = rnd(0.5, 1.0);
      const m = new THREE.Mesh(Cache.geo('webhang' + s.toFixed(1), () => { const g = new THREE.PlaneGeometry(+s.toFixed(1), +s.toFixed(1) * 1.4); g.translate(0, -s.toFixed(1) * 0.7, 0); return g; }), webMat);
      m.position.set(x, H - 0.01, z); m.rotation.y = rnd(0, 6); room.group.add(m);
      const ph = Math.random() * 6; room.updaters.push((dt, t) => { m.rotation.x = Math.sin(t * 0.4 + ph) * 0.08; });
    }
  },

  // Role based dressing plus blood and handprints
  decorate(room) {
    const b = room.bounds, rnd = (a, c) => a + Math.random() * (c - a);
    this.addCobwebCorners(room, 4);
    this.addAbandonment(room);
    const n = room.role === 'trap' ? 4 : room.id === 'corridor' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const ry = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][i % 4], kind = i % 2 ? 'hand' : 'smear';
      const x = ry === Math.PI / 2 ? b.minX + 0.03 : ry === -Math.PI / 2 ? b.maxX - 0.03 : rnd(b.minX + 1.2, b.maxX - 1.2);
      const z = ry === 0 ? b.minZ + 0.03 : ry === Math.PI ? b.maxZ - 0.03 : rnd(b.minZ + 1.2, b.maxZ - 1.2);
      this.addDecal(room, kind, x, rnd(1.0, 1.7), z, ry, kind === 'hand' ? 0.45 : 0.8);
    }
    if (room.role === 'safe') {
      this.addCandleCluster(room, room.cx, 0.0, room.cz + 0.5);
      room.lightLevel = 0.85;
    }
    if (room.role === 'decoy') {
      const tex = Cache.tex('tex.circle', () => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = 'rgba(120,255,160,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 128, 90, 0, 7); g.stroke(); g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; g.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); } g.closePath(); g.stroke(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; });
      const m = new THREE.Mesh(Cache.geo('plane:2.2', () => new THREE.PlaneGeometry(2.2, 2.2)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
      m.rotation.x = -Math.PI / 2; m.position.set(room.cx, 0.02, room.cz + 0.8); room.group.add(m);
      this.addLight(room, 0x40ff90, 0.8, 5, room.cx, 0.4, room.cz + 0.8, { amp: 0.3, speed: 4 });
    }
  }
});

// --------------------------------------------------------------------------
// Windows and the mirror
// --------------------------------------------------------------------------
Object.assign(World.prototype, {
  // Shared night view. Lightning raises its brightness (see Atmosphere).
  windowMat() {
    return Cache.mat('window.night', () => new THREE.MeshBasicMaterial({ map: this.lab.night(), fog: false, toneMapped: true }));
  },

  addWindow(room, x, y, z, ry, w, h) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; room.group.add(g);
    const pane = new THREE.Mesh(Cache.geo('plane:' + w + 'x' + h, () => new THREE.PlaneGeometry(w, h)), this.windowMat()); pane.position.z = 0.02; g.add(pane);
    const fm = this.mat(0x120d09, 0.6);
    const add = (bw, bh, px, py) => { const m = new THREE.Mesh(Cache.geo('box:' + bw + ',' + bh + ',.12', () => new THREE.BoxGeometry(bw, bh, 0.12)), fm); m.position.set(px, py, 0.06); g.add(m); };
    add(w + 0.2, 0.1, 0, h / 2); add(w + 0.2, 0.1, 0, -h / 2); add(0.1, h, -w / 2, 0); add(0.1, h, w / 2, 0); add(0.06, h, 0, 0); add(w, 0.06, 0, 0);
    room.windows.push({ x, y, z, ry });
    // drifting fog layer outside
    const fogPlane = new THREE.Mesh(Cache.geo('plane:' + w + 'x' + h * 0.4, () => new THREE.PlaneGeometry(w, h * 0.4)), new THREE.MeshBasicMaterial({ color: 0x8090a8, transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
    fogPlane.position.set(0, -h * 0.3, 0.03); g.add(fogPlane);
    room.updaters.push((dt, t) => { fogPlane.position.x = Math.sin(t * 0.12) * 0.25; fogPlane.material.opacity = 0.14 + Math.sin(t * 0.3) * 0.05; });
    return g;
  },

  // A real reflection: the scene is rendered from a mirrored camera into a small
  // render target. Layer 1 objects (the mirror ghost) show only in the reflection.
  addMirror(room, x, y, z, ry, w, h) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; room.group.add(g);
    const game = this.game;
    const rt = Cache.tex('mirror.rt', () => { const t = new THREE.WebGLRenderTarget(560, 672, { format: THREE.RGBFormat, generateMipmaps: false, minFilter: THREE.LinearFilter }); t.userData = { cached: true }; t.texture.userData = { cached: true }; return t; });
    const uniforms = { tDiffuse: { value: rt.texture }, textureMatrix: { value: new THREE.Matrix4() }, tint: { value: new THREE.Color(0.75, 0.8, 0.85) } };
    const mat = new THREE.ShaderMaterial({
      uniforms, fog: false,
      vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv = textureMatrix * vec4(position,1.0); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform vec3 tint; varying vec4 vUv; void main(){ vec4 c = texture2DProj(tDiffuse, vUv); gl_FragColor = vec4(c.rgb*tint, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
    });
    mat.userData = { own: true };
    const mesh = new THREE.Mesh(Cache.geo('plane:' + w + 'x' + h, () => new THREE.PlaneGeometry(w, h)), mat); mesh.position.z = 0.02; g.add(mesh);
    const crack = new THREE.Mesh(Cache.geo('plane:' + w + 'x' + h, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ map: this.lab.crack(), transparent: true, depthWrite: false })); crack.position.z = 0.03; g.add(crack);
    const fm = this.mat(0x2a1c10, 0.5, 0.4);
    [[w + 0.14, 0.08, 0, h / 2], [w + 0.14, 0.08, 0, -h / 2], [0.08, h, -w / 2, 0], [0.08, h, w / 2, 0]].forEach(p => { const m = new THREE.Mesh(Cache.geo('box:' + p[0] + ',' + p[1] + ',.08', () => new THREE.BoxGeometry(p[0], p[1], 0.08)), fm); m.position.set(p[2], p[3], 0.04); g.add(m); });
    const normal = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const mirror = { room, mesh, rt, uniforms, normal, w, h, ghostLayer: false, vcam: new THREE.PerspectiveCamera(), clip: new THREE.Plane(), frame: 0 };
    mirror.vcam.layers.enable(1);
    room.mirror = mirror;
    return mirror;
  }
});

// Per-frame mirror pass (called by the game when the room has a mirror)
function renderMirror(game, mirror) {
  const cam = game.camera, mesh = mirror.mesh, vcam = mirror.vcam, n = mirror.normal;
  if ((mirror.frame++ & 1) === 1) return;
  mesh.updateMatrixWorld(true);
  const p0 = TMP.v1.setFromMatrixPosition(mesh.matrixWorld), cp = TMP.v2.setFromMatrixPosition(cam.matrixWorld);
  const view = TMP.v3.subVectors(p0, cp);
  if (view.dot(n) > 0 || view.length() > 9) return;
  const rot = TMP.m1.extractRotation(cam.matrixWorld);
  const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cp);
  const reflPos = view.clone().reflect(n).negate().add(p0);
  const target = new THREE.Vector3().subVectors(p0, look).reflect(n).negate().add(p0);
  vcam.position.copy(reflPos);
  vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
  vcam.lookAt(target);
  vcam.far = cam.far; vcam.updateMatrixWorld();
  vcam.projectionMatrix.copy(cam.projectionMatrix);
  const tm = mirror.uniforms.textureMatrix.value;
  tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  tm.multiply(vcam.projectionMatrix); tm.multiply(vcam.matrixWorldInverse); tm.multiply(mesh.matrixWorld);
  mirror.clip.setFromNormalAndCoplanarPoint(n, p0.clone().addScaledVector(n, 0.01));
  const r = game.renderer, prevRT = r.getRenderTarget(), prevClip = r.clippingPlanes, auto = r.shadowMap.autoUpdate;
  mesh.visible = false; r.shadowMap.autoUpdate = false; r.clippingPlanes = [mirror.clip];
  r.setRenderTarget(mirror.rt); r.clear(); r.render(game.scene, vcam);
  r.setRenderTarget(prevRT); r.clippingPlanes = prevClip; r.shadowMap.autoUpdate = auto; mesh.visible = true;
}
