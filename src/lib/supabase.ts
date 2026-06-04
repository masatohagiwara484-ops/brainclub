// Supabase client — the app's only backend touchpoint (optional cloud account).
//
// Configured via two env vars (see .env.example):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// When they are absent the client is null and the whole app runs exactly as
// before — fully local, no login. So cloud is a pure enhancement, never a
// requirement (matches the "no install, no login" promise).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

/** True when the build has Supabase credentials, so account UI can show. */
export const isCloudConfigured = !!supabase;
