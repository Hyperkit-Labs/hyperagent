/**
 * BYOK (Bring Your Own Key) API endpoints.
 * POST /api/v1/byok/validate - validate an encrypted LLM key
 * POST /api/v1/byok/save - persist encrypted key to Supabase
 * DELETE /api/v1/byok/:provider - remove a stored key
 * GET /api/v1/byok/status - check which providers have keys stored
 */
import { Router, Request, Response } from "express";
import { getSupabaseAdmin } from "./authBootstrap.js";
import type { RequestWithUser } from "./auth.js";
import { log } from "./logger.js";
import { emitAuditEvent } from "./audit.js";

export type LLMProvider = "openai" | "anthropic" | "google";
const VALID_PROVIDERS = new Set<string>(["openai", "anthropic", "google"]);

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

function maskKey(raw: string): string {
  if (raw.length <= 8) return "****";
  return `${raw.slice(0, 5)}...${raw.slice(-4)}`;
}

export const byokRouter = Router();

byokRouter.post("/validate", async (req: Request, res: Response) => {
  const body = req.body as { provider?: string; encryptedKey?: unknown };
  if (!body.provider || !VALID_PROVIDERS.has(body.provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }
  if (!isValidEncryptedPayload(body.encryptedKey)) {
    res.status(400).json({ error: "Invalid encryptedKey payload" });
    return;
  }

  emitAuditEvent(req, "byok_key_validated", { provider: body.provider });

  res.status(200).json({
    valid: true,
    provider: body.provider,
    maskedKey: maskKey(body.encryptedKey.cipherText.slice(0, 20)),
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

  const providers = { openai: false, anthropic: false, google: false };
  for (const row of data ?? []) {
    const p = row.provider as LLMProvider;
    if (p in providers) providers[p] = true;
  }

  res.status(200).json({ providers });
});
