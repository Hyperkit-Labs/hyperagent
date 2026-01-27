import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Safe baseline: do not assume schema/extensions exist.
  pgm.sql("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  pgm.sql("CREATE SCHEMA IF NOT EXISTS hyperagent");

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hyperagent.ts_workflow_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id TEXT NOT NULL,
      step INTEGER NOT NULL,
      node TEXT NOT NULL,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS ts_workflow_events_workflow_step_idx
      ON hyperagent.ts_workflow_events (workflow_id, step DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Only drop our TS-owned table/index; do not drop schema/extension.
  pgm.sql("DROP INDEX IF EXISTS ts_workflow_events_workflow_step_idx");
  pgm.sql("DROP TABLE IF EXISTS hyperagent.ts_workflow_events");
}
