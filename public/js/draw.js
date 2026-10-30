// 귀여운 곤충 캐릭터 그리기 (그림 파일 없이 캔버스로 그려요)
// 두 다리로 서 있는 의인화 캐릭터: 큰 머리 · 몸통 · 두 팔(동그란 손) · 두 다리(동그란 신발)
// 아주 가는 외곽선 + 여러 겹 그라데이션(하이라이트 · 반사광 · 그늘)으로 입체감을 줘요.
// 곤충마다 성격이 얼굴에 드러나고(눈썹·눈꺼풀·입), 등급이 높을수록 화려해요:
//   일반(없음) → 희귀(목도리 + 반짝이) → 영웅(머리띠 + 별 망토 + 보랏빛 기운) → 전설(왕관 + 후광 + 황금 빛살 + 빛 알갱이)
// BugArt.draw(ctx, 종류, x, y, 크기, { flip, rot, phase, mood, pose, fly, time, shadow, deco })
//   (x, y): 발 조금 위 · 크기: 대략 키(px) · phase: 걷기·날개 움직임 · mood: happy | dizzy | strain
//   pose: stand(기본) | run | push | pull | balance | cheer | climb | hang | fly · time: 초(숨쉬기·깜빡임·반짝이)
window.BugArt = (() => {
  'use strict';
  // kind: beetle(딱정벌레: 등딱지) · ant(개미: 엉덩이 배) · long(메뚜기: 긴 배) · round(벌: 동글 몸) · slim(나비) · dragon(잠자리: 구슬 꼬리)
  // 성격(face): brow 눈썹 · lid 눈꺼풀 · lash 속눈썹 · mouth 입 · iris 눈동자 크기 · odd 짝눈
  const SPEC = {
    ant: { kind: 'ant', col: '#b0643a', col2: '#f0b088', head: '#bb6f41', eye: '#4a2410', tip: '#ff8a1f',
      face: { brow: 'firm', mouth: 'grin', iris: 0.55 } },                       // 부지런한 일꾼
    ladybug: { kind: 'beetle', col: '#ff3d3d', col2: '#3a3f4f', head: '#2c3040', eye: '#e11d48', tip: '#ff3d3d', spots: '#1f2430', faceDots: true,
      face: { lash: true, mouth: 'smile', iris: 0.62 } },                      // 상냥한 친구
    bee: { kind: 'round', col: '#ffd02e', col2: '#fff3b0', head: '#ffc928', eye: '#6b3e00', tip: '#ffd02e', stripes: '#3a3340', wings: 'clear', sting: true, fluff: '#fff7d6',
      face: { brow: 'up', mouth: 'bigGrin', iris: 0.5 } },                     // 신나는 수다쟁이
    grasshopper: { kind: 'long', col: '#7cc242', col2: '#d4f58a', head: '#8fd14f', eye: '#14532d', tip: '#d4f58a', thigh: true,
      face: { mouth: 'buck', iris: 0.45, odd: true } },                        // 장난꾸러기
    cricket: { kind: 'long', col: '#9a6230', col2: '#e8b878', head: '#a86d37', eye: '#3b1d0e', tip: '#e0ad6a', thigh: true, longAnt: true,
      face: { lid: 0.3, mouth: 'sing', iris: 0.5, note: true } },              // 노래하는 음악가
    butterfly: { kind: 'slim', col: '#7280a3', col2: '#dfe5ff', head: '#8592b5', eye: '#4338ca', tip: '#a5b4fc', wings: 'butterfly', wc: '#ffffff', wc2: '#e0e7ff', we: '#8fa0c7', wd: '#4b5677',
      face: { lash: true, brow: 'worry', mouth: 'tiny', iris: 0.66, shy: true } }, // 수줍음쟁이
    firefly: { kind: 'beetle', col: '#3d4a63', col2: '#ffb27a', head: '#ff9147', eye: '#7c2d12', tip: '#ffe45c', glow: true, small: true,
      face: { lid: 0.5, mouth: 'smile', iris: 0.55 } },                        // 졸린 밤 친구
    dragonfly: { kind: 'dragon', col: '#29b6f6', col2: '#c8f1ff', head: '#4fc3f7', eye: '#1d4ed8', tip: '#a5e8ff', wings: 'dragon',
      face: { brow: 'cocky', mouth: 'smirk', iris: 0.62 } },                   // 자신만만 스피드왕
    dungbeetle: { kind: 'beetle', col: '#3a3f52', col2: '#6b7391', head: '#2f3446', eye: '#7c3aed', tip: '#a78bfa', shovel: true,
      face: { mouth: 'tongue', iris: 0.5, odd: true } },                       // 힘센 개구쟁이
    mantis: { kind: 'long', col: '#2fbf5b', col2: '#b8f5cd', head: '#3fd06a', eye: '#15803d', tip: '#a7f3c0', scythe: true, tri: true,
      face: { brow: 'cocky', lid: 0.42, mouth: 'smirk', iris: 0.5 } },        // 쿨한 무술 고수
    cicada: { kind: 'round', col: '#6f6a5c', col2: '#cfc8b0', head: '#6aa33a', eye: '#b91c1c', tip: '#bdb59c', wings: 'clear', big: true, ridges: true,
      face: { brow: 'up', mouth: 'shout', iris: 0.42 } },                      // 목청 큰 가수
    rhino: { kind: 'beetle', col: '#a5401a', col2: '#e8803f', head: '#7a2e10', eye: '#b45309', tip: '#ffb35c', horn: true,
      face: { brow: 'boss', mouth: 'bigGrin', iris: 0.5 } },                   // 숲속 대장
    stag: { kind: 'beetle', col: '#5e4029', col2: '#a8805a', head: '#4d3322', eye: '#c2410c', tip: '#d6a46c', jaws: true,
      face: { brow: 'angry', mouth: 'teeth', iris: 0.48 } },                   // 터프한 승부사
    swallowtail: { kind: 'slim', col: '#2d3446', col2: '#5b6476', head: '#3a4256', eye: '#0ea5e9', tip: '#fde047', wings: 'butterfly', wc: '#ffe14d', wc2: '#fff8c4', we: '#272c3a', wd: '#272c3a', tiger: true,
      face: { lash: true, brow: 'calm', mouth: 'smile', iris: 0.62 } },        // 우아한 숲의 여왕
  };
  const rarityOf = type => (window.BugData && window.BugData.INSECTS[type] && window.BugData.INSECTS[type].rarity) || 'common';
  const LW = 0.85;          // 아주 가는 외곽선
  const GROUND = 22;        // 발바닥 높이

  // ---------- 색 도우미 ----------
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(hex, f, a = 1) { // f > 0 밝게, f < 0 어둡게
    const [r, g, b] = rgb(hex), t = f < 0 ? 0 : 255, p = Math.abs(f);
    return `rgba(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)},${a})`;
  }
  const line = base => shade(base, -0.6, 0.9);
  const isDark = hex => { const [r, g, b] = rgb(hex); return r * 0.3 + g * 0.59 + b * 0.11 < 90; };
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  const E = (c, x, y, rx, ry, rot = 0) => () => ell(c, x, y, rx, ry, rot);
  function fillLine(c, fill, stroke, lw = LW) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }

  // 입체 덩어리: 4단 그라데이션 + 부드러운 반짝임 + 아래쪽 반사광 + 아주 가는 외곽선
  function vol(c, path, base, cx, cy, r, gloss = 0.75) {
    path();
    const g = c.createRadialGradient(cx - r * 0.38, cy - r * 0.48, r * 0.04, cx, cy, r * 1.25);
    g.addColorStop(0, shade(base, 0.62)); g.addColorStop(0.32, shade(base, 0.2)); g.addColorStop(0.72, base); g.addColorStop(1, shade(base, -0.42));
    c.fillStyle = g; c.fill();
    c.save(); path(); c.clip();
    const rg = c.createRadialGradient(cx + r * 0.75, cy + r * 0.85, 0, cx + r * 0.75, cy + r * 0.85, r * 0.85);
    rg.addColorStop(0, 'rgba(255,255,255,0.32)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg; c.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    if (gloss) {
      const sx = cx - r * 0.36, sy = cy - r * 0.5;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, r * 0.5);
      sg.addColorStop(0, `rgba(255,255,255,${gloss})`); sg.addColorStop(0.5, `rgba(255,255,255,${gloss * 0.3})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sg; c.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    }
    c.restore();
    path(); c.lineWidth = LW; c.strokeStyle = line(base); c.stroke();
  }
  function star(c, x, y, r, rot = 0, pts = 4, inner = 0.38) {
    c.beginPath();
    for (let i = 0; i < pts * 2; i++) { const a = rot + i * Math.PI / pts, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }

  // ---------- 팔 · 다리 (둥근 관절 · 입체 그라데이션) ----------
  // 어깨/엉덩이 → 팔꿈치/무릎 → 손/발. 두께 w, 바깥쪽 가는 외곽선
  function limb(c, pts, w, base, back) {
    const col = back ? shade(base, -0.22) : base;
    const [a, b, d] = pts;
    const path = () => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    path(); c.lineWidth = w + LW * 2; c.strokeStyle = line(base); c.stroke();
    const g = c.createLinearGradient(a[0] - w, a[1] - w, a[0] + w, a[1] + w);
    g.addColorStop(0, shade(col, 0.35)); g.addColorStop(1, shade(col, -0.2));
    path(); c.lineWidth = w; c.strokeStyle = g; c.stroke();
    path(); c.lineWidth = w * 0.28; c.strokeStyle = 'rgba(255,255,255,0.28)'; c.save(); c.translate(-w * 0.22, -w * 0.22); c.stroke(); c.restore();
  }
  const bend = (p, ang, len) => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];
  // ang: 0 = 아래, + 는 앞(오른쪽)
  function arm(c, sp, sh, ang, elbow, back, t) {
    const L = 6.2, e = bend(sh, ang, L), h = bend(e, ang + elbow, L);
    limb(c, [sh, e, h], 3.6, sp.col, back);
    if (sp.scythe && !back) {
      // 사마귀: 낫 모양 손
      c.beginPath(); c.moveTo(h[0] - 1, h[1] - 1); c.quadraticCurveTo(h[0] + 7, h[1] - 6, h[0] + 9, h[1] + 2); c.quadraticCurveTo(h[0] + 5, h[1] - 1, h[0] + 1, h[1] + 2); c.closePath();
      vol(c, () => { c.beginPath(); c.moveTo(h[0] - 1, h[1] - 1); c.quadraticCurveTo(h[0] + 7, h[1] - 6, h[0] + 9, h[1] + 2); c.quadraticCurveTo(h[0] + 5, h[1] - 1, h[0] + 1, h[1] + 2); c.closePath(); }, sp.col2, h[0] + 4, h[1], 6, 0.5);
      return;
    }
    vol(c, E(c, h[0], h[1], 2.9, 2.9), back ? shade(sp.col2, -0.15) : sp.col2, h[0], h[1], 3, 0.8);
  }
  function leg(c, sp, hip, ang, knee, back) {
    const L = 6.6, k = bend(hip, ang, L), f = bend(k, ang - knee, L);
    limb(c, [hip, k, f], sp.thigh ? 4.6 : 4, sp.col, back);
    if (sp.thigh) vol(c, E(c, (hip[0] + k[0]) / 2, (hip[1] + k[1]) / 2, 3.6, 5.2, -ang), back ? shade(sp.col, -0.2) : sp.col, (hip[0] + k[0]) / 2, (hip[1] + k[1]) / 2, 5, 0.5);
    // 동그란 신발
    const boot = back ? shade(sp.col, -0.5) : shade(sp.col, -0.35);
    vol(c, E(c, f[0] + 2.2, f[1] + 0.6, 4.4, 2.8), boot, f[0] + 2.2, f[1], 4.4, 0.6);
  }
  // 자세별 팔·다리 각도
  function poseOf(pose, ph, t) {
    const s = Math.sin(ph), idle = Math.sin(t * 2) * 0.06;
    switch (pose) {
      case 'run': return { lean: 0.12, legs: [s * 0.75, -s * 0.75], knees: [Math.max(0, -s) * 1.1 + 0.2, Math.max(0, s) * 1.1 + 0.2], arms: [-s * 0.9, s * 0.9], elbows: [-0.9, -0.9] };
      case 'push': return { lean: 0.2, legs: [s * 0.5 - 0.2, -s * 0.5 - 0.2], knees: [0.5, 0.5], arms: [1.5, 1.35], elbows: [0.1, 0.1] };
      case 'pull': return { lean: -0.18, legs: [0.35, -0.1], knees: [0.4, 0.2], arms: [1.35 + s * 0.08, 1.25 + s * 0.08], elbows: [0.2, 0.2] };
      case 'balance': return { lean: 0, legs: [0.08, -0.08], knees: [0.1, 0.1], arms: [1.5 + s * 0.1, -1.5 + s * 0.1], elbows: [0.2, -0.2] };
      case 'cheer': return { lean: 0, legs: [0.15, -0.15], knees: [0.2, 0.2], arms: [1.9 + s * 0.08, -2.2], elbows: [0.5, -0.3] };
      case 'climb': return { lean: 0, legs: [0.3 + s * 0.3, -0.2 - s * 0.3], knees: [0.9, 0.9], arms: [2.1 + s * 0.2, -2.3 - s * 0.2], elbows: [0.5, -0.4] };
      case 'hang': return { lean: 0, legs: [0.15 + s * 0.15, -0.15 + s * 0.15], knees: [0.2, 0.3], arms: [2.15, -2.35], elbows: [0.55, -0.45] };
      case 'fly': return { lean: 0.1, legs: [0.4 + s * 0.15, 0.2 - s * 0.15], knees: [0.9, 0.9], arms: [0.5 + s * 0.2, -0.3 + s * 0.2], elbows: [-0.8, -0.8] };
      default: return { lean: 0, legs: [0.06, -0.06], knees: [0.05, 0.05], arms: [0.22 + idle, -0.25 - idle], elbows: [0.15, -0.12] };
    }
  }

  // ---------- 더듬이 ----------
  function antennae(c, sp, hx, hy, hr, ph) {
    const L = sp.longAnt ? 26 : 13, wob = Math.sin(ph * 0.7) * 1.6;
    [[-hr * 0.38, -7], [hr * 0.22, 6]].forEach(([dx, tip], k) => {
      const sx = hx + dx, sy = hy - hr * 0.86, ex = hx + dx + tip + wob * (k ? 1 : -1), ey = sy - L;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + (ex - sx) * 0.1 - 4, sy - L * 0.7, ex, ey);
      c.lineWidth = 2.2 + LW * 2; c.strokeStyle = line(sp.head); c.stroke();
      c.lineWidth = 2.2; c.strokeStyle = shade(sp.head, -0.1); c.stroke();
      if (!sp.longAnt) vol(c, E(c, ex, ey, 3.6, 3.6), sp.tip, ex, ey, 3.6, 0.9);
    });
  }

  // ---------- 얼굴 (크고 하얀 눈 + 큼직한 입) ----------
  function eye(c, x, y, rx, ry, o) {
    const { col, mood, blink, irisK, lid, lash, skin, ink, look } = o;
    if (mood === 'dizzy') {
      ell(c, x, y, rx, ry); fillLine(c, '#fff', '#2a1a2e', 1);
      c.strokeStyle = '#2a1a2e'; c.lineWidth = 1.3; c.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) { const r = a / (Math.PI * 4) * rx * 0.85; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; a ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke(); return;
    }
    if (mood === 'happy' || mood === 'strain' || blink) {
      c.strokeStyle = ink; c.lineWidth = 1.9; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (mood === 'strain') { c.moveTo(x - rx * 0.8, y - ry * 0.5); c.lineTo(x + rx * 0.5, y); c.lineTo(x - rx * 0.8, y + ry * 0.5); }
      else if (mood === 'happy') c.arc(x, y + ry * 0.4, rx * 0.95, Math.PI * 1.12, Math.PI * 1.88);
      else { c.moveTo(x - rx, y + 1); c.quadraticCurveTo(x, y + ry * 0.5, x + rx, y + 1); }
      c.stroke(); return;
    }
    // 흰자(아래로 살짝 그늘) → 눈동자(3단) → 동공 → 하이라이트 2개
    ell(c, x, y, rx, ry);
    const wg = c.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, ry * 1.1);
    wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.7, '#f4f6fb'); wg.addColorStop(1, '#cdd3e2');
    fillLine(c, wg, 'rgba(42,26,46,0.85)', 0.9);
    c.save(); ell(c, x, y, rx, ry); c.clip();
    const ir = rx * irisK * 1.25, ix = x + rx * 0.22 * look, iy = y + ry * 0.08;
    const ig = c.createRadialGradient(ix, iy + ir * 0.4, ir * 0.1, ix, iy, ir);
    ig.addColorStop(0, shade(col, 0.55)); ig.addColorStop(0.55, col); ig.addColorStop(1, shade(col, -0.55));
    circ(c, ix, iy, ir); c.fillStyle = ig; c.fill();
    circ(c, ix, iy, ir * 0.52); c.fillStyle = '#120a16'; c.fill();
    ell(c, x, y - ry * 0.95, rx * 1.2, ry * 0.35); c.fillStyle = 'rgba(40,20,60,0.18)'; c.fill(); // 위 눈꺼풀 그늘
    circ(c, ix + ir * 0.35, iy - ir * 0.4, ir * 0.36); c.fillStyle = '#fff'; c.fill();
    circ(c, ix - ir * 0.4, iy + ir * 0.42, ir * 0.15); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill();
    if (lid) {
      const lg = c.createLinearGradient(0, y - ry, 0, y - ry + ry * 2 * lid);
      lg.addColorStop(0, shade(skin, 0.15)); lg.addColorStop(1, shade(skin, -0.15));
      c.fillStyle = lg; c.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * lid + 2);
    }
    c.restore();
    if (lid) { c.strokeStyle = 'rgba(42,26,46,0.9)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x - rx * 0.98, y - ry + ry * 2 * lid); c.lineTo(x + rx * 0.98, y - ry + ry * 2 * lid); c.stroke(); }
    if (lash) {
      c.strokeStyle = '#2a1a2e'; c.lineWidth = 1.2; c.lineCap = 'round';
      for (const a of [-0.5, -0.15, 0.2]) { const px = x + Math.sin(a + 0.6) * rx, py = y - Math.cos(a + 0.6) * ry; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 3.2 + a * 2, py - 3.4); c.stroke(); }
    }
  }
  function brows(c, kind, e1, e2, ink) {
    if (!kind) return;
    c.strokeStyle = ink; c.lineCap = 'round'; c.lineWidth = kind === 'boss' ? 2.8 : 1.7;
    const SHAPE = { firm: [-1, 1], up: [3, 3.5], worry: [3, -1.5], cocky: [0, 3], boss: [-2.5, 2], angry: [-4, 2.5], calm: [1.5, 2] }[kind];
    for (const [ex, ey, rx, ry, side] of [[...e1, -1], [...e2, 1]]) {
      const inX = ex - side * rx * 0.75, outX = ex + side * rx * 0.75, base = ey - ry - 4;
      const inY = base - SHAPE[0], outY = base - SHAPE[1] + (kind === 'cocky' && side < 0 ? 3 : 0);
      c.beginPath(); c.moveTo(inX, inY); c.quadraticCurveTo(ex, Math.min(inY, outY) - 2, outX, outY); c.stroke();
    }
  }
  function mouth(c, kind, mx, my, w, rim, t) {
    const ink = rim ? '#ffd0dc' : '#3a1020';
    c.strokeStyle = ink; c.lineWidth = 1.3; c.lineCap = 'round'; c.lineJoin = 'round';
    const openShape = (top, bottom, skew = 0) => { c.beginPath(); c.moveTo(mx - w, my + skew); c.quadraticCurveTo(mx, my + top, mx + w, my - skew); c.quadraticCurveTo(mx, my + bottom, mx - w, my + skew); c.closePath(); };
    const fillOpen = (teeth, tongue) => {
      const g = c.createLinearGradient(0, my - 2, 0, my + w * 1.2); g.addColorStop(0, '#4a0818'); g.addColorStop(1, '#8a1a38');
      c.fillStyle = g; c.fill(); c.lineWidth = 1; c.strokeStyle = '#3a0a18'; c.stroke();
      c.save(); c.clip();
      if (teeth) { const tg = c.createLinearGradient(0, my - 4, 0, my - 4 + teeth); tg.addColorStop(0, '#fff'); tg.addColorStop(1, '#e2e6ef'); c.fillStyle = tg; c.fillRect(mx - w, my - 4, w * 2, teeth); c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.6; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(mx + k * w * 0.45, my - 4); c.lineTo(mx + k * w * 0.45, my - 4 + teeth); c.stroke(); } }
      if (tongue) { const tg = c.createRadialGradient(mx + w * 0.1, my + tongue - 1, 0, mx + w * 0.15, my + tongue, w * 0.6); tg.addColorStop(0, '#ff9ab3'); tg.addColorStop(1, '#e8436e'); ell(c, mx + w * 0.15, my + tongue, w * 0.55, w * 0.35); c.fillStyle = tg; c.fill(); }
      c.restore();
    };
    switch (kind) {
      case 'bigGrin': openShape(1, w * 1.35); fillOpen(5, w * 1.0); break;
      case 'grin': openShape(0, w * 0.95); fillOpen(3.8, w * 0.75); break;
      case 'teeth': openShape(-1, w * 0.7, 1); fillOpen(w * 0.9, 0); c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(mx - w * 0.9, my + w * 0.25); c.lineTo(mx + w * 0.9, my + w * 0.25); c.stroke(); break;
      case 'shout': { const k = 1 + Math.sin((t || 0) * 9) * 0.12; ell(c, mx, my + w * 0.5, w * 0.62, w * 0.75 * k); fillOpen(0, w * 1.0); break; }
      case 'sing': ell(c, mx, my + 2, w * 0.38, w * 0.48); fillOpen(0, w * 0.45); break;
      case 'buck':
        c.beginPath(); c.moveTo(mx - w, my); c.quadraticCurveTo(mx, my + w * 0.7, mx + w, my - 1); c.stroke();
        c.beginPath(); c.roundRect(mx - 3.6, my + w * 0.25, 3.4, 5, 1); c.roundRect(mx + 0.2, my + w * 0.25, 3.4, 5, 1); fillLine(c, '#fff', '#3a1020', 0.8); break;
      case 'tongue':
        c.beginPath(); c.moveTo(mx - w, my); c.quadraticCurveTo(mx, my + w * 0.7, mx + w, my - 1); c.stroke();
        c.beginPath(); c.moveTo(mx + w * 0.05, my + w * 0.35); c.quadraticCurveTo(mx + w * 0.3, my + w * 1.5, mx + w * 0.7, my + w * 0.2); fillLine(c, '#ff7a9a', '#9d174d', 0.8); break;
      case 'smirk': c.beginPath(); c.moveTo(mx - w * 0.7, my + 1); c.quadraticCurveTo(mx + w * 0.1, my + w * 0.45, mx + w * 0.9, my - w * 0.35); c.stroke(); break;
      case 'tiny': c.beginPath(); c.arc(mx, my, w * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); break;
      default: c.beginPath(); c.moveTo(mx - w * 0.75, my); c.quadraticCurveTo(mx, my + w * 0.7, mx + w * 0.75, my); c.stroke();
    }
  }
  function face(c, sp, hx, hy, hr, mood, blink, t) {
    const f = sp.face || {}, rim = isDark(sp.head);
    const ink = rim ? '#ffffff' : '#2a1a2e';
    const rx = hr * 0.34, ry = hr * 0.44, ey = hy - hr * 0.14;
    const e1 = [hx - hr * 0.22, ey + (f.odd ? 1 : 0), rx * (f.odd ? 0.78 : 0.9), ry * (f.odd ? 0.8 : 0.94)];
    const e2 = [hx + hr * 0.48, ey, rx * (f.odd ? 1.08 : 1), ry * (f.odd ? 1.06 : 1)];
    const look = mood ? 0 : Math.sin((t || 0) * 0.7 + hx) > 0.6 ? -0.6 : 1;
    const eo = { col: sp.eye, mood, blink, irisK: f.iris || 0.55, lid: mood ? 0 : f.lid || 0, lash: f.lash, skin: sp.head, ink, look };
    eye(c, ...e1, eo); eye(c, ...e2, eo);
    brows(c, mood === 'strain' ? 'angry' : mood === 'dizzy' ? 'worry' : f.brow, e1, e2, ink);
    for (const [x, s] of [[hx - hr * 0.55, 0.85], [hx + hr * 0.82, 1]]) {
      const k = (f.shy ? 1.35 : 1) * s, cy = hy + hr * 0.38;
      const g = c.createRadialGradient(x, cy, 0, x, cy, hr * 0.3 * k);
      g.addColorStop(0, `rgba(255,95,135,${f.shy ? 0.8 : 0.6})`); g.addColorStop(1, 'rgba(255,95,135,0)');
      c.fillStyle = g; ell(c, x, cy, hr * 0.34 * k, hr * 0.22 * k); c.fill();
    }
    if (sp.faceDots) { c.fillStyle = 'rgba(255,255,255,0.9)'; ell(c, hx - hr * 0.62, hy - hr * 0.62, hr * 0.13, hr * 0.09, -0.4); c.fill(); ell(c, hx + hr * 0.12, hy - hr * 0.74, hr * 0.11, hr * 0.08); c.fill(); }
    const mk = mood === 'happy' ? (f.mouth === 'bigGrin' || f.mouth === 'shout' ? 'bigGrin' : 'grin') : mood === 'strain' ? 'teeth' : mood === 'dizzy' ? 'wavy' : f.mouth;
    const mx = hx + hr * 0.16, my = hy + hr * 0.44, w = hr * 0.42;
    if (mk === 'wavy') { c.strokeStyle = rim ? '#ffd0dc' : '#3a1020'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(mx - w, my); for (let k = 1; k <= 4; k++) c.lineTo(mx - w + k * w * 0.5, my + (k % 2 ? -2.5 : 1.5)); c.stroke(); }
    else mouth(c, mk, mx, my, w, rim, t);
    if (mood === 'strain') {
      const dx = hx - hr * 0.95, dy = hy - hr * 0.5;
      c.beginPath(); c.moveTo(dx, dy - 6); c.quadraticCurveTo(dx + 5, dy + 1, dx, dy + 4); c.quadraticCurveTo(dx - 5, dy + 1, dx, dy - 6);
      const g = c.createLinearGradient(dx, dy - 6, dx, dy + 4); g.addColorStop(0, '#e0f6ff'); g.addColorStop(1, '#5fb8f0');
      fillLine(c, g, '#3b82c4', 0.7);
    }
  }

  // ---------- 날개 (등 뒤) ----------
  function wingsBack(c, sp, ph, fly) {
    const flap = fly ? Math.abs(Math.sin(ph * 2.2)) : 0.25;
    c.save(); c.translate(-4, -4);
    if (sp.wings === 'clear') {
      const b = sp.big ? 1.25 : 1;
      for (const [x, y, rx, ry, rot] of [[-10 * b, -6 - flap * 4, 13 * b, (6 + flap * 3) * b, -0.7], [-5 * b, -10 - flap * 5, 12 * b, (5.5 + flap * 3) * b, -1.1]]) {
        const g = c.createLinearGradient(x - rx, y + ry, x + rx, y - ry);
        g.addColorStop(0, 'rgba(160,215,250,0.55)'); g.addColorStop(0.6, 'rgba(225,245,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.95)');
        ell(c, x, y, rx, ry, rot); fillLine(c, g, 'rgba(56,90,130,0.6)', 0.7);
        c.save(); ell(c, x, y, rx, ry, rot); c.clip();
        c.strokeStyle = 'rgba(56,90,130,0.28)'; c.lineWidth = 0.6;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + rx * 0.9 * Math.cos(rot), y + rx * 0.9 * Math.sin(rot)); c.lineTo(x - rx * Math.cos(rot) + k * 3, y - rx * Math.sin(rot) + k * 4); c.stroke(); }
        const sh = c.createLinearGradient(x - rx, y, x + rx, y); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,200,255,0.25)'); sh.addColorStop(0.7, 'rgba(180,255,240,0.25)'); sh.addColorStop(0.9, 'rgba(255,255,255,0)');
        c.fillStyle = sh; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); // 무지갯빛 반사
        c.restore();
      }
    } else if (sp.wings === 'butterfly') {
      const sy = 0.55 + 0.45 * (fly ? Math.abs(Math.cos(ph * 2)) : 0.9);
      c.translate(0, 2); c.rotate(-0.15); c.scale(1, sy);
      const P1 = () => { c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(-24, 0, -28, 24, -8, 22); c.quadraticCurveTo(-2, 14, 0, 2); };
      const P2 = () => { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-2, -32, -36, -40, -34, -14); c.bezierCurveTo(-30, -2, -12, 2, 0, 0); };
      for (const [P, cx, cy] of [[P1, -12, 12], [P2, -18, -16]]) {
        P(); const g = c.createRadialGradient(cx + 8, cy + 6, 1, cx, cy, 24);
        g.addColorStop(0, sp.wc2); g.addColorStop(0.7, sp.wc); g.addColorStop(1, shade(sp.wc, -0.12));
        c.fillStyle = g; c.fill(); c.lineWidth = 2.2; c.strokeStyle = sp.we; c.stroke(); c.lineWidth = LW; c.strokeStyle = shade(sp.we, -0.4); c.stroke();
      }
      c.fillStyle = sp.wd;
      if (sp.tiger) {
        c.save(); P2(); c.clip();
        for (const x of [-11, -19, -27]) { c.beginPath(); c.moveTo(x, -40); c.lineTo(x + 2.4, -40); c.lineTo(x + 6.4, 0); c.lineTo(x + 4, 0); c.fill(); }
        c.restore();
        vol(c, E(c, -13, 15, 3.2, 3.2), '#3b82f6', -13, 15, 3.2);
        vol(c, E(c, -5, 18, 2.4, 2.4), '#f97316', -5, 18, 2.4);
      } else {
        vol(c, E(c, -24, -22, 3.8, 3.8), sp.wd, -24, -22, 3.8); vol(c, E(c, -15, -14, 2.6, 2.6), sp.wd, -15, -14, 2.6);
      }
    } else if (sp.wings === 'dragon') {
      const a = fly ? Math.sin(ph * 3) * 0.28 : 0.06;
      for (const [x, y, rot] of [[-12, -2, -0.55 - a], [-10, 3, -0.2 + a]]) {
        const g = c.createLinearGradient(x - 22, y, x + 6, y);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(165,232,255,0.6)');
        ell(c, x, y, 20, 5, rot); fillLine(c, g, 'rgba(14,116,144,0.6)', 0.7);
        c.save(); ell(c, x, y, 20, 5, rot); c.clip();
        c.strokeStyle = 'rgba(14,116,144,0.25)'; c.lineWidth = 0.5;
        for (let k = -24; k < 12; k += 4) { c.beginPath(); c.moveTo(x + k, y - 10); c.lineTo(x + k + 3, y + 10); c.stroke(); }
        c.restore();
      }
    }
    c.restore();
  }

  // ---------- 몸 뒤쪽 특징 (등딱지 · 엉덩이 배 · 긴 배 · 꼬리 · 침) ----------
  function bodyBack(c, sp, t, live, seed) {
    if (sp.kind === 'ant') {
      vol(c, E(c, -10, 9, 8.5, 7, 0.4), sp.col, -10, 9, 8.5);
      c.strokeStyle = shade(sp.col, -0.3, 0.6); c.lineWidth = 0.8;
      for (const k of [-1, 1]) { c.beginPath(); c.ellipse(-10 + k * 3, 9, 6, 6.5, 0.4, -1, 1); c.stroke(); }
    } else if (sp.kind === 'beetle') {
      if (sp.glow) {
        const pulse = 0.6 + 0.4 * Math.sin((live ? t * 4 : 1) + seed);
        const gr = c.createRadialGradient(-9, 15, 1, -9, 15, 18);
        gr.addColorStop(0, `rgba(255,236,120,${0.9 * pulse})`); gr.addColorStop(1, 'rgba(255,236,120,0)');
        c.fillStyle = gr; circ(c, -9, 15, 18); c.fill();
        vol(c, E(c, -8, 15, 5.5, 4.5), '#ffe45c', -8, 15, 5.5, 0.9);
      }
      // 등딱지 (거북 등처럼)
      const shell = () => { c.beginPath(); c.ellipse(-5, 2, 11, 14, -0.12, Math.PI * 0.42, Math.PI * 1.62); c.quadraticCurveTo(0, 2, -1, 15); c.closePath(); };
      vol(c, shell, sp.col, -8, -2, 14, 0.85);
      c.save(); shell(); c.clip();
      if (sp.spots) for (const [sx, sy, r] of [[-11, -4, 2.8], [-9, 5, 2.6], [-13, 11, 2.1], [-5, -8, 2]]) { c.beginPath(); c.arc(sx, sy, r, 0, 7); const g = c.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r); g.addColorStop(0, '#5a6070'); g.addColorStop(1, sp.spots); c.fillStyle = g; c.fill(); }
      c.strokeStyle = shade(sp.col, -0.45, 0.7); c.lineWidth = 0.8; c.beginPath(); c.moveTo(-6, -11); c.quadraticCurveTo(-10, 2, -7, 15); c.stroke();
      c.restore();
    } else if (sp.kind === 'long') {
      vol(c, E(c, -12, 12, 11, 4.6, 0.55), sp.col, -12, 12, 11, 0.55);
      c.save(); ell(c, -12, 12, 11, 4.6, 0.55); c.clip(); c.strokeStyle = shade(sp.col, -0.3, 0.5); c.lineWidth = 0.7;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(-12 + k * 4 - 3, 12 + k * 2.4 - 5); c.lineTo(-12 + k * 4 + 3, 12 + k * 2.4 + 5); c.stroke(); }
      c.restore();
    } else if (sp.kind === 'round' && sp.sting) {
      c.beginPath(); c.moveTo(-9, 10); c.lineTo(-16, 15); c.lineTo(-8, 15); c.closePath();
      const g = c.createLinearGradient(-16, 15, -8, 10); g.addColorStop(0, '#2a2430'); g.addColorStop(1, '#6a6075'); fillLine(c, g, '#1f1a24');
    } else if (sp.kind === 'dragon') {
      for (let s = 0; s < 7; s++) {
        const r = 3.2 - s * 0.12, x = -6 - s * 4.2, y = 11 + s * 1.6 + Math.sin(s * 0.6 + t * 2) * 0.6;
        vol(c, E(c, x, y, r, r), s % 2 ? sp.col : sp.col2, x, y, r, 0.7);
      }
    }
  }
  // 몸통 (배 쪽은 밝은 색 · 무늬)
  function torso(c, sp) {
    const round = sp.kind === 'round', rx = round ? 10.5 : 8.2, ry = round ? 11 : 10.5, cy = round ? 4 : 4;
    vol(c, E(c, 0, cy, rx, ry), sp.col, 0, cy, ry, 0.55);
    c.save(); ell(c, 0, cy, rx, ry); c.clip();
    if (sp.stripes) { c.fillStyle = sp.stripes; for (const sy of [2, 9]) { ell(c, 0, sy, rx * 1.2, 2.3, -0.08); c.fill(); } }
    if (sp.ridges) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.9; for (const sy of [1, 6, 11]) { c.beginPath(); c.moveTo(-rx, sy); c.quadraticCurveTo(0, sy + 3, rx, sy); c.stroke(); } }
    // 배 (밝은 타원)
    if (!sp.stripes) {
      const g = c.createRadialGradient(2, cy - 2, 0, 2.5, cy + 1, ry * 0.8);
      g.addColorStop(0, shade(sp.col2, 0.4)); g.addColorStop(1, sp.col2);
      ell(c, 2.6, cy + 1, rx * 0.6, ry * 0.72); c.fillStyle = g; c.fill();
      c.strokeStyle = shade(sp.col2, -0.25, 0.5); c.lineWidth = 0.6;
      for (const sy of [cy - 2, cy + 2, cy + 6]) { c.beginPath(); c.moveTo(-1.6, sy); c.quadraticCurveTo(2.6, sy + 1.2, 7.4, sy); c.stroke(); }
    }
    c.restore();
    if (sp.fluff) {
      for (const [px, py] of [[-6, -5], [-2, -6.5], [2, -6.6], [6, -5.4], [8.4, -3]]) vol(c, E(c, px, py, 3.6, 3.2), sp.fluff, px, py, 3.6, 0.5);
    }
  }

  // ---------- 등급 장식 ----------
  function decoAura(c, rar, t) {
    if (rar !== 'hero' && rar !== 'legend') return;
    const legend = rar === 'legend', pulse = 0.88 + Math.sin(t * 3) * 0.12;
    const g = c.createRadialGradient(0, -8, 4, 0, -8, 50 * pulse);
    g.addColorStop(0, legend ? 'rgba(255,236,150,0.75)' : 'rgba(205,160,255,0.6)');
    g.addColorStop(0.6, legend ? 'rgba(255,215,100,0.25)' : 'rgba(168,85,247,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; circ(c, 0, -8, 50 * pulse); c.fill();
    if (legend) {
      c.save(); c.translate(0, -10); c.rotate(t * 0.5);
      for (let i = 0; i < 12; i++) {
        c.rotate(Math.PI / 6);
        const lg = c.createLinearGradient(0, 0, 54, 0); lg.addColorStop(0, 'rgba(255,220,90,0.55)'); lg.addColorStop(1, 'rgba(255,220,90,0)');
        c.fillStyle = lg; c.beginPath(); c.moveTo(0, 0); c.lineTo(56, -4); c.lineTo(56, 4); c.closePath(); c.fill();
      }
      c.restore();
    }
  }
  function decoCape(c, rar, t) {
    if (rar !== 'hero' && rar !== 'legend') return;
    const legend = rar === 'legend', wave = Math.sin(t * 4) * 2.5;
    const base = legend ? '#d62839' : '#7c3aed', inner = legend ? '#ffcf3f' : '#c4b5fd';
    const path = () => { c.beginPath(); c.moveTo(-5, -7); c.quadraticCurveTo(-14, 4 + wave, -22 + wave, 20); c.quadraticCurveTo(-12, 23, -2, 19 + wave * 0.3); c.quadraticCurveTo(-1, 6, 3, -7); c.closePath(); };
    path();
    const cg = c.createLinearGradient(-22, 0, 3, 0); cg.addColorStop(0, shade(base, -0.35)); cg.addColorStop(0.6, base); cg.addColorStop(1, shade(base, 0.25));
    c.fillStyle = cg; c.fill(); c.lineWidth = LW; c.strokeStyle = shade(base, -0.6); c.stroke();
    c.strokeStyle = inner; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-22 + wave, 20); c.quadraticCurveTo(-12, 23, -2, 19 + wave * 0.3); c.stroke();
    if (!legend) { star(c, -11, 12 + wave * 0.3, 4, -Math.PI / 2, 5, 0.45); const sg = c.createRadialGradient(-12, 11, 0, -11, 12, 4); sg.addColorStop(0, '#fff7c2'); sg.addColorStop(1, '#f5b700'); fillLine(c, sg, '#a16207', 0.7); }
  }
  function decoFront(c, rar, t, hx, hy, hr) {
    if (rar === 'rare') {
      // 하늘색 목도리 (꼬리가 팔랑팔랑)
      const w = Math.sin(t * 5) * 2;
      const tail = () => { c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(-10, -2 + w, -14, 2 + w); c.lineTo(-12, 6 + w); c.quadraticCurveTo(-8, 3, -3, 0); c.closePath(); };
      vol(c, tail, '#5ccaf5', -9, 1, 7, 0.4);
      vol(c, E(c, 1, -4, 9.5, 3.6, -0.06), '#38bdf8', 1, -4, 9.5, 0.6);
    }
    if (rar === 'hero') {
      const w = Math.sin(t * 6) * 2.5;
      c.save(); circ(c, hx, hy, hr + 0.3); c.clip();
      const band = () => { c.beginPath(); c.moveTo(hx - hr - 2, hy - hr * 0.62); c.quadraticCurveTo(hx, hy - hr * 0.86, hx + hr + 2, hy - hr * 0.6); c.lineTo(hx + hr + 2, hy - hr * 0.4); c.quadraticCurveTo(hx, hy - hr * 0.64, hx - hr - 2, hy - hr * 0.4); c.closePath(); };
      vol(c, band, '#ef4444', hx, hy - hr * 0.6, hr, 0.5);
      c.restore();
      const kx = hx - hr * 0.95, ky = hy - hr * 0.5;
      for (const [dy, len] of [[-2, 1], [3, 0.8]]) {
        const p = () => { c.beginPath(); c.moveTo(kx, ky); c.quadraticCurveTo(kx - 8, ky + dy + w, kx - 16 * len, ky + dy * 2 + w * 1.4); c.lineTo(kx - 15 * len, ky + dy * 2 + 4 + w * 1.4); c.quadraticCurveTo(kx - 7, ky + dy + 4 + w, kx, ky + 3); c.closePath(); };
        vol(c, p, '#f87171', kx - 8, ky + dy, 8, 0.3);
      }
      vol(c, E(c, kx, ky + 1.5, 2.8, 2.8), '#dc2626', kx, ky + 1.5, 2.8);
      for (let i = 0; i < 4; i++) {
        const a = t * 1.8 + i * Math.PI / 2, ox = Math.cos(a) * 32, oy = -8 + Math.sin(a) * 11;
        const s = 2.6 + Math.sin(t * 5 + i) * 0.8;
        star(c, ox, oy, s * 1.6, t * 2 + i); c.fillStyle = Math.sin(a) > 0 ? '#f3e8ff' : '#c084fc'; c.fill();
      }
    }
    if (rar === 'legend') {
      const hy2 = hy - hr - 8 + Math.sin(t * 2.5) * 1.2;
      c.save(); c.shadowColor = '#ffd84d'; c.shadowBlur = 8;
      ell(c, hx - 1, hy2, 12, 3.4); c.lineWidth = 2.6; c.strokeStyle = '#ffe680'; c.stroke();
      c.restore();
      ell(c, hx - 1, hy2, 12, 3.4); c.lineWidth = 0.8; c.strokeStyle = '#fffbe6'; c.stroke();
      c.save(); c.translate(hx - hr * 0.1, hy - hr * 0.8); c.rotate(-0.18);
      const crown = () => { c.beginPath(); c.moveTo(-9.5, 2); c.lineTo(-10.5, -8.5); c.lineTo(-4.8, -3); c.lineTo(0, -11.5); c.lineTo(4.8, -3); c.lineTo(10.5, -8.5); c.lineTo(9.5, 2); c.closePath(); };
      crown(); const gg = c.createLinearGradient(-6, -12, 6, 2); gg.addColorStop(0, '#fffbe0'); gg.addColorStop(0.35, '#ffd84d'); gg.addColorStop(0.75, '#f0a500'); gg.addColorStop(1, '#b87400');
      c.fillStyle = gg; c.fill(); c.lineWidth = LW; c.strokeStyle = '#7a4d00'; c.stroke();
      for (const [x, y, col] of [[0, -3, '#ef4444'], [-5.6, -1, '#3b82f6'], [5.6, -1, '#22c55e']]) vol(c, E(c, x, y, 1.9, 1.9), col, x, y, 1.9, 0.9);
      for (const [x, y] of [[-10.5, -8.5], [0, -11.5], [10.5, -8.5]]) vol(c, E(c, x, y, 1.5, 1.5), '#fff3b0', x, y, 1.5, 0.9);
      c.restore();
    }
    const n = { rare: 3, legend: 7 }[rar] || 0;
    for (let i = 0; i < n; i++) {
      const ph = t * (1.2 + i * 0.13) + i * 2.1, k = (Math.sin(ph) + 1) / 2;
      const ang = i * 2.39, R = rar === 'legend' ? 30 + (i % 3) * 7 : 28;
      const x = Math.cos(ang) * R, y = -8 + Math.sin(ang) * R * 0.8 - (rar === 'legend' ? ((t * 10 + i * 9) % 20) : 0);
      star(c, x, y, (rar === 'legend' ? 4.2 : 3.4) * (0.35 + k * 0.75), ph * 0.3);
      c.fillStyle = rar === 'legend' ? (i % 2 ? '#fff6c2' : '#ffd84d') : '#bae6fd'; c.fill();
    }
  }

  // ---------- 전체 그리기 ----------
  function draw(c, type, x, y, size, o = {}) {
    const sp = SPEC[type] || SPEC.ant, ph = o.phase || 0, mood = o.mood, live = o.time != null, t = live ? o.time : 0;
    const rar = o.deco === false ? 'common' : o.rarity || rarityOf(type);
    const pose = o.pose || (o.fly ? 'fly' : mood === 'happy' && !o.pose ? 'cheer' : 'stand');
    const P = poseOf(pose, ph, t);
    const seed = type.length * 1.7;
    const blink = live && !mood && ((t + seed) % 3.6) < 0.13;
    const breathe = live ? Math.sin(t * 3 + seed) * 0.03 : 0;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.flip) c.scale(-1, 1);
    const k = size / 62 * (sp.small ? 0.94 : 1); c.scale(k, k);
    if (o.shadow !== false && pose !== 'hang' && pose !== 'fly') {
      const g = c.createRadialGradient(0, GROUND, 1, 0, GROUND, 18);
      g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ell(c, 1, GROUND, 18, 3.6); c.fillStyle = g; c.fill();
    }
    if (o.fly || pose === 'fly') c.translate(0, -6 + Math.sin(ph * 1.5) * 2.5);
    c.lineJoin = 'round';
    decoAura(c, rar, t);
    // 다리 (몸이 기울어도 땅을 딛도록 먼저)
    const hipY = 12;
    leg(c, sp, [-2.6, hipY], P.legs[1], P.knees[1], true);
    // 숨쉬기 + 몸 기울기 (엉덩이를 기준으로)
    c.save();
    c.translate(0, hipY); c.rotate(P.lean); c.scale(1 - breathe * 0.5, 1 + breathe); c.translate(0, -hipY);
    wingsBack(c, sp, ph, o.fly || pose === 'fly');
    decoCape(c, rar, t);
    bodyBack(c, sp, t, live, seed);
    arm(c, sp, [-6, 0.5], P.arms[1], P.elbows[1], true, t);
    c.restore();
    leg(c, sp, [2.8, hipY], P.legs[0], P.knees[0], false);
    c.save();
    c.translate(0, hipY); c.rotate(P.lean); c.scale(1 - breathe * 0.5, 1 + breathe); c.translate(0, -hipY);
    torso(c, sp);
    // 머리 (몸보다 커요)
    const hx = 3, hy = -16;
    const hr = sp.kind === 'beetle' ? 15 : 15.5;
    if (sp.tri) {
      const head = () => {
        c.beginPath();
        c.moveTo(hx - hr * 0.95, hy - hr * 0.5);
        c.quadraticCurveTo(hx + hr * 0.1, hy - hr * 1.2, hx + hr * 1.12, hy - hr * 0.45);
        c.quadraticCurveTo(hx + hr * 0.95, hy + hr * 0.75, hx + hr * 0.1, hy + hr * 0.98);
        c.quadraticCurveTo(hx - hr * 0.75, hy + hr * 0.75, hx - hr * 0.95, hy - hr * 0.5);
      };
      vol(c, head, sp.head, hx, hy, hr, 0.6);
    } else vol(c, E(c, hx, hy, hr, hr), sp.head, hx, hy, hr, 0.6);
    if (sp.horn) {
      const horn = () => { c.beginPath(); c.moveTo(hx + hr * 0.1, hy - hr * 0.88); c.quadraticCurveTo(hx + hr * 0.95, hy - hr * 1.0, hx + hr * 1.05, hy - hr * 1.95); c.quadraticCurveTo(hx + hr * 1.35, hy - hr * 1.7, hx + hr * 1.2, hy - hr * 1.38); c.quadraticCurveTo(hx + hr * 1.12, hy - hr * 0.55, hx + hr * 0.68, hy - hr * 0.5); c.closePath(); };
      vol(c, horn, '#9a3c14', hx + hr * 0.9, hy - hr * 1.2, hr * 0.8, 0.8);
    }
    if (sp.jaws) {
      for (const [y0, cy, ty] of [[-0.3, -0.95, -0.5], [0.4, 1.0, 0.45]]) {
        const jaw = () => { c.beginPath(); c.moveTo(hx + hr * 0.8, hy + hr * y0 - 2.5); c.quadraticCurveTo(hx + hr * 1.5, hy + hr * cy, hx + hr * 1.75, hy + hr * ty); c.quadraticCurveTo(hx + hr * 1.38, hy + hr * (cy * 0.55), hx + hr * 0.85, hy + hr * y0 + 2.5); c.closePath(); };
        vol(c, jaw, '#7a5232', hx + hr * 1.3, hy + hr * cy * 0.6, hr * 0.6, 0.7);
      }
    }
    if (sp.shovel) {
      const sh = () => { c.beginPath(); c.moveTo(hx - hr * 0.55, hy - hr * 0.8); for (let s = 0; s < 4; s++) { c.lineTo(hx - hr * 0.32 + s * hr * 0.38, hy - hr * 1.15); c.lineTo(hx - hr * 0.13 + s * hr * 0.38, hy - hr * 0.88); } c.closePath(); };
      vol(c, sh, '#4a5068', hx, hy - hr, hr * 0.7, 0.6);
    }
    antennae(c, sp, hx, hy, hr, ph);
    face(c, sp, hx, hy, hr, mood, blink, t);
    if (sp.face && sp.face.note && live && !mood) {
      const k2 = (t * 0.6) % 1, nx = hx + hr * 1.1 + k2 * 8, ny = hy - k2 * 18;
      c.globalAlpha = 1 - k2; c.font = 'bold 12px sans-serif'; c.fillStyle = '#7c3aed'; c.fillText('♪', nx, ny); c.globalAlpha = 1;
    }
    decoFront(c, rar, t, hx, hy, hr);
    arm(c, sp, [7.2, 0.5], P.arms[0], P.elbows[0], false, t);
    c.restore();
    c.restore();
  }

  // 카드·목록용 그림 (dataURL, 한 번 만들면 다시 써요)
  const cache = {};
  // rarity: 지금 등급 (없으면 처음 잡았을 때 등급)
  function portrait(type, px = 96, mood, rarity) {
    const rar = rarity || rarityOf(type);
    const key = `${type}:${px}:${mood || ''}:${rar}`;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
    const c = cv.getContext('2d'); c.scale(2, 2);
    const sp = SPEC[type] || SPEC.ant;
    const big = rar === 'legend' || rar === 'hero' || sp.horn || sp.longAnt;
    draw(c, type, px * 0.52, px * (big ? 0.66 : 0.64), px * (big ? 0.64 : 0.7), { phase: 0.6, mood, rarity: rar, pose: mood === 'happy' ? 'cheer' : 'stand', time: 0.35, shadow: true });
    return (cache[key] = cv.toDataURL());
  }

  return { draw, portrait, SPEC };
})();
