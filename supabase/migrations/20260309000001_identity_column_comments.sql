-- Identity normalization: document that user_id in credits/payments tables
-- maps to wallet_users.id (the SIWE principal), not auth.users.id.
-- The column name user_id is kept for backward compatibility; application
-- code (credits_supabase.py, payments_supabase.py) already treats it as
-- wallet_users.id. This migration adds comments and an index for clarity.

COMMENT ON COLUMN user_credits.user_id IS 'wallet_users.id — the SIWE principal. Named user_id for backward compat.';
COMMENT ON COLUMN credit_transactions.user_id IS 'wallet_users.id — the SIWE principal.';
COMMENT ON COLUMN payment_history.user_id IS 'wallet_users.id — the SIWE principal.';
COMMENT ON COLUMN spending_controls.user_id IS 'wallet_users.id — the SIWE principal.';
COMMENT ON COLUMN projects.user_id IS 'Legacy auth.users.id or SUPABASE_SYSTEM_USER_ID. Prefer wallet_user_id for ownership.';
COMMENT ON COLUMN projects.wallet_user_id IS 'wallet_users.id — the canonical owner in SIWE auth.';
COMMENT ON COLUMN agent_context.wallet_user_id IS 'wallet_users.id (SIWE).';
COMMENT ON COLUMN agent_context.user_id IS 'Legacy: same as wallet_user_id for backward compat.';
