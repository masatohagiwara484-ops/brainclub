// Verifies Schulte board generation (mirrors makeBoard in SchulteGame.tsx):
// the board is always a complete permutation of 1..n². Run: node scripts/verify-schulte.mjs
function makeBoard(n, rng) {
  const a = Array.from({ length: n * n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let seed = 99;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

for (const n of [3, 4, 5, 6]) {
  let ok = true;
  for (let t = 0; t < 200; t++) {
    const b = makeBoard(n, rng);
    const sorted = b.slice().sort((x, y) => x - y);
    for (let i = 0; i < n * n; i++) if (sorted[i] !== i + 1) ok = false;
    if (b.length !== n * n) ok = false;
  }
  if (!ok) fail(`${n}×${n} board is not a clean permutation`);
  else console.log(`  ✓ ${n}×${n}: permutation of 1..${n * n} over 200 shuffles`);
}

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Schulte board verified.');
