(function () {
  'use strict';

  // saju_engine.js는 단일 IIFE 안에 모든 헬퍼를 private으로 갖고 있어 외부에서 재사용할 수 없다.
  // 그래서 이 모듈은 saju_engine.js와 같은 "위젯 루트를 스스로 찾는" 패턴을 그대로 따르면서,
  // 계산에 필요한 최소한의 순수 변환 테이블만 자체적으로 복제해서 갖는다.
  var root = document.currentScript.previousElementSibling;
  while (root && !root.classList.contains('saju-calc-widget')) {
    root = root.previousElementSibling;
  }
  if (!root) { return; }
  var $ = function (sel) { return root.querySelector(sel); };
  var LANG = root.dataset.lang === 'en' ? 'en' : 'ko';

  // 배포 전용 URL. 로컬 테스트 시에는 window.COMPAT_TEXT_URL_OVERRIDE로 상대경로를 주입해서 사용한다.
  var COMPAT_TEXT_URL = window.COMPAT_TEXT_URL_OVERRIDE ||
    'https://stjandljh1-creator.github.io/saju-calculator/compatibility_report_texts.json';

  // saju_engine.js의 TRAD_IMG_BASE(8개 리포트 카드 아이콘)와 동일한 traditional 테마 이미지 경로
  var IMG_BASE = window.COMPAT_IMG_BASE_OVERRIDE ||
    'https://stjandljh1-creator.github.io/saju-calculator/images/web/traditional/';

  // ---- 천간/지지 -> 오행 (saju_engine.js GAN_INFO/ZHI_INFO와 동일한 값의 축약 복제본) ----
  var GAN_ELEMENT = {
    '甲': '목', '乙': '목', '丙': '화', '丁': '화', '戊': '토',
    '己': '토', '庚': '금', '辛': '금', '壬': '수', '癸': '수'
  };
  var ZHI_ELEMENT = {
    '子': '수', '丑': '토', '寅': '목', '卯': '목', '辰': '토', '巳': '화',
    '午': '화', '未': '토', '申': '금', '酉': '금', '戌': '토', '亥': '수'
  };
  var ZHI_HANJA_KO = {
    '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
    '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
  };
  var GAN_HANJA_KO = {
    '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
    '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'
  };
  var ELEMENT_KO = { '목': '목(木)', '화': '화(火)', '토': '토(土)', '금': '금(金)', '수': '수(水)' };
  var ZHI_EN = { '子': 'Rat', '丑': 'Ox', '寅': 'Tiger', '卯': 'Rabbit', '辰': 'Dragon', '巳': 'Snake', '午': 'Horse', '未': 'Goat', '申': 'Monkey', '酉': 'Rooster', '戌': 'Dog', '亥': 'Pig' }; // [보정 1753] 영어 화면 한자 0
  var GAN_EN = { '甲': 'Oak (bolder Wood)', '乙': 'Ivy (gentler Wood)', '丙': 'Sunshine (bolder Fire)', '丁': 'Firefly (gentler Fire)', '戊': 'Rock (bolder Earth)', '己': 'Meadow (gentler Earth)', '庚': 'Blade (bolder Metal)', '辛': 'Gem (gentler Metal)', '壬': 'Ocean (bolder Water)', '癸': 'Rain (gentler Water)' };
  var ELEMENT_EN = { '목': 'Wood', '화': 'Fire', '토': 'Earth', '금': 'Metal', '수': 'Water' };

  // 오행 상생/상극 (saju_engine.js GENERATES/CONTROLS와 동일)
  var GENERATES = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  var CONTROLS = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };

  // 일지 육합 (자축=토, 인해=목, 묘술=화, 진유=금, 사신=수, 오미=화[변환 없이 강화])
  var LIUHE = {
    '子丑': '토', '丑子': '토',
    '寅亥': '목', '亥寅': '목',
    '卯戌': '화', '戌卯': '화',
    '辰酉': '금', '酉辰': '금',
    '巳申': '수', '申巳': '수',
    '午未': '화', '未午': '화'
  };
  var LIUHE_NO_TRANSFORM = { '午未': true, '未午': true }; // 오미는 새 오행으로 변환되지 않고 화 기운만 강화

  var RELATIONSHIP_TYPES = [
    { key: 'lover', en: 'Romantic Partner', ko: '연인/부부' },
    { key: 'friend', en: 'Friend', ko: '친구' },
    { key: 'business', en: 'Business Partner', ko: '사업 파트너' }
  ];

  // 궁합 입력 폼(personFormHtml)·제출 버튼에서 쓰는 언어별 UI 문구
  var COMPAT_UI = LANG === 'en' ? {
    solar: 'Solar Calendar', lunar: 'Lunar Calendar',
    submit: 'Calculate Compatibility',
    reltypeLabel: 'Relationship Type',
    leapMonth: 'Leap month', hourUnknown: 'Time Unknown',
    year: 'Year', month: 'Month', day: 'Day'
  } : {
    solar: '양력', lunar: '음력',
    submit: '궁합 계산하기',
    reltypeLabel: '관계 유형',
    leapMonth: '윤달', hourUnknown: '시간 모름'
  };

  // v1 등급 컷오프 — 균등 배분 스코어링에서 시작한 초기값, 추후 실제 사례로 조정 예정
  var GRADE_THRESHOLDS = [
    { min: 85, grade: 'A' },
    { min: 70, grade: 'B' },
    { min: 55, grade: 'C' },
    { min: 0, grade: 'D' }
  ];
  function gradeOf(score) {
    for (var i = 0; i < GRADE_THRESHOLDS.length; i++) {
      if (score >= GRADE_THRESHOLDS[i].min) return GRADE_THRESHOLDS[i].grade;
    }
    return 'D';
  }

  // ================= 개인 사주 계산 (saju_engine.js 제출 핸들러와 동일한 lunar-javascript 호출 재현) =================
  // Korean lunar calendar table (KASI): the lunar library follows China time (UTC+8), so some Korean lunar months start a day apart.
  var KOREAN_LUNAR_FIX = {"1914":[[1,"1914-01-26",30],[2,"1914-02-25",30],[3,"1914-03-27",29],[4,"1914-04-25",30],[5,"1914-05-25",30],[-5,"1914-06-24",29],[6,"1914-07-23",29],[7,"1914-08-21",30],[8,"1914-09-20",29],[9,"1914-10-19",30],[10,"1914-11-18",29],[11,"1914-12-17",29],[12,"1915-01-15",30]],"1915":[[1,"1915-02-14",30],[2,"1915-03-16",29],[3,"1915-04-14",30],[4,"1915-05-14",30],[5,"1915-06-13",29],[6,"1915-07-12",30],[7,"1915-08-11",29],[8,"1915-09-09",30],[9,"1915-10-09",29],[10,"1915-11-07",30],[11,"1915-12-07",29],[12,"1916-01-05",30]],"1916":[[1,"1916-02-04",29],[2,"1916-03-04",30],[3,"1916-04-03",29],[4,"1916-05-02",30],[5,"1916-06-01",29],[6,"1916-06-30",30],[7,"1916-07-30",30],[8,"1916-08-29",29],[9,"1916-09-27",30],[10,"1916-10-27",29],[11,"1916-11-25",30],[12,"1916-12-25",29]],"1918":[[1,"1918-02-11",30],[2,"1918-03-13",29],[3,"1918-04-11",29],[4,"1918-05-10",30],[5,"1918-06-09",29],[6,"1918-07-08",30],[7,"1918-08-07",29],[8,"1918-09-05",30],[9,"1918-10-05",30],[10,"1918-11-04",30],[11,"1918-12-04",29],[12,"1919-01-02",30]],"1919":[[1,"1919-02-01",29],[2,"1919-03-02",30],[3,"1919-04-01",29],[4,"1919-04-30",29],[5,"1919-05-29",30],[6,"1919-06-28",29],[7,"1919-07-27",30],[-7,"1919-08-26",29],[8,"1919-09-24",30],[9,"1919-10-24",30],[10,"1919-11-23",29],[11,"1919-12-22",30],[12,"1920-01-21",30]],"1920":[[1,"1920-02-20",29],[2,"1920-03-20",30],[3,"1920-04-19",29],[4,"1920-05-18",29],[5,"1920-06-16",30],[6,"1920-07-16",29],[7,"1920-08-14",29],[8,"1920-09-12",30],[9,"1920-10-12",30],[10,"1920-11-11",29],[11,"1920-12-10",30],[12,"1921-01-09",30]],"1923":[[1,"1923-02-16",29],[2,"1923-03-17",30],[3,"1923-04-16",30],[4,"1923-05-16",29],[5,"1923-06-14",30],[6,"1923-07-14",29],[7,"1923-08-12",30],[8,"1923-09-11",29],[9,"1923-10-10",30],[10,"1923-11-09",29],[11,"1923-12-08",29],[12,"1924-01-06",30]],"1924":[[1,"1924-02-05",30],[2,"1924-03-06",29],[3,"1924-04-04",30],[4,"1924-05-04",29],[5,"1924-06-02",30],[6,"1924-07-02",30],[7,"1924-08-01",29],[8,"1924-08-30",30],[9,"1924-09-29",29],[10,"1924-10-28",30],[11,"1924-11-27",29],[12,"1924-12-26",29]],"1925":[[1,"1925-01-24",30],[2,"1925-02-23",29],[3,"1925-03-24",30],[4,"1925-04-23",30],[-4,"1925-05-23",29],[5,"1925-06-21",30],[6,"1925-07-21",29],[7,"1925-08-19",30],[8,"1925-09-18",30],[9,"1925-10-18",29],[10,"1925-11-16",30],[11,"1925-12-16",29],[12,"1926-01-14",30]],"1927":[[1,"1927-02-02",30],[2,"1927-03-04",29],[3,"1927-04-02",29],[4,"1927-05-01",30],[5,"1927-05-31",29],[6,"1927-06-29",30],[7,"1927-07-29",29],[8,"1927-08-27",30],[9,"1927-09-26",30],[10,"1927-10-26",29],[11,"1927-11-24",30],[12,"1927-12-24",30]],"1928":[[1,"1928-01-23",29],[2,"1928-02-21",30],[-2,"1928-03-22",29],[3,"1928-04-20",29],[4,"1928-05-19",30],[5,"1928-06-18",29],[6,"1928-07-17",29],[7,"1928-08-15",30],[8,"1928-09-14",30],[9,"1928-10-14",29],[10,"1928-11-12",30],[11,"1928-12-12",30],[12,"1929-01-11",30]],"1931":[[1,"1931-02-17",30],[2,"1931-03-19",30],[3,"1931-04-18",30],[4,"1931-05-18",29],[5,"1931-06-16",29],[6,"1931-07-15",30],[7,"1931-08-14",29],[8,"1931-09-12",29],[9,"1931-10-11",30],[10,"1931-11-10",29],[11,"1931-12-09",30],[12,"1932-01-08",29]],"1934":[[1,"1934-02-14",29],[2,"1934-03-15",30],[3,"1934-04-14",29],[4,"1934-05-13",30],[5,"1934-06-12",30],[6,"1934-07-12",29],[7,"1934-08-10",30],[8,"1934-09-09",30],[9,"1934-10-09",29],[10,"1934-11-07",30],[11,"1934-12-07",29],[12,"1935-01-05",30]],"1936":[[1,"1936-01-24",30],[2,"1936-02-23",29],[3,"1936-03-23",29],[-3,"1936-04-21",30],[4,"1936-05-21",29],[5,"1936-06-19",30],[6,"1936-07-19",29],[7,"1936-08-17",30],[8,"1936-09-16",29],[9,"1936-10-15",30],[10,"1936-11-14",30],[11,"1936-12-14",30],[12,"1937-01-13",29]],"1942":[[1,"1942-02-15",30],[2,"1942-03-17",29],[3,"1942-04-15",30],[4,"1942-05-15",30],[5,"1942-06-14",29],[6,"1942-07-13",30],[7,"1942-08-12",30],[8,"1942-09-11",29],[9,"1942-10-10",30],[10,"1942-11-09",29],[11,"1942-12-08",29],[12,"1943-01-06",30]],"1943":[[1,"1943-02-05",29],[2,"1943-03-06",30],[3,"1943-04-05",29],[4,"1943-05-04",30],[5,"1943-06-03",29],[6,"1943-07-02",30],[7,"1943-08-01",30],[8,"1943-08-31",29],[9,"1943-09-29",30],[10,"1943-10-29",30],[11,"1943-11-28",29],[12,"1943-12-27",30]],"1944":[[1,"1944-01-26",29],[2,"1944-02-24",29],[3,"1944-03-24",30],[4,"1944-04-23",29],[-4,"1944-05-22",30],[5,"1944-06-21",29],[6,"1944-07-20",30],[7,"1944-08-19",29],[8,"1944-09-17",30],[9,"1944-10-17",30],[10,"1944-11-16",29],[11,"1944-12-15",30],[12,"1945-01-14",30]],"1949":[[1,"1949-01-29",30],[2,"1949-02-28",30],[3,"1949-03-30",29],[4,"1949-04-28",30],[5,"1949-05-28",29],[6,"1949-06-26",30],[7,"1949-07-26",29],[-7,"1949-08-24",29],[8,"1949-09-22",30],[9,"1949-10-22",29],[10,"1949-11-20",30],[11,"1949-12-20",29],[12,"1950-01-18",30]],"1950":[[1,"1950-02-17",30],[2,"1950-03-19",29],[3,"1950-04-17",30],[4,"1950-05-17",30],[5,"1950-06-16",29],[6,"1950-07-15",30],[7,"1950-08-14",29],[8,"1950-09-12",29],[9,"1950-10-11",30],[10,"1950-11-10",29],[11,"1950-12-09",30],[12,"1951-01-08",29]],"1952":[[1,"1952-01-27",29],[2,"1952-02-25",30],[3,"1952-03-26",29],[4,"1952-04-24",30],[5,"1952-05-24",29],[-5,"1952-06-22",30],[6,"1952-07-22",30],[7,"1952-08-21",29],[8,"1952-09-19",30],[9,"1952-10-19",29],[10,"1952-11-17",30],[11,"1952-12-17",29],[12,"1953-01-15",30]],"1953":[[1,"1953-02-14",29],[2,"1953-03-15",30],[3,"1953-04-14",29],[4,"1953-05-13",29],[5,"1953-06-11",30],[6,"1953-07-11",30],[7,"1953-08-10",29],[8,"1953-09-08",30],[9,"1953-10-08",30],[10,"1953-11-07",29],[11,"1953-12-06",30],[12,"1954-01-05",30]],"1954":[[1,"1954-02-04",29],[2,"1954-03-05",29],[3,"1954-04-03",30],[4,"1954-05-03",29],[5,"1954-06-01",29],[6,"1954-06-30",30],[7,"1954-07-30",29],[8,"1954-08-28",30],[9,"1954-09-27",30],[10,"1954-10-27",29],[11,"1954-11-25",30],[12,"1954-12-25",30]],"1955":[[1,"1955-01-24",30],[2,"1955-02-23",29],[3,"1955-03-24",29],[-3,"1955-04-22",30],[4,"1955-05-22",29],[5,"1955-06-20",29],[6,"1955-07-19",30],[7,"1955-08-18",29],[8,"1955-09-16",30],[9,"1955-10-16",29],[10,"1955-11-14",30],[11,"1955-12-14",30],[12,"1956-01-13",30]],"1957":[[1,"1957-01-31",30],[2,"1957-03-02",29],[3,"1957-03-31",30],[4,"1957-04-30",29],[5,"1957-05-29",30],[6,"1957-06-28",29],[7,"1957-07-27",29],[8,"1957-08-25",30],[-8,"1957-09-24",29],[9,"1957-10-23",30],[10,"1957-11-22",29],[11,"1957-12-21",30],[12,"1958-01-20",30]],"1958":[[1,"1958-02-19",29],[2,"1958-03-20",30],[3,"1958-04-19",30],[4,"1958-05-19",29],[5,"1958-06-17",30],[6,"1958-07-17",29],[7,"1958-08-15",29],[8,"1958-09-13",30],[9,"1958-10-13",29],[10,"1958-11-11",30],[11,"1958-12-11",29],[12,"1959-01-09",30]],"1965":[[1,"1965-02-02",29],[2,"1965-03-03",30],[3,"1965-04-02",29],[4,"1965-05-01",30],[5,"1965-05-31",29],[6,"1965-06-29",29],[7,"1965-07-28",30],[8,"1965-08-27",29],[9,"1965-09-25",29],[10,"1965-10-24",30],[11,"1965-11-23",30],[12,"1965-12-23",30]],"1966":[[1,"1966-01-22",29],[2,"1966-02-20",30],[3,"1966-03-22",30],[-3,"1966-04-21",29],[4,"1966-05-20",30],[5,"1966-06-19",29],[6,"1966-07-18",29],[7,"1966-08-16",30],[8,"1966-09-15",29],[9,"1966-10-14",29],[10,"1966-11-12",30],[11,"1966-12-12",30],[12,"1967-01-11",29]],"1968":[[1,"1968-01-30",29],[2,"1968-02-28",30],[3,"1968-03-29",30],[4,"1968-04-28",29],[5,"1968-05-27",30],[6,"1968-06-26",29],[7,"1968-07-25",30],[-7,"1968-08-24",29],[8,"1968-09-22",30],[9,"1968-10-22",29],[10,"1968-11-20",30],[11,"1968-12-20",29],[12,"1969-01-18",30]],"1970":[[1,"1970-02-06",30],[2,"1970-03-08",29],[3,"1970-04-06",29],[4,"1970-05-05",30],[5,"1970-06-04",30],[6,"1970-07-04",29],[7,"1970-08-02",30],[8,"1970-09-01",29],[9,"1970-09-30",30],[10,"1970-10-30",30],[11,"1970-11-29",29],[12,"1970-12-28",30]],"1972":[[1,"1972-02-15",29],[2,"1972-03-15",30],[3,"1972-04-14",29],[4,"1972-05-13",29],[5,"1972-06-11",30],[6,"1972-07-11",29],[7,"1972-08-09",30],[8,"1972-09-08",29],[9,"1972-10-07",30],[10,"1972-11-06",30],[11,"1972-12-06",30],[12,"1973-01-05",29]],"1973":[[1,"1973-02-03",30],[2,"1973-03-05",29],[3,"1973-04-03",30],[4,"1973-05-03",29],[5,"1973-06-01",29],[6,"1973-06-30",30],[7,"1973-07-30",29],[8,"1973-08-28",29],[9,"1973-09-26",30],[10,"1973-10-26",30],[11,"1973-11-25",30],[12,"1973-12-25",29]],"1976":[[1,"1976-01-31",30],[2,"1976-03-01",30],[3,"1976-03-31",29],[4,"1976-04-29",30],[5,"1976-05-29",29],[6,"1976-06-27",30],[7,"1976-07-27",29],[8,"1976-08-25",30],[-8,"1976-09-24",29],[9,"1976-10-23",30],[10,"1976-11-22",29],[11,"1976-12-21",29],[12,"1977-01-19",30]],"1978":[[1,"1978-02-07",30],[2,"1978-03-09",30],[3,"1978-04-08",29],[4,"1978-05-07",30],[5,"1978-06-06",29],[6,"1978-07-05",30],[7,"1978-08-04",30],[8,"1978-09-03",29],[9,"1978-10-02",30],[10,"1978-11-01",29],[11,"1978-11-30",30],[12,"1978-12-30",29]],"1982":[[1,"1982-01-25",30],[2,"1982-02-24",29],[3,"1982-03-25",30],[4,"1982-04-24",29],[-4,"1982-05-23",29],[5,"1982-06-21",30],[6,"1982-07-21",29],[7,"1982-08-19",29],[8,"1982-09-17",30],[9,"1982-10-17",30],[10,"1982-11-16",29],[11,"1982-12-15",30],[12,"1983-01-14",30]],"1987":[[1,"1987-01-29",30],[2,"1987-02-28",29],[3,"1987-03-29",30],[4,"1987-04-28",30],[5,"1987-05-28",29],[6,"1987-06-26",30],[-6,"1987-07-26",29],[7,"1987-08-24",30],[8,"1987-09-23",30],[9,"1987-10-23",29],[10,"1987-11-21",30],[11,"1987-12-21",29],[12,"1988-01-19",30]],"1988":[[1,"1988-02-18",29],[2,"1988-03-18",29],[3,"1988-04-16",30],[4,"1988-05-16",29],[5,"1988-06-14",30],[6,"1988-07-14",29],[7,"1988-08-12",30],[8,"1988-09-11",30],[9,"1988-10-11",29],[10,"1988-11-09",30],[11,"1988-12-09",30],[12,"1989-01-08",29]],"1989":[[1,"1989-02-06",30],[2,"1989-03-08",29],[3,"1989-04-06",29],[4,"1989-05-05",30],[5,"1989-06-04",29],[6,"1989-07-03",30],[7,"1989-08-02",29],[8,"1989-08-31",30],[9,"1989-09-30",30],[10,"1989-10-30",29],[11,"1989-11-28",30],[12,"1989-12-28",30]],"1990":[[1,"1990-01-27",29],[2,"1990-02-25",30],[3,"1990-03-27",29],[4,"1990-04-25",29],[5,"1990-05-24",30],[-5,"1990-06-23",29],[6,"1990-07-22",29],[7,"1990-08-20",30],[8,"1990-09-19",30],[9,"1990-10-19",29],[10,"1990-11-17",30],[11,"1990-12-17",30],[12,"1991-01-16",30]],"1995":[[1,"1995-01-31",29],[2,"1995-03-01",30],[3,"1995-03-31",30],[4,"1995-04-30",29],[5,"1995-05-29",30],[6,"1995-06-28",30],[7,"1995-07-28",29],[8,"1995-08-26",30],[-8,"1995-09-25",29],[9,"1995-10-24",30],[10,"1995-11-23",29],[11,"1995-12-22",29],[12,"1996-01-20",30]],"1996":[[1,"1996-02-19",29],[2,"1996-03-19",30],[3,"1996-04-18",29],[4,"1996-05-17",30],[5,"1996-06-16",30],[6,"1996-07-16",29],[7,"1996-08-14",30],[8,"1996-09-13",29],[9,"1996-10-12",30],[10,"1996-11-11",30],[11,"1996-12-11",29],[12,"1997-01-09",30]],"1997":[[1,"1997-02-08",29],[2,"1997-03-09",29],[3,"1997-04-07",30],[4,"1997-05-07",29],[5,"1997-06-05",30],[6,"1997-07-05",29],[7,"1997-08-03",30],[8,"1997-09-02",30],[9,"1997-10-02",29],[10,"1997-10-31",30],[11,"1997-11-30",30],[12,"1997-12-30",29]],"1998":[[1,"1998-01-28",30],[2,"1998-02-27",29],[3,"1998-03-28",29],[4,"1998-04-26",30],[5,"1998-05-26",29],[-5,"1998-06-24",29],[6,"1998-07-23",30],[7,"1998-08-22",30],[8,"1998-09-21",29],[9,"1998-10-20",30],[10,"1998-11-19",30],[11,"1998-12-19",30],[12,"1999-01-18",29]],"2001":[[1,"2001-01-24",30],[2,"2001-02-23",30],[3,"2001-03-25",30],[4,"2001-04-24",29],[-4,"2001-05-23",29],[5,"2001-06-21",30],[6,"2001-07-21",29],[7,"2001-08-19",29],[8,"2001-09-17",30],[9,"2001-10-17",29],[10,"2001-11-15",30],[11,"2001-12-15",29],[12,"2002-01-13",30]],"2005":[[1,"2005-02-09",29],[2,"2005-03-10",30],[3,"2005-04-09",29],[4,"2005-05-08",30],[5,"2005-06-07",29],[6,"2005-07-06",30],[7,"2005-08-05",30],[8,"2005-09-04",29],[9,"2005-10-03",30],[10,"2005-11-02",30],[11,"2005-12-02",29],[12,"2005-12-31",29]],"2012":[[1,"2012-01-23",30],[2,"2012-02-22",29],[3,"2012-03-22",30],[-3,"2012-04-21",30],[4,"2012-05-21",30],[5,"2012-06-20",29],[6,"2012-07-19",30],[7,"2012-08-18",29],[8,"2012-09-16",29],[9,"2012-10-15",30],[10,"2012-11-14",29],[11,"2012-12-13",30],[12,"2013-01-12",29]],"2013":[[1,"2013-02-10",30],[2,"2013-03-12",29],[3,"2013-04-10",30],[4,"2013-05-10",30],[5,"2013-06-09",29],[6,"2013-07-08",30],[7,"2013-08-07",29],[8,"2013-09-05",30],[9,"2013-10-05",29],[10,"2013-11-03",30],[11,"2013-12-03",29],[12,"2014-01-01",30]],"2017":[[1,"2017-01-28",29],[2,"2017-02-26",30],[3,"2017-03-28",29],[4,"2017-04-26",30],[5,"2017-05-26",29],[-5,"2017-06-24",29],[6,"2017-07-23",30],[7,"2017-08-22",29],[8,"2017-09-20",30],[9,"2017-10-20",29],[10,"2017-11-18",30],[11,"2017-12-18",30],[12,"2018-01-17",30]],"2019":[[1,"2019-02-05",30],[2,"2019-03-07",29],[3,"2019-04-05",30],[4,"2019-05-05",29],[5,"2019-06-03",30],[6,"2019-07-03",29],[7,"2019-08-01",29],[8,"2019-08-30",30],[9,"2019-09-29",29],[10,"2019-10-28",30],[11,"2019-11-27",29],[12,"2019-12-26",30]],"2020":[[1,"2020-01-25",30],[2,"2020-02-24",29],[3,"2020-03-24",30],[4,"2020-04-23",30],[-4,"2020-05-23",29],[5,"2020-06-21",30],[6,"2020-07-21",29],[7,"2020-08-19",29],[8,"2020-09-17",30],[9,"2020-10-17",29],[10,"2020-11-15",30],[11,"2020-12-15",29],[12,"2021-01-13",30]],"2023":[[1,"2023-01-22",29],[2,"2023-02-20",30],[-2,"2023-03-22",29],[3,"2023-04-20",30],[4,"2023-05-20",29],[5,"2023-06-18",30],[6,"2023-07-18",29],[7,"2023-08-16",30],[8,"2023-09-15",30],[9,"2023-10-15",29],[10,"2023-11-13",30],[11,"2023-12-13",29],[12,"2024-01-11",30]],"2026":[[1,"2026-02-17",30],[2,"2026-03-19",29],[3,"2026-04-17",30],[4,"2026-05-17",29],[5,"2026-06-15",29],[6,"2026-07-14",30],[7,"2026-08-13",29],[8,"2026-09-11",30],[9,"2026-10-11",29],[10,"2026-11-09",30],[11,"2026-12-09",30],[12,"2027-01-08",30]],"2027":[[1,"2027-02-07",29],[2,"2027-03-08",30],[3,"2027-04-07",29],[4,"2027-05-06",30],[5,"2027-06-05",29],[6,"2027-07-04",29],[7,"2027-08-02",30],[8,"2027-09-01",29],[9,"2027-09-30",29],[10,"2027-10-29",30],[11,"2027-11-28",30],[12,"2027-12-28",30]],"2028":[[1,"2028-01-27",29],[2,"2028-02-25",30],[3,"2028-03-26",30],[4,"2028-04-25",29],[5,"2028-05-24",30],[-5,"2028-06-23",29],[6,"2028-07-22",29],[7,"2028-08-20",30],[8,"2028-09-19",29],[9,"2028-10-18",29],[10,"2028-11-16",30],[11,"2028-12-16",30],[12,"2029-01-15",29]],"2029":[[1,"2029-02-13",30],[2,"2029-03-15",30],[3,"2029-04-14",29],[4,"2029-05-13",30],[5,"2029-06-12",30],[6,"2029-07-12",29],[7,"2029-08-10",29],[8,"2029-09-08",30],[9,"2029-10-08",29],[10,"2029-11-06",29],[11,"2029-12-05",30],[12,"2030-01-04",30]],"2031":[[1,"2031-01-23",30],[2,"2031-02-22",29],[3,"2031-03-23",30],[-3,"2031-04-22",29],[4,"2031-05-21",30],[5,"2031-06-20",29],[6,"2031-07-19",30],[7,"2031-08-18",30],[8,"2031-09-17",29],[9,"2031-10-16",30],[10,"2031-11-15",29],[11,"2031-12-14",30],[12,"2032-01-13",29]],"2034":[[1,"2034-02-19",29],[2,"2034-03-20",30],[3,"2034-04-19",29],[4,"2034-05-18",29],[5,"2034-06-16",30],[6,"2034-07-16",29],[7,"2034-08-14",30],[8,"2034-09-13",29],[9,"2034-10-12",30],[10,"2034-11-11",30],[11,"2034-12-11",30],[12,"2035-01-10",29]],"2036":[[1,"2036-01-28",30],[2,"2036-02-27",30],[3,"2036-03-28",29],[4,"2036-04-26",30],[5,"2036-05-26",29],[6,"2036-06-24",29],[-6,"2036-07-23",30],[7,"2036-08-22",29],[8,"2036-09-20",29],[9,"2036-10-19",30],[10,"2036-11-18",30],[11,"2036-12-18",29],[12,"2037-01-16",30]],"2040":[[1,"2040-02-12",30],[2,"2040-03-13",29],[3,"2040-04-11",30],[4,"2040-05-11",30],[5,"2040-06-10",29],[6,"2040-07-09",30],[7,"2040-08-08",30],[8,"2040-09-07",29],[9,"2040-10-06",30],[10,"2040-11-05",29],[11,"2040-12-04",30],[12,"2041-01-03",29]],"2041":[[1,"2041-02-01",30],[2,"2041-03-03",29],[3,"2041-04-01",29],[4,"2041-04-30",30],[5,"2041-05-30",29],[6,"2041-06-28",30],[7,"2041-07-28",30],[8,"2041-08-27",29],[9,"2041-09-25",30],[10,"2041-10-25",30],[11,"2041-11-24",29],[12,"2041-12-23",30]],"2046":[[1,"2046-02-06",30],[2,"2046-03-08",29],[3,"2046-04-06",30],[4,"2046-05-06",30],[5,"2046-06-05",29],[6,"2046-07-04",29],[7,"2046-08-02",30],[8,"2046-09-01",29],[9,"2046-09-30",29],[10,"2046-10-29",30],[11,"2046-11-28",29],[12,"2046-12-27",30]],"2048":[[1,"2048-02-14",29],[2,"2048-03-14",30],[3,"2048-04-13",30],[4,"2048-05-13",29],[5,"2048-06-11",30],[6,"2048-07-11",30],[7,"2048-08-10",29],[8,"2048-09-08",30],[9,"2048-10-08",29],[10,"2048-11-06",30],[11,"2048-12-06",29],[12,"2049-01-04",29]],"2050":[[1,"2050-01-23",30],[2,"2050-02-22",29],[3,"2050-03-23",29],[-3,"2050-04-21",30],[4,"2050-05-21",29],[5,"2050-06-19",30],[6,"2050-07-19",29],[7,"2050-08-17",30],[8,"2050-09-16",30],[9,"2050-10-16",29],[10,"2050-11-14",30],[11,"2050-12-14",30]]};
  var KOREAN_LUNAR_PARTIAL = {"2050": true};
  function koreanLunarFix(y, signedMonth, d) {
    var tab = KOREAN_LUNAR_FIX[y];
    if (!tab) return null;
    for (var i = 0; i < tab.length; i++) {
      if (tab[i][0] !== signedMonth) continue;
      if (!(d >= 1 && d <= tab[i][2])) throw new Error('no such lunar day');
      var s = tab[i][1].split('-'), t = new Date(Date.UTC(+s[0], +s[1] - 1, +s[2] + d - 1));
      return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
    }
    if (KOREAN_LUNAR_PARTIAL[y]) return null;
    throw new Error('no such lunar month');
  }

  function buildChart(input) {
    var solar;
    if (input.caltype === 'solar') {
      solar = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, 0, 0);
    } else {
      var lunarMonth = input.isLeap ? -input.month : input.month;
      var kl = koreanLunarFix(input.year, lunarMonth, input.day);
      if (kl) {
        solar = Solar.fromYmdHms(kl[0], kl[1], kl[2], input.hour, 0, 0);
      } else {
        var lunarDate = Lunar.fromYmd(input.year, lunarMonth, input.day);
        var baseSolar = lunarDate.getSolar();
        solar = Solar.fromYmdHms(baseSolar.getYear(), baseSolar.getMonth(), baseSolar.getDay(), input.hour, 0, 0);
      }
    }
    var ec = solar.getLunar().getEightChar();
    if (typeof ec.setSect === 'function') {
      ec.setSect(1); // 야자시(23~24시) 출생 시 일주를 다음날 기준으로 계산 (saju_engine.js와 동일 정책)
    }

    var yearGan = ec.getYearGan(), yearZhi = ec.getYearZhi();
    var monthGan = ec.getMonthGan(), monthZhi = ec.getMonthZhi();
    var dayGan = ec.getDayGan(), dayZhi = ec.getDayZhi();
    var timeGan = input.timeUnknown ? null : ec.getTimeGan();
    var timeZhi = input.timeUnknown ? null : ec.getTimeZhi();

    var chars = [yearGan, yearZhi, monthGan, monthZhi, dayGan, dayZhi];
    if (!input.timeUnknown) { chars.push(timeGan, timeZhi); }

    var wuxing = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
    chars.forEach(function (c) {
      var el = GAN_ELEMENT[c] || ZHI_ELEMENT[c];
      if (el) { wuxing[el]++; }
    });
    // saju_engine.js와 동일한 정의: 8자(또는 6자) 중 0개인 오행 = 부족
    var lacking = Object.keys(wuxing).filter(function (e) { return wuxing[e] === 0; });

    return {
      timeUnknown: input.timeUnknown,
      pillars: {
        year: yearGan + yearZhi, month: monthGan + monthZhi,
        day: dayGan + dayZhi, time: input.timeUnknown ? null : (timeGan + timeZhi)
      },
      dayGan: dayGan, dayGanKo: GAN_HANJA_KO[dayGan], dayGanElement: GAN_ELEMENT[dayGan],
      dayZhi: dayZhi, dayZhiKo: ZHI_HANJA_KO[dayZhi],
      wuxing: wuxing,
      lacking: lacking
    };
  }

  // ---- 기준 1) 일간(日干) 관계: 상생/상극/동일오행 ----
  function compareDayStem(a, b) {
    var ea = a.dayGanElement, eb = b.dayGanElement;
    var relation, score;
    if (ea === eb) {
      relation = 'same'; score = 70;
    } else if (GENERATES[ea] === eb || GENERATES[eb] === ea) {
      relation = 'sangsaeng'; score = 100;
    } else {
      // 5행 순환 구조상 동일오행/상생이 아니면 남는 조합은 전부 상극 관계
      relation = 'sanggeuk'; score = 40;
    }
    return {
      relation: relation, score: score, aElement: ea, bElement: eb,
      aGan: a.dayGanKo, bGan: b.dayGanKo,
      aGanHanja: a.dayGan, bGanHanja: b.dayGan
    };
  }

  // ---- 기준 2) 오행 균형 비교: 한쪽이 부족한 오행을 다른 쪽이 채워주는가 ----
  function compareBalance(a, b) {
    var filled = [];
    a.lacking.forEach(function (e) { if (b.wuxing[e] > 0) { filled.push({ filledFor: 'A', element: e }); } });
    b.lacking.forEach(function (e) { if (a.wuxing[e] > 0) { filled.push({ filledFor: 'B', element: e }); } });
    var totalLacking = a.lacking.length + b.lacking.length;
    // 부족한 오행이 둘 다 없으면(이미 균형) 채워줄 필요 자체가 없는 중립적으로 좋은 상태로 취급
    var score = totalLacking === 0 ? 80 : Math.round(filled.length / totalLacking * 100);
    return { score: score, aLacking: a.lacking, bLacking: b.lacking, filled: filled };
  }

  // ---- 기준 3) 일지(日支) 육합 여부 ----
  function compareZhiHap(a, b) {
    var key = a.dayZhi + b.dayZhi;
    var element = LIUHE[key] || null;
    var matched = !!element;
    return {
      matched: matched,
      score: matched ? 100 : 40,
      aZhi: a.dayZhi, bZhi: b.dayZhi,
      resultElement: element,
      noTransform: matched && !!LIUHE_NO_TRANSFORM[key]
    };
  }

  // v1: 세 기준 균등 배분(각 1/3). 정확한 가중치는 추후 조정.
  function computeCompatibility(a, b) {
    var dayStem = compareDayStem(a, b);
    var balance = compareBalance(a, b);
    var zhiHap = compareZhiHap(a, b);
    var score = Math.round((dayStem.score + balance.score + zhiHap.score) / 3);
    return {
      score: score,
      grade: gradeOf(score),
      // 왜 이 점수가 나왔는지에 대한 계산 근거 - 리포트/디버깅에서 재사용
      reasons: { dayStem: dayStem, balance: balance, zhiHap: zhiHap }
    };
  }

  // ================= UI =================
  function personFormHtml(id, labelKo, labelEn) {
    return (
      '<div class="scw-compat-person">' +
        '<div class="scw-field-label"><span class="scw-en">' + labelEn + '</span><span class="scw-ko"> · ' + labelKo + '</span></div>' +
        '<div class="scw-row">' +
          '<label><input type="radio" name="scw-compat-' + id + '-caltype" value="solar" checked> ' + COMPAT_UI.solar + '</label>' +
          '<label><input type="radio" name="scw-compat-' + id + '-caltype" value="lunar"> ' + COMPAT_UI.lunar + '</label>' +
          '<label id="scw-compat-' + id + '-leap-wrap" style="display:none;"><input type="checkbox" id="scw-compat-' + id + '-leap"> ' + COMPAT_UI.leapMonth + '</label>' +
        '</div>' +
        '<div class="scw-row">' +
          (LANG === 'en' ?
            COMPAT_UI.year + ' <select id="scw-compat-' + id + '-year"></select> ' +
            COMPAT_UI.month + ' <select id="scw-compat-' + id + '-month"></select> ' +
            COMPAT_UI.day + ' <select id="scw-compat-' + id + '-day"></select>'
          :
            '<select id="scw-compat-' + id + '-year"></select>년 ' +
            '<select id="scw-compat-' + id + '-month"></select>월 ' +
            '<select id="scw-compat-' + id + '-day"></select>일'
          ) +
        '</div>' +
        '<div class="scw-row">' +
          '<select id="scw-compat-' + id + '-hour"></select>' +
          '<label><input type="checkbox" id="scw-compat-' + id + '-hour-unknown"> ' + COMPAT_UI.hourUnknown + '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function populateDateSelects(id) {
    var yearSel = $('#scw-compat-' + id + '-year'), monthSel = $('#scw-compat-' + id + '-month'),
      daySel = $('#scw-compat-' + id + '-day'), hourSel = $('#scw-compat-' + id + '-hour');
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

    $('#scw-compat-' + id + '-hour-unknown').addEventListener('change', function () {
      hourSel.disabled = this.checked;
    });
    var radios = root.querySelectorAll('input[name="scw-compat-' + id + '-caltype"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () {
        var checked = root.querySelector('input[name="scw-compat-' + id + '-caltype"]:checked');
        $('#scw-compat-' + id + '-leap-wrap').style.display = (checked && checked.value === 'lunar') ? '' : 'none';
      });
    }
  }

  function readPersonInput(id) {
    var caltype = root.querySelector('input[name="scw-compat-' + id + '-caltype"]:checked').value;
    var timeUnknown = $('#scw-compat-' + id + '-hour-unknown').checked;
    return {
      caltype: caltype,
      year: parseInt($('#scw-compat-' + id + '-year').value, 10),
      month: parseInt($('#scw-compat-' + id + '-month').value, 10),
      day: parseInt($('#scw-compat-' + id + '-day').value, 10),
      isLeap: $('#scw-compat-' + id + '-leap').checked,
      timeUnknown: timeUnknown,
      hour: timeUnknown ? 12 : parseInt($('#scw-compat-' + id + '-hour').value, 10)
    };
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

  function zhiHapBasisKo(zhiHap) {
    var aKo = ZHI_HANJA_KO[zhiHap.aZhi], bKo = ZHI_HANJA_KO[zhiHap.bZhi];
    if (!zhiHap.matched) {
      return '일지 ' + aKo + '(' + zhiHap.aZhi + ')' + ' · ' + bKo + '(' + zhiHap.bZhi + ')' + ' — 육합 관계 없음';
    }
    var tail = zhiHap.noTransform ? ' → 변환 없이 ' + ELEMENT_KO[zhiHap.resultElement] + ' 기운 강화' : ' → ' + ELEMENT_KO[zhiHap.resultElement] + ' 기운';
    return '일지 ' + aKo + '(' + zhiHap.aZhi + ')' + '+' + bKo + '(' + zhiHap.bZhi + ')' + ' 육합' + tail;
  }
  function dayStemBasisKo(dayStem) {
    var relLabel = dayStem.relation === 'sangsaeng' ? '상생' : dayStem.relation === 'sanggeuk' ? '상극' : '동일오행(비겁)';
    return '일간 ' + dayStem.aGan + '(' + ELEMENT_KO[dayStem.aElement] + ') · ' + dayStem.bGan + '(' + ELEMENT_KO[dayStem.bElement] + ') — ' + relLabel + ' 관계';
  }
  function balanceBasisKo(balance) {
    if (!balance.aLacking.length && !balance.bLacking.length) {
      return '두 사람 모두 오행 결핍 없음 — 서로 채워줄 필요가 적은 안정적 조합';
    }
    var parts = [];
    if (balance.aLacking.length) parts.push('A 부족: ' + balance.aLacking.map(function (e) { return ELEMENT_KO[e]; }).join(',' ));
    if (balance.bLacking.length) parts.push('B 부족: ' + balance.bLacking.map(function (e) { return ELEMENT_KO[e]; }).join(','));
    parts.push('상호 보완: ' + balance.filled.length + '/' + (balance.aLacking.length + balance.bLacking.length));
    return parts.join(' / ');
  }

  // ---- (basis) 라인 영문판 — "(basis)" 자동 계산 근거 텍스트도 LANG=en일 때 한글이 섞이지 않도록 ----
  function zhiHapBasisEn(zhiHap) {
    if (!zhiHap.matched) {
      return 'Day Branches ' + ZHI_EN[zhiHap.aZhi] + ' · ' + ZHI_EN[zhiHap.bZhi] + ' — no Six Harmony';
    }
    var tail = zhiHap.noTransform
      ? ' → reinforces ' + ELEMENT_EN[zhiHap.resultElement] + ' energy without transformation'
      : ' → ' + ELEMENT_EN[zhiHap.resultElement] + ' energy';
    return 'Day Branches ' + ZHI_EN[zhiHap.aZhi] + ' + ' + ZHI_EN[zhiHap.bZhi] + ' Six Harmony' + tail;
  }
  function dayStemBasisEn(dayStem) {
    var relLabel = dayStem.relation === 'sangsaeng' ? 'Generating' : dayStem.relation === 'sanggeuk' ? 'Controlling' : 'Same Element (Companion)';
    return 'Day Master ' + GAN_EN[dayStem.aGanHanja] + ' · ' + GAN_EN[dayStem.bGanHanja] + ' — ' + relLabel + ' relationship';
  }
  function balanceBasisEn(balance) {
    if (!balance.aLacking.length && !balance.bLacking.length) {
      return 'Neither of you has an elemental deficiency — a stable pairing that needs little filling in.';
    }
    var parts = [];
    if (balance.aLacking.length) parts.push('A lacks: ' + balance.aLacking.map(function (e) { return ELEMENT_EN[e]; }).join(', '));
    if (balance.bLacking.length) parts.push('B lacks: ' + balance.bLacking.map(function (e) { return ELEMENT_EN[e]; }).join(', '));
    parts.push('Mutual fill-in: ' + balance.filled.length + '/' + (balance.aLacking.length + balance.bLacking.length));
    return parts.join(' / ');
  }

  var compatTextsPromise = null;
  function loadCompatTexts() {
    if (!compatTextsPromise) {
      compatTextsPromise = fetch(COMPAT_TEXT_URL).then(function (res) { return res.json(); });
    }
    return compatTextsPromise;
  }


  var EL_MEAN = { '목': 'starting things', '화': 'expression and warmth', '토': 'steadiness and trust', '금': 'clear boundaries', '수': 'going with change' };
  var HEAD5 = {
    aFeeds: ["You're probably the one who gives more.", "Your {A} feeds their {B}, so the giving tends to run from you to them. You may be the planner, the fixer.", 'Ask "what do you need this week?" before offering anything.'],
    bFeeds: ["They're probably the one who gives more.", "Their {B} feeds your {A}, so support tends to flow from them to you. They may be the one who notices first.", "Name one thing they did for you this week, out loud."],
    aChecks: ["You may be the one who sets the pace.", "Your {A} checks their {B}, so you tend to steer and they tend to adjust. That pull can sharpen you both when it's done gently.", "Before you correct something this week, ask how they'd do it first."],
    bChecks: ["They may be the one who sets the pace.", "Their {B} checks your {A}, so they tend to steer and you tend to adjust. That pull can sharpen you both when it feels fair.", "Say one thing this week that you'd like to decide yourself."],
    same: ["You two see the world from the same side.", "You share the same element, {A}, so you understand each other quickly. You may also share the same blind spots.", "Before one shared decision this week, ask for a third person's view."]
  };
  function headKey(ds) {
    var a = ds.aElement, b = ds.bElement;
    if (a === b) return 'same';
    if (GENERATES[a] === b) return 'aFeeds';
    if (GENERATES[b] === a) return 'bFeeds';
    if (CONTROLS[a] === b) return 'aChecks';
    return 'bChecks';
  }
  function checkHtml(ok, title, body, basis) {
    return '<div class="kc-check"><div class="kc-check-t"><span class="kc-mark" aria-hidden="true">' + (ok ? '✓' : '!') + '</span>' + title + '</div>' +
      '<p class="kc-check-b">' + body + '</p>' +
      '<details class="kc-why"><summary>Why we say this</summary><p>' + basis + '</p></details></div>';
  }
  function renderReportEnV2(result, relType, texts) {
    var ds = result.reasons.dayStem, bal = result.reasons.balance, zh = result.reasons.zhiHap;
    var h = HEAD5[headKey(ds)], A = ELEMENT_EN[ds.aElement], B = ELEMENT_EN[ds.bElement];
    var REL = { lover: 'Romantic partners', friend: 'Friends', business: 'Business partners' };
    var VERB = { aFeeds: 'feeds', bFeeds: 'is fed by', aChecks: 'checks', bChecks: 'is checked by', same: 'shares an element with' }[headKey(ds)];
    var html = '<div class="kc-head"><p class="kc-kicker">' + (REL[relType] || 'Your pair') + ' · your reading</p><p class="kc-head-1">' + h[0] + '</p><p class="kc-head-2">' + h[1].replace(/\{A\}/g, A).replace(/\{B\}/g, B) + '</p>' +
      '<p class="kc-pair"><span class="kc-el">' + GAN_EN[ds.aGanHanja] + '</span> ' + VERB + ' <span class="kc-el">' + GAN_EN[ds.bGanHanja] + '</span></p>' +
      '<p class="kc-try"><b>Try this week:</b> ' + h[2] + '</p></div>';
    var c1;
    if (ds.relation === 'same') c1 = checkHtml(true, 'You share the same element', 'You both carry ' + A + ', so you tend to read each other quickly.', dayStemBasisEn(ds));
    else if (ds.relation === 'sangsaeng') c1 = checkHtml(true, 'One of you supports the other', (GENERATES[ds.aElement] === ds.bElement ? A + ' feeds ' + B : B + ' feeds ' + A) + '. This usually shows up as one partner instinctively backing the other\'s growth.', dayStemBasisEn(ds));
    else c1 = checkHtml(false, 'One of you tends to steer', (CONTROLS[ds.aElement] === ds.bElement ? A + ' checks ' + B : B + ' checks ' + A) + '. That can bring some friction, and it can also sharpen you both.', dayStemBasisEn(ds));
    var shared = bal.aLacking.filter(function (e) { return bal.bLacking.indexOf(e) !== -1; });
    var any = bal.aLacking.concat(bal.bLacking.filter(function (e) { return bal.aLacking.indexOf(e) === -1; }));
    var c2;
    if (!any.length) c2 = checkHtml(true, 'Neither of you runs short on an element', 'Both charts hold all five elements, so there is little for either of you to fill in.', balanceBasisEn(bal));
    else if (shared.length) c2 = checkHtml(false, 'You both run short on ' + shared.map(function (e) { return ELEMENT_EN[e]; }).join(' and '), shared.map(function (e) { return ELEMENT_EN[e] + ' is the energy of ' + EL_MEAN[e] + '.'; }).join(' ') + ' With neither of you holding much of it, that side may need a deliberate push from both of you.', balanceBasisEn(bal));
    else c2 = checkHtml(true, 'You fill in each other\'s gaps', any.map(function (e) { return ELEMENT_EN[e]; }).join(' and ') + ' runs short in one chart and shows up in the other, so one of you can bring what the other lacks.', balanceBasisEn(bal));
    var c3 = zh.matched
      ? checkHtml(true, 'Your day branches pair up', texts.liuhe_bonus.en, zhiHapBasisEn(zh))
      : checkHtml(false, 'Your day branches don\'t pair up', ZHI_EN[zh.aZhi] + ' and ' + ZHI_EN[zh.bZhi] + ' are not one of the Six Harmonies, so the easy day-to-day click may take practice.', zhiHapBasisEn(zh));
    html += '<div class="kc-checks">' + c1 + c2 + c3 + '</div>';
    html += '<p class="kc-score"><span class="kc-score-n">' + result.score + ' / 100</span> Three checks added up. The score can\'t see kindness, effort or timing.</p>';
    html += '<p class="kc-foot">This reading is a reference point from a traditional Korean practice, not a verdict on your relationship. It can\'t replace talking with each other or a qualified counselor.</p>';
    return html;
  }
  function renderReport(result, relType, texts) {
    if (LANG === 'en') return renderReportEnV2(result, relType, texts);
    var overviewText = texts.overview_by_grade[result.grade];
    var summaryLine = {
      en: result.score + ' points, Grade ' + result.grade + ' — ' + overviewText.en,
      ko: result.score + '점, ' + result.grade + '등급 — ' + overviewText.ko
    };

    var daystemText = texts.daystem_point_by_relation[result.reasons.dayStem.relation];

    // 부족한 오행(A∪B, 중복 제거)마다 문구를 이어붙인다. 아무도 부족한 오행이 없으면 기존 플레이스홀더로 대체.
    var lackingElements = result.reasons.balance.aLacking.concat(
      result.reasons.balance.bLacking.filter(function (e) { return result.reasons.balance.aLacking.indexOf(e) === -1; })
    );
    var wuxingText = lackingElements.length
      ? {
          en: lackingElements.map(function (e) { return texts.wuxing_point_by_element[e].en; }).join(' '),
          ko: lackingElements.map(function (e) { return texts.wuxing_point_by_element[e].ko; }).join(' ')
        }
      : texts.wuxing_point_placeholder;

    var overview = [summaryLine];
    var point = [
      { en: wuxingText.en, ko: wuxingText.ko },
      { en: '(basis) ' + balanceBasisEn(result.reasons.balance), ko: '(계산 근거) ' + balanceBasisKo(result.reasons.balance) },
      { en: '(basis) ' + zhiHapBasisEn(result.reasons.zhiHap), ko: '(계산 근거) ' + zhiHapBasisKo(result.reasons.zhiHap) }
    ];
    if (result.reasons.zhiHap.matched) {
      point.push({ en: texts.liuhe_bonus.en, ko: texts.liuhe_bonus.ko });
    }
    point.push(
      { en: daystemText.en, ko: daystemText.ko },
      { en: '(basis) ' + dayStemBasisEn(result.reasons.dayStem), ko: '(계산 근거) ' + dayStemBasisKo(result.reasons.dayStem) }
    );
    var boost = [texts.relationship_boost[relType]];

    return sectionHtml('Overview', '총운풀이', overview) +
      sectionHtml('Point', '포인트', point) +
      sectionHtml('Grow the Relationship', '관계 발전시키는 법', boost) +
      paraHtml([texts.disclaimer]);
  }

  function showError(msg) {
    $('#scw-compat-error').textContent = msg;
    $('#scw-compat-result').style.display = 'none';
  }

  // ================= DOM 삽입 (기존 위젯 HTML은 건드리지 않고 JS로 섹션을 붙인다) =================
  var style = document.createElement('style');
  style.textContent =
    '.saju-calc-widget .scw-compat-toggle { margin-top: 22px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; }' +
    '.saju-calc-widget .scw-compat-icon { width: 32px; height: 32px; flex: none; opacity: .92; }' +
    '.saju-calc-widget .scw-compat-panel { margin-top: 18px; border: 1px solid var(--scw-border); border-radius: 2px; padding: 18px 16px; }' +
    '.saju-calc-widget .scw-compat-person { border-top: 1px solid var(--scw-border); padding-top: 14px; margin-top: 14px; }' +
    '.saju-calc-widget .scw-compat-person:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }' +
    '.saju-calc-widget .scw-compat-reltype-row select { background: transparent; color: var(--scw-fg); border: 1px solid var(--scw-border); border-radius: 2px; padding: 6px 8px; }' +
    '.saju-calc-widget .scw-compat-score { font-family: Georgia, "Times New Roman", serif; font-size: 2.2em; color: var(--scw-gold); text-align: center; margin-bottom: 4px; }' +
    '.saju-calc-widget .scw-compat-grade { text-align: center; font-size: .8em; letter-spacing: .12em; text-transform: uppercase; color: var(--scw-muted); margin-bottom: 18px; }' +
    '.saju-calc-widget .kc-head{margin:0 0 18px;border:1px solid #6b5630;border-radius:14px;padding:16px}.saju-calc-widget .kc-kicker{margin:0 0 8px;font-size:.78em;letter-spacing:.12em;text-transform:uppercase;color:var(--scw-muted)}.saju-calc-widget .kc-head-1{font-family:Georgia,"Times New Roman",serif;font-size:26px;line-height:1.3;color:var(--scw-gold);margin:0 0 10px}.saju-calc-widget .kc-pair{margin:0 0 10px;font-size:.92em;color:var(--scw-muted)}.saju-calc-widget .kc-el{display:inline-block;border:1px solid #6b5630;border-radius:999px;padding:2px 10px;color:var(--scw-fg)}' +
    '.saju-calc-widget .kc-head-2{margin:0 0 10px}.saju-calc-widget .kc-try{margin:0;padding:10px 12px;border-left:3px solid var(--scw-gold)}' +
    '.saju-calc-widget .kc-checks{display:grid;gap:10px;margin:0 0 16px}.saju-calc-widget .kc-check{border:1px solid var(--scw-border);border-radius:8px;padding:12px 14px}' +
    '.saju-calc-widget .kc-check-t{font-weight:700;display:flex;gap:8px;align-items:baseline}.saju-calc-widget .kc-mark{color:var(--scw-gold);min-width:1em}.saju-calc-widget .kc-check-b{margin:6px 0 4px}' +
    '.saju-calc-widget .kc-why>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--scw-gold)}.saju-calc-widget .kc-why p{margin:0 0 6px;font-size:.92em;color:var(--scw-muted)}' +
    '.saju-calc-widget .kc-score{font-size:.92em;color:var(--scw-muted);margin:0 0 16px}.saju-calc-widget .kc-score-n{font-family:Georgia,serif;color:var(--scw-gold);margin-right:6px}.saju-calc-widget .kc-foot{font-size:.9em;color:var(--scw-muted);margin:16px 0 0}' +
    '.saju-calc-widget[data-lang="en"] #scw-compat-score,.saju-calc-widget[data-lang="en"] #scw-compat-grade{display:none}';
  document.head.appendChild(style);

  var section = document.createElement('div');
  section.className = 'scw-compat-section';
  section.innerHTML =
    '<button type="button" class="scw-submit scw-compat-toggle" id="scw-compat-toggle">' +
      '<img class="scw-compat-icon" src="' + IMG_BASE + 'compat_icon.png" alt="Mandarin ducks symbolizing couple compatibility in Korean tradition" loading="lazy">' +
      '<span class="scw-en">Compatibility</span><span class="scw-ko"> · 궁합 보기</span>' +
    '</button>' +
    '<div class="scw-compat-panel" id="scw-compat-panel" style="display:none;">' +
      '<h3><span class="scw-h-en">Compatibility</span><span class="scw-h-ko">궁합 보기</span></h3>' +
      personFormHtml('a', '첫 번째 사람', 'Person A') +
      personFormHtml('b', '두 번째 사람', 'Person B') +
      '<div class="scw-row scw-compat-reltype-row">' +
        '<label for="scw-compat-reltype">' + COMPAT_UI.reltypeLabel + '</label>' +
        '<select id="scw-compat-reltype">' +
        RELATIONSHIP_TYPES.map(function (r) { return '<option value="' + r.key + '">' + r[LANG] + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<div class="scw-row"><button type="button" class="scw-submit" id="scw-compat-submit">' + COMPAT_UI.submit + '</button></div>' +
      '<div class="scw-error" id="scw-compat-error"></div>' +
      '<div class="scw-compat-result" id="scw-compat-result" style="display:none;">' +
        '<div class="scw-compat-score" id="scw-compat-score"></div>' +
        '<div class="scw-compat-grade" id="scw-compat-grade"></div>' +
        '<div id="scw-compat-report-body"></div>' +
      '</div>' +
    '</div>';
  root.appendChild(section);

  populateDateSelects('a');
  populateDateSelects('b');

  $('#scw-compat-toggle').addEventListener('click', function () {
    var panel = $('#scw-compat-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  $('#scw-compat-submit').addEventListener('click', function () {
    $('#scw-compat-error').textContent = '';
    var relType = $('#scw-compat-reltype').value;
    var result;
    try {
      var a = buildChart(readPersonInput('a'));
      var b = buildChart(readPersonInput('b'));
      result = computeCompatibility(a, b);
    } catch (err) {
      showError(LANG === 'en'
        ? 'Could not calculate this date. If you entered a lunar date, please double-check that day actually exists in that month (and the leap-month setting).'
        : '입력하신 날짜를 계산할 수 없습니다. 음력 날짜의 경우 해당 월에 실제로 존재하는 날짜(또는 윤달 여부)인지 다시 확인해주세요.');
      return;
    }

    loadCompatTexts().then(function (texts) {
      $('#scw-compat-score').textContent = result.score;
      $('#scw-compat-grade').textContent = LANG === 'en' ? ('Grade ' + result.grade) : (result.grade + ' 등급');
      $('#scw-compat-report-body').innerHTML = renderReport(result, relType, texts);
      $('#scw-compat-result').style.display = 'block';
    }).catch(function () {
      showError(LANG === 'en'
        ? 'Could not load the report text. Please check your connection and try again.'
        : '리포트 문구를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.');
    });
  });
})();
