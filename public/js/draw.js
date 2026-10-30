// 귀여운 곤충 캐릭터 그리기 (그림 파일 없이 캔버스로 그려요)
// BugArt.draw(ctx, 종류, x, y, 크기, { flip, rot, phase, mood, fly, glow })
//   크기: 몸길이(px) · flip: 왼쪽 보기 · phase: 다리·날개 움직임 · mood: happy | dizzy | strain
window.BugArt = (() => {
  'use strict';
  // kind: beetle(딱정벌레형) · ant · long(메뚜기형) · round(벌형) · slim(나비형) · dragon(잠자리형)
  const SPEC = {
    ant: { kind: 'ant', col: '#6b4430', col2: '#8a5a3c', head: '#7a4e36' },
    ladybug: { kind: 'beetle', col: '#ef4444', col2: '#fca5a5', head: '#1f2937', spots: '#1f2937' },
    bee: { kind: 'round', col: '#facc15', col2: '#fde68a', head: '#facc15', stripes: '#3f3f46', wings: 'clear', sting: true },
    grasshopper: { kind: 'long', col: '#65a30d', col2: '#a3e635', head: '#84cc16', hind: true },
    cricket: { kind: 'long', col: '#7c4a1e', col2: '#b07a3e', head: '#8b5a2b', hind: true, longAnt: true },
    butterfly: { kind: 'slim', col: '#475569', col2: '#94a3b8', head: '#64748b', wings: 'butterfly', wc: '#f8fafc', we: '#94a3b8', wd: '#334155' },
    firefly: { kind: 'beetle', col: '#334155', col2: '#64748b', head: '#fb923c', glow: true, small: true },
    dragonfly: { kind: 'dragon', col: '#0ea5e9', col2: '#7dd3fc', head: '#38bdf8', wings: 'dragon', eye: '#1d4ed8' },
    dungbeetle: { kind: 'beetle', col: '#1f2937', col2: '#6b7280', head: '#111827', shovel: true },
    mantis: { kind: 'long', col: '#16a34a', col2: '#86efac', head: '#22c55e', arms: true, tri: true },
    cicada: { kind: 'round', col: '#57534e', col2: '#a8a29e', head: '#4d7c0f', wings: 'clear', big: true },
    rhino: { kind: 'beetle', col: '#7c2d12', col2: '#c2410c', head: '#451a03', horn: true },
    stag: { kind: 'beetle', col: '#3f2a1d', col2: '#8b6b4a', head: '#2b1d14', jaws: true },
    swallowtail: { kind: 'slim', col: '#1f2937', col2: '#6b7280', head: '#374151', wings: 'butterfly', wc: '#fde047', we: '#1f2937', wd: '#1f2937', blue: true },
  };

  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  function fillStroke(c, fill, stroke = 'rgba(0,0,0,0.45)', lw = 1.6) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  function shine(c, x, y, rx, ry) { c.save(); ell(c, x, y, rx, ry, -0.4); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill(); c.restore(); }

  function legs(c, xs, y, ph, col, len = 8) {
    c.strokeStyle = col; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
    xs.forEach((x, i) => {
      const s = Math.sin(ph + i * 2.1) * 3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + s + 2, y + len * 0.6); c.lineTo(x + s - 1, y + len); c.stroke();
    });
  }
  function antennae(c, hx, hy, hr, ph, col, long) {
    c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round';
    const L = long ? 20 : 11, wob = Math.sin(ph * 0.7) * 1.5;
    [[-3, -7], [3, 4]].forEach(([dx, tip]) => {
      const sx = hx + dx, sy = hy - hr + 2, ex = hx + tip + wob, ey = hy - hr - L;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + (ex - sx) * 0.2 - 3, sy - L * 0.6, ex, ey); c.stroke();
      circ(c, ex, ey, long ? 1.6 : 2.6); c.fillStyle = col; c.fill();
    });
  }
  function face(c, hx, hy, hr, mood, eyeCol) {
    const ex1 = hx - hr * 0.12, ex2 = hx + hr * 0.5, ey = hy - hr * 0.12, er = hr * (eyeCol ? 0.46 : 0.36);
    if (mood === 'dizzy') {
      c.strokeStyle = '#111'; c.lineWidth = 1.8;
      for (const x of [ex1, ex2]) { c.beginPath(); c.moveTo(x - er * 0.7, ey - er * 0.7); c.lineTo(x + er * 0.7, ey + er * 0.7); c.moveTo(x + er * 0.7, ey - er * 0.7); c.lineTo(x - er * 0.7, ey + er * 0.7); c.stroke(); }
    } else if (mood === 'strain' || mood === 'happy') {
      c.strokeStyle = '#111'; c.lineWidth = 1.9; c.lineCap = 'round';
      for (const x of [ex1, ex2]) {
        c.beginPath();
        if (mood === 'happy') c.arc(x, ey + er * 0.3, er * 0.7, Math.PI * 1.1, Math.PI * 1.9);
        else { c.moveTo(x - er * 0.7, ey - er * 0.5); c.lineTo(x + er * 0.3, ey); c.lineTo(x - er * 0.7, ey + er * 0.5); }
        c.stroke();
      }
    } else {
      for (const x of [ex1, ex2]) {
        circ(c, x, ey, er); c.fillStyle = eyeCol || '#fff'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.stroke();
        circ(c, x + er * 0.25, ey + er * 0.05, er * 0.6); c.fillStyle = '#111'; c.fill();
        circ(c, x + er * 0.42, ey - er * 0.25, er * 0.24); c.fillStyle = '#fff'; c.fill();
      }
    }
    // 볼 터치 + 입
    c.fillStyle = 'rgba(255,120,150,0.55)';
    ell(c, ex1 - er * 0.5, hy + hr * 0.42, er * 0.55, er * 0.32); c.fill();
    ell(c, ex2 + er * 0.35, hy + hr * 0.42, er * 0.55, er * 0.32); c.fill();
    c.strokeStyle = '#3b0d0d'; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath();
    if (mood === 'dizzy' || mood === 'strain') { c.moveTo(hx + hr * 0.05, hy + hr * 0.5); c.lineTo(hx + hr * 0.4, hy + hr * 0.5); }
    else c.arc(hx + hr * 0.2, hy + hr * 0.38, hr * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
  }

  function wingsBack(c, sp, ph, fly) {
    const flap = fly ? Math.abs(Math.sin(ph * 2.2)) : 0.35;
    if (sp.wings === 'clear') {
      const big = sp.big ? 1.35 : 1;
      c.save(); c.globalAlpha = 0.75;
      ell(c, -8 * big, -12 - flap * 4, 13 * big, (6 + flap * 3) * big, -0.5); fillStroke(c, 'rgba(224,242,254,0.85)', 'rgba(71,85,105,0.6)', 1.2);
      ell(c, -2 * big, -14 - flap * 5, 12 * big, (5 + flap * 3) * big, -0.9); fillStroke(c, 'rgba(240,249,255,0.9)', 'rgba(71,85,105,0.6)', 1.2);
      c.restore();
    } else if (sp.wings === 'butterfly') {
      const sy = 0.45 + 0.55 * (fly ? Math.abs(Math.cos(ph * 2)) : 0.8);
      c.save(); c.translate(-2, -2); c.scale(1, sy);
      // 뒷날개 + 앞날개
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-26, -6, -24, 20, -6, 14); c.closePath(); fillStroke(c, sp.wc, sp.we, 1.6);
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-8, -30, -34, -34, -30, -12); c.bezierCurveTo(-26, -4, -10, -2, 0, 0); fillStroke(c, sp.wc, sp.we, 1.6);
      c.fillStyle = sp.wd;
      if (sp.blue) {
        for (const [x, y, w] of [[-12, -18, 2], [-20, -20, 2], [-26, -14, 2]]) { c.fillRect(x, y, w, 10); }
        circ(c, -16, 10, 3); c.fillStyle = '#3b82f6'; c.fill();
      } else { circ(c, -22, -20, 3.2); c.fill(); circ(c, -14, -14, 2.4); c.fill(); }
      c.restore();
    } else if (sp.wings === 'dragon') {
      const a = fly ? Math.sin(ph * 3) * 0.25 : 0.1;
      c.save(); c.globalAlpha = 0.8;
      for (const [x, rot] of [[-4, -0.35 - a], [2, -0.15 + a]]) {
        ell(c, x - 12, -9, 18, 4.5, rot); fillStroke(c, 'rgba(224,242,254,0.8)', 'rgba(14,116,144,0.6)', 1);
      }
      c.restore();
    }
  }

  function draw(c, type, x, y, size, o = {}) {
    const sp = SPEC[type] || SPEC.ant, ph = o.phase || 0, mood = o.mood;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.flip) c.scale(-1, 1);
    const k = size / 46 * (sp.small ? 0.9 : 1); c.scale(k, k);
    if (o.shadow !== false) { ell(c, 0, 19, 20, 4); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fill(); }
    if (o.fly) c.translate(0, -4 + Math.sin(ph * 1.5) * 2);
    c.lineJoin = 'round';
    wingsBack(c, sp, ph, o.fly);
    const legCol = '#2a1a12';
    let hx = 13, hy = 0, hr = 9;

    if (sp.kind === 'ant') {
      legs(c, [-6, 0, 5], 6, ph, legCol, 11);
      ell(c, -13, 2, 10, 8); fillStroke(c, sp.col); shine(c, -15, -2, 4, 2);
      ell(c, -1, 4, 6, 4.5); fillStroke(c, sp.col2);
      hx = 11; hy = -1; hr = 9;
    } else if (sp.kind === 'beetle') {
      legs(c, [-9, -2, 5], 9, ph, legCol, 9);
      if (sp.glow) {
        const pulse = 0.6 + 0.4 * Math.sin(ph * 1.3 + (o.glow || 0));
        const gr = c.createRadialGradient(-17, 4, 1, -17, 4, 16);
        gr.addColorStop(0, `rgba(253,224,71,${0.95 * pulse})`); gr.addColorStop(1, 'rgba(253,224,71,0)');
        c.fillStyle = gr; circ(c, -17, 4, 16); c.fill();
        ell(c, -15, 5, 6, 5); fillStroke(c, '#fde047', 'rgba(0,0,0,0.35)', 1.2);
      }
      c.beginPath(); c.ellipse(-3, 3, 17, 14, 0, Math.PI, 0); c.lineTo(14, 8); c.quadraticCurveTo(-3, 13, -20, 8); c.closePath();
      fillStroke(c, sp.col);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-3, -11); c.quadraticCurveTo(-1, 0, -3, 10); c.stroke();
      if (sp.spots) { c.fillStyle = sp.spots; for (const [sx, sy, r] of [[-11, -2, 3.2], [5, -3, 3], [-6, 6, 2.6], [8, 5, 2.4], [-14, 6, 2]]) { circ(c, sx, sy, r); c.fill(); } }
      shine(c, -8, -7, 6, 2.6);
      hx = 15; hy = 3; hr = 8.5;
      if (sp.jaws) {
        c.strokeStyle = '#2b1d14'; c.lineWidth = 3.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(hx + 5, hy - 3); c.quadraticCurveTo(hx + 16, hy - 12, hx + 20, hy - 3); c.stroke();
        c.beginPath(); c.moveTo(hx + 5, hy + 4); c.quadraticCurveTo(hx + 17, hy + 10, hx + 20, hy + 2); c.stroke();
      }
      if (sp.shovel) { c.beginPath(); c.moveTo(hx + 4, hy - 7); c.lineTo(hx + 12, hy - 4); c.lineTo(hx + 9, hy + 2); c.closePath(); fillStroke(c, '#374151'); }
    } else if (sp.kind === 'long') {
      if (sp.hind) {
        c.strokeStyle = sp.col; c.lineWidth = 4; c.lineCap = 'round';
        const kick = Math.sin(ph) * 2;
        c.beginPath(); c.moveTo(-6, 4); c.lineTo(-14, -11 + kick); c.lineTo(-26, 12); c.stroke();
      }
      legs(c, sp.hind ? [-2, 6] : [-10, -2, 6], 6, ph, legCol, 10);
      ell(c, -5, 2, 18, 7.5); fillStroke(c, sp.col); shine(c, -9, -2, 7, 2);
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1;
      for (const sx of [-16, -10, -4]) { c.beginPath(); c.moveTo(sx, -4); c.lineTo(sx + 1, 8); c.stroke(); }
      hx = 14; hy = -2; hr = 8.5;
      if (sp.arms) {
        c.strokeStyle = sp.col; c.lineWidth = 3.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(8, 4); c.lineTo(17, 11); c.lineTo(23, 4); c.stroke();
      }
    } else if (sp.kind === 'round') {
      legs(c, [-10, -3, 4], 9, ph, legCol, 8);
      if (sp.sting) { c.beginPath(); c.moveTo(-17, 0); c.lineTo(-24, 3); c.lineTo(-17, 6); c.closePath(); fillStroke(c, '#3f3f46'); }
      ell(c, -4, 2, 15, 12); fillStroke(c, sp.col);
      if (sp.stripes) {
        c.save(); ell(c, -4, 2, 15, 12); c.clip(); c.fillStyle = sp.stripes;
        for (const sx of [-14, -6]) c.fillRect(sx, -12, 4, 26);
        c.restore();
      }
      if (sp.big) { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1; for (const sy of [-3, 3, 9]) { c.beginPath(); c.moveTo(-16, sy); c.quadraticCurveTo(-4, sy + 2, 8, sy); c.stroke(); } }
      shine(c, -8, -5, 6, 2.6);
      hx = 12; hy = -1; hr = 9;
    } else if (sp.kind === 'slim') {
      legs(c, [-6, -1, 4], 7, ph, legCol, 8);
      ell(c, -5, 3, 13, 4.5); fillStroke(c, sp.col);
      hx = 10; hy = 0; hr = 8;
    } else if (sp.kind === 'dragon') {
      legs(c, [-4, 1], 7, ph, legCol, 7);
      c.fillStyle = sp.col; c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1.4;
      c.beginPath(); c.roundRect(-32, -1, 28, 6, 3); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      for (const sx of [-26, -20, -14, -8]) { c.beginPath(); c.moveTo(sx, -1); c.lineTo(sx, 5); c.stroke(); }
      ell(c, -2, 2, 7.5, 6.5); fillStroke(c, sp.col2);
      hx = 9; hy = 0; hr = 8.5;
    }

    // 머리
    if (sp.tri) { c.beginPath(); c.moveTo(hx - hr, hy - hr * 0.8); c.lineTo(hx + hr * 1.1, hy - hr * 0.7); c.lineTo(hx + hr * 0.2, hy + hr * 1.1); c.closePath(); fillStroke(c, sp.head); }
    else { circ(c, hx, hy, hr); fillStroke(c, sp.head); }
    if (sp.horn) {
      c.beginPath(); c.moveTo(hx + 3, hy - hr + 2); c.quadraticCurveTo(hx + 14, hy - hr - 2, hx + 15, hy - hr - 16);
      c.quadraticCurveTo(hx + 10, hy - hr - 6, hx - 1, hy - hr + 4); c.closePath(); fillStroke(c, '#5a2410');
    }
    antennae(c, hx, hy, hr, ph, sp.kind === 'beetle' && !sp.glow ? '#2b1d14' : '#1f2937', sp.longAnt);
    face(c, hx, hy, hr, mood, sp.eye);
    c.restore();
  }

  // 카드·목록용 그림 (dataURL, 한 번 만들면 다시 써요)
  const cache = {};
  function portrait(type, px = 96, mood) {
    const key = `${type}:${px}:${mood || ''}`;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
    const c = cv.getContext('2d'); c.scale(2, 2);
    draw(c, type, px * 0.52, px * 0.58, px * 0.66, { phase: 0.6, mood, fly: false, shadow: true });
    return (cache[key] = cv.toDataURL());
  }

  return { draw, portrait, SPEC };
})();
