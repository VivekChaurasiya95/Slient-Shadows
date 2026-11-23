'use strict';
// ==========================================================================
// PUPPETS: low-poly humanoid rigs built from primitives, driven by named poses.
// Hierarchy: root > hips > chest > (head, shoulderL > elbowL, shoulderR > elbowR)
//                      hips > (hipL > kneeL, hipR > kneeR)
// Every joint eases toward its pose target, so poses blend instead of snapping.
// A walk cycle is layered on top automatically whenever the root is moving.
// ==========================================================================
const PUPPET_STYLES = {
  rowan:  { skin: 0xd6b8a0, coat: 0x4a5a46, pants: 0x26282c, hair: 0x2b1c12, hairStyle: 'short', pack: true, bodycam: true, boots: 0x15130f },
  dacre:  { skin: 0xc9ab94, coat: 0x15151a, pants: 0x101014, hair: 0x0c0c0e, hairStyle: 'slick', tie: 0x6a1010, shirt: 0xd8d8d8 },
  josiah: { skin: 0xcfae96, coat: 0x1d1c24, pants: 0x141319, hair: 0x4a4640, hairStyle: 'short', beard: 0x4a4640, longCoat: true, shirt: 0xcfcfc4 },
  venn:   { skin: 0xd4b49a, coat: 0x3a3326, pants: 0x221f19, hair: 0x8a8478, hairStyle: 'short', hat: 0x17151a, longCoat: true, bag: true },
  margaret: { skin: 0xe0c4b0, coat: 0x6a5470, pants: 0x6a5470, hair: 0x4a2a1a, hairStyle: 'bun', dress: true },
  elspeth:  { skin: 0xe4c8b4, coat: 0xe6e2da, pants: 0xe6e2da, hair: 0x3a2214, hairStyle: 'long', dress: true, scale: 0.94 },
  thomas:   { skin: 0xe0c4ae, coat: 0x4a5a7a, pants: 0x2a2c36, hair: 0x5a3a20, hairStyle: 'short', scale: 0.7 },
  pell:     { skin: 0xd8bca6, coat: 0x3a4a44, pants: 0x3a4a44, hair: 0x9a948a, hairStyle: 'bun', dress: true, apron: 0xe0dccc, scale: 0.97 }
};

// Joint targets for each pose. Anything omitted falls back to the neutral stand.
const PUPPET_POSES = {
  stand:   {},
  sit:     { hipsY: 0.5, llx: -1.5, llk: 1.5, rlx: -1.5, rlk: 1.5, chestX: 0.04, lax: -0.35, lex: -0.9, rax: -0.35, rex: -0.9 },
  sitSlump:{ hipsY: 0.5, llx: -1.5, llk: 1.5, rlx: -1.5, rlk: 1.5, chestX: 0.45, headX: 0.5, lax: 0.1, lex: -0.2, rax: 0.1, rex: -0.2 },
  kneel:   { hipsY: 0.46, llx: -0.2, llk: 2.5, rlx: -0.2, rlk: 2.5, chestX: 0.2, lax: -0.6, lex: -0.7, rax: -0.6, rex: -0.7 },
  kneelCry:{ hipsY: 0.46, llx: -0.2, llk: 2.5, rlx: -0.2, rlk: 2.5, chestX: 0.55, headX: 0.55, lax: -1.3, lex: -2.1, rax: -1.3, rex: -2.1 },
  lie:     { rootRX: -Math.PI / 2, lax: 0.12, rax: 0.12, lex: -0.05, rex: -0.05 },        // root sits at the feet, head toward -z
  arms:    { lax: -1.55, rax: -1.55, lex: -0.15, rex: -0.15 },            // both arms forward (sleepwalk, reaching)
  raise:   { lax: -2.9, rax: -2.9, lex: -0.1, rex: -0.1 },
  hold:    { rax: -1.45, rex: -0.12, lax: 0.1, lex: -0.2 },                // flashlight / radio in the right hand
  radio:   { rax: -2.2, rex: -2.0, lax: 0.1, lex: -0.15, headZ: -0.1 },    // handset up at the ear
  point:   { rax: -1.55, rex: 0.0, raz: -0.2, lax: 0.1, headY: 0.0 },
  pray:    { lax: -1.0, lex: -1.7, rax: -1.0, rex: -1.7, headX: 0.35, chestX: 0.12 },
  cower:   { hipsY: 0.62, llx: -0.5, llk: 0.9, rlx: -0.5, rlk: 0.9, chestX: 0.6, headX: 0.35, lax: -1.9, lex: -2.2, rax: -1.9, rex: -2.2 },
  cradle:  { lax: -0.9, lex: -1.5, rax: -0.9, rex: -1.5, headX: 0.25 },
  wipe:    { rax: -2.4, rex: -1.9, lax: 0.1, headX: 0.2, chestX: 0.15 },
  work:    { lax: -1.0, lex: -0.9, rax: -1.1, rex: -0.9, chestX: 0.25, headX: 0.3 },       // bent over a table
  knock:   { lax: -1.5, lex: -0.4, rax: -1.5, rex: -0.4, chestX: 0.1 },
  clutch:  { lax: -1.1, lex: -2.0, rax: -0.2, rex: -0.4, chestX: 0.3, headX: 0.3 }
};

