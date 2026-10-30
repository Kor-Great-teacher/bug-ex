// 퀴즈 문제 은행과 출제기
// 문제 형식: { q: 문제, a: 정답, w: [오답들] }
window.BugQuiz = (() => {
  const SUBJECTS = { math: '수학', korean: '국어', science: '과학', social: '사회', english: '영어', custom: '선생님 문제' };

  const BANK = {
    korean: [
      { q: '바르게 쓴 낱말은?', a: '설거지', w: ['설겆이', '설걷이', '셜거지'] },
      { q: '바르게 쓴 낱말은?', a: '며칠', w: ['몇일', '몇칠', '며칟'] },
      { q: '바르게 쓴 낱말은?', a: '깨끗이', w: ['깨끗히', '깨끄시', '깨끗치'] },
      { q: '바르게 쓴 낱말은?', a: '초콜릿', w: ['쵸콜렛', '초코렛', '쪼꼴렛'] },
      { q: '"이제 집에 가도 (   )?" 빈칸에 알맞은 말은?', a: '돼요', w: ['되요', '돼여', '되여'] },
      { q: '"감기가 다 (   )." 빈칸에 알맞은 말은?', a: '나았다', w: ['낳았다', '낮았다', '났았다'] },
      { q: '"숙제를 (   ) 했다." 빈칸에 알맞은 말은?', a: '안', w: ['않', '앉', '않은'] },
      { q: '"퀴즈 정답을 (   )." 빈칸에 알맞은 말은?', a: '맞혔다', w: ['맞췄다', '마쳤다', '맞쳤다'] },
      { q: '"선생님께서 수학을 (   )." 빈칸에 알맞은 말은?', a: '가르치신다', w: ['가르키신다', '가리키신다', '갈치신다'] },
      { q: '바르게 쓴 문장은?', a: '왠지 기분이 좋다.', w: ['웬지 기분이 좋다.', '왠일로 일찍 왔니?', '웬지 모르게 웃었다.'] },
      { q: "'부지런하다'의 반대말은?", a: '게으르다', w: ['성실하다', '빠르다', '튼튼하다'] },
      { q: "'기쁘다'와 뜻이 비슷한 말은?", a: '즐겁다', w: ['슬프다', '무섭다', '지루하다'] },
      { q: "'밥'의 높임말은?", a: '진지', w: ['반찬', '간식', '국'] },
      { q: "'나이'의 높임말은?", a: '연세', w: ['나잇살', '세월', '생일'] },
      { q: "'집'의 높임말은?", a: '댁', w: ['방', '집안', '가게'] },
      { q: '속담: "(   )도 나무에서 떨어진다"', a: '원숭이', w: ['고양이', '다람쥐', '개미'] },
      { q: '속담: "티끌 모아 (   )"', a: '태산', w: ['바다', '하늘', '동산'] },
      { q: '속담: "가는 말이 고와야 (   ) 말이 곱다"', a: '오는', w: ['하는', '듣는', '쓰는'] },
      { q: "관용어 '발이 넓다'의 뜻은?", a: '아는 사람이 많다', w: ['발 크기가 크다', '걸음이 빠르다', '여행을 많이 한다'] },
      { q: "관용어 '손이 크다'의 뜻은?", a: '씀씀이가 넉넉하다', w: ['손바닥이 넓다', '힘이 세다', '손재주가 좋다'] },
      { q: '소리를 흉내 낸 말(의성어)은?', a: '멍멍', w: ['살금살금', '반짝반짝', '엉금엉금'] },
      { q: '모양이나 움직임을 흉내 낸 말(의태어)은?', a: '엉금엉금', w: ['쨍그랑', '꼬끼오', '딩동'] },
    ],
    science: [
      { q: '곤충의 다리는 모두 몇 개일까요?', a: '6개', w: ['4개', '8개', '10개'] },
      { q: '곤충의 다리는 몸의 어느 부분에 붙어 있을까요?', a: '가슴', w: ['머리', '배', '꼬리'] },
      { q: '「곤충기」를 써서 곤충 관찰 이야기를 남긴 프랑스 과학자는?', a: '파브르', w: ['다윈', '뉴턴', '에디슨'] },
      { q: '번데기 단계가 없는 불완전 탈바꿈을 하는 곤충은?', a: '메뚜기', w: ['나비', '꿀벌', '무당벌레'] },
      { q: '번데기 단계를 거치는 완전 탈바꿈 곤충은?', a: '배추흰나비', w: ['잠자리', '매미', '메뚜기'] },
      { q: '곤충의 더듬이는 보통 몇 개일까요?', a: '2개', w: ['1개', '4개', '6개'] },
      { q: '여러 개의 작은 눈이 모여 이루어진 곤충의 눈은?', a: '겹눈', w: ['홑눈', '안경눈', '속눈'] },
      { q: '소똥을 동그랗게 굴려 옮기는 곤충은?', a: '소똥구리', w: ['사마귀', '잠자리', '매미'] },
      { q: '물속에서 애벌레 시절을 보내는 곤충은?', a: '잠자리', w: ['개미', '메뚜기', '나비'] },
      { q: '배 끝에서 빛을 내는 곤충은?', a: '반딧불이', w: ['무당벌레', '귀뚜라미', '꿀벌'] },
      { q: '꿀벌이 꽃의 위치를 친구에게 알리는 방법은?', a: '춤을 춘다', w: ['노래를 부른다', '그림을 그린다', '불빛을 낸다'] },
      { q: '진딧물을 잡아먹어 농사에 도움을 주는 곤충은?', a: '무당벌레', w: ['모기', '파리', '바퀴벌레'] },
      { q: '매미가 땅속에서 지내는 시기는?', a: '애벌레', w: ['알', '어른벌레', '번데기 없이 바로 어른'] },
      { q: '곤충의 몸은 어떻게 나뉠까요?', a: '머리, 가슴, 배', w: ['머리, 배', '머리, 가슴, 배, 꼬리', '몸통, 다리'] },
      { q: '다음 중 곤충이 아닌 것은?', a: '거미', w: ['개미', '나비', '메뚜기'] },
      { q: '개미가 친구에게 길을 알려 줄 때 남기는 냄새 물질은?', a: '페로몬', w: ['엽록소', '비타민', '녹말'] },
      { q: '개미의 한살이(완전 탈바꿈) 순서로 옳은 것은?', a: '알 → 애벌레 → 번데기 → 어른벌레', w: ['알 → 번데기 → 애벌레 → 어른벌레', '알 → 애벌레 → 어른벌레', '애벌레 → 알 → 번데기 → 어른벌레'] },
      { q: '물이 얼기 시작하는 온도는?', a: '0℃', w: ['100℃', '10℃', '-10℃'] },
      { q: '물이 끓는 온도는? (보통 기압)', a: '100℃', w: ['0℃', '50℃', '200℃'] },
      { q: '얼음이 녹아 물이 되는 것은 어떤 변화일까요?', a: '고체 → 액체', w: ['액체 → 기체', '기체 → 액체', '액체 → 고체'] },
      { q: '식물이 빛을 이용해 스스로 양분을 만드는 것은?', a: '광합성', w: ['호흡', '증산 작용', '소화'] },
      { q: '식물 뿌리가 하는 일로 알맞은 것은?', a: '물을 흡수한다', w: ['꽃가루를 만든다', '씨를 퍼뜨린다', '빛을 모은다'] },
      { q: '태양계에서 가장 큰 행성은?', a: '목성', w: ['토성', '지구', '해왕성'] },
      { q: '지구에서 가장 가까운 별(항성)은?', a: '태양', w: ['달', '북극성', '금성'] },
      { q: '자석의 같은 극끼리 가까이 하면?', a: '서로 밀어낸다', w: ['서로 끌어당긴다', '아무 일도 없다', '자석이 녹는다'] },
      { q: '소리가 나는 물체는 공통적으로 어떤 상태일까요?', a: '떨린다', w: ['빛난다', '차가워진다', '무거워진다'] },
      { q: '달의 모양이 다시 처음처럼 돌아오는 데 걸리는 시간은?', a: '약 30일', w: ['약 7일', '약 1년', '약 하루'] },
      { q: '지구가 한 바퀴 자전하는 데 걸리는 시간은?', a: '약 하루(24시간)', w: ['약 1년', '약 한 달', '약 1시간'] },
      { q: '산성 용액에 푸른색 리트머스 종이를 넣으면?', a: '붉게 변한다', w: ['그대로 푸르다', '노랗게 변한다', '검게 변한다'] },
      { q: '빛이 곧게 나아가서(직진) 생기는 현상은?', a: '그림자', w: ['메아리', '무지개', '자석'] },
      { q: '공기 중에 가장 많이 들어 있는 기체는?', a: '질소', w: ['산소', '이산화 탄소', '수소'] },
      { q: '사람 몸에서 피를 온몸으로 보내는 기관은?', a: '심장', w: ['폐', '위', '간'] },
      { q: '돋보기(볼록 렌즈)로 햇빛을 모으면 그곳은?', a: '밝고 뜨거워진다', w: ['어둡고 차가워진다', '아무 변화가 없다', '젖는다'] },
    ],
    social: [
      { q: '한글(훈민정음)을 만든 왕은?', a: '세종대왕', w: ['태조', '정조', '광개토대왕'] },
      { q: '우리나라의 국화(나라꽃)는?', a: '무궁화', w: ['진달래', '개나리', '장미'] },
      { q: '남한에서 가장 높은 산은?', a: '한라산', w: ['지리산', '설악산', '북한산'] },
      { q: '우리나라에서 가장 큰 섬은?', a: '제주도', w: ['울릉도', '강화도', '거제도'] },
      { q: '독도가 속한 지역은?', a: '경상북도 울릉군', w: ['강원특별자치도 강릉시', '경상남도 거제시', '전라남도 여수시'] },
      { q: '법을 만드는 국가 기관은?', a: '국회', w: ['법원', '정부', '경찰서'] },
      { q: '재판을 하는 국가 기관은?', a: '법원', w: ['국회', '정부', '소방서'] },
      { q: '거북선을 만들어 나라를 지킨 장군은?', a: '이순신', w: ['강감찬', '을지문덕', '김유신'] },
      { q: '고조선을 세운 사람은?', a: '단군왕검', w: ['주몽', '온조', '박혁거세'] },
      { q: '고려를 세운 사람은?', a: '왕건', w: ['이성계', '궁예', '견훤'] },
      { q: '조선을 세운 사람은?', a: '이성계', w: ['왕건', '세종', '김구'] },
      { q: '광복절은 언제일까요?', a: '8월 15일', w: ['3월 1일', '10월 3일', '6월 6일'] },
      { q: '한글날은 언제일까요?', a: '10월 9일', w: ['5월 15일', '10월 3일', '12월 25일'] },
      { q: '3·1 운동이 일어난 해는?', a: '1919년', w: ['1945년', '1950년', '1910년'] },
      { q: '지도에 방위표가 없으면 보통 위쪽은 어느 방향일까요?', a: '북쪽', w: ['남쪽', '동쪽', '서쪽'] },
      { q: '지도에서 등고선 간격이 좁을수록?', a: '경사가 급하다', w: ['경사가 완만하다', '바다가 가깝다', '기온이 높다'] },
      { q: '선거의 4대 원칙이 아닌 것은?', a: '대리 선거', w: ['보통 선거', '평등 선거', '비밀 선거'] },
      { q: '세계에서 가장 넓은 바다(대양)는?', a: '태평양', w: ['대서양', '인도양', '북극해'] },
      { q: '세계에서 가장 넓은 대륙은?', a: '아시아', w: ['아프리카', '유럽', '남극'] },
      { q: '곤충학자 파브르가 태어난 나라는?', a: '프랑스', w: ['영국', '독일', '미국'] },
      { q: '물건을 만드는 데 필요한 원료나 재료를 무엇이라 할까요?', a: '자원', w: ['소비', '세금', '시장'] },
    ],
    english: [
      { q: "'ant'의 뜻은?", a: '개미', w: ['벌', '거미', '나비'] },
      { q: "'queen'의 뜻은?", a: '여왕', w: ['왕자', '공주', '군인'] },
      { q: "'library'의 뜻은?", a: '도서관', w: ['병원', '박물관', '식당'] },
      { q: "'brave'의 뜻은?", a: '용감한', w: ['배고픈', '졸린', '귀여운'] },
      { q: "'배고픈'을 영어로?", a: 'hungry', w: ['angry', 'happy', 'sleepy'] },
      { q: "'선생님'을 영어로?", a: 'teacher', w: ['doctor', 'student', 'farmer'] },
      { q: "'butterfly'의 뜻은?", a: '나비', w: ['잠자리', '벌', '딱정벌레'] },
      { q: "'beetle'의 뜻은?", a: '딱정벌레', w: ['메뚜기', '개미', '모기'] },
      { q: "'곤충'을 영어로?", a: 'insect', w: ['animal', 'flower', 'forest'] },
      { q: "'child'의 복수형은?", a: 'children', w: ['childs', 'childes', 'childrens'] },
      { q: "'big'의 반대말은?", a: 'small', w: ['tall', 'long', 'fast'] },
      { q: "'12'를 영어로?", a: 'twelve', w: ['twenty', 'eleven', 'twelfth'] },
      { q: "Monday 다음 요일은?", a: 'Tuesday', w: ['Sunday', 'Thursday', 'Friday'] },
      { q: 'I (   ) a student.', a: 'am', w: ['is', 'are', 'be'] },
      { q: 'She (   ) to school every day.', a: 'goes', w: ['go', 'going', 'gone'] },
      { q: 'They (   ) playing soccer now.', a: 'are', w: ['is', 'am', 'be'] },
      { q: '"What time is it?"에 알맞은 대답은?', a: "It's three o'clock.", w: ["It's sunny.", "I'm fine.", "It's Monday."] },
      { q: '"How\'s the weather?"에 알맞은 대답은?', a: "It's rainy.", w: ["It's 5 dollars.", "I'm ten years old.", "It's my bag."] },
      { q: '"Can you swim?"에 알맞은 대답은?', a: 'Yes, I can.', w: ['Yes, I am.', "No, I don't.", 'Yes, it is.'] },
      { q: '"Where is the bee?"에 알맞은 대답은?', a: "It's on the flower.", w: ["It's 5 dollars.", "I'm hungry.", 'I like it.'] },
      { q: '"Thank you."에 알맞은 대답은?', a: "You're welcome.", w: ['Good night.', "I'm sorry.", 'Nice to meet you.'] },
      { q: "'부엌'을 영어로?", a: 'kitchen', w: ['bedroom', 'bathroom', 'garden'] },
    ],
  };

  // ---------- 수학 문제 자동 생성 ----------
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function numberWrongs(ans, spread) {
    const set = new Set();
    const deltas = [1, -1, 2, -2, 10, -10, spread, -spread, 3, -3, 5, -5];
    for (const d of deltas.sort(() => Math.random() - 0.5)) {
      const v = ans + d;
      if (v >= 0 && v !== ans) set.add(v);
      if (set.size >= 3) break;
    }
    return [...set].map(String);
  }
  function makeMath(level) {
    let q, a, wrongs;
    switch (level) {
      case 1: {
        if (Math.random() < 0.5) { const x = rand(3, 12), y = rand(2, 9); q = `${x} + ${y} = ?`; a = x + y; }
        else { const x = rand(10, 20), y = rand(2, 9); q = `${x} - ${y} = ?`; a = x - y; }
        break;
      }
      case 2: {
        if (Math.random() < 0.5) { const x = rand(15, 68), y = rand(12, 31); q = `${x} + ${y} = ?`; a = x + y; }
        else { const x = rand(40, 99), y = rand(11, 38); q = `${x} - ${y} = ?`; a = x - y; }
        break;
      }
      case 3: {
        const x = rand(2, 9), y = rand(2, 9); q = `${x} × ${y} = ?`; a = x * y;
        if (Math.random() < 0.3) { q = `곤충 한 마리의 다리는 6개예요. 곤충 ${x}마리의 다리는 모두 몇 개일까요?`; a = 6 * x; }
        break;
      }
      case 4: {
        const r = Math.random();
        if (r < 0.4) { const y = rand(2, 9), z = rand(2, 9); q = `${y * z} ÷ ${y} = ?`; a = z; }
        else if (r < 0.75) { const x = rand(2, 9), y = rand(2, 9), z = rand(1, 15); q = `${x} × ${y} + ${z} = ?`; a = x * y + z; }
        else { const x = rand(11, 25), y = rand(3, 9); q = `${x} × ${y} = ?`; a = x * y; }
        break;
      }
      default: {
        const r = Math.random();
        if (r < 0.25) {
          const eaten = rand(1, 7);
          q = `수박 한 통을 8조각으로 나눴어요. 개미가 ${eaten}조각을 가져갔다면 남은 수박은 전체의 얼마일까요?`;
          const left = 8 - eaten;
          return { q, a: `${left}/8`, w: [`${eaten}/8`, `${left}/${eaten === 1 ? 7 : 10}`, `${Math.max(1, left - 1)}/8`].filter((v, i, s) => v !== `${left}/8` && s.indexOf(v) === i) };
        } else if (r < 0.5) {
          const w = rand(3, 12), h = rand(3, 9); q = `가로 ${w}cm, 세로 ${h}cm인 직사각형의 넓이는? (단위: cm²)`; a = w * h;
        } else if (r < 0.75) {
          const x = rand(2, 9), y = rand(2, 9), z = rand(2, 6); q = `${x} + ${y} × ${z} = ?`; a = x + y * z;
          wrongs = [String((x + y) * z), ...numberWrongs(a, 4)].filter((v, i, s) => v !== String(a) && s.indexOf(v) === i).slice(0, 3);
        } else {
          const p = [10, 20, 25, 50][rand(0, 3)], n = [40, 60, 80, 100, 200][rand(0, 4)];
          q = `${n}의 ${p}%는 얼마일까요?`; a = n * p / 100;
        }
      }
    }
    return { q, a: String(a), w: wrongs || numberWrongs(a, level >= 3 ? rand(4, 8) : 3) };
  }

  // ---------- 선생님 문제 ----------
  // 한 줄에 한 문제: 문제 | 정답 | 오답1 | 오답2 | 오답3
  let custom = [];
  function parseCustom(text) {
    return (text || '').split('\n').map(l => l.split('|').map(s => s.trim()))
      .filter(p => p.length >= 3 && p[0] && p[1] && p.slice(2).some(Boolean))
      .map(p => ({ q: p[0], a: p[1], w: p.slice(2, 5).filter(Boolean) }));
  }
  function setCustom(text) { custom = parseCustom(text); return custom.length; }

  // 같은 문제가 너무 자주 나오지 않도록 과목별로 섞어서 차례로 꺼내요
  const decks = {};
  function draw(subject, list) {
    if (!decks[subject] || decks[subject].length === 0) {
      decks[subject] = list.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
    return list[decks[subject].pop()];
  }
  function reset() { for (const k in decks) delete decks[k]; }

  // ---------- 구글 시트 문제 (?sheet= 파라미터로 불러오면 시트 문제만 출제) ----------
  // 시트 문제 형식: { type: 'multiple' | 'ox' | 'short', text, options, answer, answers, explanation }
  let sheet = [], sheetLabel = '시트 문제';
  function setSheet(questions, label) { sheet = questions || []; if (label) sheetLabel = label; reset(); return sheet.length; }
  const hasSheet = () => sheet.length > 0;
  const label = k => SUBJECTS[k] || sheetLabel;

  // n: 지금까지 낸 문제 수 (수학 '자동' 난이도는 문제를 풀수록 조금씩 어려워져요)
  function pick(settings, n) {
    if (sheet.length) {
      const item = window.GameKit.shuffleQuestion(draw('sheet', sheet));
      return { subject: 'sheet', type: item.type, q: item.text, options: item.options, answer: item.answer, answers: item.answers, explanation: item.explanation };
    }
    let subjects = Object.keys(SUBJECTS).filter(s => settings.subjects[s]);
    if (subjects.includes('custom') && custom.length === 0) subjects = subjects.filter(s => s !== 'custom');
    if (subjects.length === 0) subjects = ['math'];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    let item;
    if (subject === 'math') {
      const level = settings.mathLevel === 'auto' ? Math.min(5, 1 + Math.floor(n / 4)) : Number(settings.mathLevel);
      item = makeMath(level);
    } else if (subject === 'custom') {
      item = draw('custom', custom);
    } else {
      item = draw(subject, BANK[subject]);
    }
    const options = [item.a, ...item.w.slice(0, 3)].sort(() => Math.random() - 0.5);
    return { subject, type: 'multiple', q: item.q, options, answer: options.indexOf(item.a) };
  }

  return { SUBJECTS, pick, reset, setCustom, parseCustom, setSheet, hasSheet, label, BANK };
})();
