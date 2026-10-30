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
    collectCount: 7, coinCount: 10, coinPerCorrect: 20,
    battleCount: 3, matchWait: 15,
    events: Object.fromEntries(EV.EVENT_IDS.map(id => [id, true])),
    custom: '',
  };
  const SKEY = 'bugex-settings-v1';
  const ADMIN_KEYS = ['difficulty', 'subjects', 'timeLimit', 'mathLevel', 'collectCount', 'coinCount', 'coinPerCorrect', 'battleCount', 'matchWait', 'events', 'custom'];
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
  let P = null;
  function newPlayer(kit) {
    P = {
      online: kit.mode === 'game',
      stage: 'collect', qIndex: 0, qTotal: 0, asked: 0,
      correct: 0, total: 0, wrong: [], marks: [],
      bugs: [],             // [{ type, lv }]
      sel: null, coins: 0, score: 0,
      battleNo: 0, places: [0, 0, 0], history: [], lastEvent: null,
    };
  }
  const bug = type => P.bugs.find(b => b.type === type);
  const collectCount = () => Math.max(1, GameKit.state.quizGoal || settings.collectCount || 7);
  const BATTLE_COINS = [60, 40, 25], BATTLE_SCORE = [300, 150, 50];

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
    const st = { collect: `채집 ${Math.min(P.qIndex + 1, P.qTotal)}/${P.qTotal}`, coin: `코인 퀴즈 ${Math.min(P.qIndex + 1, P.qTotal)}/${P.qTotal}`, lab: '연구소', battle: `대결 ${P.battleNo + 1}/${settings.battleCount}`, final: '결과' }[P.stage];
    $('#hudStage').textContent = st;
    $('#hudCoins').textContent = P.coins.toLocaleString();
    $('#hudScore').textContent = P.score.toLocaleString();
    $('#hudBugs').textContent = `${P.bugs.length}마리`;
    $('#hudCorrect').textContent = `${P.correct} / ${P.total}`;
    $('#hudNetBox').hidden = !P.online;
    if (P.online) $('#hudNet').textContent = Net.connected ? `${Net.room} · ${Net.info ? Net.info.members.length : 1}명` : '연결 중…';
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
  function showModal(html, kind = 'info') {
    dialogEl.innerHTML = html; modalEl.hidden = false; modalKind = kind;
    const f = dialogEl.querySelector('[autofocus]') || dialogEl.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
  function hideModal() { modalEl.hidden = true; dialogEl.innerHTML = ''; modalKind = null; }

  // ============================================================
  //  퀴즈 (채집 · 코인)
  // ============================================================
  let curQ = null, qTimer = null, qDeadline = 0, answered = false;
  function startQuizStage(kind) {
    P.stage = kind; P.qIndex = 0; P.marks = [];
    P.qTotal = kind === 'collect' ? collectCount() : Math.max(1, settings.coinCount);
    showScreen('quiz');
    nextQuestion();
    Net.status('quiz');
  }
  function nextQuestion() {
    answered = false;
    curQ = Q.pick(settings, P.asked++);
    renderQuiz();
    updateHud();
    SND('quiz');
    clearInterval(qTimer);
    if (settings.timeLimit > 0) {
      qDeadline = performance.now() + settings.timeLimit * 1000;
      qTimer = setInterval(tickTimer, 200);
      tickTimer();
    }
  }
  function tickTimer() {
    const left = Math.max(0, qDeadline - performance.now());
    const bar = $('#qTimer'); if (bar) bar.style.width = `${left / (settings.timeLimit * 1000) * 100}%`;
    if (left <= 0) { clearInterval(qTimer); if (!answered) answer(null); }
  }
  function renderQuiz() {
    const collect = P.stage === 'collect', q = curQ;
    const dots = Array.from({ length: P.qTotal }, (_, i) => `<i class="${P.marks[i] === true ? 'ok' : P.marks[i] === false ? 'no' : i === P.qIndex ? 'now' : ''}"></i>`).join('');
    let body;
    if (q.type === 'short') {
      body = `<form class="short-form" id="shortForm"><input id="shortIn" type="text" autocomplete="off" placeholder="정답을 써요" aria-label="정답"><button class="btn primary" type="submit">확인</button></form>`;
    } else {
      body = `<div class="opts ${q.type === 'ox' ? 'ox' : ''}">${q.options.map((o, i) => `<button type="button" class="opt" data-i="${i}">${q.type === 'ox' ? '' : `<b>${i + 1}</b>`}<span>${esc(o)}</span></button>`).join('')}</div>`;
    }
    $('#scQuiz').innerHTML = `
      <div class="quiz">
        <section class="panel">
          <div class="quiz-head">
            <span class="stage-chip ${collect ? '' : 'coin-chip'}">${collect ? '🦋 곤충 채집' : '🪙 코인 퀴즈'}</span>
            <span>문제 ${P.qIndex + 1} / ${P.qTotal}</span>
            <div class="qdots" aria-hidden="true">${dots}</div>
          </div>
          ${settings.timeLimit > 0 ? '<div class="timer"><i id="qTimer" style="width:100%"></i></div>' : ''}
          <p class="q-subject">${esc(Q.label(q.subject))}</p>
          <h2 class="q-text">${esc(q.q)}</h2>
          ${body}
          <div id="feedback"></div>
        </section>
        <aside class="panel">
          <h2>${collect ? '채집한 곤충' : '내 곤충'}</h2>
          <p class="hint">${collect ? '정답을 맞히면 곤충을 잡을 수 있어요! 같은 곤충을 또 잡으면 능력치가 1 올라가요.' : `정답 하나에 코인 ${settings.coinPerCorrect}개! 코인으로 연구소에서 곤충을 키워요.`}</p>
          <div class="mini-bugs">${P.bugs.map(b => `<img src="${pic(b.type, 64, undefined, b.tier)}" alt="${esc(D.INSECTS[b.type].name)}" title="${esc(D.INSECTS[b.type].name)}">`).join('')}${collect ? Array.from({ length: Math.max(0, P.qTotal - P.qIndex) }, () => '<span class="empty">?</span>').join('') : ''}</div>
          ${collect ? '' : `<p class="reward"><i class="coin"></i> ${P.coins.toLocaleString()}</p>`}
        </aside>
      </div>`;
    document.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => answer(Number(b.dataset.i))));
    const f = $('#shortForm');
    if (f) { f.addEventListener('submit', e => { e.preventDefault(); answer($('#shortIn').value); }); $('#shortIn').focus(); }
  }
  function answer(value) {
    if (answered) return;
    answered = true;
    clearInterval(qTimer);
    const q = curQ;
    const ok = value !== null && GameKit.checkAnswer(q, value);
    P.total++; P.marks[P.qIndex] = ok;
    if (ok) { P.correct++; P.score += 100; } else P.wrong.push({ q: q.q, a: GameKit.correctText(q), subject: Q.label(q.subject) });
    document.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      const i = Number(b.dataset.i);
      if (i === q.answer) b.classList.add('right'); else if (i === value) b.classList.add('wrong');
    });
    const inp = $('#shortIn'); if (inp) { inp.disabled = true; $('#shortForm button').disabled = true; }
    let html;
    const last = P.qIndex + 1 >= P.qTotal;
    const nextLabel = last ? (P.stage === 'collect' ? '코인 퀴즈로 ▶' : '곤충 연구소로 ▶') : '다음 문제 ▶';
    const expl = q.explanation ? `<p class="fact">💡 ${esc(q.explanation)}</p>` : '';
    if (ok && P.stage === 'collect') {
      const type = D.rollInsect(), ins = D.INSECTS[type], had = bug(type);
      let extra;
      if (had) {
        const open = D.STAT_KEYS.filter(s => had.lv[s] < D.capOf(had.tier)), k = open[Math.floor(Math.random() * open.length)];
        if (k) { had.lv[k]++; extra = `이미 있는 친구라 <b>${D.STATS.find(s => s.k === k).name} +1</b> 올랐어요!`; } else { P.coins += 30; extra = '이 등급의 능력치가 모두 최고라 코인 30개를 받았어요!'; }
      } else { P.bugs.push({ type, lv: D.zeroLv(), tier: D.nativeTier(type) }); P.score += D.RARITY[ins.rarity].score; extra = '새로운 곤충 친구를 만났어요!'; }
      if (!P.sel) P.sel = type;
      SND(ins.rarity === 'legend' || ins.rarity === 'hero' ? 'legend' : 'catch');
      html = `<div class="feedback good reveal">
        <h3>정답! ${esc(ins.name)}${had ? '' : ' 채집!'}</h3>
        <div class="stage ${ins.rarity}"><img src="${pic(type, 170, 'happy')}" alt="">${ins.rarity === 'common' ? '' : [[12, 20], [78, 14], [86, 70], [8, 74], [50, 4]].map(([l, t], i) => `<span class="sparkle" style="left:${l}%;top:${t}%;animation-delay:${i * 0.28}s">${ins.rarity === 'legend' ? '✨' : ins.rarity === 'hero' ? '💜' : '✦'}</span>`).join('')}</div>
        <p><span class="rar ${ins.rarity}">${D.RARITY[ins.rarity].name}</span> ${extra}</p>
        <p class="fact">${esc(ins.fact)}</p>${expl}
        <button type="button" class="btn primary big" id="nextQ">${nextLabel}</button></div>`;
    } else if (ok) {
      P.coins += settings.coinPerCorrect;
      SND('correct'); setTimeout(() => SND('coin'), 250);
      html = `<div class="feedback good"><h3>정답!</h3><p class="coin-burst"><i class="coin"></i> +${settings.coinPerCorrect}</p>${expl}
        <button type="button" class="btn primary big" id="nextQ">${nextLabel}</button></div>`;
    } else {
      SND(P.stage === 'collect' ? 'escape' : 'wrong');
      html = `<div class="feedback bad"><h3>${value === null ? '시간이 다 됐어요' : '아쉬워요!'} ${P.stage === 'collect' ? '곤충이 도망갔어요 💨' : ''}</h3>
        <p>정답: <b>${esc(GameKit.correctText(q))}</b></p>${expl}
        <button type="button" class="btn big" id="nextQ">${nextLabel}</button></div>`;
    }
    $('#feedback').innerHTML = html;
    $('#nextQ').addEventListener('click', advance);
    $('#nextQ').focus({ preventScroll: true });
    $('#feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    updateHud();
  }
  function advance() {
    P.qIndex++;
    if (P.qIndex < P.qTotal) return nextQuestion();
    if (P.stage === 'collect') {
      if (!P.bugs.length) { P.bugs.push({ type: 'ant', lv: D.zeroLv(), tier: 0 }); P.sel = 'ant'; toast('곤충을 못 잡았지만, 개미가 친구가 되어 줬어요!', 'warn'); }
      startQuizStage('coin');
      toast(`이제 코인 퀴즈! 정답마다 코인 ${settings.coinPerCorrect}개`, 'good');
    } else goLab();
  }

  // ============================================================
  //  곤충 연구소 (업그레이드 · 대결 나가기)
  // ============================================================
  function goLab() {
    P.stage = 'lab';
    showScreen('lab');
    renderLab();
    updateHud();
    Net.status('lab');
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
    // 등급업
    const pi = D.promoInfo(b.type, b.lv, b.tier);
    const promo = pi.max ? `<div class="promo max"><b>👑 최고 등급(전설)이에요!</b><span>능력치마다 ${cap}단계까지 키울 수 있어요.</span></div>`
      : `<div class="promo ${pi.next}">
          <div class="promo-head"><b>⭐ 등급업: ${tierName(b)} → <span class="rar ${pi.next}">${D.RARITY[pi.next].name}</span></b><span>모든 능력치 +2 · 업그레이드 한계 ${cap} → ${D.TIER_CAP[b.tier + 1]}</span></div>
          <div class="promo-bar"><i style="width:${Math.min(100, pi.have / pi.need * 100)}%"></i><span>업그레이드 합계 ${pi.have} / ${pi.need}</span></div>
          <button type="button" class="btn ${pi.ok ? 'primary' : ''}" id="promote" ${pi.ok && P.coins >= pi.cost ? '' : 'disabled'}>${pi.ok ? `등급업 하기 · <i class="coin"></i>${pi.cost}` : `업그레이드 ${pi.need - pi.have}번 더 하면 등급업`}</button>
        </div>`;
    const enabled = EV.EVENT_IDS.filter(id => settings.events[id] !== false);
    const evList = EV.EVENT_IDS.map(id => { const e = EV.EVENTS[id]; return `<li class="${enabled.includes(id) ? '' : 'off'}">${e.icon} ${esc(e.name)}<small>${e.stats.map(k => D.STATS.find(s => s.k === k).name).join('·')}</small></li>`; }).join('');
    $('#scLab').innerHTML = `
      <div class="lab">
        <section class="panel lab-list">
          <h2>내 곤충 ${P.bugs.length}마리</h2>
          <div class="bug-cards">${P.bugs.map(x => {
            const i = D.INSECTS[x.type], tk = tierKey(x), can = D.promoInfo(x.type, x.lv, x.tier).ok;
            return `<button type="button" class="bug-card r-${tk} ${x.type === P.sel ? 'on' : ''}" data-sel="${x.type}"><span class="rar ${tk}">${D.RARITY[tk].name}</span>${can ? '<span class="promo-dot" title="등급업 가능">⬆</span>' : ''}<img src="${pic(x.type, 80, x.type === P.sel ? 'happy' : undefined, x.tier)}" alt=""><span>${esc(i.name)}</span><small>능력 ${D.powerOf(x.type, x.lv, x.tier)} · 업 ${D.totalLv(x.lv)}</small></button>`;
          }).join('')}</div>
        </section>
        <section class="panel lab-detail">
          <div class="detail-top ${tierKey(b)}">
            <img src="${pic(b.type, 150, 'happy', b.tier)}" alt="">
            <div><h2>${esc(ins.name)} <span class="rar ${tierKey(b)}">${tierName(b)}</span></h2><p class="fact">${esc(ins.fact)}</p><p class="hint">능력치 합 <b>${D.powerOf(b.type, b.lv, b.tier)}</b> · 등급 보너스 +${tb} · 업그레이드 한계 ${cap}단계</p></div>
          </div>
          <div class="stat-rows">${rows}</div>
          ${promo}
          <p class="hint">업그레이드 값: 12 → 18 → 24 … (단계마다 +6). 막대의 진한 칸은 기본, 등급 색 칸은 등급 보너스, 빗금 칸은 업그레이드, 세로선은 이 등급의 한계예요.</p>
          <div class="go-box">
            <button type="button" class="btn primary big" id="goBattle">⚔️ ${esc(ins.name)}(으)로 대결 나가기 (${P.battleNo + 1}/${settings.battleCount})</button>
            <p class="hint">${P.online && Net.connected ? `교실 <b>${esc(Net.room)}</b> 친구들과 3마리가 겨뤄요. ${settings.matchWait}초 안에 모이지 않으면 AI 곤충이 빈자리를 채워요.` : 'AI 곤충 2마리와 겨뤄요.'} 종목은 무작위!</p>
          </div>
        </section>
        <aside class="panel lab-side">
          ${P.online ? `<h2>교실 ${esc(Net.room || '')}</h2><ul class="members" id="members">${membersHTML()}</ul>` : ''}
          <h2>등급표</h2>
          <table class="tier-table"><thead><tr><th>등급</th><th>보너스</th><th>한계</th><th>등급업</th></tr></thead><tbody>${D.TIERS.map((t, i) => `<tr class="${i === b.tier ? 'on' : ''}"><td><span class="rar ${t}">${D.RARITY[t].name}</span></td><td>+${D.TIER_BONUS[i]}</td><td>${D.TIER_CAP[i]}</td><td>${i < 3 ? `업 ${D.PROMO_REQ[i]} · <i class="coin"></i>${D.PROMO_COST[i]}` : '-'}</td></tr>`).join('')}</tbody></table>
          <h2>대결 종목 (무작위)</h2>
          <ul class="ev-list">${evList}</ul>
        </aside>
      </div>`;
    document.querySelectorAll('[data-sel]').forEach(el => el.addEventListener('click', () => { P.sel = el.dataset.sel; SND('select'); renderLab(); Net.status('lab'); }));
    document.querySelectorAll('[data-up]').forEach(el => el.addEventListener('click', () => upgrade(el.dataset.up)));
    const pb = $('#promote'); if (pb) pb.addEventListener('click', promote);
    $('#goBattle').addEventListener('click', requestBattle);
  }
  function upgrade(k) {
    const b = bug(P.sel), cost = D.upgradeCost(b.lv[k]);
    if (b.lv[k] >= D.capOf(b.tier) || P.coins < cost) { SND('deny'); return; }
    P.coins -= cost; b.lv[k]++; P.score += 10;
    SND('upgrade');
    const pi = D.promoInfo(b.type, b.lv, b.tier);
    if (pi.ok && pi.have === pi.need) toast(`등급업 조건을 채웠어요! ${D.RARITY[pi.next].name} 등급으로 올릴 수 있어요.`, 'good');
    else toast(`${D.INSECTS[b.type].name}의 ${D.STATS.find(s => s.k === k).name}이(가) 올랐어요!`, 'good');
    renderLab(); updateHud();
  }
  // 등급업: 업그레이드는 그대로, 모든 능력치 +2, 업그레이드 한계가 늘어나요
  function promote() {
    const b = bug(P.sel), pi = D.promoInfo(b.type, b.lv, b.tier);
    if (!pi.ok || P.coins < pi.cost) { SND('deny'); return; }
    const before = D.powerOf(b.type, b.lv, b.tier);
    P.coins -= pi.cost; b.tier++; P.score += Math.round(D.RARITY[tierKey(b)].score / 2);
    const after = D.powerOf(b.type, b.lv, b.tier), tk = tierKey(b);
    SND('legend');
    updateHud(); renderLab(); Net.status('lab');
    showModal(`
      <div class="feedback good reveal">
        <h3>등급업! <span class="rar ${tk}">${D.RARITY[tk].name}</span> ${esc(D.INSECTS[b.type].name)}</h3>
        <div class="stage ${tk}"><img src="${pic(b.type, 170, 'happy', b.tier)}" alt="">${[[12, 20], [78, 14], [86, 70], [8, 74], [50, 4]].map(([l, t], i) => `<span class="sparkle" style="left:${l}%;top:${t}%;animation-delay:${i * 0.28}s">${tk === 'legend' ? '✨' : tk === 'hero' ? '💜' : '✦'}</span>`).join('')}</div>
        <p>능력치 합 <b>${before} → ${after}</b> · 업그레이드 한계 ${D.TIER_CAP[b.tier - 1]} → <b>${D.TIER_CAP[b.tier]}</b></p>
        <div class="row"><button type="button" class="btn primary big" id="promoOk">좋아요!</button></div>
      </div>`, 'promo');
    $('#promoOk').addEventListener('click', hideModal);
  }
  const STATUS_TEXT = { quiz: '퀴즈 푸는 중', lab: '연구소', queue: '대결 기다림', battle: '대결 중', done: '끝' };
  function membersHTML() {
    if (!Net.info) return '<li>접속 중…</li>';
    return Net.info.members.map(m => `<li>${m.insect ? `<img src="${pic(m.insect, 26, undefined, m.tier)}" alt="">` : '🙂'}<span>${esc(m.nick)}</span><em>${STATUS_TEXT[m.status] || ''}</em></li>`).join('');
  }

  // ============================================================
  //  실시간 대결 연결 (Socket.IO)
  // ============================================================
  const Net = {
    socket: null, connected: false, room: '', info: null, queued: false, deadlineAt: 0,
    status(status) { if (this.socket && this.connected && P) { const b = P.sel && P.bugs.find(x => x.type === P.sel); this.socket.emit('status', { status, insect: P.sel, tier: b ? b.tier : undefined }); } },
  };
  function serverUrl() { const p = new URLSearchParams(location.search); return p.get('server') || ''; }
  function connectNet(room) {
    if (typeof window.io !== 'function') return false;
    Net.room = room;
    if (Net.socket) { Net.socket.emit('join', { room, nickname: GameKit.state.nickname }); return true; }
    const s = window.io(serverUrl() || undefined, { transports: ['websocket', 'polling'] });
    Net.socket = s;
    s.on('connect', () => {
      Net.connected = true; s.emit('join', { room: Net.room, nickname: GameKit.state.nickname }); updateHud();
      // 끊긴 사이 서버 대결은 AI가 이어서 끝냈어요 → 이번 대결은 없던 일로 하고 연구소로
      if (BT && BT.mode === 'net' && !BT.ended) { BT = null; goLab(); toast('연결이 끊겨 이번 대결은 취소됐어요. 다시 나가 보세요!', 'warn'); }
    });
    s.on('joined', m => { Net.room = m.code; if (P) Net.status(P.stage === 'lab' ? 'lab' : 'quiz'); updateHud(); });
    s.on('disconnect', () => {
      Net.connected = false; updateHud();
      if (Net.queued) { Net.queued = false; hideModal(); toast('서버 연결이 끊겨 AI 곤충과 대결해요.', 'warn'); startLocalBattle(); }
      else if (BT && BT.mode === 'net' && !BT.ended) toast('서버 연결이 끊겼어요. 다시 연결하는 중…', 'bad');
    });
    s.on('room', info => {
      Net.info = info;
      if (info.deadline) Net.deadlineAt = performance.now() + info.deadline * 1000;
      const ul = $('#members'); if (ul) ul.innerHTML = membersHTML();
      if (Net.queued && modalKind === 'match') renderMatch();
      updateHud();
    });
    s.on('battle:start', meta => { Net.queued = false; if (modalKind === 'match') hideModal(); beginBattle('net', meta); });
    s.on('battle:state', snap => onSnap(snap));
    return true;
  }
  function askRoom(then) {
    const p = new URLSearchParams(location.search);
    let last = p.get('room') || '';
    try { last = last || localStorage.getItem('bugex-room') || ''; } catch (e) { /* 무시 */ }
    showModal(`
      <h2>교실 코드 입력</h2>
      <p class="hint">선생님이 알려 준 교실 코드를 넣어요. 같은 코드를 넣은 친구들끼리 실시간으로 대결해요.</p>
      <form id="roomForm">
        <input type="text" class="room-input" id="roomIn" maxlength="12" value="${esc(last)}" placeholder="예: 1234" autocomplete="off" autofocus>
        <div class="row"><button type="submit" class="btn primary big">입장하기</button><button type="button" class="btn" id="roomSolo">혼자 연습할래요</button></div>
      </form>`, 'room');
    $('#roomForm').addEventListener('submit', e => {
      e.preventDefault();
      const code = $('#roomIn').value.replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 12) || '교실';
      try { localStorage.setItem('bugex-room', code); } catch (err) { /* 무시 */ }
      hideModal();
      if (!connectNet(code)) { P.online = false; toast('실시간 서버에 연결할 수 없어 혼자 연습으로 진행해요.', 'warn'); }
      then();
    });
    $('#roomSolo').addEventListener('click', () => { P.online = false; hideModal(); then(); });
  }

  // ---------- 대결 신청 ----------
  function requestBattle() {
    A.init();
    if (P.online && Net.connected) {
      const b = bug(P.sel);
      Net.socket.emit('queue', { type: b.type, lv: b.lv, tier: b.tier, nickname: GameKit.state.nickname });
      Net.queued = true; Net.deadlineAt = performance.now() + settings.matchWait * 1000;
      renderMatch();
    } else {
      if (P.online && !Net.connected) toast('서버에 연결되지 않아 AI 곤충과 대결해요.', 'warn');
      startLocalBattle();
    }
  }
  let matchTimer = 0;
  function renderMatch() {
    const q = (Net.info && Net.info.queue) || [];
    const left = Math.max(0, Math.ceil((Net.deadlineAt - performance.now()) / 1000));
    const slots = [0, 1, 2].map(i => q[i] ? `<li><img src="${pic(q[i].type, 40, undefined, q[i].tier)}" alt=""><b>${esc(q[i].nick)}</b> · ${esc(D.INSECTS[q[i].type].name)}</li>` : '<li class="wait pulse">빈자리… 친구를 기다려요</li>').join('');
    showModal(`
      <h2>⚔️ 대결 상대를 찾는 중</h2>
      <p class="hint">교실 <b>${esc(Net.room)}</b> · 3마리가 모이면 바로 시작해요. ${left ? `<b>${left}초</b> 뒤에는 AI 곤충이 빈자리를 채워요.` : '곧 시작해요!'}</p>
      <ul class="match-list">${slots}</ul>
      <div class="row"><button type="button" class="btn" id="cancelMatch">취소</button></div>`, 'match');
    $('#cancelMatch').addEventListener('click', () => { Net.queued = false; Net.socket.emit('unqueue'); hideModal(); clearInterval(matchTimer); });
    clearInterval(matchTimer);
    matchTimer = setInterval(() => { if (modalKind === 'match' && Net.queued) renderMatch(); else clearInterval(matchTimer); }, 1000);
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
    const mine = results.find(r => r.i === BT.me) || { rank: 3, label: '' };
    const k = Math.min(2, mine.rank - 1);
    P.coins += BATTLE_COINS[k]; P.score += BATTLE_SCORE[k]; P.places[k]++;
    P.history.push({ ev: BT.meta.ev, rank: mine.rank, type: BT.meta.ents[BT.me].type });
    P.battleNo++;
    SND(mine.rank === 1 ? 'win' : mine.rank === 2 ? 'finish' : 'lose');
    updateHud();
    const ev = EV.EVENTS[BT.meta.ev], medals = ['🥇', '🥈', '🥉'];
    const list = results.map(r => {
      const en = BT.meta.ents[r.i];
      return `<li class="${r.i === BT.me ? 'me' : ''}"><span class="medal">${medals[r.rank - 1]}</span><img src="${pic(en.type, 56, r.rank === 1 ? 'happy' : undefined, D.tierOf(en.type, en.tier))}" alt="">
        <span class="who">${r.i === BT.me ? '★ ' : ''}${esc(en.name)}<small><span class="rar ${D.TIERS[D.tierOf(en.type, en.tier)]}">${D.RARITY[D.TIERS[D.tierOf(en.type, en.tier)]].name}</span> ${esc(D.INSECTS[en.type].name)}${en.bot ? ' · AI' : ''}</small></span><span class="rec">${esc(r.label)}</span></li>`;
    }).join('');
    const last = P.battleNo >= settings.battleCount;
    setTimeout(() => {
      showModal(`
        <h2>${ev.icon} ${esc(ev.name)} 결과</h2>
        <ol class="podium">${list}</ol>
        <p class="reward">${mine.rank}등! <i class="coin"></i> +${BATTLE_COINS[k]} · 점수 +${BATTLE_SCORE[k]}</p>
        <div class="row"><button type="button" class="btn primary big" id="afterBattle">${last ? '🏆 최종 결과 보기' : '연구소로 돌아가기 ▶'}</button></div>`, 'result');
      $('#afterBattle').addEventListener('click', () => { hideModal(); BT = null; if (last) showFinal(); else goLab(); });
    }, 900);
  }

  // ============================================================
  //  최종 결과 · 명예의 전당
  // ============================================================
  function showFinal() {
    P.stage = 'final';
    Net.status('done');
    showScreen('final');
    updateHud();
    const legends = P.bugs.filter(b => b.tier === 3).length;
    const heroes = P.bugs.filter(b => b.tier === 2).length;
    GameKit.submitResult({ score: P.score, wave: P.places[0], correct: P.correct, total: P.total, cleared: true });
    $('#scFinal').innerHTML = `
      <section class="panel final">
        <h2>오늘의 곤충 리그 결과</h2>
        <p class="hint">${esc(GameKit.state.nickname)} 선수의 점수</p>
        <p class="big-num">${P.score.toLocaleString()}</p>
        <dl class="final-stats">
          <div><dt>퀴즈 정답</dt><dd>${P.correct} / ${P.total}</dd></div>
          <div><dt>모은 곤충</dt><dd>${P.bugs.length}마리${legends || heroes ? ` (${[legends ? `전설 ${legends}` : '', heroes ? `영웅 ${heroes}` : ''].filter(Boolean).join(' · ')})` : ''}</dd></div>
          <div><dt>대결 성적</dt><dd>🥇${P.places[0]} 🥈${P.places[1]} 🥉${P.places[2]}</dd></div>
          <div><dt>남은 코인</dt><dd><i class="coin"></i>${P.coins}</dd></div>
        </dl>
        <div class="mini-bugs">${P.bugs.map(b => `<img src="${pic(b.type, 64, 'happy', b.tier)}" alt="${esc(D.INSECTS[b.type].name)}" title="${esc(D.INSECTS[b.type].name)}">`).join('')}</div>
        <p class="hint" data-gk-submit-status>${esc(GameKit.submitStatusText())}</p>
        ${GameKit.rankingButtonsHTML()}
        ${P.wrong.length ? `<details class="review"><summary>틀린 문제 다시 보기 (${P.wrong.length})</summary><ol>${P.wrong.map(w => `<li>[${esc(w.subject)}] ${esc(w.q)}<br><span class="ans">정답: ${esc(w.a)}</span></li>`).join('')}</ol></details>` : '<p>틀린 문제가 하나도 없어요! 👏</p>'}
        <div class="row"><button type="button" class="btn primary big" id="again">🔄 처음부터 다시 하기</button></div>
      </section>`;
    $('#again').addEventListener('click', () => { P = null; showStart(); });
  }

  // ============================================================
  //  시작 화면 (GameKit: 별명 · 방식 · 난이도 · 랭킹)
  // ============================================================
  function showStart() {
    showScreen(null);
    GameKit.showStartScreen({
      logo: `<div class="logo-trio">${['bee', 'rhino', 'ladybug'].map(t => `<img src="${pic(t, 96, 'happy')}" alt="">`).join('')}</div>`,
      onStart: startFromKit,
      links: [
        { label: '게임 방법', onClick: () => { GameKit.hideStartScreen(); showHelp(true); } },
        { label: '설정', onClick: () => { GameKit.hideStartScreen(); showSettings(true); } },
      ],
    });
  }
  function startFromKit(kit) {
    A.init();
    settings.difficulty = kit.difficulty; saveSettings();
    newPlayer(kit);
    Q.reset();
    const go = () => { startQuizStage('collect'); toast(`퀴즈 ${P.qTotal}문제를 맞혀 곤충을 채집해요!`, 'good'); };
    if (P.online) askRoom(go); else go();
  }

  // ---------- 게임 방법 ----------
  function showHelp(fromStart) {
    showModal(`
      <div class="help">
        <h2>게임 방법</h2>
        <ol>
          <li><b>곤충 채집</b> — 퀴즈 ${collectCount()}문제. 맞히면 곤충을 잡아요 (일반 55% · 희귀 28% · 영웅 12% · 전설 5%). 같은 곤충을 또 잡으면 능력치 +1.</li>
          <li><b>코인 퀴즈</b> — 퀴즈 ${settings.coinCount}문제. 정답마다 코인 ${settings.coinPerCorrect}개.</li>
          <li><b>곤충 연구소</b> — 코인으로 속도·힘·균형·점프·체력을 올려요. 업그레이드 합계가 기준을 넘으면 코인을 내고 <b>등급업</b>(일반 → 희귀 → 영웅 → 전설)! 등급마다 모든 능력치 +2, 업그레이드 한계도 늘어나요.</li>
          <li><b>곤충 대결</b> — 곤충 3마리가 무작위 종목으로 겨뤄요 (${settings.battleCount}번). 1등 코인 60 · 2등 40 · 3등 25.</li>
        </ol>
        <h3>대결 종목 10가지</h3>
        <ul>${EV.EVENT_IDS.map(id => { const e = EV.EVENTS[id]; return `<li>${e.icon} <b>${esc(e.name)}</b> — ${esc(e.desc)}</li>`; }).join('')}</ul>
        <h3>친구와 대결</h3>
        <p class="hint">시작 화면에서 <b>친구와 대결</b>을 고르고 같은 교실 코드를 넣으면 실시간으로 함께 겨뤄요. 3명이 안 모이면 ${settings.matchWait}초 뒤 AI 곤충이 빈자리를 채워요.</p>
        <h3>점수</h3>
        <p class="hint">정답 100점 · 새 곤충 일반 50 / 희귀 100 / 영웅 150 / 전설 250 · 업그레이드 10 · 등급업 50~125 · 대결 1등 300 / 2등 150 / 3등 50</p>
        <div class="row"><button type="button" class="btn primary" id="helpClose">알겠어요!</button></div>
      </div>`, 'help');
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
        <section class="set-page" data-page="admin" hidden>
          <p class="hint">게임 관리자·교사용 설정이에요. <b>저장</b>은 이 브라우저에만 적용돼요. 모든 학생에게 적용하려면 맨 아래 <b>전역 설정</b>을 쓰세요. 실시간 대결의 <b>종목·기다리는 시간·AI 세기</b>는 서버가 전역 설정(config.json)을 따라요.</p>
          <p class="ti-status ${globalConfig ? 'ok' : ''}">${globalConfig ? '전역 설정(config.json)을 불러왔어요. 모든 학생에게 같은 값이 적용돼요.' : '전역 설정(config.json)을 읽지 못해 기본값을 쓰고 있어요. 서버(Render) 주소로 열었을 때 읽혀요.'}</p>
          ${local.admin ? '<p class="ti-status bad">이 브라우저에는 관리자 설정이 따로 저장돼 있어서 전역 설정보다 먼저 적용돼요. <button type="button" class="btn" id="admReset">지우고 전역 설정 따르기</button></p>' : ''}
          <fieldset><legend>게임 환경</legend><div class="grid2">
            <label>게임 난이도 (AI 곤충 세기)<select id="admDiff" data-sync="diff">${opt(['easy', 'normal', 'hard'], settings.difficulty, v => DIFF_LABEL[v])}</select></label>
            <label>곤충 채집 문제 수<input type="number" id="admCollect" min="1" max="50" value="${goalNow}"></label>
            <label>코인 퀴즈 문제 수<input type="number" id="admCoinCount" min="1" max="50" value="${settings.coinCount}"></label>
            <label>정답 하나당 코인<input type="number" id="admCoinPer" min="1" max="200" value="${settings.coinPerCorrect}"></label>
            <label>대결 횟수<input type="number" id="admBattles" min="1" max="10" value="${settings.battleCount}"></label>
            <label>실시간 대결 기다리는 시간<select id="admWait">${opt([5, 10, 15, 20, 30, 45, 60], settings.matchWait, v => `${v}초 뒤 AI로 채우기`)}</select></label>
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
      </form>`, 'settings');

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
        collectCount: int('#admCollect', 1, 50, 7), coinCount: int('#admCoinCount', 1, 50, 10), coinPerCorrect: int('#admCoinPer', 1, 200, 20),
        battleCount: int('#admBattles', 1, 10, 3), matchWait: Number($('#admWait').value),
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
  $('#settingsBtn').addEventListener('click', () => { if (modalKind === 'match' || modalKind === 'room') return; A.init(); showSettings(false); });
  $('#helpBtn').addEventListener('click', () => { if (modalKind === 'match' || modalKind === 'room') return; showHelp(false); });
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
      modeLabels: { free: '혼자 연습', game: '친구와 대결' },
      modeDescriptions: { free: 'AI 곤충 2마리와 대결 · 채집 {n}문제', game: '같은 교실 코드 친구들과 실시간 대결 · 채집 {n}문제' },
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
  window.__bugex = { get P() { return P; }, get BT() { return BT; }, get settings() { return settings; }, Net, startLocalBattle, goLab, showFinal, answer, get curQ() { return curQ; } };
  loadGlobalConfig().then(() => {
    startKit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
  });
})();
