// Verifies the poker hand evaluator (mirrors src/games/poker/pokerEval.ts): the
// category ordering, straight/flush/wheel detection, kicker tiebreaks, and that
// evaluate7 picks the best five of seven. Pure, dependency-free.
//   node scripts/verify-poker.mjs

const C = (r, s) => ({ r, s });
function rank5(cards) {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straight = false,
    sHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) {
      straight = true;
      sHigh = uniq[0];
    } else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) {
      straight = true;
      sHigh = 5;
    }
  }
  const cnt = new Map();
  for (const r of ranks) cnt.set(r, (cnt.get(r) ?? 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
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
function compare(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
function combos5(cards) {
  const out = [];
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) out.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return out;
}
function evaluate7(cards) {
  let best = null;
  for (const combo of combos5(cards)) {
    const s = rank5(combo);
    if (!best || compare(s, best) > 0) best = s;
  }
  return best;
}
function settlePots(players, community) {
  const gains = players.map(() => 0);
  const awards = [];
  const levels = [...new Set(players.filter((p) => p.total > 0).map((p) => p.total))].sort((a, b) => a - b);
  let prev = 0,
    potIndex = 0;
  const score = new Map();
  for (const p of players) if (!p.folded) score.set(p.id, evaluate7([...p.hole, ...community]));
  for (const level of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.total, level) - prev);
    const eligible = players.filter((p) => !p.folded && p.total >= level);
    if (amount > 0 && eligible.length > 0) {
      let best = null;
      for (const p of eligible) {
        const sc = score.get(p.id);
        if (!best || compare(sc, best) > 0) best = sc;
      }
      const winners = eligible.filter((p) => compare(score.get(p.id), best) === 0).map((p) => p.id);
      const share = Math.floor(amount / winners.length);
      let rem = amount - share * winners.length;
      for (const id of winners) {
        gains[id] += share + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
      }
      awards.push({ potIndex: potIndex++, amount, winners });
    }
    prev = level;
  }
  return { gains, awards };
}

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => (console.error('  ✗ ' + m), failures++);

// Category of representative 5-card hands, strongest → weakest.
const sf = [C(10, 0), C(11, 0), C(12, 0), C(13, 0), C(14, 0)]; // royal/straight flush
const quads = [C(9, 0), C(9, 1), C(9, 2), C(9, 3), C(2, 0)];
const boat = [C(8, 0), C(8, 1), C(8, 2), C(3, 0), C(3, 1)];
const flush = [C(2, 1), C(5, 1), C(9, 1), C(11, 1), C(14, 1)];
const straight = [C(5, 0), C(6, 1), C(7, 2), C(8, 3), C(9, 0)];
const trips = [C(7, 0), C(7, 1), C(7, 2), C(2, 0), C(5, 1)];
const twoPair = [C(7, 0), C(7, 1), C(4, 2), C(4, 0), C(9, 1)];
const pair = [C(7, 0), C(7, 1), C(4, 2), C(2, 0), C(9, 1)];
const high = [C(2, 0), C(5, 1), C(9, 2), C(11, 3), C(14, 0)];
const order = [sf, quads, boat, flush, straight, trips, twoPair, pair, high];
const cats = order.map((h) => rank5(h)[0]);
if (cats.join() === '8,7,6,5,4,3,2,1,0') ok('the nine categories rank 8→0 in order');
else fail(`categories = ${cats.join()}`);

let descending = true;
for (let i = 1; i < order.length; i++) if (compare(rank5(order[i - 1]), rank5(order[i])) <= 0) descending = false;
if (descending) ok('each hand strictly beats the next-weaker one');
else fail('strength ordering is not strictly descending');

// Wheel straight (A-2-3-4-5) is a 5-high straight, beaten by a 6-high straight.
const wheel = [C(14, 0), C(2, 1), C(3, 2), C(4, 3), C(5, 0)];
if (rank5(wheel)[0] === 4 && rank5(wheel)[1] === 5) ok('A-2-3-4-5 is a 5-high straight');
else fail(`wheel = ${rank5(wheel)}`);
const sixHigh = [C(2, 0), C(3, 1), C(4, 2), C(5, 3), C(6, 0)];
if (compare(rank5(sixHigh), rank5(wheel)) > 0) ok('a 6-high straight beats the wheel');
else fail('6-high straight should beat the wheel');
// Broadway (10-J-Q-K-A) beats the wheel and is the best straight.
const broadway = [C(10, 0), C(11, 1), C(12, 2), C(13, 3), C(14, 0)];
if (compare(rank5(broadway), rank5(sixHigh)) > 0) ok('Broadway is the highest straight');
else fail('Broadway should be the highest straight');

// Kicker tiebreaks.
const pairAce = [C(8, 0), C(8, 1), C(14, 2), C(3, 0), C(2, 1)];
const pairKing = [C(8, 2), C(8, 3), C(13, 0), C(3, 1), C(2, 2)];
if (compare(rank5(pairAce), rank5(pairKing)) > 0) ok('pair of 8s with an ace kicker beats one with a king');
else fail('ace kicker should win');

// evaluate7 picks the best five of seven (here, a flush hidden among 7).
const seven = [C(2, 1), C(5, 1), C(9, 1), C(11, 1), C(14, 1), C(14, 2), C(14, 3)];
if (evaluate7(seven)[0] === 5) ok('evaluate7 finds the flush (over trip aces)');
else fail(`evaluate7 category = ${evaluate7(seven)[0]} (want 5)`);
// Seven cards making a full house from trips + a pair on board.
const boatSeven = [C(8, 0), C(8, 1), C(8, 2), C(3, 0), C(3, 1), C(2, 2), C(5, 3)];
if (evaluate7(boatSeven)[0] === 6) ok('evaluate7 finds the full house');
else fail(`evaluate7 category = ${evaluate7(boatSeven)[0]} (want 6)`);

// Side pots: a short all-in wins only the main pot; the rest forms a side pot.
{
  const board = [C(2, 0), C(7, 1), C(9, 2), C(11, 3), C(13, 0)]; // 2 7 9 J K, no pairs
  const players = [
    { id: 0, total: 100, folded: false, hole: [C(14, 0), C(14, 1)] }, // pair of aces (best)
    { id: 1, total: 300, folded: false, hole: [C(13, 1), C(12, 0)] }, // pair of kings (second)
    { id: 2, total: 300, folded: false, hole: [C(7, 0), C(3, 0)] }, // pair of sevens (worst)
  ];
  const { gains, awards } = settlePots(players, board);
  if (gains[0] === 300 && gains[1] === 400 && gains[2] === 0)
    ok('side pots: short all-in wins the 300 main pot, second-best takes the 400 side');
  else fail(`side pot gains = ${gains.join(',')} (want 300,400,0)`);
  const totalPaid = gains.reduce((a, b) => a + b, 0);
  if (totalPaid === 700 && awards.length === 2) ok('every chip is paid out across exactly two pots');
  else fail(`paid ${totalPaid} over ${awards.length} pots (want 700 / 2)`);
}

if (failures) {
  console.error(`\nPOKER: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nPOKER: all checks passed ✓');
}
