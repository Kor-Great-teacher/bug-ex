// 곤충 대결 10종목 시뮬레이션 (브라우저와 서버가 똑같은 코드를 써요)
// 대결 하나 = 곤충 2~4마리. 서버는 1초에 20번 step() 하고 snap() 을 모두에게 보내요.
// 입력은 세 가지뿐: tap(누르기) · hold(누르고 있기) · dir(왼쪽 -1 / 가운데 0 / 오른쪽 1)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./insects-data.js'));
  else root.BugEvents = factory(root.BugData);
})(typeof self !== 'undefined' ? self : this, function (Data) {
  'use strict';

  const F = s => 0.55 + 0.065 * s;            // 능력치 → 배율 (능력치 2 ≈ 0.68, 19 ≈ 1.79)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = p => Math.random() < p;
  const alive = b => b.ents.filter(e => e.out == null);

  // 결승선 경주 종목 공통 순위: 들어온 시간 → 간 거리
  const raceRank = (key, unit, extra) => b => b.ents.map(e => ({
    i: e.i,
    score: e.fin != null ? 1e6 - e.fin * 1000 : e[key],
    label: (e.fin != null ? `${e.fin.toFixed(2)}초` : `${Math.round(e[key])}${unit}`) + (extra ? extra(e) : ''),
  }));
  const allFinished = b => b.ents.every(e => e.fin != null);

  // ============================================================
  //  종목 정의
  //   control: tap | hold | lr | timing  ·  stats: 중요한 능력치  ·  limit: 제한 시간(초)
  // ============================================================
  const EVENTS = {
    // 1. 달리기 — 누를수록 빨라지지만 체력이 닳아요
    sprint: {
      name: '100cm 달리기', icon: '🏃', control: 'tap', stats: ['spd', 'sta'], limit: 25, len: 100,
      desc: '버튼을 빠르게 눌러 속도를 올려요. 기운(노란 막대)이 바닥나면 느려지니 조절하세요!',
      init(b) { for (const e of b.ents) Object.assign(e, { x: 0, boost: 0, en: 1, v: 0 }); },
      tap(b, e) { if (e.fin == null) e.boost = Math.min(1, e.boost + 0.16); },
      step(b, dt) {
        for (const e of b.ents) {
          if (e.fin != null) { e.v = 0; continue; }
          e.boost = Math.max(0, e.boost - 0.9 * dt);
          e.en = clamp(e.en - e.boost * 0.3 / F(e.st.sta) * dt + 0.12 * dt, 0, 1);
          e.v = 9 * F(e.st.spd) * (1 + 0.85 * e.boost) * (e.en <= 0.02 ? 0.55 : 1);
          e.x += e.v * dt;
          if (e.x >= this.len) { e.x = this.len; e.fin = b.t; }
        }
      },
      bot(b, e, dt) {
        let rate = 5 + 7 * e.skill;
        if (e.skill > 0.45 && e.en < 0.25) rate *= 0.3;
        if (chance(rate * dt)) this.tap(b, e);
      },
      over: allFinished, rank: raceRank('x', 'cm'),
    },

    // 2. 외나무다리 균형잡기 — ◀ ▶ 로 몸을 기울여 바람을 버텨요
    beam: {
      name: '외나무다리 균형잡기', icon: '🪵', control: 'lr', stats: ['bal', 'spd'], limit: 30, len: 60,
      desc: '몸이 기우는 반대쪽 버튼(◀ ▶)을 눌러 균형을 잡아요. 너무 기울면 물에 빠져요!',
      init(b) { for (const e of b.ents) Object.assign(e, { x: 0, tilt: 0, tv: 0, wind: 0, falls: 0, fallT: 0, dir: 0, _rt: 0 }); },
      step(b, dt) {
        for (const e of b.ents) {
          if (e.fin != null) continue;
          if (e.fallT > 0) {
            e.fallT -= dt;
            if (e.fallT <= 0) { e.tilt = 0; e.tv = 0; e.wind = 0; }
            continue;
          }
          e.wind = clamp(e.wind + (Math.random() - 0.5) * 5 * dt, -1, 1);
          e.tv += (e.wind * 1.4 / F(e.st.bal) + e.tilt * 1.6 + e.dir * 3.2) * dt;
          e.tv *= 1 - 2 * dt;
          e.tilt += e.tv * dt;
          if (Math.abs(e.tilt) >= 1) {
            e.tilt = Math.sign(e.tilt); e.falls++; e.fallT = 1.6; e.x = Math.max(0, e.x - 4);
            continue;
          }
          e.x += 4.4 * Math.pow(F(e.st.spd), 0.6) * (1 - 0.65 * Math.abs(e.tilt)) * dt;
          if (e.x >= this.len) { e.x = this.len; e.fin = b.t; }
        }
      },
      bot(b, e, dt) {
        e._rt -= dt;
        if (e._rt > 0) return;
        e._rt = 0.08 + (1 - e.skill) * 0.25;
        const pred = e.tilt + e.tv * 0.35, th = 0.08 + (1 - e.skill) * 0.3;
        e.dir = pred > th ? -1 : pred < -th ? 1 : 0;
        if (chance((1 - e.skill) * 0.12)) e.dir = [-1, 0, 1][Math.floor(Math.random() * 3)];
      },
      over: allFinished, rank: raceRank('x', 'cm', e => e.falls ? ` · 풍덩 ${e.falls}번` : ''),
    },

    // 3. 원형 경기장 밀어내기 — 곤충은 알아서 상대를 향해 가요. 버튼은 돌진!
    sumo: {
      name: '원형 경기장 밀어내기', icon: '⭕', control: 'tap', stats: ['pow', 'bal', 'spd'], limit: 30,
      desc: '버튼을 누르면 가장 가까운 상대에게 돌진해요. 경기장 밖으로 밀려나면 탈락! 경기장은 점점 좁아져요.',
      init(b) {
        b.g.R = 100;
        b.ents.forEach((e, i) => {
          const a = -Math.PI / 2 + i * Math.PI * 2 / b.ents.length;
          Object.assign(e, { x: Math.cos(a) * 48, y: Math.sin(a) * 48, vx: 0, vy: 0, cd: 0, dash: 0, face: Math.cos(a) > 0 ? -1 : 1 });
        });
      },
      target(b, e) {
        let best = null, bd = Infinity;
        for (const o of b.ents) if (o !== e && o.out == null) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
        return best;
      },
      tap(b, e) {
        if (e.out != null || e.cd > 0) return;
        const t = this.target(b, e); if (!t) return;
        const d = Math.hypot(t.x - e.x, t.y - e.y) || 1;
        e.vx += (t.x - e.x) / d * 95 * F(e.st.spd);
        e.vy += (t.y - e.y) / d * 95 * F(e.st.spd);
        e.cd = 1.1 / Math.sqrt(F(e.st.sta)); e.dash = 0.35;
      },
      step(b, dt) {
        const g = b.g;
        g.R = Math.max(36, 100 - Math.max(0, b.t - 8) * 3);
        const live = alive(b);
        for (const e of live) {
          e.cd = Math.max(0, e.cd - dt); e.dash = Math.max(0, e.dash - dt);
          const t = this.target(b, e);
          let dx = 0, dy = 0;
          if (t) { const d = Math.hypot(t.x - e.x, t.y - e.y) || 1; dx = (t.x - e.x) / d; dy = (t.y - e.y) / d; }
          const r = Math.hypot(e.x, e.y);
          if (r > g.R * 0.72) { const w = 0.75; dx = dx * (1 - w) - e.x / r * w; dy = dy * (1 - w) - e.y / r * w; }
          const acc = 55 * F(e.st.spd);
          e.vx += dx * acc * dt; e.vy += dy * acc * dt;
          const damp = 1.4 + 0.8 * F(e.st.bal);
          e.vx *= Math.max(0, 1 - damp * dt); e.vy *= Math.max(0, 1 - damp * dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (Math.abs(e.vx) > 3) e.face = Math.sign(e.vx);
        }
        // 부딪히기: 힘(무게)이 셀수록 덜 밀려요
        for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
          const a = live[i], c = live[j];
          const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = 26;
          if (d >= min) continue;
          const nx = dx / d, ny = dy / d;
          const ma = Math.pow(F(a.st.pow), 1.5), mc = Math.pow(F(c.st.pow), 1.5);
          const over = min - d;
          a.x -= nx * over * mc / (ma + mc); a.y -= ny * over * mc / (ma + mc);
          c.x += nx * over * ma / (ma + mc); c.y += ny * over * ma / (ma + mc);
          const vrel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
          if (vrel > 0) {
            const j2 = 1.9 * vrel / (1 / ma + 1 / mc);
            a.vx -= j2 / ma * nx; a.vy -= j2 / ma * ny;
            c.vx += j2 / mc * nx; c.vy += j2 / mc * ny;
            b.fx.push({ k: 'bump', x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
          }
        }
        for (const e of live) if (Math.hypot(e.x, e.y) > g.R + 4) { e.out = b.t; b.fx.push({ k: 'out', i: e.i }); }
      },
      bot(b, e, dt) {
        if (e.out != null || e.cd > 0) return;
        const t = this.target(b, e); if (!t) return;
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d < 70 && chance((0.6 + 1.6 * e.skill) * dt)) this.tap(b, e);
        else if (e.skill < 0.4 && chance(0.3 * dt)) this.tap(b, e);
      },
      over: b => alive(b).length <= 1,
      rank: b => b.ents.map(e => ({
        i: e.i,
        score: e.out == null ? 1e6 - Math.hypot(e.x, e.y) : e.out * 1000,
        label: e.out == null ? '끝까지 버팀' : `${e.out.toFixed(1)}초 탈락`,
      })),
    },

    // 4. 높이 뛰기 — 힘 막대가 꼭대기에 왔을 때 누르기 (3번 도전)
    highjump: {
      name: '높이 뛰기', icon: '⬆️', control: 'timing', stats: ['jmp'], limit: 26,
      desc: '오르내리는 힘 막대가 맨 위에 닿을 때 버튼을 눌러 뛰어요. 3번 뛰어 가장 높은 기록으로 겨뤄요.',
      needle(e, pt) { const ph = (pt * (0.8 + 0.25 * e.att)) % 2; return ph < 1 ? ph : 2 - ph; },
      init(b) { for (const e of b.ents) Object.assign(e, { att: 0, pt: 0, p: 0, mode: 'aim', h: 0, jh: 0, jt: 0, best: 0, last: -1, _thr: null }); },
      tap(b, e, val) {
        if (e.mode !== 'aim') return;
        // 화면에서 본 막대 위치(val = 시간)를 믿되, 서버 시간과 너무 다르면 서버 값을 써요
        const pt = typeof val === 'number' && Math.abs(val - e.pt) < 0.35 ? val : e.pt;
        this.jump(e, this.needle(e, pt));
      },
      jump(e, q) {
        e.jh = 28 * F(e.st.jmp) * (0.4 + 0.6 * Math.pow(q, 1.6)) + rnd(0, 1.5);
        e.last = e.jh; e.best = Math.max(e.best, e.jh); e.mode = 'jump'; e.jt = 0; e.q = q;
      },
      step(b, dt) {
        for (const e of b.ents) {
          if (e.mode === 'aim') {
            e.pt += dt; e.p = this.needle(e, e.pt);
            if (e.pt > 4) this.jump(e, e.p * 0.5);
          } else if (e.mode === 'jump') {
            e.jt += dt;
            e.h = e.jh * Math.sin(Math.PI * Math.min(1, e.jt / 1.1));
            if (e.jt >= 1.6) { e.h = 0; e.att++; if (e.att >= 3) e.mode = 'done'; else { e.mode = 'aim'; e.pt = 0; e._thr = null; } }
          }
        }
      },
      bot(b, e) {
        if (e.mode !== 'aim') return;
        if (e._thr == null) e._thr = 1 - (0.03 + (1 - e.skill) * 0.45) * Math.random();
        const rising = ((e.pt * (0.8 + 0.25 * e.att)) % 2) < 1;
        if (e.pt > 0.4 && rising && e.p >= e._thr) this.jump(e, e.p);
      },
      over: b => b.ents.every(e => e.mode === 'done'),
      rank: b => b.ents.map(e => ({ i: e.i, score: e.best, label: `${e.best.toFixed(1)}cm` })),
    },

    // 5. 소똥 굴리기 — 너무 빠르지도 느리지도 않게, 박자 맞춰 누르기
    dung: {
      name: '소똥 굴리기 경주', icon: '🟤', control: 'tap', stats: ['pow', 'sta'], limit: 35, len: 100, hill: [40, 75],
      desc: '박자에 맞춰(1초에 3번쯤) 누르면 소똥이 잘 굴러가요. 너무 빨리 누르면 미끄러져요! 언덕에서는 쉬면 굴러 내려가요.',
      init(b) { for (const e of b.ents) Object.assign(e, { x: 0, _lt: -1, slip: 0, q: 0, _next: 0.35 }); },
      onHill(e) { return e.x >= this.hill[0] && e.x < this.hill[1]; },
      tap(b, e) {
        if (e.fin != null) return;
        const gap = b.t - e._lt; e._lt = b.t;
        let q;
        if (gap < 0.16) { q = 0; e.x = Math.max(0, e.x - 1.5); e.slip = 0.5; }
        else if (gap < 0.28) q = 0.5 + (gap - 0.16) / 0.12 * 0.5;
        else if (gap <= 0.6) q = 1;
        else q = Math.max(0.5, 1 - (gap - 0.6));
        e.q = q;
        e.x += 3.1 * F(e.st.pow) * q * (this.onHill(e) ? 0.75 : 1) * (0.85 + 0.15 * F(e.st.sta));
        if (e.x >= this.len) { e.x = this.len; e.fin = b.t; }
      },
      step(b, dt) {
        for (const e of b.ents) {
          e.slip = Math.max(0, e.slip - dt);
          if (e.fin == null && this.onHill(e) && b.t - e._lt > 0.6) e.x = Math.max(this.hill[0], e.x - 3 / F(e.st.sta) * dt);
        }
      },
      bot(b, e) {
        if (b.t - Math.max(0, e._lt) >= e._next) { this.tap(b, e); e._next = Math.max(0.12, 0.34 + (1 - e.skill) * rnd(-0.22, 0.4)); }
      },
      over: allFinished, rank: raceRank('x', 'cm'),
    },

    // 6. 꿀 모으기 — 꽃을 찾아 날아가요. 버튼은 잠깐 빨라지기
    nectar: {
      name: '꽃꿀 모으기', icon: '🌼', control: 'tap', stats: ['spd', 'sta'], limit: 25, W: 230, H: 130,
      desc: '곤충이 가까운 꽃으로 날아가 꿀을 모아요. 버튼을 누르면 잠깐 빨라져요. 황금 꽃은 꿀 3개!',
      init(b) {
        b.g.fl = [];
        b.ents.forEach((e, i) => Object.assign(e, { x: -this.W / 2 + 20, y: (i - (b.ents.length - 1) / 2) * 34, n: 0, cd: 0, dash: 0, _lt: 0, face: 1 }));
        for (let k = 0; k < 7; k++) b.g.fl.push(this.flower(b));
      },
      flower(b) {
        for (let tries = 0; ; tries++) {
          const f = { x: Math.round(rnd(-this.W / 2 + 12, this.W / 2 - 12)), y: Math.round(rnd(-this.H / 2 + 12, this.H / 2 - 12)), v: chance(0.15) ? 3 : 1 };
          if (tries > 20 || b.ents.every(e => Math.hypot(e.x - f.x, e.y - f.y) > 30)) return f;
        }
      },
      tap(b, e) { if (e.cd <= 0) { e.dash = 0.45; e.cd = 1.4 / Math.sqrt(F(e.st.sta)); } },
      step(b, dt) {
        const fl = b.g.fl;
        for (const e of b.ents) {
          e.cd = Math.max(0, e.cd - dt); e.dash = Math.max(0, e.dash - dt);
          let best = null, bs = Infinity;
          for (const f of fl) { const s = Math.hypot(f.x - e.x, f.y - e.y) / Math.pow(f.v, 0.4); if (s < bs) { bs = s; best = f; } }
          if (!best) continue;
          const dx = best.x - e.x, dy = best.y - e.y, d = Math.hypot(dx, dy) || 1;
          const sp = 38 * F(e.st.spd) * (e.dash > 0 ? 2.1 : 1);
          const mv = Math.min(d, sp * dt);
          e.x += dx / d * mv; e.y += dy / d * mv;
          if (Math.abs(dx) > 1) e.face = Math.sign(dx);
          if (d < 10) {
            e.n += best.v; e._lt = b.t;
            b.fx.push({ k: 'nectar', x: best.x, y: best.y, v: best.v, i: e.i });
            fl[fl.indexOf(best)] = this.flower(b);
          }
        }
      },
      bot(b, e, dt) { if (e.cd <= 0 && chance((0.4 + 2 * e.skill) * dt)) this.tap(b, e); },
      over: () => false,
      rank: b => b.ents.map(e => ({ i: e.i, score: e.n * 1000 - e._lt, label: `꿀 ${e.n}개` })),
    },

    // 7. 세 방향 줄다리기 — 가운데 매듭을 내 쪽 깃발까지 끌어오기
    tug: {
      name: '세 방향 줄다리기', icon: '🪢', control: 'tap', stats: ['pow', 'sta'], limit: 25, goal: 32,
      desc: '버튼을 빠르게 눌러 줄을 당겨요. 가운데 매듭이 내 깃발에 닿으면 승리! 기운이 바닥나면 힘이 빠져요.',
      init(b) {
        Object.assign(b.g, { kx: 0, ky: 0, vx: 0, vy: 0 });
        b.ents.forEach((e, i) => {
          const a = -Math.PI / 2 + i * Math.PI * 2 / b.ents.length;
          Object.assign(e, { ux: Math.cos(a), uy: Math.sin(a), grip: 0, en: 1, proj: 0 });
        });
      },
      tap(b, e) { e.grip = Math.min(1, e.grip + 0.22); },
      step(b, dt) {
        const g = b.g; let fx = 0, fy = 0;
        for (const e of b.ents) {
          e.grip = Math.max(0, e.grip - 1.4 * dt);
          e.en = clamp(e.en - e.grip * 0.25 / F(e.st.sta) * dt + 0.08 * dt, 0, 1);
          const f = F(e.st.pow) * (1 + 1.3 * e.grip * (e.en > 0.02 ? 1 : 0.3));
          fx += f * e.ux; fy += f * e.uy;
        }
        g.vx = (g.vx + fx * 10 * dt) * Math.max(0, 1 - 3 * dt);
        g.vy = (g.vy + fy * 10 * dt) * Math.max(0, 1 - 3 * dt);
        g.kx += g.vx * dt; g.ky += g.vy * dt;
        for (const e of b.ents) e.proj = g.kx * e.ux + g.ky * e.uy;
      },
      bot(b, e, dt) {
        let rate = 3 + 6 * e.skill;
        if (e.skill > 0.45 && e.en < 0.2) rate *= 0.25;
        if (chance(rate * dt)) this.tap(b, e);
      },
      over(b) { return b.ents.some(e => e.proj >= this.goal); },
      rank: b => b.ents.map(e => ({ i: e.i, score: e.proj, label: e.proj >= 32 ? '깃발 도착!' : `${e.proj >= 0 ? '+' : ''}${Math.round(e.proj)}cm` })),
    },

    // 8. 나무 오르기 — 쉬지 않고 누르면 힘이 빠져 미끄러져요
    climb: {
      name: '나무 오르기', icon: '🌳', control: 'tap', stats: ['sta', 'pow', 'spd'], limit: 35, len: 100,
      desc: '누를 때마다 위로 올라가요. 기운이 0이 되면 쭉 미끄러지니, 막대를 보며 쉬엄쉬엄 누르세요.',
      init(b) { for (const e of b.ents) Object.assign(e, { y: 0, en: 1, slipT: 0, _lt: -1 }); },
      tap(b, e) {
        if (e.fin != null || e.slipT > 0) return;
        e.y += 2.4 * Math.sqrt(F(e.st.pow) * F(e.st.spd));
        e.en -= 0.065 / F(e.st.sta); e._lt = b.t;
        if (e.en <= 0) { e.slipT = 1.5; e.y = Math.max(0, e.y - 18); e.en = 0.3; b.fx.push({ k: 'slip', i: e.i }); }
        if (e.y >= this.len) { e.y = this.len; e.fin = b.t; }
      },
      step(b, dt) {
        for (const e of b.ents) {
          if (e.fin != null) continue;
          if (e.slipT > 0) { e.slipT -= dt; continue; }
          e.en = Math.min(1, e.en + (0.18 + (b.t - e._lt > 0.3 ? 0.35 : 0)) * dt);
        }
      },
      bot(b, e, dt) {
        let rate = e.skill > 0.45 ? 2.5 + 3 * e.skill : 6;
        if (e.skill > 0.45 && e.en < 0.3) rate = 1.2;
        if (chance(rate * dt)) this.tap(b, e);
      },
      over: allFinished, rank: raceRank('y', 'cm'),
    },

    // 9. 장애물 달리기 — 허들 앞에서 점프!
    hurdles: {
      name: '장애물 달리기', icon: '🚧', control: 'tap', stats: ['spd', 'jmp'], limit: 30, len: 120, H: [18, 34, 50, 66, 82, 98],
      desc: '곤충은 저절로 달려요. 나뭇가지 장애물 바로 앞에서 버튼을 눌러 뛰어넘으세요. 걸리면 넘어져요!',
      init(b) { for (const e of b.ents) Object.assign(e, { x: 0, air: 0, jd: 0.42 + 0.12 * F(e.st.jmp), stun: 0, hits: 0, hi: 0, _jh: -1 }); },
      tap(b, e) { if (e.fin == null && e.air <= 0 && e.stun <= 0) e.air = e.jd; },
      step(b, dt) {
        for (const e of b.ents) {
          if (e.fin != null) continue;
          if (e.stun > 0) { e.stun -= dt; continue; }
          const prev = e.x;
          e.x += 11 * F(e.st.spd) * dt;
          if (e.air > 0) e.air = Math.max(0, e.air - dt);
          const h = this.H[e.hi];
          if (h != null && prev < h && e.x >= h) {
            if (e.air <= 0) { e.stun = 0.6; e.hits++; b.fx.push({ k: 'trip', i: e.i }); }
            e.hi++;
          }
          if (e.x >= this.len) { e.x = this.len; e.fin = b.t; }
        }
      },
      bot(b, e) {
        const h = this.H[e.hi];
        if (h == null || e._jh === e.hi || e.air > 0 || e.stun > 0) return;
        if (e._jit == null || e._jitFor !== e.hi) { e._jitFor = e.hi; e._jit = 0.5 + (1 - e.skill) * rnd(-0.7, 0.7); e._miss = chance((1 - e.skill) * 0.25); }
        if (e._miss) return;
        const v = 11 * F(e.st.spd);
        if (h - e.x < v * e.jd * e._jit) { this.tap(b, e); e._jh = e.hi; }
      },
      over: allFinished, rank: raceRank('x', 'cm', e => e.hits ? ` · 걸림 ${e.hits}` : ''),
    },

    // 10. 풀잎 매달리기 — 돌풍이 불 때만 꽉 잡기
    grass: {
      name: '풀잎 매달리기', icon: '🌬️', control: 'hold', stats: ['bal', 'sta'], limit: 30,
      desc: '돌풍 경고(⚠)가 뜨면 버튼을 누르고 있어 풀잎을 꽉 잡아요. 계속 잡고 있으면 기운이 빠져요!',
      init(b) {
        Object.assign(b.g, { gs: 'calm', gt: 2.2, w: 1, gd: 1 });
        for (const e of b.ents) Object.assign(e, { G: 100, en: 1, hold: false, _react: 0 });
      },
      step(b, dt) {
        const g = b.g;
        g.gt -= dt;
        if (g.gt <= 0) {
          if (g.gs === 'calm') { g.gs = 'warn'; g.gt = 0.9; g.gd = chance(0.5) ? 1 : -1; g.w = 0.8 + Math.min(1, b.t / 30) + rnd(0, 0.3); }
          else if (g.gs === 'warn') { g.gs = 'gust'; g.gt = rnd(1, 1.6); }
          else { g.gs = 'calm'; g.gt = rnd(1.2, 2.6); }
        }
        for (const e of b.ents) {
          if (e.out != null) continue;
          const holding = e.hold && e.en > 0;
          if (g.gs === 'gust') e.G -= (holding ? 4 : 28) * g.w / F(e.st.bal) * dt;
          if (holding) e.en = Math.max(0, e.en - 0.32 / F(e.st.sta) * dt);
          else { e.en = Math.min(1, e.en + 0.3 * dt); if (g.gs === 'calm') e.G = Math.min(100, e.G + 1.5 * dt); }
          if (e.G <= 0) { e.G = 0; e.out = b.t; b.fx.push({ k: 'out', i: e.i }); }
        }
      },
      bot(b, e, dt) {
        const g = b.g;
        if (g.gs === 'calm') { e._react = 0; e.hold = e.skill < 0.4 && chance(0.15) ? !e.hold : false; return; }
        e._react += dt;
        const delay = g.gs === 'warn' ? (e.skill > 0.6 ? 0.4 : 9) : (1 - e.skill) * 0.7;
        e.hold = e._react >= delay || (g.gs === 'gust' && e.skill > 0.6);
      },
      over: b => alive(b).length <= 1 && b.ents.some(e => e.out != null),
      rank: b => b.ents.map(e => ({
        i: e.i,
        score: e.out == null ? 1e6 + e.G : e.out * 1000,
        label: e.out == null ? `버팀 ${Math.round(e.G)}%` : `${e.out.toFixed(1)}초에 날아감`,
      })),
    },
  };
  const EVENT_IDS = Object.keys(EVENTS);

  // ============================================================
  //  대결 만들기 · 진행 · 입력 · 화면용 요약
  // ============================================================
  // entrants: [{ name, type, lv, tier, bot, skill }]  (2~4마리)
  function createBattle(eventId, entrants, opt = {}) {
    const ev = EVENTS[eventId] || EVENTS.sprint;
    const b = {
      ev: EVENTS[eventId] ? eventId : 'sprint',
      t: -(opt.countdown != null ? opt.countdown : 3),
      done: false, results: null, g: {}, fx: [],
      ents: entrants.map((en, i) => ({
        i, name: en.name, type: en.type, bot: !!en.bot, skill: en.skill != null ? en.skill : 0.6,
        st: Data.statsOf(en.type, en.lv, en.tier), tier: Data.tierOf(en.type, en.tier), fin: null, out: null, hold: false, dir: 0,
      })),
    };
    ev.init(b);
    return b;
  }
  function step(b, dt) {
    if (b.done) return;
    b.t += dt;
    if (b.t < 0) return;
    const ev = EVENTS[b.ev];
    for (const e of b.ents) if (e.bot && ev.bot) ev.bot(b, e, dt);
    ev.step(b, dt);
    if (b.t >= ev.limit || ev.over(b)) finish(b);
  }
  function finish(b) {
    const list = EVENTS[b.ev].rank(b).sort((x, y) => y.score - x.score);
    b.results = list.map((r, k) => ({ i: r.i, rank: k + 1, label: r.label }));
    b.done = true;
  }
  // 사람 입력 (컴퓨터가 대신 하는 중이면 무시)
  function input(b, i, kind, val) {
    const e = b.ents[i];
    if (!e || e.bot || b.done || b.t < 0) return;
    const ev = EVENTS[b.ev];
    if (kind === 'tap' && ev.tap) ev.tap(b, e, val);
    else if (kind === 'hold') e.hold = !!val;
    else if (kind === 'dir') e.dir = clamp(Math.round(Number(val) || 0), -1, 1);
  }
  // 나간 사람의 곤충은 AI가 이어서 해요
  function takeOver(b, i, skill = 0.5) { const e = b.ents[i]; if (e) { e.bot = true; e.skill = skill; } }

  // 네트워크·그리기용 요약: 밑줄(_)로 시작하는 값과 능력치는 빼고, 숫자는 짧게
  const round = v => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  function slim(o) {
    if (Array.isArray(o)) return o.map(slim);
    if (!o || typeof o !== 'object') return round(o);
    const r = {};
    for (const k in o) if (k[0] !== '_' && k !== 'st' && k !== 'skill' && k !== 'name' && k !== 'type') r[k] = slim(o[k]);
    return r;
  }
  function snap(b) {
    const s = { t: round(b.t), done: b.done, g: slim(b.g), e: slim(b.ents), fx: b.fx };
    b.fx = [];
    if (b.done) s.results = b.results;
    return s;
  }
  function pickEvent(enabled, last) {
    let ids = EVENT_IDS.filter(id => !enabled || enabled[id] !== false);
    if (!ids.length) ids = EVENT_IDS.slice();
    if (ids.length > 1 && last) ids = ids.filter(id => id !== last);
    return ids[Math.floor(Math.random() * ids.length)];
  }

  return { EVENTS, EVENT_IDS, F, createBattle, step, input, takeOver, snap, pickEvent };
});
