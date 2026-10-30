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
  // 서버 검사: 조건을 못 채운 등급은 낮춰요
  assert.strictEqual(Data.cleanEntry('ant', { spd: 2 }, 3).tier, 0);
  assert.strictEqual(Data.cleanEntry('ant', { spd: 3, pow: 3, bal: 2 }, 1).tier, 1);
  assert.strictEqual(Data.cleanEntry('rhino', {}, 0).tier, 3);
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

async function serverMatch() {
  const { io } = require('socket.io-client');
  const PORT = 3900 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  try {
    await new Promise(r => setTimeout(r, 800));
    const results = await Promise.all([0, 1, 2].map(n => new Promise((resolve, reject) => {
      const s = io(`http://localhost:${PORT}`, { transports: ['websocket'] });
      const timer = setTimeout(() => reject(new Error('대결이 끝나지 않았어요')), 45000);
      let me = -1, id = '';
      s.on('connect', () => s.emit('join', { room: 'test', nickname: `학생${n}` }));
      s.on('joined', () => s.emit('queue', { type: 'bee', lv: { spd: 99, pow: -3 } }));
      s.on('battle:start', m => { me = m.me; id = m.id; assert.strictEqual(m.ents.length, 3); assert(m.ents.every(e => !e.bot)); });
      s.on('battle:state', st => {
        if (Math.random() < 0.3) s.emit('input', { id, k: 'tap' });
        if (st.done) { clearTimeout(timer); s.close(); resolve({ me, results: st.results }); }
      });
    })));
    assert.deepStrictEqual(results.map(r => r.me).sort(), [0, 1, 2]);
    console.log('✓ 서버에서 3명 실시간 대결 완료');
  } finally { srv.kill(); }
}

(async () => {
  simAll();
  tierRules();
  skillMatters();
  await serverMatch();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
