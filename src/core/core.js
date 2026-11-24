'use strict';
// ==========================================================================
// CORE: Config, RNG / Seed, Easing, Tweens, Emitter, math helpers, cache
// ==========================================================================

// --------------------------------------------------------------------------
// Config (all tuning values live here)
// --------------------------------------------------------------------------
const CONFIG = {
  version: '2.0',
  difficulties: {
    // w: weapon balance. Stun / repel seconds, bat hits before it breaks, ammo a gun comes loaded with,
    // ammo per pickup (+/-), melee reach in metres, extra aim forgiveness for the pistol.
    easy:      { label: 'Easy',      walk: 1.45, hunt: 3.5, hearing: 0.85, sight: 11, aggression: 0.65, fearGain: 0.7,  scareRate: 0.75, stun: 2.6, peekKill: 0.35, drain: 0.7,
      w: { batStun: 3.4, batHits: 8, crowRepel: 6.0, flareStart: 3, flareRepel: 7.0, pistolStart: 3, pistolStun: 5.0, ammoBonus: 1, reach: 2.6, aimBonus: 0.15 } },
    normal:    { label: 'Normal',    walk: 1.75, hunt: 4.1, hearing: 1.0,  sight: 14, aggression: 1.0,  fearGain: 1.0,  scareRate: 1.0,  stun: 2.0, peekKill: 0.55, drain: 1.0,
      w: { batStun: 2.6, batHits: 5, crowRepel: 4.5, flareStart: 2, flareRepel: 5.5, pistolStart: 2, pistolStun: 3.8, ammoBonus: 0, reach: 2.3, aimBonus: 0.05 } },
    nightmare: { label: 'Nightmare', walk: 2.1,  hunt: 4.9, hearing: 1.3,  sight: 17, aggression: 1.5,  fearGain: 1.3,  scareRate: 1.35, stun: 1.3, peekKill: 0.8,  drain: 1.35,
      w: { batStun: 1.8, batHits: 4, crowRepel: 3.2, flareStart: 1, flareRepel: 4.0, pistolStart: 1, pistolStun: 2.6, ammoBonus: -1, reach: 2.1, aimBonus: 0 } }
  },
  // Weapon timing. swing = strike time, recover = follow-through. Noise is what she hears.
  // resist: every hit makes the next one weaker for a while, so she can never be stun-locked.
  weapons: {
    bat:      { cooldown: 0.95, swing: 0.32, recover: 0.38, noise: 0.42 },
    crowbar:  { cooldown: 1.35, swing: 0.5,  recover: 0.45, noise: 0.48 },
    flaregun: { cooldown: 1.6, speed: 15, burn: 14, radius: 3.4, noise: 0.55 },
    // a gunshot carries through closed doors: from the next room she comes to look, in the same room she hunts
    pistol:   { cooldown: 0.7, range: 18, radius: 0.42, noise: 2.2, swing: 0.2 },
    resist:   { gain: 0.22, max: 0.6, decay: 0.01, min: 1.0 }
  },
  // Light: she moves slower hunting under a lit bulb, but she sees you from further away
  light: { huntSlow: 0.85, sightBoost: 1.2, patrolAvoid: 0.6 },
  // Sprint costs stamina: about 5 seconds at full speed, then you are winded until it refills
  player: { walk: 3.4, sprint: 5.8, crouch: 1.7, radius: 0.35, eye: 1.7, crouchEye: 1.1, fov: 72, sprintFov: 78, sprintDrain: 0.2, sprintRegen: 0.13, sprintDelay: 1.4, sprintMin: 0.3 },
  // A chase speeds up: after huntRamp seconds in HUNT the ghost is up to +50% faster
  chase: { huntRamp: 30, maxBoost: 0.5 },
  // After the skull is taken: seconds of calm, then seconds until the full hunt, and how often she homes in on you
  relicChase: { grace: 35, hunt: 85, pulseSlow: 15, pulseFast: 6 },
  // The flashlight beam burns battery per stun, and the ghost builds resistance to it
  beam: { cost: 12, resistGain: 0.25, resistDecay: 0.012, resistMax: 0.8, minStun: 0.5 },
  // The night: real seconds of play until midnight and until dawn. 11:14 PM -> 6:00 AM.
  night: { midnightAt: 900, dawnAt: 2400 },
  // After midnight the house stops forgiving
  midnight: { speed: 1.12, hearing: 1.25, battery: 1.4 },
  // High fear bends the rules (0..1 fear): shorter breath hold, a lying noise meter, fake door sounds
  fear: { breathDrain: 1.3, lieAt: 0.55, fakeSoundAt: 0.55 },
  // base hearing range in metres for a noise of loudness 1.0
  hearRange: 14,
  loudness: { walk: 0.22, sprint: 0.85, doorFast: 0.55, doorSlow: 0.08, drop: 0.6, thrown: 0.85, pickup: 0.08, slam: 1.0 },
  micThreshold: 35,
  micThresholdHidden: 18,
  interact: { reach: 2.9, holdSlow: 0.28 },
  stageSeconds: [225, 540, 900],   // 25%, 60% and 100% of the way to midnight
  inventorySlots: 8
};

