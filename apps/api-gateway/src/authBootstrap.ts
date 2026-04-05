/**
 * Unified auth bootstrap: SIWE and thirdweb OAuth/in-app wallet.
 * Single session-creation endpoint. Both lanes upsert wallet_users, provision credits/spending,
 * then issue HyperAgent session JWT. wallet_users.id is the only application principal.
 * POST /api/v1/auth/bootstrap (public, no Authorization required).
 */
import { Request, Response } from "express";
import { SiweMessage } from "siwe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { getGatewayEnv } from "@hyperagent/config";
import { log } from "./logger.js";
import { emitAuditEvent } from "./audit.js";

function redactDebugData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") {
      if (v.startsWith("eyJ")) out[k] = "[jwt-redacted]";
      else if (/^0x[0-9a-f]{20,}$/i.test(v)) out[k] = `${v.slice(0, 10)}…[redacted]`;
      else if (v.length > 120) out[k] = `${v.slice(0, 40)}…[len=${v.length}]`;
      else out[k] = v;
    } else out[k] = v;
  }
  return out;
}

function debugLog(location: string, message: string, data: Record<string, unknown>): void {
  if (!getGatewayEnv().bootstrap.enableDebugLog) return;
  try {
    log.debug({ location, data: redactDebugData(data) }, message);
  } catch {
    /* ignore */
  }
}

