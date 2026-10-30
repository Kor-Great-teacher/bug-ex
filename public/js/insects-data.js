// 곤충 캐릭터 · 능력치 · 업그레이드 규칙 (브라우저와 서버가 함께 써요)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BugData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 능력치: 속도 · 힘 · 균형 · 점프 · 체력
  const STATS = [
    { k: 'spd', name: '속도', color: '#38bdf8' },
    { k: 'pow', name: '힘', color: '#f87171' },
    { k: 'bal', name: '균형', color: '#a78bfa' },
    { k: 'jmp', name: '점프', color: '#4ade80' },
    { k: 'sta', name: '체력', color: '#fbbf24' },
  ];
  const STAT_KEYS = STATS.map(s => s.k);
  const MAX_LV = 10; // 능력치마다 최대 10단계까지 업그레이드

  // 등급이 높을수록 드물고, 캐릭터에 장식 · 반짝이 · 후광이 더 많이 붙어요
  const RARITY = {
    common: { name: '일반', weight: 55, color: '#9ca3af', score: 50 },
    rare: { name: '희귀', weight: 28, color: '#38bdf8', score: 100 },
    hero: { name: '영웅', weight: 12, color: '#a855f7', score: 150 },
    legend: { name: '전설', weight: 5, color: '#fbbf24', score: 250 },
  };

  // base: [속도, 힘, 균형, 점프, 체력]  fact: 카드에 보여 주는 곤충 이야기 (파브르 곤충기 느낌)
  const LIST = [
    { id: 'ant', name: '개미', rarity: 'common', base: [4, 6, 5, 3, 7], fact: '자기 몸무게의 수십 배를 들 수 있어요. 페로몬 냄새로 친구에게 길을 알려 줘요.' },
    { id: 'ladybug', name: '무당벌레', rarity: 'common', base: [4, 4, 7, 4, 5], fact: '진딧물을 잡아먹는 농부의 친구예요. 위험하면 죽은 척을 해요.' },
    { id: 'bee', name: '꿀벌', rarity: 'common', base: [7, 3, 5, 4, 5], fact: '8자 춤으로 꽃이 있는 방향과 거리를 친구들에게 알려 줘요.' },
    { id: 'grasshopper', name: '메뚜기', rarity: 'common', base: [5, 3, 4, 8, 4], fact: '튼튼한 뒷다리로 몸길이의 20배나 멀리 뛰어요.' },
    { id: 'cricket', name: '귀뚜라미', rarity: 'common', base: [5, 3, 4, 7, 5], fact: '날개를 비벼서 귀뚤귀뚤 소리를 내요. 귀는 앞다리에 있어요.' },
    { id: 'butterfly', name: '배추흰나비', rarity: 'common', base: [6, 2, 7, 5, 4], fact: '알 → 애벌레 → 번데기 → 나비로 자라는 완전 탈바꿈을 해요.' },
    { id: 'firefly', name: '반딧불이', rarity: 'rare', base: [5, 3, 6, 5, 6], fact: '배 끝에서 열이 거의 없는 차가운 빛을 내요. 깨끗한 물가에서만 살아요.' },
    { id: 'dragonfly', name: '잠자리', rarity: 'hero', base: [9, 3, 6, 6, 5], fact: '네 장의 날개를 따로따로 움직여 제자리 비행도 해요. 겹눈이 아주 커요.' },
    { id: 'dungbeetle', name: '소똥구리', rarity: 'rare', base: [3, 8, 5, 3, 7], fact: '파브르가 오래 관찰한 곤충이에요. 소똥을 공처럼 굴려 집으로 가져가요.' },
    { id: 'mantis', name: '사마귀', rarity: 'hero', base: [6, 7, 7, 5, 5], fact: '낫처럼 생긴 앞다리로 먹이를 잡아요. 머리를 180도 가까이 돌릴 수 있어요.' },
    { id: 'cicada', name: '매미', rarity: 'rare', base: [5, 4, 5, 5, 7], fact: '땅속에서 여러 해를 애벌레로 지내다가 여름에 나와 맴맴 울어요.' },
    { id: 'rhino', name: '장수풍뎅이', rarity: 'legend', base: [4, 10, 6, 3, 9], fact: '수컷의 커다란 뿔로 다른 곤충을 들어 올려 밀어내요. 힘이 정말 세요!' },
    { id: 'stag', name: '사슴벌레', rarity: 'hero', base: [4, 8, 7, 4, 7], fact: '사슴뿔처럼 생긴 큰 턱으로 상대를 집어요. 참나무 수액을 좋아해요.' },
    { id: 'swallowtail', name: '호랑나비', rarity: 'legend', base: [8, 4, 8, 7, 6], fact: '노랑과 검정 줄무늬 날개가 멋진 나비예요. 산초나무·탱자나무에 알을 낳아요.' },
  ];
  const INSECTS = {};
  for (const i of LIST) INSECTS[i.id] = i;

  const zeroLv = () => ({ spd: 0, pow: 0, bal: 0, jmp: 0, sta: 0 });
  const upgradeCost = lv => 15 + lv * 10; // 지금 단계(lv)에서 다음 단계로 올리는 값
  // 기본 능력치 + 업그레이드 단계
  function statsOf(type, lv) {
    const ins = INSECTS[type] || INSECTS.ant, o = {};
    STAT_KEYS.forEach((k, i) => { o[k] = ins.base[i] + Math.max(0, Math.min(MAX_LV, (lv && lv[k]) | 0)); });
    return o;
  }
  // 서버에서 받은 업그레이드 값이 올바른지 확인하고 고쳐요
  function cleanLv(lv) {
    const o = zeroLv();
    for (const k of STAT_KEYS) { const v = Math.round(Number(lv && lv[k]) || 0); o[k] = Math.max(0, Math.min(MAX_LV, v)); }
    return o;
  }
  const totalLv = lv => STAT_KEYS.reduce((s, k) => s + ((lv && lv[k]) | 0), 0);

  // 채집: 희귀도 가중치로 곤충 하나 뽑기
  function rollInsect(rand = Math.random) {
    const total = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
    let r = rand() * total, rarity = 'common';
    for (const [k, v] of Object.entries(RARITY)) { if ((r -= v.weight) < 0) { rarity = k; break; } }
    const pool = LIST.filter(i => i.rarity === rarity);
    return pool[Math.floor(rand() * pool.length)].id;
  }

  // AI 곤충 (빈자리를 채워요)
  const BOT_NAMES = ['AI 풀잎', 'AI 이슬', 'AI 도토리', 'AI 민들레', 'AI 솔방울', 'AI 클로버', 'AI 버섯', 'AI 조약돌'];
  const BOT_SKILL = { easy: 0.3, normal: 0.58, hard: 0.85 };
  const BOT_POWER = { easy: 0.5, normal: 0.85, hard: 1.15 };
  // humans: 사람 참가자 [{ type, lv }] — AI 업그레이드 수준을 사람들에 맞춰요
  function makeBots(count, humans, difficulty = 'normal', taken = []) {
    const avg = humans.length ? humans.reduce((s, h) => s + totalLv(h.lv), 0) / humans.length : 4;
    const points = Math.round(avg * (BOT_POWER[difficulty] || 0.85) + Math.random() * 2);
    const names = BOT_NAMES.filter(n => !taken.includes(n)).sort(() => Math.random() - 0.5);
    const bots = [];
    for (let b = 0; b < count; b++) {
      const lv = zeroLv();
      for (let p = 0; p < points; p++) {
        const k = STAT_KEYS[Math.floor(Math.random() * STAT_KEYS.length)];
        if (lv[k] < MAX_LV) lv[k]++;
      }
      bots.push({ name: names[b] || `AI ${b + 1}`, type: rollInsect(), lv, bot: true, skill: Math.max(0.1, Math.min(0.95, (BOT_SKILL[difficulty] || 0.58) + (Math.random() - 0.5) * 0.16)) });
    }
    return bots;
  }

  return { STATS, STAT_KEYS, MAX_LV, RARITY, LIST, INSECTS, zeroLv, upgradeCost, statsOf, cleanLv, totalLv, rollInsect, makeBots };
});
