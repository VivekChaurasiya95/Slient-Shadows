'use strict';
// ==========================================================================
// STORY: opening story sequence (forced on the first play, skippable after),
// plus the in-game radio (Dacre) and thought (Rowan) lines fired by events.
// Line IDs (S-xxx, R-xxx, T-xxx) match the story bible.
// ==========================================================================
const STORY_SEEN_KEY = 'silentshadows.storySeen.v1';

const STORY = {
  // Radio (DACRE) and thought (ROWAN) lines. Each entry is a list of [who, text].
  lines: {
    S002: [['DACRE', 'Ah. Old houses. Doors do that.'], ['ROWAN', 'That door was open a second ago.'], ['DACRE', 'Drafts, my friend. Find the crypt. It\u2019s through the stone gate at the north end of the hall.']],
    S003a: [['DACRE', 'Battery is limited. Use it wisely.']],
    S003b: [['DACRE', 'The house is\u2026 sensitive. Keep it quiet.']],
    S004: [['ROWAN', 'Silver keyhole. Crescent shaped. Of course.'], ['DACRE', 'The family kept the keys in the house. Somewhere. People do.']],
    S006: [['ROWAN', 'I\u2019m not alone.'], ['DACRE', 'You never are, in houses this old. Keep moving.']],
    S009: [['DACRE', 'The buyer is waiting. Don\u2019t dally.']],
    R02: [['DACRE', 'My friend, standing still pays nothing.']],
    R03: [['DACRE', 'Ah, the girl\u2019s room. Don\u2019t linger. Sentiment slows a man down.']],
    R04: [['DACRE', 'The fireplace is real. Cozy. Don\u2019t get comfortable.']],
    R05: [['DACRE', 'Splendid. Now find what it opens. Quickly.']],
    R06: [['DACRE', 'Reading? You\u2019re paid for a skull, not a novel.']],
    R07: [['DACRE', 'Old family gossip. Pay it no mind.']],
    R08: [['DACRE', 'A trinket. Leave it.'], ['ROWAN', 'E.H. Elspeth Hollow.']],
    R09: [['DACRE', 'Not on the list. Put it down.']],
    R10: [['DACRE', 'Ah. That would be the old man\u2019s books. Such a lot of paper.']],
    R12: [['DACRE', 'That\u2019s\u2026 not on the map.'], ['ROWAN', 'A kid lived here. He was scared too.']],
    R13: [['DACRE', 'I would avoid the cellar if I were you.']],
    R14: [['DACRE', 'Excellent work. The skull is in there somewhere. Don\u2019t touch anything else.']],
    R15: [['ROWAN', 'The air here feels\u2026 waiting.']],
    R16: [['DACRE', 'Run. The front door will open. I promise.']],
    R17: [['DACRE', 'Faster, my friend. She is faster than you think.']],
    T08: [['ROWAN', 'This isn\u2019t an artifact. It\u2019s a grave.']],
    T10: [['ROWAN', 'Don\u2019t breathe. Don\u2019t breathe.']],
    T11: [['ROWAN', 'Okay. Okay. Keep moving.']],
    R26: [['DACRE', 'Hello? Is the feed live? \u2026Rowan?']],
    // Narrator lines that are not covered by a room flashback (spoken aloud). The rooms' stories are cutscenes.
    N01: [['NARRATOR', 'Forty-seven years of dust lay in the hall. No one had walked it since. No one living.']],
    N08: [['NARRATOR', 'The skull was warm in Rowan\u2019s hands. It should not have been warm.']],
    N09: [['NARRATOR', 'Far off, deep in the house, something stirred. It knew the skull was gone.']],
    N10: [['NARRATOR', 'A step on the stairs. Then another. She did not hurry. She did not need to.']],
    N11: [['NARRATOR', 'The air turned colder. She was close now, and getting closer.']],
    N12: [['NARRATOR', 'One by one, the lights began to die.']],
    N13: [['NARRATOR', 'And then Rowan heard her breathing, right behind.']],
    // ---- electricity, weapons and the mission chain ----
    P01: [['DACRE', 'Lights. How wonderfully modern. Don\u2019t stand under them too long.'], ['ROWAN', 'Power\u2019s back. Some of it.']],
    P02: [['ROWAN', 'Dead. The whole house must run through one fuse box. The cellar.']],
    P03: [['ROWAN', 'Who turned that off? I didn\u2019t turn that off.']],
    W01: [['DACRE', 'Violence? How unlike you. It won\u2019t kill her, you know. Nothing does.']],
    W02: [['DACRE', 'A gun. Every shot is a dinner bell, my friend. Remember that.']],
    W03: [['ROWAN', 'It worked. It actually worked. Move. Move!']],
    M01: [['ROWAN', 'The bolt is electric. No power, no safe.']],
    M02: [['DACRE', 'There it is. The crypt key. Josiah locked his secrets away like a banker.']],
    M03: [['ROWAN', 'It won\u2019t come off the stone. Something is holding it down.'], ['DACRE', 'A seal. Old families and their theatre. Break it.']],
    M04: [['NARRATOR', 'The seal broke with a sound like a breath let go. And something in the dark breathed in.']],
    M05: [['ROWAN', 'She\u2019s gone. For now. The skull. Now.']],
    M06: [['ROWAN', 'Another mark above the door. Someone wanted this remembered.']],
    M07: [['ROWAN', 'A caretaker\u2019s card. A number. That\u2019s the third one.']],
    M08: [['ROWAN', 'Wrong order. She heard that.']],
    // ---- the woman's voice: quiet warnings, and Elspeth whispering from somewhere in the house ----
    A01: [['NARRATOR', 'How did you get in here? It is not safe here...']],
    A02: [['NARRATOR', 'Shh. She is close.']],
    A03: [['NARRATOR', 'Run. Now. Do not look back.']],
    E01: [['ELSPETH', 'Are you here to stay with me?', { pos: 'rand' }]],
    E02: [['ELSPETH', 'Papa, please. Do not leave me here.', { pos: 'rand' }]],
    E03: [['ELSPETH', 'It is so cold. It has always been so cold.', { pos: 'rand' }]],
    E04: [['ELSPETH', 'I can hear you breathing.', { pos: 'rand' }]]
  }
};

