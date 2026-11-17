'use strict';
// ==========================================================================
// GHOST: procedural model (translucent shroud shader, cracked porcelain face,
// unhinging jaw, matted hair, long fingers) and animation.
// AI lives in ghost-ai.js (mixed into Ghost.prototype).
// ==========================================================================
class Ghost {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();           // world position + yaw
    this.rig = new THREE.Group();             // pose (lean / crawl / float)
    this.group.add(this.rig);
    this.mats = [];                           // basic materials driven by opacity
    this.time = 0;
    // pose targets (smoothed in animate)
    this.P = { jaw: 0, arms: 0, headTilt: 0, headYaw: 0, crawl: 0, lean: 0, scream: 0, stopMotion: 0 };
    this.p = { jaw: 0, arms: 0, headTilt: 0, headYaw: 0, crawl: 0, lean: 0, scream: 0 };
    this.form = 0; this.formTarget = 0;       // 0 silhouette, 1 half, 2 solid
    this.dissolve = 0;
    this.eyeColor = new THREE.Color(0xa8e8ff);
    this.buildModel();
    game.scene.add(this.group);
    this.group.visible = false;
    this.initAI();
  }

  buildModel() {
    const rig = this.rig, mats = this.mats, skin = 0xc4cdd4;
    const basic = (color, opacity) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity === undefined ? 1 : opacity, depthWrite: false, fog: true }); m.userData.base = opacity === undefined ? 1 : opacity; mats.push(m); return m; };
    // --- shroud: vertex-displaced tattered cloth ---
    const shroudGeo = Cache.geo('ghost.shroud', () => { const g = new THREE.CylinderGeometry(0.2, 0.8, 2.05, 22, 16, true); g.translate(0, 1.02, 0); return g; });
    this.shroudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, opacity: { value: 0.5 }, color: { value: new THREE.Color(0x9aa6b4) }, rim: { value: new THREE.Color(0x70c8ff) }, dissolve: { value: 0 }, flow: { value: 1 } }]),
      vertexShader: [
        'uniform float time; uniform float flow; varying vec3 vN; varying vec3 vV; varying vec3 vPos;',
        '#include <fog_pars_vertex>',
        'void main(){ vec3 p = position; float k = 1.0 - clamp(p.y / 2.0, 0.0, 1.0); float ang = atan(p.z, p.x);',
        ' p.x += sin(time*2.0 + p.y*3.0 + ang*3.0) * 0.08 * k * flow; p.z += cos(time*1.7 + p.y*2.5 + ang*2.0) * 0.08 * k * flow;',
        ' p.y += sin(ang*5.0 + time*3.0) * 0.07 * k * k; vPos = p;',
        ' vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);',
        ' gl_Position = projectionMatrix * mvPosition;',
        '#include <fog_vertex>', '}'].join('\n'),
      fragmentShader: [
        'uniform float opacity; uniform vec3 color; uniform vec3 rim; uniform float dissolve; uniform float time; varying vec3 vN; varying vec3 vV; varying vec3 vPos;',
        '#include <fog_pars_fragment>',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
        'void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float n = hash(floor(vPos.xz*16.0 + vPos.y*11.0));',
        ' if (n < dissolve) discard; float rag = smoothstep(0.0, 0.5, vPos.y + sin(atan(vPos.z, vPos.x)*7.0)*0.12);',
        ' float a = opacity * (0.3 + f*0.9) * rag * (0.88 + 0.12*sin(time*31.0 + vPos.y*5.0));',
        ' gl_FragColor = vec4(color + rim * f * 0.9, a);',
        '#include <fog_fragment>', '}'].join('\n')
    });
    const shroud = new THREE.Mesh(shroudGeo, this.shroudMat); shroud.frustumCulled = false; rig.add(shroud); this.shroud = shroud;

    // --- head: porcelain skull with a painted, cracked face plane ---
    this.head = new THREE.Group(); this.head.position.set(0, 2.18, 0.02); rig.add(this.head);
    const sk = new THREE.Mesh(Cache.geo('ghost.skull', () => new THREE.SphereGeometry(0.17, 16, 14)), basic(0xd6d8d0, 1)); sk.scale.set(0.9, 1.25, 0.95); this.head.add(sk);
    const faceTex = Cache.tex('tex.ghostface', () => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
      g.fillStyle = '#d9dbd2'; g.beginPath(); g.ellipse(64, 96, 54, 88, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,40,40,0.7)'; g.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) { let x = 30 + Math.random() * 70, y = 20 + Math.random() * 40; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 18; y += 8 + Math.random() * 14; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = '#050505'; g.beginPath(); g.ellipse(40, 78, 15, 22, 0.15, 0, 7); g.ellipse(88, 78, 15, 22, -0.15, 0, 7); g.fill();
      g.beginPath(); g.moveTo(64, 98); g.lineTo(58, 120); g.lineTo(70, 120); g.fill();
      g.fillStyle = '#1a0a0a'; g.beginPath(); g.ellipse(64, 150, 24, 8, 0, 0, 7); g.fill();
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    });
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, fog: true }); faceMat.userData.base = 1; mats.push(faceMat);
    const face = new THREE.Mesh(Cache.geo('ghost.face', () => new THREE.PlaneGeometry(0.3, 0.45)), faceMat); face.position.set(0, -0.01, 0.15); this.head.add(face);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: this.eyeColor, fog: false });
    const eg = Cache.geo('ghost.eye', () => new THREE.CircleGeometry(0.028, 10));
    [-1, 1].forEach(s => { const e = new THREE.Mesh(eg, this.eyeMat); e.position.set(s * 0.063, 0.045, 0.153); this.head.add(e); });
    // jaw that can unhinge
    this.jawPivot = new THREE.Group(); this.jawPivot.position.set(0, -0.15, 0.04); this.head.add(this.jawPivot);
    this.jaw = new THREE.Mesh(Cache.geo('ghost.jaw', () => new THREE.BoxGeometry(0.15, 0.1, 0.13)), basic(0xcfd2c8, 1)); this.jaw.position.set(0, -0.04, 0.03); this.jawPivot.add(this.jaw);
    const mouth = new THREE.Mesh(Cache.geo('ghost.mouth', () => new THREE.PlaneGeometry(0.14, 0.09)), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })); mouth.position.set(0, 0.06, 0.1); this.jawPivot.add(mouth); this.mouth = mouth;
    // hair: matted strips that sway
    this.hair = [];
    const hairGeo = Cache.geo('ghost.hair', () => { const g = new THREE.PlaneGeometry(0.055, 1.1, 1, 6); g.translate(0, -0.55, 0); return g; });
    const hairMat = new THREE.MeshBasicMaterial({ color: 0x060608, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false, fog: true }); hairMat.userData.base = 0.95; mats.push(hairMat);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, h = new THREE.Mesh(hairGeo, hairMat);
      h.position.set(Math.cos(a) * 0.14, 0.14 - Math.abs(Math.sin(a)) * 0.04, Math.sin(a) * 0.12 - 0.02); h.rotation.set(0, -a + Math.PI / 2, 0); h.userData.ph = Math.random() * 6; h.scale.y = 0.7 + Math.random() * 0.6;
      this.head.add(h); this.hair.push(h);
    }
    // --- arms: two long segments, long fingers ---
    this.arms = [];
    const armMat = basic(skin, 0.9), fingerGeo = Cache.geo('ghost.fin', () => { const g = new THREE.CylinderGeometry(0.006, 0.01, 0.32, 5); g.translate(0, -0.16, 0); return g; });
    const upG = Cache.geo('ghost.up', () => { const g = new THREE.CylinderGeometry(0.03, 0.022, 0.8, 6); g.translate(0, -0.4, 0); return g; });
    const loG = Cache.geo('ghost.lo', () => { const g = new THREE.CylinderGeometry(0.022, 0.014, 0.85, 6); g.translate(0, -0.425, 0); return g; });
    [-1, 1].forEach(s => {
      const sh = new THREE.Group(); sh.position.set(s * 0.26, 1.88, 0.02); rig.add(sh);
      sh.add(new THREE.Mesh(upG, armMat));
      const el = new THREE.Group(); el.position.y = -0.8; sh.add(el); el.add(new THREE.Mesh(loG, armMat));
      const hand = new THREE.Group(); hand.position.y = -0.85; el.add(hand);
      const fingers = [];
      for (let f = 0; f < 5; f++) { const fg = new THREE.Group(); fg.position.set((f - 2) * 0.016, 0, 0); fg.rotation.z = (f - 2) * 0.12; fg.add(new THREE.Mesh(fingerGeo, armMat)); hand.add(fg); fingers.push(fg); }
      this.arms.push({ sh, el, hand, fingers, s });
    });
    // faint cold light that follows the ghost (constant light count: intensity only)
    this.light = new THREE.PointLight(0x70b8ff, 0, 6, 2); this.light.position.set(0, 1.6, 0.3); this.group.add(this.light);
  }

  // ---- visibility ------------------------------------------------------------
  setLayers(layer) { this.group.traverse(o => { o.layers.set(layer); }); }

  get alpha() { return [0.28, 0.58, 0.92][0] + (this.form <= 1 ? this.form * 0.3 : 0.3 + (this.form - 1) * 0.34); }

  applyOpacity() {
    const a = clamp(this.alpha * (1 - this.dissolve * 0.5), 0, 1);
    this.shroudMat.uniforms.opacity.value = a * 0.85;
    this.shroudMat.uniforms.dissolve.value = this.dissolve;
    this.mats.forEach(m => { m.opacity = clamp(m.userData.base * a * (this.form < 0.5 ? 0.6 : 1), 0, 1); });
    // eyes stay readable at every form so a silhouette still watches you
    this.eyeMat.color.copy(this.eyeColor).multiplyScalar(0.55 + Math.min(1, this.form) * 0.6);
    this.light.intensity = (this.group.visible ? 1 : 0) * Math.max(0, this.form - 0.4) * 0.9 * (1 - this.dissolve);
  }

  // ---- animation ---------------------------------------------------------------
  animate(dt) {
    this.time += dt;
    const t = this.time, P = this.P, p = this.p;
    this.form = damp(this.form, this.formTarget, 3.2, dt);
    for (const k in p) p[k] = damp(p[k], P[k], k === 'scream' ? 18 : 7, dt);
    this.shroudMat.uniforms.time.value = t;
    this.shroudMat.uniforms.flow.value = 1 + p.scream * 0.8 + (this.state === 'HUNT' ? 0.8 : 0);
    // float and sway; crawl rotates the whole rig to horizontal
    const hunting = this.state === 'HUNT' && this.sees;
    const snap = hunting ? Math.floor(t * 12) % 2 : 0;       // stop-motion jitter while it can see you
    this.rig.position.y = 0.18 + Math.sin(t * 1.3) * 0.05 + p.crawl * 0.5 + (snap ? 0.015 : 0);
    this.rig.rotation.z = Math.sin(t * 0.8) * 0.05 + (snap ? 0.04 : 0);
    this.rig.rotation.x = p.lean * 0.35 - p.crawl * 1.45;
    // head
    this.head.rotation.z = p.headTilt + Math.sin(t * 0.6) * 0.06;
    this.head.rotation.y = p.headYaw;
    this.head.rotation.x = -p.scream * 0.35 + p.crawl * 1.6;
    this.jawPivot.rotation.x = p.jaw * 0.95 + p.scream * 0.5;
    this.jaw.scale.y = 1 + p.jaw * 1.4 + p.scream * 0.8; this.jaw.position.y = -0.04 - p.jaw * 0.07;
    this.mouth.scale.y = 1 + p.jaw * 2.2;
    this.hair.forEach(h => { const w = Math.sin(t * 1.4 + h.userData.ph); h.rotation.x = w * 0.15 + p.scream * 0.4; h.rotation.z = Math.cos(t * 1.1 + h.userData.ph) * 0.1; });
    // arms hang, sway, then reach forward when raised
    this.arms.forEach(a => {
      const idle = Math.sin(t * 1.1 + a.s) * 0.05, reach = p.arms, j = snap ? 0.06 : 0;
      a.sh.rotation.x = -reach * 1.5 + idle + j; a.sh.rotation.z = a.s * (0.1 + p.scream * 0.9 + (1 - reach) * 0.06);
      a.el.rotation.x = -reach * 0.35 - 0.1;
      a.fingers.forEach((f, i) => { f.rotation.x = -0.25 - Math.sin(t * 2 + i) * 0.12 - reach * 0.5; });
    });
    this.applyOpacity();
  }

  // Cheap helper for scripted scares
  place(x, z, yaw, y) { this.x = x; this.z = z; this.group.position.set(x, y || 0, z); this.yaw = yaw; this.group.rotation.y = yaw; }
  lookAtPoint(v) { const dx = v.x - this.x, dz = v.z - this.z; this.yaw = Math.atan2(dx, dz); }
  setPose(o) { Object.assign(this.P, { jaw: 0, arms: 0, headTilt: 0, headYaw: 0, crawl: 0, lean: 0, scream: 0 }, o || {}); }
}
