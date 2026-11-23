'use strict';
// ==========================================================================
// CINEMA: scene context (puppets, camera keyframes, captions, audio cues) and the
// player (letterbox, captions + narration, skip, fades, lightning, grading).
// Scenes render through the game's main renderer: Game.animate() swaps in
// cinema.scene and cinema.camera while a cutscene is active. No second WebGL context.
// ==========================================================================
class CineContext {
  constructor(game, kit, id, def) {
    this.game = game; this.kit = kit; this.id = id; this.def = def;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 260);
    this.t = 0; this.duration = def.duration || 30; this.silent = false;
    this.puppets = []; this.updaters = []; this.events = []; this.captions = []; this.chapters = []; this.camKeys = []; this.paths = [];
    this.sway = 0.012; this.grade = def.grade || 'saturate(0.7) sepia(0.2) contrast(1.12) brightness(0.95)'; this.exposure = def.exposure || 0.9;
    this.flashT = 0; this.fired = 0; this.lightningLights = []; this.hold = false;
    def.build(this);
    this.events.sort((a, b) => a.t - b.t);
  }
  // ---- building --------------------------------------------------------------------
  add(o) {
    if (!o) return o;
    const obj = o.isObject3D ? o : o.group;
    if (obj && !obj.parent) this.scene.add(obj);
    if (o.update && !o.isObject3D) this.updaters.push(o);
    return o;
  }
  puppet(style, x, y, z, yaw, pose) {
    const p = new Puppet(style); p.place(x, y || 0, z, yaw || 0); if (pose) p.setPose(pose, true); this.scene.add(p.root); this.puppets.push(p); return p;
  }
  cam(keys) { this.camKeys = keys; return this; }
  at(t, fn) { this.events.push({ t, fn, done: false }); return this; }
  caption(t0, t1, text, who) { this.captions.push({ t0, t1, text, who: who || 'NARRATOR', said: false }); return this; }
  chapter(t0, t1, title, sub) { this.chapters.push({ t0, t1, title, sub }); return this; }
  sfx(t, name) { const a = Array.prototype.slice.call(arguments, 2); return this.at(t, () => { const au = this.game.audio; if (!this.silent && au.ready && au[name]) au[name].apply(au, a); }); }
  update(fn) { this.updaters.push({ update: fn }); return this; }
  // puppet follows keyframes [[t, x, z], ...] (smooth between keys, holds at the ends)
  path(p, keys) { this.paths.push({ p, keys }); return this; }
  flash(t, strength) { return this.at(t, () => { this.flashT = 0.35; this.flashPow = strength || 1; if (!this.silent) this.game.cinema.flashDom(this.flashPow); }); }
  // a light the player flashes during lightning
  lightningLight(l) { this.lightningLights.push({ l, base: l.intensity }); return l; }

  // ---- stepping -----------------------------------------------------------------------
  step(dt) {
    if (!this.hold) this.t += dt;
    const t = this.t;
    for (const e of this.events) if (!e.done && t >= e.t) { e.done = true; try { e.fn(this); } catch (err) { console.error('[cinema event]', this.id, err); } }
    for (const q of this.paths) {
      const k = q.keys; let x, z, y;
      if (t <= k[0][0]) { x = k[0][1]; z = k[0][2]; y = k[0][3]; }
      else if (t >= k[k.length - 1][0]) { const l = k[k.length - 1]; x = l[1]; z = l[2]; y = l[3]; }
      else for (let i = 0; i < k.length - 1; i++) if (t >= k[i][0] && t < k[i + 1][0]) { const u = (t - k[i][0]) / (k[i + 1][0] - k[i][0]), s = u * u * (3 - 2 * u), m = k[i + 1][4] === 'lin' ? u : s; x = lerp(k[i][1], k[i + 1][1], m); z = lerp(k[i][2], k[i + 1][2], m); y = k[i][3] !== undefined ? lerp(k[i][3], k[i + 1][3] === undefined ? k[i][3] : k[i + 1][3], m) : undefined; break; }
      q.p.root.position.x = x; q.p.root.position.z = z; if (y !== undefined) q.p.root.position.y = y;
    }
    for (const p of this.puppets) p.update(dt);
    for (const u of this.updaters) u.update(dt, t);
    this.updateCamera(t);
    if (this.flashT > 0) { this.flashT -= dt; const k = Math.max(0, this.flashT / 0.35); this.lightningLights.forEach(o => { o.l.intensity = o.base + k * 6 * (this.flashPow || 1); }); }
    else this.lightningLights.forEach(o => { o.l.intensity = o.base; });
  }
  updateCamera(t) {
    const K = this.camKeys; if (!K.length) return;
    let a = K[0], b = K[0], u = 0;
    if (t >= K[K.length - 1].t) { a = b = K[K.length - 1]; }
    else if (t > K[0].t) for (let i = 0; i < K.length - 1; i++) if (t >= K[i].t && t < K[i + 1].t) { a = K[i]; b = K[i + 1]; u = (t - a.t) / (b.t - a.t); if (b.cut) { b = a; u = 0; } break; }
    const e = u * u * u * (u * (u * 6 - 15) + 10);   // smootherstep
    const c = this.camera, p = [lerp(a.p[0], b.p[0], e), lerp(a.p[1], b.p[1], e), lerp(a.p[2], b.p[2], e)], l = [lerp(a.l[0], b.l[0], e), lerp(a.l[1], b.l[1], e), lerp(a.l[2], b.l[2], e)];
    const s = this.sway, ts = performance.now() / 1000;
    c.position.set(p[0] + Math.sin(ts * 0.9) * s, p[1] + Math.sin(ts * 1.3 + 1) * s, p[2] + Math.cos(ts * 0.7) * s);
    c.lookAt(l[0] + Math.sin(ts * 0.5) * s * 0.5, l[1] + Math.cos(ts * 0.6) * s * 0.5, l[2]);
    const fov = lerp(a.fov || 45, b.fov || a.fov || 45, e); if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; }
    c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
  }
}

