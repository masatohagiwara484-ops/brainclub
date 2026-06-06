// Per-game color identity (base · accent · glow), shared by anything that wants
// to theme itself to a specific game: the 3D selector's models, the premium
// result screen's confetti + accents, etc. Centralized here so the palette is
// declared ONCE and never drifts between surfaces. Colors are raw hex (not CSS
// vars) so canvas / Three.js / canvas-confetti can consume them directly.

import { palette } from './theme';

export type Trio = [base: string, accent: string, glow: string];

// Chosen to match each game's 2D identity. Falls back to the premium indigo set.
export const GAME_COLORS: Record<string, Trio> = {
  cube: ['#e11d48', '#f59e0b', '#22d3ee'],
  sudoku: ['#0ea5e9', '#4f46e5', '#38bdf8'],
  wordle: ['#10b981', '#0d9488', '#34d399'],
  solitaire: ['#f43f5e', '#dc2626', '#fb7185'],
  watersort: ['#06b6d4', '#2563eb', '#22d3ee'],
  gomoku: ['#d9a441', '#b45309', '#fbbf24'],
  colorclash: ['#ec4899', '#f97316', '#f472b6'],
  reaction: ['#84cc16', '#16a34a', '#a3e635'],
  simon: ['#f43f5e', '#db2777', '#fb7185'],
  memorygrid: ['#8b5cf6', '#d946ef', '#c084fc'],
  whack: ['#f59e0b', '#ea580c', '#fbbf24'],
  memory: ['#d946ef', '#9333ea', '#e879f9'],
  schulte: ['#14b8a6', '#0891b2', '#2dd4bf'],
  '2048': ['#fb923c', '#ef4444', '#fdba74'],
  slide: ['#0ea5e9', '#1d4ed8', '#38bdf8'],
  lightsout: ['#facc15', '#d97706', '#fde047'],
  mastermind: ['#6366f1', '#7e22ce', '#a5b4fc'],
  minesweeper: ['#64748b', '#334155', '#94a3b8'],
  flood: ['#22d3ee', '#2563eb', '#67e8f9'],
  pegsolitaire: ['#d97706', '#92400e', '#fbbf24'],
  chess: ['#94a3b8', '#334155', '#cbd5e1'],
};

/** The (base, accent, glow) trio for a game id, with a premium-indigo fallback. */
export function gameColors(id: string): Trio {
  return GAME_COLORS[id] ?? [palette.primary, palette.accentPink, palette.accentCyan];
}
