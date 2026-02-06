import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { EventEmitter } from "events";
import { z } from "zod";
import { HyperAgentState, initialState, runGraph, withUpdates } from "@hyperagent/orchestrator";
import { apiNodeRegistry } from "../orchestrator/apiNodeRegistry";
import { compileSolidity } from "../evm/compileSolidity";
import { deployContract, waitForContractAddress } from "../evm/deploy";
import { settleX402Payment } from "../x402/verifierClient";
import { WorkflowStore } from "../storage/postgres";
import { Env } from "../config/env";
import { normalizeNetworkId, parseEvmChainId } from "../evm/networkConfig";

const createWorkflowSchema = z.object({
  nlp_input: z.string().min(10).max(5000),
  network: z.string().min(1).max(128),
  contract_type: z.string().max(50).optional(),
  name: z.string().max(255).optional(),
  selected_tasks: z.array(z.string()).optional(),
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  use_gasless: z.boolean().optional(),
});

const estimateCostSchema = z.object({
  selected_tasks: z.array(z.string()).min(1),
  network: z.string().min(1),
  model: z.string().optional(),
  contract_complexity: z.string().optional(),
  prompt_length: z.number().optional(),
});

const x402GenerateContractSchema = z.object({
  nlp_description: z.string().min(10).max(5000),
  contract_type: z.string().max(50).optional(),
  network: z.string().min(1).max(128),
});

const x402WorkflowFromContractSchema = z.object({
  contract_code: z.string().min(1), // Allow any non-empty contract code
  contract_type: z.string().min(1).max(50).optional().default("Custom"),
  network: z.string().min(1).max(128),
  constructor_args: z.array(z.any()).optional(),
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  use_gasless: z.boolean().optional(),
  name: z.string().max(255).optional(),
  selected_tasks: z.array(z.string()).optional(),
});

type V1Opts = { store: WorkflowStore; env: Env; workflowEvents?: EventEmitter };

type V1WorkflowStatus =
  | "created"
  | "generating"
  | "compiling"
  | "auditing"
  | "testing"
  | "deploying"
  | "completed"
  | "failed"
  | "cancelled";

function mapOrchestratorStatus(state: HyperAgentState): V1WorkflowStatus {
  switch (state.status) {
    case "processing":
      return "generating";
    case "auditing":
      return "auditing";
    case "validating":
      return "testing";
    case "deploying":
      return "deploying";
    case "success":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "generating";
  }
}

function progressFromStatus(status: V1WorkflowStatus): number {
  switch (status) {
    case "created":
      return 0;
    case "generating":
      return 20;
    case "compiling":
      return 40;
    case "auditing":
      return 60;
    case "testing":
      return 80;
    case "deploying":
      return 100;
    case "completed":
      return 100;
    case "failed":
      return 0;
    case "cancelled":
      return 0;
  }
}

function isX402Network(env: Env, network: string): boolean {
  if (!env.X402_ENABLED) {
    return false;
  }

  const enabled = env.X402_ENABLED_NETWORKS?.trim() ?? "";
  if (!enabled) {
    return false;
  }

  const normalizedNetwork = normalizeNetworkId(network);
  const networkChainId = parseEvmChainId(network);

  const tokens = enabled
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.some((t) => t === "*" || t === "all")) {
    return true;
  }

  for (const token of tokens) {
    const tokenChainId = parseEvmChainId(token);
    if (tokenChainId !== null && networkChainId !== null) {
      if (tokenChainId === networkChainId) {
        return true;
      }
      continue;
    }

    if (normalizeNetworkId(token) === normalizedNetwork) {
      return true;
    }
  }

  return false;
}

function buildResourceUrl(req: FastifyRequest): string {
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? (req.headers.host ?? "localhost");
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "http";
  return `${proto}://${host}${req.url}`;
}

