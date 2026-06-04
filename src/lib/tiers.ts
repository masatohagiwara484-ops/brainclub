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
  /** Rung color for the pyramid (used for the active-rung glow / dot). */
  color: string;
  /** Tailwind gradient classes for the rung — a subtle metallic sheen that
   *  intensifies on higher tiers (via-stop = highlight). Purely visual. */
  gradient: string;
  /** Foreground text class that stays readable on this rung's gradient. */
  text: string;
};

// Low → high. A score >= a tier's `min` (and below the next) lands on that rung.
export const TIERS: Tier[] = [
  { id: 'novice', nameKey: 'tier.novice', min: 0, color: '#94a3b8', gradient: 'from-slate-400 to-slate-500', text: 'text-white' },
  { id: 'bronze', nameKey: 'tier.bronze', min: 15, color: '#b45309', gradient: 'from-[#c2853f] via-[#9a5a23] to-[#7c4518]', text: 'text-white' },
  { id: 'silver', nameKey: 'tier.silver', min: 30, color: '#64748b', gradient: 'from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8]', text: 'text-slate-900' },
  { id: 'gold', nameKey: 'tier.gold', min: 45, color: '#eab308', gradient: 'from-[#fde68a] via-[#eab308] to-[#b8860b]', text: 'text-slate-900' },
  { id: 'platinum', nameKey: 'tier.platinum', min: 60, color: '#14b8a6', gradient: 'from-[#5eead4] via-[#14b8a6] to-[#0d9488]', text: 'text-white' },
  { id: 'diamond', nameKey: 'tier.diamond', min: 75, color: '#3b82f6', gradient: 'from-[#93c5fd] via-[#3b82f6] to-[#2563eb]', text: 'text-white' },
  { id: 'master', nameKey: 'tier.master', min: 90, color: '#a855f7', gradient: 'from-[#c084fc] via-[#a855f7] to-[#7e22ce]', text: 'text-white' },
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

// Public API aliases matching the redesign spec's naming (getTierForScore /
// getTierProgress). They delegate to the canonical functions above, which the
// rest of the app and scripts/verify-tiers.mjs already use.
export const getTierForScore = tierForScore;
export const getTierProgress = tierProgress;
