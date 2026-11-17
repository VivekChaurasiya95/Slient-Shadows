'use strict';
// ==========================================================================
// CINEMATIC: animated 2D story scenes drawn with canvas (no image files).
// Characters are small rigs: they breathe, walk, bow their heads, talk and gesture.
// Each scene is a function (g, t, W, H, c) where t is seconds since the scene began.
// ==========================================================================
const CK = {
  limb(g, x1, y1, x2, y2, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); },
  // two segment arm from shoulder, angle 0 = hanging down, positive = swings forward
  arm(g, sx, sy, a, bend, col, skin, len) {
    const l1 = (len || 27), l2 = (len || 27) * 0.95, ex = sx + Math.sin(a) * l1, ey = sy + Math.cos(a) * l1, b = a + bend, hx = ex + Math.sin(b) * l2, hy = ey + Math.cos(b) * l2;
    CK.limb(g, sx, sy, ex, ey, 8, col); CK.limb(g, ex, ey, hx, hy, 7, col);
    g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 4, 0, 7); g.fill();
    return { x: hx, y: hy };
  },
  // o: x,y(feet) s face t walk(0..1) style(man|woman|girl|boy|doctor|rowan|dacre|josiah) tilt talk armL armR bendL bendR alpha back glow
  person(g, o) {
    const t = o.t || 0, walk = o.walk || 0, ph = t * (o.speed || 7), sw = Math.sin(ph) * walk, s = o.s || 1, st = o.style || 'man';
    const P = {
      man: { coat: '#2c2a33', pants: '#1c1b22', skin: '#d4b49a', hair: '#1a1410', long: false, dress: false },
      josiah: { coat: '#1d1c24', pants: '#141319', skin: '#cfae96', hair: '#2a2622', long: false, dress: false, coatLong: true },
      doctor: { coat: '#3a3326', pants: '#221f19', skin: '#d4b49a', hair: '#8a8478', long: false, dress: false, coatLong: true, hat: true },
      rowan: { coat: '#4a5a46', pants: '#26282c', skin: '#d6b8a0', hair: '#2b1c12', long: false, dress: false, pack: true },
      dacre: { coat: '#15151a', pants: '#101014', skin: '#c9ab94', hair: '#0c0c0e', long: false, dress: false, suit: true },
      woman: { coat: '#6a5470', pants: '#6a5470', skin: '#e0c4b0', hair: '#4a2a1a', long: true, dress: true },
      girl: { coat: '#e8e4dc', pants: '#e8e4dc', skin: '#e4c8b4', hair: '#3a2214', long: true, dress: true, gown: true },
      boy: { coat: '#4a5a7a', pants: '#2a2c36', skin: '#e0c4ae', hair: '#5a3a20', long: false, dress: false }
    }[st];
    const bob = Math.abs(Math.sin(ph)) * walk * 3 + Math.sin(t * 1.7 + (o.x || 0)) * 1.1;
    g.save(); g.translate(o.x, o.y); g.scale((o.face || 1) * s, s); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.glow) { const gr = g.createRadialGradient(0, -95, 10, 0, -95, 110); gr.addColorStop(0, o.glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-120, -210, 240, 230); }
    g.translate(0, -bob * 0.6);
    const shy = -148 + bob * 0.2, hipY = -88;
    // legs
    if (!P.dress) { CK.limb(g, -4, hipY, -9 + sw * 18, -3, 9, P.pants); CK.limb(g, 4, hipY, 9 - sw * 18, -3, 9, P.pants); g.fillStyle = '#0c0b0d'; g.fillRect(-14 + sw * 18, -5, 11, 5); g.fillRect(4 - sw * 18, -5, 11, 5); }
    else { CK.limb(g, -4, -30, -6 + sw * 10, -3, 6, P.skin); CK.limb(g, 4, -30, 6 - sw * 10, -3, 6, P.skin); }
    // torso and clothing
    g.fillStyle = P.coat; g.beginPath();
    if (P.dress) {
      const hem = (st === 'girl' ? -14 : -8), sway = Math.sin(t * 2 + ph) * 2 + sw * 3;
      g.moveTo(-13, shy); g.lineTo(13, shy); g.lineTo(9, -108); g.lineTo(30 + sway, hem); g.quadraticCurveTo(0, hem + 6, -30 + sway, hem); g.lineTo(-9, -108); g.closePath();
    } else if (P.coatLong) { g.moveTo(-17, shy); g.lineTo(17, shy); g.lineTo(22 + sw * 3, -42); g.lineTo(-22 + sw * 3, -42); g.closePath(); }
    else { g.moveTo(-16, shy); g.lineTo(16, shy); g.lineTo(14, -84); g.lineTo(-14, -84); g.closePath(); }
    g.fill();
    if (P.suit) { g.fillStyle = '#d8d8d8'; g.fillRect(-3, shy + 2, 6, 30); g.fillStyle = '#6a1010'; g.fillRect(-1.5, shy + 4, 3, 24); }
    if (P.pack) { g.fillStyle = '#2a2e2a'; g.fillRect(-26, shy + 4, 13, 44); }
    if (st === 'rowan' && !o.back) { g.fillStyle = '#111'; g.fillRect(2, shy + 8, 9, 6); const on = Math.sin(t * 5) > -0.2; g.fillStyle = on ? '#ff3030' : '#601010'; g.beginPath(); g.arc(8, shy + 11, 1.6, 0, 7); g.fill(); }
    // arms (swing opposite the legs unless told otherwise)
    const aL = o.armL !== undefined ? o.armL : -sw * 0.7, aR = o.armR !== undefined ? o.armR : sw * 0.7;
    const hl = CK.arm(g, -14, shy + 3, aL, o.bendL === undefined ? 0.15 : o.bendL, P.coat, P.skin);
    const hr = CK.arm(g, 14, shy + 3, aR, o.bendR === undefined ? 0.15 : o.bendR, P.coat, P.skin);
    g.restore(); g.save(); g.translate(o.x, o.y); g.scale((o.face || 1) * s, s); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha; g.translate(0, -bob * 0.6);
    // head
    const hy = shy - 20 + (o.dip || 0);
    g.save(); g.translate(0, hy + 14); g.rotate(o.tilt || 0); g.translate(0, -14);
    if (P.long) { g.fillStyle = P.hair; g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(-22, 34 + Math.sin(t * 1.5) * 2, -12, 60); g.lineTo(2, 60); g.lineTo(8, 4); g.closePath(); g.fill(); }
    g.fillStyle = o.back ? P.hair : P.skin; g.beginPath(); g.arc(0, 0, 13.5, 0, 7); g.fill();
    g.fillStyle = P.hair; g.beginPath(); g.arc(0, o.back ? 0 : -3, o.back ? 14 : 14, o.back ? 0 : Math.PI * 1.02, o.back ? 7 : Math.PI * 2.05); g.fill();
    if (P.hat) { g.fillStyle = '#17151a'; g.fillRect(-14, -17, 28, 4); g.fillRect(-9, -33, 18, 17); }
    if (!o.back) {
      g.fillStyle = '#16100e'; g.beginPath(); g.arc(4, -1, 1.5, 0, 7); g.arc(10, -1, 1.5, 0, 7); g.fill();
      g.strokeStyle = '#5a2a2a'; g.lineWidth = 1.4; g.beginPath(); const m = o.talk ? Math.abs(Math.sin(t * 13)) * 3 : 0; g.ellipse(7, 7, 2.4, 0.6 + m, 0, 0, 7); g.stroke();
    }
    g.restore();
    g.restore();
    return { head: { x: o.x, y: o.y - 170 * s }, handL: hl, handR: hr };
  },

  label(g, text, x, y, a) {
    if (a <= 0.01) return;
    g.save(); g.globalAlpha = Math.min(1, a); g.font = '500 11px "IBM Plex Mono", monospace'; g.textAlign = 'center';
    const w = g.measureText(text).width + 14; g.fillStyle = 'rgba(8,6,5,0.78)'; g.fillRect(x - w / 2, y - 12, w, 18); g.fillStyle = '#e8923a'; g.fillText(text, x, y + 1); g.restore();
  },
  // fade in after a delay
  show(t, at, dur) { return Math.max(0, Math.min(1, (t - at) / (dur || 0.8))); },
  ease(x) { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },

  rain(g, W, H, t, amt, wind) {
    g.strokeStyle = 'rgba(170,190,220,0.28)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < amt; i++) { const x = ((i * 97.3 + t * 160 * (wind || 0.3)) % (W + 40)) - 20, y = ((i * 53.7 + t * 520) % (H + 40)) - 20; g.moveTo(x, y); g.lineTo(x - 5 * (wind || 0.3), y + 12); }
    g.stroke();
  },
  fog(g, W, H, t, y, a) {
    for (let i = 0; i < 3; i++) {
      const x = ((t * (6 + i * 4) + i * 200) % (W * 1.6)) - W * 0.3, gr = g.createRadialGradient(x, y + i * 12, 4, x, y + i * 12, W * 0.42);
      gr.addColorStop(0, 'rgba(150,165,190,' + a + ')'); gr.addColorStop(1, 'rgba(150,165,190,0)'); g.fillStyle = gr; g.fillRect(0, y - H * 0.3, W, H * 0.6);
    }
  },
  candle(g, x, y, t, s) {
    s = s || 1; g.fillStyle = '#e8dfc8'; g.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
    const fl = 1 + Math.sin(t * 17 + x) * 0.15 + Math.sin(t * 7.3) * 0.1;
    const gr = g.createRadialGradient(x, y - 20 * s, 1, x, y - 20 * s, 60 * s * fl); gr.addColorStop(0, 'rgba(255,190,100,0.55)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = gr; g.fillRect(x - 70 * s, y - 90 * s, 140 * s, 140 * s);
    g.fillStyle = '#ffd890'; g.beginPath(); g.ellipse(x, y - 19 * s, 2.5 * s, 5.5 * s * fl, 0, 0, 7); g.fill();
  },
  lantern(g, x, y, t, s, col) {
    s = s || 1; const fl = 1 + Math.sin(t * 11 + x) * 0.1, gr = g.createRadialGradient(x, y, 2, x, y, 80 * s * fl);
    gr.addColorStop(0, col || 'rgba(255,190,100,0.6)'); gr.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = gr; g.fillRect(x - 90 * s, y - 90 * s, 180 * s, 180 * s);
    g.strokeStyle = '#2a2018'; g.lineWidth = 2 * s; g.strokeRect(x - 5 * s, y - 7 * s, 10 * s, 14 * s); g.fillStyle = '#ffd890'; g.fillRect(x - 3.5 * s, y - 5 * s, 7 * s, 10 * s);
  },
  note(g, x, y, t, a) {
    g.save(); g.globalAlpha = a; g.fillStyle = '#ffdca0'; g.font = '22px serif'; g.fillText('\u266A', x + Math.sin(t * 2) * 6, y); g.restore();
  },
  crow(g, x, y, t, s) {
    const f = Math.sin(t * 14) * 7 * s; g.strokeStyle = '#050507'; g.lineWidth = 2.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 10 * s, y + f * 0.4); g.quadraticCurveTo(x - 5 * s, y - 5 * s - f, x, y); g.quadraticCurveTo(x + 5 * s, y - 5 * s - f, x + 10 * s, y + f * 0.4); g.stroke();
  },
  vignette(g, W, H, a) {
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + a + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },
  stars(g, W, H, t) { for (let i = 0; i < 46; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.5 * Math.abs(Math.sin(t * 0.8 + i))) + ')'; g.fillRect((i * 83.3) % W, (i * 41.7) % (H * 0.55), 1.4, 1.4); } },
  moon(g, x, y, r) {
    const gr = g.createRadialGradient(x, y, r * 0.5, x, y, r * 4); gr.addColorStop(0, 'rgba(190,210,255,0.35)'); gr.addColorStop(1, 'rgba(190,210,255,0)'); g.fillStyle = gr; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    g.fillStyle = '#eef2ff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(150,160,190,0.35)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.1, r * 0.25, 0, 7); g.arc(x + r * 0.35, y + r * 0.3, r * 0.18, 0, 7); g.fill();
  },
  tree(g, x, y, len, a, d, t) {
    if (d > 5) return; const sway = Math.sin(t * 0.9 + x * 0.01 + d) * 0.03 * d, x2 = x + Math.cos(a + sway) * len, y2 = y + Math.sin(a + sway) * len;
    g.lineWidth = Math.max(0.8, 7 - d * 1.4); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    CK.tree(g, x2, y2, len * 0.72, a - 0.5, d + 1, t); CK.tree(g, x2, y2, len * 0.72, a + 0.45, d + 1, t);
  },
  // manor silhouette with flickering windows. (x,y) = bottom centre
  manor(g, x, y, w, h, t, lit) {
    g.fillStyle = '#07070b'; const L = x - w / 2;
    g.fillRect(L + w * 0.12, y - h * 0.62, w * 0.76, h * 0.62);
    g.fillRect(L, y - h * 0.5, w * 0.16, h * 0.5); g.fillRect(L + w * 0.84, y - h * 0.5, w * 0.16, h * 0.5);
    [[0.12, 0.88], [0, 0.16], [0.84, 1]].forEach((r, i) => { g.beginPath(); g.moveTo(L + w * r[0] - 4, y - h * (i ? 0.5 : 0.62)); g.lineTo(L + w * (r[0] + r[1]) / 2, y - h * (i ? 0.78 : 0.95)); g.lineTo(L + w * r[1] + 4, y - h * (i ? 0.5 : 0.62)); g.closePath(); g.fill(); });
    g.fillRect(L + w * 0.44, y - h * 1.12, w * 0.12, h * 0.4); g.beginPath(); g.moveTo(L + w * 0.43, y - h * 1.12); g.lineTo(L + w * 0.5, y - h * 1.32); g.lineTo(L + w * 0.57, y - h * 1.12); g.fill();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const wx = L + w * (0.17 + c * 0.113), wy = y - h * (0.56 - r * 0.17), on = lit && ((r * 7 + c * 3) % 5 === 0), fl = 0.75 + Math.sin(t * 9 + r * 3 + c) * 0.25;
      g.fillStyle = on ? 'rgba(255,170,70,' + (0.55 * fl) + ')' : 'rgba(40,50,80,0.25)'; g.fillRect(wx, wy, w * 0.045, h * 0.1);
    }
  },
  // The Lady: pale gown, long hair, long arms, glowing eyes
  lady(g, x, y, s, t, a, mouth) {
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
    const gl = g.createRadialGradient(0, -100, 8, 0, -100, 130); gl.addColorStop(0, 'rgba(160,210,255,0.35)'); gl.addColorStop(1, 'rgba(160,210,255,0)'); g.fillStyle = gl; g.fillRect(-140, -240, 280, 260);
    const gown = g.createLinearGradient(0, -170, 0, 0); gown.addColorStop(0, 'rgba(225,235,245,0.95)'); gown.addColorStop(1, 'rgba(180,200,225,0.2)');
    g.fillStyle = gown; g.beginPath(); g.moveTo(-12, -150); g.lineTo(12, -150); g.lineTo(34, -6);
    for (let i = 0; i < 7; i++) g.lineTo(34 - (i + 1) * 9.7, -6 + (i % 2 ? 0 : 10) + Math.sin(t * 3 + i) * 4);
    g.lineTo(-34, -6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(205,220,235,0.8)'; g.lineWidth = 3; g.lineCap = 'round';
    [-1, 1].forEach(sd => { const sw = Math.sin(t * 1.3 + sd) * 4; g.beginPath(); g.moveTo(sd * 12, -146); g.quadraticCurveTo(sd * 30 + sw, -90, sd * 26 + sw * 1.4, -30); g.stroke(); for (let f = 0; f < 4; f++) { g.beginPath(); g.moveTo(sd * 26 + sw * 1.4, -30); g.lineTo(sd * (26 + f * 2.5 - 4) + sw * 1.4, -12 + f); g.stroke(); } });
    g.strokeStyle = 'rgba(10,10,14,0.92)'; g.lineWidth = 2.4;
    for (let i = 0; i < 16; i++) { const o = (i - 7.5) * 1.8, sw = Math.sin(t * 1.5 + i) * 5; g.beginPath(); g.moveTo(o, -172); g.quadraticCurveTo(o * 3.2 + sw, -130, o * 2.6 + sw * 1.5, -66 - (i % 3) * 8); g.stroke(); }
    g.fillStyle = 'rgba(232,236,232,0.97)'; g.beginPath(); g.ellipse(0, -164, 11, 15, 0, 0, 7); g.fill();
    g.fillStyle = '#050505'; g.beginPath(); g.ellipse(-4.5, -167, 3, 4.6, 0.1, 0, 7); g.ellipse(4.5, -167, 3, 4.6, -0.1, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,230,255,' + (0.7 + Math.sin(t * 6) * 0.3) + ')'; g.fillRect(-5.2, -167.8, 1.8, 1.8); g.fillRect(3.4, -167.8, 1.8, 1.8);
    g.fillStyle = '#1a0808'; g.beginPath(); g.ellipse(0, -156, 3, 1.5 + (mouth || 0) * 6, 0, 0, 7); g.fill();
    g.restore();
  }
};
