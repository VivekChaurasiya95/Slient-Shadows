'use strict';
// ==========================================================================
// WORLD: Room objects, navigation grid, and the World that builds a run from
// the registry (WORLD_DATA) and a seeded layout.
// ==========================================================================
class Room {
  constructor(def) {
    this.id = def.id; this.def = def; this.bounds = def.bounds; this.H = def.H;
    this.group = new THREE.Group(); this.group.visible = false;
    this.colliders = []; this.doors = []; this.occluders = []; this.interactables = [];
    this.hides = []; this.spots = []; this.flickers = []; this.lights = [];
    this.updaters = [];           // per-frame animation callbacks (dt, time)
    this.role = 'honest'; this.trap = null; this.trapDone = false;
    this.rayDirty = true; this.nav = null; this.waypoints = [];
    this.lightLevel = 0.2;        // how lit the room feels (fear falls faster in light)
    this.visited = false;
    this.windows = []; this.mirror = null;
  }
  get visible() { return this.group.visible; }
  get cx() { return (this.bounds.minX + this.bounds.maxX) / 2; }
  get cz() { return (this.bounds.minZ + this.bounds.maxZ) / 2; }
  // Static + moving (door) colliders
  blocked(x, z, r) {
    const b = this.bounds;
    if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return true;
    for (const c of this.colliders) if (rectContains(c, x, z, r)) return true;
    for (const d of this.doors) if (d.rect && rectContains(d.rect, x, z, r * 0.6)) return true;
    return false;
  }
  // Clear line between two points (furniture only)
  lineClear(ax, az, bx, bz, pad) {
    for (const c of this.colliders) if (c.tall !== false && segHitsRect(ax, az, bx, bz, c, pad || 0)) return false;
    return true;
  }
}

// --------------------------------------------------------------------------
// NavGrid: 0.4m cells, A* with string pulling. Static colliders only; doors are
// handled by the ghost (it opens them).
// --------------------------------------------------------------------------
class NavGrid {
  constructor(room, clearance) {
    this.room = room; this.cs = 0.4; this.cl = clearance || 0.45;
    const b = room.bounds;
    this.minX = b.minX; this.minZ = b.minZ;
    this.nx = Math.ceil((b.maxX - b.minX) / this.cs); this.nz = Math.ceil((b.maxZ - b.minZ) / this.cs);
    this.cells = new Uint8Array(this.nx * this.nz);
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const x = this.minX + (ix + 0.5) * this.cs, z = this.minZ + (iz + 0.5) * this.cs;
      this.cells[iz * this.nx + ix] = this.staticBlocked(x, z) ? 1 : 0;
    }
  }
  staticBlocked(x, z) {
    const b = this.room.bounds, r = this.cl;
    if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return true;
    for (const c of this.room.colliders) if (rectContains(c, x, z, r)) return true;
    return false;
  }
  cellOf(x, z) { return [clamp(Math.floor((x - this.minX) / this.cs), 0, this.nx - 1), clamp(Math.floor((z - this.minZ) / this.cs), 0, this.nz - 1)]; }
  free(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz && !this.cells[iz * this.nx + ix]; }
  nearestFree(ix, iz) {
    if (this.free(ix, iz)) return [ix, iz];
    for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (this.free(ix + dx, iz + dz)) return [ix + dx, iz + dz];
    }
    return null;
  }
  center(ix, iz) { return { x: this.minX + (ix + 0.5) * this.cs, z: this.minZ + (iz + 0.5) * this.cs }; }
  segClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.staticBlocked(lerp(ax, bx, t), lerp(az, bz, t))) return false; }
    return true;
  }
  findPath(sx, sz, tx, tz) {
    let s = this.nearestFree(...this.cellOf(sx, sz)), t = this.nearestFree(...this.cellOf(tx, tz));
    if (!s || !t) return [{ x: tx, z: tz }];
    if (this.segClear(sx, sz, tx, tz)) return [{ x: tx, z: tz }];
    const nx = this.nx, key = (x, z) => z * nx + x, open = [key(s[0], s[1])], came = {}, g = { [key(s[0], s[1])]: 0 }, f = { [key(s[0], s[1])]: 0 };
    const goal = key(t[0], t[1]), closed = new Set();
    const h = (x, z) => Math.hypot(x - t[0], z - t[1]);
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) break;
      closed.add(cur);
      const cx = cur % nx, cz = Math.floor(cur / nx);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ax = cx + dx, az = cz + dz;
        if (!this.free(ax, az)) continue;
        if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue;
        const k = key(ax, az); if (closed.has(k)) continue;
        const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (g[k] === undefined || ng < g[k]) { g[k] = ng; f[k] = ng + h(ax, az); came[k] = cur; if (!open.includes(k)) open.push(k); }
      }
    }
    if (came[goal] === undefined && goal !== key(s[0], s[1])) return [{ x: tx, z: tz }];
    const cells = []; let c = goal;
    while (c !== undefined) { cells.unshift(c); c = came[c]; }
    let pts = cells.map(k => this.center(k % nx, Math.floor(k / nx)));
    pts.push({ x: tx, z: tz });
    // string pulling
    const out = []; let a = { x: sx, z: sz }, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.segClear(a.x, a.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); a = pts[j]; i = j + 1;
    }
    return out;
  }
  // Sample well-spaced free points for patrol waypoints
  waypoints(step) {
    const out = [];
    for (let z = this.minZ + 1; z < this.minZ + this.nz * this.cs - 0.8; z += step) for (let x = this.minX + 1; x < this.minX + this.nx * this.cs - 0.8; x += step) {
      const [ix, iz] = this.cellOf(x, z);
      if (this.free(ix, iz)) out.push(this.center(ix, iz));
    }
    return out;
  }
}

