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
type Streak = { count: number; lastDay: string };

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
