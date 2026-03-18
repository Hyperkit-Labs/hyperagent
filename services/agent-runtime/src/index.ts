/**
 * HyperAgent Agent Runtime
 * HTTP API for orchestrator: /agents/spec, /agents/design, /agents/codegen. BYOK via X-Agent-Session (Option B) or context.apiKeys.
 */

import cors from "cors";
import express from "express";
import { specAgent, designAgent, codegenAgent, testAgent, autofixAgent, estimateAgent, pashovAuditAgent, type AgentContext, type DesignProposal, type AutofixInput } from "./agents.js";
import { resolveAgentSession } from "./agentSession.js";
import { generateFromWizard } from "./ozWizard.js";

import { requestIdMiddleware, otelRequestSpanMiddleware } from "@hyperagent/backend-middleware";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((o) => o.trim());
const INTERNAL_AUTH_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";

const app = express();
app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: "2mb" }));

function requireInternalAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (req.path === "/health") return next();
  const hasSession = !!req.header("X-Agent-Session");
  const hasToken = INTERNAL_AUTH_TOKEN && req.header("X-Internal-Token") === INTERNAL_AUTH_TOKEN;
  const hasBody = !!(req.body?.context?.apiKeys && Object.keys(req.body.context.apiKeys).length > 0);
  if (hasSession || hasToken || hasBody) return next();
  res.status(401).json({ error: "Unauthorized: missing X-Agent-Session, X-Internal-Token, or context.apiKeys" });
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

app.post("/agents/spec", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string; context?: AgentContext };
    const context = getContext(req, req.body);
    if (!prompt || !context) return res.status(400).json({ error: "prompt and context.apiKeys or X-Agent-Session required" });
    const spec = await specAgent(prompt, context);
    res.json(spec);
  } catch (e: unknown) {
    console.error("[spec]", e instanceof Error ? e.message : "Spec failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Spec failed" });
  }
});

app.post("/agents/design", async (req, res) => {
  try {
    const { spec, targetChains, securityContext } = req.body as { spec: Record<string, unknown>; targetChains: unknown[]; context?: AgentContext; securityContext?: Record<string, unknown> };
    const context = getContext(req, req.body);
    if (!spec || !context) return res.status(400).json({ error: "spec and context.apiKeys or X-Agent-Session required" });
    const design = await designAgent(spec, targetChains || [], context, securityContext);
    res.json(design);
  } catch (e: unknown) {
    console.error("[design]", e instanceof Error ? e.message : "Design failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Design failed" });
  }
});

app.post("/agents/codegen", async (req, res) => {
  try {
    const { spec, design, securityContext } = req.body as { spec: Record<string, unknown>; design: DesignProposal; context?: AgentContext; securityContext?: Record<string, unknown> };
    const context = getContext(req, req.body);
    if (!spec || !context) return res.status(400).json({ error: "spec and context.apiKeys or X-Agent-Session required" });
    const contracts = await codegenAgent(spec, design || { components: [], frameworks: { primary: "hardhat" }, chains: [] }, context, securityContext);
    res.json(contracts);
  } catch (e: unknown) {
    console.error("[codegen]", e instanceof Error ? e.message : "Codegen failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Codegen failed" });
  }
});

app.post("/agents/test", async (req, res) => {
  try {
    const { contracts, spec, design } = req.body as { contracts: Record<string, string>; spec: Record<string, unknown>; design: DesignProposal; context?: AgentContext };
    const context = getContext(req, req.body);
    if (!contracts || !spec || !context) return res.status(400).json({ error: "contracts, spec and context.apiKeys or X-Agent-Session required" });
    const tests = await testAgent(contracts, spec, design || { components: [], frameworks: { primary: "hardhat" }, chains: [] }, context);
    res.json(tests);
  } catch (e: unknown) {
    console.error("[test]", e instanceof Error ? e.message : "Test generation failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Test generation failed" });
  }
});

app.post("/agents/codegen/oz-wizard", async (req, res) => {
  try {
    const sessionToken = req.header("X-Agent-Session");
    if (sessionToken) {
      const resolved = resolveAgentSession(sessionToken);
      if (!resolved) return res.status(401).json({ error: "Invalid or expired X-Agent-Session" });
    }
    const { kind, options } = req.body as { kind?: string; options?: Record<string, unknown> };
    if (!kind) return res.status(400).json({ error: "kind required (erc20, erc721, erc1155)" });
    const contracts = generateFromWizard(kind, (options || {}) as import("./ozWizard.js").OzWizardOptions);
    res.json(contracts);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "OZ Wizard failed";
    if (msg.includes("kind must be")) return res.status(400).json({ error: msg });
    console.error("[oz-wizard]", msg);
    res.status(500).json({ error: msg });
  }
});

app.post("/agents/autofix", async (req, res) => {
  try {
    const { contracts, auditFindings, simulationError, designRationale, cycle, maxCycles } = req.body as AutofixInput & { context?: AgentContext };
    const context = getContext(req, req.body);
    if (!contracts || !context) return res.status(400).json({ error: "contracts and context.apiKeys or X-Agent-Session required" });
    const fixed = await autofixAgent(
      { contracts, auditFindings: auditFindings || [], simulationError, designRationale, cycle: cycle || 1, maxCycles: maxCycles || 3 },
      context,
    );
    res.json(fixed);
  } catch (e: unknown) {
    console.error("[autofix]", e instanceof Error ? e.message : "Autofix failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Autofix failed" });
  }
});

app.post("/agents/estimate", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string; context?: AgentContext };
    const context = getContext(req, req.body);
    if (!prompt || !context) return res.status(400).json({ error: "prompt and context.apiKeys or X-Agent-Session required" });
    const estimate = await estimateAgent(prompt, context);
    res.json(estimate);
  } catch (e: unknown) {
    console.error("[estimate]", e instanceof Error ? e.message : "Estimate failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Estimate failed" });
  }
});

app.post("/agents/pashov-audit", async (req, res) => {
  try {
    const { systemPrompt, userPrompt, context: ctx } = req.body as { systemPrompt: string; userPrompt: string; context?: AgentContext };
    const context = getContext(req, req.body) ?? ctx;
    if (!systemPrompt || !userPrompt || !context) {
      return res.status(400).json({ error: "systemPrompt, userPrompt, and context.apiKeys or X-Agent-Session required" });
    }
    const result = await pashovAuditAgent({ systemPrompt, userPrompt, context });
    res.json(result);
  } catch (e: unknown) {
    console.error("[pashov-audit]", e instanceof Error ? e.message : "Pashov audit failed");
    res.status(500).json({ error: e instanceof Error ? e.message : "Pashov audit failed" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const port = Number(process.env.PORT) || 4001;
app.listen(port, "0.0.0.0", () => console.log(`[Agent Runtime] listening on ${port}`));
