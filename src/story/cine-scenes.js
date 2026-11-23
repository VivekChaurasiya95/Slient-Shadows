'use strict';
// ==========================================================================
// CINE SCENES: the opening and the seven room flashbacks.
// Each scene is { duration, grade, exposure, build(ctx) }. ctx is a CineContext.
// Times are seconds. Camera keys: { t, p:[x,y,z], l:[x,y,z], fov, cut }.
// ==========================================================================
const CINE_SCENES = {};

// ---- helpers shared by the scenes ---------------------------------------------------------
const CS = {
  ambient(ctx, color, k) { ctx.scene.add(new THREE.AmbientLight(color, k)); },
  fogOf(ctx, color, d) { ctx.scene.fog = new THREE.FogExp2(color, d); ctx.scene.background = new THREE.Color(color); },
  // Rowan's flashlight: a spot light and a faint visible beam, attached to his right hand
  flashlight(ctx, puppet) {
    const hand = puppet.handR, sp = new THREE.SpotLight(0xfff2d8, 5, 26, 0.38, 0.55, 1.2); sp.position.set(0, -0.05, 0.05); hand.add(sp);
    const tgt = new THREE.Object3D(); tgt.position.set(0, -0.2, 8); hand.add(tgt); sp.target = tgt;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    cone.rotation.x = -Math.PI / 2; cone.position.set(0, -0.1, 3.6); hand.add(cone);
    puppet.setPose('hold', true); return sp;
  },
  // simple card with a handwritten page
  paper(ctx, w, h, lines) {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const g = c.getContext('2d'); g.fillStyle = '#cfc29a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#3a2a1a'; g.font = '16px serif'; lines.forEach((l, i) => g.fillText(l, 14, 28 + i * 22)); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 1, side: THREE.DoubleSide }));
  }
};

