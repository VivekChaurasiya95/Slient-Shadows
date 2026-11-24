#!/usr/bin/env node
'use strict';
// ==========================================================================
// Silent Shadows voice pack generator. Runs on YOUR machine, offline from the game.
// The API key lives in .env (git-ignored) and is read only here. The game never sees it:
// it just plays the finished audio files in assets/voice/.
//
//   node tools/voice-gen.js voices   [--lang hi] [--gender female] [--accent indian] [--search text] [--type community]
//   node tools/voice-gen.js audition [--lang en|hi|all]     one sample per emotional style -> voice/audition/index.html
//   node tools/voice-gen.js plan     [--lang en|hi|all]     what would be generated, and how many characters
//   node tools/voice-gen.js build    [--lang en|hi|all] [--only NARRATOR] [--force] [--limit N] [--dry] [--out dir]
//   node tools/voice-gen.js report   [--lang en|hi|all] [--strict]   clip lengths vs cutscene windows, missing clips
//
// Clips are cached by a fingerprint of (provider, model, voice, settings, text). Re-running only
// regenerates lines whose text, style or voice changed, so edits cost almost nothing.
// ==========================================================================
const fs = require('fs'), path = require('path');
const { ROOT, sourceLines, forLang } = require('./lib/voice-lines');

// ---- args and env --------------------------------------------------------------------------------
const argv = process.argv.slice(2), cmd = argv[0], opt = {};
for (let i = 1; i < argv.length; i++) { const a = argv[i]; if (a.indexOf('--') === 0) { const n = argv[i + 1]; if (n === undefined || n.indexOf('--') === 0) opt[a.slice(2)] = true; else { opt[a.slice(2)] = n; i++; } } }
try { fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { /* no .env */ }
const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, opt.config || path.join('voice', 'voice-config.json')), 'utf8'));
const OUT = path.resolve(ROOT, opt.out || 'assets/voice');
const langs = !opt.lang || opt.lang === 'all' ? ['en', 'hi'] : [opt.lang];
const die = m => { console.error('\n' + m + '\n'); process.exit(1); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

// ---- providers ---------------------------------------------------------------------------------------
const STAB = { v3: { creative: 0.0, natural: 0.5, robust: 1.0 }, v2: { creative: 0.3, natural: 0.5, robust: 0.75 } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const eleven = {
  name: 'elevenlabs', key: 'ELEVENLABS_API_KEY',
  get model() { return cfg.elevenlabs.model; },
  get tagged() { return /v3|v4/.test(cfg.elevenlabs.model); },
  base() { return (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, ''); },
  settings(st) { const s = cfg.styles[st], tab = this.tagged ? STAB.v3 : STAB.v2; return { stability: tab[s.stability] === undefined ? 0.5 : tab[s.stability], similarity_boost: cfg.elevenlabs.similarity, style: s.style, use_speaker_boost: cfg.elevenlabs.speakerBoost, speed: clamp(s.speed, 0.7, 1.2) }; },
  // Eleven v3/v4 read [tags] as direction. Older models cannot, so the tag is dropped and the style comes from the settings alone.
  text(line) { const s = cfg.styles[line.style], t = line.say.replace(/\u2019/g, '\'').replace(/\u2026/g, '...'); return (this.tagged && s.tag ? s.tag + ' ' : '') + t; },
  lang(l) { return /multilingual_v2/.test(cfg.elevenlabs.model) ? undefined : l; },
  print() { return { model: this.model, format: cfg.elevenlabs.outputFormat }; },
  kbps() { const m = /_(\d+)$/.exec(cfg.elevenlabs.outputFormat); return m ? Number(m[1]) : 128; },
  async synth(voice, line, seed) {
    const body = { text: this.text(line), model_id: this.model, voice_settings: this.settings(line.style), seed };
    const lc = this.lang(line.lang); if (lc) body.language_code = lc;
    return post(this.base() + '/v1/text-to-speech/' + encodeURIComponent(voice) + '?output_format=' + cfg.elevenlabs.outputFormat, { 'xi-api-key': process.env[this.key], 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, JSON.stringify(body));
  }
};
const azure = {
  name: 'azure', key: 'AZURE_SPEECH_KEY', model: 'azure-neural',
  base() { return (process.env.AZURE_BASE_URL || ('https://' + (process.env.AZURE_SPEECH_REGION || 'centralindia') + '.tts.speech.microsoft.com')).replace(/\/$/, ''); },
  settings(st) { return cfg.styles[st].azure || {}; },
  text(line) { return line.say.replace(/\u2019/g, '\'').replace(/\u2026/g, '...'); },
  print() { return { format: cfg.azure.outputFormat }; },
  kbps() { return cfg.azure.kbps || 96; },
  async synth(voice, line) {
    const a = this.settings(line.style), loc = /^([a-z]{2}-[A-Z]{2})/.exec(voice);
    const ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + (loc ? loc[1] : (line.lang === 'hi' ? 'hi-IN' : 'en-IN')) + '"><voice name="' + xmlEsc(voice) + '"><prosody rate="' + (a.rate || '0%') + '" pitch="' + (a.pitch || '0%') + '" volume="' + (a.volume || 'medium') + '">' + xmlEsc(this.text(line)) + '</prosody></voice></speak>';
    return post(this.base() + '/cognitiveservices/v1', { 'Ocp-Apim-Subscription-Key': process.env[this.key], 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': cfg.azure.outputFormat, 'User-Agent': 'silent-shadows-voice' }, ssml);
  }
};
const P = cfg.provider === 'azure' ? azure : eleven;
const stats = { calls: 0, retries: 0 };

// POST with backoff on 429 / 5xx (free plans have low concurrency, so one request at a time)
async function post(url, headers, body) {
  const base = Number(process.env.VOICE_RETRY_BASE_MS || 1500);
  for (let i = 0; ; i++) {
    stats.calls++;
    let r; try { r = await fetch(url, { method: 'POST', headers, body }); } catch (e) { if (i >= 3) throw e; stats.retries++; await sleep(base * 2 ** i); continue; }
    if (r.ok) return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
    const txt = (await r.text()).slice(0, 300);
    if ((r.status === 429 || r.status >= 500) && i < 3) { stats.retries++; const ra = Number(r.headers.get('retry-after')); await sleep(ra >= 0 && r.headers.get('retry-after') ? ra * 1000 : base * 2 ** i); continue; }
    if (r.status === 401 || r.status === 403) die('The provider rejected the API key (HTTP ' + r.status + '). Check ' + P.key + ' in .env.\n' + txt);
    throw new Error('HTTP ' + r.status + ' ' + txt);
  }
}

// ---- helpers ---------------------------------------------------------------------------------------------
const CHAIN = { ELSPETH: 'NARRATOR', MARGARET: 'NARRATOR', THOMAS: 'ELSPETH', ROWAN: 'DACRE', JOSIAH: 'DACRE', 'DR. VENN': 'DACRE' };
function voiceFor(who, lang) {
  for (let w = who, n = 0; w && n < 5; w = CHAIN[w], n++) { const v = cfg.voices[w]; const id = typeof v === 'string' ? v : v && v[lang]; if (id) return { id, via: w }; }
  return null;
}
const extFor = (type, buf) => /wav/.test(type) || buf.slice(0, 4).toString() === 'RIFF' ? 'wav' : /ogg|opus/.test(type) ? 'ogg' : 'mp3';
function duration(buf, ext) {
  if (ext === 'wav') { const br = buf.readUInt32LE(28); let p = 12; while (p + 8 < buf.length) { const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32LE(p + 4); if (id === 'data') return sz / br; p += 8 + sz; } }
  return buf.length * 8 / (P.kbps() * 1000);       // constant-bitrate mp3: close enough for a fit report
}
function loadManifest() { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')); } catch (e) { return { v: 1, clips: {} }; } }
function saveManifest(m) { fs.mkdirSync(OUT, { recursive: true }); const f = path.join(OUT, 'manifest.json'); fs.writeFileSync(f + '.tmp', JSON.stringify(m)); fs.renameSync(f + '.tmp', f); }

let SRC = null;
function allLines() {
  if (!SRC) SRC = sourceLines();
  const out = [];
  langs.forEach(l => forLang(l, SRC.lines, SRC.game).forEach(x => { if (!opt.only || x.who === opt.only) out.push(x); }));
  return out;
}
function fingerprint(line, voice) { return fnv(JSON.stringify([P.name, P.print(), voice, P.settings(line.style), P.text(line)])); }
function needKey() { if (!process.env[P.key]) die('No ' + P.key + ' set. Put it in a .env file in the project root (see .env.example). It is only read by this tool.'); }
function needVoices(lines) {
  const missing = new Set();
  lines.forEach(l => { if (!voiceFor(l.who, l.lang)) missing.add(l.who + ' (' + l.lang + ')'); });
  if (missing.size) die('No voice configured for: ' + [...missing].join(', ') + '\nSet voice ids in voice/voice-config.json. Find candidates with:\n  node tools/voice-gen.js voices --gender female --accent indian --lang hi\nand audition them (node tools/voice-gen.js audition) before generating everything.');
}

// ---- commands -----------------------------------------------------------------------------------------------------
async function cmdVoices() {
  needKey();
  const q = new URLSearchParams({ page_size: String(opt.size || 30), include_total_count: 'false' });
  ['gender', 'accent', 'age', 'search', 'category'].forEach(k => { if (opt[k]) q.set(k, opt[k]); });
  if (opt.lang) q.append('language', opt.lang); if (opt['use-case']) q.append('use_cases', opt['use-case']); if (opt.type) q.set('voice_type', opt.type);
  const r = await fetch(eleven.base() + '/v2/voices?' + q, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  if (!r.ok) die('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  console.log(j.voices.length + ' voices' + (j.has_more ? ' (more available: raise --size)' : '') + '\n');
  j.voices.forEach(v => { const L = v.labels || {}; console.log(v.voice_id + '  ' + (v.name || '').padEnd(22) + [L.gender, L.age, L.accent, L.use_case].filter(Boolean).join(' / ') + (v.category ? '  [' + v.category + ']' : '') + '\n    ' + (v.description || '').slice(0, 140) + (v.preview_url ? '\n    preview: ' + v.preview_url : '')); });
  console.log('\nBefore shipping: confirm the voice\'s licence allows commercial use on your plan (Voice Library terms), and never use a voice that imitates a real person without permission.');
}

async function cmdPlan() {
  const lines = allLines(), m = loadManifest(), by = {};
  let todo = 0, chars = 0;
  lines.forEach(l => {
    const v = voiceFor(l.who, l.lang), c = m.clips[l.key], need = !c || !v || c.h !== fingerprint(l, v.id);
    const k = l.lang + ' ' + l.who; by[k] = by[k] || { n: 0, chars: 0, todo: 0 }; by[k].n++; by[k].chars += P.text(l).length; if (need) { by[k].todo++; todo++; chars += P.text(l).length; }
  });
  console.log('provider ' + P.name + (P.model ? ' / ' + P.model : '') + '   ' + lines.length + ' lines\n');
  Object.keys(by).sort().forEach(k => console.log(k.padEnd(18) + String(by[k].n).padStart(4) + ' lines ' + String(by[k].chars).padStart(6) + ' chars   to generate: ' + by[k].todo));
  console.log('\nto generate now: ' + todo + ' clips, ' + chars + ' characters (plans meter characters or credits: check yours before running build)');
  const miss = new Set(); lines.forEach(l => { if (!voiceFor(l.who, l.lang)) miss.add(l.who + ' (' + l.lang + ')'); });
  if (miss.size) console.log('voices not configured yet: ' + [...miss].join(', '));
  const dev = lines.filter(l => l.lang === 'hi' && !l.devanagari); if (dev.length) console.log('\nWARNING ' + dev.length + ' Hindi lines have no Devanagari copy and will be read from Roman letters (less accurate):\n  ' + dev.slice(0, 5).map(l => l.src.slice(0, 50)).join('\n  '));
}

async function cmdBuild() {
  const lines = allLines(); needVoices(lines);
  if (!opt.dry) needKey();
  const m = loadManifest(); m.provider = P.name; m.model = P.model; m.built = new Date().toISOString();
  let done = 0, skipped = 0, failed = 0; const limit = Number(opt.limit || Infinity);
  for (const l of lines) {
    const v = voiceFor(l.who, l.lang), h = fingerprint(l, v.id), cur = m.clips[l.key];
    if (!opt.force && cur && cur.h === h && fs.existsSync(path.join(OUT, cur.f))) { skipped++; continue; }
    if (done >= limit) break;
    const tag = l.lang + ' ' + l.who.padEnd(8) + ' ' + l.style.padEnd(9);
    if (opt.dry) { console.log('would generate ' + tag + ' "' + l.say.slice(0, 50) + '"'); done++; continue; }
    try {
      const seed = parseInt(l.key.split('/')[2], 16) % 4294967295;
      const r = await P.synth(v.id, l, seed), ext = extFor(r.type, r.buf), rel = l.file.replace('@EXT@', ext);
      fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true }); fs.writeFileSync(path.join(OUT, rel), r.buf);
      if (cur && cur.f !== rel) { try { fs.unlinkSync(path.join(OUT, cur.f)); } catch (e) { /* gone */ } }
      m.clips[l.key] = { f: rel, d: Math.round(duration(r.buf, ext) * 100) / 100, p: l.p, s: l.style, h, w: l.who, b: r.buf.length };
      saveManifest(m); done++; console.log('ok   ' + tag + ' ' + m.clips[l.key].d.toFixed(1) + 's  "' + l.say.slice(0, 44) + '"');
    } catch (e) { failed++; console.log('FAIL ' + tag + ' "' + l.say.slice(0, 44) + '" ' + e.message); }
  }
  if (!opt.dry) saveManifest(m);
  const live = new Set(lines.map(l => l.key)), orphans = Object.keys(m.clips).filter(k => langs.some(L => k.indexOf(L + '/') === 0) && !live.has(k));
  console.log('\n' + (opt.dry ? 'dry run: ' : '') + done + ' generated, ' + skipped + ' up to date, ' + failed + ' failed, ' + stats.calls + ' API calls (' + stats.retries + ' retries)');
  if (orphans.length) console.log(orphans.length + ' clips no longer match any line (kept). Delete them from the manifest and folder if you removed those lines.');
  if (failed) process.exitCode = 1;
}

async function cmdAudition() {
  needKey();
  const A = path.resolve(ROOT, opt['audition-dir'] || path.join('voice', 'audition')), g = (SRC || (SRC = sourceLines())).game, rows = [];
  fs.mkdirSync(A, { recursive: true });
  for (const L of langs) for (const s of g.VoiceScript.SAMPLE) {
    const line = forLang(L, [{ id: 'sample', who: s.who, src: s.src, scene: 'sample', p: 9 }], g)[0], v = voiceFor(s.who, L);
    if (!v) { console.log('skip ' + L + ' ' + s.style + ': no voice for ' + s.who); continue; }
    const r = await P.synth(v.id, line, 1), ext = extFor(r.type, r.buf), f = L + '-' + s.style + '-' + s.who.replace(/[^A-Z]/g, '') + '.' + ext;
    fs.writeFileSync(path.join(A, f), r.buf); rows.push({ L, s, f, line, v });
    console.log('ok   ' + f + '  "' + line.say.slice(0, 50) + '"');
  }
  const html = '<!doctype html><meta charset="utf-8"><title>Silent Shadows voice audition</title><body style="font:15px system-ui;background:#111;color:#ddd;max-width:820px;margin:30px auto"><h1>Voice audition</h1><p>Listen with headphones. Judge each style on its own: does it sound like a person, in that situation? Edit <code>voice/voice-config.json</code> (stability, style, speed, tag) and re-run <code>audition</code> until it does.</p>' +
    rows.map(r => '<div style="margin:18px 0;padding:12px;border:1px solid #333"><b>' + r.L.toUpperCase() + ' &middot; ' + r.s.style + '</b> (' + r.s.who + ', voice ' + r.v.id + ')<br><i>' + r.line.shown.replace(/</g, '&lt;') + '</i><br><audio controls src="' + r.f + '"></audio></div>').join('') + '</body>';
  fs.writeFileSync(path.join(A, 'index.html'), html);
  console.log('\nOpen ' + path.join(A, 'index.html') + ' and listen.');
}

async function cmdReport() {
  const lines = allLines(), m = loadManifest(); let missing = 0, over = 0, long = 0;
  lines.forEach(l => {
    const c = m.clips[l.key];
    if (!c) { missing++; console.log('MISSING ' + l.lang + ' ' + l.who + ' "' + l.src.slice(0, 50) + '"'); return; }
    if (l.win) { const room = l.win - 0.35, ratio = c.d / room; if (ratio > 1.1) { over++; console.log('TOO LONG ' + l.lang + ' ' + c.d.toFixed(1) + 's in a ' + l.win.toFixed(1) + 's caption (' + l.scene + ') "' + l.src.slice(0, 44) + '"  shorten the line or lengthen the caption window'); } }
    if (c.d > 9) { long++; console.log('LONG LINE ' + l.lang + ' ' + c.d.toFixed(1) + 's "' + l.src.slice(0, 44) + '"  consider splitting it'); }
  });
  const have = lines.length - missing;
  console.log('\n' + have + '/' + lines.length + ' clips present, ' + missing + ' missing, ' + over + ' too long for their caption (even sped up 10%), ' + long + ' very long');
  if (opt.strict && (missing || over)) process.exitCode = 1;
}

const CMDS = { voices: cmdVoices, plan: cmdPlan, build: cmdBuild, audition: cmdAudition, report: cmdReport };
if (!CMDS[cmd]) die('Usage: node tools/voice-gen.js <voices|audition|plan|build|report> [options]  (see the header of this file)');
CMDS[cmd]().catch(e => die('Failed: ' + (e && e.message || e)));
