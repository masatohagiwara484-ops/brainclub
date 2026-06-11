// Unified cosmetic ownership (the collection). One source of truth for "do I
// own item X" across every cosmetic family (board skins, frames, nameplates,
// titles, sudoku themes…). Ownership has three sources, ORed together:
//   • plan       — Plus/Pro subscriptions auto-grant a tier (existing model)
//   • inventory  — items explicitly granted: Brain Pass rewards, achievements,
//                  one-off mock purchases (this module)
//   • free       — items with no gate
// Persisted locally (rides the cloud Progress sync like every other setting).

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import { PLAN_RANK, type Plan } from './monetization';

export type UnlockTier = 'free' | 'plus' | 'pro';

/** How a cosmetic can be unlocked. plan = subscription tier; the item is also
 *  unlocked if it has been explicitly granted into the inventory. */
export type Unlock = { plan: UnlockTier };

const TIER_RANK: Record<UnlockTier, number> = { free: 0, plus: 1, pro: 2 };

const KEY = 'inventory';

let listeners: Array<() => void> = [];
const emit = () => listeners.forEach((l) => l());

/** All explicitly-granted cosmetic ids (pass rewards / purchases / achievements). */
export function owned(): string[] {
  return getSetting<string[]>(KEY, []);
}

export function hasItem(id: string): boolean {
  return owned().includes(id);
}

/** Grant an item into the inventory (idempotent). Returns true if newly added. */
export function grantItem(id: string): boolean {
  const cur = owned();
  if (cur.includes(id)) return false;
  setSetting(KEY, [...cur, id]);
  emit();
  return true;
}

/**
 * Is a cosmetic unlocked for this player? True when the plan tier is met OR the
 * item was granted into the inventory. `id` lets a free/plan item also be
 * unlocked individually (pass/purchase) without raising the whole tier.
 */
export function isUnlocked(unlock: Unlock, plan: Plan, id?: string): boolean {
  if (PLAN_RANK[plan] >= TIER_RANK[unlock.plan]) return true;
  return id ? hasItem(id) : false;
}

/** Reactive subscription to inventory changes. */
export function useInventory(): { owned: string[]; has: (id: string) => boolean } {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return { owned: owned(), has: hasItem };
}
