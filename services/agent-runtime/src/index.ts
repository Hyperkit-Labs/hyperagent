/**
 * HyperAgent Agent Runtime
 * HTTP API for orchestrator: /agents/spec, /agents/design, /agents/codegen.
 * BYOK via X-Agent-Session or X-Internal-Token. Body-only apiKeys no longer bypass auth.
 * Commands are registered in @hyperagent/agent-os CommandRegistry for discovery (GET /registry/commands).
 */

import cors from "cors";
import express from "express";
import { CommandRegistry } from "@hyperagent/agent-os";
import { specAgent, designAgent, codegenAgent, testAgent, autofixAgent, estimateAgent, pashovAuditAgent, type AgentContext, type DesignProposal, type AutofixInput } from "./agents.js";
import { resolveAgentSession } from "./agentSession.js";
import { generateFromWizard } from "./ozWizard.js";

import { requestIdMiddleware, otelRequestSpanMiddleware, safeHandler } from "@hyperagent/backend-middleware";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((o) => o.trim());
const INTERNAL_AUTH_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";
const IS_PRODUCTION = (process.env.NODE_ENV || "development") === "production";

const commandRegistry = new CommandRegistry();

const app = express();
app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: "2mb" }));

/**
 * Auth: requires X-Agent-Session or X-Internal-Token.
 * Body-only apiKeys are NOT sufficient to pass auth (closes bypass vector).
 */
function requireInternalAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (req.path === "/health" || req.path === "/health/live") return next();
  const hasSession = !!req.header("X-Agent-Session");
  const hasToken = INTERNAL_AUTH_TOKEN && req.header("X-Internal-Token") === INTERNAL_AUTH_TOKEN;
  if (hasSession || hasToken) return next();
  if (!INTERNAL_AUTH_TOKEN && !IS_PRODUCTION) return next();
  res.status(401).json({ error: "Unauthorized: X-Agent-Session or X-Internal-Token required" });
}
app.use(requireInternalAuth);

function getContext(req: express.Request, body: { context?: AgentContext }): AgentContext | null {
  const bodyCtx = body.context;
  const bodyKeys = bodyCtx?.apiKeys && Object.keys(bodyCtx.apiKeys).length > 0 ? bodyCtx.apiKeys : null;

  const sessionToken = req.header("X-Agent-Session");
  if (sessionToken) {
    const resolved = resolveAgentSession(sessionToken);
    if (resolved) {
      const jwtKeys = Object.keys(resolved.apiKeys).filter((k) => resolved.apiKeys[k]?.trim()).length > 0 ? resolved.apiKeys : null;
      const mergedKeys = { ...(bodyKeys || {}), ...(jwtKeys || {}) };
      if (Object.keys(mergedKeys).length > 0) {
        return {
          userId: resolved.userId,
          projectId: resolved.projectId || bodyCtx?.projectId || "",
          runId: resolved.runId,
          apiKeys: mergedKeys as AgentContext["apiKeys"],
        };
      }
    }
  }

  if (bodyKeys && bodyCtx) return bodyCtx;
  return null;
}

function registerPost(
  id: string,
  path: string,
  description: string,
  category: "agent" | "internal",
  handler: (req: express.Request, res: express.Response) => Promise<void>,
): void {
  commandRegistry.register({
    id,
    method: "POST",
    path,
    description,
    category,
  });
  app.post(path, safeHandler(id, handler));
}

registerPost("spec", "/agents/spec", "Generate structured specification from natural language prompt", "agent", async (req, res) => {
  const { prompt } = req.body as { prompt: string; context?: AgentContext };
  const context = getContext(req, req.body);
  if (!prompt || !context) { res.status(400).json({ error: "prompt and context.apiKeys or X-Agent-Session required" }); return; }
  const spec = await specAgent(prompt, context);
  res.json(spec);
});

registerPost("design", "/agents/design", "Produce design proposal from spec and target chains", "agent", async (req, res) => {
  const { spec, targetChains, securityContext } = req.body as { spec: Record<string, unknown>; targetChains: unknown[]; context?: AgentContext; securityContext?: Record<string, unknown> };
  const context = getContext(req, req.body);
  if (!spec || !context) { res.status(400).json({ error: "spec and context.apiKeys or X-Agent-Session required" }); return; }
  const design = await designAgent(spec, targetChains || [], context, securityContext);
  res.json(design);
});

