// Verifies the Elo rating math (mirrors src/lib/elo.ts): logistic expectation,
// symmetry / zero-sum exchange, upset vs. expected-win deltas, and the display
// rank boundaries. Run: node scripts/verify-elo.mjs
const ELO_START = 1000;
const ELO_K = 32;

const expectedScore = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
const updateElo = (r, o, s, k = ELO_K) => Math.round(r + k * (s - expectedScore(r, o)));
const applyResult = (w, l, k = ELO_K) => ({ winner: updateElo(w, l, 1, k), loser: updateElo(l, w, 0, k) });

const ELO_RANKS = [
  { id: 'bronze', min: 0 },
  { id: 'silver', min: 1000 },
  { id: 'gold', min: 1150 },
  { id: 'platinum', min: 1300 },
  { id: 'diamond', min: 1450 },
  { id: 'master', min: 1650 },
  { id: 'grandmaster', min: 1850 },
];
function eloRank(elo) {
  let rank = ELO_RANKS[0];
  for (const r of ELO_RANKS) if (elo >= r.min) rank = r;
  return rank;
}

let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// Equal ratings → coin flip.
if (!approx(expectedScore(1500, 1500), 0.5)) fail('equal ratings should expect 0.5');
else console.log('  ✓ equal ratings expect 0.5');

// Expectations are complementary (probabilities sum to 1).
let symOk = true;
for (const [a, b] of [[1000, 1200], [1500, 1400], [800, 2200], [1000, 1000]])
  if (!approx(expectedScore(a, b) + expectedScore(b, a), 1)) symOk = false;
if (!symOk) fail('expectedScore(a,b) + expectedScore(b,a) must equal 1');
else console.log('  ✓ expectations are complementary (sum to 1)');

// Higher rating ⇒ higher win probability.
if (!(expectedScore(1600, 1400) > 0.5 && expectedScore(1400, 1600) < 0.5))
  fail('higher-rated player must have >0.5 expectation');
else console.log('  ✓ higher rating yields higher win probability');

// A 400-point edge ≈ 10:1 odds (classic Elo anchor).
if (!approx(expectedScore(1400, 1000), 10 / 11, 1e-6)) fail('400-pt gap should be ~0.909');
else console.log('  ✓ a 400-point gap gives ~91% expectation');

// Decisive game is (near) zero-sum: winner gains what loser drops.
{
  const { winner, loser } = applyResult(1500, 1500);
  if (winner - 1500 !== 1500 - loser) fail(`equal-rating swap not symmetric: +${winner - 1500} / ${1500 - loser}`);
  else if (winner - 1500 !== ELO_K / 2) fail('equal-rating winner should gain K/2 = 16');
  else console.log('  ✓ equal-rating decisive game swaps ±16 (zero-sum)');
}

// Upset (low beats high) moves more than an expected win.
{
  const expectedWin = applyResult(1800, 1200).winner - 1800; // favorite wins
  const upsetWin = applyResult(1200, 1800).winner - 1200;    // underdog wins
  if (!(upsetWin > expectedWin)) fail(`upset gain (${upsetWin}) should exceed expected-win gain (${expectedWin})`);
  else console.log(`  ✓ upset rewards more than an expected win (+${upsetWin} vs +${expectedWin})`);
}

// Ratings never run away: favorite beating an underdog gains only a little.
{
  const gain = applyResult(2000, 1000).winner - 2000;
  if (!(gain >= 0 && gain <= 3)) fail(`huge-favorite win gain out of range: ${gain}`);
  else console.log(`  ✓ a near-certain win nudges rating only slightly (+${gain})`);
}

// New player starts in Silver; boundaries classify correctly.
const rankCases = [
  [999, 'bronze'],
  [ELO_START, 'silver'],
  [1149, 'silver'],
  [1150, 'gold'],
  [1300, 'platinum'],
  [1449, 'platinum'],
  [1450, 'diamond'],
  [1850, 'grandmaster'],
  [3000, 'grandmaster'],
];
let rankOk = true;
for (const [elo, id] of rankCases) {
  const got = eloRank(elo).id;
  if (got !== id) (rankOk = false), fail(`elo ${elo} → ${got}, expected ${id}`);
}
if (rankOk) console.log('  ✓ ratings map to the right display rank at every boundary');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Elo rating math verified.');
