/**
 * HyperAgent Simulation Service
 * Tenderly (or other backend) behind ISimulationBackend. Used by agent-runtime and orchestrator.
 */

import cors from "cors";
import express from "express";
import { requestIdMiddleware, otelRequestSpanMiddleware, requireInternalToken, safeHandler, validateRequiredSecrets, createLogger } from "@hyperagent/backend-middleware";

const log = createLogger("simulation");
import { createDefaultBackend } from "./backends.js";

validateRequiredSecrets(["INTERNAL_SERVICE_TOKEN"], "simulation");

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

const app = express();
app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(requireInternalToken(INTERNAL_TOKEN));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.post("/simulate", safeHandler("simulation", async (req, res) => {
  const body = req.body as SimulateBody;
  const err = validateSimulateBody(body);
  if (err) {
    res.status(400).json({ success: false, error: err });
    return;
  }
  if (!backend) {
    res.status(503).json({ success: false, error: "TENDERLY_API_KEY not configured" });
    return;
  }
  const { network, from, to, data, value = "0" } = body;
  const result = await backend.simulate({ network, from, to, data, value });
  res.json(result);
}));

app.post("/simulate-bundle", safeHandler("simulation-bundle", async (req, res) => {
  const body = req.body as SimulateBundleBody;
  const sims = body.simulations;
  if (!sims || !Array.isArray(sims) || sims.length === 0) {
    res.status(400).json({ success: false, error: "simulations array is required and must not be empty" });
    return;
  }
  if (!backend) {
    res.status(503).json({ success: false, error: "TENDERLY_API_KEY not configured" });
    return;
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
    res.status(501).json({ success: false, error: "simulate-bundle not supported by backend" });
    return;
  }
  const result = await tk.simulateBundle({
    simulations: sims,
    block_number: body.block_number,
    state_objects: body.state_objects,
    simulation_type: body.simulation_type,
    save: body.save,
  });
  res.json(result);
}));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    tenderly_configured: Boolean(process.env.TENDERLY_API_KEY),
  });
});

const port = Number(process.env.PORT) || 8002;
app.listen(port, "0.0.0.0", () => {
  log.info({ port }, "simulation service started");
});