registerPost("codegen", "/agents/codegen", "Generate Solidity contracts from spec and design", "agent", async (req, res) => {
  const { spec, design, securityContext } = req.body as { spec: Record<string, unknown>; design: DesignProposal; context?: AgentContext; securityContext?: Record<string, unknown> };
  const context = getContext(req, req.body);
  if (!spec || !context) { res.status(400).json({ error: "spec and context.apiKeys or X-Agent-Session required" }); return; }
  const contracts = await codegenAgent(spec, design || { components: [], frameworks: { primary: "hardhat" }, chains: [] }, context, securityContext);
  res.json(contracts);
});

registerPost("test", "/agents/test", "Generate tests for contracts given spec and design", "agent", async (req, res) => {
  const { contracts, spec, design } = req.body as { contracts: Record<string, string>; spec: Record<string, unknown>; design: DesignProposal; context?: AgentContext };
  const context = getContext(req, req.body);
  if (!contracts || !spec || !context) { res.status(400).json({ error: "contracts, spec and context.apiKeys or X-Agent-Session required" }); return; }
  const tests = await testAgent(contracts, spec, design || { components: [], frameworks: { primary: "hardhat" }, chains: [] }, context);
  res.json(tests);
});

registerPost("oz-wizard", "/agents/codegen/oz-wizard", "OpenZeppelin Contract Wizard codegen (erc20, erc721, erc1155)", "agent", async (req, res) => {
  const sessionToken = req.header("X-Agent-Session");
  if (sessionToken) {
    const resolved = resolveAgentSession(sessionToken);
    if (!resolved) { res.status(401).json({ error: "Invalid or expired X-Agent-Session" }); return; }
  }
  const { kind, options } = req.body as { kind?: string; options?: Record<string, unknown> };
  if (!kind) { res.status(400).json({ error: "kind required (erc20, erc721, erc1155)" }); return; }
  const contracts = generateFromWizard(kind, (options || {}) as import("./ozWizard.js").OzWizardOptions);
  res.json(contracts);
});

registerPost("autofix", "/agents/autofix", "Iterative fix pass from audit or simulation findings", "agent", async (req, res) => {
  const { contracts, auditFindings, simulationError, designRationale, cycle, maxCycles } = req.body as AutofixInput & { context?: AgentContext };
  const context = getContext(req, req.body);
  if (!contracts || !context) { res.status(400).json({ error: "contracts and context.apiKeys or X-Agent-Session required" }); return; }
  const fixed = await autofixAgent(
    { contracts, auditFindings: auditFindings || [], simulationError, designRationale, cycle: cycle || 1, maxCycles: maxCycles || 3 },
    context,
  );
  res.json(fixed);
});

registerPost("estimate", "/agents/estimate", "Estimate effort or complexity from prompt", "agent", async (req, res) => {
  const { prompt } = req.body as { prompt: string; context?: AgentContext };
  const context = getContext(req, req.body);
  if (!prompt || !context) { res.status(400).json({ error: "prompt and context.apiKeys or X-Agent-Session required" }); return; }
  const estimate = await estimateAgent(prompt, context);
  res.json(estimate);
});

registerPost("pashov-audit", "/agents/pashov-audit", "Pashov-style audit agent pass", "internal", async (req, res) => {
  const { systemPrompt, userPrompt, context: ctx } = req.body as { systemPrompt: string; userPrompt: string; context?: AgentContext };
  const context = getContext(req, req.body) ?? ctx;
  if (!systemPrompt || !userPrompt || !context) {
    res.status(400).json({ error: "systemPrompt, userPrompt, and context.apiKeys or X-Agent-Session required" });
    return;
  }
  const result = await pashovAuditAgent({ systemPrompt, userPrompt, context });
  res.json(result);
});

commandRegistry.register({
  id: "health",
  method: "GET",
  path: "/health",
  description: "Liveness probe",
  category: "health",
});

commandRegistry.register({
  id: "registry-commands",
  method: "GET",
  path: "/registry/commands",
  description: "List registered HTTP commands (JSON discovery for orchestration and tooling)",
  category: "internal",
  internalOnly: true,
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get(
  "/registry/commands",
  safeHandler("registry-commands", async (_req, res) => {
    res.json({ version: "1", commands: commandRegistry.toDiscoveryJson() });
  }),
);

const port = Number(process.env.PORT) || 4001;
app.listen(port, "0.0.0.0", () => console.log(`[Agent Runtime] listening on ${port}`));
