'use strict';
// ==========================================================================
// TEXTURES: every texture is drawn on a canvas once and cached.
// ==========================================================================
class TextureLab {
  constructor(renderer) {
    // full anisotropic filtering: floors and walls stay sharp at grazing angles
    this.aniso = renderer.capabilities.getMaxAnisotropy();
    this.rep = {};
  }
  // Every texture is painted at twice its design size (max 1024 px) for sharper surfaces.
  // The draw code still works in design units: the canvas is scaled, so the look is the same, only crisper.
  make(key, size, draw, w, h) {
    return Cache.tex(key, () => {
      const hh = h || size, k = Math.max(size, hh) <= 512 ? 2 : 1;
      const c = document.createElement('canvas'); c.width = size * k; c.height = hh * k;
      const g = c.getContext('2d'); g.scale(k, k);
      draw(g, size, hh);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = this.aniso;
      return t;
    });
  }
  // Repeat variant: shares the canvas, own Texture object, cached by key
  repeat(base, name, rx, ry) {
    const key = name + ':' + rx.toFixed(2) + 'x' + ry.toFixed(2);
    return Cache.tex(key, () => { const t = base.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; });
  }
  speckle(g, s, n, a, light) {
    for (let i = 0; i < n; i++) { const v = light ? 255 : 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + Math.random() * a + ')'; const r = Math.random() * 2 + 0.5; g.fillRect(Math.random() * s, Math.random() * s, r, r); }
  }
  stains(g, s, n, k) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 30 + Math.random() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,' + k + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  wood() {
    return this.make('tex.wood', 512, (g, s) => {
      const n = 8, w = s / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = 'hsl(' + (24 + Math.random() * 6) + ',' + (30 + Math.random() * 10) + '%,' + (11 + Math.random() * 7) + '%)'; g.fillRect(i * w, 0, w, s);
        for (let k = 0; k < 24; k++) { g.strokeStyle = 'rgba(0,0,0,' + (0.05 + Math.random() * 0.12) + ')'; g.lineWidth = Math.random() * 1.6 + 0.4; const x = i * w + Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, s * 0.3, x - 4, s * 0.7, x + 2, s); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(i * w, 0, 2, s); g.fillRect(i * w, Math.random() * s, w, 2);
      }
      this.stains(g, s, 8, 0.28); this.speckle(g, s, 1400, 0.25);
      // a grey film of dust, scuffs and a few rotten, broken boards
      g.fillStyle = 'rgba(70,66,58,0.22)'; g.fillRect(0, 0, s, s);
      this.speckle(g, s, 3000, 0.18, true);
      for (let i = 0; i < 3; i++) { const bx = Math.floor(Math.random() * n) * w, by = Math.random() * s * 0.8, bl = 40 + Math.random() * 80; g.fillStyle = 'rgba(0,0,0,0.9)'; g.fillRect(bx + 3, by, w - 6, bl); g.fillStyle = 'rgba(40,28,18,0.8)'; for (let k = 0; k < 5; k++) g.fillRect(bx + 3 + Math.random() * (w - 10), by + Math.random() * bl, 4, 10); }
      this.stains(g, s, 6, 0.35);
    });
  }
  stone() {
    return this.make('tex.stone', 512, (g, s) => {
      g.fillStyle = '#15171a'; g.fillRect(0, 0, s, s);
      const rows = 8, bh = s / rows;
      for (let r = 0; r < rows; r++) {
        const cols = 3, bw = s / cols, off = (r % 2) * (bw / 2);
        for (let c = -1; c <= cols; c++) {
          const x = c * bw + off; g.fillStyle = 'hsl(' + (150 + Math.random() * 30) + ',' + (6 + Math.random() * 6) + '%,' + (20 + Math.random() * 14) + '%)'; g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
          for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(0,0,0,' + Math.random() * 0.3 + ')'; g.beginPath(); g.moveTo(x + Math.random() * bw, r * bh + 3); g.lineTo(x + Math.random() * bw, r * bh + bh - 3); g.stroke(); }
        }
      }
      const gm = g.createLinearGradient(0, s * 0.6, 0, s); gm.addColorStop(0, 'rgba(40,90,50,0)'); gm.addColorStop(1, 'rgba(40,90,50,0.35)'); g.fillStyle = gm; g.fillRect(0, s * 0.6, s, s * 0.4);
      this.stains(g, s, 10, 0.3); this.speckle(g, s, 2600, 0.3);
    });
  }
  brick() {
    return this.make('tex.brick', 256, (g, s) => {
      g.fillStyle = '#2a1a14'; g.fillRect(0, 0, s, s);
      for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) {
        g.fillStyle = 'hsl(' + (10 + Math.random() * 8) + ',' + (35 + Math.random() * 15) + '%,' + (16 + Math.random() * 10) + '%)';
        g.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28);
      }
      this.stains(g, s, 6, 0.4); this.speckle(g, s, 900, 0.3);
    });
  }
  plaster() {
    return this.make('tex.plaster', 256, (g, s) => {
      g.fillStyle = '#17140f'; g.fillRect(0, 0, s, s); this.stains(g, s, 10, 0.4); this.speckle(g, s, 1500, 0.25, true);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 4; i++) { g.beginPath(); let x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30; g.lineTo(x, y); } g.stroke(); }
      this.decay(g, s, s);
    });
  }
  door() {
    return this.make('tex.door', 256, (g, s) => {
      g.fillStyle = '#26170e'; g.fillRect(0, 0, s, s);
      for (let k = 0; k < 40; k++) { g.strokeStyle = 'rgba(0,0,0,' + Math.random() * 0.25 + ')'; const x = Math.random() * s; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, s); g.stroke(); }
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.08)'; g.strokeRect(36, 28, s - 72, s * 0.38); g.strokeRect(36, s * 0.5, s - 72, s * 0.42);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeRect(40, 32, s - 80, s * 0.38 - 8); g.strokeRect(40, s * 0.5 + 4, s - 80, s * 0.42 - 8);
      this.speckle(g, s, 700, 0.3);
    });
  }
  rug(name, base) {
    return this.make('tex.rug.' + name, 256, (g, s) => {
      g.fillStyle = base; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(200,170,110,0.45)'; g.lineWidth = 6; g.strokeRect(14, 14, s - 28, s - 28); g.lineWidth = 2; g.strokeRect(30, 30, s - 60, s - 60);
      g.fillStyle = 'rgba(200,170,110,0.28)';
      for (let y = 56; y < s - 40; y += 36) { g.beginPath(); g.moveTo(s / 2, y - 12); g.lineTo(s / 2 + 12, y); g.lineTo(s / 2, y + 12); g.lineTo(s / 2 - 12, y); g.fill(); }
      this.stains(g, s, 6, 0.3); this.speckle(g, s, 2400, 0.3);
    });
  }
  // Wallpaper above a wooden wainscot. o = {base:[h,s,l], panel:[h,s,l], peel}
  wall(name, o) {
    return this.make('tex.wall.' + name, 512, (g, s) => {
      const b = o.base, ph = Math.round(s * 0.32), top = s - ph;
      g.fillStyle = 'hsl(' + b[0] + ',' + b[1] + '%,' + b[2] + '%)'; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 32) { g.fillStyle = 'hsla(' + b[0] + ',' + b[1] + '%,' + (b[2] + 5) + '%,0.55)'; g.fillRect(x, 0, 14, top); }
      if (o.peel) for (let i = 0; i < 9; i++) {
        const x = Math.random() * s, y = Math.random() * top, r = 24 + Math.random() * 60; g.fillStyle = 'hsla(' + (b[0] + 10) + ',12%,' + (b[2] + 14) + '%,0.55)'; g.beginPath();
        for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rr = r * (0.55 + Math.random() * 0.6); g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.7); } g.fill();
      }
      const gt = g.createLinearGradient(0, 0, 0, top); gt.addColorStop(0, 'rgba(0,0,0,0.55)'); gt.addColorStop(0.25, 'rgba(0,0,0,0)'); g.fillStyle = gt; g.fillRect(0, 0, s, top);
      this.stains(g, s, 12, 0.3);
      const p = o.panel; g.fillStyle = 'hsl(' + p[0] + ',' + p[1] + '%,' + p[2] + '%)'; g.fillRect(0, top, s, ph);
      for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * 256 + 28, top + 26, 200, ph - 46); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 2; g.strokeRect(i * 256 + 29, top + 27, 198, ph - 48); }
      g.fillStyle = 'hsl(' + p[0] + ',' + p[1] + '%,' + (p[2] + 5) + '%)'; g.fillRect(0, top - 4, s, 8);
      const gb = g.createLinearGradient(0, s - 70, 0, s); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = gb; g.fillRect(0, s - 70, s, 70);
      this.speckle(g, s, 2200, 0.22);
      this.decay(g, s, top);
    });
  }
  // Decades of neglect: water running down from the ceiling, black mould, holes in the plaster
  decay(g, s, top) {
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * s, w = 6 + Math.random() * 26, len = top * (0.3 + Math.random() * 0.7);
      const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(20,16,8,0.6)'); gr.addColorStop(1, 'rgba(20,16,8,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 0.6, len); g.lineTo(x + w * 0.3, len * 0.9); g.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * s, y = Math.random() < 0.5 ? Math.random() * 60 : top - Math.random() * 80;
      for (let k = 0; k < 40; k++) { const r = 2 + Math.random() * 9; g.fillStyle = 'rgba(' + (8 + Math.random() * 14) + ',' + (14 + Math.random() * 14) + ',8,' + (0.25 + Math.random() * 0.4) + ')'; g.beginPath(); g.arc(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 40, r, 0, 7); g.fill(); }
    }
    for (let i = 0; i < 3; i++) {
      const x = 40 + Math.random() * (s - 80), y = 40 + Math.random() * (top - 120), r = 16 + Math.random() * 26;
      g.fillStyle = 'rgba(50,44,36,0.9)'; g.beginPath(); for (let a = 0; a < 9; a++) { const an = a / 9 * 6.283, rr = r * (0.6 + Math.random() * 0.5); g.lineTo(x + Math.cos(an) * rr * 1.2, y + Math.sin(an) * rr); } g.fill();
      g.fillStyle = 'rgba(0,0,0,0.85)'; for (let k = 0; k < 4; k++) g.fillRect(x - r * 0.9, y - r * 0.6 + k * r * 0.35, r * 1.8, r * 0.16);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, s, s);
  }
  // Scrawled writing for walls
  scrawl(text) {
    return this.make('tex.scrawl.' + text, 256, (g, s) => {
      g.clearRect(0, 0, s, s); g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const words = text.split('|');
      words.forEach((w, i) => {
        const y = s / 2 + (i - (words.length - 1) / 2) * 56;
        g.save(); g.translate(s / 2, y); g.rotate((Math.random() - 0.5) * 0.12);
        g.fillStyle = 'rgba(90,6,6,0.9)'; g.fillText(w, 0, 0);
        g.restore();
        for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(80,5,5,0.8)'; g.fillRect(s * 0.15 + Math.random() * s * 0.7, y + 14, 2 + Math.random() * 2, 10 + Math.random() * 40); }
      });
    });
  }
  // Soft dark blot for dirt on floors and damp on walls
  blot() {
    return this.make('tex.blot', 128, (g, s) => {
      g.clearRect(0, 0, s, s);
      for (let i = 0; i < 9; i++) { const x = s / 2 + (Math.random() - 0.5) * s * 0.4, y = s / 2 + (Math.random() - 0.5) * s * 0.4, r = s * (0.18 + Math.random() * 0.25), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(12,10,6,0.55)'); gr.addColorStop(1, 'rgba(12,10,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
    });
  }
  // Torn paper / old letters on the floor
  scrap() {
    return this.make('tex.scrap', 64, (g, s) => {
      g.clearRect(0, 0, s, s); g.fillStyle = '#8a8066'; g.beginPath(); g.moveTo(6, 8); g.lineTo(58, 4); g.lineTo(52, 30); g.lineTo(60, 58); g.lineTo(10, 54); g.lineTo(4, 30); g.fill();
      g.strokeStyle = 'rgba(30,25,15,0.6)'; for (let y = 14; y < 50; y += 6) { g.beginPath(); g.moveTo(12, y); g.lineTo(48, y + 1); g.stroke(); }
      this.stains(g, s, 2, 0.5);
    });
  }
  // --- decals and small art (alpha) ---
  cobweb() {
    return this.make('tex.web', 128, (g, s) => {
      g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(210,210,210,0.55)'; g.lineWidth = 1;
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05); g.stroke(); }
      for (let r = 14; r < s; r += 14) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2, rr = r * (0.88 + Math.random() * 0.12); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) g.moveTo(x, y); else g.quadraticCurveTo(x * 0.92, y * 0.92, x, y); } g.stroke(); }
    });
  }
  blood(kind) {
    return this.make('tex.blood.' + kind, 128, (g, s) => {
      g.clearRect(0, 0, s, s); g.fillStyle = 'rgba(95,8,8,0.82)';
      if (kind === 'hand') {
        g.beginPath(); g.ellipse(64, 78, 24, 28, 0, 0, 7); g.fill();
        [[-26, 40, -0.35], [-12, 22, -0.12], [4, 18, 0.05], [20, 26, 0.2], [-38, 64, -0.9]].forEach(f => { g.save(); g.translate(64 + f[0], f[1] + 20); g.rotate(f[2]); g.fillRect(-5, -2, 10, 30); g.restore(); });
        for (let i = 0; i < 5; i++) g.fillRect(40 + i * 11, 100, 4, 20 + Math.random() * 8);
      } else {
        for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(30 + Math.random() * 70, 30 + Math.random() * 60, 6 + Math.random() * 18, 4 + Math.random() * 10, Math.random() * 3, 0, 7); g.fill(); g.fillRect(30 + Math.random() * 70, 40, 3, 20 + Math.random() * 60); }
      }
    });
  }
  crack() {
    return this.make('tex.crack', 256, (g, s) => {
      g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(230,240,255,0.75)'; g.lineWidth = 1.5;
      const cx = s * 0.58, cy = s * 0.4;
      for (let i = 0; i < 9; i++) { let x = cx, y = cy, a = (i / 9) * Math.PI * 2 + Math.random() * 0.4; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (Math.random() - 0.5) * 0.7; const l = 14 + Math.random() * 30; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); } g.stroke(); }
    });
  }
  // Night view for windows: sky, moon, bare trees. Bats and crows are meshes.
  night() {
    return this.make('tex.night', 256, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#0a1020'); gr.addColorStop(0.7, '#1a2540'); gr.addColorStop(1, '#0c1018'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.7 + ')'; g.fillRect(Math.random() * s, Math.random() * s * 0.6, 1.5, 1.5); }
      g.fillStyle = '#e8eefc'; g.beginPath(); g.arc(s * 0.72, s * 0.28, 22, 0, 7); g.fill();
      g.fillStyle = 'rgba(180,200,240,0.18)'; g.beginPath(); g.arc(s * 0.72, s * 0.28, 50, 0, 7); g.fill();
      g.strokeStyle = '#05070c'; g.lineWidth = 7;
      const tree = (x, y, len, a, d) => { if (d > 5) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = Math.max(1, 8 - d * 1.6); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); tree(x2, y2, len * 0.74, a - 0.45 + Math.random() * 0.2, d + 1); tree(x2, y2, len * 0.74, a + 0.45 - Math.random() * 0.2, d + 1); };
      tree(s * 0.2, s, 56, -Math.PI / 2 - 0.1, 0); tree(s * 0.92, s, 40, -Math.PI / 2 + 0.15, 1);
      g.fillStyle = '#05070c'; g.fillRect(0, s * 0.9, s, s * 0.1);
    });
  }
  // Painted face with eyes cut out (eyes are separate meshes that follow you)
  portrait(i) {
    return this.make('tex.portrait' + i, 128, (g, s) => {
      const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#2a2218'); gr.addColorStop(1, '#0a0806'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(70,52,40,0.95)'; g.fillRect(s * 0.24, s * 0.62, s * 0.52, s * 0.4);
      g.fillStyle = 'rgba(176,160,134,0.92)'; g.beginPath(); g.ellipse(s / 2, s * 0.36, s * 0.17, s * 0.22, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(30,20,16,0.8)'; g.fillRect(s * 0.42, s * 0.5, s * 0.16, 2); g.fillRect(s * 0.47, s * 0.4, 2, s * 0.08);
      // someone scratched the face out
      g.strokeStyle = 'rgba(8,4,4,0.85)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { g.beginPath(); g.moveTo(s * (0.34 + Math.random() * 0.32), s * (0.16 + Math.random() * 0.4)); g.lineTo(s * (0.34 + Math.random() * 0.32), s * (0.16 + Math.random() * 0.4)); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, s, s);
      this.stains(g, s, 3, 0.5); this.speckle(g, s, 300, 0.4);
    });
  }
  faces(variant) {
    return this.make('tex.face' + variant, 128, (g, s) => {
      g.clearRect(0, 0, s, s); g.fillStyle = '#ffc24a';
      const tri = (x1, y1, x2, y2, x3, y3) => { g.beginPath(); g.moveTo(s * x1, s * y1); g.lineTo(s * x2, s * y2); g.lineTo(s * x3, s * y3); g.fill(); };
      if (variant === 0) { tri(0.2, 0.42, 0.42, 0.42, 0.31, 0.25); tri(0.58, 0.42, 0.8, 0.42, 0.69, 0.25); g.beginPath(); g.moveTo(s * 0.2, s * 0.6); g.quadraticCurveTo(s * 0.5, s * 0.92, s * 0.8, s * 0.6); g.lineTo(s * 0.7, s * 0.58); g.quadraticCurveTo(s * 0.5, s * 0.78, s * 0.3, s * 0.58); g.fill(); }
      else if (variant === 1) { g.beginPath(); g.ellipse(s * 0.32, s * 0.38, 10, 16, 0, 0, 7); g.ellipse(s * 0.68, s * 0.38, 10, 16, 0, 0, 7); g.fill(); g.fillRect(s * 0.3, s * 0.64, s * 0.4, 8); g.fillStyle = '#000'; for (let i = 0; i < 4; i++) g.fillRect(s * 0.32 + i * 12, s * 0.62, 3, 12); }
      else if (variant === 2) { tri(0.2, 0.36, 0.44, 0.44, 0.22, 0.5); tri(0.8, 0.36, 0.56, 0.44, 0.78, 0.5); g.beginPath(); g.ellipse(s * 0.5, s * 0.7, 22, 14, 0, 0, 7); g.fill(); }
      else { g.beginPath(); g.arc(s * 0.32, s * 0.38, 11, 0, 7); g.arc(s * 0.68, s * 0.38, 11, 0, 7); g.fill(); tri(0.46, 0.52, 0.54, 0.52, 0.5, 0.6); g.beginPath(); g.moveTo(s * 0.18, s * 0.62); for (let i = 0; i <= 8; i++) g.lineTo(s * (0.18 + i * 0.08), s * (i % 2 ? 0.72 : 0.62)); g.lineTo(s * 0.82, s * 0.76); for (let i = 8; i >= 0; i--) g.lineTo(s * (0.18 + i * 0.08), s * 0.78); g.fill(); }
    });
  }
  ouija() {
    return this.make('tex.ouija', 256, (g, s) => {
      g.fillStyle = '#4a3320'; g.fillRect(0, 0, s, s); g.strokeStyle = '#1a0f08'; g.fillStyle = '#1a0f08'; g.lineWidth = 3; g.strokeRect(6, 6, s - 12, s - 12);
      g.font = '22px serif'; g.textAlign = 'center';
      'ABCDEFGHIJKLM'.split('').forEach((c, i) => g.fillText(c, 28 + i * 16.5, 90));
      'NOPQRSTUVWXYZ'.split('').forEach((c, i) => g.fillText(c, 28 + i * 16.5, 130));
      g.font = '26px serif'; g.fillText('YES', 50, 50); g.fillText('NO', s - 50, 50); g.fillText('GOODBYE', s / 2, s - 30);
      g.beginPath(); g.arc(s / 2, 40, 14, 0, 7); g.stroke();
    });
  }
}
