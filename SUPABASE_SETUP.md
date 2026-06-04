# Cloud accounts (Supabase) — setup

The optional cloud account adds passwordless sign-in, an editable profile, and
cross-device progress sync. It's a pure enhancement: with no Supabase env the
app stays 100% local and login-free.

## 1. Create the tables
In your Supabase project → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
This creates `profiles` and `saves`, both Row-Level-Security locked to the owner.

## 2. Enable email magic links
**Authentication → Providers → Email**: ensure it's enabled (it is by default).
Sign-in is passwordless — users get a one-time link by email.

**Authentication → URL Configuration**: add your app origins to *Redirect URLs*
(e.g. `http://localhost:5173` for dev and your Vercel URL for prod). The app
requests a redirect back to `window.location.origin`.

## 3. Add the env vars
From **Project Settings → API**, copy the Project URL and the `anon` public key.

Local dev — create `.env.local` (see `.env.example`):
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```
Vercel — add the same two vars in **Project → Settings → Environment Variables**,
then redeploy.

> Only the `anon` public key goes in the client. Never ship the `service_role` key.

## How sync works
- On sign-in the local progress (Synapse profile, daily streak, per-game bests)
  is merged with the cloud save using a **best-of-each** reconcile
  (`mergeProgress` in `src/lib/storage.ts`), then written both ways — so a new
  device never wipes existing records.
- Afterwards every recorded play schedules a debounced push to the cloud.
- Profile edits (name/avatar) upsert to `profiles`.

Verify the merge logic: `node scripts/verify-cloud.mjs`.
