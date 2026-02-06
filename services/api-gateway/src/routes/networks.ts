import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Env } from "../config/env";

export async function registerNetworkRoutes(app: FastifyInstance, opts: { env: Env }) {
  const baseUrl = (opts.env.PYTHON_BACKEND_URL ?? "").replace(/\/$/, "");

  async function proxyToPython(req: FastifyRequest, reply: FastifyReply) {
    if (!baseUrl) {
      return reply.status(501).send({
        error: "Python backend not configured",
        message: "PYTHON_BACKEND_URL is not set on the TS API server",
      });
    }

    const targetUrl = `${baseUrl}${req.url}`;
    const res = await fetch(targetUrl, {
      method: req.method,
      headers: {
        // Only forward content-type/accept headers for safety.
        ...(req.headers["content-type"] ? { "content-type": String(req.headers["content-type"]) } : {}),
        ...(req.headers["accept"] ? { accept: String(req.headers["accept"]) } : {}),
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    reply.status(res.status);
    if (contentType) {
      reply.header("content-type", contentType);
    }

    if (contentType.includes("application/json")) {
      const data = await res.json().catch(() => null);
      return reply.send(data);
    }

    const text = await res.text().catch(() => "");
    return reply.send(text);
  }

  // app.get("/api/v1/networks", proxyToPython); // Handled by v1.ts
  app.get("/api/v1/networks/x402", proxyToPython);
  app.get("/api/v1/networks/:network/features", proxyToPython);

  // Convenience endpoint: return features payload for the given network.
  // app.get("/api/v1/networks/:network", proxyToPython); // Handled by v1.ts
}
