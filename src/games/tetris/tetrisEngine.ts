// Tetris — pure board logic (the classic 7 tetrominoes, rotation, collision,
// locking, line clears and scoring). The React layer owns the real-time loop and
// input; this module is pure and mirrored in scripts/verify-tetris.mjs.

export const COLS = 10;
export const ROWS = 20;

export type Cell = number; // 0 = empty, 1..7 = a piece colour
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceType = (typeof TYPES)[number];

// Colour per cell value (index = type index + 1). Classic Tetris hues.
export const COLORS: string[] = ['', '#22d3ee', '#eab308', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#f97316'];

// Spawn orientation of each piece as filled [row, col] cells inside an n×n box.
export const SHAPES: Record<PieceType, { n: number; cells: [number, number][] }> = {
  I: { n: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
  O: { n: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  T: { n: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  S: { n: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  J: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
  L: { n: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] },
};

export const colorValue = (type: PieceType): number => TYPES.indexOf(type) + 1;

/** Rotate a piece's cells 90° clockwise inside its n×n box. */
export function rotateCells(cells: [number, number][], n: number): [number, number][] {
  return cells.map(([r, c]) => [c, n - 1 - r] as [number, number]);
}

export type Piece = { type: PieceType; n: number; cells: [number, number][]; r: number; c: number };

/** A fresh piece centered at the top of the board. */
export function spawn(type: PieceType): Piece {
  const { n, cells } = SHAPES[type];
  return { type, n, cells: cells.map((x) => [...x] as [number, number]), r: 0, c: Math.floor((COLS - n) / 2) };
}

export function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}

/** Would the piece's cells (at offset pr,pc) overlap a wall, floor or block? */
export function collides(board: Cell[][], cells: [number, number][], pr: number, pc: number): boolean {
  for (const [cr, cc] of cells) {
    const R = pr + cr;
    const C = pc + cc;
    if (C < 0 || C >= COLS || R >= ROWS) return true; // walls / floor (above the top is allowed)
    if (R >= 0 && board[R][C] !== 0) return true;
  }
  return false;
}

/** Stamp the piece into a fresh board copy. */
export function lock(board: Cell[][], piece: Piece): Cell[][] {
  const next = board.map((row) => row.slice());
  const v = colorValue(piece.type);
  for (const [cr, cc] of piece.cells) {
    const R = piece.r + cr;
    const C = piece.c + cc;
    if (R >= 0 && R < ROWS && C >= 0 && C < COLS) next[R][C] = v;
  }
  return next;
}

/** Remove full rows, returning the new board and how many cleared. */
export function clearLines(board: Cell[][]): { board: Cell[][]; cleared: number } {
  const kept = board.filter((row) => row.some((c) => c === 0));
  const cleared = ROWS - kept.length;
  const fresh = Array.from({ length: cleared }, () => new Array<Cell>(COLS).fill(0));
  return { board: [...fresh, ...kept], cleared };
}

// Classic line-clear scoring, scaled by level (single/double/triple/tetris).
const LINE_POINTS = [0, 100, 300, 500, 800];
export function lineScore(n: number, level: number): number {
  return (LINE_POINTS[n] ?? 0) * (level + 1);
}

// Gravity (ms per cell) for a level — faster as the level climbs.
export function gravityMs(level: number): number {
  return Math.max(60, 800 - level * 62);
}

// A 7-bag randomizer keeps piece distribution fair (standard Tetris).
export function makeBag(rng: () => number): PieceType[] {
  const bag = [...TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}
