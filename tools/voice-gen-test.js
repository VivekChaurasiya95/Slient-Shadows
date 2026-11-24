// Tests the voice generator against a local fake ElevenLabs / Azure server. No key, no cost.
// Run: node tools/voice-gen-test.js
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const mock = require('./lib/mock-tts');
const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vgen-'));
let pass = 0, fail = 0;
const T = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(52) + (info === undefined ? '' : ' ' + JSON.stringify(info))); ok ? pass++ : fail++; };

(async () => {
  const srv = await mock.start({ key: 'test-key' });
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'voice', 'voice-config.json'), 'utf8'));
  const cfgOf = (patch) => { const c = JSON.parse(JSON.stringify(base)); Object.assign(c.voices, { NARRATOR: { en: 'narrator-en', hi: 'narrator-hi' }, DACRE: 'dacre-voice', ELSPETH: 'flaky' }, patch && patch.voices); if (patch && patch.styles) Object.assign(c.styles, patch.styles); if (patch && patch.elevenlabs) Object.assign(c.elevenlabs, patch.elevenlabs); if (patch && patch.provider) c.provider = patch.provider; const f = path.join(tmp, 'cfg-' + Math.random().toString(36).slice(2) + '.json'); fs.writeFileSync(f, JSON.stringify(c)); return f; };
  // async: the mock server lives in this process, so a blocking spawn would deadlock it
  const run = (args, env) => new Promise(res => { const c = cp.spawn(process.execPath, [path.join(__dirname, 'voice-gen.js')].concat(args), { cwd: ROOT, env: Object.assign({}, process.env, { ELEVENLABS_API_KEY: 'test-key', ELEVENLABS_BASE_URL: srv.url, VOICE_RETRY_BASE_MS: '5', AZURE_SPEECH_KEY: 'az-key', AZURE_BASE_URL: srv.url }, env || {}) }); let out = ''; c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { out += d; }); c.on('close', code => res({ code, out })); });
  const out1 = path.join(tmp, 'out1'), cfg1 = cfgOf(), base_cfg_path = path.join(ROOT, 'voice', 'voice-config.json');
  const reqs = () => srv.requests.filter(r => /text-to-speech|cognitiveservices/.test(r.path));

  // ---- planning and error paths ----
  let r = await run(['plan', '--config', base_cfg_path, '--out', out1]);
  T('plan lists lines, characters and to-generate counts', r.code === 0 && /to generate now: \d+ clips, \d+ characters/.test(r.out) && /voices not configured yet: .*NARRATOR/.test(r.out), r.out.split('\n').filter(l => /to generate now|not configured/.test(l)));
  const noVoice = cfgOf({ voices: { NARRATOR: '' } });
  r = await run(['build', '--lang', 'en', '--config', noVoice, '--out', out1]);
  T('build refuses without a narrator voice, with a fix hint', r.code === 1 && /No voice configured for: NARRATOR/.test(r.out) && /voices --gender female/.test(r.out));
  r = await run(['build', '--lang', 'en', '--config', cfg1, '--out', out1], { ELEVENLABS_API_KEY: '' });
  T('build refuses without a key, pointing at .env', r.code === 1 && /No ELEVENLABS_API_KEY set/.test(r.out) && /\.env/.test(r.out));
  const before = srv.requests.length;
  r = await run(['build', '--lang', 'en', '--config', cfg1, '--out', out1], { ELEVENLABS_API_KEY: 'wrong' });
  T('a rejected key stops cleanly (no retry storm)', r.code === 1 && /rejected the API key/.test(r.out) && srv.requests.length - before === 1, { calls: srv.requests.length - before });
  r = await run(['build', '--lang', 'hi', '--config', cfg1, '--out', out1, '--dry']);
  T('dry run makes no requests', r.code === 0 && /would generate/.test(r.out) && !fs.existsSync(path.join(out1, 'manifest.json')));

  // ---- request shape ----
  srv.requests.length = 0;
  r = await run(['build', '--lang', 'hi', '--only', 'NARRATOR', '--limit', '6', '--config', cfg1, '--out', out1]);
  const rq = reqs();
  T('hi build sends 6 requests to the narrator-hi voice', r.code === 0 && rq.length === 6 && rq.every(q => q.path === '/v1/text-to-speech/narrator-hi'), { n: rq.length });
  T('API key goes in the xi-api-key header only', rq.every(q => q.headers['xi-api-key'] === 'test-key' && q.body.indexOf('test-key') < 0));
  T('model, format and language are set from config', rq.every(q => q.json.model_id === 'eleven_v3' && q.query.output_format === 'mp3_44100_128' && q.json.language_code === 'hi'));
  T('Hindi is sent as Devanagari, not Roman letters', rq.every(q => /[\u0900-\u097F]/.test(q.json.text)), rq[0].json.text.slice(0, 40));
  T('voice settings follow the style (v3 stability 0 / 0.5 / 1)', rq.every(q => [0, 0.5, 1].includes(q.json.voice_settings.stability) && q.json.voice_settings.speed >= 0.7 && q.json.voice_settings.speed <= 1.2), rq.map(q => q.json.voice_settings.stability + '/' + q.json.voice_settings.speed).join(' '));
  T('every request carries a deterministic seed', rq.every(q => Number.isInteger(q.json.seed)));
  const man = JSON.parse(fs.readFileSync(path.join(out1, 'manifest.json'), 'utf8')), keys = Object.keys(man.clips);
  T('manifest has the 6 clips with file, duration, style, speaker', keys.length === 6 && keys.every(k => /^hi\/NARRATOR\/[0-9a-f]{8}$/.test(k) && man.clips[k].f && man.clips[k].d > 0 && man.clips[k].s && man.clips[k].w === 'NARRATOR' && fs.existsSync(path.join(out1, man.clips[k].f))), keys.length);

  // ---- English, tags, styles ----
  srv.requests.length = 0;
  r = await run(['build', '--lang', 'en', '--only', 'NARRATOR', '--config', cfg1, '--out', out1]);
  const en = reqs();
  const whisper = en.filter(q => /^\[whispers\]/.test(q.json.text)), warned = en.find(q => /not safe here/.test(q.json.text));
  T('English narrator lines generated with no Devanagari', r.code === 0 && en.length > 20 && en.every(q => !/[\u0900-\u097F]/.test(q.json.text) && q.json.language_code === 'en'), en.length);
  T('whisper-style lines get the [whispers] audio tag', whisper.length >= 3 && whisper.every(q => q.json.voice_settings.speed <= 0.95), whisper.length);
  T('warning line is robust and slow, untagged', warned && warned.json.voice_settings.stability === 1 && warned.json.voice_settings.speed === 0.9 && !/^\[/.test(warned.json.text), warned && warned.json.voice_settings);

  // ---- caching and selective regeneration ----
  srv.requests.length = 0;
  r = await run(['build', '--lang', 'en', '--only', 'NARRATOR', '--config', cfg1, '--out', out1]);
  T('second run is fully cached: 0 API calls', r.code === 0 && reqs().length === 0 && /0 generated/.test(r.out), r.out.split('\n').slice(-3, -1));
  srv.requests.length = 0;
  const cfg2 = cfgOf({ styles: { whisper: Object.assign({}, base.styles.whisper, { speed: 0.85 }) } });
  r = await run(['build', '--lang', 'en', '--only', 'NARRATOR', '--config', cfg2, '--out', out1]);
  T('changing the whisper style regenerates only whisper lines', reqs().length === whisper.length && reqs().every(q => q.json.voice_settings.speed === 0.85), { regenerated: reqs().length, whisperLines: whisper.length });

  // ---- model without audio tags ----
  srv.requests.length = 0;
  const cfgV2 = cfgOf({ elevenlabs: { model: 'eleven_multilingual_v2' } }), out2 = path.join(tmp, 'out2');
  await run(['build', '--lang', 'en', '--only', 'NARRATOR', '--limit', '8', '--config', cfgV2, '--out', out2]);
  const v2 = reqs();
  T('multilingual_v2: no tags, no language_code, finer stability', v2.length === 8 && v2.every(q => !/^\[/.test(q.json.text) && q.json.language_code === undefined && [0.3, 0.5, 0.75].includes(q.json.voice_settings.stability)));

  // ---- retries ----
  srv.requests.length = 0;
  r = await run(['build', '--lang', 'en', '--only', 'ELSPETH', '--config', cfg1, '--out', path.join(tmp, 'out3')]);
  const fl = reqs();
  T('429 is retried with backoff and then succeeds', r.code === 0 && fl.length >= 4 && /\d+ retries/.test(r.out) && /0 failed/.test(r.out), { calls: fl.length, tail: r.out.trim().split('\n').pop() });

  // ---- fallback chain: Rowan borrows Dacre's voice ----
  srv.requests.length = 0;
  await run(['build', '--lang', 'en', '--only', 'ROWAN', '--limit', '2', '--config', cfg1, '--out', path.join(tmp, 'out4')]);
  T('Rowan (no voice of his own) is spoken with Dacre\'s voice', reqs().length === 2 && reqs().every(q => q.path === '/v1/text-to-speech/dacre-voice'));

  // ---- Azure ----
  srv.requests.length = 0;
  const cfgAz = cfgOf({ provider: 'azure', voices: { NARRATOR: { en: 'en-IN-NeerjaNeural', hi: 'hi-IN-SwaraNeural' } } }), out5 = path.join(tmp, 'out5');
  r = await run(['build', '--lang', 'hi', '--only', 'NARRATOR', '--limit', '3', '--config', cfgAz, '--out', out5]);
  const az = reqs();
  T('azure: SSML with the right voice, locale, prosody and key header', r.code === 0 && az.length === 3 && az.every(q => q.path === '/cognitiveservices/v1' && q.headers['ocp-apim-subscription-key'] === 'az-key' && /<voice name="hi-IN-SwaraNeural">/.test(q.body) && /xml:lang="hi-IN"/.test(q.body) && /<prosody rate="[-+0-9]+%" pitch="[-+0-9]+%" volume="\w[\w-]*">/.test(q.body) && /[\u0900-\u097F]/.test(q.body)), az[0] && az[0].body.slice(0, 220));

  // ---- voices and audition ----
  r = await run(['voices', '--gender', 'female', '--accent', 'indian', '--lang', 'hi', '--config', cfg1]);
  T('voices lists candidates and reminds about licensing', r.code === 0 && /VOICEFEM1/.test(r.out) && /commercial use/.test(r.out));
  const aud = path.join(tmp, 'aud');
  r = await run(['audition', '--lang', 'all', '--config', cfg1, '--audition-dir', aud]);
  const files = fs.existsSync(aud) ? fs.readdirSync(aud) : [];
  T('audition makes one clip per style per language + a page to listen', r.code === 0 && files.filter(f => /\.(wav|mp3)$/.test(f)).length >= 14 && files.includes('index.html'), files.length);

  // ---- report ----
  r = await run(['report', '--lang', 'en', '--config', cfg1, '--out', out1]);
  T('report counts present / missing clips', r.code === 0 && /\d+\/\d+ clips present, \d+ missing/.test(r.out), r.out.trim().split('\n').pop());

  console.log(pass + ' passed, ' + fail + ' failed');
  await srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e); process.exit(1); });
