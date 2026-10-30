// 꼬마 파브르 곤충 리그 — 실시간 '함께 하기' 서버 (Render 배포용)
// 정적 파일(public/) + Socket.IO. 한 판(경기)은 최대 4명이 함께해요.
//   대기실 → ① 곤충 채집 퀴즈(모두 같은 문제, 다 풀면 정답 공개) → ② 코인 퀴즈(빨리 맞힐수록 코인 많이)
//   → ③ 연구소(2분) → ④ 대결 → 연구소(1분) → 대결 … (3차전까지) → 최종 순위
// 대결 계산은 서버가 하고(1초에 20번), 모두에게 같은 화면 상태를 보내요.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Data = require('./public/js/insects-data.js');
const Events = require('./public/js/events.js');

const PORT = process.env.PORT || 3000;
const FAST = !!process.env.BUGEX_FAST;          // 테스트용: 기다리는 시간을 아주 짧게
const TICK = 0.05;                              // 대결 계산 간격 (초)
const COUNTDOWN = FAST ? 0.3 : 3;               // 대결 시작 전 3, 2, 1
const MAX_PLAYERS = 4;
const REVEAL_MS = { collect: FAST ? 100 : 3500, coin: FAST ? 100 : 2500 }; // 문제마다 정답·순위 보여 주는 시간
const STAGE_GAP_MS = FAST ? 100 : 2500;         // 채집 → 코인 퀴즈 넘어가기 전 안내
const RESULT_MS = FAST ? 200 : 6000;            // 대결 결과 보여 주는 시간
const BATTLE_COINS = [60, 40, 25, 15];          // 대결 등수별 코인
const USE_LIMIT = 2;                            // 한 곤충이 나갈 수 있는 대결 수
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ---------- 전역 설정 (config.json) ----------
// 경기를 시작할 때마다 다시 읽어요. GitHub에서 고치면 Render가 다시 배포하면서 바로 적용돼요.
function serverSettings() {
  const def = { difficulty: 'normal', matchWait: 30, events: null };
  try {
    const j = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const s = j.settings || j;
    return {
      difficulty: ['easy', 'normal', 'hard'].includes(s.difficulty) ? s.difficulty : def.difficulty,
      matchWait: Number(process.env.BUGEX_WAIT) || Math.max(5, Math.min(120, Number(s.matchWait) || def.matchWait)),
      events: process.env.BUGEX_EVENTS ? Object.fromEntries(Events.EVENT_IDS.map(id => [id, process.env.BUGEX_EVENTS.split(',').includes(id)]))
        : s.events && typeof s.events === 'object' ? s.events : null,
    };
  } catch (e) { return def; }
}

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/config.json', (req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(CONFIG_FILE); });
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 15000 });

// ============================================================
//  경기(match)
//  M = { id, code, mode: 'code'|'auto', phase: 'lobby'|'prep'|'quiz'|'lab'|'battle'|'end',
//        players: [{ pid, sid, nick, bot, skill, ready, gone, labReady, pick, quizCoins, pts, places }],
//        opts, cfg, questions, stage, qi, q, battleNo, bt, timer, aiDeadline }
// ============================================================
const matches = new Map();
const lobbyByCode = new Map();      // 입장 코드 → 대기 중인 경기
let openAuto = null;                // 자동 매칭 대기 중인 경기
let seq = 1;

const cleanCode = s => String(s || '').replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 12);
const cleanNick = s => String(s || '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, 12) || '도전자';
const clampNum = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, n)) : def; };
const humans = M => M.players.filter(p => !p.bot);
const active = M => M.players.filter(p => !p.bot && !p.gone);
const sockOf = p => p.sid && io.sockets.sockets.get(p.sid);
const emitAll = (M, ev, data) => io.to(`m:${M.id}`).emit(ev, data);
function later(M, ms, fn) { clearTimeout(M.timer); M.timer = setTimeout(() => { M.timer = null; if (matches.has(M.id)) fn(); }, ms); }

function newMatch(code) {
  const M = {
    id: String(seq++), code, mode: code ? 'code' : 'auto', phase: 'lobby', players: [], timer: null, aiTimer: null, aiDeadline: 0,
    opts: null, cfg: serverSettings(), questions: null, stage: null, qi: 0, q: null, battleNo: 0, bt: null, lastEvent: null,
  };
  matches.set(M.id, M);
  if (code) lobbyByCode.set(code, M); else openAuto = M;
  return M;
}
function lobbyInfo(M) {
  return {
    id: M.id, code: M.code, mode: M.mode, max: MAX_PLAYERS,
    players: M.players.map(p => ({ pid: p.pid, nick: p.nick, bot: p.bot, ready: p.ready })),
    aiLeft: M.aiDeadline ? Math.max(0, Math.ceil((M.aiDeadline - Date.now()) / 1000)) : 0,
    canStart: humans(M).length >= 2,
  };
}
const sendLobby = M => emitAll(M, 'lobby', lobbyInfo(M));

