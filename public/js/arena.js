// 대결 화면 그리기 (960×540 캔버스). 서버나 내 컴퓨터가 보낸 상태(snap)를 받아 그려요.
window.BugArena = (() => {
  'use strict';
  const W = 960, H = 540;
  const COLORS = ['#ef4444', '#3b82f6', '#22c55e'];
  const E = () => window.BugEvents.EVENTS;
  const draw = (...a) => window.BugArt.draw(...a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- 공통 그리기 도구 ----------
  function sky(c, top = '#bfe6ff', bottom = '#eaf7ff') {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, s] of [[120, 70, 1], [420, 50, 0.8], [760, 80, 1.1]]) {
      c.beginPath(); c.arc(x, y, 22 * s, 0, 7); c.arc(x + 26 * s, y - 8 * s, 26 * s, 0, 7); c.arc(x + 54 * s, y, 20 * s, 0, 7); c.fill();
    }
  }
  function grassBg(c, col1 = '#9ad46a', col2 = '#7cc04f') {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col1); g.addColorStop(1, col2);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(40,90,30,0.25)'; c.lineWidth = 2;
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % W, y = (i * 53) % H;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 8); c.moveTo(x + 4, y); c.lineTo(x + 8, y - 6); c.stroke();
    }
  }
  function tag(c, x, y, text, color, me) {
    c.save();
    c.font = '15px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const label = me ? `★ ${text}` : text, w = c.measureText(label).width + 16;
    c.fillStyle = color; c.beginPath(); c.roundRect(x - w / 2, y - 11, w, 22, 11); c.fill();
    if (me) { c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke(); }
    c.fillStyle = '#fff'; c.fillText(label, x, y + 1);
    c.restore();
  }
  function bar(c, x, y, w, h, v, col, bg = 'rgba(0,0,0,0.25)') {
    c.fillStyle = bg; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.roundRect(x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); c.fill();
  }
  function text(c, s, x, y, size = 18, col = '#1f2937', align = 'center', stroke) {
    c.font = `${size}px Jua, sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
    if (stroke) { c.lineWidth = 5; c.strokeStyle = stroke; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  const mood = (e, extra) => extra || (e.fin != null ? 'happy' : undefined);

  // 가로 3줄 경주 공통 배경 (달리기 · 소똥 · 장애물 · 외나무다리)
  const LANE_Y = [190, 325, 460], X0 = 90, X1 = 870;
  const laneX = (v, len) => X0 + (X1 - X0) * clamp(v / len, 0, 1);
  function lanes(c, finish = true, ground = '#d6b77a') {
    sky(c);
    c.fillStyle = '#8fd16a'; c.fillRect(0, 120, W, H - 120);
    LANE_Y.forEach(y => {
      c.fillStyle = ground; c.fillRect(0, y - 6, W, 30);
      c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, y + 20, W, 4);
    });
    if (finish) LANE_Y.forEach(y => {
      for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#111' : '#fff'; c.fillRect(X1 - 4, y - 6 + k * 5, 8, 5); }
    });
    c.fillStyle = 'rgba(255,255,255,0.5)'; LANE_Y.forEach(y => c.fillRect(X0 - 2, y - 6, 4, 30));
  }

  // ---------- 종목별 그리기 ----------
  const R = {};
  R.sprint = (c, s, m) => {
    lanes(c);
    s.e.forEach((e, i) => {
      const y = LANE_Y[i], x = laneX(e.x, 100), en = m.ents[i];
      if (e.boost > 0.2 && e.fin == null) { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x - 36 - k * 4, y - 6 + k * 8); c.lineTo(x - 56 - e.boost * 30, y - 6 + k * 8); c.stroke(); } }
      draw(c, en.type, x, y - 4, 64, { phase: s.t * (8 + e.v), mood: mood(e, e.en < 0.05 ? 'strain' : null) });
      tag(c, x, y - 56, en.name, COLORS[i], i === m.me);
      bar(c, x - 26, y - 42, 52, 6, e.en, '#fbbf24');
    });
  };
  R.beam = (c, s, m) => {
    sky(c, '#c7ecff', '#e0f7ff');
    LANE_Y.forEach(y => {
      c.fillStyle = '#4fb3e8'; c.fillRect(0, y + 10, W, 40);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      for (let x = (s.t * 30) % 40; x < W; x += 40) { c.beginPath(); c.moveTo(x, y + 24); c.quadraticCurveTo(x + 10, y + 19, x + 20, y + 24); c.stroke(); }
      c.fillStyle = '#9a6a3a'; c.beginPath(); c.roundRect(X0 - 20, y - 4, X1 - X0 + 40, 14, 7); c.fill();
      c.strokeStyle = '#6b4423'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#7cc04f'; c.fillRect(0, y - 6, X0 - 20, 60); c.fillRect(X1 + 20, y - 6, W, 60);
    });
    s.e.forEach((e, i) => {
      const y = LANE_Y[i], x = laneX(e.x, 60), en = m.ents[i];
      if (e.fallT > 0) {
        const k = 1 - e.fallT / 1.6;
        draw(c, en.type, x + e.tilt * 18, y + 6 + Math.min(1, k * 3) * 22, 58, { mood: 'dizzy', rot: e.tilt * 1.2 });
        c.fillStyle = 'rgba(255,255,255,0.8)'; for (let d = 0; d < 5; d++) { c.beginPath(); c.arc(x + (d - 2) * 10, y + 14 - Math.sin(k * 6 + d) * 8, 3, 0, 7); c.fill(); }
      } else {
        draw(c, en.type, x, y - 8, 58, { rot: e.tilt * 0.7, phase: s.t * 8, mood: mood(e, Math.abs(e.tilt) > 0.6 ? 'strain' : null) });
      }
      tag(c, x, y - 58, en.name, COLORS[i], i === m.me);
      // 기울기 막대: 가운데가 안전
      const gx = x - 32, gy = y - 44;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.roundRect(gx, gy, 64, 7, 3.5); c.fill();
      c.fillStyle = 'rgba(74,222,128,0.8)'; c.fillRect(gx + 22, gy, 20, 7);
      c.fillStyle = Math.abs(e.tilt) > 0.6 ? '#ef4444' : '#fff'; c.beginPath(); c.arc(gx + 32 + e.tilt * 30, gy + 3.5, 5, 0, 7); c.fill();
    });
    if (m.me != null && s.e[m.me]) {
      const e = s.e[m.me];
      if (e.fin == null && e.fallT <= 0 && Math.abs(e.tilt) > 0.45) text(c, e.tilt > 0 ? '◀ 왼쪽을 눌러요!' : '오른쪽을 눌러요! ▶', W / 2, 115, 26, '#b91c1c', 'center', '#fff');
    }
  };
  R.sumo = (c, s, m) => {
    grassBg(c);
    const cx = W / 2, cy = 290, k = 2.3;
    c.fillStyle = '#a0723f'; c.beginPath(); c.arc(cx, cy, 104 * k, 0, 7); c.fill();
    c.fillStyle = '#e2b77a'; c.beginPath(); c.arc(cx, cy, 100 * k, 0, 7); c.fill();
    c.strokeStyle = 'rgba(140,90,40,0.35)'; c.lineWidth = 2;
    for (let r = 18; r < 100; r += 16) { c.beginPath(); c.arc(cx, cy, r * k, 0, 7); c.stroke(); }
    // 좁아지는 경기장
    c.save(); c.beginPath(); c.arc(cx, cy, 104 * k, 0, 7); c.arc(cx, cy, s.g.R * k, 0, 7, true); c.fillStyle = 'rgba(80,40,10,0.35)'; c.fill(); c.restore();
    c.setLineDash([12, 8]); c.strokeStyle = '#dc2626'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, s.g.R * k, 0, 7); c.stroke(); c.setLineDash([]);
    s.e.forEach((e, i) => {
      const en = m.ents[i];
      if (e.out != null) return;
      const x = cx + e.x * k, y = cy + e.y * k;
      if (e.dash > 0) { c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - e.vx * 0.3, y - e.vy * 0.3); c.lineTo(x, y); c.stroke(); }
      c.strokeStyle = COLORS[i]; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y + 16, 26, 8, 0, 0, 7); c.stroke();
      draw(c, en.type, x, y, 62, { flip: e.face < 0, phase: s.t * 10, mood: e.dash > 0 ? 'strain' : undefined });
      tag(c, x, y - 46, en.name, COLORS[i], i === m.me);
      if (i === m.me) bar(c, x - 24, y + 28, 48, 6, 1 - e.cd / 1.6, '#38bdf8');
    });
    s.e.forEach((e, i) => { if (e.out != null) text(c, `${m.ents[i].name} 탈락!`, 140, 140 + i * 28, 18, COLORS[i], 'center', '#fff'); });
  };
  R.highjump = (c, s, m) => {
    sky(c);
    const G = 480, k = 7;
    c.fillStyle = '#8fd16a'; c.fillRect(0, G, W, H - G);
    // 눈금
    c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 1; c.font = '13px Jua'; c.fillStyle = 'rgba(0,0,0,0.45)'; c.textAlign = 'right';
    for (let h = 10; h <= 50; h += 10) { const y = G - h * k; c.beginPath(); c.moveTo(40, y); c.lineTo(W - 20, y); c.stroke(); c.fillText(`${h}cm`, 36, y + 4); }
    s.e.forEach((e, i) => {
      const x = 220 + i * 260, en = m.ents[i];
      // 최고 기록 표시
      if (e.best > 0) { const y = G - e.best * k; c.strokeStyle = COLORS[i]; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 50, y); c.lineTo(x + 50, y); c.stroke(); text(c, `${e.best.toFixed(1)}`, x + 58, y, 15, COLORS[i], 'left', '#fff'); }
      draw(c, en.type, x, G - 18 - e.h * k, 66, { phase: e.mode === 'jump' ? 0 : s.t * 4, mood: e.mode === 'jump' ? 'happy' : undefined });
      tag(c, x, G + 30, en.name, COLORS[i], i === m.me);
      // 힘 막대 (꼭대기 = 최고)
      const bx = x + 70, by = G - 170, bh = 150;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.roundRect(bx, by, 16, bh, 8); c.fill();
      const gr = c.createLinearGradient(0, by + bh, 0, by); gr.addColorStop(0, '#60a5fa'); gr.addColorStop(0.75, '#facc15'); gr.addColorStop(1, '#ef4444');
      c.fillStyle = gr; c.beginPath(); c.roundRect(bx + 3, by + 3 + (bh - 6) * (1 - (e.mode === 'aim' ? e.p : e.q || 0)), 10, (bh - 6) * (e.mode === 'aim' ? e.p : e.q || 0), 5); c.fill();
      text(c, `${Math.min(3, e.att + (e.mode === 'aim' ? 1 : 0))}/3`, bx + 8, by - 14, 14, '#1f2937');
    });
  };
  R.dung = (c, s, m) => {
    lanes(c, true, '#c9a66b');
    const ev = E().dung, [h0, h1] = ev.hill;
    LANE_Y.forEach(y => {
      const a = laneX(h0, 100), b = laneX(h1, 100);
      c.fillStyle = '#b08850'; c.beginPath(); c.moveTo(a, y - 6); c.quadraticCurveTo((a + b) / 2, y - 46, b, y - 6); c.closePath(); c.fill();
    });
    const hillY = x => (x < h0 || x > h1) ? 0 : Math.sin(Math.PI * (x - h0) / (h1 - h0)) * 20;
    s.e.forEach((e, i) => {
      const y0 = LANE_Y[i], x = laneX(e.x, 100), en = m.ents[i];
      const bxv = Math.min(100, e.x + 3), bx = laneX(bxv, 100), y = y0 - hillY(e.x), by = y0 - hillY(bxv);
      // 소똥 공
      c.save(); c.translate(bx + 10, by + 2); c.rotate(e.x * 0.3);
      c.fillStyle = '#7a5230'; c.beginPath(); c.arc(0, 0, 17, 0, 7); c.fill(); c.strokeStyle = '#4a3020'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#5c3b22'; for (const [dx, dy] of [[5, -4], [-6, 3], [2, 7]]) { c.beginPath(); c.arc(dx, dy, 2.5, 0, 7); c.fill(); }
      c.restore();
      draw(c, en.type, x - 18, y - 6, 56, { phase: s.t * 8, rot: -0.2, mood: mood(e, e.slip > 0 ? 'dizzy' : 'strain') });
      tag(c, x - 10, y - 56, en.name, COLORS[i], i === m.me);
      if (i === m.me && e.fin == null) text(c, e.slip > 0 ? '너무 빨라요!' : e.q >= 1 ? '좋은 박자!' : '', x + 40, y - 40, 15, e.slip > 0 ? '#b91c1c' : '#15803d', 'left', '#fff');
    });
  };
  R.nectar = (c, s, m) => {
    grassBg(c, '#a7dc7c', '#86c95a');
    const ev = E().nectar, k = 3.6, cx = W / 2, cy = 290;
    (s.g.fl || []).forEach(f => {
      const x = cx + f.x * k, y = cy + f.y * k, gold = f.v > 1;
      c.fillStyle = '#4d7c0f'; c.fillRect(x - 1.5, y, 3, 16);
      c.fillStyle = gold ? '#fbbf24' : '#fff';
      for (let p = 0; p < 6; p++) { const a = p * Math.PI / 3 + s.t * 0.5; c.beginPath(); c.ellipse(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 4, a, 0, 7); c.fill(); }
      c.fillStyle = gold ? '#f97316' : '#facc15'; c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fill();
      if (gold) text(c, '×3', x + 16, y - 14, 13, '#b45309', 'left', '#fff');
    });
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.strokeRect(cx - ev.W / 2 * k - 20, cy - ev.H / 2 * k - 20, ev.W * k + 40, ev.H * k + 40);
    s.e.forEach((e, i) => {
      const x = cx + e.x * k, y = cy + e.y * k, en = m.ents[i];
      draw(c, en.type, x, y, 54, { flip: e.face < 0, fly: true, phase: s.t * 6 + i, mood: e.dash > 0 ? 'strain' : undefined });
      tag(c, x, y - 44, `${en.name} 🍯${e.n}`, COLORS[i], i === m.me);
    });
  };
  R.tug = (c, s, m) => {
    grassBg(c);
    const cx = W / 2, cy = 290, k = 4, goal = E().tug.goal;
    const kx = cx + s.g.kx * k, ky = cy + s.g.ky * k;
    s.e.forEach((e, i) => {
      // 깃발
      const fx = cx + e.ux * goal * k, fy = cy + e.uy * goal * k;
      c.strokeStyle = '#6b4423'; c.lineWidth = 3; c.beginPath(); c.moveTo(fx, fy + 12); c.lineTo(fx, fy - 22); c.stroke();
      c.fillStyle = COLORS[i]; c.beginPath(); c.moveTo(fx, fy - 22); c.lineTo(fx + 22, fy - 15); c.lineTo(fx, fy - 8); c.fill();
    });
    s.e.forEach((e, i) => {
      const en = m.ents[i], dist = 230 - e.proj * 1.5;
      const x = kx + e.ux * dist, y = ky + e.uy * dist;
      c.strokeStyle = '#d6a65a'; c.lineWidth = 6; c.beginPath(); c.moveTo(kx, ky); c.lineTo(x, y); c.stroke();
      c.strokeStyle = '#a77a3a'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(kx, ky); c.lineTo(x, y); c.stroke(); c.setLineDash([]);
      draw(c, en.type, x + e.ux * 14, y + e.uy * 14, 62, { flip: e.ux > 0.1, phase: s.t * (4 + e.grip * 10), mood: e.grip > 0.4 ? 'strain' : undefined });
      tag(c, x + e.ux * 14, y + e.uy * 14 - 44, en.name, COLORS[i], i === m.me);
      bar(c, x + e.ux * 14 - 24, y + e.uy * 14 + 30, 48, 6, e.en, '#fbbf24');
    });
    c.fillStyle = '#dc2626'; c.beginPath(); c.arc(kx, ky, 11, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
  };
  R.climb = (c, s, m) => {
    sky(c, '#a5dcff', '#e6f6ff');
    c.fillStyle = '#8fd16a'; c.fillRect(0, 500, W, 40);
    const top = 90, bot = 500;
    s.e.forEach((e, i) => {
      const x = 220 + i * 260, en = m.ents[i];
      c.fillStyle = '#8b5a2b'; c.fillRect(x - 26, top - 10, 52, bot - top + 10);
      c.strokeStyle = 'rgba(60,30,10,0.35)'; c.lineWidth = 2;
      for (let y = top + 20; y < bot; y += 34) { c.beginPath(); c.moveTo(x - 20, y); c.quadraticCurveTo(x, y + 8, x + 18, y - 4); c.stroke(); }
      c.fillStyle = '#4caf50'; for (const [dx, dy, r] of [[-40, 0, 40], [30, -10, 44], [0, -40, 46]]) { c.beginPath(); c.arc(x + dx, top + dy, r, 0, 7); c.fill(); }
      c.fillStyle = '#ef4444'; c.beginPath(); c.arc(x + 20, top - 20, 7, 0, 7); c.fill();
      const y = bot - 20 - (bot - top - 40) * (e.y / 100);
      draw(c, en.type, x, y, 58, { rot: -Math.PI / 2, phase: s.t * 6, mood: mood(e, e.slipT > 0 ? 'dizzy' : e.en < 0.25 ? 'strain' : null) });
      tag(c, x, bot + 20, en.name, COLORS[i], i === m.me);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.roundRect(x + 34, y - 30, 9, 60, 4); c.fill();
      c.fillStyle = e.en < 0.25 ? '#ef4444' : '#fbbf24'; c.beginPath(); c.roundRect(x + 34, y + 30 - 60 * e.en, 9, 60 * e.en, 4); c.fill();
    });
  };
  R.hurdles = (c, s, m) => {
    lanes(c);
    const ev = E().hurdles;
    s.e.forEach((e, i) => {
      const y = LANE_Y[i], en = m.ents[i];
      ev.H.forEach((h, k) => {
        const hx = laneX(h, ev.len);
        const knocked = k < e.hi && e.hits > 0;
        c.strokeStyle = '#7a4e2a'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(hx - 8, y + 18); c.lineTo(hx - 8, y - 14); c.moveTo(hx + 8, y + 18); c.lineTo(hx + 8, y - 14); c.stroke();
        c.strokeStyle = knocked ? '#a3a3a3' : '#16a34a'; c.beginPath(); c.moveTo(hx - 12, y - 14); c.lineTo(hx + 12, y - 14); c.stroke();
      });
      const x = laneX(e.x, ev.len);
      const hop = e.air > 0 ? Math.sin(Math.PI * (1 - e.air / e.jd)) * 46 : 0;
      draw(c, en.type, x, y - 4 - hop, 58, { phase: s.t * 12, mood: mood(e, e.stun > 0 ? 'dizzy' : null) });
      tag(c, x, y - 58 - hop, en.name, COLORS[i], i === m.me);
    });
  };
  R.grass = (c, s, m) => {
    sky(c, '#9fd3f5', '#dff3ff');
    const g = s.g, wind = g.gs === 'gust' ? g.w * g.gd : g.gs === 'warn' ? 0.15 * g.gd : Math.sin(s.t * 1.3) * 0.06;
    c.fillStyle = '#7cc04f'; c.fillRect(0, 470, W, 70);
    if (g.gs === 'gust') {
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3;
      for (let k = 0; k < 14; k++) { const y = 60 + (k * 37) % 400, x = ((s.t * 900 * g.gd + k * 211) % (W + 200) + W + 200) % (W + 200) - 100; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 70 * g.gd, y); c.stroke(); }
    }
    s.e.forEach((e, i) => {
      const bx = 220 + i * 260, en = m.ents[i];
      const bend = wind * 70 + Math.sin(s.t * 3 + i) * 4;
      const tipX = bx + bend, tipY = 170;
      c.strokeStyle = '#3f9b2b'; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(bx, 480); c.quadraticCurveTo(bx + bend * 0.2, 300, tipX, tipY); c.stroke();
      c.fillStyle = '#4caf50'; c.beginPath(); c.ellipse(tipX, tipY - 6, 30, 9, -0.3 + wind * 0.4, 0, 7); c.fill();
      if (e.out != null) {
        const k = Math.min(1, (s.t - e.out) / 1.5);
        draw(c, en.type, tipX + g.gd * k * 500, tipY + 30 - k * 120, 54, { rot: k * 8, mood: 'dizzy' });
      } else {
        draw(c, en.type, tipX + wind * 18, tipY + 24, 58, { rot: wind * 0.6, phase: s.t * 3, mood: e.hold ? 'strain' : undefined });
      }
      tag(c, bx, 505, en.name, COLORS[i], i === m.me);
      bar(c, bx - 40, 230, 80, 9, e.G / 100, e.G < 35 ? '#ef4444' : '#22c55e');
      bar(c, bx - 40, 244, 80, 6, e.en, '#fbbf24');
      if (e.hold && e.out == null) text(c, '꽉!', bx + 54, 236, 16, '#1d4ed8', 'left', '#fff');
    });
    if (g.gs === 'warn') text(c, `⚠ 돌풍이 와요! ${g.gd > 0 ? '→' : '←'}`, W / 2, 110, 34, '#b91c1c', 'center', '#fff');
    if (g.gs === 'gust') text(c, '휘이잉~!', W / 2, 110, 30, '#1e3a8a', 'center', '#fff');
  };

  // ---------- 전체 그리기 ----------
  function render(c, s, m) {
    if (!s) return;
    c.save();
    R[m.ev](c, s, m);
    const ev = E()[m.ev];
    // 위쪽: 종목 이름 + 남은 시간
    c.fillStyle = 'rgba(15,23,42,0.6)'; c.beginPath(); c.roundRect(12, 10, 300, 40, 12); c.fill();
    text(c, `${ev.icon} ${ev.name}`, 26, 31, 21, '#fff', 'left');
    const left = Math.max(0, Math.ceil(ev.limit - Math.max(0, s.t)));
    c.fillStyle = 'rgba(15,23,42,0.6)'; c.beginPath(); c.roundRect(W - 112, 10, 100, 40, 12); c.fill();
    text(c, `⏱ ${left}초`, W - 62, 31, 21, left <= 5 ? '#fca5a5' : '#fff');
    if (s.t < 0) {
      c.fillStyle = 'rgba(15,23,42,0.35)'; c.fillRect(0, 0, W, H);
      text(c, String(Math.ceil(-s.t)), W / 2, H / 2 - 10, 120, '#fde047', 'center', '#1f2937');
      text(c, '준비!', W / 2, H / 2 + 70, 30, '#fff', 'center', '#1f2937');
    } else if (s.t < 0.8) text(c, '시작!', W / 2, H / 2, 90, '#fde047', 'center', '#1f2937');
    c.restore();
  }
  return { W, H, COLORS, render };
})();
