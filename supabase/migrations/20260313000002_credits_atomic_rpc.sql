-- Atomic credits RPC: consume_credits and top_up_credits
-- Prevents double-spend under concurrent workflow runs. Uses SELECT ... FOR UPDATE.

DROP FUNCTION IF EXISTS consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION consume_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'workflow_step',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(balance_after NUMERIC, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  SELECT uc.balance INTO v_balance
  FROM user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, FALSE;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT v_balance, FALSE;
    RETURN;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE user_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id)
  VALUES (p_user_id, -p_amount, v_new_balance, 'consume', p_reference_id);

  RETURN QUERY SELECT v_new_balance, TRUE;
END;
$$;

-- Drop all overloads of top_up_credits to avoid "function name is not unique" on CREATE/COMMENT
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'top_up_credits'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION top_up_credits(
  p_user_id UUID,
  p_amount TEXT,
  p_currency TEXT DEFAULT 'USD',
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT 'manual',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(balance NUMERIC, currency TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  v_amount := p_amount::NUMERIC;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, p_currency;
    RETURN;
  END IF;

  INSERT INTO user_credits (user_id, balance, currency)
  VALUES (p_user_id, 0, COALESCE(p_currency, 'USD'))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT uc.balance INTO v_balance
  FROM user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE;

  v_new_balance := COALESCE(v_balance, 0) + v_amount;

  UPDATE user_credits
  SET balance = v_new_balance, currency = COALESCE(p_currency, 'USD'), updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id)
  VALUES (p_user_id, v_amount, v_new_balance, 'top_up', p_reference_id);

  RETURN QUERY SELECT v_new_balance, COALESCE(p_currency, 'USD');
END;
$$;

COMMENT ON FUNCTION consume_credits(UUID, NUMERIC, TEXT, TEXT, JSONB) IS 'Atomic credit deduction. Locks user_credits row to prevent double-spend under concurrency.';
COMMENT ON FUNCTION top_up_credits(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) IS 'Atomic credit top-up. Locks user_credits row to avoid race conditions.';
