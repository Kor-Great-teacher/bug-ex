// 귀여운 곤충 캐릭터 그리기 (그림 파일 없이 캔버스로 그려요)
// 만화 영화 캐릭터 느낌: 몸보다 큰 머리 · 크고 하얀 눈 · 큼직한 입 · 곤충마다 다른 성격(눈썹·눈꺼풀·입 모양)
// 등급이 높을수록 화려해요: 일반(없음) → 희귀(목도리 + 반짝이) → 영웅(머리띠 + 망토 + 보랏빛 기운) → 전설(왕관 + 후광 + 황금 빛살 + 빛 알갱이)
// BugArt.draw(ctx, 종류, x, y, 크기, { flip, rot, phase, mood, fly, time, shadow, deco })
//   크기: 몸길이(px) · phase: 다리·날개 움직임 · mood: happy | dizzy | strain · time: 초(숨쉬기·깜빡임·반짝이)
//   deco: false 면 등급 장식을 그리지 않아요
window.BugArt = (() => {
  'use strict';
  // kind: beetle(딱정벌레) · ant · long(메뚜기) · round(벌) · slim(나비) · dragon(잠자리)
  // 성격(face): brow 눈썹 · lid 눈꺼풀 · lash 속눈썹 · mouth 입 · iris 눈동자 크기 · odd 짝눈
  const SPEC = {
    ant: { kind: 'ant', col: '#b0643a', col2: '#d98a55', head: '#bb6f41', eye: '#4a2410', tip: '#ff8a1f',
      face: { brow: 'firm', mouth: 'grin', iris: 0.55 } },                       // 부지런한 일꾼: 씩씩한 눈썹 + 활짝 웃음
    ladybug: { kind: 'beetle', col: '#ff3d3d', col2: '#ff9c9c', head: '#2c3040', eye: '#e11d48', tip: '#ff3d3d', spots: '#1f2430', faceDots: true,
      face: { lash: true, mouth: 'smile', iris: 0.62 } },                      // 상냥한 친구: 속눈썹 + 미소
    bee: { kind: 'round', col: '#ffd02e', col2: '#fff3b0', head: '#ffc928', eye: '#6b3e00', tip: '#ffd02e', stripes: '#3a3340', wings: 'clear', sting: true, fluff: '#fff7d6',
      face: { brow: 'up', mouth: 'bigGrin', iris: 0.5 } },                     // 신나는 수다쟁이: 커다란 웃음
    grasshopper: { kind: 'long', col: '#7cc242', col2: '#d4f58a', head: '#8fd14f', eye: '#14532d', tip: '#d4f58a', hind: true,
      face: { mouth: 'buck', iris: 0.45, odd: true } },                        // 장난꾸러기: 짝눈 + 뻐드렁니
    cricket: { kind: 'long', col: '#9a6230', col2: '#e0ad6a', head: '#a86d37', eye: '#3b1d0e', tip: '#e0ad6a', hind: true, longAnt: true,
      face: { lid: 0.3, mouth: 'sing', iris: 0.5, note: true } },              // 노래하는 음악가: 지그시 감은 눈 + 노래하는 입
    butterfly: { kind: 'slim', col: '#7280a3', col2: '#c7d2fe', head: '#8592b5', eye: '#4338ca', tip: '#a5b4fc', wings: 'butterfly', wc: '#ffffff', wc2: '#e0e7ff', we: '#8fa0c7', wd: '#4b5677',
      face: { lash: true, brow: 'worry', mouth: 'tiny', iris: 0.66, shy: true } }, // 수줍음쟁이: 걱정 눈썹 + 작은 입 + 진한 볼
    firefly: { kind: 'beetle', col: '#3d4a63', col2: '#7a89a8', head: '#ff9147', eye: '#7c2d12', tip: '#ffe45c', glow: true, small: true,
      face: { lid: 0.5, mouth: 'smile', iris: 0.55 } },                        // 졸린 밤 친구: 반쯤 감긴 눈
    dragonfly: { kind: 'dragon', col: '#29b6f6', col2: '#a5e8ff', head: '#4fc3f7', eye: '#1d4ed8', tip: '#a5e8ff', wings: 'dragon',
      face: { brow: 'cocky', mouth: 'smirk', iris: 0.62 } },                   // 자신만만 스피드왕
    dungbeetle: { kind: 'beetle', col: '#3a3f52', col2: '#8b93ad', head: '#2f3446', eye: '#7c3aed', tip: '#a78bfa', shovel: true,
      face: { mouth: 'tongue', iris: 0.5, odd: true } },                       // 힘센 개구쟁이: 혀 내밀기
    mantis: { kind: 'long', col: '#2fbf5b', col2: '#a7f3c0', head: '#3fd06a', eye: '#15803d', tip: '#a7f3c0', arms: true, tri: true,
      face: { brow: 'cocky', lid: 0.42, mouth: 'smirk', iris: 0.5 } },        // 쿨한 무술 고수
    cicada: { kind: 'round', col: '#6f6a5c', col2: '#bdb59c', head: '#6aa33a', eye: '#b91c1c', tip: '#bdb59c', wings: 'clear', big: true, ridges: true,
      face: { brow: 'up', mouth: 'shout', iris: 0.42 } },                      // 목청 큰 가수: 크게 벌린 입
    rhino: { kind: 'beetle', col: '#a5401a', col2: '#e8803f', head: '#7a2e10', eye: '#b45309', tip: '#ffb35c', horn: true,
      face: { brow: 'boss', mouth: 'bigGrin', iris: 0.5 } },                   // 숲속 대장: 굵은 눈썹 + 호탕한 웃음
    stag: { kind: 'beetle', col: '#5e4029', col2: '#a8805a', head: '#4d3322', eye: '#c2410c', tip: '#d6a46c', jaws: true,
      face: { brow: 'angry', mouth: 'teeth', iris: 0.48 } },                   // 터프한 승부사: 매서운 눈썹 + 이 드러낸 웃음
    swallowtail: { kind: 'slim', col: '#2d3446', col2: '#6b7280', head: '#3a4256', eye: '#0ea5e9', tip: '#fde047', wings: 'butterfly', wc: '#ffe14d', wc2: '#fff8c4', we: '#272c3a', wd: '#272c3a', tiger: true,
      face: { lash: true, brow: 'calm', mouth: 'smile', iris: 0.62 } },        // 우아한 숲의 여왕
  };
  const rarityOf = type => (window.BugData && window.BugData.INSECTS[type] && window.BugData.INSECTS[type].rarity) || 'common';

  // ---------- 색 도우미 ----------
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(hex, f, a = 1) { // f > 0 밝게, f < 0 어둡게
    const [r, g, b] = rgb(hex), t = f < 0 ? 0 : 255, p = Math.abs(f);
    return `rgba(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)},${a})`;
  }
  const line = base => shade(base, -0.62);
  const isDark = hex => { const [r, g, b] = rgb(hex); return r * 0.3 + g * 0.59 + b * 0.11 < 90; };
  function ball(c, base, cx, cy, r) {
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.08, cx, cy, r * 1.15);
    g.addColorStop(0, shade(base, 0.5)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.32));
    return g;
  }
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  function fillLine(c, fill, stroke, lw = 2.6) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  function blob(c, base, x, y, rx, ry, rot = 0) {
    ell(c, x, y, rx, ry, rot); fillLine(c, ball(c, base, x, y, Math.max(rx, ry)), line(base));
    ell(c, x - rx * 0.32, y - ry * 0.48, rx * 0.36, ry * 0.18, -0.35); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
  }
  function star(c, x, y, r, rot = 0, pts = 4, inner = 0.38) {
    c.beginPath();
    for (let i = 0; i < pts * 2; i++) { const a = rot + i * Math.PI / pts, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }

  // ---------- 다리 · 더듬이 ----------
  function legs(c, xs, y, ph, base, len = 9) {
    const col = shade(base, -0.45), foot = shade(base, -0.15);
    c.lineCap = 'round'; c.lineJoin = 'round';
    xs.forEach((x, i) => {
      const s = Math.sin(ph + i * Math.PI * 0.66) * 3.2, lift = Math.max(0, Math.cos(ph + i * Math.PI * 0.66)) * 2;
      c.strokeStyle = line(base); c.lineWidth = 5.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + s + 1.5, y + len - lift); c.stroke();
      c.strokeStyle = col; c.lineWidth = 3.4; c.stroke();
      ell(c, x + s + 2.8, y + len - lift + 0.6, 3.8, 2.6); fillLine(c, foot, line(base), 1.6);
    });
  }
  function antennae(c, sp, hx, hy, hr, ph) {
    const L = sp.longAnt ? 26 : 13, wob = Math.sin(ph * 0.7) * 1.6;
    [[-hr * 0.38, -7], [hr * 0.22, 6]].forEach(([dx, tip], k) => {
      const sx = hx + dx, sy = hy - hr * 0.86, ex = hx + dx + tip + wob * (k ? 1 : -1), ey = sy - L;
      c.lineCap = 'round';
      c.strokeStyle = line(sp.head); c.lineWidth = 3.8;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + (ex - sx) * 0.1 - 4, sy - L * 0.7, ex, ey); c.stroke();
      c.strokeStyle = shade(sp.head, -0.2); c.lineWidth = 2; c.stroke();
      if (!sp.longAnt) {
        circ(c, ex, ey, 4); fillLine(c, ball(c, sp.tip, ex, ey, 4), line(sp.tip), 1.6);
        circ(c, ex - 1.2, ey - 1.3, 1.2); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
      }
    });
  }

  // ---------- 얼굴 (만화 캐릭터처럼 크고 하얀 눈 + 큼직한 입) ----------
  function eye(c, x, y, rx, ry, o) {
    const { col, mood, blink, irisK, lid, lash, skin, ink, look } = o;
    if (mood === 'dizzy') {
      ell(c, x, y, rx, ry); fillLine(c, '#fff', '#2a1a2e', 2);
      c.strokeStyle = '#2a1a2e'; c.lineWidth = 1.8; c.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) { const r = a / (Math.PI * 4) * rx * 0.85; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; a ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke(); return;
    }
    if (mood === 'happy' || mood === 'strain' || blink) {
      c.strokeStyle = ink; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (mood === 'strain') { c.moveTo(x - rx * 0.8, y - ry * 0.5); c.lineTo(x + rx * 0.5, y); c.lineTo(x - rx * 0.8, y + ry * 0.5); }
      else if (mood === 'happy') c.arc(x, y + ry * 0.4, rx * 0.95, Math.PI * 1.12, Math.PI * 1.88);
      else { c.moveTo(x - rx, y + 1); c.quadraticCurveTo(x, y + ry * 0.5, x + rx, y + 1); }
      c.stroke(); return;
    }
    // 흰자 → 눈동자 → 동공 → 하이라이트
    ell(c, x, y, rx, ry);
    const wg = c.createLinearGradient(0, y - ry, 0, y + ry); wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#e6e9f2');
    fillLine(c, wg, '#2a1a2e', 2.2);
    c.save(); ell(c, x, y, rx, ry); c.clip();
    const ir = rx * irisK * 1.25, ix = x + rx * 0.22 * look, iy = y + ry * 0.08;
    const ig = c.createRadialGradient(ix, iy - ir * 0.4, ir * 0.1, ix, iy, ir);
    ig.addColorStop(0, shade(col, 0.45)); ig.addColorStop(0.7, col); ig.addColorStop(1, shade(col, -0.45));
    circ(c, ix, iy, ir); c.fillStyle = ig; c.fill();
    circ(c, ix, iy, ir * 0.55); c.fillStyle = '#120a16'; c.fill();
    circ(c, ix + ir * 0.35, iy - ir * 0.4, ir * 0.36); c.fillStyle = '#fff'; c.fill();
    circ(c, ix - ir * 0.4, iy + ir * 0.4, ir * 0.15); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
    // 눈꺼풀 (졸린 눈 · 쿨한 눈)
    if (lid) { c.fillStyle = skin; c.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * lid + 2); }
    c.restore();
    if (lid) { c.strokeStyle = '#2a1a2e'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - rx * 0.98, y - ry + ry * 2 * lid); c.lineTo(x + rx * 0.98, y - ry + ry * 2 * lid); c.stroke(); }
    if (lash) {
      c.strokeStyle = '#2a1a2e'; c.lineWidth = 2; c.lineCap = 'round';
      for (const a of [-0.5, -0.15, 0.2]) { const px = x + Math.sin(a + 0.6) * rx, py = y - Math.cos(a + 0.6) * ry; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 3.2 + a * 2, py - 3.4); c.stroke(); }
    }
  }
  function brows(c, kind, e1, e2, ink) {
    if (!kind) return;
    c.strokeStyle = ink; c.lineCap = 'round'; c.lineWidth = kind === 'boss' ? 4.2 : 2.8;
    // [안쪽 높이, 바깥 높이] (+ 는 위로)
    const SHAPE = { firm: [-1, 1], up: [3, 3.5], worry: [3, -1.5], cocky: [0, 3], boss: [-2.5, 2], angry: [-4, 2.5], calm: [1.5, 2] }[kind];
    for (const [ex, ey, rx, ry, side] of [[...e1, -1], [...e2, 1]]) {
      const inX = ex - side * rx * 0.75, outX = ex + side * rx * 0.75, base = ey - ry - 4;
      const inY = base - SHAPE[0], outY = base - SHAPE[1] + (kind === 'cocky' && side < 0 ? 3 : 0);
      c.beginPath(); c.moveTo(inX, inY); c.quadraticCurveTo(ex, Math.min(inY, outY) - 2, outX, outY); c.stroke();
    }
  }
  function mouth(c, kind, mx, my, w, rim, t) {
    const ink = rim ? '#ffd0dc' : '#3a1020';
    c.strokeStyle = ink; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
    const openShape = (top, bottom, skew = 0) => { c.beginPath(); c.moveTo(mx - w, my + skew); c.quadraticCurveTo(mx, my + top, mx + w, my - skew); c.quadraticCurveTo(mx, my + bottom, mx - w, my + skew); c.closePath(); };
    const fillOpen = (teeth, tongue) => {
      c.fillStyle = '#6e1028'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = '#3a0a18'; c.stroke();
      c.save(); c.clip();
      if (teeth) { c.fillStyle = '#fff'; c.fillRect(mx - w, my - 4, w * 2, teeth); c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 0.8; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(mx + k * w * 0.45, my - 4); c.lineTo(mx + k * w * 0.45, my - 4 + teeth); c.stroke(); } }
      if (tongue) { ell(c, mx + w * 0.15, my + tongue, w * 0.55, w * 0.35); c.fillStyle = '#ff6f91'; c.fill(); }
      c.restore();
    };
    switch (kind) {
      case 'bigGrin': openShape(1, w * 1.35); fillOpen(5, w * 1.0); break;
      case 'grin': openShape(0, w * 0.95); fillOpen(3.8, w * 0.75); break;
      case 'teeth': openShape(-1, w * 0.7, 1); fillOpen(w * 0.9, 0); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.moveTo(mx - w * 0.9, my + w * 0.25); c.lineTo(mx + w * 0.9, my + w * 0.25); c.stroke(); break;
      case 'shout': { const k = 1 + Math.sin((t || 0) * 9) * 0.12; ell(c, mx, my + w * 0.5, w * 0.62, w * 0.75 * k); fillOpen(0, w * 1.0); break; }
      case 'sing': ell(c, mx, my + 2, w * 0.38, w * 0.48); fillOpen(0, w * 0.45); break;
      case 'buck':
        c.beginPath(); c.moveTo(mx - w, my); c.quadraticCurveTo(mx, my + w * 0.7, mx + w, my - 1); c.stroke();
        c.beginPath(); c.rect(mx - 3.6, my + w * 0.25, 3.4, 5); c.rect(mx + 0.2, my + w * 0.25, 3.4, 5); fillLine(c, '#fff', '#3a1020', 1.4); break;
      case 'tongue':
        c.beginPath(); c.moveTo(mx - w, my); c.quadraticCurveTo(mx, my + w * 0.7, mx + w, my - 1); c.stroke();
        c.beginPath(); c.moveTo(mx + w * 0.05, my + w * 0.35); c.quadraticCurveTo(mx + w * 0.3, my + w * 1.5, mx + w * 0.7, my + w * 0.2); fillLine(c, '#ff6f91', '#9d174d', 1.4); break;
      case 'smirk': c.beginPath(); c.moveTo(mx - w * 0.7, my + 1); c.quadraticCurveTo(mx + w * 0.1, my + w * 0.45, mx + w * 0.9, my - w * 0.35); c.stroke(); break;
      case 'tiny': c.beginPath(); c.arc(mx, my, w * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); break;
      default: c.beginPath(); c.moveTo(mx - w * 0.75, my); c.quadraticCurveTo(mx, my + w * 0.7, mx + w * 0.75, my); c.stroke();
    }
  }
  function face(c, sp, hx, hy, hr, mood, blink, t) {
    const f = sp.face || {}, rim = isDark(sp.head);
    const ink = rim ? '#ffffff' : '#2a1a2e';
    const rx = hr * 0.34, ry = hr * 0.44, ey = hy - hr * 0.14;
    // 3/4 옆모습: 뒤쪽 눈은 조금 작게, 짝눈 성격이면 크기 차이를 크게
    const e1 = [hx - hr * 0.22, ey + (f.odd ? 1 : 0), rx * (f.odd ? 0.78 : 0.9), ry * (f.odd ? 0.8 : 0.94)];
    const e2 = [hx + hr * 0.48, ey, rx * (f.odd ? 1.08 : 1), ry * (f.odd ? 1.06 : 1)];
    const look = mood ? 0 : Math.sin((t || 0) * 0.7 + hx) > 0.6 ? -0.6 : 1;
    const eo = { col: sp.eye, mood, blink, irisK: f.iris || 0.55, lid: mood ? 0 : f.lid || 0, lash: f.lash, skin: sp.head, ink, look };
    eye(c, ...e1, eo); eye(c, ...e2, eo);
    brows(c, mood === 'strain' ? 'angry' : mood === 'dizzy' ? 'worry' : f.brow, e1, e2, ink);
    // 볼
    for (const [x, s] of [[hx - hr * 0.55, 0.85], [hx + hr * 0.82, 1]]) {
      const k = (f.shy ? 1.35 : 1) * s, cy = hy + hr * 0.38;
      const g = c.createRadialGradient(x, cy, 0, x, cy, hr * 0.28 * k);
      g.addColorStop(0, `rgba(255,95,135,${f.shy ? 0.85 : 0.7})`); g.addColorStop(1, 'rgba(255,95,135,0)');
      c.fillStyle = g; ell(c, x, cy, hr * 0.32 * k, hr * 0.2 * k); c.fill();
    }
    if (sp.faceDots) { c.fillStyle = 'rgba(255,255,255,0.9)'; ell(c, hx - hr * 0.62, hy - hr * 0.62, hr * 0.13, hr * 0.09, -0.4); c.fill(); ell(c, hx + hr * 0.12, hy - hr * 0.74, hr * 0.11, hr * 0.08); c.fill(); }
    // 입: 기분이 성격보다 먼저
    const mk = mood === 'happy' ? (f.mouth === 'bigGrin' || f.mouth === 'shout' ? 'bigGrin' : 'grin') : mood === 'strain' ? 'teeth' : mood === 'dizzy' ? 'wavy' : f.mouth;
    const mx = hx + hr * 0.16, my = hy + hr * 0.44, w = hr * 0.42;
    if (mk === 'wavy') { c.strokeStyle = rim ? '#ffd0dc' : '#3a1020'; c.lineWidth = 2; c.beginPath(); c.moveTo(mx - w, my); for (let k = 1; k <= 4; k++) c.lineTo(mx - w + k * w * 0.5, my + (k % 2 ? -2.5 : 1.5)); c.stroke(); }
    else mouth(c, mk, mx, my, w, rim, t);
    if (mood === 'strain') {
      const dx = hx - hr * 0.95, dy = hy - hr * 0.5;
      c.beginPath(); c.moveTo(dx, dy - 6); c.quadraticCurveTo(dx + 5, dy + 1, dx, dy + 4); c.quadraticCurveTo(dx - 5, dy + 1, dx, dy - 6);
      fillLine(c, '#8fd8ff', '#3b82c4', 1.2);
    }
  }

  // ---------- 날개 ----------
  function wingsBack(c, sp, ph, fly) {
    const flap = fly ? Math.abs(Math.sin(ph * 2.2)) : 0.3;
    if (sp.wings === 'clear') {
      const b = sp.big ? 1.3 : 1;
      for (const [x, y, rx, ry, rot] of [[-16 * b, -10 - flap * 4, 14 * b, (6.5 + flap * 3) * b, -0.55], [-9 * b, -13 - flap * 5, 13 * b, (6 + flap * 3) * b, -0.95]]) {
        const g = c.createLinearGradient(x - rx, y, x + rx, y);
        g.addColorStop(0, 'rgba(186,230,253,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.92)');
        ell(c, x, y, rx, ry, rot); fillLine(c, g, 'rgba(56,90,130,0.75)', 1.6);
        c.save(); ell(c, x, y, rx, ry, rot); c.clip();
        c.strokeStyle = 'rgba(56,90,130,0.35)'; c.lineWidth = 0.9;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + rx * 0.9 * Math.cos(rot), y + rx * 0.9 * Math.sin(rot)); c.lineTo(x - rx * Math.cos(rot) + k * 3, y - rx * Math.sin(rot) + k * 4); c.stroke(); }
        c.restore();
      }
    } else if (sp.wings === 'butterfly') {
      const sy = 0.5 + 0.5 * (fly ? Math.abs(Math.cos(ph * 2)) : 0.85);
      c.save(); c.translate(-10, 4); c.scale(1, sy);
      const P1 = () => { c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(-28, -4, -30, 22, -8, 20); c.quadraticCurveTo(-2, 14, 0, 2); };
      const P2 = () => { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-4, -34, -40, -40, -36, -14); c.bezierCurveTo(-32, -2, -12, 2, 0, 0); };
      for (const P of [P1, P2]) { P(); const g = c.createRadialGradient(-8, -6, 2, -14, -10, 30); g.addColorStop(0, sp.wc2); g.addColorStop(1, sp.wc); fillLine(c, g, sp.we, 3.4); }
      c.fillStyle = sp.wd;
      if (sp.tiger) {
        c.save(); P2(); c.clip();
        for (const x of [-12, -21, -30]) { c.beginPath(); c.moveTo(x, -40); c.lineTo(x + 2.6, -40); c.lineTo(x + 6.6, 0); c.lineTo(x + 4, 0); c.fill(); }
        c.restore();
        circ(c, -14, 13, 3.4); fillLine(c, '#3b82f6', '#1e3a8a', 1.2);
        circ(c, -6, 16, 2.6); fillLine(c, '#f97316', '#7c2d12', 1.2);
      } else {
        circ(c, -26, -22, 4); c.fill(); circ(c, -17, -14, 2.8); c.fill();
        circ(c, -26, -22, 1.4); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
      }
      c.restore();
    } else if (sp.wings === 'dragon') {
      const a = fly ? Math.sin(ph * 3) * 0.28 : 0.08;
      for (const [x, rot] of [[-8, -0.38 - a], [-1, -0.12 + a]]) {
        const g = c.createLinearGradient(x - 30, 0, x, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(165,232,255,0.7)');
        ell(c, x - 14, -6, 20, 5.5, rot); fillLine(c, g, 'rgba(14,116,144,0.75)', 1.4);
        c.save(); ell(c, x - 14, -6, 20, 5.5, rot); c.clip();
        c.strokeStyle = 'rgba(14,116,144,0.3)'; c.lineWidth = 0.8;
        for (let k = -30; k < 6; k += 5) { c.beginPath(); c.moveTo(x + k, -15); c.lineTo(x + k + 3, 5); c.stroke(); }
        c.restore();
      }
    }
  }

  // ---------- 등급 장식 ----------
  // 뒤쪽: 기운(오라) · 빛살 · 망토
  function decoBack(c, rar, t) {
    if (rar !== 'hero' && rar !== 'legend') return;
    const legend = rar === 'legend', pulse = 0.85 + Math.sin(t * 3) * 0.15;
    const g = c.createRadialGradient(0, -4, 4, 0, -4, 46 * pulse);
    g.addColorStop(0, legend ? 'rgba(255,236,150,0.75)' : 'rgba(200,150,255,0.6)');
    g.addColorStop(1, legend ? 'rgba(255,200,60,0)' : 'rgba(168,85,247,0)');
    c.fillStyle = g; circ(c, 0, -4, 46 * pulse); c.fill();
    if (legend) {
      c.save(); c.translate(0, -6); c.rotate(t * 0.5);
      for (let i = 0; i < 12; i++) {
        c.rotate(Math.PI / 6);
        const lg = c.createLinearGradient(0, 0, 50, 0); lg.addColorStop(0, 'rgba(255,220,90,0.55)'); lg.addColorStop(1, 'rgba(255,220,90,0)');
        c.fillStyle = lg; c.beginPath(); c.moveTo(0, 0); c.lineTo(52, -4); c.lineTo(52, 4); c.closePath(); c.fill();
      }
      c.restore();
    }
    // 망토: 목에서 뒤로 휘날려요
    const wave = Math.sin(t * 4) * 3, base = legend ? '#d62839' : '#7c3aed', inner = legend ? '#ffcf3f' : '#c4b5fd';
    c.beginPath(); c.moveTo(2, -2);
    c.quadraticCurveTo(-14, -6 + wave, -34, 2 + wave);
    c.quadraticCurveTo(-30, 10 + wave * 0.6, -36, 18 + wave);
    c.quadraticCurveTo(-18, 18, -2, 10); c.closePath();
    const cg = c.createLinearGradient(-34, 0, 2, 0); cg.addColorStop(0, shade(base, -0.25)); cg.addColorStop(1, shade(base, 0.15));
    fillLine(c, cg, shade(base, -0.6), 2.4);
    c.strokeStyle = inner; c.lineWidth = 2; c.beginPath(); c.moveTo(-34, 2 + wave); c.quadraticCurveTo(-30, 10 + wave * 0.6, -36, 18 + wave); c.stroke();
    if (!legend) { star(c, -18, 7 + wave * 0.5, 4.6, -Math.PI / 2, 5, 0.45); fillLine(c, '#fde047', '#a16207', 1.2); }
  }
  // 앞쪽: 목도리 · 머리띠 · 왕관 · 후광 · 반짝이
  function decoFront(c, rar, t, hx, hy, hr) {
    if (rar === 'rare') {
      // 하늘색 목도리 (꼬리가 팔랑팔랑)
      const w = Math.sin(t * 5) * 2.5;
      c.beginPath(); c.moveTo(hx - hr * 0.7, hy + hr * 0.78); c.quadraticCurveTo(hx, hy + hr * 1.12, hx + hr * 0.62, hy + hr * 0.82);
      c.lineTo(hx + hr * 0.55, hy + hr * 1.05); c.quadraticCurveTo(hx, hy + hr * 1.35, hx - hr * 0.72, hy + hr * 1.0); c.closePath();
      fillLine(c, ball(c, '#38bdf8', hx, hy + hr, hr), '#075985', 2);
      c.beginPath(); c.moveTo(hx - hr * 0.6, hy + hr * 0.95); c.quadraticCurveTo(hx - hr * 1.1, hy + hr * 1.1 + w, hx - hr * 1.45, hy + hr * 0.95 + w);
      c.lineTo(hx - hr * 1.35, hy + hr * 1.3 + w); c.quadraticCurveTo(hx - hr * 1.0, hy + hr * 1.3, hx - hr * 0.5, hy + hr * 1.1); c.closePath();
      fillLine(c, '#7dd3fc', '#075985', 1.8);
    }
    if (rar === 'hero') {
      // 영웅 머리띠 (매듭 끈이 휘날려요)
      const w = Math.sin(t * 6) * 2.5;
      c.save(); circ(c, hx, hy, hr + 0.5); c.clip();
      c.beginPath(); c.moveTo(hx - hr - 2, hy - hr * 0.62); c.quadraticCurveTo(hx, hy - hr * 0.86, hx + hr + 2, hy - hr * 0.6);
      c.lineTo(hx + hr + 2, hy - hr * 0.38); c.quadraticCurveTo(hx, hy - hr * 0.62, hx - hr - 2, hy - hr * 0.38); c.closePath();
      fillLine(c, '#ef4444', '#7f1d1d', 2);
      c.restore();
      const kx = hx - hr * 0.95, ky = hy - hr * 0.5;
      for (const [dy, len] of [[-2, 1], [3, 0.8]]) {
        c.beginPath(); c.moveTo(kx, ky); c.quadraticCurveTo(kx - 8, ky + dy + w, kx - 16 * len, ky + dy * 2 + w * 1.4);
        c.lineTo(kx - 15 * len, ky + dy * 2 + 4 + w * 1.4); c.quadraticCurveTo(kx - 7, ky + dy + 4 + w, kx, ky + 3); c.closePath();
        fillLine(c, '#f87171', '#7f1d1d', 1.6);
      }
      circ(c, kx, ky + 1.5, 3); fillLine(c, '#dc2626', '#7f1d1d', 1.6);
      // 보랏빛 별이 빙글빙글
      for (let i = 0; i < 4; i++) {
        const a = t * 1.8 + i * Math.PI / 2, ox = Math.cos(a) * 34, oy = -4 + Math.sin(a) * 12;
        const s = 2.6 + Math.sin(t * 5 + i) * 0.8;
        star(c, ox, oy, s * 1.6, t * 2 + i); c.fillStyle = Math.sin(a) > 0 ? '#e9d5ff' : '#c084fc'; c.fill();
      }
    }
    if (rar === 'legend') {
      // 후광
      const hy2 = hy - hr - 9 + Math.sin(t * 2.5) * 1.2;
      c.save(); c.shadowColor = '#ffd84d'; c.shadowBlur = 8;
      ell(c, hx - 1, hy2, 13, 3.6); c.lineWidth = 3.4; c.strokeStyle = '#ffe680'; c.stroke();
      c.restore();
      ell(c, hx - 1, hy2, 13, 3.6); c.lineWidth = 1.2; c.strokeStyle = '#fff8d0'; c.stroke();
      // 왕관
      c.save(); c.translate(hx - hr * 0.1, hy - hr * 0.78); c.rotate(-0.18);
      c.beginPath(); c.moveTo(-10, 2); c.lineTo(-11, -9); c.lineTo(-5, -3); c.lineTo(0, -12); c.lineTo(5, -3); c.lineTo(11, -9); c.lineTo(10, 2); c.closePath();
      const gg = c.createLinearGradient(0, -12, 0, 2); gg.addColorStop(0, '#fff3a3'); gg.addColorStop(0.5, '#ffcc33'); gg.addColorStop(1, '#d48806');
      fillLine(c, gg, '#8a5a00', 1.8);
      for (const [x, y, col] of [[0, -3, '#ef4444'], [-6, -1, '#3b82f6'], [6, -1, '#22c55e']]) { circ(c, x, y, 1.9); fillLine(c, col, '#5b3a00', 0.8); }
      for (const [x, y] of [[-11, -9], [0, -12], [11, -9]]) { circ(c, x, y, 1.6); c.fillStyle = '#fff8d0'; c.fill(); }
      c.restore();
    }
    // 반짝이 · 빛 알갱이
    const n = { rare: 3, legend: 7 }[rar] || 0;
    for (let i = 0; i < n; i++) {
      const ph = t * (1.2 + i * 0.13) + i * 2.1, k = (Math.sin(ph) + 1) / 2;
      const ang = i * 2.39, R = rar === 'legend' ? 30 + (i % 3) * 7 : 30;
      const x = Math.cos(ang) * R, y = -6 + Math.sin(ang) * R * 0.7 - (rar === 'legend' ? ((t * 10 + i * 9) % 20) : 0);
      star(c, x, y, (rar === 'legend' ? 4.2 : 3.4) * (0.35 + k * 0.75), ph * 0.3);
      c.fillStyle = rar === 'legend' ? (i % 2 ? '#fff6c2' : '#ffd84d') : '#bae6fd'; c.fill();
    }
  }

  // ---------- 전체 그리기 ----------
  function draw(c, type, x, y, size, o = {}) {
    const sp = SPEC[type] || SPEC.ant, ph = o.phase || 0, mood = o.mood, live = o.time != null, t = live ? o.time : 0;
    const rar = o.deco === false ? 'common' : o.rarity || rarityOf(type);
    const seed = type.length * 1.7;
    const blink = live && !mood && ((t + seed) % 3.6) < 0.13;
    const breathe = live ? Math.sin(t * 3 + seed) * 0.035 : 0;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.flip) c.scale(-1, 1);
    const k = size / 50 * (sp.small ? 0.94 : 1); c.scale(k, k);
    if (o.shadow !== false) {
      const g = c.createRadialGradient(0, 21, 2, 0, 21, 26);
      g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ell(c, -2, 21, 26, 5); c.fillStyle = g; c.fill();
    }
    if (o.fly) c.translate(0, -5 + Math.sin(ph * 1.5) * 2.5);
    c.translate(0, 18); c.scale(1 - breathe * 0.5, 1 + breathe); c.translate(0, -18);
    c.lineJoin = 'round';
    decoBack(c, rar, t);
    wingsBack(c, sp, ph, o.fly);
    // 머리가 몸보다 커요 (만화 캐릭터 비율)
    const hx = 7, hy = -9;
    let hr = 17;

    if (sp.kind === 'ant') {
      legs(c, [-14, -7, 0], 10, ph, sp.col, 9);
      blob(c, sp.col, -21, 6, 10.5, 9);
      c.strokeStyle = shade(sp.col, -0.3); c.lineWidth = 1.4;
      for (const sx of [-24, -18]) { c.beginPath(); c.arc(sx, 6, 8.5, -1.1, 1.1); c.stroke(); }
      blob(c, sp.col2, -8, 9, 5.5, 4.5);
    } else if (sp.kind === 'beetle') {
      legs(c, [-17, -9, -1], 11, ph, sp.col, 9);
      if (sp.glow) {
        const pulse = 0.6 + 0.4 * Math.sin((live ? t * 4 : 1) + seed);
        const gr = c.createRadialGradient(-24, 8, 1, -24, 8, 22);
        gr.addColorStop(0, `rgba(255,236,120,${0.95 * pulse})`); gr.addColorStop(1, 'rgba(255,236,120,0)');
        c.fillStyle = gr; circ(c, -24, 8, 22); c.fill();
        blob(c, '#ffe45c', -22, 9, 7, 6);
      }
      c.beginPath(); c.ellipse(-10, 8, 16, 15, 0, Math.PI, 0); c.quadraticCurveTo(6, 15, -10, 16); c.quadraticCurveTo(-26, 15, -26, 8); c.closePath();
      fillLine(c, ball(c, sp.col, -10, 3, 16), line(sp.col), 2.8);
      c.save(); c.clip();
      c.fillStyle = 'rgba(40,10,30,0.18)'; ell(c, -8, 17, 20, 7); c.fill();
      if (sp.spots) { c.fillStyle = sp.spots; for (const [sx, sy, r] of [[-18, 2, 3.6], [-4, 0, 3.4], [-12, 10, 3], [0, 9, 2.6], [-22, 11, 2.2], [-10, -4, 2.4]]) { circ(c, sx, sy, r); c.fill(); } }
      c.restore();
      c.strokeStyle = line(sp.col); c.lineWidth = 1.8; c.beginPath(); c.moveTo(-9, -6); c.quadraticCurveTo(-7, 5, -10, 15); c.stroke();
      ell(c, -16, -1, 6, 2.6, -0.5); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      hr = 16.5;
    } else if (sp.kind === 'long') {
      if (sp.hind) {
        const kick = Math.sin(ph) * 2;
        ell(c, -19, 0 + kick * 0.5, 10, 5, -0.75); fillLine(c, ball(c, sp.col, -19, 0, 10), line(sp.col), 2.4);
        c.strokeStyle = line(sp.col); c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-25, -6 + kick); c.lineTo(-31, 14); c.stroke();
        c.strokeStyle = shade(sp.col, -0.15); c.lineWidth = 2.8; c.stroke();
        ell(c, -30, 15, 3.8, 2.6); fillLine(c, shade(sp.col, -0.15), line(sp.col), 1.4);
      }
      legs(c, sp.hind ? [-9, -1] : [-17, -9, -1], 11, ph, sp.col, 9);
      blob(c, sp.col, -13, 7, 15, 7.5);
      c.save(); ell(c, -13, 7, 15, 7.5); c.clip(); c.fillStyle = shade(sp.col2, 0, 0.7); ell(c, -13, 13, 16, 4); c.fill(); c.restore();
      c.strokeStyle = shade(sp.col, -0.3); c.lineWidth = 1.2;
      for (const sx of [-22, -16, -10]) { c.beginPath(); c.moveTo(sx, 1); c.quadraticCurveTo(sx + 2, 7, sx, 13); c.stroke(); }
      hr = 16;
    } else if (sp.kind === 'round') {
      legs(c, [-17, -10, -3], 13, ph, sp.col, 8);
      if (sp.sting) { c.beginPath(); c.moveTo(-23, 5); c.lineTo(-31, 9); c.lineTo(-23, 13); c.closePath(); fillLine(c, '#4a4252', '#1f1a24', 1.8); }
      const bx = -11, by = 8, rx = sp.big ? 15 : 13.5, ry = sp.big ? 12 : 11;
      ell(c, bx, by, rx, ry); fillLine(c, ball(c, sp.col, bx, by, rx), line(sp.col), 2.6);
      c.save(); ell(c, bx, by, rx, ry); c.clip();
      if (sp.stripes) { c.fillStyle = sp.stripes; for (const sx of [-20, -12]) { c.beginPath(); c.ellipse(sx, by, 3, 14, 0.15, 0, 7); c.fill(); } }
      if (sp.ridges) { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.4; for (const sy of [2, 8, 14]) { c.beginPath(); c.moveTo(bx - rx, sy); c.quadraticCurveTo(bx, sy + 3, bx + rx, sy); c.stroke(); } }
      c.fillStyle = 'rgba(40,10,30,0.16)'; ell(c, bx + 2, by + 10, rx * 1.1, 6); c.fill();
      c.restore();
      ell(c, bx - 5, by - 5, 5, 2.4, -0.4); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
    } else if (sp.kind === 'slim') {
      legs(c, [-13, -8, -3], 12, ph, sp.col, 8);
      blob(c, sp.col, -12, 9, 11, 5.5);
      c.strokeStyle = shade(sp.col, 0.3); c.lineWidth = 1;
      for (const sx of [-18, -13, -8]) { c.beginPath(); c.moveTo(sx, 5); c.lineTo(sx, 13); c.stroke(); }
      hr = 16;
    } else if (sp.kind === 'dragon') {
      legs(c, [-9, -3], 12, ph, sp.col, 8);
      for (let s = 5; s >= 0; s--) { const r = 3.4 + s * 0.15; const cx = -38 + s * 5.2; circ(c, cx, 7 - Math.sin(s * 0.5 + ph * 0.5) * 0.8, r); fillLine(c, ball(c, s % 2 ? sp.col : sp.col2, cx, 7, r), line(sp.col), 1.8); }
      blob(c, sp.col, -8, 7, 8, 7);
    }
    if (sp.fluff) {
      c.fillStyle = sp.fluff; c.strokeStyle = shade(sp.col, -0.4); c.lineWidth = 1.6;
      const puffs = [[-4, -1], [-6, 5], [-4, 11], [0, 14], [4, 15]];
      for (const [px, py] of puffs) { circ(c, px, py, 4.4); c.fill(); c.stroke(); }
      for (const [px, py] of puffs) { circ(c, px, py, 3.2); c.fill(); }
    }
    if (sp.arms) {
      c.lineCap = 'round';
      for (const [w, col] of [[6.4, line(sp.col)], [4, sp.col]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(0, 6); c.lineTo(10, 15); c.lineTo(19, 7); c.stroke(); }
      c.strokeStyle = sp.col2; c.lineWidth = 1.4;
      for (let s = 0; s < 3; s++) { c.beginPath(); c.moveTo(11 + s * 2.4, 13 - s * 2.6); c.lineTo(9.5 + s * 2.4, 11 - s * 2.6); c.stroke(); }
    }

    // 머리
    if (sp.tri) {
      c.beginPath();
      c.moveTo(hx - hr * 0.95, hy - hr * 0.5);
      c.quadraticCurveTo(hx + hr * 0.1, hy - hr * 1.2, hx + hr * 1.12, hy - hr * 0.45);
      c.quadraticCurveTo(hx + hr * 0.95, hy + hr * 0.75, hx + hr * 0.1, hy + hr * 0.98);
      c.quadraticCurveTo(hx - hr * 0.75, hy + hr * 0.75, hx - hr * 0.95, hy - hr * 0.5);
      fillLine(c, ball(c, sp.head, hx, hy, hr), line(sp.head), 3);
    } else {
      circ(c, hx, hy, hr); fillLine(c, ball(c, sp.head, hx, hy, hr), line(sp.head), 3);
      c.save(); circ(c, hx, hy, hr); c.clip(); ell(c, hx + hr * 0.15, hy + hr * 0.8, hr * 1.1, hr * 0.5); c.fillStyle = 'rgba(30,10,40,0.14)'; c.fill(); c.restore();
    }
    ell(c, hx - hr * 0.38, hy - hr * 0.62, hr * 0.3, hr * 0.13, -0.4); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    if (sp.horn) {
      c.beginPath(); c.moveTo(hx + hr * 0.1, hy - hr * 0.88); c.quadraticCurveTo(hx + hr * 0.95, hy - hr * 1.0, hx + hr * 1.05, hy - hr * 1.95);
      c.quadraticCurveTo(hx + hr * 1.35, hy - hr * 1.7, hx + hr * 1.2, hy - hr * 1.38);
      c.quadraticCurveTo(hx + hr * 1.12, hy - hr * 0.55, hx + hr * 0.68, hy - hr * 0.5); c.closePath();
      fillLine(c, ball(c, '#9a3c14', hx + hr, hy - hr * 1.3, hr), '#3a1406', 2.4);
      ell(c, hx + hr * 0.88, hy - hr * 1.15, hr * 0.1, hr * 0.28, 0.4); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    }
    if (sp.jaws) {
      for (const [y0, cy, ty] of [[-0.3, -0.95, -0.5], [0.4, 1.0, 0.45]]) {
        c.beginPath(); c.moveTo(hx + hr * 0.8, hy + hr * y0 - 2.5);
        c.quadraticCurveTo(hx + hr * 1.5, hy + hr * cy, hx + hr * 1.75, hy + hr * ty);
        c.quadraticCurveTo(hx + hr * 1.38, hy + hr * (cy * 0.55), hx + hr * 0.85, hy + hr * y0 + 2.5); c.closePath();
        fillLine(c, ball(c, '#7a5232', hx + hr * 1.4, hy + hr * cy, hr), '#25170c', 2.2);
      }
    }
    if (sp.shovel) {
      c.beginPath(); c.moveTo(hx - hr * 0.55, hy - hr * 0.8);
      for (let s = 0; s < 4; s++) { c.lineTo(hx - hr * 0.32 + s * hr * 0.38, hy - hr * 1.15); c.lineTo(hx - hr * 0.13 + s * hr * 0.38, hy - hr * 0.88); }
      c.closePath(); fillLine(c, ball(c, '#4a5068', hx, hy - hr, hr), '#161925', 2);
    }
    antennae(c, sp, hx, hy, hr, ph);
    face(c, sp, hx, hy, hr, mood, blink, t);
    // 노래하는 귀뚜라미의 음표
    if (sp.face && sp.face.note && live && !mood) {
      const k2 = (t * 0.6) % 1, nx = hx + hr * 1.1 + k2 * 8, ny = hy - k2 * 18;
      c.globalAlpha = 1 - k2; c.font = 'bold 13px sans-serif'; c.fillStyle = '#7c3aed'; c.fillText('♪', nx, ny); c.globalAlpha = 1;
    }
    decoFront(c, rar, t, hx, hy, hr);
    c.restore();
  }

  // 카드·목록용 그림 (dataURL, 한 번 만들면 다시 써요). 장식이 머리 위로 올라가서 조금 작게 그려요.
  const cache = {};
  function portrait(type, px = 96, mood) {
    const key = `${type}:${px}:${mood || ''}`;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
    const c = cv.getContext('2d'); c.scale(2, 2);
    const sp = SPEC[type] || SPEC.ant, rar = rarityOf(type);
    const k = rar === 'legend' || rar === 'hero' ? 0.56 : sp.horn || sp.longAnt ? 0.6 : 0.66;
    draw(c, type, px * 0.54, px * (rar === 'legend' ? 0.66 : 0.62), px * k, { phase: 0.6, mood, time: 0.35, shadow: true });
    return (cache[key] = cv.toDataURL());
  }

  return { draw, portrait, SPEC };
})();
