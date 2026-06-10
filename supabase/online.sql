-- BrainClub online play schema — realtime 1v1 matches, matchmaking, Elo ranks.
-- Run ONCE in the Supabase SQL editor, AFTER schema.sql and leaderboard.sql.
--
-- Design:
--   • profiles gains an Elo rating + win/loss counters (public, read-only).
--   • matches is the single source of truth for a game: an append-only `moves`
--     array plus status/winner. Both players subscribe to Realtime postgres
--     changes on their row, so every move and the result propagate automatically
--     and a reconnecting player rebuilds the board straight from `moves`.
--   • matchmaking_queue + find_match() atomically pair two waiting players
--     (FOR UPDATE SKIP LOCKED). SEAT (p1 = waiter/creator, p2 = joiner) is
--     decoupled from the FIRST MOVE (first_player, randomized) so the still-
--     waiting player can discover its new match with a single p1=eq(uid)
--     Realtime filter (it never learns the match id up front).
--   • All writes flow through SECURITY DEFINER RPCs that stamp the trusted
--     auth.uid(); clients never INSERT/UPDATE matches or the queue directly.
--   • record_match_result() recomputes Elo with the SAME formula as
--     src/lib/elo.ts (K=32). Keep the two in sync.

-- 1) Elo + record fields on profiles -----------------------------------------
alter table public.profiles
  add column if not exists elo integer not null default 1000,
  add column if not exists wins integer not null default 0,
  add column if not exists losses integer not null default 0;

-- 2) Matches ------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  status text not null default 'active',     -- pending | active | finished | abandoned
  p1 uuid not null references public.profiles (id) on delete cascade, -- seat 1 (waiter/creator)
  p2 uuid references public.profiles (id) on delete cascade,          -- seat 2 (joiner)
  first_player smallint not null default 1,  -- 1 = p1 moves first, 2 = p2 moves first
  moves jsonb not null default '[]'::jsonb,  -- append-only list of moves (game-defined shape)
  winner uuid references public.profiles (id),
  room_code text unique,                     -- present for private (friend) matches
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_player_idx on public.matches (p1, p2, status);

alter table public.matches enable row level security;

-- Read: only the two participants can see a match. No client INSERT/UPDATE —
-- everything flows through the RPCs below.
drop policy if exists "matches read own" on public.matches;
create policy "matches read own" on public.matches
  for select using (auth.uid() = p1 or auth.uid() = p2);

-- Realtime: participants receive INSERT (matchmaking) and UPDATE (moves/result)
-- events on their own rows, gated by the SELECT policy above. (No-op if already
-- a member of the publication.)
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;

-- 3) Matchmaking queue --------------------------------------------------------
create table if not exists public.matchmaking_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  game text not null,
  elo integer not null default 1000,
  created_at timestamptz not null default now()
);

alter table public.matchmaking_queue enable row level security;
drop policy if exists "queue read own" on public.matchmaking_queue;
create policy "queue read own" on public.matchmaking_queue
  for select using (auth.uid() = user_id);

-- 4) find_match(): atomic pairing, else enqueue ------------------------------
create or replace function public.find_match(p_game text)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  waiter uuid;
  m public.matches;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  -- Grab the oldest other player waiting for this game (skip rows another
  -- concurrent matcher already locked, so two arrivals can't share one waiter).
  select user_id into waiter
  from public.matchmaking_queue
  where game = p_game and user_id <> uid
  order by created_at
  for update skip locked
  limit 1;

  if waiter is null then
    -- No opponent yet: take a seat in the queue and report "still waiting"
    -- (null). The match is discovered later via Realtime (INSERT, p1 = uid).
    insert into public.matchmaking_queue (user_id, game, elo)
    values (uid, p_game, coalesce((select elo from public.profiles where id = uid), 1000))
    on conflict (user_id)
      do update set game = excluded.game, elo = excluded.elo, created_at = now();
    return null;
  end if;

  -- Pair up: waiter = p1, joiner (me) = p2; randomize who moves first.
  delete from public.matchmaking_queue where user_id in (uid, waiter);
  insert into public.matches (game, status, p1, p2, first_player)
  values (p_game, 'active', waiter, uid, 1 + floor(random() * 2)::int)
  returning * into m;
  return m;
end; $$;

-- 5) leave_queue(): cancel a pending matchmaking search ----------------------
create or replace function public.leave_queue()
returns void language sql security definer set search_path = public as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
$$;

