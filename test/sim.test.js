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
  skillMatters();
  await serverMatch();
})().catch(e => { console.error('✗', e.message); process.exit(1); });
