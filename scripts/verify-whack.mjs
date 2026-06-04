// Verifies the mole-relocation rule (mirrors nextHole in WhackGame.tsx):
// the next hole is always in range and never the current one. Run: node scripts/verify-whack.mjs
function nextHole(current, holes, rnd) {
  let h = current;
  while (h === current) h = Math.floor(rnd() * holes);
  return h;
}
let seed = 3;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

const HOLES = 9;
let cur = 0;
let ok = true;
for (let i = 0; i < 10000; i++) {
  const n = nextHole(cur, HOLES, rng);
  if (n === cur || n < 0 || n >= HOLES) ok = false;
  cur = n;
}
if (!ok) fail('nextHole returned current or out-of-range');
else console.log('  ✓ 10000 relocations: always different and in [0,9)');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Mole Tap relocation verified.');
