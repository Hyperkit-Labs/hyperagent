/**
 * HyperAgent Deploy Service
 * Deploy from the user's connected account. Plan from DeployBackend (chain registry or env).
 */

import cors from "cors";
import express from "express";
import { createDefaultBackend } from "./backends.js";

const REQUEST_ID_HEADER = "x-request-id";

function requestIdMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const id = (req.headers[REQUEST_ID_HEADER] as string)?.trim() || "";
  (req as express.Request & { requestId?: string }).requestId = id;
  if (id) {
    console.log(`[Deploy] requestId=${id} path=${req.path}`);
  }
  next();
}

const app = express();
app.use(requestIdMiddleware);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function isValidBytecode(s: string): boolean {
  return typeof s === "string" && (s === "" || (s.startsWith("0x") && /^0x[0-9a-fA-F]+$/.test(s)));
}

const backend = createDefaultBackend();

app.post("/deploy", async (req, res) => {
  try {
    const { chainId, bytecode, abi, constructorArgs = [], contractName } = req.body;
    if (!chainId || !bytecode || !abi || !Array.isArray(abi)) {
      return res.status(400).json({ error: "chainId, bytecode, and abi are required" });
    }
    if (!isValidBytecode(bytecode)) {
      return res.status(400).json({ error: "bytecode must be hex string" });
    }
    if (!Array.isArray(constructorArgs)) {
      return res.status(400).json({ error: "constructorArgs must be an array" });
    }
    const plan = await backend.getPlan({
      chainId,
      bytecode,
      abi,
      constructorArgs,
      contractName,
    });
    res.json(plan);
  } catch (e: unknown) {
    console.error("[Deploy]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Deploy failed" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT) || 8003;
app.listen(port, "0.0.0.0", () => {
  console.log(`[Deploy] listening on ${port}`);
});
