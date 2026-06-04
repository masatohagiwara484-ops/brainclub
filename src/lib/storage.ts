// Minimal typed localStorage helpers + per-game best records and a daily streak.
// All client-side for now (no backend). Keys are namespaced under "bc.".

const PREFIX = 'bc.';

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full / disabled — ignore */
  }
}

export type BestRecord = { seconds: number; moves: number; at: number };

export function getBest(gameId: string, variant: string): BestRecord | null {
  return get<BestRecord | null>(`best.${gameId}.${variant}`, null);
}

/** Save a record if it beats the existing best (by time). Returns true if new best. */
export function saveBest(gameId: string, variant: string, rec: BestRecord): boolean {
  const cur = getBest(gameId, variant);
  if (!cur || rec.seconds < cur.seconds) {
    set(`best.${gameId}.${variant}`, rec);
    return true;
  }
  return false;
}

// ---- Daily streak (the "daily ritual" engine) ----
export type Streak = { count: number; lastDay: string };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local-ish, UTC date)
}

export function getStreak(): number {
  return get<Streak>('streak', { count: 0, lastDay: '' }).count;
}

/** Call when the user completes a daily challenge. Updates and returns the streak. */
export function bumpStreak(): number {
  const s = get<Streak>('streak', { count: 0, lastDay: '' });
  const today = todayKey();
  if (s.lastDay === today) return s.count; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const next: Streak = {
    count: s.lastDay === yesterday ? s.count + 1 : 1,
    lastDay: today,
  };
  set('streak', next);
  return next.count;
}

// ---- Settings ----
export function getSetting<T>(key: string, fallback: T): T {
  return get<T>(`setting.${key}`, fallback);
}
export function setSetting<T>(key: string, value: T): void {
  set(`setting.${key}`, value);
}

// ---- Cloud sync: serialize / restore / merge the player's progress ----
//
// A Progress blob is the portable snapshot we push to / pull from Supabase: the
// Synapse profile, the daily streak, and every per-game best. `mergeProgress`
// is a PURE last-write-wins-with-best-of-each reconcile (mirrored in
// scripts/verify-cloud.mjs) so signing in on a new device never loses records.

// The Synapse profile is stored by synapse.ts; treat it opaquely here (compare
// by xp) to avoid an import cycle. Level is re-derived on read there.
type SynapseBlob = { xp?: number; plays?: number; updatedAt?: number } | null;

export type Progress = {
  synapse: SynapseBlob;
  streak: Streak;
  bests: Record<string, BestRecord>; // key = `${gameId}.${variant}`
  updatedAt: number;
};

const BEST_PREFIX = `${PREFIX}best.`;

/** Snapshot all local progress into a portable blob. */
export function exportProgress(): Progress {
  const bests: Record<string, BestRecord> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BEST_PREFIX)) {
        const rec = get<BestRecord | null>(k.slice(PREFIX.length), null);
        if (rec) bests[k.slice(BEST_PREFIX.length)] = rec;
      }
    }
  } catch {
    /* storage disabled */
  }
  return {
    synapse: get<SynapseBlob>('setting.synapse.profile', null),
    streak: get<Streak>('streak', { count: 0, lastDay: '' }),
    bests,
    updatedAt: Date.now(),
  };
}

/** Overwrite local progress from a blob (used after a cloud merge). */
export function importProgress(p: Progress): void {
  if (p.synapse) set('setting.synapse.profile', p.synapse);
  if (p.streak) set('streak', p.streak);
  for (const [key, rec] of Object.entries(p.bests || {})) set(`best.${key}`, rec);
}

/** Pure reconcile of two snapshots: keep the better of each metric. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  // Synapse: the profile with more XP carries the most history.
  const ax = a.synapse?.xp ?? -1;
  const bx = b.synapse?.xp ?? -1;
  const synapse = bx > ax ? b.synapse : a.synapse;

  // Streak: trust the later day; if the same day, keep the higher count.
  let streak: Streak;
  if (a.streak.lastDay === b.streak.lastDay) {
    streak = { lastDay: a.streak.lastDay, count: Math.max(a.streak.count, b.streak.count) };
  } else {
    streak = a.streak.lastDay > b.streak.lastDay ? a.streak : b.streak;
  }

  // Bests: union, keeping the fastest (lowest seconds) per game/variant.
  const bests: Record<string, BestRecord> = { ...a.bests };
  for (const [k, rec] of Object.entries(b.bests || {})) {
    if (!bests[k] || rec.seconds < bests[k].seconds) bests[k] = rec;
  }

  return { synapse, streak, bests, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}
