import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env";
import { registerWorkflowRoutes } from "./routes/workflows";
import { registerHealthRoutes } from "./routes/health";
import { WorkflowStore } from "./storage/postgres";

const env = loadEnv();

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.addHook("onRequest", async (req) => {
    // Ensure correlation id is visible in logs and downstream responses
    req.log.info(
      { requestId: req.id, method: req.method, url: req.url },
      "request.start",
    );
  });

  app.addHook("onResponse", async (req, reply) => {
    reply.header("x-request-id", req.id);
    req.log.info(
      { requestId: req.id, statusCode: reply.statusCode },
      "request.end",
    );
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Routes
  await app.register(registerHealthRoutes);
  let store: WorkflowStore | null = null;
  if (env.DATABASE_URL) {
    store = new WorkflowStore(env.DATABASE_URL);
    await store.init();
    app.log.info("WorkflowStore initialized");
  } else {
    app.log.warn("DATABASE_URL not set, workflow persistence disabled");
  }

  await app.register(registerWorkflowRoutes, { store, env });

  return app;
}

async function start() {
  try {
    const app = await buildServer();
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    // Keep startup output plain for logs and CI
    console.log(`HyperAgent TS API listening on ${env.HOST}:${env.PORT}`);
    console.log(`Health: http://${env.HOST}:${env.PORT}/healthz`);
    console.log(`Workflows: http://${env.HOST}:${env.PORT}/api/v2/workflows`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  start();
}

export { buildServer, start };

