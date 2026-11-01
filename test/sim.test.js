// 간단한 점검: 10가지 종목이 모두 끝나고 순위가 올바른지, 서버에서 3명이 실시간 대결을 마칠 수 있는지
'use strict';
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const Data = require('../public/js/insects-data.js');
const Events = require('../public/js/events.js');

function simAll() {
  for (const id of Events.EVENT_IDS) {
    for (let k = 0; k < 20; k++) {
      const ents = Data.makeBots(3, [{ lv: Data.zeroLv() }], 'normal');
      const b = Events.createBattle(id, ents, { countdown: 1 });
      let steps = 0;
      while (!b.done) { Events.step(b, 0.05); assert(++steps < 2000, `${id}: 끝나지 않아요`); }
      assert(b.t <= Events.EVENTS[id].limit + 0.06, `${id}: 제한 시간을 넘었어요`);
      assert.deepStrictEqual(b.results.map(r => r.i).sort(), [0, 1, 2], `${id}: 순위가 이상해요`);
      assert.deepStrictEqual(b.results.map(r => r.rank), [1, 2, 3]);
      JSON.stringify(Events.snap(b));
    }
  }
  console.log(`✓ 종목 ${Events.EVENT_IDS.length}개 시뮬레이션`);
}

// 등급 규칙: 등급이 오를수록 능력치가 분명히 높고, 아래 등급을 아무리 키워도 위 등급의 최고치는 못 넘어요
function tierRules() {
  for (const ins of Data.LIST) {
    assert.strictEqual(ins.base.reduce((a, b) => a + b, 0), 25, `${ins.id}: 기본 능력치 합은 25`);
    for (let t = 0; t < 3; t++) {
      const max = { spd: 99, pow: 99, bal: 99, jmp: 99, sta: 99 };
      assert(Data.powerOf(ins.id, Data.zeroLv(), t + 1) > Data.powerOf(ins.id, Data.zeroLv(), t), '새 등급이 더 세야 해요');
      assert(Data.powerOf(ins.id, max, t + 1) > Data.powerOf(ins.id, max, t), '등급 최고치도 더 세야 해요');
    }
  }
  // 등급은 곤충 종류와 상관없이 채집 확률로 (일반 55 · 희귀 28 · 영웅 12 · 전설 5)
  const cnt = [0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) cnt[Data.rollTier()]++;
  assert(cnt[0] > cnt[1] && cnt[1] > cnt[2] && cnt[2] > cnt[3] && cnt[3] > 600, `등급 확률 ${cnt}`);
  // 등급업: 같은 곤충 모은 수 + 업그레이드 합계 두 조건
  assert.strictEqual(Data.promoInfo('ant', { spd: 4, pow: 2 }, 0, 1).ok, false, '모은 수가 모자라면 안 돼요');
  assert.strictEqual(Data.promoInfo('ant', { spd: 2 }, 0, 2).ok, false, '업그레이드가 모자라면 안 돼요');
  assert.strictEqual(Data.promoInfo('ant', { spd: 4, pow: 2 }, 0, 2).ok, true);
  // 서버 검사: 등급은 0~3, 업그레이드는 등급 한계까지
  assert.strictEqual(Data.cleanEntry('ant', {}, 9).tier, 3);
  assert.strictEqual(Data.cleanEntry('ant', { spd: 12 }, 0).lv.spd, 4, '등급 한계를 넘는 업그레이드는 잘라요');
  console.log('✓ 등급 규칙');
}

// 열심히 누르는 사람이 가만히 있는 사람보다 잘해야 해요 (달리기)
function skillMatters() {
  let wins = 0;
  for (let k = 0; k < 30; k++) {
    const e = { type: 'ant', lv: Data.zeroLv() };
    const b = Events.createBattle('sprint', [{ ...e, name: 'A' }, { ...e, name: 'B' }, { ...e, name: 'C' }], { countdown: 0 });
    while (!b.done) { if (Math.random() < 0.35) Events.input(b, 0, 'tap'); Events.step(b, 0.05); }
    if (b.results[0].i === 0) wins++;
  }
  assert(wins >= 28, `누른 사람이 이긴 횟수 ${wins}/30`);
  console.log('✓ 버튼을 누르면 빨라져요');
}

