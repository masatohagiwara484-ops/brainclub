// Gomoku (Five in a Row) — pure game logic + a lightweight heuristic AI.
//
// Board is a flat array of length SIZE*SIZE. Cells hold EMPTY / BLACK / WHITE.
// The human plays BLACK (moves first); the AI plays WHITE. Free-style rules:
// the first player to get five (or more) in a row wins.

export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1; // human
export const WHITE = 2; // AI
export type Cell = typeof EMPTY | typeof BLACK | typeof WHITE;

export const idx = (x: number, y: number): number => y * SIZE + x;
export const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < SIZE && y >= 0 && y < SIZE;

export function createBoard(): Cell[] {
  return new Array(SIZE * SIZE).fill(EMPTY) as Cell[];
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

type LineInfo = { count: number; openEnds: number };

/**
 * Measure the run of `color` through (x,y) along one direction, counting the
 * stone hypothetically placed at (x,y), plus how many of the two ends are open.
 */
function lineInfo(
  board: Cell[],
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: Cell,
): LineInfo {
  let count = 1;

  let fx = x + dx;
  let fy = y + dy;
  while (inBounds(fx, fy) && board[idx(fx, fy)] === color) {
    count++;
    fx += dx;
    fy += dy;
  }
  const forwardOpen = inBounds(fx, fy) && board[idx(fx, fy)] === EMPTY;

  let bx = x - dx;
  let by = y - dy;
  while (inBounds(bx, by) && board[idx(bx, by)] === color) {
    count++;
    bx -= dx;
    by -= dy;
  }
  const backwardOpen = inBounds(bx, by) && board[idx(bx, by)] === EMPTY;

  return { count, openEnds: (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0) };
}

/** Did placing `color` at (x,y) make five (or more) in a row? */
export function isWin(board: Cell[], x: number, y: number, color: Cell): boolean {
  for (const [dx, dy] of DIRS) {
    if (lineInfo(board, x, y, dx, dy, color).count >= 5) return true;
  }
  return false;
}

const WIN_SCORE = 1e8;

function scoreFromLine({ count, openEnds }: LineInfo): number {
  if (count >= 5) return WIN_SCORE;
  if (openEnds === 0) return 0; // dead line, no value
  switch (count) {
    case 4:
      return openEnds === 2 ? 1_000_000 : 100_000; // open four wins; simple four forces a block
    case 3:
      return openEnds === 2 ? 50_000 : 1_000; // open three is a strong threat
    case 2:
      return openEnds === 2 ? 500 : 100;
    default:
      return openEnds === 2 ? 10 : 1;
  }
}

/** Heuristic value of playing `color` at the (empty) cell (x,y). */
export function scoreFor(board: Cell[], x: number, y: number, color: Cell): number {
  let total = 0;
  for (const [dx, dy] of DIRS) {
    total += scoreFromLine(lineInfo(board, x, y, dx, dy, color));
  }
  return total;
}

/** Cells worth considering: empties within `radius` of an existing stone. */
function candidates(board: Cell[], radius = 2): number[] {
  const out: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[idx(x, y)] !== EMPTY) continue;
      let near = false;
      for (let dy = -radius; dy <= radius && !near; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny) && board[idx(nx, ny)] !== EMPTY) {
            near = true;
            break;
          }
        }
      }
      if (near) out.push(idx(x, y));
    }
  }
  return out;
}

/**
 * Pick the AI's move. Balances its own attack with denying the human's best
 * cell, and short-circuits to an immediate winning move when one exists.
 */
export function bestMove(board: Cell[], ai: Cell, human: Cell): { x: number; y: number } | null {
  const cells = candidates(board);

  // Opening: empty board → take the center.
  if (cells.length === 0) {
    const c = Math.floor(SIZE / 2);
    return board[idx(c, c)] === EMPTY ? { x: c, y: c } : null;
  }

  const center = (SIZE - 1) / 2;
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;

  for (const i of cells) {
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);

    const mine = scoreFor(board, x, y, ai);
    if (mine >= WIN_SCORE) return { x, y }; // win now — no need to look further

    const theirs = scoreFor(board, x, y, human); // value we deny the human
    // Slight pull toward the center breaks ties sensibly.
    const centerBonus = -(Math.abs(x - center) + Math.abs(y - center));
    const total = mine + 0.9 * theirs + centerBonus * 0.01;

    if (total > bestScore) {
      bestScore = total;
      best = { x, y };
    }
  }
  return best;
}

