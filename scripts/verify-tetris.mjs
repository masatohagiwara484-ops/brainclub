// Verifies the Tetris engine (mirrors src/games/tetris/tetrisEngine.ts): piece
// sizes, clockwise rotation, wall/floor collision, line clearing with gravity,
// and level-scaled scoring. Pure, dependency-free. Run: node scripts/verify-tetris.mjs

const COLS = 10,
  ROWS = 20;
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const SHAPES = {
  I: { n: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
  O: { n: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  T: { n: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  S: { n: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  J: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
  L: { n: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] },
};
const rotateCells = (cells, n) => cells.map(([r, c]) => [c, n - 1 - r]);
const colorValue = (type) => TYPES.indexOf(type) + 1;
const emptyBoard = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
function collides(board, cells, pr, pc) {
  for (const [cr, cc] of cells) {
    const R = pr + cr,
      C = pc + cc;
    if (C < 0 || C >= COLS || R >= ROWS) return true;
    if (R >= 0 && board[R][C] !== 0) return true;
  }
  return false;
}
function clearLines(board) {
  const kept = board.filter((row) => row.some((c) => c === 0));
  const cleared = ROWS - kept.length;
  const fresh = Array.from({ length: cleared }, () => new Array(COLS).fill(0));
  return { board: [...fresh, ...kept], cleared };
}
const LINE_POINTS = [0, 100, 300, 500, 800];
const lineScore = (n, level) => (LINE_POINTS[n] ?? 0) * (level + 1);

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => (console.error('  ✗ ' + m), failures++);
const key = (cells) => cells.map(([r, c]) => `${r},${c}`).sort().join(' ');

// Every piece has exactly four cells.
if (TYPES.every((t) => SHAPES[t].cells.length === 4)) ok('all 7 pieces have 4 cells');
else fail('a piece does not have 4 cells');

// Colour values are 1..7, distinct.
const vals = TYPES.map(colorValue);
if (vals.join() === '1,2,3,4,5,6,7') ok('colour values are 1..7');
else fail(`colour values = ${vals.join()}`);

// O piece is rotation-invariant.
if (key(rotateCells(SHAPES.O.cells, 2)) === key(SHAPES.O.cells)) ok('O piece is unchanged by rotation');
else fail('O piece should be rotation-invariant');

// I piece: horizontal row → vertical column after a clockwise turn.
{
  const rot = rotateCells(SHAPES.I.cells, 4);
  const cols = new Set(rot.map(([, c]) => c));
  const rows = new Set(rot.map(([r]) => r));
  if (cols.size === 1 && rows.size === 4) ok('I piece rotates from a row to a column');
  else fail(`I rotation = ${key(rot)}`);
}

// Four rotations return to the original orientation.
{
  let cells = SHAPES.T.cells;
  for (let i = 0; i < 4; i++) cells = rotateCells(cells, 3);
  if (key(cells) === key(SHAPES.T.cells)) ok('four rotations return to start');
  else fail('T did not return after 4 rotations');
}

// Collision: floor, right wall, and a stacked block.
{
  const b = emptyBoard();
  if (collides(b, SHAPES.O.cells, ROWS - 1, 0)) ok('O at the floor edge collides');
  else fail('O overhanging the floor should collide');
  if (collides(b, SHAPES.O.cells, 0, COLS - 1)) ok('O past the right wall collides');
  else fail('O past the right wall should collide');
  b[5][3] = 1;
  if (collides(b, SHAPES.O.cells, 4, 2)) ok('overlapping a locked block collides');
  else fail('overlap should collide');
  if (!collides(b, SHAPES.O.cells, 0, 0)) ok('a clear spot does not collide');
  else fail('clear spot should not collide');
}

// Line clearing: fill the bottom two rows, clear both, gravity drops the rest.
{
  const b = emptyBoard();
  for (let c = 0; c < COLS; c++) {
    b[ROWS - 1][c] = 2;
    b[ROWS - 2][c] = 3;
  }
  b[ROWS - 3][0] = 5; // a lone block that should fall to the bottom
  const { board, cleared } = clearLines(b);
  if (cleared === 2) ok('two full rows are cleared');
  else fail(`cleared = ${cleared} (want 2)`);
  if (board[ROWS - 1][0] === 5 && board[ROWS - 1].slice(1).every((c) => c === 0)) ok('blocks above fall down after a clear');
  else fail('gravity after clear is wrong');
  if (board.length === ROWS) ok('board height is preserved');
  else fail(`board height = ${board.length}`);
}

// Scoring scales with the number of lines and the level.
if (lineScore(1, 0) === 100 && lineScore(4, 0) === 800) ok('single = 100, tetris = 800 at level 0');
else fail('base line scores wrong');
if (lineScore(4, 9) === 8000) ok('a tetris at level 9 scores 8000');
else fail(`tetris@9 = ${lineScore(4, 9)} (want 8000)`);

// ---- versus helpers (mirror of addGarbage / garbageFor / encode-decode) ----
const GARBAGE = 8;
const garbageFor = (n) => [0, 0, 1, 2, 4][n] ?? 0;
function addGarbage(board, n, holeAt) {
  let next = board.map((row) => row.slice());
  for (let i = 0; i < n; i++) {
    const row = new Array(COLS).fill(GARBAGE);
    row[Math.min(COLS - 1, Math.max(0, holeAt(i)))] = 0;
    next = [...next.slice(1), row];
  }
  return next;
}
{
  const b = emptyBoard();
  b[ROWS - 1][0] = 3; // a settled block on the floor
  const g = addGarbage(b, 2, (i) => 4 + i);
  if (g.length !== ROWS) fail('garbage board must stay ROWS tall');
  else if (g[ROWS - 1][5] !== 0 || g[ROWS - 1].filter((c) => c === GARBAGE).length !== COLS - 1)
    fail('bottom garbage row should be solid gray with one hole at 5');
  else if (g[ROWS - 2][4] !== 0 || g[ROWS - 2].filter((c) => c === GARBAGE).length !== COLS - 1)
    fail('second garbage row hole misplaced');
  else if (g[ROWS - 3][0] !== 3) fail('existing blocks must shift up above the garbage');
  else console.log('  ✓ garbage rows insert from the bottom with single holes; stack shifts up');
  const sends = [garbageFor(1), garbageFor(2), garbageFor(3), garbageFor(4)];
  if (sends.join(',') !== '0,1,2,4') fail(`garbageFor schedule wrong: ${sends}`);
  else console.log('  ✓ attack schedule single/double/triple/tetris → 0/1/2/4');
}

if (failures) {
  console.error(`\nTETRIS: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nTETRIS: all checks passed ✓');
}
