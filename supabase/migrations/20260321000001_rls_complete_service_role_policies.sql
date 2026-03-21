-- Complete RLS coverage: add service_role_all policy for every table that has RLS enabled
-- but was missing an explicit service_role policy. This ensures backend access works
-- and the anon/authenticated roles (used by frontend) get zero access.
--
-- Also drops the ineffective owner_read_own_deployments policy which relies on auth.uid()
-- that is always NULL in the current gateway JWT scheme (not Supabase Auth).

-- wallet_user_profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallet_user_profiles' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON wallet_user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- projects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON projects FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- runs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'runs' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON runs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- run_steps
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'run_steps' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON run_steps FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- project_artifacts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_artifacts' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON project_artifacts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- deployments: drop the ineffective auth.uid()-based policy and add service_role_all
DROP POLICY IF EXISTS "owner_read_own_deployments" ON deployments;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deployments' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON deployments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- security_findings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_findings' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON security_findings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- payment_history
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_history' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON payment_history FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- custom_domains
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_domains') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_domains' AND policyname = 'service_role_all') THEN
      CREATE POLICY service_role_all ON custom_domains FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- agent_registry
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_registry') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_registry' AND policyname = 'service_role_all') THEN
      CREATE POLICY service_role_all ON agent_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- Document the invariant on every table
COMMENT ON TABLE wallet_user_profiles IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE projects IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE runs IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE run_steps IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE project_artifacts IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE deployments IS 'RLS: service_role_all only. Backend-only. owner_read_own_deployments dropped (auth.uid() is NULL in gateway JWT). Frontend anon/auth roles get zero access.';
COMMENT ON TABLE security_findings IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
COMMENT ON TABLE payment_history IS 'RLS: service_role_all only. Backend-only. Frontend anon/auth roles get zero access.';
