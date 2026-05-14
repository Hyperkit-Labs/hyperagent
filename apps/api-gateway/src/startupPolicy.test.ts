import { describe, expect, it } from "vitest";
import { getGatewayStartupFatalMisconfig } from "./startupPolicy.js";

describe("getGatewayStartupFatalMisconfig", () => {
  it("requires signed gateway identity in production", () => {
    const missing = getGatewayStartupFatalMisconfig(
      {
        isProduction: true,
        auth: { jwtSecret: "secret" },
        identityHmacSecret: "",
        internalServiceToken: "svc-token",
        billing: { x402EnabledForHints: false, merchantWallet: "" },
      } as never,
      { restRateLimitConfigured: true },
    );

    expect(missing).toContain(
      "IDENTITY_HMAC_SECRET is required for signed gateway identity",
    );
  });

  it("requires an internal service token in production", () => {
    const missing = getGatewayStartupFatalMisconfig(
      {
        isProduction: true,
        auth: { jwtSecret: "secret" },
        identityHmacSecret: "hmac",
        internalServiceToken: "",
        billing: { x402EnabledForHints: false, merchantWallet: "" },
      } as never,
      { restRateLimitConfigured: true },
    );

    expect(missing).toContain(
      "INTERNAL_SERVICE_TOKEN is required for gateway-to-orchestrator trust",
    );
  });

  it("allows development without production-only requirements", () => {
    const missing = getGatewayStartupFatalMisconfig(
      {
        isProduction: false,
        auth: { jwtSecret: "" },
        identityHmacSecret: "",
        internalServiceToken: "",
        billing: { x402EnabledForHints: false, merchantWallet: "" },
      } as never,
      { restRateLimitConfigured: false },
    );

    expect(missing).toEqual([]);
  });
});
