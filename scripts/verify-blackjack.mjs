// Verifies the Blackjack engine (mirrors src/games/blackjack/blackjackEngine.ts):
// hand values with soft/hard aces, blackjack/bust detection, the dealer policy,
// a few basic-strategy spots, and settlement payouts. Pure, dependency-free.
//   node scripts/verify-blackjack.mjs

const C = (r, s = 0) => ({ r, s });
const cardValue = (r) => (r === 1 ? 11 : r >= 10 ? 10 : r);
function handValue(cards) {
  let total = 0,
    aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === 1) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
const isBust = (cards) => handValue(cards).total > 21;
const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;
function dealerShouldHit(cards, hitSoft17) {
  const { total, soft } = handValue(cards);
  if (total < 17) return true;
  return total === 17 && soft && hitSoft17;
}
function basicAction(cards, dealerUp, canDouble) {
  const { total, soft } = handValue(cards);
  const up = cardValue(dealerUp.r);
  const dbl = (want) => (want && canDouble ? 'double' : 'hit');
  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) {
      if (up >= 9 || up === 11) return 'hit';
      if (up >= 3 && up <= 6) return dbl(true);
      return 'stand';
    }
    if (total === 17) return up >= 3 && up <= 6 ? dbl(true) : 'hit';
    if (total === 16 || total === 15) return up >= 4 && up <= 6 ? dbl(true) : 'hit';
    return up >= 5 && up <= 6 ? dbl(true) : 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return up >= 2 && up <= 6 ? 'stand' : 'hit';
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (total === 11) return dbl(up <= 10);
  if (total === 10) return dbl(up >= 2 && up <= 9);
  if (total === 9) return dbl(up >= 3 && up <= 6);
  return 'hit';
}
function settle(player, dealer, bet, blackjackPays) {
  const pBJ = isBlackjack(player),
    dBJ = isBlackjack(dealer);
  if (pBJ || dBJ) {
    if (pBJ && dBJ) return 0;
    return pBJ ? Math.round(bet * blackjackPays) : -bet;
  }
  if (isBust(player)) return -bet;
  if (isBust(dealer)) return bet;
  const p = handValue(player).total,
    d = handValue(dealer).total;
  return p > d ? bet : p < d ? -bet : 0;
}

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const eq = (g, w, l) => (JSON.stringify(g) === JSON.stringify(w) ? ok(`${l} = ${JSON.stringify(w)}`) : fail(`${l} = ${JSON.stringify(g)} (want ${JSON.stringify(w)})`));

// Hand values: soft vs hard aces.
eq(handValue([C(1), C(6)]), { total: 17, soft: true }, 'A+6 = soft 17');
eq(handValue([C(1), C(6), C(10)]), { total: 17, soft: false }, 'A+6+10 = hard 17');
eq(handValue([C(1), C(1), C(9)]), { total: 21, soft: true }, 'A+A+9 = soft 21');
eq(handValue([C(10), C(10), C(5)]), { total: 25, soft: false }, '10+10+5 = 25 (bust)');

// Blackjack / bust.
if (isBlackjack([C(1), C(13)])) ok('A+K is a blackjack');
else fail('A+K should be blackjack');
if (!isBlackjack([C(1), C(6), C(4)])) ok('three-card 21 is not a blackjack');
else fail('three-card 21 should not be blackjack');
if (isBust([C(10), C(7), C(8)])) ok('25 is a bust');
else fail('25 should be a bust');

// Dealer policy.
if (dealerShouldHit([C(10), C(6)], false)) ok('dealer hits 16');
else fail('dealer should hit 16');
if (!dealerShouldHit([C(10), C(7)], false)) ok('dealer stands on hard 17');
else fail('dealer should stand on hard 17');
if (dealerShouldHit([C(1), C(6)], true)) ok('dealer hits soft 17 when the rule is on');
else fail('dealer should hit soft 17 under H17');
if (!dealerShouldHit([C(1), C(6)], false)) ok('dealer stands on soft 17 under S17');
else fail('dealer should stand on soft 17 under S17');

// Basic strategy spots.
eq(basicAction([C(10), C(6)], C(10), true), 'hit', '16 vs 10 → hit');
eq(basicAction([C(10), C(2)], C(4), true), 'stand', '12 vs 4 → stand');
eq(basicAction([C(6), C(5)], C(7), true), 'double', '11 vs 7 → double');
eq(basicAction([C(6), C(5)], C(7), false), 'hit', '11 vs 7 with no double → hit');
eq(basicAction([C(1), C(7)], C(9), true), 'hit', 'soft 18 vs 9 → hit');
eq(basicAction([C(1), C(7)], C(2), true), 'stand', 'soft 18 vs 2 → stand');
eq(basicAction([C(10), C(7)], C(1), true), 'stand', 'hard 17 vs A → stand');

// Settlement.
eq(settle([C(1), C(13)], [C(10), C(9)], 100, 1.5), 150, 'blackjack pays 3:2');
eq(settle([C(1), C(13)], [C(1), C(10)], 100, 1.5), 0, 'both blackjack → push');
eq(settle([C(10), C(9)], [C(10), C(7)], 100, 1.5), 100, '19 beats 17');
eq(settle([C(10), C(7)], [C(10), C(9)], 100, 1.5), -100, '17 loses to 19');
eq(settle([C(10), C(8)], [C(10), C(8)], 100, 1.5), 0, 'equal totals push');
eq(settle([C(10), C(7), C(8)], [C(10), C(7)], 100, 1.5), -100, 'player bust loses even if dealer low');
eq(settle([C(10), C(9)], [C(10), C(7), C(8)], 100, 1.5), 100, 'dealer bust pays');

if (failures) {
  console.error(`\nBLACKJACK: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nBLACKJACK: all checks passed ✓');
}
