/**
 * Credit preflight and HTTP 402 when user_credits are insufficient.
 * Reuses the same env as the rest of the stack: MERCHANT_WALLET_ADDRESS + X402_ENABLED
 * (orchestrator x402 middleware, Payments UI, Thirdweb). No duplicate x402 env namespace.
 * Optional payment hints on 402 only when X402 is enabled and a merchant address exists.
 */
import type { Request, Response, NextFunction } from "express";
import { getGatewayEnv } from "@hyperagent/config";
import { getSupabaseAdmin } from "./authBootstrap.js";
import type { RequestWithUser } from "./auth.js";
import { log } from "./logger.js";

/** When true (default in production), require positive user_credits balance for non-exempt routes. */
export function isMeteringEnforced(): boolean {
  return getGatewayEnv().metering.enforced;
}

function normalizePath(input: string): string {
  const noQuery = (input || "").split("?")[0];
  const collapsed = noQuery.replace(/\/+/g, "/");
  const trimmed = collapsed !== "/" ? collapsed.replace(/\/$/, "") : collapsed;
  return trimmed || "/";
}

const EXEMPT_PREFIXES = [
  "/api/v1/credits",
  "/api/v1/payments",
  "/api/v1/pricing",
  "/api/v1/byok",
  "/api/v1/config",
  "/api/v1/networks",
  "/api/v1/tokens/stablecoins",
  "/api/v1/platform/track-record",
  "/api/v1/identity",
  "/api/v1/health",
  "/api/v1/workspaces/current/llm-keys",
  "/api/v1/storage/webhooks",
];

/**
 * Exported for unit tests. True when this request should not consume credit preflight.
 */
export function isMeteringExemptPath(path: string, method: string): boolean {
  if (method === "OPTIONS") return true;
  const p = normalizePath(path);
  for (const prefix of EXEMPT_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/** Absolute URL for x402 resource (no PUBLIC_API_BASE_URL — use forwarded host behind proxies). */
function absoluteRequestUrl(req: Request, pathOnly: string): string {
  const rawProto = req.get("x-forwarded-proto") || req.protocol || "https";
  const proto = rawProto.split(",")[0].trim();
  const rawHost = req.get("x-forwarded-host") || req.get("host") || "";
  const host = rawHost.split(",")[0].trim();
  if (!host) return pathOnly;
  return `${proto}://${host}${pathOnly}`;
}

/** Minimum amount hint for clients that expect maxAmountRequired (USDC 6 decimals; adjust in Payments if needed). */
const DEFAULT_TOPUP_BASE_UNITS = "1000000";

function buildInsufficientCreditsPayload(opts: {
  req: Request;
  path: string;
  balance: number;
  currency: string;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    error: "payment_required",
    code: "INSUFFICIENT_CREDITS",
    message:
      "Add credits in Payments, or complete an on-chain payment if x402 is enabled for this deployment.",
    balance: opts.balance,
    currency: opts.currency,
  };

  const billing = getGatewayEnv().billing;
  const payTo = billing.merchantWallet || undefined;
  const attachHints = billing.x402EnabledForHints && Boolean(payTo);

  if (!attachHints) {
    return base;
  }

  const resource = absoluteRequestUrl(opts.req, opts.path);
  const paymentRequirements: Record<string, string> = {
    scheme: "exact",
    maxAmountRequired: DEFAULT_TOPUP_BASE_UNITS,
    payTo: payTo!,
    resource,
    description: "Insufficient credits. Top up credits or pay via x402, then retry.",
  };

  base.paymentRequirements = paymentRequirements;
  base.x402 = {
    payTo,
    maxAmountRequired: DEFAULT_TOPUP_BASE_UNITS,
    resource,
  };

  return base;
}

async function fetchBalance(userId: string): Promise<{
  ok: boolean;
  balance: number;
  currency: string;
  error?: string;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, balance: 0, currency: "USD", error: "no_db" };
  }
  try {
    const r = await supabase
      .from("user_credits")
      .select("balance, currency")
      .eq("user_id", userId)
      .maybeSingle();
    if (r.error) {
      log.warn({ err: r.error.message, userId: userId.slice(0, 8) }, "metering balance query");
      return { ok: false, balance: 0, currency: "USD", error: r.error.message };
    }
    const row = r.data as { balance?: unknown; currency?: string } | null;
    if (!row) {
      return { ok: true, balance: 0, currency: "USD" };
    }
    let bal = row.balance;
    if (bal != null && typeof bal !== "number") {
      bal = parseFloat(String(bal));
    }
    const balance = typeof bal === "number" && Number.isFinite(bal) ? bal : 0;
    return {
      ok: true,
      balance,
      currency: (row.currency as string) || "USD",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn({ err: msg }, "metering balance exception");
    return { ok: false, balance: 0, currency: "USD", error: msg };
  }
}

export async function meteringMiddleware(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isMeteringEnforced()) {
      next();
      return;
    }

    const method = (req.method || "GET").toUpperCase();
    const path =
      normalizePath(req.originalUrl || "") ||
      normalizePath(req.path || "") ||
      normalizePath((req.baseUrl || "") + (req.path || ""));

    if (isMeteringExemptPath(path, method)) {
      next();
      return;
    }

    const userId = req.userId;
    if (!userId) {
      next();
      return;
    }

    const minBal = getGatewayEnv().metering.minBalance;
    const result = await fetchBalance(userId);

    if (!result.ok) {
      log.warn(
        { path, requestId: (req as { requestId?: string }).requestId },
        "metering fail-closed: balance unavailable",
      );
      res.status(503).json({
        error: "Service Unavailable",
        code: "METERING_UNAVAILABLE",
        message: "Could not verify credit balance. Retry shortly.",
      });
      return;
    }

    if (result.balance > minBal) {
      next();
      return;
    }

    const body = buildInsufficientCreditsPayload({
      req,
      path,
      balance: result.balance,
      currency: result.currency,
    });

    const pr = body.paymentRequirements as Record<string, string> | undefined;
    if (pr && Object.keys(pr).length > 0) {
      try {
        res.setHeader("x-payment", JSON.stringify(pr));
      } catch {
        /* ignore */
      }
    }

    res.status(402).json(body);
  } catch (e) {
    log.error(
      { err: e instanceof Error ? e.message : String(e) },
      "metering middleware error",
    );
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error", code: "METERING_ERROR" });
    }
  }
}