// ---------- 대기실 ----------
function joinLobby(socket, msg) {
  leaveMatch(socket);
  const code = cleanCode(msg.code);
  let M = code ? lobbyByCode.get(code) : openAuto;
  if (M && humans(M).length >= MAX_PLAYERS) {
    if (code) return socket.emit('lobby:error', { msg: `입장 코드 ${code} 방이 가득 찼어요 (최대 ${MAX_PLAYERS}명).` });
    M = null;
  }
  if (!M) M = newMatch(code);
  const p = { pid: socket.id, sid: socket.id, nick: cleanNick(msg.nickname), bot: false, ready: false, gone: false, pts: 0, quizCoins: 0, places: [0, 0, 0, 0], uses: {} };
  M.players.push(p);
  socket.join(`m:${M.id}`);
  socket.data.match = M.id;
  socket.data.opts = msg.opts || {};
  socket.emit('lobby:joined', { pid: p.pid, code: M.code, mode: M.mode });
  // 자동 매칭: 첫 사람이 들어오면 기다리기 시작, 4명이 모이면 바로 시작
  if (M.mode === 'auto' && !M.aiDeadline) startAiCountdown(M);
  if (M.mode === 'auto' && humans(M).length >= MAX_PLAYERS) return startMatch(M, false);
  sendLobby(M);
}
function startAiCountdown(M) {
  if (M.aiDeadline) return;
  M.aiDeadline = Date.now() + M.cfg.matchWait * 1000;
  M.aiTimer = setTimeout(() => { M.aiTimer = null; if (M.phase === 'lobby' && matches.has(M.id)) startMatch(M, true); }, M.cfg.matchWait * 1000);
  sendLobby(M);
}
function setReady(socket, on) {
  const M = matches.get(socket.data.match); if (!M || M.phase !== 'lobby') return;
  const p = M.players.find(x => x.sid === socket.id); if (!p) return;
  p.ready = !!on;
  const hs = humans(M);
  if (hs.length >= 2 && hs.every(x => x.ready)) return startMatch(M, false);
  sendLobby(M);
}

// ---------- 경기 시작: 방장(첫 사람)이 문제를 만들어 보내요 ----------
function startMatch(M, fillAi) {
  clearTimeout(M.aiTimer); M.aiTimer = null;
  if (M.code && lobbyByCode.get(M.code) === M) lobbyByCode.delete(M.code);
  if (openAuto === M) openAuto = null;
  M.cfg = serverSettings();
  if (fillAi) {
    const taken = M.players.map(p => p.nick);
    const bots = Data.makeBots(MAX_PLAYERS - M.players.length, [], M.cfg.difficulty, taken);
    bots.forEach((b, k) => M.players.push({ pid: `bot${k + 1}`, sid: null, nick: b.name, bot: true, skill: b.skill, gone: false, pts: 0, quizCoins: 0, places: [0, 0, 0, 0] }));
  }
  M.phase = 'prep';
  const host = active(M)[0];
  if (!host) return endMatch(M, true);
  const o = (sockOf(host) && sockOf(host).data.opts) || {};
  M.opts = {
    timeLimit: o.timeLimit > 0 ? clampNum(o.timeLimit, 10, 60, 20) : 30,
    collectCount: clampNum(o.collectCount, 1, 20, 7), coinCount: clampNum(o.coinCount, 1, 30, 13),
    labTime: clampNum(o.labTime, 20, 300, 120), relabTime: clampNum(o.relabTime, 15, 180, 60), battleCount: clampNum(o.battleCount, 1, 10, 6),
  };
  M.host = host.pid;
  const info = { players: M.players.map(p => ({ pid: p.pid, nick: p.nick, bot: p.bot })), opts: M.opts, code: M.code, mode: M.mode };
  for (const p of active(M)) { const s = sockOf(p); if (s) s.emit('match:start', { ...info, you: p.pid, host: p.pid === M.host }); }
  later(M, 6000, () => { if (!M.questions) endMatch(M, true, '문제를 받지 못해 경기를 끝냈어요.'); });
}
// 방장이 보낸 문제를 정리해요 (보기 4개까지 · 글자 수 제한)
function cleanQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const str = (v, n = 300) => String(v ?? '').slice(0, n);
  const type = ['multiple', 'ox', 'short'].includes(q.type) ? q.type : 'multiple';
  const out = { type, q: str(q.q), subject: str(q.subject, 20), explanation: str(q.explanation), options: [], answer: -1, answers: [] };
  if (type === 'short') out.answers = (Array.isArray(q.answers) ? q.answers : []).slice(0, 8).map(a => str(a, 60)).filter(Boolean);
  else { out.options = (Array.isArray(q.options) ? q.options : []).slice(0, 4).map(o => str(o, 120)); out.answer = Number(q.answer) | 0; }
  if (!out.q || (type === 'short' ? !out.answers.length : !(out.answer >= 0 && out.answer < out.options.length))) return null;
  return out;
}
function receiveQuestions(socket, msg) {
  const M = matches.get(socket.data.match);
  if (!M || M.phase !== 'prep' || M.host !== socket.id || M.questions) return;
  const collect = (msg.collect || []).map(cleanQuestion).filter(Boolean).slice(0, M.opts.collectCount);
  const coin = (msg.coin || []).map(cleanQuestion).filter(Boolean).slice(0, M.opts.coinCount);
  if (!collect.length || !coin.length) return endMatch(M, true, '문제를 만들지 못해 경기를 끝냈어요.');
  M.questions = { collect, coin };
  M.stage = 'collect'; M.qi = 0; M.phase = 'quiz';
  later(M, FAST ? 50 : 1500, () => askQuestion(M));
}

