-- Align storage_records with orchestrator pipeline inserts (services/orchestrator/ipfs_client.py).
-- Safe on: (a) baseline shape with record_type/key, (b) minimal tables without those columns.

ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS artifact_type TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS storage_type TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS cid TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS gateway_url TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS artifact_id UUID;

-- Legacy columns from 00000000000000_baseline.sql — add if this database never had that baseline.
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS record_type TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'::jsonb;
ALTER TABLE storage_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Relax NOT NULL only when column exists and is still non-nullable (older baselines).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'storage_records'
      AND column_name = 'record_type'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE storage_records ALTER COLUMN record_type DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'storage_records'
      AND column_name = 'key'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE storage_records ALTER COLUMN key DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_storage_records_cid ON storage_records (cid)
  WHERE cid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_records_status_type ON storage_records (status, storage_type)
  WHERE status IS NOT NULL;

COMMENT ON COLUMN storage_records.storage_type IS
  'ipfs = pinning path in this repo. filecoin/arweave values are reserved; no deal orchestration here yet.';
