// Sudoku generation — pure logic.
//
// 1) Build a complete, valid solution via randomized backtracking.
// 2) Remove cells one by one, keeping a UNIQUE solution at every step, until we
//    reach the target number of givens for the chosen difficulty.
//
// Grid is a flat array of length 81; 0 means empty. Index = row*9 + col.

import type { Difficulty } from '../../lib/difficulty';

export type Grid = number[];

export const N = 9;
export const cell = (r: number, c: number): number => r * N + c;

// Target number of givens per difficulty (test-play values — to be tuned later).
const GIVENS: Record<Difficulty, number> = {
  easy: 45,
  medium: 36,
  hard: 30,
  expert: 25,
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Can `v` go at (r,c) without clashing in its row, column, or 3×3 box? */
export function canPlace(grid: Grid, r: number, c: number, v: number): boolean {
  for (let i = 0; i < N; i++) {
    if (grid[cell(r, i)] === v) return false;
    if (grid[cell(i, c)] === v) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (grid[cell(br + dr, bc + dc)] === v) return false;
    }
  }
  return true;
}

/** Fill `grid` completely with a valid solution (in place). Returns success. */
function fillSolution(grid: Grid, pos = 0): boolean {
  if (pos === N * N) return true;
  if (grid[pos] !== 0) return fillSolution(grid, pos + 1);

  const r = Math.floor(pos / N);
  const c = pos % N;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(grid, r, c, v)) {
      grid[pos] = v;
      if (fillSolution(grid, pos + 1)) return true;
      grid[pos] = 0;
    }
  }
  return false;
}

/** Count solutions up to `cap` (default 2 — enough to test for uniqueness). */
function countSolutions(grid: Grid, cap = 2): number {
  // Find the first empty cell.
  let pos = -1;
  for (let i = 0; i < N * N; i++) {
    if (grid[i] === 0) {
      pos = i;
      break;
    }
  }
  if (pos === -1) return 1; // full & valid

  const r = Math.floor(pos / N);
  const c = pos % N;
  let count = 0;
  for (let v = 1; v <= N; v++) {
    if (canPlace(grid, r, c, v)) {
      grid[pos] = v;
      count += countSolutions(grid, cap);
      grid[pos] = 0;
      if (count >= cap) break;
    }
  }
  return count;
}

export type Puzzle = { puzzle: Grid; solution: Grid; givens: number };

/** Generate a puzzle with a unique solution for the given difficulty. */
export function makePuzzle(difficulty: Difficulty): Puzzle {
  const solution: Grid = new Array(N * N).fill(0);
  fillSolution(solution);

  const puzzle = solution.slice();
  const target = GIVENS[difficulty];
  let filled = N * N;

  // Try to remove cells in random order; keep a removal only if the puzzle still
  // has exactly one solution.
  for (const i of shuffle([...Array(N * N).keys()])) {
    if (filled <= target) break;
    const backup = puzzle[i];
    if (backup === 0) continue;
    puzzle[i] = 0;
    if (countSolutions(puzzle.slice(), 2) !== 1) {
      puzzle[i] = backup; // removal broke uniqueness — revert
    } else {
      filled--;
    }
  }

  return { puzzle, solution, givens: filled };
}
