// Synapse Score — the 3-axis brain profile (Mission 5).
//
// Every game produces a different raw metric (seconds, moves, guesses, points),
// so we can't average them directly. Instead each game converts its result into
// a single difficulty-anchored QUALITY in 0..1 (see `difficultyQuality`), tags
// itself with AXIS WEIGHTS in the registry (how much it taps memory / logic /
// reflex), and calls `recordPlay`. We then accumulate each axis as an
// exponential moving average (EMA) of `100 * quality`, with the step size scaled
// by that game's weight on the axis — so a reflex-heavy game moves the reflex
// axis fast and the memory axis barely at all. The axis value IS your smoothed
// history; there is no comparison to other players and no backend.
//
// A separate XP/level track grows purely with play volume (the "I'm
// progressing" reward), independent of how well any single round went.
//
// The core math is a pure function (`applyPlay`) so it can be mirrored and
// asserted by scripts/verify-synapse.mjs without a TS runtime.

import { notePlay } from './quests';
import { addPassXp, XP_PER_PLAY } from './brainPass';
import { isBoostActive } from './rewards';
import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import type { Difficulty } from './difficulty';

export type Axis = 'memory' | 'logic' | 'reflex';
export const AXES: Axis[] = ['memory', 'logic', 'reflex'];
export type AxisWeights = Partial<Record<Axis, number>>;

export type SynapseProfile = {
  memory: number; // 0..100
  logic: number; // 0..100
  reflex: number; // 0..100
  plays: number; // total recorded plays
  xp: number; // cumulative experience
  level: number; // derived from xp (>= 1)
  updatedAt: number;
};

// EMA step size for a full-weight axis. Converges over ~10-15 plays.
const ALPHA = 0.3;
// XP granted per play: a floor for showing up + a bonus for quality.
const XP_BASE = 40;
const XP_QUALITY = 60;

const STORE_KEY = 'synapse.profile';

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function clamp100(x: number): number {
  return x < 0 ? 0 : x > 100 ? 100 : x;
}

export const DIFFICULTY_BASE: Record<Difficulty, number> = {
  easy: 0.45,
  medium: 0.6,
  hard: 0.75,
  expert: 0.9,
};

/** Harder games grant proportionally more XP per play. */
export const XP_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.6,
  expert: 2,
};

/**
 * Turn a difficulty + in-game efficiency into a 0..1 quality. The difficulty
 * is the absolute anchor (clearing EXPERT is worth more than EASY); the
 * `performance` (0..1, e.g. how fast/clean the solve was) nudges it ±0.1.
 */
export function difficultyQuality(difficulty: Difficulty, performance = 0.5): number {
  return clamp01(DIFFICULTY_BASE[difficulty] + 0.1 * (2 * clamp01(performance) - 1));
}

export function emptyProfile(): SynapseProfile {
  return { memory: 0, logic: 0, reflex: 0, plays: 0, xp: 0, level: 1, updatedAt: 0 };
}

/** Cumulative XP required to *reach* a level: T(L) = 50·L·(L−1). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

/** The level for a given cumulative XP (>= 1). Inverse of xpForLevel. */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
}

/** XP remaining until the next level, and progress 0..1 through the current one. */
export function levelProgress(profile: SynapseProfile): { toNext: number; frac: number } {
  const cur = xpForLevel(profile.level);
  const next = xpForLevel(profile.level + 1);
  const span = next - cur || 1;
  return { toNext: Math.max(0, next - profile.xp), frac: clamp01((profile.xp - cur) / span) };
}

/** Equal-weighted mean of the three axes (0..100). */
export function synapseScore(profile: SynapseProfile): number {
  return Math.round((profile.memory + profile.logic + profile.reflex) / 3);
}

function normalizeWeights(axes: AxisWeights): Record<Axis, number> {
  const total = AXES.reduce((s, a) => s + Math.max(0, axes[a] ?? 0), 0);
  const out = { memory: 0, logic: 0, reflex: 0 };
  if (total <= 0) return out;
  for (const a of AXES) out[a] = Math.max(0, axes[a] ?? 0) / total;
  return out;
}

/**
 * The pure core: given a profile, a play's axis weights, its quality (0..1) and
 * an XP weight, return the next profile. No I/O — mirrored in the verify script.
 */
export function applyPlay(
  profile: SynapseProfile,
  axes: AxisWeights,
  quality: number,
  weight = 1,
): SynapseProfile {
  const q = clamp01(quality);
  const w = normalizeWeights(axes);
  const target = 100 * q;
  const next: SynapseProfile = { ...profile };
  for (const a of AXES) {
    next[a] = clamp100(profile[a] + ALPHA * w[a] * (target - profile[a]));
  }
  next.plays = profile.plays + 1;
  next.xp = profile.xp + Math.round((XP_BASE + XP_QUALITY * q) * Math.max(0, weight));
  next.level = levelForXp(next.xp);
  next.updatedAt = Date.now();
  return next;
}

// ---- reactive store (pub/sub, mirrors settings.ts) ----
type Listener = () => void;
let listeners: Listener[] = [];
function emit(): void {
  for (const l of listeners) l();
}
export function subscribeSynapse(l: Listener): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function getProfile(): SynapseProfile {
  const p = getSetting<SynapseProfile | null>(STORE_KEY, null);
  if (!p || typeof p.memory !== 'number') return emptyProfile();
  // Heal older/partial records.
  return { ...emptyProfile(), ...p, level: levelForXp(p.xp ?? 0) };
}

export type PlayInput = {
  gameId: string;
  axes: AxisWeights;
  /** Difficulty-anchored performance for this play, 0..1. */
  quality: number;
  /** XP multiplier for this play (e.g. a difficulty factor). Default 1. */
  weight?: number;
};

export type PlayResult = {
  profile: SynapseProfile;
  leveledUp: boolean;
  /** The new level if this play crossed a threshold, else undefined. */
  newLevel?: number;
};

/** Record a finished play, persist the new profile, and notify subscribers. */
export function recordPlay(input: PlayInput): PlayResult {
  // Feed the daily-quest engine (retention loop) — fire and forget.
  try { notePlay(input.gameId, input.quality); } catch { /* quests never break play */ }
  try { addPassXp(XP_PER_PLAY * (isBoostActive() ? 2 : 1)); } catch { /* pass never breaks play */ }
  const prev = getProfile();
  const profile = applyPlay(prev, input.axes, input.quality, input.weight ?? 1);
  setSetting(STORE_KEY, profile);
  emit();
  const leveledUp = profile.level > prev.level;
  return { profile, leveledUp, newLevel: leveledUp ? profile.level : undefined };
}

/** Re-notify subscribers after the profile was replaced underneath us (e.g. a
 *  cloud sync wrote localStorage directly). Components re-read via getProfile(). */
export function notifyProfileChanged(): void {
  emit();
}

/** Reset the whole profile (used by Settings / tests). */
export function resetProfile(): void {
  setSetting(STORE_KEY, emptyProfile());
  emit();
}

/** Subscribe a component to profile changes; returns the latest profile. */
export function useSynapse(): SynapseProfile {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeSynapse(force), []);
  return getProfile();
}
