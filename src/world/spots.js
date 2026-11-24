'use strict';
// ==========================================================================
// SPOTS: furniture that can hold an item (drawers, chests, search props...).
// Everything animates through Openable / eased tweens. Contents are WorldItems.
// ==========================================================================
const HIT_GEO = () => Cache.geo('hit.sph', () => new THREE.SphereGeometry(0.22, 8, 6));
const HIT_MAT = () => Cache.mat('hit.mat', () => new THREE.MeshBasicMaterial({ visible: false }));

// Wall the point sits against: returns ry that makes local +Z face into the room
function wallFacing(room, x, z) {
  const b = room.bounds, d = [Math.abs(x - b.minX), Math.abs(x - b.maxX), Math.abs(z - b.minZ), Math.abs(z - b.maxZ)];
  const i = d.indexOf(Math.min.apply(null, d));
  return [Math.PI / 2, -Math.PI / 2, 0, Math.PI][i];
}

function makeSpotItem(world, room, spot, desc, parent, lx, ly, lz) {
  const game = world.game;
  if (!desc) return null;
  const extra = desc.id === 'note' ? { text: desc.text, truthful: desc.truthful, tpl: desc.tpl, clue: desc.clue } : (desc.spare ? { spare: true } : {});
  const item = game.inventory.makeItem(desc.id, extra);
  const wi = new WorldItem(game, item);
  wi.attach(parent, lx, ly, lz);
  wi.spot = spot; wi.room = room;
  const hit = new THREE.Mesh(HIT_GEO(), HIT_MAT()); hit.position.y = 0.08; wi.mesh.add(hit);
  const meshes = []; wi.mesh.traverse(o => { if (o.isMesh) meshes.push(o); });
  wi.interactable = new Interactable(game, {
    id: 'item:' + spot.def.id, room, meshes, reach: 2.7,
    prompt: () => itemPrompt(item),
    onInteract: () => wi.pickUp()
  });
  spot.items.push(wi);
  return wi;
}

function setItemHidden(wi, hidden) {
  wi.setVisible(!hidden);
  wi.interactable.enabled = !hidden;
}

function revealItem(world, wi) {
  if (!wi) return;
  setItemHidden(wi, false);
  const m = wi.mesh, s = m.scale.x;
  m.scale.setScalar(0.01);
  world.game.tweens.add({ dur: 0.45, ease: Ease.outBackBig, update: v => m.scale.setScalar(Math.max(0.01, s * v)) });
}

