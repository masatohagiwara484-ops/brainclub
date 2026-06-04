// Verifies 2048 line mechanics (mirrors Game2048.tsx): compress merges each tile
// at most once, applyMove detects real movement, hasMoves spots a dead board.
// Run: node scripts/verify-2048.mjs
function compress(line) {
  const nz = line.filter((x) => x !== 0);
  const out = [];
  let gained = 0;
  for (let i = 0; i < nz.length; i++) {
    if (i + 1 < nz.length && nz[i] === nz[i + 1]) {
      out.push(nz[i] * 2);
      gained += nz[i] * 2;
      i++;
    } else out.push(nz[i]);
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}
function lineIndices(n, dir) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const line = [];
    for (let j = 0; j < n; j++) {
      if (dir === 'left') line.push(i * n + j);
      else if (dir === 'right') line.push(i * n + (n - 1 - j));
      else if (dir === 'up') line.push(j * n + i);
      else line.push((n - 1 - j) * n + i);
    }
    lines.push(line);
  }
  return lines;
}
function applyMove(board, n, dir) {
  const g = board.slice();
  let gained = 0;
  let moved = false;
  for (const line of lineIndices(n, dir)) {
    const vals = line.map((ix) => g[ix]);
    const { line: nl, gained: ga } = compress(vals);
    gained += ga;
    for (let k = 0; k < line.length; k++) {
      if (g[line[k]] !== nl[k]) moved = true;
      g[line[k]] = nl[k];
    }
  }
  return { board: g, gained, moved };
}
function hasMoves(board, n) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) return true;
    const r = Math.floor(i / n);
    const c = i % n;
    if (c + 1 < n && board[i] === board[i + 1]) return true;
    if (r + 1 < n && board[i] === board[i + n]) return true;
  }
  return false;
}
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const cases = [
  [[2, 2, 4, 0], [4, 4, 0, 0], 4],
  [[2, 2, 2, 2], [4, 4, 0, 0], 8],
  [[4, 4, 4, 0], [8, 4, 0, 0], 8],
  [[0, 0, 2, 2], [4, 0, 0, 0], 4],
  [[2, 4, 2, 4], [2, 4, 2, 4], 0],
  [[0, 0, 0, 0], [0, 0, 0, 0], 0],
];
let cOk = true;
for (const [inp, exp, g] of cases) {
  const r = compress(inp);
  if (!eq(r.line, exp) || r.gained !== g) cOk = false;
}
if (!cOk) fail('compress merge/score is wrong');
else console.log('  ✓ compress merges once with correct score');

const left = applyMove([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4, 'left');
if (!left.moved) fail('applyMove missed a real move');
else console.log('  ✓ applyMove detects movement');
const none = applyMove([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4, 'left');
if (none.moved) fail('applyMove flagged a no-op as a move');
else console.log('  ✓ applyMove reports no-op when nothing slides');

if (hasMoves([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], 4)) fail('dead board reported as playable');
else console.log('  ✓ hasMoves detects a full, unmergeable board');
if (!hasMoves([2, 2, 0, 0], 2)) fail('playable board reported dead');
else console.log('  ✓ hasMoves detects a playable board');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: 2048 mechanics verified.');
