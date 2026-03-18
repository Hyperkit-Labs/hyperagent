-- RLS enforcement: enable RLS and add explicit service_role policies for all application tables.
-- Prior migrations documented intent via COMMENTs; this migration applies the actual DDL.
-- Pattern: RLS enabled, NO public policies, backend accesses via service_role (bypasses RLS by design).

-- user_credits
ALTER TABLE IF EXISTS user_credits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON user_credits TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- credit_transactions
ALTER TABLE IF EXISTS credit_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON credit_transactions TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- spending_controls
ALTER TABLE IF EXISTS spending_controls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'spending_controls' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON spending_controls TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- storage_records
ALTER TABLE IF EXISTS storage_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'storage_records' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON storage_records TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- agent_logs
ALTER TABLE IF EXISTS agent_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_logs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON agent_logs TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- simulations
ALTER TABLE IF EXISTS simulations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'simulations' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON simulations TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- agent_context
ALTER TABLE IF EXISTS agent_context ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_context' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON agent_context TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- run_state (added in 20260316000002); only if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'run_state') THEN
    ALTER TABLE run_state ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'run_state' AND policyname = 'service_role_all') THEN
      CREATE POLICY service_role_all ON run_state TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- Ensure all other core tables have RLS enabled (idempotent; no-op if already set).
ALTER TABLE IF EXISTS wallet_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS security_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_history ENABLE ROW LEVEL SECURITY;
