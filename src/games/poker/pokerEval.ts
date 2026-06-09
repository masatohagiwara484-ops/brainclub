// Texas Hold'em hand evaluation — pure.
//
// Cards use rank 2..14 (J=11, Q=12, K=13, A=14) and suit 0..3. `rank5` scores a
// five-card hand as a comparable array [category, ...tiebreakers]; `evaluate7`
// returns the best five-card score out of seven. Categories: 0 high card, 1 pair,
// 2 two pair, 3 trips, 4 straight, 5 flush, 6 full house, 7 quads, 8 straight
// flush. Mirrored in scripts/verify-poker.mjs.

export type Card = { r: number; s: number };

export function fullDeck(): Card[] {
  const d: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s });
  return d;
}

export function shuffle(cards: Card[], rng: () => number): Card[] {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Score a 5-card hand as [category, ...tiebreakers] (compare lexicographically). */
export function rank5(cards: Card[]): number[] {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);

  let straight = false;
  let sHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) {
      straight = true;
      sHigh = uniq[0];
    } else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) {
      straight = true; // wheel: A-2-3-4-5, the ace plays low
      sHigh = 5;
    }
  }

  const cnt = new Map<number, number>();
  for (const r of ranks) cnt.set(r, (cnt.get(r) ?? 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]); // [rank, count]
  const kickers = groups.map((g) => g[0]);

  if (straight && flush) return [8, sHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, sHigh];
  if (groups[0][1] === 3) return [3, ...kickers];
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
  if (groups[0][1] === 2) return [1, ...kickers];
  return [0, ...ranks];
}

/** Lexicographic comparison of two scores: >0 if a is the better hand. */
export function compare(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// All 5-card combinations of 7 cards (21 of them).
function combos5(cards: Card[]): Card[][] {
  const out: Card[][] = [];
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) out.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return out;
}

/** Best five-card score from up to seven cards. */
export function evaluate7(cards: Card[]): number[] {
  if (cards.length < 5) return rank5(cards.concat(cards).slice(0, 5));
  if (cards.length === 5) return rank5(cards);
  let best: number[] | null = null;
  for (const combo of combos5(cards)) {
    const s = rank5(combo);
    if (!best || compare(s, best) > 0) best = s;
  }
  return best!;
}

export const HAND_NAMES = [
  'High card',
  'Pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
];

/** Rough preflop strength of two hole cards in 0..1 (drives AI decisions). */
export function holeStrength(c1: Card, c2: Card): number {
  const hi = Math.max(c1.r, c2.r);
  const lo = Math.min(c1.r, c2.r);
  const suited = c1.s === c2.s;
  if (c1.r === c2.r) return clamp01(0.5 + (c1.r / 14) * 0.5); // a pair
  let s = (hi / 14) * 0.42 + (lo / 14) * 0.22;
  if (suited) s += 0.1;
  const gap = hi - lo;
  if (gap === 1) s += 0.08;
  else if (gap <= 3) s += 0.03;
  if (hi === 14) s += 0.04;
  return clamp01(s);
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
