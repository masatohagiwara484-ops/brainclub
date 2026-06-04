// Verifies Slide Puzzle mechanics (mirrors SlideGame.tsx):
//   1. the solved board reads as solved,
//   2. a legal move is reversible,
//   3. a shuffle (random legal moves from solved) is always a permutation
//      → solvable by construction. Run: node scripts/verify-slide.mjs
function solvedBoard(n) {
  return Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
}
function isSolved(b) {
  return b.every((v, i) => v === (i + 1) % b.length);
}
function legalMoves(b, n) {
  const z = b.indexOf(0);
  const r = Math.floor(z / n);
  const c = z % n;
  const out = [];
  if (r > 0) out.push(z - n);
  if (r < n - 1) out.push(z + n);
  if (c > 0) out.push(z - 1);
  if (c < n - 1) out.push(z + 1);
  return out;
}
function move(b, idx, n) {
  if (!legalMoves(b, n).includes(idx)) return b;
  const z = b.indexOf(0);
  const g = b.slice();
  [g[z], g[idx]] = [g[idx], g[z]];
  return g;
}
function shuffleBoard(n, steps, rng) {
  let b = solvedBoard(n);
  let last = -1;
  for (let i = 0; i < steps; i++) {
    const opts = legalMoves(b, n).filter((m) => m !== last);
    const pick = opts[Math.floor(rng() * opts.length)];
    last = b.indexOf(0);
    b = move(b, pick, n);
  }
  return isSolved(b) ? shuffleBoard(n, steps + 1, rng) : b;
}
let seed = 555;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

for (const n of [3, 4, 5]) if (!isSolved(solvedBoard(n))) fail(`${n}: solved board not solved`);
console.log('  ✓ solved board reads as solved (3/4/5)');

// reversibility
let revOk = true;
for (const n of [3, 4, 5]) {
  const b = solvedBoard(n);
  const z = b.indexOf(0);
  for (const idx of legalMoves(b, n)) {
    const moved = move(b, idx, n);
    if (eq(moved, b)) revOk = false;
    if (!eq(move(moved, z, n), b)) revOk = false;
  }
}
if (!revOk) fail('a legal move was not reversible');
else console.log('  ✓ legal moves change the board and are reversible');

// shuffle is a permutation (and thus a real, solvable board)
let permOk = true;
for (const n of [3, 4, 5]) {
  for (let t = 0; t < 200; t++) {
    const b = shuffleBoard(n, 60, rng);
    const sorted = b.slice().sort((x, y) => x - y);
    for (let i = 0; i < n * n; i++) if (sorted[i] !== i) permOk = false;
    if (isSolved(b)) permOk = false;
  }
}
if (!permOk) fail('shuffle is not a clean unsolved permutation');
else console.log('  ✓ shuffles are unsolved permutations (600 boards)');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Slide Puzzle mechanics verified.');
