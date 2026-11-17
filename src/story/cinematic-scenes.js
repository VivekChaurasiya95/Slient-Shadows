'use strict';
// ==========================================================================
// Story scenes. Each draws one animated shot. t = seconds since the shot began.
// ==========================================================================
const SCENES = {
  // 1. Hollow Manor on its hill, crows, fog, a pale shape in a window
  manor(g, t, W, H) {
    const z = 1 + Math.min(t, 14) * 0.012; g.translate(W / 2, H * 0.6); g.scale(z, z); g.translate(-W / 2, -H * 0.6);
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#05070f'); sky.addColorStop(0.65, '#16203a'); sky.addColorStop(1, '#0a0d16'); g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
    CK.stars(g, W, H, t); CK.moon(g, W * 0.76, H * 0.24, 22);
    g.fillStyle = 'rgba(60,70,100,0.35)'; for (let i = 0; i < 3; i++) { const cx = ((t * 8 + i * 220) % (W + 300)) - 150; g.beginPath(); g.ellipse(cx, H * (0.2 + i * 0.07), 110, 14, 0, 0, 7); g.fill(); }
    g.fillStyle = '#05060a'; g.beginPath(); g.moveTo(-20, H); g.lineTo(-20, H * 0.78); g.quadraticCurveTo(W * 0.35, H * 0.52, W * 0.55, H * 0.66); g.quadraticCurveTo(W * 0.8, H * 0.78, W + 20, H * 0.7); g.lineTo(W + 20, H); g.closePath(); g.fill();
    CK.manor(g, W * 0.45, H * 0.72, W * 0.52, H * 0.34, t, true);
    g.strokeStyle = '#030305'; CK.tree(g, W * 0.1, H * 0.84, 38, -Math.PI / 2 - 0.1, 0, t); CK.tree(g, W * 0.92, H * 0.88, 30, -Math.PI / 2 + 0.2, 1, t);
    // the pale shape appears in the upper window
    const gh = CK.show(t, 6, 1.4) * (0.55 + Math.sin(t * 2.1) * 0.25); if (gh > 0.02) { CK.lady(g, W * 0.395, H * 0.495, 0.13, t, gh * 0.9, 0); }
    for (let i = 0; i < 4; i++) CK.crow(g, ((t * (38 + i * 7) + i * 140) % (W + 100)) - 50, H * (0.14 + 0.05 * i) + Math.sin(t * 1.8 + i) * 8, t + i, 1 - i * 0.12);
    CK.fog(g, W, H, t, H * 0.86, 0.22);
    g.fillStyle = '#020204'; for (let x = 0; x < W + 10; x += 14) { g.fillRect(x, H * 0.9, 3, H * 0.1); if (x % 28 === 0) { g.beginPath(); g.moveTo(x - 2, H * 0.9); g.lineTo(x + 1.5, H * 0.87); g.lineTo(x + 5, H * 0.9); g.fill(); } }
    g.fillRect(0, H * 0.93, W, 3);
    CK.label(g, 'Hollow Manor, 1998', W * 0.5, H * 0.1, CK.show(t, 1.5, 1) * (1 - CK.show(t, 7, 1)));
  },

  // 2. 1897: Margaret hums the lullaby, Elspeth holds her hand, Thomas, Josiah, Doctor Venn
  family(g, t, W, H) {
    const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#2a1810'); wall.addColorStop(1, '#150c08'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 0; x < W; x += 26) g.fillRect(x, 0, 12, H);
    g.fillStyle = '#0a0705'; g.fillRect(0, H * 0.82, W, H * 0.18);
    // rainy window
    g.fillStyle = '#0d1424'; g.fillRect(W * 0.08, H * 0.12, W * 0.16, H * 0.4); g.strokeStyle = '#1a0f08'; g.lineWidth = 4; g.strokeRect(W * 0.08, H * 0.12, W * 0.16, H * 0.4); g.beginPath(); g.moveTo(W * 0.16, H * 0.12); g.lineTo(W * 0.16, H * 0.52); g.moveTo(W * 0.08, H * 0.32); g.lineTo(W * 0.24, H * 0.32); g.stroke();
    g.save(); g.beginPath(); g.rect(W * 0.08, H * 0.12, W * 0.16, H * 0.4); g.clip(); CK.rain(g, W, H, t, 26, 0.2); g.restore();
    const dim = 1 - CK.ease((t - 8.5) / 3) * 0.55;       // the light fades as Margaret does
    // bed
    const bx = W * 0.62, by = H * 0.8;
    g.fillStyle = '#2a1a10'; g.fillRect(bx - 130, by - 70, 12, 70); g.fillRect(bx + 118, by - 100, 12, 100); g.fillRect(bx - 130, by - 40, 260, 14);
    g.fillStyle = '#d8d0c4'; g.fillRect(bx - 118, by - 56, 236, 22);
    g.fillStyle = '#e8e0d4'; g.beginPath(); g.ellipse(bx + 82, by - 64, 30, 10, 0, 0, 7); g.fill();
    const ma = 1 - CK.ease((t - 9) / 3) * 0.7, br = Math.sin(t * 1.4) * 1.2;
    g.globalAlpha = ma; g.fillStyle = '#4a2a1a'; g.beginPath(); g.ellipse(bx + 70, by - 70 + br, 36, 10, 0.05, 0, 7); g.fill();
    g.fillStyle = '#e0c4b0'; g.beginPath(); g.arc(bx + 86, by - 72 + br, 12, 0, 7); g.fill(); g.fillStyle = '#16100e'; g.beginPath(); g.arc(bx + 82, by - 74 + br, 1.3, 0, 7); g.arc(bx + 90, by - 74 + br, 1.3, 0, 7); g.fill();
    g.fillStyle = '#6a5470'; g.beginPath(); g.moveTo(bx - 112, by - 50); g.quadraticCurveTo(bx, by - 76 + br, bx + 66, by - 60); g.lineTo(bx + 66, by - 36); g.lineTo(bx - 112, by - 36); g.closePath(); g.fill(); g.globalAlpha = 1;
    // lullaby notes rise from Margaret
    if (t < 9.5) for (let i = 0; i < 5; i++) { const k = ((t * 0.35 + i * 0.2) % 1); CK.note(g, bx + 80 + Math.sin(k * 6 + i) * 24, by - 90 - k * 130, t + i, Math.sin(k * Math.PI) * 0.9); }
    CK.candle(g, bx - 150, by - 4, t, 1.1);
    // Elspeth holds her mother's hand and bows her head as the light fails
    CK.person(g, { x: bx + 4, y: by + 12, s: 0.84, face: 1, t, style: 'girl', armR: 1.15, bendR: 0.3, armL: 0.15, tilt: 0.05 + CK.ease((t - 9) / 3) * 0.25, dip: CK.ease((t - 9) / 3) * 4 });
    CK.label(g, 'Margaret', bx + 84, by - 108, CK.show(t, 1, 0.8) * (1 - CK.show(t, 7, 1)));
    CK.label(g, 'Elspeth', bx + 4, by - 150, CK.show(t, 1.6, 0.8) * (1 - CK.show(t, 7.6, 1)));
    // Thomas waits by the door with a toy lantern
    const tx = W * 0.08 + 6;
    CK.person(g, { x: tx + 10, y: by + 22, s: 0.62, face: 1, t, style: 'boy', armR: 0.6, bendR: 1.0 }); CK.lantern(g, tx + 30, by - 38, t, 0.7);
    CK.label(g, 'Thomas', tx + 10, by - 112, CK.show(t, 2.2, 0.8) * (1 - CK.show(t, 8.2, 1)));
    // Josiah stands in the shadows with his hand at his chin
    CK.person(g, { x: W * 0.4, y: by + 8, s: 1.02, face: 1, t, style: 'josiah', armL: 0.1, armR: 1.9, bendR: 2.4, tilt: 0.12 + Math.sin(t * 0.7) * 0.03, dip: 2 });
    CK.label(g, 'Josiah', W * 0.4, by - 192, CK.show(t, 2.8, 0.8) * (1 - CK.show(t, 8.8, 1)));
    // Doctor Venn arrives, shakes his head, and is sent away
    const enter = CK.ease((t - 3.2) / 3), leave = CK.ease((t - 10) / 3), dx = -50 + enter * (W * 0.28 + 50) - leave * (W * 0.34), walking = (enter > 0.02 && enter < 0.98) || (leave > 0.02 && leave < 0.98);
    CK.person(g, { x: dx, y: by + 16, s: 0.98, face: leave > 0.02 ? -1 : 1, t, style: 'doctor', walk: walking ? 0.8 : 0, tilt: enter >= 0.98 && leave <= 0.02 ? Math.sin((t - 6.2) * 5) * 0.12 : 0, armR: walking ? undefined : 0.8, bendR: 0.7, talk: t > 6.2 && t < 9.5 });
    CK.label(g, 'Dr. Venn', dx, by - 186, CK.show(t, 4, 0.8) * (1 - CK.show(t, 9.5, 1)));
    g.fillStyle = 'rgba(0,0,0,' + (1 - dim) + ')'; g.fillRect(0, 0, W, H);
    CK.vignette(g, W, H, 0.7);
  },

  // 3. Samhain 1898: the crypt gate closes on Elspeth
  crypt(g, t, W, H) {
    g.fillStyle = '#080b0a'; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 9; r++) for (let c = -1; c < 13; c++) { g.fillStyle = 'hsl(150,6%,' + (9 + ((r * 7 + c * 3) % 5)) + '%)'; g.fillRect(c * 62 + (r % 2) * 31, r * 38, 60, 36); }
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.2, gl = g.createRadialGradient(W * 0.62, H * 0.5, 10, W * 0.62, H * 0.5, W * 0.4); gl.addColorStop(0, 'rgba(60,255,130,' + (0.32 * pulse) + ')'); gl.addColorStop(1, 'rgba(60,255,130,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
    // altar and the horned skull
    g.fillStyle = '#1c1f21'; g.fillRect(W * 0.7, H * 0.62, W * 0.26, H * 0.3); g.fillStyle = '#d8d4b0'; g.beginPath(); g.arc(W * 0.83, H * 0.55, 15, 0, 7); g.fill();
    g.strokeStyle = '#d8d4b0'; g.lineWidth = 4; g.beginPath(); g.moveTo(W * 0.83 - 12, H * 0.5); g.quadraticCurveTo(W * 0.83 - 30, H * 0.4, W * 0.83 - 24, H * 0.34); g.moveTo(W * 0.83 + 12, H * 0.5); g.quadraticCurveTo(W * 0.83 + 30, H * 0.4, W * 0.83 + 24, H * 0.34); g.stroke();
    g.fillStyle = 'rgba(80,255,150,' + (0.7 + pulse * 0.3) + ')'; g.fillRect(W * 0.83 - 8, H * 0.54, 4, 4); g.fillRect(W * 0.83 + 4, H * 0.54, 4, 4);
    g.fillStyle = '#0d0f0f'; g.fillRect(0, H * 0.88, W, H * 0.12);
    const gy = H * 0.9;
    // Josiah leads Elspeth in by the wrist, then lets go and backs out
    const walkIn = CK.ease(t / 4.5), release = CK.ease((t - 5) / 1.6), jx = W * 0.14 + walkIn * W * 0.38 - release * W * 0.32, ex = W * 0.3 + walkIn * W * 0.4;
    const moving = walkIn < 0.98 || (release > 0.02 && release < 0.98);
    CK.person(g, { x: ex, y: gy, s: 0.84, face: 1, t, style: 'girl', walk: walkIn < 0.98 ? 0.55 : 0, speed: 5, tilt: 0.12, dip: 3, armL: -0.1, armR: -0.7 - CK.ease((t - 6.5) / 1.5) * 0, bendR: 0.2 });
    CK.person(g, { x: jx, y: gy + 6, s: 1.05, face: release > 0.02 ? -1 : 1, t, style: 'josiah', walk: moving ? 0.5 : 0, speed: 5, armR: 1.1, bendR: 0.2, armL: 0.2, dip: 2, tilt: 0.1 });
    if (release < 0.9) CK.lantern(g, jx + 24, gy - 90, t, 0.9);
    CK.label(g, 'Josiah', jx, gy - 196, CK.show(t, 0.6, 0.7) * (1 - CK.show(t, 5, 0.8)));
    CK.label(g, 'Elspeth', ex, gy - 158, CK.show(t, 0.9, 0.7) * (1 - CK.show(t, 7, 1)));
    // the iron gate drops
    const gate = CK.ease((t - 6) / 1.6), gx = W * 0.5, gw = W * 0.18;
    g.fillStyle = '#050607'; g.fillRect(gx - gw / 2 - 6, 0, 8, H); g.fillRect(gx + gw / 2 - 2, 0, 8, H);
    if (gate > 0) { g.strokeStyle = '#0c0d10'; g.lineWidth = 5; for (let i = 0; i <= 8; i++) { const bx = gx - gw / 2 + (gw / 8) * i; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, H * 0.9 * gate); g.stroke(); } g.beginPath(); g.moveTo(gx - gw / 2, H * 0.3 * gate); g.lineTo(gx + gw / 2, H * 0.3 * gate); g.moveTo(gx - gw / 2, H * 0.7 * gate); g.lineTo(gx + gw / 2, H * 0.7 * gate); g.stroke(); }
    if (t > 7.8) { g.fillStyle = 'rgba(225,200,185,0.9)'; const k = 1 + Math.sin(t * 9) * 0.04; g.beginPath(); g.arc(gx + 6, H * 0.52, 6 * k, 0, 7); g.fill(); g.fillRect(gx + 1, H * 0.52, 9, 22 * k); }
    // Thomas pounds on the nursery door in an inset
    const ia = CK.show(t, 8.4, 1);
    if (ia > 0) { g.save(); g.globalAlpha = ia; g.translate(14, H - 118); g.fillStyle = '#120b07'; g.fillRect(0, 0, 150, 104); g.strokeStyle = '#4a3a2a'; g.strokeRect(0, 0, 150, 104); g.fillStyle = '#2a1a10'; g.fillRect(70, 8, 70, 94);
      CK.person(g, { x: 40, y: 100, s: 0.5, face: 1, t, style: 'boy', armR: 1.5 + Math.sin(t * 14) * 0.5, bendR: 0.3, armL: 1.4 - Math.sin(t * 14) * 0.5, bendL: 0.3, talk: true });
      g.fillStyle = '#d8c8a8'; g.font = '10px "IBM Plex Mono", monospace'; g.fillText('Thomas, locked in the nursery', 8, 98); g.restore(); }
    CK.fog(g, W, H, t, H * 0.9, 0.16); CK.vignette(g, W, H, 0.78);
  },

  // 4. 1998: Dacre in the car, Rowan on the road with a flashlight and a bodycam
  job(g, t, W, H) {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#06080f'); sky.addColorStop(1, '#10151f'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    CK.stars(g, W, H, t * 0.5); CK.moon(g, W * 0.16, H * 0.2, 14);
    g.fillStyle = '#05060a'; g.beginPath(); g.moveTo(0, H * 0.66); g.quadraticCurveTo(W * 0.5, H * 0.42, W, H * 0.62); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    CK.manor(g, W * 0.76, H * 0.64, W * 0.34, H * 0.26, t, true);
    g.fillStyle = '#111419'; g.fillRect(0, H * 0.82, W, H * 0.18); g.fillStyle = 'rgba(200,210,230,0.08)'; for (let x = 0; x < W; x += 50) g.fillRect(x + ((t * 30) % 50) * 0, H * 0.9, 24, 2);
    // car with warm headlights
    const cx = W * 0.15, cy = H * 0.84;
    const beam = g.createLinearGradient(cx + 90, cy - 20, cx + 330, cy - 6); beam.addColorStop(0, 'rgba(255,240,190,0.38)'); beam.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = beam; g.beginPath(); g.moveTo(cx + 92, cy - 24); g.lineTo(cx + 340, cy - 70); g.lineTo(cx + 340, cy + 24); g.lineTo(cx + 92, cy - 8); g.closePath(); g.fill();
    g.fillStyle = '#0a0b10'; g.beginPath(); g.moveTo(cx - 90, cy); g.lineTo(cx - 90, cy - 30); g.lineTo(cx - 50, cy - 36); g.lineTo(cx - 20, cy - 66); g.lineTo(cx + 46, cy - 66); g.lineTo(cx + 72, cy - 36); g.lineTo(cx + 96, cy - 28); g.lineTo(cx + 96, cy); g.closePath(); g.fill();
    g.fillStyle = '#1d2733'; g.beginPath(); g.moveTo(cx - 14, cy - 60); g.lineTo(cx + 42, cy - 60); g.lineTo(cx + 62, cy - 38); g.lineTo(cx - 36, cy - 38); g.closePath(); g.fill();
    const dg = g.createRadialGradient(cx + 14, cy - 48, 2, cx + 14, cy - 48, 40); dg.addColorStop(0, 'rgba(90,160,110,0.35)'); dg.addColorStop(1, 'rgba(90,160,110,0)'); g.fillStyle = dg; g.fillRect(cx - 30, cy - 90, 90, 70);
    g.save(); g.beginPath(); g.moveTo(cx - 14, cy - 60); g.lineTo(cx + 42, cy - 60); g.lineTo(cx + 62, cy - 38); g.lineTo(cx - 36, cy - 38); g.closePath(); g.clip();
    CK.person(g, { x: cx + 12, y: cy - 4, s: 0.5, face: 1, t, style: 'dacre', armL: 0.2, armR: 0.2, talk: true, glow: 'rgba(80,150,100,0.0)' }); g.restore();
    g.fillStyle = '#ffeeb0'; g.beginPath(); g.arc(cx + 94, cy - 18, 4, 0, 7); g.fill(); g.fillStyle = '#050507'; g.beginPath(); g.arc(cx - 52, cy + 2, 14, 0, 7); g.arc(cx + 56, cy + 2, 14, 0, 7); g.fill();
    CK.label(g, 'Dacre', cx + 12, cy - 100, CK.show(t, 1.2, 0.8) * (1 - CK.show(t, 8, 1)));
    // Rowan walks up the road with a flashlight
    const rp = CK.ease((t - 1.5) / 7), rx = cx + 130 + rp * W * 0.28, walking = rp > 0.01 && rp < 0.99;
    const ang = -0.02 + Math.sin(t * 0.9) * 0.08, fb = g.createLinearGradient(rx + 28, H * 0.74, rx + 230, H * 0.78); fb.addColorStop(0, 'rgba(255,245,215,0.5)'); fb.addColorStop(1, 'rgba(255,245,215,0)');
    g.save(); g.translate(rx + 22, H * 0.735); g.rotate(ang); g.fillStyle = fb; g.beginPath(); g.moveTo(0, -2); g.lineTo(220, -48); g.lineTo(220, 40); g.lineTo(0, 2); g.closePath(); g.fill(); g.restore();
    CK.person(g, { x: rx, y: H * 0.9, s: 0.74, face: 1, t, style: 'rowan', walk: walking ? 0.8 : 0, armR: 1.2, bendR: 0.12, armL: undefined });
    CK.label(g, 'Rowan Vale', rx, H * 0.9 - 138, CK.show(t, 2, 0.8) * (1 - CK.show(t, 9, 1)));
    CK.rain(g, W, H, t, 70, 0.4); CK.vignette(g, W, H, 0.7);
  },

  // 5. The radio call: Rowan climbs the path while Dacre's voice crackles
  radio(g, t, W, H, c) {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#05060c'); sky.addColorStop(1, '#141a28'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    CK.stars(g, W, H, t * 0.4); CK.moon(g, W * 0.84, H * 0.2, 16);
    CK.manor(g, W * 0.5, H * 0.74, W * 0.74, H * 0.5, t, true);
    // chained front door
    g.fillStyle = '#0a0806'; g.fillRect(W * 0.46, H * 0.52, W * 0.08, H * 0.22); g.strokeStyle = '#5a5a60'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.46, H * 0.6); g.quadraticCurveTo(W * 0.5, H * 0.66, W * 0.54, H * 0.6); g.stroke();
    g.fillStyle = '#0c1018'; g.beginPath(); g.moveTo(W * 0.4, H); g.lineTo(W * 0.6, H); g.lineTo(W * 0.53, H * 0.74); g.lineTo(W * 0.47, H * 0.74); g.closePath(); g.fill();
    const p = CK.ease(t / 9), ry = H * (1.04 - p * 0.3), rs = 0.9 - p * 0.42, rx = W * 0.5 + Math.sin(p * 5) * 8 * (1 - p);
    const b = g.createRadialGradient(rx, ry - 70 * rs, 4, rx, ry - 160 * rs, 190 * rs); b.addColorStop(0, 'rgba(255,245,215,0.33)'); b.addColorStop(1, 'rgba(255,245,215,0)'); g.fillStyle = b; g.fillRect(0, 0, W, H);
    CK.person(g, { x: rx, y: ry, s: rs, face: 1, t, style: 'rowan', back: true, walk: p < 0.98 ? 0.8 : 0, armR: 0.5, bendR: 0.2, speed: 6 });
    for (let i = 0; i < 3; i++) CK.crow(g, ((t * (30 + i * 9) + i * 190) % (W + 80)) - 40, H * (0.12 + i * 0.06), t + i, 0.9);
    // the radio panel: equaliser bars move while Dacre is speaking
    const sp = (c.opts.speakers || []), idx = Math.floor((t - 0.5) / 1.1), who = sp[Math.max(0, Math.min(sp.length - 1, idx))] || 'DACRE', active = t > 0.4 && who === 'DACRE';
    g.fillStyle = 'rgba(8,8,10,0.82)'; g.fillRect(14, 14, 148, 54); g.strokeStyle = 'rgba(232,146,58,0.5)'; g.strokeRect(14, 14, 148, 54);
    g.fillStyle = '#e8923a'; g.font = '500 11px "IBM Plex Mono", monospace'; g.fillText(t > 0.4 ? who : 'STANDBY', 24, 32);
    for (let i = 0; i < 16; i++) { const h = active ? 4 + Math.abs(Math.sin(t * 9 + i * 1.7) * Math.cos(t * 5 + i)) * 20 : 2; g.fillStyle = active ? '#e8923a' : '#4a3a28'; g.fillRect(24 + i * 8, 62 - h, 5, h); }
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 9; i++) g.fillRect(0, (i * 41 + t * 60) % H, W, 1);
    CK.fog(g, W, H, t, H * 0.9, 0.18); CK.rain(g, W, H, t, 40, 0.15); CK.vignette(g, W, H, 0.75);
  },

  // 6. The Lady waits at the end of the corridor
  final(g, t, W, H, c) {
    const img = c.img;
    if (img && img.complete && img.naturalWidth) g.drawImage(img, 0, 0, W, H); else { g.fillStyle = '#0b0a0a'; g.fillRect(0, 0, W, H); }
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(0, 0, W, H);
    const fl = 0.8 + Math.sin(t * 13) * 0.08 + (Math.sin(t * 2.3) > 0.97 ? -0.5 : 0); const lg = g.createRadialGradient(W * 0.5, H * 0.52, 4, W * 0.5, H * 0.52, W * 0.3); lg.addColorStop(0, 'rgba(255,150,60,' + (0.3 * fl) + ')'); lg.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const near = CK.ease((t - 1.5) / 9), a = (0.15 + CK.show(t, 1, 3) * 0.55) * (0.8 + Math.sin(t * 3) * 0.2);
    CK.lady(g, W * 0.5 + Math.sin(t * 0.7) * 3, H * (0.66 + near * 0.16), 0.5 + near * 0.6, t, a * (Math.sin(t * 17) > 0.96 ? 0.2 : 1), near > 0.5 ? 0.25 : 0);
    // Rowan from behind, light trembling
    const sw = Math.sin(t * 1.2) * 3;
    g.save(); g.translate(W * 0.5 + sw, H * 1.02); const beam = g.createLinearGradient(0, -80, 0, -H * 0.8); beam.addColorStop(0, 'rgba(255,245,215,0.28)'); beam.addColorStop(1, 'rgba(255,245,215,0)'); g.fillStyle = beam; g.beginPath(); g.moveTo(-6, -100); g.lineTo(-70 - sw * 3, -H * 0.85); g.lineTo(70 - sw * 3, -H * 0.85); g.lineTo(6, -100); g.closePath(); g.fill(); g.restore();
    CK.person(g, { x: W * 0.5 + sw, y: H * 1.18, s: 0.9, face: 1, t, style: 'rowan', back: true, armR: 1.35, bendR: 0.05, armL: 0.1 });
    CK.rain(g, W, H, t, 0, 0); CK.vignette(g, W, H, 0.85);
  }
};