// ---------- 퀴즈: 모두 같은 문제 · 다 풀면(또는 시간이 다 되면) 정답 공개 ----------
const norm = s => String(s).replace(/\s+/g, '').toLowerCase();
const checkAnswer = (q, v) => v == null ? false : q.type === 'short' ? (!!norm(v) && q.answers.some(a => norm(a) === norm(v))) : Number(v) === q.answer;
const correctText = q => q.type === 'short' ? q.answers.join(' / ') : q.options[q.answer];
const BOT_CORRECT = { easy: 0.55, normal: 0.7, hard: 0.85 };

function askQuestion(M) {
  const list = M.questions[M.stage];
  if (M.qi >= list.length) return finishStage(M);
  const q = list[M.qi], ms = M.opts.timeLimit * 1000;
  M.q = { q, start: Date.now(), answers: new Map(), closed: false };
  emitAll(M, 'quiz:q', {
    stage: M.stage, i: M.qi, n: list.length, ms,
    q: { type: q.type, q: q.q, subject: q.subject, options: q.options },
  });
  // AI 참가자도 문제를 풀어요
  for (const p of M.players.filter(x => x.bot)) {
    const t = FAST ? 20 + Math.random() * 60 : 1500 + Math.random() * Math.min(ms - 2000, 9000);
    setTimeout(() => {
      if (!M.q || M.q.q !== q || M.q.closed) return;
      const ok = Math.random() < (BOT_CORRECT[M.cfg.difficulty] || 0.7);
      record(M, p, ok ? (q.type === 'short' ? q.answers[0] : q.answer) : (q.type === 'short' ? '' : (q.answer + 1) % Math.max(2, q.options.length)));
    }, t);
  }
  later(M, ms + 400, () => closeQuestion(M));
}
function record(M, p, value) {
  const Q = M.q;
  if (!Q || Q.closed || Q.answers.has(p.pid)) return;
  Q.answers.set(p.pid, { ok: checkAnswer(Q.q, value), t: Date.now() - Q.start });
  const total = M.players.filter(x => x.bot || !x.gone).length;
  emitAll(M, 'quiz:progress', { answered: Q.answers.size, total });
  if (M.players.every(x => (x.gone && !x.bot) || Q.answers.has(x.pid))) closeQuestion(M);
}
function closeQuestion(M) {
  const Q = M.q; if (!Q || Q.closed) return;
  Q.closed = true; clearTimeout(M.timer);
  const N = M.players.length;
  // 코인 퀴즈: 정답을 맞힌 순서대로 1등 5×N … 꼴등 5 코인 (4명: 20 · 15 · 10 · 5 / 2명: 10 · 5), 틀리면 0
  const right = M.players.filter(p => Q.answers.get(p.pid) && Q.answers.get(p.pid).ok).sort((a, b) => Q.answers.get(a.pid).t - Q.answers.get(b.pid).t);
  const results = M.players.map(p => {
    const a = Q.answers.get(p.pid), ok = !!(a && a.ok), rank = ok ? right.indexOf(p) + 1 : 0;
    const coins = M.stage === 'coin' && ok ? 5 * (N - rank + 1) : 0;
    p.quizCoins += coins;
    return { pid: p.pid, nick: p.nick, bot: p.bot, answered: !!a, ok, rank, coins, total: p.quizCoins, t: a ? a.t : null };
  });
  emitAll(M, 'quiz:r', { stage: M.stage, i: M.qi, n: M.questions[M.stage].length, answer: Q.q.answer, answerText: correctText(Q.q), explanation: Q.q.explanation, results });
  later(M, REVEAL_MS[M.stage], () => { M.qi++; askQuestion(M); });
}
function finishStage(M) {
  if (M.stage === 'collect') {
    M.stage = 'coin'; M.qi = 0;
    emitAll(M, 'quiz:stage', { stage: 'coin', n: M.questions.coin.length });
    return later(M, STAGE_GAP_MS, () => askQuestion(M));
  }
  startLab(M);
}

