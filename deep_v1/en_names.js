/* K Saju: English names for stems, branches and pillars (so English sentences never contain hanja).
   Works in the browser (window.KNames) and in Node (module.exports). */
(function (root, factory) {
  var m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m; else root.KNames = m;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  var NICK = { 甲: 'Oak', 乙: 'Ivy', 丙: 'Sunshine', 丁: 'Firefly', 戊: 'Rock', 己: 'Meadow', 庚: 'Blade', 辛: 'Gem', 壬: 'Ocean', 癸: 'Rain' };
  var ANIMAL = { 子: 'Rat', 丑: 'Ox', 寅: 'Tiger', 卯: 'Rabbit', 辰: 'Dragon', 巳: 'Snake', 午: 'Horse', 未: 'Sheep', 申: 'Monkey', 酉: 'Rooster', 戌: 'Dog', 亥: 'Pig' };
  var STEM_EL = { 甲: 'Wood', 乙: 'Wood', 丙: 'Fire', 丁: 'Fire', 戊: 'Earth', 己: 'Earth', 庚: 'Metal', 辛: 'Metal', 壬: 'Water', 癸: 'Water' };
  var YANG = { 甲: 1, 乙: 0, 丙: 1, 丁: 0, 戊: 1, 己: 0, 庚: 1, 辛: 0, 壬: 1, 癸: 0 };
  var EL = { 木: 'Wood', 火: 'Fire', 土: 'Earth', 金: 'Metal', 水: 'Water' };
  function pillarName(gz) { return STEM_EL[gz[0]] + ' ' + ANIMAL[gz[1]]; } // [plain 10/3] 'Wood Rat'
  function list(a) { return a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; }
  // slotClean: English text -> replace any leftover stem / branch / pillar / element characters with English names
  function slotClean(t) {
    var s = String(t);
    s = s.replace(new RegExp('([' + STEMS + '])[ ]*[(]?(Oak|Ivy|Sunshine|Firefly|Rock|Meadow|Blade|Gem|Ocean|Rain)[)]?', 'g'), function (m, a, n) { return NICK[a] === n ? n : m; });
    s = s.replace(new RegExp('([' + STEMS + '])([' + BRANCHES + '])', 'g'), function (m, a, b) { return pillarName(a + b); });
    s = s.replace(new RegExp('[' + BRANCHES + ']{2,}', 'g'), function (m) { return list(m.split('').map(function (z) { return ANIMAL[z]; })); });
    s = s.replace(new RegExp('[' + STEMS + ']', 'g'), function (m) { return (YANG[m] ? 'bold ' : 'gentle ') + STEM_EL[m]; }); // [plain 10/3] a bare stem reads as bold/gentle + element
    s = s.replace(new RegExp('[' + BRANCHES + ']', 'g'), function (m) { return ANIMAL[m]; });
    s = s.replace(/[木火土金水]/g, function (m) { return EL[m]; });
    return s;
  }
  return { NICK: NICK, ANIMAL: ANIMAL, STEM_EL: STEM_EL, YANG: YANG, pillarName: pillarName, list: list, slotClean: slotClean };
});
