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
  /** How long the player has to answer this round (ms). */
  windowMs: number;
  /** Number of answer choices shown. */
  optionCount: number;
};

// Faster windows and more choices as difficulty climbs.
export const TUNING: Record<Difficulty, Tuning> = {
  easy: { windowMs: 1600, optionCount: 3 },
  medium: { windowMs: 1150, optionCount: 4 },
  hard: { windowMs: 850, optionCount: 5 },
  expert: { windowMs: 600, optionCount: 6 },
};

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
