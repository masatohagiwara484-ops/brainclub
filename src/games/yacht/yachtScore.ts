// Yacht (Yahtzee-style) — pure scoring logic for the 13 categories.
//
// Five dice, thirteen rounds: each round you roll up to three times (holding any
// dice between rolls), then bank the result in one unused category. The upper
// section (Ones…Sixes) earns a +35 bonus once its subtotal reaches 63; a second
// (and further) Yahtzee earns a +100 bonus. Everything here is pure and mirrored
// in scripts/verify-yacht.mjs.

export const CATEGORIES = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const UPPER: Category[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER: Category[] = [
  'threeKind',
  'fourKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'yahtzee',
  'chance',
];

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;
export const YAHTZEE_BONUS = 100;

export type Dice = number[]; // length 5, faces 1..6
export type Scores = Partial<Record<Category, number>>;

function faceCounts(dice: Dice): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0]; // index 1..6
  for (const d of dice) if (d >= 1 && d <= 6) c[d]++;
  return c;
}
const total = (dice: Dice): number => dice.reduce((s, d) => s + d, 0);
const faceValue = (cat: Category): number => UPPER.indexOf(cat) + 1; // ones→1 … sixes→6

/** The score `cat` would earn for these dice (0 when the dice don't qualify). */
export function scoreFor(cat: Category, dice: Dice): number {
  if (dice.length !== 5) return 0;
  const c = faceCounts(dice);
  const max = Math.max(...c);
  switch (cat) {
    case 'ones':
    case 'twos':
    case 'threes':
    case 'fours':
    case 'fives':
    case 'sixes': {
      const f = faceValue(cat);
      return c[f] * f;
    }
    case 'threeKind':
      return max >= 3 ? total(dice) : 0;
    case 'fourKind':
      return max >= 4 ? total(dice) : 0;
    case 'fullHouse': {
      const has3 = c.includes(3);
      const has2 = c.includes(2);
      return (has3 && has2) || c.includes(5) ? 25 : 0; // 5-of-a-kind counts as a full house
    }
    case 'smallStraight':
      return hasRun(c, 4) ? 30 : 0;
    case 'largeStraight':
      return hasRun(c, 5) ? 40 : 0;
    case 'yahtzee':
      return max >= 5 ? 50 : 0;
    case 'chance':
      return total(dice);
  }
}

// Does the dice set contain a run of `len` consecutive faces?
function hasRun(counts: number[], len: number): boolean {
  let run = 0;
  for (let f = 1; f <= 6; f++) {
    if (counts[f] > 0) {
      run++;
      if (run >= len) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/** True when the dice are five of a kind. */
export function isYahtzee(dice: Dice): boolean {
  return dice.length === 5 && Math.max(...faceCounts(dice)) >= 5;
}

export function upperSubtotal(scores: Scores): number {
  return UPPER.reduce((s, cat) => s + (scores[cat] ?? 0), 0);
}
export function upperBonus(scores: Scores): number {
  return upperSubtotal(scores) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
}

/** Final score: every banked category + the upper bonus + any Yahtzee bonuses. */
export function grandTotal(scores: Scores, yahtzeeBonus = 0): number {
  let sum = 0;
  for (const cat of CATEGORIES) sum += scores[cat] ?? 0;
  return sum + upperBonus(scores) + yahtzeeBonus;
}

export function allFilled(scores: Scores): boolean {
  return CATEGORIES.every((cat) => scores[cat] !== undefined);
}
