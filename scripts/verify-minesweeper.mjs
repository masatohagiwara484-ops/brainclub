// Verifies Minesweeper grid logic (mirrors MinesweeperGame.tsx): neighbour sets,
// adjacency counts, mine placement (count + first-click safety) and zero-flood.
// Run: node scripts/verify-minesweeper.mjs
function neighbors(idx, w, h) {
  const r = Math.floor(idx / w);
  const c = idx % w;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc);
    }
  return out;
}
function placeMines(total, count, safe, rng) {
  const set = new Set();
  let guard = 0;
  while (set.size < count && guard++ < total * 50) {
    const i = Math.floor(rng() * total);
    if (safe.has(i) || set.has(i)) continue;
    set.add(i);
  }
  return set;
}
function computeCounts(mines, w, h) {
  return Array.from({ length: w * h }, (_, i) =>
    mines.has(i) ? -1 : neighbors(i, w, h).filter((n) => mines.has(n)).length,
  );
}
function flood(idx, revealed, counts, mines, w, h) {
  const stack = [idx];
  while (stack.length) {
    const cur = stack.pop();
    if (revealed.has(cur) || mines.has(cur)) continue;
    revealed.add(cur);
    if (counts[cur] === 0) for (const n of neighbors(cur, w, h)) if (!revealed.has(n)) stack.push(n);
  }
  return revealed;
}
let seed = 808;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

if (neighbors(0, 3, 3).length !== 3) fail('corner should have 3 neighbours');
if (neighbors(4, 3, 3).length !== 8) fail('centre should have 8 neighbours');
if (!failures) console.log('  ✓ neighbour sets (corner 3, centre 8)');

const counts = computeCounts(new Set([0]), 3, 3); // single mine at 0
if (counts[1] !== 1 || counts[3] !== 1 || counts[4] !== 1 || counts[8] !== 0) fail('adjacency counts wrong');
else console.log('  ✓ adjacency counts around a mine');

let placeOk = true;
for (let t = 0; t < 200; t++) {
  const safe = new Set([12, ...neighbors(12, 8, 8)]);
  const mines = placeMines(64, 10, safe, rng);
  if (mines.size !== 10) placeOk = false;
  for (const s of safe) if (mines.has(s)) placeOk = false;
}
if (!placeOk) fail('mine count or first-click safety violated');
else console.log('  ✓ placeMines: exact count, safe zone respected');

// no mines → flooding any cell reveals the whole board
const empty = computeCounts(new Set(), 5, 5);
const rev = flood(12, new Set(), empty, new Set(), 5, 5);
if (rev.size !== 25) fail('zero-flood did not fill an empty board');
else console.log('  ✓ zero-flood fills a mine-free board');

if (failures) {
  console.error(`\nFAIL: ${failures} check(s).`);
  process.exit(1);
}
console.log('\nPASS: Minesweeper logic verified.');
