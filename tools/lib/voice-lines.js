'use strict';
// Builds the full list of spoken lines for both languages, from the game's own source files.
// Nothing here is typed twice: STORY lines come from story.js, cutscene captions from cine-scenes.js,
// the Hinglish and its Devanagari copy from hi.js, the style and clip names from voice-script.js.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function loadGame() {
  const ctx = { console, Math, JSON, Object, Array, String, Number, Set, Map, Symbol };
  ctx.window = ctx; vm.createContext(ctx);
  const run = (p, tail) => vm.runInContext(read(p) + (tail || ''), ctx, { filename: p });
  run('src/core/core.js', '\nthis.clamp = clamp;');
  run('src/i18n/i18n.js', '\nthis.I18N = I18N;');
  run('src/i18n/en.js'); run('src/i18n/hi.js');
  run('src/audio/voice-script.js', '\nthis.VoiceScript = VoiceScript;');
  run('src/story/story.js', '\nthis.STORY = STORY;');
  return ctx;
}
const unq = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\'/g, '\'').replace(/\\n/g, '\n');

// Every spoken line as { id, who, src, scene, p, win }. p is the preload priority (0 = needed first).
function sourceLines() {
  const g = loadGame(), out = [], seen = new Set();
  const add = (id, who, src, scene, p, win) => { const k = who + '|' + src; if (seen.has(k)) return; seen.add(k); out.push({ id, who, src, scene, p, win: win || null }); };
  // cutscene captions: the opening first, then the room memories
  const cs = read('src/story/cine-scenes.js'), re = /CINE_SCENES\.(\w+) = \{/g, marks = []; let m;
  while ((m = re.exec(cs))) marks.push({ id: m[1], at: m.index });
  marks.forEach((mk, i) => {
    const body = cs.slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : cs.length);
    const cap = /ctx\.caption\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*'((?:[^'\\]|\\.)*)'(?:\s*,\s*'([^']*)')?/g; let c;
    while ((c = cap.exec(body))) add(mk.id + '@' + c[1], c[4] || 'NARRATOR', unq(c[3]), mk.id, mk.id === 'opening' ? 0 : 2, Number(c[2]) - Number(c[1]));
  });
  // story, radio and thought lines
  Object.keys(g.STORY.lines).forEach(id => g.STORY.lines[id].forEach(l => add(id, l[0], l[1], 'story', 1)));
  return { lines: out, game: g };
}

// The line to display and the line to give the voice, in one language
function forLang(lang, lines, g) {
  const hi = g.I18N.tables.hi, dev = g.I18N.speech.hi;
  return lines.map(l => {
    const shown = lang === 'hi' ? (hi[l.src] || l.src) : l.src;
    // Hindi is synthesised from the Devanagari copy so the voice reads Hindi, not English letters
    const say = lang === 'hi' ? (dev[l.src] || hi[l.src] || l.src) : l.src;
    return Object.assign({}, l, { lang, shown, say, style: g.VoiceScript.styleFor(l.src, l.who), key: g.VoiceScript.key(lang, l.who, l.src), file: g.VoiceScript.file(lang, l.who, l.src, '@EXT@'), devanagari: lang === 'hi' && !!dev[l.src] });
  });
}

module.exports = { ROOT, loadGame, sourceLines, forLang };
