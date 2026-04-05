/**
 * BYOK (Bring Your Own Key) API endpoints.
 * POST /api/v1/byok/validate - proxy to orchestrator for live provider validation (api_key), or 422 for ciphertext-only
 * POST /api/v1/byok/save - persist encrypted key to Supabase (legacy user_byok_keys table)
 * DELETE /api/v1/byok/:provider - remove a stored key
 * GET /api/v1/byok/status - check which providers have keys stored
 */
import { Router, Request, Response } from "express";
import { getSupabaseAdmin } from "./authBootstrap.js";
import type { RequestWithUser } from "./auth.js";
import { log } from "./logger.js";
import { emitAuditEvent } from "./audit.js";
import { getGatewayEnv } from "@hyperagent/config";

export type LLMProvider = "openai" | "anthropic" | "google" | "together";
const VALID_PROVIDERS = new Set<string>(["openai", "anthropic", "google", "together"]);

interface EncryptedKeyPayload {
  cipherText: string;
  iv: string;
  salt: string;
  version: number;
}

function isValidEncryptedPayload(obj: unknown): obj is EncryptedKeyPayload {
  if (!obj || typeof obj !== "object") return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.cipherText === "string" && p.cipherText.length > 0 &&
    typeof p.iv === "string" && p.iv.length > 0 &&
    typeof p.salt === "string" && p.salt.length > 0 &&
    typeof p.version === "number" && Number.isInteger(p.version) && p.version > 0
  );
}

export const byokRouter = Router();

byokRouter.post("/validate", async (req: Request, res: Response) => {
  const user = (req as RequestWithUser).userId;
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "JWT required for BYOK validation" });
    return;
  }

  const body = req.body as {
    provider?: string;
    api_key?: string;
    encryptedKey?: unknown;
  };

  if (!body.provider || !VALID_PROVIDERS.has(body.provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }

  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (apiKey) {
    const base = getGatewayEnv().orchestratorUrl.replace(/\/$/, "");
    const url = `${base}/api/v1/workspaces/current/llm-keys/validate`;
    const auth = req.headers.authorization;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: auth } : {}),
          "x-user-id": user,
        },
        body: JSON.stringify({ provider: body.provider, api_key: apiKey }),
      });
      const text = await r.text();
      emitAuditEvent(req, "byok_key_validated", { provider: body.provider, mode: "live" });
      res.status(r.status);
      res.type("application/json").send(text);
      return;
    } catch (e) {
      log.error({ err: e instanceof Error ? e.message : String(e) }, "byok validate proxy failed");
      res.status(502).json({
        error: "Bad Gateway",
        message: "Orchestrator unavailable for key validation.",
      });
      return;
    }
  }

  if (isValidEncryptedPayload(body.encryptedKey)) {
    res.status(422).json({
      error: "encrypted_validation_not_supported",
      message:
        "Ciphertext-only validation is not supported. Send api_key for live validation, or use POST /api/v1/workspaces/current/llm-keys/validate from Studio.",
    });
    return;
  }

  res.status(400).json({
    error: "Invalid payload",
    message: "Provide api_key for live provider validation.",
  });
});

byokRouter.post("/save", async (req: Request, res: Response) => {
  const user = (req as RequestWithUser).userId;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as { provider?: string; encryptedKey?: unknown };
  if (!body.provider || !VALID_PROVIDERS.has(body.provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }
  if (!isValidEncryptedPayload(body.encryptedKey)) {
    res.status(400).json({ error: "Invalid encryptedKey payload" });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { error } = await supabase
    .from("user_byok_keys")
    .upsert(
      {
        user_id: user,
        provider: body.provider,
        key_cipher: body.encryptedKey.cipherText,
        key_iv: body.encryptedKey.iv,
        key_salt: body.encryptedKey.salt,
        key_version: body.encryptedKey.version,
        validated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );

  if (error) {
    log.error({ err: error.message }, "byok save failed");
    res.status(500).json({ error: "Failed to save key" });
    return;
  }

  emitAuditEvent(req, "byok_key_saved", { provider: body.provider });

  res.status(200).json({ success: true, validatedAt: new Date().toISOString() });
});

byokRouter.delete("/:provider", async (req: Request, res: Response) => {
  const user = (req as RequestWithUser).userId;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { provider } = req.params;
  if (!provider || !VALID_PROVIDERS.has(provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { error } = await supabase
    .from("user_byok_keys")
    .delete()
    .eq("user_id", user)
    .eq("provider", provider);

  if (error) {
    log.error({ err: error.message }, "byok delete failed");
    res.status(500).json({ error: "Failed to delete key" });
    return;
  }

  emitAuditEvent(req, "byok_key_deleted", { provider });

  res.status(200).json({ success: true });
});

byokRouter.get("/status", async (req: Request, res: Response) => {
  const user = (req as RequestWithUser).userId;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data, error } = await supabase
    .from("user_byok_keys")
    .select("provider")
    .eq("user_id", user);

  if (error) {
    log.error({ err: error.message }, "byok status failed");
    res.status(500).json({ error: "Failed to fetch status" });
    return;
  }

  const providers = { openai: false, anthropic: false, google: false, together: false };
  for (const row of data ?? []) {
    const p = row.provider as LLMProvider;
    if (p in providers) providers[p] = true;
  }

  res.status(200).json({ providers });
});
