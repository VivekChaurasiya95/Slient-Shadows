'use strict';
// ==========================================================================
// STORY: opening story sequence (forced on the first play, skippable after),
// plus the in-game radio (Dacre) and thought (Rowan) lines fired by events.
// Line IDs (S-xxx, R-xxx, T-xxx) match the story bible.
// ==========================================================================
const STORY_SEEN_KEY = 'silentshadows.storySeen.v1';

const STORY = {
  // Opening cards. kind: text | cinematic | final
  cards: [
    { scene: 'manor', kicker: 'Hollow Manor', lines: ['Hollow Manor has been silent for forty-seven years.', 'Tonight, the door is thin.', 'Take what you came for, or learn why she is still here.'] },
    { scene: 'family', kicker: 'The Hollow family, 1897', lines: [
      'Josiah Hollow, landowner and amateur occultist, buried his wife Margaret in the autumn of 1897. Her lullaby was the last thing their daughter heard her sing.',
      'Elspeth was seventeen. She grieved. She walked in her sleep, and she spoke in her mother\u2019s voice.',
      'Her brother Thomas, twelve, loved her. The family physician, Doctor Venn, said the girl was ill, not possessed. Josiah dismissed him.'] },
    { scene: 'crypt', kicker: 'Samhain, 1898', lines: [
      'Josiah took the old horned skull from its case and performed the Rite of the Quiet Door.',
      'He locked his daughter in the crypt and sealed the gate. Thomas was shut in the nursery. Only the housekeeper, Mrs. Pell, tried to help.',
      'Elspeth did not come out. The binding Josiah carved held her to the skull and to the crypt. Josiah chained the front door, and died in his study five years later.',
      'Every Samhain since, the door has grown a little thinner.'] },
    { scene: 'job', kicker: 'The job, 1998', lines: [
      'Rowan Vale, thirty-one, freelance relic extractor. A failed expedition left Rowan in debt.',
      'Tonight\u2019s job pays in full. One object, one night. The horned skull, in the family crypt.',
      'The client\u2019s fixer will stay on the bodycam radio. His name is Mr. Dacre. He is very calm.'] },
    { scene: 'radio', kicker: 'October 31, 1998. Hollow Manor. 11:14 PM', cinematic: [
      ['DACRE', 'Signal\u2019s good. You\u2019re live, my friend. Remember what we agreed. In and out. One object. The horned skull in the family crypt. Nothing else is worth your time.'],
      ['ROWAN', 'Nothing else is worth my time. Right.'],
      ['DACRE', 'The owners are very particular about discretion. The house is empty. Quite\u2026 empty.']] },
    { scene: 'final', kicker: 'Be gone by dawn', lines: ['Take the skull.', 'Stay quiet.', 'Be gone by dawn.'], final: true }
  ],

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
    R26: [['DACRE', 'Hello? Is the feed live? \u2026Rowan?']]
  }
};

