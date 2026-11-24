'use strict';
// ==========================================================================
// WEAPONS: procedural models (bat, crowbar, flare gun, revolver, ammo, ritual
// offerings), the first-person viewmodel and combat.
// Nothing here can kill her. Hits stun, repel or disorient her, each hit makes
// the next one weaker for a while, and every swing or shot is a noise she hears.
// The viewmodel is drawn in a second pass after a depth clear, so it never
// sinks into walls. Flare and muzzle-flash lights are created once and only
// change intensity (no shader recompiles mid-game).
// ==========================================================================
const WeaponModels = {
  ids: new Set(['bat', 'crowbar', 'flaregun', 'pistol', 'flare_ammo', 'pistol_ammo', 'ritual_candle', 'ritual_salt', 'ritual_ribbon']),
  has(id) { return this.ids.has(id); },
  mat(key, make) { return Cache.mat('wpn:' + key, make); },
  canvas(key, w, h, draw) {
    return Cache.tex('wpn.tex:' + key, () => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  },
  speck(g, w, h, n, rgba) { for (let i = 0; i < n; i++) { g.fillStyle = rgba(Math.random()); const r = Math.random() * 2 + 0.4; g.fillRect(Math.random() * w, Math.random() * h, r, r); } },

  // worn pale wood, grime, dried blood toward the barrel, a scrawled word (lathe UV: u around, v along)
  batTex() {
    return this.canvas('bat', 128, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8c39a'); gr.addColorStop(0.6, '#c9b083'); gr.addColorStop(1, '#b89a6a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(90,60,30,' + (0.05 + Math.random() * 0.12) + ')'; g.lineWidth = 0.6 + Math.random(); const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.7, x + 3, h); g.stroke(); }
      this.speck(g, w, h, 900, r => 'rgba(40,28,16,' + r * 0.35 + ')');
      for (let i = 0; i < 9; i++) { const x = Math.random() * w, y = h * (0.05 + Math.random() * 0.4), r = 8 + Math.random() * 26, s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, 'rgba(110,14,10,0.75)'); s.addColorStop(1, 'rgba(110,14,10,0)'); g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.save(); g.translate(w * 0.5, h * 0.24); g.rotate(-Math.PI / 2); g.fillStyle = 'rgba(20,14,10,0.85)'; g.font = 'italic bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('SAMHAIN', 0, 10); g.restore();
    });
  },
  tapeTex() {
    return this.canvas('tape', 64, 128, (g, w, h) => {
      g.fillStyle = '#16161a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,120,130,0.35)'; g.lineWidth = 1;
      for (let y = -w; y < h + w; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + w * 0.5); g.stroke(); }
      this.speck(g, w, h, 160, r => 'rgba(200,200,210,' + r * 0.12 + ')');
    });
  },
  ironTex() {
    return this.canvas('iron', 64, 256, (g, w, h) => {
      g.fillStyle = '#2a2826'; g.fillRect(0, 0, w, h);
      this.speck(g, w, h, 1400, r => (r > 0.6 ? 'rgba(120,58,30,' : 'rgba(150,150,150,') + (0.2 + r * 0.3) + ')');
      for (let i = 0; i < 14; i++) { const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * 12, s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, 'rgba(110,52,24,0.6)'); s.addColorStop(1, 'rgba(110,52,24,0)'); g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2); }
    });
  },
  gripTex(base, line) {
    return this.canvas('grip' + base, 64, 64, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 1;
      for (let i = -w; i < w * 2; i += 5) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    });
  },
  steelTex() {
    return this.canvas('steel', 128, 64, (g, w, h) => {
      g.fillStyle = '#8c8e90'; g.fillRect(0, 0, w, h);
      this.speck(g, w, h, 1800, r => (r > 0.75 ? 'rgba(60,46,32,' : 'rgba(40,40,44,') + (0.15 + r * 0.35) + ')');
      for (let i = 0; i < 10; i++) { const x = Math.random() * w, y = Math.random() * h, r = 5 + Math.random() * 14, s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, 'rgba(70,52,34,0.55)'); s.addColorStop(1, 'rgba(70,52,34,0)'); g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2); }
    });
  },
  std(key, o) { return this.mat(key, () => new THREE.MeshStandardMaterial(o)); },

  // Every model is built in "hand" orientation: grip at the origin.
  //   bat / crowbar: the shaft runs along +Y
  //   guns: the barrel points along -Z, the grip hangs down
  build(id, g, mode) {
    const M = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = mode !== 'view'; (parent || inner).add(m); return m; };
    const inner = new THREE.Group(); g.add(inner);
    if (id === 'bat') {
      const prof = [[0.0, 0.0], [0.024, 0.0], [0.025, 0.012], [0.016, 0.02], [0.0135, 0.06], [0.0135, 0.26], [0.016, 0.34], [0.024, 0.48], [0.031, 0.6], [0.034, 0.72], [0.034, 0.8], [0.026, 0.825], [0.0, 0.83]];
      const geo = Cache.geo('wpn.bat', () => new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 18));
      M(geo, this.std('batwood', { map: this.batTex(), roughness: 0.78, metalness: 0 }));
      const tape = Cache.geo('wpn.battape', () => new THREE.CylinderGeometry(0.0158, 0.0158, 0.23, 16, 1, true));
      M(tape, this.std('battape', { map: this.tapeTex(), roughness: 0.9, metalness: 0, side: THREE.DoubleSide }), 0, 0.145, 0);
      M(Cache.geo('wpn.batknob', () => new THREE.CylinderGeometry(0.026, 0.024, 0.016, 18)), this.std('batknob', { color: 0xc4ab7c, roughness: 0.7 }), 0, 0.008, 0);
      if (mode !== 'view') { inner.rotation.z = Math.PI / 2; inner.position.set(0.4, 0.03, 0); g.scale.setScalar(0.85); }
    } else if (id === 'crowbar') {
      const pts = [[0.07, -0.33], [0.045, -0.36], [0.012, -0.345], [0, -0.3], [0, 0.3], [-0.006, 0.34], [-0.036, 0.365]].map(p => new THREE.Vector3(p[0], p[1] + 0.33, 0));
      const geo = Cache.geo('wpn.crow', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 64, 0.0115, 6, false));
      const iron = this.std('crowiron', { map: this.ironTex(), color: 0xc0b8b0, roughness: 0.55, metalness: 0.3 });
      M(geo, iron);
      const tip = Cache.geo('wpn.crowtip', () => { const t = new THREE.ConeGeometry(0.012, 0.035, 6); t.scale(1, 1, 0.35); return t; });
      M(tip, iron, 0.083, 0.0, 0, 0, 0, -2.2); M(tip, iron, -0.05, 0.7, 0, 0, 0, 1.25);
      if (mode !== 'view') { inner.rotation.z = Math.PI / 2; inner.position.set(0.33, 0.02, 0); }
    } else if (id === 'flaregun') {
      // over-saturated on purpose: the house's film grade (saturate 0.55, sepia) pulls it back to safety orange
      const orange = this.std('flareorange', { color: 0xff3800, roughness: 0.4, metalness: 0.1, emissive: 0x3a0800, emissiveIntensity: 0.6 }), dark = this.std('flaredark', { color: 0x1a1a1c, roughness: 0.6, metalness: 0.3 });
      const grip = this.std('flaregrip', { map: this.gripTex('#2a2420', '#151210'), roughness: 0.85 });
      M(Cache.geo('wpn.fbar', () => new THREE.CylinderGeometry(0.024, 0.024, 0.15, 20)), orange, 0, 0.055, -0.1, Math.PI / 2);
      M(Cache.geo('wpn.fmuz', () => new THREE.CylinderGeometry(0.02, 0.02, 0.152, 20, 1, true)), dark, 0, 0.055, -0.1, Math.PI / 2);
      M(Cache.geo('wpn.fgroove', () => new THREE.BoxGeometry(0.006, 0.004, 0.1)), dark, 0, 0.08, -0.1);
      M(Cache.geo('wpn.fring', () => new THREE.CylinderGeometry(0.026, 0.026, 0.012, 20)), orange, 0, 0.055, -0.02, Math.PI / 2);
      M(Cache.geo('wpn.fframe', () => new THREE.BoxGeometry(0.026, 0.05, 0.09)), orange, 0, 0.02, -0.035);
      M(Cache.geo('wpn.fbody', () => new THREE.BoxGeometry(0.03, 0.07, 0.05)), orange, 0, 0.0, 0.01, 0.3);
      M(Cache.geo('wpn.fgrip', () => new THREE.BoxGeometry(0.032, 0.11, 0.045)), grip, 0, -0.06, 0.03, 0.32);
      M(Cache.geo('wpn.fguard', () => new THREE.TorusGeometry(0.022, 0.004, 6, 14, Math.PI)), orange, 0, -0.012, -0.03, 0, Math.PI / 2, Math.PI);
      M(Cache.geo('wpn.ftrig', () => new THREE.BoxGeometry(0.006, 0.022, 0.006)), dark, 0, -0.012, -0.025, 0.35);
      M(Cache.geo('wpn.fham', () => new THREE.BoxGeometry(0.012, 0.03, 0.014)), dark, 0, 0.065, 0.03, -0.5);
      if (mode !== 'view') { inner.rotation.set(0, 0, Math.PI / 2); inner.position.y = 0.025; }
    } else if (id === 'pistol') {
      // no environment map in the house: keep metalness low so worn steel still catches the light
      const steel = this.std('revsteel', { map: this.steelTex(), color: 0xc8cacc, roughness: 0.42, metalness: 0.35 }), dark = this.std('revdark', { color: 0x3a3a3e, roughness: 0.5, metalness: 0.3 });
      const wood = this.std('revwood', { color: 0x4a2c18, roughness: 0.75 }), tape = this.std('revtape', { color: 0xd8cc3a, roughness: 0.7 });
      M(Cache.geo('wpn.rbar', () => new THREE.CylinderGeometry(0.0095, 0.0095, 0.12, 14)), steel, 0, 0.05, -0.115, Math.PI / 2);
      M(Cache.geo('wpn.rrib', () => new THREE.BoxGeometry(0.012, 0.01, 0.12)), steel, 0, 0.062, -0.115);
      M(Cache.geo('wpn.rrod', () => new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8)), steel, 0, 0.032, -0.1, Math.PI / 2);
      M(Cache.geo('wpn.rcyl', () => new THREE.CylinderGeometry(0.022, 0.022, 0.042, 12)), steel, 0, 0.04, -0.03, Math.PI / 2);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M(Cache.geo('wpn.rflute', () => new THREE.BoxGeometry(0.004, 0.004, 0.034)), dark, Math.cos(a) * 0.021, 0.04 + Math.sin(a) * 0.021, -0.03); }
      M(Cache.geo('wpn.rframe', () => new THREE.BoxGeometry(0.018, 0.05, 0.07)), steel, 0, 0.025, 0.012);
      M(Cache.geo('wpn.rham', () => new THREE.BoxGeometry(0.008, 0.024, 0.012)), dark, 0, 0.06, 0.045, -0.6);
      M(Cache.geo('wpn.rguard', () => new THREE.TorusGeometry(0.018, 0.0035, 6, 14, Math.PI)), steel, 0, -0.0, -0.005, 0, Math.PI / 2, Math.PI);
      M(Cache.geo('wpn.rtrig', () => new THREE.BoxGeometry(0.005, 0.018, 0.005)), dark, 0, -0.002, -0.002, 0.35);
      const gp = new THREE.Group(); gp.position.set(0, -0.012, 0.04); gp.rotation.x = 0.38; inner.add(gp);
      M(Cache.geo('wpn.rgrip', () => new THREE.BoxGeometry(0.026, 0.09, 0.034)), wood, 0, -0.04, 0, 0, 0, 0, gp);
      [-0.065, -0.045, -0.025].forEach(y => M(Cache.geo('wpn.rtape', () => new THREE.BoxGeometry(0.029, 0.014, 0.037)), tape, 0, y, 0, 0, 0, 0, gp));
      if (mode !== 'view') { inner.rotation.set(0, 0, Math.PI / 2); inner.position.y = 0.02; }
    } else if (id === 'flare_ammo') {
      const red = this.std('shellred', { color: 0xb8301e, roughness: 0.5 }), brass = this.std('shellbrass', { color: 0xc8a04a, roughness: 0.3, metalness: 0.9 });
      [[-0.025, 0], [0.025, 0.01]].forEach(p => { M(Cache.geo('wpn.shell', () => new THREE.CylinderGeometry(0.018, 0.018, 0.07, 14)), red, p[0], 0.035 + 0.008, p[1]); M(Cache.geo('wpn.shellb', () => new THREE.CylinderGeometry(0.02, 0.02, 0.016, 14)), brass, p[0], 0.008, p[1]); });
      g.userData.glow = 0xff6a3a;
    } else if (id === 'pistol_ammo') {
      M(Cache.geo('wpn.abox', () => new THREE.BoxGeometry(0.07, 0.035, 0.05)), this.std('ammobox', { color: 0x6a5a3a, roughness: 0.9 }), 0, 0.0175, 0);
      const brass = this.std('shellbrass', { color: 0xc8a04a, roughness: 0.3, metalness: 0.9 });
      [-0.012, 0.012].forEach(x => M(Cache.geo('wpn.bullet', () => new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 8)), brass, x, 0.05, 0));
      g.userData.glow = 0xffd080;
    } else if (id === 'ritual_candle') {
      M(Cache.geo('wpn.candle', () => new THREE.CylinderGeometry(0.022, 0.025, 0.16, 12)), this.std('blackwax', { color: 0x141012, roughness: 0.55 }), 0, 0.08, 0);
      M(Cache.geo('wpn.wick', () => new THREE.CylinderGeometry(0.002, 0.002, 0.015, 4)), this.std('wick', { color: 0x0a0a0a }), 0, 0.167, 0);
      g.userData.glow = 0x9a6aff;
    } else if (id === 'ritual_salt') {
      const p = M(Cache.geo('wpn.pouch', () => new THREE.SphereGeometry(0.05, 12, 10)), this.std('pouch', { color: 0x8a7a62, roughness: 1 }), 0, 0.045, 0); p.scale.set(1, 0.8, 1);
      M(Cache.geo('wpn.pouchtie', () => new THREE.CylinderGeometry(0.015, 0.025, 0.03, 10)), this.std('pouch', { color: 0x8a7a62, roughness: 1 }), 0, 0.09, 0);
      M(Cache.geo('wpn.salt', () => new THREE.SphereGeometry(0.016, 8, 6)), this.std('salt', { color: 0xeae6dc, roughness: 0.9 }), 0, 0.108, 0);
      g.userData.glow = 0x9a6aff;
    } else if (id === 'ritual_ribbon') {
      const pts = [[-0.08, 0, 0.01], [-0.04, 0.01, -0.03], [0, 0.004, 0.02], [0.04, 0.012, -0.02], [0.08, 0, 0.02]].map(p => new THREE.Vector3(p[0], p[1] + 0.01, p[2]));
      const geo = Cache.geo('wpn.ribbon', () => { const t = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4, false); t.scale(1, 0.35, 1); return t; });
      M(geo, this.std('ribbon', { color: 0x8a1a2a, roughness: 0.7 }));
      M(Cache.geo('wpn.bow', () => new THREE.TorusGeometry(0.016, 0.006, 4, 10)), this.std('ribbon', { color: 0x8a1a2a, roughness: 0.7 }), 0, 0.014, 0, Math.PI / 2);
      g.userData.glow = 0x9a6aff;
    }
    return g;
  },

  icon(id, x) {
    x.lineWidth = 3;
    if (id === 'bat') { x.strokeStyle = '#d8c39a'; x.lineWidth = 7; x.beginPath(); x.moveTo(20, 50); x.lineTo(48, 12); x.stroke(); x.strokeStyle = '#2a2a30'; x.lineWidth = 5; x.beginPath(); x.moveTo(14, 58); x.lineTo(24, 45); x.stroke(); x.fillStyle = '#8a1a14'; x.fillRect(42, 14, 6, 4); }
    else if (id === 'crowbar') { x.strokeStyle = '#8a8480'; x.lineWidth = 4; x.beginPath(); x.moveTo(10, 50); x.quadraticCurveTo(8, 58, 16, 58); x.moveTo(12, 50); x.lineTo(48, 10); x.quadraticCurveTo(54, 6, 56, 12); x.stroke(); }
    else if (id === 'flaregun') { x.fillStyle = '#d8541c'; x.fillRect(12, 18, 38, 12); x.beginPath(); x.moveTo(34, 28); x.lineTo(46, 28); x.lineTo(42, 54); x.lineTo(30, 54); x.closePath(); x.fill(); x.fillStyle = '#1a1a1c'; x.fillRect(32, 36, 9, 16); x.strokeStyle = '#1a1a1c'; x.lineWidth = 2; x.strokeRect(12, 21, 6, 6); }
    else if (id === 'pistol') { x.fillStyle = '#a8aaac'; x.fillRect(8, 20, 34, 7); x.fillRect(30, 18, 16, 14); x.beginPath(); x.moveTo(40, 30); x.lineTo(50, 30); x.lineTo(56, 54); x.lineTo(44, 54); x.closePath(); x.fill(); x.fillStyle = '#d8cc3a'; x.fillRect(45, 38, 9, 4); x.fillRect(46, 45, 9, 4); }
    else if (id === 'flare_ammo') { x.fillStyle = '#b8301e'; x.fillRect(18, 14, 12, 32); x.fillRect(36, 18, 12, 32); x.fillStyle = '#c8a04a'; x.fillRect(16, 44, 16, 8); x.fillRect(34, 48, 16, 8); }
    else if (id === 'pistol_ammo') { x.fillStyle = '#6a5a3a'; x.fillRect(12, 30, 40, 24); x.fillStyle = '#c8a04a'; [22, 32, 42].forEach(px => { x.fillRect(px - 3, 14, 6, 18); }); }
    else if (id === 'ritual_candle') { x.fillStyle = '#2a2428'; x.fillRect(24, 20, 16, 36); x.fillStyle = '#9a6aff'; x.beginPath(); x.ellipse(32, 12, 4, 7, 0, 0, 7); x.fill(); }
    else if (id === 'ritual_salt') { x.fillStyle = '#8a7a62'; x.beginPath(); x.ellipse(32, 40, 16, 14, 0, 0, 7); x.fill(); x.fillRect(27, 18, 10, 12); x.fillStyle = '#eae6dc'; x.beginPath(); x.arc(32, 16, 5, 0, 7); x.fill(); }
    else if (id === 'ritual_ribbon') { x.strokeStyle = '#b02a3a'; x.lineWidth = 5; x.beginPath(); x.moveTo(8, 40); x.bezierCurveTo(20, 20, 30, 56, 40, 34); x.bezierCurveTo(48, 20, 54, 40, 58, 30); x.stroke(); x.beginPath(); x.arc(32, 32, 6, 0, 7); x.stroke(); }
  }
};

