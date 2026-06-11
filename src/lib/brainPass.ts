// Brain Pass — the seasonal reward track (Brawl Pass / CR Pass Royale). Two
// parallel tracks of tiers: FREE (everyone) and PREMIUM (Pro plan, or a one-off
// "pass" purchase). Pass XP is earned by playing every day (fed from
// synapse.recordPlay), each tier banks a cosmetic reward you claim with a juicy
// reveal. A new season every calendar month resets the track — the recurring
// reason to come back and the recurring thing to sell.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import { grantItem, hasItem } from './inventory';
import type { Rarity } from './rarity';
import type { IconName } from '../components/Icons';

export const XP_PER_TIER = 100;
export const XP_PER_PLAY = 22;
export const PERFECT_DAY_BONUS = 40;

export type Reward = {
  /** inventory id granted on claim (e.g. plate-gold, title-vip, board-crystal). */
  id: string;
  /** i18n key for the reward name (reuses each catalog's keys). */
  nameKey: string;
  rarity: Rarity;
  icon: IconName;
};

export type PassTier = { tier: number; free: Reward; premium: Reward };

// One curated 15-tier season. Free track = approachable (commons→epics),
// premium = the showcase (epics→legendary→mythic). Ids match the catalogs.
export const PASS_TIERS: PassTier[] = [
  { tier: 1, free: { id: 'sudoku-ocean', nameKey: 'sudokuSkins.ocean', rarity: 'rare', icon: 'hash' }, premium: { id: 'plate-sunset', nameKey: 'plates.sunset', rarity: 'rare', icon: 'user' } },
  { tier: 2, free: { id: 'title-duelist', nameKey: 'titles.duelist', rarity: 'rare', icon: 'swords' }, premium: { id: 'frame-iris', nameKey: 'cosmetics.frameIris', rarity: 'epic', icon: 'sparkles' } },
  { tier: 3, free: { id: 'board-crystal', nameKey: 'skins.crystal', rarity: 'rare', icon: 'star' }, premium: { id: 'plate-forest', nameKey: 'plates.forest', rarity: 'rare', icon: 'user' } },
  { tier: 4, free: { id: 'cube-pillow', nameKey: 'skins.shapePillow', rarity: 'rare', icon: 'star' }, premium: { id: 'sudoku-forest', nameKey: 'sudokuSkins.forest', rarity: 'epic', icon: 'hash' } },
  { tier: 5, free: { id: 'plate-ocean', nameKey: 'plates.ocean', rarity: 'rare', icon: 'user' }, premium: { id: 'title-vip', nameKey: 'titles.vip', rarity: 'epic', icon: 'crown' } },
  { tier: 6, free: { id: 'board-baroque', nameKey: 'skins.baroque', rarity: 'rare', icon: 'star' }, premium: { id: 'plate-royal', nameKey: 'plates.royal', rarity: 'epic', icon: 'user' } },
  { tier: 7, free: { id: 'sudoku-sakura', nameKey: 'sudokuSkins.sakura', rarity: 'rare', icon: 'hash' }, premium: { id: 'frame-gold', nameKey: 'cosmetics.frameGold', rarity: 'epic', icon: 'sparkles' } },
  { tier: 8, free: { id: 'title-gladiator', nameKey: 'titles.gladiator', rarity: 'epic', icon: 'swords' }, premium: { id: 'board-cyberpunk', nameKey: 'skins.cyberpunk', rarity: 'epic', icon: 'star' } },
  { tier: 9, free: { id: 'board-fire', nameKey: 'skins.fire', rarity: 'rare', icon: 'star' }, premium: { id: 'cube-sphere', nameKey: 'skins.shapeSphere', rarity: 'epic', icon: 'star' } },
  { tier: 10, free: { id: 'plate-cyber', nameKey: 'plates.cyber', rarity: 'epic', icon: 'user' }, premium: { id: 'plate-gold', nameKey: 'plates.gold', rarity: 'legendary', icon: 'user' } },
  { tier: 11, free: { id: 'board-darkneon', nameKey: 'skins.darkneon', rarity: 'rare', icon: 'star' }, premium: { id: 'sudoku-royal', nameKey: 'sudokuSkins.royal', rarity: 'epic', icon: 'hash' } },
  { tier: 12, free: { id: 'sudoku-gold', nameKey: 'sudokuSkins.gold', rarity: 'legendary', icon: 'hash' }, premium: { id: 'frame-dragon', nameKey: 'cosmetics.frameDragon', rarity: 'legendary', icon: 'sparkles' } },
  { tier: 13, free: { id: 'cube-gem', nameKey: 'skins.shapeGem', rarity: 'epic', icon: 'star' }, premium: { id: 'board-dragon', nameKey: 'skins.dragon', rarity: 'legendary', icon: 'star' } },
  { tier: 14, free: { id: 'title-legend', nameKey: 'titles.legend', rarity: 'legendary', icon: 'crown' }, premium: { id: 'plate-dragon', nameKey: 'plates.dragon', rarity: 'legendary', icon: 'user' } },
  { tier: 15, free: { id: 'frame-matrix', nameKey: 'cosmetics.frameMatrix', rarity: 'legendary', icon: 'sparkles' }, premium: { id: 'plate-mythic', nameKey: 'plates.mythic', rarity: 'mythic', icon: 'crown' } },
];

export const MAX_TIER = PASS_TIERS.length;

/** Current season id = YYYY-MM (UTC). New month → fresh track. */
export function seasonId(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

type PassData = { season: string; xp: number; claimedFree: number[]; claimedPremium: number[] };

const KEY = () => `brainpass:${seasonId()}`;

export function passData(): PassData {
  return getSetting<PassData>(KEY(), { season: seasonId(), xp: 0, claimedFree: [], claimedPremium: [] });
}

let listeners: Array<() => void> = [];
const emit = () => listeners.forEach((l) => l());

export function tierForXp(xp: number): number {
  return Math.min(MAX_TIER, Math.floor(xp / XP_PER_TIER));
}

/** Add pass XP (fed by recordPlay / perfect-day). */
export function addPassXp(n: number): void {
  const d = passData();
  d.xp = Math.min(MAX_TIER * XP_PER_TIER, d.xp + n);
  setSetting(KEY(), d);
  emit();
}

/** True when the player owns this season's premium track (Pro plan or bought). */
export function hasPremiumPass(plan: 'free' | 'plus' | 'pro'): boolean {
  return plan === 'pro' || hasItem(`pass-${seasonId()}`);
}

/** Mock "buy the pass" for this season → unlocks the premium track. */
export function buyPass(): void {
  grantItem(`pass-${seasonId()}`);
  emit();
}

/** Claim a reward if its tier is reached (and premium track owned). Grants it. */
export function claimReward(tier: number, track: 'free' | 'premium', plan: 'free' | 'plus' | 'pro'): Reward | null {
  const d = passData();
  if (tierForXp(d.xp) < tier) return null;
  if (track === 'premium' && !hasPremiumPass(plan)) return null;
  const claimed = track === 'free' ? d.claimedFree : d.claimedPremium;
  if (claimed.includes(tier)) return null;
  const def = PASS_TIERS.find((p) => p.tier === tier);
  if (!def) return null;
  const reward = track === 'free' ? def.free : def.premium;
  claimed.push(tier);
  setSetting(KEY(), d);
  grantItem(reward.id);
  emit();
  return reward;
}

export function useBrainPass(): {
  data: PassData;
  tier: number;
  xpInTier: number;
} {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  const data = passData();
  return { data, tier: tierForXp(data.xp), xpInTier: data.xp % XP_PER_TIER };
}