// --------------------------------------------------------------------------
// Opening sequence
// --------------------------------------------------------------------------
class StoryIntro {
  constructor(game) {
    this.game = game; this.idx = 0; this.active = false; this.canNext = false; this.timer = 0; this.done = null; this.first = true;
    const $ = id => document.getElementById(id);
    this.el = { modal: $('story-modal'), kicker: $('story-kicker'), body: $('story-body'), next: $('story-next'), skip: $('story-skip'), dots: $('story-dots'), hint: $('story-hint') };
    this.cine = new Cinematic(document.getElementById('story-canvas'));
    this.el.next.addEventListener('click', () => this.advance());
    this.el.skip.addEventListener('click', () => this.finish());
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); }
      else if (e.code === 'Escape' && !this.first) this.finish();
    });
  }
  static seen() { try { return localStorage.getItem(STORY_SEEN_KEY) === '1'; } catch (e) { return false; } }
  static markSeen() { try { localStorage.setItem(STORY_SEEN_KEY, '1'); } catch (e) { /* storage may be blocked */ } }

  // first time: no skip, every card must be read. Later: Skip button always shown.
  play(done) {
    const g = this.game;
    this.first = !StoryIntro.seen();
    this.done = done; this.idx = 0; this.active = true;
    this.el.skip.style.display = this.first ? 'none' : 'inline-flex';
    this.el.dots.innerHTML = STORY.cards.map(() => '<i></i>').join('');
    g.hud.showModal(this.el.modal);
    g.audio.ensure(); g.audio.startAmbience(); g.audio.tone({ type: 'sine', f0: 466, dur: 1.6, gain: 0.07 }); // one off-key music box note
    this.show(0);
  }

  show(i) {
    const c = STORY.cards[i], e = this.el, g = this.game;
    this.idx = i; this.canNext = false; e.next.disabled = true; e.next.classList.remove('ready');
    e.next.textContent = c.final ? 'Begin' : 'Continue';
    e.hint.textContent = this.first ? 'Read on. The story cannot be skipped the first time.' : '';
    Array.from(e.dots.children).forEach((d, k) => d.className = k < i ? 'done' : k === i ? 'on' : '');
    e.kicker.textContent = c.kicker;
    // animated shot for this card (characters move, walk, speak)
    this.cine.start(c.scene, { speakers: c.cinematic ? c.cinematic.map(l => l[0]) : [] });
    e.body.classList.remove('in'); e.body.innerHTML = '';
    let chars = 0;
    if (c.cinematic) {
      c.cinematic.forEach(([who, text]) => {
        const p = document.createElement('p'); p.className = 'radio ' + who.toLowerCase();
        p.innerHTML = '<b>' + who + '</b><span></span>'; p.querySelector('span').textContent = text; e.body.appendChild(p); chars += text.length;
      });
    } else {
      c.lines.forEach(t => { const p = document.createElement('p'); p.textContent = t; e.body.appendChild(p); chars += t.length; });
    }
    // paragraphs fade in one after another
    Array.from(e.body.children).forEach((p, k) => { p.style.transitionDelay = (0.5 + k * 1.1) + 's'; });
    requestAnimationFrame(() => requestAnimationFrame(() => e.body.classList.add('in')));
    if (c.cinematic) { g.audio.static(); c.cinematic.forEach((l, k) => { if (l[0] === 'DACRE') g.tweens.after(0.5 + k * 1.1, () => g.audio.static(), 'story-static' + k); }); }
    // minimum reading time so the first play cannot be clicked through
    const wait = Math.min(14, 2.5 + chars * 0.045) + (c.lines ? c.lines.length * 0.4 : 1.5);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.canNext = true; e.next.disabled = false; e.next.classList.add('ready'); }, wait * 1000);
  }

  advance() {
    if (!this.active || !this.canNext) return;
    if (this.idx >= STORY.cards.length - 1) { this.finish(true); return; }
    const e = this.el.body; e.classList.remove('in');
    setTimeout(() => this.show(this.idx + 1), 350);
  }

  finish(completed) {
    if (!this.active) return;
    this.active = false; clearTimeout(this.timer); this.cine.stop();
    // only mark as seen when it was played to the end (or skipped after already seen)
    if (completed || !this.first) StoryIntro.markSeen();
    this.game.hud.hideModal(this.el.modal);
    if (this.done) { const d = this.done; this.done = null; d(); }
  }
}

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
    else if (it.id === 'relic') { this.game.tweens.after(1.6, () => { this.say('T08'); this.game.audio.static(); this.game.tweens.after(3.5, () => this.say('R16')); }); }
  }
  onHide() { this.say('T10'); }
  onHunt() { if (this.game.hasRelic) this.say('R17'); }
  onEscaped() { this.say('T11'); }
  onDeath() { this.game.hud.clearRadio(); this.game.audio.static(); }
}
