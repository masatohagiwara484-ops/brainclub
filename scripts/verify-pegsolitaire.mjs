// Verifies Peg Solitaire mechanics (mirrors PegSolitaireGame.tsx): the English
// cross has 32 pegs + 1 hole, initial legal jumps target the centre, and a jump
// removes exactly one peg. Run: node scripts/verify-pegsolitaire.mjs
const W = 7;
const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
function isCell(idx) {
  const r = Math.floor(idx / W);
  const c = idx % W;
  return (r >= 2 && r <= 4) || (c >= 2 && c <= 4);
}
function initialBoard() {
  return Array.from({ length: W * W }, (_, i) => (!isCell(i) ? -1 : i === 3 * W + 3 ? 0 : 1));
}
function jumpsFrom(board, idx) {
  if (board[idx] !== 1) return [];
  const r = Math.floor(idx / W);
  const c = idx % W;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const tr = r + 2 * dr;
    const tc = c + 2 * dc;
    if (tr < 0 || tr >= W || tc < 0 || tc >= W) continue;
    const over = (r + dr) * W + (c + dc);
    const to = tr * W + tc;
    if (board[over] === 1 && board[to] === 0) out.push({ from: idx, over, to });
  }
  return out;
}
function validJumps(board) {
  const all = [];
  for (let i = 0; i < board.length; i++) all.push(...jumpsFrom(board, i));
  return all;
}
function applyJump(board, j) {
  const g = board.slice();
  g[j.from] = 0;
  g[j.over] = 0;
  g[j.to] = 1;
  return g;
}
const pegCount = (b) => b.filter((v) => v === 1).length;
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

const cells = Array.from({ length: 49 }, (_, i) => i).filter(isCell).length;
if (cells !== 33) fail(`cross should have 33 cells, got ${cells}`);
else console.log('  ✓ board has 33 valid cells (English cross)');

const b0 = initialBoard();
if (pegCount(b0) !== 32) fail(`initial peg count should be 32, got ${pegCount(b0)}`);
else console.log('  ✓ starts with 32 pegs and one centre hole');

const j0 = validJumps(b0);
if (j0.length !== 4) fail(`initial position should have 4 jumps, got ${j0.length}`);
else console.log('  ✓ exactly 4 opening jumps (all into the centre)');
if (!j0.every((j) => j.to === 3 * W + 3)) fail('opening jumps should target the centre');

const b1 = applyJump(b0, j0[0]);
if (pegCount(b1) !== 31) fail('a jump should remove exactly one peg');
else console.log('  ✓ a jump removes exactly one peg');
if (b1[j0[0].to] !== 1 || b1[j0[0].over] !== 0 || b1[j0[0].from] !== 0) fail('jump did not move/remove correctly');
else console.log('  ✓ jump vacates from+over and fills the landing hole');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Peg Solitaire mechanics verified.');