// ---------- 연구소: 정해진 시간 동안 업그레이드 · 곤충 고르기 ----------
function startLab(M) {
  M.phase = 'lab'; M.q = null;
  const sec = M.battleNo === 0 ? M.opts.labTime : M.opts.relabTime;
  for (const p of M.players) p.labReady = false;
  emitAll(M, 'lab', { ms: sec * 1000, battleNo: M.battleNo, battleCount: M.opts.battleCount, players: M.players.map(p => ({ pid: p.pid, nick: p.nick, bot: p.bot, pts: p.pts })) });
  later(M, sec * 1000 + 1500, () => startBattle(M)); // 시간이 끝나면 마지막으로 고른 곤충으로 자동 출전
}
function setPick(socket, msg) {
  const M = matches.get(socket.data.match); if (!M) return;
  const p = M.players.find(x => x.sid === socket.id); if (!p) return;
  const pick = Data.cleanEntry(msg.type, msg.lv, msg.tier);
  if ((p.uses[pick.type] || 0) >= USE_LIMIT) return; // 한 곤충은 2번까지만 출전
  p.pick = pick;
}
// 고른 곤충이 없거나 이미 2번 나갔으면 아직 출전하지 않은 기본 곤충으로 나가요
function entryOf(p) {
  if (p.pick && (p.uses[p.pick.type] || 0) < USE_LIMIT) return p.pick;
  const type = Data.LIST.filter(i => i.rarity === 'common').map(i => i.id).find(t => (p.uses[t] || 0) < USE_LIMIT) || 'ant';
  return { type, lv: Data.zeroLv(), tier: 0 };
}
function labReady(socket) {
  const M = matches.get(socket.data.match); if (!M || M.phase !== 'lab') return;
  const p = M.players.find(x => x.sid === socket.id); if (!p) return;
  p.labReady = true;
  emitAll(M, 'lab:ready', { ready: active(M).filter(x => x.labReady).map(x => x.pid) });
  if (active(M).every(x => x.labReady)) later(M, FAST ? 50 : 800, () => startBattle(M));
}

// ---------- 대결 ----------
function startBattle(M) {
  if (M.phase !== 'lab') return;
  M.phase = 'battle';
  const humanPicks = M.players.filter(p => !p.bot).map(entryOf);
  const entrants = M.players.map(p => {
    if (p.bot) { const b = Data.makeBots(1, humanPicks, M.cfg.difficulty)[0]; return { ...b, name: p.nick, skill: p.skill }; }
    const pk = entryOf(p);
    p.uses[pk.type] = (p.uses[pk.type] || 0) + 1;
    p.pick = null;
    return { name: p.nick, type: pk.type, lv: pk.lv, tier: pk.tier, bot: p.gone, skill: 0.5 };
  });
  const eventId = Events.pickEvent(M.cfg.events, M.lastEvent);
  M.lastEvent = eventId;
  const b = Events.createBattle(eventId, entrants, { countdown: COUNTDOWN });
  const meta = { id: `${M.id}-${M.battleNo}`, ev: eventId, battleNo: M.battleNo, battleCount: M.opts.battleCount, ents: entrants.map((en, i) => ({ name: en.name, type: en.type, tier: Data.tierOf(en.type, en.tier), bot: M.players[i].bot, lv: en.lv })) };
  M.bt = { b, meta, loop: null };
  M.players.forEach((p, i) => { const s = !p.bot && !p.gone && sockOf(p); if (s) s.emit('battle:start', { ...meta, me: i }); });
  M.bt.loop = setInterval(() => {
    Events.step(b, TICK);
    emitAll(M, 'battle:state', Events.snap(b));
    if (b.done) endBattle(M);
  }, TICK * 1000);
}
function battleInput(socket, msg) {
  const M = matches.get(socket.data.match); if (!M || !M.bt || M.bt.meta.id !== String(msg.id)) return;
  const i = M.players.findIndex(x => x.sid === socket.id); if (i < 0) return;
  Events.input(M.bt.b, i, msg.k, msg.v);
}
function endBattle(M) {
  clearInterval(M.bt.loop);
  const N = M.players.length;
  for (const r of M.bt.b.results) { const p = M.players[r.i]; p.pts += N - r.rank + 1; p.places[r.rank - 1]++; }
  M.bt = null;
  M.battleNo++;
  later(M, RESULT_MS, () => { if (M.battleNo >= M.opts.battleCount) endMatch(M); else startLab(M); });
}

