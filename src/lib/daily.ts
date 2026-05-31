// Deterministic "daily" helpers — everyone gets the same seed each day so
// scores are comparable and shareable (the Wordle daily-ritual model).

/** Integer day number since epoch (UTC). */
export function dayNumber(date = new Date()): number {
  return Math.floor(date.getTime() / 86400000);
}

/** Stable seed for today, optionally namespaced per game. */
export function dailySeed(gameId: string, date = new Date()): number {
  const n = dayNumber(date);
  // simple hash of (gameId + dayNumber)
  let h = 2166136261 ^ n;
  for (let i = 0; i < gameId.length; i++) {
    h ^= gameId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 — tiny deterministic PRNG seeded by an integer. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
