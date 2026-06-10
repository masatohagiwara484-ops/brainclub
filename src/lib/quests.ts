// Daily quests — the retention engine. Everyone gets the SAME three quests per
// UTC day (deterministic from dailySeed, the Wordle model), progress is fed by
// every recordPlay() via notePlay(), and clearing all three = a "Perfect Day"
// that banks the daily streak. Premium adds a Streak Shield: one missed day per
// calendar month is auto-bridged so a paid streak never dies to a busy Tuesday.

import { useEffect, useReducer } from 'react';
import { dailySeed, makeRng, dayNumber } from './daily';
import { getSetting, setSetting, bumpStreak, getStreak, getStreakState, setStreakState } from './storage';
import { GAMES } from '../games/registry';

export type Quest = {
  id: string;
  /** i18n key under quests.*; interpolated with {{n}} / {{game}}. */
  nameKey: string;
  target: number;
  /** counts a play toward this quest */
  match: (gameId: string, quality: number) => boolean;
  /** present when the quest names a specific game */
  gameId?: string;
};

// Template pool — varied enough that the daily trio feels fresh.
function buildPool(rng: () => number): Quest[] {
  const playable = GAMES.filter((g) => g.available);
  const pick = playable[Math.floor(rng() * playable.length)];
  const pick2 = playable[Math.floor(rng() * playable.length)];
  return [
    { id: 'play3', nameKey: 'quests.play3', target: 3, match: () => true },
    { id: 'good2', nameKey: 'quests.good2', target: 2, match: (_g, q) => q >= 0.5 },
    { id: 'daily-wordle', nameKey: 'quests.dailyWordle', target: 1, gameId: 'wordle', match: (g) => g === 'wordle' },
    { id: 'daily-yacht', nameKey: 'quests.dailyYacht', target: 1, gameId: 'yacht', match: (g) => g === 'yacht' },
    { id: `play-${pick.id}`, nameKey: 'quests.playGame', target: 1, gameId: pick.id, match: (g) => g === pick.id },
    { id: `master-${pick2.id}`, nameKey: 'quests.masterGame', target: 1, gameId: pick2.id, match: (g, q) => g === pick2.id && q >= 0.6 },
    { id: 'logic2', nameKey: 'quests.logic2', target: 2, match: (g) => (GAMES.find((x) => x.id === g)?.axes?.logic ?? 0) >= 0.5 },
  ];
}

/** Today's three quests — identical for every player (seeded by UTC day). */
export function todaysQuests(): Quest[] {
  const rng = makeRng(dailySeed('quests'));
  const pool = buildPool(rng);
  // Fisher-Yates with the daily rng, take 3 distinct templates.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

type Progress = Record<string, number>;
const progressKey = () => `quests:${dayNumber()}`;

export function questProgress(): Progress {
  return getSetting<Progress>(progressKey(), {});
}

let listeners: Array<() => void> = [];
const notify = () => listeners.forEach((l) => l());

/** Feed one finished play into today's quests (called by synapse.recordPlay). */
export function notePlay(gameId: string, quality: number): void {
  const quests = todaysQuests();
  const prog = questProgress();
  let changed = false;
  for (const q of quests) {
    if ((prog[q.id] ?? 0) >= q.target) continue;
    if (q.match(gameId, quality)) {
      prog[q.id] = (prog[q.id] ?? 0) + 1;
      changed = true;
    }
  }
  if (!changed) return;
  setSetting(progressKey(), prog);
  // Perfect Day: all three cleared → bank today's streak.
  if (quests.every((q) => (prog[q.id] ?? 0) >= q.target)) bumpStreak();
  notify();
}

export function isPerfectDay(): boolean {
  const prog = questProgress();
  return todaysQuests().every((q) => (prog[q.id] ?? 0) >= q.target);
}

/**
 * Streak Shield (paid perk): if exactly one day was missed and the player is
 * Plus/Pro, bridge it (max 2/month). Call once at app start.
 */
export function applyStreakShield(isPaid: boolean): boolean {
  if (!isPaid) return false;
  const s = getStreakState();
  if (s.count === 0 || !s.lastDay) return false;
  const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (s.lastDay !== dayBefore) return false; // streak intact or already dead (>1 day gap)
  const month = new Date().toISOString().slice(0, 7);
  const used = getSetting<number>(`streakShield:${month}`, 0);
  if (used >= 2) return false;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  setStreakState({ count: s.count, lastDay: yesterday }); // bridge the gap
  setSetting(`streakShield:${month}`, used + 1);
  notify();
  return true;
}

export function useQuests(): { quests: Quest[]; progress: Progress; perfect: boolean; streak: number } {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return { quests: todaysQuests(), progress: questProgress(), perfect: isPerfectDay(), streak: getStreak() };
}
