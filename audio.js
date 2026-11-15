'use strict';
// ==========================================================================
// AUDIO: fully procedural Web Audio engine.
// master -> compressor -> out. Every sfx goes through sfxBus (dry + reverb send).
// Ambience (drone, wind, creaks, whispers, music box) is created once and
// faded in/out, never re-created.
// ==========================================================================
class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.ready = false;
    this.ambOn = false;
    this.timers = { creak: 4, whisper: 12, thud: 20, music: 40, heart: 0, breath: 0 };
    this.fear = 0;
    this.tension = 0;
    this.room = null;
    this.ghostProx = 0;
    this.chaseOn = false;
  }

  // Must run from a user gesture the first time
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.master.connect(this.comp); this.comp.connect(c.destination);

    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.4);
    this.revLP = c.createBiquadFilter(); this.revLP.type = 'lowpass'; this.revLP.frequency.value = 2400;
    this.revGain = c.createGain(); this.revGain.gain.value = 0.25;
    this.send = c.createGain(); this.send.gain.value = 1;
    this.sfxBus.connect(this.send);
    this.send.connect(this.reverb); this.reverb.connect(this.revLP); this.revLP.connect(this.revGain); this.revGain.connect(this.master);

    // Cached noise buffers
    this.noiseBuf = this.makeNoise(2.5);
    this.pinkBuf = this.makeNoise(2.5, true);

    this.buildAmbience();
    this.ready = true;
  }

  makeImpulse(seconds, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise(seconds, pink) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (pink) { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w;
    }
    return buf;
  }

  // Per-room acoustics: crypt is wet and echoey, bedroom dry
  setRoom(room) {
    this.room = room;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.revGain.gain.cancelScheduledValues(t);
    this.revGain.gain.linearRampToValueAtTime(0.12 + (room.def.wet || 0.2) * 0.9, t + 0.6);
    this.revLP.frequency.linearRampToValueAtTime(room.def.floor === 'stone' ? 3200 : 2000, t + 0.6);
  }

  // Keep the 3D listener on the player camera
  updateListener(cam) {
    if (!this.ready) return;
    const l = this.ctx.listener, p = cam.position;
    const f = TMP.v1.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const u = TMP.v2.set(0, 1, 0).applyQuaternion(cam.quaternion);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = u.x; l.upY.value = u.y; l.upZ.value = u.z;
    } else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  }

  // Returns an input node. With pos it is spatialised, otherwise it is the dry bus.
  out(pos, vol) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = vol === undefined ? 1 : vol;
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = 2; p.maxDistance = 40; p.rolloffFactor = 1.1;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y === undefined ? 1.2 : pos.y; p.positionZ.value = pos.z; }
      else p.setPosition(pos.x, pos.y === undefined ? 1.2 : pos.y, pos.z);
      g.connect(p); p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  // ---- building blocks ----------------------------------------------------
  tone(o) {
    if (!this.ready) return null;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const peak = o.gain === undefined ? 0.2 : o.gain, atk = o.atk || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(this.out(o.pos, 1));
    osc.start(t); osc.stop(t + o.dur + 0.05);
    return osc;
  }

  noise(o) {
    if (!this.ready) return null;
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = o.pink ? this.pinkBuf : this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 800, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain === undefined ? 0.2 : o.gain, t + (o.atk || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(this.out(o.pos, 1));
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
    return src;
  }

  say(text) { if (this.game.hud) this.game.hud.subtitle(text); }

  // ---- continuous ambience (built once) -----------------------------------
  buildAmbience() {
    const c = this.ctx;
    this.amb = c.createGain(); this.amb.gain.value = 0;
    this.amb.connect(this.master);
    const ambSend = c.createGain(); ambSend.gain.value = 0.4;
    this.amb.connect(ambSend); ambSend.connect(this.reverb);

    // Low drone: two detuned saws + sub, slow filter movement
    this.droneFilter = c.createBiquadFilter(); this.droneFilter.type = 'lowpass'; this.droneFilter.frequency.value = 140;
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0.11;
    [41, 41.6, 61.5].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = i === 2 ? 0.5 : 1; o.connect(g); g.connect(this.droneFilter); o.start();
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 50; lfo.connect(lfoG); lfoG.connect(this.droneFilter.frequency); lfo.start();
    this.droneFilter.connect(this.droneGain); this.droneGain.connect(this.amb);

    // Wind: filtered noise with a slow random swell
    const wind = c.createBufferSource(); wind.buffer = this.pinkBuf; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.7;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.05;
    const wl = c.createOscillator(); wl.frequency.value = 0.11;
    const wlg = c.createGain(); wlg.gain.value = 0.03; wl.connect(wlg); wlg.connect(this.windGain.gain); wl.start();
    wind.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.amb); wind.start();

    // Chase theme: pulsing sub bass + dissonant high drone, silent until needed
    this.chaseGain = c.createGain(); this.chaseGain.gain.value = 0; this.chaseGain.connect(this.master);
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 55;
    const pulse = c.createGain(); pulse.gain.value = 0.5;
    const pl = c.createOscillator(); pl.type = 'square'; pl.frequency.value = 2.4;
    const pg = c.createGain(); pg.gain.value = 0.5; pl.connect(pg); pg.connect(pulse.gain);
    sub.connect(pulse); pulse.connect(this.chaseGain);
    [330, 349.2, 466].forEach(f => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = c.createGain(); g.gain.value = 0.05; o.connect(lp); lp.connect(g); g.connect(this.chaseGain); o.start();
    });
    sub.start(); pl.start();

    // Ghost proximity: wet breathing + static, volumes driven by distance
    const br = c.createBufferSource(); br.buffer = this.pinkBuf; br.loop = true;
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 900; bf.Q.value = 1.4;
    this.breathGain = c.createGain(); this.breathGain.gain.value = 0;
    const bl = c.createOscillator(); bl.frequency.value = 0.38;
    const blg = c.createGain(); blg.gain.value = 0.5; bl.connect(blg);
    const bm = c.createGain(); bm.gain.value = 0.5; blg.connect(bm.gain);
    br.connect(bf); bf.connect(bm); bm.connect(this.breathGain);
    this.breathPan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (this.breathPan) { this.breathGain.connect(this.breathPan); this.breathPan.connect(this.master); } else this.breathGain.connect(this.master);
    br.start(); bl.start();
    const st = c.createBufferSource(); st.buffer = this.noiseBuf; st.loop = true;
    const sf = c.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 3500;
    this.staticGain = c.createGain(); this.staticGain.gain.value = 0;
    st.connect(sf); sf.connect(this.staticGain); this.staticGain.connect(this.master); st.start();
  }

  startAmbience() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    this.amb.gain.cancelScheduledValues(t);
    this.amb.gain.linearRampToValueAtTime(1, t + 3);
    this.ambOn = true;
  }

  stopAmbience(fade) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.amb.gain.cancelScheduledValues(t);
    this.amb.gain.linearRampToValueAtTime(0, t + (fade === undefined ? 2 : fade));
    this.chaseGain.gain.linearRampToValueAtTime(0, t + 1);
    this.ambOn = false;
  }

  setChase(on) {
    if (!this.ready || this.chaseOn === on) return;
    this.chaseOn = on;
    const t = this.ctx.currentTime;
    this.chaseGain.gain.cancelScheduledValues(t);
    this.chaseGain.gain.linearRampToValueAtTime(on ? 0.55 : 0, t + (on ? 0.6 : 2.5));
  }

  // fear 0..100, tension 0..1, prox 0..1 (ghost nearness), angle -1..1 (left/right)
  setState(fear, tension, prox, pan) {
    this.fear = fear; this.tension = tension; this.ghostProx = prox;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.droneFilter.frequency.setTargetAtTime(120 + tension * 160 + fear * 2, t, 0.5);
    this.droneGain.gain.setTargetAtTime(0.09 + tension * 0.08, t, 0.5);
    this.windGain.gain.setTargetAtTime(0.045 + tension * 0.03, t, 0.5);
    this.breathGain.gain.setTargetAtTime(prox * prox * 0.5, t, 0.2);
    this.staticGain.gain.setTargetAtTime(prox > 0.35 ? (prox - 0.35) * 0.06 : 0, t, 0.2);
    if (this.breathPan) this.breathPan.pan.setTargetAtTime(clamp(pan || 0, -1, 1), t, 0.2);
  }

  // Scheduled one-shots: creaks, whispers, thuds, music box, heartbeat
  update(dt, cam) {
    if (!this.ready) return;
    this.updateListener(cam);
    if (!this.ambOn) return;
    const T = this.timers, tn = this.tension;
    T.creak -= dt; T.whisper -= dt; T.thud -= dt; T.music -= dt; T.heart -= dt;
    if (T.creak <= 0) { T.creak = this.rr(5, 13) / (1 + tn); this.creak(this.randPos(8), 0.35 + tn * 0.2); }
    if (T.whisper <= 0) { T.whisper = this.rr(12, 30) / (1 + tn * 1.2); this.whisper(this.randPos(5), 0.25 + this.fear * 0.004); }
    if (T.thud <= 0) { T.thud = this.rr(18, 45) / (1 + tn); this.thud(this.randPos(14), 0.5); }
    if (T.music <= 0) { T.music = this.rr(40, 90); this.musicBox(this.randPos(10), 0.22 + tn * 0.1, false); }
    if (this.fear > 25 && T.heart <= 0) {
      const bpm = 70 + this.fear * 0.9;
      T.heart = 60 / bpm;
      this.heartbeat(Math.min(0.55, (this.fear - 20) / 160));
    }
  }

  rr(a, b) { return a + Math.random() * (b - a); }
  randPos(r) {
    const p = this.game.camera.position, a = Math.random() * Math.PI * 2, d = 3 + Math.random() * r;
    return { x: p.x + Math.cos(a) * d, y: 1.4, z: p.z + Math.sin(a) * d };
  }

  // ---- sound effects ------------------------------------------------------
  footstep(surface, vol, pos) {
    if (!this.ready) return;
    const v = (vol === undefined ? 1 : vol);
    if (surface === 'stone') {
      this.noise({ filter: 'bandpass', f0: 1100, q: 1.2, dur: 0.13, gain: 0.16 * v, pos });
      this.tone({ type: 'sine', f0: 110, f1: 55, dur: 0.1, gain: 0.1 * v, pos });
    } else {
      this.noise({ filter: 'lowpass', f0: 420 + Math.random() * 120, dur: 0.14, gain: 0.2 * v, pos });
      this.tone({ type: 'triangle', f0: 90, f1: 40, dur: 0.09, gain: 0.08 * v, pos });
      if (Math.random() < 0.3) this.noise({ filter: 'bandpass', f0: 1800, q: 4, dur: 0.05, gain: 0.04 * v, delay: 0.03, pos });
    }
  }

  // speed 0 (slow, quiet) .. 1 (fast, loud). Pitch follows speed.
  creak(pos, vol, speed) {
    if (!this.ready) return;
    const s = speed === undefined ? 0.4 : speed, dur = 0.5 + (1 - s) * 1.3;
    const f = 150 + Math.random() * 90 + s * 70;
    const osc = this.tone({ type: 'sawtooth', f0: f, f1: f * (0.8 + Math.random() * 0.5), dur, gain: (vol || 0.3) * 0.22, atk: dur * 0.3, lp: 700, pos });
    if (osc) {
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 9 + s * 12;
      const g = this.ctx.createGain(); g.gain.value = f * 0.05; lfo.connect(g); g.connect(osc.frequency);
      lfo.start(); lfo.stop(this.ctx.currentTime + dur + 0.1);
    }
    this.noise({ filter: 'bandpass', f0: 1200, f1: 700, q: 6, dur, gain: (vol || 0.3) * 0.07, pos });
    this.say('[Wood creaks]');
  }

  doorOpen(speed, pos) { this.creak(pos, 0.25 + speed * 0.45, speed); this.tone({ type: 'square', f0: 700, f1: 300, dur: 0.04, gain: 0.05, pos }); }
  doorClose(loud, pos) {
    this.tone({ type: 'sine', f0: 120, f1: 45, dur: 0.22, gain: 0.35 * loud, pos });
    this.noise({ filter: 'lowpass', f0: 600, dur: 0.18, gain: 0.25 * loud, pos });
    this.tone({ type: 'square', f0: 900, f1: 400, dur: 0.03, gain: 0.05, delay: 0.02, pos });
  }
  doorSlam(pos) {
    this.tone({ type: 'sine', f0: 90, f1: 30, dur: 0.5, gain: 0.8, pos });
    this.noise({ filter: 'lowpass', f0: 1500, f1: 200, dur: 0.45, gain: 0.7, pos });
    this.noise({ filter: 'highpass', f0: 2500, dur: 0.1, gain: 0.25, pos });
    this.say('[A door slams]');
  }
  rattle(pos) {
    for (let i = 0; i < 5; i++) {
      this.noise({ filter: 'bandpass', f0: 900 + Math.random() * 500, q: 3, dur: 0.05, gain: 0.18, delay: i * 0.055, pos });
      this.tone({ type: 'square', f0: 220 + Math.random() * 60, dur: 0.03, gain: 0.05, delay: i * 0.055, pos });
    }
    this.say('[Handle rattles]');
  }
  unlock(pos) {
    this.tone({ type: 'square', f0: 1300, f1: 900, dur: 0.05, gain: 0.08, pos });
    this.tone({ type: 'square', f0: 700, f1: 500, dur: 0.06, gain: 0.1, delay: 0.1, pos });
    this.noise({ filter: 'highpass', f0: 3000, dur: 0.05, gain: 0.08, delay: 0.1, pos });
  }
  drawer(pos) { this.noise({ filter: 'bandpass', f0: 500, f1: 300, q: 1, dur: 0.4, gain: 0.2, atk: 0.1, pos }); this.tone({ type: 'sine', f0: 90, f1: 70, dur: 0.2, gain: 0.1, delay: 0.35, pos }); }
  lid(pos) { this.creak(pos, 0.25, 0.3); this.tone({ type: 'sine', f0: 100, f1: 60, dur: 0.25, gain: 0.15, delay: 0.6, pos }); }
  rustle(pos) { for (let i = 0; i < 4; i++) this.noise({ filter: 'bandpass', f0: 2500, q: 0.8, dur: 0.12, gain: 0.08, delay: i * 0.13, atk: 0.04, pos }); }
  click() { this.tone({ type: 'square', f0: 1400, dur: 0.04, gain: 0.08 }); this.noise({ filter: 'highpass', f0: 4000, dur: 0.02, gain: 0.05 }); }
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.35, gain: 0.1, delay: i * 0.07, atk: 0.01 })); }
  battery() { this.tone({ type: 'sawtooth', f0: 200, f1: 700, dur: 0.4, gain: 0.1, lp: 1500 }); this.click(); }
  toast() { this.tone({ type: 'sine', f0: 520, dur: 0.12, gain: 0.04 }); }
  pageTurn() { this.noise({ filter: 'highpass', f0: 3000, dur: 0.2, gain: 0.1, atk: 0.05 }); }
  thud(pos, vol) {
    this.tone({ type: 'sine', f0: 70, f1: 28, dur: 0.5, gain: 0.5 * (vol || 1), pos });
    this.noise({ filter: 'lowpass', f0: 300, dur: 0.3, gain: 0.3 * (vol || 1), pos });
    this.say('[A distant thud]');
  }
  land(vol, pos) { this.noise({ filter: 'bandpass', f0: 900, q: 1, dur: 0.12, gain: 0.3 * vol, pos }); this.tone({ type: 'triangle', f0: 200, f1: 80, dur: 0.1, gain: 0.2 * vol, pos }); }
  glass(pos) { for (let i = 0; i < 9; i++) this.tone({ type: 'sine', f0: 2200 + Math.random() * 3500, dur: 0.25, gain: 0.07, delay: Math.random() * 0.25, pos }); this.noise({ filter: 'highpass', f0: 4500, dur: 0.3, gain: 0.2, pos }); this.say('[Glass shatters]'); }
  paintingFall(pos) { this.tone({ type: 'sine', f0: 110, f1: 40, dur: 0.35, gain: 0.5, pos }); this.noise({ filter: 'bandpass', f0: 1400, q: 1.5, dur: 0.35, gain: 0.4, pos }); this.glass(pos); this.say('[A painting falls]'); }
  chairSlide(pos) { this.noise({ filter: 'bandpass', f0: 380, f1: 260, q: 2, dur: 0.9, gain: 0.3, atk: 0.2, pos }); this.say('[A chair scrapes]'); }
  bats(pos) { for (let i = 0; i < 14; i++) this.noise({ filter: 'bandpass', f0: 1800 + Math.random() * 900, q: 3, dur: 0.07, gain: 0.07, delay: Math.random() * 0.9, pos }); this.say('[Wings flutter]'); }
  thunder() {
    this.noise({ filter: 'lowpass', f0: 500, f1: 80, dur: 3.2, gain: 0.7, atk: 0.35, pink: true });
    this.tone({ type: 'sine', f0: 60, f1: 25, dur: 2.2, gain: 0.5, atk: 0.3 });
    this.say('[Thunder rolls]');
  }
  heartbeat(vol) {
    this.tone({ type: 'sine', f0: 62, f1: 38, dur: 0.16, gain: vol });
    this.tone({ type: 'sine', f0: 56, f1: 34, dur: 0.18, gain: vol * 0.75, delay: 0.19 });
  }
  gasp() { this.noise({ filter: 'bandpass', f0: 1400, f1: 700, q: 1.2, dur: 0.5, gain: 0.3, atk: 0.08, pink: true }); this.say('[A sharp breath]'); }
  breathe(vol, pos) { this.noise({ filter: 'bandpass', f0: 800, f1: 500, q: 1, dur: 0.9, gain: vol, atk: 0.35, pink: true, pos }); }
  static() { this.noise({ filter: 'highpass', f0: 2500, dur: 0.5, gain: 0.25, atk: 0.02 }); }

  // Whisper: noise through two formant filters with a syllable rhythm
  whisper(pos, vol) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, dur = 1.6 + Math.random() * 1.4;
    const src = c.createBufferSource(); src.buffer = this.pinkBuf; src.loop = true;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.3, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const syl = c.createOscillator(); syl.frequency.value = 4 + Math.random() * 3;
    const sg = c.createGain(); sg.gain.value = 0.6; const sb = c.createGain(); sb.gain.value = 0.5;
    syl.connect(sg); sg.connect(sb.gain);
    [[600 + Math.random() * 300, 8], [1700 + Math.random() * 500, 7]].forEach(fq => {
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq[0]; f.Q.value = fq[1];
      src.connect(f); f.connect(sb);
    });
    sb.connect(g); g.connect(this.out(pos, 1.6));
    src.start(t, Math.random()); src.stop(t + dur + 0.1); syl.start(t); syl.stop(t + dur + 0.1);
    this.say('[A whisper]');
  }

  // Minor-key music box phrase (A minor / E phrygian flavour)
  musicBox(pos, vol, loud) {
    if (!this.ready) return;
    const seqs = [[0, 3, 7, 12, 7, 3, 2, 5, 8, 12], [12, 10, 7, 3, 0, 3, 7, 8, 7, 3]];
    const seq = seqs[Math.floor(Math.random() * 2)], base = 440;
    seq.forEach((n, i) => {
      const f = base * Math.pow(2, n / 12), d = i * (loud ? 0.34 : 0.42);
      this.tone({ type: 'sine', f0: f, dur: 1.1, gain: vol, atk: 0.003, delay: d, pos });
      this.tone({ type: 'triangle', f0: f * 2, dur: 0.5, gain: vol * 0.3, atk: 0.003, delay: d, pos });
    });
    this.say('[A music box plays]');
  }

  // Enemy sounds -------------------------------------------------------------
  growl(pos) { this.tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 1.3, gain: 0.35, lp: 500, atk: 0.2, pos }); this.noise({ filter: 'lowpass', f0: 400, dur: 1.2, gain: 0.25, atk: 0.3, pos }); this.say('[A low growl]'); }
  roar() {
    this.tone({ type: 'sawtooth', f0: 220, f1: 60, dur: 1.4, gain: 0.5, lp: 1800 });
    this.tone({ type: 'square', f0: 262, f1: 70, dur: 1.4, gain: 0.25, lp: 1200 });
    this.noise({ filter: 'lowpass', f0: 1500, f1: 200, dur: 1.4, gain: 0.5 });
    this.say('[A terrible roar]');
  }
  // Lethal scare: harsh, high, dissonant
  shriek() {
    [900, 1337, 1810].forEach((f, i) => this.tone({ type: 'sawtooth', f0: f, f1: f * 0.45, dur: 1.1, gain: 0.3, lp: 4200, delay: i * 0.02 }));
    this.noise({ filter: 'highpass', f0: 1800, dur: 1.0, gain: 0.5 });
    this.tone({ type: 'sine', f0: 70, f1: 30, dur: 0.8, gain: 0.8 });
    this.say('[A piercing shriek]');
  }
  // Fake-out sting: dull and metallic so players learn it is not lethal
  stingSoft() {
    this.tone({ type: 'triangle', f0: 300, f1: 180, dur: 0.6, gain: 0.25, lp: 900 });
    this.tone({ type: 'sine', f0: 1244, dur: 0.9, gain: 0.05, delay: 0.05 });
    this.thud(null, 0.5);
  }
  stun() { this.tone({ type: 'sawtooth', f0: 600, f1: 90, dur: 0.7, gain: 0.35, lp: 2200 }); this.noise({ filter: 'highpass', f0: 2500, dur: 0.4, gain: 0.35 }); this.say('[The apparition recoils]'); }
}
