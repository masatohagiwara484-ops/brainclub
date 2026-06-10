// Premium game skins — the first real paid differentiation. One curated theme
// catalog (crystal / diamond / baroque / cyberpunk / dark-neon / matrix /
// dragon / fire) recolors the Gomoku board+stones, the Chess board+pieces and
// the Cube stickers. Plan-gated: free players keep `classic`, Plus unlocks the
// plus tier, Pro unlocks everything. Selection persists per game.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import { PLAN_RANK, type Plan } from './monetization';

export type SkinTier = 'free' | 'plus' | 'pro';

export type BoardTheme = {
  id: string;
  /** i18n key under skins.* */
  nameKey: string;
  tier: SkinTier;
  /** board checker / grid colors */
  boardA: string;
  boardB: string;
  line: string;
  frame: string;
  /** radial gradient stops for the two sides' stones / pieces */
  light: [string, string];
  dark: [string, string];
  /** accent glow used for selection / last-move markers */
  glow: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'classic', nameKey: 'skins.classic', tier: 'free', boardA: '#d9a55b', boardB: '#c08e47', line: 'rgba(60,40,15,0.85)', frame: '#a4753a', light: ['#ffffff', '#c9ccd2'], dark: ['#555555', '#0a0a0a'], glow: '#5b8cff' },
  { id: 'crystal', nameKey: 'skins.crystal', tier: 'plus', boardA: '#b7e3f5', boardB: '#7fc3e8', line: 'rgba(13,60,90,0.5)', frame: '#5aa7d6', light: ['#ffffff', '#bfeaff'], dark: ['#3a6ea8', '#102a4d'], glow: '#22d3ee' },
  { id: 'diamond', nameKey: 'skins.diamond', tier: 'pro', boardA: '#f3f4f8', boardB: '#cdd3e0', line: 'rgba(70,80,110,0.45)', frame: '#aab3c8', light: ['#ffffff', '#dfe5f2'], dark: ['#8d97ad', '#3c4254'], glow: '#e879f9' },
  { id: 'baroque', nameKey: 'skins.baroque', tier: 'plus', boardA: '#e7c98a', boardB: '#8a5a2b', line: 'rgba(48,28,8,0.7)', frame: '#5e3a16', light: ['#ffe9b8', '#d4a843'], dark: ['#6b4a22', '#241405'], glow: '#f5c542' },
  { id: 'cyberpunk', nameKey: 'skins.cyberpunk', tier: 'pro', boardA: '#1b1340', boardB: '#2a1b5e', line: 'rgba(34,211,238,0.4)', frame: '#22d3ee', light: ['#7df9ff', '#0e7490'], dark: ['#ff79c6', '#86198f'], glow: '#e879f9' },
  { id: 'darkneon', nameKey: 'skins.darkneon', tier: 'plus', boardA: '#0c0f1a', boardB: '#161b2c', line: 'rgba(129,140,248,0.4)', frame: '#312e81', light: ['#c7d2fe', '#6366f1'], dark: ['#4ade80', '#14532d'], glow: '#4ade80' },
  { id: 'matrix', nameKey: 'skins.matrix', tier: 'pro', boardA: '#03110a', boardB: '#062114', line: 'rgba(74,222,128,0.45)', frame: '#15803d', light: ['#bbf7d0', '#22c55e'], dark: ['#166534', '#021407'], glow: '#4ade80' },
  { id: 'dragon', nameKey: 'skins.dragon', tier: 'pro', boardA: '#3b1212', boardB: '#561a1a', line: 'rgba(245,197,66,0.5)', frame: '#b45309', light: ['#fde68a', '#d97706'], dark: ['#7f1d1d', '#1c0505'], glow: '#f59e0b' },
  { id: 'fire', nameKey: 'skins.fire', tier: 'plus', boardA: '#2a1206', boardB: '#451a03', line: 'rgba(251,146,60,0.5)', frame: '#9a3412', light: ['#fed7aa', '#fb923c'], dark: ['#7c2d12', '#190701'], glow: '#fb923c' },
];

