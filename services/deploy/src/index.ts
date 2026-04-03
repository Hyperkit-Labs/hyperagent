/**
 * HyperAgent Deploy Service
 * Deploy from the user's connected account. Plan from DeployBackend (chain registry or env).
 */

import cors from "cors";
import express from "express";
import { requestIdMiddleware, otelRequestSpanMiddleware, requireInternalToken, safeHandler, validateRequiredSecrets, createLogger } from "@hyperagent/backend-middleware";

const log = createLogger("deploy");
import { createDefaultBackend } from "./backends.js";

validateRequiredSecrets(["INTERNAL_SERVICE_TOKEN"], "deploy");

const INTERNAL_TOKEN = (process.env.INTERNAL_SERVICE_TOKEN || "").trim();

const app = express();
app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(requireInternalToken(INTERNAL_TOKEN));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function isValidBytecode(s: string): boolean {
  return typeof s === "string" && (s === "" || (s.startsWith("0x") && /^0x[0-9a-fA-F]+$/.test(s)));
}

const backend = createDefaultBackend();

app.post("/deploy", safeHandler("deploy", async (req, res) => {
  const { chainId, bytecode, abi, constructorArgs = [], contractName } = req.body;
  if (!chainId || !bytecode || !abi || !Array.isArray(abi)) {
    res.status(400).json({ error: "chainId, bytecode, and abi are required" });
    return;
  }
  if (!isValidBytecode(bytecode)) {
    res.status(400).json({ error: "bytecode must be hex string" });
    return;
  }
  if (!Array.isArray(constructorArgs)) {
    res.status(400).json({ error: "constructorArgs must be an array" });
    return;
  }
  const plan = await backend.getPlan({
    chainId,
    bytecode,
    abi,
    constructorArgs,
    contractName,
  });
  res.json(plan);
}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT) || 8003;
app.listen(port, "0.0.0.0", () => {
  log.info({ port }, "deploy service started");
});
