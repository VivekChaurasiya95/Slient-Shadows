'use strict';
// ==========================================================================
// WORLD DATA: room / door / spot registries and the seeded layout generator.
// Pure data and logic. No THREE dependency, so it can be tested in node.
// ==========================================================================
const WORLD_DATA = (() => {
  const PI = Math.PI;

  // ------------------------------------------------------------------------
  // Rooms
  // ------------------------------------------------------------------------
  const ROOMS = {
    corridor: { id: 'corridor', name: 'Corridor', bounds: { minX: -2, maxX: 2, minZ: -12, maxZ: 12 }, H: 3.4, floor: 'wood',  fog: [0x0a0708, 0.06],  ambient: [0x3c4050, 0.42], wet: 0.25 },
    parlor:   { id: 'parlor',   name: 'Parlor',   bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },   H: 3.4, floor: 'wood',  fog: [0x0c0504, 0.055], ambient: [0x4a3c34, 0.45],  wet: 0.2 },
    bedroom:  { id: 'bedroom',  name: 'Bedroom',  bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },   H: 3.4, floor: 'wood',  fog: [0x05070d, 0.06],  ambient: [0x384056, 0.5], wet: 0.15 },
    kitchen:  { id: 'kitchen',  name: 'Kitchen',  bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },   H: 3.2, floor: 'stone', fog: [0x0a0904, 0.06],  ambient: [0x46463a, 0.42], wet: 0.3 },
    library:  { id: 'library',  name: 'Library',  bounds: { minX: -5, maxX: 5, minZ: -6, maxZ: 6 },   H: 3.6, floor: 'wood',  fog: [0x080604, 0.055], ambient: [0x484034, 0.42], wet: 0.12 },
    nursery:  { id: 'nursery',  name: 'Nursery',  bounds: { minX: -4, maxX: 4, minZ: -5, maxZ: 5 },   H: 3.0, floor: 'wood',  fog: [0x0b0710, 0.06],  ambient: [0x444058, 0.45],  wet: 0.15 },
    cellar:   { id: 'cellar',   name: 'Cellar',   bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },   H: 2.8, floor: 'stone', fog: [0x050605, 0.09],  ambient: [0x3a4a3a, 0.4],  wet: 0.5 },
    crypt:    { id: 'crypt',    name: 'Crypt',    bounds: { minX: -5, maxX: 5, minZ: -8, maxZ: 6 },   H: 3.8, floor: 'stone', fog: [0x040c07, 0.085], ambient: [0x2c4a3c, 0.45],  wet: 0.7 }
  };
  const ROOM_IDS = Object.keys(ROOMS);

  // ------------------------------------------------------------------------
  // Doors. side = wall (N z=min, S z=max, W x=min, E x=max), pos = offset along it.
  // to = paired door id. slot = lock slot shared by both ends. barred = this end is
  // bolted from the far side. kind: door | gate | exit | fake (opens onto brick)
  // ------------------------------------------------------------------------
  const DOORS = [
    { id: 'c_parlor',   room: 'corridor', side: 'W', pos: -3,   to: 'p_corr',     kind: 'door', label: 'parlor' },
    { id: 'p_corr',     room: 'parlor',   side: 'S', pos: 0,    to: 'c_parlor',   kind: 'door', label: 'corridor' },
    { id: 'c_bedroom',  room: 'corridor', side: 'E', pos: -3,   to: 'b_corr',     kind: 'door', label: 'bedroom' },
    { id: 'b_corr',     room: 'bedroom',  side: 'S', pos: 0,    to: 'c_bedroom',  kind: 'door', label: 'corridor' },
    { id: 'c_kitchen',  room: 'corridor', side: 'W', pos: 5,    to: 'k_corr',     kind: 'door', label: 'kitchen' },
    { id: 'k_corr',     room: 'kitchen',  side: 'S', pos: 0,    to: 'c_kitchen',  kind: 'door', label: 'corridor' },
    { id: 'c_library',  room: 'corridor', side: 'E', pos: 6,    to: 'l_corr',     kind: 'door', label: 'library' },
    { id: 'l_corr',     room: 'library',  side: 'S', pos: 0,    to: 'c_library',  kind: 'door', label: 'corridor' },
    { id: 'c_crypt',    room: 'corridor', side: 'N', pos: 0,    to: 'cr_corr',    kind: 'gate', label: 'crypt', slot: 'crypt', width: 1.3 },
    { id: 'cr_corr',    room: 'crypt',    side: 'S', pos: 0,    to: 'c_crypt',    kind: 'gate', label: 'corridor', slot: 'crypt', width: 1.3 },
    { id: 'c_exit',     room: 'corridor', side: 'S', pos: 0,    to: null,         kind: 'exit', label: 'outside', slot: 'exit', width: 1.4 },
    { id: 'k_cellar',   room: 'kitchen',  side: 'W', pos: -3,   to: 'ce_kitchen', kind: 'door', label: 'cellar', slot: 'cellar' },
    { id: 'ce_kitchen', room: 'cellar',   side: 'S', pos: 0,    to: 'k_cellar',   kind: 'door', label: 'kitchen', slot: 'cellar' },
    { id: 'l_nursery',  room: 'library',  side: 'N', pos: 3,    to: 'n_library',  kind: 'door', label: 'nursery', slot: 'nursery' },
    { id: 'n_library',  room: 'nursery',  side: 'S', pos: 0,    to: 'l_nursery',  kind: 'door', label: 'library', slot: 'nursery' },
    // One-way servants' stair: opens from the cellar, bolted on the kitchen side
    { id: 'ce_stair',   room: 'cellar',   side: 'E', pos: -1,   to: 'k_stair',    kind: 'door', label: 'servants\' stair' },
    { id: 'k_stair',    room: 'kitchen',  side: 'E', pos: -2,   to: 'ce_stair',   kind: 'door', label: 'servants\' stair', barred: true },
    // A door that opens onto a bricked-up wall
    { id: 'n_brick',    room: 'nursery',  side: 'E', pos: -1.5, to: null,         kind: 'fake', label: 'nowhere' }
  ];

  const LOCK_SLOTS = ['crypt', 'cellar', 'nursery'];
  const KEY_IDS = ['silver', 'rusty', 'brass', 'bone'];
  const KEY_NAMES = { silver: 'Silver Key', rusty: 'Rusty Key', brass: 'Brass Key', bone: 'Bone Key' };

  // ------------------------------------------------------------------------
  // Item spots. kind: surface | drawer | container | search
  // Furniture is centred on x,z and faces ry (local +Z). w = width, d = depth.
  // ------------------------------------------------------------------------
  const SPOTS = [
    // Corridor
    { id: 'corridor_cabinet', room: 'corridor', kind: 'drawer', x: -1.8, z: 9.2, ry: PI / 2, w: 1.0, d: 0.4, h: 0.9, hint: 'in the cabinet by the front door', label: 'Open drawer' },
    { id: 'corridor_pumpkin', room: 'corridor', kind: 'search', prop: 'pumpkin', x: -1.45, z: -8.0, y: 0.32, hint: 'inside the carved grin', label: 'Search pumpkin' },
    { id: 'corridor_table',   room: 'corridor', kind: 'surface', prop: 'stand', x: 1.6, z: -7.0, y: 0.85, hint: 'on the hall table', label: 'Take' },
    { id: 'corridor_stand',   room: 'corridor', kind: 'surface', prop: 'stand', x: -1.6, z: 1.0, y: 0.85, hint: 'beneath the hall portrait', label: 'Take' },
    // Parlor
    { id: 'parlor_ash',     room: 'parlor', kind: 'search', prop: 'ash', x: 0, z: -5.2, y: 0.12, hint: 'among the cinders', label: 'Sift ashes' },
    { id: 'parlor_pumpkin', room: 'parlor', kind: 'search', prop: 'pumpkin', x: 3.9, z: -4.8, y: 0.32, hint: 'inside the carved grin', label: 'Search pumpkin' },
    { id: 'parlor_rug',     room: 'parlor', kind: 'search', prop: 'rug', x: 0, z: -1.6, y: 0.02, hint: 'beneath the rug', label: 'Lift rug' },
    { id: 'parlor_cabinet', room: 'parlor', kind: 'drawer', x: 4.75, z: -3.0, ry: -PI / 2, w: 1.0, d: 0.5, h: 0.9, hint: 'in the cabinet that remembers', label: 'Open drawer' },
    { id: 'parlor_side',    room: 'parlor', kind: 'drawer', x: -3.2, z: 5.7, ry: PI, w: 0.9, d: 0.5, h: 0.85, hint: 'by the door where guests wait', label: 'Open drawer' },
    { id: 'parlor_table',   room: 'parlor', kind: 'surface', prop: 'stand', x: 3.4, z: 1.4, y: 0.85, hint: 'on the table by the window', label: 'Take' },
    // Bedroom
    { id: 'bedroom_vanity',     room: 'bedroom', kind: 'surface', prop: 'builtin', x: 4.5, z: -4.1, y: 1.03, hint: 'where the vain look back', label: 'Take' },
    { id: 'bedroom_mattress',   room: 'bedroom', kind: 'search', prop: 'mattress', x: -3.2, z: -3.7, y: 0.72, hint: 'within the sleeper\'s bed', label: 'Search bedding' },
    { id: 'bedroom_nightstand', room: 'bedroom', kind: 'drawer', x: -1.5, z: -5.6, ry: 0, w: 0.6, d: 0.5, h: 0.65, hint: 'by the sleeper\'s candle', label: 'Open drawer' },
    { id: 'bedroom_painting',   room: 'bedroom', kind: 'search', prop: 'painting', x: -4.85, z: 0.5, y: 1.6, hint: 'behind the one who watches', label: 'Move painting' },
    { id: 'bedroom_trunk',      room: 'bedroom', kind: 'container', lid: 'top', x: -4.65, z: 2.8, ry: PI / 2, w: 1.1, d: 0.7, h: 0.6, hint: 'where the family keeps its secrets', label: 'Open trunk' },
    // Kitchen
    { id: 'kitchen_table',  room: 'kitchen', kind: 'surface', prop: 'builtin', x: 0.5, z: -1.0, y: 0.83, hint: 'where the family dined', label: 'Take' },
    { id: 'kitchen_oven',   room: 'kitchen', kind: 'container', lid: 'front', x: 3.0, z: -5.5, ry: 0, w: 1.1, d: 0.8, h: 0.9, hint: 'in the cold oven', label: 'Open oven' },
    { id: 'kitchen_hutch',  room: 'kitchen', kind: 'drawer', x: -4.7, z: 3.0, ry: PI / 2, w: 1.2, d: 0.6, h: 0.95, hint: 'in the hutch with the cracked plates', label: 'Open drawer' },
    { id: 'kitchen_barrel', room: 'kitchen', kind: 'search', prop: 'barrel', x: 4.3, z: 4.6, y: 0.8, hint: 'in the barrel of brine', label: 'Search barrel' },
    { id: 'kitchen_sink',   room: 'kitchen', kind: 'drawer', x: 4.7, z: 1.8, ry: -PI / 2, w: 1.0, d: 0.6, h: 0.9, hint: 'under the dripping tap', label: 'Open drawer' },
    // Library
    { id: 'library_desk',     room: 'library', kind: 'drawer', x: -1.2, z: -5.2, ry: 0, w: 1.8, d: 0.9, h: 0.8, hint: 'in the scholar\'s desk', label: 'Open drawer' },
    { id: 'library_chest',    room: 'library', kind: 'container', lid: 'top', x: 4.6, z: 2.5, ry: -PI / 2, w: 1.2, d: 0.7, h: 0.6, hint: 'in the iron-banded chest', label: 'Open chest' },
    { id: 'library_table',    room: 'library', kind: 'surface', prop: 'stand', x: 1.0, z: 2.0, y: 0.85, hint: 'on the reading table', label: 'Take' },
    { id: 'library_painting', room: 'library', kind: 'search', prop: 'painting', x: -3.6, z: -5.8, y: 1.7, hint: 'behind the one who watches', label: 'Move painting' },
    { id: 'library_shelf',    room: 'library', kind: 'search', prop: 'book', x: -4.55, z: 1.0, y: 1.5, hint: 'behind the book that does not belong', label: 'Pull book' },
    // The Hollow strongbox: a three-dial combination with an electric bolt. Always holds the crypt key.
    { id: 'library_safe',     room: 'library', kind: 'safe', x: 4.55, z: -4.6, ry: -PI / 2, w: 0.8, d: 0.7, h: 1.0, hint: 'in the Hollow strongbox', label: 'Hollow strongbox' },
    // Nursery
    { id: 'nursery_crib',      room: 'nursery', kind: 'search', prop: 'crib', x: -2.6, z: -3.9, y: 0.55, hint: 'where the little one sleeps', label: 'Search crib' },
    { id: 'nursery_toybox',    room: 'nursery', kind: 'container', lid: 'top', x: 2.6, z: -4.6, ry: 0, w: 1.0, d: 0.6, h: 0.5, hint: 'among the broken toys', label: 'Open toy box' },
    { id: 'nursery_dollhouse', room: 'nursery', kind: 'container', lid: 'front', x: -3.5, z: 1.5, ry: PI / 2, w: 1.0, d: 0.6, h: 0.9, hint: 'in the little house', label: 'Open dollhouse' },
    { id: 'nursery_dresser',   room: 'nursery', kind: 'drawer', x: 3.7, z: 2.6, ry: -PI / 2, w: 1.0, d: 0.5, h: 0.9, hint: 'in the dresser of tiny clothes', label: 'Open drawer' },
    { id: 'nursery_rocker',    room: 'nursery', kind: 'surface', prop: 'builtin', x: 1.6, z: 0.4, y: 0.52, hint: 'on the chair that rocks alone', label: 'Take' },
    // Cellar
    { id: 'cellar_barrel', room: 'cellar', kind: 'search', prop: 'barrel', x: -3.8, z: -3.8, y: 0.8, hint: 'in the barrel of brine', label: 'Search barrel' },
    { id: 'cellar_crate',  room: 'cellar', kind: 'container', lid: 'top', x: 3.0, z: -4.3, ry: 0, w: 1.0, d: 0.8, h: 0.7, hint: 'in the nailed crate', label: 'Pry crate open' },
    { id: 'cellar_bench',  room: 'cellar', kind: 'drawer', x: -4.5, z: 1.5, ry: PI / 2, w: 1.6, d: 0.8, h: 0.9, hint: 'in the workbench', label: 'Open drawer' },
    { id: 'cellar_shelf',  room: 'cellar', kind: 'surface', prop: 'shelf', x: 4.6, z: 3.0, y: 1.15, hint: 'on the cold iron shelf', label: 'Take' },
    // Crypt
    { id: 'crypt_altar',       room: 'crypt', kind: 'surface', prop: 'builtin', x: 0, z: -5.6, y: 1.2, hint: 'on the altar', label: 'Take' },
    { id: 'crypt_sarcophagus', room: 'crypt', kind: 'container', lid: 'slide', x: 3.7, z: 2.4, ry: 0, w: 1.1, d: 2.4, h: 0.7, hint: 'where the dead lie', label: 'Slide the lid' },
    { id: 'crypt_urn',         room: 'crypt', kind: 'search', prop: 'urn', x: -3.9, z: -6.9, y: 0.6, hint: 'in the funeral urn', label: 'Search urn' },
    { id: 'crypt_niche',       room: 'crypt', kind: 'search', prop: 'niche', x: -4.85, z: -2.0, y: 1.2, hint: 'in the wall\'s hollow', label: 'Search niche' }
  ];

  // ------------------------------------------------------------------------
  // Hiding spots. type: closet | curtain | under | coffin
  // ------------------------------------------------------------------------
  const HIDES = [
    { id: 'hide_coats',     room: 'corridor', type: 'closet',  x: -1.65, z: -10.2, ry: PI / 2,  w: 1.0, d: 0.7, h: 2.3, label: 'Coat closet' },
    { id: 'hide_clock',     room: 'parlor',   type: 'closet',  x: -4.7,  z: 3.8,   ry: PI / 2,  w: 0.8, d: 0.6, h: 2.5, label: 'Clock case', clock: true },
    { id: 'hide_curtain_p', room: 'parlor',   type: 'curtain', x: 4.55,  z: 3.4,   ry: -PI / 2, w: 1.8, d: 0.5, h: 2.8, label: 'Curtain' },
    { id: 'hide_wardrobe',  room: 'bedroom',  type: 'closet',  x: 4.6,   z: 1.4,   ry: -PI / 2, w: 1.4, d: 0.8, h: 2.5, label: 'Wardrobe' },
    { id: 'hide_bed',       room: 'bedroom',  type: 'under',   x: -3.2,  z: -4.0,  ry: 0,       w: 1.8, d: 2.3, h: 0.5, label: 'Under the bed' },
    { id: 'hide_cupboard',  room: 'kitchen',  type: 'closet',  x: 0.7,   z: -5.55, ry: 0,       w: 1.0, d: 0.8, h: 2.3, label: 'Cupboard' },
    { id: 'hide_curtain_l', room: 'library',  type: 'curtain', x: 4.55,  z: -2.4,  ry: -PI / 2, w: 1.8, d: 0.5, h: 3.0, label: 'Curtain' },
    { id: 'hide_nursery',   room: 'nursery',  type: 'closet',  x: -3.65, z: -1.0,  ry: PI / 2,  w: 0.9, d: 0.7, h: 2.1, label: 'Nursery closet' },
    { id: 'hide_crawl',     room: 'cellar',   type: 'under',   x: -4.5,  z: -2.5,  ry: PI / 2,  w: 1.6, d: 1.0, h: 0.8, label: 'Crawlspace' },
    { id: 'hide_coffin',    room: 'crypt',    type: 'coffin',  x: -3.7,  z: 2.6,   ry: 0,       w: 1.1, d: 2.4, h: 0.7, label: 'Sarcophagus' }
  ];

  // ------------------------------------------------------------------------
  // Graph helpers
  // ------------------------------------------------------------------------
  const doorById = {};
  DOORS.forEach(d => { doorById[d.id] = d; });

  // The exit slot is not a key lock, it is opened by the relic at the end
  function passable(door, unlocked) {
    if (!door.to || door.kind === 'fake' || door.kind === 'exit' || door.barred) return false;
    return !door.slot || unlocked.has(door.slot);
  }

  function reachable(unlocked) {
    const seen = new Set(['corridor']);
    const queue = ['corridor'];
    while (queue.length) {
      const r = queue.shift();
      DOORS.forEach(d => {
        if (d.room !== r || !passable(d, unlocked)) return;
        const dest = doorById[d.to].room;
        if (!seen.has(dest)) { seen.add(dest); queue.push(dest); }
      });
    }
    return seen;
  }

  // Door ids to walk through to get from one room to another
  function roomPath(from, to, unlocked) {
    if (from === to) return [];
    const prev = {};
    prev[from] = null;
    const queue = [from];
    while (queue.length) {
      const r = queue.shift();
      for (const d of DOORS) {
        if (d.room !== r || !passable(d, unlocked)) continue;
        const dest = doorById[d.to].room;
        if (dest in prev) continue;
        prev[dest] = { room: r, door: d.id };
        if (dest === to) {
          const path = [];
          let cur = to;
          while (prev[cur]) { path.unshift(prev[cur].door); cur = prev[cur].room; }
          return path;
        }
        queue.push(dest);
      }
    }
    return null;
  }

  // ------------------------------------------------------------------------
  // Layout generator
  // ------------------------------------------------------------------------
  // Note text is stored as a template + parameters so the journal can show it in any language.
  // fmt() builds the English text; the HUD rebuilds it through T() for other languages.
  const fmt = (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (p[k] === undefined ? m : String(p[k])));
  const NOTE_FLAVOR = [
    'It walks when the clock strikes. Hold still in the dark and it passes.',
    'Salt and iron slow it. Light makes it flinch. Do not let it hear you breathe.',
    'Every door it opens, it remembers. Close them behind you.',
    'I heard it counting the floorboards. It stops where I hide.',
    'The mirror showed me something standing behind my chair.',
    'Throw something. It always goes to look.'
  ];
  const KEY_TEMPLATES = [
    'I hid the {key} {hint}. Pray no one looks.',
    'If you seek the {key}, look {hint}.',
    'The {key}... {hint}. Do not let it hear you.'
  ];
  const RELIC_TEMPLATES = [
    'The horned skull was last seen {hint}.',
    'He carried the horned thing and set it down {hint}.',
    'What you came for rests {hint}. Take it and run.'
  ];
  const LIAR_RELIC = 'Surely the horned skull sits {hint}. I saw it with my own eyes.';
  const LIAR_KEY = 'The {key} must be {hint}, I am almost certain.';
  // Three clues to the strongbox. Two are pages in the house, the third is in the kitchen maintenance locker.
  const CLUE_TEMPLATES = [
    'A page torn from Josiah\u2019s ledger. In red ink: the FIRST number of the strongbox is {d}.',
    'Scratched into the back of a family photograph: SECOND number, {d}. Josiah never trusted his memory.',
    'Caretaker\u2019s card, 1952: Strongbox THIRD number is {d}. The bolt is electric now. No mains power, no safe.'
  ];
  // Ritual: three offerings for the crypt altar, and three symbols whose order is marked around the house
  const OFFERINGS = ['ritual_candle', 'ritual_salt', 'ritual_ribbon'];
  const GLYPHS = ['moon', 'eye', 'horn'];
  const SYMBOL_ROOMS = ['parlor', 'bedroom', 'kitchen', 'library', 'nursery', 'cellar'];

  function generateLayout(rng, prev) {
    prev = prev || {};
    const used = new Set();
    const items = {};
    const allRooms = new Set(ROOM_IDS);
    const noCrypt = new Set(ROOM_IDS.filter(r => r !== 'crypt'));
    // the strongbox only ever holds the crypt key, so ordinary placement skips it
    const free = rooms => SPOTS.filter(s => rooms.has(s.room) && !used.has(s.id) && s.kind !== 'safe');
    const place = (spot, item) => { used.add(spot.id); items[spot.id] = item; return spot; };

    // Which key opens which lock this run
    const keys = rng.shuffle(KEY_IDS);
    const keyForSlot = {};
    LOCK_SLOTS.forEach((slot, i) => { keyForSlot[slot] = keys[i]; });
    const spareKey = keys[3];
    const code = [rng.int(1, 10), rng.int(1, 10), rng.int(1, 10)];
    const symbolOrder = rng.shuffle(GLYPHS);
    const symbolRooms = rng.shuffle(SYMBOL_ROOMS).slice(0, 3);
    const symbols = symbolOrder.map((glyph, i) => ({ glyph, n: i + 1, room: symbolRooms[i] }));

    // Room roles: honest, decoy, trap, safe
    const pool = rng.shuffle(['safe', 'safe', 'decoy', 'decoy', 'trap', 'trap', 'honest']);
    const roomList = rng.shuffle(ROOM_IDS.filter(r => r !== 'corridor'));
    const roles = { corridor: 'hub' };
    roomList.forEach((r, i) => { roles[r] = pool[i]; });
    if (roles.crypt === 'safe') {
      const other = roomList.find(r => r !== 'crypt' && roles[r] !== 'safe');
      roles.crypt = roles[other]; roles[other] = 'safe';
    }
    const trapKinds = rng.shuffle(['slam', 'dark', 'ghostwait']);
    const traps = {};
    roomList.filter(r => roles[r] === 'trap').forEach((r, i) => { traps[r] = trapKinds[i % trapKinds.length]; });

    // Keys in a random chain: each key sits somewhere reachable with the earlier ones.
    // The crypt is always the last lock: its key waits in the library strongbox, which needs
    // mains power (cellar fuse box) and the three clues.
    const order = rng.shuffle(LOCK_SLOTS.filter(s => s !== 'crypt')).concat(['crypt']);
    const unlocked = new Set();
    const keySpots = {};
    const safeSpot = SPOTS.find(s => s.kind === 'safe');
    order.forEach(slot => {
      const kid = keyForSlot[slot];
      let spot;
      if (slot === 'crypt') spot = place(safeSpot, { id: 'key_' + kid });
      else {
        let cands = free(reachable(unlocked)).filter(s => s.id !== (prev.keySpots || {})[kid]);
        if (!cands.length) cands = free(reachable(unlocked));
        spot = place(rng.pick(cands), { id: 'key_' + kid });
      }
      keySpots[kid] = spot.id;
      unlocked.add(slot);
    });

    // Relic: it rests in the family crypt, behind the seal. Never the same spot twice in a row.
    let relicCands = free(new Set(['crypt'])).filter(s => s.id !== prev.relicSpot);
    if (!relicCands.length) relicCands = free(new Set(['crypt']));
    const relicSpot = rng.weighted(relicCands, s => (s.id === 'crypt_altar' ? 1.6 : 1));
    place(relicSpot, { id: 'relic' });

    // Spare key, mimics
    const decoyRooms = new Set(roomList.filter(r => roles[r] === 'decoy'));
    const decoyFree = () => (decoyRooms.size ? free(decoyRooms) : []);
    const pickAny = list => rng.pick(list.length ? list : free(allRooms));
    place(pickAny(free(allRooms)), { id: 'key_' + spareKey, spare: true });
    place(pickAny(decoyFree()), { id: 'fake_key' });
    place(pickAny(decoyFree()), { id: 'fake_relic' });

    // Tools. The fuse and the crowbar are needed before the crypt opens, so never inside it.
    const safeRooms = new Set(roomList.filter(r => roles[r] === 'safe'));
    const tools = rng.shuffle(['lighter', 'crucifix', 'musicbox', 'mirror', 'fuse', 'locket']);
    tools.forEach(t => place(pickAny(free(t === 'fuse' ? noCrypt : allRooms)), { id: t }));
    // Weapons and ammunition. The crowbar opens the kitchen maintenance locker (third clue).
    place(pickAny(free(reachable(new Set()))), { id: 'crowbar' });
    ['bat', 'flaregun', 'pistol'].forEach(w => place(pickAny(free(noCrypt)), { id: w }));
    ['flare_ammo', 'pistol_ammo'].forEach(a => place(pickAny(free(allRooms)), { id: a }));
    // Ritual offerings for the crypt altar
    rng.shuffle(OFFERINGS).forEach(o => place(pickAny(free(noCrypt)), { id: o }));
    // Batteries (favour safe rooms), junk to throw
    for (let i = 0; i < 3; i++) {
      const c = free(safeRooms);
      place(pickAny(i < 2 ? c : free(allRooms)), { id: 'battery' });
    }
    ['doll', 'coins'].forEach(j => place(pickAny(free(allRooms)), { id: j }));

    // Notes: truthful ones for each key and the relic, two clues to the strongbox, a liar, a flavour page
    const startRooms = reachable(new Set());
    const hintOf = id => SPOTS.find(s => s.id === id).hint;
    const notes = [];
    const addNote = (s, p, truthful, about, extra) => {
      // start rooms first; if they are full, anywhere outside the crypt (a clue in the crypt would lock its own key away)
      let c = free(startRooms); if (!c.length) c = free(noCrypt);
      const text = fmt(s, p.key ? Object.assign({}, p, { key: KEY_NAMES[p.key].toLowerCase(), hint: p.spot ? hintOf(p.spot) : p.hint }) : Object.assign({}, p, { hint: p.spot ? hintOf(p.spot) : p.hint }));
      const spot = place(pickAny(c), Object.assign({ id: 'note', text, truthful, about, tpl: { s, key: p.key, spot: p.spot, d: p.d } }, extra || {}));
      notes.push({ spotId: spot.id, text, truthful, about });
    };
    [0, 1].forEach(i => addNote(CLUE_TEMPLATES[i], { d: code[i] }, true, 'clue', { clue: { n: i, d: code[i] } }));
    LOCK_SLOTS.forEach(slot => {
      const kid = keyForSlot[slot];
      addNote(rng.pick(KEY_TEMPLATES), { key: kid, spot: keySpots[kid] }, true, kid);
    });
    addNote(rng.pick(RELIC_TEMPLATES), { spot: relicSpot.id }, true, 'relic');
    {
      const wrong = rng.pick(SPOTS.filter(s => s.room !== 'crypt' && s.kind !== 'safe'));
      addNote(LIAR_RELIC, { spot: wrong.id }, false, 'horned skull');
    }
    rng.shuffle(NOTE_FLAVOR).slice(0, 1).forEach(t => addNote(t, {}, true, 'lore'));
    // the third clue is not in a spot: it waits in the kitchen maintenance locker (needs the crowbar)
    const lockerNote = { id: 'note', text: fmt(CLUE_TEMPLATES[2], { d: code[2] }), truthful: true, about: 'clue', tpl: { s: CLUE_TEMPLATES[2], d: code[2] }, clue: { n: 2, d: code[2] } };

    // Hiding spots: six honest ones plus one that is a trap
    const hideOrder = rng.shuffle(HIDES.map(h => h.id));
    const hides = hideOrder.slice(0, 6);
    const fakeHide = hideOrder[6];

    return { seed: rng.seed, keyForSlot, spareKey, roles, traps, items, notes, keySpots, relicSpot: relicSpot.id, hides, fakeHide, order, code, symbols, lockerNote, safeSpot: safeSpot.id };
  }

  // Simulate a perfect player: collect everything reachable, open every lock and puzzle
  // the collected things allow, repeat. Gates modelled here:
  //   fuse box (cellar + fuse) -> mains power
  //   crowbar -> kitchen maintenance locker -> third clue
  //   power + all three clues -> strongbox -> crypt key
  //   crypt + three offerings -> ritual -> the skull can be taken
  function validate(layout) {
    const unlocked = new Set();
    const have = new Set();
    let power = false, locker = false, safe = false, changed = true;
    const take = id => { if (!have.has(id)) { have.add(id); changed = true; } };
    while (changed) {
      changed = false;
      const rooms = reachable(unlocked);
      SPOTS.forEach(s => {
        const it = layout.items[s.id];
        if (!it || !rooms.has(s.room)) return;
        if (s.kind === 'safe' && !safe) return;
        take(it.id === 'note' && it.clue ? 'clue' + it.clue.n : it.id);
      });
      if (!power && rooms.has('cellar') && have.has('fuse')) { power = true; changed = true; }
      if (!locker && rooms.has('kitchen') && have.has('crowbar')) { locker = true; changed = true; take('clue2'); }
      if (!safe && power && rooms.has('library') && have.has('clue0') && have.has('clue1') && have.has('clue2')) { safe = true; changed = true; }
      LOCK_SLOTS.forEach(slot => {
        if (!unlocked.has(slot) && have.has('key_' + layout.keyForSlot[slot])) { unlocked.add(slot); changed = true; }
      });
    }
    const rooms = reachable(unlocked);
    const relic = SPOTS.find(s => s.id === layout.relicSpot);
    const ritual = rooms.has('crypt') && OFFERINGS.every(o => have.has(o));
    const ok = rooms.has(relic.room) && unlocked.size === LOCK_SLOTS.length && power && safe && ritual;
    return { ok, unlocked: Array.from(unlocked), rooms: Array.from(rooms), power, locker, safe, ritual };
  }

  const NOTE_TEXTS = [].concat(NOTE_FLAVOR, KEY_TEMPLATES, RELIC_TEMPLATES, [LIAR_RELIC, LIAR_KEY], CLUE_TEMPLATES);
  return { ROOMS, ROOM_IDS, DOORS, SPOTS, HIDES, LOCK_SLOTS, KEY_IDS, KEY_NAMES, OFFERINGS, GLYPHS, CLUE_TEMPLATES, NOTE_TEXTS, doorById, reachable, roomPath, passable, generateLayout, validate };
})();

if (typeof module !== 'undefined') module.exports = WORLD_DATA;
