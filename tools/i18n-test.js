// Localisation coverage: every player-visible English string must have a Hinglish entry.
// Run: node tools/i18n-test.js            (exit 1 when anything is missing)
//      node tools/i18n-test.js --list     (print every key it found)
// Sources: T('...') calls, HUD sinks (toast/alert/say/hide cue/objective), sentence-like literals in
// gameplay code, item / spot / hide / room data, STORY lines, cutscene captions and chapter cards,
// death lines, note templates, and the data-i18n attributes in index.html.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const ctx = { console, module: undefined, Math, JSON, Object, Array, String, Number, Set, Map, Symbol };
ctx.window = ctx; vm.createContext(ctx);
const load = (p, extra) => vm.runInContext(read(p) + (extra || ''), ctx, { filename: p });
load('src/core/core.js', '\nthis.CONFIG = CONFIG;');
load('src/i18n/i18n.js', '\nthis.I18N = I18N; this.T = T;');
load('src/i18n/en.js'); load('src/i18n/hi.js');
load('src/data/world-data.js', '\nthis.WORLD_DATA = WORLD_DATA;');

const keys = new Map();   // key -> where
const add = (k, where) => { if (typeof k !== 'string') return; k = k.trim(); if (k && !keys.has(k)) keys.set(k, where); };
const unq = s => s.replace(/\\'/g, '\'').replace(/\\u2019/g, '\u2019').replace(/\\u2026/g, '\u2026').replace(/\\u00b7/g, '\u00b7').replace(/\\n/g, '\n');
const lit = '\'((?:[^\'\\\\]|\\\\.)*)\'';

