// Verifies reaction's score mapping (mirrors reactionQuality in ReactionGame.tsx).
// Faster average → higher quality, clamped to [0,1], monotonic. Run: node scripts/verify-reaction.mjs
function reactionQuality(avg) {
  const c = (450 - avg) / 270;
  return c < 0 ? 0 : c > 1 ? 1 : c;
}
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

if (reactionQuality(180) !== 1) fail('180ms should be top quality');
else console.log('  ✓ very fast (180ms) → quality 1');
if (reactionQuality(450) !== 0) fail('450ms should be zero quality');
else console.log('  ✓ slow (450ms) → quality 0');
if (reactionQuality(1000) !== 0) fail('clamp below 0 failed');
else console.log('  ✓ clamped to [0,1]');
let mono = true;
let prev = 1.1;
for (let ms = 100; ms <= 700; ms += 5) {
  const q = reactionQuality(ms);
  if (q > prev + 1e-9) mono = false;
  prev = q;
}
if (!mono) fail('quality not monotonic in time');
else console.log('  ✓ quality is monotonic (faster is better)');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Reaction mapping verified.');
