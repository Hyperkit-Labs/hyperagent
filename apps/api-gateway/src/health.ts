import type { Request, Response } from "express";
import { getGatewayEnv } from "@hyperagent/config";
import { getSupabaseAdmin } from "./authBootstrap.js";
import { log } from "./logger.js";

export function healthHandler(orchestratorUrl: string) {
  return async (_req: Request, res: Response): Promise<void> => {
    const gw = getGatewayEnv();
    const authJwtConfigured = Boolean(gw.auth.jwtSecret);
    const thirdwebSecretConfigured = Boolean(gw.bootstrap.thirdwebSecretKey);
    const supabase = getSupabaseAdmin();
    let dbOk = false;
    let dbError: string | null = null;
    if (supabase) {
      const dbCheck = await supabase.from("wallet_users").select("id").limit(1);
      dbError = dbCheck.error ? (dbCheck.error as { message?: string }).message ?? String(dbCheck.error) : null;
      dbOk = !dbCheck.error;
    } else {
      dbError = "Supabase not configured";
    }

    const authSigninReady = authJwtConfigured && Boolean(supabase) && dbOk;
    const orchBase = orchestratorUrl.replace(/\/$/, "");

    let orchestratorOk = false;
    let orchestratorReachable = false;

    if (authSigninReady) {
      async function fetchOrch(path: string, ms: number): Promise<globalThis.Response | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ms);
        try {
          const r = await fetch(`${orchBase}${path}`, { signal: controller.signal });
          clearTimeout(timeout);
          return r;
        } catch {
          clearTimeout(timeout);
          return null;
        }
      }

      const [rLive, rHealth] = await Promise.all([
        fetchOrch("/health/live", 2000),
        fetchOrch("/health", 3000),
      ]);

      orchestratorOk = rHealth !== null && rHealth.ok;
      orchestratorReachable = (rLive !== null && rLive.ok) || rHealth !== null;
    }

    const pipeline_ready = authSigninReady && orchestratorReachable && orchestratorOk;

    const basePayload = {
      gateway: true,
      orchestrator_ok: orchestratorOk,
      orchestrator_reachable: orchestratorReachable,
      auth_jwt_configured: authJwtConfigured,
      thirdweb_secret_configured: thirdwebSecretConfigured,
      in_app_wallet_signin_ready: thirdwebSecretConfigured,
      supabase_configured: Boolean(supabase),
      db_connected: dbOk,
      db_error: dbError,
      auth_signin_ready: authSigninReady,
      pipeline_ready,
    };

    if (!authSigninReady) {
      let msg: string;
      if (!authJwtConfigured) {
        msg = "Auth not configured (AUTH_JWT_SECRET missing). Sign-in unavailable.";
      } else if (!supabase) {
        msg = "Supabase not configured. Sign-in unavailable.";
      } else if (!dbOk) {
        msg = `Database unreachable. ${dbError ?? "Check Supabase credentials and migrations."}`;
      } else {
        msg = "Sign-in not ready.";
      }
      log.warn({
        msg: "health degraded: auth not ready",
        auth_jwt_configured: authJwtConfigured,
        supabase_configured: Boolean(supabase),
        db_connected: dbOk,
        db_error: dbError,
      });
      res.status(503).json({ status: "degraded", ...basePayload, message: msg });
      return;
    }

    const overallStatus = orchestratorOk ? "ok" : "degraded";
    let message: string | undefined;
    if (!orchestratorReachable) {
      message =
        "Orchestrator unreachable (no response from /health or /health/live). Check ORCHESTRATOR_URL and that the orchestrator service is running. Workflows will fail until it is reachable.";
    } else if (!orchestratorOk) {
      message =
        "Orchestrator is reachable but GET /health is not OK (often Redis, Supabase, or queue config on the orchestrator). Sign-in works; pipeline runs may fail until orchestrator /health is healthy.";
    }

    if (!pipeline_ready) {
      res.status(503).json({
        status: overallStatus,
        ...basePayload,
        ...(message ? { message } : {}),
      });
      return;
    }

    res.status(200).json({
      status: "ok",
      ...basePayload,
    });
  };
}
