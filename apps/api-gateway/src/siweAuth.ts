/**
 * Sign-In with Ethereum (SIWE): verify wallet signature, upsert public.wallet_users, return our JWT.
 * Public route: POST /api/v1/auth/siwe (no Authorization required).
 * Body: { message: string, signature: string }. Returns { access_token, expires_in }.
 * Supabase is used only as database (wallet_users); no Supabase Auth.
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
const JWT_EXPIRES_IN_SEC = Number(process.env.AUTH_JWT_EXPIRES_IN) || 86400; // 24h default

const SIWE_500_MESSAGE = "Sign-in failed. Check gateway logs for details.";

function isMissingTableError(msg: string | undefined, code?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  const tableMissing =
    (m.includes("relation") || m.includes("table")) && (m.includes("does not exist") || m.includes("doesn't exist") || m.includes("nonexistent")) ||
    m.includes("wallet_users") ||
    code === "42P01";
  return tableMissing;
}

const DEBUG_INGEST_URL = process.env.DEBUG_INGEST_URL || "";

const DEBUG_LOG_PATH = path.join(process.cwd(), ".cursor", "debug.log");

function debugLog(location: string, message: string, data: Record<string, unknown>, hypothesisId: string): void {
  const payload = { location, message, data, timestamp: Date.now(), hypothesisId };
  if (DEBUG_INGEST_URL) {
    fetch(DEBUG_INGEST_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  }
  try {
    const dir = path.dirname(DEBUG_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(payload) + "\n");
  } catch {
    // ignore
  }
}

function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function siweAuthHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body as { message?: string; signature?: string };
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";

  if (!message || !signature) {
    res.status(400).json({ error: "Bad Request", message: "message and signature are required" });
    return;
  }

  let address: string;
  try {
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({ signature });
    if (!result.success) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid signature" });
      return;
    }
    address = result.data.address;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    res.status(401).json({ error: "Unauthorized", message: msg });
    return;
  }

  // #region agent log
  debugLog("siweAuth.ts:entry", "SIWE handler after verify", {
    hasAuthJwtSecret: !!AUTH_JWT_SECRET,
    hasSupabaseUrl: !!SUPABASE_URL,
    hasSupabaseServiceKey: !!SUPABASE_SERVICE_KEY,
  }, "H1");
  // #endregion

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    debugLog("siweAuth.ts:supabase", "getSupabaseAdmin returned null", { supabaseIsNull: true }, "H2");
    res.status(503).json({ error: "Service Unavailable", message: "Supabase not configured" });
    return;
  }

  if (!AUTH_JWT_SECRET) {
    console.error("[SIWE] AUTH_JWT_SECRET not set");
    res.status(503).json({ error: "Service Unavailable", message: "Auth not configured" });
    return;
  }

  const walletAddress = address.toLowerCase();

  try {
    const { data: existing, error: selectError } = await supabase
      .from("wallet_users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (selectError) {
      // #region agent log
      const h3Data = { selectErrorMsg: selectError.message, code: (selectError as { code?: string }).code };
      debugLog("siweAuth.ts:selectError", "wallet_users select failed", h3Data, "H3");
      console.error("[SIWE_DEBUG]", JSON.stringify({ location: "selectError", ...h3Data }));
      // #endregion
      console.error("[SIWE] select wallet_users failed:", selectError.message);
      if (isMissingTableError(selectError.message, (selectError as { code?: string }).code)) {
        res.status(503).json({
          error: "Service Unavailable",
          message: "Database schema missing. Run Supabase migrations so the wallet_users table exists.",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error", message: SIWE_500_MESSAGE });
      return;
    }

    let userId: string;
    if (existing?.id) {
      userId = existing.id;
      await supabase
        .from("wallet_users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", userId);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("wallet_users")
        .insert({ wallet_address: walletAddress })
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        // #region agent log
        const h3Insert = { insertErrorMsg: insertError?.message, code: (insertError as { code?: string })?.code };
        debugLog("siweAuth.ts:insertError", "wallet_users insert failed", h3Insert, "H3");
        console.error("[SIWE_DEBUG]", JSON.stringify({ location: "insertError", ...h3Insert }));
        // #endregion
        console.error("[SIWE] insert wallet_users failed:", insertError?.message);
        if (insertError && isMissingTableError(insertError.message, (insertError as { code?: string }).code)) {
          res.status(503).json({
            error: "Service Unavailable",
            message: "Database schema missing. Run Supabase migrations so the wallet_users table exists (platform/supabase/migrations/run.sql).",
          });
          return;
        }
        res.status(500).json({ error: "Internal Server Error", message: SIWE_500_MESSAGE });
        return;
      }
      userId = inserted.id;
    }

    // #region agent log
    debugLog("siweAuth.ts:beforeSign", "about to jwt.sign", { hasUserId: !!userId }, "H4");
    // #endregion

    const expiresIn = JWT_EXPIRES_IN_SEC;
    const token = jwt.sign(
      {
        sub: userId,
        wallet_address: walletAddress,
      },
      AUTH_JWT_SECRET,
      { expiresIn }
    );

    // #region agent log
    debugLog("siweAuth.ts:afterSign", "jwt.sign success", { signSuccess: true }, "H4");
    // #endregion

    res.status(200).json({
      access_token: token,
      expires_in: expiresIn,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : "";
    // #region agent log
    const h5Data = { catchMsg: msg, catchName: errName };
    debugLog("siweAuth.ts:catch", "unexpected error", h5Data, "H5");
    console.error("[SIWE_DEBUG]", JSON.stringify({ location: "catch", ...h5Data }));
    // #endregion
    console.error("[SIWE] Unexpected error:", msg);
    res.status(500).json({ error: "Internal Server Error", message: SIWE_500_MESSAGE });
  }
}
