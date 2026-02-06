import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { runGraph, initialState, HyperAgentState } from "@hyperagent/orchestrator";
import { apiNodeRegistry } from "../orchestrator/apiNodeRegistry";
import { z } from "zod";
import { WorkflowStore } from "../storage/postgres";
import { Env } from "../config/env";

const createWorkflowSchema = z.object({
  intent: z.string().min(1).max(500),
});

export async function registerWorkflowRoutes(
  app: FastifyInstance,
  opts: { store: WorkflowStore; env: Env },
) {
  /**
   * POST /api/v2/workflows
   * Create a new workflow from user intent
   */
  app.post(
    "/api/v2/workflows",
    async (req: FastifyRequest<{ Body: { intent: string } }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const body = createWorkflowSchema.parse(req.body);
        const { intent } = body;

        // Create initial state
        const initial = initialState(intent);

        // Optional x402 gating (simple v2 behavior)
        if (opts.env.X402_ENABLED && initial.meta.billing.paymentRequired) {
          return reply.status(402).send({
            error: "Payment required",
            workflowId: initial.meta.workflowId,
            meta: initial.meta,
          });
        }

        // Run graph starting from policy node
        const finalState = await runGraph(
          "policy",
          initial,
          apiNodeRegistry,
          async ({ node, state }) => {
            await opts.store.appendEvent({
              workflowId: state.meta.workflowId,
              step: state.meta.execution.step,
              node,
              state,
            });
          },
        );

        // Return response matching state shape
        return reply.send({
          intent: finalState.intent,
          status: finalState.status,
          contract: finalState.contract,
          deploymentAddress: finalState.deploymentAddress,
          txHash: finalState.txHash,
          auditResults: finalState.auditResults,
          logs: finalState.logs,
          meta: finalState.meta,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: "Invalid request",
            details: error.errors,
          });
        }

        app.log.error(error, "Workflow creation failed");
        return reply.status(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  /**
   * GET /api/v2/workflows/:id
   * Get workflow status (stub - would need persistence layer)
   */
  app.get(
    "/api/v2/workflows/:id",
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const workflowId = req.params.id;
      const state = await opts.store.getLatestState(workflowId);
      if (!state) {
        return reply.status(404).send({ error: "Not found", workflowId });
      }

      return reply.send(state);
    },
  );

  /**
   * GET /api/v2/workflows
   * List workflows (stub)
   */
  app.get("/api/v2/workflows", async (req: FastifyRequest, reply: FastifyReply) => {
    const items = await opts.store.listWorkflows(50);
    return reply.send({
      workflows: items.map((i) => i.state),
    });
  });
}