/** Cube sticker palettes (U D F B L R) keyed by the same theme ids. */
export const CUBE_STICKERS: Record<string, { up: number; down: number; front: number; back: number; left: number; right: number }> = {
  classic: { right: 0xff3b30, left: 0xff9500, up: 0xffffff, down: 0xffd60a, front: 0x34c759, back: 0x007aff },
  crystal: { right: 0x67e8f9, left: 0x38bdf8, up: 0xf0fdff, down: 0xa5f3fc, front: 0x818cf8, back: 0x0ea5e9 },
  diamond: { right: 0xe2e8f0, left: 0x94a3b8, up: 0xffffff, down: 0xcbd5e1, front: 0xf0abfc, back: 0x64748b },
  baroque: { right: 0xd4a843, left: 0x8a5a2b, up: 0xffe9b8, down: 0xb45309, front: 0x713f12, back: 0xfde68a },
  cyberpunk: { right: 0xff79c6, left: 0x7df9ff, up: 0xf5d0fe, down: 0x22d3ee, front: 0xa78bfa, back: 0x86198f },
  darkneon: { right: 0x4ade80, left: 0x818cf8, up: 0xc7d2fe, down: 0x22d3ee, front: 0xf472b6, back: 0x312e81 },
  matrix: { right: 0x22c55e, left: 0x166534, up: 0xbbf7d0, down: 0x4ade80, front: 0x86efac, back: 0x052e16 },
  dragon: { right: 0xdc2626, left: 0x7f1d1d, up: 0xfde68a, down: 0xf59e0b, front: 0xb45309, back: 0x450a0a },
  fire: { right: 0xfb923c, left: 0x7c2d12, up: 0xfed7aa, down: 0xf97316, front: 0xdc2626, back: 0x431407 },
};

/** Premium cube SHAPES (geometry, not color) — the second cube storefront. */
export type CubeShapeDef = { id: 'classic' | 'pillow' | 'sphere' | 'gem'; nameKey: string; tier: SkinTier };
export const CUBE_SHAPES: CubeShapeDef[] = [
  { id: 'classic', nameKey: 'skins.shapeClassic', tier: 'free' },
  { id: 'pillow', nameKey: 'skins.shapePillow', tier: 'plus' },
  { id: 'sphere', nameKey: 'skins.shapeSphere', tier: 'pro' },
  { id: 'gem', nameKey: 'skins.shapeGem', tier: 'pro' },
];

export function shapeUnlocked(shape: CubeShapeDef, plan: Plan): boolean {
  return PLAN_RANK[plan] >= TIER_RANK[shape.tier];
}

export function getCubeShape(): CubeShapeDef {
  const id = getSetting<string>('skin:cube-shape', 'classic');
  return CUBE_SHAPES.find((sh) => sh.id === id) ?? CUBE_SHAPES[0];
}

export function setCubeShape(id: string): void {
  setSetting('skin:cube-shape', id);
  for (const l of listeners) l();
}

/** Reactive hook for the selected cube shape (re-renders on change). */
export function useCubeShape(): CubeShapeDef {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return getCubeShape();
}

const TIER_RANK: Record<SkinTier, number> = { free: 0, plus: 1, pro: 2 };

export function themeUnlocked(theme: BoardTheme, plan: Plan): boolean {
  return PLAN_RANK[plan] >= TIER_RANK[theme.tier];
}

export function getTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((th) => th.id === id) ?? BOARD_THEMES[0];
}

// ---- per-game persisted selection (tiny pub/sub so canvases redraw live) ----
let listeners: Array<() => void> = [];

export function getGameSkin(gameId: string): string {
  return getSetting<string>(`skin:${gameId}`, 'classic');
}

export function setGameSkin(gameId: string, themeId: string): void {
  setSetting(`skin:${gameId}`, themeId);
  for (const l of listeners) l();
}

/** Reactive hook: returns the selected theme for a game, re-rendering on change. */
export function useGameSkin(gameId: string): BoardTheme {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return getTheme(getGameSkin(gameId));
}
