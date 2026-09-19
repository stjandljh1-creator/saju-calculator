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
    birthplace: 'Birth City', submit: 'Calculate Compatibility'
  } : {
    solar: '양력', lunar: '음력',
    birthplace: '출생지', submit: '궁합 계산하기'
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
  function buildChart(input) {
    var solar;
    if (input.caltype === 'solar') {
      solar = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, 0, 0);
    } else {
      var lunarMonth = input.isLeap ? -input.month : input.month;
      var lunarDate = Lunar.fromYmd(input.year, lunarMonth, input.day);
      var baseSolar = lunarDate.getSolar();
      solar = Solar.fromYmdHms(baseSolar.getYear(), baseSolar.getMonth(), baseSolar.getDay(), input.hour, 0, 0);
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
      birthplace: input.birthplace || '',
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
    return { relation: relation, score: score, aElement: ea, bElement: eb, aGan: a.dayGanKo, bGan: b.dayGanKo };
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
          '<label id="scw-compat-' + id + '-leap-wrap" style="display:none;"><input type="checkbox" id="scw-compat-' + id + '-leap"> 윤달</label>' +
        '</div>' +
        '<div class="scw-row">' +
          '<select id="scw-compat-' + id + '-year"></select>년 ' +
          '<select id="scw-compat-' + id + '-month"></select>월 ' +
          '<select id="scw-compat-' + id + '-day"></select>일' +
        '</div>' +
        '<div class="scw-row">' +
          '<select id="scw-compat-' + id + '-hour"></select>' +
          '<label><input type="checkbox" id="scw-compat-' + id + '-hour-unknown"> 시간 모름</label>' +
        '</div>' +
        '<div class="scw-row">' +
          '<label for="scw-compat-' + id + '-place">' + COMPAT_UI.birthplace + '</label>' +
          '<input type="text" id="scw-compat-' + id + '-place" class="scw-compat-place" placeholder="예: 서울">' +
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
      hour: timeUnknown ? 12 : parseInt($('#scw-compat-' + id + '-hour').value, 10),
      birthplace: $('#scw-compat-' + id + '-place').value.trim()
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

  var compatTextsPromise = null;
  function loadCompatTexts() {
    if (!compatTextsPromise) {
      compatTextsPromise = fetch(COMPAT_TEXT_URL).then(function (res) { return res.json(); });
    }
    return compatTextsPromise;
  }

  function renderReport(result, relType, texts) {
    var overviewText = texts.overview_by_grade[result.grade];
    var summaryLine = {
      en: result.score + ' points, Grade ' + result.grade + ' — ' + overviewText.en,
      ko: result.score + '점, ' + result.grade + '등급 — ' + overviewText.ko
    };

    var daystemText = texts.daystem_point_by_relation[result.reasons.dayStem.relation];

    var overview = [summaryLine];
    var point = [
      { en: texts.wuxing_point_placeholder.en, ko: texts.wuxing_point_placeholder.ko },
      { en: '(basis) ' + balanceBasisKo(result.reasons.balance), ko: '(계산 근거) ' + balanceBasisKo(result.reasons.balance) },
      { en: '(basis) ' + zhiHapBasisKo(result.reasons.zhiHap), ko: '(계산 근거) ' + zhiHapBasisKo(result.reasons.zhiHap) }
    ];
    if (result.reasons.zhiHap.matched) {
      point.push({ en: texts.liuhe_bonus.en, ko: texts.liuhe_bonus.ko });
    }
    point.push(
      { en: daystemText.en, ko: daystemText.ko },
      { en: '(basis) ' + dayStemBasisKo(result.reasons.dayStem), ko: '(계산 근거) ' + dayStemBasisKo(result.reasons.dayStem) }
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
    '.saju-calc-widget .scw-compat-toggle { margin-top: 22px; width: 100%; }' +
    '.saju-calc-widget .scw-compat-panel { margin-top: 18px; border: 1px solid var(--scw-border); border-radius: 2px; padding: 18px 16px; }' +
    '.saju-calc-widget .scw-compat-person { border-top: 1px solid var(--scw-border); padding-top: 14px; margin-top: 14px; }' +
    '.saju-calc-widget .scw-compat-person:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }' +
    '.saju-calc-widget select.scw-compat-place, .saju-calc-widget input.scw-compat-place { background: transparent; color: var(--scw-fg); border: 1px solid var(--scw-border); border-radius: 2px; padding: 6px 8px; font-size: .9em; }' +
    '.saju-calc-widget .scw-compat-reltype-row select { background: transparent; color: var(--scw-fg); border: 1px solid var(--scw-border); border-radius: 2px; padding: 6px 8px; }' +
    '.saju-calc-widget .scw-compat-score { font-family: Georgia, "Times New Roman", serif; font-size: 2.2em; color: var(--scw-gold); text-align: center; margin-bottom: 4px; }' +
    '.saju-calc-widget .scw-compat-grade { text-align: center; font-size: .8em; letter-spacing: .12em; text-transform: uppercase; color: var(--scw-muted); margin-bottom: 18px; }';
  document.head.appendChild(style);

  var section = document.createElement('div');
  section.className = 'scw-compat-section';
  section.innerHTML =
    '<button type="button" class="scw-submit scw-compat-toggle" id="scw-compat-toggle"><span class="scw-en">Compatibility</span><span class="scw-ko"> · 궁합 보기</span></button>' +
    '<div class="scw-compat-panel" id="scw-compat-panel" style="display:none;">' +
      '<h3><span class="scw-h-en">Compatibility</span><span class="scw-h-ko">궁합 보기</span></h3>' +
      personFormHtml('a', '첫 번째 사람', 'Person A') +
      personFormHtml('b', '두 번째 사람', 'Person B') +
      '<div class="scw-row scw-compat-reltype-row">' +
        '<label for="scw-compat-reltype">관계 유형</label>' +
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
