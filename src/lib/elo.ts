// Pure Elo rating math for online 1v1 ranked play (Gomoku / Hex).
//
// No Supabase / React imports so the identical logic can be re-verified offline
// (scripts/verify-elo.mjs) and, later, inside a Supabase Edge Function for
// authoritative server-side rating. The DB function record_match_result() in
// supabase/online.sql implements the SAME formula — keep the two in sync.

export const ELO_START = 1000;
export const ELO_K = 32;

// ---- rating integrity ---------------------------------------------------------
// New accounts are in PLACEMENT for their first games: the rank badge shows
// "Placement n/5" instead of a tier, and K is large so the rating converges
// fast — then tightens as the sample grows. Mirrors record_match_result() in
// supabase/online.sql; keep the two schedules in sync.
export const PLACEMENT_GAMES = 5;

/** K-factor by games played: 64 while placing, 32 until established, then 24. */
export function kFor(gamesPlayed: number): number {
  if (gamesPlayed < PLACEMENT_GAMES) return 64;
  if (gamesPlayed < 30) return 32;
  return 24;
}

export function isPlacement(gamesPlayed: number): boolean {
  return gamesPlayed < PLACEMENT_GAMES;
}

/** Probability that A beats B given their ratings (logistic, 400-point scale). */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** New rating after one game. score = 1 win / 0.5 draw / 0 loss. */
export function updateElo(rating: number, opponent: number, score: number, k = ELO_K): number {
  return Math.round(rating + k * (score - expectedScore(rating, opponent)));
}

/**
 * Both players' new ratings after a decisive game (Gomoku/Hex never draw).
 * Rounding is applied independently to each side, mirroring the DB function.
 */
export function applyResult(
  winner: number,
  loser: number,
  k = ELO_K,
): { winner: number; loser: number } {
  return {
    winner: updateElo(winner, loser, 1, k),
    loser: updateElo(loser, winner, 0, k),
  };
}

// ---- display ranks ----------------------------------------------------------
// New players start at ELO_START (1000) = the Silver floor; a losing streak can
// drop into Bronze, while climbing unlocks Gold → Grandmaster.

export type EloRank = { id: string; name: string; min: number };

export const ELO_RANKS: EloRank[] = [
  { id: 'bronze', name: 'Bronze', min: 0 },
  { id: 'silver', name: 'Silver', min: 1000 },
  { id: 'gold', name: 'Gold', min: 1150 },
  { id: 'platinum', name: 'Platinum', min: 1300 },
  { id: 'diamond', name: 'Diamond', min: 1450 },
  { id: 'master', name: 'Master', min: 1650 },
  { id: 'grandmaster', name: 'Grandmaster', min: 1850 },
];

/** The display rank for an Elo rating (highest rung whose floor it meets). */
export function eloRank(elo: number): EloRank {
  let rank = ELO_RANKS[0];
  for (const r of ELO_RANKS) if (elo >= r.min) rank = r;
  return rank;
}
