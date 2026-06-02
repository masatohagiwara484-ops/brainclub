// Shared difficulty scale used by multiple games (Sudoku, Gomoku, …).
// Test-play tuning lives in each game; this just defines the common levels.

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'medium' || v === 'hard' || v === 'expert';
}

/** i18n key for a level's display label, e.g. difficulty.easy */
export const difficultyKey = (d: Difficulty): string => `difficulty.${d}`;

/**
 * Visual scale for the difficulty-select screen: green → red as it gets harder,
 * with 1–4 stars. (EASY=green … EXPERT=red, per product direction.)
 */
export type DifficultyStyle = {
  stars: number;
  /** Tailwind bg + hover + text classes for the level button. */
  bg: string;
  hover: string;
  text: string;
  /** A solid color (hex) for accents/rings. */
  color: string;
};

export const DIFFICULTY_STYLE: Record<Difficulty, DifficultyStyle> = {
  easy: { stars: 1, bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'text-white', color: '#22c55e' },
  medium: { stars: 2, bg: 'bg-yellow-400', hover: 'hover:bg-yellow-500', text: 'text-slate-900', color: '#facc15' },
  hard: { stars: 3, bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'text-white', color: '#3b82f6' },
  expert: { stars: 4, bg: 'bg-red-500', hover: 'hover:bg-red-600', text: 'text-white', color: '#ef4444' },
};
