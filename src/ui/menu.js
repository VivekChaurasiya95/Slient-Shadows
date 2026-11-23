'use strict';
// ==========================================================================
// MENU: the animated 3D backdrop (Hollow Manor on its hill, drawn by the game's own
// renderer, no second WebGL context) and the side-panel / segmented-control logic.
// ==========================================================================
class MenuScene {
  constructor(game) {
    this.game = game; this.active = true; this.t = 0; this.built = false; this.lightningT = 6; this.figT = 9; this.audioOn = false; this.thunderAt = -1;
    this.build();
    this.bindPanel();
  }

  build() {
    const g = this.game, K = g.cinema.getKit();
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 260);
    const sc = this.scene; sc.fog = new THREE.FogExp2(0x070a12, 0.014); sc.background = new THREE.Color(0x070a12);
    const sky = K.sky(sc, { fog: 0x070a12, fogDensity: 0.014, moonLight: 0.75, moonPos: [40, 62, -120] }); sc.add(sky.group); this.sky = sky;
    this.flash = new THREE.DirectionalLight(0xb8c8ff, 0); this.flash.position.set(-20, 40, 30); sc.add(this.flash);
    this.parts = [];
    const add = o => { sc.add(o.group || o); if (o.update) this.parts.push(o); return o; };
    add(K.ground({ hillZ: -40 }));
    this.manor = K.manor(); this.manor.group.position.set(17, 0, -34); this.manor.group.rotation.y = -0.28; add(this.manor);
    [[-10, -14, 1.5], [-18, -2, 1.3], [6, -6, 1.1], [-5, -30, 1.8], [26, -20, 1.5], [-26, -18, 1.9], [20, 4, 1.2]].forEach((t, i) => sc.add(K.tree(t[0], t[1], t[2], i + 20)));
    add(K.fogBank({ y: 0.6, z: -20, spread: 80, opacity: 0.24, size: 20 }));
    this.rain = K.rain({ count: 1100, width: 40, depth: 40 }); this.rain.follow = this.camera; add(this.rain);
    add(K.crows(6, 17, 14, -34, 22));
    // the pale figure that sometimes stands in the tower window
    this.gf = K.ghostFigure(); this.gf.group.scale.setScalar(0.95);
    const w = this.manor.ghostWin; this.gfBase = new THREE.Vector3(w.x, w.y - 1.55, 3.3); this.manor.group.add(this.gf.group); this.gf.group.position.copy(this.gfBase); this.parts.push(this.gf); this.gf.set(0);
    this.camera.position.set(-6, 3, 14); this.camera.lookAt(4, 7, -34);
    try { g.renderer.compile(sc, this.camera); } catch (e) { /* best effort */ }
    this.built = true;
  }

  // slow drifting camera, lightning, the figure in the window
  update(dt) {
    if (!this.built) return;
    this.t += dt; const t = this.t, g = this.game;
    this.parts.forEach(p => p.update(dt, t));
    const a = Math.sin(t * 0.07) * 0.5 + 0.5;                                    // loops back and forth, never jumps
    this.camera.position.set(-10 + a * 8 + Math.sin(t * 0.31) * 0.3, 2.6 + a * 1.4 + Math.sin(t * 0.43) * 0.12, 16 - a * 8);
    this.camera.lookAt(5 + a * 4 + Math.sin(t * 0.11) * 1.2, 6.8 + a * 1.2, -34);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.lightningT -= dt;
    if (this.lightningT <= 0) { this.lightningT = 9 + Math.random() * 12; this.strike = 0.4; this.thunderAt = t + 0.9 + Math.random() * 1.2; this.figT = Math.min(this.figT, 1.5); }
    if (this.strike > 0) { this.strike -= dt; const soft = g.access && g.access.reduceFlashing; this.flash.intensity = soft ? 1.5 : Math.max(0, this.strike / 0.4) * 7 * (Math.sin(this.strike * 70) > -0.3 ? 1 : 0.2); } else this.flash.intensity = 0;
    if (this.thunderAt > 0 && t > this.thunderAt) { this.thunderAt = -1; if (this.audioOn) g.audio.thunder(); }
    this.figT -= dt;
    if (this.figT <= 0) { this.figT = 18 + Math.random() * 16; this.figShow = 5; }
    if (this.figShow > 0) { this.figShow -= dt; const k = this.figShow; this.gf.set(Math.min(1, (5 - k) / 1.4) * Math.min(1, k / 1.2) * 0.9); } else this.gf.set(0);
  }

  // Browsers only allow sound after a click, so the rain starts on the first interaction
  startAudio() { if (this.audioOn) return; this.audioOn = true; try { this.game.audio.ensure(); this.game.audio.rainOn(0.55); } catch (e) { /* no audio */ } }
  stop() { this.active = false; if (this.audioOn) { try { this.game.audio.rainOn(0); } catch (e) { /* ignore */ } } }
  dispose() { if (this.scene) { disposeTree(this.scene); this.scene = null; } this.built = false; }

  // ---- side panel, segmented difficulty ---------------------------------------------------
  bindPanel() {
    const $ = id => document.getElementById(id), panel = $('side-panel'), menu = $('start-menu');
    const open = name => {
      panel.querySelectorAll('section').forEach(s => { s.hidden = s.dataset.panel !== name; });
      panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); menu.classList.add('panel-open');
      menu.querySelectorAll('.mbtn[data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === name));
      this.panelName = name;
    };
    const close = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); menu.classList.remove('panel-open'); menu.querySelectorAll('.mbtn').forEach(b => b.classList.remove('on')); this.panelName = null; };
    menu.querySelectorAll('.mbtn[data-panel]').forEach(b => b.addEventListener('click', () => { if (this.panelName === b.dataset.panel) close(); else open(b.dataset.panel); }));
    $('panel-close').addEventListener('click', close);
    window.addEventListener('keydown', e => { if (e.code === 'Escape' && this.active && this.panelName) close(); });
    const seg = $('seg-diff'), sel = $('menu-diff');
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      sel.value = b.dataset.v; seg.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
    }));
    ['pointerdown', 'keydown'].forEach(ev => menu.addEventListener(ev, () => this.startAudio(), { once: false }));
    this.open = open; this.close = close;
  }
}