function buildSpot(world, room, def, desc) {
  const game = world.game, spot = { def, room, items: [], ia: null, opened: false };
  world.spots[def.id] = spot; room.spots.push(spot);
  const wood = world.mat(0x2a1a10, 0.7, 0.1), wood2 = world.mat(0x3a2616, 0.6, 0.1);
  const grp = new THREE.Group(); grp.position.set(def.x, 0, def.z); grp.rotation.y = def.ry || 0; room.group.add(grp);
  const box = (g, mat, w, h, d, x, y, z) => { const m = new THREE.Mesh(Cache.geo('box:' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const note = desc && desc.id === 'note';
  // the library strongbox is a puzzle: dials, an electric bolt (see missions.js)
  if (def.kind === 'safe') return game.missions.buildSafe(world, room, spot, def, desc, grp);
  // contents positioned per kind below; all contents start hidden unless on a surface
  if (def.kind === 'surface') {
    if (def.prop === 'stand') {
      box(grp, wood, 0.7, 0.05, 0.7, 0, def.y - 0.025, 0); box(grp, wood, 0.08, def.y - 0.05, 0.08, 0, (def.y - 0.05) / 2, 0);
      box(grp, wood, 0.4, 0.04, 0.4, 0, 0.02, 0);
      world.addCollider(room, def.x, def.z, 0.3, 0.3);
    } else if (def.prop === 'shelf') {
      const iron = world.mat(0x1c1c20, 0.5, 0.8);
      box(grp, iron, 1.4, 0.04, 0.5, 0, def.y - 0.02, 0); box(grp, iron, 1.4, 0.04, 0.5, 0, 0.5, 0); box(grp, iron, 1.4, 0.04, 0.5, 0, 1.7, 0);
      [-0.68, 0.68].forEach(x => box(grp, iron, 0.05, 1.75, 0.5, x, 0.88, 0));
      world.addCollider(room, def.x, def.z, 0.3, 0.75);
    }
    const wi = makeSpotItem(world, room, spot, desc, room.group, def.x, def.y, def.z);
    if (wi) { wi.mesh.rotation.y = Math.random() * 6; }
    return spot;
  }

  if (def.kind === 'drawer') {
    const w = def.w, h = def.h, d = def.d;
    box(grp, wood, w, h, d, 0, h / 2, 0).userData.occ = true;
    box(grp, wood2, w + 0.06, 0.04, d + 0.06, 0, h + 0.02, 0);
    room.occluders.push(grp.children[0]);
    const dr = new THREE.Group(); dr.position.set(0, 0, 0); grp.add(dr);
    const front = box(dr, wood2, w * 0.86, h * 0.34, 0.05, 0, h * 0.7, d / 2 + 0.01);
    const knob = new THREE.Mesh(Cache.geo('door.knob', () => new THREE.SphereGeometry(0.045, 10, 8)), world.mat(0xb08a45, 0.3, 0.9)); knob.position.set(0, h * 0.7, d / 2 + 0.06); dr.add(knob);
    const tray = box(dr, wood, w * 0.8, 0.03, d * 0.8, 0, h * 0.7 - 0.12, d / 2 - d * 0.4);
    box(dr, wood, 0.03, 0.1, d * 0.8, -w * 0.4, h * 0.7 - 0.07, d / 2 - d * 0.4); box(dr, wood, 0.03, 0.1, d * 0.8, w * 0.4, h * 0.7 - 0.07, d / 2 - d * 0.4);
    world.addCollider(room, def.x, def.z, Math.abs(Math.cos(def.ry || 0)) * w / 2 + Math.abs(Math.sin(def.ry || 0)) * d / 2, Math.abs(Math.sin(def.ry || 0)) * w / 2 + Math.abs(Math.cos(def.ry || 0)) * d / 2);
    const wi = makeSpotItem(world, room, spot, desc, dr, 0, h * 0.7 - 0.1, d / 2 - d * 0.45);
    if (wi) setItemHidden(wi, true);
    const slide = d * 0.9;
    spot.ia = new Openable(game, {
      id: 'spot:' + def.id, room, meshes: [front, tray], reach: 2.6, durOpen: 0.55, durClose: 0.45, easeOpen: Ease.outCubic,
      prompt: () => (spot.ia.isOpen ? 'Close drawer' : def.label),
      apply: v => { dr.position.z = v * slide; },
      hooks: { opening: () => { game.audio.drawer(game.spotPos(def)); game.makeNoise(def.x, def.z, room.id, 0.12, 'drawer'); if (wi) { setItemHidden(wi, false); } }, closing: () => game.audio.drawer(game.spotPos(def)), closed: () => { if (wi && wi.mesh.parent === dr) setItemHidden(wi, true); } },
      onInteract: () => { spot.ia.toggle(false); spot.opened = true; }
    });
    spot.ia.onUse = null;
    return spot;
  }

  if (def.kind === 'container') {
    const w = def.w, h = def.h, d = def.d, t = 0.05;
    const hollow = def.lid !== 'slide';
    if (hollow) {
      box(grp, wood, w, t, d, 0, t / 2, 0);
      box(grp, wood, t, h, d, -w / 2 + t / 2, h / 2, 0); box(grp, wood, t, h, d, w / 2 - t / 2, h / 2, 0);
      box(grp, wood, w, h, t, 0, h / 2, -d / 2 + t / 2);
      if (def.lid === 'top') box(grp, wood, w, h, t, 0, h / 2, d / 2 - t / 2);
      const b = box(grp, wood, 0.01, 0.01, 0.01, 0, 0, 0); b.visible = false;
    } else {
      const stone = world.mat(0x34383c, 0.95);
      box(grp, stone, w, h, d, 0, h / 2, 0).userData.occ = true; room.occluders.push(grp.children[grp.children.length - 1]);
    }
    const hw = Math.abs(Math.cos(def.ry || 0)) * w / 2 + Math.abs(Math.sin(def.ry || 0)) * d / 2, hd = Math.abs(Math.sin(def.ry || 0)) * w / 2 + Math.abs(Math.cos(def.ry || 0)) * d / 2;
    world.addCollider(room, def.x, def.z, hw, hd);
    const lidG = new THREE.Group(); grp.add(lidG);
    let lidMesh, apply;
    if (def.lid === 'top') {
      lidG.position.set(0, h, -d / 2); lidMesh = box(lidG, wood2, w + 0.04, 0.06, d + 0.04, 0, 0.03, d / 2);
      apply = v => { lidG.rotation.x = -v * 1.9; };
    } else if (def.lid === 'front') {
      lidG.position.set(0, 0.06, d / 2); lidMesh = box(lidG, world.mat(0x1a1a1e, 0.5, 0.7), w * 0.94, h * 0.82, 0.04, 0, h * 0.41, 0);
      apply = v => { lidG.rotation.x = v * 1.5; };
    } else {
      lidMesh = box(lidG, world.mat(0x3d4044, 0.9), w + 0.1, 0.16, d + 0.1, 0, h + 0.08, 0);
      apply = v => { lidG.position.z = v * d * 0.42; lidG.rotation.y = v * 0.05; };
    }
    const wi = makeSpotItem(world, room, spot, desc, grp, 0, def.lid === 'slide' ? h - 0.04 : 0.1, 0);
    if (wi) setItemHidden(wi, true);
    spot.ia = new Openable(game, {
      id: 'spot:' + def.id, room, meshes: [lidMesh], reach: 2.7, durOpen: 0.7, durClose: 0.55, easeOpen: Ease.outCubic,
      prompt: () => (spot.ia.isOpen ? 'Close' : def.label),
      apply,
      hooks: { opening: () => { game.audio.lid(game.spotPos(def)); game.makeNoise(def.x, def.z, room.id, 0.15, 'lid'); if (wi) setItemHidden(wi, false); }, closing: () => game.audio.lid(game.spotPos(def)), closed: () => { if (wi && wi.mesh.parent === grp) setItemHidden(wi, true); } },
      onInteract: () => { spot.ia.toggle(false); spot.opened = true; }
    });
    return spot;
  }

  // ---- search props: hold E to search, then the contents pop out -------------
  const sp = buildSearchProp(world, room, def, grp, box, wood);
  const ground = def.prop === 'pumpkin' || def.prop === 'ash' || def.prop === 'barrel' || def.prop === 'crib' || def.prop === 'urn';
  const ip = sp.itemPos || [def.x, def.y + (def.prop === 'pumpkin' ? 0.3 : 0.1), def.z];
  const wi = makeSpotItem(world, room, spot, desc, room.group, ip[0], ip[1], ip[2]);
  if (wi) setItemHidden(wi, true);
  spot.ia = new Interactable(game, {
    id: 'spot:' + def.id, room, meshes: sp.meshes, holdTime: 1.1, reach: 2.6,
    prompt: () => (spot.opened ? 'Nothing more here' : def.label),
    onInteract: () => {
      if (spot.opened) return;
      spot.opened = true;
      game.audio.rustle(game.spotPos(def)); game.makeNoise(def.x, def.z, room.id, 0.12, 'search');
      if (sp.reveal) sp.reveal();
      if (wi) { game.tweens.after(0.35, () => revealItem(world, wi)); }
      else game.hud.toast('Nothing here');
    }
  });
  return spot;
}

// --------------------------------------------------------------------------
// Search props: returns { meshes, reveal(), itemPos }
// --------------------------------------------------------------------------
function buildSearchProp(world, room, def, grp, box, wood) {
  const game = world.game, tw = game.tweens, b = room.bounds;
  const cyl = (r1, r2, h, seg) => Cache.geo('cyl:' + r1 + ',' + r2 + ',' + h + ',' + seg, () => new THREE.CylinderGeometry(r1, r2, h, seg || 14));
  const wallPos = (offset) => {   // snap to the nearest wall, return {x,z,ry}
    const ry = wallFacing(room, def.x, def.z);
    if (ry === Math.PI / 2) return { x: b.minX + offset, z: def.z, ry };
    if (ry === -Math.PI / 2) return { x: b.maxX - offset, z: def.z, ry };
    if (ry === 0) return { x: def.x, z: b.minZ + offset, ry };
    return { x: def.x, z: b.maxZ - offset, ry };
  };
  const out = { meshes: [], reveal: null, itemPos: null };
  const add = (mesh, collide) => { out.meshes.push(mesh); return mesh; };
  switch (def.prop) {
    case 'pumpkin': {
      const p = world.makePumpkin(room, def.x, def.z, Math.random() * 6, 2, false);
      out.meshes.push(p.body); out.itemPos = [def.x, 0.78, def.z];
      out.reveal = () => { tw.add({ dur: 0.35, update: v => p.group.scale.set(1 + Math.sin(v * 9) * 0.05, 1 - Math.sin(v * 9) * 0.08, 1) }); };
      world.addCollider(room, def.x, def.z, 0.35, 0.35);
      break;
    }
    case 'ash': {
      const m = new THREE.Mesh(Cache.geo('ash', () => new THREE.ConeGeometry(0.55, 0.22, 10)), world.mat(0x2a2826, 1));
      m.position.set(def.x, 0.11, def.z); m.scale.set(1, 1, 0.6); room.group.add(m); out.meshes.push(m);
      out.itemPos = [def.x, 0.12, def.z];
      out.reveal = () => tw.add({ dur: 0.6, update: v => { m.scale.y = 1 - v * 0.7; } });
      break;
    }
    case 'rug': {
      const rug = room.rugMesh; out.meshes.push(rug);
      out.itemPos = [def.x, 0.04, def.z + 1.0];
      const z0 = rug.position.z, s0 = rug.scale.y;
      out.reveal = () => tw.add({ dur: 0.8, ease: Ease.inOutCubic, update: v => { rug.position.z = z0 - v * 1.1; rug.scale.y = s0 * (1 - v * 0.45); } });
      break;
    }
    case 'mattress': {
      const bl = room.mattressMesh; out.meshes.push(bl);
      out.itemPos = [def.x, 0.7, def.z + 0.3];
      const y0 = bl.position.y;
      out.reveal = () => tw.add({ dur: 0.7, update: v => { bl.position.y = y0 + v * 0.3; bl.rotation.x = v * 0.35; } });
      break;
    }
    case 'barrel': {
      const m = new THREE.Mesh(cyl(0.38, 0.34, 0.8, 16), world.mat(0x3a2412, 0.8)); m.position.set(def.x, 0.4, def.z); m.castShadow = true; room.group.add(m);
      [0.15, 0.65].forEach(y => { const h = new THREE.Mesh(cyl(0.385, 0.385, 0.04, 16), world.mat(0x18181a, 0.5, 0.8)); h.position.set(def.x, y, def.z); room.group.add(h); });
      const lid = new THREE.Mesh(cyl(0.36, 0.36, 0.05, 16), world.mat(0x2a1a0e, 0.8)); lid.position.set(def.x, 0.82, def.z); room.group.add(lid);
      out.meshes.push(m, lid); out.itemPos = [def.x, 0.86, def.z];
      out.reveal = () => tw.add({ dur: 0.6, ease: Ease.outCubic, update: v => { lid.position.x = def.x + v * 0.45; lid.rotation.z = -v * 0.5; lid.position.y = 0.82 + v * 0.08; } });
      world.addCollider(room, def.x, def.z, 0.4, 0.4); room.occluders.push(m); m.userData.occ = false;
      break;
    }
    case 'crib': {
      const g = new THREE.Group(); g.position.set(def.x, 0, def.z); room.group.add(g);
      box(g, wood, 1.1, 0.06, 0.65, 0, 0.35, 0);
      [[-0.52, -0.3], [0.52, -0.3], [-0.52, 0.3], [0.52, 0.3]].forEach(p => box(g, wood, 0.05, 0.9, 0.05, p[0], 0.45, p[1]));
      for (let i = 0; i < 9; i++) { box(g, wood, 0.02, 0.4, 0.02, -0.5 + i * 0.125, 0.75, 0.3); box(g, wood, 0.02, 0.4, 0.02, -0.5 + i * 0.125, 0.75, -0.3); }
      const bl = box(g, world.mat(0x8a8a9a, 1), 0.95, 0.1, 0.55, 0, 0.44, 0);
      out.meshes.push(bl); out.itemPos = [def.x, 0.52, def.z];
      out.reveal = () => tw.add({ dur: 0.7, update: v => { bl.position.y = 0.44 + v * 0.35; bl.rotation.x = v * 0.4; } });
      world.addCollider(room, def.x, def.z, 0.6, 0.38);
      break;
    }
    case 'urn': {
      const g = new THREE.Group(); g.position.set(def.x, 0, def.z); room.group.add(g);
      const st = world.mat(0x4a4e52, 0.8);
      const a = new THREE.Mesh(cyl(0.25, 0.3, 0.2, 14), st); a.position.y = 0.1; const bd = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), st); bd.position.y = 0.52; bd.scale.y = 1.15;
      const lid = new THREE.Mesh(cyl(0.12, 0.2, 0.14, 12), st); lid.position.y = 0.95;
      [a, bd, lid].forEach(m => { m.castShadow = true; g.add(m); });
      out.meshes.push(bd, lid, a); out.itemPos = [def.x, 1.15, def.z];
      out.reveal = () => tw.add({ dur: 0.6, update: v => { lid.position.y = 0.95 + v * 0.3; lid.rotation.z = v * 0.6; } });
      world.addCollider(room, def.x, def.z, 0.38, 0.38);
      break;
    }
    case 'painting': {
      const wp = wallPos(0.04), g = new THREE.Group();
      g.position.set(wp.x, def.y, wp.z); g.rotation.y = wp.ry; room.group.add(g);
      const niche = new THREE.Mesh(Cache.geo('niche.p', () => new THREE.PlaneGeometry(0.9, 1.1)), world.mat(0x040303, 1)); niche.position.z = -0.02; g.add(niche);
      const pivot = new THREE.Group(); pivot.position.set(-0.42, 0, 0.02); g.add(pivot);
      const frame = new THREE.Mesh(Cache.geo('box:.9,1.1,.06', () => new THREE.BoxGeometry(0.9, 1.1, 0.06)), world.mat(0x2a1c10, 0.5, 0.4)); frame.position.x = 0.42; frame.castShadow = true; pivot.add(frame);
      const art = new THREE.Mesh(Cache.geo('plane.art', () => new THREE.PlaneGeometry(0.76, 0.96)), new THREE.MeshStandardMaterial({ map: world.lab.portrait(def.id.length % 3), roughness: 0.8 }));
      art.position.set(0.42, 0, 0.035); pivot.add(art);
      out.meshes.push(frame, art);
      const ox = wp.ry === Math.PI / 2 ? 0.1 : wp.ry === -Math.PI / 2 ? -0.1 : 0, oz = wp.ry === 0 ? 0.1 : wp.ry === Math.PI ? -0.1 : 0;
      out.itemPos = [wp.x + ox, def.y - 0.1, wp.z + oz];
      out.reveal = () => tw.add({ dur: 0.8, ease: Ease.outBack, update: v => { pivot.rotation.y = -v * 1.5; } });
      break;
    }
    case 'book': {
      const g = new THREE.Group(); g.position.set(b.minX + 0.4, def.y, def.z); room.group.add(g);
      const bk = new THREE.Mesh(Cache.geo('box:.3,.34,.07', () => new THREE.BoxGeometry(0.3, 0.34, 0.07)), world.mat(0x6a1a1a, 0.7)); bk.position.x = 0.06; bk.castShadow = true; g.add(bk);
      out.meshes.push(bk); out.itemPos = [b.minX + 0.5, def.y + 0.05, def.z + 0.3];
      out.reveal = () => tw.add({ dur: 0.5, update: v => { bk.rotation.z = -v * 0.5; bk.position.x = 0.06 + v * 0.1; } });
      break;
    }
    case 'niche': {
      const wp = wallPos(0.03), g = new THREE.Group();
      g.position.set(wp.x, def.y, wp.z); g.rotation.y = wp.ry; room.group.add(g);
      const st = world.mat(0x3a3e42, 0.95);
      box(g, st, 0.8, 0.1, 0.2, 0, -0.45, 0.08); box(g, st, 0.8, 0.1, 0.2, 0, 0.45, 0.08); box(g, st, 0.1, 0.9, 0.2, -0.35, 0, 0.08); box(g, st, 0.1, 0.9, 0.2, 0.35, 0, 0.08);
      const back = new THREE.Mesh(Cache.geo('niche.b', () => new THREE.PlaneGeometry(0.6, 0.8)), world.mat(0x030403, 1)); back.position.z = 0.02; g.add(back);
      const web = new THREE.Mesh(Cache.geo('plane.web', () => new THREE.PlaneGeometry(0.7, 0.9)), new THREE.MeshBasicMaterial({ map: world.lab.cobweb(), transparent: true, depthWrite: false, opacity: 0.9 })); web.position.z = 0.19; g.add(web);
      out.meshes.push(back, web);
      const ox = wp.ry === Math.PI / 2 ? 0.14 : wp.ry === -Math.PI / 2 ? -0.14 : 0, oz = wp.ry === 0 ? 0.14 : wp.ry === Math.PI ? -0.14 : 0;
      out.itemPos = [wp.x + ox, def.y - 0.25, wp.z + oz];
      out.reveal = () => tw.add({ dur: 0.5, update: v => { web.scale.setScalar(1 - v * 0.9); web.material.opacity = 0.9 * (1 - v); } });
      break;
    }
    default: break;
  }
  return out;
}
