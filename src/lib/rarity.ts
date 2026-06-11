// Rarity — the Clash-Royale / Brawl-Stars collectible language layered onto
// HOLO. Every cosmetic (board skin, frame, nameplate, title, sudoku theme,
// pass reward…) carries a Rarity; the color/glow/label is the SAME everywhere
// so the whole app reads as one collection. Rarity is the VISUAL prestige axis;
// plan/pass/purchase are the ownership axis (see lib/inventory.ts).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type RarityMeta = {
  /** i18n key under rarity.* */
  nameKey: string;
  /** solid accent (text / borders) */
  color: string;
  /** ring gradient for tiles + nameplate edges */
  gradient: string;
  /** glow color for the legendary+ shine */
  glow: string;
  /** ordering / power */
  rank: number;
};

export const RARITY: Record<Rarity, RarityMeta> = {
  common: {
    nameKey: 'rarity.common',
    color: '#94a3b8',
    gradient: 'linear-gradient(135deg,#cbd5e1,#64748b)',
    glow: 'rgba(148,163,184,0.4)',
    rank: 0,
  },
  rare: {
    nameKey: 'rarity.rare',
    color: '#38bdf8',
    gradient: 'linear-gradient(135deg,#7dd3fc,#0284c7)',
    glow: 'rgba(56,189,248,0.55)',
    rank: 1,
  },
  epic: {
    nameKey: 'rarity.epic',
    color: '#c084fc',
    gradient: 'linear-gradient(135deg,#e9d5ff,#9333ea)',
    glow: 'rgba(192,132,252,0.6)',
    rank: 2,
  },
  legendary: {
    nameKey: 'rarity.legendary',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg,#fde68a,#f59e0b,#fb923c)',
    glow: 'rgba(251,191,36,0.7)',
    rank: 3,
  },
  mythic: {
    // the top tier wears the house iridescent sweep
    nameKey: 'rarity.mythic',
    color: '#e879f9',
    gradient: 'linear-gradient(135deg,#22d3ee,#818cf8,#e879f9)',
    glow: 'rgba(232,121,249,0.75)',
    rank: 4,
  },
};

export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export function rarityMeta(r: Rarity): RarityMeta {
  return RARITY[r];
}
