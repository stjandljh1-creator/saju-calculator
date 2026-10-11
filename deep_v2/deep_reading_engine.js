/* K Saju deep reading engine (browser + Node). Test build 2026-10-03.
 * Assembled from: calc_core_v2.js (chart math) + reading_engine_v4.js (sentence engine) -- see tools/make_web_engine.js.
 * Input chart comes from KSajuCore.calculate() (the same engine as the calculator). No network, no AI call, no storage.
 * Same input -> same output (variants are picked by a hash of the input, never by random numbers).
 */
(function (root, factory) {
  var NM, BANK;
  if (typeof module !== 'undefined' && module.exports) { NM = require('./en_names.js'); BANK = require('./fragments_en_ko_v2.json'); module.exports = factory(NM, BANK); }
  else { root.KDeepEngine = factory(root.KNames, root.KSAJU_FRAGMENTS); }
})(typeof window !== 'undefined' ? window : this, function (NM, BANK) {
'use strict';
// SHA-256 (first 32 bits only), same result as Node crypto so picks match the 10/1 samples
function sha32(str) {
  var enc = unescape(encodeURIComponent(str)), l = enc.length, w = [], i, j;
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  for (i = 0; i < l; i++) w[i >> 2] |= enc.charCodeAt(i) << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[(((l + 8) >> 6) << 4) + 15] = l * 8;
  function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
  for (var o = 0; o < w.length; o += 16) {
    var W = new Array(64), a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (j = 0; j < 64; j++) {
      if (j < 16) W[j] = w[o + j] | 0; else { var s0 = rr(W[j - 15], 7) ^ rr(W[j - 15], 18) ^ (W[j - 15] >>> 3), s1 = rr(W[j - 2], 17) ^ rr(W[j - 2], 19) ^ (W[j - 2] >>> 10); W[j] = (W[j - 16] + s0 + W[j - 7] + s1) | 0; }
      var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[j] + W[j]) | 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H[0] >>> 0;
}
// ---------------- chart math (from calc_core_v2.js)
const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const GAN_EL = {甲:'wood',乙:'wood',丙:'fire',丁:'fire',戊:'earth',己:'earth',庚:'metal',辛:'metal',壬:'water',癸:'water'};
const GAN_YANG = {甲:1,乙:0,丙:1,丁:0,戊:1,己:0,庚:1,辛:0,壬:1,癸:0};
const ZHI_EL = {子:'water',丑:'earth',寅:'wood',卯:'wood',辰:'earth',巳:'fire',午:'fire',未:'earth',申:'metal',酉:'metal',戌:'earth',亥:'water'};
const ELEMENTS = ['wood','fire','earth','metal','water'];
const GENERATES = {wood:'fire',fire:'earth',earth:'metal',metal:'water',water:'wood'};
const CONTROLS = {wood:'earth',fire:'metal',earth:'water',metal:'wood',water:'fire'};
// 월률분야 표(여기·중기·정기 순). 3단계 엔진 _internal.HIDDEN_DAYS 를 우선 사용, 없으면 같은 값 사본
const HIDDEN_DAYS_COPY = { 子: [['壬', 10], ['癸', 20]], 丑: [['癸', 9], ['辛', 3], ['己', 18]], 寅: [['戊', 7], ['丙', 7], ['甲', 16]], 卯: [['甲', 10], ['乙', 20]], 辰: [['乙', 9], ['癸', 3], ['戊', 18]], 巳: [['戊', 7], ['庚', 7], ['丙', 16]], 午: [['丙', 10], ['己', 9], ['丁', 11]], 未: [['丁', 9], ['乙', 3], ['己', 18]], 申: [['戊', 7], ['壬', 7], ['庚', 16]], 酉: [['庚', 10], ['辛', 20]], 戌: [['辛', 9], ['丁', 3], ['戊', 18]], 亥: [['戊', 7], ['甲', 7], ['壬', 16]] };
const HIDDEN_WEIGHT = { main: 1, middle: 0.5, residual: 0.3 }; // 우리 설정값
function hiddenWeighted(z) {
  const t = HIDDEN_DAYS_COPY;
  const row = t[z];
  if (row.length === 3) return [[row[0][0], HIDDEN_WEIGHT.residual], [row[1][0], HIDDEN_WEIGHT.middle], [row[2][0], HIDDEN_WEIGHT.main]];
  return [[row[0][0], HIDDEN_WEIGHT.residual], [row[1][0], HIDDEN_WEIGHT.main]];
}

// 십이운성: 라이브 계산기 diShiOf 와 같은 오프셋
const CS_OFFSET = {甲:1,丙:10,戊:10,庚:7,壬:4,乙:6,丁:9,己:9,辛:0,癸:3};
const CS = ['jangsaeng','mokyok','gwandae','geonrok','jewang','soe','byeong','sa','myo','jeol','tae','yang'];
// 3구간 묶음(설계 규칙): 드러남 = 장생·관대·건록·제왕 / 자라남 = 목욕·절·태·양 / 갈무리 = 쇠·병·사·묘
const CS_GROUP = {jangsaeng:'rising',gwandae:'rising',geonrok:'rising',jewang:'rising',mokyok:'forming',jeol:'forming',tae:'forming',yang:'forming',soe:'settling',byeong:'settling',sa:'settling',myo:'settling'};

function relationOf(de, te) {
  if (te === de) return 'bigyeop';
  if (GENERATES[te] === de) return 'inseong';
  if (GENERATES[de] === te) return 'siksang';
  if (CONTROLS[de] === te) return 'jaeseong';
  if (CONTROLS[te] === de) return 'gwanseong';
  return null;
}
const GOD_PAIR = {bigyeop:['bigyeon','geopjae'],siksang:['siksin','sanggwan'],jaeseong:['pyeonjae','jeongjae'],gwanseong:['pyeongwan','jeonggwan'],inseong:['pyeonin','jeongin']};
const GOD_CAT = {bigyeon:'bigyeop',geopjae:'bigyeop',siksin:'siksang',sanggwan:'siksang',pyeonjae:'jaeseong',jeongjae:'jaeseong',pyeongwan:'gwanseong',jeonggwan:'gwanseong',pyeonin:'inseong',jeongin:'inseong'};
const GOD_ORDER = ['bigyeon','geopjae','siksin','sanggwan','pyeonjae','jeongjae','pyeongwan','jeonggwan','pyeonin','jeongin'];
function tenGod(dayGan, otherGan) {
  const cat = relationOf(GAN_EL[dayGan], GAN_EL[otherGan]);
  return GAN_YANG[dayGan] === GAN_YANG[otherGan] ? GOD_PAIR[cat][0] : GOD_PAIR[cat][1];
}
function stage(dayGan, zhi) {
  const zi = ZHI.indexOf(zhi);
  let idx = CS_OFFSET[dayGan] + (GAN_YANG[dayGan] ? zi : -zi);
  idx = ((idx % 12) + 12) % 12;
  return CS[idx];
}

// 지지 관계표 (전통 이론: 육합·육충·삼합)
const LIUHE = [['子','丑'],['寅','亥'],['卯','戌'],['辰','酉'],['巳','申'],['午','未']];
const CHONG = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
const SANHE = [{t:['申','子','辰'],el:'water'},{t:['亥','卯','未'],el:'wood'},{t:['寅','午','戌'],el:'fire'},{t:['巳','酉','丑'],el:'metal'}];
const GANHE = [['甲','己'],['乙','庚'],['丙','辛'],['丁','壬'],['戊','癸']];
const isPair = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const isHe = (a, b) => isPair(LIUHE, a, b);
const isChong = (a, b) => isPair(CHONG, a, b);
const isGanHe = (a, b) => isPair(GANHE, a, b);
// v2 추가: 천간충(甲庚·乙辛·丙壬·丁癸), 방합, 삼형·자형·상형, 반합(왕지 포함 두 글자)
const GANCHONG = [['甲','庚'],['乙','辛'],['丙','壬'],['丁','癸']];
const isGanChong = (a, b) => isPair(GANCHONG, a, b);
const FANGHE = [{t:['寅','卯','辰'],el:'wood'},{t:['巳','午','未'],el:'fire'},{t:['申','酉','戌'],el:'metal'},{t:['亥','子','丑'],el:'water'}];
const SANXING = [['寅','巳','申'],['丑','戌','未']];
const ZIXING = ['辰','午','酉','亥'];
const WANGJI = { water: '子', wood: '卯', fire: '午', metal: '酉' };
function xingPair(a, b) { // 두 글자 사이 형(刑)
  if (a === b) return ZIXING.includes(a) ? 'zixing' : null;
  if (isPair([['子','卯']], a, b)) return 'xiangxing';
  if (SANXING.some(t => t.includes(a) && t.includes(b))) return 'sanxing';
  return null;
}

function seasonOf(monthZhi) {
  if ('寅卯辰'.includes(monthZhi)) return 'spring';
  if ('巳午未'.includes(monthZhi)) return 'summer';
  if ('申酉戌'.includes(monthZhi)) return 'autumn';
  return 'winter';
}
function ganzhiStep(gz, step) {
  const gi = GAN.indexOf(gz[0]), zi = ZHI.indexOf(gz[1]);
  return GAN[((gi + step) % 10 + 10) % 10] + ZHI[((zi + step) % 12 + 12) % 12];
}


// 입력: input = {y,m,d(양력 생일), h, mi, timeUnknown, dir: 'male'|'female'|'notsure', asOf:'YYYY-MM-DD'}, X = KSajuCore.calculate() 결과
function computeChart(input, X) {
  const tu = !!input.timeUnknown;
  const P = { year: X.pillars.year, month: X.pillars.month, day: X.pillars.day, time: X.pillars.time };
  const pillars = { year: P.year, month: P.month, day: P.day };
  if (!tu) pillars.hour = P.time;
  const dg = pillars.day[0];
  const dEl = GAN_EL[dg];
  // 오행 개수 (글자당 1점, 8글자 또는 6글자)
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const pk = tu ? ['year', 'month', 'day'] : ['year', 'month', 'day', 'hour'];
  pk.forEach(p => { counts[GAN_EL[pillars[p][0]]]++; counts[ZHI_EL[pillars[p][1]]]++; });
  const total = pk.length * 2;
  const lacking = ELEMENTS.filter(e => counts[e] === 0);
  const excess = ELEMENTS.filter(e => counts[e] / total >= 0.375); // 태과 = 보이는 글자의 37.5% 이상(8자 중 3, 6자 중 3)

  // 신강·신약 (라이브 계산기 renderStrength 와 같은 규칙)
  const helps = el => { const r = relationOf(dEl, el); return r === 'bigyeop' || r === 'inseong'; };
  const deugRyeong = helps(ZHI_EL[pillars.month[1]]);
  const deugJi = helps(ZHI_EL[pillars.day[1]]);
  const rest = [ZHI_EL[pillars.year[1]]]; if (!tu) rest.push(ZHI_EL[pillars.hour[1]]);
  const deugSe = rest.filter(helps).length / rest.length >= 0.5;
  const chars = [dEl, ZHI_EL[pillars.day[1]], GAN_EL[pillars.year[0]], ZHI_EL[pillars.year[1]], GAN_EL[pillars.month[0]], ZHI_EL[pillars.month[1]]];
  if (!tu) chars.push(GAN_EL[pillars.hour[0]], ZHI_EL[pillars.hour[1]]);
  const helpCount = chars.filter(el => el === dEl || helps(el)).length;
  const support = (deugRyeong ? 1 : 0) + (deugJi ? 1 : 0) + (deugSe ? 1 : 0);
  let strengthLive;
  if (support >= 2 && helpCount >= chars.length / 2) strengthLive = 'strong';
  else if (support <= 1 && helpCount < chars.length / 2) strengthLive = 'weak';
  else strengthLive = 'balanced';
  // 3단계 엔진이 있으면 그 판정(위치 가중 점수)을 씀. 없으면 라이브 계산기 방식
  const strength = X ? ({ '신강': 'strong', '신약': 'weak', '중화': 'balanced' })[X.strength.verdict] : strengthLive;
  const strengthMethod = X ? 'score' : 'count';
  const strengthScore = X ? X.strength.score : null;

  // 십신 개수 (천간 = 일간 제외, 지지 = 지장간 전부; 라이브 계산기 renderSipsin 과 같은 셈)
  // v2: 십신 세기 = 천간 1 + 지장간 가중치(정기 1 / 중기 0.5 / 여기 0.3, 우리 설정값). 지장간 구성은 3단계 엔진 표(월률분야 여기·중기·정기)
  const godCount = {}; GOD_ORDER.forEach(g => godCount[g] = 0);
  const catCount = { bigyeop: 0, siksang: 0, jaeseong: 0, gwanseong: 0, inseong: 0 };
  const add = (g, w) => { godCount[g] += w; catCount[GOD_CAT[g]] += w; };
  pk.forEach(p => {
    if (p !== 'day') add(tenGod(dg, pillars[p][0]), 1);
    hiddenWeighted(pillars[p][1]).forEach(([hg, w]) => add(tenGod(dg, hg), w));
  });
  GOD_ORDER.forEach(g => godCount[g] = Math.round(godCount[g] * 10) / 10);
  Object.keys(catCount).forEach(c => catCount[c] = Math.round(catCount[c] * 10) / 10);
  const mainGod = z => tenGod(dg, HIDE[z][0]);
  let dominant = 'even', maxN = 1.5; // 1.5 미만이면 두드러진 것 없음
  GOD_ORDER.forEach(g => { if (godCount[g] >= maxN && (dominant === 'even' || godCount[g] > godCount[dominant])) { dominant = g; } });

  // 원국 지지 관계
  const natalRel = [];
  for (let i = 0; i < pk.length; i++) for (let j = i + 1; j < pk.length; j++) {
    const a = pillars[pk[i]][1], b = pillars[pk[j]][1];
    if (isHe(a, b)) natalRel.push({ type: 'he', p1: pk[i], p2: pk[j], b1: a, b2: b });
    if (isChong(a, b)) natalRel.push({ type: 'chong', p1: pk[i], p2: pk[j], b1: a, b2: b });
  }


  // 대운 (3단계 엔진 결과를 그대로 씀: 3일=1년, 반올림 만 나이)
  const by = input.y;
  let dy = null;
  const fromX = L => ({ forward: L.forward, jieName: L.fromTerm, days: +(L.minutesToTerm / 1440).toFixed(3), exactYears: L.exactYears, startAge: L.startAge,
    cycles: L.cycles.slice(0, 9).map(c => ({ k: c.index, gz: c.ganzhi, gan: c.ganzhi[0], zhi: c.ganzhi[1], ageStart: c.startAge, ageEnd: c.endAge, yearStart: by + c.startAge, yearEnd: by + c.endAge })) });
  if (input.dir === 'male' || input.dir === 'female') {
    dy = { mode: 'single', main: fromX(X.luck[input.dir]) };
  } else {
    const a = fromX(X.luck.male), b = fromX(X.luck.female);
    dy = { mode: 'both', forward: a.forward ? a : b, backward: a.forward ? b : a };
  }
  const [ay, am, ad] = (input.asOf || '2026-09-30').split('-').map(Number);
  const age = ay - input.y - ((am < input.m || (am === input.m && ad < input.d)) ? 1 : 0);
  return {
    input, timeUnknown: tu, pillars, dayGan: dg, dayEl: dEl, dayYang: GAN_YANG[dg],
    counts, total, lacking, excess,
    strength, strengthMethod, strengthScore, strengthDetail: { deugRyeong, deugJi, deugSe, helpCount, totalChars: chars.length, support },
    godCount, catCount, dominant,
    monthMainGod: mainGod(pillars.month[1]), dayBranchGod: mainGod(pillars.day[1]),
    dayBranchStage: stage(dg, pillars.day[1]),
    season: seasonOf(pillars.month[1]), cusp: '辰未戌丑'.includes(pillars.month[1]), natalRel, dy, age, strengthExtreme: X ? (X.strength.score >= 80 || X.strength.score <= 20) : false, minor: age < 14,
  };
}
const HIDE = {}; Object.keys(HIDDEN_DAYS_COPY).forEach(z => { const r = HIDDEN_DAYS_COPY[z]; HIDE[z] = [r[r.length - 1][0]]; }); // 정기(본기) 글자
const C = { computeChart, tenGod, stage, relationOf, isHe, isChong, isGanHe, isGanChong, FANGHE, SANXING, ZIXING, WANGJI, xingPair, SANHE, CS_GROUP, GAN_EL, ZHI_EL, GAN_YANG,
  ELEMENTS, GENERATES, CONTROLS, GOD_CAT, GOD_ORDER, HIDE };

// ---------------- sentence engine (from reading_engine_v4.js)
const L = BANK.labels, BD = BANK.bundles;

const YEARS = [{ y: 2026, gz: '丙午' }, { y: 2027, gz: '丁未' }];
const ORDER_EL = ['wood', 'fire', 'earth', 'metal', 'water'];
const CATS = ['bigyeop', 'siksang', 'jaeseong', 'gwanseong', 'inseong'];
const CAT_FAMILY = { bigyeop: ['peer symbols', '비겁'], siksang: ['expression symbols', '식상'], jaeseong: ['wealth symbols', '재성'], gwanseong: ['authority symbols', '관성'], inseong: ['nurture symbols', '인성'] };
const PKO = { year: '연주', month: '월주', day: '일주', hour: '시주' };
const ZKO_P = { year: '연지', month: '월지', day: '일지', hour: '시지' };
const GKO_P = { year: '연간', month: '월간', day: '일간', hour: '시간(時干)' };
const STR = {
  strong: { verb: 'shows a lot of self-energy', label: 'Strong self-energy', ko: '신강' },
  balanced: { verb: 'is balanced (our middle range)', label: 'Balanced (our middle range)', ko: '중화(우리 체계의 중간 구간)' },
  weak: { verb: 'leans on support', label: 'Leans on support', ko: '신약' },
};
const SOFT_NOTE = ['byeong', 'sa', 'myo', 'jeol'];
const STAGE_PLAIN = { jangsaeng: 'the stage of fresh growth', mokyok: 'an unsettled, exploring stage', gwandae: 'the stage of stepping out into the world', geonrok: 'a self-supporting, working stage', jewang: 'the fullest stage', soe: 'a calmer stage just past the peak', byeong: 'a slowing, reflective stage', sa: 'a still, resting stage', myo: 'a storing-up, keeping stage', jeol: 'a clean-break stage before something new', tae: 'the stage where new plans form quietly', yang: 'a stage of being looked after and growing inside' };
const STAGE_PLAIN_KO = { jangsaeng: '새로 자라나는 단계', mokyok: '들뜨고 탐색하는 단계', gwandae: '세상에 나설 채비를 하는 단계', geonrok: '스스로 서서 일하는 단계', jewang: '가장 힘이 찬 단계', soe: '정점을 지나 차분해진 단계', byeong: '속도를 늦추고 돌아보는 단계', sa: '멈추어 쉬는 단계', myo: '모아 두고 간직하는 단계', jeol: '새로 시작하기 전 정리하는 단계', tae: '새 계획이 조용히 생기는 단계', yang: '보살핌 속에 안에서 자라는 단계' };
const stgSlots = st => ({ stg: { en: STAGE_PLAIN[st], ko: STAGE_PLAIN_KO[st] }, stgNote: L.stageNote.none }); // [plain 10/3] description only, each stage different
const TRAD = { 惊蛰: '驚蟄', 芒种: '芒種' };
const trad = n => TRAD[n] || n;
// English names of the 12 solar terms that start a Saju month (no Chinese characters in English text)
const TERM_EN = { 立春: 'Start of Spring', 惊蛰: 'Awakening of Insects', 驚蟄: 'Awakening of Insects', 清明: 'Clear and Bright', 立夏: 'Start of Summer', 芒种: 'Grain in Ear', 芒種: 'Grain in Ear', 小暑: 'Minor Heat', 立秋: 'Start of Autumn', 白露: 'White Dew', 寒露: 'Cold Dew', 立冬: 'Start of Winter', 大雪: 'Major Snow', 小寒: 'Minor Cold' };
const termEn = n => { if (!TERM_EN[n]) throw new Error('solar term name missing: ' + n); return TERM_EN[n]; };
const stageNameEn = st => STAGE_PLAIN[st]; // [plain 10/3]

function inputKey(inp) {
  const t = inp.timeUnknown ? 'U' : `${String(inp.h).padStart(2, '0')}:${String(inp.mi || 0).padStart(2, '0')}`;
  return `${inp.y}-${String(inp.m).padStart(2, '0')}-${String(inp.d).padStart(2, '0')}|${t}|${inp.dir}|${inp.asOf || '2026-09-30'}`;
}
function hpick(key, id, n) {
  if (n <= 1) return 0;
  return sha32(key + '|' + id) % n;
}
// 한국어 조사 자동 맞춤
const KO_ANI = { 子: '쥐', 丑: '소', 寅: '호랑이', 卯: '토끼', 辰: '용', 巳: '뱀', 午: '말', 未: '양', 申: '원숭이', 酉: '닭', 戌: '개', 亥: '돼지' }; const KO_STEL = { 甲: '나무', 乙: '나무', 丙: '불', 丁: '불', 戊: '흙', 己: '흙', 庚: '쇠', 辛: '쇠', 壬: '물', 癸: '물' }; const KO_NOUNS = '동물|기운|중심 기운|양|말|용|닭|쥐|소|호랑이|토끼|뱀|원숭이|개|돼지|불|흙|쇠|물|나무|단계'; const koFixJosa = t => String(t).replace(new RegExp('(' + KO_NOUNS + ')(은|는|이|가|을|를|과|와)(?=[\\s,.;:)!?]|$)', 'g'), (m, w, j) => { const c = w.charCodeAt(w.length - 1), has = (c - 0xAC00) % 28 !== 0; const map = { 은: has ? '은' : '는', 는: has ? '은' : '는', 이: has ? '이' : '가', 가: has ? '이' : '가', 을: has ? '을' : '를', 를: has ? '을' : '를', 과: has ? '과' : '와', 와: has ? '과' : '와' }; return w + map[j]; }); const koPost = t => String(t).replace(/대장간/g, '용광로').replace(/재성/g, '재물 신호').replace(/관성/g, '책임 신호').replace(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/g, (m, a, b) => KO_STEL[a] + '의 ' + KO_ANI[b]).replace(/([子丑寅卯辰巳午未申酉戌亥])(?=[子丑寅卯辰巳午未申酉戌亥])/g, '$1·').replace(/[子丑寅卯辰巳午未申酉戌亥]/g, c => KO_ANI[c]).replace(/[甲乙丙丁戊己庚辛壬癸]/g, c => ('甲丙戊庚壬'.indexOf(c) >= 0 ? '양의 ' : '음의 ') + KO_STEL[c]).replace(/\s*\([^()]*[㐀-鿿][^()]*\)/g, '').replace(/[㐀-鿿](?=\s+[A-Z])\s+/g, '').replace(/[㐀-鿿]/g, c => HANJA_READ[c] || c); /* [plain 10/3] Korean: drop bracketed hanja, read the rest */ const KO_GOD = { 비견: '내 발로 서는 힘', 겁재: '경쟁심', 식신: '만들고 즐기는 힘', 상관: '솔직한 표현', 편재: '기회를 잡는 힘', 정재: '꾸준한 결과', 편관: '도전에 맞서는 힘', 정관: '책임과 질서', 편인: '남다른 이해', 정인: '배우고 보살핌받는 힘' }; const KO_STAGE = { 장생: '새로 자라나는 단계', 목욕: '들뜨고 탐색하는 단계', 관대: '세상에 나설 채비 단계', 건록: '스스로 서서 일하는 단계', 제왕: '가장 힘이 찬 단계', 쇠: '정점을 지난 단계', 병: '속도를 늦추는 단계', 사: '멈추어 쉬는 단계', 묘: '간직하는 단계', 절: '정리하는 단계', 태: '계획이 생기는 단계', 양: '안에서 자라는 단계' }; const koWhyPlain = t => String(t).replace(/일간\\(태어난 날을 대표하는 기운\\)/g, '나의 중심 기운').replace(/월지\\(태어난 달\\)/g, '태어난 달의 동물').replace(/일간/g, '나의 중심 기운').replace(/월지/g, '태어난 달의 동물').replace(/일지/g, '태어난 날의 동물').replace(/시지/g, '태어난 시의 동물').replace(/연지/g, '태어난 해의 동물').replace(/월간/g, '태어난 달의 기운').replace(/시간\\(時干\\)|시간(?=[:：])/g, '태어난 시의 기운').replace(/천간/g, '해의 기운').replace(/지지/g, '동물').replace(/본기/g, '주된 기운').replace(/(비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)(?![가-힣])/g, m => KO_GOD[m]).replace(/(장생|목욕|관대|건록|제왕)(?![가-힣])/g, m => KO_STAGE[m]).split('(태어난 날을 대표하는 기운)').join('').split('(태어난 달)').join('').replace(/방합/g, '계절 세 동물 묶음').replace(/삼합/g, '세 동물 묶음').replace(/반합/g, '반쪽 묶음').replace(/육합/g, '짝').replace(/복음/g, '같은 간지 되풀이').replace(/(?<![가-힣])충(?![가-힣])/g, '부딪침').replace(/(?<![가-힣])형(?![가-힣])/g, '마찰').replace(/자형/g, '같은 동물 마찰').replace(/천간합/g, '기운끼리 짝').replace(/천간충/g, '기운끼리 부딪침').replace(/일주/g, '태어난 날').replace(/월주/g, '태어난 달').replace(/연주/g, '태어난 해').replace(/시주/g, '태어난 시').replace(/(쥐|소|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)(쥐|소|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)(쥐|소|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)?/g, (m, x, y, z) => [x, y, z].filter(Boolean).join('·')).replace(/재성/g, '재물 신호').replace(/관성/g, '책임 신호').replace(/절입/g, '계절이 바뀌는 날').replace(/신강/g, '스스로의 기운이 넉넉함').replace(/신약/g, '도움이 힘이 되는 사주').replace(/중화/g, '고르게 균형');
const HANJA_READ = { 甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계',子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해',木:'목',火:'화',土:'토',金:'금',水:'수' };
const DIGIT_READ = { 0:'영',1:'일',2:'이',3:'삼',4:'사',5:'오',6:'육',7:'칠',8:'팔',9:'구' };
function finalOf(prefix) {
  let t = prefix.replace(/\s+$/, '');
  while (t.endsWith(')') && t.lastIndexOf('(') > 0) t = t.slice(0, t.lastIndexOf('('));
  let c = t.slice(-1);
  if (HANJA_READ[c]) c = HANJA_READ[c]; else if (DIGIT_READ[c]) c = DIGIT_READ[c];
  const code = c.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return { has: false, rieul: false };
  const f = (code - 0xAC00) % 28;
  return { has: f !== 0, rieul: f === 8 };
}
function josa(str) {
  const re = /(이\(가\)|은\(는\)|을\(를\)|와\(과\)|과\(와\)|\(으\)로|\(이\)에요|\(이\)라)/;
  let out = '', rest = str, m;
  while ((m = re.exec(rest))) {
    const pre = out + rest.slice(0, m.index);
    const f = finalOf(pre);
    const pick = { '이(가)': f.has ? '이' : '가', '은(는)': f.has ? '은' : '는', '을(를)': f.has ? '을' : '를', '와(과)': f.has ? '과' : '와', '과(와)': f.has ? '과' : '와', '(으)로': (f.has && !f.rieul) ? '으로' : '로', '(이)라': f.has ? '이라' : '라', '(이)에요': f.has ? '이에요' : '예요' }[m[0]];
    out = pre + pick; rest = rest.slice(m.index + m[0].length);
  }
  return out + rest;
}
const plainPost = t => String(t).replace(/"([,.])(?=\s|$)/g, '$1"')
  .replace(/\(yang (Wood|Fire|Earth|Metal|Water)\)/g, '(bold $1)').replace(/\(yin (Wood|Fire|Earth|Metal|Water)\)/g, '(gentle $1)')
  .replace(/(^|[^0-9])1 times/g, '$1once').replace(/(^|[^0-9])2 times/g, '$1twice')
  .replace(/visible characters/g, 'characters').replace(/characters showing in your chart/g, 'parts of your chart').replace(/(\d+|eight|six|its \d+|its eight|its six) characters/g, '$1 parts')
  .replace(/In Korean tradition,/g, 'Traditionally,')
  .replace(/(^|[^0-9])1 years(?![a-z])/g, '$11 year').replace(/(^|\s)([Aa]) (Ox|Oak|Ivy|Ocean)(?![a-z])/g, '$1$2n $3').replace(/theme of the theme of /g, 'theme of ').replace(/the the /g, 'the ')
  .replace(/^([a-z])/, m => m.toUpperCase()).replace(/([.!?:] )([a-z])(?=[a-z]* )/g, (m, a, b) => a === ': ' ? m : a + b.toUpperCase())
  .replace(/(\w)'(\w)/g, '$1’$2').replace(/(^|[\s(\[])"/g, '$1“').replace(/"/g, '”'); // [plain 10/3]
function fill(tpl, slots, lang) {
  const out = tpl.replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in slots)) return m;
    const v = slots[k];
    return (v && typeof v === 'object') ? v[lang] : String(v);
  });
  return lang === 'ko' ? koFixJosa(josa(koPost(out))) : plainPost(NM.slotClean(out));
}

// 한 사람 풀이 안에서 같은 영어 문장이 두 번 나오지 않게: 이미 쓴 문장이면 다음 변형 → 대체 묶음 순으로
// 만 14세 미만: 직장·돈 표현을 학교·친구 표현으로 바꾸는 문장 단위 치환표 (영어 / 한국어). 풀이 구조는 그대로.
const MINOR_EN = [
  [/friend or coworker/g, 'friend or classmate'], [/\bcoworkers\b/g, 'classmates'], [/\bcoworker\b/g, 'classmate'],
  [/As noted in Love & Relationships, expression has/g, 'Expression has'],
  [/work, colleagues, and daily routine/g, 'school, classmates, and daily routine'], [/work and daily decisions/g, 'school and daily decisions'], [/where you work/g, 'where you study'], [/steady earnings and results/g, 'steady effort and results'],
  [/Colleagues and acquaintances/g, 'Classmates and friends'], [/\bcolleagues\b/g, 'classmates'], [/\bColleagues\b/g, 'Classmates'],
  [/ask your manager, a teacher, or a mentor/g, 'ask a teacher, a coach, or a parent'],
  [/at work or at home/g, 'at school or at home'],
  [/building wealth and managing real-world results/g, 'taking care of practical things and seeing real results'],
  [/practical goals and money taking more of your attention/g, 'practical goals and saving up taking more of your attention'],
  [/new titles, standards, and the chance to be trusted with more/g, 'new roles, standards, and the chance to be trusted with more'],
  [/steady earnings and results/g, 'steady effort and results'], [/steady-earnings energy/g, 'steady-effort energy'],
  [/study, qualifications, and help from mentors/g, 'study, tests, and help from teachers'],
  [/deepening skills, earning credentials, and learning from people with more experience/g, 'deepening skills, reaching your own milestones, and learning from people with more experience'],
  [/your three biggest recurring expenses or time costs/g, 'your three biggest time costs'],
  [/building wealth/g, 'building good habits'],
  [/wealth and practical results/g, 'practical things and real results'],
  [/bring peers into the story/g, 'bring kids your age into the story'], [/shaped by peers, such as/g, 'shaped by kids your age, such as'],
  [/one peer/g, 'one friend'], [/through credentials, expertise/g, 'through good results, know-how'],
];
const MINOR_KO = [
  [/친구나 동료/g, '친구나 반 친구'],
  [/사랑과 관계 칸에서 본 것처럼 사주에/g, '사주에'],
  [/일과 동료, 일상의 흐름/g, '학교와 반 친구들, 일상의 흐름'], [/일과 일상의 결정/g, '학교와 일상의 결정'], [/일하는 곳에/g, '공부하는 곳에'], [/꾸준한 수입과 결과/g, '꾸준한 노력과 결과'],
  [/재물과 실제 결과/g, '현실적인 일과 실제 결과'],
  [/동료들은/g, '반 친구들은'], [/동료들이/g, '반 친구들이'], [/동료를/g, '친구를'], [/동료들을/g, '친구들을'], [/동료/g, '친구'],
  [/상사나 스승에게/g, '선생님이나 코치, 부모님에게'],
  [/일터나 집에서/g, '학교나 집에서'],
  [/재산을 쌓고 현실의 결과를 관리하는 일/g, '현실적인 일을 챙기고 결과를 눈으로 확인하는 일'],
  [/현실적인 목표와 돈 문제가/g, '현실적인 목표와 모으는 일이'],
  [/새 직함과 기준/g, '새 역할과 기준'],
  [/공부와 자격, 스승의 도움/g, '공부와 시험, 선생님의 도움'], [/재물/g, '현실적인 일'], [/재산/g, '모아 둔 것'], [/자격/g, '실력'], [/돈/g, '현실적인 일'],
  [/실력을 깊게 하고 자격을 쌓고/g, '실력을 깊게 하고 나만의 이정표를 세우고'],
  [/반복해서 드는 큰 지출이나 시간 비용 세 가지/g, '시간이 많이 드는 일 세 가지'],
];
const minorize = (t, tbl) => tbl.reduce((a, [re, to]) => a.replace(re, to), t);
function makeEmitter(key, minor, young) {
  const used = new Set();
  function build(id, slots, extraTags, i) {
    const b = BD[id];
    let en = fill(b.v[i].en, slots, 'en'), ko = fill(b.v[i].ko, slots, 'ko');
    if (minor) { en = minorize(en, MINOR_EN); ko = minorize(ko, MINOR_KO); }
    return { id, variant: i, tags: [...b.tags, ...extraTags], en, ko };
  }
  function emit(id, slots = {}, extraTags = [], opt = {}) {
    const ids = [id, ...(opt.alts || [])].map(c => (young && BD[c + '@young']) ? c + '@young' : (minor && BD[c + '@minor']) ? c + '@minor' : c);
    for (const cid of ids) {
      const b = BD[cid];
      if (!b) throw new Error('없는 문장 묶음: ' + cid);
      const start = hpick(key, cid + (opt.salt || ''), b.v.length);
      for (let k = 0; k < b.v.length; k++) {
        const r = build(cid, slots, extraTags, (start + k) % b.v.length);
        if (!used.has(r.en)) { used.add(r.en); return r; }
      }
    }
    const lastId = ids[0];
    const r = build(lastId, slots, extraTags, hpick(key, lastId, BD[lastId].v.length)); // 대체가 없으면 그대로(검사에서 잡힘)
    used.add(r.en); return r;
  }
  return emit;
}
const WHY_PLAIN = [
  [/Day Master \(the main character of the day you were born\)/g, 'your core element (from the day you were born)'],
  [/with a month branch \(the month you were born\) of (\w+)/g, 'in a $1 month'],
  [/month branch \(the month you were born\) (\w+), main hidden stem:/g, 'your birth month ($1 month) mainly carries the theme of'],
  [/month branch (\w+), main hidden stem:/g, 'your birth month ($1 month) mainly carries the theme of'],
  [/day branch (\w+), the partner seat, holds/g, 'the animal of the day you were born ($1), which traditionally speaks for close partnership, carries the theme of'],
  [/day branch (\w+), the seat for close relationships, holds/g, 'the animal of the day you were born ($1), which traditionally speaks for close relationships, carries the theme of'],
  [/the energy that shows up most when every position is counted, hidden ones included \(each position weighted by our own settings\):/g, 'the trait that shows up most when every part of your chart is counted (weighted by our own settings):'],
  [/(\d{4}) stem (bold|gentle) (\w+) acts as/g, '$1’s element ($2 $3) points toward'],
  [/; branch (\w+) at ([^;]+);/g, '; its animal ($1) sits at $2;'],
  [/month stem:/g, 'birth-month element:'], [/day branch:/g, 'birth-date animal:'], [/hour stem:/g, 'birth-hour element:'],
  [/solar term/g, 'seasonal marker'],
  [/repeated pillar with (\w+) pillar/g, 'the same pair as your birth $1'],
  [/three-penalty pattern/g, 'three-animal tension pattern'], [/three-branch harmony/g, 'three-animal trio'],
  [/seasonal group/g, 'seasonal trio'], [/half harmony with (\w+) pillar/g, 'half trio with your birth-$1 animal'],
  [/self-penalty with (\w+) pillar/g, 'same-animal match with your birth-$1 animal'],
  [/stem combination with (\w+) pillar/g, 'element pairing with your birth-$1 element'],
  [/stem clash with (\w+) pillar/g, 'element push with your birth-$1 element'],
  [/combination with (\w+) pillar/g, 'pairing with your birth-$1 animal'],
  [/clash with (\w+) pillar/g, 'clash with your birth-$1 animal'],
  [/penalty with (\w+) pillar/g, 'friction with your birth-$1 animal'],
  [/no combination, clash, or penalty found/g, 'no strong link with your chart'],
  [/wealth and authority symbols/g, 'the money and responsibility signals'],
  [/wealth symbols/g, 'money signals'], [/authority symbols/g, 'responsibility signals'],
  [/peer symbols/g, 'independence signals'], [/expression symbols/g, 'self-expression signals'], [/nurture symbols/g, 'learning-and-support signals'],
  [/lean Wage/g, 'lean toward steady effort'], [/lean Hustle/g, 'lean toward opportunities'], [/lean Duty/g, 'lean toward steady responsibility'], [/lean Pressure/g, 'lean toward challenges'], [/lean Challenge/g, 'lean toward challenges'],
  [/visible characters/g, 'characters showing in your chart'],
  [/your strength check:/g, 'our strength check:'],
  [/Strong self-energy/g, 'plenty of your own energy'], [/Leans on support/g, 'thrives with support'], [/Balanced \(our middle range\)/g, 'evenly balanced'],
  [/shows a lot of self-energy/g, 'has plenty of its own energy'], [/leans on support/g, 'thrives with support'], [/is balanced \(our middle range\)/g, 'is evenly balanced'],
  [/clash between (\w+) and (\w+)/g, 'a clash between the $1 and the $2 in your chart'],
];
const whyPlain = t => plainPost(WHY_PLAIN.reduce((a, [re, to]) => a.replace(re, to), t));
function whyRec(en, ko, tags = []) { return { id: 'WHY', variant: 0, tags, en: 'Why we say this: ' + whyPlain(NM.slotClean(en)), ko: '근거: ' + josa(koPost(ko)) }; }

const catOf = g => C.GOD_CAT[g];
const GOD_PLAIN = { bigyeon: 'independence', geopjae: 'a competitive streak', siksin: 'making and enjoying things', sanggwan: 'speaking your mind', pyeonjae: 'spotting opportunities', jeongjae: 'steady, practical effort', pyeongwan: 'rising to challenges', jeonggwan: 'responsibility and order', pyeonin: 'seeing things in an unusual way', jeongin: 'learning and being cared for' };
const godEn = g => GOD_PLAIN[g], godKo = g => L.god[g].ko; // [plain 10/3] English shows the plain trait, not the energy name
const elEn = e => L.el[e].en, elKo = e => L.el[e].ko;
const fmtN = n => (Math.round(n * 10) / 10).toString();
// 십신 이름 + 쉬운 뜻풀이 (이름은 계산기와 같게 두고, 괄호로 풀이를 붙임. 영어: "Rebel energy (sharp expression)")
const GOD_GLOSS = { bigyeon: ['standing on your own feet', '내 발로 서는 힘'], geopjae: ['competitive drive', '경쟁심과 승부욕'], siksin: ['making and enjoying', '만들고 즐기는 힘'], sanggwan: ['sharp expression', '날카로운 표현'], pyeonjae: ['seizing opportunity', '기회를 잡는 힘'], jeongjae: ['steady earnings and results', '꾸준한 수입과 결과'], pyeongwan: ['rising to a challenge', '도전에 맞서는 힘'], jeonggwan: ['responsibility and order', '책임과 질서'], pyeonin: ['unusual understanding', '남다른 이해'], jeongin: ['learning and receiving care', '배우고 보살핌받는 힘'] };
const godX = g => ({ en: GOD_PLAIN[g], ko: GOD_GLOSS[g][1] }); // [plain 10/3] 한국어도 이름 대신 뜻
// 대운 시작 나이 표현: 0세면 "at birth / 태어날 때부터"
const startTxt = n => n === 0 ? { en: 'at birth', ko: '태어날 때부터' } : { en: `at about age ${n}`, ko: `대략 ${n}세에` };
const startTxtR = n => n === 0 ? { en: 'at birth', ko: '태어날 때부터' } : { en: `at about age ${n} (rounded to the nearest year)`, ko: `대략 ${n}세(반올림)에` };
const CUSP_NEXT = { 辰: ['spring', 'summer', '봄', '여름'], 未: ['summer', 'autumn', '여름', '가을'], 戌: ['autumn', 'winter', '가을', '겨울'], 丑: ['winter', 'spring', '겨울', '봄'] };
const seasonWhy = ch => ch.cusp ? { en: `the final month of ${CUSP_NEXT[ch.pillars.month[1]][0]}, leading into ${CUSP_NEXT[ch.pillars.month[1]][1]}`, ko: `${CUSP_NEXT[ch.pillars.month[1]][2]}의 마지막 달, ${CUSP_NEXT[ch.pillars.month[1]][3]}(으)로 이어지는 환절기` } : { en: ch.season, ko: L.season[ch.season].ko };

// 균형 오행 목록: 억부(강약) + 조후(여름 물·겨울 불), 이미 태과인 오행은 뺌. 4칸 채점과 11칸 조언이 같은 목록을 씀
function helpfulSet(ch) {
  const d = ch.dayEl;
  const res = ORDER_EL.find(e => C.GENERATES[e] === d);
  const out = C.GENERATES[d], wealth = C.CONTROLS[d], officer = ORDER_EL.find(e => C.CONTROLS[e] === d);
  let H;
  if (ch.strength === 'weak') H = [d, res];
  else if (ch.strength === 'strong') H = [out, wealth, officer];
  else if (ch.lacking.length) H = ch.lacking.slice();
  else { const min = Math.min(...ORDER_EL.map(e => ch.counts[e])); H = ORDER_EL.filter(e => ch.counts[e] === min); }
  H = [...new Set(H)].filter(e => !ch.excess.includes(e)); // v3: 조후는 억부 목록과 같은 방향일 때만(이미 목록에 있을 때만) 반영
  if (!H.length) { const min = Math.min(...ORDER_EL.map(e => ch.counts[e])); H = ORDER_EL.filter(e => ch.counts[e] === min); }
  return H;
}
function cycleScore(ch, cyc, H) {
  let s = 0;
  if (H.includes(C.GAN_EL[cyc.gan])) s += 1;
  if (H.includes(C.ZHI_EL[cyc.zhi])) s += 1;
  const mz = ch.pillars.month[1], dz = ch.pillars.day[1];
  if (C.isHe(cyc.zhi, mz) || C.isHe(cyc.zhi, dz)) s += 0.5;
  if (C.isChong(cyc.zhi, mz) || C.isChong(cyc.zhi, dz)) s -= 0.5;
  return s;
}
function seasonAgree(ch, H) { const se = ch.season === 'summer' ? 'water' : ch.season === 'winter' ? 'fire' : null; return se ? H.includes(se) : null; }
function annotateCycles(ch, dy, H) {
  dy.cycles.forEach(c => {
    c.god = C.tenGod(ch.dayGan, c.gan); c.cat = catOf(c.god);
    c.stage = C.stage(ch.dayGan, c.zhi);
    c.score = cycleScore(ch, c, H);
  });
  const sc = dy.cycles.map(c => c.score);
  const mx = Math.max(...sc), mn = Math.min(...sc);
  dy.mean = sc.reduce((a, b) => a + b, 0) / sc.length;
  // v3: 지금 이후(지금 포함) 대운만 후보. 최강 = 30년 안의 동점 모두(30년 밖뿐이면 "인생 후반" 문장만), 성장 = 가장 가까운 1개(30년 안)
  // v4: 강조 후보 = 지금 대운 + 끝나는 나이가 (지금 나이 + 30) 이내인 대운. 전체 최고점은 표에만 따로 표시
  const age = ch.age;
  const win = dy.cycles.filter(c => c.ageEnd >= age && (c.ageStart <= age || c.ageEnd <= age + 30));
  dy.window = win;
  const all = dy.cycles.map(c => c.score), amx = Math.max(...all);
  dy.topOverall = amx === Math.min(...all) ? [] : dy.cycles.filter(c => c.score === amx);
  dy.best = []; dy.grow = []; dy.bestLater = false; dy.even = true;
  if (win.length) {
    const cs = win.map(c => c.score), cmx = Math.max(...cs), cmn = Math.min(...cs);
    dy.even = cmx === cmn;
    if (!dy.even) { dy.best = win.filter(c => c.score === cmx); dy.grow = [win.filter(c => c.score === cmn)[0]]; }
  }
  return dy;
}
// 1칸 총운과 4칸 대운이 같은 값을 쓰도록 한 함수에서 꺼냄
function decadeInfo(dy) {
  return { best: dy.best, grow: dy.grow, even: dy.even, plural: dy.best.length > 1,
    bestList: { en: ageList(dy.best, 'en'), ko: ageList(dy.best, 'ko') }, growList: { en: ageList(dy.grow, 'en'), ko: ageList(dy.grow, 'ko') } };
}
const joinEn = a => a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
const ageList = (list, lang) => { const items = list.map(c => lang === 'ko' ? `${c.ageStart}~${c.ageEnd}세(${c.gz})` : `age ${c.ageStart} to ${c.ageEnd} (${c.gz})`); return lang === 'ko' ? items.join(', ') : joinEn(items); };
function nearestStart(dy, target) {
  let best = null;
  dy.cycles.forEach(c => { const d = Math.abs(c.ageStart - target); if (!best || d < best.d || (d === best.d && c.ageStart > best.a)) best = { d, a: c.ageStart }; });
  return best.a;
}
const currentCycle = (dy, age) => dy.cycles.find(c => age >= c.ageStart && age <= c.ageEnd) || null;
function dominantCat(cycles) {
  const n = {}; cycles.forEach(c => n[c.cat] = (n[c.cat] || 0) + 1);
  let best = null; cycles.forEach(c => { if (!best || n[c.cat] > n[best]) best = c.cat; });
  return best;
}
function fitOf(cycles, mean) {
  if (!cycles.length) return 'mixed';
  const avg = cycles.reduce((a, c) => a + c.score, 0) / cycles.length;
  return avg >= mean + 0.25 ? 'smooth' : avg <= mean - 0.25 ? 'stretch' : 'mixed';
}

// 세운과 원국의 관계 (A)
function yearRelations(ch, Y) {
  const ys = Y.gz[0], yb = Y.gz[1];
  const P = ['day', 'month', 'year'].concat(ch.timeUnknown ? [] : ['hour']);
  const natalZ = P.map(p => ch.pillars[p][1]);
  const out = [];
  P.forEach(p => { if (ch.pillars[p] === Y.gz) out.push({ t: 'fuyin', p }); });
  P.forEach(p => { if (C.isChong(yb, ch.pillars[p][1])) out.push({ t: 'chung', p, nb: ch.pillars[p][1] }); });
  const sx = C.SANXING.find(t => t.includes(yb) && t.filter(z => z !== yb).every(z => natalZ.includes(z)));
  if (sx) out.push({ t: 'sanxing', trio: sx.join('') });
  const fh = C.FANGHE.find(t => t.t.includes(yb) && t.t.filter(z => z !== yb).every(z => natalZ.includes(z)));
  if (fh) out.push({ t: 'fanghe', trio: fh.t.join(''), el: fh.el });
  const tri = C.SANHE.find(t => t.t.includes(yb));
  const samFull = tri.t.filter(z => z !== yb).every(z => natalZ.includes(z));
  if (samFull) out.push({ t: 'samhap', trio: tri.t.join(''), el: tri.el });
  P.forEach(p => { if (C.isHe(yb, ch.pillars[p][1])) out.push({ t: 'hap', p, nb: ch.pillars[p][1] }); });
  P.forEach(p => {
    const nb = ch.pillars[p][1], x = C.xingPair(yb, nb);
    if (!x) return;
    if (x === 'sanxing' && sx) return; // 삼형 완성 문장에 포함
    out.push({ t: x === 'zixing' ? 'zixing' : 'xing', p, nb });
  });
  if (!samFull) {
    const wj = C.WANGJI[tri.el];
    const p = P.find(q => { const nb = ch.pillars[q][1]; return nb !== yb && tri.t.includes(nb) && (nb === wj || yb === wj); });
    if (p) out.push({ t: 'banhap', p, pair: yb + ch.pillars[p][1], el: tri.el });
  }
  P.forEach(p => { if (C.isGanHe(ys, ch.pillars[p][0])) out.push({ t: 'ganhe', p, ns: ch.pillars[p][0] }); });
  P.forEach(p => { if (C.isGanChong(ys, ch.pillars[p][0])) out.push({ t: 'ganchong', p, ns: ch.pillars[p][0] }); });
  return out;
}
const REL_ORDER = ['fuyin', 'chung', 'sanxing', 'fanghe', 'samhap', 'hap', 'xing', 'zixing', 'banhap', 'ganhe', 'ganchong'];
const REL_NAME = { fuyin: ['repeated pillar', '복음'], chung: ['clash', '충'], sanxing: ['three-penalty pattern', '삼형'], fanghe: ['seasonal group', '방합'], samhap: ['three-branch harmony', '삼합'], hap: ['combination', '육합'], xing: ['penalty', '형'], zixing: ['self-penalty', '자형'], banhap: ['half harmony', '반합'], ganhe: ['stem combination', '천간합'], ganchong: ['stem clash', '천간충'] };
function relText(r, lang) {
  const nm = REL_NAME[r.t][lang === 'ko' ? 1 : 0];
  const where = r.p ? (lang === 'ko' ? ` ${PKO[r.p]}` : ` with ${r.p} pillar`) : (r.trio ? ` ${r.trio}` : '');
  return lang === 'ko' ? `${nm}${where}` : `${nm}${where}`;
}

function buildReading(inp, X) {
  const key = inputKey(inp);
  const ch = C.computeChart(inp, X);
  const emit = makeEmitter(key, ch.minor, ch.age < 8);
  const tu = ch.timeUnknown, dg = ch.dayGan;
  const single = ch.dy.mode === 'single';
  const H = helpfulSet(ch);
  const dy = single ? annotateCycles(ch, ch.dy.main, H) : null;
  const dyF = !single ? annotateCycles(ch, ch.dy.forward, H) : null;
  const dyB = !single ? annotateCycles(ch, ch.dy.backward, H) : null;
  const age = ch.age;
  const sw = STR[ch.strength];
  const sections = [];
  const S = (no, en, ko) => { const s = { no, title: { en, ko }, feel: [], mean: [], act: [], why: [] }; sections.push(s); return s; };

  const header = ['GL_DM', tu ? 'GL_CHARS_6' : 'GL_CHARS', 'GL_IPCHUN', 'GL_STAGE', 'GL_SYMBOLS', 'GL_CYCLES'].map(id => emit(id));
  if (tu) header.push(emit('TIME_UNKNOWN_NOTE'));

  // 1
  {
    const s = S(1, 'Lifetime Overview', '평생 총운');
    s.feel.push(emit('OV_FEEL_' + dg));
    s.mean.push(emit('OV_MEAN_' + dg));
    s.mean.push(emit(ch.cusp ? 'OV_SEASON_cusp_' + ch.pillars.month[1] : 'OV_SEASON_' + ch.season));
    s.mean.push(emit('OV_STR_' + ch.strength));
    if (ch.strengthExtreme) s.mean.push(emit('OV_SPECIAL'));
    if (single) {
      const di = decadeInfo({ ...dy, best: dy.best.filter(c => c.ageStart <= age || c.ageEnd <= 85) });
      if (di.best.length) { const rr = emit(di.best.length > 1 ? 'OV_DECADE_best_PL' : 'OV_DECADE_best', { bestList: di.bestList }, di.best.map(c => 'decade:best:' + c.k)); if (di.best.length < dy.best.length) rr.en += ' Our scoring also marks a strong stretch further ahead.'; s.mean.push(rr); }
      else if (!dy.best.length) s.mean.push(emit('OV_DECADE_even'));
    } else s.mean.push(emit('OV_DECADE_both'));
    s.act.push(emit('OV_ACT_' + ch.strength));
    const sy = seasonWhy(ch);
    s.why.push(whyRec(`Day Master (the main character of the day you were born): ${L.dm[dg].en}; born in ${sy.en}, with a month branch (the month you were born) of ${ch.pillars.month[1]}; strength check: ${sw.label}.`,
      `일간(태어난 날을 대표하는 기운): ${dg}; ${sy.ko} 출생, 월지(태어난 달) ${ch.pillars.month[1]}; 강약 판정: ${sw.ko}.`));
  }
  // 2
  {
    const s = S(2, 'Who You Are', '나는 어떤 사람인가');
    s.feel.push(emit('WHO_FEEL_' + dg));
    s.mean.push(emit('WHO_MEAN_' + dg));
    s.mean.push(emit('WHO_TOP_' + ch.dominant));
    const mcat = catOf(ch.monthMainGod);
    s.mean.push(emit('WHO_MONTH_' + mcat, { monthGod: godX(ch.monthMainGod) }, ['monthcat:' + mcat]));
    s.act.push(emit('WHO_ACT_' + (ch.dominant === 'even' ? 'even' : catOf(ch.dominant))));
    s.why.push(whyRec(`the energy that shows up most when every position is counted, hidden ones included (each position weighted by our own settings): ${ch.dominant === 'even' ? 'none stands out' : godEn(ch.dominant)}; month branch (the month you were born) ${ch.pillars.month[1]}, main hidden stem: ${godEn(ch.monthMainGod)}.`,
      `숨어 있는 글자까지 모든 자리를 자리별 가중치(우리 설정값)로 셌을 때 가장 두드러지는 기운: ${ch.dominant === 'even' ? '두드러진 것 없음' : godKo(ch.dominant)}; 월지(태어난 달) ${ch.pillars.month[1]}의 본기: ${godKo(ch.monthMainGod)}.`));
  }
  // 3
  {
    const s = S(3, 'This Year & Next Year (2026 丙午 · 2027 丁未)', '올해와 내년 (2026 병오 · 2027 정미)');
    s.mean.push(emit('YR_BOUNDARY'));
    const cats = [], whyEn = [], whyKo = []; let prevFeel; const used2026 = new Set(); let dy2026 = null;
    s.relations = {};
    YEARS.forEach((Y, yi) => {
      const ys = Y.gz[0], yb = Y.gz[1];
      const god = C.tenGod(dg, ys), cat = catOf(god);
      const stg = C.stage(dg, yb);
      const sl = { year: Y.y, ys, yb, yrGod: { en: GOD_PLAIN[god], ko: GOD_GLOSS[god][1] }, dg, yearGz: Y.gz };
      const yt = ['year:' + Y.y];
      const blk = { year: Y.y, gz: Y.gz, label: L.yearName[Y.y], feel: [], mean: [], act: [] };
      const same = yi === 1 && cats[0] === cat;
      const f = emit('YR_FEEL_' + cat, sl, yt, { salt: String(Y.y) });
      blk.feel.push(f);
      blk.mean.push(emit('YR_TG_' + god, sl, yt));
      if (!same) blk.mean.push(emit(`YR_LAND_${cat}_${ch.strength}`, sl, yt));
      const rels = yearRelations(ch, Y).sort((a, b) => REL_ORDER.indexOf(a.t) - REL_ORDER.indexOf(b.t));
      s.relations[Y.y] = rels.map(r => r.t + (r.p ? ':' + r.p : '') + (r.trio ? ':' + r.trio : '') + (r.pair ? ':' + r.pair : ''));
      rels.filter(r => !(r.t === 'xing' && rels.some(q => q.t === 'chung' && q.nb === r.nb))).slice(0, 4).forEach(r => {
        const useB = yi === 1 && used2026.has(r.t) && BD['YR_R_' + r.t + '_B'];
        const hourTag = r.p === 'hour' ? ['pillar:hour'] : [];
        const areaB = r.p ? L.areaB[r.p] : null, areaS = r.p ? L.areaS[r.p] : null;
        const stemType = r.t === 'ganhe' || r.t === 'ganchong';
        const base = { ...sl, pAnimal: r.p ? ({ year: { en: 'your birth-year animal', ko: '태어난 해의 동물' }, month: { en: 'your birth-month animal', ko: '태어난 달의 동물' }, day: { en: 'the animal of the day you were born', ko: '태어난 날의 동물' }, hour: { en: 'the animal of the hour you were born', ko: '태어난 시의 동물' } })[r.p] : '', pElem: r.p ? ({ year: { en: 'the element of your birth year', ko: '태어난 해의 기운' }, month: { en: 'the element of your birth month', ko: '태어난 달의 기운' }, day: { en: 'your core element', ko: '나의 중심 기운' }, hour: { en: 'the element of your birth hour', ko: '태어난 시의 기운' } })[r.p] : '', pWhole: r.p ? ({ year: { en: 'your birth year', ko: '태어난 해' }, month: { en: 'your birth month', ko: '태어난 달' }, day: { en: 'the day you were born', ko: '태어난 날' }, hour: { en: 'the hour you were born', ko: '태어난 시' } })[r.p] : '', pillar: r.p || '', pillarKo: r.p ? (r.t === 'fuyin' ? PKO[r.p] : stemType ? GKO_P[r.p] : ZKO_P[r.p]) : '', nb: r.nb || '', ns: r.ns || '', trio: r.trio || '', pair: r.pair || '', samEl: r.el ? L.el[r.el] : '' };
        const area = (r.t === 'ganhe' || r.t === 'ganchong') ? areaS : areaB;
        const trio2 = r.trio ? r.trio.split('').filter(z => z !== yb).join(' and ') : '';
        blk.mean.push(emit('YR_R_' + r.t + (useB ? '_B' : ''), { ...base, trio2: { en: trio2, ko: trio2.replace(' and ', '·') }, area: area || '' }, [...yt, ...hourTag, 'yrrel:' + r.t]));
        if (yi === 0) used2026.add(r.t);
      });
      if (!rels.length) blk.mean.push(emit('YR_REL_NONE', sl, yt));
      const yEls = [C.GAN_EL[ys], C.ZHI_EL[yb]];
      const fillEl = yEls.find(e => ch.lacking.includes(e));
      const moreEl = yEls.find(e => ch.excess.includes(e));
      if (fillEl) blk.mean.push(emit('YR_FILL', { ...sl, fillEl: L.el[fillEl] }, [...yt, 'yrfill:' + fillEl]));
      if (moreEl) blk.mean.push(emit('YR_MORE', { ...sl, moreEl: L.el[moreEl] }, [...yt, 'el:' + moreEl + ':excess']));
      blk.mean.push(emit(yi === 0 ? 'YR_STAGE' : 'YR_STAGE_B', { ...sl, ...stgSlots(stg) }, yt));
      if (single) {
        const refAge = age + yi, cc = currentCycle(dy, refAge);
        if (cc) { blk.mean.push(emit(yi === 1 && dy2026 === cc.k ? 'YR_DY_B' : 'YR_DY', { ...sl, dyGz: cc.gz, dyA1: cc.ageStart, dyA2: cc.ageEnd, dyCat: L.cat[cc.cat] }, yt)); if (yi === 0) dy2026 = cc.k; }
        else if (refAge < dy.startAge) blk.mean.push(emit('YR_DY_PRE', { ...sl, mp: ch.pillars.month }, yt));
      }
      const hard = rels.some(r => ['chung', 'ganchong', 'xing', 'sanxing', 'zixing'].includes(r.t));
      const state = hard ? 'chung' : rels.length ? 'hap' : 'none';
      const alts = ['hap', 'chung', 'none'].filter(x => x !== state).map(x => `YR_ACT_${cat}_${x}`);
      blk.act.push(emit(`YR_ACT_${cat}_${state}`, sl, yt, { alts }));
      s[yi === 0 ? 'y2026' : 'y2027'] = blk;
      cats.push(cat);
      whyEn.push(`${Y.y} stem ${ys} acts as ${godEn(god)}; branch ${yb} at ${stageNameEn(stg)}; ${rels.length ? rels.filter(r => !(r.t === 'xing' && rels.some(q => q.t === 'chung' && q.nb === r.nb))).map(r => relText(r, 'en')).join(', ') : 'no combination, clash, or penalty found'}`);
      whyKo.push(`${Y.y}년 천간 ${ys}은(는) ${godKo(god)}; 지지 ${yb}은(는) ${L.stage12[stg].ko.split(',')[0]}; ${rels.length ? rels.map(r => relText(r, 'ko')).join(', ') : '합·충·형 없음'}`);
    });
    s.shift = cats[0] === cats[1] ? emit('YR_SHIFT_SAME', { cat1: L.cat[cats[0]] }) : emit('YR_SHIFT', { cat1: L.cat[cats[0]], cat2: L.cat[cats[1]] });
    s.why.push(whyRec(whyEn.join('. ') + '.', josa(whyKo.join('. ')) + '.'));
  }
  // 4
  {
    const s = S(4, 'Your Life Timeline (10-Year Cycles)', '인생 흐름 (10년 대운)');
    const andList = a => a.length < 2 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1];
    const Hen = andList(H.map(elEn)), Hko = H.map(elKo).join(', ');
    if (single) {
      const cc = currentCycle(dy, age);
      s.timeline = [{ label: 'main', dir: dy.forward ? 'forward' : 'backward', startAge: dy.startAge, cycles: dy.cycles, best: dy.best.map(c => c.k), grow: dy.grow.map(c => c.k), top: dy.topOverall.map(c => c.k), now: cc ? cc.k : 0 }];
      s.mean.push(emit('DY_INTRO', { startTxt: startTxtR(dy.startAge), dirWord: dy.forward ? 'forward' : 'backward', dirWordKo: dy.forward ? '순행' : '역행', mp: ch.pillars.month }));
      if (cc) {
        s.feel.push(emit('DY_FEEL_' + cc.cat));
        s.mean.push(emit('DY_NOW', { age, nowGz: cc.gz, nowA1: cc.ageStart, nowA2: cc.ageEnd, inYears: age - cc.ageStart + 1 }));
        s.mean.push(emit('DY_MEAN_' + cc.cat, { nowGan: cc.gan, nowGod: godX(cc.god), nowCat: L.cat[cc.cat], nowCatKo: L.cat[cc.cat].ko }));
        s.mean.push(emit('DY_STAGE', { nowZhi: cc.zhi, ...stgSlots(cc.stage) }));
      } else {
        s.feel.push(emit('DY_FEEL_both'));
        s.mean.push(emit('DY_NOW_PRE', { age, start: dy.startAge, mp: ch.pillars.month }));
      }
      s.notice = emit('DY_SCORING_NOTE');
      if (dy.even) s.mean.push(emit('DY_EVEN'));
      else {
        const di = decadeInfo({ ...dy, best: dy.best.filter(c => c.ageStart <= age || c.ageEnd <= 85) });
        if (di.best.length) { const rr = emit(di.best.length > 1 ? 'DY_BEST_PL' : 'DY_BEST', { bestList: di.bestList }, di.best.map(c => 'decade:best:' + c.k)); if (di.best.length < dy.best.length) rr.en += ' The table below also marks a later decade.'; s.mean.push(rr); }
        if (di.grow.length) s.mean.push(emit('DY_GROW', { growList: di.growList }, di.grow.map(c => 'decade:grow:' + c.k)));
        const future = dy.best.filter(c => c.ageStart > age);
        if (cc && dy.best.includes(cc)) s.mean.push(emit('DY_POS_inbest'));
        else if (cc && dy.grow.includes(cc)) s.mean.push(emit('DY_POS_ingrow'));
        else if (future.length) s.mean.push(emit('DY_POS_ahead', { nextBest: future[0].ageStart }));
      }
      s.act.push(cc ? emit('DY_ACT_' + cc.cat) : emit('DY_ACT_pre'));
      s.why.push(whyRec(`cycles begin ${startTxtR(dy.startAge).en}, counted from your birth to the ${dy.forward ? 'next' : 'previous'} solar term (${termEn(dy.jieName)}) at three days per year; the marks weigh how much each cycle brings of ${Hen}, ${H.length === 1 ? 'the element that balances' : 'the elements that balance'} a chart that ${sw.verb}.`,
        `대운은 출생부터 ${dy.forward ? '다음' : '이전'} 절입(${trad(dy.jieName)})까지를 3일을 1년으로 쳐서 ${startTxtR(dy.startAge).ko} 시작; 표시는 ${sw.ko} 사주의 균형 오행(${Hko})을 각 대운이 얼마나 가져오는지 본 것.`));
    } else {
      s.timeline = [dyF, dyB].map(d => ({ label: d.forward ? 'forward' : 'backward', dir: d.forward ? 'forward' : 'backward', startAge: d.startAge, cycles: d.cycles, best: d.best.map(c => c.k), grow: d.grow.map(c => c.k), top: d.topOverall.map(c => c.k), now: (currentCycle(d, age) || { k: 0 }).k }));
      s.feel.push(emit('DY_FEEL_both'));
      s.mean.push(emit('DY_INTRO_BOTH', { startFTxt: startTxt(dyF.startAge), startBTxt: startTxt(dyB.startAge) }));
      s.notice = emit('DY_SCORING_NOTE');
      s.act.push(emit('DY_ACT_both'));
      s.why.push(whyRec(`forward cycles begin ${startTxt(dyF.startAge).en} (next solar term ${termEn(dyF.jieName)}), backward cycles ${startTxt(dyB.startAge).en} (previous solar term ${termEn(dyB.jieName)}), three days per year, rounded to the nearest year.`,
        `순행은 ${startTxt(dyF.startAge).ko.replace(/에$/, '')}(다음 절입 ${trad(dyF.jieName)}) 시작, 역행은 ${startTxt(dyB.startAge).ko.replace(/에$/, '')}(이전 절입 ${trad(dyB.jieName)}) 시작, 3일을 1년으로 계산해 반올림.`));
    }
  }
  // 5·6·7
  {
    let c1, c2, pools, mean;
    if (single) {
      c1 = nearestStart(dy, 30); c2 = nearestStart(dy, 60); mean = dy.mean;
      pools = { early: dy.cycles.filter(c => c.ageStart < c1), middle: dy.cycles.filter(c => c.ageStart >= c1 && c.ageStart < c2), later: dy.cycles.filter(c => c.ageStart >= c2) };
    } else {
      c1 = 30; c2 = 60;
      const both = [...dyF.cycles, ...dyB.cycles];
      pools = { early: both.filter(c => c.ageStart < 30), middle: both.filter(c => c.ageStart >= 30 && c.ageStart < 60), later: both.filter(c => c.ageStart >= 60) };
    }
    const ranges = { early: [0, c1 - 1], middle: [c1, c2 - 1], later: [c2, null] };
    const titles = { early: [`Early Years (birth to age ${c1 - 1})`, `초년 (만 0~${c1 - 1}세)`], middle: [`Middle Years (ages ${c1} to ${c2 - 1})`, `중년 (만 ${c1}~${c2 - 1}세)`], later: [`Later Years (age ${c2} on)`, `말년 (만 ${c2}세부터)`] };
    const stageWord = { early: ['early years', '초년'], middle: ['middle years', '중년'], later: ['later years', '말년'] };
    ['early', 'middle', 'later'].forEach((st, i) => {
      const s = S(5 + i, titles[st][0], titles[st][1]);
      const pool = pools[st];
      let fit;
      if (single) fit = fitOf(pool, mean);
      else { const fF = fitOf(pool.filter(c => dyF.cycles.includes(c)), dyF.mean), fB = fitOf(pool.filter(c => dyB.cycles.includes(c)), dyB.mean); fit = fF === fB ? fF : 'mixed'; }
      const domCat = dominantCat(pool);
      if (st === 'later' && tu) s.notice = emit(single ? 'ST_LATE_PARTIAL' : 'ST_LATE_PARTIAL_BOTH');
      s.feel.push(emit(`ST_FEEL_${st}_${fit}`));
      const cycList = pool.map(c => `${c.gz} ${c.ageStart}-${c.ageEnd}`).filter((x, idx, arr) => arr.indexOf(x) === idx).join(', ');
      const [r1, r2] = ranges[st];
      if (single) s.mean.push(emit(r2 === null ? 'ST_RANGE_OPEN' : 'ST_RANGE', { r1, r2, cycList }));
      else s.mean.push(emit(r2 === null ? 'ST_RANGE_BOTH_OPEN' : 'ST_RANGE_BOTH', { r1, r2 }));
      if (domCat) s.mean.push(emit(`ST_CYC_${st}_${domCat}`));
      s.mean.push(emit('ST_FIT_' + fit, { stageWord: stageWord[st][0], stageWordKo: stageWord[st][1] }, [`fit:${st}:${fit}`]));
      let palGod = null;
      if (st === 'early') { palGod = C.tenGod(dg, ch.pillars.month[0]); s.mean.push(emit('ST_NATAL_early', { yp: ch.pillars.year, mp: ch.pillars.month })); }
      if (st === 'middle') { palGod = ch.dayBranchGod; s.mean.push(emit('ST_NATAL_middle', { dp: ch.pillars.day })); }
      if (st === 'later' && !tu) palGod = C.tenGod(dg, ch.pillars.hour[0]);
      if (palGod) s.mean.push(emit('ST_PAL_' + st, { palGod: godX(palGod), palCat: L.cat[catOf(palGod)], palCatKo: L.cat[catOf(palGod)].ko }));
      let timing;
      if (st === 'early') timing = age < c1 ? 'now' : 'past';
      else if (st === 'middle') timing = age < c1 ? 'ahead' : age < c2 ? 'now' : 'past';
      else timing = age < c2 ? 'ahead' : 'now';
      s.act.push(emit(`ST_ACT_${st}_${timing}`, { c1, c2 }));
      const palTxtEn = palGod ? `${st === 'early' ? 'month stem' : st === 'middle' ? 'day branch' : 'hour stem'}: ${godEn(palGod)}` : 'based on your 10-year cycles';
      const palTxtKo = palGod ? `${st === 'early' ? '월간' : st === 'middle' ? '일지' : '시간(時干)'}: ${godKo(palGod)}` : '10년 대운으로 읽음';
      s.why.push(whyRec(single ? `our simplified split at the cycle starts nearest ages 30 and 60 (${c1} and ${c2}); cycles here lean toward ${domCat ? L.cat[domCat].en : 'no single theme'}; ${palTxtEn}.`
        : `our simplified split at plain ages 30 and 60; cycles in both directions lean toward ${domCat ? L.cat[domCat].en : 'no single theme'}; ${palTxtEn}.`,
        single ? `30·60세에 가장 가까운 대운 시작 나이(${c1}세, ${c2}세)로 나눈 우리의 간단한 3단계; 이 구간 대운은 ${domCat ? L.cat[domCat].ko : '한 주제 없음'} 쪽; ${palTxtKo}.`
          : `단순 30·60세로 나눈 우리의 간단한 3단계; 두 방향 대운이 ${domCat ? L.cat[domCat].ko : '한 주제 없음'} 쪽; ${palTxtKo}.`,
        (st === 'later' && tu) ? ['notice:time-unknown'] : []));
      if (ch.minor && (st === 'later' || st === 'middle')) s.noticeMinor = emit('ST_LATE_MINOR'); // 만 14세 미만: 중년·말년 칸은 접고 같은 문안(공용)을 맨 위에 (실장 결정 2, 2026-10-03)
      s.stage = { st, range: ranges[st], fit, domCat, timing };
    });
  }
  // 8 사랑 (성별 무관: 일지 + 재성·관성 따로)
  {
    const s = S(8, 'Love & Relationships', '사랑과 관계');
    const dbcat = catOf(ch.dayBranchGod);
    s.feel.push(emit('LV_FEEL_' + dbcat));
    s.mean.push(emit('LV_MEAN_' + dbcat, { db: ch.pillars.day[1], dbGod: godX(ch.dayBranchGod) }));
    if (!['byeong', 'sa', 'myo', 'jeol'].includes(ch.dayBranchStage)) s.mean.push(emit('LV_STAGE', stgSlots(ch.dayBranchStage), ['dbstage:' + ch.dayBranchStage]));
    const dRel = ch.natalRel.filter(r => r.p1 === 'day' || r.p2 === 'day');
    const hap = dRel.find(r => r.type === 'he'), chg = dRel.find(r => r.type === 'chong');
    [hap, chg].filter(Boolean).forEach(r => {
      const other = r.p1 === 'day' ? r.p2 : r.p1, t = r.type === 'he' ? 'hap' : 'chung';
      s.mean.push(emit(other === 'hour' ? `LV_REL_${t}_hour` : `LV_REL_${t}`, { relP: other, relPKo: ({ year: '태어난 해', month: '태어난 달', day: '태어난 날', hour: '태어난 시' })[other], relPair: r.b1 + r.b2 }));
    });
    const sN = ch.catCount.siksang, expr = sN === 0 ? 'none' : sN >= 2.5 ? 'many' : 'some';
    s.mean.push(emit('LV_EXPR_' + expr));
    const wj = ch.godCount.jeongjae, wp = ch.godCount.pyeonjae, w = ch.catCount.jaeseong;
    const oj = ch.godCount.jeonggwan, op = ch.godCount.pyeongwan, o = ch.catCount.gwanseong;
    s.mean.push(emit('LV_W_' + (w === 0 ? 'none' : w >= 2.5 ? 'many' : 'some')));
    s.mean.push(emit('LV_A_' + (o === 0 ? 'none' : (oj > 0 && op > 0) ? 'mixed' : oj > 0 ? 'jeong' : 'pyeon')));
    s.act.push(emit('LV_ACT_' + expr));
    s.why.push(whyRec(`day branch ${ch.pillars.day[1]}, the partner seat, holds ${godEn(ch.dayBranchGod)}; wealth and authority symbols are read as two separate signals for everyone, a modern adaptation rather than the traditional split by gender.`,
      `배우자 자리인 일지 ${ch.pillars.day[1]}에 ${godKo(ch.dayBranchGod)}; 재성과 관성을 누구에게나 두 개의 따로 된 신호로 읽음(전통의 남녀 구분 대신 쓰는 현대적 적용).`));
  }
  // 9
  {
    const s = S(9, 'Work & Money', '일과 돈');
    const mcat = catOf(ch.monthMainGod);
    s.feel.push(emit('WK_FEEL_' + mcat, {}, ['monthcat:' + mcat]));
    s.mean.push(emit('WK_MEAN_' + mcat, { monthGod: godX(ch.monthMainGod) }));
    const wj = ch.godCount.jeongjae, wp = ch.godCount.pyeonjae, w = ch.catCount.jaeseong;
    const oj = ch.godCount.jeonggwan, op = ch.godCount.pyeongwan, o = ch.catCount.gwanseong;
    const wl = w === 0 ? 'none' : wj > wp ? 'jeong' : wp > wj ? 'pyeon' : 'mixed';
    const ol = o === 0 ? 'none' : oj > op ? 'jeong' : op > oj ? 'pyeon' : 'mixed';
    s.mean.push(emit('MN_W_' + wl));
    if (w >= 3) s.mean.push(emit('MN_W_many'));
    s.mean.push(emit('MN_O_' + ol));
    if (ch.strength === 'weak' && w + o >= 4) s.mean.push(emit('MN_CARRY'));
    if (ch.strength === 'strong' && w === 0 && o === 0) s.mean.push(emit('MN_OUTLET'));
    const sN = ch.catCount.siksang;
    // 식상 0개는 8칸에서 한 번만 말함(9칸 생략)
    // 식상 많음도 8칸에서 한 번만 말함
    s.act.push(emit('MN_ACT_' + wl));
    s.why.push(whyRec(`month branch ${ch.pillars.month[1]}, main hidden stem: ${godEn(ch.monthMainGod)}; wealth symbols ${wl === 'none' ? 'are absent' : wl === 'mixed' ? 'are evenly split' : 'lean ' + ({ jeong: 'Wage', pyeon: 'Hustle' })[wl]}; authority symbols ${ol === 'none' ? 'are absent' : ol === 'mixed' ? 'are evenly split' : 'lean ' + ({ jeong: 'Duty', pyeon: 'Pressure' })[ol]}; strength: ${sw.label}.`,
      `월지 ${ch.pillars.month[1]} 본기: ${godKo(ch.monthMainGod)}; 재성 ${wl === 'none' ? '없음' : ({ jeong: '정재 쪽', pyeon: '편재 쪽', mixed: '반반' })[wl]}; 관성 ${ol === 'none' ? '없음' : ({ jeong: '정관 쪽', pyeon: '편관 쪽', mixed: '반반' })[ol]}; 강약: ${sw.ko}.`));
  }
  // 10
  {
    const s = S(10, 'Little Reminders', '기억해 두면 좋은 것');
    const cands = [];
    if (ch.excess.length) {
      const top = ch.excess.slice().sort((a, b) => ch.counts[b] - ch.counts[a] || ORDER_EL.indexOf(a) - ORDER_EL.indexOf(b))[0];
      cands.push({ id: 'WT_ex_' + top, sl: { exN: ch.counts[top], total: ch.total }, why: [`plenty of ${elEn(top)}`, `${elKo(top)} 많음`] });
    }
    if (ch.strength !== 'balanced') cands.push({ id: 'WT_' + ch.strength, sl: {}, why: [sw.label, sw.ko] });
    const over = CATS.filter(c => ch.catCount[c] >= 3.5).sort((a, b) => ch.catCount[b] - ch.catCount[a])[0];
    if (over) cands.push({ id: 'WT_over_' + over, sl: { ovN: '' }, why: [`many ${CAT_FAMILY[over][0]}`, `${CAT_FAMILY[over][1]} 많음`] });
    const cl = ch.natalRel.find(r => r.type === 'chong');
    if (cl) {
      const hr = cl.p1 === 'hour' || cl.p2 === 'hour';
      const p1 = cl.p1 === 'hour' ? cl.p2 : cl.p1, p2 = cl.p1 === 'hour' ? cl.p1 : cl.p2;
      cands.push({ id: hr ? 'WT_clash_hour' : 'WT_clash', sl: { cb1: cl.b1, cb2: cl.b2, cp1: p1, cp2: p2, cp1Ko: ({ year: '태어난 해', month: '태어난 달', day: '태어난 날', hour: '태어난 시' })[p1], cp2Ko: ({ year: '태어난 해', month: '태어난 달', day: '태어난 날', hour: '태어난 시' })[p2] }, why: [`clash between ${cl.b1} and ${cl.b2}`, `${cl.b1}·${cl.b2} 충`] });
    }
    const miss = ['inseong', 'siksang', 'bigyeop', 'jaeseong', 'gwanseong'].find(c => ch.catCount[c] === 0);
    if (miss) cands.push({ id: 'WT_miss_' + miss, sl: {}, why: [`no ${CAT_FAMILY[miss][0]}`, `${CAT_FAMILY[miss][1]} 없음`] });
    const picked = cands.slice(0, 2);
    if (picked.length < 2) picked.push({ id: 'WT_general', sl: {}, why: ['no second strong pattern', '두 번째 뚜렷한 패턴 없음'] });
    s.items = picked.map(pk => ({ feel: emit(pk.id + '_FEEL', pk.sl), mean: emit(pk.id + '_MEAN', pk.sl), cope: emit(pk.id + '_COPE', pk.sl) }));
    s.why.push(whyRec(`we show the first two patterns found, in a fixed order: ${picked.map(p => p.why[0]).join('; ')}.`, `정해진 순서로 먼저 걸린 두 가지: ${picked.map(p => p.why[1]).join('; ')}.`));
  }
  // 11 (4칸과 같은 균형 오행 목록에서 고름)
  {
    const s = S(11, 'What Balances You', '나를 채워 주는 기운');
    const targets = H.slice().sort((a, b) => ch.counts[a] - ch.counts[b] || ORDER_EL.indexOf(a) - ORDER_EL.indexOf(b));
    const t = targets[0];
    s.feel.push(emit('BL_FEEL_' + t));
    if (targets.length >= 2 && ch.counts[targets[1]] === ch.counts[t]) s.mean.push(emit(ch.counts[t] === 0 ? 'BL_PICK_two_none' : 'BL_PICK_two', { balEl: L.el[t], balEl2: L.el[targets[1]], balN: ch.counts[t], balN2: ch.counts[targets[1]], total: ch.total }));
    else s.mean.push(emit(ch.counts[t] === 0 ? 'BL_PICK_none' : 'BL_PICK_lack', { balEl: L.el[t], balN: ch.counts[t], total: ch.total }));
    s.mean.push(emit('BL_MEAN_' + t, {}, ['bal:add:' + t]));
    if (ch.strengthExtreme) s.mean.push(emit('BL_SPECIAL'));
    const agree = seasonAgree(ch, H);
    if (ch.season === 'summer') s.mean.push(emit(ch.excess.includes('water') ? 'BL_SEASON_summer_has' : agree ? 'BL_SEASON_summer' : 'BL_SEASON_summer_diff'));
    else if (ch.season === 'winter') s.mean.push(emit(ch.excess.includes('fire') ? 'BL_SEASON_winter_has' : agree ? 'BL_SEASON_winter' : 'BL_SEASON_winter_diff'));
    else s.mean.push(emit('BL_SEASON_' + ch.season));
    s.act.push(emit('BL_ACT_' + t));
    const cnt = ORDER_EL.map(e => `${elEn(e).split(' ')[0]} ${ch.counts[e]}`).join(', ');
    const cntK = ORDER_EL.map(e => `${elKo(e)} ${ch.counts[e]}`).join(', ');
    s.why.push(whyRec(`element counts on the ${ch.total} visible characters: ${cnt}; balancing elements for a chart that ${sw.verb}: ${H.map(elEn).join(', ')}.`,
      `보이는 ${ch.total}자의 오행 개수: ${cntK}; ${sw.ko} 사주의 균형 오행: ${H.map(elKo).join(', ')}.`));
  }
  // 만 14세 미만: 일·사랑 칸을 학교·친구·가족 칸으로 바꿈 (직장·돈·연애 표현 없음)
  if (ch.minor) {
    const s8 = sections.find(x => x.no === 8), s9 = sections.find(x => x.no === 9);
    const dbcat = catOf(ch.dayBranchGod), mcat = catOf(ch.monthMainGod);
    s8.title = { en: 'Friends & Family', ko: '친구와 가족' };
    s8.feel = [emit('LVM_FEEL_' + dbcat)]; s8.mean = [emit('LVM_MEAN_' + dbcat)]; s8.act = [emit('LVM_ACT_' + dbcat)];
    s8.why = [whyRec(`day branch ${ch.pillars.day[1]}, the seat for close relationships, holds ${godEn(ch.dayBranchGod)}; for readers under 14 we describe friends and family instead of partners.`, `가까운 관계를 보는 일지 ${ch.pillars.day[1]}에 ${godKo(ch.dayBranchGod)}; 만 14세 미만에게는 연인 대신 친구와 가족 이야기로 풀어 줌.`)];
    s9.title = { en: 'School & Interests', ko: '학교와 관심사' };
    s9.feel = [emit('WKM_FEEL_' + mcat)]; s9.mean = [emit('WKM_MEAN_' + mcat)]; s9.act = [emit('WKM_ACT_' + mcat)];
    s9.why = [whyRec(`month branch ${ch.pillars.month[1]}, main hidden stem: ${godEn(ch.monthMainGod)}; for readers under 14 we describe school and interests instead of work and money.`, `월지 ${ch.pillars.month[1]} 본기: ${godKo(ch.monthMainGod)}; 만 14세 미만에게는 일과 돈 대신 학교와 관심사 이야기로 풀어 줌.`)];
  }
  // 12 (화면의 '건강 습관' 칸): 생활 습관만. 균형 오행(11칸과 같은 목록) + 강약 + 태어난 계절
  {
    const s = S(12, 'Daily Habits', '건강 습관');
    const targets = H.slice().sort((a, b) => ch.counts[a] - ch.counts[b] || ORDER_EL.indexOf(a) - ORDER_EL.indexOf(b));
    const t = targets[0];
    s.notice = emit('HB_NOTICE');
    s.feel.push(emit('HB_FEEL_' + t));
    s.mean.push(emit('HB_MEAN_' + t));
    s.mean.push(emit('HB_STR_' + ch.strength));
    s.mean.push(emit(ch.cusp ? 'HB_SEASON_cusp' : 'HB_SEASON_' + ch.season));
    s.act.push(emit('HB_ACT_' + t));
    s.why.push(whyRec(`these are everyday routines only: the first balancing element for your chart is ${elEn(t)}; your strength check: ${sw.label}; birth season: ${seasonWhy(ch).en}.`,
      `생활 습관만 다뤄요: 이 사주의 첫 번째 균형 오행은 ${elKo(t)}, 강약 판정은 ${sw.ko}, 태어난 계절은 ${seasonWhy(ch).ko}.`));
  }
  sections.forEach(s => (s.why || []).forEach(w => { w.ko = koFixJosa(koWhyPlain(w.ko)); if (ch.minor) w.ko = minorize(w.ko, MINOR_KO); })); // [④ 한국어]
  return { key, input: inp, chart: ch, helpful: H, header, sections, disclaimer: emit('DISCLAIMER') };
}

