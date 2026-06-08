// Hex — pure game logic + a connection-distance heuristic AI.
//
// Hex is played on an N×N rhombus of hexagons. Player 1 (the human) owns the
// TOP and BOTTOM edges and wins by linking them with an unbroken chain of their
// own stones; Player 2 (the AI) owns the LEFT and RIGHT edges. Players alternate
// placing one stone on any empty cell. Hex can never end in a draw — when the
// board fills, exactly one player has connected. The human moves first.
//
// Cells live in a flat array, index = r*n + c  (r = row, top→bottom;
// c = column, left→right). The six neighbours of (r,c) follow the standard Hex
// adjacency. Everything here is pure and deterministic (bar the difficulty
// jitter), so it is mirrored 1:1 in scripts/verify-hex.mjs.

import type { Difficulty } from '../../lib/difficulty';

export const EMPTY = 0;
export const HUMAN = 1; // connects top ↔ bottom
export const AI = 2; // connects left ↔ right
export type Cell = typeof EMPTY | typeof HUMAN | typeof AI;
export type Player = typeof HUMAN | typeof AI;

// Board size per difficulty. A bigger board also raises the AI's strength (see
// chooseMove), so the four levels scale on both axes at once.
export const SIZE_FOR: Record<Difficulty, number> = {
  easy: 7,
  medium: 9,
  hard: 11,
  expert: 13,
};

export const idx = (n: number, r: number, c: number): number => r * n + c;

// (dr, dc) for the six Hex neighbours of a cell.
const NEI: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [-1, 1],
  [1, -1],
];

export function createBoard(n: number): Cell[] {
  return new Array(n * n).fill(EMPTY) as Cell[];
}

export function isBoardFull(board: Cell[]): boolean {
  return board.every((c) => c !== EMPTY);
}

export function emptyCells(board: Cell[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === EMPTY) out.push(i);
  return out;
}

const inB = (n: number, r: number, c: number): boolean => r >= 0 && r < n && c >= 0 && c < n;

/**
 * Is player `p` connected across their two edges? A flood fill through `p`'s own
 * stones, seeded from p's first edge and asking whether it reaches the far edge.
 */
