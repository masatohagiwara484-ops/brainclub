import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import type { GameProps } from './types';

export type GameCategory = 'must-have' | 'recommended' | 'innovative';

export type GameDef = {
  id: string;
  /** i18n key for the display name, e.g. games.cube.name */
  nameKey: string;
  /** i18n key for the short tagline */
  taglineKey: string;
  route: string;
  category: GameCategory;
  emoji: string;
  /** Tailwind gradient classes for the card */
  gradient: string;
  /** Playable now? If false, shows as "Coming soon". */
  available: boolean;
  /** Shows the difficulty-select screen (EASY–EXPERT) before launching. */
  hasDifficulty?: boolean;
  component?: LazyExoticComponent<ComponentType<GameProps>>;
};

// The portfolio. Only the cube is playable today; the rest tease the roadmap
// (Clubhouse Games × NYT Games). Order roughly follows the strategy doc.
export const GAMES: GameDef[] = [
  {
    id: 'cube',
    nameKey: 'games.cube.name',
    taglineKey: 'games.cube.tagline',
    route: '/play/cube',
    category: 'must-have',
    emoji: '🧊',
    gradient: 'from-[#ff3b30] via-[#ffd60a] to-[#34c759]',
    available: true,
    component: lazy(() => import('./cube/CubeGame')),
  },
  {
    id: 'sudoku',
    nameKey: 'games.sudoku.name',
    taglineKey: 'games.sudoku.tagline',
    route: '/play/sudoku',
    category: 'must-have',
    emoji: '🔢',
    gradient: 'from-sky-500 to-indigo-600',
    available: true,
    hasDifficulty: true,
    component: lazy(() => import('./sudoku/SudokuGame')),
  },
  { id: 'wordle', nameKey: 'games.wordle.name', taglineKey: 'games.wordle.tagline', route: '/play/wordle', category: 'must-have', emoji: '🟩', gradient: 'from-emerald-500 to-teal-600', available: false },
  { id: 'solitaire', nameKey: 'games.solitaire.name', taglineKey: 'games.solitaire.tagline', route: '/play/solitaire', category: 'must-have', emoji: '🃏', gradient: 'from-rose-500 to-red-600', available: false },
  {
    id: 'watersort',
    nameKey: 'games.watersort.name',
    taglineKey: 'games.watersort.tagline',
    route: '/play/watersort',
    category: 'must-have',
    emoji: '🧪',
    gradient: 'from-cyan-500 to-blue-600',
    available: true,
    hasDifficulty: true,
    component: lazy(() => import('./watersort/WaterSortGame')),
  },
  {
    id: 'gomoku',
    nameKey: 'games.gomoku.name',
    taglineKey: 'games.gomoku.tagline',
    route: '/play/gomoku',
    category: 'must-have',
    emoji: '⚫',
    gradient: 'from-amber-500 to-orange-600',
    available: true,
    hasDifficulty: true,
    component: lazy(() => import('./gomoku/GomokuGame')),
  },
  { id: 'chess', nameKey: 'games.chess.name', taglineKey: 'games.chess.tagline', route: '/play/chess', category: 'recommended', emoji: '♟️', gradient: 'from-slate-500 to-slate-700', available: false },
  { id: 'memory', nameKey: 'games.memory.name', taglineKey: 'games.memory.tagline', route: '/play/memory', category: 'recommended', emoji: '🧠', gradient: 'from-fuchsia-500 to-purple-600', available: false },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