// --------------------------------------------------------------------------
// Voice narration (browser speech synthesis). Deep narrator, calm radio fixer, shaky Rowan.
// English uses an English voice. Hinglish prefers a hi-IN voice reading a Devanagari copy of
// the line; without one it falls back to an Indian English voice, then any English voice.
// Lines are queued (never spoken over each other) and report when they finish so the
// subtitles can wait for the voice.
// --------------------------------------------------------------------------
const Narrator = {
  enabled: true,
  volume: 1,
  profiles: {
    NARRATOR: { rate: 0.88, pitch: 1.0, vol: 1 }, DACRE: { rate: 0.92, pitch: 0.78, vol: 0.9, male: true },
    ROWAN: { rate: 0.98, pitch: 1.05, vol: 0.85 }, ELSPETH: { rate: 0.9, pitch: 1.3, vol: 0.8 },
    'DR. VENN': { rate: 0.9, pitch: 0.7, vol: 0.9, male: true }, JOSIAH: { rate: 0.85, pitch: 0.5, vol: 0.95, male: true },
    THOMAS: { rate: 0.95, pitch: 1.35, vol: 0.8 }, MARGARET: { rate: 0.86, pitch: 1.0, vol: 0.8 }
  },
  voices: [],
  live: [],                 // keep utterances referenced: Chrome drops onend for collected ones
  ok() { return this.enabled && typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; },
  refresh() { try { this.voices = speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; } },
  MALE: /david|daniel|alex|james|george|mark|male|fred|ryan|guy|thomas|ravi|hemant|madhur|prabhat|aarav|kunal/i,
  FEMALE: /zira|samantha|susan|hazel|female|karen|moira|aria|jenny|heera|kalpana|swara|lekha|neerja|veena|ananya|google/i,
  // { voice, tag, devanagari } for a speaker in the current language
  pick(who) {
    if (!this.voices.length) this.refresh();
    const vs = this.voices, prof = this.profiles[who] || this.profiles.NARRATOR;
    const byGender = list => { const m = list.filter(v => this.MALE.test(v.name)), f = list.filter(v => this.FEMALE.test(v.name) && !this.MALE.test(v.name)); return (prof.male ? (m.length ? m : list) : (f.length ? f : list))[0]; };
    if (I18N.lang === 'hi') {
      const hi = vs.filter(v => /^hi/i.test(v.lang));
      if (hi.length) return { voice: byGender(hi), tag: 'hi-IN', devanagari: true };
      const enIn = vs.filter(v => /^en[-_]IN/i.test(v.lang));
      if (enIn.length) return { voice: byGender(enIn), tag: 'en-IN', devanagari: false };
      const en = vs.filter(v => /^en/i.test(v.lang));
      return { voice: en.length ? byGender(en) : null, tag: 'en-IN', devanagari: false };
    }
    const en = vs.filter(v => /^en[-_](US|GB)/i.test(v.lang)), any = vs.filter(v => /^en/i.test(v.lang));
    const list = en.length ? en : any;
    const v = list.length ? byGender(list) : null;
    return { voice: v, tag: v ? v.lang : 'en-US', devanagari: false };
  },
  // text: what is on screen. src: the English source line (used to find the Devanagari copy).
  // opts: { interrupt, onend }. Returns true when the line was handed to the speech engine.
  speak(text, who, opts) {
    opts = typeof opts === 'boolean' ? { interrupt: opts } : (opts || {});
    if (!this.ok() || !text) { if (opts.onend) opts.onend(); return false; }
    const p = this.profiles[who] || this.profiles.NARRATOR, pk = this.pick(who);
    if (opts.interrupt) this.stop();
    const say = I18N.speechText(opts.src || text, text, pk.devanagari).replace(/\u2026/g, '...').replace(/\u2019/g, '\'');
    const u = new SpeechSynthesisUtterance(say);
    u.lang = pk.tag; if (pk.voice) u.voice = pk.voice;
    // Hindi voices read a touch slower so Hinglish never sounds rushed
    u.rate = p.rate * (pk.devanagari ? 0.95 : 1); u.pitch = p.pitch; u.volume = clamp(p.vol * this.volume, 0, 1);
    let done = false;
    const end = () => { if (done) return; done = true; this.live = this.live.filter(x => x !== u); if (opts.onend) opts.onend(); };
    u.onend = end; u.onerror = end;
    this.live.push(u);
    try { speechSynthesis.speak(u); } catch (e) { end(); return false; }
    return true;
  },
  stop() { if (typeof speechSynthesis !== 'undefined') { this.live = []; speechSynthesis.cancel(); } },
  pause() { if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) speechSynthesis.pause(); },
  resume() { if (typeof speechSynthesis !== 'undefined') speechSynthesis.resume(); },
  // rough speaking time in ms for pacing
  ms(text) { return this.ok() ? text.length * 78 + 500 : 0; }
};
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) {
  Narrator.refresh();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', () => Narrator.refresh());
}

