// Verifies the Yacht (Yahtzee-style) scoring (mirrors src/games/yacht/yachtScore.ts):
// every category on representative dice, the upper bonus threshold, and the grand
// total. Pure, dependency-free. Run: node scripts/verify-yacht.mjs

const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const CATEGORIES = [
  ...UPPER,
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
];
const faceCounts = (dice) => {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) if (d >= 1 && d <= 6) c[d]++;
  return c;
};
const total = (dice) => dice.reduce((s, d) => s + d, 0);
const faceValue = (cat) => UPPER.indexOf(cat) + 1;
function hasRun(counts, len) {
  let run = 0;
  for (let f = 1; f <= 6; f++) {
    if (counts[f] > 0) {
      run++;
      if (run >= len) return true;
    } else run = 0;
  }
  return false;
}
function scoreFor(cat, dice) {
  if (dice.length !== 5) return 0;
  const c = faceCounts(dice);
  const max = Math.max(...c);
  if (UPPER.includes(cat)) {
    const f = faceValue(cat);
    return c[f] * f;
  }
  switch (cat) {
    case 'threeKind':
      return max >= 3 ? total(dice) : 0;
    case 'fourKind':
      return max >= 4 ? total(dice) : 0;
    case 'fullHouse':
      return (c.includes(3) && c.includes(2)) || c.includes(5) ? 25 : 0;
    case 'smallStraight':
      return hasRun(c, 4) ? 30 : 0;
    case 'largeStraight':
      return hasRun(c, 5) ? 40 : 0;
    case 'yahtzee':
      return max >= 5 ? 50 : 0;
    case 'chance':
      return total(dice);
  }
  return 0;
}
const upperSubtotal = (s) => UPPER.reduce((a, cat) => a + (s[cat] ?? 0), 0);
const upperBonus = (s) => (upperSubtotal(s) >= 63 ? 35 : 0);
function grandTotal(s, yb = 0) {
  let sum = 0;
  for (const cat of CATEGORIES) sum += s[cat] ?? 0;
  return sum + upperBonus(s) + yb;
}

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const eq = (got, want, label) => (got === want ? ok(`${label} = ${want}`) : fail(`${label} = ${got} (want ${want})`));

// Upper section.
eq(scoreFor('ones', [1, 1, 1, 4, 5]), 3, 'three ones');
eq(scoreFor('fours', [4, 4, 2, 4, 6]), 12, 'three fours');
eq(scoreFor('sixes', [1, 2, 3, 4, 5]), 0, 'no sixes');

// Of-a-kind (score the full dice total).
eq(scoreFor('threeKind', [3, 3, 3, 2, 6]), 17, 'three of a kind = sum');
eq(scoreFor('threeKind', [3, 3, 2, 1, 6]), 0, 'no triple → 0');
eq(scoreFor('fourKind', [5, 5, 5, 5, 2]), 22, 'four of a kind = sum');
eq(scoreFor('fourKind', [5, 5, 5, 1, 2]), 0, 'no quad → 0');

// Full house (incl. five-of-a-kind as a full house).
eq(scoreFor('fullHouse', [2, 2, 5, 5, 5]), 25, 'full house');
eq(scoreFor('fullHouse', [2, 2, 2, 2, 5]), 0, 'four+one is not a full house');
eq(scoreFor('fullHouse', [4, 4, 4, 4, 4]), 25, 'five of a kind counts as full house');

// Straights.
eq(scoreFor('smallStraight', [1, 2, 3, 4, 4]), 30, 'small straight 1-2-3-4');
eq(scoreFor('smallStraight', [3, 4, 5, 6, 6]), 30, 'small straight 3-4-5-6');
eq(scoreFor('smallStraight', [1, 2, 3, 5, 6]), 0, 'broken run → no small straight');
eq(scoreFor('largeStraight', [2, 3, 4, 5, 6]), 40, 'large straight 2-6');
eq(scoreFor('largeStraight', [1, 2, 3, 4, 6]), 0, 'no large straight');

// Yahtzee & chance.
eq(scoreFor('yahtzee', [6, 6, 6, 6, 6]), 50, 'yahtzee');
eq(scoreFor('yahtzee', [6, 6, 6, 6, 1]), 0, 'four of a kind is not a yahtzee');
eq(scoreFor('chance', [2, 3, 3, 5, 6]), 19, 'chance = sum');

// Upper bonus + grand total.
{
  const s = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 }; // subtotal 63
  eq(upperBonus(s), 35, 'upper bonus at 63');
  const s2 = { ...s, sixes: 12 }; // subtotal 57
  eq(upperBonus(s2), 0, 'no bonus below 63');
  eq(grandTotal(s, 0), 63 + 35, 'grand total includes the upper bonus');
  eq(grandTotal({ yahtzee: 50 }, 100), 150, 'grand total includes a yahtzee bonus');
}

if (failures) {
  console.error(`\nYACHT: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nYACHT: all checks passed ✓');
}