// --------------------------------------------------------------------------
// World: builds every room, door, spot and hiding place for one run.
// Room builders live in rooms.js, spots in spots.js, decor in decor.js.
// --------------------------------------------------------------------------
class World {
  constructor(game) {
    this.game = game;
    this.lab = new TextureLab(game.renderer);
    this.rooms = {}; this.doors = {}; this.spots = {}; this.hideSpots = {};
    this.root = null; this.layout = null;
  }
  mat(color, rough, metal, extra) {
    const key = 'w:' + color + ':' + rough + ':' + (metal || 0) + ':' + (extra ? JSON.stringify(extra) : '');
    // everything in the house is faded and grimy: drain most of the colour and darken it a little
    const c = new THREE.Color(color), hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.4, hsl.l * 0.78);
    return Cache.mat(key, () => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: rough === undefined ? 0.8 : Math.max(rough, 0.6), metalness: metal || 0 }, extra || {})));
  }
  texMat(tex, rough, extra) { return new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: rough === undefined ? 0.9 : rough }, extra || {})); }

  addMesh(room, geo, material, x, y, z, o) {
    o = o || {};
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = true;
    (o.parent || room.group).add(m);
    if (o.occ) { m.userData.occ = true; room.occluders.push(m); }
    return m;
  }
  // Box with optional collider (and raycast occlusion when it collides)
  addBox(room, material, w, h, d, x, y, z, collide, o) {
    const m = this.addMesh(room, Cache.geo('box:' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), material, x, y, z, Object.assign({ occ: !!collide }, o || {}));
    if (collide) {
      const ry = (o && o.ry) || 0, c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
      room.colliders.push([x - hw, x + hw, z - hd, z + hd]);
    }
    return m;
  }
  addCollider(room, x, z, hw, hd) { room.colliders.push([x - hw, x + hw, z - hd, z + hd]); }
  addLight(room, color, intensity, dist, x, y, z, flicker) {
    intensity *= 0.55; dist *= 0.85;
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z); room.group.add(l); room.lights.push(l);
    if (flicker) room.flickers.push({ light: l, base: intensity, amp: flicker.amp, speed: flicker.speed, phase: Math.random() * 10 });
    return l;
  }

  // ---- build / dispose ------------------------------------------------------
  build(layout) {
    this.dispose();
    this.layout = layout;
    this.root = new THREE.Group();
    this.game.scene.add(this.root);
    WORLD_DATA.ROOM_IDS.forEach(id => {
      const room = new Room(WORLD_DATA.ROOMS[id]);
      room.role = layout.roles[id] || 'honest'; room.trap = layout.traps[id] || null;
      this.rooms[id] = room; this.root.add(room.group);
      this.buildShell(room);
      this['build_' + id](room);
    });
    // doors from the registry, then pair them
    WORLD_DATA.DOORS.forEach(def => { this.doors[def.id] = new Door(this.game, this.rooms[def.room], def); });
    WORLD_DATA.DOORS.forEach(def => { if (def.to) this.doors[def.id].pair = this.doors[def.to]; });
    WORLD_DATA.LOCK_SLOTS.forEach(slot => {
      WORLD_DATA.DOORS.filter(d => d.slot === slot).forEach(d => { this.doors[d.id].lock = { type: 'key', keyId: layout.keyForSlot[slot] }; this.doors[d.id].buildLockVisual(); });
    });
    WORLD_DATA.SPOTS.forEach(s => buildSpot(this, this.rooms[s.room], s, layout.items[s.id]));
    WORLD_DATA.HIDES.forEach(h => {
      const real = layout.hides.includes(h.id), fake = layout.fakeHide === h.id;
      if (real || fake) buildHide(this, this.rooms[h.room], h, fake);
    });
    // wiring, bulbs and switches in every room; then the mission fixtures (locker, altar, door marks)
    if (this.game.power) this.game.power.build(this);
    if (this.game.missions) this.game.missions.build(this, layout);
    Object.values(this.rooms).forEach(room => {
      this.decorate(room);
      room.nav = new NavGrid(room);
      room.waypoints = room.nav.waypoints(2.2);
    });
    return this;
  }

  dispose() {
    if (!this.root) return;
    this.game.tweens.cancelAll();
    this.game.scene.remove(this.root);
    disposeTree(this.root);
    this.rooms = {}; this.doors = {}; this.spots = {}; this.hideSpots = {}; this.root = null;
  }

  // Floor, ceiling and four walls with the room's theme
  buildShell(room) {
    const b = room.bounds, H = room.H, w = b.maxX - b.minX, d = b.maxZ - b.minZ, L = this.lab;
    const theme = {
      corridor: { base: [95, 10, 17], panel: [24, 30, 11], peel: true }, parlor: { base: [350, 38, 15], panel: [22, 35, 10] },
      bedroom: { base: [212, 16, 18], panel: [26, 22, 12], peel: true }, kitchen: { base: [48, 16, 20], panel: [30, 20, 13], peel: true },
      library: { base: [18, 30, 14], panel: [24, 40, 9] }, nursery: { base: [290, 18, 20], panel: [30, 15, 15], peel: true },
      cellar: null, crypt: null
    }[room.id];
    const stone = room.def.floor === 'stone';
    const floorTex = L.repeat(stone ? L.stone() : L.wood(), room.id + '.floor', w / 3, d / 3);
    const ceilTex = L.repeat(stone ? L.stone() : L.plaster(), room.id + '.ceil', w / 3, d / 3);
    const f = this.addMesh(room, Cache.geo('plane:' + w + 'x' + d, () => new THREE.PlaneGeometry(w, d)), this.texMat(floorTex, 0.75), room.cx, 0, room.cz, { rx: -Math.PI / 2, cast: false });
    f.name = 'floor';
    this.addMesh(room, f.geometry, this.texMat(ceilTex, 1), room.cx, H, room.cz, { rx: Math.PI / 2, cast: false });
    const wallBase = theme ? L.wall(room.id, theme) : L.stone();
    const wall = (len, x, z, ry, name) => {
      const t = L.repeat(wallBase, room.id + '.' + name, len / 3, theme ? H / 3.4 : H / 3);
      this.addMesh(room, Cache.geo('plane:' + len + 'x' + H, () => new THREE.PlaneGeometry(len, H)), this.texMat(t, 0.95), x, H / 2, z, { ry, cast: false, occ: true });
    };
    wall(w, room.cx, b.minZ, 0, 'N'); wall(w, room.cx, b.maxZ, Math.PI, 'S');
    wall(d, b.minX, room.cz, Math.PI / 2, 'W'); wall(d, b.maxX, room.cz, -Math.PI / 2, 'E');
  }

  // Room lookup helpers
  nearestFreeSpot(room, x, z) { const n = room.nav; const c = n.nearestFree(...n.cellOf(x, z)); return c ? n.center(c[0], c[1]) : { x, z }; }
}