// ==========================================================================
// OPENING (about 64 s): the manor, a ghost in the window, Rowan on the road, Dacre in a car at
// the gate, the radio call at the chained door, the door opening by itself, the title card.
// ==========================================================================
CINE_SCENES.opening = {
  duration: 64, grade: 'saturate(0.7) sepia(0.14) contrast(1.1) brightness(1.04)', exposure: 1.25,
  build(ctx) {
    const K = ctx.kit, MZ = -30;                        // manor sits at z = -30, front steps near z = -25
    CS.fogOf(ctx, 0x070a12, 0.016); ctx.sway = 0.014;
    const sky = K.sky(ctx.scene, { fog: 0x0a0f1c, fogDensity: 0.013, moonLight: 1.0, hemi: 1.0, fill: 1.3 }); ctx.scene.add(sky.group);
    const lightning = ctx.lightningLight(new THREE.DirectionalLight(0xb8c8ff, 0)); lightning.position.set(-20, 40, 30); ctx.scene.add(lightning);
    ctx.add(K.ground({ hillZ: -34 }));
    const manor = K.manor(); manor.group.position.set(0, 0, MZ); ctx.add(manor);
    // trees, the fence and the gate, and a fog bank at the foot of the hill
    [[-9, -18, 1.3], [10, -16, 1.5], [-14, -4, 1.2], [16, 4, 1.4], [-8, 14, 1.2], [11, 24, 1.3], [-12, 30, 1.5], [14, -26, 1.6], [-18, -24, 1.7]].forEach((t, i) => ctx.scene.add(K.tree(t[0], t[1], t[2], i)));
    ctx.scene.add(K.fence(-30, 30, 0, 5.2));
    const fog = K.fogBank({ y: 0.8, z: -16, spread: 70, opacity: 0.26, size: 18 }); ctx.add(fog);
    const rain = K.rain({ count: 1300, width: 36, depth: 36 }); rain.follow = ctx.camera; ctx.add(rain);
    ctx.add(K.crows(7, 0, 16, MZ, 22));

    // the pale figure in the tower window
    const gf = K.ghostFigure(); gf.group.scale.setScalar(0.95); gf.group.position.set(manor.ghostWin.x, manor.ghostWin.y - 1.55, MZ + 3.3); ctx.add(gf); gf.set(0);

    // Rowan walks up the road with a flashlight
    const rowan = ctx.puppet('rowan', 0, 0, 24, Math.PI, 'hold'); rowan.autoFace = false; CS.flashlight(ctx, rowan);
    ctx.at(0, () => { rowan.root.rotation.y = Math.PI; });
    // Dacre waits in a car beside the gate. It faces the manor.
    const car = K.car(); car.group.position.set(5.2, 0, 3.2); car.group.rotation.y = Math.PI; ctx.add(car);
    const dacre = ctx.puppet('dacre', 5.65, 0.3, 3.55, Math.PI, 'sit'); dacre.talk(false); dacre.root.scale.setScalar(0.98);
    // the radio call at the door
    ctx.at(34, () => { rowan.root.rotation.y = Math.PI; rowan.setPose('radio'); rowan.lookAt([0, 2.2, MZ + 3]); });
    ctx.at(36, () => rowan.setPose('hold'));
    ctx.at(40, () => rowan.setPose('radio'));
    ctx.at(24.8, () => dacre.talk(true)); ctx.at(33.6, () => dacre.talk(false)); ctx.at(40, () => dacre.talk(true)); ctx.at(47.4, () => dacre.talk(false));
    ctx.at(36.2, () => rowan.talk(true)); ctx.at(39.6, () => rowan.talk(false));
    // the door swings open by itself and the chains drop
    manor.doorBox.visible = false;
    const door = K.door(manor.group, 0, 3.4, 0, 2.3, 4.0);
    const glow = K.sprite(0xffa850, 7, 0, 0, 2.2, 2.6); manor.group.add(glow);
    const inner = new THREE.PointLight(0xffa860, 0, 14, 2); inner.position.set(0, 2.2, 1.8); manor.group.add(inner);
    ctx.at(48.4, () => { if (!ctx.silent) ctx.game.audio.rattle({ x: 0, y: 1.5, z: MZ + 3.5 }); });
    ctx.at(49.6, () => { manor.chains.forEach((l, i) => { l.userData.fall = 0.1 + i * 0.012; }); });
    ctx.update((dt, t) => {
      manor.chains.forEach(l => { if (l.userData.fall) { l.userData.vy = (l.userData.vy || 0) - 9 * dt; l.position.y += l.userData.vy * dt; if (l.position.y < 0.15) { l.position.y = 0.15; l.userData.vy *= -0.2; } } });
      const open = clamp((t - 50.2) / 4.8, 0, 1), e = open * open * (3 - 2 * open); door.setOpen(e, -1); glow.material.opacity = e * 0.85; inner.intensity = e * 3.2 * (0.9 + Math.sin(t * 9) * 0.1);
      gf.set(t > 6 && t < 9.8 ? Math.min(1, (t - 6) / 1.2) * Math.min(1, (9.8 - t) / 0.8) : 0);
      sky.light.intensity = 0.6 + Math.sin(t * 0.3) * 0.1;
    });
    // Rowan hesitates, then steps toward the dark doorway
    ctx.path(rowan, [[0, 0, 24], [10, 0, 24], [24, 0, 7], [25, 0, 7], [34, 0, -24.1], [52, 0, -24.1], [60, 0, -25.4]]);

    // ---- camera -----------------------------------------------------------------------
    ctx.cam([
      { t: 0, p: [-14, 5.5, 30], l: [0, 7, MZ], fov: 40 },
      { t: 10, p: [-4, 5.4, -4], l: [-2.2, 8.4, MZ + 3], fov: 32 },
      { t: 10.01, cut: true, p: [-6.2, 1.5, 29], l: [0, 1.4, 22], fov: 42 },
      { t: 17, p: [-6.0, 1.5, 21.5], l: [0, 1.4, 14.5], fov: 42 },
      { t: 17.01, cut: true, p: [0.5, 1.7, 17.4], l: [0, 1.4, 8], fov: 50 },
      { t: 24, p: [0.5, 1.7, 10.5], l: [0, 1.4, 1], fov: 50 },
      { t: 24.01, cut: true, p: [3.3, 1.35, -0.3], l: [5.75, 1.45, 3.3], fov: 36 },
      { t: 34, p: [3.8, 1.3, 0.4], l: [5.75, 1.45, 3.3], fov: 31 },
      { t: 34.01, cut: true, p: [1.5, 1.9, -20.8], l: [0, 2.0, -26.6], fov: 42 },
      { t: 41, p: [0.9, 1.7, -22.4], l: [0, 2.2, -26.8], fov: 38 },
      { t: 41.01, cut: true, p: [-2.5, 1.6, -24.1], l: [0.1, 1.5, -24.4], fov: 38 },
      { t: 47.9, p: [-2.1, 1.6, -24.3], l: [0.1, 1.5, -24.6], fov: 36 },
      { t: 48, cut: true, p: [3.4, 2.4, -19.2], l: [0, 2.2, -27.2], fov: 40 },
      { t: 56, p: [1.6, 2.2, -21.6], l: [0, 2.0, -27.8], fov: 38 },
      { t: 64, p: [0, 1.7, -26], l: [0, 1.8, -31], fov: 52 }
    ]);

    // ---- words and sounds -------------------------------------------------------------------
    ctx.chapter(1.5, 6.5, 'Hollow Manor', 'October 31, 1998. 11:14 PM'); ctx.chapters[0].kicker = 'Samhain';
    ctx.caption(3.2, 9.6, 'Hollow Manor had been silent for forty-seven years.');
    ctx.caption(11, 16.5, 'Tonight, the door is thin.');
    ctx.caption(17, 23.5, 'Rowan Vale. Freelance relic extractor. One job, one night.');
    ctx.caption(25, 33.5, 'Signal\u2019s good. You\u2019re live, my friend. Remember what we agreed. In and out. One object. The horned skull in the family crypt. Nothing else is worth your time.', 'DACRE');
    ctx.caption(36.2, 39.8, 'Nothing else is worth my time. Right.', 'ROWAN');
    ctx.caption(40.2, 47.6, 'The owners are very particular about discretion. The house is empty. Quite\u2026 empty.', 'DACRE');
    ctx.caption(51, 56.5, 'And the door opened by itself.');
    ctx.chapter(58, 63.6, 'Take the skull. Stay quiet.', 'Be gone by dawn.');
    ctx.at(0, () => { if (!ctx.silent) { ctx.game.audio.rainOn(0.8); } });
    [[4.6, 1.6], [13.1, 1.4], [29.2, 1.2], [47.7, 1.0]].forEach(f => { ctx.flash(f[0], 1.2); ctx.sfx(f[0] + f[1], 'thunder'); });
    ctx.sfx(24.8, 'static'); ctx.sfx(40, 'static'); ctx.sfx(6.2, 'whisper', null, 0.35); ctx.sfx(50.2, 'creak', null, 0.5, 0.2); ctx.sfx(50.4, 'gust', 0.3);
    ctx.sfx(58, 'tone', { type: 'sine', f0: 196, dur: 3.5, gain: 0.2 });
  }
};