// --------------------------------------------------------------------------
// Combat: viewmodel, attacks, ammunition, flares
// --------------------------------------------------------------------------
class Combat {
  constructor(game) {
    this.game = game;
    this.ammo = { flare: 0, pistol: 0 };
    this.cool = 0; this.anim = null; this.shown = null; this.models = {}; this.flares = []; this.time = 0;
    // viewmodel scene: its own three lights, never changed in count
    const vs = this.viewScene = new THREE.Scene();
    this.rig = new THREE.Group(); this.rig.matrixAutoUpdate = false; vs.add(this.rig);
    this.hand = new THREE.Group(); this.rig.add(this.hand);
    this.vAmb = new THREE.HemisphereLight(0x9a9080, 0x141210, 0.5); vs.add(this.vAmb);
    this.vKey = new THREE.DirectionalLight(0xfff0d8, 0.6); this.vKey.position.set(-1, 2, 1); this.rig.add(this.vKey); this.vKey.target.position.set(0.3, -0.3, -1); this.rig.add(this.vKey.target);
    this.vFill = new THREE.PointLight(0xffe2c0, 0.6, 3, 2); this.vFill.position.set(0.2, 0.1, 0.1); this.rig.add(this.vFill);
    // world effects: one flare light, one muzzle flash
    this.flareLight = new THREE.PointLight(0xff4a1a, 0, 12, 2); game.scene.add(this.flareLight);
    this.muzzle = new THREE.PointLight(0xffc070, 0, 9, 2); game.scene.add(this.muzzle);
    this.flareTex = Cache.tex('tex.flare', () => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.2, 'rgba(255,120,60,0.9)'); gr.addColorStop(1, 'rgba(255,40,10,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    });
  }
  get W() { return CONFIG.weapons; }
  get D() { return this.game.cfg.w || CONFIG.difficulties.normal.w; }
  reset() {
    this.ammo = { flare: 0, pistol: 0 }; this.cool = 0; this.anim = null;
    this.flares.forEach(f => { if (f.sprite.parent) f.sprite.parent.remove(f.sprite); f.sprite.material.dispose(); });
    this.flares = []; this.flareLight.intensity = 0; this.muzzle.intensity = 0;
  }
  ammoGain(def) { return Math.max(1, def.amount + this.D.ammoBonus); }
  addAmmo(type, n) { this.ammo[type] = (this.ammo[type] || 0) + Math.max(1, n + this.D.ammoBonus); this.game.audio.ammo(); this.game.inventory.emit('change'); }

  // a gun comes loaded the first time you pick it up; a fresh bat has its full durability
  onPickup(it) {
    if (it.def.kind !== 'weapon' || it.ready) return;
    it.ready = true;
    if (it.id === 'flaregun') this.ammo.flare += this.D.flareStart;
    if (it.id === 'pistol') this.ammo.pistol += this.D.pistolStart;
    if (it.id === 'bat') it.charges = this.D.batHits;
    this.game.audio.weaponPickup();
    this.game.inventory.emit('change');
    if (!this.tipShown) { this.tipShown = true; this.game.tweens.after(1.2, () => this.game.hud.toast('Weapons only buy time. She cannot be killed')); }
  }

  get current() { const it = this.game.inventory.current; return it && it.def.kind === 'weapon' ? it : null; }
  // left click attacks when a weapon is out and nothing interactable is under the reticle
  wantsAttack() { return !!this.current && !this.game.interact.focus && !this.game.hiding.active; }
  ready() { const g = this.game; return g.canAct() && !g.hiding.active && !g.isDead && !g.paused && !g.inputLocked && this.cool <= 0 && !this.anim; }

  attack() {
    const it = this.current; if (!it) return false;
    if (!this.ready()) return true;
    const w = it.def.weapon;
    if (w === 'bat' || w === 'crowbar') this.melee(it, w);
    else if (w === 'flaregun') this.fireFlare(it);
    else if (w === 'pistol') this.firePistol(it);
    return true;
  }

  // ---- hit tests -----------------------------------------------------------------------------
  ghostTarget() {
    const gh = this.game.ghost;
    if (!gh.inPlayerRoom() || gh.state === 'DORMANT' || gh.scripted || !gh.group.visible) return null;
    return gh;
  }
  fwd() { return TMP.v1.set(0, 0, -1).applyQuaternion(this.game.camera.quaternion).normalize(); }
  // closest approach of the view ray to her body (a vertical cylinder). Returns distance or -1.
  rayGhost(maxDist, radius) {
    const gh = this.ghostTarget(); if (!gh) return -1;
    const o = this.game.camera.position, d = this.fwd(), a = d.x * d.x + d.z * d.z;
    if (a < 1e-6) return -1;
    const s = ((gh.x - o.x) * d.x + (gh.z - o.z) * d.z) / a;
    if (s < 0 || s > maxDist) return -1;
    const px = o.x + d.x * s - gh.x, pz = o.z + d.z * s - gh.z, y = o.y + d.y * s - (gh.groundY || 0);
    if (Math.hypot(px, pz) > radius || y < 0.05 || y > 2.7) return -1;
    if (!this.game.room.lineClear(o.x, o.z, gh.x, gh.z, 0.1)) return -1;
    return s * Math.sqrt(a + d.y * d.y);
  }
  // melee: she is in reach, roughly in front of you, nothing between
  meleeHit(reach) {
    const gh = this.ghostTarget(); if (!gh) return false;
    const o = this.game.camera.position, d = this.fwd(), dx = gh.x - o.x, dz = gh.z - o.z, dist = Math.hypot(dx, dz);
    if (dist > reach + 0.35) return false;
    const fl = Math.hypot(d.x, d.z) || 1, dot = (dx * d.x + dz * d.z) / (dist * fl || 1);
    return dot > 0.62 && this.game.room.lineClear(o.x, o.z, gh.x, gh.z, 0.1);
  }

  // ---- melee: bat staggers, crowbar drives her back ---------------------------------------------
  melee(it, w) {
    const g = this.game, W = this.W[w], D = this.D, p = g.camera.position;
    this.anim = { kind: w, t: 0, dur: W.swing + W.recover };
    this.cool = W.cooldown;
    g.audio.whoosh(w === 'crowbar' ? 0.7 : 1);
    g.tweens.after(W.swing * 0.55, () => {
      if (g.isDead || !this.anim) return;
      g.makeNoise(p.x, p.z, g.currentRoom, W.noise, 'swing');
      if (!this.meleeHit(D.reach)) return;
      const gh = g.ghost, res = gh.weaponHit(w, w === 'bat' ? D.batStun : D.crowRepel);
      g.cameraShake(0.22);
      if (w === 'bat') {
        g.audio.batHit({ x: gh.x, y: 1.4, z: gh.z });
        if (res === true) { it.charges--; g.inventory.emit('change'); if (it.charges <= 0) { g.tweens.after(0.35, () => { g.inventory.removeItem(it); g.audio.splinter(); g.hud.toast('The bat splinters and breaks'); }); } }
      } else g.audio.crowbarHit({ x: gh.x, y: 1.4, z: gh.z });
      if (res === 'reeling') g.hud.toast('She is already reeling');
    });
  }

  // ---- flare gun: a burning flare that disorients her and lights the room -----------------------
  fireFlare(it) {
    const g = this.game, W = this.W.flaregun;
    if (!this.ammo.flare) { g.audio.dryFire(); g.hud.toast('No flares left'); this.cool = 0.4; return; }
    this.ammo.flare--; g.inventory.emit('change');
    this.anim = { kind: 'gun', t: 0, dur: 0.45, kick: 1.4 }; this.cool = W.cooldown;
    const cam = g.camera, f = this.fwd().clone(), p = cam.position.clone().addScaledVector(f, 0.55);
    p.y -= 0.12;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flareTex, color: 0xffb080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sprite.scale.setScalar(0.5); sprite.position.copy(p); g.room.group.add(sprite);
    this.flares.push({ sprite, pos: p, vel: f.multiplyScalar(W.speed).add(new THREE.Vector3(0, 1.4, 0)), t: 0, landed: false, room: g.currentRoom, hit: false });
    this.flash(0xff7040, 3.5);
    g.audio.flareFire(); g.makeNoise(cam.position.x, cam.position.z, g.currentRoom, W.noise, 'flare');
  }

  // ---- pistol: hitscan, stuns her; a miss is a dinner bell -------------------------------------
  firePistol(it) {
    const g = this.game, W = this.W.pistol, D = this.D, cam = g.camera;
    if (!this.ammo.pistol) { g.audio.dryFire(); g.hud.toast('Out of bullets'); this.cool = 0.4; return; }
    this.ammo.pistol--; g.inventory.emit('change');
    this.anim = { kind: 'gun', t: 0, dur: 0.32, kick: 1 }; this.cool = W.cooldown;
    this.flash(0xffc070, 5); g.audio.pistolFire(); g.cameraShake(0.18);
    const hit = this.rayGhost(W.range, W.radius + (D.aimBonus || 0)) >= 0;
    if (hit) {
      const gh = g.ghost, res = gh.weaponHit('pistol', D.pistolStun);
      g.audio.bulletHit({ x: gh.x, y: 1.5, z: gh.z });
      if (res === 'reeling') g.hud.toast('She is already reeling');
    } else g.hud.toast('Missed. She heard that');
    // gunfire carries through the whole house. If she is stunned she cannot hear it.
    g.makeNoise(cam.position.x, cam.position.z, g.currentRoom, W.noise, 'gunshot');
  }

  flash(color, k) {
    const g = this.game, f = this.fwd(), p = g.camera.position;
    this.muzzle.color.setHex(color); this.muzzle.position.set(p.x + f.x * 0.7, p.y - 0.1 + f.y * 0.7, p.z + f.z * 0.7); this.muzzleK = k;
  }
  // a burning flare (or the room bulb) makes this room bright for her
  flareLit(roomId) { return this.flares.some(f => f.room === roomId && f.t < this.W.flaregun.burn); }

  // ---- per frame ---------------------------------------------------------------------------------
  update(dt) {
    const g = this.game, W = this.W.flaregun, D = this.D, gh = g.ghost; this.time += dt;
    if (this.cool > 0) this.cool -= dt;
    // muzzle flash fades fast
    if (this.muzzleK > 0) { this.muzzleK = Math.max(0, this.muzzleK - dt * 30); this.muzzle.intensity = this.muzzleK; } else this.muzzle.intensity = 0;
    // flares: fly, bounce, burn, disorient her if she comes close
    let lightF = null;
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i], room = g.world.rooms[f.room];
      f.t += dt;
      if (f.room !== g.currentRoom || f.t > W.burn || !room) {
        if (f.sprite.parent) f.sprite.parent.remove(f.sprite); f.sprite.material.dispose(); this.flares.splice(i, 1); continue;
      }
      if (!f.landed) {
        f.vel.y -= 9.8 * 0.45 * dt;
        const nx = f.pos.x + f.vel.x * dt, nz = f.pos.z + f.vel.z * dt;
        if (room.blocked(nx, nz, 0.06)) { f.vel.x *= -0.25; f.vel.z *= -0.25; } else { f.pos.x = nx; f.pos.z = nz; }
        f.pos.y += f.vel.y * dt;
        if (f.pos.y > room.H - 0.1) { f.pos.y = room.H - 0.1; f.vel.y = -Math.abs(f.vel.y) * 0.3; }
        if (f.pos.y <= 0.05) { f.pos.y = 0.05; if (Math.abs(f.vel.y) > 2) { f.vel.y = Math.abs(f.vel.y) * 0.25; f.vel.x *= 0.5; f.vel.z *= 0.5; g.audio.land(0.4, { x: f.pos.x, y: 0.1, z: f.pos.z }); } else f.landed = true; }
        // a direct hit
        if (!f.hit && gh.inPlayerRoom() && gh.state !== 'DORMANT' && !gh.scripted && dist2D(f.pos.x, f.pos.z, gh.x, gh.z) < 0.6 && f.pos.y < 2.5) { f.hit = true; this.flareHits(f); }
      }
      // burning: she cannot bear it close by
      if (!f.hit && gh.inPlayerRoom() && gh.state !== 'DORMANT' && !gh.scripted && dist2D(f.pos.x, f.pos.z, gh.x, gh.z) < W.radius && room.lineClear(f.pos.x, f.pos.z, gh.x, gh.z, 0.05)) { f.hit = true; this.flareHits(f); }
      if (gh.inPlayerRoom() && dist2D(f.pos.x, f.pos.z, gh.x, gh.z) < 7) gh.revealT = 0.3;
      const flick = 0.85 + Math.sin(f.t * 41) * 0.08 + Math.sin(f.t * 17.3) * 0.07, fade = clamp((W.burn - f.t) / 2, 0, 1);
      f.sprite.position.copy(f.pos); f.sprite.scale.setScalar((f.landed ? 0.55 : 0.4) * flick);
      f.sprite.material.opacity = fade; f.k = flick * fade;
      lightF = f;
    }
    if (lightF) { this.flareLight.position.set(lightF.pos.x, lightF.pos.y + 0.15, lightF.pos.z); this.flareLight.intensity = 3.4 * lightF.k; }
    else this.flareLight.intensity = 0;
    this.updateView(dt);
  }
  flareHits(f) {
    const g = this.game, gh = g.ghost, res = gh.weaponHit('flare', this.D.flareRepel);
    if (res === true) g.hud.toast('The flare blinds her. She backs away');
    g.audio.flareHiss({ x: f.pos.x, y: 1, z: f.pos.z });
  }

  // ---- viewmodel -------------------------------------------------------------------------------
  model(id) {
    if (!this.models[id]) { const g = new THREE.Group(); WeaponModels.build(id, g, 'view'); g.visible = false; this.hand.add(g); this.models[id] = g; }
    return this.models[id];
  }
  visibleNow() {
    const g = this.game, it = this.current;
    return it && g.isPlaying && !g.isDead && !g.hiding.active && !g.cinema.active && !(g.inputLocked && !this.anim) ? it : null;
  }
  updateView(dt) {
    const g = this.game, it = this.visibleNow(), id = it ? it.id : null;
    if (id !== this.shown) { Object.values(this.models).forEach(m => { m.visible = false; }); if (id) { this.model(id).visible = true; this.raise = 0; } this.shown = id; }
    if (!id) { this.anim = null; return; }
    const t = this.time, moving = g.isSprinting ? 1.6 : (g.keys.KeyW || g.keys.KeyS || g.keys.KeyA || g.keys.KeyD) ? 1 : 0;
    this.raise = Math.min(1, (this.raise || 0) + dt * 4);
    const bob = Math.sin(t * (moving > 1 ? 13 : 8.5)) * 0.008 * moving, bobX = Math.cos(t * (moving > 1 ? 6.5 : 4.25)) * 0.006 * moving;
    const h = this.hand, w = it.def.weapon, lower = (1 - Ease.outCubic(this.raise)) * 0.25;
    let px, py, pz, rx, ry, rz;
    // melee: held low on the right, head leaning away over the shoulder line
    if (w === 'bat') { px = 0.3; py = -0.42; pz = -0.5; rx = -0.15; ry = 0.15; rz = 0.55; }
    else if (w === 'crowbar') { px = 0.28; py = -0.4; pz = -0.48; rx = -0.2; ry = 0.2; rz = 0.5; }
    // guns: low and to the right, turned so their side shows like a held sidearm
    else if (w === 'flaregun') { px = 0.2; py = -0.19; pz = -0.42; rx = 0.06; ry = 0.5; rz = -0.06; }
    else { px = 0.2; py = -0.18; pz = -0.4; rx = 0.06; ry = 0.55; rz = -0.06; }
    const a = this.anim;
    if (a) {
      a.t += dt; const W = this.W[a.kind === 'gun' ? 'pistol' : a.kind], u = clamp(a.t / a.dur, 0, 1);
      if (a.kind === 'gun') { const k = Math.exp(-u * 9) * (1 - u) * a.kick; rx += k * 0.55; pz += k * 0.08; py += k * 0.03; }
      else {
        const sw = (W.swing || 0.3) / a.dur;        // portion of the animation that is the strike
        if (u < sw * 0.35) { const v = Ease.outCubic(u / (sw * 0.35)); rz += v * 0.55; rx += v * 0.25; px += v * 0.06; py += v * 0.06; }
        else if (u < sw) { const v = Ease.inCubic((u - sw * 0.35) / (sw * 0.65)); rz += 0.55 - v * 2.3; rx += 0.25 - v * 1.1; px += 0.06 - v * 0.42; py += 0.06 - v * 0.08; pz -= v * 0.12; }
        else { const v = Ease.inOutCubic((u - sw) / (1 - sw)); rz += -1.75 * (1 - v); rx += -0.85 * (1 - v); px += -0.36 * (1 - v); py += -0.02 * (1 - v); pz -= 0.12 * (1 - v); }
      }
      if (a.t >= a.dur) this.anim = null;
    }
    h.position.set(px + bobX, py + bob - lower, pz); h.rotation.set(rx, ry, rz);
    // light the weapon roughly like the room around it
    const lit = g.power && g.power.isLit(g.currentRoom);
    this.vAmb.intensity = 0.18 + (lit ? 0.5 : 0) + (g.room ? g.room.lightLevel * 0.25 : 0);
    this.vFill.intensity = g.flashlightOn && g.battery > 0 ? 0.7 : 0.12;
    this.vKey.intensity = lit ? 0.7 : 0.25;
  }
  renderView(renderer, camera) {
    if (!this.shown) return;
    this.rig.matrix.copy(camera.matrixWorld); this.rig.updateMatrixWorld(true);
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth();
    renderer.render(this.viewScene, camera);
    renderer.autoClear = ac;
  }
}