// ---- code -------------------------------------------------------------------------------------
const SKIP_FILES = new Set(['i18n.js', 'en.js', 'hi.js', 'voice-script.js', 'debug.js', 'textures.js', 'puppets.js', 'cinema-kit.js', 'cinematic.js', 'cinematic-scenes.js', 'cine-scenes.js']);
const walk = d => fs.readdirSync(path.join(root, d)).flatMap(f => { const p = d + '/' + f; return fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []); });
const NOT_UI = /^(No studio clip|Studio clip was not|\[voice\]|\[run\]|\[cinema|\[i18n|Could not start|Microphone unavailable|Camera unavailable|God mode|Solvable|box:|plane:|tex\.|wpn|pw\.|safe\.|alt\.|lk\.|hit\.|icon:|item:|mark:|switch:|spot:|altar:|locker:|loose)/;
const sinks = ['T', 'toast', 'alert', 'say', 'setHideCue', 'setObjective', 'objectiveDone', 'noPowerReason'];
// comments are stripped first: an apostrophe in a comment ("the altar's face") would misalign the quote pairing
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const IDS = /^([A-Z]\d{2,3}[a-z]?|sel|clue|Nov 1 1998|Oct 31 1998|AM|PM)$/;
walk('src').filter(p => !SKIP_FILES.has(path.basename(p))).forEach(p => {
  const src = stripComments(read(p));
  const addC = (k, w) => { if (!IDS.test(String(k).trim())) add(k, w); };
  sinks.forEach(fn => { const re = new RegExp('\\b' + fn + '\\(\\s*' + lit, 'g'); let m; while ((m = re.exec(src))) addC(unq(m[1]), p + ' ' + fn); });
  // ternaries inside T(...) and prompt functions: T(x ? 'a' : 'b')
  const tern = new RegExp('\\?\\s*' + lit + '\\s*:\\s*' + lit, 'g'); let m;
  while ((m = tern.exec(src))) [m[1], m[2]].forEach(s => { s = unq(s); if (/[A-Za-z]/.test(s) && /\s/.test(s) && !NOT_UI.test(s) && !/[=<>(){};]/.test(s)) addC(s, p + ' ternary'); });
  // any other sentence-like literal: starts with a capital or '{', has a space and a letter
  const any = new RegExp(lit, 'g');
  while ((m = any.exec(src))) { const s = unq(m[1]); if (/^[A-Z{\u2018"]/.test(s) && / /.test(s) && /[a-z]/.test(s) && !NOT_UI.test(s) && !/[=<>(){};#]|\$\{|\.js|https?:/.test(s) && s.length < 260) addC(s, p + ' literal'); }
});

// ---- data ---------------------------------------------------------------------------------------
const W = ctx.WORLD_DATA;
Object.values(W.ROOMS).forEach(r => add(r.name, 'ROOMS'));
W.SPOTS.forEach(s => { add(s.label, 'SPOTS.label'); add(s.hint, 'SPOTS.hint'); });
W.HIDES.forEach(h => add(h.label, 'HIDES'));
Object.values(W.KEY_NAMES).forEach(n => add(n, 'KEY_NAMES'));
W.NOTE_TEXTS.forEach(n => add(n, 'notes'));
['Moon', 'Eye', 'Horn', 'Easy', 'Normal', 'Nightmare', 'NARRATOR'].forEach(n => add(n, 'names'));
// ITEM_DEFS, STORY, DEATH_TEXT: parsed from source (they reference browser globals)
{ const s = read('src/gameplay/items.js'), re = new RegExp('(?:name|desc):\\s*' + lit, 'g'); let m; while ((m = re.exec(s))) if (m[1]) add(unq(m[1]), 'ITEM_DEFS'); }
const spokenSet = new Set();
{ const s = read('src/story/story.js'), re = new RegExp('\\[\'(?:DACRE|ROWAN|NARRATOR|ELSPETH)\',\\s*' + lit + '\\]', 'g'); let m; while ((m = re.exec(s))) { add(unq(m[1]), 'STORY'); spokenSet.add(unq(m[1])); } }
{ const s = read('src/gameplay/jumpscares.js'), block = s.slice(s.indexOf('const DEATH_TEXT'), s.indexOf('};', s.indexOf('const DEATH_TEXT'))), re = new RegExp(lit, 'g'); let m; while ((m = re.exec(block))) add(unq(m[1]), 'DEATH_TEXT'); }
// cutscenes
{
  const s = read('src/story/cine-scenes.js');
  let m; const cap = new RegExp('ctx\\.caption\\([^,]+,[^,]+,\\s*' + lit, 'g'); while ((m = cap.exec(s))) { add(unq(m[1]), 'caption'); spokenSet.add(unq(m[1])); }
  const ch = new RegExp('ctx\\.chapter\\([^,]+,[^,]+,\\s*' + lit + '\\s*,\\s*' + lit, 'g'); while ((m = ch.exec(s))) { add(unq(m[1]), 'chapter'); add(unq(m[2]), 'chapter sub'); }
  const k = new RegExp('kicker\\s*=\\s*' + lit, 'g'); while ((m = k.exec(s))) add(unq(m[1]), 'kicker');
}
// index.html
{
  const h = read('index.html'), norm = x => x.replace(/\s+/g, ' ').trim();
  let m; const t = /<([a-z0-9]+)([^>]*)\sdata-i18n(?:="")?(\s[^>]*)?>([\s\S]*?)<\/\1>/g; while ((m = t.exec(h))) if (!/data-i18n-html/.test(m[2])) add(norm(m[4]), 'html');
  const hh = /<([a-z0-9]+)[^>]*\sdata-i18n-html[^>]*>([\s\S]*?)<\/\1>/g; while ((m = hh.exec(h))) add(norm(m[2]), 'html-html');
  const at = /data-i18n-(?:title|aria|ph)="([^"]+)"/g; while ((m = at.exec(h))) add(m[1], 'html-attr');
}

// ---- check ----------------------------------------------------------------------------------------
const hi = ctx.I18N.tables.hi, missing = [];
keys.forEach((where, k) => { if (!Object.prototype.hasOwnProperty.call(hi, k)) missing.push([k, where]); });
// placeholders must survive translation
const broken = [];
keys.forEach((where, k) => { const v = hi[k]; if (typeof v !== 'string') return; const ph = (k.match(/\{\w+\}/g) || []).sort().join(), pv = (v.match(/\{\w+\}/g) || []).sort().join(); if (ph !== pv) broken.push([k, v]); });
// spoken lines should have a Devanagari copy for hi-IN voices
const spoken = [...spokenSet];
const noSpeech = spoken.filter(k => !ctx.I18N.speech.hi[k]);
if (process.argv.includes('--list')) keys.forEach((w, k) => console.log(JSON.stringify(k), '//', w));
console.log('keys', keys.size, '| hi entries', Object.keys(hi).length, '| missing', missing.length, '| placeholder mismatches', broken.length, '| spoken lines', spoken.length, 'without Devanagari', noSpeech.length);
missing.slice(0, 400).forEach(([k, w]) => console.log('MISSING', JSON.stringify(k), '<-', w));
broken.forEach(([k, v]) => console.log('PLACEHOLDER', JSON.stringify(k), '=>', JSON.stringify(v)));
noSpeech.slice(0, 50).forEach(k => console.log('NO-SPEECH', JSON.stringify(k)));
process.exit(missing.length || broken.length ? 1 : 0);
