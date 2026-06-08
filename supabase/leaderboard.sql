-- BrainClub competition schema — online daily leaderboards + global rank ladder.
-- Run ONCE in the Supabase SQL editor, AFTER schema.sql.
--
-- Design:
--   • profiles gains public, read-only rank fields (synapse score, xp, level) so
--     every signed-in player can see the global ladder and each other's names.
--   • scores holds one BEST entry per (user, game, difficulty, UTC day) — the
--     daily leaderboard. Clients never INSERT directly; they call submit_score(),
--     a SECURITY DEFINER function that stamps the trusted auth.uid(), keeps only
--     the best score of the day, and sanity-bounds the value. Server-side replay
--     re-verification (using the pure verify-*.mjs logic) can be layered on later.

-- 1) Public rank fields on profiles ------------------------------------------
alter table public.profiles
  add column if not exists synapse integer not null default 0, -- composite skill (higher = better)
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1;

-- Any signed-in user can READ profiles (names / avatars / rank for the ladder).
-- Writes remain owner-only via the existing insert/update policies.
drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles
  for select using (auth.uid() is not null);

-- 2) Daily scores ------------------------------------------------------------
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  -- FK to profiles (not auth.users) so PostgREST can embed the player's name /
  -- avatar in board queries. profiles.id itself cascades from auth.users.
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null,
  difficulty text not null default '',
  day date not null default (now() at time zone 'utc')::date,
  score integer not null,                      -- normalized so HIGHER is always better
  detail jsonb not null default '{}'::jsonb,   -- raw metric for display (ms, seconds, moves…)
  created_at timestamptz not null default now(),
  unique (user_id, game, difficulty, day)
);

create index if not exists scores_board_idx
  on public.scores (game, difficulty, day, score desc);

alter table public.scores enable row level security;

-- Read: any signed-in user can read the boards. No client INSERT/UPDATE — all
-- writes flow through submit_score() below.
drop policy if exists "scores read all" on public.scores;
create policy "scores read all" on public.scores
  for select using (auth.uid() is not null);

-- 3) submit_score(): keep-best upsert for today's row -------------------------
create or replace function public.submit_score(
  p_game text,
  p_difficulty text,
  p_score integer,
  p_detail jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_score is null or p_score < 0 or p_score > 100000000 then
    raise exception 'score out of range';
  end if;

  insert into public.scores (user_id, game, difficulty, score, detail)
  values (uid, p_game, coalesce(p_difficulty, ''), p_score, coalesce(p_detail, '{}'::jsonb))
  on conflict (user_id, game, difficulty, day)
  do update set score = excluded.score,
               detail = excluded.detail,
               created_at = now()
  where excluded.score > public.scores.score; -- only overwrite when strictly better
end;
$$;

revoke all on function public.submit_score(text, text, integer, jsonb) from public;
grant execute on function public.submit_score(text, text, integer, jsonb) to authenticated;
