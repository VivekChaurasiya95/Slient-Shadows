'use strict';
// ==========================================================================
// VOICE: plays pre-generated studio voice clips (assets/voice/<lang>/*.mp3) through the game's
// own AudioEngine, so the room reverb, 3D panning, pause and volume controls all apply.
//
// One lane, one voice at a time. A line waits for the previous one to finish, then a short
// silence (style-dependent, game time, so pausing freezes it), then plays. Nothing overlaps.
//
// If a clip is missing the game does NOT go quiet and does NOT pretend: it falls back to the
// basic browser voice or to text-only (player's choice in Options), says so on screen once,
// logs it to the console, and keeps counting (Voice.stats). The decision to fall back is made
// per line, so a half-generated voice pack still works.
// ==========================================================================
const Voice = {
  KEY: 'silentshadows.voice.v1',
  base: 'assets/voice/',
  game: null, manifest: null, loaded: false, enabled: true,
  fallback: 'browser',                      // 'browser' | 'text'
  vol: { narr: 1, char: 1, env: 1 },
  buffers: new Map(), loading: new Map(),
  queue: [], cur: null, wait: 0, held: false, seq: 0, token: 0,
  stats: { studio: 0, browser: 0, text: 0, stale: 0, missing: 0, late: 0 },
  log: [], warned: {}, listeners: [], preloadToken: 0, lastClip: null,

  // ---- setup ----------------------------------------------------------------------------
  attach(game) {
    this.game = game;
    try { const s = JSON.parse(localStorage.getItem(this.KEY) || '{}'); if (s.vol) Object.assign(this.vol, s.vol); if (s.fallback) this.fallback = s.fallback; } catch (e) { /* storage blocked */ }
    ['narr', 'char', 'env'].forEach(k => { game.audio[k + 'Vol'] = this.vol[k]; });
    I18N.onChange(() => this.onLanguage());
    return this.load();
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify({ vol: this.vol, fallback: this.fallback })); } catch (e) { /* storage blocked */ } },
  setVolume(k, v) { this.vol[k] = v; this.game.audio.setBusVolume(k, v); this.save(); },
  setFallback(m) { this.fallback = m === 'text' ? 'text' : 'browser'; this.save(); this.emit(); },
  onStatus(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); },

  async load() {
    try {
      const r = await fetch(this.base + 'manifest.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      this.manifest = await r.json();
    } catch (e) { this.manifest = null; this.logEvent('manifest-missing', String(e.message || e)); }
    this.loaded = true; this.emit();
    this.preload();
    return this.manifest;
  },
  clips(lang) { const out = []; if (this.manifest) { const pre = (lang || I18N.lang) + '/'; for (const k in this.manifest.clips) if (k.indexOf(pre) === 0) out.push(k); } return out; },
  has(who, src) { return !!(this.manifest && this.manifest.clips[VoiceScript.key(I18N.lang, who, src)]); },

  // Text for the Options panel. Returns an English source string and its parameters (translated by T()).
  statusInfo() {
    const n = this.clips().length;
    if (!this.loaded) return { s: 'Studio voice: checking...', p: {}, level: 'pending' };
    if (!n) return { s: this.fallback === 'text' ? 'Studio voice not installed. Showing text only' : 'Studio voice not installed. Using the basic browser voice', p: {}, level: 'none' };
    if (this.stats.missing) return { s: 'Studio voice ready ({n} clips), but {m} lines have no clip yet', p: { n, m: this.stats.missing }, level: 'partial' };
    return { s: 'Studio voice ready ({n} clips)', p: { n }, level: 'ready' };
  },

  // ---- loading -----------------------------------------------------------------------------
  decoder() { return this._dec || (this._dec = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100)); },
  fetchBuf(key, clip) {
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key));
    if (this.loading.has(key)) return this.loading.get(key);
    const p = fetch(this.base + clip.f).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + clip.f); return r.arrayBuffer(); })
      .then(ab => this.decoder().decodeAudioData(ab))
      .then(buf => { this.buffers.set(key, buf); this.loading.delete(key); return buf; })
      .catch(e => { this.loading.delete(key); this.logEvent('load-failed', key + ' ' + (e.message || e)); return null; });
    this.loading.set(key, p); return p;
  },
  // Loads the current language, most important clips first (opening, then story, then room memories)
  async preload() {
    if (!this.manifest) return;
    const tok = ++this.preloadToken, keys = this.clips().sort((a, b) => (this.manifest.clips[a].p || 9) - (this.manifest.clips[b].p || 9));
    let i = 0;
    const worker = async () => { while (i < keys.length && tok === this.preloadToken) { const k = keys[i++]; await this.fetchBuf(k, this.manifest.clips[k]); } };
    await Promise.all([worker(), worker(), worker()]);
    if (tok === this.preloadToken) this.logEvent('preloaded', I18N.lang + ' ' + keys.length + ' clips');
  },
  onLanguage() {
    this.stopCurrent(true); this.queue = []; this.wait = 0;
    this.buffers.clear(); this.stats.missing = 0; this.warned = {};
    this.preload(); this.emit();
  },

  // ---- speaking -------------------------------------------------------------------------------
  // o: { src (English source line), text (shown line), who, style?, pos?, send?, fit?, maxWait?, interrupt?, onstart, onend }
  //   pos: {x,y,z} for a voice that comes from somewhere in the house, or 'rand' for a distant one
  //   fit: seconds the clip should fit in (cutscene caption window); played up to 10% faster if it overruns
  //   maxWait: ms a line may wait for its turn before it is dropped (cutscene captions)
  speak(o) {
    const it = Object.assign({ who: 'NARRATOR', id: ++this.seq, t0: performance.now(), tok: this.token }, o);
    it.src = it.src || it.text; it.text = it.text || it.src;
    it.style = it.style || VoiceScript.styleFor(it.src, it.who);
    if (!VoiceScript.STYLES[it.style]) it.style = 'normal';
    if (!this.enabled) { this.timed(it, 'off'); return it; }
    if (it.interrupt) { this.stopCurrent(false); this.queue = []; this.wait = 0; }
    this.queue.push(it); this.pump();
    return it;
  },
  pump() {
    if (this.cur || this.held || this.wait > 0 || !this.queue.length) return;
    const it = this.queue.shift();
    if (it.maxWait && performance.now() - it.t0 > it.maxWait) { this.stats.stale++; this.logEvent('stale', it.src.slice(0, 40)); this.pump(); return; }
    this.cur = it; it.state = 'pre'; it.pre = VoiceScript.STYLES[it.style].before;
  },
  update(dt) {
    if (this.held) return;
    if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) { this.wait = 0; this.pump(); } }
    const it = this.cur; if (!it) { if (this.queue.length) this.pump(); return; }
    if (it.state === 'pre') { it.pre -= dt; if (it.pre <= 0) { it.state = 'start'; this.begin(it); } }
    else if (it.state === 'timed') { it.left -= dt; if (it.left <= 0) this.finish(it, it.how); }
  },

  async begin(it) {
    const lang = I18N.lang, key = VoiceScript.key(lang, it.who, it.src), clip = this.manifest && this.manifest.clips[key];
    if (clip) {
      let buf = this.buffers.get(key);
      if (!buf) { it.state = 'loading'; buf = await Promise.race([this.fetchBuf(key, clip), new Promise(r => setTimeout(() => r(null), 2500))]); }
      if (this.cur !== it) return;                                     // stopped while loading
      if (buf && this.game.audio.ensure() && this.game.audio.ready) { this.play(it, buf, key, clip); return; }
      this.stats.late++; this.note('late:' + lang, 'Studio clip was not ready in time (' + key + '). Falling back for this line.');
    } else {
      this.stats.missing++; this.emit();
      this.note('missing:' + lang, 'No studio clip for ' + key + ' ("' + it.src.slice(0, 50) + '"). Run: node tools/voice-gen.js build --lang ' + lang);
    }
    this.fallbackSpeak(it);
  },

  play(it, buf, key, clip) {
    const A = this.game.audio, c = A.ctx, S = VoiceScript.STYLES[it.style];
    const src = c.createBufferSource(); src.buffer = buf;
    let rate = 1;
    if (it.fit && buf.duration > it.fit) rate = Math.min(1.1, buf.duration / it.fit);
    src.playbackRate.value = rate;
    const nodes = [src], link = n => { nodes[nodes.length - 1].connect(n); nodes.push(n); return n; };
    const g = link(c.createGain()); g.gain.value = S.gain * (it.gain || 1);
    // close-mic warmth for whispers and intimate lines: a gentle low-shelf, nothing more
    if (S.shelf) { const sh = link(c.createBiquadFilter()); sh.type = 'lowshelf'; sh.frequency.value = 220; sh.gain.value = S.shelf; }
    // a voice from somewhere in the house is also softened and placed
    let pos = it.pos === 'rand' ? A.randPos(5) : it.pos;
    if (pos) {
      const lp = link(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.5;
      const pn = link(c.createPanner()); pn.panningModel = 'equalpower'; pn.distanceModel = 'inverse'; pn.refDistance = 2; pn.maxDistance = 40; pn.rolloffFactor = 1;
      if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y === undefined ? 1.3 : pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y === undefined ? 1.3 : pos.y, pos.z);
    } else if (S.lp) { const lp = link(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = S.lp; }
    const bus = it.who === 'NARRATOR' ? A.narrBus : A.charBus, last = nodes[nodes.length - 1];
    last.connect(bus);
    // the room's reverb: a voice in the cellar sounds like it is in the cellar, but never washed out
    const send = c.createGain(); send.gain.value = it.send === undefined ? S.send * (pos ? 2 : 1) : it.send; last.connect(send); send.connect(A.reverb); nodes.push(send);
    it.nodes = nodes; it.src_ = src; it.gainNode = g; it.how = 'studio'; it.state = 'playing'; it.rate = rate;
    src.onended = () => this.finish(it, 'studio');
    src.start();
    this.stats.studio++; this.lastClip = { key, style: it.style, rate, dur: buf.duration, pos: !!pos, file: clip.f };
    this.logEvent('start', it.style + ' ' + key + (rate > 1 ? ' x' + rate.toFixed(2) : ''));
    if (it.onstart) it.onstart('studio');
  },

  fallbackSpeak(it) {
    const mode = this.fallback;
    if (mode === 'browser' && typeof Narrator !== 'undefined' && Narrator.ok()) {
      it.how = 'browser'; it.state = 'playing'; this.stats.browser++;
      this.logEvent('start', 'browser ' + it.src.slice(0, 40));
      if (it.onstart) it.onstart('browser');
      const guard = setTimeout(() => this.finish(it, 'browser'), it.text.length * 110 + 5000);   // a speech engine that never reports back
      Narrator.speak(it.text, it.who, { src: it.src, onend: () => { clearTimeout(guard); this.finish(it, 'browser'); } });
      it.guard = guard;
      return;
    }
    this.timed(it, 'text');
  },
  // text-only: the line stays up for a natural reading time, then ends
  timed(it, how) {
    if (how === 'off') { this.runTimed(it); return; }
    it.how = how; it.state = 'timed'; it.left = Math.max(1.8, it.text.length * 0.062);
    this.stats.text++; this.logEvent('start', 'text ' + it.src.slice(0, 40));
    if (it.onstart) it.onstart('text');
  },
  // narration switched off: the line never enters the lane, so a muted line can never block a voiced one
  runTimed(it) {
    if (it.onstart) it.onstart('off');
    const ms = Math.max(1800, it.text.length * 62);
    if (it.onend) { const tok = this.token; setTimeout(() => { if (tok === this.token) it.onend('off'); }, ms); }
  },

  finish(it, how) {
    if (it.done) return; it.done = true;
    if (it.guard) clearTimeout(it.guard);
    if (it.nodes) { try { it.nodes.forEach(n => n.disconnect()); } catch (e) { /* already gone */ } }
    if (this.cur === it) { this.cur = null; this.wait = VoiceScript.STYLES[it.style].after; }
    this.logEvent('end', it.style + ' ' + how);
    if (it.onend && it.tok === this.token) it.onend(how);
    this.pump();
  },

  // ---- control ----------------------------------------------------------------------------------
  // callEnd: finish the current line normally (its onend runs). Otherwise it is dropped silently.
  stopCurrent(callEnd) {
    const it = this.cur; if (!it) { if (typeof Narrator !== 'undefined') Narrator.stop(); return; }
    this.cur = null;
    if (it.guard) clearTimeout(it.guard);
    if (it.src_) {
      // a short fade so a cut line does not click
      try { const A = this.game.audio, t = A.ctx.currentTime; it.gainNode.gain.cancelScheduledValues(t); it.gainNode.gain.setTargetAtTime(0, t, 0.025); it.src_.onended = null; it.src_.stop(t + 0.12); setTimeout(() => { try { it.nodes.forEach(n => n.disconnect()); } catch (e) { /* gone */ } }, 250); } catch (e) { /* already stopped */ }
    }
    if (typeof Narrator !== 'undefined') Narrator.stop();
    it.done = true;
    this.logEvent('stop', it.style + (callEnd ? ' (continue)' : ''));
    if (callEnd && it.onend && it.tok === this.token) it.onend('stopped');
  },
  // restart, new run, leaving a cutscene: drop everything, call nothing
  stop() { this.token++; this.stopCurrent(false); this.queue = []; this.wait = 0; },
  pause() { this.held = true; if (typeof Narrator !== 'undefined') Narrator.pause(); },
  resume() { this.held = false; if (typeof Narrator !== 'undefined') Narrator.resume(); },
  setEnabled(on) { this.enabled = !!on; if (!on) this.stop(); },
  busy() { return !!(this.cur || this.queue.length); },

  // ---- diagnostics ---------------------------------------------------------------------------------
  // One console warning per reason, plus one on-screen notice, so a fallback is never silent
  note(reason, msg) {
    if (this.warned[reason]) return; this.warned[reason] = true;
    console.warn('[voice] ' + msg);
    const g = this.game; if (g && g.hud && g.isPlaying) g.hud.toast(this.fallback === 'text' ? 'Studio voice missing: showing text only' : 'Studio voice missing: using the basic browser voice');
    this.emit();
  },
  logEvent(type, detail) { this.log.push({ t: Math.round(performance.now()), type, detail }); if (this.log.length > 300) this.log.shift(); },
  sample(style, lang) {
    const s = VoiceScript.SAMPLE.find(x => x.style === style); if (!s) return;
    this.stop(); this.speak({ src: s.src, text: T(s.src), who: s.who, style });
  }
};
