// 꼬마 파브르 곤충 리그 — 실시간 대결 서버 (Render 배포용)
// 정적 파일(public/) + Socket.IO 대결방. 대결 계산은 서버가 하고(1초에 20번), 모두에게 같은 화면 상태를 보내요.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Data = require('./public/js/insects-data.js');
const Events = require('./public/js/events.js');

const PORT = process.env.PORT || 3000;
const TICK = 0.05;                  // 대결 계산 간격 (초)
const COUNTDOWN = 3;                // 대결 시작 전 3, 2, 1
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ---------- 전역 설정 (config.json) ----------
// 매칭할 때마다 다시 읽어요. GitHub에서 고치면 Render가 다시 배포하면서 바로 적용돼요.
function serverSettings() {
  const def = { difficulty: 'normal', matchWait: 15, events: null };
  try {
    const j = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const s = j.settings || j;
    return {
      difficulty: ['easy', 'normal', 'hard'].includes(s.difficulty) ? s.difficulty : def.difficulty,
      matchWait: Math.max(3, Math.min(120, Number(s.matchWait) || def.matchWait)),
      events: s.events && typeof s.events === 'object' ? s.events : null,
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

// ---------- 방(교실 코드) ----------
// rooms: code → { code, members: Map(socketId → { nick, status, insect }), queue: [], timer, deadline, lastEvent }
const rooms = new Map();
const battles = new Map();          // battleId → { id, code, b, sockets: [socketId|null], loop }
let battleSeq = 1;

const cleanCode = s => String(s || '').replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 12) || '교실';
const cleanNick = s => String(s || '').replace(/[\r\n\t<>]/g, ' ').trim().slice(0, 12) || '도전자';
function room(code) {
  if (!rooms.has(code)) rooms.set(code, { code, members: new Map(), queue: [], timer: null, deadline: 0, lastEvent: null });
  return rooms.get(code);
}
function roomInfo(r) {
  return {
    code: r.code,
    members: [...r.members.values()].map(m => ({ nick: m.nick, status: m.status, insect: m.insect || null, tier: m.tier })),
    queue: r.queue.map(q => ({ nick: q.name, type: q.type, tier: q.tier })),
    deadline: r.deadline ? Math.max(0, Math.round((r.deadline - Date.now()) / 1000)) : 0,
  };
}
const broadcastRoom = r => io.to(`room:${r.code}`).emit('room', roomInfo(r));
function dropRoomIfEmpty(r) {
  if (r.members.size === 0 && r.queue.length === 0) { clearTimeout(r.timer); rooms.delete(r.code); }
}

// ---------- 매칭: 3명이 모이면 바로, 아니면 기다린 뒤 AI 곤충으로 채워요 ----------
function tryMatch(r) {
  const cfg = serverSettings();
  while (r.queue.length >= 3) startBattle(r, r.queue.splice(0, 3), cfg);
  if (r.queue.length && !r.timer) {
    r.deadline = Date.now() + cfg.matchWait * 1000;
    r.timer = setTimeout(() => {
      r.timer = null; r.deadline = 0;
      if (r.queue.length) startBattle(r, r.queue.splice(0, 3), serverSettings());
      broadcastRoom(r);
    }, cfg.matchWait * 1000);
  }
  if (!r.queue.length && r.timer) { clearTimeout(r.timer); r.timer = null; r.deadline = 0; }
  broadcastRoom(r);
}

function startBattle(r, entries, cfg) {
  const humans = entries.map(q => ({ name: q.name, type: q.type, lv: q.lv, tier: q.tier }));
  const bots = Data.makeBots(3 - humans.length, humans, cfg.difficulty, humans.map(h => h.name));
  const entrants = [...humans, ...bots].sort(() => Math.random() - 0.5);
  const eventId = Events.pickEvent(cfg.events, r.lastEvent);
  r.lastEvent = eventId;
  const b = Events.createBattle(eventId, entrants, { countdown: COUNTDOWN });
  const id = String(battleSeq++);
  const sockets = entrants.map(en => { const q = entries.find(x => !en.bot && x.name === en.name && x.type === en.type && !x._used); if (q) { q._used = true; return q.sid; } return null; });
  const bt = { id, code: r.code, b, sockets };
  battles.set(id, bt);
  const meta = { id, ev: eventId, ents: entrants.map(en => ({ name: en.name, type: en.type, tier: Data.tierOf(en.type, en.tier), bot: !!en.bot, lv: en.lv })) };
  sockets.forEach((sid, i) => {
    if (!sid) return;
    const s = io.sockets.sockets.get(sid);
    if (!s) { Events.takeOver(b, i); return; }
    s.join(`battle:${id}`);
    s.data.battle = { id, i };
    const m = r.members.get(sid); if (m) m.status = 'battle';
    s.emit('battle:start', { ...meta, me: i });
  });
  bt.loop = setInterval(() => {
    Events.step(b, TICK);
    io.to(`battle:${id}`).emit('battle:state', Events.snap(b));
    if (b.done) endBattle(bt);
  }, TICK * 1000);
}

function endBattle(bt) {
  clearInterval(bt.loop);
  battles.delete(bt.id);
  const r = rooms.get(bt.code);
  bt.sockets.forEach(sid => {
    if (!sid) return;
    const s = io.sockets.sockets.get(sid);
    if (s) { s.leave(`battle:${bt.id}`); if (s.data.battle && s.data.battle.id === bt.id) s.data.battle = null; }
    if (r && r.members.has(sid)) r.members.get(sid).status = 'lab';
  });
  if (r) { broadcastRoom(r); dropRoomIfEmpty(r); }
}

// ---------- 접속 ----------
io.on('connection', socket => {
  socket.data.tokens = 40; // 입력이 너무 많으면 버려요 (1초에 40번까지)
  const refill = setInterval(() => { socket.data.tokens = Math.min(40, socket.data.tokens + 40); }, 1000);

  socket.on('join', (msg = {}) => {
    leaveRoom(socket);
    const r = room(cleanCode(msg.room));
    socket.data.room = r.code;
    socket.join(`room:${r.code}`);
    r.members.set(socket.id, { nick: cleanNick(msg.nickname), status: 'quiz', insect: null });
    socket.emit('joined', { code: r.code });
    broadcastRoom(r);
  });

  socket.on('status', (msg = {}) => {
    const r = rooms.get(socket.data.room); if (!r) return;
    const m = r.members.get(socket.id); if (!m) return;
    if (['quiz', 'lab', 'done'].includes(msg.status) && m.status !== 'battle' && m.status !== 'queue') m.status = msg.status;
    if (msg.insect && Data.INSECTS[msg.insect]) { m.insect = msg.insect; m.tier = Data.tierOf(msg.insect, msg.tier); }
    broadcastRoom(r);
  });

  socket.on('queue', (msg = {}) => {
    const r = rooms.get(socket.data.room); if (!r || socket.data.battle) return;
    if (r.queue.some(q => q.sid === socket.id)) return;
    // 등급·업그레이드가 규칙에 맞는지 서버가 다시 확인해요
    const { type, lv, tier } = Data.cleanEntry(msg.type, msg.lv, msg.tier);
    const m = r.members.get(socket.id);
    const name = m ? m.nick : cleanNick(msg.nickname);
    if (m) { m.status = 'queue'; m.insect = type; m.tier = tier; }
    r.queue.push({ sid: socket.id, name, type, lv, tier });
    tryMatch(r);
  });

  socket.on('unqueue', () => {
    const r = rooms.get(socket.data.room); if (!r) return;
    r.queue = r.queue.filter(q => q.sid !== socket.id);
    const m = r.members.get(socket.id); if (m && m.status === 'queue') m.status = 'lab';
    tryMatch(r);
  });

  socket.on('input', (msg = {}) => {
    if (socket.data.tokens-- <= 0) return;
    const at = socket.data.battle; if (!at || at.id !== String(msg.id)) return;
    const bt = battles.get(at.id); if (!bt) return;
    Events.input(bt.b, at.i, msg.k, msg.v);
  });

  socket.on('disconnect', () => { clearInterval(refill); leaveRoom(socket); });
});

function leaveRoom(socket) {
  const at = socket.data.battle;
  if (at) { const bt = battles.get(at.id); if (bt) { Events.takeOver(bt.b, at.i); bt.sockets[at.i] = null; } socket.data.battle = null; }
  const r = rooms.get(socket.data.room);
  if (!r) return;
  socket.leave(`room:${r.code}`);
  r.members.delete(socket.id);
  r.queue = r.queue.filter(q => q.sid !== socket.id);
  socket.data.room = null;
  tryMatch(r);
  dropRoomIfEmpty(r);
}

server.listen(PORT, () => console.log(`곤충 리그 서버가 ${PORT}번 포트에서 열렸어요`));
