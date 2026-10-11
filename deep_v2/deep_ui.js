/* K Saju deep reading screen (test build, night 1 + evaluation fixes of 2026-10-02 night + day 2 of 2026-10-03: all 11 cards connected).
 * Reads the calculator result, builds the 11 collapsible cards.
 * No network, no AI call, no storage: everything is computed in the page. */
(function () {
  'use strict';
  var E = window.KDeepEngine, NM = window.KNames;

  // Card list in screen order. sec = section number inside the engine (null = not written yet).
  var CARDS = [
    { key: 'overview', no: 1, en: 'Lifetime Overview', ko: '총운', sec: 1, ready: true },
    { key: 'personality', no: 2, en: 'Personality & Natural Energy', ko: '성격·타고난 기운', sec: 2, ready: true },
    { key: 'early', no: 3, en: 'Early Years', ko: '초년운', sec: 5, ready: true },
    { key: 'middle', no: 4, en: 'Middle Years', ko: '중년운', sec: 6, ready: true },
    { key: 'later', no: 5, en: 'Later Years', ko: '말년운', sec: 7, ready: true },
    { key: 'luck', no: 6, en: 'Your 10-Year Cycles', ko: '대운', sec: 4, ready: true },
    { key: 'work', no: 7, en: 'Work & Money', ko: '일·재물', sec: 9, ready: true, minorEn: 'School & Interests', minorKo: '학교·관심사' },
    { key: 'love', no: 8, en: 'Love & Relationships', ko: '사랑·관계', sec: 8, ready: true, minorEn: 'Friends & Family', minorKo: '친구·가족' },
    { key: 'habits', no: 9, en: 'Daily Habits', ko: '건강 습관', sec: 12, ready: true },
    { key: 'caution', no: 10, en: 'Little Reminders', ko: '기억해 두면 좋은 것', sec: 10, ready: true },
    { key: 'year', no: 11, en: "This Year's Flow", ko: '올해 흐름', sec: 3, ready: true }
  ];

  // Season-change months (earth months): chip text
  var CUSP_CHIP = { '辰': ['the final month of spring, leading into summer', '봄의 마지막 달, 여름으로 이어지는 환절기'], '未': ['the final month of summer, leading into autumn', '여름의 마지막 달, 가을로 이어지는 환절기'], '戌': ['the final month of autumn, leading into winter', '가을의 마지막 달, 겨울로 이어지는 환절기'], '丑': ['the final month of winter, leading into spring', '겨울의 마지막 달, 봄으로 이어지는 환절기'] };
  var GOD_ORDER = ['bigyeon', 'geopjae', 'siksin', 'sanggwan', 'pyeonjae', 'jeongjae', 'pyeongwan', 'jeonggwan', 'pyeonin', 'jeongin'];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function rec(r) { return '<p class="dr-en">' + esc(r.en) + '</p><p class="dr-ko">' + esc(r.ko) + '</p>'; }
  function step(en, ko, recs) {
    if (!recs || !recs.length) return '';
    return '<div class="dr-step"><div class="dr-step-h">' + en + '<span class="dr-ko"> · ' + ko + '</span></div>' + recs.map(rec).join('') + '</div>';
  }
  function why(recs) {
    if (!recs || !recs.length) return '';
    return '<details class="dr-why"><summary>Why we say this<span class="dr-ko"> · 근거</span></summary>' +
      recs.map(function (r) { return '<p class="dr-en">' + esc(r.en.replace(/^Why we say this: /, '')) + '</p><p class="dr-ko">' + esc(r.ko.replace(/^근거: /, '')) + '</p>'; }).join('') + '</details>';
  }
  function chip(t, cls) { return '<span class="dr-chip ' + (cls || '') + '">' + t + '</span>'; }
  // Notice box at the top of a card (the "our own scoring" sentence goes here, before any mark is shown)
  function noticeBox(r) { return r ? '<div class="dr-notice dr-notice-in"><p class="dr-en">' + esc(r.en) + '</p><p class="dr-ko">' + esc(r.ko) + '</p></div>' : ''; }

  // One line above the timeline: what the two kinds of marks look at
  function marksNote() {
    return '<p class="dr-en dr-marks-note">Most active looks only at the next 30 years. Highest of all decades looks at your whole life, so it can point to a past or far-off decade.' +
      '<span class="dr-ko"> · ‘앞으로 30년 중 힘이 큰 시기’는 앞으로 30년만 보고, ‘평생 대운 중 점수 최고’는 평생을 보기 때문에 지나간 시기나 먼 훗날의 10년을 가리킬 수도 있어요.</span></p>';
  }

  function timelineHtml(tl, ch, L) {
    var dirEn = tl.dir === 'forward' ? 'Forward' : 'Backward', dirKo = tl.dir === 'forward' ? '순행' : '역행';
    var startEn = tl.startAge === 0 ? 'starts at birth' : 'starts at about age ' + tl.startAge;
    var h = '<div class="dr-tl"><div class="dr-tl-h">' + (ch.dy.mode === 'both' ? dirEn + ' cycles <span class="dr-ko">· ' + dirKo + ' 대운</span> · ' : '') + startEn + '</div>';
    var preEnd = Math.max(tl.startAge - 1, 0);
    if (tl.startAge > 0) h += '<div class="dr-row' + (tl.now === 0 && ch.age < tl.startAge ? ' is-now' : '') + '"><div class="dr-age">0–' + preEnd + '</div><div class="dr-main"><b>Before the first cycle</b>' +
      '<span class="dr-sub">shaped by your birth month (' + esc(NM.pillarName(ch.pillars.month)) + ')</span></div>' + (tl.now === 0 && ch.age < tl.startAge ? chip('Now', 'now') : '') + '</div>';
    tl.cycles.forEach(function (c) {
      var isNow = c.k === tl.now, best = tl.best.indexOf(c.k) >= 0, grow = tl.grow.indexOf(c.k) >= 0, top = (tl.top || []).indexOf(c.k) >= 0 && !best;
      // our own scoring is named on the mark itself; Korean shown beside it
      var marks = (isNow ? chip('Now', 'now') : '') +
        (best ? chip('Most active in the next 30 years (our score)<span class="dr-ko"> · 앞으로 30년 중 힘이 큰 시기(자체 채점)</span>', 'best') : '') +
        (grow ? chip('Growing (our score)<span class="dr-ko"> · 자체 채점: 자라는 시기</span>', 'grow') : '') +
        (top ? chip('Highest of all decades (our score)<span class="dr-ko"> · 평생 대운 중 점수 최고(자체 채점)</span>', 'top') : '');
      // the stem-branch characters appear only with the Korean view (English view has no Chinese characters)
      h += '<div class="dr-row' + (isNow ? ' is-now' : '') + '"><div class="dr-age">' + c.ageStart + '–' + c.ageEnd + '<span class="dr-yrs">' + c.yearStart + '–' + c.yearEnd + '</span></div>' +
        '<div class="dr-main"><b>' + esc(NM.pillarName(c.gz)) + '</b><span class="dr-han dr-ko">' + c.gz + '</span>' +
        '<span class="dr-sub">Theme: ' + esc(E.GOD_PLAIN[c.god]) + '</span></div>' + (marks ? '<div class="dr-marks">' + marks + '</div>' : '') + '</div>';
    });
    return h + '</div>';
  }

  // Early / Middle / Later age bands, split at the 10-year-cycle change ages nearest 30 and 60 (engine sections 5-7)
  function bandsHtml(R) {
    var ch = R.chart, items = [['early', 'Early years', '초년', 5], ['middle', 'Middle years', '중년', 6], ['later', 'Later years', '말년', 7]];
    var cells = items.map(function (it) {
      var s = R.sections.filter(function (x) { return x.no === it[3]; })[0];
      if (!s || !s.stage) return '';
      var r = s.stage.range, here = ch.age >= r[0] && (r[1] === null || ch.age <= r[1]);
      var rng = r[1] === null ? r[0] + '+' : r[0] + '–' + r[1];
      return '<div class="dr-band' + (here ? ' is-now' : '') + '"><b>' + it[1] + '</b><span class="dr-ko">' + it[2] + '</span><span class="dr-band-age">Age ' + rng + '</span>' + (here ? '<span class="dr-chip now">You are here</span>' : '') + '</div>';
    }).join('');
    var single = ch.dy.mode === 'single';
    return '<div class="dr-bands" role="group" aria-label="Life stages">' + cells + '</div><p class="dr-en dr-bands-note">' +
      'These three stages and their ages are K Saju’s own split. Which part of your chart speaks for which stage follows tradition (your birth month for youth, the animal of your birth day for midlife, your birth hour for later life), but the traditional age ranges differ from ours. ' +
      (single ? 'Where each stage starts follows the ages your own 10-year cycles change, so it differs from person to person.' : 'Without a luck-cycle direction we can’t place your cycle changes, so we split at completed ages 30 and 60.') +
      '<span class="dr-ko"> · 초·중·말년의 나눔과 나이는 K사주가 직접 정한 것이에요. 어느 기둥이 어느 시기를 말하는지(월주는 젊은 시절, 일지는 중년, 시주는 말년)는 전통을 따랐지만, 기둥별 나이 구간은 전통과 달라요. ' + (single ? '각 단계의 시작은 내 대운이 바뀌는 나이를 따라서, 사람마다 달라요.' : '대운 방향을 모르면 대운이 바뀌는 나이를 정할 수 없어서, 만 30세와 60세를 기준으로 나눴어요.') + '</span></p>';
  }

  function cardBody(card, R) {
    var s = R.sections.filter(function (x) { return x.no === card.sec; })[0];
    var h = '';
    if (card.key === 'luck') {
      var ch = R.chart;
      (s.timeline || []).forEach(function (tl) { h += timelineHtml(tl, ch, E.L); });
      // order: notice (what the marks are) -> feel -> meaning -> one small step -> age bands -> timeline -> why
      return noticeBox(s.notice) + step('How it may feel', '감정', s.feel) + step('What it means', '의미', s.mean) + step('One small step', '작은 행동', s.act) + bandsHtml(R) + marksNote() + h + why(s.why);
    }
    if (card.key === 'year') {
      var yb = '';
      ['y2026', 'y2027'].forEach(function (k) {
        var b = s[k]; if (!b) return;
        yb += '<div class="dr-year"><div class="dr-year-h">' + b.year + ' · ' + esc(b.label.en) + '<span class="dr-ko"> · ' + esc(b.label.ko) + '</span></div>' +
          step('How it may feel', '감정', b.feel) + step('What it means', '의미', b.mean) + step('One small step', '작은 행동', b.act) + '</div>';
      });
      return step('The Saju year', '사주의 해', s.mean) + yb + step('Looking across both years', '두 해를 이어 보면', s.shift ? [s.shift] : []) + why(s.why);
    }
    if (card.key === 'caution') {
      var wb = '';
      (s.items || []).forEach(function (it, i) {
        wb += '<div class="dr-year"><div class="dr-year-h">Reminder ' + (i + 1) + '<span class="dr-ko"> · 기억할 점 ' + (i + 1) + '</span></div>' +
          step('How it may feel', '감정', [it.feel]) + step('What it means', '의미', [it.mean]) + step('What helps', '대처법', [it.cope]) + '</div>';
      });
      return wb + why(s.why);
    }
    return noticeBox(s.notice) + step('How it may feel', '감정', s.feel) + step('What it means', '의미', s.mean) + step('One small step', '작은 행동', s.act) + why(s.why);
  }

  function cardTitleExtra(card, R) {
    if (card.key === 'luck') {
      var s = R.sections.filter(function (x) { return x.no === 4; })[0];
      if (s.timeline && s.timeline.length === 1) {
        var tl = s.timeline[0], cur = tl.cycles.filter(function (c) { return c.k === tl.now; })[0];
        return cur ? 'Now: age ' + cur.ageStart + '–' + cur.ageEnd : 'Before your first cycle';
      }
      return 'Two directions shown';
    }
    if ((card.key === 'later' || card.key === 'middle') && R.chart.minor) return 'Skip for now';
    if (card.key === 'early' || card.key === 'middle' || card.key === 'later') {
      var t = R.sections.filter(function (x) { return x.no === card.sec; })[0];
      if (t && t.stage) {
        var r = t.stage.range, here = R.chart.age >= r[0] && (r[1] === null || R.chart.age <= r[1]);
        return 'Age ' + (r[1] === null ? r[0] + '+' : r[0] + '–' + r[1]) + (here ? ' · You are here' : '');
      }
    }
    if (card.key === 'year') return '2026–2027';
    return '';
  }

  // One-time terms table (English view): the names are the same as the calculator's
  function termsHtml(L) {
    var G = E.GOD_GLOSS;
    var rows = GOD_ORDER.map(function (g) {
      return '<li><b>' + esc(L.god[g].en) + '</b> <span class="dr-ko">' + esc(L.god[g].ko) + '</span> – ' + esc(G[g][0]) + '<span class="dr-ko"> · ' + esc(G[g][1]) + '</span></li>';
    }).join('');
    return '<details class="dr-terms"><summary>Terms used in this reading<span class="dr-ko"> · 용어 풀이</span></summary><div class="dr-terms-in">' +
      '<p class="dr-en"><b>Day Master</b>: the stem of your day pillar, the character that stands for you (the element of the day you were born).<span class="dr-ko"> · 일간: 태어난 날 기둥의 천간, 나를 뜻하는 글자예요.</span></p>' +
      '<p class="dr-en"><b>Month branch</b>: the part of the chart for the month you were born. One traditional view reads it as how you meet the wider world.<span class="dr-ko"> · 월지: 태어난 달을 나타내는 자리예요. 전통의 한 관점은 이것을 세상을 만나는 모습으로 읽어요.</span></p>' +
      '<p class="dr-en"><b>Saju calendar</b>: months follow the solar terms (Start of Spring falls around February 4), not the moon calendar, and the Saju year changes at Start of Spring, not on January 1.<span class="dr-ko"> · 사주 달력: 달이 아니라 절기를 기준으로 달을 나누고, 해도 1월 1일이 아니라 입춘에 바뀌어요(입춘은 2월 4일 무렵).</span></p>' +
      '<p class="dr-en"><b>The ten energies</b> (same names as our calculator) describe how each element in your chart relates to your Day Master:<span class="dr-ko"> · 열 가지 기운(십신): 사주의 각 글자가 일간과 맺는 관계를 설명하는 이름이에요.</span></p><ul class="dr-terms-list">' + rows + '</ul></div></details>';
  }

  // ---- summary card + "Read more" cards (K사주2 test build 2026-10-03) ----
  // one-line preview under each card title
  var __pvMay = 0;
  function cut(t, n) { t = String(t); if (t.length <= n) return t; var k = t.lastIndexOf(' ', n); return t.slice(0, k > 40 ? k : n).replace(/[,;:]$/, '') + '…'; }
  function previewOf(card, R) {
    var s = R.sections.filter(function (x) { return x.no === card.sec; })[0];
    if (!s) return '';
    var r = null;
    if (R.chart.minor && card.key === 'later') r = { en: 'Later life is far away, so this part is just a peek. Come back when you’re older.', ko: '' };
    else if (R.chart.minor && card.key === 'middle') r = s.noticeMinor; // keep the under-14 fold: preview shows only the notice
    else if (card.key === 'caution') r = s.items && s.items[0] && s.items[0].mean;
    else if (card.key === 'year') { var b = s.y2026 || s.y2027; r = b && b.feel && b.feel[0]; }
    else r = (s.feel && s.feel[0]) || (s.mean && s.mean[0]);
    if (r && /^You may\b/.test(r.en)) { __pvMay++; if (__pvMay > 2) { var alt = [].concat(s.mean || [], s.act || []).filter(function (x) { return x && !/^You may\b/.test(x.en); })[0]; if (alt) r = alt; } }
    return r ? '<p class="dr-en dr-pv">' + esc(cut(r.en, 80)) + '</p><p class="dr-ko dr-pv">' + esc(r.ko || '') + '</p>' : '';
  }
  // GA4: card name only. Never birth date, time, name or any result text.
  var trackOff = false; // set per render: true when the entered birth date is under 14 (no events at all)
  function track(name, cardKey) {
    if (trackOff) return;
    var params = cardKey ? { card_name: cardKey } : {};
    try { (window.__drEvents = window.__drEvents || []).push({ name: name, params: params }); } catch (e) {}
    if (typeof window.gtag === 'function') { try { window.gtag('event', name, params); } catch (e) {} }
  }
  var MORE = { en: 'Read more', ko: '자세히', less: 'Show less', lessKo: '접기' };
  function setOpen(cardEl, open) {
    var btn = cardEl.querySelector('.dr-more'), body = cardEl.querySelector('.dr-body');
    if (!btn || !body) return;
    body.hidden = !open; cardEl.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.innerHTML = open ? MORE.less + ' <span aria-hidden="true">▴</span>' : MORE.en + ' <span aria-hidden="true">▾</span>';
  }
  // Always visible (never folded): disclaimer, crisis help (approved wording from the Disclaimer page draft), AI label
  var SAFETY = {
    consult: ['Please consult a qualified professional.', '필요한 경우 자격을 갖춘 전문가와 상의해 주세요.'],
    ai: ['Illustrations and icons on this page were made with AI tools.', '이 페이지의 그림과 아이콘은 AI 도구로 만들었어요.'],
    crisisHead: ['You’re not alone, and help is available right now. If you’re thinking about harming yourself, or things feel too heavy:', '혼자가 아닙니다. 지금 도움을 받을 수 있습니다. 스스로를 해치고 싶은 생각이 들거나 너무 힘들다면:'],
    crisis: [
      ['In the United States, call or text <a href="tel:988"><b>988</b></a> to reach the <a href="https://988lifeline.org/" target="_blank" rel="noopener">988 Suicide &amp; Crisis Lifeline</a>. It’s free and available 24/7, and you can text if talking is hard.', '미국에서는 988로 전화하거나 문자를 보내면 988 자살·위기 상담 전화에 연결됩니다. 무료이며 24시간 운영하고, 말하기 어려우면 문자로도 됩니다.'],
      ['If you or someone else is in immediate danger, call <a href="tel:911"><b>911</b></a> in the United States. Outside the US, contact your local emergency number.', '본인이나 다른 사람이 당장 위험하면 미국에서는 911에 전화하세요. 미국 밖에서는 그 나라의 응급 전화번호로 연락하세요.'],
      ['In other countries, you can find local helplines at <a href="https://findahelpline.com/" target="_blank" rel="noopener">findahelpline.com</a>.', '다른 나라에서는 findahelpline.com 에서 그 나라의 상담 전화를 찾을 수 있습니다.']
    ]
  };
  function safetyHtml(R) {
    return '<div class="dr-safety" role="note">' +
      '<p class="dr-en">' + esc(R.disclaimer.en) + ' ' + SAFETY.consult[0] + '</p><p class="dr-ko">' + esc(R.disclaimer.ko) + ' ' + SAFETY.consult[1] + '</p>' +
      '<div class="dr-crisis"><p class="dr-en"><b>' + SAFETY.crisisHead[0] + '</b></p><p class="dr-ko">' + SAFETY.crisisHead[1] + '</p><ul>' +
      SAFETY.crisis.map(function (c) { return '<li><span class="dr-en">' + c[0] + '</span><span class="dr-ko"> ' + c[1] + '</span></li>'; }).join('') + '</ul></div>' +
      '<p class="dr-en dr-ai">' + SAFETY.ai[0] + '</p><p class="dr-ko dr-ai">' + SAFETY.ai[1] + '</p></div>';
  }
  function summaryHtml(S) {
    return '<section class="dr-summary" id="dr-summary" aria-labelledby="dr-summary-h">' +
      '<div class="dr-summary-kicker">Your summary<span class="dr-ko"> · 한눈에 보기</span></div>' +
      '<h3 id="dr-summary-h" class="dr-summary-h">' + esc(S.title.en) + '<span class="dr-ko dr-summary-hko">' + esc(S.title.ko) + '</span></h3>' +
      '<div class="dr-summary-sub">' + esc(S.sub.en) + '<span class="dr-ko"> · ' + esc(S.sub.ko) + '</span></div>' +
      '<ol class="dr-summary-lines">' + S.lines.map(function (l) {
        return '<li data-line="' + l.key + '"><span class="dr-summary-lab">' + esc(l.label.en) + '<span class="dr-ko"> · ' + esc(l.label.ko) + '</span></span>' +
          '<p class="dr-en">' + esc(l.en) + '</p><p class="dr-ko">' + esc(l.ko) + '</p></li>';
      }).join('') + '</ol></section>';
  }

  function render(input, res, opts) {
    var box = document.getElementById('dr-deep');
    if (!box) return;
    var asOf = (opts && opts.asOf) || (function () { var q = /[?&]asof=(\d{4}-\d{2}-\d{2})/.exec(location.search); if (q) return q[1]; var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
    var sd = res.input.solarDate.split('-').map(Number);
    var eInp = { y: sd[0], m: sd[1], d: sd[2], h: input.timeUnknown ? 12 : input.hour, mi: input.timeUnknown ? 0 : input.minute, timeUnknown: !!input.timeUnknown, dir: input.luckDirection === 'both' ? 'notsure' : input.luckDirection, asOf: asOf };
    var R = E.buildReading(eInp, res);
    var ch = R.chart, L = E.L, str = E.STR[ch.strength];
    var S = window.KSummaryCard.build(E, R, asOf);
    trackOff = !!ch.minor;
    var seasonEn = ch.cusp ? CUSP_CHIP[ch.pillars.month[1]][0] : ch.season, seasonKo = ch.cusp ? CUSP_CHIP[ch.pillars.month[1]][1] : L.season[ch.season].ko;
    var html = '';
    if (ch.minor) html += '<div class="dr-notice" id="dr-minor-note"><p class="dr-en">This reading is for people 14 or older. The age you entered is under 14, so please read it together with a parent or guardian.</p><p class="dr-ko">이 풀이는 만 14세 이상을 대상으로 해요. 입력하신 나이가 만 14세 미만이라 보호자와 함께 읽어 주세요.</p></div>';
    html += summaryHtml(S);
    if (ch.timeUnknown) html += '<div class="dr-notice"><p class="dr-en">Your big picture is here even without your birth time. If you learn it later, one more piece will fill in.</p><p class="dr-ko">시간을 몰라도 큰 그림은 여기 있어요. 나중에 알게 되면 조각 하나가 더 채워져요.</p></div>';
    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ad = asOf.split('-').map(Number);
    var STR_PLAIN = { strong: 'Plenty of your own energy', balanced: 'Evenly balanced', weak: 'Thrives with support' };
    html += '<div class="dr-sum">' + chip('Core element · ' + esc(L.dm[ch.dayGan].en) + ' (' + (ch.dayYang ? 'bolder' : 'gentler') + ' ' + ({ wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' })[ch.dayEl] + ')') +
      chip('Energy · ' + STR_PLAIN[ch.strength]) + chip('Born in ' + esc(seasonEn)) + chip('Age ' + ch.age + ' as of ' + MON[ad[1] - 1] + ' ' + ad[2] + ', ' + ad[0]) + '</div>';
    html += termsHtml(L);
    html += '<div class="dr-cards-bar"><span class="dr-cards-h">The full reading, 11 parts<span class="dr-ko"> · 자세한 풀이 11칸</span></span><button type="button" class="dr-all" aria-pressed="false">Expand all<span class="dr-ko"> · 모두 펼치기</span></button></div>';
    html += '<div class="dr-cards">';
    __pvMay = 0;
    CARDS.forEach(function (card) {
      var extra = cardTitleExtra(card, R);
      var nameEn = (ch.minor && card.minorEn) ? card.minorEn : card.en, nameKo = (ch.minor && card.minorKo) ? card.minorKo : card.ko;
      var bid = 'dr-body-' + card.key;
      html += '<div class="dr-card" data-card="' + card.key + '"><div class="dr-head">' +
        '<span class="dr-no">' + card.no + '</span><span class="dr-ttl"><b>' + esc(nameEn) + '</b><i class="dr-ko">' + nameKo + '</i>' + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</span></div>' +
        '<div class="dr-preview">' + previewOf(card, R) + '</div>' +
        '<button type="button" class="dr-more" aria-expanded="false" aria-controls="' + bid + '"></button>' +
        '<div class="dr-body" id="' + bid + '" hidden>';
      if (ch.minor && (card.key === 'later' || card.key === 'middle')) {
        var sLate = R.sections.filter(function (x) { return x.no === card.sec; })[0];
        html += noticeBox(sLate.noticeMinor) + '<details class="dr-why dr-fold"><summary>Read it anyway<span class="dr-ko"> · 그래도 읽어 보기</span></summary>' + cardBody(card, R) + '</details>';
      } else html += cardBody(card, R);
      html += '</div></div>';
    });
    html += '</div>';
    html += safetyHtml(R);
    box.innerHTML = html;
    box.style.display = 'block';
    var cards = Array.prototype.slice.call(box.querySelectorAll('.dr-card'));
    var allBtn = box.querySelector('.dr-all');
    function syncAll() {
      var allOpen = cards.every(function (c) { return c.classList.contains('is-open'); });
      allBtn.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
      allBtn.innerHTML = allOpen ? 'Collapse all' : 'Expand all';
    }
    cards.forEach(function (c) {
      setOpen(c, false);
      c.querySelector('.dr-more').addEventListener('click', function () {
        var open = !c.classList.contains('is-open');
        setOpen(c, open);
        if (open) track('deep_card_open', c.getAttribute('data-card'));
        syncAll();
      });
    });
    allBtn.addEventListener('click', function () {
      var allOpen = cards.every(function (c) { return c.classList.contains('is-open'); });
      cards.forEach(function (c) { setOpen(c, !allOpen); });
      if (!allOpen) track('deep_expand_all', null);
      syncAll();
    });
    // English page: no Korean at all (형님 10/3). Every Korean line is removed from the page, not just hidden.
    Array.prototype.slice.call(box.querySelectorAll('.dr-ko')).forEach(function (n) { n.parentNode.removeChild(n); });
    // [10/3 형님 y] under 14: hide the 8 Reports (love, marriage, money, business, health...) and show one line instead
    (function () {
      var grid = document.getElementById('scw-category-grid'), view = document.getElementById('scw-report-view'), note = document.getElementById('dr-reports-minor');
      if (!grid) return;
      if (ch.minor) {
        grid.style.display = 'none'; if (view) view.style.display = 'none';
        if (!note) { note = document.createElement('p'); note.id = 'dr-reports-minor'; note.className = 'dr-reports-minor'; note.textContent = 'These reports are for readers 14 and older.'; grid.parentNode.insertBefore(note, grid); }
        note.style.display = '';
      } else {
        grid.style.display = ''; if (note) note.style.display = 'none';
      }
      // [4차 검증 심리·법률] Reports 아래에도 오락용 안내 + 위기 연락처 한 줄 (만 14세 미만은 Reports가 숨겨져 위 11칸 아래 안내가 그대로 맨 아래)
      var menu = document.getElementById('scw-category-menu'), help = document.getElementById('dr-reports-help');
      if (menu && !help) {
        help = document.createElement('p'); help.id = 'dr-reports-help'; help.className = 'dr-reports-help';
        help.innerHTML = 'These reports are for entertainment only, not financial, medical, or legal advice. Need support right now? In the US, call or text <a href="tel:988"><b>988</b></a>. Elsewhere, find a local helpline at <a href="https://findahelpline.com/" target="_blank" rel="noopener">findahelpline.com</a>.';
        menu.appendChild(help);
      }
      if (help) help.style.display = ch.minor ? 'none' : '';
    })();
    // [4차 검증 법률] 만 14세 미만: Today's Fortune 의 Wealth·Love·Career·Health 칸도 숨기고 안내 한 줄
    (function () {
      var box = document.getElementById('scw-today'); if (!box) return;
      box.__drMinor = !!ch.minor; // 다시 계산할 때마다 최신 나이 기준
      function apply() {
        var minor = !!box.__drMinor;
        var hideKeys = ['Wealth', 'Love', 'Career', 'Health', 'Daily Rhythm'], hidden = 0;
        Array.prototype.slice.call(box.querySelectorAll('.scw-today-cat')).forEach(function (c) {
          var lab = c.querySelector('.scw-tcl-en'), name = lab ? lab.textContent.trim() : '';
          var hide = minor && hideKeys.indexOf(name) >= 0;
          c.style.display = hide ? 'none' : ''; if (hide) hidden++;
        });
        var n = document.getElementById('dr-today-minor');
        if (minor && hidden) {
          if (!n) { n = document.createElement('p'); n.id = 'dr-today-minor'; n.className = 'dr-reports-minor'; n.textContent = 'Today’s Fortune for wealth, love, career, and daily rhythm is for readers 14 and older.'; box.appendChild(n); }
          else if (n.parentNode !== box) box.appendChild(n);
          n.style.display = '';
        } else if (n) n.style.display = 'none';
      }
      apply();
      if (window.MutationObserver && !box.__drObs) { box.__drObs = new MutationObserver(function () { box.__drObs.disconnect(); apply(); box.__drObs.observe(box, { childList: true }); }); box.__drObs.observe(box, { childList: true }); }
    })();
    window.__lastDeepReading = R; window.__lastSummary = S; // for tests
    if (!(opts && opts.noScroll)) { var sm = document.getElementById('dr-minor-note') || document.getElementById('dr-summary'); if (sm && sm.scrollIntoView) sm.scrollIntoView({ block: 'start' }); }
  }
  function hide() { var box = document.getElementById('dr-deep'); if (box) box.style.display = 'none'; }
  window.KDeepUI = { render: render, hide: hide, CARDS: CARDS };
})();
