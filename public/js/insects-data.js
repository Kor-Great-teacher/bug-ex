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

  // ============================================================
  //  등급 (일반 → 희귀 → 영웅 → 전설)
  //  · 모든 곤충의 기본 능력치 합은 25로 같아요 (곤충마다 모양만 달라요).
  //  · 힘의 차이는 등급이 만들어요: 등급마다 모든 능력치 +2 (일반 +0 · 희귀 +2 · 영웅 +4 · 전설 +6)
  //  · 업그레이드는 등급마다 한계가 있어요 (능력치마다 일반 4 · 희귀 7 · 영웅 10 · 전설 12단계)
  //  · 등급은 곤충 종류와 상관없이 채집할 때 확률로 정해져요 (일반 55% · 희귀 28% · 영웅 12% · 전설 5%)
  //  · 같은 곤충을 여러 번 채집하고(모은 수) 업그레이드를 일정 횟수 이상 하면 저절로 1등급 올라가요
  //    (업그레이드는 그대로, 한계는 늘어나요 · 모은 수는 새 등급에서 1부터 다시 세요)
  //  → 같은 등급끼리는 키운 만큼, 다른 등급끼리는 등급만큼 차이가 분명해요.
  // ============================================================
  const TIERS = ['common', 'rare', 'hero', 'legend'];
  const TIER_BONUS = [0, 2, 4, 6];
  const TIER_CAP = [4, 7, 10, 12];
  const PROMO_REQ = [6, 14, 24];       // 이 등급에서 다음 등급으로 가려면 필요한 업그레이드 합계
  const COPY_REQ = [4, 3, 2];          // … 그리고 이 등급에서 모은 같은 곤충 수 (일반 4장 → 희귀, 희귀 3장 → 영웅, 영웅 2장 → 전설)
  const MAX_LV = TIER_CAP[TIER_CAP.length - 1];

  // 등급이 높을수록 드물고(채집 확률), 캐릭터에 기운 · 반짝이 · 후광이 더 많이 붙어요
  const RARITY = {
    common: { name: '일반', weight: 55, color: '#9ca3af', score: 50 },
    rare: { name: '희귀', weight: 28, color: '#38bdf8', score: 100 },
    hero: { name: '영웅', weight: 12, color: '#a855f7', score: 150 },
    legend: { name: '전설', weight: 5, color: '#fbbf24', score: 250 },
  };

  // base: [속도, 힘, 균형, 점프, 체력] (합 25)  fact: 카드에 보여 주는 곤충 이야기
  const LIST = [
    { id: 'ant', name: '개미', base: [4, 6, 5, 3, 7], fact: '자기 몸무게의 수십 배를 들 수 있어요. 페로몬 냄새로 친구에게 길을 알려 줘요.' },
    { id: 'ladybug', name: '무당벌레', base: [4, 4, 7, 4, 6], fact: '진딧물을 잡아먹는 농부의 친구예요. 위험하면 죽은 척을 해요.' },
    { id: 'bee', name: '꿀벌', base: [7, 3, 5, 4, 6], fact: '8자 춤으로 꽃이 있는 방향과 거리를 친구들에게 알려 줘요.' },
    { id: 'grasshopper', name: '메뚜기', base: [5, 3, 5, 8, 4], fact: '튼튼한 뒷다리로 몸길이의 20배나 멀리 뛰어요.' },
    { id: 'cricket', name: '귀뚜라미', base: [5, 4, 4, 7, 5], fact: '날개를 비벼서 귀뚤귀뚤 소리를 내요. 귀는 앞다리에 있어요.' },
    { id: 'butterfly', name: '배추흰나비', base: [6, 3, 7, 5, 4], fact: '알 → 애벌레 → 번데기 → 나비로 자라는 완전 탈바꿈을 해요.' },
    { id: 'firefly', name: '반딧불이', base: [5, 3, 6, 5, 6], fact: '배 끝에서 열이 거의 없는 차가운 빛을 내요. 깨끗한 물가에서만 살아요.' },
    { id: 'dragonfly', name: '잠자리', base: [8, 3, 5, 5, 4], fact: '네 장의 날개를 따로따로 움직여 제자리 비행도 해요. 겹눈이 아주 커요.' },
    { id: 'dungbeetle', name: '소똥구리', base: [3, 8, 5, 3, 6], fact: '파브르가 오래 관찰한 곤충이에요. 소똥을 공처럼 굴려 집으로 가져가요.' },
    { id: 'mantis', name: '사마귀', base: [5, 6, 6, 4, 4], fact: '낫처럼 생긴 앞다리로 먹이를 잡아요. 머리를 180도 가까이 돌릴 수 있어요.' },
    { id: 'cicada', name: '매미', base: [5, 4, 5, 5, 6], fact: '땅속에서 여러 해를 애벌레로 지내다가 여름에 나와 맴맴 울어요.' },
    { id: 'rhino', name: '장수풍뎅이', base: [3, 9, 5, 2, 6], fact: '수컷의 커다란 뿔로 다른 곤충을 들어 올려 밀어내요. 힘이 정말 세요!' },
    { id: 'stag', name: '사슴벌레', base: [3, 7, 6, 3, 6], fact: '사슴뿔처럼 생긴 큰 턱으로 상대를 집어요. 참나무 수액을 좋아해요.' },
    { id: 'swallowtail', name: '호랑나비', base: [6, 3, 6, 6, 4], fact: '노랑과 검정 줄무늬 날개가 멋진 나비예요. 산초나무·탱자나무에 알을 낳아요.' },
  ];
  const INSECTS = {};
  for (const i of LIST) INSECTS[i.id] = i;

  const clampTier = t => Math.max(0, Math.min(TIERS.length - 1, Math.round(Number(t)) || 0));
  const nativeTier = () => 0;            // 곤충 종류마다 정해진 등급은 없어요 (등급은 채집할 때 정해져요)
  const tierOf = (type, tier) => tier == null ? nativeTier(type) : clampTier(tier);
  const capOf = tier => TIER_CAP[clampTier(tier)];
  const zeroLv = () => ({ spd: 0, pow: 0, bal: 0, jmp: 0, sta: 0 });
  const upgradeCost = lv => 12 + lv * 6; // 지금 단계(lv)에서 다음 단계로 올리는 값
  const totalLv = lv => STAT_KEYS.reduce((s, k) => s + ((lv && lv[k]) | 0), 0);
  // 기본 능력치 + 등급 보너스 + 업그레이드 (등급 한계까지만)
  function statsOf(type, lv, tier) {
    const ins = INSECTS[type] || INSECTS.ant, t = tierOf(type, tier), cap = TIER_CAP[t], o = {};
    STAT_KEYS.forEach((k, i) => { o[k] = ins.base[i] + TIER_BONUS[t] + Math.max(0, Math.min(cap, (lv && lv[k]) | 0)); });
    return o;
  }
  const powerOf = (type, lv, tier) => { const s = statsOf(type, lv, tier); return STAT_KEYS.reduce((a, k) => a + s[k], 0); };
  // 등급업 조건: { ok, max, next, have, need, copies, copyNeed }
  function promoInfo(type, lv, tier, copies = 1) {
    const t = tierOf(type, tier);
    if (t >= TIERS.length - 1) return { ok: false, max: true, next: null };
    const have = totalLv(lv), need = PROMO_REQ[t], copyNeed = COPY_REQ[t];
    return { ok: have >= need && copies >= copyNeed, have, need, copies, copyNeed, next: TIERS[t + 1] };
  }
  // 받은 값이 올바른지 확인하고 고쳐요 (서버용): 등급은 0~3, 업그레이드는 등급 한계까지
  function cleanLv(lv, tier) {
    const cap = tier == null ? MAX_LV : capOf(tier), o = zeroLv();
    for (const k of STAT_KEYS) { const v = Math.round(Number(lv && lv[k]) || 0); o[k] = Math.max(0, Math.min(cap, v)); }
    return o;
  }
  function cleanEntry(type, lv, tier) {
    if (!INSECTS[type]) type = 'ant';
    const t = clampTier(tier);
    return { type, tier: t, lv: cleanLv(lv, t) };
  }

  // 채집: 곤충은 14종 중 아무거나, 등급은 확률로 (일반 55 · 희귀 28 · 영웅 12 · 전설 5)
  function rollInsect(rand = Math.random) { return LIST[Math.floor(rand() * LIST.length)].id; }
  function rollTier(rand = Math.random) {
    const total = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
    let r = rand() * total;
    for (let t = 0; t < TIERS.length; t++) { if ((r -= RARITY[TIERS[t]].weight) < 0) return t; }
    return 0;
  }

  // AI 곤충 (빈자리를 채워요): 사람 참가자의 능력치 합에 맞춰 등급과 업그레이드를 정해요
  const BOT_NAMES = ['AI 풀잎', 'AI 이슬', 'AI 도토리', 'AI 민들레', 'AI 솔방울', 'AI 클로버', 'AI 버섯', 'AI 조약돌'];
  const BOT_SKILL = { easy: 0.3, normal: 0.58, hard: 0.85 };
  const BOT_POWER = { easy: 0.88, normal: 0.98, hard: 1.08 };
  function makeBots(count, humans, difficulty = 'normal', taken = []) {
    const avg = humans.length ? humans.reduce((s, h) => s + powerOf(h.type, h.lv, h.tier), 0) / humans.length : 27;
    const names = BOT_NAMES.filter(n => !taken.includes(n)).sort(() => Math.random() - 0.5);
    const bots = [];
    for (let b = 0; b < count; b++) {
      const type = rollInsect(), lv = zeroLv();
      const target = Math.round(avg * (BOT_POWER[difficulty] || 0.98) + (Math.random() - 0.5) * 4);
      let tier = nativeTier(type);
      // 이 등급에서 최대로 키워도 모자라면 등급을 올려요
      while (tier < TIERS.length - 1 && powerOf(type, { spd: 99, pow: 99, bal: 99, jmp: 99, sta: 99 }, tier) < target) tier++;
      for (let guard = 0; guard < 200 && powerOf(type, lv, tier) < target; guard++) {
        const open = STAT_KEYS.filter(k => lv[k] < TIER_CAP[tier]);
        if (!open.length) break;
        lv[open[Math.floor(Math.random() * open.length)]]++;
      }
      bots.push({ name: names[b] || `AI ${b + 1}`, type, lv, tier, bot: true, skill: Math.max(0.1, Math.min(0.95, (BOT_SKILL[difficulty] || 0.58) + (Math.random() - 0.5) * 0.16)) });
    }
    return bots;
  }

  return { STATS, STAT_KEYS, MAX_LV, TIERS, TIER_BONUS, TIER_CAP, PROMO_REQ, COPY_REQ, RARITY, LIST, INSECTS, nativeTier, tierOf, capOf, zeroLv, upgradeCost, statsOf, powerOf, promoInfo, cleanLv, cleanEntry, totalLv, rollInsect, rollTier, makeBots };
});
