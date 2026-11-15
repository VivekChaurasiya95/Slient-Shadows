// Run with: node tools/layout-test.js
// Loads core.js (RNG) and world-data.js without a browser and checks 500 seeds.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'core.js'), 'utf8') + '\nthis.RNG = RNG;', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'world-data.js'), 'utf8') + '\nthis.WD = WORLD_DATA;', ctx);
const { RNG, WD } = ctx;

let fails = 0, repeats = 0, spots = new Set(), relicRooms = {};
let prev = null;
for (let i = 0; i < 500; i++) {
  const rng = new RNG('T' + i);
  const layout = WD.generateLayout(rng, prev);
  const v = WD.validate(layout);
  if (!v.ok) { fails++; console.log('UNSOLVABLE seed', 'T' + i, JSON.stringify(layout.keySpots), layout.relicSpot); }
  if (prev && prev.relicSpot === layout.relicSpot) repeats++;
  spots.add(layout.relicSpot);
  const room = WD.SPOTS.find(s => s.id === layout.relicSpot).room;
  relicRooms[room] = (relicRooms[room] || 0) + 1;
  if (layout.hides.length !== 6 || !layout.fakeHide) { fails++; console.log('bad hides', i); }
  const spotIds = Object.keys(layout.items);
  WD.SPOTS.forEach(() => {});
  if (spotIds.some(id => !WD.SPOTS.find(s => s.id === id))) { fails++; console.log('unknown spot', i); }
  prev = layout;
}
console.log('seeds: 500, unsolvable/bad:', fails, ', consecutive relic repeats:', repeats);
console.log('distinct relic spots:', spots.size, 'of', WD.SPOTS.length);
console.log('relic by room:', JSON.stringify(relicRooms));
const a = WD.generateLayout(new RNG('SAME'), null), b = WD.generateLayout(new RNG('SAME'), null);
console.log('same seed deterministic:', JSON.stringify(a) === JSON.stringify(b));
console.log('spots total', WD.SPOTS.length, 'items placed in a run', Object.keys(a.items).length);
process.exit(fails ? 1 : 0);
