// Titles (称号) — a short flex line under the player's name (Brawl-Stars /
// chess.com). Two flavours: EARNED titles unlock from play (streaks, rank,
// plays) and PREMIUM titles come from plan / pass / purchase. Shown inside the
// NamePlate and selectable in the profile locker.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting, getStreak } from './storage';
import { getProfile, synapseScore } from './synapse';
import { tierForScore } from './tiers';
import { eloRank } from './elo';
import type { Rarity } from './rarity';
import type { Unlock } from './inventory';

export type TitleCtx = { elo: number; wins: number };

export type Title = {
  id: string;
  nameKey: string;
  rarity: Rarity;
  /** Premium unlock (plan / pass / purchase). Omit for earned titles. */
  unlock?: Unlock;
  /** Earned predicate from local progress + online stats. Omit for premium. */
  earn?: (ctx: TitleCtx) => boolean;
};

export const TITLES: Title[] = [
  // earned
  { id: 'title-rookie', nameKey: 'titles.rookie', rarity: 'common', earn: () => true },
  { id: 'title-devoted', nameKey: 'titles.devoted', rarity: 'rare', earn: () => getStreak() >= 7 },
  { id: 'title-unstoppable', nameKey: 'titles.unstoppable', rarity: 'epic', earn: () => getStreak() >= 30 },
  { id: 'title-scholar', nameKey: 'titles.scholar', rarity: 'rare', earn: () => getProfile().level >= 5 },
  { id: 'title-genius', nameKey: 'titles.genius', rarity: 'epic', earn: () => tierForScore(synapseScore(getProfile())).id === 'master' },
  { id: 'title-duelist', nameKey: 'titles.duelist', rarity: 'rare', earn: (c) => c.wins >= 10 },
  { id: 'title-gladiator', nameKey: 'titles.gladiator', rarity: 'epic', earn: (c) => c.wins >= 50 },
  { id: 'title-grandmaster', nameKey: 'titles.grandmaster', rarity: 'legendary', earn: (c) => eloRank(c.elo).id === 'grandmaster' },
  // premium
  { id: 'title-vip', nameKey: 'titles.vip', rarity: 'epic', unlock: { plan: 'plus' } },
  { id: 'title-legend', nameKey: 'titles.legend', rarity: 'legendary', unlock: { plan: 'pro' } },
  { id: 'title-mythic', nameKey: 'titles.mythic', rarity: 'mythic', unlock: { plan: 'pro' } },
];

let listeners: Array<() => void> = [];

export function getTitle(id: string): Title | undefined {
  return TITLES.find((t) => t.id === id);
}

/** The equipped title id, or '' for none. */
export function getEquippedTitleId(): string {
  return getSetting<string>('title', '');
}

export function equipTitle(id: string): void {
  setSetting('title', id);
  for (const l of listeners) l();
}

export function titleEarned(t: Title, ctx: TitleCtx): boolean {
  return t.earn ? t.earn(ctx) : false;
}

export function useEquippedTitle(): string {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return getEquippedTitleId();
}
