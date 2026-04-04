-- Backfill wallet_users.auth_method when the table existed before baseline or baseline
-- was applied after a partial schema (CREATE TABLE IF NOT EXISTS does not add new columns).
-- Fixes PostgREST PGRST204: "Could not find the 'auth_method' column of 'wallet_users' in the schema cache"
ALTER TABLE public.wallet_users
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'siwe';