// --------------------------------------------------------------------------
// Player
// --------------------------------------------------------------------------
class Cinematic {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.t = 0; this.raf = 0; this.scene = null; this.opts = {}; this.dead = false;
    this.img = new Image(); this.img.src = 'assets/images/room_corridor.jpg';
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = this.cv.clientWidth || 680;
    this.W = Math.max(300, Math.round(w)); this.H = Math.round(this.W * 0.44);
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.cv.style.height = this.H + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  start(id, opts) {
    this.stop(); this.resize(); this.scene = SCENES[id]; this.opts = opts || {}; this.t = 0; this.dead = false; this.last = performance.now();
    const loop = now => { if (this.dead) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt; this.draw(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.dead = true; cancelAnimationFrame(this.raf); }
  // for tests: render a shot at an exact time without the clock
  renderAt(id, t, opts) { this.resize(); this.scene = SCENES[id]; this.opts = opts || {}; this.t = t; this.draw(); }
  draw() {
    const g = this.g, W = this.W, H = this.H;
    g.save(); g.clearRect(0, 0, W, H); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalAlpha = Math.min(1, this.t / 0.7);
    if (this.scene) this.scene(g, this.t, W, H, this);
    g.restore();
    // film flicker and scanlines over everything
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(255,255,255,' + (0.015 + Math.random() * 0.02) + ')'; g.fillRect(0, 0, W, H);
  }
}