// --------------------------------------------------------------------------
// RNG / Seed
// --------------------------------------------------------------------------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) {
    this.seed = String(seed);
    this._f = mulberry32(xmur3(this.seed)());
  }
  next() { return this._f(); }
  range(a, b) { return a + (b - a) * this._f(); }
  int(a, b) { return a + Math.floor(this._f() * (b - a)); } // [a, b)
  chance(p) { return this._f() < p; }
  pick(arr) { return arr[Math.floor(this._f() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this._f() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  weighted(items, weightFn) {
    let total = 0;
    const w = items.map(it => { const x = Math.max(0, weightFn(it)); total += x; return x; });
    if (total <= 0) return items[Math.floor(this._f() * items.length)];
    let r = this._f() * total;
    for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
}
RNG.randomSeed = function () {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

// --------------------------------------------------------------------------
// Easing + Tween utility (queued tweens, cancel by key)
// --------------------------------------------------------------------------
const Ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBackBig: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1)
};

class Tweens {
  constructor() { this.list = []; }
  add(o) {
    const tw = {
      key: o.key || null, t: 0, delay: o.delay || 0, dur: Math.max(0.0001, o.dur === undefined ? 0.3 : o.dur),
      ease: o.ease || Ease.inOutCubic, update: o.update || null, done: o.done || null,
      from: o.from === undefined ? 0 : o.from, to: o.to === undefined ? 1 : o.to, dead: false
    };
    if (tw.key) this.cancel(tw.key);
    this.list.push(tw);
    return tw;
  }
  after(sec, fn, key) { return this.add({ dur: 0.0001, delay: sec, key, done: fn, update: null }); }
  cancel(key) { for (const tw of this.list) if (tw.key === key) tw.dead = true; }
  cancelAll() { this.list.length = 0; }
  update(dt) {
    const arr = this.list;
    for (let i = 0; i < arr.length; i++) {
      const tw = arr[i];
      if (tw.dead) continue;
      if (tw.delay > 0) { tw.delay -= dt; continue; }
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      if (tw.update) tw.update(tw.from + (tw.to - tw.from) * tw.ease(k), k);
      if (k >= 1) { tw.dead = true; if (tw.done) tw.done(); }
    }
    this.list = arr.filter(t => !t.dead);
  }
}

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; }
  off(ev, fn) { if (this._h[ev]) this._h[ev] = this._h[ev].filter(f => f !== fn); }
  emit(ev, a, b) { (this._h[ev] || []).slice().forEach(fn => fn(a, b)); }
}

// --------------------------------------------------------------------------
// Math / geometry helpers
// --------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const angleDiff = (a, b) => wrapAngle(b - a);
const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
// yaw (rotation about Y) needed to face direction (dx, dz); yaw 0 faces -Z
const yawFromDir = (dx, dz) => Math.atan2(-dx, -dz);

// rect = [minX, maxX, minZ, maxZ]
function rectContains(r, x, z, pad) {
  pad = pad || 0;
  return x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad;
}
// Liang-Barsky segment vs rect
function segHitsRect(ax, az, bx, bz, r, pad) {
  pad = pad || 0;
  const minX = r[0] - pad, maxX = r[1] + pad, minZ = r[2] - pad, maxZ = r[3] + pad;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const p = [-dx, dx, -dz, dz];
  const q = [ax - minX, maxX - ax, az - minZ, maxZ - az];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

// --------------------------------------------------------------------------
// Shared resource cache. Anything created through Cache is built once and
// reused for the life of the page (never disposed on restart).
// --------------------------------------------------------------------------
const Cache = {
  _g: {}, _m: {}, _t: {},
  geo(key, make) { return this._g[key] || (this._g[key] = Object.assign(make(), { userData: { cached: true } })); },
  mat(key, make) { const m = this._m[key] || (this._m[key] = make()); m.userData.cached = true; return m; },
  tex(key, make) {
    const t = this._t[key] || (this._t[key] = make());
    if (t && typeof t === 'object') { t.userData = t.userData || {}; t.userData.cached = true; }
    return t;
  }
};

// A soft round dot for particle points (dust, smoke), shared and cached
function softDot() {
  return Cache.tex('tex.softdot', () => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  });
}

// Reusable temporaries for update loops
const TMP = {};
function initTmp() {
  TMP.v1 = new THREE.Vector3(); TMP.v2 = new THREE.Vector3(); TMP.v3 = new THREE.Vector3(); TMP.v4 = new THREE.Vector3();
  TMP.q1 = new THREE.Quaternion(); TMP.q2 = new THREE.Quaternion(); TMP.e1 = new THREE.Euler(0, 0, 0, 'YXZ');
  TMP.m1 = new THREE.Matrix4();
}
if (typeof THREE !== 'undefined') initTmp();

// Dispose everything under an object that is not cached/shared
function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry && !(o.geometry.userData && o.geometry.userData.cached)) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach(m => {
      if (m.userData && m.userData.cached) return;
      ['map', 'emissiveMap', 'alphaMap'].forEach(k => { if (m[k] && !(m[k].userData && m[k].userData.cached)) m[k].dispose(); });
      m.dispose();
    });
  });
}
