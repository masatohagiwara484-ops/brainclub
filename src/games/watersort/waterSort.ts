// Water Sort — pure game logic + a solvable-puzzle generator.
//
// Each tube holds up to CAPACITY color segments, stored bottom→top. A pour
// moves the maximal run of the source's top color onto a destination tube that
// is either empty or whose top color matches, as far as capacity allows. The
// puzzle is solved when every tube is empty or full of a single color.

import type { Difficulty } from '../../lib/difficulty';

export const CAPACITY = 4;
export type Tube = number[]; // color indices, bottom → top
export type State = Tube[];

// Distinct, vivid liquid colors (index = color id).
export const PALETTE = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#f43f5e', // rose
];

type LevelConfig = { colors: number; empties: number };

// Test-play tuning: more colors → harder. Two free tubes keep boards solvable.
const CONFIG: Record<Difficulty, LevelConfig> = {
  easy: { colors: 4, empties: 2 },
  medium: { colors: 6, empties: 2 },
  hard: { colors: 8, empties: 2 },
  expert: { colors: 10, empties: 2 },
};

export function topColor(tube: Tube): number | null {
  return tube.length ? tube[tube.length - 1] : null;
}

/** Length of the same-color run at the top of a tube. */
function topRunLength(tube: Tube): number {
  if (!tube.length) return 0;
  const c = tube[tube.length - 1];
  let n = 1;
  for (let i = tube.length - 2; i >= 0; i--) {
    if (tube[i] === c) n++;
    else break;
  }
  return n;
}

/** How many units would move if we poured i→j (0 means the pour is illegal). */
export function pourAmount(state: State, i: number, j: number): number {
  if (i === j) return 0;
  const from = state[i];
  const to = state[j];
  if (from.length === 0) return 0;
  if (to.length >= CAPACITY) return 0;
  const c = from[from.length - 1];
  if (to.length > 0 && to[to.length - 1] !== c) return 0;
  // Don't bother pouring a whole single-color tube into an empty one (no progress).
  if (to.length === 0 && topRunLength(from) === from.length) return 0;
  return Math.min(topRunLength(from), CAPACITY - to.length);
}

export function canPour(state: State, i: number, j: number): boolean {
  return pourAmount(state, i, j) > 0;
}

/** Apply a pour i→j, returning a new state. Assumes the pour is legal. */
export function pour(state: State, i: number, j: number): State {
  const amt = pourAmount(state, i, j);
  const next = state.map((t) => t.slice());
  const c = next[i][next[i].length - 1];
  for (let k = 0; k < amt; k++) {
    next[i].pop();
    next[j].push(c);
  }
  return next;
}

export function isSolved(state: State): boolean {
  return state.every(
    (t) => t.length === 0 || (t.length === CAPACITY && t.every((c) => c === t[0])),
  );
}

function canonical(state: State): string {
  return state
    .map((t) => t.join(','))
    .sort()
    .join('|');
}

/**
 * Depth-first solvability check with a visited set and a node budget. Moves are
 * ordered so promising pours (onto a matching color / completing a tube) are
 * tried first, which lets solvable boards resolve quickly.
 */
export function solvable(start: State, nodeCap = 80000): boolean {
  const visited = new Set<string>();
  const stack: State[] = [start];
  let nodes = 0;

  while (stack.length) {
    const s = stack.pop()!;
    if (isSolved(s)) return true;
    const key = canonical(s);
    if (visited.has(key)) continue;
    visited.add(key);
    if (++nodes > nodeCap) return false;

    const n = s.length;
    const moves: { j: number; i: number; score: number }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const amt = pourAmount(s, i, j);
        if (amt <= 0) continue;
        // Prefer pours onto a non-empty matching tube, and bigger transfers.
        const onto = s[j].length > 0 ? 2 : 0;
        moves.push({ i, j, score: onto + amt });
      }
    }
    moves.sort((a, b) => a.score - b.score); // worst first → best popped last
    for (const m of moves) stack.push(pour(s, m.i, m.j));
  }
  return false;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Level = { tubes: State; colors: number };

/** Generate a solvable puzzle for the difficulty. */
export function makeLevel(difficulty: Difficulty): Level {
  const { colors, empties } = CONFIG[difficulty];

  const pool: number[] = [];
  for (let c = 0; c < colors; c++) for (let k = 0; k < CAPACITY; k++) pool.push(c);

  let tubes: State = [];
  for (let attempt = 0; attempt < 80; attempt++) {
    shuffle(pool);
    tubes = [];
    for (let c = 0; c < colors; c++) tubes.push(pool.slice(c * CAPACITY, c * CAPACITY + CAPACITY));
    for (let e = 0; e < empties; e++) tubes.push([]);
    if (!isSolved(tubes) && solvable(tubes)) break;
  }
  return { tubes, colors };
}
