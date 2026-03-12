-- ZSPS: Link deployments to wallet_user for ownership isolation
-- When auth.uid() maps to wallet_users.id (SIWE/custom JWT), policy enforces owner-only read.

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS wallet_user_id UUID REFERENCES wallet_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deployments_wallet_user_id ON deployments(wallet_user_id);

DROP POLICY IF EXISTS "owner_read_own_deployments" ON deployments;
CREATE POLICY "owner_read_own_deployments" ON deployments
  FOR SELECT TO authenticated
  USING (wallet_user_id = auth.uid());

COMMENT ON POLICY "owner_read_own_deployments" ON deployments IS 'ZSPS: Ensures contract ownership is cryptographically tied to the active wallet user.';