function mapStateToWorkflowResponse(state: HyperAgentState) {
  const status = mapOrchestratorStatus(state);
  const progress = progressFromStatus(status);

  // Provide a lightweight contract list so the UI can decide when to fetch contract code.
  const hasContract = Boolean(state.contract && state.contract.trim().length > 0);
  const contracts = hasContract
    ? [
        {
          id: state.meta.contracts.primaryId,
          contract_name: state.meta.contracts.items[0]?.filename ?? "Contract.sol",
          contract_type: "Custom",
          // Some screens (e.g. Avalanche Studio) read source_code from the workflow response.
          source_code: state.contract,
          bytecode: "",
          abi: [],
        },
      ]
    : [];

  const deployments = state.deploymentAddress
    ? [
        {
          id: "deployment_1",
          network: state.meta.chains.selected,
          contract_address: state.deploymentAddress,
          transaction_hash: state.txHash,
          block_number: 0,
          gas_used: 0,
        },
      ]
    : [];

  const error_message = status === "failed" ? state.logs.slice(-1)[0] ?? "Workflow failed" : null;

  return {
    workflow_id: state.meta.workflowId,
    status,
    progress_percentage: progress,
    nlp_input: state.intent,
    network: state.meta.chains.selected,
    name: undefined as string | undefined,
    created_at: state.meta.createdAt,
    updated_at: state.meta.updatedAt,
    completed_at: status === "completed" ? state.meta.updatedAt : undefined,
    error_message,
    metadata: {
      meta: state.meta,
      logs: state.logs,
    },
    contracts,
    deployments,
    contract_code: state.contract,
  };
}

function calculateCostEstimate(args: {
  selected_tasks: string[];
  network: string;
  model?: string;
  contract_complexity?: string;
  prompt_length?: number;
}) {
  // Keep this TS implementation aligned with the spirit of Python's CostEstimator,
  // but start with a simple, transparent model.
  const TASK_BASE: Record<string, number> = {
    generation: 0.1,
    audit: 0.1,
    testing: 0.1,
    deployment: 0.1,
    compilation: 0.05,
  };

  const MODEL_MULTIPLIER: Record<string, number> = {
    "gemini-2.5-flash": 1.0,
    "gemini-2.0-flash": 1.0,
    "gpt-4": 2.0,
    "gpt-4-turbo": 2.0,
    "claude-sonnet": 1.8,
  };

  const CHAIN_MULTIPLIER: Record<string, number> = {
    avalanche_fuji: 1.0,
    avalanche_mainnet: 1.2,
    mantle_testnet: 1.3,
    mantle_mainnet: 1.4,
  };

  const COMPLEXITY_MULTIPLIER: Record<string, number> = {
    standard: 1.0,
    advanced: 1.5,
  };

  const modelMultiplier = MODEL_MULTIPLIER[args.model ?? "gemini-2.5-flash"] ?? 1.5;
  const networkMultiplier = CHAIN_MULTIPLIER[args.network] ?? 1.0;
  const complexityMultiplier =
    COMPLEXITY_MULTIPLIER[args.contract_complexity ?? "standard"] ?? 1.0;

  const breakdown: Record<string, { base: number; multiplier: number; final: number }> = {};

  const normalizedTasks = args.selected_tasks.map((t) => t.toLowerCase());
  for (const t of normalizedTasks) {
    const base = TASK_BASE[t] ?? 0.1;
    const final = base * modelMultiplier * networkMultiplier * complexityMultiplier;
    breakdown[t] = {
      base,
      multiplier: modelMultiplier * networkMultiplier * complexityMultiplier,
      final,
    };
  }

  const total_usdc = Object.values(breakdown).reduce((sum, v) => sum + v.final, 0);

  return {
    total_usdc,
    breakdown,
    selected_tasks: normalizedTasks,
    network: args.network,
    network_multiplier: networkMultiplier,
    model_multiplier: modelMultiplier,
    complexity_multiplier: complexityMultiplier,
  };
}

