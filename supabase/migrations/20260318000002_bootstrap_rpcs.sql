-- Creates RPCs referenced by api-gateway authBootstrap but previously missing from migrations.
-- bootstrap_user_credits: idempotent initial credit grant for new users.
-- upsert_spending_control: set or update a user's spending controls.
-- DROP first: CREATE OR REPLACE cannot change return type of existing function.

DROP FUNCTION IF EXISTS public.bootstrap_user_credits(uuid, numeric);
DROP FUNCTION IF EXISTS public.upsert_spending_control(uuid, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.upsert_spending_control(uuid, numeric, text, text, numeric);

CREATE OR REPLACE FUNCTION public.bootstrap_user_credits(
  p_user_id uuid,
  p_initial_credits numeric DEFAULT 50
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance, currency)
  VALUES (p_user_id, p_initial_credits, 'USD')
  ON CONFLICT (user_id) DO NOTHING;

  -- Record the initial top-up transaction only if a new row was inserted.
  IF FOUND THEN
    INSERT INTO credit_transactions (user_id, amount, balance_after, tx_type, reference_id, description)
    VALUES (
      p_user_id,
      p_initial_credits,
      p_initial_credits,
      'topup',
      'bootstrap',
      'Initial credit grant on first sign-in'
    );
  END IF;
END;
$$;

-- Matches api-gateway authBootstrap ensureWalletUserProvisioned RPC args.
CREATE OR REPLACE FUNCTION public.upsert_spending_control(
  p_user_id uuid,
  p_budget_amount numeric DEFAULT 0,
  p_budget_currency text DEFAULT 'USD',
  p_period text DEFAULT 'monthly',
  p_alert_threshold_percent numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily numeric;
  v_monthly numeric;
BEGIN
  v_daily := CASE WHEN lower(coalesce(p_period, 'monthly')) = 'daily' THEN p_budget_amount ELSE NULL END;
  v_monthly := CASE WHEN lower(coalesce(p_period, 'monthly')) = 'monthly' THEN p_budget_amount ELSE NULL END;

  INSERT INTO spending_controls (user_id, daily_limit, monthly_limit, per_tx_limit, auto_approve_below)
  VALUES (p_user_id, v_daily, v_monthly, NULL, p_alert_threshold_percent)
  ON CONFLICT (user_id) DO UPDATE SET
    daily_limit = COALESCE(EXCLUDED.daily_limit, spending_controls.daily_limit),
    monthly_limit = COALESCE(EXCLUDED.monthly_limit, spending_controls.monthly_limit),
    per_tx_limit = COALESCE(EXCLUDED.per_tx_limit, spending_controls.per_tx_limit),
    auto_approve_below = COALESCE(EXCLUDED.auto_approve_below, spending_controls.auto_approve_below),
    updated_at = now();
END;
$$;
