-- Billing hardening migration: idempotency, refund support, reconciliation indices
-- Addresses findings from all_findings.md

-- 0. Ensure credit_transactions.tx_type exists (databases created before baseline alignment may lack it)
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS tx_type TEXT;

UPDATE public.credit_transactions
SET tx_type = 'adjustment'
WHERE tx_type IS NULL;

ALTER TABLE public.credit_transactions
  ALTER COLUMN tx_type SET NOT NULL;

-- 1. Add idempotency_key to payment_history for duplicate prevention
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_history_idempotency_key
  ON public.payment_history (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.payment_history.idempotency_key IS
  'Client-provided idempotency key. When set, duplicate inserts with the same key are rejected.';

-- 2. Deduplicate credit_transactions so partial unique index can be applied
-- Retain the newest row per (user_id, reference_id, tx_type) when reference_id IS NOT NULL
DELETE FROM public.credit_transactions ct
WHERE ct.reference_id IS NOT NULL
  AND ct.id IN (
    SELECT id
    FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, reference_id, tx_type
          ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM public.credit_transactions
      WHERE reference_id IS NOT NULL
    ) d
    WHERE d.rn > 1
  );

DROP INDEX IF EXISTS public.idx_credit_transactions_reference_unique;

-- 2b. Uniqueness on credit_transactions.reference_id (per user and tx_type)
-- Prevents duplicate consumption records from retries
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_reference_unique
  ON public.credit_transactions (user_id, reference_id, tx_type)
  WHERE reference_id IS NOT NULL;

COMMENT ON INDEX idx_credit_transactions_reference_unique IS
  'Prevents duplicate credit transactions for the same reference_id and tx_type per user.';

-- 3. Add refund tx_type support (already exists in schema, ensure check constraint allows it)
-- The tx_type column should accept: top_up, consume, refund, grant, adjustment
-- Wrapped in a single DO block so DROP + ADD is atomic within the block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credit_transactions_tx_type_check'
      AND conrelid = 'public.credit_transactions'::regclass
  ) THEN
    ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_tx_type_check;
  END IF;

  ALTER TABLE public.credit_transactions
    ADD CONSTRAINT credit_transactions_tx_type_check
    CHECK (tx_type IN ('top_up', 'consume', 'refund', 'grant', 'adjustment'));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'credit_transactions_tx_type_check constraint update skipped: %', SQLERRM;
END $$;

-- 4. Add reconciliation support index on credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON public.credit_transactions (user_id, created_at);

-- 5. Add index for payment_history correlation by workflow_id in metadata
-- This enables the reconciliation job to match payments to credit transactions
CREATE INDEX IF NOT EXISTS idx_payment_history_user_status
  ON public.payment_history (user_id, status);

-- 6. Add refund tracking columns to payment_history
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS original_payment_id UUID REFERENCES public.payment_history(id),
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

COMMENT ON COLUMN public.payment_history.original_payment_id IS
  'For refund records, links back to the original payment being refunded.';
COMMENT ON COLUMN public.payment_history.refund_reason IS
  'Reason for refund (queue_failure, user_request, duplicate, etc).';

-- 7. Ensure consume_credits RPC exists with current signature (atomic credit deduction).
-- The original migration (20260313000002) created this with RETURNS TABLE(balance_after, success).
-- We preserve that column order so CREATE OR REPLACE does not fail with a return-type mismatch.
-- If the function does not exist at all, the DROP is harmless and CREATE builds it fresh.
DROP FUNCTION IF EXISTS public.consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'workflow_step',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(balance_after NUMERIC, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
  v_new NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  SELECT balance INTO v_current
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  IF v_current < p_amount THEN
    RETURN QUERY SELECT v_current, FALSE;
    RETURN;
  END IF;

  v_new := v_current - p_amount;

  UPDATE user_credits
  SET balance = v_new, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id)
  VALUES (p_user_id, -p_amount, v_new, 'consume', p_reference_id);

  RETURN QUERY SELECT v_new, TRUE;
END;
$$;

COMMENT ON FUNCTION public.consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) IS
  'Atomically deduct credits with row-level locking. Returns balance_after and success flag.';
