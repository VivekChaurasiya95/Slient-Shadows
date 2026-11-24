'use strict';
// A fake ElevenLabs + Azure server for testing the generator and the game's voice playback
// without a key or any spending. It answers with a WAV tone whose length follows the text,
// and records every request so tests can check exactly what would have been sent.
const http = require('http');

function wav(seconds, freq) {
  const sr = 22050, n = Math.round(sr * seconds), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const env = Math.min(1, i / 400, (n - i) / 400); buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 0.3 * env * 32767), 44 + i * 2); }
  return buf;
}

function start(opts) {
  opts = opts || {}; const requests = [], flaky = {};
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const u = new URL(req.url, 'http://x'), rec = { method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), headers: req.headers, body };
      requests.push(rec);
      const send = (code, type, data, extra) => { res.writeHead(code, Object.assign({ 'content-type': type }, extra || {})); res.end(data); };
      let m;
      if ((m = /^\/v1\/text-to-speech\/([^/]+)$/.exec(u.pathname)) && req.method === 'POST') {
        if (req.headers['xi-api-key'] !== (opts.key || 'test-key')) return send(401, 'application/json', '{"detail":"invalid key"}');
        const voice = decodeURIComponent(m[1]);
        if (voice === 'flaky' && !flaky[body]) { flaky[body] = 1; return send(429, 'application/json', '{"detail":"slow down"}', { 'retry-after': '0' }); }
        const j = JSON.parse(body), text = j.text.replace(/\[[^\]]+\]/g, '');
        rec.json = j; return send(200, 'audio/wav', wav(Math.min(12, Math.max(0.6, text.length * 0.05)), 140 + (voice.length * 37) % 200));
      }
      if (u.pathname === '/cognitiveservices/v1' && req.method === 'POST') {
        if (!req.headers['ocp-apim-subscription-key']) return send(401, 'text/plain', 'no key');
        const t = /<prosody[^>]*>([\s\S]*?)<\/prosody>/.exec(body); return send(200, 'audio/wav', wav(Math.min(12, Math.max(0.6, (t ? t[1].length : 20) * 0.05)), 220));
      }
      if (u.pathname === '/v2/voices') return send(200, 'application/json', JSON.stringify({ voices: [{ voice_id: 'VOICEFEM1', name: 'Test Voice', labels: { gender: 'female', accent: 'indian', age: 'young' }, description: 'mock', category: 'professional' }], has_more: false }));
      send(404, 'text/plain', 'not found');
    });
  });
  return new Promise(r => srv.listen(opts.port || 0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + srv.address().port, requests, close: () => new Promise(c => srv.close(c)) })));
}
module.exports = { start, wav };