// ==========================================================================
// ROOM FLASHBACKS. Each plays once, the first time the player enters the room.
// They share one interior helper: a lit box room with a window or two and a dim ambient.
// ==========================================================================
CS.interior = function (ctx, name, w, d, h, o) {
  o = o || {}; const K = ctx.kit;
  CS.fogOf(ctx, o.fog || 0x07060a, o.fogDensity || 0.035);
  CS.ambient(ctx, o.ambient || 0x4a4058, o.ambientK === undefined ? 0.85 : o.ambientK);
  const hemi = new THREE.HemisphereLight(o.sky || 0x6a6090, 0x14100c, o.hemi === undefined ? 0.5 : o.hemi); ctx.scene.add(hemi);
  const room = K.room(name, w, d, h, o.room); ctx.add(room); return room.group;
};
CS.glass = function (ctx, g, x, y, z, yaw, w, h) { const f = ctx.kit.windowFrame(g, x, y, z, yaw, w, h); return f; };
// a candle with a light that follows a person's hand or a table
CS.lit = function (ctx, parent, x, y, z, h) { const c = ctx.kit.candle(parent, x, y, z, h || 0.22, true); ctx.add(c); return c; };

// ---- PARLOR (24 s): Margaret's death and Elspeth's lullaby -------------------------------------
CINE_SCENES.parlor = {
  duration: 24, grade: 'saturate(0.75) sepia(0.28) contrast(1.1) brightness(1.0)', exposure: 1.15,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'parlor', 8, 7, 3.4, { ambient: 0x5a4838, ambientK: 1.0 });
    const fire = K.fireplace(g, 0, -3.2, true); ctx.add(fire);
    K.rug(g, 0, -0.6, 4.2, 3.2, 'parlorrug', '#3a1418');
    K.armchair(g, -0.1, -1.3, Math.PI, 0x4a1a22);
    K.bookshelf(g, -3.85, 0.6, Math.PI / 2, 2.4); K.bookshelf(g, 3.85, 0.6, -Math.PI / 2, 2.4);
    K.table(g, 2.2, -1.5, 0.9, 0.9, 0.55); CS.lit(ctx, g, 2.2, 0.6, -1.5, 0.2);
    CS.glass(ctx, g, -2.5, 1.8, 3.46, Math.PI, 1.1, 1.8); CS.glass(ctx, g, 2.5, 1.8, 3.46, Math.PI, 1.1, 1.8);
    const margaret = ctx.puppet('margaret', -0.1, 0, -1.25, Math.PI, 'sit'); margaret.root.position.y = 0.0;
    const elspeth = ctx.puppet('elspeth', 0.95, 0, -1.2, -Math.PI / 2, 'kneel'); elspeth.talk(false);
    const josiah = ctx.puppet('josiah', 2.4, 0, -2.5, -2.4, 'stand'); josiah.lookAt([-0.1, 1.2, -1.2]);
    const notes = K.notes(g, -0.1, 1.2, -1.2); ctx.add(notes);
    ctx.at(13, () => { margaret.setPose('sitSlump'); notes.rate = 0; elspeth.setPose('kneelCry'); });
    ctx.at(2, () => margaret.talk(true)); ctx.at(12.5, () => margaret.talk(false));
    ctx.update((dt, t) => { fire.power = t < 13 ? 1 : Math.max(0.2, 1 - (t - 13) / 8); });
    ctx.cam([
      { t: 0, p: [3.2, 1.7, 2.6], l: [0, 1.0, -1.8], fov: 46 },
      { t: 7.5, p: [2.4, 1.55, 1.4], l: [-0.1, 1.0, -1.4], fov: 42 },
      { t: 7.51, cut: true, p: [1.6, 1.3, 0.5], l: [-0.1, 1.15, -1.25], fov: 34 },
      { t: 14, p: [1.35, 1.25, 0.2], l: [-0.1, 1.05, -1.25], fov: 30 },
      { t: 14.01, cut: true, p: [-0.4, 1.0, 0.2], l: [0.95, 0.75, -1.2], fov: 38 },
      { t: 19, p: [-0.2, 0.95, 0.0], l: [0.95, 0.7, -1.2], fov: 36 },
      { t: 19.01, cut: true, p: [-3, 1.7, 1.5], l: [2.4, 1.3, -2.5], fov: 44 },
      { t: 24, p: [-2.5, 1.6, 1.2], l: [2.4, 1.3, -2.5], fov: 38 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Parlor', '1897');
    ctx.caption(4.5, 11.5, 'In the autumn of 1897, Margaret Hollow was dying of fever.');
    ctx.caption(14.5, 21, 'Her lullaby was the last thing Elspeth heard her mother sing.');
    ctx.sfx(1.5, 'tone', { type: 'sine', f0: 262, dur: 2.5, gain: 0.07 }); ctx.sfx(4.5, 'tone', { type: 'sine', f0: 330, dur: 3, gain: 0.07 }); ctx.sfx(8, 'tone', { type: 'sine', f0: 247, dur: 4, gain: 0.07 });
    ctx.sfx(13, 'tone', { type: 'sine', f0: 110, dur: 4, gain: 0.12 });
  }
};

// ---- BEDROOM (26 s): sleepwalking, and Dr. Venn is dismissed --------------------------------------
CINE_SCENES.bedroom = {
  duration: 26, grade: 'saturate(0.6) sepia(0.12) contrast(1.12) brightness(0.98)', exposure: 1.1,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'bedroom', 7, 6, 3.2, { ambient: 0x38426a, ambientK: 1.0, sky: 0x5068a8 });
    K.bed(g, -1.6, -1.6, 0); K.rug(g, 0.8, 0.4, 3, 2.2, 'bedrug', '#26303c');
    K.table(g, 1.1, -2.7, 1.0, 0.5, 0.7); const win = CS.glass(ctx, g, 0.8, 1.8, -2.96, 0, 1.3, 1.8);
    const moon = new THREE.SpotLight(0x90a8e8, 3, 14, 0.7, 0.6, 1.4); moon.position.set(0.8, 2.4, -2.5); moon.target.position.set(0.5, 0, 0.6); g.add(moon, moon.target);
    const elspeth = ctx.puppet('elspeth', -1.6, 0.82, 0.5, 0, 'lie'); elspeth.root.position.set(-1.6, 0.85, 0.4);
    const josiah = ctx.puppet('josiah', 2.6, 0, 2.2, Math.PI, 'stand'); josiah.root.visible = false;
    const lant = K.lantern(josiah.handR, 0, -0.15, 0.1, 0xffb060, true); ctx.add(lant); lant.group.scale.setScalar(1.3);
    const venn = ctx.puppet('venn', 1.4, 0, 1.4, -2.2, 'stand'); venn.root.visible = false;
    ctx.at(2.5, () => { elspeth.root.position.set(-1.6, 0, 0.5); elspeth.setPose('arms'); elspeth.root.rotation.y = 0; });
    ctx.at(2.4, () => elspeth.setPose('stand', true));
    ctx.path(elspeth, [[0, -1.6, 0.4], [2.5, -1.6, 0.45], [4, -1.0, 1.2], [8, 0.9, 2.2], [12, 0.9, 2.2]]);
    ctx.at(1.2, () => { elspeth.talk(true); }); ctx.at(10, () => elspeth.talk(false));
    ctx.at(6, () => { josiah.root.visible = true; josiah.place(2.7, 0, 2.6, -2.0); josiah.lookAt([0.9, 1.3, 2.2]); josiah.setPose('hold'); });
    ctx.at(12.5, () => { josiah.root.visible = false; elspeth.root.visible = false; venn.root.visible = true; });
    ctx.at(12.8, () => { elspeth.root.visible = true; elspeth.place(-1.6, 0.85, 0.4, 0); elspeth.setPose('lie', true); venn.place(-0.4, 0, 0.4, 1.0); venn.lookAt([-1.6, 1.0, 0.4]); });
    ctx.at(17.5, () => { venn.setPose('stand'); venn.lookAt(null); venn.root.rotation.y = 0.2; });
    ctx.at(18.5, () => { josiah.root.visible = true; josiah.place(1.8, 0, -0.3, -1.4); josiah.setPose('point'); josiah.lookAt([0.6, 1.5, 0.7]); });
    ctx.cam([
      { t: 0, p: [3.0, 1.6, 2.6], l: [-1.2, 0.9, -0.6], fov: 48 },
      { t: 5.9, p: [2.6, 1.5, 2.2], l: [-1.2, 0.8, 0.2], fov: 42 },
      { t: 6, cut: true, p: [-0.8, 1.5, -0.4], l: [1.0, 1.4, 2.2], fov: 40 },
      { t: 12.4, p: [-0.2, 1.5, 0.2], l: [1.3, 1.4, 2.2], fov: 34 },
      { t: 12.5, cut: true, p: [-1.0, 1.9, 2.4], l: [-1.4, 0.8, 0.4], fov: 50 },
      { t: 18.4, p: [-0.4, 1.8, 2.2], l: [-1.2, 0.9, 0.4], fov: 42 },
      { t: 18.5, cut: true, p: [-1.8, 1.5, 1.8], l: [1.6, 1.4, -0.2], fov: 42 },
      { t: 26, p: [-1.4, 1.5, 1.5], l: [1.6, 1.4, -0.2], fov: 36 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Bedroom', 'Winter, 1897');
    ctx.caption(2.2, 6, 'Elspeth began to walk in her sleep.');
    ctx.caption(6.5, 11, 'Josiah, don\u2019t be cruel.', 'ELSPETH');
    ctx.caption(13.2, 17.5, 'There is nothing wrong with the girl\u2019s body, Mr. Hollow. Something else troubles her.', 'DR. VENN');
    ctx.caption(19, 24, 'Josiah dismissed the doctor that same morning. Nobody else was ever allowed to look.');
    ctx.sfx(6.3, 'whisper', null, 0.4); ctx.sfx(1.5, 'creak', null, 0.3, 0.2);
  }
};

// ---- KITCHEN (22 s): Mrs. Pell tries to help --------------------------------------------------------
CINE_SCENES.kitchen = {
  duration: 22, grade: 'saturate(0.7) sepia(0.25) contrast(1.1) brightness(1.0)', exposure: 1.15,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'kitchen', 7, 6, 3.2, { ambient: 0x4a4a3a, ambientK: 0.9 });
    K.table(g, 0, -0.4, 2.2, 1.0, 0.85, 0x5a4026); K.barrel(g, -3.0, -2.5); K.barrel(g, -2.4, -2.7); K.crate(g, 3.0, -2.4, 0.7, 0.3);
    K.door(g, 2.0, -2.95, 0, 1.0, 2.2);
    CS.lit(ctx, g, 0.3, 0.88, -0.4, 0.22); const lant = K.lantern(g, -1.6, 2.7, -2.6, 0xffb060, true); ctx.add(lant);
    const pell = ctx.puppet('pell', -0.4, 0, 0.45, Math.PI, 'work'); pell.talk(false);
    const josiah = ctx.puppet('josiah', 2.1, 0, 2.2, Math.PI, 'stand'); josiah.root.visible = false;
    ctx.at(8, () => { josiah.root.visible = true; josiah.place(2.2, 0, -1.6, Math.PI); josiah.lookAt([0, 1.5, 0]); });
    ctx.at(9.2, () => { josiah.setPose('point'); }); ctx.at(14.2, () => { pell.setPose('wipe'); josiah.setPose('stand'); });
    ctx.at(3, () => pell.talk(true)); ctx.at(7.5, () => pell.talk(false)); ctx.at(10, () => josiah.talk(true)); ctx.at(14, () => josiah.talk(false));
    ctx.path(pell, [[0, -0.4, 0.45], [7, -0.4, 0.45], [9, -0.3, 0.5]]);
    ctx.cam([
      { t: 0, p: [-2.4, 1.6, 2.6], l: [-0.1, 1.0, -0.4], fov: 46 },
      { t: 8, p: [-1.6, 1.5, 2.0], l: [-0.2, 1.1, -0.2], fov: 38 },
      { t: 8.01, cut: true, p: [-1.0, 1.7, 2.4], l: [1.6, 1.3, -1.8], fov: 44 },
      { t: 15, p: [-0.6, 1.6, 1.9], l: [1.8, 1.4, -1.6], fov: 38 },
      { t: 15.01, cut: true, p: [1.1, 1.5, 1.6], l: [-0.4, 1.3, 0.5], fov: 36 },
      { t: 22, p: [0.9, 1.4, 1.4], l: [-0.4, 1.3, 0.5], fov: 32 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Kitchen', '1898');
    ctx.caption(2.5, 8, 'Mrs. Pell cooked for the family. She saw that the girl was no longer eating.');
    ctx.caption(9.5, 14, 'Her place is below, Mrs. Pell. Leave it be.', 'JOSIAH');
    ctx.caption(15.5, 21, 'Mrs. Pell left bread at the cellar door every night until she was let go.');
    ctx.sfx(8.2, 'creak', null, 0.4, 0.2);
  }
};

// ---- LIBRARY (24 s): Josiah finds the rite and the skull -----------------------------------------
CINE_SCENES.library = {
  duration: 24, grade: 'saturate(0.65) sepia(0.3) contrast(1.12) brightness(1.0)', exposure: 1.15,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'library', 8, 7, 3.6, { ambient: 0x4a3a28, ambientK: 0.85 });
    K.bookshelf(g, -3.85, -0.5, Math.PI / 2, 3.2); K.bookshelf(g, 3.85, -0.5, -Math.PI / 2, 3.2); K.bookshelf(g, -1.6, -3.4, 0, 2.4); K.bookshelf(g, 1.6, -3.4, 0, 2.4);
    K.table(g, 0, 0.2, 2.0, 1.0, 0.8, 0x2f1d10); K.chair(g, 0, 1.0, Math.PI); K.rug(g, 0, 0.4, 3.6, 2.8, 'librug', '#2a2418');
    CS.lit(ctx, g, -0.5, 0.83, 0.1, 0.24); CS.lit(ctx, g, 0.7, 0.83, 0.4, 0.2);
    // glass case on a pedestal with the skull
    const ped = new THREE.Group(); ped.position.set(3.0, 0, 1.9); g.add(ped); K.box(ped, 0.7, 1.0, 0.7, 0x2a1c10, 0, 0.5, 0);
    const caseM = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.56), new THREE.MeshStandardMaterial({ color: 0x9fb8b0, transparent: true, opacity: 0.18, roughness: 0.1 })); caseM.position.y = 1.27; ped.add(caseM);
    const skull = K.skull(1.3); ctx.add(skull); skull.group.position.set(3.0, 1.12, 1.9); skull.light.intensity = 0;
    const page = CS.paper(ctx, 0.6, 0.42, ['THE RITE OF BINDING', '', 'what is given at the', 'threshold is kept', 'forever.', '', '[ horned skull ]']); page.rotation.x = -Math.PI / 2; page.position.set(0.1, 0.84, 0.2); g.add(page);
    const josiah = ctx.puppet('josiah', 0, 0, 1.0, Math.PI, 'sit'); josiah.root.position.set(0, 0, 1.0); josiah.setPose('work', true);
    const hv = new THREE.Vector3(), glowS = K.sprite(0x39ff7a, 1.4, 0, 3.0, 1.2, 1.9); g.add(glowS);
    ctx.at(10, () => { josiah.setPose('stand'); josiah.lookAt(null); });
    ctx.path(josiah, [[0, 0, 1.55], [9.5, 0, 1.55], [11.5, 1.0, 2.2], [14.2, 2.2, 2.1], [18, 2.2, 2.1], [21, 1.0, 1.6]]);
    ctx.at(14.2, () => { josiah.setPose('arms'); josiah.root.rotation.y = Math.PI / 2; });
    ctx.at(16.5, () => { josiah.setPose('hold'); });
    ctx.update((dt, t) => {
      const p = clamp((t - 10) / 4, 0, 1); glowS.material.opacity = p * 0.9; skull.light.intensity = p * 2;
      if (t > 17) { josiah.handR.getWorldPosition(hv); skull.group.position.lerp(hv.add(new THREE.Vector3(0, 0.12, 0)), 0.2); caseM.visible = false; }
    });
    ctx.cam([
      { t: 0, p: [-2.8, 1.8, 3.0], l: [0, 1.0, 0.4], fov: 46 },
      { t: 9.9, p: [-1.2, 1.7, 2.8], l: [0.1, 0.9, 0.4], fov: 36 },
      { t: 10, cut: true, p: [-0.3, 1.5, -1.5], l: [3.0, 1.2, 1.9], fov: 40 },
      { t: 16.5, p: [0.4, 1.5, -1.0], l: [3.0, 1.25, 1.9], fov: 34 },
      { t: 16.6, cut: true, p: [0.9, 1.6, 3.3], l: [2.8, 1.25, 2.0], fov: 36 },
      { t: 24, p: [0.6, 1.6, 3.3], l: [2.6, 1.3, 2.0], fov: 36 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Library', '1898');
    ctx.caption(2.5, 9.5, 'Josiah found the rite in a book older than the house. It asked for a vessel, and a sacrifice at the threshold.');
    ctx.caption(11, 16, 'The horned skull had sat behind glass for two hundred years.');
    ctx.caption(18, 23, 'He took it down without a tremor in his hands.');
    ctx.sfx(10.5, 'tone', { type: 'sine', f0: 82, dur: 5, gain: 0.14 }); ctx.sfx(10.2, 'whisper', null, 0.4);
  }
};

// ---- NURSERY (22 s): Thomas is locked in and hears it -------------------------------------------
CINE_SCENES.nursery = {
  duration: 22, grade: 'saturate(0.55) sepia(0.15) contrast(1.15) brightness(0.98)', exposure: 1.1,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'nursery', 6, 5, 3.0, { ambient: 0x60589a, ambientK: 1.6, sky: 0x7a7ac0, hemi: 0.9 });
    K.bed(g, -2.0, -1.4, 0); g.children[g.children.length - 1].scale.set(0.7, 0.8, 0.8); K.rug(g, 0.4, 0.3, 2.4, 2.0, 'nurrug', '#2a3048');
    K.table(g, 1.8, -1.6, 1.1, 0.6, 0.55, 0x4a3a2a); K.chair(g, 1.8, -0.9, 0); K.crate(g, -2.5, 1.7, 0.45, 0.4);
    K.door(g, 0.0, 2.46, Math.PI, 1.0, 2.2);
    CS.glass(ctx, g, 0.4, 1.8, -2.46, 0, 0.9, 1.4);
    const cand = CS.lit(ctx, g, 1.8, 0.58, -1.6, 0.14);
    const thomas = ctx.puppet('thomas', 0.2, 0, 1.6, 0, 'knock'); thomas.root.rotation.y = Math.PI;
    const letter = CS.paper(ctx, 0.3, 0.2, ['Dear Papa,', '', 'I would have', 'opened the door.']); letter.rotation.x = -Math.PI / 2; letter.position.set(1.8, 0.59, -1.6); letter.visible = false; g.add(letter);
    ctx.at(10, () => { thomas.place(1.8, 0, -0.65, 0); thomas.setPose('sit', true); thomas.root.position.y = 0; thomas.setPose('work'); letter.visible = true; thomas.lookAt([1.8, 0.6, -1.6]); thomas.talk(false); });
    ctx.at(10, () => { thomas.root.rotation.y = Math.PI; });
    ctx.path(thomas, [[0, 0.2, 1.6], [9.8, 0.2, 1.6], [10, 1.8, -0.7]]);
    ctx.update((dt, t) => { if (t < 9.5) { thomas.root.rotation.z = 0; thomas.root.position.x = 0.2 + Math.sin(t * 18) * 0.012; } });
    ctx.cam([
      { t: 0, p: [-2.3, 1.5, -2.0], l: [0.2, 0.9, 1.9], fov: 46 },
      { t: 5, p: [-1.7, 1.4, -1.6], l: [0.2, 1.0, 2.0], fov: 40 },
      { t: 5.01, cut: true, p: [1.9, 1.3, -0.4], l: [0.2, 1.0, 2.4], fov: 42 },
      { t: 9.8, p: [1.6, 1.2, 0.0], l: [0.1, 1.0, 2.4], fov: 38 },
      { t: 9.81, cut: true, p: [0.3, 1.5, 1.4], l: [1.8, 0.7, -1.2], fov: 42 },
      { t: 22, p: [0.8, 1.3, 0.6], l: [1.8, 0.65, -1.4], fov: 30 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Nursery', 'Samhain Eve, 1898');
    ctx.caption(2.2, 8.5, 'On the last night, Josiah locked his son in the nursery. Thomas heard everything.');
    ctx.caption(11, 16, 'Papa, let me out!', 'THOMAS');
    ctx.caption(16.5, 21, 'He never learned how to forgive himself. Neither did the house.');
    [[3.5, 90], [6.5, 130], [8, 70]].forEach(s => ctx.sfx(s[0], 'tone', { type: 'sawtooth', f0: 460 + s[1], f1: 300, dur: 1.6, gain: 0.05 }));
    for (let i = 0; i < 9; i++) ctx.sfx(1 + i * 0.95, 'thud', null, 0.25);
  }
};

// ---- CELLAR (22 s): the binding is carved ------------------------------------------------------
CINE_SCENES.cellar = {
  duration: 22, grade: 'saturate(0.6) sepia(0.22) contrast(1.15) brightness(0.98)', exposure: 1.1,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'cellar', 8, 7, 3.0, { ambient: 0x2a3040, ambientK: 0.8, room: { stoneFloor: true } });
    K.barrel(g, -3.2, -2.6); K.barrel(g, -2.5, -2.9); K.crate(g, 3.2, -2.6, 0.8, 0.3); K.crate(g, 2.4, -2.9, 0.6, 0.1); K.barrel(g, 3.3, 1.5);
    K.workbench(g, 0, -1.3, 0);
    const lant = K.lantern(g, -1.0, 0.98, -1.3, 0xffb060, true); ctx.add(lant); CS.lit(ctx, g, 1.0, 0.96, -1.3, 0.2);
    const skull = K.skull(1.1); ctx.add(skull); skull.group.position.set(0, 1.0, -1.25); skull.light.intensity = 0.4;
    const rune = K.runeCircle(2.0); ctx.add(rune); rune.group.position.set(0, 0.03, 0.5);
    const sp = K.sparks(g, 0, 1.05, -1.2, 0xffc060); ctx.add(sp);
    const josiah = ctx.puppet('josiah', 0, 0, -0.55, 0, 'work');
    ctx.update((dt, t) => {
      rune.power = clamp((t - 8) / 8, 0, 1); skull.light.intensity = 0.3 + rune.power * 0.9;
      if (t > 1 && t < 17 && Math.sin(t * 7) > 0.92) sp.emit(2, 1.2);
      josiah.target.rax = -1.1 + Math.sin(t * 7) * 0.25;
    });
    ctx.cam([
      { t: 0, p: [-2.6, 1.7, 2.2], l: [0, 1.0, -1.0], fov: 46 },
      { t: 8, p: [-1.0, 1.45, 0.9], l: [0, 1.0, -1.2], fov: 36 },
      { t: 8.01, cut: true, p: [1.7, 1.5, 0.4], l: [0, 1.0, -1.25], fov: 32 },
      { t: 15, p: [1.3, 1.4, 0.2], l: [0, 1.0, -1.25], fov: 30 },
      { t: 15.01, cut: true, p: [0, 3.0, 3.4], l: [0, 0.4, 0.2], fov: 52 },
      { t: 22, p: [0, 2.6, 2.6], l: [0, 0.6, 0.0], fov: 48 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Cellar', 'Samhain Eve, 1898');
    ctx.caption(2.2, 9, 'Below the house, Josiah carved the binding into the skull, line by line.');
    ctx.caption(10, 15, 'Each cut asked for a name. He gave it his daughter\u2019s.');
    ctx.caption(16, 21, 'The cellar has not been warm since.');
    ctx.sfx(2, 'tone', { type: 'triangle', f0: 1800, f1: 1200, dur: 0.05, gain: 0.04 }); ctx.sfx(10, 'tone', { type: 'sine', f0: 70, dur: 6, gain: 0.16 }); ctx.sfx(10, 'whisper', null, 0.5);
  }
};

// ---- CRYPT (30 s): the rite, the gate, Elspeth becomes the ghost -------------------------------------
CINE_SCENES.crypt = {
  duration: 30, grade: 'saturate(0.55) sepia(0.12) contrast(1.18) brightness(0.98)', exposure: 1.15,
  build(ctx) {
    const K = ctx.kit, g = CS.interior(ctx, 'crypt', 9, 9, 3.8, { ambient: 0x2a3a3a, ambientK: 0.9, sky: 0x40605a, room: { stoneFloor: true } });
    const altar = K.altar(g, 0, -3.2); const rune = K.runeCircle(2.6); ctx.add(rune); rune.group.position.set(0, 0.03, -0.2);
    [[-3.6, -3.6], [3.6, -3.6], [-3.6, 0.5], [3.6, 0.5], [-1.8, -1.6], [1.8, -1.6], [-1.8, 1.2], [1.8, 1.2]].forEach((c, i) => ctx.add(K.candle(g, c[0], 0, c[1], 0.9 + (i % 3) * 0.2, i < 4)));
    const skull = K.skull(1.3); ctx.add(skull); skull.group.position.set(0, 3, 2); skull.light.intensity = 0;
    const gate = K.gateBars(g, 0, 4.4, 0, 1.6, 2.6); gate.setDrop(0); ctx.add(gate);
    const josiah = ctx.puppet('josiah', 0, 0, 3.9, Math.PI, 'stand'), els = ctx.puppet('elspeth', 0.3, 0, 3.9, Math.PI, 'stand');
    josiah.root.position.set(-0.4, 0, 3.9); els.talk(false);
    const hv = new THREE.Vector3(), flare = K.sprite(0xa8ffd0, 6, 0, 0, 1.6, -0.2); g.add(flare);
    const faceTex = Cache._t && Cache._t['tex.ghostface'];
    let face = null, eyes = null;
    if (faceTex) { face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.38), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, opacity: 0, depthWrite: false })); face.position.set(0, 0.03, 0.13); els.head.add(face); }
    eyes = K.sprite(0xa8e8ff, 0.8, 0, 0, 0.05, 0.14); els.head.add(eyes);
    ctx.path(josiah, [[0, -0.4, 3.7], [1, -0.4, 3.7], [6, -0.4, -0.6], [8, -0.4, -0.6], [9, 0, -1.4], [11, 0, -1.4], [11.5, 0, -1.2], [13.5, 0.2, -1.1], [15, 0.2, -1.1], [17.5, 1.0, 3.0], [18.3, 0.0, 4.9], [30, 0, 4.9]]);
    ctx.path(els, [[0, 0.3, 3.9], [1, 0.3, 3.9], [6.4, 0.5, 0.3], [30, 0.5, 0.3]]);
    ctx.at(9, () => { josiah.setPose('arms'); }); ctx.at(11.5, () => josiah.setPose('hold'));
    ctx.at(13.2, () => { josiah.setPose('stand'); }); ctx.at(14, () => els.setPose('pray'));
    ctx.at(19, () => { els.setPose('cower'); els.lookAt([0, 1.4, 4.4]); ctx.game.audio.doorSlam && !ctx.silent && ctx.game.audio.doorSlam({ x: 0, y: 1, z: 4.4 }); });
    ctx.at(21, () => { els.setPose('stand'); });
    ctx.update((dt, t) => {
      rune.power = clamp((t - 7) / 6, 0, 1) * (t > 26 ? 1.4 : 1);
      if (t < 11.5) { skull.group.position.set(0, 3, 2); } else if (t < 13.5) { josiah.handR.getWorldPosition(hv); skull.group.position.copy(hv); } else skull.group.position.lerp(new THREE.Vector3(0, 1.3, -3.2), 0.12);
      skull.light.intensity = t > 11 ? 2.2 : 0;
      const drop = clamp((t - 19) / 0.35, 0, 1); gate.setDrop(drop);
      const f = clamp((t - 24) / 4, 0, 1); if (face) face.material.opacity = f; eyes.material.opacity = f * 0.9; flare.material.opacity = Math.max(0, f - 0.3) * 0.25;
      if (t > 22) { els.root.rotation.y = Math.PI + Math.min(1, (t - 22) / 2.5) * Math.PI; els.lookAt(null); }
      els.head.rotation.z = f * 0.3 + (f > 0.2 && Math.sin(t * 40) > 0.97 ? 0.1 : 0);
    });
    ctx.cam([
      { t: 0, p: [0, 1.9, -3.8], l: [0, 1.0, 3.9], fov: 55 },
      { t: 6, p: [1.5, 1.8, -1.8], l: [0, 1.1, 1.2], fov: 46 },
      { t: 6.01, cut: true, p: [-3.2, 1.6, 2.4], l: [0, 1.1, -1.0], fov: 44 },
      { t: 13.3, p: [-2.4, 1.5, 1.2], l: [0, 1.2, -1.4], fov: 38 },
      { t: 13.31, cut: true, p: [0.1, 1.6, -2.2], l: [0.4, 1.3, 0.5], fov: 40 },
      { t: 18.8, p: [0.5, 1.6, -1.9], l: [0.4, 1.3, 0.8], fov: 40 },
      { t: 18.81, cut: true, p: [-2.0, 1.6, 0.6], l: [0, 1.3, 4.4], fov: 40 },
      { t: 22.6, p: [-1.2, 1.5, 1.2], l: [0, 1.3, 4.0], fov: 38 },
      { t: 22.61, cut: true, p: [0.5, 1.5, 3.0], l: [0.5, 1.42, 0.3], fov: 32 },
      { t: 30, p: [0.5, 1.5, 2.1], l: [0.5, 1.42, 0.3], fov: 30 }
    ]);
    ctx.chapter(0.8, 4.2, 'The Crypt', 'Samhain, 1898');
    ctx.caption(2.2, 9.5, 'On Samhain night he led his daughter below, and told her it was a game.');
    ctx.caption(10, 16, 'The skull would hold what the gate would keep.');
    ctx.caption(19.6, 24, 'The gate closed behind him. Elspeth was not meant to leave.');
    ctx.caption(25, 29.5, 'She waited. And whatever waited with her wore her face.');
    ctx.sfx(11, 'tone', { type: 'sine', f0: 65, dur: 8, gain: 0.2 }); ctx.sfx(19, 'gust', 0.5); ctx.flash(19, 0.8); ctx.sfx(27, 'whisper', null, 0.6);
  }
};
