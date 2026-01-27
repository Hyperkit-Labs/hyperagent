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

  // ---------------------------------------------------------------------------
  // Workflows (TS orchestrator state)
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Keep the runtime init for now so local dev works without running migrations.
    // Phase 2 migration baseline also exists under ts/api/migrations.
    await this.pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS hyperagent;`);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hyperagent.ts_workflow_events (
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
        ON hyperagent.ts_workflow_events (workflow_id, step DESC);
    `);

    // x402 tables (best-effort; align with Python models under schema hyperagent)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hyperagent.spending_controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        daily_limit DOUBLE PRECISION NOT NULL DEFAULT 10.0,
        monthly_limit DOUBLE PRECISION NOT NULL DEFAULT 100.0,
        daily_spent DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        monthly_spent DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        daily_reset_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
        monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
        whitelist_merchants TEXT[] NULL,
        time_restrictions JSONB NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NULL
      );
    `);

    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS idx_spending_controls_wallet_address ON hyperagent.spending_controls (wallet_address);`,
    );

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hyperagent.payment_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(42) NOT NULL,
        amount NUMERIC(18, 8) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
        merchant VARCHAR(255) NULL,
        network VARCHAR(50) NOT NULL,
        endpoint VARCHAR(255) NULL,
        transaction_hash VARCHAR(66) NULL UNIQUE,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
        status VARCHAR(20) NOT NULL DEFAULT 'completed'
      );
    `);

    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_history_wallet_address ON hyperagent.payment_history (wallet_address);`,
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_history_timestamp ON hyperagent.payment_history (timestamp);`,
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_history_merchant ON hyperagent.payment_history (merchant);`,
    );
  }

  async appendEvent(args: {
    workflowId: string;
    step: number;
    node: string;
    state: HyperAgentState;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO hyperagent.ts_workflow_events (workflow_id, step, node, state) VALUES ($1, $2, $3, $4)`,
      [args.workflowId, args.step, args.node, args.state],
    );
  }

  async getLatestState(workflowId: string): Promise<HyperAgentState | null> {
    const result = await this.pool.query(
      `SELECT state FROM hyperagent.ts_workflow_events WHERE workflow_id = $1 ORDER BY step DESC LIMIT 1`,
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
      FROM hyperagent.ts_workflow_events
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

  // ---------------------------------------------------------------------------
  // Templates (read-only, DB-backed if hyperagent.contract_templates exists)
  // ---------------------------------------------------------------------------
  async listTemplates(limit = 100): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      contract_type: string;
      solidity_version: string;
      code: string;
      tags: string[];
      created_at: string | null;
    }>
  > {
    try {
      const result = await this.pool.query(
        `
        SELECT id, name, description, contract_type, version, template_code, tags, created_at
        FROM hyperagent.contract_templates
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit],
      );

      return result.rows.map((r: any) => ({
        id: String(r.id),
        name: r.name ?? "",
        description: r.description ?? "",
        contract_type: r.contract_type ?? "",
        // contract_templates.version is a template version; use it as a best-effort solidity_version.
        solidity_version: r.version ?? "0.8.20",
        code: r.template_code ?? "",
        tags: Array.isArray(r.tags) ? r.tags : [],
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));
    } catch {
      return [];
    }
  }

  async searchTemplates(query: string, limit = 100): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      contract_type: string;
      solidity_version: string;
      code: string;
      tags: string[];
      created_at: string | null;
    }>
  > {
    const q = `%${query}%`;

    try {
      const result = await this.pool.query(
        `
        SELECT id, name, description, contract_type, version, template_code, tags, created_at
        FROM hyperagent.contract_templates
        WHERE is_active = true
          AND (
            name ILIKE $1 OR
            description ILIKE $1 OR
            contract_type ILIKE $1 OR
            coalesce(tags::text, '') ILIKE $1
          )
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [q, limit],
      );

      return result.rows.map((r: any) => ({
        id: String(r.id),
        name: r.name ?? "",
        description: r.description ?? "",
        contract_type: r.contract_type ?? "",
        solidity_version: r.version ?? "0.8.20",
        code: r.template_code ?? "",
        tags: Array.isArray(r.tags) ? r.tags : [],
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Metrics (best-effort, derived from latest orchestrator state events)
  // ---------------------------------------------------------------------------
  async getMetrics(): Promise<{
    workflows: { total: number; completed: number; failed: number; in_progress: number };
    deployments: { total: number; by_network: Record<string, number> };
    performance: { avg_generation_time: number; avg_compilation_time: number; avg_deployment_time: number };
  }> {
    try {
      // Fetch latest state per workflow (limit to keep query cheap in early phases).
      const result = await this.pool.query(
        `
        SELECT DISTINCT ON (workflow_id) workflow_id, state
        FROM hyperagent.ts_workflow_events
        ORDER BY workflow_id, step DESC
        LIMIT 1000
        `,
      );

      const states = result.rows.map((r: any) => r.state as HyperAgentState);
      const total = states.length;
      const completed = states.filter((s) => s.status === "success").length;
      const failed = states.filter((s) => s.status === "failed").length;
      const in_progress = total - completed - failed;

      const by_network: Record<string, number> = {};
      let deploymentsTotal = 0;
      for (const s of states) {
        if (s.deploymentAddress && s.deploymentAddress.trim().length > 0) {
          deploymentsTotal += 1;
          const n = s.meta?.chains?.selected ?? "unknown";
          by_network[n] = (by_network[n] ?? 0) + 1;
        }
      }

      return {
        workflows: { total, completed, failed, in_progress },
        deployments: { total: deploymentsTotal, by_network },
        performance: { avg_generation_time: 0, avg_compilation_time: 0, avg_deployment_time: 0 },
      };
    } catch {
      return {
        workflows: { total: 0, completed: 0, failed: 0, in_progress: 0 },
        deployments: { total: 0, by_network: {} },
        performance: { avg_generation_time: 0, avg_compilation_time: 0, avg_deployment_time: 0 },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // x402 spending controls + analytics
  // ---------------------------------------------------------------------------
  async getSpendingControl(walletAddress: string): Promise<any | null> {
    const wallet = walletAddress.toLowerCase();
    try {
      const existing = await this.pool.query(
        `SELECT * FROM hyperagent.spending_controls WHERE wallet_address = $1 LIMIT 1`,
        [wallet],
      );

      if (existing.rowCount === 0) {
        const inserted = await this.pool.query(
          `
          INSERT INTO hyperagent.spending_controls (wallet_address)
          VALUES ($1)
          RETURNING *
          `,
          [wallet],
        );
        return inserted.rows[0];
      }

      const row = existing.rows[0];
      const now = new Date();
      const dailyResetAt = row.daily_reset_at ? new Date(row.daily_reset_at) : null;
      const monthlyResetAt = row.monthly_reset_at ? new Date(row.monthly_reset_at) : null;

      let needsUpdate = false;
      let dailySpent = Number(row.daily_spent ?? 0);
      let monthlySpent = Number(row.monthly_spent ?? 0);
      let nextDaily = dailyResetAt;
      let nextMonthly = monthlyResetAt;

      if (dailyResetAt && now >= dailyResetAt) {
        dailySpent = 0;
        nextDaily = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        needsUpdate = true;
      }

      if (monthlyResetAt && now >= monthlyResetAt) {
        monthlySpent = 0;
        // Next month start
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        nextMonthly = d;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const updated = await this.pool.query(
          `
          UPDATE hyperagent.spending_controls
          SET daily_spent = $2,
              monthly_spent = $3,
              daily_reset_at = COALESCE($4, daily_reset_at),
              monthly_reset_at = COALESCE($5, monthly_reset_at),
              updated_at = now()
          WHERE wallet_address = $1
          RETURNING *
          `,
          [wallet, dailySpent, monthlySpent, nextDaily, nextMonthly],
        );
        return updated.rows[0];
      }

      return row;
    } catch {
      return null;
    }
  }

  async upsertSpendingControl(args: {
    wallet_address: string;
    daily_limit?: number | null;
    monthly_limit?: number | null;
    whitelist_merchants?: string[] | null;
  }): Promise<any> {
    const wallet = args.wallet_address.toLowerCase();

    const existing = await this.getSpendingControl(wallet);
    if (!existing) {
      throw new Error("Spending controls table not available");
    }

    const dailyLimit = args.daily_limit ?? existing.daily_limit;
    const monthlyLimit = args.monthly_limit ?? existing.monthly_limit;
    const whitelist = args.whitelist_merchants ?? existing.whitelist_merchants ?? [];

    const updated = await this.pool.query(
      `
      UPDATE hyperagent.spending_controls
      SET daily_limit = $2,
          monthly_limit = $3,
          whitelist_merchants = $4,
          updated_at = now()
      WHERE wallet_address = $1
      RETURNING *
      `,
      [wallet, dailyLimit, monthlyLimit, whitelist],
    );

    return updated.rows[0];
  }

  async recordSpending(args: { wallet_address: string; amount: number }): Promise<void> {
    const wallet = args.wallet_address.toLowerCase();
    await this.pool.query(
      `
      UPDATE hyperagent.spending_controls
      SET daily_spent = daily_spent + $2,
          monthly_spent = monthly_spent + $2,
          updated_at = now()
      WHERE wallet_address = $1
      `,
      [wallet, args.amount],
    );
  }

  async recordPaymentHistory(args: {
    wallet_address: string;
    amount: number;
    network: string;
    endpoint?: string;
    merchant?: string | null;
    transaction_hash?: string | null;
    status?: string;
  }): Promise<void> {
    const wallet = args.wallet_address.toLowerCase();
    await this.pool.query(
      `
      INSERT INTO hyperagent.payment_history
        (wallet_address, amount, currency, merchant, network, endpoint, transaction_hash, status)
      VALUES
        ($1, $2, 'USDC', $3, $4, $5, $6, $7)
      `,
      [
        wallet,
        args.amount,
        args.merchant ?? null,
        args.network,
        args.endpoint ?? null,
        args.transaction_hash ?? null,
        args.status ?? "completed",
      ],
    );
  }

  async getPaymentHistory(args: {
    wallet_address: string;
    page: number;
    page_size: number;
  }): Promise<{ items: any[]; total: number; page: number; page_size: number }> {
    const wallet = args.wallet_address.toLowerCase();
    const page = Math.max(1, args.page);
    const pageSize = Math.min(200, Math.max(1, args.page_size));
    const offset = (page - 1) * pageSize;

    const totalRes = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM hyperagent.payment_history WHERE wallet_address = $1`,
      [wallet],
    );

    const result = await this.pool.query(
      `
      SELECT id, wallet_address, amount, currency, merchant, network, endpoint, transaction_hash, timestamp, status
      FROM hyperagent.payment_history
      WHERE wallet_address = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3
      `,
      [wallet, pageSize, offset],
    );

    return {
      items: result.rows.map((r: any) => ({
        id: String(r.id),
        wallet_address: r.wallet_address,
        amount: Number(r.amount),
        currency: r.currency,
        merchant: r.merchant,
        network: r.network,
        endpoint: r.endpoint,
        transaction_hash: r.transaction_hash,
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
        status: r.status,
      })),
      total: Number(totalRes.rows[0]?.total ?? 0),
      page,
      page_size: pageSize,
    };
  }

  async getPaymentSummary(wallet_address: string): Promise<any> {
    const wallet = wallet_address.toLowerCase();

    const summaryRes = await this.pool.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS total_spent,
        COALESCE(COUNT(*), 0) AS transaction_count,
        COALESCE(AVG(amount), 0) AS average_amount
      FROM hyperagent.payment_history
      WHERE wallet_address = $1
      `,
      [wallet],
    );

    const dailyRes = await this.pool.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS daily_total
      FROM hyperagent.payment_history
      WHERE wallet_address = $1
        AND timestamp >= date_trunc('day', now())
      `,
      [wallet],
    );

    const monthlyRes = await this.pool.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS monthly_total
      FROM hyperagent.payment_history
      WHERE wallet_address = $1
        AND timestamp >= date_trunc('month', now())
      `,
      [wallet],
    );

    const topMerchantsRes = await this.pool.query(
      `
      SELECT merchant, COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
      FROM hyperagent.payment_history
      WHERE wallet_address = $1 AND merchant IS NOT NULL
      GROUP BY merchant
      ORDER BY total DESC
      LIMIT 5
      `,
      [wallet],
    );

    return {
      total_spent: Number(summaryRes.rows[0]?.total_spent ?? 0),
      transaction_count: Number(summaryRes.rows[0]?.transaction_count ?? 0),
      average_amount: Number(summaryRes.rows[0]?.average_amount ?? 0),
      daily_total: Number(dailyRes.rows[0]?.daily_total ?? 0),
      monthly_total: Number(monthlyRes.rows[0]?.monthly_total ?? 0),
      top_merchants: topMerchantsRes.rows.map((r: any) => ({
        merchant: r.merchant,
        total: Number(r.total),
        count: Number(r.count),
      })),
    };
  }
}


