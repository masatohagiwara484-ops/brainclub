import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import type { GameProps } from './types';
import type { AxisWeights } from '../lib/synapse';

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
  /** How this game taps the three Synapse axes (memory / logic / reflex). */
  axes?: AxisWeights;
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
    axes: { memory: 0.3, logic: 0.4, reflex: 0.3 },
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
    axes: { logic: 0.8, memory: 0.2 },
    component: lazy(() => import('./sudoku/SudokuGame')),
  },
  {
    id: 'wordle',
    nameKey: 'games.wordle.name',
    taglineKey: 'games.wordle.tagline',
    route: '/play/wordle',
    category: 'must-have',
    emoji: '🟩',
    gradient: 'from-emerald-500 to-teal-600',
    available: true,
    hasDifficulty: true,
    axes: { memory: 0.4, logic: 0.5, reflex: 0.1 },
    component: lazy(() => import('./wordle/WordleGame')),
  },
  {
    id: 'solitaire',
    nameKey: 'games.solitaire.name',
    taglineKey: 'games.solitaire.tagline',
    route: '/play/solitaire',
    category: 'must-have',
    emoji: '🃏',
    gradient: 'from-rose-500 to-red-600',
    available: true,
    hasDifficulty: true,
    axes: { logic: 0.5, memory: 0.3, reflex: 0.2 },
    component: lazy(() => import('./solitaire/SolitaireGame')),
  },
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
    axes: { logic: 0.7, memory: 0.3 },
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
    axes: { logic: 0.7, reflex: 0.3 },
    component: lazy(() => import('./gomoku/GomokuGame')),
  },
  {
    id: 'colorclash',
    nameKey: 'games.colorclash.name',
    taglineKey: 'games.colorclash.tagline',
    route: '/play/colorclash',
    category: 'innovative',
    emoji: '🎨',
    gradient: 'from-pink-500 via-violet-500 to-orange-400',
    available: true,
    hasDifficulty: true,
    axes: { reflex: 0.8, logic: 0.2 },
    component: lazy(() => import('./colorclash/ColorClashGame')),
  },
  { id: 'chess', nameKey: 'games.chess.name', taglineKey: 'games.chess.tagline', route: '/play/chess', category: 'recommended', emoji: '♟️', gradient: 'from-slate-500 to-slate-700', available: false },
  { id: 'memory', nameKey: 'games.memory.name', taglineKey: 'games.memory.tagline', route: '/play/memory', category: 'recommended', emoji: '🧠', gradient: 'from-fuchsia-500 to-purple-600', available: false },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
