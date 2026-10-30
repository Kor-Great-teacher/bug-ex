// 효과음과 배경음악: 녹음 파일 없이 Web Audio로 그 자리에서 만들어요
window.BugAudio = (() => {
  const KEY = 'bugex-audio-v1';
  let pref = { music: true, sfx: true, musicVol: 0.6, sfxVol: 0.6 }; // 소리 크기 0~1
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 기본값 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* 무시 */ } };

  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  const musicGain = () => pref.music ? 0.27 * pref.musicVol : 0;
  const sfxGain = () => pref.sfx ? 0.9 * pref.sfxVol : 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // 브라우저는 사용자가 누른 뒤에만 소리를 낼 수 있어서, 첫 클릭에서 준비해요
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicGain(); musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  }

  // ---------- 소리 재료 ----------
  function tone(o) {
    const { f, to, dur = 0.15, type = 'sine', vol = 0.3, at = 0, attack = 0.005, bus = sfxBus } = o;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(o) {
    const { dur = 0.15, filter = 'bandpass', f = 1500, to, q = 1, vol = 0.3, at = 0, bus = sfxBus } = o;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    fl.type = filter; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  const notes = (list, o = {}) => list.forEach((n, i) => tone({ f: midi(n), dur: o.dur || 0.14, type: o.type || 'square', vol: o.vol || 0.12, at: i * (o.step || 0.09) }));

  // ---------- 상황별 효과음 ----------
  const SFX = {
    // 퀴즈
    quiz: () => { tone({ f: 880, dur: 0.08, type: 'sine', vol: 0.12 }); tone({ f: 1175, dur: 0.12, type: 'sine', vol: 0.12, at: 0.08 }); },
    correct: () => notes([72, 76, 79, 84], { type: 'triangle', step: 0.07, vol: 0.16, dur: 0.2 }),
    wrong: () => { tone({ f: 220, dur: 0.18, type: 'square', vol: 0.09 }); tone({ f: 165, dur: 0.3, type: 'square', vol: 0.09, at: 0.16 }); },
    // 채집 · 코인 · 연구소
    catch: () => { noise({ dur: 0.18, filter: 'bandpass', f: 1200, to: 3000, vol: 0.12 }); notes([76, 79, 83, 88], { type: 'triangle', step: 0.06, vol: 0.13, at: 0.1 }); },
    legend: () => notes([72, 76, 79, 84, 79, 84, 88, 91], { type: 'square', step: 0.08, vol: 0.1, dur: 0.22 }),
    escape: () => { tone({ f: 900, to: 2400, dur: 0.25, type: 'sine', vol: 0.08 }); noise({ dur: 0.2, filter: 'highpass', f: 3000, vol: 0.05 }); },
    coin: () => { tone({ f: 988, dur: 0.07, type: 'square', vol: 0.07 }); tone({ f: 1319, dur: 0.2, type: 'square', vol: 0.07, at: 0.07 }); },
    upgrade: () => notes([60, 64, 67, 72, 76], { type: 'square', step: 0.06, vol: 0.09 }),
    select: () => tone({ f: 660, dur: 0.05, type: 'triangle', vol: 0.08 }),
    deny: () => tone({ f: 200, dur: 0.12, type: 'square', vol: 0.06 }),
    // 대결
    count: () => tone({ f: 660, dur: 0.12, type: 'square', vol: 0.09 }),
    go: () => { tone({ f: 1320, dur: 0.35, type: 'square', vol: 0.1 }); noise({ dur: 0.15, filter: 'highpass', f: 5000, vol: 0.06 }); },
    tap: () => tone({ f: 520 + Math.random() * 120, dur: 0.04, type: 'triangle', vol: 0.06 }),
    jump: () => tone({ f: 300, to: 900, dur: 0.18, type: 'sine', vol: 0.12 }),
    bump: () => { noise({ dur: 0.1, filter: 'lowpass', f: 900, to: 200, vol: 0.3 }); tone({ f: 140, to: 70, dur: 0.12, type: 'triangle', vol: 0.2 }); },
    splash: () => noise({ dur: 0.45, filter: 'bandpass', f: 1400, to: 500, q: 0.8, vol: 0.25 }),
    fall: () => tone({ f: 700, to: 120, dur: 0.5, type: 'sine', vol: 0.12 }),
    nectar: () => tone({ f: 1500, to: 2100, dur: 0.08, type: 'sine', vol: 0.08 }),
    wind: () => noise({ dur: 1.2, filter: 'bandpass', f: 500, to: 1400, q: 0.6, vol: 0.18 }),
    finish: () => notes([79, 84], { type: 'square', step: 0.08, vol: 0.09 }),
    win: () => notes([60, 64, 67, 72, 67, 72, 76, 79, 84], { type: 'square', step: 0.11, vol: 0.1, dur: 0.2 }),
    lose: () => notes([72, 67, 64, 60], { type: 'triangle', step: 0.16, vol: 0.13, dur: 0.28 }),
  };
  // 같은 소리가 너무 빨리 겹치지 않게 잠깐 간격을 둬요
  const GAP = { tap: 0.05, bump: 0.12, nectar: 0.06, wind: 0.8, splash: 0.3 };
  // 개미가 많을 때 소리가 겹쳐 시끄럽지 않게 같은 소리는 잠깐 간격을 둬요
  const lastAt = {};
  function play(name, opts) {
    if (!ctx || !pref.sfx || !SFX[name]) return;
    const now = ctx.currentTime;
    if (GAP[name] && now - (lastAt[name] || -1) < GAP[name]) return;
    lastAt[name] = now;
    try { SFX[name](opts); } catch (e) { /* 소리가 실패해도 게임은 계속 */ }
  }

  // ---------- 배경음악: 풀밭 산책 노래 (F - Dm - B♭ - C, 116 BPM, 8마디 반복) ----------
  const BPM = 116, STEP = 60 / BPM / 2; // 8분음표 길이
  const CHORDS = [[41, [53, 57, 60]], [38, [50, 53, 57]], [46, [58, 62, 65]], [48, [60, 64, 67]]];
  const MELODY = [
    [72, null, 69, 72, 77, null, 76, 74], [74, null, 72, 69, 65, null, 69, null],
    [70, null, 74, 77, 74, null, 70, 72], [72, 74, 76, 79, null, 76, 74, 72],
    [77, null, 77, 79, 81, 77, 72, null], [74, null, 77, 74, 69, null, 72, 74],
    [74, 77, 82, null, 77, null, 74, 70], [72, null, 67, 72, 76, null, null, null],
  ];
  let step = 0, nextTime = 0, timer = null;
  function musicNote(at, n, dur, type, vol) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.value = midi(n);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g); g.connect(musicBus); osc.start(at); osc.stop(at + dur + 0.02);
  }
  function musicDrum(at, kind) {
    if (kind === 'kick') {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(140, at); osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      osc.connect(g); g.connect(musicBus); osc.start(at); osc.stop(at + 0.2);
      return;
    }
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    fl.type = kind === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = kind === 'hat' ? 7000 : 1800;
    const vol = kind === 'hat' ? 0.18 : 0.5, dur = kind === 'hat' ? 0.04 : 0.12;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(fl); fl.connect(g); g.connect(musicBus); src.start(at, Math.random() * 0.5); src.stop(at + dur + 0.02);
  }
  function scheduleStep(i, at) {
    const bar = Math.floor(i / 8) % 8, pos = i % 8;
    const [root, triad] = CHORDS[bar % 4];
    // 베이스: 통통 튀는 근음-옥타브-5도
    const bass = [root, null, root + 12, null, root + 7, null, root + 12, null][pos];
    if (bass) musicNote(at, bass, STEP * 1.6, 'triangle', 0.5);
    // 반주: 엇박자 화음 (풀밭을 통통 걷는 느낌)
    if (pos % 2) triad.forEach(n => musicNote(at, n, STEP * 0.7, 'square', 0.06));
    // 멜로디
    const m = MELODY[bar][pos];
    if (m) musicNote(at, m, STEP * 1.7, 'triangle', 0.32);
    // 드럼
    if (pos === 0 || pos === 4) musicDrum(at, 'kick');
    if (pos === 2 || pos === 6) musicDrum(at, 'snare');
    musicDrum(at, 'hat');
  }
  function tick() {
    // 조금 앞서 예약해 두면 화면이 바빠도 박자가 흔들리지 않아요
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(step, nextTime);
      step = (step + 1) % 64; nextTime += STEP;
    }
  }
  function startMusic() {
    if (timer) return;
    nextTime = ctx.currentTime + 0.1; step = 0;
    timer = setInterval(tick, 40);
  }

  const apply = () => {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(sfxGain(), ctx.currentTime, 0.02);
  };
  function setMusic(on) { pref.music = on; save(); apply(); }
  function setSfx(on) { pref.sfx = on; save(); apply(); }
  const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
  function setMusicVolume(v) { pref.musicVol = clamp01(v); save(); apply(); }
  function setSfxVolume(v) { pref.sfxVol = clamp01(v); save(); apply(); }

  return {
    init, play, setMusic, setSfx, setMusicVolume, setSfxVolume,
    get music() { return pref.music; }, get sfx() { return pref.sfx; },
    get musicVolume() { return pref.musicVol; }, get sfxVolume() { return pref.sfxVol; },
  };
})();
