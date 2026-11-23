'use strict';
// ==========================================================================
// CINEMA KIT: builders for cutscene and menu sets. Everything is primitives and
// the game's own TextureLab textures, so nothing is loaded from disk.
// Every builder returns an object with .group and (where animated) .update(dt, t).
// ==========================================================================
const CINE_THEMES = {   // same values as World.buildShell, so wall textures come from the shared cache
  parlor: { base: [350, 38, 15], panel: [22, 35, 10] }, bedroom: { base: [212, 16, 18], panel: [26, 22, 12], peel: true },
  kitchen: { base: [48, 16, 20], panel: [30, 20, 13], peel: true }, library: { base: [18, 30, 14], panel: [24, 40, 9] },
  nursery: { base: [290, 18, 20], panel: [30, 15, 15], peel: true }
};

class CinemaKit {
  constructor(game) { this.game = game; this.lab = game.world.lab; }

  // ---- materials and tiny helpers -----------------------------------------------
  std(color, rough, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough === undefined ? 0.85 : rough, metalness: 0.02 }, extra || {})); }
  cmat(color, rough, metal) { return Cache.mat('ck:' + color + ':' + (rough === undefined ? 0.85 : rough) + ':' + (metal || 0), () => new THREE.MeshStandardMaterial({ color, roughness: rough === undefined ? 0.85 : rough, metalness: metal || 0 })); }
  box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(Cache.geo('cb:' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), typeof mat === 'number' ? this.cmat(mat) : mat);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
  }
  cyl(parent, r1, r2, h, mat, x, y, z, seg) {
    const m = new THREE.Mesh(Cache.geo('cc:' + r1 + ',' + r2 + ',' + h + ',' + (seg || 12), () => new THREE.CylinderGeometry(r1, r2, h, seg || 12)), typeof mat === 'number' ? this.cmat(mat) : mat);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
  }
  glowTex() {
    return Cache.tex('tex.cine.glow', () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); });
  }
  sprite(color, size, opacity, x, y, z) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex(), color, transparent: true, opacity: opacity === undefined ? 0.6 : opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.set(size, size, 1); s.position.set(x || 0, y || 0, z || 0); return s;
  }
  // triangular prism (gable roof). ridge runs along x.
  prism(w, h, d, mat) {
    const geo = Cache.geo('prism:' + w + ',' + h + ',' + d, () => {
      const a = w / 2, b = d / 2, v = [[-a, 0, b], [a, 0, b], [a, 0, -b], [-a, 0, -b], [-a, h, 0], [a, h, 0]];
      const tri = [[0, 1, 5], [0, 5, 4], [1, 2, 5], [3, 4, 5], [3, 5, 2], [0, 4, 3], [2, 1, 0], [3, 2, 0]];
      // slopes: front (0,1,5,4) and back (2,3,4,5); gable ends (1,2,5) and (3,0,4); floor skipped
      const faces = [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [1, 2, 5], [3, 0, 4]];
      const p = []; faces.forEach(f => f.forEach(i => p.push(v[i][0], v[i][1], v[i][2])));
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3)); g.computeVertexNormals(); return g;
    });
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
  }

  // ---- sky, ground, trees ------------------------------------------------------------
  sky(scene, opts) {
    opts = opts || {};
    scene.background = new THREE.Color(opts.bg || 0x05070d);
    scene.fog = new THREE.FogExp2(opts.fog || 0x070a12, opts.fogDensity === undefined ? 0.022 : opts.fogDensity);
    const g = new THREE.Group();
    const grad = Cache.tex('tex.cine.skygrad', () => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#02030a'); gr.addColorStop(0.3, '#070d1d'); gr.addColorStop(0.46, '#1f3052'); gr.addColorStop(0.5, '#34486e'); gr.addColorStop(0.56, '#18243e'); gr.addColorStop(0.75, '#070b14'); gr.addColorStop(1, '#030409'); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 16), new THREE.MeshBasicMaterial({ map: grad, side: THREE.BackSide, fog: false, depthWrite: false })); dome.rotation.y = 0; g.add(dome);
    dome.scale.y = 0.8; dome.position.y = -10;
    // stars on a dome
    const n = 260, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.2, r = 150; p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false })));
    // moon with a halo
    const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false }));
    const mp = opts.moonPos || [-60, 70, -120]; moon.position.set(mp[0], mp[1], mp[2]); g.add(moon);
    g.add(this.sprite(0xaabfff, 70, 0.4, mp[0], mp[1], mp[2]));
    // moon and fill lights
    const ml = new THREE.DirectionalLight(0x8ea8e8, opts.moonLight === undefined ? 0.7 : opts.moonLight); ml.position.set(mp[0], mp[1], mp[2]); g.add(ml);
    g.add(new THREE.HemisphereLight(0x4a62a0, 0x0a0a10, opts.hemi === undefined ? 0.75 : opts.hemi));
    // cool light from the camera side so building fronts are readable, not just black cut-outs
    const fill = new THREE.DirectionalLight(0x7088c8, opts.fill === undefined ? 1.0 : opts.fill); fill.position.set(-26, 32, 70); g.add(fill);
    return { group: g, moon, light: ml };
  }

  ground(opts) {
    opts = opts || {};
    const g = new THREE.Group();
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.std(0x0c1008, 1));
    gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; g.add(gnd);
    // a rise under the manor
    const hill = new THREE.Mesh(new THREE.SphereGeometry(40, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.std(0x0a0e08, 1));
    hill.scale.set(1.4, 0.16, 1); hill.position.set(0, 0, opts.hillZ || -34); hill.receiveShadow = true; g.add(hill);
    // gravel road with a worn centre
    const road = Cache.tex('tex.cine.road', () => { const c = document.createElement('canvas'); c.width = 128; c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#242018'; x.fillRect(0, 0, 128, 512); for (let i = 0; i < 2200; i++) { x.fillStyle = 'rgba(' + (60 + Math.random() * 60 | 0) + ',' + (54 + Math.random() * 50 | 0) + ',' + (44 + Math.random() * 40 | 0) + ',' + Math.random() * 0.6 + ')'; x.fillRect(Math.random() * 128, Math.random() * 512, 2, 2); } x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, 0, 14, 512); x.fillRect(114, 0, 14, 512); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 14); t.encoding = THREE.sRGBEncoding; return t; });
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(6, 70), new THREE.MeshStandardMaterial({ map: road, roughness: 0.55, metalness: 0.12 }));
    rd.rotation.x = -Math.PI / 2; rd.position.set(0, 0.03, 10); rd.receiveShadow = true; g.add(rd);
    return { group: g, road: rd };
  }

  // A bare tree. All branches are merged into ONE geometry, so a tree costs one draw call.
  tree(x, z, scale, seed) {
    const r = new RNG('tree' + seed), P = [], N = [], I = [], m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    const branch = (px, py, pz, len, ax, az, rad, d) => {
      if (d > 4) return;
      const geo = new THREE.CylinderGeometry(rad * 0.62, rad, len, 5); geo.translate(0, len / 2, 0);
      const eu = new THREE.Euler(ax, 0, az); m4.compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(eu), one); geo.applyMatrix4(m4);
      const base = P.length / 3, pa = geo.attributes.position.array, na = geo.attributes.normal.array, ia = geo.index.array;
      for (let i = 0; i < pa.length; i++) { P.push(pa[i]); N.push(na[i]); } for (let i = 0; i < ia.length; i++) I.push(ia[i] + base); geo.dispose();
      const e = new THREE.Vector3(0, len, 0).applyEuler(eu), n = d < 2 ? 3 : 2;
      for (let i = 0; i < n; i++) branch(px + e.x, py + e.y, pz + e.z, len * (0.68 + r.next() * 0.1), ax + (r.next() - 0.5) * 1.1, az + (r.next() - 0.5) * 1.3, rad * 0.62, d + 1);
    };
    branch(0, 0, 0, 3.2, (r.next() - 0.5) * 0.15, (r.next() - 0.5) * 0.2, 0.24, 0);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3)); geo.setIndex(I);
    const mesh = new THREE.Mesh(geo, this.cmat(0x07080a, 1)), g = new THREE.Group(); g.add(mesh); g.position.set(x, 0, z); g.scale.setScalar(scale || 1); return g;
  }

  // ---- weather ---------------------------------------------------------------------------
  rain(opts) {
    opts = opts || {};
    const N = opts.count || 1100, W = opts.width || 40, H = opts.height || 22, D = opts.depth || 40;
    const p = new Float32Array(N * 6), v = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * W, y = Math.random() * H, z = (Math.random() - 0.5) * D; p.set([x, y, z, x - 0.05, y - 0.7, z], i * 6); v[i] = 14 + Math.random() * 8; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: opts.opacity || 0.32, fog: false }));
    lines.frustumCulled = false;
    const o = { group: lines, follow: null, update(dt) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) { const k = i * 6; a[k + 1] -= v[i] * dt; a[k + 4] -= v[i] * dt; a[k] -= dt * 2.2; a[k + 3] -= dt * 2.2; if (a[k + 1] < 0) { const x = (Math.random() - 0.5) * W, z = (Math.random() - 0.5) * D; a[k] = x; a[k + 1] = H; a[k + 2] = z; a[k + 3] = x - 0.05; a[k + 4] = H - 0.7; a[k + 5] = z; } }
      geo.attributes.position.needsUpdate = true;
      if (o.follow) lines.position.set(o.follow.position.x, 0, o.follow.position.z - 6);
    } };
    return o;
  }

  fogBank(opts) {
    opts = opts || {};
    const g = new THREE.Group(), list = [], n = opts.count || 14, tex = this.glowTex();
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: opts.color || 0x7f90ac, transparent: true, opacity: (opts.opacity || 0.2) * (0.5 + Math.random() * 0.8), depthWrite: false, fog: false }));
      const sc = (opts.size || 22) * (0.6 + Math.random() * 0.9); s.scale.set(sc * 1.8, sc * 0.5, 1);
      s.position.set((Math.random() - 0.5) * (opts.spread || 80), opts.y === undefined ? 1.5 : opts.y + Math.random() * 2, opts.z === undefined ? -10 + (Math.random() - 0.5) * 40 : opts.z + (Math.random() - 0.5) * 30);
      s.userData.sp = 0.2 + Math.random() * 0.5; g.add(s); list.push(s);
    }
    const span = (opts.spread || 80) / 2;
    return { group: g, update(dt) { list.forEach(s => { s.position.x += s.userData.sp * dt; if (s.position.x > span) s.position.x = -span; }); } };
  }

  crows(n, cx, cy, cz, radius) {
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.DoubleSide, fog: true }), list = [];
    const geo = Cache.geo('cine.crow', () => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.18, 0.42, 0, 0, 0, 0, -0.12, 0, 0, 0.18, -0.42, 0, 0, 0, 0, -0.12]), 3)); gg.computeVertexNormals(); return gg; });
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); g.add(m); list.push({ m, a: Math.random() * 6.28, r: radius * (0.6 + Math.random() * 0.6), s: 0.35 + Math.random() * 0.3, h: cy + Math.random() * 6, ph: Math.random() * 6 }); }
    return { group: g, update(dt, t) { list.forEach(c => { c.a += c.s * dt; const x = cx + Math.cos(c.a) * c.r, z = cz + Math.sin(c.a) * c.r; c.m.position.set(x, c.h + Math.sin(t * 0.7 + c.ph) * 1.2, z); c.m.rotation.y = -c.a; c.m.scale.y = 0.4 + Math.abs(Math.sin(t * 9 + c.ph)) * 1.1; c.m.rotation.z = Math.sin(t * 9 + c.ph) * 0.45; }); } };
  }

  // a flickering point light that can be thrown into any scene
  flame(parent, color, intensity, dist, x, y, z) {
    const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(l);
    const ph = Math.random() * 9;
    l.userData.tick = (t) => { l.intensity = intensity * (1 + Math.sin(t * 11 + ph) * 0.12 + Math.sin(t * 23 + ph) * 0.07 + (Math.random() - 0.5) * 0.08); };
    return l;
  }
}