function allRecords(r) { const out = [...r.header]; r.sections.forEach(s => out.push(...sectionRecords(s))); out.push(r.disclaimer); return out; }
function sectionRecords(s) {
  const out = [...s.feel, ...s.mean, ...s.act, ...s.why];
  ['y2026', 'y2027'].forEach(k => { if (s[k]) out.push(...s[k].feel, ...s[k].mean, ...s[k].act); });
  if (s.shift) out.push(s.shift);
  if (s.notice) out.push(s.notice);
  if (s.noticeMinor) out.push(s.noticeMinor);
  if (s.items) s.items.forEach(it => out.push(it.feel, it.mean, it.cope));
  return out;
}
function actionRecords(r) {
  const out = [];
  r.sections.forEach(s => { out.push(...s.act); ['y2026', 'y2027'].forEach(k => { if (s[k]) out.push(...s[k].act); }); if (s.items) s.items.forEach(it => out.push(it.cope)); });
  return out;
}

const pair = rec => `${rec.en}  \n*${rec.ko}*\n`;
function block(label, recs) {
  if (!recs.length) return '';
  if (label.startsWith('Why')) return recs.map(r => `> ${r.en}  \n> *${r.ko}*\n`).join('\n') + '\n';
  return `**${label}**\n\n` + recs.map(pair).join('\n') + '\n';
}
function timelineTable(tl, ch) {
  let t = `| # | Age · 만 나이 | Years · 연도 | Cycle · 대운 | Stem role · 천간 십신 | Branch stage · 십이운성 | Mark · 표시 |\n|---|---|---|---|---|---|---|\n`;
  if (tl.startAge > 0) t += `| 0 | 0-${tl.startAge - 1} | ${ch.input.y}-${ch.input.y + tl.startAge - 1} | ${ch.pillars.month} (month pillar · 월주) | - | - | ${tl.now === 0 && ch.age < tl.startAge ? 'Now · 지금' : ''} |\n`;
  tl.cycles.forEach(c => {
    const mk = [c.k === tl.now ? 'Now · 지금' : '', tl.best.includes(c.k) ? 'Most active in the next 30 years (our score)* · 앞으로 30년 중 힘이 큰 시기 (자체 채점)*' : '', tl.grow.includes(c.k) ? 'Growing (our score)* · 성장 (자체 채점)*' : '', (tl.top || []).includes(c.k) && !tl.best.includes(c.k) ? 'Highest of all decades (our score)** · 평생 대운 중 점수 최고 (자체 채점)**' : ''].filter(Boolean).join(' / ');
    t += `| ${c.k} | ${c.ageStart}-${c.ageEnd} | ${c.yearStart}-${c.yearEnd} | ${c.gz} | ${godEn(c.god)} · ${godKo(c.god)} | ${L.stageName[c.stage].en} · ${L.stageName[c.stage].ko} | ${mk} |\n`;
  });
  t += `\n\\* See How We Calculate. · How We Calculate 참고. \\*\\* Highest of all decades looks at your whole life and is shown in this table only. · 평생 대운 중 점수 최고는 평생을 보며, 표에만 표시.\n`;
  return t;
}
function toMarkdown(r, title) {
  const ch = r.chart, i = r.input;
  let md = `# ${title}\n\n`;
  md += `**Input · 입력**: ${i.y}-${String(i.m).padStart(2, '0')}-${String(i.d).padStart(2, '0')} ${i.timeUnknown ? 'birth time unknown · 시간 모름' : String(i.h).padStart(2, '0') + ':' + String(i.mi || 0).padStart(2, '0') + ' (Korea time · 한국시각)'} · Male / Female · 성별: ${{ male: 'Male · 남', female: 'Female · 여', notsure: 'Not sure, show both' }[i.dir]} · Reference date · 기준일: ${i.asOf}\n\n`;
  md += `| | Hour · 시주 | Day · 일주 | Month · 월주 | Year · 연주 |\n|---|---|---|---|---|\n| Pillar · 기둥 | ${ch.pillars.hour || '? (unknown · 모름)'} | ${ch.pillars.day} | ${ch.pillars.month} | ${ch.pillars.year} |\n\n`;
  md += `Day Master · 일간: ${L.dm[ch.dayGan].en} · Strength · 강약: ${STR[ch.strength].label} · Season · 계절: ${ch.season} · Elements on the visible characters · 보이는 글자 오행 (Wood/Fire/Earth/Metal/Water): ${ORDER_EL.map(e => ch.counts[e]).join('/')} of ${ch.total} · Age · 만 나이: ${ch.age}\n\n`;
  md += `**Key terms · 용어 풀이**\n\n` + r.header.map(pair).join('\n') + '\n---\n\n';
  r.sections.forEach(s => {
    md += `## ${s.no}. ${s.title.en} · ${s.title.ko}\n\n`;
    if (s.noticeMinor) md += '> ' + s.noticeMinor.en + '  \n> *' + s.noticeMinor.ko + '*\n\n';
    if (s.notice) md += '> ' + s.notice.en + '  \n> *' + s.notice.ko + '*\n\n';
    if (s.no === 3) {
      md += block('What it means · 의미', s.mean);
      ['y2026', 'y2027'].forEach(k => { const b = s[k]; md += `### ${b.year} · ${b.label.en} · ${b.label.ko}\n\n` + block('How it may feel · 감정', b.feel) + block('What it means · 의미', b.mean) + block('One small step · 작은 행동', b.act); });
      md += block('Looking across both years · 두 해를 이어 보면', [s.shift]) + block('Why', s.why);
      return;
    }
    if (s.no === 10) {
      s.items.forEach((it, idx) => { md += `### Reminder ${idx + 1} · 기억할 점 ${idx + 1}\n\n` + block('How it may feel · 감정', [it.feel]) + block('What it means · 의미', [it.mean]) + block('What helps · 대처법', [it.cope]); });
      md += block('Why', s.why);
      return;
    }
    md += block('How it may feel · 감정', s.feel) + block('What it means · 의미', s.mean);
    if (s.timeline) s.timeline.forEach(tl => {
      md += `**Timeline data (${tl.label}) · 대운 그래픽 데이터 (${tl.label === 'forward' ? '순행' : tl.label === 'backward' ? '역행' : '확정 방향'})**\n\n` + timelineTable(tl, ch) + '\n';
      md += '```json\n' + JSON.stringify({ direction: tl.dir, startAge: tl.startAge, nowCycle: tl.now, mostActiveDecade: tl.best, growingDecade: tl.grow, markNote: 'see How We Calculate', cycles: tl.cycles.map(c => ({ k: c.k, ganzhi: c.gz, age: [c.ageStart, c.ageEnd], years: [c.yearStart, c.yearEnd], stemRole: godEn(c.god), branchStage: L.stageName[c.stage].en })) }) + '\n```\n\n';
    });
    md += block('One small step · 작은 행동', s.act) + block('Why', s.why);
  });
  md += '---\n\n' + pair(r.disclaimer);
  return md;
}
const englishWordCount = r => allRecords(r).reduce((a, rec) => a + rec.en.split(/\s+/).filter(w => /[A-Za-z]/.test(w)).length, 0);


return { GOD_PLAIN, GOD_GLOSS, buildReading, toMarkdown, allRecords, sectionRecords, actionRecords, englishWordCount, inputKey, helpfulSet, seasonAgree, josa, finalOf, C, L, STR, sha32, VERSION: 'deep-test-2026-10-03-eval3' };
});
