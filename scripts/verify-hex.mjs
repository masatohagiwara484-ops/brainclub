// Verifies the Hex engine (mirrors src/games/hex/hexEngine.ts): the six-neighbour
// adjacency, edge-to-edge connection detection, the connection-distance eval, and
// that the AI grabs an immediate win and blocks the opponent's. Run:
//   node scripts/verify-hex.mjs
// The logic is reimplemented here in plain JS so this stays a dependency-free,
// pure-logic check (the same pattern as verify-cube / verify-tiers).

const EMPTY = 0,
  HUMAN = 1,
  AI = 2;
const BLOCKED = 1e6;
const idx = (n, r, c) => r * n + c;
const inB = (n, r, c) => r >= 0 && r < n && c >= 0 && c < n;
const NEI = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [-1, 1],
  [1, -1],
];

function hasConnection(board, n, p) {
  const seen = new Uint8Array(n * n);
  const stack = [];
  for (let i = 0; i < n; i++) {
    const r = p === HUMAN ? 0 : i;
    const c = p === HUMAN ? i : 0;
    const k = idx(n, r, c);
    if (board[k] === p) {
      seen[k] = 1;
      stack.push(k);
    }
  }
  while (stack.length) {
    const k = stack.pop();
    const r = Math.floor(k / n);
    const c = k % n;
    if (p === HUMAN ? r === n - 1 : c === n - 1) return true;
    for (const [dr, dc] of NEI) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inB(n, nr, nc)) continue;
      const nk = idx(n, nr, nc);
      if (!seen[nk] && board[nk] === p) {
        seen[nk] = 1;
        stack.push(nk);
      }
    }
  }
  return false;
}

function connectionCost(board, n, p) {
  const N2 = n * n;
  const dist = new Array(N2).fill(Infinity);
  const maxC = N2 + 1;
  const buckets = Array.from({ length: maxC + 1 }, () => []);
  const opp = p === HUMAN ? AI : HUMAN;
  const seed = (k) => {
    if (board[k] === opp) return;
    const c0 = board[k] === p ? 0 : 1;
    if (c0 < dist[k]) {
      dist[k] = c0;
      buckets[c0].push(k);
    }
  };
  for (let i = 0; i < n; i++) seed(idx(n, p === HUMAN ? 0 : i, p === HUMAN ? i : 0));
  for (let d = 0; d <= maxC; d++) {
    const bucket = buckets[d];
    for (let qi = 0; qi < bucket.length; qi++) {
      const k = bucket[qi];
      if (d !== dist[k]) continue;
      const r = Math.floor(k / n);
      const c = k % n;
      if (p === HUMAN ? r === n - 1 : c === n - 1) return d;
      for (const [dr, dc] of NEI) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inB(n, nr, nc)) continue;
        const nk = idx(n, nr, nc);
        if (board[nk] === opp) continue;
        const nd = d + (board[nk] === p ? 0 : 1);
        if (nd < dist[nk]) {
          dist[nk] = nd;
          buckets[nd].push(nk);
        }
      }
    }
  }
  return BLOCKED;
}