export function isBoardFull(board: Cell[]): boolean {
  return board.every((c) => c !== EMPTY);
}

// ---- difficulty-aware move selection ----
import type { Difficulty } from '../../lib/difficulty';

type Scored = { x: number; y: number; mine: number; theirs: number };

function pickMax(scored: Scored[], val: (s: Scored) => number): { x: number; y: number } {
  let best = scored[0];
  let bestVal = -Infinity;
  for (const s of scored) {
    const v = val(s);
    if (v > bestVal) {
      bestVal = v;
      best = s;
    }
  }
  return { x: best.x, y: best.y };
}

/**
 * Choose the AI's move at a given difficulty. Test-play tuning:
 *  - easy:   weak defense, frequent random moves, sometimes misses a win threat
 *  - medium: balanced attack/defense (the original heuristic)
 *  - hard:   prioritizes blocking and pressing threats
 *  - expert: 1-ply lookahead — avoids moves that hand the opponent a big reply
 */
export function chooseMove(
  board: Cell[],
  ai: Cell,
  human: Cell,
  difficulty: Difficulty,
): { x: number; y: number } | null {
  const cells = candidates(board);
  if (cells.length === 0) {
    const c = Math.floor(SIZE / 2);
    return board[idx(c, c)] === EMPTY ? { x: c, y: c } : null;
  }

  const center = (SIZE - 1) / 2;
  const centerBonus = (s: Scored) =>
    -(Math.abs(s.x - center) + Math.abs(s.y - center)) * 0.01;

  const scored: Scored[] = cells.map((i) => {
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    return { x, y, mine: scoreFor(board, x, y, ai), theirs: scoreFor(board, x, y, human) };
  });

  // Always take an immediate win when available.
  const win = scored.find((s) => s.mine >= WIN_SCORE);
  if (win) return { x: win.x, y: win.y };

  // Block an immediate losing threat (easy may occasionally miss it).
  const mustBlock = scored.find((s) => s.theirs >= WIN_SCORE);
  if (mustBlock && (difficulty !== 'easy' || Math.random() < 0.5)) {
    return { x: mustBlock.x, y: mustBlock.y };
  }

  switch (difficulty) {
    case 'easy': {
      if (Math.random() < 0.35) {
        const i = cells[Math.floor(Math.random() * cells.length)];
        return { x: i % SIZE, y: Math.floor(i / SIZE) };
      }
      return pickMax(scored, (s) => s.mine + 0.3 * s.theirs + centerBonus(s));
    }
    case 'medium':
      return pickMax(scored, (s) => s.mine + 0.9 * s.theirs + centerBonus(s));
    case 'hard':
      return pickMax(scored, (s) => s.mine + 1.2 * s.theirs + centerBonus(s));
    case 'expert': {
      const ranked = [...scored]
        .sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs))
        .slice(0, 12);
      let best = { x: ranked[0].x, y: ranked[0].y };
      let bestVal = -Infinity;
      for (const s of ranked) {
        const i = idx(s.x, s.y);
        board[i] = ai;
        let oppBest = 0;
        for (const j of candidates(board)) {
          const ox = j % SIZE;
          const oy = Math.floor(j / SIZE);
          const v = scoreFor(board, ox, oy, human);
          if (v > oppBest) oppBest = v;
        }
        board[i] = EMPTY;
        const val = s.mine - 0.95 * oppBest + centerBonus(s);
        if (val > bestVal) {
          bestVal = val;
          best = { x: s.x, y: s.y };
        }
      }
      return best;
    }
  }
}