// --------------------------------------------------------------------------
// Has the player already watched the opening to the end? The first time it cannot be skipped.
// --------------------------------------------------------------------------
const StoryFlag = {
  seen() { try { return localStorage.getItem(STORY_SEEN_KEY) === '1'; } catch (e) { return false; } },
  markSeen() { try { localStorage.setItem(STORY_SEEN_KEY, '1'); } catch (e) { /* storage may be blocked */ } }
};
// Each room's story (its flashback) is shown once, ever: not again on later runs or visits.
const ROOM_STORY_KEY = 'silentshadows.roomStory.v1';
const RoomStoryFlag = {
  all() { try { return JSON.parse(localStorage.getItem(ROOM_STORY_KEY) || '{}') || {}; } catch (e) { return {}; } },
  seen(id) { return !!this.all()[id]; },
  mark(id) { try { const a = this.all(); a[id] = 1; localStorage.setItem(ROOM_STORY_KEY, JSON.stringify(a)); } catch (e) { /* storage may be blocked */ } }
};
// --------------------------------------------------------------------------
// In-game story director: radio / thought lines fired by events
// --------------------------------------------------------------------------
class StoryDirector {
  constructor(game) { this.game = game; this.reset(); }
  reset() {
    this.nearCd = 0; this.whisperT = undefined;
    this.fired = {}; this.t = 0; this.idleT = 0; this.corridorStillT = 0; this.lastPos = null; this.midnight = false; this.keyCount = 0; this.noteCount = 0; this.started = false;
  }
  once(id) { if (this.fired[id]) return false; this.fired[id] = true; return true; }
  say(id) { if (STORY.lines[id] && this.once(id)) this.game.hud.say(STORY.lines[id]); }
  forceSay(id) { if (STORY.lines[id]) this.game.hud.say(STORY.lines[id]); }

