/* K Saju deep reading: summary card (test build 2026-10-03, K사주2, v3 = panel fixes).
 * "You're a ___ type" + 3 lines (overall / personality / this year), built only from this person's chart.
 * Same input -> same output (variants picked by a hash of the input, like the deep reading engine).
 * No network, no AI call, no storage. Works in the browser (window.KSummaryCard) and in Node (module.exports).
 * v3 (panel 10/3): late-season reading for season-change months (Earth Day Masters keep their own image),
 * Sunshine-only autumn/winter images, no "your main task"-type duties, softer year links ("This year's Horse"),
 * "may" on the decade line, decade line only for ages 14-69 with one direction (others get element counts),
 * year line reads the year's stem and says so, 2027 adds the Sheep's hidden Fire, any year outside 2026-27 is computed. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.KSummaryCard = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ---------- Line 1 (overall): Day Master element x birth season (traditional season imagery, 조후)
  // Season-change months (辰未戌丑) read as the late part of their season for Wood, Fire, Metal and Water;
  // only Earth Day Masters use the season-change image (Earth rules those months).
  var IMG = {
    wood_spring: ['Wood born in spring is a tree in its own season: you may grow fast, and the skill is choosing which branches to keep.', '봄에 태어난 나무는 제철을 만난 나무예요. 빨리 자랄 수 있고, 어떤 가지를 남길지 고르는 것이 실력이에요.'],
    wood_summer: ['Wood born in summer is a tree in full leaf under a strong sun: your energy may pour outward, and rest is what keeps you green.', '여름에 태어난 나무는 뜨거운 해 아래 잎이 무성한 나무예요. 기운이 밖으로 쏟아지기 쉬워서, 쉬는 시간이 푸름을 지켜 줘요.'],
    wood_autumn: ['Wood born in autumn is a tree in pruning season: outside demands may have shaped you in ways you didn’t plan.', '가을에 태어난 나무는 가지치기 철의 나무예요. 바깥의 요구가 계획에 없던 방향으로 당신을 다듬었을 수 있어요.'],
    wood_winter: ['Wood born in winter is a tree waiting under snow: your growth may look slow from outside while your roots quietly deepen.', '겨울에 태어난 나무는 눈 아래에서 기다리는 나무예요. 겉으로는 더뎌 보여도 뿌리는 조용히 깊어지고 있을 수 있어요.'],
    fire_spring: ['Fire born in spring is a flame fed by fresh wood: support may reach you easily, and the real question is where to direct that warmth.', '봄에 태어난 불은 새 나무가 받쳐 주는 불꽃이에요. 도움이 쉽게 닿을 수 있어서, 그 따뜻함을 어디로 보낼지가 진짜 질문이에요.'],
    fire_summer: ['Fire born in summer is a flame at noon: you may burn bright and fast, so pacing yourself matters as much as the spark.', '여름에 태어난 불은 한낮의 불꽃이에요. 밝고 빠르게 타오를 수 있어서, 불씨만큼이나 속도 조절이 중요해요.'],
    fire_autumn: ['Fire born in autumn is a lamp lit as the days grow shorter: your warmth may be valued most when people around you are cooling off.', '가을에 태어난 불은 해가 짧아질 때 켜는 등불이에요. 주변이 식어 갈 때 당신의 따뜻함이 가장 귀하게 느껴질 수 있어요.'],
    fire_winter: ['Fire born in winter is a hearth in a cold house: people may gather around your warmth, and looking after your own fire is what lets it last.', '겨울에 태어난 불은 추운 집의 화롯불이에요. 사람들이 당신 곁에 모일 수 있고, 내 불을 돌보는 일이 그 온기를 오래 가게 해 줘요.'],
    earth_spring: ['Earth born in spring is a field being plowed: the growth around you may feel crowded at times, and that can make you fertile ground.', '봄에 태어난 흙은 갈아엎는 밭이에요. 주변의 자람이 때로는 빽빽하게 느껴질 수 있지만, 그 힘이 당신을 기름진 땅으로 만들 수 있어요.'],
    earth_summer: ['Earth born in summer is warm, sun-baked ground: you may be solid and steady, and a little water, like rest and listening, keeps you from drying out.', '여름에 태어난 흙은 햇볕에 데워진 땅이에요. 단단하고 든든한 편이고, 쉬기와 듣기 같은 약간의 물이 땅이 메마르지 않게 해 줘요.'],
    earth_autumn: ['Earth born in autumn is a field after the harvest: what you grow may flow out to other people, so refilling yourself matters.', '가을에 태어난 흙은 추수를 마친 밭이에요. 당신이 키운 것이 다른 사람에게 흘러가기 쉬워서, 스스로를 다시 채우는 일이 중요해요.'],
    earth_winter: ['Earth born in winter is frozen ground: you may take time to warm up, and once you do, you can hold steady while others shift.', '겨울에 태어난 흙은 얼어 있는 땅이에요. 마음이 풀리는 데 시간이 걸릴 수 있지만, 한번 풀리면 남들이 흔들릴 때 버텨 줄 수 있어요.'],
    earth_cusp: ['Earth born in a month when one season turns into the next is the ground between two seasons: you may be the steady middle that links one phase to the next.', '계절이 바뀌는 달(토왕절)에 태어난 흙은 두 계절 사이의 땅이에요. 한 시기와 다음 시기를 이어 주는 든든한 가운데가 될 수 있어요.'],
    metal_spring: ['Metal born in spring is a blade among fast-growing plants: you may be the one who clears a path and trims what has grown wild.', '봄에 태어난 쇠는 빨리 자라는 풀숲 속의 칼이에요. 길을 내고 웃자란 것을 정리하는 사람이 될 수 있어요.'],
    metal_summer: ['Metal born in summer is metal in the forge: tough seasons may have left you with a sharper sense of what you need.', '여름에 태어난 쇠는 용광로 속의 쇠예요. 힘든 시기가 내게 필요한 것을 더 또렷이 알게 해 주었을 수 있어요.'],
    metal_autumn: ['Metal born in autumn is metal in its own season: your edges may be sharp and clear, and the skill is knowing when to put them away.', '가을에 태어난 쇠는 제철을 만난 쇠예요. 날이 또렷하고 날카로울 수 있어서, 언제 거둘지 아는 것이 실력이에요.'],
    metal_winter: ['Metal born in winter is cold steel in icy water: your thinking may run clear and sharp, and warmth from people can keep it from turning cold.', '겨울에 태어난 쇠는 찬물 속의 차가운 쇠예요. 생각이 맑고 날카로울 수 있고, 사람들의 온기가 그 생각이 차갑게 식지 않게 해 줄 수 있어요.'],
    water_spring: ['Water born in spring is a stream feeding new growth: your energy may flow into other people’s plans, so keep some for your own.', '봄에 태어난 물은 새싹을 키우는 시냇물이에요. 기운이 남의 계획으로 흘러가기 쉬우니, 내 몫도 남겨 두세요.'],
    water_summer: ['Water born in summer is a cool spring on a hot day: people may come to you for calm, so keep your own spring filled too.', '여름에 태어난 물은 더운 날의 시원한 샘물이에요. 사람들이 마음을 식히러 찾아올 수 있으니, 내 샘도 채워 두세요.'],
    water_autumn: ['Water born in autumn is a river filling from the mountains: ideas and help may flow toward you, and firm riverbanks give all of it a shape.', '가을에 태어난 물은 산에서 물을 받아 불어나는 강이에요. 생각과 도움이 모여들 수 있고, 든든한 둑이 그것에 모양을 잡아 줘요.'],
    water_winter: ['Water born in winter is deep, still water: you may think long and quietly, and a little warmth is what gets that depth moving.', '겨울에 태어난 물은 깊고 고요한 물이에요. 오래 조용히 생각하는 편일 수 있고, 약간의 온기가 그 깊이를 움직이게 해 줘요.']
  };
  // Sunshine (丙) is the sun, not a lamp or a hearth: its own autumn and winter images
  var IMG_BING = {
    autumn: ['Fire born in autumn is the sun in a lower autumn sky: your warmth may be valued most when people around you are cooling off.', '가을에 태어난 불은 낮아진 가을 하늘의 해예요. 주변이 식어 갈 때 당신의 따뜻함이 가장 귀하게 느껴질 수 있어요.'],
    winter: ['Fire born in winter is the sun in a cold sky: it may sit low, yet people still gather in its warmth.', '겨울에 태어난 불은 추운 하늘의 겨울 해예요. 낮게 떠 있어도 사람들이 그 온기 곁에 모일 수 있어요.']
  };
  // Under 14: no "tough seasons / outside demands" past-hardship lines
  var IMG_MINOR = {
    metal_summer: ['Metal born in summer is metal in the forge: you may be good at finding out what you need and asking for it.', '여름에 태어난 쇠는 용광로 속의 쇠예요. 내게 필요한 것을 알아보고 말로 꺼내는 데 능할 수 있어요.'],
    wood_autumn: ['Wood born in autumn is a tree in pruning season: you may grow best when you choose your own direction.', '가을에 태어난 나무는 가지치기 철의 나무예요. 내가 직접 방향을 고를 때 가장 잘 자랄 수 있어요.']
  };
  // Gem (辛) is polished jewelry, not a blade: its own spring and summer images
  var IMG_XIN = {
    spring: ['Metal born in spring is a polished gem among fresh blossoms: you may notice fine details others miss, and the skill is choosing where to shine.', '봄에 태어난 쇠는 새 꽃 사이의 다듬은 보석이에요. 남이 못 보는 세밀한 부분을 알아볼 수 있고, 어디에서 빛날지 고르는 것이 실력이에요.'],
    summer: ['Metal born in summer is a gem in bright sunlight: you may shine under attention, and some shade helps you keep your polish.', '여름에 태어난 쇠는 밝은 햇빛 아래의 보석이에요. 주목받을 때 빛날 수 있고, 가끔 그늘에서 쉬어야 광택이 오래가요.']
  };
  var LATE = { 辰: 'spring', 未: 'summer', 戌: 'autumn', 丑: 'winter' };
  var SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

  // ---------- Line 2 (personality): the energy that shows up most x the month branch's main energy
  var DOM = {
    bigyeon: [['The strongest thread in your chart is independence: you may prefer to check things yourself before taking anyone’s word.', '가장 두드러진 기운은 비견(내 발로 서는 힘)이에요. 남의 말을 듣기 전에 직접 확인해 보는 편일 수 있어요.'],
              ['The strongest thread in your chart is independence: you may keep your own pace even when a group speeds up.', '가장 두드러진 기운은 비견(내 발로 서는 힘)이에요. 무리가 서둘러도 내 속도를 지키는 편일 수 있어요.']],
    geopjae: [['The strongest thread in your chart is a competitive streak: a friendly race or a scoreboard may pull out your best effort.', '가장 두드러진 기운은 겁재(경쟁심과 승부욕)예요. 가벼운 시합이나 점수판이 있으면 최선을 끌어내는 편일 수 있어요.'],
              ['The strongest thread in your chart is a competitive streak: you may push harder the moment someone says it can’t be done.', '가장 두드러진 기운은 겁재(경쟁심과 승부욕)예요. 누가 "안 된다"고 하는 순간 더 힘을 내는 편일 수 있어요.']],
    siksin: [['The strongest thread in your chart is making and enjoying things: you may cook, build, or tinker your way through stress rather than talk it out.', '가장 두드러진 기운은 식신(만들고 즐기는 힘)이에요. 스트레스를 말로 풀기보다 요리하고 만들고 손보며 푸는 편일 수 있어요.'],
             ['The strongest thread in your chart is making and enjoying things: you may learn best by doing, then explain it afterward.', '가장 두드러진 기운은 식신(만들고 즐기는 힘)이에요. 먼저 해 보면서 익히고, 설명은 나중에 하는 편일 수 있어요.']],
    sanggwan: [['The strongest thread in your chart is speaking your mind: you may spot what’s off in a plan and say it before anyone else does.', '가장 두드러진 기운은 상관(날카로운 표현)이에요. 계획의 허점을 먼저 보고, 남보다 먼저 말하는 편일 수 있어요.'],
               ['The strongest thread in your chart is speaking your mind: you may redesign a task so it works your way.', '가장 두드러진 기운은 상관(날카로운 표현)이에요. 하는 방식을 내 식으로 다시 짜야 잘 풀리는 편일 수 있어요.']],
    pyeonjae: [['The strongest thread in your chart is spotting opportunities: you may notice an opening fast and like having several things going at once.', '가장 두드러진 기운은 편재(기회를 잡는 힘)예요. 기회를 빨리 알아보고, 여러 일을 한꺼번에 굴리는 걸 좋아하는 편일 수 있어요.'],
               ['The strongest thread in your chart is spotting opportunities: you may say yes first and work out the details on the way.', '가장 두드러진 기운은 편재(기회를 잡는 힘)예요. 먼저 "좋아"라고 하고 자세한 건 가면서 맞추는 편일 수 있어요.']],
    jeongjae: [['The strongest thread in your chart is steady, practical effort: you may like lists and plans, and enjoy seeing progress add up a little every day.', '가장 두드러진 기운은 정재(꾸준한 결과)예요. 목록과 계획을 좋아하고, 매일 조금씩 쌓이는 걸 보는 편일 수 있어요.'],
               ['The strongest thread in your chart is steady, practical effort: you may trust what you can measure more than what sounds exciting.', '가장 두드러진 기운은 정재(꾸준한 결과)예요. 신나 보이는 것보다 눈으로 잴 수 있는 것을 더 믿는 편일 수 있어요.']],
    pyeongwan: [['The strongest thread in your chart is rising to challenges: a deadline or a tough test may bring out your sharpest focus.', '가장 두드러진 기운은 편관(도전에 맞서는 힘)이에요. 마감이나 어려운 시험 앞에서 집중력이 가장 날카로워지는 편일 수 있어요.'],
                ['The strongest thread in your chart is rising to challenges: you may step in first when something goes wrong.', '가장 두드러진 기운은 편관(도전에 맞서는 힘)이에요. 일이 틀어지면 먼저 나서는 편일 수 있어요.']],
    jeonggwan: [['The strongest thread in your chart is responsibility and order: you may keep promises carefully and notice when others don’t.', '가장 두드러진 기운은 정관(책임과 질서)이에요. 약속을 꼼꼼히 지키고, 남이 안 지키면 눈에 잘 띄는 편일 수 있어요.'],
                ['The strongest thread in your chart is responsibility and order: you may feel calmest when everyone knows who does what.', '가장 두드러진 기운은 정관(책임과 질서)이에요. 누가 무엇을 맡는지 정해져 있을 때 가장 마음이 편한 편일 수 있어요.']],
    pyeonin: [['The strongest thread in your chart is an unusual way of seeing things: you may read between the lines and enjoy subjects few people around you study.', '가장 두드러진 기운은 편인(남다른 이해)이에요. 행간을 읽고, 주변에서 잘 안 하는 공부에 빠지는 편일 수 있어요.'],
              ['The strongest thread in your chart is an unusual way of seeing things: you may need time alone to think before you share a view.', '가장 두드러진 기운은 편인(남다른 이해)이에요. 생각을 말하기 전에 혼자 정리할 시간이 필요한 편일 수 있어요.']],
    jeongin: [['The strongest thread in your chart is learning and being cared for: you may take in advice well and pass it on to others just as well.', '가장 두드러진 기운은 정인(배우고 보살핌받는 힘)이에요. 조언을 잘 받아들이고, 받은 것을 다른 사람에게도 잘 나눠 주는 편일 수 있어요.'],
              ['The strongest thread in your chart is learning and being cared for: you may read up and ask around before any big step.', '가장 두드러진 기운은 정인(배우고 보살핌받는 힘)이에요. 큰 결정 전에 찾아 읽고 주변에 물어보는 편일 수 있어요.']],
    even: [['No single trait dominates your chart: you may switch roles easily, leading in one room and following in the next.', '사주에서 한 기운이 두드러지지 않아요. 어떤 자리에선 이끌고 다른 자리에선 따르며 역할을 쉽게 바꾸는 편일 수 있어요.'],
           ['No single trait dominates your chart: you may be the one who can talk with almost any kind of person.', '사주에서 한 기운이 두드러지지 않아요. 어떤 사람과도 대화를 이어 가는 편일 수 있어요.']]
  };
  // Under 14: everyday-life versions of the lines that talk about deadlines, plans or juggling
  var DOM_MINOR = {
    jeonggwan: [['The strongest thread in your chart is responsibility and order: you may keep promises carefully and like things to be fair.', '가장 두드러진 기운은 정관(책임과 질서)이에요. 약속을 꼼꼼히 지키고 공평한 걸 좋아하는 편일 수 있어요.']],
    pyeongwan: [['The strongest thread in your chart is rising to challenges: a tricky puzzle or a big game may bring out your sharpest focus.', '가장 두드러진 기운은 편관(도전에 맞서는 힘)이에요. 어려운 퍼즐이나 큰 시합 앞에서 집중력이 가장 날카로워지는 편일 수 있어요.']],
    jeongjae: [['The strongest thread in your chart is steady, practical effort: you may like checklists and sticker charts, and enjoy seeing progress add up a little every day.', '가장 두드러진 기운은 정재(꾸준한 결과)예요. 체크리스트와 스티커 판을 좋아하고, 매일 조금씩 쌓이는 걸 보는 편일 수 있어요.']],
    pyeonjae: [['The strongest thread in your chart is spotting opportunities: you may notice an opening fast and enjoy trying many new things.', '가장 두드러진 기운은 편재(기회를 잡는 힘)예요. 기회를 빨리 알아보고, 새로운 것을 이것저것 해 보는 걸 좋아하는 편일 수 있어요.']]
  };
  var MONTH = { // main hidden stem of the month branch (10 energies)
    bigyeon: [['a habit of treating people as equals', '사람을 동등하게 대하는 모습'], ['a pull toward friends who work beside you', '나란히 함께하는 친구에게 끌리는 마음']],
    geopjae: [['a habit of quietly measuring yourself against your own best', '속으로 나의 최고 기록과 겨루는 습관'], ['a readiness to share what you have and expect fairness back', '가진 것을 나누되 공평함을 바라는 마음']],
    siksin: [['a knack for making people comfortable', '사람을 편하게 해 주는 재주'], ['a love of small everyday things done well', '작은 일상을 잘 해내는 즐거움']],
    sanggwan: [['a wish to put your own stamp on things', '무엇이든 내 색을 입히고 싶은 마음'], ['a quick, honest way of speaking', '빠르고 솔직한 말투']],
    pyeonjae: [['a wide net of contacts and ideas', '넓게 퍼진 인맥과 생각'], ['an eye for chances other people walk past', '남이 지나치는 기회를 알아보는 눈']],
    jeongjae: [['a quick sense of what something is worth', '무엇이 얼마나 쓸모 있는지 빨리 알아보는 감각'], ['a careful hand with time and resources', '시간과 자원을 아껴 쓰는 손']],
    pyeongwan: [['a readiness to take on hard tasks', '어려운 일을 떠맡는 담력'], ['a protective streak toward people in your care', '내가 챙기는 사람을 지키려는 마음']],
    jeonggwan: [['a habit of taking roles and rules seriously', '맡은 역할과 규칙을 진지하게 대하는 모습'], ['a sense of how things are supposed to be done', '일이 어떻게 돌아가야 하는지에 대한 감각']],
    pyeonin: [['a taste for odd questions and quiet research', '엉뚱한 질문과 조용한 탐구를 좋아하는 마음'], ['a sharp intuition you may not always explain', '설명하기 어려운 날카로운 직감']],
    jeongin: [['a wish to understand first and act second', '먼저 이해하고 나서 움직이려는 마음'], ['a soft spot for teachers, books, and good advice', '선생님, 책, 좋은 조언을 아끼는 마음']]
  };
  var MONTH_MINOR = { pyeongwan: [['a gentle side that looks out for friends', '친구를 살뜰히 챙기는 다정한 면']] };
  var ANIMAL = { 子: ['Rat', '쥐'], 丑: ['Ox', '소'], 寅: ['Tiger', '호랑이'], 卯: ['Rabbit', '토끼'], 辰: ['Dragon', '용'], 巳: ['Snake', '뱀'], 午: ['Horse', '말'], 未: ['Sheep', '양'], 申: ['Monkey', '원숭이'], 酉: ['Rooster', '닭'], 戌: ['Dog', '개'], 亥: ['Pig', '돼지'] };

  // ---------- Line 3 (this year): the year's stem read as one of your ten energies (2 variants each) + its strongest link
  var YEAR_GOD = {
    bigyeon: [['a year when your own pace and the people beside you both matter', '내 속도와 곁에 있는 사람이 모두 중요한 해'], ['a year to stand on your own feet and team up with equals', '내 발로 서고 동등한 사람과 손잡는 해']],
    geopjae: [['a year when sharing and competing both get louder', '나누기와 겨루기가 함께 커지는 해'], ['a year when friendly rivals may push you forward', '선의의 경쟁자가 당신을 앞으로 밀어 줄 수 있는 해'], ['a year when a bit of good-natured competition can sharpen your aim', '적당한 경쟁이 목표를 또렷하게 해 줄 수 있는 해']],
    siksin: [['a year to make, cook, write, or practice something you enjoy', '좋아하는 것을 만들고 쓰고 연습하기 좋은 해'], ['a year when doing things by hand may lift your mood', '손으로 무언가를 하면 기분이 살아날 수 있는 해']],
    sanggwan: [['a year when you may want to speak up and change how things are done', '목소리를 내고 방식을 바꾸고 싶어질 수 있는 해'], ['a year when new ideas may come quickly and want to be said out loud', '새 생각이 빨리 떠오르고 말로 꺼내고 싶어질 수 있는 해']],
    pyeonjae: [['a year of quick chances and many moving parts', '빠른 기회와 움직이는 일이 많은 해'], ['a year when new openings may show up from unexpected places', '뜻밖의 곳에서 새 기회가 보일 수 있는 해']],
    jeongjae: [['a year for steady, step-by-step results', '한 걸음씩 꾸준한 결과를 쌓는 해'], ['a year when small daily habits may add up', '작은 매일의 습관이 쌓여 갈 수 있는 해']],
    pyeongwan: [['a year that may ask you to meet a challenge head-on', '도전을 정면으로 마주할 일이 생길 수 있는 해'], ['a year when challenges may feel more direct, and you can rise to them', '도전이 더 가깝게 느껴지고, 그에 맞서 볼 수 있는 해']],
    jeonggwan: [['a year when tasks and expectations may feel clearer to you', '해야 할 일과 기대가 더 또렷하게 느껴질 수 있는 해'], ['a year when keeping your word may get noticed', '약속을 지키는 모습이 눈에 띌 수 있는 해']],
    pyeonin: [['a year for unusual ideas and learning on your own', '남다른 생각과 혼자 하는 공부의 해'], ['a year when a quiet hobby or side study may pull you in', '조용한 취미나 따로 하는 공부에 끌릴 수 있는 해']],
    jeongin: [['a year when learning something new may come more easily', '새로 배우는 일이 더 쉽게 느껴질 수 있는 해'], ['a year when good advice may find you at the right time', '좋은 조언이 때맞춰 찾아올 수 있는 해']]
  };
  var GOD_NAME = { bigyeon: ['Peer', '비견'], geopjae: ['Rival', '겁재'], siksin: ['Ease', '식신'], sanggwan: ['Rebel', '상관'], pyeonjae: ['Hustle', '편재'], jeongjae: ['Wage', '정재'], pyeongwan: ['Pressure', '편관'], jeonggwan: ['Duty', '정관'], pyeonin: ['Insight', '편인'], jeongin: ['Nurture', '정인'] };
  var EL_NAME = { wood: ['Wood', '나무'], fire: ['Fire', '불'], earth: ['Earth', '흙'], metal: ['Metal', '쇠'], water: ['Water', '물'] };
  var DM_KO = { 甲: '갑목', 乙: '을목', 丙: '병화', 丁: '정화', 戊: '무토', 己: '기토', 庚: '경금', 辛: '신금', 壬: '임수', 癸: '계수' };
  var PILLAR_EN = { year: 'year', month: 'month', day: 'day', hour: 'hour' };
  var BR_KO = { year: '연지', month: '월지', day: '일지', hour: '시지' };
  var ST_KO = { year: '연간', month: '월간', day: '일간', hour: '시간' };
  var PL_KO = { year: '연주', month: '월주', day: '일주', hour: '시주' };
  var AREA = { year: ['your wider circle', '넓은 인간관계'], month: ['your daily routine and the people in it', '일상과 그 속의 사람들'], day: ['home and your closest people', '집과 가장 가까운 사람들'], hour: ['plans for what comes next', '앞으로의 계획'] };
  var AREA_S = { year: ['how you show up in your wider circle', '넓은 관계 속 내 모습'], month: ['daily decisions', '일상의 결정'], day: ['personal choices', '나 스스로 하는 선택'], hour: ['long-range plans', '먼 계획'] };
  var SANHE_EL = { 午: 'fire', 寅: 'fire', 戌: 'fire', 未: 'wood', 亥: 'wood', 卯: 'wood', 子: 'water', 申: 'water', 辰: 'water', 酉: 'metal', 巳: 'metal', 丑: 'metal' };
  var FANG = { 巳: 'summer', 午: 'summer', 未: 'summer', 寅: 'spring', 卯: 'spring', 辰: 'spring', 申: 'autumn', 酉: 'autumn', 戌: 'autumn', 亥: 'winter', 子: 'winter', 丑: 'winter' };
  var FANG_SET = { spring: ['Tiger, Rabbit, Dragon', '호랑이·토끼·용', 'wood'], summer: ['Snake, Horse, Sheep', '뱀·말·양', 'fire'], autumn: ['Monkey, Rooster, Dog', '원숭이·닭·개', 'metal'], winter: ['Pig, Rat, Ox', '돼지·쥐·소', 'water'] };

  var PSIGN = { year: 'your birth-year animal', month: 'your birth-month animal', day: 'the animal of the day you were born', hour: 'the animal of the hour you were born' };
  var PELM = { year: 'the element of your birth year', month: 'the element of your birth month', day: 'your core element', hour: 'the element of your birth hour' };
  function relClause(r, yb, minor) {
    var an = ANIMAL[yb], p = r.p, a = p ? ((r.t === 'ganhe' || r.t === 'ganchong') ? AREA_S[p] : AREA[p]) : null;
    var tY = 'This year’s ' + an[0], kY = '올해의 ' + an[1] + '이(가)';
    if (minor && p === 'day') return [tY + ' meets the animal of the day you were born, so your own daily rhythm may feel a little different from usual.', kY + ' 내 일지와 만나서, 나만의 하루 리듬이 평소와 조금 다르게 느껴질 수 있어요.'];
    switch (r.t) {
      case 'fuyin': return ['This year’s animal and element match ' + ({ year: 'your birth year', month: 'your birth month', day: 'the day you were born', hour: 'the hour you were born' })[p] + ' exactly, so familiar themes around ' + a[0] + ' may come back for a second look.', '내 ' + PL_KO[p] + '와 같은 간지라서(복음, 伏吟), ' + a[1] + '에 관한 익숙한 일이 다시 돌아올 수 있어요.'];
      case 'chung':
        if (p === 'day') return [tY + ' clashes with the animal of the day you were born, so your own daily rhythm may feel a little different from usual.', kY + ' 내 일지와 정면으로 마주 서서(충, 沖), 나만의 하루 리듬이 평소와 조금 다르게 느껴질 수 있어요.'];
        return [tY + ' clashes with ' + PSIGN[p] + ', so things around ' + a[0] + ' may feel livelier or less settled than usual.', kY + ' 내 ' + BR_KO[p] + '와 정면으로 마주 서서(충, 沖), ' + a[1] + '이(가) 평소보다 활발하거나 덜 안정되게 느껴질 수 있어요.'];
      case 'sanxing': return ['This year completes a rare pattern of three animals in your chart, so promises and plans may feel more delicate.', '사주 안의 세 글자가 한자리에 모이는 해라서(삼형, 三刑), 올해는 약속과 계획이 더 섬세하게 느껴질 수 있어요.'];
      case 'fanghe': { var f = FANG_SET[FANG[yb]], others = f[0].split(', ').filter(function (x) { return x !== an[0]; }); return [tY + ' joins two other ' + FANG[yb] + ' animals in your chart (' + others.join(' and ') + ') to form a trio, so the year’s ' + EL_NAME[f[2]][0] + ' may feel much stronger.', '사주 글자와 함께 ' + SEASON_KO[FANG[yb]] + '의 계절 묶음(방합, ' + f[1] + ')을 채워서, 올해의 ' + EL_NAME[f[2]][1] + ' 기운이 크게 느껴질 수 있어요.']; }
      case 'samhap': { var e = EL_NAME[SANHE_EL[yb]]; return [tY + ' joins animals already in your chart to form a ' + e[0] + ' trio, so ' + e[0] + ' themes may stand out more this year.', '사주에 있던 글자와 함께 ' + e[1] + '의 삼합(三合)을 이루어서, 올해는 ' + e[1] + '의 기운이 더 크게 느껴질 수 있어요.']; }
      case 'hap':
        return [tY + ' pairs up with ' + PSIGN[p] + ', so ' + a[0] + ' may draw you in closer.', kY + ' 내 ' + BR_KO[p] + '와 짝을 이루어서(육합, 六合), ' + a[1] + '에 더 마음이 갈 수 있어요.'];
      case 'xing': return [tY + ' rubs against ' + PSIGN[p] + ', so small things around ' + a[0] + ' may deserve a calm second look.', kY + ' 내 ' + BR_KO[p] + '와 서로 엇갈려서(형, 刑), ' + a[1] + '에서는 작은 일을 한 번 더 차분히 살펴보면 좋아요.'];
      case 'zixing': return [tY + ' matches ' + PSIGN[p] + ', so if the same small worry keeps coming back in ' + a[0] + ', try writing it down once and setting it aside.', kY + ' 내 ' + BR_KO[p] + '의 같은 글자를 만나서(자형, 自刑), ' + a[1] + '에서 같은 일이 되풀이되는 듯하면 스스로에게 너그러워지세요.'];
      case 'banhap': { var e2 = EL_NAME[SANHE_EL[yb]]; return [tY + ' teams up with ' + PSIGN[p] + ' as a ' + e2[0] + ' pair, so ' + e2[0] + ' themes may stand out around ' + a[0] + '.', kY + ' 내 ' + BR_KO[p] + '와 ' + e2[1] + '의 반쪽 묶음(반합, 半合)을 이루어서, ' + a[1] + '에서 그 기운이 커질 수 있어요.']; }
      case 'ganhe': return ['This year’s element pairs with ' + PELM[p] + ', so you may weigh other people’s wishes more than usual in ' + a[0] + '.', '올해의 천간이 내 ' + ST_KO[p] + '과(와) 짝을 이루어서(천간합, 天干合), ' + a[1] + '에서 다른 사람의 바람을 평소보다 더 헤아릴 수 있어요.'];
      case 'ganchong': return ['This year’s element pushes against ' + PELM[p] + ', so ' + a[0] + ' may bring mixed feelings.', '올해의 천간이 내 ' + ST_KO[p] + '과(와) 맞서서(천간충, 天干沖), ' + a[1] + '에 대한 마음이 복합적일 수 있어요.'];
    }
    return null;
  }

  // Korean particles after Hangul (이(가), 과(와), 을(를), 와(과), 은(는))
  function josa(s) {
    return s.replace(/([가-힣])(이\(가\)|과\(와\)|을\(를\)|와\(과\)|은\(는\))/g, function (m, c, p) {
      var has = (c.charCodeAt(0) - 0xAC00) % 28 !== 0;
      return c + ({ '이(가)': has ? '이' : '가', '과(와)': has ? '과' : '와', '와(과)': has ? '과' : '와', '을(를)': has ? '을' : '를', '은(는)': has ? '은' : '는' })[p];
    });
  }
  function pick(E, key, id, n) { return n <= 1 ? 0 : E.sha32(key + '|SUM|' + id) % n; }
  var GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

  // Which Saju year the reader is in on asOf (changes at Start of Spring; by date, around Feb 4)
  function sajuYear(asOf) {
    var p = asOf.split('-').map(Number);
    return (p[1] > 2 || (p[1] === 2 && p[2] >= 4)) ? p[0] : p[0] - 1;
  }
  // Ages of the best decade(s): touching ranges are joined (32-41 + 42-51 -> 32-51)
  function joinRanges(cs) {
    var out = [];
    cs.slice().sort(function (a, b) { return a.ageStart - b.ageStart; }).forEach(function (c) {
      var last = out[out.length - 1];
      if (last && c.ageStart === last[1] + 1) last[1] = c.ageEnd; else out.push([c.ageStart, c.ageEnd]);
    });
    return out;
  }

  /** build(E, R, asOf) -> { title, sub, lines:[{key,label,en,ko}], year } ; E = KDeepEngine, R = E.buildReading(...) */
  function build(E, R, asOf) {
    var ch = R.chart, key = R.key, dg = ch.dayGan, minor = ch.minor, L = E.L;
    var nm = L.dm[dg].en;
    var title = { en: 'You’re ' + (/^[AEIOU]/.test(nm) ? 'an ' : 'a ') + nm + ' type', ko: '당신은 ' + nm + '(' + DM_KO[dg] + ') 타입' };
    var sub = { en: 'Your core element: ' + EL_NAME[ch.dayEl][0] + ', the ' + (ch.dayYang ? 'bolder' : 'gentler') + ' kind', ko: (ch.dayYang ? '양' : '음') + '의 ' + EL_NAME[ch.dayEl][1] + ' 일간' };

    // line 1: overall = season image + (decade line for ages 14-69 with one direction, otherwise element counts)
    var mz = ch.pillars.month[1], img;
    if (ch.cusp && ch.dayEl === 'earth') img = IMG.earth_cusp;
    else {
      var sea = ch.cusp ? LATE[mz] : ch.season;
      img = (dg === '丙' && IMG_BING[sea]) ? IMG_BING[sea] : (dg === '辛' && IMG_XIN[sea]) ? IMG_XIN[sea] : (minor && IMG_MINOR[ch.dayEl + '_' + sea]) || IMG[ch.dayEl + '_' + sea];
      if (ch.cusp) img = [img[0].replace(/^(\w+) born in (spring|summer|autumn|winter)/, '$1 born in late $2'), img[1].replace(/^(봄|여름|가을|겨울)에 태어난/, '늦$1에 태어난')];
    }
    var tail = null;
    var luck = R.sections.filter(function (s) { return s.no === 4; })[0];
    var tl = luck && luck.timeline && luck.timeline.length === 1 ? luck.timeline[0] : null;
    if (tl && !minor && ch.age < 60) {
      if (tl.best && tl.best.length) {
        var rg = joinRanges(tl.cycles.filter(function (c) { return tl.best.indexOf(c.k) >= 0; }));
        var en = rg.map(function (x) { return x[0] + '–' + x[1]; }), ko = rg.map(function (x) { return x[0] + '~' + x[1] + '세'; });
        var nowIdx = rg.findIndex(function (x) { return x[0] <= ch.age && ch.age <= x[1]; });
        if (nowIdx >= 0) { // the strongest stretch includes the reader's current age
          var rest = rg.filter(function (x, k) { return k !== nowIdx; });
          tail = rest.length
            ? ['By our scoring, your strongest stretches are the one you’re in now, ages ' + en[nowIdx] + ', and ages ' + rest.map(function (x) { return x[0] + '–' + x[1]; }).join(' and ') + '.', '자체 채점으로는 지금 지나는 ' + ko[nowIdx] + '와 ' + rest.map(function (x) { return x[0] + '~' + x[1] + '세'; }).join('와 ') + '가 가장 힘이 큰 시기예요.']
            : ['By our scoring, your strongest stretch is the one you’re in now, ages ' + en[nowIdx] + '.', '자체 채점으로는 가장 힘이 큰 시기가 지금 지나는 ' + ko[nowIdx] + '예요.'];
        } else tail = rg.length === 1
          ? ['By our scoring, your strongest stretch in the next 30 years may be ages ' + en[0] + '.', '자체 채점으로는 앞으로 30년 중 ' + ko[0] + '가 가장 힘이 큰 시기일 수 있어요.']
          : ['By our scoring, your strongest stretches in the next 30 years may be ages ' + en.join(' and ') + '.', '자체 채점으로는 앞으로 30년 중 ' + ko.join('와 ') + '가 가장 힘이 큰 시기일 수 있어요.'];
      } else tail = ['By our scoring, your next 30 years may look fairly even, with no single decade standing out.', '자체 채점으로는 앞으로 30년이 특별히 튀는 10년 없이 고른 편일 수 있어요.'];
    }
    if (!tail) { // element counts on the surface of the chart (8 characters, or 6 without the hour)
      var cn = ch.counts, els = ['wood', 'fire', 'earth', 'metal', 'water'];
      var mx = els.reduce(function (a, b) { return cn[b] > cn[a] ? b : a; });
      var mn = els.reduce(function (a, b) { return cn[b] < cn[a] ? b : a; });
      var many = NUM[cn[mx]] || String(cn[mx]);
      var zeros = els.filter(function (e) { return cn[e] === 0; });
      var zEn = zeros.map(function (e) { return EL_NAME[e][0]; }), zKo = zeros.map(function (e) { return EL_NAME[e][1]; });
      var orEn = zEn.length > 1 ? zEn.slice(0, -1).join(', ') + ' or ' + zEn[zEn.length - 1] : zEn[0];
      var partsEn = 'Your chart has ' + NUM[ch.total] + ' parts (two each from your birth ' + (ch.total === 8 ? 'year, month, day, and hour' : 'year, month, and day') + ')';
      if (cn[mx] <= 2 && !zeros.length) tail = [partsEn + ', and they spread fairly evenly across the five elements.', '사주 ' + ch.total + '글자에 다섯 기운이 고른 편으로 퍼져 있어요.'];
      else if (cn[mx] <= 2) tail = [partsEn + ': none are ' + orEn + ', and the rest are spread fairly evenly.', '사주 겉 ' + ch.total + '글자 중 ' + zKo.join('·') + '은(는) 하나도 없고, 나머지는 고르게 퍼져 있어요.'];
      else if (zeros.length) tail = [partsEn + ': ' + many + ' are ' + EL_NAME[mx][0] + ' and none are ' + orEn + '.', '사주 ' + ch.total + '글자 중 ' + EL_NAME[mx][1] + '이(가) ' + cn[mx] + '개이고, ' + zKo.join('·') + '은(는) 하나도 없어요.'];
      else tail = [partsEn + ': ' + many + ' are ' + EL_NAME[mx][0] + ' and only one is ' + EL_NAME[mn][0] + '.', '사주 ' + ch.total + '글자 중 ' + EL_NAME[mx][1] + '이(가) ' + cn[mx] + '개이고, ' + EL_NAME[mn][1] + '은(는) 하나뿐이에요.'];
    }
    var l1 = { key: 'overall', label: { en: 'Overall', ko: '총운' }, en: img[0] + ' ' + tail[0], ko: img[1] + ' ' + tail[1] };

    // line 2: personality
    var dv = (minor && DOM_MINOR[ch.dominant]) || DOM[ch.dominant], d = dv[pick(E, key, 'dom', dv.length)];
    var mv = (minor && MONTH_MINOR[ch.monthMainGod]) || MONTH[ch.monthMainGod], m = mv[pick(E, key, 'month', mv.length)], ma = ANIMAL[mz];
    var l2 = { key: 'personality', label: { en: 'Personality', ko: '성격' },
      en: d[0] + ' Your birth month, ' + (/^[AEIOU]/.test(ma[0]) ? 'an ' : 'a ') + ma[0] + ' month on the traditional seasonal calendar, adds ' + m[0] + '.',
      ko: d[1] + ' 사주에서 태어난 달인 ' + ma[1] + '의 달은 ' + m[1] + '을(를) 더해요.' };

    // line 3: this year (the year's stem, read against your Day Master)
    var Y = sajuYear(asOf), gz = GAN[(((Y - 4) % 10) + 10) % 10] + ZHI[(((Y - 4) % 12) + 12) % 12];
    var ys = gz[0], yb = gz[1], yEl = E.C.GAN_EL[ys], yYang = E.C.GAN_YANG[ys];
    var god = E.C.tenGod(dg, ys), yg = YEAR_GOD[god][pick(E, key, 'yeargod', YEAR_GOD[god].length)];
    var yName = [EL_NAME[yEl][0] + ' ' + ANIMAL[yb][0], (yEl === 'fire' ? '붉은' : EL_NAME[yEl][1] + '의') + ' ' + ANIMAL[yb][1]];
    var stemEn = (yYang ? 'Yang ' : 'Yin ') + EL_NAME[yEl][0], stemKo = (yYang ? '양' : '음') + '의 ' + EL_NAME[yEl][1];
        var PY = {"bigyeon": "a push toward independence", "geopjae": "a competitive streak", "siksin": "a pull toward making and enjoying things", "sanggwan": "an urge to speak your mind", "pyeonjae": "a run of opportunities", "jeongjae": "a call for steady, practical effort", "pyeongwan": "challenges to rise to", "jeonggwan": "more responsibility", "pyeonin": "a pull toward unusual ideas", "jeongin": "learning and support"};
    var yrPhrase = 'the Year of the ' + yName[0];
    var head = ['For you, ' + Y + ', ' + yrPhrase + ', looks like ' + yg[0] + '.',
                Y + '년 ' + yName[1] + '의 해에는 올해의 ' + EL_NAME[yEl][1] + ' 기운이 당신에게 ' + GOD_NAME[god][1] + '의 기운으로 와요. ' + yg[1] + '예요.'];
    var extra = ['', ''];
    var yrSec = R.sections.filter(function (s) { return s.no === 3; })[0];
    var rels = ((yrSec && yrSec.relations && yrSec.relations[Y]) || []).map(function (s) { var a = s.split(':'); return { t: a[0], p: (a[1] && /^(year|month|day|hour)$/.test(a[1])) ? a[1] : null }; });
    var c3 = null;
    for (var i = 0; i < rels.length && !c3; i++) c3 = relClause(rels[i], yb, minor);
    if (!c3) { // no link with the chart: say how much of the year's element the chart already shows
      var nE = ch.counts[yEl], H = R.helpful || [], ex = ch.excess || [], en3 = EL_NAME[yEl];
      c3 = nE === 0 ? ['None of the parts of your chart is ' + en3[0] + ', so this year’s ' + en3[0] + ' may feel new to you.', '사주 겉 글자에는 ' + en3[1] + '이(가) 없어서, 올해의 ' + en3[1] + ' 기운이 새롭게 느껴질 수 있어요.']
        : ex.indexOf(yEl) >= 0 ? ['Your chart already has ' + NUM[nE] + ' ' + en3[0] + ' parts, so pacing yourself may matter more than usual.', '사주에 ' + en3[1] + ' 글자가 이미 ' + nE + '개 있어서, 올해는 평소보다 속도 조절이 중요할 수 있어요.']
        : H.indexOf(yEl) >= 0 ? [en3[0] + ' is one of the balancing elements for your chart, so this year’s ' + en3[0] + ' may feel welcome.', en3[1] + '은(는) 당신 사주의 균형을 잡아 주는 기운 중 하나라서, 올해의 ' + en3[1] + ' 기운이 반갑게 느껴질 수 있어요.']
        : ['The year’s sign makes no strong link with your chart, so its effect may stay in the background.', '올해의 글자가 사주와 강하게 얽히지 않아서, 영향이 배경에 머물 수 있어요.'];
    }
    var l3 = { key: 'year', label: { en: 'This year', ko: '올해' }, en: head[0] + extra[0] + ' ' + c3[0], ko: head[1] + extra[1] + ' ' + c3[1] };

    var lines = [l1, l2, l3];
    lines.forEach(function (x) {
      x.ko = josa(x.ko);
      if (minor) { x.en = x.en.replace(/team up with equals/g, 'team up with friends'); x.ko = x.ko.replace(/동등한 사람과 손잡는/g, '친구와 손잡는'); }
    });
    return { title: title, sub: sub, lines: lines, year: Y };
  }
  return { build: build, IMG: IMG, IMG_BING: IMG_BING, IMG_MINOR: IMG_MINOR, DOM: DOM, DOM_MINOR: DOM_MINOR, MONTH: MONTH, MONTH_MINOR: MONTH_MINOR, YEAR_GOD: YEAR_GOD };
});
