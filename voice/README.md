# Voice acting pack

The game plays pre-generated studio clips from `assets/voice/`. Clips are generated offline on your
machine by `tools/voice-gen.js`. The API key is read from `.env` by that script only. It is never
shipped, and the game never calls a speech API.

If a clip is missing, the game falls back to either the browser voice or text only (Options →
"If the studio voice is missing"). The fallback is always visible: a `[voice]` console warning that
names the clip and the command to fix it, a one-time toast, and the status line in Options.

## 1. Setup

1. Copy `.env.example` to `.env` and fill in `ELEVENLABS_API_KEY`. `.env` is git-ignored.
2. Check your ElevenLabs plan allows commercial use. Also check the terms of each voice you pick:
   library voices made by other users have their own sharing and usage terms. Do not use a voice that
   imitates a real person.

## 2. Choose voices

```
node tools/voice-gen.js voices --gender female --accent indian --lang hi
node tools/voice-gen.js voices --gender female --search whisper
```

Put the voice ids in `voice/voice-config.json` → `voices`. A plain string uses the same voice for both
languages; `{ "en": "...", "hi": "..." }` uses a different voice per language. `NARRATOR` (female) and
`DACRE` are required. The other characters borrow a voice if they have none:
ELSPETH ← NARRATOR, THOMAS ← ELSPETH, MARGARET ← NARRATOR, ROWAN / JOSIAH / DR. VENN ← DACRE.
Rowan's Hindi lines use masculine grammar, so give him a male voice.

## 3. Audition before building

```
node tools/voice-gen.js audition --lang all
```

This writes one sample per style (narration, normal, whisper, fear, suspense, urgency, distress,
warning) for each language to `voice/audition/index.html` (git-ignored). Open it and listen.

## 4. Build

```
node tools/voice-gen.js plan  --lang all      # what will be generated, and character count
node tools/voice-gen.js build --lang all      # generate missing or changed clips
node tools/voice-gen.js report --lang all     # clip lengths vs cutscene caption windows, missing clips
```

About 90 lines per language (roughly 5,000 characters each). Clips are cached by a fingerprint of
provider, model, voice, settings and text. Re-running `build` only regenerates lines that changed.
Use `--only NARRATOR`, `--force`, `--limit N` or `--dry` as needed.

Hindi clips are synthesized from the Devanagari copy of each line, so the voice reads Hindi naturally.
The subtitles stay in Roman Hinglish.

## 5. Tune the styles

`voice/voice-config.json` → `styles` sets stability, style strength, speed and an optional audio tag
for each style. Eleven v3/v4 read tags such as `[whispers]` and `[worried]`. Only a few tags are
documented, so treat any other tag as an experiment and keep it only if it sounds right. Older models
ignore tags. After editing, run `build` again; only the affected lines are regenerated.

Azure AI Speech is supported (`"provider": "azure"`, `AZURE_SPEECH_KEY`, voices such as
`en-IN-NeerjaNeural` and `hi-IN-SwaraNeural`). It emulates the styles with rate, pitch and volume
only, and has not been tested against the live service.

## 6. Listening checklist

Do not ship a pack until someone has listened to it in both languages, in the game.

- [ ] Narration sounds like a person: warm, quiet, not an assistant voice.
- [ ] Whispers are breathy and close, not just quieter.
- [ ] Fear, distress and urgency are believable, not theatrical.
- [ ] Suspense and warning lines have weight; no line sounds sing-song.
- [ ] Long sentences keep a natural rhythm and do not rush at the end.
- [ ] Hinglish: Hindi words are pronounced as Hindi; English words inside them sound natural.
- [ ] No breaths, clicks or artefacts in odd places. Regenerate bad clips with `--force --only WHO`.
- [ ] In the game: radio lines, the ghost-near warning, the crypt and nursery whispers, the first hunt
      and the opening cinematic. Use the debug panel's "Voice" group to play one line per style.
- [ ] `report` shows no clips too long for their caption window.
- [ ] Narration, character and effects sliders in Options each work on their own.

## 7. Ship

Commit `assets/voice/` (the mp3 files and `manifest.json`). The shipped manifest is empty until you
build a pack, and the game reports "Studio voice not installed" in that state.
