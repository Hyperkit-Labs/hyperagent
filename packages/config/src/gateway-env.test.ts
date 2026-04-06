import { describe, expect, it, beforeEach } from "vitest";
import { buildGatewayEnv, resetGatewayEnvForTests, getGatewayEnv } from "./gateway-env.js";
import { Env } from "./keys.js";

describe("buildGatewayEnv", () => {
  it("parses rate limit SIWE alias into bootstrap limits", () => {
    const e = {
      [Env.RATE_LIMIT_SIWE_MAX_IP]: "7",
      [Env.RATE_LIMIT_SIWE_WINDOW_SEC]: "120",
      [Env.NODE_ENV]: "development",
    } as NodeJS.ProcessEnv;
    const g = buildGatewayEnv(e);
    expect(g.rateLimits.bootstrapMaxIp).toBe(7);
    expect(g.rateLimits.bootstrapWindowSec).toBe(120);
  });

  it("metering enforced defaults to production only", () => {
    expect(buildGatewayEnv({ [Env.NODE_ENV]: "production" } as NodeJS.ProcessEnv).metering.enforced).toBe(
      true,
    );
    expect(buildGatewayEnv({ [Env.NODE_ENV]: "development" } as NodeJS.ProcessEnv).metering.enforced).toBe(
      false,
    );
    expect(
      buildGatewayEnv({
        [Env.NODE_ENV]: "development",
        [Env.METERING_ENFORCED]: "true",
      } as NodeJS.ProcessEnv).metering.enforced,
    ).toBe(true);
  });

  it("falls back to environment defaults when metering input is invalid", () => {
    expect(
      buildGatewayEnv({
        [Env.NODE_ENV]: "production",
        [Env.METERING_ENFORCED]: "maybe",
      } as NodeJS.ProcessEnv).metering.enforced,
    ).toBe(true);
    expect(
      buildGatewayEnv({
        [Env.NODE_ENV]: "development",
        [Env.METERING_ENFORCED]: "maybe",
      } as NodeJS.ProcessEnv).metering.enforced,
    ).toBe(false);
  });

  it("x402 hints only when explicitly enabled", () => {
    expect(
      buildGatewayEnv({ [Env.X402_ENABLED]: "true" } as NodeJS.ProcessEnv).billing.x402EnabledForHints,
    ).toBe(true);
    expect(
      buildGatewayEnv({ [Env.X402_ENABLED]: "false" } as NodeJS.ProcessEnv).billing.x402EnabledForHints,
    ).toBe(false);
    expect(buildGatewayEnv({} as NodeJS.ProcessEnv).billing.x402EnabledForHints).toBe(false);
  });

  it("x402 uses shared yes/no boolean semantics", () => {
    expect(
      buildGatewayEnv({ [Env.X402_ENABLED]: "yes" } as NodeJS.ProcessEnv).billing.x402EnabledForHints,
    ).toBe(true);
    expect(
      buildGatewayEnv({ [Env.X402_ENABLED]: "no" } as NodeJS.ProcessEnv).billing.x402EnabledForHints,
    ).toBe(false);
    expect(
      buildGatewayEnv({ [Env.X402_ENABLED]: "maybe" } as NodeJS.ProcessEnv).billing.x402EnabledForHints,
    ).toBe(false);
  });

  it("requires auth unless development explicitly sets literal false", () => {
    expect(
      buildGatewayEnv({
        [Env.NODE_ENV]: "development",
        [Env.REQUIRE_AUTH]: "false",
      } as NodeJS.ProcessEnv).auth.requireAuth,
    ).toBe(false);
    expect(
      buildGatewayEnv({
        [Env.NODE_ENV]: "development",
        [Env.REQUIRE_AUTH]: "FALSE",
      } as NodeJS.ProcessEnv).auth.requireAuth,
    ).toBe(true);
    expect(
      buildGatewayEnv({
        [Env.NODE_ENV]: "production",
        [Env.REQUIRE_AUTH]: "false",
      } as NodeJS.ProcessEnv).auth.requireAuth,
    ).toBe(true);
  });

  it("parses RATE_LIMIT_BYPASS_ON_FAIL with shared boolean semantics", () => {
    const base = { [Env.NODE_ENV]: "development" } as NodeJS.ProcessEnv;
    expect(
      buildGatewayEnv({ ...base, [Env.RATE_LIMIT_BYPASS_ON_FAIL]: "true" } as NodeJS.ProcessEnv).rateLimits
        .bypassOnFail,
    ).toBe(true);
    expect(
      buildGatewayEnv({ ...base, [Env.RATE_LIMIT_BYPASS_ON_FAIL]: "yes" } as NodeJS.ProcessEnv).rateLimits
        .bypassOnFail,
    ).toBe(true);
    expect(
      buildGatewayEnv({ ...base, [Env.RATE_LIMIT_BYPASS_ON_FAIL]: "false" } as NodeJS.ProcessEnv).rateLimits
        .bypassOnFail,
    ).toBe(false);
    expect(buildGatewayEnv(base).rateLimits.bypassOnFail).toBe(false);
  });
});

describe("getGatewayEnv singleton", () => {
  beforeEach(() => {
    resetGatewayEnvForTests();
  });

  it("returns frozen config", () => {
    const a = getGatewayEnv();
    const b = getGatewayEnv();
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });
});