// 서버 '함께 하기' 한 판: 대기실 → 채집 퀴즈 → 코인 퀴즈 → 연구소 → 대결 → 최종 순위
function startServer(extraEnv) {
  const PORT = 3900 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), BUGEX_FAST: '1', BUGEX_EVENTS: 'sprint', ...extraEnv }, stdio: 'ignore',
  });
  return { srv, url: `http://localhost:${PORT}` };
}
const sampleQ = n => Array.from({ length: n }, (_, i) => ({ type: 'multiple', q: `${i} + 1 = ?`, subject: '수학', options: [String(i + 1), 'x', 'y', 'z'], answer: 0 }));
function player(url, name, code, plan) {
  const { io } = require('socket.io-client');
  return new Promise((resolve, reject) => {
    const s = io(url, { transports: ['websocket'] });
    const log = { waits: 0, coinResults: [], collectOk: 0, battles: 0, end: null };
    const timer = setTimeout(() => reject(new Error(`${name}: 경기가 끝나지 않았어요`)), 60000);
    let id = '';
    s.on('connect', () => s.emit('lobby:join', { code, nickname: name, opts: { collectCount: 7, coinCount: 13, battleCount: plan.battles || 1, labTime: 20, relabTime: 15 } }));
    s.on('lobby', info => { log.lobby = info; if (plan.onLobby) plan.onLobby(s, info); });
    s.on('match:start', d => { log.start = d; if (d.host) s.emit('match:questions', { collect: sampleQ(d.opts.collectCount), coin: sampleQ(d.opts.coinCount) }); });
    s.on('quiz:q', d => setTimeout(() => s.emit('quiz:a', { i: d.i, value: plan.answer(d) }), plan.delay));
    s.on('quiz:wait', () => log.waits++);
    s.on('quiz:r', r => {
      const me = r.results.find(x => x.pid === log.start.you);
      if (r.stage === 'coin') log.coinResults.push(me); else if (me.ok) log.collectOk++;
    });
    s.on('lab', () => { s.emit('lab:pick', { type: 'bee', lv: { spd: 2 }, tier: 0 }); s.emit('lab:ready'); });
    s.on('battle:start', m => { id = m.id; log.battles++; log.n = m.ents.length; (log.mine = log.mine || []).push(m.ents[m.me].type); });
    s.on('battle:state', () => { if (Math.random() < 0.4) s.emit('input', { id, k: 'tap' }); });
    s.on('match:end', d => { clearTimeout(timer); log.end = d; s.close(); resolve(log); });
    s.on('match:abort', d => { clearTimeout(timer); reject(new Error(d.msg)); });
  });
}
async function serverMatch() {
  const { srv, url } = startServer();
  try {
    await new Promise(r => setTimeout(r, 800));
    // 입장 코드 방: 2명이 모두 [지금 시작하기] → AI 없이 2명 경기
    const ready = (s, info) => { if (info.players.length === 2 && !info.players.every(p => p.ready)) s.emit('lobby:ready', { on: true }); };
    const [a, b] = await Promise.all([
      player(url, '빠른학생', 'T1', { onLobby: ready, delay: 10, answer: () => 0, battles: 3 }),
      player(url, '느린학생', 'T1', { onLobby: ready, delay: 120, answer: d => (d.i % 2 ? 1 : 0), battles: 3 }),
    ]);
    assert.strictEqual(a.n, 2, '2명 경기');
    assert.strictEqual(a.collectOk, 7);
    assert(a.waits >= 15, '먼저 푼 학생은 기다리기 안내를 받아요');
    assert.strictEqual(a.coinResults.length, 13);
    assert(a.coinResults.every(r => r.coins === 10), '2명 경기 1등은 10코인');
    assert(b.coinResults.filter(r => r.ok).every(r => r.coins === 5), '2등은 5코인');
    assert(b.coinResults.filter(r => !r.ok).every(r => r.coins === 0), '틀리면 0코인');
    assert.strictEqual(a.battles, 3);
    // 매번 꿀벌을 골라도 3번째 대결에는 다른 곤충으로 나가요 (한 곤충은 2번까지)
    assert.deepStrictEqual(a.mine.slice(0, 2), ['bee', 'bee']);
    assert.notStrictEqual(a.mine[2], 'bee', '꿀벌은 2번까지만 출전');
    assert.strictEqual(a.end.standings.length, 2);
    console.log('✓ 입장 코드 2명: 동시 퀴즈 · 순위 코인 · 연구소 · 대결 3번(곤충마다 2번까지) · 최종 순위');
  } finally { srv.kill(); }
}
async function serverAuto() {
  const { srv, url } = startServer({ BUGEX_WAIT: '1' });
  try {
    await new Promise(r => setTimeout(r, 800));
    // 자동 매칭: 혼자 들어가면 1초 뒤 AI 3마리와 4명 경기
    const a = await player(url, '혼자학생', '', { delay: 10, answer: () => 0, battles: 1 });
    assert.strictEqual(a.n, 4, 'AI가 빈자리를 채워 4명');
    assert.strictEqual(a.start.players.filter(p => p.bot).length, 3);
    assert(a.coinResults.every(r => [20, 15, 10, 5].includes(r.coins)), '4명 경기 코인은 20 · 15 · 10 · 5');
    console.log('✓ 자동 매칭: AI와 4명 경기');
  } finally { srv.kill(); }
}

(async () => {
  simAll();
  tierRules();
  skillMatters();
  await serverMatch();
  await serverAuto();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