// ---------- 끝 ----------
function endMatch(M, aborted, msg) {
  clearTimeout(M.timer); clearTimeout(M.aiTimer);
  if (M.bt) clearInterval(M.bt.loop);
  if (!aborted) {
    const standings = M.players.map(p => ({ pid: p.pid, nick: p.nick, bot: p.bot, pts: p.pts, places: p.places, quizCoins: p.quizCoins }))
      .sort((a, b) => b.pts - a.pts || b.places[0] - a.places[0] || b.quizCoins - a.quizCoins);
    emitAll(M, 'match:end', { standings });
  } else emitAll(M, 'match:abort', { msg: msg || '경기가 끝났어요.' });
  M.phase = 'end';
  if (M.code && lobbyByCode.get(M.code) === M) lobbyByCode.delete(M.code);
  if (openAuto === M) openAuto = null;
  for (const p of M.players) { const s = sockOf(p); if (s) { s.leave(`m:${M.id}`); s.data.match = null; } }
  matches.delete(M.id);
}
function leaveMatch(socket) {
  const M = matches.get(socket.data.match);
  socket.data.match = null;
  if (!M) return;
  socket.leave(`m:${M.id}`);
  if (M.phase === 'lobby') {
    M.players = M.players.filter(p => p.sid !== socket.id);
    if (!M.players.length) { clearTimeout(M.aiTimer); if (M.code) lobbyByCode.delete(M.code); if (openAuto === M) openAuto = null; matches.delete(M.id); return; }
    return sendLobby(M);
  }
  const i = M.players.findIndex(p => p.sid === socket.id);
  if (i < 0) return;
  const p = M.players[i];
  p.gone = true; p.sid = null;
  if (M.bt) Events.takeOver(M.bt.b, i);                    // 대결 중이면 AI가 이어서 해요
  emitAll(M, 'match:left', { pid: p.pid, nick: p.nick });
  if (!active(M).length) return endMatch(M, true);
  if (M.host === p.pid && M.phase === 'prep') endMatch(M, true, '방장이 나가서 경기를 끝냈어요.');
  else if (M.phase === 'quiz' && M.q && !M.q.closed && M.players.every(x => (x.gone && !x.bot) || M.q.answers.has(x.pid))) closeQuestion(M);
  else if (M.phase === 'lab' && active(M).every(x => x.labReady)) later(M, 800, () => startBattle(M));
}

// ---------- 접속 ----------
io.on('connection', socket => {
  socket.data.tokens = 40; // 입력이 너무 많으면 버려요 (1초에 40번까지)
  const refill = setInterval(() => { socket.data.tokens = 40; }, 1000);
  socket.on('lobby:join', (msg = {}) => joinLobby(socket, msg));
  socket.on('lobby:ai', () => { const M = matches.get(socket.data.match); if (M && M.phase === 'lobby') startAiCountdown(M); });
  socket.on('lobby:ready', (msg = {}) => setReady(socket, msg.on !== false));
  socket.on('lobby:leave', () => leaveMatch(socket));
  socket.on('match:questions', (msg = {}) => receiveQuestions(socket, msg));
  socket.on('quiz:a', (msg = {}) => {
    const M = matches.get(socket.data.match); if (!M || M.phase !== 'quiz' || !M.q || msg.i !== M.qi) return;
    const p = M.players.find(x => x.sid === socket.id); if (!p) return;
    record(M, p, msg.value);
    const Q = M.q;
    if (Q && !Q.closed) socket.emit('quiz:wait', { ms: Math.max(0, Q.start + M.opts.timeLimit * 1000 - Date.now()) });
  });
  socket.on('lab:pick', (msg = {}) => setPick(socket, msg));
  socket.on('lab:ready', () => labReady(socket));
  socket.on('input', (msg = {}) => { if (socket.data.tokens-- > 0) battleInput(socket, msg); });
  socket.on('disconnect', () => { clearInterval(refill); leaveMatch(socket); });
});

server.listen(PORT, () => console.log(`곤충 리그 서버가 ${PORT}번 포트에서 열렸어요`));
