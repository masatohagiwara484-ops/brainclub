// Shared difficulty scale used by multiple games (Sudoku, Gomoku, …).
// Test-play tuning lives in each game; this just defines the common levels.

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/** i18n key for a level's display label, e.g. difficulty.easy */
export const difficultyKey = (d: Difficulty): string => `difficulty.${d}`;