// --------------------------------------------------------------------------
// Buildings, vehicles and small props
// --------------------------------------------------------------------------
Object.assign(CinemaKit.prototype, {
  // Hollow Manor. Origin at the middle of the front steps, front faces +z.
  manor(opts) {
    opts = opts || {};
    const g = new THREE.Group(), lab = this.lab;
    const wallTex = lab.repeat(lab.brick(), 'cine.manor.wall', 44, 9);
    const wall = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x6a645e, roughness: 0.95 });
    const roofM = this.std(0x0c0d12, 0.9), trim = this.cmat(0x14110e, 0.9);
    const B = (w, h, d, x, y, z, m) => this.box(g, w, h, d, m || wall, x, y, z);
    B(24, 8, 10, 0, 4, -5); B(7, 10, 9, -15, 5, -5.5); B(7, 10, 9, 15, 5, -5.5); B(8, 12, 4, 0, 6, 1.2);
    const roof = this.prism(26, 4, 11, roofM); roof.position.set(0, 8, -5); g.add(roof);
    [-15, 15].forEach(x => { const wr = this.prism(8, 3.6, 10, roofM); wr.position.set(x, 10, -5.5); g.add(wr); });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.4, 7, 4), roofM); spire.position.set(0, 15.5, 1.2); spire.rotation.y = Math.PI / 4; spire.castShadow = true; g.add(spire);
    [[-8, 12.4, -4], [6, 12.6, -6.5], [-17, 14, -4]].forEach(c => { B(1.2, 4, 1.2, c[0], c[1], c[2], trim); });
    B(26.4, 0.6, 10.6, 0, 0.3, -5, trim);                                  // plinth
    // front door, steps and the chains across it
    const doorBox = B(2.6, 4.2, 0.3, 0, 2.1, 3.25, this.cmat(0x0d0907, 1)); B(3.4, 0.4, 2, 0, 0.2, 4.2, trim); B(4.4, 0.4, 2, 0, 0.05, 5.0, trim);
    const chain = this.cmat(0x3a3a40, 0.4, 0.9); this.chains = [];
    for (let k = 0; k < 2; k++) for (let i = 0; i < 12; i++) {
      const l = new THREE.Mesh(Cache.geo('manor.link', () => new THREE.TorusGeometry(0.11, 0.028, 5, 8)), chain);
      l.position.set(-1.1 + i * 0.2, 1.7 + k * 0.9 - Math.sin((i / 11) * Math.PI) * 0.18, 3.45); l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); this.chains.push(l);
    }
    // windows: a few are lit. One upper window in the tower holds the pale figure.
    const lit = [this.warm(0xffb060), this.warm(0xff9a48), this.warm(0xffc47a)], dark = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.2, metalness: 0.7, emissive: 0x0a1020, emissiveIntensity: 0.4 });
    const wins = [], gp = new THREE.PlaneGeometry(1.2, 2.0), fp = new THREE.BoxGeometry(1.5, 2.3, 0.15);
    const addWin = (x, y, z, isLit, tag) => {
      const m = isLit ? lit[Math.abs(Math.round(x + y)) % 3] : dark, win = new THREE.Mesh(gp, m); win.position.set(x, y, z + 0.02); g.add(win);
      const fr = new THREE.Mesh(fp, trim); fr.position.set(x, y, z - 0.05); g.add(fr); wins.push({ x, y, z: z + 0.05, lit: isLit, tag: tag || '', mesh: win });
    };
    [-9, -6, 6, 9].forEach((x, i) => [2.8, 7.0].forEach((y, r) => addWin(x, y, 0, ((i * 2 + r) % 3) === 0)));        // main block face, z=0
    [-15, 15].forEach(x => [3.2, 7.6].forEach((y, r) => addWin(x, y, -1, (r + (x > 0 ? 1 : 0)) % 2 === 0)));               // wing faces, z=-1
    [-2.2, 2.2].forEach(x => [8.0, 10.6].forEach((y, r) => addWin(x, y, 3.2, x > 0 && r === 1)));                         // tower face, z=3.2
    this.lit = lit;
    const gw = wins.find(w => w.x === -2.2 && w.y === 8.0);
    gw.tag = 'ghost';    const o = { group: g, windows: wins, ghostWin: gw, doorBox, chains: this.chains, update: (dt, t) => lit.forEach((m, i) => { const f = 0.78 + Math.sin(t * (7 + i * 2.3) + i) * 0.14 + Math.sin(t * 19 + i) * 0.06; m.color.setRGB(1.0 * f, 0.62 * f, 0.28 * f); }) };
    return o;
  },
  warm(hex) { return new THREE.MeshBasicMaterial({ color: hex, fog: true }); },

  // A 1990s saloon with headlights and a visible driver seat. Faces +z.
  car() {
    const g = new THREE.Group(), body = this.std(0x0b0c10, 0.35, { metalness: 0.5 }), glass = new THREE.MeshStandardMaterial({ color: 0x0c1520, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.28, depthWrite: false });
    this.box(g, 1.9, 0.6, 4.4, body, 0, 0.72, 0); this.box(g, 1.7, 0.55, 2.2, glass, 0, 1.28, -0.2);
    this.box(g, 1.72, 0.06, 2.24, body, 0, 1.58, -0.2); this.box(g, 0.1, 0.55, 0.1, body, -0.84, 1.28, 0.85); this.box(g, 0.1, 0.55, 0.1, body, 0.84, 1.28, 0.85);
    [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]].forEach(w => { const wh = this.cyl(g, 0.38, 0.38, 0.3, 0x050505, w[0], 0.38, w[1], 14); wh.rotation.z = Math.PI / 2; });
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false });
    [-0.62, 0.62].forEach(x => { this.box(g, 0.36, 0.18, 0.06, hl, x, 0.78, 2.22); g.add(this.sprite(0xfff0c0, 1.6, 0.7, x, 0.78, 2.3)); });
    const beam = new THREE.SpotLight(0xfff0d0, 3.2, 38, 0.46, 0.7, 1.4); beam.position.set(0, 0.85, 2.0); beam.target.position.set(0, 0, 14); g.add(beam, beam.target);
    const dash = new THREE.PointLight(0x66aa88, 0.5, 4, 2); dash.position.set(0, 1.1, 0.5); g.add(dash);
    return { group: g, beam, seat: new THREE.Vector3(-0.45, 0.78, -0.35) };
  },

  candle(parent, x, y, z, h, withLight) {
    h = h || 0.22; const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g);
    this.cyl(g, 0.026, 0.03, h, 0xe8dfc8, 0, h / 2, 0, 8);
    const f = new THREE.Mesh(Cache.geo('cine.flame', () => new THREE.ConeGeometry(0.018, 0.07, 6)), new THREE.MeshBasicMaterial({ color: 0xffd488, fog: false })); f.position.y = h + 0.04; g.add(f);
    g.add(this.sprite(0xffa850, 0.45, 0.55, 0, h + 0.05, 0));
    let l = null; if (withLight) { l = new THREE.PointLight(0xffa850, 0.9, 6, 2); l.position.y = h + 0.12; g.add(l); }
    const ph = Math.random() * 9;
    return { group: g, light: l, update(dt, t) { const k = 1 + Math.sin(t * 12 + ph) * 0.14 + Math.sin(t * 27 + ph) * 0.07; f.scale.set(1 / k, k, 1 / k); if (l) l.intensity = 0.9 * k; } };
  },

  lantern(parent, x, y, z, color, withLight) {
    const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g);
    const iron = this.cmat(0x1a1612, 0.5, 0.7);
    this.box(g, 0.14, 0.02, 0.14, iron, 0, -0.1, 0); this.box(g, 0.14, 0.02, 0.14, iron, 0, 0.1, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => this.box(g, 0.012, 0.2, 0.012, iron, c[0] * 0.065, 0, c[1] * 0.065));
    const gl = new THREE.Mesh(Cache.geo('cine.lglass', () => new THREE.BoxGeometry(0.11, 0.17, 0.11)), new THREE.MeshBasicMaterial({ color: color || 0xffc070, fog: false })); g.add(gl);
    const ring = new THREE.Mesh(Cache.geo('cine.lring', () => new THREE.TorusGeometry(0.06, 0.008, 4, 10, Math.PI)), iron); ring.position.y = 0.12; g.add(ring);
    g.add(this.sprite(color || 0xffa850, 1.1, 0.6, 0, 0, 0));
    let l = null; if (withLight) { l = new THREE.PointLight(color || 0xffa850, 1.1, 8, 2); g.add(l); }
    const ph = Math.random() * 9;
    return { group: g, light: l, update(dt, t) { if (l) l.intensity = 1.1 * (1 + Math.sin(t * 9 + ph) * 0.1 + Math.sin(t * 21 + ph) * 0.06); } };
  },

  // the horned skull from the game's own item model, scaled up and glowing green
  skull(scale) {
    const g = new THREE.Group(), m = ItemFactory.create('relic'); m.scale.setScalar(scale || 2.4); g.add(m);
    const l = new THREE.PointLight(0x39ff7a, 1.6, 7, 2); l.position.y = 0.3; g.add(l); g.add(this.sprite(0x39ff7a, 1.8, 0.55, 0, 0.05, 0));
    return { group: g, light: l, mesh: m, update(dt, t) { l.intensity = 1.2 + Math.sin(t * 2.4) * 0.4 + (Math.random() - 0.5) * 0.15; } };
  },

  runeCircle(radius) {
    const tex = Cache.tex('tex.cine.rune', () => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.strokeStyle = 'rgba(120,255,170,0.95)'; x.fillStyle = 'rgba(120,255,170,0.95)'; x.lineWidth = 3;
      [118, 104, 70].forEach(r => { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); });
      x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; x.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); } x.closePath(); x.stroke();
      x.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; x.lineTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70); } x.closePath(); x.stroke();
      x.font = '18px serif'; x.textAlign = 'center'; '\u16A0\u16A2\u16A6\u16A8\u16B1\u16B7\u16C1\u16C7\u16CA\u16D2\u16D6\u16DA'.split('').forEach((ch, i) => { const a = i * Math.PI / 6; x.save(); x.translate(128 + Math.cos(a) * 87, 128 + Math.sin(a) * 87); x.rotate(a + Math.PI / 2); x.fillText(ch, 0, 6); x.restore(); });
      return new THREE.CanvasTexture(c);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
    return { group: m, power: 0, update(dt, t) { m.material.opacity = this.power * (0.7 + Math.sin(t * 3) * 0.15); m.rotation.z += dt * 0.25 * this.power; } };
  },

  // rising music notes, a pool of sprites
  notes(parent, x, y, z) {
    const tex = Cache.tex('tex.cine.note', () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ffdca0'; g.font = '48px serif'; g.textAlign = 'center'; g.fillText('\u266A', 32, 48); return new THREE.CanvasTexture(c); });
    const grp = new THREE.Group(); grp.position.set(x, y, z); if (parent) parent.add(grp);
    const list = []; for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false })); s.scale.set(0.32, 0.32, 1); grp.add(s); list.push({ s, k: i / 6 }); }
    return { group: grp, rate: 1, update(dt, t) { list.forEach((n, i) => { n.k = (n.k + dt * 0.28 * this.rate) % 1; n.s.position.set(Math.sin(n.k * 6 + i) * 0.35, n.k * 1.5, Math.cos(n.k * 4 + i) * 0.2); n.s.material.opacity = Math.sin(n.k * Math.PI) * 0.9 * (this.rate > 0 ? 1 : 0); }); } };
  },

  sparks(parent, x, y, z, color) {
    const N = 80, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glowTex(), color: color || 0xffc060, size: 0.1, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.position.set(x, y, z); pts.frustumCulled = false; if (parent) parent.add(pts);
    for (let i = 0; i < N; i++) pos[i * 3 + 1] = -99;
    return { group: pts, emit(n, spread) { let c = 0; for (let i = 0; i < N && c < n; i++) if (life[i] <= 0) { c++; life[i] = 0.5 + Math.random() * 0.8; pos.set([0, 0, 0], i * 3); vel.set([(Math.random() - 0.5) * (spread || 1.4), 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * (spread || 1.4)], i * 3); } },
      update(dt) { for (let i = 0; i < N; i++) { if (life[i] > 0) { life[i] -= dt; vel[i * 3 + 1] -= 4.5 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (life[i] <= 0) pos[i * 3 + 1] = -99; } } geo.attributes.position.needsUpdate = true; } };
  },

  // Simple pale apparition for the menu, the manor window and distant shots
  ghostFigure() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfdadf, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const body = new THREE.Mesh(Cache.geo('cine.gbody', () => { const c = new THREE.CylinderGeometry(0.2, 0.5, 1.8, 14, 6, true); c.translate(0, 0.9, 0); return c; }), mat); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat); head.scale.set(0.82, 1.35, 0.9); head.position.set(0, 2.1, 0.02); head.rotation.z = 0.45; g.add(head);
    const eyes = this.sprite(0xa8e8ff, 0.5, 0.9, 0, 2.12, 0.14); g.add(eyes);
    const hair = new THREE.Mesh(Cache.geo('cine.ghair', () => { const c = new THREE.PlaneGeometry(0.5, 1.6, 1, 5); c.translate(0, -0.8, 0); return c; }), new THREE.MeshBasicMaterial({ color: 0x050507, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); hair.position.set(0, 2.15, -0.08); g.add(hair);
    return { group: g, mat, set(a) { mat.opacity = a * 0.8; hair.material.opacity = a * 0.9; eyes.material.opacity = a; g.visible = a > 0.01; }, update(dt, t) { body.scale.x = 1 + Math.sin(t * 1.3) * 0.04; g.position.y += 0; head.rotation.z = 0.45 + Math.sin(t * 0.7) * 0.05 + ((t * 0.43 % 1) < 0.06 ? Math.sin(t * 60) * 0.15 : 0); hair.rotation.x = Math.sin(t * 1.2) * 0.1; } };
  }
});

