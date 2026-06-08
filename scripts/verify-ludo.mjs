// Verifies the Ludo engine (mirrors src/games/ludo/ludoEngine.ts): ring mapping,
// the 6-to-leave-base rule, exact-landing-to-finish, capture vs safe cells, and
// win detection. Pure-logic, dependency-free (the verify-* convention).
//   node scripts/verify-ludo.mjs

const RING = 52,
  HOME_ENTRY = 50,
  GOAL = 56,
  TOKENS = 4,
  BASE = -1;
const COLORS = [0, 1, 2, 3];
const START_OFFSET = [0, 13, 26, 39];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const ringCellOf = (color, t) => (t < 0 || t > HOME_ENTRY ? -1 : (START_OFFSET[color] + t) % RING);

function capturesAt(pos, color, to) {
  const caps = [];
  const cell = ringCellOf(color, to);
  if (cell < 0 || SAFE.has(cell)) return caps;
  for (const k of COLORS) {
    if (k === color) continue;
    for (let j = 0; j < TOKENS; j++) {
      const tp = pos[k][j];
      if (tp < 0 || tp > HOME_ENTRY) continue;
      if (ringCellOf(k, tp) === cell) caps.push([k, j]);
    }
  }
  return caps;
}
function legalMoves(pos, color, die) {
  const out = [];
  for (let i = 0; i < TOKENS; i++) {
    const t = pos[color][i];
    let to;
    if (t === BASE) {
      if (die !== 6) continue;
      to = 0;
    } else {
      to = t + die;
      if (to > GOAL) continue;
    }
    out.push({ token: i, from: t, to, capture: capturesAt(pos, color, to) });
  }
  return out;
}
function applyMove(pos, color, move) {
  const next = pos.map((r) => r.slice());
  next[color][move.token] = move.to;
  for (const [k, j] of move.capture) next[k][j] = BASE;
  return { pos: next, captured: move.capture.length > 0, reachedHome: move.to === GOAL };
}
const hasWon = (pos, color) => pos[color].every((t) => t === GOAL);
const base = () => COLORS.map(() => new Array(TOKENS).fill(BASE));

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => (console.error('  ✗ ' + m), failures++);

// 1) Ring mapping: starts 13 apart, and it wraps.
{
  if (ringCellOf(0, 0) === 0 && ringCellOf(1, 0) === 13 && ringCellOf(2, 0) === 26 && ringCellOf(3, 0) === 39)
    ok('the four start cells sit 13 apart');
  else fail('start cells are wrong');
  if (ringCellOf(3, 20) === (39 + 20) % 52) ok('progress wraps around the ring');
  else fail(`wrap wrong: ${ringCellOf(3, 20)}`);
  if (ringCellOf(0, 51) === -1 && ringCellOf(0, 56) === -1) ok('home-column progress leaves the ring');
  else fail('home column should not map to a ring cell');
}

// 2) A token only leaves base on a 6.
{
  const p = base();
  if (legalMoves(p, 0, 4).length === 0) ok('no moves from base without a 6');
  else fail('should have no moves from base on a 4');
  const m6 = legalMoves(p, 0, 6);
  if (m6.length === TOKENS && m6.every((m) => m.to === 0)) ok('a 6 lets any based token come out to its start');
  else fail(`a 6 from an all-base position gave ${m6.length} moves`);
}

// 3) Finishing needs an exact roll onto the centre.
{
  const p = base();
  p[0][0] = 53; // three away from home (56)
  if (legalMoves(p, 0, 3).some((m) => m.to === GOAL)) ok('an exact roll reaches home');
  else fail('exact roll should reach home');
  if (legalMoves(p, 0, 4).length === 0) ok('overshooting the centre is not allowed');
  else fail('overshoot should be illegal');
  const fin = applyMove(p, 0, { token: 0, from: 53, to: 56, capture: [] });
  if (fin.reachedHome) ok('applyMove flags reaching home');
  else fail('applyMove should flag home');
}

// 4) Capture: landing on an opponent (off a safe cell) sends it to base; a safe
//    cell shields it.
{
  // Put a green (color 1) token on ring cell 20 (a non-safe cell). Red (color 0)
  // at progress 18 → 20 with a die of 2 lands on it and captures.
  const p = base();
  // green progress so that ringCellOf(1, t) === 20  → (13 + t) % 52 = 20 → t = 7
  p[1][0] = 7;
  // red progress so that ringCellOf(0, 18) === 18; rolling 2 → 20
  p[0][0] = 18;
  const moves = legalMoves(p, 0, 2);
  const mv = moves.find((m) => m.token === 0);
  if (mv && mv.capture.length === 1 && mv.capture[0][0] === 1) ok('landing on an opponent captures it');
  else fail(`expected a capture, got ${JSON.stringify(mv && mv.capture)}`);
  const res = applyMove(p, 0, mv);
  if (res.captured && res.pos[1][0] === BASE) ok('a captured token returns to base');
  else fail('captured token should be sent to base');

  // Move the green token onto a SAFE cell (cell 8 → t where (13+t)%52=8 → t=47)
  // and confirm it is not captured by a red landing there.
  const q = base();
  q[1][0] = 47; // green on safe cell 8
  q[0][0] = 6; // red, rolling 2 → progress 8 → ring cell 8 (safe)
  const safeMv = legalMoves(q, 0, 2).find((m) => m.token === 0);
  if (safeMv && safeMv.capture.length === 0) ok('a token on a safe cell is not captured');
  else fail(`safe cell should shield, got ${JSON.stringify(safeMv && safeMv.capture)}`);
}

// 5) Win detection: all four tokens home.
{
  const p = base();
  for (let i = 0; i < TOKENS; i++) p[0][i] = GOAL;
  if (hasWon(p, 0)) ok('all four tokens home = win');
  else fail('should detect a win');
  p[0][3] = 55;
  if (!hasWon(p, 0)) ok('one token short is not a win');
  else fail('should not win with a token short');
}

if (failures) {
  console.error(`\nLUDO: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nLUDO: all checks passed ✓');
}
