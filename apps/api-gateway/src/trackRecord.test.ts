import { resetGatewayEnvForTests } from "@hyperagent/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTrackRecordWithFallback, getTrackRecordFallback } from "./trackRecord.js";

describe("trackRecord fallback", () => {
  const original = {
    audits: process.env.PLATFORM_AUDITS_COMPLETED,
    vulns: process.env.PLATFORM_VULNERABILITIES_FOUND,
    researchers: process.env.PLATFORM_SECURITY_RESEARCHERS,
    contracts: process.env.PLATFORM_CONTRACTS_DEPLOYED,
  };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.PLATFORM_AUDITS_COMPLETED = original.audits;
    process.env.PLATFORM_VULNERABILITIES_FOUND = original.vulns;
    process.env.PLATFORM_SECURITY_RESEARCHERS = original.researchers;
    process.env.PLATFORM_CONTRACTS_DEPLOYED = original.contracts;
    resetGatewayEnvForTests();
  });

  it("loads integer env defaults for fallback payload", () => {
    process.env.PLATFORM_AUDITS_COMPLETED = "7";
    process.env.PLATFORM_VULNERABILITIES_FOUND = "12";
    process.env.PLATFORM_SECURITY_RESEARCHERS = "3";
    process.env.PLATFORM_CONTRACTS_DEPLOYED = "42";
    expect(getTrackRecordFallback()).toEqual({
      audits_completed: 7,
      vulnerabilities_found: 12,
      security_researchers: 3,
      contracts_deployed: 42,
      source: "gateway_env_fallback",
    });
  });

  it("returns fallback when upstream fails", async () => {
    process.env.PLATFORM_AUDITS_COMPLETED = "1";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("upstream down"));
    const payload = await fetchTrackRecordWithFallback(
      "http://orchestrator:8000",
      100,
      "req_1"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.source).toBe("gateway_env_fallback");
    expect(payload.audits_completed).toBe(1);
  });

  it("returns upstream payload when shape is valid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        audits_completed: 9,
        vulnerabilities_found: 8,
        security_researchers: 2,
        contracts_deployed: 11,
        source: "database",
      }),
    } as Response);
    const payload = await fetchTrackRecordWithFallback(
      "http://orchestrator:8000",
      100,
      "req_2"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload.source).toBe("database");
    expect(payload.audits_completed).toBe(9);
  });
});
