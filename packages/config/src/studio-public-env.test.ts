import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  applyDevelopmentLocalGatewayRule,
  buildStudioConnectSrcDirective,
  getEffectiveNextPublicApiUrl,
  normalizeToBackendApiV1,
  resolveStudioBackendApiV1FromEnv,
  assertValidStudioPublicApiUrlIfPresent,
  resetStudioPublicEnvDevWarningsForTests,
  STUDIO_LOCAL_GATEWAY_API_V1,
} from "./studio-public-env.js";
import { Env } from "./keys.js";

describe("getEffectiveNextPublicApiUrl", () => {
  it("uses explicit NEXT_PUBLIC_API_URL when set", () => {
    expect(
      getEffectiveNextPublicApiUrl({
        [Env.NEXT_PUBLIC_API_URL]: "https://api.example.com",
        NODE_ENV: "development",
      }),
    ).toBe("https://api.example.com");
  });

  it("falls back to localhost:4000 in non-production when unset", () => {
    expect(
      getEffectiveNextPublicApiUrl({
        NODE_ENV: "development",
      }),
    ).toBe("http://localhost:4000");
  });

  it("returns empty in production when unset", () => {
    expect(
      getEffectiveNextPublicApiUrl({
        NODE_ENV: "production",
      }),
    ).toBe("");
  });
});

describe("normalizeToBackendApiV1", () => {
  it("appends /api/v1 when missing", () => {
    expect(normalizeToBackendApiV1("http://localhost:4000")).toBe(
      "http://localhost:4000/api/v1",
    );
  });

  it("preserves when already /api/v1", () => {
    expect(normalizeToBackendApiV1("http://localhost:4000/api/v1")).toBe(
      "http://localhost:4000/api/v1",
    );
  });
});

describe("applyDevelopmentLocalGatewayRule", () => {
  beforeEach(() => {
    resetStudioPublicEnvDevWarningsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rewrites remote URL in development unless NEXT_PUBLIC_ENV is staging", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const resolved = applyDevelopmentLocalGatewayRule(
      { NODE_ENV: "development", [Env.NEXT_PUBLIC_ENV]: "development" },
      "https://api.hyperkitlabs.com/api/v1",
    );
    expect(resolved).toBe(STUDIO_LOCAL_GATEWAY_API_V1);
  });

  it("warns at most once when development rewrites a non-loopback API repeatedly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dev = {
      NODE_ENV: "development" as const,
      [Env.NEXT_PUBLIC_ENV]: "development",
    };
    applyDevelopmentLocalGatewayRule(dev, "https://api.one.com/api/v1");
    applyDevelopmentLocalGatewayRule(dev, "https://api.two.com/api/v1");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps remote URL when NEXT_PUBLIC_ENV is staging", () => {
    const url = "https://api.staging.example.com/api/v1";
    expect(
      applyDevelopmentLocalGatewayRule(
        { NODE_ENV: "development", [Env.NEXT_PUBLIC_ENV]: "staging" },
        url,
      ),
    ).toBe(url);
  });

  it("does not rewrite in production", () => {
    const url = "https://api.hyperkitlabs.com/api/v1";
    expect(
      applyDevelopmentLocalGatewayRule({ NODE_ENV: "production" }, url),
    ).toBe(url);
  });
});

describe("resolveStudioBackendApiV1FromEnv", () => {
  it("throws in production when URL missing", () => {
    expect(() =>
      resolveStudioBackendApiV1FromEnv({ NODE_ENV: "production" }),
    ).toThrow(Env.NEXT_PUBLIC_API_URL);
  });

  it("resolves dev default to local gateway api v1", () => {
    expect(resolveStudioBackendApiV1FromEnv({ NODE_ENV: "development" })).toBe(
      STUDIO_LOCAL_GATEWAY_API_V1,
    );
  });
});

describe("buildStudioConnectSrcDirective", () => {
  it("includes loopback, Datadog RUM intakes, and thirdweb hosts", () => {
    const csp = buildStudioConnectSrcDirective({
      NODE_ENV: "development",
      [Env.NEXT_PUBLIC_API_URL]: "http://localhost:4000",
    });
    expect(csp).toContain("'self'");
    expect(csp).toContain("http://localhost:4000");
    expect(csp).toContain("https://*.datadoghq.com");
    expect(csp).toContain("https://*.thirdweb.com");
  });

  it("does not throw when resolve would throw; falls back to local gateway for CSP", () => {
    const csp = buildStudioConnectSrcDirective({
      NODE_ENV: "production",
    });
    expect(csp).toContain("'self'");
    expect(csp).toContain("http://localhost:4000");
    expect(csp).toContain("https://*.thirdweb.com");
  });
});

describe("assertValidStudioPublicApiUrlIfPresent", () => {
  it("throws on invalid URL", () => {
    expect(() =>
      assertValidStudioPublicApiUrlIfPresent({
        [Env.NEXT_PUBLIC_API_URL]: "not a url !!!",
      }),
    ).toThrow("Invalid");
  });

  it("passes when unset", () => {
    expect(() => assertValidStudioPublicApiUrlIfPresent({})).not.toThrow();
  });
});
