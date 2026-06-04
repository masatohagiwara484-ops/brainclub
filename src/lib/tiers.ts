// Tier ladder (F2) — maps a 0..100 Synapse Score onto seven named rungs
// (Novice → Master) so the Score screen can show "where your thinking level
// sits" as a pyramid. There is no backend and no other players: the tier is a
// pure function of YOUR own smoothed score. Thresholds are evenly spaced every
// 15 points. The core is pure (no I/O) so it is mirrored and asserted by
// scripts/verify-tiers.mjs without a TS runtime.

export type Tier = {
  id: string;
  /** i18n key for the display name, e.g. tier.master */
  nameKey: string;
  /** Inclusive Synapse-Score threshold (0..100) to reach this tier. */
  min: number;
  /** Rung color for the pyramid. */
  color: string;
};

// Low → high. A score >= a tier's `min` (and below the next) lands on that rung.
export const TIERS: Tier[] = [
  { id: 'novice', nameKey: 'tier.novice', min: 0, color: '#94a3b8' },
  { id: 'bronze', nameKey: 'tier.bronze', min: 15, color: '#b45309' },
  { id: 'silver', nameKey: 'tier.silver', min: 30, color: '#64748b' },
  { id: 'gold', nameKey: 'tier.gold', min: 45, color: '#eab308' },
  { id: 'platinum', nameKey: 'tier.platinum', min: 60, color: '#14b8a6' },
  { id: 'diamond', nameKey: 'tier.diamond', min: 75, color: '#3b82f6' },
  { id: 'master', nameKey: 'tier.master', min: 90, color: '#a855f7' },
];

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Index into TIERS for a score (0..TIERS.length-1). Negatives map to Novice. */
export function tierIndexForScore(score: number): number {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (score >= TIERS[i].min) idx = i;
  return idx;
}

export function tierForScore(score: number): Tier {
  return TIERS[tierIndexForScore(score)];
}

export type TierProgress = {
  tier: Tier;
  /** The next rung up, or null at the top. */
  next: Tier | null;
  /** 0..1 through the current band toward the next tier (1 at the top). */
  frac: number;
  /** Points still needed to reach the next tier (0 at the top). */
  toNext: number;
};

export function tierProgress(score: number): TierProgress {
  const idx = tierIndexForScore(score);
  const tier = TIERS[idx];
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  if (!next) return { tier, next: null, frac: 1, toNext: 0 };
  const span = next.min - tier.min;
  const into = clamp(score, tier.min, next.min) - tier.min;
  return { tier, next, frac: span > 0 ? into / span : 1, toNext: Math.max(0, Math.ceil(next.min - score)) };
}
