// Name plates — the banner behind a player's name (Clash-Royale / chess.com).
// A premium identity surface shown on the profile card, leaderboard rows and
// the online match HUD. Each plate has a rarity (prestige) and an unlock tier
// (plan) — and, like all cosmetics, can also be granted individually via the
// Brain Pass or a purchase (lib/inventory.ts).

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import type { Rarity } from './rarity';
import type { Unlock } from './inventory';

export type NamePlate = {
  id: string;
  nameKey: string;
  rarity: Rarity;
  unlock: Unlock;
  /** CSS background for the plate (gradient / pattern over a dark base). */
  bg: string;
  /** Text color for the name on this plate. */
  text: string;
  /** Optional accent for the rank chip / edge. */
  accent: string;
};

const D = '#0e1226';

export const NAMEPLATES: NamePlate[] = [
  { id: 'plate-default', nameKey: 'plates.default', rarity: 'common', unlock: { plan: 'free' }, bg: `linear-gradient(100deg, ${D}, #1b2236)`, text: '#e2e8f0', accent: '#64748b' },
  { id: 'plate-ocean', nameKey: 'plates.ocean', rarity: 'rare', unlock: { plan: 'free' }, bg: 'linear-gradient(100deg,#0c4a6e,#0ea5e9)', text: '#f0f9ff', accent: '#38bdf8' },
  { id: 'plate-sunset', nameKey: 'plates.sunset', rarity: 'rare', unlock: { plan: 'plus' }, bg: 'linear-gradient(100deg,#7c2d12,#fb923c)', text: '#fff7ed', accent: '#fdba74' },
  { id: 'plate-forest', nameKey: 'plates.forest', rarity: 'rare', unlock: { plan: 'plus' }, bg: 'linear-gradient(100deg,#14532d,#22c55e)', text: '#f0fdf4', accent: '#4ade80' },
  { id: 'plate-royal', nameKey: 'plates.royal', rarity: 'epic', unlock: { plan: 'plus' }, bg: 'linear-gradient(100deg,#3b0764,#a855f7)', text: '#faf5ff', accent: '#d8b4fe' },
  { id: 'plate-cyber', nameKey: 'plates.cyber', rarity: 'epic', unlock: { plan: 'pro' }, bg: 'linear-gradient(100deg,#0f172a,#22d3ee 120%)', text: '#ecfeff', accent: '#22d3ee' },
  { id: 'plate-gold', nameKey: 'plates.gold', rarity: 'legendary', unlock: { plan: 'pro' }, bg: 'linear-gradient(100deg,#713f12,#f59e0b 70%,#fde68a)', text: '#1c1917', accent: '#fbbf24' },
  { id: 'plate-dragon', nameKey: 'plates.dragon', rarity: 'legendary', unlock: { plan: 'pro' }, bg: 'linear-gradient(100deg,#1c0505,#dc2626 60%,#f59e0b)', text: '#fff7ed', accent: '#fca5a5' },
  { id: 'plate-mythic', nameKey: 'plates.mythic', rarity: 'mythic', unlock: { plan: 'pro' }, bg: 'linear-gradient(100deg,#22d3ee,#818cf8,#e879f9)', text: '#0b1020', accent: '#ffffff' },
];

let listeners: Array<() => void> = [];

export function getPlate(id: string): NamePlate {
  return NAMEPLATES.find((p) => p.id === id) ?? NAMEPLATES[0];
}

export function getEquippedPlate(): NamePlate {
  return getPlate(getSetting<string>('nameplate', 'plate-default'));
}

export function equipPlate(id: string): void {
  setSetting('nameplate', id);
  for (const l of listeners) l();
}

export function useEquippedPlate(): NamePlate {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return getEquippedPlate();
}
