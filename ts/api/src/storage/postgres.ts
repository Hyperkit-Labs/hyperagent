import { Pool } from "pg";
import { HyperAgentState } from "@hyperagent/orchestrator";

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  step: number;
  node: string;
  state: HyperAgentState;
  createdAt: string;
}

export class WorkflowStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ts_workflow_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id TEXT NOT NULL,
        step INTEGER NOT NULL,
        node TEXT NOT NULL,
        state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ts_workflow_events_workflow_step_idx
        ON ts_workflow_events (workflow_id, step DESC);
    `);
  }

  async appendEvent(args: {
    workflowId: string;
    step: number;
    node: string;
    state: HyperAgentState;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO ts_workflow_events (workflow_id, step, node, state) VALUES ($1, $2, $3, $4)`,
      [args.workflowId, args.step, args.node, args.state],
    );
  }

  async getLatestState(workflowId: string): Promise<HyperAgentState | null> {
    const result = await this.pool.query(
      `SELECT state FROM ts_workflow_events WHERE workflow_id = $1 ORDER BY step DESC LIMIT 1`,
      [workflowId],
    );
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0].state as HyperAgentState;
  }

  async listWorkflows(limit = 50): Promise<Array<{ workflowId: string; state: HyperAgentState }>> {
    const result = await this.pool.query(
      `
      SELECT DISTINCT ON (workflow_id) workflow_id, state
      FROM ts_workflow_events
      ORDER BY workflow_id, step DESC
      LIMIT $1
      `,
      [limit],
    );

    return result.rows.map((r: { workflow_id: string; state: unknown }) => ({
      workflowId: r.workflow_id,
      state: r.state as HyperAgentState,
    }));
  }
}


