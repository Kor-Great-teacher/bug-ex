// 꼬마 파브르 곤충 리그 — 게임 본체
// 흐름: ① 곤충 채집 퀴즈(7문제) → ② 코인 퀴즈(10문제) → ③ 연구소(업그레이드) → ④ 대결(3마리, 무작위 종목) × 3번 → 결과·명예의 전당
(() => {
  'use strict';
  const D = window.BugData, EV = window.BugEvents, Q = window.BugQuiz, A = window.BugAudio, ART = window.BugArt, ARENA = window.BugArena;
  const SND = (name, o) => A.play(name, o);
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pic = (type, px = 96, mood, tier) => ART.portrait(type, px, mood, tier != null ? D.TIERS[tier] : undefined);
  const tierKey = b => D.TIERS[b.tier];                     // 지금 등급 키 (common · rare · hero · legend)
  const tierName = b => D.RARITY[tierKey(b)].name;

  // ---------- 설정 ----------
  // 적용 순서: 기본값 → 전역 설정(저장소의 config.json, 모든 학생에게 적용)
  //          → 이 브라우저에만 저장한 관리자 설정 → 학생이 고른 난이도
  const DEFAULT_SETTINGS = {
    difficulty: 'normal',
    subjects: { math: true, korean: true, science: true, social: true, english: true, custom: false },
    timeLimit: 20, mathLevel: 'auto',
    collectCount: 7, coinCount: 13, coinPerCorrect: 20,
    battleCount: 6, matchWait: 30, labTime: 120, relabTime: 60,
    events: Object.fromEntries(EV.EVENT_IDS.map(id => [id, true])),
    custom: '',
  };
  const SKEY = 'bugex-settings-v1';
  const ADMIN_KEYS = ['difficulty', 'subjects', 'timeLimit', 'mathLevel', 'collectCount', 'coinCount', 'coinPerCorrect', 'battleCount', 'matchWait', 'labTime', 'relabTime', 'events', 'custom'];
  const clone = o => JSON.parse(JSON.stringify(o));
  let globalConfig = null;   // config.json 의 settings
  let local = { prefs: {}, admin: null };
  try { Object.assign(local, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
  function pickAdmin(src) {
    const o = {};
    for (const k of ADMIN_KEYS) if (src && src[k] !== undefined) o[k] = clone(src[k]);
    return o;
  }
  function applyLayer(base, layer) {
    const o = pickAdmin(layer);
    if (o.subjects) o.subjects = Object.assign({}, base.subjects, o.subjects);
    if (o.events) o.events = Object.assign({}, base.events, o.events);
    return Object.assign(base, o);
  }
  function buildSettings() {
    let s = clone(DEFAULT_SETTINGS);
    s = applyLayer(s, globalConfig);
    s = applyLayer(s, local.admin);
    if (local.prefs.difficulty) s.difficulty = local.prefs.difficulty;
    return s;
  }
  function saveLocal() { try { localStorage.setItem(SKEY, JSON.stringify(local)); } catch (e) { /* 무시 */ } }
  function saveSettings() { local.prefs.difficulty = settings.difficulty; saveLocal(); }
  let settings = buildSettings();
  Q.setCustom(settings.custom);
  // 서버(또는 GitHub Pages)의 config.json 을 읽어요. 없거나 못 읽으면 그냥 넘어가요.
  async function loadGlobalConfig() {
    try {
      const res = await Promise.race([
        fetch('config.json', { cache: 'no-store' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500)),
      ]);
      if (res.ok) { const j = await res.json(); globalConfig = j.settings || j; }
    } catch (e) { globalConfig = null; }
    settings = buildSettings();
    Q.setCustom(settings.custom);
  }

  // ---------- 플레이어 진행 상태 ----------
  // mode: solo(혼자 연습) · together(함께 하기, 서버가 진행) · grow(곤충 키우기)
  let P = null;
  function newPlayer(kit) {
    const garden = loadGarden();
    P = {
      mode: kit.mode === 'game' ? 'together' : 'solo', online: kit.mode === 'game', match: null,
      stage: 'collect', qIndex: 0, qTotal: 0, asked: 0,
      correct: 0, total: 0, wrong: [], marks: [],
      // 곤충 키우기에서 키운 곤충은 기본 곤충으로 함께 출발해요
      bugs: garden.bugs.map(b => ({ ...clone(b), garden: true })),
      sel: garden.bugs.length ? garden.bugs[0].type : null, coins: 0, score: 0,
      battleNo: 0, places: [0, 0, 0, 0], history: [], lastEvent: null, labReady: false, labDeadline: 0, coinBoard: null, uses: {},
    };
  }
  const bug = type => P.bugs.find(b => b.type === type);
  const collectCount = () => Math.max(1, GameKit.state.quizGoal || settings.collectCount || 7);
  const battleCount = () => (P && P.match ? P.match.opts.battleCount : settings.battleCount);
  const together = () => !!(P && P.mode === 'together' && P.match);
  const BATTLE_COINS = [60, 40, 25, 15], BATTLE_SCORE = [300, 150, 50, 20];
  // 한 곤충은 대결에 2번까지 나갈 수 있어요
  const USE_LIMIT = 2;
  const usesOf = t => (P.uses && P.uses[t]) || 0;
  const canEnter = t => P.mode === 'grow' || usesOf(t) < USE_LIMIT;
  // 퀴즈를 하나도 못 맞혀도 기본 곤충은 꼭 있어요. 대결을 다 치를 만큼(6차전이면 3마리) 모자라면 기본 곤충을 채워 줘요.
  function ensureBugs() {
    const need = Math.max(1, Math.ceil(battleCount() / USE_LIMIT));
    const basics = ['ant', 'ladybug', 'bee', 'grasshopper', 'cricket', 'butterfly'];
    const given = [];
    while (P.bugs.length < need) {
      const t = basics.find(x => !bug(x)); if (!t) break;
      P.bugs.push({ type: t, lv: D.zeroLv(), tier: 0, copies: 1 }); given.push(D.INSECTS[t].name);
    }
    if (!P.sel || !bug(P.sel)) P.sel = P.bugs[0].type;
    if (given.length) toast(`대결에 나갈 곤충이 모자라 기본 곤충 ${given.join(' · ')}을(를) 받았어요!`, 'warn');
  }
  // 출전할 수 있는 곤충 중 가장 센 곤충
  function bestEntrant() {
    const ok = P.bugs.filter(b => canEnter(b.type)).sort((a, b) => D.powerOf(b.type, b.lv, b.tier) - D.powerOf(a.type, a.lv, a.tier));
    return ok.length ? ok[0].type : P.bugs[0].type;
  }

  // ---------- 곤충 키우기 저장 (이 브라우저에 최대 3마리) ----------
  const GKEY = 'bugex-garden-v1';
  function loadGarden() {
    try {
      const g = JSON.parse(localStorage.getItem(GKEY));
      if (g && Array.isArray(g.bugs)) return { bugs: g.bugs.slice(0, 3).map(b => ({ ...D.cleanEntry(b.type, b.lv, b.tier), copies: Math.max(1, b.copies | 0) })), coins: Math.max(0, g.coins | 0) };
    } catch (e) { /* 저장소를 못 쓰면 빈 정원 */ }
    return { bugs: [], coins: 0 };
  }
  function saveGarden(g) { try { localStorage.setItem(GKEY, JSON.stringify({ bugs: g.bugs.map(b => ({ type: b.type, lv: b.lv, tier: b.tier, copies: b.copies || 1 })), coins: g.coins })); } catch (e) { /* 무시 */ } }
  function saveIfGrow() { if (P && P.mode === 'grow') saveGarden({ bugs: P.bugs, coins: P.coins }); }

  // ============================================================
  //  화면 전환 · 상단 표시
  // ============================================================
  const SCREENS = { quiz: '#scQuiz', lab: '#scLab', battle: '#scBattle', final: '#scFinal' };
  function showScreen(name) {
    for (const [k, sel] of Object.entries(SCREENS)) $(sel).hidden = k !== name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function updateHud() {
    if (!P) return;
    const st = { collect: `채집 ${Math.min(P.qIndex + 1, P.qTotal)}/${P.qTotal}`, coin: `코인 퀴즈 ${Math.min(P.qIndex + 1, P.qTotal)}/${P.qTotal}`, lab: '연구소', battle: `대결 ${P.battleNo + 1}/${battleCount()}`, final: '결과', grow: '곤충 키우기' }[P.stage] || '준비';
    $('#hudStage').textContent = st;
    $('#hudCoins').textContent = P.coins.toLocaleString();
    $('#hudScore').textContent = P.score.toLocaleString();
    $('#hudBugs').textContent = `${P.bugs.length}마리`;
    $('#hudCorrect').textContent = `${P.correct} / ${P.total}`;
    $('#hudNetBox').hidden = P.mode !== 'together';
    if (P.mode === 'together') $('#hudNet').textContent = !Net.connected ? '연결 중…' : P.match ? `${P.match.code || '자동'} · ${P.match.players.length}명` : '대기실';
    $('#stepsBar').hidden = P.mode === 'grow';
    const order = ['collect', 'coin', 'lab', 'battle'];
    const cur = P.stage === 'final' ? 4 : order.indexOf(P.stage);
    document.querySelectorAll('#stepsBar li').forEach((li, i) => { li.classList.toggle('on', i === cur); li.classList.toggle('done', i < cur || (cur === 3 && i === 2)); });
  }

  // ---------- 알림 ----------
  let toastTimer = 0;
  function toast(msg, kind = 'info') {
    const el = $('#toast');
    el.textContent = msg; el.className = `toast show ${kind}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
  }
  let bannerTimer = 0;
  function banner(title, sub = '', ms = 2200) {
    const el = $('#banner');
    el.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    el.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  const modalEl = $('#modal'), dialogEl = $('#dialog');
  let modalKind = null;
  function showModal(html, kind = 'info', cls = '') {
    dialogEl.className = `dialog ${cls}`;
    dialogEl.innerHTML = html; modalEl.hidden = false; modalKind = kind;
    const f = dialogEl.querySelector('[autofocus]') || dialogEl.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
  function hideModal() { modalEl.hidden = true; dialogEl.innerHTML = ''; modalKind = null; }

  // ============================================================
  //  퀴즈 (채집 · 코인)
  //  혼자 연습: 내 컴퓨터가 문제를 내고 바로 정답 공개
  //  함께 하기: 서버가 모두에게 같은 문제를 내고, 모두 풀면(또는 시간이 다 되면) 정답 공개
  //  코인 퀴즈는 빨리 맞힐수록 코인이 많아요 (함께: 맞힌 순서 · 혼자: 걸린 시간)
  // ============================================================
  let curQ = null, qTimer = null, qDeadline = 0, qLimitMs = 0, qStartAt = 0, answered = false;
  function startQuizStage(kind) {
    P.stage = kind; P.qIndex = 0; P.marks = [];
    P.qTotal = kind === 'collect' ? collectCount() : Math.max(1, settings.coinCount);
    showScreen('quiz');
    nextQuestion();
  }
  function nextQuestion() {
    curQ = Q.pick(settings, P.asked++);
    showQuestion(settings.timeLimit * 1000);
  }
  function showQuestion(ms) {
    answered = false;
    renderQuiz(ms);
    updateHud();
    SND('quiz');
    clearInterval(qTimer);
    qStartAt = performance.now(); qLimitMs = ms;
    if (ms > 0) { qDeadline = qStartAt + ms; qTimer = setInterval(tickTimer, 200); tickTimer(); }
  }
  function tickTimer() {
    const left = Math.max(0, qDeadline - performance.now());
    const bar = $('#qTimer'); if (bar) bar.style.width = `${left / qLimitMs * 100}%`;
    if (left <= 0) { clearInterval(qTimer); if (!answered) answer(null); }
  }
  // 혼자 연습 코인: 제한 시간의 1/4 안에 맞히면 20, 2/4 15, 3/4 10, 그 뒤 5
  function speedCoins(ms) {
    const f = qLimitMs > 0 ? ms / qLimitMs : ms / 20000;
    return f < 0.25 ? 20 : f < 0.5 ? 15 : f < 0.75 ? 10 : 5;
  }
  const subjectOf = q => q.subjectLabel || Q.label(q.subject);
  function questionHTML(q) {
    if (q.type === 'short') return `<form class="short-form" id="shortForm"><input id="shortIn" type="text" autocomplete="off" placeholder="정답을 써요" aria-label="정답"><button class="btn primary" type="submit">확인</button></form>`;
    return `<div class="opts ${q.type === 'ox' ? 'ox' : ''}">${q.options.map((o, i) => `<button type="button" class="opt" data-i="${i}">${q.type === 'ox' ? '' : `<b>${i + 1}</b>`}<span>${esc(o)}</span></button>`).join('')}</div>`;
  }
  function coinBoardHTML() {
    const board = P.coinBoard;
    if (!board) return '';
    return `<ol class="coin-board">${board.slice().sort((a, b) => b.total - a.total).map(r => `<li class="${r.pid === P.match.you ? 'me' : ''}"><span>${esc(r.nick)}${r.bot ? ' <em>AI</em>' : ''}</span><b><i class="coin"></i>${r.total}</b></li>`).join('')}</ol>`;
  }
  function renderQuiz(ms) {
    const collect = P.stage === 'collect', q = curQ;
    const dots = Array.from({ length: P.qTotal }, (_, i) => `<i class="${P.marks[i] === true ? 'ok' : P.marks[i] === false ? 'no' : i === P.qIndex ? 'now' : ''}"></i>`).join('');
    const N = together() ? P.match.players.length : 4;
    const coinRule = together()
      ? `빨리 맞힌 순서대로 코인을 받아요: ${Array.from({ length: N }, (_, k) => `${k + 1}등 ${5 * (N - k)}`).join(' · ')}. 틀리면 0개.`
      : '빨리 맞힐수록 코인이 많아요: 20 · 15 · 10 · 5. 틀리면 0개.';
    $('#scQuiz').innerHTML = `
      <div class="quiz">
        <section class="panel">
          <div class="quiz-head">
            <span class="stage-chip ${collect ? '' : 'coin-chip'}">${collect ? '🦋 곤충 채집' : '🪙 코인 퀴즈'}</span>
            <span>문제 ${P.qIndex + 1} / ${P.qTotal}</span>
            <div class="qdots" aria-hidden="true">${dots}</div>
          </div>
          ${ms > 0 ? '<div class="timer"><i id="qTimer" style="width:100%"></i></div>' : ''}
          <p class="q-subject">${esc(subjectOf(q))}</p>
          <h2 class="q-text">${esc(q.q)}</h2>
          ${questionHTML(q)}
        </section>
        <aside class="panel">
          <div id="feedback"></div>
          <h2>${collect ? '채집한 곤충' : together() ? '코인 순위' : '내 곤충'}</h2>
          <p class="hint">${collect ? '정답을 맞히면 곤충을 잡을 수 있어요! 같은 곤충을 또 잡으면 능력치가 1 올라가요.' : coinRule}</p>
          ${!collect && together() ? coinBoardHTML() : ''}
          <div class="mini-bugs">${P.bugs.map(b => `<img src="${pic(b.type, 64, undefined, b.tier)}" alt="${esc(D.INSECTS[b.type].name)}" title="${esc(D.INSECTS[b.type].name)}">`).join('')}${collect ? Array.from({ length: Math.max(0, P.qTotal - P.qIndex) }, () => '<span class="empty">?</span>').join('') : ''}</div>
          ${collect ? '' : `<p class="reward">내 코인 <i class="coin"></i> ${P.coins.toLocaleString()}</p>`}
        </aside>
      </div>`;
    document.querySelectorAll('#scQuiz .opt').forEach(b => b.addEventListener('click', () => answer(Number(b.dataset.i))));
    const f = $('#shortForm');
    if (f) { f.addEventListener('submit', e => { e.preventDefault(); answer($('#shortIn').value); }); $('#shortIn').focus(); }
  }
  function lockQuestion(picked) {
    document.querySelectorAll('#scQuiz .opt').forEach(b => { b.disabled = true; if (Number(b.dataset.i) === picked) b.classList.add('picked'); });
    const inp = $('#shortIn'); if (inp) { inp.disabled = true; $('#shortForm button').disabled = true; }
  }
  function markAnswer(q, picked, ok, answerText) {
    P.total++; P.marks[P.qIndex] = ok;
    if (ok) { P.correct++; P.score += 100; } else P.wrong.push({ q: q.q, a: answerText, subject: subjectOf(q) });
    document.querySelectorAll('#scQuiz .opt').forEach(b => {
      b.disabled = true; b.classList.remove('picked');
      const i = Number(b.dataset.i);
      if (i === q.answer) b.classList.add('right'); else if (i === picked) b.classList.add('wrong');
    });
  }
  // 채집 성공: 곤충은 14종 중 아무거나, 등급은 확률로 (일반 55 · 희귀 28 · 영웅 12 · 전설 5)
  //  - 처음 잡은 곤충: 새 친구
  //  - 이미 있는 곤충을 더 높은 등급으로 잡으면: 그 등급으로 올라가요 (모은 수 1부터)
  //  - 같거나 낮은 등급이면: 모은 수 +1 · 능력치 하나 +1
  function catchHTML(expl, button) {
    const type = D.rollInsect(), tier = D.rollTier(), ins = D.INSECTS[type], tk = D.TIERS[tier];
    let b = bug(type), extra;
    if (!b) {
      b = { type, lv: D.zeroLv(), tier, copies: 1 }; P.bugs.push(b);
      P.score += D.RARITY[tk].score; extra = '새로운 곤충 친구를 만났어요!';
    } else if (tier > b.tier) {
      b.tier = tier; b.copies = 1; P.score += D.RARITY[tk].score;
      extra = `더 높은 <b>${D.RARITY[tk].name}</b> 등급으로 잡아서 등급이 올라갔어요!`;
    } else {
      b.copies = (b.copies || 1) + 1;
      const open = D.STAT_KEYS.filter(s => b.lv[s] < D.capOf(b.tier)), k = open[Math.floor(Math.random() * open.length)];
      if (k) b.lv[k]++; else P.coins += 30;
      extra = `같은 곤충을 또 모았어요! <b>×${b.copies}</b>${k ? ` · ${D.STATS.find(s => s.k === k).name} +1` : ' · 코인 30'}`;
    }
    if (!P.sel) P.sel = type;
    const up = checkPromote(b, false);
    if (up) extra += ` 🎉 <b>${D.RARITY[tierKey(b)].name}</b> 등급업!`;
    const shown = D.TIERS[b.tier];
    SND(b.tier >= 2 ? 'legend' : 'catch');
    return `<div class="feedback good reveal">
      <h3>정답! ${esc(ins.name)} 채집!</h3>
      <div class="stage ${shown}"><img src="${pic(type, 170, 'happy', b.tier)}" alt="">${shown === 'common' ? '' : [[12, 20], [78, 14], [86, 70], [8, 74], [50, 4]].map(([l, t], i) => `<span class="sparkle" style="left:${l}%;top:${t}%;animation-delay:${i * 0.28}s">${shown === 'legend' ? '✨' : shown === 'hero' ? '💜' : '✦'}</span>`).join('')}</div>
      <p><span class="rar ${tk}">${D.RARITY[tk].name}</span> ${extra}</p>
      <p class="fact">${esc(ins.fact)}</p>${expl}${button}</div>`;
  }
  // 3초 뒤 저절로 다음으로 (버튼에 남은 초를 보여 줘요)
  let autoTimer = 0;
  function autoNext(btn, fn, sec = 3) {
    if (!btn) return;
    clearInterval(autoTimer);
    const label = btn.textContent;
    let left = sec;
    const tick = () => {
      if (!btn.isConnected) return clearInterval(autoTimer);
      if (left <= 0) { clearInterval(autoTimer); fn(); return; }
      btn.textContent = `${label} (${left})`; left--;
    };
    tick();
    autoTimer = setInterval(tick, 1000);
    btn.addEventListener('click', () => clearInterval(autoTimer), { once: true });
  }
  function answer(value) {
    if (answered) return;
    answered = true;
    clearInterval(qTimer);
    const elapsed = performance.now() - qStartAt;
    if (together()) {
      // 정답은 모두 풀고 나서 공개해요. 먼저 푼 친구는 기다리기 창을 봐요.
      lockQuestion(value);
      Net.socket.emit('quiz:a', { i: P.qIndex, value });
      showWaiting(Math.max(0, qDeadline - performance.now()));
      return;
    }
    const q = curQ, ok = value !== null && GameKit.checkAnswer(q, value);
    markAnswer(q, value, ok, GameKit.correctText(q));
    const last = P.qIndex + 1 >= P.qTotal;
    const nextLabel = last ? (P.stage === 'collect' ? '코인 퀴즈로 ▶' : '곤충 연구소로 ▶') : '다음 문제 ▶';
    const expl = q.explanation ? `<p class="fact">💡 ${esc(q.explanation)}</p>` : '';
    const btn = cls => `<button type="button" class="btn ${cls} big" id="nextQ">${nextLabel}</button>`;
    let html;
    if (ok && P.stage === 'collect') html = catchHTML(expl, btn('primary'));
    else if (ok) {
      const c = speedCoins(elapsed);
      P.coins += c;
      SND('correct'); setTimeout(() => SND('coin'), 250);
      html = `<div class="feedback good"><h3>정답! (${(elapsed / 1000).toFixed(1)}초)</h3><p class="coin-burst"><i class="coin"></i> +${c}</p>${expl}${btn('primary')}</div>`;
    } else {
      SND(P.stage === 'collect' ? 'escape' : 'wrong');
      html = `<div class="feedback bad"><h3>${value === null ? '시간이 다 됐어요' : '아쉬워요!'} ${P.stage === 'collect' ? '곤충이 도망갔어요 💨' : ''}</h3>
        <p>정답: <b>${esc(GameKit.correctText(q))}</b></p>${expl}${btn('')}</div>`;
    }
    $('#feedback').innerHTML = html;
    $('#nextQ').addEventListener('click', advance);
    $('#nextQ').focus({ preventScroll: true });
    autoNext($('#nextQ'), advance);
    updateHud();
  }
  function advance() {
    P.qIndex++;
    if (P.qIndex < P.qTotal) return nextQuestion();
    if (P.stage === 'collect') {
      ensureBugs();
      startQuizStage('coin');
      toast('이제 코인 퀴즈! 빨리 맞힐수록 코인이 많아요.', 'good');
    } else goLab();
  }

  // ---------- 함께 하기: 기다리기 창 · 정답 공개 · 코인 순위 ----------
  let waitTimer = 0, waitUntil = 0;
  function showWaiting(ms) {
    waitUntil = performance.now() + ms;
    const prog = Net.progress ? `${Net.progress.answered} / ${Net.progress.total}명이 답했어요` : '';
    showModal(`
      <div class="waiting">
        <div class="hourglass" aria-hidden="true">⏳</div>
        <h2>잠시 기다려요</h2>
        <p>참가자가 문제를 푸는 동안 잠시 기다립니다.</p>
        <p class="wait-left"><b id="waitLeft">${Math.ceil(ms / 1000)}</b>초 남았어요</p>
        <p class="hint" id="waitProg">${prog}</p>
      </div>`, 'wait');
    clearInterval(waitTimer);
    waitTimer = setInterval(() => {
      const el = $('#waitLeft');
      if (!el || modalKind !== 'wait') return clearInterval(waitTimer);
      el.textContent = Math.max(0, Math.ceil((waitUntil - performance.now()) / 1000));
    }, 250);
  }
  function onQuizQ(d) {
    if (!together()) return;
    if (modalKind === 'wait' || modalKind === 'coinrank') hideModal();
    if (P.stage !== d.stage) { P.stage = d.stage; P.marks = []; }
    P.qIndex = d.i; P.qTotal = d.n; Net.progress = null;
    curQ = { ...d.q, subjectLabel: d.q.subject, answer: -1 };
    showScreen('quiz');
    showQuestion(d.ms);
  }
  function onQuizResult(r) {
    if (!together()) return;
    clearInterval(qTimer); answered = true;
    if (modalKind === 'wait') hideModal();
    const me = r.results.find(x => x.pid === P.match.you) || { ok: false, coins: 0, answered: false };
    const picked = document.querySelector('#scQuiz .opt.picked');
    const q = { ...curQ, answer: r.answer };
    markAnswer(q, picked ? Number(picked.dataset.i) : null, me.ok, r.answerText);
    const expl = r.explanation ? `<p class="fact">💡 ${esc(r.explanation)}</p>` : '';
    const nextNote = `<p class="hint pulse">${r.i + 1 < r.n ? '곧 다음 문제가 나와요' : r.stage === 'collect' ? '곧 코인 퀴즈가 시작돼요' : '곧 연구소로 이동해요'}</p>`;
    if (r.stage === 'collect') {
      $('#feedback').innerHTML = me.ok ? catchHTML(expl, nextNote)
        : `<div class="feedback bad"><h3>${me.answered ? '아쉬워요!' : '시간이 다 됐어요'} 곤충이 도망갔어요 💨</h3><p>정답: <b>${esc(r.answerText)}</b></p>${expl}${nextNote}</div>`;
      if (!me.ok) SND('escape');
    } else {
      P.coins += me.coins; P.coinBoard = r.results;
      SND(me.ok ? 'coin' : 'wrong');
      const N = r.results.length, medal = ['🥇', '🥈', '🥉', '4️⃣'];
      const rows = r.results.slice().sort((a, b) => b.total - a.total).map(x => `
        <li class="${x.pid === P.match.you ? 'me' : ''} ${x.ok ? '' : 'miss'}">
          <span class="cr-rank">${x.ok ? medal[x.rank - 1] || x.rank : '✗'}</span>
          <span class="cr-name">${esc(x.nick)}${x.bot ? ' <em>AI</em>' : ''}<small>${x.ok ? `${x.rank}등 · ${(x.t / 1000).toFixed(1)}초` : x.answered ? '오답' : '시간 초과'}</small></span>
          <span class="cr-gain">${x.ok ? `+${x.coins}` : '+0'}</span>
          <span class="cr-total"><i class="coin"></i>${x.total}</span>
        </li>`).join('');
      showModal(`
        <h2>🪙 문제 ${r.i + 1} 코인 순위</h2>
        <p class="hint">정답: <b>${esc(r.answerText)}</b> · 맞힌 순서대로 ${Array.from({ length: N }, (_, k) => 5 * (N - k)).join(' · ')} 코인</p>
        <ol class="coin-rank">${rows}</ol>
        <p class="reward">${me.ok ? `${me.rank}등! <i class="coin"></i> +${me.coins}` : '이번 문제는 0코인'} · 내 합계 <i class="coin"></i>${me.total}</p>`, 'coinrank');
    }
    updateHud();
  }
  function onStage(d) {
    if (!together()) return;
    if (d.stage === 'coin') {
      ensureBugs();
      if (modalKind === 'wait') hideModal();
      toast('코인 퀴즈 시작! 빨리 맞힐수록 코인이 많아요.', 'good');
    }
  }

  // ============================================================
  //  곤충 연구소 (업그레이드 · 대결 나가기)
  // ============================================================
  let labTimer = 0;
  function goLab() {
    P.stage = 'lab';
    ensureBugs();
    if (!canEnter(P.sel)) P.sel = bestEntrant();
    showScreen('lab');
    renderLab();
    updateHud();
    clearInterval(labTimer);
    if (together()) labTimer = setInterval(tickLab, 250);
  }
  function tickLab() {
    const el = $('#labLeft');
    if (!el || P.stage !== 'lab') return clearInterval(labTimer);
    const left = Math.max(0, Math.ceil((P.labDeadline - performance.now()) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.parentElement.classList.toggle('hurry', left <= 10);
  }
  // 함께 하기: 고른 곤충은 바뀔 때마다 서버에 알려요 (시간이 끝나면 이 곤충으로 자동 출전)
  function sendPick() {
    if (!together() || P.stage !== 'lab') return;
    const b = bug(P.sel); if (!b || !canEnter(b.type)) return;
    Net.socket.emit('lab:pick', { type: b.type, lv: b.lv, tier: b.tier });
  }
  function renderLab() {
    if (!P.sel || !bug(P.sel)) P.sel = P.bugs[0].type;
    const b = bug(P.sel), ins = D.INSECTS[b.type], st = D.statsOf(b.type, b.lv, b.tier), cap = D.capOf(b.tier);
    const maxV = 9 + D.TIER_BONUS[3] + D.MAX_LV, tb = D.TIER_BONUS[b.tier], tcol = D.RARITY[tierKey(b)].color;
    const rows = D.STATS.map((s, i) => {
      const base = ins.base[i], up = b.lv[s.k], cost = D.upgradeCost(up), maxed = up >= cap;
      return `<div class="stat-row">
        <b style="color:${s.color}">${s.name}</b>
        <div class="stat-bar" title="기본 ${base} + 등급 ${tb} + 업그레이드 ${up}"><i style="width:${base / maxV * 100}%;background:${s.color}"></i>${tb ? `<i class="tier" style="width:${tb / maxV * 100}%;background:${tcol}"></i>` : ''}<i class="up" style="width:${up / maxV * 100}%;background-color:${s.color}"></i><em class="cap" style="left:${(base + tb + cap) / maxV * 100}%"></em></div>
        <span class="val">${st[s.k]}</span>
        <button type="button" class="btn ${maxed ? '' : 'gold'}" data-up="${s.k}" ${maxed || P.coins < cost ? 'disabled' : ''}>${maxed ? `등급 한계 ${cap}` : `+1 · <i class="coin"></i>${cost}`}</button>
      </div>`;
    }).join('');
    // 등급업: 같은 곤충 모으기 + 업그레이드 두 조건을 채우면 저절로 올라가요
    const pi = D.promoInfo(b.type, b.lv, b.tier, b.copies || 1);
    const pbar = (have, need, label) => `<div class="promo-bar"><i style="width:${Math.min(100, have / need * 100)}%"></i><span>${label} ${Math.min(have, need)} / ${need}${have >= need ? ' ✔' : ''}</span></div>`;
    const promo = pi.max ? `<div class="promo max"><b>👑 최고 등급(전설)이에요!</b><span>능력치마다 ${cap}단계까지 키울 수 있어요.</span></div>`
      : `<div class="promo ${pi.next}">
          <div class="promo-head"><b>⭐ 다음 등급 <span class="rar ${pi.next}">${D.RARITY[pi.next].name}</span></b><span>두 조건을 채우면 저절로 올라가요 · 모든 능력치 +2 · 한계 ${cap} → ${D.TIER_CAP[b.tier + 1]}</span></div>
          ${pbar(pi.copies, pi.copyNeed, '같은 곤충 모으기')}
          ${pbar(pi.have, pi.need, '업그레이드 합계')}
        </div>`;
    const enabled = EV.EVENT_IDS.filter(id => settings.events[id] !== false);
    const evList = EV.EVENT_IDS.map(id => { const e = EV.EVENTS[id]; return `<li class="${enabled.includes(id) ? '' : 'off'}">${e.icon} ${esc(e.name)}<small>${e.stats.map(k => D.STATS.find(s => s.k === k).name).join('·')}</small></li>`; }).join('');
    const listScroll = $('#scLab .bug-cards') ? $('#scLab .bug-cards').scrollLeft : 0;
    const pageScroll = $('#scLab .hscroll') ? $('#scLab .hscroll').scrollLeft : 0;
    const grow = P.mode === 'grow';
    $('#scLab').innerHTML = `
      <div class="hscroll lab">
        <div class="page lab-main">
          <section class="panel lab-list">
            <h2>내 곤충 ${P.bugs.length}마리 ${grow ? '' : '<small>곤충마다 2번까지 출전</small>'}</h2>
            <div class="bug-cards">${P.bugs.map(x => {
              const i = D.INSECTS[x.type], tk = tierKey(x), u = usesOf(x.type);
              return `<button type="button" class="bug-card r-${tk} ${x.type === P.sel ? 'on' : ''} ${canEnter(x.type) ? '' : 'spent'}" data-sel="${x.type}"><span class="rar ${tk}">${D.RARITY[tk].name}</span>${grow ? '' : `<span class="uses">${u >= USE_LIMIT ? '출전 끝' : `출전 ${u}/${USE_LIMIT}`}</span>`}${x.garden ? '<span class="garden-tag" title="곤충 키우기에서 키운 곤충">🌱</span>' : ''}<img src="${pic(x.type, 80, x.type === P.sel ? 'happy' : undefined, x.tier)}" alt=""><span>${esc(i.name)}</span><small>능력 ${D.powerOf(x.type, x.lv, x.tier)}</small><b class="copies" title="이 등급에서 모은 수">×${x.copies || 1}</b></button>`;
            }).join('')}</div>
          </section>
          <section class="panel lab-detail">
            <div class="detail-top ${tierKey(b)}">
              <img src="${pic(b.type, 150, 'happy', b.tier)}" alt="">
              <div><h2>${esc(ins.name)} <span class="rar ${tierKey(b)}">${tierName(b)}</span></h2><p class="fact">${esc(ins.fact)}</p><p class="hint">능력치 합 <b>${D.powerOf(b.type, b.lv, b.tier)}</b> · 등급 보너스 +${tb} · 업그레이드 한계 ${cap}단계</p></div>
            </div>
            <div class="stat-rows">${rows}</div>
            <p class="hint">업그레이드 값 12 → 18 → 24 … · 진한 칸 기본 · 등급 색 칸 등급 보너스 · 빗금 업그레이드 · 세로선 등급 한계</p>
          </section>
          <section class="panel lab-act">
            ${promo}
            ${goBoxHTML(ins)}
            <button type="button" class="btn page-btn" data-goto-page="1">${together() ? '친구 · ' : ''}등급표 · 종목 보기 ▶</button>
          </section>
        </div>
        <div class="page lab-info">
          <section class="panel">
            ${together() ? `<h2>함께 하는 친구</h2><ul class="members" id="members">${membersHTML()}</ul>` : ''}
            <h2>등급표</h2>
            <table class="tier-table"><thead><tr><th>등급</th><th>확률</th><th>보너스</th><th>한계</th><th>다음 등급 조건</th></tr></thead><tbody>${D.TIERS.map((t, i) => `<tr class="${i === b.tier ? 'on' : ''}"><td><span class="rar ${t}">${D.RARITY[t].name}</span></td><td>${D.RARITY[t].weight}%</td><td>+${D.TIER_BONUS[i]}</td><td>${D.TIER_CAP[i]}</td><td>${i < 3 ? `모으기 ×${D.COPY_REQ[i]} · 업 ${D.PROMO_REQ[i]}` : '-'}</td></tr>`).join('')}</tbody></table>
          </section>
          <section class="panel">
            <h2>대결 종목 (무작위)</h2>
            <ul class="ev-list">${evList}</ul>
          </section>
          <section class="panel">
            <h2>출전 규칙</h2>
            <p class="hint">대결은 ${battleCount()}차전까지 있어요. 한 곤충은 <b>2번까지</b> 출전할 수 있어서, 여러 곤충을 골고루 키워야 해요. 출전할 곤충이 모자라면 기본 곤충을 받아요.</p>
            <p class="hint">대결 코인: 1등 60 · 2등 40 · 3등 25 · 4등 15</p>
            <button type="button" class="btn page-btn" data-goto-page="0">◀ 연구소로 돌아가기</button>
          </section>
        </div>
      </div>`;
    { const bc = $('#scLab .bug-cards'); if (bc) bc.scrollLeft = listScroll; const hs = $('#scLab .hscroll'); if (hs) { hs.style.scrollBehavior = 'auto'; hs.scrollLeft = pageScroll; hs.style.scrollBehavior = ''; } }
    document.querySelectorAll('[data-sel]').forEach(el => el.addEventListener('click', () => { P.sel = el.dataset.sel; SND('select'); renderLab(); }));
    document.querySelectorAll('[data-up]').forEach(el => el.addEventListener('click', () => upgrade(el.dataset.up)));
    const gb = $('#goBattle'); if (gb) gb.addEventListener('click', requestBattle);
    const lr = $('#labReady'); if (lr) lr.addEventListener('click', () => { P.labReady = true; sendPick(); Net.socket.emit('lab:ready'); SND('select'); renderLab(); });
    if (P.mode === 'grow') bindGrow();
    sendPick();
    if (together()) tickLab();
  }
  function goBoxHTML(ins) {
    if (P.mode === 'grow') return `<div class="grow-box" id="growBox"></div>`;
    if (together()) {
      const n = P.battleNo + 1;
      const spent = !canEnter(P.sel);
      return `<div class="go-box">
        <div class="lab-clock">⏱ 연구소 <b id="labLeft">-:--</b> 남음</div>
        <button type="button" class="btn primary big" id="labReady" ${P.labReady || spent ? 'disabled' : ''}>${spent ? `${esc(ins.name)}은(는) 출전을 2번 마쳤어요` : P.labReady ? `✅ ${esc(ins.name)} 준비 완료! 친구들을 기다려요` : `✅ ${esc(ins.name)}(으)로 ${n}차전 준비 완료`}</button>
        <p class="hint">시간이 끝나면 고른 곤충으로 자동 출전해요. 모두 준비하면 바로 시작!</p>
      </div>`;
    }
    const spent = !canEnter(P.sel);
    return `<div class="go-box">
      <button type="button" class="btn primary big" id="goBattle" ${spent ? 'disabled' : ''}>${spent ? `${esc(ins.name)}은(는) 출전을 2번 마쳤어요` : `⚔️ ${esc(ins.name)}(으)로 ${P.battleNo + 1}차전 나가기`}</button>
      <p class="hint">AI 곤충 2마리와 겨뤄요 (${P.battleNo + 1}/${settings.battleCount}차전). 종목은 무작위!</p>
    </div>`;
  }
  function upgrade(k) {
    const b = bug(P.sel), cost = D.upgradeCost(b.lv[k]);
    if (b.lv[k] >= D.capOf(b.tier) || P.coins < cost) { SND('deny'); return; }
    P.coins -= cost; b.lv[k]++; P.score += 10;
    SND('upgrade');
    if (!checkPromote(b, true)) {
      const pi = D.promoInfo(b.type, b.lv, b.tier, b.copies || 1);
      toast(pi.max || pi.have < pi.need ? `${D.INSECTS[b.type].name}의 ${D.STATS.find(s => s.k === k).name}이(가) 올랐어요!` : `업그레이드 조건 완료! 같은 곤충을 ${pi.copyNeed - pi.copies}마리 더 모으면 등급이 올라가요.`, 'good');
    }
    renderLab(); updateHud(); saveIfGrow();
  }
  // 등급업: 같은 곤충 모으기 + 업그레이드 조건을 채우면 저절로 1등급씩 올라가요
  // (업그레이드는 그대로, 모든 능력치 +2, 업그레이드 한계가 늘어나요, 모은 수는 1부터 다시)
  function checkPromote(b, showCard) {
    if (!b) return false;
    const before = D.powerOf(b.type, b.lv, b.tier), from = b.tier;
    for (let pi = D.promoInfo(b.type, b.lv, b.tier, b.copies || 1); pi.ok; pi = D.promoInfo(b.type, b.lv, b.tier, b.copies || 1)) {
      b.tier++; b.copies = 1;
      P.score += Math.round(D.RARITY[tierKey(b)].score / 2);
    }
    if (b.tier === from) return false;
    const after = D.powerOf(b.type, b.lv, b.tier), tk = tierKey(b);
    SND('legend'); saveIfGrow();
    if (!showCard) { toast(`🎉 ${D.INSECTS[b.type].name} ${D.RARITY[tk].name} 등급업!`, 'good'); return true; }
    showModal(`
      <div class="feedback good reveal">
        <h3>등급업! <span class="rar ${tk}">${D.RARITY[tk].name}</span> ${esc(D.INSECTS[b.type].name)}</h3>
        <div class="stage ${tk}"><img src="${pic(b.type, 170, 'happy', b.tier)}" alt="">${[[12, 20], [78, 14], [86, 70], [8, 74], [50, 4]].map(([l, t], i) => `<span class="sparkle" style="left:${l}%;top:${t}%;animation-delay:${i * 0.28}s">${tk === 'legend' ? '✨' : tk === 'hero' ? '💜' : '✦'}</span>`).join('')}</div>
        <p>같은 곤충을 모으고 업그레이드를 해서 등급이 올라갔어요!</p>
        <p>능력치 합 <b>${before} → ${after}</b> · 업그레이드 한계 ${D.TIER_CAP[from]} → <b>${D.TIER_CAP[b.tier]}</b></p>
        <div class="row"><button type="button" class="btn primary big" id="promoOk">좋아요!</button></div>
      </div>`, 'promo');
    $('#promoOk').addEventListener('click', hideModal);
    return true;
  }
  function membersHTML() {
    if (!together()) return '';
    const ready = P.match.readySet || [];
    return P.match.players.map(m => `<li class="${m.pid === P.match.you ? 'me' : ''}"><span>${m.bot ? '🤖' : '🙂'}</span><span>${esc(m.nick)}${m.pid === P.match.you ? ' (나)' : ''}</span><em>${m.bot ? 'AI' : m.gone ? '나감' : ready.includes(m.pid) ? '준비 완료' : P.stage === 'lab' ? '정비 중' : ''}</em></li>`).join('');
  }

  // ============================================================
  //  함께 하기 (Socket.IO): 대기실 → 퀴즈 → 연구소 → 대결 … 서버가 진행해요
  // ============================================================
  const Net = { socket: null, connected: false, pid: null, lobby: null, pendingJoin: null, waitChosen: false, aiAt: 0, progress: null };
  function serverUrl() { const p = new URLSearchParams(location.search); return p.get('server') || ''; }
  function ensureSocket() {
    if (Net.socket) return true;
    if (typeof window.io !== 'function') return false;
    const s = window.io(serverUrl() || undefined, { transports: ['websocket', 'polling'] });
    Net.socket = s;
    s.on('connect', () => {
      Net.connected = true; updateHud();
      if (Net.pendingJoin) s.emit('lobby:join', Net.pendingJoin);
      if (modalKind === 'lobby') renderLobby();
    });
    s.on('disconnect', () => {
      Net.connected = false; updateHud();
      if (together()) {
        P.match = null; BT = null; clearInterval(qTimer); clearInterval(labTimer);
        showModal(`<h2>연결이 끊겼어요</h2><p>서버와 연결이 끊겨 이번 경기를 이어 갈 수 없어요. 처음 화면에서 다시 시작해 주세요.</p><div class="row"><button type="button" class="btn primary" id="lostBack">처음 화면으로</button></div>`, 'lost');
        $('#lostBack').addEventListener('click', () => { hideModal(); P = null; showStart(); });
      } else if (modalKind === 'lobby') renderLobby();
    });
    s.on('lobby:joined', d => { Net.pid = d.pid; });
    s.on('lobby', info => {
      Net.lobby = info;
      Net.aiAt = info.aiLeft ? performance.now() + info.aiLeft * 1000 : 0;
      if (modalKind === 'lobby') renderLobby();
    });
    s.on('lobby:error', d => { Net.pendingJoin = null; toast(d.msg, 'bad'); showJoin(); });
    s.on('match:start', onMatchStart);
    s.on('quiz:q', onQuizQ);
    s.on('quiz:wait', d => { if (together() && modalKind === 'wait') waitUntil = performance.now() + d.ms; });
    s.on('quiz:progress', d => { Net.progress = d; const el = $('#waitProg'); if (el) el.textContent = `${d.answered} / ${d.total}명이 답했어요`; });
    s.on('quiz:r', onQuizResult);
    s.on('quiz:stage', onStage);
    s.on('lab', onLab);
    s.on('lab:ready', d => { if (!together()) return; P.match.readySet = d.ready; const ul = $('#members'); if (ul) ul.innerHTML = membersHTML(); });
    s.on('battle:start', meta => { if (!together()) return; hideModal(); clearInterval(labTimer); beginBattle('net', meta); });
    s.on('battle:state', snap => onSnap(snap));
    s.on('match:left', d => { if (!together()) return; const m = P.match.players.find(x => x.pid === d.pid); if (m) m.gone = true; toast(`${d.nick} 님이 나갔어요. 대결은 AI가 대신해요.`, 'warn'); });
    s.on('match:end', d => { if (!together()) return; hideModal(); BT = null; showFinal(d.standings); });
    s.on('match:abort', d => { if (!P || P.mode !== 'together') return; hideModal(); toast(d.msg, 'bad'); P = null; showStart(); });
    return true;
  }
  // 입장 코드를 넣으면 코드 방, 비워 두면 자동 매칭
  function showJoin() {
    const p = new URLSearchParams(location.search);
    let last = p.get('room') || '';
    try { last = last || localStorage.getItem('bugex-room') || ''; } catch (e) { /* 무시 */ }
    showModal(`
      <h2>함께 하기</h2>
      <p class="hint">최대 4명이 함께해요. <b>입장 코드</b>를 넣으면 같은 코드를 넣은 친구들과 한 방에 모이고, 비워 두면 <b>자동 매칭</b>으로 아무나 함께해요.</p>
      <form id="joinForm">
        <label class="join-label" for="roomIn">입장 코드 (선택)</label>
        <input type="text" class="room-input" id="roomIn" maxlength="12" value="${esc(last)}" placeholder="비우면 자동 매칭" autocomplete="off" autofocus>
        <div class="row"><button type="submit" class="btn primary big">시작하기</button><button type="button" class="btn" id="roomSolo">혼자 연습할래요</button></div>
      </form>`, 'join');
    $('#joinForm').addEventListener('submit', e => {
      e.preventDefault();
      const code = $('#roomIn').value.replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 12);
      try { localStorage.setItem('bugex-room', code); } catch (err) { /* 무시 */ }
      if (!ensureSocket()) { toast('실시간 서버에 연결할 수 없어 혼자 연습으로 진행해요.', 'warn'); return goSolo(); }
      joinLobby(code);
    });
    $('#roomSolo').addEventListener('click', goSolo);
  }
  function goSolo() {
    hideModal();
    P.mode = 'solo'; P.online = false;
    startQuizStage('collect');
    toast(`퀴즈 ${P.qTotal}문제를 맞혀 곤충을 채집해요!`, 'good');
  }
  function joinLobby(code) {
    Net.waitChosen = false; Net.lobby = null; Net.aiAt = 0;
    Net.pendingJoin = {
      code, nickname: GameKit.state.nickname,
      opts: { timeLimit: settings.timeLimit, collectCount: collectCount(), coinCount: settings.coinCount, labTime: settings.labTime, relabTime: settings.relabTime, battleCount: settings.battleCount },
    };
    if (Net.connected) Net.socket.emit('lobby:join', Net.pendingJoin);
    renderLobby();
  }
  let lobbyTick = 0;
  function renderLobby() {
    const L = Net.lobby, code = L ? L.code : Net.pendingJoin && Net.pendingJoin.code;
    const players = L ? L.players : [];
    const me = players.find(x => x.pid === Net.pid);
    const humansN = players.filter(x => !x.bot).length, readyN = players.filter(x => !x.bot && x.ready).length;
    const slots = [0, 1, 2, 3].map(i => {
      const x = players[i];
      return x ? `<li class="${x.pid === Net.pid ? 'me' : ''}"><span class="slot-no">${i + 1}</span><b>${esc(x.nick)}${x.pid === Net.pid ? ' (나)' : ''}</b>${x.ready ? '<span class="slot-ok">지금 시작 ✔</span>' : ''}</li>`
        : `<li class="empty"><span class="slot-no">${i + 1}</span>빈자리</li>`;
    }).join('');
    const aiLeft = () => Net.aiAt ? Math.max(0, Math.ceil((Net.aiAt - performance.now()) / 1000)) : 0;
    let body;
    if (!Net.connected) body = '<p class="hint pulse">서버에 연결하는 중…</p>';
    else if (!L) body = '<p class="hint pulse">입장하는 중…</p>';
    else if (L.mode === 'auto') body = `<p class="lobby-note">자동 매칭 중이에요. 4명이 모이면 바로 시작하고, <b id="aiLeft">${aiLeft()}</b>초 뒤에는 AI 곤충이 빈자리를 채워 시작해요.</p>`;
    else {
      body = `
        <div class="lobby-choice">
          <button type="button" class="btn ${Net.waitChosen ? 'primary' : ''}" id="lbWait">⏳ 기다리기</button>
          <button type="button" class="btn ${Net.aiAt ? 'gold' : ''}" id="lbAi" ${Net.aiAt ? 'disabled' : ''}>${Net.aiAt ? `🤖 <b id="aiLeft">${aiLeft()}</b>초 뒤 AI와 자동 대결` : `🤖 ${settings.matchWait}초 기다린 후에 AI와 자동 대결`}</button>
        </div>
        ${Net.waitChosen ? `
          <button type="button" class="btn primary big lobby-start" id="lbStart" ${L.canStart ? '' : 'disabled'}>${me && me.ready ? `✔ 지금 시작 누름 (${readyN}/${humansN}) · 다시 누르면 취소` : `▶ 지금 시작하기 (${readyN}/${humansN})`}</button>
          <p class="hint">${L.canStart ? '입장한 친구가 모두 [지금 시작하기]를 누르면 바로 시작해요. 빈자리는 비워 둔 채 2~4명이 함께해요.' : '2명 이상 모이면 [지금 시작하기]가 켜져요.'}</p>` : '<p class="hint">[기다리기]를 누르면 친구들이 모일 때까지 기다려요. 2명 이상이면 바로 시작할 수 있어요.</p>'}`;
    }
    showModal(`
      <h2>${code ? `입장 코드 <span class="code-chip">${esc(code)}</span>` : '자동 매칭'}</h2>
      <p class="hint">함께 하기 · 최대 4명</p>
      <ul class="lobby-slots">${slots}</ul>
      ${body}
      <div class="row"><button type="button" class="btn" id="lbLeave">나가기</button></div>`, 'lobby');
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
    on('#lbWait', () => { Net.waitChosen = true; renderLobby(); });
    on('#lbAi', () => { Net.socket.emit('lobby:ai'); });
    on('#lbStart', () => { Net.socket.emit('lobby:ready', { on: !(me && me.ready) }); });
    on('#lbLeave', () => { Net.pendingJoin = null; if (Net.socket) Net.socket.emit('lobby:leave'); showJoin(); });
    clearInterval(lobbyTick);
    lobbyTick = setInterval(() => { const el = $('#aiLeft'); if (modalKind !== 'lobby') return clearInterval(lobbyTick); if (el) el.textContent = aiLeft(); }, 300);
  }
  function onMatchStart(d) {
    if (!P || P.mode !== 'together') return;
    Net.pendingJoin = null; clearInterval(lobbyTick); hideModal();
    P.match = { you: d.you, players: d.players, opts: d.opts, code: d.code, host: d.host, readySet: [] };
    P.stage = 'collect'; P.qIndex = 0; P.qTotal = d.opts.collectCount; P.marks = [];
    // 방장 컴퓨터가 문제를 만들어 서버에 보내요 (구글 시트 문제·선생님 문제도 그대로)
    if (d.host) {
      const make = n => Array.from({ length: n }, () => {
        const q = Q.pick(settings, P.asked++);
        return { type: q.type, q: q.q, subject: Q.label(q.subject), options: q.options, answer: q.answer, answers: q.answers, explanation: q.explanation };
      });
      Net.socket.emit('match:questions', { collect: make(d.opts.collectCount), coin: make(d.opts.coinCount) });
    }
    showScreen('quiz');
    $('#scQuiz').innerHTML = `<section class="panel match-intro"><h2>곧 시작해요!</h2>
      <p>${d.players.map(x => `<span class="chip">${x.bot ? '🤖' : '🙂'} ${esc(x.nick)}</span>`).join(' ')}</p>
      <p class="hint">① 곤충 채집 ${d.opts.collectCount}문제 → ② 코인 퀴즈 ${d.opts.coinCount}문제 → ③ 연구소 → ④ 대결 ${d.opts.battleCount}번</p></section>`;
    updateHud();
    SND('go');
  }
  function onLab(d) {
    if (!together()) return;
    if (modalKind && modalKind !== 'settings' && modalKind !== 'help') hideModal();
    BT = null;
    P.battleNo = d.battleNo; P.labDeadline = performance.now() + d.ms; P.labReady = false; P.match.readySet = [];
    goLab();
    const sec = Math.round(d.ms / 1000), span = sec >= 60 && sec % 60 === 0 ? `${sec / 60}분` : sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`;
    toast(d.battleNo === 0 ? `연구소 ${span}! 곤충을 키우고 출전할 곤충을 골라요.` : `${d.battleNo + 1}차전 준비! ${span} 동안 재정비해요.`, 'good');
  }

  // ---------- 혼자 연습: 대결 ----------
  function requestBattle() {
    A.init();
    if (!canEnter(P.sel)) { SND('deny'); return toast('이 곤충은 출전을 2번 마쳤어요. 다른 곤충을 골라요.', 'warn'); }
    startLocalBattle();
  }
  function startLocalBattle(forceEvent) {
    const b = bug(P.sel);
    const me = { name: GameKit.state.nickname, type: b.type, lv: clone(b.lv), tier: b.tier };
    const bots = D.makeBots(2, [me], settings.difficulty, [me.name]);
    const ents = [me, ...bots].sort(() => Math.random() - 0.5);
    const evId = EV.EVENTS[forceEvent] ? forceEvent : EV.pickEvent(settings.events, P.lastEvent);
    const battle = EV.createBattle(evId, ents, { countdown: 3 });
    beginBattle('local', { id: 'local', ev: evId, ents: ents.map(e => ({ name: e.name, type: e.type, tier: D.tierOf(e.type, e.tier), bot: !!e.bot, lv: e.lv })), me: ents.indexOf(me) }, battle);
  }

  // ============================================================
  //  대결 진행 · 그리기
  // ============================================================
  let BT = null;  // { mode, meta, me, b(로컬), prev, cur, curAt, ended, lastCount, keys }
  const arenaCanvas = $('#arena'), actx = arenaCanvas.getContext('2d');
  const BTN_LABEL = { sprint: '달려! 👟', sumo: '돌진! 💥', highjump: '점프! ⬆️', dung: '굴려! 🟤', nectar: '슝~ 빨리! 💨', tug: '영차! 💪', climb: '올라가! 🧗', hurdles: '점프! 🦘' };
  function beginBattle(mode, meta, localBattle) {
    P.stage = 'battle'; P.lastEvent = meta.ev;
    const mt = meta.ents[meta.me] && meta.ents[meta.me].type;
    if (mt) P.uses[mt] = usesOf(mt) + 1;
    BT = { mode, meta, me: meta.me, b: localBattle || null, prev: null, cur: null, curAt: 0, ended: false, lastCount: null, lastT: -99, prevMine: null };
    const ev = EV.EVENTS[meta.ev];
    $('#battleHead').innerHTML = `<h2>${ev.icon} ${esc(ev.name)}</h2><p>${esc(ev.desc)}</p>
      <span class="keys">중요 능력: <b>${ev.stats.map(k => D.STATS.find(s => s.k === k).name).join(' · ')}</b> · 키보드: ${ev.control === 'lr' ? '← →' : ev.control === 'hold' ? 'Space 누르고 있기' : 'Space'}</span>`;
    renderControls(ev);
    showScreen('battle');
    updateHud();
    banner(`오늘의 종목은… ${ev.icon} ${ev.name}!`, meta.ents.map(e => `${e.name}(${D.INSECTS[e.type].name})`).join(' vs '), 2600);
    if (mode === 'local') { BT.cur = EV.snap(BT.b); BT.curAt = performance.now(); }
  }
  function renderControls(ev) {
    const box = $('#controls');
    if (ev.control === 'lr') box.innerHTML = `<button type="button" class="ctl lr" data-dir="-1">◀ 왼쪽<small>몸을 왼쪽으로</small></button><button type="button" class="ctl lr" data-dir="1">오른쪽 ▶<small>몸을 오른쪽으로</small></button>`;
    else if (ev.control === 'hold') box.innerHTML = `<button type="button" class="ctl hold" data-hold>✊ 꽉 잡기<small>돌풍이 올 때 누르고 있어요</small></button>`;
    else box.innerHTML = `<button type="button" class="ctl" data-tap>${BTN_LABEL[BT.meta.ev] || '누르기!'}<small>${ev.control === 'timing' ? '막대가 맨 위일 때!' : '화면 버튼 또는 Space'}</small></button>`;
    box.querySelectorAll('.ctl').forEach(el => {
      const down = e => {
        e.preventDefault(); el.classList.add('press'); A.init();
        if ('tap' in el.dataset) doTap();
        else if ('hold' in el.dataset) sendInput('hold', 1);
        else sendInput('dir', Number(el.dataset.dir));
        if (el.setPointerCapture && e.pointerId != null) try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      };
      const up = () => {
        if (!el.classList.contains('press')) return;
        el.classList.remove('press');
        if ('hold' in el.dataset) sendInput('hold', 0);
        else if (el.dataset.dir) sendInput('dir', 0);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  function doTap() {
    if (!BT || BT.ended) return;
    let val;
    if (BT.meta.ev === 'highjump' && BT.view) { const e = BT.view.e[BT.me]; if (e) val = e.pt; }
    sendInput('tap', val);
    SND(BT.meta.ev === 'highjump' || BT.meta.ev === 'hurdles' ? 'jump' : 'tap');
  }
  function sendInput(k, v) {
    if (!BT || BT.ended) return;
    if (BT.mode === 'net') { if (Net.socket) Net.socket.emit('input', { id: BT.meta.id, k, v }); }
    else EV.input(BT.b, BT.me, k, v);
  }
  function onSnap(snap) {
    if (!BT || BT.mode !== 'net' || BT.ended) return;
    BT.prev = BT.cur; BT.cur = snap; BT.curAt = performance.now();
    handleFx(snap);
  }
  // 서버 상태는 1초에 20번 와요. 그 사이는 앞뒤 상태를 섞어서 부드럽게 그려요.
  const NO_LERP = new Set(['fin', 'out', 'att', 'hi', 'falls', 'hits', 'n', 'mode']);
  function lerpObj(a, b, k) {
    if (!a) return b;
    const o = Array.isArray(b) ? [] : {};
    for (const key in b) {
      const x = a[key], y = b[key];
      o[key] = typeof x === 'number' && typeof y === 'number' && !NO_LERP.has(key) && Math.abs(y - x) < 60 ? x + (y - x) * k : y;
    }
    return o;
  }
  function viewSnap(now) {
    const cur = BT.cur; if (!cur) return null;
    if (BT.mode === 'local' || !BT.prev) return cur;
    const k = Math.max(0, Math.min(1, (now - BT.curAt) / 50));
    const prev = BT.prev;
    const v = { ...cur, t: prev.t + (cur.t - prev.t) * k, g: lerpObj(prev.g, cur.g, k), e: cur.e.map((e, i) => lerpObj(prev.e[i], e, k)) };
    // 높이 뛰기 막대는 내 화면 시간으로 계속 움직여요 (누른 순간 본 위치가 그대로 기록돼요)
    if (BT.meta.ev === 'highjump') {
      const el = (now - BT.curAt) / 1000;
      v.e = v.e.map((e, i) => { const c = cur.e[i]; if (c.mode !== 'aim') return e; const pt = c.pt + el; return { ...e, pt, p: EV.EVENTS.highjump.needle(c, pt) }; });
    }
    return v;
  }
  function handleFx(s) {
    for (const f of s.fx || []) {
      if (f.k === 'bump') SND('bump');
      else if (f.k === 'out' || f.k === 'slip') SND('fall');
      else if (f.k === 'trip') SND('bump');
      else if (f.k === 'nectar' && f.i === BT.me) SND('nectar');
    }
    const mine = s.e[BT.me], pm = BT.prevMine;
    if (mine && pm) {
      if (mine.fallT > 0 && !(pm.fallT > 0)) SND('splash');
      if (mine.fin != null && pm.fin == null) SND('finish');
    }
    if (BT.meta.ev === 'grass' && s.g.gs === 'gust' && BT.prevGs !== 'gust') SND('wind');
    BT.prevGs = s.g.gs; BT.prevMine = mine;
    // 3, 2, 1, 시작!
    const cnt = s.t < 0 ? Math.ceil(-s.t) : 0;
    if (cnt !== BT.lastCount) { if (cnt > 0) SND('count'); else if (BT.lastCount > 0) SND('go'); BT.lastCount = cnt; }
    if (s.done && !BT.ended) endBattle(s.results);
  }
  function battleFrame(now, dt) {
    if (!BT) return;
    if (BT.mode === 'local' && !BT.ended) {
      let rem = Math.min(dt, 0.1);
      while (rem > 1e-6) { const h = Math.min(rem, 1 / 60); EV.step(BT.b, h); rem -= h; }
      BT.cur = EV.snap(BT.b); BT.curAt = now;
      handleFx(BT.cur);
    }
    const v = viewSnap(now);
    if (!v) return;
    BT.view = v;
    ARENA.render(actx, v, BT.meta);
  }
  function endBattle(results) {
    BT.ended = true;
    const N = BT.meta.ents.length;
    const mine = results.find(r => r.i === BT.me) || { rank: N, label: '' };
    const k = Math.min(3, mine.rank - 1);
    P.coins += BATTLE_COINS[k]; P.score += BATTLE_SCORE[k]; P.places[k]++;
    P.history.push({ ev: BT.meta.ev, rank: mine.rank, type: BT.meta.ents[BT.me].type });
    P.battleNo++;
    SND(mine.rank === 1 ? 'win' : mine.rank === 2 ? 'finish' : 'lose');
    updateHud();
    const ev = EV.EVENTS[BT.meta.ev], medals = ['🥇', '🥈', '🥉', '4️⃣'];
    const list = results.map(r => {
      const en = BT.meta.ents[r.i];
      return `<li class="${r.i === BT.me ? 'me' : ''}"><span class="medal">${medals[r.rank - 1]}</span><img src="${pic(en.type, 56, r.rank === 1 ? 'happy' : undefined, D.tierOf(en.type, en.tier))}" alt="">
        <span class="who">${r.i === BT.me ? '★ ' : ''}${esc(en.name)}<small><span class="rar ${D.TIERS[D.tierOf(en.type, en.tier)]}">${D.RARITY[D.TIERS[D.tierOf(en.type, en.tier)]].name}</span> ${esc(D.INSECTS[en.type].name)}${en.bot ? ' · AI' : ''}</small></span><span class="rec">${esc(r.label)}</span></li>`;
    }).join('');
    const last = P.battleNo >= battleCount(), net = BT.mode === 'net';
    setTimeout(() => {
      if (net && !together()) return;
      showModal(`
        <h2>${ev.icon} ${esc(ev.name)} 결과 (${P.battleNo}/${battleCount()}차전)</h2>
        <ol class="podium">${list}</ol>
        <p class="reward">${mine.rank}등! <i class="coin"></i> +${BATTLE_COINS[k]} · 점수 +${BATTLE_SCORE[k]}</p>
        ${net ? `<p class="hint pulse">${last ? '잠시 후 최종 순위가 나와요' : `잠시 후 연구소에서 ${P.battleNo + 1}차전을 준비해요`}</p>`
          : `<div class="row"><button type="button" class="btn primary big" id="afterBattle">${last ? '🏆 최종 결과 보기' : '연구소로 돌아가기 ▶'}</button></div>`}`, 'result');
      const ab = $('#afterBattle');
      if (ab) ab.addEventListener('click', () => { hideModal(); BT = null; if (last) showFinal(); else goLab(); });
    }, 900);
  }

  // ============================================================
  //  최종 결과 · 명예의 전당 · 다음 선택 (처음부터 다시 / 곤충 키우기)
  // ============================================================
  function showFinal(standings) {
    P.stage = 'final';
    showScreen('final');
    updateHud();
    const legends = P.bugs.filter(b => b.tier === 3).length;
    const heroes = P.bugs.filter(b => b.tier === 2).length;
    GameKit.submitResult({ score: P.score, wave: P.places[0], correct: P.correct, total: P.total, cleared: true });
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    const table = standings ? `
      <h3>함께 한 친구들 종합 순위</h3>
      <ol class="standings">${standings.map((x, i) => `<li class="${P.match && x.pid === P.match.you ? 'me' : ''}"><span class="medal">${medals[i] || i + 1}</span><span class="st-name">${esc(x.nick)}${x.bot ? ' <em>AI</em>' : ''}</span><span class="st-places">${x.places.slice(0, standings.length).map((n, k) => `${medals[k]}${n}`).join(' ')}</span><b>${x.pts}점</b></li>`).join('')}</ol>
      <p class="hint">대결 점수: 1등 ${standings.length}점 … 꼴등 1점 (${battleCount()}번 합계)</p>` : '';
    $('#scFinal').innerHTML = `
      <div class="hscroll final-wrap">
        <div class="page">
          <section class="panel final">
            <div class="final-top">
              <h2>오늘의 곤충 리그 결과</h2>
              <button type="button" class="btn big" id="again">🔄 처음부터 다시 시작</button>
              <button type="button" class="btn primary big" id="toGrow">🌱 곤충 키우기</button>
            </div>
            <div class="final-body">
              <div>
                ${standings ? table : `<h3>대결 성적</h3><p class="hint">혼자 연습 · AI 곤충과 ${P.history.length}번 겨뤘어요.</p>`}
                <div class="mini-bugs">${P.bugs.map(b => `<img src="${pic(b.type, 64, 'happy', b.tier)}" alt="${esc(D.INSECTS[b.type].name)}" title="${esc(D.INSECTS[b.type].name)}">`).join('')}</div>
                <p class="hint">곤충 키우기: 3마리를 골라 퀴즈로 계속 키워요. 키운 곤충은 다음 게임에서 기본 곤충으로 함께 출발해요.</p>
              </div>
              <div>
                <div class="final-score"><p class="big-num">${P.score.toLocaleString()}</p><span class="hint">${esc(GameKit.state.nickname)} 선수의 점수</span></div>
                <dl class="final-stats">
                  <div><dt>퀴즈 정답</dt><dd>${P.correct} / ${P.total}</dd></div>
                  <div><dt>모은 곤충</dt><dd>${P.bugs.length}마리${legends || heroes ? ` (${[legends ? `전설 ${legends}` : '', heroes ? `영웅 ${heroes}` : ''].filter(Boolean).join(' · ')})` : ''}</dd></div>
                  <div><dt>대결 성적</dt><dd>🥇${P.places[0]} 🥈${P.places[1]} 🥉${P.places[2]}${P.places[3] ? ` 4️⃣${P.places[3]}` : ''}</dd></div>
                  <div><dt>남은 코인</dt><dd><i class="coin"></i>${P.coins}</dd></div>
                </dl>
                ${P.wrong.length ? `<button type="button" class="btn page-btn" data-goto-page="1">틀린 문제 다시 보기 (${P.wrong.length}) ▶</button>` : '<p class="hint">틀린 문제가 하나도 없어요! 👏</p>'}
              </div>
            </div>
            <div class="final-rank">
              <p class="hint" data-gk-submit-status>${esc(GameKit.submitStatusText()) || '명예의 전당 기록'}</p>
              ${GameKit.rankingButtonsHTML()}
            </div>
          </section>
        </div>
        ${P.wrong.length ? `<div class="page review-page"><section class="panel review-page" style="width:100%">
          <h2>틀린 문제 다시 보기 (${P.wrong.length})</h2>
          <div class="hcols"><ol>${P.wrong.map(w => `<li>[${esc(w.subject)}] ${esc(w.q)}<br><span class="ans">정답: ${esc(w.a)}</span></li>`).join('')}</ol></div>
          <button type="button" class="btn page-btn" data-goto-page="0">◀ 결과로 돌아가기</button>
        </section></div>` : ''}
      </div>`;
    $('#again').addEventListener('click', () => { P = null; showStart(); });
    $('#toGrow').addEventListener('click', () => chooseGarden(P.bugs));
    if (P.match) P.match = null;
  }

  // ============================================================
  //  곤충 키우기: 3마리를 골라 퀴즈로 코인을 모아 키워요 (이 브라우저에 저장)
  // ============================================================
  function chooseGarden(candidates) {
    const garden = loadGarden();
    // 같은 곤충은 더 센 쪽만 남겨요
    const best = new Map();
    for (const b of [...garden.bugs, ...candidates]) {
      const e = { ...D.cleanEntry(b.type, b.lv, b.tier), copies: b.copies || 1 }, prev = best.get(e.type);
      if (!prev || D.powerOf(e.type, e.lv, e.tier) > D.powerOf(prev.type, prev.lv, prev.tier)) best.set(e.type, e);
    }
    const list = [...best.values()].sort((a, b) => D.powerOf(b.type, b.lv, b.tier) - D.powerOf(a.type, a.lv, a.tier));
    if (list.length <= 3) { saveGarden({ bugs: list, coins: garden.coins }); return enterGrow(); }
    const picked = new Set(list.slice(0, 3).map(b => b.type));
    const render = () => {
      showModal(`
        <h2>🌱 키울 곤충 3마리 고르기</h2>
        <p class="hint">고른 3마리는 이 브라우저에 저장되고, 다음 게임에서 기본 곤충으로 함께 출발해요. (${picked.size}/3)</p>
        <div class="bug-cards pick-cards">${list.map(b => { const tk = D.TIERS[b.tier]; return `<button type="button" class="bug-card r-${tk} ${picked.has(b.type) ? 'on' : ''}" data-pick="${b.type}"><span class="rar ${tk}">${D.RARITY[tk].name}</span><img src="${pic(b.type, 80, picked.has(b.type) ? 'happy' : undefined, b.tier)}" alt=""><span>${esc(D.INSECTS[b.type].name)}</span><small>능력 ${D.powerOf(b.type, b.lv, b.tier)}</small></button>`; }).join('')}</div>
        <div class="row"><button type="button" class="btn primary big" id="gardenOk" ${picked.size ? '' : 'disabled'}>이 곤충들 키우기</button><button type="button" class="btn" id="gardenCancel">취소</button></div>`, 'garden');
      document.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', () => {
        const t = el.dataset.pick;
        if (picked.has(t)) picked.delete(t); else if (picked.size < 3) picked.add(t); else { toast('3마리까지 고를 수 있어요.', 'warn'); return; }
        SND('select'); render();
      }));
      $('#gardenOk').addEventListener('click', () => { saveGarden({ bugs: list.filter(b => picked.has(b.type)), coins: garden.coins }); hideModal(); enterGrow(); });
      $('#gardenCancel').addEventListener('click', hideModal);
    };
    render();
  }
  function enterGrow() {
    const g = loadGarden();
    if (!g.bugs.length) {
      showModal(`<h2>🌱 곤충 키우기</h2><p>아직 키우는 곤충이 없어요. 게임을 한 판 마치면 곤충을 3마리 골라 키울 수 있어요.</p><div class="row"><button type="button" class="btn primary" id="growNone">처음 화면으로</button></div>`, 'garden');
      $('#growNone').addEventListener('click', () => { hideModal(); showStart(); });
      return;
    }
    A.init();
    GameKit.hideStartScreen();
    P = { mode: 'grow', online: false, match: null, stage: 'grow', qIndex: 0, qTotal: 0, asked: 0, correct: 0, total: 0, wrong: [], marks: [],
      bugs: g.bugs, sel: g.bugs[0].type, coins: g.coins, score: 0, battleNo: 0, places: [0, 0, 0, 0], history: [], growQ: null };
    showScreen('lab');
    renderLab(); updateHud();
    toast('퀴즈를 맞혀 코인을 모으고 곤충을 키워요. 자동으로 저장돼요!', 'good');
  }
  function bindGrow() {
    const box = $('#growBox'); if (!box) return;
    if (!P.growQ) P.growQ = { q: Q.pick(settings, P.asked++), done: false, html: '' };
    const G = P.growQ, q = G.q;
    box.innerHTML = `
      <h3>🌱 퀴즈 풀고 코인 모으기 <small>정답마다 <i class="coin"></i>${settings.coinPerCorrect}</small></h3>
      <p class="q-subject">${esc(Q.label(q.subject))}</p>
      <p class="grow-q">${esc(q.q)}</p>
      ${questionHTML(q)}
      <div id="growFb">${G.html}</div>
      <div class="row"><button type="button" class="btn" id="growExit">저장하고 처음 화면으로</button></div>`;
    const finish = value => {
      if (G.done) return;
      G.done = true;
      const ok = value !== null && GameKit.checkAnswer(q, value);
      P.total++; if (ok) { P.correct++; P.coins += settings.coinPerCorrect; }
      G.picked = value; G.ok = ok;
      G.html = ok ? `<p class="good-line">정답! <i class="coin"></i> +${settings.coinPerCorrect}</p>` : `<p class="bad-line">아쉬워요! 정답: <b>${esc(GameKit.correctText(q))}</b></p>`;
      if (ok && Math.random() < 1 / 3) {
        const gb = P.bugs[Math.floor(Math.random() * P.bugs.length)];
        gb.copies = (gb.copies || 1) + 1;
        G.html += `<p class="good-line">🎁 ${esc(D.INSECTS[gb.type].name)}을(를) 한 마리 더 모았어요! ×${gb.copies}</p>`;
        checkPromote(gb, false);
      }
      G.html += `<button type="button" class="btn primary" id="growNext">다음 문제 ▶</button>`;
      SND(ok ? 'coin' : 'wrong');
      saveIfGrow(); updateHud(); renderLab();
    };
    if (G.done) {
      box.querySelectorAll('.opt').forEach(b => { b.disabled = true; const i = Number(b.dataset.i); if (i === q.answer) b.classList.add('right'); else if (i === G.picked) b.classList.add('wrong'); });
      const inp = $('#shortIn'); if (inp) { inp.disabled = true; $('#shortForm button').disabled = true; }
    } else {
      box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => finish(Number(b.dataset.i))));
      const f = box.querySelector('#shortForm'); if (f) f.addEventListener('submit', e => { e.preventDefault(); finish($('#shortIn').value); });
    }
    const nx = $('#growNext');
    if (nx) { const go = () => { P.growQ = null; renderLab(); }; nx.addEventListener('click', go); autoNext(nx, go); }
    $('#growExit').addEventListener('click', () => { saveIfGrow(); P = null; showStart(); });
  }

  // ============================================================
  //  시작 화면 (GameKit: 별명 · 방식 · 난이도 · 랭킹)
  // ============================================================
  function showStart() {
    showScreen(null);
    clearInterval(labTimer); clearInterval(qTimer);
    // 키우던 곤충이 있으면: [새 게임 시작] + 색이 다른 [곤충 키우기로 이어하기]
    const growing = loadGarden().bugs.length > 0;
    GameKit.showStartScreen({
      logo: `<div class="logo-trio">${[['bee', 1], ['rhino', 3], ['ladybug', 2]].map(([t, k]) => `<img src="${pic(t, 96, 'happy', k)}" alt="">`).join('')}</div>`,
      onStart: startFromKit,
      startLabel: growing ? '▶ 새 게임 시작' : '▶ 게임 시작',
      altButton: growing ? { label: '🌱 곤충 키우기로 이어하기', onClick: () => enterGrow() } : null,
      links: [
        { label: '게임 방법', onClick: () => { GameKit.hideStartScreen(); showHelp(true); } },
        ...(growing ? [] : [{ label: '🌱 곤충 키우기', onClick: () => enterGrow() }]),
        { label: '설정', onClick: () => { GameKit.hideStartScreen(); showSettings(true); } },
      ],
    });
  }
  function startFromKit(kit) {
    A.init();
    lockLandscape();
    settings.difficulty = kit.difficulty; saveSettings();
    newPlayer(kit);
    Q.reset();
    updateHud();
    if (P.mode === 'together') showJoin(); else goSolo();
  }

  // ---------- 게임 방법 ----------
  function showHelp(fromStart) {
    showModal(`
      <div class="help">
        <h2>게임 방법</h2>
        <div class="hcols">
        <h3>진행 순서</h3>
        <ol>
          <li><b>곤충 채집</b> — 퀴즈 ${collectCount()}문제. 맞히면 곤충을 잡아요. 어떤 곤충이든 등급은 확률로 정해져요 (일반 55% · 희귀 28% · 영웅 12% · 전설 5%). 같은 곤충을 또 잡으면 모은 수 +1 · 능력치 +1. 하나도 못 맞혀도 기본 곤충은 받아요. 문제를 풀면 3초 뒤 저절로 다음 문제로 넘어가요.</li>
          <li><b>코인 퀴즈</b> — 퀴즈 ${settings.coinCount}문제. 빨리 맞힐수록 코인이 많아요 (4명: 1등 20 · 15 · 10 · 4등 5, 2명: 10 · 5, 틀리면 0).</li>
          <li><b>곤충 연구소</b> — 코인으로 속도·힘·균형·점프·체력을 올려요. <b>같은 곤충을 모은 수</b>(일반→희귀 ×2 · 희귀→영웅 ×3 · 영웅→전설 ×4)와 <b>업그레이드 합계</b>(6 · 14 · 24)를 채우면 저절로 <b>등급업</b>! 등급마다 모든 능력치 +2, 업그레이드 한계도 늘어나요. 곤충 카드 오른쪽 아래 숫자가 모은 수예요.</li>
          <li><b>곤충 대결</b> — 무작위 종목으로 ${settings.battleCount}차전까지 겨뤄요. <b>한 곤충은 2번까지</b> 출전할 수 있어요. 1등 코인 60 · 2등 40 · 3등 25 · 4등 15. 대결 사이에 연구소에서 재정비해요.</li>
          <li><b>곤충 키우기</b> — 다 끝나면 3마리를 골라 퀴즈로 계속 키울 수 있어요. 키운 곤충은 다음 게임에서 기본 곤충으로 함께 출발해요.</li>
        </ol>
        <h3>대결 종목 10가지</h3>
        <ul>${EV.EVENT_IDS.map(id => { const e = EV.EVENTS[id]; return `<li>${e.icon} <b>${esc(e.name)}</b> — ${esc(e.desc)}</li>`; }).join('')}</ul>
        <h3>함께 하기 (최대 4명)</h3>
        <ul>
          <li><b>입장 코드</b>를 넣으면 같은 코드의 친구들과 한 방에 모여요. [기다리기]를 누르고, 2명 이상이 모여 모두 [지금 시작하기]를 누르면 시작해요 (2~4명). [${settings.matchWait}초 기다린 후에 AI와 자동 대결]을 누르면 시간이 지나 빈자리를 AI가 채워 시작해요.</li>
          <li>코드 없이 시작하면 <b>자동 매칭</b>: 4명이 모이거나 ${settings.matchWait}초가 지나면 AI와 함께 시작해요.</li>
          <li>퀴즈는 모두 같은 문제를 풀어요. 먼저 푼 친구는 모두 풀 때까지 기다리고, 다 풀면 정답이 공개돼요.</li>
          <li>연구소는 처음 ${Math.round(settings.labTime / 60 * 10) / 10}분, 대결 사이에는 ${settings.relabTime}초. 시간이 끝나면 고른 곤충으로 자동 출전해요.</li>
        </ul>
        <h3>점수</h3>
        <p class="hint">정답 100점 · 새 곤충 일반 50 / 희귀 100 / 영웅 150 / 전설 250 · 업그레이드 10 · 등급업 50~125 · 대결 1등 300 / 2등 150 / 3등 50 / 4등 20</p>
        </div>
        <div class="row"><button type="button" class="btn primary" id="helpClose">알겠어요!</button></div>
      </div>`, 'help', 'wide');
    $('#helpClose').addEventListener('click', () => { hideModal(); if (fromStart) showStart(); });
  }

  // ============================================================
  //  설정 (일반 + 숨은 관리자 설정)
  //  제작자 표시를 5초 안에 10번 누르면 관리자 설정 페이지가 열려요 (새로 고침 전까지 유지)
  // ============================================================
  let adminUnlocked = false;
  const CREDIT = '제작자 : 열혈교사 최영환(teacher@happyclass.kr)';
  // GitHub Pages 주소(아이디.github.io/저장소)면 그 저장소, 아니면(Render 등) 기본 저장소의 config.json
  function repoInfo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    const owner = m ? m[1] : 'Kor-Great-teacher';
    const repo = m ? (location.pathname.split('/').filter(Boolean)[0] || `${owner}.github.io`) : 'bug-ex';
    return { owner, repo };
  }
  const repoEditUrl = () => { const { owner, repo } = repoInfo(); return `https://github.com/${owner}/${repo}/edit/main/config.json`; };
  const configJson = v => JSON.stringify({ '_안내': '꼬마 파브르 곤충 리그 전역 설정 — 관리자 설정 페이지에서 만들었어요. 모든 학생에게 적용돼요.', settings: v }, null, 2) + '\n';

  // ---------- 관리자 설정에서 GitHub의 config.json 을 바로 저장 ----------
  // 선생님이 만든 GitHub 토큰(이 저장소 Contents 쓰기 권한만)으로 GitHub API에 직접 저장해요.
  // 토큰은 이 브라우저에만 보관하고(선택), 게임 코드나 저장소에는 들어가지 않아요.
  const TOKEN_KEY = 'bugex-gh-token';
  const loadToken = () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } };
  function keepToken(token, remember) {
    try {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch (e) { /* 저장 못 해도 이번에는 쓸 수 있어요 */ }
  }
  const b64 = str => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  async function pushConfig(token, content) {
    const { owner, repo } = repoInfo();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/config.json`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
    const why = st => st === 401 ? '토큰이 맞지 않거나 기한이 지났어요.'
      : st === 403 || st === 404 ? `토큰에 ${owner}/${repo} 저장소의 Contents 쓰기 권한이 없어요.`
      : st === 409 || st === 422 ? '그사이 다른 곳에서 config.json이 바뀌었어요. 다시 눌러 주세요.' : `GitHub 응답 오류 (${st})`;
    const cur = await fetch(`${url}?ref=main&t=${Date.now()}`, { headers, cache: 'no-store' });
    if (!cur.ok && cur.status !== 404) throw new Error(why(cur.status));
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const res = await fetch(url, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '관리자 설정에서 전역 설정 변경', content: b64(content), branch: 'main', ...(sha ? { sha } : {}) }),
    });
    if (!res.ok) throw new Error(why(res.status));
  }
  const DIFF_LABEL = { easy: '쉬움 · AI 곤충이 약해요', normal: '보통 · AI 곤충이 나와 비슷해요', hard: '어려움 · AI 곤충이 강해요' };
  function showSettings(fromStart, page = 'general') {
    const before = { music: A.musicVolume, sfx: A.sfxVolume };
    const opt = (vals, cur, fmt) => vals.map(v => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${fmt(v)}</option>`).join('');
    const pct = v => Math.round(v * 100);
    const volRow = (id, label, v) => `<label class="vol">${label}<span class="vol-row"><input type="range" id="${id}" min="0" max="100" step="5" value="${pct(v)}"><output id="${id}Out">${pct(v)}%</output></span></label>`;
    const goalNow = collectCount();
    const source = Q.hasSheet() ? `구글 시트 문항 ${GameKit.state.questions.length}개 (주소로 불러옴)` : '게임에 들어 있는 문제 은행 + 선생님 문제';
    showModal(`
      <form class="settings" id="setForm">
        <div class="set-head">
          <h2>설정</h2>
          <div class="tabs" role="tablist">
            <button type="button" role="tab" class="tab" data-page="general">일반</button>
            ${adminUnlocked ? '<button type="button" role="tab" class="tab" data-page="admin">관리자 설정</button>' : ''}
          </div>
        </div>

        <section class="set-page" data-page="general">
          <label>게임 난이도 (AI 곤충 세기)<select id="setDiff" data-sync="diff">${opt(['easy', 'normal', 'hard'], settings.difficulty, v => DIFF_LABEL[v])}</select></label>
          ${volRow('volMusic', '배경음악 소리 크기', A.musicVolume)}
          ${volRow('volSfx', '효과음 소리 크기', A.sfxVolume)}
        </section>

        ${adminUnlocked ? `
        <section class="set-page hcols" data-page="admin" hidden>
          <p class="hint">게임 관리자·교사용 설정이에요. <b>저장</b>은 이 브라우저에만 적용돼요. 모든 학생에게 적용하려면 맨 아래 <b>전역 설정</b>을 쓰세요. 실시간 대결의 <b>종목·기다리는 시간·AI 세기</b>는 서버가 전역 설정(config.json)을 따라요.</p>
          <p class="ti-status ${globalConfig ? 'ok' : ''}">${globalConfig ? '전역 설정(config.json)을 불러왔어요. 모든 학생에게 같은 값이 적용돼요.' : '전역 설정(config.json)을 읽지 못해 기본값을 쓰고 있어요. 서버(Render) 주소로 열었을 때 읽혀요.'}</p>
          ${local.admin ? '<p class="ti-status bad">이 브라우저에는 관리자 설정이 따로 저장돼 있어서 전역 설정보다 먼저 적용돼요. <button type="button" class="btn" id="admReset">지우고 전역 설정 따르기</button></p>' : ''}
          <fieldset><legend>게임 환경</legend><div class="grid2">
            <label>게임 난이도 (AI 곤충 세기)<select id="admDiff" data-sync="diff">${opt(['easy', 'normal', 'hard'], settings.difficulty, v => DIFF_LABEL[v])}</select></label>
            <label>곤충 채집 문제 수<input type="number" id="admCollect" min="1" max="50" value="${goalNow}"></label>
            <label>코인 퀴즈 문제 수<input type="number" id="admCoinCount" min="1" max="50" value="${settings.coinCount}"></label>
            <label>곤충 키우기 정답 코인<input type="number" id="admCoinPer" min="1" max="200" value="${settings.coinPerCorrect}"></label>
            <label>대결 횟수 (곤충마다 2번까지 출전)<input type="number" id="admBattles" min="1" max="10" value="${settings.battleCount}"></label>
            <label>함께 하기: AI와 자동 대결까지 기다리는 시간<select id="admWait">${opt([10, 15, 20, 30, 45, 60], settings.matchWait, v => `${v}초`)}</select></label>
            <label>함께 하기: 첫 연구소 시간<select id="admLab">${opt([60, 90, 120, 180, 240], settings.labTime, v => `${v / 60}분`)}</select></label>
            <label>함께 하기: 대결 사이 재정비 시간<select id="admRelab">${opt([30, 45, 60, 90, 120], settings.relabTime, v => `${v}초`)}</select></label>
          </div>
          ${volRow('admMusic', '배경음악 소리 크기', A.musicVolume)}
          ${volRow('admSfx', '효과음 소리 크기', A.sfxVolume)}
          </fieldset>
          <fieldset><legend>대결 종목 (무작위로 나올 종목)</legend>
            <div class="checks">${EV.EVENT_IDS.map(id => `<label><input type="checkbox" id="ev-${id}" ${settings.events[id] !== false ? 'checked' : ''}> ${EV.EVENTS[id].icon} ${esc(EV.EVENTS[id].name)}</label>`).join('')}</div>
          </fieldset>
          <fieldset><legend>퀴즈</legend>
            <p class="hint">문항 출처: ${esc(source)}</p>
            <div class="checks">
              ${Object.entries(Q.SUBJECTS).map(([k, v]) => `<label><input type="checkbox" id="sub-${k}" ${settings.subjects[k] ? 'checked' : ''}> ${v}</label>`).join('')}
            </div>
            <div class="grid2">
              <label>문제당 제한 시간<select id="setLimit">${opt([0, 10, 15, 20, 30, 45], settings.timeLimit, v => v ? `${v}초` : '제한 없음')}</select></label>
              <label>수학 난이도<select id="setMath">${opt(['auto', 1, 2, 3, 4, 5], settings.mathLevel, v => v === 'auto' ? '문제를 풀수록 자동' : ['', '1단계 · 20까지 덧뺄셈', '2단계 · 두 자리 덧뺄셈', '3단계 · 곱셈구구', '4단계 · 나눗셈·혼합', '5단계 · 분수·넓이·백분율'][v])}</select></label>
            </div>
            <label class="block"><span>선생님 문제 (한 줄에 한 문제 · <code>문제 | 정답 | 오답1 | 오답2 | 오답3</code>)</span>
              <textarea id="setCustom" rows="4" placeholder="곤충의 다리는 몇 개일까요? | 6개 | 4개 | 8개 | 10개">${esc(settings.custom)}</textarea>
            </label>
            <p class="hint" id="customCount"></p>
          </fieldset>
          <fieldset><legend>전역 설정 (모든 학생에게 적용)</legend>
            <p class="hint">위 값으로 전역 설정 파일 내용을 만들어요. 아래 순서대로 GitHub의 <code>config.json</code>에 붙여 넣으면 Render가 다시 배포된 뒤(2~5분) 모든 학생에게 적용돼요.</p>
            <ol class="steps">
              <li><b>전역 설정 파일 만들기</b>를 누르고 <b>복사</b>해요.</li>
              <li><a href="${esc(repoEditUrl())}" target="_blank" rel="noopener">GitHub에서 config.json 편집 열기</a> (로그인 필요) → 내용을 모두 지우고 붙여 넣기</li>
              <li><b>Commit changes</b>를 눌러 저장해요.</li>
            </ol>
            <div class="row">
              <button type="button" class="btn" id="cfgMake">전역 설정 파일 만들기</button>
              <button type="button" class="btn" id="cfgCopy" disabled>복사</button>
            </div>
            <textarea id="cfgOut" rows="8" readonly hidden></textarea>
            <hr class="sep">
            <p class="hint"><b>바로 저장하기</b>: GitHub 토큰을 넣으면 복사·붙여 넣기 없이 이 버튼으로 바로 전역 설정을 바꿔요. 토큰은 이 저장소의 <b>Contents 쓰기</b> 권한만 주세요. 만드는 방법은 README에 있어요.</p>
            <label>GitHub 토큰<input type="password" id="ghToken" autocomplete="off" placeholder="github_pat_..." value="${esc(loadToken())}"></label>
            <label class="inline"><input type="checkbox" id="ghRemember" ${(() => { try { return localStorage.getItem(TOKEN_KEY) ? 'checked' : ''; } catch (e) { return ''; } })()}> 이 브라우저에 토큰 기억하기 (여럿이 쓰는 컴퓨터에서는 끄세요)</label>
            <div class="row">
              <button type="button" class="btn primary" id="cfgPush">전역 설정 바로 저장</button>
              <button type="button" class="btn" id="ghForget">토큰 지우기</button>
            </div>
            <p class="hint" id="pushMsg" aria-live="polite"></p>
          </fieldset>
        </section>` : ''}

        <p class="hint" id="setMsg" aria-live="polite"></p>
        <div class="row">
          <button type="submit" class="btn primary">저장</button>
          <button type="button" class="btn" id="setCancel">취소</button>
        </div>
        <p class="credit" id="credit">${esc(CREDIT)}</p>
      </form>`, 'settings', adminUnlocked ? 'wide' : '');

    const show = name => {
      if (name === 'admin' && !adminUnlocked) name = 'general';
      document.querySelectorAll('.set-page').forEach(sec => { sec.hidden = sec.dataset.page !== name; });
      document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.page === name)));
    };
    show(page);
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.page)));

    // 일반·관리자 페이지의 같은 설정은 서로 따라 움직여요
    document.querySelectorAll('[data-sync="diff"]').forEach(el => el.addEventListener('change', () => {
      document.querySelectorAll('[data-sync="diff"]').forEach(o => { o.value = el.value; });
    }));
    const bindVol = (ids, apply) => ids.forEach(id => {
      const el = $(`#${id}`); if (!el) return;
      el.addEventListener('input', () => {
        for (const other of ids) { const o = $(`#${other}`); if (!o) continue; o.value = el.value; $(`#${other}Out`).textContent = `${el.value}%`; }
        A.init(); apply(el.value / 100); // 움직이는 동안 바로 들어 볼 수 있어요
      });
    });
    bindVol(['volMusic', 'admMusic'], v => A.setMusicVolume(v));
    bindVol(['volSfx', 'admSfx'], v => { A.setSfxVolume(v); SND('coin'); });

    // 제작자 표시 연속 클릭
    let clicks = [];
    $('#credit').addEventListener('click', () => {
      if (adminUnlocked) return;
      const now = performance.now();
      clicks = clicks.filter(t => now - t <= 5000); clicks.push(now);
      if (clicks.length >= 10) { adminUnlocked = true; SND('upgrade'); showSettings(fromStart, 'admin'); toast('관리자 설정이 열렸어요.', 'good'); }
    });

    if (adminUnlocked) {
      const count = () => {
        const n = Q.parseCustom($('#setCustom').value).length;
        $('#customCount').textContent = n ? `선생님 문제 ${n}개를 읽었어요. '선생님 문제' 과목에 체크하면 출제돼요.` : '선생님 문제를 입력하면 여기에서 개수를 확인할 수 있어요.';
      };
      count();
      $('#setCustom').addEventListener('input', count);
    }

    // 관리자 페이지 입력값 읽기 (잘못된 값이면 안내하고 null)
    function readAdminForm() {
      const subjects = {}, events = {};
      for (const k of Object.keys(Q.SUBJECTS)) subjects[k] = $(`#sub-${k}`).checked;
      for (const id of EV.EVENT_IDS) events[id] = $(`#ev-${id}`).checked;
      if (!Object.values(subjects).some(Boolean)) { show('admin'); $('#setMsg').textContent = '퀴즈 과목을 하나 이상 골라 주세요.'; return null; }
      if (!Object.values(events).some(Boolean)) { show('admin'); $('#setMsg').textContent = '대결 종목을 하나 이상 골라 주세요.'; return null; }
      const int = (id, lo, hi, def) => Math.max(lo, Math.min(hi, Math.round(Number($(id).value)) || def));
      return {
        difficulty: $('#admDiff').value, subjects,
        timeLimit: Number($('#setLimit').value), mathLevel: $('#setMath').value,
        collectCount: int('#admCollect', 1, 50, 7), coinCount: int('#admCoinCount', 1, 30, 13), coinPerCorrect: int('#admCoinPer', 1, 200, 20),
        battleCount: int('#admBattles', 1, 10, 6), matchWait: Number($('#admWait').value),
        labTime: Number($('#admLab').value), relabTime: Number($('#admRelab').value),
        events, custom: $('#setCustom').value,
      };
    }
    const applyNow = v => { GameKit.state.quizGoal = v.collectCount; GameKit.config.defaultQuizGoal = v.collectCount; Q.setCustom(settings.custom); Q.reset(); };
    if (adminUnlocked) {
      $('#cfgMake').addEventListener('click', () => {
        const v = readAdminForm(); if (!v) return;
        const out = $('#cfgOut');
        out.value = configJson(v);
        out.hidden = false; $('#cfgCopy').disabled = false; out.focus(); out.select();
      });
      $('#cfgPush').addEventListener('click', async () => {
        const v = readAdminForm(); if (!v) return;
        const token = $('#ghToken').value.trim();
        const msg = $('#pushMsg');
        if (!token) { msg.textContent = 'GitHub 토큰을 먼저 넣어 주세요.'; return; }
        keepToken(token, $('#ghRemember').checked);
        const btn = $('#cfgPush'); btn.disabled = true; msg.textContent = 'GitHub에 저장하는 중…';
        try {
          await pushConfig(token, configJson(v));
          // 이 브라우저도 바로 전역 설정을 따르게 해요
          globalConfig = clone(v); local.admin = null; saveLocal();
          settings = buildSettings(); applyNow(settings);
          msg.textContent = '저장했어요. Render가 다시 배포되는 2~5분 뒤부터 모든 학생에게 적용돼요. (이미 열려 있는 화면은 새로 고침하면 적용)';
          SND('upgrade'); toast('전역 설정을 GitHub에 저장했어요.', 'good');
        } catch (e) {
          msg.textContent = `저장하지 못했어요: ${e.message && !/fetch/i.test(e.message) ? e.message : '인터넷 연결을 확인해 주세요.'}`;
          SND('deny');
        } finally { btn.disabled = false; }
      });
      $('#ghForget').addEventListener('click', () => { keepToken('', false); $('#ghToken').value = ''; $('#ghRemember').checked = false; $('#pushMsg').textContent = '이 브라우저에서 토큰을 지웠어요.'; });
      $('#cfgCopy').addEventListener('click', () => {
        const out = $('#cfgOut');
        const done = () => toast('복사했어요. GitHub의 config.json에 붙여 넣으세요.', 'good');
        if (navigator.clipboard) navigator.clipboard.writeText(out.value).then(done, () => { out.select(); toast('자동 복사가 안 돼요. 선택된 글을 Ctrl+C로 복사하세요.', 'warn'); });
        else { out.select(); toast('선택된 글을 Ctrl+C로 복사하세요.', 'warn'); }
      });
      const reset = $('#admReset');
      if (reset) reset.addEventListener('click', () => {
        local.admin = null; saveLocal();
        settings = buildSettings(); applyNow(settings);
        toast('이 브라우저의 관리자 설정을 지웠어요. 전역 설정을 따라요.', 'good');
        showSettings(fromStart, 'admin');
      });
    }

    const back = () => { hideModal(); if (fromStart) showStart(); else if (P && P.stage === 'lab') renderLab(); };
    $('#setCancel').onclick = () => { A.setMusicVolume(before.music); A.setSfxVolume(before.sfx); back(); };
    $('#setForm').addEventListener('submit', e => {
      e.preventDefault();
      if (adminUnlocked) {
        const v = readAdminForm();
        if (!v) return;
        Object.assign(settings, v);
        local.admin = pickAdmin(settings); // 이 브라우저에만 저장 (전역 설정보다 먼저 적용)
        applyNow(settings);
        if (v.subjects.custom && !Q.parseCustom(settings.custom).length) toast('선생님 문제가 비어 있어서 다른 과목에서 출제해요.', 'warn');
      }
      settings.difficulty = $('#setDiff').value;
      GameKit.state.difficulty = settings.difficulty;
      saveSettings();
      back();
      updateHud();
      if (!fromStart) toast('설정을 저장했어요.', 'good');
    });
  }

  // ---------- 아이콘 버튼 ----------
  const SVG = d => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const NOTE = '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="16" r="3" fill="currentColor"/>';
  const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/>';
  const ICONS = {
    gear: SVG('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    sfxOn: SVG(SPEAKER + '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
    sfxOff: SVG(SPEAKER + '<path d="M16 9l5 6M21 9l-5 6"/>'),
    musicOn: SVG(NOTE),
    musicOff: SVG(NOTE + '<path d="M3 3l18 18"/>'),
    help: SVG('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/>'),
  };
  function setIconBtn(sel, html, pressed) { const b = $(sel); b.innerHTML = html; if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed)); }
  function refreshIcons() {
    setIconBtn('#settingsBtn', ICONS.gear);
    setIconBtn('#helpBtn', ICONS.help);
    setIconBtn('#sfxBtn', A.sfx ? ICONS.sfxOn : ICONS.sfxOff, A.sfx);
    setIconBtn('#musicBtn', A.music ? ICONS.musicOn : ICONS.musicOff, A.music);
  }
  // 함께 하기 진행 중에는 설정 · 도움말 창이 진행 화면을 가리지 않게 막아요
  const busy = () => ['lobby', 'join', 'wait', 'coinrank', 'result', 'lost', 'garden'].includes(modalKind) || together();
  $('#settingsBtn').addEventListener('click', () => { if (busy()) return toast('함께 하기 중에는 설정을 열 수 없어요.', 'warn'); A.init(); showSettings(false); });
  $('#helpBtn').addEventListener('click', () => { if (busy()) return toast('함께 하기 중에는 도움말을 열 수 없어요.', 'warn'); showHelp(false); });
  $('#sfxBtn').addEventListener('click', () => { A.init(); A.setSfx(!A.sfx); refreshIcons(); });
  $('#musicBtn').addEventListener('click', () => { A.init(); A.setMusic(!A.music); refreshIcons(); });

  // ---------- 키보드 ----------
  document.addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input, textarea, select')) return;
    if (BT && !BT.ended && !$('#scBattle').hidden) {
      const ctl = EV.EVENTS[BT.meta.ev].control;
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        if (ctl === 'hold') sendInput('hold', 1); else if (ctl !== 'lr') doTap();
        $('#controls .ctl') && $('#controls .ctl').classList.add('press');
      } else if (ctl === 'lr' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd')) {
        e.preventDefault();
        const d = e.key === 'ArrowLeft' || e.key === 'a' ? -1 : 1;
        sendInput('dir', d);
        document.querySelectorAll('#controls .ctl').forEach(b => b.classList.toggle('press', Number(b.dataset.dir) === d));
      } else if (e.code === 'Space') e.preventDefault();
      return;
    }
    if (P && !$('#scQuiz').hidden && !answered && modalEl.hidden && /^[1-4]$/.test(e.key)) {
      const b = document.querySelector(`.opt[data-i="${Number(e.key) - 1}"]`); if (b) b.click();
    }
  });
  document.addEventListener('keyup', e => {
    if (!BT || BT.ended) return;
    const ctl = EV.EVENTS[BT.meta.ev].control;
    if (e.code === 'Space' || e.key === 'Enter') { if (ctl === 'hold') sendInput('hold', 0); document.querySelectorAll('#controls .ctl').forEach(b => b.classList.remove('press')); }
    if (ctl === 'lr' && ['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) { sendInput('dir', 0); document.querySelectorAll('#controls .ctl').forEach(b => b.classList.remove('press')); }
  });

  // ---------- 16:9 판 맞추기 ----------
  // 1024×576 판을 화면에 꽉 차게 늘리거나 줄여요. 세로로 든 터치 기기는 판을 90도 돌려 가로로 보여 줘요.
  const STAGE_W = 1024, STAGE_H = 576;
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function fitStage() {
    const st = document.getElementById('stage'); if (!st) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const rotate = touch && vh > vw;
    const k = rotate ? Math.min(vw / STAGE_H, vh / STAGE_W) : Math.min(vw / STAGE_W, vh / STAGE_H);
    st.style.transform = `translate(-50%, -50%)${rotate ? ' rotate(90deg)' : ''} scale(${k})`;
    st.classList.toggle('rotated', rotate);
  }
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 200));
  fitStage();
  // 휴대폰 · 태블릿: 게임을 시작할 때 전체 화면 + 가로 고정을 해 봐요 (안 되는 브라우저는 판을 돌려서 보여 줘요)
  async function lockLandscape() {
    if (!touch) return;
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { /* 무시 */ }
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* 무시 */ }
    setTimeout(fitStage, 300);
  }
  // 좌우 쪽 넘기기: [다음 쪽] 버튼 · 마우스 휠을 좌우로
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-goto-page]'); if (!b) return;
    const hs = b.closest('.hscroll'); if (!hs) return;
    hs.scrollTo({ left: hs.clientWidth * Number(b.dataset.gotoPage), behavior: 'smooth' });
  });
  document.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    let el = e.target;
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) {
        el.scrollLeft += e.deltaY; e.preventDefault(); return;
      }
      el = el.parentElement;
    }
  }, { passive: false });

  // ---------- 반복 그리기 ----------
  let lastNow = performance.now();
  function frame(now) {
    const dt = Math.max(0, (now - lastNow) / 1000); lastNow = now;
    if (BT && !$('#scBattle').hidden) battleFrame(now, dt);
    requestAnimationFrame(frame);
  }

  // ---------- 시작 ----------
  function startKit() {
    return GameKit.init({
      gameName: '꼬마 파브르 곤충 리그',
      defaultMode: 'game',
      defaultDifficulty: settings.difficulty,
      defaultQuizGoal: settings.collectCount,
      modeLabels: { free: '혼자 연습', game: '함께 하기' },
      modeDescriptions: { free: 'AI 곤충 2마리와 대결 · 채집 {n}문제', game: '최대 4명 실시간 · 입장 코드 또는 자동 매칭 · 채집 {n}문제' },
      difficultyDescriptions: { easy: 'AI 곤충이 약해요', normal: 'AI 곤충이 나와 비슷해요', hard: 'AI 곤충이 강해요' },
      waveLabel: '🥇{n}',
    }).then(kit => {
      if (kit.fromSheet) Q.setSheet(kit.questions, kit.unit.subject || '시트 문제');
    });
  }
  function boot() {
    $('#brandIcon').src = pic('ladybug', 44, 'happy');
    refreshIcons();
    showStart();
    requestAnimationFrame(frame);
  }
  // 테스트·디버그용 손잡이
  window.__bugex = { get P() { return P; }, get BT() { return BT; }, get settings() { return settings; }, Net, startLocalBattle, goLab, showFinal, answer, enterGrow, get curQ() { return curQ; } };
  loadGlobalConfig().then(() => {
    startKit();
    // 글꼴과 캐릭터 그림을 기다렸다가 시작해요 (그림이 늦어도 4초 뒤에는 시작)
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([Promise.all([fonts, ART.load()]), new Promise(r => setTimeout(r, 4000))]).then(boot);
  });
})();
