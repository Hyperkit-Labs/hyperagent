-- Centralize identity + artifact storage: drop legacy duplicate columns after backfill.
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS patterns.

-- -----------------------------------------------------------------------------
-- 1) wallet_users: auth_provider duplicated auth lane vs auth_method (gateway writes auth_method).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_users' AND column_name = 'auth_provider'
  ) THEN
    UPDATE public.wallet_users
    SET auth_method = auth_provider
    WHERE auth_provider IS NOT NULL
      AND (auth_method IS NULL OR auth_method = 'siwe');

    ALTER TABLE public.wallet_users DROP COLUMN auth_provider;
  END IF;
END $$;

COMMENT ON COLUMN public.wallet_users.auth_method IS
  'Auth lane written by api-gateway bootstrap: siwe_eoa | thirdweb_inapp (legacy siwe default upgraded on login).';

-- -----------------------------------------------------------------------------
-- 2) project_artifacts: ipfs_cid was legacy alias for cid (see 20260316000002).
-- -----------------------------------------------------------------------------
UPDATE public.project_artifacts
SET cid = COALESCE(NULLIF(TRIM(cid), ''), NULLIF(TRIM(ipfs_cid), ''))
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_artifacts' AND column_name = 'ipfs_cid'
)
AND ipfs_cid IS NOT NULL
AND (cid IS NULL OR TRIM(cid) = '');

ALTER TABLE public.project_artifacts DROP COLUMN IF EXISTS ipfs_cid;
