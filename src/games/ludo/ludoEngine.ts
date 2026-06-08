// Ludo (classic rules) — pure game logic + a heuristic AI.
//
// Four colours (0 = red = human, 1 = green, 2 = yellow, 3 = blue) race four
// tokens each from their base, all the way round a shared 52-cell ring and up
// their own 6-cell home column to the centre. Classic rules:
//   • a token only leaves base on a roll of 6;
//   • landing on an opponent (off a safe cell) sends it back to base — a capture;
//   • the 8 safe cells (each colour's start + a star 8 ahead) shield tokens;
//   • a token must reach the very centre by an exact roll (overshoot = no move);
//   • first colour to get all four tokens home wins.
// Turn bonuses (rolling a 6, capturing, finishing a token grant another roll)
// are handled by the component; everything here — paths, captures, legal moves,
// win, AI — is pure and mirrored in scripts/verify-ludo.mjs.

import type { Difficulty } from '../../lib/difficulty';

export const RING = 52; // shared perimeter cells, 0..51
export const HOME_ENTRY = 50; // last ring progress before a token turns into its home column
export const GOAL = 56; // progress value at the centre (home)
export const TOKENS = 4;
export const COLORS = [0, 1, 2, 3] as const;
export type Color = (typeof COLORS)[number];

export const BASE = -1; // a token still waiting in its base

// Where each colour joins the ring (so the four start cells sit 13 apart).
export const START_OFFSET: readonly number[] = [0, 13, 26, 39];
// The 8 safe cells: each colour's start cell + the star cell 8 ahead of it.
export const SAFE: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// pos[color][token] = progress: BASE(-1) | ring 0..50 | home column 51..56 (56 = home).
export type Pos = number[][];

export function initialPos(): Pos {
  return COLORS.map(() => new Array(TOKENS).fill(BASE));
}

export function clonePos(pos: Pos): Pos {
  return pos.map((row) => row.slice());
}

/** The ring cell (0..51) a token of `color` sits on at progress `t`, or -1 when
 *  it is still in base or already in its home column (off the shared ring). */
export function ringCellOf(color: Color, t: number): number {
  if (t < 0 || t > HOME_ENTRY) return -1;
  return (START_OFFSET[color] + t) % RING;
}

export type Move = { token: number; from: number; to: number; capture: Array<[Color, number]> };

/** Opponent tokens that a landing at progress `to` would capture (ring, off-safe only). */
function capturesAt(pos: Pos, color: Color, to: number): Array<[Color, number]> {
  const caps: Array<[Color, number]> = [];
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

/** Every legal move for `color` with this die (empty = the turn must be passed). */
export function legalMoves(pos: Pos, color: Color, die: number): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < TOKENS; i++) {
    const t = pos[color][i];
    let to: number;
    if (t === BASE) {
      if (die !== 6) continue; // only a 6 brings a token out
      to = 0;
    } else {
      to = t + die;
      if (to > GOAL) continue; // must land on the centre exactly
    }
    out.push({ token: i, from: t, to, capture: capturesAt(pos, color, to) });
  }
  return out;
}

export type ApplyResult = { pos: Pos; captured: boolean; reachedHome: boolean };

/** Apply a move, returning a fresh Pos plus whether it captured / brought a token home. */
export function applyMove(pos: Pos, color: Color, move: Move): ApplyResult {
  const next = clonePos(pos);
  next[color][move.token] = move.to;
  for (const [k, j] of move.capture) next[k][j] = BASE;
  return { pos: next, captured: move.capture.length > 0, reachedHome: move.to === GOAL };
}

export function hasWon(pos: Pos, color: Color): boolean {
  return pos[color].every((t) => t === GOAL);
}

// ---- AI ----------------------------------------------------------------------

// Could any opponent land on ring `cell` with a roll of 1..6 next turn?
function underThreat(pos: Pos, color: Color, cell: number): boolean {
  for (const k of COLORS) {
    if (k === color) continue;
    for (let j = 0; j < TOKENS; j++) {
      const tp = pos[k][j];
      if (tp < 0 || tp > HOME_ENTRY) continue;
      const oppCell = ringCellOf(k, tp);
      const d = (cell - oppCell + RING) % RING;
      if (d >= 1 && d <= 6 && tp + d <= GOAL) return true;
    }
  }
  return false;
}

function scoreMove(pos: Pos, color: Color, m: Move, difficulty: Difficulty): number {
  let s = m.to * 2; // base: further along is better
  if (m.to === GOAL) s += 1000; // bring a token home
  for (const [k, j] of m.capture) s += 220 + 6 * pos[k][j]; // capture (worth more vs a far token)
  if (m.from === BASE) s += 120; // get a token into play
  const cell = ringCellOf(color, m.to);
  if (cell >= 0 && SAFE.has(cell)) s += 40; // park somewhere safe

  if (difficulty === 'hard' || difficulty === 'expert') {
    // Avoid landing where an opponent can capture next turn…
    if (cell >= 0 && !SAFE.has(cell) && underThreat(pos, color, cell)) {
      s -= 90 + (difficulty === 'expert' ? 3 * m.to : 0);
    }
    // …and (expert) reward pulling a threatened token to safety.
    if (difficulty === 'expert' && m.from >= 0 && m.from <= HOME_ENTRY) {
      const fromCell = ringCellOf(color, m.from);
      if (fromCell >= 0 && !SAFE.has(fromCell) && underThreat(pos, color, fromCell)) s += 70;
    }
  }
  return s;
}

/** Pick the AI's token to move (null when no legal move exists). */
export function chooseAIMove(
  pos: Pos,
  color: Color,
  die: number,
  difficulty: Difficulty,
): Move | null {
  const moves = legalMoves(pos, color, die);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  // Easy plays loosely; the rest weigh the move heuristic.
  if (difficulty === 'easy' && Math.random() < 0.5) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(pos, color, m, difficulty) + (difficulty === 'easy' ? Math.random() * 30 : 0);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}
