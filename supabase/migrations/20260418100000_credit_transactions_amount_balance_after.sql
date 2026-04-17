-- Legacy drift: some projects have credit_transactions without amount / balance_after
-- (table predates baseline or partial apply). Reconciliation and consume_credits / top_up_credits require them.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS amount NUMERIC,
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC;

COMMENT ON COLUMN public.credit_transactions.amount IS
  'Signed delta: negative for consume, positive for top_up / grant.';
COMMENT ON COLUMN public.credit_transactions.balance_after IS
  'user_credits.balance after this transaction was applied.';

-- Backfill unknown history with zeros so NOT NULL + RPC inserts are safe.
UPDATE public.credit_transactions
SET
  amount = COALESCE(amount, 0),
  balance_after = COALESCE(balance_after, 0)
WHERE amount IS NULL OR balance_after IS NULL;

ALTER TABLE public.credit_transactions
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN balance_after SET NOT NULL;

ALTER TABLE public.credit_transactions
  ALTER COLUMN balance_after SET DEFAULT 0;
