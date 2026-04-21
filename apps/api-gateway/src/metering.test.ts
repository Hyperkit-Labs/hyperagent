import { describe, expect, it } from "vitest";
import { resetGatewayEnvForTests } from "@hyperagent/config";
import { isMeteringEnforced, isMeteringExemptPath } from "./metering.js";

describe("metering", () => {
  it("isMeteringExemptPath exempts credits, payments, llm-keys, byok", () => {
    expect(isMeteringExemptPath("/api/v1/auth/bootstrap", "POST")).toBe(true);
    expect(isMeteringExemptPath("/auth/bootstrap", "POST")).toBe(true);
    expect(isMeteringExemptPath("/api/v1/credits/balance", "GET")).toBe(true);
    expect(isMeteringExemptPath("/api/v1/payments/history", "GET")).toBe(true);
    expect(
      isMeteringExemptPath(
        "/api/v1/workspaces/current/llm-keys/validate",
        "POST",
      ),
    ).toBe(true);
    expect(isMeteringExemptPath("/api/v1/byok/status", "GET")).toBe(true);
    expect(isMeteringExemptPath("/api/v1/config", "GET")).toBe(true);
    expect(isMeteringExemptPath("/config", "GET")).toBe(true);
    expect(isMeteringExemptPath("/config/integrations-debug", "GET")).toBe(
      true,
    );
    expect(isMeteringExemptPath("/platform/track-record", "GET")).toBe(true);
    expect(isMeteringExemptPath("/workspaces/current/llm-keys", "GET")).toBe(
      true,
    );
    expect(isMeteringExemptPath("/networks", "GET")).toBe(true);
    expect(isMeteringExemptPath("/tokens/stablecoins", "GET")).toBe(true);
  });

  it("isMeteringExemptPath does not exempt workflows", () => {
    expect(isMeteringExemptPath("/api/v1/workflows", "GET")).toBe(false);
    expect(isMeteringExemptPath("/api/v1/runs", "POST")).toBe(false);
  });

  it("isMeteringExemptPath handles OPTIONS", () => {
    expect(isMeteringExemptPath("/api/v1/workflows", "OPTIONS")).toBe(true);
  });

  it("isMeteringEnforced respects METERING_ENFORCED", () => {
    const prev = process.env.METERING_ENFORCED;
    const node = process.env.NODE_ENV;
    try {
      process.env.METERING_ENFORCED = "false";
      process.env.NODE_ENV = "production";
      resetGatewayEnvForTests();
      expect(isMeteringEnforced()).toBe(false);
      process.env.METERING_ENFORCED = "true";
      resetGatewayEnvForTests();
      expect(isMeteringEnforced()).toBe(true);
    } finally {
      process.env.METERING_ENFORCED = prev;
      process.env.NODE_ENV = node;
      resetGatewayEnvForTests();
    }
  });
});
