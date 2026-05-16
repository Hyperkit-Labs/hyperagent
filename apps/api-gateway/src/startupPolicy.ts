import type { GatewayEnv } from "@hyperagent/config";

export function getGatewayStartupFatalMisconfig(
  gw: GatewayEnv,
  opts: { restRateLimitConfigured: boolean },
): string[] {
  if (!gw.isProduction) return [];

  const missing: string[] = [];
  if (!opts.restRateLimitConfigured) {
    missing.push(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for rate limiting",
    );
  }
  if (!gw.auth.jwtSecret) {
    missing.push("AUTH_JWT_SECRET is required");
  }
  if (!gw.identityHmacSecret) {
    missing.push("IDENTITY_HMAC_SECRET is required for signed gateway identity");
  }
  if (!gw.internalServiceToken) {
    missing.push("INTERNAL_SERVICE_TOKEN is required for gateway-to-orchestrator trust");
  }
  if (gw.billing.x402EnabledForHints && !gw.billing.merchantWallet) {
    missing.push("MERCHANT_WALLET_ADDRESS is required when x402 hints are enabled");
  }
  return missing;
}
