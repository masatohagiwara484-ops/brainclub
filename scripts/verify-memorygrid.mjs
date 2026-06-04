// Verifies Memory Grid pattern picking (mirrors pickCells in MemoryGridGame.tsx):
// exactly k distinct in-range indices, sorted. Run: node scripts/verify-memorygrid.mjs
function pickCells(total, k, rnd) {
  const pool = Array.from({ length: total }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k).sort((a, b) => a - b);
}
let seed = 7;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

const total = 25;
let ok = true;
for (let k = 1; k <= 12; k++) {
  for (let t = 0; t < 200; t++) {
    const cells = pickCells(total, k, rng);
    if (cells.length !== k) ok = false;
    if (new Set(cells).size !== k) ok = false;
    if (cells.some((c) => c < 0 || c >= total)) ok = false;
    for (let i = 1; i < cells.length; i++) if (cells[i] <= cells[i - 1]) ok = false;
  }
}
if (!ok) fail('pickCells produced bad output');
else console.log('  ✓ k distinct, in-range, sorted cells for k=1..12');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Memory Grid picking verified.');
