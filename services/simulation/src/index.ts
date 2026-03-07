/**
 * HyperAgent Simulation Service
 * Tenderly (or other backend) behind ISimulationBackend. Used by agent-runtime and orchestrator.
 */

import cors from "cors";
import express from "express";
import { createDefaultBackend } from "./backends.js";

const REQUEST_ID_HEADER = "x-request-id";

function requestIdMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const id = (req.headers[REQUEST_ID_HEADER] as string)?.trim() || "";
  (req as express.Request & { requestId?: string }).requestId = id;
  if (id) {
    console.log(`[Simulation] requestId=${id} path=${req.path}`);
  }
  next();
}

const app = express();
app.use(requestIdMiddleware);
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const MAX_DATA_LENGTH = 1024 * 100;
const VALUE_REGEX = /^(0x[0-9a-fA-F]+|[0-9]+)$/;
const HEX_REGEX = /^(0x[0-9a-fA-F]*)?$/;

interface SimulateBody {
  network: string;
  from: string;
  to?: string;
  data: string;
  value?: string;
  design_rationale?: string;
}

function validateSimulateBody(body: SimulateBody): string | null {
  if (!body.network || !body.from) return "network and from are required";
  const data = body.data ?? "";
  if (typeof data !== "string") return "data must be a string";
  if (data.length > MAX_DATA_LENGTH) return `data length must not exceed ${MAX_DATA_LENGTH}`;
  if (data && !HEX_REGEX.test(data)) return "data must be hex (0x...) or empty";
  const value = (body.value ?? "0").toString();
  if (!VALUE_REGEX.test(value)) return "value must be hex (0x...) or decimal string";
  return null;
}

const backend = createDefaultBackend();

app.post("/simulate", async (req, res) => {
  try {
    const body = req.body as SimulateBody;
    const err = validateSimulateBody(body);
    if (err) {
      return res.status(400).json({ success: false, error: err });
    }
    if (!backend) {
      return res.status(503).json({ success: false, error: "TENDERLY_API_KEY not configured" });
    }
    const { network, from, to, data, value = "0" } = body;
    const result = await backend.simulate({ network, from, to, data, value });
    res.json(result);
  } catch (e: unknown) {
    console.error("[Simulation]", e);
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : "Simulation failed",
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT) || 8002;
app.listen(port, "0.0.0.0", () => {
  console.log(`[Simulation] listening on ${port}`);
});
