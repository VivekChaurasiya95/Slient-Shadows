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
    N13: [['NARRATOR', 'And then Rowan heard her breathing, right behind.']]
  }
};

// --------------------------------------------------------------------------
// Voice narration (browser speech synthesis). Deep narrator, calm radio fixer, shaky Rowan.
// --------------------------------------------------------------------------
const Narrator = {
  enabled: true,
  profiles: { NARRATOR: { rate: 0.8, pitch: 0.5, vol: 1 }, DACRE: { rate: 0.88, pitch: 0.75, vol: 0.9 }, ROWAN: { rate: 0.95, pitch: 1.0, vol: 0.85 } },
  ok() { return this.enabled && typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; },
  voice(who) {
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    if (!vs.length) return null;
    const male = vs.filter(v => /david|daniel|alex|james|george|mark|male|fred|ryan|guy|thomas/i.test(v.name));
    const female = vs.filter(v => /zira|samantha|susan|hazel|female|karen|moira|aria|jenny/i.test(v.name));
    const pool = who === 'ROWAN' ? (female.length ? female : vs) : (male.length ? male : vs);
    return pool[0];
  },
  speak(text, who, interrupt) {
    if (!this.ok()) return;
    const p = this.profiles[who] || this.profiles.NARRATOR;
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\u2026/g, '...'));
    u.rate = p.rate; u.pitch = p.pitch; u.volume = p.vol;
    const v = this.voice(who); if (v) u.voice = v;
    speechSynthesis.speak(u);
  },
  stop() { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); },
  // rough speaking time in ms for pacing
  ms(text) { return this.ok() ? text.length * 78 + 500 : 0; }
};
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) speechSynthesis.getVoices();

// --------------------------------------------------------------------------
// Has the player already watched the opening to the end? The first time it cannot be skipped.
// --------------------------------------------------------------------------
const StoryFlag = {
  seen() { try { return localStorage.getItem(STORY_SEEN_KEY) === '1'; } catch (e) { return false; } },
  markSeen() { try { localStorage.setItem(STORY_SEEN_KEY, '1'); } catch (e) { /* storage may be blocked */ } }
};
// --------------------------------------------------------------------------
// In-game story director: radio / thought lines fired by events
// --------------------------------------------------------------------------
class StoryDirector {
  constructor(game) { this.game = game; this.reset(); }
  reset() {
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
      g.atmosphere.spawnPhantom(); g.screenFX.glitch(0.4); g.tweens.after(1.0, () => g.hud.say(STORY.lines.S006));
    }
    if (this.t > 330) this.say('S009');     // 11:25 PM in-game
    // R-02 standing still in the corridor, R-26 idle for five minutes
    const p = g.camera.position, moved = this.lastPos ? Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) > 0.05 : true;
    this.lastPos = { x: p.x, z: p.z };
    this.idleT = moved ? 0 : this.idleT + dt;
    this.corridorStillT = (g.currentRoom === 'corridor' && !moved) ? this.corridorStillT + dt : 0;
    if (this.corridorStillT > 60 && this.once('R02')) this.forceSay('R02');
    if (this.idleT > 300) { this.idleT = 0; this.forceSay('R26'); }
  }

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
  }
  onGateLocked() { if (this.once('S004')) this.game.hud.say(STORY.lines.S004); }
  onGateUnlocked() { this.say('R14'); }
  onPickup(it) {
    const k = it.def.kind;
    if (k === 'key' && ++this.keyCount === 1) this.say('R05');
    else if (k === 'note') { this.noteCount++; if (this.noteCount === 1) this.say('R06'); else if (this.noteCount === 2) this.say('R07'); }
    else if (it.id === 'locket') this.say('R08'); else if (it.id === 'musicbox') this.say('R09');
    else if (it.id === 'relic') { this.game.tweens.after(1.6, () => { this.say('N08'); this.say('T08'); this.game.tweens.after(3.5, () => this.say('R16')); }); }
  }
  onHide() { this.say('T10'); }
  onHunt() { if (this.game.hasRelic) this.say('R17'); }
  onEscaped() { this.say('T11'); }
  onDeath() { this.game.hud.clearRadio(); this.game.audio.static(); }
}