class Puppet {
  constructor(styleName, opts) {
    opts = opts || {};
    const S = this.style = PUPPET_STYLES[styleName] || PUPPET_STYLES.rowan;
    this.name = styleName;
    this.root = new THREE.Group(); this.root.name = 'puppet:' + styleName;
    this.pivot = new THREE.Group(); this.root.add(this.pivot);
    this.pose = {}; this.target = {}; this.setPose('stand', true);
    this.t = Math.random() * 10; this.walkPhase = 0; this.walkAmt = 0; this.speed = 0;
    this.lastX = null; this.lastZ = null; this.autoWalk = true; this.autoFace = false; this.talking = 0; this.blinkT = 2 + Math.random() * 3;
    this.look = null; this.lookAmt = 0; this.headBase = 0; this.mouthOpen = 0; this.grounded = true;
    this.scaleBase = (S.scale || 1) * (opts.scale || 1);
    this.root.scale.setScalar(this.scaleBase);
    this.build();
  }

  mat(color, rough) { return Cache.mat('pup:' + color + ':' + (rough || 0.9), () => new THREE.MeshStandardMaterial({ color, roughness: rough || 0.9, metalness: 0.02, flatShading: true })); }
  box(w, h, d, color, x, y, z, parent) {
    const m = new THREE.Mesh(Cache.geo('pbox:' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), this.mat(color));
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; (parent || this.pivot).add(m); return m;
  }
  cyl(r1, r2, h, color, x, y, z, parent, seg) {
    const m = new THREE.Mesh(Cache.geo('pcyl:' + r1 + ',' + r2 + ',' + h + ',' + (seg || 8), () => new THREE.CylinderGeometry(r1, r2, h, seg || 8)), this.mat(color));
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; (parent || this.pivot).add(m); return m;
  }
  sph(r, color, x, y, z, parent, sx, sy, sz) {
    const m = new THREE.Mesh(Cache.geo('psph:' + r, () => new THREE.SphereGeometry(r, 10, 8)), this.mat(color));
    m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx || 1, sy || 1, sz || 1); m.castShadow = true; (parent || this.pivot).add(m); return m;
  }

  build() {
    const S = this.style, boots = S.boots || 0x1a1612;
    this.hips = new THREE.Group(); this.pivot.add(this.hips);
    this.chest = new THREE.Group(); this.chest.position.y = 0.1; this.hips.add(this.chest);
    // torso (coat) and pelvis
    this.box(0.4, 0.2, 0.24, S.pants, 0, 0.0, 0, this.hips);
    const torsoH = S.longCoat ? 0.62 : 0.52;
    this.box(0.42, torsoH, 0.25, S.coat, 0, torsoH / 2 - 0.02, 0, this.chest);
    if (S.shirt) { this.box(0.14, 0.22, 0.02, S.shirt, 0, 0.36, 0.13, this.chest); }
    if (S.tie) this.box(0.045, 0.2, 0.02, S.tie, 0, 0.32, 0.145, this.chest);
    if (S.apron) this.box(0.34, 0.5, 0.03, S.apron, 0, 0.08, 0.14, this.chest);
    if (S.pack) this.box(0.3, 0.38, 0.16, 0x2a2e2a, 0, 0.22, -0.2, this.chest);
    if (S.bag) this.box(0.26, 0.2, 0.1, 0x2a1a10, 0.3, -0.15, 0.05, this.chest);
    if (S.bodycam) {
      this.box(0.1, 0.07, 0.05, 0x111111, 0.1, 0.38, 0.15, this.chest);
      this.led = new THREE.Mesh(Cache.geo('pled', () => new THREE.SphereGeometry(0.014, 6, 6)), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      this.led.position.set(0.13, 0.4, 0.18); this.chest.add(this.led);
    }
    if (S.dress) {   // a skirt instead of trousers
      const sk = this.cyl(0.18, 0.4, 0.78, S.coat, 0, -0.38, 0, this.hips, 10); sk.userData.skirt = true;
    }
    // neck and head
    this.neck = new THREE.Group(); this.neck.position.set(0, torsoH + 0.02, 0); this.chest.add(this.neck);
    this.cyl(0.05, 0.06, 0.1, S.skin, 0, 0.03, 0, this.neck);
    this.head = new THREE.Group(); this.head.position.y = 0.17; this.neck.add(this.head);
    this.sph(0.115, S.skin, 0, 0.02, 0, this.head, 0.92, 1.1, 1);
    this.eyeL = this.box(0.022, 0.03, 0.02, 0x16100e, -0.04, 0.05, 0.105, this.head);
    this.eyeR = this.box(0.022, 0.03, 0.02, 0x16100e, 0.04, 0.05, 0.105, this.head);
    this.box(0.03, 0.04, 0.03, S.skin, 0, 0.0, 0.115, this.head);                                    // nose
    this.mouth = this.box(0.05, 0.012, 0.02, 0x4a1c1c, 0, -0.05, 0.1, this.head);
    // hair
    if (S.hairStyle === 'short') this.sph(0.12, S.hair, 0, 0.06, -0.015, this.head, 0.96, 0.82, 1.0);
    else if (S.hairStyle === 'slick') { this.sph(0.12, S.hair, 0, 0.065, -0.02, this.head, 0.96, 0.78, 1.0); }
    else if (S.hairStyle === 'bun') { this.sph(0.12, S.hair, 0, 0.06, -0.02, this.head, 0.98, 0.84, 1.0); this.sph(0.06, S.hair, 0, 0.14, -0.1, this.head); }
    else if (S.hairStyle === 'long') {
      this.sph(0.125, S.hair, 0, 0.06, -0.02, this.head, 0.98, 0.84, 1.0);
      this.box(0.25, 0.46, 0.07, S.hair, 0, -0.17, -0.1, this.head);
      this.box(0.04, 0.34, 0.09, S.hair, -0.12, -0.1, -0.02, this.head); this.box(0.04, 0.34, 0.09, S.hair, 0.12, -0.1, -0.02, this.head);
    }
    if (S.beard) { this.box(0.17, 0.09, 0.05, S.beard, 0, -0.08, 0.075, this.head); this.box(0.03, 0.12, 0.05, S.beard, -0.1, -0.02, 0.06, this.head); this.box(0.03, 0.12, 0.05, S.beard, 0.1, -0.02, 0.06, this.head); }
    if (S.hat) { this.cyl(0.19, 0.19, 0.02, S.hat, 0, 0.13, 0, this.head, 12); this.cyl(0.11, 0.12, 0.22, S.hat, 0, 0.25, 0, this.head, 12); }
    // arms
    this.arms = [-1, 1].map(s => {
      const sh = new THREE.Group(); sh.position.set(s * 0.255, torsoH - 0.07, 0); this.chest.add(sh);
      this.cyl(0.055, 0.045, 0.32, S.coat, 0, -0.15, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
      this.cyl(0.045, 0.036, 0.3, S.coat, 0, -0.14, 0, el);
      const hand = this.sph(0.045, S.skin, 0, -0.31, 0, el);
      return { sh, el, hand, s };
    });
    this.handR = this.arms[1].hand;
    // legs
    this.legs = [-1, 1].map(s => {
      const hp = new THREE.Group(); hp.position.set(s * 0.1, -0.02, 0); this.hips.add(hp);
      if (!S.dress) this.cyl(0.075, 0.062, 0.46, S.pants, 0, -0.22, 0, hp);
      const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
      if (!S.dress) this.cyl(0.062, 0.05, 0.44, S.pants, 0, -0.21, 0, kn); else this.cyl(0.05, 0.045, 0.44, S.skin, 0, -0.21, 0, kn);
      this.box(0.1, 0.07, 0.22, boots, 0, -0.43, 0.05, kn);
      return { hp, kn, s };
    });
  }

  // ---- control ---------------------------------------------------------------
  setPose(name, instant) {
    const src = PUPPET_POSES[name] || PUPPET_POSES.stand;
    this.poseName = name;
    const t = { hipsY: 0.95, rootRX: 0, chestX: 0, chestZ: 0, headX: 0, headY: 0, headZ: 0, lax: 0, laz: 0.07, lex: -0.08, rax: 0, raz: -0.07, rex: -0.08, llx: 0, llk: 0, rlx: 0, rlk: 0 };
    Object.assign(t, src);
    this.target = t;
    if (instant) this.pose = Object.assign({}, t);
  }
  place(x, y, z, yaw) { this.root.position.set(x, y || 0, z); if (yaw !== undefined) this.root.rotation.y = yaw; this.lastX = x; this.lastZ = z; return this; }
  faceYaw(yaw) { this.root.rotation.y = yaw; return this; }
  faceTo(x, z) { this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z); return this; }
  lookAt(v, amt) { this.look = v ? v.clone ? v.clone() : new THREE.Vector3(v[0], v[1], v[2]) : null; this.lookAmt = amt === undefined ? 1 : amt; return this; }
  talk(on) { this.talking = on ? 1 : 0; return this; }

  update(dt) {
    this.t += dt;
    const P = this.pose, T = this.target, k = 1 - Math.exp(-dt * 7);
    for (const key in T) P[key] += (T[key] - P[key]) * k;
    // movement -> walk cycle
    const pos = this.root.position;
    let speed = 0;
    if (this.lastX !== null && dt > 0) { speed = Math.hypot(pos.x - this.lastX, pos.z - this.lastZ) / dt; if (this.autoFace && speed > 0.2) this.root.rotation.y += angleDiff(this.root.rotation.y, Math.atan2(pos.x - this.lastX, pos.z - this.lastZ)) * Math.min(1, dt * 9); }
    this.lastX = pos.x; this.lastZ = pos.z; this.speed += (speed - this.speed) * Math.min(1, dt * 10);
    const standing = this.poseName === 'stand' || this.poseName === 'hold' || this.poseName === 'radio' || this.poseName === 'point' || this.poseName === 'arms' || this.poseName === 'clutch' || this.poseName === 'cradle';
    const wantWalk = this.autoWalk && standing && this.speed > 0.25 ? clamp(this.speed / 1.6, 0.4, 1.4) : 0;
    this.walkAmt += (wantWalk - this.walkAmt) * Math.min(1, dt * 8);
    this.walkPhase += dt * (3.2 + this.speed * 2.2) * (wantWalk > 0 ? 1 : 0.3);
    const w = Math.sin(this.walkPhase) * this.walkAmt, wc = Math.cos(this.walkPhase) * this.walkAmt;
    const breathe = Math.sin(this.t * 1.7) * 0.012;
    const hasHold = this.poseName === 'hold' || this.poseName === 'radio' || this.poseName === 'point' || this.poseName === 'arms';
    this.pivot.rotation.x = P.rootRX; this.pivot.position.y = 0;
    this.hips.position.y = P.hipsY + Math.abs(wc) * 0.03 * this.walkAmt + breathe * 0.5;
    this.hips.rotation.y = w * 0.1 * (standing ? 1 : 0);
    this.chest.rotation.x = P.chestX + breathe * 1.5; this.chest.rotation.z = P.chestZ + w * 0.03; this.chest.rotation.y = -w * 0.08;
    // legs
    const L = this.legs[0], R = this.legs[1];
    L.hp.rotation.x = P.llx + w * 0.7; R.hp.rotation.x = P.rlx - w * 0.7;
    L.kn.rotation.x = P.llk + Math.max(0, -wc) * 0.9 * this.walkAmt; R.kn.rotation.x = P.rlk + Math.max(0, wc) * 0.9 * this.walkAmt;
    // arms
    const A = this.arms, talkSw = this.talking ? Math.sin(this.t * 3.1) * 0.12 : 0;
    A[0].sh.rotation.x = P.lax - (hasHold ? 0 : w * 0.55) + talkSw; A[0].sh.rotation.z = -P.laz;
    A[1].sh.rotation.x = P.rax + (hasHold ? 0 : w * 0.55) - talkSw * 0.6; A[1].sh.rotation.z = -P.raz;
    A[0].el.rotation.x = P.lex - (this.talking ? Math.abs(Math.sin(this.t * 2.3)) * 0.25 : 0); A[1].el.rotation.x = P.rex;
    // head: pose, talking nods, and tracking a look target
    let hy = P.headY, hx = P.headX;
    if (this.look && this.lookAmt > 0) {
      const wp = TMP.v1; this.head.getWorldPosition(wp);
      const inv = TMP.m1.copy(this.root.matrixWorld).invert(), loc = TMP.v2.copy(this.look).applyMatrix4(inv).sub(this.root.worldToLocal(wp.clone()));
      const yaw = Math.atan2(loc.x, loc.z), pit = -Math.atan2(loc.y, Math.hypot(loc.x, loc.z));
      hy += clamp(yaw, -1.1, 1.1) * this.lookAmt; hx += clamp(pit, -0.6, 0.6) * this.lookAmt;
    }
    this.neck.rotation.y = hy * 0.5; this.head.rotation.y = hy * 0.5;
    this.neck.rotation.x = hx * 0.4; this.head.rotation.x = hx * 0.6 + (this.talking ? Math.sin(this.t * 4.3) * 0.05 : 0);
    this.head.rotation.z = P.headZ + w * 0.02;
    // mouth and blink
    const mo = this.talking ? Math.abs(Math.sin(this.t * 11)) * (0.6 + 0.4 * Math.sin(this.t * 3)) : 0;
    this.mouth.scale.y = 1 + mo * 3.2; this.mouth.scale.x = 1 - mo * 0.2;
    this.blinkT -= dt; if (this.blinkT < 0) { this.blinkT = 2 + Math.random() * 4; this.blinkOn = 0.12; }
    const blink = this.blinkOn > 0 ? 0.15 : 1; if (this.blinkOn > 0) this.blinkOn -= dt;
    this.eyeL.scale.y = this.eyeR.scale.y = blink;
    if (this.led) this.led.visible = (this.t % 1.2) < 0.7;
    this.root.position.y = this.grounded ? this.root.position.y : this.root.position.y;
  }
}