export async function registerV1Routes(app: FastifyInstance, opts: V1Opts) {
  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------
  app.get("/api/v1/health", async (_req, reply: FastifyReply) => {
    return reply.send({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/v1/health/detailed", async (_req, reply: FastifyReply) => {
    // Minimal detailed report for now. DB/Redis probing is added in Phase 2.
    const services: Record<string, unknown> = {
      database: opts.env.DATABASE_URL ? { status: "configured" } : { status: "not_configured" },
      redis: opts.env.REDIS_URL ? { status: "configured" } : { status: "not_configured" },
      llm: {
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
      },
      audit: {
        solhintEnabled: opts.env.AUDIT_SOLHINT_ENABLED,
        solhintStrict: opts.env.AUDIT_SOLHINT_STRICT,
        deepToolsEnabled: opts.env.AUDIT_DEEP_TOOLS_ENABLED,
      },
      x402: {
        enabled: opts.env.X402_ENABLED,
        verifierConfigured: Boolean(opts.env.X402_VERIFIER_URL),
        merchantConfigured: Boolean(opts.env.MERCHANT_WALLET_ADDRESS),
        pricesUsd: {
          contract: opts.env.X402_CONTRACT_PRICE_USDC,
          workflow: opts.env.X402_WORKFLOW_PRICE_USDC,
          deploy: opts.env.X402_DEPLOY_PRICE_USDC,
        },
      },
    };

    return reply.send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services,
    });
  });

  // ---------------------------------------------------------------------------
  // Workflows
  // ---------------------------------------------------------------------------
  app.post(
    "/api/v1/workflows/estimate-cost",
    async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = estimateCostSchema.parse(req.body);
        const result = calculateCostEstimate({
          selected_tasks: body.selected_tasks,
          network: body.network,
          model: body.model,
          contract_complexity: body.contract_complexity,
          prompt_length: body.prompt_length,
        });
        return reply.send(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: error.errors });
        }
        app.log.error(error, "estimate-cost failed");
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.post(
    "/api/v1/workflows/generate",
    async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = createWorkflowSchema.parse(req.body);

        // x402 gating (Thirdweb wrapFetchWithPayment)
        if (isX402Network(opts.env, body.network)) {
          const estimate = calculateCostEstimate({
            selected_tasks: body.selected_tasks ?? ["generation", "audit", "testing", "deployment"],
            network: body.network,
          });

          const wallet = body.wallet_address;
          const sc = await opts.store.getSpendingControl(wallet);
            if (sc && sc.is_active === false) {
              return reply.status(403).send({ message: "Spending controls are disabled" });
            }
            if (sc) {
              const dailyRemaining = Number(sc.daily_limit ?? 0) - Number(sc.daily_spent ?? 0);
              const monthlyRemaining = Number(sc.monthly_limit ?? 0) - Number(sc.monthly_spent ?? 0);
              if (estimate.total_usdc > dailyRemaining) {
                return reply
                  .status(403)
                  .send({ message: `Daily limit exceeded. Remaining: $${dailyRemaining.toFixed(2)}` });
              }
              if (estimate.total_usdc > monthlyRemaining) {
                return reply
                  .status(403)
                  .send({ message: `Monthly limit exceeded. Remaining: $${monthlyRemaining.toFixed(2)}` });
              }
            }

          const paymentData =
            (req.headers["payment-signature"] as string | undefined) ||
            (req.headers["x-payment"] as string | undefined);

          const settle = await settleX402Payment({
            env: opts.env,
            resourceUrl: buildResourceUrl(req),
            method: req.method,
            network: body.network,
            priceUsd: estimate.total_usdc,
            walletAddress: wallet,
            paymentData,
          });

          if (settle.status === 402) {
            for (const [k, v] of Object.entries(settle.responseHeaders ?? {})) {
              reply.header(k, v);
            }
            return reply.status(402).send(settle.responseBody ?? { error: "Payment required" });
          }

          if (!settle.verified) {
            return reply.status(settle.status).send({
              error: settle.error ?? "Payment required",
              errorMessage: settle.errorMessage ?? "Payment required",
              x402Version: 2,
            });
          }

          await opts.store.recordSpending({ wallet_address: wallet, amount: estimate.total_usdc });
            await opts.store.recordPaymentHistory({
              wallet_address: wallet,
              amount: estimate.total_usdc,
              network: body.network,
              endpoint: "/api/v1/workflows/generate",
              merchant: opts.env.MERCHANT_WALLET_ADDRESS ?? null,
              transaction_hash: null,
              status: "completed",
            });
          }

        // Create state and align chain selection.
        let state = initialState(body.nlp_input);
        state = withUpdates(state, {
          meta: {
            chains: { selected: body.network, requested: [body.network] },
            billing: {
              x402Enabled: isX402Network(opts.env, body.network),
              priceUsd: 0,
              paymentRequired: false,
            },
          } as any,
        });

        await opts.store.appendEvent({
            workflowId: state.meta.workflowId,
            step: state.meta.execution.step,
            node: "created",
            state,
          });

        // Background execution.
        setImmediate(async () => {
          try {
            await runGraph("policy", state, apiNodeRegistry, async ({ node, state }) => {
              if (opts.workflowEvents) {
                opts.workflowEvents.emit("update", {
                  workflowId: state.meta.workflowId,
                  node,
                  state,
                  type: "workflow.progressed",
                  data: {
                    stage: node,
                    progress_percentage: progressFromStatus(mapOrchestratorStatus(state)),
                    details: state.logs[state.logs.length - 1],
                  },
                });
              }

              await opts.store.appendEvent({
                workflowId: state.meta.workflowId,
                step: state.meta.execution.step,
                node,
                state,
              });
            });
          } catch (err) {
            app.log.error(err, "workflow background execution failed");
          }
        });

        return reply.send({
          workflow_id: state.meta.workflowId,
          status: "created",
          message: "Workflow created successfully",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: error.errors });
        }
        app.log.error(error, "workflow generate failed");
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.get(
    "/api/v1/workflows/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const workflowId = req.params.id;
      const state = await opts.store.getLatestState(workflowId);
      if (!state) {
        return reply.status(404).send({ error: "Not found", workflow_id: workflowId });
      }

      return reply.send(mapStateToWorkflowResponse(state));
    },
  );

  app.get("/api/v1/workflows", async (_req: FastifyRequest, reply: FastifyReply) => {
    const items = await opts.store.listWorkflows(50);
    const workflows = items.map((i) => mapStateToWorkflowResponse(i.state));
    return reply.send(workflows);
  });

  app.post(
    "/api/v1/workflows/:id/cancel",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      // Cancellation support requires coordinated execution + cancellation tokens.
      // For now, provide a best-effort response.
      return reply.send({ message: "Cancellation requested" });
    },
  );

  app.get(
    "/api/v1/workflows/:id/contracts",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const workflowId = req.params.id;
      const state = await opts.store.getLatestState(workflowId);
      if (!state) {
        return reply.status(404).send({ error: "Not found", workflow_id: workflowId });
      }

      const contracts = state.contract
        ? [
            {
              id: state.meta.contracts.primaryId,
              contract_name: state.meta.contracts.items[0]?.filename ?? "Contract.sol",
              contract_type: "Custom",
              solidity_version: "0.8.0",
              source_code: state.contract,
              bytecode: "",
              deployed_bytecode: "",
              abi: [],
              created_at: state.meta.createdAt,
            },
          ]
        : [];

      // Note: frontend callers are inconsistent (some expect array, some expect {contracts}).
      // Return the object form so both can be made to work.
      return reply.send({ contracts });
    },
  );

  // ---------------------------------------------------------------------------
  // Networks
  // ---------------------------------------------------------------------------
  const NETWORKS = [
    {
      network: "avalanche_fuji",
      chain_id: 43113,
      status: "supported",
      supports_x402: true,
      explorer: "https://testnet.snowtrace.io",
    },
    {
      network: "avalanche_mainnet",
      chain_id: 43114,
      status: "supported",
      supports_x402: true,
      explorer: "https://snowtrace.io",
    },
    {
      network: "mantle_testnet",
      chain_id: 5003,
      status: "supported",
      supports_x402: false,
      explorer: "https://explorer.testnet.mantle.xyz",
    },
    {
      network: "mantle_mainnet",
      chain_id: 5000,
      status: "supported",
      supports_x402: false,
      explorer: "https://explorer.mantle.xyz",
    },
  ];

  app.get(
    "/api/v1/networks",
    async (req: FastifyRequest<{ Querystring: { search?: string; page?: string; limit?: string } }>, reply) => {
      const search = (req.query.search ?? "").trim();

      // Happy-path for the Mantle demo: when PYTHON_BACKEND_URL is configured,
      // proxy search queries to Python to get dynamic network resolution.
      if (search && opts.env.PYTHON_BACKEND_URL) {
        try {
          const baseUrl = opts.env.PYTHON_BACKEND_URL.replace(/\/$/, "");
          const url = new URL(`${baseUrl}/api/v1/networks`);
          url.searchParams.set("search", search);
          if (req.query.page) url.searchParams.set("page", req.query.page);
          if (req.query.limit) url.searchParams.set("limit", req.query.limit);

          const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
          const body = await res.json().catch(() => null);
          return reply.status(res.status).send(body);
        } catch (err) {
          app.log.warn({ err, search }, "networks search proxy failed, falling back to local list");
        }
      }

      // Local fallback (curated networks only).
      let networks = NETWORKS;
      if (search) {
        const needle = search.toLowerCase();
        networks = NETWORKS.filter((n) => {
          if (n.network.toLowerCase().includes(needle)) return true;
          if (String(n.chain_id).includes(needle)) return true;
          return false;
        });

        // If search looks like an EVM chain id, add a synthetic entry.
        const chainId = parseEvmChainId(search);
        if (chainId !== null && !networks.some((n) => n.chain_id === chainId)) {
          networks = [
            {
              network: `eip155:${chainId}`,
              chain_id: chainId,
              status: "supported",
              supports_x402: isX402Network(opts.env, search),
              explorer: "",
            },
            ...networks,
          ];
        }
      }

      // Return object form to match Python's response shape (frontend handles both).
      return reply.send({
        networks,
        total: networks.length,
        page: 1,
        limit: networks.length,
        has_next: false,
        has_prev: false,
      });
    },
  );

  app.get(
    "/api/v1/networks/:network",
    async (req: FastifyRequest<{ Params: { network: string } }>, reply: FastifyReply) => {
      const network = req.params.network;
      const match = NETWORKS.find((n) => n.network === network);
      if (!match) {
        return reply.status(404).send({ error: "Not found", network });
      }
      return reply.send(match);
    },
  );

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------
  app.get("/api/v1/templates", async (_req, reply) => {
    const templates = await opts.store.listTemplates(200);
    return reply.send({ templates });
  });

  // Support both the legacy GET form (frontend) and the POST form (Python backend)
  app.get(
    "/api/v1/templates/search",
    async (req: FastifyRequest<{ Querystring: { q?: string } }>, reply: FastifyReply) => {
      const q = (req.query.q ?? "").trim();
      if (!q) {
        const templates = await opts.store.listTemplates(200);
        return reply.send({ templates });
      }
      const templates = await opts.store.searchTemplates(q, 200);
      return reply.send({ templates });
    },
  );

  app.post(
    "/api/v1/templates/search",
    async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const bodyAny = req.body as any;
      const q = typeof bodyAny?.query === "string" ? bodyAny.query : "";
      if (!q.trim()) {
        return reply.send(await opts.store.listTemplates(200));
      }
      return reply.send(await opts.store.searchTemplates(q.trim(), 200));
    },
  );

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------
  app.get("/api/v1/metrics", async (_req, reply) => {
    return reply.send(await opts.store.getMetrics());
  });

  // ---------------------------------------------------------------------------
  // x402 analytics + spending controls
  // ---------------------------------------------------------------------------
  const spendingControls = new Map<
    string,
    {
      id: string;
      wallet_address: string;
      daily_limit: number | null;
      monthly_limit: number | null;
      whitelist_merchants: string[];
      time_restrictions: Record<string, unknown>;
    }
  >();

  app.get(
    "/api/v1/x402/analytics/history",
    async (
      req: FastifyRequest<{ Querystring: { wallet_address?: string; page?: string; page_size?: string } }>,
      reply,
    ) => {
      const wallet = (req.query.wallet_address ?? "").trim();
      if (!wallet) {
        return reply.send({ items: [], total: 0, page: 1, page_size: 50 });
      }
      const page = Number(req.query.page ?? "1") || 1;
      const pageSize = Number(req.query.page_size ?? "50") || 50;
      return reply.send(await opts.store.getPaymentHistory({ wallet_address: wallet, page, page_size: pageSize }));
    },
  );

  app.get(
    "/api/v1/x402/analytics/summary",
    async (req: FastifyRequest<{ Querystring: { wallet_address?: string } }>, reply) => {
      const wallet = (req.query.wallet_address ?? "").trim();
      if (!wallet) {
        return reply.send({
          daily_total: 0,
          monthly_total: 0,
          transaction_count: 0,
          average_amount: 0,
          top_merchants: [],
        });
      }
      const s = await opts.store.getPaymentSummary(wallet);
      return reply.send({
        daily_total: s.daily_total ?? 0,
        monthly_total: s.monthly_total ?? 0,
        transaction_count: s.transaction_count ?? 0,
        average_amount: s.average_amount ?? 0,
        top_merchants: s.top_merchants ?? [],
      });
    },
  );

  app.get(
    "/api/v1/x402/spending-controls/:wallet",
    async (req: FastifyRequest<{ Params: { wallet: string } }>, reply: FastifyReply) => {
      const wallet = req.params.wallet.toLowerCase();

      const sc = await opts.store.getSpendingControl(wallet);
      if (!sc) {
        return reply.status(404).send({ detail: "Spending controls not found" });
      }
      return reply.send({
        id: String(sc.id),
        wallet_address: sc.wallet_address,
        daily_limit: sc.daily_limit,
        monthly_limit: sc.monthly_limit,
        whitelist_merchants: sc.whitelist_merchants ?? [],
        time_restrictions: sc.time_restrictions ?? {},
      });
    },
  );

  app.post(
    "/api/v1/x402/spending-controls",
    async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const schema = z.object({
        wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        daily_limit: z.number().nullable().optional(),
        monthly_limit: z.number().nullable().optional(),
        whitelist_merchants: z.array(z.string()).nullable().optional(),
      });

      try {
        const body = schema.parse(req.body);
        const key = body.wallet_address.toLowerCase();

        const sc = await opts.store.upsertSpendingControl({
          wallet_address: key,
          daily_limit: body.daily_limit ?? undefined,
          monthly_limit: body.monthly_limit ?? undefined,
          whitelist_merchants: body.whitelist_merchants ?? undefined,
        });
        return reply.send({
          id: String(sc.id),
          wallet_address: sc.wallet_address,
          daily_limit: sc.daily_limit,
          monthly_limit: sc.monthly_limit,
          whitelist_merchants: sc.whitelist_merchants ?? [],
          time_restrictions: sc.time_restrictions ?? {},
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ detail: "Invalid request", errors: error.errors });
        }
        app.log.error(error, "spending-controls save failed");
        return reply.status(500).send({ detail: "Internal server error" });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // x402 contract/workflow endpoints used by the Avalanche flow in the frontend
  // ---------------------------------------------------------------------------
  app.post(
    "/api/v1/x402/contracts/generate",
    async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = x402GenerateContractSchema.parse(req.body);

        if (isX402Network(opts.env, body.network)) {
          const wallet = (req.headers["x-wallet-address"] as string | undefined) ?? "";
          if (!wallet) {
            return reply.status(400).send({ error: "Missing x-wallet-address header" });
          }

          const sc = await opts.store.getSpendingControl(wallet);
            if (sc && sc.is_active === false) {
              return reply.status(403).send({ message: "Spending controls are disabled" });
            }
            if (sc) {
              const dailyRemaining = Number(sc.daily_limit ?? 0) - Number(sc.daily_spent ?? 0);
              const monthlyRemaining = Number(sc.monthly_limit ?? 0) - Number(sc.monthly_spent ?? 0);
              if (opts.env.X402_CONTRACT_PRICE_USDC > dailyRemaining) {
                return reply
                  .status(403)
                  .send({ message: `Daily limit exceeded. Remaining: $${dailyRemaining.toFixed(2)}` });
              }
              if (opts.env.X402_CONTRACT_PRICE_USDC > monthlyRemaining) {
                return reply
                  .status(403)
                  .send({ message: `Monthly limit exceeded. Remaining: $${monthlyRemaining.toFixed(2)}` });
              }
            }

          const paymentData =
            (req.headers["payment-signature"] as string | undefined) ||
            (req.headers["x-payment"] as string | undefined);
          const settle = await settleX402Payment({
            env: opts.env,
            resourceUrl: buildResourceUrl(req),
            method: req.method,
            network: body.network,
            priceUsd: opts.env.X402_CONTRACT_PRICE_USDC,
            walletAddress: wallet,
            paymentData,
          });

          if (settle.status === 402) {
            for (const [k, v] of Object.entries(settle.responseHeaders ?? {})) {
              reply.header(k, v);
            }
            return reply.status(402).send(settle.responseBody ?? { error: "Payment required" });
          }

          if (!settle.verified) {
            return reply.status(settle.status).send({
              error: settle.error ?? "Payment required",
              errorMessage: settle.errorMessage ?? "Payment required",
              x402Version: 2,
            });
          }

          await opts.store.recordSpending({ wallet_address: wallet, amount: opts.env.X402_CONTRACT_PRICE_USDC });
          await opts.store.recordPaymentHistory({
            wallet_address: wallet,
            amount: opts.env.X402_CONTRACT_PRICE_USDC,
            network: body.network,
            endpoint: "/api/v1/x402/contracts/generate",
            merchant: opts.env.MERCHANT_WALLET_ADDRESS ?? null,
            transaction_hash: null,
            status: "completed",
          });
        }

        let state = initialState(body.nlp_description);
        state = withUpdates(state, {
          meta: {
            chains: { selected: body.network, requested: [body.network] },
            billing: { x402Enabled: true, priceUsd: 0, paymentRequired: false },
          } as any,
        });

        // Run policy + generate only.
        state = await apiNodeRegistry.policy.execute(state);
        state = await apiNodeRegistry.generate.execute(state);

        return reply.send({
          contract_code: state.contract,
          contract_type: body.contract_type ?? "Custom",
          constructor_args: [],
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: error.errors });
        }
        app.log.error(error, "x402/contracts/generate failed");
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.post(
    "/api/v1/x402/workflows/create-from-contract",
    async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        app.log.info({ body: req.body }, "x402/workflows/create-from-contract request received");
        const body = x402WorkflowFromContractSchema.parse(req.body);

        if (isX402Network(opts.env, body.network)) {
          const wallet = body.wallet_address;

          const sc = await opts.store.getSpendingControl(wallet);
          if (sc && sc.is_active === false) {
            return reply.status(403).send({ message: "Spending controls are disabled" });
          }
          if (sc) {
            const dailyRemaining = Number(sc.daily_limit ?? 0) - Number(sc.daily_spent ?? 0);
            const monthlyRemaining = Number(sc.monthly_limit ?? 0) - Number(sc.monthly_spent ?? 0);
            if (opts.env.X402_WORKFLOW_PRICE_USDC > dailyRemaining) {
              return reply
                .status(403)
                .send({ message: `Daily limit exceeded. Remaining: $${dailyRemaining.toFixed(2)}` });
            }
            if (opts.env.X402_WORKFLOW_PRICE_USDC > monthlyRemaining) {
              return reply
                .status(403)
                .send({ message: `Monthly limit exceeded. Remaining: $${monthlyRemaining.toFixed(2)}` });
            }
          }

          const paymentData =
            (req.headers["payment-signature"] as string | undefined) ||
            (req.headers["x-payment"] as string | undefined);
          const settle = await settleX402Payment({
            env: opts.env,
            resourceUrl: buildResourceUrl(req),
            method: req.method,
            network: body.network,
            priceUsd: opts.env.X402_WORKFLOW_PRICE_USDC,
            walletAddress: wallet,
            paymentData,
          });

          if (settle.status === 402) {
            for (const [k, v] of Object.entries(settle.responseHeaders ?? {})) {
              reply.header(k, v);
            }
            return reply.status(402).send(settle.responseBody ?? { error: "Payment required" });
          }

          if (!settle.verified) {
            return reply.status(settle.status).send({
              error: settle.error ?? "Payment required",
              errorMessage: settle.errorMessage ?? "Payment required",
              x402Version: 2,
            });
          }

          await opts.store.recordSpending({ wallet_address: wallet, amount: opts.env.X402_WORKFLOW_PRICE_USDC });
          await opts.store.recordPaymentHistory({
            wallet_address: wallet,
            amount: opts.env.X402_WORKFLOW_PRICE_USDC,
            network: body.network,
            endpoint: "/api/v1/x402/workflows/create-from-contract",
            merchant: opts.env.MERCHANT_WALLET_ADDRESS ?? null,
            transaction_hash: null,
            status: "completed",
          });
        }

        // Create a workflow id compatible with the TS orchestrator.
        let state = initialState(`Workflow from contract: ${body.contract_type}`);
        state = withUpdates(state, {
          contract: body.contract_code,
          meta: {
            chains: { selected: body.network, requested: [body.network] },
            billing: { x402Enabled: true, priceUsd: 0, paymentRequired: false },
          } as any,
        });

        await opts.store.appendEvent({
          workflowId: state.meta.workflowId,
          step: state.meta.execution.step,
          node: "created",
          state,
        });

        setImmediate(async () => {
          try {
            await runGraph("audit", state, apiNodeRegistry, async ({ node, state }) => {
              if (opts.workflowEvents) {
                opts.workflowEvents.emit("update", {
                  workflowId: state.meta.workflowId,
                  node,
                  state,
                  type: "workflow.progressed",
                  data: {
                    stage: node,
                    progress_percentage: progressFromStatus(mapOrchestratorStatus(state)),
                    details: state.logs[state.logs.length - 1],
                  },
                });
              }

              await opts.store.appendEvent({
                workflowId: state.meta.workflowId,
                step: state.meta.execution.step,
                node,
                state,
              });
            });
          } catch (err) {
            app.log.error(err, "x402 workflow background execution failed");
          }
        });

        return reply.send({
          workflow_id: state.meta.workflowId,
          status: "created",
          message: "Workflow created successfully",
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: error.errors });
        }
        app.log.error(error, "x402 workflow create-from-contract failed");
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // Deployment (server-side)
  // ---------------------------------------------------------------------------
  const deploymentRequestSchema = z.object({
    compiled_contract: z.object({
      contract_name: z.string().min(1).max(255),
      source_code: z.string().min(50),
      bytecode: z.string().optional(),
      abi: z.any().optional(),
    }),
    network: z.string().min(1).max(128),
    wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    use_gasless: z.boolean().optional(),
    constructor_args: z.array(z.any()).optional(),
  });

  app.post(
    "/api/v1/x402/deployments/deploy",
    async (req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = deploymentRequestSchema.parse(req.body);

        // If x402 is enabled + this is an x402 network, require payment.
        // This is designed to work with Thirdweb wrapFetchWithPayment (v2 header: PAYMENT-SIGNATURE).
        if (isX402Network(opts.env, body.network)) {
          const wallet = body.wallet_address;

          const sc = await opts.store.getSpendingControl(wallet);
          if (sc && sc.is_active === false) {
            return reply.status(403).send({ message: "Spending controls are disabled" });
          }
          if (sc) {
            const dailyRemaining = Number(sc.daily_limit ?? 0) - Number(sc.daily_spent ?? 0);
            const monthlyRemaining = Number(sc.monthly_limit ?? 0) - Number(sc.monthly_spent ?? 0);
            if (opts.env.X402_DEPLOY_PRICE_USDC > dailyRemaining) {
              return reply
                .status(403)
                .send({ message: `Daily limit exceeded. Remaining: $${dailyRemaining.toFixed(2)}` });
            }
            if (opts.env.X402_DEPLOY_PRICE_USDC > monthlyRemaining) {
              return reply
                .status(403)
                .send({ message: `Monthly limit exceeded. Remaining: $${monthlyRemaining.toFixed(2)}` });
            }
          }

          const paymentData =
            (req.headers["payment-signature"] as string | undefined) ||
            (req.headers["x-payment"] as string | undefined);

          const settle = await settleX402Payment({
            env: opts.env,
            resourceUrl: buildResourceUrl(req),
            method: req.method,
            network: body.network,
            priceUsd: opts.env.X402_DEPLOY_PRICE_USDC,
            walletAddress: wallet,
            paymentData,
          });

          if (settle.status === 402) {
            for (const [k, v] of Object.entries(settle.responseHeaders ?? {})) {
              reply.header(k, v);
            }
            return reply.status(402).send(settle.responseBody ?? { error: "Payment required" });
          }

          if (!settle.verified) {
            return reply.status(settle.status).send({
              error: settle.error ?? "Payment required",
              errorMessage: settle.errorMessage ?? "Payment required",
              x402Version: 2,
            });
          }

          await opts.store.recordSpending({ wallet_address: wallet, amount: opts.env.X402_DEPLOY_PRICE_USDC });
          await opts.store.recordPaymentHistory({
            wallet_address: wallet,
            amount: opts.env.X402_DEPLOY_PRICE_USDC,
            network: body.network,
            endpoint: "/api/v1/x402/deployments/deploy",
            merchant: opts.env.MERCHANT_WALLET_ADDRESS ?? null,
            transaction_hash: null,
            status: "completed",
          });
        }

        // Compile if the client didn't provide bytecode/abi.
        let abi: any[] = Array.isArray(body.compiled_contract.abi) ? body.compiled_contract.abi : [];
        let bytecode = (body.compiled_contract.bytecode ?? "").trim();

        if (!bytecode || !bytecode.startsWith("0x") || abi.length === 0) {
          const compiled = compileSolidity({
            sourceCode: body.compiled_contract.source_code,
            contractName: body.compiled_contract.contract_name,
          });
          abi = compiled.abi;
          bytecode = compiled.bytecode;
        }

        const deployed = await deployContract({
          env: opts.env,
          network: body.network,
          abi,
          bytecode: bytecode as `0x${string}`,
          constructorArgs: body.constructor_args,
        });

        return reply.send({
          transaction_hash: deployed.txHash,
          tx_hash: deployed.txHash,
          contract_address: deployed.contractAddress,
          chain_id: deployed.chainId,
          block_number: deployed.blockNumber ?? 0,
          gas_used: deployed.gasUsed ? Number(deployed.gasUsed) : 0,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: error.errors });
        }
        app.log.error(error, "x402/deployments/deploy failed");
        return reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  app.post(
    "/api/v1/workflows/:id/deploy/confirm",
    async (req: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) => {
      const schema = z.object({
        tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        network: z.string().min(1).max(128),
      });

      try {
        const body = schema.parse(req.body);

        const confirmed = await waitForContractAddress({
          env: opts.env,
          network: body.network,
          txHash: body.tx_hash,
          timeoutMs: 120_000,
        });

        // Best-effort persistence into workflow event log.
        if (opts.store) {
          const workflowId = req.params.id;
          const state = await opts.store.getLatestState(workflowId);
          if (state) {
            const next = withUpdates(state, {
              deploymentAddress: confirmed.contractAddress,
              txHash: body.tx_hash,
            });
            await opts.store.appendEvent({
              workflowId,
              step: next.meta.execution.step,
              node: "deploy_confirm",
              state: next,
            });
          }
        }

        return reply.send({
          contract_address: confirmed.contractAddress,
          block_number: confirmed.blockNumber ?? 0,
          gas_used: confirmed.gasUsed ? Number(confirmed.gasUsed) : 0,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: "Invalid request", details: error.errors });
        }
        app.log.error(error, "deploy/confirm failed");
        return reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
}