-- 6) create_private_match(): a friend room with a short shareable code -------
create or replace function public.create_private_match(p_game text)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I,O,0,1 (legible)
  code text;
  i int;
  m public.matches;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  loop
    code := '';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.matches where room_code = code and status in ('pending', 'active')
    );
  end loop;
  insert into public.matches (game, status, p1, first_player, room_code)
  values (p_game, 'pending', uid, 1 + floor(random() * 2)::int, code)
  returning * into m;
  return m;
end; $$;

-- 7) join_private_match(): seat the second player by code --------------------
create or replace function public.join_private_match(p_code text)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.matches;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update public.matches
    set p2 = uid, status = 'active', updated_at = now()
  where room_code = upper(p_code) and status = 'pending' and p2 is null and p1 <> uid
  returning * into m;
  if m.id is null then raise exception 'room not found or already full'; end if;
  return m;
end; $$;

-- 8) record_move(): append a turn-validated move -----------------------------
create or replace function public.record_move(p_match uuid, p_move jsonb)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.matches;
  mover smallint;
  turn smallint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'match not found'; end if;
  if uid <> m.p1 and uid <> m.p2 then raise exception 'not a participant'; end if;
  if m.status <> 'active' then raise exception 'match not active'; end if;

  mover := case when uid = m.p1 then 1 else 2 end;
  -- first_player moves on even move counts, the other on odd.
  turn := case when (jsonb_array_length(m.moves) % 2) = 0 then m.first_player
               else 3 - m.first_player end;
  if mover <> turn then raise exception 'not your turn'; end if;

  update public.matches
    set moves = m.moves || jsonb_build_array(p_move), updated_at = now()
  where id = p_match
  returning * into m;
  return m;
end; $$;

-- 9) record_match_result(): settle a game (win or resign) + apply Elo --------
-- Idempotent: the row lock serializes both players, and the status guard means
-- the second caller just returns the already-settled row.
create or replace function public.record_match_result(p_match uuid, p_winner uuid)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.matches;
  loser uuid;
  rw integer; rl integer;
  ew double precision; -- winner's expected score
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into m from public.matches where id = p_match for update;
  if m.id is null then raise exception 'match not found'; end if;
  if uid <> m.p1 and uid <> m.p2 then raise exception 'not a participant'; end if;
  if m.status <> 'active' then return m; end if; -- already settled
  if p_winner <> m.p1 and p_winner <> m.p2 then raise exception 'invalid winner'; end if;

  loser := case when p_winner = m.p1 then m.p2 else m.p1 end;

  update public.matches set status = 'finished', winner = p_winner, updated_at = now()
  where id = p_match returning * into m;

  -- Elo, K=32 (mirrors src/lib/elo.ts). Zero-sum before independent rounding.
  select elo into rw from public.profiles where id = p_winner;
  select elo into rl from public.profiles where id = loser;
  rw := coalesce(rw, 1000);
  rl := coalesce(rl, 1000);
  ew := 1.0 / (1.0 + power(10.0, (rl - rw) / 400.0));
  -- K by games played (placement 64 / developing 32 / stable 24) — mirrors
  -- src/lib/elo.ts kFor(); a fresh account converges fast, then stabilizes.
  declare
    gw integer; gl integer; kw integer; kl integer;
  begin
    select wins + losses into gw from public.profiles where id = p_winner;
    select wins + losses into gl from public.profiles where id = loser;
    kw := case when coalesce(gw,0) < 5 then 64 when gw < 30 then 32 else 24 end;
    kl := case when coalesce(gl,0) < 5 then 64 when gl < 30 then 32 else 24 end;
    update public.profiles set elo = round(rw + kw * (1 - ew)), wins = wins + 1 where id = p_winner;
    update public.profiles set elo = round(rl - kl * (1 - ew)), losses = losses + 1 where id = loser;
  end;
  return m;
end; $$;

-- 10) Grants -----------------------------------------------------------------
revoke all on function public.find_match(text) from public;
revoke all on function public.leave_queue() from public;
revoke all on function public.create_private_match(text) from public;
revoke all on function public.join_private_match(text) from public;
revoke all on function public.record_move(uuid, jsonb) from public;
revoke all on function public.record_match_result(uuid, uuid) from public;

grant execute on function public.find_match(text) to authenticated;
grant execute on function public.leave_queue() to authenticated;
grant execute on function public.create_private_match(text) to authenticated;
grant execute on function public.join_private_match(text) to authenticated;
grant execute on function public.record_move(uuid, jsonb) to authenticated;
grant execute on function public.record_match_result(uuid, uuid) to authenticated;
