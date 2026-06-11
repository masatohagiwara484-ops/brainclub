// Profile cosmetics — the monetizable identity layer (Clash-Royale/chess.com
// style). FRAMES wrap the avatar (plan-gated; later also one-off purchases),
// BADGES are earned achievements rendered on the profile card. Equipped frame
// persists locally (and rides the existing cloud Progress sync via settings).

import { getSetting, setSetting, getStreak } from './storage';
import { getProfile, synapseScore } from './synapse';
import { tierForScore } from './tiers';
import { PLAN_RANK, type Plan } from './monetization';
import { hasItem } from './inventory';

export type Frame = {
  id: string;
  nameKey: string;
  tier: 'free' | 'plus' | 'pro';
  /** CSS for the avatar ring (border-image-ish via background) */
  ring: string;
  glow?: string;
};

export const FRAMES: Frame[] = [
  { id: 'none', nameKey: 'cosmetics.frameNone', tier: 'free', ring: 'rgba(255,255,255,0.18)' },
  { id: 'iris', nameKey: 'cosmetics.frameIris', tier: 'plus', ring: 'linear-gradient(135deg,#22d3ee,#818cf8,#e879f9)', glow: 'rgba(129,140,248,0.5)' },
  { id: 'gold', nameKey: 'cosmetics.frameGold', tier: 'plus', ring: 'linear-gradient(135deg,#fde68a,#d97706,#fde68a)', glow: 'rgba(245,197,66,0.45)' },
  { id: 'dragon', nameKey: 'cosmetics.frameDragon', tier: 'pro', ring: 'linear-gradient(135deg,#f59e0b,#dc2626,#7f1d1d)', glow: 'rgba(220,38,38,0.5)' },
  { id: 'matrix', nameKey: 'cosmetics.frameMatrix', tier: 'pro', ring: 'linear-gradient(135deg,#4ade80,#166534,#4ade80)', glow: 'rgba(74,222,128,0.5)' },
];

const TIER_RANK = { free: 0, plus: 1, pro: 2 } as const;
export const frameUnlocked = (f: Frame, plan: Plan): boolean => PLAN_RANK[plan] >= TIER_RANK[f.tier] || hasItem(`frame-${f.id}`);

export function getEquippedFrame(): Frame {
  const id = getSetting<string>('frame', 'none');
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}
export function equipFrame(id: string): void {
  setSetting('frame', id);
}

// ---- earned badges -------------------------------------------------------------
export type Badge = { id: string; nameKey: string; icon: string; earned: boolean };

/** Compute the badge wall from local progress (+ online W/L when signed in). */
export function badges(online?: { wins: number; losses: number }): Badge[] {
  const p = getProfile();
  const streak = getStreak();
  const tier = tierForScore(synapseScore(p));
  const w = online?.wins ?? 0;
  return [
    { id: 'plays10', nameKey: 'cosmetics.badgePlays10', icon: 'play', earned: p.plays >= 10 },
    { id: 'plays100', nameKey: 'cosmetics.badgePlays100', icon: 'flame', earned: p.plays >= 100 },
    { id: 'streak7', nameKey: 'cosmetics.badgeStreak7', icon: 'zap', earned: streak >= 7 },
    { id: 'level5', nameKey: 'cosmetics.badgeLevel5', icon: 'star', earned: p.level >= 5 },
    { id: 'gold', nameKey: 'cosmetics.badgeGold', icon: 'medal', earned: ['gold', 'platinum', 'diamond', 'master'].includes(tier.id) },
    { id: 'firstWin', nameKey: 'cosmetics.badgeFirstWin', icon: 'swords', earned: w >= 1 },
    { id: 'wins25', nameKey: 'cosmetics.badgeWins25', icon: 'trophy', earned: w >= 25 },
    { id: 'master', nameKey: 'cosmetics.badgeMaster', icon: 'crown', earned: tier.id === 'master' },
  ];
}
