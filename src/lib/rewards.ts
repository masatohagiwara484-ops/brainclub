// Reward systems — the two CR/BS-style generosity loops:
//   • DAILY CHEST: a 7-day calendar. Open one chest per day; consecutive days
//     advance the cycle (a miss resets it). Days 1-6 pay escalating Pass XP,
//     day 7 pays big XP plus a cosmetic from the bonus pool. THE login habit.
//   • REWARDED BOOST: "watch an ad" (mock player for now — the future
//     AdMob/AdSense slot) → 2× Pass XP for 30 minutes, max 3 a day.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import { addPassXp } from './brainPass';
import { grantItem, owned } from './inventory';
import type { Rarity } from './rarity';
import type { IconName } from '../components/Icons';

let listeners: Array<() => void> = [];
const emit = () => listeners.forEach((l) => l());
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

// ---- daily chest ---------------------------------------------------------------

/** XP per cycle day (index 0..6); day 7 also grants a cosmetic. */
export const CHEST_XP = [30, 40, 50, 60, 70, 80, 120] as const;

/** Day-7 cosmetic pool — drawn from items the player does NOT own yet. */
const BONUS_POOL: Array<{ id: string; nameKey: string; rarity: Rarity; icon: IconName }> = [
  { id: 'plate-ocean', nameKey: 'plates.ocean', rarity: 'rare', icon: 'user' },
  { id: 'sudoku-ocean', nameKey: 'sudokuSkins.ocean', rarity: 'rare', icon: 'hash' },
  { id: 'board-crystal', nameKey: 'skins.crystal', rarity: 'rare', icon: 'star' },
  { id: 'board-sakura', nameKey: 'skins.sakura', rarity: 'rare', icon: 'star' },
  { id: 'title-duelist', nameKey: 'titles.duelist', rarity: 'rare', icon: 'swords' },
  { id: 'board-fire', nameKey: 'skins.fire', rarity: 'rare', icon: 'star' },
  { id: 'sudoku-sakura', nameKey: 'sudokuSkins.sakura', rarity: 'rare', icon: 'hash' },
  { id: 'plate-sunset', nameKey: 'plates.sunset', rarity: 'rare', icon: 'user' },
  { id: 'board-darkneon', nameKey: 'skins.darkneon', rarity: 'rare', icon: 'star' },
  { id: 'cube-pillow', nameKey: 'skins.shapePillow', rarity: 'rare', icon: 'star' },
];

type ChestState = { cycle: number; lastDay: string };

export function chestState(): ChestState {
  return getSetting<ChestState>('dailyChest', { cycle: 0, lastDay: '' });
}

export function canOpenChest(): boolean {
  return chestState().lastDay !== today();
}

export type ChestPrize = {
  xp: number;
  /** day-7 cosmetic, when one was granted */
  bonus?: { id: string; nameKey: string; rarity: Rarity; icon: IconName };
  day: number; // 1..7
};

/** Open today's chest. Returns the prize, or null if already opened today. */
export function openChest(): ChestPrize | null {
  const s = chestState();
  if (s.lastDay === today()) return null;
  const cycle = s.lastDay === yesterday() ? s.cycle : 0; // a missed day restarts
  const xp = CHEST_XP[cycle];
  addPassXp(xp);
  let bonus: ChestPrize['bonus'];
  if (cycle === 6) {
    const have = new Set(owned());
    const pool = BONUS_POOL.filter((b) => !have.has(b.id));
    if (pool.length > 0) {
      bonus = pool[Math.floor(Math.random() * pool.length)];
      grantItem(bonus.id);
    }
  }
  setSetting('dailyChest', { cycle: (cycle + 1) % 7, lastDay: today() });
  emit();
  return { xp, bonus, day: cycle + 1 };
}

// ---- rewarded boost --------------------------------------------------------------

export const BOOST_MINUTES = 30;
export const BOOSTS_PER_DAY = 3;

export function boostExpiry(): number {
  return getSetting<number>('xpBoostUntil', 0);
}
export function isBoostActive(): boolean {
  return Date.now() < boostExpiry();
}
export function boostsUsedToday(): number {
  return getSetting<number>(`xpBoosts:${today()}`, 0);
}
export function canWatchBoost(): boolean {
  return boostsUsedToday() < BOOSTS_PER_DAY;
}

/** Grant the post-ad reward: 2× Pass XP for the next 30 minutes. */
export function grantBoost(): void {
  setSetting('xpBoostUntil', Date.now() + BOOST_MINUTES * 60000);
  setSetting(`xpBoosts:${today()}`, boostsUsedToday() + 1);
  emit();
}

export function useRewards(): {
  chestReady: boolean;
  chestDay: number;
  boostActive: boolean;
  boostsLeft: number;
} {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  const s = chestState();
  const nextDay = (s.lastDay === today() ? s.cycle : s.lastDay === yesterday() ? s.cycle : 0) + 1;
  return {
    chestReady: canOpenChest(),
    chestDay: Math.min(7, nextDay),
    boostActive: isBoostActive(),
    boostsLeft: BOOSTS_PER_DAY - boostsUsedToday(),
  };
}
