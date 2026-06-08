// Optional cloud account: passwordless email sign-in (Supabase magic link),
// an editable profile (username + emoji avatar), and last-write-wins sync of
// the player's progress (Synapse profile, streak, per-game bests) across
// devices. Everything degrades gracefully: with no Supabase env the store sits
// in 'disabled' and the app stays 100% local.
//
// Tables (see supabase/schema.sql):
//   profiles(id uuid pk, username text, avatar text, updated_at)
//   saves(id uuid pk, data jsonb, updated_at)   -- one Progress blob per user
// Both are RLS-locked to the owner (auth.uid() = id).

import { useEffect, useReducer } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isCloudConfigured } from './supabase';
import {
  exportProgress,
  importProgress,
  mergeProgress,
  type Progress,
} from './storage';
import { notifyProfileChanged, subscribeSynapse, getProfile, synapseScore } from './synapse';

export const AVATARS = ['🧠', '🦊', '🐙', '🦉', '🐱', '🐼', '🐸', '🦄', '🤖', '👾', '🐢', '🦁'];
const DEFAULT_AVATAR = '🧠';

export type Account = { userId: string; email: string | null; username: string; avatar: string };

export type CloudState = {
  status: 'disabled' | 'signed-out' | 'signed-in';
  account: Account | null;
  busy: boolean; // a sign-in / sync / save is in flight
  linkSentTo: string | null; // email we just mailed a magic link to
  error: string | null;
};

let state: CloudState = {
  status: isCloudConfigured ? 'signed-out' : 'disabled',
  account: null,
  busy: false,
  linkSentTo: null,
  error: null,
};

type Listener = () => void;
let listeners: Listener[] = [];
function patch(p: Partial<CloudState>): void {
  state = { ...state, ...p };
  for (const l of listeners) l();
}

function defaultName(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0];
  return local || 'Player';
}

// ---- auth lifecycle -----------------------------------------------------------

let initialized = false;
/** Restore any existing session and subscribe to auth changes. Idempotent. */
export async function initCloud(): Promise<void> {
  if (!supabase || initialized) return;
  initialized = true;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await onSignedIn(data.session.user);
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      if (state.account?.userId !== session.user.id) void onSignedIn(session.user);
    } else {
      patch({ status: 'signed-out', account: null });
    }
  });
}

async function onSignedIn(user: User): Promise<void> {
  const account = await loadOrCreateProfile(user);
  patch({ status: 'signed-in', account, linkSentTo: null, error: null });
  await syncNow();
  await pushRank();
}

// Publish the player's public rank fields (composite Synapse score, xp, level)
// to their profile row so they appear on the global ladder. Owner-only write.
async function pushRank(): Promise<void> {
  if (!supabase || !state.account) return;
  const p = getProfile();
  await supabase.from('profiles').upsert({
    id: state.account.userId,
    synapse: Math.round(synapseScore(p)),
    xp: Math.round(p.xp),
    level: p.level,
    updated_at: new Date().toISOString(),
  });
}

async function loadOrCreateProfile(user: User): Promise<Account> {
  let username = defaultName(user.email);
  let avatar = DEFAULT_AVATAR;
  if (supabase) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      username = data.username || username;
      avatar = data.avatar || avatar;
    } else {
      await supabase.from('profiles').insert({ id: user.id, username, avatar });
    }
  }
  return { userId: user.id, email: user.email ?? null, username, avatar };
}

// ---- public actions -----------------------------------------------------------

/** Email the user a one-time magic link (passwordless sign-in). */
export async function signIn(email: string): Promise<void> {
  if (!supabase) return;
  patch({ busy: true, error: null, linkSentTo: null });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  patch({ busy: false, linkSentTo: error ? null : email, error: error?.message ?? null });
}

/** One-tap OAuth sign-in (Google / Apple). Redirects to the provider. */
export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  if (!supabase) return;
  patch({ busy: true, error: null });
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  // On success the browser navigates away to the provider, so we only land here
  // on failure.
  if (error) patch({ busy: false, error: error.message });
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  patch({ status: 'signed-out', account: null, linkSentTo: null });
}

/** Save profile edits (username / avatar) to the cloud and local state. */
export async function updateProfile(fields: { username: string; avatar: string }): Promise<void> {
  if (!supabase || !state.account) return;
  const account = { ...state.account, ...fields };
  patch({ account, busy: true });
  await supabase.from('profiles').upsert({
    id: account.userId,
    username: fields.username,
    avatar: fields.avatar,
    updated_at: new Date().toISOString(),
  });
  patch({ busy: false });
}

/** Pull the cloud save, merge with local, write back both directions. */
export async function syncNow(): Promise<void> {
  if (!supabase || !state.account) return;
  patch({ busy: true });
  try {
    const merged = await mergeWithCloud();
    importProgress(merged);
    notifyProfileChanged();
    await supabase.from('saves').upsert({
      id: state.account.userId,
      data: merged,
      updated_at: new Date().toISOString(),
    });
  } finally {
    patch({ busy: false });
  }
}

async function mergeWithCloud(): Promise<Progress> {
  const local = exportProgress();
  if (!supabase || !state.account) return local;
  const { data } = await supabase
    .from('saves')
    .select('data')
    .eq('id', state.account.userId)
    .maybeSingle();
  const cloud = (data?.data as Progress | undefined) ?? null;
  return cloud ? mergeProgress(local, cloud) : local;
}

// ---- auto-push on progress changes (debounced) --------------------------------

let pushTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePush(): void {
  if (!supabase || state.status !== 'signed-in') return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushProgress(), 1500);
}

async function pushProgress(): Promise<void> {
  if (!supabase || !state.account) return;
  const merged = await mergeWithCloud();
  importProgress(merged);
  notifyProfileChanged();
  await supabase.from('saves').upsert({
    id: state.account.userId,
    data: merged,
    updated_at: new Date().toISOString(),
  });
  await pushRank();
}

// Every recorded play (and level-up) flows through the Synapse store; ride that
// signal to keep the cloud save fresh without scattering push calls everywhere.
if (isCloudConfigured) subscribeSynapse(schedulePush);

// ---- react binding ------------------------------------------------------------

export function getCloud(): CloudState {
  return state;
}
export function useCloud(): CloudState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.push(force);
    return () => {
      listeners = listeners.filter((l) => l !== force);
    };
  }, []);
  return state;
}