export function hasConnection(board: Cell[], n: number, p: Player): boolean {
  const seen = new Uint8Array(n * n);
  const stack: number[] = [];
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
    const k = stack.pop()!;
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

// Sentinel returned by connectionCost when the opponent has fully walled a side
// off (no connection is possible any more).
export const BLOCKED = 1e6;

/**
 * The minimum number of empty cells player `p` must still fill to complete a
 * connection — 0 means already connected. A 0-1 BFS (Dial's algorithm) over the
 * board where stepping onto p's own stone costs 0, an empty cell costs 1, and an
 * opponent's stone is impassable. This "shortest path to connect" is the classic
 * Hex evaluation: the player who needs fewer stones is ahead.
 */
export function connectionCost(board: Cell[], n: number, p: Player): number {
  const N2 = n * n;
  const dist = new Array<number>(N2).fill(Infinity);
  const maxC = N2 + 1;
  const buckets: number[][] = Array.from({ length: maxC + 1 }, () => []);

  const seed = (k: number) => {
    if (board[k] === (p === HUMAN ? AI : HUMAN)) return; // opponent: impassable
    const c0 = board[k] === p ? 0 : 1;
    if (c0 < dist[k]) {
      dist[k] = c0;
      buckets[c0].push(k);
    }
  };
  for (let i = 0; i < n; i++) {
    seed(idx(n, p === HUMAN ? 0 : i, p === HUMAN ? i : 0));
  }

  for (let d = 0; d <= maxC; d++) {
    const bucket = buckets[d];
    for (let qi = 0; qi < bucket.length; qi++) {
      const k = bucket[qi];
      if (d !== dist[k]) continue; // stale entry from a later, better relax
      const r = Math.floor(k / n);
      const c = k % n;
      if (p === HUMAN ? r === n - 1 : c === n - 1) return d; // reached far edge
      for (const [dr, dc] of NEI) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inB(n, nr, nc)) continue;
        const nk = idx(n, nr, nc);
        if (board[nk] === (p === HUMAN ? AI : HUMAN)) continue; // impassable
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

/**
 * Static value of the position from the AI's point of view: it wants its own
 * connection cost low and the human's high. Higher = better for the AI.
 */
export function evalForAI(board: Cell[], n: number): number {
  const ai = connectionCost(board, n, AI);
  const hu = connectionCost(board, n, HUMAN);
  return hu - ai;
}

// Centrality tie-break: cells nearer the middle keep the most options open.
function centrality(n: number, k: number): number {
  const r = Math.floor(k / n);
  const c = k % n;
  const mid = (n - 1) / 2;
  return -(Math.abs(r - mid) + Math.abs(c - mid));
}

/** All empty cells where `p` placing a stone immediately wins. */
function winningCells(board: Cell[], n: number, p: Player, empties: number[]): number[] {
  const out: number[] = [];
  for (const k of empties) {
    board[k] = p;
    if (hasConnection(board, n, p)) out.push(k);
    board[k] = EMPTY;
  }
  return out;
}

type Scored = { k: number; v: number };

/**
 * Choose the AI's move at a given difficulty. Test-play tuning:
 *  - easy:   small board, plays loosely (often random), sometimes misses a block
 *  - medium: greedy on the connection-distance eval + always blocks a human win
 *  - hard:   greedy eval, firm blocking, centrality tie-break, no randomness
 *  - expert: 2-ply — picks the move whose best human reply still leaves the AI
 *            ahead (minimax on the same eval) on the largest board
 */
export function chooseMove(board: Cell[], n: number, difficulty: Difficulty): number | null {
  const empties = emptyCells(board);
  if (empties.length === 0) return null;

  // 1) Take an immediate win.
  const myWins = winningCells(board, n, AI, empties);
  if (myWins.length) return myWins[0];

  // 2) Block the human's immediate win (easy occasionally lets it slip).
  const theirWins = winningCells(board, n, HUMAN, empties);
  if (theirWins.length && (difficulty !== 'easy' || Math.random() < 0.6)) {
    // Can't always block two disjoint threats; take the most useful blocking cell.
    let best = theirWins[0];
    let bestV = -Infinity;
    for (const k of theirWins) {
      board[k] = AI;
      const v = evalForAI(board, n) + centrality(n, k) * 0.001;
      board[k] = EMPTY;
      if (v > bestV) {
        bestV = v;
        best = k;
      }
    }
    return best;
  }

  // Easy: mostly loose, low-effort play.
  if (difficulty === 'easy' && Math.random() < 0.45) {
    return empties[Math.floor(Math.random() * empties.length)];
  }

  // 1-ply: value every empty by the connection-distance eval after playing it.
  const scored: Scored[] = empties.map((k) => {
    board[k] = AI;
    const v = evalForAI(board, n) + centrality(n, k) * 0.001;
    board[k] = EMPTY;
    return { k, v };
  });
  scored.sort((a, b) => b.v - a.v);

  if (difficulty === 'easy' || difficulty === 'medium') {
    // A little jitter so the AI is not perfectly predictable.
    const span = difficulty === 'easy' ? 6 : 3;
    const pool = scored.slice(0, Math.min(span, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].k;
  }

  if (difficulty === 'hard') {
    return scored[0].k; // firm greedy, deterministic
  }

  // Expert: 2-ply minimax on the strongest candidates. For each AI move, assume
  // the human plays the reply that hurts the AI most; pick the AI move whose
  // worst case is best.
  const K = Math.min(12, scored.length);
  let best = scored[0].k;
  let bestVal = -Infinity;
  for (let i = 0; i < K; i++) {
    const k = scored[i].k;
    board[k] = AI;
    if (hasConnection(board, n, AI)) {
      board[k] = EMPTY;
      return k;
    }
    const replies = emptyCells(board);
    let worst = Infinity;
    for (const hk of replies) {
      board[hk] = HUMAN;
      const v = hasConnection(board, n, HUMAN) ? -BLOCKED : evalForAI(board, n);
      board[hk] = EMPTY;
      if (v < worst) worst = v;
      if (worst <= bestVal) break; // prune: this candidate can't beat the best
    }
    board[k] = EMPTY;
    const val = worst + centrality(n, k) * 0.001;
    if (val > bestVal) {
      bestVal = val;
      best = k;
    }
  }
  return best;
}
