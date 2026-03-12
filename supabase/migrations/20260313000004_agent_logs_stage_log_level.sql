-- agent_logs: add stage and log_level for pipeline step logging
-- db.insert_agent_log uses stage and log_level; baseline had level only

ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS log_level TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_logs' AND column_name = 'level') THEN
    UPDATE agent_logs SET log_level = COALESCE(log_level, level, 'info') WHERE log_level IS NULL AND level IS NOT NULL;
  END IF;
END $$;
