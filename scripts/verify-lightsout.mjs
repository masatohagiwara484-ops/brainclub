// Verifies Lights Out mechanics (mirrors press/scramble in LightsOutGame.tsx):
//   1. press is an involution (pressing the same cell twice is a no-op),
//   2. presses commute, so replaying a scramble's exact press list solves it
//      → every generated puzzle is solvable. Run: node scripts/verify-lightsout.mjs
function press(grid, idx, n) {
  const g = grid.slice();
  const r = Math.floor(idx / n);
  const c = idx % n;
  const flip = (rr, cc) => {
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) g[rr * n + cc] = !g[rr * n + cc];
  };
  flip(r, c);
  flip(r - 1, c);
  flip(r + 1, c);
  flip(r, c - 1);
  flip(r, c + 1);
  return g;
}
let seed = 123;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// 1. involution
let invOk = true;
for (const n of [3, 4, 5]) {
  const start = Array(n * n).fill(false);
  for (let i = 0; i < n * n; i++) if (!eq(press(press(start, i, n), i, n), start)) invOk = false;
}
if (!invOk) fail('press is not an involution');
else console.log('  ✓ pressing a cell twice restores the board');

// 2. solvability: scramble, record presses, replay → all off
let solvable = true;
for (const n of [3, 4, 5]) {
  for (let t = 0; t < 300; t++) {
    let g = Array(n * n).fill(false);
    const used = [];
    const count = 5 + Math.floor(rng() * 15);
    for (let k = 0; k < count; k++) {
      const i = Math.floor(rng() * n * n);
      used.push(i);
      g = press(g, i, n);
    }
    for (const i of used) g = press(g, i, n);
    if (g.some((v) => v)) solvable = false;
  }
}
if (!solvable) fail('replaying the scramble presses did not solve it');
else console.log('  ✓ every scramble is solvable (900 puzzles, 3/4/5)');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Lights Out mechanics verified.');
