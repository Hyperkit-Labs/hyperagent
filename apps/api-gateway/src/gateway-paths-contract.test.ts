import { describe, expect, it } from "vitest";
import {
  ApiPaths,
  GATEWAY_PUBLIC_PATHS,
  METERING_EXEMPT_PREFIXES,
  X402_PRICED_PATHS,
} from "@hyperagent/api-contracts";

describe("gateway ↔ api-paths contract", () => {
  it("public paths cover bootstrap config and health", () => {
    expect(GATEWAY_PUBLIC_PATHS).toContain(ApiPaths.config);
    expect(GATEWAY_PUBLIC_PATHS).toContain(ApiPaths.authBootstrap);
    expect(GATEWAY_PUBLIC_PATHS).toContain(ApiPaths.apiHealthLive);
    expect(GATEWAY_PUBLIC_PATHS).toContain(ApiPaths.platformTrackRecord);
  });

  it("metering exempts BYOK and credits", () => {
    expect(METERING_EXEMPT_PREFIXES).toContain(ApiPaths.authBootstrap);
    expect(METERING_EXEMPT_PREFIXES).toContain(
      ApiPaths.workspacesCurrentLlmKeys,
    );
    expect(METERING_EXEMPT_PREFIXES).toContain(ApiPaths.creditsPrefix);
    expect(METERING_EXEMPT_PREFIXES).toContain(ApiPaths.config);
  });

  it("x402 priced routes include workflow generate", () => {
    expect(X402_PRICED_PATHS[ApiPaths.workflowsGenerate]).toBeDefined();
    expect(X402_PRICED_PATHS["/workflows/generate"]).toBeDefined();
  });
});
