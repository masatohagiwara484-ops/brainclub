// Online competition data layer — daily leaderboards + the global rank ladder.
//
// Reads/writes the `scores` table and the public rank fields on `profiles`
// (see supabase/leaderboard.sql). Scores are submitted through the
// submit_score() RPC, which stamps the trusted auth.uid() and keeps only the
// best score per UTC day. All functions degrade to empty/no-op when there is no
// Supabase client (offline / not configured), so callers never need to branch.

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type ScoreDetail = Record<string, number | string>;

export type BoardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  score: number;
  detail: ScoreDetail;
};

export type LadderEntry = {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  synapse: number;
  level: number;
};

/** Current UTC day as YYYY-MM-DD (matches the DB `day` column default). */
export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Submit a daily score (server keeps the best). No-op when cloud is off. */
export async function submitScore(
  game: string,
  difficulty: string,
  score: number,
  detail: ScoreDetail = {},
): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('submit_score', {
    p_game: game,
    p_difficulty: difficulty,
    p_score: Math.round(score),
    p_detail: detail,
  });
}

type DailyRow = {
  user_id: string;
  score: number;
  detail: ScoreDetail | null;
  profiles: { username: string | null; avatar: string | null } | null;
};

/** Top N of today's board for a game/difficulty, joined to player profiles. */
export async function fetchDaily(
  game: string,
  difficulty = '',
  opts: { day?: string; limit?: number } = {},
): Promise<BoardEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('scores')
    .select('user_id, score, detail, profiles(username, avatar)')
    .eq('game', game)
    .eq('difficulty', difficulty)
    .eq('day', opts.day ?? utcDay())
    .order('score', { ascending: false })
    .limit(opts.limit ?? 50);
  if (error || !data) return [];
  return (data as unknown as DailyRow[]).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    username: r.profiles?.username || 'Player',
    avatar: r.profiles?.avatar || '🧠',
    score: r.score,
    detail: r.detail ?? {},
  }));
}

type LadderRow = { id: string; username: string | null; avatar: string | null; synapse: number | null; level: number | null };

/** Global all-time skill ladder, ranked by the Synapse composite score. */
export async function fetchLadder(limit = 100): Promise<LadderEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar, synapse, level')
    .order('synapse', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as LadderRow[]).map((r, i) => ({
    rank: i + 1,
    userId: r.id,
    username: r.username || 'Player',
    avatar: r.avatar || '🧠',
    synapse: r.synapse ?? 0,
    level: r.level ?? 1,
  }));
}

export type EloEntry = {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  elo: number;
  wins: number;
  losses: number;
};

type EloRow = {
  id: string;
  username: string | null;
  avatar: string | null;
  elo: number | null;
  wins: number | null;
  losses: number | null;
};

/** Global ranked ladder for online 1v1 play, ordered by Elo rating. */
export async function fetchEloLadder(limit = 100): Promise<EloEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar, elo, wins, losses')
    .order('elo', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown as EloRow[]).map((r, i) => ({
    rank: i + 1,
    userId: r.id,
    username: r.username || 'Player',
    avatar: r.avatar || '🧠',
    elo: r.elo ?? 1000,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
  }));
}

// ---- React hooks ------------------------------------------------------------

export function useDailyBoard(game: string, difficulty = '', limit = 50) {
  const [rows, setRows] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchDaily(game, difficulty, { limit }).then((r) => {
      if (alive) {
        setRows(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [game, difficulty, limit]);
  return { rows, loading };
}

export function useLadder(limit = 100) {
  const [rows, setRows] = useState<LadderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchLadder(limit).then((r) => {
      if (alive) {
        setRows(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [limit]);
  return { rows, loading };
}

export function useEloLadder(limit = 100) {
  const [rows, setRows] = useState<EloEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchEloLadder(limit).then((r) => {
      if (alive) {
        setRows(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [limit]);
  return { rows, loading };
}
