'use strict';
// ==========================================================================
// INTERACTABLES: base class, Openable (eased state machine), InteractionSystem
// ==========================================================================
class Interactable {
  constructor(game, o) {
    this.game = game;
    this.id = o.id || 'ia';
    this.room = o.room || null;
    this.meshes = [];
    this.enabled = true;
    this.reach = o.reach || CONFIG.interact.reach;
    this.holdTime = o.holdTime || 0;      // seconds to hold E (searching)
    this.slowOpen = !!o.slowOpen;          // tap = fast, hold = slow and quiet
    this.promptFn = o.prompt || (() => 'Interact');
    this.onInteract = o.onInteract || (() => {});
    this.onUse = o.onUse || null;          // R key while focused
    this.focusT = 0; this.focused = false;
    this.mats = [];
    (o.meshes || []).forEach(m => this.addMesh(m));
    if (this.room) this.room.interactables.push(this);
  }
  // Each interactable owns unique materials so its highlight does not leak onto neighbours
  addMesh(m) {
    if (!m.material.userData || !m.material.userData.own) {
      m.material = m.material.clone(); m.material.userData = { own: true };
    }
    m.userData.ia = this;
    this.meshes.push(m);
    const mat = m.material;
    if (mat.emissive) this.mats.push({ mat, base: mat.emissive.clone() });
    if (this.room) this.room.rayDirty = true;
  }
  prompt() { return this.promptFn(this); }
  activate(info) { this.onInteract(info || {}, this); }
  setFocus(on) { this.focused = on; }
  update(dt) {
    const target = this.focused ? 1 : 0;
    if (Math.abs(this.focusT - target) < 0.01) { if (this.focusT !== target) { this.focusT = target; this.paint(); } return; }
    this.focusT = damp(this.focusT, target, 14, dt);
    this.paint();
  }
  paint() {
    const f = this.focusT;
    for (const e of this.mats) e.mat.emissive.setRGB(e.base.r + 0.30 * f, e.base.g + 0.20 * f, e.base.b + 0.10 * f);
  }
  dispose() { this.enabled = false; }
}

// --------------------------------------------------------------------------
// Openable: closed / opening / open / closing, plus locked / jammed overlays.
// Animation is an eased tween on t (0 closed .. 1 open). Doors overshoot.
// --------------------------------------------------------------------------
class Openable extends Interactable {
  constructor(game, o) {
    super(game, o);
    this.t = 0; this.st = 'closed';
    this.apply = o.apply || (() => {});
    this.durOpen = o.durOpen || 0.7; this.durClose = o.durClose || 0.6;
    this.easeOpen = o.easeOpen || Ease.outCubic; this.easeClose = o.easeClose || Ease.inOutCubic;
    this.hooks = o.hooks || {};   // sound hooks: opening, open, closing, closed
    this.lock = null; this.jamT = 0;
    this.byGhost = false;
  }
  get state() {
    if (this.jamT > 0 && this.st === 'closed') return 'jammed';
    if (this.lock && this.st === 'closed') return 'locked';
    return this.st;
  }
  get isOpen() { return this.st === 'open' || this.st === 'opening'; }
  setT(v) { this.t = v; this.apply(v); }
  snap(open) { this.game.tweens.cancel('op:' + this.id); this.st = open ? 'open' : 'closed'; this.setT(open ? 1 : 0); }
  jam(sec) { this.jamT = Math.max(this.jamT, sec); }
  go(open, slow, byGhost) {
    if (open && (this.lock || this.jamT > 0)) return false;
    const target = open ? 1 : 0;
    if ((open && this.st === 'open') || (!open && this.st === 'closed')) return false;
    this.st = open ? 'opening' : 'closing';
    this.byGhost = !!byGhost;
    const from = this.t, span = Math.abs(target - from) || 0.01;
    const base = open ? this.durOpen : this.durClose;
    const dur = Math.max(0.12, base * (slow ? 3.2 : 1) * span);
    if (this.hooks[open ? 'opening' : 'closing']) this.hooks[open ? 'opening' : 'closing'](slow, byGhost, this);
    this.game.tweens.add({
      key: 'op:' + this.id, dur, from, to: target, ease: open ? this.easeOpen : this.easeClose,
      update: v => this.setT(v),
      done: () => {
        this.setT(target); this.st = open ? 'open' : 'closed';
        if (this.hooks[this.st]) this.hooks[this.st](slow, byGhost, this);
      }
    });
    return true;
  }
  open(slow, byGhost) { return this.go(true, slow, byGhost); }
  close(slow, byGhost) { return this.go(false, slow, byGhost); }
  toggle(slow) { return this.isOpen ? this.close(slow) : this.open(slow); }
  tick(dt) { if (this.jamT > 0) this.jamT -= dt; }
}

