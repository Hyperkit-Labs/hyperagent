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
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET;
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const JWT_EXPIRES_IN_SEC = Number(process.env.AUTH_JWT_EXPIRES_IN) || 86400;
const FREEMIUM_INITIAL_CREDITS = Number(process.env.FREEMIUM_INITIAL_CREDITS) || 100;

const DEBUG_LOG_PATH = path.join(process.cwd(), ".cursor", "debug.log");

function debugLog(location: string, message: string, data: Record<string, unknown>): void {
  try {
    const dir = path.dirname(DEBUG_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify({ location, message, data, timestamp: Date.now() }) + "\n");
  } catch {
    /* ignore */
  }
}

function isMissingTableError(msg: string | undefined, code?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    ((m.includes("relation") || m.includes("table")) && (m.includes("does not exist") || m.includes("doesn't exist"))) ||
    m.includes("wallet_users") ||
    code === "42P01"
  );
}

function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AuthBootstrapBody = {
  authMethod: "siwe" | "thirdweb_inapp";
  walletAddress?: string;
  siwePayload?: { message: string; signature: string };
  authToken?: string;
};

async function verifyThirdwebAuthToken(authToken: string): Promise<string | null> {
  if (!THIRDWEB_SECRET_KEY) return null;
  try {
    const res = await fetch("https://api.thirdweb.com/v1/wallets/me", {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "x-secret-key": THIRDWEB_SECRET_KEY,
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

async function bootstrapUser(
  supabase: SupabaseClient,
  walletAddress: string,
  authProvider: "siwe_eoa" | "thirdweb_inapp"
): Promise<{ userId: string } | { error: string; status: number }> {
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
    debugLog("authBootstrap:upsertError", "wallet_users upsert failed", { msg: error.message });
    if (isMissingTableError(error.message, (error as { code?: string }).code)) {
      return { error: "Database schema missing. Run Supabase migrations.", status: 503 };
    }
    return { error: "Internal Server Error", status: 500 };
  }

  if (!data?.id) {
    return { error: "Internal Server Error", status: 500 };
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
        p_initial_credits: FREEMIUM_INITIAL_CREDITS,
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
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body as AuthBootstrapBody;
  const authMethod = body?.authMethod;

  if (authMethod !== "siwe" && authMethod !== "thirdweb_inapp") {
    res.status(400).json({ error: "Bad Request", message: "authMethod must be 'siwe' or 'thirdweb_inapp'" });
    return;
  }

  if (!AUTH_JWT_SECRET) {
    res.status(503).json({ error: "Service Unavailable", message: "Auth not configured" });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: "Service Unavailable", message: "Supabase not configured" });
    return;
  }

  let walletAddress: string;
  let authProvider: "siwe_eoa" | "thirdweb_inapp";

  if (authMethod === "siwe") {
    const { message, signature } = body.siwePayload ?? {};
    if (typeof message !== "string" || typeof signature !== "string" || !message.trim() || !signature.trim()) {
      res.status(400).json({ error: "Bad Request", message: "siwePayload.message and siwePayload.signature are required" });
      return;
    }
    try {
      const siweMessage = new SiweMessage(message);
      const result = await siweMessage.verify({ signature });
      if (!result.success) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid signature" });
        return;
      }
      walletAddress = result.data.address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      res.status(401).json({ error: "Unauthorized", message: msg });
      return;
    }
    authProvider = "siwe_eoa";
  } else {
    const authToken = typeof body.authToken === "string" ? body.authToken.trim() : "";
    const walletAddressFromClient = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";

    if (!authToken) {
      res.status(400).json({ error: "Bad Request", message: "authToken is required for thirdweb_inapp" });
      return;
    }

    const verifiedAddress = await verifyThirdwebAuthToken(authToken);
    if (!verifiedAddress) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid or expired thirdweb auth token" });
      return;
    }

    if (walletAddressFromClient && walletAddressFromClient.toLowerCase() !== verifiedAddress) {
      res.status(401).json({ error: "Unauthorized", message: "Wallet address mismatch" });
      return;
    }

    walletAddress = verifiedAddress;
    authProvider = "thirdweb_inapp";
  }

  const result = await bootstrapUser(supabase, walletAddress, authProvider);

  if ("error" in result) {
    res.status(result.status).json({ error: "Service Unavailable", message: result.error });
    return;
  }

  const token = jwt.sign(
    { sub: result.userId, wallet_address: walletAddress.toLowerCase() },
    AUTH_JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN_SEC }
  );

  res.status(200).json({
    access_token: token,
    expires_in: JWT_EXPIRES_IN_SEC,
  });
}
