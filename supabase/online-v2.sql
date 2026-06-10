-- BrainClub online play v2 — N-player matches (Ludo 4P, Blackjack, Poker…).
-- Run ONCE in the Supabase SQL editor, AFTER online.sql. Fully additive: the
-- 1v1 flow (find_match / record_move / record_match_result) keeps working.
--
-- Design:
--   • matches gains `players uuid[]` (seat order = array order) + `match_size`.
--     p1/p2 stay filled for 1v1 compatibility; for N-player rows p1 = seat 1.
--   • RLS: a participant is anyone in `players` (covers 1v1 rows via backfill).
--     Realtime delivery is RLS-gated, so subscribing to INSERTs with NO column
--     filter is safe: each player only ever receives their own matches —
--     that is how queued players discover an N-player pairing.
--   • find_match_n(): atomically grabs size-1 waiters (FOR UPDATE SKIP LOCKED)
--     or enqueues the caller. Seat order is randomized for fairness.
--   • record_move() is upgraded in place: for N-player rows the turn is
--     players[1 + (len(moves) % match_size)] (eliminated players submit a
--     game-defined no-op move to keep the rotation pure).
--   • record_match_result() upgraded: the winner scores a pairwise Elo win
--     against EACH loser with K/(size-1), losers lose vs the winner only —
--     zero-sum-ish, simple, and identical to 1v1 when size = 2.

-- 1) Columns ------------------------------------------------------------------
alter table public.matches
  add column if not exists players uuid[] not null default '{}',
  add column if not exists match_size smallint not null default 2;

update public.matches
  set players = array_remove(array[p1, p2], null)
  where cardinality(players) = 0;

alter table public.matchmaking_queue
  add column if not exists match_size smallint not null default 2;

-- 2) RLS: participants = members of players ------------------------------------
drop policy if exists "matches read own" on public.matches;
create policy "matches read own" on public.matches
  for select using (auth.uid() = any(players) or auth.uid() = p1 or auth.uid() = p2);

-- 3) find_match_n(): atomic N-player pairing, else enqueue ---------------------
create or replace function public.find_match_n(p_game text, p_size int default 2)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  waiters uuid[];
  seats uuid[];
  m public.matches;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_size < 2 or p_size > 4 then raise exception 'match size must be 2-4'; end if;

  select coalesce(array_agg(user_id), '{}') into waiters
  from (
    select user_id from public.matchmaking_queue
    where game = p_game and match_size = p_size and user_id <> uid
    order by created_at
    for update skip locked
    limit p_size - 1
  ) w;

  if cardinality(waiters) < p_size - 1 then
    insert into public.matchmaking_queue (user_id, game, elo, match_size)
    values (uid, p_game,
            coalesce((select elo from public.profiles where id = uid), 1000), p_size)
    on conflict (user_id) do update
      set game = excluded.game, elo = excluded.elo,
          match_size = excluded.match_size, created_at = now();
    return null; -- queued; discovery via RLS-gated INSERT events
  end if;

  delete from public.matchmaking_queue where user_id = any(waiters) or user_id = uid;

  -- randomize seat order for fairness
  select array_agg(u order by random()) into seats
  from unnest(waiters || uid) as u;

  insert into public.matches (game, status, p1, p2, players, match_size, first_player)
  values (p_game, 'active', seats[1], seats[2], seats, p_size, 1)
  returning * into m;
  return m;
end; $$;

-- 4) record_move(): N-player turn validation (replaces the 1v1 body) ----------
create or replace function public.record_move(p_match uuid, p_move jsonb)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.matches;
  idx int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'match not found'; end if;
  if not (uid = any(m.players)) then raise exception 'not a participant'; end if;
  if m.status <> 'active' then raise exception 'match not active'; end if;

  if m.match_size = 2 then
    -- 1v1 keeps the first_player convention (seat 1 or 2 opens).
    idx := case when (jsonb_array_length(m.moves) % 2) = 0 then m.first_player
                else 3 - m.first_player end;
  else
    idx := 1 + (jsonb_array_length(m.moves) % m.match_size);
  end if;
  if m.players[idx] <> uid then raise exception 'not your turn'; end if;

  update public.matches
    set moves = m.moves || jsonb_build_array(p_move), updated_at = now()
  where id = p_match
  returning * into m;
  return m;
end; $$;

-- 5) record_match_result(): pairwise Elo for N players -------------------------
create or replace function public.record_match_result(p_match uuid, p_winner uuid)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.matches;
  loser uuid;
  rw integer; rl integer;
  ew double precision;
  kw integer; kl integer;
  gw integer; gl integer;
  share double precision;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'match not found'; end if;
  if not (uid = any(m.players)) then raise exception 'not a participant'; end if;
  if m.status <> 'active' then return m; end if; -- already settled
  if not (p_winner = any(m.players)) then raise exception 'invalid winner'; end if;

  update public.matches set status = 'finished', winner = p_winner, updated_at = now()
  where id = p_match returning * into m;

  share := 1.0 / greatest(1, m.match_size - 1); -- winner's K split across losers
  foreach loser in array m.players loop
    if loser = p_winner then continue; end if;
    select elo, wins + losses into rw, gw from public.profiles where id = p_winner;
    select elo, wins + losses into rl, gl from public.profiles where id = loser;
    rw := coalesce(rw, 1000); rl := coalesce(rl, 1000);
    kw := case when coalesce(gw, 0) < 5 then 64 when gw < 30 then 32 else 24 end;
    kl := case when coalesce(gl, 0) < 5 then 64 when gl < 30 then 32 else 24 end;
    ew := 1.0 / (1.0 + power(10.0, (rl - rw) / 400.0));
    update public.profiles
      set elo = round(rw + kw * share * (1 - ew)) where id = p_winner;
    update public.profiles
      set elo = round(rl - kl * share * (1 - ew)), losses = losses + 1 where id = loser;
  end loop;
  update public.profiles set wins = wins + 1 where id = p_winner;
  return m;
end; $$;

-- 6) Grants --------------------------------------------------------------------
revoke all on function public.find_match_n(text, int) from public;
grant execute on function public.find_match_n(text, int) to authenticated;