// --------------------------------------------------------------------------
// InteractionSystem: true raycast from the screen centre against the meshes of
// the current room (interactables plus occluders). Handles tap/hold on E.
// --------------------------------------------------------------------------
class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.ray = new THREE.Raycaster();
    this.ray.far = 4.2;
    this.center = new THREE.Vector2(0, 0);
    this.focus = null;
    this.list = []; this.listRoom = null;
    this.pending = null;   // {ia, t, fired}
    this.holdProg = 0;
  }
  rebuild(room) {
    const l = [];
    room.interactables.forEach(ia => { for (const m of ia.meshes) l.push(m); });
    room.occluders.forEach(m => l.push(m));
    this.list = l; this.listRoom = room; room.rayDirty = false;
  }
  clearFocus() { if (this.focus) this.focus.setFocus(false); this.focus = null; }
  update(dt) {
    const g = this.game, room = g.room;
    if (!room) return;
    room.interactables.forEach(ia => ia.update(dt));
    if (this.listRoom !== room || room.rayDirty) this.rebuild(room);
    let found = null;
    if (g.canAct()) {
      this.ray.setFromCamera(this.center, g.camera);
      const hits = this.ray.intersectObjects(this.list, false);
      for (const h of hits) {
        const ia = h.object.userData.ia;
        if (h.object.userData.occ) break;
        if (ia && ia.enabled && h.distance <= ia.reach) { found = ia; break; }
        if (ia && !ia.enabled) continue;
      }
    }
    if (found !== this.focus) {
      if (this.focus) this.focus.setFocus(false);
      this.focus = found;
      if (found) found.setFocus(true);
      if (this.pending && this.pending.ia !== found) this.cancelPending();
    }
    // prompt text and reticle
    g.hud.setPrompt(this.focus ? this.focus.prompt() : null, !!this.focus);
    // hold handling
    const p = this.pending;
    if (p) {
      p.t += dt;
      if (p.ia.holdTime > 0) {
        this.holdProg = clamp(p.t / p.ia.holdTime, 0, 1);
        g.hud.setHold(this.holdProg);
        if (p.t >= p.ia.holdTime && !p.fired) { p.fired = true; this.holdProg = 0; g.hud.setHold(0); p.ia.activate({}); this.pending = null; }
      } else if (p.ia.slowOpen && p.t >= CONFIG.interact.holdSlow && !p.fired) {
        p.fired = true; p.ia.activate({ slow: true }); this.pending = null;
      }
    } else if (this.holdProg) { this.holdProg = 0; g.hud.setHold(0); }
  }
  cancelPending() { this.pending = null; this.holdProg = 0; this.game.hud.setHold(0); }
  press() {
    if (!this.focus || !this.game.canAct()) return;
    const ia = this.focus;
    if (ia.holdTime > 0 || ia.slowOpen) this.pending = { ia, t: 0, fired: false };
    else ia.activate({});
  }
  release() {
    const p = this.pending;
    if (p && !p.fired && p.ia.slowOpen) p.ia.activate({ slow: false });
    this.cancelPending();
  }
  use() { if (this.focus && this.focus.onUse && this.focus.onUse(this.game.inventory.current)) return true; return false; }
}
