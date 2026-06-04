// Verifies the tier ladder (mirrors src/lib/tiers.ts): seven ascending rungs,
// correct rung for a score (incl. boundaries / out-of-range), and progress math
// toward the next tier. Run: node scripts/verify-tiers.mjs
const TIERS = [
  { id: 'novice', min: 0 },
  { id: 'bronze', min: 15 },
  { id: 'silver', min: 30 },
  { id: 'gold', min: 45 },
  { id: 'platinum', min: 60 },
  { id: 'diamond', min: 75 },
  { id: 'master', min: 90 },
];
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
function tierIndexForScore(score) {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (score >= TIERS[i].min) idx = i;
  return idx;
}
const tierForScore = (s) => TIERS[tierIndexForScore(s)];
function tierProgress(score) {
  const idx = tierIndexForScore(score);
  const tier = TIERS[idx];
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  if (!next) return { tier, next: null, frac: 1, toNext: 0 };
  const span = next.min - tier.min;
  const into = clamp(score, tier.min, next.min) - tier.min;
  return { tier, next, frac: span > 0 ? into / span : 1, toNext: Math.max(0, Math.ceil(next.min - score)) };
}

let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

// Ascending, evenly spaced rungs.
if (TIERS.length !== 7) fail(`expected 7 tiers, got ${TIERS.length}`);
let asc = true;
for (let i = 1; i < TIERS.length; i++) if (TIERS[i].min <= TIERS[i - 1].min) asc = false;
if (!asc) fail('tier thresholds are not strictly ascending');
if (asc && TIERS.length === 7) console.log('  ✓ 7 ascending rungs (Novice → Master)');

// Boundary classification.
const cases = [
  [-5, 'novice'],
  [0, 'novice'],
  [14, 'novice'],
  [15, 'bronze'],
  [44, 'silver'],
  [45, 'gold'],
  [74, 'platinum'],
  [75, 'diamond'],
  [89, 'diamond'],
  [90, 'master'],
  [100, 'master'],
  [250, 'master'],
];
let clsOk = true;
for (const [score, id] of cases) {
  const got = tierForScore(score).id;
  if (got !== id) (clsOk = false), fail(`score ${score} → ${got}, expected ${id}`);
}
if (clsOk) console.log('  ✓ scores map to the right rung at every boundary');

// Progress toward the next tier.
const top = tierProgress(95);
if (top.next !== null || top.frac !== 1 || top.toNext !== 0) fail('master should be terminal (next=null, frac=1, toNext=0)');
else console.log('  ✓ Master is terminal (no next tier)');

const atFloor = tierProgress(15); // exactly bronze floor
if (atFloor.tier.id !== 'bronze' || atFloor.next.id !== 'silver' || atFloor.frac !== 0 || atFloor.toNext !== 15)
  fail(`bronze floor progress wrong: ${JSON.stringify(atFloor)}`);
else console.log('  ✓ at a tier floor, frac=0 and toNext spans the full band');

const mid = tierProgress(22); // bronze band 15..30
if (mid.tier.id !== 'bronze' || Math.abs(mid.frac - 7 / 15) > 1e-9 || mid.toNext !== 8)
  fail(`mid-band progress wrong: ${JSON.stringify(mid)}`);
else console.log('  ✓ mid-band frac and toNext computed correctly');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: tier ladder verified.');
