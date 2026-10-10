/* =====================================================================
 * K사주팔자 계산 엔진 — 테스트판 v5 (saju_engine_test_v5.js)
 * v5: 서머타임 판정을 IANA 표준시 이력 표 우선으로 교체. v4: 해외 10개국 47개 도시 추가(경도 출처 Wikidata P625). v3: 캐나다 6개 도시. v2 추가: 출생 도시 경도 보정(평균태양시 기본 켜짐 / 진태양시 참고 / 끔), 23시대 선택(다음 날 기본 / 태어난 날)
 * 2026-09-30 야간작업 3단계. 원본 saju_engine.js 는 건드리지 않고 복사본에서만 수정.
 *
 * [1부] KSajuCore : 화면(DOM) 없이 쓰는 순수 계산 함수 (Node·브라우저 공용)
 *   - 출생지 시간대(IANA) → 세계표준시(UTC) 변환 (한국 1954~61 UTC+8:30, 서머타임 이력 포함,
 *     브라우저/Node 내장 Intl 시간대 자료 사용)
 *   - 연주·월주: 절기 시각(라이브러리 = 중국 표준시 UTC+8)을 UTC로 바꿔 출생 UTC와 분 단위 비교
 *   - 일주·시주: 출생지 "표준시" 기준(서머타임 1시간은 뺌, 경도 -30분 보정은 안 함), 23시대 = 다음 날 일주
 *   - 대운: 실장 확정 규칙(3일=1년, 반올림 만 나이), 방향 = 연간 음양 × Traditional male/female
 *   - 신강·신약 점수: 위치 가중치(월령 30) × 지장간 월률분야 비율(통근)
 * [2부] 기존 위젯(화면) 코드 — 제출 처리부만 [1부]를 쓰도록 수정
 * ===================================================================== */
(function (root, factory) {
  var lib;
  if (typeof module !== 'undefined' && module.exports) {
    lib = require('./lunar_1.7.7.js');
    module.exports = factory(lib.Solar, lib.Lunar);
  } else {
    root.KSajuCore = factory(root.Solar, root.Lunar);
  }
})(typeof window !== 'undefined' ? window : this, function (Solar, Lunar) {
  'use strict';

  var VERSION = 'test-v5-2026-09-30';
  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var GAN_EL = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
  var GAN_YANG = { 甲: true, 乙: false, 丙: true, 丁: false, 戊: true, 己: false, 庚: true, 辛: false, 壬: true, 癸: false };
  var ZHI_EL = { 子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화', 午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수' };
  var GENERATES = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  var CONTROLS = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };

  // 지장간 월률분야(30일 기준 일수). 출처: 위키백과 "지장간" 표(여기·중기·정기와 일수).
  // 전통 문헌상 명칭은 月律分野 / 人元司令. 학파마다 일수가 조금씩 다름 → 우리 체계의 설정값으로 고정.
  var HIDDEN_DAYS = {
    子: [['壬', 10], ['癸', 20]],
    丑: [['癸', 9], ['辛', 3], ['己', 18]],
    寅: [['戊', 7], ['丙', 7], ['甲', 16]],
    卯: [['甲', 10], ['乙', 20]],
    辰: [['乙', 9], ['癸', 3], ['戊', 18]],
    巳: [['戊', 7], ['庚', 7], ['丙', 16]],
    午: [['丙', 10], ['己', 9], ['丁', 11]],
    未: [['丁', 9], ['乙', 3], ['己', 18]],
    申: [['戊', 7], ['壬', 7], ['庚', 16]],
    酉: [['庚', 10], ['辛', 20]],
    戌: [['辛', 9], ['丁', 3], ['戊', 18]],
    亥: [['戊', 7], ['甲', 7], ['壬', 16]]
  };
  // 화면 표시용 지장간 순서(라이브러리 lunar-javascript ZHI_HIDE_GAN 과 동일: 정기 → 중기 → 여기)
  var HIDDEN_DISPLAY = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'],
    午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲']
  };
  var TEN_GOD_KO_TO_CN = {
    비견: '比肩', 겁재: '劫财', 식신: '食神', 상관: '伤官', 편재: '偏财', 정재: '正财',
    편관: '七杀', 정관: '正官', 편인: '偏印', 정인: '正印'
  };
  var CHANG_SHENG_CN = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  var CHANG_SHENG_OFFSET = { 甲: 1, 丙: 10, 戊: 10, 庚: 7, 壬: 4, 乙: 6, 丁: 9, 己: 9, 辛: 0, 癸: 3 };

  // ---------------------------------------------------------------- 오행 관계
  function relationOf(de, te) {
    if (te === de) return '비겁';
    if (GENERATES[te] === de) return '인성';
    if (GENERATES[de] === te) return '식상';
    if (CONTROLS[de] === te) return '재성';
    if (CONTROLS[te] === de) return '관성';
    return null;
  }
  function tenGodKo(dayGan, otherGan) {
    var cat = relationOf(GAN_EL[dayGan], GAN_EL[otherGan]);
    var same = GAN_YANG[dayGan] === GAN_YANG[otherGan];
    var map = { 비겁: ['비견', '겁재'], 식상: ['식신', '상관'], 재성: ['편재', '정재'], 관성: ['편관', '정관'], 인성: ['편인', '정인'] };
    return map[cat][same ? 0 : 1];
  }
  function diShiCn(dayGan, zhi) {
    var zi = ZHI.indexOf(zhi);
    var idx = CHANG_SHENG_OFFSET[dayGan] + (GAN_YANG[dayGan] ? zi : -zi);
    return CHANG_SHENG_CN[((idx % 12) + 12) % 12];
  }
  function ganzhiIndex(gz) { // 60갑자 순번 0~59
    var g = GAN.indexOf(gz.charAt(0)), z = ZHI.indexOf(gz.charAt(1));
    for (var i = 0; i < 60; i++) if (i % 10 === g && i % 12 === z) return i;
    return -1;
  }
  function ganzhiAt(i) { i = ((i % 60) + 60) % 60; return GAN[i % 10] + ZHI[i % 12]; }

  // ---------------------------------------------------------------- 시간대(IANA) 처리
  var dtfCache = {};
  function dtf(tz) {
    if (!dtfCache[tz]) {
      dtfCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short'
      });
    }
    return dtfCache[tz];
  }
  // 해당 순간(UTC ms)에 그 지역 시계가 UTC보다 몇 분 앞서는지
  function offsetMinutes(tz, utcMs) {
    var p = {};
    dtf(tz).formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var y = +p.year; if (p.era === 'BC' || p.era === 'B') y = 1 - y;
    var asUtc = Date.UTC(y, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
    var base = Math.floor(utcMs / 1000) * 1000;
    return Math.round((asUtc - base) / 60000);
  }
  // 서머타임 판정 (v5): IANA 시간대 자료(TZif)의 서머타임 표시(isdst)에서 뽑은 "표준시 오프셋 이력 표"를 먼저 씀.
  //   표준시 = 그 순간이 속한 이력 구간의 표준 오프셋, 서머타임(분) = 실제 오프셋 − 표준 오프셋.
  //   표에 없는 시간대만 예전 판정식(앞뒤 4년 최저 오프셋보다 60분 이상 크면 60분)을 씀.
  //   표 출처: Python tzdata 2026c 패키지의 TZif 파일(엔진이 쓰는 브라우저·Node Intl 과 같은 IANA 자료). 1900년 이후만.
  var STD_ERAS = {"America/Anchorage":[[null,-600],[436359600000,-540]],"America/Cancun":[[null,-347],[-1514743200000,-360],[378201600000,-300],[410504400000,-360],[877849200000,-300],[909298800000,-360],[1422777600000,-300]],"America/Chicago":[[null,-360],[-1067788800000,-300],[-1045414800000,-360]],"America/Denver":[[null,-420]],"America/Detroit":[[null,-332],[-2051202469000,-360],[-1724083200000,-300]],"America/Edmonton":[[null,-454],[-1998663968000,-420],[1793520000000,-360]],"America/Los_Angeles":[[null,-480]],"America/Manaus":[[null,-240]],"America/Mexico_City":[[null,-397],[-1514739600000,-420],[-1343149200000,-360],[-1234807200000,-420],[-1191344400000,-360]],"America/Monterrey":[[null,-401],[-1514743200000,-420],[-1343149200000,-360],[-1234807200000,-420],[-1191344400000,-360]],"America/New_York":[[null,-300]],"America/Phoenix":[[null,-420]],"America/Sao_Paulo":[[null,-186],[-1767214412000,-180]],"America/Tijuana":[[null,-468],[-1514739600000,-420],[-1451667600000,-480],[-1343145600000,-420],[-1234803600000,-480]],"America/Toronto":[[null,-300]],"America/Vancouver":[[null,-480],[1793523600000,-420]],"Asia/Manila":[[null,480],[-880016400000,540],[-760093200000,480]],"Asia/Seoul":[[null,508],[-1948782472000,510],[-1830414600000,540],[-498128400000,510],[-264933000000,540]],"Asia/Shanghai":[[null,486],[-2177481943000,480]],"Asia/Tokyo":[[null,540]],"Asia/Urumqi":[[null,350],[-1325483420000,360]],"Australia/Adelaide":[[null,570]],"Australia/Brisbane":[[null,600]],"Australia/Melbourne":[[null,600]],"Australia/Perth":[[null,480]],"Australia/Sydney":[[null,600]],"Europe/Berlin":[[null,60]],"Europe/London":[[null,0],[-37242000000,60],[57722400000,0]],"Europe/Paris":[[null,9],[-1855958961000,0],[-857257200000,60]],"Pacific/Auckland":[[null,690],[-757425600000,720]],"Pacific/Honolulu":[[null,-630],[-712150200000,-600]]};
  function stdOffsetFromTable(tz, utcMs) {
    var e = STD_ERAS[tz];
    if (!e) return null;
    var s = e[0][1];
    for (var i = 1; i < e.length; i++) { if (e[i][0] !== null && e[i][0] <= utcMs) s = e[i][1]; else break; }
    return s;
  }
  function dstMinutesHeuristic(tz, utcMs) {
    var o = offsetMinutes(tz, utcMs), min = o;
    for (var k = -49; k <= 49; k++) {
      var v = offsetMinutes(tz, utcMs + k * 30 * 86400000);
      if (v < min) min = v;
    }
    return (o - min) >= 60 ? 60 : 0;
  }
  function dstMinutes(tz, utcMs) {
    var std = stdOffsetFromTable(tz, utcMs);
    if (std === null) return dstMinutesHeuristic(tz, utcMs);
    var d = offsetMinutes(tz, utcMs) - std;
    return d > 0 ? d : 0;
  }
  // 현지 시계 시각 → UTC. 없는 시각(서머타임 시작으로 건너뛴 시각)·두 번 있는 시각(서머타임 종료) 표시
  function wallToUtc(tz, y, m, d, h, mi) {
    var wall = Date.UTC(y, m - 1, d, h, mi);
    var cands = {}, list = [];
    [-86400000, 0, 86400000].forEach(function (s) { cands[offsetMinutes(tz, wall + s)] = true; });
    Object.keys(cands).forEach(function (k) {
      var o = +k, t = wall - o * 60000;
      if (offsetMinutes(tz, t) === o) list.push(t);
    });
    list.sort(function (a, b) { return a - b; });
    if (list.length === 1) return { utcMs: list[0], flag: null };
    if (list.length > 1) return { utcMs: list[0], flag: 'ambiguous' }; // 두 번 있는 시각 → 앞(서머타임) 쪽
    var before = offsetMinutes(tz, wall - 86400000);                   // 없는 시각 → 전날 오프셋으로 해석
    return { utcMs: wall - before * 60000, flag: 'nonexistent' };
  }
  function utcParts(ms) {
    var d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  function fmt(p) {
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return p.y + '-' + z(p.m) + '-' + z(p.d) + ' ' + z(p.h) + ':' + z(p.mi);
  }
  function solarToUtcFromChina(solar) { // 라이브러리 절기 Solar(중국 표준시 UTC+8) → UTC ms
    return Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()) - 8 * 3600000;
  }
  function lunarAtUtc(utcMs) { // 그 순간을 중국 표준시로 표현한 라이브러리 Lunar (연주·월주·절기 판정 전용)
    var p = utcParts(utcMs + 8 * 3600000);
    return Solar.fromYmdHms(p.y, p.m, p.d, p.h, p.mi, p.s).getLunar();
  }

  // 출생 도시 경도표 (경도 출처: Wikidata 좌표 P625 / 위키백과 좌표 API, 2026-09-30 조회. 캐나다 6곳 v3, 해외 10개국 47곳 v4 추가, 모두 Wikidata P625). 열: id, 영어, 한국어, IANA 시간대, 위도, 경도, 나라. 동경 +, 서경 -
  var CITIES = [
    ['seoul', 'Seoul', '서울', 'Asia/Seoul', 37.56, 126.99, 'South Korea'],
    ['busan', 'Busan', '부산', 'Asia/Seoul', 35.18, 129.075, 'South Korea'],
    ['incheon', 'Incheon', '인천', 'Asia/Seoul', 37.4833, 126.6333, 'South Korea'],
    ['daegu', 'Daegu', '대구', 'Asia/Seoul', 35.8717, 128.6017, 'South Korea'],
    ['daejeon', 'Daejeon', '대전', 'Asia/Seoul', 36.35, 127.385, 'South Korea'],
    ['gwangju', 'Gwangju', '광주', 'Asia/Seoul', 35.1653, 126.8486, 'South Korea'],
    ['ulsan', 'Ulsan', '울산', 'Asia/Seoul', 35.55, 129.3167, 'South Korea'],
    ['sejong', 'Sejong', '세종', 'Asia/Seoul', 36.487, 127.2822, 'South Korea'],
    ['suwon', 'Suwon', '수원', 'Asia/Seoul', 37.2858, 127.01, 'South Korea'],
    ['chuncheon', 'Chuncheon', '춘천', 'Asia/Seoul', 37.8747, 127.7342, 'South Korea'],
    ['gangneung', 'Gangneung', '강릉', 'Asia/Seoul', 37.7528, 128.8917, 'South Korea'],
    ['cheongju', 'Cheongju', '청주', 'Asia/Seoul', 36.6333, 127.4833, 'South Korea'],
    ['jeonju', 'Jeonju', '전주', 'Asia/Seoul', 35.8239, 127.1475, 'South Korea'],
    ['pohang', 'Pohang', '포항', 'Asia/Seoul', 36.0322, 129.365, 'South Korea'],
    ['changwon', 'Changwon', '창원', 'Asia/Seoul', 35.2281, 128.6811, 'South Korea'],
    ['jeju', 'Jeju City', '제주', 'Asia/Seoul', 33.5097, 126.5219, 'South Korea'],
    ['newyork', 'New York', '뉴욕', 'America/New_York', 40.7128, -74.0061, 'United States'],
    ['boston', 'Boston', '보스턴', 'America/New_York', 42.3603, -71.0578, 'United States'],
    ['philadelphia', 'Philadelphia', '필라델피아', 'America/New_York', 39.9528, -75.1636, 'United States'],
    ['washington', 'Washington, D.C.', '워싱턴 D.C.', 'America/New_York', 38.895, -77.0367, 'United States'],
    ['atlanta', 'Atlanta', '애틀랜타', 'America/New_York', 33.7489, -84.39, 'United States'],
    ['miami', 'Miami', '마이애미', 'America/New_York', 25.7742, -80.1936, 'United States'],
    ['detroit', 'Detroit', '디트로이트', 'America/Detroit', 42.3317, -83.0458, 'United States'],
    ['chicago', 'Chicago', '시카고', 'America/Chicago', 41.8819, -87.6278, 'United States'],
    ['houston', 'Houston', '휴스턴', 'America/Chicago', 29.7567, -95.3653, 'United States'],
    ['dallas', 'Dallas', '댈러스', 'America/Chicago', 32.7792, -96.8089, 'United States'],
    ['austin', 'Austin', '오스틴', 'America/Chicago', 30.2672, -97.7431, 'United States'],
    ['sanantonio', 'San Antonio', '샌안토니오', 'America/Chicago', 29.425, -98.4939, 'United States'],
    ['minneapolis', 'Minneapolis', '미니애폴리스', 'America/Chicago', 44.9819, -93.2692, 'United States'],
    ['denver', 'Denver', '덴버', 'America/Denver', 39.74, -104.99, 'United States'],
    ['phoenix', 'Phoenix', '피닉스', 'America/Phoenix', 33.4483, -112.0739, 'United States'],
    ['lasvegas', 'Las Vegas', '라스베이거스', 'America/Los_Angeles', 36.1672, -115.1486, 'United States'],
    ['losangeles', 'Los Angeles', '로스앤젤레스', 'America/Los_Angeles', 34.05, -118.25, 'United States'],
    ['sandiego', 'San Diego', '샌디에이고', 'America/Los_Angeles', 32.715, -117.1625, 'United States'],
    ['sanfrancisco', 'San Francisco', '샌프란시스코', 'America/Los_Angeles', 37.775, -122.4194, 'United States'],
    ['sanjose', 'San Jose', '새너제이', 'America/Los_Angeles', 37.3042, -121.8728, 'United States'],
    ['seattle', 'Seattle', '시애틀', 'America/Los_Angeles', 47.605, -122.33, 'United States'],
    ['portland', 'Portland', '포틀랜드', 'America/Los_Angeles', 45.52, -122.6819, 'United States'],
    ['toronto', 'Toronto', '토론토', 'America/Toronto', 43.6703, -79.3867, 'Canada'],
    ['montreal', 'Montreal', '몬트리올', 'America/Toronto', 45.5033, -73.5868, 'Canada'],
    ['ottawa', 'Ottawa', '오타와', 'America/Toronto', 45.4247, -75.695, 'Canada'],
    ['calgary', 'Calgary', '캘거리', 'America/Edmonton', 51.0475, -114.0625, 'Canada'],
    ['edmonton', 'Edmonton', '에드먼턴', 'America/Edmonton', 53.5333, -113.5, 'Canada'],
    ['vancouver', 'Vancouver', '밴쿠버', 'America/Vancouver', 49.2608, -123.1139, 'Canada'],
    ['anchorage', 'Anchorage', '앵커리지', 'America/Anchorage', 61.2167, -149.8936, 'United States'],
    ['honolulu', 'Honolulu', '호놀룰루', 'Pacific/Honolulu', 21.3, -157.85, 'United States'],
    ['london', 'London', '런던', 'Europe/London', 51.5072, -0.1275, 'United Kingdom'],
    ['manchester', 'Manchester', '맨체스터', 'Europe/London', 53.4794, -2.2453, 'United Kingdom'],
    ['birmingham', 'Birmingham', '버밍엄', 'Europe/London', 52.48, -1.9025, 'United Kingdom'],
    ['edinburgh', 'Edinburgh', '에든버러', 'Europe/London', 55.9533, -3.1892, 'United Kingdom'],
    ['glasgow', 'Glasgow', '글래스고', 'Europe/London', 55.8611, -4.25, 'United Kingdom'],
    ['belfast', 'Belfast', '벨파스트', 'Europe/London', 54.5967, -5.93, 'United Kingdom'],
    ['sydney', 'Sydney', '시드니', 'Australia/Sydney', -33.8678, 151.21, 'Australia'],
    ['canberra', 'Canberra', '캔버라', 'Australia/Sydney', -35.2931, 149.1269, 'Australia'],
    ['melbourne', 'Melbourne', '멜버른', 'Australia/Melbourne', -37.8142, 144.9631, 'Australia'],
    ['brisbane', 'Brisbane', '브리즈번', 'Australia/Brisbane', -27.4678, 153.0278, 'Australia'],
    ['adelaide', 'Adelaide', '애들레이드', 'Australia/Adelaide', -34.9275, 138.6, 'Australia'],
    ['perth', 'Perth', '퍼스', 'Australia/Perth', -31.9558, 115.8597, 'Australia'],
    ['auckland', 'Auckland', '오클랜드', 'Pacific/Auckland', -36.8492, 174.7653, 'New Zealand'],
    ['wellington', 'Wellington', '웰링턴', 'Pacific/Auckland', -41.2889, 174.7772, 'New Zealand'],
    ['christchurch', 'Christchurch', '크라이스트처치', 'Pacific/Auckland', -43.5311, 172.6361, 'New Zealand'],
    ['manila', 'Manila', '마닐라', 'Asia/Manila', 14.5958, 120.9772, 'Philippines'],
    ['quezon', 'Quezon City', '케손시티', 'Asia/Manila', 14.65, 121.0475, 'Philippines'],
    ['cebu', 'Cebu City', '세부', 'Asia/Manila', 10.293, 123.902, 'Philippines'],
    ['davao', 'Davao City', '다바오', 'Asia/Manila', 7.0662, 125.6094, 'Philippines'],
    ['tokyo', 'Tokyo', '도쿄', 'Asia/Tokyo', 35.6894, 139.6917, 'Japan'],
    ['osaka', 'Osaka', '오사카', 'Asia/Tokyo', 34.6938, 135.5021, 'Japan'],
    ['nagoya', 'Nagoya', '나고야', 'Asia/Tokyo', 35.1814, 136.9064, 'Japan'],
    ['sapporo', 'Sapporo', '삿포로', 'Asia/Tokyo', 43.0619, 141.3544, 'Japan'],
    ['fukuoka', 'Fukuoka', '후쿠오카', 'Asia/Tokyo', 33.5901, 130.4017, 'Japan'],
    ['beijing', 'Beijing', '베이징', 'Asia/Shanghai', 39.904, 116.4075, 'China'],
    ['shanghai', 'Shanghai', '상하이', 'Asia/Shanghai', 31.2325, 121.4692, 'China'],
    ['guangzhou', 'Guangzhou', '광저우', 'Asia/Shanghai', 23.13, 113.26, 'China'],
    ['chengdu', 'Chengdu', '청두', 'Asia/Shanghai', 30.66, 104.0633, 'China'],
    ['urumqi', 'Urumqi', '우루무치', 'Asia/Shanghai', 43.8225, 87.6125, 'China'],
    ['berlin', 'Berlin', '베를린', 'Europe/Berlin', 52.5167, 13.3833, 'Germany'],
    ['hamburg', 'Hamburg', '함부르크', 'Europe/Berlin', 53.55, 10, 'Germany'],
    ['munich', 'Munich', '뮌헨', 'Europe/Berlin', 48.1375, 11.575, 'Germany'],
    ['frankfurt', 'Frankfurt', '프랑크푸르트', 'Europe/Berlin', 50.1106, 8.6822, 'Germany'],
    ['cologne', 'Cologne', '쾰른', 'Europe/Berlin', 50.9422, 6.9578, 'Germany'],
    ['paris', 'Paris', '파리', 'Europe/Paris', 48.8567, 2.3522, 'France'],
    ['marseille', 'Marseille', '마르세유', 'Europe/Paris', 43.2967, 5.3764, 'France'],
    ['lyon', 'Lyon', '리옹', 'Europe/Paris', 45.7675, 4.835, 'France'],
    ['toulouse', 'Toulouse', '툴루즈', 'Europe/Paris', 43.6044, 1.4433, 'France'],
    ['mexicocity', 'Mexico City', '멕시코시티', 'America/Mexico_City', 19.3538, -99.1359, 'Mexico'],
    ['guadalajara', 'Guadalajara', '과달라하라', 'America/Mexico_City', 20.6764, -103.3422, 'Mexico'],
    ['monterrey', 'Monterrey', '몬테레이', 'America/Monterrey', 25.6844, -100.3181, 'Mexico'],
    ['tijuana', 'Tijuana', '티후아나', 'America/Tijuana', 32.5364, -117.0372, 'Mexico'],
    ['cancun', 'Cancun', '칸쿤', 'America/Cancun', 21.1614, -86.8248, 'Mexico'],
    ['saopaulo', 'Sao Paulo', '상파울루', 'America/Sao_Paulo', -23.5504, -46.6339, 'Brazil'],
    ['riodejaneiro', 'Rio de Janeiro', '리우데자네이루', 'America/Sao_Paulo', -22.9111, -43.2056, 'Brazil'],
    ['brasilia', 'Brasilia', '브라질리아', 'America/Sao_Paulo', -15.7939, -47.8828, 'Brazil'],
    ['manaus', 'Manaus', '마나우스', 'America/Manaus', -3.1189, -60.0217, 'Brazil']
  ];
  var CITY_BY_ID = {};
  CITIES.forEach(function (c) { CITY_BY_ID[c[0]] = { id: c[0], name: c[1], nameKo: c[2], timeZone: c[3], lat: c[4], lon: c[5], country: c[6] }; });

  // ---------------------------------------------------------------- 태양시 보정 (v2)
  // 균시차(equation of time, 분). 출처: NOAA Global Monitoring Laboratory "General Solar Position Calculations"
  //   γ = 2π/365 × (day_of_year − 1 + (hour − 12)/24)  (윤년 366)
  //   eqtime = 229.18 × (0.000075 + 0.001868cosγ − 0.032077sinγ − 0.014615cos2γ − 0.040849sin2γ)
  function equationOfTime(utcMs) {
    var d = new Date(utcMs), y = d.getUTCFullYear();
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    var doy = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
    var hour = d.getUTCHours() + d.getUTCMinutes() / 60;
    var g = 2 * Math.PI / (leap ? 366 : 365) * (doy - 1 + (hour - 12) / 24);
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }
  // 경도 보정(분) = (도시 경도 − 표준 자오선 경도) × 4.  표준 자오선 = 그 순간 표준시 UTC 차이(분) ÷ 4
  // (NOAA 같은 문서의 time_offset = eqtime + 4×longitude − 60×timezone 에서 균시차를 뺀 부분)
  function solarCorrection(mode, lon, stdOffsetMin, utcMs) {
    var meridian = stdOffsetMin / 4;
    var out = { mode: mode, longitude: lon, standardMeridian: meridian, meanMinutes: null, eotMinutes: null, appliedMinutes: 0 };
    if (lon == null || isNaN(lon)) { out.mode = 'off'; return out; }
    out.meanMinutes = Math.round((lon - meridian) * 4 * 10) / 10;
    out.eotMinutes = Math.round(equationOfTime(utcMs) * 10) / 10;
    if (mode === 'mean') out.appliedMinutes = (lon - meridian) * 4;
    else if (mode === 'true') out.appliedMinutes = (lon - meridian) * 4 + equationOfTime(utcMs);
    else out.mode = 'off';
    out.appliedMinutes = Math.round(out.appliedMinutes * 10) / 10;
    return out;
  }

  // ---------------------------------------------------------------- 신강·신약 점수
  // 위치 가중치(합 100, 일간 제외): 우리 체계의 설정값. 월지 30은 "월령을 가장 무겁게 본다"는 자평진전 원칙을 숫자로 옮긴 것.
  var STRENGTH_WEIGHTS = { yearGan: 10, monthGan: 10, timeGan: 10, yearZhi: 10, monthZhi: 30, dayZhi: 15, timeZhi: 15 };
  // 50 이상 신강(돕는 힘이 절반 이상 = 억부의 균형점), 35 미만 신약, 그 사이 중화. 35는 표본 분포(1950~2010년생)에서 '신약'이 과반이 되지 않게 잡은 우리 체계의 설정값
  var STRENGTH_CUTS = { strong: 50, weak: 35 };
  function helps(dayGan, otherGan) {
    var r = relationOf(GAN_EL[dayGan], GAN_EL[otherGan]);
    return r === '비겁' || r === '인성';
  }
  function branchHelp(dayGan, zhi) {
    var sum = 0, root = 0;
    HIDDEN_DAYS[zhi].forEach(function (hd) {
      if (helps(dayGan, hd[0])) sum += hd[1] / 30;
      if (GAN_EL[hd[0]] === GAN_EL[dayGan]) root += hd[1] / 30;
    });
    return { help: sum, root: root };
  }
  function strengthScore(p, timeUnknown) {
    var dg = p.day.charAt(0);
    var items = [
      ['yearGan', p.year.charAt(0), 'gan'], ['monthGan', p.month.charAt(0), 'gan'],
      ['yearZhi', p.year.charAt(1), 'zhi'], ['monthZhi', p.month.charAt(1), 'zhi'], ['dayZhi', p.day.charAt(1), 'zhi']
    ];
    if (!timeUnknown && p.time) { items.push(['timeGan', p.time.charAt(0), 'gan'], ['timeZhi', p.time.charAt(1), 'zhi']); }
    var got = 0, total = 0, detail = [], roots = [];
    items.forEach(function (it) {
      var w = STRENGTH_WEIGHTS[it[0]], v, r = 0;
      if (it[2] === 'gan') { v = helps(dg, it[1]) ? 1 : 0; }
      else { var b = branchHelp(dg, it[1]); v = b.help; r = b.root; if (r > 0) roots.push({ position: it[0], branch: it[1], rootShare: Math.round(r * 100) / 100 }); }
      got += w * v; total += w;
      detail.push({ position: it[0], char: it[1], weight: w, helpShare: Math.round(v * 100) / 100, points: Math.round(w * v * 10) / 10 });
    });
    var score = Math.round(got / total * 1000) / 10;
    var verdict = score >= STRENGTH_CUTS.strong ? '신강' : score < STRENGTH_CUTS.weak ? '신약' : '중화';
    var monthHelp = branchHelp(dg, p.month.charAt(1)).help;
    return {
      score: score, verdict: verdict, verdictEn: verdict === '신강' ? 'Strong' : verdict === '신약' ? 'Weak' : 'Balanced',
      deukRyeong: monthHelp >= 0.5, monthBranchHelpShare: Math.round(monthHelp * 100) / 100,
      roots: roots, hasRoot: roots.length > 0, detail: detail,
      weights: STRENGTH_WEIGHTS, cuts: STRENGTH_CUTS, maxPoints: total
    };
  }

  // ---------------------------------------------------------------- 대운
  function luckCycles(ctx, chartType) { // chartType: 'male' | 'female'
    var yearYang = GAN_YANG[ctx.pillars.year.charAt(0)];
    var forward = (yearYang && chartType === 'male') || (!yearYang && chartType === 'female');
    var jie = forward ? ctx.nextJie : ctx.prevJie;
    var diffMin = Math.abs(jie.utcMs - ctx.birthUtcMs) / 60000;
    var exactYears = diffMin / 4320;               // 3일(4,320분) = 1년
    var startAge = Math.floor(exactYears + 0.5);   // 0.5 이상 올림, 만 나이
    var rem = diffMin;
    var yy = Math.floor(rem / 4320); rem -= yy * 4320;
    var mm = Math.floor(rem / 360); rem -= mm * 360; // 1일(1,440분) = 4개월 → 360분 = 1개월
    var dd = Math.floor(rem / 12); rem -= dd * 12;   // 2시간(120분) = 10일 → 12분 = 1일
    var mIdx = ganzhiIndex(ctx.pillars.month);
    var list = [];
    for (var k = 1; k <= 10; k++) {
      var gz = ganzhiAt(mIdx + (forward ? k : -k));
      var age = startAge + (k - 1) * 10;
      list.push({ index: k, ganzhi: gz, startAge: age, endAge: age + 9, startYearApprox: ctx.birthLocal.y + age });
    }
    var startDate = new Date(ctx.birthUtcMs + exactYears * 365.2422 * 86400000);
    return {
      chartType: chartType, forward: forward, directionKo: forward ? '순행' : '역행',
      fromTerm: jie.name, fromTermUtc: fmt(utcParts(jie.utcMs)) + ' UTC', fromTermLocal: jie.local,
      minutesToTerm: Math.round(diffMin), exactYears: Math.round(exactYears * 1000) / 1000,
      startAge: startAge, startYMD: { years: yy, months: mm, days: dd },
      startDateApprox: startDate.toISOString().slice(0, 10), cycles: list
    };
  }

  // [5차b] 한국 음력 보정표: 쓰고 있는 음력 라이브러리는 중국 표준시(UTC+8) 기준이라 한국(UTC+9) 음력과 다른 달이 있음.
  // [만세력검증 수정사본 2026-10-04] 1900~2026 중 중국 음력과 다른 해 전부를 KASI 정본(manseryeok 2.0.0 경유, 대표 사례 KASI 직접 확인) 값으로 보정. 원래 주석: 확인된 해(1997·2012·2017)만 한국천문연구원 월별 음양력(astro.kasi.re.kr/life/pageView/5, 2026-10-04 조회) 값으로 보정. 다른 해는 라이브러리 그대로.
  var KOREAN_LUNAR_FIX = {"1914":[[1,"1914-01-26",30],[2,"1914-02-25",30],[3,"1914-03-27",29],[4,"1914-04-25",30],[5,"1914-05-25",30],[-5,"1914-06-24",29],[6,"1914-07-23",29],[7,"1914-08-21",30],[8,"1914-09-20",29],[9,"1914-10-19",30],[10,"1914-11-18",29],[11,"1914-12-17",29],[12,"1915-01-15",30]],"1915":[[1,"1915-02-14",30],[2,"1915-03-16",29],[3,"1915-04-14",30],[4,"1915-05-14",30],[5,"1915-06-13",29],[6,"1915-07-12",30],[7,"1915-08-11",29],[8,"1915-09-09",30],[9,"1915-10-09",29],[10,"1915-11-07",30],[11,"1915-12-07",29],[12,"1916-01-05",30]],"1916":[[1,"1916-02-04",29],[2,"1916-03-04",30],[3,"1916-04-03",29],[4,"1916-05-02",30],[5,"1916-06-01",29],[6,"1916-06-30",30],[7,"1916-07-30",30],[8,"1916-08-29",29],[9,"1916-09-27",30],[10,"1916-10-27",29],[11,"1916-11-25",30],[12,"1916-12-25",29]],"1918":[[1,"1918-02-11",30],[2,"1918-03-13",29],[3,"1918-04-11",29],[4,"1918-05-10",30],[5,"1918-06-09",29],[6,"1918-07-08",30],[7,"1918-08-07",29],[8,"1918-09-05",30],[9,"1918-10-05",30],[10,"1918-11-04",30],[11,"1918-12-04",29],[12,"1919-01-02",30]],"1919":[[1,"1919-02-01",29],[2,"1919-03-02",30],[3,"1919-04-01",29],[4,"1919-04-30",29],[5,"1919-05-29",30],[6,"1919-06-28",29],[7,"1919-07-27",30],[-7,"1919-08-26",29],[8,"1919-09-24",30],[9,"1919-10-24",30],[10,"1919-11-23",29],[11,"1919-12-22",30],[12,"1920-01-21",30]],"1920":[[1,"1920-02-20",29],[2,"1920-03-20",30],[3,"1920-04-19",29],[4,"1920-05-18",29],[5,"1920-06-16",30],[6,"1920-07-16",29],[7,"1920-08-14",29],[8,"1920-09-12",30],[9,"1920-10-12",30],[10,"1920-11-11",29],[11,"1920-12-10",30],[12,"1921-01-09",30]],"1923":[[1,"1923-02-16",29],[2,"1923-03-17",30],[3,"1923-04-16",30],[4,"1923-05-16",29],[5,"1923-06-14",30],[6,"1923-07-14",29],[7,"1923-08-12",30],[8,"1923-09-11",29],[9,"1923-10-10",30],[10,"1923-11-09",29],[11,"1923-12-08",29],[12,"1924-01-06",30]],"1924":[[1,"1924-02-05",30],[2,"1924-03-06",29],[3,"1924-04-04",30],[4,"1924-05-04",29],[5,"1924-06-02",30],[6,"1924-07-02",30],[7,"1924-08-01",29],[8,"1924-08-30",30],[9,"1924-09-29",29],[10,"1924-10-28",30],[11,"1924-11-27",29],[12,"1924-12-26",29]],"1925":[[1,"1925-01-24",30],[2,"1925-02-23",29],[3,"1925-03-24",30],[4,"1925-04-23",30],[-4,"1925-05-23",29],[5,"1925-06-21",30],[6,"1925-07-21",29],[7,"1925-08-19",30],[8,"1925-09-18",30],[9,"1925-10-18",29],[10,"1925-11-16",30],[11,"1925-12-16",29],[12,"1926-01-14",30]],"1927":[[1,"1927-02-02",30],[2,"1927-03-04",29],[3,"1927-04-02",29],[4,"1927-05-01",30],[5,"1927-05-31",29],[6,"1927-06-29",30],[7,"1927-07-29",29],[8,"1927-08-27",30],[9,"1927-09-26",30],[10,"1927-10-26",29],[11,"1927-11-24",30],[12,"1927-12-24",30]],"1928":[[1,"1928-01-23",29],[2,"1928-02-21",30],[-2,"1928-03-22",29],[3,"1928-04-20",29],[4,"1928-05-19",30],[5,"1928-06-18",29],[6,"1928-07-17",29],[7,"1928-08-15",30],[8,"1928-09-14",30],[9,"1928-10-14",29],[10,"1928-11-12",30],[11,"1928-12-12",30],[12,"1929-01-11",30]],"1931":[[1,"1931-02-17",30],[2,"1931-03-19",30],[3,"1931-04-18",30],[4,"1931-05-18",29],[5,"1931-06-16",29],[6,"1931-07-15",30],[7,"1931-08-14",29],[8,"1931-09-12",29],[9,"1931-10-11",30],[10,"1931-11-10",29],[11,"1931-12-09",30],[12,"1932-01-08",29]],"1934":[[1,"1934-02-14",29],[2,"1934-03-15",30],[3,"1934-04-14",29],[4,"1934-05-13",30],[5,"1934-06-12",30],[6,"1934-07-12",29],[7,"1934-08-10",30],[8,"1934-09-09",30],[9,"1934-10-09",29],[10,"1934-11-07",30],[11,"1934-12-07",29],[12,"1935-01-05",30]],"1936":[[1,"1936-01-24",30],[2,"1936-02-23",29],[3,"1936-03-23",29],[-3,"1936-04-21",30],[4,"1936-05-21",29],[5,"1936-06-19",30],[6,"1936-07-19",29],[7,"1936-08-17",30],[8,"1936-09-16",29],[9,"1936-10-15",30],[10,"1936-11-14",30],[11,"1936-12-14",30],[12,"1937-01-13",29]],"1942":[[1,"1942-02-15",30],[2,"1942-03-17",29],[3,"1942-04-15",30],[4,"1942-05-15",30],[5,"1942-06-14",29],[6,"1942-07-13",30],[7,"1942-08-12",30],[8,"1942-09-11",29],[9,"1942-10-10",30],[10,"1942-11-09",29],[11,"1942-12-08",29],[12,"1943-01-06",30]],"1943":[[1,"1943-02-05",29],[2,"1943-03-06",30],[3,"1943-04-05",29],[4,"1943-05-04",30],[5,"1943-06-03",29],[6,"1943-07-02",30],[7,"1943-08-01",30],[8,"1943-08-31",29],[9,"1943-09-29",30],[10,"1943-10-29",30],[11,"1943-11-28",29],[12,"1943-12-27",30]],"1944":[[1,"1944-01-26",29],[2,"1944-02-24",29],[3,"1944-03-24",30],[4,"1944-04-23",29],[-4,"1944-05-22",30],[5,"1944-06-21",29],[6,"1944-07-20",30],[7,"1944-08-19",29],[8,"1944-09-17",30],[9,"1944-10-17",30],[10,"1944-11-16",29],[11,"1944-12-15",30],[12,"1945-01-14",30]],"1949":[[1,"1949-01-29",30],[2,"1949-02-28",30],[3,"1949-03-30",29],[4,"1949-04-28",30],[5,"1949-05-28",29],[6,"1949-06-26",30],[7,"1949-07-26",29],[-7,"1949-08-24",29],[8,"1949-09-22",30],[9,"1949-10-22",29],[10,"1949-11-20",30],[11,"1949-12-20",29],[12,"1950-01-18",30]],"1950":[[1,"1950-02-17",30],[2,"1950-03-19",29],[3,"1950-04-17",30],[4,"1950-05-17",30],[5,"1950-06-16",29],[6,"1950-07-15",30],[7,"1950-08-14",29],[8,"1950-09-12",29],[9,"1950-10-11",30],[10,"1950-11-10",29],[11,"1950-12-09",30],[12,"1951-01-08",29]],"1952":[[1,"1952-01-27",29],[2,"1952-02-25",30],[3,"1952-03-26",29],[4,"1952-04-24",30],[5,"1952-05-24",29],[-5,"1952-06-22",30],[6,"1952-07-22",30],[7,"1952-08-21",29],[8,"1952-09-19",30],[9,"1952-10-19",29],[10,"1952-11-17",30],[11,"1952-12-17",29],[12,"1953-01-15",30]],"1953":[[1,"1953-02-14",29],[2,"1953-03-15",30],[3,"1953-04-14",29],[4,"1953-05-13",29],[5,"1953-06-11",30],[6,"1953-07-11",30],[7,"1953-08-10",29],[8,"1953-09-08",30],[9,"1953-10-08",30],[10,"1953-11-07",29],[11,"1953-12-06",30],[12,"1954-01-05",30]],"1954":[[1,"1954-02-04",29],[2,"1954-03-05",29],[3,"1954-04-03",30],[4,"1954-05-03",29],[5,"1954-06-01",29],[6,"1954-06-30",30],[7,"1954-07-30",29],[8,"1954-08-28",30],[9,"1954-09-27",30],[10,"1954-10-27",29],[11,"1954-11-25",30],[12,"1954-12-25",30]],"1955":[[1,"1955-01-24",30],[2,"1955-02-23",29],[3,"1955-03-24",29],[-3,"1955-04-22",30],[4,"1955-05-22",29],[5,"1955-06-20",29],[6,"1955-07-19",30],[7,"1955-08-18",29],[8,"1955-09-16",30],[9,"1955-10-16",29],[10,"1955-11-14",30],[11,"1955-12-14",30],[12,"1956-01-13",30]],"1957":[[1,"1957-01-31",30],[2,"1957-03-02",29],[3,"1957-03-31",30],[4,"1957-04-30",29],[5,"1957-05-29",30],[6,"1957-06-28",29],[7,"1957-07-27",29],[8,"1957-08-25",30],[-8,"1957-09-24",29],[9,"1957-10-23",30],[10,"1957-11-22",29],[11,"1957-12-21",30],[12,"1958-01-20",30]],"1958":[[1,"1958-02-19",29],[2,"1958-03-20",30],[3,"1958-04-19",30],[4,"1958-05-19",29],[5,"1958-06-17",30],[6,"1958-07-17",29],[7,"1958-08-15",29],[8,"1958-09-13",30],[9,"1958-10-13",29],[10,"1958-11-11",30],[11,"1958-12-11",29],[12,"1959-01-09",30]],"1965":[[1,"1965-02-02",29],[2,"1965-03-03",30],[3,"1965-04-02",29],[4,"1965-05-01",30],[5,"1965-05-31",29],[6,"1965-06-29",29],[7,"1965-07-28",30],[8,"1965-08-27",29],[9,"1965-09-25",29],[10,"1965-10-24",30],[11,"1965-11-23",30],[12,"1965-12-23",30]],"1966":[[1,"1966-01-22",29],[2,"1966-02-20",30],[3,"1966-03-22",30],[-3,"1966-04-21",29],[4,"1966-05-20",30],[5,"1966-06-19",29],[6,"1966-07-18",29],[7,"1966-08-16",30],[8,"1966-09-15",29],[9,"1966-10-14",29],[10,"1966-11-12",30],[11,"1966-12-12",30],[12,"1967-01-11",29]],"1968":[[1,"1968-01-30",29],[2,"1968-02-28",30],[3,"1968-03-29",30],[4,"1968-04-28",29],[5,"1968-05-27",30],[6,"1968-06-26",29],[7,"1968-07-25",30],[-7,"1968-08-24",29],[8,"1968-09-22",30],[9,"1968-10-22",29],[10,"1968-11-20",30],[11,"1968-12-20",29],[12,"1969-01-18",30]],"1970":[[1,"1970-02-06",30],[2,"1970-03-08",29],[3,"1970-04-06",29],[4,"1970-05-05",30],[5,"1970-06-04",30],[6,"1970-07-04",29],[7,"1970-08-02",30],[8,"1970-09-01",29],[9,"1970-09-30",30],[10,"1970-10-30",30],[11,"1970-11-29",29],[12,"1970-12-28",30]],"1972":[[1,"1972-02-15",29],[2,"1972-03-15",30],[3,"1972-04-14",29],[4,"1972-05-13",29],[5,"1972-06-11",30],[6,"1972-07-11",29],[7,"1972-08-09",30],[8,"1972-09-08",29],[9,"1972-10-07",30],[10,"1972-11-06",30],[11,"1972-12-06",30],[12,"1973-01-05",29]],"1973":[[1,"1973-02-03",30],[2,"1973-03-05",29],[3,"1973-04-03",30],[4,"1973-05-03",29],[5,"1973-06-01",29],[6,"1973-06-30",30],[7,"1973-07-30",29],[8,"1973-08-28",29],[9,"1973-09-26",30],[10,"1973-10-26",30],[11,"1973-11-25",30],[12,"1973-12-25",29]],"1976":[[1,"1976-01-31",30],[2,"1976-03-01",30],[3,"1976-03-31",29],[4,"1976-04-29",30],[5,"1976-05-29",29],[6,"1976-06-27",30],[7,"1976-07-27",29],[8,"1976-08-25",30],[-8,"1976-09-24",29],[9,"1976-10-23",30],[10,"1976-11-22",29],[11,"1976-12-21",29],[12,"1977-01-19",30]],"1978":[[1,"1978-02-07",30],[2,"1978-03-09",30],[3,"1978-04-08",29],[4,"1978-05-07",30],[5,"1978-06-06",29],[6,"1978-07-05",30],[7,"1978-08-04",30],[8,"1978-09-03",29],[9,"1978-10-02",30],[10,"1978-11-01",29],[11,"1978-11-30",30],[12,"1978-12-30",29]],"1982":[[1,"1982-01-25",30],[2,"1982-02-24",29],[3,"1982-03-25",30],[4,"1982-04-24",29],[-4,"1982-05-23",29],[5,"1982-06-21",30],[6,"1982-07-21",29],[7,"1982-08-19",29],[8,"1982-09-17",30],[9,"1982-10-17",30],[10,"1982-11-16",29],[11,"1982-12-15",30],[12,"1983-01-14",30]],"1987":[[1,"1987-01-29",30],[2,"1987-02-28",29],[3,"1987-03-29",30],[4,"1987-04-28",30],[5,"1987-05-28",29],[6,"1987-06-26",30],[-6,"1987-07-26",29],[7,"1987-08-24",30],[8,"1987-09-23",30],[9,"1987-10-23",29],[10,"1987-11-21",30],[11,"1987-12-21",29],[12,"1988-01-19",30]],"1988":[[1,"1988-02-18",29],[2,"1988-03-18",29],[3,"1988-04-16",30],[4,"1988-05-16",29],[5,"1988-06-14",30],[6,"1988-07-14",29],[7,"1988-08-12",30],[8,"1988-09-11",30],[9,"1988-10-11",29],[10,"1988-11-09",30],[11,"1988-12-09",30],[12,"1989-01-08",29]],"1989":[[1,"1989-02-06",30],[2,"1989-03-08",29],[3,"1989-04-06",29],[4,"1989-05-05",30],[5,"1989-06-04",29],[6,"1989-07-03",30],[7,"1989-08-02",29],[8,"1989-08-31",30],[9,"1989-09-30",30],[10,"1989-10-30",29],[11,"1989-11-28",30],[12,"1989-12-28",30]],"1990":[[1,"1990-01-27",29],[2,"1990-02-25",30],[3,"1990-03-27",29],[4,"1990-04-25",29],[5,"1990-05-24",30],[-5,"1990-06-23",29],[6,"1990-07-22",29],[7,"1990-08-20",30],[8,"1990-09-19",30],[9,"1990-10-19",29],[10,"1990-11-17",30],[11,"1990-12-17",30],[12,"1991-01-16",30]],"1995":[[1,"1995-01-31",29],[2,"1995-03-01",30],[3,"1995-03-31",30],[4,"1995-04-30",29],[5,"1995-05-29",30],[6,"1995-06-28",30],[7,"1995-07-28",29],[8,"1995-08-26",30],[-8,"1995-09-25",29],[9,"1995-10-24",30],[10,"1995-11-23",29],[11,"1995-12-22",29],[12,"1996-01-20",30]],"1996":[[1,"1996-02-19",29],[2,"1996-03-19",30],[3,"1996-04-18",29],[4,"1996-05-17",30],[5,"1996-06-16",30],[6,"1996-07-16",29],[7,"1996-08-14",30],[8,"1996-09-13",29],[9,"1996-10-12",30],[10,"1996-11-11",30],[11,"1996-12-11",29],[12,"1997-01-09",30]],"1997":[[1,"1997-02-08",29],[2,"1997-03-09",29],[3,"1997-04-07",30],[4,"1997-05-07",29],[5,"1997-06-05",30],[6,"1997-07-05",29],[7,"1997-08-03",30],[8,"1997-09-02",30],[9,"1997-10-02",29],[10,"1997-10-31",30],[11,"1997-11-30",30],[12,"1997-12-30",29]],"1998":[[1,"1998-01-28",30],[2,"1998-02-27",29],[3,"1998-03-28",29],[4,"1998-04-26",30],[5,"1998-05-26",29],[-5,"1998-06-24",29],[6,"1998-07-23",30],[7,"1998-08-22",30],[8,"1998-09-21",29],[9,"1998-10-20",30],[10,"1998-11-19",30],[11,"1998-12-19",30],[12,"1999-01-18",29]],"2001":[[1,"2001-01-24",30],[2,"2001-02-23",30],[3,"2001-03-25",30],[4,"2001-04-24",29],[-4,"2001-05-23",29],[5,"2001-06-21",30],[6,"2001-07-21",29],[7,"2001-08-19",29],[8,"2001-09-17",30],[9,"2001-10-17",29],[10,"2001-11-15",30],[11,"2001-12-15",29],[12,"2002-01-13",30]],"2005":[[1,"2005-02-09",29],[2,"2005-03-10",30],[3,"2005-04-09",29],[4,"2005-05-08",30],[5,"2005-06-07",29],[6,"2005-07-06",30],[7,"2005-08-05",30],[8,"2005-09-04",29],[9,"2005-10-03",30],[10,"2005-11-02",30],[11,"2005-12-02",29],[12,"2005-12-31",29]],"2012":[[1,"2012-01-23",30],[2,"2012-02-22",29],[3,"2012-03-22",30],[-3,"2012-04-21",30],[4,"2012-05-21",30],[5,"2012-06-20",29],[6,"2012-07-19",30],[7,"2012-08-18",29],[8,"2012-09-16",29],[9,"2012-10-15",30],[10,"2012-11-14",29],[11,"2012-12-13",30],[12,"2013-01-12",29]],"2013":[[1,"2013-02-10",30],[2,"2013-03-12",29],[3,"2013-04-10",30],[4,"2013-05-10",30],[5,"2013-06-09",29],[6,"2013-07-08",30],[7,"2013-08-07",29],[8,"2013-09-05",30],[9,"2013-10-05",29],[10,"2013-11-03",30],[11,"2013-12-03",29],[12,"2014-01-01",30]],"2017":[[1,"2017-01-28",29],[2,"2017-02-26",30],[3,"2017-03-28",29],[4,"2017-04-26",30],[5,"2017-05-26",29],[-5,"2017-06-24",29],[6,"2017-07-23",30],[7,"2017-08-22",29],[8,"2017-09-20",30],[9,"2017-10-20",29],[10,"2017-11-18",30],[11,"2017-12-18",30],[12,"2018-01-17",30]],"2019":[[1,"2019-02-05",30],[2,"2019-03-07",29],[3,"2019-04-05",30],[4,"2019-05-05",29],[5,"2019-06-03",30],[6,"2019-07-03",29],[7,"2019-08-01",29],[8,"2019-08-30",30],[9,"2019-09-29",29],[10,"2019-10-28",30],[11,"2019-11-27",29],[12,"2019-12-26",30]],"2020":[[1,"2020-01-25",30],[2,"2020-02-24",29],[3,"2020-03-24",30],[4,"2020-04-23",30],[-4,"2020-05-23",29],[5,"2020-06-21",30],[6,"2020-07-21",29],[7,"2020-08-19",29],[8,"2020-09-17",30],[9,"2020-10-17",29],[10,"2020-11-15",30],[11,"2020-12-15",29],[12,"2021-01-13",30]],"2023":[[1,"2023-01-22",29],[2,"2023-02-20",30],[-2,"2023-03-22",29],[3,"2023-04-20",30],[4,"2023-05-20",29],[5,"2023-06-18",30],[6,"2023-07-18",29],[7,"2023-08-16",30],[8,"2023-09-15",30],[9,"2023-10-15",29],[10,"2023-11-13",30],[11,"2023-12-13",29],[12,"2024-01-11",30]],"2026":[[1,"2026-02-17",30],[2,"2026-03-19",29],[3,"2026-04-17",30],[4,"2026-05-17",29],[5,"2026-06-15",29],[6,"2026-07-14",30],[7,"2026-08-13",29],[8,"2026-09-11",30],[9,"2026-10-11",29],[10,"2026-11-09",30],[11,"2026-12-09",30],[12,"2027-01-08",30]]};
  function koreanLunarFix(y, signedMonth, d) {
    var tab = KOREAN_LUNAR_FIX[y];
    if (!tab) return null;
    for (var i = 0; i < tab.length; i++) {
      if (tab[i][0] !== signedMonth) continue;
      if (!(d >= 1 && d <= tab[i][2])) throw new Error('no such lunar day');
      var s = tab[i][1].split('-'), t = new Date(Date.UTC(+s[0], +s[1] - 1, +s[2] + d - 1));
      return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
    }
    throw new Error('no such lunar month');
  }
  // ---------------------------------------------------------------- 메인 계산
  /**
   * calculate(input)
   * input = { year, month, day, hour, minute, calendar:'solar'|'lunar', isLeapMonth, timeUnknown,
   *           timeZone:'Asia/Seoul', luckDirection:'male'|'female'|'both' }
   */
  function calculate(input) {
    var city = input.city && CITY_BY_ID[input.city] ? CITY_BY_ID[input.city] : null;
    var tz = city ? city.timeZone : (input.timeZone || 'Asia/Seoul');
    var lon = city ? city.lon : (input.longitude != null ? +input.longitude : null);
    var solarMode = input.solarTimeMode || 'mean';          // v2 기본값: 평균태양시(도시 경도) 켜짐
    var lateZi = input.lateZi === 'birth' ? 'birth' : 'next'; // v2 기본값: 23시대 = 다음 날
    var timeUnknown = !!input.timeUnknown;
    var y = +input.year, m = +input.month, d = +input.day;
    var h = timeUnknown ? 12 : +(input.hour || 0), mi = timeUnknown ? 0 : +(input.minute || 0);
    if (input.calendar === 'lunar') {
      var kl = koreanLunarFix(y, input.isLeapMonth ? -m : m, d);
      if (kl) { y = kl[0]; m = kl[1]; d = kl[2]; }
      else {
        var ls = Lunar.fromYmd(y, input.isLeapMonth ? -m : m, d).getSolar();
        y = ls.getYear(); m = ls.getMonth(); d = ls.getDay();
      }
    }
    var conv = wallToUtc(tz, y, m, d, h, mi);
    var utcMs = conv.utcMs;
    var off = offsetMinutes(tz, utcMs), dst = dstMinutes(tz, utcMs);
    var std = utcParts(utcMs + (off - dst) * 60000);   // 출생지 표준시(서머타임 뺀 시각)
    // v2: 일주·시주 기준 시각 = 표준시 + 경도 보정(+ 진태양시면 균시차). 연주·월주는 UTC 비교라 영향 없음
    var corr = solarCorrection(timeUnknown ? 'off' : solarMode, lon, off - dst, utcMs);
    var eff = utcParts(utcMs + (off - dst) * 60000 + Math.round(corr.appliedMinutes * 60000));
    var lateZiApplies = !timeUnknown && eff.h === 23;

    // 연주·월주: UTC 순간 기준(= 라이브러리 중국 표준시로 바꿔 판정)
    var bjLunar = lunarAtUtc(utcMs);
    var yearGZ = bjLunar.getYearInGanZhiExact(), monthGZ = bjLunar.getMonthInGanZhiExact();
    // 일주·시주: 출생지 표준시 기준, 23시대 = 다음 날 일주(sect 1, 현행 유지)
    var localEc = Solar.fromYmdHms(eff.y, eff.m, eff.d, eff.h, eff.mi, eff.s).getLunar().getEightChar();
    localEc.setSect(lateZi === 'birth' ? 2 : 1); // sect 1: 23시대 다음 날 일주 / sect 2: 태어난 날 일주 유지(시주 천간은 다음 날 자시 기준)
    var pillars = { year: yearGZ, month: monthGZ, day: localEc.getDay(), time: timeUnknown ? null : localEc.getTime() };

    function jieInfo(j) {
      var u = solarToUtcFromChina(j.getSolar());
      var lo = offsetMinutes(tz, u);
      return { name: j.getName(), utcMs: u, local: fmt(utcParts(u + lo * 60000)) + ' (' + tz + ')' };
    }
    var ctx = {
      pillars: pillars, birthUtcMs: utcMs, birthLocal: { y: y, m: m, d: d, h: h, mi: mi },
      prevJie: jieInfo(bjLunar.getPrevJie()), nextJie: jieInfo(bjLunar.getNextJie())
    };

    // 시간 모름 + 절기 당일: 그날 00:00과 23:59 결과가 다르면 경고
    var termDayWarning = null;
    if (timeUnknown) {
      var a = lunarAtUtc(wallToUtc(tz, y, m, d, 0, 0).utcMs), b = lunarAtUtc(wallToUtc(tz, y, m, d, 23, 59).utcMs);
      if (a.getMonthInGanZhiExact() !== b.getMonthInGanZhiExact()) {
        termDayWarning = { before: { year: a.getYearInGanZhiExact(), month: a.getMonthInGanZhiExact() },
          after: { year: b.getYearInGanZhiExact(), month: b.getMonthInGanZhiExact() } };
      }
    }

    var dir = input.luckDirection || 'both';
    var luck = {};
    if (dir === 'male' || dir === 'both') luck.male = luckCycles(ctx, 'male');
    if (dir === 'female' || dir === 'both') luck.female = luckCycles(ctx, 'female');

    var dg = pillars.day.charAt(0);
    var tenGods = {}, diShi = {}, hidden = {};
    ['year', 'month', 'day', 'time'].forEach(function (k) {
      var gz = pillars[k]; if (!gz) return;
      tenGods[k] = { gan: k === 'day' ? null : tenGodKo(dg, gz.charAt(0)),
        zhi: HIDDEN_DISPLAY[gz.charAt(1)].map(function (g) { return tenGodKo(dg, g); }) };
      diShi[k] = diShiCn(dg, gz.charAt(1));
      hidden[k] = HIDDEN_DISPLAY[gz.charAt(1)].slice();
    });

    return {
      version: VERSION,
      input: { timeZone: tz, calendar: input.calendar || 'solar', solarDate: y + '-' + m + '-' + d,
        clockTime: timeUnknown ? null : (h + ':' + (mi < 10 ? '0' : '') + mi), timeUnknown: timeUnknown },
      time: {
        utc: fmt(utcParts(utcMs)) + ' UTC', utcMs: utcMs, utcOffsetMinutes: off, dstMinutes: dst,
        standardLocal: fmt(std), wallTimeFlag: conv.flag,
        solarCorrection: corr, effectiveLocal: fmt(eff), lateZiApplies: lateZiApplies, lateZi: lateZi,
        city: city ? { id: city.id, name: city.name, lon: city.lon } : null,
        note: dst ? 'Daylight saving time was in effect: day/hour pillars use standard time (clock minus 60 minutes).' : null
      },
      pillars: pillars,
      solarTerms: { prev: { name: ctx.prevJie.name, local: ctx.prevJie.local, utc: fmt(utcParts(ctx.prevJie.utcMs)) + ' UTC' },
        next: { name: ctx.nextJie.name, local: ctx.nextJie.local, utc: fmt(utcParts(ctx.nextJie.utcMs)) + ' UTC' } },
      termDayWarning: termDayWarning,
      luck: luck,
      strength: strengthScore(pillars, timeUnknown),
      tenGods: tenGods, diShi: diShi, hiddenStems: hidden
    };
  }

  // 기존 위젯이 쓰던 라이브러리 EightChar 모양의 어댑터 (화면 코드 재사용용)
  function toEightCharAdapter(res) {
    var P = res.pillars, dg = P.day.charAt(0);
    var cap = { Year: 'year', Month: 'month', Day: 'day', Time: 'time' };
    var o = {};
    Object.keys(cap).forEach(function (C) {
      var k = cap[C];
      o['get' + C + 'Gan'] = function () { return P[k] ? P[k].charAt(0) : null; };
      o['get' + C + 'Zhi'] = function () { return P[k] ? P[k].charAt(1) : null; };
      o['get' + C] = function () { return P[k]; };
      o['get' + C + 'DiShi'] = function () { return P[k] ? diShiCn(dg, P[k].charAt(1)) : null; };
      o['get' + C + 'ShiShenZhi'] = function () {
        return P[k] ? HIDDEN_DISPLAY[P[k].charAt(1)].map(function (g) { return TEN_GOD_KO_TO_CN[tenGodKo(dg, g)]; }) : [];
      };
      if (C !== 'Day') o['get' + C + 'ShiShenGan'] = function () { return P[k] ? TEN_GOD_KO_TO_CN[tenGodKo(dg, P[k].charAt(0))] : null; };
    });
    return o;
  }

  // 라이브러리 원래 방식(현지 시계 시각을 그대로 중국 시각처럼 넣음)과 라이브러리 대운(Yun) — 비교용
  function libraryNaive(input, chartType, yunSect) {
    var ec = Solar.fromYmdHms(+input.year, +input.month, +input.day, +input.hour, +(input.minute || 0), 0).getLunar().getEightChar();
    ec.setSect(1);
    var yun = ec.getYun(chartType === 'female' ? 0 : 1, yunSect || 2);
    return { pillars: { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() },
      yun: { forward: yun.isForward(), y: yun.getStartYear(), m: yun.getStartMonth(), d: yun.getStartDay(),
        firstCycle: yun.getDaYun()[1].getGanZhi(), firstCycleStartAgeChinese: yun.getDaYun()[1].getStartAge() } };
  }
  // 라이브러리 Yun 을 "올바른 순간"(UTC를 중국시로 바꾼 값)에 적용한 결과 — 우리 규칙과 공식 차이만 보기 위함
  function libraryYunAtInstant(res, chartType, yunSect) {
    var lunar = lunarAtUtc(res.time.utcMs);
    var yun = lunar.getEightChar().getYun(chartType === 'female' ? 0 : 1, yunSect || 2);
    return { forward: yun.isForward(), y: yun.getStartYear(), m: yun.getStartMonth(), d: yun.getStartDay(), h: yun.getStartHour ? yun.getStartHour() : 0 };
  }

  var PRIORITY_ZONES = [
    ['Asia/Seoul', 'South Korea — Seoul (all of Korea)'],
    ['America/New_York', 'US — New York / Eastern'],
    ['America/Chicago', 'US — Chicago / Central'],
    ['America/Denver', 'US — Denver / Mountain'],
    ['America/Phoenix', 'US — Phoenix / Arizona'],
    ['America/Los_Angeles', 'US — Los Angeles / Pacific'],
    ['America/Anchorage', 'US — Anchorage / Alaska'],
    ['Pacific/Honolulu', 'US — Honolulu / Hawaii']
  ];
  function timeZoneOptions() {
    var all = [];
    try { all = Intl.supportedValuesOf('timeZone'); } catch (e) { all = []; }
    var seen = {}; PRIORITY_ZONES.forEach(function (z) { seen[z[0]] = true; });
    return PRIORITY_ZONES.concat(all.filter(function (z) { return !seen[z]; }).map(function (z) { return [z, z.replace(/_/g, ' ')]; }));
  }

  return {
    VERSION: VERSION, calculate: calculate, toEightCharAdapter: toEightCharAdapter,
    libraryNaive: libraryNaive, libraryYunAtInstant: libraryYunAtInstant,
    timeZoneOptions: timeZoneOptions, PRIORITY_ZONES: PRIORITY_ZONES,
    CITIES: CITIES, CITY_BY_ID: CITY_BY_ID, equationOfTime: equationOfTime,
    _internal: { wallToUtc: wallToUtc, offsetMinutes: offsetMinutes, dstMinutes: dstMinutes, dstMinutesHeuristic: dstMinutesHeuristic, stdOffsetFromTable: stdOffsetFromTable, strengthScore: strengthScore,
      HIDDEN_DAYS: HIDDEN_DAYS, STRENGTH_WEIGHTS: STRENGTH_WEIGHTS, STRENGTH_CUTS: STRENGTH_CUTS }
  };
});


