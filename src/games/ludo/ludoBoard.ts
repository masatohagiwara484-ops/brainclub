// Ludo board geometry on the classic 15×15 grid (x = col, y = row, both 0..14).
//
// The four 6×6 corner yards hold each colour's idle tokens. A 52-cell track
// loops around the cross; each colour's coloured home column (6 cells) runs up
// the middle of its arm to the centre. This module is pure geometry — grid
// coordinates only — consumed by the canvas renderer in LudoGame.tsx. It is kept
// consistent with ludoEngine.ts: RING_CELLS[(START_OFFSET[c] + t) % 52] is the
// grid cell of colour c's token at ring progress t (0..50), and HOME_CELLS[c][h]
// is home-column progress 51+h (h = 0..5, the last being home).

import { COLORS, type Color } from './ludoEngine';

export const GRID = 15;

// The 52 ring cells in clockwise order, index 0 = red's (colour 0) start cell.
// Four diagonal turns around the centre diamond are the authentic Ludo corners.
export const RING_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], // 0-4   left arm, upper lane →
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], // 5-10  up the top arm's left lane
  [7, 0], [8, 0], // 11-12 across the top tip
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], // 13-17 down the top arm's right lane
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], // 18-23 right arm, upper lane →
  [14, 7], [14, 8], // 24-25 the right tip
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], // 26-30 right arm, lower lane ←
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], // 31-36 down the bottom arm's right lane
  [7, 14], [6, 14], // 37-38 the bottom tip
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], // 39-43 up the bottom arm's left lane
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], // 44-49 left arm, lower lane ←
  [0, 7], [0, 6], // 50-51 the left tip, back to start
];

// Coloured home columns (progress 51..56; the 6th cell is home), one per colour.
export const HOME_CELLS: Record<Color, ReadonlyArray<readonly [number, number]>> = {
  0: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]], // left → centre
  1: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]], // top → centre
  2: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]], // right → centre
  3: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]], // bottom → centre
};

// The four idle-token slots in each colour's corner yard.
export const BASE_SLOTS: Record<Color, ReadonlyArray<readonly [number, number]>> = {
  0: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]], // top-left
  1: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]], // top-right
  2: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]], // bottom-right
  3: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]], // bottom-left
};

// Each yard's 6×6 top-left grid corner (for drawing the coloured base).
export const BASE_RECT: Record<Color, readonly [number, number]> = {
  0: [0, 0],
  1: [9, 0],
  2: [9, 9],
  3: [0, 9],
};

// Classic Ludo colours, plus a darker shade for token shading.
export const COLOR_HEX: Record<Color, string> = { 0: '#ef4444', 1: '#22c55e', 2: '#eab308', 3: '#3b82f6' };
export const COLOR_DARK: Record<Color, string> = { 0: '#b91c1c', 1: '#15803d', 2: '#a16207', 3: '#1d4ed8' };
export const COLOR_LIGHT: Record<Color, string> = { 0: '#fca5a5', 1: '#86efac', 2: '#fde047', 3: '#93c5fd' };

export const HUMAN: Color = 0;
export const ALL_COLORS = COLORS;
