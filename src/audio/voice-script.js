'use strict';
// ==========================================================================
// VOICE SCRIPT: shared by the game (browser) and the clip generator (node).
// It decides, for every spoken line, WHO says it, in WHICH STYLE, and what the
// clip is called. Both sides compute the same key, so the game finds the file the
// generator wrote without a lookup table of line ids.
//   key = <lang>/<speaker>/<hash of the English source line>
// Style playback settings (gap before/after, reverb send, proximity EQ) live here.
// Style *synthesis* settings (stability, audio tags, speed) are in voice/voice-config.json.
// ==========================================================================
const VoiceScript = {
  // 32-bit FNV-1a: tiny, identical in browser and node
  fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); },
  norm(s) { return String(s).replace(/\s+/g, ' ').trim(); },
  key(lang, who, src) { return lang + '/' + who + '/' + this.fnv(this.norm(src)); },
  file(lang, who, src, ext) { return lang + '/' + who.replace(/[^A-Z]/g, '') + '-' + this.fnv(this.norm(src)) + '.' + ext; },

  // If a character has no voice of its own the generator uses the next one in the chain
  FALLBACK: { ELSPETH: 'NARRATOR', MARGARET: 'NARRATOR', THOMAS: 'ELSPETH', ROWAN: 'DACRE', JOSIAH: 'DACRE', 'DR. VENN': 'DACRE' },
  DEFAULT_STYLE: { NARRATOR: 'narration', DACRE: 'normal', ROWAN: 'fear', ELSPETH: 'whisper', JOSIAH: 'normal', THOMAS: 'distress', MARGARET: 'distress', 'DR. VENN': 'normal' },

  // Direction for individual lines. First matching prefix of the English source wins.
  OVERRIDE: [
    // opening and narrator
    ['Hollow Manor had been silent', 'narration'], ['Tonight, the door is thin', 'suspense'], ['Rowan Vale. Freelance', 'narration'], ['And the door opened by itself', 'suspense'],
    ['Forty-seven years of dust', 'narration'], ['The skull was warm', 'suspense'], ['Far off, deep in the house', 'suspense'], ['A step on the stairs', 'suspense'],
    ['The air turned colder', 'whisper'], ['One by one, the lights', 'suspense'], ['And then Rowan heard her breathing', 'whisper'], ['The seal broke with a sound', 'suspense'],
    // room memories
    ['In the autumn of 1897', 'narration'], ['Her lullaby was the last', 'distress'], ['Elspeth began to walk', 'suspense'], ['Josiah, don', 'distress'],
    ['There is nothing wrong with the girl', 'normal'], ['Josiah dismissed the doctor', 'narration'], ['Mrs. Pell cooked', 'narration'], ['Mrs. Pell left bread', 'suspense'],
    ['Josiah found the rite', 'suspense'], ['The horned skull had sat', 'suspense'], ['He took it down', 'suspense'], ['On the last night, Josiah', 'distress'],
    ['Papa, let me out', 'distress'], ['He never learned how to forgive', 'distress'], ['Below the house, Josiah', 'suspense'], ['Each cut asked', 'suspense'],
    ['The cellar has not been warm', 'whisper'], ['On Samhain night he led', 'suspense'], ['The skull would hold', 'suspense'], ['The gate closed behind him', 'distress'], ['She waited. And whatever', 'whisper'],
    // Rowan's thoughts
    ['Don\u2019t breathe', 'whisper'], ['Okay. Okay. Keep moving', 'urgency'], ['It worked. It actually worked', 'urgency'], ['She\u2019s gone. For now', 'urgency'],
    // Dacre pushing
    ['Run. The front door', 'urgency'], ['Faster, my friend', 'urgency'],
    // situational voice (warnings, urgency, distant whispers)
    ['How did you get in here', 'warning'], ['Shh. She is close', 'warning'], ['Run. Now. Do not look back', 'urgency'],
    ['Are you here to stay', 'whisper'], ['Papa, please. Do not leave', 'distress'], ['It is so cold', 'whisper'], ['I can hear you breathing', 'suspense']
  ],
  styleFor(src, who) {
    const s = this.norm(src);
    for (const o of this.OVERRIDE) if (s.indexOf(o[0]) === 0) return o[1];
    return this.DEFAULT_STYLE[who] || 'narration';
  },

  // Playback character. before/after are seconds of silence around a line (game time, so a pause
  // freezes them). send is how much of the voice goes to the room reverb, shelf is a close-mic
  // proximity boost in dB, lp is a low-pass in Hz (0 = off). Kept subtle on purpose.
  STYLES: {
    narration: { gain: 1.00, before: 0.35, after: 0.55, send: 0.10, shelf: 1.5, lp: 0 },
    normal:    { gain: 1.00, before: 0.25, after: 0.40, send: 0.08, shelf: 0.0, lp: 0 },
    whisper:   { gain: 0.88, before: 0.50, after: 0.85, send: 0.18, shelf: 3.0, lp: 0 },
    fear:      { gain: 0.95, before: 0.30, after: 0.55, send: 0.12, shelf: 1.5, lp: 0 },
    suspense:  { gain: 0.95, before: 0.75, after: 1.00, send: 0.18, shelf: 2.0, lp: 0 },
    urgency:   { gain: 1.05, before: 0.10, after: 0.25, send: 0.06, shelf: 0.0, lp: 0 },
    distress:  { gain: 0.95, before: 0.45, after: 0.75, send: 0.22, shelf: 1.5, lp: 0 },
    warning:   { gain: 0.92, before: 0.30, after: 0.60, send: 0.08, shelf: 2.5, lp: 0 }
  },

  // One audition line per style (used by the generator's audition command and the debug panel)
  SAMPLE: [
    { style: 'narration', who: 'NARRATOR', src: 'Forty-seven years of dust lay in the hall. No one had walked it since. No one living.' },
    { style: 'whisper', who: 'NARRATOR', src: 'The cellar has not been warm since.' },
    { style: 'fear', who: 'ROWAN', src: 'That door was open a second ago.' },
    { style: 'suspense', who: 'NARRATOR', src: 'A step on the stairs. Then another. She did not hurry. She did not need to.' },
    { style: 'urgency', who: 'NARRATOR', src: 'Run. Now. Do not look back.' },
    { style: 'distress', who: 'THOMAS', src: 'Papa, let me out!' },
    { style: 'warning', who: 'NARRATOR', src: 'How did you get in here? It is not safe here...' },
    { style: 'normal', who: 'DACRE', src: 'Battery is limited. Use it wisely.' }
  ]
};

if (typeof module !== 'undefined') module.exports = VoiceScript;
