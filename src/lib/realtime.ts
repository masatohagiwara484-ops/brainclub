// Realtime online-match transport, layered on Supabase Realtime postgres_changes
// over the `matches` table (see supabase/online.sql). The matches row is the
// single source of truth: every move is appended via record_move() and both
// players receive the UPDATE event; a reconnecting player rebuilds the board
// straight from `moves`. Everything degrades to no-ops / throws a clear error
// when Supabase is not configured, so callers gate on isCloudConfigured first.

import { supabase } from './supabase';

export type MatchStatus = 'pending' | 'active' | 'finished' | 'abandoned';
export type Seat = 1 | 2;

export type Match = {
  id: string;
  game: string;
  status: MatchStatus;
  p1: string;
  p2: string | null;
  first_player: Seat;
  moves: unknown[];
  winner: string | null;
  room_code: string | null;
};

/** Which seat (1 = p1, 2 = p2) a user holds in a match. */
export function seatOf(m: Match, uid: string): Seat {
  return uid === m.p1 ? 1 : 2;
}

/** Whose seat is to move, given how many moves have been played so far. */
export function turnSeat(moveCount: number, first: Seat): Seat {
  return (moveCount % 2 === 0 ? first : 3 - first) as Seat;
}

// ---- RPC actions ------------------------------------------------------------

/**
 * Join the matchmaking queue. Returns the match immediately if an opponent was
 * already waiting, else null — you are now queued and should call waitForMatch
 * to discover the pairing when it happens.
 */
export async function findMatch(game: string): Promise<Match | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('find_match', { p_game: game });
  if (error) throw error;
  return (data as Match) ?? null;
}

/** Cancel a pending matchmaking search. */
export async function leaveQueue(): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('leave_queue');
}

/** Open a private friend room; returns the pending match incl. its room_code. */
export async function createPrivateMatch(game: string): Promise<Match> {
  if (!supabase) throw new Error('cloud not configured');
  const { data, error } = await supabase.rpc('create_private_match', { p_game: game });
  if (error) throw error;
  return data as Match;
}

/** Join a private room by its share code; activates the match. */
export async function joinPrivateMatch(code: string): Promise<Match> {
  if (!supabase) throw new Error('cloud not configured');
  const { data, error } = await supabase.rpc('join_private_match', { p_code: code.toUpperCase() });
  if (error) throw error;
  return data as Match;
}

/** Append a move (server validates turn order and stamps auth.uid()). */
export async function recordMove(matchId: string, move: unknown): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('record_move', { p_match: matchId, p_move: move });
  if (error) throw error;
}

/** Settle a match (normal win, resignation, or forfeit) and apply Elo. */
export async function recordResult(matchId: string, winnerId: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('record_match_result', { p_match: matchId, p_winner: winnerId });
}

// ---- Realtime subscriptions -------------------------------------------------

type Unsub = () => void;

/**
 * Wait for matchmaking to pair you: fires once when a match row is INSERTed with
 * you as p1 (the waiter seat). Returns an unsubscribe fn.
 */
export function waitForMatch(uid: string, onMatched: (m: Match) => void): Unsub {
  if (!supabase) return () => {};
  const client = supabase;
  const ch = client
    .channel(`lobby:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'matches', filter: `p1=eq.${uid}` },
      (payload) => onMatched(payload.new as Match),
    )
    .subscribe();
  return () => void client.removeChannel(ch);
}

/** Subscribe to every change on a single match (moves + result). */
export function subscribeMatch(matchId: string, onChange: (m: Match) => void): Unsub {
  if (!supabase) return () => {};
  const client = supabase;
  const ch = client
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      (payload) => onChange(payload.new as Match),
    )
    .subscribe();
  return () => void client.removeChannel(ch);
}

/** Re-fetch a match row by id (e.g. to rebuild board state on reconnect). */
export async function fetchMatch(matchId: string): Promise<Match | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
  return (data as Match) ?? null;
}

/** Look up a player's display name (for the opponent label). */
export async function fetchPlayerName(uid: string): Promise<string> {
  if (!supabase) return 'Player';
  const { data } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle();
  return (data?.username as string) || 'Player';
}
