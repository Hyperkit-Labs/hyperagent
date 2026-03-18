/**
 * HyperAgent Simulation Service
 * Tenderly (or other backend) behind ISimulationBackend. Used by agent-runtime and orchestrator.
 */

import cors from "cors";
import express from "express";
import { requestIdMiddleware, otelRequestSpanMiddleware } from "@hyperagent/backend-middleware";
import { createDefaultBackend } from "./backends.js";

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

interface SimulateBundleBody {
  simulations?: Array<{ network_id: string; from: string; to?: string; input: string; value?: string; gas?: number }>;
  block_number?: number | null;
  state_objects?: Record<string, { nonce?: number; code?: string; balance?: string; storage?: Record<string, string> }>;
  simulation_type?: "full" | "quick" | "abi";
  save?: boolean;
}

const backend = createDefaultBackend();

const INTERNAL_TOKEN = (process.env.INTERNAL_SERVICE_TOKEN || "").trim();

function requireInternalAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (req.path === "/health") return next();
  if (!INTERNAL_TOKEN) return next();
  const token = req.header("X-Internal-Token");
  if (token === INTERNAL_TOKEN) return next();
  res.status(401).json({ error: "Unauthorized: X-Internal-Token required when INTERNAL_SERVICE_TOKEN is set" });
}

const app = express();
app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(requireInternalAuth);
app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

app.post("/simulate-bundle", async (req, res) => {
  try {
    const body = req.body as SimulateBundleBody;
    const sims = body.simulations;
    if (!sims || !Array.isArray(sims) || sims.length === 0) {
      return res.status(400).json({ success: false, error: "simulations array is required and must not be empty" });
    }
    if (!backend) {
      return res.status(503).json({ success: false, error: "TENDERLY_API_KEY not configured" });
    }
    const tk = backend as {
      simulateBundle?: (r: {
        simulations: typeof sims;
        block_number?: number | null;
        state_objects?: SimulateBundleBody["state_objects"];
        simulation_type?: string;
        save?: boolean;
      }) => Promise<{ success: boolean; error?: string; gasUsed?: number }>;
    };
    if (!tk.simulateBundle) {
      return res.status(501).json({ success: false, error: "simulate-bundle not supported by backend" });
    }
    const result = await tk.simulateBundle({
      simulations: sims,
      block_number: body.block_number,
      state_objects: body.state_objects,
      simulation_type: body.simulation_type,
      save: body.save,
    });
    res.json(result);
  } catch (e: unknown) {
    console.error("[Simulation] simulate-bundle", e);
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : "Bundled simulation failed",
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    tenderly_configured: Boolean(process.env.TENDERLY_API_KEY),
  });
});

const port = Number(process.env.PORT) || 8002;
app.listen(port, "0.0.0.0", () => {
  console.log(`[Simulation] listening on ${port}`);
});