/* ===================== [2부] 기존 위젯 코드 (원본 saju_engine.js 복사본, [테스트판] 표시한 곳만 수정) ===================== */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !document.currentScript) { return; } // [테스트판] 화면 없는 환경(Node)에서는 위젯 건너뜀

  var root = document.currentScript.previousElementSibling;
  while (root && !root.classList.contains('saju-calc-widget')) {
    root = root.previousElementSibling;
  }
  if (!root) { return; }
  var $ = function (sel) { return root.querySelector(sel); };
  var LANG = root.dataset.lang === 'en' ? 'en' : 'ko'; // saju_widget_en.html / saju_widget_ko.html이 data-lang으로 지정
  var IMG_BASE = 'https://stjandljh1-creator.github.io/saju-calculator/images/web/'; // Today's Fortune 카드 아이콘/배경 이미지 경로
  var TRAD_IMG_BASE = 'https://stjandljh1-creator.github.io/saju-calculator/images/web/traditional/'; // 8개 리포트 카드 아이콘(traditional 테마) 경로. Today's Fortune(IMG_BASE)와 분리 - traditional 세트엔 bg_*.png 대응 이미지가 없어서 공유하면 그쪽이 깨짐

  // ---- 천간/지지/오행/음양 변환 테이블 ----
  var GAN_INFO = {
    '甲': { ko: '갑', element: '목', yinYang: 'yang' }, '乙': { ko: '을', element: '목', yinYang: 'yin' },
    '丙': { ko: '병', element: '화', yinYang: 'yang' }, '丁': { ko: '정', element: '화', yinYang: 'yin' },
    '戊': { ko: '무', element: '토', yinYang: 'yang' }, '己': { ko: '기', element: '토', yinYang: 'yin' },
    '庚': { ko: '경', element: '금', yinYang: 'yang' }, '辛': { ko: '신', element: '금', yinYang: 'yin' },
    '壬': { ko: '임', element: '수', yinYang: 'yang' }, '癸': { ko: '계', element: '수', yinYang: 'yin' }
  };
  var ZHI_INFO = {
    '子': { ko: '자', element: '수' }, '丑': { ko: '축', element: '토' },
    '寅': { ko: '인', element: '목' }, '卯': { ko: '묘', element: '목' },
    '辰': { ko: '진', element: '토' }, '巳': { ko: '사', element: '화' },
    '午': { ko: '오', element: '화' }, '未': { ko: '미', element: '토' },
    '申': { ko: '신', element: '금' }, '酉': { ko: '유', element: '금' },
    '戌': { ko: '술', element: '토' }, '亥': { ko: '해', element: '수' }
  };
  var ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var ELEMENT_KO = { '목': '목(木)', '화': '화(火)', '토': '토(土)', '금': '금(金)', '수': '수(水)' };
  var ELEMENT_EN = { '목': 'Wood', '화': 'Fire', '토': 'Earth', '금': 'Metal', '수': 'Water' };
  var ELEMENT_COLOR = { '목': '#3c6e57', '화': '#8a3a34', '토': '#a9803f', '금': '#d7d4c9', '수': '#2c3d63' };
  var SIPSIN_KO = {
    '比肩': '비견', '劫财': '겁재', '劫財': '겁재',
    '食神': '식신', '伤官': '상관', '傷官': '상관',
    '偏财': '편재', '偏財': '편재', '正财': '정재', '正財': '정재',
    '七杀': '편관', '七殺': '편관', '偏官': '편관', '正官': '정관',
    '偏印': '편인', '正印': '정인'
  };
  var SIPSIN_EN = {
    '비견': 'Peer', '겁재': 'Rival', '식신': 'Ease', '상관': 'Rebel',
    '편재': 'Hustle', '정재': 'Wage', '편관': 'Pressure', '정관': 'Duty',
    '편인': 'Insight', '정인': 'Support'
  };
  var GOD_TO_CATEGORY = {
    '비견': '비겁', '겁재': '비겁', '식신': '식상', '상관': '식상',
    '편재': '재성', '정재': '재성', '편관': '관성', '정관': '관성',
    '편인': '인성', '정인': '인성'
  };
  var GOD_BY_CATEGORY = {
    '비겁': { same: '비견', diff: '겁재' },
    '식상': { same: '식신', diff: '상관' },
    '재성': { same: '편재', diff: '정재' },
    '관성': { same: '편관', diff: '정관' },
    '인성': { same: '편인', diff: '정인' }
  };
  // 십이운성(十二长生) 한자 표기 -> 한글 / 영문
  var DISHI_HANJA_KO = {
    '长生': '장생', '沐浴': '목욕', '冠带': '관대', '临官': '건록', '帝旺': '제왕', '衰': '쇠',
    '病': '병', '死': '사', '墓': '묘', '绝': '절', '胎': '태', '养': '양'
  };
  var STAGE_EN = {
    '장생': 'Birth', '목욕': 'Bathing', '관대': 'Coming of Age', '건록': 'Prime', '제왕': 'Peak', '쇠': 'Waning',
    '병': 'Slowing', '사': 'Resting', '묘': 'Storage', '절': 'Cut-off', '태': 'Conception', '양': 'Taking Shape'
  };
  var CHANG_SHENG_KO = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
  // 일간별 자시(子) 기준 십이운성 오프셋 (lunar-javascript LunarUtil.CHANG_SHENG_OFFSET과 동일)
  var GAN_CHANG_SHENG_OFFSET = { '甲': 1, '丙': 10, '戊': 10, '庚': 7, '壬': 4, '乙': 6, '丁': 9, '己': 9, '辛': 0, '癸': 3 };

  // 오행 상생(생하는 쪽 → 생받는 쪽)/상극(극하는 쪽 → 극받는 쪽) 관계
  var GENERATES = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  var CONTROLS = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };

  // 일간(de) 기준 상대 오행(te)의 관계: 비겁/인성(돕는 오행) vs 식상/재성/관성(설기·극제하는 오행)
  function relationOf(de, te) {
    if (!de || !te) return null;
    if (te === de) return '비겁';
    if (GENERATES[te] === de) return '인성';
    if (GENERATES[de] === te) return '식상';
    if (CONTROLS[de] === te) return '재성';
    if (CONTROLS[te] === de) return '관성';
    return null;
  }
  function helpsDay(de, te) {
    var r = relationOf(de, te);
    return r === '비겁' || r === '인성';
  }

  // 일간(dayGan) 대비 다른 천간(otherGan) 하나의 십신(비견~정인) 판정
  function tenGodOf(dayGan, otherGan) {
    var de = GAN_INFO[dayGan].element, te = GAN_INFO[otherGan].element;
    var cat = relationOf(de, te);
    var sameYY = GAN_INFO[dayGan].yinYang === GAN_INFO[otherGan].yinYang;
    var pair = GOD_BY_CATEGORY[cat];
    return sameYY ? pair.same : pair.diff;
  }

  // 일간(dayGan) 기준, 임의의 지지(zhiChar)의 십이운성 판정 (다른 날짜/다른 원국 간 교차 계산용)
  function diShiOf(dayGan, zhiChar) {
    var offset = GAN_CHANG_SHENG_OFFSET[dayGan];
    var zi = ZHI_ORDER.indexOf(zhiChar);
    var isYang = GAN_INFO[dayGan].yinYang === 'yang';
    var idx = offset + (isYang ? zi : -zi);
    idx = ((idx % 12) + 12) % 12;
    return CHANG_SHENG_KO[idx];
  }

  function ganji(ganChar, zhiChar) {
    var g = GAN_INFO[ganChar], z = ZHI_INFO[zhiChar];
    return {
      ganChar: ganChar, zhiChar: zhiChar,
      hanja: ganChar + zhiChar,
      reading: (g ? g.ko : '?') + (z ? z.ko : '?'),
      ganElement: g ? g.element : null,
      zhiElement: z ? z.element : null
    };
  }

  // 라이브러리 메서드명이 버전에 따라 다를 수 있어 후보 목록 중 존재하는 것을 사용
  function callFirst(obj, names, args) {
    for (var i = 0; i < names.length; i++) {
      var fn = obj[names[i]];
      if (typeof fn === 'function') {
        try { return fn.apply(obj, args || []); } catch (e) { /* try next */ }
      }
    }
    return null;
  }

  function toSipsinKoList(raw) {
    if (raw == null) return [];
    var arr = Array.isArray(raw) ? raw : [raw];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var ko = SIPSIN_KO[arr[i]];
      if (ko) out.push(ko);
    }
    return out;
  }

  // ---- 연/월/일/시 select 채우기 ----
  var yearSel = $('#scw-year'), monthSel = $('#scw-month'), daySel = $('#scw-day'), hourSel = $('#scw-hour');
  var thisYear = new Date().getFullYear();
  for (var y = thisYear; y >= 1900; y--) {
    var oy = document.createElement('option'); oy.value = y; oy.textContent = y;
    yearSel.appendChild(oy);
  }
  for (var m = 1; m <= 12; m++) {
    var om = document.createElement('option'); om.value = m; om.textContent = m;
    monthSel.appendChild(om);
  }
  for (var d = 1; d <= 31; d++) {
    var od = document.createElement('option'); od.value = d; od.textContent = d;
    daySel.appendChild(od);
  }
  var hourLabels = [
    '23~01시 (자시)', '01~03시 (축시)', '03~05시 (인시)', '05~07시 (묘시)',
    '07~09시 (진시)', '09~11시 (사시)', '11~13시 (오시)', '13~15시 (미시)',
    '15~17시 (신시)', '17~19시 (유시)', '19~21시 (술시)', '21~23시 (해시)'
  ];
  for (var h = 0; h < 24; h++) {
    var oh = document.createElement('option'); oh.value = h;
    oh.textContent = LANG === 'en' ? ((h < 10 ? '0' + h : h) + ':00') : ((h < 10 ? '0' + h : h) + '시');
    hourSel.appendChild(oh);
  }
  hourSel.value = 12;
  yearSel.value = '1990'; monthSel.value = '1'; daySel.value = '1'; // [10/3] 기본 생년월일 1990-1-1
  // [5차b] 달력에 없는 날짜(2월 30일 등) 막기: 일 선택칸을 연·월에 맞게 줄임 (음력은 달 길이가 달라 31칸 그대로, 기존 오류 안내 사용)
  function scwDim(yy, mm) { return new Date(Date.UTC(yy, mm, 0)).getUTCDate(); }
  function scwFillDays() {
    var ct = root.querySelector('input[name="scw-caltype"]:checked');
    var max = (ct && ct.value === 'lunar') ? 31 : scwDim(parseInt(yearSel.value, 10), parseInt(monthSel.value, 10));
    var cur = parseInt(daySel.value, 10) || 1;
    while (daySel.options.length > max) daySel.remove(daySel.options.length - 1);
    for (var dd = daySel.options.length + 1; dd <= max; dd++) { var odd = document.createElement('option'); odd.value = dd; odd.textContent = dd; daySel.appendChild(odd); }
    daySel.value = String(Math.min(cur, max)); // 이미 고른 날이 넘치면 그 달 마지막 날
  }
  yearSel.addEventListener('change', scwFillDays); monthSel.addEventListener('change', scwFillDays);
  (function () { var rr = root.querySelectorAll('input[name="scw-caltype"]'); for (var ri = 0; ri < rr.length; ri++) rr[ri].addEventListener('change', scwFillDays); })();
  scwFillDays();

  // [테스트판 v2] 분 선택칸 + 태어난 도시(경도) + 시간대 + 태양시 보정 + 23시대 선택
  var minuteSel = $('#scw-minute');
  if (minuteSel) {
    for (var mn = 0; mn < 60; mn++) {
      var omn = document.createElement('option'); omn.value = mn; omn.textContent = (mn < 10 ? '0' : '') + mn;
      minuteSel.appendChild(omn);
    }
  }
  var citySel = $('#scw-city');
  if (citySel && window.KSajuCore) {
    // [v4] 나라별 묶음: 한국 → 미국 → 캐나다 → 그 밖 나라(영문 알파벳순)
    var groups = {};
    window.KSajuCore.CITIES.forEach(function (c) {
      var g = groups[c[6]];
      if (!g) { g = groups[c[6]] = document.createElement('optgroup'); g.label = c[6]; }
      var o = document.createElement('option'); o.value = c[0]; o.textContent = c[1];
      g.appendChild(o);
    });
    var head = ['South Korea', 'United States', 'Canada'];
    var rest = Object.keys(groups).filter(function (k) { return head.indexOf(k) < 0; }).sort();
    head.concat(rest).forEach(function (k) { if (groups[k]) citySel.appendChild(groups[k]); });
    var gO = document.createElement('optgroup'); gO.label = 'Elsewhere';
    var oo = document.createElement('option'); oo.value = ''; oo.textContent = 'Somewhere else — pick a time zone below';
    gO.appendChild(oo);
    citySel.appendChild(gO);
    citySel.value = 'seoul';
  }
  var tzSel = $('#scw-tz');
  if (tzSel && window.KSajuCore) {
    var tzOpts = window.KSajuCore.timeZoneOptions();
    var tzPri = window.KSajuCore.PRIORITY_ZONES.length;
    var grpA = document.createElement('optgroup'); grpA.label = 'Korea & United States';
    var grpB = document.createElement('optgroup'); grpB.label = 'All time zones (A-Z)';
    tzOpts.forEach(function (z, i) {
      var o = document.createElement('option'); o.value = z[0]; o.textContent = z[1];
      (i < tzPri ? grpA : grpB).appendChild(o);
    });
    tzSel.appendChild(grpA); tzSel.appendChild(grpB);
    tzSel.value = 'Asia/Seoul';
  }
  var solarSel = $('#scw-solar');
  var lateRow = $('#scw-latezi-row');

  function syncCity() {
    if (!citySel || !tzSel) return;
    var c = citySel.value ? window.KSajuCore.CITY_BY_ID[citySel.value] : null;
    if (c) { tzSel.value = c.timeZone; tzSel.disabled = true; } else { tzSel.disabled = false; }
    var tzWrap = $('#scw-tz-wrap'); if (tzWrap) tzWrap.style.display = c ? 'none' : '';
    var un = $('#scw-urumqi-note'); if (un) un.style.display = (c && c.id === 'urumqi') ? '' : 'none';
    var un = $('#scw-urumqi-note'); if (un) un.style.display = (c && c.id === 'urumqi') ? '' : 'none';
  }
  // 입력이 바뀔 때마다 "보정 뒤 시각"이 23시대인지 확인해 23시 선택칸을 보이거나 숨김
  function readInput() {
    var caltypeEl = root.querySelector('input[name="scw-caltype"]:checked');
    var timeUnknown = $('#scw-hour-unknown').checked;
    var dirEl = root.querySelector('input[name="scw-luckdir"]:checked');
    var lzEl = root.querySelector('input[name="scw-latezi"]:checked');
    return {
      year: parseInt(yearSel.value, 10), month: parseInt(monthSel.value, 10), day: parseInt(daySel.value, 10),
      hour: timeUnknown ? 12 : parseInt(hourSel.value, 10),
      minute: (timeUnknown || !minuteSel) ? 0 : parseInt(minuteSel.value, 10),
      calendar: caltypeEl ? caltypeEl.value : 'solar', isLeapMonth: $('#scw-leap').checked, timeUnknown: timeUnknown,
      city: citySel ? citySel.value : '', timeZone: tzSel ? tzSel.value : 'Asia/Seoul',
      solarTimeMode: solarSel ? solarSel.value : 'mean',
      luckDirection: dirEl ? dirEl.value : 'both', lateZi: lzEl ? lzEl.value : 'next'
    };
  }
  function syncLateZi() {
    if (!lateRow || !window.KSajuCore) return;
    var show = false, eff = '';
    try {
      var r = window.KSajuCore.calculate(readInput());
      show = r.time.lateZiApplies; eff = r.time.effectiveLocal;
    } catch (e) { show = false; }
    lateRow.style.display = show ? '' : 'none';
    var effEl = $('#scw-latezi-eff');
    if (effEl) {
      var ri = readInput(), clockDate = ri.year + '-' + (ri.month < 10 ? '0' : '') + ri.month + '-' + (ri.day < 10 ? '0' : '') + ri.day;
      // v6: 보정 뒤 날짜가 시계 날짜와 다르면(예: 서울 00:20 -> 전날 23:48) 날짜도 같이 보여 줌
      var hh12 = eff ? (function (t) { var h = parseInt(t.slice(0, 2), 10); return ((h % 12) || 12) + t.slice(2, 5) + ' ' + (h < 12 ? 'AM' : 'PM'); })(eff.slice(11)) : '';
      effEl.textContent = eff ? (hh12 + ((ri.calendar === 'solar' && eff.slice(0, 10) !== clockDate) ? ' on ' + eff.slice(0, 10) : '')) : '';
      var preEl = $('#scw-latezi-pre');
      if (preEl) { var adj = false; try { var sc0 = window.KSajuCore.calculate(readInput()).time.solarCorrection; adj = !!(sc0 && sc0.mode !== 'off' && sc0.appliedMinutes !== 0); } catch (e2) {} preEl.textContent = adj ? 'Your birth time, adjusted for your birthplace, is' : 'Your birth time is'; }
    }
  }
  if (citySel) citySel.addEventListener('change', function () { syncCity(); syncLateZi(); });
  ['#scw-year', '#scw-month', '#scw-day', '#scw-hour', '#scw-minute', '#scw-tz', '#scw-solar', '#scw-leap'].forEach(function (sel) {
    var el = $(sel); if (el) el.addEventListener('change', syncLateZi);
  });
  var ctRadios = root.querySelectorAll('input[name="scw-caltype"]');
  for (var cr = 0; cr < ctRadios.length; cr++) ctRadios[cr].addEventListener('change', syncLateZi);
  syncCity();

  $('#scw-hour-unknown').addEventListener('change', function () {
    hourSel.disabled = this.checked;
    if (minuteSel) minuteSel.disabled = this.checked;
    syncLateZi();
  });
  syncLateZi();

  var caltypeRadios = root.querySelectorAll('input[name="scw-caltype"]');
  for (var ci = 0; ci < caltypeRadios.length; ci++) {
    caltypeRadios[ci].addEventListener('change', function () {
      var checked = root.querySelector('input[name="scw-caltype"]:checked');
      $('#scw-leap-wrap').style.display = (checked && checked.value === 'lunar') ? '' : 'none';
      var lnote = $('#scw-lunar-note'); if (lnote) lnote.style.display = (checked && checked.value === 'lunar') ? '' : 'none'; // [5차b]
    });
  }

  function showError(msg) {
    $('#scw-error').textContent = msg;
    $('#scw-result').style.display = 'none';
  }

  function dishiKo(ec, methodName) {
    var raw = callFirst(ec, [methodName]);
    return DISHI_HANJA_KO[raw] || null;
  }

  function dishiCell(ec, methodName) {
    var ko = dishiKo(ec, methodName);
    if (!ko) return '';
    return '<div class="scw-dishi"><span class="scw-en">' + STAGE_EN[ko] + '</span><span class="scw-ko">' + ko + '</span></div>';
  }

  function renderPillars(ec, timeUnknown) {
    var year = ganji(ec.getYearGan(), ec.getYearZhi());
    var month = ganji(ec.getMonthGan(), ec.getMonthZhi());
    var day = ganji(ec.getDayGan(), ec.getDayZhi());
    var time = timeUnknown ? null : ganji(ec.getTimeGan(), ec.getTimeZhi());

    function cell(p, labelEn, labelKo, diShiHtml) {
      if (!p) {
        return '<div class="scw-pillar"><div class="scw-pillar-label"><span class="scw-pl-en">' + labelEn + '</span><span class="scw-pl-ko">' + labelKo + '</span></div>' +
          '<div class="scw-ganji">—</div><div class="scw-reading">' + (LANG === 'en' ? 'unknown' : '모름') + '</div></div>';
      }
      var dots = '<div class="scw-dots">' +
        '<span class="scw-dot" style="background:' + ELEMENT_COLOR[p.ganElement] + '"></span>' +
        '<span class="scw-dot" style="background:' + ELEMENT_COLOR[p.zhiElement] + '"></span></div>';
      // 한글 독음(예: 무진)은 한국어판 전용 — 영문판은 간지 한자만 표시 (로마자 표기 데이터 없음)
      var readingHtml = LANG === 'en' ? '' : '<div class="scw-reading">' + p.reading + '</div>';
      return '<div class="scw-pillar"><div class="scw-pillar-label"><span class="scw-pl-en">' + labelEn + '</span><span class="scw-pl-ko">' + labelKo + '</span></div>' +
        '<div class="scw-ganji">' + p.hanja + '</div>' +
        readingHtml +
        dots + (diShiHtml || '') + '</div>';
    }

    $('#scw-pillar-row').innerHTML =
      cell(time, 'Hour', '시주', timeUnknown ? '' : dishiCell(ec, 'getTimeDiShi')) +
      cell(day, 'Day', '일주', dishiCell(ec, 'getDayDiShi')) +
      cell(month, 'Month', '월주', dishiCell(ec, 'getMonthDiShi')) +
      cell(year, 'Year', '연주', dishiCell(ec, 'getYearDiShi'));

    return { year: year, month: month, day: day, time: time };
  }

  function renderWuxing(pillars, timeUnknown) {
    var counts = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
    var list = [pillars.year, pillars.month, pillars.day];
    if (!timeUnknown && pillars.time) list.push(pillars.time);
    list.forEach(function (p) {
      if (p.ganElement) counts[p.ganElement]++;
      if (p.zhiElement) counts[p.zhiElement]++;
    });
    var total = list.length * 2;

    var bar = $('#scw-wuxing-bar');
    bar.innerHTML = '';
    var legend = $('#scw-wuxing-legend');
    legend.innerHTML = '';
    ['목', '화', '토', '금', '수'].forEach(function (el) {
      var n = counts[el];
      if (n > 0) {
        var seg = document.createElement('div');
        seg.style.width = (n / total * 100) + '%';
        seg.style.background = ELEMENT_COLOR[el];
        bar.appendChild(seg);
      }
      var item = document.createElement('span');
      item.className = 'scw-wl-item';
      item.innerHTML = '<span class="scw-legend-swatch" style="background:' + ELEMENT_COLOR[el] + '"></span>' +
        '<span class="scw-wl-en">' + ELEMENT_EN[el] + '</span>' +
        '<span class="scw-wl-ko">' + ELEMENT_KO[el] + '</span>' +
        '<span class="scw-wl-n">' + n + '</span>';
      legend.appendChild(item);
    });

    return counts;
  }

  function renderStrength(pillars, timeUnknown, wuxingCounts, coreStrength) {
    var dayElement = pillars.day.ganElement; // 일간 오행

    var deugRyeong = helpsDay(dayElement, pillars.month.zhiElement); // 득령: 월지가 일간을 돕는가
    var deugJi = helpsDay(dayElement, pillars.day.zhiElement); // 득지: 일지가 일간을 돕는가

    var remainingZhi = [pillars.year.zhiElement];
    if (!timeUnknown && pillars.time) remainingZhi.push(pillars.time.zhiElement);
    var deugSeHelpCount = remainingZhi.filter(function (el) { return helpsDay(dayElement, el); }).length;
    var deugSe = (deugSeHelpCount / remainingZhi.length) >= 0.5;

    // 8자(시간 모름이면 6자) 전체에서 일간을 돕는 글자 수 집계 (일간 자신은 비겁으로 포함)
    var chars = [dayElement, pillars.day.zhiElement,
      pillars.year.ganElement, pillars.year.zhiElement,
      pillars.month.ganElement, pillars.month.zhiElement];
    if (!timeUnknown && pillars.time) chars.push(pillars.time.ganElement, pillars.time.zhiElement);

    var helpCount = 0;
    chars.forEach(function (el) {
      if (el === dayElement || helpsDay(dayElement, el)) helpCount++;
    });
    var total = chars.length;
    var weakCount = total - helpCount;
    var supportCount = (deugRyeong ? 1 : 0) + (deugJi ? 1 : 0) + (deugSe ? 1 : 0);

    var verdict;
    if (supportCount >= 2 && helpCount >= total / 2) verdict = '신강';
    else if (supportCount <= 1 && helpCount < total / 2) verdict = '신약';
    else verdict = '중화';
    if (coreStrength) { verdict = coreStrength.verdict; } // [테스트판] 월령 가중치 + 통근 점수식으로 판정

    // 오행 과부족: 8자(또는 6자) 중 0개인 오행은 부족, 3개 이상인 오행은 과다로 표시
    var lacking = [], excess = [];
    ['목', '화', '토', '금', '수'].forEach(function (el) {
      var n = wuxingCounts[el] || 0;
      if (n === 0) lacking.push(el);
      else if (n >= 3) excess.push(el);
    });
    var balanceText;
    if (LANG === 'en') {
      var lackingEnTxt = lacking.map(function (el) { return ELEMENT_EN[el]; });
      var excessEnTxt = excess.map(function (el) { return ELEMENT_EN[el] + ' (' + wuxingCounts[el] + ')'; });
      if (lacking.length === 0 && excess.length === 0) {
        balanceText = 'The five elements are spread fairly evenly.';
      } else {
        var partsEn = [];
        if (lackingEnTxt.length) partsEn.push('Lacking: ' + lackingEnTxt.join(', '));
        if (excessEnTxt.length) partsEn.push('Abundant: ' + excessEnTxt.join(', '));
        balanceText = partsEn.join(' / ');
      }
    } else {
      var lackingKoTxt = lacking.map(function (el) { return ELEMENT_KO[el]; });
      var excessKoTxt = excess.map(function (el) { return ELEMENT_KO[el] + ' ' + wuxingCounts[el] + '개'; });
      if (lacking.length === 0 && excess.length === 0) {
        balanceText = '오행이 비교적 고르게 분포되어 있습니다.';
      } else {
        var parts = [];
        if (lackingKoTxt.length) parts.push('부족한 오행: ' + lackingKoTxt.join(', '));
        if (excessKoTxt.length) parts.push('많은 오행: ' + excessKoTxt.join(', '));
        balanceText = parts.join(' / ');
      }
    }

    var html = '';
    if (LANG === 'en') {
      var verdictEnLabel = verdict === '신강' ? 'Strong' : verdict === '신약' ? 'Weak' : 'Balanced';
      html += '<span class="scw-strength-badge">' + verdictEnLabel + '</span>';
      if (coreStrength) {
        html += '<div class="scw-strength-summary">Strength score: <b>' + coreStrength.score + '</b> / 100 ' +
          '(' + coreStrength.cuts.strong + ' or more = Strong, under ' + coreStrength.cuts.weak + ' = Weak). The month branch counts most (30 of 100 points). ' +
          (coreStrength.hasRoot ? 'Your Day Master has roots in: ' + coreStrength.roots.map(function (r) { return r.branch; }).join(', ') + '.' : 'Your Day Master has no root of its own element in the branches.') +
          '</div>';
      }
      html += '<table class="scw-strength-table">';
      html += '<tr><th>Month Support</th><th>Day Support</th><th>Other Support</th></tr>';
      html += '<tr><td>' + (deugRyeong ? '○ Yes' : '× No') + '</td>' +
        '<td>' + (deugJi ? '○ Yes' : '× No') + '</td>' +
        '<td>' + (deugSe ? '○ Yes' : '× No') + ' (' + deugSeHelpCount + '/' + remainingZhi.length + ')</td></tr>';
      html += '</table>';
      html += '<div class="scw-strength-summary">' +
        'Characters supporting the Day Master (' + ELEMENT_EN[dayElement] + '): <b>' + helpCount + '</b> / ' +
        'Characters draining or opposing it: <b>' + weakCount + '</b> (out of ' + total + ' total)<br>' +
        balanceText +
        '</div>';
      html += '<div class="scw-strength-guide">' +
        '※ This verdict is a simple reference tally based on the strength/weakness method (month/day/other support) and element counts — ' +
        'interpretations can vary from this data depending on the school of thought applied.' +
        '</div>';
    } else {
      html += '<span class="scw-strength-badge">' + verdict + ' / ' + (verdict === '신강' ? 'Strong' : verdict === '신약' ? 'Weak' : 'Balanced') + '</span>';
      if (coreStrength) {
        html += '<div class="scw-strength-summary">신강·신약 점수: <b>' + coreStrength.score + '</b> / 100 (' + coreStrength.cuts.strong + ' 이상 신강, ' + coreStrength.cuts.weak + ' 미만 신약). 월지 가중치 30. ' +
          (coreStrength.hasRoot ? '통근: ' + coreStrength.roots.map(function (r) { return r.branch; }).join(', ') : '통근 없음') + '</div>';
      }
      html += '<table class="scw-strength-table">';
      html += '<tr><th>득령(월지)</th><th>득지(일지)</th><th>득세(연지·시지)</th></tr>';
      html += '<tr><td>' + (deugRyeong ? '○ 얻음' : '× 못 얻음') + '</td>' +
        '<td>' + (deugJi ? '○ 얻음' : '× 못 얻음') + '</td>' +
        '<td>' + (deugSe ? '○ 얻음' : '× 못 얻음') + ' (' + deugSeHelpCount + '/' + remainingZhi.length + ')</td></tr>';
      html += '</table>';
      html += '<div class="scw-strength-summary">' +
        '일간(' + ELEMENT_KO[dayElement] + ')을 돕는 글자(비겁·인성): <b>' + helpCount + '개</b> / ' +
        '설기·극하는 글자(식상·재성·관성): <b>' + weakCount + '개</b> (전체 ' + total + '자 중)<br>' +
        balanceText +
        '</div>';
      html += '<div class="scw-strength-guide">' +
        '※ 이 판정은 억부법(득령·득지·득세)과 오행 개수를 단순 집계한 참고 데이터이며, ' +
        '이 신강/신약 데이터를 바탕으로 억부·조후·통관 등 여러 관점에서 해석이 갈릴 수 있습니다.' +
        '</div>';
    }

    $('#scw-strength').innerHTML = html;

    return { verdict: verdict, lacking: lacking, excess: excess, dayElement: dayElement };
  }

  function renderSipsin(ec, timeUnknown) {
    var pillars = ['year', 'month', 'day', 'time'];
    var capitalized = { year: 'Year', month: 'Month', day: 'Day', time: 'Time' };

    var rows = LANG === 'en'
      ? '<tr><th></th><th>Year</th><th>Month</th><th>Day</th><th>Hour</th></tr>'
      : '<tr><th></th><th>연주</th><th>월주</th><th>일주</th><th>시주</th></tr>';
    var ganRow = LANG === 'en' ? '<tr><th>Stem</th>' : '<tr><th>천간</th>';
    var zhiRow = LANG === 'en' ? '<tr><th>Branch</th>' : '<tr><th>지지</th>';
    var categoryTally = { '비겁': 0, '식상': 0, '재성': 0, '관성': 0, '인성': 0 };
    var godCount = { '비견': 0, '겁재': 0, '식신': 0, '상관': 0, '편재': 0, '정재': 0, '편관': 0, '정관': 0, '편인': 0, '정인': 0 };
    var dayZhiGod = [];

    function sipsinCellHtml(koList) {
      if (!koList.length) return '<td>-</td>';
      var html = koList.map(function (ko) {
        return '<span class="scw-sipsin-en">' + SIPSIN_EN[ko] + '</span><span class="scw-sipsin-ko">' + ko + '</span>';
      }).join('<br>');
      return '<td>' + html + '</td>';
    }

    pillars.forEach(function (p) {
      if (timeUnknown && p === 'time') {
        ganRow += '<td>-</td>'; zhiRow += '<td>-</td>';
        return;
      }
      if (p === 'day') {
        ganRow += LANG === 'en' ? '<td class="scw-daymaster">Day Master</td>' : '<td class="scw-daymaster">일원</td>';
      } else {
        var ganRaw = callFirst(ec, [
          'get' + capitalized[p] + 'ShiShenGan',
          'get' + capitalized[p] + 'ShiShen'
        ]);
        var ganKo = toSipsinKoList(ganRaw);
        ganKo.forEach(function (ko) { categoryTally[GOD_TO_CATEGORY[ko]]++; godCount[ko]++; });
        ganRow += sipsinCellHtml(ganKo);
      }

      var zhiRaw = callFirst(ec, ['get' + capitalized[p] + 'ShiShenZhi']);
      var zhiKo = toSipsinKoList(zhiRaw);
      zhiKo.forEach(function (ko) { categoryTally[GOD_TO_CATEGORY[ko]]++; godCount[ko]++; });
      zhiRow += sipsinCellHtml(zhiKo);
      if (p === 'day') { dayZhiGod = zhiKo; }
    });

    ganRow += '</tr>'; zhiRow += '</tr>';
    $('#scw-sipsin-table').innerHTML = rows + ganRow + zhiRow;

    return { categoryTally: categoryTally, godCount: godCount, dayZhiGod: dayZhiGod };
  }

  // 점신 스타일 캐주얼 톤: 명리학 전문용어(비겁/식상/재성/관성/인성, 신강/신약)는
  // 풀이 문장에 노출하지 않고, 그 의미만 구어체 성격 묘사로 옮겨서 씀.
  var VERDICT_CASUAL = {
    '신강': {
      en: "You don't lean on anyone — give you a direction and you push through on your own steam.",
      ko: '웬만해선 남한테 안 기대고 제 힘으로 뚫고 나가는 타입이야. 한번 마음먹으면 어지간해선 안 꺾여.'
    },
    '신약': {
      en: "Try to carry everything solo and you burn out fast — you do your best work with someone backing you up.",
      ko: '혼자 다 짊어지려고 하면 금방 지치는 타입이야. 옆에서 받쳐주는 사람이 있을 때 진짜 힘이 나.'
    },
    '중화': {
      en: "You're not the type to go all-in or fold completely — you read the room and adjust as you go.",
      ko: '너무 세게 나가지도, 너무 물러서지도 않아. 상황 봐가면서 유연하게 움직이는 편이야.'
    }
  };
  var ELEMENT_TRAIT_EXCESS = {
    '목': { en: 'a restless itch to keep growing and push forward', ko: '자꾸 앞으로 나아가려는 조급함' },
    '화': { en: 'a short fuse and sudden bursts of passion', ko: '욱하는 성질과 불같은 열정' },
    '토': { en: 'stubbornness — once you decide, that\'s it', ko: '한번 정하면 안 바뀌는 고집' },
    '금': { en: 'a sharp, cut-and-dry coldness when it counts', ko: '칼같이 끊어내는 냉정함' },
    '수': { en: 'a habit of overthinking and second-guessing', ko: '생각이 많아 자꾸 재는 버릇' }
  };
  var ELEMENT_TRAIT_LACKING = {
    '목': { en: 'a slow start and not much drive to push things forward', ko: '추진력이 잘 안 붙는 것' },
    '화': { en: 'feelings that don\'t easily show on the surface', ko: '속마음이 잘 안 드러나는 것' },
    '토': { en: 'low patience for the slow, steady grind', ko: '꾸준히 버티는 힘이 약한 것' },
    '금': { en: 'trouble cutting things off cleanly', ko: '맺고 끊는 게 잘 안 되는 것' },
    '수': { en: 'acting before thinking it all the way through', ko: '생각보다 행동이 앞서는 것' }
  };
  var CATEGORY_CASUAL = {
    '비겁': { en: "You move at your own pace and don't love sharing the spotlight — teamwork isn't where you shine.", ko: '남 눈치 안 보고 제 페이스대로 사는 스타일이야. 협업보다 혼자 치고 나갈 때 결과가 더 좋아.' },
    '식상': { en: "Whatever's in your head won't stay there — you need an outlet, whether that's talking, making, or performing.", ko: '머릿속에 있는 걸 못 참고 밖으로 표현해야 직성이 풀리는 타입이야. 말재주든 손재주든 표현하는 데서 답이 나와.' },
    '재성': { en: "You think in outcomes, not feelings — quick to size things up and quick to act on it.", ko: '감보다 계산이 빠른 편이라, 실속 챙기고 결과로 증명하는 데 능해.' },
    '관성': { en: "Left with no rules, you drift — but hand you real responsibility and you snap into focus.", ko: '풀어두면 늘어지지만, 책임이 주어지면 그때부터 진가가 나오는 타입이야.' },
    '인성': { en: "Grinding it out alone wears you thin — you grow fastest when someone's actually teaching or backing you.", ko: '혼자 애쓰면 쉽게 지치고, 누가 옆에서 가르쳐주거나 받쳐줄 때 훨씬 크는 타입이야.' }
  };

  function renderSummary(strengthInfo, wuxingCounts, categoryTally) {
    var verdict = VERDICT_CASUAL[strengthInfo.verdict];
    var elEn = ELEMENT_EN[strengthInfo.dayElement], elKo = ELEMENT_KO[strengthInfo.dayElement];

    var enParts = ['Your base note is ' + elEn + '. ' + verdict.en];
    var koParts = ['타고난 바탕 기운은 ' + elKo + '. ' + verdict.ko];

    if (strengthInfo.excess.length) {
      var excEn = strengthInfo.excess.map(function (el) { return ELEMENT_EN[el]; }).join(' and ');
      var excKo = strengthInfo.excess.map(function (el) { return ELEMENT_KO[el]; }).join(', ');
      var excTraitEn = strengthInfo.excess.map(function (el) { return ELEMENT_TRAIT_EXCESS[el].en; }).join(' and ');
      var excTraitKo = strengthInfo.excess.map(function (el) { return ELEMENT_TRAIT_EXCESS[el].ko; }).join(', ');
      enParts.push('There\'s a lot of ' + excEn + ' packed in here, and it shows up as ' + excTraitEn + '.');
      koParts.push(excKo + ' 기운이 몰려있어서, ' + excTraitKo + ' 같은 모습으로 나타나기 쉬워.');
    }
    if (strengthInfo.lacking.length) {
      var lackEn = strengthInfo.lacking.map(function (el) { return ELEMENT_EN[el]; }).join(' and ');
      var lackKo = strengthInfo.lacking.map(function (el) { return ELEMENT_KO[el]; }).join(', ');
      var lackTraitEn = strengthInfo.lacking.map(function (el) { return ELEMENT_TRAIT_LACKING[el].en; }).join(' and ');
      var lackTraitKo = strengthInfo.lacking.map(function (el) { return ELEMENT_TRAIT_LACKING[el].ko; }).join(', ');
      enParts.push('And there\'s basically no ' + lackEn + ' in the mix, which can mean ' + lackTraitEn + '.');
      koParts.push('반대로 ' + lackKo + ' 기운은 거의 없어서, ' + lackTraitKo + ' 아쉬울 때가 있어.');
    }
    if (!strengthInfo.excess.length && !strengthInfo.lacking.length) {
      enParts.push('Your five elements are spread out evenly, so no single trait completely runs the show.');
      koParts.push('오행이 고르게 퍼져 있어서, 한 가지 성향에 확 치우치진 않아.');
    }

    var maxCat = null, maxN = -1;
    ['비겁', '식상', '재성', '관성', '인성'].forEach(function (cat) {
      if (categoryTally[cat] > maxN) { maxN = categoryTally[cat]; maxCat = cat; }
    });
    if (maxN > 0) {
      enParts.push(CATEGORY_CASUAL[maxCat].en);
      koParts.push(CATEGORY_CASUAL[maxCat].ko);
    }

    enParts.push("None of this is fixed in stone, though — read it as a lean, not a life sentence.");
    koParts.push('그렇다고 이걸로 다 정해지는 건 아니니까, 참고만 하고 너무 확신은 하지 마.');

    $('#scw-summary').innerHTML =
      '<div class="scw-en">' + enParts.join(' ') + '</div>' +
      '<div class="scw-ko">' + koParts.join(' ') + '</div>';
  }

  // ---- 오늘의 운세: 천간 십신(10) x 지지 십이운성(12) = 60일 주기 ----
  var TODAY_CATEGORIES = [
    { key: 'wealth', en: 'Wealth', ko: '재물운', icon: 'wealth.png', bg: 'bg_wealth.png' },
    { key: 'love', en: 'Love', ko: '애정운', icon: 'love.png', bg: 'bg_love.png' },
    { key: 'career', en: 'Career', ko: '직업운', icon: 'career.png', bg: 'bg_career.png' },
    { key: 'health', en: 'Daily Rhythm', ko: '생활 리듬', icon: 'health.png', bg: 'bg_health.png' },
    { key: 'relationships', en: 'Relationships', ko: '대인관계운', icon: 'relationship.png', bg: 'bg_relationship.png' }
  ];

  var TODAY_GOD_TEXT = {
    wealth: {
      '비견': { en: 'Money moves through people today — shared costs, joint ventures, favors owed.', ko: '오늘 돈은 사람을 통해 움직입니다. 함께 쓰는 비용, 동업, 주고받는 신세.' },
      '겁재': { en: 'Something wants to leave your wallet. Guard it, especially around people who ask to borrow.', ko: '지갑에서 뭔가 빠져나가려 합니다. 특히 빌려달라는 사람을 조심하세요.' },
      '식신': { en: 'Small, easy income finds you — the reward for doing what you enjoy.', ko: '작고 수월한 수입이 들어옵니다. 즐기던 일에 대한 보상입니다.' },
      '상관': { en: 'You spend on impulse and earn by breaking a rule someone else follows.', ko: '충동적으로 쓰고, 남들이 지키는 규칙을 깨는 방식으로 법니다.' },
      '편재': { en: 'Fast money is in the air — a deal, a tip, a windfall. It moves quickly both ways.', ko: '빠른 돈의 기운입니다. 거래, 정보, 뜻밖의 수입. 들어오는 만큼 빨리 나갈 수도 있습니다.' },
      '정재': { en: 'Steady effort pays exactly what it is worth today. Nothing dramatic, nothing lost.', ko: '꾸준한 노력이 그만큼 정직하게 돌아옵니다. 극적이진 않지만 잃을 것도 없습니다.' },
      '편관': { en: 'Money comes with a demand attached — a bill, a deadline, an obligation.', ko: '돈에 대가가 따라붙습니다. 청구서, 마감, 의무.' },
      '정관': { en: 'Financial matters want structure today. Paperwork, budgets, and official channels move in your favor.', ko: '오늘은 재정에 체계가 필요합니다. 서류, 예산, 공식 절차가 유리하게 흘러갑니다.' },
      '편인': { en: 'You see an unconventional angle on money others miss — but it is easy to overthink instead of act.', ko: '남들이 놓친 돈의 각도가 보입니다. 다만 행동보다 생각이 앞서기 쉽습니다.' },
      '정인': { en: 'Support arrives instead of cash — a resource, a connection, something that saves you money later.', ko: '현금 대신 도움이 옵니다. 자원, 인맥, 나중에 돈을 아끼게 해줄 무언가.' }
    },
    love: {
      '비견': { en: 'You want an equal today — someone who mirrors you, not someone who needs you.', ko: '오늘은 대등한 상대를 원합니다. 나를 필요로 하는 사람보다 나를 닮은 사람.' },
      '겁재': { en: 'Watch for a third party or a rival for someone’s attention.', ko: '누군가의 관심을 두고 경쟁자나 제3자가 끼어들 수 있습니다.' },
      '식신': { en: 'Affection flows easily — light, warm, low-stakes connection.', ko: '애정이 쉽게 흐릅니다. 가볍고 따뜻하며 부담 없는 연결.' },
      '상관': { en: 'You say the honest thing instead of the comfortable thing. It will not land softly.', ko: '편한 말 대신 솔직한 말을 하게 됩니다. 부드럽게 들리진 않을 겁니다.' },
      '편재': { en: 'Attraction moves fast and outside your usual circle.', ko: '끌림이 빠르게, 평소 반경 밖에서 일어납니다.' },
      '정재': { en: 'A committed, already-established bond deepens through small, reliable acts.', ko: '이미 자리 잡은 관계가 작고 확실한 행동들로 더 깊어집니다.' },
      '편관': { en: 'Tension or a power dynamic surfaces — intense, not necessarily bad.', ko: '긴장이나 힘의 균형 문제가 드러납니다. 강렬하지만 꼭 나쁜 건 아닙니다.' },
      '정관': { en: 'Commitment and clarity are favored — a good day to define what a relationship actually is.', ko: '약속과 명확함이 유리한 날입니다. 관계의 정의를 확실히 하기 좋습니다.' },
      '편인': { en: 'You pull inward. Solitude serves you better than company today.', ko: '안으로 침잠하게 됩니다. 오늘은 함께보다 혼자가 낫습니다.' },
      '정인': { en: 'You are cared for more than you are chasing. Let yourself receive it.', ko: '쫓기보다 보살핌을 받는 날입니다. 받아들이세요.' }
    },
    career: {
      '비견': { en: 'Colleagues matter more than hierarchy today — collaborate as equals.', ko: '위계보다 동료 관계가 중요한 날입니다. 대등하게 협력하세요.' },
      '겁재': { en: 'Someone at work is competing for the same credit you are.', ko: '직장에서 누군가 당신과 같은 공을 두고 경쟁 중입니다.' },
      '식신': { en: 'Work feels less like labor and more like craft today.', ko: '일이 노동보다 취향에 가깝게 느껴지는 날입니다.' },
      '상관': { en: 'You outperform the room and someone notices — not always kindly.', ko: '실력으로 좌중을 압도하지만, 그걸 곱게 보지 않는 사람도 있습니다.' },
      '편재': { en: 'An unplanned opportunity shows up sideways — a side project, a referral, a chance meeting.', ko: '예상 밖의 기회가 옆에서 불쑥 옵니다. 사이드 프로젝트, 소개, 우연한 만남.' },
      '정재': { en: 'Consistent, visible effort is what gets rewarded today — no shortcuts needed.', ko: '꾸준하고 눈에 보이는 노력이 보상받는 날입니다. 지름길은 필요 없습니다.' },
      '편관': { en: 'Pressure from above. A demanding boss, client, or deadline tests you.', ko: '위로부터의 압박입니다. 까다로운 상사, 클라이언트, 마감이 시험합니다.' },
      '정관': { en: 'Your standing improves through proper channels — a good day for reviews, approvals, formal asks.', ko: '정식 절차를 통해 입지가 올라갑니다. 평가, 승인, 공식 요청에 좋은 날입니다.' },
      '편인': { en: 'You work best alone today, on something no one assigned you.', ko: '오늘은 아무도 시키지 않은 일을, 혼자서 할 때 가장 잘 됩니다.' },
      '정인': { en: 'A mentor, a credential, or useful advice reaches you at the right moment.', ko: '멘토, 자격, 혹은 요긴한 조언이 적절한 순간에 옵니다.' }
    },
    health: {
      '비견': { en: 'A good day to keep pace with someone else, like a walk or a task done side by side.', ko: '누군가와 발을 맞추기 좋은 날입니다. 같이 걷거나 나란히 일해 보세요.' },
      '겁재': { en: 'You may be tempted to take on too much today. Leave some room in the schedule.', ko: '오늘은 일을 너무 많이 떠안고 싶어질 수 있습니다. 일정에 여유를 남겨 두세요.' },
      '식신': { en: 'An easygoing day. Regular meals and an unhurried evening suit it.', ko: '느긋한 날입니다. 제때 먹는 식사와 서두르지 않는 저녁이 잘 어울립니다.' },
      '상관': { en: 'Restless energy may look for an outlet. A change of scene can help you settle.', ko: '들뜬 기분이 출구를 찾을 수 있습니다. 장소를 잠깐 바꾸면 마음이 가라앉기 쉽습니다.' },
      '편재': { en: 'Plans may shift around today. Try to keep at least one fixed time, like dinner.', ko: '오늘은 일정이 이리저리 바뀔 수 있습니다. 저녁처럼 고정된 시간 하나는 지켜 보세요.' },
      '정재': { en: 'A steady day. Sticking to your usual sleep, meal and movement times fits it well.', ko: '꾸준한 날입니다. 평소의 수면·식사·움직임 시간을 지키는 것과 잘 맞습니다.' },
      '편관': { en: 'Pressure may build quietly. Plan a short pause before the busiest part of the day.', ko: '압박이 조용히 쌓일 수 있습니다. 가장 바쁜 때 앞에 짧은 쉼을 넣어 보세요.' },
      '정관': { en: 'A good day to start or keep a simple daily routine.', ko: '간단한 하루 루틴을 시작하거나 이어 가기 좋은 날입니다.' },
      '편인': { en: 'Quiet time on your own may suit you better than a packed schedule today.', ko: '오늘은 빽빽한 일정보다 혼자만의 조용한 시간이 더 잘 맞을 수 있습니다.' },
      '정인': { en: 'A slower pace fits today. An early night counts as a good use of time.', ko: '느린 속도가 어울리는 날입니다. 일찍 자는 것도 시간을 잘 쓰는 일입니다.' }
    },
    relationships: {
      '비견': { en: 'You connect best with people who feel like peers today, not superiors or subordinates.', ko: '오늘은 위아래 없이 대등하게 느껴지는 사람과 가장 잘 통합니다.' },
      '겁재': { en: 'Someone may take credit, resources, or attention that you expected to be yours.', ko: '당신 몫이라 여겼던 공, 자원, 관심을 누군가 가져갈 수 있습니다.' },
      '식신': { en: 'Easy, low-pressure company is what your relationships need today.', ko: '오늘 관계에 필요한 건 부담 없고 편안한 시간입니다.' },
      '상관': { en: 'You speak your mind more freely than usual — it may not go over smoothly with authority figures.', ko: '평소보다 거침없이 말하게 됩니다. 윗사람에게는 곱게 들리지 않을 수 있습니다.' },
      '편재': { en: 'New people enter your circle through unexpected, casual routes.', ko: '새로운 사람이 예상치 못한 가벼운 계기로 인연 안에 들어옵니다.' },
      '정재': { en: 'Old, reliable relationships are where today’s warmth actually comes from.', ko: '오늘의 따뜻함은 결국 오래되고 믿을 수 있는 관계에서 나옵니다.' },
      '편관': { en: 'Friction with someone who holds power over you is likely. Choose your battles.', ko: '당신에게 영향력을 가진 사람과 마찰이 생기기 쉽습니다. 싸울 일을 골라 싸우세요.' },
      '정관': { en: 'Formal or hierarchical relationships — boss, elders, institutions — go smoothly if you respect the process.', ko: '상사, 어른, 기관 등 위계가 있는 관계는 절차를 존중하면 순조롭습니다.' },
      '편인': { en: 'You would rather be alone than perform social energy today, and that is fine.', ko: '오늘은 사회적 에너지를 쓰기보다 혼자 있고 싶은 날이고, 그래도 괜찮습니다.' },
      '정인': { en: 'Someone older or more experienced offers real support if you let them in.', ko: '받아들이기만 하면, 연장자나 경험 많은 사람이 실질적인 도움을 줍니다.' }
    }
  };

  var TODAY_STAGE_TEXT = {
    wealth: {
      '장생': { en: 'A new source is just starting to form — plant it, do not harvest it yet.', ko: '새로운 재원이 이제 막 싹트는 시기입니다. 지금은 심을 때이지 거둘 때가 아닙니다.' },
      '목욕': { en: 'Exposed and a little unsteady — a good day to double-check before you commit money.', ko: '아직 여물지 않아 불안정한 시기입니다. 돈을 쓰기 전에 한 번 더 확인하세요.' },
      '관대': { en: 'Momentum is building. You are ready to take on slightly more than before.', ko: '기세가 붙는 시기입니다. 예전보다 조금 더 감당할 준비가 됐습니다.' },
      '건록': { en: 'You are at full capacity — the most reliable day this cycle to earn on your own merit.', ko: '역량이 최고조인 시기입니다. 스스로의 힘으로 벌기에 가장 믿을 만한 날입니다.' },
      '제왕': { en: 'Peak power, peak risk. Big moves succeed big or fail big today.', ko: '힘도 위험도 최고조입니다. 크게 움직이면 크게 얻거나 크게 잃습니다.' },
      '쇠': { en: 'The pace is slowing. Consolidate what you have already earned rather than chase more.', ko: '속도가 줄어드는 시기입니다. 더 좇기보다 이미 얻은 것을 정리하세요.' },
      '병': { en: 'Energy is low around money today — postpone big decisions if you can.', ko: '돈과 관련된 기운이 약한 날입니다. 큰 결정은 가능하면 미루세요.' },
      '사': { en: 'A financial chapter is closing. Let it close instead of forcing it open.', ko: '재정의 한 장이 끝나가는 시기입니다. 억지로 붙잡지 말고 놓아주세요.' },
      '묘': { en: 'Money wants to be stored, not spent — savings serve you better than visible spending.', ko: '돈은 쓰기보다 저장되고 싶어하는 시기입니다. 눈에 띄는 지출보다 조용한 저축이 낫습니다.' },
      '절': { en: 'A low point, and a useful one — see clearly what is not working financially before you rebuild.', ko: '바닥이지만 쓸모 있는 지점입니다. 다시 쌓기 전에 무엇이 안 되고 있는지 똑바로 보세요.' },
      '태': { en: 'An idea about money is conceived today, even if nothing moves yet. Write it down.', ko: '돈에 관한 아이디어가 오늘 잉태됩니다. 아직 움직이지 않아도 적어두세요.' },
      '양': { en: 'Something you started earlier is quietly maturing. Keep feeding it, not forcing it.', ko: '예전에 시작한 무언가가 조용히 자라는 중입니다. 억지로 밀어붙이지 말고 계속 돌보세요.' }
    },
    love: {
      '장생': { en: 'A connection is just being born — early, fragile, worth protecting.', ko: '관계가 이제 막 태어나는 시기입니다. 이르고 여려서 지켜줄 필요가 있습니다.' },
      '목욕': { en: 'Emotions run exposed and changeable — do not read too much into one mood.', ko: '감정이 드러나고 변덕스러운 시기입니다. 한 번의 기분에 너무 의미 부여하지 마세요.' },
      '관대': { en: 'A relationship is gaining confidence and shape.', ko: '관계가 자신감과 형태를 갖춰가는 시기입니다.' },
      '건록': { en: 'You show up as your most capable self in love — steady and self-assured.', ko: '사랑에서 가장 유능한 모습으로 나타나는 시기입니다. 안정적이고 자신감 있습니다.' },
      '제왕': { en: 'Feelings are at their most intense. Say what you mean; it will be heard clearly today.', ko: '감정이 가장 강렬한 시기입니다. 오늘은 진심이 정확히 전달됩니다.' },
      '쇠': { en: 'Passion cools slightly — a good day for quiet company over grand gestures.', ko: '열기가 살짝 식는 시기입니다. 큰 이벤트보다 조용한 동행이 좋습니다.' },
      '병': { en: 'Low energy for romance. Rest before you reach out.', ko: '연애에 쓸 기운이 부족한 날입니다. 연락하기 전에 좀 쉬세요.' },
      '사': { en: 'An old pattern in how you love is ending. Do not resuscitate it out of habit.', ko: '사랑하던 방식 하나가 끝나가는 시기입니다. 습관으로 되살리지 마세요.' },
      '묘': { en: 'Feelings go inward and quiet — you are processing more than you are expressing.', ko: '감정이 안으로, 조용히 가라앉는 시기입니다. 표현보다 정리가 먼저입니다.' },
      '절': { en: 'A clean break point. Uncomfortable, but it clears space for something honest.', ko: '완전히 끊어지는 지점입니다. 불편하지만 솔직한 것이 들어설 자리를 만듭니다.' },
      '태': { en: 'A feeling is forming before either of you has named it.', ko: '아직 이름 붙이기 전, 감정이 형태를 갖추기 시작합니다.' },
      '양': { en: 'Something tender is growing quietly. Give it time, not pressure.', ko: '다정한 무언가가 조용히 자라는 중입니다. 재촉 말고 시간을 주세요.' }
    },
    career: {
      '장생': { en: 'A new role or project is in its infancy — invest attention, not expectations.', ko: '새 역할이나 프로젝트가 이제 막 시작된 시기입니다. 기대보다 관심을 쏟으세요.' },
      '목욕': { en: 'Untested ground. Learn the shape of it before you commit fully.', ko: '아직 검증되지 않은 자리입니다. 완전히 뛰어들기 전에 파악부터 하세요.' },
      '관대': { en: 'You are being taken more seriously than a month ago. Let it show.', ko: '한 달 전보다 더 진지하게 받아들여지는 시기입니다. 드러내세요.' },
      '건록': { en: 'You are operating at full professional capacity. This is a day to be visible.', ko: '직업적 역량이 최고조인 시기입니다. 오늘은 드러나기 좋은 날입니다.' },
      '제왕': { en: 'Authority is available to you today — use it deliberately.', ko: '오늘은 권한이 주어지는 시기입니다. 신중하게 쓰세요.' },
      '쇠': { en: 'Not a day to launch anything new. Maintain, do not expand.', ko: '새로 시작할 날은 아닙니다. 확장보다 유지에 집중하세요.' },
      '병': { en: 'Low professional stamina — protect focus, decline what you can.', ko: '일에 대한 기력이 낮은 날입니다. 집중력을 지키고, 가능한 것은 거절하세요.' },
      '사': { en: 'A role, project, or way of working has run its course.', ko: '어떤 역할이나 방식이 수명을 다한 시기입니다.' },
      '묘': { en: 'Behind-the-scenes work matters more than what is visible today.', ko: '오늘은 드러나는 것보다 뒤에서 하는 일이 더 중요합니다.' },
      '절': { en: 'A professional reset point — uncomfortable but clarifying.', ko: '직업적으로 리셋되는 지점입니다. 불편하지만 방향이 분명해집니다.' },
      '태': { en: 'An early idea about your career direction is forming. Do not rush to act on it.', ko: '진로에 대한 초기 구상이 생기는 시기입니다. 서둘러 실행하지 마세요.' },
      '양': { en: 'Skills you have been quietly building are close to ready.', ko: '조용히 쌓아온 실력이 거의 준비된 시기입니다.' }
    },
    health: {
      '장생': { en: 'A fresh-start feeling. A good day to begin a small daily habit.', ko: '새로 시작하는 기분이 드는 날입니다. 작은 하루 습관을 시작하기 좋습니다.' },
      '목욕': { en: 'Your pace may feel uneven today. Do not judge the whole day by one slow hour.', ko: '오늘은 속도가 들쭉날쭉할 수 있습니다. 느린 한 시간으로 하루 전체를 판단하지 마세요.' },
      '관대': { en: 'Your routine is finding its feet. You can add a little more than yesterday.', ko: '루틴이 자리를 잡아 가는 중입니다. 어제보다 조금 더 해도 좋습니다.' },
      '건록': { en: 'A dependable day for your usual routine.', ko: '평소 루틴을 믿고 따라가기 좋은 날입니다.' },
      '제왕': { en: 'You may want to keep going all day. Decide in advance when to stop.', ko: '하루 종일 달리고 싶어질 수 있습니다. 언제 멈출지 미리 정해 두세요.' },
      '쇠': { en: 'A good day to ease off a little before you feel you have to.', ko: '꼭 쉬어야겠다 싶기 전에 조금 늦춰 가기 좋은 날입니다.' },
      '병': { en: 'A low-key day. Make rest part of the plan, not an afterthought.', ko: '조용히 보내기 좋은 날입니다. 쉬는 시간을 나중 일이 아니라 계획에 넣으세요.' },
      '사': { en: 'A good day to stop and pause rather than push through.', ko: '버티기보다 잠시 멈추고 쉬어 가기 좋은 날입니다.' },
      '묘': { en: 'Stillness suits today. Keep the schedule light where you can.', ko: '고요함이 어울리는 날입니다. 할 수 있는 만큼 일정을 가볍게 두세요.' },
      '절': { en: 'A quiet day that is good for noticing which habits are no longer working for you.', ko: '더는 맞지 않는 습관이 무엇인지 알아채기 좋은 조용한 날입니다.' },
      '태': { en: 'A new rhythm may be starting, even if you cannot see it yet.', ko: '아직 보이지 않아도 새로운 리듬이 시작되는 중일 수 있습니다.' },
      '양': { en: 'Keep your routine gentle and consistent today.', ko: '오늘은 루틴을 부드럽고 꾸준하게 이어 가세요.' }
    },
    relationships: {
      '장생': { en: 'A new connection is forming — treat it gently, it is early.', ko: '새로운 인연이 막 시작되는 시기입니다. 아직 이르니 조심스럽게 다루세요.' },
      '목욕': { en: 'Social footing feels unsteady. Do not overinterpret one awkward exchange.', ko: '관계에서 발밑이 불안정하게 느껴지는 시기입니다. 어색한 대화 하나에 너무 의미 두지 마세요.' },
      '관대': { en: 'A relationship is gaining trust and definition.', ko: '관계가 신뢰와 형태를 갖춰가는 시기입니다.' },
      '건록': { en: 'You show up as your most dependable self in relationships today.', ko: '오늘은 관계에서 가장 믿음직한 모습으로 나타나는 시기입니다.' },
      '제왕': { en: 'Your social presence is at its strongest. People notice you today.', ko: '사회적 존재감이 가장 강한 시기입니다. 오늘은 사람들의 시선을 받습니다.' },
      '쇠': { en: 'Social energy is fading a little — smaller gatherings suit you better than big ones.', ko: '사교 에너지가 조금 줄어드는 시기입니다. 큰 모임보다 소규모가 더 잘 맞습니다.' },
      '병': { en: 'Low patience for people today. Keep interactions brief where you can.', ko: '사람에 대한 인내심이 낮은 날입니다. 가능하면 짧게 마무리하세요.' },
      '사': { en: 'A relationship or social role is quietly coming to an end.', ko: '어떤 관계나 사회적 역할이 조용히 끝나가는 시기입니다.' },
      '묘': { en: 'You are processing a relationship internally rather than acting on it.', ko: '관계를 겉으로 드러내기보다 마음속으로 정리하는 시기입니다.' },
      '절': { en: 'A clean cut in a relationship, or the clarity to finally make one.', ko: '관계에서 깔끔한 단절, 혹은 마침내 단절할 용기가 생기는 지점입니다.' },
      '태': { en: 'The seed of a future relationship is planted today, unnoticed.', ko: '미래의 인연이 될 씨앗이 오늘, 눈에 띄지 않게 심어집니다.' },
      '양': { en: 'A relationship that has been quietly forming is close to becoming real.', ko: '조용히 형성되던 관계가 실체를 갖추기 직전입니다.' }
    }
  };

  function renderTodayFortune(dayGanChar) {
    var todaySolar = Solar.fromDate(new Date());
    var todayLunar = todaySolar.getLunar();
    var todayGan = todayLunar.getDayGan();
    var todayZhi = todayLunar.getDayZhi();
    var god = tenGodOf(dayGanChar, todayGan);
    var stage = diShiOf(dayGanChar, todayZhi);
    var todayReading = (GAN_INFO[todayGan] ? GAN_INFO[todayGan].ko : '?') + (ZHI_INFO[todayZhi] ? ZHI_INFO[todayZhi].ko : '?');

    var dateStr = todaySolar.getYear() + '-' + (todaySolar.getMonth() < 10 ? '0' : '') + todaySolar.getMonth() + '-' + (todaySolar.getDay() < 10 ? '0' : '') + todaySolar.getDay();

    var html = LANG === 'en'
      ? '<div class="scw-today-head">' + dateStr + ' &middot; <span class="scw-tg">' + todayGan + todayZhi + '</span> Day &middot; ' +
        SIPSIN_EN[god] + ' &middot; ' + STAGE_EN[stage] + '</div>'
      : '<div class="scw-today-head">' + dateStr + ' &middot; <span class="scw-tg">' + todayGan + todayZhi + '</span>' + todayReading + '일 &middot; ' +
        god + ' &middot; ' + stage + '</div>';

    TODAY_CATEGORIES.forEach(function (cat) {
      var godText = TODAY_GOD_TEXT[cat.key][god];
      var stageText = TODAY_STAGE_TEXT[cat.key][stage];
      var bgStyle = "background-image:linear-gradient(rgba(8,8,8,.5),rgba(8,8,8,.5)),url('" + __kimg('web_' + cat.bg, IMG_BASE + cat.bg) + "')";
      html += '<div class="scw-today-cat" style="' + bgStyle + '">' +
        '<div class="scw-today-cat-label"><img class="scw-cat-icon" src="' + __kimg('web_' + cat.icon, IMG_BASE + cat.icon) + '" alt="" onerror="this.style.visibility=\'hidden\'"><span class="scw-tcl-en">' + cat.en + '</span><span class="scw-tcl-ko">' + cat.ko + '</span></div>' +
        '<div class="scw-today-cat-text"><span class="scw-en">' + godText.en + ' ' + stageText.en + '</span>' +
        '<span class="scw-ko">' + godText.ko + ' ' + stageText.ko + '</span></div>' +
        '</div>';
    });

    $('#scw-today').innerHTML = html;
  }

  // ---- 테마별 리포트 (재물운/애정운/결혼운/직업운/사업운/친구운/건강운/평생운세) ----
  // 원국(연월일시 60갑자, 오행, 십신, 십이운성, 신강신약)은 이미 위에서 계산 완료.
  // 카테고리별로 어떤 십신 조합에 가중치를 둘지만 다르게 해서 문장을 생성한다.
  var CATEGORY_MENU = [
    { key: 'wealth', emoji: '💰', icon: 'icon_wealth_bright.png', en: 'Wealth', ko: '재물운' },
    { key: 'love', emoji: '❤️', icon: 'icon_love_bright.png', en: 'Love', ko: '애정운' },
    { key: 'marriage', emoji: '💍', icon: 'icon_love_bright.png', en: 'Marriage', ko: '결혼운' },
    { key: 'career', emoji: '💼', icon: 'icon_career_bright.png', en: 'Career', ko: '직업운' },
    { key: 'business', emoji: '📈', icon: 'icon_wealth_bright.png', en: 'Business', ko: '사업운' },
    { key: 'friends', emoji: '🤝', icon: 'icon_relationship_bright.png', en: 'Friends', ko: '친구운' },
    { key: 'health', emoji: '🌙', icon: 'icon_health_bright.png', en: 'Daily Rhythm', ko: '생활 리듬' },
    { key: 'life', emoji: '🔮', icon: 'hero_bright.png', en: 'Lifetime', ko: '평생운세' }
  ];

  var currentCtx = null; // 최초 1회 계산된 원국 데이터. 카테고리 전환 시 재입력 없이 재사용.

  function godTotal(godCount, keys) {
    return keys.reduce(function (sum, k) { return sum + (godCount[k] || 0); }, 0);
  }

  function paraHtml(pairs) {
    return pairs.map(function (p) {
      return '<div class="scw-report-para"><div class="scw-en">' + p.en + '</div><div class="scw-ko">' + p.ko + '</div></div>';
    }).join('');
  }

  function sectionHtml(titleEn, titleKo, paras) {
    return '<div class="scw-report-section">' +
      '<div class="scw-report-section-title"><span class="scw-en">' + titleEn + '</span><span class="scw-ko">' + titleKo + '</span></div>' +
      paraHtml(paras) +
      '</div>';
  }


  var GENERAL_DISCLAIMER = {
    en: "None of this is fixed in stone — read it as a lean, not a locked-in script.",
    ko: '전부 정해진 건 아니야. 하나의 경향으로 참고만 하고 너무 확신하지는 마.'
  };

  var REPORT_BUILDERS = {

    wealth: function (ctx) {
      var jeong = ctx.godCount['정재'] || 0, pyeon = ctx.godCount['편재'] || 0;
      var total = jeong + pyeon;

      var overview = [];
      if (total === 0) {
        overview.push({ en: "Some people's charts are dense with money-related signals — the steady kind, the opportunistic kind, or both. Yours runs quiet on this front: neither instinct shows up strongly, which usually means your attention and identity are built around something other than money itself.", ko: '어떤 사람의 원국은 재물과 관련된 기운이 빽빽해. 안정형이든 기회포착형이든, 혹은 둘 다든. 너는 이 부분이 조용한 편이야. 어느 쪽 감각도 강하게 나타나지 않는데, 보통 이건 관심과 정체성이 돈이 아닌 다른 곳에 맞춰져 있다는 뜻이야.' });
        overview.push({ en: "This can actually work in your favor in roles where money isn't the main point — creative work, research, caregiving, mission-driven work — anywhere the reward isn't primarily measured in a paycheck.", ko: '이건 오히려 돈이 핵심 목적이 아닌 자리에서 강점이 될 수 있어. 창작, 연구, 돌봄, 사명 중심의 일처럼 보상이 월급으로만 측정되지 않는 자리.' });
        overview.push({ en: 'It can show up in small, everyday ways — genuinely losing track of how much something cost right after buying it, or being the person in the group who never quite remembers to ask for the money back.', ko: '이런 성향은 일상에서 이런 식으로 나타날 수 있어. 뭔가 사고 나면 얼마 줬는지 금방 까먹거나, 모임에서 돈 받을 걸 챙기는 걸 늘 깜빡하는 사람이 너인 것처럼.' });
      } else if (jeong > pyeon) {
        overview.push({ en: 'People whose money-luck leans toward the steady, dependable end tend to build wealth through consistency — the same paycheck, the same routine, banked reliably over years. The flashier end of that same spectrum belongs to people who catch fast, opportunistic money — deals, tips, windfalls — but watch it slip through their fingers just as quickly. You sit closer to the first type: the steady side is doing most of the work in your chart, and the fast-money instinct is comparatively quiet.', ko: '재물운이 안정적인 쪽으로 기운 사람은 매달 같은 월급, 같은 루틴을 꾸준히 쌓아서 재산을 만드는 편이야. 반대로 화려한 쪽 끝에 있는 사람은 거래나 정보, 뜻밖의 수입처럼 빠른 돈을 잘 잡지만, 그만큼 빨리 흘려보내기도 해. 너는 그 중에서 앞쪽에 더 가까워. 원국에서 안정적인 쪽 기운이 대부분의 일을 하고 있고, 빠른 돈을 좇는 감각은 상대적으로 조용한 편이야.' });
        overview.push({ en: 'This kind of money sense tends to fit roles where consistency is rewarded directly — salaried positions, long-term savings plans, anything where showing up reliably compounds over time. It is a poorer match for pure commission-based hustling, where income depends on catching opportunities on the fly.', ko: '이런 재물 감각은 꾸준함이 그대로 보상되는 자리랑 잘 맞아. 월급제 직장, 장기 저축 계획처럼 성실하게 쌓이는 구조. 반대로 기회를 순간적으로 낚아채야 하는 완전 성과급 영업 같은 자리는 상대적으로 덜 맞을 수 있어.' });
        overview.push({ en: 'It can show up in small, everyday ways — sticking to a set budget at the grocery store instead of grabbing whatever looks good, or feeling a little uneasy putting a big purchase on a credit card without checking the balance first.', ko: '이런 성향은 일상에서 이런 식으로 나타날 수 있어. 장 볼 때도 그때그때 끌리는 대로 담기보다 정해둔 예산 안에서 사는 편이거나, 큰 지출을 카드로 긁기 전에 잔액부터 확인 안 하면 괜히 찜찜한 기분이 드는 것처럼.' });
      } else if (pyeon > jeong) {
        overview.push({ en: 'People whose money-luck leans toward the fast, opportunistic end catch deals, tips, and windfalls quickly — money that moves in bursts rather than a steady drip. The steadier end of that spectrum belongs to people who earn through routine, banking the same amount reliably over years. You sit closer to the first type: the quick, opportunistic instinct is doing most of the work in your chart, and the steady, routine-based earning is comparatively quiet.', ko: '재물운이 빠르고 기회 포착형인 쪽으로 기운 사람은 거래나 정보, 뜻밖의 수입을 빠르게 잡아. 돈이 꾸준히 흐르기보다 한 번에 훅 들어오는 식이야. 반대쪽 끝에 있는 사람은 루틴을 통해 같은 금액을 오랫동안 안정적으로 쌓아. 너는 그 중 앞쪽에 더 가까워. 원국에서 빠르고 기회 포착형인 감각이 대부분의 일을 하고 있고, 루틴으로 쌓는 감각은 상대적으로 조용한 편이야.' });
        overview.push({ en: 'This kind of money sense tends to fit roles where reading a moment and moving fast pays off — sales, trading, deal-making, anything with upside tied to timing. It is a poorer match for a fixed salary with no room to capitalize on a good read.', ko: '이런 재물 감각은 순간을 잘 읽고 빠르게 움직이는 게 보상받는 자리랑 잘 맞아. 영업, 트레이딩, 딜 성사처럼 타이밍에 따라 수익이 갈리는 일. 반대로 좋은 판단을 해도 보상으로 이어지지 않는 고정 월급제 자리는 상대적으로 덜 맞을 수 있어.' });
        overview.push({ en: "It can show up in small, everyday ways — jumping on a limited-time deal without much hesitation, or having a side income stream or two running that most people around you don't even know about.", ko: '이런 성향은 일상에서 이런 식으로 나타날 수 있어. 한정 특가가 뜨면 크게 고민 안 하고 바로 잡거나, 주변 사람들은 잘 모르는 부수입 루트를 한두 개쯤 굴리고 있는 것처럼.' });
      } else {
        overview.push({ en: "Some people's money-luck sits firmly on the steady end of the spectrum — routine, reliable, banked slowly — while others sit on the fast end, catching windfalls that move quickly both in and out. You don't lean hard toward either side; both instincts are genuinely active in your chart at close to the same strength.", ko: '어떤 사람은 재물운이 꾸준하고 안정적인 쪽 끝에, 어떤 사람은 빠르고 기회 포착형인 쪽 끝에 자리해. 너는 어느 한쪽으로 확 기울지 않았어. 원국 안에서 두 감각이 비슷한 세기로 같이 살아있는 편이야.' });
        overview.push({ en: 'This kind of dual instinct tends to fit roles that mix both — a steady base income with room for opportunistic upside, like a salaried job with investing on the side, or a stable business with an eye open for a good deal.', ko: '이런 이중적인 감각은 두 가지가 섞인 자리와 잘 맞아. 고정 수입은 있으면서 기회를 노릴 여지도 있는 구조. 월급 받으면서 투자도 병행하거나, 안정적인 사업을 하면서 좋은 기회에는 촉을 세워두는 식.' });
        overview.push({ en: 'It can show up in small, everyday ways — keeping a strict monthly budget most of the time, but not thinking twice about breaking it the moment a genuinely good deal shows up.', ko: '이런 성향은 일상에서 이런 식으로 나타날 수 있어. 평소엔 월 예산을 엄격하게 지키다가도, 진짜 괜찮은 기회다 싶으면 그 예산을 깨는 데 크게 망설이지 않는 것처럼.' });
      }
      if (ctx.strengthInfo.verdict === '신강' && total > 0) {
        overview.push({ en: "Because you've got real drive behind you, that money-energy tends to move at your direction rather than by chance — you're the one steering where it goes, not just watching it arrive or disappear.", ko: '게다가 스스로 방향을 정하는 힘이 있는 편이라, 그 재물 기운은 우연이 아니라 네 결정을 따라 움직이는 쪽에 가까워. 돈이 오고 가는 걸 그냥 지켜보는 게 아니라, 어디로 갈지 네가 직접 정하는 입장이야.' });
        overview.push({ en: 'This tends to suit roles where you actually hold the purse strings — running your own business, managing a team’s budget, or making the call on where a household’s money goes — rather than positions where someone else decides and you just execute.', ko: '이런 성향은 실제로 돈줄을 쥐고 있는 자리랑 잘 맞아. 자기 사업을 운영하거나, 팀 예산을 직접 관리하거나, 집안 살림의 돈이 어디로 갈지 결정하는 역할처럼. 반대로 남이 정한 걸 그대로 따르기만 하는 자리는 상대적으로 덜 맞을 수 있어.' });
        overview.push({ en: 'In everyday terms, it can look like being the one in the friend group who ends up planning and budgeting the trip everyone else just shows up for, or naturally taking charge of where a shared fund actually gets spent.', ko: '일상에서는 친구들 모임에서 다들 그냥 따라오기만 하는 여행을 네가 계획하고 예산까지 짜는 사람이 되거나, 공동 자금을 어디에 쓸지 자연스럽게 네가 주도하게 되는 식으로 나타날 수 있어.' });
      } else if (ctx.strengthInfo.verdict === '신약' && total >= 2) {
        overview.push({ en: "That said, there's more money-energy circulating around you than you can comfortably steer entirely on your own, and left unchecked it tends to end up making the calls instead of you — pulling you toward whichever opportunity or demand shouts loudest in the moment.", ko: '다만 너를 기준으로 재물 기운이 좀 많은 편이라, 혼자서는 그걸 온전히 다 조종하기 벅찬 경우가 많아. 그냥 두면 오히려 그 기운이 널 이끌어서, 그 순간 가장 크게 소리치는 기회나 요구 쪽으로 끌려가기 쉬워.' });
        overview.push({ en: 'This tends to be a rougher fit for roles that hand you full, unsupervised control over money — sole-charge bookkeeping, running finances entirely solo — where having a partner, an advisor, or even just a second set of eyes checking your decisions makes a real difference.', ko: '이런 성향은 아무 견제 없이 돈에 대한 전권을 혼자 다 쥐는 자리랑은 상대적으로 덜 맞아. 혼자 다 처리하는 경리나 재정 관리 같은 자리보다는, 동업자나 자문가처럼 네 결정을 한 번 더 봐줄 사람이 있는 구조가 실질적으로 도움이 돼.' });
        overview.push({ en: 'In everyday terms, it can look like agreeing to lend money the moment someone asks without really weighing it, or chasing whatever investment tip came up most recently instead of one you actually looked into yourself.', ko: '일상에서는 누가 돈 빌려달라고 하면 제대로 따져보지도 않고 바로 빌려주거나, 스스로 알아본 투자보다 최근에 들은 정보를 그냥 따라가는 식으로 나타날 수 있어.' });
      } else if (total > 0) {
        overview.push({ en: "Either way, none of this is a fixed amount just waiting to show up — it moves in response to what you actually do with it, so the numbers shift based on the habits you build around it, not on luck alone.", ko: '어느 쪽이든 정해진 금액이 그냥 기다리고 있는 게 아니라, 네가 실제로 어떻게 움직이느냐에 따라 달라지는 흐름이야. 그러니까 결과는 운보다 그 주변에 쌓아가는 습관에 따라 달라져.' });
        overview.push({ en: "Putting that into practice can be as simple as picking one small, consistent action — checking your balance every Sunday, moving a fixed amount the day you get paid — and actually sticking with it, rather than waiting for the 'right' system to appear.", ko: "이걸 실천으로 옮기는 건 거창할 필요 없어. 일요일마다 잔고를 확인한다거나, 월급 받는 날 일정 금액을 바로 옮겨두는 것처럼 작고 꾸준한 행동 하나를 정해서 실제로 지키는 게 더 나아. '완벽한 방법'이 나타나길 기다리는 것보다." });
        overview.push({ en: 'In everyday terms, it can look like the difference between someone who checks their spending app once and forgets about it, and someone who glances at it every few days — same starting point, very different balance a year later.', ko: '일상에서는 가계부 앱을 한 번 켜보고 잊어버리는 사람과, 며칠에 한 번씩이라도 슬쩍 들여다보는 사람의 차이로 나타날 수 있어. 시작은 같아도 1년 뒤 잔고는 꽤 달라질 수 있어.' });
      }

      var point = [];
      if (total === 0) {
        point.push({ en: "Because money signals just don't register strongly for you, there's no built-in alarm that goes off when a bill is due or a cushion is running low — the awareness has to be built deliberately instead of coming naturally.", ko: '돈과 관련된 신호 자체가 잘 안 들어오는 편이라, 청구서가 다가오거나 여윳돈이 바닥나가는 걸 알려주는 내부 경보가 따로 없어서 의식적으로 챙기지 않으면 그냥 지나가버려.' });
        point.push({ en: "This tends to bite hardest in situations where you're solely responsible for your own cash flow, like freelancing or running a small side business, where nobody else is going to remind you an invoice went unpaid.", ko: '이런 성향은 프리랜서나 소규모 부업처럼 스스로 현금흐름을 전부 관리해야 하는 상황에서 특히 발목을 잡아. 아무도 대신 청구서를 챙겨주지 않으니까.' });
        point.push({ en: 'It can show up as forgetting you are still paying for three different subscriptions, or realizing the emergency fund is basically empty only after the car breaks down.', ko: '일상에서는 구독 서비스 세 개를 계속 결제하고 있다는 걸 까먹거나, 차가 고장 나고 나서야 비상금이 사실상 바닥났다는 걸 깨닫는 식으로 나타날 수 있어.' });
      } else if (jeong > pyeon) {
        point.push({ en: "The instinct to double-check and play it safe is so strong that by the time you've finished weighing the downside, the moment the opportunity actually needed has already passed.", ko: '안전하게 한 번 더 확인하려는 본능이 워낙 강해서, 리스크를 다 따져보고 나면 정작 그 기회가 필요로 했던 타이밍은 이미 지나가 버린 뒤일 때가 많아.' });
        point.push({ en: "This shows up most painfully in situations that reward speed over caution — a job offer that needs an answer today, a limited-time investment, a negotiation where the other side expects a counter on the spot.", ko: '이런 성향은 속도가 신중함보다 중요한 상황에서 특히 뼈아프게 작용해. 오늘 안에 답을 줘야 하는 제안, 한정된 투자 기회, 상대가 그 자리에서 역제안을 기대하는 협상 같은 자리.' });
        point.push({ en: "Day to day, it can look like watching a good deal on something you actually wanted sell out while you were still comparing reviews, or staying quiet about a raise because you wanted to 'find the right moment' that never quite arrives.", ko: "일상에서는 후기 비교하다가 정작 원하던 물건의 특가가 매진되는 걸 지켜보거나, '적당한 타이밍'을 기다리다가 결국 연봉 협상 얘기를 꺼내지 못하는 식으로 나타날 수 있어." });
      } else if (pyeon > jeong) {
        point.push({ en: "Because the money that comes in moves in the same fast rhythm it arrived in, there's nothing naturally slowing it down on the way back out — without some deliberate check in place, a good month and a lean month can end up looking about the same in the bank balance.", ko: '들어온 돈이 들어올 때와 같은 빠른 리듬으로 움직이다 보니, 나가는 쪽도 자연스럽게 느려지질 않아서, 뭔가 의식적으로 브레이크를 걸어두지 않으면 잘 번 달이나 못 번 달이나 통장 잔고는 비슷해 보이기 쉬워.' });
        point.push({ en: 'This tends to be the sharpest problem in commission-based or deal-driven income, where a big payout this month says nothing about what next month brings, and there is no salary floor to fall back on.', ko: '이런 문제는 성과급이나 거래 중심의 수입 구조에서 특히 날카롭게 드러나. 이번 달 큰 건이 다음 달을 보장해주는 것도 아니고, 기댈 수 있는 고정 월급 바닥이 있는 것도 아니니까.' });
        point.push({ en: 'In everyday terms, it can mean a surprise bonus or a good sale disappearing into something exciting within the week, leaving nothing set aside for the slower month that inevitably follows.', ko: '일상적으로는 예상치 못한 보너스나 큰 건 하나를 일주일 안에 신나는 데 다 써버리고, 뒤이어 오는 조용한 달을 위한 여유는 하나도 안 남기는 식으로 나타날 수 있어.' });
      } else {
        point.push({ en: "Because the steady instinct and the opportunistic instinct are both genuinely pulling at close to full strength, a decision that should be simple turns into an actual internal tug-of-war — not because you're afraid to choose, but because both options honestly look appealing.", ko: '안정 추구 본능과 기회 포착 본능이 둘 다 거의 비슷한 세기로 진짜 당기고 있다 보니, 원래는 단순했을 결정이 내면의 줄다리기가 돼버려. 선택이 무서워서가 아니라 둘 다 진심으로 끌려서 그런 거야.' });
        point.push({ en: 'This tends to surface most clearly when you are facing an either/or choice with a real deadline, like a stable job offer against a riskier opportunity that only stays open for so long.', ko: '이런 성향은 마감이 정해진 양자택일 상황에서 가장 분명하게 드러나. 안정적인 취업 제안과, 지금 아니면 없어질 리스크 있는 기회 사이에서 고민할 때처럼.' });
        point.push({ en: 'Day to day, it can look like sitting with two browser tabs open — one for a safe savings product, one for a flashier investment — for so long that the sign-up window closes on both.', ko: '일상에서는 안전한 저축 상품 탭 하나, 화려한 투자 상품 탭 하나를 동시에 켜놓고 너무 오래 고민하다가, 결국 둘 다 신청 기간이 끝나버리는 식으로 나타날 수 있어.' });
      }
      if (ctx.strengthInfo.verdict === '신약' && total >= 2) {
        point.push({ en: "When there's this much money-energy circulating and not quite enough of your own foundation to direct it, it stops feeling like an asset and starts feeling like a weight you're dragging around — decisions about money end up costing you energy rather than giving you any.", ko: '이 정도로 재물 기운이 많이 돌아다니는데 그걸 다룰 자기 기반이 살짝 부족하면, 그게 자산처럼 느껴지기보다 끌고 다녀야 하는 짐처럼 느껴지기 쉬워. 돈에 대한 결정을 내릴 때마다 힘이 나기보다 오히려 에너지가 빠지는 식이야.' });
        point.push({ en: 'This tends to be roughest in roles that hand you outsized financial responsibility without much backup, like managing a big shared budget alone or being the one person a family or team leans on for money decisions.', ko: '이런 성향은 지원 없이 혼자 큰 공동 예산을 관리하거나, 가족이나 팀이 돈 문제를 전부 너한테 기대는 것처럼 과한 재정적 책임을 떠안는 자리에서 특히 힘들어져.' });
        point.push({ en: 'In everyday terms, it can show up as feeling worn out after a single day of bill-paying and budget-juggling, or a low-grade worry whenever a big payment is coming up, even when the numbers actually work out fine.', ko: '일상에서는 청구서 처리하고 예산 맞추는 하루를 보내고 나면 유독 지치거나, 숫자는 사실 문제없이 맞아떨어지는데도 큰 결제를 앞두고 있으면 은근히 마음이 쓰이는 식으로 나타날 수 있어.' });
      }

      var boost = [];
      if (jeong >= pyeon) {
        boost.push({ en: 'Because your money sense already runs on consistency, automating the habit does the one thing that actually multiplies steadiness — it removes the moment-to-moment willpower requirement so the saving happens whether or not you feel like it that day.', ko: '원래도 재물 감각이 꾸준함 위에 세워져 있는 편이라, 이걸 자동화하면 그 성실함을 진짜로 증폭시키는 셈이야. 그날그날의 의지력이 필요 없어지니까, 하고 싶은 기분이 아니어도 저축은 그냥 일어나거든.' });
        boost.push({ en: 'This works especially well if your income already arrives in a predictable rhythm, like a fixed salary or a retainer client, since there is a reliable number to automate against in the first place.', ko: '이 방법은 월급처럼 수입이 예측 가능한 리듬으로 들어올 때 특히 잘 맞아. 자동이체를 걸어둘 만한 안정적인 숫자가 애초에 있으니까.' });
        boost.push({ en: 'In practice, that can mean setting a transfer to fire the same day your paycheck lands, moving it into a separate account you do not casually check, so the steady habit compounds quietly in the background instead of competing with your everyday spending decisions.', ko: '실제로는 월급 들어오는 날 바로 자동이체가 나가게 설정해서, 평소에 잘 들여다보지 않는 별도 계좌로 옮겨두는 식으로 쓰면 돼. 그러면 그 성실한 습관이 일상 소비 결정과 부딪히지 않고 조용히 뒤에서 쌓여.' });
      } else {
        boost.push({ en: "A single day of delay is enough to interrupt the reflex without dulling the instinct that actually makes fast money-catching work for you elsewhere — the goal isn't to slow down the part of you that spots a good deal, just to add one small checkpoint before the money actually leaves.", ko: '딱 하루만 미뤄도 충동적으로 반응하는 습관을 끊기엔 충분해. 정작 다른 데서는 도움이 되는, 기회를 빠르게 낚아채는 감각 자체를 무디게 만들 필요는 없어. 좋은 기회를 알아보는 감각은 그대로 두고, 돈이 실제로 나가기 전에 작은 확인 단계 하나만 추가하는 거야.' });
        boost.push({ en: 'This matters most because the same quick-trigger instinct that serves you well in deal-driven work — sales, trading, catching a good opportunity — does not know how to turn itself off when you are the one buying instead of earning.', ko: '이게 중요한 이유는, 영업이나 트레이딩처럼 거래 중심의 일에서는 도움이 되는 그 빠른 반응 본능이, 벌 때가 아니라 쓸 때는 스스로 멈추는 법을 모르기 때문이야.' });
        boost.push({ en: 'In practice, that can be as simple as adding something to the cart and closing the tab until tomorrow, or setting a personal rule that anything over a certain amount has to wait one night before the card comes out.', ko: '실제로는 장바구니에 담아두고 탭을 닫은 다음 하루 기다려보거나, 일정 금액 넘는 지출은 카드 긁기 전에 하룻밤 묵혀두는 나만의 규칙을 정해두는 식으로 하면 돼.' });
      }

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Boost Your Wealth', '재물운 올리는법', boost);
    },

    love: function (ctx) {
      var isMale = ctx.gender !== 'female';
      var jeongKey = isMale ? '정재' : '정관';
      var pyeonKey = isMale ? '편재' : '편관';
      var jeong = ctx.godCount[jeongKey] || 0, pyeon = ctx.godCount[pyeonKey] || 0;
      var total = jeong + pyeon;

      var overview = [];
      if (total === 0) {
        overview.push({ en: "Some people run hot on romantic pursuit — always alert to who's interested, always circling towards someone. Others run quiet, with next to no built-in urge to chase; attention naturally settles inward instead of outward. You're closer to the second type right now.", ko: '어떤 사람은 연애 쪽으로 계속 촉을 세우고 있어. 누가 관심 있어 하는지 항상 신경 쓰고, 늘 누군가를 향해 움직이는 편. 반대로 어떤 사람은 이 부분이 조용해서, 쫓아가려는 충동 자체가 거의 없어. 지금 너는 후자에 가까워.' });
        overview.push({ en: 'This kind of quiet stretch tends to fit low-pressure, solo-friendly activities well — a class you take for yourself, a trip planned around your own interests — rather than settings explicitly built around meeting people, like blind-date chains.', ko: "이런 시기엔 소개팅 자리처럼 대놓고 '사람 만나기'가 목적인 자리보다, 나 혼자 듣는 강좌나 내 관심사 위주로 짠 여행처럼 부담 없는 활동이 더 잘 맞아." });
        overview.push({ en: 'In everyday terms, it can look like leaving a dating app installed but genuinely forgetting to open it for a week, or noticing someone was flirting with you only after a friend points it out later.', ko: '일상에서는 데이트 앱을 지우진 않았는데 일주일 내내 열어볼 생각도 안 하거나, 누가 은근히 호감을 보였다는 걸 나중에 친구가 말해줘서야 알아차리는 식으로 나타날 수 있어.' });
      } else if (jeong > pyeon) {
        overview.push({ en: 'People whose romantic pull leans steady build connection slowly through small reliable moments. The opposite end belongs to people whose attraction hits fast from outside their circle, exciting but quick to fade. You sit closer to the first type.', ko: '연애운이 안정적이고 이미 정해진 쪽으로 기운 사람은 작고 확실한 순간들이 쌓이면서 관계가 깊어져. 반대쪽 끝에 있는 사람은 평소 반경 밖에서 빠르게 끌림이 오지만 그만큼 빨리 식어. 너는 앞쪽에 더 가까워.' });
        overview.push({ en: 'This tends to suit settings where you already know the person somewhat — a friend-of-a-friend introduction, a workplace you have been at a while — better than cold environments built purely around meeting strangers.', ko: '이런 성향은 지인 소개나 오래 다닌 직장처럼 이미 어느 정도 아는 사람과 이어지는 자리에서 더 잘 맞아. 완전히 낯선 사람들과 만나는 게 목적인 자리보다.' });
        overview.push({ en: 'Day to day, it can look like slowly realizing feelings for someone you have known for years rather than a stranger you just met, or feeling more at ease on a third date with the same person than a first date with someone new.', ko: '일상에서는 처음 본 사람보다 몇 년째 알고 지낸 사람한테 천천히 마음이 가거나, 새 사람과의 첫 데이트보다 같은 사람과의 세 번째 만남이 훨씬 편하게 느껴지는 식으로 나타날 수 있어.' });
      } else if (pyeon > jeong) {
        overview.push({ en: 'People whose pull leans fast and outside-the-circle feel a spark quickly with someone unfamiliar — but that speed means it can cool just as fast. The steadier end builds slowly with someone already familiar. You sit closer to the first type.', ko: '연애운이 빠르고 낯선 쪽으로 기운 사람은 새롭고 낯선 사람한테 순식간에 끌려. 다만 그만큼 빨리 식을 수도 있어. 반대쪽 끝에 있는 사람은 이미 아는 사람과 천천히 관계를 쌓아. 너는 앞쪽에 더 가까워.' });
        overview.push({ en: 'This tends to fit environments that put you in front of new faces often — traveling, a brand-new class or club — better than static settings where the same small group sees each other on repeat.', ko: '이런 성향은 여행이나 완전히 새로운 모임·강좌처럼 새로운 사람을 자주 마주치는 환경과 잘 맞아. 늘 같은 사람들만 보는 고정된 모임보다.' });
        overview.push({ en: 'In everyday terms, it can look like matching with someone on a trip and feeling more excited in three days than about anyone in months, or a promising conversation going quiet within a week without either side quite meaning it.', ko: '일상에서는 여행 가서 만난 사람한테 3일 만에 몇 달치보다 더 크게 설레거나, 잘 되어가던 대화가 누구 잘못도 아닌 채 일주일 만에 조용해지는 식으로 나타날 수 있어.' });
      } else {
        overview.push({ en: "Some people's romantic energy sits firmly on the steady end, while others sit on the fast end. You don't lean hard toward either side; both pulls are genuinely active for you at close to the same strength.", ko: '어떤 사람은 연애 에너지가 안정적이고 느린 쪽 끝에, 어떤 사람은 빠르게 왔다가 식는 쪽 끝에 있어. 너는 어느 한쪽으로 확 기울지 않았어. 두 끌림이 비슷한 세기로 같이 살아있는 편이야.' });
        overview.push({ en: "This kind of dual pull tends to fit situations that mix both — staying open to someone new while not ruling out someone already familiar — rather than deciding in advance which type you're 'supposed' to look for.", ko: "이런 이중적인 끌림은 두 가지를 다 열어두는 상황과 잘 맞아. 미리 '이런 사람'이라고 정해두기보다, 새로운 사람에게도 열려 있으면서 이미 아는 사람도 배제하지 않는 식." });
        overview.push({ en: 'Day to day, it can look like being genuinely torn between a comfortable long-time almost-something and someone new you just met, with no clean way to explain why you cannot just pick one.', ko: '일상에서는 오래 편하게 지내온 썸 상대와 방금 만난 새로운 사람 사이에서 진심으로 갈팡질팡하는 식으로 나타날 수 있어.' });
      }

      var point = [];
      if (total === 0) {
        point.push({ en: 'Because the chasing instinct is quiet, you can look as uninterested as you feel — even when someone has put in visible effort, it can read as nothing at all, while someone with a stronger instinct would catch the signal instantly.', ko: "쫓아가려는 본능 자체가 조용하다 보니, 상대가 눈에 보이게 다가와도 그게 '신호'로 안 읽히는 거야. 이 본능이 강한 사람이라면 바로 알아챘을 텐데." });
        point.push({ en: 'This tends to bite hardest in settings that rely on subtle cues rather than a direct ask — a workplace friendship that could tip into something more, a group where someone is clearly hanging back for you.', ko: '이런 성향은 대놓고 말하기보다 은근한 신호로 흘러가는 상황에서 특히 발목을 잡아. 뭔가로 발전할 수도 있는 직장 내 친분이나 친구 무리 안 상황처럼.' });
        point.push({ en: "It can show up as a friend telling you 'that person clearly likes you' about someone you hadn't noticed, or turning down an invitation without realizing it was meant as a first date.", ko: "친구가 '그 사람 딱 봐도 너 좋아하잖아'라고 말해주기 전까진 진짜 몰랐거나, 사실은 첫 데이트였던 약속을 그냥 거절해버리는 식으로 나타날 수 있어." });
      } else if (jeong > pyeon) {
        point.push({ en: "Chasing safety this hard can flatten the excitement itself — comfort and spark are not the same thing, and someone leaning toward fast attraction would call what you have 'stable' on a good day and 'a little boring' on a slow one.", ko: "너무 안정만 찾다 보면 설렘 자체가 밋밋해질 수 있어. 반대로 빠르고 예측불가한 쪽인 사람이 보면, 네 관계는 잘해야 '안정적', 나쁘게 보면 '좀 심심한' 관계로 보일 수도 있어." });
        point.push({ en: 'This tends to show up hardest early on, where a little unpredictability actually signals interest — playing it too safe too early can read as lukewarm rather than careful.', ko: '이 성향은 이제 막 만나기 시작한 초반에 특히 문제가 돼. 너무 일찍부터 안전하게만 굴면 신중해 보이기보다 미지근해 보일 수 있어.' });
        point.push({ en: "Day to day, it can look like sticking to the same three 'safe' date spots, or waiting for the other person to suggest something exciting instead of proposing it yourself.", ko: "일상에서는 늘 가던 '안전한' 데이트 코스만 뱅뱅 돌거나, 재밌는 걸 먼저 제안하기보다 상대가 먼저 던져주길 기다리는 식으로 나타날 수 있어." });
      } else if (pyeon > jeong) {
        point.push({ en: 'Whatever heats up fast can cool just as fast — keeping a connection going long-term takes a separate, deliberate effort, unlike a steadier type for whom getting interested and staying interested draw from the same source.', ko: '빨리 뜨거워지는 만큼 빨리 식을 수 있어. 관계를 오래 끌고 가는 힘은 처음 끌렸던 본능과는 완전히 다른 영역이야. 안정형인 사람은 두 힘이 같은 데서 나오는데.' });
        point.push({ en: 'This tends to bite hardest right after the initial spark fades — usually around one to three months in — when the relationship needs a second gear that has nothing to do with novelty.', ko: "이 성향은 초반 설렘이 가라앉는 시점, 대략 한두 달쯤 됐을 때 특히 발목을 잡아. 이때부턴 새로움과 상관없는 '2단 기어'가 필요해." });
        point.push({ en: 'In everyday terms, it can look like texting constantly in week one and noticing your replies getting shorter by week six without meaning for it to happen.', ko: '일상에서는 첫 주엔 쉴 새 없이 연락하다가, 6주쯤 되면 딱히 그럴 생각도 없었는데 답장이 점점 짧아지는 걸 스스로 알아채는 식으로 나타날 수 있어.' });
      } else {
        point.push({ en: 'Your interest changes direction often enough to genuinely confuse the person on the other side — someone fully steady never sends mixed signals, someone fully spark-driven is at least consistently exciting; you can do neither reliably.', ko: '마음이 자주 왔다 갔다 해서 상대 입장에선 헷갈릴 수 있어. 완전히 안정형은 애초에 엇갈리는 신호를 안 보내고, 스파크형은 최소한 한결같이 짜릿하기라도 한데, 너는 둘 다 꾸준히 못 해줄 때가 있어.' });
        point.push({ en: "This shows up most clearly in the exclusivity conversation, where 'genuinely both, depending on the week' is not an answer the other person can work with.", ko: "관계 정의 대화에서 가장 분명하게 드러나. '그때그때 달라'는 상대 입장에선 받아들이기 힘든 답이거든." });
        point.push({ en: 'Day to day, it can look like being deeply into someone on Monday and half-wondering about someone else by Friday, then feeling guilty about a shift that was never really under your control.', ko: '일상에서는 월요일엔 완전히 빠져 있다가 금요일엔 다른 사람이 살짝 신경 쓰이는 식으로 나타날 수 있어.' });
      }

      var boost = [];
      if (jeong >= pyeon) {
        boost.push({ en: 'Because your instinct already runs on familiarity, deliberately looking twice at people already around you plays directly to that strength — the person who deepens fastest with you is more likely already in your life.', ko: '연애 본능이 원래 친숙함 위에서 작동하는 편이라, 이미 곁에 있는 사람을 다시 눈여겨보는 게 가장 잘 맞는 방법이야.' });
        boost.push({ en: 'This works especially well in settings where you already see the same faces regularly — a hobby group, a close friend circle — rather than environments built entirely around meeting brand-new people fast.', ko: '오래 같이한 취미 모임, 가까운 친구 무리처럼 원래도 자주 보는 얼굴들이 있는 자리에서 특히 잘 통해.' });
        boost.push({ en: 'In practice, that can mean noticing who consistently remembers small things about you, or being honest about a friend you have quietly been more comfortable around lately.', ko: '실제로는 사소한 걸 계속 기억해주는 사람이 누군지 실제로 알아차려 보거나, 요즘 유독 편한 친구가 있다면 그 마음을 솔직하게 인정해보는 식으로 하면 돼.' });
      } else {
        boost.push({ en: 'Because your instinct runs on novelty and moving fast, just showing up somewhere new plays directly to that strength — a fresh environment does the work for you.', ko: '연애 본능이 새로움과 빠른 전개 쪽으로 작동하는 편이라, 안 가던 자리에 가보는 것만으로도 강점이 그대로 발휘돼.' });
        boost.push({ en: 'This works especially well in settings genuinely built around meeting new people — a new class, a trip — more than places where the same familiar faces show up every time.', ko: '한 번도 안 들어본 강좌나 여행처럼 새로운 사람을 만나는 게 자연스러운 자리에서 특히 잘 통해.' });
        boost.push({ en: 'In practice, that can be as simple as saying yes to a last-minute invitation you would normally skip, or striking up a conversation with a stranger instead of waiting to be introduced.', ko: '실제로는 평소라면 넘겼을 즉흥적인 초대에 응해보거나, 먼저 낯선 사람한테 말을 걸어보는 식으로 하면 돼.' });
      }

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Boost Your Love Luck', '애정운 올리는법', boost);
    },

    marriage: function (ctx) {
      var STAGE_TIER_TEXT = {
        stable: [
          { en: 'The palace that represents your partner can land in a few different states in a chart. Some sit in a strong, settled position — the kind of bond that holds steady once it forms. Others sit in a shakier spot where timing and circumstance do more of the shaping, or in a slow-building spot that never really announces itself. Yours lands in the steady kind — once this bond forms, it tends to hold.', ko: '배우자 자리는 원국마다 다른 상태로 자리 잡아. 어떤 사람은 강하고 안정적인 자리라 한번 맺어지면 오래 가고, 어떤 사람은 타이밍과 상황의 영향을 많이 받는 불안정한 자리, 또 어떤 사람은 확 드러나지 않고 천천히 무르익는 자리야. 너는 안정적인 쪽이야. 한번 맺어지면 오래 가는 흐름이 있어.' },
          { en: 'This tends to suit a fairly traditional, structured path toward marriage well — a formal introduction, a longer engagement, a deliberate process — more than a whirlwind courtship driven purely by momentum.', ko: '이런 흐름은 정식 소개나 긴 약혼 기간처럼, 차근차근 밟아가는 전통적인 방식과 잘 맞아. 순간의 기세로 몰아붙이는 초고속 연애·결혼보다.' },
          { en: "In everyday terms, it can look like a relationship that quietly outlasts several rocky patches other couples might have broken up over, or family members commenting early on that 'this one seems different' without you having done anything unusual.", ko: "일상에서는 다른 커플이라면 헤어졌을 법한 고비를 몇 번 넘기고도 관계가 조용히 이어지거나, 딱히 특별한 걸 한 것도 아닌데 가족들이 일찌감치 '이번엔 느낌이 다르다'고 말하는 식으로 나타날 수 있어." }
        ],
        volatile: [
          { en: "The palace that represents your partner can land in a few different states in a chart. Some sit in a strong, settled position that holds steady once it forms, or a slow-building spot that never announces itself. Yours has some instability mixed in — timing and circumstance shape this more than they do for most people.", ko: '배우자 자리는 원국마다 다른 상태로 자리 잡아. 어떤 사람은 한번 맺어지면 오래 가는 안정적인 자리, 어떤 사람은 확 드러나지 않고 천천히 무르익는 자리야. 너는 기복이 좀 있는 편이야. 타이밍이나 상황의 영향을 남들보다 많이 받을 수 있어.' },
          { en: 'This tends to make a rigid, fast-tracked timeline — get engaged by this date, married by that one — a rougher fit than a more flexible process that can absorb a postponement or a change in plans without it meaning anything is wrong.', ko: "이런 흐름에서는 '몇 월까지 약혼, 몇 월까지 결혼' 식으로 딱 정해둔 빡빡한 일정보다는, 일정이 미뤄지거나 계획이 바뀌어도 크게 문제 삼지 않는 유연한 진행 방식이 더 잘 맞아." },
          { en: 'Day to day, it can look like a wedding date getting moved more than once for reasons that have nothing to do with the relationship itself, or the two of you going through a rough few months that later turns out to have been the thing that actually solidified things.', ko: '일상에서는 관계 자체와는 상관없는 이유로 결혼 날짜가 한 번 이상 밀리거나, 힘든 몇 달을 겪고 나서 오히려 그게 관계를 더 단단하게 만들었다는 걸 나중에 깨닫는 식으로 나타날 수 있어.' }
        ],
        slow: [
          { en: 'The palace that represents your partner can land in a few different states in a chart. Some sit in a strong, settled position that holds once it forms; others sit in a shakier spot shaped heavily by timing and circumstance. Yours tends to build slowly and quietly rather than announce itself all at once.', ko: '배우자 자리는 원국마다 다른 상태로 자리 잡아. 어떤 사람은 한번 맺어지면 오래 가는 안정적인 자리, 어떤 사람은 타이밍과 상황의 영향을 많이 받는 자리야. 너는 한번에 확 오기보다, 천천히 조용히 무르익는 쪽에 가까워.' },
          { en: "This tends to suit a long friendship-first path better than a fast, love-at-first-sight timeline — the kind of bond that starts as 'just a friend' and only later turns into something neither of you saw coming.", ko: "이런 흐름은 첫눈에 반하는 초고속 전개보다, 오래 알고 지낸 친구 사이에서 시작하는 관계와 더 잘 맞아. '그냥 친구'로 시작했다가 둘 다 예상 못한 방향으로 흘러가는 식." },
          { en: "In everyday terms, it can look like realizing years later that someone who was 'just a work friend' had quietly become the person you tell everything to first, or a relationship that outsiders assumed was purely platonic right up until it wasn't.", ko: "일상에서는 그냥 '직장 동료'였던 사람이 어느새 뭐든 제일 먼저 얘기하게 되는 사람이 되어 있다는 걸 몇 년 뒤에야 깨닫거나, 주변에서는 순수하게 친구 사이라고만 생각했던 관계가 알고 보니 그게 아니었던 식으로 나타날 수 있어." }
        ]
      };
      var STABLE_STAGES = { '장생': 1, '관대': 1, '건록': 1, '제왕': 1 };
      var VOLATILE_STAGES = { '목욕': 1, '병': 1, '사': 1, '절': 1 };
      var tier = 'slow';
      if (STABLE_STAGES[ctx.dayZhiStage]) tier = 'stable';
      else if (VOLATILE_STAGES[ctx.dayZhiStage]) tier = 'volatile';

      var isMale = ctx.gender !== 'female';
      var jeongKey = isMale ? '정재' : '정관', pyeonKey = isMale ? '편재' : '편관';
      var jeong = ctx.godCount[jeongKey] || 0, pyeon = ctx.godCount[pyeonKey] || 0;

      var overview = STAGE_TIER_TEXT[tier].slice();
      if (jeong > pyeon) {
        overview.push({ en: 'On top of that, marriage tends to happen through a fairly direct, settled path for you — meeting someone, dating steadily, and arriving at marriage without much detour. The other pattern belongs to people who meet a few different people before settling, each relationship teaching them something about what they actually want. Your path runs closer to the first.', ko: '여기에 더해서, 결혼까지 가는 경로도 비교적 곧고 안정적인 편이야. 누군가를 만나서 꾸준히 연애하다가 큰 우회 없이 결혼까지 가는 흐름. 반대 패턴은 정착하기 전에 몇 사람을 거치면서 원하는 게 뭔지 하나씩 배워가는 쪽이야. 너는 앞쪽 경로에 더 가까워.' });
        overview.push({ en: 'This tends to fit a fairly linear process well — meeting someone through a trusted introduction or a long-standing connection, then moving steadily forward — more than a dating phase that deliberately involves seeing several people to compare.', ko: '이런 흐름은 믿을 만한 소개나 오래된 인연을 통해 만나서 꾸준히 나아가는, 비교적 직선적인 과정과 잘 맞아. 일부러 여러 사람을 동시에 만나며 비교하는 연애 방식보다.' });
        overview.push({ en: 'In everyday terms, it can look like your first serious relationship as an adult ending up being the one you marry, or family and friends never really meeting a string of different partners the way they might for someone else.', ko: '일상에서는 성인이 되고 나서 처음 제대로 사귄 사람이 결국 결혼까지 가는 상대가 되거나, 주변 사람들이 다른 사람들처럼 여러 애인을 거치는 걸 거의 못 보는 식으로 나타날 수 있어.' });
      } else if (pyeon > jeong) {
        overview.push({ en: "On top of that, you may meet a few different people before the one you settle with — that's part of the process, not a detour. The steadier pattern belongs to people whose path to marriage runs fairly direct and linear. Yours runs closer to the exploratory side.", ko: '여기에 더해서, 정착하기 전에 여러 인연을 거칠 가능성이 있어. 그건 돌아가는 게 아니라 그냥 과정의 일부야. 반대로 안정적인 패턴은 결혼까지 곧고 직선적으로 가는 쪽이야. 너는 탐색하는 쪽에 더 가까워.' });
        overview.push({ en: "This tends to fit a dating stretch that genuinely involves meeting different people well, rather than committing early to the first serious connection that comes along — the comparison itself is what eventually sharpens your sense of who actually fits.", ko: '이런 흐름은 초반에 만난 첫 진지한 인연에 서둘러 정착하기보다, 실제로 여러 사람을 만나보는 연애 기간과 잘 맞아. 그 비교 과정 자체가 결국 누가 진짜 맞는 사람인지 알아보는 눈을 길러줘.' });
        overview.push({ en: 'In everyday terms, it can look like a serious relationship or two ending not because anything went wrong, but because you both quietly outgrew being right for each other, and the actual marriage comes later than it might for someone with a straighter path.', ko: '일상에서는 딱히 뭐가 잘못돼서가 아니라 서로 조용히 안 맞아지면서 진지한 관계가 한두 번 끝나기도 하고, 곧은 경로를 가는 사람보다 실제 결혼은 조금 늦게 찾아올 수 있어.' });
      }

      // "포인트" 섹션: 결혼운만 예외적으로 본인이 아닌 배우자상을 서술 (일지=배우자궁 데이터 기반)
      var SPOUSE_GOD_TEXT = {
        '비견': [
          { en: "Some spouse-signals point toward someone with a sharper competitive edge, always subtly measuring who's ahead. Yours points the other way — someone who treats you as a genuine equal, with no hidden scorekeeping.", ko: '어떤 배우자궁은 은근히 승부욕 있고 늘 누가 앞서 있는지 재는 사람을 가리켜. 너의 경우는 반대야. 너를 진짜 동등하게 대하고, 마음속으로 점수 매기는 게 없는 사람.' },
          { en: "In practice, that tends to look like someone who splits a bill without a second thought, admits when they're wrong without needing to be cornered into it, and genuinely means it when they say 'whatever you want is fine.'", ko: "실제로는 계산할 때 굳이 재지 않고 자연스럽게 나눠 내고, 잘못했을 땐 몰아붙이지 않아도 순순히 인정하고, '네가 원하는 대로 해'라는 말을 진심으로 하는 사람일 가능성이 높아." },
          { en: 'Day to day, it can look like the two of you deciding what to eat for dinner in under a minute because neither of you is trying to win the conversation, or splitting chores without ever needing to negotiate who does what.', ko: '일상에서는 서로 대화에서 이기려 들지 않으니 저녁 메뉴 정하는 데 1분도 안 걸리거나, 누가 뭘 할지 협상할 필요 없이 자연스럽게 집안일이 나뉘는 식으로 나타날 수 있어.' }
        ],
        '겁재': [
          { en: 'Some spouse-signals point toward someone who treats you as a calm, no-friction equal. Yours points the other way — someone with a lot of drive and a competitive streak, who keeps you on your toes rather than settling into total calm.', ko: '어떤 배우자궁은 마찰 없이 편안한 동등한 관계를 가리켜. 너의 경우는 반대야. 에너지 넘치고 승부욕 있는, 옆에 있으면 완전히 늘어지긴 힘든 사람.' },
          { en: "In practice, that tends to look like someone who turns a casual board game into something surprisingly intense, has strong opinions about who's a better cook between the two of you, and pushes back rather than just agreeing to keep the peace.", ko: '실제로는 가벼운 보드게임도 의외로 진지하게 임하고, 둘 중 누가 요리를 더 잘하는지에 대한 확고한 의견이 있고, 그냥 맞춰주기보다 할 말은 하는 사람일 가능성이 높아.' },
          { en: "Day to day, it can look like good-natured bickering over who's driving better on a road trip, or the two of you accidentally turning a walk into a race without either of you deciding to.", ko: '일상에서는 장거리 운전 중 누가 운전을 더 잘하는지로 장난스럽게 티격태격하거나, 둘 다 의도한 것도 아닌데 산책이 어느새 경쟁이 되어 있는 식으로 나타날 수 있어.' }
        ],
        '식신': [
          { en: "Some spouse-signals point toward someone sharp and quick to speak their mind. Yours points the other way — someone warm, easygoing, and genuinely good to have around day to day, more soothing presence than sharp edge.", ko: '어떤 배우자궁은 예리하고 할 말은 바로 하는 사람을 가리켜. 너의 경우는 반대야. 다정하고 여유로운, 날카롭기보다 곁에 있으면 마음이 편해지는 사람.' },
          { en: "In practice, that tends to look like someone who's genuinely happy to let you pick the restaurant, laughs easily at things that aren't even that funny, and rarely turns a small disagreement into a big one.", ko: '실제로는 식당 고르는 걸 흔쾌히 너한테 맡기고, 별로 안 웃긴 일에도 잘 웃고, 작은 의견 차이를 큰 싸움으로 키우는 일이 거의 없는 사람일 가능성이 높아.' },
          { en: "Day to day, it can look like coming home stressed and finding the mood in the room noticeably calmer within minutes just because they're there, or a Sunday morning that unfolds with no plan at all and somehow still feels good.", ko: '일상에서는 스트레스 받아서 집에 와도 그 사람이 있으면 몇 분 안에 분위기가 눈에 띄게 편해지거나, 아무 계획 없이 흘러가는 일요일 아침인데도 그냥 좋은 식으로 나타날 수 있어.' }
        ],
        '상관': [
          { en: "Some spouse-signals point toward someone soothing and easygoing, rarely stirring the pot. Yours points the other way — someone sharp, expressive, and unafraid to say what they actually think, even when it's not the comfortable thing to say.", ko: '어떤 배우자궁은 잘 다투지 않는 온화하고 여유로운 사람을 가리켜. 너의 경우는 반대야. 개성 있고 표현력이 좋은, 편한 말이 아니어도 하고 싶은 말은 하는 사람.' },
          { en: "In practice, that tends to look like someone who'll tell you honestly that your new haircut isn't working, has a strong and very specific opinion about how the furniture should be arranged, and gets visibly restless with small talk that goes nowhere.", ko: '실제로는 새 헤어스타일이 별로면 솔직하게 말해주고, 가구 배치에 대한 확고하고 구체적인 취향이 있고, 알맹이 없는 스몰토크에는 금방 지루해하는 사람일 가능성이 높아.' },
          { en: 'Day to day, it can look like a dinner conversation that turns into a genuinely sharp debate about something neither of you needed to have an opinion on, or them saying the exact thing you were both quietly thinking but too polite to bring up.', ko: '일상에서는 딱히 의견 낼 필요도 없는 주제로 저녁 대화가 꽤 날카로운 토론이 되거나, 둘 다 속으로만 생각하던 걸 그 사람이 대놓고 말해버리는 식으로 나타날 수 있어.' }
        ],
        '편재': [
          { en: 'Some spouse-signals point toward someone quietly steady and low-key. Yours points the other way — someone sociable and quick on their feet, with good taste and a wide circle that keeps your own social life livelier by extension.', ko: '어떤 배우자궁은 조용하고 차분한 사람을 가리켜. 너의 경우는 반대야. 사교적이고 감각 좋은, 발이 넓어서 덕분에 네 인간관계도 같이 활발해지는 사람.' },
          { en: 'In practice, that tends to look like someone who already has a restaurant recommendation ready for any occasion, seems to know somebody wherever you go, and can make a decision about a big purchase faster than you are comfortable with.', ko: '실제로는 어떤 상황이든 이미 식당 하나쯤은 추천할 준비가 돼 있고, 어딜 가도 아는 사람이 있는 것 같고, 큰 지출 결정을 너보다 훨씬 빠르게 내리는 사람일 가능성이 높아.' },
          { en: 'Day to day, it can look like a weekend suddenly filling up with plans because they ran into three different friends, or them talking you into a spontaneous purchase you had not even been considering an hour earlier.', ko: '일상에서는 우연히 아는 사람 셋을 마주쳐서 주말 일정이 갑자기 꽉 차거나, 한 시간 전까지만 해도 생각도 안 했던 충동구매를 그 사람 말에 넘어가서 해버리는 식으로 나타날 수 있어.' }
        ],
        '정재': [
          { en: 'Some spouse-signals point toward someone flashy and quick-moving, always juggling several things at once. Yours points the other way — someone steady, dependable, and quietly diligent about the practical side of life.', ko: '어떤 배우자궁은 화려하고 빠르게 움직이는, 늘 여러 일을 동시에 굴리는 사람을 가리켜. 너의 경우는 반대야. 성실하고 꾸준한, 현실적인 부분을 묵묵히 챙기는 사람.' },
          { en: "In practice, that tends to look like someone who actually reads the terms before signing anything, quietly keeps the household bills paid on time without ever making it a topic of conversation, and sticks to a plan once it's made rather than improvising halfway through.", ko: '실제로는 뭔가에 서명하기 전에 약관을 실제로 읽어보고, 집안 공과금을 굳이 얘기 안 해도 알아서 제때 처리하고, 한번 세운 계획은 중간에 즉흥적으로 바꾸기보다 그대로 지켜가는 사람일 가능성이 높아.' },
          { en: "Day to day, it can look like discovering they've been quietly saving toward something for months without mentioning it, or them being the one who remembers to renew the car insurance three weeks before it's due.", ko: '일상에서는 몇 달 동안 말없이 뭔가를 위해 꾸준히 저축해온 걸 나중에 알게 되거나, 자동차 보험 갱신일을 3주나 앞두고 미리 챙기는 사람이 그 사람인 식으로 나타날 수 있어.' }
        ],
        '편관': [
          { en: "Some spouse-signals point toward someone principled who follows the rules closely. Yours points the other way — someone with real presence and a commanding energy, intense, and used to taking the lead rather than waiting to be told what's next.", ko: '어떤 배우자궁은 원칙을 착실히 지키는 반듯한 사람을 가리켜. 너의 경우는 반대야. 카리스마 있고 주도적인, 다음에 뭘 할지 누가 정해주길 기다리기보다 존재감 있게 이끄는 사람.' },
          { en: "In practice, that tends to look like someone who takes charge of the itinerary on a trip without being asked, has a strong physical presence in a room even when they're not trying to, and doesn't back down easily once they've decided something.", ko: '실제로는 여행 계획을 묻지도 않았는데 알아서 짜고, 딱히 애쓰지 않아도 방에 들어오면 존재감이 확 느껴지고, 한번 결정한 건 쉽게 물러서지 않는 사람일 가능성이 높아.' },
          { en: 'Day to day, it can look like them stepping in and just handling a stressful situation — a bad customer service call, a confrontation with a neighbor — before you even finish deciding how you feel about it.', ko: '일상에서는 진상 고객센터 통화나 이웃과의 마찰 같은 골치 아픈 상황을, 네가 어떻게 반응할지 정하기도 전에 그 사람이 먼저 나서서 처리해버리는 식으로 나타날 수 있어.' }
        ],
        '정관': [
          { en: "Some spouse-signals point toward someone intense and commanding, used to taking the lead on instinct. Yours points the other way — someone principled and reliable, the kind who takes responsibility seriously and follows through on what they say.", ko: '어떤 배우자궁은 본능적으로 앞장서는 강렬하고 주도적인 사람을 가리켜. 너의 경우는 반대야. 책임감 있고 반듯한, 말한 건 지키고 원칙을 지키는 사람.' },
          { en: 'In practice, that tends to look like someone who shows up exactly when they said they would, keeps a promise even after the reason for making it has faded, and takes on responsibility without being asked twice.', ko: '실제로는 약속한 시간에 정확히 나타나고, 약속한 이유가 흐려진 뒤에도 그 약속을 지키고, 두 번 부탁하지 않아도 책임을 지는 사람일 가능성이 높아.' },
          { en: 'Day to day, it can look like them quietly handling the boring, responsible tasks — taxes, warranty paperwork, renewing a lease — without it ever turning into a whole conversation about who has to deal with it.', ko: '일상에서는 세금 신고나 보증서 처리, 계약 갱신처럼 지루하고 책임 따르는 일들을, 누가 할 건지 얘기가 나오기도 전에 그 사람이 조용히 처리해버리는 식으로 나타날 수 있어.' }
        ],
        '편인': [
          { en: 'Some spouse-signals point toward someone warm and openly nurturing. Yours points the other way — someone thoughtful and a little unconventional, with a mind that runs deep and does not always show what it is thinking on the surface.', ko: '어떤 배우자궁은 따뜻하고 티 나게 챙겨주는 사람을 가리켜. 너의 경우는 반대야. 생각이 깊고 독특한 매력이 있는, 겉으로는 속을 잘 안 드러내는 사람.' },
          { en: 'In practice, that tends to look like someone with an unusual hobby or niche interest they can talk about for an hour, who processes a hard conversation quietly for a day before actually responding to it, and who sees a solution to a problem that genuinely would not have occurred to you.', ko: '실제로는 한 시간도 떠들 수 있는 독특한 취미나 관심사가 있고, 힘든 대화가 있으면 하루쯤 조용히 곱씹고 나서야 반응하고, 너라면 생각도 못 했을 해결책을 떠올리는 사람일 가능성이 높아.' },
          { en: 'Day to day, it can look like a conversation that starts about dinner plans and somehow ends up on a genuinely strange, fascinating tangent, or them being quietly unreadable for a bit before finally sharing what was actually on their mind.', ko: '일상에서는 저녁 메뉴 얘기로 시작한 대화가 어느새 진짜 엉뚱하고 흥미로운 곁길로 새거나, 한동안 속을 종잡기 힘들게 조용하다가 결국 진짜 하고 싶던 말을 꺼내는 식으로 나타날 수 있어.' }
        ],
        '정인': [
          { en: 'Some spouse-signals point toward someone deep and a little hard to read on the surface. Yours points the other way — someone warm and nurturing, who looks after you without making a show of it.', ko: '어떤 배우자궁은 속이 깊고 겉으로는 좀 종잡기 힘든 사람을 가리켜. 너의 경우는 반대야. 포근하고 배려심 많은, 티 안 나게 챙겨주는 사람.' },
          { en: 'In practice, that tends to look like someone who notices you are coming down with something before you say a word, remembers exactly how you like your coffee without needing to ask again, and checks in on hard days without making it feel like a big deal.', ko: '실제로는 네가 말하기도 전에 어딘가 안 좋은 걸 알아채고, 커피 취향을 다시 물어볼 필요 없이 정확히 기억하고, 힘든 날에도 부담스럽지 않게 슬쩍 안부를 챙기는 사람일 가능성이 높아.' },
          { en: 'Day to day, it can look like finding a snack quietly left on your desk on a day you mentioned skipping lunch, or them adjusting the whole evening\'s plans around you being tired without ever making you feel like you inconvenienced anyone.', ko: '일상에서는 점심 걸렀다고 얘기했던 날 책상 위에 조용히 간식이 놓여 있거나, 네가 피곤하다고 하면 그날 저녁 계획을 자연스럽게 다 맞춰주면서도 전혀 눈치 주지 않는 식으로 나타날 수 있어.' }
        ]
      };
      var SPOUSE_STAGE_TEXT = {
        stable: [
          { en: 'Some partners run emotionally unpredictable, warm one day and distant the next for reasons that are never quite clear. Yours runs the other way — steady, consistent energy, not the type to flip on you without warning.', ko: '어떤 배우자는 감정 기복이 있어서, 오늘 다정했다가 내일은 이유 없이 거리를 두기도 해. 너의 배우자는 반대야. 기복 없이 한결같은 사람일 가능성이 높아.' },
          { en: "In practice, that tends to look like someone whose mood on a Tuesday tells you almost nothing new about how they'll be on Friday, and who doesn't require you to check the emotional weather before bringing something up.", ko: '실제로는 화요일 기분을 봐도 금요일이 어떨지 딱히 다르게 예상할 필요가 없고, 뭔가 얘기 꺼내기 전에 그 사람 기분부터 살필 필요가 없는 사람일 가능성이 높아.' },
          { en: "Day to day, it can look like being able to bring up a genuinely difficult topic on an ordinary Tuesday evening without needing to wait for the 'right mood,' because there usually isn't a wrong one.", ko: "일상에서는 '괜찮은 타이밍'을 굳이 기다릴 필요 없이 평범한 화요일 저녁에도 어려운 얘기를 꺼낼 수 있는 식으로 나타날 수 있어. 대부분 딱히 안 좋은 타이밍이랄 게 없거든." }
        ],
        volatile: [
          { en: 'Some partners run on steady, predictable energy day to day. Yours runs the other way — with some unpredictable, hard-to-pin-down moods mixed in, so the same conversation can land differently depending on the day.', ko: '어떤 배우자는 매일 안정적이고 예측 가능한 컨디션이야. 너의 배우자는 반대야. 종잡기 힘든 기복이 좀 섞여 있어서, 같은 얘기도 날에 따라 다르게 받아들여질 수 있어.' },
          { en: 'In practice, that tends to mean gently checking in on how they are doing before diving into something heavier, and not reading too much into one off day, since it usually is not about you.', ko: '실제로는 무거운 얘기를 꺼내기 전에 컨디션을 한 번 슬쩍 살펴보는 게 도움이 되고, 유독 안 좋은 하루를 너무 심각하게 받아들이지 않는 게 나아. 보통 너 때문이 아니거든.' },
          { en: "Day to day, it can look like the same request landing as 'sure, no problem' on one evening and 'can we talk about this later' on another, even though nothing about the request itself changed.", ko: "일상에서는 똑같은 부탁인데 어떤 날엔 '그래, 그러자'로 넘어가고 어떤 날엔 '그건 나중에 얘기하자'로 넘어가는 식으로 나타날 수 있어. 부탁 내용 자체는 달라진 게 없는데도." }
        ],
        slow: [
          { en: 'Some partners open up quickly, sharing everything within the first few conversations. Yours runs the other way — someone who opens up slowly and needs real time before letting their guard down completely.', ko: '어떤 배우자는 초반부터 빠르게 마음을 열고 이것저것 다 얘기해. 너의 배우자는 반대야. 마음을 천천히, 신중하게 여는 사람일 가능성이 높아.' },
          { en: 'In practice, that tends to mean the version of them you see in year one and the version you see in year five can feel like meeting a deeper layer of the same person, rather than any real change in who they are.', ko: '실제로는 만난 지 1년 됐을 때의 모습과 5년 됐을 때의 모습이, 사람이 바뀐 게 아니라 그 사람의 더 깊은 층을 새로 알게 되는 느낌에 가까울 수 있어.' },
          { en: 'Day to day, it can look like a story about their childhood or an old insecurity finally coming out years into the relationship, not because they were hiding it, but because that is simply how long it took to feel ready.', ko: '일상에서는 어린 시절 이야기나 오래된 불안 같은 게 관계 시작 몇 년이 지나서야 나오기도 해. 숨긴 게 아니라, 원래 그만큼 시간이 필요했던 것뿐이야.' }
        ]
      };
      var point = [];
      if (ctx.dayZhiGod && ctx.dayZhiGod.length) {
        var traitArr = SPOUSE_GOD_TEXT[ctx.dayZhiGod[0]];
        if (traitArr) {
          point = point.concat(traitArr);
        }
        point = point.concat(SPOUSE_STAGE_TEXT[tier]);
      } else {
        point.push({ en: 'Some charts point clearly to one dominant spouse-type — steady, sharp, commanding, whichever it is. Yours does not lock onto a single one; the spouse-palace here reads more like a genuine mix than one dominant signal.', ko: '어떤 원국은 배우자 유형이 안정형이든 날카로운 쪽이든 카리스마형이든, 하나로 뚜렷하게 나와. 너는 그렇지 않아. 배우자궁이 하나로 딱 떨어지기보다, 여러 성향이 섞인 쪽에 가까워.' });
        point.push({ en: 'In practice, that tends to mean a partner who can surprise you by being unexpectedly decisive in one situation and unexpectedly gentle in the next, without either side feeling like a contradiction once you actually know them.', ko: '실제로는 어떤 상황에서는 예상외로 단호하다가, 다른 상황에서는 또 예상외로 부드러운 사람일 수 있어. 막상 알고 보면 그 둘이 모순처럼 느껴지지 않는 사람.' });
        point.push({ en: "Day to day, it can look like friends who meet your partner once having a hard time summing them up in a single sentence, which usually just means there's more there than one label can hold.", ko: '일상에서는 네 배우자를 한 번 만난 친구들이 한마디로 설명하기 어려워하는 식으로 나타날 수 있어. 보통 이건 한 단어로 담기엔 그 사람 안에 더 많은 게 있다는 뜻이야.' });
      }

      var boost = [];
      if (jeong > pyeon) {
        boost.push({ en: "Investing seriously in the steady, already-real connection in front of you works in your favor — someone leaning the opposite way would do better spreading attention across a few different people first, but that's not where your strength lies.", ko: '지금 곁에 있는 안정적인 인연을 신중하게 키워가는 게 결혼운에 유리해. 반대 성향인 사람이라면 여러 사람한테 관심을 나눠보는 게 나을 수 있지만, 너의 강점은 그쪽이 아니야.' });
        boost.push({ en: 'This tends to fit deepening one relationship deliberately — meeting each other\'s families earlier rather than later, having the serious conversations about the future sooner — better than keeping things deliberately casual for longer to compare options.', ko: '이런 성향은 한 사람과의 관계를 의도적으로 깊게 만드는 것과 잘 맞아. 가족 소개를 미루지 않고 비교적 일찍 하거나, 미래에 대한 진지한 대화를 서두르는 것처럼. 선택지를 비교하려고 일부러 관계를 가볍게 오래 끄는 것보다.' });
        boost.push({ en: 'In practice, that can be as simple as actually naming the relationship as serious out loud sooner rather than later, or planning a shared milestone — a trip together, meeting parents — instead of waiting for it to happen on its own.', ko: '실제로는 관계를 진지하게 규정하는 말을 미루지 않고 먼저 꺼내보거나, 저절로 일어나길 기다리기보다 함께 여행을 가거나 부모님을 뵙는 것 같은 공동의 이정표를 직접 계획해보는 식으로 하면 돼.' });
      } else if (pyeon > jeong) {
        boost.push({ en: 'Do not be afraid to meet a range of people first — that experience is exactly what sharpens your eye for the right one. Someone leaning the opposite way might do better committing early, but for you, the comparison itself is doing real work.', ko: '여러 사람을 만나보는 걸 두려워하지 마. 그 경험이 맞는 사람을 알아보는 눈을 길러줘. 반대 성향인 사람이라면 일찍 정착하는 게 나을 수도 있지만, 너에게는 비교하는 과정 자체가 진짜 도움이 돼.' });
        boost.push({ en: "This tends to fit staying genuinely open during the dating phase — not rushing to define things, giving yourself permission to date around a little — better than locking into the first serious connection out of a fear of 'wasting time.'", ko: "이런 성향은 연애 초반에 관계를 서둘러 규정하지 않고, 여러 사람을 만나볼 여지를 스스로에게 주는 것과 잘 맞아. '시간 낭비'가 두려워서 첫 진지한 인연에 서둘러 정착하는 것보다." });
        boost.push({ en: 'In practice, that can mean genuinely giving a second or third date a real chance even when the first one was not a lightning bolt, rather than writing someone off too early based on one dinner.', ko: '실제로는 첫 데이트에서 확 오지 않았다고 성급하게 사람을 판단하기보다, 두 번째, 세 번째 만남에도 진짜 기회를 줘보는 식으로 하면 돼.' });
      }
      if (tier === 'stable') {
        boost.push({ en: "Some relationships need active intervention to stay on track; yours generally doesn't — the current rhythm is already working in your favor, and the instinct to 'fix' something that isn't broken can do more harm than the thing you were worried about.", ko: '어떤 관계는 흐름을 유지하려고 계속 손을 봐야 해. 네 관계는 그렇지 않아. 지금 흐름이 이미 너한테 유리하게 흘러가고 있어서, 오히려 멀쩡한 걸 고치려는 마음이 걱정하던 것보다 더 문제가 될 수 있어.' });
        boost.push({ en: "This tends to mean trusting the pace you've naturally settled into — however unremarkable it looks from the outside — over advice built for relationships that actually need more excitement or intervention.", ko: '이건 겉보기엔 별거 없어 보여도, 너희가 자연스럽게 자리 잡은 페이스를 믿는다는 뜻이야. 더 자극적이거나 개입이 필요한 관계를 위한 조언보다.' });
        boost.push({ en: "In practice, that can be as simple as not manufacturing drama or tests to 'check' the relationship is real, and just letting an ordinary, steady week be exactly what it is.", ko: "실제로는 관계가 진짜인지 확인해보겠다고 괜히 드라마나 시험 같은 걸 만들지 말고, 평범하고 안정적인 한 주를 그냥 그대로 흘려보내는 식으로 하면 돼." });
      } else if (tier === 'volatile') {
        boost.push({ en: 'Timing does more work in this kind of relationship than it does in a steadier one, so saving the big moments — meeting the family, the proposal — for days when things feel calm and settled matters more for you than it would for someone with a more even-keeled bond.', ko: '이런 관계는 안정적인 관계보다 타이밍이 훨씬 중요하게 작용해. 그래서 상견례나 프로포즈 같은 큰 결정은, 더 평탄한 관계를 가진 사람보다 너에게 훨씬 더 감정이 안정된 날을 고르는 게 중요해.' });
        boost.push({ en: 'This tends to mean reading the room — quite literally — before scheduling anything emotionally loaded, rather than sticking rigidly to a calendar date regardless of how things feel that week.', ko: '이건 감정적으로 무거운 일정을 잡기 전에, 그 주의 분위기를 진짜로 살펴본다는 뜻이야. 그 주 기분이 어떻든 상관없이 캘린더에 정한 날짜를 그대로 밀어붙이기보다.' });
        boost.push({ en: 'In practice, that can mean noticing the relationship has felt unusually smooth for a couple of weeks and using that window for the conversation or the proposal, rather than forcing it onto a date picked months in advance during a rough patch.', ko: '실제로는 최근 몇 주간 관계가 유독 순탄했다는 걸 알아채고 그 시기를 활용해서 중요한 대화나 프로포즈를 하는 식으로 하면 돼. 몇 달 전 힘들었던 시기에 미리 정해둔 날짜에 억지로 맞추기보다.' });
      } else {
        boost.push({ en: 'A relationship that forms fast can look further along sooner, but yours needs more time to fully settle, and rushing it to match someone else\'s timeline tends to cost more than it saves.', ko: '빠르게 형성되는 관계는 겉보기에 더 빨리 진전된 것처럼 보이지만, 네 관계는 완전히 자리 잡는 데 시간이 더 필요해. 남들 속도에 맞춰 서두르면 아낀 시간보다 잃는 게 더 클 수 있어.' });
        boost.push({ en: 'This tends to mean measuring progress by how the relationship actually feels rather than by a calendar milestone — the two-year mark meaning less here than whether trust has genuinely deepened.', ko: "이건 관계의 진전을 캘린더상의 이정표가 아니라 실제로 느껴지는 걸로 재야 한다는 뜻이야. '사귄 지 2년'이라는 숫자보다, 신뢰가 진짜로 깊어졌는지가 더 중요해." });
        boost.push({ en: "In practice, that can be as simple as not comparing your timeline to a friend's engagement announcement, and trusting that a proposal that comes later, once things have genuinely settled, tends to hold up better for you than one that comes early.", ko: '실제로는 친구의 약혼 소식과 네 속도를 비교하지 않고, 관계가 진짜로 자리 잡은 뒤 조금 늦게 오는 프로포즈가 너에게는 더 오래 가는 결과로 이어진다는 걸 믿어보는 식으로 하면 돼.' });
      }

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Your Partner', '배우자상', point) +
        sectionHtml('Boost Your Marriage Luck', '결혼운 올리는법', boost);
    },

    career: function (ctx) {
      var gwan = godTotal(ctx.godCount, ['정관', '편관']);
      var siksang = godTotal(ctx.godCount, ['식신', '상관']);
      var jeonggwan = ctx.godCount['정관'] || 0, pyeongwan = ctx.godCount['편관'] || 0;
      var siksin = ctx.godCount['식신'] || 0, sanggwan = ctx.godCount['상관'] || 0;

      var overview = [];
      var mode;
      if (gwan > 0 && gwan >= siksang) {
        if (jeonggwan >= pyeongwan) {
          mode = 'jeonggwan';
          overview.push({ en: 'Some people do their best work when things get chaotic and pressure spikes; others need a clear structure to actually perform. You are the second type — a defined role, a chain of command, a path you can climb, is where you work best.', ko: '어떤 사람은 상황이 급박해지고 압박이 커질 때 오히려 진가를 발휘해. 어떤 사람은 명확한 체계가 있어야 제대로 움직여. 너는 후자 쪽이야. 정해진 역할, 위계, 올라갈 수 있는 길이 있는 곳에서 제일 잘 움직여.' });
          overview.push({ en: 'This tends to suit large, structured organizations — a big company, government, a traditional corporate ladder — better than a scrappy startup where the rules get rewritten every quarter.', ko: '이런 성향은 대기업이나 공공기관, 전통적인 승진 사다리가 있는 조직처럼 체계가 뚜렷한 곳과 잘 맞아. 규칙이 분기마다 바뀌는 스타트업보다.' });
          overview.push({ en: 'In everyday terms, it can look like actually reading the employee handbook when you start a new job, or feeling a real sense of relief the moment a vague project finally gets a clear org chart attached to it.', ko: '일상에서는 새 직장에 들어가면 사원 매뉴얼을 실제로 읽어보거나, 모호했던 프로젝트에 명확한 조직도가 딱 붙는 순간 진짜 안심이 되는 식으로 나타날 수 있어.' });
        } else {
          mode = 'pyeongwan';
          overview.push({ en: 'Some people need a clear, stable structure to do their best work; others come alive precisely when that structure breaks down. You are the second type — you thrive under pressure and step up when things get demanding, and crisis brings out your best work.', ko: '어떤 사람은 명확하고 안정된 체계가 있어야 제일 잘해. 어떤 사람은 오히려 그 체계가 흔들릴 때 살아나. 너는 후자 쪽이야. 압박이 있을 때 힘을 내고, 위기 상황에서 진가를 발휘해.' });
          overview.push({ en: 'This tends to suit fast-moving, high-stakes environments — emergency response, a startup in crunch mode, high-pressure sales — better than a slow-moving bureaucracy where nothing urgent ever happens.', ko: '이런 성향은 응급 대응이나 마감에 몰린 스타트업, 압박 강한 영업직처럼 빠르고 긴박한 환경과 잘 맞아. 급한 일이 거의 없는 느린 관료 조직보다.' });
          overview.push({ en: 'In everyday terms, it can look like feeling oddly more focused the day before a deadline than you were the whole week leading up to it, or being the person the team quietly turns to the moment something actually goes wrong.', ko: '일상에서는 마감 일주일 전보다 마감 하루 전에 오히려 더 집중이 잘되거나, 뭔가 진짜 잘못됐을 때 팀이 조용히 너를 찾게 되는 식으로 나타날 수 있어.' });
        }
      } else if (siksang > 0 && siksang > gwan) {
        if (siksin >= sanggwan) {
          mode = 'siksin';
          overview.push({ en: 'Some people build a career by standing out fast and loud; others build it by getting quietly, steadily better at one thing over years. You are the second type — your career grows through quietly getting better at one specific craft over time.', ko: '어떤 사람은 빠르고 요란하게 눈에 띄면서 커리어를 쌓아. 어떤 사람은 몇 년에 걸쳐 조용히 한 가지를 꾸준히 잘하게 되면서 쌓아. 너는 후자 쪽이야. 한 가지 전문성을 조용히 계속 갈고닦으면서 커리어가 자라는 타입.' });
          overview.push({ en: 'This tends to suit craft-based, depth-rewarding work — engineering, research, a specialized trade — better than roles that mostly reward being the loudest voice in the room.', ko: '이런 성향은 엔지니어링, 연구, 전문 기술직처럼 깊이가 보상받는 일과 잘 맞아. 회의실에서 가장 목소리 큰 사람이 보상받는 자리보다.' });
          overview.push({ en: 'In everyday terms, it can look like being quietly the most reliable person on a team for years before anyone above you notices, or genuinely preferring one more hour of focused work over one more hour of self-promotion.', ko: '일상에서는 몇 년 동안 팀에서 가장 꾸준한 사람인데도 윗사람이 한참 뒤에야 알아차리거나, 자기 어필에 한 시간 더 쓰는 것보다 집중해서 일하는 한 시간을 더 원하는 식으로 나타날 수 있어.' });
        } else {
          mode = 'sanggwan';
          overview.push({ en: 'Some people build a career through quiet, steady consistency; others build it by doing things visibly differently from everyone else in the room. You are the second type — you stand out by doing things your own way, and not everyone loves that, but it works.', ko: '어떤 사람은 조용하고 꾸준한 방식으로 커리어를 쌓아. 어떤 사람은 남들과 눈에 띄게 다른 방식으로 쌓아. 너는 후자 쪽이야. 자기 방식으로 눈에 띄는 편이고, 모두가 좋아하진 않지만 결국 통해.' });
          overview.push({ en: 'This tends to suit creative or unconventional roles — design, content, anything where a distinct point of view is the actual product — better than a role that rewards blending seamlessly into an existing process.', ko: '이런 성향은 디자인, 콘텐츠처럼 개성 있는 관점 자체가 결과물이 되는 창의적인 일과 잘 맞아. 기존 프로세스에 매끄럽게 녹아드는 게 보상받는 자리보다.' });
          overview.push({ en: 'In everyday terms, it can look like proposing the one idea in the meeting nobody else would have suggested, or getting a mix of genuine praise and pushback on the same piece of work.', ko: '일상에서는 회의에서 아무도 생각 못 했을 아이디어를 던지거나, 같은 결과물에 대해 진심 어린 칭찬과 반발을 동시에 받는 식으로 나타날 수 있어.' });
        }
      } else if (gwan > 0 && siksang > 0) {
        mode = 'hybrid';
        overview.push({ en: "Some people work purely on craft with no system around them; others operate purely inside a system with no particular expertise of their own. You blend both — you're the specialist inside the system, real expertise applied within an actual structure.", ko: '어떤 사람은 체계 없이 순수하게 실력만으로 일해. 어떤 사람은 특별한 전문성 없이 체계 안에서만 움직여. 너는 둘을 같이 가진 편이야. 조직 안에서 전문성을 발휘하는 타입, 실력도 있고 그걸 담을 체계도 있어.' });
        overview.push({ en: 'This tends to suit roles like a specialist inside a larger organization — an in-house expert, a technical lead within a company — better than either pure freelance craft with no structure, or a purely generalist management track with no depth.', ko: '이런 성향은 큰 조직 안의 전문가, 예를 들면 사내 전문가나 기술 리드 같은 역할과 잘 맞아. 체계 없는 순수 프리랜서 일이나, 깊이 없는 순수 제너럴리스트 관리직 트랙보다.' });
        overview.push({ en: 'In everyday terms, it can look like being the person a team pulls in specifically for your expertise, but who also actually knows how to navigate the org chart to get something approved.', ko: '일상에서는 팀이 특정 전문성 때문에 너를 콕 집어서 부르는데, 동시에 그걸 실제로 승인받기 위해 조직도를 어떻게 움직여야 하는지도 아는 사람이 되는 식으로 나타날 수 있어.' });
      } else {
        mode = 'none';
        overview.push({ en: "Some people have a career direction that's already locked in, pulling them clearly one way. Yours isn't locked in yet — you move flexibly and figure out the shape of it as you go, rather than following one obvious pull.", ko: '어떤 사람은 커리어 방향이 이미 확실하게 정해져서 한쪽으로 뚜렷하게 끌려. 너는 아직 그렇지 않아. 하나의 뚜렷한 방향을 따르기보다, 상황에 맞춰 유연하게 움직이면서 모양을 만들어가는 편이야.' });
        overview.push({ en: 'This tends to suit roles and stages of life that reward range over specialization — an early career where you are still exploring, a generalist role, a startup where you wear several hats — better than a rigid, single-track career path.', ko: '이런 성향은 전문성보다 다양한 경험이 보상받는 자리나 시기, 아직 탐색 중인 커리어 초반, 제너럴리스트 역할, 여러 역할을 겸하는 스타트업과 잘 맞아. 하나의 트랙만 있는 경직된 커리어 경로보다.' });
        overview.push({ en: "In everyday terms, it can look like your resume genuinely not having an obvious theme yet, or feeling equally drawn to two very different job postings without either one feeling clearly 'more you.'", ko: "일상에서는 이력서에 아직 뚜렷한 테마가 없거나, 완전히 다른 두 채용 공고에 똑같이 끌리는데 어느 쪽도 확실히 '나답다'고 느껴지지 않는 식으로 나타날 수 있어." });
      }

      var POINT_TEXT = {
        jeonggwan: [
          { en: 'You do well inside the rules, but a sudden curveball outside the playbook can throw you more than it should — someone wired for crisis would barely blink at the same disruption.', ko: '규칙 안에서는 강한데, 예상 밖 변수가 생기면 유연하게 대처하는 힘이 약할 수 있어. 위기에 강한 사람이라면 똑같은 돌발상황에도 별로 흔들리지 않았을 텐데.' },
          { en: 'This tends to bite hardest when a company suddenly reorganizes, a process you relied on gets scrapped overnight, or a manager who followed the rules gets replaced by one who does not.', ko: '이런 성향은 회사가 갑자기 조직 개편을 하거나, 의지하던 프로세스가 하룻밤 새 사라지거나, 원칙을 지키던 상사가 그렇지 않은 사람으로 바뀔 때 특히 발목을 잡아.' },
          { en: 'Day to day, it can look like freezing for a moment when a meeting gets abruptly cancelled with no replacement plan, or feeling more rattled by an unannounced schedule change than the situation actually warrants.', ko: '일상에서는 대체 계획도 없이 회의가 갑자기 취소되면 잠깐 멍해지거나, 예고 없는 일정 변경에 상황보다 더 크게 흔들리는 식으로 나타날 수 있어.' }
        ],
        pyeongwan: [
          { en: 'A crisis brings out your best, but ordinary, quiet stretches can leave you unfocused and restless — someone wired for structure would use that same calm period to steadily build, while it tends to drain you instead.', ko: '위기엔 강한데, 평온한 시기엔 오히려 집중력이 흐트러질 수 있어. 체계형인 사람이라면 그 잔잔한 시기를 오히려 꾸준히 쌓는 데 썼을 텐데, 너한테는 그 시기가 오히려 힘 빠지는 시간이 될 수 있어.' },
          { en: 'This tends to bite hardest during long stretches with no urgent deadline — a slow quarter, a maintenance-mode project — where nothing is actively demanding your attention.', ko: '이런 성향은 급한 마감이 없는 긴 기간, 예를 들면 한산한 분기나 유지보수 위주 프로젝트에서 특히 발목을 잡아. 딱히 널 붙잡아둘 급한 일이 없을 때.' },
          { en: 'Day to day, it can look like productivity noticeably dipping during a calm week, or catching yourself almost hoping for a small crisis just to feel engaged again.', ko: '일상에서는 조용한 한 주엔 생산성이 눈에 띄게 떨어지거나, 다시 몰입감을 느끼려고 은근히 작은 위기를 바라게 되는 식으로 나타날 수 있어.' }
        ],
        siksin: [
          { en: 'The consistency is real, but promoting yourself and your work is where you tend to fall short — someone wired for standing out would turn the exact same steady output into visibility without even trying that hard.', ko: '꾸준하긴 한데, 스스로를 알리고 어필하는 데는 약할 수 있어. 눈에 띄는 쪽에 강한 사람이라면 똑같은 꾸준한 성과로도 별로 애쓰지 않고 존재감을 만들었을 텐데.' },
          { en: 'This tends to bite hardest at review time or during a promotion cycle, where the people who talk about their work the loudest often get noticed first, regardless of who actually did more.', ko: '이런 성향은 평가 시즌이나 승진 시기에 특히 발목을 잡아. 실제로 누가 더 많이 했는지와 상관없이, 자기 일을 더 크게 말하는 사람이 먼저 눈에 띄는 경우가 많거든.' },
          { en: 'Day to day, it can look like a colleague getting credit for an idea you actually had first because they mentioned it in the meeting and you did not, or genuinely forgetting to list a major accomplishment on your own resume.', ko: '일상에서는 사실 네가 먼저 낸 아이디어를 동료가 회의에서 먼저 말해서 그 공을 가져가거나, 정작 이력서에 큰 성과를 빼먹고 안 적는 식으로 나타날 수 있어.' }
        ],
        sanggwan: [
          { en: 'The talent is real, but how you show it can come across as too sharp and get misread — someone wired for quiet consistency would rarely ruffle feathers, but staying that quiet is not really an option for you either.', ko: '실력은 있는데, 그걸 표현하는 방식이 너무 튀어서 오해를 살 때가 있어. 조용하고 꾸준한 쪽에 강한 사람이라면 거의 마찰을 안 일으켰겠지만, 너는 그렇게까지 조용히 있는 게 애초에 잘 안 맞아.' },
          { en: "This tends to bite hardest in traditional or hierarchical workplaces, where a junior person's unconventional idea can read as overstepping rather than as the contribution it actually is.", ko: '이런 성향은 전통적이고 위계가 강한 직장에서 특히 발목을 잡아. 아랫사람의 튀는 아이디어가 실제 기여로 읽히기보다 선 넘는다는 식으로 읽힐 수 있거든.' },
          { en: "Day to day, it can look like a genuinely good suggestion in a meeting landing awkwardly because of how directly it was said, or a manager describing you as 'talented but difficult' in the same sentence.", ko: "일상에서는 회의에서 낸 진짜 좋은 제안이 말투 때문에 어색하게 받아들여지거나, 상사가 한 문장 안에 '재능은 있는데 좀 힘들다'고 너를 평가하는 식으로 나타날 수 있어." }
        ],
        hybrid: [
          { en: 'Having both expertise and structure available can leave you half-committed to either, never fully diving into one — someone with only the craft side would have no choice but to go deep, while your split focus makes going deep an actual decision you have to make on purpose.', ko: '전문성과 체계 둘 다 있는데, 어느 하나에 완전히 몰입하지 못해 애매해질 때가 있어. 실력 한쪽만 있는 사람이라면 깊이 파는 것 말고는 선택지가 없었겠지만, 너는 초점이 나뉘어 있어서 깊이 파는 것도 일부러 결정해야 하는 일이 돼.' },
          { en: 'This tends to bite hardest when a role forces a choice — a promotion into pure management that pulls you away from the craft, or a specialist track that asks you to stop worrying about the org chart.', ko: '이런 성향은 역할이 하나를 선택하도록 강요할 때 특히 발목을 잡아. 실무에서 완전히 멀어지는 순수 관리직 승진이나, 조직도는 신경 끄라는 전문가 트랙처럼.' },
          { en: "Day to day, it can look like genuinely enjoying both the hands-on part of a project and the strategy meetings about it, but never quite feeling like you're 'the' expert or 'the' manager either one.", ko: "일상에서는 프로젝트의 실무 부분도, 그에 관한 전략 회의도 진심으로 즐기는데, 정작 어느 쪽에서도 그 분야 전문가나 그 팀 관리자로 확실히 자리매김하지 못하는 식으로 나타날 수 있어." }
        ],
        none: [
          { en: 'With no clear direction pulling you, your energy can end up scattered across too many possibilities at once — someone with a locked-in direction spends that same energy going deeper in one place instead of wider across several.', ko: '아직 방향이 뚜렷하지 않아서, 여러 가능성 사이에서 에너지가 분산되기 쉬워. 방향이 확실한 사람이라면 그 에너지를 한 곳을 더 깊게 파는 데 썼을 텐데.' },
          { en: "This tends to bite hardest when you're asked a direct question you genuinely don't have a crisp answer to yet — 'where do you see yourself in five years' in an interview, or a mentor asking what you actually want.", ko: "이런 성향은 아직 명확한 답이 없는 직설적인 질문을 받을 때 특히 발목을 잡아. 면접에서 5년 후 어떤 모습이고 싶으냐는 질문이나, 멘토가 진짜 원하는 게 뭐냐고 물을 때처럼." },
          { en: 'Day to day, it can look like starting three different side projects in as many months and not finishing any of them, or feeling a little envious of a friend who seems to have known their path since college.', ko: '일상에서는 몇 달 사이 사이드 프로젝트를 세 개나 벌였는데 하나도 제대로 끝내지 못하거나, 대학 때부터 길을 확실히 알았던 것 같은 친구를 보면서 살짝 부러움을 느끼는 식으로 나타날 수 있어.' }
        ]
      };
      var point = POINT_TEXT[mode].slice();

      var BOOST_TEXT = {
        jeonggwan: [
          { en: "Keeping a visible record of your results makes it easy for the system to recognize and reward you properly — someone in a more chaotic role might get noticed just by handling the next fire, but structured systems reward what's written down, not just what happened.", ko: '눈에 보이는 성과나 이력을 꾸준히 기록해두면, 평가받을 때 확실히 유리해. 좀 더 정신없는 역할이라면 그냥 다음 급한 일 처리하는 걸로도 눈에 띄겠지만, 체계적인 조직은 실제 일어난 일이 아니라 기록된 걸 보상하거든.' },
          { en: 'This works especially well through formal channels the system already respects — a written self-review, a documented project outcome, a performance log — more than informal mentions in passing conversation.', ko: '이 방법은 조직이 이미 인정하는 공식적인 채널을 통해 특히 잘 통해. 자기평가서, 문서화된 프로젝트 결과, 성과 기록처럼. 지나가는 대화에서 슬쩍 언급하는 것보다.' },
          { en: 'In practice, that can mean keeping a running document of wins as they happen instead of trying to reconstruct them at review time, or asking a manager directly what metric actually gets you promoted.', ko: '실제로는 평가 시즌에 몰아서 기억을 짜내기보다, 성과가 생길 때마다 바로 문서에 기록해두거나, 승진에 실제로 영향을 주는 지표가 뭔지 상사한테 직접 물어보는 식으로 하면 돼.' }
        ],
        pyeongwan: [
          { en: 'Volunteering for the hard, high-pressure project — instead of avoiding it — is where your real opportunities show up, in a way that someone thriving on routine would find genuinely draining.', ko: '어려운 프로젝트를 피하기보다 자원해서 맡아보면, 오히려 기회가 커져. 루틴에 강한 사람이라면 똑같은 프로젝트를 진짜 힘들어했을 수도 있지만, 너한텐 그게 기회야.' },
          { en: "This works especially well in situations everyone else is quietly avoiding — the project nobody wants, the account that's on fire, the deadline that got moved up — since that's exactly where your calm-under-pressure stands out most.", ko: '이 방법은 다들 은근히 피하는 상황에서 특히 잘 통해. 아무도 안 맡으려는 프로젝트, 불붙은 고객사, 갑자기 당겨진 마감처럼. 바로 그런 자리에서 압박에 강한 네 모습이 가장 도드라지거든.' },
          { en: 'In practice, that can mean actually raising your hand when a manager asks who can take on an urgent, messy problem, instead of waiting to be assigned it by default.', ko: '실제로는 상사가 급하고 골치 아픈 문제를 누가 맡을 수 있냐고 물을 때, 어쩌다 떠맡길 기다리기보다 먼저 손을 드는 식으로 하면 돼.' }
        ],
        siksin: [
          { en: 'Making a small habit of showing your work — a portfolio, a write-up, anything visible — keeps you from being underrated, in a way that comes naturally to a louder colleague but has to be built on purpose for you.', ko: '쌓아온 실력을 보여주는 걸 조금만 더 신경 쓰면, 저평가되는 걸 막을 수 있어. 목소리 큰 동료한테는 자연스러운 일이지만, 너는 일부러 만들어야 하는 습관이야.' },
          { en: 'This works especially well through low-key, low-pressure formats — a short written recap after a project wraps, a portfolio you update quietly over time — more than anything that feels like active self-promotion.', ko: '이 방법은 거창하지 않은, 부담 적은 형식에서 특히 잘 통해. 프로젝트 끝나고 짧게 정리해두는 회고나 조금씩 꾸준히 업데이트하는 포트폴리오처럼. 대놓고 자기 홍보하는 느낌이 드는 것보다.' },
          { en: 'In practice, that can be as simple as sending a two-line summary email after finishing something meaningful, or keeping a simple running list of what you shipped this quarter to pull from later.', ko: '실제로는 의미 있는 일을 끝냈을 때 두 줄짜리 요약 메일을 보내보거나, 이번 분기에 마친 일들을 간단히 목록으로 계속 적어두고 나중에 꺼내 쓰는 식으로 하면 돼.' }
        ],
        sanggwan: [
          { en: 'Actively seeking out spaces built for standing out — presentations, portfolios, public work — plays directly to your strength, in a way a quieter role built around blending in never would.', ko: '튀는 능력을 인정받는 자리를 적극적으로 찾아가면 유리해. 눈에 안 띄고 묻어가는 게 미덕인 조용한 자리라면 절대 살아나지 못했을 강점이야.' },
          { en: 'This works especially well in venues that reward a distinct point of view on purpose — a conference talk, a portfolio review, a pitch — more than a role that mostly asks you to execute someone else\'s plan quietly.', ko: '이 방법은 개성 있는 관점 자체를 의도적으로 보상하는 자리에서 특히 잘 통해. 컨퍼런스 발표, 포트폴리오 리뷰, 피칭처럼. 남의 계획을 조용히 실행만 하는 역할보다.' },
          { en: 'In practice, that can mean pitching to give the talk instead of waiting to be asked, or deliberately choosing the project that lets your particular style show rather than the safer, more interchangeable one.', ko: '실제로는 발표 요청을 기다리기보다 먼저 제안해보거나, 무난하고 대체 가능한 프로젝트보다 네 스타일이 드러날 수 있는 프로젝트를 일부러 골라보는 식으로 하면 돼.' }
        ],
        hybrid: [
          { en: 'Picking one lane to commit to for a stretch of time, instead of splitting focus, is what turns your range into real depth — something a pure specialist never has to actively decide, since they only had the one lane to begin with.', ko: '한동안은 한쪽에 확실히 힘을 실어보면, 넓게 걸쳐 있던 역량이 진짜 깊이로 바뀌어. 순수 전문가 타입은 애초에 선택지가 하나뿐이라 이런 결정을 따로 할 필요도 없었겠지만, 너는 일부러 정해야 해.' },
          { en: 'This works especially well as a time-boxed experiment — six months leaning fully into the craft side, then six months leaning into the structural side — rather than trying to split every single day evenly between the two.', ko: '이 방법은 기간을 정해서 실험하듯 해보면 특히 잘 통해. 6개월은 실무 쪽에, 다음 6개월은 체계 쪽에 확실히 힘을 싣는 식으로. 매일매일 둘을 똑같이 나누려고 애쓰는 것보다.' },
          { en: 'In practice, that can mean explicitly telling a manager you want to focus deeper on the technical side for the next two quarters, or turning down a lateral move that would just add more breadth you do not currently need.', ko: '실제로는 다음 두 분기는 기술적인 쪽에 더 깊이 집중하고 싶다고 상사한테 명확히 말해보거나, 지금 딱히 필요 없는 폭만 더해주는 수평 이동 제안을 거절해보는 식으로 하면 돼.' }
        ],
        none: [
          { en: 'Trying a few genuinely different work settings is the fastest way to narrow down what actually fits — a path someone with a locked-in direction never has to take, since they already know where they are headed.', ko: '이것저것 다른 형태의 일을 시도해보면서, 나한테 맞는 방향을 좁혀가는 게 빨라. 방향이 이미 확실한 사람은 이미 어디로 가는지 알기 때문에 이런 과정을 거칠 필요가 없겠지만.' },
          { en: 'This works especially well through low-commitment experiments — a short contract, a side project, a few informational interviews — more than jumping straight into a long-term commitment based on a guess.', ko: '이 방법은 부담 적은 실험을 통해 특히 잘 통해. 짧은 계약직, 사이드 프로젝트, 몇 번의 정보성 인터뷰처럼. 추측만으로 바로 장기적인 결정에 뛰어드는 것보다.' },
          { en: 'In practice, that can mean taking a short-term project in a field you are only mildly curious about just to actually test it, or scheduling a coffee chat with someone doing work that sounds interesting instead of just wondering about it from a distance.', ko: '실제로는 그냥 살짝 궁금한 분야의 단기 프로젝트를 실제로 한번 해보거나, 멀리서 궁금해하기만 하는 대신 흥미로워 보이는 일을 하는 사람과 커피챗 일정을 잡아보는 식으로 하면 돼.' }
        ]
      };
      var boost = BOOST_TEXT[mode].slice();

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Boost Your Career', '직업운 올리는법', boost);
    },

    business: function (ctx) {
      var pyeonjae = ctx.godCount['편재'] || 0, sanggwan = ctx.godCount['상관'] || 0;

      var overview = [];
      var mode;
      if (pyeonjae >= 1 && sanggwan >= 1) {
        mode = 'both';
        overview.push({ en: "Some founders catch opportunities well but execute in a fairly conventional way; others have a distinct point of view but a weaker sense for money. You've got the classic founder combination of both — a sharp eye for opportunity plus a willingness to do it differently than everyone else.", ko: '어떤 창업가는 기회는 잘 잡는데 실행은 비교적 정석대로야. 어떤 창업가는 관점은 독특한데 돈 감각이 약해. 너는 둘 다 가진 전형적인 사업가 조합이야. 기회를 잡는 감각과 남과 다르게 하는 방식이 같이 있어.' });
        overview.push({ en: 'This tends to suit founding something from scratch well — an original product, a brand with a real point of view — better than joining an existing venture where the direction is already fixed by someone else.', ko: '이런 성향은 원래 있던 방향이 다른 사람에 의해 이미 정해진 기존 사업에 합류하기보다, 처음부터 뭔가를 만드는 것, 독창적인 제품이나 확실한 관점이 있는 브랜드를 세우는 것과 잘 맞아.' });
        overview.push({ en: "Day to day, it can look like spotting a gap in the market before most people notice it, then building something to fill it that looks nothing like what a 'normal' player in that space would have made.", ko: "일상에서는 남들보다 먼저 시장의 빈틈을 알아채고, 그 분야의 '평범한' 플레이어라면 절대 안 만들었을 방식으로 그 틈을 채우는 뭔가를 만들어내는 식으로 나타날 수 있어." });
      } else if (pyeonjae >= 1) {
        mode = 'pyeonjae';
        overview.push({ en: 'Some founders combine a sharp eye for opportunity with a genuinely unconventional way of executing it. You spot opportunities well, but tend to execute them in a fairly conventional way — a steady venture or a solid partnership suits you better than reinventing the wheel.', ko: '어떤 창업가는 기회를 잡는 감각과 남다른 실행 방식을 둘 다 가지고 있어. 너는 기회는 잘 알아보는 편인데, 실행 방식은 비교적 정석대로야. 혼자 파격적으로 벌이기보다 안정적인 모델이나 동업이 잘 맞아.' });
        overview.push({ en: "This tends to suit franchising, licensing, or partnering with someone who already has the operational playbook — better than a venture that requires inventing an entirely new business model from scratch.", ko: '이런 성향은 프랜차이즈, 라이센스, 또는 이미 운영 노하우가 있는 사람과의 동업과 잘 맞아. 완전히 새로운 사업 모델을 처음부터 발명해야 하는 벤처보다.' });
        overview.push({ en: 'Day to day, it can look like recognizing a genuinely good deal the moment it crosses your desk, but preferring to run it through a proven format rather than inventing a new one on the spot.', ko: '일상에서는 진짜 괜찮은 거래가 눈앞에 왔을 때 바로 알아채면서도, 그걸 현장에서 새로 발명하기보다 이미 검증된 방식으로 운영하는 걸 더 선호하는 식으로 나타날 수 있어.' });
      } else if (sanggwan >= 1) {
        mode = 'sanggwan';
        overview.push({ en: "Some founders read the money side of a venture as naturally as they generate ideas. Ideas and a distinct point of view aren't the problem for you — reading the money side of a venture is where you'll want backup.", ko: '어떤 창업가는 아이디어를 내는 것만큼 돈 흐름도 자연스럽게 읽어. 너는 아이디어와 개성이 문제가 아니야. 돈 흐름을 읽는 감각은 보완이 필요해.' });
        overview.push({ en: 'This tends to suit pairing with a co-founder or partner who handles the financial and operational side well — freeing you to focus fully on the product, the brand, or the creative direction, which is where you actually add the most value.', ko: '이런 성향은 재무와 운영을 잘 다루는 공동창업자나 파트너와 짝을 이루는 것과 잘 맞아. 그러면 너는 실제로 가장 가치를 더할 수 있는 제품, 브랜드, 창의적인 방향에 온전히 집중할 수 있어.' });
        overview.push({ en: "Day to day, it can look like having a genuinely great product idea fully worked out in your head while the pricing spreadsheet sits untouched for weeks, or a co-founder handling a contract negotiation you'd honestly rather not deal with.", ko: '일상에서는 제품 아이디어는 머릿속에 완벽하게 정리돼 있는데 가격 책정 엑셀은 몇 주째 손도 안 대고 있거나, 솔직히 별로 다루고 싶지 않은 계약 협상을 공동창업자가 대신 처리해주는 식으로 나타날 수 있어.' });
      } else {
        mode = 'none';
        overview.push({ en: "Some people are wired to build something of their own from the ground up. Running your own venture isn't where your energy naturally goes — you tend to do better operating inside someone else's structure, contributing real strength without carrying the full weight of ownership.", ko: '어떤 사람은 처음부터 뭔가 자기 걸 세우도록 타고났어. 너는 스스로 사업을 벌이는 쪽보다는, 이미 있는 조직 안에서 움직일 때 더 잘 맞는 편이야. 소유의 무게를 온전히 지지 않아도, 실제로 진짜 힘을 발휘할 수 있어.' });
        overview.push({ en: "This tends to suit a strong role within an established company — a senior operator, a key hire, a trusted right hand — better than being the one whose name is on the loan.", ko: '이런 성향은 대출에 이름을 올리는 사람이 되기보다, 이미 자리 잡은 회사 안에서 시니어 운영자나 핵심 인재, 신뢰받는 오른팔 같은 확실한 역할과 잘 맞아.' });
        overview.push({ en: "In everyday terms, it can look like genuinely enjoying the moment a project succeeds without needing your name on the company itself, or feeling relief rather than envy when a friend's risky startup finally struggles.", ko: '일상에서는 프로젝트가 성공하는 순간을 진심으로 즐기면서도 회사 자체에 내 이름이 걸려있길 바라진 않거나, 친구의 위험한 스타트업이 결국 힘들어질 때 부러움보다 오히려 안도감을 느끼는 식으로 나타날 수 있어.' });
      }
      if (ctx.strengthInfo.verdict === '신강') {
        overview.push({ en: "On top of that, you've got enough drive to push a venture forward under your own name, solo if it comes to that — where someone with less foundation underneath them would genuinely need a partner just to keep the thing standing.", ko: '여기에 더해서, 혼자서도 내 이름을 걸고 밀어붙일 힘이 있는 편이야. 기반이 덜 탄탄한 사람이라면 그냥 버티기 위해서라도 파트너가 진짜 필요했을 텐데.' });
        overview.push({ en: 'This tends to suit taking full ownership of a decision — being the final call on a pivot, a hire, a big spend — better than a structure where every major move needs consensus first.', ko: '이런 성향은 방향 전환이나 채용, 큰 지출 같은 결정에서 최종 결정권을 온전히 가지는 것과 잘 맞아. 모든 중요한 결정에 매번 합의가 필요한 구조보다.' });
        overview.push({ en: 'In practice, that can look like making a hard call on a Friday and just moving forward with it, rather than needing to run it by a room full of people first.', ko: '실제로는 금요일에 어려운 결정을 내리고 그냥 밀고 나가는 식으로 나타날 수 있어. 여러 사람한테 먼저 물어봐야 안심이 되는 것보다.' });
      } else if (ctx.strengthInfo.verdict === '신약') {
        overview.push({ en: 'On top of that, a venture goes more smoothly with a partner or backer absorbing some of the load with you — where someone with more foundation underneath them could genuinely carry it solo without it costing them much.', ko: '여기에 더해서, 혼자보다는 동업자나 투자자와 함께 부담을 나눌 때 리스크가 줄어드는 편이야. 기반이 더 탄탄한 사람이라면 혼자 짊어져도 크게 부담이 안 됐을 텐데.' });
        overview.push({ en: "This tends to suit co-founding or bringing in outside investment early — better than bootstrapping entirely alone with no one else's name or money on the line beside yours.", ko: '이런 성향은 초반부터 공동창업을 하거나 외부 투자를 받는 것과 잘 맞아. 네 이름과 돈만 걸고 혼자 완전히 자력으로 시작하는 것보다.' });
        overview.push({ en: 'In practice, that can look like a rough month feeling genuinely survivable because a co-founder is splitting the stress with you, rather than a single bad month threatening to end the whole thing.', ko: '실제로는 힘든 달이 와도 공동창업자와 스트레스를 나누고 있어서 진짜로 버틸 만하게 느껴지는 식으로 나타날 수 있어. 나쁜 한 달이 전체를 무너뜨릴 위협이 되기보다.' });
      }

      var POINT_TEXT = {
        both: [
          { en: 'Big ideas and fast execution are your strength, but the unglamorous parts, like paperwork and contracts, are what quietly slip through the cracks — a more conventional operator would never let those slide, but for you they are genuinely easy to deprioritize.', ko: '아이디어와 실행력은 있는데, 세부 관리(회계, 계약 등)는 소홀해지기 쉬워. 좀 더 정석적인 운영자라면 절대 놓치지 않았을 부분이지만, 너한테는 진짜로 뒷전으로 밀리기 쉬운 부분이야.' },
          { en: 'This tends to bite hardest as the business actually grows — the contract that seemed fine to skim, the tax filing that got pushed back a quarter — problems that stay invisible right up until they suddenly are not.', ko: '이런 성향은 사업이 실제로 커질수록 특히 발목을 잡아. 대충 훑고 넘긴 계약서, 한 분기 미뤄둔 세금 신고처럼, 갑자기 터지기 전까지는 안 보이는 문제들.' },
          { en: 'In everyday terms, it can look like realizing months later that a vendor contract had a clause you never actually read, or a filing deadline passing entirely unnoticed while you were focused on the next big idea.', ko: '일상에서는 몇 달 뒤에야 거래처 계약서에 제대로 안 읽은 조항이 있었다는 걸 깨닫거나, 다음 큰 아이디어에 집중하는 사이 신고 마감일이 아예 모르는 새 지나가버리는 식으로 나타날 수 있어.' }
        ],
        pyeonjae: [
          { en: 'You catch the opportunity, but without something that makes you distinct, you can get lost in the crowd of others chasing the same thing — someone with a sharper, more unconventional angle would stand out even in the exact same market.', ko: '기회는 잘 잡는데, 남과 다르게 승부하는 힘은 약해서 경쟁에서 묻힐 수 있어. 좀 더 독특하고 날카로운 관점을 가진 사람이라면 똑같은 시장에서도 눈에 띄었을 텐데.' },
          { en: 'This tends to bite hardest in crowded, trendy markets — the ones everyone spots the opportunity in at the same time — where being merely competent is not quite enough to pull ahead.', ko: '이런 성향은 붐비고 유행하는 시장, 즉 다들 동시에 같은 기회를 알아채는 시장에서 특히 발목을 잡아. 단순히 잘하는 정도로는 앞서 나가기 부족한 곳.' },
          { en: 'Day to day, it can look like launching a genuinely solid product into a space that already has five competitors doing roughly the same thing, none of which you particularly stand out from.', ko: '일상에서는 꽤 괜찮은 제품을 내놓았는데 이미 비슷한 걸 하는 경쟁자가 다섯 개나 있고, 그중에서 딱히 두드러지지 않는 식으로 나타날 수 있어.' }
        ],
        sanggwan: [
          { en: 'The idea can be genuinely great and still fail to become a business, because the structure that turns it into income is missing — someone with a sharper money sense would have that structure built in from day one.', ko: '튀는 아이디어는 있는데, 돈이 실제로 들어오는 구조를 짜는 감각은 약할 수 있어. 돈 감각이 더 좋은 사람이라면 처음부터 그 구조를 같이 짜뒀을 텐데.' },
          { en: "This tends to bite hardest at the exact point where an idea needs to become a price, a contract, or a revenue model — the part that turns 'this is cool' into 'this pays the bills.'", ko: "이런 성향은 아이디어가 가격, 계약, 수익 모델로 구체화돼야 하는 바로 그 지점에서 특히 발목을 잡아. '이거 멋있다'가 '이걸로 먹고산다'로 바뀌어야 하는 지점." },
          { en: 'Day to day, it can look like a product people genuinely love getting priced almost randomly because there was never a real plan for it, or realizing months in that no one actually worked out how the thing makes money.', ko: '일상에서는 사람들이 진짜 좋아하는 제품인데 제대로 된 계획 없이 가격을 거의 대충 매기거나, 몇 달이 지나서야 이게 어떻게 돈이 되는지 아무도 제대로 안 짜놨다는 걸 깨닫는 식으로 나타날 수 있어.' }
        ],
        none: [
          { en: 'You are wired for stability, so the built-in risk of running your own thing can weigh on you more than it does other people — someone wired for opportunistic risk-taking would barely register the same uncertainty that keeps you up at night.', ko: '안정 지향이라, 사업 특유의 리스크를 감당하는 데 부담을 느낄 수 있어. 기회를 좇는 쪽에 강한 사람이라면 너를 밤새 뒤척이게 만드는 그 불확실성을 별로 신경도 안 썼을 텐데.' },
          { en: 'This tends to bite hardest in the early, unstable stretch of any venture — no guaranteed income, no clear timeline to profitability — the part that a more risk-tolerant type would treat as just part of the game.', ko: '이런 성향은 어떤 사업이든 초반의 불안정한 시기, 즉 보장된 수입도 없고 언제 수익이 날지 확실치도 않은 구간에서 특히 발목을 잡아. 리스크에 더 강한 사람이라면 그냥 원래 그런 거라고 넘겼을 부분.' },
          { en: "In everyday terms, it can look like losing real sleep over a 'what if this fails' scenario a more risk-tolerant friend would have shrugged off within a day.", ko: "일상에서는 리스크에 더 강한 친구라면 하루 만에 털어냈을 '이거 망하면 어떡하지' 같은 걱정으로 진짜 잠을 설치는 식으로 나타날 수 있어." }
        ]
      };
      var point = POINT_TEXT[mode].slice();

      var boost = [];
      if (ctx.strengthInfo.verdict === '신강') {
        boost.push({ en: 'Deliberately handing off a piece of the work, instead of holding all of it yourself, is what lets this actually scale — something someone leaning on a partner already does by default, but for you it takes a conscious decision to let go.', ko: '혼자 다 하려 하지 말고, 일부는 맡기는 연습을 해두면 오래 갈 수 있어. 파트너에게 의지하는 사람이라면 이미 자연스럽게 하고 있을 일이지만, 너한테는 일부러 내려놓겠다는 결정이 필요해.' });
        boost.push({ en: "This tends to matter most as the business grows past the point where one person can genuinely hold every piece of it in their head — hiring, delegating a full function, trusting someone else's judgment on something that matters.", ko: '이건 사업이 한 사람 머릿속에 모든 걸 다 담을 수 없을 만큼 커진 시점에 특히 중요해져. 채용을 하거나, 한 영역을 통째로 맡기거나, 중요한 일에서 다른 사람의 판단을 믿어야 할 때.' });
        boost.push({ en: 'In practice, that can mean hiring for the first weak spot in the business instead of just working longer hours to cover it yourself, or genuinely stepping back and letting someone else make a call you would normally make.', ko: '실제로는 사업의 첫 번째 약점을 혼자 더 오래 일해서 메우기보다 그 자리에 사람을 채용하거나, 평소라면 네가 내렸을 결정을 다른 사람이 내리도록 진짜로 한 발 물러서보는 식으로 하면 돼.' });
      } else {
        boost.push({ en: 'Lining up a partner or backer before you need one — not after — is what keeps a rough patch from becoming a crisis, in a way that someone with more solo drive could probably skip without much cost.', ko: '동업자나 투자자를 필요해지기 전에 미리 찾아두면, 힘든 시기가 와도 리스크가 훨씬 줄어들어. 혼자서도 밀어붙일 힘이 더 강한 사람이라면 별 타격 없이 건너뛸 수 있는 단계일 수 있지만.' });
        boost.push({ en: 'This tends to matter most before a venture starts, not during a crisis — a partnership formed under pressure rarely has the trust a partnership formed calmly does.', ko: '이건 사업이 시작되기 전에 챙기는 게 가장 중요해. 위기 중에 급하게 맺어진 관계는, 차분할 때 맺어진 관계만큼 신뢰가 쌓이기 어렵거든.' });
        boost.push({ en: 'In practice, that can mean having the conversation about equity and roles with a potential co-founder well before you actually need them, or keeping a small buffer of backup capital lined up rather than assuming things will go smoothly.', ko: '실제로는 잠재적 공동창업자와 지분이나 역할에 대한 얘기를 실제로 필요해지기 한참 전에 미리 해두거나, 모든 게 순조로울 거라 가정하기보다 소액이라도 비상 자금을 미리 마련해두는 식으로 하면 돼.' });
      }

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Boost Your Business Luck', '사업운 올리는법', boost);
    },

    friends: function (ctx) {
      var total = ctx.categoryTally['비겁'] || 0;
      var bigyeon = ctx.godCount['비견'] || 0, geopjae = ctx.godCount['겁재'] || 0;

      var overview = [];
      var mode;
      if (total === 0) {
        mode = 'none';
        overview.push({ en: "Some people spread their social energy across a wide network, staying loosely in touch with many. Others put nearly all of it into a small handful of bonds. You're the second type — depth over width, a couple of deep relationships mattering more than a wide network.", ko: '어떤 사람은 사회적 에너지를 넓게 펼쳐서 여러 사람과 느슨하게 연결돼 있어. 어떤 사람은 그 에너지를 소수한테 거의 다 써. 너는 후자야. 관계의 폭보다 깊이를 챙기고, 소수와의 깊은 관계가 더 중요해.' });
        overview.push({ en: 'This tends to suit small, intimate settings — a close-knit hobby group of three or four, one-on-one hangouts — better than large networking events built around meeting as many people as possible.', ko: '이런 성향은 서너 명의 끈끈한 소모임이나 일대일 만남처럼 소규모의 친밀한 자리와 잘 맞아. 최대한 많은 사람을 만나는 게 목적인 대규모 네트워킹 자리보다.' });
        overview.push({ en: "In everyday terms, it can look like having exactly two or three people you'd call at 2am, and being completely fine not knowing the names of most people in your building.", ko: '일상에서는 새벽 2시에 전화할 수 있는 사람이 딱 두세 명 있고, 같은 건물 사는 사람들 이름을 대부분 몰라도 전혀 상관없는 식으로 나타날 수 있어.' });
      } else if (total <= 2) {
        mode = 'small';
        overview.push({ en: "Some people's circle is razor-thin, just one or two people total; others' circle is sprawling, dozens deep. Yours sits in a reasonable, balanced middle — not so small that you're isolated, not so wide that it's hard to keep track of.", ko: '어떤 사람은 인간관계가 한두 명으로 아주 얇고, 어떤 사람은 수십 명으로 넓게 퍼져 있어. 너는 그 중간에서 적당히 균형 잡힌 편이야. 고립될 만큼 좁지도, 다 챙기기 힘들 만큼 넓지도 않아.' });
        overview.push({ en: 'This tends to suit a mid-sized, mixed social life well — a few different small groups (one from work, one from an old hobby) rather than either a single tight duo or one giant sprawling network.', ko: '이런 성향은 직장 쪽 소모임 하나, 오래된 취미 쪽 소모임 하나처럼 몇 개의 작은 그룹이 섞인 중간 규모 사회생활과 잘 맞아. 단둘뿐인 관계나 하나의 거대한 네트워크보다.' });
        overview.push({ en: 'In everyday terms, it can look like having a different small group of people for different moods — one for venting, one for going out — without either group feeling like your entire social world.', ko: '일상에서는 하소연할 때 찾는 그룹, 놀러 나갈 때 찾는 그룹이 각각 따로 있는데, 그중 어느 하나도 네 사회생활 전부는 아닌 식으로 나타날 수 있어.' });
      } else {
        overview.push({ en: 'Some people know a small, tightly-held handful of others; you know a lot of people and a lot of people know you — your circle is genuinely wide, built up over years of staying in touch.', ko: '어떤 사람은 소수만 꽉 붙들고 지내. 너는 아는 사람도 많고 너를 아는 사람도 많아. 오랜 세월 연락을 유지하며 쌓아온, 진짜 발이 넓은 편이야.' });
        overview.push({ en: 'This tends to suit roles and settings that reward staying connected to many people — organizing group events, being the one who keeps a big friend group actually in touch — better than a life built around one or two exclusive bonds.', ko: '이런 성향은 단체 모임을 주선하거나 큰 친구 무리가 실제로 계속 연락하게 만드는 역할처럼, 많은 사람과 연결되는 걸 보상받는 자리와 잘 맞아. 한두 명의 독점적인 관계 위주로 짜인 삶보다.' });
        overview.push({ en: 'In everyday terms, it can look like being the person a group chat cannot function without, or running into someone you know almost anywhere you go in your city.', ko: '일상에서는 네가 없으면 단톡방이 잘 안 굴러가거나, 동네 어디를 가도 아는 사람을 마주치는 식으로 나타날 수 있어.' });
        if (bigyeon >= geopjae) {
          mode = 'wide_bigyeon';
          overview.push({ en: "Within that wide circle, some people's connections are mostly transactional or competitive underneath. Most of yours are the real thing — peer-level relationships you can actually count on, not just a wide list of names.", ko: '그 넓은 인맥 안에서도, 어떤 사람은 관계 대부분이 속으로는 이해관계나 경쟁 위주야. 너는 대부분이 진짜야. 그냥 이름만 아는 목록이 아니라 실제로 믿을 수 있는, 대등한 관계들.' });
          overview.push({ en: 'This tends to suit roles built on trust at scale — being the reliable node people actually lean on in a crisis, not just the person everyone has in their contacts.', ko: '이런 성향은 규모가 커도 신뢰가 바탕이 되는 역할과 잘 맞아. 그냥 연락처에 저장된 사람이 아니라, 위기 때 사람들이 실제로 기대는 사람.' });
          overview.push({ en: 'Day to day, it can look like a dozen different people genuinely showing up when you move apartments, not just liking a post about it.', ko: "일상에서는 이사할 때 게시물에 '좋아요'만 누르는 게 아니라 십여 명이 진짜로 도와주러 오는 식으로 나타날 수 있어." });
        } else {
          mode = 'wide_geopjae';
          overview.push({ en: "Within that wide circle, some people's relationships stay clean of self-interest. Some of your width comes with strings attached, though — competition or mixed interests threaded through a portion of that network.", ko: '그 넓은 인맥 안에서도, 어떤 사람은 관계에 이해관계가 전혀 안 섞여. 너는 그 폭만큼 이해관계나 경쟁이 얽힌 관계도 일부 섞여 있을 수 있어.' });
          overview.push({ en: "This tends to make roles that require picking sides or dividing loyalty — a shared business venture with mutual friends, a group where two people are quietly competing for the same thing — genuinely harder to navigate than they'd be for someone with a cleaner network.", ko: '이런 성향은 편을 갈라야 하거나 충성심이 나뉘는 역할, 예를 들면 지인들과 얽힌 공동 사업이나 두 사람이 같은 걸 은근히 두고 경쟁하는 모임 같은 데서 유독 다루기 어려워져. 더 깨끗한 인맥을 가진 사람보다.' });
          overview.push({ en: "In everyday terms, it can look like realizing a 'friend' only really calls when they need something, or feeling a flicker of relief rather than sadness when a particular acquaintance quietly drifts away.", ko: "일상에서는 어떤 '친구'가 필요할 때만 연락한다는 걸 깨닫거나, 특정 지인이 조용히 멀어질 때 서운함보다 오히려 살짝 후련함을 느끼는 식으로 나타날 수 있어." });
        }
      }

      var POINT_TEXT = {
        none: [
          { en: 'Being comfortable alone means asking for help when you actually need it does not come naturally — someone with a wider circle would have five people to call without a second thought, while you might not call anyone at all.', ko: '혼자가 편한 만큼, 정작 힘들 때 도움을 청하는 게 서툴 수 있어. 인맥 넓은 사람이라면 고민 없이 다섯 명한테 전화했을 텐데, 너는 아예 아무한테도 안 할 수도 있어.' },
          { en: 'This tends to bite hardest during an actual emergency or a hard stretch — moving, a sudden setback, a layoff — the exact moments a wider circle would absorb some of the load without you having to ask twice.', ko: '이런 성향은 이사, 건강 문제, 실직처럼 진짜 힘든 시기에 특히 발목을 잡아. 인맥이 넓다면 굳이 두 번 부탁 안 해도 부담을 나눠줬을 순간들이야.' },
          { en: 'It can show up as struggling through a move entirely by yourself that a phone call could have fixed in an hour, or sitting with a hard problem alone for weeks because reaching out never occurred to you.', ko: '일상에서는 전화 한 통이면 한 시간 만에 해결됐을 이사를 혼자 낑낑대며 끝내거나, 연락할 생각 자체를 못 해서 힘든 문제를 몇 주씩 혼자 끌어안고 있는 식으로 나타날 수 있어.' }
        ],
        small: [
          { en: 'You are good to the people already close to you, but reaching out to widen that circle takes real, deliberate effort — someone with a wider network would meet a new connection through someone they already know, without having to try.', ko: '가까운 사람들한테는 잘하는데, 관계를 더 넓히는 데는 소극적일 수 있어. 인맥 넓은 사람이라면 애쓰지 않아도 아는 사람을 통해 새 인연을 만났을 텐데.' },
          { en: 'This tends to bite hardest when your small circle goes through a shared change at once — a move, a breakup, a falling out — leaving you with less of a buffer than someone who could just lean on a different part of a wider network.', ko: '이런 성향은 소수의 그룹 전체가 한 번에 흔들릴 때, 이사·이별·다툼 같은 일이 겹칠 때 특히 발목을 잡아. 넓은 인맥이라면 다른 쪽에 기댈 수 있었을 텐데 너는 완충 지대가 적어.' },
          { en: "It can look like your two closest friends both moving away in the same year and your social life genuinely shrinking as a result, or hesitating to join a new group activity because you already have 'enough' people.", ko: "일상에서는 가장 친한 친구 둘이 같은 해에 이사를 가버려서 사회생활이 실제로 줄어들거나, 이미 '충분하다'는 생각에 새로운 모임 참여를 망설이는 식으로 나타날 수 있어." }
        ],
        wide_bigyeon: [
          { en: 'With people around you this often, carving out real alone time can quietly fall to the bottom of the list — someone with a smaller circle rarely has to defend their solo time from anyone at all.', ko: '사람은 많은데, 가끔은 혼자만의 시간을 못 챙겨서 지칠 수 있어. 인맥이 좁은 사람이라면 애초에 혼자만의 시간을 누구한테서 지킬 필요조차 없었을 텐데.' },
          { en: 'This tends to bite hardest during an already busy stretch, when three different friend groups all want time with you in the same week and saying no to any of them feels genuinely bad.', ko: '이런 성향은 이미 바쁜 시기에 특히 발목을 잡아. 세 개의 다른 친구 무리가 같은 주에 시간을 원하면, 누구 하나 거절하는 것도 진짜 미안해져.' },
          { en: 'It can show up as realizing you have not had a single evening alone in three weeks, or feeling drained after a weekend that was, on paper, entirely fun.', ko: '일상에서는 3주 동안 혼자 보낸 저녁이 단 하루도 없었다는 걸 깨닫거나, 겉으로는 완전히 즐거웠던 주말인데도 지쳐 있는 식으로 나타날 수 있어.' }
        ],
        wide_geopjae: [
          { en: 'A wide circle makes it hard to cut off a relationship that is genuinely costing you, even once you can see it clearly — someone with a smaller, cleaner circle would have already quietly let it go.', ko: '발이 넓은 만큼 이해관계 얽힌 관계도 섞여서, 손해 보는 관계를 못 끊어낼 때가 있어. 관계가 적고 깨끗한 사람이라면 진작에 조용히 정리했을 텐데.' },
          { en: 'This tends to bite hardest with a long-standing acquaintance who keeps asking for money, favors, or time without ever quite reciprocating, where cutting them off would ripple through the rest of the group.', ko: '이런 성향은 돈이나 부탁, 시간을 자꾸 요구하면서 정작 되돌려주지 않는 오래된 지인한테서 특히 발목을 잡아. 그 사람을 끊어내면 나머지 무리에도 파장이 생기니까.' },
          { en: 'It can look like lending money to the same person a third time despite knowing better, or keeping someone in the group chat purely to avoid the awkwardness of removing them.', ko: '일상에서는 알면서도 같은 사람한테 세 번째로 돈을 빌려주거나, 빼는 게 어색해서 그냥 그 사람을 단톡방에 계속 두는 식으로 나타날 수 있어.' }
        ]
      };
      var point = POINT_TEXT[mode].slice();

      var BOOST_TEXT = {
        none: [
          { en: 'Reaching out first, even in a small way, tends to widen your circle more than waiting to be approached — someone with a wider network already gets approached often, but for you the first move has to come from you.', ko: '가끔은 먼저 연락해보는 작은 시도가 관계의 폭을 넓혀줘. 인맥 넓은 사람은 이미 먼저 다가오는 사람이 많지만, 너는 그 첫걸음을 스스로 떼야 해.' },
          { en: "This works especially well through a low-stakes, specific ask — inviting someone to a particular thing rather than a vague 'let's hang out sometime' — since specificity lowers the effort needed on both sides.", ko: "이건 막연한 '언제 한번 보자'보다 구체적이고 부담 적은 제안을 통해 특히 잘 통해. 구체적일수록 서로 부담이 줄어드니까." },
          { en: 'In practice, that can be as simple as texting one specific person about one specific plan this week, instead of waiting for a group invitation to land in your lap.', ko: '실제로는 이번 주에 특정한 사람한테 구체적인 약속 하나를 먼저 제안해보는 식으로 하면 돼. 단체 초대가 저절로 오길 기다리기보다.' }
        ],
        small: [
          { en: 'A little more frequent contact with the people you already trust makes those bonds noticeably stronger — someone with a wide network spreads contact thin across many people, but you get more return from investing in fewer relationships.', ko: '지금 관계에 조금만 더 자주 연락하는 정성을 더하면 훨씬 단단해져. 인맥 넓은 사람은 연락을 여러 명한테 얇게 나누지만, 너는 적은 사람한테 투자할 때 훨씬 크게 돌아와.' },
          { en: 'This works especially well as a small recurring habit — a standing monthly call, a regular check-in text — rather than a big one-time gesture that is hard to repeat.', ko: '이건 매달 정기적으로 연락하는 것 같은 작지만 반복되는 습관으로 특히 잘 통해. 반복하기 힘든 한 번의 큰 이벤트보다.' },
          { en: "In practice, that can mean setting a recurring reminder to check in with your two or three closest people, or actually following through on the 'let's do this again soon' instead of letting it fade.", ko: "실제로는 가까운 두세 명한테 정기적으로 연락하도록 알림을 맞춰두거나, '다음에 또 보자'는 말을 그냥 흘려보내지 않고 실제로 지키는 식으로 하면 돼." }
        ],
        wide_bigyeon: [
          { en: 'Deliberately blocking off unscheduled, alone time protects you from running on empty — something a smaller-circle person barely has to think about, since solitude finds them on its own.', ko: '약속 없는 혼자만의 시간을 의도적으로 비워두는 게 필요해. 인맥이 좁은 사람이라면 굳이 신경 안 써도 혼자 있는 시간이 저절로 생기지만, 너는 일부러 만들어야 해.' },
          { en: "This works especially well when it's blocked off in advance and genuinely protected — put on the calendar the same way a social commitment would be — rather than left as 'whenever nothing's scheduled.'", ko: "이건 사회적 약속처럼 캘린더에 미리 못 박아두고 진짜로 지킬 때 특히 잘 통해. '아무 일 없을 때'로 막연히 남겨두는 것보다." },
          { en: 'In practice, that can mean actually declining one invitation a week on purpose, or keeping one weeknight sacred as no-plans time no matter who asks.', ko: '실제로는 일주일에 초대 하나는 의도적으로 거절하거나, 누가 제안해도 평일 저녁 하루는 아무 약속 없는 날로 지켜두는 식으로 하면 돼.' }
        ],
        wide_geopjae: [
          { en: 'Practicing a polite, firm no on money-related favors protects both the relationship and your wallet — something a smaller, cleaner circle rarely tests you on in the first place.', ko: '돈 얽힌 부탁은 정중하게 선을 긋는 연습을 해두면, 관계도 지갑도 지킬 수 있어. 인맥이 좁고 깨끗한 사람이라면 애초에 이런 시험대에 자주 오르지 않았을 텐데.' },
          { en: "This works especially well with a prepared, generic line you can reuse — 'I've got a personal rule about not lending money' — rather than improvising a fresh excuse every time, which tends to invite negotiation.", ko: "이건 '개인적으로 돈은 안 빌려주는 원칙이 있어' 같은 미리 준비한 범용 멘트를 쓸 때 특히 잘 통해. 매번 즉석에서 핑계를 만드는 것보다. 즉석 핑계는 협상의 여지를 남기거든." },
          { en: "In practice, that can mean deciding your personal rule about lending money before you're actually asked, so you're not negotiating with yourself in the moment.", ko: '실제로는 실제로 부탁받기 전에 미리 돈 빌려주는 것에 대한 나만의 원칙을 정해두는 식으로 하면 돼. 그 순간에 스스로와 협상하지 않도록.' }
        ]
      };
      var boost = BOOST_TEXT[mode].slice();

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Boost Your Friendships', '친구운 올리는법', boost);
    },

    health: function (ctx) {
      // 2026-10-11 9차: 건강 리포트를 Daily Rhythm(생활 리듬)으로 바꿈. 몸 상태·증상·장기·음식 처방을 쓰지 않고,
      // 하루 속도와 일정 습관만 '참고용'으로 적는다(법무 88·인문 88 필수 조건).
      var RHYTHM_EXCESS = {
        '목': { en: 'With a lot of Wood in your chart, your days may fill up fast, one plan leading straight into the next.', ko: '원국에 목 기운이 많으면, 하루가 계획에서 계획으로 빠르게 채워질 수 있어.' },
        '화': { en: 'With a lot of Fire in your chart, you may run at full speed and forget to slow down.', ko: '원국에 화 기운이 많으면, 전속력으로 달리다 속도 줄이는 걸 잊기 쉬워.' },
        '토': { en: 'With a lot of Earth in your chart, you may settle into one task and stay put for a long time.', ko: '원국에 토 기운이 많으면, 한 가지 일에 자리 잡고 오래 머무르는 편일 수 있어.' },
        '금': { en: 'With a lot of Metal in your chart, you may hold your routines tightly and dislike changes to them.', ko: '원국에 금 기운이 많으면, 루틴을 단단히 지키고 바뀌는 걸 싫어하는 편일 수 있어.' },
        '수': { en: 'With a lot of Water in your chart, your evenings may stretch later than you planned.', ko: '원국에 수 기운이 많으면, 저녁 시간이 계획보다 길어지기 쉬워.' }
      };
      var RHYTHM_LACKING = {
        '목': { en: 'With little Wood in your chart, getting started may take a little longer than you expect.', ko: '원국에 목 기운이 적으면, 시작하는 데 생각보다 시간이 조금 더 걸릴 수 있어.' },
        '화': { en: 'With little Fire in your chart, you may warm up slowly in the morning.', ko: '원국에 화 기운이 적으면, 아침에 천천히 시동이 걸리는 편일 수 있어.' },
        '토': { en: "With little Earth in your chart, your routine may shift around with other people's plans.", ko: '원국에 토 기운이 적으면, 다른 사람 일정에 따라 루틴이 자주 바뀔 수 있어.' },
        '금': { en: 'With little Metal in your chart, routines may slide when life gets busy.', ko: '원국에 금 기운이 적으면, 바쁠 때 루틴이 쉽게 흐트러질 수 있어.' },
        '수': { en: 'With little Water in your chart, you may line up busy days back to back without a break.', ko: '원국에 수 기운이 적으면, 바쁜 날을 쉬는 날 없이 연달아 잡기 쉬워.' }
      };
      var IDEA_EXCESS = {
        '목': { en: 'Idea: put two or three short pauses into the day on purpose, the same way you schedule meetings.', ko: '아이디어: 회의를 잡듯이 하루에 짧은 쉼을 두세 번 일부러 넣어 봐.' },
        '화': { en: 'Idea: take five quiet minutes between back-to-back tasks before moving on.', ko: '아이디어: 연달아 있는 일 사이에 5분쯤 조용히 쉬고 넘어가 봐.' },
        '토': { en: 'Idea: stand up and take a short walk after meals as a simple reset.', ko: '아이디어: 식사 뒤에 일어나서 짧게 걷는 걸 간단한 쉼표로 삼아 봐.' },
        '금': { en: 'Idea: leave a little slack in your routine so one change does not throw off the whole day.', ko: '아이디어: 루틴에 여유를 조금 남겨 두면 한 가지가 바뀌어도 하루 전체가 흔들리지 않아.' },
        '수': { en: 'Idea: set a bedtime reminder the same way you set a wake-up alarm.', ko: '아이디어: 기상 알람처럼 잠자리 알람도 맞춰 봐.' }
      };
      var IDEA_LACKING = {
        '목': { en: 'Idea: lower the bar for starting. Five minutes counts.', ko: '아이디어: 시작의 기준을 낮춰 봐. 5분만 해도 시작한 거야.' },
        '화': { en: 'Idea: give the first hour of the day an easy start before the harder tasks.', ko: '아이디어: 어려운 일 전에 하루의 첫 한 시간을 가볍게 시작해 봐.' },
        '토': { en: 'Idea: anchor one or two fixed times in the day, such as breakfast or a short walk.', ko: '아이디어: 아침 식사나 짧은 산책처럼 하루에 고정된 시간을 한두 개 정해 봐.' },
        '금': { en: 'Idea: keep one small daily habit that stays the same on busy days too.', ko: '아이디어: 바쁜 날에도 그대로 지키는 작은 하루 습관 하나를 정해 봐.' },
        '수': { en: 'Idea: plan a lighter day after a demanding one.', ko: '아이디어: 힘든 날 다음에는 가벼운 날을 미리 잡아 둬.' }
      };

      var overview = [];
      overview.push({ en: 'This section looks at the pace and rhythm of your days: when you tend to speed up, slow down and settle into a routine. It is a for-fun note on daily habits, not medical advice.', ko: '이 칸은 하루의 속도와 리듬을 봐. 언제 빨라지고 느려지고 루틴에 자리 잡는지에 대한 재미용 생활 습관 메모이지, 의학적 조언이 아니야.' });
      if (!ctx.strengthInfo.lacking.length && !ctx.strengthInfo.excess.length) {
        overview.push({ en: 'Your five elements are spread fairly evenly, so no single rhythm stands out. A plain, regular routine is a natural fit.', ko: '오행이 고르게 퍼져 있어서 두드러지는 리듬이 없어. 평범하고 규칙적인 루틴이 자연스럽게 맞아.' });
      } else {
        overview.push({ en: 'Your elements are not evenly spread, so a few rhythm patterns may stand out. The notes below are ideas to try, not rules.', ko: '오행이 고르게 퍼져 있지 않아서 몇 가지 리듬 패턴이 눈에 띌 수 있어. 아래 내용은 해 볼 만한 아이디어지 규칙이 아니야.' });
      }

      var point = [];
      ctx.strengthInfo.excess.forEach(function (el) { if (RHYTHM_EXCESS[el]) point.push(RHYTHM_EXCESS[el]); });
      ctx.strengthInfo.lacking.forEach(function (el) { if (RHYTHM_LACKING[el]) point.push(RHYTHM_LACKING[el]); });
      if (!point.length) {
        point.push({ en: 'No single element piles up or runs thin, so your pace may stay fairly even from day to day.', ko: '유독 몰리거나 부족한 오행이 없어서 하루하루 속도가 비교적 고른 편일 수 있어.' });
      }

      var boost = [];
      ctx.strengthInfo.excess.forEach(function (el) { if (IDEA_EXCESS[el]) boost.push(IDEA_EXCESS[el]); });
      ctx.strengthInfo.lacking.forEach(function (el) { if (IDEA_LACKING[el]) boost.push(IDEA_LACKING[el]); });
      if (!boost.length) {
        boost.push({ en: 'Whatever routine you already have seems to suit you. Keeping it steady is enough.', ko: '지금 있는 루틴이 잘 맞는 편이야. 꾸준히 이어 가는 것만으로 충분해.' });
      }
      boost.push({ en: 'This is a daily-habits note, not medical advice. If anything worries you, talk to a doctor or health professional about your health.', ko: '이 내용은 생활 습관 참고용이지 의학적 조언이 아니에요. 걱정되는 점이 있으면 의사와 상담하세요.' });

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Daily Habit Tips', '생활 습관 팁', boost);
    },

    life: function (ctx) {
      var verdict = VERDICT_CASUAL[ctx.strengthInfo.verdict];
      var elEn = ELEMENT_EN[ctx.strengthInfo.dayElement], elKo = ELEMENT_KO[ctx.strengthInfo.dayElement];

      var overview = [{
        en: 'Your base note is ' + elEn + '. ' + verdict.en,
        ko: '타고난 바탕 기운은 ' + elKo + '. ' + verdict.ko
      }];
      var maxCat = null, maxN = -1;
      ['비겁', '식상', '재성', '관성', '인성'].forEach(function (cat) {
        if (ctx.categoryTally[cat] > maxN) { maxN = ctx.categoryTally[cat]; maxCat = cat; }
      });
      var CATEGORY_STRENGTH_EXPAND = {
        '비겁': [
          { en: "Some people's defining strength across life is thriving specifically inside a team, drawing energy from the group. Yours runs the other way — you move at your own pace and don't love sharing the spotlight, and results tend to come faster when you're moving alone.", ko: '어떤 사람은 인생 전반에서 팀 안에서 특히 빛나고, 그룹에서 에너지를 얻는 게 강점이야. 너는 반대야. 남 눈치 안 보고 제 페이스대로 사는 스타일이고, 혼자 치고 나갈 때 결과가 더 좋아.' },
          { en: 'This tends to suit work and pursuits that let you own something start to finish on your own terms — a solo project, an independent role — better than a setting built entirely around group consensus.', ko: '이런 성향은 뭔가를 처음부터 끝까지 내 방식대로 책임지는 일이나 독립적인 역할과 잘 맞아. 전부 다 같이 합의해야 하는 자리보다.' },
          { en: 'In everyday terms, it can look like naturally taking over a group project rather than waiting for a role assignment, or genuinely preferring to figure something out alone before asking anyone for input.', ko: '일상에서는 역할 배정을 기다리기보다 자연스럽게 팀 프로젝트를 주도하거나, 누구한테 물어보기 전에 혼자 먼저 답을 찾아보려는 식으로 나타날 수 있어.' }
        ],
        '식상': [
          { en: "Some people are content keeping their thoughts entirely to themselves. Yours runs the other way — whatever's in your head won't stay there, and you need an outlet, whether that's talking, making, or performing.", ko: '어떤 사람은 생각을 온전히 속에만 담아둬도 괜찮아. 너는 반대야. 머릿속에 있는 걸 못 참고 밖으로 표현해야 직성이 풀려. 말이든 손재주든 표현하는 데서 답이 나와.' },
          { en: 'This tends to suit work with a built-in outlet — writing, teaching, performing, building something visible — better than a role that mostly asks you to sit quietly and process internally.', ko: '이런 성향은 글쓰기, 가르치는 일, 공연, 눈에 보이는 걸 만드는 일처럼 표현할 창구가 내장된 일과 잘 맞아. 조용히 속으로만 처리해야 하는 역할보다.' },
          { en: 'In everyday terms, it can look like needing to talk a problem out loud before you can actually think it through, or feeling restless on a day you did not get to make or say anything.', ko: '일상에서는 문제를 소리 내어 말해봐야 제대로 정리가 되거나, 아무것도 만들거나 말하지 못한 날엔 괜히 답답한 식으로 나타날 수 있어.' }
        ],
        '재성': [
          { en: 'Some people navigate life mostly by feeling, reading the emotional temperature of a room before deciding anything. Yours runs the other way — you think in outcomes, not feelings, quick to size things up and quick to act on it.', ko: '어떤 사람은 인생을 주로 감정으로 헤쳐가면서, 뭘 하든 방 분위기부터 읽어. 너는 반대야. 감보다 계산이 빠른 편이라, 실속 챙기고 결과로 증명하는 데 능해.' },
          { en: 'This tends to suit roles with a clear, measurable outcome — sales, operations, anything where success can be counted — better than roles where success is mostly about how something felt.', ko: '이런 성향은 영업이나 운영처럼 성공을 숫자로 셀 수 있는, 결과가 뚜렷한 일과 잘 맞아. 성공이 대부분 느낌으로 판단되는 역할보다.' },
          { en: "In everyday terms, it can look like deciding on a restaurant based on reviews and price rather than mood, or moving straight to 'okay, what do we actually do about it' the moment a problem shows up.", ko: "일상에서는 식당을 분위기보다 후기와 가격으로 정하거나, 문제가 생기면 곧장 '그래서 어떻게 할 건데'로 넘어가는 식으로 나타날 수 있어." }
        ],
        '관성': [
          { en: 'Some people function fine with total freedom and no one checking in. Yours runs the other way — left with no rules, you drift, but hand you real responsibility and you snap into focus.', ko: '어떤 사람은 아무도 안 챙겨주고 완전히 자유로워도 잘 굴러가. 너는 반대야. 풀어두면 늘어지지만, 책임이 주어지면 그때부터 진가가 나와.' },
          { en: "This tends to suit roles with a real title and real accountability attached — being officially in charge of something — better than a loosely defined role where no one's actually counting on you for a specific outcome.", ko: '이런 성향은 실제 직함과 책임이 딸린 역할, 뭔가를 공식적으로 책임지는 자리와 잘 맞아. 아무도 특정 결과를 기대하지 않는 느슨한 역할보다.' },
          { en: 'In everyday terms, it can look like a to-do list with no deadline sitting untouched for weeks, versus the same list getting done fast the moment someone is actually depending on it.', ko: '일상에서는 마감 없는 할 일 목록은 몇 주씩 안 건드리다가, 누가 진짜로 기대하고 있는 순간엔 빠르게 해치우는 식으로 나타날 수 있어.' }
        ],
        '인성': [
          { en: "Some people push forward best entirely on their own, without needing anyone else in the picture. Yours runs the other way — grinding it out alone wears you thin, and you grow fastest when someone's actually teaching or backing you.", ko: '어떤 사람은 아무도 없이 혼자 밀어붙일 때 가장 잘 나가. 너는 반대야. 혼자 애쓰면 쉽게 지치고, 누가 옆에서 가르쳐주거나 받쳐줄 때 훨씬 크는 타입이야.' },
          { en: 'This tends to suit environments with real mentorship built in — a workplace with an actual manager who invests in you, a field with strong teacher-student traditions — better than a completely self-taught, sink-or-swim path.', ko: '이런 성향은 진짜로 신경 써주는 상사가 있는 직장이나 사제 전통이 강한 분야처럼 멘토링이 확실히 있는 환경과 잘 맞아. 완전히 독학으로 알아서 살아남아야 하는 길보다.' },
          { en: 'In everyday terms, it can look like learning a new skill twice as fast with a good teacher compared to struggling through tutorials alone, or feeling noticeably steadier on weeks when you have someone to check in with.', ko: '일상에서는 좋은 선생님과 배우면 혼자 튜토리얼과 씨름할 때보다 속도가 훨씬 빠르거나, 안부를 챙겨줄 사람이 있는 주엔 컨디션이 눈에 띄게 안정적인 식으로 나타날 수 있어.' }
        ]
      };
      if (maxN > 0) {
        overview.push({
          en: 'Across your whole life, this is the strength that keeps showing up: ' + CATEGORY_CASUAL[maxCat].en,
          ko: '인생 전반에서 계속 나타나는 강점은 이거야. ' + CATEGORY_CASUAL[maxCat].ko
        });
        overview = overview.concat(CATEGORY_STRENGTH_EXPAND[maxCat].slice(1));
      }

      var point = [];
      var bigyeop = ctx.categoryTally['비겁'] || 0;
      var cautionEn = [], cautionKo = [];
      if (bigyeop >= 3) { cautionEn.push('a wide circle that needs a little more discernment about who gets close'); cautionKo.push('가까이 두는 사람을 조금 더 가려야 하는 넓은 인간관계'); }
      if (ctx.strengthInfo.excess.length) { cautionEn.push('a concentration of ' + ctx.strengthInfo.excess.map(function (e) { return ELEMENT_EN[e]; }).join('/') + ' energy that can tip into imbalance'); cautionKo.push(ctx.strengthInfo.excess.map(function (e) { return ELEMENT_KO[e]; }).join('/') + ' 기운이 몰려서 균형이 깨지기 쉬운 부분'); }
      if (ctx.strengthInfo.lacking.length) { cautionEn.push('very little ' + ctx.strengthInfo.lacking.map(function (e) { return ELEMENT_EN[e]; }).join('/') + ' energy to fall back on'); cautionKo.push(ctx.strengthInfo.lacking.map(function (e) { return ELEMENT_KO[e]; }).join('/') + ' 기운이 거의 없어서 기댈 데가 부족한 부분'); }
      if (cautionEn.length) {
        point.push({
          en: 'The things worth watching over the long run: ' + cautionEn.join(', and ') + '.',
          ko: '장기적으로 눈여겨볼 부분은 이거야: ' + cautionKo.join(', ') + '.'
        });
        point.push({ en: 'These tend to surface most clearly during a period of real change — a big move, a new job, a relationship shift — when there is less of a familiar routine to lean on and the underlying pattern has more room to show itself.', ko: '이런 부분들은 큰 변화의 시기, 이사·이직·관계 변화처럼 익숙한 루틴이 줄어드는 때에 가장 분명하게 드러나는 편이야. 그 밑에 깔린 패턴이 드러날 여지가 많아지거든.' });
        point.push({ en: 'Day to day, it can look like the same specific situation quietly repeating itself every few years in a slightly different costume, until it becomes recognizable as a pattern rather than a string of unrelated events.', ko: '일상에서는 몇 년마다 겉모습만 조금 다른 채로 비슷한 상황이 조용히 반복되다가, 어느 순간 그게 각각 다른 사건이 아니라 하나의 패턴이라는 걸 알아차리게 되는 식으로 나타날 수 있어.' });
      } else {
        point.push({ en: "Some charts carry one clear, recurring blind spot to manage over a lifetime. There's no single lopsided pattern jumping out here — your chart runs fairly balanced.", ko: '어떤 원국은 평생에 걸쳐 관리해야 할 뚜렷한 약점 하나를 계속 지고 가. 너는 특별히 한쪽으로 쏠린 부분 없이, 비교적 균형 잡힌 원국이야.' });
        point.push({ en: 'This tends to mean the big risks in your life are less about a built-in tendency and more about ordinary circumstance — the usual stuff everyone deals with, rather than a pattern specific to you.', ko: '이건 네 인생의 큰 리스크가 타고난 성향보다는 그냥 평범한 상황들, 누구나 겪는 것들에 더 가깝다는 뜻이야.' });
        point.push({ en: 'In everyday terms, it can look like a hard stretch, when it comes, actually being explained by what is going on around you rather than a familiar internal pattern repeating itself.', ko: '일상에서는 힘든 시기가 와도, 그게 익숙한 내면의 패턴이 반복돼서라기보다 실제 주변 상황 때문인 경우가 많은 식으로 나타날 수 있어.' });
      }

      var jae = godTotal(ctx.godCount, ['정재', '편재']);
      var gwan = godTotal(ctx.godCount, ['정관', '편관']);
      var boost = [];
      if (jae > 0 && gwan > 0) {
        boost.push({ en: "Some people's charts lean hard into just one of money or career status, with the other running quiet. Yours has real material in both — leaning into steady effort and structure pays off for you over time in either direction.", ko: '어떤 원국은 재물이나 커리어 둘 중 하나에만 확 기울고 다른 쪽은 조용해. 너는 둘 다 다룰 재료가 있어. 꾸준함과 체계 쪽에 힘을 실으면 시간이 지나 양쪽 다 결과로 돌아와.' });
        boost.push({ en: 'This tends to suit building a life where the two reinforce each other — a career that comes with real earning power, not just prestige — better than chasing either one in isolation from the other.', ko: '이런 성향은 커리어와 재물이 서로를 밀어주는 삶, 명예뿐 아니라 실제 수익력도 따라오는 커리어와 잘 맞아. 둘 중 하나만 따로 좇는 것보다.' });
        boost.push({ en: 'In everyday terms, it can look like a promotion that comes with a real raise attached mattering more to you than the title alone, or a side income that eventually turns into an actual career path.', ko: '일상에서는 직함뿐인 승진보다 실제 연봉 인상이 따라오는 승진이 더 중요하게 느껴지거나, 부수입이 결국 진짜 커리어로 이어지는 식으로 나타날 수 있어.' });
      } else if (jae > 0) {
        boost.push({ en: 'Some people\'s charts center more on career structure than on money itself. Yours runs the other way — money is more central to your story than career structure is, and building your life around resources serves you better than chasing titles.', ko: '어떤 원국은 재물보다 커리어 체계가 더 중심이야. 너는 반대야. 커리어 체계보다 재물 쪽이 인생에서 더 중심이 되는 편이니, 직함보다 실질적인 자원 중심으로 살아가는 게 잘 맞아.' });
        boost.push({ en: 'This tends to suit measuring a job by what it actually pays and what it lets you build financially — better than measuring it by title, prestige, or where it sits on an org chart.', ko: '이런 성향은 직업을 직함이나 명예, 조직도상 위치보다 실제로 얼마를 벌고 재정적으로 뭘 쌓을 수 있는지로 판단하는 것과 잘 맞아.' });
        boost.push({ en: 'In everyday terms, it can look like turning down a more prestigious title for a role that actually pays better, or feeling more proud of your savings account than your business card.', ko: '일상에서는 더 화려한 직함보다 실제로 더 많이 버는 자리를 선택하거나, 명함보다 통장 잔고에 더 뿌듯함을 느끼는 식으로 나타날 수 있어.' });
      } else if (gwan > 0) {
        boost.push({ en: 'Some people\'s charts center more on money itself than on career structure. Yours runs the other way — career structure is more central to your story than money is, and standing and role are worth more to you than the paycheck.', ko: '어떤 원국은 커리어 체계보다 재물 자체가 더 중심이야. 너는 반대야. 재물보다 커리어의 체계와 위치에 힘을 싣는 게 더 잘 맞아. 돈보다 자리와 역할에 집중해봐.' });
        boost.push({ en: 'This tends to suit measuring a role by its title, responsibility, and standing — better than measuring it purely by the number on the paycheck.', ko: '이런 성향은 역할을 급여 숫자보다 직함, 책임, 위치로 판단하는 것과 잘 맞아.' });
        boost.push({ en: 'In everyday terms, it can look like taking a lower-paying role because the title and responsibility genuinely mean more to you, or caring more about being the one people report to than about the bonus attached to it.', ko: '일상에서는 직함과 책임이 진짜로 더 중요해서 연봉이 낮은 자리를 택하거나, 보너스보다 사람들이 나한테 보고한다는 사실 자체가 더 마음에 걸리는 식으로 나타날 수 있어.' });
      } else {
        boost.push({ en: 'Some people build their whole sense of self around money or career status. Yours does not have to — neither money nor career status has to run the show for you, and it is fine to organize your life around other things entirely.', ko: '어떤 사람은 자기 정체성 전체를 재물이나 커리어 지위 중심으로 세워. 너는 안 그래도 돼. 재물이나 커리어 지위에 얽매이지 않아도 괜찮아. 다른 가치를 중심으로 삶을 꾸려가도 좋은 편이야.' });
        boost.push({ en: 'This tends to suit organizing a life around relationships, meaning, craft, or wellbeing — better than a life measured primarily by income or job title.', ko: '이런 성향은 관계, 의미, 실력, 웰빙 중심으로 삶을 꾸려가는 것과 잘 맞아. 소득이나 직함으로 주로 판단되는 삶보다.' });
        boost.push({ en: 'In everyday terms, it can look like genuinely not knowing your coworkers\' salaries or titles because it never occurred to you to check, or choosing a lower-paying job that actually leaves you time for what matters more to you.', ko: '일상에서는 동료 연봉이나 직함을 궁금해한 적조차 없거나, 급여는 낮아도 진짜 중요한 걸 위한 시간이 남는 일을 선택하는 식으로 나타날 수 있어.' });
      }

      return sectionHtml('Overview', '총운풀이', overview) +
        sectionHtml('Point', '포인트', point) +
        sectionHtml('Boost Your Life Luck', '평생운 올리는법', boost);
    }
  };

  var catButtons = [];
  var catGrid = $('#scw-category-grid');
  CATEGORY_MENU.forEach(function (cat) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scw-category-card';
    btn.innerHTML = '<img class="scw-cat-icon-card" src="' + __kimg('trad_' + cat.icon, TRAD_IMG_BASE + cat.icon) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
      '<span class="scw-cat-en">' + cat.en + '</span>' +
      '<span class="scw-cat-ko">' + cat.ko + '</span>';
    btn.addEventListener('click', function () { showReport(cat.key, btn); });
    catGrid.appendChild(btn);
    catButtons.push(btn);
  });

  function showReport(key, btn) {
    if (!currentCtx) return;
    var cat = CATEGORY_MENU.filter(function (c) { return c.key === key; })[0];
    $('#scw-report-title-en').textContent = cat.en + ' Report';
    $('#scw-report-title-ko').textContent = cat.ko + ' 리포트';
    $('#scw-report-body').innerHTML = REPORT_BUILDERS[key](currentCtx) + paraHtml([GENERAL_DISCLAIMER]);
    $('#scw-report-view').style.display = 'block';
    catButtons.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
  }

  // [테스트판] 대운 표시
  function renderLuck(res) {
    var box = $('#scw-luck');
    if (!box) return;
    function one(L, title) {
      var h = '<div class="scw-luck-block"><div class="scw-luck-title">' + title + '</div>' +
        '<div class="scw-luck-meta">Direction: ' + (L.forward ? 'forward' : 'backward') +
        ' · First cycle starts at age <b>' + L.startAge + '</b> (' + L.startYMD.years + 'y ' + L.startYMD.months + 'm ' + L.startYMD.days +
        'd after birth, counted to ' + L.fromTerm + ' ' + L.fromTermLocal + ')</div><div class="scw-luck-row">';
      L.cycles.forEach(function (c) {
        h += '<div class="scw-luck-cell"><div class="scw-luck-age">' + c.startAge + '</div><div class="scw-ganji">' + c.ganzhi +
          '</div><div class="scw-luck-year">~' + c.startYearApprox + '</div></div>';
      });
      return h + '</div></div>';
    }
    var html = '';
    if (res.luck.male) html += one(res.luck.male, res.luck.female ? 'If read as a traditional male chart' : 'Your 10-year luck cycles');
    if (res.luck.female) html += one(res.luck.female, res.luck.male ? 'If read as a traditional female chart' : 'Your 10-year luck cycles');
    box.innerHTML = html;
  }
  // [테스트판] 계산 조건 공개
  function renderCalcNote(res) {
    var box = $('#scw-calc-note');
    if (!box) return;
    var t = res.time;
    var om = Math.abs(t.utcOffsetMinutes);
    var lines = [];
    lines.push('Birthplace time zone: ' + res.input.timeZone + ' (UTC' + (t.utcOffsetMinutes >= 0 ? '+' : '-') + Math.floor(om / 60) + ':' + ('0' + (om % 60)).slice(-2) +
      ' at birth). Birth moment in UTC: ' + t.utc + '.');
    var sc = t.solarCorrection;
    if (t.city) lines.push('Birth city: ' + t.city.name + ' (longitude ' + t.city.lon + '°).');
    if (sc && sc.mode !== 'off') {
      lines.push((sc.mode === 'true' ? 'True solar time' : 'Local solar time') + ' adjustment: ' + (sc.appliedMinutes >= 0 ? '+' : '') + sc.appliedMinutes +
        ' min (longitude ' + (sc.meanMinutes >= 0 ? '+' : '') + sc.meanMinutes + ' min vs the ' + sc.standardMeridian + '° standard meridian' +
        (sc.mode === 'true' ? ', equation of time ' + (sc.eotMinutes >= 0 ? '+' : '') + sc.eotMinutes + ' min' : '') + '). Day and hour pillars use ' + t.effectiveLocal + '.');
    } else {
      lines.push('No birthplace adjustment: day and hour pillars use ' + t.effectiveLocal + ' (standard clock time).');
    }
    if (t.lateZiApplies) lines.push('Born 11:00–11:59 PM: ' + (t.lateZi === 'birth' ? 'kept on the same date (your choice).' : 'counted as the next day (default).'));
    if (t.dstMinutes) lines.push('Daylight saving time was in effect, so the day and hour pillars use standard time: ' + t.standardLocal + '.');
    var sdK = res.input.solarDate, ctK = res.input.clockTime || '', hmK = ctK ? (+ctK.split(':')[0]) * 60 + (+ctK.split(':')[1]) : -1;
    var stdChangeK = /^(1954-3-2[01]|1961-8-(9|10))$/.test(sdK);
    if (t.wallTimeFlag === 'nonexistent') lines.push(stdChangeK ? 'Note: Korea moved its standard time forward by 30 minutes at this moment (August 10, 1961), so this clock time was skipped. We read it with the earlier standard time.' : 'Note: this clock time was skipped when daylight saving time began. We read it as standard time.');
    if (t.wallTimeFlag === 'ambiguous') lines.push(stdChangeK ? 'Note: Korea moved its standard time back by 30 minutes at this moment (March 21, 1954), so this clock time happened twice. We used the first one.' : 'Note: this clock time happened twice when daylight saving time ended. We used the first one.');
    if (res.input.timeZone === 'Asia/Seoul' && ((sdK === '1954-3-21' && hmK >= 0 && hmK < 30) || (sdK === '1961-8-10' && hmK >= 0 && hmK < 30) || (sdK === '1961-8-9' && hmK >= 1410)))
      lines.push('Note: official records put Korea’s 30-minute standard time change slightly differently from the time-zone data we use, so for a birth in this half hour the day or hour can come out differently.');
    if (res.input.timeZone === 'Asia/Seoul' && /^(1948-5-(30|31)|1948-6-1|1951-9-(9|10))$/.test(sdK))
      lines.push('Note: the official start or end date of daylight saving time in Korea that year is still being checked, so the birth hour we use for this date could be off by one hour.');
    lines.push('Nearby solar terms (birthplace time): ' + res.solarTerms.prev.name + ' ' + res.solarTerms.prev.local + ' / ' + res.solarTerms.next.name + ' ' + res.solarTerms.next.local + '.');
    if (res.termDayWarning) {
      lines.push('Your birth date is a solar-term day and the time is unknown. Before the term: ' + res.termDayWarning.before.year + ' year, ' + res.termDayWarning.before.month +
        ' month. After it: ' + res.termDayWarning.after.year + ' year, ' + res.termDayWarning.after.month + ' month.');
    }
    box.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }

  // [5차b] 만 14세 미만 보호를 엔진 쪽에서도: 계산 직후 나이를 보고 Reports·오늘의 운세 4칸(Wealth·Love·Career·Health)을 먼저 숨기고 안내 한 줄.
  // 심화 풀이 파일(deep_ui.js)이 늦게 오거나 안 와도 같은 결과. 안내 문장·칸 id 는 deep_ui.js 와 같아서(dr-reports-minor, dr-today-minor) 중복으로 생기지 않음.
  function scwAsOf() {
    var q = /[?&]asof=(\d{4}-\d{2}-\d{2})/.exec(location.search); if (q) return q[1];
    var n = new Date(); return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2);
  }
  function scwIsMinor(res) { // deep_reading_engine.js 와 같은 만 나이 계산(생일 당일부터 만 14세)
    var s = res.input.solarDate.split('-').map(Number), a = scwAsOf().split('-').map(Number);
    return (a[0] - s[0] - ((a[1] < s[1] || (a[1] === s[1] && a[2] < s[2])) ? 1 : 0)) < 14;
  }
  function scwMinorGuard(res) {
    var minor = scwIsMinor(res);
    var grid = $('#scw-category-grid'), view = $('#scw-report-view'), note = document.getElementById('dr-reports-minor');
    if (grid) {
      if (minor) {
        grid.style.display = 'none'; if (view) view.style.display = 'none';
        if (!note) { note = document.createElement('p'); note.id = 'dr-reports-minor'; note.className = 'dr-reports-minor'; note.textContent = 'These reports are for readers 14 and older.'; grid.parentNode.insertBefore(note, grid); }
        note.style.display = '';
      } else { grid.style.display = ''; if (note) note.style.display = 'none'; }
    }
    var box = $('#scw-today');
    if (box) {
      box.__drMinor = minor;
      var hideKeys = ['Wealth', 'Love', 'Career', 'Health', 'Daily Rhythm'], hidden = 0;
      Array.prototype.slice.call(box.querySelectorAll('.scw-today-cat')).forEach(function (c) {
        var lab = c.querySelector('.scw-tcl-en'), name = lab ? lab.textContent.trim() : '';
        var hide = minor && hideKeys.indexOf(name) >= 0;
        c.style.display = hide ? 'none' : ''; if (hide) hidden++;
      });
      var tn = document.getElementById('dr-today-minor');
      if (minor && hidden) {
        if (!tn) { tn = document.createElement('p'); tn.id = 'dr-today-minor'; tn.className = 'dr-reports-minor'; tn.textContent = 'Today’s Fortune for wealth, love, career, and daily rhythm is for readers 14 and older.'; box.appendChild(tn); }
        else if (tn.parentNode !== box) box.appendChild(tn);
        tn.style.display = '';
      } else if (tn) tn.style.display = 'none';
    }
  }
  // 심화 풀이 파일이 계산 뒤에 도착하면(느린 망) 다시 누르지 않아도 풀이를 보여 줌
  window.addEventListener('load', function () {
    var p = window.__scwPending; window.__scwPending = null;
    if (p && p.res === window.__scwLastRes && window.KDeepUI && $('#scw-result').style.display === 'block') { try { window.KDeepUI.render(p.inp, p.res, { noScroll: true }); } catch (e) { if (window.console) console.error(e); } }
  });
  function scwDateOk(inp) { return inp.calendar === 'lunar' || (inp.day >= 1 && inp.day <= scwDim(inp.year, inp.month)); } // [5차b] 양력만: 음력은 기존 오류 안내
  $('#scw-submit').addEventListener('click', function () {
    $('#scw-error').textContent = '';
    try {
      // [테스트판 v2] 입력 읽기(도시·시간대·태양시 보정·23시 선택 포함) → KSajuCore 계산
      var inp = readInput();
      window.__scwPending = null;
      if (!scwDateOk(inp)) { // [5차b] 달력에 없는 날짜는 계산하지 않음
        if (window.KDeepUI) window.KDeepUI.hide();
        showError('That date doesn\'t exist (for example, February 30). Please choose a day that is in that month.');
        return;
      }
      var timeUnknown = inp.timeUnknown;
      var luckDirection = inp.luckDirection;
      var res = window.KSajuCore.calculate(inp);
      var ec = window.KSajuCore.toEightCharAdapter(res);

      var pillars = renderPillars(ec, timeUnknown);
      var wuxingCounts = renderWuxing(pillars, timeUnknown);
      var sipsinInfo = renderSipsin(ec, timeUnknown);
      var categoryTally = sipsinInfo.categoryTally;
      var strengthInfo = renderStrength(pillars, timeUnknown, wuxingCounts, res.strength);
      renderSummary(strengthInfo, wuxingCounts, categoryTally);
      renderTodayFortune(pillars.day.ganChar);
      renderLuck(res);
      renderCalcNote(res);

      // 기존 연애·결혼 리포트는 배우자 별 계산에 성별 값을 씀 → 대운 방향 선택값을 넘김 (Not sure 는 male 규칙으로)
      var gender = luckDirection === 'female' ? 'female' : 'male';
      currentCtx = {
        pillars: pillars, timeUnknown: timeUnknown, wuxingCounts: wuxingCounts,
        categoryTally: categoryTally, godCount: sipsinInfo.godCount,
        strengthInfo: strengthInfo, gender: gender,
        dayZhiGod: sipsinInfo.dayZhiGod, dayZhiStage: dishiKo(ec, 'getDayDiShi'),
        coreResult: res
      };

      $('#scw-report-view').style.display = 'none';
      catButtons.forEach(function (b) { b.classList.remove('is-active'); });
      $('#scw-result').style.display = 'block';
      scwMinorGuard(res); // [5차b] 심화 풀이 파일이 없어도 만 14세 미만 보호
      window.__scwLastRes = res;
      if (window.KDeepUI) window.KDeepUI.render(inp, res); // [심화 풀이 테스트판]
      else if (document.readyState !== 'complete') window.__scwPending = { inp: inp, res: res }; // [5차b] 파일이 아직 오는 중
    } catch (err) {
      if (window.KDeepUI) window.KDeepUI.hide();
      if (window.console) console.error(err);
      showError(LANG === 'en'
        ? 'Could not calculate this date. If you entered a lunar date, please double-check that day actually exists in that month (and the leap-month setting).'
        : '입력하신 날짜를 계산할 수 없습니다. 음력 날짜의 경우 해당 월에 실제로 존재하는 날짜(또는 윤달 여부)인지 다시 확인해주세요.');
    }
  });
})();
