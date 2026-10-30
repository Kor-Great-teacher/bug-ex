// GameKit — 학습 게임 공통 기능 (빌드 없이 쓰는 순수 자바스크립트 버전)
// 시작 화면 · 별명 자동 생성 · 구글 시트/URL 파라미터 · 명예의 전당(기록 + 랭킹 팝업) · 퀴즈 유형 채점
// 다른 게임에 쓸 때: js/gamekit.js + css/gamekit.css 를 복사하고 GameKit.init({...}) 의 설정만 바꾸면 됩니다.
window.GameKit = (() => {
  'use strict';

  // ============================================================
  //  기본 설정 (게임마다 GameKit.init({ ... }) 로 덮어쓰기)
  // ============================================================
  const config = {
    gameName: '',            // 랭킹에서 게임을 구분하는 이름 (비우면 시트 SETTING gameName 사용)
    gameTitle: '',
    defaultSheetId: '',      // 파라미터가 없을 때 불러올 문항 시트 (비우면 게임 내장 문제 사용)
    defaultGid: '0',
    rankingUrl: 'https://script.google.com/macros/s/AKfycbx7uRebGgWAJ031vNiCPpwXphEgDpq-Hfnhz0eEECPKOMQ8tXCAtwmimq1MsFZDzdBV/exec',
    rankingSheetId: '1wVtyn6RaE_5kMsIyFxvl57s5BruCCtgKuaFFNpZYzbc',
    rankingSheetName: '명예의전당',
    defaultQuizGoal: 20,     // 게임 모드 목표 문항 수 (?gamemode=30 또는 시트 gameModeGoal 이 우선, 플레이어는 변경 불가)
    defaultMode: 'game',     // 'game' | 'free'
    defaultDifficulty: 'normal',
    difficultyLabels: { easy: '쉬움', normal: '보통', hard: '어려움' },
    difficultyDescriptions: { easy: '느린 속도 · 넉넉한 체력', normal: '표준 속도 · 권장 난이도', hard: '빠른 속도 · 낮은 체력' },
    modeDescriptions: { free: '끝까지 버티며 최고 점수 도전', game: '퀴즈 {n}문제를 맞히면 임무 완료' },
    modeLabels: { free: '자유 모드', game: '게임 모드 {n}문제' },
    waveLabel: '{n}R',       // 랭킹에 함께 보여 줄 기록 (웨이브 · 승리 수 등)
    submitScores: true,      // false 면 기록 전송 안 함 (테스트용)
  };

  const state = {
    ready: false,
    fromSheet: false,
    settings: { raw: {} },   // 시트 SETTING 값 (gameName, subtitle, gameModeGoal …, raw: 전체)
    questions: [],           // 시트 문항 [{ id, type, text, options, answer, answers, explanation }]
    unit: { subject: '', grade: '', semester: '', unit: '' },
    nickname: '',
    difficulty: 'normal',
    mode: 'game',
    quizGoal: 20,
    submitStatus: 'idle',    // idle | sending | sent | failed
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ============================================================
  //  URL 파라미터
  //   ?sheet=<ID>&gid=<gid>  (전체 URL, <ID>:<gid>, ?id= / ?sheetId= 도 가능)
  //   ?gamemode=30 (게임 모드 + 목표 30문제, ?gamemode=free 는 자유 모드)  ?goal=30
  //   ?difficulty=easy|normal|hard   ?rank=<기록용 웹앱 URL>
  // ============================================================
  function urlParams() {
    const params = new URLSearchParams(location.search);
    const qi = location.hash.indexOf('?');
    if (qi !== -1) new URLSearchParams(location.hash.slice(qi + 1)).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
    return params;
  }
  function param(params, ...names) {
    for (const n of names) for (const [k, v] of params) if (k.toLowerCase() === n.toLowerCase() && v.trim()) return v.trim();
    return '';
  }
  function sheetSource() {
    const p = urlParams();
    const sheet = param(p, 'sheet', 'sheetId', 'id'), gidParam = param(p, 'gid');
    let sheetId = config.defaultSheetId, gid = config.defaultGid;
    if (sheet) {
      const urlId = sheet.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const combined = sheet.match(/^([a-zA-Z0-9-_]{20,})[:_](\d+)$/);
      if (urlId) { sheetId = urlId[1]; const g = sheet.match(/[?#&]gid=(\d+)/); gid = g ? g[1] : '0'; }
      else if (combined) { sheetId = combined[1]; gid = combined[2]; }
      else if (/^[a-zA-Z0-9-_]{20,}$/.test(sheet)) { sheetId = sheet; gid = '0'; }
    }
    if (/^\d+$/.test(gidParam)) gid = gidParam;
    return { sheetId, gid };
  }
  function urlOptions() {
    const p = urlParams(), o = {};
    const gm = param(p, 'gamemode', 'mode').toLowerCase(), n = parseInt(gm, 10);
    if (n > 0) { o.mode = 'game'; o.quizGoal = n; }
    else if (gm === 'free') o.mode = 'free';
    else if (gm === 'game' || gm === 'true') o.mode = 'game';
    const goal = parseInt(param(p, 'goal'), 10);
    if (goal > 0) o.quizGoal = goal;
    const d = param(p, 'difficulty', 'level').toLowerCase();
    if (['easy', 'normal', 'hard'].includes(d)) o.difficulty = d;
    const rank = param(p, 'rank', 'rankUrl');
    if (rank) o.rankingUrl = rank;
    return o;
  }

  // ============================================================
  //  구글 시트 (A: Type | B: Key/ID | C: Value/Text | D~G: 보기 | H: 정답 | I: 해설)
  // ============================================================
  function parseCSV(csv) {
    const rows = []; let row = [], col = '', q = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i], nx = csv[i + 1];
      if (ch === '"' && q && nx === '"') { col += '"'; i++; }
      else if (ch === '"') q = !q;
      else if (ch === ',' && !q) { row.push(col.trim()); col = ''; }
      else if ((ch === '\r' || ch === '\n') && !q) {
        if (col !== '' || row.length) { row.push(col.trim()); rows.push(row); }
        row = []; col = ''; if (ch === '\r' && nx === '\n') i++;
      } else col += ch;
    }
    if (col !== '' || row.length) { row.push(col.trim()); rows.push(row); }
    return rows;
  }
  const normKey = k => k.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const SETTING_KEYS = {
    gamename: 'gameName', 게임이름: 'gameName', gametitle: 'gameTitle', 게임제목: 'gameTitle',
    gamedescription: 'gameDescription', 게임설명: 'gameDescription', subtitle: 'subtitle', 부제목: 'subtitle',
    quizinterval: 'quizInterval', interval: 'quizInterval', 퀴즈간격: 'quizInterval',
    gamemodegoal: 'gameModeGoal', gamemodequizcount: 'gameModeGoal', gamemodecount: 'gameModeGoal', gamemode: 'gameModeGoal',
    목표문항수: 'gameModeGoal', 게임모드문항수: 'gameModeGoal', 게임모드목표: 'gameModeGoal',
    rankingurl: 'rankingUrl', rankurl: 'rankingUrl', 랭킹주소: 'rankingUrl',
    rankingsheetid: 'rankingSheetId', rankingsheetname: 'rankingSheetName',
  };
  const NUM_KEYS = ['quizInterval', 'gameModeGoal'];
  const TYPES = {
    multiple: ['multiple', 'question', 'quiz', 'choice', '객관식', '선다형'],
    ox: ['ox', 'o/x', 'o x', 'ox퀴즈'],
    short: ['short', 'shortanswer', 'subjective', '단답형', '주관식'],
  };
  const unescape = s => s.replace(/\\n/g, '\n');
  function oxIndex(raw) {
    const v = raw.trim().toLowerCase();
    if (['o', '○', 'ㅇ', '1', 'true', 't', '참', '맞음', 'yes', 'y'].includes(v)) return 0;
    if (['x', '×', '✕', 'ㅌ', '2', 'false', 'f', '거짓', '틀림', 'no', 'n'].includes(v)) return 1;
    return -1;
  }
  function parseQuestion(row, rawType, index) {
    const text = unescape((row[2] || '').trim()); if (!text) return null;
    const opts = [row[3], row[4], row[5], row[6]].map(o => unescape((o || '').trim()));
    const filled = opts.filter(Boolean);
    const rawAns = (row[7] || '').trim(), explanation = unescape((row[8] || '').trim());
    const id = parseInt(row[1], 10) || index;
    let type = Object.keys(TYPES).find(t => TYPES[t].includes(rawType));
    if (!type && !isNaN(parseInt(row[1], 10))) type = filled.length === 0 ? 'short' : filled.length === 2 ? 'ox' : 'multiple';
    if (!type) return null;
    if (type === 'short') {
      const answers = (rawAns || filled[0] || '').split('|').map(a => a.trim()).filter(Boolean);
      return answers.length ? { id, type, text, options: [], answer: -1, answers, explanation } : null;
    }
    if (type === 'ox') {
      const options = filled.length === 2 ? filled : ['O', 'X'];
      let answer = oxIndex(rawAns);
      if (answer === -1) answer = options.findIndex(o => o.toLowerCase() === rawAns.toLowerCase());
      return answer === -1 ? null : { id, type, text, options, answer, explanation };
    }
    if (filled.length < 2) return null;
    const num = parseInt(rawAns, 10);
    let answer = String(num) === rawAns && num >= 1 && num <= opts.length ? num - 1 : opts.findIndex(o => o && o.toLowerCase() === rawAns.toLowerCase());
    if (answer < 0 || !opts[answer]) return null;
    return { id, type, text, options: filled, answer: filled.indexOf(opts[answer]), explanation };
  }
  function parseRows(rows) {
    const settings = { raw: {} }, questions = [];
    rows.forEach((row, i) => {
      const t = (row[0] || '').trim().toLowerCase();
      if (t === 'type') return;
      if (t === 'setting' || t === 'config') {
        const key = (row[1] || '').trim(), value = unescape((row[2] || '').trim());
        if (!key || !value) return;
        settings.raw[key] = value;
        const f = SETTING_KEYS[normKey(key)];
        if (!f) return;
        if (NUM_KEYS.includes(f)) { const n = parseInt(value, 10); if (n > 0) settings[f] = n; }
        else settings[f] = value;
        return;
      }
      const q = parseQuestion(row, t, i);
      if (q) questions.push(q);
    });
    return { settings, questions };
  }
  async function loadSheet() {
    const { sheetId, gid } = sheetSource();
    if (!sheetId) return null;
    const urls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('시트 공유 설정을 확인하세요');
        return parseRows(parseCSV(text));
      } catch (e) { console.warn('[GameKit] 시트 불러오기 실패', url, e); }
    }
    return null;
  }
  function parseSubtitle(subtitle) {
    const parts = (subtitle || '').split('-').map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) return { subject: '', grade: '', semester: '', unit: (subtitle || '').trim() };
    const [grade, ...sem] = parts[1].split(/\s+/);
    return { subject: parts[0], grade: grade || '', semester: sem.join(' '), unit: parts.slice(2).join('-') };
  }

  // ============================================================
  //  퀴즈 채점 도우미
  // ============================================================
  const normAnswer = s => String(s).replace(/\s+/g, '').toLowerCase();
  function checkAnswer(q, value) {
    if (q.type === 'short') { const v = normAnswer(value); return !!v && (q.answers || []).some(a => normAnswer(a) === v); }
    return Number(value) === q.answer;
  }
  function shuffleQuestion(q) {
    if (q.type !== 'multiple') return q;
    const c = q.options.map((text, i) => ({ text, ok: i === q.answer }));
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    return { ...q, options: c.map(x => x.text), answer: c.findIndex(x => x.ok) };
  }
  const correctText = q => q.type === 'short' ? (q.answers || []).join(' / ') : q.options[q.answer];

  // ============================================================
  //  별명 (5자리: 숫자 8 미사용, 416·513 포함 번호 제외)
  // ============================================================
  function generateNickname() {
    const digits = '012345679';
    for (;;) {
      let n = '';
      for (let i = 0; i < 5; i++) n += digits[Math.floor(Math.random() * digits.length)];
      if (!n.includes('416') && !n.includes('513')) return `도전자${n}`;
    }
  }
  const MAX_NICK = 12;
  const cleanNickname = s => String(s || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, MAX_NICK);

  // ============================================================
  //  명예의 전당
  //  기록: 웹앱(POST) → 랭킹 시트 열: 등록일시 | 닉네임 | 점수 | 웨이브 | 게임 이름 | 과목 | 학년 | 학기 | 단원명
  //  조회: 랭킹 시트를 직접 읽음 (링크가 있는 모든 사용자 보기 권한 필요)
  // ============================================================
  const gameName = () => config.gameName || state.settings.gameName || document.title;
  let submitted = false;
  async function submitResult(result) {
    if (submitted) return;
    submitted = true;
    const url = state.settings.rankingUrl || config.rankingUrl;
    if (!config.submitScores || !url) return;
    setSubmitStatus('sending');
    try {
      await fetch(url, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          nickname: cleanNickname(state.nickname) || generateNickname(),
          score: Number(result.score) || 0,
          wave: Number(result.wave) || 0,
          gameTitle: gameName(),
          subject: state.unit.subject, grade: state.unit.grade, semester: state.unit.semester,
          unit: state.unit.unit || config.gameTitle || state.settings.gameTitle || '',
          mode: state.mode, difficulty: state.difficulty,
          correct: Number(result.correct) || 0, total: Number(result.total) || 0, cleared: !!result.cleared,
        }),
      });
      setSubmitStatus('sent');
    } catch (e) {
      console.warn('[GameKit] 기록 전송 실패', e);
      setSubmitStatus('failed');
    }
  }
  function resetSubmit() { submitted = false; setSubmitStatus('idle'); }
  function setSubmitStatus(s) {
    state.submitStatus = s;
    document.querySelectorAll('[data-gk-submit-status]').forEach(el => { el.textContent = submitStatusText(); });
  }
  function submitStatusText() {
    return { sending: '명예의 전당에 기록을 보내는 중...', sent: '명예의 전당에 기록했어요.', failed: '기록 전송에 실패했어요.' }[state.submitStatus] || '';
  }

  const compact = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const unitKeyword = u => String(u || '').replace(/^[\d\s.\-)]+/, '').replace(/["']/g, '').trim();
  // "곤충 리그" → '.*곤[ ]*충[ ]*리[ ]*그.*' (띄어쓰기가 달라도 같은 게임으로 찾기)
  const gamePattern = name => { const ch = [...compact(name)].filter(c => /[0-9a-z가-힣]/i.test(c)); return ch.length ? `.*${ch.join('[ ]*')}.*` : ''; };

  async function gviz(tq) {
    const sheetId = state.settings.rankingSheetId || config.rankingSheetId;
    const sheetName = state.settings.rankingSheetName || config.rankingSheetName;
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=${encodeURIComponent(tq)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (json.status === 'error') throw new Error((json.errors && json.errors[0] && json.errors[0].detailed_message) || 'query error');
    return (json.table && json.table.rows) || [];
  }
  async function fetchRanking(scope, limit = 10) {
    const filters = ['C is not null'];
    const keyword = scope === 'game' ? unitKeyword(state.unit.unit) : '';
    const pattern = scope === 'game' ? gamePattern(gameName()) : '';
    if (keyword) filters.push(`I contains "${keyword}"`);
    const base = `select B, C, D, E, I where ${filters.join(' and ')}`;
    let rows;
    try {
      rows = await gviz(`${base}${pattern ? ` and E matches '${pattern}'` : ''} order by C desc limit 1000`);
    } catch (e) {
      if (!pattern) throw e;
      rows = await gviz(`${base} order by C desc limit 1000`); // matches 를 못 쓰면 이름 거르기는 아래에서
    }
    const key = scope === 'game' ? compact(gameName()) : '';
    const best = new Map();
    for (const r of rows) {
      const c = r.c || [];
      const e = { nickname: String((c[0] && c[0].v) ?? '').trim(), score: Number(c[1] && c[1].v) || 0, wave: Number(c[2] && c[2].v) || undefined, gameName: String((c[3] && c[3].v) ?? '').trim(), unit: String((c[4] && c[4].v) ?? '').trim() };
      if (!e.nickname || (key && !compact(e.gameName).includes(key))) continue;
      const prev = best.get(e.nickname);
      if (!prev || prev.score < e.score) best.set(e.nickname, e);
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // ============================================================
  //  화면: 공통 요소
  // ============================================================
  let root;
  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'gk-root';
    document.body.appendChild(root);
    return root;
  }
  function overlay(cls) {
    const el = document.createElement('div');
    el.className = `gk-overlay ${cls}`;
    ensureRoot().appendChild(el);
    return el;
  }

  // ---------- 랭킹 팝업 ----------
  let rankEl = null, rankScope = 'game', rankHighlight = '', rankReq = 0;
  function openRanking(scope = 'game', highlightNickname = '') {
    rankScope = scope; rankHighlight = highlightNickname;
    if (!rankEl) {
      rankEl = overlay('gk-rank-overlay');
      rankEl.addEventListener('click', e => {
        if (e.target === rankEl || e.target.closest('[data-gk-close]')) return closeRanking();
        const tab = e.target.closest('[data-gk-scope]');
        if (tab) { rankScope = tab.dataset.gkScope; renderRanking(); }
        if (e.target.closest('[data-gk-reload]')) renderRanking();
      });
    }
    rankEl.hidden = false;
    renderRanking();
  }
  function closeRanking() { if (rankEl) rankEl.hidden = true; }
  async function renderRanking() {
    const id = ++rankReq;
    const subtitle = rankScope === 'game' ? `${esc(gameName())}${state.unit.unit ? ` · ${esc(state.unit.unit)}` : ''}` : '모든 게임 · 별명별 최고 점수';
    const shell = body => `
      <div class="gk-dialog" role="dialog" aria-modal="true" aria-label="명예의 전당">
        <div class="gk-dialog-head">
          <h2>🏆 명예의 전당</h2>
          <div><button type="button" class="gk-icon-btn" data-gk-reload title="새로고침">↻</button><button type="button" class="gk-icon-btn" data-gk-close title="닫기">✕</button></div>
        </div>
        <div class="gk-tabs">
          <button type="button" data-gk-scope="game" class="${rankScope === 'game' ? 'on' : ''}">현재 게임 랭킹</button>
          <button type="button" data-gk-scope="all" class="${rankScope === 'all' ? 'on' : ''}">전체 랭킹</button>
        </div>
        <p class="gk-dim">${subtitle}</p>
        <div class="gk-rank-body">${body}</div>
      </div>`;
    rankEl.innerHTML = shell('<p class="gk-empty gk-pulse">순위를 불러오는 중...</p>');
    let list = null;
    try { list = await fetchRanking(rankScope); } catch (e) { console.warn('[GameKit] 랭킹 불러오기 실패', e); }
    if (id !== rankReq || rankEl.hidden) return;
    const body = list === null ? '<p class="gk-empty">순위를 불러올 수 없어요.</p>'
      : !list.length ? '<p class="gk-empty">아직 기록이 없어요.<br>첫 번째 주인공이 되어 보세요!</p>'
      : `<ol class="gk-rank-list">${list.map((e, i) => `
          <li class="${rankHighlight && e.nickname === rankHighlight ? 'me' : ''}">
            <b class="gk-rank-no r${i + 1}">${i + 1}</b>
            <span class="gk-rank-name">${esc(e.nickname)}${rankScope === 'all' && e.gameName ? `<small>${esc(e.gameName)}${e.unit ? ` · ${esc(e.unit)}` : ''}</small>` : ''}</span>
            ${e.wave !== undefined ? `<span class="gk-rank-wave">${esc(config.waveLabel.replace('{n}', e.wave))}</span>` : ''}
            <span class="gk-rank-score">${e.score.toLocaleString()}</span>
          </li>`).join('')}</ol>`;
    rankEl.innerHTML = shell(body);
  }
  // 아무 곳에나 넣을 수 있는 랭킹 버튼 두 개 (게임 결과 화면 등)
  function rankingButtonsHTML() {
    return `<div class="gk-rank-btns">
      <button type="button" class="gk-btn gk-btn-gold" data-gk-open-rank="game">🏆 현재 게임 랭킹</button>
      <button type="button" class="gk-btn gk-btn-sky" data-gk-open-rank="all">🌐 전체 랭킹</button>
    </div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-gk-open-rank]');
    if (b) openRanking(b.dataset.gkOpenRank, state.nickname);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && rankEl && !rankEl.hidden) { e.stopPropagation(); closeRanking(); } }, true);

  // ---------- 시작 화면 ----------
  let startEl = null, startOpts = {};
  function showStartScreen(opts = {}) {
    startOpts = Object.assign(startOpts, opts);
    if (!startEl) {
      startEl = overlay('gk-start-overlay');
      startEl.addEventListener('click', onStartClick);
      startEl.addEventListener('input', e => { if (e.target.matches('[data-gk-nick]')) state.nickname = e.target.value; });
      startEl.addEventListener('focusout', e => { if (e.target.matches('[data-gk-nick]')) { state.nickname = cleanNickname(state.nickname) || generateNickname(); e.target.value = state.nickname; } });
    }
    startEl.hidden = false;
    renderStart();
  }
  function hideStartScreen() { if (startEl) startEl.hidden = true; }
  function onStartClick(e) {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.gkMode) { state.mode = t.dataset.gkMode; renderStart(); }
    else if (t.dataset.gkDiff) { state.difficulty = t.dataset.gkDiff; renderStart(); }
    else if ('gkReroll' in t.dataset) { state.nickname = generateNickname(); renderStart(); }
    else if ('gkStart' in t.dataset) {
      state.nickname = cleanNickname(state.nickname) || generateNickname();
      resetSubmit();
      hideStartScreen();
      if (startOpts.onStart) startOpts.onStart(api.state);
    } else if (t.dataset.gkLink !== undefined) {
      const link = (startOpts.links || [])[Number(t.dataset.gkLink)];
      if (link && link.onClick) link.onClick();
    }
  }
  function renderStart() {
    if (!startEl || startEl.hidden) return;
    const s = state, title = config.gameName || s.settings.gameName || document.title;
    const subTitle = config.gameTitle || s.settings.gameTitle || '';
    const unitText = [s.unit.subject, [s.unit.grade, s.unit.semester].filter(Boolean).join(' '), s.unit.unit].filter(Boolean).join(' · ');
    const seg = (on) => on ? 'on' : '';
    const focusNick = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-gk-nick]');
    startEl.innerHTML = `
      <div class="gk-card gk-start">
        ${startOpts.logo ? `<div class="gk-logo">${startOpts.logo}</div>` : ''}
        <h1 class="gk-title">${esc(title)}</h1>
        ${subTitle ? `<p class="gk-subtitle">${esc(subTitle)}</p>` : ''}
        ${unitText ? `<p class="gk-unit">${esc(unitText)}</p>` : ''}
        <div class="gk-rows">
          <div class="gk-row"><span>별명</span>
            <input data-gk-nick type="text" maxlength="${MAX_NICK}" value="${esc(s.nickname)}" aria-label="도전자 별명" autocomplete="off">
            <button type="button" class="gk-icon-btn gk-boxed" data-gk-reroll title="별명 다시 만들기">🔀</button>
          </div>
          <div class="gk-row"><span>방식</span>
            <div class="gk-seg">
              <button type="button" data-gk-mode="free" class="${seg(s.mode === 'free')}">${esc(config.modeLabels.free.replace('{n}', s.quizGoal))}</button>
              <button type="button" data-gk-mode="game" class="${seg(s.mode === 'game')} gk-gold">${esc(config.modeLabels.game.replace('{n}', s.quizGoal))}</button>
            </div>
          </div>
          <div class="gk-row"><span>난이도</span>
            <div class="gk-seg">${['easy', 'normal', 'hard'].map(d => `<button type="button" data-gk-diff="${d}" class="${seg(s.difficulty === d)}">${esc(config.difficultyLabels[d])}</button>`).join('')}</div>
          </div>
          <p class="gk-hint">${esc(config.modeDescriptions[s.mode].replace('{n}', s.quizGoal))} · ${esc(config.difficultyDescriptions[s.difficulty] || '')}</p>
        </div>
        ${s.ready ? '<button type="button" class="gk-btn gk-btn-start" data-gk-start>▶ 게임 시작</button>' : '<p class="gk-loading gk-pulse">문제를 불러오는 중...</p>'}
        ${rankingButtonsHTML()}
        ${(startOpts.links || []).length ? `<div class="gk-links">${startOpts.links.map((l, i) => `<button type="button" data-gk-link="${i}">${esc(l.label)}</button>`).join('<i>·</i>')}</div>` : ''}
      </div>`;
    if (focusNick) { const inp = startEl.querySelector('[data-gk-nick]'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  // ============================================================
  //  초기화: GameKit.init({ 설정 }) → Promise (시트를 불러오면 끝남)
  // ============================================================
  async function init(options = {}) {
    Object.assign(config, options);
    const o = urlOptions();
    state.nickname = generateNickname();
    state.mode = o.mode || config.defaultMode;
    state.difficulty = o.difficulty || config.defaultDifficulty;
    state.quizGoal = o.quizGoal || config.defaultQuizGoal;
    const data = await loadSheet();
    if (data) {
      state.settings = data.settings;
      state.questions = data.questions;
      state.fromSheet = data.questions.length > 0;
      if (!o.quizGoal && data.settings.gameModeGoal) state.quizGoal = data.settings.gameModeGoal;
    }
    if (o.rankingUrl) state.settings.rankingUrl = o.rankingUrl;
    state.unit = parseSubtitle(state.settings.subtitle);
    state.ready = true;
    renderStart();
    return api.state;
  }

  const api = {
    init, config, state,
    showStartScreen, hideStartScreen, openRanking, closeRanking, rankingButtonsHTML,
    submitResult, resetSubmit, submitStatusText,
    checkAnswer, shuffleQuestion, correctText, generateNickname, parseRows, parseCSV, parseSubtitle, urlOptions, sheetSource, esc,
  };
  return api;
})();
