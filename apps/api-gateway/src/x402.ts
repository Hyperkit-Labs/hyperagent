/**
 * x402 payment gate for the HyperAgent API Gateway.
 *
 * Architecture:
 *   External agents → x402 challenge (402) → ERC-3009 proof → orchestrator verifies
 *                                                            → PayAI facilitator settles
 *   Internal Studio users (JWT) → skip x402 → credits system → orchestrator
 *
 * Only applies to priced endpoints listed in PRICED_ROUTES. Internal callers
 * identified by X-User-Id (set by authMiddleware after JWT validation) bypass
 * the x402 gate and use the credit system instead.
 */

import type { RoutesConfig } from "@x402/core/server";
import type { Request, Response, NextFunction } from "express";
import {
  SKALE_BASE_MAINNET_CAIP,
  X402_PRICED_PATHS,
} from "@hyperagent/api-contracts";
import { log } from "./logger.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MERCHANT_WALLET = (process.env.MERCHANT_WALLET_ADDRESS ?? "").trim();
const X402_PAY_TO_RAW = (process.env.X402_PAY_TO_ADDRESS ?? "").trim();
const X402_PAY_TO_ADDRESS = X402_PAY_TO_RAW || MERCHANT_WALLET;
const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://facilitator.payai.network";

const PRICED_ROUTES: Record<string, { price: string; network: string }> =
  X402_PRICED_PATHS;

function x402EnabledFromEnv(): boolean {
  const raw = (process.env.X402_ENABLED ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") {
    return false;
  }
  if (raw === "1" || raw === "true" || raw === "yes") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

const X402_ENABLED = !!X402_PAY_TO_ADDRESS && x402EnabledFromEnv();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePath(req: Request): string {
  return req.path.replace(/\/$/, "");
}

/**
 * Returns true if the caller is an internal Studio user (has a JWT-issued
 * X-User-Id set by authMiddleware). Internal callers use the credit system.
 */
function isInternalCaller(req: Request): boolean {
  const userId =
    (req.headers["x-user-id"] as string | undefined) ?? "";
  const internalToken =
    (req.headers["x-internal-token"] as string | undefined) ?? "";
  return !!(userId.trim() || internalToken.trim());
}

/**
 * Build a standard x402 v2 challenge body for the given path and price.
 * Matches the paymentRequirements format that @x402/fetch and official
 * x402 clients expect.
 */
function buildChallengeBody(
  path: string,
  price: string,
  network: string,
): Record<string, unknown> {
  const priceUsd = parseFloat(price.replace("$", ""));
  const amountMicro = String(Math.round(priceUsd * 1_000_000));

  return {
    error: "payment_required",
    code: "x402",
    erc1066_code: "0x54",
    action: "request_payment",
    message: `Endpoint requires payment: ${price} USD`,
    price_usd: priceUsd,
    settlement: "USDC on SKALE Base",
    paymentRequirements: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: amountMicro,
        resource: path,
        description: `HyperAgent API: ${path}`,
        mimeType: "application/json",
        payTo: X402_PAY_TO_ADDRESS,
        maxTimeoutSeconds: 300,
        asset: "USDC",
        outputSchema: null,
        extra: {
          name: "USD Coin (SKALE Base)",
          version: "2",
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Middleware — lazy-initialized via @x402/express paymentMiddlewareFromConfig
// ---------------------------------------------------------------------------

let _x402Middleware:
  | ((req: Request, res: Response, next: NextFunction) => void)
  | null = null;

async function buildX402Middleware(): Promise<
  (req: Request, res: Response, next: NextFunction) => void
> {
  try {
    const [{ paymentMiddlewareFromConfig }, { ExactEvmScheme }] =
      await Promise.all([
        import("@x402/express"),
        import("@x402/evm/exact/server"),
      ]);

    // ExactEvmScheme is used server-side by the x402ResourceServer to verify
    // ERC-3009 TransferWithAuthorization proofs without a signer (read-only).
    // The PayAI facilitator handles settlement after local verification.
    const routes = Object.fromEntries(
      Object.entries(PRICED_ROUTES).map(([path, cfg]) => [
        path,
        {
          accepts: {
            scheme: "exact",
            payTo: X402_PAY_TO_ADDRESS,
            price: cfg.price,
            network: cfg.network,
            maxTimeoutSeconds: 300,
          },
        },
      ]),
    ) as RoutesConfig;

    const mw = paymentMiddlewareFromConfig(
      routes,
      // facilitatorClients: empty — PayAI facilitator is called by the
      // Python orchestrator after receiving the forwarded X-Payment header.
      [],
      // schemes: register ExactEvmScheme for SKALE Base
      [{ network: SKALE_BASE_MAINNET_CAIP, server: new ExactEvmScheme() }],
      // paywallConfig (HTML paywall UI only; route payTo lives in `accepts`)
      {},
      // paywall: optional PayAI integration — set X402_FACILITATOR_URL
      undefined,
      // syncFacilitatorOnStart: false since no facilitator is wired here
      false,
    );

    log.info({ facilitatorUrl: X402_FACILITATOR_URL }, "[x402] gateway middleware initialized");
    return mw as unknown as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void;
  } catch (err) {
    log.warn(
      { err },
      "[x402] @x402/express initialization failed — using fallback challenge middleware",
    );
    return fallbackX402Middleware;
  }
}

/**
 * Fallback middleware: issues the 402 challenge manually without the
 * @x402/express package. Used when the package fails to initialize or
 * when ExactEvmScheme is unavailable.
 */
function fallbackX402Middleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const path = normalizePath(req);
  const routeConfig = PRICED_ROUTES[path];
  if (!routeConfig) return next();

  const paymentHeader =
    (req.headers["x-payment"] as string | undefined) ?? "";
  if (paymentHeader) {
    // Payment header present — let the orchestrator handle verification.
    return next();
  }

  const body = buildChallengeBody(path, routeConfig.price, routeConfig.network);
  res.setHeader("X-Payment-Required", "true");
  res.status(402).json(body);
}

// ---------------------------------------------------------------------------
// Exported middleware
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null;

/**
 * Gateway-level x402 payment enforcement.
 *
 * Flow for external agent requests:
 *   No X-Payment → 402 challenge with paymentRequirements
 *   X-Payment present → pass through to orchestrator (which verifies + settles
 *                        via PayAI facilitator in x402_middleware.py)
 *
 * Internal Studio users (identified by X-User-Id from JWT) bypass entirely.
 */
export function x402GatewayMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!X402_ENABLED) return next();

  // Skip x402 for internal callers — they use the credit system.
  if (isInternalCaller(req)) return next();

  const path = normalizePath(req);
  if (!PRICED_ROUTES[path]) return next();

  // Lazy-init the @x402/express middleware on first priced request.
  if (!_x402Middleware) {
    if (!_initPromise) {
      _initPromise = buildX402Middleware().then((mw) => {
        _x402Middleware = mw;
      });
    }
    // While initializing, use the fallback so we don't block.
    fallbackX402Middleware(req, res, next);
    return;
  }

  _x402Middleware(req, res, next);
}
