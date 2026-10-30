// 귀여운 곤충 캐릭터 그리기 (그림 파일 없이 캔버스로 그려요)
// 애니메이션 캐릭터 느낌: 큰 머리 · 반짝이는 큰 눈 · 입체 음영 · 진한 외곽선 · 숨쉬기/눈 깜빡임
// BugArt.draw(ctx, 종류, x, y, 크기, { flip, rot, phase, mood, fly, time, shadow })
//   크기: 몸길이(px) · flip: 왼쪽 보기 · phase: 다리·날개 움직임 · mood: happy | dizzy | strain
//   time: 초 단위 시간 (주면 숨쉬기·눈 깜빡임을 해요)
window.BugArt = (() => {
  'use strict';
  // kind: beetle(딱정벌레형) · ant · long(메뚜기형) · round(벌형) · slim(나비형) · dragon(잠자리형)
  // col: 몸 · col2: 배·무늬 · head: 머리 · eye: 눈동자 · tip: 더듬이 끝 · cheek: 볼
  const SPEC = {
    ant: { kind: 'ant', col: '#9a5b3a', col2: '#c27c4f', head: '#a8653f', eye: '#3b1d0e', tip: '#f97316' },
    ladybug: { kind: 'beetle', col: '#ef3b3b', col2: '#ff8a8a', head: '#2b2f3a', eye: '#1e293b', tip: '#ef3b3b', spots: '#1f2430', faceDots: true },
    bee: { kind: 'round', col: '#ffd23f', col2: '#fff3b0', head: '#ffcb2e', eye: '#5b3a00', tip: '#ffd23f', stripes: '#3a3340', wings: 'clear', sting: true, fluff: '#fff7d6' },
    grasshopper: { kind: 'long', col: '#7cc242', col2: '#c6f07a', head: '#8fd14f', eye: '#14532d', tip: '#c6f07a', hind: true },
    cricket: { kind: 'long', col: '#9a6230', col2: '#d9a45f', head: '#a86d37', eye: '#3b1d0e', tip: '#d9a45f', hind: true, longAnt: true },
    butterfly: { kind: 'slim', col: '#6b7a99', col2: '#c7d2fe', head: '#7b88a8', eye: '#1e3a8a', tip: '#a5b4fc', wings: 'butterfly', wc: '#ffffff', wc2: '#e0e7ff', we: '#8fa0c7', wd: '#4b5677' },
    firefly: { kind: 'beetle', col: '#3d4a63', col2: '#7a89a8', head: '#ff8a3d', eye: '#3b1d0e', tip: '#ffd84d', glow: true, small: true },
    dragonfly: { kind: 'dragon', col: '#29b6f6', col2: '#a5e8ff', head: '#4fc3f7', eye: '#1d4ed8', tip: '#a5e8ff', wings: 'dragon', bigEye: true },
    dungbeetle: { kind: 'beetle', col: '#3a3f52', col2: '#8b93ad', head: '#2c3040', eye: '#1e1b4b', tip: '#a78bfa', shovel: true },
    mantis: { kind: 'long', col: '#2fbf5b', col2: '#a7f3c0', head: '#3fd06a', eye: '#14532d', tip: '#a7f3c0', arms: true, tri: true },
    cicada: { kind: 'round', col: '#6f6a5c', col2: '#bdb59c', head: '#6aa33a', eye: '#7f1d1d', tip: '#bdb59c', wings: 'clear', big: true, ridges: true },
    rhino: { kind: 'beetle', col: '#9c3d16', col2: '#e2763c', head: '#6e2a0e', eye: '#2b0f05', tip: '#e2763c', horn: true },
    stag: { kind: 'beetle', col: '#5a3d28', col2: '#a07a55', head: '#4a3120', eye: '#1c1009', tip: '#a07a55', jaws: true },
    swallowtail: { kind: 'slim', col: '#2d3446', col2: '#6b7280', head: '#3a4256', eye: '#0f172a', tip: '#fde047', wings: 'butterfly', wc: '#ffe14d', wc2: '#fff4a8', we: '#272c3a', wd: '#272c3a', tiger: true },
  };

  // ---------- 색 도우미 ----------
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  // f > 0 이면 밝게, f < 0 이면 어둡게
  function shade(hex, f, a = 1) {
    const [r, g, b] = rgb(hex), t = f < 0 ? 0 : 255, p = Math.abs(f);
    return `rgba(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)},${a})`;
  }
  const line = base => shade(base, -0.62);
  // 위 왼쪽에서 빛이 오는 입체 그라데이션
  function ball(c, base, cx, cy, r) {
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.08, cx, cy, r * 1.15);
    g.addColorStop(0, shade(base, 0.5)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.32));
    return g;
  }
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  function fillLine(c, fill, stroke, lw = 2.6) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  // 입체 덩어리 하나 (그라데이션 + 외곽선 + 반짝 하이라이트)
  function blob(c, base, x, y, rx, ry, rot = 0, gloss = true) {
    ell(c, x, y, rx, ry, rot);
    fillLine(c, ball(c, base, x, y, Math.max(rx, ry)), line(base));
    if (gloss) { ell(c, x - rx * 0.32, y - ry * 0.48, rx * 0.36, ry * 0.18, -0.35); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); }
  }
  // 아래쪽 그림자 (셀 음영)
  function underShade(c, x, y, rx, ry, a = 0.18) {
    c.save(); ell(c, x, y, rx, ry); c.clip();
    ell(c, x + rx * 0.15, y + ry * 0.75, rx * 1.1, ry * 0.7); c.fillStyle = `rgba(30,10,40,${a})`; c.fill();
    c.restore();
  }

  // ---------- 다리 · 더듬이 ----------
  // 짧고 통통한 다리 + 동그란 발
  function legs(c, xs, y, ph, base, len = 9) {
    const col = shade(base, -0.45), foot = shade(base, -0.2);
    c.lineCap = 'round'; c.lineJoin = 'round';
    xs.forEach((x, i) => {
      const s = Math.sin(ph + i * Math.PI * 0.66) * 3.2, lift = Math.max(0, Math.cos(ph + i * Math.PI * 0.66)) * 2;
      c.strokeStyle = line(base); c.lineWidth = 5.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + s + 1.5, y + len - lift); c.stroke();
      c.strokeStyle = col; c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + s + 1.5, y + len - lift); c.stroke();
      ell(c, x + s + 2.6, y + len - lift + 0.6, 3.4, 2.4); fillLine(c, foot, line(base), 1.6);
    });
  }
  function antennae(c, sp, hx, hy, hr, ph) {
    const L = sp.longAnt ? 24 : 13, wob = Math.sin(ph * 0.7) * 1.6;
    [[-hr * 0.35, -6], [hr * 0.3, 5]].forEach(([dx, tip], k) => {
      const sx = hx + dx, sy = hy - hr * 0.82, ex = hx + dx + tip + wob * (k ? 1 : -1), ey = sy - L;
      c.lineCap = 'round';
      c.strokeStyle = line(sp.head); c.lineWidth = 3.6;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + (ex - sx) * 0.1 - 4, sy - L * 0.7, ex, ey); c.stroke();
      c.strokeStyle = shade(sp.head, -0.25); c.lineWidth = 1.8; c.stroke();
      if (!sp.longAnt) {
        circ(c, ex, ey, 3.6); fillLine(c, ball(c, sp.tip, ex, ey, 3.6), line(sp.tip), 1.6);
        circ(c, ex - 1.1, ey - 1.2, 1.1); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
      }
    });
  }

  // ---------- 얼굴 ----------
  function eye(c, x, y, rx, ry, col, mood, blink, big, rim) {
    const ink = rim ? '#ffffff' : '#2a1a2e'; // 어두운 머리에서는 밝은 선으로
    if (mood === 'dizzy') {
      c.strokeStyle = ink; c.lineWidth = 1.8; c.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) { const r = a / (Math.PI * 4) * rx; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; a ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke(); return;
    }
    if (mood === 'happy' || blink) {
      c.strokeStyle = ink; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath();
      if (blink && mood !== 'happy') { c.moveTo(x - rx, y + 1); c.quadraticCurveTo(x, y + ry * 0.45, x + rx, y + 1); }
      else c.arc(x, y + ry * 0.35, rx * 0.95, Math.PI * 1.12, Math.PI * 1.88);
      c.stroke(); return;
    }
    if (mood === 'strain') {
      c.strokeStyle = ink; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(x - rx * 0.8, y - ry * 0.55); c.lineTo(x + rx * 0.5, y); c.lineTo(x - rx * 0.8, y + ry * 0.55); c.stroke(); return;
    }
    // 반짝이는 큰 눈: (어두운 머리면 흰 테두리) → 외곽 → 눈동자 그라데이션 → 아래 반사광 → 하이라이트 두 개
    if (rim) { ell(c, x, y, rx + 1.8, ry + 1.8); c.fillStyle = '#fff'; c.fill(); }
    ell(c, x, y, rx, ry); c.fillStyle = '#1b1220'; c.fill();
    const g = c.createLinearGradient(0, y - ry, 0, y + ry);
    g.addColorStop(0, '#120a16'); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, 0.55));
    ell(c, x, y + ry * 0.04, rx * 0.84, ry * 0.88); c.fillStyle = g; c.fill();
    if (big) { c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.8; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x - rx * 0.8, y + k * ry * 0.35); c.lineTo(x + rx * 0.8, y + k * ry * 0.35); c.stroke(); } }
    ell(c, x + rx * 0.05, y + ry * 0.12, rx * 0.42, ry * 0.46); c.fillStyle = 'rgba(10,5,15,0.55)'; c.fill();
    ell(c, x + rx * 0.3, y - ry * 0.38, rx * 0.42, ry * 0.3, -0.4); c.fillStyle = '#fff'; c.fill();
    circ(c, x - rx * 0.38, y + ry * 0.42, rx * 0.18); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
  }
  function face(c, sp, hx, hy, hr, mood, blink) {
    const big = sp.bigEye, rx = hr * (big ? 0.4 : 0.34), ry = hr * (big ? 0.48 : 0.46);
    const ey = hy - hr * 0.04;
    const [r, g, b] = rgb(sp.head), rim = r * 0.3 + g * 0.59 + b * 0.11 < 90;
    // 3/4 옆모습: 뒤쪽 눈은 조금 작게
    eye(c, hx - hr * 0.12, ey, rx * 0.9, ry * 0.94, sp.eye, mood, blink, big, rim);
    eye(c, hx + hr * 0.58, ey, rx, ry, sp.eye, mood, blink, big, rim);
    // 볼
    for (const [x, s] of [[hx - hr * 0.42, 0.85], [hx + hr * 0.86, 1]]) {
      const g = c.createRadialGradient(x, hy + hr * 0.44, 0, x, hy + hr * 0.44, hr * 0.26 * s);
      g.addColorStop(0, 'rgba(255,105,140,0.75)'); g.addColorStop(1, 'rgba(255,105,140,0)');
      c.fillStyle = g; ell(c, x, hy + hr * 0.44, hr * 0.3 * s, hr * 0.2 * s); c.fill();
    }
    if (sp.faceDots) { c.fillStyle = 'rgba(255,255,255,0.9)'; ell(c, hx - hr * 0.55, hy - hr * 0.5, hr * 0.14, hr * 0.1, -0.4); c.fill(); ell(c, hx + hr * 0.2, hy - hr * 0.62, hr * 0.12, hr * 0.09); c.fill(); }
    // 입
    const mx = hx + hr * 0.26, my = hy + hr * 0.5;
    c.strokeStyle = rim ? '#ffd0dc' : '#3a1020'; c.lineWidth = 1.8; c.lineCap = 'round'; c.lineJoin = 'round';
    if (mood === 'happy') {
      c.beginPath(); c.moveTo(mx - hr * 0.22, my - 1); c.quadraticCurveTo(mx, my + hr * 0.42, mx + hr * 0.22, my - 1); c.closePath();
      c.fillStyle = '#7a1630'; c.fill(); c.stroke();
      c.save(); c.clip(); ell(c, mx, my + hr * 0.26, hr * 0.15, hr * 0.1); c.fillStyle = '#ff7a9a'; c.fill(); c.restore();
    } else if (mood === 'strain') {
      c.beginPath(); c.roundRect(mx - hr * 0.2, my - 1.5, hr * 0.4, hr * 0.2, 2); c.fillStyle = '#fff'; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(mx - hr * 0.2, my - 1.5 + hr * 0.1); c.lineTo(mx + hr * 0.2, my - 1.5 + hr * 0.1); c.stroke();
      // 땀방울
      const dx = hx - hr * 0.95, dy = hy - hr * 0.55;
      c.beginPath(); c.moveTo(dx, dy - 5); c.quadraticCurveTo(dx + 4, dy + 1, dx, dy + 3); c.quadraticCurveTo(dx - 4, dy + 1, dx, dy - 5);
      fillLine(c, '#8fd8ff', '#3b82c4', 1.2);
    } else if (mood === 'dizzy') {
      c.beginPath(); c.moveTo(mx - hr * 0.22, my); for (let k = 1; k <= 4; k++) c.lineTo(mx - hr * 0.22 + k * hr * 0.11, my + (k % 2 ? -2 : 1)); c.stroke();
    } else {
      // 고양이 입 (ω)
      c.beginPath(); c.arc(mx - hr * 0.09, my, hr * 0.09, 0.1 * Math.PI, 0.95 * Math.PI); c.stroke();
      c.beginPath(); c.arc(mx + hr * 0.09, my, hr * 0.09, 0.05 * Math.PI, 0.9 * Math.PI); c.stroke();
    }
  }

  // ---------- 날개 ----------
  function wingsBack(c, sp, ph, fly) {
    const flap = fly ? Math.abs(Math.sin(ph * 2.2)) : 0.3;
    if (sp.wings === 'clear') {
      const b = sp.big ? 1.3 : 1;
      for (const [x, y, rx, ry, rot] of [[-12 * b, -15 - flap * 4, 14 * b, (6.5 + flap * 3) * b, -0.55], [-5 * b, -18 - flap * 5, 13 * b, (6 + flap * 3) * b, -0.95]]) {
        const g = c.createLinearGradient(x - rx, y, x + rx, y);
        g.addColorStop(0, 'rgba(186,230,253,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
        ell(c, x, y, rx, ry, rot); fillLine(c, g, 'rgba(56,90,130,0.75)', 1.6);
        c.save(); ell(c, x, y, rx, ry, rot); c.clip();
        c.strokeStyle = 'rgba(56,90,130,0.35)'; c.lineWidth = 0.9;
        for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + rx * 0.9 * Math.cos(rot), y + rx * 0.9 * Math.sin(rot)); c.lineTo(x - rx * Math.cos(rot) + k * 3, y - rx * Math.sin(rot) + k * 4); c.stroke(); }
        c.restore();
      }
    } else if (sp.wings === 'butterfly') {
      const sy = 0.5 + 0.5 * (fly ? Math.abs(Math.cos(ph * 2)) : 0.85);
      c.save(); c.translate(-6, 0); c.scale(1, sy);
      const wing = path => {
        path(); const g = c.createRadialGradient(-8, -6, 2, -14, -10, 30);
        g.addColorStop(0, sp.wc2); g.addColorStop(1, sp.wc); fillLine(c, g, sp.we, 3.4);
      };
      // 뒷날개 · 앞날개 (둥글고 크게)
      wing(() => { c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(-28, -4, -30, 22, -8, 20); c.quadraticCurveTo(-2, 14, 0, 2); });
      wing(() => { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-4, -34, -40, -40, -36, -14); c.bezierCurveTo(-32, -2, -12, 2, 0, 0); });
      c.fillStyle = sp.wd;
      if (sp.tiger) {
        c.save(); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-4, -34, -40, -40, -36, -14); c.bezierCurveTo(-32, -2, -12, 2, 0, 0); c.clip();
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
      for (const [x, rot] of [[-4, -0.38 - a], [3, -0.12 + a]]) {
        const g = c.createLinearGradient(x - 30, 0, x, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(165,232,255,0.7)');
        ell(c, x - 14, -11, 20, 5.5, rot); fillLine(c, g, 'rgba(14,116,144,0.75)', 1.4);
        c.save(); ell(c, x - 14, -11, 20, 5.5, rot); c.clip();
        c.strokeStyle = 'rgba(14,116,144,0.3)'; c.lineWidth = 0.8;
        for (let k = -30; k < 6; k += 5) { c.beginPath(); c.moveTo(x + k, -20); c.lineTo(x + k + 3, 0); c.stroke(); }
        c.restore();
      }
    }
  }

  // ---------- 전체 그리기 ----------
  function draw(c, type, x, y, size, o = {}) {
    const sp = SPEC[type] || SPEC.ant, ph = o.phase || 0, mood = o.mood, t = o.time;
    const seed = type.length * 1.7;
    const blink = t != null && !mood && ((t + seed) % 3.6) < 0.13;
    const breathe = t != null ? Math.sin(t * 3 + seed) * 0.035 : 0;
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.flip) c.scale(-1, 1);
    const k = size / 50 * (sp.small ? 0.92 : 1); c.scale(k, k);
    if (o.shadow !== false) {
      const g = c.createRadialGradient(0, 21, 2, 0, 21, 24);
      g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ell(c, 0, 21, 24, 5); c.fillStyle = g; c.fill();
    }
    if (o.fly) c.translate(0, -5 + Math.sin(ph * 1.5) * 2.5);
    // 숨쉬기: 아래를 기준으로 살짝 늘었다 줄었다
    c.translate(0, 18); c.scale(1 - breathe * 0.5, 1 + breathe); c.translate(0, -18);
    c.lineJoin = 'round';
    wingsBack(c, sp, ph, o.fly);
    // 머리는 크게 (몸과 비슷한 크기)
    let hx = 11, hy = -5, hr = 13;

    if (sp.kind === 'ant') {
      legs(c, [-10, -3, 4], 8, ph, sp.col, 10);
      blob(c, sp.col, -17, 3, 11, 9.5);
      c.strokeStyle = shade(sp.col, -0.3); c.lineWidth = 1.4;
      for (const sx of [-20, -14]) { c.beginPath(); c.arc(sx, 3, 9, -1.1, 1.1); c.stroke(); }
      blob(c, sp.col2, -4, 6, 6, 5);
      hx = 10; hy = -5; hr = 13.5;
    } else if (sp.kind === 'beetle') {
      legs(c, [-12, -4, 4], 10, ph, sp.col, 9);
      if (sp.glow) {
        const pulse = 0.6 + 0.4 * Math.sin((t != null ? t * 4 : ph * 1.3) + seed);
        const gr = c.createRadialGradient(-20, 6, 1, -20, 6, 20);
        gr.addColorStop(0, `rgba(255,236,120,${0.95 * pulse})`); gr.addColorStop(1, 'rgba(255,236,120,0)');
        c.fillStyle = gr; circ(c, -20, 6, 20); c.fill();
        blob(c, '#ffe45c', -18, 7, 7, 6, 0, true);
      }
      // 둥근 등딱지 (윗부분 돔 + 납작한 아래)
      c.beginPath(); c.ellipse(-6, 5, 18, 16, 0, Math.PI, 0); c.quadraticCurveTo(12, 12, -6, 13); c.quadraticCurveTo(-24, 12, -24, 5); c.closePath();
      fillLine(c, ball(c, sp.col, -6, 0, 18), line(sp.col), 2.8);
      c.save(); c.clip();
      c.fillStyle = 'rgba(40,10,30,0.18)'; ell(c, -4, 14, 22, 7); c.fill();
      if (sp.spots) { c.fillStyle = sp.spots; for (const [sx, sy, r] of [[-15, -1, 3.8], [1, -3, 3.6], [-9, 7, 3], [6, 6, 2.8], [-19, 8, 2.4], [-6, -7, 2.6]]) { circ(c, sx, sy, r); c.fill(); } }
      c.restore();
      c.strokeStyle = line(sp.col); c.lineWidth = 1.8; c.beginPath(); c.moveTo(-5, -10); c.quadraticCurveTo(-3, 1, -6, 12); c.stroke();
      ell(c, -13, -4, 7, 3, -0.5); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      circ(c, -4, -8, 1.6); c.fill();
      hx = 13; hy = -2; hr = 12.5;
    } else if (sp.kind === 'long') {
      if (sp.hind) {
        // 통통한 허벅지 + 정강이
        const kick = Math.sin(ph) * 2;
        ell(c, -14, -4 + kick * 0.5, 11, 5.5, -0.75); fillLine(c, ball(c, sp.col, -14, -4, 11), line(sp.col), 2.4);
        c.strokeStyle = line(sp.col); c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-21, -11 + kick); c.lineTo(-28, 11); c.stroke();
        c.strokeStyle = shade(sp.col, -0.15); c.lineWidth = 2.8; c.stroke();
        ell(c, -27, 12, 3.6, 2.4); fillLine(c, shade(sp.col, -0.2), line(sp.col), 1.4);
      }
      legs(c, sp.hind ? [-4, 4] : [-12, -4, 4], 8, ph, sp.col, 10);
      blob(c, sp.col, -8, 3, 17, 8.5);
      c.save(); ell(c, -8, 3, 17, 8.5); c.clip(); c.fillStyle = shade(sp.col2, 0, 0.7); ell(c, -8, 10, 18, 4.5); c.fill(); c.restore();
      c.strokeStyle = shade(sp.col, -0.3); c.lineWidth = 1.2;
      for (const sx of [-18, -12, -6]) { c.beginPath(); c.moveTo(sx, -3); c.quadraticCurveTo(sx + 2, 3, sx, 10); c.stroke(); }
      hx = 11; hy = -6; hr = 12.5;
      if (sp.arms) {
        // 낫 모양 앞다리 (둥글게)
        c.lineCap = 'round';
        c.strokeStyle = line(sp.col); c.lineWidth = 6.4;
        c.beginPath(); c.moveTo(7, 4); c.lineTo(16, 12); c.lineTo(24, 4); c.stroke();
        c.strokeStyle = sp.col; c.lineWidth = 4;
        c.beginPath(); c.moveTo(7, 4); c.lineTo(16, 12); c.lineTo(24, 4); c.stroke();
        c.strokeStyle = shade(sp.col2, 0); c.lineWidth = 1.4;
        for (let s = 0; s < 3; s++) { c.beginPath(); c.moveTo(17 + s * 2.3, 10 - s * 2.5); c.lineTo(15.5 + s * 2.3, 8 - s * 2.5); c.stroke(); }
      }
    } else if (sp.kind === 'round') {
      legs(c, [-12, -5, 2], 11, ph, sp.col, 8);
      if (sp.sting) { c.beginPath(); c.moveTo(-19, 1); c.lineTo(-27, 5); c.lineTo(-19, 9); c.closePath(); fillLine(c, '#4a4252', '#1f1a24', 1.8); }
      const bx = -6, by = 4, rx = sp.big ? 16 : 14.5, ry = sp.big ? 12.5 : 12;
      ell(c, bx, by, rx, ry); fillLine(c, ball(c, sp.col, bx, by, rx), line(sp.col), 2.6);
      c.save(); ell(c, bx, by, rx, ry); c.clip();
      if (sp.stripes) { c.fillStyle = sp.stripes; for (const sx of [-16, -8]) { c.beginPath(); c.ellipse(sx, by, 3, 14, 0.15, 0, 7); c.fill(); } }
      if (sp.ridges) { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.4; for (const sy of [-2, 4, 10]) { c.beginPath(); c.moveTo(bx - rx, sy); c.quadraticCurveTo(bx, sy + 3, bx + rx, sy); c.stroke(); } }
      c.fillStyle = 'rgba(40,10,30,0.16)'; ell(c, bx + 2, by + 11, rx * 1.1, 6); c.fill();
      c.restore();
      ell(c, bx - 5, by - 6, 5, 2.4, -0.4); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      if (sp.fluff) {
        // 복슬복슬한 목도리
        c.fillStyle = sp.fluff; c.strokeStyle = shade(sp.col, -0.4); c.lineWidth = 1.6;
        const puffs = [[-2, -6], [-4, 0], [-3, 6], [1, 11], [5, 13]];
        for (const [px, py] of puffs) { circ(c, px, py, 4.4); c.fill(); c.stroke(); }
        for (const [px, py] of puffs) { circ(c, px, py, 3.2); c.fill(); }
      }
      hx = 12; hy = -5; hr = 13;
    } else if (sp.kind === 'slim') {
      legs(c, [-8, -3, 2], 9, ph, sp.col, 8);
      blob(c, sp.col, -7, 5, 12, 6);
      c.strokeStyle = shade(sp.col, 0.3); c.lineWidth = 1;
      for (const sx of [-14, -9, -4]) { c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx, 10); c.stroke(); }
      hx = 9; hy = -5; hr = 12;
    } else if (sp.kind === 'dragon') {
      legs(c, [-5, 1], 8, ph, sp.col, 8);
      // 구슬처럼 이어진 꼬리
      for (let s = 5; s >= 0; s--) { const r = 3.4 + s * 0.15; const cx = -32 + s * 5.2; circ(c, cx, 3 - Math.sin(s * 0.5 + ph * 0.5) * 0.8, r); fillLine(c, ball(c, s % 2 ? sp.col : sp.col2, cx, 3, r), line(sp.col), 1.8); }
      blob(c, sp.col, -3, 3, 8.5, 7.5);
      hx = 9; hy = -4; hr = 13;
    }

    // 머리
    if (sp.tri) {
      c.beginPath();
      c.moveTo(hx - hr * 0.9, hy - hr * 0.55);
      c.quadraticCurveTo(hx + hr * 0.2, hy - hr * 1.15, hx + hr * 1.15, hy - hr * 0.5);
      c.quadraticCurveTo(hx + hr * 0.85, hy + hr * 0.75, hx + hr * 0.15, hy + hr * 0.95);
      c.quadraticCurveTo(hx - hr * 0.6, hy + hr * 0.6, hx - hr * 0.9, hy - hr * 0.55);
      fillLine(c, ball(c, sp.head, hx, hy, hr), line(sp.head), 2.8);
    } else {
      circ(c, hx, hy, hr); fillLine(c, ball(c, sp.head, hx, hy, hr), line(sp.head), 2.8);
      underShade(c, hx, hy, hr, hr, 0.16);
    }
    ell(c, hx - hr * 0.35, hy - hr * 0.58, hr * 0.32, hr * 0.14, -0.4); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    if (sp.horn) {
      // 크고 멋진 뿔 + 작은 뿔
      c.beginPath(); c.moveTo(hx + hr * 0.1, hy - hr * 0.85); c.quadraticCurveTo(hx + hr * 1.1, hy - hr * 1.05, hx + hr * 1.25, hy - hr * 2.25);
      c.quadraticCurveTo(hx + hr * 1.55, hy - hr * 1.95, hx + hr * 1.35, hy - hr * 1.6);
      c.quadraticCurveTo(hx + hr * 1.25, hy - hr * 0.55, hx + hr * 0.7, hy - hr * 0.45); c.closePath();
      fillLine(c, ball(c, '#8a3612', hx + hr, hy - hr * 1.4, hr), '#3a1406', 2.4);
      ell(c, hx + hr * 1.0, hy - hr * 1.2, hr * 0.12, hr * 0.32, 0.4); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
    }
    if (sp.jaws) {
      for (const [y0, cy, ty] of [[-0.35, -1.0, -0.55], [0.35, 0.95, 0.4]]) {
        c.beginPath(); c.moveTo(hx + hr * 0.8, hy + hr * y0 - 2.5);
        c.quadraticCurveTo(hx + hr * 1.7, hy + hr * cy, hx + hr * 2.0, hy + hr * ty);
        c.quadraticCurveTo(hx + hr * 1.55, hy + hr * (cy * 0.55), hx + hr * 0.85, hy + hr * y0 + 2.5); c.closePath();
        fillLine(c, ball(c, '#7a5232', hx + hr * 1.5, hy + hr * cy, hr), '#25170c', 2.2);
      }
    }
    if (sp.shovel) {
      c.beginPath(); c.moveTo(hx - hr * 0.6, hy - hr * 0.75);
      for (let s = 0; s < 4; s++) { c.lineTo(hx - hr * 0.35 + s * hr * 0.42, hy - hr * 1.15); c.lineTo(hx - hr * 0.15 + s * hr * 0.42, hy - hr * 0.85); }
      c.closePath(); fillLine(c, ball(c, '#4a5068', hx, hy - hr, hr), '#161925', 2);
    }
    antennae(c, sp, hx, hy, hr, ph);
    face(c, sp, hx, hy, hr, mood, blink);
    c.restore();
  }

  // 카드·목록용 그림 (dataURL, 한 번 만들면 다시 써요)
  const cache = {};
  function portrait(type, px = 96, mood) {
    const key = `${type}:${px}:${mood || ''}`;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
    const c = cv.getContext('2d'); c.scale(2, 2);
    const sp = SPEC[type] || SPEC.ant;
    const big = sp.horn || sp.jaws ? 0.62 : 0.7;
    draw(c, type, px * (sp.jaws ? 0.44 : 0.5), px * 0.64, px * big, { phase: 0.6, mood, fly: false, shadow: true });
    return (cache[key] = cv.toDataURL());
  }

  return { draw, portrait, SPEC };
})();