  // The scripted opening: the door slams, a chain falls (S-002), then the tutorial lines
  start() {
    const g = this.game; this.reset(); this.started = true;
    g.tweens.after(1.2, () => {
      g.audio.doorSlam({ x: 0, y: 1.3, z: 12 }); g.audio.rattle({ x: 0, y: 1.0, z: 12 }); g.cameraShake(0.3); g.flickerLights(0.8); g.fear.add(6);
      g.tweens.after(0.9, () => this.forceSay('S002'));
    }, 'story-open');
    g.tweens.after(11, () => this.say('N01'), 'story-n1');
    g.tweens.after(22, () => this.say('S003a'), 'story-t1');
    g.tweens.after(40, () => this.say('S003b'), 'story-t2');
  }

  update(dt) {
    if (!this.started) return;
    const g = this.game; this.t += dt;
    // S-005: first ambient scare at 90 seconds. Three music box notes and a flicker.
    if (this.t > 90 && this.once('S005')) { [0, 0.45, 0.9].forEach((d, i) => g.tweens.after(d, () => g.audio.tone({ type: 'sine', f0: [440, 523, 659][i], dur: 1.0, gain: 0.12, pos: g.audio.randPos(6) }))); g.flickerLights(0.9); }
    // S-006: first sighting, under a second, at the far end of the corridor
    if (this.t > 140 && g.currentRoom === 'corridor' && !g.hiding.active && this.once('S006')) {
      g.audio.whisper(null, 0.4); g.screenFX.glitch(0.4); g.tweens.after(1.0, () => g.hud.say(STORY.lines.S006));
    }
    if (this.t > 330) this.say('S009');     // 11:25 PM in-game
    // R-02 standing still in the corridor, R-26 idle for five minutes
    const p = g.camera.position, moved = this.lastPos ? Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) > 0.05 : true;
    this.lastPos = { x: p.x, z: p.z };
    this.idleT = moved ? 0 : this.idleT + dt;
    this.corridorStillT = (g.currentRoom === 'corridor' && !moved) ? this.corridorStillT + dt : 0;
    if (this.corridorStillT > 60 && this.once('R02')) this.forceSay('R02');
    if (this.idleT > 300) { this.idleT = 0; this.forceSay('R26'); }
    this.updateVoices(dt);
  }

  // Situational voice. Never while another line is waiting, and always with a cool-down so the
  // woman's voice stays rare enough to mean something.
  updateVoices(dt) {
    const g = this.game, gh = g.ghost, quiet = !g.hud.radioBusy && !g.cinema.active && !g.inputLocked && !g.isDead;
    this.nearCd = Math.max(0, (this.nearCd || 0) - dt); this.whisperT = (this.whisperT === undefined ? 150 + g.rand() * 60 : this.whisperT) - dt;
    // she is close and has not seen you yet: a quiet warning
    if (quiet && this.nearCd <= 0 && gh.inPlayerRoom() && (gh.state === 'PATROL' || gh.state === 'SUSPICIOUS' || gh.state === 'SEARCH') && gh.presence() > 0.55) {
      this.nearCd = 85; this.forceSay('A02');
    }
    // far off, a girl whispers, sometimes. Only while nothing is chasing you.
    if (this.whisperT <= 0) {
      this.whisperT = 170 + g.rand() * 110;
      if (quiet && gh.state !== 'HUNT' && !g.hiding.active && g.fear.level < 0.8) this.forceSay(['E01', 'E02', 'E03', 'E04'][Math.floor(g.rand() * 4)]);
    }
  }

  // ---- electricity, weapons, missions ----
  onPower() { this.say('P01'); }
  onSwitchNoPower() { this.say('P02'); }
  onLightKilled() { this.say('P03'); }
  onWeapon(it) { if (it.id === 'pistol') this.say('W02'); else this.say('W01'); }
  onGhostHit() { this.say('W03'); }
  onSafeNoPower() { this.say('M01'); }
  onSafeOpen() { this.say('M02'); }
  onSealRefuse() { this.say('M03'); }
  onRitual() { this.say('M04'); }
  onSurvived() { this.say('M05'); }
  onSymbol(n) { if (n >= 2) this.say('M06'); }
  onLocker() { this.say('M07'); }
  onRitualFail() { this.say('M08'); }

  midnightToll() {
    const g = this.game; g.hud.toast('Midnight'); g.fear.add(10); g.flickerLights(1.5);
    for (let i = 0; i < 6; i++) g.tweens.after(i * 1.3, () => { g.audio.tone({ type: 'sine', f0: 196, dur: 3, gain: 0.22, atk: 0.01 }); g.audio.tone({ type: 'sine', f0: 392, dur: 2.2, gain: 0.08 }); g.audio.tone({ type: 'triangle', f0: 587, f1: 580, dur: 1.6, gain: 0.04 }); });
    g.audio.say('[A bell tolls midnight]');
  }

  onRoom(id) {
    const g = this.game; if (!this.started) return;
    if (id === 'bedroom') this.say('R03'); else if (id === 'parlor') this.say('R04'); else if (id === 'library') this.say('R10');
    else if (id === 'cellar') this.say('R13'); else if (id === 'crypt') this.say('R15');
    else if (id === 'nursery' && this.once('R12')) g.tweens.after(4, () => g.hud.say(STORY.lines.R12), 'story-r12');
    // the first time she walks into a dangerous room, the voice warns her in a whisper
    const room = g.world.rooms[id], risky = id === 'crypt' || id === 'cellar' || id === 'nursery' || (room && room.trap);
    if (risky && this.once('A01')) g.tweens.after(2.2, () => { if (g.currentRoom === id && !g.hiding.active) this.forceSay('A01'); }, 'story-a01');
    // and Elspeth, far off, answers rooms that belong to her
    const E = { nursery: 'E02', cellar: 'E03', crypt: 'E01' }[id];
    if (E && this.once(E)) g.tweens.after(7 + g.rand() * 4, () => { if (g.currentRoom === id && g.ghost.state !== 'HUNT' && !g.hiding.active) this.forceSay(E); }, 'story-' + E);
  }
  onGateLocked() { if (this.once('S004')) this.game.hud.say(STORY.lines.S004); }
  onGateUnlocked() { this.say('R14'); }
  onPickup(it) {
    const k = it.def.kind;
    if (k === 'key' && ++this.keyCount === 1) this.say('R05');
    else if (k === 'note') { this.noteCount++; if (this.noteCount === 1) this.say('R06'); else if (this.noteCount === 2) this.say('R07'); }
    else if (it.id === 'locket') this.say('R08'); else if (it.id === 'musicbox') this.say('R09');
    else if (k === 'weapon') this.onWeapon(it);
    else if (it.id === 'relic') { this.game.tweens.after(1.6, () => { this.say('N08'); this.say('T08'); this.game.tweens.after(3.5, () => this.say('R16')); }); }
  }
  onHide() {
    this.say('T10');
    const g = this.game; if (g.ghost.inPlayerRoom() && g.ghost.presence() > 0.3) g.tweens.after(3, () => { if (g.hiding.active) this.say('E04'); }, 'story-e04');
  }
  onHunt() {
    // the first time she sees you, the woman's voice drops its whisper
    if (this.once('A03')) this.game.tweens.after(0.4, () => this.forceSay('A03'), 'story-a03');
    if (this.game.hasRelic) this.say('R17');
  }
  onEscaped() { this.say('T11'); }
  onDeath() { this.game.hud.clearRadio(); this.game.audio.static(); }
}