function evalForAI(board, n) {
  return connectionCost(board, n, HUMAN) - connectionCost(board, n, AI);
}
function emptyCells(board) {
  const out = [];
  for (let i = 0; i < board.length; i++) if (board[i] === EMPTY) out.push(i);
  return out;
}
function winningCells(board, n, p, empties) {
  const out = [];
  for (const k of empties) {
    board[k] = p;
    if (hasConnection(board, n, p)) out.push(k);
    board[k] = EMPTY;
  }
  return out;
}
// Deterministic slice of chooseMove used by the test (no randomness): immediate
// win, then block, then greedy 1-ply on the eval.
function chooseMoveGreedy(board, n) {
  const empties = emptyCells(board);
  if (!empties.length) return null;
  const myWins = winningCells(board, n, AI, empties);
  if (myWins.length) return myWins[0];
  const theirWins = winningCells(board, n, HUMAN, empties);
  if (theirWins.length) {
    let best = theirWins[0],
      bestV = -Infinity;
    for (const k of theirWins) {
      board[k] = AI;
      const v = evalForAI(board, n);
      board[k] = EMPTY;
      if (v > bestV) {
        bestV = v;
        best = k;
      }
    }
    return best;
  }
  let best = empties[0],
    bestV = -Infinity;
  for (const k of empties) {
    board[k] = AI;
    const v = evalForAI(board, n);
    board[k] = EMPTY;
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => (console.error('  ✗ ' + m), failures++);

// 1) Adjacency: every interior cell has six neighbours; corners/edges fewer.
{
  const n = 7;
  const count = (r, c) =>
    NEI.reduce((s, [dr, dc]) => s + (inB(n, r + dr, c + dc) ? 1 : 0), 0);
  if (count(3, 3) === 6) ok('interior cell has 6 neighbours');
  else fail(`interior neighbours = ${count(3, 3)} (want 6)`);
  // Acute corners (0,0) and (n-1,n-1) have only 2 neighbours in Hex.
  if (count(0, 0) === 2 && count(n - 1, n - 1) === 2) ok('acute corners have 2 neighbours');
  else fail(`acute corner neighbours = ${count(0, 0)} / ${count(n - 1, n - 1)} (want 2)`);
}

// 2) Connection detection: a full straight column connects HUMAN (top↔bottom)
//    but not AI; a full row connects AI (left↔right) but not HUMAN.
{
  const n = 5;
  const col = new Array(n * n).fill(EMPTY);
  for (let r = 0; r < n; r++) col[idx(n, r, 2)] = HUMAN;
  if (hasConnection(col, n, HUMAN)) ok('HUMAN connects down a full column');
  else fail('HUMAN should connect down a full column');
  if (!hasConnection(col, n, AI)) ok('AI does not connect on HUMAN stones');
  else fail('AI should not connect on HUMAN stones');

  const row = new Array(n * n).fill(EMPTY);
  for (let c = 0; c < n; c++) row[idx(n, 2, c)] = AI;
  if (hasConnection(row, n, AI)) ok('AI connects across a full row');
  else fail('AI should connect across a full row');

  // A column with a gap must NOT connect.
  const gap = col.slice();
  gap[idx(n, 2, 2)] = EMPTY;
  if (!hasConnection(gap, n, HUMAN)) ok('a broken column does not connect');
  else fail('a broken column should not connect');
}

// 3) connectionCost: on an empty n×n board each side needs exactly n stones; a
//    completed line costs 0; an opponent wall blocks it.
{
  const n = 6;
  const empty = new Array(n * n).fill(EMPTY);
  if (connectionCost(empty, n, HUMAN) === n) ok(`empty board: HUMAN cost = n (${n})`);
  else fail(`empty board HUMAN cost = ${connectionCost(empty, n, HUMAN)} (want ${n})`);

  const col = empty.slice();
  for (let r = 0; r < n; r++) col[idx(n, r, 3)] = HUMAN;
  if (connectionCost(col, n, HUMAN) === 0) ok('completed column: HUMAN cost = 0');
  else fail(`completed column HUMAN cost = ${connectionCost(col, n, HUMAN)} (want 0)`);

  // A full HUMAN row across the middle walls the AI's left→right path nowhere,
  // but a full HUMAN column blocks nothing for AI either; instead build a wall:
  // fill an entire column with HUMAN so AI (needs to cross every column) pays for
  // detouring — at minimum its cost rises above the clear-board n.
  const wall = empty.slice();
  for (let r = 0; r < n; r++) wall[idx(n, r, 3)] = HUMAN;
  if (connectionCost(wall, n, AI) > n) ok('a HUMAN column raises AI cost above the open-board minimum');
  else fail(`AI cost across a HUMAN column = ${connectionCost(wall, n, AI)} (want > ${n})`);
}

// 4) AI grabs an immediate winning move when one exists. (With cols 0..3 of a
//    row filled there are several winning cells — an edge "bridge" — so we just
//    require the chosen move to actually complete a connection.)
{
  const n = 5;
  const b = new Array(n * n).fill(EMPTY);
  for (let c = 0; c < n - 1; c++) b[idx(n, 2, c)] = AI; // AI (left↔right), row 2
  const wins = winningCells(b, n, AI, emptyCells(b));
  const mv = chooseMoveGreedy(b, n);
  b[mv] = AI;
  const won = hasConnection(b, n, AI);
  b[mv] = EMPTY;
  if (won && wins.includes(mv)) ok('AI plays an immediate winning move');
  else fail(`AI move ${mv} did not win (wins = ${wins})`);
}

// 5) AI blocks the human's unique winning cell. A one-cell gap in the MIDDLE of
//    a column (not at the edge) has exactly one connector, so blocking is forced
//    and unambiguous — no edge bridge to dodge it.
{
  const n = 5;
  const b = new Array(n * n).fill(EMPTY);
  for (const r of [0, 1, 3, 4]) b[idx(n, r, 2)] = HUMAN; // gap at (2,2)
  const hWins = winningCells(b, n, HUMAN, emptyCells(b));
  const mv = chooseMoveGreedy(b, n);
  if (hWins.length === 1 && hWins[0] === idx(n, 2, 2) && mv === idx(n, 2, 2))
    ok('AI blocks the human at the unique connecting cell');
  else fail(`block: hWins=${hWins} mv=${mv} (want unique ${idx(n, 2, 2)})`);
}

// 6) Self-play always terminates with exactly one winner (Hex can never draw).
//    Both sides play a greedy connection-distance policy; every move fills a
//    cell so the game ends in ≤ n² moves, and the board can never fill without a
//    connection having formed.
{
  const evalFor = (board, n, me) => {
    const opp = me === HUMAN ? AI : HUMAN;
    return connectionCost(board, n, opp) - connectionCost(board, n, me);
  };
  const greedyFor = (board, n, me) => {
    const empties = emptyCells(board);
    const opp = me === HUMAN ? AI : HUMAN;
    const mine = winningCells(board, n, me, empties);
    if (mine.length) return mine[0];
    const theirs = winningCells(board, n, opp, empties);
    if (theirs.length) return theirs[0];
    let best = empties[0],
      bestV = -Infinity;
    for (const k of empties) {
      board[k] = me;
      const v = evalFor(board, n, me);
      board[k] = EMPTY;
      if (v > bestV) {
        bestV = v;
        best = k;
      }
    }
    return best;
  };

  let allGood = true;
  for (const n of [5, 7]) {
    const board = new Array(n * n).fill(EMPTY);
    let turn = HUMAN;
    let moves = 0;
    let winner = 0;
    while (moves < n * n) {
      const k = greedyFor(board, n, turn);
      board[k] = turn;
      moves++;
      if (hasConnection(board, n, turn)) {
        winner = turn;
        break;
      }
      turn = turn === HUMAN ? AI : HUMAN;
    }
    const hWin = hasConnection(board, n, HUMAN);
    const aWin = hasConnection(board, n, AI);
    if (!winner || hWin === aWin) {
      allGood = false;
      fail(`n=${n}: game ended without exactly one winner (h=${hWin} a=${aWin} moves=${moves})`);
    }
  }
  if (allGood) ok('self-play always ends with exactly one winner (no draws)');
}

if (failures) {
  console.error(`\nHEX: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nHEX: all checks passed ✓');
}