/** True only for undefined table/relation (Postgres 42P01). Do not match on substring "wallet_users": RLS and permission errors mention that table but are not missing-schema. */
export function isMissingTableError(msg: string | undefined, code?: string): boolean {
  if (code === "42P01") return true;
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    (m.includes("relation") || m.includes("table")) &&
    (m.includes("does not exist") || m.includes("doesn't exist"))
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const { supabase } = getGatewayEnv();
  if (!supabase.url || !supabase.serviceKey) return null;
  return createClient(supabase.url, supabase.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AuthBootstrapBody = {
  authMethod: "siwe" | "thirdweb_inapp";
  walletAddress?: string;
  siwePayload?: { message: string; signature: string };
  authToken?: string;
};

/** EIP-191 personal_sign output: 65 bytes (r+s+v) = 130 hex digits, optional 0x prefix. */
export function isValidEip191SignatureHex(signature: string): boolean {
  const t = signature.trim();
  const hex = t.startsWith("0x") || t.startsWith("0X") ? t.slice(2) : t;
  return /^[0-9a-fA-F]{130}$/.test(hex);
}

async function verifyThirdwebAuthToken(authToken: string): Promise<string | null> {
  const secret = getGatewayEnv().bootstrap.thirdwebSecretKey;
  if (!secret) return null;
  try {
    const res = await fetch("https://api.thirdweb.com/v1/wallets/me", {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "x-secret-key": secret,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { address?: string } };
    const addr = data?.result?.address;
    return typeof addr === "string" ? addr.toLowerCase() : null;
  } catch {
    return null;
  }
}

type BootstrapUserResult =
  | { userId: string }
  | { error: string; status: number; code?: string };

async function bootstrapUser(
  supabase: SupabaseClient,
  walletAddress: string,
  authProvider: "siwe_eoa" | "thirdweb_inapp"
): Promise<BootstrapUserResult> {
  const walletAddressNorm = walletAddress.toLowerCase();

  const { data, error } = await supabase
    .from("wallet_users")
    .upsert(
      {
        wallet_address: walletAddressNorm,
        auth_method: authProvider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" }
    )
    .select("id")
    .single();

  if (error) {
    const pgCode = (error as { code?: string }).code;
    debugLog("authBootstrap:upsertError", "wallet_users upsert failed", {
      msg: error.message,
      code: pgCode,
    });
    log.error({ msg: error.message, code: pgCode, hint: (error as { hint?: string }).hint }, "wallet_users upsert failed");
    if (isMissingTableError(error.message, pgCode)) {
      return {
        error: "Database schema missing. Run Supabase migrations for wallet_users.",
        status: 503,
        code: "SCHEMA_MISSING",
      };
    }
    return {
      error: "Sign-in could not be completed. Please try again later.",
      status: 500,
      code: "WALLET_UPSERT_FAILED",
    };
  }

  if (!data?.id) {
    log.error("wallet_users upsert returned no id (empty row)");
    return {
      error: "Sign-in could not be completed. Check gateway logs for database errors.",
      status: 500,
      code: "WALLET_UPSERT_NO_ID",
    };
  }

  await ensureWalletUserProvisioned(supabase, data.id);
  return { userId: data.id };
}

/** Idempotent provisioning: credits, spending_controls, wallet_user_profiles. Non-fatal on RPC/table errors. */
async function ensureWalletUserProvisioned(supabase: SupabaseClient, userId: string): Promise<void> {
  const run = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
    } catch (e) {
      debugLog("authBootstrap:ensureProvisioned", `${label} failed (non-fatal)`, {
        msg: e instanceof Error ? e.message : String(e),
      });
    }
  };
  await run(
    async () => {
      await supabase.rpc("bootstrap_user_credits", {
        p_user_id: userId,
        p_initial_credits: getGatewayEnv().bootstrap.freemiumInitialCredits,
      });
    },
    "bootstrap_user_credits"
  );
  await run(
    async () => {
      await supabase.rpc("upsert_spending_control", {
        p_user_id: userId,
        p_budget_amount: 0,
        p_budget_currency: "USD",
        p_period: "monthly",
        p_alert_threshold_percent: 80,
      });
    },
    "upsert_spending_control"
  );
  await run(
    async () => {
      await supabase.from("wallet_user_profiles").upsert(
        { wallet_user_id: userId },
        { onConflict: "wallet_user_id" }
      );
    },
    "wallet_user_profiles"
  );
}

export async function authBootstrapHandler(req: Request, res: Response): Promise<void> {
  // #region agent log
  debugLog("authBootstrap.ts:handler-entry", "bootstrap handler entered", { method: req.method, path: req.path, hasBody: !!req.body, bodyKeys: req.body ? Object.keys(req.body) : [], hypothesisId: "H1" });
  // #endregion
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" });
    return;
  }

  const body = req.body as AuthBootstrapBody;
  const authMethod = body?.authMethod;

  if (authMethod !== "siwe" && authMethod !== "thirdweb_inapp") {
    // #region agent log
    debugLog("authBootstrap.ts:bad-auth-method", "rejected: bad authMethod", { authMethod, hypothesisId: "H1" });
    // #endregion
    res.status(400).json({
      error: "Bad Request",
      code: "INVALID_AUTH_METHOD",
      message: "authMethod must be 'siwe' or 'thirdweb_inapp'",
    });
    return;
  }

  const jwtSecret = getGatewayEnv().auth.jwtSecret;
  // #region agent log
  debugLog("authBootstrap.ts:jwt-secret-check", "AUTH_JWT_SECRET availability", {
    secretSet: typeof jwtSecret === "string" ? "SET(" + jwtSecret.length + "chars)" : "UNSET",
    hypothesisId: "H1",
  });
  // #endregion
  if (!jwtSecret) {
    // #region agent log
    debugLog("authBootstrap.ts:503-auth-not-configured", "EXIT 503: Auth not configured", {
      hypothesisId: "H1",
    });
    // #endregion
    res.status(503).json({
      error: "Service Unavailable",
      code: "AUTH_NOT_CONFIGURED",
      message: "Auth not configured",
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // #region agent log
    debugLog("authBootstrap.ts:503-supabase-not-configured", "EXIT 503: Supabase not configured", {
      hypothesisId: "H3",
    });
    // #endregion
    res.status(503).json({
      error: "Service Unavailable",
      code: "SUPABASE_NOT_CONFIGURED",
      message: "Supabase not configured",
    });
    return;
  }

  let walletAddress: string;
  let authProvider: "siwe_eoa" | "thirdweb_inapp";

  if (authMethod === "siwe") {
    const { message, signature } = body.siwePayload ?? {};
    if (typeof message !== "string" || typeof signature !== "string" || !message.trim() || !signature.trim()) {
      res.status(400).json({
        error: "Bad Request",
        code: "SIWE_PAYLOAD_REQUIRED",
        message: "siwePayload.message and siwePayload.signature are required",
      });
      return;
    }
    const sigTrim = signature.trim();
    if (!isValidEip191SignatureHex(sigTrim)) {
      debugLog("authBootstrap.ts:siwe-invalid-sig-format", "rejected: signature not 65-byte hex", { hexLen: sigTrim.length, hypothesisId: "H2" });
      res.status(400).json({
        error: "Bad Request",
        code: "SIWE_SIGNATURE_INVALID_FORMAT",
        message:
          "Invalid signature format. Expected EIP-191 personal_sign output: 0x plus 130 hexadecimal characters (65 bytes).",
      });
      return;
    }
    try {
      const siweMessage = new SiweMessage(message);
      // #region agent log
      debugLog("authBootstrap.ts:siwe-pre-verify", "SIWE verify about to run", { domain: siweMessage.domain, chainId: siweMessage.chainId, address: siweMessage.address, nonce: siweMessage.nonce, issuedAt: siweMessage.issuedAt, uri: siweMessage.uri, hypothesisId: "H2" });
      // #endregion
      const result = await siweMessage.verify({ signature: sigTrim });
      // #region agent log
      debugLog("authBootstrap.ts:siwe-post-verify", "SIWE verify completed", { success: result.success, address: result.data?.address, error: result.error ? { type: String(result.error.type), expected: String((result.error as unknown as Record<string, unknown>).expected ?? ""), received: String((result.error as unknown as Record<string, unknown>).received ?? "") } : null, hypothesisId: "H2" });
      // #endregion
      if (!result.success) {
        emitAuditEvent(req, "auth_bootstrap_failure", { reason: "invalid_signature" });
        res.status(401).json({ error: "Unauthorized", code: "INVALID_SIGNATURE", message: "Invalid signature" });
        return;
      }
      const verified = result.data?.address;
      if (typeof verified !== "string" || !verified.trim()) {
        emitAuditEvent(req, "auth_bootstrap_failure", { reason: "missing_address_after_verify" });
        res.status(401).json({
          error: "Unauthorized",
          code: "INVALID_SIGNATURE",
          message: "SIWE verification did not return a wallet address",
        });
        return;
      }
      walletAddress = verified;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      // #region agent log
      debugLog("authBootstrap.ts:siwe-verify-exception", "SIWE verify threw exception", { errorMessage: msg, errorName: err instanceof Error ? err.name : "unknown", errorStack: err instanceof Error ? err.stack?.slice(0, 300) ?? "" : "", hypothesisId: "H2" });
      // #endregion
      emitAuditEvent(req, "auth_bootstrap_failure", { reason: "verify_exception", message: msg });
      res.status(401).json({ error: "Unauthorized", code: "INVALID_SIGNATURE", message: msg });
      return;
    }
    authProvider = "siwe_eoa";
  } else {
    const authToken = typeof body.authToken === "string" ? body.authToken.trim() : "";
    const walletAddressFromClient = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";

    if (!authToken) {
      res.status(400).json({
        error: "Bad Request",
        code: "THIRDWEB_TOKEN_REQUIRED",
        message: "authToken is required for thirdweb_inapp",
      });
      return;
    }

    const verifiedAddress = await verifyThirdwebAuthToken(authToken);
    if (!verifiedAddress) {
      res.status(401).json({
        error: "Unauthorized",
        code: "THIRDWEB_TOKEN_INVALID",
        message: "Invalid or expired thirdweb auth token",
      });
      return;
    }

    if (walletAddressFromClient && walletAddressFromClient.toLowerCase() !== verifiedAddress) {
      res.status(401).json({
        error: "Unauthorized",
        code: "WALLET_ADDRESS_MISMATCH",
        message: "Wallet address mismatch",
      });
      return;
    }

    walletAddress = verifiedAddress;
    authProvider = "thirdweb_inapp";
  }

  // #region agent log
  debugLog("authBootstrap.ts:pre-bootstrapUser", "calling bootstrapUser", { walletAddress, authProvider, hypothesisId: "H3" });
  // #endregion
  const result = await bootstrapUser(supabase, walletAddress, authProvider);

  if ("error" in result) {
    const status = result.status;
    const errorTitle =
      status === 503 ? "Service Unavailable" : status >= 400 && status < 500 ? "Bad Request" : "Internal Server Error";
    // #region agent log
    debugLog("authBootstrap.ts:bootstrapUser-error", "bootstrapUser returned error", { status, errorTitle, error: result.error, code: result.code, hypothesisId: "H3" });
    // #endregion
    res.status(status).json({
      error: errorTitle,
      message: result.error,
      ...(result.code ? { code: result.code } : {}),
    });
    return;
  }

  if (!result.userId) {
    res.status(500).json({
      error: "Internal Server Error",
      code: "WALLET_RECORD_FAILED",
      message: "Critical: Failed to record wallet user in DB",
    });
    return;
  }

  // #region agent log
  const expSec = getGatewayEnv().bootstrap.jwtExpiresInSec;
  debugLog("authBootstrap.ts:jwt-sign-success", "issuing JWT, bootstrap success", {
    userId: result.userId,
    walletAddress: walletAddress.toLowerCase(),
    expiresIn: expSec,
    hypothesisId: "H1",
  });
  // #endregion
  const jti = `${result.userId}-${Date.now().toString(36)}`;
  const token = jwt.sign(
    { sub: result.userId, wallet_address: walletAddress.toLowerCase(), jti },
    jwtSecret,
    { expiresIn: expSec }
  );

  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  const cookieFlags = [
    `rt=${token}`,
    "Path=/",
    "HttpOnly",
    isSecure ? "Secure" : "",
    "SameSite=Strict",
    `Max-Age=${expSec}`,
  ].filter(Boolean).join("; ");
  res.setHeader("Set-Cookie", cookieFlags);

  emitAuditEvent(req, "auth_bootstrap_success", { wallet: walletAddress.toLowerCase() });

  res.status(200).json({
    access_token: token,
    expires_in: expSec,
  });
}
