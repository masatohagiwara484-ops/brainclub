// ColorClash — a Stroop-test reflex game (pure, testable logic).
//
// A color NAME is shown painted in a (different) ink color; the player must tap
// the color the word is PAINTED in, not what it spells. The mismatch creates
// classic Stroop interference, so the option set always contains both the
// correct ink color AND the tempting "word" color, plus random distractors.

import type { Difficulty } from '../../lib/difficulty';

export type ColorId = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export type ColorDef = {
  id: ColorId;
  hex: string;
  /** A distinct glyph shown alongside the swatch — a zero-asset "pattern" so
   *  the choices are distinguishable without relying on color alone. */
  symbol: string;
};

export const COLORS: ColorDef[] = [
  { id: 'red', hex: '#ef4444', symbol: '●' },
  { id: 'blue', hex: '#3b82f6', symbol: '▲' },
  { id: 'green', hex: '#22c55e', symbol: '■' },
  { id: 'yellow', hex: '#eab308', symbol: '◆' },
  { id: 'purple', hex: '#a855f7', symbol: '★' },
  { id: 'orange', hex: '#f97316', symbol: '⬢' },
];

export function colorById(id: ColorId): ColorDef {
  return COLORS.find((c) => c.id === id)!;
}

export type Tuning = {
  /** Answer window at score 0 — the slow, generous start (ms). */
  startMs: number;
  /** How much the window shrinks per correct answer (ms). */
  stepMs: number;
  /** The fastest the window ever gets — a floor so it stays playable (ms). */
  minMs: number;
  /** Number of answer choices shown. */
  optionCount: number;
};

// Shuttle-run pacing: every difficulty STARTS slow and speeds up each round.
// Harder difficulties start faster and accelerate harder, with more choices.
export const TUNING: Record<Difficulty, Tuning> = {
  easy: { startMs: 2400, stepMs: 45, minMs: 700, optionCount: 3 },
  medium: { startMs: 2000, stepMs: 55, minMs: 600, optionCount: 4 },
  hard: { startMs: 1700, stepMs: 65, minMs: 500, optionCount: 5 },
  expert: { startMs: 1400, stepMs: 80, minMs: 420, optionCount: 6 },
};

/** The answer window for the current score — shrinks toward `minMs` as you go. */
export function windowForScore(tuning: Tuning, score: number): number {
  return Math.max(tuning.minMs, tuning.startMs - score * tuning.stepMs);
}

export type Round = {
  /** The text that is displayed (a color NAME). */
  word: ColorId;
  /** The color the text is painted in — this is the correct answer. */
  ink: ColorId;
  /** Answer choices; always includes `ink` and `word`, unique, shuffled. */
  options: ColorId[];
};

/** Fisher–Yates shuffle using the supplied PRNG (pure — no global Math.random). */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build one Stroop round. The displayed WORD never matches its INK color (so
 * there is always interference), and the option set always contains both the
 * correct ink color and the tempting word color, plus random distractors.
 */
export function makeRound(rng: () => number, tuning: Tuning): Round {
  const count = Math.min(tuning.optionCount, COLORS.length);
  const shuffled = shuffle(
    COLORS.map((c) => c.id),
    rng,
  );
  const ink = shuffled[0];
  const word = shuffled[1]; // guaranteed different from ink → Stroop interference

  const chosen = new Set<ColorId>([ink, word]);
  let i = 2;
  while (chosen.size < count && i < shuffled.length) chosen.add(shuffled[i++]);

  return { word, ink, options: shuffle([...chosen], rng) };
}
