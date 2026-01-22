import { FastifyInstance, FastifyReply } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  /**
   * GET /healthz
   * Liveness probe
   */
  app.get("/healthz", async (_req, reply: FastifyReply) => {
    return reply.send({ status: "ok" });
  });

  /**
   * GET /readyz
   * Readiness probe
   */
  app.get("/readyz", async (_req, reply: FastifyReply) => {
    // TODO: Check database, Redis, orchestrator availability
    return reply.send({ status: "ready" });
  });
}

