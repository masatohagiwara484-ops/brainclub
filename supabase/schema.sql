-- BrainClub cloud account schema (F5).
-- Run this in the Supabase SQL editor for your project once.
-- Auth: Email magic-link (enabled by default in Supabase → Authentication).
--
-- Two owner-private tables, both keyed by the auth user id:
--   profiles — display name + emoji avatar
--   saves    — one Progress JSON blob per user (Synapse profile, streak, bests)
-- Row Level Security ensures a signed-in user can only read/write their own row.

-- ---- profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null default '',
  avatar text not null default '🧠',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- saves ------------------------------------------------------------------
create table if not exists public.saves (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves read own" on public.saves;
create policy "saves read own" on public.saves
  for select using (auth.uid() = id);

drop policy if exists "saves insert own" on public.saves;
create policy "saves insert own" on public.saves
  for insert with check (auth.uid() = id);

drop policy if exists "saves update own" on public.saves;
create policy "saves update own" on public.saves
  for update using (auth.uid() = id) with check (auth.uid() = id);