// ==========================================================================
class Cinema {
  constructor(game) {
    this.game = game; this.kit = null; this.active = false; this.ctx = null; this.prepared = {}; this.opts = null;
    this.ending = false; this.fadeA = 0; this.seeking = false; this.savedFilter = ''; this.savedExposure = 1; this.t0 = 0;
    const $ = id => document.getElementById(id);
    this.el = { layer: $('cine-layer'), cap: $('cine-caption'), who: document.querySelector('#cine-caption .who'), txt: document.querySelector('#cine-caption .txt'), chap: $('cine-chapter'), ck: document.querySelector('#cine-chapter .k'), ch2: document.querySelector('#cine-chapter h2'), cp: document.querySelector('#cine-chapter p'), flash: $('cine-flash'), fade: $('cine-fade'), skip: $('cine-skip'), begin: $('cine-begin'), hint: $('cine-hint') };
    this.el.skip.addEventListener('click', () => this.skip());
    this.el.begin.addEventListener('click', () => this.begin());
    window.addEventListener('keydown', e => {
      if (!this.active || this.seeking) return;
      if (e.code === 'Escape') { if (this.opts && this.opts.skippable) { e.preventDefault(); this.skip(); } }
      else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (this.atEnd) this.begin(); else if (this.opts && this.opts.skippable) this.skip(); }
    });
  }
  getKit() { return this.kit || (this.kit = new CinemaKit(this.game)); }
  make(id) {
    const def = CINE_SCENES[id]; if (!def) throw new Error('unknown cutscene ' + id);
    return new CineContext(this.game, this.getKit(), id, def);
  }
  // Build and compile a scene ahead of time (behind the menu) so playing it never hitches
  prepare(id) {
    if (this.prepared[id]) return this.prepared[id];
    const ctx = this.make(id); this.prepared[id] = ctx;
    try { this.game.renderer.compile(ctx.scene, ctx.camera); } catch (e) { /* compile is best effort */ }
    return ctx;
  }

  play(id, opts) {
    const g = this.game; opts = opts || {};
    if (this.active) this.finish(false, true);
    const ctx = this.prepared[id] || this.make(id); delete this.prepared[id];
    this.ctx = ctx; this.opts = opts; this.active = true; this.ending = false; this.atEnd = false; this.seeking = false; this.hold = false;
    this.savedFilter = g.renderer.domElement.style.filter; this.savedExposure = g.renderer.toneMappingExposure;
    g.renderer.domElement.style.filter = ctx.grade; g.renderer.toneMappingExposure = ctx.exposure;
    document.body.classList.add('cine-on'); this.el.layer.classList.add('on');
    this.el.skip.style.display = opts.skippable ? 'inline-flex' : 'none';
    this.el.hint.textContent = opts.skippable ? 'Space or Esc to skip' : '';
    this.el.begin.classList.remove('on'); this.el.begin.textContent = opts.endLabel || 'Begin';
    this.el.fade.style.transitionDuration = '0s'; this.el.fade.style.opacity = 1; void this.el.fade.offsetWidth;
    this.el.fade.style.transitionDuration = '1.1s'; this.el.fade.style.opacity = 0;
    g.audio.ensure(); Narrator.enabled = !!g.access.narration;
    ctx.silent = false; ctx.step(0);
    if (opts.onStart) opts.onStart();
  }

  update(dt) {
    const ctx = this.ctx; if (!ctx) return;
    if (this.seeking) { this.updateOverlay(ctx.t); return; }
    ctx.step(dt);
    this.updateOverlay(ctx.t);
    if (!this.ending && !this.atEnd && ctx.t >= ctx.duration) {
      if (this.opts.endButton) { this.atEnd = true; ctx.hold = true; this.el.begin.classList.add('on'); this.el.hint.textContent = ''; }
      else this.endWithFade(true);
    }
  }

  updateOverlay(t) {
    const ctx = this.ctx, e = this.el;
    let cap = null; for (const c of ctx.captions) if (t >= c.t0 && t < c.t1) cap = c;
    if (cap) {
      if (e.txt.textContent !== cap.text) {
        e.txt.textContent = cap.text; e.who.textContent = cap.who === 'NARRATOR' ? '' : cap.who; e.cap.dataset.who = cap.who;
        if (!cap.said && !ctx.silent && cap.who === 'NARRATOR') { cap.said = true; Narrator.enabled = !!this.game.access.narration; Narrator.speak(cap.text, 'NARRATOR', true); }
      }
      e.cap.classList.add('on');
    } else e.cap.classList.remove('on');
    let ch = null; for (const c of ctx.chapters) if (t >= c.t0 && t < c.t1) ch = c;
    if (ch) { if (e.ch2.textContent !== ch.title) { e.ch2.textContent = ch.title; e.cp.textContent = ch.sub || ''; e.ck.textContent = ch.kicker || ''; } e.chap.classList.add('on'); } else e.chap.classList.remove('on');
  }

  flashDom(pow) {
    const g = this.game; if (!this.active) return; const a = g.access.reduceFlashing ? 0.18 : 0.55 * Math.min(1.4, pow || 1);
    this.el.flash.style.transition = 'none'; this.el.flash.style.opacity = a; void this.el.flash.offsetWidth; this.el.flash.style.transition = 'opacity 0.5s ease-out'; this.el.flash.style.opacity = 0;
  }

  skip() { if (!this.active || this.ending || !this.opts.skippable) return; this.endWithFade(false); }
  begin() { if (!this.active || this.ending || !this.atEnd) return; this.endWithFade(true); }
  endWithFade(completed) {
    if (this.ending) return; this.ending = true; Narrator.stop();
    this.el.fade.style.transitionDuration = (this.opts.fadeOut || 0.7) + 's'; this.el.fade.style.opacity = 1; this.el.begin.classList.remove('on');
    setTimeout(() => this.finish(completed), (this.opts.fadeOut || 0.7) * 1000 + 40);
  }
  finish(completed, quiet) {
    if (!this.active) return;
    const g = this.game, opts = this.opts, ctx = this.ctx;
    this.active = false; this.ctx = null; this.atEnd = false; this.ending = false; this.seeking = false;
    g.renderer.domElement.style.filter = this.savedFilter; g.renderer.toneMappingExposure = this.savedExposure;
    document.body.classList.remove('cine-on'); this.el.layer.classList.remove('on'); this.el.cap.classList.remove('on'); this.el.chap.classList.remove('on');
    this.el.begin.classList.remove('on'); Narrator.stop();
    try { disposeTree(ctx.scene); } catch (e) { /* ignore */ }
    this.el.fade.style.transitionDuration = '0.6s'; this.el.fade.style.opacity = 0;
    if (!quiet && opts && opts.onDone) opts.onDone(completed);
  }

  // Test helper: freeze a scene at time t and keep rendering that frame (for screenshots)
  seek(id, t) {
    if (this.active) this.finish(false, true);
    const g = this.game, ctx = this.make(id); ctx.silent = true;
    for (let s = 0; s < t; s += 1 / 30) { ctx.t = Math.min(s, ctx.duration); ctx.step(1 / 30); }
    ctx.t = t; ctx.step(0);
    this.ctx = ctx; this.opts = { skippable: false }; this.active = true; this.seeking = true;
    this.savedFilter = g.renderer.domElement.style.filter; this.savedExposure = g.renderer.toneMappingExposure;
    g.renderer.domElement.style.filter = ctx.grade; g.renderer.toneMappingExposure = ctx.exposure;
    document.body.classList.add('cine-on'); this.el.layer.classList.add('on'); this.el.skip.style.display = 'none';
    this.el.fade.style.transitionDuration = '0s'; this.el.fade.style.opacity = 0;
    this.updateOverlay(t);
    return { duration: ctx.duration, captions: ctx.captions.length };
  }
  stopSeek() { this.finish(false, true); }
}
