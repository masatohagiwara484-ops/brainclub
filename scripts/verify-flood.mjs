// Verifies Flood-It mechanics (mirrors FloodGame.tsx): floodFill recolors only the
// origin-connected region, and isOneColor detects a finished board.
// Run: node scripts/verify-flood.mjs
function floodFill(board, n, target) {
  const origin = board[0];
  if (origin === target) return board.slice();
  const g = board.slice();
  const stack = [0];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (g[cur] !== origin) continue;
    g[cur] = target;
    const r = Math.floor(cur / n);
    const c = cur % n;
    if (r > 0) stack.push(cur - n);
    if (r < n - 1) stack.push(cur + n);
    if (c > 0) stack.push(cur - 1);
    if (c < n - 1) stack.push(cur + 1);
  }
  return g;
}
const isOneColor = (b) => b.every((v) => v === b[0]);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// 2×2: origin region {0,1,3} (all colour 0, connected); idx2 (colour 1) untouched
if (!eq(floodFill([0, 0, 1, 0], 2, 2), [2, 2, 1, 2])) fail('flood recolored the wrong region');
else console.log('  ✓ recolors only the origin-connected region');

// disconnected same-colour cell stays put
if (!eq(floodFill([0, 1, 1, 0], 2, 2), [2, 1, 1, 0])) fail('disconnected same-colour cell was changed');
else console.log('  ✓ disconnected same-colour cells are left alone');

if (!isOneColor([3, 3, 3, 3])) fail('uniform board not detected');
if (isOneColor([3, 3, 1, 3])) fail('non-uniform board reported uniform');
console.log('  ✓ isOneColor detects a finished board');

// filling a whole single-region board ends it
if (!isOneColor(floodFill([0, 0, 0, 0], 2, 5))) fail('full fill did not finish');
else console.log('  ✓ flooding a single-region board finishes it');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Flood-It mechanics verified.');