// --------------------------------------------------------------------------
// Rooms and furniture. Origin at the middle of the floor. +z is the south wall.
// --------------------------------------------------------------------------
Object.assign(CinemaKit.prototype, {
  // Use an asset-pack model when one is available, otherwise build the procedural fallback.
  prop(kind, fallback, rngSeed) {
    if (typeof Assets !== 'undefined' && Assets.has(kind)) { const o = Assets.clone(kind, new RNG('cine:' + (rngSeed || kind))); if (o) return o; }
    return fallback();
  },

  room(name, w, d, h, opts) {
    opts = opts || {};
    const g = new THREE.Group(), lab = this.lab, theme = CINE_THEMES[name], stone = !theme || opts.stoneFloor;
    const floorTex = lab.repeat(stone ? lab.stone() : lab.wood(), 'cine.' + name + '.floor', w / 3, d / 3);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
    const ceilTex = lab.repeat(stone ? lab.stone() : lab.plaster(), 'cine.' + name + '.ceil', w / 3, d / 3);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1 })); ce.rotation.x = Math.PI / 2; ce.position.y = h; g.add(ce);
    const base = theme ? lab.wall(name, theme) : lab.stone();
    const wall = (key, len, x, z, ry) => {
      if ((opts.omit || []).includes(key)) return;
      const t = lab.repeat(base, 'cine.' + name + '.' + key, len / 3, theme ? h / 3.4 : h / 3);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })); m.position.set(x, h / 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m);
    };
    wall('N', w, 0, -d / 2, 0); wall('S', w, 0, d / 2, Math.PI); wall('W', d, -w / 2, 0, Math.PI / 2); wall('E', d, w / 2, 0, -Math.PI / 2);
    return { group: g, w, d, h };
  },

  table(parent, x, z, w, d, h, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); if (parent) parent.add(g); h = h || 0.78; color = color || 0x3a2616;
    this.box(g, w, 0.06, d, color, 0, h, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => this.box(g, 0.07, h, 0.07, color, c[0] * (w / 2 - 0.07), h / 2, c[1] * (d / 2 - 0.07)));
    return g;
  },
  chair(parent, x, z, yaw, color) {
    const g = this.prop('chair', () => {
      const f = new THREE.Group(); color = color || 0x2a1a10;
      this.box(f, 0.46, 0.05, 0.46, color, 0, 0.46, 0); this.box(f, 0.46, 0.55, 0.05, color, 0, 0.75, -0.22);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => this.box(f, 0.05, 0.46, 0.05, color, c[0] * 0.2, 0.23, c[1] * 0.2)); return f;
    }, 'chair' + x + z);
    g.position.set(x, g.position.y, z); g.rotation.y = yaw || 0; if (parent) parent.add(g); return g;
  },
  armchair(parent, x, z, yaw, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw || 0; if (parent) parent.add(g); color = color || 0x4a1a1a;
    this.box(g, 0.9, 0.4, 0.85, color, 0, 0.3, 0); this.box(g, 0.9, 0.7, 0.2, color, 0, 0.75, -0.35); this.box(g, 0.18, 0.55, 0.85, color, -0.5, 0.5, 0); this.box(g, 0.18, 0.55, 0.85, color, 0.5, 0.5, 0);
    return g;
  },
  bed(parent, x, z, yaw) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw || 0; if (parent) parent.add(g);
    const wood = 0x1e140d; this.box(g, 1.7, 0.1, 2.3, wood, 0, 0.5, 0); this.box(g, 1.62, 0.2, 2.2, 0xcfd0d6, 0, 0.65, 0);
    this.box(g, 1.64, 0.1, 1.4, 0x2a2f40, 0, 0.78, 0.45); this.box(g, 0.7, 0.14, 0.4, 0xe8e6e0, 0, 0.8, -0.85); this.box(g, 1.8, 1.2, 0.1, wood, 0, 0.9, -1.2);
    [[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]].forEach(c => this.box(g, 0.08, 0.5, 0.08, wood, c[0], 0.25, c[1])); return g;
  },
  fireplace(parent, x, z, withLight) {
    const g = new THREE.Group(); g.position.set(x, 0, z); if (parent) parent.add(g); const st = 0x2b2623;
    this.box(g, 0.6, 2.4, 0.6, st, -1.4, 1.2, 0); this.box(g, 0.6, 2.4, 0.6, st, 1.4, 1.2, 0); this.box(g, 3.4, 0.5, 0.6, st, 0, 2.15, 0); this.box(g, 3.8, 0.12, 0.8, 0x24160d, 0, 2.45, 0.05);
    this.box(g, 2.2, 1.9, 0.1, 0x050302, 0, 0.95, -0.28);
    const flames = []; for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(Cache.geo('cine.fl' + i, () => new THREE.ConeGeometry(0.16 - i * 0.02, 0.7 + i * 0.1, 8)), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb347 : 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false })); f.position.set(-0.35 + i * 0.24, 0.45, -0.05); g.add(f); flames.push(f); }
    this.box(g, 1.1, 0.12, 0.14, 0x1a0f08, 0, 0.1, 0.0);
    const l = new THREE.PointLight(0xff6a1a, 2.4, 14, 2); l.position.set(0, 0.8, 0.5); g.add(l); g.add(this.sprite(0xff8a30, 3.2, 0.5, 0, 0.7, 0.2));
    return { group: g, light: l, power: 1, update(dt, t) { flames.forEach((f, i) => { f.scale.y = (0.85 + 0.3 * Math.sin(t * 9 + i * 2)) * this.power; f.visible = this.power > 0.05; }); l.intensity = 2.4 * this.power * (1 + Math.sin(t * 11) * 0.1 + Math.sin(t * 23) * 0.06); } };
  },
  bookshelf(parent, x, z, yaw, w) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw || 0; if (parent) parent.add(g); w = w || 2.2; const wood = 0x24160d, r = new RNG('shelf' + x + z), cols = [0x5a1a1a, 0x1d2f45, 0x2f4a2a, 0x4a3a1a, 0x2a1a3a, 0x3a1a1a];
    this.box(g, w, 2.6, 0.05, wood, 0, 1.3, -0.17); this.box(g, 0.05, 2.6, 0.38, wood, -w / 2, 1.3, 0); this.box(g, 0.05, 2.6, 0.38, wood, w / 2, 1.3, 0);
    for (let s = 0; s < 5; s++) {
      this.box(g, w, 0.04, 0.38, wood, 0, 0.1 + s * 0.6, 0);
      let px = -w / 2 + 0.1; while (px < w / 2 - 0.12) { const bw = 0.04 + r.next() * 0.05, bh = 0.28 + r.next() * 0.2; this.box(g, bw, bh, 0.24, cols[r.int(0, cols.length)], px + bw / 2, 0.12 + s * 0.6 + bh / 2, 0.0); px += bw + 0.01; }
    }
    return g;
  },
  crate(parent, x, z, s, yaw) {
    const g = this.prop('crate', () => { const f = new THREE.Group(); this.box(f, s, s, s, 0x4a3420, 0, s / 2, 0); [0.2, 0.8].forEach(k => this.box(f, s + 0.02, 0.05, s + 0.02, 0x2a1c10, 0, s * k, 0)); return f; }, 'crate' + x + z);
    g.position.set(x, g.position.y, z); g.rotation.y = yaw || 0; if (parent) parent.add(g); return g;
  },
  barrel(parent, x, z) {
    const g = this.prop('barrel', () => { const f = new THREE.Group(); this.cyl(f, 0.36, 0.32, 0.8, 0x3a2412, 0, 0.4, 0, 14); [0.15, 0.65].forEach(y => this.cyl(f, 0.375, 0.375, 0.04, 0x18181a, 0, y, 0, 14)); return f; }, 'barrel' + x + z);
    g.position.set(x, g.position.y, z); if (parent) parent.add(g); return g;
  },
  workbench(parent, x, z, yaw) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw || 0; if (parent) parent.add(g);
    this.box(g, 2.0, 0.08, 0.85, 0x2a1c10, 0, 0.92, 0); [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]].forEach(c => this.box(g, 0.08, 0.92, 0.08, 0x1c1208, c[0], 0.46, c[1])); this.box(g, 1.9, 0.06, 0.7, 0x1c1208, 0, 0.3, 0);
    return g;
  },
  altar(parent, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); if (parent) parent.add(g); const st = 0x34383c;
    this.box(g, 2.8, 0.2, 1.6, st, 0, 0.1, 0); this.box(g, 2.0, 0.8, 1.0, st, 0, 0.6, 0); this.box(g, 2.2, 0.12, 1.2, 0x3d4044, 0, 1.06, 0); return g;
  },
  rug(parent, x, z, w, d, name, color) {
    const tex = this.lab.repeat(this.lab.rug(name || 'cine', color || '#4a1a1a'), 'cine.rug.' + (name || 'x') + w, 1, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); m.receiveShadow = true; if (parent) parent.add(m); return m;
  },

  // A door in a frame on the XY plane facing +z. open 0..1 swings the slab about its hinge.
  door(parent, x, z, yaw, w, h) {
    w = w || 1.0; h = h || 2.2; const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw || 0; if (parent) parent.add(g);
    const frame = 0x1a110b; this.box(g, 0.14, h + 0.2, 0.22, frame, -w / 2 - 0.07, (h + 0.2) / 2, 0.05); this.box(g, 0.14, h + 0.2, 0.22, frame, w / 2 + 0.07, (h + 0.2) / 2, 0.05); this.box(g, w + 0.28, 0.16, 0.22, frame, 0, h + 0.08, 0.05);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x010101, fog: false })); dark.position.set(0, h / 2, -0.02); g.add(dark);
    const pivot = new THREE.Group(); pivot.position.set(-w / 2, 0, 0.04); g.add(pivot);
    const slab = this.box(pivot, w - 0.02, h, 0.08, new THREE.MeshStandardMaterial({ map: this.lab.door(), roughness: 0.75 }), w / 2, h / 2, 0);
    const knob = new THREE.Mesh(Cache.geo('cine.knob', () => new THREE.SphereGeometry(0.045, 8, 6)), this.cmat(0xb08a45, 0.3, 0.9)); knob.position.set(w - 0.12, 1.05, 0.07); pivot.add(knob);
    return { group: g, slab, open: 0, setOpen(v, dir) { this.open = v; pivot.rotation.y = -(dir === undefined ? 1 : dir) * v * 1.55; } };
  },

  // iron gate whose bars drop shut from above (0 = raised, 1 = closed)
  gateBars(parent, x, z, yaw, w, h) {
    w = w || 1.4; h = h || 2.6; const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw || 0; if (parent) parent.add(g);
    const st = 0x23262a; this.box(g, 0.4, h + 0.3, 0.34, st, -w / 2 - 0.2, (h + 0.3) / 2, 0); this.box(g, 0.4, h + 0.3, 0.34, st, w / 2 + 0.2, (h + 0.3) / 2, 0); this.box(g, w + 1.0, 0.5, 0.34, st, 0, h + 0.2, 0);
    const bars = new THREE.Group(); g.add(bars); const iron = this.cmat(0x16161a, 0.45, 0.85);
    for (let i = 0; i < 10; i++) this.cyl(bars, 0.022, 0.022, h, iron, -w / 2 + 0.07 + i * ((w - 0.14) / 9), h / 2, 0, 6);
    [0.3, h * 0.5, h - 0.2].forEach(y => this.box(bars, w, 0.05, 0.05, iron, 0, y, 0));
    return { group: g, drop: 0, setDrop(v) { this.drop = v; bars.position.y = (1 - v) * (h + 0.4); } };
  },

  windowFrame(parent, x, y, z, yaw, w, h, outside) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw || 0; if (parent) parent.add(g);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.lab.night(), fog: false })); pane.position.z = 0.02; g.add(pane);
    const f = 0x120d09; this.box(g, w + 0.2, 0.1, 0.12, f, 0, h / 2, 0.06); this.box(g, w + 0.2, 0.1, 0.12, f, 0, -h / 2, 0.06); this.box(g, 0.1, h, 0.12, f, -w / 2, 0, 0.06); this.box(g, 0.1, h, 0.12, f, w / 2, 0, 0.06); this.box(g, 0.06, h, 0.1, f, 0, 0, 0.05); this.box(g, w, 0.06, 0.1, f, 0, 0, 0.05);
    return { group: g, pane };
  }
});

Object.assign(CinemaKit.prototype, {
  // wrought iron fence along x at depth z, with a gap in the middle. One InstancedMesh for the bars.
  fence(x0, x1, z, gap, h) {
    h = h || 2.1; const g = new THREE.Group(), bars = [], step = 0.28;
    for (let x = x0; x <= x1; x += step) if (Math.abs(x) > gap / 2) bars.push(x);
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, h, 5), this.cmat(0x0b0b0e, 0.5, 0.8), bars.length), m4 = new THREE.Matrix4(), s = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion();
    bars.forEach((x, i) => { m4.compose(new THREE.Vector3(x, h / 2, z), q, s); im.setMatrixAt(i, m4); }); g.add(im);
    [0.35, h - 0.2].forEach(y => { [[x0, -gap / 2], [gap / 2, x1]].forEach(r => this.box(g, r[1] - r[0], 0.05, 0.05, 0x0b0b0e, (r[0] + r[1]) / 2, y, z)); });
    [-gap / 2 - 0.2, gap / 2 + 0.2].forEach(x => { this.box(g, 0.4, h + 0.7, 0.4, 0x1c1d20, x, (h + 0.7) / 2, z); });
    return g;
  }
});